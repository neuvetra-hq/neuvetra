/**
 * Scope 3 collection -> reviewed Scope 3 engine input (Claude, 24 October 2026; Scope 3 package 1, groundwork for AG1).
 *
 * The same rules as the Scope 1 and 2 adapter (collection-engine-input.ts, methods v7 C08): collection keeps what the
 * user entered, and this is the only translation to the engine's exact input. It never invents or rounds a value:
 * - every contract-valid record either reaches scope3_engine.py and is accepted, or is held here as input_needed with a
 *   named reason; nothing the engine would refuse is sent;
 * - a withdrawn record, or a record at a location that company setup excludes or hasn't decided, is never calculated;
 * - category 3C (transmission and distribution losses) has no record of its own: it follows a saved electricity record,
 *   so a change or hold on the electricity record carries through (which electricity records carry 3C is decision D3 in
 *   the package design).
 * Unknown is never zero, and nothing here changes a Scope 1 or Scope 2 record or result.
 *
 * Package 2 (26 October 2026): the collection tables store these kinds from schema 29 (0029); the payload contract
 * lives in scope3-collection-contract.ts, shared with collection-contract.ts, and is re-exported here unchanged.
 *
 * Scope 3 completion I-02 (30 October 2026): the thirteen kinds 0030 adds are typed here and planned with an exhaustive
 * category map (audit D20: a kind that misses its branch can no longer fall through to category 7). Until the
 * increment that builds a kind's method (I-03, I-05, I-07, I-12), its records are held with `method_not_built_yet`, so
 * they are counted and shown with a plain reason and never sent to an engine that would refuse them.
 *
 * Scope 3 completion I-03 part 2 (30 October 2026; DESIGN §5.1, A19-A23, A29): spend lines (`purchase_spend`) and
 * supplier figures (`purchase_supplier`) reach the engine. Every precondition the 0030 contract saves without refusing
 * (currency, NAICS code sets, the energy and trade-sector guards, the category 9 attestation, a confirmed overlap for the
 * spend fallback categories, full cost for capital goods, a factory-gate price for without-margins factors, line dates,
 * possible duplicates, units and allocation rules) is a named hold here; a spend line a supplier record supersedes
 * (`planScope3Supersession`) is excluded and never counted.
 *
 * Scope 3 completion I-05 (30 October 2026; DESIGN §5.1, A6, A14, A15, A27, A28): energy resold (3D), average-data
 * commuting, teleworking, asset energy and partner figures reach the engine. Their holds: the Scope 2 attestation for 3D,
 * the commuting overlap attestation, mode, unit, grid-location and refrigerant tokens, and the lease boundary of the
 * company's consolidation approach (Scope 3 Standard Tables A.1 and A.2) for categories 8 and 13. Lines whose factor
 * source is designed but not loaded are `method_pending` with `factor_source_not_yet_loaded`: buildings by floor area
 * (CBECS), the 3D upstream line (`planEnergyResoldUpstream`) and hotel stays, which are optional (A27) and are recognised
 * on records saved before 0030 too (mode text "hotel", room-nights as written; no re-save). Partner figures also supersede
 * the spend lines they replace.
 *
 * Scope 3 completion I-07 (30 October 2026; DESIGN §5.1, B5(d)): fuels sold, energy-using products and products containing
 * greenhouse gases (category 11), end of life by treatment split (12) and investments (15) reach the engine, so no kind is
 * held `method_not_built_yet` any more (buildings by floor area wait for CBECS as `method_pending`). Their holds are token,
 * unit and currency checks and, for revenue-based investments, the revenue and the investee's NAICS code; the engine decides
 * the rest (an unknown split, a non-U.S. use region for electricity, a share above one, missing investee emissions). Two
 * notes become category disclosures: the same product in category 12 and as a category 11 greenhouse-gas product released in
 * full during use (`planScope3ProductOverlap`), and an initial sponsor's project without its projected lifetime emissions.
 */
import { ENGINE_SUBREGIONS, planCollectionCalculation } from './collection-engine-input'
import { savedAgainstCurrentSetup, type CollectionActivity, type CollectionActivityVersion, type CollectionContext, type CollectionEvidenceMetadata, type CollectionQuantity } from './collection-contract'
import { scope3ReportingYearOf } from './scope3-assessment-contract'
import {
  SCOPE3_AIR_BY_DISTANCE, SCOPE3_AIR_HAULS, SCOPE3_COMMUTING_MODES, SCOPE3_SPEND_NAICS_SETS, SCOPE3_TRANSPORT_UNITS as TRANSPORT_UNITS, SCOPE3_TRANSPORT_VEHICLES, SCOPE3_TRAVEL_MODES,
  SCOPE3_UNIT_FAMILIES, SCOPE3_WASTE_MATERIALS, SCOPE3_WASTE_TREATMENTS, SCOPE3_WASTE_UNITS, SCOPE3_YEAR_MAX, SCOPE3_YEAR_MIN, scope3SpendNaicsAllowed,
  SCOPE3_CBECS_ACTIVITIES, SCOPE3_COMMUTING_AVG_MODES, SCOPE3_GHG_GASES, SCOPE3_HOTEL_MODE_ALIASES, SCOPE3_LATE_SOURCES, SCOPE3_SOLD_FUELS,
  SCOPE3_UPSTREAM_LIQUIDS_VERIFIED, SCOPE3_UPSTREAM_VEHICLE_FUELS,
  SCOPE3_CBECS_ACTIVITIES_LOADED, SCOPE3_HOTEL_COUNTRIES,
  type BusinessTravelCollectionPayload, type CommutingCollectionPayload, type Scope3Category, type Scope3CollectionKind, type Scope3CompletionKind, type Scope3DerivedKind,
  type Scope3PayloadByKind, type TransportCollectionPayload, type WasteCollectionPayload, SCOPE3_DEFAULT_PERIOD, SCOPE3_METHOD_ENVELOPE, SCOPE3_UPSTREAM_SUBREGIONS_WITHOUT_MAPPED_FOSSIL
} from './scope3-collection-contract'

import { scope3TaxTreatmentNote } from './scope3-r3a'

export const SCOPE3_COLLECTION_INPUT_PROFILE = 'neuvetra.scope3-collection-input.v1' as const
export * from './scope3-collection-contract'
export type Scope3CollectionActivity = Omit<CollectionActivity, 'kind' | 'payload'> & (
  | { kind: 'transport'; payload: TransportCollectionPayload }
  | { kind: 'waste'; payload: WasteCollectionPayload }
  | { kind: 'business_travel'; payload: BusinessTravelCollectionPayload }
  | { kind: 'employee_commuting'; payload: CommutingCollectionPayload }
  | { [K in Scope3CompletionKind]: { kind: K; payload: Scope3PayloadByKind[K] } }[Scope3CompletionKind])
export type Scope3CollectionVersion = Omit<CollectionActivityVersion, 'activity'> & { activity: Scope3CollectionActivity }

/** A Scope 3 engine request: a saved kind or a derived line (the new kinds reach the engine from their method's increment). */
export type Scope3EngineRequest = { kind: Scope3CollectionKind | Scope3DerivedKind; input: Record<string, unknown> }
export interface Scope3CalculationPlan {
  profile: typeof SCOPE3_COLLECTION_INPUT_PROFILE
  recordId: string
  versionId: string
  revision: number
  /** td_losses: category 3C, derived from the electricity record with this record ID (see `derivedFrom`). */
  kind: Scope3CollectionKind | Scope3DerivedKind
  category: Scope3Category
  /** DESIGN §3.4: the record a derived line follows (null for a line that is a saved Scope 3 record). */
  derivedFrom: { recordId: string; kind: string } | null
  /** DESIGN §3.4: the saved payload of the record the line comes from, for rows and the CSV. Never sent to the engine as is. */
  payload: unknown
  sourceId: string
  locationId: string
  quality: CollectionActivity['quality']
  estimateBasis: string | null
  action: 'calculate' | 'hold'
  /**
   * I-04 (DESIGN 3.4, A6): `method_pending` holds a line whose method is designed but whose factor source is not loaded
   * yet (reason `factor_source_not_yet_loaded`); the category then awaits its factor source. The adapter emits it from I-05.
   */
  status: 'withdrawn' | 'excluded' | 'input_needed' | 'method_pending' | null
  /** I-04 (A27): true only on a `method_pending` hold of an optional activity (hotel stays); absent otherwise. Set by the adapter (I-05). */
  optional?: true
  reasons: string[]
  notes: string[]
  call: { engine: 'scope3'; request: Scope3EngineRequest } | null
}

