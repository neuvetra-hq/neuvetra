// Round 3, lane A (Claude, 31 October 2026; ROUND3.md owner decisions 2, 3 and 4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-14,
// AC-15, r4.2 M1) as the collection side sees it: the adapter (the building gas-use hold moves to the engine; each spend line
// carries its tax treatment), the category 12 end-of-life disclosure, the texts, the per-region methodology that names coal
// apart from fully counted fuels, the coal screening range and the end-of-life memo in the methodology, the closed-line
// status words, and the catalog mirror of the engine. Expected figures are exact arithmetic on printed values, never engine
// output; the engine is only run to get real result shapes.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CollectionContext } from './collection-contract'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256 } from './method-reference'
import { planScope3Calculation, validateScope3Payload, type Scope3CollectionActivity, type Scope3CollectionKind, type Scope3CollectionVersion } from './scope3-collection'
import { SCOPE3_PARTIAL_BOUNDARY_NOTES, SCOPE3_PLAN_NOTE_DISCLOSURES, type Scope3CoverageRecord, type Scope3EngineResult } from './scope3-coverage'
import { scope3Coverage, type Scope3AggregateEngine } from './scope3-engine-output'
import { SCOPE3_COMPLETION_FACTOR_SOURCES, SCOPE3_METHODS, scope3DefaultDataQualityOf, scope3FactorSourceOf } from './scope3-method-catalog'
import { scope3MethodologyStatement } from './scope3-methodology'
import { scope3LineStatusText } from './scope3-report-csv'
import { scope3DecimalDifference, scope3MemoText, scope3UpstreamPartialText, SCOPE3_TAX_TREATMENT_NOTES } from './scope3-r3a'
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_EXCLUDABLE_NOTE_TEXT, SCOPE3_METHODOLOGY_TEXT_R2A, SCOPE3_METHODOLOGY_TEXT_R3A } from './scope3-text'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; results?: Array<{ status: string; result?: Scope3EngineResult }>; aggregate?: any }
}
const calculate = (requests: unknown[]) => engine({ action: 'calculate_many', requests }).results!.map(item => item.result!)
const pins = { engineSha256: createHash('sha256').update(readFileSync(ENGINE)).digest('hex'), registerSha256: SCOPE3_REGISTER_2025_SHA256,
  additionalRegisterSha256s: { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256 } }
