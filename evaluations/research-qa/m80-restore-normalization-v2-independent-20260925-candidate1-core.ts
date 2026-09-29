/** Additive M80 restore-normalization successor. Importing performs no I/O. */
import { readFile } from "node:fs/promises"
import type { WorkspaceSql } from "../../packages/neuvetra-database/src/workspace"
import {
  EXPECTED_NEW_TABLES,
  MIGRATION_NAME,
  MIGRATION_SHA256,
  assertExactRestore,
  assertSchema22Delta,
  captureApplicationState,
  hash,
  sha,
  type ApplicationState,
} from "../../.superpowers/m80-backup-core"
import { canonical, check, sameExactInventory } from "../../tools/staging/m78-inventory"

export const M80_BACKUP_V2_NORMALIZATION_PROFILE = "neuvetra.m80.foundation-restore-normalization-proof.v2" as const
export const M80_BACKUP_V2_PRESERVATION_PROFILE = "neuvetra.m80.foundation-hosted-preservation-receipt.v2" as const

type DefaultAcl = ApplicationState["inventory"]["defaultAcls"][number]
type InternalTrigger = ApplicationState["internalTriggers"][number]

const ordinal = (left: unknown, right: unknown): number => {
  const a = canonical(left), b = canonical(right)
  return a < b ? -1 : a > b ? 1 : 0
}

function assertDefaultAclRow(value: unknown): asserts value is DefaultAcl {
  check(!!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype, "M80_V2_DEFAULT_ACL_ROW_MALFORMED")
  const row = value as Record<string, unknown>
  check(Object.keys(row).sort().join("|") === "acl|kind|owner|schema", "M80_V2_DEFAULT_ACL_ROW_MALFORMED")
  const identifier = (item: unknown) => typeof item === "string" && Buffer.byteLength(item, "utf8") >= 1 && Buffer.byteLength(item, "utf8") <= 63 && !item.includes("\0")
  check(identifier(row.owner) && identifier(row.schema) && typeof row.kind === "string" && /^[rSfTn]$/.test(row.kind) && typeof row.acl === "string" && row.acl.length > 0 && !row.acl.includes("\0"), "M80_V2_DEFAULT_ACL_ROW_MALFORMED")
}

function assertDefaultAclRows(rows: DefaultAcl[]): void {
  check(Array.isArray(rows), "M80_V2_DEFAULT_ACL_ROW_MALFORMED")
  rows.forEach(assertDefaultAclRow)
}

export interface M80BackupV2NormalizationProof {
  profile: typeof M80_BACKUP_V2_NORMALIZATION_PROFILE
  sourceRawApplicationStateSha256: string
  restoredRawApplicationStateSha256: string
  sourceRawMetadataSha256: string
  restoredRawMetadataSha256: string
  sourceExternalDefaultAclRowsExcluded: number
  restoredExternalDefaultAclRows: 0
  scopedDefaultAclRowsExact: true
  sourceInternalTriggerRows: number
  restoredInternalTriggerRows: number
  internalTriggerSemanticMultisetExact: true
  allOtherInventoryMetadataExact: true
  sourceNormalizedMetadataSha256: string
  restoredNormalizedMetadataSha256: string
  normalizedMetadataExact: true
}

export interface M80BackupV2NormalizationReceipt extends M80BackupV2NormalizationProof {
  completedAt: string
  disposableDatabaseName: string
  sourceBackupReceiptSha256: string
  sourceContentSha256: string
  restoredContentSha256: string
}

export interface M80BackupV2PreservationReceipt {
  profile: typeof M80_BACKUP_V2_PRESERVATION_PROFILE
  completedAt: string
  disposableDatabaseName: string
  sourceBackupReceiptSha256: string
  normalizationProof: { path: string; sha256: string }
  sourceContentSha256: string
  restoredContentSha256: string
  sourceRawApplicationStateSha256: string
  restoredRawApplicationStateSha256: string
  sourceNormalizedMetadataSha256: string
  restoredNormalizedMetadataSha256: string
  oldContentExact: true
  applicationMetadataEquivalent: true
  rawMetadataHashesEqual: boolean
}

