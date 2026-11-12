// Scope 3 completion I-03 part 2 (DESIGN §5.1, §5.2, A19-A23, A29; Claude, 30 October 2026): spend lines and supplier
// figures through the draft Scope 3 results route, the real Scope 3 engine and the trusted boundary. Expected figures are
// independent arithmetic on the published EPA Supply Chain GHG Emission Factors v1.3 cells (CSV rows cited) and the BEA
// GDP deflator values of research/methods-purchases.md §3, never the engine's own output; the same displays were also
// computed with Python Fractions straight from the CSV ($S/s3/tmp-a03b/calc/expected.py).
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView } from "@neuvetra/database"
import { createScope3Engine } from "../calculation/scope3-authority"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { scope3SpendMappingKeyInput } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { buildScope3Results, REVIEWED_SCOPE3_ENGINE_SHA256, scope3AnnotationOf, type Scope3ResultsEngine } from "./scope3-results-routes"
import { reasonText, reasonTextKnown } from "../../../../packages/neuvetra-database/src/plain-language-labels"
import { decodeScope3Results } from "../../../site-web/src/lib/scope3-results-decode"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const engine: Scope3ResultsEngine = createScope3Engine({ python, expectedEngineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })
const company = "93700000-0000-4000-8000-000000000001", setup = "93700000-0000-4000-8000-000000000002"
const office = "93700000-0000-4000-8000-000000000003", warehouse = "93700000-0000-4000-8000-000000000004"
const owner = "93700000-0000-4000-8000-0000000000a1"
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [
  { id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" },
  { id: warehouse, name: "Warehouse", inclusion: "excluded", control: "landlord", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "", evidenceIds: [] as string[], period: year }
const plainAmount = (value: string) => /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value)
const q = (value: string, unit: string, normalized = plainAmount(value)) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalized ? value : null, normalizedUnit: normalized ? unit : null })
let n = 0
function record(activity: Record<string, unknown>): CollectionActivityRecord {
  const id = `93700000-0000-4000-8000-${String(1000 + ++n).padStart(12, "0")}`
  const parsed = validateCollectionActivity({ ...common, sourceId: `P-${n}`, ...activity })
  const version = { id: `94700000-0000-4000-8000-${String(1000 + n).padStart(12, "0")}`, recordId: id, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" }
  return { id, companyId: company, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined } as never] }
}
type Screen = "unknown" | "yes" | "no" | "not_applicable"
function setupView(screen: Partial<Record<number, Screen>>, period = year): CompanySetupView {
  const screening = Object.entries(screen).map(([category, state]) => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[Number(category) - 1]!, state, reason: state === "no" || state === "not_applicable" ? "Synthetic screening reason." : "", details: "", locationId: null }))
  return { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: setup, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
    setup: { company: { legalName: "Synthetic Purchases Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { start: period.start, endExclusive: period.endExclusive, firstInventory: "yes", priorInventoryReference: "" },
      boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }, { id: warehouse, name: "Warehouse", inclusion: "excluded", control: "landlord", entityId: null, startMode: "period_start", endMode: "period_end" }], screening, changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } } as unknown as CompanySetupView
}
const evidence: CollectionEvidenceMetadata[] = []
const screened: Partial<Record<number, Screen>> = { 1: "yes", 2: "yes", 3: "no", 4: "yes", 5: "yes", 6: "yes", 9: "yes" }
const build = (records: CollectionActivityRecord[], screen = screened, period = year, use: Scope3ResultsEngine = engine) =>
  buildScope3Results({ companyId: company, context: { ...context, reportingPeriod: period }, records, evidence, setup: setupView(screen, period), engine: use, now: () => new Date("2026-10-30T00:00:00Z") })
const TIMEOUT = 120_000

// The shared fixture shapes (scope3-payload-fixtures.ts).
const SPEND = { category: 1, naicsCode: "541511", dollarYear: 2024, marginChoice: "with_margins", boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: "excludes_sales_tax",
  supplierName: "Synthetic Software LLC", glAccount: "6100", description: "Software consulting", categoryConfirmed: false, activityOverlap: "unknown", importId: null, importRow: null,
  mappingSource: "user", paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false }
const spend = (amount: string, edits: Record<string, unknown> = {}, extra: Record<string, unknown> = {}, unit = "USD") =>
  record({ kind: "purchase_spend", quantity: q(amount, unit, unit === "USD" && plainAmount(amount)), payload: { ...SPEND, ...edits }, ...extra })