const realEngine: Scope3AggregateEngine = { aggregate: async (results, annotations) => {
  const out = engine(annotations ? { action: 'aggregate', results, annotations } : { action: 'aggregate', results })
  if (out.status !== 'ok') throw new Error(`refused: ${out.code}`)
  return out.aggregate
} }
const TIMEOUT = 120_000
const Y2025 = { start: '2025-01-01', endExclusive: '2026-01-01' }
const company = '93910000-0000-4000-8000-000000000001', setup = '93910000-0000-4000-8000-000000000002', office = '93910000-0000-4000-8000-000000000003'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [{ id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
let n = 0
function record(kind: Scope3CollectionKind, quantity: ReturnType<typeof q>, payload: unknown): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `R3-${n}`, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null,
    reference: 'Synthetic source', notes: '', evidenceIds: [], period: Y2025, kind, quantity, payload: validateScope3Payload(kind, payload) } as unknown as Scope3CollectionActivity
  return { id: `93910000-0000-4000-8000-${String(10000 + n).padStart(12, '0')}`, recordId: `93910000-0000-4000-8000-${String(50000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: 'a'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}
const plan = (v: Scope3CollectionVersion) => planScope3Calculation(v, context, [], { reportingPeriod: Y2025, consolidationApproach: 'operational_control' })
const BUILDING = { category: 8, cbecsActivity: 'food_service', usesNaturalGas: 'unknown', gridBasis: 'subregion', zip: '94105', subregion: 'CAMX', utilityEiaId: null, coveredDays: 365, leaseType: 'operating', noOperationalControlBasis: 'Shared building; landlord meters.' }
const SPEND = { category: 1, naicsCode: '331110', dollarYear: 2022, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: 'includes_sales_tax',
  supplierName: 'Synthetic Mill', glAccount: '5100', description: 'Steel coil', categoryConfirmed: false, activityOverlap: 'unknown', importId: null, importRow: null,
  mappingSource: 'user', paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false }
const GHG = { productLabel: 'Synthetic split AC unit', gas: 'R-410A', chargePerUnit: '2.6', chargeUnit: 'kg', useReleasePercent: '2.5', releaseBasis: 'Manufacturer leak-rate data' }
const camx = { kind: 'electricity_upstream', input: { period: Y2025, quantity: '1234.5', unit: 'MWh', subregion: 'CAMX', zip: '94105' } }
const srmw = { kind: 'electricity_upstream', input: { period: Y2025, quantity: '100', unit: 'MWh', subregion: 'SRMW', zip: '63101' } }
const counts = { records: 2, calculated: 0, partialBoundary: 2, inputNeeded: 0, outsidePeriod: 0, excluded: 0, withdrawn: 0, unavailable: 0, methodPending: 0, optionalPending: 0 }
const line = (r: Scope3EngineResult, extra: Record<string, unknown> = {}) => ({ category: r.category, plan: { action: 'calculate', status: null, reasons: [], notes: [] }, outcome: 'calculated', result: r, payload: null, derivedFrom: { recordId: 'x', kind: 'electricity' }, ...extra }) as never

describe('round 3, lane A: the adapter', () => {
  test('AC-10: a building whose natural gas use is unknown reaches the engine, which holds it with its own finding and a trace', () => {
    const p = plan(record('building_average', q('2500', 'sqft'), BUILDING))
    expect([p.action, p.status, p.reasons]).toEqual(['calculate', null, []])
    expect((p.call!.request.input as Record<string, unknown>).usesNaturalGas).toBe('unknown')
    const [r] = calculate([p.call!.request])
    expect([r!.status, r!.findings, r!.total, typeof r!.resultSha256]).toEqual(['input_needed', ['natural_gas_use_unknown'], null, 'string'])
    // A token the engine does not know is still the adapter's own hold (nothing the engine would refuse is sent).
    expect(plan(record('building_average', q('100', 'sqft'), { ...BUILDING, cbecsActivity: 'data_center' })).reasons).toEqual(['cbecs_activity_not_an_engine_token'])
  }, TIMEOUT)

  test('AC-14: every spend line carries its tax treatment as a line note, which is a category disclosure with a text', () => {
    for (const treatment of ['includes_sales_tax', 'excludes_sales_tax', 'unknown'] as const) {
      const p = plan(record('purchase_spend', q('50000', 'USD'), { ...SPEND, taxTreatment: treatment }))
      expect([treatment, p.action, p.notes.filter(note => note.startsWith('spend_tax_treatment_'))]).toEqual([treatment, 'calculate', [`spend_tax_treatment_${treatment}`]])
      expect(SCOPE3_PLAN_NOTE_DISCLOSURES).toContain(`spend_tax_treatment_${treatment}`)
      expect(SCOPE3_DISCLOSURE_TEXT[`spend_tax_treatment_${treatment}`]).toContain('purchaser price')
      // The engine input never carries it (the figure and its hashes do not move).
      expect(Object.keys(p.call!.request.input as object)).not.toContain('taxTreatment')
    }
    expect(SCOPE3_TAX_TREATMENT_NOTES).toEqual(['spend_tax_treatment_excludes_sales_tax', 'spend_tax_treatment_includes_sales_tax', 'spend_tax_treatment_unknown'])
    expect(SCOPE3_DISCLOSURE_TEXT.spend_tax_treatment_includes_sales_tax).toContain('not removed')
  })
})

describe('round 3, lane A: coverage, texts and catalog', () => {
  test('decision 3: category 12 discloses the end-of-life release whenever a counted sold greenhouse-gas product record exists', async () => {
    const ghg = record('sold_ghg_product', q('5000', 'unit'), GHG)
    const p = plan(ghg)
    expect(p.action).toBe('calculate')
    const [r] = calculate([p.call!.request])
    // 5,000 x 2.6 kg x (100 - 2.5)% x 1,924 (Hub 2025 Table 12, R-410A, D575) = 24,386,700 kg CO2e, outside every total.
    expect(r!.memoItems!.map(m => [m.code, Number(m.kg), m.unit, m.reportedSeparately])).toEqual([['ghg_product_end_of_life_remaining_charge', 24386700, 'kg CO2e', true]])
    const coverageRecords: Scope3CoverageRecord[] = [{ recordId: ghg.recordId, category: 11, quality: 'actual', kind: 'sold_ghg_product', result: { outcome: 'calculated', resultSha256: r!.resultSha256 } }]
    const screening = [{ category: 11, decision: 'included' as const, reason: null }, { category: 12, decision: 'included' as const, reason: null }]
    const coverage = await scope3Coverage(coverageRecords, screening, [r!], realEngine, pins, [{ dataQuality: null, activityDataOrigin: null }], null)
    expect(coverage.categories[11]!.disclosures).toContain('ghg_product_end_of_life_release_not_quantified')
    expect(coverage.categories[10]!.disclosures).not.toContain('ghg_product_end_of_life_release_not_quantified')
    expect(coverage.categories[10]!.profile!.memoItems.ghg_product_end_of_life_remaining_charge!.unrounded).toBe(r!.memoItems![0]!.kg)
    expect(coverage.categories[10]!.subtotal!.unrounded).toBe(r!.total!.unrounded)  // the memo is in no total
    // Withdrawn, the record no longer counts: no disclosure.
    const withdrawn = await scope3Coverage([{ ...coverageRecords[0]!, result: { outcome: 'held', status: 'withdrawn', reasons: ['record_withdrawn'] } }], screening, [], realEngine, pins, [], null)
    expect(withdrawn.categories[11]!.disclosures).not.toContain('ghg_product_end_of_life_release_not_quantified')
  }, TIMEOUT)

  test('every new note and memo has a plain text; AC-6, AC-8, AC-15 and r4.2 M1 wordings', () => {
    for (const code of ['coal_upstream_omitted_screening_range_memo', 'upstream_gwp_ar5_coal_mine_methane', 'solar_thermal_cofiring_upstream_not_counted', 'end_of_life_remaining_charge_memo_upper_bound',
      'ghg_product_end_of_life_release_not_quantified', 'spend_tax_treatment_includes_sales_tax', 'spend_tax_treatment_excludes_sales_tax', 'spend_tax_treatment_unknown']) {
      expect([code, typeof SCOPE3_DISCLOSURE_TEXT[code]]).toEqual([code, 'string'])
      expect([code, /[a-z]+_[a-z_]+/.test(SCOPE3_DISCLOSURE_TEXT[code]!)]).toEqual([code, false])
    }
    expect(SCOPE3_DISCLOSURE_TEXT.coal_upstream_omitted_screening_range_memo).toMatch(/screening/i)
    for (const words of ['5.0 lb CO2e per MMBtu', 'AR4', '12.2 g CO2e per MJ', 'heating value', 'never treated as zero']) expect([words, SCOPE3_DISCLOSURE_TEXT.coal_upstream_omitted_screening_range_memo!.includes(words)]).toEqual([words, true])
    expect(SCOPE3_PARTIAL_BOUNDARY_NOTES).toContain('solar_thermal_cofiring_upstream_not_counted')
    for (const code of ['coal_upstream_omitted_screening_low', 'coal_upstream_omitted_screening_high', 'ghg_product_end_of_life_remaining_charge']) expect([code, /_/.test(scope3MemoText(code))]).toEqual([code, false])
    expect(scope3MemoText('projected_lifetime_emissions')).toBe('projected lifetime emissions')  // unchanged words for the shipped memo
    // AC-6: the static note says "where present in the subregion's mix".
    expect(SCOPE3_DISCLOSURE_TEXT.nuclear_biomass_byproduct_fuels_upstream_excluded).toContain('where present in the subregion’s mix')
    expect(SCOPE3_EXCLUDABLE_NOTE_TEXT.nuclear_biomass_byproduct_fuels_upstream_excluded).toContain('where present in the subregion’s mix')
    // AC-8: the LHV/HHV source mix and petroleum coke.
    for (const words of ['0.924', '0.928', 'petroleum coke', 'waste oil']) expect([words, SCOPE3_DISCLOSURE_TEXT.oil_fired_upstream_proxied_by_ulsd!.includes(words)]).toEqual([words, true])
    // AC-15: the direction of the deflator fallback.
    expect(SCOPE3_DISCLOSURE_TEXT.price_index_latest_published_year_used).toContain('If prices rose, the fallback overstates')
    expect(SCOPE3_DISCLOSURE_TEXT.price_index_latest_published_year_used).toContain('if prices fell, the direction reverses')
    // r4.2 M1: both coal sentences say never treated as zero.
    expect(SCOPE3_DISCLOSURE_TEXT.coal_upstream_mine_methane_only).toContain('never treated as zero')
    expect(SCOPE3_METHODOLOGY_TEXT_R2A.coalMethaneOnly).toContain('never treated as zero')
  })

  test('AC-9 and decision 2 in the catalog: coal geography good, memo items declared, the screening inputs have their own sources', () => {
    const r5 = JSON.parse(readFileSync(new URL('./method-reference/verified-scope3-us-upstream-register-2025.json', import.meta.url), 'utf8')) as { entries: Array<{ id: string }> }
    for (const id of ['scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1', 'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1', 'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1']) {
      const m = SCOPE3_METHODS[id]!
      expect([id, scope3DefaultDataQualityOf(m, ['coal_upstream_mine_methane_only'])]).toEqual([id, { technological: 'fair', temporal: 'good', geographical: 'good', completeness: 'poor', reliability: 'good' }])
      expect([id, m.resultExtras]).toEqual([id, ['additionalRegisters', 'memoItems']])
      for (const key of ['coal_upstream.npc2011.us_average.upstream_combustion', 'coal_upstream.abrahams2015_cmu.us_average']) expect([id, key, m.factorSourceIds.includes(scope3FactorSourceOf(key)!)]).toEqual([id, key, true])
    }
    expect(SCOPE3_METHODS['scope3.cat11.sold_ghg_product.hub2025.v1']!.resultExtras).toEqual(['additionalRegisters', 'memoItems'])
    const sources = new Map<string, string>(SCOPE3_COMPLETION_FACTOR_SOURCES.map(s => [s.id, s.text]))
    expect(sources.get(scope3FactorSourceOf('coal_upstream.npc2011.us_average.upstream_combustion')!)).toContain('Table 7')
    expect(sources.get(scope3FactorSourceOf('coal_upstream.abrahams2015_cmu.us_average')!)).toContain('Table S7')
    expect(r5.entries.every(e => scope3FactorSourceOf(e.id) !== null)).toBe(true)
  })
})

describe('round 3, lane A: methodology, partial text and status words', () => {
  test('decision 2: coal is stated apart from fully counted fuels, never as covered, with the screening range of the category', async () => {
    const [a, b] = calculate([camx, srmw])
    const agg = engine({ action: 'aggregate', results: [a, b] }).aggregate
    const row = { category: 3, screening: { decision: 'included', reason: null, description: null }, assessment: null, methods: [a!.methodVersionId], disclosures: [], profile: agg.categoryProfiles['3'], reviewFlags: [], counts,
      dataQualityLabel: { label: 'fair', engineLabel: 'fair', capped: false, reasons: [] }, linesWithoutEvidence: 0 } as never
    const said = scope3MethodologyStatement(row, [line(a!), line(b!)]).map(s => s.text)
    const act = (r: Scope3EngineResult) => r.activity as Record<string, any>
    for (const [region, r] of [['CAMX', a!], ['SRMW', b!]] as const) {
      const x = act(r)
      const full = scope3DecimalDifference(x.mappedFossilHeatInputShare, x.coalHeatInputShare)
      expect(said).toContain(SCOPE3_METHODOLOGY_TEXT_R3A.upstreamShares(region, ['GAS', 'OIL'], full, x.coalHeatInputShare, x.unmappedFuels, x.unmappedFossilHeatInputShare, x.otherFuelsNotMapped))
    }
    // SRMW: 80.3% of its fossil heat input is coal, so its fully counted share is about 19.7%, never "100%".
    expect(Number(scope3DecimalDifference(act(b!).mappedFossilHeatInputShare, act(b!).coalHeatInputShare))).toBeCloseTo(1 - Number(act(b!).coalHeatInputShare), 12)
    expect(said.join(' ')).not.toMatch(/SRMW: 1(\.0+)? of the fossil heat input has an upstream factor/)
    const low = agg.categoryProfiles['3'].memoItems.coal_upstream_omitted_screening_low.display, high = agg.categoryProfiles['3'].memoItems.coal_upstream_omitted_screening_high.display
    // MISSION 4.1 / v3: group the integral digits for display without changing either engine number.
    const grouped = (value: string) => value.replace(/^-?\d+/, whole => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ','))
    expect(said).toContain(SCOPE3_METHODOLOGY_TEXT_R3A.coalScreeningRange(grouped(low), grouped(high)))
    expect(said.filter(text => text.includes('coal upstream omitted screening'))).toEqual([])  // never the raw memo codes
    expect(SCOPE3_METHODOLOGY_TEXT_R3A.coalScreeningRange('1', '2')).toContain('never treated as zero')
  }, TIMEOUT)

  test('decision 2: the partial-boundary words state the coal share and that coal counts mine methane only; never "cover 100%"', () => {
    const [b, n] = calculate([srmw, { kind: 'electricity_upstream', input: { period: Y2025, quantity: '100', unit: 'MWh', subregion: 'NYCW', zip: '10001' } }])
    const percent = (ratio: string) => (Number(ratio) * 100).toFixed(1)
    const text = scope3UpstreamPartialText(b!.activity as Record<string, unknown>, b!.boundary.notes, percent)!
    expect(text).toContain(`coal (${percent((b!.activity as any).coalHeatInputShare)}% of the fossil heat input) counts mine methane only`)
    expect(text).toContain('natural gas and oil')
    expect(text).not.toMatch(/100\.0%/)
    expect(text).not.toContain('other fuels')  // SRMW has no OTHF heat input
    expect(text).toContain('where present in the subregion’s mix')
    const none = scope3UpstreamPartialText(n!.activity as Record<string, unknown>, n!.boundary.notes, percent)!
    expect(none).not.toContain('coal')
  }, TIMEOUT)

  test('AC-14 in the methodology: the tax treatment of the category’s spend lines', () => {
    const spendLine = (treatment: string) => ({ category: 1, kind: 'purchase_spend', plan: { action: 'calculate', status: null, reasons: [], notes: [`spend_tax_treatment_${treatment}`] }, outcome: 'calculated',
      result: null, payload: { taxTreatment: treatment }, derivedFrom: null }) as never
    const row = { category: 1, screening: { decision: 'included', reason: null, description: null }, assessment: null, methods: [], disclosures: [], profile: null, reviewFlags: [], counts: { ...counts, records: 3 } } as never
    const said = scope3MethodologyStatement(row, [spendLine('includes_sales_tax'), spendLine('includes_sales_tax'), spendLine('unknown')]).map(s => s.text)
    expect(said).toContain(SCOPE3_METHODOLOGY_TEXT_R3A.taxTreatment({ includes_sales_tax: 2, excludes_sales_tax: 0, unknown: 1 }))
  })

  test('AC-5: a 3C or 3D combustion line closed by its upstream line prints as calculated and closed', () => {
    const r = { status: 'complete', boundary: { minimumBoundary: 'partial', notes: ['combustion_only_upstream_of_lost_energy_excluded'] } }
    const row = { outcome: 'calculated', result: r, plan: { action: 'calculate', status: null, reasons: [], notes: [] } } as never
    expect(scope3LineStatusText(row, true)).toBe('Calculated — closed by its upstream line')
    expect(scope3LineStatusText(row)).toBe('Calculated, partial boundary')
  })
})
