/**
 * The frozen contract of Scope 3 report profile `neuvetra.scope3-report.v4` (BF-31a, the reader; the writer follows in
 * BF-31b). Once a v4 document may exist, never edit this file: change the document through a later profile.
 * `scope3-report-v4.test.ts` pins this file's SHA-256.
 *
 * v4 is v3 (whose frozen rules apply unchanged) with one change to the results it embeds (BF-31 design, option (b)): a
 * line derived from another record (3C, 3C upstream and 3B from electricity; 3A from natural gas, No. 2 distillate or a
 * vehicle; 3D upstream from an energy-resold record) carries `payload: null` instead of a copy of its source record's
 * saved payload, and the results list each source record version once in `sourceRecords`: its record and version IDs,
 * its kind, the SHA-256 the database stores for that exact version (0027 `payload_sha256`, the canonical JSON of the
 * whole saved activity) and only the facts the derivation uses (a fixed allow-list per kind; never certificates). An
 * energy-resold source has no facts here: its own full line, payload included, is in the same results.
 *
 * Self-contained like v1-v3: structure and internal consistency only, never live wording, the live catalog or a live
 * decoder. The entry shape, the allow-lists and the packing rule are defined here once, so the writer (BF-31b), this
 * validator and the web results decoder share exactly one definition:
 * - entries are sorted by `versionId` ascending (plain string order of the lowercase UUIDs), one per source version;
 * - an entry has exactly the keys `recordId`, `versionId`, `kind`, `activitySha256`, `facts`;
 * - `facts` has exactly its kind's allow-list keys, each value copied from the saved payload as decoded (a key the
 *   payload lacks is written as null, never omitted; nested values as saved); the stored text's canonical JSON sorts
 *   keys at every level, so no other canonicalisation is applied; `facts` is null for an energy-resold source.
 */
import { SCOPE3_REPORT_PROFILE_V3, validateScope3ReportDocumentV3, type Scope3ReportDocumentV3, type Scope3ReportResultsV3 } from './scope3-report-v3'

export const SCOPE3_REPORT_PROFILE_V4 = 'neuvetra.scope3-report.v4' as const

/**
 * The facts a derived line's source record contributes, per source kind (BF-31 design 2(b)). An allow-list, so a field a
 * later change adds to a payload (certificates, BF-11's ledger) can never reach a v4 Scope 3 report. `null`: the source
 * is itself a Scope 3 record whose full line is in the same results (energy resold).
 */
export const SCOPE3_SOURCE_RECORD_FACT_KEYS = {
  electricity: ['meterOrAccountNumber', 'utilityName', 'utilityEiaId', 'zip', 'subregion', 'site'],
  natural_gas: ['heatContent'],
  distillate_no2: ['consumption', 'statedHhvMmbtuPerGallon'],
  vehicle: ['vehicleGroupId', 'fuel', 'vehicleType', 'modelYear', 'gallons', 'vehicleCount', 'miles', 'fuelEconomy'],
  energy_resold: null,
} as const satisfies Record<string, readonly string[] | null>
export type Scope3SourceRecordKind = keyof typeof SCOPE3_SOURCE_RECORD_FACT_KEYS
export const SCOPE3_SOURCE_RECORD_KINDS = Object.keys(SCOPE3_SOURCE_RECORD_FACT_KEYS) as Scope3SourceRecordKind[]
/** One source record version of a v4 results document (`results.sourceRecords`). */
export interface Scope3SourceRecordV4 {
  recordId: string; versionId: string; kind: Scope3SourceRecordKind
  /** 0027 `collection_activity_versions.payload_sha256` of this exact version (the record's `currentVersion.payloadSha256`). */
  activitySha256: string
  /** Exactly the kind's allow-list keys (values as saved; a missing key is null); null for an energy-resold source. */
  facts: Record<string, unknown> | null
}
export interface Scope3ReportResultsV4 extends Scope3ReportResultsV3 { sourceRecords: Scope3SourceRecordV4[] }
export interface Scope3ReportDocumentV4 extends Omit<Scope3ReportDocumentV3, 'profile' | 'results'> { profile: typeof SCOPE3_REPORT_PROFILE_V4; results: Scope3ReportResultsV4 }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA = /^[0-9a-f]{64}$/
const ENTRY_KEYS = 'activitySha256|facts|kind|recordId|versionId'
const obj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const isKind = (kind: unknown): kind is Scope3SourceRecordKind => typeof kind === 'string' && Object.prototype.hasOwnProperty.call(SCOPE3_SOURCE_RECORD_FACT_KEYS, kind)
type Line = { recordId: string; versionId: string; kind: string; derivedFrom: { recordId: string; kind: string } | null; payload: unknown }

