/**
 * The generated Scope 3 methodology statement, the exclusion register and the total statement (Scope 3 completion I-06;
 * DESIGN 6.2-6.4, D5, D7; assurance-ux M1, M6, M9). Browser-safe.
 *
 * Every sentence is a fixed text from `scope3-text.ts` filled only from structured fields of the results response: the
 * category row (screening, assessment, the engine's verified profile, disclosures, review flags) and its lines (states,
 * engine results, the method catalog). No free text is written here, nothing is calculated, and the same function runs in
 * the results route (which sends the statement) and the web decoder (which refuses a statement it would not write).
 * Generic over methods: methods, factor sources, GWP sets, biogenic treatment and uncertainty come from the catalog and the
 * results, so a method added to the engine and the catalog appears here without a change.
 */
import { SCOPE3_RELEVANCE_CRITERIA } from './scope3-assessment-contract'
import { scope3CappedDataQualityLabel, scope3PartialResultDocumented, type Scope3CategoryRow, type Scope3CategoryStatus, type Scope3DataQualityLabel } from './scope3-coverage'
import { SCOPE3_DQ_INDICATORS, SCOPE3_METHODS } from './scope3-method-catalog'
import {
  SCOPE3_ASSESSMENT_REASON_TEXT, SCOPE3_BASE_YEAR_TEXT, SCOPE3_DISCLOSURE_TEXT, SCOPE3_DQ_INDICATOR_TEXT, SCOPE3_DQ_LABEL_CONVENTION, SCOPE3_DQ_RATING_TEXT, SCOPE3_ENERGY_RESALE_NONE_TEXT,
  SCOPE3_EXCLUDABLE_NOTE_TEXT, SCOPE3_GWP_SET_TEXT, SCOPE3_KNOWN_LIMITATION_TEXT, SCOPE3_METHOD_TYPE_TEXT, SCOPE3_METHODOLOGY_TEXT as T, SCOPE3_RELEVANCE_CRITERIA_TEXT, SCOPE3_REVIEW_FLAG_TEXT,
  SCOPE3_STATUS_TEXT, SCOPE3_TOTAL_TEXT, SCOPE3_UNCERTAINTY_TEXT, SCOPE3_METHODOLOGY_TEXT_R2B, SCOPE3_DQ_CAP_REASON_TEXT, SCOPE3_METHODOLOGY_TEXT_R2A,
  SCOPE3_METHODOLOGY_TEXT_R3A,
} from './scope3-text'
import { scope3DecimalDifference, SCOPE3_TAX_TREATMENT_NOTES } from './scope3-r3a'
import { scope3ClosedLines, scope3FactorSourceById, scope3LineEvidenceLinked, scope3LineState, scope3SupersededBy, type Scope3MethodologySentence, type Scope3ResultsLine } from './scope3-trace'
import { SCOPE3_UNCERTAINTY_TEXT_R2E } from './scope3-text-r2e'
import { scope3GroupDecimal as group, SCOPE3_REPORT_TEXT_V3 } from './scope3-text-v3'
import { scope3VisibleReviewFlags } from './scope3-trace'

type Row = Omit<Scope3CategoryRow, never>
type Line = Pick<Scope3ResultsLine, 'category' | 'plan' | 'outcome' | 'result' | 'payload' | 'derivedFrom' | 'supersededSpendMemo'>

const unique = <T,>(items: readonly T[]) => [...new Set(items)]

/**
 * Round 2 (ACC-11, owner decision 9): a category's lines without supporting evidence and its data-quality label shown,
 * from its lines (the web decoder checks the boundary's values against these): counted lines (calculated, partial, held
 * for input, pending, unavailable) without a usable evidence file; the engine's label capped at fair while lines are held
 * or pending (optional pending lines excepted, A27) or a partial line is not a documented within-category exclusion.
 */
