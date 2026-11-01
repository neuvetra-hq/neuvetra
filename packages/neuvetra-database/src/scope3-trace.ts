/**
 * Scope 3 results v2: the shapes and per-line trace that the results route, the web decoder, the screen, print and the CSV
 * share (Scope 3 completion I-06; DESIGN 2 invariant 1, 4.6, 5.2, 6.2, 6.3). Browser-safe: no node imports.
 *
 * Nothing here calculates emissions. A line's effective data quality and activity-data origin are looked up from the
 * method catalog with the engine aggregate's own rules (A19, A20); a category profile is checked only by exact re-sums of
 * the engine's own result totals; the engine's ratios (percent and scores) are checked for form only; review flags compare
 * an engine ratio with a fixed threshold. Every function is generic over methods: it reads the result's own fields and the
 * catalog, so a method added to the engine and the catalog appears without a change here.
 */
import type { Scope3SupersededSpendMemo } from './scope3-r3a'
import { scope3SpendConvertAmount, validateScope3SpendConversionInput, type Scope3SpendConversion } from './scope3-spend-currency'
import { SCOPE3_NULL_ANNOTATION, type Scope3Annotation, type Scope3CategoryProfile, type Scope3CategoryRow, type Scope3Coverage, type Scope3EngineResult, type Scope3Ratio, type Scope3Total } from './scope3-coverage'
import {
  scope3BoundaryClosures, scope3DefaultDataQualityOf,
  SCOPE3_COMPLETION_FACTOR_SOURCES, SCOPE3_DQ_INDICATORS, SCOPE3_DQ_RATINGS, SCOPE3_FACTOR_SOURCES, SCOPE3_FIXED_ORIGINS, SCOPE3_METHOD_TYPES, SCOPE3_METHODS, scope3FactorSourceOf,
  SCOPE3_CONSTANT_DEFINITIONS, SCOPE3_UNIT_DEFINITION_SOURCE,
  type Scope3ActivityDataOrigin, type Scope3DqIndicator, type Scope3DqRating, type Scope3MethodType,
} from './scope3-method-catalog'

// --- Shapes of the Scope 3 results response (route `buildScope3Results`, web `decodeScope3Results`) ---

