// Methods v7 (collection review C08): every contract-valid collection record either reaches a reviewed engine and is
// accepted, or is held here with a named reason. Nothing is refused, rounded or invented. Runs the real engines.
import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { validateCollectionActivity, type CollectionActivity, type CollectionActivityVersion, type CollectionContext, type CollectionEvidenceMetadata } from './collection-contract'
import { ENGINE_FIRST_FACTOR_YEAR, ENGINE_MILES_BASES, ENGINE_MPG_SOURCES, ENGINE_SUBREGIONS, ENGINE_VEHICLE_TYPES, planCollectionCalculation, type CollectionEngineCall } from './collection-engine-input'

const CALC = (f: string) => fileURLToPath(new URL(`../../../apps/site-api/src/calculation/${f}`, import.meta.url))
const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
function engine(file: string, payload: unknown) {
  const p = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', CALC(file)], { stdin: new TextEncoder().encode(JSON.stringify(payload)), env })
  return JSON.parse(p.stdout.toString()) as { status: string; code?: string; result?: Record<string, any>; lookup?: unknown }
}
const run = (call: CollectionEngineCall) => call.engine === 'scope1' ? engine('scope1_engine.py', { action: 'calculate', request: call.request }) : engine('scope2_engine.py', { action: 'calculate', input: call.input })

const company = '71000000-0000-4000-8000-000000000001', setup = '71000000-0000-4000-8000-000000000002'
const office = '71000000-0000-4000-8000-000000000003', warehouse = '71000000-0000-4000-8000-000000000004', undecided = '71000000-0000-4000-8000-000000000005'
const clean = '71000000-0000-4000-8000-0000000000c1', pending = '71000000-0000-4000-8000-0000000000c2', rejected = '71000000-0000-4000-8000-0000000000c3'
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, locations: [
  { id: office, name: 'Office', inclusion: 'included', control: 'reporting_company' },
  { id: warehouse, name: 'Warehouse', inclusion: 'excluded', control: 'landlord' },
  { id: undecided, name: 'Depot', inclusion: 'unknown', control: 'unknown' }] }
const file = (id: string, quarantineStatus: CollectionEvidenceMetadata['quarantineStatus']): CollectionEvidenceMetadata => ({ id, companyId: company, bucket: 'neuvetra-private-company-evidence',
  objectKey: `${company}/original/${id}`, originalName: 'bill.pdf', mediaType: 'application/pdf', byteLength: 100, sha256: 'a'.repeat(64), quarantineStatus, uploadedBy: company, createdAt: '2025-06-01T00:00:00.000Z' })
const evidence = [file(clean, 'clean'), file(pending, 'pending'), file(rejected, 'rejected')]

const common = { locationId: office, setupVersionId: setup, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null, reference: 'Synthetic source', notes: '', evidenceIds: [] as string[] }
// As the screen saves it: only a plain decimal in an engine unit is normalized; anything else stays original with null normalized fields.
const normalizes = (value: string, unit: string) => /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value) && ['therm', 'MMBtu', 'scf', 'ccf', 'mcf', 'US_gallon', 'kg', 'lb', 'kWh', 'MWh'].includes(unit)
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalizes(value, unit) ? value : null, normalizedUnit: normalizes(value, unit) ? unit : null })
const year = { start: '2025-01-01', endExclusive: '2026-01-01' }
function version(activity: Record<string, unknown>): CollectionActivityVersion {
  return { id: crypto.randomUUID(), recordId: crypto.randomUUID(), companyId: company, revision: 1, previousVersionId: null, correctionReason: null,
    activity: validateCollectionActivity({ ...common, period: year, ...activity }), payloadSha256: 'b'.repeat(64), createdBy: company, createdAt: '2025-06-01T00:00:00.000Z' }
}
const gas = (value: string, unit: string, heatContent: unknown = null, extra = {}) => version({ kind: 'natural_gas', sourceId: 'GAS-1', quantity: q(value, unit), payload: { heatContent }, ...extra })
const generator = (consumption: Record<string, string>, hhv: string | null = null) => version({ kind: 'distillate_no2', sourceId: 'GEN-1', quantity: q('', 'US_gallon'), payload: { consumption, statedHhvMmbtuPerGallon: hhv } })
const vehicle = (p: Record<string, unknown>) => version({ kind: 'vehicle', sourceId: 'VANS', quantity: q('', 'US_gallon'), payload: { vehicleGroupId: 'VANS', fuel: 'diesel', vehicleType: 'diesel_light_duty_truck', modelYear: 2020, gallons: '100', vehicleCount: null, miles: null, fuelEconomy: null, ...p } })
const refrigerant = (p: Record<string, unknown>) => version({ kind: 'fugitive', sourceId: 'RTU-1', quantity: q('', (p.unit as string | undefined) ?? 'kg'), payload: { gas: 'R-410A', unit: 'kg', terms: { PN: '0', CN: '0', PS: '2.5', CD: '0', RD: '0' }, insideBoundary: true, maintainsRefrigerantStock: false, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true, ...p } })
const instrument = (extra: Record<string, unknown> = {}) => ({ type: 'energy_attribute_certificate', mwh: '1', qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: clean, generationTechnology: 'wind', rateLbPerMwh: null, ...extra })
const electricity = (instruments: Record<string, unknown>[] = [], extra: Record<string, unknown> = {}, evidenceIds: string[] = [clean]) => version({ kind: 'electricity', sourceId: 'M-1', quantity: q('10000', 'kWh'), evidenceIds,
  period: { start: '2025-01-01', endExclusive: '2025-02-01' }, payload: { meterOrAccountNumber: 'M-1', utilityName: 'Synthetic', site: 'Office', zip: '94105', subregion: 'CAMX', utilityEiaId: null, instruments, ...extra } })

