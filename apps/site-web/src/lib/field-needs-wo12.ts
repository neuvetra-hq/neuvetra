// WO-12 follow-up, the three field labels (CEO ruling, 12 Nov 2026): the label of every field on the Activity record form
// (CollectionWorkspace) and the Scope 3 record forms (components/scope3), by kind and field. Each label is derived from
// the real rules, not guessed, and `wo12-field-needs.test.ts` re-derives every entry:
// - "required": the Activity screen's save checks or the shared contract (which the server applies) refuse the record
//   without it;
// - "results": the record saves, and the calculation adapter (or, where named in the test, the Scope 3 engine) holds it
//   as needing input until the field is filled;
// - "optional": the record saves and calculates without it.
// The labels change nothing about what is saved or what the server accepts. A choice that always has a value (a list
// with no empty option the contract requires) is "required". Keys ending in a qualifier are the same field in another
// state: `co2-zero` (a zero-emission technology), `activityOverlap-fallback` (a category where spend is only a fallback)
// and `dq-basis-default` (no rating or origin set, so no reason is asked for).
import type { CollectionActivity } from "../../../../packages/neuvetra-database/src/collection-contract"
import type { Scope3ConsolidationApproach, Scope3PlanOptions } from "../../../../packages/neuvetra-database/src/scope3-collection"
import type { Scope3SetupFacts } from "./scope3-forms"
import { FIELD_NEED_NOTES, type FieldNeed } from "./wo12-text"
import type { CollectionContext } from "../../../../packages/neuvetra-database/src/collection-contract"
import { recordBoundaryHold, recordHold, type RecordBoundaryHold, type RecordSupersession } from "./record-holds-wo12b"
import { scope3SpendMappingKeyInput } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { kindLabel } from "./plain-language"
import type { CollectionActivityRecord } from "../../../../packages/neuvetra-database/src/collection-contract"
import { RECORD_HOLD_TEXT } from "./wo12b-text"

