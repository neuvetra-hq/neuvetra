import { Fragment, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react"
import { deriveCollectionQuantity, savedAgainstCurrentSetup, validateCollectionActivity, withCurrentSetupVersion, type CollectionActivity, type CollectionActivityKind, type CollectionInstrument, type CollectionPayload } from "../../../../packages/neuvetra-database/src/collection-contract"
import { instrumentEvidenceClaims, planCollectionCalculation, type InstrumentEvidenceClaims } from "../../../../packages/neuvetra-database/src/collection-engine-input"
import { isScope3CollectionKind, isScope3CompletionKind, planScope3Calculation, scope3IsHotelMode, SCOPE3_LEGACY_KINDS, SCOPE3_AIR_BY_DISTANCE, SCOPE3_AIR_HAULS, SCOPE3_CABIN_CLASSES, SCOPE3_COLLECTION_UNITS, SCOPE3_COMMUTING_MODES, SCOPE3_HOTEL_MODE, SCOPE3_TRANSPORT_FACILITIES, SCOPE3_TRANSPORT_UNITS, SCOPE3_TRANSPORT_VEHICLES, SCOPE3_TRAVEL_MODES, SCOPE3_WASTE_MATERIALS, type BusinessTravelCollectionPayload, type Scope3CollectionKind, type Scope3CollectionVersion, type Scope3PlanOptions } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { SCOPE3_DISCLOSURE_TEXT, SCOPE3_RECORD_STATE_TEXT_I08 } from "../../../../packages/neuvetra-database/src/scope3-text"
import type { HostedWorkspaceActor } from "@/lib/workspace-api"
import { reasonText, SCOPE3_ACTIVITY_KINDS, unitLabel } from "@/lib/plain-language"
import { CollectionApiError, downloadCollectionEvidence, listCollectionActivities, listCollectionEvidence, listGridLossLineages, loadCollectionContext, loadCollectionOverview, loadCollectionVersion, lookupCollectionZip, saveCollectionActivity, saveGridLossLineage, uploadCollectionEvidence, type CollectionActivityRecord, type CollectionActivitySaveInput, type CollectionActivityVersion, type CollectionContext, type CollectionEvidenceMetadata, type CollectionZipLookup, type GridLossLineage } from "@/lib/collection-api"
import { loadCompanySetup } from "@/lib/company-setup-api"
import { SCOPE3_FORM_KINDS, SCOPE3_FORM_SOURCE_LABELS, scope3BlankPayload, scope3FormGroups, scope3InitialQuantity, scope3Payload, type Scope3SpendLineChoice } from "@/lib/scope3-form-defaults"
import { scope3DataQualityProblem, scope3PayloadLines, scope3PayloadProblem, scope3ReadinessOptions, scope3SetupFacts, scope3SpendLineChoices, scope3TokenOptions, type Scope3SetupFacts } from "@/lib/scope3-forms"
// Round 2 lane E (ENG-13): the record forms, the data-quality editor and the spend import load on first use.
import { DataQualityEditor, Scope3RecordForm, SpendImport } from "./scope3/lazy-forms"
import { COPY_TEXT_R2E, egridSubregionLabel, formatTimeR2E, LOCATION_CONTROL_TEXT_R2E, LOCATION_INCLUSION_TEXT_R2E, SAVE_TEXT_R2E, SAVED_LIST_TEXT_R2E, SCOPE3_TRANSPORT_ANSWER_TEXT_R2E, SCOPE3_TRANSPORT_VEHICLE_TEXT_R2E, SCOPE3_WASTE_MATERIAL_TEXT_R2E, SCOPE3_WASTE_TREATMENT_TEXT_R2E, unitsHintR2E } from "../../../../packages/neuvetra-database/src/scope3-text-r2e"
import { focusRecordEditor, hasRecordFieldFocus } from "@/lib/scope3-fix-target"
// WO-06: a record opens at #/activity/<id> (the record view); the list keeps its filters in #/activity?status=&type=&page=.
import type { ActivityListQuery } from "@/lib/view-route"
// Round 3 lane C (PR-3): the saved-records list is filtered and paged, links to the spend import, and a failed load says so.
import { ACTIVITY_LIST_TEXT_R3C } from "@/lib/scope3-text-r3c"
import { SPEND_IMPORT_ANCHOR } from "@/lib/spend-import-target"
// Round 2c integration: the amount label of the 0029 Scope 3 forms at schema 30 and the estimate-basis message (new texts).
import { SAVE_TEXT_R2C, scope3AmountLabelR2C } from "@/lib/scope3-text-r2c"
import { scope3GroupedAmount, scope3PreSaveProblems, scope3SavedRecordWhen, scope3WasteTreatmentsFor } from "@/lib/scope3-display-r3d"
import { SCOPE3_PRESAVE_TEXT_R3D } from "@/lib/scope3-text-r3d"

const kinds: readonly [CollectionActivityKind, string][] = [
  ["natural_gas", "Natural gas"], ["distillate_no2", "Diesel or fuel-oil generator"],
  ["vehicle", "Road vehicle or vehicle group"], ["fugitive", "Refrigerants and fire suppression"],
  ["electricity", "Purchased electricity"],
]
/** Scope 3 package 2: offered only when the server stores Scope 3 activity (schema 29). */
const scope3Kinds: readonly [CollectionActivityKind, string][] = SCOPE3_ACTIVITY_KINDS.map(item => [item.kind, `${item.label} (Scope 3)`])
const allKinds = [...kinds, ...scope3Kinds]
/**
 * I-02: the Scope 3 kinds this screen has a form for. I-08: every Scope 3 kind (the 0029 kinds here, the 0030 kinds in
 * components/scope3). A kind is offered only when it has a form here and the server lists it as stored by its database
 * (the per-kind capability: the four 0029 kinds at schema 29, every kind at schema 30), grouped by category.
 */
const FORM_KINDS: ReadonlySet<string> = SCOPE3_FORM_KINDS
const kindName = (kind: string) => allKinds.find(([id]) => id === kind)?.[1] ?? kind
const titleCase = (token: string) => token ? token.charAt(0).toUpperCase() + token.slice(1).replace(/_/g, " ") : token
const MODE_LABELS: Record<string, string> = {
  air: "Air, by flight distance", air_short_haul: "Air, short haul (declared)", air_medium_haul: "Air, medium haul (declared)", air_long_haul: "Air, long haul (declared)",
  passenger_car: "Car", light_duty_truck: "Light truck, van or SUV", motorcycle: "Motorcycle", bus: "Bus", commuter_rail: "Commuter rail", transit_rail: "Subway or light rail",
  intercity_rail_northeast_corridor: "Intercity rail, Northeast Corridor", intercity_rail_other_routes: "Intercity rail, other routes", intercity_rail_national_average: "Intercity rail, route not known",
}
const VEHICLE_LABELS: Record<string, string> = SCOPE3_TRANSPORT_VEHICLE_TEXT_R2E
/** The units the Scope 3 engine takes for a travel or commuting mode. */
function travelUnits(mode: string): readonly string[] {
  if (mode === SCOPE3_AIR_BY_DISTANCE) return ["mile", "km"]
  if ((SCOPE3_AIR_HAULS as readonly string[]).includes(mode)) return ["passenger-mile", "passenger-km"]
  const basis = (SCOPE3_TRAVEL_MODES as Record<string, string>)[mode]
  return basis ? [`${basis}-mile`, `${basis}-km`] : []
}
const gases = ["HFC-134a", "HFC-227ea", "R-404A", "R-407C", "R-410A", "R-507A", "R-22", "R-12", "R-502"] as const
const technologies = ["wind", "solar_photovoltaic", "hydro", "nuclear", "geothermal", "natural_gas", "coal", "oil", "biomass", "biogas", "landfill_gas", "mixed", "unknown"] as const
const instrumentTypes: readonly [CollectionInstrument["type"], string][] = [["energy_attribute_certificate", "Energy attribute certificate"], ["power_purchase_agreement", "Power purchase agreement"], ["green_tariff", "Green tariff"], ["supplier_specific_rate", "Supplier-specific rate"]]
const vehicleFuels = ["gasoline", "diesel"] as const
const vehicleTypesByFuel = {
  gasoline: ["gasoline_passenger_car", "gasoline_light_duty_truck", "gasoline_heavy_duty", "gasoline_motorcycle"],
  diesel: ["diesel_passenger_car", "diesel_light_duty_truck", "diesel_medium_heavy_duty"],
} as const
const vehicleTypes = [...vehicleTypesByFuel.gasoline, ...vehicleTypesByFuel.diesel] as const
const supportedUnits: Record<CollectionActivityKind, readonly string[]> = {
  natural_gas: ["therm", "MMBtu", "scf", "ccf", "mcf"],
  distillate_no2: ["US_gallon"], vehicle: ["US_gallon"], fugitive: ["kg", "lb"], electricity: ["kWh", "MWh"],
  ...SCOPE3_COLLECTION_UNITS,
  // I-02: 0030 lets business travel normalize room-night (the hotel form of I-08 sends it to a schema-30 server). This
  // form keeps 0029's units, so a hotel written under "Something else" is saved as written at any schema, never refused.
  business_travel: SCOPE3_COLLECTION_UNITS.business_travel.filter(unit => unit !== "room-night"),
}
/**
 * I-08: the units the screen accepts for a record. A hotel stay (mode "hotel_stay", or a hotel written under "Something
 * else", A14) is counted in room-nights, which the adapter takes as written or normalized; the screen no longer calls them
 * unsupported. Normalizing room-nights needs schema 30 (`completion`), so only then is it normalized on save.
 */
function screenUnits(activity: Pick<CollectionActivity, "kind" | "payload">): readonly string[] {
  if (activity.kind === "business_travel" && "passengerSegments" in activity.payload && scope3IsHotelMode(activity.payload.mode)) return ["room-night"]
  return supportedUnits[activity.kind]
}
const normalizableUnits = (kind: CollectionActivityKind, completion: boolean): readonly string[] => kind === "business_travel" && completion ? SCOPE3_COLLECTION_UNITS.business_travel : supportedUnits[kind]
const DECIMAL = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const THOUSANDS_DECIMAL = /^(?:[1-9][0-9]{0,2})(?:,[0-9]{3})+(?:\.[0-9]{1,3})?$/
const VOLUMETRIC_GAS_UNITS = new Set(["scf", "ccf", "mcf"])
const ZERO_TECHNOLOGIES = new Set<CollectionInstrument["generationTechnology"]>(["wind", "solar_photovoltaic", "hydro", "nuclear"])
type CollectionDraft = CollectionActivity

function shiftDate(value: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ""
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return ""
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const inclusivePeriodEnd = (endExclusive: string) => shiftDate(endExclusive, -1)
export const exclusivePeriodEnd = (lastDayCovered: string) => shiftDate(lastDayCovered, 1)
type CollectionSaveResult = Awaited<ReturnType<typeof saveCollectionActivity>>

function verifiedSavedRecord(companyId: string, recordId: string, result: CollectionSaveResult): CollectionActivityRecord {
  const { record, version } = result
  const versionSummary = record.history.find(item => item.id === version.id)
  if (record.id !== recordId || record.companyId !== companyId || record.currentVersion.recordId !== record.id || record.currentVersion.companyId !== companyId || version.recordId !== record.id || version.companyId !== companyId || !versionSummary || versionSummary.revision !== version.revision || (!result.replayed && record.currentVersion.id !== version.id)) {
    throw new Error("Saved activity could not be verified.")
  }
  return record
}

export function replaceSavedCollectionRecord(records: CollectionActivityRecord[], saved: CollectionActivityRecord): CollectionActivityRecord[] {
  const retained = records.filter(item => item.id !== saved.id)
  retained.push(saved)
  return retained.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}

export async function saveAndVerifyCollectionActivity(companyId: string, recordId: string, input: CollectionActivitySaveInput, actor: HostedWorkspaceActor): Promise<CollectionSaveResult> {
  const result = await saveCollectionActivity(companyId, recordId, input, actor)
  verifiedSavedRecord(companyId, recordId, result)
  return result
}

export function requiresCurrentLocationReselection(activity: Pick<CollectionActivity, "setupVersionId" | "locationId">, context: CollectionContext): boolean {
  // BF2: a setup version with the current version's exact content is the current setup; its sites are unchanged.
  return !savedAgainstCurrentSetup(activity.setupVersionId, context) || !context.locations.some(location => location.id === activity.locationId)
}

export function thousandsSeparatorSuggestion(value: string): string | null {
  if (!THOUSANDS_DECIMAL.test(value)) return null
  const suggestion = value.split(",").join("")
  return DECIMAL.test(suggestion) ? suggestion : null
}

function decimalReason(value: string, label: string): string | null {
  if (!value || value.toLowerCase() === "unknown") return `${label} is missing.`
  if (thousandsSeparatorSuggestion(value)) return `${label} uses thousands separators. Confirm the plain-decimal suggestion before calculation.`
  if (!DECIMAL.test(value)) return `${label} must be a plain decimal with no more than 12 digits before the point and 3 after it.`
  return null
}
const FACTOR_TEXT = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/
const RATE_TEXT = /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,6})?$/
const BIOENERGY_TECHNOLOGIES = new Set<CollectionInstrument["generationTechnology"]>(["biomass", "biogas", "landfill_gas"])
function rateReason(value: string, label: string): string | null {
  if (!value || value.toLowerCase() === "unknown") return `${label} is missing.`
  if (thousandsSeparatorSuggestion(value)) return `${label} uses thousands separators. Confirm the plain-decimal suggestion before calculation.`
  if (!RATE_TEXT.test(value)) return `${label} must be a plain decimal with no more than 6 digits before the point and 6 after it.`
  return null
}
function scaledDecimal(value: string): bigint | null {
  if (!DECIMAL.test(value)) return null
  const [whole, fraction = ""] = value.split(".")
  return BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, "0"))
}

/** `waitingOnEvidence` (BF2): only waiting for a file's quarantine review, nothing to fix. Since A-03 the market-based
 *  result is held meanwhile (shown as partial); the location-based result still calculates.
 *  I-08: `method_pending`: a Scope 3 record whose method is designed but whose factor source isn't loaded yet (DESIGN A6);
 *  it is held, but nothing on the record needs to change, so it is its own state ("Waiting for a factor source"). */
