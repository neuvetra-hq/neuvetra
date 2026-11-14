/* eslint-disable @typescript-eslint/no-explicit-any -- test data: tampered copies of the route's JSON shapes. */
// Spend CSV import client (Scope 3 completion I-09; Claude, 30 October 2026; DESIGN 7.3): the strict decoders accept the
// route's shapes and refuse every mutation (keys, ids, a reconciliation flag that does not add up, lines that belong to no
// import, a calculated line with reasons or a held line without, recounted holds); the queues read from decoded lines.
import { describe, expect, test } from "bun:test"
import * as api from "./scope3-spend-import-api"

const company = "93910000-0000-4000-8000-000000000001", other = "93910000-0000-4000-8000-000000000002"
const imp1 = "93910000-0000-4000-8000-0000000000a1", imp2 = "93910000-0000-4000-8000-0000000000a2"
const rec = (n: number) => `93910000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`
const ver = (n: number) => `93910000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`
const user = "93910000-0000-4000-8000-0000000000ff", loc = "93910000-0000-4000-8000-0000000000b1", setup = "93910000-0000-4000-8000-0000000000c1", supplier = "93910000-0000-4000-8000-0000000000d1"
const sha = (c: string) => c.repeat(64)
const at = "2025-06-01T00:00:00.000Z"
const importOf = (id: string, file: string, records: number[], totals: Record<string, string>, nonNumeric = 0) => ({
  id, companyId: company, reportingYear: 2025, fileSha256: sha(file), fileName: `${file}.csv`, evidenceId: `93910000-0000-4000-8000-0000000000e${file}`, locationId: loc, setupVersionId: setup,
  rowCount: records.length, fileTotals: totals, nonNumericRows: nonNumeric, createdBy: user, createdAt: at,
  lines: records.map((n, i) => ({ row: i + 1, recordId: rec(n), lineFingerprint: sha(String(n % 10)) })),
  reconciliation: { reconciled: true, nonNumericRows: { file: nonNumeric, imported: nonNumeric }, currencies: Object.entries(totals).map(([currency, total]) => ({ currency, fileTotal: total, importedTotal: total, lines: records.length - nonNumeric, matches: true })) },
})
const line = (n: number, importId: string, row: number, extra: Record<string, unknown> = {}) => ({
  recordId: rec(n), versionId: ver(n), revision: 1, importId, importRow: row, sourceId: `L${n}`, state: "active", amount: "100", currency: "USD", category: 1, naicsCode: "722320", marginChoice: "with_margins",
  mappingSource: "file", mappingKeySha256: sha("7"), glAccount: "6300", vendor: "Cater", description: "Lunch", lineDate: "2025-03-01", possibleDuplicateOf: null, duplicateConfirmedDistinct: false,
  categoryConfirmed: false, activityOverlap: "unknown", plan: { action: "calculate", status: null, reasons: [] }, supersededBy: null, glDescription: "", conversion: null, ...extra,
})
function fixture() {
  return {
    profile: api.SCOPE3_SPEND_IMPORTS_PROFILE, companyId: company, canManage: true, setupVersionId: setup, reportingYear: 2025, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" },
    locations: [{ id: loc, name: "HQ" }],
    imports: [importOf(imp1, "1", [1, 2, 3], { USD: "300" }), importOf(imp2, "2", [4, 5], { USD: "200" })],
    mappings: [{ id: "93910000-0000-4000-8000-0000000000f1", companyId: company, mappingKeySha256: sha("8"), glAccount: "6310", vendor: "Events", description: "Venue", category: 1, naicsCode: "711310", marginChoice: "with_margins", revision: 1, createdBy: user, createdAt: at }],
    lines: [
      line(1, imp1, 1), line(2, imp1, 2, { supersededBy: supplier, plan: { action: "hold", status: "excluded", reasons: ["superseded_by_supplier_record"] } }),
      line(3, imp1, 3, { mappingSource: "unmatched", naicsCode: null, vendor: "Events", glAccount: "6310", description: "Venue", mappingKeySha256: sha("8"), plan: { action: "hold", status: "input_needed", reasons: ["naics_code_required"] } }),
      line(4, imp2, 1, { possibleDuplicateOf: { importId: imp1, row: 1 }, plan: { action: "hold", status: "input_needed", reasons: ["possible_duplicate_spend_line"] } }),
      line(5, imp2, 2, { mappingSource: "unmatched", naicsCode: null, vendor: "Events", glAccount: "6310", description: "Venue", mappingKeySha256: sha("8"), plan: { action: "hold", status: "input_needed", reasons: ["naics_code_required"] } }),
    ],
    superseded: [{ spendRecordId: rec(2), supersededBy: supplier, supplierName: "Cater", kind: "purchase_supplier", spendSourceId: "L2", spendDescription: "Lunch", spendAmount: "100", spendCurrency: "USD" }],
    superseders: [{ recordId: supplier, kind: "purchase_supplier", sourceId: "SUP-1", name: "Cater", category: 1, quantity: "0.5", unit: "metric_ton CO2e", basis: "allocated_total", factorValue: null, factorUnit: null, allocationNumerator: null, allocationDenominator: null }],
  }
}
const copy = () => structuredClone(fixture()) as any

