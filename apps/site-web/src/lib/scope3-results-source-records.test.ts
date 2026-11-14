// BF-31a (the reader of Scope 3 report profile v4; Claude, 14 November 2026; BF-31 design 5.3 A4/A7, 5.4): the browser
// accepts results whose derived lines carry no payload copy and list each source record version once (`sourceRecords`,
// written from BF-31b), still accepts today's results unchanged, and refuses a mismatch between the two. Every reader of a
// line's `payload` in site-web gives the same answer for both shapes. `scope3-results-source-records.fixture.json` is the
// shared fixture packed with the writer's own rule (generated once; the shared fixtures are not regenerated).
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { buildScope3ReportDocument, scope3ReportCsv, scope3ReportText, type Scope3ReportDocument, type Scope3ReportVersionSummary } from "../../../../packages/neuvetra-database/src/scope3-report-document"
import { scope3PackSourceRecords } from "../../../../packages/neuvetra-database/src/scope3-report-v4"
import { scope3LineAnnotation } from "../../../../packages/neuvetra-database/src/scope3-trace"
import { scope3MethodologyStatement } from "../../../../packages/neuvetra-database/src/scope3-methodology"
import { scope3ChangeLogLines, scope3ChangeLogRecordName } from "./scope3-change-log"
import { scope3Todos } from "./scope3-checklist"
import { SCOPE3_CSV_LABELS } from "./scope3-csv-labels"
import { decodeScope3ReportVersion, SCOPE3_REPORT_PROFILE_V3, SCOPE3_REPORT_PROFILE_V4, SCOPE3_REPORTS_PROFILE } from "./scope3-report-api"
import { scope3Csv, type Scope3ResultsResponse } from "./scope3-results-api"
import { decodeScope3Results } from "./scope3-results-decode"

const fixture: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results.fixture.json", import.meta.url)).json()
const downstream: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results-downstream.fixture.json", import.meta.url)).json()
const packedFixture: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results-source-records.fixture.json", import.meta.url)).json()
const company = fixture.companyId
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")
const activitySha = (versionId: string) => sha256(`synthetic activity ${versionId}`)
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
type Entry = { recordId: string; versionId: string; kind: string; activitySha256: string; facts: Record<string, unknown> }
const packed = () => clone(packedFixture) as Scope3ResultsResponse & { sourceRecords: Entry[] }
const gas = "94000000-0000-4000-8000-000000001009"
const byVersion = (a: { versionId: string }, b: { versionId: string }) => a.versionId < b.versionId ? -1 : a.versionId > b.versionId ? 1 : 0