const QUANTITY = /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$/
/** Normalization is identity: the engine gets exactly the billed or recorded number and unit. */
const recorded = (q: CollectionQuantity) => q.normalizedValue !== null && q.normalizedValue === q.originalValue && q.normalizedUnit === q.originalUnit && QUANTITY.test(q.normalizedValue)
const travelUnits = (mode: string): readonly string[] => {
  const basis = (SCOPE3_TRAVEL_MODES as Record<string, string>)[mode]
  if ((SCOPE3_AIR_HAULS as readonly string[]).includes(mode)) return ['passenger-mile', 'passenger-km']
  return basis ? [`${basis}-mile`, `${basis}-km`] : []
}
/** Audit D20: one branch per kind, checked exhaustively by the compiler. */
function categoryOf(a: Scope3CollectionActivity): Scope3Category {
  switch (a.kind) {
    case 'transport': case 'waste': case 'purchase_spend': case 'purchase_supplier': case 'asset_energy': case 'partner_reported': case 'building_average': return a.payload.category
    case 'business_travel': return 6
    case 'employee_commuting': case 'commuting_average': case 'teleworking': return 7
    case 'energy_resold': return 3
    case 'sold_fuel': case 'sold_energy_product': case 'sold_ghg_product': return 11
    case 'end_of_life_split': return 12
    case 'investment': return 15
    default: { const unreachable: never = a; throw new Error(`Unknown Scope 3 kind: ${(unreachable as { kind: string }).kind}`) }
  }
}
/**
 * Kinds whose method is not built yet (I-02). Each later increment removed the kinds it built (I-03: spend and supplier
 * figures; I-05: energy resold, average commuting, teleworking, asset energy and partner figures, and buildings by floor
 * area, which wait for their factor source instead: `method_pending`; I-07: the category 11, 12 and 15 kinds). Empty since
 * I-07: every kind has a method; a kind whose factor source is late waits as `method_pending`, never `method_not_built_yet`.
 */
export const METHOD_NOT_BUILT: ReadonlySet<string> = new Set<Scope3CompletionKind>([])

// --- I-03 --- Purchases (DESIGN §5.1).
/** A setup reporting period (start inclusive, end exclusive). */
export interface Scope3ReportingPeriod { start: string; endExclusive: string }
/**
 * What the results route knows beyond one record (DESIGN §5.1). Both are optional, so a single record can still be
 * planned on its own (the collection screen's readiness): without a reporting period a spend line's dollar year defaults
 * to the year of its own period and its line date is checked against its own period.
 */
export interface Scope3PlanOptions {
  /** The setup reporting period (null when setup has none). */
  reportingPeriod?: Scope3ReportingPeriod | null
  /** `planScope3Supersession`: spend record ID -> ID of the record that supersedes it. */
  supersession?: ReadonlyMap<string, string>
  /**
   * I-05 (A15): the company's consolidation approach from company setup. Absent: not known to the caller (a single record
   * planned on its own), so no approach-dependent lease hold is made; null or 'unknown': setup has none, so a lease whose
   * scope depends on it is held `consolidation_approach_required`.
   */
  consolidationApproach?: Scope3ConsolidationApproach | null
  /** I-05: periods of the active distance-based commuting records (`scope3DistanceCommutingPeriods`). Absent: not known, no overlap hold. */
  distanceCommutingPeriods?: readonly Scope3ReportingPeriod[]
  /** DESIGN A6: which late factor sources are loaded (default `SCOPE3_LATE_SOURCES`; renamed by DESIGN 13.3). */
  lateSources?: Readonly<{ usUpstream2025: boolean; usBuildingHotel2025: boolean }>
  /** I-07 (B5(d)): record IDs of the category 11/12 product overlap (`planScope3ProductOverlap`). Absent: not known, no note. */
  productOverlap?: ReadonlySet<string>
  /**
   * I-12h (A14): the country code of each setup location (company setup `locations[].countryCode`). A hotel stay without its
   * own hotel country takes its reporting location's country when that is the U.S. (an estimate). Absent: not known, so such
   * a stay needs its hotel country.
   */
  locationCountries?: ReadonlyMap<string, string | null>
  /**
   * Round 2 (owner decision 3): eGRID regions whose fossil heat input has no upstream factor (default
   * `SCOPE3_UPSTREAM_SUBREGIONS_WITHOUT_MAPPED_FOSSIL`); their electricity upstream lines wait for a factor source.
   */
  upstreamSubregionsWithoutMappedFossil?: readonly string[]
}
/** Company setup's consolidation approach (company-setup-contract.ts `boundary.approach`). */
export type Scope3ConsolidationApproach = 'operational_control' | 'financial_control' | 'equity_share' | 'unknown'
/**
 * DESIGN I-12c (contingency): category 3 spend (the 3A fuel spend proxy) is calculated only once the orchestrator enables
 * it; until then such lines are held `spend_proxy_for_category_3_not_enabled`. 0030 already stores them.
 */
export const SCOPE3_CATEGORY_3_SPEND_PROXY_ENABLED = false
/** A number as a ledger may write it (sign, digits, grouping commas, a decimal part), before any check of its form. */
const NUMERIC = /^[+-]?(?:[0-9][0-9,]*(?:\.[0-9]*)?|\.[0-9]+)$/
const within = (date: string, period: Scope3ReportingPeriod) => date >= period.start && date < period.endExclusive
const periodWithin = (inner: Scope3ReportingPeriod, outer: Scope3ReportingPeriod) => inner.start >= outer.start && inner.endExclusive <= outer.endExclusive
/** The reporting year of a period: the year in which it ends (DESIGN A24), or null for an unreadable date. */
const yearOf = (period: Scope3ReportingPeriod): number | null => { try { return scope3ReportingYearOf(period.endExclusive) } catch { return null } }
const usableReportingPeriod = (period: { start: string | null; endExclusive: string | null } | null | undefined): Scope3ReportingPeriod | null =>
  period?.start && period.endExclusive ? { start: period.start, endExclusive: period.endExclusive } : null

type Scope3EligibilityHold = { status: 'excluded' | 'input_needed'; reasons: string[] }
type Scope3ReportingActivity = Pick<CollectionActivity, 'locationId' | 'period'>
/** Reporting attribution is shared across categories; asset control and lease allocation remain method-specific. */
function scope3ReportingLocationHold(activity: Scope3ReportingActivity, context: CollectionContext, period: Scope3ReportingPeriod): Scope3EligibilityHold | null {
  const held = (reason: string, status: Scope3EligibilityHold['status'] = 'input_needed'): Scope3EligibilityHold => ({ status, reasons: [reason] })
  const location = context.locations.find(item => item.id === activity.locationId)
  if (!location) return held('location_not_in_current_setup')
  if (location.inclusion === 'excluded') return held('location_excluded_by_company_setup', 'excluded')
  if (location.inclusion !== 'included') return held('location_inclusion_unknown')
  if (!context.boundaryApproach || !['operational_control', 'financial_control', 'equity_share'].includes(context.boundaryApproach)) return held('scope3_consolidation_approach_required')
  if (location.entityId === undefined) return held('boundary_metadata_unavailable')
  if (location.entityId !== null) {
    const entity = location.entity
    if (!entity || entity.id !== location.entityId) return held('location_entity_unresolved')
    if (entity.inclusion === 'excluded') return held('entity_excluded_by_company_setup', 'excluded')
    if (entity.inclusion !== 'included') return held('entity_inclusion_unknown')
  }
  if (!periodWithin(activity.period, period)) return held('activity_outside_reporting_period')
  const start = location.startMode === 'period_start' ? period.start : location.startMode === 'specific' ? location.start : null
  const end = location.endMode === 'period_end' ? period.endExclusive : location.endMode === 'specific' ? location.endExclusive : null
  if (!start || !end || start >= end) return held('location_coverage_unknown')
  if (activity.period.start < start || activity.period.endExclusive > end) return held('activity_outside_location_coverage')
  return null
}

function scope3EligibilityHold(activity: Scope3ReportingActivity, context: CollectionContext, options: Pick<Scope3PlanOptions, 'reportingPeriod'>): Scope3EligibilityHold | null {
  if (!periodWithin(activity.period, SCOPE3_METHOD_ENVELOPE)) return { status: 'input_needed', reasons: ['period_outside_method_envelope'] }
  const stated = options.reportingPeriod !== undefined ? options.reportingPeriod : context.reportingPeriod
  // R2-A: an explicitly absent setup period means calendar 2025. Standalone legacy callers supply neither period.
  const effective = usableReportingPeriod(stated) ?? (stated === undefined ? activity.period : SCOPE3_DEFAULT_PERIOD)
  if (stated !== undefined && !usableReportingPeriod(stated) && !periodWithin(activity.period, SCOPE3_DEFAULT_PERIOD))
    return { status: 'input_needed', reasons: ['reporting_period_required_outside_2025'] }
  return scope3ReportingLocationHold(activity, context, effective)
}
// --- end I-03 ---

// --- I-05 ---
/** A14: whether a business travel mode is a hotel stay (`SCOPE3_HOTEL_MODE_ALIASES`, trimmed and lower-cased). */
export const scope3IsHotelMode = (mode: string) => (SCOPE3_HOTEL_MODE_ALIASES as readonly string[]).includes(mode.trim().toLowerCase())
/** Exact comparison of a plain decimal (the contract's DEC3) with a whole number: value <= whole. */
function decimalAtMost(value: string, whole: number): boolean {
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) return false
  const [int, fraction = ''] = value.split('.')
  return BigInt(int!) < BigInt(whole) || (BigInt(int!) === BigInt(whole) && /^0*$/.test(fraction))
}
// --- end I-05 ---