describe("spend import decoders (I-09)", () => {
  test("the route's shape decodes; the queues read from it", () => {
    const view = api.decodeScope3SpendImports(fixture(), company)
    expect(view.imports.map(i => i.id)).toEqual([imp1, imp2])
    const groups = api.scope3SpendUnmatchedGroups(view)
    expect(groups.map(g => [g.vendor, g.lines.map(l => l.recordId), g.reasons, g.mapping?.naicsCode])).toEqual([["Events", [rec(3), rec(5)], ["naics_code_required"], "711310"]])
    const pairs = api.scope3SpendDuplicatePairs(view)
    expect(pairs.map(p => [p.line.recordId, p.earlier?.recordId, p.earlierFile])).toEqual([[rec(4), rec(1), "1.csv"]])
    expect(api.scope3SpendSupersessionBySupplier(view)).toEqual([{ supplierName: "Cater", supersededBy: supplier, spendRecordIds: [rec(2)] }])
    // BF-12: the vendor-key flag decodes when present (true), and is absent otherwise.
    expect(view.superseded[0]!.vendorKeyMatch).toBeUndefined()
    const flagged = copy(); flagged.superseded[0].vendorKeyMatch = true
    expect(api.decodeScope3SpendImports(flagged, company).superseded[0]!.vendorKeyMatch).toBe(true)
    expect(api.scope3SpendMappingBody(groups[0]!, { category: 1, naicsCode: "711320", marginChoice: "with_margins", categoryConfirmed: true, activityOverlapConfirmed: null }))
      .toEqual({ expectedRevision: 1, mapping: { glAccount: "6310", vendor: "Events", description: "Venue", category: 1, naicsCode: "711320", marginChoice: "with_margins" }, categoryConfirmed: true, activityOverlapConfirmed: null })
    // A confirmed-distinct or withdrawn line leaves the duplicate queue; a mapped line leaves the unmatched queue.
    const next = copy(); next.lines[3].duplicateConfirmedDistinct = true; next.lines[3].plan = { action: "calculate", status: null, reasons: [] }
    expect(api.scope3SpendDuplicatePairs(api.decodeScope3SpendImports(next, company))).toEqual([])
  })

  // BF-12b (QA F-2): a field this page doesn't know (a later release's additive field) never makes it refuse the whole
  // response, at any level; the decoded value never carries it.
  test("unknown extra fields are ignored at every level and never copied", () => {
    const v = copy()
    v.extra = 1; v.imports[0].extra = 1; v.imports[0].lines[0].extra = 1; v.imports[0].reconciliation.extra = 1; v.mappings[0].extra = 1
    v.lines[0].extra = 1; v.lines[1].plan.extra = 1; v.superseded[0].extra = 1; v.superseders[0].extra = 1; v.locations[0].extra = 1; v.reportingPeriod.extra = 1
    const decoded = api.decodeScope3SpendImports(v, company)
    expect(decoded).toEqual(api.decodeScope3SpendImports(fixture(), company))
    expect(JSON.stringify(decoded)).not.toContain("extra")
    // The refusal is a typed error, so the spend import can offer the reload notice.
    const bad = copy(); bad.profile = "x"
    expect(() => api.decodeScope3SpendImports(bad, company)).toThrow(api.Scope3SpendResponseUnrecognized)
  })

  test("every mutation is refused", () => {
    const cases: Array<[string, (v: any) => void]> = [
      ["profile", v => { v.profile = "x" }], ["company", v => { v.companyId = other }],
      // BF-12b (QA F-2): a missing known key is still refused (an unknown extra key is now ignored; see below).
      ["missing key", v => { delete v.superseders }], ["missing line key", v => { delete v.lines[0].vendor }],
      ["line of no import", v => { v.lines[0].importId = "93910000-0000-4000-8000-0000000000a9" }], ["line at another row", v => { v.lines[0].importRow = 2 }],
      ["calculated with a reason", v => { v.lines[0].plan.reasons = ["x"] }], ["held without a reason", v => { v.lines[2].plan.reasons = [] }],
      ["held without a status", v => { v.lines[2].plan.status = null }], ["category 9 line", v => { v.lines[0].category = 9 }],
      ["matches flag lies", v => { v.imports[0].reconciliation.currencies[0].importedTotal = "299.999" }], ["reconciled lies", v => { v.imports[0].reconciliation.reconciled = false }],
      ["non-numeric counts", v => { v.imports[0].reconciliation.nonNumericRows.imported = 1 }], ["file total differs from the stored totals", v => { v.imports[0].reconciliation.currencies[0].fileTotal = "301"; v.imports[0].reconciliation.currencies[0].importedTotal = "301" }],
      ["a currency missing from the reconciliation", v => { v.imports[0].fileTotals.EUR = "5" }],
      ["rows and lines differ", v => { v.imports[0].rowCount = 4 }], ["bad fingerprint", v => { v.imports[0].lines[0].lineFingerprint = "x" }],
      ["same file twice", v => { v.imports[1].fileSha256 = v.imports[0].fileSha256 }], ["mapping code outside its category", v => { v.mappings[0].category = 4 }],
      ["mapping category 9", v => { v.mappings[0].category = 9 }], ["superseded mismatch", v => { v.superseded = [] }], ["bad date", v => { v.lines[0].lineDate = "03/01/2025" }],
      ["bad created at", v => { v.imports[0].createdAt = "yesterday" }], ["duplicate reference shape", v => { v.lines[3].possibleDuplicateOf = { importId: imp1 } }],
      ["mapping source", v => { v.lines[0].mappingSource = "guess" }], ["reporting year without setup", v => { v.setupVersionId = null }],
      // Round 2 (UX-1, ACC-16): the GL name, the superseded line's own amount and the replacing record's figure.
      // BF-12: the vendor-key flag is absent or exactly true.
      ["vendor-key flag not true", v => { v.superseded[0].vendorKeyMatch = false }], ["vendor-key flag a string", v => { v.superseded[0].vendorKeyMatch = "yes" }],
      ["GL name not text", v => { v.lines[0].glDescription = 5 }], ["superseded amount differs from the line", v => { v.superseded[0].spendAmount = "99" }],
      ["superseder missing", v => { v.superseders = [] }], ["superseder listed twice", v => { v.superseders.push(structuredClone(v.superseders[0])) }],
      ["superseder that replaces nothing", v => { v.superseders[0].recordId = rec(9) }],
    ]
    for (const [name, mutate] of cases) { const v = copy(); mutate(v); expect([name, () => api.decodeScope3SpendImports(v, company)][1] as () => unknown).toThrow("The spend import response was not recognized.") }
  })

  test("an import result: holds are the lines' own, saved and replayed agree", () => {
    const base = () => ({ profile: api.SCOPE3_SPEND_IMPORTS_PROFILE, import: importOf(imp2, "2", [4, 5], { USD: "200" }), replayed: false, saved: 2, calculable: 0,
      holds: { possible_duplicate_spend_line: 1, naics_code_required: 1 }, lines: fixture().lines.slice(3) }) as any
    expect(api.decodeScope3SpendImportResult(base(), company)).toMatchObject({ replayed: false, saved: 2, calculable: 0 })
    const replay = base(); replay.replayed = true; replay.saved = 0
    expect(api.decodeScope3SpendImportResult(replay, company).replayed).toBe(true)
    for (const mutate of [(v: any) => { v.holds.naics_code_required = 2 }, (v: any) => { v.calculable = 1 }, (v: any) => { v.saved = 1 }, (v: any) => { v.replayed = true }, (v: any) => { v.lines[0].recordId = rec(9) }, (v: any) => { v.import.companyId = other }]) {
      const v = base(); mutate(v); expect(() => api.decodeScope3SpendImportResult(v, company)).toThrow("The spend import response was not recognized.")
    }
  })
})

