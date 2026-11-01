// Scope 3 completion I-07 (DESIGN §5.1, §3.3, §4.4, §4.6, B5(d); Claude, 30 October 2026): fuels sold, energy-using products and
// products containing greenhouse gases (category 11), end of life by treatment split (12) and investments (15) from the
// collection contract to the real Scope 3 engine; the category 11/12 product overlap and the missing projected-lifetime notes
// as disclosures; biogenic CO2 and memo items checked by the trusted boundary and never in a total. Every contract-valid record
// either reaches the engine and is accepted, or is held with a named reason; no kind is held `method_not_built_yet` any more.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CollectionContext } from './collection-contract'
import { ENGINE_SUBREGIONS } from './collection-engine-input'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from './method-reference'
import {
  METHOD_NOT_BUILT, planScope3Calculation, planScope3ProductOverlap, SCOPE3_ATTRIBUTION_DENOMINATORS, SCOPE3_COLLECTION_KINDS, SCOPE3_COLLECTION_UNITS, SCOPE3_GHG_GASES, SCOPE3_HOLDING_TYPES,
  SCOPE3_INVESTMENT_PATHS, SCOPE3_OPTIONAL_HOLDING_TYPES, SCOPE3_SOLD_FUEL_UNITS, SCOPE3_SOLD_FUELS, SCOPE3_USE_REGIONS, SCOPE3_WASTE_MATERIALS, SCOPE3_WASTE_TREATMENTS,
  validateScope3Payload, type Scope3CalculationPlan, type Scope3CollectionActivity, type Scope3CollectionKind, type Scope3CollectionVersion, type Scope3PlanOptions,
} from './scope3-collection'
import { SCOPE3_PARTIAL_BOUNDARY_NOTES, SCOPE3_PLAN_NOTE_DISCLOSURES, type Scope3CoverageRecord, type Scope3EngineAggregate, type Scope3EngineResult } from './scope3-coverage'
import { scope3Coverage, scope3Digest, type Scope3AggregateEngine } from './scope3-engine-output'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_I07, SCOPE3_REASON_TEXT_I02, SCOPE3_REASON_TEXT_I03, SCOPE3_REASON_TEXT_I04, SCOPE3_REASON_TEXT_I05, SCOPE3_REASON_TEXT_I07 } from './scope3-text'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; results?: Array<{ status: string; code?: string; result?: Scope3EngineResult }>; catalog?: Record<string, any>; aggregate?: Scope3EngineAggregate }
}
const runAll = (plans: Scope3CalculationPlan[]) => plans.length ? engine({ action: 'calculate_many', requests: plans.map(plan => plan.call!.request) }).results! : []
const pins = { engineSha256: createHash('sha256').update(readFileSync(ENGINE)).digest('hex'), registerSha256: SCOPE3_REGISTER_2025_SHA256,
  additionalRegisterSha256s: { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } }
const realEngine: Scope3AggregateEngine = { aggregate: async (results, annotations) => {
  const out = engine(annotations ? { action: 'aggregate', results, annotations } : { action: 'aggregate', results })
  if (out.status !== 'ok') throw new Error(`refused: ${out.code}`)
  return out.aggregate!
} }
const TIMEOUT = 120_000, FUZZ_TIMEOUT = 300_000