// --- I-07 ---
/**
 * Hub 2025 Table 1 fuels by the unit of their default heat content (the engine catalog's `soldFuelUnits`, compared in the
 * tests): a fuel sold, or a fuel an energy-using product burns, is entered in this unit or in MMBtu.
 */
const FUELS_BY_UNIT = {
  short_ton: ['agricultural_byproducts', 'anthracite', 'bituminous', 'coal_coke', 'lignite', 'mixed_commercial_sector', 'mixed_electric_power_sector', 'mixed_industrial_coking',
    'mixed_industrial_sector', 'municipal_solid_waste', 'peat', 'petroleum_coke_solid', 'plastics', 'solid_byproducts', 'sub_bituminous', 'tires', 'wood_and_wood_residuals'],
  US_gallon: ['asphalt_and_road_oil', 'aviation_gasoline', 'biodiesel_100', 'butane', 'butylene', 'crude_oil', 'distillate_fuel_oil_no_1', 'distillate_fuel_oil_no_2',
    'distillate_fuel_oil_no_4', 'ethane', 'ethanol_100', 'ethylene', 'heavy_gas_oils', 'isobutane', 'isobutylene', 'kerosene', 'kerosene_type_jet_fuel',
    'liquefied_petroleum_gases_lpg', 'lubricants', 'motor_gasoline', 'naphtha_401_deg_f', 'natural_gasoline', 'other_oil_401_deg_f', 'pentanes_plus',
    'petrochemical_feedstocks', 'propane', 'propylene', 'rendered_animal_fat', 'residual_fuel_oil_no_5', 'residual_fuel_oil_no_6', 'special_naphtha', 'unfinished_oils',
    'used_oil', 'vegetable_oil'],
  scf: ['blast_furnace_gas', 'coke_oven_gas', 'fuel_gas', 'landfill_gas', 'natural_gas', 'other_biomass_gases', 'propane_gas'],
} as const
export const SCOPE3_SOLD_FUEL_UNITS: Readonly<Record<string, 'short_ton' | 'US_gallon' | 'scf'>> =
  Object.fromEntries(Object.entries(FUELS_BY_UNIT).flatMap(([unit, fuels]) => fuels.map(fuel => [fuel, unit as 'short_ton' | 'US_gallon' | 'scf'])))
/** Where a product that uses energy is used: the U.S. (US23), an eGRID subregion (SRL23), or outside the U.S. (electricity held by the engine). */
export const SCOPE3_USE_REGIONS = ['US', 'non_US'] as const
/** Investment holding types whose inclusion is optional (calculation guidance Table 15.2); the engine discloses them. */
export const SCOPE3_OPTIONAL_HOLDING_TYPES = ['debt_general', 'other'] as const
/** A fuel token with its unit: the fuel's own Table 1 unit or MMBtu. */
const fuelUnitOk = (fuel: string, unit: string) => unit === 'MMBtu' || SCOPE3_SOLD_FUEL_UNITS[fuel] === unit
// --- end I-07 ---

// --- I-12h ---
/** The days of the reporting year of a period (the year in which it ends, DESIGN A24): 366 in a leap year, else 365. */
function daysInYearOf(period: Scope3ReportingPeriod): number {
  const year = yearOf(period)
  return year !== null && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365
}
/** The days of a record's own period (end exclusive; calendar dates the contract validated). PR22 bug hunt A-2. */
const daysInPeriodOf = (period: Scope3ReportingPeriod): number => Math.round((Date.parse(`${period.endExclusive}T00:00:00Z`) - Date.parse(`${period.start}T00:00:00Z`)) / 86_400_000)
// --- end I-12h ---

export function planScope3Calculation(version: Scope3CollectionVersion, context: CollectionContext, evidence: CollectionEvidenceMetadata[], options: Scope3PlanOptions = {}): Scope3CalculationPlan {
  void evidence // Evidence status never decides a Scope 3 calculation; Results shows it per file (B01).
  const state = createScope3PlanState(version, context, options)
  const { a, hold, notes } = state
  if (a.state === 'withdrawn') return hold('withdrawn', ['record_withdrawn'])
  const location = context.locations.find(l => l.id === a.locationId)
  if (!location) return hold('input_needed', ['location_not_in_current_setup'])
  if (!savedAgainstCurrentSetup(a.setupVersionId, context)) notes.push('saved_against_earlier_setup_version')
  if (location.inclusion === 'excluded') return hold('excluded', ['location_excluded_by_company_setup'], notes)
  if (location.inclusion !== 'included') return hold('input_needed', ['location_inclusion_unknown'], notes)
  const eligibility = scope3EligibilityHold(a, context, options)
  if (eligibility) return hold(eligibility.status, eligibility.reasons, notes)
  // I-03 (DESIGN A22, B5a): a spend line a supplier record replaces is excluded, named and never counted.
  const supersededBy = a.kind === 'purchase_spend' ? options.supersession?.get(version.recordId) : undefined
  if (supersededBy !== undefined && a.kind === 'purchase_spend') {
    notes.push(scope3TaxTreatmentNote(a.payload.taxTreatment))
    return hold('excluded', ['superseded_by_supplier_record'], [...notes, `superseded_by:${supersededBy}`])
  }
  // The record is saved and counted; its calculation method arrives in a later increment. Nothing is sent or guessed.
  if (METHOD_NOT_BUILT.has(a.kind)) return hold('input_needed', ['method_not_built_yet'], notes)
  return planScope3Purchases(state) ?? planScope3EnergyAndBuildings(state) ?? planScope3ProductsAndInvestments(state) ?? planScope3TransportWasteAndTravel(state)
}

type Scope3PlanState = ReturnType<typeof createScope3PlanState>

function createScope3PlanState(version: Scope3CollectionVersion, context: CollectionContext, options: Scope3PlanOptions = {}) {
  const a = version.activity
  if (version.companyId !== context.companyId) throw new Error('Collection context belongs to another company.')
  const base = { profile: SCOPE3_COLLECTION_INPUT_PROFILE, recordId: version.recordId, versionId: version.id, revision: version.revision, kind: a.kind, category: categoryOf(a),
    derivedFrom: null, payload: a.payload, sourceId: a.sourceId, locationId: a.locationId, quality: a.quality, estimateBasis: a.estimateBasis }
  const hold = (status: 'withdrawn' | 'excluded' | 'input_needed', reasons: string[], notes: string[] = []): Scope3CalculationPlan => ({ ...base, action: 'hold', status, reasons, notes, call: null })
  const late = options.lateSources ?? SCOPE3_LATE_SOURCES
  const notes: string[] = []
  const period = { start: a.period.start, endExclusive: a.period.endExclusive }
  const q = a.quantity
  const reasons: string[] = []
  // PR22 bug hunt A-4: each reason once (a profile with several bad modes repeated the same sentence on its to-do list).
  const need = (ok: boolean, reason: string) => { if (!ok && !reasons.includes(reason)) reasons.push(reason) }
  // I-05 (A14): a hotel stay is recognised from the mode text, also on a record saved before 0030 (unit written, not normalized).
  const hotel = a.kind === 'business_travel' && scope3IsHotelMode(a.payload.mode)
  // A spend line's amount and currency get their own, more specific reasons (I-03, below); so does a hotel stay.
  if (a.kind !== 'purchase_spend' && !hotel) need(recorded(q), 'quantity_not_calculable')
  const amount = { value: q.normalizedValue, unit: q.normalizedUnit }
  const send = (input: Record<string, unknown>): Scope3CalculationPlan => reasons.length ? hold('input_needed', reasons, notes)
    : { ...base, action: 'calculate', status: null, reasons: [], notes, call: { engine: 'scope3', request: { kind: a.kind, input } } }
  // DESIGN A6: a line whose method is designed but whose factor source is not loaded, once nothing the user can fix is left.
  const pending = (kind: Scope3CalculationPlan['kind'], optional: boolean): Scope3CalculationPlan => reasons.length ? hold('input_needed', reasons, notes)
    : { ...base, kind, action: 'hold', status: 'method_pending', ...(optional ? { optional: true as const } : {}), reasons: ['factor_source_not_yet_loaded'], notes, call: null }

  /** An electricity location as the engine takes it (as Scope 2 and 3C): a listed eGRID subregion and a numeric utility ID or none. */
  const grid = (p: { zip: string | null; subregion: string | null; utilityEiaId: string | null }) => {
    need((ENGINE_SUBREGIONS as readonly string[]).includes(p.subregion ?? ''), 'subregion_not_an_egrid_subregion')
    const utility = p.utilityEiaId === '' ? null : p.utilityEiaId
    need(utility === null || /^[0-9]{1,7}$/.test(utility), 'utility_eia_id_not_numeric')
    return { zip: p.zip, subregion: p.subregion, utilityEiaId: utility }
  }
  const noGrid = { zip: null, subregion: null, utilityEiaId: null }
  /**
   * A15 (Scope 3 Standard Tables A.1 and A.2): a leased asset belongs in category 8 (leased in) or 13 (leased out) only
   * where the company's consolidation approach does not already put it in the company's own scope 1 and 2. Lessee: a
   * finance lease is always scope 1 and 2; an operating lease is scope 1 and 2 under operational control unless the company
   * states why it has no operational control. Lessor: an operating lease is scope 1 and 2 under equity share or financial
   * control. Other categories carry no lease rule.
   */
  const leaseGuard = (category: number, leaseType: 'operating' | 'finance' | null, noControlBasis: string | null) => {
    if (category !== 8 && category !== 13) return
    if (leaseType === null) return need(false, 'lease_type_required')
    if (category === 8 && leaseType === 'finance') return need(false, 'finance_lease_in_scope1_2')
    if (leaseType === 'finance' || options.consolidationApproach === undefined) return
    const approach = options.consolidationApproach
    if (approach === null || approach === 'unknown') return need(false, 'consolidation_approach_required')
    if (category === 8) need(approach !== 'operational_control' || (noControlBasis ?? '').trim().length > 0, 'lease_in_scope1_2_under_boundary')
    else need(approach === 'operational_control', 'lessor_operating_lease_in_scope1_2')
  }
  /** A line that waits for a factor (designed method), with its own reason: a CBECS activity or a hotel country not in R6. */
  const waiting = (kind: Scope3CalculationPlan['kind'], optional: boolean, reason: string): Scope3CalculationPlan => reasons.length ? hold('input_needed', reasons, notes)
    : { ...base, kind, action: 'hold', status: 'method_pending', ...(optional ? { optional: true as const } : {}), reasons: [reason], notes, call: null }
  return { version, a, base, hold, late, notes, period, q, reasons, need, hotel, amount, send, pending, grid, noGrid, leaseGuard, waiting, options }
}

