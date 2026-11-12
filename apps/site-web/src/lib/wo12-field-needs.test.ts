/* eslint-disable @typescript-eslint/no-explicit-any -- the derivation edits records of every kind by path. */
// WO-12 follow-up, the three field labels (CEO ruling, 12 Nov 2026): every field of the Activity record form and the Scope 3
// record forms is "Required" (the record can't be saved without it), "Needed for results" (it saves, and the record shows
// as needing input until it is filled) or "Optional". This test derives each field's label from the real rules rather
// than trusting the table: starting from a complete record that saves and calculates, the field is left as a person who
// doesn't answer it leaves it, and then
// - the save checks (the Activity screen's own, the Scope 3 form checks and the shared contract the server applies)
//   refuse it → "Required";
// - else the readiness the screen shows (the calculation adapters, `recordReadiness`) holds it, or the Scope 3 engine
//   holds it with a named finding (checked to exist in scope3_engine.py) → "Needed for results";
// - else → "Optional".
import { describe, expect, test } from "bun:test"
import { deriveCollectionQuantity, validateCollectionActivity, type CollectionActivity, type CollectionContext, type CollectionEvidenceMetadata } from "../../../../packages/neuvetra-database/src/collection-contract"
import { SCOPE3_COLLECTION_UNITS, SCOPE3_COMPLETION_KINDS, SCOPE3_LEGACY_KINDS } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import { recordReadiness } from "../components/CollectionWorkspace"
import { scope3BlankCommutingMode, scope3BlankPayload } from "./scope3-form-defaults"
import { scope3DataQualityProblem, scope3PayloadProblem, scope3ReadinessOptions } from "./scope3-forms"
import { scope3PreSaveProblems } from "./scope3-display-r3d"
import { ACTIVITY_FIELD_NEEDS, activityFieldNeed, FIELD_NEED_KINDS } from "./field-needs-wo12"
import { FIELD_NEED_TEXT, type FieldNeed } from "./wo12-text"

