/**
 * Scope 3 round 3, lane A (Claude, 31 October 2026; ROUND3.md owner decisions 2, 3 and 4; AC-14). Browser-safe and shared by
 * the adapter, the results route, the methodology, the CSV and the screen. Nothing here calculates emissions: it compares and
 * subtracts the engine's exact decimal strings (no rounding) and builds words from a line's own fields.
 *
 * - The tax treatment of a spend line (AC-14) is a line note and a category disclosure; the engine input never carries it.
 * - The partial-boundary words of an upstream electricity line (decision 2) name the fully counted fuels and their share, coal
 *   with its share and "mine methane only", the other fossil fuels not counted, other fuels, solar-thermal co-firing and the
 *   static nuclear and biomass note; never "covers 100%".
 * - The superseded spend memo (decision 4): the would-be spend-based (EEIO) figure of a spend line a supplier or partner record
 *   replaces, outside every total, and the review flag `superseding_figure_review` when the replacing figure is under 10% or
 *   over 10 times the would-be figures of every spend line it replaces.
 */
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_MEMO_TEXT_R3A } from './scope3-text'

/** AC-14: the line note of each recorded tax treatment (sorted). */
export const SCOPE3_TAX_TREATMENT_NOTES = ['spend_tax_treatment_excludes_sales_tax', 'spend_tax_treatment_includes_sales_tax', 'spend_tax_treatment_unknown'] as const
export const scope3TaxTreatmentNote = (treatment: 'excludes_sales_tax' | 'includes_sales_tax' | 'unknown') => `spend_tax_treatment_${treatment}` as const

