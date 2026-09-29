/** Root-only additive M80 v2 restore rehearsal. Never runs on import and never drops a database. */
import { mkdir, open, readFile, realpath } from "node:fs/promises"
import { basename, dirname, relative, resolve } from "node:path"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import {
  BACKUP_PROFILE,
  EXPECTED_NEW_TABLE_ROW_COUNTS,
  EXPECTED_NEW_TABLES,
  MIGRATION_SHA256,
  PROJECT_REF,
  REHEARSAL_PROFILE,
  RESTORE_PROFILE,
  captureApplicationState,
  check,
  createApplicationSnapshot,
  exactKeys,
  hash,
  sha,
  validateApplicationSnapshot,
  validateDisposableDatabaseName,
  verifyExactSource21,
  type ApplicationState,
  type BackupReceipt,
  type M80ApplicationSnapshot,
  type MigrationRehearsalReceipt,
  type RestoreReceipt,
} from "../../.superpowers/m80-backup-core"
import {
  M80_BACKUP_V2_NORMALIZATION_PROFILE,
  M80_BACKUP_V2_PRESERVATION_PROFILE,
  applyM80BackupV2Schema22,
  assertM80BackupV2ExactRestore,
  type M80BackupV2NormalizationProof,
  type M80BackupV2NormalizationReceipt,
  type M80BackupV2PreservationReceipt,
} from "./m80-restore-normalization-v2-independent-20260925-candidate1-core"

const SOURCE_DATABASE = "m78_ops_continuation_20260922"
const PG_ROOT = "C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin"
const PG_DUMP_SHA256 = "e856d19e6b73f351069d2d3d9f442e8c0371bebfc53c7e55b455adfc0b8ee14b"
const PG_RESTORE_SHA256 = "c85a472c22c4eb657f76e70a87b55e2070474cd0042bcb87b50a787d085d950c"
const PWSH_PATH = "C:/Users/nimab/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe"
const PWSH_SHA256 = "362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139"
const SEAL_SCRIPT = resolve(".superpowers/m80-backup-seal.ps1")
interface M80BackupV2RehearsalResult {
  outputDirectory: string
  database: string
  receiptHashes: { restore: string; normalization: string; preservation: string; migration: string }
}

function cleanPgEnvironment(database: string) {
  return { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("PG"))), PGHOST: "127.0.0.1", PGPORT: "55472", PGDATABASE: database, PGUSER: "supabase_admin", PGSSLMODE: "disable", PGCONNECT_TIMEOUT: "10" }
}

async function child(command: string[], refusalCode: string, stdin?: Uint8Array | string, environment?: Record<string, string | undefined>): Promise<Uint8Array> {
  const process = Bun.spawn(command, { env: environment, stdin: stdin === undefined ? "ignore" : "pipe", stdout: "pipe", stderr: "pipe" })
  if (stdin !== undefined) { await process.stdin.write(stdin); await process.stdin.end() }
  const [stdout, , code] = await Promise.all([new Response(process.stdout).arrayBuffer(), new Response(process.stderr).arrayBuffer(), process.exited])
  check(code === 0, refusalCode)
  return new Uint8Array(stdout)
}

async function assertOwnedOutput(path: string, root: string): Promise<string> {
  const full = resolve(path), allowed = await realpath(root), inside = relative(allowed, full)
  check(dirname(full) === allowed && basename(full).startsWith("m80-backup-v2-"), "M80_V2_OUTPUT_PATH_REFUSED")
  check(inside && !inside.startsWith("..") && !inside.includes(":"), "M80_V2_OUTPUT_ESCAPE_REFUSED")
  check(!await Bun.file(full).exists(), "M80_V2_EXISTING_OUTPUT_REFUSED")
  return full
}

