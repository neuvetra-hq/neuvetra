/** Independent accounting report check. Synthetic fixtures only; no cloud or product writes. */
import { M64_METHOD, M64_LIMITATIONS, type WorksheetVersion } from "../../packages/neuvetra-database/src/m64"
import { buildWorksheetReport } from "../../packages/neuvetra-database/src/m65"
import { DevelopmentWorkspaceDatabase } from "../../packages/neuvetra-database/src/workspace"

const cases = (await Bun.file(new URL("./m65-accounting-cases.json", import.meta.url)).json()).numerical_cases
const requireThat = (value: unknown, label: string) => { if (!value) throw new Error(label) }
const sha = (v: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(v).digest("hex")
const companyId = "10000000-0000-4000-8000-000000000001", owner = "10000000-0000-4000-8000-000000000002", admin = "10000000-0000-4000-8000-000000000003"
const evidence: Record<string, unknown> = { schema_version: 1, kind: "independent_accounting_renderer_verification", runtime: Bun.version, database: "local PGlite; actual application writer/read/report download; no hosted PostgreSQL", direct_renderer_cases: [], persisted_report_cases: [] }
const mandatory = ["Synthetic electricity worksheet report", "Draft · Synthetic · Incomplete · Unreleased · No assurance", "January 1–31, 2023", "United States · California · CAMX", "Operational control · Location-based Scope 2", "Synthetic manual entry — no bill evidence", "An annual 2023 regional average factor is applied to January consumption.", "not approval of this report presentation or assurance", "February–December", "missing coverage is not zero consumption", "Market-based Scope 2 is not included", "Scope 1 and Scope 3 are not assessed", "SRL23!AI6", "AR5 · 100 years · without climate-carbon feedbacks", "half to even; no intermediate rounding", "does not embed its own byte hash", "Browser print/PDF layout and bytes may vary"]
function verifyHtml(bytes: Uint8Array, c: typeof cases[number]) {
  const html = new TextDecoder().decode(bytes)
  requireThat(!/\{\{[a-zA-Z0-9]+\}\}/.test(html), "Unresolved placeholder")
  for (const word of mandatory) requireThat(html.includes(word), `Missing qualification: ${word}`)
  for (const word of [`${c.quantity_kwh} kWh`, `${c.quantity_mwh} MWh`, `${c.total_unrounded_kg_co2e} kg CO2e`, `${c.total_display_kg_co2e} kg CO2e`, M64_METHOD.sourceSha256, M64_METHOD.factorCandidateSha256, M64_METHOD.gwpPolicySha256]) requireThat(html.includes(word), `Missing numeric/provenance: ${word}`)
  requireThat(!/<script\b|<iframe\b|<img\b/i.test(html), "Active resource or executable element")
  requireThat(html.includes('class="print-status print-header"') && html.includes('class="print-status print-footer"'), "Missing print qualification containers")
  return html
}
for (const [i, c] of cases.entries()) {
  for (const state of ["none", "accept_bounded_internal_draft", "changes_requested"] as const) {
    const source: WorksheetVersion = {
      id: `10000000-0000-4000-8000-${String(i + 10).padStart(12, "0")}`, version: i + 1, previousVersionId: i ? "10000000-0000-4000-8000-000000000009" : null,
      companyLabel: 'Fictional <Company> & "Example"', facilityLabel: "Fictional January Facility", quantityKwh: c.quantity_kwh, quantityMwh: c.quantity_mwh, period: "2023-01", geography: "CAMX", unit: "kWh",
      correctionReason: i ? "Synthetic <correction> & {{display}}" : null, inputSha256: sha(`synthetic-input-${i}`), resultSha256: sha(`synthetic-result-${i}`), createdBy: owner, createdAt: "2026-09-14T10:00:00.000Z",
      total: { unrounded: c.total_unrounded_kg_co2e, display: c.total_display_kg_co2e, unit: "kg CO2e", rounding: "half_even_4dp" }, method: M64_METHOD, review: null,
    }
    if (state !== "none") source.review = { id: "10000000-0000-4000-8000-000000000099", versionId: source.id, resultSha256: source.resultSha256, decision: state, note: state === "changes_requested" ? 'Change <script> & "note" {{resultSha256}}' : null, acknowledgedLimitations: state === "accept_bounded_internal_draft" ? [...M64_LIMITATIONS] : [], reviewerId: admin, reviewedAt: "2026-09-14T11:00:00.000Z", decisionSha256: sha(`synthetic-review-${i}-${state}`) }
    const context = { id: "10000000-0000-4000-8000-000000000200", companyId, createdBy: owner, createdAt: "2026-09-14T12:00:00.000Z", source }
    const built = buildWorksheetReport(context), html = verifyHtml(built.bytes, c)
    const expectedState = state === "none" ? "No worksheet review was recorded when this report was created." : state === "accept_bounded_internal_draft" ? "The worksheet version was accepted for bounded internal use." : "A manager requested changes to this worksheet version."
    requireThat(html.includes(expectedState), `Wrong review state: ${state}`)
    requireThat(html.includes("Fictional &lt;Company&gt; &amp; &quot;Example&quot;"), "Label escaping failed")
    if (i) requireThat(html.includes("Synthetic &lt;correction&gt; &amp; &#123;&#123;display&#125;&#125;"), "Correction escaping failed")
    if (state === "changes_requested") requireThat(html.includes("Change &lt;script&gt; &amp; &quot;note&quot; &#123;&#123;resultSha256&#125;&#125;"), "Decision note escaping failed")
    requireThat(built.reportSha256 === sha(built.bytes) && built.reportSha256 === buildWorksheetReport(context).reportSha256, "HTML hash/replay mismatch")
    ;(evidence.direct_renderer_cases as unknown[]).push({ case: c.id, review: state, sha256: built.reportSha256, byte_length: built.bytes.byteLength })
    if (c.id === "board_version4" && state === "none") await Bun.write(new URL("./m65-accounting-v4-fixture.html", import.meta.url), built.bytes)
  }
}

const db = await DevelopmentWorkspaceDatabase.create([owner, admin])
try {
  const w = await db.createWorkspaceWithSyntheticMembers(owner, { companyName: "Synthetic Acme, Inc.", facilityName: "Synthetic California office", countryCode: "US", stateCode: "CA", egridSubregion: "CAMX", reportingYear: 2023, approach: "operational_control" }, [{ userId: admin, role: "admin" }])
  let prior: WorksheetVersion | undefined
  const beforeReports: { id: string; hash: string; bytes: Uint8Array }[] = []
  for (const [i, c] of cases.entries()) {
    const worksheet = await db.saveElectricityWorksheet(owner, w.id, { companyLabel: "Fictional Report Check", facilityLabel: "Fictional January Facility", quantityKwh: c.quantity_kwh, period: "2023-01", geography: "CAMX", unit: "kWh", idempotencyKey: crypto.randomUUID(), ...(prior ? { expectedVersionId: prior.id, expectedResultSha256: prior.resultSha256, correctionReason: "Synthetic correction for independent report check" } : {}) }, Boolean(prior))
    prior = worksheet.versions.at(-1)!
    requireThat(prior.total.unrounded === c.total_unrounded_kg_co2e && prior.total.display === c.total_display_kg_co2e, `Stored source mismatch ${c.id}`)
    const input = { sourceVersionId: prior.id, expectedInputSha256: prior.inputSha256, expectedResultSha256: prior.resultSha256, expectedReviewId: null, expectedReviewSha256: null, idempotencyKey: crypto.randomUUID() }
    const report = await db.createWorksheetReport(owner, w.id, input), downloaded = await db.downloadWorksheetReport(owner, w.id, report.id)
    requireThat(downloaded && report.reviewState === "unreviewed", "Absent review not captured")
    verifyHtml(downloaded!.bytes, c)
    beforeReports.push({ id: report.id, hash: report.reportSha256, bytes: downloaded!.bytes })
    const decision = i % 2 ? "changes_requested" : "accept_bounded_internal_draft"
    const after = await db.reviewElectricityWorksheet(admin, w.id, { versionId: prior.id, expectedResultSha256: prior.resultSha256, decision, note: decision === "changes_requested" ? "Recheck synthetic transcription." : null, acknowledgedLimitations: decision === "changes_requested" ? [] : [...M64_LIMITATIONS], idempotencyKey: crypto.randomUUID() })
    prior = after.versions.at(-1)!
    const reviewed = await db.createWorksheetReport(owner, w.id, { ...input, expectedReviewId: prior.review!.id, expectedReviewSha256: prior.review!.decisionSha256, idempotencyKey: crypto.randomUUID() })
    requireThat(reviewed.id !== report.id && reviewed.reportSha256 !== report.reportSha256, "Later worksheet decision reused earlier report")
    const reviewedBytes = (await db.downloadWorksheetReport(owner, w.id, reviewed.id))!.bytes
    const reviewedHtml = verifyHtml(reviewedBytes, c)
    requireThat(reviewedHtml.includes(decision === "changes_requested" ? "A manager requested changes" : "accepted for bounded internal use"), "Wrong captured decision")
    ;(evidence.persisted_report_cases as unknown[]).push({ case: c.id, unreviewed_report_sha256: report.reportSha256, reviewed_report_sha256: reviewed.reportSha256, decision })
  }
  for (const previous of beforeReports) {
    const reopened = await db.downloadWorksheetReport(owner, w.id, previous.id)
    requireThat(reopened?.report.reportSha256 === previous.hash && Buffer.from(reopened.bytes).equals(Buffer.from(previous.bytes)) && reopened.report.reviewState === "unreviewed", "Historical report changed after decisions/corrections")
  }
  evidence.immutable_unreviewed_reports_reopened_after_later_reviews_and_corrections = beforeReports.length
} finally { await db.close() }
evidence.visual_print_inspection = "not performed; root/QA owns actual rendered print check"
evidence.authored_product_code = false
evidence.source_artifact_hashes = Object.fromEntries(await Promise.all(["packages/neuvetra-database/src/m65.ts", "packages/neuvetra-database/src/m65-template.ts", "packages/neuvetra-database/src/m65-contract.ts", "packages/neuvetra-database/src/migrations/0011_worksheet_reports.sql"].map(async p => [p, sha(new Uint8Array(await Bun.file(new URL(`../../${p}`, import.meta.url)).arrayBuffer()))])))
await Bun.write(new URL("./m65-accounting-renderer-results.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify({ direct_renderer_cases: (evidence.direct_renderer_cases as unknown[]).length, persisted_reports: (evidence.persisted_report_cases as unknown[]).length * 2, historical_reports_unchanged: evidence.immutable_unreviewed_reports_reopened_after_later_reviews_and_corrections }))