export type CollectionReadinessFinding = { status: "input_needed" | "partial" | "review_required" | "excluded" | "memo_only" | "withdrawn" | "method_pending"; reason: string; waitingOnEvidence?: true }
export function locationReadinessFindings(activity: CollectionActivity, context: CollectionContext | null): CollectionReadinessFinding[] {
  if (!context || !activity.locationId) return []
  const location = context.locations.find(item => item.id === activity.locationId)
  if (!location) return [{ status: "input_needed", reason: "Held: the saved location is no longer present in the current company setup." }]
  if (location.inclusion === "excluded") return [{ status: "excluded", reason: "Held: location excluded by company setup (location_excluded_by_company_setup)." }]
  if (location.inclusion === "unknown") return [{ status: "input_needed", reason: "Held: location inclusion is undecided (location_inclusion_unknown)." }]
  return []
}
export function collectionReadinessFindings(activity: CollectionActivity, evidence: CollectionEvidenceMetadata[] = []): CollectionReadinessFinding[] {
  const draft = activity as CollectionDraft
  if (draft.state === "withdrawn") return [{ status: "withdrawn", reason: `Withdrawn: ${draft.withdrawalReason || "reason unavailable"}` }]
  const findings: CollectionReadinessFinding[] = []
  const add = (status: CollectionReadinessFinding["status"], reason: string) => findings.push({ status, reason })
  if (!draft.locationId) add("input_needed", "A company-setup location is required.")
  if (!draft.setupVersionId) add("input_needed", "The current company setup must be linked.")
  if (!draft.sourceId?.trim()) add("input_needed", "A source identifier is required.")
  for (const evidenceId of activity.evidenceIds) {
    const file = evidence.find(item => item.id === evidenceId)
    if (file?.quarantineStatus === "rejected") add("input_needed", `Linked evidence “${file.originalName}” was rejected and must be unlinked before saving another version.`)
  }
  const quantityReason = decimalReason(activity.quantity.originalValue, "Quantity")
  // Tank-level fuel is checked field by field below; its derived quantity is blank when the balance is negative.
  const tankLevels = activity.kind === "distillate_no2" && "consumption" in activity.payload && activity.payload.consumption.basis === "purchases_with_tank_levels"
  if (activity.kind !== "fugitive" && !tankLevels && quantityReason) add("input_needed", quantityReason)
  if (activity.kind !== "fugitive" && !screenUnits(activity).includes(activity.quantity.originalUnit)) add("input_needed", `Unit “${activity.quantity.originalUnit || "blank"}” is not supported for this activity.`)
  const p = activity.payload
  if (activity.kind === "natural_gas" && "heatContent" in p && VOLUMETRIC_GAS_UNITS.has(activity.quantity.originalUnit)) {
    // Heat content is a conversion factor: up to 6 decimal places (0.1037 MMBtu per ccf is typical), never zero, as the engine takes it.
    const heat = p.heatContent?.value ?? ""
    const heatReason = !heat || heat.toLowerCase() === "unknown" || thousandsSeparatorSuggestion(heat) ? decimalReason(heat, "Bill heat content")
      : !FACTOR_TEXT.test(heat) ? "Bill heat content must be a plain decimal with no more than 12 digits before the point and 6 after it."
      : Number(heat) === 0 ? "Bill heat content must be greater than zero." : null
    if (heatReason) add("input_needed", heatReason)
  }
  if (activity.kind === "distillate_no2" && "consumption" in p) {
    if (p.consumption.basis === "purchases_only") add("input_needed", "Opening and closing tank levels are needed to calculate purchases-only generator fuel.")
    if (p.consumption.basis === "purchases_with_tank_levels") {
      for (const [label, value] of [["Purchased gallons", p.consumption.purchasedGallons], ["Opening tank level", p.consumption.openingGallons], ["Closing tank level", p.consumption.closingGallons]] as const) {
        const issue = decimalReason(value, label)
        if (issue) add("input_needed", issue)
      }
      const [bought, opening, closing] = [p.consumption.purchasedGallons, p.consumption.openingGallons, p.consumption.closingGallons].map(scaledDecimal)
      if (bought != null && opening != null && closing != null && bought + opening - closing < 0n)
        add("review_required", "Purchases plus the opening tank level are less than the closing tank level, so the fuel used would be negative. Check the tank readings.")
    }
  }
  if (activity.kind === "vehicle" && "fuelEconomy" in p) {
    if (!vehicleFuels.includes(p.fuel as typeof vehicleFuels[number])) add("input_needed", p.fuel ? `Vehicle fuel “${p.fuel}” is a legacy or unsupported value. Choose gasoline or diesel before calculation.` : "Choose the vehicle fuel (gasoline or diesel).")
    const allowedVehicleTypes = vehicleFuels.includes(p.fuel as typeof vehicleFuels[number]) ? vehicleTypesByFuel[p.fuel as typeof vehicleFuels[number]] : []
    if (!allowedVehicleTypes.includes(p.vehicleType as never)) add("input_needed", p.vehicleType ? `Vehicle type “${p.vehicleType}” is a legacy, unsupported, or incompatible value. Choose a vehicle type for the selected fuel before calculation.` : "Choose a vehicle type for the selected fuel.")
    if (!Number.isInteger(p.modelYear) || p.modelYear < 1960 || p.modelYear > 2030) add("input_needed", "Model year must be covered by the released vehicle method (1960–2030).")
    if (p.miles && p.fuelEconomy) add("input_needed", "Use recorded miles or fuel economy, not both.")
    else if (p.miles) {
      const issue = decimalReason(p.miles.value, "Miles driven")
      if (issue) add("input_needed", issue)
      if (!["odometer", "trip_log"].includes(p.miles.basis)) add("input_needed", "Miles source must be odometer or trip_log.")
    } else if (p.fuelEconomy) {
      const issue = decimalReason(p.fuelEconomy.mpg, "Fuel economy")
      if (issue || p.fuelEconomy.mpg === "0") add("input_needed", issue ?? "Fuel economy must be greater than zero.")
      if (!["vehicle_record", "fleet_record", "fueleconomy_gov"].includes(p.fuelEconomy.source)) add("input_needed", "Fuel-economy source must be vehicle_record, fleet_record or fueleconomy_gov.")
    } else add("partial", "CO2 can calculate from gallons, but miles or fuel economy is needed to calculate CH4 and N2O.")
  }
  if (activity.kind === "fugitive" && "terms" in p) {
    if (p.insideBoundary === false) add("excluded", "Equipment is outside the declared reporting boundary.")
    else if (p.insideBoundary === null) add("input_needed", "Reporting-boundary answer is unknown.")
    else if (p.maintainsRefrigerantStock === true || p.retrofitInPeriod === true) add("review_required", "The simplified method is not applicable when refrigerant stock is maintained or equipment was retrofitted.")
    else if (p.maintainsRefrigerantStock === null || p.retrofitInPeriod === null) add("input_needed", "Refrigerant-stock and retrofit applicability answers must both be known.")
    else if (!p.contractorRecordsComplete || !p.eventChronologyComplete) add("input_needed", "Contractor records and event chronology must both be complete.")
    else {
      const termValues = (["PN", "CN", "PS", "CD", "RD"] as const).map(term => [term, scaledDecimal(p.terms[term])] as const)
      for (const [term, value] of termValues) {
        const issue = value === null ? decimalReason(p.terms[term], `${term} amount`) : null
        if (issue) add("input_needed", issue)
      }
      if (termValues.every((entry): entry is readonly [typeof entry[0], bigint] => entry[1] !== null)) {
        const values = Object.fromEntries(termValues) as Record<"PN" | "CN" | "PS" | "CD" | "RD", bigint>
        const net = values.PN - values.CN + values.PS + values.CD - values.RD
        if (net < 0n) add("review_required", "The derived refrigerant material balance is negative and requires review.")
        else if (["R-22", "R-12", "R-502"].includes(p.gas)) add("memo_only", `${p.gas} is reported separately outside the Scope 1 total.`)
      }
    }
  }
  if (activity.kind === "electricity" && "instruments" in p) {
    if (!/^\d{5}$/.test(p.zip)) add("input_needed", "A five-digit ZIP is required.")
    if (!p.subregion) add("input_needed", "A verified eGRID subregion is required.")
    if (!p.utilityName.trim()) add("input_needed", "Choose the verified utility serving this meter.")
    p.instruments.forEach((instrument, index) => {
      const prefix = `Market-based instrument ${index + 1}`
      const mwhReason = decimalReason(instrument.mwh, `${prefix} covered MWh`)
      if (mwhReason) add("input_needed", mwhReason)
      if (!instrument.qualityCriteriaMet) add("input_needed", `${prefix} quality criteria are not confirmed.`)
      if (instrument.vintageYear < 2024 || instrument.vintageYear > 2026) add("review_required", `${prefix} vintage is outside the admissible 2024–2026 range.`)
      if (!instrument.evidenceReference) add("input_needed", `${prefix} supporting evidence is missing.`)
      else {
        const file = evidence.find(item => item.id === instrument.evidenceReference)
        if (!file) add("input_needed", `${prefix} evidence file isn’t available to this company.`)
        if (file?.quarantineStatus === "pending") add("input_needed", `${prefix} evidence is waiting for quarantine review.`)
        if (file?.quarantineStatus === "rejected") add("input_needed", `${prefix} evidence was rejected and must be removed.`)
        if (file?.quarantineStatus === "error") add("input_needed", `${prefix} evidence quarantine review failed.`)
      }
      // The engine's rules (scope2 v3): bioenergy claims aren't supported; any other non-zero technology needs a stated
      // rate, and only zero-emission technologies may state a zero CO2 rate. Rates allow 6 digits either side of the point.
      const bioenergy = BIOENERGY_TECHNOLOGIES.has(instrument.generationTechnology)
      if (bioenergy) add("input_needed", `${prefix}: ${instrument.generationTechnology.replace(/_/g, " ")} certificates aren’t supported in this beta.`)
      else if (!ZERO_TECHNOLOGIES.has(instrument.generationTechnology) && !instrument.rateLbPerMwh) add("input_needed", `${prefix} needs a stated rate for this technology.`)
      if (instrument.rateLbPerMwh) {
        for (const [gas, value] of [["CO2", instrument.rateLbPerMwh.co2], ["CH4", instrument.rateLbPerMwh.ch4], ["N2O", instrument.rateLbPerMwh.n2o]] as const) {
          if (value !== null) {
            const issue = rateReason(value, `${prefix} ${gas} rate`)
            if (issue) add("input_needed", issue)
          }
        }
        if (!bioenergy && !ZERO_TECHNOLOGIES.has(instrument.generationTechnology) && RATE_TEXT.test(instrument.rateLbPerMwh.co2) && Number(instrument.rateLbPerMwh.co2) === 0)
          add("review_required", `${prefix} states a zero CO2 rate, which only wind, solar, hydro and nuclear supply can have.`)
      }
    })
    // Certificates may not cover more than the meter used (engine: instrument_mwh_exceed_consumption).
    const used = scaledDecimal(activity.quantity.originalValue)
    const covered = p.instruments.map(instrument => scaledDecimal(instrument.mwh)).reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n)
    const unit = activity.quantity.originalUnit
    if (used !== null && (unit === "MWh" || unit === "kWh") && (unit === "MWh" ? covered > used : covered * 1000n > used))
      add("review_required", "Market-based instruments cover more MWh than the meter used.")
  }
  return findings.filter((finding, index) => findings.findIndex(candidate => candidate.status === finding.status && candidate.reason === finding.reason) === index)
}

/**
 * Adapter reason codes and the screen finding that already explains each one in the screen's own words. An adapter
 * reason is left out only while a blocking screen finding matching it is shown; every other reason is shown as written
 * in plain-language.ts, so no adapter hold can go unexplained.
 */
const SCREEN_EXPLAINS: Readonly<Record<string, RegExp>> = {
  record_withdrawn: /^Withdrawn: /, location_not_in_current_setup: /^(A company-setup location is required|Held: the saved location is no longer present)/,
  location_excluded_by_company_setup: /\(location_excluded_by_company_setup\)/, location_inclusion_unknown: /\(location_inclusion_unknown\)/,
  quantity_not_calculable: /^(Quantity |Unit “)/, gallons_not_numeric: /^Quantity /, heat_content_not_numeric: /^Bill heat content /,
  purchased_gallons_not_numeric: /^Purchased gallons /, opening_gallons_not_numeric: /^Opening tank level /, closing_gallons_not_numeric: /^Closing tank level /,
  fuel_not_an_engine_token: /^(Vehicle fuel “|Choose the vehicle fuel)/, vehicle_type_not_an_engine_token: /^(Vehicle type “|Choose a vehicle type)/,
  model_year_not_covered: /^Model year must be covered/, miles_and_fuel_economy_both_given: /^Use recorded miles or fuel economy, not both/,
  miles_not_numeric: /^Miles driven /, miles_basis_not_an_engine_token: /^Miles source /, mpg_not_numeric: /^Fuel economy /, mpg_source_not_an_engine_token: /^Fuel-economy source /,
  term_PN_not_numeric: /^PN amount /, term_CN_not_numeric: /^CN amount /, term_PS_not_numeric: /^PS amount /, term_CD_not_numeric: /^CD amount /, term_RD_not_numeric: /^RD amount /,
  zip_not_valid: /^A five-digit ZIP is required/, subregion_not_an_egrid_subregion: /^A verified eGRID subregion is required/,
}
const BLOCKING: ReadonlySet<CollectionReadinessFinding["status"]> = new Set(["input_needed", "excluded", "withdrawn"])
const DRAFT_ID = "00000000-0000-4000-8000-000000000000"

/**
 * Readiness shown on the Activity screen, the Overview and Ask, reconciled with the calculation adapter that decides what
 * the engines receive (Claude review N8). The screen's own rules give the wording; the adapter decides the outcome:
 * - adapter holds: every adapter reason is shown (in the screen's words where it has them), at least one finding blocks,
 *   and nothing is called partly calculated (N7: a held record isn't partly calculated);
 * - adapter calculates: an instrument problem only holds the market-based result (engine v3), so it is shown as partial;
 *   an instrument file waiting for quarantine review holds only the market-based result (A-03), so it is shown as
 *   partial and marked waitingOnEvidence (nothing to fix; BF2); a rejected record-level file doesn't stop the engines,
 *   so it is shown for review. A certificate file that also supports another claim (A-01, `claims`) holds the
 *   market-based result the same way, with the adapter's reason.
 *   Holds only the engines decide (purchases-only fuel, refrigerant answers, a negative balance) stay as the screen says.
 * Without a company context the screen's own rules are returned unchanged.
 * I-08: a Scope 3 hold whose status is `method_pending` is shown as its own state ("Waiting for a factor source"), not as
 * input needed: nothing on the record needs to change (an optional activity, such as a hotel stay, also says it is listed
 * and not counted). `scope3` passes the plan options the results route uses (reporting period, consolidation approach,
 * distance commuting periods, supersession keyed by record ID) and the record's own ID, so the screen shows the holds
 * Results will apply; without it a Scope 3 record is planned on its own, as before.
 */
export function recordReadiness(activity: CollectionActivity, context: CollectionContext | null, evidence: CollectionEvidenceMetadata[] = [], claims?: InstrumentEvidenceClaims, scope3?: { options: Scope3PlanOptions; recordId: string }): CollectionReadinessFinding[] {
  const screen = [...collectionReadinessFindings(activity, evidence), ...locationReadinessFindings(activity, context)]
  if (!context) return screen
  let plan: Pick<ReturnType<typeof planCollectionCalculation>, "action" | "reasons" | "notes"> & { status: ReturnType<typeof planCollectionCalculation>["status"] | "method_pending"; optional?: true }
  try {
    const version = { id: DRAFT_ID, recordId: DRAFT_ID, companyId: context.companyId, revision: 0, previousVersionId: null, correctionReason: null, activity, payloadSha256: "0".repeat(64), createdBy: DRAFT_ID, createdAt: "1970-01-01T00:00:00.000Z" }
    // The supersession map is keyed by record ID, and this version stands in for the record under DRAFT_ID.
    const superseding = scope3?.options.supersession?.get(scope3.recordId)
    const options: Scope3PlanOptions = scope3 ? { ...scope3.options, supersession: new Map(superseding === undefined ? [] : [[DRAFT_ID, superseding]]) } : {}
    // Scope 3 package 2: Scope 3 records are planned by the Scope 3 adapter, exactly as Results plans them.
    plan = isScope3CollectionKind(activity.kind) ? planScope3Calculation(version as unknown as Scope3CollectionVersion, context, evidence, options) : planCollectionCalculation(version, context, evidence, claims)
  } catch { return screen }
  const unique = (items: CollectionReadinessFinding[]) => items.filter((item, index) => items.findIndex(other => other.status === item.status && other.reason === item.reason) === index)
  if (plan.action === "hold") {
    const status = (plan.status ?? "input_needed") as CollectionReadinessFinding["status"]
    const kept = screen.filter(finding => finding.status !== "partial")
    const explained = (code: string) => { const pattern = SCREEN_EXPLAINS[code]; return !!pattern && kept.some(finding => BLOCKING.has(finding.status) && pattern.test(finding.reason)) }
    const optional = plan.status === "method_pending" && plan.optional ? [{ status, reason: SCOPE3_DISCLOSURE_TEXT.optional_activity_not_yet_quantified! }] : []
    return unique([...kept, ...plan.reasons.filter(code => !explained(code)).map(code => ({ status, reason: reasonText(code) })), ...optional])
  }
  const shared = (plan.notes ?? []).filter(note => /^instrument_\d+_evidence_shared$/.test(note)).map((note): CollectionReadinessFinding => ({ status: "partial", reason: `Market-based result held — ${reasonText(note)}` }))
  return unique([...screen.map((finding): CollectionReadinessFinding => {
    if (finding.status === "partial") return finding
    // The engines calculate these; the finding is something to check, not a hold.
    if (finding.reason.startsWith("Linked evidence “")) return { status: "review_required", reason: finding.reason }
    if (!finding.reason.startsWith("Market-based instrument")) return finding
    if (finding.reason.endsWith(" evidence is waiting for quarantine review.")) return { status: "partial", reason: `Market-based result held — ${finding.reason.slice(0, -1)}; it counts once the review clears the file.`, waitingOnEvidence: true }
    return { status: "partial", reason: `Market-based result held — ${finding.reason}` }
  }), ...shared])
}

/** A saved vehicle record whose fuel or vehicle type is a legacy value (not blank, not a FIELDS token, or not a pair). A new record's blank choices are not legacy (N7). */
export function legacyVehicleValues(saved: CollectionActivity | null): { fuel: string; vehicleType: string } | null {
  if (saved?.kind !== "vehicle" || !("vehicleType" in saved.payload)) return null
  const { fuel, vehicleType } = saved.payload
  if (!fuel && !vehicleType) return null
  const fuelOk = vehicleFuels.includes(fuel as typeof vehicleFuels[number])
  const typeOk = !vehicleType || (fuelOk ? (vehicleTypesByFuel[fuel as typeof vehicleFuels[number]] as readonly string[]).includes(vehicleType) : vehicleTypes.includes(vehicleType as typeof vehicleTypes[number]))
  return (fuel && !fuelOk) || !typeOk ? { fuel, vehicleType } : null
}

