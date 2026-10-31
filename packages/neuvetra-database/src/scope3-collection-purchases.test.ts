// Scope 3 completion I-03 part 2 (DESIGN §5.1, §3.3, A19-A23, A29; Claude, 30 October 2026): spend lines and supplier
// figures from the collection contract to the real Scope 3 engine. Every contract-valid record either reaches the engine
// and is accepted, or is held here with a named reason; the contract's code sets and tokens equal the engine's catalog;
// the supersession pre-pass excludes exactly the spend lines a supplier record replaces; and the trusted boundary
// applies the engine's own A19 (origin) and A20 (unverified default) rules, so its profile checks agree with the engine.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CollectionContext } from './collection-contract'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from './method-reference'
import {
  planScope3Calculation, planScope3Supersession, SCOPE3_ACTIVITY_OVERLAP, SCOPE3_FACTOR_ORIGINS, SCOPE3_GWP_BASES, SCOPE3_HYBRID_UPSTREAM_COVERAGE, SCOPE3_SPEND_CATEGORIES,
  SCOPE3_SPEND_IMPORT_CATEGORIES, SCOPE3_SPEND_NAICS_SETS, SCOPE3_SUPPLIER_BOUNDARIES, SCOPE3_UNIT_FAMILIES, SCOPE3_VERIFICATION, scope3SpendMappingKeyInput, scope3SpendNaicsAllowed,
  validateScope3Payload, type Scope3CalculationPlan, type Scope3CollectionActivity, type Scope3CollectionKind, type Scope3CollectionVersion, type Scope3PlanOptions,
} from './scope3-collection'
import type { Scope3Annotation, Scope3CoverageRecord, Scope3EngineAggregate, Scope3EngineResult } from './scope3-coverage'
import { scope3Coverage, type Scope3AggregateEngine } from './scope3-engine-output'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_REASON_TEXT_I03 } from './scope3-text'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; result?: Record<string, any>; results?: Array<{ status: string; code?: string; result?: Scope3EngineResult }>; catalog?: Record<string, any>; aggregate?: Scope3EngineAggregate }
}
/** One engine process for many plans (calculate_many): each item is what a single calculate would give. */
const runAll = (plans: Scope3CalculationPlan[]) => plans.length ? engine({ action: 'calculate_many', requests: plans.map(plan => plan.call!.request) }).results! : []
const run = (plan: Scope3CalculationPlan) => runAll([plan])[0]!
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const pins = { engineSha256: sha256Of(ENGINE), registerSha256: SCOPE3_REGISTER_2025_SHA256, additionalRegisterSha256s: { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } }
function sha256Of(file: string) { return createHash('sha256').update(readFileSync(file)).digest('hex') }
/** The real engine's aggregate, annotations included, as site-api's bridge provides it. */
const realEngine: Scope3AggregateEngine = { aggregate: async (results, annotations) => {
  const out = engine(annotations ? { action: 'aggregate', results, annotations } : { action: 'aggregate', results })
  if (out.status !== 'ok') throw new Error(`refused: ${out.code}`)
  return out.aggregate!
} }
const TIMEOUT = 120_000, FUZZ_TIMEOUT = 300_000

