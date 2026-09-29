/**
 * Collection record -> reviewed method-engine input (Claude, methods v7, collection review C08).
 *
 * Collection keeps what the user entered: blanks, text such as "1,234.5", nulls for unknown answers and fields the
 * engines do not take. The engines refuse anything that is not their exact input shape. This adapter is the only
 * translation between the two. It never invents or rounds a value:
 * - fields the engines do not take are dropped (vehicleGroupId, meter, utility name, site);
 * - null optional fields are omitted, and a missing instrument evidence reference becomes "" so the engine holds it;
 * - anything the engine would refuse (non-decimal text, an unknown fuel or vehicle type, an unsupported miles or mpg
 *   source) is held here as input_needed with a named reason instead of being sent;
 * - a withdrawn record, or a record at a location that company setup excludes or has not decided, is never calculated.
 * Scope 2 instrument MWh and rates are sent as entered: engine v3 holds only the market-based result when they are
 * incomplete, so the location-based result is kept.
 */
import type { CollectionActivity, CollectionActivityVersion, CollectionContext, CollectionEvidenceMetadata, CollectionInstrument } from './collection-contract'

export const COLLECTION_ENGINE_INPUT_PROFILE = 'neuvetra.collection-engine-input.v1' as const

// The engines' own patterns (scope1_engine.py / scope2_engine.py QUANTITY, FACTOR_TEXT and RATE).
const QUANTITY = /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$/
const FACTOR_TEXT = /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?$/
const EIA_ID = /^[0-9]{1,7}$/
export const ENGINE_VEHICLE_TYPES = {
  gasoline: ['gasoline_heavy_duty', 'gasoline_light_duty_truck', 'gasoline_motorcycle', 'gasoline_passenger_car'],
  diesel: ['diesel_light_duty_truck', 'diesel_medium_heavy_duty', 'diesel_passenger_car'],
} as const
export const ENGINE_SUBREGIONS = ['AKGD', 'AKMS', 'AZNM', 'CAMX', 'ERCT', 'FRCC', 'HIMS', 'HIOA', 'MROE', 'MROW', 'NEWE', 'NWPP', 'NYCW', 'NYLI', 'NYUP', 'PRMS', 'RFCE',
  'RFCM', 'RFCW', 'RMPA', 'SPNO', 'SPSO', 'SRMV', 'SRMW', 'SRSO', 'SRTV', 'SRVC'] as const
/** First model year with CH4/N2O factors, where it is later than the engine's 1960 floor. Only used with miles or mpg. */
export const ENGINE_FIRST_FACTOR_YEAR: Readonly<Record<string, number>> = { gasoline_passenger_car: 1973, gasoline_light_duty_truck: 1973 }
export const ENGINE_MILES_BASES = ['odometer', 'trip_log'] as const
export const ENGINE_MPG_SOURCES = ['vehicle_record', 'fleet_record', 'fueleconomy_gov'] as const
const VOLUME_UNITS = ['scf', 'ccf', 'mcf']

export type Scope1Kind = 'natural_gas' | 'distillate_no2' | 'vehicle' | 'fugitive'
export type CollectionEngineCall =
  | { engine: 'scope1'; request: { kind: Scope1Kind; input: Record<string, unknown> } }
  | { engine: 'scope2'; input: Record<string, unknown> }

export interface CollectionCalculationPlan {
  profile: typeof COLLECTION_ENGINE_INPUT_PROFILE
  recordId: string
  versionId: string
  revision: number
  kind: CollectionActivity['kind']
  sourceId: string
  locationId: string
  quality: CollectionActivity['quality']
  estimateBasis: string | null
  /** calculate: send `call` to the engine. hold: do not calculate; `status` and `reasons` say why. */
  action: 'calculate' | 'hold'
  status: 'withdrawn' | 'excluded' | 'input_needed' | null
  reasons: string[]
  /** Facts about the translation the result must show next to the engine's own findings. */
  notes: string[]
  call: CollectionEngineCall | null
}

const decimal = (value: string) => QUANTITY.test(value)