const SUPPLIER = { category: 1, supplierName: "Synthetic Steel Co", product: "Hot-rolled coil", basis: "product_factor", factorValue: "1.850125", factorUnit: "kg CO2e per metric_ton",
  allocationBasis: "supplier_allocated", allocationNumerator: null, allocationDenominator: null, boundary: "cradle_to_gate", gwpBasis: "AR5", verification: "third_party_verified", dataYear: 2024,
  factorOrigin: "supplier_primary", hybridUpstreamCoveredBy: null, supersedesSpend: null }
const ALLOCATED = { ...SUPPLIER, basis: "allocated_total", factorValue: null, factorUnit: null, allocationBasis: "revenue", allocationNumerator: "2500000", allocationDenominator: "100000000" }
const supplier = (value: string, unit: string, edits: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  record({ kind: "purchase_supplier", quantity: q(value, unit, plainAmount(value) && unit !== "pallet"), payload: { ...SUPPLIER, ...edits }, ...extra })
const allocated = (value: string, unit: string, edits: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  record({ kind: "purchase_supplier", quantity: q(value, unit), payload: { ...ALLOCATED, ...edits }, ...extra })

test("currency provenance follows the current USD activity and refuses stale or malformed notes", async () => {
  const conversion = { currency: "EUR", amount: "100", rate: "1.0823", rateSource: "ECB euro reference rate", rateDate: "2025-06-30", usd: "108.23" }
  const note = "Currency conversion: EUR 100 × 1.0823 USD per EUR = USD 108.23 (rate source: ECB euro reference rate; rate date: 2025-06-30; rounded half-even to the cent)."
  const records = [spend("108.23", {}, { notes: note }), spend("200", {}, { notes: note }), spend("108.23", {}, { notes: note.replace("2025-06-30", "2025-02-30") }), spend("108.23", {}, { notes: note.replace("× 1.0823", "× 9") })]
  const response = await build(records)
  expect((response.records[0] as unknown as { currencyConversion: unknown }).currencyConversion).toEqual(conversion)
  for (const row of response.records.slice(1)) expect(Object.hasOwn(row, "currencyConversion")).toBe(false)
}, TIMEOUT)

// Independent arithmetic: exact rationals in BigInt, rounded half-even once (the price ratio to 12 dp, the display to 4 dp).
type Q = { n: bigint; d: bigint }
const dec = (text: string): Q => { const [i, f = ""] = text.split("."); return { n: BigInt(i! + f), d: 10n ** BigInt(f.length) } }
const mul = (a: Q, b: Q): Q => ({ n: a.n * b.n, d: a.d * b.d })
const add = (a: Q, b: Q): Q => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d })
const halfEven = (a: Q, places: number): bigint => {
  const scaled = a.n * 10n ** BigInt(places)
  let units = scaled / a.d
  const twice = 2n * (scaled % a.d)
  if (twice > a.d || (twice === a.d && units % 2n === 1n)) units += 1n
  return units
}
const fixed = (units: bigint, places: number) => { const digits = units.toString().padStart(places + 1, "0"); return `${digits.slice(0, -places)}.${digits.slice(-places)}` }
// BEA GDP implicit price deflator, FRED A191RD3A086NBEA (index 2017 = 100), as research/methods-purchases.md §3 reads it.
const DEFLATOR: Record<number, string> = { 2022: "118.026", 2024: "125.587", 2025: "128.893" }
const ratio = (dollarYear: number): Q | null => dollarYear === 2022 ? null : { n: halfEven({ n: dec(DEFLATOR[2022]!).n * dec(DEFLATOR[dollarYear]!).d, d: dec(DEFLATOR[2022]!).d * dec(DEFLATOR[dollarYear]!).n }, 12), d: 10n ** 12n }
const spendKg = (amount: string, factor: string, dollarYear: number): Q => { const kg = mul(dec(amount), dec(factor)); const r = ratio(dollarYear); return r ? mul(kg, r) : kg }
const display = (kg: Q) => fixed(halfEven(kg, 4), 4)

