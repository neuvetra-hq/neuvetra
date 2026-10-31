// Scope 3 completion, integration wave 3 (I-05 + I-06; DESIGN 6.3 CSV v2 Factor section): every factor key any Scope 3
// method actually uses resolves, by key prefix (SCOPE3_FACTOR_KEY_SOURCES + SCOPE3_COMPLETION_FACTOR_KEY_SOURCES), to a
// named factor source that the method's own catalog entry lists, so the Factor section and the record trace always name
// the source document. Keys come from the real engine: the v1 golden (every base method, 6,300+ results) and every valid
// shared payload fixture of every kind planned by the adapter and calculated now. Constants either name a factor source
// (R2 price indices) or are definitions listed with their basis in a pinned register (R1 unit constants, R3 supplement_const.).
// I-07 (the wave-3 follow-ups): the AR5 GWP keys (`gwp_ar5.`, Hub Table 11) are a listed source of every method that reads them
// (no exemption any more), and every constant names its source in the CSV and the trace (`scope3ConstantSourceOf`).
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CollectionContext } from './collection-contract'
import { planScope3Calculation, validateScope3Payload, type Scope3CalculationPlan, type Scope3CollectionActivity, type Scope3CollectionKind, type Scope3CollectionVersion } from './scope3-collection'
import type { Scope3EngineResult } from './scope3-coverage'
import { SCOPE3_COMPLETION_FACTOR_SOURCES, SCOPE3_FACTOR_SOURCES, SCOPE3_METHODS, scope3FactorSourceOf } from './scope3-method-catalog'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'
import { scope3ConstantSourceOf, scope3FactorSourceOfKey } from './scope3-trace'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const GOLDEN = fileURLToPath(new URL('../../../apps/site-api/src/calculation/testdata/scope3-v1-golden.json', import.meta.url))
const REGISTERS = ['verified-scope3-register-2025.json', 'verified-scope3-spend-register-epa-scghg-v1.3.json', 'verified-scope3-supplement-register-2025.json', 'verified-scope3-us-upstream-register-2025.json']
  .map(file => JSON.parse(readFileSync(new URL(`./method-reference/${file}`, import.meta.url), 'utf8')) as { constants: Array<{ id: string; basis?: string }> })
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
const TIMEOUT = 120_000

