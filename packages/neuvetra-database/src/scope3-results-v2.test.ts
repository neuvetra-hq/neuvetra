// Scope 3 completion I-06 (DESIGN 4.6, 5.1 notes, 6.2-6.4; assurance-ux M1, M6, M9): the trusted boundary's results v2
// (profiles and review flags on category rows, the I-05 profile keys verified by exact re-sums and ratio forms, the two
// category disclosures and the mixed-GWP wording), and the generated methodology statement, exclusion register and total
// line. Engine results come from the real Scope 3 engine; expected figures are independent BigInt arithmetic.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from './method-reference'
import type { Scope3CoverageRecord, Scope3EngineAggregate, Scope3EngineResult, Scope3Screening } from './scope3-coverage'
import { scope3Coverage, scope3Digest, type Scope3AggregateEngine, type Scope3Pins } from './scope3-engine-output'
import { scope3ExclusionRegister, scope3MethodologyStatement, scope3TotalStatement } from './scope3-methodology'
import { SCOPE3_UNCERTAINTY_TEXT_R2E } from './scope3-text-r2e'
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_METHODOLOGY_TEXT, SCOPE3_UNCERTAINTY_TEXT } from './scope3-text'
import { scope3EffectiveDataQuality, scope3ProfileExtrasProblem, scope3ReviewFlags, type Scope3ResultsLine } from './scope3-trace'
import { fixtureAssessmentRecord } from './scope3-payload-fixtures'
import type { Scope3AssessmentRecord } from './scope3-assessment-contract'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function run(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; result?: Scope3EngineResult; aggregate?: Scope3EngineAggregate }
}
const pins: Scope3Pins = { engineSha256: createHash('sha256').update(readFileSync(ENGINE)).digest('hex'), registerSha256: SCOPE3_REGISTER_2025_SHA256, additionalRegisterSha256s: { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } }
const realEngine: Scope3AggregateEngine = { aggregate: async (results, annotations) => { const out = run({ action: 'aggregate', results, annotations }); if (out.status !== 'ok') throw new Error(`refused: ${out.code}`); return out.aggregate! } }
/** The real engine's aggregate, edited and re-hashed as an engine that sent these fields would (the boundary's own checks still apply). */
const edited = (edit: (aggregate: Scope3EngineAggregate) => void): Scope3AggregateEngine => ({ aggregate: async (results, annotations) => {
  const aggregate = structuredClone(await realEngine.aggregate(results, annotations)) as Scope3EngineAggregate & { aggregateSha256: string }
  edit(aggregate)
  const { aggregateSha256: _old, ...body } = aggregate
  return { ...body, aggregateSha256: scope3Digest(body) } as Scope3EngineAggregate
} })
const TIMEOUT = 120_000
const period = { start: '2025-01-01', endExclusive: '2026-01-01' }
const calc = (request: unknown) => { const out = run({ action: 'calculate', request }); expect(out.status).toBe('ok'); return out.result! }
const spend = (category: number, amount: string, edits: Record<string, unknown> = {}) => calc({ kind: 'purchase_spend', input: { period, category, naicsCode: '541511', amount, currency: 'USD', dollarYear: 2024, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: category === 2 ? true : null, ...edits } })
const supplier = (category: number, quantity: string) => calc({ kind: 'purchase_supplier', input: { period, category, factorOrigin: 'supplier_primary', basis: 'allocated_total', quantity, unit: 'kg CO2e', factorValue: null, factorUnit: null,
  allocationNumerator: null, allocationDenominator: null, boundary: 'cradle_to_gate', hybridUpstreamCoveredBy: null, gwpBasis: 'AR5', verification: 'third_party_verified' } })
const rail = (amount: string) => calc({ kind: 'transport', input: { period, category: 4, vehicle: 'rail', loadBasis: 'shared_vehicle', activity: { value: amount, unit: 'short ton-mile' }, thirdPartyFacilities: 'none' } })
const waste = () => calc({ kind: 'waste', input: { period, category: 5, material: 'mixed_msw', treatment: 'landfilled', quantity: '850', unit: 'kg' } })
let n = 0
const id = () => `95100000-0000-4000-8000-${String(++n).padStart(12, '0')}`
const calculated = (result: Scope3EngineResult, kind: string): Scope3CoverageRecord => ({ recordId: id(), category: result.category as never, quality: 'actual', kind, result: { outcome: 'calculated', resultSha256: result.resultSha256 } })
const heldIn = (category: number, kind: string): Scope3CoverageRecord => ({ recordId: id(), category: category as never, quality: 'actual', kind, result: { outcome: 'held', status: 'input_needed', reasons: ['quantity_not_calculable'] } })
const cover = (records: Scope3CoverageRecord[], results: Scope3EngineResult[], screening: Scope3Screening[] = [], engine = realEngine, assessments: Scope3AssessmentRecord[] | null = null) =>
  scope3Coverage(records, screening, results, engine, pins, undefined, assessments)