async function readPinnedPrivateInput(path: string, expectedSha256: string): Promise<{ path: string; bytes: Uint8Array }> {
  check(/^[a-f0-9]{64}$/.test(expectedSha256), "M80_V2_PRIVATE_PIN_REQUIRED")
  const privateRoot = await realpath(resolve(".superpowers")), actual = await realpath(resolve(path)), inside = relative(privateRoot, actual)
  check(inside && !inside.startsWith("..") && !inside.includes(":") && basename(actual).startsWith("m80-backup-"), "M80_V2_PRIVATE_INPUT_REFUSED")
  const bytes = new Uint8Array(await readFile(actual))
  check(sha(bytes) === expectedSha256, "M80_V2_PRIVATE_INPUT_CHANGED")
  return { path: actual, bytes }
}

function validateHostedBackupReceipt(value: unknown, receiptSha256: string, archiveSha256: string, snapshot: M80ApplicationSnapshot, snapshotSha256: string): BackupReceipt {
  exactKeys(value, ["profile", "completedAt", "projectRef", "sourceSchemaVersion", "sourceApplicationStateSha256", "applicationOnly", "syntheticDataOnly", "providerRecoveryExcluded", "encryptedArchiveSha256", "snapshotSha256", "customDumpSha256"], "M80_V2_BACKUP_RECEIPT_SHAPE_REFUSED")
  const receipt = value as unknown as BackupReceipt, time = Date.parse(receipt.completedAt)
  check(Number.isFinite(time) && new Date(time).toISOString() === receipt.completedAt && time <= Date.now() + 5_000 && Date.now() - time <= 4 * 60 * 60_000, "M80_V2_BACKUP_RECEIPT_STALE")
  check(receipt.profile === BACKUP_PROFILE && receipt.projectRef === PROJECT_REF && snapshot.projectRef === PROJECT_REF && receipt.sourceSchemaVersion === 21 && receipt.applicationOnly === true && receipt.syntheticDataOnly === true && receipt.providerRecoveryExcluded === true, "M80_V2_BACKUP_BOUNDARY_CHANGED")
  check(receipt.encryptedArchiveSha256 === archiveSha256 && receipt.snapshotSha256 === snapshotSha256 && receipt.customDumpSha256 === snapshot.customDumpSha256 && receipt.sourceApplicationStateSha256 === snapshot.sourceApplicationStateSha256 && snapshot.sourceDatabase === "postgres" && /^[a-f0-9]{64}$/.test(receiptSha256), "M80_V2_BACKUP_BINDING_CHANGED")
  return receipt
}

async function writeExclusive(path: string, value: unknown): Promise<{ sha256: string }> {
  const bytes = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`), file = await open(path, "wx", 0o600)
  try { await file.writeFile(bytes); await file.sync() } finally { await file.close() }
  return { sha256: sha(bytes) }
}

async function appendJournal(file: Awaited<ReturnType<typeof open>>, value: unknown): Promise<void> {
  await file.writeFile(`${JSON.stringify(value)}\n`); await file.sync()
}

async function unsealSnapshot(archivePath: string): Promise<string> {
  check(sha(await readFile(PWSH_PATH)) === PWSH_SHA256, "M80_V2_PWSH_CHANGED")
  return new TextDecoder().decode(await child([PWSH_PATH, "-NoProfile", "-NonInteractive", "-File", SEAL_SCRIPT, "-Mode", "Unseal", "-ArchivePath", archivePath], "M80_V2_DPAPI_UNSEAL_FAILED"))
}

async function restoreSnapshot(snapshot: M80ApplicationSnapshot, snapshotSha256: string, database: string): Promise<{ restored: ApplicationState; proof: M80BackupV2NormalizationProof }> {
  validateDisposableDatabaseName(database)
  const admin = createPostgresConnection("postgres://supabase_admin@127.0.0.1:55472/postgres", { tls: false, maxConnections: 1 })
  let clone: ReturnType<typeof createPostgresConnection> | undefined
  try {
    check((await admin.query("select 1 from pg_database where datname=$1", [database])).rows.length === 0, "M80_V2_OCCUPIED_DATABASE_REFUSED")
    await admin.exec(`create database ${database} template template0`)
    clone = createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${database}`, { tls: false, maxConnections: 1 })
    await clone.exec("revoke all on schema public from public,anon,authenticated; create schema auth; create table auth.users(id uuid primary key); grant usage on schema auth to postgres,authenticated,neuvetra_runtime")
    for (const id of snapshot.authDependencies.authUserIds) await clone.query("insert into auth.users(id) values($1)", [id])
    await clone.exec(snapshot.authDependencies.authUidDefinition)
    const dump = Buffer.from(validateApplicationSnapshot(snapshot, snapshotSha256).customDumpBase64, "base64"), pgRestore = resolve(PG_ROOT, "pg_restore.exe")
    check(sha(await readFile(pgRestore)) === PG_RESTORE_SHA256, "M80_V2_PG_RESTORE_CHANGED")
    await child([pgRestore, "--exit-on-error", "--single-transaction", "--no-password", `--dbname=${database}`], "M80_V2_PG_RESTORE_FAILED", dump, cleanPgEnvironment(database))
    const restored = await clone.transaction(async tx => { await tx.exec("set transaction isolation level repeatable read read only"); await verifyExactSource21(tx, database, "local"); return captureApplicationState(tx) })
    return { restored, proof: assertM80BackupV2ExactRestore(snapshot.state, restored) }
  } finally { await clone?.close(); await admin.close() }
}

