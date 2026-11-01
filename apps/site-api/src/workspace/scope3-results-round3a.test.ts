// Round 3, lane A (ROUND3.md owner decision 4; Claude, 31 October 2026): a spend line a supplier or partner record replaces
// keeps its would-be spend-based (EEIO) figure as a memo outside every total, and the review flag `superseding_figure_review`
// marks a replacing figure under 10% or over 10 times the would-be figures of every spend line it replaces. Expected figures
// are independent arithmetic on the published EPA Supply Chain GHG Emission Factors v1.3 cells (2022 dollars, so no
// deflator): 331110 with margins 0.787 (CSV row 299), 333120 with margins 0.228; never the engine's own output.
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView } from "@neuvetra/database"
import { createScope3Engine } from "../calculation/scope3-authority"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { scope3SpendMappingKeyInput } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { buildScope3Results, REVIEWED_SCOPE3_ENGINE_SHA256, scope3AnnotationOf, type Scope3ResultsEngine } from "./scope3-results-routes"
import { decodeScope3Results } from "../../../site-web/src/lib/scope3-results-decode"
import { scope3Csv } from "../../../site-web/src/lib/scope3-results-api"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const engine: Scope3ResultsEngine = createScope3Engine({ python, expectedEngineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })
const company = "93710000-0000-4000-8000-000000000001", setup = "93710000-0000-4000-8000-000000000002"
const office = "93710000-0000-4000-8000-000000000003", warehouse = "93710000-0000-4000-8000-000000000004"
const owner = "93710000-0000-4000-8000-0000000000a1"
const context: CollectionContext = { companyId: company, setupVersionId: setup, setupRevision: 1, sameContentSetupVersionIds: [setup], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [
  { id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" },
  { id: warehouse, name: "Warehouse", inclusion: "excluded", control: "landlord", entityId: null, startMode: "period_start", endMode: "period_end" }] }
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "", evidenceIds: [] as string[], period: year }
const plainAmount = (value: string) => /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(value)
const q = (value: string, unit: string, normalized = plainAmount(value)) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalized ? value : null, normalizedUnit: normalized ? unit : null })
let n = 0
function record(activity: Record<string, unknown>): CollectionActivityRecord {
  const id = `93710000-0000-4000-8000-${String(1000 + ++n).padStart(12, "0")}`
  const parsed = validateCollectionActivity({ ...common, sourceId: `P-${n}`, ...activity })
  const version = { id: `94710000-0000-4000-8000-${String(1000 + n).padStart(12, "0")}`, recordId: id, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z" }
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
  buildScope3Results({ companyId: company, context, records, evidence, setup: setupView(screen, period), engine: use, now: () => new Date("2026-10-30T00:00:00Z") })
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
const memoOf = (result: Awaited<ReturnType<typeof build>>, r: CollectionActivityRecord) => result.records.find(item => item.recordId === r.id)!.supersededSpendMemo

describe("round 3, lane A: the superseded spend memo (owner decision 4)", () => {
  test("each superseded spend line keeps its would-be EEIO figure outside every total; a replacing figure under 10% of them is flagged", async () => {
    const byName = spend("50000", { naicsCode: "331110", dollarYear: 2022, supplierName: "Synthetic Steel Co" })                                 // 50,000 x 0.787 = 39,350
    const capital = spend("48000", { category: 2, naicsCode: "333120", capitalFullCost: true, dollarYear: 2022, supplierName: "Synthetic Steel Co" })  // 48,000 x 0.228 = 10,944
    const figure = supplier("120", "metric_ton", { supersedesSpend: { supplierName: "Synthetic Steel Co", mappingKeys: [] } })               // 120 x 1.850125 = 222.015
    const other = spend("1000", { naicsCode: "111130", dollarYear: 2022, supplierName: "Another supplier" })
    const result = await build([byName, capital, figure, other])
    const a = memoOf(result, byName)!, b = memoOf(result, capital)!
    expect([a.status, a.supersededBy, a.wouldBe!.display, a.methodVersionId]).toEqual(["calculated", figure.id, "39350.0000", "scope3.spend.epa_scghg_v1_3.v1"])
    expect([b.status, b.wouldBe!.display]).toEqual(["calculated", "10944.0000"])
    // 222.015 x 10 = 2,220.15 < 39,350 + 10,944 = 50,294: under 10%, so both lines carry the review flag.
    for (const m of [a, b]) {
      expect(m.replacing.co2e!.display).toBe("222.0150")
      expect([m.replacing.spendLines, Number(m.replacing.wouldBeTotalUnrounded), m.reviewFlags]).toEqual([2, 50294, ["superseding_figure_review"]])
    }
    // The memo is in no total: categories 1 and 2 count only the supplier figure and the other line (848 = 1,000 x 0.848).
    const row = result.records.find(item => item.recordId === byName.id)!
    expect([row.outcome, row.plan.status, row.result]).toEqual(["held", "excluded", null])
    expect(result.coverage.categories[0]!.subtotal!.display).toBe("1070.0150")
    expect(result.coverage.categories[1]!.subtotal).toBeNull()
    expect(memoOf(result, other)).toBeUndefined()
    expect(memoOf(result, figure)).toBeUndefined()
  }, TIMEOUT)

  test("a replacing figure within 10% to 10 times is not flagged; a superseded line that would be held has no figure and is not compared", async () => {
    const line = spend("10000", { naicsCode: "331110", dollarYear: 2022, supplierName: "Synthetic Steel Co" })                                  // 7,870
    const figure = supplier("3000", "metric_ton", { supersedesSpend: { supplierName: "Synthetic Steel Co", mappingKeys: [] } })               // 5,550.375: 70% of 7,870
    const result = await build([line, figure])
    const m = memoOf(result, line)!
    expect([m.wouldBe!.display, m.replacing.co2e!.display, Number(m.replacing.wouldBeTotalUnrounded), m.reviewFlags]).toEqual(["7870.0000", "5550.3750", 7870, []])
    // Over 10 times: 50,000 t x 1.850125 = 92,506.25 > 10 x 7,870.
    const big = supplier("50000", "metric_ton", { supersedesSpend: { supplierName: "Synthetic Steel Co", mappingKeys: [] } })
    expect(memoOf(await build([line, big]), line)!.reviewFlags).toEqual(["superseding_figure_review"])
    // A superseded line with no NAICS code would be held: no would-be figure, nothing compared.
    const unmapped = spend("10000", { naicsCode: null, dollarYear: 2022, supplierName: "Synthetic Steel Co" })
    const held = memoOf(await build([unmapped, figure]), unmapped)!
    expect([held.status, held.wouldBe, held.reasons, held.replacing.wouldBeTotalUnrounded, held.reviewFlags]).toEqual(["not_calculated", null, ["naics_code_required"], null, []])
  }, TIMEOUT)

  test("the web decoder accepts the memo, recomputes the comparison and refuses a tampered one; the CSV and status words show it", async () => {
    const line = spend("50000", { naicsCode: "331110", dollarYear: 2022, supplierName: "Synthetic Steel Co" })
    const figure = supplier("120", "metric_ton", { supersedesSpend: { supplierName: "Synthetic Steel Co", mappingKeys: [] } })
    const result = JSON.parse(JSON.stringify(await build([line, figure])))
    const decoded = decodeScope3Results(result, company)
    const row = decoded.records.find(item => item.recordId === line.id)!
    expect(row.supersededSpendMemo!.reviewFlags).toEqual(["superseding_figure_review"])
    const tampered = JSON.parse(JSON.stringify(result))
    tampered.records.find((item: { recordId: string }) => item.recordId === line.id).supersededSpendMemo.reviewFlags = []
    expect(() => decodeScope3Results(tampered, company)).toThrow()
    const moved = JSON.parse(JSON.stringify(result))
    moved.records.find((item: { recordId: string }) => item.recordId === figure.id).supersededSpendMemo = row.supersededSpendMemo
    expect(() => decodeScope3Results(moved, company)).toThrow()
    const csv = scope3Csv(decoded, { kind: k => k, reason: c => c, period: (a, b) => `${a} to ${b}` })
    expect(csv).toContain("Spend-based figure it would have had: 39350.0000 kg CO2e (a memo, not in any total).")
    expect(csv).toContain("Review the replacing figure: 222.0150 kg CO2e is under 10% or over 10 times the spend-based figure of the 1 spend line it replaces (39350 kg CO2e).")
    expect(csv).toContain("# Column Record.Tax treatment:")
    // Counted and superseded spend lines both retain their tax-treatment disclosure.
    const counted = decodeScope3Results(JSON.parse(JSON.stringify(await build([spend("1000", { naicsCode: "111130", dollarYear: 2022, supplierName: "Another supplier" })]))), company)
    expect(counted.records[0]!.plan.notes).toContain("spend_tax_treatment_excludes_sales_tax")
    const recordLine = scope3Csv(counted, { kind: k => k, reason: c => c, period: (a, b) => `${a} to ${b}` }).split("\n").find(text => text.startsWith("Record,1,purchase_spend"))!
    expect(recordLine.endsWith(",no,,excludes sales tax,")).toBe(true)  // no evidence or memo; tax treatment; no currency conversion
  }, TIMEOUT)
})
