/**
 * Scope 3 record forms: the empty draft of each kind and the facts a form needs about it (Scope 3 completion I-08; Claude,
 * 30 October 2026; DESIGN 7.2). Browser-safe, no React.
 *
 * Empty drafts follow the contract's exact key sets (scope3-collection-contract.ts) and never invent a fact: a value the
 * company must state (a category that spans very different activities, a data year, a lease or snapshot date, a supplier's
 * boundary, a use-phase release share, ...) starts blank or as a sentinel the contract refuses, so the form says what is
 * missing before anything is saved. Defaults are kept only where they are the cautious reading (not verified, GWP basis
 * not stated, overlap not confirmed, not paid confirmed false, the EPA with-margins default for spend).
 */
import type { CollectionActivity, CollectionContext } from "../../../../packages/neuvetra-database/src/collection-contract"
import {
  SCOPE3_COMPLETION_KINDS, SCOPE3_LEGACY_KINDS, SCOPE3_UNIT_FAMILIES, SCOPE3_WASTE_UNITS,
  type Scope3CollectionKind, type Scope3CompletionKind, type Scope3PayloadByKind, type Scope3SupersedesSpend,
} from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { scope3IsHotelMode } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { SCOPE3_METHODS, type Scope3DqIndicator, type Scope3DqRating, type Scope3MethodType, type Scope3ActivityDataOrigin } from "../../../../packages/neuvetra-database/src/scope3-method-catalog"
import { SCOPE3_SOLD_FUEL_FACTS } from "./scope3-register-labels"
import type { CollectionZipLookup } from "./collection-api"

/** The units each form offers: the engine's tokens for the family the payload names (the contract lists their union). */
export function scope3FormUnits(kind: Scope3CompletionKind, payload: Record<string, unknown>): readonly string[] {
  switch (kind) {
    case "purchase_spend": case "investment": return ["USD"]
    case "purchase_supplier": return payload.basis === "allocated_total" ? SCOPE3_UNIT_FAMILIES.supplierAllocated : SCOPE3_UNIT_FAMILIES.supplierProduct
    case "energy_resold": return SCOPE3_UNIT_FAMILIES.electricity
    case "commuting_average": return ["employee"]
    case "teleworking": return payload.carrier === "natural_gas" ? SCOPE3_UNIT_FAMILIES.naturalGas : SCOPE3_UNIT_FAMILIES.electricity
    case "asset_energy": return payload.carrier === "natural_gas" ? SCOPE3_UNIT_FAMILIES.assetNaturalGas : payload.carrier === "refrigerant" ? SCOPE3_UNIT_FAMILIES.refrigerant : SCOPE3_UNIT_FAMILIES.electricity
    case "partner_reported": return SCOPE3_UNIT_FAMILIES.supplierAllocated
    case "building_average": return ["sqft", "m2"]
    case "sold_fuel": { const fact = SCOPE3_SOLD_FUEL_FACTS[String(payload.fuel)]; return fact ? [fact.unit, "MMBtu"] : ["MMBtu", "US_gallon", "short_ton", "scf"] }
    case "sold_energy_product": case "sold_ghg_product": return ["unit"]
    case "end_of_life_split": return SCOPE3_WASTE_UNITS
  }
}
/** What the record's amount is, per kind (the label of the quantity field). */
export function scope3QuantityLabel(kind: Scope3CompletionKind, payload: Record<string, unknown>): string {
  switch (kind) {
    case "purchase_spend": return "Amount spent"
    case "purchase_supplier": return payload.basis === "allocated_total" ? "Supplier’s emissions figure (before our share)" : "Quantity bought"
    case "energy_resold": return "Electricity bought and resold"
    case "commuting_average": return "Headcount (employees)"
    case "teleworking": return "Extra home energy used for work"
    case "asset_energy": return payload.carrier === "refrigerant" ? "Refrigerant released (leaked or recharged)" : payload.carrier === "natural_gas" ? "Natural gas used" : "Electricity used"
    case "partner_reported": return "Partner’s reported scope 1 and 2 total"
    case "building_average": return "Floor area"
    case "sold_fuel": return "Fuel sold"
    case "sold_energy_product": case "sold_ghg_product": return "Units sold"
    case "end_of_life_split": return "Mass sold"
    case "investment": return "Amount outstanding or carrying value at the snapshot date (USD)"
  }
}
/** The source identifier's label on the Activity screen (the same stable ID on every record from the source). */
export const SCOPE3_FORM_SOURCE_LABELS: Readonly<Record<Scope3CompletionKind, string>> = {
  purchase_spend: "Ledger line or invoice ID", purchase_supplier: "Supplier statement or contract ID", energy_resold: "Resale account or meter ID", commuting_average: "Commuting survey ID",
  teleworking: "Teleworking estimate ID", asset_energy: "Asset, meter or site ID", partner_reported: "Partner statement ID", building_average: "Building or lease ID", sold_fuel: "Fuel product or sales ledger ID",
  sold_energy_product: "Product line or SKU", sold_ghg_product: "Product line or SKU", end_of_life_split: "Product or packaging line ID", investment: "Holding or instrument ID",
}
/** The unit a new record of the kind starts with. */
export const SCOPE3_FORM_INITIAL_UNITS: Readonly<Record<Scope3CompletionKind, string>> = {
  purchase_spend: "USD", purchase_supplier: "kg", energy_resold: "MWh", commuting_average: "employee", teleworking: "kWh", asset_energy: "kWh", partner_reported: "kg CO2e",
  building_average: "sqft", sold_fuel: "MMBtu", sold_energy_product: "unit", sold_ghg_product: "unit", end_of_life_split: "short_ton", investment: "USD",
}
/** A choice not made yet: saved drafts never carry it (the contract refuses the empty token), so the form names what is missing. */
export const scope3Unanswered = <T,>(): T => "" as unknown as T
/** "Not stated yet": the contract refuses these, so the form names what is missing before anything is saved. */
export const SCOPE3_NOT_STATED = { category: 0, year: 0, days: 0 } as const

