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
 * An instrument counts only with a certificate or contract file that supports it alone (A-01) and has cleared quarantine
 * review (A-03); otherwise its reference is sent as "" and the engine holds only the market-based result.
 */
import { savedAgainstCurrentSetup, type CollectionActivity, type CollectionActivityVersion, type CollectionContext, type CollectionEvidenceMetadata, type CollectionInstrument } from './collection-contract'

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
/**
 * A-02 (26 October 2026): a stated heat content far from the EPA GHG Emission Factors Hub 2025 default (Table 1, in the
 * Scope 1 register: natural gas 0.001026 MMBtu per scf, No. 2 distillate 0.138 MMBtu per gallon) is almost always a unit
 * slip (for example 1.037 entered as MMBtu per ccf instead of therms per ccf, a tenfold error), so the record is held for
 * the user to check rather than calculated. Bounds are inclusive, exact decimals.
 * - Standard cubic feet are at standard conditions: within 15% of the default. 40 CFR 72.2 pipeline natural gas (950 to
 *   1,100 Btu per scf) and the EIA 2025 U.S. delivered average (1,036 Btu per cubic foot) are inside.
 * - Package 3 r2 (27 October 2026): bills in ccf or mcf measure gas at the meter, and the heat content they print already
 *   includes the utility's elevation and delivery-pressure adjustment. Southwest Gas's California tariff (CPUC, Rule No. 2)
 *   applies 0.854 at 4,400 to 5,299 ft, 0.778 at 7,400 to 7,799 ft and 0.736 at 9,000 to 9,399 ft, so a correct Lake
 *   Tahoe bill reads about 0.81 to 0.84 therms per ccf; delivery above standard pressure raises the figure. So these units
 *   take half to double the default, which still holds every tenfold slip and never such a bill.
 */
export const PLAUSIBLE_HEAT_CONTENT: Readonly<Record<string, readonly [string, string]>> = {
  'MMBtu per scf': ['0.0008721', '0.0011799'], 'MMBtu per ccf': ['0.0513', '0.2052'], 'MMBtu per mcf': ['0.513', '2.052'], 'therm per ccf': ['0.513', '2.052'],
}
export const PLAUSIBLE_DISTILLATE_HHV_MMBTU_PER_GALLON = ['0.1173', '0.1587'] as const
const SCALE = 10
const scaled = (value: string) => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole!) * 10n ** BigInt(SCALE) + BigInt((fraction + '0'.repeat(SCALE)).slice(0, SCALE)) }
/** Exact decimal comparison; only called on values that already match FACTOR_TEXT (at most 6 fractional digits). */
const within = (value: string, [low, high]: readonly [string, string]) => scaled(value) >= scaled(low) && scaled(value) <= scaled(high)

export type Scope1Kind = 'natural_gas' | 'distillate_no2' | 'vehicle' | 'fugitive'
export type CollectionEngineCall =
  | { engine: 'scope1'; request: { kind: Scope1Kind; input: Record<string, unknown> } }
  | { engine: 'scope2'; input: Record<string, unknown> }

/**
 * A-01 (26 October 2026): one certificate or contract file can support only one market-based claim. Claims are counted
 * per instrument over every active electricity record at an included location, keyed by the file's content (SHA-256), so
 * the same document uploaded twice is still one certificate. A file that supports more than one claim counts for none of
 * them: each of those market-based results is held as input needed; location-based results are unchanged.
 * Files that are missing, from another company, rejected or failed never count, so they are not claims either.
 */
export type InstrumentEvidenceClaims = ReadonlyMap<string, number>
/** Corporate boundary decisions precede calculation; unsupported allocations are never guessed. */
export function collectionBoundaryHold(activity: CollectionActivity, context: CollectionContext): { status: 'excluded' | 'input_needed'; reasons: string[] } | null {
  const held = (reason: string, status: 'excluded' | 'input_needed' = 'input_needed') => ({ status, reasons: [reason] })
  const location = context.locations.find(item => item.id === activity.locationId)
  if (!location) return held('location_not_in_current_setup')
  if (location.inclusion === 'excluded') return held('location_excluded_by_company_setup', 'excluded')
  if (location.inclusion !== 'included') return held('location_inclusion_unknown')
  if (location.entityId === undefined) return held('boundary_metadata_unavailable')
  const entity = location.entity
  if (location.entityId !== null) {
    if (!entity || entity.id !== location.entityId) return held('location_entity_unresolved')
    if (entity.inclusion === 'excluded') return held('entity_excluded_by_company_setup', 'excluded')
    if (entity.inclusion !== 'included') return held('entity_inclusion_unknown')
  }
  if (context.boundaryApproach === 'equity_share') return held('equity_share_not_supported')
  if (context.boundaryApproach !== 'operational_control' && context.boundaryApproach !== 'financial_control') return held('boundary_approach_unknown')
  if (location.entityId !== null) {
    if (entity!.control === 'none') return held('entity_outside_control_boundary', 'excluded')
    if (entity!.control !== context.boundaryApproach) return held('entity_control_unresolved')
  }
  if (location.control !== 'reporting_company' && !(location.control === 'related_entity' && location.entityId !== null)) return held('location_control_unresolved')
  const period = context.reportingPeriod
  if (!period?.start || !period.endExclusive) return held('reporting_period_unknown')
  if (activity.period.start < period.start || activity.period.endExclusive > period.endExclusive) return held('activity_outside_reporting_period')
  const start = location.startMode === 'period_start' ? period.start : location.startMode === 'specific' ? location.start : null
  const end = location.endMode === 'period_end' ? period.endExclusive : location.endMode === 'specific' ? location.endExclusive : null
  if (!start || !end || start >= end) return held('location_coverage_unknown')
  if (activity.period.start < start || activity.period.endExclusive > end) return held('activity_outside_location_coverage')
  return null
}