async function verifyRuntimeBoundary(database: string, actorId: string): Promise<void> {
  check(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId), "M80_V2_RUNTIME_ACTOR_REFUSED")
  const runtime = createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55472/${database}`, { tls: false, maxConnections: 1 })
  try {
    await runtime.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [actorId])
      await tx.exec("set transaction read only")
      const held = await tx.query<{ status: string }>("select status from neuvetra.scope1_beta_release_records order by profile_id")
      check(held.rows.length === 4 && held.rows.every(row => row.status === "held_candidate"), "M80_V2_RUNTIME_SELECT_BOUNDARY_CHANGED")
    })
    let denied = false
    try { await runtime.exec("insert into neuvetra.scope1_beta_fixture_admissions(company_id,fixture_profile_id,fixture_version,fixture_sha256,active,admitted_by) values('00000000-0000-4000-8000-000000000001','x',1,repeat('0',64),true,'00000000-0000-4000-8000-000000000001')") } catch { denied = true }
    check(denied, "M80_V2_RUNTIME_WRITE_BOUNDARY_CHANGED")
  } finally { await runtime.close() }
}

async function createOutputs(suffix: string) {
  const root = resolve(`.superpowers/m80-backup-v2-rehearsal-${suffix}`)
  await mkdir(root)
  return { root, paths: {
    restore: await assertOwnedOutput(`${root}/m80-backup-v2-restore-receipt.json`, root),
    normalization: await assertOwnedOutput(`${root}/m80-backup-v2-normalization-proof.json`, root),
    preservation: await assertOwnedOutput(`${root}/m80-backup-v2-preservation-receipt.json`, root),
    migration: await assertOwnedOutput(`${root}/m80-backup-v2-migration-receipt.json`, root),
    result: await assertOwnedOutput(`${root}/m80-backup-v2-result.json`, root),
    journal: await assertOwnedOutput(`${root}/m80-backup-v2-journal.jsonl`, root),
  } }
}

async function completeRehearsal(snapshot: M80ApplicationSnapshot, snapshotSha256: string, sourceBackupReceiptSha256: string, suffix: string) {
  const database = `m80_backup_foundation_${suffix}`; validateDisposableDatabaseName(database)
  const outputs = await createOutputs(suffix), journal = await open(outputs.paths.journal, "wx", 0o600)
  let clone: ReturnType<typeof createPostgresConnection> | undefined, stage = "schema21_restore"
  try {
    await appendJournal(journal, { status: "m80_backup_v2_started", stage, completedAt: new Date().toISOString(), database, sourceBackupReceiptSha256, liveAuthority: false })
    const { restored, proof } = await restoreSnapshot(snapshot, snapshotSha256, database)
    stage = "raw_schema21_to_schema22"
    clone = createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${database}`, { tls: false, maxConnections: 1 })
    await clone.transaction(tx => applyM80BackupV2Schema22(tx, restored))
    await clone.close(); clone = undefined
    await verifyRuntimeBoundary(database, snapshot.authDependencies.runtimeActorId)
    const completedAt = new Date().toISOString()
    const normalization: M80BackupV2NormalizationReceipt = { ...proof, completedAt, disposableDatabaseName: database, sourceBackupReceiptSha256, sourceContentSha256: snapshot.state.contentSha256, restoredContentSha256: restored.contentSha256 }
    const normalizationWrite = await writeExclusive(outputs.paths.normalization, normalization)
    const preservation: M80BackupV2PreservationReceipt = { profile: M80_BACKUP_V2_PRESERVATION_PROFILE, completedAt, disposableDatabaseName: database, sourceBackupReceiptSha256, normalizationProof: { path: relative(resolve("."), outputs.paths.normalization).replaceAll("\\", "/"), sha256: normalizationWrite.sha256 }, sourceContentSha256: snapshot.state.contentSha256, restoredContentSha256: restored.contentSha256, sourceRawApplicationStateSha256: snapshot.state.applicationStateSha256, restoredRawApplicationStateSha256: restored.applicationStateSha256, sourceNormalizedMetadataSha256: proof.sourceNormalizedMetadataSha256, restoredNormalizedMetadataSha256: proof.restoredNormalizedMetadataSha256, oldContentExact: true, applicationMetadataEquivalent: true, rawMetadataHashesEqual: snapshot.state.metadataSha256 === restored.metadataSha256 }
    const restoreReceipt: RestoreReceipt = { profile: RESTORE_PROFILE, completedAt, disposableDatabaseName: database, sourceBackupReceiptSha256, sourceSchemaVersion: 21, observedNonReceiptTables: restored.observedNonReceiptTables, observedNonReceiptTableCount: restored.observedNonReceiptTables.length, oldMigrationReceiptCount: 21, allConnectionsClosed: true }
    const migrationReceipt: MigrationRehearsalReceipt = { profile: REHEARSAL_PROFILE, completedAt, disposableDatabaseName: database, sourceSchemaVersion: 21, targetSchemaVersion: 22, migrationSha256: MIGRATION_SHA256, expectedNewTables: EXPECTED_NEW_TABLES, expectedNewTableRowCounts: EXPECTED_NEW_TABLE_ROW_COUNTS, releaseRecordsExactFourHeld: true, forcedRlsVerified: true, runtimeSelectOnlyVerified: true, runtimeDirectWritesDenied: true, operatorAdmissionNotExecuted: true, allConnectionsClosed: true, hostedEvidence: false }
    const receiptHashes = { restore: (await writeExclusive(outputs.paths.restore, restoreReceipt)).sha256, normalization: normalizationWrite.sha256, preservation: (await writeExclusive(outputs.paths.preservation, preservation)).sha256, migration: (await writeExclusive(outputs.paths.migration, migrationReceipt)).sha256 }
    await writeExclusive(outputs.paths.result, { profile: "neuvetra.m80.foundation-restore-normalization-rehearsal-result.v2", completedAt, database, sourceBackupReceiptSha256, rawSourceApplicationStateSha256: snapshot.state.applicationStateSha256, rawRestoredApplicationStateSha256: restored.applicationStateSha256, normalizedMetadataSha256: proof.sourceNormalizedMetadataSha256, contentExact: snapshot.state.contentSha256 === restored.contentSha256, applicationMetadataEquivalent: true, rawSchema21To22Preservation: true, receiptHashes, hostedEvidence: false, liveAuthority: false })
    await appendJournal(journal, { status: "m80_backup_v2_completed", stage: "complete", completedAt, database, sourceBackupReceiptSha256, receiptHashes, liveAuthority: false })
    return { outputDirectory: relative(resolve("."), outputs.root).replaceAll("\\", "/"), database, receiptHashes }
  } catch (error) {
    const code = error instanceof Error && /^M80_V2_[A-Z0-9_]+$/.test(error.message) ? error.message : "M80_V2_REHEARSAL_REFUSED"
    try { await appendJournal(journal, { status: "m80_backup_v2_failed_do_not_retry_silently", stage, completedAt: new Date().toISOString(), database, errorCode: code, liveAuthority: false }) } catch {}
    throw new Error(code)
  } finally { await clone?.close(); await journal.close() }
}

