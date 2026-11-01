// Scope 3 completion I-12u (DESIGN 13.2, 13.3, 4.6, 5.1, 5.2; Claude, 30 October 2026): the category 3 upstream lines from
// Scope 1 and 2 records to the real Scope 3 engine: 3A from natural gas, No. 2 distillate and vehicle records (the Scope 1
// plan decides the hold and the energy facts), 3B and 3C upstream from electricity (exactly the 3C input), 3D upstream from
// energy resold; the boundary's closure of 3C/3D combustion lines; category 3 status (partial_boundary from unmapped fossil
// fuels, never engine_partial) and its disclosures.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateCollectionActivity, type CollectionActivityVersion, type CollectionContext } from './collection-contract'
import { planCollectionCalculation } from './collection-engine-input'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from './method-reference'
import {
  planElectricityUpstream, planEnergyResoldUpstream, planFuelUpstream, planGridLossCalculation, planScope3Calculation, validateScope3Payload, SCOPE3_LATE_SOURCES,
  SCOPE3_UPSTREAM_LIQUIDS_VERIFIED, SCOPE3_UPSTREAM_SOURCES, SCOPE3_UPSTREAM_VEHICLE_FUELS, type Scope3CalculationPlan, type Scope3CollectionActivity, type Scope3CollectionVersion,
} from './scope3-collection'
import { SCOPE3_PARTIAL_BOUNDARY_NOTES, type Scope3CoverageRecord, type Scope3EngineAggregate, type Scope3EngineResult } from './scope3-coverage'
import { scope3Coverage, type Scope3AggregateEngine } from './scope3-engine-output'
import { SCOPE3_BOUNDARY_CLOSURE_PAIRS } from './scope3-method-catalog'
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_REASON_TEXT_I12U } from './scope3-text'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; results?: Array<{ status: string; code?: string; result?: Scope3EngineResult }>; catalog?: Record<string, any>; aggregate?: Scope3EngineAggregate }
}
const pins = { engineSha256: createHash('sha256').update(readFileSync(ENGINE)).digest('hex'), registerSha256: SCOPE3_REGISTER_2025_SHA256,
  additionalRegisterSha256s: { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } }
const realEngine: Scope3AggregateEngine = { aggregate: async (results, annotations) => {
  const out = engine(annotations ? { action: 'aggregate', results, annotations } : { action: 'aggregate', results })
  if (out.status !== 'ok') throw new Error(`refused: ${out.code}`)
  return out.aggregate!
} }
const TIMEOUT = 120_000