// Exact rationals (independent of the code under test).
type Q = { n: bigint; d: bigint }
const dec = (text: string): Q => { const negative = text.startsWith('-'), [i, f = ''] = (negative ? text.slice(1) : text).split('.'); return { n: (negative ? -1n : 1n) * BigInt(i! + f), d: 10n ** BigInt(f.length) } }
const add = (a: Q, b: Q): Q => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d })
const sub = (a: Q, b: Q): Q => add(a, { n: -b.n, d: b.d })
function roundHalfEven(q: Q, places: number): bigint {
  const scaled = q.n * 10n ** BigInt(places), negative = scaled < 0n, magnitude = negative ? -scaled : scaled
  let units = magnitude / q.d
  const twice = 2n * (magnitude % q.d)
  if (twice > q.d || (twice === q.d && units % 2n === 1n)) units += 1n
  return negative ? -units : units
}
const fixed = (units: bigint, places: number) => { const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(places + 1, '0'); return `${negative ? '-' : ''}${digits.slice(0, -places)}.${digits.slice(-places)}` }
const exact = (q: Q, places = 30) => fixed(roundHalfEven(q, places), places).replace(/\.?0+$/, '')
const percent = (num: Q, den: Q) => { const q = { n: num.n * 100n * den.d, d: num.d * den.n }; return { value: exact({ n: roundHalfEven(q, 12), d: 10n ** 12n }), display: fixed(roundHalfEven(q, 1), 1) } }

