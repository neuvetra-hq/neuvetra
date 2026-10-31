// Scope 3 completion I-12h (DESIGN 13.2, 13.3, A14, A27; Claude, 30 October 2026): hotel stays and buildings by floor area from
// the collection contract to the real Scope 3 engine with R6 loaded (`SCOPE3_LATE_SOURCES.usBuildingHotel2025`). Hotel stays saved
// before 0030 (mode text "hotel", room-nights as written) calculate without a re-save once their country is known (the record's own,
// or the reporting location's when it is the U.S., an estimate); other countries wait as optional `method_pending`. Buildings with
// natural gas use "not known" are held; the rest calculate. The r3 hotel record (10 room-nights) equals 10 x the room-night value
// worked out here from the R6, R3 and R1 cells with exact rational arithmetic (never from the engine). Coverage: a calculated hotel
// line counts in category 6 and is no longer an optional pending activity.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CollectionContext } from './collection-contract'
import { SCOPE3_BUILDING_HOTEL_REGISTER_SHA256, SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256 } from './method-reference'
import {
  planScope3Calculation, validateScope3Payload, SCOPE3_CBECS_ACTIVITIES, SCOPE3_CBECS_ACTIVITIES_LOADED, SCOPE3_HOTEL_COUNTRIES, SCOPE3_LATE_SOURCES,
  type Scope3CalculationPlan, type Scope3CollectionActivity, type Scope3CollectionKind, type Scope3CollectionVersion, type Scope3PlanOptions,
} from './scope3-collection'
import type { Scope3CoverageRecord, Scope3EngineResult } from './scope3-coverage'
import { scope3Coverage, type Scope3AggregateEngine } from './scope3-engine-output'
import { SCOPE3_METHODS } from './scope3-method-catalog'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_REASON_TEXT_I12H } from './scope3-text'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; results?: Array<{ status: string; code?: string; result?: Scope3EngineResult }>; catalog?: Record<string, any>; aggregate?: unknown }
}
const run = (plans: Scope3CalculationPlan[]) => engine({ action: 'calculate_many', requests: plans.map(p => p.call!.request) }).results!
const pins = { engineSha256: createHash('sha256').update(readFileSync(ENGINE)).digest('hex'), registerSha256: SCOPE3_REGISTER_2025_SHA256,
  additionalRegisterSha256s: { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256 } }
const realEngine: Scope3AggregateEngine = { aggregate: async (results, annotations) => {
  const out = engine(annotations ? { action: 'aggregate', results, annotations } : { action: 'aggregate', results })
  if (out.status !== 'ok') throw new Error(`refused: ${out.code}`)
  return out.aggregate as never
} }
const TIMEOUT = 120_000