export function planCollectionCalculation(version: CollectionActivityVersion, context: CollectionContext, evidence: CollectionEvidenceMetadata[]): CollectionCalculationPlan {
  const a = version.activity
  const base = { profile: COLLECTION_ENGINE_INPUT_PROFILE, recordId: version.recordId, versionId: version.id, revision: version.revision, kind: a.kind,
    sourceId: a.sourceId, locationId: a.locationId, quality: a.quality, estimateBasis: a.estimateBasis }
  const hold = (status: 'withdrawn' | 'excluded' | 'input_needed', reasons: string[], notes: string[] = []): CollectionCalculationPlan =>
    ({ ...base, action: 'hold', status, reasons, notes, call: null })
  const notes: string[] = []
  if (version.companyId !== context.companyId) throw new Error('Collection context belongs to another company.')

  if (a.state === 'withdrawn') return hold('withdrawn', ['record_withdrawn'])
  const location = context.locations.find(l => l.id === a.locationId)
  if (!location) return hold('input_needed', ['location_not_in_current_setup'])
  if (a.setupVersionId !== context.setupVersionId) notes.push('saved_against_earlier_setup_version')
  if (location.inclusion === 'excluded') return hold('excluded', ['location_excluded_by_company_setup'], notes)
  if (location.inclusion !== 'included') return hold('input_needed', ['location_inclusion_unknown'], notes)

  const period = { start: a.period.start, endExclusive: a.period.endExclusive }
  const reasons: string[] = []
  const need = (ok: boolean, reason: string) => { if (!ok) reasons.push(reason) }

  if (a.kind === 'natural_gas') {
    const q = a.quantity
    need(q.normalizedValue !== null && q.normalizedUnit !== null && decimal(q.normalizedValue), 'quantity_not_calculable')
    const input: Record<string, unknown> = { period, quantity: q.normalizedValue, unit: q.normalizedUnit }
    const heat = a.payload.heatContent
    if (q.normalizedUnit && VOLUME_UNITS.includes(q.normalizedUnit)) {
      if (heat) {
        need(FACTOR_TEXT.test(heat.value) && Number(heat.value) !== 0, 'heat_content_not_numeric')
        input.heatContent = { value: heat.value, unit: heat.unit }
      } // without it the engine returns input_needed: heat_content_required_for_volume
    } else if (heat) notes.push('heat_content_not_used_for_energy_unit')
    return reasons.length ? hold('input_needed', reasons, notes) : { ...base, action: 'calculate', status: null, reasons: [], notes, call: { engine: 'scope1', request: { kind: 'natural_gas', input } } }
  }

  if (a.kind === 'distillate_no2') {
    const c = a.payload.consumption
    let consumption: Record<string, string>
    if (c.basis === 'measured') { need(decimal(c.gallons), 'gallons_not_numeric'); consumption = { basis: c.basis, gallons: c.gallons } }
    else if (c.basis === 'purchases_only') consumption = { basis: c.basis, purchasedGallons: c.purchasedGallons } // the engine holds it: tank levels required
    else {
      need(decimal(c.purchasedGallons), 'purchased_gallons_not_numeric'); need(decimal(c.openingGallons), 'opening_gallons_not_numeric'); need(decimal(c.closingGallons), 'closing_gallons_not_numeric')
      consumption = { basis: c.basis, purchasedGallons: c.purchasedGallons, openingGallons: c.openingGallons, closingGallons: c.closingGallons }
    }
    const input: Record<string, unknown> = { period, consumption }
    const hhv = a.payload.statedHhvMmbtuPerGallon
    if (hhv !== null) { need(FACTOR_TEXT.test(hhv) && Number(hhv) !== 0, 'stated_hhv_not_numeric'); input.statedHhvMmbtuPerGallon = hhv }
    return reasons.length ? hold('input_needed', reasons, notes) : { ...base, action: 'calculate', status: null, reasons: [], notes, call: { engine: 'scope1', request: { kind: 'distillate_no2', input } } }
  }

  if (a.kind === 'vehicle') {
    const p = a.payload
    const fuel = p.fuel as keyof typeof ENGINE_VEHICLE_TYPES
    need(fuel === 'gasoline' || fuel === 'diesel', 'fuel_not_an_engine_token')
    need((fuel === 'gasoline' || fuel === 'diesel') ? (ENGINE_VEHICLE_TYPES[fuel] as readonly string[]).includes(p.vehicleType) : false, 'vehicle_type_not_an_engine_token')
    need(Number.isInteger(p.modelYear) && p.modelYear >= 1960 && p.modelYear <= 2030, 'model_year_not_covered')
    need(p.vehicleCount === null || Number.isInteger(p.vehicleCount) && p.vehicleCount >= 1 && p.vehicleCount <= 10000, 'vehicle_count_out_of_range')
    need(decimal(p.gallons), 'gallons_not_numeric')
    const input: Record<string, unknown> = { period, fuel: p.fuel, vehicleType: p.vehicleType, modelYear: p.modelYear, gallons: p.gallons }
    if (p.vehicleCount !== null) input.vehicleCount = p.vehicleCount
    if (p.miles && p.fuelEconomy) reasons.push('miles_and_fuel_economy_both_given')
    else if (p.miles) {
      need(decimal(p.miles.value), 'miles_not_numeric'); need((ENGINE_MILES_BASES as readonly string[]).includes(p.miles.basis), 'miles_basis_not_an_engine_token')
      input.miles = { value: p.miles.value, basis: p.miles.basis }
    } else if (p.fuelEconomy) {
      need(decimal(p.fuelEconomy.mpg) && Number(p.fuelEconomy.mpg) !== 0, 'mpg_not_numeric'); need((ENGINE_MPG_SOURCES as readonly string[]).includes(p.fuelEconomy.source), 'mpg_source_not_an_engine_token')
      input.fuelEconomy = { mpg: p.fuelEconomy.mpg, source: p.fuelEconomy.source }
    } // neither: the engine returns partial with CH4 and N2O missing
    // With miles or mpg the engine looks up a CH4/N2O factor band; a year before the first band is refused there.
    if ((p.miles || p.fuelEconomy) && Number.isInteger(p.modelYear) && p.modelYear >= 1960 && p.modelYear < (ENGINE_FIRST_FACTOR_YEAR[p.vehicleType] ?? 1960)) reasons.push('model_year_before_first_factor_band')
    return reasons.length ? hold('input_needed', reasons, notes) : { ...base, action: 'calculate', status: null, reasons: [], notes, call: { engine: 'scope1', request: { kind: 'vehicle', input } } }
  }

  if (a.kind === 'fugitive') {
    const p = a.payload
    // The engine decides boundary and applicability from the answers before it reads the terms, so the terms are only
    // checked here when the answers would let the engine reach them (an excluded record with blank terms stays excluded).
    const reachesTerms = p.insideBoundary === true && p.maintainsRefrigerantStock === false && p.retrofitInPeriod === false && p.contractorRecordsComplete && p.eventChronologyComplete
    if (reachesTerms) for (const term of ['PN', 'CN', 'PS', 'CD', 'RD'] as const) need(decimal(p.terms[term]), `term_${term}_not_numeric`)
    // Answers pass unchanged: null stays null (unknown), which the engine holds as input needed.
    const input = { period, gas: p.gas, unit: p.unit, terms: { ...p.terms }, insideBoundary: p.insideBoundary, maintainsRefrigerantStock: p.maintainsRefrigerantStock,
      retrofitInPeriod: p.retrofitInPeriod, contractorRecordsComplete: p.contractorRecordsComplete, eventChronologyComplete: p.eventChronologyComplete }
    return reasons.length ? hold('input_needed', reasons, notes) : { ...base, action: 'calculate', status: null, reasons: [], notes, call: { engine: 'scope1', request: { kind: 'fugitive', input } } }
  }

  // electricity
  const p = a.payload
  const q = a.quantity
  need(q.normalizedValue !== null && (q.normalizedUnit === 'kWh' || q.normalizedUnit === 'MWh') && decimal(q.normalizedValue), 'quantity_not_calculable')
  need(/^[0-9]{5}$/.test(p.zip), 'zip_not_valid')
  need((ENGINE_SUBREGIONS as readonly string[]).includes(p.subregion), 'subregion_not_an_egrid_subregion')
  const input: Record<string, unknown> = { period, quantity: q.normalizedValue, unit: q.normalizedUnit, zip: p.zip, subregion: p.subregion }
  if (p.utilityEiaId !== null && p.utilityEiaId !== '') { need(EIA_ID.test(p.utilityEiaId), 'utility_eia_id_not_numeric'); input.utilityEiaId = p.utilityEiaId }
  const files = new Map(evidence.map(file => [file.id, file]))
  input.instruments = p.instruments.map((i: CollectionInstrument, index) => {
    let reference = i.evidenceReference ?? ''
    const file = reference ? files.get(reference) : undefined
    if (reference && (!file || file.companyId !== context.companyId || file.quarantineStatus === 'rejected' || file.quarantineStatus === 'error')) {
      notes.push(`instrument_${index + 1}_evidence_not_usable`); reference = ''
    } else if (file && file.quarantineStatus === 'pending') notes.push(`instrument_${index + 1}_evidence_pending_scan`)
    const out: Record<string, unknown> = { type: i.type, mwh: i.mwh, qualityCriteriaMet: i.qualityCriteriaMet, vintageYear: i.vintageYear, evidenceReference: reference, generationTechnology: i.generationTechnology }
    if (i.rateLbPerMwh) {
      const rate: Record<string, string> = { co2: i.rateLbPerMwh.co2 }
      if (i.rateLbPerMwh.ch4 !== null) rate.ch4 = i.rateLbPerMwh.ch4
      if (i.rateLbPerMwh.n2o !== null) rate.n2o = i.rateLbPerMwh.n2o
      out.rateLbPerMwh = rate
    }
    return out
  })
  return reasons.length ? hold('input_needed', reasons, notes) : { ...base, action: 'calculate', status: null, reasons: [], notes, call: { engine: 'scope2', input } }
}