describe('I-06: profiles, review flags and disclosures on the boundary\'s category rows', () => {
  test('every calculated category carries the engine\'s verified profile; the others none; review flags follow the shares (none without them)', async () => {
    const a = spend(1, '1000'), b = supplier(1, '400'), c = rail('1200.5')
    const records = [calculated(a, 'purchase_spend'), calculated(b, 'purchase_supplier'), calculated(c, 'transport')]
    const coverage = await cover(records, [a, b, c])
    const aggregate = await realEngine.aggregate([a, b, c], [a, b, c].map(() => ({ dataQuality: null, activityDataOrigin: null })))
    expect(coverage.categories[0]!.profile).toEqual(aggregate.categoryProfiles['1']!)
    expect(coverage.categories[3]!.profile).toEqual(aggregate.categoryProfiles['4']!)
    expect(coverage.categories.filter(row => row.profile !== null).map(row => row.category)).toEqual([1, 4])
    for (const row of coverage.categories) expect(row.reviewFlags).toEqual(row.profile && 'shareOfKnownTotal' in row.profile ? scope3ReviewFlags(row.profile) : [])
  }, TIMEOUT)

  test('spend beside another method in one category, and with-margins category 1 spend beside category 4 records, are disclosed (never holds)', async () => {
    const withMargins = spend(1, '1000'), withoutMargins = spend(1, '1000', { marginChoice: 'without_margins', boughtAtFactoryGate: true }), b = supplier(1, '400'), c = rail('10')
    const codes = async (records: Scope3CoverageRecord[], results: Scope3EngineResult[]) => { const cov = await cover(records, results); return { one: cov.categories[0]!.disclosures, four: cov.categories[3]!.disclosures, status: cov.categories[0]!.status, all: cov.disclosures.map(d => d.code) } }
    const mixed = await codes([calculated(withMargins, 'purchase_spend'), calculated(b, 'purchase_supplier')], [withMargins, b])
    expect(mixed.one).toContain('spend_and_activity_methods_in_category')
    expect(mixed.status).toBe('calculated')
    expect((await codes([calculated(withMargins, 'purchase_spend')], [withMargins])).one).not.toContain('spend_and_activity_methods_in_category')
    expect((await codes([calculated(b, 'purchase_supplier')], [b])).one).not.toContain('spend_and_activity_methods_in_category')
    // Category 4 with a calculated rail record, or a record that needs input: both are upstream transport records.
    for (const four of [[calculated(c, 'transport')], [heldIn(4, 'transport')]]) {
      const results = [withMargins, ...four.flatMap(r => r.result.outcome === 'calculated' ? [c] : [])]
      const got = await codes([calculated(withMargins, 'purchase_spend'), ...four], results)
      expect(got.one).toContain('with_margins_may_overlap_cat4_inbound_freight')
      expect(got.four).not.toContain('with_margins_may_overlap_cat4_inbound_freight')
    }
    expect((await codes([calculated(withoutMargins, 'purchase_spend'), calculated(c, 'transport')], [withoutMargins, c])).one).not.toContain('with_margins_may_overlap_cat4_inbound_freight')
    expect((await codes([calculated(withMargins, 'purchase_spend')], [withMargins])).one).not.toContain('with_margins_may_overlap_cat4_inbound_freight')
    expect((await codes([calculated(withMargins, 'purchase_spend'), { ...heldIn(4, 'transport'), result: { outcome: 'held', status: 'withdrawn', reasons: ['record_withdrawn'] } }], [withMargins])).one).not.toContain('with_margins_may_overlap_cat4_inbound_freight')
    for (const code of ['spend_and_activity_methods_in_category', 'with_margins_may_overlap_cat4_inbound_freight', 'mixed_gwp_sets_including_reported']) expect(SCOPE3_DISCLOSURE_TEXT[code]).toBeTruthy()
  }, TIMEOUT)

  test('mixed GWP sets: AR5 with AR4 keeps the shipped text; a mix with AS-REPORTED takes the new code (A8: no shipped text edited)', async () => {
    const w = waste(), c = rail('10'), b = supplier(1, '400')
    const ipcc = await cover([calculated(w, 'waste'), calculated(c, 'transport')], [w, c])
    expect(ipcc.disclosures.map(d => d.code)).toContain('mixed_gwp_sets')
    expect(ipcc.disclosures.map(d => d.code)).not.toContain('mixed_gwp_sets_including_reported')
    const reported = await cover([calculated(w, 'waste'), calculated(b, 'purchase_supplier')], [w, b])
    expect(reported.disclosures.find(d => d.code === 'mixed_gwp_sets_including_reported')!.categories).toEqual([1, 5])
    expect(reported.disclosures.map(d => d.code)).not.toContain('mixed_gwp_sets')
    expect(SCOPE3_DISCLOSURE_TEXT.mixed_gwp_sets).toBe('More than one GWP set is used in this Scope 3 total (AR5, and AR4 for waste), so the total combines GWP bases.')
  }, TIMEOUT)

  test('factor_data_years (Hub 2025 and eGRID editions) is disclosed only where a method reads those sources', async () => {
    const a = spend(1, '1000'), c = rail('10')
    const coverage = await cover([calculated(a, 'purchase_spend'), calculated(c, 'transport')], [a, c])
    expect(coverage.categories[0]!.disclosures).not.toContain('factor_data_years')
    expect(coverage.categories[3]!.disclosures).toContain('factor_data_years')
  }, TIMEOUT)
})

