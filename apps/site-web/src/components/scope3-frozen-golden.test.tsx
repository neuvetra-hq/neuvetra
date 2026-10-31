// Round 3 lane D (EN-4, decision 5, PR-9; Claude, 31 October 2026): the committed golden v1 version, and a v2 version built
// from the fixture, rendered by React through the real frozen view (`Scope3FrozenReportView`, which renders the real
// `Scope3ReportSection`; nothing is stubbed). The view must keep opening every stored version after any later edit to the
// components, their helpers or the text maps, and must show the values the version stored: its assertion, its totals (t
// to 2 decimals from the stored exact kg, beside it), its methodology and disclosure sentences, its lines, and its stored
// data-quality label (v1 stored the engine's label; v2 stores the capped label).
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { renderToStaticMarkup } from "react-dom/server"
import { Scope3FrozenReportView } from "./scope3/Scope3ReportVersions"
import { decodeScope3ReportVersion, SCOPE3_REPORT_PROFILE_V1, SCOPE3_REPORT_PROFILE_V2, SCOPE3_REPORTS_PROFILE, type Scope3FrozenReport } from "@/lib/scope3-report-api"
import type { Scope3ResultsResponse } from "@/lib/scope3-results-api"
import { groupDigits } from "@/lib/plain-language"
import { scope3Tonnes } from "@/lib/scope3-checklist"
import type { Scope3ReportDocumentV2 } from "../../../../packages/neuvetra-database/src/scope3-report-v2"

type Golden = { summary: Record<string, unknown> & { companyId: string; id: string; reportSha256: string; approval: Record<string, unknown> }; reportText: string; csvText: string }
const golden = await Bun.file(new URL("../../../../packages/neuvetra-database/src/testdata/scope3-report-v1-golden.json", import.meta.url)).json() as Golden
const decode = (entities: string) => entities.replace(/<[^>]+>/g, " ").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ")
const render = (report: Scope3FrozenReport) => decode(renderToStaticMarkup(<Scope3FrozenReportView report={report} actorId="93100000-0000-4000-8000-0000000000a9" canManage={false} busy={false} onApprove={() => {}} onClose={() => {}} />))
const squash = (value: string) => value.replace(/\s+/g, " ").trim()
type StoredCategory = { category: number; title: string; methodology: Array<{ text: string }>; profile: { dataQuality: { overall: { label: string | null; score: { display: string } | null } } } | null; dataQualityLabel?: { label: string | null; capped: boolean } }

async function goldenV1(): Promise<Scope3FrozenReport> {
  const summary = { ...golden.summary, openIssues: [], approval: { ...golden.summary.approval, acknowledgedOpenIssues: null, selfApprovalConfirmed: false } }
  return decodeScope3ReportVersion({ profile: SCOPE3_REPORTS_PROFILE, version: summary, reportText: golden.reportText, csvText: golden.csvText }, golden.summary.companyId, golden.summary.id)
}

/** What every stored version must show, read from the stored document itself (never from live code). */
function expectStoredValues(shown: string, report: Scope3FrozenReport) {
  const stored = JSON.parse(report.reportText) as { assertion: { statement: string; legalName: string; totals: Array<{ category: number; subtotalKg: string | null; subtotalTonnes: string | null }>; knownSourceSubtotal: { kg: string } | null }; results: { coverage: { categories: StoredCategory[]; disclosures: Array<{ text: string }> }; records: Array<{ sourceId: string; result: { total: { display: string } | null } | null }> } }
  expect(shown).toContain(squash(stored.assertion.statement))
  expect(shown).toContain(report.version.reportSha256)
  // PR-9: one period after the company name, whatever it ends with.
  expect(shown).toContain(`Company: ${stored.assertion.legalName}${/[.!?]$/.test(stored.assertion.legalName) ? "" : "."} Consolidation approach:`)
  // PR-9: t to 2 decimals from the stored exact kg, which is shown beside it; never the stored 7-decimal tonnes.
  for (const row of stored.assertion.totals.filter(item => item.subtotalKg)) {
    expect(shown).toContain(` ${scope3Tonnes(row.subtotalKg)} ${groupDigits(row.subtotalKg!)} `)
    if (row.subtotalTonnes!.split(".")[1]!.length > 2) expect(shown).not.toContain(groupDigits(row.subtotalTonnes!))
  }
  expect(shown).toContain(`${scope3Tonnes(stored.assertion.knownSourceSubtotal!.kg)} t CO2e (${groupDigits(stored.assertion.knownSourceSubtotal!.kg)} kg CO2e)`)
  for (const row of stored.results.coverage.categories) for (const sentence of row.methodology) expect(shown).toContain(squash(sentence.text))
  for (const item of stored.results.coverage.disclosures) expect(shown).toContain(squash(item.text))
  for (const line of stored.results.records) { expect(shown).toContain(line.sourceId); if (line.result?.total) expect(shown).toContain(groupDigits(line.result.total.display)) }
  return stored
}

