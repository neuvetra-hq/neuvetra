/**
 * The one trusted boundary for Scope 3 engine output (S3A-02, S3A-03; Claude, 25 October 2026). Server-only.
 *
 * Revision 4 (S3A-03-R3): the boundary no longer accepts an aggregate from its caller. `scope3Coverage` sends the
 * results to the actual Scope 3 engine's `aggregate` action itself, and only an aggregate the engine returned counts.
 * The engine's aggregate recomputes every result from its own echoed input and refuses (`result_integrity`) unless the
 * recomputed result is byte-identical, so every nested field (input hash, profile, units, GWP set, factor and
 * constant lineage, conversions, totals) is the engine's own. A result the engine would not reproduce is refused.
 *
 * Around that verification it also checks, against the pinned engine and register (defence in depth, with precise
 * reasons; none of these replaces the engine's recomputation):
 * - every engine result: its own hash, engine, register, profile and method profile, method, GWP set (also on a
 *   CO2e-only component) and category; that its input hash is the hash of its input; its gas and CO2e units; that no
 *   gas or CO2e amount is negative; and that its total is the sum of its parts and its display is that sum rounded
 *   once, half-even;
 * - the aggregate: its own hash, engine, register and profile; that it covers exactly these results, calculated or
 *   not, as a multiset (two records may legitimately produce byte-identical results); its partial-boundary list, GWP
 *   sets and flags; and that every subtotal is the exact sum of its results' totals and rounded once;
 * - the saved records: each saved record ID a canonical lowercase UUID and present at most once, and every calculated
 *   record's result present in the verified output exactly as often as it occurs.
 * Nothing here recalculates emissions: the factors, conversions and gas arithmetic stay in the engine. The checks add up
 * the engine's own totals and compare hashes, so a result, subtotal or flag that differs from what the engine produced
 * is refused, never displayed.
 *
 * Scope 3 completion I-01 (aggregate v2, DESIGN 4.6): the boundary sends one annotation per result (each record's
 * data-quality overrides and activity-data origin; all null when none are given) with the results, and checks what the
 * engine adds: the pinned additional registers, a result's optional keys only where its method declares them, and each
 * category profile's exact sums (method types, value-chain numerator and denominator, kg per data-quality rating,
 * biogenic CO2 and memo items), the tonnes display, the dominant method type and the override count. Ratios (percent
 * and scores) are the engine's own; the boundary checks only their form. Coverage output is unchanged in I-01.
 */
import { createHash } from 'node:crypto'
import type { CollectionQuality } from './collection-contract'
import { M71_CATEGORIES } from './m71-contract'
import {
  CARB_PROPOSED_MANDATORY_CATEGORIES, SCOPE3_CATEGORIES, SCOPE3_COVERAGE_PROFILE, SCOPE3_ENGINE_PROFILE, SCOPE3_NULL_ANNOTATION,
  validateScope3Screening, type Scope3Annotation, type Scope3CategoryProfile, type Scope3CategoryRow, type Scope3CategoryStatus, type Scope3Coverage, type Scope3CoverageRecord, type Scope3EngineAggregate,
  type Scope3EngineResult, type Scope3Screening, type Scope3Total,
  scope3AssessmentDisclosures, scope3CappedDataQualityLabel, scope3CategorySupport, scope3PartialResultDocumented, scope3SelectiveDownstreamExclusion, SCOPE3_DOWNSTREAM_JOINT_CATEGORIES, SCOPE3_PLAN_NOTE_DISCLOSURES,
} from './scope3-coverage'
import { validateScope3AssessmentRecord, type Scope3AssessmentRecord } from './scope3-assessment-contract'
import { SCOPE3_DERIVED_KINDS } from './scope3-collection-contract'
import {
  SCOPE3_ACTIVITY_DATA_ORIGINS, SCOPE3_DQ_INDICATORS, SCOPE3_DQ_RATINGS, SCOPE3_FIXED_ORIGINS, SCOPE3_METHOD_TYPES, SCOPE3_METHODS, SCOPE3_RESULT_EXTRAS,
  scope3BoundaryClosures, scope3DefaultDataQualityOf, SCOPE3_BOUNDARY_CLOSURE_PAIRS, type Scope3MethodType,
} from './scope3-method-catalog'
import { CARB_PROPOSAL_TEXT, SCOPE3_DISCLOSURE_TEXT, SCOPE3_IPCC_GWP_SETS, SCOPE3_STATUS_PHRASE, SCOPE3_STATUS_PHRASE_R2B } from './scope3-text'
import { scope3ProfileExtrasProblem, scope3ReviewFlags, SCOPE3_PROFILE_I05_KEYS } from './scope3-trace'
import { SCOPE3_FACTOR_SOURCES } from './scope3-method-catalog'
/** The sources the shipped `factor_data_years` disclosure names (I-06). */
const SHIPPED_FACTOR_SOURCE_IDS: readonly string[] = SCOPE3_FACTOR_SOURCES.map(source => source.id)

/**
 * The engine and register the output must come from. The register is pinned by 0025; the engine by its review (AG2).
 * `additionalRegisterSha256s`: the engine's other pinned registers by name (none before I-03; default empty).
 */
export interface Scope3Pins { engineSha256: string; registerSha256: string; additionalRegisterSha256s?: Record<string, string> }
/**
 * The actual Scope 3 engine's `aggregate` action. It must throw when the engine refuses. In site-api this is
 * `createScope3Engine(...).aggregate`, whose runner also checks the engine and data hashes before every call; its
 * `Scope3Aggregate` type omits `profile`, `engineSha256` and `registerSha256`, which the engine does return and this
 * boundary checks, so wiring it here means widening that type (no site-api file changes in this package).
 */
