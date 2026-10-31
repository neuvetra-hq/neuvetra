/**
 * Scope 3 coverage for Results, CSV and print (package 1 groundwork for AG1 and AG8; brief of 19 October, section 3).
 * Claude, 24 October 2026; revision 3, 25 October 2026.
 *
 * Every one of the 15 GHG Protocol categories is always listed with a status. A category with nothing calculated has no
 * figure, never 0; the only numbers shown are the Scope 3 engine's own aggregate subtotals (S3-14), and Scope 3 is never
 * added to the Scope 1 and 2 totals (S3-02).
 *
 * This module is browser-safe: types, constants, disclosure text and the screening reader. The coverage itself is built
 * only from verified engine output, in `scope3-engine-output.ts` (server-only), the one trusted boundary (S3A-03).
 */
import type { CollectionQuality } from './collection-contract'
import { M71_CATEGORIES } from './m71-contract'
import { SCOPE3_EXCLUDABLE_NOTES, type Scope3Category } from './scope3-collection-contract'
import { SCOPE3_EXCLUDED_REASON_CODES, SCOPE3_NOT_RELEVANT_REASON_CODES, SCOPE3_RELEVANCE_CRITERIA, type Scope3AssessmentRecord } from './scope3-assessment-contract'
import { SCOPE3_METHODS as CATALOG_METHODS, type Scope3ActivityDataOrigin, type Scope3DqIndicator, type Scope3DqRating, type Scope3MethodType } from './scope3-method-catalog'
import { CARB_PROPOSAL_TEXT } from './scope3-text'
import { SCOPE3_TAX_TREATMENT_NOTES } from './scope3-r3a'

// Scope 3 completion I-01: the method catalog and the texts moved to their own browser-safe modules (DESIGN 6.1); they
// are re-exported here unchanged so every existing import keeps working.
export { SCOPE3_FACTOR_SOURCES, SCOPE3_METHODS } from './scope3-method-catalog'
export { CARB_PROPOSAL_TEXT, SCOPE3_DISCLOSURE_TEXT, SCOPE3_STATUS_PHRASE } from './scope3-text'

export const SCOPE3_COVERAGE_PROFILE = 'neuvetra.scope3-coverage.v1' as const
export const SCOPE3_CATEGORIES = Array.from({ length: 15 }, (_, i) => i + 1)
/**
 * Categories the reviewed engine calculates. Category 3 covers 3C only (transmission and distribution losses).
 * I-03 (Scope 3 completion): categories 1 and 2 (spend-based, supplier-specific and company-entered secondary factors).
 * I-05: categories 8, 10, 13 and 14 (asset energy and partner figures; 3D joins category 3). I-07: categories 11 and 15
 * (sold products, investments), so every category has a method. Support itself comes from the method catalog
 * (`scope3CategorySupport`, I-04); the coverage test checks this list equals the catalog's.
 */
export const SCOPE3_ENGINE_CATEGORIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const
export type Scope3EngineCategory = typeof SCOPE3_ENGINE_CATEGORIES[number]
/**
 * CARB's July 2026 workshop proposed making these five mandatory from the 2027 cycle. It is a proposal in a separate
 * rulemaking, not an adopted rule; re-check CARB's own text before relying on it.
 */
export const CARB_PROPOSED_MANDATORY_CATEGORIES = [1, 3, 5, 6, 7] as const

export type Scope3ScreeningDecision = 'included' | 'excluded' | 'not_relevant'
export interface Scope3Screening { category: number; decision: Scope3ScreeningDecision; reason: string | null }

export interface Scope3Total { unrounded: string; display: string; unit: 'kg CO2e'; rounding: string }
/** One Scope 3 engine result exactly as `scope3_engine.py` returns it (`Scope3Result` in site-api). */
export interface Scope3EngineResult {
  profile: string; methodVersionId: string; profileId: string; category: number; engineSha256: string; registerSha256: string; gwpSetId: string
  input: unknown; inputSha256: string; status: 'complete' | 'input_needed' | 'review_required'; activity: Record<string, unknown>
  gases: Record<string, { mass: string; massUnit: string; co2e: string; co2eUnit: string }>
  co2eWithoutGasSplit: { co2e: string; co2eUnit: string; gwpSetId: string; reason: string } | null
  estimates: string[]; findings: string[]; conversions: unknown[]; boundary: { minimumBoundary: 'met' | 'partial'; notes: string[] }
  factorsUsed: unknown[]; constantsUsed: unknown[]; total: Scope3Total | null; resultSha256: string
  /** Optional keys (Scope 3 completion I-01, DESIGN 4.1): only on results of methods whose catalog entry declares them. */
  additionalRegisters?: Array<{ name: string; sha256: string }>
  biogenicCo2?: { mass: string; massUnit: 'kg CO2'; basis: string }
  memoItems?: Array<{ code: string; kg: string; unit: 'kg CO2e'; reportedSeparately: true }>
}
/**
 * One record's annotation for the engine aggregate (DESIGN A3, 4.6): its data-quality overrides (null = every indicator
 * uses the method default; a null indicator uses that indicator's default) and its activity-data origin (null = the
 * method default). Never part of an engine calculation input. A record without a `dataQuality` payload has both null.
 */