export const ACTIVITY_FIELD_NEEDS: Readonly<Record<string, Readonly<Record<string, FieldNeed>>>> = {
  common: { location: "required", source: "required", periodStart: "required", periodEnd: "required", quality: "optional", reference: "optional", notes: "optional", evidence: "optional", estimateBasis: "required", reason: "required", withdrawalReason: "required" },
  natural_gas: { quantity: "results", unit: "results", heatContent: "results", heatContentUnit: "required" },
  distillate_no2: { unit: "optional", fuelBasis: "required", gallons: "results", statedHhv: "optional", purchasedGallons: "results", openingGallons: "results", closingGallons: "results" },
  vehicle: { unit: "optional", vehicleFuel: "required", vehicleType: "required", modelYear: "required", vehicleGallons: "results", vehicleCount: "optional", miles: "results", milesBasis: "results", mpg: "results", mpgSource: "results" },
  fugitive: { gas: "required", termsUnit: "required", "term-PN": "results", "term-CN": "results", "term-PS": "results", "term-CD": "results", "term-RD": "results", insideBoundary: "results", maintainsRefrigerantStock: "results", retrofitInPeriod: "results", contractorRecords: "results", eventChronology: "results" },
  electricity: { quantity: "results", unit: "results", zip: "required", utility: "required", instrumentType: "required", mwh: "results", instrumentQuality: "results", vintage: "required", technology: "results", instrumentEvidence: "results", "co2-zero": "optional", co2: "results", ch4: "optional", n2o: "optional" },
  transport: { quantity: "results", unit: "results", transportCategory: "required", transportVehicle: "required", loadBasis: "results", thirdPartyFacilities: "optional" },
  waste: { quantity: "results", unit: "results", wasteCategory: "required", material: "results", treatment: "results" },
  business_travel: { quantity: "results", unit: "results", travelMode: "results", passengerSegments: "results", cabinClass: "optional", haulBasis: "required", hotelCountry: "results" },
  employee_commuting: { quantity: "results", unit: "results", commutingMode: "results" },
  dataQuality: { "dq-technological": "optional", "dq-temporal": "optional", "dq-geographical": "optional", "dq-completeness": "optional", "dq-reliability": "optional", "dq-origin": "optional", "dq-basis": "required", "dq-basis-default": "optional" },
  purchase_spend: { category: "required", quantity: "results", currency: "results", description: "required", supplier: "optional", glAccount: "optional", naicsSearch: "optional", naicsCode: "results", dollarYear: "optional", lineCovers: "optional", priceBasis: "required", taxTreatment: "optional", activityOverlap: "optional", firstDay: "required", lastDay: "required", lineDate: "optional", capitalFullCost: "results", paidByReportingCompany: "required", spendEstimateBasis: "required", "activityOverlap-fallback": "results", categoryConfirmed: "results", duplicateConfirmedDistinct: "results" },
  purchase_supplier: { category: "required", supplier: "required", product: "required", factorOrigin: "required", basis: "required", quantity: "results", unit: "results", factor: "required", boundary: "required", gwpBasis: "optional", verification: "optional", dataYear: "required", supersedes: "optional", allocationBasis: "required", allocationNumerator: "required", allocationDenominator: "required", hybridUpstreamCoveredBy: "required", supersedesSupplier: "required", supersedesLines: "optional" },
  energy_resold: { quantity: "results", unit: "results", gridBasis: "required", zip: "required", subregion: "results", utilityEiaId: "optional", utilityChoice: "results", resoldEnergyNotInScope2: "results" },
  commuting_average: { quantity: "results", unit: "results", workingDays: "required", sharesBasis: "required", distanceBasis: "required", activityOverlap: "optional", mode: "results", share: "required", distance: "required", distanceUnit: "required", occupancy: "optional" },
  teleworking: { carrier: "required", quantity: "results", unit: "results", baselineBasis: "required", zip: "required", subregion: "results", utilityEiaId: "optional", utilityChoice: "results" },
  asset_energy: { category: "required", asset: "required", counterparty: "optional", carrier: "required", quantity: "results", unit: "results", leaseType: "results", noOperationalControlBasis: "results", zip: "required", subregion: "results", utilityEiaId: "optional", utilityChoice: "results", allocation: "optional", refrigerant: "results", reportingArea: "required", buildingArea: "required", occupancyPercent: "required", areaUnit: "required" },
  partner_reported: { category: "required", partner: "required", quantity: "results", unit: "results", allocationBasis: "required", allocationNumerator: "required", allocationDenominator: "required", scope2Basis: "optional", gwpBasis: "optional", verification: "optional", leaseType: "results", periodMatches: "results", supersedes: "optional", noOperationalControlBasis: "results" },
  building_average: { category: "required", cbecsActivity: "results", quantity: "results", unit: "results", coveredDays: "required", usesNaturalGas: "results", gridBasis: "required", leaseType: "results", noOperationalControlBasis: "results", zip: "required", subregion: "results", utilityEiaId: "optional", utilityChoice: "results" },
  sold_fuel: { fuel: "results", quantity: "results", unit: "results", combustedInUse: "required" },
  sold_energy_product: { product: "required", quantity: "results", unit: "results", lifetimeBasis: "required", lifetime: "required", energyCarrier: "results", energyPer: "required", energyUnit: "results", useRegion: "results", lifetimeSource: "required" },
  sold_ghg_product: { product: "required", quantity: "results", unit: "results", gas: "results", charge: "required", chargeUnit: "required", release: "required", releaseBasis: "required" },
  end_of_life_split: { basis: "required", product: "optional", material: "results", quantity: "results", unit: "results", splitKnown: "results", share: "required", splitBasis: "required" },
  investment: { investee: "required", holding: "required", quantity: "results", unit: "results", snapshotDate: "required", attribution: "required", equityShare: "required", path: "required", investeeEmissions: "results", emissionsVerified: "optional", gwpBasis: "optional", denominatorType: "required", denominator: "required", revenue: "results", revenueYear: "optional", investeeNaics: "results", naicsSearch: "optional", initialSponsor: "optional", projectedAnnual: "optional", lifetimeYears: "optional" },
}

