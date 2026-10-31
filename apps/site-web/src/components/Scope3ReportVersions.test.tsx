/* eslint-disable @typescript-eslint/no-explicit-any -- the injected harness runs the real components without a DOM. */
// Frozen Scope 3 report versions on the Results screen (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 7.4;
// assurance-ux M8): the history lists who prepared each version, when and why, and who approved it (self-approval shown);
// an opened version is rendered from its stored report text, its CSV download is the stored bytes and its print prints
// only the frozen version; approving sends the SHA-256 shown; preparing a later version needs a reason.
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { buildScope3ReportDocument, scope3ReportCsv, scope3ReportText, type Scope3ReportVersionSummary } from "../../../../packages/neuvetra-database/src/scope3-report-document"
import * as plain from "@/lib/plain-language"
import * as reportApi from "@/lib/scope3-report-api"
import * as resultsApi from "@/lib/scope3-results-api"
import { SCOPE3_CSV_LABELS } from "@/lib/scope3-csv-labels"
import * as checklist from "@/lib/scope3-checklist"
import * as resultsText from "@/lib/scope3-results-text"
import * as changeLog from "@/lib/scope3-change-log"
import { harness, loadComponent } from "./component-harness"

const fixture: resultsApi.Scope3ResultsResponse = await Bun.file(new URL("../lib/scope3-results.fixture.json", import.meta.url)).json()
const company = fixture.companyId, me = "93400000-0000-4000-8000-0000000000a1", colleague = "93400000-0000-4000-8000-0000000000a2"
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")
const document = buildScope3ReportDocument({ results: fixture, reportingYear: 2025, revision: 1, setupVersionId: "93400000-0000-4000-8000-0000000000c1", consolidationApproach: "operational_control", preparedBy: me, preparedAt: "2026-10-30T10:00:00.000Z", previous: null })
const reportText = scope3ReportText(document), csvText = scope3ReportCsv(document, SCOPE3_CSV_LABELS)
const version = (extra: Partial<Scope3ReportVersionSummary> = {}): Scope3ReportVersionSummary => ({ id: "93400000-0000-4000-8000-0000000000f1", companyId: company, reportingYear: 2025, revision: 1, previousId: null, setupVersionId: "93400000-0000-4000-8000-0000000000c1", reason: null,
  reportSha256: sha256(reportText), csvSha256: sha256(csvText), engineSha256: fixture.methods[0]!.engineSha256, registerSha256s: fixture.registerSha256s, inputVersionCount: document.inputs.recordVersionIds.length, createdBy: me, createdAt: "2026-10-30T10:00:01.000Z", openIssues: document.results.readiness!.openIssues, approval: null, ...extra })
// Round 2 (owner decision 7): the fixture has open issues, so the approval acknowledged them; the self-approval was confirmed.
const selfApproved = version({ approval: { approvedBy: me, approvedAt: "2026-10-30T11:00:00.000Z", selfApproved: true, reportSha256: sha256(reportText), acknowledgedOpenIssues: document.results.readiness!.openIssues, selfApprovalConfirmed: true } })
const second = version({ id: "93400000-0000-4000-8000-0000000000f2", revision: 2, previousId: selfApproved.id, reason: "Records corrected after review.", createdBy: colleague, approval: null })

const text = (node: any): string => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.children) : node == null || typeof node === "boolean" ? "" : String(node)
const report1 = await reportApi.decodeScope3ReportVersion({ profile: reportApi.SCOPE3_REPORTS_PROFILE, version: version(), reportText, csvText }, company, version().id)
async function component(name: string, inject: Record<string, unknown> = {}) {
  let blob = "", downloaded = "", printed = 0
  const body = { dataset: {} as Record<string, string> }
  const globals = {
    Blob: class { constructor(parts: string[]) { blob = parts.join("") } }, URL: { createObjectURL: () => "blob:frozen", revokeObjectURL: () => {} },
    document: { body, createElement: () => { const link: any = { click: () => { downloaded = link.download } }; return link } },
    window: { setTimeout: () => 0, print: () => { printed++ }, addEventListener: () => {} },
    Icon: () => null, Scope3ReportSection: ({ results }: any) => ({ type: "section", props: { "data-frozen-results": results }, children: [] }),
  }
  const make = await loadComponent("./scope3/Scope3ReportVersions.tsx", name, { ...plain, ...reportApi, ...resultsApi, ...checklist, ...resultsText, ...changeLog, ...globals, ...inject })
  return { make, globals, blob: () => blob, downloaded: () => downloaded, printed: () => printed, body }
}