function planScope3Purchases(state: Scope3PlanState): Scope3CalculationPlan | null {
  const { a, q, need, notes, period, options, send } = state
  // --- I-03 --- Purchases (DESIGN §5.1). The engine input is exactly the keys scope3_engine.py's methods take; names,
  // GL accounts, import and duplicate metadata, attestations, supersession and data quality are never sent.
  if (a.kind === 'purchase_spend') {
    const p = a.payload
    // Amount and currency: US dollars only (other currencies are held, never converted); a plain, non-negative amount.
    const usd = q.originalUnit === 'USD'
    need(usd, 'currency_not_supported')
    const written = q.originalValue.trim()
    if (!NUMERIC.test(written)) need(false, 'amount_not_a_number')
    else if (written.startsWith('-') && /[1-9]/.test(written)) need(false, 'negative_amount_not_supported')
    else if (usd) need(recorded(q), 'quantity_not_calculable')
    // NAICS code sets (DESIGN §3.3, B3, B6): categories 1 and 2 take any code, except that energy, other-category and
    // trade-margin codes need the category confirmed; the fallback categories take only their own set.
    const naics = p.naicsCode
    need(naics !== null, 'naics_code_required')
    if (naics !== null) {
      if (p.category === 1 || p.category === 2) {
        if (!p.categoryConfirmed) {
          need(!(SCOPE3_SPEND_NAICS_SETS.energy_confirm as readonly string[]).includes(naics), 'energy_spend_belongs_in_scope_1_2_or_cat3')
          need(!(SCOPE3_SPEND_NAICS_SETS.overlap_confirm as readonly string[]).includes(naics), 'spend_overlaps_other_category')
          need(!(SCOPE3_SPEND_NAICS_SETS.trade_sector as readonly string[]).includes(naics), 'trade_sector_naics_maps_margin_only')
        }
      } else need(scope3SpendNaicsAllowed(p.category, naics), 'naics_not_valid_for_category')
    }
    if (p.category === 3) need(SCOPE3_CATEGORY_3_SPEND_PROXY_ENABLED, 'spend_proxy_for_category_3_not_enabled')
    // Spend is the fallback for categories 3, 4, 5, 6 and 9: the company confirms no activity record covers the same purchase.
    if (p.category !== 1 && p.category !== 2) need(p.activityOverlap === 'none_confirmed', 'spend_overlap_not_confirmed')
    // Category 9 is transport the reporting company did not pay for (Std Table 5.7); paid transport is category 4.
    if (p.category === 9) need(p.paidByReportingCompany === false, 'category_9_spend_paid_by_company')
    // Capital goods count their full acquisition cost (Std Box 5.4); without-margins factors need a factory-gate price.
    if (p.category === 2) need(p.capitalFullCost === true, 'capital_goods_must_be_full_cost')
    need(p.marginChoice === 'with_margins' || p.boughtAtFactoryGate, 'without_margins_requires_factory_gate')
    // A29: a line dated outside the reporting period, or possibly repeating an earlier imported line, is not counted
    // until it is corrected (or confirmed distinct).
    const reportingPeriod = usableReportingPeriod(options.reportingPeriod)
    if (p.lineDate !== null) need(within(p.lineDate, period) && (!reportingPeriod || within(p.lineDate, reportingPeriod)), 'spend_line_date_outside_reporting_period')
    need(p.possibleDuplicateOf === null || p.duplicateConfirmedDistinct, 'possible_duplicate_spend_line')
    // The dollar year: as recorded, else the reporting year (DESIGN §3.1), which is listed on the line.
    let dollarYear = p.dollarYear
    if (dollarYear === null) {
      dollarYear = yearOf(reportingPeriod ?? period)
      notes.push('dollar_year_from_reporting_year')
    }
    need(dollarYear !== null && dollarYear >= SCOPE3_YEAR_MIN && dollarYear <= SCOPE3_YEAR_MAX, 'dollar_year_required')
    // Round 3, lane A (AC-14): the recorded tax treatment is disclosed on the line and for the category; the amount is used as
    // recorded (EPA SC v1.3 factors are per dollar of purchaser or producer price) and the engine input never carries it.
    notes.push(scope3TaxTreatmentNote(p.taxTreatment))
    return send({ period, category: p.category, naicsCode: naics, amount: q.normalizedValue, currency: 'USD', dollarYear, marginChoice: p.marginChoice,
      boughtAtFactoryGate: p.boughtAtFactoryGate, capitalFullCost: p.capitalFullCost })
  }
  if (a.kind === 'purchase_supplier') {
    const p = a.payload
    // A product factor is per unit of exactly the quantity's unit (the engine converts nothing); an allocated total is CO2e.
    const product = p.basis === 'product_factor'
    const units: readonly string[] = product ? SCOPE3_UNIT_FAMILIES.supplierProduct : SCOPE3_UNIT_FAMILIES.supplierAllocated
    const unitOk = units.includes(q.originalUnit)
    need(unitOk, 'unit_not_an_engine_token')
    if (product) {
      if (unitOk) need(p.factorUnit === `kg CO2e per ${q.originalUnit}`, 'factor_unit_mismatch')
      // A per-unit factor has no share: the quantity bought already is the company's own (I-03a decision 1).
      need(p.allocationBasis === 'supplier_allocated', 'allocation_not_applicable_to_product_factor')
    }
    return send({ period, category: p.category, factorOrigin: p.factorOrigin, basis: p.basis, quantity: q.normalizedValue, unit: q.normalizedUnit, factorValue: p.factorValue,
      factorUnit: p.factorUnit, allocationNumerator: p.allocationNumerator, allocationDenominator: p.allocationDenominator, boundary: p.boundary,
      hybridUpstreamCoveredBy: p.hybridUpstreamCoveredBy, gwpBasis: p.gwpBasis, verification: p.verification })
  }
  return null
}

