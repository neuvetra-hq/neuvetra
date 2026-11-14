/**
 * BF-32 (test support only; never imported by the server or the web): the probe behind `collection-text-rule.test.ts`.
 * It finds every free-text field of the collection contract by trying the contract itself (no hand-kept list), then saves
 * a table of awkward strings into each field through the API check and through the real SQL function, on whatever engine
 * the caller gives it (PGlite, or native PostgreSQL 16), and reports where the two layers disagree.
 */
import { validateCollectionActivity, validateCollectionSaveInput } from './collection-contract'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'
import type { WorkspaceSql } from './workspace'

type Json = Record<string, unknown>
export interface ProbeIds { company: string; setupVersion: string; locationId: string; owner: string }
/** The same string in every shape that tells UTF-16 code units, code points, NFC and bytes apart. */
export interface TextCase { id: string; build: (limit: number) => string }
const rep = (unit: string, n: number) => unit.repeat(Math.max(0, n))
export const TEXT_CASES: TextCase[] = [
  { id: 'ascii at limit', build: L => rep('a', L) },
  { id: 'ascii limit+1', build: L => rep('a', L + 1) },
  { id: 'CJK at limit', build: L => rep('漢', L) },
  { id: 'CJK limit+1', build: L => rep('漢', L + 1) },
  { id: 'emoji, L code units (L/2 emoji)', build: L => rep('😀', Math.floor(L / 2)) + (L % 2 ? 'a' : '') },
  { id: 'emoji, L code points (2L units)', build: L => rep('😀', L) },
  { id: 'emoji, L+1 code points', build: L => rep('😀', L + 1) },
  { id: 'combining e+U+0301, L units (NFC L/2)', build: L => rep('é', Math.floor(L / 2)) + (L % 2 ? 'a' : '') },
  { id: 'combining e+U+0301 x L (raw 2L, NFC L)', build: L => rep('é', L) },
  { id: 'combining e+U+0301 x (L+1) (NFC L+1)', build: L => rep('é', L + 1) },
  { id: 'Hangul jamo pair x L (raw 2L, NFC L)', build: L => rep('가', L) },
  { id: 'U+0958 x L (NFC 2L)', build: L => rep('क़', L) },
  { id: 'U+0958 x L/2 (NFC L)', build: L => rep('क़', Math.floor(L / 2)) },
  { id: 'U+0958 x (L/2+1) (NFC L+2)', build: L => rep('क़', Math.floor(L / 2) + 1) },
  { id: 'U+0344 x L (NFC 2L)', build: L => rep('̈́', L) },
  { id: 'U+1D15E x L/2 (raw L units, NFC 2L units)', build: L => rep('\u{1D15E}', Math.floor(L / 2)) },
  { id: 'quote and backslash heavy, L', build: L => rep('"\\', Math.floor(L / 2)) + (L % 2 ? 'a' : '') },
  { id: 'quote and backslash heavy, L+1', build: L => rep('"\\', Math.floor(L / 2) + 1) },
  { id: 'leading =, L', build: L => '=' + rep('a', L - 1) },
  { id: 'leading +, L', build: L => '+' + rep('a', L - 1) },
  { id: 'leading -, L', build: L => '-' + rep('a', L - 1) },
  { id: 'leading @, L', build: L => '@' + rep('a', L - 1) },
]