const C = "94120000-0000-4000-8000-000000000001", SETUP = "94120000-0000-4000-8000-0000000000aa", SITE = "94120000-0000-4000-8000-0000000000bb", FILE = "94120000-0000-4000-8000-0000000000e1"
const context: CollectionContext = { companyId: C, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" },
  locations: [{ id: SITE, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] } as CollectionContext
const evidence: CollectionEvidenceMetadata[] = [{ id: FILE, companyId: C, bucket: "neuvetra-private-company-evidence", objectKey: `${C}/original/${FILE}`, originalName: "rec.pdf", mediaType: "application/pdf", byteLength: 10, sha256: "a".repeat(64), quarantineStatus: "clean", uploadedBy: C, createdAt: "2025-06-01T00:00:00.000Z" }]
const DECIMAL = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const SCOPE12_UNITS: Record<string, readonly string[]> = { natural_gas: ["therm", "MMBtu", "scf", "ccf", "mcf"], distillate_no2: ["US_gallon"], vehicle: ["US_gallon"], fugitive: ["kg", "lb"], electricity: ["kWh", "MWh"] }
const isScope3 = (kind: string) => (SCOPE3_LEGACY_KINDS as readonly string[]).includes(kind) || (SCOPE3_COMPLETION_KINDS as readonly string[]).includes(kind)

type A = CollectionActivity & { payload: any }
const record = (kind: string, quantity: [string, string], payload: unknown, extra: Partial<A> = {}): A => ({ kind, locationId: SITE, setupVersionId: SETUP, sourceId: "SRC-1", state: "active", withdrawalReason: null,
  quantity: { originalValue: quantity[0], originalUnit: quantity[1], normalizedValue: null, normalizedUnit: null }, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" },
  reference: "Bill 1", notes: "", evidenceIds: [], payload: structuredClone(payload), ...extra }) as A
const fixture = (label: string): A => {
  const found = SCOPE3_PAYLOAD_FIXTURES.find(item => item.label === label)
  if (!found) throw new Error(`no fixture ${label}`)
  return record(found.kind, [found.quantity.originalValue, found.quantity.originalUnit], found.payload)
}

/** The activity as the Activity screen saves it (prepareActivityForSave): derived quantities and normalization. */
function prepared(draft: A): A {
  const copy = structuredClone(draft)
  if (copy.kind === "vehicle") { copy.payload.vehicleGroupId = copy.sourceId; if (!copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.gallons }
  if (copy.kind === "electricity") copy.payload.meterOrAccountNumber = copy.sourceId
  if (copy.kind === "distillate_no2" && !copy.quantity.originalValue) copy.quantity.originalValue = copy.payload.consumption.basis === "measured" ? copy.payload.consumption.gallons : copy.payload.consumption.purchasedGallons
  if (copy.kind === "natural_gas" && !["scf", "ccf", "mcf"].includes(copy.quantity.originalUnit)) copy.payload.heatContent = null
  const units = (isScope3(copy.kind) ? (SCOPE3_COLLECTION_UNITS as Record<string, readonly string[]>)[copy.kind] : SCOPE12_UNITS[copy.kind]) ?? []
  const q = copy.quantity
  if (DECIMAL.test(q.originalValue) && units.includes(q.originalUnit)) { q.normalizedValue = q.originalValue; q.normalizedUnit = q.originalUnit } else { q.normalizedValue = null; q.normalizedUnit = null }
  copy.quantity = deriveCollectionQuantity(copy.kind, copy.payload, copy.quantity)
  return copy
}

/** Why the Activity screen refuses to save the draft (CollectionWorkspace's save checks, then the shared contract), or null. */
function saveRefusal(draft: A): string | null {
  const a = prepared(draft), p = a.payload
  if (!a.locationId) return "location"
  if (!a.sourceId.trim()) return "source"
  if (a.kind === "electricity" && !/^\d{5}$/.test(p.zip)) return "zip"
  if (a.kind === "electricity" && !p.utilityName.trim()) return "utility"
  if (a.kind === "electricity" && p.instruments.some((i: any) => !Number.isInteger(i.vintageYear) || i.vintageYear < 1000 || i.vintageYear > 9999)) return "vintage"
  if (a.kind === "vehicle" && (!p.fuel.trim() || !p.vehicleType.trim() || !Number.isInteger(p.modelYear) || p.modelYear < 1900 || p.modelYear > 2026 || p.vehicleCount !== null && !(p.vehicleCount > 0))) return "vehicle"
  if (a.quality === "estimated" && !a.estimateBasis?.trim()) return "estimate basis"
  if (isScope3(a.kind)) {
    const problem = scope3PayloadProblem(a.kind as never, a.payload) ?? scope3DataQualityProblem(a.payload) ?? scope3PreSaveProblems(a)[0]?.text
    if (problem) return problem
  }
  try { validateCollectionActivity(a) } catch (cause) { return (cause as Error).message || "contract" }
  return null
}
const HOLDS = new Set(["input_needed", "review_required", "partial", "method_pending"])
/** What the record's readiness shows as still needed (the Activity list and record view use the same findings). */
function needsInput(draft: A): string[] {
  const a = prepared(draft)
  const scope3 = isScope3(a.kind) ? { options: scope3ReadinessOptions({ setup: { reportingPeriod: context.reportingPeriod!, consolidationApproach: "operational_control" } as never, context, records: [], draft: { recordId: C, activity: a }, mappingKeys: new Map() }), recordId: C } : undefined
  return recordReadiness(a, context, evidence, undefined, scope3).filter(finding => HOLDS.has(finding.status)).map(finding => finding.reason)
}
const ENGINE = await Bun.file(new URL("../../../site-api/src/calculation/scope3_engine.py", import.meta.url)).text()

/**
 * One field: the complete record it is checked on, how a person leaves it unanswered, and, where only the Scope 3 engine
 * (not the adapter) holds the record, the engine's finding. A field always answered (a choice with no empty option the
 * contract requires) is checked by giving it no value at all.
 */
type Case = { kind: string; field: string; base: () => A; leave: (a: A) => void; engine?: string }
const cases: Case[] = []
const add = (kind: string, base: () => A, fields: Record<string, ((a: A) => void) | [((a: A) => void), string]>) => {
  for (const [field, how] of Object.entries(fields)) cases.push({ kind, field, base, leave: Array.isArray(how) ? how[0] : how, ...(Array.isArray(how) ? { engine: how[1] } : {}) })
}
const blank = (kind: string, key: string) => (a: A) => { a.payload[key] = structuredClone((scope3BlankPayload(kind as never) as any)[key]) }
const set = (path: string, value: unknown) => (a: A) => { const keys = path.split("."); let target: any = a; for (const key of keys.slice(0, -1)) target = target[key]; target[keys.at(-1)!] = value }

// ---- Fields every record has (CollectionWorkspace).
const gasBill = () => record("natural_gas", ["1200", "therm"], { heatContent: null })
add("common", gasBill, {
  location: set("locationId", ""), source: set("sourceId", ""), periodStart: set("period.start", ""), periodEnd: set("period.endExclusive", ""),
  quality: set("quality", "unknown"), reference: set("reference", ""), notes: set("notes", ""), evidence: set("evidenceIds", []),
})
add("common", () => record("natural_gas", ["1200", "therm"], { heatContent: null }, { quality: "estimated", estimateBasis: "Pro-rated from 11 bills" }), { estimateBasis: set("estimateBasis", "") })

// ---- Scope 1 and 2.
add("natural_gas", gasBill, { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", "") })
const volumetric = () => record("natural_gas", ["100", "ccf"], { heatContent: { value: "0.1037", unit: "MMBtu per ccf" } })
add("natural_gas", volumetric, { heatContent: set("payload.heatContent", null), heatContentUnit: set("payload.heatContent.unit", "") })
const generator = () => record("distillate_no2", ["", "US_gallon"], { consumption: { basis: "measured", gallons: "100" }, statedHhvMmbtuPerGallon: null })
add("distillate_no2", generator, { unit: set("quantity.originalUnit", ""), fuelBasis: set("payload.consumption.basis", ""), gallons: set("payload.consumption.gallons", ""), statedHhv: set("payload.statedHhvMmbtuPerGallon", null) })
const tanks = () => record("distillate_no2", ["", "US_gallon"], { consumption: { basis: "purchases_with_tank_levels", purchasedGallons: "100", openingGallons: "20", closingGallons: "10" }, statedHhvMmbtuPerGallon: null })
add("distillate_no2", tanks, { purchasedGallons: set("payload.consumption.purchasedGallons", ""), openingGallons: set("payload.consumption.openingGallons", ""), closingGallons: set("payload.consumption.closingGallons", "") })
const van = (extra: Record<string, unknown> = {}) => () => record("vehicle", ["", "US_gallon"], { vehicleGroupId: "SRC-1", fuel: "diesel", vehicleType: "diesel_light_duty_truck", modelYear: 2020, gallons: "100", vehicleCount: null, miles: { value: "1000", basis: "odometer" }, fuelEconomy: null, ...extra })
add("vehicle", van(), {
  unit: set("quantity.originalUnit", ""), vehicleFuel: set("payload.fuel", ""), vehicleType: set("payload.vehicleType", ""), modelYear: set("payload.modelYear", Number("")), vehicleGallons: set("payload.gallons", ""), vehicleCount: set("payload.vehicleCount", null),
  // Miles or fuel economy: without either, CO2 calculates and CH4 and N2O don't (shown as a partial calculation).
  miles: set("payload.miles", null), milesBasis: set("payload.miles.basis", ""),
})
add("vehicle", van({ miles: null, fuelEconomy: { mpg: "22", source: "fleet_record" } }), { mpg: set("payload.fuelEconomy", null), mpgSource: set("payload.fuelEconomy.source", "") })
const refrigerant = () => record("fugitive", ["", "kg"], { gas: "R-410A", unit: "kg", terms: { PN: "0", CN: "0", PS: "2.5", CD: "0", RD: "0" }, insideBoundary: true, maintainsRefrigerantStock: false, retrofitInPeriod: false, contractorRecordsComplete: true, eventChronologyComplete: true })
add("fugitive", refrigerant, {
  gas: set("payload.gas", ""), termsUnit: set("payload.unit", ""),
  ...Object.fromEntries(["PN", "CN", "PS", "CD", "RD"].map(term => [`term-${term}`, set(`payload.terms.${term}`, "")])),
  insideBoundary: set("payload.insideBoundary", null), maintainsRefrigerantStock: set("payload.maintainsRefrigerantStock", null), retrofitInPeriod: set("payload.retrofitInPeriod", null),
  contractorRecords: set("payload.contractorRecordsComplete", false), eventChronology: set("payload.eventChronologyComplete", false),
})
const instrument = (extra: Record<string, unknown> = {}) => ({ type: "energy_attribute_certificate", mwh: "1", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: FILE, generationTechnology: "wind", rateLbPerMwh: null, ...extra })
const meter = (instruments: unknown[] = []) => () => record("electricity", ["10000", "kWh"], { meterOrAccountNumber: "SRC-1", utilityName: "Synthetic", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: null, instruments }, { evidenceIds: [FILE] })
add("electricity", meter(), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), zip: set("payload.zip", ""), utility: set("payload.utilityName", "") })
add("electricity", meter([instrument()]), {
  instrumentType: set("payload.instruments.0.type", ""), mwh: set("payload.instruments.0.mwh", ""), instrumentQuality: set("payload.instruments.0.qualityCriteriaMet", false), vintage: set("payload.instruments.0.vintageYear", Number("")),
  technology: set("payload.instruments.0.generationTechnology", "unknown"), instrumentEvidence: set("payload.instruments.0.evidenceReference", null),
})
const coal = () => meter([instrument({ generationTechnology: "natural_gas", rateLbPerMwh: { co2: "900", ch4: "0.02", n2o: "0.003" } })])()
// A zero-emission technology (wind, solar, hydro, nuclear) may leave its rates blank: the zero rule applies.
add("electricity", () => meter([instrument({ rateLbPerMwh: { co2: "0", ch4: "0", n2o: "0" } })])(), { "co2-zero": set("payload.instruments.0.rateLbPerMwh", null) })
add("electricity", coal, { co2: set("payload.instruments.0.rateLbPerMwh", null), ch4: set("payload.instruments.0.rateLbPerMwh.ch4", null), n2o: set("payload.instruments.0.rateLbPerMwh.n2o", null) })

// ---- The four Scope 3 kinds of 0029 (their forms are on the Activity screen).
add("transport", () => fixture("transport: 0029 payload"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), transportCategory: set("payload.category", 0), transportVehicle: set("payload.vehicle", ""), loadBasis: set("payload.loadBasis", null), thirdPartyFacilities: set("payload.thirdPartyFacilities", "unknown") })
add("waste", () => fixture("waste: 0029 payload"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), wasteCategory: set("payload.category", 0), material: set("payload.material", ""), treatment: set("payload.treatment", "") })
add("business_travel", () => fixture("business_travel: 0029 payload"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), travelMode: set("payload.mode", ""), passengerSegments: set("payload.passengerSegments", null) })
add("business_travel", () => fixture("business_travel: v2 with cabin class"), { cabinClass: set("payload.cabinClass", null) })
add("business_travel", () => fixture("business_travel: v2 with data quality"), { haulBasis: set("payload.haulBasis", null) })
add("business_travel", () => fixture("business_travel: v2 hotel stay in room-nights (normalized from 0030)"), { hotelCountry: set("payload.hotelCountry", null) })
add("employee_commuting", () => fixture("employee_commuting: 0029 payload"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), commutingMode: set("payload.mode", "") })