function claimKey(reference: string | null, files: ReadonlyMap<string, CollectionEvidenceMetadata>, companyId: string): string | null {
  const file = reference ? files.get(reference) : undefined
  if (!file || file.companyId !== companyId || file.quarantineStatus === 'rejected' || file.quarantineStatus === 'error') return null
  return `sha256:${file.sha256}`
}
export function instrumentEvidenceClaims(activities: Iterable<CollectionActivity>, context: CollectionContext, evidence: CollectionEvidenceMetadata[]): InstrumentEvidenceClaims {
  const files = new Map(evidence.map(file => [file.id, file]))
  const claims = new Map<string, number>()
  for (const activity of activities) {
    if (activity.kind !== 'electricity' || activity.state === 'withdrawn' || collectionBoundaryHold(activity, context)) continue
    for (const instrument of activity.payload.instruments) {
      const key = claimKey(instrument.evidenceReference, files, context.companyId)
      if (key) claims.set(key, (claims.get(key) ?? 0) + 1)
    }
  }
  return claims
}

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
/** Normalization is identity: only a plain decimal in an engine unit is normalized, so the pair must equal the bill's. */
const billed = (q: CollectionActivity['quantity']) => q.normalizedValue !== null && q.normalizedValue === q.originalValue && q.normalizedUnit === q.originalUnit && decimal(q.normalizedValue)

export function planCollectionCalculation(version: CollectionActivityVersion, context: CollectionContext, evidence: CollectionEvidenceMetadata[], claims?: InstrumentEvidenceClaims): CollectionCalculationPlan {
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
  // BF2: setup content is compared, not version IDs, so a record saved before an identical restore isn't flagged.
  if (!savedAgainstCurrentSetup(a.setupVersionId, context)) notes.push('saved_against_earlier_setup_version')
  const boundary = collectionBoundaryHold(a, context)
  if (boundary) return hold(boundary.status, boundary.reasons, notes)

  const period = { start: a.period.start, endExclusive: a.period.endExclusive }
  const reasons: string[] = []
  const need = (ok: boolean, reason: string) => { if (!ok) reasons.push(reason) }

  if (a.kind === 'natural_gas') {
    const q = a.quantity
    need(billed(q), 'quantity_not_calculable')
    const input: Record<string, unknown> = { period, quantity: q.normalizedValue, unit: q.normalizedUnit }
    const heat = a.payload.heatContent
    if (VOLUME_UNITS.includes(q.originalUnit)) { // the bill's unit, so a quantity still held keeps its heat content checked
      if (heat) {
        need(FACTOR_TEXT.test(heat.value) && Number(heat.value) !== 0, 'heat_content_not_numeric')
        if (FACTOR_TEXT.test(heat.value) && Number(heat.value) !== 0 && PLAUSIBLE_HEAT_CONTENT[heat.unit]) need(within(heat.value, PLAUSIBLE_HEAT_CONTENT[heat.unit]!), 'heat_content_outside_plausible_range')
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
    if (hhv !== null) {
      need(FACTOR_TEXT.test(hhv) && Number(hhv) !== 0, 'stated_hhv_not_numeric')
      if (FACTOR_TEXT.test(hhv) && Number(hhv) !== 0) need(within(hhv, PLAUSIBLE_DISTILLATE_HHV_MMBTU_PER_GALLON), 'stated_hhv_outside_plausible_range')
      input.statedHhvMmbtuPerGallon = hhv
    }
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
  need(billed(q) && (q.normalizedUnit === 'kWh' || q.normalizedUnit === 'MWh'), 'quantity_not_calculable')
  need(/^[0-9]{5}$/.test(p.zip), 'zip_not_valid')
  need((ENGINE_SUBREGIONS as readonly string[]).includes(p.subregion), 'subregion_not_an_egrid_subregion')
  const input: Record<string, unknown> = { period, quantity: q.normalizedValue, unit: q.normalizedUnit, zip: p.zip, subregion: p.subregion }
  if (p.utilityEiaId !== null && p.utilityEiaId !== '') { need(EIA_ID.test(p.utilityEiaId), 'utility_eia_id_not_numeric'); input.utilityEiaId = p.utilityEiaId }
  const files = new Map(evidence.map(file => [file.id, file]))
  input.instruments = p.instruments.map((i: CollectionInstrument, index) => {
    let reference = i.evidenceReference ?? ''
    const file = reference ? files.get(reference) : undefined
    const key = claimKey(reference, files, context.companyId)
    if (reference && !key) { notes.push(`instrument_${index + 1}_evidence_not_usable`); reference = '' }
    else if (key) {
      // A-03: a file still waiting for quarantine review doesn't support a figure yet (BF2 counted it meanwhile).
      if (file!.quarantineStatus !== 'clean') { notes.push(`instrument_${index + 1}_evidence_pending_scan`); reference = '' }
      if ((claims?.get(key) ?? 0) > 1) { notes.push(`instrument_${index + 1}_evidence_shared`); reference = '' }
    }
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
