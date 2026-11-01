// Round 2 UX-1 (Claude, 31 October 2026): the spend review grid's data. Lines that only need a code are grouped by
// normalised vendor and GL account (one mapping for the group, per-line overrides kept); lines with any other hold are
// listed apart by reason, each with its own fix; the progress meter counts lines and dollars mapped; NAICS suggestions
// come from the company's own remembered and applied mappings first, then from a keyword match on the EPA titles.
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { scope3SpendGroupKeyInput } from "../../../../packages/neuvetra-database/src/scope3-spend-grouping"
import { scope3SpendMappingKeyInput } from "../../../../packages/neuvetra-database/src/scope3-collection"
import type { Scope3SpendImportsView, Scope3SpendLineView, Scope3SpendMappingView } from "./scope3-spend-import-api"
import { scope3SpendMappingBody } from "./scope3-spend-import-api"
import { scope3SpendAmountBasis, scope3SpendNaicsSuggestions, scope3SpendOtherHolds, scope3SpendProgress, scope3SpendReviewGroups, scope3SpendSupersessionReconciliation, SCOPE3_SPEND_HOLD_FIXES } from "./scope3-spend-review"
import { parseScope3SpendCsv, SCOPE3_SPEND_IMPORT_COLUMNS } from "../../../../packages/neuvetra-database/src/scope3-spend-import"

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")
const imp = "93940000-0000-4000-8000-0000000000a1", user = "93940000-0000-4000-8000-0000000000ff", sup = "93940000-0000-4000-8000-0000000000d1"
let n = 0
const line = (extra: Partial<Scope3SpendLineView> = {}): Scope3SpendLineView => {
  n++
  const base: Scope3SpendLineView = { recordId: `93940000-0000-4000-8000-${String(n).padStart(12, "0")}`, versionId: `93940000-0000-4000-8000-1${String(n).padStart(11, "0")}`, revision: 1, importId: imp, importRow: n, sourceId: `L${n}`, state: "active",
    amount: "100", currency: "USD", category: 1, naicsCode: null, marginChoice: "with_margins", mappingSource: "unmatched", mappingKeySha256: "", glAccount: "6100", vendor: "Staples Inc.", description: "Toner",
    lineDate: "2025-03-01", possibleDuplicateOf: null, duplicateConfirmedDistinct: false, categoryConfirmed: false, activityOverlap: "unknown", plan: { action: "hold", status: "input_needed", reasons: ["naics_code_required"] }, supersededBy: null, glDescription: "Office supplies", conversion: null, ...extra }
  return { ...base, mappingKeySha256: sha(scope3SpendMappingKeyInput({ glAccount: base.glAccount, supplierName: base.vendor, description: base.description })) }
}
const counted = (extra: Partial<Scope3SpendLineView> = {}) => line({ naicsCode: "339940", mappingSource: "user", plan: { action: "calculate", status: null, reasons: [] }, ...extra })
const mapping = (extra: Partial<Scope3SpendMappingView>): Scope3SpendMappingView => ({ id: "93940000-0000-4000-8000-0000000000f1", companyId: "c", mappingKeySha256: "", glAccount: "6100", vendor: "Staples", description: "", category: 1, naicsCode: "339940",
  marginChoice: "with_margins", revision: 1, createdBy: user, createdAt: "2025-06-01T00:00:00.000Z", ...extra })
const view = (lines: Scope3SpendLineView[], mappings: Scope3SpendMappingView[] = []) => ({ lines, mappings, superseded: [], superseders: [] }) as unknown as Scope3SpendImportsView