describe('I-06: the I-05 profile keys (DESIGN 4.6) at the boundary', () => {
  test('all three keys with exact values are accepted and drive the review flags; a wrong sum, form, a partial set or no keys at all is refused', async () => {
    const a = spend(1, '1000'), deflated = spend(1, '500', { naicsCode: '325211' }), base = spend(1, '250', { dollarYear: 2022 }), c = rail('1200.5')
    const results = [a, deflated, base, c]
    const records = [calculated(a, 'purchase_spend'), calculated(deflated, 'purchase_spend'), calculated(base, 'purchase_spend'), calculated(c, 'transport')]
    // Independent values: deflation = sum of (amount x factor - total) over the deflated lines (2024 dollars), never the 2022 line.
    const nominal = (r: Scope3EngineResult) => dec((r.activity as Record<string, string>).nominalCo2e!)
    const deflation = [a, deflated].map(r => sub(nominal(r), dec(r.total!.unrounded))).reduce(add)
    const one = [a, deflated, base].map(r => dec(r.total!.unrounded)).reduce(add), known = add(one, dec(c.total!.unrounded))
    const largest = [a, deflated, base].map(r => dec(r.total!.unrounded)).sort((x, y) => (x.n * y.d > y.n * x.d ? -1 : 1))[0]!
    const keys = (aggregate: Scope3EngineAggregate) => {
      for (const [category, sumQ, top] of [['1', one, largest], ['4', dec(c.total!.unrounded), dec(c.total!.unrounded)]] as const) Object.assign(aggregate.categoryProfiles[category]!, {
        deflationEffect: category === '1' ? { unrounded: exact(deflation), display: fixed(roundHalfEven(deflation, 4), 4), unit: 'kg CO2e', rounding: 'half_even_4dp_once' } : null,
        shareOfKnownTotal: percent(sumQ, known), largestResultShare: percent(top, sumQ) })
    }
    const coverage = await cover(records, results, [], edited(keys))
    const one1 = coverage.categories[0]!
    expect(one1.profile!.deflationEffect!.display).toBe(fixed(roundHalfEven(deflation, 4), 4))
    // Category 1 is most of the known total and its largest line is over 10%; category 4's single line is 100% of it.
    expect(one1.reviewFlags).toEqual(['category_over_half_of_known_total', 'largest_record_over_tenth_of_category'])
    expect(coverage.categories[3]!.reviewFlags).toEqual(['largest_record_over_tenth_of_category'])
    const refused = async (edit: (aggregate: Scope3EngineAggregate) => void) => { try { await cover(records, results, [], edited(aggregate => { keys(aggregate); edit(aggregate) })); return 'accepted' } catch (error) { return (error as Error).message } }
    expect(await refused(x => { x.categoryProfiles['1']!.deflationEffect = { unrounded: '1', display: '1.0000', unit: 'kg CO2e', rounding: 'half_even_4dp_once' } })).toContain('deflation effect')
    expect(await refused(x => { x.categoryProfiles['4']!.deflationEffect = { unrounded: '0', display: '0.0000', unit: 'kg CO2e', rounding: 'half_even_4dp_once' } })).toContain('deflation effect')
    expect(await refused(x => { delete (x.categoryProfiles['1'] as unknown as Record<string, unknown>).largestResultShare })).toContain('only some')
    // Integration wave 3: the merged I-05 engine always sends the three keys, so a profile without any of them is refused too.
    expect(await refused(x => { for (const key of ['deflationEffect', 'shareOfKnownTotal', 'largestResultShare']) delete (x.categoryProfiles['4'] as unknown as Record<string, unknown>)[key] })).toContain('none of the deflation and share keys')
    expect(await refused(x => { x.categoryProfiles['1']!.shareOfKnownTotal = { value: '101', display: '101.0' } })).toContain('share of the known-source total')
    expect(await refused(x => { x.categoryProfiles['1']!.largestResultShare = { value: '40.25', display: '40.25' } })).toContain('largest-result share')
    expect(await refused(x => { x.categoryProfiles['1']!.shareOfKnownTotal = null })).toContain('share of the known-source total')
    expect(await refused(x => { (x.categoryProfiles['1'] as unknown as Record<string, unknown>).extra = 1 })).toContain('profile shape')
  }, TIMEOUT)

  test('the shared rule: null shares exactly when their denominator is 0; flags compare the engine\'s value with 50 and 10', () => {
    const zero = { unrounded: '0', display: '0.0000', unit: 'kg CO2e' as const, rounding: 'half_even_4dp_once' }
    expect(scope3ProfileExtrasProblem({ deflationEffect: null, shareOfKnownTotal: null, largestResultShare: null }, [], zero, zero)).toBeNull()
    expect(scope3ProfileExtrasProblem({ deflationEffect: null, shareOfKnownTotal: { value: '0', display: '0.0' }, largestResultShare: null }, [], zero, zero)).toContain('known-source')
    // Integration wave 3: all three keys are required (the I-05 engine always sends them); none is no longer accepted.
    expect(scope3ProfileExtrasProblem({}, [], zero, zero)).toContain('none of the deflation and share keys')
    expect(scope3ProfileExtrasProblem({ deflationEffect: null }, [], zero, zero)).toContain('only some')
    const profile = (share: string, largest: string) => ({ shareOfKnownTotal: { value: share, display: '0.0' }, largestResultShare: { value: largest, display: '0.0' } }) as never
    expect(scope3ReviewFlags(profile('50', '10'))).toEqual([])
    expect(scope3ReviewFlags(profile('50.000000000001', '10.000000000001'))).toEqual(['category_over_half_of_known_total', 'largest_record_over_tenth_of_category'])
    expect(scope3ReviewFlags(null)).toEqual([])
  })
})