export interface Scope3Annotation { dataQuality: Record<Scope3DqIndicator, Scope3DqRating | null> | null; activityDataOrigin: Scope3ActivityDataOrigin | null }
export const SCOPE3_NULL_ANNOTATION: Scope3Annotation = Object.freeze({ dataQuality: null, activityDataOrigin: null }) as Scope3Annotation
/** A ratio from the engine aggregate: `value` rounded once to 12 dp, `display` rounded once from the exact quotient. */
export interface Scope3Ratio { value: string; display: string }
/** Engine aggregate v2 (DESIGN 4.6): one profile per category with at least one complete result. Sums are verified by the boundary; ratios are the engine's. */
export interface Scope3CategoryProfile {
  results: number
  subtotalTonnes: { display: string; unit: 't CO2e'; rounding: 'half_even_3dp_once' }
  methodTypes: Partial<Record<Scope3MethodType, Scope3Total>>
  dominantMethodType: Scope3MethodType
  /** Share of the category's kg CO2e whose activity data came from suppliers or other value-chain partners; null when the subtotal is 0. */
  valueChain: { numerator: Scope3Total; denominator: Scope3Total; percent: Scope3Ratio | null }
  dataQuality: {
    indicators: Record<Scope3DqIndicator, { ratingKg: Partial<Record<Scope3DqRating, Scope3Total>>; score: Scope3Ratio | null }>
    overall: { score: Scope3Ratio; label: Scope3DqRating } | { score: null; label: null }
    /** Complete results in the category with at least one indicator set by the user. */
    overrides: number
  }
  /** Biogenic CO2, reported outside the totals; null when no result in the category quantifies it. */
  biogenicCo2: (Omit<Scope3Total, 'unit'> & { unit: 'kg CO2' }) | null
  /** Memo items, reported separately and never added to any total. */
  memoItems: Record<string, Scope3Total>
  /**
   * I-05 keys (DESIGN 4.6; the engine adds them in I-05, the boundary and the decoder verify them since I-06). Optional
   * in the type only; since the wave-3 pair merge the boundary and the decoder require all three on every profile (the
   * I-05 engine always sends them; `scope3ProfileExtrasProblem`). `deflationEffect`: the sum of `nominalCo2e -
   * total` over spend and proxy results that carry a price ratio (null when none do). `shareOfKnownTotal`: the category
   * subtotal as a percent of the known-source subtotal; `largestResultShare`: the largest single result as a percent of
   * the category subtotal (each null when its denominator is 0). Both are the engine's ratios; only their form is checked.
   */
  deflationEffect?: Scope3Total | null
  shareOfKnownTotal?: Scope3Ratio | null
  largestResultShare?: Scope3Ratio | null
}
/** The Scope 3 engine's aggregate exactly as `scope3_engine.py` returns it (`Scope3Aggregate` in site-api). */
export interface Scope3EngineAggregate {
  profile: string; engineSha256: string; registerSha256: string
  categorySubtotals: Record<string, Scope3Total>; knownSourceSubtotal: Scope3Total; includedResults: string[]
  notCalculated: Array<{ resultSha256: string; category: number; status: string; findings: string[] }>
  partialBoundaryResults: Array<{ resultSha256: string; category: number; notes: string[] }>
  gwpSetSubtotals: Record<string, Scope3Total>; gwpSetsUsed: string[]; mixedGwpSets: boolean; resultCount: number
  allCalculated: boolean; complete: boolean; aggregateSha256: string
  /** Aggregate v2 (Scope 3 completion I-01): the engine's other pinned registers (none yet) and the per-category profiles. */
  additionalRegisterSha256s: Record<string, string>
  categoryProfiles: Record<string, Scope3CategoryProfile>
  /** I-12u (DESIGN 4.6): each 3C or 3D combustion result closed by its upstream result (identical input); closed results are not partial. */
  boundaryClosures: Array<{ resultSha256: string; closedBy: string }>
}
/** The engine's result profile (`ENGINE_PROFILE` in scope3_engine.py). */
export const SCOPE3_ENGINE_PROFILE = 'neuvetra.scope3-engine.v1' as const

