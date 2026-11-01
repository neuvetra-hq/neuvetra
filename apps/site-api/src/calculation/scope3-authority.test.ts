import { describe, expect, test } from 'bun:test'
import { SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from '../../../../packages/neuvetra-database/src/method-reference'
import { SCOPE3_METHODS } from '../../../../packages/neuvetra-database/src/scope3-method-catalog'
import { SCOPE3_REPORT_MAX_TEXT_BYTES } from '../../../../packages/neuvetra-database/src/scope3-assessment-contract'
import { createScope3Engine, SCOPE3_ENGINE_MAX_BYTES, Scope3Refusal, type Scope3Request } from './scope3-authority'

const period = { start: '2025-01-01', endExclusive: '2026-01-01' }
const python = process.env.NEUVETRA_PYTHON ?? 'python3'
// In the API this is the engine_sha256 of the current release; here, the file under test.
const expectedEngineSha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(new URL('./scope3_engine.py', import.meta.url)).bytes()).digest('hex')
const TIMEOUT = 120_000

describe('Scope 3 engine bridge', () => {
  test('describes the five reviewed methods, the three I-03 purchase methods, the five I-05 methods and the six I-07 methods, bound to one engine hash and the approved register', async () => {
    const d = await createScope3Engine({ python, expectedEngineSha256 }).describe()
    expect(d.registerSha256).toBe('5a534d33e70f7eb83bd8b0870da4cd8530e1d3429b3cb7e610b7941abce354f2')
    expect(d.methods.map(m => m.id)).toEqual(['scope3.asset_energy.v1', 'scope3.cat11.sold_energy_product.v1', 'scope3.cat11.sold_fuel.hub2025.v1', 'scope3.cat11.sold_ghg_product.hub2025.v1',
      'scope3.cat12.end_of_life_split.v1', 'scope3.cat15.investment_reported.v1', 'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1',
      'scope3.cat1_2.average_data_user_factor.v1', 'scope3.cat1_2.supplier_specific.v1', 'scope3.cat3.td_losses.egrid2023.v1',
      // I-12u: the four category 3 upstream methods.
      'scope3.cat3a.upstream_fuels.us_netl2024_cagreet3.v1', 'scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1', 'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1',
      'scope3.cat3d.energy_resold.egrid2023.v1', 'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1', 'scope3.cat4_9.transport_distance.v1', 'scope3.cat5_12.waste.v1', 'scope3.cat6.business_travel_distance.v1',
      'scope3.cat6.hotel_stay.epa2018_events.v1', // I-12h
      'scope3.cat7.commuting_average.v1', 'scope3.cat7.employee_commuting_distance.v1', 'scope3.cat7.teleworking.v1',
      'scope3.cat8_13_14.building_average.cbecs2018.v1', // I-12h
      'scope3.partner_reported.v1', 'scope3.spend.epa_scghg_v1_3.v1'])
    expect(new Set(d.methods.map(m => m.engineSha256))).toEqual(new Set([d.engineSha256]))
  })

  test('calculates each category, aggregates, and turns refusals into codes', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    const losses = await engine.calculate({ kind: 'td_losses', input: { period, quantity: '10000', unit: 'kWh', subregion: 'CAMX', zip: '94105' } })
    const truck = await engine.calculate({ kind: 'transport', input: { period, category: 4, vehicle: 'medium_and_heavy_duty_truck', loadBasis: 'dedicated_vehicle', thirdPartyFacilities: 'none', activity: { value: '1000', unit: 'vehicle-mile' } } })
    const waste = await engine.calculate({ kind: 'waste', input: { period, category: 5, material: 'mixed_msw', treatment: 'landfilled', quantity: '2', unit: 'short_ton' } })
    const flight = await engine.calculate({ kind: 'business_travel', input: { period, mode: 'air', segmentDistance: { value: '2475', unit: 'mile' }, passengerSegments: 2 } })
    const bus = await engine.calculate({ kind: 'employee_commuting', input: { period, mode: 'bus', activity: { value: '1000', unit: 'passenger-mile' } } })
    expect([losses, truck, waste, flight, bus].map(r => r.total?.display)).toEqual(['83.3793', '1308.2860', '1160.0000', '813.7543', '66.6323'])
    const sum = await engine.aggregate([losses, truck, waste, flight, bus])
    expect(Object.keys(sum.categorySubtotals)).toEqual(['3', '4', '5', '6', '7'])
    expect([sum.allCalculated, sum.complete, sum.mixedGwpSets, sum.partialBoundaryResults.length]).toEqual([true, false, true, 1])
    await expect(engine.calculate({ kind: 'employee_commuting', input: { period, mode: 'air_short_haul' as never, activity: { value: '1', unit: 'passenger-mile' } } })).rejects.toEqual(new Scope3Refusal('unsupported_mode'))
  })

  test('refuses to run an engine whose hash differs from the released one', async () => {
    await expect(createScope3Engine({ python, expectedEngineSha256: '0'.repeat(64) }).describe()).rejects.toThrow('Scope 3 engine unavailable.')
    const items = await createScope3Engine({ python, expectedEngineSha256: '0'.repeat(64) }).calculateMany([{ kind: 'waste', input: { period, category: 5, material: 'mixed_msw', treatment: 'landfilled', quantity: '2', unit: 'short_ton' } }])
    expect(items).toEqual([{ status: 'unavailable', code: null }])
  })
})