function planScope3EnergyAndBuildings(state: Scope3PlanState): Scope3CalculationPlan | null {
  const { a, q, need, notes, period, options, send, grid, noGrid, leaseGuard, late, pending, waiting, hotel, version, reasons, hold, base } = state
  if (a.kind === 'energy_resold') {
    const p = a.payload
    need((SCOPE3_UNIT_FAMILIES.electricity as readonly string[]).includes(q.originalUnit), 'unit_not_an_engine_token')
    // DESIGN A28, critique I-12: energy resold must be kept out of the company's own Scope 2 records, or it counts twice.
    need(p.resoldEnergyNotInScope2, 'resold_energy_in_scope2_not_confirmed')
    return send({ period, quantity: q.normalizedValue, unit: q.normalizedUnit, gridBasis: p.gridBasis, ...(p.gridBasis === 'subregion' ? grid(p) : noGrid) })
  }
  if (a.kind === 'commuting_average') {
    const p = a.payload
    need(q.originalUnit === 'employee', 'unit_not_an_engine_token')
    for (const m of p.modes) {
      need((SCOPE3_COMMUTING_AVG_MODES as readonly string[]).includes(m.mode), 'mode_not_an_engine_token')
      // Occupancy is per vehicle; rail, bus and walking or cycling take none (the engine refuses it there).
      if (m.occupancy !== null) need((SCOPE3_TRAVEL_MODES as Record<string, string>)[m.mode] === 'vehicle', 'occupancy_not_applicable_to_mode')
      // A share above 100% can never be part of a profile that adds up to 100% (the engine checks the total).
      need(decimalAtMost(m.sharePercent, 100), 'mode_shares_must_total_100')
    }
    // B5(c): a survey profile may not count the same employees' commuting as distance records do.
    // PR22 bug hunt A-3: working days on site are days of the profile's own period; more than the period has would count a whole
    // year of commuting in a shorter profile (a first-quarter profile with 220 days counted the year).
    need(p.workingDays <= daysInPeriodOf(period), 'working_days_exceed_days_in_period')
    const overlaps = options.distanceCommutingPeriods?.some(other => other.start < period.endExclusive && period.start < other.endExclusive) ?? false
    need(p.activityOverlap === 'none_confirmed' || !overlaps, 'commuting_overlap_not_confirmed')
    return send({ period, headcount: q.normalizedValue, workingDays: p.workingDays,
      modes: p.modes.map(m => ({ mode: m.mode, sharePercent: m.sharePercent, oneWayDistance: m.oneWayDistance, distanceUnit: m.distanceUnit, occupancy: m.occupancy })) })
  }
  if (a.kind === 'teleworking') {
    const p = a.payload
    const units: readonly string[] = p.carrier === 'electricity' ? SCOPE3_UNIT_FAMILIES.electricity : SCOPE3_UNIT_FAMILIES.naturalGas
    need(units.includes(q.originalUnit), 'unit_not_an_engine_token')
    return send({ period, carrier: p.carrier, quantity: q.normalizedValue, unit: q.normalizedUnit, ...(p.carrier === 'electricity' ? grid(p) : noGrid) })
  }
  if (a.kind === 'asset_energy') {
    const p = a.payload
    const units: readonly string[] = p.carrier === 'electricity' ? SCOPE3_UNIT_FAMILIES.electricity : p.carrier === 'natural_gas' ? SCOPE3_UNIT_FAMILIES.assetNaturalGas : SCOPE3_UNIT_FAMILIES.refrigerant
    need(units.includes(q.originalUnit), 'unit_not_an_engine_token')
    if (p.carrier === 'refrigerant') need(SCOPE3_GHG_GASES.includes(p.refrigerantGas ?? ''), 'refrigerant_not_an_engine_token')
    if (p.allocation !== null) need(decimalAtMost(p.allocation.occupancyPercent, 100), 'occupancy_percent_over_100')
    leaseGuard(p.category, p.leaseType, p.noOperationalControlBasis)
    return send({ period, category: p.category, carrier: p.carrier, quantity: q.normalizedValue, unit: q.normalizedUnit, ...(p.carrier === 'electricity' ? grid(p) : noGrid),
      refrigerantGas: p.refrigerantGas, allocation: p.allocation === null ? null : { ...p.allocation } })
  }
  if (a.kind === 'partner_reported') {
    const p = a.payload
    need((SCOPE3_UNIT_FAMILIES.supplierAllocated as readonly string[]).includes(q.originalUnit), 'unit_not_an_engine_token')
    leaseGuard(p.category, p.leaseType, p.noOperationalControlBasis)
    return send({ period, category: p.category, quantity: q.normalizedValue, unit: q.normalizedUnit, allocationBasis: p.allocationBasis, allocationNumerator: p.allocationNumerator,
      allocationDenominator: p.allocationDenominator, scope2Basis: p.scope2Basis, gwpBasis: p.gwpBasis, verification: p.verification, periodMatches: p.periodMatches })
  }
  // --- I-12h --- Buildings by floor area (CBECS 2018) and hotel stays (EPA events guidance 2018) (DESIGN 13.2, 13.3, A14, A27).
  if (a.kind === 'building_average') {
    // Everything the user can fix is checked first; an activity without a transcribed CBECS row waits for it.
    const p = a.payload
    need(['sqft', 'm2'].includes(q.originalUnit), 'unit_not_an_engine_token')
    const known = (SCOPE3_CBECS_ACTIVITIES as readonly string[]).includes(p.cbecsActivity)
    need(known, 'cbecs_activity_not_an_engine_token')
    const location = p.gridBasis === 'subregion' ? grid(p) : noGrid
    leaseGuard(p.category, p.leaseType, p.noOperationalControlBasis)
    if (!late.usBuildingHotel2025) return pending('building_average', false)
    // CBECS C24 averages only buildings that use natural gas (conditional intensity): "not known" can be neither applied nor left out.
    // Round 3, lane A (AC-10, DESIGN 4.4): that hold is the engine's (`natural_gas_use_unknown`, input_needed), so the line has an
    // engine result and trace; the adapter sends "unknown" as saved and no longer holds it first.
    // The engine spreads the year's intensity over the days of the reporting year (365 or 366).
    need(p.coveredDays <= daysInYearOf(period), 'covered_days_exceed_days_in_year')
    // PR22 bug hunt A-2: the days covered are days of the record's own period; more than it has would spread a whole year of the
    // building's energy over a shorter record (a first-quarter record with 365 days counted four quarters).
    if (p.coveredDays <= daysInYearOf(period)) need(p.coveredDays <= daysInPeriodOf(period), 'covered_days_exceed_days_in_period')
    if (known && !SCOPE3_CBECS_ACTIVITIES_LOADED.includes(p.cbecsActivity)) return waiting('building_average', false, 'cbecs_activity_not_loaded')
    return send({ period, category: p.category, cbecsActivity: p.cbecsActivity, usesNaturalGas: p.usesNaturalGas, area: q.normalizedValue, areaUnit: q.normalizedUnit,
      coveredDays: p.coveredDays, gridBasis: p.gridBasis, ...location })
  }
  if (hotel) {
    // A14, A27: room-nights, as normalized from 0030 or as written on a record saved before it (no re-save). The hotel's
    // country is the record's own (v2 `hotelCountry`), or else the reporting location's when that is the U.S. (an estimate).
    // The spend-based route (NAICS 721110, category 6) stays available.
    const nights = q.normalizedUnit === 'room-night' ? q.normalizedValue ?? '' : q.originalUnit.trim().toLowerCase() === 'room-night' ? q.originalValue.trim() : null
    need(nights !== null, 'unit_not_an_engine_token')
    need(nights === null || QUANTITY.test(nights), 'quantity_not_calculable')
    const stated = (a.payload as BusinessTravelCollectionPayload).hotelCountry ?? null
    const fromLocation = stated === null && options.locationCountries?.get(a.locationId) === 'US' ? 'US' : null
    if (late.usBuildingHotel2025) need(stated !== null || fromLocation !== null, 'hotel_country_required')
    // hotel_stay is a derived kind (0030 contract, DESIGN 2): the line derives from this business travel record.
    const derivedFrom = { recordId: version.recordId, kind: 'business_travel' }
    const line = !late.usBuildingHotel2025 ? pending('hotel_stay', true)
      : stated !== null && !SCOPE3_HOTEL_COUNTRIES.includes(stated) ? waiting('hotel_stay', true, 'hotel_country_not_in_factor_set')
        : reasons.length ? hold('input_needed', reasons, notes)
          : { ...base, kind: 'hotel_stay' as const, action: 'calculate' as const, status: null, reasons: [], notes,
            call: { engine: 'scope3' as const, request: { kind: 'hotel_stay' as const, input: { period, roomNights: nights, country: stated ?? fromLocation, countryBasis: stated !== null ? 'stated' : 'reporting_location' } } } }
    return line.kind === 'hotel_stay' ? { ...line, derivedFrom } : line
  }
  // --- end I-12h ---
  // --- end I-05 ---

  return null
}