describe("Scope 3 report versions on the Results screen (I-10)", () => {
  test("the history lists who, when and why, and shows self-approval", async () => {
    const c = await component("Scope3ReportHistory")
    const opened: string[] = []
    const app = harness(c.make, () => ({ versions: [selfApproved, second], actorId: me, onOpen: (id: string) => opened.push(id) }), c.globals)
    await app.settle()
    const words = (value: any): string => Array.isArray(value) ? value.map(words).join("") : value && typeof value === "object" ? words(value.children) : value == null || typeof value === "boolean" ? "" : String(value)
    const rows = app.nodes().filter(node => node.type === "tr").slice(1).map(row => row.children.flat(Infinity).filter((cell: any) => cell?.type === "td").map(words))
    expect(rows[0]!.slice(0, 4)).toEqual(["2", "by user 93400000 · 2026-10-30 10:00 UTC", "Records corrected after review.", "Not approved"])
    // Round 2 integration: lane B's summary stores the acknowledged open issues with the approval, and lane D's history
    // shows them as a chip after the control-exception chip.
    const acknowledged = selfApproved.approval!.acknowledgedOpenIssues!.length
    expect(acknowledged).toBeGreaterThan(1)
    expect(rows[1]!.slice(0, 4)).toEqual(["1", "by you · 2026-10-30 10:00 UTC", "First version", `Approved by you · 2026-10-30 11:00 UTCSelf-approved · control exceptionApproved with ${acknowledged} open issues acknowledged`])
    app.nodes().find(node => node.props["aria-label"] === "Open revision 1")!.props.onClick()
    expect(opened).toEqual([selfApproved.id])
  })

  test("an opened version renders from its stored text; its CSV download is the stored bytes; print prints only it; approve sends the shown hash", async () => {
    const c = await component("Scope3FrozenReportView")
    const report = await reportApi.decodeScope3ReportVersion({ profile: reportApi.SCOPE3_REPORTS_PROFILE, version: version(), reportText, csvText }, company, version().id)
    let approvals = 0
    const app = harness(c.make, () => ({ report, actorId: me, canManage: true, busy: false, onApprove: () => { approvals++ }, onClose: () => {} }), c.globals)
    await app.settle()
    expect(app.text()).toContain("read-only.")
    expect(app.text()).toContain("Not approved yet.")
    expect(app.text()).toContain("Scope 3 base year: not yet established.")
    expect(app.text()).toContain("First version: no earlier approved version for reporting year 2025.")
    // The frozen section is rendered from the stored document's results, not the live ones.
    expect(app.nodes().find(node => node.type === c.globals.Scope3ReportSection)!.props.results).toEqual(report.document.results)
    expect(app.nodes().find(node => node.type === "article")!.props.className).toBe("nv-report nv-report--frozen")
    const button = (label: string) => app.nodes().find(node => node.type === "button" && node.children.flat(Infinity).some((x: any) => typeof x === "string" && x.includes(label)))!
    button("Download this version").props.onClick()
    expect(c.blob()).toBe(reportApi.scope3ReportExportCsv(csvText, report.version))
    expect(Buffer.from(c.blob().slice(0, csvText.length), "utf8").equals(Buffer.from(csvText, "utf8"))).toBe(true)
    expect(c.downloaded()).toBe(reportApi.scope3ReportCsvName(report.version))
    button("Print this version").props.onClick()
    expect([c.printed(), c.body.dataset.print]).toEqual([1, "scope3-frozen"])
    button("Approve (self-approval)").props.onClick()
    expect(approvals).toBe(1)
    // Once approved (by the preparer), the view says so and offers no approval.
    const approved = { ...report, version: selfApproved }
    const after = harness(c.make, () => ({ report: approved, actorId: me, canManage: true, busy: false, onApprove: () => {}, onClose: () => {} }), c.globals)
    await after.settle()
    expect(after.text()).toContain("(self-approved: the preparer approved their own version)")
    expect(after.nodes().some(node => node.type === "button" && node.children.flat(Infinity).some((x: any) => typeof x === "string" && x.startsWith("Approve")))).toBe(false)
  })

  test("the panel prepares the first version, opens it, and approves it with the displayed hash; a later version needs a reason", async () => {
    const calls: any[] = []
    let versions: Scope3ReportVersionSummary[] = []
    const view = () => ({ companyId: company, canManage: true, actorId: me, setupVersionId: "93400000-0000-4000-8000-0000000000c1", reportingYear: 2025, versions })
    const opened = await reportApi.decodeScope3ReportVersion({ profile: reportApi.SCOPE3_REPORTS_PROFILE, version: version(), reportText, csvText }, company, version().id)
    const c = await component("Scope3ReportVersions", {
      loadScope3Reports: async () => view(),
      prepareScope3Report: async (_: string, input: any) => { calls.push(["prepare", input]); versions = [version()]; return { version: version(), replayed: false } },
      loadScope3ReportVersion: async (_: string, id: string) => { calls.push(["open", id]); return versions[0]!.approval ? { ...opened, version: versions[0]! } : opened },
      approveScope3Report: async (_: string, id: string, hash: string, __: unknown, confirmations: unknown) => { calls.push(["approve", id, hash]); calls.push(["confirmations", confirmations]); versions = [selfApproved]; return { version: selfApproved, replayed: false } },
    })
    const app = harness(c.make, () => ({ companyId: company, actor: { accessToken: "t", userId: me } }), { ...c.globals, crypto: { randomUUID: () => "93400000-0000-4000-8000-0000000000k1" } })
    await app.settle()
    const button = (label: string) => app.nodes().find(node => node.type === "button" && node.children.flat(Infinity).some((x: any) => typeof x === "string" && x.includes(label)))
    expect(app.nodes().some(node => node.props["aria-label"] === "Why a new version?")).toBe(false) // the first version needs no reason
    button("Prepare report version")!.props.onClick(); await app.settle()
    expect(calls[0]).toEqual(["prepare", { idempotencyKey: "93400000-0000-4000-8000-0000000000k1", expectedRevision: 0, reason: null }])
    expect(calls[1]).toEqual(["open", version().id])
    // The opened version (rendered by Scope3FrozenReportView) is the stored one; its Approve sends the hash it shows.
    const frozen = () => app.nodes().find(node => typeof node.props.onApprove === "function")!
    expect(frozen().props.report.version.reportSha256).toBe(sha256(reportText))
    const confirmations = { acknowledgeOpenIssues: true, confirmSelfApproval: true }
    frozen().props.onApprove(confirmations); await app.settle()
    expect(calls[2]).toEqual(["approve", version().id, sha256(reportText)])
    // Round 2 lane D (decision 7): what the approver confirmed reaches the API unchanged.
    expect(calls[3]).toEqual(["confirmations", confirmations])
    expect(app.nodes().find(node => Array.isArray(node.props.versions))!.props.versions[0].approval).toMatchObject({ approvedBy: me, selfApproved: true })
    expect(frozen().props.report.version.approval.selfApproved).toBe(true)
    // A second version: the reason is asked for and required.
    button("Prepare report version")!.props.onClick(); await app.settle()
    expect(app.text()).toContain("Say why this version replaces the earlier one")
    expect(calls.filter(call => call[0] === "prepare")).toHaveLength(1)
    app.nodes().find(node => node.props["aria-label"] === "Why a new version?")!.props.onChange({ target: { value: "Records corrected after review." } }); await app.settle()
    button("Prepare report version")!.props.onClick(); await app.settle()
    expect(calls.filter(call => call[0] === "prepare").at(-1)).toEqual(["prepare", { idempotencyKey: "93400000-0000-4000-8000-0000000000k1", expectedRevision: 1, reason: "Records corrected after review." }])
  })
})