// Scope 3 completion I-01 (DESIGN 4.1, 4.2, 6.1, 8.3).
const waste = (quantity: string, treatment = 'landfilled'): Scope3Request => ({ kind: 'waste', input: { period, category: 5, material: 'mixed_msw', treatment, quantity, unit: 'kg' } })
const commute = (value: string): Scope3Request => ({ kind: 'employee_commuting', input: { period, mode: 'bus', activity: { value, unit: 'passenger-mile' } } })
const losses = (quantity: string): Scope3Request => ({ kind: 'td_losses', input: { period, quantity, unit: 'kWh', subregion: 'CAMX', zip: '94105' } })
/** A synthetic 3,000-line mix of every existing kind (some held by the engine, some refused). */
function mix(n: number): Scope3Request[] {
  return Array.from({ length: n }, (_, i) => {
    const q = `${1 + (i * 37) % 9999}.${String(i % 1000).padStart(3, '0')}`
    switch (i % 6) {
      case 0: return waste(q)
      case 1: return commute(q)
      case 2: return losses(q)
      case 3: return { kind: 'transport', input: { period, category: 9, vehicle: 'rail', loadBasis: 'shared_vehicle', activity: { value: q, unit: 'tonne-km' }, thirdPartyFacilities: i % 2 ? 'none' : 'unknown' } }
      case 4: return { kind: 'business_travel', input: { period, mode: 'air', segmentDistance: { value: q, unit: 'km' }, passengerSegments: 1 + (i % 7) } }
      default: return i % 5 === 0 ? waste(q, 'recycled') : waste('1.2345')
    }
  })
}