describe("I-03: spend lines through the results route and the real engine", () => {
  test("categories 1 and 2 (with and without margins, deflated and 2022 dollars), the category 4 fallback and manual category 9", async () => {
    // [record, EPA v1.3 CSV cell (row, column), dollar year used, expected display from the Python Fraction check]
    const lines: Array<[CollectionActivityRecord, string, number, string]> = [
      [spend("1000.00", { naicsCode: "111130", dollarYear: 2022 }), "0.848", 2022, "848.0000"],                                       // row 4, with margins (TV-S4: never 849)
      [spend("100000", { naicsCode: "541511", dollarYear: 2024 }), "0.084", 2024, "7894.2757"],                                       // row 798, with margins (TV-S5)
      [spend("50000", { naicsCode: "331110", dollarYear: null, supplierName: "Synthetic Mill" }), "0.787", 2025, "36032.3920"],        // row 299; no dollar year: reporting year 2025
      [spend("48000", { category: 2, naicsCode: "333120", marginChoice: "without_margins", boughtAtFactoryGate: true, capitalFullCost: true, dollarYear: 2022 }), "0.201", 2022, "9648.0000"], // row 354, without margins
      [spend("12500.5", { category: 2, naicsCode: "325211", capitalFullCost: true, dollarYear: 2024 }), "1.045", 2024, "12276.5596"],  // row 243, with margins, deflated
      [spend("20000", { category: 4, naicsCode: "484121", activityOverlap: "none_confirmed", dollarYear: 2025 }), "0.595", 2025, "10896.7081"],  // row 639
      [spend("3200", { category: 9, naicsCode: "484121", activityOverlap: "none_confirmed", dollarYear: 2022, paidByReportingCompany: false, spendEstimateBasis: "Customer-paid freight from 2025 rate cards." }), "0.595", 2022, "1904.0000"],
    ]
    const result = await build(lines.map(([r]) => r))
    const exact: Record<number, Q[]> = {}
    for (const [r, factor, dollarYear, python] of lines) {
      const row = result.records.find(item => item.recordId === r.id)!
      const kg = spendKg(r.currentVersion.activity.quantity.originalValue, factor, dollarYear)
      expect(display(kg)).toBe(python)
      expect([row.outcome, row.result?.status, row.result?.total?.display, row.result?.methodVersionId, row.result?.gwpSetId]).toEqual(["calculated", "complete", python, "scope3.spend.epa_scghg_v1_3.v1", "AR5-100"])
      expect(row.result!.input).toMatchObject({ dollarYear, currency: "USD" })
      // The price ratio is listed (12 dp, half-even once) exactly when the dollars are not 2022's.
      const r12 = ratio(dollarYear)
      expect(row.result!.activity.priceRatio ?? null).toBe(r12 ? fixed(r12.n, 12).replace(/0+$/, "") : null)
      ;(exact[row.category] ??= []).push(kg)
    }
    // Round 3, lane A (AC-14): + the recorded tax treatment of the spend line (a line note and category disclosure).
    expect(result.records.find(item => item.recordId === lines[2]![0].id)!.plan.notes).toEqual(["dollar_year_from_reporting_year", "spend_tax_treatment_excludes_sales_tax"])
    const cat = (c: number) => result.coverage.categories[c - 1]!
    for (const c of [1, 2, 4, 9]) {
      expect([c, cat(c).status, cat(c).support, cat(c).subtotalBasis]).toEqual([c, "calculated", "engine", "all_counted_records"])
      expect([c, cat(c).subtotal!.display]).toEqual([c, display(exact[c]!.reduce(add))])
    }
    expect(cat(1).counts).toMatchObject({ records: 3, calculated: 3 })
    expect(result.coverage.knownSourceSubtotal!.display).toBe(display(Object.values(exact).flat().reduce(add)))
    const codes = (c: number) => cat(c).disclosures
    expect(codes(1)).toEqual(expect.arrayContaining(["cradle_to_shelf_including_margins", "economy_wide_price_index", "factor_ghg_year_2022", "us_national_sector_average"]))
    // I-06: the shipped `factor_data_years` text names only Hub 2025 and eGRID, so a spend-only category no longer carries it
    // (its EPA v1.3 and FRED sources are in the category's methodology statement).
    expect(codes(1)).not.toContain("factor_data_years")
    expect(cat(1).methodology.filter(sentence => sentence.topic === "factor_source").map(sentence => sentence.text)).toEqual([
      "Factor source: EPA Supply Chain GHG Emission Factors v1.3.0 (2017 NAICS-6, kg CO2e per 2022 USD purchaser price, U.S. GHG data for 2022, AR5; doi 10.23719/1531143).",
      "Factor source: BEA GDP implicit price deflator (FRED A191RD3A086NBEA), annual, transcribed 30 October 2026 (FRED last updated 30 September 2026); an economy-wide index."])
    expect(codes(2)).toEqual(expect.arrayContaining(["capital_goods_full_cost_in_acquisition_year", "cradle_to_gate_factory_price", "cradle_to_shelf_including_margins"]))
    expect(codes(4)).toEqual(expect.arrayContaining(["spend_based_fallback"]))
    expect(codes(9)).toEqual(expect.arrayContaining(["spend_based_fallback", "downstream_spend_estimated_by_company"]))
    // I-06: each method also carries its catalog title and type and the engine's own formula.
    expect(result.methods).toEqual([{ methodVersionId: "scope3.spend.epa_scghg_v1_3.v1", scope: 3, engineSha256: REVIEWED_SCOPE3_ENGINE_SHA256, registerSha256: expect.any(String), releaseStatus: "unreleased_beta", releaseId: null, releaseLabel: null,
      title: "Categories 1 and 2, and the spend-based fallback for 3, 4, 5, 6 and 9: EPA Supply Chain GHG Emission Factors v1.3 (2022 USD)", methodType: "spend_based", formula: expect.stringContaining("kg CO2e = amount (USD) x factor") }])
    // CARB's proposed five: category 1 is calculated, so only 3 (screened out), 5, 6 and 7 can be gaps.
    expect(result.coverage.proposedMandatory.gaps.map(gap => gap.category)).toEqual([3, 5, 6, 7])
  }, TIMEOUT)
})

