// Plain-language labels for the guided journey. Codes stay exact in data and exports; only their display text lives here.
import { SCOPE3_RECORD_STATE_TEXT_I08, SCOPE3_UNIT_TEXT } from "../../../../packages/neuvetra-database/src/scope3-text"
import type { IconName } from "@/components/Icon"

// Round 2 lane E (ENG-6): the activity kinds, kind labels, short units, quality words, reason texts and period labels the
// Scope 3 CSV needs live in the package (the API writes frozen CSVs with them); every name is re-exported here unchanged.
import { ACTIVITY_KINDS } from "../../../../packages/neuvetra-database/src/plain-language-labels"
export { ACTIVITY_KINDS, kindLabel, periodLabel, QUALITY_LABELS, reasonText, SCOPE3_ACTIVITY_KINDS, shortUnit } from "../../../../packages/neuvetra-database/src/plain-language-labels"
// Round 2 lane E (UX-12): a calculated zero says why on its record card (the Results screen reads it from here).
export { scope3KnownZeroLineText } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
const KIND_ICONS: Record<string, IconName> = { natural_gas: "flame", electricity: "bolt", vehicle: "truck", distillate_no2: "generator", fugitive: "snow", transport: "truck", td_losses: "bolt",
  purchase_spend: "file", purchase_supplier: "file", energy_resold: "bolt", commuting_average: "layers", teleworking: "home", asset_energy: "building", partner_reported: "building",
  building_average: "building", sold_fuel: "flame", sold_energy_product: "bolt", sold_ghg_product: "snow", end_of_life_split: "archive", investment: "chart",
  td_losses_upstream: "bolt", electricity_upstream: "bolt", fuel_upstream: "flame", hotel_stay: "building", energy_resold_upstream: "bolt" }
export const sourceCategoryLabel = (category: string) => category === "stationary_combustion" ? "Fuel-burning equipment" : category.replace(/_/g, " ")
export const kindIcon = (kind: string): IconName => KIND_ICONS[kind] ?? "records"
export const kindScope = (kind: string): 1 | 2 => ACTIVITY_KINDS.find(item => item.kind === kind)?.scope ?? 1

export const UNIT_LABELS: Record<string, string> = {
  therm: "therms", MMBtu: "MMBtu", scf: "standard cubic feet (scf)", ccf: "hundred cubic feet (ccf)", mcf: "thousand cubic feet (mcf)",
  US_gallon: "US gallons", kg: "kilograms (kg)", lb: "pounds (lb)", kWh: "kilowatt-hours (kWh)", MWh: "megawatt-hours (MWh)",
  "vehicle-mile": "vehicle-miles", "vehicle-km": "vehicle-kilometres", "short ton-mile": "short ton-miles", "tonne-km": "tonne-kilometres",
  short_ton: "short tons", metric_ton: "metric tons (tonnes)", mile: "miles", km: "kilometres", "passenger-mile": "passenger-miles", "passenger-km": "passenger-kilometres",
  ...SCOPE3_UNIT_TEXT,
}
export const unitLabel = (unit: string) => UNIT_LABELS[unit] ?? unit

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  gasoline_passenger_car: "Passenger car", gasoline_light_duty_truck: "Light-duty truck, van or SUV", gasoline_heavy_duty: "Heavy-duty truck", gasoline_motorcycle: "Motorcycle",
  diesel_passenger_car: "Passenger car", diesel_light_duty_truck: "Light-duty truck or van", diesel_medium_heavy_duty: "Medium or heavy-duty truck",
}
export const TECHNOLOGY_LABELS: Record<string, string> = {
  wind: "Wind", solar_photovoltaic: "Solar PV", hydro: "Hydro", nuclear: "Nuclear", geothermal: "Geothermal", natural_gas: "Natural gas", coal: "Coal", oil: "Oil",
  biomass: "Biomass", biogas: "Biogas", landfill_gas: "Landfill gas", mixed: "Mixed sources", unknown: "Not known yet",
}
export const BOUNDARY_LABELS: Record<string, string> = { unknown: "Not decided yet", operational_control: "Operational control", financial_control: "Financial control", equity_share: "Equity share" }

// Round 2 lane E (ENG-6): REASONS and reasonText moved to packages/neuvetra-database/src/plain-language-labels.ts (re-exported
// above). Append new reason spreads there, in its marked round-2 block.

const plain = (value: string) => /^-?\d+(\.\d+)?$/.test(value)
/** Display a decimal string with thousands separators, without changing any digit. */
export function groupDigits(value: string): string {
  if (!plain(value)) return value
  const negative = value.startsWith("-")
  const [whole, fraction] = (negative ? value.slice(1) : value).split(".")
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${negative ? "−" : ""}${grouped}${fraction !== undefined ? `.${fraction}` : ""}`
}
/** Engine kg CO2e (exact display string) shown as tonnes with two decimals, for headlines only.
 * Tonnes to 2 decimals from the engine's kg string, in exact decimal arithmetic with the engine's rounding rule
 * (half-even), so a headline can never differ from the kg figure by a floating-point or half-up step. */
export function kgToTonnes(kg: string | null | undefined): string {
  if (!kg || !plain(kg)) return "—"
  const negative = kg.startsWith("-")
  const [whole, fraction = ""] = (negative ? kg.slice(1) : kg).split(".")
  // kg as an integer count of 1e-(digits) kg; 0.01 t = 10 kg.
  const scale = 10n ** BigInt(fraction.length)
  const units = BigInt(whole!) * scale + (fraction ? BigInt(fraction) : 0n)
  const step = 10n * scale
  let centi = units / step
  const rest = units % step, half = step / 2n
  if (rest > half || (rest === half && centi % 2n === 1n)) centi += 1n
  const text = `${centi / 100n}.${(centi % 100n).toString().padStart(2, "0")}`
  return groupDigits(`${negative && centi !== 0n ? "-" : ""}${text}`)
}

// Round 2 lane E (ENG-6): periodLabel moved to the package with its date helpers (re-exported above).

/** Record states use the reviewed collection wording (CollectionWorkspace readinessLabels); only "Ready to calculate" is new. */
/** "held_period": dates outside the setup reporting period (a journey check, not a readiness rule).
 *  I-08: "method_pending": a Scope 3 record waiting for a factor source that isn't loaded yet; nothing on it needs to change. */
export type RecordState = "ready" | "partial" | "input_needed" | "review_required" | "held_period" | "excluded" | "memo_only" | "withdrawn" | "method_pending"
export const RECORD_STATE_LABELS: Record<RecordState, string> = {
  ready: "Ready to calculate", partial: "Partial calculation", input_needed: "Input needed", review_required: "Review required", held_period: "Outside reporting period", excluded: "Excluded", memo_only: "Reported separately", withdrawn: "Withdrawn",
  method_pending: SCOPE3_RECORD_STATE_TEXT_I08.method_pending,
}
export const RECORD_STATE_TONE: Record<RecordState, "ready" | "warn" | "danger" | "muted" | "info"> = {
  ready: "ready", partial: "info", input_needed: "warn", review_required: "warn", held_period: "warn", excluded: "muted", memo_only: "info", withdrawn: "muted", method_pending: "info",
}