// Round 2, lane D (Claude, 31 October 2026; ROUND2 decision 7; product review UX-10; accounting ACC-10): preparing a draft is
// always allowed; approving needs the frozen open issues acknowledged and a self-approval confirmed, both sent to the API,
// shown and printed with the version; self-approval is shown as a control exception.
describe("round 2: readiness gate, open-issues acknowledgement and self-approval confirmation", () => {
  test("the approved-version download preserves stored CSV and appends approval, acknowledged issues and self-approval exception", async () => {
    const c = await component("Scope3FrozenReportView")
    const report = await reportApi.decodeScope3ReportVersion({ profile: reportApi.SCOPE3_REPORTS_PROFILE, version: selfApproved, reportText, csvText }, company, selfApproved.id)
    const app = harness(c.make, () => ({ report, actorId: me, canManage: true, busy: false, onApprove: () => {}, onClose: () => {} }), c.globals)
    await app.settle()
    const download = app.nodes().find((node: any) => node.type === "button" && node.children.flat(Infinity).some((x: any) => typeof x === "string" && x.includes("Download this version")))!
    download.props.onClick()
    expect(c.blob()).toBe(reportApi.scope3ReportExportCsv(csvText, selfApproved))
    expect(c.blob().startsWith(csvText)).toBe(true)
    expect(c.blob().slice(csvText.length)).toContain("Control exception")
    expect(sha256(report.csvText)).toBe(selfApproved.csvSha256)
  })
  const issues = checklist.scope3ReadinessIssues(fixture)
  const checkboxes = (app: any) => app.nodes().filter((node: any) => node.type === "input" && node.props.type === "checkbox")
  const approveButton = (app: any) => app.nodes().find((node: any) => node.type === "button" && node.children.flat(Infinity).some((x: any) => typeof x === "string" && x.startsWith("Approve")))

  test("switching the open revision requires fresh confirmations, including when returning to the earlier revision", async () => {
    const c = await component("Scope3FrozenReportView")
    let report = report1
    const app = harness(c.make, () => ({ report, actorId: me, canManage: true, busy: false, onApprove: () => {}, onClose: () => {} }), c.globals)
    await app.settle()
    for (const checkbox of checkboxes(app)) checkbox.props.onChange({ target: { checked: true } })
    await app.settle()
    expect(approveButton(app).props.disabled).toBe(false)
    report = { ...report1, version: { ...report1.version, id: second.id, revision: 2, reportSha256: "a".repeat(64) } }
    app.render()
    expect(approveButton(app).props.disabled).toBe(true)
    await app.settle()
    expect(checkboxes(app).every((node: any) => node.props.checked === false)).toBe(true)
    report = report1; app.render(); await app.settle()
    expect(approveButton(app).props.disabled).toBe(true)
  })

  test("the fixture's frozen version has open issues (categories needing input, relevant categories without an assessment), listed in the printed version", async () => {
    expect(issues.length).toBeGreaterThan(0)
    const c = await component("Scope3FrozenReportView")
    const app = harness(c.make, () => ({ report: report1, actorId: colleague, canManage: true, busy: false, onApprove: () => {}, onClose: () => {} }), c.globals)
    await app.settle()
    const article = app.nodes().find((node: any) => node.type === "article")!
    const printed = JSON.stringify(article)
    expect(printed).toContain("Open issues frozen with this version")
    for (const issue of issues) expect(printed).toContain(issue.text)
  })

  test("another member approving: Approve with open issues stays disabled until the issues are acknowledged; the keys are sent", async () => {
    const c = await component("Scope3FrozenReportView")
    const sent: any[] = []
    const app = harness(c.make, () => ({ report: report1, actorId: colleague, canManage: true, busy: false, onApprove: (value: any) => sent.push(value), onClose: () => {} }), c.globals)
    await app.settle()
    expect(checkboxes(app)).toHaveLength(1) // no self-approval confirmation for another member
    expect(text(approveButton(app))).toBe("Approve with open issues")
    expect(approveButton(app).props.disabled).toBe(true)
    expect(app.text()).toContain("Acknowledge the open issues before approving")
    checkboxes(app)[0].props.onChange({ target: { checked: true } }); await app.settle()
    expect(approveButton(app).props.disabled).toBe(false)
    approveButton(app).props.onClick()
    expect(sent).toEqual([{ acknowledgeOpenIssues: true, confirmSelfApproval: false }])
  })

  test("self-approval needs its own explicit confirmation as well; once approved it is shown and printed as a control exception", async () => {
    const c = await component("Scope3FrozenReportView")
    const sent: any[] = []
    const app = harness(c.make, () => ({ report: report1, actorId: me, canManage: true, busy: false, onApprove: (value: any) => sent.push(value), onClose: () => {} }), c.globals)
    await app.settle()
    expect(text(approveButton(app))).toBe("Approve (self-approval)")
    const [ack, self] = checkboxes(app)
    expect(app.text()).toContain("Self-approval is a control exception")
    ack.props.onChange({ target: { checked: true } }); await app.settle()
    expect(approveButton(app).props.disabled).toBe(true)
    expect(app.text()).toContain("Confirm the self-approval before approving.")
    checkboxes(app)[1].props.onChange({ target: { checked: true } }); await app.settle()
    expect(approveButton(app).props.disabled).toBe(false)
    approveButton(app).props.onClick()
    expect(sent).toEqual([{ acknowledgeOpenIssues: true, confirmSelfApproval: true }])
    expect(self).toBeDefined()
    // Approved by its preparer, with lane B's stored acknowledgement: the printed version says both.
    const approved = { ...report1, version: { ...selfApproved, approval: { ...selfApproved.approval!, acknowledgedOpenIssues: issues.map(issue => ({ category: issue.category, code: issue.code })), selfApprovalConfirmed: true } } as any }
    const after = harness(c.make, () => ({ report: approved, actorId: me, canManage: true, busy: false, onApprove: () => {}, onClose: () => {} }), c.globals)
    await after.settle()
    const printed = JSON.stringify(after.nodes().find((node: any) => node.type === "article"))
    expect(printed).toContain("Control exception: self-approved.")
    expect(printed).toContain(`Approved with ${issues.length} open issues acknowledged: ${issues.map(issue => issue.text).join(" ")}`)
    expect(checkboxes(after)).toHaveLength(0)
  })

  test("the request body carries the hash always, the acknowledgement and the confirmation only when they apply", () => {
    // Lane B's route takes exactly these three keys.
    expect(reportApi.scope3ApprovalBody("ab")).toEqual({ reportSha256: "ab", acknowledgeOpenIssues: false, confirmSelfApproval: false })
    expect(reportApi.scope3ApprovalBody("ab", { acknowledgeOpenIssues: true, confirmSelfApproval: true })).toEqual({ reportSha256: "ab", acknowledgeOpenIssues: true, confirmSelfApproval: true })
  })

  test("a frozen version's issues come from its stored document (lane B's readiness when present), never from the live results", async () => {
    const fn = checklist.scope3FrozenOpenIssues
    // Lane B's summary field wins, then its frozen results' readiness, then the stored results themselves.
    const summary = { ...report1, version: { ...report1.version, openIssues: [{ category: 8, code: "screening_conflict" }] } } as any
    expect(fn(summary).map((issue: any) => [issue.key, issue.text])).toEqual([["category:8:screening_conflict", "Category 8 has a screening conflict: records exist for a category screened out."]])
    // Round 2 integration: lane B's summary always carries openIssues, so the fallbacks are checked on a summary without it.
    const { openIssues: _summaryIssues, ...withoutIssues } = report1.version as any
    expect(Array.isArray(_summaryIssues)).toBe(true)
    const readiness = { ...report1, version: withoutIssues, document: { ...report1.document, results: { ...report1.document.results, readiness: { ready: false, openIssues: [{ category: 2, code: "assessment_missing" }] } } } } as any
    expect(fn(readiness).map((issue: any) => issue.key)).toEqual(["category:2:assessment_missing"])
    expect(fn(report1).map((issue: any) => issue.key)).toEqual(issues.map(issue => issue.key))
  })

  test("the panel shows the live readiness before preparing; preparing stays possible with open issues", async () => {
    const c = await component("Scope3ReportVersions", { loadScope3Reports: async () => ({ companyId: company, canManage: true, actorId: me, setupVersionId: "93400000-0000-4000-8000-0000000000c1", reportingYear: 2025, versions: [] }) })
    const app = harness(c.make, () => ({ companyId: company, actor: { accessToken: "t", userId: me }, results: fixture }), c.globals)
    await app.settle()
    expect(app.text()).toContain("Readiness for approval")
    expect(app.text()).toContain(`${issues.length} open issues. A draft version can still be prepared`)
    for (const issue of issues) expect(app.text()).toContain(issue.text)
    // An empty company (nothing screened) is never called "ready".
    const empty = structuredClone(fixture) as any
    for (const row of empty.coverage.categories) row.status = "not_screened"
    const none = harness(c.make, () => ({ companyId: company, actor: { accessToken: "t", userId: me }, results: empty }), c.globals)
    await none.settle()
    expect(none.text()).not.toContain("Readiness for approval")
    const prepare = app.nodes().find((node: any) => node.type === "button" && node.children.flat(Infinity).some((x: any) => x === "Prepare report version"))!
    expect(prepare.props.disabled).toBe(false)
  })
})