export function scope3CategoryEvidenceAndQuality<L extends Pick<Scope3ResultsLine, 'category' | 'plan' | 'outcome' | 'result' | 'evidence'>>(row: Pick<Scope3CategoryRow, 'category' | 'profile' | 'assessment'>, lines: readonly L[],
  /** The response's closed lines (`scope3ClosedLines(lines)`), when the caller has them already. */
  closedLines?: ReadonlySet<L>): { linesWithoutEvidence: number; dataQualityLabel: Scope3DataQualityLabel } {
  const closed = closedLines ?? scope3ClosedLines(lines)
  const mine = lines.filter(line => line.category === row.category)
  const states = mine.map(line => scope3LineState(line, closed.has(line)))
  const counted = mine.filter((_, i) => ['calculated', 'partialBoundary', 'inputNeeded', 'methodPending', 'optionalPending', 'unavailable'].includes(states[i]!))
  // Round 2b integration (A27 over decision 9): an optional activity pending a factor source does not cap the label.
  const notQuantified = states.some(state => state === 'inputNeeded' || state === 'methodPending')
  const openPartial = mine.some((line, i) => states[i] === 'partialBoundary' && !scope3PartialResultDocumented(line.result!.boundary.notes, row.assessment))
  return { linesWithoutEvidence: counted.filter(line => !scope3LineEvidenceLinked(line)).length, dataQualityLabel: scope3CappedDataQualityLabel(row.profile?.dataQuality.overall.label ?? null, notQuantified, openPartial) }
}
/** The relevance criteria an assessment ticks, as words (Table 6.1), with the company's own "other" text. */
export function scope3CriteriaLabels(criteria: NonNullable<Row['assessment']>['criteria']): string[] {
  return SCOPE3_RELEVANCE_CRITERIA.filter(name => criteria[name]).map(name => name === 'other' && criteria.otherText.trim() ? `${SCOPE3_RELEVANCE_CRITERIA_TEXT.other.label} (${criteria.otherText.trim()})` : SCOPE3_RELEVANCE_CRITERIA_TEXT[name].label)
}
const GWP_BASIS = /_gwp_basis_(ar4|ar5|ar6|unknown)$/
const BASIS_WORDS: Record<string, string> = { ar4: 'AR4', ar5: 'AR5', ar6: 'AR6', unknown: 'not stated' }

/**
 * DESIGN 6.4: the methodology statement of one category, in topic order. Included categories and categories with records:
 * activities, methods, factor sources and price year, GWP sets, allocation, assumptions and limitations, data quality,
 * the value-chain share, biogenic CO2, qualitative uncertainty, time boundary, what is not counted, base year and the
 * beta limitation, review flags. Excluded or not-applicable categories: the decision, reason code, criteria,
 * justification, magnitude and evidence. Not screened with no records: one sentence. `lines` may be every line of the
 * response; only this category's are read.
 */