/**
 * One saved Scope 3 record as Results decided it. The caller applies the same precedence as Scope 1 and 2 (BF2):
 * withdrawn and excluded first, then outside the reporting period, then everything else.
 */
export type Scope3RecordOutcome =
  | { outcome: 'held'; status: 'withdrawn' | 'excluded' | 'input_needed'; reasons: string[] }
  /** I-04 (DESIGN 3.4, A6, A27): designed method, factor source not loaded; `optional: true` for optional activities (hotel stays); absent or false otherwise. */
  | { outcome: 'held'; status: 'method_pending'; reasons: string[]; optional?: boolean }
  | { outcome: 'outside_period'; reasons: string[] }
  /** Sent to the engine; the result itself is taken from the verified engine output by its hash, never from the caller. */
  | { outcome: 'calculated'; resultSha256: string }
  | { outcome: 'unavailable' }
/** I-02: any of the 15 categories (a record of a kind whose method is not built yet is held, and still counted). */
export interface Scope3CoverageRecord {
  recordId: string; category: Scope3Category; quality: CollectionQuality; result: Scope3RecordOutcome
  /** I-04: the line's kind (saved or derived), for the category 3 energy-resale disclosure. Optional: absent means unknown. */
  kind?: string
  /**
   * I-07 (lane A, named field; DESIGN 5.1 "notes that become disclosures"): the line's adapter notes that are category
   * disclosures (`SCOPE3_PLAN_NOTE_DISCLOSURES`), disclosed when the line counts. Optional: absent means none.
   */
  notes?: string[]
  /**
   * Round 2 (ACC-11): whether the line has supporting evidence (at least one linked file that is neither missing nor
   * rejected; a derived line has its source record's files). Optional: absent means unknown and is not counted either way.
   */
  evidenceLinked?: boolean
}
/**
 * I-07 (DESIGN 5.1, B5(d)): adapter plan notes that become category disclosures (never holds): a category 12 record and a
 * category 11 greenhouse-gas product of the same product with all of its gas released during use; and an initial sponsor's
 * project without the projected lifetime emissions it should report separately.
 */
export const SCOPE3_PLAN_NOTE_DISCLOSURES: readonly string[] = ['same_product_in_cat11_ghg_release', 'projected_lifetime_emissions_not_provided',
  // Round 3, lane A (AC-14): each spend line's recorded tax treatment (the amount is used as recorded).
  ...SCOPE3_TAX_TREATMENT_NOTES]

export type Scope3CategoryStatus =
  | 'calculated'        // every counted record calculated and the minimum boundary met
  | 'partial_boundary'  // calculated, but the minimum boundary is not met (always so for category 3 today)
  | 'input_needed'      // at least one counted record is not calculated
  | 'no_records'        // included (or records exist but were all withdrawn, excluded, outside the period or optional and pending), nothing to calculate
  | 'awaiting_factor_source' // I-04 (A7): at least one counted line's method waits for a factor source that is not loaded; nothing needs input
  | 'excluded'          // the company excluded it, with a reason
  | 'not_relevant'      // the company screened it as not relevant, with a reason
  | 'not_screened'      // no decision and no records: unknown, never 0
  | 'review_required'   // retired in round 2 (owner decision 5): kept only so documents frozen before it still read
  | 'screening_conflict' // round 2 (owner decision 5): the company screened it out but active records exist; they stay counted
  | 'unavailable'       // the engine could not be reached for at least one record