/** How a line's data-quality rating or origin was decided (display only; the engine aggregate applies the same rules). */
export interface Scope3EffectiveDataQuality {
  indicators: Record<Scope3DqIndicator, { rating: Scope3DqRating; setBy: 'user' | 'method_default' }>
  activityDataOrigin: { origin: Scope3ActivityDataOrigin; setBy: 'user' | 'method_default' | 'method_type' }
}
export type Scope3EvidenceStatus = 'clean' | 'pending' | 'error' | 'rejected' | 'missing'
/** One Scope 3 line of the results response: a saved record or a line derived from one (3C from electricity). */
export interface Scope3ResultsLine {
  recordId: string; versionId: string; revision: number; kind: string; category: number; sourceId: string; locationId: string; locationName: string | null
  period: { start: string; endExclusive: string }; quantity: { value: string; unit: string }; quality: string; estimateBasis: string | null
  evidence: Array<{ id: string; name: string | null; sha256: string | null; status: Scope3EvidenceStatus }>
  plan: { action: 'calculate' | 'hold'; status: 'withdrawn' | 'excluded' | 'input_needed' | 'method_pending' | null; reasons: string[]; notes: string[]; optional?: true }
  periodCheck: 'inside' | 'partial' | 'outside' | 'no_period'
  outcome: 'calculated' | 'held' | 'outside_period' | 'unavailable'; refusalCode: string | null
  result: Scope3EngineResult | null
  /** I-06 (DESIGN 5.2): the record's source reference (bill, booking or invoice number) as saved. */
  reference: string
  /** I-06: the record a derived line follows (3C: the electricity record); null for a saved Scope 3 record. */
  derivedFrom: { recordId: string; kind: string } | null
  /** I-06: the saved payload of the record the line comes from, as saved (never sent to the engine as is). */
  payload: unknown
  /** I-06: the method type of the line's result (catalog), null without a result. */
  methodType: Scope3MethodType | null
  /** I-06: the line's effective data quality and origin (method defaults and the payload's overrides), null without a result. */
  effectiveDataQuality: Scope3EffectiveDataQuality | null
  /**
   * Round 3, lane A (owner decision 4): on a spend line a supplier or partner record replaces, its would-be spend-based figure
   * (a memo outside every total) and the replacing figure's review flag. Absent on every other line and in older documents.
   */
  supersededSpendMemo?: Scope3SupersededSpendMemo
  /** Saved conversion provenance, bound to this version's recorded USD amount; never inferred from rounded USD. */
  currencyConversion?: Scope3SpendConversion
}
/** One sentence of a category's generated methodology statement (DESIGN 6.4). */
export interface Scope3MethodologySentence { topic: string; text: string }
export interface Scope3ResultsCategory extends Scope3CategoryRow {
  /** I-06 (DESIGN 6.4): the generated methodology statement (`scope3MethodologyStatement`), fixed sentences only. */
  methodology: Scope3MethodologySentence[]
}
export interface Scope3ResultsMethod {
  methodVersionId: string; scope: 3; engineSha256: string; registerSha256: string; releaseStatus: 'released_beta' | 'unreleased_beta'; releaseId: string | null; releaseLabel: string | null
  /** I-06: the catalog title and method type, and the engine's own formula (`describe`; null when the description could not be read). */
  title: string; methodType: Scope3MethodType; formula: string | null
}
/** The Scope 3 results response, as the route sends it and the decoder accepts it (DESIGN 5.2, 6). */
export interface Scope3ResultsDocument {
  profile: 'neuvetra.scope3-results.v1'; label: string; syntheticOnly: true; environment: 'synthetic_staging'
  methods: Scope3ResultsMethod[]
  /** I-06: every register the pinned engine reads, by name (`main` is R1), as the boundary verified them. */
  registerSha256s: Record<string, string>
  generatedAt: string; companyId: string
  setup: null | { revision: number; legalName: string; period: { start: string | null; endExclusive: string | null } }
  gridLosses: { included: boolean; electricityRecords: number }
  records: Scope3ResultsLine[]
  coverage: Omit<Scope3Coverage, 'categories'> & { categories: Scope3ResultsCategory[] }
  unmatchedScreening: string[]; warnings: string[]
  /**
   * Round 2 (owner decision 10, ENG-2): the active-line budget. `used` counts every listed line (withdrawn records are not
   * listed and never count); `remaining` is what an import may still add. Imports beyond it are refused before saving.
   * Always sent since round 2 (the route sends it, the decoder requires it); absent only in documents frozen as v1.
   */
  lineBudget?: Scope3LineBudget
  /** Round 2 (owner decision 7): the readiness gate a report version's approval checks (`scope3Readiness`). Always sent since round 2; absent only in v1 documents. */
  readiness?: Scope3Readiness
}
export interface Scope3LineBudget { max: number; used: number; remaining: number }
/** Round 2 (owner decision 7): the open issues that block approval unless acknowledged, per category; `ready` exactly when there are none. */
export type Scope3ReadinessCode = 'input_needed' | 'screening_conflict' | 'needs_review' | 'assessment_missing' | 'included_category_has_no_records'
export interface Scope3Readiness { ready: boolean; openIssues: Array<{ category: number; code: Scope3ReadinessCode }> }
export const SCOPE3_READINESS_CODES: readonly Scope3ReadinessCode[] = ['input_needed', 'screening_conflict', 'needs_review', 'assessment_missing', 'included_category_has_no_records']
/**
 * Round 2 (owner decision 7, UX-10): the readiness gate, from the response's own fields, in category then code order:
 * `input_needed` (category status), `screening_conflict` (category status), `needs_review` (a line the engine returned for
 * review) and `assessment_missing` (a category screened as included with no assessment for the reporting year).
 */
export function scope3Readiness(categories: ReadonlyArray<Pick<Scope3ResultsCategory, 'category' | 'status' | 'screening' | 'assessment'>>, lines: ReadonlyArray<Pick<Scope3ResultsLine, 'category' | 'result' | 'plan' | 'outcome'>>): Scope3Readiness {
  const openIssues: Scope3Readiness['openIssues'] = []
  for (const row of categories) {
    const review = lines.some(line => line.category === row.category && line.result?.status === 'review_required' && line.plan.status !== 'withdrawn' && line.plan.status !== 'excluded' && line.outcome !== 'outside_period')
    const codes: Scope3ReadinessCode[] = [
      ...(row.status === 'input_needed' ? ['input_needed' as const] : []), ...(row.status === 'screening_conflict' ? ['screening_conflict' as const] : []),
      ...(review ? ['needs_review' as const] : []), ...(row.screening.decision === 'included' && row.assessment === null ? ['assessment_missing' as const] : []),
      // Existing within-category exclusions cover only partial components, never the whole included category.
      ...(row.screening.decision === 'included' && !lines.some(line => line.category === row.category && !['withdrawn', 'excluded', 'outsidePeriod'].includes(scope3LineState(line))) ? ['included_category_has_no_records' as const] : [])]
    for (const code of codes) openIssues.push({ category: row.category, code })
  }
  return { ready: openIssues.length === 0, openIssues }
}