describe('Scope 3 batch bridge (I-01)', () => {
  test('the engine describes the same method facts as the shared catalog, and pins R2 (I-03) and R3 (I-05) as its other registers', async () => {
    const d = await createScope3Engine({ python, expectedEngineSha256 }).describe()
    expect(d.additionalRegisterSha256s).toEqual({ spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 })
    expect(Object.keys(d.methodMetadata).sort()).toEqual(Object.keys(SCOPE3_METHODS).sort())
    for (const m of d.methods) {
      const entry = SCOPE3_METHODS[m.id]!, meta = d.methodMetadata[m.id] as Record<string, any>
      expect([m.profileId, m.gwpSetId, m.title]).toEqual([entry.profileId, entry.gwpSetId, entry.title])
      expect([meta.methodType, meta.activityDataOrigin, meta.defaultDataQuality.indicators, meta.defaultDataQualityUnverified?.indicators, meta.biogenicTreatment])
        .toEqual([entry.methodType, entry.activityDataOrigin, entry.defaultDataQuality, entry.defaultDataQualityUnverified, entry.biogenicTreatment])
      // I-12u: a default selected by a boundary note (3A liquid fuels) is the catalog's.
      expect([m.id, meta.defaultDataQualityByNote ? Object.fromEntries(Object.entries(meta.defaultDataQualityByNote as Record<string, { indicators: unknown }>).map(([k, v]) => [k, v.indicators])) : undefined])
        .toEqual([m.id, entry.defaultDataQualityByNote])
      // A method that reads another register declares it and may say so on its results (`additionalRegisters`).
      // I-05: energy resold (U.S. rates), teleworking and asset energy (Hub Table 1 and the GWP tables) read R3.
      // I-07: the three category 11 methods read R3, the revenue-based investment proxy R2.
      // I-12u: the category 3 upstream methods read R3 (eGRID heat input and generation, unit constants) and R5.
      const reads = ['scope3.spend.epa_scghg_v1_3.v1', 'scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1'].includes(m.id) ? ['spend']
        : /^scope3\.cat3[abcd]\.(upstream_|td_losses_upstream|energy_resold_upstream)/.test(m.id) ? ['supplement', 'us_upstream']
        : ['scope3.cat3d.energy_resold.egrid2023.v1', 'scope3.cat7.teleworking.v1', 'scope3.asset_energy.v1', 'scope3.cat11.sold_fuel.hub2025.v1', 'scope3.cat11.sold_energy_product.v1',
          'scope3.cat11.sold_ghg_product.hub2025.v1'].includes(m.id) ? ['supplement']
          // I-12h: hotel stays and buildings read R6 and R3 (eGRID U.S. rates, Hub Table 1 natural gas).
          : ['scope3.cat6.hotel_stay.epa2018_events.v1', 'scope3.cat8_13_14.building_average.cbecs2018.v1'].includes(m.id) ? ['building_hotel', 'supplement'] : []
      expect([m.id, meta.additionalRegisters]).toEqual([m.id, reads])
      // I-07: fuels and fuel-using products quantify biogenic CO2; investments carry projected lifetime emissions as memo items.
      const extras = [...(reads.length ? ['additionalRegisters'] : []), ...(['scope3.cat11.sold_fuel.hub2025.v1', 'scope3.cat11.sold_energy_product.v1'].includes(m.id) ? ['biogenicCo2'] : []),
        ...(m.id.startsWith('scope3.cat15.') ? ['memoItems'] : []),
        // Round 3, lane A (owner decisions 2 and 3): the coal screening range of upstream electricity and the gas left at end of life.
        ...(['scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1', 'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1', 'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1',
          'scope3.cat11.sold_ghg_product.hub2025.v1'].includes(m.id) ? ['memoItems'] : [])]
      expect([m.id, [...entry.resultExtras] as string[]]).toEqual([m.id, extras])
    }
  }, TIMEOUT)

  test('I-03: spend and supplier requests reach the engine through the batch bridge (R2 re-hashed with every call)', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    const items = await engine.calculateMany([
      { kind: 'purchase_spend', input: { period, category: 1, naicsCode: '111130', amount: '1000.00', currency: 'USD', dollarYear: 2022, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null } },
      { kind: 'purchase_spend', input: { period, category: 1, naicsCode: '541511', amount: '100000.00', currency: 'USD', dollarYear: 2024, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null } },
      { kind: 'purchase_spend', input: { period, category: 1, naicsCode: '221100', amount: '5.00', currency: 'USD', dollarYear: 2022, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null } },
      { kind: 'purchase_supplier', input: { period, category: 1, factorOrigin: 'supplier_primary', basis: 'product_factor', quantity: '200000', unit: 'kg', factorValue: '0.15', factorUnit: 'kg CO2e per kg',
        allocationNumerator: null, allocationDenominator: null, boundary: 'cradle_to_gate', hybridUpstreamCoveredBy: null, gwpBasis: 'AR5', verification: 'unverified' } },
      { kind: 'purchase_spend', input: { period, category: 2, naicsCode: '236220', amount: '1.00', currency: 'USD', dollarYear: 2022, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null } },
    ])
    const results = items.map(item => item.status === 'ok' ? item.result : null)
    // research/methods-purchases.md TV-S4 (848, never 849), TV-S5 (7894.2757 with the transcribed index), TV-S7 (held); GHGP 1.1 first line.
    expect(results.slice(0, 4).map(r => [r?.status, r?.total?.display ?? null, r?.findings])).toEqual([
      ['complete', '848.0000', []], ['complete', '7894.2757', []], ['input_needed', null, ['naics_code_not_in_factor_set']], ['complete', '30000.0000', []]])
    expect(items[4]).toEqual({ status: 'refused', code: 'capital_goods_must_be_full_cost' })
    expect(results[0]!.additionalRegisters).toEqual([{ name: 'spend', sha256: SCOPE3_SPEND_REGISTER_SHA256 }])
    expect([results[3]!.methodVersionId, results[3]!.gwpSetId, results[3]!.boundary.notes]).toEqual(['scope3.cat1_2.supplier_specific.v1', 'AS-REPORTED', ['supplier_data_unverified', 'supplier_gwp_basis_ar5']])
    const sum = await engine.aggregate([results[0]!, results[1]!, results[3]!])
    expect([sum.categorySubtotals['1']!.display, sum.additionalRegisterSha256s, sum.mixedGwpSets]).toEqual(['38742.2757', { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 }, true])
  }, TIMEOUT)

  test('I-05: energy resold, average commuting, teleworking, asset energy and partner requests reach the engine through the batch bridge (R3 re-hashed with every call)', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    const none = { zip: null, subregion: null, utilityEiaId: null }
    const items = await engine.calculateMany([
      { kind: 'energy_resold', input: { period, quantity: '1000', unit: 'MWh', gridBasis: 'us_average', ...none } },
      { kind: 'commuting_average', input: { period, headcount: '10', workingDays: 200, modes: [{ mode: 'non_motorized', sharePercent: '100', oneWayDistance: '1', distanceUnit: 'mile', occupancy: null }] } },
      { kind: 'teleworking', input: { period, carrier: 'natural_gas', quantity: '85', unit: 'therm', ...none } },
      { kind: 'asset_energy', input: { period, category: 14, carrier: 'refrigerant', quantity: '2', unit: 'kg', ...none, refrigerantGas: 'R-410A', allocation: null } },
      { kind: 'partner_reported', input: { period, category: 13, quantity: '9000', unit: 'kg CO2e', allocationBasis: 'area', allocationNumerator: '5000', allocationDenominator: '15000',
        scope2Basis: 'location', gwpBasis: 'AR5', verification: 'third_party_verified', periodMatches: true } },
      { kind: 'asset_energy', input: { period, category: 14, carrier: 'refrigerant', quantity: '2', unit: 'kg', ...none, refrigerantGas: 'HCFC-22', allocation: null } },
    ])
    const results = items.map(item => item.status === 'ok' ? item.result : null)
    // 1,000 MWh x 767.209 lb/MWh (US23 U3) ... ; 0 for walking; 8.5 MMBtu x Hub row 38 (451.47325, half-even 451.4732); 2 kg x 1,924 (Hub D575); 9,000 x round12(1/3).
    expect(results.slice(0, 5).map(r => [r?.methodVersionId, r?.total?.display])).toEqual([['scope3.cat3d.energy_resold.egrid2023.v1', '349685.6978'], ['scope3.cat7.commuting_average.v1', '0.0000'],
      ['scope3.cat7.teleworking.v1', '451.4732'], ['scope3.asset_energy.v1', '3848.0000'], ['scope3.partner_reported.v1', '3000.0000']])
    expect(items[5]).toEqual({ status: 'refused', code: 'unknown_refrigerant' })
    expect(results[0]!.additionalRegisters).toEqual([{ name: 'supplement', sha256: SCOPE3_SUPPLEMENT_REGISTER_SHA256 }])
    const sum = await engine.aggregate(results.slice(0, 5) as never)
    expect([Object.keys(sum.categorySubtotals), sum.additionalRegisterSha256s.supplement, sum.categoryProfiles['13']!.shareOfKnownTotal !== null]).toEqual([['3', '7', '13', '14'], SCOPE3_SUPPLEMENT_REGISTER_SHA256, true])
  }, TIMEOUT)

  test('each batch item equals a single calculate: results, refusals in place, order kept, more than one chunk', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    const requests = mix(2003)
    const items = await engine.calculateMany(requests)
    expect(items).toHaveLength(2003)
    const sample = [0, 1, 2, 3, 4, 5, 11, 1999, 2000, 2001, 2002]
    for (const i of sample) {
      const single = await engine.calculate(requests[i]!).then(result => ({ status: 'ok', result }), (error: unknown) => error instanceof Scope3Refusal ? { status: 'refused', code: error.code } : { status: 'unavailable', code: null })
      expect([i, items[i]]).toEqual([i, single as never])
    }
    expect(items[11]).toEqual({ status: 'refused', code: 'invalid_quantity' })
    expect(items.filter(item => item.status === 'unavailable')).toEqual([])
  }, TIMEOUT)

  test('requests are chunked by size as well as count; one request over the limit is unavailable alone', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    // Three 7 MiB requests would be 21 MiB in one call (over the 16 MiB cap); chunked at 12 MiB each reaches the engine.
    const big = (n: number) => ({ kind: 'waste', input: { ...waste('1').input, padding: String(n).repeat(7 * 1024 * 1024) } }) as unknown as Scope3Request
    expect(await engine.calculateMany([big(1), big(2), big(3)])).toEqual(Array(3).fill({ status: 'refused', code: 'invalid_input_shape' }))
    const huge = { kind: 'waste', input: { ...waste('1').input, padding: 'x'.repeat(13 * 1024 * 1024) } } as unknown as Scope3Request
    const items = await engine.calculateMany([waste('1'), huge, waste('2')])
    expect(items.map(item => item.status)).toEqual(['ok', 'unavailable', 'ok'])
  }, TIMEOUT)

  test('third and fourth concurrent Scope 3 calls queue and succeed', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    const runs = await Promise.all([0, 1, 2, 3].map(k => engine.calculateMany(mix(300).map((r, i) => i === 0 ? commute(String(k + 1)) : r))))
    expect(runs.map(items => items.filter(item => item.status === 'unavailable').length)).toEqual([0, 0, 0, 0])
    expect(runs.map(items => (items[0] as { result: { total: { unrounded: string } } }).result.total.unrounded)).toEqual(['0.0666323', '0.1332646', '0.1998969', '0.2665292'])
  }, TIMEOUT)

  test('aggregate takes annotations; a malformed one is refused', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    const results = (await engine.calculateMany([commute('1000'), waste('2000')])).flatMap(item => item.status === 'ok' ? [item.result] : [])
    const plain = await engine.aggregate(results)
    expect(Object.keys(plain.categoryProfiles)).toEqual(['5', '7'])
    const noted = await engine.aggregate(results, [{ dataQuality: null, activityDataOrigin: 'value_chain_partner' }, { dataQuality: null, activityDataOrigin: null }])
    expect([plain.categoryProfiles['7']!.valueChain.percent, noted.categoryProfiles['7']!.valueChain.percent]).toEqual([{ value: '0', display: '0.0' }, { value: '100', display: '100.0' }])
    await expect(engine.aggregate(results, [{ dataQuality: null, activityDataOrigin: null }])).rejects.toEqual(new Scope3Refusal('invalid_annotation'))
  }, TIMEOUT)

  test('throughput: a 3,000-line batch and its aggregate finish in under 10 seconds', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    const started = performance.now()
    const items = await engine.calculateMany(mix(3000))
    const calculated = performance.now()
    const results = items.flatMap(item => item.status === 'ok' ? [item.result] : [])
    const aggregate = await engine.aggregate(results, results.map(() => ({ dataQuality: null, activityDataOrigin: null })))
    const done = performance.now()
    expect(aggregate.resultCount).toBe(results.length)
    expect(results.length).toBeGreaterThan(2400)
    console.info(`Scope 3 throughput: ${items.length} requests in ${Math.round(calculated - started)} ms; aggregate of ${results.length} results in ${Math.round(done - calculated)} ms`)
    expect(done - started).toBeLessThan(10_000)
  }, TIMEOUT)
})