export function scope3MethodologyStatement(row: Row, lines: readonly Line[], categories: readonly Pick<Row, 'subtotal'>[] = [row]): Scope3MethodologySentence[] {
  const out: Scope3MethodologySentence[] = []
  const say = (topic: string, text: string) => { out.push({ topic, text }) }
  const mine = lines.filter(line => line.category === row.category)
  // I-12u: a 3C/3D combustion line closed by its upstream line is calculated (the engine aggregate's boundaryClosures).
  const closed = scope3ClosedLines(lines)
  const states = mine.map(line => scope3LineState(line, closed.has(line)))
  const counted = states.filter(state => state !== 'withdrawn' && state !== 'excluded' && state !== 'outsidePeriod').length
  const assessment = row.assessment
  const decision = row.screening.decision

  if (decision === 'excluded' || decision === 'not_relevant') {
    say('decision', `Screening decision: ${SCOPE3_REPORT_TEXT_V3.screening[decision]}.${row.screening.reason ? ` ${row.screening.reason}` : ''}`)
    if (!assessment) say('decision', T.noAssessment)
    else {
      if (assessment.reasonCode) say('decision', T.reasonCode(SCOPE3_ASSESSMENT_REASON_TEXT[assessment.reasonCode] ?? assessment.reasonCode))
      say('decision', T.criteria(scope3CriteriaLabels(assessment.criteria)))
      if (assessment.justification.trim()) say('decision', T.justification(assessment.justification.trim()))
      if (assessment.magnitudeKind === 'estimated' && assessment.magnitudeTCo2e !== null) say('decision', T.magnitudeEstimated(group(assessment.magnitudeTCo2e), assessment.magnitudeBasis.trim()))
      else if (assessment.magnitudeKind === 'not_quantifiable') say('decision', T.magnitudeNotQuantifiable(assessment.notQuantifiableReason.trim()))
      else say('decision', T.magnitudeMissing)
      if (assessment.evidenceIds.length) say('decision', T.evidence(assessment.evidenceIds.length))
    }
    // Round 2 (owner decision 5): records in a screened-out category are a screening conflict; they stay counted.
    if (counted > 0) say('review', SCOPE3_REPORT_TEXT_V3.screeningConflict)
    return out
  }
  if (decision === 'not_screened' && mine.length === 0) return [{ topic: 'decision', text: T.notScreened }]

  // 1. Activities included.
  // Round 2 (owner decision 6): the assessment's description, else company setup's, else none.
  const setupDescription = row.screening.description?.trim() ?? ''
  say('activities', assessment && assessment.activitiesIncluded.trim() ? T.activities(assessment.activitiesIncluded.trim()) : setupDescription ? SCOPE3_METHODOLOGY_TEXT_R2B.activitiesFromSetup(setupDescription) : T.activitiesMissing)
  if (mine.length === 0) say('activities', T.noRecords)
  const complete = mine.filter((_, i) => states[i] === 'calculated' || states[i] === 'partialBoundary').map(line => line.result!)
  // 2. Methods (every method that produced a result here, calculated or not), titles and types from the catalog.
  if (mine.length > 0 && row.methods.length === 0) say('method', T.noMethod)
  for (const id of row.methods) {
    const method = SCOPE3_METHODS[id]
    say('method', T.method(method?.title ?? id, method ? SCOPE3_METHOD_TYPE_TEXT[method.methodType] : 'method type unknown', id))
  }
  // 3. Factor sources with edition and geography (catalog), and the price year of spend.
  for (const sourceId of unique(row.methods.flatMap(id => [...(SCOPE3_METHODS[id]?.factorSourceIds ?? [])]))) say('factor_source', T.factorSource(scope3FactorSourceById(sourceId)?.text ?? sourceId))
  const activityOf = (r: (typeof complete)[number]) => (r.activity ?? {}) as Record<string, unknown>
  const priced = complete.filter(r => typeof activityOf(r).dollarYear === 'number')
  const deflatedYears = unique(priced.filter(r => typeof activityOf(r).priceRatio === 'string').map(r => activityOf(r).dollarYear as number)).sort((a, b) => a - b)
  if (deflatedYears.length) say('price_year', T.priceYearDeflated(deflatedYears))
  if (priced.some(r => typeof activityOf(r).priceRatio !== 'string')) say('price_year', T.priceYearBase)
  if (row.profile?.deflationEffect) say('price_year', T.deflationEffect(group(row.profile.deflationEffect.display)))
  // 4. GWP sets, and the bases suppliers or partners declared for reported CO2e.
  for (const set of unique(complete.map(r => r.gwpSetId)).sort()) say('gwp', T.gwpSet(SCOPE3_GWP_SET_TEXT[set] ?? set))
  const bases = unique(complete.flatMap(r => r.boundary.notes.flatMap(note => { const m = GWP_BASIS.exec(note); return m ? [BASIS_WORDS[m[1]!]!] : [] }))).sort()
  if (bases.length) say('gwp', T.declaredGwpBases(bases))
  // 5. Allocation of supplier or partner totals (the saved payload's allocation basis of each calculated record).
  const allocations = unique(mine.filter((_, i) => states[i] === 'calculated' || states[i] === 'partialBoundary').flatMap(line => {
    const basis = line.derivedFrom === null && line.payload && typeof line.payload === 'object' ? (line.payload as Record<string, unknown>).allocationBasis : null
    return typeof basis === 'string' && basis ? [basis.replace(/_/g, ' ')] : []
  })).sort()
  if (allocations.length) say('allocation', T.allocation(allocations))
  // Round 3, lane A (AC-14): the recorded tax treatment of the category's counted spend lines (their line notes).
  const taxed = mine.filter((line, i) => line.plan.notes.some(note => (SCOPE3_TAX_TREATMENT_NOTES as readonly string[]).includes(note)) && states[i] !== 'withdrawn' && states[i] !== 'excluded' && states[i] !== 'outsidePeriod')
  if (taxed.length) {
    const n = (note: string) => taxed.filter(line => line.plan.notes.includes(note)).length
    const [excludes, includes, unknown] = SCOPE3_TAX_TREATMENT_NOTES.map(n)
    say('assumption', SCOPE3_METHODOLOGY_TEXT_R3A.taxTreatment({ includes_sales_tax: includes!, excludes_sales_tax: excludes!, unknown: unknown! }))
  }
  // 6. Assumptions and limitations: every disclosure of the category, in code order (`factor_data_years` is the factor
  // editions, already stated method by method under topic factor_source).
  for (const code of row.disclosures) if (code !== 'factor_data_years') say('assumption', T.assumption(SCOPE3_DISCLOSURE_TEXT[code] ?? code))
  // I-12u (DESIGN 13.2, 13.3): per region, the engine's share of fossil heat input with a verified upstream factor, as given (12 dp).
  const shares = unique(complete.flatMap(r => {
    const a = activityOf(r)
    if (typeof a.mappedFossilHeatInputShare !== 'string' || !Array.isArray(a.mappedFuels) || !Array.isArray(a.unmappedFuels)) return []
    // Round 2 (owner decision 2): the share not mapped and the other fuels, when the engine gives them. Round 3 (owner decision
    // 2, AC-1): coal apart from the fully counted fuels (coal mine methane only), with its own share; never "covered".
    return [JSON.stringify([typeof a.subregion === 'string' ? a.subregion : 'U.S. average', a.mappedFossilHeatInputShare, a.mappedFuels, a.unmappedFuels,
      typeof a.unmappedFossilHeatInputShare === 'string' ? a.unmappedFossilHeatInputShare : null, Array.isArray(a.otherFuelsNotMapped) ? a.otherFuelsNotMapped : [],
      typeof a.coalHeatInputShare === 'string' && (a.mappedFuels as string[]).includes('COAL') ? a.coalHeatInputShare : null])]
  })).sort().map(text => JSON.parse(text) as [string, string, string[], string[], string | null, string[], string | null])
  for (const [region, share, mapped, unmapped, unmappedShare, other, coal] of shares)
    say('assumption', SCOPE3_METHODOLOGY_TEXT_R3A.upstreamShares(region, mapped.filter(fuel => fuel !== 'COAL'), coal === null ? share : scope3DecimalDifference(share, coal), coal, unmapped, unmappedShare, other))
  if (shares.some(([, , , unmapped]) => unmapped.includes('COAL'))) say('assumption', SCOPE3_METHODOLOGY_TEXT_R2A.coalNotQuantified)
  if (shares.some(([, , mapped]) => mapped.includes('COAL'))) say('assumption', SCOPE3_METHODOLOGY_TEXT_R2A.coalMethaneOnly)  // round 2, lane F (DESIGN 13.6)
  // 7-8. Data quality and the share from supplier or value-chain data (the engine's profile).
  const profile = row.profile
  if (profile) {
    const scores = SCOPE3_DQ_INDICATORS.map(name => `${SCOPE3_DQ_INDICATOR_TEXT[name]!.label} ${profile.dataQuality.indicators[name].score?.display ?? '—'}`).join(', ')
    say('data_quality', T.dataQuality(scores, row.dataQualityLabel.label ? SCOPE3_DQ_RATING_TEXT[row.dataQualityLabel.label]! : '—', profile.dataQuality.overall.score?.display ?? '—'))
    say('data_quality', T.dataQualityOverrides(profile.dataQuality.overrides, profile.results))
    say('data_quality', SCOPE3_DQ_LABEL_CONVENTION)
    // Round 2 (owner decision 9): the label shown is capped at fair while activity is not quantified; say why.
    const shown = row.dataQualityLabel
    if (shown.capped) say('data_quality', `Data-quality label shown: fair (capped) because ${shown.reasons.map(code => SCOPE3_DQ_CAP_REASON_TEXT[code]!).join(' and ')}. The numerical weighted scores are unchanged.`)
    say('value_chain', profile.valueChain.percent ? T.valueChain(profile.valueChain.percent.display) : T.valueChainNone)
  } else {
    say('data_quality', T.dataQualityNone)
    say('value_chain', T.valueChainNone)
  }
  // Round 2 (ACC-11): counted lines without supporting evidence.
  if (row.linesWithoutEvidence > 0) say('data_quality', SCOPE3_METHODOLOGY_TEXT_R2B.linesWithoutEvidence(row.linesWithoutEvidence, counted))
  // 9. Biogenic CO2: quantified and outside totals, or the treatment of each method's factors.
  if (profile?.biogenicCo2) say('biogenic', T.biogenicQuantified(group(profile.biogenicCo2.display)))
  else for (const treatment of unique(row.methods.flatMap(id => SCOPE3_METHODS[id] ? [SCOPE3_METHODS[id]!.biogenicTreatment] : [])).sort()) say('biogenic', T.biogenic[treatment] ?? treatment)
  // 10. Qualitative uncertainty from the dominant method type. Round 2 lane E (ACC-6): then the published confidence
  // intervals of the factors used where a source prints one (NETL natural gas supply chain), and the explanation CARB
  // proposes when uncertainty is not quantified (SB 253 workshop, 21 July 2026, slide 14).
  if (profile) {
    say('uncertainty', SCOPE3_UNCERTAINTY_TEXT[profile.dominantMethodType])
    const used = JSON.stringify(complete.map(r => [r.factorsUsed, r.constantsUsed]))
    if (/prod_through_distribution|ng_upstream_distribution/.test(used)) say('uncertainty', SCOPE3_UNCERTAINTY_TEXT_R2E.netlDistribution)
    if (/prod_through_transmission|ng_upstream_transmission/.test(used)) say('uncertainty', SCOPE3_UNCERTAINTY_TEXT_R2E.netlTransmission)
    say('uncertainty', SCOPE3_UNCERTAINTY_TEXT_R2E.notQuantified)
  }
  // 11. Time boundary, and memo items reported separately.
  if (row.category === 11) say('time_boundary', T.timeBoundary11)
  if (row.category === 15) say('time_boundary', T.timeBoundary15)
  // Round 3, lane A (owner decisions 2 and 3): the coal screening range as one sentence, and the end-of-life charge as an upper bound.
  const memo = profile?.memoItems ?? {}
  const low = memo.coal_upstream_omitted_screening_low, high = memo.coal_upstream_omitted_screening_high
  if (low && high) say('assumption', SCOPE3_METHODOLOGY_TEXT_R3A.coalScreeningRange(group(low.display), group(high.display)))
  for (const [code, kg] of Object.entries(memo).sort(([a], [b]) => a.localeCompare(b))) {
    if (low && high && (code === 'coal_upstream_omitted_screening_low' || code === 'coal_upstream_omitted_screening_high')) continue
    say('time_boundary', code === 'ghg_product_end_of_life_remaining_charge' ? SCOPE3_METHODOLOGY_TEXT_R3A.endOfLifeCharge(group(kg.display)) : T.memoItem(code, group(kg.display)))
  }
  for (const line of mine) {
    const m = line.supersededSpendMemo
    if (!m || (row.category !== 1 && row.category !== 2)) continue
    say('memo', `Superseded spend-based EEIO memo: ${m.wouldBe ? `${group(m.wouldBe.display)} kg CO2e would have been calculated` : 'no would-be figure could be calculated'}; outside every total. Replacing record ${m.supersededBy}: ${m.replacing.co2e ? `${group(m.replacing.co2e.display)} kg CO2e` : 'no calculated figure'}. ${m.replacing.wouldBeTotalUnrounded !== null ? `Compared with ${group(m.replacing.wouldBeTotalUnrounded)} kg CO2e from ${m.replacing.spendLines} replaced spend line(s). ${m.reviewFlags.length ? 'Review the replacing figure: it is outside the 10% to 10-times comparison range.' : 'The replacing figure is within the 10% to 10-times comparison range.'}` : 'No complete comparison is available.'}`)
  }
  // 12. What is not counted: held lines by state, documented within-category exclusions, and 3D when not applicable.
  const count = (state: string) => states.filter(item => item === state).length
  const superseded = mine.filter((line, i) => states[i] === 'excluded' && scope3SupersededBy(line) !== null).length
  const held: Array<[number, string]> = [[count('inputNeeded'), 'inputNeeded'], [count('methodPending'), 'methodPending'], [count('optionalPending'), 'optionalPending'], [superseded, 'superseded'],
    // Round 2 (owner decision 10): withdrawn records are counted, not listed as lines.
    [count('excluded') - superseded, 'excluded'], [row.counts.withdrawn, 'withdrawn'], [count('outsidePeriod'), 'outsidePeriod'], [count('unavailable'), 'unavailable']]
  for (const [n, key] of held) if (n > 0) say('exclusion', T.heldCount(n, T.held[key]!))
  if (counted > 0 && held.every(([n]) => n === 0)) say('exclusion', T.nothingHeld)
  for (const exclusion of assessment?.withinCategoryExclusions ?? []) {
    const note = SCOPE3_EXCLUDABLE_NOTE_TEXT[exclusion.noteCode] ?? exclusion.noteCode
    say('exclusion', exclusion.magnitudeKind === 'estimated' && exclusion.magnitudeTCo2e !== null
      ? T.withinCategoryEstimated(note, exclusion.justification.trim(), group(exclusion.magnitudeTCo2e), exclusion.basis.trim())
      : T.withinCategoryNotQuantifiable(note, exclusion.justification.trim(), exclusion.basis.trim()))
  }
  if (row.category === 3 && assessment?.energyResale === 'none') say('exclusion', SCOPE3_ENERGY_RESALE_NONE_TEXT)
  // 13. Base year and the stated beta limitation; then the analytical review flags.
  say('base_year', SCOPE3_BASE_YEAR_TEXT)
  say('limitation', SCOPE3_KNOWN_LIMITATION_TEXT)
  if (row.category === 3) say('limitation', SCOPE3_METHODOLOGY_TEXT_R2A.scope12LaterPeriods)  // round 2, owner decision 1
  if (row.category === 10) say('limitation', SCOPE3_REPORT_TEXT_V3.processingPartnerDataOnly)
  for (const flag of scope3VisibleReviewFlags(row, categories)) say('review', SCOPE3_REVIEW_FLAG_TEXT[flag] ?? flag)
  return out
}