/** The same review prompts on screen, in methodology and in a newly written CSV. Zero subtotals are still figures. */
export function scope3VisibleReviewFlags(row: Pick<Scope3CategoryRow, 'reviewFlags' | 'counts'>, categories: ReadonlyArray<Pick<Scope3CategoryRow, 'subtotal'>>): string[] {
  return row.reviewFlags.filter(flag => flag === 'largest_record_over_tenth_of_category' ? row.counts.calculated + row.counts.partialBoundary >= 5
    : flag === 'category_over_half_of_known_total' ? categories.filter(item => item.subtotal !== null).length >= 2 : true)
}

/** Validate activity-currency provenance at the live response boundary. No emissions are calculated. */
export function scope3CurrencyConversionValid(value: unknown, quantity: { value: string; unit: string }): value is Scope3SpendConversion {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== 'amount,currency,rate,rateDate,rateSource,usd') return false
  const c = value as Scope3SpendConversion
  try {
    validateScope3SpendConversionInput({ currency: c.currency, rate: c.rate, rateDate: c.rateDate, rateSource: c.rateSource })
    return typeof c.amount === 'string' && typeof c.usd === 'string' && c.usd.length <= 24 && scope3SpendConvertAmount(c.amount, c.rate) === c.usd
      && quantity.unit === 'USD' && quantity.value.length <= 32 && scope3IsDecimal(quantity.value) && scope3CompareDecimal(quantity.value, c.usd) === 0
  } catch { return false }
}
/** Round 2 (ACC-11): a line has supporting evidence when at least one linked file is neither missing nor rejected. */
export const scope3LineEvidenceLinked = (line: Pick<Scope3ResultsLine, 'evidence'>): boolean => line.evidence.some(file => file.status !== 'missing' && file.status !== 'rejected')

// --- Exact decimals (the engine's strings; comparisons and exact sums only) ---