export interface Scope3CategoryRow {
  category: number; title: string; proposedMandatory: boolean
  support: 'engine' | 'engine_partial' | 'none'
  /** Round 2 (owner decision 6): `description` is company setup's "What activity is in this category?" text of an included category (null when blank or not included). */
  screening: { decision: Scope3ScreeningDecision | 'not_screened'; reason: string | null; description: string | null }
  status: Scope3CategoryStatus
  /** Disjoint: they add up to `records`. I-04: `methodPending` (designed method, factor source not loaded) and `optionalPending` (the same, for optional activities, A27). */
  counts: { records: number; calculated: number; partialBoundary: number; inputNeeded: number; outsidePeriod: number; excluded: number; withdrawn: number; unavailable: number; methodPending: number; optionalPending: number }
  /** Data quality of the records that count toward the period (AG9). */
  quality: Record<CollectionQuality, number>
  /** The engine aggregate's subtotal for this category, or null when nothing was calculated. Never a zero for unknown. */
  subtotal: Scope3Total | null
  subtotalBasis: 'all_counted_records' | 'known_sources_only' | null
  methods: string[]; reasons: string[]; disclosures: string[]
  /** I-04 (DESIGN 3.5): the category's latest assessment for the setup's reporting year; null when none is saved or assessments are unavailable (schema below 30). */
  assessment: Scope3AssessmentRecord | null
  /** I-06 (DESIGN 4.6, 6.2): the engine aggregate's verified profile of this category; null when nothing in it is calculated. */
  profile: Scope3CategoryProfile | null
  /** I-06 (critique I-9): analytical review flags from the engine's shares (review prompts, never holds); see `scope3ReviewFlags`. */
  reviewFlags: string[]
  /** Round 2 (owner decision 9): the label shown, never better than fair while activity is not quantified; see `scope3CappedDataQualityLabel`. */
  dataQualityLabel: Scope3DataQualityLabel
  /** Round 2 (ACC-11): counted lines (calculated, held for input, pending, unavailable) without supporting evidence. */
  linesWithoutEvidence: number
}
/** Round 2 (owner decision 9): the category's data-quality label as shown, and why it was capped. */
export interface Scope3DataQualityLabel {
  label: Scope3DqRating | null
  /** The engine profile's own weighted label (null without a profile). */
  engineLabel: Scope3DqRating | null
  capped: boolean
  reasons: Array<'lines_not_quantified' | 'partial_boundary_not_documented'>
}
/**
 * Round 2 (owner decision 9): a category's data-quality label cannot be better than fair while it has held or pending
 * lines (input needed, engine-held, waiting for a factor source) or partial-boundary lines that are not documented
 * within-category exclusions. The engine's own label (verified, unchanged) is kept beside it. Round 2b integration (A27):
 * optional activities pending a factor source (hotel stays abroad) are listed and disclosed but never cap the label, as
 * they never downgrade the category's status; callers leave them out of `notQuantified`.
 */
export function scope3CappedDataQualityLabel(engineLabel: Scope3DqRating | null, notQuantified: boolean, openPartial: boolean): Scope3DataQualityLabel {
  const reasons: Scope3DataQualityLabel['reasons'] = [...(notQuantified ? ['lines_not_quantified' as const] : []), ...(openPartial ? ['partial_boundary_not_documented' as const] : [])]
  const capped = reasons.length > 0 && (engineLabel === 'very_good' || engineLabel === 'good')
  return { label: capped ? 'fair' : engineLabel, engineLabel, capped, reasons: capped ? reasons : [] }
}
export interface Scope3Coverage {
  profile: typeof SCOPE3_COVERAGE_PROFILE
  categories: Scope3CategoryRow[]
  knownSourceSubtotal: Scope3Total | null
  /** Scope 3 has its own section; it is never added to the Scope 1 and 2 totals. */
  addedToScope1And2: false
  proposedMandatory: { categories: number[]; proposal: true; adopted: false; complete: boolean; gaps: Array<{ category: number; status: Scope3CategoryStatus }>; line: string; basis: typeof CARB_PROPOSAL_TEXT }
  disclosures: Array<{ code: string; categories: number[]; text: string }>
  aggregateSha256: string | null
}

/**
 * The setup screening tokens for the 15 categories (snake case of the GHG Protocol titles, as the synthetic setup
 * fixture already uses: `business_travel`, `franchises`).
 */
export const SCOPE3_SETUP_CATEGORY_TOKENS = M71_CATEGORIES.map(title => title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))

/**
 * Company setup already stores Scope 3 screening rows (0023: scope 3, one row per category, a reason of at least three
 * characters for "no" and "not applicable"). This reads them as the coverage screening:
 * yes -> included; no ("does not apply within the proposed boundary") -> excluded with its reason;
 * not applicable -> not relevant with its reason; unknown -> not screened (no entry).
 * A Scope 3 row whose category is not one of the 15 tokens is returned in `unmatched` so it is shown, never dropped.
 */