/** The record kinds with their own fields (every Scope 1 and 2 kind and every Scope 3 kind). */
export const FIELD_NEED_KINDS: readonly string[] = Object.keys(ACTIVITY_FIELD_NEEDS).filter(kind => kind !== "common" && kind !== "dataQuality")

/** A field's label: the kind's own entry, else the entry every record shares (site, source, period, reference and so on). */
export function activityFieldNeed(kind: string, field: string): FieldNeed {
  const need = ACTIVITY_FIELD_NEEDS[kind]?.[field] ?? ACTIVITY_FIELD_NEEDS.common![field] ?? ACTIVITY_FIELD_NEEDS.dataQuality![field]
  if (!need) throw new Error(`No field label for ${kind}.${field}.`)
  return need
}
/** The labels of one kind's form (components/scope3 pass these to their fields). */
export const fieldNeedsOf = (kind: string) => (field: string): FieldNeed => activityFieldNeed(kind, field)

/**
 * WO-12 QA round 1: what the form knows about the company that decides a field's label. Each is `undefined` when the
 * form can't know it (company setup couldn't be read, or no site is chosen yet); the label then says what it depends on
 * rather than guessing.
 * - `consolidationApproach`: company setup's boundary approach (`null` or "unknown" when setup hasn't chosen one).
 * - `locationCountry`: the chosen site's country in company setup (`null` when setup records none).
 * - `distanceCommutingOverlap`: whether the company has distance-based commuting records for a period that overlaps
 *   this record's (the adapter's `distanceCommutingPeriods`, scope3-collection.ts commuting_overlap_not_confirmed).
 */
export interface FieldNeedFacts {
  consolidationApproach?: Scope3ConsolidationApproach | null
  locationCountry?: string | null
  distanceCommutingOverlap?: boolean
  /** WO-12b: the hold company setup places on the record (every record of its scope, or every record at its site), if any. */
  boundary?: RecordBoundaryHold | null
  /** WO-12b: the record that replaces this spend line (the adapter's supersession map), with its name. */
  supersededBy?: RecordSupersession | null
}
/** A field's label and, where the label depends on something the person can see or change, a note that says what. */
export interface FieldLabel { need: FieldNeed; needNote?: string }

const VEHICLE_MILES = new Set(["miles", "milesBasis"]), VEHICLE_MPG = new Set(["mpg", "mpgSource"])
const FUGITIVE_AFTER_BOUNDARY = new Set(["term-PN", "term-CN", "term-PS", "term-CD", "term-RD", "maintainsRefrigerantStock", "retrofitInPeriod", "contractorRecords", "eventChronology"])
const FUGITIVE_AFTER_APPLICABILITY = new Set(["term-PN", "term-CN", "term-PS", "term-CD", "term-RD", "contractorRecords", "eventChronology"])
/** QA round 2: either applicability question answered Yes holds the record for review, so the other one is moot. */
const FUGITIVE_APPLICABILITY = new Set(["maintainsRefrigerantStock", "retrofitInPeriod"])
const LEASE_EXPLANATION_KINDS = new Set(["asset_energy", "building_average", "partner_reported"])