function planScope3ProductsAndInvestments(state: Scope3PlanState): Scope3CalculationPlan | null {
  const { a, q, need, notes, period, options, send, version } = state
  // --- I-07 --- Use of sold products (11), end of life by treatment split (12) and investments (15) (DESIGN §5.1). Product
  // labels, release and split bases, investee names and snapshot dates are never sent.
  if (options.productOverlap?.has(version.recordId) && (a.kind === 'sold_ghg_product' || a.kind === 'end_of_life_split')) notes.push('same_product_in_cat11_ghg_release')
  if (a.kind === 'sold_fuel') {
    const p = a.payload
    const known = SCOPE3_SOLD_FUELS.includes(p.fuel)
    need(known, 'sold_fuel_not_an_engine_token')  // round 2, lane F: its own code (the Scope 1 vehicle code keeps its shipped text)
    if (known) need(fuelUnitOk(p.fuel, q.originalUnit), 'unit_not_the_fuels_unit')
    return send({ period, fuel: p.fuel, quantity: q.normalizedValue, unit: q.normalizedUnit, combustedInUse: p.combustedInUse })
  }
  if (a.kind === 'sold_energy_product') {
    const p = a.payload
    need(q.originalUnit === 'unit', 'unit_not_an_engine_token')
    const electricity = p.energyCarrier === 'electricity', fuel = SCOPE3_SOLD_FUELS.includes(p.energyCarrier)
    need(electricity || fuel, 'energy_carrier_not_an_engine_token')
    if (electricity) need((SCOPE3_UNIT_FAMILIES.electricity as readonly string[]).includes(p.energyUnit), 'energy_unit_not_an_engine_token')
    // Round 2 (ACC-5, DESIGN 13.5): natural gas may also be stated in therms (x 0.1 exactly in the engine).
    if (fuel) need(fuelUnitOk(p.energyCarrier, p.energyUnit) || (p.energyCarrier === 'natural_gas' && p.energyUnit === 'therm'), 'energy_unit_not_an_engine_token')
    need((SCOPE3_USE_REGIONS as readonly string[]).includes(p.useRegion) || (ENGINE_SUBREGIONS as readonly string[]).includes(p.useRegion), 'use_region_not_an_engine_token')
    return send({ period, quantity: q.normalizedValue, lifetimeBasis: p.lifetimeBasis, lifetimeQuantity: p.lifetimeQuantity, energyPerBasis: p.energyPerBasis,
      energyCarrier: p.energyCarrier, energyUnit: p.energyUnit, useRegion: p.useRegion })
  }
  if (a.kind === 'sold_ghg_product') {
    const p = a.payload
    need(q.originalUnit === 'unit', 'unit_not_an_engine_token')
    need(SCOPE3_GHG_GASES.includes(p.gas), 'gas_not_an_engine_token')
    return send({ period, quantity: q.normalizedValue, gas: p.gas, chargePerUnit: p.chargePerUnit, chargeUnit: p.chargeUnit, useReleasePercent: p.useReleasePercent })
  }
  if (a.kind === 'end_of_life_split') {
    // An unknown split is sent as null: the engine holds it (`treatment_split_unknown`), and checks the total and each factor.
    const p = a.payload
    need((SCOPE3_WASTE_MATERIALS as readonly string[]).includes(p.material), 'material_not_an_engine_token')
    need((SCOPE3_WASTE_UNITS as readonly string[]).includes(q.originalUnit), 'unit_not_an_engine_token')
    // A share above 100% can never be part of a split that adds up to 100% (the engine refuses it rather than holding it), so
    // it is held here with the engine's own total reason, as commuting mode shares are (PR22 bug hunt A-1).
    if (p.split !== null) need(SCOPE3_WASTE_TREATMENTS.every(t => decimalAtMost(p.split![t], 100)), 'treatment_split_must_total_100')
    return send({ period, material: p.material, basis: p.basis, split: p.split === null ? null : { ...p.split }, quantity: q.normalizedValue, unit: q.normalizedUnit })
  }
  if (a.kind === 'investment') {
    // The outstanding amount is USD; investee and projected emissions are metric tons CO2e. A revenue-based record needs the
    // revenue and the investee's NAICS code; its revenue year defaults to the reporting year (listed). Projected lifetime
    // emissions are sent only for an initial sponsor, and only both together (else a disclosure, never a hold).
    const p = a.payload
    need(q.originalUnit === 'USD', 'investment_currency_not_supported')
    const eeio = p.path === 'revenue_eeio'
    let revenueYear: number | null = null
    if (eeio) {
      need(p.revenue !== null, 'investee_revenue_required')
      need(p.naicsCode !== null, 'investee_naics_code_required')
      revenueYear = p.revenueYear
      if (revenueYear === null) {
        revenueYear = yearOf(usableReportingPeriod(options.reportingPeriod) ?? period)
        notes.push('revenue_year_from_reporting_year')
      }
      need(revenueYear !== null && revenueYear >= SCOPE3_YEAR_MIN && revenueYear <= SCOPE3_YEAR_MAX, 'revenue_year_required')
    }
    const projection = p.initialSponsor && p.projectedAnnual !== null && p.lifetimeYears !== null
    if (p.initialSponsor && !projection) notes.push('projected_lifetime_emissions_not_provided')
    return send({ period, path: p.path, holdingType: p.holdingType, outstandingAmount: q.normalizedValue, attribution: { ...p.attribution },
      investeeEmissions: eeio ? null : p.investeeEmissions, emissionsVerified: eeio ? null : p.emissionsVerified, gwpBasis: eeio ? null : p.gwpBasis,
      revenue: eeio ? p.revenue : null, revenueYear: eeio ? revenueYear : null, naicsCode: eeio ? p.naicsCode : null,
      projectedAnnual: projection ? p.projectedAnnual : null, lifetimeYears: projection ? p.lifetimeYears : null })
  }
  // --- end I-07 ---

  return null
}

function planScope3TransportWasteAndTravel(state: Scope3PlanState): Scope3CalculationPlan {
  const { a, q, need, period, send, amount } = state
  if (a.kind === 'transport') {
    const p = a.payload
    const vehicle = (SCOPE3_TRANSPORT_VEHICLES as Record<string, { dedicatedVehicle: boolean; sharedVehicle: boolean }>)[p.vehicle]
    need(Boolean(vehicle), 'vehicle_not_an_engine_token')
    need(p.loadBasis !== null, 'load_basis_required')
    if (vehicle && p.loadBasis) {
      need(p.loadBasis === 'dedicated_vehicle' ? vehicle.dedicatedVehicle : vehicle.sharedVehicle, 'load_basis_not_available_for_vehicle')
      need((TRANSPORT_UNITS[p.loadBasis] as readonly string[]).includes(q.originalUnit), 'unit_not_an_engine_token')
    }
    return send({ period, category: p.category, vehicle: p.vehicle, loadBasis: p.loadBasis, activity: amount, thirdPartyFacilities: p.thirdPartyFacilities })
  }
  if (a.kind === 'waste') {
    const p = a.payload
    need((SCOPE3_WASTE_MATERIALS as readonly string[]).includes(p.material), 'material_not_an_engine_token')
    need((SCOPE3_WASTE_TREATMENTS as readonly string[]).includes(p.treatment), 'treatment_not_an_engine_token')
    need((SCOPE3_WASTE_UNITS as readonly string[]).includes(q.originalUnit), 'unit_not_an_engine_token')
    // A treatment EPA marks NA for the material is sent: the engine returns input_needed with its own finding.
    return send({ period, category: p.category, material: p.material, treatment: p.treatment, quantity: q.normalizedValue, unit: q.normalizedUnit })
  }
  if (a.kind === 'business_travel') {
    const p = a.payload
    if (p.mode === SCOPE3_AIR_BY_DISTANCE) {
      need(['mile', 'km'].includes(q.originalUnit), 'unit_not_an_engine_token')
      need(p.passengerSegments !== null, 'passenger_segments_required')
      need(!recorded(q) || Number(q.originalValue) > 0, 'segment_distance_must_be_positive')
      return send({ period, mode: p.mode, segmentDistance: amount, passengerSegments: p.passengerSegments })
    }
    need(p.mode in SCOPE3_TRAVEL_MODES, 'mode_not_an_engine_token')
    // The unit is checked against the mode's own basis, so it is only judged once the mode is an engine token.
    if (p.mode in SCOPE3_TRAVEL_MODES) need(travelUnits(p.mode).includes(q.originalUnit), 'unit_not_an_engine_token')
    if ((SCOPE3_AIR_HAULS as readonly string[]).includes(p.mode)) {
      need(p.haulBasis !== null && p.haulBasis.trim().length > 0, 'haul_basis_required')
      return send({ period, mode: p.mode, activity: amount, haulBasis: p.haulBasis })
    }
    return send({ period, mode: p.mode, activity: amount })
  }
  // I-07: every kind now has its branch, so the compiler proves this line unreachable for any other kind.
  if (a.kind !== 'employee_commuting') throw new Error(`No Scope 3 adapter branch for ${(a as { kind: string }).kind}.`)
  const p = a.payload
  need(SCOPE3_COMMUTING_MODES.includes(p.mode), 'mode_not_an_engine_token')
  if (SCOPE3_COMMUTING_MODES.includes(p.mode)) need(travelUnits(p.mode).includes(q.originalUnit), 'unit_not_an_engine_token')
  return send({ period, mode: p.mode, activity: amount })
}

/**
 * Category 3C for one electricity record. It is planned from the
 * electricity record's own adapter plan, so a held electricity record holds 3C with the same reasons, and the loss is
 * calculated from exactly the quantity, unit, ZIP, subregion and utility the Scope 2 engine receives (S3-03).
 */
