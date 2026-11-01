// Scope 3 package 1 (AG1 groundwork): every contract-valid Scope 3 collection record either reaches the reviewed
// Scope 3 engine and is accepted, or is held here with a named reason. Runs the real engine. Claude, 24 October 2026.
import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from './method-reference'
import type { Scope3CoverageRecord, Scope3EngineAggregate, Scope3EngineResult } from './scope3-coverage'
import { scope3Coverage } from './scope3-engine-output'
import { validateCollectionActivity, type CollectionActivityVersion, type CollectionContext, type CollectionEvidenceMetadata } from './collection-contract'
import {
  planGridLossCalculation, planScope3Calculation, SCOPE3_AIR_HAULS, SCOPE3_COMMUTING_MODES, SCOPE3_TRANSPORT_VEHICLES, SCOPE3_TRAVEL_MODES, SCOPE3_WASTE_MATERIALS,
  SCOPE3_WASTE_TREATMENTS, SCOPE3_WASTE_UNITS, validateScope3Payload, type Scope3CalculationPlan, type Scope3CollectionActivity, type Scope3CollectionKind, type Scope3CollectionVersion,
} from './scope3-collection'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; result?: Record<string, any>; catalog?: Record<string, any> }
}
const run = (plan: Scope3CalculationPlan) => engine({ action: 'calculate', request: plan.call!.request })
// Each engine call is a fresh Python process; a timeout is not an accounting result.
const ENGINE_TEST_TIMEOUT_MS = 60_000, ENGINE_FUZZ_TIMEOUT_MS = 300_000

