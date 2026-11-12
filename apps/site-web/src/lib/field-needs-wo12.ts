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
import type { FieldNeed } from "./wo12-text"

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