// Round 2 polish, lane D (Claude, 31 October 2026; product review UX-7 remainder): the frozen change log names each record by
// its activity and source ID (and description), each method by its title, and never shows a raw id; the stored bytes keep
// every id untouched (display only). The previous approved version is loaded to name removed records.
describe("round 2 polish: the frozen change log in words, never raw ids", () => {
  const UUIDS = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
  const v2Results = structuredClone(fixture) as any
  const edited = v2Results.records.find((row: any) => row.sourceId === "W-1" && !row.derivedFrom)
  const editedId = edited.recordId
  edited.versionId = "93400000-0000-4000-8000-0000000000e9"; edited.revision += 1
  const removed = v2Results.records.find((row: any) => row.sourceId === "T-1")
  v2Results.records = v2Results.records.filter((row: any) => row.sourceId !== "T-1")
  const addedLine = { ...structuredClone(v2Results.records.find((row: any) => row.sourceId === "C-1")), recordId: "93400000-0000-4000-8000-0000000000d7", versionId: "93400000-0000-4000-8000-0000000000d8", sourceId: "C-2" }
  v2Results.records.push(addedLine)
  const spend = v2Results.records.find((row: any) => row.kind === "purchase_spend")
  spend.payload = { ...spend.payload, naicsCode: "339940", description: "Toner and office supplies" }
  const doc2 = buildScope3ReportDocument({ results: v2Results, reportingYear: 2025, revision: 2, setupVersionId: "93400000-0000-4000-8000-0000000000c1", consolidationApproach: "operational_control", preparedBy: colleague, preparedAt: "2026-10-31T09:00:00.000Z", previous: { summary: selfApproved, document: document as any } })
  const text2 = scope3ReportText(doc2), csv2 = scope3ReportCsv(doc2, SCOPE3_CSV_LABELS)
  const summary2 = version({ id: "93400000-0000-4000-8000-0000000000f2", revision: 2, previousId: selfApproved.id, reason: "Records corrected after review.", createdBy: colleague, reportSha256: sha256(text2), csvSha256: sha256(csv2), inputVersionCount: doc2.inputs.recordVersionIds.length, openIssues: doc2.results.readiness!.openIssues })
  const report2 = { version: summary2, reportText: text2, csvText: csv2, document: doc2 } as any
  const changeLines = (app: any) => { const parts = app.nodes().find((node: any) => node.type === "article")!.children.flat(Infinity)
    const at = parts.findIndex((node: any) => node?.type === "h4" && text(node) === "Changes since the previous approved version")
    return (parts[at + 1].children.flat(Infinity) as any[]).filter(node => node?.type === "li").map(text) }

  test("records are named by activity, source ID and description, with the previous version naming removed ones; no line shows an id", async () => {
    expect(doc2.changeLog.records.edited.map(item => item.recordId)).toContain(editedId)
    expect(doc2.changeLog.records.removed.map(item => item.recordId)).toContain(removed.recordId)
    expect(doc2.changeLog.mappings).toHaveLength(1)
    const c = await component("Scope3FrozenReportView")
    const app = harness(c.make, () => ({ report: report2, previous: document, actorId: me, canManage: true, busy: false, onApprove: () => {}, onClose: () => {} }), c.globals)
    await app.settle()
    const lines = changeLines(app)
    expect(lines[0]).toBe(`Compared with approved revision 1 (report SHA-256 ${sha256(reportText).slice(0, 12)}…, approved 2026-10-30 11:00 UTC).`)
    expect(lines).toContain(`Record added: ${plain.kindLabel("employee_commuting")} · C-2 (category ${addedLine.category})`)
    expect(lines).toContain(`Record removed: ${plain.kindLabel("business_travel")} · T-1 (category ${removed.category})`)
    expect(lines.find(line => line.startsWith(`Record changed: ${plain.kindLabel("waste")} · W-1 (category ${edited.category}), revision ${edited.revision - 1} → ${edited.revision}`))).toBeDefined()
    expect(lines).toContain(`Spend mapping changed for ${plain.kindLabel("purchase_spend")} · ${spend.sourceId} (“Toner and office supplies”): category ${spend.category}, NAICS ${(fixture.records.find(row => row.recordId === spend.recordId)!.payload as any).naicsCode} → category ${spend.category}, NAICS 339940`)
    for (const line of lines) expect([line, UUIDS.test(line)]).toEqual([line, false])
    // Display only: the stored report text and CSV keep the ids, byte for byte.
    expect(report2.reportText).toBe(text2)
    expect(text2).toContain(editedId)
    const download = app.nodes().find((node: any) => node.type === "button" && node.children.flat(Infinity).some((x: any) => typeof x === "string" && x.includes("Download this version")))!
    download.props.onClick()
    expect(c.blob()).toBe(reportApi.scope3ReportExportCsv(csv2, report2.version))
  })

  test("without the previous version a removed record is named by its activity, never by its id", async () => {
    const c = await component("Scope3FrozenReportView")
    const app = harness(c.make, () => ({ report: report2, actorId: me, canManage: true, busy: false, onApprove: () => {}, onClose: () => {} }), c.globals)
    await app.settle()
    const lines = changeLines(app)
    expect(lines).toContain(`Record removed: ${plain.kindLabel("business_travel")} record (not in this version’s results) (category ${removed.category})`)
    for (const line of lines) expect([line, UUIDS.test(line)]).toEqual([line, false])
  })

  test("opening a later version loads the previous approved version and passes its document to the view; times are UTC", async () => {
    const calls: string[] = []
    const opened1 = await reportApi.decodeScope3ReportVersion({ profile: reportApi.SCOPE3_REPORTS_PROFILE, version: selfApproved, reportText, csvText }, company, selfApproved.id)
    const c = await component("Scope3ReportVersions", {
      loadScope3Reports: async () => ({ companyId: company, canManage: true, actorId: me, setupVersionId: "93400000-0000-4000-8000-0000000000c1", reportingYear: 2025, versions: [selfApproved, summary2] }),
      loadScope3ReportVersion: async (_: string, id: string) => { calls.push(id); return id === summary2.id ? report2 : opened1 },
    })
    const app = harness(c.make, () => ({ companyId: company, actor: { accessToken: "t", userId: me } }), c.globals)
    await app.settle()
    app.nodes().find((node: any) => node.props.onOpen)!.props.onOpen(summary2.id); await app.settle()
    expect(calls).toEqual([summary2.id, selfApproved.id])
    const view = app.nodes().find((node: any) => typeof node.props.onApprove === "function")!
    expect(view.props.previous).toEqual(opened1.document)
  })
})