function scopedDefaultAcls(rows: DefaultAcl[]): DefaultAcl[] {
  assertDefaultAclRows(rows)
  return rows
    .filter(row => row.schema === "neuvetra" || row.schema === "*")
    .map(row => structuredClone(row))
    .sort(ordinal)
}

function externalDefaultAcls(rows: DefaultAcl[]): DefaultAcl[] {
  assertDefaultAclRows(rows)
  return rows.filter(row => row.schema !== "neuvetra" && row.schema !== "*")
}

function normalizedInternalTriggers(rows: InternalTrigger[]): InternalTrigger[] {
  return rows.map(row => structuredClone(row)).sort(ordinal)
}

function normalizedMetadataProjection(state: ApplicationState) {
  const value = state.inventory
  return {
    nonReceiptTables: state.observedNonReceiptTables,
    tableSecurity: state.tableSecurity,
    schemaSecurity: state.schemaSecurity,
    internalTriggers: normalizedInternalTriggers(state.internalTriggers),
    functions: value.functions,
    tableObjects: value.tableObjects,
    sequences: value.sequences,
    roles: value.roles,
    memberships: value.memberships,
    defaultAcls: scopedDefaultAcls(value.defaultAcls),
    dependencies: value.dependencies,
  }
}

export function m80BackupV2NormalizedMetadataSha256(state: ApplicationState): string {
  return hash(normalizedMetadataProjection(state))
}

export function normalizeM80BackupV2State(state: ApplicationState): ApplicationState {
  const inventory = { ...structuredClone(state.inventory), defaultAcls: scopedDefaultAcls(state.inventory.defaultAcls) }
  const internalTriggers = normalizedInternalTriggers(state.internalTriggers)
  const normalized = { ...structuredClone(state), inventory, internalTriggers }
  const metadataSha256 = m80BackupV2NormalizedMetadataSha256(normalized)
  return { ...normalized, metadataSha256, applicationStateSha256: hash({ contentSha256: normalized.contentSha256, metadataSha256 }) }
}

function assertDefaultAclDifference(source: ApplicationState, restored: ApplicationState): number {
  const sourceScoped = scopedDefaultAcls(source.inventory.defaultAcls), restoredScoped = scopedDefaultAcls(restored.inventory.defaultAcls)
  check(hash(sourceScoped) === hash(restoredScoped), "M80_V2_SCOPED_DEFAULT_ACL_CHANGED")
  check(externalDefaultAcls(restored.inventory.defaultAcls).length === 0, "M80_V2_RESTORED_EXTERNAL_DEFAULT_ACL_UNEXPECTED")
  return externalDefaultAcls(source.inventory.defaultAcls).length
}

function assertTriggerMultiset(source: ApplicationState, restored: ApplicationState): void {
  const before = normalizedInternalTriggers(source.internalTriggers), after = normalizedInternalTriggers(restored.internalTriggers)
  check(before.length === after.length && hash(before) === hash(after), "M80_V2_INTERNAL_TRIGGER_MULTISET_CHANGED")
}

function assertOtherExact(source: ApplicationState, restored: ApplicationState): void {
  const sourceInventory = { ...structuredClone(source.inventory), defaultAcls: [] }
  const restoredInventory = { ...structuredClone(restored.inventory), defaultAcls: [] }
  sameExactInventory(sourceInventory, restoredInventory)
  check(hash(source.migrationReceipts) === hash(restored.migrationReceipts), "M80_V2_MIGRATION_RECEIPTS_CHANGED")
  check(hash(source.observedNonReceiptTables) === hash(restored.observedNonReceiptTables), "M80_V2_TABLE_SET_CHANGED")
  check(hash(source.tableSecurity) === hash(restored.tableSecurity), "M80_V2_TABLE_SECURITY_CHANGED")
  check(hash(source.schemaSecurity) === hash(restored.schemaSecurity), "M80_V2_SCHEMA_SECURITY_CHANGED")
  check(source.contentSha256 === restored.contentSha256, "M80_V2_CONTENT_CHANGED")
}