export async function runM80BackupV2SyntheticNative(): Promise<M80BackupV2RehearsalResult> {
  const pgDump = resolve(PG_ROOT, "pg_dump.exe"); check(sha(await readFile(pgDump)) === PG_DUMP_SHA256, "M80_V2_PG_DUMP_CHANGED")
  const source = createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${SOURCE_DATABASE}`, { tls: false, maxConnections: 1 })
  try {
    const snapshot = await createApplicationSnapshot(source, SOURCE_DATABASE, "local", { dump: (database, snapshotId) => child([pgDump, "--format=custom", "--no-password", "--schema=neuvetra", `--snapshot=${snapshotId}`], "M80_V2_PG_DUMP_FAILED", undefined, cleanPgEnvironment(database)) })
    const snapshotText = JSON.stringify(snapshot), snapshotSha256 = sha(snapshotText), sourceEvidenceSha256 = sha(`${snapshotSha256}:synthetic-native-v2`)
    return completeRehearsal(snapshot, snapshotSha256, sourceEvidenceSha256, Date.now().toString())
  } finally { await source.close() }
}

export async function runM80BackupV2Hosted(input: { operatorId: "/root"; archivePath: string; archiveSha256: string; backupReceiptPath: string; backupReceiptSha256: string }): Promise<M80BackupV2RehearsalResult> {
  check(input.operatorId === "/root", "M80_V2_ROOT_ONLY")
  const archive = await readPinnedPrivateInput(input.archivePath, input.archiveSha256), receipt = await readPinnedPrivateInput(input.backupReceiptPath, input.backupReceiptSha256)
  const snapshotText = await unsealSnapshot(archive.path), snapshotSha256 = sha(snapshotText), snapshot = validateApplicationSnapshot(JSON.parse(snapshotText), snapshotSha256)
  validateHostedBackupReceipt(JSON.parse(new TextDecoder().decode(receipt.bytes)), input.backupReceiptSha256, input.archiveSha256, snapshot, snapshotSha256)
  return completeRehearsal(snapshot, snapshotSha256, input.backupReceiptSha256, Date.now().toString())
}

if (import.meta.main) {
  try {
    const mode = process.argv[2]
    if (mode === "synthetic-native") console.log(JSON.stringify({ status: "m80_backup_v2_synthetic_native_pass", ...await runM80BackupV2SyntheticNative() }))
    else if (mode === "restore-hosted") {
      const value = JSON.parse(await Bun.stdin.text())
      exactKeys(value, ["operatorId", "archivePath", "archiveSha256", "backupReceiptPath", "backupReceiptSha256"], "M80_V2_HOSTED_INPUT_SHAPE_REFUSED")
      console.log(JSON.stringify({ status: "m80_backup_v2_hosted_restore_pass", ...await runM80BackupV2Hosted(value as Parameters<typeof runM80BackupV2Hosted>[0]) }))
    } else throw new Error("M80_V2_EXPLICIT_MODE_REQUIRED")
  } catch (error) {
    const code = error instanceof Error && /^M80_V2_[A-Z0-9_]+$/.test(error.message) ? error.message : "M80_V2_REHEARSAL_REFUSED"
    console.error(JSON.stringify({ status: "m80_backup_v2_refused_or_failed", errorCode: code }))
    process.exitCode = 1
  }
}