export function scope3ScreeningFromSetup(rows: ReadonlyArray<{ scope: number; category: string; state: 'unknown' | 'yes' | 'no' | 'not_applicable'; reason: string; details?: string }>): { screening: Scope3Screening[]; unmatched: string[]; descriptions: Map<number, string> } {
  const screening: Scope3Screening[] = [], unmatched: string[] = [], descriptions = new Map<number, string>()
  for (const row of rows.filter(row => row.scope === 3)) {
    const index = SCOPE3_SETUP_CATEGORY_TOKENS.indexOf(row.category)
    if (index < 0) { unmatched.push(row.category); continue }
    if (row.state === 'unknown') continue
    screening.push(row.state === 'yes' ? { category: index + 1, decision: 'included', reason: null }
      : { category: index + 1, decision: row.state === 'no' ? 'excluded' : 'not_relevant', reason: row.reason })
    // Round 2 (owner decision 6): setup's "What activity is in this category?" text of an included category.
    if (row.state === 'yes' && typeof row.details === 'string' && row.details.trim() !== '') descriptions.set(index + 1, row.details.trim())
  }
  return { screening: validateScope3Screening(screening.sort((a, b) => a.category - b.category)), unmatched: unmatched.sort(), descriptions }
}

/** PostgreSQL `length(text)` counts characters (code points), and `btrim(text)` trims spaces only (0023's rule). */
const characters = (text: string) => [...text].length
const spaceTrimmed = (text: string) => text.replace(/^ +| +$/g, '')

/**
 * The screening contract. A reason follows company setup's own rule (0023, S3P1-T01): at most 2,000 characters, and at
 * least 3 once spaces are trimmed for an exclusion or a not-relevant decision. Nothing is truncated.
 */
export function validateScope3Screening(value: unknown): Scope3Screening[] {
  if (!Array.isArray(value) || value.length > 15) throw new Error('Scope 3 screening must list at most 15 categories.')
  const seen = new Set<number>()
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid Scope 3 screening entry.')
    const row = item as Record<string, unknown>
    if (Object.keys(row).sort().join() !== 'category,decision,reason') throw new Error('Invalid Scope 3 screening entry.')
    const category = row.category
    if (typeof category !== 'number' || !Number.isInteger(category) || category < 1 || category > 15 || seen.has(category)) throw new Error('Invalid Scope 3 screening category.')
    seen.add(category)
    if (row.decision !== 'included' && row.decision !== 'excluded' && row.decision !== 'not_relevant') throw new Error('Invalid Scope 3 screening decision.')
    const reason = row.reason
    if (row.decision === 'included' ? reason !== null : typeof reason !== 'string' || characters(spaceTrimmed(reason)) < 3 || characters(reason) > 2000)
      throw new Error('An exclusion or a not-relevant decision needs a reason of 3 to 2,000 characters; an inclusion has none.')
    return { category, decision: row.decision, reason: reason as string | null }
  })
}

// --- I-04 --- Shared status and assessment rules (DESIGN 3.5, 5.3, A26, A27). The trusted boundary, the web decoder and
// the setup screen all use these, so a category's status and warnings are decided one way everywhere.

/**
 * Whether the reviewed engine calculates anything for a category, from the method catalog: `engine` when any catalogued
 * method serves the category, else `none`. Since I-04 this no longer decides a status by itself (`not_yet_supported` is
 * retired, A7). I-12u (DESIGN 13.3): `engine_partial` (category 3 while 3A and 3B could not calculate) is retired; the type
 * keeps the token so a decoder still reads older responses.
 */
export function scope3CategorySupport(category: number): 'engine' | 'engine_partial' | 'none' {
  return Object.values(CATALOG_METHODS).some(method => method.categories.includes(category)) ? 'engine' : 'none'
}

/**
 * The boundary notes that make a result `partial` (the engine sets minimumBoundary 'partial' for these). Two of them may
 * be documented as within-category exclusions (SCOPE3_EXCLUDABLE_NOTES, A26); the others never can. A method that adds a
 * new partial note must list it here (the coverage tests check every partial result the engine gives has one).
 */