export function assertM80BackupV2ExactRestore(source: ApplicationState, restored: ApplicationState): M80BackupV2NormalizationProof {
  const excluded = assertDefaultAclDifference(source, restored)
  assertTriggerMultiset(source, restored)
  assertOtherExact(source, restored)
  const before = normalizeM80BackupV2State(source), after = normalizeM80BackupV2State(restored)
  assertExactRestore(before, after)
  return {
    profile: M80_BACKUP_V2_NORMALIZATION_PROFILE,
    sourceRawApplicationStateSha256: source.applicationStateSha256,
    restoredRawApplicationStateSha256: restored.applicationStateSha256,
    sourceRawMetadataSha256: source.metadataSha256,
    restoredRawMetadataSha256: restored.metadataSha256,
    sourceExternalDefaultAclRowsExcluded: excluded,
    restoredExternalDefaultAclRows: 0,
    scopedDefaultAclRowsExact: true,
    sourceInternalTriggerRows: source.internalTriggers.length,
    restoredInternalTriggerRows: restored.internalTriggers.length,
    internalTriggerSemanticMultisetExact: true,
    allOtherInventoryMetadataExact: true,
    sourceNormalizedMetadataSha256: before.metadataSha256,
    restoredNormalizedMetadataSha256: after.metadataSha256,
    normalizedMetadataExact: true,
  }
}

function subtractTriggerMultiset(source: InternalTrigger[], after: InternalTrigger[]): InternalTrigger[] {
  const remaining = new Map<string, { row: InternalTrigger; count: number }>()
  for (const row of normalizedInternalTriggers(after)) {
    const key = canonical(row), item = remaining.get(key)
    remaining.set(key, { row, count: (item?.count ?? 0) + 1 })
  }
  for (const row of normalizedInternalTriggers(source)) {
    const key = canonical(row), item = remaining.get(key)
    check(!!item && item.count > 0, "M80_V2_OLD_INTERNAL_TRIGGER_MISSING")
    if (item.count === 1) remaining.delete(key)
    else item.count--
  }
  return [...remaining.values()].flatMap(item => Array.from({ length: item.count }, () => item.row))
}

export function assertM80BackupV2RawTriggerDelta(restoredBaseline: ApplicationState, after: ApplicationState): void {
  const addedTriggers = subtractTriggerMultiset(restoredBaseline.internalTriggers, after.internalTriggers)
  check(addedTriggers.every(row => (EXPECTED_NEW_TABLES as readonly string[]).includes(row.constraintTable.replace("neuvetra.", ""))), "M80_V2_UNEXPECTED_INTERNAL_TRIGGER_ADDED")
}

export async function assertM80BackupV2RawSchema22Delta(restoredBaseline: ApplicationState, after: ApplicationState, tx: WorkspaceSql): Promise<void> {
  check(hash(restoredBaseline.inventory.defaultAcls) === hash(after.inventory.defaultAcls), "M80_V2_SCHEMA22_DEFAULT_ACL_CHANGED")
  assertM80BackupV2RawTriggerDelta(restoredBaseline, after)
  await assertSchema22Delta(restoredBaseline, after, tx)
}

export async function applyM80BackupV2Schema22(tx: WorkspaceSql, restoredBaseline: ApplicationState): Promise<ApplicationState> {
  const current = await captureApplicationState(tx)
  assertExactRestore(restoredBaseline, current)
  const sql = await readFile(`packages/neuvetra-database/src/migrations/${MIGRATION_NAME}`, "utf8")
  check(sha(sql) === MIGRATION_SHA256, "M80_V2_MIGRATION_BYTES_CHANGED")
  await tx.exec(sql)
  await tx.query("insert into neuvetra.schema_migrations(name,sha256) values($1,$2)", [MIGRATION_NAME, MIGRATION_SHA256])
  const after = await captureApplicationState(tx)
  await assertM80BackupV2RawSchema22Delta(restoredBaseline, after, tx)
  return after
}
