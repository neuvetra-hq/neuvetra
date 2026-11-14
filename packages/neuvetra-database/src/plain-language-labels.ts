/**
 * Round 2 lane E (ENG-6; Claude, 31 October 2026): the plain-language labels the Scope 3 CSV needs, moved here from
 * `apps/site-web/src/lib/plain-language.ts` (byte for byte, same order) so the API writes a frozen report's CSV with the
 * package and never imports web source. The web's `plain-language.ts` re-exports every name, so screens are unchanged.
 * Browser-safe, no web imports.
 *
 * Append new reason spreads to `REASONS` below (in its marked blocks), not to the web file. A test fails when an exported
 * `SCOPE3_REASON_TEXT_*` block of `scope3-text.ts` is not spread here.
 */
import type { CollectionActivityKind } from './collection-contract'
import { SCOPE3_COMPLETION_KINDS } from './scope3-collection-contract'
import { SCOPE3_DERIVED_KIND_TEXT, SCOPE3_DERIVED_KIND_TEXT_I02B, SCOPE3_DISCLOSURE_TEXT, SCOPE3_KIND_CATEGORIES_TEXT_I02B, SCOPE3_KIND_TEXT, SCOPE3_REASON_TEXT_I02, SCOPE3_REASON_TEXT_I03, SCOPE3_REASON_TEXT_I04, SCOPE3_REASON_TEXT_I05, SCOPE3_REASON_TEXT_I07, SCOPE3_REASON_TEXT_I12H, SCOPE3_REASON_TEXT_I12U, SCOPE3_REASON_TEXT_R2A, SCOPE3_REASON_TEXT_R2B, SCOPE3_REASON_TEXT_BF01, SCOPE3_REASON_TEXT_BF14 } from './scope3-text'
import type { Scope3CsvLabels } from './scope3-report-csv'

export const ACTIVITY_KINDS: ReadonlyArray<{ kind: CollectionActivityKind; label: string; scope: 1 | 2; source: string; description: string }> = [
  { kind: "natural_gas", label: "Natural gas", scope: 1, source: "Gas bills or meter statements", description: "Gas burned on site for heating, hot water or process equipment." },
  { kind: "electricity", label: "Purchased electricity", scope: 2, source: "Electricity bills for each meter", description: "Electricity bought from a utility or supplier, including any certificates or green tariffs." },
  { kind: "vehicle", label: "Company vehicles", scope: 1, source: "Fuel cards, fuel logs and odometer readings", description: "Fuel burned by cars, vans and trucks the company owns or controls." },
  { kind: "distillate_no2", label: "Generator diesel or fuel oil", scope: 1, source: "Fuel delivery tickets and tank readings", description: "Diesel or No. 2 fuel oil burned in backup generators or other stationary equipment." },
  { kind: "fugitive", label: "Refrigerants and fire suppression", scope: 1, source: "HVAC contractor service records", description: "Refrigerant or suppressant gas that leaked or was topped up during the year." },
]
/**
 * Scope 3 package 2: the four Scope 3 kinds, plus the category 3C line that follows each electricity record. Kept apart
 * from ACTIVITY_KINDS, which drives the Scope 1 and 2 coverage checks.
 */
export const SCOPE3_ACTIVITY_KINDS: ReadonlyArray<{ kind: CollectionActivityKind; label: string; categories: string; source: string; description: string }> = [
  { kind: "transport", label: "Freight transport", categories: "Categories 4 and 9", source: "Freight invoices, carrier reports or shipment logs", description: "Goods moved by truck, rail, ship or air: vehicle-miles for a dedicated vehicle, or ton-miles when the load shares a vehicle." },
  { kind: "waste", label: "Waste", categories: "Categories 5 and 12", source: "Hauler invoices or waste audits", description: "Waste from your operations (5), or the end of life of products you sold (12), by material and treatment." },
  { kind: "business_travel", label: "Business travel", categories: "Category 6", source: "Travel agency or expense reports", description: "Flights, rail, bus and car trips taken for work, by distance." },
  { kind: "employee_commuting", label: "Employee commuting", categories: "Category 7", source: "Commuting surveys", description: "Staff travel between home and work, by mode and distance." },
  // I-02: the 0030 kinds (I-08: each has a form; the collection screen offers a kind only when the server stores it).
  // I-02b: the categories of the kinds 0030's amendments widened.
  ...SCOPE3_COMPLETION_KINDS.map(kind => ({ kind, ...SCOPE3_KIND_TEXT[kind], categories: SCOPE3_KIND_CATEGORIES_TEXT_I02B[kind] ?? SCOPE3_KIND_TEXT[kind].categories })),
]
const OTHER_LABELS: Record<string, string> = { ...SCOPE3_DERIVED_KIND_TEXT, ...SCOPE3_DERIVED_KIND_TEXT_I02B, td_losses: "Grid losses (3C)" }
export const kindLabel = (kind: string) => ACTIVITY_KINDS.find(item => item.kind === kind)?.label ?? SCOPE3_ACTIVITY_KINDS.find(item => item.kind === kind)?.label ?? OTHER_LABELS[kind] ?? kind.replace(/_/g, " ")