/** The facts of one source record version: its kind's allow-list keys, values as saved, a missing key as null. */
export function scope3SourceRecordFacts(kind: string, payload: unknown): Record<string, unknown> | null {
  if (!isKind(kind)) throw new Error(`No Scope 3 source-record facts for ${kind}.`)
  const keys = SCOPE3_SOURCE_RECORD_FACT_KEYS[kind]
  if (keys === null) return null
  const saved = obj(payload) ? payload : {}
  return Object.fromEntries(keys.map(key => [key, saved[key] === undefined ? null : saved[key]]))
}

/**
 * The writer's packing rule (BF-31b): from results built as today (each derived line carrying its source payload), the
 * same results with every derived line's payload null and `sourceRecords` added (one entry per source version, sorted).
 * `activitySha256Of(versionId)` returns that version's stored `payload_sha256`. Nothing else in the results changes, so
 * every figure, the CSV and the change-log comparison stay as they were.
 */
export function scope3PackSourceRecords<T extends { records: readonly Line[] }>(results: T, activitySha256Of: (versionId: string) => string): T & { sourceRecords: Scope3SourceRecordV4[] } {
  const entries = new Map<string, Scope3SourceRecordV4>()
  for (const line of results.records) {
    if (line.derivedFrom === null || entries.has(line.versionId)) continue
    const kind = line.derivedFrom.kind
    if (!isKind(kind)) throw new Error(`No Scope 3 source-record facts for ${kind}.`)
    // Pack once, from the source payload: a derived line without one (already packed) would yield empty facts.
    if (!obj(line.payload)) throw new Error('A derived Scope 3 line has no source payload to pack.')
    entries.set(line.versionId, { recordId: line.derivedFrom.recordId, versionId: line.versionId, kind, activitySha256: activitySha256Of(line.versionId), facts: scope3SourceRecordFacts(kind, line.payload) })
  }
  const sourceRecords = [...entries.values()].sort((a, b) => a.versionId < b.versionId ? -1 : a.versionId > b.versionId ? 1 : 0)
  return { ...results, records: results.records.map(line => line.derivedFrom === null ? line : { ...line, payload: null }), sourceRecords }
}

const factsProblem = (kind: Scope3SourceRecordKind, facts: unknown): string | null => {
  const keys = SCOPE3_SOURCE_RECORD_FACT_KEYS[kind]
  if (keys === null) return facts === null ? null : `an energy-resold source has no facts`
  if (!obj(facts) || Object.keys(facts).sort().join('|') !== [...keys].sort().join('|')) return `facts must have exactly the ${kind} keys`
  const str = (v: unknown) => typeof v === 'string', strOrNull = (v: unknown) => v === null || typeof v === 'string'
  const shaped = (v: unknown, k: string) => obj(v) && Object.keys(v).sort().join('|') === k && Object.values(v).every(str)
  const f = facts as Record<string, unknown>
  const ok = kind === 'electricity' ? ['meterOrAccountNumber', 'utilityName', 'zip', 'subregion', 'site'].every(k => str(f[k])) && strOrNull(f.utilityEiaId)
    : kind === 'natural_gas' ? f.heatContent === null || shaped(f.heatContent, 'unit|value')
    : kind === 'distillate_no2' ? obj(f.consumption) && str(f.consumption.basis) && Object.values(f.consumption).every(str) && strOrNull(f.statedHhvMmbtuPerGallon)
    : ['vehicleGroupId', 'fuel', 'vehicleType', 'gallons'].every(k => str(f[k])) && Number.isSafeInteger(f.modelYear) && (f.vehicleCount === null || Number.isSafeInteger(f.vehicleCount))
      && (f.miles === null || shaped(f.miles, 'basis|value')) && (f.fuelEconomy === null || shaped(f.fuelEconomy, 'mpg|source'))
  return ok ? null : `facts of a ${kind} source are malformed`
}

