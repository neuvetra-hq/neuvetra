import { describe, expect, test } from 'bun:test'
import { createScope3Engine, Scope3Refusal } from './scope3-authority'

const period = { start: '2025-01-01', endExclusive: '2026-01-01' }
const python = process.env.NEUVETRA_PYTHON ?? 'python3'
// In the API this is the engine_sha256 of the current release; here, the file under test.
const expectedEngineSha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(new URL('./scope3_engine.py', import.meta.url)).bytes()).digest('hex')

describe('Scope 3 engine bridge', () => {
  test('describes five methods bound to one engine hash and the approved register', async () => {
    const d = await createScope3Engine({ python, expectedEngineSha256 }).describe()
    expect(d.registerSha256).toBe('5a534d33e70f7eb83bd8b0870da4cd8530e1d3429b3cb7e610b7941abce354f2')
    expect(d.methods.map(m => m.id)).toEqual(['scope3.cat3.td_losses.egrid2023.v1', 'scope3.cat4_9.transport_distance.v1', 'scope3.cat5_12.waste.v1',
      'scope3.cat6.business_travel_distance.v1', 'scope3.cat7.employee_commuting_distance.v1'])
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
  })
})