const SPECIAL = { quality: 'actual' } as const
const evidenceFree = { period: { start: '2025-01-01', endExclusive: '2026-01-01' }, reference: 'r', notes: '', evidenceIds: [] as string[], estimateBasis: null, state: 'active', withdrawalReason: null, ...SPECIAL }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
const SCOPE12_BASES: Array<{ label: string; kind: string; sourceId: string; quantity: Json; payload: Json }> = [
  { label: 'natural_gas', kind: 'natural_gas', sourceId: 'GAS-1', quantity: q('12', 'therm'), payload: { heatContent: { value: '1.037', unit: 'MMBtu per scf' } } },
  { label: 'distillate_no2', kind: 'distillate_no2', sourceId: 'GEN-1', quantity: q('12', 'US_gallon'), payload: { consumption: { basis: 'purchases_with_tank_levels', purchasedGallons: '10', openingGallons: '1', closingGallons: '1' }, statedHhvMmbtuPerGallon: null } },
  { label: 'vehicle', kind: 'vehicle', sourceId: 'VG-1', quantity: q('12', 'US_gallon'), payload: { vehicleGroupId: 'VG-1', fuel: 'diesel', vehicleType: 'van', modelYear: 2020, gallons: '12', vehicleCount: 2, miles: { value: '100', basis: 'odometer' }, fuelEconomy: { mpg: '20', source: 'spec' } } },
  { label: 'fugitive', kind: 'fugitive', sourceId: 'CH-1', quantity: q('1', 'kg'), payload: { gas: 'R-410A', unit: 'kg', terms: { PN: '1', CN: '1', PS: '1', CD: '1', RD: '1' }, insideBoundary: true, maintainsRefrigerantStock: true, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true } },
  { label: 'electricity', kind: 'electricity', sourceId: 'MTR-1', quantity: q('1200.125', 'kWh'), payload: { meterOrAccountNumber: 'MTR-1', utilityName: 'City & County of San Francisco', site: 'Office', zip: '94105', subregion: 'CAMX', utilityEiaId: '16612', instruments: [{ type: 'energy_attribute_certificate', mwh: '1.000', qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: null, generationTechnology: 'wind', rateLbPerMwh: { co2: '0', ch4: null, n2o: null }, instrumentId: 'REC-1', registry: 'WREGIS', faceMwh: '1.000' }] } },
]
/** Every base the probe starts from: five Scope 1 and 2 kinds, and every valid Scope 3 fixture (one per distinct payload shape). */
export function probeBases(ids: ProbeIds) {
  const bases = [...SCOPE12_BASES.map(b => ({ ...b, key: b.label }))]
  const seen = new Set<string>()
  for (const f of SCOPE3_PAYLOAD_FIXTURES) {
    if (!f.valid) continue
    const shape = f.kind + ':' + JSON.stringify(shapeOf(f.payload))
    if (seen.has(shape)) continue
    seen.add(shape)
    bases.push({ label: f.label, kind: f.kind, sourceId: `S3-${bases.length}`, quantity: f.quantity as unknown as Json, payload: f.payload as Json, key: f.label })
  }
  return bases.map(b => ({ ...b, activity: { locationId: ids.locationId, setupVersionId: ids.setupVersion, ...evidenceFree, kind: b.kind, sourceId: b.sourceId, quantity: b.quantity, payload: b.payload } as Json, key: b.key }))
}
const shapeOf = (v: unknown): unknown => Array.isArray(v) ? v.map(shapeOf) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort().map(([k, x]) => [k, shapeOf(x)])) : typeof v === 'string' ? 's' : v === null ? 'null' : typeof v
export type Base = ReturnType<typeof probeBases>[number]