describe('collection -> engine input (methods v7, C08)', () => {
  test('token lists equal what the engines accept', () => {
    const script = ['import json,scope1_engine as a,scope2_engine as b', 'first={}',
      "for prefix,types in (('onroad_gasoline.',a.GASOLINE_TYPES),('onroad_diesel.',a.DIESEL_TYPES)):",
      "  for tok,label in types.items():",
      "    bands={k[len(prefix)+len(label)+1:].rsplit('.',1)[0] for k in a.require_register()['entries'] if k.startswith(prefix+label+'.')}",
      "    first[tok]=max(1960,min(a._band(x)[0] for x in bands))",
      'print(json.dumps({"g":sorted(a.GASOLINE_TYPES),"d":sorted(a.DIESEL_TYPES),"s":sorted(b.data()["subregions"]),"f":first}))'].join('\n')
    const python = Bun.spawnSync([process.env.NEUVETRA_PYTHON ?? 'python3', '-c', script], { cwd: CALC(''), env })
    const engineTokens = JSON.parse(python.stdout.toString())
    expect([engineTokens.g, engineTokens.d, engineTokens.s]).toEqual([[...ENGINE_VEHICLE_TYPES.gasoline].sort(), [...ENGINE_VEHICLE_TYPES.diesel].sort(), [...ENGINE_SUBREGIONS].sort()])
    // Every vehicle type whose first factor band starts after 1960 is in the adapter's table, with the same year.
    expect(Object.fromEntries(Object.entries(engineTokens.f as Record<string, number>).filter(([, y]) => y > 1960))).toEqual({ ...ENGINE_FIRST_FACTOR_YEAR })
    for (const basis of ENGINE_MILES_BASES) expect(run(planCollectionCalculation(vehicle({ miles: { value: '1000', basis } }), context, evidence).call!).status).toBe('ok')
    for (const source of ENGINE_MPG_SOURCES) expect(run(planCollectionCalculation(vehicle({ fuelEconomy: { mpg: '20', source } }), context, evidence).call!).status).toBe('ok')
    // Anything else would have been refused by the engine, so the adapter holds it.
    expect(engine('scope1_engine.py', { action: 'calculate', request: { kind: 'vehicle', input: { period: year, fuel: 'Diesel', vehicleType: 'diesel_light_duty_truck', modelYear: 2020, gallons: '1' } } }).code).toBe('unsupported_fuel')
    expect(engine('scope1_engine.py', { action: 'calculate', request: { kind: 'vehicle', input: { period: year, fuel: 'diesel', vehicleType: 'diesel_light_duty_truck', modelYear: 2020, gallons: '1', miles: { value: '1', basis: 'estimate' } } } }).code).toBe('invalid_miles_basis')
  })

  test('stored shapes that the engines refused directly are translated, not refused', () => {
    // The v6 engine-shape probe cases (collection review C08), now through the adapter.
    const cases = [gas('10', 'therm'), vehicle({}), generator({ basis: 'measured', gallons: '100' }), refrigerant({}),
      electricity([instrument({ evidenceReference: null })], {}, []), electricity([instrument({ generationTechnology: 'natural_gas', rateLbPerMwh: { co2: '900', ch4: null, n2o: null } })])]
    const statuses = cases.map(v => { const plan = planCollectionCalculation(v, context, evidence); expect(plan.action).toBe('calculate'); return run(plan.call!).status })
    expect(statuses).toEqual(Array(cases.length).fill('ok'))
    const noEvidence = run(planCollectionCalculation(electricity([instrument({ evidenceReference: null })], {}, []), context, evidence).call!).result!
    expect([noEvidence.locationBased.status, noEvidence.marketBased.status, noEvidence.marketBased.findings]).toEqual(['complete', 'input_needed', ['instrument_evidence_required']])
  })

  test('a blank instrument MWh keeps the location-based result (engine v3)', () => {
    const r = run(planCollectionCalculation(electricity([instrument({ mwh: '' })]), context, evidence).call!).result!
    expect([r.locationBased.status, r.locationBased.total.display, r.marketBased.status, r.marketBased.findings, r.marketBased.total]).toEqual(['complete', r.locationBased.total.display, 'input_needed', ['instrument_mwh_required'], null])
    expect(r.locationBased.total).not.toBeNull()
    const typo = run(planCollectionCalculation(electricity([instrument({ generationTechnology: 'natural_gas', rateLbPerMwh: { co2: '9,00', ch4: null, n2o: null } })]), context, evidence).call!).result!
    expect([typo.locationBased.status, typo.marketBased.findings]).toEqual(['complete', ['instrument_rate_not_numeric']])
  })

  test('holds with a named reason instead of sending what the engine would refuse', () => {
    const held = (v: CollectionActivityVersion) => { const p = planCollectionCalculation(v, context, evidence); expect(p.call).toBeNull(); return [p.status, p.reasons] }
    expect(held(gas('1,234.5', 'therm'))).toEqual(['input_needed', ['quantity_not_calculable']])
    expect(held(gas('10', 'ccf', { value: 'about 1', unit: 'therm per ccf' }))).toEqual(['input_needed', ['heat_content_not_numeric']])
    expect(held(generator({ basis: 'purchases_with_tank_levels', purchasedGallons: '100', openingGallons: 'unknown', closingGallons: '' }))).toEqual(['input_needed', ['opening_gallons_not_numeric', 'closing_gallons_not_numeric']])
    expect(held(vehicle({ fuel: 'Diesel', vehicleType: 'Light-Duty Trucks' }))).toEqual(['input_needed', ['fuel_not_an_engine_token', 'vehicle_type_not_an_engine_token']])
    expect(held(vehicle({ modelYear: 1955, miles: { value: '10', basis: 'odometer' }, fuelEconomy: { mpg: '20', source: 'vehicle_record' } }))).toEqual(['input_needed', ['model_year_not_covered', 'miles_and_fuel_economy_both_given']])
    // Gasoline cars and light trucks have CH4/N2O factors from 1973: earlier years are held with miles or mpg, sent without.
    const car = (modelYear: number, extra = {}) => vehicle({ fuel: 'gasoline', vehicleType: 'gasoline_passenger_car', modelYear, ...extra })
    expect(held(car(1972, { miles: { value: '10', basis: 'odometer' } }))).toEqual(['input_needed', ['model_year_before_first_factor_band']])
    expect(held(car(1965, { fuelEconomy: { mpg: '20', source: 'vehicle_record' } }))).toEqual(['input_needed', ['model_year_before_first_factor_band']])
    expect(run(planCollectionCalculation(car(1973, { miles: { value: '10', basis: 'odometer' } }), context, evidence).call!).status).toBe('ok')
    expect(run(planCollectionCalculation(car(1965), context, evidence).call!).result!.status).toBe('partial')
    // Refrigerant answers decide first, as in the engine: excluded or undecided records with blank terms are not held for the terms.
    const outside = run(planCollectionCalculation(refrigerant({ insideBoundary: false, terms: { PN: '', CN: '', PS: '', CD: '', RD: '' } }), context, evidence).call!).result!
    const unknownStock = run(planCollectionCalculation(refrigerant({ maintainsRefrigerantStock: null, terms: { PN: 'n/a', CN: '', PS: '', CD: '', RD: '' } }), context, evidence).call!).result!
    expect([outside.status, unknownStock.status]).toEqual(['excluded', 'input_needed'])
    expect(held(refrigerant({ terms: { PN: '', CN: '0', PS: '1', CD: '0', RD: 'n/a' } }))).toEqual(['input_needed', ['term_PN_not_numeric', 'term_RD_not_numeric']])
    expect(held(electricity([], { subregion: 'CAMXX' }))).toEqual(['input_needed', ['subregion_not_an_egrid_subregion']])
    expect(held(version({ ...electricity().activity, quantity: q('10,000', 'kWh') } as unknown as Record<string, unknown>))).toEqual(['input_needed', ['quantity_not_calculable']])
  })

  test('withdrawn records and excluded or undecided locations are never calculated', () => {
    const withdrawn = gas('10', 'therm', null, { state: 'withdrawn', withdrawalReason: 'Entered twice.' })
    expect(planCollectionCalculation({ ...withdrawn, revision: 2 }, context, evidence)).toMatchObject({ action: 'hold', status: 'withdrawn', reasons: ['record_withdrawn'] })
    expect(planCollectionCalculation(gas('10', 'therm', null, { locationId: warehouse }), context, evidence)).toMatchObject({ action: 'hold', status: 'excluded', reasons: ['location_excluded_by_company_setup'] })
    expect(planCollectionCalculation(gas('10', 'therm', null, { locationId: undecided }), context, evidence)).toMatchObject({ action: 'hold', status: 'input_needed', reasons: ['location_inclusion_unknown'] })
    expect(planCollectionCalculation(gas('10', 'therm', null, { locationId: crypto.randomUUID() }), context, evidence)).toMatchObject({ action: 'hold', status: 'input_needed', reasons: ['location_not_in_current_setup'] })
    expect(planCollectionCalculation(gas('10', 'therm'), { ...context, setupVersionId: crypto.randomUUID() }, evidence).notes).toEqual(['saved_against_earlier_setup_version'])
    expect(() => planCollectionCalculation(gas('10', 'therm'), { ...context, companyId: crypto.randomUUID() }, evidence)).toThrow('another company')
  })

  test('instrument evidence: rejected or errored files do not count; pending is noted', () => {
    const rejectedPlan = planCollectionCalculation(electricity([instrument({ evidenceReference: rejected })], {}, [rejected]), context, evidence)
    expect(rejectedPlan.notes).toEqual(['instrument_1_evidence_not_usable'])
    expect(run(rejectedPlan.call!).result!.marketBased.findings).toEqual(['instrument_evidence_required'])
    const pendingPlan = planCollectionCalculation(electricity([instrument({ evidenceReference: pending })], {}, [pending]), context, evidence)
    expect([pendingPlan.notes, run(pendingPlan.call!).result!.marketBased.status]).toEqual([['instrument_1_evidence_pending_scan'], 'complete'])
  })

  test('the translation drops only collection-only fields and never changes a value', () => {
    const plan = planCollectionCalculation(electricity([instrument({ generationTechnology: 'natural_gas', rateLbPerMwh: { co2: '900.5', ch4: '0.02', n2o: null } })], { zip: '07401', subregion: 'RFCE', utilityEiaId: '15477' }), context, evidence)
    expect(plan.call).toEqual({ engine: 'scope2', input: { period: { start: '2025-01-01', endExclusive: '2025-02-01' }, quantity: '10000', unit: 'kWh', zip: '07401', subregion: 'RFCE', utilityEiaId: '15477',
      instruments: [{ type: 'energy_attribute_certificate', mwh: '1', qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: clean, generationTechnology: 'natural_gas', rateLbPerMwh: { co2: '900.5', ch4: '0.02' } }] } })
    expect(run(plan.call!).result!.locationBased.status).toBe('complete')
    expect(planCollectionCalculation(gas('12.5', 'therm', { value: '0.1', unit: 'MMBtu per ccf' }), context, evidence)).toMatchObject({ notes: ['heat_content_not_used_for_energy_unit'], call: { request: { input: { quantity: '12.5', unit: 'therm' } } } })
    expect((planCollectionCalculation(vehicle({ vehicleCount: 3, miles: { value: '1200', basis: 'odometer' } }), context, evidence).call as { request: { input: unknown } }).request.input)
      .toEqual({ period: year, fuel: 'diesel', vehicleType: 'diesel_light_duty_truck', modelYear: 2020, gallons: '100', vehicleCount: 3, miles: { value: '1200', basis: 'odometer' } })
  })

  test('fuzz: 400 contract-valid records with junk, blanks and nulls are never refused by an engine', () => {
    const texts = ['', 'unknown', '1,234.5', '12.3456', '-1', '0', '7', '100.125', ' 5', 'n/a']
    // A hashed pick, so each field varies independently of the record kind (i % 5) and of the other fields.
    const mix = (i: number, k: number) => { let x = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0; return (x ^ (x >>> 16)) >>> 0 }
    const pick = <T>(xs: readonly T[], i: number, k: number) => xs[mix(i, k) % xs.length]!
    let calculated = 0, held = 0, blankTermsSent = 0, earlyGasolineSent = 0, earlyGasolineHeld = 0
    for (let i = 0; i < 400; i++) {
      const t = (k: number) => pick(texts, i, k)
      const kind = i % 5
      const v = kind === 0 ? gas(t(1), pick(['therm', 'MMBtu', 'scf', 'ccf', 'mcf', 'm3'], i, 2), i % 3 ? null : { value: t(3), unit: pick(['MMBtu per scf', 'MMBtu per ccf', 'MMBtu per mcf', 'therm per ccf'] as const, i, 4) })
        : kind === 1 ? generator(pick<Record<string, string>>([{ basis: 'measured', gallons: t(1) }, { basis: 'purchases_only', purchasedGallons: t(2) }, { basis: 'purchases_with_tank_levels', purchasedGallons: t(3), openingGallons: t(4), closingGallons: t(5) }], i, 1), i % 4 ? null : pick(['0.138', '0', '0.137', '1'], i, 6))
        : kind === 2 ? vehicle({ fuel: pick(['diesel', 'gasoline', 'Diesel', 'propane'], i, 1), vehicleType: pick(['diesel_light_duty_truck', 'gasoline_passenger_car', 'gasoline_light_duty_truck', 'gasoline_heavy_duty', 'Van'], i, 2), modelYear: pick([1950, 1960, 1965, 1972, 1973, 1999, 2020, 2026], i, 3), gallons: t(4),
            vehicleCount: pick([null, 1, 20000], i, 5), miles: i % 3 === 0 ? { value: t(6), basis: pick(['odometer', 'trip_log', 'guess'], i, 7) } : null, fuelEconomy: i % 3 === 1 ? { mpg: t(8), source: pick(['vehicle_record', 'fleet_record', 'fueleconomy_gov', 'memory'], i, 9) } : null })
        : kind === 3 ? refrigerant({ gas: pick(['R-410A', 'R-22', 'HFC-134a'] as const, i, 1), unit: pick(['kg', 'lb'] as const, i, 2), terms: { PN: t(3), CN: t(4), PS: t(5), CD: t(6), RD: t(7) },
            insideBoundary: pick([true, false, null], i, 8), maintainsRefrigerantStock: pick([false, true, null], i, 9), retrofitInPeriod: pick([false, null, true], i, 10), contractorRecordsComplete: i % 2 === 0, eventChronologyComplete: i % 3 !== 0 })
        : electricity([instrument({ mwh: t(1), evidenceReference: pick([clean, pending, rejected, null], i, 2), generationTechnology: pick(['wind', 'natural_gas', 'biogas', 'unknown'], i, 3), vintageYear: pick([2023, 2025, 2027], i, 4),
            qualityCriteriaMet: i % 2 === 0, rateLbPerMwh: i % 3 === 0 ? null : { co2: t(5), ch4: i % 2 ? null : t(6), n2o: null } })], { subregion: pick(['CAMX', 'NYUP', 'RFCE'], i, 7), zip: pick(['94105', '07401', '00000'], i, 8), utilityEiaId: pick([null, '15477', '1'], i, 9) }, [clean, pending, rejected])
      const plan = planCollectionCalculation(v, context, evidence)
      const payload = v.activity.payload as { fuel?: string, modelYear?: number, terms?: Record<string, string> }
      const early = kind === 2 && payload.fuel === 'gasoline' && [1960, 1965, 1972].includes(payload.modelYear!)
      if (plan.action === 'hold') { held++; if (early && plan.reasons.includes('model_year_before_first_factor_band')) earlyGasolineHeld++; expect(plan.reasons.length).toBeGreaterThan(0); continue }
      calculated++
      if (early) earlyGasolineSent++
      if (kind === 3 && Object.values(payload.terms!).some((x) => !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(x))) blankTermsSent++
      const out = run(plan.call!)
      if (out.status !== 'ok') throw new Error(`engine refused ${JSON.stringify(plan.call)}: ${out.code}`)
    }
    expect(calculated).toBeGreaterThan(100); expect(held).toBeGreaterThan(50)
    // The new edges were reached: early gasoline years both sent (no miles or mpg) and held, and refrigerant answers decided before blank terms.
    expect([earlyGasolineSent > 0, earlyGasolineHeld > 0, blankTermsSent > 0]).toEqual([true, true, true])
    console.log(`fuzz: ${calculated} calculated, ${held} held; early gasoline ${earlyGasolineSent} sent / ${earlyGasolineHeld} held; refrigerant with non-decimal terms sent ${blankTermsSent}`)
  }, 120000)
})