export function planGridLossCalculation(electricity: CollectionActivityVersion, context: CollectionContext, evidence: CollectionEvidenceMetadata[]): Scope3CalculationPlan {
  const a = electricity.activity
  if (a.kind !== 'electricity') throw new Error('Grid losses follow an electricity record.')
  const plan = planCollectionCalculation(electricity, context, evidence)
  const base = { profile: SCOPE3_COLLECTION_INPUT_PROFILE, recordId: electricity.recordId, versionId: electricity.id, revision: electricity.revision, kind: 'td_losses' as const, category: 3 as const,
    derivedFrom: { recordId: electricity.recordId, kind: 'electricity' }, payload: a.payload, sourceId: a.sourceId, locationId: a.locationId, quality: a.quality, estimateBasis: a.estimateBasis }
  // Instrument notes belong to the market-based Scope 2 result, not to the losses.
  const notes = plan.notes.filter(note => !/^instrument_\d+_/.test(note))
  if (plan.action === 'hold' || !plan.call || plan.call.engine !== 'scope2')
    return { ...base, action: 'hold', status: plan.status ?? 'input_needed', reasons: ['electricity_record_held', ...plan.reasons], notes, call: null }
  const s2 = plan.call.input
  const input: Record<string, unknown> = { period: s2.period, quantity: s2.quantity, unit: s2.unit, subregion: s2.subregion, zip: s2.zip }
  if (s2.utilityEiaId !== undefined) input.utilityEiaId = s2.utilityEiaId
  return { ...base, action: 'calculate', status: null, reasons: [], notes, call: { engine: 'scope3', request: { kind: 'td_losses', input } } }
}

// --- I-03 --- Supersession (DESIGN §5.1, A22, B5a).
/**
 * The text whose SHA-256 (lowercase hex) is a spend line's mapping key (DESIGN §3.6 revision 1, as 0030's mapping
 * table stores it): the GL account, the vendor (the line's supplier name) and the description, each trimmed and
 * lower-cased, separated by U+001F. The spend import (I-09) computes the same key for a file line.
 */
export function scope3SpendMappingKeyInput(line: { glAccount: string; supplierName: string; description: string }): string {
  return [line.glAccount, line.supplierName, line.description].map(text => text.trim().toLowerCase()).join('\u001f')
}
/** A supplier name as supersession compares it: trimmed, lower case, internal whitespace collapsed. */
const comparableName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')
/**
 * The supersession pre-pass (DESIGN §5.1, A22): which spend lines a supplier's own figure replaces, so the same purchase
 * is never counted twice (the commonest Scope 3 double count). An active category 1 or 2 spend line is superseded by an
 * active supplier record whose `supersedesSpend` names the line's supplier (compared trimmed, lower-cased, whitespace
 * collapsed) or lists the line's mapping key. Both must count in the same reporting period: inside the setup reporting
 * period when there is one (a record outside it is held, so it can replace nothing and is replaced by nothing), else in
 * the same reporting year; and both must be at a location setup includes. When several supplier records match a line,
 * the one with the smallest record ID is named. Returns spend record ID -> superseding record ID; the results route
 * calls it once and passes the map to `planScope3Calculation`, which excludes those lines with the reason
 * `superseded_by_supplier_record` and the note `superseded_by:<recordId>`.
 *
 * `sha256` hashes a mapping-key text to lowercase hex (node:crypto on the server); it is passed in so this module stays
 * browser-safe.
 *
 * I-05 (DESIGN §5.1, B5a): partner figures (`partner_reported.supersedesSpend`) supersede too, with the same reason. A
 * partner's own scope 1 and 2 replace the spend lines of categories 1 and 2 that name it (rent, services) and, when the
 * partner record's category is itself a spend category (4, 5 or 9: carriers, warehouses, waste contractors), the spend
 * lines of that category (the spend-based fallback for the same purchase).
 */
export function planScope3Supersession(versions: readonly Scope3CollectionVersion[], context: CollectionContext,
  options: { reportingPeriod?: Scope3ReportingPeriod | null; sha256: (text: string) => string }): Map<string, string> {
  const reportingPeriod = usableReportingPeriod(options.reportingPeriod !== undefined ? options.reportingPeriod : context.reportingPeriod)
  if (versions.some(v => v.companyId !== context.companyId)) throw new Error('Collection context belongs to another company.')
  const counts = (v: Scope3CollectionVersion) => v.activity.state === 'active' && !scope3EligibilityHold(v.activity, context, options)
  const sameYear = (a: Scope3CollectionVersion, b: Scope3CollectionVersion) => reportingPeriod !== null || yearOf(a.activity.period) === yearOf(b.activity.period)
  const superseders = versions
    .flatMap(v => {
      const a = v.activity
      if ((a.kind !== 'purchase_supplier' && a.kind !== 'partner_reported') || a.payload.supersedesSpend === null || !counts(v)) return []
      // I-05: the spend categories a record can replace (supplier figures: 1 and 2; partner figures: also their own spend category).
      const categories = new Set<number>([1, 2, ...(a.kind === 'partner_reported' && [4, 5, 9].includes(a.payload.category) ? [a.payload.category] : [])])
      return [{ version: v, name: comparableName(a.payload.supersedesSpend.supplierName), keys: new Set(a.payload.supersedesSpend.mappingKeys), categories }]
    })
    .sort((x, y) => x.version.recordId < y.version.recordId ? -1 : x.version.recordId > y.version.recordId ? 1 : 0)
  const out = new Map<string, string>()
  if (superseders.length === 0) return out
  const anyKeys = superseders.some(s => s.keys.size > 0)
  for (const v of versions) {
    const a = v.activity
    if (a.kind !== 'purchase_spend' || !superseders.some(s => s.categories.has(a.payload.category)) || !counts(v)) continue
    const name = comparableName(a.payload.supplierName)
    const key = anyKeys ? options.sha256(scope3SpendMappingKeyInput(a.payload)) : null
    const by = superseders.find(s => s.categories.has(a.payload.category) && sameYear(s.version, v) && ((name !== '' && s.name === name) || (key !== null && s.keys.has(key))))
    if (by) out.set(v.recordId, by.version.recordId)
  }
  return out
}
// --- end I-03 ---

// --- I-05 --- The 3D upstream line and the commuting overlap facts (DESIGN §5.1, §5.2, A28, B5c).
/**
 * Category 3D, upstream of energy resold (A28): the cradle-to-gate part of the resold electricity's life cycle, a line
 * derived from each `energy_resold` record (never stored). It follows its record's own plan, as 3C follows electricity: a
 * held record holds the line with the same reasons. I-12u (DESIGN 13.2): otherwise it is calculated from exactly the 3D
 * record's engine input (resold MWh x the upstream intensity of the same subregion or the U.S.); while R5 is not loaded
 * (`lateSources.usUpstream2025` false) it waits as `method_pending` with `factor_source_not_yet_loaded`.
 */
export function planEnergyResoldUpstream(version: Scope3CollectionVersion, context: CollectionContext, evidence: CollectionEvidenceMetadata[], options: Scope3PlanOptions = {}): Scope3CalculationPlan {
  const a = version.activity
  if (a.kind !== 'energy_resold') throw new Error('The 3D upstream line follows an energy-resold record.')
  const plan = planScope3Calculation(version, context, evidence, options)
  const base = { profile: SCOPE3_COLLECTION_INPUT_PROFILE, recordId: version.recordId, versionId: version.id, revision: version.revision, kind: 'energy_resold_upstream' as const, category: 3 as const,
    derivedFrom: { recordId: version.recordId, kind: 'energy_resold' }, payload: a.payload, sourceId: a.sourceId, locationId: a.locationId, quality: a.quality, estimateBasis: a.estimateBasis }
  if (plan.action === 'hold' || !plan.call) {
    const held = plan.status === 'withdrawn' || plan.status === 'excluded' ? plan.reasons : ['energy_resold_record_held', ...plan.reasons]
    return { ...base, action: 'hold', status: plan.status ?? 'input_needed', reasons: held, notes: plan.notes, call: null }
  }
  // --- I-12u --- (lane A, named lines): the upstream line is calculated from exactly the 3D input.
  if (!(options.lateSources ?? SCOPE3_LATE_SOURCES).usUpstream2025) return { ...base, action: 'hold', status: 'method_pending', reasons: ['factor_source_not_yet_loaded'], notes: plan.notes, call: null }
  if (upstreamRegionUnmapped(plan.call.request.input, options)) return { ...base, action: 'hold', status: 'method_pending', reasons: ['no_upstream_factor_for_subregion_fuels'], notes: plan.notes, call: null }
  return { ...base, action: 'calculate', status: null, reasons: [], notes: plan.notes, call: { engine: 'scope3', request: { kind: 'energy_resold_upstream', input: { ...plan.call.request.input } } } }
  // --- end I-12u ---
}
/**
 * B5(c): the periods of the active distance-based commuting records at locations setup includes (inside the setup
 * reporting period when there is one). An average-data commuting profile whose period overlaps one of them needs the
 * company to confirm the two cover different employees or days (`activityOverlap: 'none_confirmed'`).
 */
export function scope3DistanceCommutingPeriods(versions: readonly Scope3CollectionVersion[], context: CollectionContext, options: { reportingPeriod?: Scope3ReportingPeriod | null } = {}): Scope3ReportingPeriod[] {
  return versions.filter(v => v.companyId === context.companyId && v.activity.kind === 'employee_commuting' && v.activity.state === 'active'
    && !scope3EligibilityHold(v.activity, context, options))
    .map(v => ({ start: v.activity.period.start, endExclusive: v.activity.period.endExclusive }))
}
// --- end I-05 ---