/** Paths of every string leaf, e.g. `payload.instruments[0].registry`. */
export function stringLeaves(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return [path]
  if (Array.isArray(value)) return value.flatMap((v, i) => stringLeaves(v, `${path}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => stringLeaves(v, path ? `${path}.${k}` : k))
  return []
}
const parsePath = (path: string) => path.split(/\.|(?=\[)/).filter(Boolean).map(p => p.startsWith('[') ? Number(p.slice(1, -1)) : p)
export function withValue(root: Json, path: string, value: unknown): Json {
  const copy = structuredClone(root) as Json
  let cursor: any = copy
  const keys = parsePath(path)
  for (const key of keys.slice(0, -1)) cursor = cursor[key]
  cursor[keys[keys.length - 1]!] = value
  return copy
}
/** The pattern of a leaf path with array indexes dropped, e.g. `payload.instruments[].registry`. */
export const patternOf = (path: string) => path.replace(/\[\d+\]/g, '[]')

/** Which other paths must carry the same value for the record to be consistent (source identifier equals meter or vehicle group). */
const coupled = (base: Base, path: string): string[] => path === 'sourceId' || path === 'payload.meterOrAccountNumber' && base.kind === 'electricity' || path === 'payload.vehicleGroupId' && base.kind === 'vehicle'
  ? ['sourceId', ...(base.kind === 'electricity' ? ['payload.meterOrAccountNumber'] : base.kind === 'vehicle' ? ['payload.vehicleGroupId'] : [])] : [path]

export type Mode = 'first' | 'correction'
/** The activity with `value` in the field `path` (and whatever else the field needs to be legal at all). */
export function activityWith(base: Base, path: string, value: string): Json {
  let activity = base.activity
  for (const target of coupled(base, path)) activity = withValue(activity, target, value)
  if (path === 'estimateBasis') activity = { ...activity, quality: 'estimated' }
  if (path === 'withdrawalReason') activity = { ...activity, state: 'withdrawn' }
  return activity
}
export const modeOf = (path: string): Mode => path === 'withdrawalReason' || path === 'correctionReason' ? 'correction' : 'first'
export function requestFor(activity: Json, mode: Mode, previous: { id: string } | null, correctionReason = 'Corrected synthetic value.'): Json {
  return { idempotencyKey: crypto.randomUUID(), expectedRevision: mode === 'first' ? 0 : 1, expectedVersionId: mode === 'first' ? null : previous!.id, correctionReason: mode === 'first' ? null : correctionReason, activity }
}

export interface Verdict { ok: boolean; message?: string }
export const apiVerdict = (request: unknown): Verdict & { value?: Json } => { try { return { ok: true, value: validateCollectionSaveInput(request) as unknown as Json } } catch (error) { return { ok: false, message: String((error as Error).message) } } }
export const readVerdict = (activity: unknown): Verdict => { try { validateCollectionActivity(activity); return { ok: true } } catch (error) { return { ok: false, message: String((error as Error).message) } } }

class Rollback extends Error {}
export interface Engine { name: string; transaction<T>(operation: (tx: WorkspaceSql) => Promise<T>): Promise<T> }
export interface SqlResult { ok: boolean; code?: string; message?: string }
/** Runs `operation` as the owner under the runtime role and always rolls back. */
export async function inRolledBackTransaction<T>(engine: Engine, owner: string, operation: (tx: WorkspaceSql) => Promise<T>): Promise<T> {
  let result!: T
  try {
    await engine.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); await tx.exec('set local role neuvetra_runtime')
      result = await operation(tx)
      throw new Rollback()
    })
  } catch (error) { if (!(error instanceof Rollback)) throw error }
  return result
}
const sqlError = (error: unknown): SqlResult => ({ ok: false, code: (error as { code?: string }).code, message: String((error as Error).message).slice(0, 160) })
const save = async (tx: WorkspaceSql, ids: ProbeIds, recordId: string, request: unknown) => (await tx.query<{ version_id: string }>('select * from neuvetra.save_collection_activity($1,$2,$3::text::jsonb)', [ids.company, recordId, JSON.stringify(request)])).rows[0]!
/** What the database says to this request as written (no API check first), after the base record when the mode is a correction. */
export async function sqlVerdict(engine: Engine, ids: ProbeIds, base: Base, mode: Mode, request: Json): Promise<SqlResult> {
  return inRolledBackTransaction(engine, ids.owner, async tx => {
    const record = crypto.randomUUID()
    let previous: { id: string } | null = null
    try {
      if (mode === 'correction') previous = { id: (await save(tx, ids, record, requestFor(base.activity, 'first', null))).version_id }
      await tx.exec('savepoint probe')
      const body = mode === 'correction' ? { ...request, expectedVersionId: previous!.id } : request
      await save(tx, ids, record, body)
      return { ok: true }
    } catch (error) { return sqlError(error) }
  })
}
/** The API's own output saved, then read back through the contract's read path (as the product does after every save). */
export async function endToEnd(engine: Engine, ids: ProbeIds, base: Base, mode: Mode, request: Json, activity: unknown): Promise<SqlResult & { readable?: boolean; readMessage?: string }> {
  return inRolledBackTransaction(engine, ids.owner, async tx => {
    const record = crypto.randomUUID()
    try {
      let previous: { id: string } | null = null
      if (mode === 'correction') previous = { id: (await save(tx, ids, record, requestFor(base.activity, 'first', null))).version_id }
      const body = { ...request, expectedVersionId: mode === 'correction' ? previous!.id : null }
      const receipt = await save(tx, ids, record, body)
      const stored = (await tx.query<{ payload: unknown }>('select payload from neuvetra.collection_activity_versions where id=$1', [receipt.version_id])).rows[0]!.payload
      const read = readVerdict(stored)
      return { ok: true, readable: read.ok, readMessage: read.message }
    } catch (error) { return sqlError(error) }
  })
}