/** One entry of the exclusion register (DESIGN 6.2, 6.3 section 7; assurance-ux M1). Magnitudes are user statements, never added to any total. */
export interface Scope3ExclusionEntry {
  category: number; title: string
  /** `category`: the category is excluded or not applicable; `within_category`: a documented exclusion inside an included category (A26). */
  level: 'category' | 'within_category'
  decision: 'excluded' | 'not_relevant' | 'included' | 'not_screened'
  reasonCode: string | null; noteCode: string | null; criteria: string[]; justification: string
  magnitudeKind: 'estimated' | 'not_quantifiable' | null; magnitudeTCo2e: string | null; magnitudeBasis: string
  evidenceIds: string[]
}
/** The exclusion register: every excluded or not-applicable category, then every documented exclusion within a category. */
export function scope3ExclusionRegister(categories: readonly Row[]): Scope3ExclusionEntry[] {
  const out: Scope3ExclusionEntry[] = []
  for (const row of categories) {
    const decision = row.screening.decision, a = row.assessment
    // Round 2 (owner decision 5): a screening conflict (records in a screened-out category, still counted) is not listed as excluded.
    if ((decision === 'excluded' || decision === 'not_relevant') && row.status !== 'screening_conflict') out.push({
      category: row.category, title: row.title, level: 'category', decision, reasonCode: a?.reasonCode ?? null, noteCode: null, criteria: a ? scope3CriteriaLabels(a.criteria) : [],
      justification: a?.justification.trim() || row.screening.reason || '', magnitudeKind: a?.magnitudeKind ?? null, magnitudeTCo2e: a?.magnitudeKind === 'estimated' ? a.magnitudeTCo2e : null,
      magnitudeBasis: a?.magnitudeKind === 'estimated' ? a.magnitudeBasis.trim() : a?.magnitudeKind === 'not_quantifiable' ? a.notQuantifiableReason.trim() : '', evidenceIds: a ? [...a.evidenceIds] : [],
    })
  }
  for (const row of categories) for (const x of row.assessment?.withinCategoryExclusions ?? []) out.push({
    category: row.category, title: row.title, level: 'within_category', decision: row.screening.decision, reasonCode: null, noteCode: x.noteCode, criteria: [],
    justification: x.justification.trim(), magnitudeKind: x.magnitudeKind, magnitudeTCo2e: x.magnitudeKind === 'estimated' ? x.magnitudeTCo2e : null, magnitudeBasis: x.basis.trim(), evidenceIds: [],
  })
  return out
}

