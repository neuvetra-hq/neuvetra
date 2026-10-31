/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real component without a DOM. */
// Scope 3 completion I-09 (Claude, 30 October 2026; DESIGN 7.3): the spend import panel. A chosen file is previewed with
// the shared parser (refusals block the import; totals and hold counts shown); an import uploads the file as evidence,
// imports those bytes at the chosen location and shows the reconciliation and holds by reason; a mapping group saves the
// chosen code; a possible duplicate is confirmed distinct or withdrawn by a correction of that record.
import { describe, expect, test } from "bun:test"
import * as parser from "../../../../packages/neuvetra-database/src/scope3-spend-import"
import * as api from "@/lib/scope3-spend-import-api"
import { reasonText } from "@/lib/plain-language"
import * as forms from "@/lib/scope3-forms"
import * as naics from "@/lib/scope3-naics"
import * as review from "@/lib/scope3-spend-review"
import { harness, loadComponent } from "./component-harness"

const company = "93920000-0000-4000-8000-000000000001", loc = "93920000-0000-4000-8000-0000000000b1", user = "93920000-0000-4000-8000-0000000000ff", setup = "93920000-0000-4000-8000-0000000000c1"
const imp = "93920000-0000-4000-8000-0000000000a1", evidenceId = "93920000-0000-4000-8000-0000000000e1"
const rec = (n: number) => `93920000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`
const HEADER = parser.SCOPE3_SPEND_IMPORT_COLUMNS.join(",")
const at = "2025-06-01T00:00:00.000Z"
const imported = { id: imp, companyId: company, reportingYear: 2025, fileSha256: "1".repeat(64), fileName: "ledger.csv", evidenceId, locationId: loc, setupVersionId: setup, rowCount: 2, fileTotals: { USD: "150" }, nonNumericRows: 0, createdBy: user, createdAt: at,
  lines: [{ row: 1, recordId: rec(1), lineFingerprint: "a".repeat(64) }, { row: 2, recordId: rec(2), lineFingerprint: "b".repeat(64) }],
  reconciliation: { reconciled: true, nonNumericRows: { file: 0, imported: 0 }, currencies: [{ currency: "USD", fileTotal: "150", importedTotal: "150", lines: 2, matches: true }] } }
const line = (n: number, extra: Record<string, unknown>) => ({ recordId: rec(n), versionId: rec(n + 50), revision: 1, importId: imp, importRow: n, sourceId: `L${n}`, state: "active", amount: "75", currency: "USD", category: 1, naicsCode: null, marginChoice: "with_margins",
  mappingSource: "unmatched", mappingKeySha256: "7".repeat(64), glAccount: "6310", vendor: "Events", description: "Venue", lineDate: "2025-03-01", possibleDuplicateOf: null, duplicateConfirmedDistinct: false, categoryConfirmed: false, activityOverlap: "unknown",
  plan: { action: "hold", status: "input_needed", reasons: ["naics_code_required"] }, supersededBy: null, glDescription: "", conversion: null, ...extra })
const view = (lines: any[], extra: Record<string, unknown> = {}) => api.decodeScope3SpendImports({ profile: api.SCOPE3_SPEND_IMPORTS_PROFILE, companyId: company, canManage: true, setupVersionId: setup, reportingYear: 2025, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" },
  locations: [{ id: loc, name: "HQ" }], imports: lines.length ? [{ ...imported, rowCount: lines.length, lines: lines.map((l, i) => ({ row: i + 1, recordId: l.recordId, lineFingerprint: "abcdef".charAt(i % 6).repeat(64) })),
    fileTotals: { USD: String(lines.length * 75) }, reconciliation: { reconciled: true, nonNumericRows: { file: 0, imported: 0 }, currencies: [{ currency: "USD", fileTotal: String(lines.length * 75), importedTotal: String(lines.length * 75), lines: lines.length, matches: true }] } }] : [],
  mappings: [], lines, superseded: [], superseders: [], ...extra }, company)