describe("the queue of lines that need a code, by vendor and account", () => {
  test("three Staples lines with different descriptions on one account are one group; another account is its own; other holds are not in the queue", () => {
    const a = line({ description: "Toner", amount: "120.5" }), b = line({ vendor: "STAPLES, INC", description: "Paper and pens", amount: "80" }), c = line({ vendor: "Staples", description: "Desk chairs", amount: "400" })
    const d = line({ glAccount: "6200", vendor: "Staples", description: "Chairs" })
    const eur = line({ currency: "EUR", plan: { action: "hold", status: "input_needed", reasons: ["currency_not_supported", "naics_code_required"] } })
    const neg = line({ amount: "-50", plan: { action: "hold", status: "input_needed", reasons: ["negative_amount_not_supported", "naics_code_required"] } })
    const file = line({ mappingSource: "file", naicsCode: "424120", plan: { action: "hold", status: "input_needed", reasons: ["trade_sector_naics_maps_margin_only"] } })
    const withdrawn = line({ state: "withdrawn" })
    const groups = scope3SpendReviewGroups(view([a, b, c, d, eur, neg, file, withdrawn]))
    expect(groups.map(g => [g.vendor, g.glAccount, g.lines.map(l => l.recordId), g.usdTotal])).toEqual([["Staples Inc.", "6100", [a.recordId, b.recordId, c.recordId], "600.5"], ["Staples", "6200", [d.recordId], "100"]])
    expect(groups[0]!.scope).toBe("group")
    expect(groups[0]!.descriptions).toEqual(["Desk chairs", "Paper and pens", "Toner"])
    expect(groups[0]!.keyInput).toBe(scope3SpendGroupKeyInput({ glAccount: "6100", supplierName: "Staples" }))
    // The other holds: listed apart, by reason, each with its own fix (a mapping cannot make them count).
    const other = scope3SpendOtherHolds(view([a, eur, neg, file, withdrawn]))
    expect(other.map(o => [o.reason, o.lines.map(l => l.recordId)])).toEqual([["currency_not_supported", [eur.recordId]], ["negative_amount_not_supported", [neg.recordId]], ["trade_sector_naics_maps_margin_only", [file.recordId]]])
    for (const o of other) expect(SCOPE3_SPEND_HOLD_FIXES[o.reason]).toBeDefined()
    expect(other.find(o => o.reason === "currency_not_supported")!.alsoNeedsCode).toBe(1)
  })
  test("a remembered group mapping is the group's; a line with its own remembered mapping is listed as an override", () => {
    const a = line({ description: "Toner" }), b = line({ description: "Ink" })
    const group = mapping({ mappingKeySha256: sha(scope3SpendGroupKeyInput({ glAccount: "6100", supplierName: "Staples" })!) })
    const own = mapping({ id: "93940000-0000-4000-8000-0000000000f2", description: "Ink", vendor: "Staples Inc.", naicsCode: "325910", mappingKeySha256: b.mappingKeySha256 })
    const [g] = scope3SpendReviewGroups(view([a, b], [group, own]))
    expect(g!.mapping?.naicsCode).toBe("339940")
    expect(g!.overrides.get(b.recordId)?.naicsCode).toBe("325910")
    expect(g!.overrides.has(a.recordId)).toBe(false)
  })
  test("lines with neither vendor nor account form one group per description", () => {
    const a = line({ vendor: "", glAccount: "", description: "Misc" }), b = line({ vendor: "", glAccount: "", description: "Misc" }), c = line({ vendor: "", glAccount: "", description: "Other" })
    expect(scope3SpendReviewGroups(view([a, b, c])).map(g => [g.scope, g.lines.length])).toEqual([["line", 2], ["line", 1]])
  })
  test("the mapping body: a group mapping has an empty description and says its scope; a per-line override is a line mapping", () => {
    const [g] = scope3SpendReviewGroups(view([line({ description: "Toner" })]))
    const choice = { category: 1, naicsCode: "339940", marginChoice: "with_margins" as const, categoryConfirmed: false, activityOverlapConfirmed: null }
    expect(scope3SpendMappingBody({ scope: "group", glAccount: g!.glAccount, vendor: g!.vendor, description: "", mapping: null }, choice))
      .toEqual({ expectedRevision: 0, scope: "group", mapping: { glAccount: "6100", vendor: "Staples Inc.", description: "", category: 1, naicsCode: "339940", marginChoice: "with_margins" }, categoryConfirmed: false, activityOverlapConfirmed: null })
    expect(scope3SpendMappingBody({ scope: "line", glAccount: "6100", vendor: "Staples Inc.", description: "Toner", mapping: mapping({ revision: 2 }) }, choice).expectedRevision).toBe(2)
  })
})

describe("progress", () => {
  test("lines and US dollars mapped of the total; withdrawn and superseded lines are not to map; other currencies are counted apart", () => {
    const lines = [counted({ amount: "250.25" }), line({ amount: "100" }), line({ currency: "EUR", amount: "90", plan: { action: "hold", status: "input_needed", reasons: ["currency_not_supported", "naics_code_required"] } }),
      counted({ amount: "n/a", plan: { action: "hold", status: "input_needed", reasons: ["amount_not_a_number"] } }), line({ state: "withdrawn" }),
      counted({ supersededBy: sup, plan: { action: "hold", status: "excluded", reasons: ["superseded_by_supplier_record"] } }),
      line({ naicsCode: "484121", mappingSource: "user", category: 4, plan: { action: "hold", status: "input_needed", reasons: ["spend_overlap_not_confirmed"] } })]
    expect(scope3SpendProgress(view(lines))).toEqual({ lines: 5, mappedLines: 2, usdTotal: "450.25", usdMapped: "250.25", otherAmountLines: 2, counted: 1, usdCredits: "0", creditLines: 0, usdNet: "450.25" })
  })
})

