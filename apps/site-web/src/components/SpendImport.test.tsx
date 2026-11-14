/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real component without a DOM. */
// Scope 3 completion I-09 (Claude, 30 October 2026; DESIGN 7.3): the spend import panel. A chosen file is previewed with
import { SCOPE3_VENDOR_KEY_MATCH_DETAIL } from "../../../../packages/neuvetra-database/src/scope3-text"
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

async function panel(initial: any = view([]), onOpenRecord?: (id: string) => void, withdrawalError?: Error, correctionFailure = false, loadFailures = 0, globals: Record<string, unknown> = {}, extraProps: Record<string, unknown> = {}) {
  const calls: any[] = []
  let current = initial
  let changed = 0, saves = 0
  const record = { id: rec(2), currentVersion: { id: rec(52), revision: 1, activity: { kind: "purchase_spend", state: "active", withdrawalReason: null, payload: { duplicateConfirmedDistinct: false, possibleDuplicateOf: { importId: imp, row: 1 } } } } }
  const make = await loadComponent("./scope3/SpendImport.tsx", "SpendImport", {
    ...parser, ...api, ...review, reasonText, SCOPE3_VENDOR_KEY_MATCH_DETAIL, scope3NaicsChoices: naics.scope3NaicsChoices, scope3NaicsGuard: forms.scope3NaicsGuard, SCOPE3_NAICS_GUARD_TEXT: forms.SCOPE3_NAICS_GUARD_TEXT, scope3NaicsTitle: naics.scope3NaicsTitle,
    loadScope3SpendImports: async () => { if (loadFailures-- > 0 || (correctionFailure && saves)) throw new Error("Rate limited."); return current },
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
    listCollectionActivities: async () => correctionFailure ? current.lines.map((item: any) => ({ ...record, id: item.recordId, currentVersion: { ...record.currentVersion, id: item.versionId } })) : [record],
    saveCollectionActivity: async (...args: any[]) => { calls.push(["save", args[1], args[2]]); saves++; if (correctionFailure && saves === 2) throw new Error("Too many requests. Wait a minute and try again."); return {} },
    convertScope3SpendCurrency: async (...args: any[]) => { calls.push(["convert", args[1]]); return { converted: [{ recordId: rec(1), sourceId: "L1", versionId: rec(51), revision: 2, from: "75", usd: "81.17" }], skipped: [{ recordId: rec(2), sourceId: "L2", reason: "negative_amount_not_supported" }] } },
  })
  const actor = { userId: user, accessToken: "t" }
  const app = harness(make, () => ({ companyId: company, actor, onOpenRecord, onChanged: () => { changed++ }, ...extraProps }), { crypto: { randomUUID: () => "93920000-0000-4000-8000-0000000000aa" }, File, ...globals })
  await app.settle()
  const node = (label: string) => app.nodes().find(n => n.props["aria-label"] === label)
  const choose = async (text: string) => { node("Spend file")!.props.onChange({ target: { files: [new File([text], "ledger.csv", { type: "text/csv" })] } }); await new Promise(r => setTimeout(r, 5)); await app.settle() }
  /** The text with whitespace removed (the harness joins JSX children with spaces). */
  const says = (expected: string) => expect(app.text().replace(/\s+/g, "")).toContain(expected.replace(/\s+/g, ""))
  const component = (name: string) => app.nodes().filter(n => typeof n.type === "function" && (n.type as any).name === name)
  const tab = async (label: string) => { app.button(label)!.props.onClick(); await app.settle() }
  return { app, calls, node, choose, says, component, tab, changed: () => changed }
}