async function panel(initial: any = view([]), onOpenRecord?: (id: string) => void, withdrawalError?: Error) {
  const calls: any[] = []
  let current = initial
  const record = { id: rec(2), currentVersion: { id: rec(52), revision: 1, activity: { kind: "purchase_spend", state: "active", withdrawalReason: null, payload: { duplicateConfirmedDistinct: false, possibleDuplicateOf: { importId: imp, row: 1 } } } } }
  const make = await loadComponent("./scope3/SpendImport.tsx", "SpendImport", {
    ...parser, ...api, ...review, reasonText, scope3NaicsChoices: naics.scope3NaicsChoices, scope3NaicsGuard: forms.scope3NaicsGuard, SCOPE3_NAICS_GUARD_TEXT: forms.SCOPE3_NAICS_GUARD_TEXT, scope3NaicsTitle: naics.scope3NaicsTitle,
    loadScope3SpendImports: async () => current,
    uploadCollectionEvidence: async (...args: any[]) => { calls.push(["upload", args[1].name, args[1].type]); return { receipt: { evidenceId } } },
    importScope3SpendFile: async (...args: any[]) => { calls.push(["import", new TextDecoder().decode(args[1]), args[2], args[3]]); current = view([line(1, {}), line(2, {})])
      return api.decodeScope3SpendImportResult({ profile: api.SCOPE3_SPEND_IMPORTS_PROFILE, import: imported, replayed: false, saved: 2, calculable: 0, holds: { naics_code_required: 2 }, lines: current.lines }, company) },
    saveScope3SpendMapping: async (...args: any[]) => { calls.push(["mapping", args[1]]); return { mapping: {}, corrected: [{ recordId: rec(1) }, { recordId: rec(2) }], unchanged: 0 } },
    withdrawScope3SpendImport: async (...args: any[]) => {
      calls.push(["withdraw-import", args[0], args[1], args[2]])
      if (withdrawalError) throw withdrawalError
      const count = current.lines.filter((line: any) => line.importId === args[1] && line.state === "active").length
      current = { ...current, lines: current.lines.map((line: any) => line.importId === args[1] ? { ...line, state: "withdrawn", plan: { action: "hold", status: "withdrawn", reasons: ["record_withdrawn"] } } : line) }
      return { importId: args[1], withdrawn: count, alreadyWithdrawn: 0, message: `${count} lines withdrawn. Withdrawn lines stay in the history and no longer count.` }
    },
    listCollectionActivities: async () => [record],
    saveCollectionActivity: async (...args: any[]) => { calls.push(["save", args[1], args[2]]); return {} },
    convertScope3SpendCurrency: async (...args: any[]) => { calls.push(["convert", args[1]]); return { converted: [{ recordId: rec(1), sourceId: "L1", versionId: rec(51), revision: 2, from: "75", usd: "81.17" }], skipped: [{ recordId: rec(2), sourceId: "L2", reason: "negative_amount_not_supported" }] } },
  })
  const app = harness(make, () => ({ companyId: company, actor: { userId: user, accessToken: "t" }, onOpenRecord }), { crypto: { randomUUID: () => "93920000-0000-4000-8000-0000000000aa" }, File })
  await app.settle()
  const node = (label: string) => app.nodes().find(n => n.props["aria-label"] === label)
  const choose = async (text: string) => { node("Spend file")!.props.onChange({ target: { files: [new File([text], "ledger.csv", { type: "text/csv" })] } }); await new Promise(r => setTimeout(r, 5)); await app.settle() }
  /** The text with whitespace removed (the harness joins JSX children with spaces). */
  const says = (expected: string) => expect(app.text().replace(/\s+/g, "")).toContain(expected.replace(/\s+/g, ""))
  const component = (name: string) => app.nodes().filter(n => typeof n.type === "function" && (n.type as any).name === name)
  const tab = async (label: string) => { app.button(label)!.props.onClick(); await app.settle() }
  return { app, calls, node, choose, says, component, tab }
}