describe("I-03: supplier figures, the hybrid boundary and secondary factors", () => {
  test("supplier-specific (verified and not), hybrid met and partial, a secondary factor; A19 and A20 verified by the boundary", async () => {
    const unverified = supplier("200000", "kg", { factorValue: "0.15", factorUnit: "kg CO2e per kg", verification: "unverified" })   // 200,000 x 0.15 = 30,000
    const share = allocated("145000", "kg CO2e")                                                                                       // 145,000 x 2,500,000 / 100,000,000 = 3,625
    const hybrid = allocated("4000", "kg CO2e", { boundary: "supplier_scope1_2_only", hybridUpstreamCoveredBy: "other_records", allocationNumerator: "1", allocationDenominator: "4" })  // 1,000, met
    const secondary = supplier("120", "metric_ton", { factorOrigin: "secondary_database", verification: "unverified" })              // 120 x 1.850125 = 222.015
    const missing = allocated("12.5", "metric_ton CO2e", { category: 2, boundary: "supplier_scope1_2_only", hybridUpstreamCoveredBy: "none", allocationBasis: "supplier_allocated", allocationNumerator: null, allocationDenominator: null }) // 12,500, partial
    // A spend line whose data quality claims value-chain data: A19 ignores it (spend is always company records).
    const line = spend("1000", { naicsCode: "111130", dollarYear: 2022, dataQuality: { indicators: { technological: null, temporal: null, geographical: null, completeness: null, reliability: null }, activityDataOrigin: "value_chain_partner", basis: "Claimed" } })
    const result = await build([unverified, share, hybrid, secondary, missing, line])
    const row = (r: CollectionActivityRecord) => result.records.find(item => item.recordId === r.id)!
    const expected: Array<[CollectionActivityRecord, string, string, string, string[]]> = [
      [unverified, "scope3.cat1_2.supplier_specific.v1", "30000.0000", "met", ["supplier_data_unverified", "supplier_gwp_basis_ar5"]],
      [share, "scope3.cat1_2.supplier_specific.v1", "3625.0000", "met", ["supplier_gwp_basis_ar5"]],
      [hybrid, "scope3.cat1_2.supplier_specific.v1", "1000.0000", "met", ["hybrid_upstream_from_other_records", "supplier_gwp_basis_ar5"]],
      [secondary, "scope3.cat1_2.average_data_user_factor.v1", "222.0150", "met", ["factor_gwp_basis_ar5", "user_supplied_secondary_factor_not_verified"]],
      [missing, "scope3.cat1_2.supplier_specific.v1", "12500.0000", "partial", ["hybrid_upstream_missing", "supplier_gwp_basis_ar5"]],
    ]
    for (const [r, method, total, boundary, notes] of expected) {
      expect([row(r).outcome, row(r).result!.methodVersionId, row(r).result!.gwpSetId, row(r).result!.total!.display, row(r).result!.boundary] as unknown[]).toEqual(["calculated", method, "AS-REPORTED", total, { minimumBoundary: boundary, notes }])
    }
    const cat = (c: number) => result.coverage.categories[c - 1]!
    expect(cat(1)).toMatchObject({ status: "calculated", counts: { records: 5, calculated: 5 }, subtotal: { display: "35695.0150" } })   // 30,000 + 3,625 + 1,000 + 222.015 + 848
    expect(cat(2)).toMatchObject({ status: "partial_boundary", counts: { records: 1, partialBoundary: 1 }, subtotal: { display: "12500.0000" } })
    expect(cat(2).disclosures).toContain("hybrid_upstream_missing")
    expect(cat(1).disclosures).toEqual(expect.arrayContaining(["supplier_data_unverified", "user_supplied_secondary_factor_not_verified", "hybrid_upstream_from_other_records", "supplier_gwp_basis_ar5", "factor_gwp_basis_ar5"]))
    // AS-REPORTED supplier CO2e beside AR5 spend: the total combines GWP bases (A8). I-06: the new code says so; the shipped
    // `mixed_gwp_sets` text names only AR5 and AR4, so it is not used for this mix.
    expect(result.coverage.disclosures.find(item => item.code === "mixed_gwp_sets_including_reported")!.categories).toEqual([1, 2])
    expect(result.coverage.disclosures.map(item => item.code)).not.toContain("mixed_gwp_sets")
    // The route sent each line's annotation; the boundary checked the engine's profile with the same A19/A20 rules (or the
    // whole response would have been refused). The engine's own aggregate shows the rules' effect:
    const sources = new Map([unverified, share, hybrid, secondary, missing, line].map(r => [r.id, r]))
    const calculated = result.records.filter(item => item.result)
    const annotations = calculated.map(item => scope3AnnotationOf(sources.get(item.recordId)!.currentVersion.activity.payload))
    expect(annotations.filter(a => a.activityDataOrigin !== null)).toEqual([{ dataQuality: { technological: null, temporal: null, geographical: null, completeness: null, reliability: null }, activityDataOrigin: "value_chain_partner" }])
    const profile = (await engine.aggregate(calculated.map(item => item.result!), annotations)).categoryProfiles["1"]!
    expect([profile.valueChain.numerator.display, profile.valueChain.denominator.display]).toEqual(["34625.0000", "35695.0150"])  // supplier-specific only: never the spend line nor the company's secondary factor
    expect([profile.dataQuality.indicators.reliability.ratingKg.fair!.display, profile.dataQuality.indicators.reliability.ratingKg.very_good!.display]).toEqual(["31070.0150", "4625.0000"])  // A20: unverified 30,000 is fair
  }, TIMEOUT)
})

