/* eslint-disable @typescript-eslint/no-explicit-any -- tests mutate decoded fixtures freely. */
// Round 3 lane C (PR-3; Claude, 31 October 2026): after a spend import the to-do list holds one item per hold reason for
// the imported lines (not one per line), each opening the spend import's grouped review at the right tab; the category row
// offers the same; the Overview's next step and its attention list name the spend import instead of one line.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import type { Scope3ResultsResponse } from "./scope3-results-api"
import { scope3CategoryAction, scope3Todos } from "./scope3-checklist"
import { computeJourneyStatus } from "./journey-status"
import { requestSpendImportFocus, spendAmountSum, takeSpendImportFocus } from "./spend-import-target"

const fixture: Scope3ResultsResponse = JSON.parse(readFileSync(new URL("./scope3-results.fixture.json", import.meta.url), "utf8"))

function withImportedSpend(): Scope3ResultsResponse {
  const results = structuredClone(fixture) as any
  const held = results.records.find((row: any) => row.sourceId === "W-2")
  const spend = (n: number, vendor: string, account: string, amount: string, reasons: string[], unit = "USD") => ({ ...structuredClone(held), recordId: `93950000-0000-4000-8000-${String(n).padStart(12, "0")}`, kind: "purchase_spend", category: 1, sourceId: `AP-${n}`,
    quantity: { value: amount, unit }, plan: { ...held.plan, reasons }, payload: { importId: "93950000-0000-4000-8000-0000000000a1", supplierName: vendor, glAccount: account } })
  results.records.push(spend(1, "Grainger", "6110", "100.5", ["naics_code_required"]), spend(2, "GRAINGER", "6110", "200", ["naics_code_required"]), spend(3, "Uline", "5030", "1000", ["naics_code_required"]),
    spend(4, "Bosch GmbH", "5040", "700", ["currency_not_supported", "naics_code_required"], "EUR"), spend(5, "Uline", "5030", "50", ["possible_duplicate_spend_line"]))
  return results
}

describe("the to-do list after a spend import", () => {
  test("one item per hold reason, with the lines, vendor groups and US dollars, opening the spend import at its tab; other records stay one item each", () => {
    const todos = scope3Todos(withImportedSpend())
    const spend = todos.filter(item => item.kind === "spend")
    expect(spend.map(item => [item.title, item.lines, item.actions])).toEqual([
      ["Map 3 imported spend lines (2 vendor groups, $1,300.50) in the spend import", 3, [{ type: "spend", tab: "code", label: "Open the spend import" }]],
      [expect.stringMatching(/^1 imported spend line: /), 1, [{ type: "spend", tab: "other", label: "Open the spend import" }]],
      [expect.stringMatching(/^1 imported spend line: /), 1, [{ type: "spend", tab: "duplicates", label: "Open the spend import" }]],
    ])
    expect(todos.some(item => item.kind === "line" && item.title.includes("AP-"))).toBe(false)
    expect(todos.filter(item => item.kind === "line").map(item => item.title).sort()).toEqual(["Freight transport · =HYPERLINK(\"x\")", "Waste · W-2"].sort())
  })
  test("a category whose open lines are all imported spend offers the spend import on its row", () => {
    const results = withImportedSpend()
    const todos = scope3Todos(results)
    const row = { ...results.coverage.categories.find(c => c.category === 1)!, status: "input_needed" } as any
    expect(scope3CategoryAction(row, todos)).toEqual({ type: "spend", tab: "code", label: "Map 5 spend lines" })
  })
  test("a focus request is taken once; amounts are summed exactly", () => {
    requestSpendImportFocus("other")
    expect(takeSpendImportFocus()).toBe("other")
    expect(takeSpendImportFocus()).toBeNull()
    expect(spendAmountSum(["100.5", "200", "1000.005"])).toBe("$1,300.50")
  })
})

describe("the Overview after a spend import", () => {
  const record = (id: string, kind: string, payload: Record<string, unknown>) => ({ id, kind, currentVersion: { activity: { kind, state: "active", sourceId: id, locationId: "loc", setupVersionId: "s", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, quantity: { originalValue: "10", originalUnit: "USD", normalizedValue: "10", normalizedUnit: "USD" }, quality: "actual", estimateBasis: null, reference: "", notes: "", evidenceIds: [], withdrawalReason: null, payload } } })
  test("the next step opens the spend import (not one line) and names the other records still needing input", () => {
    const setup = { currentVersion: { revision: 1, setup: { company: { legalName: "Acme" }, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: { approach: "operational_control" }, locations: [{ id: "loc", name: "Plant", inclusion: "included" }], screening: [] } } } as any
    const context = { setupVersionId: "s", setupRevision: 1, locations: [{ id: "loc", name: "Plant", inclusion: "included", control: "reporting_company" }] } as any
    // A spend line with no code needs input on the Activity screen's own readiness rules; so does the bare natural gas record.
    const records = [record("AP-1", "purchase_spend", { importId: "i1", category: 1, naicsCode: null }), record("AP-2", "purchase_spend", { importId: "i1", category: 1, naicsCode: null })] as any
    const status = computeJourneyStatus({ setup, context, records, evidence: [], canManage: true, scope3: true })
    const flagged = status.collection.records.filter(row => row.state === "input_needed" || row.state === "review_required")
    expect(flagged.length).toBeGreaterThan(0)
    expect(flagged.every(row => row.importedSpend)).toBe(true)
    expect(status.next).toMatchObject({ panel: "collection", title: `Review ${flagged.length} imported spend line${flagged.length === 1 ? "" : "s"} in the spend import`, action: "Open the spend import", spendImport: true })
    expect(status.next.recordId).toBeUndefined()
  })
})