/** The empty payload of each kind: exactly the contract's keys (see the module comment for the defaults kept). */
export function scope3BlankPayload<K extends Scope3CompletionKind>(kind: K): Scope3PayloadByKind[K] {
  const grid = { zip: "", subregion: "", utilityEiaId: null }
  const blank: { [Kind in Scope3CompletionKind]: unknown } = {
    purchase_spend: { category: 1, naicsCode: null, dollarYear: null, marginChoice: "with_margins", boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: "unknown", supplierName: "", glAccount: "", description: "",
      categoryConfirmed: false, activityOverlap: "unknown", importId: null, importRow: null, mappingSource: "user", paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false },
    purchase_supplier: { category: 1, supplierName: "", product: "", basis: "product_factor", factorValue: "", factorUnit: "kg CO2e per kg", allocationBasis: "supplier_allocated", allocationNumerator: null, allocationDenominator: null,
      boundary: "", gwpBasis: "unknown", verification: "unverified", dataYear: SCOPE3_NOT_STATED.year, factorOrigin: "", hybridUpstreamCoveredBy: null, supersedesSpend: null },
    energy_resold: { gridBasis: "subregion", ...grid, resoldEnergyNotInScope2: false },
    commuting_average: { workingDays: SCOPE3_NOT_STATED.days, modes: [scope3BlankCommutingMode()], sharesBasis: "", distanceBasis: "", activityOverlap: "unknown" },
    teleworking: { carrier: "electricity", ...grid, baselineBasis: "" },
    asset_energy: { category: SCOPE3_NOT_STATED.category, carrier: "electricity", assetLabel: "", counterpartyName: "", leaseType: null, noOperationalControlBasis: null, ...grid, refrigerantGas: null, allocation: null },
    partner_reported: { category: SCOPE3_NOT_STATED.category, counterpartyName: "", scope2Basis: "unknown", allocationBasis: "", allocationNumerator: null, allocationDenominator: null, leaseType: null, noOperationalControlBasis: null,
      gwpBasis: "unknown", verification: "unverified", periodMatches: false, supersedesSpend: null },
    building_average: { category: SCOPE3_NOT_STATED.category, cbecsActivity: "", usesNaturalGas: "unknown", gridBasis: "subregion", ...grid, coveredDays: SCOPE3_NOT_STATED.days, leaseType: null, noOperationalControlBasis: null },
    sold_fuel: { fuel: "", combustedInUse: "yes" },
    sold_energy_product: { productLabel: "", lifetimeBasis: "years", lifetimeQuantity: "", energyPerBasis: "", energyCarrier: "electricity", energyUnit: "kWh", useRegion: "", lifetimeSource: "" },
    sold_ghg_product: { productLabel: "", gas: "", chargePerUnit: "", chargeUnit: "kg", useReleasePercent: "", releaseBasis: "" },
    end_of_life_split: { material: "", basis: "sold_products", split: null, splitBasis: null, productLabel: "" },
    investment: { investeeName: "", holdingType: "", path: "investee_reported", attribution: { basis: "equity_share_percent", percent: "" }, investeeEmissions: null, emissionsVerified: null, revenue: null, revenueYear: null,
      naicsCode: null, initialSponsor: false, projectedAnnual: null, lifetimeYears: null, snapshotDate: "", gwpBasis: "unknown" },
  }
  return structuredClone(blank[kind]) as Scope3PayloadByKind[K]
}
export const scope3BlankCommutingMode = () => ({ mode: "", sharePercent: "", oneWayDistance: "", distanceUnit: "mile" as const, occupancy: null })
/** A treatment split with every share blank (the end-of-life form's "known split" starting point). */
export const scope3BlankSplit = () => ({ recycled: "", landfilled: "", combusted: "", composted: "", anaerobic_digestion_dry: "", anaerobic_digestion_wet: "" })