const company = '93600000-0000-4000-8000-000000000001', setup = '93600000-0000-4000-8000-000000000002'
const office = '93600000-0000-4000-8000-000000000003', depot = '93600000-0000-4000-8000-000000000004'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [
  { id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }, { id: depot, name: 'Depot', inclusion: 'excluded', control: 'landlord', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
const year = { start: '2025-01-01', endExclusive: '2026-01-01' }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
let n = 0
function scope12(kind: 'natural_gas' | 'distillate_no2' | 'vehicle' | 'electricity', quantity: ReturnType<typeof q>, payload: Record<string, unknown>, extra: Record<string, unknown> = {}): CollectionActivityVersion {
  n++
  const sourceId = kind === 'vehicle' ? String(payload.vehicleGroupId) : kind === 'electricity' ? String(payload.meterOrAccountNumber) : `S-${n}`
  return { id: `93600000-0000-4000-8000-${String(10000 + n).padStart(12, '0')}`, recordId: `93600000-0000-4000-8000-${String(50000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, payloadSha256: 'b'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z',
    activity: validateCollectionActivity({ kind, locationId: office, setupVersionId: setup, sourceId, state: 'active', withdrawalReason: null, quantity, quality: 'actual', estimateBasis: null,
      period: year, reference: 'Synthetic bill', notes: '', evidenceIds: [], payload, ...extra }) }
}
function resold(payload: Record<string, unknown> = {}): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `R-${n}`, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null, reference: 'Synthetic', notes: '',
    evidenceIds: [], period: year, kind: 'energy_resold', quantity: q('250', 'MWh'),
    payload: validateScope3Payload('energy_resold', { gridBasis: 'us_average', zip: null, subregion: null, utilityEiaId: null, resoldEnergyNotInScope2: true, ...payload }) } as unknown as Scope3CollectionActivity
  return { id: `93600000-0000-4000-8000-${String(20000 + n).padStart(12, '0')}`, recordId: `93600000-0000-4000-8000-${String(60000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: 'a'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}
const gas = (value = '1234', unit = 'therm', heatContent: unknown = null, extra: Record<string, unknown> = {}) => scope12('natural_gas', q(value, unit), { heatContent }, extra)
const vehicle = (fuel = 'gasoline', gallons = '1250.5', extra: Record<string, unknown> = {}) => scope12('vehicle', q(gallons, 'US_gallon'),
  { vehicleGroupId: `V-${n + 1}`, fuel, vehicleType: fuel === 'diesel' ? 'diesel_light_duty_truck' : 'gasoline_passenger_car', modelYear: 2021, gallons, vehicleCount: 2, miles: null, fuelEconomy: null }, extra)
const distillate = (consumption: unknown) => scope12('distillate_no2', q('400', 'US_gallon'), { consumption, statedHhvMmbtuPerGallon: null })
const electricity = (kwh = '12000', p: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => scope12('electricity', q(kwh, 'kWh'), { meterOrAccountNumber: `M-${n + 1}`, utilityName: 'Synthetic', site: 'Office', zip: '94105', subregion: 'CAMX', utilityEiaId: null, instruments: [], ...p }, extra)
const OFF = { lateSources: { usUpstream2025: false, usBuildingHotel2025: false } }

describe('I-12u: category 3 upstream lines (DESIGN 13.2)', () => {
  test('the adapter constants equal the engine catalog; R5 is loaded, and so is R6 (I-12h: buildings and hotels)', () => {
    const cat = engine({ action: 'catalog' }).catalog!
    expect([cat.upstreamSources, cat.upstreamVehicleFuels, cat.upstreamLiquidsVerified]).toEqual([[...SCOPE3_UPSTREAM_SOURCES], SCOPE3_UPSTREAM_VEHICLE_FUELS, SCOPE3_UPSTREAM_LIQUIDS_VERIFIED])
    expect(cat.boundaryClosurePairs).toEqual(Object.fromEntries(Object.entries(SCOPE3_BOUNDARY_CLOSURE_PAIRS).map(([k, v]) => [k, v.closedBy])))
    expect(SCOPE3_LATE_SOURCES).toEqual({ usUpstream2025: true, usBuildingHotel2025: true })
    expect(SCOPE3_PARTIAL_BOUNDARY_NOTES).toContain('fossil_fuel_upstream_not_mapped')
    for (const reason of ['source_scope1_record_held', 'upstream_factor_not_available_for_fuel']) expect(SCOPE3_REASON_TEXT_I12U[reason]).toBeTruthy()
  })

  test('3A follows the Scope 1 plan: the same energy facts are sent; a held Scope 1 record holds the line with its reasons', () => {
    const g = gas('1234', 'therm')
    const s1 = planCollectionCalculation(g, context, [])
    const p = planFuelUpstream(g, context, [])
    expect([p.kind, p.category, p.action, p.derivedFrom, p.payload]).toEqual(['fuel_upstream', 3, 'calculate', { recordId: g.recordId, kind: 'natural_gas' }, g.activity.payload])
    expect(p.call!.request).toEqual({ kind: 'fuel_upstream', input: { ...(s1.call as { request: { input: Record<string, unknown> } }).request.input, source: 'natural_gas' } })
    const volume = gas('480.5', 'ccf', { value: '1.037', unit: 'therm per ccf' })
    expect(planFuelUpstream(volume, context, []).call!.request.input).toEqual({ period: year, source: 'natural_gas', quantity: '480.5', unit: 'ccf', heatContent: { value: '1.037', unit: 'therm per ccf' } })
    // Held by Scope 1: an implausible heat content (input needed), an excluded site, a withdrawn record, a vehicle fuel Scope 1 does not calculate.
    const implausible = planFuelUpstream(gas('480.5', 'ccf', { value: '10.37', unit: 'therm per ccf' }), context, [])
    expect([implausible.status, implausible.reasons, implausible.call]).toEqual(['input_needed', ['source_scope1_record_held', 'heat_content_outside_plausible_range'], null])
    const excluded = planFuelUpstream(gas('1', 'therm', null, { locationId: depot }), context, [])
    expect([excluded.status, excluded.reasons]).toEqual(['excluded', ['location_excluded_by_company_setup']])
    const withdrawn = planFuelUpstream(gas('1', 'therm', null, { state: 'withdrawn', withdrawalReason: 'Duplicate bill' }), context, [])
    expect([withdrawn.status, withdrawn.reasons]).toEqual(['withdrawn', ['record_withdrawn']])
    const e85 = planFuelUpstream(vehicle('e85'), context, [])
    expect([e85.status, e85.reasons]).toEqual(['input_needed', ['source_scope1_record_held', 'fuel_not_an_engine_token', 'vehicle_type_not_an_engine_token']])
    // Vehicles: the fuel and gallons only (type, year and miles do not change the upstream); No. 2 distillate: the consumption.
    expect(planFuelUpstream(vehicle('diesel', '980'), context, []).call!.request.input).toEqual({ period: year, source: 'vehicle', fuel: 'diesel', gallons: '980' })
    expect(planFuelUpstream(distillate({ basis: 'measured', gallons: '400' }), context, []).call!.request.input).toEqual({ period: year, source: 'distillate_no2', consumption: { basis: 'measured', gallons: '400' } })
    // Before R5 (flag off) every line waited for its factor source.
    expect([planFuelUpstream(g, context, [], OFF).status, planFuelUpstream(g, context, [], OFF).reasons]).toEqual(['method_pending', ['factor_source_not_yet_loaded']])
    expect(() => planFuelUpstream(electricity(), context, [])).toThrow('3A upstream line follows')
  })

  test('3B and 3C upstream send exactly the 3C input; a held electricity record holds both like 3C', () => {
    const el = electricity('12000')
    const loss = planGridLossCalculation(el, context, [])
    for (const kind of ['electricity_upstream', 'td_losses_upstream'] as const) {
      const p = planElectricityUpstream(el, context, [], kind)
      expect([p.kind, p.category, p.action, p.derivedFrom]).toEqual([kind, 3, 'calculate', { recordId: el.recordId, kind: 'electricity' }])
      expect(p.call!.request).toEqual({ kind, input: loss.call!.request.input })
      const held = planElectricityUpstream(electricity('12000', { utilityEiaId: 'ABC' }), context, [], kind)
      const c3 = planGridLossCalculation(electricity('12000', { utilityEiaId: 'ABC' }), context, [])
      expect([held.status, held.reasons]).toEqual([c3.status, c3.reasons])
      expect(held.reasons[0]).toBe('electricity_record_held')
      const away = planElectricityUpstream(electricity('12000', {}, { locationId: depot }), context, [], kind)
      expect([away.status, away.reasons]).toEqual(['excluded', ['electricity_record_held', 'location_excluded_by_company_setup']])
      expect(planElectricityUpstream(el, context, [], kind, OFF).reasons).toEqual(['factor_source_not_yet_loaded'])
    }
  })

  test('end to end through the real engine: figures, closures, category 3 partial from unmapped fossil fuels, disclosures', async () => {
    const el = electricity('12000'), g = gas('1234', 'therm'), car = vehicle('gasoline', '1250.5'), rs = resold()
    const plans: Scope3CalculationPlan[] = [planGridLossCalculation(el, context, []), planElectricityUpstream(el, context, [], 'td_losses_upstream'), planElectricityUpstream(el, context, [], 'electricity_upstream'),
      planFuelUpstream(g, context, []), planFuelUpstream(car, context, []), planScope3Calculation(rs, context, []), planEnergyResoldUpstream(rs, context, [])]
    expect(plans.every(p => p.action === 'calculate')).toBe(true)
    const results = engine({ action: 'calculate_many', requests: plans.map(p => p.call!.request) }).results!.map(item => { expect(item.status).toBe('ok'); return item.result! })
    // Independent figures (hand arithmetic from the transcribed values): 123.4 MMBtu x 8.8 x 1055.05585262 / 1000; 1250.5 gal x 119.53 x (100.82 - 73.94) / 1000.
    expect(results[3]!.total!.unrounded).toBe('1145.7062514771104')
    expect(results[4]!.total!.unrounded).toBe('4017.8144832')
    const records: Scope3CoverageRecord[] = plans.map((p, i) => ({ recordId: p.recordId, category: 3, quality: 'actual', kind: p.kind, result: { outcome: 'calculated', resultSha256: results[i]!.resultSha256 } }))
    const cov = await scope3Coverage(records, [{ category: 3, decision: 'included', reason: null }], results, realEngine, pins)
    const row = cov.categories[2]!
    // The 3C and 3D combustion lines are closed (calculated); 3B, 3C upstream and 3D upstream stay partial (coal, oil and other fossil not mapped).
    expect([row.status, row.support, row.counts.calculated, row.counts.partialBoundary]).toEqual(['partial_boundary', 'engine', 4, 3])
    expect(row.disclosures).toContain('combustion_line_closed_by_upstream_line')
    expect(row.disclosures).toContain('fossil_fuel_upstream_not_mapped')
    expect(row.disclosures).not.toContain('combustion_only_upstream_of_lost_energy_excluded')
    expect(row.disclosures).not.toContain('upstream_of_resold_energy_excluded')
    expect(row.disclosures).not.toContain('category_3a_3b_not_supported')
    for (const code of row.disclosures) expect([code, Boolean(SCOPE3_DISCLOSURE_TEXT[code])]).toEqual([code, true])
    expect(cov.disclosures.find(d => d.code === 'mixed_gwp_sets_including_reported')!.categories).toEqual([3])
    // A 3A line the engine holds (a volume without a stated heat content, as Scope 1) makes category 3 need input.
    const noHeat = planFuelUpstream(gas('50000', 'scf'), context, [])
    const held = engine({ action: 'calculate_many', requests: [noHeat.call!.request] }).results![0]!.result!
    expect([held.status, held.findings]).toEqual(['input_needed', ['heat_content_required_for_volume']])
    const withHeld = await scope3Coverage([...records, { recordId: noHeat.recordId, category: 3, quality: 'actual', kind: 'fuel_upstream', result: { outcome: 'calculated', resultSha256: held.resultSha256 } }],
      [{ category: 3, decision: 'included', reason: null }], [...results, held], realEngine, pins)
    expect(withHeld.categories[2]!.status).toBe('input_needed')
    // A pending upstream line (flag off) makes it await its factor source, never zero.
    const pending = planFuelUpstream(g, context, [], OFF)
    const waiting = await scope3Coverage([...records.slice(0, 3), { recordId: pending.recordId, category: 3, quality: 'actual', kind: 'fuel_upstream', result: { outcome: 'held', status: 'method_pending', reasons: pending.reasons, optional: false } }],
      [{ category: 3, decision: 'included', reason: null }], results.slice(0, 3), realEngine, pins)
    expect([waiting.categories[2]!.status, waiting.categories[2]!.counts.methodPending]).toEqual(['awaiting_factor_source', 1])
  }, TIMEOUT)

  test('the boundary pairs closures itself: an aggregate that drops or invents one is refused', async () => {
    const el = electricity('5000')
    const plans = [planGridLossCalculation(el, context, []), planElectricityUpstream(el, context, [], 'td_losses_upstream')]
    const results = engine({ action: 'calculate_many', requests: plans.map(p => p.call!.request) }).results!.map(item => item.result!)
    const records: Scope3CoverageRecord[] = plans.map((p, i) => ({ recordId: p.recordId, category: 3, quality: 'actual', kind: p.kind, result: { outcome: 'calculated', resultSha256: results[i]!.resultSha256 } }))
    const genuine = await realEngine.aggregate(results, results.map(() => ({ dataQuality: null, activityDataOrigin: null })))
    expect(genuine.boundaryClosures).toEqual([{ resultSha256: results[0]!.resultSha256, closedBy: results[1]!.resultSha256 }])
    const rehash = (a: Record<string, unknown>) => { const { aggregateSha256: _, ...body } = a; return { ...body, aggregateSha256: createHash('sha256').update(canon(body)).digest('hex') } as unknown as Scope3EngineAggregate }
    const canon = (v: unknown): string => v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(canon).join(',')}]` : `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`
    const tampered = [
      rehash({ ...genuine, boundaryClosures: [] }),
      rehash({ ...genuine, boundaryClosures: [], partialBoundaryResults: [...genuine.partialBoundaryResults, { resultSha256: results[0]!.resultSha256, category: 3, notes: results[0]!.boundary.notes }] }),
      rehash({ ...genuine, partialBoundaryResults: [...genuine.partialBoundaryResults, { resultSha256: results[0]!.resultSha256, category: 3, notes: results[0]!.boundary.notes }] }),
    ]
    for (const aggregate of tampered)
      await expect(scope3Coverage(records, [{ category: 3, decision: 'included', reason: null }], results, { aggregate: async () => aggregate }, pins)).rejects.toThrow('Scope 3 engine output refused')
    const ok = await scope3Coverage(records, [{ category: 3, decision: 'included', reason: null }], results, realEngine, pins)
    expect([ok.categories[2]!.counts.calculated, ok.categories[2]!.counts.partialBoundary]).toEqual([1, 1])
  }, TIMEOUT)
})