/**
 * Why the source records of a v4 results document do not match its lines, or null when they do: every derived line has
 * `payload` null and exactly one entry for its version (same record, same source kind); entries are sorted by version, in
 * the exact entry shape, each referenced by a derived line (no orphan), with a 64-hex activity SHA-256 and exactly its
 * kind's facts; an energy-resold source has null facts and its own full line in the same results. Shared by the v4
 * validator and the web results decoder.
 */
export function scope3SourceRecordsProblem(records: readonly unknown[], sourceRecords: unknown): string | null {
  if (!Array.isArray(sourceRecords)) return 'sourceRecords must be a list'
  const byVersion = new Map<string, Scope3SourceRecordV4>()
  let previous = ''
  for (const entry of sourceRecords as unknown[]) {
    if (!obj(entry) || Object.keys(entry).sort().join('|') !== ENTRY_KEYS) return 'a source record entry has the wrong keys'
    const e = entry as unknown as Scope3SourceRecordV4
    if (typeof e.recordId !== 'string' || !UUID.test(e.recordId) || typeof e.versionId !== 'string' || !UUID.test(e.versionId)) return 'a source record entry has an invalid record or version ID'
    if (byVersion.has(e.versionId)) return `source record version ${e.versionId} is listed twice`
    if (e.versionId < previous) return 'source record entries are not sorted by version'
    previous = e.versionId
    if (!isKind(e.kind)) return `source record version ${e.versionId} has an unknown kind`
    if (typeof e.activitySha256 !== 'string' || !SHA.test(e.activitySha256)) return `source record version ${e.versionId} has an invalid activity SHA-256`
    const facts = factsProblem(e.kind, e.facts)
    if (facts) return `source record version ${e.versionId}: ${facts}`
    byVersion.set(e.versionId, e)
  }
  const used = new Set<string>()
  for (const row of records as Line[]) {
    if (!obj(row) || row.derivedFrom === null) continue
    if (!obj(row.derivedFrom) || row.derivedFrom.recordId !== row.recordId) return `derived line ${row.recordId} ${row.kind} names another record`
    if (row.payload !== null) return `derived line ${row.recordId} ${row.kind} carries a payload`
    const e = byVersion.get(row.versionId)
    if (!e) return `derived line ${row.recordId} ${row.kind} has no source record entry`
    if (e.recordId !== row.recordId) return `the source record entry of version ${row.versionId} names another record`
    if (e.kind !== row.derivedFrom.kind) return `the source record entry of version ${row.versionId} is of another kind`
    used.add(row.versionId)
  }
  for (const e of byVersion.values()) {
    if (!used.has(e.versionId)) return `source record version ${e.versionId} is not used by any derived line`
    if (SCOPE3_SOURCE_RECORD_FACT_KEYS[e.kind] === null && !(records as Line[]).some(row => obj(row) && row.derivedFrom === null && row.recordId === e.recordId && row.versionId === e.versionId && row.kind === e.kind))
      return `the ${e.kind} source record version ${e.versionId} has no full line of its own`
  }
  return null
}

function fail(what: string): never { throw new Error(`Invalid Scope 3 report ${what} (v4).`) }

/** A stored v4 document: v3's frozen rules, then the source records (every entry's version is one of the document's inputs). */
export function validateScope3ReportDocumentV4(value: unknown, companyId: string): Scope3ReportDocumentV4 {
  if (!obj(value) || value.profile !== SCOPE3_REPORT_PROFILE_V4) fail('document')
  validateScope3ReportDocumentV3({ ...(value as Record<string, unknown>), profile: SCOPE3_REPORT_PROFILE_V3 }, companyId)
  const d = value as unknown as Scope3ReportDocumentV4
  const problem = scope3SourceRecordsProblem(d.results.records, (d.results as unknown as Record<string, unknown>).sourceRecords)
  if (problem) fail(`source records: ${problem}`)
  const inputs = new Set(d.inputs.recordVersionIds)
  const outside = d.results.sourceRecords.find(entry => !inputs.has(entry.versionId))
  if (outside) fail(`source records: version ${outside.versionId} is not one of the document's inputs`)
  return d
}