/** Scope 3 package 2: the two waste mass units read as words; every Scope 1 and 2 unit is unchanged (their CSV stays byte-identical). */
/** Round 2 lane E (UX-7): a Scope 3 unit that carries a mass token (`metric_ton CO2e`) reads as words too. */
export const shortUnit = (unit: string) => unit === "US_gallon" ? "gal" : unit === "short_ton" ? "short tons" : unit === "metric_ton" ? "metric tons" : unit.replace(/\bmetric_ton\b/g, "metric tons").replace(/\bshort_ton\b/g, "short tons")
/** One wording for data quality everywhere: overview, Ask, results, report and CSV. */
export const QUALITY_LABELS: Record<string, string> = { actual: "Actual", estimated: "Estimated", unknown: "Unknown" }

/** Every adapter hold reason and engine finding, in words a preparer can act on. Unknown codes fall back to a readable form. */
const REASONS: Record<string, string> = {
  // Current-main corporate boundary holds, moved without changing their shipped wording.
  boundary_metadata_unavailable: "Held: reload the company setup boundary details before calculating.",
  location_entity_unresolved: "Held: link this location to an existing company entity, or identify it as directly controlled by the reporting company.",
  entity_excluded_by_company_setup: "Excluded: the location's entity is excluded in company setup.",
  entity_inclusion_unknown: "Held: decide whether the location's entity is included in company setup.",
  equity_share_not_supported: "Held: equity-share allocation is not supported by these draft calculations. No ownership allocation has been applied.",
  boundary_approach_unknown: "Held: choose the company's organizational boundary approach in company setup.",
  entity_outside_control_boundary: "Excluded: company setup states that the entity is outside the selected control boundary.",
  entity_control_unresolved: "Held: confirm the entity's control assessment for the selected boundary approach.",
  location_control_unresolved: "Held: confirm who controls this location and its relationship to the reporting company.",
  reporting_period_unknown: "Held: complete the reporting period in company setup.",
  activity_outside_reporting_period: "Held: this activity extends outside the company's reporting period. Split it using supported source quantities; no prorating was applied.",
  location_coverage_unknown: "Held: complete this location's start and end coverage in company setup.",
  activity_outside_location_coverage: "Held: this activity extends outside the location's reporting coverage. Split it using supported source quantities; no prorating was applied.",
  // collection -> engine adapter (methods v7)
  record_withdrawn: "This record was withdrawn, so it is not counted.",
  location_not_in_current_setup: "Its site is no longer in your company setup. Choose a current site.",
  location_excluded_by_company_setup: "Its site is excluded in your company setup, so it is not counted.",
  outside_reporting_period: "Its dates fall outside the reporting period in company setup, so it is not counted. Change the reporting period in Company setup (02 Reporting period), or correct the record if its dates are wrong.",
  partly_outside_reporting_period: "Its dates are only partly inside the reporting period in company setup, so it is not counted. Change the reporting period in Company setup (02 Reporting period), or save the bill as separate records that each sit inside the period.",
  location_inclusion_unknown: "Company setup hasn’t decided whether this site is included yet.",
  saved_against_earlier_setup_version: "Saved against an earlier company setup version.",
  quantity_not_calculable: "The amount is missing or isn’t a plain number in a supported unit.",
  heat_content_not_numeric: "The heat content from the bill must be a plain number.",
  heat_content_not_used_for_energy_unit: "Heat content isn’t needed for this unit and was not used.",
  gallons_not_numeric: "Gallons must be a plain number.",
  purchased_gallons_not_numeric: "Purchased gallons must be a plain number.",
  opening_gallons_not_numeric: "The opening tank level must be a plain number.",
  closing_gallons_not_numeric: "The closing tank level must be a plain number.",
  stated_hhv_not_numeric: "The stated heating value must be a plain number.",
  fuel_not_an_engine_token: "Choose gasoline or diesel for this vehicle record.",
  vehicle_type_not_an_engine_token: "Choose a vehicle type from the list.",
  model_year_not_covered: "Model year must be between 1960 and 2030.",
  model_year_before_first_factor_band: "Published CH4 and N2O factors for this vehicle type start in 1973. Remove miles/mpg or check the model year.",
  vehicle_count_out_of_range: "Vehicle count must be between 1 and 10,000.",
  miles_and_fuel_economy_both_given: "Use miles driven or fuel economy, not both.",
  miles_not_numeric: "Miles driven must be a plain number.",
  miles_basis_not_an_engine_token: "Say where the miles come from (odometer or trip log).",
  mpg_not_numeric: "Fuel economy must be a plain number above zero.",
  mpg_source_not_an_engine_token: "Say where the fuel economy comes from.",
  subregion_not_an_egrid_subregion: "Look up the ZIP code to set the grid region.",
  zip_not_valid: "Enter a five-digit ZIP code for the meter.",
  utility_eia_id_not_numeric: "Choose the utility from the ZIP lookup.",
  term_PN_not_numeric: "Refrigerant bought to charge new equipment must be a number (use 0 if none).",
  term_CN_not_numeric: "Full charge of new equipment must be a number (use 0 if none).",
  term_PS_not_numeric: "Refrigerant used to service equipment must be a number (use 0 if none).",
  term_CD_not_numeric: "Full charge of retired equipment must be a number (use 0 if none).",
  term_RD_not_numeric: "Refrigerant recovered from retired equipment must be a number (use 0 if none).",
  // Scope 1 engine findings and estimates
  heat_content_required_for_volume: "Gas measured by volume needs the heat content printed on the bill.",
  tank_levels_required_for_purchases: "Purchases alone aren’t enough — add opening and closing tank levels.",
  negative_consumption_from_tank_levels: "Purchases and tank levels give negative fuel use. Check the readings.",
  boundary_membership_unknown: "Say whether this equipment is inside your reporting boundary.",
  outside_declared_boundary: "The equipment is outside your reporting boundary, so it is not counted.",
  simplified_method_applicability_unknown: "Answer the refrigerant stock and retrofit questions.",
  simplified_method_not_applicable: "Refrigerant stock or a retrofit needs a fuller method review.",
  contractor_records_and_chronology_required: "Contractor records and the event timeline must both be complete.",
  negative_material_balance: "The refrigerant amounts give a negative release. Check the five amounts.",
  reported_separately_outside_scope1_total: "This older refrigerant is reported separately, outside the Scope 1 total.",
  period_outside_2025_method_envelope: "The beta methods cover calendar-year 2025 activity only.",
  ch4_n2o_missing: "Only CO2 was calculated. Add miles driven or fuel economy to include CH4 and N2O.",
  default_hhv: "Used the published default heating value for this fuel.",
  unsupported_unit: "This unit isn’t supported for this activity.",
  unsupported_refrigerant: "This refrigerant isn’t supported yet.",
  // A-02: plausibility holds on a stated heat content (adapter)
  heat_content_outside_plausible_range: "The stated heat content is outside the range natural gas can have in this unit. Natural gas is about 1.026 therms per ccf (0.1026 MMBtu per ccf, 1.026 MMBtu per mcf, 0.001026 MMBtu per standard cubic foot); bills at high elevation show less, about 0.75 to 0.9 therms per ccf. Check the unit on the bill: a therm figure entered as MMBtu is ten times too high.",
  heat_content_outside_scf_range: "The stated heat content doesn’t fit a quantity in standard cubic feet (scf). Standard cubic feet are measured at standard conditions, where natural gas is about 1.026 therms per ccf (0.001026 MMBtu per scf), and this check accepts 0.872 to 1.180 therms per ccf (0.000872 to 0.00118 MMBtu per scf) in whatever unit you write it. Check the unit on the bill: a therm figure entered as MMBtu is ten times too high. If the bill’s quantity is metered (ccf or mcf), enter it in that unit instead; metered bills at high elevation show lower heat content, about 0.75 to 0.9 therms per ccf.",
  stated_hhv_outside_plausible_range: "The stated heating value is more than 15% away from the EPA default for No. 2 distillate (0.138 MMBtu per gallon). Check the supplier’s figure and its unit, or leave it blank to use the default.",
  // Scope 2 engine findings
  utility_not_listed_for_zip_and_subregion: "The utility doesn’t match the ZIP code. Run the ZIP lookup again.",
  utility_required_for_multi_subregion_zip: "This ZIP spans more than one grid region. Choose the utility.",
  subregion_not_listed_for_zip: "The grid region doesn’t match the ZIP code. Run the ZIP lookup again.",
  zip_not_in_lookup: "This ZIP code isn’t in the EPA lookup. Check it against the bill.",
  unknown_subregion: "The grid region isn’t recognized. Run the ZIP lookup again.",
  instrument_mwh_required: "Enter how many MWh the certificate or contract covers.",
  instrument_mwh_exceed_consumption: "Certificates cover more MWh than the meter used.",
  instrument_quality_criteria_not_met: "Confirm the certificate meets the market-based quality criteria.",
  instrument_evidence_required: "Link the certificate or contract document.",
  instrument_rate_required: "Enter the emission rate stated for this supply.",
  instrument_rate_not_numeric: "The stated emission rate must be a plain number.",
  instrument_rate_contradicts_technology: "The stated rate contradicts the generation technology.",
  instrument_vintage_not_admissible: "The certificate vintage is outside the accepted 2024–2026 range.",
  vintage_outside_reporting_year: "The certificate vintage is outside the reporting year.",
  bioenergy_instrument_not_supported: "Biomass, biogas and landfill-gas certificates aren’t supported in this beta.",
  instrument_rate_ch4_n2o_from_egrid: "CH4 and N2O for this supply use the grid-region rates.",
  residual_mix_unavailable_location_rate_provisional: "No residual-mix rate for this region; the market-based figure is provisional.",
  // Scope 3 adapter (package 1) and Scope 3 engine findings
  vehicle_not_an_engine_token: "This vehicle isn’t calculated in this beta. Choose a listed vehicle if one fits; otherwise the record stays here as needing input.",
  load_basis_required: "Say whether the goods had a vehicle to themselves (dedicated) or shared it with other loads.",
  load_basis_not_available_for_vehicle: "This vehicle can’t be used with that load basis: rail, ship and air freight are shared; cars and light trucks are dedicated.",
  unit_not_an_engine_token: "This unit isn’t supported for this activity. Choose one from the list.",
  material_not_an_engine_token: "This material isn’t calculated in this beta. Choose a listed material if one fits; otherwise the record stays here as needing input.",
  treatment_not_an_engine_token: "This treatment isn’t calculated in this beta. Choose a listed treatment if one fits; otherwise the record stays here as needing input.",
  passenger_segments_required: "Enter how many one-way flights (passenger segments) the distance covers.",
  segment_distance_must_be_positive: "The flight distance must be more than zero.",
  mode_not_an_engine_token: "This mode (for example a hotel stay) isn’t calculated in this beta. Choose a listed mode if one fits; otherwise the record stays here as needing input.",
  haul_basis_required: "Say how you know the flight length (for example, the booking export).",
  electricity_record_held: "Its electricity record isn’t counted yet, so its grid losses (category 3C) aren’t either.",
  no_published_factor_for_material_and_treatment: "EPA publishes no factor for this material with this treatment. Choose another treatment if one applies.",
  air_haul_declared: "The flight length was declared rather than worked out from the distance.",
  intercity_rail_route_average: "The route isn’t known, so the national intercity rail average was used (an estimate).",
  us_average_grid_loss: "The U.S. average grid loss was used because this region has no specific value (an estimate).",
  // Scope 3 completion (I-02)
  ...SCOPE3_REASON_TEXT_I02,
  // --- I-03 --- purchases: spend and supplier engine findings, adapter holds and line notes
  ...SCOPE3_REASON_TEXT_I03,
  // I-04: audit D11 (`screened_out_with_active_records` had no reviewed wording) and the late-source hold.
  ...SCOPE3_REASON_TEXT_I04,
  // --- I-05 --- energy resold, average commuting, teleworking, asset energy and partner figures: engine findings and adapter holds
  ...SCOPE3_REASON_TEXT_I05,
  // --- I-07 --- sold products, end of life by split and investments: engine findings and estimates, adapter holds and notes
  ...SCOPE3_REASON_TEXT_I07,
  ...SCOPE3_REASON_TEXT_I12U,
  // I-12h: hotel stays and buildings by floor area.
  ...SCOPE3_REASON_TEXT_I12H,
  // --- round 2 --- other lanes: append new reason spreads here (one line each).
  // Round 2, lane B (marked block): the screening-conflict reason (owner decision 5).
  ...SCOPE3_REASON_TEXT_R2B,
  // R2-A (round 2, lane A): the engine's no-upstream-factor finding and the adapter's period holds.
  ...SCOPE3_REASON_TEXT_R2A,
  // BF-01: a counted possible duplicate (count mode; the Scope 3 CSV prints it as a reason code).
  ...SCOPE3_REASON_TEXT_BF01,
  // BF-14: a spend line converted at a rate from another year (or of unknown year).
  ...SCOPE3_REASON_TEXT_BF14,
  // BF-01: a possible duplicate held out of the totals (Scope 1 and 2 records, Scope 3 records and the lines derived from them).
  possible_duplicate_record: 'This record matches another active record (same activity type, location and source ID; for Scope 3, also the same category and quantity) for overlapping dates, so it may be the same record entered twice. It isn’t counted until you withdraw one of them or correct its source ID, location or dates.',
}
export function reasonText(code: string): string {
  if (REASONS[code]) return REASONS[code]!
  const [base, detail] = code.split(":")
  // BF2: the adapter's code keeps its name; the text says quarantine review, not scan. A-03: until it clears, it isn't counted.
  const waiting = /^instrument_(\d+)_evidence_pending_scan$/.exec(code)
  if (waiting) return `Market-based instrument ${waiting[1]} evidence is waiting for quarantine review, so the market-based figure is held until the review clears it.`
  // A-01: one certificate file supports one claim.
  const shared = /^instrument_(\d+)_evidence_shared$/.exec(code)
  if (shared) return `Market-based instrument ${shared[1]} uses a certificate file that also supports another market-based claim. A certificate can be claimed only once, so the market-based figure is held. Give each claim its own certificate or retirement record.`
  const unusable = /^instrument_(\d+)_evidence_not_usable$/.exec(code)
  if (unusable) return `Market-based instrument ${unusable[1]} evidence can’t be used (missing, rejected or failed review), so the market-based figure is held.`
  if (base === "model_year_proxy") return `Model year is newer than the latest published factors; used the ${detail?.replace(/_/g, " ") ?? "latest"} band.`
  if (base === "miles_estimated_from_fuel_economy") return `Miles were estimated from fuel economy (${detail?.replace(/_/g, " ") ?? "stated source"}).`
  if (REASONS[base!]) return REASONS[base!]!
  // Round 2 lane E (UX-7): an engine estimate or note on a Scope 3 line (for example `us_average_grid_rate`) has reviewed
  // words in the disclosure texts; before, it fell through to the humanized code ("Us average grid rate.").
  if (SCOPE3_DISCLOSURE_TEXT[code]) return SCOPE3_DISCLOSURE_TEXT[code]!
  return scope3FallbackText(code)
}
/** The last resort for a code no table names: a readable form of the code. A test fails whenever a known code reaches it. */
export function scope3FallbackText(code: string): string {
  const text = code.replace(/[_:]/g, " ").trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) + "." : "Needs review."
}
/** Whether `reasonText(code)` has reviewed words for the code (round 2 lane E: the UX-7 test asserts this for every known code). */
export function reasonTextKnown(code: string): boolean {
  return reasonText(code) !== scope3FallbackText(code)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
function parts(date: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); return match ? { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) } : null }
function dayBefore(date: string): string | null {
  const p = parts(date); if (!p) return null
  const value = new Date(Date.UTC(p.y, p.m - 1, p.d)); value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}