describe("whole-import withdrawal", () => {
  test("requires a reason and confirmation, withdraws only the selected import and refreshes its counts", async () => {
    const p = await panel(view([line(1, {}), line(2, {})]))
    p.app.button("Withdraw this import")!.props.onClick(); await p.app.settle()
    const reason = p.node("Reason for withdrawing ledger.csv")!
    expect(reason).toBeDefined()
    expect(p.app.button("Confirm withdrawal")!.props.disabled).toBe(true)
    reason.props.onChange({ target: { value: "Imported the wrong month." } }); await p.app.settle()
    expect(p.calls.filter(call => call[0] === "withdraw-import")).toEqual([])
    await p.app.button("Confirm withdrawal")!.props.onClick(); await p.app.settle()
    expect(p.calls.filter(call => call[0] === "withdraw-import")).toEqual([["withdraw-import", company, imp, "Imported the wrong month."]])
    p.says("2 lines withdrawn.")
    expect(p.app.button("Withdraw this import")!.props.disabled).toBe(true)
  })

  test("permission and a helpful refusal keep the import intact; cancel never writes", async () => {
    const readonly = await panel(view([line(1, {})], { canManage: false }))
    expect(readonly.app.button("Withdraw this import")!.props.disabled).toBe(true)
    const p = await panel(view([line(1, {})]), undefined, new api.Scope3SpendImportApiError("Reload before withdrawing this import.", 409, "changed"))
    p.app.button("Withdraw this import")!.props.onClick(); await p.app.settle()
    p.app.button("Cancel withdrawal")!.props.onClick(); await p.app.settle()
    expect(p.calls.filter(call => call[0] === "withdraw-import")).toEqual([])
    p.app.button("Withdraw this import")!.props.onClick(); await p.app.settle()
    p.node("Reason for withdrawing ledger.csv")!.props.onChange({ target: { value: "Wrong month." } }); await p.app.settle()
    await p.app.button("Confirm withdrawal")!.props.onClick(); await p.app.settle()
    p.says("Reload before withdrawing this import.")
    expect(p.node("Reason for withdrawing ledger.csv")!.props.value).toBe("Wrong month.")
  })
})

/** Round 3: a group row rendered on its own (the panel's harness keeps child components as nodes), with the panel's props. */
async function groupRow(p: Awaited<ReturnType<typeof panel>>, vendor: string) {
  const props = p.component("SpendGroupRow").find(r => r.props.group.vendor === vendor)!.props
  const make = await loadComponent("./scope3/SpendImport.tsx", "SpendGroupRow", { ...parser, ...api, ...review, reasonText, scope3NaicsChoices: naics.scope3NaicsChoices, scope3NaicsGuard: forms.scope3NaicsGuard, SCOPE3_NAICS_GUARD_TEXT: forms.SCOPE3_NAICS_GUARD_TEXT, scope3NaicsTitle: naics.scope3NaicsTitle })
  const app = harness(make, () => props)
  await app.settle()
  const says = (expected: string) => expect(app.text().replace(/\s+/g, "")).toContain(expected.replace(/\s+/g, ""))
  const component = (name: string) => app.nodes().filter(n => typeof n.type === "function" && (n.type as any).name === name)
  return { app, says, component }
}

