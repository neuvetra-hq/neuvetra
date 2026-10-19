// BF1 (Claude, 14 October 2026): the Results CSV, read the way a spreadsheet reads it (RFC 4180; a bare CR, LF or CRLF
// outside quotes ends a row). Header lines must stay one cell each, user text must never start a formula cell, and a
// refused record's reason must reach the Notes column as it does on screen.
import { expect, test } from "bun:test"
import { decodeResults, DRAFT_LABEL, resultsCsv, RESULTS_PROFILE } from "./results-api"
import { periodLabel } from "./plain-language"

const company = "29200000-0000-4000-8000-000000000001"
const ENGINE1 = "6fdcfa3926698250d577df8d456b4d567ec3e9569788f3c96373421276fa36a4", REGISTER = "f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02"
const total = (display: string) => ({ unrounded: display, display, unit: "kg CO2e", rounding: "half_even_4dp" })
const gas = { recordId: "29300000-0000-4000-8000-000000000001", versionId: "29300000-0000-4000-8000-000000000011", revision: 1, kind: "natural_gas", scope: 1, sourceId: "GAS-1", locationId: "29300000-0000-4000-8000-000000000021", locationName: "Office", period: { start: "2025-01-01", endExclusive: "2026-01-01" },
  quantity: { value: "100", unit: "therm" }, quality: "actual", estimateBasis: null, evidenceCount: 0, evidence: [], plan: { action: "calculate", status: null, reasons: [], notes: [] }, periodCheck: "inside", outcome: "calculated",
  inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, refusalCode: null, scope2: null,
  scope1: { methodVersionId: "scope1.stationary.natural_gas.v2", engineSha256: ENGINE1, registerSha256: REGISTER, gwpSetId: "AR5-100", status: "complete", gases: {}, missingGases: [], estimates: [], findings: [], memo: null, factorsUsed: [], total: total("531.1450"), resultSha256: "a".repeat(64) } }
const methods = [{ methodVersionId: "scope1.stationary.natural_gas.v2", scope: 1, engineSha256: ENGINE1, registerSha256: REGISTER, releaseStatus: "unreleased_beta", releaseId: null, releaseLabel: null }]
const response = (extra: Record<string, unknown> = {}) => ({ profile: RESULTS_PROFILE, label: DRAFT_LABEL, syntheticOnly: true, environment: "synthetic_staging", methods, generatedAt: "2026-09-30T00:00:00.000Z", companyId: company,
  setup: { revision: 1, legalName: "Synthetic Co", tradingName: "", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundaryApproach: "operational_control", locations: [] },
  records: [gas], counts: { records: 1, calculated: 1, held: 0, withdrawn: 0, excluded: 0, inputNeeded: 0, outsidePeriod: 0, unavailable: 0 }, warnings: [],
  scope1: { knownSourceSubtotal: total("531.1450"), includedResults: ["a".repeat(64)], incompleteResults: [], notCalculated: [], reportedOutsideScopes: [], resultCount: 1, complete: true }, scope2: null, ...extra })
const labels = { kind: (k: string) => k, reason: (c: string) => c, status: () => "Calculated", boundary: (c: string) => c, period: periodLabel }

/** RFC 4180 reader; a bare CR, LF or CRLF outside quotes ends a row (Excel and LibreOffice behaviour). */
function parse(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = false; else cell += c; continue }
    if (c === '"' && cell === "") quoted = true
    else if (c === ",") { row.push(cell); cell = "" }
    else if (c === "\r" || c === "\n") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = "" }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}
const formulaCells = (rows: string[][]) => rows.flat().filter(cell => /^[=+@]/.test(cell) || /^-[^0-9]/.test(cell))

test("metadata lines stay one cell each (reporting period always contains a comma)", () => {
  const rows = parse(resultsCsv(decodeResults(response(), company), labels))
  const periodRow = rows.find(row => row[0]!.startsWith("# Reporting period"))!
  expect(periodRow).toEqual(["# Reporting period: Jan 1 – Dec 31, 2025"])
})

test("a legal name typed in company setup cannot become a spreadsheet formula", () => {
  const csv = resultsCsv(decodeResults(response({ setup: { ...response().setup, legalName: "Synthetic Co,=HYPERLINK(\"http://evil.example\")" } }), company), labels)
  expect(formulaCells(parse(csv))).toEqual([])
})

test("a coverage note (free text) cannot become a spreadsheet formula", () => {
  const csv = resultsCsv(decodeResults(response(), company), { ...labels, coverage: ["Possible gap (Scope 2): No electricity record for HQ. Site note (04 Locations): landlord pays,=1+1"] })
  expect(formulaCells(parse(csv))).toEqual([])
})

test("a bare CR in a source ID (the collection contract allows CR) does not start a new row", () => {
  const csv = resultsCsv(decodeResults(response({ records: [{ ...gas, sourceId: "GAS-1\r=1+1" }] }), company), labels)
  const rows = parse(csv)
  expect(formulaCells(rows)).toEqual([])
  expect(rows.filter(row => !row[0]!.startsWith("#")).length).toBe(1 + 1 + 3) // header, one record, three subtotal rows
})

import { rowReasons } from "./results-view"
import { reasonText } from "./plain-language"
test("a refused record's reason reaches the CSV, as it does on screen", () => {
  const refused = { ...gas, outcome: "refused", refusalCode: "unsupported_unit", scope1: null, inSubtotal: { scope1: false, scope2LocationBased: false, scope2MarketBased: false } }
  const decoded = decodeResults(response({ records: [refused], methods: [], scope1: null }), company)
  expect(rowReasons(decoded.records[0]!)).toEqual(["This unit isn’t supported for this activity."])
  const rows = parse(resultsCsv(decoded, { ...labels, reason: reasonText }))
  const header = rows.find(row => row[0] === "Scope")!, line = rows[rows.indexOf(header) + 1]!
  expect([line[header.indexOf("Status code")], line[header.indexOf("Notes")]]).toEqual(["refused", "This unit isn’t supported for this activity."])
})
