// Plain-language labels for the guided journey. Codes stay exact in data and exports; only their display text lives here.
import type { CollectionActivityKind } from "../../../../packages/neuvetra-database/src/collection-contract"
import type { IconName } from "@/components/Icon"

export const ACTIVITY_KINDS: ReadonlyArray<{ kind: CollectionActivityKind; label: string; scope: 1 | 2; source: string; description: string }> = [
  { kind: "natural_gas", label: "Natural gas", scope: 1, source: "Gas bills or meter statements", description: "Gas burned on site for heating, hot water or process equipment." },
  { kind: "electricity", label: "Purchased electricity", scope: 2, source: "Electricity bills for each meter", description: "Electricity bought from a utility or supplier, including any certificates or green tariffs." },
  { kind: "vehicle", label: "Company vehicles", scope: 1, source: "Fuel cards, fuel logs and odometer readings", description: "Fuel burned by cars, vans and trucks the company owns or controls." },
  { kind: "distillate_no2", label: "Generator diesel or fuel oil", scope: 1, source: "Fuel delivery tickets and tank readings", description: "Diesel or No. 2 fuel oil burned in backup generators or other stationary equipment." },
  { kind: "fugitive", label: "Refrigerants and fire suppression", scope: 1, source: "HVAC contractor service records", description: "Refrigerant or suppressant gas that leaked or was topped up during the year." },
]
export const kindLabel = (kind: string) => ACTIVITY_KINDS.find(item => item.kind === kind)?.label ?? kind.replace(/_/g, " ")
const KIND_ICONS: Record<string, IconName> = { natural_gas: "flame", electricity: "bolt", vehicle: "truck", distillate_no2: "generator", fugitive: "snow" }
export const kindIcon = (kind: string): IconName => KIND_ICONS[kind] ?? "records"
export const kindScope = (kind: string): 1 | 2 => ACTIVITY_KINDS.find(item => item.kind === kind)?.scope ?? 1

export const UNIT_LABELS: Record<string, string> = {
  therm: "therms", MMBtu: "MMBtu", scf: "standard cubic feet (scf)", ccf: "hundred cubic feet (ccf)", mcf: "thousand cubic feet (mcf)",
  US_gallon: "US gallons", kg: "kilograms (kg)", lb: "pounds (lb)", kWh: "kilowatt-hours (kWh)", MWh: "megawatt-hours (MWh)",
}
export const unitLabel = (unit: string) => UNIT_LABELS[unit] ?? unit
export const shortUnit = (unit: string) => unit === "US_gallon" ? "gal" : unit
/** One wording for data quality everywhere: overview, Ask, results, report and CSV. */
export const QUALITY_LABELS: Record<string, string> = { actual: "Actual", estimated: "Estimated", unknown: "Unknown" }

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  gasoline_passenger_car: "Passenger car", gasoline_light_duty_truck: "Light-duty truck, van or SUV", gasoline_heavy_duty: "Heavy-duty truck", gasoline_motorcycle: "Motorcycle",
  diesel_passenger_car: "Passenger car", diesel_light_duty_truck: "Light-duty truck or van", diesel_medium_heavy_duty: "Medium or heavy-duty truck",
}
export const TECHNOLOGY_LABELS: Record<string, string> = {
  wind: "Wind", solar_photovoltaic: "Solar PV", hydro: "Hydro", nuclear: "Nuclear", geothermal: "Geothermal", natural_gas: "Natural gas", coal: "Coal", oil: "Oil",
  biomass: "Biomass", biogas: "Biogas", landfill_gas: "Landfill gas", mixed: "Mixed sources", unknown: "Not known yet",
}
export const BOUNDARY_LABELS: Record<string, string> = { unknown: "Not decided yet", operational_control: "Operational control", financial_control: "Financial control", equity_share: "Equity share" }

/** Every adapter hold reason and engine finding, in words a preparer can act on. Unknown codes fall back to a readable form. */
const REASONS: Record<string, string> = {
  // collection -> engine adapter (methods v7)
  record_withdrawn: "This record was withdrawn, so it is not counted.",
  location_not_in_current_setup: "Its site is no longer in your company setup. Choose a current site.",
  location_excluded_by_company_setup: "Its site is excluded in your company setup, so it is not counted.",
  outside_reporting_period: "Its dates fall outside the reporting period in company setup, so it is not counted. Correct the record’s dates or the reporting period.",
  partly_outside_reporting_period: "Its dates are only partly inside the reporting period in company setup, so it is not counted. Split it at the period boundary or correct the reporting period.",
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
}
export function reasonText(code: string): string {
  if (REASONS[code]) return REASONS[code]!
  const [base, detail] = code.split(":")
  if (base === "model_year_proxy") return `Model year is newer than the latest published factors; used the ${detail?.replace(/_/g, " ") ?? "latest"} band.`
  if (base === "miles_estimated_from_fuel_economy") return `Miles were estimated from fuel economy (${detail?.replace(/_/g, " ") ?? "stated source"}).`
  if (REASONS[base!]) return REASONS[base!]!
  const text = code.replace(/[_:]/g, " ").trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) + "." : "Needs review."
}

const plain = (value: string) => /^-?\d+(\.\d+)?$/.test(value)
/** Display a decimal string with thousands separators, without changing any digit. */
export function groupDigits(value: string): string {
  if (!plain(value)) return value
  const negative = value.startsWith("-")
  const [whole, fraction] = (negative ? value.slice(1) : value).split(".")
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${negative ? "−" : ""}${grouped}${fraction !== undefined ? `.${fraction}` : ""}`
}
/** Engine kg CO2e (exact display string) shown as tonnes with two decimals, for headlines only. */
export function kgToTonnes(kg: string | null | undefined): string {
  if (!kg || !plain(kg)) return "—"
  const tonnes = Number(kg) / 1000
  return tonnes.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

/** Record states use the reviewed collection wording (CollectionWorkspace readinessLabels); only "Ready to calculate" is new. */
/** "held_period": dates outside the setup reporting period (a journey check, not a readiness rule). */
export type RecordState = "ready" | "partial" | "input_needed" | "review_required" | "held_period" | "excluded" | "memo_only" | "withdrawn"
export const RECORD_STATE_LABELS: Record<RecordState, string> = {
  ready: "Ready to calculate", partial: "Partial calculation", input_needed: "Input needed", review_required: "Review required", held_period: "Held pending correction", excluded: "Excluded", memo_only: "Reported separately", withdrawn: "Withdrawn",
}
export const RECORD_STATE_TONE: Record<RecordState, "ready" | "warn" | "danger" | "muted" | "info"> = {
  ready: "ready", partial: "info", input_needed: "warn", review_required: "warn", held_period: "warn", excluded: "muted", memo_only: "info", withdrawn: "muted",
}