describe("SpendImport (I-09)", () => {
  test("a refused file shows every problem and cannot be imported", async () => {
    const p = await panel()
    await p.choose(`${HEADER}\nA,,V,,,d,10,USD,,9,,,\n`)
    p.says("Row 1: category 9 is transport the company did not pay for")
    expect(p.app.button("Import spend lines")!.props.disabled).toBe(true)
  })

  test("preview with a line table, import of the same bytes as uploaded evidence at the chosen location, reconciliation and holds by reason", async () => {
    const p = await panel()
    const text = `${HEADER}\nL1,2025-03-01,Events,6310,,Venue,75,USD,2025,,,,\nL2,2025-03-02,Events,6310,,Venue,75,USD,2025,,,,\n`
    await p.choose(text)
    // Round 2c: the file totals say they are net of credits (no credit here, so no breakdown line).
    p.says("2 lines. Totals, net of credits: $150.00")
    expect(p.app.text()).not.toContain("purchases $")
    p.says("2 without a NAICS code")
    const table = p.node("Lines in the file")!
    expect(JSON.stringify(table)).toContain("Venue")
    expect(p.component("PreviewStatus").map(n => n.props.line.row)).toEqual([1, 2])
    expect(p.node("Setup location")!.props.value).toBe(loc)
    p.app.button("Import spend lines")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    expect(p.calls.slice(0, 2)).toEqual([["upload", "ledger.csv", "text/csv"], ["import", text, evidenceId, loc]])
    p.says("Imported 2 spend lines.")
    p.says(`2 × ${reasonText("naics_code_required")}`)
    const reconciliation = p.app.nodes().find(n => n.props["aria-label"] === "Reconciliation")!
    expect(JSON.stringify(reconciliation)).toContain("\"Yes\"")
    // Round 2 UX-1: one group for the vendor and account; its mapping is a group mapping (description empty), remembered.
    const [group] = p.component("SpendGroupRow")
    expect(group!.props.group.lines.map((l: any) => l.recordId)).toEqual([rec(1), rec(2)])
    await group!.props.onSave({ category: 1, naicsCode: "711310", marginChoice: "with_margins", categoryConfirmed: false, activityOverlapConfirmed: null }); await p.app.settle()
    expect(p.calls.find(c => c[0] === "mapping")![1]).toEqual({ expectedRevision: 0, scope: "group", mapping: { glAccount: "6310", vendor: "Events", description: "", category: 1, naicsCode: "711310", marginChoice: "with_margins" }, categoryConfirmed: false, activityOverlapConfirmed: null })
    p.says("Mapping saved; 2 line(s) corrected.")
  })

  test("round 2 UX-1: the review grid groups by vendor and account, maps several groups at once or one line on its own, and shows progress", async () => {
    const lines = [line(1, { vendor: "Staples Inc.", glAccount: "6100", description: "Toner" }), line(2, { vendor: "STAPLES", glAccount: "6100", description: "Paper" }), line(3, { vendor: "FedEx", glAccount: "6500", description: "Outbound parcels" }),
      line(4, { vendor: "Acme", glAccount: "6100", description: "Chairs", naicsCode: "337214", mappingSource: "user", plan: { action: "calculate", status: null, reasons: [] } })]
    const p = await panel(view(lines))
    p.says("Lines with a code 1 of 4")
    p.says("US dollars with a code (purchases, before credits) $75.00 of $300.00")
    p.says("Needs a code (3)")
    const rows = p.component("SpendGroupRow")
    expect(rows.map(r => [r.props.group.vendor, r.props.group.lines.length])).toEqual([["Staples Inc.", 2], ["FedEx", 1]])
    // Select both groups: one form maps them all (one group mapping each).
    rows[0]!.props.onSelect(true); rows[1]!.props.onSelect(true); await p.app.settle()
    const [bulk] = p.component("SpendMappingForm")
    expect(bulk!.props.title).toBe("Map 2 selected group(s): 3 line(s)")
    await bulk!.props.onSave({ category: 1, naicsCode: "492110", marginChoice: "with_margins", categoryConfirmed: true, activityOverlapConfirmed: null }); await p.app.settle()
    const mappings = p.calls.filter(c => c[0] === "mapping").map(c => c[1])
    expect(mappings.map((m: any) => [m.scope, m.mapping.vendor, m.mapping.glAccount, m.mapping.description, m.mapping.naicsCode])).toEqual([["group", "Staples Inc.", "6100", "", "492110"], ["group", "FedEx", "6500", "", "492110"]])
    p.says("Mapping saved for 2 groups")
    // A per-line override: a line mapping (the line's own description and key), no scope.
    await p.component("SpendGroupRow")[0]!.props.onSaveLine(lines[1], { category: 1, naicsCode: "322230", marginChoice: "with_margins", categoryConfirmed: false, activityOverlapConfirmed: null }); await p.app.settle()
    expect(p.calls.filter(c => c[0] === "mapping").at(-1)![1]).toEqual({ expectedRevision: 0, mapping: { glAccount: "6100", vendor: "STAPLES", description: "Paper", category: 1, naicsCode: "322230", marginChoice: "with_margins" }, categoryConfirmed: false, activityOverlapConfirmed: null })
    // Search narrows the groups.
    p.node("Find lines")!.props.onChange({ target: { value: "parcels" } }); await p.app.settle()
    expect(p.component("SpendGroupRow").map(r => r.props.group.vendor)).toEqual(["FedEx"])
  })

  test("round 2 UX-1: lines held for anything else are listed apart by reason with their own fix: open the line, or withdraw it", async () => {
    const opened: string[] = []
    const lines = [line(1, { currency: "EUR", plan: { action: "hold", status: "input_needed", reasons: ["currency_not_supported", "naics_code_required"] } }),
      line(2, { lineDate: "2024-12-30", naicsCode: "711310", mappingSource: "file", plan: { action: "hold", status: "input_needed", reasons: ["spend_line_date_outside_reporting_period"] } })]
    const p = await panel(view(lines), id => opened.push(id))
    p.says("Needs a code (0)")
    await p.tab("Other holds (2)")
    p.says(reasonText("currency_not_supported"))
    p.says(review.scope3SpendHoldFix("currency_not_supported").fix)
    p.says("This line also needs a code; it joins “Needs a code” once this is fixed.")
    p.says(review.scope3SpendHoldFix("spend_line_date_outside_reporting_period").fix)
    p.app.button("Open the line")!.props.onClick()
    expect(opened).toEqual([rec(1)])
    p.app.nodes().find(n => n.type === "button" && n.children.flat(Infinity).join("") === "Withdraw")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    expect(p.calls.find(c => c[0] === "save")!.slice(1)).toMatchObject([rec(2), { activity: { state: "withdrawn" } }])
    expect(p.calls.find(c => c[0] === "save")![2].correctionReason).toStartWith("Withdrawn from the spend review: ")
  })

  test("round 2 ACC-16: each supplier record beside the spend lines it replaces (amounts as recorded) and its own figure", async () => {
    const sup = "93920000-0000-4000-8000-0000000000d1"
    const lines = [line(1, { amount: "240000", naicsCode: "331110", mappingSource: "file", supersededBy: sup, plan: { action: "hold", status: "excluded", reasons: ["superseded_by_supplier_record"] } }),
      line(2, { amount: "1000.5", naicsCode: "331110", mappingSource: "file", supersededBy: sup, plan: { action: "hold", status: "excluded", reasons: ["superseded_by_supplier_record"] } })]
    const p = await panel(view(lines, {
      superseded: lines.map(l => ({ spendRecordId: l.recordId, supersededBy: sup, supplierName: "Acme Metals", kind: "purchase_supplier", spendSourceId: l.sourceId, spendDescription: l.description, spendAmount: l.amount, spendCurrency: "USD" })),
      superseders: [{ recordId: sup, kind: "purchase_supplier", sourceId: "SUP-1", name: "Acme Metals", category: 1, quantity: "12.4", unit: "metric_ton CO2e", basis: "allocated_total", factorValue: null, factorUnit: null, allocationNumerator: null, allocationDenominator: null }] }))
    p.says("Spend replaced (2 lines) $241,000.50")
    p.says("Counted instead 12.4 metric tons CO2e (supplier-allocated total)")
    // Replaced lines are not lines to map.
    p.says("Lines with a code 0 of 0")
  })

  // Round 2c integration (lane D's walk item 4): the preview, the reconciliation and the progress meter each say which dollar
  // basis they use, and the credit is shown with the net beside the purchases.
  test("round 2c: file totals net of credits with purchases and credits shown; the progress meter counts purchases and names the credits", async () => {
    const p = await panel()
    await p.choose(`${HEADER}\nL1,2025-03-01,Events,6310,,Venue,218346.5,USD,2025,,,,\nL2,2025-03-02,Events,6310,,Venue refund,-412.5,USD,2025,,,,\n`)
    p.says("2 lines. Totals, net of credits: $217,934.00")
    p.says("USD: purchases $218,346.50 − credits $412.50 (1 line) = net $217,934.00")
    p.app.button("Import spend lines")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    const reconciliation = JSON.stringify(p.app.nodes().find(n => n.props["aria-label"] === "Reconciliation")!)
    for (const head of ["File total (net of credits)", "Imported total (net of credits)"]) expect(reconciliation).toContain(head)
    const credit = { action: "hold", status: "input_needed", reasons: ["negative_amount_not_supported", "naics_code_required"] }
    const reviewed = await panel(view([line(1, { amount: "218346.5", naicsCode: "711310", mappingSource: "user", plan: { action: "calculate", status: null, reasons: [] } }), line(2, { amount: "-412.5", plan: credit })]))
    reviewed.says("US dollars with a code (purchases, before credits) $218,346.50 of $218,346.50")
    reviewed.says("Credits and refunds: −$412.50 on 1 line, held and not counted. Net of credits: $217,934.00.")
    expect(reviewed.app.text()).not.toContain("in another currency or without a plain amount")
  })

  test("a possible duplicate is confirmed distinct, or withdrawn, by a correction of that record", async () => {
    const p = await panel(view([line(1, { mappingSource: "file", naicsCode: "711310", plan: { action: "calculate", status: null, reasons: [] } }),
      line(2, { mappingSource: "file", naicsCode: "711310", possibleDuplicateOf: { importId: imp, row: 1 }, plan: { action: "hold", status: "input_needed", reasons: ["possible_duplicate_spend_line"] } })]))
    await p.tab("Possible duplicates (1)")
    p.says("repeats ledger.csv line 1")
    p.app.button("Not a duplicate")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    const distinct = p.calls.find(c => c[0] === "save")!
    expect(distinct[1]).toBe(rec(2))
    expect(distinct[2]).toMatchObject({ expectedRevision: 1, expectedVersionId: rec(52), correctionReason: "Confirmed not a duplicate of the earlier imported line.", activity: { payload: { duplicateConfirmedDistinct: true } } })
    p.app.button("Duplicate: withdraw")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    expect(p.calls.filter(c => c[0] === "save")[1]![2]).toMatchObject({ activity: { state: "withdrawn", withdrawalReason: "Duplicate of an earlier imported spend line." } })
  })

  // --- Round 3 lane C ---
  test("round 3 (decision 9): a new file clears the last file's errors first; a file that cannot be read says so and has no preview", async () => {
    const p = await panel()
    await p.choose("nonsense\n")
    p.says("Unknown column")
    await p.choose(`${HEADER}\nL1,03/14/2025,Events,6310,,Venue,75,USD,2025,,,,\n`)
    expect(p.app.text()).not.toContain("Unknown column")
    p.says("1 lines. Totals, net of credits: $75.00")
    expect(JSON.stringify(p.node("Lines in the file"))).toContain("2025-03-14")
    p.node("Spend file")!.props.onChange({ target: { files: [{ name: "broken.csv", type: "text/csv", arrayBuffer: async () => { throw new Error("The file was moved.") } }] } }); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    p.says("This file could not be read, so nothing was imported.")
    expect(p.node("Lines in the file")).toBeUndefined()
    expect(p.app.button("Import spend lines")!.props.disabled).toBe(true)
  })

  test("round 3 (decision 8): a confident suggestion on the row with the account's category; a non-purchase group is offered for withdrawal", async () => {
    const lines = [line(1, { vendor: "XPO Logistics", glAccount: "5300", glDescription: "Freight in", description: "LTL inbound" }), line(2, { vendor: "ADP", glAccount: "7000", glDescription: "Salaries and wages", description: "Payroll funding", amount: "180000" })]
    const p = await panel(view(lines))
    const freight = await groupRow(p, "XPO Logistics")
    freight.says("484122 General Freight Trucking, Long-Distance, Less Than Truckload · 4 · Upstream transport")
    freight.says("Suggested · The description names less-than-truckload freight")
    const payroll = await groupRow(p, "ADP")
    payroll.says("Not a purchase — withdraw")
    expect(payroll.app.text()).not.toContain("Suggested 541214")
    // Withdraw the payroll group: each of its lines is withdrawn with the reason (the panel's correction).
    payroll.app.button("Withdraw 1 line")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    expect(p.calls.find(c => c[0] === "save")![2]).toMatchObject({ activity: { state: "withdrawn", withdrawalReason: "Not a purchase: wages and salaries are compensation." } })
    // Opening the freight group: the form starts in category 4 and says why.
    freight.app.button("Map")!.props.onClick(); await freight.app.settle()
    const [form] = freight.component("SpendMappingForm")
    expect(form!.props.initial.category).toBe(4)
    expect(form!.props.categoryWhy).toBe("From the account: a freight or shipping account.")
  })

  test("round 3 (PR-11): one rate per currency with its source and date converts every held line in that currency on the server; a converted line shows its rate", async () => {
    const eur = { action: "hold", status: "input_needed", reasons: ["currency_not_supported", "naics_code_required"] }
    const p = await panel(view([line(1, { currency: "EUR", plan: eur }), line(2, { currency: "EUR", amount: "-20", plan: { ...eur, reasons: ["currency_not_supported", "negative_amount_not_supported", "naics_code_required"] } }), line(3, { currency: "CAD", plan: eur })]))
    await p.tab("Other holds (3)")
    p.says("Convert to US dollars")
    const form = p.node("Convert EUR to US dollars")!
    expect(form).toBeDefined()
    expect(p.node("Convert CAD to US dollars")).toBeDefined()
    const button = () => p.app.button("Convert 2 EUR lines")!
    expect(button().props.disabled).toBe(true)
    p.node("EUR rate (US dollars per EUR)")!.props.onChange({ target: { value: "1.0823" } }); await p.app.settle()
    p.node("EUR rate source")!.props.onChange({ target: { value: "ECB euro reference rate" } }); await p.app.settle()
    p.node("EUR rate date")!.props.onChange({ target: { value: "2025-06-30" } }); await p.app.settle()
    expect(button().props.disabled).toBe(false)
    button().props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    expect(p.calls.filter(c => c[0] === "convert").map(c => c[1])).toEqual([{ currency: "EUR", rate: "1.0823", rateSource: "ECB euro reference rate", rateDate: "2025-06-30" }])
    p.says("1 EUR line converted to US dollars at 1.0823 USD per EUR (ECB euro reference rate, 2025-06-30). 1 line not converted: L2 (a credit or refund).")
    // A converted line shows where its dollars came from.
    const converted = await panel(view([line(1, { amount: "81.17", conversion: { currency: "EUR", amount: "75", rate: "1.0823", rateSource: "ECB euro reference rate", rateDate: "2025-06-30", usd: "81.17" } })]))
    const row = await groupRow(converted, "Events")
    row.app.button("Map")!.props.onClick(); await row.app.settle()
    row.says("from EUR 75.00 at 1.0823 USD per EUR (ECB euro reference rate, 2025-06-30)")
  })
})
