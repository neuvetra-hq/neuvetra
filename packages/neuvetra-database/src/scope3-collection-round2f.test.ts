// Scope 3 round 2, lane F (Claude, 31 October 2026): the coal upstream methane-only term (DESIGN 13.6, owner decision) as the
// collection side sees it — the partial, non-excludable note and its text, the coal factor's sources and constants, the coal
// data-quality default, the category 3 methodology sentence — and the sold-fuel unknown-fuel hold's own code, so the shipped
// Scope 1 vehicle text of `fuel_not_an_engine_token` is no longer overridden.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateCollectionActivity, type CollectionContext } from './collection-contract'
import { planScope3Calculation, SCOPE3_EXCLUDABLE_NOTES, type Scope3CollectionVersion } from './scope3-collection'
import { SCOPE3_PARTIAL_BOUNDARY_NOTES, scope3PartialResultDocumented, type Scope3EngineResult } from './scope3-coverage'
import { SCOPE3_COMPLETION_FACTOR_SOURCES, SCOPE3_CONSTANT_DEFINITIONS, SCOPE3_METHODS, scope3DefaultDataQualityOf, scope3FactorSourceOf } from './scope3-method-catalog'
import { scope3MethodologyStatement } from './scope3-methodology'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_EXCLUDABLE_NOTE_TEXT, SCOPE3_GWP_SET_TEXT, SCOPE3_METHODOLOGY_TEXT_R2A, SCOPE3_REASON_TEXT_I07 } from './scope3-text'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
const TIMEOUT = 120_000
const Y2025 = { start: '2025-01-01', endExclusive: '2026-01-01' }
const COAL = 'coal_upstream_mine_methane_only'
const UPSTREAM_ELECTRICITY = ['scope3.cat3b.upstream_electricity.egrid2023_netl2024.v1', 'scope3.cat3c.td_losses_upstream.egrid2023_netl2024.v1', 'scope3.cat3d.energy_resold_upstream.egrid2023_netl2024.v1']
function calculate(requests: unknown[]): Scope3EngineResult[] {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify({ action: 'calculate_many', requests })), env })
  const body = JSON.parse(p.stdout.toString()) as { status: string; results: Array<{ status: string; result?: Scope3EngineResult }> }
  expect(body.status).toBe('ok')
  return body.results.map(item => item.result!)
}

