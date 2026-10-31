// Scope 3 round 2, lane A (ROUND2.md owner decisions 1-4; ACC-5, ACC-14; Claude, 31 October 2026): the collection contract's
// Scope 3 period envelope, the adapter's period holds (setup reporting period, else calendar 2025), therms for natural gas
// products, the zero-mapped-share hold of upstream electricity lines, buildings as a documentable within-category exclusion,
// and the round-2 engine notes travelling through the real engine and boundary with their texts.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateCollectionActivity, type CollectionActivityVersion, type CollectionContext } from './collection-contract'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from './method-reference'
import {
  planElectricityUpstream, planEnergyResoldUpstream, planScope3Calculation, SCOPE3_DEFAULT_PERIOD, SCOPE3_EXCLUDABLE_NOTES, SCOPE3_METHOD_ENVELOPE,
  SCOPE3_UPSTREAM_SUBREGIONS_WITHOUT_MAPPED_FOSSIL, type Scope3CollectionVersion,
} from './scope3-collection'
import { SCOPE3_PARTIAL_BOUNDARY_NOTES, scope3PartialResultDocumented, type Scope3EngineResult } from './scope3-coverage'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_DISCLOSURE_TEXT_R2A, SCOPE3_EXCLUDABLE_NOTE_TEXT, SCOPE3_METHODOLOGY_TEXT_I12U, SCOPE3_REASON_TEXT_R2A } from './scope3-text'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; results?: Array<{ status: string; code?: string; result?: Scope3EngineResult }>; catalog?: Record<string, any> }
}
void [createHash, readFileSync, SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256]
const TIMEOUT = 120_000