describe("BF-31a: results with source records (report profile v4's shape)", () => {
  test("the new fixture is the shared fixture packed by the writer's rule; both shapes decode", () => {
    expect(JSON.stringify(scope3PackSourceRecords(clone(fixture), activitySha), null, 2) + "\n").toBe(JSON.stringify(packedFixture, null, 2) + "\n")
    expect(decodeScope3Results(clone(packedFixture), company).sourceRecords).toHaveLength(3)
    // Today's shape, unchanged.
    expect(decodeScope3Results(clone(fixture), company).sourceRecords).toBeUndefined()
    expect(decodeScope3Results(clone(downstream), downstream.companyId).records).toHaveLength(downstream.records.length)
    // A response with no derived lines may list none.
    expect(decodeScope3Results({ ...clone(downstream), sourceRecords: [] }, downstream.companyId).sourceRecords).toEqual([])
  })

  test("refused: a derived line with a payload, a missing, duplicate, orphan or mismatched entry, extra facts", () => {
    const refuse = (mutate: (r: ReturnType<typeof packed>) => void) => { const r = packed(); mutate(r); expect(() => decodeScope3Results(r, company)).toThrow("The Scope 3 results response was not recognized.") }
    refuse(r => { r.records.find(row => row.kind === "td_losses")!.payload = clone(fixture.records.find(row => row.kind === "td_losses")!.payload) })
    refuse(r => { r.records.find(row => row.kind === "fuel_upstream")!.payload = {} })
    refuse(r => { r.sourceRecords = r.sourceRecords.filter(e => e.versionId !== gas) })
    refuse(r => { r.sourceRecords.push(clone(r.sourceRecords[2]!)) })
    refuse(r => { const own = r.records.find(row => row.derivedFrom === null)!; r.sourceRecords.push({ ...clone(r.sourceRecords[0]!), recordId: own.recordId, versionId: own.versionId }); r.sourceRecords.sort(byVersion) })
    refuse(r => { r.sourceRecords[2]!.kind = "vehicle" })
    refuse(r => { r.sourceRecords[2]!.recordId = r.sourceRecords[0]!.recordId })
    refuse(r => { r.sourceRecords[0]!.facts.instruments = [] })
    refuse(r => { r.sourceRecords[0]!.activitySha256 = "not a hash" })
    refuse(r => { (r as Record<string, unknown>).sourceRecords = null })
  })

  test("every site-web reader of a line's payload answers the same for both shapes", () => {
    const r = decodeScope3Results(clone(packedFixture), company), old = decodeScope3Results(clone(fixture), company)
    // Live CSV (the Results screen's download), the to-do list and the methodology statements.
    expect(scope3Csv(r, SCOPE3_CSV_LABELS)).toBe(scope3Csv(old, SCOPE3_CSV_LABELS))
    expect(JSON.stringify(scope3Todos(r))).toBe(JSON.stringify(scope3Todos(old)))
    r.coverage.categories.forEach((row, i) => expect(scope3MethodologyStatement(row, r.records, r.coverage.categories)).toEqual(scope3MethodologyStatement(old.coverage.categories[i]!, old.records, old.coverage.categories)))
    r.records.forEach((row, i) => {
      expect(scope3LineAnnotation(row)).toEqual(scope3LineAnnotation(old.records[i]!))
      expect(scope3ChangeLogRecordName(row)).toBe(scope3ChangeLogRecordName(old.records[i]!))
    })
  })

  test("A4/A7: a stored v4 version opens in the browser (texts re-hashed, its own validator), and its change log against a v3 version shows no false difference", async () => {
    const preparer = "93300000-0000-4000-8000-0000000000a1"
    const build = (results: Scope3ResultsResponse, revision: number, previous: Parameters<typeof buildScope3ReportDocument>[0]["previous"]) => buildScope3ReportDocument({ results, reportingYear: 2025, revision, setupVersionId: "93300000-0000-4000-8000-0000000000c1", consolidationApproach: "operational_control", preparedBy: preparer, preparedAt: "2026-11-14T10:00:00.000Z", previous })
    const summaryOf = (document: Scope3ReportDocument, id: string, previousId: string | null) => {
      const reportText = scope3ReportText(document), csvText = scope3ReportCsv(document, SCOPE3_CSV_LABELS)
      const version: Scope3ReportVersionSummary = { id, companyId: company, reportingYear: 2025, revision: document.revision, previousId, setupVersionId: "93300000-0000-4000-8000-0000000000c1", reason: previousId ? "Report profile v4." : null,
        reportSha256: sha256(reportText), csvSha256: sha256(csvText), engineSha256: fixture.methods[0]!.engineSha256, registerSha256s: fixture.registerSha256s, inputVersionCount: document.inputs.recordVersionIds.length,
        createdBy: preparer, createdAt: "2026-11-14T10:00:01.000Z", openIssues: document.results.readiness!.openIssues,
        approval: { approvedBy: "93300000-0000-4000-8000-0000000000a2", approvedAt: "2026-11-14T11:00:00.000Z", selfApproved: false, reportSha256: sha256(reportText), acknowledgedOpenIssues: document.results.readiness!.openIssues, selfApprovalConfirmed: false } }
      return { reportText, csvText, version }
    }
    const v3 = build(clone(fixture), 1, null), first = summaryOf(v3, "93300000-0000-4000-8000-0000000000f1", null)
    const openedV3 = await decodeScope3ReportVersion({ profile: SCOPE3_REPORTS_PROFILE, ...first }, company, first.version.id)
    expect(openedV3.document.profile).toBe(SCOPE3_REPORT_PROFILE_V3)
    // BF-31b's writer: the packed results, written as v4, compared with the approved v3 version.
    const v4 = { ...build(clone(packedFixture), 2, { summary: first.version, document: openedV3.document }), profile: SCOPE3_REPORT_PROFILE_V4 } as unknown as Scope3ReportDocument
    const second = summaryOf(v4, "93300000-0000-4000-8000-0000000000f2", first.version.id)
    const openedV4 = await decodeScope3ReportVersion({ profile: SCOPE3_REPORTS_PROFILE, ...second }, company, second.version.id)
    expect(openedV4.document.profile).toBe(SCOPE3_REPORT_PROFILE_V4)
    expect(openedV4.reportText).toBe(second.reportText)
    // After the frozen lines, the stored CSV of the v4 version is the live CSV of today's results, byte for byte.
    expect(second.csvText.endsWith(scope3Csv(clone(fixture), SCOPE3_CSV_LABELS))).toBe(true)
    expect(first.csvText.endsWith(scope3Csv(clone(fixture), SCOPE3_CSV_LABELS))).toBe(true)
    expect(second.csvText).toContain("# Change log: no differences.")
    expect(scope3ChangeLogLines(openedV4.document, openedV3.document).join("\n")).toBe(scope3ChangeLogLines({ ...openedV3.document, changeLog: v4.changeLog } as typeof openedV3.document, openedV3.document).join("\n"))
    // A tampered stored v4 text (a payload copy put back on a derived line) is refused even with matching hashes.
    const tampered = JSON.parse(second.reportText); tampered.results.records.find((row: { kind: string }) => row.kind === "td_losses").payload = {}
    const tamperedText = JSON.stringify(tampered)
    await expect(decodeScope3ReportVersion({ profile: SCOPE3_REPORTS_PROFILE, version: { ...second.version, reportSha256: sha256(tamperedText), approval: { ...second.version.approval!, reportSha256: sha256(tamperedText) } }, reportText: tamperedText, csvText: second.csvText }, company, second.version.id))
      .rejects.toThrow("The Scope 3 report response was not recognized.")
  })
})
