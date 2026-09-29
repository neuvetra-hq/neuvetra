import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { WorkspaceSql } from './workspace'

/** Exact bytes approved by migration 0024 (board decision 2026-09-26). */
export const METHOD_REGISTER_2025_SHA256 = 'f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02'
export const METHOD_REGISTER_2025_URL = new URL('./method-reference/verified-factor-register-2025.json', import.meta.url)
/** eGRID2023 rev2 subregion rates with AR5 GWPs (Scope 2), approved for loading by migration 0024. */
export const ELECTRICITY_REGISTER_EGRID2023_SHA256 = '0626e6d3ba44f2e1f4ad53173fafebbb073c72c6d5a2a98021e0810039f9a13b'
export const ELECTRICITY_REGISTER_EGRID2023_URL = new URL('./method-reference/verified-electricity-register-egrid2023.json', import.meta.url)
/** eGRID2023 rev2 plus the Green-e 2025 residual mix (Scope 2 v2, market-based), approved for loading by migration 0026. */
export const ELECTRICITY_REGISTER_GREENE2025_SHA256 = '4873b8c08dbab395336a2273501724118661cf505ad19fa48a6f625661e3a14d'
export const ELECTRICITY_REGISTER_GREENE2025_URL = new URL('./method-reference/verified-electricity-register-egrid2023-greene2025.json', import.meta.url)
/** EPA Hub 2025 Tables 8-11 plus eGRID2023 rev2 rates and grid gross loss (Scope 3), approved for loading by migration 0024. */
export const SCOPE3_REGISTER_2025_SHA256 = '5a534d33e70f7eb83bd8b0870da4cd8530e1d3429b3cb7e610b7941abce354f2'
export const SCOPE3_REGISTER_2025_URL = new URL('./method-reference/verified-scope3-register-2025.json', import.meta.url)
export const METHOD_REFERENCE_MIGRATION = '0024_method_reference.sql'
/** Scope 3 extension; merge only after the board approves notes/decisions/2026-09-28-scope3-beta-methods.md. */
export const SCOPE3_METHOD_MIGRATION = '0025_scope3_method_reference.sql'
/** Scope 2 market-based residual mix (decision notes/decisions/2026-09-28-scope2-residual-mix.md). */
export const RESIDUAL_MIX_METHOD_MIGRATION = '0026_scope2_residual_mix.sql'
export const BETA_OUTPUT_LABEL = 'Draft — prepared with Neuvetra beta methods; not externally assured'

export interface VerifiedRegister { text: string; sha256: string }

const sha256 = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

/** Reads the register and refuses unless its exact bytes match the approved digest. */
export async function readVerifiedRegister(url: URL = METHOD_REGISTER_2025_URL, expectedSha256 = METHOD_REGISTER_2025_SHA256): Promise<VerifiedRegister> {
  const bytes = await Bun.file(url).bytes()
  const digest = sha256(bytes)
  if (digest !== expectedSha256) throw new Error('Method register bytes do not match the approved digest.')
  return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), sha256: digest }
}

/** SHA-256 of every original the register cites: its source workbook and any per-entry or per-constant source. */
export function citedSourceSha256s(registerText: string): string[] {
  const reg = JSON.parse(registerText) as { source: { sha256: string }; entries: Array<{ sourceSha256?: string }>; constants: Array<{ sourceSha256?: string }> }
  return [...new Set([reg.source.sha256, ...reg.entries.map(e => e.sourceSha256), ...reg.constants.map(c => c.sourceSha256)].filter((x): x is string => typeof x === 'string'))].sort()
}

/**
 * Operator side of QA F03: reads the verified originals from private folders (e.g. the board's research-sources
 * copies or a private-bucket download) and returns exactly the requested files, matched by SHA-256. Several
 * folders may be given, separated by the platform path delimiter (";" on Windows, ":" elsewhere).
 */
export async function readSourceOriginals(folders: string, sha256s: string[]): Promise<Uint8Array[]> {
  const found = new Map<string, Uint8Array>()
  const names: string[] = []
  for (const folder of folders.split(path.delimiter).filter(Boolean)) for (const name of (await readdir(folder)).sort()) names.push(path.join(folder, name))
  for (const full of names) {
    // Only document formats a source may have; nothing else in the folder is opened.
    if (found.size === sha256s.length || !/\.(pdf|xlsx|csv|html)$/i.test(full) || !(await stat(full)).isFile()) continue
    const bytes = await Bun.file(full).bytes()
    const digest = sha256(bytes)
    if (sha256s.includes(digest) && !found.has(digest)) found.set(digest, bytes)
  }
  const missing = sha256s.filter(s => !found.has(s))
  if (missing.length) throw new Error(`Method source original not found: ${missing.join(', ')}`)
  return sha256s.map(s => found.get(s)!)
}

/**
 * Operator transaction only (table owner or BYPASSRLS role; never the runtime role).
 * The database hashes the same text again and loads it only if migration-approved, and only when every
 * original the register cites is supplied with its registered SHA-256 and size (QA F03).
 */
export async function loadMethodRegister(tx: WorkspaceSql, register: VerifiedRegister, originals: Uint8Array[]): Promise<string> {
  if (sha256(new TextEncoder().encode(register.text)) !== register.sha256) throw new Error('Method register text does not match its digest.')
  const supplied = new Set(originals.map(sha256))
  const missing = citedSourceSha256s(register.text).filter(s => !supplied.has(s))
  if (missing.length) throw new Error(`Method source original missing: ${missing.join(', ')}`)
  const params = originals.map((_, i) => `$${i + 2}::bytea`).join(',')
  const result = await tx.query<{ id: string }>(`select neuvetra.load_method_register($1, array[${params}]::bytea[]) id`, [register.text, ...originals.map(o => Buffer.from(o))])
  const id = result.rows[0]?.id
  if (!id) throw new Error('Method register load returned no factor set.')
  return id
}