// --- I-07 --- The category 11 / 12 product overlap (DESIGN §5.1, B5(d)).
/**
 * Records of the same product counted in category 12 (an `end_of_life_split`) and as a category 11 greenhouse-gas product
 * whose gas is released in full during use (`useReleasePercent` 100): nothing of that gas is left at end of life, so the
 * category 12 record must count only the product's material. Both records get the note `same_product_in_cat11_ghg_release`,
 * a disclosure on categories 11 and 12 (never a hold). Product labels are compared trimmed, lower-cased, whitespace collapsed;
 * a blank label matches nothing. Records count as in the supersession pre-pass: active, at a location setup includes, inside
 * the setup reporting period (or the same reporting year without one).
 */
export function planScope3ProductOverlap(versions: readonly Scope3CollectionVersion[], context: CollectionContext, options: { reportingPeriod?: Scope3ReportingPeriod | null } = {}): Set<string> {
  const reportingPeriod = usableReportingPeriod(options.reportingPeriod !== undefined ? options.reportingPeriod : context.reportingPeriod)
  if (versions.some(v => v.companyId !== context.companyId)) throw new Error('Collection context belongs to another company.')
  const counts = (v: Scope3CollectionVersion) => v.activity.state === 'active' && !scope3EligibilityHold(v.activity, context, options)
  const label = (v: Scope3CollectionVersion) => {
    const a = v.activity
    const text = a.kind === 'sold_ghg_product' && /^100(\.0+)?$/.test(a.payload.useReleasePercent) ? a.payload.productLabel
      : a.kind === 'end_of_life_split' ? a.payload.productLabel : null
    return text === null ? null : comparableName(text)
  }
  const keyOf = (v: Scope3CollectionVersion) => `${reportingPeriod ? 'period' : yearOf(v.activity.period)}\u0000${label(v)}`
  const ghg = new Map<string, string[]>(), eol = new Map<string, string[]>()
  for (const v of versions) {
    const name = label(v)
    if (name === null || name === '' || !counts(v)) continue
    const target = v.activity.kind === 'sold_ghg_product' ? ghg : eol
    target.set(keyOf(v), [...(target.get(keyOf(v)) ?? []), v.recordId])
  }
  const out = new Set<string>()
  for (const [key, ids] of eol) if (ghg.has(key)) for (const id of [...ids, ...ghg.get(key)!]) out.add(id)
  return out
}
// --- end I-07 ---

// --- I-12u --- Category 3 upstream lines from Scope 1 and 2 records (DESIGN 13.2, 5.1, 5.2).
/** The Scope 1 record kinds a 3A line follows (the engine catalog's `upstreamSources`). */
export const SCOPE3_UPSTREAM_SOURCES = ['natural_gas', 'distillate_no2', 'vehicle'] as const
type UpstreamKind = 'fuel_upstream' | 'electricity_upstream' | 'td_losses_upstream'
/** A line derived from a Scope 1 or 2 record: its base fields (the payload is the source record's; never sent to the engine). */
function derivedBase(version: CollectionActivityVersion, kind: UpstreamKind) {
  const a = version.activity
  return { profile: SCOPE3_COLLECTION_INPUT_PROFILE, recordId: version.recordId, versionId: version.id, revision: version.revision, kind, category: 3 as const,
    derivedFrom: { recordId: version.recordId, kind: a.kind }, payload: a.payload, sourceId: a.sourceId, locationId: a.locationId, quality: a.quality, estimateBasis: a.estimateBasis }
}
/**
 * Category 3A, upstream of purchased fuels: one line per Scope 1 natural gas, stationary No. 2 distillate or vehicle record,
 * planned from the record's own Scope 1 plan (as 3C follows electricity). A Scope 1 record held for input holds its line with
 * `source_scope1_record_held` and the Scope 1 reasons (withdrawn or excluded: the same status and reasons). Otherwise the line
 * sends the engine exactly the energy facts of the Scope 1 input (natural gas: quantity, unit and stated heat content; No. 2
 * distillate: the consumption; vehicle: the fuel and gallons), so the energy is the Scope 1 engine's own. A fuel without a
 * verified upstream factor (a vehicle fuel the pathway list lacks, or liquids while their basis is unverified) waits as
 * `method_pending` with `upstream_factor_not_available_for_fuel`; while R5 is not loaded every line waits for it.
 */
export function planFuelUpstream(version: CollectionActivityVersion, context: CollectionContext, evidence: CollectionEvidenceMetadata[], options: Scope3PlanOptions = {}): Scope3CalculationPlan {
  const a = version.activity
  if (!(SCOPE3_UPSTREAM_SOURCES as readonly string[]).includes(a.kind)) throw new Error('A 3A upstream line follows a natural gas, No. 2 distillate or vehicle record.')
  const plan = planCollectionCalculation(version, context, evidence)
  const base = derivedBase(version, 'fuel_upstream')
  const pending = (reason: string): Scope3CalculationPlan => ({ ...base, action: 'hold', status: 'method_pending', reasons: [reason], notes: plan.notes, call: null })
  if (plan.action === 'hold' || !plan.call || plan.call.engine !== 'scope1') {
    const held = plan.status === 'withdrawn' || plan.status === 'excluded' ? plan.reasons : ['source_scope1_record_held', ...plan.reasons]
    return { ...base, action: 'hold', status: plan.status ?? 'input_needed', reasons: held, notes: plan.notes, call: null }
  }
  if (!(options.lateSources ?? SCOPE3_LATE_SOURCES).usUpstream2025) return pending('factor_source_not_yet_loaded')
  const s1 = plan.call.request.input
  let input: Record<string, unknown>
  if (a.kind === 'natural_gas') input = { period: s1.period, source: 'natural_gas', quantity: s1.quantity, unit: s1.unit, ...(s1.heatContent !== undefined ? { heatContent: s1.heatContent } : {}) }
  else {
    if (!SCOPE3_UPSTREAM_LIQUIDS_VERIFIED) return pending('upstream_factor_not_available_for_fuel')
    if (a.kind === 'distillate_no2') input = { period: s1.period, source: 'distillate_no2', consumption: s1.consumption }
    else {
      if (typeof s1.fuel !== 'string' || !(s1.fuel in SCOPE3_UPSTREAM_VEHICLE_FUELS)) return pending('upstream_factor_not_available_for_fuel')
      input = { period: s1.period, source: 'vehicle', fuel: s1.fuel, gallons: s1.gallons }
    }
  }
  return { ...base, action: 'calculate', status: null, reasons: [], notes: plan.notes, call: { engine: 'scope3', request: { kind: 'fuel_upstream', input } } }
}
/**
 * Category 3B (upstream of purchased electricity) and the upstream part of 3C (of the electricity lost in transmission and
 * distribution): one line each per electricity record, with exactly the 3C input (`planGridLossCalculation`), so a held
 * electricity record holds both with the same reasons and the 3C-upstream line pairs with its 3C line in the aggregate.
 */
export function planElectricityUpstream(electricity: CollectionActivityVersion, context: CollectionContext, evidence: CollectionEvidenceMetadata[], kind: 'electricity_upstream' | 'td_losses_upstream', options: Scope3PlanOptions = {}): Scope3CalculationPlan {
  const loss = planGridLossCalculation(electricity, context, evidence)
  const base = derivedBase(electricity, kind)
  if (loss.action === 'hold' || !loss.call) return { ...base, action: 'hold', status: loss.status, reasons: loss.reasons, notes: loss.notes, call: null }
  if (!(options.lateSources ?? SCOPE3_LATE_SOURCES).usUpstream2025) return { ...base, action: 'hold', status: 'method_pending', reasons: ['factor_source_not_yet_loaded'], notes: loss.notes, call: null }
  if (upstreamRegionUnmapped(loss.call.request.input, options)) return { ...base, action: 'hold', status: 'method_pending', reasons: ['no_upstream_factor_for_subregion_fuels'], notes: loss.notes, call: null }
  return { ...base, action: 'calculate', status: null, reasons: [], notes: loss.notes, call: { engine: 'scope3', request: { kind, input: { ...loss.call.request.input } } } }
}
/**
 * Round 2 (owner decision 3): whether the eGRID region of an upstream line's input (its subregion, or the U.S. for the U.S.
 * average) burns fossil fuel of which none has an upstream factor: a factor gap, held as waiting for a factor source.
 */
function upstreamRegionUnmapped(input: Record<string, unknown>, options: Scope3PlanOptions): boolean {
  const region = typeof input.subregion === 'string' ? input.subregion : 'US'
  return (options.upstreamSubregionsWithoutMappedFossil ?? SCOPE3_UPSTREAM_SUBREGIONS_WITHOUT_MAPPED_FOSSIL).includes(region)
}
// --- end I-12u ---