// ---- Data quality (every Scope 3 record at schema 30).
add("dataQuality", () => fixture("transport: with data quality"), {
  ...Object.fromEntries(["technological", "temporal", "geographical", "completeness", "reliability"].map(name => [`dq-${name}`, set(`payload.dataQuality.indicators.${name}`, null)])),
  "dq-origin": set("payload.dataQuality.activityDataOrigin", null), "dq-basis": set("payload.dataQuality.basis", null),
})
// The basis is asked for only when the company sets a rating or an origin; with the method's defaults it is optional.
add("dataQuality", () => { const a = fixture("transport: 0029 payload"); a.payload.dataQuality = { indicators: { technological: null, temporal: null, geographical: null, completeness: null, reliability: null }, activityDataOrigin: null, basis: "Method defaults kept." }; return a }, { "dq-basis-default": set("payload.dataQuality.basis", null) })

// ---- The 0030 kinds (components/scope3).
const S = (kind: string, key: string) => blank(kind, key)
add("purchase_spend", () => fixture("purchase_spend: manual line"), {
  category: set("payload.category", 0), quantity: set("quantity.originalValue", ""), currency: set("quantity.originalUnit", ""), description: S("purchase_spend", "description"), supplier: S("purchase_spend", "supplierName"),
  glAccount: S("purchase_spend", "glAccount"), naicsSearch: () => {}, naicsCode: S("purchase_spend", "naicsCode"), dollarYear: S("purchase_spend", "dollarYear"), lineCovers: () => {}, priceBasis: set("payload.marginChoice", ""),
  taxTreatment: S("purchase_spend", "taxTreatment"), activityOverlap: S("purchase_spend", "activityOverlap"), firstDay: set("period.start", ""), lastDay: set("period.endExclusive", ""),
})
add("purchase_spend", () => fixture("purchase_spend: line date 31 March 2025"), { lineDate: S("purchase_spend", "lineDate") })
add("purchase_spend", () => fixture("purchase_spend: imported capital good, without margins"), { capitalFullCost: S("purchase_spend", "capitalFullCost") })
add("purchase_spend", () => fixture("purchase_spend: longest texts; category 9 with overlap confirmed"), {
  paidByReportingCompany: S("purchase_spend", "paidByReportingCompany"), spendEstimateBasis: set("payload.spendEstimateBasis", ""), "activityOverlap-fallback": S("purchase_spend", "activityOverlap"),
})
// A code usually recorded elsewhere (energy, here) counts in category 1 only once the category is confirmed.
add("purchase_spend", () => { const a = fixture("purchase_spend: manual line"); a.payload.naicsCode = "324110"; a.payload.categoryConfirmed = true; return a }, { categoryConfirmed: S("purchase_spend", "categoryConfirmed") })
add("purchase_spend", () => fixture("purchase_spend: possible duplicate confirmed distinct"), { duplicateConfirmedDistinct: S("purchase_spend", "duplicateConfirmedDistinct") })
add("purchase_supplier", () => fixture("purchase_supplier: product factor"), {
  category: set("payload.category", 0), supplier: S("purchase_supplier", "supplierName"), product: S("purchase_supplier", "product"), factorOrigin: S("purchase_supplier", "factorOrigin"), basis: set("payload.basis", ""),
  quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), factor: S("purchase_supplier", "factorValue"), boundary: S("purchase_supplier", "boundary"), gwpBasis: S("purchase_supplier", "gwpBasis"),
  verification: S("purchase_supplier", "verification"), dataYear: S("purchase_supplier", "dataYear"), supersedes: S("purchase_supplier", "supersedesSpend"),
})
add("purchase_supplier", () => fixture("purchase_supplier: allocated total by revenue, with data quality"), { allocationBasis: set("payload.allocationBasis", ""), allocationNumerator: set("payload.allocationNumerator", ""), allocationDenominator: set("payload.allocationDenominator", "") })
add("purchase_supplier", () => fixture("purchase_supplier: hybrid, upstream in other records"), { hybridUpstreamCoveredBy: set("payload.hybridUpstreamCoveredBy", "") })
add("purchase_supplier", () => fixture("purchase_supplier: supersedes fifty mapping keys"), { supersedesSupplier: set("payload.supersedesSpend.supplierName", ""), supersedesLines: set("payload.supersedesSpend.mappingKeys", []) })
const grid = (kind: string) => ({ zip: S(kind, "zip"), subregion: S(kind, "subregion"), utilityEiaId: set("payload.utilityEiaId", null), utilityChoice: S(kind, "subregion") })
add("energy_resold", () => fixture("energy_resold: with utility and data quality"), { quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), gridBasis: set("payload.gridBasis", ""), ...grid("energy_resold"), resoldEnergyNotInScope2: S("energy_resold", "resoldEnergyNotInScope2") })
add("commuting_average", () => fixture("commuting_average: three modes"), {
  quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), workingDays: S("commuting_average", "workingDays"), sharesBasis: S("commuting_average", "sharesBasis"), distanceBasis: S("commuting_average", "distanceBasis"),
  activityOverlap: S("commuting_average", "activityOverlap"), mode: set("payload.modes.0.mode", ""), share: set("payload.modes.0.sharePercent", ""), distance: set("payload.modes.0.oneWayDistance", ""),
  distanceUnit: set("payload.modes.0.distanceUnit", ""), occupancy: set("payload.modes.0.occupancy", null),
})
void scope3BlankCommutingMode
add("teleworking", () => fixture("teleworking: electricity in MWh with utility"), { carrier: set("payload.carrier", ""), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), baselineBasis: S("teleworking", "baselineBasis"), ...grid("teleworking") })
add("asset_energy", () => fixture("asset_energy: electricity, sub-metered"), {
  category: S("asset_energy", "category"), asset: S("asset_energy", "assetLabel"), counterparty: S("asset_energy", "counterpartyName"), carrier: set("payload.carrier", ""), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""),
  leaseType: S("asset_energy", "leaseType"), noOperationalControlBasis: S("asset_energy", "noOperationalControlBasis"), ...grid("asset_energy"), allocation: S("asset_energy", "allocation"),
})
add("asset_energy", () => fixture("asset_energy: refrigerant, category 14, no lease type"), { refrigerant: set("payload.refrigerantGas", "") })
add("asset_energy", () => fixture("asset_energy: natural gas with area allocation, category 13 finance lease"), {
  reportingArea: set("payload.allocation.reportingArea", ""), buildingArea: set("payload.allocation.buildingArea", ""), occupancyPercent: set("payload.allocation.occupancyPercent", ""), areaUnit: set("payload.allocation.areaUnit", ""),
})
add("partner_reported", () => fixture("partner_reported: tenant share by area"), {
  category: S("partner_reported", "category"), partner: S("partner_reported", "counterpartyName"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), allocationBasis: S("partner_reported", "allocationBasis"),
  allocationNumerator: set("payload.allocationNumerator", ""), allocationDenominator: set("payload.allocationDenominator", ""), scope2Basis: S("partner_reported", "scope2Basis"), gwpBasis: S("partner_reported", "gwpBasis"),
  verification: set("payload.verification", "unverified"), leaseType: S("partner_reported", "leaseType"), periodMatches: [S("partner_reported", "periodMatches"), "partner_period_mismatch"], supersedes: S("partner_reported", "supersedesSpend"),
})
add("partner_reported", () => { const a = fixture("partner_reported: tenant share by area"); a.payload.category = 8; a.payload.noOperationalControlBasis = "Partner operates the site."; return a }, { noOperationalControlBasis: S("partner_reported", "noOperationalControlBasis") })
add("building_average", () => fixture("building_average: office"), {
  category: S("building_average", "category"), cbecsActivity: S("building_average", "cbecsActivity"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), coveredDays: S("building_average", "coveredDays"),
  usesNaturalGas: [S("building_average", "usesNaturalGas"), "natural_gas_use_unknown"], gridBasis: set("payload.gridBasis", ""), leaseType: S("building_average", "leaseType"), noOperationalControlBasis: S("building_average", "noOperationalControlBasis"), ...grid("building_average"),
})
add("sold_fuel", () => fixture("sold_fuel: propane in gallons"), { fuel: S("sold_fuel", "fuel"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), combustedInUse: set("payload.combustedInUse", "") })
add("sold_energy_product", () => fixture("sold_energy_product: electricity over ten years"), {
  product: S("sold_energy_product", "productLabel"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), lifetimeBasis: set("payload.lifetimeBasis", ""), lifetime: S("sold_energy_product", "lifetimeQuantity"),
  energyCarrier: set("payload.energyCarrier", ""), energyPer: S("sold_energy_product", "energyPerBasis"), energyUnit: set("payload.energyUnit", ""), useRegion: S("sold_energy_product", "useRegion"), lifetimeSource: S("sold_energy_product", "lifetimeSource"),
})
add("sold_ghg_product", () => fixture("sold_ghg_product: annual leak rate"), {
  product: S("sold_ghg_product", "productLabel"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), gas: S("sold_ghg_product", "gas"), charge: S("sold_ghg_product", "chargePerUnit"), chargeUnit: set("payload.chargeUnit", ""),
  release: S("sold_ghg_product", "useReleasePercent"), releaseBasis: S("sold_ghg_product", "releaseBasis"),
})
add("end_of_life_split", () => fixture("end_of_life_split: packaging with a known split"), {
  basis: set("payload.basis", ""), product: S("end_of_life_split", "productLabel"), material: S("end_of_life_split", "material"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""),
  splitKnown: [(a: A) => { a.payload.split = null; a.payload.splitBasis = null }, "treatment_split_unknown"], share: set("payload.split.recycled", ""), splitBasis: set("payload.splitBasis", ""),
})
add("investment", () => fixture("investment: equity share, investee reported"), {
  investee: S("investment", "investeeName"), holding: S("investment", "holdingType"), quantity: set("quantity.originalValue", ""), unit: set("quantity.originalUnit", ""), snapshotDate: S("investment", "snapshotDate"),
  attribution: set("payload.attribution.basis", ""), equityShare: set("payload.attribution.percent", ""), path: set("payload.path", ""), investeeEmissions: [S("investment", "investeeEmissions"), "investee_emissions_required"],
  emissionsVerified: S("investment", "emissionsVerified"), gwpBasis: S("investment", "gwpBasis"),
})
add("investment", () => fixture("investment: listed equity over EVIC"), { denominatorType: set("payload.attribution.denominatorType", ""), denominator: set("payload.attribution.denominator", "") })
add("investment", () => fixture("investment: revenue EEIO proxy"), {
  revenue: S("investment", "revenue"), revenueYear: S("investment", "revenueYear"), investeeNaics: S("investment", "naicsCode"), naicsSearch: () => {},
})
add("investment", () => fixture("investment: project finance as initial sponsor"), { initialSponsor: (a: A) => { a.payload.initialSponsor = false; a.payload.projectedAnnual = null; a.payload.lifetimeYears = null }, projectedAnnual: S("investment", "projectedAnnual"), lifetimeYears: S("investment", "lifetimeYears") })