export interface ReleasedFactor { key: string; value: string; unit: string; cell: string; label: string; table: string }
export interface ReleasedMethod {
  releaseId: string
  profileId: string
  methodVersionId: string
  scope: 1 | 2 | 3
  family: string
  engineSha256: string
  registerSha256: string
  gwpSetId: string
  outputLabel: string
  factors: ReleasedFactor[]
  gwp: Array<{ gas: string; value: string; cell: string }>
  constants: Array<{ id: string; value: string; unit: string }>
}

/** Runtime read of every current release with exactly the reference rows each release exposes. */
export async function readCurrentReleasedMethods(tx: WorkspaceSql): Promise<ReleasedMethod[]> {
  const releases = await tx.query<{ id: string; profile_id: string; method_version_id: string; scope: number; family: string; engine_sha256: string; register_sha256: string; gwp_set_id: string; factor_set_id: string; output_label: string }>(
    `select r.id,r.profile_id,r.method_version_id,v.scope,v.family,r.engine_sha256,r.register_sha256,v.gwp_set_id,v.factor_set_id,r.output_label
       from neuvetra.method_current_releases r join neuvetra.method_versions v on v.id=r.method_version_id order by r.profile_id`)
  const out: ReleasedMethod[] = []
  for (const r of releases.rows) {
    const factors = await tx.query<{ factor_key: string; value_text: string; unit: string; value_cell: string; label: string; table_label: string }>(
      `select f.factor_key,f.value_text,f.unit,f.value_cell,f.label,f.table_label from neuvetra.method_version_factors l
         join neuvetra.method_factor_values f on f.factor_set_id=l.factor_set_id and f.factor_key=l.factor_key
        where l.method_version_id=$1 order by f.factor_key collate "C"`, [r.method_version_id])
    // Only the GWPs this release links, not every GWP another release of the same register exposes.
    const gwp = await tx.query<{ gas: string; value_text: string; value_cell: string }>(
      `select g.gas,g.value_text,f.value_cell from neuvetra.method_gwp_values g
         join neuvetra.method_version_factors l on l.factor_set_id=g.factor_set_id and l.factor_key=g.factor_key and l.method_version_id=$3
         join neuvetra.method_factor_values f on f.factor_set_id=g.factor_set_id and f.factor_key=g.factor_key
        where g.gwp_set_id=$1 and g.factor_set_id=$2 order by g.gas collate "C"`, [r.gwp_set_id, r.factor_set_id, r.method_version_id])
    const constants = await tx.query<{ id: string; value_text: string; unit: string }>(
      `select c.id,c.value_text,c.unit from neuvetra.method_version_constants l join neuvetra.method_constants c on c.register_sha256=l.register_sha256 and c.id=l.constant_id
        where l.method_version_id=$1 order by c.id collate "C"`, [r.method_version_id])
    if (r.scope !== 1 && r.scope !== 2 && r.scope !== 3) throw new Error('Unexpected method scope.')
    out.push({
      releaseId: r.id, profileId: r.profile_id, methodVersionId: r.method_version_id, scope: r.scope, family: r.family,
      engineSha256: r.engine_sha256, registerSha256: r.register_sha256, gwpSetId: r.gwp_set_id, outputLabel: r.output_label,
      factors: factors.rows.map(f => ({ key: f.factor_key, value: f.value_text, unit: f.unit, cell: f.value_cell, label: f.label, table: f.table_label })),
      gwp: gwp.rows.map(g => ({ gas: g.gas, value: g.value_text, cell: g.value_cell })),
      constants: constants.rows.map(c => ({ id: c.id, value: c.value_text, unit: c.unit })),
    })
  }
  return out
}

/** Decimal strings compared exactly after removing insignificant trailing zeros ("1.0" equals "1"). */
export function sameDecimal(a: string, b: string): boolean {
  const norm = (v: string) => { if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(v)) throw new Error('Not a plain decimal.'); return v.includes('.') ? v.replace(/0+$/, '').replace(/\.$/, '') : v }
  return norm(a) === norm(b)
}

/**
 * Refuses unless the engine reports the same engine hash, exactly the factor values and exactly the
 * conversion constants (id, value and unit; QA F04) the release exposes. Pass the engine's describe()
 * factorValues and constantValues. The API must call this before using an engine result for a released
 * method (not wired yet: Codex step 4).
 */
export function assertEngineMatchesRelease(release: ReleasedMethod, engine: { engineSha256: string; registerSha256: string; factors: Record<string, string>; constants: Record<string, { value: string; unit: string }> }): void {
  if (engine.engineSha256 !== release.engineSha256 || engine.registerSha256 !== release.registerSha256) throw new Error('Engine does not match the released method.')
  const sameKeys = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((k, i) => k === [...b].sort()[i])
  if (!sameKeys(Object.keys(engine.factors), release.factors.map(f => f.key))) throw new Error('Engine factor set does not match the released method.')
  for (const f of release.factors) if (!sameDecimal(engine.factors[f.key]!, f.value)) throw new Error('Engine factor value does not match the released method.')
  if (!sameKeys(Object.keys(engine.constants ?? {}), release.constants.map(c => c.id))) throw new Error('Engine constant set does not match the released method.')
  for (const c of release.constants) {
    const e = engine.constants[c.id]!
    if (!sameDecimal(e.value, c.value) || e.unit !== c.unit) throw new Error('Engine constant does not match the released method.')
  }
}