type Scaled = { units: bigint; scale: number }
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/
export const scope3IsDecimal = (text: unknown): text is string => typeof text === 'string' && DECIMAL.test(text) && text !== '-0'
function parse(text: string): Scaled {
  if (!scope3IsDecimal(text)) throw new Error('Not an exact decimal.')
  const negative = text.startsWith('-'), [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.')
  const units = BigInt(whole! + fraction)
  return { units: negative ? -units : units, scale: fraction.length }
}
const align = (a: Scaled, scale: number) => a.units * 10n ** BigInt(scale - a.scale)
/** -1, 0 or 1, comparing two exact decimal strings by value. */
export function scope3CompareDecimal(a: string, b: string): number {
  const x = parse(a), y = parse(b), scale = Math.max(x.scale, y.scale), d = align(x, scale) - align(y, scale)
  return d === 0n ? 0 : d > 0n ? 1 : -1
}
function format(units: bigint, scale: number): string {
  const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(scale + 1, '0')
  return `${negative ? '-' : ''}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`
}
/** The exact sum of exact decimals (TypeScript re-sums engine totals only to check them; DESIGN 2 invariant 1). */
export function scope3SumDecimals(values: readonly string[]): string {
  const parsed = values.map(parse), scale = Math.max(0, ...parsed.map(p => p.scale))
  return format(parsed.reduce((total, p) => total + align(p, scale), 0n), scale)
}
function roundHalfEven(units: bigint, drop: number): bigint {
  if (drop <= 0) return units * 10n ** BigInt(-drop)
  const divisor = 10n ** BigInt(drop), negative = units < 0n, magnitude = negative ? -units : units
  let kept = magnitude / divisor
  const twice = (magnitude % divisor) * 2n
  if (twice > divisor || (twice === divisor && kept % 2n === 1n)) kept += 1n
  return negative ? -kept : kept
}
/** The engine's kg display: rounded once, half-even, to 4 decimals (a negative that rounds to zero keeps its sign, as Python's Decimal does). */
export function scope3Display4(text: string): string { const p = parse(text), r = roundHalfEven(p.units, p.scale - 4); return `${p.units < 0n && r === 0n ? '-' : ''}${format(r, 4)}` }
/** The engine's t CO2e display: the kg value with the point moved three places, rounded once, half-even, to 3 decimals. */
export function scope3Tonnes3(kgText: string): string { const p = parse(kgText); return format(roundHalfEven(p.units, p.scale + 3 - 3), 3) }
/** A kg figure in t CO2e by scale only (the point moved three places, no rounding; assurance-ux M9). */
export function scope3KgToTonnesExact(kgText: string): string { const p = parse(kgText); return format(p.units, p.scale + 3) }

// --- Effective data quality and origin (DESIGN A3, A19, A20; the engine's effective_origin / effective_rating) ---

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
/** The engine's canonical JSON (keys sorted, no spaces, non-ASCII kept), browser-safe; the trusted boundary's `scope3Canonical` writes the same. */
export function scope3CanonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(scope3CanonicalJson).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${scope3CanonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
}
/**
 * Round 3 (owner decision 6): the same canonical JSON as `scope3CanonicalJson(JSON.parse(JSON.stringify(value)))`, byte for
 * byte, without the round trip (which held a second full copy of an 83 MB document and its 83 MB JSON text at once).
 * JSON.stringify's rules are applied directly: `toJSON` is called, an `undefined`, function or symbol property is left out,
 * and such an array element (or a hole) is `null`. The outer `levels` levels of objects and arrays are written as pieces
 * into one list joined once, so no ancestor of the large record list is ever copied whole; anything deeper (one result
 * line, a few kB) is written as one string.
 */
export function scope3CanonicalJsonText(value: unknown, levels = 3, betweenBatches?: () => void): string {
  const parts: string[] = []
  let written = 0
  const prepare = (v: unknown, key: string): unknown => v !== null && typeof v === 'object' && typeof (v as { toJSON?: unknown }).toJSON === 'function' ? (v as { toJSON(key: string): unknown }).toJSON(key) : v
  const omitted = (v: unknown) => v === undefined || typeof v === 'function' || typeof v === 'symbol'
  const small = (v: unknown): string | undefined => {
    if (omitted(v)) return undefined
    if (v === null || typeof v !== 'object') return JSON.stringify(v)
    if (Array.isArray(v)) { const out = new Array<string>(v.length); for (let i = 0; i < v.length; i++) out[i] = small(prepare(v[i], String(i))) ?? 'null'; return `[${out.join(',')}]` }
    const out: string[] = []
    for (const key of Object.keys(v).sort()) { const text = small(prepare((v as Record<string, unknown>)[key], key)); if (text !== undefined) out.push(`${JSON.stringify(key)}:${text}`) }
    return `{${out.join(',')}}`
  }
  const write = (v: unknown, depth: number): boolean => {
    if (omitted(v)) return false
    if (depth >= levels || v === null || typeof v !== 'object') {
      parts.push(small(v)!)
      // The server can reclaim temporary per-record strings before they accumulate across the full report.
      if (++written % 256 === 0) betweenBatches?.()
      return true
    }
    if (Array.isArray(v)) {
      parts.push('[')
      for (let i = 0; i < v.length; i++) { if (i > 0) parts.push(','); if (!write(prepare(v[i], String(i)), depth + 1)) parts.push('null') }
      parts.push(']'); return true
    }
    parts.push('{')
    let first = true
    for (const key of Object.keys(v).sort()) {
      const child = prepare((v as Record<string, unknown>)[key], key)
      if (omitted(child)) continue
      parts.push(`${first ? '' : ','}${JSON.stringify(key)}:`); first = false
      write(child, depth + 1)
    }
    parts.push('}'); return true
  }
  if (!write(prepare(value, ''), 0)) return 'null'
  betweenBatches?.()
  return parts.join('')
}
/**
 * The aggregate annotation a saved payload gives (DESIGN A3): its `dataQuality` indicators and activity-data origin, as
 * saved; null for both when the payload has no `dataQuality`. The results route sends exactly this to the engine aggregate.
 */
export function scope3AnnotationFromPayload(payload: unknown): Scope3Annotation {
  const dq = isObject(payload) ? payload.dataQuality : undefined
  if (!isObject(dq)) return SCOPE3_NULL_ANNOTATION
  const indicators = isObject(dq.indicators) ? dq.indicators : null
  return {
    dataQuality: indicators ? Object.fromEntries(SCOPE3_DQ_INDICATORS.map(name => [name, indicators[name] ?? null])) as Scope3Annotation['dataQuality'] : null,
    activityDataOrigin: (dq.activityDataOrigin ?? null) as Scope3Annotation['activityDataOrigin'],
  }
}
/** A line's annotation: a derived line (3C) has none, because its payload is the Scope 1/2 record's (route `buildScope3Results`). */
export const scope3LineAnnotation = (line: Pick<Scope3ResultsLine, 'derivedFrom' | 'payload'>): Scope3Annotation =>
  line.derivedFrom !== null ? SCOPE3_NULL_ANNOTATION : scope3AnnotationFromPayload(line.payload)

/**
 * The rating and origin the engine aggregate uses for this result (A19: supplier, partner, spend and proxy origins are
 * fixed by the method type and an override is ignored; A20: the unverified default when the result says its supplier or
 * partner data are unverified; a rating the company set wins). Null when the result names a method the catalog lacks.
 */
export function scope3EffectiveDataQuality(result: Pick<Scope3EngineResult, 'methodVersionId' | 'boundary'>, annotation: Scope3Annotation): Scope3EffectiveDataQuality | null {
  const method = SCOPE3_METHODS[result.methodVersionId]
  if (!method) return null
  // A20, and I-12u's default by note (3A liquid fuels): the engine's `default_data_quality`.
  const defaults = scope3DefaultDataQualityOf(method, result.boundary.notes)
  const indicators = Object.fromEntries(SCOPE3_DQ_INDICATORS.map(name => {
    const user = annotation.dataQuality?.[name] ?? null
    return [name, user !== null ? { rating: user, setBy: 'user' as const } : { rating: defaults[name], setBy: 'method_default' as const }]
  })) as Scope3EffectiveDataQuality['indicators']
  const fixed = SCOPE3_FIXED_ORIGINS[method.methodType]
  const activityDataOrigin = fixed ? { origin: fixed, setBy: 'method_type' as const }
    : annotation.activityDataOrigin ? { origin: annotation.activityDataOrigin, setBy: 'user' as const } : { origin: method.activityDataOrigin, setBy: 'method_default' as const }
  return { indicators, activityDataOrigin }
}

// --- Line state, supersession, factor sources ---

export type Scope3LineState = 'calculated' | 'partialBoundary' | 'inputNeeded' | 'outsidePeriod' | 'excluded' | 'withdrawn' | 'unavailable' | 'methodPending' | 'optionalPending'
/** Which coverage count a line belongs to: the route's precedence (withdrawn and excluded, then the period, then the rest). */
export function scope3LineState(line: Pick<Scope3ResultsLine, 'plan' | 'outcome' | 'result'>, closed = false): Scope3LineState {
  if (line.plan.status === 'withdrawn') return 'withdrawn'
  if (line.plan.status === 'excluded') return 'excluded'
  if (line.outcome === 'outside_period') return 'outsidePeriod'
  if (line.outcome === 'unavailable') return 'unavailable'
  // I-12u (DESIGN 4.6): a 3C or 3D combustion line closed by its upstream line (`scope3ClosedLines`) counts as calculated.
  if (line.outcome === 'calculated' && line.result?.status === 'complete') return line.result.boundary.minimumBoundary === 'met' || closed ? 'calculated' : 'partialBoundary'
  if (line.plan.status === 'method_pending') return line.plan.optional === true ? 'optionalPending' : 'methodPending'
  return 'inputNeeded'
}
/**
 * I-12u (DESIGN 4.6): the calculated lines whose result the engine aggregate closes (`scope3BoundaryClosures`, the engine's
 * `boundary_closures` over the complete results in line order), so the route's coverage, the decoder and the methodology agree.
 */
export function scope3ClosedLines<L extends Pick<Scope3ResultsLine, 'outcome' | 'result'>>(lines: readonly L[]): Set<L> {
  const calculated = lines.filter(line => line.outcome === 'calculated' && line.result !== null)
  const { closed } = scope3BoundaryClosures(calculated.map(line => line.result!), scope3CanonicalJson)
  return new Set(calculated.filter((_, i) => closed.has(i)))
}
/** DESIGN 5.1 (A22): the supplier or partner record that replaces a spend line (`superseded_by:<recordId>` plan note), or null. */
export function scope3SupersededBy(line: Pick<Scope3ResultsLine, 'plan'>): string | null {
  const note = line.plan.notes.find(item => item.startsWith('superseded_by:'))
  return note ? note.slice('superseded_by:'.length) : null
}
const ALL_FACTOR_SOURCES: ReadonlyArray<{ id: string; text: string }> = [...SCOPE3_FACTOR_SOURCES, ...SCOPE3_COMPLETION_FACTOR_SOURCES]
/** A factor source by id (the catalog's two lists), or null. */
export const scope3FactorSourceById = (id: string) => ALL_FACTOR_SOURCES.find(source => source.id === id) ?? null
/** The factor source of a register factor or constant key, by key prefix (catalog), or null for a plain unit constant. */
export function scope3FactorSourceOfKey(key: string): { id: string; text: string } | null {
  const id = scope3FactorSourceOf(key)
  return id ? scope3FactorSourceById(id) ?? { id, text: id } : null
}

/**
 * I-07 (integration wave 3 follow-up): the source of a register constant. A price index names its factor source (key prefix);
 * a unit or definition constant (R1's unit constants, R3's `supplement_const.`) names the unit definition and the basis its
 * register records, so the CSV Factor section and the trace never leave a constant without a source. Null for an unknown id.
 */
export function scope3ConstantSourceOf(id: string): { id: string; text: string } | null {
  const bySource = scope3FactorSourceOfKey(id)
  if (bySource) return bySource
  const basis = SCOPE3_CONSTANT_DEFINITIONS[id]
  return basis ? { id: SCOPE3_UNIT_DEFINITION_SOURCE.id, text: `${SCOPE3_UNIT_DEFINITION_SOURCE.text}: ${basis}` } : null
}

/** Plain one-line texts of a result's trace (screen, print and CSV use the same words). */
export const scope3FactorText = (f: Scope3EngineResult['factorsUsed'][number]) => { const x = f as { key: string; value: string; unit: string }; return `${x.key} = ${x.value} ${x.unit}` }
export const scope3ConstantText = (c: Scope3EngineResult['constantsUsed'][number]) => { const x = c as { id: string; value: string; unit: string }; return `${x.id} = ${x.value} ${x.unit}` }
export function scope3ConversionText(c: Scope3EngineResult['conversions'][number]): string {
  const x = c as { quantity: string; numerator: string; denominator: string; result: string; rounded: boolean; places: number; rounding: string }
  return `${x.quantity}: ${x.numerator} / ${x.denominator} = ${x.result}${x.rounded ? ` (rounded once, ${x.rounding.replace(/_/g, '-')}, to ${x.places} decimals)` : ' (exact)'}`
}
const GAS_LABEL: Record<string, string> = { co2: 'CO2', ch4: 'CH4', n2o: 'N2O' }
/** Each gas's mass and CO2e, and any CO2e-only component, exactly as the engine gives them. */
export function scope3GasTexts(result: Scope3EngineResult): string[] {
  const gases = Object.entries(result.gases ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([gas, g]) => `${GAS_LABEL[gas] ?? gas} ${g.mass} ${g.massUnit} = ${g.co2e} ${g.co2eUnit}`)
  const only = result.co2eWithoutGasSplit ? [`CO2e (no split by gas, ${result.co2eWithoutGasSplit.gwpSetId}) ${result.co2eWithoutGasSplit.co2e} ${result.co2eWithoutGasSplit.co2eUnit}`] : []
  return [...gases, ...only]
}

// --- Category profiles (DESIGN 4.6): checks shared by the trusted boundary (I-05 keys) and the web decoder (all keys) ---

const PROFILE_KEYS = ['results', 'subtotalTonnes', 'methodTypes', 'dominantMethodType', 'valueChain', 'dataQuality', 'biogenicCo2', 'memoItems'] as const
/** The keys the engine adds in I-05 (DESIGN 4.6); the merged engine always sends all three, and every profile must have them (integration wave 3). */
export const SCOPE3_PROFILE_I05_KEYS = ['deflationEffect', 'shareOfKnownTotal', 'largestResultShare'] as const
const sameKeys = (value: unknown, keys: readonly string[]) => isObject(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
const RATIO_VALUE = /^(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/
function ratioOk(r: unknown, places: number, max: string): boolean {
  if (!sameKeys(r, ['value', 'display'])) return false
  const ratio = r as Scope3Ratio
  return typeof ratio.value === 'string' && RATIO_VALUE.test(ratio.value) && (ratio.value.split('.')[1]?.length ?? 0) <= 12 && scope3CompareDecimal(ratio.value, max) <= 0
    && typeof ratio.display === 'string' && new RegExp(`^(?:0|[1-9][0-9]*)\\.[0-9]{${places}}$`).test(ratio.display)
}
/** A kg figure in the engine's total shape whose value is exactly the sum of `parts` and whose display is that sum rounded once. */
function totalOk(t: unknown, parts: readonly string[], unit = 'kg CO2e'): boolean {
  if (!sameKeys(t, ['unrounded', 'display', 'unit', 'rounding'])) return false
  const x = t as Scope3Total
  return x.unit === unit && x.rounding === 'half_even_4dp_once' && scope3IsDecimal(x.unrounded) && typeof x.display === 'string'
    && scope3CompareDecimal(x.unrounded, scope3SumDecimals(['0', ...parts])) === 0 && scope3Display4(x.unrounded) === x.display
}
const typeOf = (result: Pick<Scope3EngineResult, 'methodVersionId'>): Scope3MethodType | null => SCOPE3_METHODS[result.methodVersionId]?.methodType ?? null

/**
 * The I-05 profile keys (DESIGN 4.6): all three, with `deflationEffect` the exact sum of `nominalCo2e - total` over the
 * category's spend and proxy results that carry a price ratio (null when none does), and both shares in the engine's
 * percent form (null exactly when their denominator, the known-source or category subtotal, is 0). Returns the problem,
 * or null. `results` are the category's complete results. Integration wave 3: a profile with none of the keys is refused
 * too (I-06 accepted none while the engine did not yet send them; the merged I-05 engine always does).
 */
export function scope3ProfileExtrasProblem(profile: Record<string, unknown>, results: ReadonlyArray<Pick<Scope3EngineResult, 'methodVersionId' | 'activity' | 'total'>>, subtotal: Scope3Total, knownSourceSubtotal: Scope3Total): string | null {
  const present = SCOPE3_PROFILE_I05_KEYS.filter(key => key in profile)
  if (present.length === 0) return 'profile has none of the deflation and share keys'
  if (present.length !== SCOPE3_PROFILE_I05_KEYS.length) return 'profile has only some of the deflation and share keys'
  const deflated = results.filter(r => (typeOf(r) === 'spend_based' || typeOf(r) === 'proxy') && r.activity && typeof (r.activity as Record<string, unknown>).priceRatio === 'string')
  const negate = (text: string) => text.startsWith('-') ? text.slice(1) : scope3CompareDecimal(text, '0') === 0 ? '0' : `-${text}`
  const nominals = deflated.map(r => (r.activity as Record<string, unknown>).nominalCo2e)
  if (!nominals.every(scope3IsDecimal)) return 'a deflated result has no exact nominal CO2e'
  const differences = deflated.map((r, i) => scope3SumDecimals([nominals[i] as string, negate(r.total!.unrounded)]))
  if (deflated.length === 0 ? profile.deflationEffect !== null : !totalOk(profile.deflationEffect, differences)) return 'profile deflation effect is not the sum of its results'
  const zeroKnown = scope3CompareDecimal(knownSourceSubtotal.unrounded, '0') === 0, zeroCategory = scope3CompareDecimal(subtotal.unrounded, '0') === 0
  if (zeroKnown ? profile.shareOfKnownTotal !== null : !ratioOk(profile.shareOfKnownTotal, 1, '100')) return 'profile share of the known-source total'
  if (zeroCategory ? profile.largestResultShare !== null : !ratioOk(profile.largestResultShare, 1, '100')) return 'profile largest-result share'
  return null
}

/** A line of a category as the decoder sees it for the profile check: its complete result and its effective data quality. */
export interface Scope3ProfileLine { result: Scope3EngineResult; effective: Scope3EffectiveDataQuality }
/**
 * The whole profile against the category's complete lines (the web decoder's check; the trusted boundary makes the same
 * checks against the annotations it sent): every kg figure is the exact sum of the right lines' totals, the tonnes display
 * is the subtotal rounded once, the dominant type follows the tie order, ratios have the engine's form. Problem, or null.
 */
export function scope3ProfileProblem(profile: unknown, lines: readonly Scope3ProfileLine[], subtotal: Scope3Total, knownSourceSubtotal: Scope3Total): string | null {
  if (!isObject(profile)) return 'profile is not an object'
  const keys = Object.keys(profile).filter(key => !(SCOPE3_PROFILE_I05_KEYS as readonly string[]).includes(key))
  if (!sameKeys(Object.fromEntries(keys.map(key => [key, 1])), PROFILE_KEYS)) return 'profile shape'
  const p = profile as unknown as Scope3CategoryProfile
  if (p.results !== lines.length) return 'profile result count'
  if (!sameKeys(p.subtotalTonnes, ['display', 'unit', 'rounding']) || p.subtotalTonnes.unit !== 't CO2e' || p.subtotalTonnes.rounding !== 'half_even_3dp_once' || p.subtotalTonnes.display !== scope3Tonnes3(subtotal.unrounded)) return 'profile tonnes'
  const totals = (items: readonly Scope3ProfileLine[]) => items.map(x => x.result.total!.unrounded)
  const types = [...new Set(lines.map(x => typeOf(x.result)))]
  if (types.some(t => t === null) || !sameKeys(p.methodTypes, types as string[])) return 'profile method types'
  for (const t of types as Scope3MethodType[]) if (!totalOk(p.methodTypes[t], totals(lines.filter(x => typeOf(x.result) === t)))) return 'profile method-type subtotal'
  const dominant = [...(types as Scope3MethodType[])].sort((a, b) => scope3CompareDecimal(p.methodTypes[b]!.unrounded, p.methodTypes[a]!.unrounded) || SCOPE3_METHOD_TYPES.indexOf(a) - SCOPE3_METHOD_TYPES.indexOf(b))[0]
  if (p.dominantMethodType !== dominant) return 'profile dominant method type'
  const zero = scope3CompareDecimal(subtotal.unrounded, '0') === 0
  if (!sameKeys(p.valueChain, ['numerator', 'denominator', 'percent'])) return 'profile value chain'
  if (!totalOk(p.valueChain.numerator, totals(lines.filter(x => x.effective.activityDataOrigin.origin === 'value_chain_partner')))) return 'profile value-chain numerator'
  if (!totalOk(p.valueChain.denominator, totals(lines))) return 'profile value-chain denominator'
  if (zero ? p.valueChain.percent !== null : !ratioOk(p.valueChain.percent, 1, '100')) return 'profile value-chain share'
  const dq = p.dataQuality
  if (!sameKeys(dq, ['indicators', 'overall', 'overrides']) || !sameKeys(dq.indicators, SCOPE3_DQ_INDICATORS)) return 'profile data quality'
  for (const indicator of SCOPE3_DQ_INDICATORS) {
    const entry = dq.indicators[indicator]
    if (!sameKeys(entry, ['ratingKg', 'score'])) return 'profile data quality'
    const ratingOf = (x: Scope3ProfileLine) => x.effective.indicators[indicator].rating
    const ratings = [...new Set(lines.map(ratingOf))]
    if (!sameKeys(entry.ratingKg, ratings)) return 'profile data-quality ratings'
    for (const rating of ratings) if (!totalOk(entry.ratingKg[rating], totals(lines.filter(x => ratingOf(x) === rating)))) return 'profile data-quality rating'
    if (zero ? entry.score !== null : !ratioOk(entry.score, 2, '4')) return 'profile data-quality score'
  }
  if (!sameKeys(dq.overall, ['score', 'label'])) return 'profile overall data quality'
  if (zero ? dq.overall.score !== null || dq.overall.label !== null : !ratioOk(dq.overall.score, 2, '4') || !(SCOPE3_DQ_RATINGS as readonly string[]).includes(dq.overall.label!)) return 'profile overall data quality'
  if (dq.overrides !== lines.filter(x => SCOPE3_DQ_INDICATORS.some(name => x.effective.indicators[name].setBy === 'user')).length) return 'profile override count'
  const biogenic = lines.flatMap(x => x.result.biogenicCo2 ? [x.result.biogenicCo2.mass] : [])
  if (biogenic.length === 0 ? p.biogenicCo2 !== null : !totalOk(p.biogenicCo2, biogenic, 'kg CO2')) return 'profile biogenic CO2'
  const memo = new Map<string, string[]>()
  for (const x of lines) for (const m of x.result.memoItems ?? []) memo.set(m.code, [...(memo.get(m.code) ?? []), m.kg])
  if (!sameKeys(p.memoItems, [...memo.keys()])) return 'profile memo items'
  for (const [code, kgs] of memo) if (!totalOk(p.memoItems[code], kgs)) return 'profile memo item'
  return scope3ProfileExtrasProblem(profile, lines.map(x => x.result), subtotal, knownSourceSubtotal)
}

/** Critique I-9 thresholds (percent, compared with the engine's 12-dp ratio values). */
export const SCOPE3_REVIEW_THRESHOLDS = { categoryShareOfKnownTotal: '50', largestResultShareOfCategory: '10' } as const
/**
 * Analytical review flags of a category (DESIGN 4.6): more than half of the known-source total, and a single result above
 * 10% of the category. Review prompts only: never a hold, never a status change. None before the engine sends the shares.
 */
export function scope3ReviewFlags(profile: Scope3CategoryProfile | null): string[] {
  if (!profile) return []
  const flags: string[] = []
  if (profile.shareOfKnownTotal && scope3CompareDecimal(profile.shareOfKnownTotal.value, SCOPE3_REVIEW_THRESHOLDS.categoryShareOfKnownTotal) > 0) flags.push('category_over_half_of_known_total')
  if (profile.largestResultShare && scope3CompareDecimal(profile.largestResultShare.value, SCOPE3_REVIEW_THRESHOLDS.largestResultShareOfCategory) > 0) flags.push('largest_record_over_tenth_of_category')
  return flags
}