const company = '93700000-0000-4000-8000-000000000001', setup = '93700000-0000-4000-8000-000000000002', office = '93700000-0000-4000-8000-000000000003'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [
  { id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
const Y2025 = { start: '2025-01-01', endExclusive: '2026-01-01' }, Y2026 = { start: '2026-01-01', endExclusive: '2027-01-01' }, FY = { start: '2025-07-01', endExclusive: '2026-07-01' }
const fixture = (kind: string, label?: string) => SCOPE3_PAYLOAD_FIXTURES.find(f => f.kind === kind && f.valid && (label === undefined || f.label === label))!
let n = 0
function record(kind: string, period: { start: string; endExclusive: string }, payload?: unknown, quantity?: unknown, label?: string): Scope3CollectionVersion {
  n++
  const f = fixture(kind, label)
  const activity = validateCollectionActivity({ kind, locationId: office, setupVersionId: setup, sourceId: `R2-${n}`, state: 'active', withdrawalReason: null, quantity: quantity ?? f.quantity,
    quality: 'actual', estimateBasis: null, period, reference: 'Synthetic', notes: '', evidenceIds: [], payload: payload ?? f.payload })
  return { id: `93700000-0000-4000-8000-${String(10000 + n).padStart(12, '0')}`, recordId: `93700000-0000-4000-8000-${String(50000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, payloadSha256: 'c'.repeat(64), createdBy: company, createdAt: '2026-06-01T00:00:00.000Z', activity } as unknown as Scope3CollectionVersion
}
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })

describe('round 2, owner decision 1: Scope 3 periods 2025-2026, inside the setup reporting period, else calendar 2025', () => {
  test('the collection contract takes Scope 3 periods to the end of 2026; Scope 1 and 2 records keep calendar 2025', () => {
    expect([SCOPE3_METHOD_ENVELOPE, SCOPE3_DEFAULT_PERIOD]).toEqual([{ start: '2025-01-01', endExclusive: '2027-01-01' }, { start: '2025-01-01', endExclusive: '2026-01-01' }])
    expect(record('employee_commuting', Y2026).activity.period).toEqual(Y2026)
    expect(record('employee_commuting', FY).activity.period).toEqual(FY)
    expect(() => record('employee_commuting', { start: '2026-07-01', endExclusive: '2027-07-01' })).toThrow('Scope 3 periods must fall between 1 January 2025 and 31 December 2026.')
    expect(() => validateCollectionActivity({ kind: 'natural_gas', locationId: office, setupVersionId: setup, sourceId: 'G-1', state: 'active', withdrawalReason: null, quantity: q('10', 'MMBtu'),
      quality: 'actual', estimateBasis: null, period: Y2026, reference: '', notes: '', evidenceIds: [], payload: { heatContent: null } })).toThrow('Collection periods must fall inside calendar 2025.')
  })

  test('a FY2026 record calculates when setup states FY2026; without a setup period only calendar 2025 does', () => {
    const fy26 = record('employee_commuting', Y2026)
    const withSetup = planScope3Calculation(fy26, context, [], { reportingPeriod: Y2026 })
    expect([withSetup.action, (withSetup.call?.request.input as { period: unknown }).period]).toEqual(['calculate', Y2026])
    const noSetup = planScope3Calculation(fy26, context, [], { reportingPeriod: null })
    expect([noSetup.action, noSetup.status, noSetup.reasons]).toEqual(['hold', 'input_needed', ['reporting_period_required_outside_2025']])
    expect(planScope3Calculation(record('employee_commuting', Y2025), context, [], { reportingPeriod: null }).action).toBe('calculate')
    // Planned on its own (setup not known to the caller) only the envelope applies.
    expect(planScope3Calculation(fy26, { ...context, reportingPeriod: undefined }, []).action).toBe('calculate')
    for (const reason of ['reporting_period_required_outside_2025', 'period_outside_method_envelope', 'no_upstream_factor_for_subregion_fuels']) expect(SCOPE3_REASON_TEXT_R2A[reason]).toBeTruthy()
  })

  test('a setup period reaching past the envelope holds the records beyond 2026', () => {
    // A record saved before this rule could not exist past 2026 (contract); the adapter still refuses it if one reaches it.
    const late = record('employee_commuting', Y2026)
    ;(late.activity as { period: unknown }).period = { start: '2026-07-01', endExclusive: '2027-07-01' }
    const plan = planScope3Calculation(late, context, [], { reportingPeriod: { start: '2026-07-01', endExclusive: '2027-07-01' } })
    expect([plan.status, plan.reasons]).toEqual(['input_needed', ['period_outside_method_envelope']])
  })

  test('the real engine calculates a FY2026 line with the factor-vintage disclosure and the latest deflator for 2026 dollars', () => {
    const spend = record('purchase_spend', Y2026, { ...(fixture('purchase_spend', 'purchase_spend: manual line').payload as object), dollarYear: 2026, lineDate: null })
    const plan = planScope3Calculation(spend, context, [], { reportingPeriod: Y2026 })
    expect(plan.action).toBe('calculate')
    const out = engine({ action: 'calculate_many', requests: [plan.call!.request] })
    const r = out.results![0]!.result!
    expect(r.status).toBe('complete')
    expect(r.boundary.notes).toEqual(expect.arrayContaining(['factor_vintage_precedes_period', 'price_index_latest_published_year_used']))
    expect((r.activity as Record<string, unknown>).priceIndexYearUsed).toBe(2025)
    for (const note of r.boundary.notes) expect(SCOPE3_DISCLOSURE_TEXT[note]).toBeTruthy()
  }, TIMEOUT)
})

describe('round 2: therms, buildings, the zero-mapped share and the other fuels', () => {
  test('ACC-5: a natural gas product in therms is sent to the engine and calculates', () => {
    const base = fixture('sold_energy_product').payload as Record<string, unknown>
    const furnace = record('sold_energy_product', Y2025, { ...base, energyCarrier: 'natural_gas', energyUnit: 'therm', useRegion: 'US', lifetimeBasis: 'years', lifetimeQuantity: '18', energyPerBasis: '450' }, q('2500', 'unit'))
    const plan = planScope3Calculation(furnace, context, [])
    expect([plan.action, plan.reasons]).toEqual(['calculate', []])
    const r = engine({ action: 'calculate_many', requests: [plan.call!.request] }).results![0]!.result!
    expect([r.status, r.total?.unrounded]).toEqual(['complete', '107556862.5'])  // r4.1 oracle C4-177 (hand arithmetic from Hub Table 1 row 38)
    const propane = record('sold_energy_product', Y2025, { ...base, energyCarrier: 'propane', energyUnit: 'therm' }, q('1', 'unit'))
    expect(planScope3Calculation(propane, context, []).reasons).toContain('energy_unit_not_an_engine_token')
  }, TIMEOUT)

  test('owner decision 4: buildings by floor area are partial, and the company may document it as a within-category exclusion', () => {
    expect(SCOPE3_EXCLUDABLE_NOTES).toContain('building_other_energy_sources_not_included')
    expect(SCOPE3_PARTIAL_BOUNDARY_NOTES).toContain('building_other_energy_sources_not_included')
    expect(SCOPE3_EXCLUDABLE_NOTE_TEXT.building_other_energy_sources_not_included).toBeTruthy()
    const notes = ['building_other_energy_sources_not_included', 'cbecs_2018_us_national_average', 'location_based_grid_rates']
    const documented = { withinCategoryExclusions: [{ noteCode: 'building_other_energy_sources_not_included' }] } as never
    expect([scope3PartialResultDocumented(notes, null), scope3PartialResultDocumented(notes, documented)]).toEqual([false, true])
  })

  test('owner decision 3: the adapter list equals the engine catalog, and a listed region waits for a factor source', () => {
    const cat = engine({ action: 'catalog' }).catalog!
    expect(cat.upstreamSubregionsWithoutMappedFossil).toEqual([...SCOPE3_UPSTREAM_SUBREGIONS_WITHOUT_MAPPED_FOSSIL])
    expect([cat.powerFuelsMapped, cat.powerOtherFuels]).toEqual([['COAL', 'GAS', 'OIL'], ['OTHF']])  // round 2, lane F: coal mine methane only (DESIGN 13.6)
    n++
    const el: CollectionActivityVersion = { id: `93700000-0000-4000-8000-${String(30000 + n).padStart(12, '0')}`, recordId: `93700000-0000-4000-8000-${String(70000 + n).padStart(12, '0')}`,
      companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: 'd'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z',
      activity: validateCollectionActivity({ kind: 'electricity', locationId: office, setupVersionId: setup, sourceId: 'M-R2', state: 'active', withdrawalReason: null, quantity: q('1000', 'kWh'),
        quality: 'actual', estimateBasis: null, period: Y2025, reference: '', notes: '', evidenceIds: [], payload: { meterOrAccountNumber: 'M-R2', utilityName: 'Synthetic', site: 'Office', zip: '96701',
          subregion: 'HIOA', utilityEiaId: null, instruments: [] } }) }
    for (const kind of ['electricity_upstream', 'td_losses_upstream'] as const) {
      expect(planElectricityUpstream(el, context, [], kind).action).toBe('calculate')
      const held = planElectricityUpstream(el, context, [], kind, { upstreamSubregionsWithoutMappedFossil: ['HIOA'] })
      expect([held.action, held.status, held.reasons]).toEqual(['hold', 'method_pending', ['no_upstream_factor_for_subregion_fuels']])
    }
    const resold = record('energy_resold', Y2025, { gridBasis: 'us_average', zip: null, subregion: null, utilityEiaId: null, resoldEnergyNotInScope2: true }, q('250', 'MWh'))
    expect(planEnergyResoldUpstream(resold, context, [], { upstreamSubregionsWithoutMappedFossil: ['US'] }).reasons).toEqual(['no_upstream_factor_for_subregion_fuels'])
  }, TIMEOUT)

  test('every round-2 disclosure code is an engine literal (so each text has a producer)', () => {
    const source = readFileSync(ENGINE, 'utf8')
    for (const code of Object.keys(SCOPE3_DISCLOSURE_TEXT_R2A)) expect(source).toContain(`'${code}'`)
  })

  test('every round-2 engine note on an upstream electricity line has a text, and OTHF makes the line partial', () => {
    const r = engine({ action: 'calculate_many', requests: [{ kind: 'electricity_upstream', input: { period: Y2025, quantity: '1234.5', unit: 'MWh', subregion: 'CAMX', zip: '94105' } }] }).results![0]!.result!
    for (const note of r.boundary.notes) expect(SCOPE3_DISCLOSURE_TEXT[note]).toBeTruthy()
    expect(SCOPE3_PARTIAL_BOUNDARY_NOTES).toContain('other_fuel_upstream_not_mapped')
    const a = r.activity as Record<string, unknown>
    expect([a.mappedFuels, a.unmappedFuels, a.otherFuelsNotMapped]).toEqual([['COAL', 'GAS', 'OIL'], ['OFSL'], ['OTHF']])  // lane F: coal mapped (methane only)
    const sentence = SCOPE3_METHODOLOGY_TEXT_I12U.mappedFossilShare('CAMX', String(a.mappedFossilHeatInputShare), a.mappedFuels as string[], a.unmappedFuels as string[],
      String(a.unmappedFossilHeatInputShare), a.otherFuelsNotMapped as string[])
    expect(sentence).toContain(`not mapped and not counted: OFSL, ${a.unmappedFossilHeatInputShare} of the fossil heat input`)
    expect(sentence).toContain('other fuels not counted: OTHF')
  }, TIMEOUT)
})