// Round 2b integration (DESIGN 13.7): the bridge and the engine share one 64 MiB cap, so a run at the line cap (3,000 lines)
// reaches the engine: 1,000 electricity records' 3C, 3C upstream and 3B lines in CAMX (with coal) are about 25 MB of
// aggregate request and a 2,000-line batch answers about 19 MB, both over the old 16 MiB. Round 2c (DESIGN 13.8): 0030's
// report texts may be 128 MiB each; the engine cap stays 64 MiB (the worst-case aggregate request at the cap is 37.4 MiB),
// so it is no longer the same number as 0030's text limit, only never larger.
describe('Scope 3 bridge size cap (round 2b)', () => {
  test('one 64 MiB cap in the bridge and the engine; 0030 stores larger report texts', async () => {
    const engineSource = await Bun.file(new URL('./scope3_engine.py', import.meta.url)).text()
    expect(engineSource.match(/^MAX_REQUEST_BYTES = (.+)$/m)?.[1]).toBe('64 * 1024 * 1024')
    expect(SCOPE3_ENGINE_MAX_BYTES).toBe(64 * 1024 * 1024)
    expect(SCOPE3_REPORT_MAX_TEXT_BYTES).toBe(128 * 1024 * 1024)
    expect(SCOPE3_ENGINE_MAX_BYTES).toBeLessThan(SCOPE3_REPORT_MAX_TEXT_BYTES)
    const routes = await Bun.file(new URL('../workspace/scope3-results-routes.ts', import.meta.url)).text()
    expect(routes.match(/^export const MAX_SCOPE3_LINES = (\d+)$/m)?.[1]).toBe('3000')
  })

  test('3,000 category 3 lines of 1,000 electricity records calculate and aggregate through the bridge (over the old 16 MiB both ways)', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    const kinds = ['td_losses', 'td_losses_upstream', 'electricity_upstream'] as const
    const requests = Array.from({ length: 3000 }, (_, i) => ({ kind: kinds[i % 3]!, input: { period, quantity: String(250000 + Math.floor(i / 3)), unit: 'kWh', subregion: 'CAMX', zip: '94105', utilityEiaId: '16612' } }) as Scope3Request)
    const items = await engine.calculateMany(requests)
    const results = items.flatMap(item => item.status === 'ok' ? [item.result] : [])
    expect(results.length).toBe(3000)
    const firstChunk = new TextEncoder().encode(JSON.stringify({ status: 'ok', results: items.slice(0, 2000) })).length
    const sent = new TextEncoder().encode(JSON.stringify({ action: 'aggregate', results, annotations: results.map(() => ({ dataQuality: null, activityDataOrigin: null })) })).length
    expect([firstChunk > 16 * 1024 * 1024, sent > 16 * 1024 * 1024, sent < SCOPE3_ENGINE_MAX_BYTES / 2]).toEqual([true, true, true])
    const aggregate = await engine.aggregate(results, results.map(() => ({ dataQuality: null, activityDataOrigin: null })))
    expect([aggregate.resultCount, aggregate.includedResults.length]).toEqual([3000, 3000])
    console.info(`Scope 3 bridge cap: first batch answered ${firstChunk} bytes; aggregate request ${sent} bytes`)
  }, TIMEOUT)
})

