/** Independent bounded rendering/decoder check; synthetic fixture records, no database/cloud. */
import { M64_METHOD } from "../../packages/neuvetra-database/src/m64-contract"
import { M66_PROFILE, M66_LIMITATIONS, type SourceWorksheetVersion } from "../../packages/neuvetra-database/src/m66-contract"
import { M66_SOURCE_FIXTURES } from "../../packages/neuvetra-database/src/m66-fixtures"
import { buildSourceWorksheetReport } from "../../packages/neuvetra-database/src/m66-report"
import { decodeSourceElectricityWorksheet } from "../../apps/site-web/src/lib/m66-api"
const evidence = await Bun.file(new URL("./m66-accounting-cases.json", import.meta.url)).json()
const must = (v: unknown, label: string) => { if (!v) throw new Error(label) }
const hash = (text: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(text).digest("hex")
const owner = "10000000-0000-4000-8000-000000000001", manager = "10000000-0000-4000-8000-000000000002", company = "10000000-0000-4000-8000-000000000003"
function makeVersion(c: typeof evidence.numerical_cases[number], fixtureIndex: number): SourceWorksheetVersion {
  const f = M66_SOURCE_FIXTURES[fixtureIndex]!
  const expected = fixtureIndex ? evidence.source_B : evidence.source_A
  must(f.sha256 === expected.sha256 && f.byteLength === expected.bytes && f.printedQuantityKwh === expected.printed_quantity_kwh, "Fixture pin changed")
  return { id: "10000000-0000-4000-8000-000000000010", version: 1, previousVersionId: null, companyLabel: "Fictional <Company>", facilityLabel: "Fictional Facility", quantityKwh: c.quantity_kwh, quantityMwh: c.quantity_mwh, period: "2023-01", geography: "CAMX", unit: "kWh", correctionReason: null, inputSha256: hash(`input-${c.id}-${fixtureIndex}`), resultSha256: hash(`result-${c.id}-${fixtureIndex}`), createdBy: owner, createdAt: "2026-09-14T12:00:00.000Z", total: { unrounded: c.unrounded_kg_co2e, display: c.display_kg_co2e, unit: "kg CO2e", rounding: "half_even_4dp" }, method: M64_METHOD, review: null, evidence: { page: 1, confirmedBy: owner, confirmedAt: "2026-09-14T12:00:00.000Z", quantityDifferenceReason: c.require_discrepancy_reason ? "Synthetic <difference> & manual selection" : null, source: { ...f, id: `10000000-0000-4000-8000-00000000000${fixtureIndex + 4}`, companyId: company, mediaType: "application/pdf", uploadedBy: owner, uploadedAt: "2026-09-14T11:00:00.000Z" } } }
}
const results: unknown[] = []
function check(v: SourceWorksheetVersion, id: string) {
  const context = { id: "10000000-0000-4000-8000-000000000020", companyId: company, createdBy: owner, createdAt: "2026-09-14T14:00:00.000Z", source: v }
  const built = buildSourceWorksheetReport(context), html = new TextDecoder().decode(built.bytes)
  const mandatory = ["January location-based subtotal", `${v.quantityKwh} kWh`, `${v.quantityMwh} MWh`, `${v.total.unrounded} kg CO2e`, `${v.total.display} kg CO2e`, "12345.000 kWh", v.evidence.source.sha256, String(v.evidence.source.byteLength), "Page 1", v.evidence.confirmedBy, v.evidence.confirmedAt, "Fictional &lt;Company&gt;", "No automated extraction or assurance is provided", "does not authenticate the fictional bill", "not approval of this report presentation or assurance", "Draft · Synthetic · Incomplete · Unreleased · No assurance", "February–December", "missing coverage is not zero consumption", "half to even; no intermediate rounding", "SRL23!AI6", "195.0402888 kg CO2e/MWh", "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356", "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5"]
  for (const text of mandatory) must(html.includes(text), `${id}: missing ${text}`)
  must(!html.includes("no bill evidence") && !/\{\{[a-zA-Z0-9]+\}\}/.test(html) && !/<script\b/i.test(html), `${id}: stale or unsafe output`)
  must(html.includes(v.evidence.quantityDifferenceReason ? "Manual worksheet quantity differs from the bill: Synthetic &lt;difference&gt; &amp; manual selection" : "matches the printed fictional bill quantity; this is not independent verification."), `${id}: agreement/discrepancy wording`)
  const reviewText = !v.review ? "No worksheet review was recorded when this report was created." : v.review.decision === "accept_bounded_internal_draft" ? "accepted for bounded internal use" : "A manager requested changes"
  must(html.includes(reviewText), `${id}: captured decision`)
  must(built.reportSha256 === hash(built.bytes) && built.reportSha256 === buildSourceWorksheetReport(context).reportSha256, `${id}: byte hash`)
  results.push({ case: id, sha256: built.reportSha256, bytes: built.bytes.byteLength })
}
for (const c of evidence.numerical_cases) for (const f of [0, 1]) check(makeVersion(c, f), `${c.id}-${f ? "B" : "A"}`)
for (const decision of ["accept_bounded_internal_draft", "changes_requested"] as const) {
  const v = makeVersion(evidence.numerical_cases[2], 0)
  v.review = { id: "10000000-0000-4000-8000-000000000030", versionId: v.id, resultSha256: v.resultSha256, decision, note: decision === "changes_requested" ? "Correct synthetic entry." : null, acknowledgedLimitations: decision === "changes_requested" ? [] : [...M66_LIMITATIONS], reviewerId: manager, reviewedAt: "2026-09-14T13:00:00.000Z", decisionSha256: hash(decision) }
  check(v, decision)
}
const first = makeVersion(evidence.numerical_cases[2], 0)
const second: SourceWorksheetVersion = { ...structuredClone(first), id: "10000000-0000-4000-8000-000000000011", version: 2, previousVersionId: first.id, createdAt: "2026-09-14T13:00:00.000Z", correctionReason: "Corrected the explanation only.", inputSha256: hash("second-input"), resultSha256: hash("second-result") }
second.evidence.confirmedAt = second.createdAt
second.evidence.quantityDifferenceReason = "Revised synthetic difference explanation."
const worksheet = { profile: M66_PROFILE, companyId: company, synthetic: true, complete: false, releaseEligible: false, assurance: "none", limitations: [...M66_LIMITATIONS], versions: [first, second] }
must(decodeSourceElectricityWorksheet(worksheet, company).versions.length === 2, "Reason-only correction rejected by frontend")
const sourcePaths = ["packages/neuvetra-database/src/m66-template.ts", "packages/neuvetra-database/src/m66-report.ts", "apps/site-web/src/components/SourceElectricityWorksheet.tsx", "apps/site-web/src/lib/m66-api.ts"]
const pins = Object.fromEntries(await Promise.all(sourcePaths.map(async p => [p, hash(new Uint8Array(await Bun.file(new URL(`../../${p}`, import.meta.url)).arrayBuffer()))])))
await Bun.write(new URL("./m66-accounting-wording-results.json", import.meta.url), JSON.stringify({ schema_version: 1, runtime: Bun.version, rendered_cases: results, reason_only_correction_actual_frontend_decoder: "pass", source_artifact_raw_sha256: pins, scope: "direct actual renderer and frontend decoder with synthetic records; no SQL/cloud/browser/print execution" }, null, 2) + "\n")
console.log(JSON.stringify({ rendered: results.length, reason_only_correction_decoder: "pass" }))
