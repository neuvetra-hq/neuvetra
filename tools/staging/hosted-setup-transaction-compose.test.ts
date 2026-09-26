import { afterAll, describe, expect, test } from "bun:test"
import { createServer } from "node:net"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { readMigrationManifest } from "../../packages/neuvetra-database/src/staging-migrations"
import { HOSTED_SETUP_PROFILE, HOSTED_SETUP_PROJECT } from "./hosted-setup-upgrade"
import { ARTIFACT_PROFILE, ARTIFACT_SOURCE_PROFILE } from "./hosted-setup-artifact-source"
import { HOSTED_SETUP_TRANSACTIONAL_PROFILE } from "./hosted-setup-transactional-upgrade"
import type { HostedSetupComposeInput } from "./hosted-setup-transaction-compose"

const pgBin = process.env.NEUVETRA_PG17_BIN ?? "C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin"
const native = await Bun.file(join(pgBin, "postgres.exe")).exists()
const stops: Array<() => Promise<void>> = []

afterAll(async () => {
  for (const stop of stops.reverse()) await stop()
})

async function freePort() {
  const server = createServer()
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("LOCAL_COMPOSE_PORT_UNAVAILABLE")
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return address.port
}

async function command(args: string[], capture = false) {
  const child = Bun.spawn(args, { stdin: "ignore", stdout: capture ? "pipe" : "ignore", stderr: capture ? "pipe" : "ignore" })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    capture ? new Response(child.stdout).text() : Promise.resolve(""),
    capture ? new Response(child.stderr).text() : Promise.resolve(""),
  ])
  if (code !== 0) throw new Error(`LOCAL_COMPOSE_COMMAND_FAILED:${args[0]}:${stderr || stdout}`)
  return stdout
}

function literal(value: string) {
  return "'" + value.replaceAll("'", "''") + "'"
}

async function runChild(root: string, input: HostedSetupComposeInput, timeoutMs = 20_000) {
  const inputPath = join(root, `${input.mode}-${crypto.randomUUID()}.json`)
  await writeFile(inputPath, JSON.stringify(input), { encoding: "utf8", flag: "wx" })
  const child = Bun.spawn([process.execPath, join(import.meta.dir, "hosted-setup-transaction-compose.child.ts"), inputPath], { stdin: "ignore", stdout: "pipe", stderr: "pipe" })
  let timer: ReturnType<typeof setTimeout> | undefined
  const outcome = await Promise.race([
    child.exited.then(code => ({ code, timedOut: false })),
    new Promise<{ code: number; timedOut: true }>(resolve => { timer = setTimeout(() => resolve({ code: -1, timedOut: true }), timeoutMs) }),
  ])
  if (timer) clearTimeout(timer)
  if (outcome.timedOut) child.kill()
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()])
  if (outcome.code !== 0 || outcome.timedOut || stderr) throw new Error(`LOCAL_COMPOSE_CHILD_FAILED:${JSON.stringify({ outcome, stderr })}`)
  return JSON.parse(stdout.trim()) as Record<string, unknown>
}