describe("spend import template (I-09)", () => {
  test("the template's header is the parser's columns, every alias is documented, its comments may hold quotes, and its example parses", async () => {
    const parser = await import("../../../../packages/neuvetra-database/src/scope3-spend-import")
    const template = await Bun.file(new URL("../../public/templates/scope3-spend-import.csv", import.meta.url)).text()
    // The public file is the shared module's template, byte for byte (the staging build has no public directory: the panel downloads the module's text).
    expect(template).toBe(parser.scope3SpendImportTemplate())
    const lines = template.trimEnd().split("\n")
    expect(lines.at(-1)).toBe(parser.SCOPE3_SPEND_IMPORT_COLUMNS.join(","))
    for (const column of parser.SCOPE3_SPEND_IMPORT_COLUMNS) expect(lines.some(l => l.startsWith(`# ${column}: `))).toBe(true)
    for (const [alias, column] of Object.entries(parser.SCOPE3_SPEND_IMPORT_HEADER_ALIASES)) expect(lines.find(l => l.startsWith(`# ${column}: `))!).toContain(alias)
    expect(parser.parseScope3SpendCsv(new TextEncoder().encode(template))).toMatchObject({ ok: false, errors: [{ message: "The file has no spend lines." }] })
    const example = lines.find(l => l.startsWith("# Example"))!.replace(/^# Example[^:]*: /, "")
    const filled = parser.parseScope3SpendCsv(new TextEncoder().encode(`# a "quoted" comment, with commas\n${template}${example}\n`))
    expect(filled.ok).toBe(true)
    expect(filled.lines[0]).toMatchObject({ row: 1, line: lines.length + 2, lineId: "INV-1001", amount: "4820.5", currency: "USD", category: 1, naicsCode: "339940" })
  })
})

describe("CSV v2 Mapping section (I-09): amounts per currency, import rows and held possible duplicates", () => {
  test("imported lines are traceable to their file rows; a held duplicate names the line it repeats; amounts are exact sums per currency", async () => {
    const { scope3Csv } = await import("../../../../packages/neuvetra-database/src/scope3-report-csv")
    const { kindLabel, periodLabel, QUALITY_LABELS, reasonText, shortUnit } = await import("./plain-language")
    const labels = { kind: kindLabel, reason: reasonText, period: periodLabel, quality: (code: string) => QUALITY_LABELS[code] ?? code, unit: (code: string) => shortUnit(code) }
    const fixture: any = await Bun.file(new URL("./scope3-results.fixture.json", import.meta.url)).json()
    const spend = fixture.records.find((row: any) => row.kind === "purchase_spend")
    const IMPORT = "93930000-0000-4000-8000-0000000000a1", EARLIER = "93930000-0000-4000-8000-0000000000a0"
    spend.payload = { ...spend.payload, importId: IMPORT, importRow: 2 }
    const second = structuredClone(spend)
    second.recordId = "93930000-0000-4000-8000-000000000102"
    second.quantity = { value: "0.125", unit: "USD" }
    second.payload = { ...second.payload, importRow: 3, possibleDuplicateOf: { importId: EARLIER, row: 1 }, duplicateConfirmedDistinct: false }
    const third = structuredClone(second)
    third.recordId = "93930000-0000-4000-8000-000000000103"
    third.quantity = { value: "n/a", unit: "EUR" }
    third.payload = { ...third.payload, importRow: 4, possibleDuplicateOf: { importId: EARLIER, row: 2 }, duplicateConfirmedDistinct: true }
    fixture.records.push(second, third)
    const csv = scope3Csv(fixture, labels)
    const header = csv.split("\n").find(line => line.startsWith("Section,Category,NAICS code"))!.split(",")
    expect(header.slice(-3)).toEqual(["Amount by currency", "Import rows", "Possible duplicates held"])
    expect(csv).toContain("# Column Mapping.Amount by currency: ")
    const row = csv.split("\n").find(line => line.startsWith("Mapping,"))!
    const total = (await import("../../../../packages/neuvetra-database/src/scope3-spend-import")).scope3DecimalSum([spend.quantity.value, "0.125"])
    expect(row.endsWith(`,USD ${total}; EUR 1 line not a plain amount,${IMPORT} row 2; ${IMPORT} row 3; ${IMPORT} row 4,${second.recordId} → ${EARLIER} row 1`)).toBe(true)
  })
})