const company = '93300000-0000-4000-8000-000000000001', setup = '93300000-0000-4000-8000-000000000002'
const office = '93300000-0000-4000-8000-000000000003', warehouse = '93300000-0000-4000-8000-000000000004'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [
  { id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' },
  { id: warehouse, name: 'Warehouse', inclusion: 'excluded', control: 'landlord', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
const year = { start: '2025-01-01', endExclusive: '2026-01-01' }
const plain = (value: string) => /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$/.test(value)
const q = (value: string, unit: string, normalized = plain(value)) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalized ? value : null, normalizedUnit: normalized ? unit : null })
let n = 0
function record<K extends Scope3CollectionKind>(kind: K, quantity: ReturnType<typeof q>, payload: unknown, extra: Record<string, unknown> = {}): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `P-${n}`, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null,
    reference: 'Synthetic source', notes: '', evidenceIds: [], period: year, kind, quantity, payload: validateScope3Payload(kind, payload), ...extra } as unknown as Scope3CollectionActivity
  return { id: `93300000-0000-4000-8000-${String(10000 + n).padStart(12, '0')}`, recordId: `93300000-0000-4000-8000-${String(50000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: 'a'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}
const plan = (v: Scope3CollectionVersion, options: Scope3PlanOptions = {}) => planScope3Calculation(v, context, [], options)

// The shared fixture shapes (scope3-payload-fixtures.ts), so the records here are exactly what 0030 stores.
const SPEND = { category: 1, naicsCode: '541511', dollarYear: 2024, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: 'excludes_sales_tax',
  supplierName: 'Synthetic Software LLC', glAccount: '6100', description: 'Software consulting', categoryConfirmed: false, activityOverlap: 'unknown', importId: null, importRow: null,
  mappingSource: 'user', paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false }
const DOWNSTREAM = { ...SPEND, category: 9, naicsCode: '484121', activityOverlap: 'none_confirmed', paidByReportingCompany: false, spendEstimateBasis: 'Customer-paid freight estimated from 2025 carrier rate cards.' }
const spend = (edits: Record<string, unknown> = {}, amount = q('100000', 'USD'), extra: Record<string, unknown> = {}) => record('purchase_spend', amount, { ...SPEND, ...edits }, extra)
const SUPPLIER = { category: 1, supplierName: 'Synthetic Steel Co', product: 'Hot-rolled coil', basis: 'product_factor', factorValue: '1.850125', factorUnit: 'kg CO2e per metric_ton',
  allocationBasis: 'supplier_allocated', allocationNumerator: null, allocationDenominator: null, boundary: 'cradle_to_gate', gwpBasis: 'AR5', verification: 'third_party_verified', dataYear: 2024,
  factorOrigin: 'supplier_primary', hybridUpstreamCoveredBy: null, supersedesSpend: null }
const ALLOCATED = { ...SUPPLIER, basis: 'allocated_total', factorValue: null, factorUnit: null, allocationBasis: 'revenue', allocationNumerator: '2500000', allocationDenominator: '100000000' }
const supplier = (edits: Record<string, unknown> = {}, quantity = q('120', 'metric_ton'), extra: Record<string, unknown> = {}) => record('purchase_supplier', quantity, { ...SUPPLIER, ...edits }, extra)
const allocated = (edits: Record<string, unknown> = {}, quantity = q('145000', 'kg CO2e'), extra: Record<string, unknown> = {}) => record('purchase_supplier', quantity, { ...ALLOCATED, ...edits }, extra)

describe('I-03: the contract equals the engine catalog (DESIGN §3.3, 8.3)', () => {
  test('spend categories, code sets key by key, the category code-set map, currencies, margins and the supplier tokens', () => {
    const catalog = engine({ action: 'catalog' }).catalog!
    expect(catalog.spendCategories).toEqual([...SCOPE3_SPEND_CATEGORIES])
    expect(catalog.spendImportCategories).toEqual([...SCOPE3_SPEND_IMPORT_CATEGORIES])
    // Code sets, key by key (the same keys, each the same codes).
    expect(Object.keys(catalog.spendNaicsSets).sort()).toEqual(Object.keys(SCOPE3_SPEND_NAICS_SETS).sort())
    for (const [name, codes] of Object.entries(SCOPE3_SPEND_NAICS_SETS)) expect([name, catalog.spendNaicsSets[name]]).toEqual([name, [...codes].sort()])
    // The engine's category -> code-set map is what scope3SpendNaicsAllowed (and 0030's twin) enforces, for every v1.3 code.
    const codes = (JSON.parse(readFileSync(new URL('./testdata/epa-scghg-v1.3-naics-codes.json', import.meta.url), 'utf8')) as { codes: string[] }).codes
    expect(catalog.spendNaicsCodes).toBe(codes.length)
    for (const category of SCOPE3_SPEND_CATEGORIES) {
      const set = catalog.spendCategoryCodeSet[String(category)] as string | undefined
      const disagree = [...codes, '221100', '999999'].filter(code => scope3SpendNaicsAllowed(category, code) !== (set === undefined ? true : (catalog.spendNaicsSets[set] as string[]).includes(code)))
      expect([category, set ?? 'any code', disagree] as unknown[]).toEqual([category, category === 1 || category === 2 ? 'any code' : set, []])
    }
    expect([catalog.spendCurrencies, catalog.spendMarginChoices, catalog.spendDollarYears.min, catalog.spendDollarYears.max]).toEqual([['USD'], ['with_margins', 'without_margins'], 2012, 2035])
    expect([catalog.supplierFactorOrigins, catalog.supplierBoundaries, catalog.supplierHybridUpstreamCoveredBy, catalog.gwpBases, catalog.verification])
      .toEqual([[...SCOPE3_FACTOR_ORIGINS], [...SCOPE3_SUPPLIER_BOUNDARIES], [...SCOPE3_HYBRID_UPSTREAM_COVERAGE], [...SCOPE3_GWP_BASES], [...SCOPE3_VERIFICATION]])
    expect([catalog.supplierProductUnits, catalog.supplierTotalUnits]).toEqual([[...SCOPE3_UNIT_FAMILIES.supplierProduct], [...SCOPE3_UNIT_FAMILIES.supplierAllocated]])
  }, TIMEOUT)
})

describe('I-03: spend lines (purchase_spend)', () => {
  test('calculable lines reach the engine with exactly its input keys, and the engine accepts them', () => {
    const cases: Array<[Scope3CollectionVersion, string, string | null, string[]]> = [
      [spend({ naicsCode: '111130', dollarYear: 2022 }, q('1000.00', 'USD')), 'complete', '848.0000', []],  // TV-S4: CSV row 4, 0.848 x 1000
      [spend(), 'complete', '7894.2757', []],                                                                 // TV-S5: 0.084 x 100000 x round12(118.026 / 125.587)
      [spend({ category: 2, naicsCode: '333120', marginChoice: 'without_margins', boughtAtFactoryGate: true, capitalFullCost: true, dollarYear: 2022 }, q('48000', 'USD')), 'complete', '9648.0000', []],
      [spend({ category: 4, naicsCode: '484121', activityOverlap: 'none_confirmed', dollarYear: 2022 }, q('20000', 'USD')), 'complete', '11900.0000', []],
      [spend({ category: 5, naicsCode: '562212', activityOverlap: 'none_confirmed', dollarYear: 2022 }, q('500', 'USD')), 'complete', '494.0000', []],
      [spend({ category: 6, naicsCode: '721110', activityOverlap: 'none_confirmed', dollarYear: 2022 }, q('2400', 'USD')), 'complete', '348.0000', []],
      [record('purchase_spend', q('3200', 'USD'), { ...DOWNSTREAM, dollarYear: 2022 }), 'complete', '1904.0000', []],
      // A confirmed category lifts the energy and trade guards; 221100 reaches the engine, which holds it itself.
      [spend({ naicsCode: '324110', categoryConfirmed: true, dollarYear: 2022 }, q('1000', 'USD')), 'complete', '270.0000', []],
      [spend({ naicsCode: '423430', categoryConfirmed: true, dollarYear: 2022 }, q('1000', 'USD')), 'complete', '74.0000', []],
      [spend({ naicsCode: '221100' }), 'input_needed', null, ['naics_code_not_in_factor_set']],
      [spend({ dollarYear: 2026 }), 'input_needed', null, ['dollar_year_index_missing']],
    ]
    const plans = cases.map(([v]) => plan(v))
    for (const p of plans) {
      expect([p.action, p.reasons]).toEqual(['calculate', []])
      expect(Object.keys(p.call!.request.input).sort()).toEqual(['amount', 'boughtAtFactoryGate', 'capitalFullCost', 'category', 'currency', 'dollarYear', 'marginChoice', 'naicsCode', 'period'])
    }
    const out = runAll(plans)
    cases.forEach(([v, status, display, findings], i) => {
      expect([v.activity.sourceId, out[i]!.status]).toEqual([v.activity.sourceId, 'ok'])
      const r = out[i]!.result!
      expect([r.methodVersionId, r.status, r.total?.display ?? null, r.findings, r.category]).toEqual(['scope3.spend.epa_scghg_v1_3.v1', status, display, findings, plans[i]!.category])
      expect(r.input).toEqual(plans[i]!.call!.request.input)
    })
    // Names, GL accounts, import and duplicate metadata, attestations and data quality never reach the engine.
    expect(JSON.stringify(plans.map(p => p.call!.request.input))).not.toMatch(/supplierName|glAccount|description|importId|mappingSource|possibleDuplicateOf|paidByReportingCompany|spendEstimateBasis|lineDate|activityOverlap|categoryConfirmed|taxTreatment|dataQuality/)
  }, TIMEOUT)

  test('a line without a dollar year uses the reporting year, and says so', () => {
    const line = spend({ naicsCode: '331110', dollarYear: null }, q('50000', 'USD'))
    const own = plan(line)
    // Round 3, lane A (AC-14): every spend line also carries its recorded tax treatment as a line note (a category disclosure).
    expect([own.call!.request.input.dollarYear, own.notes]).toEqual([2025, ['dollar_year_from_reporting_year', 'spend_tax_treatment_excludes_sales_tax']])
    // The setup reporting period decides when there is one (a fiscal year ending in 2026 is reporting year 2026).
    const fiscalPeriod = { start: '2025-07-01', endExclusive: '2026-07-01' }
    const fiscal = plan({ ...line, activity: { ...line.activity, period: fiscalPeriod } }, { reportingPeriod: fiscalPeriod })
    expect(fiscal.call!.request.input.dollarYear).toBe(2026)
    // 50000 x 0.787 (CSV row 299) x round12(118.026 / 128.893), computed independently: 36032.3920.
    expect(run(own).result!.total!.display).toBe('36032.3920')
  }, TIMEOUT)

  test('every §5.1 spend hold, one at a time, with its own reason and no engine call', () => {
    const cases: Array<[string, Scope3CollectionVersion, string[], Scope3PlanOptions?]> = [
      ['euro amount', spend({}, q('5000', 'EUR', false)), ['currency_not_supported']],
      ['amount as text', spend({}, q('n/a', 'USD', false)), ['amount_not_a_number']],
      ['negative amount', spend({}, q('-250.00', 'USD', false)), ['negative_amount_not_supported']],
      ['euro and not a number', spend({}, q('tbd', 'EUR', false)), ['currency_not_supported', 'amount_not_a_number']],
      ['grouping commas', spend({}, q('1,200', 'USD', false)), ['quantity_not_calculable']],
      ['four decimals', spend({}, q('12.3456', 'USD', false)), ['quantity_not_calculable']],
      ['no NAICS code (unmatched)', spend({ naicsCode: null, mappingSource: 'unmatched' }), ['naics_code_required']],
      ['category 4 with a code outside freight', spend({ category: 4, naicsCode: '541511', activityOverlap: 'none_confirmed' }), ['naics_not_valid_for_category']],
      ['category 4 with a passenger code (B3)', spend({ category: 4, naicsCode: '481111', activityOverlap: 'none_confirmed' }), ['naics_not_valid_for_category']],
      ['category 6 with a freight code', spend({ category: 6, naicsCode: '484121', activityOverlap: 'none_confirmed' }), ['naics_not_valid_for_category']],
      ['category 5 with a non-waste code', spend({ category: 5, naicsCode: '541511', activityOverlap: 'none_confirmed' }), ['naics_not_valid_for_category']],
      ['category 9 with a passenger code', record('purchase_spend', q('1', 'USD'), { ...DOWNSTREAM, naicsCode: '481111' }), ['naics_not_valid_for_category']],
      ['energy code in category 1 (B6)', spend({ naicsCode: '324110' }), ['energy_spend_belongs_in_scope_1_2_or_cat3']],
      ['natural gas distribution in category 2', spend({ category: 2, naicsCode: '221210', capitalFullCost: true }), ['energy_spend_belongs_in_scope_1_2_or_cat3']],
      ['pipeline code: energy and freight', spend({ naicsCode: '486210' }), ['energy_spend_belongs_in_scope_1_2_or_cat3', 'spend_overlaps_other_category']],
      ['freight code in category 1', spend({ naicsCode: '484121' }), ['spend_overlaps_other_category']],
      ['hotel code in category 1', spend({ naicsCode: '721110' }), ['spend_overlaps_other_category']],
      ['trade-sector code in category 1 (B6)', spend({ naicsCode: '423430' }), ['trade_sector_naics_maps_margin_only']],
      ['retail code in category 2', spend({ category: 2, naicsCode: '443142', capitalFullCost: true }), ['trade_sector_naics_maps_margin_only']],
      ['category 3 fuel proxy (I-12c not enabled)', spend({ category: 3, naicsCode: '324110', activityOverlap: 'none_confirmed' }), ['spend_proxy_for_category_3_not_enabled']],
      ['category 3 outside the fuel proxy set', spend({ category: 3, naicsCode: '541511', activityOverlap: 'none_confirmed' }), ['naics_not_valid_for_category', 'spend_proxy_for_category_3_not_enabled']],
      ['category 4 overlap not confirmed', spend({ category: 4, naicsCode: '484121' }), ['spend_overlap_not_confirmed']],
      ['category 6 overlap not confirmed', spend({ category: 6, naicsCode: '721110' }), ['spend_overlap_not_confirmed']],
      ['category 9 overlap not confirmed', record('purchase_spend', q('1', 'USD'), { ...DOWNSTREAM, activityOverlap: 'unknown' }), ['spend_overlap_not_confirmed']],
      ['category 9 paid by the company', record('purchase_spend', q('1', 'USD'), { ...DOWNSTREAM, paidByReportingCompany: true }), ['category_9_spend_paid_by_company']],
      ['capital good not at full cost', spend({ category: 2, naicsCode: '333120', capitalFullCost: null }), ['capital_goods_must_be_full_cost']],
      ['capital good marked not full cost', spend({ category: 2, naicsCode: '333120', capitalFullCost: false }), ['capital_goods_must_be_full_cost']],
      ['without margins, not at the factory gate', spend({ marginChoice: 'without_margins' }), ['without_margins_requires_factory_gate']],
      ['line date after the period', spend({ lineDate: '2026-01-01' }), ['spend_line_date_outside_reporting_period']],
      ['line date before the period', spend({ lineDate: '2024-12-31' }), ['spend_line_date_outside_reporting_period']],
      ['line date outside the setup period', spend({ lineDate: '2025-03-31' }, q('100000', 'USD'), { period: { start: '2025-04-01', endExclusive: '2026-04-01' } }), ['spend_line_date_outside_reporting_period'], { reportingPeriod: { start: '2025-04-01', endExclusive: '2026-04-01' } }],
      ['possible duplicate', spend({ importId: '30a00000-0000-4000-8000-000000000002', importRow: 3, mappingSource: 'file', possibleDuplicateOf: { importId: '30a00000-0000-4000-8000-000000000001', row: 1 } }), ['possible_duplicate_spend_line']],
      ['unusable setup period holds before deriving a dollar year', spend({ dollarYear: null }, q('1', 'USD')), ['activity_outside_reporting_period'], { reportingPeriod: { start: '2045-01-01', endExclusive: '2046-01-01' } }],
    ]
    for (const [label, v, reasons, options] of cases) {
      const p = plan(v, options)
      expect([label, p.action, p.status, p.reasons, p.call]).toEqual([label, 'hold', 'input_needed', reasons, null])
      for (const reason of reasons) expect([label, reason, typeof SCOPE3_REASON_TEXT_I03[reason] === 'string' || ['quantity_not_calculable', 'activity_outside_reporting_period'].includes(reason)]).toEqual([label, reason, true])
    }
    // The same lines once corrected are calculated: a confirmed distinct duplicate, a date inside the period, a confirmed category.
    for (const v of [spend({ possibleDuplicateOf: { importId: '30a00000-0000-4000-8000-000000000001', row: 1 }, duplicateConfirmedDistinct: true }), spend({ lineDate: '2025-12-31' }),
      spend({ naicsCode: '484121', categoryConfirmed: true }), spend({ category: 4, naicsCode: '482111', activityOverlap: 'none_confirmed' }), spend({ category: 6, naicsCode: '482111', activityOverlap: 'none_confirmed' })])
      expect([v.activity.sourceId, plan(v).action]).toEqual([v.activity.sourceId, 'calculate'])
  })
})

describe('I-03: supplier figures (purchase_supplier)', () => {
  test('product factors, allocated totals, the hybrid boundary and secondary factors reach the engine and are accepted', () => {
    const cases: Array<[Scope3CollectionVersion, string, string, string | null, string, string[]]> = [
      // 120 t x 1.850125 kg CO2e per t = 222.015.
      [supplier(), 'scope3.cat1_2.supplier_specific.v1', 'complete', '222.0150', 'met', ['supplier_gwp_basis_ar5']],
      // 200,000 kg x 0.15 kg CO2e per kg (GHGP CG 1.1 style), unverified: A20 note.
      [supplier({ factorValue: '0.15', factorUnit: 'kg CO2e per kg', verification: 'unverified' }, q('200000', 'kg')), 'scope3.cat1_2.supplier_specific.v1', 'complete', '30000.0000', 'met', ['supplier_data_unverified', 'supplier_gwp_basis_ar5']],
      // 145,000 kg x 2,500,000 / 100,000,000 = 3,625.
      [allocated(), 'scope3.cat1_2.supplier_specific.v1', 'complete', '3625.0000', 'met', ['supplier_gwp_basis_ar5']],
      // 12.5 t CO2e, allocated by the supplier: x 1,000 kg per t.
      [allocated({ category: 2, allocationBasis: 'supplier_allocated', allocationNumerator: null, allocationDenominator: null }, q('12.5', 'metric_ton CO2e')), 'scope3.cat1_2.supplier_specific.v1', 'complete', '12500.0000', 'met', ['supplier_gwp_basis_ar5']],
      // Hybrid (CG [1.2]): met only when upstream is covered by other records.
      [allocated({ boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: 'other_records', allocationNumerator: '1', allocationDenominator: '4' }, q('4000', 'kg CO2e')), 'scope3.cat1_2.supplier_specific.v1', 'complete', '1000.0000', 'met', ['hybrid_upstream_from_other_records', 'supplier_gwp_basis_ar5']],
      [allocated({ boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: 'none', allocationNumerator: '1', allocationDenominator: '4' }, q('4000', 'kg CO2e')), 'scope3.cat1_2.supplier_specific.v1', 'complete', '1000.0000', 'partial', ['hybrid_upstream_missing', 'supplier_gwp_basis_ar5']],
      // A21: a secondary database factor is average data, not supplier data.
      [supplier({ factorOrigin: 'secondary_database', verification: 'unverified' }), 'scope3.cat1_2.average_data_user_factor.v1', 'complete', '222.0150', 'met', ['factor_gwp_basis_ar5', 'user_supplied_secondary_factor_not_verified']],
      // Data-dependent findings come from the engine (never refusals): a boundary that may miss upstream, a share above one, a zero denominator.
      [allocated({ boundary: 'other' }), 'scope3.cat1_2.supplier_specific.v1', 'review_required', null, 'met', []],
      [allocated({ allocationNumerator: '5', allocationDenominator: '4' }), 'scope3.cat1_2.supplier_specific.v1', 'review_required', null, 'met', []],
      [allocated({ allocationNumerator: '5', allocationDenominator: '0' }), 'scope3.cat1_2.supplier_specific.v1', 'input_needed', null, 'met', []],
    ]
    const plans = cases.map(([v]) => plan(v))
    for (const p of plans) {
      expect([p.action, p.reasons]).toEqual(['calculate', []])
      expect(Object.keys(p.call!.request.input).sort()).toEqual(['allocationDenominator', 'allocationNumerator', 'basis', 'boundary', 'category', 'factorOrigin', 'factorUnit', 'factorValue', 'gwpBasis',
        'hybridUpstreamCoveredBy', 'period', 'quantity', 'unit', 'verification'])
    }
    const out = runAll(plans)
    cases.forEach(([v, method, status, display, boundary, notes], i) => {
      expect([v.activity.sourceId, out[i]!.status]).toEqual([v.activity.sourceId, 'ok'])
      const r = out[i]!.result!
      expect([r.methodVersionId, r.status, r.total?.display ?? null, r.gwpSetId]).toEqual([method, status, display, 'AS-REPORTED'])
      if (status === 'complete') expect([r.boundary.minimumBoundary, r.boundary.notes] as unknown[]).toEqual([boundary, notes])
      expect(r.input).toEqual(plans[i]!.call!.request.input)
    })
    expect(JSON.stringify(plans.map(p => p.call!.request.input))).not.toMatch(/supplierName|product"|dataYear|supersedesSpend|allocationBasis|dataQuality/)
  }, TIMEOUT)

  test('unit and allocation holds: never sent to an engine that would refuse them', () => {
    const cases: Array<[string, Scope3CollectionVersion, string[]]> = [
      ['unit not a token, factor per pallet, with a share', supplier({ factorUnit: 'kg CO2e per pallet', allocationBasis: 'physical', allocationNumerator: '1', allocationDenominator: '4' }, q('40', 'pallet', false)),
        ['quantity_not_calculable', 'unit_not_an_engine_token', 'allocation_not_applicable_to_product_factor']],
      ['factor per tonne, quantity in kg', supplier({}, q('120', 'kg')), ['factor_unit_mismatch']],
      ['factor written differently', supplier({ factorUnit: 'kgCO2e/metric_ton' }), ['factor_unit_mismatch']],
      ['product factor with a revenue share', supplier({ allocationBasis: 'revenue', allocationNumerator: '1', allocationDenominator: '2' }), ['allocation_not_applicable_to_product_factor']],
      ['allocated total in kg (not CO2e)', allocated({}, q('145000', 'kg')), ['unit_not_an_engine_token']],
      ['product factor with a CO2e quantity', supplier({ factorUnit: 'kg CO2e per kg CO2e' }, q('1', 'kg CO2e')), ['unit_not_an_engine_token']],
      ['quantity with four decimals', supplier({}, q('1.2345', 'metric_ton', false)), ['quantity_not_calculable']],
    ]
    for (const [label, v, reasons] of cases) {
      const p = plan(v)
      expect([label, p.action, p.status, p.reasons]).toEqual([label, 'hold', 'input_needed', reasons])
      for (const reason of reasons) expect([reason, typeof SCOPE3_REASON_TEXT_I03[reason] === 'string' || ['quantity_not_calculable', 'unit_not_an_engine_token'].includes(reason)]).toEqual([reason, true])
    }
  })
})

describe('I-03: every valid shared fixture and 300+ random records per kind reach the engine or are held (DESIGN 8.3)', () => {
  test('the shared payload fixtures of both kinds', () => {
    const versions = SCOPE3_PAYLOAD_FIXTURES.filter(f => f.valid && (f.kind === 'purchase_spend' || f.kind === 'purchase_supplier')).map(f => record(f.kind, f.quantity as ReturnType<typeof q>, f.payload))
    expect(versions.length).toBeGreaterThan(40)
    const plans = versions.map(v => plan(v))
    for (const p of plans) if (p.action === 'hold') expect(p.reasons.length).toBeGreaterThan(0)
    const calculated = plans.filter(p => p.action === 'calculate')
    expect(calculated.length).toBeGreaterThan(15)
    const out = runAll(calculated)
    out.forEach((item, i) => expect([calculated[i]!.sourceId, item.status, item.code]).toEqual([calculated[i]!.sourceId, 'ok', undefined]))
    // No new-kind record is held as "method not built" any more.
    expect(plans.flatMap(p => p.reasons)).not.toContain('method_not_built_yet')
  }, TIMEOUT)

  test('fuzz: 320 spend lines and 320 supplier figures with junk, blanks and unknowns; the boundary verifies the lot with random annotations', async () => {
    let seed = 20261030
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!
    const amounts = ['0', '1', '12.5', '999999999999.999', '0.001', '', 'unknown', '1,200', '-3', '1e3', '12.3456', '2500', '007', '48000', '125000.5', '3200']
    const anywhere = ['111130', '541511', '331110', '333120', '236220', '999999', '221100', '325211', '322211', '541611']
    const codes = [...new Set([...Object.values(SCOPE3_SPEND_NAICS_SETS).flat(), ...anywhere])]
    const versions: Scope3CollectionVersion[] = []
    for (let i = 0; i < 320; i++) {
      const category = pick(SCOPE3_SPEND_CATEGORIES)
      const nine = category === 9
      // Half the lines are clean (each field from its calculable values, so the engine is exercised widely); in the other
      // half every field is random. Quantities stay contract-valid: only USD is normalized; other currencies are kept as written.
      const clean = next() < 0.5
      const amount = clean ? pick(['1', '12.5', '48000', '125000.5', '3200', '999999999999.999', '0.001', '0']) : pick(amounts)
      const currency = clean || next() < 0.85 ? 'USD' : pick(['EUR', 'usd', ''])
      const allowed = (SCOPE3_SPEND_NAICS_SETS as Record<string, readonly string[]>)[({ 3: 'fuel_proxy', 4: 'freight', 5: 'waste', 6: 'passenger', 9: 'freight' } as Record<number, string>)[category] ?? '']
      const margin = pick(['with_margins', 'without_margins'] as const)
      versions.push(record('purchase_spend', q(amount, currency, currency === 'USD' && plain(amount)), {
        ...SPEND, category, naicsCode: clean ? pick(allowed ?? anywhere) : next() < 0.1 ? null : next() < 0.4 ? pick(anywhere) : pick(codes),
        dollarYear: pick([null, 2012, 2019, 2022, 2024, 2025, 2026, 2035]), marginChoice: margin,
        boughtAtFactoryGate: clean ? margin === 'without_margins' || next() < 0.5 : next() < 0.5, capitalFullCost: clean && category === 2 ? true : pick([null, true, false]),
        categoryConfirmed: next() < 0.3, activityOverlap: clean ? 'none_confirmed' : pick(SCOPE3_ACTIVITY_OVERLAP),
        paidByReportingCompany: nine ? !clean && next() < 0.3 : null, spendEstimateBasis: nine ? 'Rate cards' : null,
        lineDate: clean ? pick([null, '2025-06-30']) : pick([null, null, null, '2025-06-30', '2024-12-31', '2026-01-01']),
        possibleDuplicateOf: !clean && next() < 0.15 ? { importId: '30a00000-0000-4000-8000-000000000001', row: 1 } : null, duplicateConfirmedDistinct: next() < 0.5,
        ...(next() < 0.3 ? { dataQuality: { indicators: { technological: pick([null, 'poor', 'good']), temporal: null, geographical: null, completeness: null, reliability: pick([null, 'very_good']) }, activityDataOrigin: pick([null, 'value_chain_partner', 'estimate']), basis: null } } : {}),
      }, { locationId: clean ? office : pick([office, office, office, warehouse]) }))
      const product = next() < 0.5, unit = product ? pick([...SCOPE3_UNIT_FAMILIES.supplierProduct, 'pallet']) : pick([...SCOPE3_UNIT_FAMILIES.supplierAllocated, 'kg'])
      const supplierAllocated = next() < 0.6, boundary = pick(SCOPE3_SUPPLIER_BOUNDARIES)
      const supplied = pick(amounts)
      versions.push(record('purchase_supplier', q(supplied, unit, unit !== 'pallet' && plain(supplied)), {
        ...SUPPLIER, category: pick([1, 2]), basis: product ? 'product_factor' : 'allocated_total', factorValue: product ? pick(['0', '1.850125', '0.15', '999999999999.999999']) : null,
        factorUnit: product ? (next() < 0.8 ? `kg CO2e per ${unit}` : 'kg CO2e per unit') : null, allocationBasis: supplierAllocated ? 'supplier_allocated' : pick(['revenue', 'physical', 'other']),
        allocationNumerator: supplierAllocated ? null : pick(['0', '1', '5', '2500000']), allocationDenominator: supplierAllocated ? null : pick(['0', '4', '100000000']),
        boundary, hybridUpstreamCoveredBy: boundary === 'supplier_scope1_2_only' ? pick(SCOPE3_HYBRID_UPSTREAM_COVERAGE) : null, gwpBasis: pick(SCOPE3_GWP_BASES), verification: pick(SCOPE3_VERIFICATION),
        factorOrigin: pick(SCOPE3_FACTOR_ORIGINS),
        ...(next() < 0.3 ? { dataQuality: { indicators: { technological: null, temporal: null, geographical: null, completeness: null, reliability: pick([null, 'poor']) }, activityDataOrigin: pick([null, 'company_records', 'estimate']), basis: null } } : {}),
      }, { locationId: pick([office, office, office, warehouse]) }))
    }
    const plans = versions.map(v => plan(v))
    const calculated = plans.filter(p => p.action === 'calculate'), held = plans.filter(p => p.action === 'hold')
    for (const p of held) expect(p.reasons.length).toBeGreaterThan(0)
    const out = runAll(calculated)
    out.forEach((item, i) => expect([calculated[i]!.kind, item.status, item.code]).toEqual([calculated[i]!.kind, 'ok', undefined]))
    const byKind = (kind: string) => calculated.filter(p => p.kind === kind).length
    console.log(`fuzz: ${byKind('purchase_spend')} spend, ${byKind('purchase_supplier')} supplier calculated; ${held.length} held`)
    expect([byKind('purchase_spend') > 25, byKind('purchase_supplier') > 25, held.length > 200]).toEqual([true, true, true])
    // The boundary sends each result's annotation (from its payload) to the engine aggregate and checks every profile with
    // its own A19/A20 lookups; a disagreement with the engine would refuse the lot.
    const results = out.map(item => item.result!)
    const annotationOf = (p: Scope3CalculationPlan): Scope3Annotation => {
      const dq = (p.payload as { dataQuality?: { indicators: Scope3Annotation['dataQuality']; activityDataOrigin: Scope3Annotation['activityDataOrigin'] } | null }).dataQuality
      return dq ? { dataQuality: dq.indicators, activityDataOrigin: dq.activityDataOrigin } : { dataQuality: null, activityDataOrigin: null }
    }
    const rows: Scope3CoverageRecord[] = plans.map(p => {
      const i = calculated.indexOf(p)
      return { recordId: p.recordId, category: p.category, quality: 'actual', result: i >= 0 ? { outcome: 'calculated', resultSha256: results[i]!.resultSha256 } : { outcome: 'held', status: p.status!, reasons: p.reasons } }
    })
    const coverage = await scope3Coverage(rows, [], results, realEngine, pins, calculated.map(annotationOf))
    expect(coverage.categories.reduce((sum, row) => sum + row.counts.records, 0)).toBe(640)
    for (const code of coverage.disclosures.map(d => d.code)) expect(SCOPE3_DISCLOSURE_TEXT[code]).toBeString()
    console.log(`I-03 purchases fuzz: ${byKind('purchase_spend')} spend and ${byKind('purchase_supplier')} supplier records calculated by the engine, ${held.length} held with a named reason, 0 refused; all verified`)
  }, FUZZ_TIMEOUT)
})

describe('I-03: supersession (DESIGN §5.1, A22, B5a)', () => {
  const mappingKey = (line: { glAccount: string; supplierName: string; description: string }) => sha256(scope3SpendMappingKeyInput(line))
  const supersede = (versions: Scope3CollectionVersion[], reportingPeriod: { start: string; endExclusive: string } | null = year) => planScope3Supersession(versions, context, { reportingPeriod, sha256 })

  test('the mapping key is the one 0030 mappings store: GL account, vendor and description, trimmed, lower-cased, U+001F', () => {
    expect(scope3SpendMappingKeyInput({ glAccount: ' 6100 ', supplierName: 'Synthetic vendor', description: 'Software Consulting ' })).toBe('6100\u001fsynthetic vendor\u001fsoftware consulting')
    expect(mappingKey({ glAccount: '6100', supplierName: 'Synthetic vendor', description: 'Software consulting' })).toBe(sha256('6100\u001fsynthetic vendor\u001fsoftware consulting'))
  })

  test('a supplier record supersedes its supplier\'s category 1 and 2 lines by name or by mapping key, and nothing else', () => {
    const steel = (edits: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => spend({ supplierName: 'Synthetic  Steel co ', naicsCode: '331110', glAccount: '5100', description: 'Coil', ...edits }, q('50000', 'USD'), extra)
    const byName = steel(), capital = steel({ category: 2, naicsCode: '333120', capitalFullCost: true }), keyed = spend({ supplierName: 'Steel distributor', glAccount: '5200', description: 'Coil via distributor', naicsCode: '331110' })
    const freight = steel({ category: 4, naicsCode: '484121', activityOverlap: 'none_confirmed' }), other = spend({ supplierName: 'Synthetic Steel Company' }), withdrawn = steel({}, { state: 'withdrawn', withdrawalReason: 'Entered twice.' })
    const outside = steel({}, { period: { start: '2024-01-01', endExclusive: '2025-01-01' } }), elsewhere = steel({}, { locationId: warehouse })
    const figure = supplier({ supersedesSpend: { supplierName: 'synthetic steel CO', mappingKeys: [mappingKey({ glAccount: '5200', supplierName: 'Steel distributor', description: 'Coil via distributor' })] } })
    const all = [byName, capital, keyed, freight, other, withdrawn, outside, elsewhere, figure]
    const map = supersede(all)
    expect(Object.fromEntries(map)).toEqual({ [byName.recordId]: figure.recordId, [capital.recordId]: figure.recordId, [keyed.recordId]: figure.recordId })
    // Planned with the map: excluded with the reason and the superseding record named, never sent; the others unchanged.
    const p = plan(byName, { supersession: map })
    expect([p.action, p.status, p.reasons, p.notes, p.call]).toEqual(['hold', 'excluded', ['superseded_by_supplier_record'], ['spend_tax_treatment_excludes_sales_tax', `superseded_by:${figure.recordId}`], null])
    expect(plan(other, { supersession: map }).action).toBe('calculate')
    // The supplier record itself is calculated as usual.
    expect(plan(figure, { supersession: map }).action).toBe('calculate')
  })

  test('only an active, included supplier record inside the period supersedes; the smallest record ID is named; no period: same reporting year', () => {
    const line = spend({ supplierName: 'Acme Metals' })
    const figure = (extra: Record<string, unknown> = {}) => supplier({ supersedesSpend: { supplierName: 'ACME   metals', mappingKeys: [] } }, q('120', 'metric_ton'), extra)
    expect(supersede([line, figure({ state: 'withdrawn', withdrawalReason: 'Wrong supplier.' })]).size).toBe(0)
    expect(supersede([line, figure({ locationId: warehouse })]).size).toBe(0)
    expect(supersede([line, figure({ period: { start: '2024-01-01', endExclusive: '2025-01-01' } })]).size).toBe(0)
    expect(supersede([line, supplier({ supersedesSpend: null })]).size).toBe(0)
    const [a, b] = [figure(), figure()]
    expect(supersede([b, line, a]).get(line.recordId)).toBe([a, b].map(x => x.recordId).sort()[0]!)
    // Without a setup reporting period: same reporting year only.
    const nextYear = figure({ period: { start: '2026-01-01', endExclusive: '2027-01-01' } })
    expect(supersede([line, nextYear], null).size).toBe(0)
    expect(supersede([line, a], null).get(line.recordId)).toBe(a.recordId)
    // A blank supplier name on a line never matches by name.
    expect(supersede([spend({ supplierName: '' }), figure()]).size).toBe(0)
    expect(() => planScope3Supersession([{ ...line, companyId: crypto.randomUUID() }], context, { reportingPeriod: year, sha256 })).toThrow('another company')
  })
})

describe('I-03: the boundary applies A19 and A20 exactly as the engine (DESIGN 4.6)', () => {
  test('a spend annotation saying value-chain partner leaves the share unchanged; unverified supplier data use the unverified default', async () => {
    const lines = [spend({ naicsCode: '111130', dollarYear: 2022 }, q('1000', 'USD')), supplier({ factorValue: '0.15', factorUnit: 'kg CO2e per kg', verification: 'unverified' }, q('200000', 'kg')),
      allocated(), supplier({ factorOrigin: 'secondary_database' })]
    const plans = lines.map(v => plan(v))
    const results = runAll(plans).map(item => item.result!)
    const rows: Scope3CoverageRecord[] = plans.map((p, i) => ({ recordId: p.recordId, category: 1, quality: 'actual', result: { outcome: 'calculated', resultSha256: results[i]!.resultSha256 } }))
    // Annotations: the spend line claims value-chain data (ignored, A19), the secondary-factor line too (taken: average data).
    const annotations: Scope3Annotation[] = [{ dataQuality: null, activityDataOrigin: 'value_chain_partner' }, { dataQuality: null, activityDataOrigin: 'company_records' },
      { dataQuality: null, activityDataOrigin: null }, { dataQuality: null, activityDataOrigin: 'value_chain_partner' }]
    const coverage = await scope3Coverage(rows, [], results, realEngine, pins, annotations)
    expect(coverage.categories[0]!).toMatchObject({ status: 'calculated', support: 'engine', counts: { records: 4, calculated: 4 } })
    const profile = (await realEngine.aggregate(results, annotations)).categoryProfiles['1']!
    // Numerator: the two supplier figures (30,000 + 3,625) and the annotated average-data line (222.015); never the spend line (848).
    expect([profile.valueChain.numerator.display, profile.valueChain.denominator.display]).toEqual(['33847.0150', '34695.0150'])
    // A20: reliability of the unverified supplier figure (30,000 kg) is fair; the verified one (3,625) very good.
    expect(profile.dataQuality.indicators.reliability.ratingKg.very_good!.display).toBe('3625.0000')
    expect(profile.dataQuality.indicators.reliability.ratingKg.fair!.display).toBe('31070.0150')  // 30,000 unverified + 848 spend + 222.015 secondary
    expect(Object.keys(profile.methodTypes).sort()).toEqual(['activity_average_data', 'spend_based', 'supplier_specific'])
  }, TIMEOUT)
})

test('I-03: the adapter stays browser-safe (the collection screen plans records with it); hashing is passed in', () => {
  for (const file of ['./scope3-collection.ts', './scope3-collection-contract.ts', './scope3-assessment-contract.ts']) expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toMatch(/from ['"]node:/)
})