// Round 2c integration (lane D's walk, R2-polish.md "Out of my scope" 4): the preview and reconciliation showed the file total
// net of a credit ($217,934.00) while the progress meter counted purchases only ($218,346.50), with nothing saying which.
// Both now state their basis: the progress counts purchases (a credit is held, never mapped) and names the credits and the
// net beside them; the file's figures per currency are purchases, credits and net, the net being the parser's file total.
describe("round 2c: one stated basis for the spend dollar figures", () => {
  test("progress counts purchases and states the credits and the net; a credit line is not an amount in another currency", () => {
    const credit = { action: "hold" as const, status: "input_needed" as const, reasons: ["negative_amount_not_supported", "naics_code_required"] }
    const lines = [counted({ amount: "218000" }), line({ amount: "346.5" }), line({ amount: "-412.5", plan: credit }), line({ currency: "EUR", amount: "90", plan: { action: "hold", status: "input_needed", reasons: ["currency_not_supported", "naics_code_required"] } }),
      line({ amount: "-50", state: "withdrawn", plan: credit })]
    expect(scope3SpendProgress(view(lines))).toEqual({ lines: 4, mappedLines: 1, usdTotal: "218346.5", usdMapped: "218000", otherAmountLines: 1, counted: 1, usdCredits: "412.5", creditLines: 1, usdNet: "217934" })
  })
  test("the file's amounts per currency: purchases, credits and net; the net is the shared parser's file total", () => {
    const csv = [SCOPE3_SPEND_IMPORT_COLUMNS.join(","), "L1,2025-03-01,Staples Inc.,6100,,Toner,218346.5,USD,2025,1,,,", "L2,2025-03-02,STAPLES INC,6100,,Toner credit,-412.5,USD,2025,1,,,",
      "L3,2025-03-03,Hotel GmbH,6400,,Rooms,90,EUR,2025,1,,,", "L4,2025-03-04,Unknown,6100,,Misc,n/a,USD,2025,1,,,", ""].join("\n")
    const parsed = parseScope3SpendCsv(new TextEncoder().encode(csv))
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors))
    const basis = scope3SpendAmountBasis(parsed.lines)
    expect(basis).toEqual([{ currency: "EUR", purchases: "90", credits: "0", net: "90", creditLines: 0, lines: 1 }, { currency: "USD", purchases: "218346.5", credits: "412.5", net: "217934", creditLines: 1, lines: 2 }])
    expect(Object.fromEntries(basis.map(row => [row.currency, row.net]))).toEqual(parsed.fileTotals)
  })
})