const company = '93700000-0000-4000-8000-000000000001', setup = '93700000-0000-4000-8000-000000000002'
const office = '93700000-0000-4000-8000-000000000003', london = '93700000-0000-4000-8000-000000000004'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [
  { id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }, { id: london, name: 'London office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
const COUNTRIES: Scope3PlanOptions = { locationCountries: new Map([[office, 'US'], [london, 'GB']]), consolidationApproach: 'operational_control' }
const year = { start: '2025-01-01', endExclusive: '2026-01-01' }
const q = (value: string, unit: string, normalized = true) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalized ? value : null, normalizedUnit: normalized ? unit : null })
let n = 0
function record(kind: Scope3CollectionKind, quantity: ReturnType<typeof q>, payload: unknown, extra: Record<string, unknown> = {}): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `H-${n}`, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null,
    reference: 'Synthetic source', notes: '', evidenceIds: [], period: year, kind, quantity, payload: validateScope3Payload(kind, payload), ...extra } as unknown as Scope3CollectionActivity
  return { id: `93700000-0000-4000-8000-${String(10000 + n).padStart(12, '0')}`, recordId: `93700000-0000-4000-8000-${String(50000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: 'a'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}
const plan = (v: Scope3CollectionVersion, options: Scope3PlanOptions = COUNTRIES) => planScope3Calculation(v, context, [], options)
const LEGACY = { mode: 'hotel', passengerSegments: null, haulBasis: null }
const V2 = (hotelCountry: string | null) => ({ mode: 'hotel_stay', passengerSegments: null, haulBasis: null, cabinClass: null, hotelCountry })
const BUILDING = { category: 8, cbecsActivity: 'office', usesNaturalGas: 'yes', gridBasis: 'subregion', zip: '94105', subregion: 'CAMX', utilityEiaId: null, coveredDays: 365, leaseType: 'operating', noOperationalControlBasis: 'Shared building; landlord meters.' }

// Exact rationals from register text (no floating point): [numerator, denominator] as bigint.
type R = [bigint, bigint]
const gcd = (a: bigint, b: bigint): bigint => b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b)
const norm = ([a, b]: R): R => { const g = gcd(a, b); return [a / g, b / g] }
const rat = (text: string): R => { const [i, f = ''] = text.split('.'); return norm([BigInt(i + f), 10n ** BigInt(f.length)]) }
const mul = (...xs: R[]): R => norm(xs.reduce(([a, b], [c, d]) => [a * c, b * d], [1n, 1n] as R))
const add = (...xs: R[]): R => norm(xs.reduce(([a, b], [c, d]) => [a * d + c * b, b * d], [0n, 1n] as R))
const reg = (file: string) => JSON.parse(readFileSync(new URL(`./method-reference/${file}`, import.meta.url), 'utf8')) as { entries: Array<{ id: string; value: string }>; constants: Array<{ id: string; value: string }> }
const cells = new Map([...['verified-scope3-register-2025.json', 'verified-scope3-supplement-register-2025.json', 'verified-scope3-us-building-hotel-register-2025.json']
  .flatMap(file => { const r = reg(file); return [...r.entries, ...r.constants].map(e => [e.id, e.value] as const) })])
const c = (id: string) => rat(cells.get(id)!)
/** kg CO2e of one upper-upscale room-night: electricity (R6 kWh x 0.001 x US23 lb/MWh x 0.45359237) + natural gas (R6 MMBtu x Hub row 38), AR5. */
function roomNight(): R {
  const mwh = mul(c('epa_events2018.hotel.upper_upscale.electricity_kwh_per_room_night'), c('kwh_to_mwh'))
  const mmbtu = c('epa_events2018.hotel.upper_upscale.natural_gas_mmbtu_per_room_night')
  const gas = (g: string) => add(mul(mwh, c(`egrid2023_us.${g}`), c('lb_to_kg')), mul(mmbtu, c(`hub2025_t1.natural_gas.${g}`), g === 'co2' ? [1n, 1n] : c('g_to_kg')))
  return add(mul(gas('co2'), c('gwp_ar5.CO2')), mul(gas('ch4'), c('gwp_ar5.CH4')), mul(gas('n2o'), c('gwp_ar5.N2O')))
}

describe('I-12h: tokens agree with the engine catalog', () => {
  test('CBECS activities, the loaded ones, hotel countries; the flag is on', () => {
    const cat = engine({ action: 'catalog' }).catalog!
    expect([...SCOPE3_CBECS_ACTIVITIES].sort()).toEqual(cat.cbecsActivities)
    expect([...SCOPE3_CBECS_ACTIVITIES_LOADED]).toEqual(cat.cbecsActivitiesLoaded)
    expect([...SCOPE3_HOTEL_COUNTRIES]).toEqual(cat.hotelCountries)
    expect(SCOPE3_LATE_SOURCES.usBuildingHotel2025).toBe(true)
    for (const code of ['natural_gas_use_unknown', 'cbecs_activity_not_loaded', 'covered_days_exceed_days_in_year', 'hotel_country_required', 'hotel_country_not_in_factor_set']) expect(SCOPE3_REASON_TEXT_I12H[code]).toBeTruthy()
  }, TIMEOUT)
})

describe('I-12h: hotel stays (A14, A27)', () => {
  test('the r3 hotel record (10 room-nights, mode "hotel", saved before 0030) calculates without a re-save: 10 x the room-night value of the register cells', async () => {
    const r3 = SCOPE3_PAYLOAD_FIXTURES.find(f => f.label === 'business_travel: 0029 hotel record as saved by the r3 feeds (room-night not normalized)')!
    const v = record('business_travel', r3.quantity as ReturnType<typeof q>, r3.payload)
    const p = plan(v)
    expect([p.kind, p.category, p.action, p.status, p.optional, p.derivedFrom]).toEqual(['hotel_stay', 6, 'calculate', null, undefined, { recordId: v.recordId, kind: 'business_travel' }])
    expect(p.call!.request).toEqual({ kind: 'hotel_stay', input: { period: year, roomNights: '10', country: 'US', countryBasis: 'reporting_location' } })
    const [item] = run([p])
    expect(item!.status).toBe('ok')
    const result = item!.result!
    expect(rat(result.total!.unrounded)).toEqual(mul([10n, 1n], roomNight()))
    expect(result.estimates).toEqual(['hotel_country_from_reporting_location'])
    for (const note of [...result.boundary.notes, ...result.estimates]) expect(SCOPE3_DISCLOSURE_TEXT[note]).toBeTruthy()
    // Coverage: the stay counts in category 6 and is no longer an optional pending activity (A27 disclosure gone).
    const row: Scope3CoverageRecord = { recordId: v.recordId, category: 6, quality: 'actual', kind: 'hotel_stay', result: { outcome: 'calculated', resultSha256: result.resultSha256 } }
    const coverage = await scope3Coverage([row], [{ category: 6, decision: 'included', reason: null }], [result], realEngine, pins)
    const six = coverage.categories.find(x => x.category === 6)!
    expect([six.status, six.counts.calculated, six.counts.optionalPending, six.disclosures.includes('optional_activity_not_yet_quantified')]).toEqual(['calculated', 1, 0, false])
    expect(six.disclosures).toEqual(expect.arrayContaining(['optional_hotel_stays_included', 'hotel_class_not_collected_highest_intensity_used', 'available_room_night_basis_no_occupancy_adjustment', 'hotel_energy_data_2005_vintage']))
  }, TIMEOUT)

  test('the hotel country: stated, from a U.S. reporting location (estimate), outside the U.S. (optional pending) or needed', () => {
    const stated = plan(record('business_travel', q('3', 'room-night'), V2('US'), { locationId: london }))
    expect(stated.call!.request.input).toEqual({ period: year, roomNights: '3', country: 'US', countryBasis: 'stated' })
    for (const country of ['GB', 'CA']) {
      const abroad = plan(record('business_travel', q('3', 'room-night'), V2(country)))
      expect([abroad.kind, abroad.status, abroad.optional, abroad.reasons, abroad.call]).toEqual(['hotel_stay', 'method_pending', true, ['hotel_country_not_in_factor_set'], null])
    }
    // No hotel country and a reporting location outside the U.S., or a location country not known to the caller: the country is needed.
    expect(plan(record('business_travel', q('3', 'room-night'), V2(null), { locationId: london })).reasons).toEqual(['hotel_country_required'])
    expect(plan(record('business_travel', q('10', 'room-night', false), LEGACY), {}).reasons).toEqual(['hotel_country_required'])
    expect(plan(record('business_travel', q('10', 'room-night', false), LEGACY), {}).kind).toBe('business_travel')
    // What the user can fix comes first; with the flag off the stay waits for its factor source as before (I-05).
    expect(plan(record('business_travel', q('ten', 'room-night', false), LEGACY)).reasons).toEqual(['quantity_not_calculable'])
    const off = plan(record('business_travel', q('3', 'room-night'), V2('US')), { ...COUNTRIES, lateSources: { usUpstream2025: true, usBuildingHotel2025: false } })
    expect([off.status, off.optional, off.reasons]).toEqual(['method_pending', true, ['factor_source_not_yet_loaded']])
  })
})

describe('I-12h: buildings by floor area (DESIGN 13.2)', () => {
  test('a complete record is sent with exactly the engine keys and calculates; names and lease facts are never sent', () => {
    const p = plan(record('building_average', q('1200.5', 'm2'), { ...BUILDING, category: 13, cbecsActivity: 'retail_non_mall', usesNaturalGas: 'no', coveredDays: 200, leaseType: 'operating' }),
      { ...COUNTRIES, consolidationApproach: 'operational_control' })
    expect(p.call!.request).toEqual({ kind: 'building_average', input: { period: year, category: 13, cbecsActivity: 'retail_non_mall', usesNaturalGas: 'no', area: '1200.5', areaUnit: 'm2',
      coveredDays: 200, gridBasis: 'subregion', zip: '94105', subregion: 'CAMX', utilityEiaId: null } })
    const us = plan(record('building_average', q('12000', 'sqft'), { ...BUILDING, category: 14, gridBasis: 'us_average', zip: null, subregion: null, leaseType: null, noOperationalControlBasis: null }))
    const results = run([p, us])
    expect(results.map(x => [x.status, x.result?.status, x.result?.methodVersionId])).toEqual([['ok', 'complete', 'scope3.cat8_13_14.building_average.cbecs2018.v1'], ['ok', 'complete', 'scope3.cat8_13_14.building_average.cbecs2018.v1']])
    // 12,000 sq ft of office in the U.S. average grid, gas used, the whole year: electricity and gas from the cells.
    const sqft: R = [12000n, 1n]
    const mwh = mul(sqft, c('cbecs2018.electricity_kwh_per_sqft.office'), c('kwh_to_mwh'))
    const mmbtu = mul(sqft, c('cbecs2018.natural_gas_cf_per_sqft.office'), c('hub2025_t1.natural_gas.heat_content'))
    const gas = (g: string) => add(mul(mwh, c(`egrid2023_us.${g}`), c('lb_to_kg')), mul(mmbtu, c(`hub2025_t1.natural_gas.${g}`), g === 'co2' ? [1n, 1n] : c('g_to_kg')))
    expect(rat(results[1]!.result!.total!.unrounded)).toEqual(add(mul(gas('co2'), c('gwp_ar5.CO2')), mul(gas('ch4'), c('gwp_ar5.CH4')), mul(gas('n2o'), c('gwp_ar5.N2O'))))
    for (const r of results) for (const note of [...r.result!.boundary.notes, ...r.result!.estimates]) expect(SCOPE3_DISCLOSURE_TEXT[note]).toBeTruthy()
    expect(SCOPE3_METHODS['scope3.cat8_13_14.building_average.cbecs2018.v1']!.categories).toEqual([8, 13, 14])
  }, TIMEOUT)

  test('holds: natural gas use not known, more covered days than the year has, and what the user can fix; with the flag off it waits', () => {
    // Round 3, lane A (AC-10): natural gas use not known is the engine's hold (its own finding and trace), no longer the adapter's.
    expect(plan(record('building_average', q('100', 'sqft'), { ...BUILDING, usesNaturalGas: 'unknown' })).action).toBe('calculate')
    expect(plan(record('building_average', q('100', 'sqft'), { ...BUILDING, coveredDays: 366 })).reasons).toEqual(['covered_days_exceed_days_in_year'])
    expect(plan(record('building_average', q('100', 'sqft'), { ...BUILDING, cbecsActivity: 'data_center', usesNaturalGas: 'unknown' })).reasons).toEqual(['cbecs_activity_not_an_engine_token'])
    expect(plan(record('building_average', q('100', 'sqft'), { ...BUILDING, leaseType: 'finance' })).reasons).toEqual(['finance_lease_in_scope1_2'])
    const off = plan(record('building_average', q('100', 'sqft'), BUILDING), { ...COUNTRIES, lateSources: { usUpstream2025: true, usBuildingHotel2025: false } })
    expect([off.status, off.optional, off.reasons]).toEqual(['method_pending', undefined, ['factor_source_not_yet_loaded']])
    // Every shared building fixture the adapter calculates is accepted by the engine (never refused).
    const plans = SCOPE3_PAYLOAD_FIXTURES.filter(f => f.valid && f.kind === 'building_average').map(f => plan(record('building_average', f.quantity as ReturnType<typeof q>, f.payload))).filter(p => p.action === 'calculate')
    expect(plans.length).toBeGreaterThan(0)
    expect(run(plans).every(x => x.status === 'ok')).toBe(true)
  }, TIMEOUT)
})