/**
 * A field's label in the form's current state (WO-12 QA round 1): the table's label, except where the rules make the need
 * depend on another answer, the site or company setup. Every case here is re-derived in each of its states by
 * wo12-field-needs.test.ts.
 * - Vehicle miles and fuel economy are alternatives: the one in use is "Needed for results", the other "Optional"; with
 *   neither, both say "Needed for results (one of: …)" (CO2 calculates, CH4 and N2O wait for one of them).
 * - A refrigerant record outside the reporting boundary is excluded whatever else is answered; one that keeps a
 *   refrigerant stock or was retrofitted is held for method review whatever the five terms, the records and the other
 *   applicability question say (QA round 2).
 * - Business travel's hotel country: a blank country uses the site's when that is the U.S. (scope3-collection.ts
 *   hotel_country_from_reporting_location); otherwise the stay is held (hotel_country_required).
 * - Survey-average commuting's overlap answer holds the record only when distance-based commuting records cover an
 *   overlapping period (commuting_overlap_not_confirmed).
 * - "Why no operational control" (category 8, operating lease) holds the record only under operational control
 *   (lease_in_scope1_2_under_boundary).
 */
export function fieldLabel(activity: Pick<CollectionActivity, "kind" | "payload">, field: string, facts: FieldNeedFacts = {}): FieldLabel {
  const label = baseFieldLabel(activity, field, facts)
  // WO-12b: while one answer holds the record (record-holds-wo12b.ts), no other answer can make it count: the answer that
  // holds it keeps its label and says so, the answers read before it keep theirs, and every other result field is Optional.
  const hold = recordHold(activity, facts)
  if (!hold) return label
  const note = hold.code === "superseded_by_supplier_record" ? RECORD_HOLD_TEXT.matchNote : RECORD_HOLD_TEXT.fieldNote
  if (hold.fields.includes(field)) return { need: label.need, needNote: label.needNote ? `${label.needNote} ${note}` : note }
  if (hold.upstream.includes(field) || label.need !== "results") return label
  return { need: "optional" }
}
function baseFieldLabel(activity: Pick<CollectionActivity, "kind" | "payload">, field: string, facts: FieldNeedFacts): FieldLabel {
  const need = activityFieldNeed(activity.kind, field)
  const p = activity.payload as unknown as Record<string, unknown>
  if (activity.kind === "vehicle" && (VEHICLE_MILES.has(field) || VEHICLE_MPG.has(field))) {
    const miles = p.miles !== null && p.miles !== undefined, mpg = p.fuelEconomy !== null && p.fuelEconomy !== undefined
    if (!miles && !mpg) return { need: "results", needNote: FIELD_NEED_NOTES.vehicleEither }
    return { need: (VEHICLE_MILES.has(field) ? miles : mpg) ? "results" : "optional" }
  }
  if (activity.kind === "fugitive" && p.insideBoundary === false && FUGITIVE_AFTER_BOUNDARY.has(field)) return { need: "optional" }
  if (activity.kind === "fugitive" && (p.maintainsRefrigerantStock === true || p.retrofitInPeriod === true) && FUGITIVE_AFTER_APPLICABILITY.has(field)) return { need: "optional" }
  if (activity.kind === "fugitive" && FUGITIVE_APPLICABILITY.has(field) && (field === "maintainsRefrigerantStock" ? p.retrofitInPeriod : p.maintainsRefrigerantStock) === true) return { need: "optional" }
  if (activity.kind === "business_travel" && field === "hotelCountry") {
    if (facts.locationCountry === undefined) return { need: "results", needNote: FIELD_NEED_NOTES.hotelCountryUnknown }
    return { need: facts.locationCountry === "US" ? "optional" : "results" }
  }
  if (activity.kind === "commuting_average" && field === "activityOverlap") {
    if (facts.distanceCommutingOverlap === undefined) return { need: "results", needNote: FIELD_NEED_NOTES.commutingOverlapUnknown }
    return { need: facts.distanceCommutingOverlap ? "results" : "optional" }
  }
  if (LEASE_EXPLANATION_KINDS.has(activity.kind) && field === "noOperationalControlBasis") {
    const approach = facts.consolidationApproach
    if (approach === undefined) return { need: "results", needNote: FIELD_NEED_NOTES.leaseApproachUnknown }
    if (approach === null || approach === "unknown") return { need: "optional", needNote: FIELD_NEED_NOTES.leaseApproachNotChosen }
    return { need: approach === "operational_control" ? "results" : "optional" }
  }
  return { need }
}
/** The labels of one record's form in its current state (the forms in components/scope3 spread these into their fields). */
export const fieldLabelsOf = (activity: Pick<CollectionActivity, "kind" | "payload">, facts: FieldNeedFacts = {}) => (field: string): FieldLabel => fieldLabel(activity, field, facts)