const company = '93000000-0000-4000-8000-000000000001', setup = '93000000-0000-4000-8000-000000000002'
const office = '93000000-0000-4000-8000-000000000003', warehouse = '93000000-0000-4000-8000-000000000004', undecided = '93000000-0000-4000-8000-000000000005'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [
  { id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' },
  { id: warehouse, name: 'Warehouse', inclusion: 'excluded', control: 'landlord', entityId: null, startMode: 'period_start', endMode: 'period_end' },
  { id: undecided, name: 'Depot', inclusion: 'unknown', control: 'unknown', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
const evidence: CollectionEvidenceMetadata[] = []
const year = { start: '2025-01-01', endExclusive: '2026-01-01' }
const plain = (value: string) => /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$/.test(value)
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: plain(value) ? value : null, normalizedUnit: plain(value) ? unit : null })
let n = 0
function record<K extends Scope3CollectionKind>(kind: K, quantity: ReturnType<typeof q>, payload: unknown, extra: Record<string, unknown> = {}): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `S3-${n}`, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null,
    reference: 'Synthetic source', notes: '', evidenceIds: [], period: year, kind, quantity, payload: validateScope3Payload(kind, payload), ...extra } as unknown as Scope3CollectionActivity
  return { id: `93000000-0000-4000-8000-${String(1000 + n).padStart(12, '0')}`, recordId: `93000000-0000-4000-8000-${String(5000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: 'a'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}
const truck = (unit = 'vehicle-km', value = '1200.5', loadBasis: string | null = 'dedicated_vehicle', vehicle = 'medium_and_heavy_duty_truck', extra = {}) =>
  record('transport', q(value, unit), { category: 4, vehicle, loadBasis, thirdPartyFacilities: 'none' }, extra)
const waste = (material = 'office_paper', treatment = 'recycled', unit = 'kg', value = '850') => record('waste', q(value, unit), { category: 5, material, treatment })
const air = (miles = '1500', segments: number | null = 12, unit = 'mile') => record('business_travel', q(miles, unit), { mode: 'air', passengerSegments: segments, haulBasis: null })
const travel = (mode: string, unit: string, value = '420', haulBasis: string | null = null) => record('business_travel', q(value, unit), { mode, passengerSegments: null, haulBasis })
const commute = (mode: string, unit: string, value = '9800') => record('employee_commuting', q(value, unit), { mode })
const reasonsOf = (version: Scope3CollectionVersion) => planScope3Calculation(version, context, evidence).reasons

describe('Scope 3 collection -> engine input (package 1)', () => {
  test('token lists equal what the engine accepts', () => {
    const catalog = engine({ action: 'catalog' }).catalog!
    expect(Object.fromEntries(catalog.travelModes.map((m: any) => [m.id, m.activity.split('-')[0]]))).toEqual(SCOPE3_TRAVEL_MODES)
    expect(catalog.travelModes.filter((m: any) => m.employeeCommuting).map((m: any) => m.id)).toEqual(SCOPE3_COMMUTING_MODES)
    expect(catalog.travelModes.filter((m: any) => !m.employeeCommuting).map((m: any) => m.id)).toEqual([...SCOPE3_AIR_HAULS])
    expect(Object.fromEntries(catalog.transportVehicles.map((v: any) => [v.id, { dedicatedVehicle: v.dedicatedVehicle, sharedVehicle: v.sharedVehicle }]))).toEqual(SCOPE3_TRANSPORT_VEHICLES)
    expect(catalog.wasteMaterials.map((m: any) => m.id)).toEqual([...SCOPE3_WASTE_MATERIALS])
    expect(catalog.wasteUnits).toEqual([...SCOPE3_WASTE_UNITS])
    expect([...new Set(catalog.wasteMaterials.flatMap((m: any) => m.treatments))].sort()).toEqual([...SCOPE3_WASTE_TREATMENTS].sort())
  }, ENGINE_TEST_TIMEOUT_MS)

  test('each kind reaches the engine with exactly what was recorded, and the engine accepts it', () => {
    const cases: Array<[Scope3CollectionVersion, string, number]> = [
      [truck(), 'complete', 4],
      [truck('tonne-km', '50000', 'shared_vehicle', 'rail'), 'complete', 4],
      [record('transport', q('300', 'vehicle-mile'), { category: 9, vehicle: 'light_duty_truck', loadBasis: 'dedicated_vehicle', thirdPartyFacilities: 'unknown' }), 'complete', 9],
      [waste(), 'complete', 5],
      [record('waste', q('2.5', 'metric_ton'), { category: 12, material: 'corrugated_containers', treatment: 'landfilled' }), 'complete', 12],
      [air(), 'complete', 6],
      [travel('air_long_haul', 'passenger-mile', '9000', 'Travel agency itinerary: SFO-LHR'), 'complete', 6],
      [travel('passenger_car', 'vehicle-km', '640'), 'complete', 6],
      [commute('bus', 'passenger-km'), 'complete', 7],
      [commute('passenger_car', 'vehicle-mile', '120000'), 'complete', 7],
    ]
    for (const [version, status, category] of cases) {
      const plan = planScope3Calculation(version, context, evidence)
      expect(plan).toMatchObject({ action: 'calculate', status: null, reasons: [], category })
      const out = run(plan)
      expect(out.status).toBe('ok')
      expect(out.result!.status).toBe(status)
      expect(out.result!.category).toBe(category)
      expect(out.result!.input).toEqual(plan.call!.request.input)
      // The engine is given the recorded number and unit exactly; conversions are the engine's, and listed by it.
      const recorded = version.activity.quantity
      expect(JSON.stringify(plan.call!.request.input)).toContain(JSON.stringify(recorded.originalValue))
    }
  }, ENGINE_TEST_TIMEOUT_MS)

  test('a treatment EPA marks NA is sent and the engine itself says input needed; distance picks the air haul', () => {
    const na = planScope3Calculation(waste('clay_bricks', 'recycled'), context, evidence)
    expect(na.action).toBe('calculate')
    expect(run(na).result).toMatchObject({ status: 'input_needed', findings: ['no_published_factor_for_material_and_treatment'], total: null })
    expect(run(planScope3Calculation(air('250'), context, evidence)).result!.activity.mode).toBe('air_short_haul')
    expect(run(planScope3Calculation(air('2400'), context, evidence)).result!.activity.mode).toBe('air_long_haul')
    const long = run(planScope3Calculation(air('2400'), context, evidence)).result!
    expect(long.boundary.notes).toEqual(['cabin_class_not_differentiated', 'radiative_forcing_not_included', 'tank_to_wheel_only'])
  }, ENGINE_TEST_TIMEOUT_MS)

  test('holds with a named reason instead of sending what the engine would refuse', () => {
    expect(reasonsOf(truck('vehicle-km', 'unknown'))).toEqual(['quantity_not_calculable'])
    expect(reasonsOf(truck('vehicle-km', '1,200'))).toEqual(['quantity_not_calculable'])
    expect(reasonsOf(truck('vehicle-km', '1200', 'dedicated_vehicle', 'hovercraft'))).toEqual(['vehicle_not_an_engine_token'])
    expect(reasonsOf(truck('vehicle-km', '1200', null))).toEqual(['load_basis_required'])
    expect(reasonsOf(truck('vehicle-km', '1200', 'dedicated_vehicle', 'rail'))).toEqual(['load_basis_not_available_for_vehicle'])
    expect(reasonsOf(truck('vehicle-km', '1200', 'shared_vehicle', 'rail'))).toEqual(['unit_not_an_engine_token'])
    expect(reasonsOf(truck('short ton-mile', '1200'))).toEqual(['unit_not_an_engine_token'])
    expect(reasonsOf(waste('unobtainium'))).toEqual(['material_not_an_engine_token'])
    expect(reasonsOf(waste('office_paper', 'buried'))).toEqual(['treatment_not_an_engine_token'])
    expect(reasonsOf(waste('office_paper', 'recycled', 'pallet'))).toEqual(['unit_not_an_engine_token'])
    expect(reasonsOf(air('1500', null))).toEqual(['passenger_segments_required'])
    expect(reasonsOf(air('0'))).toEqual(['segment_distance_must_be_positive'])
    expect(reasonsOf(air('1500', 3, 'passenger-mile'))).toEqual(['unit_not_an_engine_token'])
    expect(reasonsOf(travel('air_medium_haul', 'passenger-mile', '900', ' '))).toEqual(['haul_basis_required'])
    expect(reasonsOf(travel('air_medium_haul', 'passenger-mile', '900', null))).toEqual(['haul_basis_required'])
    expect(reasonsOf(travel('teleport', 'passenger-mile'))).toEqual(['mode_not_an_engine_token'])
    expect(reasonsOf(travel('bus', 'vehicle-mile'))).toEqual(['unit_not_an_engine_token'])
    // Commuting has no air, and the distance-picks-haul mode is business travel only.
    expect(reasonsOf(commute('air_short_haul', 'passenger-mile'))).toEqual(['mode_not_an_engine_token'])
    expect(reasonsOf(commute('air', 'mile'))).toEqual(['mode_not_an_engine_token'])
  })

  test('withdrawn records and excluded or undecided locations are never calculated; an older setup is noted', () => {
    expect(planScope3Calculation(commute('bus', 'passenger-km', '10'), context, evidence).notes).toEqual([])
    expect(planScope3Calculation({ ...commute('bus', 'passenger-km'), revision: 2, activity: { ...commute('bus', 'passenger-km').activity, state: 'withdrawn', withdrawalReason: 'Entered twice.' } }, context, evidence))
      .toMatchObject({ action: 'hold', status: 'withdrawn', reasons: ['record_withdrawn'] })
    expect(planScope3Calculation(commute('bus', 'passenger-km', '10'), { ...context, locations: context.locations.map(l => ({ ...l, inclusion: 'excluded' as const })) }, evidence))
      .toMatchObject({ action: 'hold', status: 'excluded', reasons: ['location_excluded_by_company_setup'] })
    expect(planScope3Calculation({ ...commute('bus', 'passenger-km'), activity: { ...commute('bus', 'passenger-km').activity, locationId: undecided } }, context, evidence))
      .toMatchObject({ action: 'hold', status: 'input_needed', reasons: ['location_inclusion_unknown'] })
    expect(planScope3Calculation({ ...commute('bus', 'passenger-km'), activity: { ...commute('bus', 'passenger-km').activity, locationId: crypto.randomUUID() } }, context, evidence))
      .toMatchObject({ action: 'hold', status: 'input_needed', reasons: ['location_not_in_current_setup'] })
    expect(planScope3Calculation(commute('bus', 'passenger-km'), { ...context, setupVersionId: crypto.randomUUID(), sameContentSetupVersionIds: undefined }, evidence).notes).toEqual(['saved_against_earlier_setup_version'])
    expect(() => planScope3Calculation(commute('bus', 'passenger-km'), { ...context, companyId: crypto.randomUUID() }, evidence)).toThrow('another company')
  })

  test('the payload contract is exact and keeps unsupported values so they are held, not lost', () => {
    expect(validateScope3Payload('transport', { category: 9, vehicle: 'legacy-van', loadBasis: null, thirdPartyFacilities: 'unknown' })).toEqual({ category: 9, vehicle: 'legacy-van', loadBasis: null, thirdPartyFacilities: 'unknown' })
    for (const [kind, bad] of [
      ['transport', { category: 3, vehicle: 'rail', loadBasis: null, thirdPartyFacilities: 'none' }],
      ['transport', { category: 4, vehicle: 'rail', loadBasis: 'leased', thirdPartyFacilities: 'none' }],
      ['transport', { category: 4, vehicle: 'rail', loadBasis: null, thirdPartyFacilities: 'maybe' }],
      ['transport', { category: 4, vehicle: 'rail', loadBasis: null, thirdPartyFacilities: 'none', extra: 1 }],
      ['waste', { category: 6, material: 'glass', treatment: 'recycled' }],
      ['waste', { category: 5, material: 7, treatment: 'recycled' }],
      ['business_travel', { mode: 'air', passengerSegments: 0, haulBasis: null }],
      ['business_travel', { mode: 'air', passengerSegments: 1.5, haulBasis: null }],
      ['business_travel', { mode: 'air_long_haul', passengerSegments: null, haulBasis: 'x'.repeat(201) }],
      ['employee_commuting', { mode: 'bus', days: 220 }],
      ['employee_commuting', { mode: 'x'.repeat(81) }],
    ] as Array<[Scope3CollectionKind, unknown]>) expect(() => validateScope3Payload(kind, bad)).toThrow()
    expect(() => validateScope3Payload('hotel_stays' as Scope3CollectionKind, { nights: 3 })).toThrow('Unsupported')
  })

  test('fuzz: 300 contract-valid records with junk, blanks and unknowns are never refused by the engine', async () => {
    let seed = 20261024
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!
    const values = ['0', '1', '12.5', '999999999999.999', '0.001', '', 'unknown', '1,200', '-3', '1e3', '12.3456', '2500']
    const travelModes = [...Object.keys(SCOPE3_TRAVEL_MODES), 'air', 'teleport', '']
    const units = ['vehicle-mile', 'vehicle-km', 'short ton-mile', 'tonne-km', 'passenger-mile', 'passenger-km', 'mile', 'km', 'short_ton', 'lb', 'kg', 'metric_ton', 'gallon', '']
    let calculated = 0, held = 0
    const rows: Scope3CoverageRecord[] = [], results: Scope3EngineResult[] = []
    for (let i = 0; i < 300; i++) {
      const kind = pick(['transport', 'waste', 'business_travel', 'employee_commuting'] as const)
      const fitting = { transport: ['vehicle-mile', 'vehicle-km', 'short ton-mile', 'tonne-km'], waste: [...SCOPE3_WASTE_UNITS], business_travel: ['mile', 'km', 'passenger-mile', 'passenger-km', 'vehicle-mile', 'vehicle-km'], employee_commuting: ['passenger-mile', 'passenger-km', 'vehicle-mile', 'vehicle-km'] }[kind]
      const quantity = q(pick(values), next() < 0.8 ? pick(fitting) : pick(units))
      const payload = kind === 'transport' ? { category: pick([4, 9] as const), vehicle: pick([...Object.keys(SCOPE3_TRANSPORT_VEHICLES), 'hovercraft']), loadBasis: pick(['dedicated_vehicle', 'shared_vehicle', null] as const), thirdPartyFacilities: pick(['none', 'present_not_included', 'unknown'] as const) }
        : kind === 'waste' ? { category: pick([5, 12] as const), material: pick([...SCOPE3_WASTE_MATERIALS.slice(0, 12), 'unobtainium']), treatment: pick([...SCOPE3_WASTE_TREATMENTS, 'buried']) }
        : kind === 'business_travel' ? { mode: pick(travelModes), passengerSegments: pick([null, 1, 40, 10_000_000]), haulBasis: pick([null, '', 'Booking export', ' ']) }
        : { mode: pick(travelModes) }
      const version = record(kind, quantity, payload, { locationId: pick([office, office, office, warehouse, undecided]) })
      const plan = planScope3Calculation(version, context, evidence)
      const base = { recordId: version.recordId, category: plan.category, quality: version.activity.quality }
      if (plan.action === 'hold') { held++; expect(plan.reasons.length).toBeGreaterThan(0); rows.push({ ...base, result: { outcome: 'held', status: plan.status!, reasons: plan.reasons } }); continue }
      calculated++
      const out = run(plan)
      expect([kind, out.status, out.code]).toEqual([kind, 'ok', undefined])
      expect(out.result!.input).toEqual(plan.call!.request.input)
      rows.push({ ...base, result: { outcome: 'calculated', resultSha256: out.result!.resultSha256 } }); results.push(out.result as Scope3EngineResult)
    }
    expect(calculated).toBeGreaterThan(20); expect(held).toBeGreaterThan(100)
    // Revision 3 (S3-01, S3A-01): every result the engine calculated also aggregates, and the trusted boundary accepts the lot.
    const aggregate = engine({ action: 'aggregate', results }) as { status: string; aggregate?: Scope3EngineAggregate }
    expect(aggregate.status).toBe('ok')
    const pins = { engineSha256: createHash('sha256').update(readFileSync(ENGINE)).digest('hex'), registerSha256: SCOPE3_REGISTER_2025_SHA256, additionalRegisterSha256s: { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } }
    // Revision 4 (S3A-03-R3): the boundary asks the engine itself to aggregate; the aggregate above is only the cross-check.
    const viaEngine = { aggregate: async (r: Scope3EngineResult[]) => { const out = engine({ action: 'aggregate', results: r }) as { status: string; code?: string; aggregate?: Scope3EngineAggregate }; if (out.status !== 'ok') throw new Error(`refused: ${out.code}`); return out.aggregate! } }
    const coverage = await scope3Coverage(rows, [], results, viaEngine, pins)
    expect(coverage.categories.reduce((n, row) => n + row.counts.records, 0)).toBe(300)
    console.log(`scope 3 collection fuzz: ${calculated} calculated by the engine, ${held} held with a named reason, 0 refused; all aggregated and verified`)
  }, ENGINE_FUZZ_TIMEOUT_MS)
})

describe('Category 3C follows its electricity record (S3-03)', () => {
  const electricity = (extra: Record<string, unknown> = {}, p: Record<string, unknown> = {}, quantity = q('12000', 'kWh')): CollectionActivityVersion => ({
    id: '93000000-0000-4000-8000-0000000000e1', recordId: '93000000-0000-4000-8000-0000000000e2', companyId: company, revision: 1, previousVersionId: null, correctionReason: null,
    payloadSha256: 'b'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z',
    activity: validateCollectionActivity({ kind: 'electricity', locationId: office, setupVersionId: setup, sourceId: 'M-1', state: 'active', withdrawalReason: null, quantity, quality: 'actual', estimateBasis: null,
      period: { start: '2025-01-01', endExclusive: '2025-02-01' }, reference: 'Synthetic bill', notes: '', evidenceIds: [],
      payload: { meterOrAccountNumber: 'M-1', utilityName: 'Synthetic', site: 'Office', zip: '94105', subregion: 'CAMX', utilityEiaId: null, instruments: [], ...p }, ...extra }),
  })
  test('the losses use exactly the Scope 2 quantity and location, and the result is partial-boundary', () => {
    const plan = planGridLossCalculation(electricity(), context, evidence)
    expect(plan).toMatchObject({ action: 'calculate', kind: 'td_losses', category: 3, reasons: [] })
    expect(plan.call!.request).toEqual({ kind: 'td_losses', input: { period: { start: '2025-01-01', endExclusive: '2025-02-01' }, quantity: '12000', unit: 'kWh', subregion: 'CAMX', zip: '94105' } })
    const result = run(plan).result!
    expect(result).toMatchObject({ status: 'complete', category: 3, boundary: { minimumBoundary: 'partial', notes: ['combustion_only_upstream_of_lost_energy_excluded', 'location_based_rates'] } })
    // A different electricity quantity gives a different loss; the same quantity gives the same result.
    const more = run(planGridLossCalculation(electricity({}, {}, q('24000', 'kWh')), context, evidence)).result!
    expect(more.activity.consumedMwh).toBe('24'); expect(result.activity.consumedMwh).toBe('12')
    expect(run(planGridLossCalculation(electricity(), context, evidence)).result!.resultSha256).toBe(result.resultSha256)
  }, ENGINE_TEST_TIMEOUT_MS)
  test('a held or withdrawn electricity record holds 3C with its reasons', () => {
    expect(planGridLossCalculation(electricity({}, { subregion: 'XXXX' }), context, evidence)).toMatchObject({ action: 'hold', status: 'input_needed', reasons: ['electricity_record_held', 'subregion_not_an_egrid_subregion'] })
    expect(planGridLossCalculation(electricity({}, {}, q('unknown', 'kWh')), context, evidence)).toMatchObject({ action: 'hold', reasons: ['electricity_record_held', 'quantity_not_calculable'] })
    expect(planGridLossCalculation(electricity({ locationId: warehouse }), context, evidence)).toMatchObject({ action: 'hold', status: 'excluded', reasons: ['electricity_record_held', 'location_excluded_by_company_setup'] })
    expect(() => planGridLossCalculation({ ...electricity(), activity: { ...electricity().activity, kind: 'natural_gas' } as never }, context, evidence)).toThrow('electricity')
  })
})
