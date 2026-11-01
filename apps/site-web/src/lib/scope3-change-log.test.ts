// Bug hunt D (1 November 2026): the change log of a frozen version in words (screen and print of the opened version).
import { expect, test } from "bun:test"
import { scope3ChangeLogLines } from "./scope3-change-log"
import type { Scope3StoredReportDocument } from "../../../../packages/neuvetra-database/src/scope3-report-document"

const spend = { recordId: "11111111-1111-4111-8111-111111111111", kind: "purchase_spend", sourceId: "INV-1", derivedFrom: null, payload: { description: "Printing" } }
const doc = (changeLog: Record<string, unknown>) => ({
  reportingYear: 2025,
  results: { records: [spend], methods: [] },
  changeLog: { basis: "previous_approved_version", previous: { versionId: "22222222-2222-4222-8222-222222222222", revision: 1, reportSha256: "a".repeat(64), approvedBy: "33333333-3333-4333-8333-333333333333", approvedAt: "2026-10-31T10:00:00.000Z" },
    engine: null, registers: [], methods: { added: [], removed: [] }, factorSources: { added: [], removed: [] }, assessments: [], mappings: [], records: { added: [], removed: [], edited: [] }, categories: [], knownSourceSubtotal: null, ...changeLog },
}) as unknown as Scope3StoredReportDocument

test("a spend mapping change names what changed: a margin-only change never reads as the same mapping on both sides", () => {
  const before = { category: 1, naicsCode: "323111", marginChoice: "with_margins", mappingSource: "file" }
  const after = { ...before, marginChoice: "without_margins" }
  const [, line] = scope3ChangeLogLines(doc({ mappings: [{ recordId: spend.recordId, before, after }] }), null)
  const [left, right] = line!.split(": ").slice(1).join(": ").split(" → ")
  expect(left).not.toBe(right)
  expect(line).toContain("with margins")
  expect(line).toContain("without margins")
  // A mapping-source-only change (file → entered by hand) is named too.
  const [, source] = scope3ChangeLogLines(doc({ mappings: [{ recordId: spend.recordId, before, after: { ...before, mappingSource: "user" } }] }), null)
  const [l2, r2] = source!.split(": ").slice(1).join(": ").split(" → ")
  expect(l2).not.toBe(r2)
})

test("screening and status words in the change log are company setup's (\"Not applicable\", never \"not relevant\")", () => {
  const state = (decision: string) => ({ decision, assessmentId: null, revision: null, reasonCode: null, withinCategoryExclusions: [] })
  const lines = scope3ChangeLogLines(doc({
    assessments: [{ category: 8, before: state("not_relevant"), after: state("included") }],
    categories: [{ category: 8, title: "Upstream leased assets", statusBefore: "not_relevant", statusAfter: "no_records", subtotalBefore: null, subtotalAfter: null }],
  }), null)
  const text = lines.join("\n")
  expect(text).not.toMatch(/not relevant/i)
  expect(text).toContain("Screening of category 8 changed: not applicable → included")
  expect(text).toContain("Category 8: Not applicable (no such activity) no figure → Included, no records no figure")
})