const company = '93700000-0000-4000-8000-000000000001', setup = '93700000-0000-4000-8000-000000000002'
const office = '93700000-0000-4000-8000-000000000003', warehouse = '93700000-0000-4000-8000-000000000004'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [
  { id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' },
  { id: warehouse, name: 'Warehouse', inclusion: 'excluded', control: 'landlord', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
const year = { start: '2025-01-01', endExclusive: '2026-01-01' }
const plain = (value: string) => /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$/.test(value)
const q = (value: string, unit: string, normalized = plain(value)) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalized ? value : null, normalizedUnit: normalized ? unit : null })
const qk = (kind: Scope3CollectionKind, value: string, unit: string) => q(value, unit, plain(value) && SCOPE3_COLLECTION_UNITS[kind].includes(unit))
let n = 0
function record<K extends Scope3CollectionKind>(kind: K, quantity: ReturnType<typeof q>, payload: unknown, extra: Record<string, unknown> = {}): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `D-${n}`, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null,
    reference: 'Synthetic source', notes: '', evidenceIds: [], period: year, kind, quantity, payload: validateScope3Payload(kind, payload), ...extra } as unknown as Scope3CollectionActivity
  return { id: `93700000-0000-4000-8000-${String(10000 + n).padStart(12, '0')}`, recordId: `93700000-0000-4000-8000-${String(50000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: 'a'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}
const plan = (v: Scope3CollectionVersion, options: Scope3PlanOptions = {}) => planScope3Calculation(v, context, [], options)

// The shared fixture shapes (scope3-payload-fixtures.ts).
const FUEL = { fuel: 'propane', combustedInUse: 'yes' }
const PRODUCT = { productLabel: 'Synthetic 2 kW space heater', lifetimeBasis: 'years', lifetimeQuantity: '10', energyPerBasis: '1250.5', energyCarrier: 'electricity', energyUnit: 'kWh', useRegion: 'US', lifetimeSource: 'Manufacturer test standard' }
const GHG = { productLabel: 'Synthetic split AC unit', gas: 'R-410A', chargePerUnit: '2.75', chargeUnit: 'kg', useReleasePercent: '4', releaseBasis: 'Annual operating leak rate, EPA Vintaging Model, residential unitary AC' }
const SPLIT = { recycled: '75', landfilled: '20', combusted: '5', composted: '0', anaerobic_digestion_dry: '0', anaerobic_digestion_wet: '0' }
const EOL = { material: 'corrugated_containers', basis: 'packaging', split: SPLIT, splitBasis: 'EPA Facts and Figures 2018, containers and packaging', productLabel: 'Synthetic shipping box' }
const INVEST = { investeeName: 'Synthetic Solar Holdings', holdingType: 'equity_unlisted', path: 'investee_reported', attribution: { basis: 'equity_share_percent', percent: '12.5' }, investeeEmissions: '4930000',
  emissionsVerified: true, revenue: null, revenueYear: null, naicsCode: null, initialSponsor: false, projectedAnnual: null, lifetimeYears: null, snapshotDate: '2025-12-31', gwpBasis: 'AR5' }
const EEIO = { ...INVEST, path: 'revenue_eeio', investeeEmissions: null, emissionsVerified: null, revenue: '35000000', revenueYear: 2024, naicsCode: '541511' }
const PROJECT = { ...INVEST, holdingType: 'project_finance', path: 'project_reported', attribution: { basis: 'outstanding_over_denominator', denominatorType: 'total_project_cost', denominator: '80000000' },
  initialSponsor: true, projectedAnnual: '1200000', lifetimeYears: 25 }
const I07_KINDS = ['sold_fuel', 'sold_energy_product', 'sold_ghg_product', 'end_of_life_split', 'investment'] as const
const KNOWN_REASONS = new Set(['quantity_not_calculable', 'unit_not_an_engine_token', 'material_not_an_engine_token', 'location_inclusion_unknown', 'location_excluded_by_company_setup', 'record_withdrawn',
  ...Object.keys(SCOPE3_REASON_TEXT_I02), ...Object.keys(SCOPE3_REASON_TEXT_I03), ...Object.keys(SCOPE3_REASON_TEXT_I04), ...Object.keys(SCOPE3_REASON_TEXT_I05), ...Object.keys(SCOPE3_REASON_TEXT_I07)])

describe('I-07: the adapter constants equal the engine catalog (DESIGN §3.3, 8.3)', () => {
  test('each Table 1 fuel and its unit, gases, use regions, end-of-life treatments, holding types, paths and denominators', () => {
    const c = engine({ action: 'catalog' }).catalog!
    expect(c.soldFuelUnits).toEqual({ ...SCOPE3_SOLD_FUEL_UNITS })
    expect(Object.keys(SCOPE3_SOLD_FUEL_UNITS).sort()).toEqual([...SCOPE3_SOLD_FUELS])
    expect(c.ghgGases).toEqual([...SCOPE3_GHG_GASES])
    expect(c.useRegions).toEqual([...SCOPE3_USE_REGIONS, ...[...ENGINE_SUBREGIONS].sort()])
    expect([c.endOfLifeTreatments, c.holdingTypes, Object.keys(c.investmentPaths), c.attributionDenominators, c.optionalHoldingTypes])
      .toEqual([[...SCOPE3_WASTE_TREATMENTS], [...SCOPE3_HOLDING_TYPES], [...SCOPE3_INVESTMENT_PATHS].sort(), [...SCOPE3_ATTRIBUTION_DENOMINATORS], [...SCOPE3_OPTIONAL_HOLDING_TYPES]])
    expect([c.soldFuelUses, c.lifetimeBases, c.chargeUnits, c.endOfLifeBases, c.productElectricityUnits]).toEqual([['yes', 'no_feedstock'], ['years', 'uses'], ['kg', 'lb'], ['sold_products', 'packaging'], ['kWh', 'MWh']])
    expect(new Set(c.wasteMaterials.map((m: { id: string }) => m.id))).toEqual(new Set(SCOPE3_WASTE_MATERIALS))
  }, TIMEOUT)
})

describe('I-07: nothing is held method_not_built_yet (DESIGN 9 I-07)', () => {
  test('METHOD_NOT_BUILT is empty; every valid shared fixture of every kind, under each approach, is calculated and accepted or held with a named reason', () => {
    expect([...METHOD_NOT_BUILT]).toEqual([])
    let calculatedNew = 0
    for (const approach of ['operational_control', 'financial_control', 'equity_share'] as const) {
      const plans = SCOPE3_PAYLOAD_FIXTURES.filter(f => f.valid).map(f => plan(record(f.kind, f.quantity, f.payload), { consolidationApproach: approach, reportingPeriod: year }))
      expect(plans.flatMap(p => p.reasons)).not.toContain('method_not_built_yet')
      const calculated = plans.filter(p => p.action === 'calculate')
      runAll(calculated).forEach((item, i) => expect([calculated[i]!.kind, item.status, item.code ?? null]).toEqual([calculated[i]!.kind, 'ok', null]))
      // The I-07 kinds' holds have their texts here (the 0029 kinds' wording lives in the web's plain-language table).
      for (const p of plans.filter(x => x.action === 'hold' && x.status === 'input_needed' && (I07_KINDS as readonly string[]).includes(x.kind))) for (const reason of p.reasons) expect([p.kind, reason, KNOWN_REASONS.has(reason)]).toEqual([p.kind, reason, true])
      calculatedNew += calculated.filter(p => (I07_KINDS as readonly string[]).includes(p.kind)).length
    }
    // Every I-07 kind has valid fixtures that reach the engine (the unknown-token fixtures are held).
    expect(calculatedNew).toBeGreaterThan(3 * 25)
    expect(SCOPE3_COLLECTION_KINDS.every(kind => !METHOD_NOT_BUILT.has(kind))).toBe(true)
  }, TIMEOUT)
})

describe('I-07: engine inputs and holds before the engine (DESIGN §5.1)', () => {
  test('each kind sends exactly the engine keys; labels, bases, names and dates are never sent', () => {
    const keys = (v: Scope3CollectionVersion) => Object.keys(plan(v, { reportingPeriod: year }).call!.request.input).sort()
    expect(keys(record('sold_fuel', q('120000', 'US_gallon'), FUEL))).toEqual(['combustedInUse', 'fuel', 'period', 'quantity', 'unit'])
    expect(keys(record('sold_energy_product', q('5000', 'unit'), PRODUCT))).toEqual(['energyCarrier', 'energyPerBasis', 'energyUnit', 'lifetimeBasis', 'lifetimeQuantity', 'period', 'quantity', 'useRegion'])
    expect(keys(record('sold_ghg_product', q('1200', 'unit'), GHG))).toEqual(['chargePerUnit', 'chargeUnit', 'gas', 'period', 'quantity', 'useReleasePercent'])
    expect(keys(record('end_of_life_split', q('85.5', 'short_ton'), EOL))).toEqual(['basis', 'material', 'period', 'quantity', 'split', 'unit'])
    const invest = plan(record('investment', q('2500000', 'USD'), INVEST)).call!.request.input
    expect(invest).toEqual({ period: year, path: 'investee_reported', holdingType: 'equity_unlisted', outstandingAmount: '2500000', attribution: { basis: 'equity_share_percent', percent: '12.5' },
      investeeEmissions: '4930000', emissionsVerified: true, gwpBasis: 'AR5', revenue: null, revenueYear: null, naicsCode: null, projectedAnnual: null, lifetimeYears: null })
    // A revenue-based record sends its revenue fields and nothing reported; a missing revenue year becomes the reporting year (listed).
    const eeio = plan(record('investment', q('1000000', 'USD'), { ...EEIO, revenueYear: null, emissionsVerified: true, gwpBasis: 'AR5' }), { reportingPeriod: year })
    expect([eeio.call!.request.input.revenueYear, eeio.call!.request.input.investeeEmissions, eeio.call!.request.input.gwpBasis, eeio.notes]).toEqual([2025, null, null, ['revenue_year_from_reporting_year']])
    // Projected lifetime emissions go to the engine only for an initial sponsor and only both together; otherwise a disclosure note.
    expect(plan(record('investment', q('20000000', 'USD'), PROJECT)).call!.request.input).toMatchObject({ projectedAnnual: '1200000', lifetimeYears: 25 })
    const missing = plan(record('investment', q('20000000', 'USD'), { ...PROJECT, lifetimeYears: null }))
    expect([missing.action, missing.call!.request.input.projectedAnnual, missing.notes]).toEqual(['calculate', null, ['projected_lifetime_emissions_not_provided']])
    expect(plan(record('investment', q('20000000', 'USD'), { ...PROJECT, initialSponsor: false })).call!.request.input).toMatchObject({ projectedAnnual: null, lifetimeYears: null })
    for (const v of [record('sold_fuel', q('1', 'MMBtu'), FUEL), record('sold_ghg_product', q('1', 'unit'), GHG), record('end_of_life_split', q('1', 'kg'), EOL), record('investment', q('1', 'USD'), PROJECT)])
      expect(JSON.stringify(plan(v).call!.request.input)).not.toMatch(/Synthetic|EPA Vintaging|Facts and Figures|Manufacturer|2025-12-31|initialSponsor/)
  })

  test('every I-07 hold, one at a time, with its own reason and its text; the engine decides the data-dependent cases', () => {
    const cases: Array<[string, Scope3CollectionVersion, string[]]> = [
      ['fuel not in Table 1', record('sold_fuel', q('1', 'MMBtu'), { ...FUEL, fuel: 'hydrogen' }), ['sold_fuel_not_an_engine_token']],  // round 2, lane F: its own code
      ['propane in scf (its unit is gallons)', record('sold_fuel', q('1', 'scf'), FUEL), ['unit_not_the_fuels_unit']],
      ['fuel quantity as written', record('sold_fuel', q('1,200', 'US_gallon', false), FUEL), ['quantity_not_calculable']],
      ['product units in boxes', record('sold_energy_product', q('5', 'box', false), PRODUCT), ['quantity_not_calculable', 'unit_not_an_engine_token']],
      ['product steam', record('sold_energy_product', q('5', 'unit'), { ...PRODUCT, energyCarrier: 'steam' }), ['energy_carrier_not_an_engine_token']],
      ['product electricity in therms', record('sold_energy_product', q('5', 'unit'), { ...PRODUCT, energyUnit: 'therm' }), ['energy_unit_not_an_engine_token']],
      ['product propane in scf', record('sold_energy_product', q('5', 'unit'), { ...PRODUCT, energyCarrier: 'propane', energyUnit: 'scf' }), ['energy_unit_not_an_engine_token']],
      ['product used in "Europe"', record('sold_energy_product', q('5', 'unit'), { ...PRODUCT, useRegion: 'Europe' }), ['use_region_not_an_engine_token']],
      ['ghg product HCFC-22', record('sold_ghg_product', q('5', 'unit'), { ...GHG, gas: 'HCFC-22' }), ['gas_not_an_engine_token']],
      ['ghg product in kg', record('sold_ghg_product', q('5', 'kg', false), GHG), ['quantity_not_calculable', 'unit_not_an_engine_token']],
      ['end of life unknown material', record('end_of_life_split', q('5', 'kg'), { ...EOL, material: 'unobtainium' }), ['material_not_an_engine_token']],
      ['end of life in tonnes as written', record('end_of_life_split', q('5', 'tonne', false), EOL), ['quantity_not_calculable', 'unit_not_an_engine_token']],
      // PR22 bug hunt A-1: a share above 100% is contract-valid (DEC3) but the engine refuses it (`invalid_split`), so the line
      // became "unavailable" with a "try again" warning. It can never total 100%, so it is held here, as commuting shares are.
      ['end of life share above 100%', record('end_of_life_split', q('5', 'kg'), { ...EOL, split: { ...SPLIT, recycled: '150', landfilled: '100.001' } }), ['treatment_split_must_total_100']],
      ['investment in EUR', record('investment', q('5', 'EUR', false), INVEST), ['quantity_not_calculable', 'investment_currency_not_supported']],
      ['revenue missing', record('investment', q('5', 'USD'), { ...EEIO, revenue: null }), ['investee_revenue_required']],
      ['investee NAICS missing', record('investment', q('5', 'USD'), { ...EEIO, naicsCode: null }), ['investee_naics_code_required']],
    ]
    for (const [label, v, reasons] of cases) {
      const p = plan(v, { reportingPeriod: year })
      expect([label, p.action, p.status, p.reasons, p.call]).toEqual([label, 'hold', 'input_needed', reasons, null])
      for (const reason of reasons) expect([reason, KNOWN_REASONS.has(reason)]).toEqual([reason, true])
    }
    // The engine holds what depends on the data, with its own finding (never a refusal of contract-valid input).
    const engineHeld: Array<[string, Scope3CollectionVersion, string[]]> = [
      ['electricity used outside the U.S.', record('sold_energy_product', q('5', 'unit'), { ...PRODUCT, useRegion: 'non_US' }), ['use_region_outside_us']],
      ['unknown split', record('end_of_life_split', q('85.5', 'short_ton'), { ...EOL, split: null, splitBasis: null }), ['treatment_split_unknown']],
      ['split of 99%', record('end_of_life_split', q('85.5', 'short_ton'), { ...EOL, split: { ...SPLIT, recycled: '74' } }), ['treatment_split_must_total_100']],
      ['investee emissions missing', record('investment', q('5', 'USD'), { ...INVEST, investeeEmissions: null }), ['investee_emissions_required']],
      ['equity share over 100%', record('investment', q('5', 'USD'), { ...INVEST, attribution: { basis: 'equity_share_percent', percent: '120' } }), ['attribution_share_exceeds_one']],
      ['EVIC of zero', record('investment', q('5', 'USD'), { ...INVEST, attribution: { basis: 'outstanding_over_denominator', denominatorType: 'evic', denominator: '0' } }), ['attribution_denominator_zero']],
      ['revenue of 2026 (no index yet)', record('investment', q('5', 'USD'), { ...EEIO, revenueYear: 2026 }), ['revenue_year_index_missing']],
    ]
    const plans = engineHeld.map(([, v]) => plan(v, { reportingPeriod: year }))
    runAll(plans).forEach((item, i) => {
      expect([engineHeld[i]![0], item.status, item.result!.findings, item.result!.total]).toEqual([engineHeld[i]![0], 'ok', engineHeld[i]![2], null])
      for (const finding of item.result!.findings) expect([finding, typeof SCOPE3_REASON_TEXT_I07[finding]]).toEqual([finding, 'string'])
    })
  }, TIMEOUT)
})

// PR 22 integration (S-2; Claude, 1 November 2026): in a fiscal year spanning two calendar years, a revenue-based investment
// without a revenue year whose own period ends in the first calendar year was given the fiscal year's end year; the engine
// then held it `revenue_year_index_missing`, although the index of that year is registered. The default is now the year the
// record's own period ends in; a record covering the whole reporting period keeps the reporting year (as before).
describe('integration S-2: a revenue-based investment without a revenue year in a fiscal year', () => {
  test('uses the year its own period ends in, and is calculated as with that revenue year', () => {
    const fiscal = { start: '2025-07-01', endExclusive: '2026-07-01' }
    const holding = (period: { start: string; endExclusive: string }, revenueYear: number | null = null) => record('investment', q('1000000', 'USD'), { ...EEIO, revenueYear, snapshotDate: '2025-09-30' }, { period })
    const quarter = { start: '2025-07-01', endExclusive: '2025-10-01' }
    const plans = [holding(quarter), holding(quarter, 2025), holding(fiscal)].map(v => plan(v, { reportingPeriod: fiscal }))
    expect(plans.map(p => [p.action, p.call?.request.input.revenueYear ?? null, p.notes.filter(note => note.startsWith('revenue_year'))])).toEqual([
      ['calculate', 2025, ['revenue_year_from_record_period']], ['calculate', 2025, []], ['calculate', 2026, ['revenue_year_from_reporting_year']]])
    expect(SCOPE3_REASON_TEXT_I07.revenue_year_from_record_period).toBe('No revenue year was given, so the year in which this record’s own period ends was used.')
    const [own, stated, whole] = runAll(plans).map(item => item.result!)
    expect([own!.status, own!.findings, own!.total?.display]).toEqual([stated!.status, [], stated!.total?.display])
    expect([whole!.status, whole!.findings, whole!.boundary.notes.includes('price_index_latest_published_year_used')]).toEqual(['complete', [], true])
  }, TIMEOUT)
})

describe('I-07: 320 random records per kind reach the engine or are held, and the boundary verifies them (DESIGN 8.3)', () => {
  test('fuzz: 320 records of each kind with junk, blanks and unknowns', async () => {
    let seed = 20261107
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!
    const amounts = ['0', '1', '12.5', '999999.999', '0.001', '', 'unknown', '1,200', '-3', '48000', '125000.5']
    const dq = () => next() < 0.3 ? { dataQuality: { indicators: { technological: pick([null, 'poor', 'good']), temporal: null, geographical: null, completeness: null, reliability: pick([null, 'very_good', 'fair']) },
      activityDataOrigin: pick([null, 'value_chain_partner', 'estimate', 'company_records']), basis: null } } : {}
    const fuels = [...SCOPE3_SOLD_FUELS, 'hydrogen', '']
    const versions: Scope3CollectionVersion[] = []
    for (let i = 0; i < 320; i++) {
      const extra = { locationId: pick([office, office, office, warehouse]) }
      const amt = pick(amounts)
      const fuel = pick(fuels)
      versions.push(record('sold_fuel', qk('sold_fuel', amt, pick([SCOPE3_SOLD_FUEL_UNITS[fuel] ?? 'scf', 'MMBtu', 'scf', 'US_gallon', 'short_ton'])), { fuel, combustedInUse: pick(['yes', 'yes', 'no_feedstock']), ...dq() }, extra))
      const carrier = pick(['electricity', 'electricity', 'natural_gas', 'propane', 'wood_and_wood_residuals', 'steam'])
      const units = carrier === 'electricity' ? ['kWh', 'MWh', 'therm'] : [SCOPE3_SOLD_FUEL_UNITS[carrier] ?? 'MMBtu', 'MMBtu', 'kWh']
      versions.push(record('sold_energy_product', qk('sold_energy_product', pick(['1', '5000', '12.5', 'unknown', '0']), pick(['unit', 'unit', 'box'])), { ...PRODUCT, lifetimeBasis: pick(['years', 'uses']),
        lifetimeQuantity: pick(['0', '1', '10', '31', '2000']), energyPerBasis: pick(['0', '0.3', '1250.5', '60000']), energyCarrier: carrier, energyUnit: pick(units),
        useRegion: pick([...SCOPE3_USE_REGIONS, 'CAMX', 'ERCT', 'NYCW', 'Europe']), ...dq() }, extra))
      versions.push(record('sold_ghg_product', qk('sold_ghg_product', pick(['1', '1200', '12.5', 'unknown']), pick(['unit', 'unit', 'kg'])), { ...GHG, gas: pick(['R-410A', 'HFC-134a', 'R-406A', 'SF6', 'HCFC-22', '']),
        chargePerUnit: pick(['0', '0.5', '2.75', '120']), chargeUnit: pick(['kg', 'lb']), useReleasePercent: pick(['0', '2.5', '4', '99.999', '100']), ...dq() }, extra))
      const shares = pick([SPLIT, { ...SPLIT, recycled: '74' }, { ...SPLIT, recycled: '0', landfilled: '100' }, { ...SPLIT, recycled: '65', composted: '10' }, null])
      versions.push(record('end_of_life_split', qk('end_of_life_split', amt, pick(['short_ton', 'lb', 'kg', 'metric_ton', 'tonne'])), { ...EOL, material: pick([...SCOPE3_WASTE_MATERIALS.slice(0, 20), 'unobtainium']),
        basis: pick(['sold_products', 'packaging']), split: shares, splitBasis: shares === null ? null : EOL.splitBasis, ...dq() }, extra))
      const path = pick(SCOPE3_INVESTMENT_PATHS)
      const attribution = next() < 0.5 ? { basis: 'equity_share_percent', percent: pick(['0', '12.5', '40', '100', '120']) }
        : { basis: 'outstanding_over_denominator', denominatorType: pick(SCOPE3_ATTRIBUTION_DENOMINATORS), denominator: pick(['0', '1', '125000000', '80000000']) }
      const sponsor = next() < 0.3
      versions.push(record('investment', qk('investment', pick(['1', '2500000', '20000000', 'unknown']), pick(['USD', 'USD', 'EUR'])), { ...INVEST, holdingType: pick(SCOPE3_HOLDING_TYPES), path, attribution,
        investeeEmissions: path === 'revenue_eeio' ? null : pick([null, '0', '4930', '7000000']), emissionsVerified: pick([true, false, null]), revenue: path === 'revenue_eeio' ? pick([null, '35000000', '1']) : null,
        revenueYear: pick([null, 2012, 2022, 2024, 2026]), naicsCode: path === 'revenue_eeio' ? pick([null, '541511', '531120', '221100']) : null, initialSponsor: sponsor,
        projectedAnnual: pick([null, '1200000']), lifetimeYears: pick([null, 25, 60]), gwpBasis: pick(['AR4', 'AR5', 'AR6', 'unknown']), ...dq() }, extra))
    }
    const plans = versions.map(v => plan(v, { reportingPeriod: year, consolidationApproach: pick(['operational_control', 'equity_share', null] as const) }))
    const calculated = plans.filter(p => p.action === 'calculate'), held = plans.filter(p => p.action === 'hold')
    const out = runAll(calculated)
    out.forEach((item, i) => expect([calculated[i]!.kind, item.status, item.code ?? null]).toEqual([calculated[i]!.kind, 'ok', null]))
    for (const p of held) for (const reason of p.reasons) expect([reason, KNOWN_REASONS.has(reason)]).toEqual([reason, true])
    expect(plans.flatMap(p => p.reasons)).not.toContain('method_not_built_yet')
    const byKind = (kind: string) => calculated.filter(p => p.kind === kind).length
    for (const kind of I07_KINDS) expect([kind, byKind(kind) > 25]).toEqual([kind, true])
    const results = out.map(item => item.result!)
    const rows: Scope3CoverageRecord[] = plans.map(p => {
      const i = calculated.indexOf(p)
      return { recordId: p.recordId, category: p.category, quality: 'actual', kind: p.kind, result: i >= 0 ? { outcome: 'calculated', resultSha256: results[i]!.resultSha256 } : { outcome: 'held', status: p.status as 'input_needed', reasons: p.reasons } }
    })
    const annotationOf = (p: Scope3CalculationPlan) => {
      const d = (p.payload as { dataQuality?: { indicators: never; activityDataOrigin: never } | null }).dataQuality
      return d ? { dataQuality: d.indicators, activityDataOrigin: d.activityDataOrigin } : { dataQuality: null, activityDataOrigin: null }
    }
    const coverage = await scope3Coverage(rows, [], results, realEngine, pins, calculated.map(annotationOf))
    expect(coverage.categories.reduce((sum, row) => sum + row.counts.records, 0)).toBe(1600)
    for (const code of coverage.disclosures.map(d => d.code)) expect([code, typeof SCOPE3_DISCLOSURE_TEXT[code]]).toEqual([code, 'string'])
    // No I-07 method makes a result partial; the biogenic CO2 of category 11 and the memo items of 15 are summed, in no total.
    expect(results.filter(r => r.status === 'complete' && r.boundary.minimumBoundary === 'partial').map(r => r.methodVersionId)).toEqual([])
    expect(results.every(r => r.boundary.notes.every(note => !SCOPE3_PARTIAL_BOUNDARY_NOTES.includes(note)))).toBe(true)
    const eleven = coverage.categories[10]!
    expect(eleven.profile?.biogenicCo2).not.toBeNull()
    const biogenic = results.filter(r => r.status === 'complete' && r.biogenicCo2).map(r => r.biogenicCo2!.mass)
    expect(biogenic.length).toBeGreaterThan(0)
    console.log(`I-07 fuzz: ${I07_KINDS.map(k => `${byKind(k)} ${k}`).join(', ')} calculated by the engine; ${held.length} held with a named reason; 0 refused; all verified; ${biogenic.length} with biogenic CO2`)
  }, FUZZ_TIMEOUT)
})

describe('I-07: the category 11 / 12 product overlap and the projected-lifetime note are disclosures, never holds (DESIGN §5.1, B5(d))', () => {
  test('the same product released in full during use and recorded at end of life: both records noted, both categories disclosed', async () => {
    const full = record('sold_ghg_product', q('1200', 'unit'), { ...GHG, productLabel: '  Synthetic SPLIT   ac unit ', useReleasePercent: '100.000', releaseBasis: 'Aerosol: the whole charge is released in use' })
    const partly = record('sold_ghg_product', q('1200', 'unit'), { ...GHG, productLabel: 'Synthetic heat pump', useReleasePercent: '99.999' })
    const endOfLife = record('end_of_life_split', q('12', 'short_ton'), { ...EOL, basis: 'sold_products', productLabel: 'Synthetic split AC unit' })
    const heatPumpEnd = record('end_of_life_split', q('12', 'short_ton'), { ...EOL, basis: 'sold_products', productLabel: 'Synthetic heat pump' })
    const blank = record('end_of_life_split', q('1', 'short_ton'), { ...EOL, productLabel: '' })
    const withdrawn = record('sold_ghg_product', q('1', 'unit'), { ...GHG, productLabel: 'Synthetic heat pump', useReleasePercent: '100' }, { state: 'withdrawn', withdrawalReason: 'Entered twice.' })
    const elsewhere = record('sold_ghg_product', q('1', 'unit'), { ...GHG, productLabel: 'Synthetic shipping box', useReleasePercent: '100' }, { locationId: warehouse })
    const versions = [full, partly, endOfLife, heatPumpEnd, blank, withdrawn, elsewhere]
    const overlap = planScope3ProductOverlap(versions, context, { reportingPeriod: year })
    expect([...overlap].sort()).toEqual([full.recordId, endOfLife.recordId].sort())
    const plans = versions.map(v => plan(v, { reportingPeriod: year, productOverlap: overlap }))
    expect(plans.map(p => p.notes.includes('same_product_in_cat11_ghg_release'))).toEqual([true, false, true, false, false, false, false])
    expect(plans.filter(p => p.notes.includes('same_product_in_cat11_ghg_release')).every(p => p.action === 'calculate')).toBe(true)
    const calculated = plans.filter(p => p.action === 'calculate')
    const results = runAll(calculated).map(item => item.result!)
    const rows: Scope3CoverageRecord[] = plans.map(p => {
      const i = calculated.indexOf(p)
      const notes = p.notes.filter(note => SCOPE3_PLAN_NOTE_DISCLOSURES.includes(note))
      return { recordId: p.recordId, category: p.category, quality: 'actual', kind: p.kind, ...(notes.length ? { notes } : {}),
        result: i >= 0 ? { outcome: 'calculated', resultSha256: results[i]!.resultSha256 } : { outcome: 'held', status: p.status as 'withdrawn' | 'excluded', reasons: p.reasons } }
    })
    const coverage = await scope3Coverage(rows, [], results, realEngine, pins)
    expect(coverage.disclosures.find(d => d.code === 'same_product_in_cat11_ghg_release')).toEqual({ code: 'same_product_in_cat11_ghg_release', categories: [11, 12], text: SCOPE3_DISCLOSURE_TEXT_I07.same_product_in_cat11_ghg_release! })
    expect([coverage.categories[10]!.status, coverage.categories[11]!.status]).toEqual(['calculated', 'calculated'])
    // A note on a line that does not count (withdrawn) discloses nothing; without the pre-pass nothing is noted.
    const noted = new Set([full.recordId, endOfLife.recordId])
    const quiet = await scope3Coverage(rows.map(r => noted.has(r.recordId) ? { ...r, result: { outcome: 'held', status: 'withdrawn', reasons: ['record_withdrawn'] } } as Scope3CoverageRecord : r),
      [], results.filter((_, i) => !noted.has(calculated[i]!.recordId)), realEngine, pins)
    expect(quiet.disclosures.map(d => d.code)).not.toContain('same_product_in_cat11_ghg_release')
    expect(plan(endOfLife, { reportingPeriod: year }).notes).not.toContain('same_product_in_cat11_ghg_release')
  }, TIMEOUT)

  test('an initial sponsor without projected lifetime emissions is disclosed on category 15 and still calculated', async () => {
    const p = plan(record('investment', q('20000000', 'USD'), { ...PROJECT, projectedAnnual: null }), { reportingPeriod: year })
    const [result] = runAll([p]).map(item => item.result!)
    const coverage = await scope3Coverage([{ recordId: p.recordId, category: 15, quality: 'actual', kind: 'investment', notes: ['projected_lifetime_emissions_not_provided'], result: { outcome: 'calculated', resultSha256: result!.resultSha256 } }],
      [{ category: 15, decision: 'included', reason: null }], [result!], realEngine, pins)
    expect(coverage.categories[14]!.disclosures).toContain('projected_lifetime_emissions_not_provided')
    expect([coverage.categories[14]!.status, result!.memoItems]).toEqual(['calculated', undefined])
  }, TIMEOUT)
})

describe('I-07: biogenic CO2 and memo items at the trusted boundary (DESIGN 4.6, D6)', () => {
  const build = () => {
    const versions = [record('sold_fuel', q('1000', 'US_gallon'), { fuel: 'biodiesel_100', combustedInUse: 'yes' }), record('sold_fuel', q('1000', 'US_gallon'), { fuel: 'motor_gasoline', combustedInUse: 'yes' }),
      record('investment', q('20000000', 'USD'), PROJECT)]
    const plans = versions.map(v => plan(v, { reportingPeriod: year }))
    const results = runAll(plans).map(item => item.result!)
    const rows: Scope3CoverageRecord[] = plans.map((p, i) => ({ recordId: p.recordId, category: p.category, quality: 'actual', kind: p.kind, result: { outcome: 'calculated', resultSha256: results[i]!.resultSha256 } }))
    return { rows, results }
  }
  test('genuine output passes: biogenic CO2 per category and memo items outside every total', async () => {
    const { rows, results } = build()
    const coverage = await scope3Coverage(rows, [], results, realEngine, pins)
    const [bio, gas, project] = results
    // Exact sums of the engine's decimal strings (30 fractional digits is more than any total carries).
    const exact = (text: string) => { const [whole, fraction = ''] = text.split('.'); return BigInt(whole! + fraction.padEnd(30, '0')) }
    const sum = (values: string[]) => values.reduce((total, value) => total + exact(value), 0n)
    expect(coverage.categories[10]!.profile!.biogenicCo2!.unrounded).toBe(bio!.biogenicCo2!.mass)
    expect(sum([coverage.categories[10]!.subtotal!.unrounded])).toBe(sum([bio!.total!.unrounded, gas!.total!.unrounded]))
    expect(sum([coverage.knownSourceSubtotal!.unrounded])).toBe(sum([bio!.total!.unrounded, gas!.total!.unrounded, project!.total!.unrounded]))
    expect(coverage.categories[14]!.profile!.memoItems).toEqual({ projected_lifetime_emissions: { unrounded: project!.memoItems![0]!.kg, display: expect.any(String), unit: 'kg CO2e', rounding: 'half_even_4dp_once' } })
    expect(coverage.categories[14]!.profile!.biogenicCo2).toBeNull()
    expect(coverage.disclosures.map(d => d.code)).toEqual(expect.arrayContaining(['biogenic_co2_reported_separately', 'projected_lifetime_emissions_reported_separately', 'mixed_gwp_sets_including_reported']))
  }, TIMEOUT)

  test('tampered results and profiles are refused: biogenic CO2 as a gas or in the profile, memo items changed', async () => {
    const { rows, results } = build()
    const genuine = await realEngine.aggregate(results)
    const rehash = <T extends { resultSha256?: string; aggregateSha256?: string }>(value: T, key: 'resultSha256' | 'aggregateSha256'): T => {
      const { [key]: _, ...body } = value as Record<string, unknown>
      return { ...value, [key]: scope3Digest(body) }
    }
    const withResult = (i: number, change: (r: Scope3EngineResult) => void) => {
      const copy = structuredClone(results)
      change(copy[i]!)
      copy[i] = rehash(copy[i]!, 'resultSha256')
      return scope3Coverage(rows.map((row, k) => k === i ? { ...row, result: { outcome: 'calculated', resultSha256: copy[i]!.resultSha256 } } as Scope3CoverageRecord : row), [], copy, realEngine, pins)
    }
    const withAggregate = (change: (a: Scope3EngineAggregate) => void) => {
      const a = structuredClone(genuine)
      change(a)
      return scope3Coverage(rows, [], results, { aggregate: async () => rehash(a, 'aggregateSha256') }, pins)
    }
    const probes: Array<[string, () => Promise<unknown>, string]> = [
      ['biogenic CO2 moved into the gases', () => withResult(0, r => { r.gases.co2 = { mass: r.biogenicCo2!.mass, massUnit: 'kg CO2', co2e: r.biogenicCo2!.mass, co2eUnit: 'kg CO2e' } }), 'biogenic CO2'],
      ['biogenic CO2 with an extra key', () => withResult(0, r => { (r.biogenicCo2 as Record<string, unknown>).co2e = '1' }), 'biogenic CO2'],
      ['biogenic CO2 negative', () => withResult(0, r => { r.biogenicCo2!.mass = `-${r.biogenicCo2!.mass}` }), 'biogenic CO2'],
      ['biogenic CO2 beside a fossil fuel\'s CO2', () => withResult(1, r => { (r as unknown as Record<string, unknown>).biogenicCo2 = { mass: '1', massUnit: 'kg CO2', basis: 'x' } }), 'biogenic CO2'],
      ['biogenic CO2 changed', () => withResult(0, r => { r.biogenicCo2!.mass = '1' }), 'the engine did not verify'],
      ['memo item in another unit', () => withResult(2, r => { r.memoItems![0]!.unit = 'kg CO2' as 'kg CO2e' }), 'memo items'],
      ['memo item twice', () => withResult(2, r => { r.memoItems!.push({ ...r.memoItems![0]! }) }), 'memo items'],
      ['memo item not reported separately', () => withResult(2, r => { (r.memoItems![0] as Record<string, unknown>).reportedSeparately = false }), 'memo items'],
      ['profile biogenic CO2 changed', () => withAggregate(a => { a.categoryProfiles['11']!.biogenicCo2!.unrounded = '1' }), 'profile biogenic CO2'],
      ['profile biogenic CO2 removed', () => withAggregate(a => { a.categoryProfiles['11']!.biogenicCo2 = null }), 'profile biogenic CO2'],
      ['profile memo item changed', () => withAggregate(a => { a.categoryProfiles['15']!.memoItems.projected_lifetime_emissions!.unrounded = '1' }), 'profile memo item'],
      ['profile memo item dropped', () => withAggregate(a => { a.categoryProfiles['15']!.memoItems = {} }), 'profile memo items'],
      ['memo item added to the category subtotal', () => withAggregate(a => { a.categorySubtotals['15']!.unrounded = a.categoryProfiles['15']!.memoItems.projected_lifetime_emissions!.unrounded }), 'subtotal is not the sum'],
    ]
    for (const [label, run, reason] of probes) {
      let message = 'accepted'
      try { await run() } catch (error) { message = (error as Error).message }
      expect([label, message.startsWith('Scope 3 engine output refused') && message.includes(reason)]).toEqual([label, true])
    }
  }, TIMEOUT)
})