/**
 * The total line (assurance-ux M9): the known-source total is labelled "known sources only" until every category is
 * calculated, excluded or not applicable, and names the categories it includes (those with a figure) and leaves out.
 */
export function scope3TotalStatement(categories: readonly Pick<Row, 'category' | 'status' | 'subtotal'>[]): { basis: 'known_sources_only' | 'all_relevant_calculated'; label: string; includes: number[]; excludes: Array<{ category: number; status: Scope3CategoryStatus }>; lines: string[] } {
  const complete = categories.every(row => row.status === 'calculated' || row.status === 'excluded' || row.status === 'not_relevant')
  const includes = categories.filter(row => row.subtotal !== null).map(row => row.category)
  const excludes = categories.filter(row => row.subtotal === null).map(row => ({ category: row.category, status: row.status }))
  const label = complete ? SCOPE3_TOTAL_TEXT.allRelevantCalculated : SCOPE3_TOTAL_TEXT.knownSourcesOnly
  return {
    basis: complete ? 'all_relevant_calculated' : 'known_sources_only', label, includes, excludes,
    lines: [SCOPE3_TOTAL_TEXT.includes(includes), SCOPE3_TOTAL_TEXT.excludes(excludes.map(item => `category ${item.category} (${(SCOPE3_REPORT_TEXT_V3.status[item.status] ?? SCOPE3_STATUS_TEXT[item.status]).toLowerCase()})`))],
  }
}