const company = '93600000-0000-4000-8000-000000000001', setup = '93600000-0000-4000-8000-000000000002', office = '93600000-0000-4000-8000-000000000003'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [{ id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
const year = { start: '2025-01-01', endExclusive: '2026-01-01' }
let n = 0
function version(kind: Scope3CollectionKind, quantity: Scope3CollectionActivity['quantity'], payload: unknown): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `F-${n}`, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null,
    reference: 'Synthetic source', notes: '', evidenceIds: [], period: year, kind, quantity, payload: validateScope3Payload(kind, payload) } as unknown as Scope3CollectionActivity
  return { id: `93600000-0000-4000-8000-${String(10000 + n).padStart(12, '0')}`, recordId: `93600000-0000-4000-8000-${String(50000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: 'a'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}

/** Every result the engine gives today for the valid shared fixtures (all kinds), under each consolidation approach. */
function fixtureResults(): Scope3EngineResult[] {
  const plans: Scope3CalculationPlan[] = []
  for (const approach of ['operational_control', 'financial_control', 'equity_share'] as const)
    for (const f of SCOPE3_PAYLOAD_FIXTURES.filter(x => x.valid)) plans.push(planScope3Calculation(version(f.kind, f.quantity, f.payload), context, [], { consolidationApproach: approach, reportingPeriod: year }))
  // I-12u: the category 3 upstream lines (3A from Scope 1 fuel records, 3B and 3C upstream from electricity, 3D upstream).
  const el = { period: year, quantity: '12000', unit: 'kWh', subregion: 'CAMX', zip: '94105' }
  const upstream = [{ kind: 'fuel_upstream', input: { period: year, source: 'natural_gas', quantity: '1234', unit: 'therm' } },
    { kind: 'fuel_upstream', input: { period: year, source: 'vehicle', fuel: 'gasoline', gallons: '100' } },
    { kind: 'fuel_upstream', input: { period: year, source: 'distillate_no2', consumption: { basis: 'measured', gallons: '40' } } },
    { kind: 'electricity_upstream', input: el }, { kind: 'td_losses_upstream', input: el },
    { kind: 'energy_resold_upstream', input: { period: year, quantity: '10', unit: 'MWh', gridBasis: 'us_average', zip: null, subregion: null, utilityEiaId: null } }]
  const requests = [...plans.filter(p => p.action === 'calculate' && p.call).map(p => p.call!.request), ...upstream]
  const out = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify({ action: 'calculate_many', requests })), env })
  const body = JSON.parse(out.stdout.toString()) as { status: string; results: Array<{ status: string; result?: Scope3EngineResult }> }
  expect(body.status).toBe('ok')
  return body.results.flatMap(item => item.status === 'ok' ? [item.result!] : [])
}
function goldenResults(): Array<Pick<Scope3EngineResult, 'methodVersionId' | 'factorsUsed' | 'constantsUsed'>> {
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as { cases: Array<{ result?: Scope3EngineResult }> }
  return golden.cases.flatMap(c => c.result && typeof c.result === 'object' && 'methodVersionId' in c.result ? [c.result] : [])
}

describe('integration wave 3: factor keys name their factor source (CSV Factor section, record trace)', () => {
  test('every factor key used by any method resolves to a named source the method lists; every constant names a source or is a register definition', () => {
    const named = new Map<string, string>([...SCOPE3_FACTOR_SOURCES, ...SCOPE3_COMPLETION_FACTOR_SOURCES].map(s => [s.id, s.text]))
    const definitions = new Map(REGISTERS.flatMap(r => r.constants.map(c => [c.id, c.basis ?? ''] as const)))
    const results = [...goldenResults(), ...fixtureResults()]
    const methodsSeen = new Set<string>(), keysSeen = new Set<string>(), problems: string[] = []
    for (const r of results) {
      const method = SCOPE3_METHODS[r.methodVersionId]
      if (!method) { problems.push(`unknown method ${r.methodVersionId}`); continue }
      methodsSeen.add(r.methodVersionId)
      for (const f of r.factorsUsed as Array<{ key: string }>) {
        keysSeen.add(f.key)
        const source = scope3FactorSourceOf(f.key), trace = scope3FactorSourceOfKey(f.key)
        if (!source || !named.has(source)) problems.push(`${r.methodVersionId}: factor ${f.key} names no listed source (${source})`)
        else if (!method.factorSourceIds.includes(source)) problems.push(`${r.methodVersionId}: factor ${f.key} -> ${source}, not one of ${method.factorSourceIds.join(', ')}`)
        else if (trace?.text !== named.get(source)) problems.push(`${f.key}: the trace text is not the source's`)
      }
      for (const c of r.constantsUsed as Array<{ id: string }>) {
        const source = scope3FactorSourceOf(c.id)
        if (source ? !named.has(source) || !method.factorSourceIds.includes(source) : !definitions.get(c.id)) problems.push(`${r.methodVersionId}: constant ${c.id} names no listed source and is not a register definition`)
        // I-07: the CSV and the trace name every constant's source: its factor source, or the unit definition with its register basis.
        const named7 = scope3ConstantSourceOf(c.id)
        if (!named7 || (source ? named7.text !== named.get(source) : named7.id !== 'unit_definition' || !named7.text.endsWith(definitions.get(c.id)!))) problems.push(`${c.id}: the CSV names no source for it`)
      }
    }
    expect(problems).toEqual([])
    // Every method that can calculate today is exercised: the five base methods (golden), purchases (I-03), the I-05 and the I-07 methods.
    expect([...methodsSeen].sort()).toEqual(Object.keys(SCOPE3_METHODS).sort())
    // The new register families are among the keys actually used (R2 spend factors, R3 Hub Table 1 and eGRID U.S. rates).
    for (const prefix of ['epa_scghg_v130.', 'hub2025_t1.', 'egrid2023_us.']) expect([prefix, [...keysSeen].some(key => key.startsWith(prefix))]).toEqual([prefix, true])
  }, TIMEOUT)
})