describe("EN-4: stored versions render through the real frozen view", () => {
  test("the committed golden v1 version opens, shows its stored values, and its stored (pre-cap) data-quality labels, saying so", async () => {
    const report = await goldenV1()
    expect(report.document.profile).toBe(SCOPE3_REPORT_PROFILE_V1)
    const shown = render(report)
    const stored = expectStoredValues(shown, report)
    expect(shown).toContain("Scope 3 report · reporting year 2025 · revision 1 (frozen)")
    // v1 has no capped label: each profiled category shows the label it stored, and the view says the labels are as stored.
    for (const row of stored.results.coverage.categories.filter(item => item.profile)) {
      expect(row.dataQualityLabel).toBeUndefined()
      expect(shown).toContain(`${row.category}. ${row.title}`)
    }
    expect(shown).toContain("This version was stored before data-quality labels were capped")
    expect(shown).not.toContain("(capped)")
    expect(shown).not.toContain("webfetch_double_read")
  })

  test("a v2 version shows its stored capped label (decision 5) and the same stored values", async () => {
    // Load the untouched delivery's stored bytes, never generate an old version with today's writer.
    const bytes = await Bun.file(new URL("../../../../packages/neuvetra-database/src/testdata/scope3-report-v2-golden.json", import.meta.url)).bytes()
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("afe721888ac7f8b5ec5bcec0096756045bc3825cf03697be7bc2f9a88398ad0f")
    const { reportText, csvText } = JSON.parse(new TextDecoder().decode(bytes)) as { reportText: string; csvText: string }
    const document = JSON.parse(reportText) as Scope3ReportDocumentV2
    const fixture = document.results as Scope3ResultsResponse
    const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")
    const version = { id: "93400000-0000-4000-8000-0000000000f1", companyId: fixture.companyId, reportingYear: document.reportingYear, revision: document.revision, previousId: null, setupVersionId: document.inputs.setupVersionId, reason: null,
      reportSha256: sha256(reportText), csvSha256: sha256(csvText), engineSha256: fixture.methods[0]!.engineSha256, registerSha256s: fixture.registerSha256s, inputVersionCount: document.inputs.recordVersionIds.length, createdBy: document.assertion.preparedBy, createdAt: document.assertion.preparedAt, openIssues: document.results.readiness!.openIssues, approval: null }
    const report = await decodeScope3ReportVersion({ profile: SCOPE3_REPORTS_PROFILE, version, reportText, csvText }, fixture.companyId, version.id)
    expect(report.document.profile).toBe(SCOPE3_REPORT_PROFILE_V2)
    const shown = render(report)
    const stored = expectStoredValues(shown, report)
    const capped = stored.results.coverage.categories.filter(item => item.dataQualityLabel?.capped)
    expect(capped.length).toBeGreaterThan(0)
    expect(shown.split("fair (capped) — Capped at fair because").length - 1).toBe(capped.length)
    expect(shown).not.toContain("This version was stored before data-quality labels were capped")
  })
})