export interface Scope3AggregateEngine { aggregate(results: Scope3EngineResult[], annotations?: Scope3Annotation[]): Promise<Scope3EngineAggregate> }

/** The engine's `canonical`: JSON with keys sorted and no spaces, non-ASCII kept (Python `json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False)`). */
export function scope3Canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Scope 3 engine output holds a non-integer number.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(scope3Canonical).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${scope3Canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
}
export const scope3Digest = (value: unknown) => createHash('sha256').update(scope3Canonical(value), 'utf8').digest('hex')

// Exact decimal strings as the engine writes them (`exact`): an optional minus, digits, an optional fraction.
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/
type Scaled = { units: bigint; scale: number }
function parse(text: string): Scaled {
  if (!DECIMAL.test(text)) throw new Error('Scope 3 engine output holds an invalid decimal.')
  const negative = text.startsWith('-'), [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.')
  const units = BigInt(whole! + fraction)
  return { units: negative ? -units : units, scale: fraction.length }
}
const align = (a: Scaled, scale: number) => a.units * 10n ** BigInt(scale - a.scale)
function sum(values: string[]): Scaled {
  const parsed = values.map(parse), scale = Math.max(0, ...parsed.map(p => p.scale))
  return { units: parsed.reduce((total, p) => total + align(p, scale), 0n), scale }
}
const same = (a: Scaled, b: Scaled) => { const scale = Math.max(a.scale, b.scale); return align(a, scale) === align(b, scale) }
/** The engine's `display`: rounded once to 4 decimals, half-even. */
function display(text: string): string {
  const p = parse(text)
  let units = p.scale <= 4 ? p.units * 10n ** BigInt(4 - p.scale) : p.units / 10n ** BigInt(p.scale - 4)
  if (p.scale > 4) {
    const divisor = 10n ** BigInt(p.scale - 4), rest = (p.units < 0n ? -p.units : p.units) % divisor, twice = rest * 2n
    if (twice > divisor || (twice === divisor && (units < 0n ? -units : units) % 2n === 1n)) units += p.units < 0n ? -1n : 1n
  }
  const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(5, '0')
  return `${negative ? '-' : ''}${digits.slice(0, -4)}.${digits.slice(-4)}`
}

/** The engine's tonnes display: the kg value shifted three places and rounded once to 3 decimals, half-even. */
function tonnes(kgText: string): string {
  const p = parse(kgText), scale = p.scale + 3, keep = 3
  let units = scale <= keep ? p.units * 10n ** BigInt(keep - scale) : p.units / 10n ** BigInt(scale - keep)
  if (scale > keep) {
    const divisor = 10n ** BigInt(scale - keep), rest = (p.units < 0n ? -p.units : p.units) % divisor, twice = rest * 2n
    if (twice > divisor || (twice === divisor && (units < 0n ? -units : units) % 2n === 1n)) units += p.units < 0n ? -1n : 1n
  }
  const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(4, '0')
  return `${negative ? '-' : ''}${digits.slice(0, -3)}.${digits.slice(-3)}`
}

function fail(reason: string): never { throw new Error(`Scope 3 engine output refused: ${reason}.`) }
const multiset = (items: string[]) => [...items].sort().join('\n')

const GAS_NAMES: Record<string, string> = { co2: 'CO2', ch4: 'CH4', n2o: 'N2O' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Structural checks on one result, before the engine verifies it. They give a precise reason for the commonest
 * inconsistencies; the engine's recomputation is what makes every field authoritative.
 */
function verifyResult(r: Scope3EngineResult, pins: Scope3Pins): Scope3EngineResult {
  if (!r || typeof r !== 'object') fail('result is not an object')
  const { resultSha256, ...body } = r
  if (typeof resultSha256 !== 'string' || scope3Digest(body) !== resultSha256) fail('result hash')
  if (r.engineSha256 !== pins.engineSha256) fail('result engine is not the pinned engine')
  if (r.registerSha256 !== pins.registerSha256) fail('result register is not the pinned register')
  if (r.profile !== SCOPE3_ENGINE_PROFILE) fail('result profile')
  const method = SCOPE3_METHODS[r.methodVersionId]
  if (!method) fail('unknown method version')
  if (r.profileId !== method.profileId) fail('result profile differs from the method')
  if (r.gwpSetId !== method.gwpSetId) fail('GWP set differs from the method')
  if (!method.categories.includes(r.category)) fail('category differs from the method')
  if (r.inputSha256 !== scope3Digest(r.input)) fail('input hash differs from the input')
  // Optional keys (I-01, DESIGN 4.1) only where the method declares them; the engine's recomputation checks their content.
  for (const extra of SCOPE3_RESULT_EXTRAS) if (extra in r && !method.resultExtras.includes(extra)) fail('result has a key its method does not declare')
  // I-07 (lane A, named lines): biogenic CO2 and memo items have exactly their shapes, and a result never carries biogenic CO2 as
  // a gas (the gases and the CO2e-only component are the total; biogenic CO2 stays outside it).
  if (r.biogenicCo2 !== undefined && (!sameKeys(r.biogenicCo2, ['mass', 'massUnit', 'basis']) || r.biogenicCo2.massUnit !== 'kg CO2' || typeof r.biogenicCo2.basis !== 'string' || parse(r.biogenicCo2.mass).units < 0n || 'co2' in (r.gases ?? {}))) fail('biogenic CO2')
  if (r.memoItems !== undefined && (!Array.isArray(r.memoItems) || r.memoItems.some(m => !sameKeys(m, ['code', 'kg', 'unit', 'reportedSeparately']) || typeof m.code !== 'string' || m.unit !== 'kg CO2e' || m.reportedSeparately !== true || parse(m.kg).units < 0n)
    || new Set(r.memoItems.map(m => m.code)).size !== r.memoItems.length)) fail('memo items')
  for (const [gas, g] of Object.entries(r.gases ?? {})) {
    if (!GAS_NAMES[gas] || g.massUnit !== `kg ${GAS_NAMES[gas]}` || g.co2eUnit !== 'kg CO2e') fail('gas units')
    if (parse(g.co2e).units < 0n || parse(g.mass).units < 0n) fail('a negative gas amount')
  }
  if (r.co2eWithoutGasSplit !== null) {
    const c = r.co2eWithoutGasSplit
    if (!c || c.gwpSetId !== method.gwpSetId || c.co2eUnit !== 'kg CO2e' || parse(c.co2e).units < 0n) fail('CO2e-only component differs from the method')
  }
  if (r.status === 'complete') {
    if (!r.total || r.total.unit !== 'kg CO2e' || r.total.rounding !== 'half_even_4dp') fail('complete result without a total')
    const parts = Object.values(r.gases ?? {}).map(g => g.co2e).concat(r.co2eWithoutGasSplit ? [r.co2eWithoutGasSplit.co2e] : [])
    if (!parts.length || !same(sum(parts), parse(r.total.unrounded)) || display(r.total.unrounded) !== r.total.display) fail('result total')
  } else if (r.status === 'input_needed' || r.status === 'review_required') {
    if (r.total !== null) fail('a result that is not complete has a total')
  } else fail('result status')
  return r
}

function verifySubtotal(t: Scope3Total | undefined, totals: string[], unit = 'kg CO2e', what = 'subtotal') {
  if (!t || typeof t !== 'object' || t.unit !== unit || t.rounding !== 'half_even_4dp_once' || typeof t.unrounded !== 'string' || typeof t.display !== 'string') fail(`${what} shape`)
  if (!same(parse(t.unrounded), sum(totals)) || display(t.unrounded) !== t.display) fail(`${what} is not the sum of its results`)
}

const sameKeys = (value: unknown, keys: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
const RATIO = /^(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/
function verifyRatio(r: unknown, places: number, max: number, what: string) {
  const ratio = r as { value?: unknown; display?: unknown }
  if (!sameKeys(r, ['value', 'display']) || typeof ratio.value !== 'string' || !RATIO.test(ratio.value) || (ratio.value.split('.')[1]?.length ?? 0) > 12 || typeof ratio.display !== 'string'
    || !new RegExp(`^(?:0|[1-9][0-9]*)\\.[0-9]{${places}}$`).test(ratio.display) || Number(ratio.value) > max) fail(what)
}

/**
 * A result's effective activity-data origin, exactly as the engine's `effective_origin` (I-03, DESIGN A19): fixed by the
 * method type for supplier and partner figures (value-chain partner), spend lines (company records) and proxies
 * (estimate), whatever the annotation says; activity/average-data results take the annotation's origin, else the
 * method default. An override on a fixed type is ignored, never refused.
 */
function originOf(r: Scope3EngineResult, note: Scope3Annotation): string {
  const method = SCOPE3_METHODS[r.methodVersionId]!
  return SCOPE3_FIXED_ORIGINS[method.methodType] ?? note.activityDataOrigin ?? method.activityDataOrigin
}

/**
 * A result's default rating for one data-quality indicator, exactly as the engine's `default_data_quality` (I-03, DESIGN
 * A20): the method's unverified default when it has one and the result carries `supplier_data_unverified` or
 * `partner_data_unverified`, else its default. A user's rating in the annotation still wins (see `verifyProfile`).
 */
function defaultRatingOf(r: Scope3EngineResult, indicator: (typeof SCOPE3_DQ_INDICATORS)[number]): (typeof SCOPE3_DQ_RATINGS)[number] {
  // I-12u: the shared rule (A20, then a default by note, e.g. 3A liquid fuels), as the engine's `default_data_quality`.
  return scope3DefaultDataQualityOf(SCOPE3_METHODS[r.methodVersionId]!, r.boundary.notes)[indicator]
}

/**
 * One category profile (aggregate v2): every kg figure is the exact sum of the right results' totals, looked up through
 * the method catalog and the annotations the boundary itself sent; only the ratios are taken from the engine.
 */
function verifyProfile(p: Scope3CategoryProfile, pairs: Array<{ r: Scope3EngineResult; note: Scope3Annotation }>, subtotal: Scope3Total, knownSourceSubtotal: Scope3Total) {
  // I-06 (DESIGN 4.6): the I-05 keys are checked by the shared rule below (all three required since the wave-3 merge).
  const base = Object.keys(p ?? {}).filter(key => !(SCOPE3_PROFILE_I05_KEYS as readonly string[]).includes(key))
  if (!p || typeof p !== 'object' || !sameKeys(Object.fromEntries(base.map(key => [key, 1])), ['results', 'subtotalTonnes', 'methodTypes', 'dominantMethodType', 'valueChain', 'dataQuality', 'biogenicCo2', 'memoItems'])) fail('profile shape')
  const extras = scope3ProfileExtrasProblem(p as unknown as Record<string, unknown>, pairs.map(x => x.r), subtotal, knownSourceSubtotal)
  if (extras) fail(extras)
  if (p.results !== pairs.length) fail('profile result count')
  const totalOf = (items: typeof pairs) => items.map(x => x.r.total!.unrounded)
  if (!sameKeys(p.subtotalTonnes, ['display', 'unit', 'rounding']) || p.subtotalTonnes.unit !== 't CO2e' || p.subtotalTonnes.rounding !== 'half_even_3dp_once'
    || p.subtotalTonnes.display !== tonnes(subtotal.unrounded)) fail('profile tonnes')
  const typeOf = (x: (typeof pairs)[number]) => SCOPE3_METHODS[x.r.methodVersionId]!.methodType
  const types = [...new Set(pairs.map(typeOf))]
  if (!sameKeys(p.methodTypes, types)) fail('profile method types')
  for (const t of types) verifySubtotal(p.methodTypes[t], totalOf(pairs.filter(x => typeOf(x) === t)), 'kg CO2e', 'profile method-type subtotal')
  const kgOf = (t: Scope3MethodType) => parse(p.methodTypes[t]!.unrounded)
  const dominant = [...types].sort((a, b) => { const x = kgOf(a), y = kgOf(b), scale = Math.max(x.scale, y.scale), d = align(y, scale) - align(x, scale); return d !== 0n ? (d > 0n ? 1 : -1) : SCOPE3_METHOD_TYPES.indexOf(a) - SCOPE3_METHOD_TYPES.indexOf(b) })[0]
  if (p.dominantMethodType !== dominant) fail('profile dominant method type')
  const zero = parse(subtotal.unrounded).units === 0n
  if (!sameKeys(p.valueChain, ['numerator', 'denominator', 'percent'])) fail('profile value chain')
  verifySubtotal(p.valueChain.numerator, ['0', ...totalOf(pairs.filter(x => originOf(x.r, x.note) === 'value_chain_partner'))], 'kg CO2e', 'profile value-chain numerator')
  verifySubtotal(p.valueChain.denominator, totalOf(pairs), 'kg CO2e', 'profile value-chain denominator')
  if (zero ? p.valueChain.percent !== null : (verifyRatio(p.valueChain.percent, 1, 100, 'profile value-chain share'), false)) fail('profile value-chain share')
  const dq = p.dataQuality
  if (!sameKeys(dq, ['indicators', 'overall', 'overrides']) || !sameKeys(dq.indicators, SCOPE3_DQ_INDICATORS)) fail('profile data quality')
  for (const indicator of SCOPE3_DQ_INDICATORS) {
    const entry = dq.indicators[indicator]
    if (!sameKeys(entry, ['ratingKg', 'score'])) fail('profile data quality')
    const ratingOf = (x: (typeof pairs)[number]) => x.note.dataQuality?.[indicator] ?? defaultRatingOf(x.r, indicator)
    const ratings = [...new Set(pairs.map(ratingOf))]
    if (!sameKeys(entry.ratingKg, ratings)) fail('profile data-quality ratings')
    for (const rating of ratings) verifySubtotal(entry.ratingKg[rating], totalOf(pairs.filter(x => ratingOf(x) === rating)), 'kg CO2e', 'profile data-quality rating')
    if (zero ? entry.score !== null : (verifyRatio(entry.score, 2, 4, 'profile data-quality score'), false)) fail('profile data-quality score')
  }
  if (!sameKeys(dq.overall, ['score', 'label'])) fail('profile overall data quality')
  if (zero ? dq.overall.score !== null || dq.overall.label !== null : (verifyRatio(dq.overall.score, 2, 4, 'profile overall data quality'), !(SCOPE3_DQ_RATINGS as readonly string[]).includes(dq.overall.label!))) fail('profile overall data quality')
  if (dq.overrides !== pairs.filter(x => x.note.dataQuality && Object.values(x.note.dataQuality).some(v => v !== null)).length) fail('profile override count')
  const biogenic = pairs.flatMap(x => x.r.biogenicCo2 ? [x.r.biogenicCo2.mass] : [])
  if (biogenic.length === 0 ? p.biogenicCo2 !== null : (verifySubtotal(p.biogenicCo2 as unknown as Scope3Total, biogenic, 'kg CO2', 'profile biogenic CO2'), false)) fail('profile biogenic CO2')
  const memo = new Map<string, string[]>()
  for (const x of pairs) for (const m of x.r.memoItems ?? []) memo.set(m.code, [...(memo.get(m.code) ?? []), m.kg])
  if (!sameKeys(p.memoItems, [...memo.keys()])) fail('profile memo items')
  for (const [code, kgs] of memo) verifySubtotal(p.memoItems[code], kgs, 'kg CO2e', 'profile memo item')
}

/** One annotation as the boundary sends it: exactly the two keys, known ratings and origins only. */
function verifyAnnotation(a: Scope3Annotation): Scope3Annotation {
  if (!sameKeys(a, ['dataQuality', 'activityDataOrigin'])) fail('annotation shape')
  if (a.dataQuality !== null && (!sameKeys(a.dataQuality, SCOPE3_DQ_INDICATORS) || Object.values(a.dataQuality).some(v => v !== null && !(SCOPE3_DQ_RATINGS as readonly string[]).includes(v)))) fail('annotation data quality')
  if (a.activityDataOrigin !== null && !(SCOPE3_ACTIVITY_DATA_ORIGINS as readonly string[]).includes(a.activityDataOrigin)) fail('annotation origin')
  return a
}

/** The verified engine output: the aggregate and every result, as the engine produced them. */
interface VerifiedScope3Output { aggregate: Scope3EngineAggregate | null; results: Map<string, Scope3EngineResult>; resultSha256s: string[]; closedSha256s?: string[] }

/**
 * Verifies the results by sending them to the actual engine's aggregate, then checks the aggregate it returned.
 * Not exported: only `scope3Coverage` reaches it, so no caller can supply an aggregate of its own.
 */
async function verifyScope3EngineOutput(results: Scope3EngineResult[], engine: Scope3AggregateEngine, pins: Scope3Pins, annotations: Scope3Annotation[]): Promise<VerifiedScope3Output> {
  results.forEach((r, i) => {
    verifyResult(r, pins)
    // Canonical hash checks allocate temporary trace strings; discard settled batches before encoding the aggregate.
    if ((i + 1) % 128 === 0) (globalThis as { Bun?: { gc(force: boolean): void } }).Bun?.gc(true)
  })
  if (annotations.length !== results.length) fail('annotations do not match the results')
  annotations.forEach(verifyAnnotation)
  if (!results.length) return { aggregate: null, results: new Map(), resultSha256s: [] }
  let aggregate: Scope3EngineAggregate
  // The engine recomputes every result from its input and refuses unless each is byte-identical (S3A-03-R3).
  try { aggregate = await engine.aggregate(results, annotations) } catch { fail('the engine did not verify these results') }
  if (!aggregate || typeof aggregate !== 'object' || Array.isArray(aggregate)) fail('the engine returned no aggregate')
  const { aggregateSha256, ...body } = aggregate
  if (typeof aggregateSha256 !== 'string' || scope3Digest(body) !== aggregateSha256) fail('aggregate hash')
  if (aggregate.engineSha256 !== pins.engineSha256 || aggregate.registerSha256 !== pins.registerSha256) fail('aggregate engine or register is not pinned')
  if (aggregate.profile !== 'neuvetra.scope3-engine.v1.aggregate') fail('aggregate profile')
  if (aggregate.resultCount !== results.length) fail('aggregate covers a different number of results')
  const complete = results.filter(r => r.status === 'complete'), held = results.filter(r => r.status !== 'complete')
  if (multiset(aggregate.includedResults) !== multiset(complete.map(r => r.resultSha256))) fail('aggregate covers different calculated results')
  if (multiset(aggregate.notCalculated.map(scope3Canonical)) !== multiset(held.map(r => scope3Canonical({ resultSha256: r.resultSha256, category: r.category, status: r.status, findings: r.findings }))))
    fail('aggregate covers different results that were not calculated')
  // I-12u (DESIGN 4.6): the boundary pairs each 3C/3D combustion result with its upstream result itself; a closed result is not partial.
  const { closures, closed } = scope3BoundaryClosures(results, scope3Canonical)
  if (!Array.isArray(aggregate.boundaryClosures) || scope3Canonical(aggregate.boundaryClosures) !== scope3Canonical(closures)) fail('aggregate boundary closures')
  const partial = results.filter((r, i) => r.status === 'complete' && r.boundary.minimumBoundary !== 'met' && !closed.has(i))
  if (multiset(aggregate.partialBoundaryResults.map(scope3Canonical)) !== multiset(partial.map(r => scope3Canonical({ resultSha256: r.resultSha256, category: r.category, notes: r.boundary.notes }))))
    fail('aggregate partial-boundary list')
  const gwpSets = [...new Set(complete.map(r => r.gwpSetId))].sort()
  if (JSON.stringify(aggregate.gwpSetsUsed) !== JSON.stringify(gwpSets) || aggregate.mixedGwpSets !== gwpSets.length > 1) fail('aggregate GWP sets')
  if (aggregate.allCalculated !== (results.length > 0 && held.length === 0) || aggregate.complete !== (aggregate.allCalculated && partial.length === 0 && gwpSets.length === 1)) fail('aggregate flags')
  const categories = [...new Set(complete.map(r => r.category))].sort((a, b) => a - b).map(String)
  if (JSON.stringify(Object.keys(aggregate.categorySubtotals).sort()) !== JSON.stringify([...categories].sort())) fail('aggregate categories')
  if (JSON.stringify(Object.keys(aggregate.gwpSetSubtotals).sort()) !== JSON.stringify(gwpSets)) fail('aggregate GWP subtotals')
  for (const c of categories) verifySubtotal(aggregate.categorySubtotals[c], complete.filter(r => String(r.category) === c).map(r => r.total!.unrounded))
  for (const g of gwpSets) verifySubtotal(aggregate.gwpSetSubtotals[g], complete.filter(r => r.gwpSetId === g).map(r => r.total!.unrounded))
  verifySubtotal(aggregate.knownSourceSubtotal, complete.map(r => r.total!.unrounded))
  // Aggregate v2 (I-01): the other pinned registers, and one verified profile per category with a complete result.
  const extraRegisters = pins.additionalRegisterSha256s ?? {}
  if (!sameKeys(aggregate.additionalRegisterSha256s, Object.keys(extraRegisters)) || Object.entries(extraRegisters).some(([name, sha]) => aggregate.additionalRegisterSha256s[name] !== sha)) fail('aggregate additional registers are not pinned')
  if (!sameKeys(aggregate.categoryProfiles, categories)) fail('aggregate category profiles')
  const paired = results.map((r, i) => ({ r, note: annotations[i]! })).filter(x => x.r.status === 'complete')
  for (const c of categories) verifyProfile(aggregate.categoryProfiles[c]!, paired.filter(x => String(x.r.category) === c), aggregate.categorySubtotals[c]!, aggregate.knownSourceSubtotal)
  return { aggregate, results: new Map(results.map(r => [r.resultSha256, r])), resultSha256s: results.map(r => r.resultSha256).sort(), closedSha256s: [...closed].map(i => results[i]!.resultSha256) }
}

/**
 * The 15-category coverage, from engine-verified output only. `results` are the engine results of the calculated
 * records (one per calculated record, in any order); `engine` is the actual Scope 3 engine, which this function asks
 * to aggregate exactly those results. No aggregate is taken from the caller.
 *
 * I-04 (DESIGN 3.5, 5.3): `assessments` are the latest category assessments of the setup's reporting year (at most one
 * per category), or null when they are unavailable (a database below schema 30): then no assessment disclosure is made
 * and nothing is closed by a documented within-category exclusion. Statuses follow DESIGN 5.3 in order.
 */
export async function scope3Coverage(records: Scope3CoverageRecord[], screening: Scope3Screening[], results: Scope3EngineResult[], engine: Scope3AggregateEngine, pins: Scope3Pins,
  annotations: Scope3Annotation[] = results.map(() => SCOPE3_NULL_ANNOTATION), assessments: ReadonlyArray<Scope3AssessmentRecord> | null = null,
  /** Round 2 (owner decision 6): company setup's description of each included category (`scope3ScreeningFromSetup`). */
  setupDescriptions: ReadonlyMap<number, string> | null = null): Promise<Scope3Coverage> {
  // S3A-02: a saved record counts once. Two records may share a result hash; one record may not appear twice.
  // Record IDs must be canonical (lowercase) UUIDs, as PostgreSQL returns them, so two spellings can't pass as two records.
  const ids = records.map(r => r.recordId)
  if (ids.some(id => typeof id !== 'string' || !UUID.test(id))) fail('a saved record ID is not a canonical lowercase UUID')
  // I-05 (lane A, named lines; DESIGN 5.2, A28): a record may also carry derived lines of its own (the 3D upstream line of an
  // energy-resold record), each of a derived kind and at most once; the record itself still counts once.
  const derived = (r: Scope3CoverageRecord) => r.kind !== undefined && (SCOPE3_DERIVED_KINDS as readonly string[]).includes(r.kind) && r.kind !== 'hotel_stay' && r.kind !== 'td_losses'
  const own = records.filter(r => !derived(r)).map(r => r.recordId), lines = records.filter(derived).map(r => `${r.recordId}\u0000${r.kind}`)
  if (new Set(own).size !== own.length || new Set(lines).size !== lines.length) fail('a saved record appears more than once')
  const verified = await verifyScope3EngineOutput(results, engine, pins, annotations)
  const calculatedHashes = records.flatMap(r => r.result.outcome === 'calculated' ? [r.result.resultSha256] : [])
  if (multiset(calculatedHashes) !== multiset(verified.resultSha256s)) fail('the calculated records and the engine results differ')
  const resultOf = (r: Scope3CoverageRecord) => r.result.outcome === 'calculated' ? verified.results.get(r.result.resultSha256)! : null
  // I-12u (DESIGN 4.6): the records whose result the verified aggregate closes (identical closed results are interchangeable).
  const closedLeft = new Map<string, number>()
  for (const sha of verified.closedSha256s ?? []) closedLeft.set(sha, (closedLeft.get(sha) ?? 0) + 1)
  const closedRecords = new Set<Scope3CoverageRecord>()
  for (const r of records) if (r.result.outcome === 'calculated' && (closedLeft.get(r.result.resultSha256) ?? 0) > 0) { closedLeft.set(r.result.resultSha256, closedLeft.get(r.result.resultSha256)! - 1); closedRecords.add(r) }
  for (const r of records) {
    // I-02: a record may be of any of the 15 categories (0030 kinds); a calculated one must still match its result's category.
    if (!SCOPE3_CATEGORIES.includes(r.category)) fail('record category is not a Scope 3 category')
    const result = resultOf(r)
    if (result && result.category !== r.category) fail('a result category differs from its record')
  }
  const agg = verified.aggregate
  const decisions = new Map(validateScope3Screening(screening).map(s => [s.category, s]))
  const allDisclosures = new Map<string, Set<number>>()
  const disclose = (code: string, category: number) => { if (!allDisclosures.has(code)) allDisclosures.set(code, new Set()); allDisclosures.get(code)!.add(category) }
  // I-04: one assessment per category, all of one reporting year, each exactly as 0030 stores it.
  const heads = assessments === null ? null : new Map<number, Scope3AssessmentRecord>()
  if (assessments !== null) {
    if (!Array.isArray(assessments)) throw new Error('Scope 3 assessments must be a list or null.')
    for (const a of assessments.map(item => validateScope3AssessmentRecord(item))) {
      if (heads!.has(a.category)) throw new Error('Scope 3 assessments list a category more than once.')
      if (heads!.size && [...heads!.values()][0]!.reportingYear !== a.reportingYear) throw new Error('Scope 3 assessments mix reporting years.')
      heads!.set(a.category, a)
    }
  }
  const decisionOf = (category: number) => decisions.get(category)?.decision ?? 'not_screened'
  // I-06: lines that count toward the period in a category (calculated, unavailable, needing input or awaiting a source).
  const countedIn = (category: number) => records.filter(r => r.category === category && (r.result.outcome === 'calculated' || r.result.outcome === 'unavailable'
    || (r.result.outcome === 'held' && (r.result.status === 'input_needed' || r.result.status === 'method_pending')))).length
  const selectiveDownstream = heads !== null && scope3SelectiveDownstreamExclusion(decisionOf, category => heads.get(category) ?? null)

  const categories = SCOPE3_CATEGORIES.map((category): Scope3CategoryRow => {
    const mine = records.filter(r => r.category === category)
    const support = scope3CategorySupport(category)
    const decision = decisions.get(category)
    const assessment = heads?.get(category) ?? null
    const held = (r: Scope3CoverageRecord, status: string) => r.result.outcome === 'held' && r.result.status === status
    const pending = (r: Scope3CoverageRecord, optional: boolean) => r.result.outcome === 'held' && r.result.status === 'method_pending' && (r.result.optional === true) === optional
    const complete = (r: Scope3CoverageRecord, boundary: 'met' | 'partial') => { const x = resultOf(r); return !!x && x.status === 'complete' && (x.boundary.minimumBoundary === 'met' || closedRecords.has(r) ? 'met' : 'partial') === boundary }
    const engineHeld = (r: Scope3CoverageRecord) => { const x = resultOf(r); return !!x && x.status !== 'complete' }
    const counts = {
      records: mine.length,
      calculated: mine.filter(r => complete(r, 'met')).length,
      partialBoundary: mine.filter(r => complete(r, 'partial')).length,
      inputNeeded: mine.filter(r => held(r, 'input_needed') || engineHeld(r)).length,
      outsidePeriod: mine.filter(r => r.result.outcome === 'outside_period').length,
      excluded: mine.filter(r => held(r, 'excluded')).length,
      withdrawn: mine.filter(r => held(r, 'withdrawn')).length,
      unavailable: mine.filter(r => r.result.outcome === 'unavailable').length,
      methodPending: mine.filter(r => pending(r, false)).length,
      optionalPending: mine.filter(r => pending(r, true)).length,
    }
    // Every record that counts toward the period: also the method-pending ones (they are active and inside the period).
    const counted = mine.filter(r => r.result.outcome === 'calculated' || r.result.outcome === 'unavailable' || held(r, 'input_needed') || held(r, 'method_pending'))
    const quality = { actual: 0, estimated: 0, unknown: 0 } as Record<CollectionQuality, number>
    for (const r of counted) quality[r.quality]++
    const calculatedHere = counts.calculated + counts.partialBoundary
    const screenedOut = decision?.decision === 'excluded' || decision?.decision === 'not_relevant'
    // A26: partial lines whose every partial note is a documented within-category exclusion no longer keep the category partial.
    const openPartial = mine.filter(r => complete(r, 'partial') && !scope3PartialResultDocumented(resultOf(r)!.boundary.notes, assessment)).length

    // DESIGN 5.3, in order (the web decoder re-derives it identically). Round 2 (owner decision 5): rule 1 is
    // `screening_conflict`; the records stay counted (their subtotal is in the known-source total).
    let status: Scope3CategoryStatus
    if (screenedOut && counted.length > 0) status = 'screening_conflict'
    else if (screenedOut) status = decision!.decision as 'excluded' | 'not_relevant'
    else if (counts.unavailable > 0) status = 'unavailable'
    else if (counts.inputNeeded > 0) status = 'input_needed'
    else if (counts.methodPending > 0) status = 'awaiting_factor_source'
    else if (calculatedHere > 0) status = openPartial > 0 || support === 'engine_partial' ? 'partial_boundary' : 'calculated'
    else if (decision?.decision === 'included' || mine.length > 0) status = 'no_records'
    else status = 'not_screened'

    const subtotal = agg?.categorySubtotals[String(category)] ?? null
    if ((subtotal !== null) !== (calculatedHere > 0)) fail('aggregate subtotal does not match the calculated records')
    const facts = counted.flatMap(r => { const x = resultOf(r); return x ? [x] : [] })
    const reasons = [...new Set(counted.flatMap(r => r.result.outcome === 'held' ? r.result.reasons : resultOf(r)?.findings ?? []))].sort()
    if (status === 'screening_conflict') reasons.unshift('screening_conflict_records_exist')
    const disclosures = new Set<string>()
    // I-12u: a closed combustion line's "upstream excluded" note is not disclosed (its upstream line is counted); the closure is.
    const closedNotes = new Set<string>()
    for (const r of counted) if (closedRecords.has(r)) { closedNotes.add(SCOPE3_BOUNDARY_CLOSURE_PAIRS[resultOf(r)!.methodVersionId]!.note); disclosures.add('combustion_line_closed_by_upstream_line') }
    const stillOpen = new Set(counted.filter(r => !closedRecords.has(r)).flatMap(r => resultOf(r)?.status === 'complete' ? resultOf(r)!.boundary.notes : []))
    for (const f of facts.filter(f => f.status === 'complete')) {
      for (const note of [...f.boundary.notes, ...f.estimates]) if (!closedNotes.has(note) || stillOpen.has(note)) disclosures.add(note)
      // I-06: the shipped `factor_data_years` text names only the Hub 2025 and eGRID editions, so it is disclosed only for a
      // result whose method reads them; every other source is named in the category's methodology statement.
      if (SCOPE3_METHODS[f.methodVersionId]!.factorSourceIds.some(id => SHIPPED_FACTOR_SOURCE_IDS.includes(id))) disclosures.add('factor_data_years')
    }
    // I-12u (DESIGN 13.3): 3A and 3B are calculated now; `category_3a_3b_not_supported` is retired (its text stays for old reports).
    // I-06 (DESIGN 5.1 notes that become disclosures; never holds): spend beside other methods in one category (each
    // purchase counted once), and with-margins category 1 spend while category 4 carries upstream transport records.
    const completeHere = facts.filter(f => f.status === 'complete')
    const typesHere = new Set(completeHere.map(f => SCOPE3_METHODS[f.methodVersionId]!.methodType))
    if (typesHere.has('spend_based') && typesHere.size > 1) disclosures.add('spend_and_activity_methods_in_category')
    if (category === 1 && completeHere.some(f => f.boundary.notes.includes('cradle_to_shelf_including_margins')) && countedIn(4) > 0) disclosures.add('with_margins_may_overlap_cat4_inbound_freight')
    // I-07 (lane A, named lines; DESIGN 5.1): adapter notes that are disclosures, from the lines that count in the category.
    for (const r of counted) for (const note of r.notes ?? []) if (SCOPE3_PLAN_NOTE_DISCLOSURES.includes(note)) disclosures.add(note)
    // Round 3, lane A (owner decision 3): sold products that contain greenhouse gases (category 11) leave gas in them at end of
    // life; category 12 says that release is not quantified there and names the category 11 memo, whenever such a record counts.
    if (category === 12 && records.some(r => r.kind === 'sold_ghg_product' && (r.result.outcome === 'calculated' || r.result.outcome === 'unavailable' || held(r, 'input_needed') || held(r, 'method_pending'))))
      disclosures.add('ghg_product_end_of_life_release_not_quantified')
    if (quality.estimated > 0) disclosures.add('estimated_activity_data')
    if (quality.unknown > 0) disclosures.add('activity_data_quality_unknown')
    // I-04: optional pending activities (A27) and assessment disclosures (DESIGN 3.5). None changes a status or blocks anything.
    if (counts.optionalPending > 0 && !screenedOut) disclosures.add('optional_activity_not_yet_quantified')
    if (heads !== null) {
      for (const code of scope3AssessmentDisclosures(decision?.decision ?? 'not_screened', assessment, setupDescriptions?.get(category) ?? null)) disclosures.add(code)
      if (assessment && assessment.withinCategoryExclusions.length > 0 && !screenedOut) disclosures.add('within_category_exclusion_documented')
      if (selectiveDownstream && (SCOPE3_DOWNSTREAM_JOINT_CATEGORIES as readonly number[]).includes(category)) disclosures.add('selective_downstream_exclusion')
      const resold = mine.filter(r => r.kind === 'energy_resold' && !held(r, 'withdrawn')).length
      if (category === 3 && !screenedOut && assessment?.energyResale === 'resells_energy' && resold === 0) disclosures.add('energy_resale_without_records')
    }
    // Round 2 (ACC-11): counted lines without supporting evidence; (owner decision 9) the data-quality label capped at fair
    // while activity is not quantified (held, engine-held or pending lines, or partial lines that are not documented).
    // Round 2b integration (A27 over decision 9): optional activities pending a factor source (hotel stays abroad) are
    // disclosed and never downgrade the category, so they do not cap its label either.
    const linesWithoutEvidence = counted.filter(r => r.evidenceLinked === false).length
    if (linesWithoutEvidence > 0) disclosures.add('lines_without_evidence')
    const profileHere = agg?.categoryProfiles[String(category)] ?? null
    const dataQualityLabel = scope3CappedDataQualityLabel(profileHere?.dataQuality.overall.label ?? null, counts.inputNeeded + counts.methodPending > 0, openPartial > 0)
    if (dataQualityLabel.capped) disclosures.add('data_quality_label_capped')
    for (const code of disclosures) disclose(code, category)
    return {
      category, title: M71_CATEGORIES[category - 1]!, proposedMandatory: (CARB_PROPOSED_MANDATORY_CATEGORIES as readonly number[]).includes(category), support,
      screening: decision ? { decision: decision.decision, reason: decision.reason, description: decision.decision === 'included' ? setupDescriptions?.get(category) ?? null : null } : { decision: 'not_screened', reason: null, description: null },
      status, counts, quality, subtotal, subtotalBasis: subtotal === null ? null : status === 'calculated' || status === 'partial_boundary' ? 'all_counted_records' : 'known_sources_only',
      methods: [...new Set(facts.map(f => f.methodVersionId))].sort(), reasons, disclosures: [...disclosures].sort(), assessment,
      // I-06 (DESIGN 4.6, 6.2): the verified engine profile of the category, and the analytical review flags from its shares.
      profile: agg?.categoryProfiles[String(category)] ?? null, reviewFlags: scope3ReviewFlags(agg?.categoryProfiles[String(category)] ?? null),
      dataQualityLabel, linesWithoutEvidence,
    }
  })
  // I-06: a mix that includes CO2e not on an IPCC AR5 or AR4 basis (supplier or partner CO2e as reported, a published
  // non-IPCC set) takes the new code, whose text says so; a mix of AR5 and AR4 only keeps the shipped text (A8).
  const mixedCode = agg?.gwpSetsUsed.some(set => !SCOPE3_IPCC_GWP_SETS.includes(set)) ? 'mixed_gwp_sets_including_reported' : 'mixed_gwp_sets'
  if (agg?.mixedGwpSets) for (const row of categories) if (row.subtotal) disclose(mixedCode, row.category)

  const gaps = categories.filter(row => row.proposedMandatory && row.status !== 'calculated' && row.status !== 'not_relevant').map(row => ({ category: row.category, status: row.status }))
  const line = gaps.length === 0 ? 'Complete for the five proposed categories.'
    : 'Incomplete: ' + gaps.map(gap => `category ${gap.category} ${SCOPE3_STATUS_PHRASE[gap.status] ?? SCOPE3_STATUS_PHRASE_R2B[gap.status] ?? gap.status}`).join('; ') + '.'
  for (const code of allDisclosures.keys()) if (!(code in SCOPE3_DISCLOSURE_TEXT)) throw new Error(`Scope 3 disclosure has no text: ${code}`)
  const anyComplete = agg ? agg.includedResults.length > 0 : false
  return {
    profile: SCOPE3_COVERAGE_PROFILE, categories, knownSourceSubtotal: agg && anyComplete ? agg.knownSourceSubtotal : null, addedToScope1And2: false,
    proposedMandatory: { categories: [...CARB_PROPOSED_MANDATORY_CATEGORIES], proposal: true, adopted: false, complete: gaps.length === 0, gaps, line, basis: CARB_PROPOSAL_TEXT },
    disclosures: [...allDisclosures].sort(([a], [b]) => a.localeCompare(b)).map(([code, cats]) => ({ code, categories: [...cats].sort((a, b) => a - b), text: SCOPE3_DISCLOSURE_TEXT[code]! })),
    aggregateSha256: agg?.aggregateSha256 ?? null,
  }
}