/** "Jan 1 – Dec 31, 2025" from a start date and an exclusive end date. */
export function periodLabel(start: string | null | undefined, endExclusive: string | null | undefined): string {
  const a = start ? parts(start) : null
  const lastDay = endExclusive ? dayBefore(endExclusive) : null
  const b = lastDay ? parts(lastDay) : null
  if (!a && !b) return "Period not set"
  if (!a) return `Until ${MONTHS[b!.m - 1]} ${b!.d}, ${b!.y}`
  if (!b) return `From ${MONTHS[a.m - 1]} ${a.d}, ${a.y}`
  return a.y === b.y ? `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}` : `${MONTHS[a.m - 1]} ${a.d}, ${a.y} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`
}

/**
 * Scope 3 completion I-10 (moved from the web's `scope3-csv-labels.ts` in round 2, ENG-6): the label functions of the Scope 3
 * CSV, exactly the ones the Results screen's "Download Scope 3 CSV" passes to the shared `scope3Csv`. The API uses them when
 * it freezes a report version, so a stored CSV is the bytes the web would write for the same results (site-web test).
 */
export const SCOPE3_CSV_LABELS: Scope3CsvLabels = { kind: kindLabel, reason: reasonText, period: periodLabel, quality: code => QUALITY_LABELS[code] ?? code, unit: code => shortUnit(code) }