// --- Exact decimal strings (the engine's), compared and subtracted without rounding ---
type Scaled = { units: bigint; scale: number }
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/
function parse(text: string): Scaled {
  if (!DECIMAL.test(text)) throw new Error('Not an exact decimal.')
  const negative = text.startsWith('-'), [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.')
  const units = BigInt(whole! + fraction)
  return { units: negative ? -units : units, scale: fraction.length }
}
const align = (a: Scaled, scale: number) => a.units * 10n ** BigInt(scale - a.scale)
function format(units: bigint, scale: number): string {
  const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(scale + 1, '0')
  const text = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits
  return negative && /[1-9]/.test(text) ? `-${text}` : text
}
/** a - b, exactly, at the larger scale of the two. */
export function scope3DecimalDifference(a: string, b: string): string {
  const x = parse(a), y = parse(b), scale = Math.max(x.scale, y.scale)
  return format(align(x, scale) - align(y, scale), scale)
}
/** The exact sum of decimal strings, at the largest scale ("0" for none). */
export function scope3DecimalTotal(values: readonly string[]): string {
  const parsed = values.map(parse), scale = Math.max(0, ...parsed.map(p => p.scale))
  return format(parsed.reduce((sum, p) => sum + align(p, scale), 0n), scale)
}
/** -1, 0 or 1 comparing a x factor with b, exactly (factor a whole number or a decimal string). */
function compareScaled(a: string, factor: string, b: string): number {
  const x = parse(a), f = parse(factor), y = parse(b), scale = Math.max(x.scale + f.scale, y.scale)
  const left = x.units * f.units * 10n ** BigInt(scale - x.scale - f.scale), right = align(y, scale)
  return left === right ? 0 : left > right ? 1 : -1
}

/** A memo item code in words (round 3 codes have their own words; any other keeps its earlier words, the code with spaces). */
export const scope3MemoText = (code: string): string => SCOPE3_MEMO_TEXT_R3A[code] ?? code.replace(/_/g, ' ')

// --- Decision 2: the partial-boundary words of an upstream electricity line ---
const FUEL_WORDS: Readonly<Record<string, string>> = { GAS: 'natural gas', OIL: 'oil', COAL: 'coal', OFSL: 'other fossil fuels', OTHF: 'other fuels' }
const words = (codes: readonly string[]) => { const w = codes.map(code => FUEL_WORDS[code] ?? code.toLowerCase()); return w.length <= 1 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}` }
/**
 * Why an upstream electricity line (3B, 3C upstream, 3D upstream) is partial, from its own activity and notes: the fully
 * counted fuels and their share of the fossil heat input, coal with its share (mine methane only), other fossil fuels not
 * counted, other fuels, solar-thermal co-firing and the static nuclear and biomass note. Null when the activity has no
 * mapped share (not an upstream electricity line, or a subregion without fossil heat input). `percent` formats a 0..1 ratio.
 */
export function scope3UpstreamPartialText(activity: Record<string, unknown>, notes: readonly string[], percent: (ratio: string) => string): string | null {
  const mapped = activity.mappedFossilHeatInputShare, mappedFuels = activity.mappedFuels, unmapped = activity.unmappedFuels
  if (typeof mapped !== 'string' || !Array.isArray(mappedFuels) || !Array.isArray(unmapped)) return null
  const coal = typeof activity.coalHeatInputShare === 'string' && (mappedFuels as string[]).includes('COAL') ? activity.coalHeatInputShare : null
  const full = (mappedFuels as string[]).filter(fuel => fuel !== 'COAL')
  const parts: string[] = []
  if (full.length) parts.push(`${words(full)} ${full.length === 1 ? 'is' : 'are'} fully counted (${percent(coal === null ? mapped : scope3DecimalDifference(mapped, coal))}% of the fossil heat input)`)
  if (coal !== null) parts.push(`coal (${percent(coal)}% of the fossil heat input) counts mine methane only: the energy to mine it and the CO2 of transporting it aren’t included (a screening range is shown as a memo)`)
  if ((unmapped as string[]).length) parts.push(`${words(unmapped as string[])}${typeof activity.unmappedFossilHeatInputShare === 'string' ? ` (${percent(activity.unmappedFossilHeatInputShare)}% of the fossil heat input)` : ''} aren’t quantified`)
  if (Array.isArray(activity.otherFuelsNotMapped) && activity.otherFuelsNotMapped.length) parts.push('other fuels (eGRID “other fuel”) aren’t quantified')
  if (notes.includes('solar_thermal_cofiring_upstream_not_counted')) parts.push('gas co-fired at solar-thermal plants isn’t counted')
  if (notes.includes('nuclear_biomass_byproduct_fuels_upstream_excluded')) parts.push('the upstream of nuclear, biomass and renewable plants, where present in the subregion’s mix, isn’t counted')
  return `${parts.join('; ')}. None of this is treated as zero.`
}

// --- Decision 4: the superseded spend memo ---
export interface Scope3KgTotal { unrounded: string; display: string; unit: 'kg CO2e' }
/** On a spend line a supplier or partner record replaces (round 3, owner decision 4): its would-be spend-based figure, outside every total. */
export interface Scope3SupersededSpendMemo {
  supersededBy: string
  /** calculated: the spend-based figure the line would have had; not_calculated: the line would be held (reasons say why). */
  status: 'calculated' | 'not_calculated'
  wouldBe: Scope3KgTotal | null
  methodVersionId: string | null; inputSha256: string | null; resultSha256: string | null
  reasons: string[]
  /** The replacing record's figure, the spend lines it replaces and the exact sum of their would-be figures (null: not compared). */
  replacing: { co2e: Scope3KgTotal | null; spendLines: number; wouldBeTotalUnrounded: string | null }
  /** `superseding_figure_review` when the replacing figure is under 10% or over 10 times that sum. */
  reviewFlags: string[]
}
export const SCOPE3_SUPERSEDING_REVIEW_FLAG = 'superseding_figure_review' as const
/**
 * The comparison of decision 4 for one replacing record: its figure against the exact sum of the would-be spend-based figures
 * of every spend line it replaces. Compared only when the replacing record and every one of those lines have a figure;
 * flagged when replacing x 10 < sum (under 10%) or replacing > 10 x sum (over 10 times).
 */
export function scope3SupersedingComparison(replacing: string | null, wouldBe: ReadonlyArray<string | null>): { wouldBeTotalUnrounded: string | null; reviewFlags: string[] } {
  if (replacing === null || wouldBe.length === 0 || wouldBe.some(kg => kg === null)) return { wouldBeTotalUnrounded: null, reviewFlags: [] }
  const total = scope3DecimalTotal(wouldBe as string[])
  const under = compareScaled(replacing, '10', total) < 0, over = compareScaled(total, '10', replacing) < 0
  return { wouldBeTotalUnrounded: total, reviewFlags: under || over ? [SCOPE3_SUPERSEDING_REVIEW_FLAG] : [] }
}

const KG_TOTAL = (value: unknown): value is Scope3KgTotal => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === 'display,unit,unrounded'
  && (value as Scope3KgTotal).unit === 'kg CO2e' && DECIMAL.test((value as Scope3KgTotal).unrounded) && /^-?\d+\.\d{4}$/.test((value as Scope3KgTotal).display)
const SHA = /^[0-9a-f]{64}$/
/**
 * The decoder's check of every superseded spend memo of a response (round 3, owner decision 4), or null when they are all
 * right: only on a spend line excluded as superseded, naming the same replacing record; its exact shape; a would-be figure
 * exactly when calculated; and, per replacing record, the comparison and flag recomputed from the lines themselves.
 */
export function scope3SupersededMemosProblem(lines: ReadonlyArray<{ kind: string; plan: { status: string | null; notes: string[] }; outcome: string; result: unknown; recordId: string; derivedFrom: unknown; supersededSpendMemo?: unknown }>): string | null {
  const groups = new Map<string, Scope3SupersededSpendMemo[]>()
  for (const line of lines) {
    if (line.supersededSpendMemo === undefined) continue  // every other line; a superseded line of a document from before round 3
    const m = line.supersededSpendMemo as Scope3SupersededSpendMemo
    const by = line.plan.notes.find(note => note.startsWith('superseded_by:'))?.slice('superseded_by:'.length)
    if (line.kind !== 'purchase_spend' || line.plan.status !== 'excluded' || !by || line.result !== null) return 'superseded memo on a line that is not a superseded spend line'
    if (!m || typeof m !== 'object' || Object.keys(m).sort().join() !== 'inputSha256,methodVersionId,reasons,replacing,resultSha256,reviewFlags,status,supersededBy,wouldBe' || m.supersededBy !== by) return 'superseded memo shape'
    if (!Array.isArray(m.reasons) || !m.reasons.every(r => typeof r === 'string') || !Array.isArray(m.reviewFlags) || !m.reviewFlags.every(f => f === SCOPE3_SUPERSEDING_REVIEW_FLAG)) return 'superseded memo shape'
    if (m.status === 'calculated' ? !(KG_TOTAL(m.wouldBe) && typeof m.methodVersionId === 'string' && SHA.test(String(m.inputSha256)) && SHA.test(String(m.resultSha256)) && m.reasons.length === 0)
      : !(m.status === 'not_calculated' && m.wouldBe === null && m.methodVersionId === null && m.inputSha256 === null && m.resultSha256 === null)) return 'superseded memo figure'
    const r = m.replacing
    if (!r || typeof r !== 'object' || Object.keys(r).sort().join() !== 'co2e,spendLines,wouldBeTotalUnrounded' || !(r.co2e === null || KG_TOTAL(r.co2e)) || !Number.isSafeInteger(r.spendLines)
      || !(r.wouldBeTotalUnrounded === null || DECIMAL.test(r.wouldBeTotalUnrounded))) return 'superseded memo replacing figure'
    groups.set(by, [...(groups.get(by) ?? []), m])
  }
  for (const [by, memos] of groups) {
    const replacing = memos[0]!.replacing.co2e?.unrounded ?? null
    const again = scope3SupersedingComparison(replacing, memos.map(m => m.wouldBe?.unrounded ?? null))
    if (memos.some(m => (m.replacing.co2e?.unrounded ?? null) !== replacing || m.replacing.spendLines !== memos.length || m.replacing.wouldBeTotalUnrounded !== again.wouldBeTotalUnrounded
      || m.reviewFlags.join() !== again.reviewFlags.join())) return `superseded memo comparison (${by})`
    const replacingLine = lines.find(line => line.recordId === by && line.derivedFrom === null && line.outcome === 'calculated')
    const total = (replacingLine?.result as { total?: Scope3KgTotal | null } | null | undefined)?.total ?? null
    if ((total?.unrounded ?? null) !== replacing) return `superseded memo replacing figure (${by})`
  }
  return null
}

/** Every new disclosure code of round 3 has its text (checked at import, like the coverage's own check). */
for (const code of SCOPE3_TAX_TREATMENT_NOTES) if (!(code in SCOPE3_DISCLOSURE_TEXT)) throw new Error(`Scope 3 disclosure has no text: ${code}`)