/**
 * The Activity screen's kind groups, by GHG Protocol category (DESIGN 7.2: kind buttons grouped by category). Every
 * Scope 3 kind is in exactly one group (a test checks it); a kind spanning several categories sits with its main use.
 */
export const SCOPE3_FORM_GROUPS: ReadonlyArray<{ title: string; kinds: readonly Scope3CollectionKind[] }> = [
  { title: "Purchases (categories 1 and 2)", kinds: ["purchase_spend", "purchase_supplier"] },
  { title: "Fuel and energy (category 3)", kinds: ["energy_resold"] },
  { title: "Transport and distribution (categories 4 and 9)", kinds: ["transport"] },
  { title: "Waste and end of life (categories 5 and 12)", kinds: ["waste", "end_of_life_split"] },
  { title: "Business travel (category 6)", kinds: ["business_travel"] },
  { title: "Employee commuting (category 7)", kinds: ["employee_commuting", "commuting_average", "teleworking"] },
  { title: "Leased assets, processing and franchises (categories 8, 10, 13 and 14)", kinds: ["asset_energy", "partner_reported", "building_average"] },
  { title: "Use of sold products (category 11)", kinds: ["sold_fuel", "sold_energy_product", "sold_ghg_product"] },
  { title: "Investments (category 15)", kinds: ["investment"] },
]
/**
 * The Scope 3 kinds the Activity screen offers, grouped: a kind has a form here (all of them since I-08) and the server lists
 * it as stored by its database (`capabilities.scope3.kinds`: the four 0029 kinds at schema 29, every kind at schema 30).
 */
export function scope3FormGroups(available: readonly string[]): Array<{ title: string; kinds: Scope3CollectionKind[] }> {
  return SCOPE3_FORM_GROUPS.map(group => ({ title: group.title, kinds: group.kinds.filter(kind => available.includes(kind)) })).filter(group => group.kinds.length > 0)
}
/** Every Scope 3 kind has a form on the Activity screen (I-08). */
export const SCOPE3_FORM_KINDS: ReadonlySet<string> = new Set<string>([...SCOPE3_LEGACY_KINDS, ...SCOPE3_COMPLETION_KINDS])

// --- The method a record will use, its type and its default data quality (DESIGN 4.4, A19, A20) ---

/**
 * The method version a record of this kind and payload is calculated with (DESIGN 3.1, the engine's KIND_METHOD), and the
 * method type DESIGN 4.4 gives it. Null when the payload doesn't decide it yet (a supplier figure with no factor origin).
 * Only the type decides whether the company may set the activity-data origin (A19); a test checks each type against the
 * method catalog once the catalog has the method.
 */