export const SCOPE3_PARTIAL_BOUNDARY_NOTES: readonly string[] = [
  'combustion_only_upstream_of_lost_energy_excluded', 'third_party_facilities_not_assessed', 'hybrid_upstream_missing', ...SCOPE3_EXCLUDABLE_NOTES,
  // I-05 (lane A): category 3D counts the combustion of the resold electricity only until its upstream line is loaded (A28).
  'upstream_of_resold_energy_excluded',
  // I-12u (lane A; DESIGN 13.2): an upstream electricity line whose subregion burns a fossil fuel without a verified upstream factor.
  'fossil_fuel_upstream_not_mapped',
  // Round 2, lane A (ACC-14): an upstream electricity line whose subregion burns eGRID "other fuel" (OTHF), not assumed fossil.
  'other_fuel_upstream_not_mapped',
  // Round 2, lane F (DESIGN 13.6): coal heat input counted for mine methane only (mining energy and transport CO2 not included); never excludable.
  'coal_upstream_mine_methane_only',
  // Round 3, lane A (AC-6): gas co-fired at solar-thermal plants (eGRID SOLAR heat input) is fossil without an upstream term; never excludable.
  'solar_thermal_cofiring_upstream_not_counted',
]
/**
 * A26: a partial result is closed by documentation when it carries at least one partial note and every partial note it
 * carries is an allow-listed note the category's assessment documents. The line itself stays partial (its counts and the
 * CSV say so); only the category status may become `calculated`, with the disclosure `within_category_exclusion_documented`.
 */
export function scope3PartialResultDocumented(notes: readonly string[], assessment: Pick<Scope3AssessmentRecord, 'withinCategoryExclusions'> | null): boolean {
  if (!assessment) return false
  const documented = new Set<string>(assessment.withinCategoryExclusions.map(exclusion => exclusion.noteCode))
  const partial = notes.filter(note => SCOPE3_PARTIAL_BOUNDARY_NOTES.includes(note))
  return partial.length > 0 && partial.every(note => (SCOPE3_EXCLUDABLE_NOTES as readonly string[]).includes(note) && documented.has(note))
}

export type Scope3SetupDecision = Scope3ScreeningDecision | 'not_screened'
/**
 * DESIGN 3.5: the disclosures an assessment (or its absence) gives for a category with this setup decision. Disclosures,
 * never gates (D11). A reason code given for the other decision is disclosed too (the decision lives in setup and can
 * change after the assessment was saved).
 */
export function scope3AssessmentDisclosures(decision: Scope3SetupDecision, assessment: Pick<Scope3AssessmentRecord, 'reasonCode' | 'criteria' | 'magnitudeKind' | 'activitiesIncluded'> | null, setupDescription: string | null = null): string[] {
  const codes: string[] = []
  if (decision === 'excluded') {
    if (!assessment || !SCOPE3_RELEVANCE_CRITERIA.some(name => assessment.criteria[name])) codes.push('exclusion_without_relevance_criteria')
    if (!assessment || assessment.magnitudeKind === null) codes.push('exclusion_without_magnitude')
    if (!assessment || assessment.reasonCode === null) codes.push('exclusion_without_reason_code')
    else if (!(SCOPE3_EXCLUDED_REASON_CODES as readonly string[]).includes(assessment.reasonCode)) codes.push('assessment_reason_code_not_for_decision')
  } else if (decision === 'not_relevant') {
    if (!assessment || assessment.reasonCode === null) codes.push('not_applicable_without_reason_code')
    else if (!(SCOPE3_NOT_RELEVANT_REASON_CODES as readonly string[]).includes(assessment.reasonCode)) codes.push('assessment_reason_code_not_for_decision')
  } else if (decision === 'included') {
    // Round 2 (owner decision 6): setup's description or the assessment's satisfies the rule.
    if ((!assessment || assessment.activitiesIncluded.trim() === '') && !(setupDescription ?? '').trim()) codes.push('included_activities_not_described')
  }
  return codes
}

/** The downstream categories the Scope 3 Standard (section 6.4) lets a company exclude together for intermediate products with unknown end use. */
export const SCOPE3_DOWNSTREAM_JOINT_CATEGORIES = [9, 10, 11, 12] as const
/**
 * DESIGN 3.5, the 9-12 joint rule (Std section 6.4: "should not selectively exclude a subset of those categories"): true
 * when at least one of categories 9 to 12 is excluded with the reason `intermediate_unknown_end_use` and not all four are.
 */
export function scope3SelectiveDownstreamExclusion(decisionOf: (category: number) => Scope3SetupDecision, assessmentOf: (category: number) => Pick<Scope3AssessmentRecord, 'reasonCode'> | null): boolean {
  const uses = (category: number) => decisionOf(category) === 'excluded' && assessmentOf(category)?.reasonCode === 'intermediate_unknown_end_use'
  return SCOPE3_DOWNSTREAM_JOINT_CATEGORIES.some(uses) && !SCOPE3_DOWNSTREAM_JOINT_CATEGORIES.every(uses)
}