describe("I-03: supersession (A22) in the route", () => {
  test("spend lines a supplier record replaces are excluded with their reason and never counted; withdrawing the supplier record restores them", async () => {
    const keyed = { glAccount: "5200", supplierName: "Steel distributor", description: "Coil via distributor" }
    const key = createHash("sha256").update(scope3SpendMappingKeyInput(keyed), "utf8").digest("hex")
    const figure = (extra: Record<string, unknown> = {}) => supplier("120", "metric_ton", { supersedesSpend: { supplierName: "Synthetic Steel Co", mappingKeys: [key] } }, extra)
    const byName = spend("50000", { naicsCode: "331110", dollarYear: 2022, supplierName: "  synthetic  STEEL co" })                     // 39,350 if counted
    const capital = spend("48000", { category: 2, naicsCode: "333120", capitalFullCost: true, dollarYear: 2022, supplierName: "Synthetic Steel Co" })  // 10,944 if counted
    const byKey = spend("10000", { naicsCode: "331110", dollarYear: 2022, ...keyed })                                                   // 7,870 if counted
    const freight = spend("1000", { category: 4, naicsCode: "484121", activityOverlap: "none_confirmed", dollarYear: 2022, supplierName: "Synthetic Steel Co" })  // 595: category 4 is never superseded
    const other = spend("1000", { naicsCode: "111130", dollarYear: 2022, supplierName: "Another supplier" })                         // 848
    const active = figure()
    const result = await build([byName, capital, byKey, freight, other, active])
    const row = (r: CollectionActivityRecord) => result.records.find(item => item.recordId === r.id)!
    for (const r of [byName, capital, byKey]) {
      expect([row(r).outcome, row(r).plan.status, row(r).plan.reasons, row(r).plan.notes, row(r).result]).toEqual(["held", "excluded", ["superseded_by_supplier_record"], ["spend_tax_treatment_excludes_sales_tax", `superseded_by:${active.id}`], null])
    }
    for (const r of [freight, other, active]) expect(row(r).outcome).toBe("calculated")
    const cat = (c: number) => result.coverage.categories[c - 1]!
    // Category 1: the supplier figure (222.015) and the other supplier's line (848); the superseded lines are counted as excluded.
    expect(cat(1)).toMatchObject({ status: "calculated", counts: { records: 4, calculated: 2, excluded: 2 }, subtotal: { display: "1070.0150" } })
    expect(cat(2)).toMatchObject({ status: "no_records", counts: { records: 1, excluded: 1 }, subtotal: null })
    expect(cat(4)).toMatchObject({ status: "calculated", subtotal: { display: "595.0000" } })
    // Withdrawn, the supplier record replaces nothing: every line counts again (39,350 + 7,870 + 848 = 48,068; category 2: 10,944).
    const withdrawn = { ...active, currentVersion: { ...active.currentVersion, activity: { ...active.currentVersion.activity, state: "withdrawn", withdrawalReason: "Wrong supplier." } } } as CollectionActivityRecord
    const again = await build([byName, capital, byKey, freight, other, withdrawn])
    expect(again.records.filter(item => item.plan.reasons.includes("superseded_by_supplier_record"))).toEqual([])
    expect([again.coverage.categories[0]!.subtotal!.display, again.coverage.categories[1]!.subtotal!.display]).toEqual(["48068.0000", "10944.0000"])
    // Outside the reporting period, it replaces nothing either (and is itself held outside the period).
    const outside = figure({ period: { start: "2025-01-01", endExclusive: "2025-07-01" } })
    const half = await build([byName, outside], screened, { start: "2025-07-01", endExclusive: "2026-07-01" })
    expect(half.records.map(item => [item.kind, item.outcome])).toEqual([["purchase_spend", "outside_period"], ["purchase_supplier", "outside_period"]])
    expect(half.records[0]!.plan.reasons).not.toContain("superseded_by_supplier_record")
  }, TIMEOUT)
})