/** The label the rules give the field. */
function derived(item: Case): { need: FieldNeed; why: string } {
  const before = item.base()
  // The starting record is complete: it saves and nothing is needed.
  if (saveRefusal(before)) throw new Error(`${item.kind}.${item.field}: the starting record doesn't save (${saveRefusal(before)})`)
  if (needsInput(before).length) throw new Error(`${item.kind}.${item.field}: the starting record already needs input (${needsInput(before).join(" | ")})`)
  const after = structuredClone(before)
  item.leave(after)
  const refused = saveRefusal(after)
  if (refused) return { need: "required", why: refused }
  const needed = needsInput(after)
  if (needed.length) return { need: "results", why: needed.join(" | ") }
  if (item.engine) return { need: "results", why: `engine: ${item.engine}` }
  return { need: "optional", why: "saves and calculates" }
}

describe("WO-12 field labels: derived from the save checks and the readiness rules", () => {
  test("each label has its words", () => {
    expect(FIELD_NEED_TEXT).toEqual({ required: "Required", results: "Needed for results", optional: "Optional" })
  })

  test("every field's label is the one the rules give it", () => {
    const wrong: string[] = []
    for (const item of cases) {
      const { need, why } = derived(item)
      const declared = ACTIVITY_FIELD_NEEDS[item.kind]?.[item.field]
      if (declared !== need) wrong.push(`${item.kind}.${item.field}: declared ${declared ?? "nothing"}, rules say ${need} (${why})`)
    }
    expect(wrong).toEqual([])
  })

  test("every declared label is checked against the rules, and the engine findings named exist", () => {
    const checked = new Set(cases.map(item => `${item.kind}.${item.field}`))
    const unchecked = Object.entries(ACTIVITY_FIELD_NEEDS).flatMap(([kind, fields]) => Object.keys(fields).map(field => `${kind}.${field}`)).filter(key => !checked.has(key) && !NOT_A_RECORD_VALUE.has(key))
    expect(unchecked).toEqual([])
    for (const item of cases.filter(entry => entry.engine)) expect(ENGINE).toContain(`'${item.engine}'`)
  })

  test("a kind's field takes the kind's label, else the label every record shares; every kind has a table", () => {
    expect(activityFieldNeed("natural_gas", "location")).toBe("required")
    expect(activityFieldNeed("purchase_spend", "description")).toBe("required")
    expect(activityFieldNeed("natural_gas", "notes")).toBe("optional")
    for (const kind of [...Object.keys(SCOPE12_UNITS), ...SCOPE3_LEGACY_KINDS, ...SCOPE3_COMPLETION_KINDS]) expect(FIELD_NEED_KINDS).toContain(kind)
  })
})

/** Declared fields that are not a value of the record: checked by the component tests, not by a mutation here. */
const NOT_A_RECORD_VALUE = new Set(["common.reason", "common.withdrawalReason"])