describe("WO-12: a view-only member", () => {
  const member = { userId: user, role: "member", accessToken: "t" }
  const pair = () => view([line(1, {}), line(2, { naicsCode: "711310", mappingSource: "file", possibleDuplicateOf: { importId: imp, row: 1 }, plan: { action: "hold", status: "input_needed", reasons: ["possible_duplicate_spend_line"] } }),
    line(3, { currency: "EUR", naicsCode: "711310", mappingSource: "file", plan: { action: "hold", status: "input_needed", reasons: ["currency_not_supported"] } })], { canManage: false })
  test("sees the imports and every queue, with no upload, mapping, conversion, duplicate or withdrawal control (not even disabled)", async () => {
    const p = await panel(pair(), () => {}, undefined, false, 0, {}, { actor: member })
    p.says("View only: an owner or admin of your company imports spend files and maps or withdraws their lines.")
    for (const tab of ["Needs a code (1)", "Other holds (1)", "Possible duplicates (1)", "Counted (0)"]) {
      p.app.button(tab)!.props.onClick(); await p.app.settle()
      // A group's lines can be shown (a disclosure), and each line opened (navigation).
      if (p.app.button("Show lines")) { p.app.button("Show lines")!.props.onClick(); await p.app.settle() }
      const offered = p.app.nodes().filter(n => n.type === "button" || ["input", "select", "textarea"].includes(n.type as string))
        .map(n => `${n.type} ${n.props["aria-label"] ?? n.children.flat(Infinity).filter((c: unknown) => typeof c === "string").join("")}`)
      expect(offered.filter(name => !/^button (Needs a code|Other holds|Possible duplicates|Counted) \(\d\)$/.test(name) && !/^button (Hide lines|Show lines|Open|Open the line)$/.test(name) && name !== "input Find lines")).toEqual([])
    }
    // Each group row on its own (the panel keeps it as a node): read-only, its lines shown by a disclosure, each one opened.
    p.app.button("Needs a code (1)")!.props.onClick(); await p.app.settle()
    expect(p.component("SpendGroupRow").map(row => row.props.readOnly)).toEqual([true])
    // Read-only must not hide data: the held currencies and their totals are listed as text.
    p.app.button("Other holds (1)")!.props.onClick(); await p.app.settle()
    p.says("Only US dollars are calculated. These lines are held until an owner or admin converts them:")
    p.says("EUR: 1 held line")
    p.app.button("Needs a code (1)")!.props.onClick(); await p.app.settle()
    const row = await groupRow(p, "Events")
    const suggestion = () => row.app.nodes().filter(n => typeof n.props.className === "string" && n.props.className.includes("spend-import__suggest-line")).length
    const offered = () => row.app.nodes().filter(n => n.type === "button" || ["input", "select", "textarea"].includes(n.type as string)).map(n => n.children.flat(Infinity).filter((c: unknown) => typeof c === "string").join("") || n.props["aria-label"])
    expect(offered()).toEqual(["Show lines"])
    const before = suggestion()
    expect(before).toBe(1)
    row.app.button("Show lines")!.props.onClick(); await row.app.settle()
    expect(offered()).toEqual(["Hide lines", "Open"])
    // The group's suggestion stays shown with its lines (an owner's opens a mapping form in its place).
    expect(suggestion()).toBe(before)
    expect(row.component("SpendMappingForm")).toEqual([])
  })
  test("QA round 2: a group with no confident suggestion tells a member who maps it, not to open a Map control they lack", async () => {
    const unknown = (canManage: boolean) => view([line(1, { vendor: "Qzx Holdings", description: "Sundry", glAccount: "9999" })], { canManage })
    for (const [role, wording, absent] of [["member", "No confident suggestion: an owner or admin maps this group to a NAICS title.", /open Map/i], ["owner", "No confident suggestion: open Map to search the NAICS titles.", /an owner or admin maps/]] as const) {
      const p = await panel(unknown(role === "owner"), () => {}, undefined, false, 0, {}, { actor: { ...member, role } })
      const row = await groupRow(p, "Qzx Holdings")
      const text = row.app.text().replace(/\s+/g, " ")
      expect(text).toContain(wording)
      expect(text).not.toMatch(absent)
    }
  })
  test("the role decides before the server's view does (no upload while it loads); an owner keeps every control", async () => {
    const early = await panel(view([line(1, {})]), undefined, undefined, false, 0, {}, { actor: member })
    expect(early.app.button("Import spend lines")).toBeUndefined()
    expect(early.app.button("Withdraw this import")).toBeUndefined()
    const owner = await panel(view([line(1, {})]), undefined, undefined, false, 0, {}, { actor: { ...member, role: "owner" } })
    expect(owner.app.button("Import spend lines")).toBeDefined()
    expect(owner.app.button("Withdraw this import")).toBeDefined()
    expect(owner.component("SpendGroupRow").map(row => row.props.readOnly)).toEqual([false])
  })
})