describe.skipIf(!native)("dedicated client plus versioned artifact transaction runner", () => {
  test("commits, rolls back, times out, refuses replay, and reconciles in fresh one-shot processes", async () => {
    const root = await mkdtemp(join(tmpdir(), "hosted-setup-compose-"))
    const data = join(root, "data"), log = join(root, "postgres.log")
    const initdb = join(pgBin, "initdb.exe"), pgCtl = join(pgBin, "pg_ctl.exe"), postgres = join(pgBin, "postgres.exe"), psql = join(pgBin, "psql.exe")
    expect(new TextDecoder().decode(Bun.spawnSync([postgres, "--version"], { stdout: "pipe" }).stdout)).toContain("PostgreSQL) 17.")
    const port = await freePort()
    expect(port).not.toBe(55479)
    await command([initdb, "-D", data, "-U", "postgres", "--auth=trust", "--no-locale", "--encoding=UTF8"])
    await command([pgCtl, "-D", data, "-l", log, "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"])
    let stopped = false
    const stop = async () => {
      if (stopped) return
      stopped = true
      await command([pgCtl, "-D", data, "-m", "fast", "-w", "stop"])
    }
    stops.push(stop)
    const adminUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`
    const manifest = await readMigrationManifest()
    expect(manifest).toHaveLength(23)
    await command([psql, adminUrl, "-X", "-v", "ON_ERROR_STOP=1", "-c", "create role authenticated nologin; create role anon nologin; create role neuvetra_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls"], true)

    const psqlQuery = (url: string, sql: string) => command([psql, url, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], true).then(value => value.trim())
    const provision = async (name: string) => {
      if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error("LOCAL_COMPOSE_DATABASE_NAME_REFUSED")
      if (name !== "postgres") await psqlQuery(adminUrl, `create database "${name}" template template0`)
      const url = `postgresql://postgres@127.0.0.1:${port}/${name}`
      const migrations = manifest.slice(0, 22).map(entry => entry.sql.replace("create role neuvetra_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;", ""))
      const setupSql = [
        "create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
        ...migrations,
        `revoke create on database "${name}" from public,anon,authenticated; revoke all on schema public,neuvetra from public,anon,authenticated; revoke all on all tables in schema public,neuvetra from public,anon,authenticated; revoke all on all sequences in schema public,neuvetra from public,anon,authenticated; revoke all on all functions in schema public,neuvetra from public,anon,authenticated;`,
        "create table neuvetra.schema_migrations(name text primary key,sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),applied_at timestamptz not null default now());",
        "create table neuvetra.staging_target(singleton boolean primary key default true check(singleton),project_ref text not null,profile text not null);",
        "alter table neuvetra.schema_migrations enable row level security; alter table neuvetra.schema_migrations force row level security; alter table neuvetra.staging_target enable row level security; alter table neuvetra.staging_target force row level security;",
        "create policy m63_receipts_read on neuvetra.schema_migrations for select to neuvetra_runtime using(true); create policy m63_target_read on neuvetra.staging_target for select to neuvetra_runtime using(true); grant select on neuvetra.schema_migrations,neuvetra.staging_target to neuvetra_runtime;",
        ...manifest.slice(0, 22).map(entry => `insert into neuvetra.schema_migrations(name,sha256) values(${literal(entry.name)},${literal(entry.sha256)});`),
        `insert into neuvetra.staging_target(project_ref,profile) values(${literal(HOSTED_SETUP_PROJECT)},${literal(HOSTED_SETUP_PROFILE)});`,
        "insert into auth.users(id) values('00000000-0000-4000-8000-000000000001');",
        "insert into neuvetra.companies(id,name,country_code,state_code,created_by) values('10000000-0000-4000-8000-000000000001','Synthetic Compose Sentinel','US','CA','00000000-0000-4000-8000-000000000001');",
        "insert into neuvetra.company_members(company_id,user_id,role) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner');",
      ].join("\n")
      expect(setupSql).not.toContain("create role neuvetra_runtime nologin")
      const setupPath = join(root, `${name}-schema22.sql`)
      await writeFile(setupPath, setupSql, "utf8")
      await command([psql, url, "-X", "-v", "ON_ERROR_STOP=1", "-f", setupPath], true)
      const base = { profile: "neuvetra.hosted-setup.transaction-compose.local-only.v1" as const, connectionString: url, psqlPath: psql }
      const snapshot = await runChild(root, { ...base, mode: "snapshot", applicationName: `compose-${name}-snapshot` })
      expect(snapshot).toMatchObject({ mode: "snapshot", schemaVersion: 22 })
      expect(snapshot.fingerprintSha256).toMatch(/^[0-9a-f]{64}$/)
      return { url, base, fingerprint: String(snapshot.fingerprintSha256) }
    }
    const databaseState = (url: string) => psqlQuery(url, "select count(*)::text||'|'||(select count(*)::text from neuvetra.schema_migrations)||'|'||(select count(*)::text from neuvetra.companies where id='10000000-0000-4000-8000-000000000001')||'|'||(select count(*)::text from neuvetra.schema_migrations where name='0023_company_setup.sql') from information_schema.tables where table_schema='neuvetra' and table_name like 'company_setup_%'")
    const connectionState = (applicationName: string) => psqlQuery(adminUrl, `select count(*)::text||'|'||coalesce(sum((select count(*) from pg_locks l where l.pid=a.pid)),0)::text from pg_stat_activity a where application_name=${literal(applicationName)}`)
    const assertOneBackend = (result: Record<string, unknown>) => {
      const observations = result.backendObservations as Array<{ pids: string; sessions: string; locks: string }>
      expect(observations).toHaveLength(2)
      expect(observations[0]?.pids).toMatch(/^\d+$/)
      expect(observations[1]?.pids).toBe(observations[0]?.pids)
      expect(observations.map(value => value.sessions)).toEqual(["1", "1"])
      expect(observations.every(value => Number(value.locks) > 0)).toBeTrue()
      return observations[0]!.pids
    }
    const journalStatuses = async (path: string) => (await readFile(path, "utf8")).trim().split("\n").map(line => JSON.parse(line).data.status)

    const committed = await provision("postgres")
    expect(await connectionState("compose-postgres-snapshot")).toBe("0|0")
    const commitApp = "compose-commit"
    const commitJournal = join(root, "compose-commit.jsonl")
    const commitResult = await runChild(root, { ...committed.base, mode: "commit", applicationName: commitApp, journalPath: commitJournal, expectedFingerprintSha256: committed.fingerprint })
    expect(commitResult).toMatchObject({ mode: "commit", outcome: "committed", migrationCalls: 1, transactionCallbackFailure: null, approvalEvidence: "synthetic-mock-only", launchAuthorized: false })
    expect(commitResult.receipt).toMatchObject({ profile: HOSTED_SETUP_TRANSACTIONAL_PROFILE, executionArtifactSha256: "4".repeat(64), executionArtifactProfile: ARTIFACT_PROFILE, artifactSourceProfile: ARTIFACT_SOURCE_PROFILE, artifactTrustBoundary: "trusted-operator-host", artifactClaim: "verified-at-rest-artifact-and-private-sql-only", runtimeLoadedCodeAttested: false, launchAuthorized: false, onePhysicalTransaction: true })
    const commitPid = assertOneBackend(commitResult)
    expect(await databaseState(committed.url)).toBe("8|23|1|1")
    expect(await psqlQuery(committed.url, "select name||'|'||(select count(*)::text from neuvetra.company_members where company_id=companies.id) from neuvetra.companies where id='10000000-0000-4000-8000-000000000001'")).toBe("Synthetic Compose Sentinel|1")
    expect(await connectionState(commitApp)).toBe("0|0")
    expect(await journalStatuses(commitJournal)).toEqual(["hosted_setup_transaction_reserved", "hosted_setup_schema22_locked_and_verified", "hosted_setup_transaction_verified_pending_commit", "hosted_setup_schema23_commit_resolved"])

    const reconcileCommitApp = "compose-reconcile-commit"
    const reconcileCommit = await runChild(root, { ...committed.base, mode: "reconcile", applicationName: reconcileCommitApp, expectedMigrationSha256: manifest[22]!.sha256, originalTransactionResolved: true })
    expect(reconcileCommit).toMatchObject({ mode: "reconcile", outcome: "resolved", receipt: { status: "hosted_setup_commit_marker_present_after_resolution", noAutomaticRetry: true } })
    expect(await connectionState(reconcileCommitApp)).toBe("0|0")

    const replayApp = "compose-replay"
    const replay = await runChild(root, { ...committed.base, mode: "commit", applicationName: replayApp, journalPath: commitJournal, expectedFingerprintSha256: committed.fingerprint })
    expect(replay).toMatchObject({ mode: "commit", outcome: "refused", phases: ["before_transaction"], migrationCalls: 0, transactionCallbackFailure: null, approvalEvidence: "synthetic-mock-only", launchAuthorized: false })
    expect(await databaseState(committed.url)).toBe("8|23|1|1")
    expect(await connectionState(replayApp)).toBe("0|0")

    const rolledBack = await provision("compose_rollback")
    expect(await connectionState("compose-compose_rollback-snapshot")).toBe("0|0")
    const rollbackApp = "compose-rollback"
    const rollbackJournal = join(root, "compose-rollback.jsonl")
    const rollbackResult = await runChild(root, { ...rolledBack.base, mode: "rollback", applicationName: rollbackApp, journalPath: rollbackJournal, expectedFingerprintSha256: rolledBack.fingerprint })
    expect(rollbackResult).toMatchObject({ mode: "rollback", outcome: "refused", error: "hosted_setup_transaction_outcome_unknown_do_not_retry", migrationCalls: 1, transactionCallbackFailure: { message: "LOCAL_ONLY_FORCED_ROLLBACK" } })
    const rollbackPid = assertOneBackend(rollbackResult)
    expect(await databaseState(rolledBack.url)).toBe("0|22|1|0")
    expect(await connectionState(rollbackApp)).toBe("0|0")
    expect(await journalStatuses(rollbackJournal)).toEqual(["hosted_setup_transaction_reserved", "hosted_setup_schema22_locked_and_verified", "hosted_setup_transaction_outcome_unknown_do_not_retry"])
    const prematureResolution = await runChild(root, { ...rolledBack.base, mode: "reconcile", applicationName: "compose-reconcile-premature", expectedMigrationSha256: manifest[22]!.sha256, originalTransactionResolved: false })
    expect(prematureResolution).toMatchObject({ mode: "reconcile", outcome: "refused", error: "Original transaction resolution must be observed before reading the commit marker" })
    expect(await connectionState("compose-reconcile-premature")).toBe("0|0")
    const reconcileRollback = await runChild(root, { ...rolledBack.base, mode: "reconcile", applicationName: "compose-reconcile-rollback", expectedMigrationSha256: manifest[22]!.sha256, originalTransactionResolved: true })
    expect(reconcileRollback).toMatchObject({ outcome: "resolved", receipt: { status: "hosted_setup_no_commit_marker_after_resolution", noAutomaticRetry: true } })
    expect(await connectionState("compose-reconcile-rollback")).toBe("0|0")

    const timedOut = await provision("compose_timeout")
    expect(await connectionState("compose-compose_timeout-snapshot")).toBe("0|0")
    const timeoutApp = "compose-timeout"
    const timeoutJournal = join(root, "compose-timeout.jsonl")
    const timeoutResult = await runChild(root, { ...timedOut.base, mode: "timeout", applicationName: timeoutApp, journalPath: timeoutJournal, expectedFingerprintSha256: timedOut.fingerprint })
    expect(timeoutResult).toMatchObject({ mode: "timeout", outcome: "refused", error: "hosted_setup_transaction_outcome_unknown_do_not_retry", migrationCalls: 1 })
    const timeoutPid = assertOneBackend(timeoutResult)
    expect(await databaseState(timedOut.url)).toBe("0|22|1|0")
    expect(await connectionState(timeoutApp)).toBe("0|0")
    expect(await journalStatuses(timeoutJournal)).toEqual(["hosted_setup_transaction_reserved", "hosted_setup_schema22_locked_and_verified", "hosted_setup_transaction_outcome_unknown_do_not_retry"])
    const reconcileTimeout = await runChild(root, { ...timedOut.base, mode: "reconcile", applicationName: "compose-reconcile-timeout", expectedMigrationSha256: manifest[22]!.sha256, originalTransactionResolved: true })
    expect(reconcileTimeout).toMatchObject({ outcome: "resolved", receipt: { status: "hosted_setup_no_commit_marker_after_resolution", noAutomaticRetry: true } })
    expect(await connectionState("compose-reconcile-timeout")).toBe("0|0")
    expect(await psqlQuery(adminUrl, "select count(*)::text||'|'||coalesce(sum((select count(*) from pg_locks l where l.pid=a.pid)),0)::text from pg_stat_activity a where application_name like 'compose-%'")).toBe("0|0")
    console.log(JSON.stringify({ profile: "neuvetra.hosted-setup.transaction-compose.native-result.v1", postgres: "17.11", port, commitPid, rollbackPid, timeoutPid, migrationSha256: manifest[22]!.sha256, executionArtifactSha256: "4".repeat(64), artifactSourceProfile: ARTIFACT_SOURCE_PROFILE, approvalEvidence: "synthetic-mock-only", launchAuthorized: false, commit: "marker_present", rollback: "marker_absent", timeout: "marker_absent", replay: "refused_before_transaction", finalComposeSessions: 0, finalComposeLocks: 0, localOnly: true }))

    await stop()
    console.log(`Hosted setup composition fixture: PostgreSQL 17; loopback port ${port}; retained ${root}`)
  }, 120_000)
})
