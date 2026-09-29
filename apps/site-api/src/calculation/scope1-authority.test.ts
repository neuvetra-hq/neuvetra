import { describe, expect, test } from 'bun:test'
import { createScope1Engine, Scope1Refusal } from './scope1-authority'

const period = { start: '2025-01-01', endExclusive: '2026-01-01' }
const python = process.env.NEUVETRA_PYTHON ?? 'python3'
// In the API this is the engine_sha256 of the current release; here, the file under test.
const expectedEngineSha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(new URL('./scope1_engine.py', import.meta.url)).bytes()).digest('hex')

describe('Scope 1 engine bridge', () => {
  test('describes five methods bound to one engine hash and the approved register', async () => {
    const d = await createScope1Engine({ python, expectedEngineSha256 }).describe()
    expect(d.registerSha256).toBe('f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02')
    expect(d.methods.map(m => m.id)).toEqual(['scope1.fugitive.material_balance.v2', 'scope1.mobile.onroad_diesel.v2', 'scope1.mobile.onroad_gasoline.v2', 'scope1.stationary.distillate_no2.v2', 'scope1.stationary.natural_gas.v2'])
    expect(new Set(d.methods.map(m => m.engineSha256))).toEqual(new Set([d.engineSha256]))
  })

  test('calculates, aggregates, and turns refusals into codes', async () => {
    const engine = createScope1Engine({ python, expectedEngineSha256 })
    const gas = await engine.calculate('natural_gas', { period, quantity: '61500', unit: 'therm' })
    expect(gas.total?.display).toBe('326654.1750')
    const van = await engine.calculate('vehicle', { period, fuel: 'gasoline', vehicleType: 'gasoline_passenger_car', modelYear: 2020, gallons: '300' })
    expect(van.status).toBe('partial')
    const sum = await engine.aggregate([gas, van])
    expect(sum.knownSourceSubtotal.display).toBe('329288.1750')
    expect(sum.complete).toBe(false)
    await expect(engine.calculate('natural_gas', { period, quantity: '1', unit: 'gallon' })).rejects.toEqual(new Scope1Refusal('unsupported_unit'))
  })

  test('refuses to run an engine whose hash differs from the released one', async () => {
    expect(() => createScope1Engine({ python } as never)).toThrow('An expected engine SHA-256 is required.')
    const engine = createScope1Engine({ python, expectedEngineSha256: '0'.repeat(64) })
    await expect(engine.describe()).rejects.toThrow('Scope 1 engine unavailable.')
  })
})
