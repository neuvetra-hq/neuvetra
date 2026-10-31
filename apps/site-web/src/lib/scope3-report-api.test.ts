import { decodeScope3Results } from "@/lib/scope3-results-decode"
// Frozen Scope 3 report versions in the browser (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 7.4, A17;
// assurance-ux M8): the API writes the stored CSV with exactly the labels the Results screen uses; a stored version is
// accepted only when its texts hash to the stored SHA-256 and its document and results decode; the list keeps 0030's
// revision chain and approval rules; prepare and approve send what the screen shows.
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { buildScope3ReportDocument, scope3ReportCsv, scope3ReportText, type Scope3ReportVersionSummary } from "../../../../packages/neuvetra-database/src/scope3-report-document"
import { kindLabel, periodLabel, QUALITY_LABELS, reasonText, shortUnit } from "./plain-language"
import { SCOPE3_CSV_LABELS } from "./scope3-csv-labels"
import { approveScope3Report, decodeScope3Reports, decodeScope3ReportVersion, prepareScope3Report, scope3ReportCsvName, scope3ReportExportCsv, scope3Sha256, SCOPE3_REPORT_PROFILE_V1, SCOPE3_REPORTS_PROFILE } from "./scope3-report-api"
import { scope3Csv, type Scope3ResultsResponse } from "./scope3-results-api"

const fixture: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results.fixture.json", import.meta.url)).json()
const downstream: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results-downstream.fixture.json", import.meta.url)).json()
const company = fixture.companyId
const preparer = "93300000-0000-4000-8000-0000000000a1", approver = "93300000-0000-4000-8000-0000000000a2"
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

function stored(approval: "none" | "self" | "other" = "none") {
  const document = buildScope3ReportDocument({ results: fixture, reportingYear: 2025, revision: 1, setupVersionId: "93300000-0000-4000-8000-0000000000c1", consolidationApproach: "operational_control", preparedBy: preparer, preparedAt: "2026-10-30T10:00:00.000Z", previous: null })
  const reportText = scope3ReportText(document), csvText = scope3ReportCsv(document, SCOPE3_CSV_LABELS)
  const version: Scope3ReportVersionSummary = { id: "93300000-0000-4000-8000-0000000000f1", companyId: company, reportingYear: 2025, revision: 1, previousId: null, setupVersionId: "93300000-0000-4000-8000-0000000000c1", reason: null,
    reportSha256: sha256(reportText), csvSha256: sha256(csvText), engineSha256: fixture.methods[0]!.engineSha256, registerSha256s: fixture.registerSha256s, inputVersionCount: document.inputs.recordVersionIds.length,
    createdBy: preparer, createdAt: "2026-10-30T10:00:01.000Z", openIssues: document.results.readiness!.openIssues,
    // Round 2 (owner decision 7): the fixture has open issues, so an approval acknowledged them; a self-approval was confirmed.
    approval: approval === "none" ? null : { approvedBy: approval === "self" ? preparer : approver, approvedAt: "2026-10-30T11:00:00.000Z", selfApproved: approval === "self", reportSha256: "",
      acknowledgedOpenIssues: document.results.readiness!.openIssues, selfApprovalConfirmed: approval === "self" } }
  if (version.approval) version.approval.reportSha256 = version.reportSha256
  return { document, reportText, csvText, version }
}

describe("round 2 (owner decision 11, ENG-4): a version frozen as v1 keeps opening in the browser", () => {
  test("the committed golden v1 version decodes with the frozen v1 rules, although the live results decoder now refuses its results", async () => {
    const golden = await Bun.file(new URL("../../../../packages/neuvetra-database/src/testdata/scope3-report-v1-golden.json", import.meta.url)).json() as { summary: Record<string, unknown> & { companyId: string; id: string; approval: Record<string, unknown> }; reportText: string; csvText: string }
    const summary = { ...golden.summary, openIssues: [], approval: { ...golden.summary.approval, acknowledgedOpenIssues: null, selfApprovalConfirmed: false } }
    const decoded = await decodeScope3ReportVersion({ profile: SCOPE3_REPORTS_PROFILE, version: summary, reportText: golden.reportText, csvText: golden.csvText }, golden.summary.companyId, golden.summary.id)
    expect(decoded.document.profile).toBe(SCOPE3_REPORT_PROFILE_V1)
    expect(decoded.csvText).toBe(golden.csvText)
    // What I-10 did (the live results decoder on the stored results) would make it unreadable after round 2's own changes.
    expect(() => decodeScope3Results(decoded.document.results, golden.summary.companyId)).toThrow("not recognized")
    // Its exported CSV is the stored bytes, then the approval lines.
    expect(scope3ReportExportCsv(golden.csvText, summary).startsWith(golden.csvText)).toBe(true)
  })
})

