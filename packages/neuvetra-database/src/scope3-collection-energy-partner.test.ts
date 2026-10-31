// Scope 3 completion I-05 (DESIGN §5.1, §3.3, §4.4, §4.6, A6, A14, A15, A27, A28; Claude, 30 October 2026): energy resold
// (3D), average-data commuting, teleworking, asset energy and partner figures from the collection contract to the real
// Scope 3 engine; the late-source lines (buildings by floor area, the 3D upstream line, hotel stays) held as method_pending;
// the lease boundary of the consolidation approach (Scope 3 Standard Tables A.1 and A.2); partner supersession; and the
// trusted boundary's checks of the three new profile keys and of a record's derived lines. Every contract-valid record
// either reaches the engine and is accepted, or is held with a named reason.
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CollectionContext } from './collection-contract'
import { ENGINE_SUBREGIONS } from './collection-engine-input'
import { SCOPE3_REGISTER_2025_SHA256, SCOPE3_SPEND_REGISTER_SHA256, SCOPE3_SUPPLEMENT_REGISTER_SHA256, SCOPE3_US_UPSTREAM_REGISTER_SHA256, SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } from './method-reference'
import {
  planEnergyResoldUpstream, planScope3Calculation, planScope3Supersession, scope3DistanceCommutingPeriods, scope3IsHotelMode, scope3SpendMappingKeyInput,
  SCOPE3_ASSET_CATEGORIES, SCOPE3_COLLECTION_UNITS, SCOPE3_COMMUTING_AVG_MODES, SCOPE3_GHG_GASES, SCOPE3_GRID_BASES, SCOPE3_HOTEL_MODE_ALIASES, SCOPE3_PARTNER_CATEGORIES, SCOPE3_SOLD_FUELS, SCOPE3_TRAVEL_MODES, SCOPE3_UNIT_FAMILIES,
  validateScope3Payload, type Scope3CalculationPlan, type Scope3CollectionActivity, type Scope3CollectionKind, type Scope3CollectionVersion, type Scope3PlanOptions,
} from './scope3-collection'
import { SCOPE3_PARTIAL_BOUNDARY_NOTES, type Scope3Annotation, type Scope3CoverageRecord, type Scope3EngineAggregate, type Scope3EngineResult } from './scope3-coverage'
import { scope3Coverage, type Scope3AggregateEngine } from './scope3-engine-output'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_REASON_TEXT_I02, SCOPE3_REASON_TEXT_I03, SCOPE3_REASON_TEXT_I04, SCOPE3_REASON_TEXT_I05 } from './scope3-text'

const ENGINE = fileURLToPath(new URL('../../../apps/site-api/src/calculation/scope3_engine.py', import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', ENGINE], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; results?: Array<{ status: string; code?: string; result?: Scope3EngineResult }>; catalog?: Record<string, any>; aggregate?: Scope3EngineAggregate }
}
const runAll = (plans: Scope3CalculationPlan[]) => plans.length ? engine({ action: 'calculate_many', requests: plans.map(plan => plan.call!.request) }).results! : []
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const pins = { engineSha256: createHash('sha256').update(readFileSync(ENGINE)).digest('hex'), registerSha256: SCOPE3_REGISTER_2025_SHA256,
  additionalRegisterSha256s: { spend: SCOPE3_SPEND_REGISTER_SHA256, supplement: SCOPE3_SUPPLEMENT_REGISTER_SHA256, us_upstream: SCOPE3_US_UPSTREAM_REGISTER_SHA256, building_hotel: SCOPE3_BUILDING_HOTEL_REGISTER_SHA256 } }
const realEngine: Scope3AggregateEngine = { aggregate: async (results, annotations) => {
  const out = engine(annotations ? { action: 'aggregate', results, annotations } : { action: 'aggregate', results })
  if (out.status !== 'ok') throw new Error(`refused: ${out.code}`)
  return out.aggregate!
} }
const TIMEOUT = 120_000, FUZZ_TIMEOUT = 300_000

const company = '93500000-0000-4000-8000-000000000001', setup = '93500000-0000-4000-8000-000000000002'
const office = '93500000-0000-4000-8000-000000000003', warehouse = '93500000-0000-4000-8000-000000000004'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: 'operational_control', reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, locations: [
  { id: office, name: 'Office', inclusion: 'included', control: 'reporting_company', entityId: null, startMode: 'period_start', endMode: 'period_end' },
  { id: warehouse, name: 'Warehouse', inclusion: 'excluded', control: 'landlord', entityId: null, startMode: 'period_start', endMode: 'period_end' }] }