describe("I-03: every adapter hold through the route", () => {
  test("each spend and supplier hold gives its own reason, no figure, and counts as needing input in its own category", async () => {
    const DOWNSTREAM = { category: 9, naicsCode: "484121", activityOverlap: "none_confirmed", paidByReportingCompany: false, spendEstimateBasis: "Customer-paid freight from rate cards." }
    const cases: Array<[CollectionActivityRecord, number, string[]]> = [
      [spend("5000", {}, {}, "EUR"), 1, ["currency_not_supported"]],
      [spend("n/a"), 1, ["amount_not_a_number"]],
      [spend("-250.00"), 1, ["negative_amount_not_supported"]],
      [spend("1,200"), 1, ["quantity_not_calculable"]],
      [spend("99.99", { naicsCode: null, mappingSource: "unmatched" }), 1, ["naics_code_required"]],
      [spend("2400", { category: 4, naicsCode: "481111", activityOverlap: "none_confirmed" }), 4, ["naics_not_valid_for_category"]],
      [spend("2400", { category: 5, naicsCode: "541511", activityOverlap: "none_confirmed" }), 5, ["naics_not_valid_for_category"]],
      [spend("2400", { category: 6, naicsCode: "484121", activityOverlap: "none_confirmed" }), 6, ["naics_not_valid_for_category"]],
      [spend("1000", { naicsCode: "324110" }), 1, ["energy_spend_belongs_in_scope_1_2_or_cat3"]],
      [spend("1000", { naicsCode: "481111" }), 1, ["spend_overlaps_other_category"]],
      [spend("1000", { category: 2, naicsCode: "423430", capitalFullCost: true }), 2, ["trade_sector_naics_maps_margin_only"]],
      [spend("8000", { category: 3, naicsCode: "324110", activityOverlap: "none_confirmed" }), 3, ["spend_proxy_for_category_3_not_enabled"]],
      [spend("2400", { category: 6, naicsCode: "721110" }), 6, ["spend_overlap_not_confirmed"]],
      [spend("3200", { ...DOWNSTREAM, paidByReportingCompany: true }), 9, ["category_9_spend_paid_by_company"]],
      [spend("48000", { category: 2, naicsCode: "333120", capitalFullCost: null }), 2, ["capital_goods_must_be_full_cost"]],
      [spend("48000", { naicsCode: "331110", marginChoice: "without_margins", boughtAtFactoryGate: false }), 1, ["without_margins_requires_factory_gate"]],
      [spend("100", { lineDate: "2026-01-15" }), 1, ["spend_line_date_outside_reporting_period"]],
      [spend("100", { importId: "30a00000-0000-4000-8000-000000000002", importRow: 3, mappingSource: "file", possibleDuplicateOf: { importId: "30a00000-0000-4000-8000-000000000001", row: 1 } }), 1, ["possible_duplicate_spend_line"]],
      [supplier("120", "kg"), 1, ["factor_unit_mismatch"]],
      [supplier("120", "metric_ton", { allocationBasis: "revenue", allocationNumerator: "1", allocationDenominator: "2" }), 1, ["allocation_not_applicable_to_product_factor"]],
      [supplier("40", "pallet", { factorUnit: "kg CO2e per pallet" }), 1, ["quantity_not_calculable", "unit_not_an_engine_token"]],
      [allocated("145000", "kg"), 1, ["unit_not_an_engine_token"]],
    ]
    const result = await build(cases.map(([r]) => r))
    for (const [r, category, reasons] of cases) {
      const row = result.records.find(item => item.recordId === r.id)!
      expect([r.currentVersion.activity.sourceId, row.category, row.outcome, row.plan.status, row.plan.reasons, row.result] as unknown[]).toEqual([r.currentVersion.activity.sourceId, category, "held", "input_needed", reasons, null])
    }
    // Nothing reached the engine, so nothing has a figure; every category with a held line needs input and lists its reasons.
    expect(result.coverage.knownSourceSubtotal).toBeNull()
    for (const c of [1, 2, 4, 5, 6, 9]) {
      const row = result.coverage.categories[c - 1]!
      expect([c, row.status, row.subtotal]).toEqual([c, "input_needed", null])
      expect(row.counts.inputNeeded).toBe(cases.filter(([, category]) => category === c).length)
      for (const [, category, reasons] of cases) if (category === c) expect(row.reasons).toEqual(expect.arrayContaining(reasons))
    }
    // Category 3 is screened out with a held line: review required.
    expect(result.coverage.categories[2]!.status).toBe("screening_conflict") // round 2 (owner decision 5)
  }, TIMEOUT)
})

