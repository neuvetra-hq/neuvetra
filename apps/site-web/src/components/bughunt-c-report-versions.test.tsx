/* eslint-disable @typescript-eslint/no-explicit-any -- the injected hook harness drives the real components without a DOM. */
// PR 22 bug hunt C (Claude, 1 November 2026): regressions reproduced live in the web app on the local end-to-end server
// (C1 and C4 loaded from the r4 pack) and fixed in the web files. Each test failed on 4fec227. The Playwright evidence is
// kept outside the repository (scratchpad pr22/c-tools/e2e).
import { describe, expect, test } from "bun:test"
import * as plain from "@/lib/plain-language"
import { harness, loadComponent } from "./component-harness"
import { createHash } from "node:crypto"
import { buildScope3ReportDocument, scope3ReportCsv, scope3ReportText, type Scope3ReportVersionSummary } from "../../../../packages/neuvetra-database/src/scope3-report-document"
import * as reportApi from "@/lib/scope3-report-api"
import * as resultsApi from "@/lib/scope3-results-api"
import { SCOPE3_CSV_LABELS } from "@/lib/scope3-csv-labels"
import * as checklist from "@/lib/scope3-checklist"
import * as resultsText from "@/lib/scope3-results-text"
import * as changeLog from "@/lib/scope3-change-log"

// C-05: opening revision 1 and then revision 2 before revision 1 had loaded showed revision 1 (the late answer won), with
// its Approve button; C-04: a failed version-list read left the panel with no way to try again.

describe("report versions: the last version asked for is the one shown; a failed list read can be retried", async () => {
  const fixture: resultsApi.Scope3ResultsResponse = await Bun.file(new URL("../lib/scope3-results.fixture.json", import.meta.url)).json()
  const company = fixture.companyId, me = "93400000-0000-4000-8000-0000000000a1"
  const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex")
  const doc = buildScope3ReportDocument({ results: fixture, reportingYear: 2025, revision: 1, setupVersionId: "93400000-0000-4000-8000-0000000000c1", consolidationApproach: "operational_control", preparedBy: me, preparedAt: "2026-10-30T10:00:00.000Z", previous: null })
  const reportText = scope3ReportText(doc), csvText = scope3ReportCsv(doc, SCOPE3_CSV_LABELS)
  const version = (extra: Partial<Scope3ReportVersionSummary> = {}): Scope3ReportVersionSummary => ({ id: "93400000-0000-4000-8000-0000000000f1", companyId: company, reportingYear: 2025, revision: 1, previousId: null, setupVersionId: "93400000-0000-4000-8000-0000000000c1", reason: null,
    reportSha256: sha256(reportText), csvSha256: sha256(csvText), engineSha256: fixture.methods[0]!.engineSha256, registerSha256s: fixture.registerSha256s, inputVersionCount: doc.inputs.recordVersionIds.length, createdBy: me, createdAt: "2026-10-30T10:00:01.000Z", openIssues: doc.results.readiness!.openIssues, approval: null, ...extra })
  const v1 = version(), v2 = version({ id: "93400000-0000-4000-8000-0000000000f2", revision: 2, reason: "Second look." })
  const report1 = await reportApi.decodeScope3ReportVersion({ profile: reportApi.SCOPE3_REPORTS_PROFILE, version: v1, reportText, csvText }, company, v1.id)
  const report2 = { ...report1, version: v2 }
  const globals = { Blob: class {}, URL: { createObjectURL: () => "", revokeObjectURL: () => {} }, document: { body: { dataset: {} }, createElement: () => ({}) }, window: { setTimeout: () => 0, print: () => {}, addEventListener: () => {} },
    Icon: () => null, Scope3ReportSection: () => ({ type: "section", props: {}, children: [] }) }
  const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
  const mount = async (inject: Record<string, unknown>) => {
    const make = await loadComponent("./scope3/Scope3ReportVersions.tsx", "Scope3ReportVersions", { ...plain, ...reportApi, ...resultsApi, ...checklist, ...resultsText, ...changeLog, ...globals, ...inject })
    const app = harness(make, () => ({ companyId: company, actor: { accessToken: "t", userId: me } }), globals)
    await app.settle()
    return app
  }
  const view = { companyId: company, canManage: true, actorId: me, setupVersionId: "93400000-0000-4000-8000-0000000000c1", reportingYear: 2025, versions: [v1, v2] }

  test("revision 1 answering after revision 2 never replaces the revision opened last", async () => {
    const pending = new Map<string, ReturnType<typeof deferred<any>>>([[v1.id, deferred()], [v2.id, deferred()]])
    const app = await mount({ loadScope3Reports: async () => view, loadScope3ReportVersion: (_: string, id: string) => pending.get(id)!.promise })
    // The history's Open buttons call its onOpen (Scope3ReportHistory is a node here).
    const history = () => app.nodes().find((node: any) => typeof node.props.onOpen === "function")!
    history().props.onOpen(v1.id); await app.settle()
    history().props.onOpen(v2.id); await app.settle()
    pending.get(v2.id)!.resolve(report2); await app.settle()
    pending.get(v1.id)!.resolve(report1); await app.settle()
    const frozen = app.nodes().find((node: any) => typeof node.props.onApprove === "function")
    expect(frozen?.props.report.version.revision).toBe(2)
  })

  test("a failed version-list read offers Try again, which reads the list again", async () => {
    let reads = 0
    const app = await mount({ loadScope3Reports: async () => { reads++; if (reads === 1) throw new reportApi.Scope3ReportApiError("Report list failed.", 500, null); return view } })
    expect(app.text()).toContain("Report list failed.")
    const retry = app.button("Try again")
    expect(retry).toBeDefined()
    retry!.props.onClick(); await app.settle()
    expect(reads).toBe(2)
    expect(app.text()).not.toContain("Report list failed.")
    expect(app.nodes().some((node: any) => Array.isArray(node.props.versions) && node.props.versions.length === 2)).toBe(true)
  })
})