const year = { start: '2025-01-01', endExclusive: '2026-01-01' }
const plain = (value: string) => /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$/.test(value)
const q = (value: string, unit: string, normalized = plain(value)) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalized ? value : null, normalizedUnit: normalized ? unit : null })
/** A contract-valid quantity for a kind: normalized only to a unit 0030 lets that kind normalize to (else kept as written). */
const qk = (kind: Scope3CollectionKind, value: string, unit: string) => q(value, unit, plain(value) && SCOPE3_COLLECTION_UNITS[kind].includes(unit))
let n = 0
function record<K extends Scope3CollectionKind>(kind: K, quantity: ReturnType<typeof q>, payload: unknown, extra: Record<string, unknown> = {}): Scope3CollectionVersion {
  n++
  const activity = { locationId: office, setupVersionId: setup, sourceId: `E-${n}`, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null,
    reference: 'Synthetic source', notes: '', evidenceIds: [], period: year, kind, quantity, payload: validateScope3Payload(kind, payload), ...extra } as unknown as Scope3CollectionActivity
  return { id: `93500000-0000-4000-8000-${String(10000 + n).padStart(12, '0')}`, recordId: `93500000-0000-4000-8000-${String(50000 + n).padStart(12, '0')}`, companyId: company, revision: 1,
    previousVersionId: null, correctionReason: null, activity, payloadSha256: 'a'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}
const plan = (v: Scope3CollectionVersion, options: Scope3PlanOptions = {}) => planScope3Calculation(v, context, [], options)
const OPS: Scope3PlanOptions = { consolidationApproach: 'operational_control' }

// The shared fixture shapes (scope3-payload-fixtures.ts).
const RESOLD = { gridBasis: 'subregion', zip: '94105', subregion: 'CAMX', utilityEiaId: null, resoldEnergyNotInScope2: true }
const mode = (m: string, share: string, distance: string, occupancy: string | null = null, unit = 'mile') => ({ mode: m, sharePercent: share, oneWayDistance: distance, distanceUnit: unit, occupancy })
const COMMUTE = { workingDays: 220, modes: [mode('passenger_car', '60', '12', '1.2'), mode('bus', '30', '8'), mode('non_motorized', '10', '2')], sharesBasis: '2025 staff survey (n=140)', distanceBasis: 'Survey medians by mode', activityOverlap: 'none_confirmed' }
const TELE = { carrier: 'electricity', zip: '94105', subregion: 'CAMX', utilityEiaId: null, baselineBasis: 'Incremental above the office baseline' }
const ASSET = { category: 8, carrier: 'electricity', assetLabel: 'Leased warehouse, Fresno', counterpartyName: 'Synthetic Landlord LP', leaseType: 'operating', noOperationalControlBasis: 'Landlord operates HVAC and metering.',
  zip: '93721', subregion: 'CAMX', utilityEiaId: null, refrigerantGas: null, allocation: null }
const GAS_ASSET = { ...ASSET, carrier: 'natural_gas', zip: null, subregion: null }
const PARTNER = { category: 13, counterpartyName: 'Synthetic Tenant Inc', scope2Basis: 'location', allocationBasis: 'area', allocationNumerator: '12000', allocationDenominator: '48000', leaseType: 'operating',
  noOperationalControlBasis: null, gwpBasis: 'AR5', verification: 'unverified', periodMatches: true, supersedesSpend: null }
const BUILDING = { category: 8, cbecsActivity: 'office', usesNaturalGas: 'yes', gridBasis: 'subregion', zip: '94105', subregion: 'CAMX', utilityEiaId: null, coveredDays: 365, leaseType: 'operating', noOperationalControlBasis: 'Shared building; landlord meters.' }
const SPEND = { category: 1, naicsCode: '541511', dollarYear: 2022, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: 'excludes_sales_tax',
  supplierName: 'Synthetic Freight Co', glAccount: '6100', description: 'Freight services', categoryConfirmed: true, activityOverlap: 'none_confirmed', importId: null, importRow: null,
  mappingSource: 'user', paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false }
const I05_KINDS = ['energy_resold', 'commuting_average', 'teleworking', 'asset_energy', 'partner_reported'] as const
const KNOWN_REASONS = new Set(['quantity_not_calculable', 'unit_not_an_engine_token', 'mode_not_an_engine_token', 'subregion_not_an_egrid_subregion', 'utility_eia_id_not_numeric',
  'location_inclusion_unknown', 'location_excluded_by_company_setup', 'record_withdrawn', ...Object.keys(SCOPE3_REASON_TEXT_I02), ...Object.keys(SCOPE3_REASON_TEXT_I03),
  ...Object.keys(SCOPE3_REASON_TEXT_I04), ...Object.keys(SCOPE3_REASON_TEXT_I05)])

describe('I-05: the contract equals the engine catalog (DESIGN §3.3, 8.3)', () => {
  test('commuting modes, sold fuels and gases (filled from R3), asset and partner categories, grid bases, units, eGRID subregions', () => {
    const c = engine({ action: 'catalog' }).catalog!
    expect(c.commutingAverageModes).toEqual([...SCOPE3_COMMUTING_AVG_MODES])
    expect(c.soldFuels).toEqual([...SCOPE3_SOLD_FUELS])
    expect(c.ghgGases).toEqual([...SCOPE3_GHG_GASES])
    expect([SCOPE3_SOLD_FUELS.length, SCOPE3_GHG_GASES.length]).toEqual([58, 62])
    expect([c.assetCategories, c.partnerCategories, c.gridBases]).toEqual([[...SCOPE3_ASSET_CATEGORIES], [...SCOPE3_PARTNER_CATEGORIES], [...SCOPE3_GRID_BASES]])
    expect([c.electricityUnits, c.teleworkingGasUnits, c.assetGasUnits, c.refrigerantUnits, c.partnerUnits]).toEqual([[...SCOPE3_UNIT_FAMILIES.electricity], [...SCOPE3_UNIT_FAMILIES.naturalGas],
      [...SCOPE3_UNIT_FAMILIES.assetNaturalGas], [...SCOPE3_UNIT_FAMILIES.refrigerant], [...SCOPE3_UNIT_FAMILIES.supplierAllocated]])
    expect(Object.keys(c.subregionInterconnect).sort()).toEqual([...ENGINE_SUBREGIONS].sort())
  }, TIMEOUT)
})

describe('I-05: every valid shared fixture and 300+ random records per kind reach the engine or are held (DESIGN 8.3)', () => {
  test('the shared payload fixtures of the five kinds, under each consolidation approach: calculated and accepted, or held with a named reason', () => {
    for (const approach of ['operational_control', 'financial_control', 'equity_share', null] as const) {
      const fixtures = SCOPE3_PAYLOAD_FIXTURES.filter(f => f.valid && (I05_KINDS as readonly string[]).includes(f.kind))
      const plans = fixtures.map(f => plan(record(f.kind, f.quantity, f.payload), { consolidationApproach: approach }))
      const calculated = plans.filter(p => p.action === 'calculate')
      const out = runAll(calculated)
      out.forEach((item, i) => expect([calculated[i]!.kind, item.status, item.code ?? null]).toEqual([calculated[i]!.kind, 'ok', null]))
      for (const p of plans.filter(x => x.action === 'hold')) {
        expect([p.status, p.reasons.length > 0, p.reasons.includes('method_not_built_yet')]).toEqual(['input_needed', true, false])
        for (const reason of p.reasons) expect([reason, KNOWN_REASONS.has(reason)]).toEqual([reason, true])
      }
      expect(calculated.length).toBeGreaterThan(20)
    }
  }, TIMEOUT)

  test('fuzz: 320 records of each kind with junk, blanks and unknowns; the boundary verifies the lot with random annotations', async () => {
    let seed = 20261031
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!
    const amounts = ['0', '1', '12.5', '999999999999.999', '0.001', '', 'unknown', '1,200', '-3', '48000', '125000.5']
    const subs = [...ENGINE_SUBREGIONS, 'XXXX', '']
    const zips = ['94105', '93721', '10001', '75201', '43215', '00000', '99999']
    const dq = () => next() < 0.3 ? { dataQuality: { indicators: { technological: pick([null, 'poor', 'good']), temporal: null, geographical: null, completeness: null, reliability: pick([null, 'very_good', 'fair']) },
      activityDataOrigin: pick([null, 'value_chain_partner', 'estimate', 'company_records']), basis: null } } : {}
    const loc = () => ({ zip: pick(zips), subregion: pick(subs), utilityEiaId: pick([null, null, '', '14328', '4065', 'ABC', '16612']) })
    const none = { zip: null, subregion: null, utilityEiaId: null }
    const versions: Scope3CollectionVersion[] = []
    for (let i = 0; i < 320; i++) {
      const extra = { locationId: pick([office, office, office, warehouse]) }
      const amt = pick(amounts)
      const us = next() < 0.3
      versions.push(record('energy_resold', qk('energy_resold', amt, pick(['kWh', 'MWh', 'GWh'])), { gridBasis: us ? 'us_average' : 'subregion', ...(us ? none : loc()), resoldEnergyNotInScope2: next() < 0.8, ...dq() }, extra))
      // Half the profiles are clean (listed modes, shares adding up to 100, occupancy only on vehicles); the rest are random.
      const clean = next() < 0.5, count = 1 + Math.floor(next() * 4)
      const shares = ({ 1: ['100'], 2: ['60', '40'], 3: ['33.333', '33.333', '33.334'], 4: ['10', '20', '30', '40'] } as Record<number, string[]>)[count]!
      const modes = Array.from({ length: count }, (_, k) => {
        const m = clean ? pick(SCOPE3_COMMUTING_AVG_MODES) : pick([...SCOPE3_COMMUTING_AVG_MODES, 'e-scooter'])
        const vehicle = (SCOPE3_TRAVEL_MODES as Record<string, string>)[m] === 'vehicle'
        return mode(m, clean ? shares[k]! : pick(['10', '25', '33.333', '50', '100', '120', '0']), pick(['0', '2', '12.5', '40']),
          clean && !vehicle ? null : next() < 0.5 ? null : pick(['1', '1.2', '2.5']), pick(['mile', 'km']))
      })
      versions.push(record('commuting_average', qk('commuting_average', clean ? pick(['1', '180', '10000', '12.5']) : pick(['1', '180', '10000', '12.5', 'unknown']), clean ? 'employee' : pick(['employee', 'employee', 'person'])),
        { ...COMMUTE, workingDays: 1 + Math.floor(next() * 366), modes, activityOverlap: clean ? 'none_confirmed' : pick(['none_confirmed', 'unknown']), ...dq() }, clean ? {} : extra))
      const elec = next() < 0.5
      versions.push(record('teleworking', qk('teleworking', amt, elec ? pick(['kWh', 'MWh', 'therm']) : pick(['therm', 'MMBtu', 'scf', 'kWh'])), { ...TELE, carrier: elec ? 'electricity' : 'natural_gas', ...(elec ? loc() : none), ...dq() }, extra))
      const carrier = pick(['electricity', 'natural_gas', 'refrigerant'] as const)
      const units = { electricity: ['kWh', 'MWh', 'therm'], natural_gas: ['therm', 'MMBtu', 'scf', 'ccf', 'mcf', 'kWh'], refrigerant: ['kg', 'lb', 'therm'] }[carrier]
      const lease = pick(['operating', 'finance', null] as const)
      versions.push(record('asset_energy', qk('asset_energy', amt, pick(units)), { ...ASSET, category: pick(SCOPE3_ASSET_CATEGORIES), carrier, ...(carrier === 'electricity' ? loc() : none),
        refrigerantGas: carrier === 'refrigerant' ? pick(['R-410A', 'HFC-134a', 'R-406A', 'HCFC-22', 'SF6', '']) : null, leaseType: lease, noOperationalControlBasis: pick([null, '', 'Landlord operates it.']),
        allocation: next() < 0.5 ? null : { reportingArea: pick(['0', '200', '12000', '50000']), buildingArea: pick(['0', '2000', '48000']), occupancyPercent: pick(['0', '75', '95', '100', '150']), areaUnit: pick(['sqft', 'm2']) },
        ...dq() }, extra))
      const exclusive = next() < 0.3
      versions.push(record('partner_reported', qk('partner_reported', amt, pick(['kg CO2e', 'metric_ton CO2e', 'kg'])), { ...PARTNER, category: pick(SCOPE3_PARTNER_CATEGORIES), allocationBasis: exclusive ? 'exclusive' : pick(['area', 'mass', 'revenue', 'other']),
        allocationNumerator: exclusive ? null : pick(['0', '1', '5000', '20000']), allocationDenominator: exclusive ? null : pick(['0', '15000', '48000']), leaseType: lease,
        noOperationalControlBasis: pick([null, 'Partner operates it.']), scope2Basis: pick(['location', 'market', 'unknown']), gwpBasis: pick(['AR4', 'AR5', 'AR6', 'unknown']),
        verification: pick(['third_party_verified', 'unverified']), periodMatches: next() < 0.85, ...dq() }, extra))
    }
    const plans = versions.map(v => plan(v, { consolidationApproach: pick(['operational_control', 'financial_control', 'equity_share', null, 'unknown'] as const), distanceCommutingPeriods: next() < 0.5 ? [year] : [] }))
    const calculated = plans.filter(p => p.action === 'calculate')
    const held = plans.filter(p => p.action === 'hold')
    const out = runAll(calculated)
    out.forEach((item, i) => expect([calculated[i]!.kind, item.status, item.code ?? null]).toEqual([calculated[i]!.kind, 'ok', null]))
    for (const p of held) for (const reason of p.reasons) expect([reason, KNOWN_REASONS.has(reason)]).toEqual([reason, true])
    const byKind = (kind: string) => calculated.filter(p => p.kind === kind).length
    for (const kind of I05_KINDS) expect([kind, byKind(kind) > 25]).toEqual([kind, true])
    const results = out.map(item => item.result!)
    const annotationOf = (p: Scope3CalculationPlan): Scope3Annotation => {
      const dqv = (p.payload as { dataQuality?: { indicators: Scope3Annotation['dataQuality']; activityDataOrigin: Scope3Annotation['activityDataOrigin'] } | null }).dataQuality
      return dqv ? { dataQuality: dqv.indicators, activityDataOrigin: dqv.activityDataOrigin } : { dataQuality: null, activityDataOrigin: null }
    }
    const rows: Scope3CoverageRecord[] = plans.map(p => {
      const i = calculated.indexOf(p)
      return { recordId: p.recordId, category: p.category, quality: 'actual', kind: p.kind, result: i >= 0 ? { outcome: 'calculated', resultSha256: results[i]!.resultSha256 } : { outcome: 'held', status: p.status as 'input_needed', reasons: p.reasons } }
    })
    const coverage = await scope3Coverage(rows, [], results, realEngine, pins, calculated.map(annotationOf))
    expect(coverage.categories.reduce((sum, row) => sum + row.counts.records, 0)).toBe(1600)
    for (const code of coverage.disclosures.map(d => d.code)) expect([code, typeof SCOPE3_DISCLOSURE_TEXT[code]]).toEqual([code, 'string'])
    // Every partial result carries a listed partial note (A26), and no complete result that meets the boundary carries one.
    for (const r of results.filter(x => x.status === 'complete')) expect([r.methodVersionId, r.boundary.minimumBoundary === 'partial', r.boundary.notes.some(x => SCOPE3_PARTIAL_BOUNDARY_NOTES.includes(x))])
      .toEqual([r.methodVersionId, r.boundary.minimumBoundary === 'partial', r.boundary.minimumBoundary === 'partial'])
    console.log(`I-05 fuzz: ${I05_KINDS.map(k => `${byKind(k)} ${k}`).join(', ')} calculated by the engine; ${held.length} held with a named reason; 0 refused; all verified`)
  }, FUZZ_TIMEOUT)
})

describe('I-05: holds before the engine (DESIGN §5.1)', () => {
  test('every hold of the five kinds, one at a time, with its own reason and no engine call', () => {
    const cases: Array<[string, Scope3CollectionVersion, string[], Scope3PlanOptions?]> = [
      ['3D not kept out of Scope 2', record('energy_resold', q('10', 'MWh'), { ...RESOLD, resoldEnergyNotInScope2: false }), ['resold_energy_in_scope2_not_confirmed']],
      ['3D unit as written', record('energy_resold', q('10', 'GWh', false), RESOLD), ['quantity_not_calculable', 'unit_not_an_engine_token']],
      ['3D blank subregion', record('energy_resold', q('10', 'MWh'), { ...RESOLD, subregion: '' }), ['subregion_not_an_egrid_subregion']],
      ['3D utility as text', record('energy_resold', q('10', 'MWh'), { ...RESOLD, utilityEiaId: 'PG&E' }), ['utility_eia_id_not_numeric']],
      ['commuting unit person', record('commuting_average', q('180', 'person', false), COMMUTE), ['quantity_not_calculable', 'unit_not_an_engine_token']],
      ['commuting unknown mode', record('commuting_average', q('180', 'employee'), { ...COMMUTE, modes: [mode('e-scooter', '100', '2')] }), ['mode_not_an_engine_token']],
      ['commuting occupancy on a bus', record('commuting_average', q('180', 'employee'), { ...COMMUTE, modes: [mode('bus', '100', '8', '2')] }), ['occupancy_not_applicable_to_mode']],
      ['commuting occupancy on walking', record('commuting_average', q('180', 'employee'), { ...COMMUTE, modes: [mode('non_motorized', '100', '1', '1')] }), ['occupancy_not_applicable_to_mode']],
      ['commuting share above 100', record('commuting_average', q('180', 'employee'), { ...COMMUTE, modes: [mode('bus', '120', '8')] }), ['mode_shares_must_total_100']],
      ['commuting overlap unknown with distance records', record('commuting_average', q('180', 'employee'), { ...COMMUTE, activityOverlap: 'unknown' }), ['commuting_overlap_not_confirmed'], { distanceCommutingPeriods: [{ start: '2025-06-01', endExclusive: '2025-07-01' }] }],
      ['teleworking gas in kWh', record('teleworking', q('100', 'kWh'), { ...TELE, carrier: 'natural_gas', zip: null, subregion: null }), ['unit_not_an_engine_token']],
      ['teleworking unknown subregion', record('teleworking', q('100', 'kWh'), { ...TELE, subregion: 'XXXX' }), ['subregion_not_an_egrid_subregion']],
      ['asset refrigerant not in the GWP tables', record('asset_energy', q('3', 'kg'), { ...GAS_ASSET, category: 14, carrier: 'refrigerant', refrigerantGas: 'HCFC-22', leaseType: null }), ['refrigerant_not_an_engine_token']],
      ['asset gas in kWh', record('asset_energy', q('3', 'kWh'), { ...GAS_ASSET, category: 10, leaseType: null }), ['unit_not_an_engine_token']],
      ['asset occupancy above 100', record('asset_energy', q('3', 'therm'), { ...GAS_ASSET, category: 14, leaseType: null, allocation: { reportingArea: '1', buildingArea: '2', occupancyPercent: '100.5', areaUnit: 'sqft' } }), ['occupancy_percent_over_100']],
      ['asset category 8 without a lease type', record('asset_energy', q('3', 'kWh'), { ...ASSET, leaseType: null }), ['lease_type_required'], OPS],
      ['partner unit kg', record('partner_reported', q('3', 'kg', false), PARTNER), ['quantity_not_calculable', 'unit_not_an_engine_token'], OPS],
      ['partner category 13 without a lease type', record('partner_reported', q('3', 'kg CO2e'), { ...PARTNER, leaseType: null }), ['lease_type_required'], OPS],
    ]
    for (const [label, v, reasons, options] of cases) {
      const p = plan(v, options)
      expect([label, p.action, p.status, p.reasons, p.call]).toEqual([label, 'hold', 'input_needed', reasons, null])
      for (const reason of reasons) expect([reason, KNOWN_REASONS.has(reason)]).toEqual([reason, true])
    }
    // Overlap: confirmed, no overlapping distance record, or not known to the caller -> no hold.
    for (const options of [{ distanceCommutingPeriods: [] }, { distanceCommutingPeriods: [{ start: '2024-01-01', endExclusive: '2025-01-01' }] }, {}] as Scope3PlanOptions[])
      expect(plan(record('commuting_average', q('180', 'employee'), { ...COMMUTE, activityOverlap: 'unknown' }), options).action).toBe('calculate')
    expect(plan(record('commuting_average', q('180', 'employee'), COMMUTE), { distanceCommutingPeriods: [year] }).action).toBe('calculate')
  })

  test('A15: the lease boundary by consolidation approach (Scope 3 Standard Tables A.1 and A.2), table-driven for asset energy, partner figures and buildings', () => {
    // [category, lease, basis given, approach] -> reasons
    const lessee = { operational_control: ['lease_in_scope1_2_under_boundary'], financial_control: [], equity_share: [] } as Record<string, string[]>
    const lessor = { operational_control: [], financial_control: ['lessor_operating_lease_in_scope1_2'], equity_share: ['lessor_operating_lease_in_scope1_2'] } as Record<string, string[]>
    const expected = (category: 8 | 13, lease: 'operating' | 'finance', basis: boolean, approach: string | null | undefined): string[] => {
      if (category === 8 && lease === 'finance') return ['finance_lease_in_scope1_2']
      if (lease === 'finance' || approach === undefined) return []
      if (approach === null || approach === 'unknown') return ['consolidation_approach_required']
      if (category === 8) return basis ? [] : lessee[approach]!
      return lessor[approach]!
    }
    let checked = 0
    for (const category of [8, 13] as const) for (const lease of ['operating', 'finance'] as const) for (const basis of [false, true])
      for (const approach of ['operational_control', 'financial_control', 'equity_share', 'unknown', null, undefined] as const) {
        const noControl = basis ? 'The landlord operates and meters the building.' : pick(['', null])
        const versions = [record('asset_energy', q('100', 'kWh'), { ...ASSET, category, leaseType: lease, noOperationalControlBasis: noControl }),
          record('partner_reported', q('100', 'kg CO2e'), { ...PARTNER, category, leaseType: lease, noOperationalControlBasis: noControl })]
        for (const v of versions) {
          const p = plan(v, approach === undefined ? {} : { consolidationApproach: approach })
          expect([v.activity.kind, category, lease, basis, approach ?? 'not known', p.reasons]).toEqual([v.activity.kind, category, lease, basis, approach ?? 'not known', expected(category, lease, basis, approach)])
          checked++
        }
        const b = plan(record('building_average', q('100', 'sqft'), { ...BUILDING, category, leaseType: lease, noOperationalControlBasis: noControl }),
          { ...(approach === undefined ? {} : { consolidationApproach: approach }), lateSources: { usUpstream2025: true, usBuildingHotel2025: false } })  // I-12h: the I-05 rule with R6 off
        const reasons = expected(category, lease, basis, approach)
        expect([category, lease, basis, approach ?? 'not known', b.status, b.reasons]).toEqual([category, lease, basis, approach ?? 'not known', reasons.length ? 'input_needed' : 'method_pending', reasons.length ? reasons : ['factor_source_not_yet_loaded']])
      }
    expect(checked).toBe(96)
    // Categories 4, 9, 10 and 14 carry no lease rule.
    for (const category of [4, 9, 10, 14]) expect(plan(record('asset_energy', q('100', 'kWh'), { ...ASSET, category, leaseType: null }), OPS).action).toBe('calculate')
    function pick<T>(items: readonly T[]) { return items[checked % items.length]! }
  })
})

describe('I-05: late factor sources are method_pending, never sent (DESIGN A6, A14, A27, A28)', () => {
  // I-12h: R6 is loaded (SCOPE3_LATE_SOURCES.usBuildingHotel2025), so these I-05 rules are checked with the flag off; the loaded
  // behaviour is tested in scope3-collection-hotel-building.test.ts.
  const UNLOADED: Scope3PlanOptions = { lateSources: { usUpstream2025: true, usBuildingHotel2025: false } }
  test('hotel stays: records saved before 0030 (mode "hotel", room-nights as written) and v2 stays wait as optional lines, no re-save; the spend route stays available', () => {
    const legacy = record('business_travel', q('10', 'room-night', false), { mode: 'hotel', passengerSegments: null, haulBasis: null })
    const v2 = record('business_travel', q('3', 'room-night'), { mode: 'hotel_stay', passengerSegments: null, haulBasis: null, cabinClass: null, hotelCountry: 'US' })
    for (const v of [legacy, v2]) {
      const p = plan(v, UNLOADED)
      // hotel_stay is a derived kind (0030 contract): its line derives from the business travel record itself, so the
      // results v2 decoder's derived-line identity (same record ID, derivedFrom set) holds for it.
      expect([p.kind, p.category, p.action, p.status, p.optional, p.reasons, p.call, p.derivedFrom]).toEqual(['hotel_stay', 6, 'hold', 'method_pending', true, ['factor_source_not_yet_loaded'], null, { recordId: v.recordId, kind: 'business_travel' }])
    }
    // The r3 feeds' saved hotel record is exactly the legacy shape (scope3-payload-fixtures.ts).
    const r3 = SCOPE3_PAYLOAD_FIXTURES.find(f => f.label === 'business_travel: 0029 hotel record as saved by the r3 feeds (room-night not normalized)')!
    expect(plan(record('business_travel', r3.quantity, r3.payload), UNLOADED).status).toBe('method_pending')
    for (const alias of SCOPE3_HOTEL_MODE_ALIASES) expect(scope3IsHotelMode(` ${alias.toUpperCase()} `)).toBe(true)
    expect(scope3IsHotelMode('hostel')).toBe(false)
    // Something a hotel stay can't be calculated from is input needed, not pending.
    expect(plan(record('business_travel', q('10', 'night', false), { mode: 'Hotel nights', passengerSegments: null, haulBasis: null }), UNLOADED).reasons).toEqual(['unit_not_an_engine_token'])
    expect(plan(record('business_travel', q('ten', 'room-night', false), { mode: 'hotel', passengerSegments: null, haulBasis: null }), UNLOADED).reasons).toEqual(['quantity_not_calculable'])
    // I-12h: with R6 loaded the hotel stay calculates when its country is known (the legacy record's location country is not known here).
    expect(plan(legacy).reasons).toEqual(['hotel_country_required'])
    expect(plan(v2).action).toBe('calculate')
    // Hotel spend (NAICS 721110) is the category 6 spend route, calculated now.
    const hotelSpend = record('purchase_spend', q('2400', 'USD'), { ...SPEND, category: 6, naicsCode: '721110', categoryConfirmed: false })
    expect(plan(hotelSpend).action).toBe('calculate')
  })

  test('buildings by floor area wait for CBECS (not optional); what the user can fix is held first', () => {
    const p = plan(record('building_average', q('12000', 'sqft'), BUILDING), { ...OPS, ...UNLOADED })
    expect([p.kind, p.status, p.optional, p.reasons, p.call]).toEqual(['building_average', 'method_pending', undefined, ['factor_source_not_yet_loaded'], null])
    expect(plan(record('building_average', q('1', 'sqft'), { ...BUILDING, cbecsActivity: 'data_center' }), OPS).reasons).toEqual(['cbecs_activity_not_an_engine_token'])
    expect(plan(record('building_average', q('1', 'acre', false), BUILDING), OPS).reasons).toEqual(['quantity_not_calculable', 'unit_not_an_engine_token'])
    // I-12h: with R6 loaded the building calculates.
    expect(plan(record('building_average', q('1', 'sqft'), BUILDING), OPS).action).toBe('calculate')
  })

  test('the 3D upstream line follows its record: calculated from the 3D input when the record calculates (I-12u), held with its reasons otherwise', () => {
    const ok = record('energy_resold', q('1200.5', 'MWh'), RESOLD)
    const line = planEnergyResoldUpstream(ok, context, [])
    const own = plan(ok)
    expect([line.recordId, line.kind, line.category, line.derivedFrom, line.status, line.reasons, line.action]).toEqual([ok.recordId, 'energy_resold_upstream', 3, { recordId: ok.recordId, kind: 'energy_resold' }, null, [], 'calculate'])
    expect(line.call).toEqual({ engine: 'scope3', request: { kind: 'energy_resold_upstream', input: own.call!.request.input } })
    // Before R5 (DESIGN 13.3 flag off) it waited for its factor source.
    expect([planEnergyResoldUpstream(ok, context, [], { lateSources: { usUpstream2025: false, usBuildingHotel2025: false } }).status, planEnergyResoldUpstream(ok, context, [], { lateSources: { usUpstream2025: false, usBuildingHotel2025: false } }).reasons]).toEqual(['method_pending', ['factor_source_not_yet_loaded']])
    expect(line.optional).toBeUndefined()
    const unconfirmed = planEnergyResoldUpstream(record('energy_resold', q('1', 'MWh'), { ...RESOLD, resoldEnergyNotInScope2: false }), context, [])
    expect([unconfirmed.status, unconfirmed.reasons]).toEqual(['input_needed', ['energy_resold_record_held', 'resold_energy_in_scope2_not_confirmed']])
    const gone = planEnergyResoldUpstream(record('energy_resold', q('1', 'MWh'), RESOLD, { state: 'withdrawn', withdrawalReason: 'Entered twice' }), context, [])
    expect([gone.status, gone.reasons]).toEqual(['withdrawn', ['record_withdrawn']])
    const excluded = planEnergyResoldUpstream(record('energy_resold', q('1', 'MWh'), RESOLD, { locationId: warehouse }), context, [])
    expect([excluded.status, excluded.reasons]).toEqual(['excluded', ['location_excluded_by_company_setup']])
    expect(() => planEnergyResoldUpstream(record('teleworking', q('1', 'kWh'), TELE), context, [])).toThrow('energy-resold')
  })
})

describe('I-05: partner supersession and the commuting facts (DESIGN §5.1, A22, B5)', () => {
  const supersede = (versions: Scope3CollectionVersion[]) => planScope3Supersession(versions, context, { reportingPeriod: year, sha256 })
  test('a partner record replaces the spend lines that name it in categories 1 and 2 and, for carriers, warehouses and waste contractors, its own spend category', () => {
    const freightPartner = record('partner_reported', q('8200', 'kg CO2e'), { ...PARTNER, category: 4, leaseType: null, supersedesSpend: { supplierName: ' synthetic   FREIGHT co ', mappingKeys: [] } })
    const landlord = record('partner_reported', q('1', 'kg CO2e'), { ...PARTNER, category: 8, leaseType: 'operating', noOperationalControlBasis: 'Landlord meters.', supersedesSpend: { supplierName: 'Synthetic Landlord LP', mappingKeys: [] } })
    const cat1 = record('purchase_spend', q('100', 'USD'), SPEND)
    const cat4 = record('purchase_spend', q('100', 'USD'), { ...SPEND, category: 4, naicsCode: '484121' })
    const cat6 = record('purchase_spend', q('100', 'USD'), { ...SPEND, category: 6, naicsCode: '481111' })
    const rent4 = record('purchase_spend', q('100', 'USD'), { ...SPEND, category: 4, naicsCode: '493110', supplierName: 'Synthetic Landlord LP' })
    const rent1 = record('purchase_spend', q('100', 'USD'), { ...SPEND, naicsCode: '531120', supplierName: 'Synthetic Landlord LP' })
    const keyed = record('purchase_spend', q('100', 'USD'), { ...SPEND, category: 5, naicsCode: '562111', supplierName: 'Other hauler', glAccount: '7700', description: 'Hauling' })
    const hauler = record('partner_reported', q('3.1', 'metric_ton CO2e'), { ...PARTNER, category: 5, allocationBasis: 'exclusive', allocationNumerator: null, allocationDenominator: null, leaseType: null,
      supersedesSpend: { supplierName: 'Synthetic Hauling', mappingKeys: [sha256(scope3SpendMappingKeyInput({ glAccount: '7700', supplierName: 'Other hauler', description: 'Hauling' }))] } })
    const map = supersede([freightPartner, landlord, hauler, cat1, cat4, cat6, rent4, rent1, keyed])
    expect([...map.entries()].sort() as string[][]).toEqual([[cat1.recordId, freightPartner.recordId], [cat4.recordId, freightPartner.recordId], [keyed.recordId, hauler.recordId], [rent1.recordId, landlord.recordId]].sort())
    const p = plan(cat4, { supersession: map })
    expect([p.status, p.reasons, p.notes]).toEqual(['excluded', ['superseded_by_supplier_record'], ['spend_tax_treatment_excludes_sales_tax', `superseded_by:${freightPartner.recordId}`]])
    // A withdrawn partner record supersedes nothing.
    const withdrawn = record('partner_reported', q('8200', 'kg CO2e'), { ...PARTNER, category: 4, leaseType: null, supersedesSpend: { supplierName: 'Synthetic Freight Co', mappingKeys: [] } }, { state: 'withdrawn', withdrawalReason: 'x' })
    expect(supersede([withdrawn, cat4]).size).toBe(0)
  })

  test('distance commuting periods: active records at included locations inside the reporting period only', () => {
    const commute = (extra: Record<string, unknown> = {}) => record('employee_commuting', q('1000', 'vehicle-mile'), { mode: 'passenger_car' }, extra)
    const periods = scope3DistanceCommutingPeriods([commute(), commute({ state: 'withdrawn', withdrawalReason: 'x' }), commute({ locationId: warehouse }),
      commute({ period: { start: '2025-03-01', endExclusive: '2025-04-01' } }), record('commuting_average', q('1', 'employee'), COMMUTE)], context, { reportingPeriod: year })
    expect(periods).toEqual([year, { start: '2025-03-01', endExclusive: '2025-04-01' }])
  })
})

describe('I-05: the trusted boundary (DESIGN 4.6, 5.2)', () => {
  const calc = (plans: Scope3CalculationPlan[]) => runAll(plans).map(item => item.result!)
  test('the three new profile keys are verified: genuine output passes, every tampered value is refused', async () => {
    const versions = [record('purchase_spend', q('10000', 'USD'), { ...SPEND, naicsCode: '541511', dollarYear: 2024 }), record('purchase_spend', q('5000', 'USD'), { ...SPEND, naicsCode: '541511' }),
      record('partner_reported', q('9000', 'kg CO2e'), { ...PARTNER, leaseType: 'finance' }), record('asset_energy', q('4000', 'kWh'), { ...ASSET, category: 10, leaseType: null })]
    const plans = versions.map(v => plan(v, OPS))
    const results = calc(plans)
    const rows: Scope3CoverageRecord[] = plans.map((p, i) => ({ recordId: p.recordId, category: p.category, quality: 'actual', kind: p.kind, result: { outcome: 'calculated', resultSha256: results[i]!.resultSha256 } }))
    await scope3Coverage(rows, [], results, realEngine, pins)
    const genuine = await realEngine.aggregate(results)
    expect([genuine.categoryProfiles['1']!.deflationEffect !== null, genuine.categoryProfiles['13']!.deflationEffect, genuine.categoryProfiles['10']!.largestResultShare]).toEqual([true, null, { value: '100', display: '100.0' }])
    const tamper = (change: (a: Scope3EngineAggregate) => void) => {
      const a = structuredClone(genuine)
      change(a)
      const { aggregateSha256: _, ...body } = a
      a.aggregateSha256 = createHash('sha256').update(canonical(body), 'utf8').digest('hex')
      return scope3Coverage(rows, [], results, { aggregate: async () => a }, pins)
    }
    const probes: Array<[string, (a: Scope3EngineAggregate) => void, string]> = [
      ['deflation effect changed', a => { a.categoryProfiles['1']!.deflationEffect!.unrounded = '1' }, 'deflation effect'],
      ['deflation effect on a category without spend', a => { a.categoryProfiles['13']!.deflationEffect = genuine.categoryProfiles['1']!.deflationEffect }, 'deflation effect'],
      ['deflation effect removed', a => { a.categoryProfiles['1']!.deflationEffect = null }, 'deflation effect'],
      ['share of the known total missing', a => { delete (a.categoryProfiles['1'] as Partial<typeof a.categoryProfiles['1']>).shareOfKnownTotal }, 'profile shape|only some of the deflation and share keys'],
      ['share of the known total over 100', a => { a.categoryProfiles['1']!.shareOfKnownTotal = { value: '150', display: '150.0' } }, 'share of the known-source total'],
      ['largest share null for a non-zero category', a => { a.categoryProfiles['10']!.largestResultShare = null }, 'largest result share|largest-result share'],
      ['largest share with two decimals', a => { a.categoryProfiles['10']!.largestResultShare = { value: '100', display: '100.00' } }, 'largest result share|largest-result share'],
    ]
    for (const [label, change, reason] of probes) {
      let message = 'accepted'
      try { await tamper(change) } catch (error) { message = (error as Error).message }
      // Each probe names its refusal; alternatives (|) are the wording of the I-06 boundary rule that replaces this lane's at the pair merge.
      expect([label, message.startsWith('Scope 3 engine output refused') && reason.split('|').some(r => message.includes(r))]).toEqual([label, true])
    }
  }, TIMEOUT)

  test('a record and its derived 3D upstream line count as two lines; the same line twice is refused', async () => {
    const resold = record('energy_resold', q('10', 'MWh'), RESOLD)
    const p = plan(resold)
    const results = calc([p])
    const own: Scope3CoverageRecord = { recordId: resold.recordId, category: 3, quality: 'actual', kind: 'energy_resold', result: { outcome: 'calculated', resultSha256: results[0]!.resultSha256 } }
    const up: Scope3CoverageRecord = { recordId: resold.recordId, category: 3, quality: 'actual', kind: 'energy_resold_upstream', result: { outcome: 'held', status: 'method_pending', reasons: ['factor_source_not_yet_loaded'], optional: false } }
    const coverage = await scope3Coverage([own, up], [{ category: 3, decision: 'included', reason: null }], results, realEngine, pins)
    const row = coverage.categories[2]!
    expect([row.status, row.counts.records, row.counts.partialBoundary, row.counts.methodPending]).toEqual(['awaiting_factor_source', 2, 1, 1])
    expect(row.disclosures).toEqual(expect.arrayContaining(['upstream_of_resold_energy_excluded', 'location_based_grid_rates']))
    await expect(scope3Coverage([own, up, up], [], results, realEngine, pins)).rejects.toThrow('appears more than once')
    await expect(scope3Coverage([own, { ...own, kind: 'energy_resold' }], [], [...results, ...results], realEngine, pins)).rejects.toThrow('appears more than once')
  }, TIMEOUT)
})

/** The engine's canonical JSON (keys sorted, no spaces). */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
}