/**
 * The facts the Activity screen has for a record's labels: company setup as read (`undefined` until it is), the chosen site,
 * and the plan options the screen builds for this draft (`scope3ReadinessOptions`, the results route's options).
 */
export function activityFieldFacts(input: { setup: Scope3SetupFacts | undefined; activity: Pick<CollectionActivity, "kind" | "locationId" | "period" | "payload">; options: Scope3PlanOptions | null; context?: CollectionContext | null
  /** WO-12b: this record's ID and the saved records, to name the record that replaces a spend line; the spend lines' mapping keys, to say what it matches. */
  recordId?: string; records?: readonly CollectionActivityRecord[]; mappingKeys?: ReadonlyMap<string, string> }): FieldNeedFacts {
  const { setup, activity, options } = input
  const boundary = recordBoundaryHold(activity, input.context, setup?.reportingPeriod ?? null)
  const replacing = activity.kind === "purchase_spend" && input.recordId ? options?.supersession?.get(input.recordId) : undefined
  const countries = setup?.locationCountries
  const period = activity.period
  return {
    ...(setup !== undefined ? { consolidationApproach: setup.consolidationApproach } : {}),
    ...(countries && activity.locationId ? { locationCountry: countries.get(activity.locationId) ?? null } : {}),
    ...(boundary ? { boundary } : {}),
    ...(replacing ? { supersededBy: supersessionOf(replacing, activity, input.records, input.mappingKeys) } : {}),
    ...(activity.kind === "commuting_average" && options ? { distanceCommutingOverlap: (options.distanceCommutingPeriods ?? []).some(other => other.start < period.endExclusive && period.start < other.endExclusive) } : {}),
  }
}

/** A supplier name as the supersession compares it (scope3-collection.ts comparableName). */
const comparable = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ")
/**
 * WO-12b QA round 2: the record that replaces this spend line, and what it matches the line on, by the server's rule
 * (planScope3Supersession): the line's supplier name equals the record's named supplier, or the line's mapping key (its
 * GL account, supplier and description) is one the record lists. The key is the one the screen's spend lines carry for
 * that text; an edited line has none, as on the server until it is saved.
 */
function supersessionOf(id: string, activity: Pick<CollectionActivity, "payload">, records: readonly CollectionActivityRecord[] | undefined, mappingKeys: ReadonlyMap<string, string> | undefined): RecordSupersession {
  const replacer = records?.find(record => record.id === id)
  const name = replacer ? `${kindLabel(replacer.kind)} · ${(replacer.currentVersion.activity as { sourceId: string }).sourceId}` : "another record"
  const line = activity.payload as unknown as { supplierName: string; glAccount: string; description: string }
  const named = (replacer?.currentVersion.activity.payload as { supersedesSpend?: { supplierName: string; mappingKeys: string[] } | null } | undefined)?.supersedesSpend ?? null
  const byName = named !== null && comparable(line.supplierName) !== "" && comparable(line.supplierName) === comparable(named.supplierName)
  const key = mappingKeys?.get(scope3SpendMappingKeyInput(line))
  const byKey = named !== null && key !== undefined && key !== "" && named.mappingKeys.includes(key)
  const match = byName && byKey ? "both" : byKey ? "key" : "name"
  return { id, name, match, fields: match === "name" ? ["supplier"] : ["glAccount", "supplier", "description"] }
}