export function scope3FormMethod(kind: Scope3CollectionKind, payload: Record<string, unknown>): { id: string; type: Scope3MethodType } | null {
  const act = (id: string) => ({ id, type: "activity_average_data" as const })
  switch (kind) {
    case "transport": return act("scope3.cat4_9.transport_distance.v1")
    case "waste": return act("scope3.cat5_12.waste.v1")
    case "business_travel": return act(typeof payload.mode === "string" && scope3IsHotelMode(payload.mode) ? "scope3.cat6.hotel_stay.epa2018_events.v1" : "scope3.cat6.business_travel_distance.v1")
    case "employee_commuting": return act("scope3.cat7.employee_commuting_distance.v1")
    case "purchase_spend": return { id: "scope3.spend.epa_scghg_v1_3.v1", type: "spend_based" }
    case "purchase_supplier": return payload.factorOrigin === "supplier_primary" ? { id: "scope3.cat1_2.supplier_specific.v1", type: "supplier_specific" }
      : payload.factorOrigin === "secondary_database" ? act("scope3.cat1_2.average_data_user_factor.v1") : null
    case "energy_resold": return act("scope3.cat3d.energy_resold.egrid2023.v1")
    case "commuting_average": return act("scope3.cat7.commuting_average.v1")
    case "teleworking": return act("scope3.cat7.teleworking.v1")
    case "asset_energy": return act("scope3.asset_energy.v1")
    case "partner_reported": return { id: "scope3.partner_reported.v1", type: "partner_reported" }
    case "building_average": return act("scope3.cat8_13_14.building_average.cbecs2018.v1")
    case "sold_fuel": return act("scope3.cat11.sold_fuel.hub2025.v1")
    case "sold_energy_product": return act("scope3.cat11.sold_energy_product.v1")
    case "sold_ghg_product": return act("scope3.cat11.sold_ghg_product.hub2025.v1")
    case "end_of_life_split": return act("scope3.cat12.end_of_life_split.v1")
    case "investment": return payload.path === "revenue_eeio" ? { id: "scope3.cat15.investment_revenue_eeio.epa_scghg_v1_3.v1", type: "proxy" } : { id: "scope3.cat15.investment_reported.v1", type: "partner_reported" }
  }
}
/** A19: the origin a method type fixes (the engine ignores a record's own origin for these types). */
const FIXED_ORIGIN: Readonly<Partial<Record<Scope3MethodType, Scope3ActivityDataOrigin>>> = {
  supplier_specific: "value_chain_partner", partner_reported: "value_chain_partner", spend_based: "company_records", proxy: "estimate",
}
export interface Scope3FormDataQualityDefaults {
  /** The method's title from the catalog, or null when the catalog doesn't have the method in this build yet. */
  title: string | null
  methodId: string | null
  /** The method's default rating of each indicator (A20: the unverified default for unverified supplier, partner or investee data), or null when unknown here. */
  indicators: Readonly<Record<Scope3DqIndicator, Scope3DqRating>> | null
  /** Whether the record may set its own activity-data origin (only activity/average-data methods, A19). */
  originSettable: boolean
  /** The origin the method uses when the record sets none (fixed by the method type, or the method's default), or null when unknown. */
  origin: Scope3ActivityDataOrigin | null
}
/** The method defaults the data-quality editor shows (display only; Results apply the same rules to calculated lines). */
export function scope3FormDataQualityDefaults(kind: Scope3CollectionKind, payload: Record<string, unknown>): Scope3FormDataQualityDefaults {
  const method = scope3FormMethod(kind, payload)
  const entry = method ? SCOPE3_METHODS[method.id] : undefined
  const unverified = payload.verification === "unverified" || (kind === "investment" && payload.path !== "revenue_eeio" && payload.emissionsVerified !== true)
  const indicators = entry ? (unverified && entry.defaultDataQualityUnverified ? entry.defaultDataQualityUnverified : entry.defaultDataQuality) : null
  const fixed = method ? FIXED_ORIGIN[method.type] ?? null : null
  return { title: entry?.title ?? null, methodId: method?.id ?? null, indicators, originSettable: method?.type === "activity_average_data", origin: fixed ?? entry?.activityDataOrigin ?? null }
}

// --- What a form receives ---

/** One saved spend line a supplier or partner record can name as replaced (A22): its mapping key is SHA-256 of `scope3SpendMappingKeyInput`. */
export interface Scope3SpendLineChoice { recordId: string; category: number; supplierName: string; description: string; glAccount: string; amount: string; currency: string; mappingKeyInput: string; mappingKey: string }
/** The facts outside the record that a form uses. */
export interface Scope3FormEnvironment {
  /** Company setup's consolidation approach (lease hints, DESIGN A15); undefined when setup could not be read. */
  consolidationApproach?: string | null
  /** The last ZIP lookup (shared with the electricity form), and a way to run one for this record. */
  zipLookup: CollectionZipLookup | null
  onZipLookup: (zip: string) => void
  /** The company's saved spend lines with their mapping keys (supplier and partner records may replace them). */
  spendLines: readonly Scope3SpendLineChoice[]
  /** The company's setup locations, for context in hints. */
  context: CollectionContext | null
  /** Round 2 UX-12: company setup's reporting period (a dated spend line counts in it); undefined when unknown. */
  reportingPeriod?: { start: string; endExclusive: string } | null
}
/** The props every record form takes: the draft, the screen's edit function, whether it is read-only, and the environment. */
export interface Scope3FormProps {
  activity: CollectionActivity
  onEdit: (change: (next: CollectionActivity) => void) => void
  disabled: boolean
  env: Scope3FormEnvironment
}
/** The payload of a draft as a plain record (each form narrows it to its kind). */
export const scope3Payload = (activity: Pick<CollectionActivity, "payload">) => activity.payload as unknown as Record<string, unknown>
/** The kind's payload, typed, for an edit callback. */
export const scope3PayloadOf = <K extends Scope3CompletionKind>(activity: CollectionActivity, kind: K): Scope3PayloadByKind[K] => {
  if (activity.kind !== kind) throw new Error(`Expected a ${kind} record.`)
  return activity.payload as unknown as Scope3PayloadByKind[K]
}
/** A new record of a Scope 3 completion kind starts with this quantity (no amount, the kind's first unit, nothing normalized). */
export const scope3InitialQuantity = (kind: Scope3CompletionKind) => ({ originalValue: "", originalUnit: SCOPE3_FORM_INITIAL_UNITS[kind], normalizedValue: null, normalizedUnit: null })
/** An empty "replaces spend lines" answer. */
export const scope3BlankSupersedes = (): Scope3SupersedesSpend => ({ supplierName: "", mappingKeys: [] })