describe("frozen Scope 3 report versions in the browser (I-10)", () => {
  test("summary readiness and register provenance must equal the opened frozen document", async () => {
    const s = stored(), body = { profile: SCOPE3_REPORTS_PROFILE, version: s.version, reportText: s.reportText, csvText: s.csvText }
    expect(s.version.openIssues.length).toBeGreaterThan(0)
    await expect(decodeScope3ReportVersion({ ...body, version: { ...s.version, openIssues: [] } }, company, s.version.id)).rejects.toThrow("not recognized")
    await expect(decodeScope3ReportVersion({ ...body, version: { ...s.version, registerSha256s: { invented_register: "e".repeat(64) } } }, company, s.version.id)).rejects.toThrow("not recognized")
    const registers = Object.fromEntries(Object.entries(s.version.registerSha256s).reverse())
    expect((await decodeScope3ReportVersion({ ...body, version: { ...s.version, registerSha256s: registers } }, company, s.version.id)).document).toEqual(s.document)
  })
  test("the API's CSV labels are the Results screen's own, so a stored CSV is the bytes the web would download", () => {
    const inline = { kind: kindLabel, reason: reasonText, period: periodLabel, quality: (code: string) => QUALITY_LABELS[code] ?? code, unit: (code: string) => shortUnit(code) }
    for (const results of [fixture, downstream]) expect(scope3Csv(results, SCOPE3_CSV_LABELS)).toBe(scope3Csv(results, inline))
    const { csvText } = stored()
    expect(csvText.endsWith(scope3Csv(fixture, inline))).toBe(true)
  })

  test("a stored version decodes only when both texts hash to the stored SHA-256 and the document and its results decode", async () => {
    const s = stored("self")
    expect(await scope3Sha256(s.reportText)).toBe(s.version.reportSha256)
    const body = { profile: SCOPE3_REPORTS_PROFILE, version: s.version, reportText: s.reportText, csvText: s.csvText }
    const decoded = await decodeScope3ReportVersion(body, company, s.version.id)
    expect(decoded.csvText).toBe(s.csvText)
    expect(decoded.document.results).toEqual(fixture)
    const refused = async (value: unknown, id = s.version.id) => expect(decodeScope3ReportVersion(value, company, id)).rejects.toThrow("not recognized")
    await refused({ ...body, csvText: s.csvText.replace("Scope 3", "Scope 3 ") })                  // CSV bytes changed
    await refused({ ...body, reportText: s.reportText.replace("15901.5596", "15901.5597") })        // report bytes changed
    const tampered = s.reportText.replace("15901.5596", "15901.5597")
    await refused({ ...body, reportText: tampered, version: { ...s.version, reportSha256: sha256(tampered), approval: { ...s.version.approval!, reportSha256: sha256(tampered) } } }) // re-hashed, but the document no longer matches its results
    await refused(body, "93300000-0000-4000-8000-0000000000f2")                                       // another version
    await refused({ ...body, version: { ...s.version, approval: { ...s.version.approval!, selfApproved: false } } }) // self-approval must be recorded
    await refused({ ...body, version: { ...s.version, approval: { ...s.version.approval!, reportSha256: "e".repeat(64) } } }) // approval bound to another hash
    await refused({ ...body, extra: 1 })
    expect(scope3ReportCsvName(s.version)).toBe(`neuvetra-scope3-report-2025-r1-${s.version.reportSha256.slice(0, 12)}.csv`)
  })

  test("the version list keeps 0030's chain: one year, revisions in order, a reason after the first", () => {
    const one = stored("other").version, two = { ...one, id: "93300000-0000-4000-8000-0000000000f2", revision: 2, previousId: one.id, reason: "Records corrected.", approval: null }
    const list = { profile: SCOPE3_REPORTS_PROFILE, companyId: company, canManage: true, actorId: preparer, setupVersionId: one.setupVersionId, reportingYear: 2025, versions: [one, two] }
    expect(decodeScope3Reports(list, company).versions.map(v => [v.revision, v.approval?.approvedBy ?? null])).toEqual([[1, approver], [2, null]])
    for (const versions of [[two, one], [one, { ...two, previousId: two.id }], [one, { ...two, reason: null }], [{ ...one, reportingYear: 2024 }], [one, { ...two, approval: { approvedBy: preparer, approvedAt: "2026-10-30T11:00:00.000Z", selfApproved: false, reportSha256: two.reportSha256 } }]])
      expect(() => decodeScope3Reports({ ...list, versions }, company)).toThrow()
    expect(() => decodeScope3Reports({ ...list, companyId: "93300000-0000-4000-8000-0000000000ff" }, company)).toThrow()
  })

  test("prepare and approve send what the screen shows and check what was stored", async () => {
    const s = stored(), sent: Array<{ url: string; method: string; body: unknown }> = []
    const reply = (value: unknown, status = 201) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
    const original = globalThis.fetch
    const actor = { accessToken: "token", userId: preparer } as never
    try {
      globalThis.fetch = (async (url: string, init: RequestInit) => { sent.push({ url, method: init.method!, body: JSON.parse(String(init.body)) }); return reply(sent.length === 1 ? { profile: SCOPE3_REPORTS_PROFILE, version: s.version, replayed: false } : { profile: SCOPE3_REPORTS_PROFILE, version: { ...s.version, approval: { approvedBy: preparer, approvedAt: "2026-10-30T11:00:00.000Z", selfApproved: true, reportSha256: s.version.reportSha256, acknowledgedOpenIssues: s.version.openIssues, selfApprovalConfirmed: true } }, replayed: false }) }) as typeof fetch
      const key = crypto.randomUUID()
      expect((await prepareScope3Report(company, { idempotencyKey: key, expectedRevision: 0, reason: null }, actor)).version).toEqual(s.version)
      const approved = await approveScope3Report(company, s.version.id, s.version.reportSha256, actor, { acknowledgeOpenIssues: true, confirmSelfApproval: true })
      expect(approved.version.approval).toMatchObject({ approvedBy: preparer, selfApproved: true })
      expect(sent).toEqual([
        { url: `/workspace-api/workspace/${company}/scope3/reports`, method: "POST", body: { idempotencyKey: key, expectedRevision: 0, reason: null } },
        { url: `/workspace-api/workspace/${company}/scope3/reports/${s.version.id}/approval`, method: "POST", body: { reportSha256: s.version.reportSha256, acknowledgeOpenIssues: true, confirmSelfApproval: true } },
      ])
      // Round 2 (decision 7): the body always carries lane B's two confirmations, exactly as given (both here; the
      // defaults, both false, are checked by lane D's scope3ApprovalBody test).
      // A stored version that isn't what was asked (another revision, or another preparer) is refused.
      globalThis.fetch = (async () => reply({ profile: SCOPE3_REPORTS_PROFILE, version: clone({ ...s.version, createdBy: approver }), replayed: false })) as unknown as typeof fetch
      await expect(prepareScope3Report(company, { idempotencyKey: key, expectedRevision: 0, reason: null }, actor)).rejects.toThrow("not recognized")
      globalThis.fetch = (async () => reply({ code: "report_hash_changed", error: "The report you reviewed is not this stored version." }, 409)) as unknown as typeof fetch
      await expect(approveScope3Report(company, s.version.id, "e".repeat(64), actor)).rejects.toMatchObject({ status: 409, code: "report_hash_changed" })
    } finally { globalThis.fetch = original }
  })
})