describe("whole-import withdrawal", () => {
  test("partial group withdrawal reports saved progress and removes confirmed withdrawn rows even if refresh fails", async () => {
    const p = await panel(view([line(1, { vendor: "ADP" }), line(2, { vendor: "ADP" })]), undefined, undefined, true)
    await p.component("SpendGroupRow")[0]!.props.onWithdraw("Payroll is not a purchase."); await p.app.settle()
    p.says("1 of 2 lines withdrawn")
    p.says("Too many requests")
    expect(p.changed()).toBe(1)
    expect(p.component("SpendGroupRow").flatMap(row => row.props.group.lines.map((item: any) => item.recordId))).toEqual([rec(2)])
    expect(p.calls.filter(call => call[0] === "save")).toHaveLength(2)
  })

  test("withdrawing an energy suggestion never claims an unverified Scope 1 or 2 result exists", async () => {
    const p = await panel(view([line(1, {}), line(2, { vendor: "Electric utility", glDescription: "Electricity", description: "Electric utility bill" })]))
    const row = await groupRow(p, "Electric utility")
    row.app.button("Withdraw 1 line")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    const reason = p.calls.find(call => call[0] === "save")![2].activity.withdrawalReason
    expect(reason).not.toContain("counted in Scope 1 or 2")
    expect(reason).toContain("record or verify")
  })

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
    // WO-12: view-only access shows no withdrawal (or upload) control at all, rather than a disabled one.
    const readonly = await panel(view([line(1, {})], { canManage: false }))
    expect(readonly.app.button("Withdraw this import")).toBeUndefined()
    expect(readonly.app.button("Import spend lines")).toBeUndefined()
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
  test("a second failed read keeps the file; a later recovery refreshes period warnings without writing", async () => {
    const p = await panel(view([]), undefined, undefined, false, 2)
    await p.choose(`${HEADER}\nL1,2024-03-01,Events,6310,,Venue,75,USD,2024,,,,\n`)
    p.app.button("Try again")!.props.onClick(); await p.app.settle()
    p.says("Spend imports could not be loaded."); p.says("$75.00")
    expect(p.calls).toEqual([])
    p.app.button("Try again")!.props.onClick(); await p.app.settle()
    expect(p.app.button("Try again")).toBeUndefined()
    p.says("$75.00"); p.says("1 dated outside the reporting period")
    expect(p.calls).toEqual([])
  })

  test("a failed initial read can be retried without losing the chosen file or importing it", async () => {
    const p = await panel(view([]), undefined, undefined, false, 1)
    p.says("Spend imports could not be loaded.")
    const text = `${HEADER}\nL1,2025-03-01,Events,6310,,Venue,75,USD,2025,,,,\n`
    await p.choose(text)
    expect(p.app.button("Try again")).toBeDefined()
    p.app.button("Try again")!.props.onClick(); await p.app.settle()
    expect(p.app.text()).not.toContain("Spend imports could not be loaded.")
    expect(p.app.button("Try again")).toBeUndefined()
    p.says("$75.00")
    expect(p.node("Setup location")!.props.value).toBe(loc)
    expect(p.calls).toEqual([])
    expect(p.app.button("Import spend lines")!.props["aria-disabled"]).toBeUndefined()
  })

  test("a refused file shows every problem and cannot be imported", async () => {
    const p = await panel()
    await p.choose(`${HEADER}\nA,,V,,,d,10,USD,,9,,,\n`)
    p.says("Row 1: category 9 is transport the company did not pay for")
    expect(p.app.button("Import spend lines")!.props["aria-disabled"]).toBe(true)
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
    // BF-12 (QA F1): a line the record matches only by the vendor key says so; the others don't.
    expect(p.app.text()).not.toContain("matched as the same supplier")
    const keyed = await panel(view(lines, {
      superseded: lines.map((l, i) => ({ spendRecordId: l.recordId, supersededBy: sup, supplierName: "Acme Metals", kind: "purchase_supplier", spendSourceId: l.sourceId, spendDescription: l.description, spendAmount: l.amount, spendCurrency: "USD", ...(i === 1 ? { vendorKeyMatch: true } : {}) })),
      superseders: [{ recordId: sup, kind: "purchase_supplier", sourceId: "SUP-1", name: "Acme Metals", category: 1, quantity: "12.4", unit: "metric_ton CO2e", basis: "allocated_total", factorValue: null, factorUnit: null, allocationNumerator: null, allocationDenominator: null }] }))
    expect(keyed.app.text().split("matched as the same supplier").length - 1).toBe(1)
    keyed.says("(supplier on the replacing record: Acme Metals)")
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
    expect(p.app.button("Import spend lines")!.props["aria-disabled"]).toBe(true)
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

// PR 22 integration (Claude, 1 November 2026), W-1: the duplicate queue's "Not a duplicate" / "Duplicate: withdraw" (and a
// group's or a held line's withdrawal) corrected each line with the setup version the line was saved against. 0030 takes
// a correction only against the current company setup version, so after any new setup version every such action was
// refused (422 "Invalid or unsupported collection record."; reproduced natively). The spend view names the current version.
describe("integration W-1: spend review corrections are saved against the current company setup version", () => {
  test("after company setup was saved again, Not a duplicate, Duplicate: withdraw and a group withdrawal send the current setup version", async () => {
    const earlier = "93920000-0000-4000-8000-0000000000c0"
    const saved = (n: number) => ({ id: rec(n), currentVersion: { id: rec(n + 50), revision: 1, activity: { kind: "purchase_spend", locationId: loc, setupVersionId: earlier, sourceId: `L${n}`, state: "active", withdrawalReason: null,
      payload: { duplicateConfirmedDistinct: false, possibleDuplicateOf: n === 2 ? { importId: imp, row: 1 } : null, naicsCode: null } } } })
    const records = [saved(1), saved(2), saved(3)]
    const p = await panel(view([line(1, { mappingSource: "file", naicsCode: "711310", plan: { action: "calculate", status: null, reasons: [] } }),
      line(2, { mappingSource: "file", naicsCode: "711310", possibleDuplicateOf: { importId: imp, row: 1 }, plan: { action: "hold", status: "input_needed", reasons: ["possible_duplicate_spend_line"] } }),
      line(3, { vendor: "ADP", glAccount: "7000", glDescription: "Salaries and wages", description: "Payroll funding" })]), undefined, undefined, false, 0, { listCollectionActivities: async () => records })
    await p.tab("Possible duplicates (1)")
    p.app.button("Not a duplicate")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    p.app.button("Duplicate: withdraw")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    await p.tab("Needs a code (1)")
    const payroll = await groupRow(p, "ADP")
    payroll.app.button("Withdraw 1 line")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    const saves = p.calls.filter(c => c[0] === "save")
    expect(saves.map(c => [c[1], c[2].activity.setupVersionId])).toEqual([[rec(2), setup], [rec(2), setup], [rec(3), setup]])
    // Only the setup version (and the correction itself) changes; the line keeps its location and the rest of its record.
    expect(saves[0]![2].activity).toEqual({ ...records[1]!.currentVersion.activity, setupVersionId: setup, payload: { ...records[1]!.currentVersion.activity.payload, duplicateConfirmedDistinct: true } })
    expect(saves[1]![2].activity).toMatchObject({ locationId: loc, sourceId: "L2", state: "withdrawn", withdrawalReason: "Duplicate of an earlier imported spend line." })
    expect(saves[2]![2].activity).toMatchObject({ locationId: loc, sourceId: "L3", state: "withdrawn" })
  })
})

// Bug hunt C (pr22, Claude, 1 November 2026), C-06: "Open the spend import" (Overview, to-do list, category row) asked for
// the review heading in an animation frame queued with the list's state update; when that frame ran before React had
// rendered the review (reproduced live at 390 px), the heading was not found: the page scrolled to the panel's top and
// keyboard focus stayed on the screen heading thousands of pixels above. The heading is focused once it is rendered.
describe("Open the spend import lands on the review heading", () => {
  test("the review heading is scrolled to and focused after the review has rendered", async () => {
    const { requestSpendImportFocus, SPEND_IMPORT_ANCHOR } = await import("@/lib/spend-import-target")
    const log: string[] = []
    let rendered = () => false
    const heading = { scrollIntoView: () => log.push("heading scrolled"), focus: () => log.push("heading focused") }
    const panelNode = { querySelector: () => rendered() ? heading : null, scrollIntoView: () => log.push("panel scrolled") }
    const globals = { document: { getElementById: (id: string) => id === SPEND_IMPORT_ANCHOR ? panelNode : null }, requestAnimationFrame: (run: () => void) => setTimeout(run, 0) }
    // The list answers after the panel has mounted (a real network read), so the panel's first render has no review.
    let answer!: (value: unknown) => void
    const listed = view([line(1, {}), line(2, { possibleDuplicateOf: { importId: imp, row: 1 }, plan: { action: "hold", status: "input_needed", reasons: ["possible_duplicate_spend_line"] } })])
    requestSpendImportFocus("duplicates")
    const p = await panel(view([]), undefined, undefined, false, 0, { ...globals, loadScope3SpendImports: () => new Promise(resolve => { answer = resolve }) })
    rendered = () => p.app.nodes().some(node => node.props["data-spend-review-heading"] !== undefined)
    expect(rendered()).toBe(false)
    // The answer is handled (state set, frame asked for) before React renders it, as in the browser.
    answer(listed); for (let tick = 0; tick < 3; tick++) await Promise.resolve()
    await p.app.settle()
    expect(rendered()).toBe(true)
    expect(log).toEqual(["heading scrolled", "heading focused"])
  })
})

// WO-06 (QA B1): "Open" now leaves for the record view, which remounts this panel, so its unsaved input is reported to
// the Activity screen's leave guard: an open mapping form with changes, a chosen file not yet imported, typed exchange
// rates for currencies still held, and a withdrawal reason.
describe("WO-06: unsaved spend-import input is reported to the leave guard", () => {
  test("a chosen file not yet imported, a withdrawal reason and typed rates count; importing or clearing them does not", async () => {
    const reported: boolean[] = []
    const p = await panel(view([]), undefined, undefined, false, 0, {}, { onDirtyChange: (dirty: boolean) => reported.push(dirty) })
    expect(reported.at(-1)).toBe(false)
    await p.choose(`${HEADER}\nL1,2025-03-01,Paper,6100,,Staples,75,USD,2025,,,,\n`)
    expect(reported.at(-1)).toBe(true)
    p.app.button("Import spend lines")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    expect(p.calls.some(c => c[0] === "import")).toBe(true)
    expect(reported.at(-1)).toBe(false)
    const q = await panel(view([line(1, {})]), undefined, undefined, false, 0, {}, { onDirtyChange: (dirty: boolean) => reported.push(dirty) })
    q.app.button("Withdraw this import")!.props.onClick(); await q.app.settle()
    expect(reported.at(-1)).toBe(false)
    q.node(`Reason for withdrawing ${imported.fileName}`)!.props.onChange({ target: { value: "Wrong file." } }); await q.app.settle()
    expect(reported.at(-1)).toBe(true)
    q.app.button("Cancel withdrawal")!.props.onClick(); await q.app.settle()
    expect(reported.at(-1)).toBe(false)
  })

  // WO-10 (WO-06 QA follow-ups 1 and 2): an imported file is cleared, so withdrawing that import can't bring its preview back
  // as unsaved input; and an import being sent is not unsaved input (it completes even if the person leaves).
  test("WO-10: an import being sent is not unsaved; once imported the file is cleared, and withdrawing that import stays quiet", async () => {
    const reported: boolean[] = []
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    const p = await panel(view([]), undefined, undefined, false, 0, { uploadCollectionEvidence: async () => { await gate; return { receipt: { evidenceId } } } }, { onDirtyChange: (dirty: boolean) => reported.push(dirty) })
    await p.choose(`${HEADER}\nL1,2025-03-01,Paper,6100,,Staples,75,USD,2025,,,,\n`)
    expect(reported.at(-1)).toBe(true)
    p.app.button("Import spend lines")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    // Sending: the in-app guard has nothing to ask about, and the button stays focusable (aria-disabled).
    expect(reported.at(-1)).toBe(false)
    expect(p.app.button("Import spend lines")!.props["aria-disabled"]).toBe(true)
    expect(p.app.button("Import spend lines")!.props.disabled).not.toBe(true)
    release(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    expect(p.calls.some(c => c[0] === "import")).toBe(true)
    // Imported: no preview of the file is left, the result is shown, and nothing is unsaved.
    expect(p.node("Lines in the file")).toBeUndefined()
    expect(p.node("Import result")).toBeDefined()
    expect(reported.at(-1)).toBe(false)
    p.app.button("Withdraw this import")!.props.onClick(); await p.app.settle()
    p.node(`Reason for withdrawing ${imported.fileName}`)!.props.onChange({ target: { value: "Wrong file." } }); await p.app.settle()
    expect(reported.at(-1)).toBe(true)
    p.app.button("Confirm withdrawal")!.props.onClick(); await new Promise(r => setTimeout(r, 5)); await p.app.settle()
    expect(p.node("Lines in the file")).toBeUndefined()
    expect(reported.at(-1)).toBe(false)
  })

  test("typed exchange rates count while their currency is still held", async () => {
    const reported: boolean[] = []
    const eur = { action: "hold", status: "input_needed", reasons: ["currency_not_supported", "naics_code_required"] }
    const p = await panel(view([line(1, { currency: "EUR", plan: eur })]), undefined, undefined, false, 0, {}, { onDirtyChange: (dirty: boolean) => reported.push(dirty) })
    await p.tab("Other holds (1)")
    const rate = p.app.nodes().find(n => n.type === "input" && /rate/i.test(String(n.props["aria-label"] ?? "")))!
    rate.props.onChange({ target: { value: "1.08" } }); await p.app.settle()
    expect(reported.at(-1)).toBe(true)
  })

  test("a mapping form reports a change (Margins) under its key, and clears it when closed", async () => {
    const p = await panel(view([line(1, {}), line(2, {})]))
    const rows = p.component("SpendGroupRow")
    const row = await groupRow(p, rows[0]!.props.group.vendor)
    const formDirty: Array<[string, boolean]> = []
    expect(rows[0]!.props.onFormDirty).toBeInstanceOf(Function)
    row.app.button("Map")!.props.onClick(); await row.app.settle()
    const form = row.component("SpendMappingForm")[0]!
    expect(form.props.dirtyKey).toBe(`group:${rows[0]!.props.group.keyInput}`)
    const make = await loadComponent("./scope3/SpendImport.tsx", "SpendMappingForm", { ...parser, ...api, ...review, reasonText, scope3NaicsChoices: naics.scope3NaicsChoices, scope3NaicsGuard: forms.scope3NaicsGuard, SCOPE3_NAICS_GUARD_TEXT: forms.SCOPE3_NAICS_GUARD_TEXT, scope3NaicsTitle: naics.scope3NaicsTitle })
    const onDirty = (key: string, dirty: boolean) => { formDirty.push([key, dirty]) }
    const mapping = harness(make, () => ({ ...form.props, onDirty }))
    await mapping.settle()
    expect(formDirty.at(-1)).toEqual([form.props.dirtyKey, false])
    mapping.nodes().find(n => n.props["aria-label"] === "Margins")!.props.onChange({ target: { value: "without_margins" } }); await mapping.settle()
    expect(formDirty.at(-1)).toEqual([form.props.dirtyKey, true])
    mapping.nodes().find(n => n.props["aria-label"] === "Margins")!.props.onChange({ target: { value: "with_margins" } }); await mapping.settle()
    expect(formDirty.at(-1)).toEqual([form.props.dirtyKey, false])
  })

  test("the panel's guard state follows its forms' registry", async () => {
    const reported: boolean[] = []
    const p = await panel(view([line(1, {})]), undefined, undefined, false, 0, {}, { onDirtyChange: (dirty: boolean) => reported.push(dirty) })
    const register = p.component("SpendGroupRow")[0]!.props.onFormDirty as (key: string, dirty: boolean) => void
    register("group:x", true); await p.app.settle()
    expect(reported.at(-1)).toBe(true)
    register("group:x", false); await p.app.settle()
    expect(reported.at(-1)).toBe(false)
  })
})