// BF-02 (S3C-01, the auditor's repro /tmp/hunt-s3/tests/api-zz-hunt-s3b-supersession.test.ts): a spend line is excluded
// as superseded only while the supplier or partner record replacing it is calculated in full. Otherwise the line is held
// with `replacing_record_not_counted`, so the purchase is never silently missing from every total.
describe("BF-02: a spend line whose replacing record isn't counted is held, never silently dropped", () => {
  const acme = () => spend("100000", { supplierName: "Acme Metals", naicsCode: "331110" })  // 73,961.8448 kg if counted
  const replaces = { supersedesSpend: { supplierName: "Acme Metals", mappingKeys: [] } }
  // A carrier's own figure (category 4): partner figures replace category 1 and 2 spend lines that name them (I-05, B5a).
  const PARTNER = { category: 4, counterpartyName: "Acme Metals", scope2Basis: "location", allocationBasis: "exclusive", allocationNumerator: null, allocationDenominator: null, leaseType: null,
    noOperationalControlBasis: null, gwpBasis: "AR5", verification: "unverified", periodMatches: true, supersedesSpend: null }
  const expectHeld = (result: Awaited<ReturnType<typeof build>>, line: CollectionActivityRecord, by: CollectionActivityRecord) => {
    const row = result.records.find(item => item.recordId === line.id)!
    expect([row.outcome, row.plan.action, row.plan.status, row.plan.reasons, row.plan.notes, row.result, row.supersededSpendMemo])
      .toEqual(["held", "hold", "input_needed", ["replacing_record_not_counted"], ["spend_tax_treatment_excludes_sales_tax", `replacing_record:${by.id}`], null, undefined])
    const cat1 = result.coverage.categories[0]!
    expect(cat1.status).not.toBe("calculated")
    expect(cat1.counts.excluded).toBe(0)
    expect(cat1.counts.inputNeeded).toBeGreaterThanOrEqual(1)
    expect(cat1.reasons).toContain("replacing_record_not_counted")
    expect(result.readiness.ready).toBe(false)
    // The web's strict decoder accepts the held line (no memo on a line that isn't excluded), and the reason has reviewed words.
    expect(decodeScope3Results(JSON.parse(JSON.stringify(result)), company).records.find(item => item.recordId === line.id)!.plan.reasons).toEqual(["replacing_record_not_counted"])
    expect(reasonTextKnown("replacing_record_not_counted")).toBe(true)
    expect(reasonText("replacing_record_not_counted")).toStartWith("The supplier or partner record that replaces this spend line isn’t counted yet")
  }

  test("the auditor's repro: a supplier share over 100% (review_required) no longer makes the $100,000 line vanish; removing it gives 73,961.8448 kg", async () => {
    const line = acme()
    const figure = allocated("145000", "kg CO2e", { supplierName: "Acme Metals", allocationNumerator: "200", allocationDenominator: "100", ...replaces })
    const result = await build([line, figure])
    const fig = result.records.find(item => item.recordId === figure.id)!
    expect([fig.outcome, fig.result?.status, fig.result?.findings]).toEqual(["held", "review_required", ["allocation_share_exceeds_one"]])
    expectHeld(result, line, figure)
    expect(result.coverage.categories[0]!.subtotal).toBeNull()
    // Without the supplier record the line counts: 100,000 x 0.787 x round12(118.026 / 125.587) = 73,961.8448 kg.
    const alone = await build([line])
    expect(alone.coverage.categories[0]!).toMatchObject({ status: "calculated", subtotal: { display: "73961.8448" } })
  }, TIMEOUT)

  test("the same hold for every replacing record that isn't counted: factor-unit mismatch, zero denominator, partner period mismatch, boundary other", async () => {
    const cases: Array<[string, () => CollectionActivityRecord]> = [
      ["factor unit mismatch (adapter hold)", () => supplier("120", "metric_ton", { supplierName: "Acme Metals", factorUnit: "kg CO2e per kg", ...replaces })],
      ["zero denominator", () => allocated("145000", "kg CO2e", { supplierName: "Acme Metals", allocationNumerator: "1", allocationDenominator: "0", ...replaces })],
      ["partner period mismatch", () => record({ kind: "partner_reported", quantity: q("9000", "kg CO2e"), payload: { ...PARTNER, periodMatches: false, ...replaces } })],
      ["supplier boundary other", () => supplier("120", "metric_ton", { supplierName: "Acme Metals", boundary: "other", ...replaces })],
    ]
    for (const [name, make] of cases) {
      const line = acme(), by = make()
      const result = await build([line, by])
      const replacing = result.records.find(item => item.recordId === by.id)!
      expect([name, replacing.outcome === "calculated" && replacing.result?.status === "complete"]).toEqual([name, false])
      expectHeld(result, line, by)
    }
  }, TIMEOUT)

  test("a complete replacing figure still supersedes: the line stays excluded with its memo", async () => {
    const line = acme()
    const figure = supplier("120", "metric_ton", { supplierName: "Acme Metals", ...replaces })
    const result = await build([line, figure])
    const row = result.records.find(item => item.recordId === line.id)!
    expect([row.plan.status, row.plan.reasons, row.plan.notes]).toEqual(["excluded", ["superseded_by_supplier_record"], ["spend_tax_treatment_excludes_sales_tax", `superseded_by:${figure.id}`]])
    expect(row.supersededSpendMemo).toMatchObject({ supersededBy: figure.id, status: "calculated", wouldBe: { display: "73961.8448" }, replacing: { co2e: { display: "222.0150" }, spendLines: 1 } })
    expect(result.coverage.categories[0]!).toMatchObject({ status: "calculated", counts: { excluded: 1, calculated: 1 }, subtotal: { display: "222.0150" } })
  }, TIMEOUT)

  test("budget fallback: when the replacing figure becomes unavailable after the batch, its spend line is held too", async () => {
    let now = 0
    const slow: Scope3ResultsEngine = {
      calculateMany: async (requests, options) => { const items = await engine.calculateMany(requests, options); return items },
      aggregate: (results, notes) => { now = 30_000; return engine.aggregate(results, notes).then(value => { throw Object.assign(new Error("late"), { value }) }) },
      describe: () => engine.describe(),
    }
    const line = acme()
    const figure = supplier("120", "metric_ton", { supplierName: "Acme Metals", ...replaces })
    const result = await buildScope3Results({ companyId: company, context, records: [line, figure], evidence, setup: setupView(screened), engine: slow, now: () => new Date("2026-10-30T00:00:00Z"), deadline: 25_000, clock: () => now })
    expect(result.records.find(item => item.recordId === figure.id)!.outcome).toBe("unavailable")
    expectHeld(result, line, figure)
  }, TIMEOUT)
})
