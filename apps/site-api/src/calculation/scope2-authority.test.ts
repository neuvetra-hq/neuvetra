import { describe, expect, test } from 'bun:test'
import { createScope2Engine, Scope2Refusal } from './scope2-authority'

const period = { start: '2025-01-01', endExclusive: '2026-01-01' }
const python = process.env.NEUVETRA_PYTHON ?? 'python3'
// In the API this is the engine_sha256 of the current release; here, the file under test.
const expectedEngineSha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(new URL('./scope2_engine.py', import.meta.url)).bytes()).digest('hex')

describe('Scope 2 engine bridge', () => {
  test('looks up a ZIP, calculates both bases and aggregates', async () => {
    const engine = createScope2Engine({ python, expectedEngineSha256 })
    expect((await engine.lookupZip('07401')).needsUtilityChoice).toBe(true)
    const office = await engine.calculate({ period, quantity: '10000', unit: 'kWh', subregion: 'CAMX', zip: '94105' })
    expect([office.locationBased.total?.display, office.marketBased.total?.display, office.marketBased.status, office.marketBased.residualMix?.voluntaryReMwh]).toEqual(['1950.2612', '1969.4722', 'complete', '2155596'])
    const green = await engine.calculate({ period, quantity: '10', unit: 'MWh', subregion: 'CAMX', zip: '94105', instruments: [{ type: 'energy_attribute_certificate', mwh: '4', qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: 'REC-1', generationTechnology: 'wind' }] })
    expect(green.marketBased.total?.display).toBe('1181.6833')
    const gas = await engine.calculate({ period, quantity: '10', unit: 'MWh', subregion: 'CAMX', zip: '94105', instruments: [{ type: 'power_purchase_agreement', mwh: '10', qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: 'PPA-1', generationTechnology: 'natural_gas' }] })
    expect([gas.locationBased.status, gas.marketBased.status, gas.marketBased.total]).toEqual(['complete', 'input_needed', null])
    const sum = await engine.aggregate([office, green, gas])
    expect([sum.locationBasedSubtotal.display, sum.marketBasedSubtotal.display, sum.locationBasedComplete, sum.marketBasedComplete]).toEqual(['5850.7837', '3151.1556', true, false])
    await expect(engine.calculate({ period, quantity: '1', unit: 'kWh', subregion: 'ZZZZ', zip: '94105' })).rejects.toEqual(new Scope2Refusal('unknown_subregion'))
  })

  test('refuses an engine whose hash differs from the released one', async () => {
    await expect(createScope2Engine({ python, expectedEngineSha256: '0'.repeat(64) }).describe()).rejects.toThrow('Scope 2 engine unavailable.')
  })
})