// Scope 3 completion I-03 (DESIGN 4.2): `calculateMany(requests, { timeoutMs })` and `aggregate(results, annotations, { timeoutMs })`.
describe('Scope 3 bridge call deadlines (I-03)', () => {
  test('with time left the results are the same; past the deadline every line is unavailable and an aggregate fails, never a partial figure', async () => {
    const engine = createScope3Engine({ python, expectedEngineSha256 })
    const requests = [commute('1000'), waste('2000')]
    const plain = await engine.calculateMany(requests)
    expect(await engine.calculateMany(requests, { timeoutMs: 60_000 })).toEqual(plain)
    // One millisecond cannot run any engine process: every item (both chunks of 2,003) is unavailable, none is a figure.
    expect(await engine.calculateMany(requests, { timeoutMs: 1 })).toEqual(Array(2).fill({ status: 'unavailable', code: null }))
    const many = await engine.calculateMany(mix(2003), { timeoutMs: 1 })
    expect([many.length, many.every(item => item.status === 'unavailable')]).toEqual([2003, true])
    const results = plain.flatMap(item => item.status === 'ok' ? [item.result] : [])
    const annotations = results.map(() => ({ dataQuality: null, activityDataOrigin: null }))
    expect(await engine.aggregate(results, annotations, { timeoutMs: 60_000 })).toEqual(await engine.aggregate(results, annotations))
    await expect(engine.aggregate(results, annotations, { timeoutMs: 1 })).rejects.toThrow('Scope 3 engine unavailable.')
    await expect(engine.calculateMany(requests, { timeoutMs: 0 })).rejects.toThrow('Invalid engine call timeout.')
    await expect(engine.aggregate(results, annotations, { timeoutMs: 2.5 })).rejects.toThrow('Invalid engine call timeout.')
  }, TIMEOUT)
})