describe('round 2, lane F: coal upstream, coal mine methane only (DESIGN 13.6)', () => {
  test('the coal note makes a line partial, can never be documented away, and has a plain-language text', () => {
    expect(SCOPE3_PARTIAL_BOUNDARY_NOTES).toContain(COAL)
    expect(SCOPE3_EXCLUDABLE_NOTES as readonly string[]).not.toContain(COAL)
    expect(SCOPE3_EXCLUDABLE_NOTE_TEXT[COAL]).toBeUndefined()
    const documented = { withinCategoryExclusions: [{ noteCode: COAL }, { noteCode: 'nuclear_biomass_byproduct_fuels_upstream_excluded' }] } as never
    expect(scope3PartialResultDocumented([COAL, 'nuclear_biomass_byproduct_fuels_upstream_excluded'], documented)).toBe(false)
    const text = SCOPE3_DISCLOSURE_TEXT[COAL]!
    for (const words of ['mine methane', 'mining', 'transport', 'AR5', 'partial', '3.650822140444']) expect([words, text.includes(words)]).toEqual([words, true])
    expect(text).not.toMatch(/[a-z]+_[a-z_]+/)  // no internal codes on screen
    // Coal is mapped now, so the not-mapped text names other fossil fuels only; the AS-PUBLISHED words name the coal basis.
    expect(SCOPE3_DISCLOSURE_TEXT.fossil_fuel_upstream_not_mapped).not.toMatch(/^Coal/)
    expect(SCOPE3_GWP_SET_TEXT['AS-PUBLISHED']).toContain('EPA GHGI coal mine methane on IPCC AR5')
  })

  test('the coal inputs and constants name their sources; the unit constants are register definitions word for word', () => {
    const r5 = JSON.parse(readFileSync(new URL('./method-reference/verified-scope3-us-upstream-register-2025.json', import.meta.url), 'utf8')) as { entries: Array<{ id: string }>; constants: Array<{ id: string; basis: string }> }
    const sources = new Map<string, string>(SCOPE3_COMPLETION_FACTOR_SOURCES.map(s => [s.id, s.text]))
    for (const key of ['epa_ghgi.2022.coal_mining_ch4_total', 'eia.2022.coal_production_short_tons', 'eia.2022.coal_heat_content_production', 'us_upstream_const.coal_mine_methane_kg_per_mmbtu_hhv']) {
      const source = scope3FactorSourceOf(key)
      expect([key, source !== null && sources.has(source!)]).toEqual([key, true])
      for (const id of UPSTREAM_ELECTRICITY) expect([id, key, SCOPE3_METHODS[id]!.factorSourceIds.includes(source!)]).toEqual([id, key, true])
    }
    expect(sources.get(scope3FactorSourceOf('epa_ghgi.2022.coal_mining_ch4_total')!)).toContain('Table 3-1')
    expect(sources.get(scope3FactorSourceOf('eia.2022.coal_production_short_tons')!)).toContain('Table 6.1')
    for (const id of ['us_upstream_const.kg_per_million_metric_tons', 'us_upstream_const.short_tons_per_thousand_short_tons'])
      expect([id, SCOPE3_CONSTANT_DEFINITIONS[id]]).toEqual([id, r5.constants.find(c => c.id === id)!.basis])
    expect(r5.entries.every(e => scope3FactorSourceOf(e.id) !== null)).toBe(true)
  })

  test('a line with coal heat input takes the coal data-quality default (completeness poor); others keep the method default', () => {
    for (const id of UPSTREAM_ELECTRICITY) {
      const method = SCOPE3_METHODS[id]!
      // Round 3 (AC-9): geography good for the national coal term.
      expect([id, scope3DefaultDataQualityOf(method, [COAL, 'plant_primary_fuel_allocation'])]).toEqual([id, { technological: 'fair', temporal: 'good', geographical: 'good', completeness: 'poor', reliability: 'good' }])
      expect([id, scope3DefaultDataQualityOf(method, ['plant_primary_fuel_allocation'])]).toEqual([id, { technological: 'fair', temporal: 'good', geographical: 'very_good', completeness: 'fair', reliability: 'good' }])
    }
  })

  test('the real engine: a CAMX line maps coal, stays partial, every note has a text; the methodology states the methane-only coal term', () => {
    const [r] = calculate([{ kind: 'electricity_upstream', input: { period: Y2025, quantity: '1234.5', unit: 'MWh', subregion: 'CAMX', zip: '94105' } }])
    expect([r!.status, r!.boundary.minimumBoundary]).toEqual(['complete', 'partial'])
    for (const note of r!.boundary.notes) expect([note, typeof SCOPE3_DISCLOSURE_TEXT[note]]).toEqual([note, 'string'])
    const a = r!.activity as Record<string, unknown>
    expect([a.mappedFuels, a.unmappedFuels, typeof a.coalHeatInputMmbtu, typeof a.coalHeatInputShare]).toEqual([['COAL', 'GAS', 'OIL'], ['OFSL'], 'string', 'string'])
    // Round 2b integration: lane B's methodology reads the row's counts (withdrawn records are counted, not listed).
    const counts = { records: 1, calculated: 0, partialBoundary: 1, inputNeeded: 0, outsidePeriod: 0, excluded: 0, withdrawn: 0, unavailable: 0, methodPending: 0, optionalPending: 0 }
    const row = { category: 3, screening: { decision: 'included', reason: null, description: null }, assessment: null, methods: [r!.methodVersionId], disclosures: [], profile: null, reviewFlags: [], counts } as never
    const line = { category: 3, plan: { status: 'calculate', notes: [] }, outcome: 'calculated', result: r!, payload: null, derivedFrom: 'x' } as never
    const said = scope3MethodologyStatement(row, [line]).map(s => s.text)
    expect(said).toContain(SCOPE3_METHODOLOGY_TEXT_R2A.coalMethaneOnly)
    expect(said).not.toContain(SCOPE3_METHODOLOGY_TEXT_R2A.coalNotQuantified)
    for (const words of ['EPA GHGI 2022', 'mine methane only', 'AR5', 'mining energy', 'transport']) expect([words, SCOPE3_METHODOLOGY_TEXT_R2A.coalMethaneOnly.includes(words)]).toEqual([words, true])
  }, TIMEOUT)
})

describe('round 2, lane F: the sold-fuel unknown-fuel hold has its own code', () => {
  const company = '93800000-0000-4000-8000-000000000001', setup = '93800000-0000-4000-8000-000000000002', office = '93800000-0000-4000-8000-000000000003'
  const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [{ id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
  const soldFuel = (fuel: string): Scope3CollectionVersion => {
    const f = SCOPE3_PAYLOAD_FIXTURES.find(x => x.kind === 'sold_fuel' && x.label === 'sold_fuel: in MMBtu')!
    const activity = validateCollectionActivity({ kind: 'sold_fuel', locationId: office, setupVersionId: setup, sourceId: 'SF-1', state: 'active', withdrawalReason: null, quantity: f.quantity,
      quality: 'actual', estimateBasis: null, period: Y2025, reference: 'Synthetic', notes: '', evidenceIds: [], payload: { ...(f.payload as object), fuel } })
    return { id: '93800000-0000-4000-8000-000000010001', recordId: '93800000-0000-4000-8000-000000050001', companyId: company, revision: 1, previousVersionId: null, correctionReason: null,
      payloadSha256: 'e'.repeat(64), createdBy: company, createdAt: '2026-06-01T00:00:00.000Z', activity } as unknown as Scope3CollectionVersion
  }

  test('a fuel outside Hub Table 1 is held as sold_fuel_not_an_engine_token, with the sold-fuel words; the Scope 1 code keeps its shipped text', () => {
    const held = planScope3Calculation(soldFuel('hydrogen'), context, [], { reportingPeriod: Y2025 })
    expect([held.action, held.status, held.reasons]).toEqual(['hold', 'input_needed', ['sold_fuel_not_an_engine_token']])
    expect(SCOPE3_REASON_TEXT_I07.sold_fuel_not_an_engine_token).toBe('This fuel isn’t one of the EPA Hub Table 1 fuels. Choose a listed fuel; the record isn’t counted until then.')
    expect('fuel_not_an_engine_token' in SCOPE3_REASON_TEXT_I07).toBe(false)  // so the web's reason map keeps the Scope 1 vehicle text
    expect(planScope3Calculation(soldFuel('natural_gas'), context, [], { reportingPeriod: Y2025 }).action).toBe('calculate')
  })
})