describe('I-06: the methodology statement, exclusion register and total line (fixed sentences from structured fields)', () => {
  const company = '95100000-0000-4000-8000-0000000000aa', setup = '95100000-0000-4000-8000-0000000000bb'
  const line = (result: Scope3EngineResult | null, extra: Partial<Scope3ResultsLine> = {}): Scope3ResultsLine => ({
    recordId: id(), versionId: id(), revision: 1, kind: 'purchase_spend', category: result?.category ?? 1, sourceId: 'S', locationId: id(), locationName: 'Office', period, quantity: { value: '1', unit: 'USD' }, quality: 'actual',
    estimateBasis: null, evidence: [], plan: { action: result ? 'calculate' : 'hold', status: result ? null : 'input_needed', reasons: result ? [] : ['naics_code_required'], notes: [] }, periodCheck: 'inside',
    outcome: result ? 'calculated' : 'held', refusalCode: null, result, reference: 'INV-1', derivedFrom: null, payload: {}, methodType: null, effectiveDataQuality: null, ...extra })

  test('an excluded category: decision, reason, criteria, justification, magnitude and evidence; a not-screened one: one sentence', async () => {
    const assessment = fixtureAssessmentRecord(company, setup, { category: 8, id: '95100000-0000-4000-8000-0000000000c8' }) as unknown as Scope3AssessmentRecord
    const coverage = await cover([], [], [{ category: 8, decision: 'excluded', reason: 'No leases in 2025.' }, { category: 13, decision: 'not_relevant', reason: 'Not a lessor.' }], realEngine, [assessment])
    expect(scope3MethodologyStatement(coverage.categories[7]!, [])).toEqual([
      { topic: 'decision', text: 'Screening decision: Excluded. No leases in 2025.' },
      { topic: 'decision', text: 'Reason: Immaterial, with an estimate.' },
      { topic: 'decision', text: 'Relevance criteria considered (Scope 3 Standard Table 6.1): Size.' },
      { topic: 'decision', text: 'Justification: Below 1% of the estimated total.' },
      { topic: 'decision', text: 'Estimated magnitude: 120.5 t CO2e (basis: Spend times the sector average factor.), a company estimate that is never added to any total.' }])
    expect(scope3MethodologyStatement(coverage.categories[12]!, [])).toEqual([{ topic: 'decision', text: 'Screening decision: Not applicable. Not a lessor.' }, { topic: 'decision', text: SCOPE3_METHODOLOGY_TEXT.noAssessment }])
    expect(scope3MethodologyStatement(coverage.categories[14]!, [])).toEqual([{ topic: 'decision', text: SCOPE3_METHODOLOGY_TEXT.notScreened }])
    // The register lists the excluded and not-applicable categories, with the assessment's magnitude, never a total.
    const register = scope3ExclusionRegister(coverage.categories)
    expect(register.map(entry => [entry.category, entry.level, entry.decision])).toEqual([[8, 'category', 'excluded'], [13, 'category', 'not_relevant']])
    expect(register[1]!.justification).toBe('Not a lessor.')
  }, TIMEOUT)

  test('an included category with calculated and held lines: every topic in order, figures from the engine profile', async () => {
    const a = spend(1, '1000'), b = supplier(1, '400')
    const lines = [line(a), line(b, { kind: 'purchase_supplier', payload: { allocationBasis: 'supplier_allocated' } }), line(null), line(null, { plan: { action: 'hold', status: 'excluded', reasons: ['superseded_by_supplier_record'], notes: ['superseded_by:95100000-0000-4000-8000-000000000999'] } })]
    for (const l of lines) if (l.result) Object.assign(l, { methodType: null, effectiveDataQuality: scope3EffectiveDataQuality(l.result, { dataQuality: null, activityDataOrigin: null }) })
    const records = [calculated(a, 'purchase_spend'), calculated(b, 'purchase_supplier'), heldIn(1, 'purchase_spend'), { ...heldIn(1, 'purchase_spend'), result: { outcome: 'held' as const, status: 'excluded' as const, reasons: ['superseded_by_supplier_record'] } }]
    const coverage = await cover(records, [a, b], [{ category: 1, decision: 'included', reason: null }])
    const row = coverage.categories[0]!
    const statement = scope3MethodologyStatement(row, lines)
    const topics = [...new Set(statement.map(s => s.topic))]
    const text = (topic: string) => statement.filter(s => s.topic === topic).map(s => s.text)
    // MISSION 4.1 / v3: retain raw flags, but match the screen's minimum two categories / five records for display.
    expect(topics).toEqual(['activities', 'method', 'factor_source', 'price_year', 'gwp', 'allocation', 'assumption', 'data_quality', 'value_chain', 'biogenic', 'uncertainty', 'exclusion', 'base_year', 'limitation'])
    expect(row.reviewFlags).toEqual(['category_over_half_of_known_total', 'largest_record_over_tenth_of_category'])
    expect(text('review')).toEqual([])
    // Integration wave 3: with the merged engine's deflation effect, the price-year topic also states it: nominal minus deflated
    // kg of the one 2024-dollar spend line, computed here independently and rounded once to 4 dp.
    const effect = sub(dec((a.activity as Record<string, string>).nominalCo2e!), dec(a.total!.unrounded))
    expect(text('price_year')).toEqual([SCOPE3_METHODOLOGY_TEXT.priceYearDeflated([2024]), SCOPE3_METHODOLOGY_TEXT.deflationEffect(fixed(roundHalfEven(effect, 4), 4))])
    expect(text('gwp')).toEqual(['GWP set: IPCC AR5 100-year GWPs.', 'GWP set: CO2e as reported by the supplier or partner on its declared GWP basis, not restated.', 'Declared GWP bases of reported figures: AR5.'])
    expect(text('allocation')).toEqual(['Allocation of supplier or partner totals to the company: supplier allocated.'])
    expect(text('value_chain')).toEqual([`${row.profile!.valueChain.percent!.display}% of this category’s kg CO2e comes from supplier or other value-chain partner data. Secondary factors typed in by the company are not supplier data.`])
    // Round 2 lane E (ACC-6): the qualitative assessment, then why it is not quantified (CARB workshop, slide 14); spend and
    // supplier factors print no confidence interval, so no published range is stated.
    expect(text('uncertainty')).toEqual([SCOPE3_UNCERTAINTY_TEXT[row.profile!.dominantMethodType], SCOPE3_UNCERTAINTY_TEXT_R2E.notQuantified])
    expect(text('exclusion')).toEqual(['1 record needs input and is not counted.', '1 record is a spend line replaced by a supplier record and not counted again.'])
    expect(text('activities')).toEqual([SCOPE3_METHODOLOGY_TEXT.activitiesMissing])
    // An included category with no records says so, never a zero.
    const empty = await cover([], [], [{ category: 6, decision: 'included', reason: null }])
    expect(scope3MethodologyStatement(empty.categories[5]!, []).map(s => s.text)).toEqual([SCOPE3_METHODOLOGY_TEXT.activitiesMissing, SCOPE3_METHODOLOGY_TEXT.noRecords,
      SCOPE3_METHODOLOGY_TEXT.dataQualityNone, SCOPE3_METHODOLOGY_TEXT.valueChainNone, 'Scope 3 base year: not yet established.', expect.stringContaining('2025 and 2026')])
  }, TIMEOUT)

  test('the total is known sources only until every category is calculated, excluded or not applicable, and names what it includes', () => {
    const row = (category: number, status: string, subtotal: unknown) => ({ category, status, subtotal }) as never
    const partial = scope3TotalStatement([row(1, 'calculated', {}), row(2, 'input_needed', {}), row(3, 'not_screened', null)])
    expect([partial.basis, partial.includes, partial.lines]).toEqual(['known_sources_only', [1, 2], ['Includes categories 1, 2.', 'Does not include: category 3 (not screened).']])
    const all = scope3TotalStatement([row(1, 'calculated', {}), row(2, 'excluded', null), row(3, 'not_relevant', null)])
    expect([all.basis, all.label, all.lines[0]]).toEqual(['all_relevant_calculated', 'every relevant category calculated', 'Includes categories 1.'])
  })
})
