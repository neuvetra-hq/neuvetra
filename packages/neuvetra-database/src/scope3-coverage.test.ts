// Scope 3 coverage (package 1): the 15-category model, end to end through the collection adapter and the real Scope 3
// engine and its aggregate. Cases S3-02, S3-04 to S3-07, S3-12 to S3-14 of the 19 October brief. Claude, 24 October 2026.
// Revision 3 (25 October): coverage is built only from verified engine output (scope3-engine-output.ts); records carry
// their result hash, not the result. Revision 4: the boundary asks the actual engine to aggregate; no aggregate is taken
// from the caller, so the integrity tests below use a lying engine to show the boundary's own checks still hold.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CollectionContext, CollectionQuality } from './collection-contract'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from './method-reference'
import { planScope3Calculation, validateScope3Payload, type Scope3CollectionActivity, type Scope3CollectionKind, type Scope3CollectionVersion } from './scope3-collection'
import { createSyntheticCompanySetup } from './company-setup-fixture'
import {
  scope3ScreeningFromSetup, SCOPE3_DISCLOSURE_TEXT, SCOPE3_ENGINE_CATEGORIES, SCOPE3_ENGINE_PROFILE, SCOPE3_FACTOR_SOURCES, SCOPE3_METHODS, SCOPE3_SETUP_CATEGORY_TOKENS, validateScope3Screening, type Scope3CoverageRecord, type Scope3EngineCategory,
  type Scope3EngineAggregate, type Scope3EngineResult, type Scope3Screening,
} from './scope3-coverage'
import { scope3Canonical as canonical, scope3Coverage as coverageOf, scope3Digest, type Scope3AggregateEngine, type Scope3Pins } from './scope3-engine-output'
import { SCOPE3_DISCLOSURE_TEXT_I03, SCOPE3_DISCLOSURE_TEXT_I04, SCOPE3_DISCLOSURE_TEXT_I05, SCOPE3_DISCLOSURE_TEXT_I07, SCOPE3_DISCLOSURE_TEXT_I12H, SCOPE3_DISCLOSURE_TEXT_R2A, SCOPE3_DISCLOSURE_TEXT_R3A, SCOPE3_DISCLOSURE_TEXT_I12U, scope3CategoryMethodNote } from './scope3-text'
import { SCOPE3_CATEGORIES, SCOPE3_NULL_ANNOTATION, SCOPE3_PARTIAL_BOUNDARY_NOTES, scope3CategorySupport, scope3PartialResultDocumented, scope3SelectiveDownstreamExclusion, type Scope3CategoryRow } from './scope3-coverage'
import { validateScope3AssessmentRecord, type Scope3AssessmentRecord } from './scope3-assessment-contract'
import { FIXTURE_CRITERIA, fixtureAssessmentRecord } from './scope3-payload-fixtures'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const REGISTER = fileURLToPath(new URL('./method-reference/verified-scope3-register-2025.json', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; result?: any; aggregate?: any }
}
const ENGINE_TEST_TIMEOUT_MS = 120_000
const pins: Scope3Pins = { engineSha256: createHash('sha256').update(readFileSync(ENGINE)).digest('hex'), registerSha256: SCOPE3_REGISTER_2025_SHA256, additionalRegisterSha256s: { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } }
/** The actual engine's aggregate action, as site-api's bridge provides it: it throws when the engine refuses. */
const realEngine: Scope3AggregateEngine = { aggregate: async results => { const out = engine({ action: 'aggregate', results }); if (out.status !== 'ok') throw new Error(`refused: ${out.code}`); return out.aggregate } }
/** An engine stand-in that returns a fixed aggregate: shows what the boundary's own checks catch. */
const lying = (aggregate: unknown): Scope3AggregateEngine => ({ aggregate: async () => structuredClone(aggregate) as Scope3EngineAggregate })
/** No calculated records: nothing to verify. */
const scope3Coverage = (records: Scope3CoverageRecord[], screening: Scope3Screening[]) => coverageOf(records, screening, [], realEngine, pins)