export function notCalculableReasons(activity: CollectionActivity, evidence: CollectionEvidenceMetadata[] = []): string[] {
  return collectionReadinessFindings(activity, evidence).map(finding => finding.reason)
}

export function periodsOverlap(left: CollectionActivity["period"], right: CollectionActivity["period"]): boolean {
  return left.start < right.endExclusive && right.start < left.endExclusive
}

export function automaticZipSelection(lookup: CollectionZipLookup): { subregion: string; utilityName: string; utilityEiaId: string | null } | null {
  if (!lookup.found || lookup.subregions.length !== 1) return null
  const utility = lookup.utilities.length === 1 ? lookup.utilities[0]! : null
  return { subregion: lookup.subregions[0]!, utilityName: utility?.utility ?? "", utilityEiaId: utility?.eiaId || null }
}

export function isDefiniteUploadFailure(cause: unknown): cause is CollectionApiError {
  return cause instanceof CollectionApiError && ([401, 403, 413, 415].includes(cause.status) || cause.status === 422 && cause.code === "file_type_mismatch")
}

/** The units offered for a Scope 3 draft: the engine's own units for what has been chosen so far. I-08: a hotel stay at schema 30 is in room-nights. */
function scope3UnitChoices(draft: CollectionDraft, completion: boolean): readonly string[] {
  if (draft.kind === "transport") return draft.payload.loadBasis ? SCOPE3_TRANSPORT_UNITS[draft.payload.loadBasis] : SCOPE3_COLLECTION_UNITS.transport
  if (draft.kind === "waste") return SCOPE3_COLLECTION_UNITS.waste
  if (draft.kind === "business_travel" && completion && scope3IsHotelMode(draft.payload.mode)) return ["room-night"]
  if (draft.kind === "business_travel") return travelUnits(draft.payload.mode).length ? travelUnits(draft.payload.mode) : supportedUnits.business_travel
  if (draft.kind === "employee_commuting") return travelUnits(draft.payload.mode).length ? travelUnits(draft.payload.mode) : SCOPE3_COLLECTION_UNITS.employee_commuting
  return []
}

/** A new record of the kind. I-08: the 0030 kinds start from their empty payload; business travel at schema 30 uses the v2 payload (cabin class, hotel country). */
function initial(kind: CollectionActivityKind, completion = false): CollectionDraft {
  if (isScope3CompletionKind(kind)) return { kind, locationId: "", setupVersionId: "", sourceId: "", state: "active", withdrawalReason: null, quantity: scope3InitialQuantity(kind), quality: "unknown", estimateBasis: null,
    period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [], payload: scope3BlankPayload(kind) } as CollectionDraft
  const unit = supportedUnits[kind][0]!
  const payload: CollectionPayload = kind === "natural_gas" ? { heatContent: null }
    : kind === "distillate_no2" ? { consumption: { basis: "measured", gallons: "" }, statedHhvMmbtuPerGallon: null }
    : kind === "vehicle" ? { vehicleGroupId: "", fuel: "", vehicleType: "", modelYear: 2025, gallons: "", vehicleCount: null, miles: null, fuelEconomy: null }
    : kind === "fugitive" ? { gas: "HFC-134a", unit: "kg", terms: { PN: "", CN: "", PS: "", CD: "", RD: "" }, insideBoundary: null, maintainsRefrigerantStock: null, retrofitInPeriod: null, contractorRecordsComplete: false, eventChronologyComplete: false }
    : kind === "transport" ? { category: 4, vehicle: "", loadBasis: null, thirdPartyFacilities: "unknown" }
    : kind === "waste" ? { category: 5, material: "", treatment: "" }
    : kind === "business_travel" ? (completion ? { mode: "", passengerSegments: null, haulBasis: null, cabinClass: null, hotelCountry: null } : { mode: "", passengerSegments: null, haulBasis: null })
    : kind === "employee_commuting" ? { mode: "" }
    : { meterOrAccountNumber: "", utilityName: "", site: "", zip: "", subregion: "", utilityEiaId: null, instruments: [] }
  return { kind, locationId: "", setupVersionId: "", sourceId: "", state: "active", withdrawalReason: null, quantity: { originalValue: "", originalUnit: unit, normalizedValue: null, normalizedUnit: null }, quality: "unknown", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "", notes: "", evidenceIds: [], payload } as CollectionDraft
}

// Round 3 lane D (PR-12): a field named by a problem that keeps Save off is marked invalid and described by that list.
const invalidProps = (invalid: boolean) => invalid ? { "aria-invalid": true, "aria-describedby": "collection-save-problems" } as const : {}
function Field({ label, value, onChange, hint, type = "text", required = false, invalid = false }: { label: string; value: string; onChange: (value: string) => void; hint?: string; type?: string; required?: boolean; invalid?: boolean }) {
  return <label className="setup-field"><span>{label}</span><input type={type} required={required} value={value} onChange={event => onChange(event.target.value)} {...invalidProps(invalid)} />{hint && <small>{hint}</small>}</label>
}
function Select({ label, value, options, onChange, hint, invalid = false }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void; hint?: string; invalid?: boolean }) {
  return <label className="setup-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)} {...invalidProps(invalid)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>{hint && <small>{hint}</small>}</label>
}
/**
 * Scope 3 package 2 (beta client run, 26 October 2026): a list of supported choices plus "Something else". An activity
 * the beta can't calculate (a hotel stay, an unlisted material or unit) is still recorded: it is saved with the client's
 * own words, shown as needing input with the reason, and never counted as zero. Up to 80 characters, as the database
 * stores it.
 */
const OTHER = "__other__"
function ChoiceOrOther({ label, value, choices, placeholder, otherLabel, describeLabel, onChange, hint, invalid = false }: { label: string; value: string; choices: readonly (readonly [string, string])[]; placeholder: string; otherLabel: string; describeLabel: string; onChange: (value: string) => void; hint?: string; invalid?: boolean }) {
  const known = choices.some(([id]) => id === value)
  const selected = value === "" ? "" : known ? value : OTHER
  return <>
    <Select label={label} value={selected} options={[["", placeholder] as const, ...choices, [OTHER, otherLabel] as const]} onChange={next => onChange(next === OTHER ? (known || value === "" ? "other" : value) : next)} hint={hint} invalid={invalid} />
    {selected === OTHER && <Field label={describeLabel} value={value} onChange={next => onChange(next.slice(0, 80) || "other")} hint="Saved and shown as needing input. It isn’t calculated in this beta and is never counted as zero." />}
  </>
}
function Tri({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  return <Select label={label} value={value === null ? "unknown" : value ? "yes" : "no"} options={[["unknown", "I don't know yet"], ["yes", "Yes"], ["no", "No"]]} onChange={item => onChange(item === "unknown" ? null : item === "yes")} />
}
const answer = (value: boolean | null) => value === null ? "Unknown" : value ? "Yes" : "No"
/** Air by distance or a declared air haul: the modes whose cabin class the v2 business travel payload records. */
const isAirMode = (mode: string) => mode === SCOPE3_AIR_BY_DISTANCE || (SCOPE3_AIR_HAULS as readonly string[]).includes(mode)
/** I-08: business travel's v2 payload (schema 30) has both cabin class and hotel country, or neither (0030's rule). */
function withTravelV2(payload: BusinessTravelCollectionPayload) {
  if (!("cabinClass" in payload)) payload.cabinClass = null
  if (!("hotelCountry" in payload)) payload.hotelCountry = null
}
const readinessLabels: Record<CollectionReadinessFinding["status"], string> = { input_needed: "Input needed", partial: "Partial calculation", review_required: "Review required", excluded: "Excluded", memo_only: "Reported separately", withdrawn: "Withdrawn", method_pending: SCOPE3_RECORD_STATE_TEXT_I08.method_pending }
function ReadinessPanel({ findings }: { findings: CollectionReadinessFinding[] }) {
  if (!findings.length) return null
  const statuses = [...new Set(findings.map(finding => finding.status))]
  return <div className="collection-readiness" role="status">{statuses.map(status => <div key={status}><strong>{readinessLabels[status]}</strong><ul>{findings.filter(finding => finding.status === status).map(finding => <li key={finding.reason}>{finding.reason}</li>)}</ul></div>)}</div>
}
function HistoricalActivityDetail({ version, evidence }: { version: CollectionActivityVersion; evidence: CollectionEvidenceMetadata[] }) {
  const activity = version.activity as CollectionDraft
  const p = activity.payload
  const findings = collectionReadinessFindings(activity, evidence)
  return <div className="setup-history-detail">
    <h4>Saved version {version.revision}</h4>
    <p>Saved {formatTimeR2E(version.createdAt)}. Read only. {version.correctionReason || "Initial entry"}</p>
    <dl className="collection-history-fields">
      <dt>Activity</dt><dd>{kindName(activity.kind)}</dd>
      <dt>Status</dt><dd>{activity.state === "withdrawn" ? `Withdrawn · ${activity.withdrawalReason || "reason unavailable"}` : "Active"}</dd>
      <dt>Period</dt><dd>{activity.period.start} to {inclusivePeriodEnd(activity.period.endExclusive)} (last day covered)</dd>
      <dt>{activity.kind === "fugitive" ? "Derived net refrigerant release" : "Original quantity"}</dt><dd>{activity.quantity.originalValue || "Unknown"} {unitLabel(activity.quantity.originalUnit)}</dd>
      <dt>Normalized quantity</dt><dd>{activity.quantity.normalizedValue === null ? "Not calculable yet" : `${activity.quantity.normalizedValue} ${activity.quantity.normalizedUnit}`}</dd>
      <dt>Quality</dt><dd>{activity.quality}{activity.estimateBasis ? ` · ${activity.estimateBasis}` : ""}</dd>
      <dt>Reference</dt><dd>{activity.reference || "None entered"}</dd>
      <dt>Notes</dt><dd>{activity.notes || "None entered"}</dd>
      <dt>Evidence</dt><dd>{activity.evidenceIds.length ? activity.evidenceIds.map(id => evidence.find(item => item.id === id)?.originalName ?? id).join("; ") : "None linked"}</dd>
      {findings.length > 0 && <><dt>Calculation readiness</dt><dd>{findings.map(finding => `${readinessLabels[finding.status]}: ${finding.reason}`).join(" ")}</dd></>}
      {activity.kind === "natural_gas" && "heatContent" in p && <><dt>Bill heat content</dt><dd>{p.heatContent ? `${p.heatContent.value} ${p.heatContent.unit}` : "Unknown or not required"}</dd></>}
      {activity.kind === "distillate_no2" && "consumption" in p && <><dt>Generator basis</dt><dd>{p.consumption.basis.replace(/_/g, " ")}</dd><dt>Fuel amounts</dt><dd>{p.consumption.basis === "measured" ? `${p.consumption.gallons || "unknown"} gallons used` : `${p.consumption.purchasedGallons || "unknown"} gallons purchased${p.consumption.basis === "purchases_with_tank_levels" ? `; opening ${p.consumption.openingGallons || "unknown"}; closing ${p.consumption.closingGallons || "unknown"}` : ""}`}</dd><dt>Stated heating value</dt><dd>{p.statedHhvMmbtuPerGallon || "None"}</dd></>}
      {activity.kind === "vehicle" && "vehicleGroupId" in p && <><dt>Vehicle or group ID</dt><dd>{p.vehicleGroupId}</dd><dt>Fuel and vehicle</dt><dd>{p.fuel}; {p.vehicleType}; model year {p.modelYear}; {p.gallons || "unknown"} US gallons; {p.vehicleCount ?? "unknown"} vehicles</dd><dt>Distance</dt><dd>{p.miles ? `${p.miles.value || "unknown"} miles (${p.miles.basis})` : "No miles recorded"}</dd><dt>Fuel economy</dt><dd>{p.fuelEconomy ? `${p.fuelEconomy.mpg || "unknown"} mpg (${p.fuelEconomy.source})` : "No MPG recorded"}</dd></>}
      {activity.kind === "fugitive" && "terms" in p && <><dt>Gas and unit</dt><dd>{p.gas}, {p.unit}</dd><dt>Five material-balance terms</dt><dd>PN {p.terms.PN || "unknown"}; CN {p.terms.CN || "unknown"}; PS {p.terms.PS || "unknown"}; CD {p.terms.CD || "unknown"}; RD {p.terms.RD || "unknown"}</dd><dt>Boundary</dt><dd>{answer(p.insideBoundary)}</dd><dt>Refrigerant stock tracked</dt><dd>{answer(p.maintainsRefrigerantStock)}</dd><dt>Retrofit during period</dt><dd>{answer(p.retrofitInPeriod)}</dd><dt>Contractor records complete</dt><dd>{answer(p.contractorRecordsComplete)}</dd><dt>Event chronology complete</dt><dd>{answer(p.eventChronologyComplete)}</dd></>}
      {activity.kind === "transport" && "loadBasis" in p && <><dt>Freight</dt><dd>Category {p.category}; {VEHICLE_LABELS[p.vehicle] ?? (p.vehicle || "vehicle not chosen")}; {p.loadBasis ? SCOPE3_TRANSPORT_ANSWER_TEXT_R2E[p.loadBasis] ?? p.loadBasis : "load basis unknown"}; third-party facilities {SCOPE3_TRANSPORT_ANSWER_TEXT_R2E[p.thirdPartyFacilities] ?? p.thirdPartyFacilities}</dd></>}
      {activity.kind === "waste" && "treatment" in p && <><dt>Waste</dt><dd>Category {p.category}; {SCOPE3_WASTE_MATERIAL_TEXT_R2E[p.material] ?? (p.material || "material not chosen")}; {SCOPE3_WASTE_TREATMENT_TEXT_R2E[p.treatment] ?? (p.treatment || "treatment not chosen")}</dd></>}
      {activity.kind === "business_travel" && "passengerSegments" in p && <><dt>Travel</dt><dd>{MODE_LABELS[p.mode] ?? (p.mode || "mode not chosen")}{p.passengerSegments !== null ? `; ${p.passengerSegments} passenger segments` : ""}{p.haulBasis ? `; haul basis: ${p.haulBasis}` : ""}{p.cabinClass ? `; cabin class ${p.cabinClass.replace(/_/g, " ")}` : ""}{p.hotelCountry ? `; hotel country ${p.hotelCountry}` : ""}</dd></>}
      {isScope3CompletionKind(activity.kind) && scope3PayloadLines(p).filter(([label]) => label !== "Data quality").map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>)}
      {isScope3CollectionKind(activity.kind) && "dataQuality" in p && p.dataQuality && <><dt>Data quality set by the company</dt><dd>{Object.entries(p.dataQuality.indicators).filter(([, rating]) => rating !== null).map(([name, rating]) => `${name} ${rating!.replace(/_/g, " ")}`).join("; ") || "No ratings"}{p.dataQuality.activityDataOrigin ? `; origin ${p.dataQuality.activityDataOrigin.replace(/_/g, " ")}` : ""}{p.dataQuality.basis ? `; ${p.dataQuality.basis}` : ""}</dd></>}
      {activity.kind === "employee_commuting" && "mode" in p && !("passengerSegments" in p) && <><dt>Commuting</dt><dd>{MODE_LABELS[p.mode] ?? (p.mode || "mode not chosen")}</dd></>}
      {activity.kind === "electricity" && "instruments" in p && <><dt>Site and meter</dt><dd>{p.site}; {p.meterOrAccountNumber}; utility {p.utilityName}</dd><dt>Grid location</dt><dd>ZIP {p.zip}; subregion {p.subregion ? egridSubregionLabel(p.subregion) : "unresolved"}; utility EIA ID {p.utilityEiaId || "unresolved"}</dd><dt>Instruments</dt><dd>{p.instruments.length ? <ol>{p.instruments.map((instrument, index) => <li key={index}>{instrument.type.replace(/_/g, " ")}; {instrument.mwh || "unknown"} MWh; vintage {instrument.vintageYear}; {instrument.generationTechnology.replace(/_/g, " ")}; quality criteria {answer(instrument.qualityCriteriaMet)}; evidence {instrument.evidenceReference ? evidence.find(item => item.id === instrument.evidenceReference)?.originalName ?? instrument.evidenceReference : "missing"}; rate {instrument.rateLbPerMwh ? `CO2 ${instrument.rateLbPerMwh.co2 || "unknown"}, CH4 ${instrument.rateLbPerMwh.ch4 ?? "unknown"}, N2O ${instrument.rateLbPerMwh.n2o ?? "unknown"} lb/MWh` : "missing"}</li>)}</ol> : "None"}</dd></>}
    </dl>
  </div>
}