describe("NAICS suggestions", () => {
  // Round 3 lane C (owner decision 8): the same vendor's memory from another account, and the same account's memory for
  // another vendor, no longer outrank what the line's own words say (toner here); account memory is a weak hint, last.
  test("the company's own mappings: another account's memory of the vendor yields to the line's words; account memory is a weak hint", () => {
    const groupOther = mapping({ glAccount: "6200", vendor: "Staples", naicsCode: "337214", mappingKeySha256: sha(scope3SpendGroupKeyInput({ glAccount: "6200", supplierName: "Staples" })!) })
    const accountLine = counted({ vendor: "Office Depot", naicsCode: "322121" })
    const out = scope3SpendNaicsSuggestions({ vendor: "Staples Inc.", glAccount: "6100", glDescriptions: ["Office supplies"], descriptions: ["Toner"] }, 1, view([accountLine], [groupOther]))
    expect(out.map(s => [s.code, s.source, s.confidence])).toEqual([["339940", "terms", "high"], ["337214", "memory", "medium"], ["322121", "account_memory", "weak"]])
    expect(out[1]!.why).toContain("Staples")
    expect(out[2]!.why).toContain("6100")
    expect(out[2]!.why).toContain("Office Depot")
  })
  test("keywords from the descriptions and GL account name match EPA titles (ledger words included)", () => {
    const first = (texts: { vendor?: string; glDescriptions?: string[]; descriptions: string[] }, category = 1) => scope3SpendNaicsSuggestions({ vendor: texts.vendor ?? "", glAccount: "", glDescriptions: texts.glDescriptions ?? [], descriptions: texts.descriptions }, category, view([]))[0]?.code
    expect(first({ glDescriptions: ["Office supplies"], descriptions: ["Toner"] })).toBe("339940")
    expect(first({ glDescriptions: ["Legal fees"], descriptions: ["Contract review"] })).toBe("541110")
    expect(first({ vendor: "FedEx", descriptions: ["Outbound parcels"] })).toBe("492110")
    expect(first({ descriptions: ["Client meeting catering"] })).toBe("722320")
    expect(first({ descriptions: ["Flight SFO-BOS"] })).toBe("481111")
    expect(first({ descriptions: ["Annual software subscription"] })).toBe("511210")
    // A word and its plural count once, and are named once.
    const [software] = scope3SpendNaicsSuggestions({ vendor: "", glAccount: "", glDescriptions: ["Software subscriptions"], descriptions: ["Annual software subscription"] }, 1, view([]))
    expect(software!.why).toBe("The description names software") // round 3: a curated term, not a title keyword
    expect(first({ descriptions: ["Janitorial services"] })).toBe("561720")
    expect(first({ descriptions: ["Laptops"] })).toBe("334111")
    expect(first({ vendor: "ABM Janitorial", glDescriptions: ["Facilities"], descriptions: ["Deep clean after event"] })).toBe("561720")
    expect(first({ vendor: "Comcast Business", glDescriptions: ["Telecom"], descriptions: ["Internet service HQ"] })).toBe("517311")
    // The EPA set has no electric power sector: no unrelated title is offered for an electricity bill (it belongs in Scope 2).
    expect(first({ vendor: "PG&E", glDescriptions: ["Utilities"], descriptions: ["Electricity Mar"] })).toBeUndefined()
    // Category 4 suggests only freight codes (its own set).
    expect(first({ descriptions: ["Outbound freight trucking"] }, 4)).toMatch(/^4841/) // general freight trucking (local or long-distance)
    expect(scope3SpendNaicsSuggestions({ vendor: "", glAccount: "", glDescriptions: [], descriptions: ["zzzz qqqq"] }, 1, view([]))).toEqual([])
  })
  test("each suggestion is a code of the category's set with its EPA title", () => {
    for (const s of scope3SpendNaicsSuggestions({ vendor: "Acme", glAccount: "6100", glDescriptions: ["Office supplies"], descriptions: ["Paper"] }, 5, view([]))) expect(s.code.startsWith("562")).toBe(true)
  })
})

describe("supersession reconciliation (ACC-16)", () => {
  test("each replacing record beside the spend it replaces: US dollars summed, other amounts counted apart, the figure as entered", () => {
    const v = { lines: [], mappings: [], superseded: [
      { spendRecordId: "r1", supersededBy: sup, supplierName: "Acme Metals", kind: "purchase_supplier", spendSourceId: "C1-101", spendDescription: "Steel", spendAmount: "240000", spendCurrency: "USD" },
      { spendRecordId: "r2", supersededBy: sup, supplierName: "Acme Metals", kind: "purchase_supplier", spendSourceId: "C1-102", spendDescription: "Steel", spendAmount: "1000.5", spendCurrency: "USD" },
      { spendRecordId: "r3", supersededBy: sup, supplierName: "Acme Metals", kind: "purchase_supplier", spendSourceId: "C1-103", spendDescription: "Steel EU", spendAmount: "500", spendCurrency: "EUR" }],
      superseders: [{ recordId: sup, kind: "purchase_supplier", sourceId: "SUP-1", name: "Acme Metals", category: 1, quantity: "12.4", unit: "metric_ton CO2e", basis: "allocated_total", factorValue: null, factorUnit: null, allocationNumerator: null, allocationDenominator: null }] } as unknown as Scope3SpendImportsView
    const [r] = scope3SpendSupersessionReconciliation(v)
    expect(r).toMatchObject({ recordId: sup, sourceId: "SUP-1", name: "Acme Metals", usdTotal: "241000.5", otherAmounts: ["EUR 500"], figure: "12.4 metric tons CO2e (supplier-allocated total)" })
    expect(r!.lines.map(l => l.spendSourceId)).toEqual(["C1-101", "C1-102", "C1-103"])
  })
})