const company = '94000000-0000-4000-8000-000000000001', setup = '94000000-0000-4000-8000-000000000002', office = '94000000-0000-4000-8000-000000000003'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' },
  locations: [{ id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
let n = 0
function version(kind: Scope3CollectionKind, value: string, unit: string, payload: unknown, quality: CollectionQuality = 'actual'): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `C-${n}`, state: 'active', withdrawalReason: null, quality, estimateBasis: quality === 'estimated' ? 'Survey of 40 staff, scaled to 120.' : null,
    reference: 'Synthetic', notes: '', evidenceIds: [], period: { start: '2025-01-01', endExclusive: '2026-01-01' }, kind,
    quantity: { originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit }, payload: validateScope3Payload(kind, payload) } as unknown as Scope3CollectionActivity
  return { id: `94000000-0000-4000-8000-${String(1000 + n).padStart(12, '0')}`, recordId: `94000000-0000-4000-8000-${String(5000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: 'c'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}
/** Plans the record with the package 1 adapter and, when it calculates, runs the real engine: what Results will do. */
type Row = Scope3CoverageRecord & { full?: Scope3EngineResult }
function outcome(v: Scope3CollectionVersion): Row {
  const plan = planScope3Calculation(v, context, [])
  const base = { recordId: v.recordId, category: plan.category as Scope3EngineCategory, quality: v.activity.quality }
  if (plan.action === 'hold') return { ...base, result: { outcome: 'held', status: plan.status!, reasons: plan.reasons } }
  const out = engine({ action: 'calculate', request: plan.call!.request })
  expect(out.status).toBe('ok')
  return { ...base, result: { outcome: 'calculated', resultSha256: out.result.resultSha256 }, full: out.result }
}
function gridLoss(kwh: string): Row {
  const request = { kind: 'td_losses', input: { period: { start: '2025-01-01', endExclusive: '2025-02-01' }, quantity: kwh, unit: 'kWh', subregion: 'CAMX', zip: '94105' } }
  const out = engine({ action: 'calculate', request })
  return { recordId: crypto.randomUUID(), category: 3, quality: 'actual', result: { outcome: 'calculated', resultSha256: out.result.resultSha256 }, full: out.result }
}
const parts = (records: Row[]) => ({ rows: records.map(({ full: _full, ...r }) => r as Scope3CoverageRecord), results: records.flatMap(r => r.full ? [r.full] : []) })
const aggregateOf = (results: Scope3EngineResult[]) => results.length ? engine({ action: 'aggregate', results }).aggregate as Scope3EngineAggregate : null
async function coverage(records: Row[], screening: Scope3Screening[] = []) {
  const { rows, results } = parts(records), aggregate = aggregateOf(results)
  return { cov: await coverageOf(rows, screening, results, realEngine, pins), aggregate, rows, results }
}
const waste = (q = '850') => version('waste', q, 'kg', { category: 5, material: 'mixed_msw', treatment: 'landfilled' })
const flight = () => version('business_travel', '2400', 'mile', { mode: 'air', passengerSegments: 4, haulBasis: null })
const bus = (quality: CollectionQuality = 'actual') => version('employee_commuting', '9800', 'passenger-mile', { mode: 'bus' }, quality)
// I-03: categories 1 and 2 are calculated (spend-based and supplier-specific). I-04: support comes from the method
// catalog, so they are `engine`; the categories below have no method in the catalog yet. I-05: categories 8, 10, 13 and
// 14 have methods now (asset energy and partner figures).
const unsupported: number[] = []  // I-07: every category has a method (11 and 15 were the last)

// Exact decimal arithmetic for the S3-14 check (no floating point).
const scaled = (v: string, places: number) => { const [i, f = ''] = v.split('.'); return BigInt(i! + f.padEnd(places, '0').slice(0, places)) }
const halfEven4 = (v: string) => {
  const [i, f = ''] = v.split('.'); const keep = BigInt(i! + f.padEnd(4, '0').slice(0, 4)); const rest = f.slice(4)
  const up = rest.length > 0 && (rest[0]! > '5' || (rest[0] === '5' && (/[1-9]/.test(rest.slice(1)) || keep % 2n === 1n)))
  const r = (keep + (up ? 1n : 0n)).toString().padStart(5, '0'); return `${r.slice(0, -4)}.${r.slice(-4)}`
}

describe('Scope 3 coverage: all 15 categories, unknown never 0', () => {
  test('S3-06/S3-07 empty: every category listed, nothing is 0, the completeness line names each gap', async () => {
    const { cov } = await coverage([])
    expect(cov.categories.map(r => r.category)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(cov.categories.every(r => r.subtotal === null && r.subtotalBasis === null)).toBe(true)
    expect(cov.knownSourceSubtotal).toBeNull()
    // I-04 (audit D12, DESIGN A7): an unscreened category is "Not screened", whatever its method support; `not_yet_supported` is retired.
    expect(cov.categories.filter(r => r.status === 'not_screened').map(r => r.category)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(cov.categories.filter(r => r.support === 'none').map(r => r.category)).toEqual(unsupported)
    expect(cov.categories.filter(r => r.support === 'engine').map(r => r.category)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) // I-03 + I-04; I-05 adds 8, 10, 13, 14; I-07 11 and 15; I-12u 3 (engine_partial retired)
    expect(cov.proposedMandatory).toMatchObject({ categories: [1, 3, 5, 6, 7], proposal: true, adopted: false, complete: false,
      line: 'Incomplete: category 1 not screened; category 3 not screened; category 5 not screened; category 6 not screened; category 7 not screened.' })
    expect(cov.categories[0]!.title).toBe('Purchased goods and services')
    expect(cov.addedToScope1And2).toBe(false)
    expect(JSON.stringify(cov)).not.toMatch(/"(unrounded|display)":"0(\.0+)?"/)
  })

  test('S3-07 partial: 3C partial, category 6 held for input, category 1 not screened', async () => {
    const records = [gridLoss('12000'), outcome(waste()), outcome(version('business_travel', '1500', 'mile', { mode: 'air', passengerSegments: null, haulBasis: null })), outcome(bus())]
    const { cov } = await coverage(records)
    const row = (c: number) => cov.categories[c - 1]!
    // I-12u (DESIGN 13.3): engine_partial and `category_3a_3b_not_supported` are retired; a 3C line without its upstream line stays partial by its own note.
    expect(row(3)).toMatchObject({ status: 'partial_boundary', support: 'engine', counts: { records: 1, partialBoundary: 1 }, subtotalBasis: 'all_counted_records' })
    // Round 2 (owner decision 9): the partial 3C line keeps category 3's data-quality label at fair at most; the cap is disclosed.
    expect(row(3).disclosures).toEqual(['combustion_only_upstream_of_lost_energy_excluded', 'data_quality_label_capped', 'factor_data_years', 'location_based_rates'])
    expect(row(6)).toMatchObject({ status: 'input_needed', subtotal: null, reasons: ['passenger_segments_required'], counts: { records: 1, inputNeeded: 1 } })
    expect(row(5).status).toBe('calculated'); expect(row(7).status).toBe('calculated')
    expect(cov.proposedMandatory.line).toBe('Incomplete: category 1 not screened; category 3 partial; category 6 needs input.')
  }, ENGINE_TEST_TIMEOUT_MS)

  test('S3-07 full: complete only when every proposed category is calculated or screened not relevant', async () => {
    const screening = [{ category: 1, decision: 'not_relevant' as const, reason: 'Synthetic fixture: no purchased goods or services.' },
      { category: 3, decision: 'not_relevant' as const, reason: 'Synthetic fixture: no purchased fuels or electricity.' }]
    const { cov } = await coverage([outcome(waste()), outcome(flight()), outcome(bus())], screening)
    expect(cov.proposedMandatory).toMatchObject({ complete: true, gaps: [], line: 'Complete for the five proposed categories.' })
    expect(cov.categories[2]).toMatchObject({ status: 'not_relevant', screening: { decision: 'not_relevant', reason: 'Synthetic fixture: no purchased fuels or electricity.' }, disclosures: [] })
    // An excluded mandatory category is a gap, not completeness.
    const excluded = (await coverage([outcome(waste()), outcome(flight()), outcome(bus())], [{ ...screening[0]!, decision: 'excluded' }, screening[1]!])).cov
    expect(excluded.proposedMandatory.line).toBe('Incomplete: category 1 excluded by the company.')
  }, ENGINE_TEST_TIMEOUT_MS)

  test('S3-05/S3-13/S3-14: waste is AR4 with no gas split, the aggregate reports mixed GWP sets, totals are the engine\'s rounded once', async () => {
    const records = [gridLoss('12000'), gridLoss('333.333'), outcome(waste('850.5')), outcome(flight()), outcome(bus()), outcome(version('transport', '1200.5', 'vehicle-mile', { category: 9, vehicle: 'light_duty_truck', loadBasis: 'dedicated_vehicle', thirdPartyFacilities: 'unknown' })),
      outcome(version('waste', '2.5', 'metric_ton', { category: 12, material: 'corrugated_containers', treatment: 'recycled' }))]
    const { cov, aggregate } = await coverage(records)
    const wasteResult = records[2]!.full
    expect(wasteResult).toMatchObject({ gwpSetId: 'AR4-100', gases: {} }); expect(wasteResult!.co2eWithoutGasSplit!.gwpSetId).toBe('AR4-100')
    expect(aggregate!.mixedGwpSets).toBe(true)
    expect(cov.disclosures.find(d => d.code === 'mixed_gwp_sets')!.categories).toEqual([3, 5, 6, 7, 9, 12])
    expect(cov.disclosures.find(d => d.code === 'ar4_gwp_embedded_in_factor')!.categories).toEqual([5, 12])
    expect(cov.disclosures.find(d => d.code === 'radiative_forcing_not_included')!).toMatchObject({ categories: [6], text: expect.stringContaining('radiative forcing') })
    expect(cov.disclosures.find(d => d.code === 'third_party_facilities_not_assessed')!.categories).toEqual([9])
    expect(cov.categories[8]!.status).toBe('partial_boundary')
    // S3-14: every figure is the engine's; the category subtotals sum, unrounded, to the known-source subtotal, rounded once half-even.
    expect(cov.knownSourceSubtotal).toEqual(aggregate!.knownSourceSubtotal)
    const subtotals = cov.categories.flatMap(r => r.subtotal ? [r.subtotal] : [])
    expect(subtotals.length).toBe(6)
    const places = Math.max(...[...subtotals, cov.knownSourceSubtotal!].map(t => (t.unrounded.split('.')[1] ?? '').length))
    expect(subtotals.reduce((sum, t) => sum + scaled(t.unrounded, places), 0n)).toBe(scaled(cov.knownSourceSubtotal!.unrounded, places))
    for (const t of [...subtotals, cov.knownSourceSubtotal!]) expect(t.display).toBe(halfEven4(t.unrounded))
    expect(cov.aggregateSha256).toBe(aggregate!.aggregateSha256)
  }, ENGINE_TEST_TIMEOUT_MS)

  test('S3-12: engine findings (a treatment EPA marks NA) and adapter holds appear as the record\'s reason; known sources only', async () => {
    const records = [outcome(waste()), outcome(version('waste', '10', 'kg', { category: 5, material: 'clay_bricks', treatment: 'recycled' })), outcome(version('waste', '10', 'pallet', { category: 5, material: 'glass', treatment: 'recycled' }))]
    const row = (await coverage(records)).cov.categories[4]!
    expect(row).toMatchObject({ status: 'input_needed', counts: { records: 3, calculated: 1, inputNeeded: 2 }, subtotalBasis: 'known_sources_only' })
    expect(row.reasons).toEqual(['no_published_factor_for_material_and_treatment', 'unit_not_an_engine_token'])
    expect(row.subtotal).not.toBeNull()
  }, ENGINE_TEST_TIMEOUT_MS)

  test('withdrawn, excluded and outside-period records give no figure; counts are disjoint; data quality is shown', async () => {
    const held = (status: 'withdrawn' | 'excluded', category: Scope3EngineCategory): Scope3CoverageRecord => ({ recordId: crypto.randomUUID(), category, quality: 'actual', result: { outcome: 'held', status, reasons: [status === 'withdrawn' ? 'record_withdrawn' : 'location_excluded_by_company_setup'] } })
    const outside: Scope3CoverageRecord = { recordId: crypto.randomUUID(), category: 7, quality: 'actual', result: { outcome: 'outside_period', reasons: ['outside_reporting_period'] } }
    const { cov } = await coverage([held('withdrawn', 7), held('excluded', 7), outside, outcome(bus('estimated')), outcome(bus('unknown'))])
    const row = cov.categories[6]!
    expect(row.counts).toEqual({ records: 5, calculated: 2, partialBoundary: 0, inputNeeded: 0, outsidePeriod: 1, excluded: 1, withdrawn: 1, unavailable: 0, methodPending: 0, optionalPending: 0 })
    expect(row.quality).toEqual({ actual: 0, estimated: 1, unknown: 1 })
    expect(row.disclosures).toEqual(expect.arrayContaining(['estimated_activity_data', 'activity_data_quality_unknown', 'tank_to_wheel_only']))
    const onlyHeld = (await coverage([held('withdrawn', 6), outside])).cov
    expect(onlyHeld.categories[5]).toMatchObject({ status: 'no_records', subtotal: null })
    expect(onlyHeld.categories[6]).toMatchObject({ status: 'no_records', subtotal: null, counts: { outsidePeriod: 1 } })
    for (const r of [...cov.categories, ...onlyHeld.categories]) {
      const { records, ...rest } = r.counts
      expect(Object.values(rest).reduce((a, b) => a + b, 0)).toBe(records)
    }
    const unavailable = await scope3Coverage([{ recordId: crypto.randomUUID(), category: 5, quality: 'actual', result: { outcome: 'unavailable' } }], [])
    expect(unavailable.categories[4]).toMatchObject({ status: 'unavailable', subtotal: null })
    expect(unavailable.proposedMandatory.line).toContain('category 5 could not be calculated right now')
  }, ENGINE_TEST_TIMEOUT_MS)

  test('screening: reasons are required for exclusions, and a screened-out category with records needs review', async () => {
    expect(() => validateScope3Screening([{ category: 2, decision: 'excluded', reason: ' ' }])).toThrow('reason')
    expect(() => validateScope3Screening([{ category: 2, decision: 'included', reason: 'x' }])).toThrow('reason')
    expect(() => validateScope3Screening([{ category: 2, decision: 'included', reason: null }, { category: 2, decision: 'included', reason: null }])).toThrow('category')
    expect(() => validateScope3Screening([{ category: 16, decision: 'included', reason: null }])).toThrow('category')
    expect(() => validateScope3Screening([{ category: 2, decision: 'included', reason: null, note: '' }])).toThrow()
    const { cov } = await coverage([outcome(bus())], [{ category: 7, decision: 'excluded', reason: 'Fewer than 10 staff.' }, { category: 2, decision: 'excluded', reason: 'No capital purchases in 2025.' }, { category: 4, decision: 'included', reason: null }])
    // Round 2 (owner decision 5): a screening conflict; the record stays counted (its figure is in the category).
    expect(cov.categories[6]).toMatchObject({ status: 'screening_conflict', reasons: ['screening_conflict_records_exist'], counts: { calculated: 1 } })
    expect(cov.categories[6]!.subtotal).not.toBeNull()
    expect(cov.categories[1]).toMatchObject({ status: 'excluded', screening: { decision: 'excluded', reason: 'No capital purchases in 2025.' }, subtotal: null })
    expect(cov.categories[3]).toMatchObject({ status: 'no_records', subtotal: null })
    expect(cov.categories[7]).toMatchObject({ status: 'not_screened', screening: { decision: 'not_screened' } })
  }, ENGINE_TEST_TIMEOUT_MS)

  test('company setup screening rows are read as the coverage screening (0023 already stores Scope 3 rows)', async () => {
    expect(SCOPE3_SETUP_CATEGORY_TOKENS).toEqual(['purchased_goods_and_services', 'capital_goods', 'fuel_and_energy_related_activities', 'upstream_transportation_and_distribution',
      'waste_generated_in_operations', 'business_travel', 'employee_commuting', 'upstream_leased_assets', 'downstream_transportation_and_distribution', 'processing_of_sold_products',
      'use_of_sold_products', 'end_of_life_treatment_of_sold_products', 'downstream_leased_assets', 'franchises', 'investments'])
    // The synthetic setup fixture's own rows: Scope 1 and 2 rows are ignored; its Scope 3 tokens match.
    const fixture = createSyntheticCompanySetup().screening
    expect(scope3ScreeningFromSetup(fixture)).toEqual({ unmatched: [], descriptions: new Map(), screening: [
      { category: 6, decision: 'excluded', reason: 'No business travel in the reporting period' },
      { category: 14, decision: 'not_relevant', reason: 'Company operates no franchises' }] })
    const rows = [{ scope: 3, category: 'employee_commuting', state: 'yes' as const, reason: '' }, { scope: 3, category: 'capital_goods', state: 'unknown' as const, reason: '' },
      { scope: 3, category: 'hotel stays', state: 'yes' as const, reason: '' }]
    const read = scope3ScreeningFromSetup(rows)
    expect(read).toEqual({ screening: [{ category: 7, decision: 'included', reason: null }], unmatched: ['hotel stays'], descriptions: new Map() })
    const cov = await scope3Coverage([], read.screening)
    expect(cov.categories[6]).toMatchObject({ status: 'no_records', screening: { decision: 'included' } })
    expect(cov.categories[1]).toMatchObject({ status: 'not_screened', support: 'engine', screening: { decision: 'not_screened' } })
  })

  test('integrity: an aggregate that does not match the rows is refused, never shown', async () => {
    const a = outcome(waste()), b = outcome(bus())
    const { rows: [ra, rb], results: [xa, xb] } = parts([a, b])
    const aggregateOfA = aggregateOf([xa!])!
    await expect(coverageOf([ra!, rb!], [], [xa!, xb!], lying(aggregateOfA), pins)).rejects.toThrow('refused')
    await expect(coverageOf([ra!, rb!], [], [xa!], realEngine, pins)).rejects.toThrow('differ')
    await expect(coverageOf([{ ...ra!, category: 12 }], [], [xa!], realEngine, pins)).rejects.toThrow('differs')
    await expect(coverageOf([ra!], [], [xa!], lying({ ...aggregateOfA, categorySubtotals: {} }), pins)).rejects.toThrow('refused')
    // An engine that refuses (or fails) verifies nothing.
    await expect(coverageOf([ra!], [], [xa!], { aggregate: async () => { throw new Error('engine unavailable') } }, pins)).rejects.toThrow('did not verify')
    for (const nothing of [null, undefined, 'ok', []]) await expect(coverageOf([ra!], [], [xa!], lying(nothing), pins)).rejects.toThrow('no aggregate')
  }, ENGINE_TEST_TIMEOUT_MS)

  test('every engine boundary note and estimate code has disclosure text, and the factor editions match the register', async () => {
    const source = readFileSync(ENGINE, 'utf8')
    const engineCodes = ['combustion_only_upstream_of_lost_energy_excluded', 'location_based_rates', 'tank_to_wheel_only', 'third_party_facilities_not_included', 'third_party_facilities_not_assessed',
      'avoided_emissions_excluded', 'includes_transport_to_facility', 'ar4_gwp_embedded_in_factor', 'radiative_forcing_not_included', 'cabin_class_not_differentiated',
      'us_average_grid_loss', 'air_haul_declared', 'intercity_rail_route_average']
    for (const code of engineCodes) { expect(source).toContain(`'${code}'`); expect(SCOPE3_DISCLOSURE_TEXT[code]).toBeTruthy() }
    // No other note or estimate literal exists in the engine (boundary_notes=[...], notes = [...], notes += [...], estimates.append/[...]).
    const literals = new Set<string>()
    for (const line of source.split('\n').filter(l => /boundary_notes=|notes = \[|notes \+= \[|estimates(\.append\(|=\[)|facilities = \{/.test(l)))
      for (const m of line.matchAll(/'([a-z0-9_]+)'/g)) literals.add(m[1]!)
    // Keys, statuses and input tokens that share those lines are not notes.
    for (const ignored of ['none', 'present_not_included', 'unknown', 'u_s', 'partial', 'met', 'category', 'complete']) literals.delete(ignored)
    // I-03: the purchase methods' notes and estimates have their own texts (checked by running the engine in the next test);
    // 'co2e', 'reason' and 'unverified' are result keys and an input token on those lines.
    for (const ignored of ['co2e', 'reason', 'unverified', ...Object.keys(SCOPE3_DISCLOSURE_TEXT_I03)]) literals.delete(ignored)
    // I-05: likewise the energy, commuting, asset and partner methods' notes and estimates (checked against the engine in
    // scope3-collection-energy-partner.test.ts: every disclosure of 1,600 fuzzed records has text).
    for (const ignored of Object.keys(SCOPE3_DISCLOSURE_TEXT_I05)) literals.delete(ignored)
    // I-07: likewise the sold-product, end-of-life and investment methods' notes and estimates (checked against the engine in
    // scope3-collection-downstream.test.ts); 'supplement' (a register) and 'sold_ghg_product' (a kind) share those lines.
    for (const ignored of ['supplement', 'sold_ghg_product', ...Object.keys(SCOPE3_DISCLOSURE_TEXT_I07)]) literals.delete(ignored)
    // I-12u: likewise the category 3 upstream methods' notes and estimates (checked against the engine in scope3-collection-upstream.test.ts).
    for (const ignored of Object.keys(SCOPE3_DISCLOSURE_TEXT_I12U)) literals.delete(ignored)
    // I-12h: likewise the hotel and building methods' notes and estimates (checked against the engine in
    // scope3-collection-hotel-building.test.ts); 'reporting_location' (an input token) and 'hotel_stay' (a kind) share those lines.
    for (const ignored of ['reporting_location', 'hotel_stay', ...Object.keys(SCOPE3_DISCLOSURE_TEXT_I12H)]) literals.delete(ignored)
    // Round 2, lane A: likewise the round-2 notes (each a literal of the engine and emitted through the real engine in
    // scope3-collection-round2.test.ts).
    for (const ignored of Object.keys(SCOPE3_DISCLOSURE_TEXT_R2A)) literals.delete(ignored)
    // Round 3, lane A: likewise the round-3 notes (emitted through the real engine in scope3-round3a.test.ts and scope3_engine_round3_test.py).
    for (const ignored of Object.keys(SCOPE3_DISCLOSURE_TEXT_R3A)) literals.delete(ignored)
    expect(literals.size).toBe(engineCodes.length)
    expect([...literals].filter(code => !(code in SCOPE3_DISCLOSURE_TEXT))).toEqual([])
    const register = JSON.parse(readFileSync(REGISTER, 'utf8'))
    expect(register.source.edition).toBe('Last Modified: January 15, 2025')
    expect(register.method).toContain('eGRID2023 rev2')
    expect(SCOPE3_FACTOR_SOURCES[0].text).toContain('15 January 2025')
  })

  test('I-03: every note and estimate the purchase methods emit has disclosure text, and every I-03 text is emitted', () => {
    const P = { start: '2025-01-01', endExclusive: '2026-01-01' }
    const spend = (over: Record<string, unknown>) => ({ kind: 'purchase_spend', input: { period: P, category: 1, naicsCode: '541511', amount: '1000.00', currency: 'USD', dollarYear: 2022,
      marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null, ...over } })
    const supplier = (over: Record<string, unknown>) => ({ kind: 'purchase_supplier', input: { period: P, category: 1, factorOrigin: 'supplier_primary', basis: 'product_factor', quantity: '10',
      unit: 'kg', factorValue: '2', factorUnit: 'kg CO2e per kg', allocationNumerator: null, allocationDenominator: null, boundary: 'cradle_to_gate', hybridUpstreamCoveredBy: null,
      gwpBasis: 'AR5', verification: 'third_party_verified', ...over } })
    const requests = [spend({}), spend({ category: 2, capitalFullCost: true, dollarYear: 2024 }), spend({ category: 9, naicsCode: '484121', marginChoice: 'without_margins', boughtAtFactoryGate: true }),
      ...['AR4', 'AR5', 'AR6', 'unknown'].flatMap(gwpBasis => [supplier({ gwpBasis }), supplier({ gwpBasis, factorOrigin: 'secondary_database' })]),
      supplier({ verification: 'unverified', boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: 'none' }), supplier({ boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: 'other_records' })]
    const out = engine({ action: 'calculate_many', requests })
    const results = ((out as unknown as { results: Array<{ status: string; result: Scope3EngineResult }> }).results).map(item => item.result)
    expect(results.every(r => r.status === 'complete')).toBe(true)
    const codes = new Set(results.flatMap(r => [...r.boundary.notes, ...r.estimates]))
    expect([...codes].filter(code => !(code in SCOPE3_DISCLOSURE_TEXT))).toEqual([])
    expect(Object.keys(SCOPE3_DISCLOSURE_TEXT_I03).filter(code => !codes.has(code))).toEqual([])
    for (const code of Object.keys(SCOPE3_DISCLOSURE_TEXT_I03)) expect(SCOPE3_DISCLOSURE_TEXT[code]).toBe(SCOPE3_DISCLOSURE_TEXT_I03[code]!)
  }, ENGINE_TEST_TIMEOUT_MS)
})

// Revision 3 (25 October 2026): the repairs for Codex's four-package review, each with the reviewers' own counterexample.
describe('Revision 3 repairs', () => {
  const truck = (value = '17.125') => version('transport', value, 'vehicle-mile', { category: 4, vehicle: 'medium_and_heavy_duty_truck', loadBasis: 'dedicated_vehicle', thirdPartyFacilities: 'none' })
  const naWaste = () => version('waste', '10', 'kg', { category: 5, material: 'clay_bricks', treatment: 'recycled' })

  test('S3A-01: 17.125 metric tons of recycled asphalt concrete calculates, aggregates and shows the exact independent value', async () => {
    for (const category of [5, 12] as const) {
      const row = outcome(version('waste', '17.125', 'metric_ton', { category, material: 'asphalt_concrete', treatment: 'recycled' }))
      expect(row.full!.total!.unrounded).toBe('66.457491045171486235096879692')
      const { cov, aggregate } = await coverage([row])
      expect(aggregate!.knownSourceSubtotal.unrounded).toBe('66.457491045171486235096879692')
      expect(cov.categories[category - 1]).toMatchObject({ status: 'calculated', subtotal: { unrounded: '66.457491045171486235096879692', display: '66.4575' } })
    }
  }, ENGINE_TEST_TIMEOUT_MS)

  test('S3A-02: one saved record counted twice is refused; two records with identical results both count', async () => {
    const one = outcome(truck())
    const { rows: [r], results: [x] } = parts([one])
    expect(x!.total!.unrounded).toBe('22.40439775')
    await expect(coverageOf([r!, structuredClone(r!)], [], [x!, x!], realEngine, pins)).rejects.toThrow('appears more than once')
    // The same UUID in another spelling is refused rather than counted as a second record; record IDs must be canonical
    // lowercase UUIDs (the database's uuid text form), so spelling can never make one record look like two.
    const lower = { ...r!, recordId: 'abcdef00-0000-4000-8000-0000000000aa' }
    expect((await coverageOf([lower], [], [x!], realEngine, pins)).categories.reduce((n, c) => n + c.counts.records, 0)).toBe(1)
    for (const spelling of [lower.recordId.toUpperCase(), `{${lower.recordId}}`, lower.recordId.replaceAll('-', ''), ` ${lower.recordId}`])
      await expect(coverageOf([lower, { ...lower, recordId: spelling }], [], [x!, x!], realEngine, pins), spelling).rejects.toThrow('canonical')
    const twin = { ...r!, recordId: crypto.randomUUID() }
    const both = await coverageOf([r!, twin], [], [x!, x!], realEngine, pins)
    expect(both.categories[3]).toMatchObject({ counts: { records: 2, calculated: 2 }, subtotal: { unrounded: '44.8087955' } })
  }, ENGINE_TEST_TIMEOUT_MS)

  test('S3A-03: results the engine held are bound too; a missing or extra held result is refused', async () => {
    const one = outcome(truck()), held = outcome(naWaste())
    const { rows: [r, h], results: [x, y] } = parts([one, held])
    expect(y!.status).toBe('input_needed')
    await expect(coverageOf([r!, h!], [], [x!, y!], lying(aggregateOf([x!])), pins)).rejects.toThrow('refused')
    await expect(coverageOf([r!], [], [x!], lying(aggregateOf([x!, y!])), pins)).rejects.toThrow('refused')
    await expect(coverageOf([r!], [], [x!, y!], realEngine, pins)).rejects.toThrow('differ')
    expect((await coverageOf([r!, h!], [], [x!, y!], realEngine, pins)).categories[4]).toMatchObject({ status: 'input_needed', subtotal: null })
  }, ENGINE_TEST_TIMEOUT_MS)

  test('S3A-03: a changed subtotal, register, engine, GWP flag or result is refused, with or without a recomputed hash', async () => {
    const one = outcome(truck()), w = outcome(waste())
    const { rows, results } = parts([one, w])
    const genuine = aggregateOf(results)!
    expect(genuine.mixedGwpSets).toBe(true)
    const rehash = (a: any) => { const { aggregateSha256: _h, ...body } = a; return { ...body, aggregateSha256: createHash('sha256').update(canonical(body), 'utf8').digest('hex') } }
    const mutations: Array<[string, (a: any) => any]> = [
      ['subtotal', a => ({ ...a, knownSourceSubtotal: { ...a.knownSourceSubtotal, unrounded: '999999', display: '999999.0000' } })],
      ['category subtotal', a => ({ ...a, categorySubtotals: { ...a.categorySubtotals, '4': { ...a.categorySubtotals['4'], display: '1.0000' } } })],
      ['register', a => ({ ...a, registerSha256: '0'.repeat(64) })],
      ['engine', a => ({ ...a, engineSha256: '0'.repeat(64) })],
      ['mixed GWP flag', a => ({ ...a, mixedGwpSets: false })],
      ['GWP sets', a => ({ ...a, gwpSetsUsed: ['AR5-100'] })],
      ['count', a => ({ ...a, resultCount: 3 })],
      ['complete flag', a => ({ ...a, complete: true })],
    ]
    for (const [label, mutate] of mutations) {
      await expect(coverageOf(rows, [], results, lying(mutate(genuine)), pins), `${label}, same hash`).rejects.toThrow('refused')
      await expect(coverageOf(rows, [], results, lying(rehash(mutate(genuine))), pins), `${label}, recomputed hash`).rejects.toThrow('refused')
    }
    // A result whose figures, GWP set or register were changed is refused before any aggregate is considered.
    const changed = (patch: Record<string, unknown>) => { const r: any = { ...results[0]!, ...patch }; const { resultSha256: _h, ...body } = r; return { ...r, resultSha256: createHash('sha256').update(canonical(body), 'utf8').digest('hex') } }
    for (const bad of [changed({ total: { ...results[0]!.total!, unrounded: '1', display: '1.0000' } }), changed({ gwpSetId: 'AR4-100' }), changed({ registerSha256: '0'.repeat(64) }), { ...results[0]!, category: 9 }])
      await expect(coverageOf([{ ...rows[0]!, result: { outcome: 'calculated', resultSha256: (bad as Scope3EngineResult).resultSha256 } }], [], [bad as Scope3EngineResult], realEngine, pins)).rejects.toThrow('refused')
    // Wrong pins refuse genuine output.
    await expect(coverageOf(rows, [], results, realEngine, { ...pins, engineSha256: '1'.repeat(64) })).rejects.toThrow('pinned')
    expect((await coverageOf(rows, [], results, realEngine, pins)).disclosures.map(d => d.code)).toContain('mixed_gwp_sets')
  }, ENGINE_TEST_TIMEOUT_MS)

  test('S3P1-T01: screening reasons follow company setup (0023): up to 2,000 characters, at least 3 after trimming spaces', async () => {
    for (const state of ['no', 'not_applicable'] as const) for (const length of [3, 1000, 1001, 2000]) {
      const read = scope3ScreeningFromSetup([{ scope: 3, category: 'capital_goods', state, reason: 'r'.repeat(length) }])
      expect(read.screening[0]!.reason).toBe('r'.repeat(length))
    }
    expect(() => validateScope3Screening([{ category: 2, decision: 'excluded', reason: 'r'.repeat(2001) }])).toThrow('2,000')
    expect(() => validateScope3Screening([{ category: 2, decision: 'excluded', reason: ' ab ' }])).toThrow('reason')
    // Characters, not UTF-16 units, as PostgreSQL counts them: 2,000 emoji are 2,000 characters.
    expect(validateScope3Screening([{ category: 2, decision: 'not_relevant', reason: '🌲'.repeat(2000) }])[0]!.reason).toHaveLength(4000)
    expect(() => validateScope3Screening([{ category: 2, decision: 'not_relevant', reason: '🌲'.repeat(2001) }])).toThrow('2,000')
    // btrim trims spaces only, so a reason of three tabs meets 0023's lower bound.
    expect(validateScope3Screening([{ category: 2, decision: 'excluded', reason: '\t\t\t' }])[0]!.reason).toBe('\t\t\t')
  })

  test('the trusted boundary uses the engine\'s own hashing and method list', async () => {
    const rows = [outcome(truck('1200.5')), outcome(waste('850.5')), outcome(flight()), outcome(bus()), gridLoss('12345.678'), outcome(naWaste())]
    for (const r of rows) { const { resultSha256, ...body } = r.full!; expect(createHash('sha256').update(canonical(body), 'utf8').digest('hex')).toBe(resultSha256) }
    const described = engine({ action: 'describe' }) as any
    const methods = Object.fromEntries(described.description.methods.map((m: any) => [m.id, { profileId: m.profileId, gwpSetId: m.gwpSetId }]))
    expect(methods).toEqual(Object.fromEntries(Object.entries(SCOPE3_METHODS).map(([id, m]) => [id, { profileId: m.profileId, gwpSetId: m.gwpSetId }])))
    expect(described.description.profile).toBe(SCOPE3_ENGINE_PROFILE)
    expect(described.description.engineSha256).toBe(pins.engineSha256)
    expect(described.description.registerSha256).toBe(pins.registerSha256)
  }, ENGINE_TEST_TIMEOUT_MS)

  test('the coverage module stays browser-safe; only scope3-engine-output builds coverage', async () => {
    const coverageSource = readFileSync(new URL('./scope3-coverage.ts', import.meta.url), 'utf8')
    expect(coverageSource).not.toMatch(/from 'node:/)
    expect(coverageSource).not.toMatch(/export (async )?function scope3Coverage/)
    // Revision 4: the aggregate verification is reachable only through scope3Coverage, which calls the engine itself.
    const boundarySource = readFileSync(new URL('./scope3-engine-output.ts', import.meta.url), 'utf8')
    expect(boundarySource).not.toMatch(/export (async )?function verifyScope3EngineOutput/)
    // I-01 adds the annotations the boundary itself sends to the engine (default: none, all null); I-04 the assessments
    // of the reporting year (default: unavailable).
    expect(boundarySource).toMatch(/export async function scope3Coverage\(records: Scope3CoverageRecord\[\], screening: Scope3Screening\[\], results: Scope3EngineResult\[\], engine: Scope3AggregateEngine, pins: Scope3Pins,\n  annotations: Scope3Annotation\[\] = results.map\(\(\) => SCOPE3_NULL_ANNOTATION\), assessments: ReadonlyArray<Scope3AssessmentRecord> \| null = null,\n/)
    // Round 2 (owner decision 6): and company setup's descriptions of included categories (default: none).
    expect(boundarySource).toMatch(/setupDescriptions: ReadonlyMap<number, string> \| null = null\): Promise<Scope3Coverage>/)
  })
})

// Revision 4 (25 October 2026): S3A-03-R3. Coverage is bound to the actual engine's verification: scope3Coverage sends the
// results to the engine's aggregate itself, and the engine recomputes every result from its echoed input and refuses
// unless it is byte-identical. Each counterexample from Codex's technical re-review is refused with the outer result hash
// left stale and with it recomputed; the boundary's own structural checks catch most of them before the engine is asked.
describe('Revision 4: coverage is bound to the actual engine (S3A-03-R3)', () => {
  const truck = () => version('transport', '17.125', 'vehicle-mile', { category: 4, vehicle: 'medium_and_heavy_duty_truck', loadBasis: 'dedicated_vehicle', thirdPartyFacilities: 'none' })
  const asphalt = () => version('waste', '17.125', 'metric_ton', { category: 5, material: 'asphalt_concrete', treatment: 'recycled' })
  const naWaste = () => version('waste', '10', 'kg', { category: 5, material: 'clay_bricks', treatment: 'recycled' })
  /** The result with `mutate` applied; `rehash` recomputes its outer hash, as a forger would. */
  const tamper = (r: Scope3EngineResult, mutate: (x: any) => void, rehash: boolean): Scope3EngineResult => {
    const x: any = structuredClone(r); mutate(x)
    if (rehash) { const { resultSha256: _h, ...body } = x; x.resultSha256 = scope3Digest(body) }
    return x
  }
  /** The genuine aggregate with one result hash swapped and its own hash recomputed: what a lying engine would return. */
  const forgedAggregate = (genuine: Scope3EngineAggregate, from: string, to: string) => {
    const a: any = structuredClone(genuine)
    a.includedResults = a.includedResults.map((h: string) => h === from ? to : h)
    a.notCalculated = a.notCalculated.map((n: any) => n.resultSha256 === from ? { ...n, resultSha256: to } : n)
    a.partialBoundaryResults = a.partialBoundaryResults.map((n: any) => n.resultSha256 === from ? { ...n, resultSha256: to } : n)
    const { aggregateSha256: _h, ...body } = a; a.aggregateSha256 = scope3Digest(body)
    return a as Scope3EngineAggregate
  }
  const rowFor = (row: Scope3CoverageRecord, r: Scope3EngineResult): Scope3CoverageRecord => row.result.outcome === 'calculated' ? { ...row, result: { outcome: 'calculated', resultSha256: r.resultSha256 } } : row

  test('Codex\'s root replay: a CO2e-only component relabelled AR6-100 is refused, by the boundary and by the engine', async () => {
    const { rows: [row], results: [genuine] } = parts([outcome(asphalt())])
    const control = await coverageOf([row!], [], [genuine!], realEngine, pins)
    expect(control.knownSourceSubtotal).toMatchObject({ unrounded: '66.457491045171486235096879692', display: '66.4575' })
    expect(genuine!.co2eWithoutGasSplit!.gwpSetId).toBe('AR4-100')
    for (const rehash of [false, true]) {
      const bad = tamper(genuine!, x => { x.co2eWithoutGasSplit.gwpSetId = 'AR6-100' }, rehash)
      const forged = forgedAggregate(aggregateOf([genuine!])!, genuine!.resultSha256, bad.resultSha256)
      // A lying engine returning the reviewers' recomputed aggregate does not get it through: the result itself is refused.
      await expect(coverageOf([rowFor(row!, bad)], [], [bad], lying(forged), pins)).rejects.toThrow(rehash ? 'CO2e-only component' : 'result hash')
      await expect(coverageOf([rowFor(row!, bad)], [], [bad], realEngine, pins)).rejects.toThrow('refused')
      // And the engine on its own refuses it, so the boundary's verdict and the engine's agree.
      expect(engine({ action: 'aggregate', results: [bad] })).toEqual({ status: 'refused', code: 'result_integrity' })
    }
  }, ENGINE_TEST_TIMEOUT_MS)

  test('the technical re-review\'s probes are refused with stale and with recomputed outer hashes', async () => {
    const { rows, results } = parts([outcome(truck()), outcome(asphalt()), outcome(naWaste())])
    const [truckResult, wasteResult, heldResult] = results as [Scope3EngineResult, Scope3EngineResult, Scope3EngineResult]
    expect([truckResult.status, wasteResult.status, heldResult.status]).toEqual(['complete', 'complete', 'input_needed'])
    const genuine = aggregateOf(results)!
    const probes: Array<[string, number, (x: any) => void, string]> = [
      ['zeroed input hash, complete result', 0, x => { x.inputSha256 = '0'.repeat(64) }, 'input hash'],
      ['zeroed input hash, held result', 2, x => { x.inputSha256 = '0'.repeat(64) }, 'input hash'],
      ['changed input keeping its old hash', 0, x => { x.input.activity.value = '1712.5' }, 'input hash'],
      ['gas mass unit contradicting the gas', 0, x => { x.gases.co2.massUnit = 'kg CH4' }, 'gas units'],
      ['gas CO2e unit contradicting the total', 0, x => { x.gases.co2.co2eUnit = 'g CO2e' }, 'gas units'],
      ['CO2e-only unit', 1, x => { x.co2eWithoutGasSplit.co2eUnit = 'g CO2e' }, 'CO2e-only component'],
      ['result profile', 0, x => { x.profile = 'neuvetra.scope3-engine.v0' }, 'result profile'],
      ['method profile', 0, x => { x.profileId = 'scope3.cat5_12.waste' }, 'profile differs'],
      ['coordinated negative gas and total', 0, x => {
        for (const g of Object.values(x.gases) as any[]) g.co2e = `-${g.co2e}`
        x.total.unrounded = `-${x.total.unrounded}`; x.total.display = `-${x.total.display}`
      }, 'negative'],
      ['coordinated negative CO2e-only component and total', 1, x => {
        x.co2eWithoutGasSplit.co2e = `-${x.co2eWithoutGasSplit.co2e}`; x.total.unrounded = `-${x.total.unrounded}`; x.total.display = `-${x.total.display}`
      }, 'CO2e-only component'],
    ]
    for (const [label, index, mutate, reason] of probes) for (const rehash of [false, true]) {
      const bad = tamper(results[index]!, mutate, rehash), batch = results.map((r, i) => i === index ? bad : r)
      const records = rows.map((row, i) => i === index ? rowFor(row, bad) : row)
      const forged = forgedAggregate(genuine, results[index]!.resultSha256, bad.resultSha256)
      await expect(coverageOf(records, [], batch, lying(forged), pins), `${label}, ${rehash ? 'recomputed' : 'stale'} hash, lying engine`).rejects.toThrow(rehash ? reason : 'result hash')
      await expect(coverageOf(records, [], batch, realEngine, pins), `${label}, ${rehash ? 'recomputed' : 'stale'} hash, real engine`).rejects.toThrow('refused')
      if (rehash) expect(engine({ action: 'aggregate', results: batch }), `${label}: the engine alone`).toMatchObject({ status: 'refused' })
    }
  }, ENGINE_TEST_TIMEOUT_MS)

  test('lineage the boundary does not itself recompute (factor, constant, conversion, activity) is refused by the engine', async () => {
    // These fields are internally consistent after the change, so only the engine's recomputation can refuse them;
    // that is why coverage asks the actual engine and no longer accepts an aggregate from its caller.
    const { rows: [row], results: [genuine] } = parts([outcome(asphalt())])
    const probes: Array<[string, (x: any) => void]> = [
      ['factor value contradicting the pinned register', x => { x.factorsUsed[0].value = '0.0035205384954666675' }],
      ['factor cell', x => { x.factorsUsed[0].cell = 'D491' }],
      ['constant value', x => { x.constantsUsed[1].value = '0.4536' }],
      ['conversion result', x => { x.conversions[0].result = '18.87708119959' }],
      ['echoed activity', x => { x.activity.shortTons = '18.87708119959' }],
      ['boundary note dropped', x => { x.boundary.notes = x.boundary.notes.slice(1) }],
    ]
    for (const [label, mutate] of probes) {
      const bad = tamper(genuine!, mutate, true)
      expect(engine({ action: 'aggregate', results: [bad] }), label).toEqual({ status: 'refused', code: 'result_integrity' })
      await expect(coverageOf([rowFor(row!, bad)], [], [bad], realEngine, pins), label).rejects.toThrow('did not verify')
    }
  }, ENGINE_TEST_TIMEOUT_MS)

  test('the earlier tampered aggregates are still refused even from a lying engine', async () => {
    const { rows, results } = parts([outcome(truck()), outcome(asphalt()), outcome(naWaste())])
    const genuine = aggregateOf(results)!
    const rehash = (a: any) => { const { aggregateSha256: _h, ...body } = a; return { ...body, aggregateSha256: scope3Digest(body) } }
    for (const forged of [
      { ...genuine, knownSourceSubtotal: { ...genuine.knownSourceSubtotal, unrounded: '1', display: '1.0000' } },
      { ...genuine, notCalculated: [] }, { ...genuine, mixedGwpSets: false }, { ...genuine, registerSha256: '0'.repeat(64) },
      { ...genuine, includedResults: [...genuine.includedResults, genuine.includedResults[0]!] },
    ]) {
      await expect(coverageOf(rows, [], results, lying(forged), pins)).rejects.toThrow('refused')
      await expect(coverageOf(rows, [], results, lying(rehash(forged)), pins)).rejects.toThrow('refused')
    }
  }, ENGINE_TEST_TIMEOUT_MS)

  test('genuine, held and mixed-GWP controls pass, and coverage asks the engine exactly once with exactly these results', async () => {
    const { rows, results } = parts([outcome(truck()), outcome(asphalt()), outcome(naWaste()), gridLoss('12345.678')])
    let calls = 0, seen: unknown = null, notes: unknown = null
    const spy: Scope3AggregateEngine = { aggregate: async (r, a) => { calls++; seen = structuredClone(r); notes = structuredClone(a); return realEngine.aggregate(r) } }
    const cov = await coverageOf(rows, [], results, spy, pins)
    expect(calls).toBe(1); expect(seen).toEqual(results)
    // I-01: with no annotations given, the boundary sends one all-null annotation per result (the method defaults).
    expect(notes).toEqual(results.map(() => ({ dataQuality: null, activityDataOrigin: null })))
    expect(cov.categories[2]!.status).toBe('partial_boundary') // category 3 covers 3C (T&D losses) only
    expect(cov.categories[3]!.status).toBe('calculated')
    expect(cov.categories[4]).toMatchObject({ status: 'input_needed', subtotal: { display: '66.4575' }, subtotalBasis: 'known_sources_only', counts: { records: 2, calculated: 1, inputNeeded: 1 } })
    expect(cov.disclosures.map(d => d.code)).toContain('mixed_gwp_sets')
    // Records with nothing calculated never reach the engine.
    calls = 0
    await coverageOf([{ recordId: crypto.randomUUID(), category: 7, quality: 'actual', result: { outcome: 'outside_period', reasons: ['outside_reporting_period'] } }], [], [], spy, pins)
    expect(calls).toBe(0)
  }, ENGINE_TEST_TIMEOUT_MS)
})

// Scope 3 completion I-01 (DESIGN 4.6, 8.3): aggregate v2. The boundary sends the annotations itself and checks every
// profile sum against the results, the method catalog and those annotations; a lying engine's profile is refused.
describe('I-01: aggregate v2 profiles are verified at the boundary', () => {
  const annotating: Scope3AggregateEngine = { aggregate: async (results, annotations) => { const out = engine({ action: 'aggregate', results, annotations }); if (out.status !== 'ok') throw new Error(`refused: ${out.code}`); return out.aggregate } }
  const NONE = { dataQuality: null, activityDataOrigin: null }
  const noted = { dataQuality: { technological: 'poor', temporal: null, geographical: null, completeness: null, reliability: 'very_good' }, activityDataOrigin: 'value_chain_partner' } as const
  const truck = () => version('transport', '17.125', 'vehicle-mile', { category: 4, vehicle: 'medium_and_heavy_duty_truck', loadBasis: 'dedicated_vehicle', thirdPartyFacilities: 'none' })
  const rehashed = (a: any) => { const { aggregateSha256: _h, ...body } = a; return { ...body, aggregateSha256: scope3Digest(body) } as Scope3EngineAggregate }

  test('genuine profiles pass with and without annotations, and coverage output is unchanged by them', async () => {
    const { rows, results } = parts([outcome(truck()), outcome(waste()), outcome(flight()), outcome(bus())])
    const plain = await coverageOf(rows, [], results, annotating, pins)
    const annotations = results.map((_, i) => i === 2 ? noted : NONE)
    const withNotes = await coverageOf(rows, [], results, annotating, pins, annotations as never)
    // I-06 surfaces each category's verified profile on its row (I-01 kept coverage unchanged until then), so the annotated
    // profile shows on category 6's row; everything else is unchanged by the annotations.
    const withoutProfiles = (c: typeof plain) => ({ ...c, aggregateSha256: null, categories: c.categories.map(({ profile: _profile, ...row }) => row) })
    expect(withoutProfiles(withNotes)).toEqual(withoutProfiles(plain))
    expect([plain.categories[5]!.profile!.valueChain.percent, withNotes.categories[5]!.profile!.valueChain.percent]).toEqual([{ value: '0', display: '0.0' }, { value: '100', display: '100.0' }])
    const genuine = engine({ action: 'aggregate', results, annotations }).aggregate as Scope3EngineAggregate
    expect(Object.keys(genuine.categoryProfiles)).toEqual(['4', '5', '6', '7'])
    expect(genuine.categoryProfiles['6']!.valueChain.percent).toEqual({ value: '100', display: '100.0' })
    expect(genuine.categoryProfiles['6']!.dataQuality.overrides).toBe(1)
    await expect(coverageOf(rows, [], results, lying(genuine), pins, annotations as never)).resolves.toBeDefined()
    // The same genuine aggregate checked against different annotations is refused: the boundary re-derives each sum.
    await expect(coverageOf(rows, [], results, lying(genuine), pins)).rejects.toThrow('profile')
  }, ENGINE_TEST_TIMEOUT_MS)

  test('every tampered profile field, register list or annotation is refused', async () => {
    const { rows, results } = parts([outcome(truck()), outcome(waste()), outcome(flight()), outcome(bus())])
    const annotations = results.map((_, i) => i === 2 ? noted : NONE)
    const genuine = engine({ action: 'aggregate', results, annotations }).aggregate as Scope3EngineAggregate
    const probes: Array<[string, (a: any) => void, string]> = [
      ['method-type sum', a => { a.categoryProfiles['5'].methodTypes.activity_average_data.unrounded = '1' }, 'subtotal'],
      ['a method type that is not there', a => { a.categoryProfiles['5'].methodTypes.spend_based = a.categoryProfiles['5'].methodTypes.activity_average_data }, 'method types'],
      ['dominant method type', a => { a.categoryProfiles['5'].dominantMethodType = 'spend_based' }, 'dominant'],
      ['tonnes display', a => { a.categoryProfiles['5'].subtotalTonnes.display = '1.000' }, 'tonnes'],
      ['value-chain numerator', a => { a.categoryProfiles['6'].valueChain.numerator = a.categoryProfiles['6'].valueChain.denominator; a.categoryProfiles['7'].valueChain.numerator = a.categoryProfiles['7'].valueChain.denominator }, 'value-chain numerator'],
      ['value-chain share over 100', a => { a.categoryProfiles['6'].valueChain.percent = { value: '150', display: '150.0' } }, 'value-chain share'],
      ['value-chain share missing', a => { a.categoryProfiles['6'].valueChain.percent = null }, 'value-chain share'],
      ['kg per rating', a => { const t = a.categoryProfiles['6'].dataQuality.indicators.technological.ratingKg; t.fair = t.poor; delete t.poor }, 'ratings'],
      ['score form', a => { a.categoryProfiles['6'].dataQuality.indicators.temporal.score = { value: '1', display: '1' } }, 'data-quality score'],
      ['override count', a => { a.categoryProfiles['6'].dataQuality.overrides = 0 }, 'override'],
      ['overall label', a => { a.categoryProfiles['6'].dataQuality.overall.label = 'excellent' }, 'overall'],
      ['biogenic CO2 invented', a => { a.categoryProfiles['6'].biogenicCo2 = { unrounded: '1', display: '1.0000', unit: 'kg CO2', rounding: 'half_even_4dp_once' } }, 'biogenic'],
      ['memo item invented', a => { a.categoryProfiles['6'].memoItems = { projected_lifetime_emissions: a.categoryProfiles['6'].valueChain.denominator } }, 'memo'],
      ['profile count', a => { a.categoryProfiles['6'].results = 2 }, 'result count'],
      ['profile for a category with nothing calculated', a => { a.categoryProfiles['1'] = a.categoryProfiles['6'] }, 'category profiles'],
      ['profile missing', a => { delete a.categoryProfiles['7'] }, 'category profiles'],
      ['unpinned additional register', a => { a.additionalRegisterSha256s = { spend: '0'.repeat(64) } }, 'additional registers'],
      ['extra profile key', a => { a.categoryProfiles['6'].note = 'x' }, 'profile shape'],
    ]
    for (const [label, mutate, reason] of probes) {
      const forged: any = structuredClone(genuine); mutate(forged)
      await expect(coverageOf(rows, [], results, lying(rehashed(forged)), pins, annotations as never), label).rejects.toThrow(reason)
    }
    // Pinned additional registers must match exactly what the engine reports.
    await expect(coverageOf(rows, [], results, annotating, { ...pins, additionalRegisterSha256s: { spend: 'a'.repeat(64) } }, annotations as never)).rejects.toThrow('additional registers')
    // Annotations: one per result, known values only (the engine refuses them too).
    await expect(coverageOf(rows, [], results, annotating, pins, annotations.slice(1) as never)).rejects.toThrow('annotations do not match')
    for (const bad of [{ dataQuality: null }, { ...NONE, activityDataOrigin: 'supplier' }, { dataQuality: { ...noted.dataQuality, technological: 'excellent' }, activityDataOrigin: null }])
      await expect(coverageOf(rows, [], results, annotating, pins, results.map((_, i) => i === 0 ? bad : NONE) as never)).rejects.toThrow('annotation')
    expect(engine({ action: 'aggregate', results, annotations: results.map((_, i) => i === 0 ? { ...NONE, activityDataOrigin: 'supplier' } : NONE) })).toEqual({ status: 'refused', code: 'invalid_annotation' })
  }, ENGINE_TEST_TIMEOUT_MS)

  test('a result with an optional key its method does not declare is refused (A1)', async () => {
    const { rows: [row], results: [genuine] } = parts([outcome(waste())])
    for (const [key, value] of [['biogenicCo2', { mass: '1', massUnit: 'kg CO2', basis: 'x' }], ['memoItems', []], ['additionalRegisters', []]] as const) {
      const x: any = structuredClone(genuine); x[key] = value
      const { resultSha256: _h, ...body } = x; x.resultSha256 = scope3Digest(body)
      await expect(coverageOf([{ ...row!, result: { outcome: 'calculated', resultSha256: x.resultSha256 } }], [], [x], annotating, pins), key).rejects.toThrow('does not declare')
    }
  }, ENGINE_TEST_TIMEOUT_MS)
})

// Scope 3 completion I-04 (DESIGN 3.5, 5.3, A26, A27): the status order with method-pending and optional lines, documented
// within-category exclusions, the assessment disclosures (never gates), the 9-12 joint rule and the energy-resale check.
// Method-pending producers arrive in I-05, so those lines are synthetic coverage records here.
describe('I-04: status machinery, assessments and disclosures', () => {
  const id = () => crypto.randomUUID()
  const heldLine = (category: number, status: 'input_needed' | 'excluded' | 'withdrawn', reason = 'method_not_built_yet', kind?: string): Row => ({ recordId: id(), category: category as never, quality: 'actual', result: { outcome: 'held', status, reasons: [reason] }, ...(kind ? { kind } : {}) })
  const pendingLine = (category: number, optional = false): Row => ({ recordId: id(), category: category as never, quality: 'actual', result: { outcome: 'held', status: 'method_pending', reasons: ['factor_source_not_yet_loaded'], ...(optional ? { optional: true } : {}) } })
  const unavailableLine = (category: number): Row => ({ recordId: id(), category: category as never, quality: 'actual', result: { outcome: 'unavailable' } })
  const truckWith = (thirdPartyFacilities: 'none' | 'present_not_included' | 'unknown', category: 4 | 9 = 4) =>
    outcome(version('transport', '17.125', 'vehicle-mile', { category, vehicle: 'medium_and_heavy_duty_truck', loadBasis: 'dedicated_vehicle', thirdPartyFacilities }))
  const record = (category: number, extra: Record<string, unknown> = {}) => fixtureAssessmentRecord(company, setup, { category, ...extra }) as unknown as Scope3AssessmentRecord
  const facilities = { noteCode: 'third_party_facilities_not_included', justification: 'One shared cross-dock, under 1% of freight.', magnitudeKind: 'estimated', magnitudeTCo2e: '0.4', basis: 'Throughput share times the lane estimate.' }
  const nuclear = { noteCode: 'nuclear_biomass_byproduct_fuels_upstream_excluded', justification: 'Under 1% of purchased fuel energy.', magnitudeKind: 'not_quantifiable', magnitudeTCo2e: null, basis: '' }
  async function run(lines: Row[], screening: Scope3Screening[] = [], assessments: Scope3AssessmentRecord[] | null = null) {
    const { rows, results } = parts(lines)
    return coverageOf(rows, screening, results, realEngine, pins, results.map(() => SCOPE3_NULL_ANNOTATION), assessments)
  }

  // Round 2, lane B (owner decisions 5, 6, 9; ACC-11): the boundary's screening conflict, descriptions from setup, the capped
  // data-quality label and the lines without evidence.
  test('round 2: a screening conflict keeps the records counted; a setup description satisfies the rule; the label is capped; unsupported lines are counted', async () => {
    const { rows, results } = parts([outcome(bus()), truckWith('present_not_included'), heldLine(4, 'input_needed', 'quantity_not_calculable')])
    const evidenced = rows.map((row, i) => ({ ...row, evidenceLinked: i === 0 }))
    const cov = await coverageOf(evidenced, [excluded(7), included(4), included(5)], results, realEngine, pins, results.map(() => SCOPE3_NULL_ANNOTATION), [record(5, { activitiesIncluded: '' })], new Map([[4, 'Inbound freight by truck.'], [5, 'Office waste.']]))
    const seven = cov.categories[6]!, four = cov.categories[3]!, five = cov.categories[4]!
    // Decision 5: the conflict category keeps its figure in the known-source total; its reason says what to do.
    expect([seven.status, seven.reasons[0], seven.subtotal !== null]).toEqual(['screening_conflict', 'screening_conflict_records_exist', true])
    expect(cov.knownSourceSubtotal!.display).not.toBe('0.0000')
    expect(cov.proposedMandatory.line).toContain('category 7 has records although it is screened out')
    // Decision 6: setup's description of category 4 (no assessment) and category 5 (blank assessment description) satisfies the rule.
    for (const row of [four, five]) expect(row.disclosures).not.toContain('included_activities_not_described')
    expect([four.screening.description, five.screening.description, seven.screening.description]).toEqual(['Inbound freight by truck.', 'Office waste.', null])
    // Decision 9: category 4 has a held line and an undocumented partial line: never better than fair, and why.
    if (four.profile!.dataQuality.overall.label === 'good' || four.profile!.dataQuality.overall.label === 'very_good')
      expect(four.dataQualityLabel).toEqual({ label: 'fair', engineLabel: four.profile!.dataQuality.overall.label, capped: true, reasons: ['lines_not_quantified', 'partial_boundary_not_documented'] })
    else expect(four.dataQualityLabel).toMatchObject({ capped: false, label: four.profile!.dataQuality.overall.label })
    // ACC-11: the truck and the held line have no evidence; the bus line has.
    expect([four.linesWithoutEvidence, seven.linesWithoutEvidence]).toEqual([2, 0])
    expect(four.disclosures).toContain('lines_without_evidence')
  }, ENGINE_TEST_TIMEOUT_MS)
  // Round 2b integration (A27 over decision 9): an optional activity pending a factor source (a hotel stay abroad) is
  // disclosed and never downgrades the category, so it never caps the label either; a non-optional pending line does.
  test('round 2b: an optional pending line never caps the data-quality label; a method-pending line does', async () => {
    const veryGood = { dataQuality: { technological: 'very_good', temporal: 'very_good', geographical: 'very_good', completeness: 'very_good', reliability: 'very_good' }, activityDataOrigin: null } as typeof SCOPE3_NULL_ANNOTATION
    // The real engine's aggregate with the annotations (the shared stand-in above sends none).
    const annotated: Scope3AggregateEngine = { aggregate: async (results, notes) => { const out = engine({ action: 'aggregate', results, annotations: notes }); if (out.status !== 'ok') throw new Error(`refused: ${out.code}`); return out.aggregate } }
    const six = async (lines: Row[]) => { const { rows, results } = parts(lines); return (await coverageOf(rows, [included(6)], results, annotated, pins, results.map(() => veryGood))).categories[5]! }
    const optional = await six([outcome(flight()), pendingLine(6, true)])
    expect([optional.status, optional.counts.optionalPending, optional.profile!.dataQuality.overall.label]).toEqual(['calculated', 1, 'very_good'])
    expect([optional.dataQualityLabel, optional.disclosures.includes('data_quality_label_capped'), optional.disclosures.includes('optional_activity_not_yet_quantified')])
      .toEqual([{ label: 'very_good', engineLabel: 'very_good', capped: false, reasons: [] }, false, true])
    const pending = await six([outcome(flight()), pendingLine(6)])
    expect([pending.status, pending.dataQualityLabel, pending.disclosures.includes('data_quality_label_capped')])
      .toEqual(['awaiting_factor_source', { label: 'fair', engineLabel: 'very_good', capped: true, reasons: ['lines_not_quantified'] }, true])
  }, ENGINE_TEST_TIMEOUT_MS)
  const included = (category: number): Scope3Screening => ({ category, decision: 'included', reason: null })
  const excluded = (category: number, decision: 'excluded' | 'not_relevant' = 'excluded'): Scope3Screening => ({ category, decision, reason: 'Synthetic screening reason.' })

  test('DESIGN 5.3, table-driven: every rule in order, including awaiting_factor_source and optional pending lines', async () => {
    const flightRow = () => outcome(flight())
    const cases: Array<[string, () => Row[], Scope3Screening[], number, string, Partial<Scope3CategoryRow['counts']>]> = [
      // Round 2 (owner decision 5): rule 1 is a screening conflict.
      ['1 screened out with a method-pending record', () => [pendingLine(6)], [excluded(6)], 6, 'screening_conflict', { methodPending: 1 }],
      ['1 screened out with an optional pending record', () => [pendingLine(6, true)], [excluded(6, 'not_relevant')], 6, 'screening_conflict', { optionalPending: 1 }],
      ['2 screened out', () => [], [excluded(2)], 2, 'excluded', {}],
      ['2 not applicable', () => [], [excluded(8, 'not_relevant')], 8, 'not_relevant', {}],
      ['3 unavailable beats input needed and pending', () => [unavailableLine(7), heldLine(7, 'input_needed'), pendingLine(7)], [], 7, 'unavailable', { unavailable: 1, inputNeeded: 1, methodPending: 1 }],
      ['4 input needed beats pending', () => [heldLine(13, 'input_needed'), pendingLine(13)], [included(13)], 13, 'input_needed', { inputNeeded: 1, methodPending: 1 }],
      ['5 method pending only', () => [pendingLine(8)], [], 8, 'awaiting_factor_source', { methodPending: 1 }],
      ['5 method pending beats calculated', () => [flightRow(), pendingLine(6)], [included(6)], 6, 'awaiting_factor_source', { calculated: 1, methodPending: 1 }],
      ['5 optional and non-optional pending', () => [pendingLine(6), pendingLine(6, true)], [included(6)], 6, 'awaiting_factor_source', { methodPending: 1, optionalPending: 1 }],
      ['6 calculated with an optional pending line', () => [flightRow(), pendingLine(6, true)], [included(6)], 6, 'calculated', { calculated: 1, optionalPending: 1 }],
      ['6 partial line', () => [truckWith('present_not_included')], [], 4, 'partial_boundary', { partialBoundary: 1 }],
      ['6 category 3 is partial by support', () => [gridLoss('1000')], [included(3)], 3, 'partial_boundary', { partialBoundary: 1 }],
      ['7 only an optional pending line', () => [pendingLine(6, true)], [], 6, 'no_records', { optionalPending: 1 }],
      ['7 included, nothing recorded', () => [], [included(15)], 15, 'no_records', {}],
      ['7 records exist, none counted', () => [heldLine(11, 'withdrawn', 'record_withdrawn')], [], 11, 'no_records', { withdrawn: 1 }],
      ['8 nothing at all (no method yet: still "Not screened", audit D12)', () => [], [], 14, 'not_screened', {}],
    ]
    for (const [label, lines, screening, category, status, counts] of cases) {
      const row = (await run(lines(), screening)).categories[category - 1]!
      expect([label, row.status]).toEqual([label, status])
      expect([label, row.counts]).toEqual([label, expect.objectContaining(counts)])
      const { records, ...rest } = row.counts
      expect([label, Object.values(rest).reduce((a, b) => a + b, 0)]).toEqual([label, records])
    }
    const statuses = (await run([])).categories.map(row => row.status)
    expect(statuses).not.toContain('not_yet_supported' as never)
  }, ENGINE_TEST_TIMEOUT_MS)

  test('A27: optional pending lines add a disclosure, never a gap; method-pending lines are counted with their reason', async () => {
    const cov = await run([outcome(flight()), pendingLine(6, true)], [included(6)])
    expect(cov.categories[5]).toMatchObject({ status: 'calculated', subtotalBasis: 'all_counted_records', reasons: ['factor_source_not_yet_loaded'] })
    expect(cov.categories[5]!.disclosures).toContain('optional_activity_not_yet_quantified')
    expect(cov.proposedMandatory.gaps.map(gap => gap.category)).not.toContain(6)
    const pending = await run([outcome(flight()), pendingLine(6)], [included(6)])
    expect(pending.categories[5]).toMatchObject({ status: 'awaiting_factor_source', subtotalBasis: 'known_sources_only' })
    expect(pending.categories[5]!.disclosures).not.toContain('optional_activity_not_yet_quantified')
    expect(pending.proposedMandatory.line).toContain('category 6 awaiting a factor source')
    expect(SCOPE3_DISCLOSURE_TEXT.optional_activity_not_yet_quantified).toBeTruthy()
  }, ENGINE_TEST_TIMEOUT_MS)

  test('A26: a documented within-category exclusion closes only the partial notes it names; the line stays partial', async () => {
    const documented = [record(4, { withinCategoryExclusions: [facilities] })]
    const closed = await run([truckWith('present_not_included'), truckWith('none')], [included(4)], documented)
    expect(closed.categories[3]).toMatchObject({ status: 'calculated', counts: { partialBoundary: 1, calculated: 1 }, subtotalBasis: 'all_counted_records' })
    expect(closed.categories[3]!.disclosures).toEqual(expect.arrayContaining(['within_category_exclusion_documented', 'third_party_facilities_not_included']))
    expect(closed.categories[3]!.assessment!.withinCategoryExclusions).toEqual([facilities] as never)
    // Not assessed is not documentable; a note documented for another category does not count; without assessments nothing closes.
    expect((await run([truckWith('unknown')], [included(4)], documented)).categories[3]!.status).toBe('partial_boundary')
    expect((await run([truckWith('present_not_included')], [included(4)], [record(9, { withinCategoryExclusions: [facilities] })])).categories[3]!.status).toBe('partial_boundary')
    expect((await run([truckWith('present_not_included')], [included(4)], null)).categories[3]!.status).toBe('partial_boundary')
    expect((await run([truckWith('present_not_included')], [included(4)], [record(4, { withinCategoryExclusions: [nuclear] })])).categories[3]!.status).toBe('partial_boundary')
    // Category 3 stays partial: 3C's own note can't be documented and the category is engine_partial.
    const three = await run([gridLoss('1000')], [included(3)], [record(3, { withinCategoryExclusions: [nuclear] })])
    expect(three.categories[2]).toMatchObject({ status: 'partial_boundary' })
    expect(three.categories[2]!.disclosures).toContain('within_category_exclusion_documented')
    // The rule itself.
    expect(scope3PartialResultDocumented(['tank_to_wheel_only', 'third_party_facilities_not_included'], { withinCategoryExclusions: [facilities as never] })).toBe(true)
    expect(scope3PartialResultDocumented(['tank_to_wheel_only'], { withinCategoryExclusions: [facilities as never] })).toBe(false)
    expect(scope3PartialResultDocumented(['third_party_facilities_not_included', 'hybrid_upstream_missing'], { withinCategoryExclusions: [facilities as never] })).toBe(false)
  }, ENGINE_TEST_TIMEOUT_MS)

  test('every partial result the engine gives carries a listed partial note, and no met result does', () => {
    const P = { start: '2025-01-01', endExclusive: '2026-01-01' }
    const supplier = (over: Record<string, unknown>) => ({ kind: 'purchase_supplier', input: { period: P, category: 1, factorOrigin: 'supplier_primary', basis: 'product_factor', quantity: '10',
      unit: 'kg', factorValue: '2', factorUnit: 'kg CO2e per kg', allocationNumerator: null, allocationDenominator: null, boundary: 'cradle_to_gate', hybridUpstreamCoveredBy: null, gwpBasis: 'AR5', verification: 'third_party_verified', ...over } })
    const results = [truckWith('present_not_included'), truckWith('unknown', 9), truckWith('none'), gridLoss('1000'), outcome(waste()), outcome(flight()), outcome(bus())].map(r => r.full!)
    const out = engine({ action: 'calculate_many', requests: [supplier({}), supplier({ boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: 'none' }), supplier({ boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: 'other_records' })] })
    results.push(...(out as unknown as { results: Array<{ result: Scope3EngineResult }> }).results.map(item => item.result))
    for (const r of results) {
      const listed = r.boundary.notes.filter(note => SCOPE3_PARTIAL_BOUNDARY_NOTES.includes(note))
      expect([r.methodVersionId, r.boundary.minimumBoundary, listed.length > 0]).toEqual([r.methodVersionId, r.boundary.minimumBoundary, r.boundary.minimumBoundary === 'partial'])
    }
  }, ENGINE_TEST_TIMEOUT_MS)

  test('DESIGN 3.5: assessment disclosures fire per decision, none changes a status, and none fires without assessments', async () => {
    const screening = [excluded(1), excluded(2), excluded(8, 'not_relevant'), excluded(13, 'not_relevant'), included(5), included(7)]
    const full = [record(2), record(13, { reasonCode: 'no_leased_assets', magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: '' }), record(7, { reasonCode: null, activitiesIncluded: 'Staff commuting to both offices.' })]
    const cov = await run([outcome(waste())], screening, full)
    const codes = (category: number) => cov.categories[category - 1]!.disclosures
    expect(codes(1)).toEqual(['exclusion_without_magnitude', 'exclusion_without_reason_code', 'exclusion_without_relevance_criteria'])
    expect(codes(2)).toEqual([])
    expect(codes(8)).toEqual(['not_applicable_without_reason_code'])
    expect(codes(13)).toEqual([])
    expect(codes(5)).toContain('included_activities_not_described')
    expect(codes(7)).not.toContain('included_activities_not_described')
    expect(cov.categories.map(row => row.status)).toEqual((await run([outcome(waste())], screening, null)).categories.map(row => row.status))
    expect([cov.categories[0]!.status, cov.categories[7]!.status, cov.categories[4]!.status]).toEqual(['excluded', 'not_relevant', 'calculated'])
    expect(cov.categories[1]!.assessment).toMatchObject({ category: 2, reasonCode: 'immaterial_estimated' })
    expect(cov.categories[0]!.assessment).toBeNull()
    // Each missing piece separately, and a reason code given for the other decision.
    const one = async (decision: Scope3Screening, extra: Record<string, unknown>) => (await run([], [decision], [record(decision.category, extra)])).categories[decision.category - 1]!.disclosures
    expect(await one(excluded(2), { criteria: { ...FIXTURE_CRITERIA, size: false } })).toEqual(['exclusion_without_relevance_criteria'])
    expect(await one(excluded(2), { criteria: { ...FIXTURE_CRITERIA, size: false, other: true, otherText: 'Customer request.' } })).toEqual([])
    expect(await one(excluded(2), { magnitudeKind: 'not_quantifiable', magnitudeTCo2e: null, magnitudeBasis: '', notQuantifiableReason: 'No spend data for 2025.' })).toEqual([])
    expect(await one(excluded(2), { reasonCode: 'not_franchisor' })).toEqual(['assessment_reason_code_not_for_decision'])
    expect(await one(excluded(14, 'not_relevant'), { reasonCode: 'data_unavailable' })).toEqual(['assessment_reason_code_not_for_decision'])
    expect(await one(included(6), { activitiesIncluded: '   ' })).toEqual(['included_activities_not_described'])
    // Unavailable assessments (schema below 30): no assessment disclosure, no assessment on any row.
    const without = await run([outcome(waste())], screening, null)
    expect(without.categories.every(row => row.assessment === null)).toBe(true)
    expect(without.disclosures.map(d => d.code).filter(code => code in SCOPE3_DISCLOSURE_TEXT_I04)).toEqual([])
    for (const code of Object.keys(SCOPE3_DISCLOSURE_TEXT_I04)) expect(SCOPE3_DISCLOSURE_TEXT[code]).toBe(SCOPE3_DISCLOSURE_TEXT_I04[code]!)
  }, ENGINE_TEST_TIMEOUT_MS)

  test('Std 6.4, the 9-12 joint rule: a subset excluded for unknown end use is flagged on all four; all four together are not', async () => {
    const unknownEndUse = (category: number) => record(category, { reasonCode: 'intermediate_unknown_end_use' })
    const subset = await run([], [excluded(9), excluded(10), included(11), excluded(12, 'not_relevant')], [unknownEndUse(9), unknownEndUse(10)])
    for (const category of [9, 10, 11, 12]) expect([category, subset.categories[category - 1]!.disclosures]).toEqual([category, expect.arrayContaining(['selective_downstream_exclusion'])])
    expect(subset.disclosures.find(d => d.code === 'selective_downstream_exclusion')!.categories).toEqual([9, 10, 11, 12])
    expect(subset.categories.slice(0, 8).some(row => row.disclosures.includes('selective_downstream_exclusion'))).toBe(false)
    const all = await run([], [9, 10, 11, 12].map(c => excluded(c)), [9, 10, 11, 12].map(unknownEndUse))
    expect(all.disclosures.map(d => d.code)).not.toContain('selective_downstream_exclusion')
    // Another exclusion reason on one of them is a subset again; no use of the reason at all is not.
    expect((await run([], [9, 10, 11, 12].map(c => excluded(c)), [unknownEndUse(9), unknownEndUse(10), unknownEndUse(11), record(12)])).disclosures.map(d => d.code)).toContain('selective_downstream_exclusion')
    expect((await run([], [9, 10, 11, 12].map(c => excluded(c)), [9, 10, 11, 12].map(c => record(c)))).disclosures.map(d => d.code)).not.toContain('selective_downstream_exclusion')
    expect(scope3SelectiveDownstreamExclusion(c => c === 9 ? 'excluded' : 'not_screened', c => c === 9 ? { reasonCode: 'intermediate_unknown_end_use' } : null)).toBe(true)
  })

  test('category 3: resells energy with no energy-resold record is disclosed; "none" or a record is not', async () => {
    const resells = [record(3, { reasonCode: null, magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: '', activitiesIncluded: 'Grid losses.', energyResale: 'resells_energy' })]
    const codes = async (lines: Row[], assessments = resells) => (await run(lines, [included(3)], assessments)).categories[2]!.disclosures
    expect(await codes([])).toContain('energy_resale_without_records')
    expect(await codes([heldLine(3, 'input_needed', 'method_not_built_yet', 'energy_resold')])).not.toContain('energy_resale_without_records')
    expect(await codes([heldLine(3, 'withdrawn', 'record_withdrawn', 'energy_resold')])).toContain('energy_resale_without_records')
    expect(await codes([], [{ ...resells[0]!, energyResale: 'none' }])).not.toContain('energy_resale_without_records')
  })

  test('assessments are checked: one per category, one reporting year, each as 0030 stores it', async () => {
    await expect(run([], [], [record(4), record(4)])).rejects.toThrow('more than once')
    await expect(run([], [], [record(4), record(5, { reportingYear: 2026 })])).rejects.toThrow('mix reporting years')
    await expect(run([], [], [{ ...record(4), magnitudeTCo2e: '-1' }])).rejects.toThrow('Invalid Scope 3 assessment')
    await expect(run([], [], [{ ...record(4), revision: 2 }])).rejects.toThrow('revision chain')
    expect(() => validateScope3AssessmentRecord({ ...record(4), extra: 1 })).toThrow('saved assessment')
    expect(validateScope3AssessmentRecord(record(4, { revision: 2 }), company)).toMatchObject({ revision: 2, correctionReason: 'Corrected after review.' })
    expect(() => validateScope3AssessmentRecord(record(4), '94000000-0000-4000-8000-0000000000ff')).toThrow('company')
  })

  test('audit D13: setup notes come from the method catalog; category 3 names 3A to 3D; support follows the catalog', () => {
    // I-05 builds 3D (energy resold), so the note now names it calculated; I-12u builds 3A and 3B.
    expect(scope3CategoryMethodNote(3)).toBe('Category 3 in this beta: upstream of purchased fuels (3A), upstream of purchased electricity (3B), grid losses (3C), energy bought and resold (3D) calculated. 3A, 3B and 3C follow automatically from your fuel and electricity records.')
    expect(scope3CategoryMethodNote(1)).toBe('Calculated in this beta (spend-based, supplier-specific, average data).')
    // I-05: asset energy (average data) and partner figures (partner-reported) serve 4, 8, 9, 10, 13 and 14 (partner figures also 5 and 12).
    expect(scope3CategoryMethodNote(4)).toBe('Calculated in this beta (average data, spend-based, partner-reported).')
    expect(scope3CategoryMethodNote(8)).toBe('Calculated in this beta (average data, partner-reported).')
    // I-07: category 11 (fuels, energy-using and greenhouse-gas products; average data), 12 (waste, end of life by split, partner
    // figures) and 15 (investee-reported figures and the revenue proxy).
    expect(scope3CategoryMethodNote(11)).toBe('Calculated in this beta (average data).')
    expect(scope3CategoryMethodNote(15)).toBe('Calculated in this beta (partner-reported, proxy).')
    expect(SCOPE3_CATEGORIES.map(scope3CategorySupport)).toEqual(SCOPE3_CATEGORIES.map(c => unsupported.includes(c) ? 'none' : 'engine'))  // I-12u: engine_partial retired
    // I-05 (integration follow-up of wave 2): the vestigial engine-category list equals the catalog's support.
    expect([...SCOPE3_ENGINE_CATEGORIES] as number[]).toEqual(SCOPE3_CATEGORIES.filter(c => scope3CategorySupport(c) !== 'none'))
  })
})