test('the untouched-delivery v2 golden opens in the frozen view and downloads its exact stored CSV', async () => {
  const g = await Bun.file(new URL('../../../../packages/neuvetra-database/src/testdata/scope3-report-v2-golden.json', import.meta.url)).json()
  const d = JSON.parse(g.reportText)
  const summary=version({companyId:g.companyId,createdBy:d.assertion.preparedBy,createdAt:d.assertion.preparedAt,reportSha256:g.reportSha256,csvSha256:g.csvSha256,setupVersionId:d.inputs.setupVersionId,inputVersionCount:d.inputs.recordVersionIds.length,openIssues:d.results.readiness.openIssues,engineSha256:d.results.methods[0].engineSha256,registerSha256s:d.results.registerSha256s})
  const frozen=await reportApi.decodeScope3ReportVersion({profile:reportApi.SCOPE3_REPORTS_PROFILE,version:summary,reportText:g.reportText,csvText:g.csvText},g.companyId,summary.id)
  const c=await component('Scope3FrozenReportView'), app=harness(c.make,()=>({report:frozen,actorId:me,canManage:false,busy:false,onApprove:()=>{},onClose:()=>{}}),c.globals)
  await app.settle()
  expect(app.text()).toContain('read-only.')
  expect(frozen.document.profile).toBe('neuvetra.scope3-report.v2')
  expect(app.nodes().find(node=>node.type===c.globals.Scope3ReportSection)!.props.results).toEqual(d.results)
  app.nodes().find(node=>node.type==='button' && text(node).includes('Download this version'))!.props.onClick()
  expect(c.blob()).toBe(reportApi.scope3ReportExportCsv(g.csvText, summary))
  expect(sha256(c.blob().slice(0, g.csvText.length))).toBe(g.csvSha256)
  expect(sha256(frozen.reportText)).toBe(g.reportSha256)
})