/** The activity exactly as save() sends it: trimmed identifiers, derived quantities, identity normalization. */
function prepareActivityForSave(draft: CollectionActivity, completion = false): CollectionActivity {
  const copy = structuredClone(draft)
  copy.sourceId = copy.sourceId.trim()
  // BF1: the meter or vehicle-group ID is the source ID. Keep them identical after trimming, or the contract refuses the
  // save ("Source identifier must match…") and retrying can never succeed.
  if (copy.kind === "vehicle") copy.payload.vehicleGroupId = copy.sourceId
  if (copy.kind === "electricity") copy.payload.meterOrAccountNumber = copy.sourceId
  copy.withdrawalReason = copy.state === "withdrawn" ? copy.withdrawalReason?.trim() ?? null : null
  if (copy.kind === "vehicle" && !copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.gallons
  if (copy.kind === "distillate_no2" && !copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.consumption.basis === "measured" ? copy.payload.consumption.gallons : copy.payload.consumption.purchasedGallons
  if (copy.kind === "natural_gas" && !VOLUMETRIC_GAS_UNITS.has(copy.quantity.originalUnit)) copy.payload.heatContent = null
  const quantity = copy.quantity
  if (DECIMAL.test(quantity.originalValue) && normalizableUnits(copy.kind, completion).includes(quantity.originalUnit)) {
    quantity.normalizedValue = quantity.originalValue; quantity.normalizedUnit = quantity.originalUnit
  } else { quantity.normalizedValue = null; quantity.normalizedUnit = null }
  copy.quantity = deriveCollectionQuantity(copy.kind, copy.payload, copy.quantity)
  return copy
}

/** Round 2 lane E (UX-12): what tells saved Scope 3 records apart in the list (category, supplier, description or product). */
function savedSummary(activity: CollectionActivity): string {
  const payload = activity.payload as unknown as Record<string, unknown>
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null
  const category = typeof payload.category === "number" ? SAVED_LIST_TEXT_R2E.category(payload.category) : null
  return [category, text(payload.supplierName), text(payload.description) ?? text(payload.product) ?? text(payload.investeeName), text(payload.glAccount) ? `GL ${text(payload.glAccount)}` : null].filter(Boolean).join(" · ")
}

/** WO-06: a plain click (or Enter) on a link the app handles itself; a modified or middle click keeps the browser's behaviour. */
function plainClick(event: Pick<ReactMouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">): boolean {
  return (event.button ?? 0) === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/**
 * The Activity screen. With `openRecordId` it is the record view (WO-06): "← All activity", the record's heading, state and
 * version, a summary, "Correct this record" (which reveals the correction form) and the history. Without it, the list of
 * saved records (filtered and paged; each row a link to its record view) and the new-record form.
 */
export function CollectionWorkspace({ actor, workspaceId, headingRef, onDirtyChange, openRecordId = null, intro, listQuery, listReturnRecordId = null, onOpenRecord, onListQueryChange, onRecordMissing, allActivityHref = "#/activity", onAllActivity }: {
  actor: HostedWorkspaceActor; workspaceId: string | null; headingRef: RefObject<HTMLHeadingElement | null>; onDirtyChange: (dirty: boolean) => void; openRecordId?: string | null; intro?: ReactNode
  listQuery?: ActivityListQuery; listReturnRecordId?: string | null; onOpenRecord?: (recordId: string) => void; onListQueryChange?: (query: ActivityListQuery) => void; onRecordMissing?: () => void
  allActivityHref?: string; onAllActivity?: () => void
}) {
  const recordMode = openRecordId !== null
  const [records, setRecords] = useState<CollectionActivityRecord[]>([])
  const [evidence, setEvidence] = useState<CollectionEvidenceMetadata[]>([])
  const [lineages, setLineages] = useState<GridLossLineage[]>([])
  const [context, setContext] = useState<CollectionContext | null>(null)
  // Scope 3 package 2: the server stores Scope 3 activity (schema 29).
  const [scope3, setScope3] = useState(false)
  const [availableScope3Kinds, setAvailableScope3Kinds] = useState<readonly string[]>([])
  // I-08: schema 30's payload additions (data quality, business travel v2); company setup's facts for the Scope 3 plan
  // (undefined until read); the saved spend lines with their mapping keys (supplier and partner records may replace them).
  const [scope3Completion, setScope3Completion] = useState(false)
  const [setupFacts, setSetupFacts] = useState<Scope3SetupFacts | undefined>(undefined)
  const [spendLines, setSpendLines] = useState<Scope3SpendLineChoice[]>([])
  const [zipLookup, setZipLookup] = useState<CollectionZipLookup | null>(null)
  const [recordId, setRecordId] = useState<string>(() => crypto.randomUUID())
  const [draft, setDraft] = useState<CollectionDraft>(() => initial("natural_gas"))
  const [historical, setHistorical] = useState<CollectionActivityVersion | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("Loading collection records…")
  const [error, setError] = useState(false)
  // Round 3 lane C (PR-3): whether the saved records have loaded once (until then the list never says "none saved"),
  // and the list's filter and page.
  const [loaded, setLoaded] = useState(false)
  const [listFilter, setListFilter] = useState<{ status: "all" | "attention" | "ready" | "withdrawn"; kind: string; search: string }>(() => ({ status: listQuery?.status ?? "all", kind: listQuery?.type ?? "", search: "" }))
  const [listPage, setListPage] = useState(() => Math.max(0, (listQuery?.page ?? 1) - 1))
  // WO-06: the record view shows the correction form only after "Correct this record" (or a Fix that names a field).
  const [correcting, setCorrecting] = useState(false)
  const focusHeadingNext = useRef(false)
  const returnRow = useRef(listReturnRecordId)
  const missingRef = useRef(onRecordMissing)
  useEffect(() => { missingRef.current = onRecordMissing })
  const [dirty, setDirty] = useState(false)
  // Round 2 lane E (UX-4): a failed save is said next to the Save button (and focused), not only at the top of the page.
  const [saveProblem, setSaveProblem] = useState<string | null>(null)
  const saveAlert = useRef<HTMLParagraphElement | null>(null)
  const pending = useRef<CollectionActivitySaveInput | null>(null)
  const pendingUpload = useRef<{ fingerprint: string; id: string } | null>(null)
  const actorRef = useRef(actor)
  useEffect(() => { actorRef.current = actor }, [actor])
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const selected = records.find(item => item.id === recordId) ?? null
  // Round 2 lane D (UX-3): "Fix" from Results lands on the editor (and the field its hold names) only after it has rendered.
  const fixTarget = useRef<string | null>(null)
  useEffect(() => {
    if (busy || fixTarget.current === null || selected?.id !== fixTarget.current) return
    const id = fixTarget.current
    fixTarget.current = null
    requestAnimationFrame(() => { focusRecordEditor(id) })
  }, [busy, selected])
  const legacy = legacyVehicleValues(selected?.currentVersion.activity ?? null)
  const canManage = actor.role === "owner" || actor.role === "admin"

  useEffect(() => {
    if (!workspaceId) { queueMicrotask(() => { setError(true); setMessage("Choose an admitted synthetic company to continue.") }); return }
    const controller = new AbortController()
    const requestActor = { ...actorRef.current, signal: controller.signal }
    queueMicrotask(() => { setBusy(true); setMessage("Loading collection records…"); setError(false) })
    void Promise.all([listCollectionActivities(workspaceId, requestActor), listCollectionEvidence(workspaceId, requestActor), listGridLossLineages(workspaceId, requestActor), loadCollectionOverview(workspaceId, requestActor)]).then(([items, files, grid, overview]) => {
      if (controller.signal.aborted) return
      const loadedContext = overview.context
      setRecords(items); setEvidence(files); setLineages(grid); setContext(loadedContext); setScope3(overview.scope3); setAvailableScope3Kinds(overview.scope3Kinds ?? (overview.scope3 ? SCOPE3_LEGACY_KINDS : []))
      setScope3Completion(overview.scope3Completion === true)
      // I-08: the reporting period and consolidation approach the results route plans Scope 3 with (lease and date holds).
      if (overview.scope3Completion === true) void loadCompanySetup(workspaceId, requestActor).then(view => { if (!controller.signal.aborted) setSetupFacts(scope3SetupFacts(view)) }).catch(() => { if (!controller.signal.aborted) setSetupFacts(undefined) })
      setDraft(current => current.setupVersionId ? current : { ...current, setupVersionId: loadedContext.setupVersionId ?? "" })
      // WO-06: the record view loads its record into the correction form (shown on "Correct this record"). Focus goes to the
      // record's heading, except that a Results "Fix" naming a field opens the form on that field (round 2 lane D, UX-3:
      // the scroll and focus wait until the editor shows this record and the screen is idle, effect below).
      const requested = openRecordId ? items.find(item => item.id === openRecordId) : undefined
      if (requested) {
        setRecordId(requested.id); setDraft(structuredClone(requested.currentVersion.activity) as CollectionDraft)
        const role = actorRef.current.role
        if (hasRecordFieldFocus(requested.id) && (role === "owner" || role === "admin")) { setCorrecting(true); fixTarget.current = requested.id }
        else focusHeadingNext.current = true
      } else if (openRecordId) missingRef.current?.()
      setMessage(overview.scope3 ? COPY_TEXT_R2E.activityLoadedScope3 : "Activity and evidence are collected as drafts. Calculations use beta methods that are not yet formally released.")
      setLoaded(true)
    }).catch(cause => { if (!controller.signal.aborted) { setError(true); setMessage(cause instanceof Error ? cause.message : "Collection is unavailable.") } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [actor.userId, workspaceId, openRecordId])
  // WO-06: the record view's heading takes focus once the record has loaded (and again after a saved correction).
  useEffect(() => {
    if (!focusHeadingNext.current || !loaded || busy) return
    focusHeadingNext.current = false
    requestAnimationFrame(() => { window.scrollTo({ top: 0 }); headingRef.current?.focus({ preventScroll: true }) })
  }, [loaded, busy, headingRef])
  // WO-06: back on the list (Back, or "← All activity"), the row of the record that was open is brought into view and focused.
  useEffect(() => {
    if (recordMode || !loaded || busy || !returnRow.current) return
    const id = returnRow.current
    returnRow.current = null
    requestAnimationFrame(() => {
      const link = document.getElementById(`collection-row-${id}`)
      if (!link) return
      link.scrollIntoView({ block: "center" })
      link.focus({ preventScroll: true })
    })
  }, [recordMode, loaded, busy])
  // I-08: the saved spend lines' mapping keys (SHA-256, as the results route hashes them), for the "replaces spend lines" picker and supersession.
  useEffect(() => {
    let current = true
    void scope3SpendLineChoices(records).then(lines => { if (current) setSpendLines(previous => previous.length === 0 && lines.length === 0 ? previous : lines) }).catch(() => { if (current) setSpendLines([]) })
    return () => { current = false }
  }, [records])

  function edit(change: (next: CollectionDraft) => void) {
    if (!canManage || busy) return
    // UI rehearsal B1 (3 November 2026): each change applies to the current draft, not the one this render saw, so several
    // edits in one event compose (a spend line's invoice date, then its reporting period). A change must stay pure.
    setDraft(current => { const next = structuredClone(current); change(next); return next }); setDirty(true); setHistorical(null); pending.current = null; setError(false); setSaveProblem(null)
    setMessage("Changes are not saved yet. Unknown or unsupported values will remain visible, never counted as zero.")
  }
  function switchKind(kind: CollectionActivityKind) {
    if (selected || kind === draft.kind) return
    if (dirty && !window.confirm("Discard unsaved activity changes?")) return
    setDraft(freshDraft(kind)); setRecordId(crypto.randomUUID()); setReason(""); setDirty(false); setHistorical(null); setZipLookup(null); pending.current = null
  }
  /** A new draft; round 2 UX-12: a spend line starts in the setup reporting period (its own form asks for a date or a period). */
  function freshDraft(kind: CollectionActivityKind): CollectionDraft {
    const next = { ...initial(kind, scope3Completion), setupVersionId: context?.setupVersionId ?? "" } as CollectionDraft
    if (kind === "purchase_spend" && scope3Completion && setupFacts?.reportingPeriod) next.period = { ...setupFacts.reportingPeriod }
    return next
  }
  function startNewRecord() {
    if (dirty && !window.confirm("Discard unsaved activity changes?")) return
    setDraft(freshDraft(draft.kind)); setRecordId(crypto.randomUUID()); setReason(""); setDirty(false); setHistorical(null); setZipLookup(null); pending.current = null
  }
  function openRecord(row: CollectionActivityRecord) {
    if (dirty && !window.confirm("Discard unsaved activity changes?")) return
    setRecordId(row.id); setDraft(structuredClone(row.currentVersion.activity) as CollectionDraft); setReason(""); setDirty(false); setHistorical(null); setZipLookup(null); pending.current = null
  }
  /** Round 3 lane C (PR-3): after a spend-import action only the saved records changed: read them alone (one request, not four). */
  async function refreshRecords() {
    if (!workspaceId) return
    try { setRecords(await listCollectionActivities(workspaceId, actorRef.current)) }
    catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Collection is unavailable.") }
  }
  async function refresh() {
    if (!workspaceId || busy) return
    if (dirty && !window.confirm("Discard unsaved activity changes and reload saved records?")) return
    setBusy(true); setError(false)
    try {
      const [items, files, grid, overview] = await Promise.all([listCollectionActivities(workspaceId, actorRef.current), listCollectionEvidence(workspaceId, actorRef.current), listGridLossLineages(workspaceId, actorRef.current), loadCollectionOverview(workspaceId, actorRef.current)])
      const loadedContext = overview.context
      setRecords(items); setEvidence(files); setLineages(grid); setContext(loadedContext); setScope3(overview.scope3); setAvailableScope3Kinds(overview.scope3Kinds ?? (overview.scope3 ? SCOPE3_LEGACY_KINDS : []))
      setScope3Completion(overview.scope3Completion === true)
      const current = items.find(item => item.id === recordId)
      if (current) setDraft(structuredClone(current.currentVersion.activity) as CollectionDraft)
      else setDraft(previous => ({ ...previous, setupVersionId: loadedContext.setupVersionId ?? "" }))
      setDirty(false); setHistorical(null); pending.current = null; setReason(""); setMessage("Latest saved records loaded."); setLoaded(true)
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Collection is unavailable.") }
    finally { setBusy(false) }
  }
  /** UX-4: the save failed; say so next to Save (focused) and at the top. */
  function failSave(text: string) { setError(true); setMessage(text); setSaveProblem(text); globalThis.setTimeout(() => saveAlert.current?.focus(), 0) }
  async function save() {
    if (!workspaceId || !canManage || busy) return
    setSaveProblem(null)
    if (!draft.locationId || !draft.setupVersionId || !draft.sourceId.trim()) { failSave("Choose a company-setup location and enter the source identifier before saving."); return }
    if (selected && draft.state === "active" && reason.trim().length < 3) { failSave("Explain this correction before saving a new version."); return }
    if (draft.state === "withdrawn" && (!selected || !draft.withdrawalReason || draft.withdrawalReason.trim().length < 3)) { failSave("Explain why this saved record is being withdrawn."); return }
    if (draft.kind === "electricity" && !/^\d{5}$/.test((draft.payload as Extract<CollectionPayload, {zip: string}>).zip)) { failSave("A five-digit ZIP is required for every electricity record."); return }
    if (draft.kind === "electricity" && !draft.payload.utilityName.trim()) { failSave("Choose the verified utility serving this electricity meter before saving."); return }
    const rejectedEvidence = new Set(evidence.filter(file => file.quarantineStatus === "rejected").map(file => file.id))
    if (draft.evidenceIds.some(id => rejectedEvidence.has(id)) || draft.kind === "electricity" && draft.payload.instruments.some(instrument => instrument.evidenceReference !== null && rejectedEvidence.has(instrument.evidenceReference))) { failSave("Remove rejected evidence before saving this version."); return }
    const copy = prepareActivityForSave(withCurrentSetupVersion(draft, context), scope3Completion)
    // I-08: a Scope 3 record is checked against the shared contract first, so its refusal is named in the form's words.
    const scope3Problem = isScope3CollectionKind(copy.kind) ? scope3PayloadProblem(copy.kind, copy.payload) ?? scope3DataQualityProblem(copy.payload) : null
    if (scope3Problem) { failSave(`${scope3Problem} Nothing was saved.`); return }
    // Beta client run (26 October 2026): check the record against the same contract the server applies, so a record the
    // server would refuse (for example dates outside calendar 2025) says why, and nothing is sent or saved.
    try { validateCollectionActivity(copy) }
    catch (cause) { failSave(`${cause instanceof Error ? cause.message : "This record can’t be saved."} Nothing was saved.`); return }
    const correctionReason = selected ? copy.state === "withdrawn" ? `Withdrawn: ${copy.withdrawalReason}` : reason.trim() : null
    const input = pending.current ?? { idempotencyKey: crypto.randomUUID(), expectedRevision: selected?.currentVersion.revision ?? 0, expectedVersionId: selected?.currentVersion.id ?? null, correctionReason, activity: copy }
    pending.current = input; setBusy(true); setError(false); setMessage("Saving and verifying this activity…")
    try {
      const result = await saveAndVerifyCollectionActivity(workspaceId, recordId, input, actorRef.current)
      const current = result.record
      setRecords(items => replaceSavedCollectionRecord(items, current)); setRecordId(current.id); setDraft(structuredClone(current.currentVersion.activity) as CollectionDraft); setDirty(false); setReason(""); pending.current = null
      setMessage(result.replayed ? "The earlier save was confirmed. The latest saved version is shown." : current.currentVersion.revision > 1 ? "Saved. Previous versions remain in correction history." : "Saved.")
      // WO-06: a saved correction closes the form; the record view's summary shows the new version, with focus on its heading.
      if (recordMode) { setCorrecting(false); focusHeadingNext.current = true }
    } catch (cause) {
      setError(true)
      if (cause instanceof CollectionApiError && cause.conflict) { pending.current = null; failSave("This record changed elsewhere. Reload before correcting it.") }
      else if (cause instanceof CollectionApiError && cause.status === 422) {
        let latestContext: CollectionContext | null = null
        try { latestContext = await loadCollectionContext(workspaceId, actorRef.current) }
        catch { /* Preserve the original save refusal when current setup cannot be checked. */ }
        // BF2-QA-01: advancing to the current setup and choosing a location again are separate decisions. The refusal is
        // definite (422), so a request made against an older setup version is retired either way.
        if (latestContext && requiresCurrentLocationReselection(input.activity, latestContext)) {
          const next = latestContext
          setContext(next)
          setDraft(current => ({ ...current, setupVersionId: next.setupVersionId ?? "", locationId: "" }))
          pending.current = null
          failSave("Company setup changed. Select a current location before retrying this save.")
        } else if (latestContext?.setupVersionId && input.activity.setupVersionId !== latestContext.setupVersionId) {
          // The setup was restored with identical content: keep the location and every unsaved edit, move the draft to the
          // current setup version and start a new request on the next save.
          const next = latestContext
          setContext(next)
          setDraft(current => ({ ...current, setupVersionId: next.setupVersionId ?? current.setupVersionId }))
          pending.current = null
          failSave("Company setup was saved again with the same content. Your edits and location are kept; save again to save against the current setup.")
        } else failSave(`${cause.message} Retry keeps the same save request.`)
      } else failSave(`${cause instanceof Error ? cause.message : "Activity could not be saved."} Retry keeps the same save request.`)
    } finally { setBusy(false) }
  }
  async function runZipLookup() {
    if (!workspaceId || draft.kind !== "electricity" || busy) return
    const zip = draft.payload.zip
    if (!/^\d{5}$/.test(zip)) { setError(true); setMessage("Enter a five-digit ZIP before lookup."); return }
    setBusy(true); setError(false); setMessage("Checking the pinned ZIP, utility and eGRID lookup…")
    try {
      const lookup = await lookupCollectionZip(workspaceId, zip, actorRef.current)
      setZipLookup(lookup)
      if (!lookup.found) { setError(true); setMessage("No verified eGRID lookup was found for this ZIP. Keep the unresolved ZIP visible and do not save it as validated."); return }
      const automatic = automaticZipSelection(lookup)
      if (automatic) {
        setDraft(current => {
          const next = structuredClone(current)
          if (next.kind !== "electricity") return current
          next.payload.subregion = automatic.subregion
          next.payload.utilityName = automatic.utilityName
          next.payload.utilityEiaId = automatic.utilityEiaId
          return next
        })
        setDirty(true); setHistorical(null); pending.current = null
        setMessage(automatic.utilityName ? `Verified ${automatic.utilityName} in eGRID subregion ${automatic.subregion}.` : `Verified eGRID subregion ${automatic.subregion}. Choose the utility serving this meter.`)
      } else setMessage("Choose the matching utility to verify the eGRID subregion.")
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "ZIP lookup is unavailable.") }
    finally { setBusy(false) }
  }
  /**
   * I-08: the same pinned ZIP, utility and eGRID lookup for a Scope 3 record with a grid location (energy resold,
   * teleworking, asset energy, buildings). A ZIP in one subregion fills the subregion (and the utility's EIA ID when there
   * is one utility); otherwise the form lists the utilities to choose from.
   */
  async function runScope3ZipLookup(zip: string) {
    if (!workspaceId || busy || !isScope3CompletionKind(draft.kind)) return
    if (!/^\d{5}$/.test(zip)) { setError(true); setMessage("Enter a five-digit ZIP before lookup."); return }
    setBusy(true); setError(false); setMessage("Checking the pinned ZIP, utility and eGRID lookup…")
    try {
      const lookup = await lookupCollectionZip(workspaceId, zip, actorRef.current)
      setZipLookup(lookup)
      if (!lookup.found) { setError(true); setMessage("No verified eGRID lookup was found for this ZIP. Choose the subregion, or the record stays held."); return }
      const automatic = automaticZipSelection(lookup)
      if (automatic) {
        setDraft(current => {
          const next = structuredClone(current)
          const payload = scope3Payload(next)
          if (payload.zip !== zip) return current
          payload.subregion = automatic.subregion; payload.utilityEiaId = automatic.utilityEiaId
          return next
        })
        setDirty(true); setHistorical(null); pending.current = null
        setMessage(`Verified eGRID subregion ${automatic.subregion}${automatic.utilityName ? ` (${automatic.utilityName})` : ""}.`)
      } else setMessage("Choose the utility serving the site to set the eGRID subregion.")
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "ZIP lookup is unavailable.") }
    finally { setBusy(false) }
  }
  async function showVersion(versionId: string) {
    if (!workspaceId || !selected) return
    setBusy(true); setError(false)
    try { setHistorical(await loadCollectionVersion(workspaceId, selected.id, versionId, actorRef.current)); setMessage("Showing an earlier saved version. It cannot be changed.") }
    catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Earlier version unavailable.") }
    finally { setBusy(false) }
  }
  async function upload(file: File) {
    if (!workspaceId || !canManage) return
    const fingerprint = `${file.name}\u0000${file.size}\u0000${file.lastModified}`
    const uploadId = pendingUpload.current?.fingerprint === fingerprint ? pendingUpload.current.id : crypto.randomUUID()
    pendingUpload.current = { fingerprint, id: uploadId }
    setBusy(true); setError(false); setMessage("Uploading private evidence…")
    try {
      const result = await uploadCollectionEvidence(workspaceId, file, uploadId, actorRef.current)
      // BF1: the receipt confirms the upload. A failed list refresh afterwards must not be reported as an unconfirmed upload.
      pendingUpload.current = null
      const received = `Evidence received (${result.receipt.reused ? "existing original reused" : "new original"}). It remains quarantined until independently cleared.`
      setMessage(received)
      try { setEvidence(await listCollectionEvidence(workspaceId, actorRef.current)) }
      catch { setError(true); setMessage(`${received} The evidence list could not be refreshed; reload this page to see it.`) }
    } catch (cause) {
      setError(true)
      if (isDefiniteUploadFailure(cause)) {
        pendingUpload.current = null
        setMessage(cause.message)
      } else {
        setMessage(`Upload was not confirmed. Reference ${uploadId}. Ask the operator to reconcile this attempt before retrying; an original may be waiting in quarantine. Reload this page after the operator confirms recovery.`)
      }
    }
    finally { setBusy(false) }
  }
  async function download(item: CollectionEvidenceMetadata) {
    if (!workspaceId) return
    setBusy(true); setError(false)
    try {
      const response = await downloadCollectionEvidence(workspaceId, item.id, actorRef.current)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a"); link.href = url; link.download = item.originalName; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setMessage("Original evidence downloaded.")
    } catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Original evidence is unavailable.") }
    finally { setBusy(false) }
  }
  async function addGridLoss(row: CollectionActivityRecord) {
    if (!workspaceId || !canManage || row.kind !== "electricity") return
    setBusy(true); setError(false)
    try { await saveGridLossLineage(workspaceId, row.id, row.currentVersion.activity.reference, "Linked to the purchased-electricity original; category 3 calculation awaits a reviewed release.", actorRef.current); setLineages(await listGridLossLineages(workspaceId, actorRef.current)); setMessage("Grid-loss source linked to this electricity record. No Scope 3 amount was calculated.") }
    catch (cause) { setError(true); setMessage(cause instanceof Error ? cause.message : "Grid-loss link could not be saved.") }
    finally { setBusy(false) }
  }

  const p = draft.payload
  const kindButton = (kind: CollectionActivityKind, label: string) => <button type="button" key={kind} aria-pressed={draft.kind === kind} disabled={busy || Boolean(selected)} onClick={() => switchKind(kind)}>{label}</button>
  // A-01: claims across the company, with the draft in place of the record it edits.
  const savedClaims = context ? instrumentEvidenceClaims(records.map(row => row.currentVersion.activity), context, evidence) : undefined
  const draftClaims = context ? instrumentEvidenceClaims([...records.filter(row => row.id !== selected?.id).map(row => row.currentVersion.activity), draft], context, evidence) : undefined
  // I-08: a Scope 3 draft is judged as it would be saved (its amount normalized), with the plan options the results route
  // uses: setup's reporting period and consolidation approach, distance commuting periods and supersession.
  const scope3Draft = isScope3CollectionKind(draft.kind)
  const completionDraft = isScope3CompletionKind(draft.kind)
  const readinessDraft = scope3Draft ? prepareActivityForSave(withCurrentSetupVersion(draft, context), scope3Completion) : draft
  const mappingKeys = new Map(spendLines.map(line => [line.mappingKeyInput, line.mappingKey]))
  const savedScope3Options = context ? scope3ReadinessOptions({ setup: setupFacts, context, records, draft: null, mappingKeys }) : null
  const draftScope3Options = context && scope3Draft ? scope3ReadinessOptions({ setup: setupFacts, context, records, draft: { recordId, activity: readinessDraft }, mappingKeys }) : null
  const draftFindings = recordReadiness(readinessDraft, context, evidence, draftClaims, draftScope3Options ? { options: draftScope3Options, recordId } : undefined)
  const scope3Problem = scope3Draft ? scope3PayloadProblem(draft.kind as Scope3CollectionKind, readinessDraft.payload) ?? scope3DataQualityProblem(readinessDraft.payload) : null
  const separatorSuggestion = thousandsSeparatorSuggestion(draft.quantity.originalValue)
  // Round 2 lane E (UX-4): every problem that would stop a save, listed next to Save, which stays off while any is shown.
  // The same checks as save() and the shared contract (validateCollectionActivity), so nothing the server refuses is sent.
  const blocking: string[] = []
  // Round 3 lane D (PR-6, PR-12): the labels of the fields a problem names, marked invalid; freight, travel and waste problems
  // the engine would only report after save (no vehicle, a declared haul without its basis, a waste pair EPA has no factor for).
  const invalid = new Set<string>()
  // A saved record opened by Fix shows its problem (and marks the field) before any edit, too.
  const presave = canManage && scope3Draft && draft.state === "active" ? scope3PreSaveProblems(draft) : []
  for (const problem of presave) { invalid.add(problem.field); blocking.push(problem.text) }
  if (dirty && canManage) {
    if (!draft.locationId) invalid.add("Company-setup location")
    if (!draft.sourceId.trim()) invalid.add("source")
    if (selected && draft.state === "active" && reason.trim().length < 3) invalid.add("Reason for this correction")
    if (draft.state === "withdrawn" && (!draft.withdrawalReason || draft.withdrawalReason.trim().length < 3)) invalid.add("Reason for withdrawal")
    if (scope3Draft && draft.quality === "estimated" && !draft.estimateBasis?.trim()) invalid.add("How was this estimate made?")
    if (!draft.locationId) blocking.push("Choose a company-setup location.")
    if (!draft.setupVersionId && !context?.setupVersionId) blocking.push("Save company setup first: every record is linked to a saved setup version.")
    if (!draft.sourceId.trim()) blocking.push("Enter the source identifier.")
    if (selected && draft.state === "active" && reason.trim().length < 3) blocking.push("Explain this correction (at least 3 characters).")
    if (draft.state === "withdrawn" && (!draft.withdrawalReason || draft.withdrawalReason.trim().length < 3)) blocking.push("Explain why this record is being withdrawn (at least 3 characters).")
    if (draft.kind === "electricity" && !/^\d{5}$/.test((draft.payload as Extract<CollectionPayload, { zip: string }>).zip)) blocking.push("Enter the meter’s five-digit ZIP code.")
    if (draft.kind === "electricity" && !draft.payload.utilityName.trim()) blocking.push("Choose the verified utility serving this meter.")
    const rejected = new Set(evidence.filter(file => file.quarantineStatus === "rejected").map(file => file.id))
    if (draft.evidenceIds.some(id => rejected.has(id)) || draft.kind === "electricity" && draft.payload.instruments.some(instrument => instrument.evidenceReference !== null && rejected.has(instrument.evidenceReference))) blocking.push("Remove rejected evidence.")
    if (scope3Problem) blocking.push(scope3Problem)
    // Round 2c integration (walk item 2): an estimated Scope 3 record without its basis is told what to fill in; the shared
    // contract's message ("Only estimated records carry an estimate basis.") is shipped and stays the server's, and Scope 1.
    if (scope3Draft && draft.quality === "estimated" && !draft.estimateBasis?.trim()) blocking.push(SAVE_TEXT_R2C.estimateBasisMissing)
    if (blocking.length === 0) { try { validateCollectionActivity(prepareActivityForSave(withCurrentSetupVersion(draft, context), scope3Completion)) } catch (cause) { blocking.push(cause instanceof Error ? cause.message : "This record can’t be saved.") } }
  }
  const duplicateRows = records.filter(row => {
    if (row.id === selected?.id || row.kind !== draft.kind) return false
    const other = row.currentVersion.activity as CollectionDraft
    return other.state !== "withdrawn" && Boolean(draft.sourceId.trim()) && other.sourceId.trim().toLocaleLowerCase() === draft.sourceId.trim().toLocaleLowerCase() && periodsOverlap(other.period, draft.period)
  })
  const sourceLabel = draft.kind === "natural_gas" ? "Gas account or meter ID"
    : draft.kind === "distillate_no2" ? "Generator or equipment ID"
    : draft.kind === "vehicle" ? "Vehicle or group ID"
    : draft.kind === "fugitive" ? "Equipment or group ID"
    : draft.kind === "transport" ? "Shipment lane or carrier account ID"
    : draft.kind === "waste" ? "Waste stream or hauler account ID"
    : draft.kind === "business_travel" ? "Trip, report or booking export ID"
    : draft.kind === "employee_commuting" ? "Survey or commuting group ID"
    : isScope3CompletionKind(draft.kind) ? SCOPE3_FORM_SOURCE_LABELS[draft.kind]
    : "Electricity meter or account ID"
  // Round 2 lane E (UX-12): a Scope 3 record at schema 30 asks "actual or estimated" inside its one data-quality section.
  const qualityFields = (label: string) => <>
    <Select label={label} value={draft.quality} options={[["unknown", "Unknown"], ["actual", "Actual"], ["estimated", "Estimated"]]} onChange={value => edit(next => { next.quality = value as CollectionActivity["quality"]; next.estimateBasis = value === "estimated" ? "" : null })} />
    {draft.quality === "estimated" && <Field label="How was this estimate made?" value={draft.estimateBasis ?? ""} onChange={value => edit(next => { next.estimateBasis = value })} invalid={invalid.has("How was this estimate made?")} />}
  </>
  const evidenceLabel = (file: CollectionEvidenceMetadata) => file.quarantineStatus === "clean" ? `${file.originalName} · cleared`
    : file.quarantineStatus === "pending" ? `${file.originalName} · quarantine review pending (not cleared)`
    : file.quarantineStatus === "rejected" ? `${file.originalName} · rejected (remove before saving)`
    : `${file.originalName} · quarantine review failed (not cleared)`
  // Round 3 lane C (PR-3): each saved record's readiness once; the list shows one page of the records the filter keeps.
  const listed = records.map(row => {
    const activity = row.currentVersion.activity as CollectionDraft
    const readiness = recordReadiness(activity, context, evidence, savedClaims, savedScope3Options ? { options: savedScope3Options, recordId: row.id } : undefined)
    const status: "attention" | "ready" | "withdrawn" = activity.state === "withdrawn" ? "withdrawn" : readiness.some(finding => finding.status === "input_needed" || finding.status === "review_required") ? "attention" : "ready"
    return { row, activity, readiness, status }
  })
  const presentKinds = [...new Set(records.map(row => row.kind))].sort((a, b) => kindName(a).localeCompare(kindName(b)))
  // WO-06: a type from the address that no saved record has is ignored once the records have loaded.
  const kindFilter = loaded && listFilter.kind && !presentKinds.includes(listFilter.kind as CollectionActivityKind) ? "" : listFilter.kind
  const query = listFilter.search.trim().toLowerCase()
  const filtered = listed.filter(item => (listFilter.status === "all" || item.status === listFilter.status) && (!kindFilter || item.row.kind === kindFilter)
    && (!query || ACTIVITY_LIST_TEXT_R3C.searchText(item.activity, kindName(item.row.kind)).includes(query)))
  const pages = Math.max(1, Math.ceil(filtered.length / ACTIVITY_LIST_TEXT_R3C.pageSize)), page = Math.min(listPage, pages - 1)
  const pageRows = filtered.slice(page * ACTIVITY_LIST_TEXT_R3C.pageSize, (page + 1) * ACTIVITY_LIST_TEXT_R3C.pageSize)
  const spendImportShown = scope3Completion && !!workspaceId && availableScope3Kinds.includes("purchase_spend")
  const setFilter = (change: Partial<typeof listFilter>) => { setListFilter(current => ({ ...current, ...change })); setListPage(0) }
  // WO-06: the list's status, type and page (never the search text) are kept in the address as they change.
  useEffect(() => {
    if (recordMode || !loaded) return
    onListQueryChange?.({ status: listFilter.status, type: kindFilter, page: page + 1 })
  }, [recordMode, loaded, listFilter.status, kindFilter, page, onListQueryChange])
  // WO-06: a record's name, as Overview and Results give it: "<Type> · <source id>" (the type without the form's "(Scope 3)").
  const typeName = (kind: string) => { const name: unknown = kindName(kind); return typeof name === "string" ? name.replace(/ \(Scope 3\)$/, "") : "" }
  const stateLabel = (status: "attention" | "ready" | "withdrawn") => ACTIVITY_LIST_TEXT_R3C.statuses.find(([value]) => value === status)?.[1] ?? status
  const openRow = (event: ReactMouseEvent<HTMLAnchorElement>, row: CollectionActivityRecord) => {
    if (!plainClick(event)) return
    event.preventDefault()
    if (onOpenRecord) onOpenRecord(row.id)
    else openRecord(row)
  }
  const openedItem = recordMode && selected ? listed.find(item => item.row.id === selected.id) ?? null : null
  function correctRecord() {
    if (!selected || !canManage) return
    setCorrecting(true)
    const id = selected.id
    requestAnimationFrame(() => { focusRecordEditor(id) })
  }
  function cancelCorrection() {
    if (!selected) return
    if (dirty && !window.confirm("Discard unsaved activity changes?")) return
    setDraft(structuredClone(selected.currentVersion.activity) as CollectionDraft); setReason(""); setDirty(false); setHistorical(null); setZipLookup(null); pending.current = null; setSaveProblem(null)
    setCorrecting(false)
    requestAnimationFrame(() => { document.getElementById("collection-correct-record")?.focus() })
  }
  const history = selected && <><h3>Correction history</h3><ol className="setup-history">{selected.history.map(item => <li key={item.id}><button type="button" disabled={busy} onClick={() => void showVersion(item.id)}>Version {item.revision} · {formatTimeR2E(item.createdAt)}</button><span>{item.correctionReason || "Initial entry"}</span></li>)}</ol>{historical && <HistoricalActivityDetail version={historical} evidence={evidence} />}</>
  const status = <p role={error && !saveProblem ? "alert" : "status"} className={error ? "worksheet-error" : "worksheet-status"}>{message}</p>
  const viewOnly = !canManage && <p>Owner or admin access is needed to save activity or upload evidence.</p>
  const footnote = <p className="worksheet-footnote">This collection is a draft input set. A saved record, linked grid-loss source or uploaded file does not establish complete Scope 1, 2 or 3 coverage, a final market-based result, or external assurance.</p>
  const editorCard = <>
    <div className="worksheet-card worksheet-form" id="collection-record-editor" tabIndex={-1}><h2>{selected ? `Correct saved ${kindName(selected.kind)}` : "New activity record"}</h2>
      {selected && !recordMode && <button type="button" disabled={busy || !canManage} onClick={startNewRecord}>Start a new record</button>}
      {/* WO-06: correcting a saved record shows its type as fixed text, not the type chooser. */}
      {recordMode && selected ? <p className="collection-fixed-type">{`Type: ${typeName(selected.kind)} (fixed)`}</p> : <>
      <div className="worksheet-nav" aria-label="Activity types">{kinds.map(([kind, label]) => kindButton(kind, label))}</div>
      {scope3FormGroups(availableScope3Kinds.filter(kind => FORM_KINDS.has(kind))).map(group => <div key={group.title} className="worksheet-nav" role="group" aria-label={group.title}><span className="nv-subtle">{group.title}</span>{group.kinds.map(kind => kindButton(kind, kindName(kind)))}</div>)}
      </>}
      {selected && !recordMode && <p>Activity type is fixed while correcting this record. Use “Start a new record” to collect another activity.</p>}
      <fieldset className="setup-inputs" disabled={busy || !canManage}>
        <div className="setup-grid">
          <Select label="Company-setup location" value={draft.locationId} options={[["", context?.setupVersionId ? "Choose a saved location" : "Save company setup locations first"], ...(context?.locations ?? []).map(location => [location.id, `${location.name || "Unnamed location"} · ${LOCATION_INCLUSION_TEXT_R2E[location.inclusion] ?? location.inclusion} · ${LOCATION_CONTROL_TEXT_R2E[location.control] ?? location.control}`] as const)]} invalid={invalid.has("Company-setup location")} onChange={value => edit(next => { next.locationId = value; next.setupVersionId = context?.setupVersionId ?? ""; if (next.kind === "electricity") next.payload.site = context?.locations.find(location => location.id === value)?.name ?? "" })} hint={context?.setupRevision ? `Linked to company setup version ${context.setupRevision}. Excluded and unknown locations remain visible.` : "A saved company setup version is required."} />
          <Field label={sourceLabel} value={draft.sourceId} invalid={invalid.has("source")} onChange={value => edit(next => { next.sourceId = value; if (next.kind === "vehicle") next.payload.vehicleGroupId = value; if (next.kind === "electricity") next.payload.meterOrAccountNumber = value })} hint="Use the same stable identifier on every record from this source." />
          {/* Round 2 UX-12: a spend line asks for its date or period once, in its own form (SpendLineForm). */}
          {!(completionDraft && draft.kind === "purchase_spend") && <>
          <Field label="Period start" type="date" value={draft.period.start} onChange={value => edit(next => { next.period.start = value })} />
          <Field label="Last day covered" type="date" value={inclusivePeriodEnd(draft.period.endExclusive)} onChange={value => edit(next => { next.period.endExclusive = exclusivePeriodEnd(value) })} hint="Enter the inclusive last day shown on the source. Neuvetra stores the following day as the calculation boundary." />
          </>}
          {(draft.kind === "natural_gas" || draft.kind === "electricity" || (scope3Draft && !completionDraft)) && <Field label={scope3Draft ? scope3Completion ? scope3AmountLabelR2C(draft.kind, draft.quantity.originalUnit, "mode" in p ? p.mode : "") : "Amount (distance, or mass of waste)" : "Original quantity from source"} value={draft.quantity.originalValue} onChange={value => edit(next => { next.quantity.originalValue = value })} hint="Keep the source text. Unknown or more than 3 decimals is saved but not calculated." />}
          {scope3Draft && !completionDraft && <ChoiceOrOther label="Unit" value={draft.quantity.originalUnit} choices={scope3UnitChoices(draft, scope3Completion).map(unit => [unit, unitLabel(unit)] as const)} placeholder="Choose a unit" otherLabel="Another unit (saved, not calculated)" describeLabel="Unit as written on the source" onChange={value => edit(next => { next.quantity.originalUnit = value })} hint="The units this method takes are listed. Another unit is kept but not calculated." />}
          {draft.kind !== "fugitive" && !scope3Draft && <Field label="Original unit as printed" value={draft.quantity.originalUnit} onChange={value => edit(next => { next.quantity.originalUnit = value; if (next.kind === "natural_gas" && !VOLUMETRIC_GAS_UNITS.has(value)) next.payload.heatContent = null })} hint={unitsHintR2E(supportedUnits[draft.kind])} />}
          {!(scope3Draft && scope3Completion) && qualityFields("Data quality")}
          <Field label="Source reference" value={draft.reference} onChange={value => edit(next => { next.reference = value })} hint="Bill number, log, contractor record or other locator." />
          <label className="setup-field"><span>Notes and unresolved questions</span><textarea value={draft.notes} onChange={event => edit(next => { next.notes = event.target.value })} /></label>
        </div>
        {separatorSuggestion && <div className="collection-suggestion"><p>The quantity includes thousands separators. It remains uncalculated unless you explicitly accept the plain-decimal form.</p><button type="button" onClick={() => edit(next => { next.quantity.originalValue = separatorSuggestion; if (next.kind === "vehicle") next.payload.gallons = separatorSuggestion; if (next.kind === "distillate_no2" && next.payload.consumption.basis === "measured") next.payload.consumption.gallons = separatorSuggestion; if (next.kind === "distillate_no2" && next.payload.consumption.basis !== "measured") next.payload.consumption.purchasedGallons = separatorSuggestion })}>Use {separatorSuggestion}</button></div>}
        {duplicateRows.length > 0 && <div className="collection-duplicate-warning" role="alert"><strong>Probable duplicate</strong><p>{duplicateRows.length} active record{duplicateRows.length === 1 ? "" : "s"} use this activity type and source ID during an overlapping period. Review the saved record before adding another.</p></div>}
        <ReadinessPanel findings={draftFindings} />
        {scope3Problem && <p className="worksheet-error" role="note">Before saving: {scope3Problem}</p>}
        {completionDraft && <Scope3RecordForm activity={draft} onEdit={edit} disabled={busy || !canManage} env={{ consolidationApproach: setupFacts === undefined ? undefined : setupFacts.consolidationApproach, zipLookup, onZipLookup: zip => void runScope3ZipLookup(zip), spendLines, context, reportingPeriod: setupFacts?.reportingPeriod ?? null }} />}
        {draft.kind === "natural_gas" && "heatContent" in p && VOLUMETRIC_GAS_UNITS.has(draft.quantity.originalUnit) && <div className="setup-subcard"><h3>Natural gas</h3><p>Use the heat content printed on the bill. Do not assume a conversion.</p><div className="setup-grid">
          <Field label="Bill heat content" value={p.heatContent?.value ?? ""} onChange={value => edit(next => { (next.payload as typeof p).heatContent = value ? { value, unit: p.heatContent?.unit ?? "MMBtu per ccf" } : null })} hint="Natural gas is about 1.026 therms per ccf (0.1026 MMBtu per ccf, 1.026 MMBtu per mcf); bills at high elevation show less. A value far outside that is held: check the unit." />
          <Select label="Heat-content unit" value={p.heatContent?.unit ?? "MMBtu per ccf"} options={[["MMBtu per scf", "MMBtu per scf"], ["MMBtu per ccf", "MMBtu per ccf"], ["MMBtu per mcf", "MMBtu per mcf"], ["therm per ccf", "therm per ccf"]]} onChange={value => edit(next => { (next.payload as typeof p).heatContent = { value: p.heatContent?.value ?? "", unit: value as NonNullable<typeof p.heatContent>["unit"] } })} />
        </div></div>}
        {draft.kind === "distillate_no2" && "consumption" in p && <div className="setup-subcard"><h3>Generator fuel</h3><div className="setup-grid">
          <Select label="How was fuel use determined?" value={p.consumption.basis} options={[["measured", "Measured gallons used"], ["purchases_with_tank_levels", "Purchases with opening and closing tank levels"], ["purchases_only", "Purchases only — input needed"]]} onChange={value => edit(next => { (next.payload as typeof p).consumption = value === "measured" ? { basis: "measured", gallons: "" } : value === "purchases_with_tank_levels" ? { basis: "purchases_with_tank_levels", purchasedGallons: "", openingGallons: "", closingGallons: "" } : { basis: "purchases_only", purchasedGallons: "" }; next.quantity.originalValue = ""; next.quantity.normalizedValue = null; next.quantity.normalizedUnit = null })} />
          {p.consumption.basis === "measured" ? <Field label="Gallons used" value={p.consumption.gallons} onChange={value => edit(next => { (next.payload as typeof p & {consumption:{gallons:string}}).consumption.gallons = value; next.quantity.originalValue = value })} /> : <>
            <Field label="Purchased gallons" value={p.consumption.purchasedGallons} onChange={value => edit(next => { (next.payload as typeof p & {consumption:{purchasedGallons:string}}).consumption.purchasedGallons = value; next.quantity.originalValue = value })} />
            {p.consumption.basis === "purchases_with_tank_levels" && <><Field label="Opening tank level (gallons)" value={p.consumption.openingGallons} onChange={value => edit(next => { (next.payload as typeof p & {consumption:{openingGallons:string}}).consumption.openingGallons = value })} /><Field label="Closing tank level (gallons)" value={p.consumption.closingGallons} onChange={value => edit(next => { (next.payload as typeof p & {consumption:{closingGallons:string}}).consumption.closingGallons = value })} /></>}
          </>}
          <Field label="Stated heating value (MMBtu per gallon, optional)" value={p.statedHhvMmbtuPerGallon ?? ""} onChange={value => edit(next => { (next.payload as typeof p).statedHhvMmbtuPerGallon = value || null })} hint="No. 2 fuel oil is about 0.138 MMBtu per gallon; leave blank to use that default. A value more than 15% from it is held: check the unit." />
        </div></div>}
        {draft.kind === "vehicle" && "fuelEconomy" in p && <div className="setup-subcard"><h3>Vehicle or linked group</h3><div className="setup-grid">
          <Select label="Fuel" value={vehicleFuels.includes(p.fuel as typeof vehicleFuels[number]) ? p.fuel : ""} options={[["", "Choose fuel"] as const, ...vehicleFuels.map(value => [value, value] as const)]} onChange={value => edit(next => { if (next.kind !== "vehicle") return; next.payload.fuel = value; next.payload.vehicleType = "" })} />
          <Select label="Vehicle type" value={vehicleTypes.includes(p.vehicleType as typeof vehicleTypes[number]) && vehicleTypesByFuel[p.fuel as keyof typeof vehicleTypesByFuel]?.includes(p.vehicleType as never) ? p.vehicleType : ""} options={[["", p.fuel ? "Choose vehicle type" : "Choose fuel first"] as const, ...(vehicleTypesByFuel[p.fuel as keyof typeof vehicleTypesByFuel] ?? []).map(value => [value, value.replace(/_/g, " ")] as const)]} onChange={value => edit(next => { if (next.kind === "vehicle") next.payload.vehicleType = value })} />
          <Field label="Model year" type="number" value={String(p.modelYear)} onChange={value => edit(next => { (next.payload as typeof p).modelYear = Number(value) })} />
          <Field label="Fuel used (US gallons)" value={p.gallons} onChange={value => edit(next => { (next.payload as typeof p).gallons = value; next.quantity.originalValue = value })} />
          <Field label="Vehicle count (optional)" type="number" value={p.vehicleCount === null ? "" : String(p.vehicleCount)} onChange={value => edit(next => { (next.payload as typeof p).vehicleCount = value ? Number(value) : null })} />
          <Field label="Miles driven" value={p.miles?.value ?? ""} onChange={value => edit(next => { (next.payload as typeof p).miles = value ? { value, basis: p.miles?.basis ?? "" } : null; if (value) (next.payload as typeof p).fuelEconomy = null })} />
          <Select label="Miles source / basis" value={p.miles?.basis ?? ""} options={[["", "Choose a miles source"], ["odometer", "Odometer"], ["trip_log", "Trip log"]]} onChange={value => edit(next => { (next.payload as typeof p).miles = value ? { value: p.miles?.value ?? "", basis: value } : null })} />
          <Field label="Fuel economy (mpg), if miles unavailable" value={p.fuelEconomy?.mpg ?? ""} onChange={value => edit(next => { (next.payload as typeof p).fuelEconomy = value ? { mpg: value, source: p.fuelEconomy?.source ?? "" } : null; if (value) (next.payload as typeof p).miles = null })} />
          <Select label="MPG source" value={p.fuelEconomy?.source ?? ""} options={[["", "Choose an MPG source"], ["vehicle_record", "Vehicle record"], ["fleet_record", "Fleet record"], ["fueleconomy_gov", "fueleconomy.gov"]]} onChange={value => edit(next => { (next.payload as typeof p).fuelEconomy = value ? { mpg: p.fuelEconomy?.mpg ?? "", source: value } : null })} />
        </div>{legacy && <p className="collection-legacy-hold">Held pending correction: saved fuel “{legacy.fuel || "blank"}” and vehicle type “{legacy.vehicleType || "blank"}” are preserved. Choose the matching FIELDS v6 tokens before saving a correction.</p>}</div>}
        {draft.kind === "fugitive" && "terms" in p && <div className="setup-subcard"><h3>One refrigerant per equipment or group</h3><p>The saved quantity is the derived net refrigerant release: (PN − CN) + PS + (CD − RD). The five entered terms remain unchanged.</p><div className="setup-grid">
          <Select label="Refrigerant or fire-suppression gas" value={p.gas} options={gases.map(gas => [gas, gas])} onChange={value => edit(next => { (next.payload as typeof p).gas = value as typeof p.gas })} />
          <Select label="Unit for all five terms" value={p.unit} options={[["kg", "kg"], ["lb", "lb"]]} onChange={value => edit(next => { (next.payload as typeof p).unit = value as typeof p.unit; next.quantity.originalUnit = value })} />
          {(["PN", "CN", "PS", "CD", "RD"] as const).map(term => <Field key={term} label={`${term} (${p.unit})`} value={p.terms[term]} onChange={value => edit(next => { (next.payload as typeof p).terms[term] = value })} hint="Enter 0 only when this event did not happen; do not use 0 for unknown." />)}
          <Tri label="Is the equipment inside your reporting boundary?" value={p.insideBoundary} onChange={value => edit(next => { (next.payload as typeof p).insideBoundary = value })} />
          <Tri label="Do you maintain and track a stock of refrigerant?" value={p.maintainsRefrigerantStock} onChange={value => edit(next => { (next.payload as typeof p).maintainsRefrigerantStock = value })} />
          <Tri label="Was any equipment converted to a different refrigerant during the year?" value={p.retrofitInPeriod} onChange={value => edit(next => { (next.payload as typeof p).retrofitInPeriod = value })} />
          <Select label="Contractor records complete?" value={p.contractorRecordsComplete ? "yes" : "no"} options={[["no", "No / unresolved"], ["yes", "Yes"]]} onChange={value => edit(next => { (next.payload as typeof p).contractorRecordsComplete = value === "yes" })} />
          <Select label="Event chronology complete?" value={p.eventChronologyComplete ? "yes" : "no"} options={[["no", "No / unresolved"], ["yes", "Yes"]]} onChange={value => edit(next => { (next.payload as typeof p).eventChronologyComplete = value === "yes" })} />
        </div><p>A yes to stock or retrofit needs method review; an unknown answer needs input. Only an explicit outside-boundary answer excludes.</p></div>}
        {draft.kind === "transport" && "loadBasis" in p && <div className="setup-subcard"><h3>Freight transport (Scope 3)</h3><p>Distance-based, tank-to-wheel. Use vehicle-miles when the goods had a vehicle to themselves, and ton-miles when they shared it with other loads.</p><div className="setup-grid">
          <Select label="Which way did the goods travel?" value={String(p.category)} options={[["4", "Category 4: to us (goods we bought, carrier we paid)"], ["9", "Category 9: to customers (goods we sold, carrier we didn’t pay)"]]} onChange={value => edit(next => { if (next.kind === "transport") next.payload.category = value === "9" ? 9 : 4 })} />
          <ChoiceOrOther label="Vehicle" value={p.vehicle} invalid={invalid.has("Vehicle")} choices={Object.keys(SCOPE3_TRANSPORT_VEHICLES).map(vehicle => [vehicle, VEHICLE_LABELS[vehicle] ?? titleCase(vehicle)] as const)} placeholder="Choose a vehicle" otherLabel="Something else (saved, not calculated yet)" describeLabel="What vehicle?" onChange={value => edit(next => { if (next.kind === "transport") next.payload.vehicle = value })} />
          <Select label="Did the goods have the vehicle to themselves?" value={p.loadBasis ?? ""} options={[["", "Not known yet"], ["dedicated_vehicle", "Yes: dedicated vehicle (vehicle-miles)"], ["shared_vehicle", "No: shared with other loads (ton-miles)"]]} onChange={value => edit(next => { if (next.kind !== "transport") return; next.payload.loadBasis = value === "dedicated_vehicle" || value === "shared_vehicle" ? value : null; if (next.payload.loadBasis && !SCOPE3_TRANSPORT_UNITS[next.payload.loadBasis].includes(next.quantity.originalUnit as never)) next.quantity.originalUnit = SCOPE3_TRANSPORT_UNITS[next.payload.loadBasis][0] })} />
          <Select label="Did the goods pass through third-party warehouses or distribution centres?" value={p.thirdPartyFacilities} options={[["none", "No, none"], ["present_not_included", "Yes, but their emissions aren’t included"], ["unknown", "Not known"]]} onChange={value => edit(next => { if (next.kind === "transport") next.payload.thirdPartyFacilities = value as typeof SCOPE3_TRANSPORT_FACILITIES[number] })} hint="Only “No, none” meets the category’s minimum boundary; the other answers are disclosed as partial." />
        </div></div>}
        {draft.kind === "waste" && "treatment" in p && <div className="setup-subcard"><h3>Waste (Scope 3)</h3><p>One material sent to one treatment per record, by mass. EPA factors include transport to the facility and exclude avoided emissions.</p><div className="setup-grid">
          <Select label="Whose waste is it?" value={String(p.category)} options={[["5", "Category 5: waste from our operations"], ["12", "Category 12: end of life of products we sold"]]} onChange={value => edit(next => { if (next.kind === "waste") next.payload.category = value === "12" ? 12 : 5 })} />
          <ChoiceOrOther label="Material" value={p.material} choices={SCOPE3_WASTE_MATERIALS.map(material => [material, SCOPE3_WASTE_MATERIAL_TEXT_R2E[material] ?? titleCase(material)] as const)} placeholder="Choose a material" otherLabel="Something else (saved, not calculated yet)" describeLabel="What material?" onChange={value => edit(next => { if (next.kind === "waste") next.payload.material = value })} />
          <ChoiceOrOther label="Treatment" value={p.treatment} invalid={invalid.has("Treatment")} choices={scope3WasteTreatmentsFor(p.material).map(treatment => [treatment, SCOPE3_WASTE_TREATMENT_TEXT_R2E[treatment] ?? titleCase(treatment)] as const)} placeholder="Choose a treatment" otherLabel="Something else (saved, not calculated yet)" describeLabel="What treatment?" onChange={value => edit(next => { if (next.kind === "waste") next.payload.treatment = value })} hint="Only the treatments EPA publishes a factor for with this material are listed." />
        </div></div>}
        {draft.kind === "business_travel" && "passengerSegments" in p && <div className="setup-subcard"><h3>Business travel (Scope 3)</h3><p>{scope3Completion ? "By distance, tank-to-wheel. Air excludes radiative forcing; its cabin class is recorded and disclosed but the factor is an average for all classes. Hotel stays are recorded in room-nights, an optional activity: U.S. stays are estimated from EPA’s energy per available room-night for the highest hotel class (2005 data), because the class isn’t recorded." : "By distance, tank-to-wheel. Air excludes radiative forcing and doesn’t distinguish cabin class. Hotel stays aren’t calculated in this beta: record them under “Something else” so they stay visible as needing input."}</p><div className="setup-grid">
          <ChoiceOrOther label="Mode" value={p.mode} choices={[[SCOPE3_AIR_BY_DISTANCE, MODE_LABELS.air!] as const, ...Object.keys(SCOPE3_TRAVEL_MODES).map(mode => [mode, MODE_LABELS[mode] ?? titleCase(mode)] as const), ...(scope3Completion ? [[SCOPE3_HOTEL_MODE, "Hotel stay (room-nights)"] as const] : [])]} placeholder="Choose a mode" otherLabel={scope3Completion ? "Something else (saved, not calculated yet)" : "Something else, such as a hotel stay (saved, not calculated yet)"} describeLabel="What was it?" onChange={value => edit(next => {
            if (next.kind !== "business_travel") return
            next.payload.mode = value; if (value !== SCOPE3_AIR_BY_DISTANCE) next.payload.passengerSegments = null; if (!(SCOPE3_AIR_HAULS as readonly string[]).includes(value)) next.payload.haulBasis = null
            const units = scope3Completion && scope3IsHotelMode(value) ? ["room-night"] : travelUnits(value); if (units.length && !units.includes(next.quantity.originalUnit)) next.quantity.originalUnit = units[0]!
            // I-08 (schema 30): the v2 payload records the cabin class of a flight and the country of a hotel stay.
            if (scope3Completion && scope3IsHotelMode(value)) withTravelV2(next.payload)
            if ("cabinClass" in next.payload && !isAirMode(value)) next.payload.cabinClass = null
            if ("hotelCountry" in next.payload && !scope3IsHotelMode(value)) next.payload.hotelCountry = null
          })} />
          {scope3Completion && isAirMode(p.mode) && <Select label="Cabin class" value={p.cabinClass ?? ""} options={[["", "Not recorded"] as const, ...scope3TokenOptions("cabinClass", SCOPE3_CABIN_CLASSES)]} onChange={value => edit(next => { if (next.kind !== "business_travel") return; withTravelV2(next.payload); next.payload.cabinClass = (value || null) as typeof next.payload.cabinClass })} hint="Recorded and disclosed; the air factor is the average for all classes." />}
          {scope3Completion && scope3IsHotelMode(p.mode) && <Field label="Hotel country (two-letter code)" value={p.hotelCountry ?? ""} onChange={value => edit(next => { if (next.kind !== "business_travel") return; withTravelV2(next.payload); next.payload.hotelCountry = value.trim().toUpperCase() || null })} hint="ISO 3166, for example US or GB. Blank: the reporting location’s country is used if it is the U.S. Only U.S. stays are calculated (EPA per room-night values, highest hotel class, because the class isn’t recorded); others are listed, not counted." />}
          {p.mode === SCOPE3_AIR_BY_DISTANCE && <Field label="One-way flights (passenger segments) at this distance" type="number" value={p.passengerSegments === null ? "" : String(p.passengerSegments)} onChange={value => edit(next => { if (next.kind === "business_travel") next.payload.passengerSegments = /^[1-9][0-9]{0,7}$/.test(value) && Number(value) <= 10_000_000 ? Number(value) : null })} hint="The amount above is the distance of one flight; the engine works out short, medium or long haul from it." />}
          {(SCOPE3_AIR_HAULS as readonly string[]).includes(p.mode) && <Field label="How do you know the haul length?" invalid={invalid.has("How do you know the haul length?")} value={p.haulBasis ?? ""} onChange={value => edit(next => { if (next.kind === "business_travel") next.payload.haulBasis = value || null })} hint="For example, the travel agency’s booking export. The amount above is passenger-miles or km." />}
        </div></div>}
        {draft.kind === "employee_commuting" && "mode" in p && !("passengerSegments" in p) && <div className="setup-subcard"><h3>Employee commuting (Scope 3)</h3><p>{scope3Completion ? COPY_TEXT_R2E.commutingByDistance : "By distance, tank-to-wheel. Survey extrapolation and teleworking aren’t calculated in this beta; if the distance is scaled from a sample, mark it Estimated and say how."}</p><div className="setup-grid">
          <ChoiceOrOther label="Mode" value={p.mode} choices={SCOPE3_COMMUTING_MODES.map(mode => [mode, MODE_LABELS[mode] ?? titleCase(mode)] as const)} placeholder="Choose a mode" otherLabel={scope3Completion ? COPY_TEXT_R2E.commutingOther : "Something else, such as teleworking (saved, not calculated yet)"} describeLabel="What was it?" onChange={value => edit(next => { if (next.kind !== "employee_commuting") return; next.payload.mode = value; const units = travelUnits(value); if (units.length && !units.includes(next.quantity.originalUnit)) next.quantity.originalUnit = units[0]! })} />
        </div></div>}
        {/* Round 3 lane D (PR-6): the kind's key choice (mode, material, vehicle, the record form) comes before the data-quality block. */}
        {scope3Draft && scope3Completion && <DataQualityEditor activity={draft} onEdit={edit} lead={qualityFields("Is the amount actual or estimated?")} />}
        {draft.kind === "electricity" && "instruments" in p && <div className="setup-subcard"><h3>Electricity, site and grid region</h3><div className="setup-grid">
          <Field label="ZIP code" value={p.zip} onChange={value => { edit(next => { (next.payload as typeof p).zip = value; (next.payload as typeof p).subregion = ""; (next.payload as typeof p).utilityEiaId = null; (next.payload as typeof p).utilityName = "" }); setZipLookup(null) }} hint="Required. Run the pinned lookup; unresolved values stay visible but cannot be saved as validated." />
        </div><button type="button" disabled={busy || !/^\d{5}$/.test(p.zip)} onClick={() => void runZipLookup()}>Look up ZIP and utility</button>
          {zipLookup?.found && (zipLookup.needsUtilityChoice || zipLookup.utilities.length > 1) && <Select label="Verified utility and eGRID subregion" value={p.utilityName ? `${p.subregion}|${p.utilityEiaId ?? ""}|${p.utilityName}` : ""} options={[["", "Choose the utility serving this meter"] as const, ...zipLookup.utilities.map(utility => [`${utility.subregion}|${utility.eiaId}|${utility.utility}`, `${utility.utility} · ${utility.subregion}${utility.predominantUtility ? " · predominant" : ""}`] as const)]} onChange={value => edit(next => { if (next.kind !== "electricity") return; const utility = zipLookup.utilities.find(item => `${item.subregion}|${item.eiaId}|${item.utility}` === value); next.payload.subregion = utility?.subregion ?? ""; next.payload.utilityEiaId = utility?.eiaId || null; next.payload.utilityName = utility?.utility ?? "" })} hint={zipLookup.needsUtilityChoice ? "A utility selection is required because this ZIP maps to more than one subregion." : "Choose the utility named on the source document."} />}
          {zipLookup?.found && p.subregion && p.utilityName && <p>Verified utility: <strong>{p.utilityName}</strong> · eGRID subregion <strong>{egridSubregionLabel(p.subregion)}</strong>. Source: {zipLookup.source}</p>}
          {zipLookup && !zipLookup.found && <p className="worksheet-error">No verified eGRID match was found for ZIP {zipLookup.zip}.</p>}
          <p>Location-based and market-based results have separate statuses. Uncovered consumption uses the reviewed Green-e residual mix. “Provisional” appears only if a subregion has no residual-mix rate.</p>
          <h4>Certificates and other contractual instruments</h4>
          {p.instruments.map((item, index) => <div className="setup-subcard" key={`${index}-${item.type}`}><h4>Instrument {index + 1}</h4><div className="setup-grid">
            <Select label="Instrument type" value={item.type} options={instrumentTypes} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.type = value as CollectionInstrument["type"] })} />
            <Field label="Covered MWh" value={item.mwh} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.mwh = value })} />
            <Select label="Quality criteria confirmed?" value={item.qualityCriteriaMet ? "yes" : "no"} options={[["no", "No — market input needed"], ["yes", "Yes"]]} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.qualityCriteriaMet = value === "yes" })} />
            <Field label="Vintage year" type="number" value={String(item.vintageYear)} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.vintageYear = Number(value) })} />
            <Select label="Generation technology" value={item.generationTechnology} options={technologies.map(value => [value, value.replace(/_/g, " ")])} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.generationTechnology = value as CollectionInstrument["generationTechnology"] })} />
            <Select label="Supporting evidence" value={item.evidenceReference ?? ""} options={[["", "Choose an uploaded document"] as const, ...evidence.filter(file => file.quarantineStatus !== "rejected" || file.id === item.evidenceReference).map(file => [file.id, evidenceLabel(file)] as const)]} onChange={value => edit(next => { (next.payload as typeof p).instruments[index]!.evidenceReference = value || null; if (value && !next.evidenceIds.includes(value)) next.evidenceIds.push(value) })} />
            <Field label="CO2 rate (lb/MWh)" value={item.rateLbPerMwh?.co2 ?? ""} onChange={value => edit(next => { const ch4 = item.rateLbPerMwh?.ch4 ?? null; const n2o = item.rateLbPerMwh?.n2o ?? null; (next.payload as typeof p).instruments[index]!.rateLbPerMwh = value || ch4 || n2o ? { co2: value, ch4, n2o } : null })} hint="Required for emitting technologies for every instrument type. Leave the rate blank for wind, solar PV, hydro or nuclear to use the zero rule." />
            <Field label="CH4 rate (lb/MWh, if supplied)" value={item.rateLbPerMwh?.ch4 ?? ""} onChange={value => edit(next => { const current = (next.payload as typeof p).instruments[index]!; current.rateLbPerMwh = { co2: current.rateLbPerMwh?.co2 ?? "", ch4: value || null, n2o: current.rateLbPerMwh?.n2o ?? null } })} />
            <Field label="N2O rate (lb/MWh, if supplied)" value={item.rateLbPerMwh?.n2o ?? ""} onChange={value => edit(next => { const current = (next.payload as typeof p).instruments[index]!; current.rateLbPerMwh = { co2: current.rateLbPerMwh?.co2 ?? "", ch4: current.rateLbPerMwh?.ch4 ?? null, n2o: value || null } })} />
          </div><button type="button" onClick={() => edit(next => { (next.payload as typeof p).instruments.splice(index, 1) })}>Remove instrument</button></div>)}
          <button type="button" onClick={() => edit(next => { (next.payload as typeof p).instruments.push({ type: "energy_attribute_certificate", mwh: "", qualityCriteriaMet: false, vintageYear: 2025, evidenceReference: null, generationTechnology: "unknown", rateLbPerMwh: null }) })}>+ Add instrument</button>
          <p>A stated rate always takes precedence, including for wind, solar PV, hydro and nuclear. If a stated rate gives CO2 only, CH4 and N2O come from eGRID and the result is flagged as an estimate. Leave the rate blank for those four technologies, or state all three gases as 0, to claim zero for all gases.</p>
          <p>Biomass, biogas and landfill gas are collected but remain input needed in this beta. No instrument is silently counted at zero.</p>
        </div>}
        <div className="setup-subcard"><h3>Evidence linked to this version</h3>{evidence.some(file => file.quarantineStatus !== "rejected" || draft.evidenceIds.includes(file.id)) ? evidence.filter(file => file.quarantineStatus !== "rejected" || draft.evidenceIds.includes(file.id)).map(file => <label className="collection-evidence-choice" key={file.id}><input type="checkbox" checked={draft.evidenceIds.includes(file.id)} disabled={file.quarantineStatus === "rejected" && !draft.evidenceIds.includes(file.id)} onChange={event => edit(next => { next.evidenceIds = event.target.checked ? [...next.evidenceIds, file.id] : next.evidenceIds.filter(id => id !== file.id); if (!event.target.checked && next.kind === "electricity") next.payload.instruments.forEach(instrument => { if (instrument.evidenceReference === file.id) instrument.evidenceReference = null }) })} /> {evidenceLabel(file)}</label>) : <p>No linkable evidence uploaded yet.</p>}</div>
        {/* Bug hunt C (C-08): rewriting the reason retires a failed request too (as editing any field does), so a retry saves the reason shown. */}
        {selected && draft.state === "active" && <Field label="Reason for this correction" value={reason} invalid={invalid.has("Reason for this correction")} onChange={value => { setReason(value); pending.current = null }} hint="Required for a new version. Earlier versions remain available." />}
        {selected && draft.state === "active" && <button type="button" className="collection-withdraw" onClick={() => edit(next => { next.state = "withdrawn"; next.withdrawalReason = "" })}>Withdraw this record</button>}
        {selected && draft.state === "withdrawn" && <><Field label="Reason for withdrawal" invalid={invalid.has("Reason for withdrawal")} value={draft.withdrawalReason ?? ""} onChange={value => edit(next => { next.withdrawalReason = value })} hint="Required. The withdrawn version remains in history and is excluded from calculation." /><button type="button" onClick={() => edit(next => { next.state = "active"; next.withdrawalReason = null })}>Restore as active record</button></>}
        <button type="button" className="collection-save" disabled={busy || !canManage || !dirty || blocking.length > 0} aria-describedby={blocking.length > 0 ? "collection-save-problems" : saveProblem ? "collection-save-error" : !dirty && canManage ? "collection-save-unchanged" : undefined} onClick={() => void save()}>{selected ? draft.state === "withdrawn" ? "Save withdrawal" : "Save correction" : "Save activity"}</button>
        {!dirty && canManage && !saveProblem && blocking.length === 0 && <small className="nv-subtle collection-save-unchanged" id="collection-save-unchanged">{SCOPE3_PRESAVE_TEXT_R3D.unchanged}</small>}
        {blocking.length > 0 && <div className="collection-save-problems" id="collection-save-problems"><p>{SAVE_TEXT_R2E.blocked}</p><ul>{blocking.map(text => <li key={text}>{text}</li>)}</ul></div>}
        {saveProblem && <p ref={saveAlert} id="collection-save-error" tabIndex={-1} role="alert" className="worksheet-error collection-save-error"><strong>{SAVE_TEXT_R2E.notSaved}</strong> {saveProblem}</p>}
      </fieldset>
      {recordMode && <div className="nv-actions"><button type="button" className="nv-btn nv-btn--sm" disabled={busy} onClick={cancelCorrection}>Cancel correction</button></div>}
      {!recordMode && history}
    </div>
  </>
  const evidenceCard = <>
    <div className="worksheet-card"><h2>Private evidence</h2><p>Originals are hashed, company-scoped and quarantined on upload. A pending or rejected file cannot be downloaded as cleared evidence.</p>
      {canManage && <label className="setup-field"><span>Upload PDF, image, CSV or XLSX (up to 10 MiB)</span><input type="file" accept="application/pdf,image/jpeg,image/png,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,.jpg,.jpeg,.png,.csv,.xlsx" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = "" }} /></label>}
      <ul>{evidence.map(file => <li key={file.id}>{file.originalName} · {file.byteLength.toLocaleString()} bytes · {file.quarantineStatus} · SHA-256 {file.sha256.slice(0, 12)}… {file.quarantineStatus === "clean" && <button type="button" disabled={busy} onClick={() => void download(file)}>Download original</button>}</li>)}</ul>
    </div>
  </>
  // WO-06: the record view.
  if (recordMode) {
    const activity = selected ? selected.currentVersion.activity as CollectionDraft : null
    const linked = activity ? evidence.filter(file => activity.evidenceIds.includes(file.id)) : []
    return <section className="worksheet collection-workspace collection-record-view" aria-busy={busy}>
      <p className="collection-back"><a className="nv-link" href={allActivityHref} onClick={event => { if (!plainClick(event) || !onAllActivity) return; event.preventDefault(); onAllActivity() }}><span aria-hidden="true">← </span>All activity</a></p>
      <h1 ref={headingRef} tabIndex={-1} id="collection-record-heading">{selected && activity ? `${typeName(selected.kind)} · ${activity.sourceId}` : loaded ? "That record wasn’t found" : "Loading record…"}</h1>
      {selected && openedItem && <p className="collection-record-meta"><span className={`collection-state-chip collection-state-chip--${openedItem.status}`}>{stateLabel(openedItem.status)}</span><span>version {selected.currentVersion.revision}</span></p>}
      {status}
      {!loaded && error && workspaceId && <div className="nv-actions"><button type="button" className="nv-btn nv-btn--sm" disabled={busy} onClick={() => void refresh()}>{ACTIVITY_LIST_TEXT_R3C.retry}</button></div>}
      {viewOnly}
      {selected && activity && openedItem && <div className="worksheet-card collection-record-summary"><h2>Summary</h2>
        <dl className="collection-record-facts">
          <dt>Period</dt><dd>{scope3SavedRecordWhen(activity, inclusivePeriodEnd(activity.period.endExclusive))}</dd>
          <dt>{activity.kind === "fugitive" ? "Derived net release" : "Quantity"}</dt><dd>{(isScope3CollectionKind(activity.kind) ? scope3GroupedAmount(activity.quantity.originalValue) : activity.quantity.originalValue) || "unknown"} {isScope3CollectionKind(activity.kind) ? unitLabel(activity.quantity.originalUnit) : activity.quantity.originalUnit}</dd>
          <dt>Site</dt><dd>{context?.locations.find(location => location.id === activity.locationId)?.name ?? "Saved location"}</dd>
          {savedSummary(activity) && <><dt>Details</dt><dd>{savedSummary(activity)}</dd></>}
          <dt>Evidence</dt><dd>{linked.length ? <ul>{linked.map(file => <li key={file.id}>{evidenceLabel(file)}</li>)}</ul> : "No evidence linked"}</dd>
          {activity.state === "withdrawn" && activity.withdrawalReason && <><dt>Withdrawn because</dt><dd>{activity.withdrawalReason}</dd></>}
        </dl>
        <h3>Readiness</h3>
        {openedItem.readiness.length ? <ReadinessPanel findings={openedItem.readiness} /> : <p>No findings.</p>}
        {canManage && !correcting && <div className="nv-actions"><button type="button" className="nv-btn nv-btn--primary" id="collection-correct-record" disabled={busy} onClick={correctRecord}>Correct this record</button></div>}
      </div>}
      {selected && correcting && editorCard}
      {selected && <div className="worksheet-card collection-record-history">{history}</div>}
      {selected && correcting && evidenceCard}
      {footnote}
    </section>
  }
  return <section className="worksheet collection-workspace" aria-busy={busy}>
    {/* Round 3 lane C (PR-3): until the screen has loaded, neither the Scope 1 and 2 nor the Scope 3 wording is guessed. */}
    <h1 ref={headingRef} tabIndex={-1}>{!loaded ? ACTIVITY_LIST_TEXT_R3C.neutralHeading : scope3 ? "Collect Scope 1, 2 and 3 activity" : "Collect Scope 1 and 2 activity"}</h1>
    {loaded && <p>{scope3 ? COPY_TEXT_R2E.activityIntroScope3 : "Save source details and private evidence for each activity. Missing answers remain unresolved. Calculations and reports come only from beta methods that are not yet formally released."}</p>}
    {status}
    {!loaded && error && workspaceId && <div className="nv-actions"><button type="button" className="nv-btn nv-btn--sm" disabled={busy} onClick={() => void refresh()}>{ACTIVITY_LIST_TEXT_R3C.retry}</button></div>}
    {viewOnly}
    {intro}
    {loaded && <nav className="nv-actions collection-jump" aria-label={ACTIVITY_LIST_TEXT_R3C.jumpLabel}>
      {spendImportShown && <a className="nv-btn nv-btn--sm" href={`#${SPEND_IMPORT_ANCHOR}`} onClick={event => { event.preventDefault(); const target = document.getElementById(SPEND_IMPORT_ANCHOR); target?.scrollIntoView({ block: "start" }); target?.focus({ preventScroll: true }) }}>{ACTIVITY_LIST_TEXT_R3C.jumpSpend}</a>}
      <a className="nv-btn nv-btn--sm" href="#collection-record-editor" onClick={event => { event.preventDefault(); const target = document.getElementById("collection-record-editor"); target?.scrollIntoView({ block: "start" }); target?.focus({ preventScroll: true }) }}>{ACTIVITY_LIST_TEXT_R3C.jumpNew}</a>
    </nav>}

    <div className="worksheet-card" id="saved-activities"><h2>Saved activities</h2>
      {loaded && records.length > 0 && <div className="collection-list-filters" role="group" aria-label={ACTIVITY_LIST_TEXT_R3C.filterLabel}>
        <label className="setup-field"><span>{ACTIVITY_LIST_TEXT_R3C.statusLabel}</span><select aria-label={ACTIVITY_LIST_TEXT_R3C.statusLabel} value={listFilter.status} onChange={event => setFilter({ status: event.target.value as typeof listFilter.status })}>{ACTIVITY_LIST_TEXT_R3C.statuses.map(([value, label]) => <option key={value} value={value}>{`${label} (${value === "all" ? listed.length : listed.filter(item => item.status === value).length})`}</option>)}</select></label>
        <label className="setup-field"><span>{ACTIVITY_LIST_TEXT_R3C.kindLabel}</span><select aria-label={ACTIVITY_LIST_TEXT_R3C.kindLabel} value={kindFilter} onChange={event => setFilter({ kind: event.target.value })}><option value="">{ACTIVITY_LIST_TEXT_R3C.allKinds}</option>{presentKinds.map(kind => <option key={kind} value={kind}>{kindName(kind)}</option>)}</select></label>
        <label className="setup-field"><span>{ACTIVITY_LIST_TEXT_R3C.searchLabel}</span><input aria-label={ACTIVITY_LIST_TEXT_R3C.searchLabel} value={listFilter.search} onChange={event => setFilter({ search: event.target.value })} /></label>
        <p className="nv-subtle" role="status">{ACTIVITY_LIST_TEXT_R3C.showing(filtered.length ? page * ACTIVITY_LIST_TEXT_R3C.pageSize + 1 : 0, page * ACTIVITY_LIST_TEXT_R3C.pageSize + pageRows.length, filtered.length, records.length)}</p>
      </div>}
      <div className="collection-record-list">{!loaded ? <p>{error ? ACTIVITY_LIST_TEXT_R3C.notLoaded : "Loading collection records…"}</p> : records.length === 0 ? <p>No activity records saved yet.</p> : filtered.length === 0 ? <p>{ACTIVITY_LIST_TEXT_R3C.noMatch}</p> : pageRows.map(({ row, activity, readiness, status }) => {
        // WO-06: the row is a link to its record view (#/activity/<id>), named "<Type> · <source id>, <state>".
        return <div key={row.id} className="setup-subcard collection-row">
          <a id={`collection-row-${row.id}`} className="collection-row-link" href={`#/activity/${row.id}`} aria-label={`${typeName(row.kind)} · ${activity.sourceId}, ${stateLabel(status)}`} onClick={event => openRow(event, row)}>
            <span className="collection-row-link__title"><strong>{typeName(row.kind)}</strong> · {activity.sourceId}</span><span className="collection-row-link__chevron" aria-hidden="true">›</span>
          </a>
          <p className="nv-subtle">{stateLabel(status)} · version {row.currentVersion.revision} {activity.state === "withdrawn" && <span className="collection-status-badge">Withdrawn</span>}</p>
          {/* Round 3 lane D (PR-8): a dated spend line shows its invoice date; a Scope 3 amount has grouped digits. */}
          <p>{scope3SavedRecordWhen(activity, inclusivePeriodEnd(activity.period.endExclusive))} · {activity.kind === "fugitive" ? "Derived net release" : "Quantity"}: {(isScope3CollectionKind(activity.kind) ? scope3GroupedAmount(activity.quantity.originalValue) : activity.quantity.originalValue) || "unknown"} {isScope3CollectionKind(activity.kind) ? unitLabel(activity.quantity.originalUnit) : activity.quantity.originalUnit}</p>
          {savedSummary(activity) && <p className="nv-subtle">{savedSummary(activity)}</p>}
          <p>Source {activity.sourceId} · {context?.locations.find(location => location.id === activity.locationId)?.name ?? "Saved location"}</p>
          <ReadinessPanel findings={readiness} />
          {row.kind === "electricity" && activity.state === "active" && !scope3 && <button type="button" disabled={busy || !canManage || lineages.some(item => item.electricityRecordId === row.id)} onClick={() => void addGridLoss(row)}>{lineages.some(item => item.electricityRecordId === row.id) ? "Grid-loss source linked" : "Link grid-loss source"}</button>}
          {row.kind === "electricity" && scope3 && <p className="nv-subtle">Grid losses for this meter (Scope 3 category 3C) are calculated automatically when company setup includes category 3.</p>}
        </div>
      })}</div>
      {loaded && pages > 1 && <div className="nv-actions collection-list-pages"><button type="button" className="nv-btn nv-btn--sm" disabled={page === 0} onClick={() => setListPage(page - 1)}>{ACTIVITY_LIST_TEXT_R3C.previous}</button><span className="nv-subtle">{ACTIVITY_LIST_TEXT_R3C.pageOf(page + 1, pages)}</span><button type="button" className="nv-btn nv-btn--sm" disabled={page >= pages - 1} onClick={() => setListPage(page + 1)}>{ACTIVITY_LIST_TEXT_R3C.next}</button></div>}
      <button type="button" disabled={busy} onClick={() => void refresh()}>Reload saved records</button>
    </div>

    {editorCard}

    {/* I-09: spend CSV import (0030; schema 30 only) and its unmatched, duplicate and supersession queues. WO-06: a record it
        names opens at its record view (#/activity/<id>). */}
    {scope3Completion && workspaceId && availableScope3Kinds.includes("purchase_spend") && <div className="worksheet-card"><SpendImport companyId={workspaceId} actor={actor} onChanged={() => void refreshRecords()}
      onOpenRecord={id => { if (onOpenRecord) { onOpenRecord(id); return } const row = records.find(item => item.id === id); if (!row) return; openRecord(row); requestAnimationFrame(() => document.getElementById("collection-record-editor")?.scrollIntoView({ block: "start" })) }} /></div>}
    {evidenceCard}
    {footnote}
  </section>
}
