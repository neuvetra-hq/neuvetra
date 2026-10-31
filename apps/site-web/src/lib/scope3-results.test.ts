import { decodeScope3Results } from "@/lib/scope3-results-decode"
import { SCOPE3_REPORT_TEXT_V3 } from "../../../../packages/neuvetra-database/src/scope3-text-v3"
// Scope 3 package 2 (Claude, 26 October 2026): the Results screen's Scope 3 decoder and the separate Scope 3 CSV (D4),
// tested on the exact output of the site-api route (scope3-results.fixture.json; the site-api test
// scope3-results-routes.test.ts fails if the route's output and this fixture ever differ).
import { describe, expect, test } from "bun:test"
import { kindLabel, periodLabel, QUALITY_LABELS, reasonText, SCOPE3_ACTIVITY_KINDS, shortUnit } from "./plain-language"
import { EVIDENCE_STATUS_TEXT, evidenceFileText, RELEASED_LABEL } from "./results-api"
import { SCOPE3_STATUS_TEXT, scope3Csv, type Scope3ResultsResponse } from "./scope3-results-api"
import { scope3RestampResults } from "../../../../packages/neuvetra-database/test-support/scope3-results-restamp"
import { SCOPE3_DERIVED_KINDS } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { SCOPE3_CSV_SECTIONS, scope3CsvHeader } from "../../../../packages/neuvetra-database/src/scope3-report-csv"

const fixture: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results.fixture.json", import.meta.url)).json()
const company = fixture.companyId
const copy = (): Scope3ResultsResponse => structuredClone(fixture)
const labels = { kind: kindLabel, reason: reasonText, period: periodLabel, quality: (code: string) => QUALITY_LABELS[code] ?? code, unit: (code: string) => shortUnit(code) }
/**
 * I-06: the tests below build responses the boundary would give for other lines and statuses. A derived line names the
 * record it follows, and every category's methodology statement is the route's own (the shared generator); this does both,
 * so those tests still test statuses and counts (the methodology check has its own tests in scope3-results-v2.test.ts).
 */
function narrated<T extends Scope3ResultsResponse>(r: T): T {
  for (const row of r.records) if ((SCOPE3_DERIVED_KINDS as readonly string[]).includes(row.kind) && row.derivedFrom === null) row.derivedFrom = { recordId: row.recordId, kind: "electricity" }
  // Round 2: restamp every field the decoder re-derives from the lines (evidence, data-quality label, methodology, readiness, budget).
  return scope3RestampResults(r)
}

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

describe("the Scope 3 results decoder", () => {
  test("accepts the route's own output, for its company only", () => {
    expect(decodeScope3Results(copy(), company).records).toHaveLength(fixture.records.length)
    expect(() => decodeScope3Results(copy(), "93000000-0000-4000-8000-0000000000ff")).toThrow("not recognized")
  })

  test("refuses a response that could show a figure it shouldn't", () => {
    const calculated = (r: Scope3ResultsResponse) => r.records.find(row => row.outcome === "calculated")!
    const cases: [string, (r: Scope3ResultsResponse) => void][] = [
      ["released label on unreleased methods", r => { r.label = RELEASED_LABEL }],
      ["a calculated record without a result", r => { calculated(r).result = null }],
      ["a held record with a result", r => { const held = r.records.find(row => row.outcome === "held")!; held.result = calculated(r).result }],
      ["a calculated record outside the period", r => { calculated(r).periodCheck = "outside" }],
      ["a result from a method run that isn't listed", r => { calculated(r).result!.methodVersionId = "scope3.unlisted.v1" }],
      ["a result whose category differs from its record", r => { const row = calculated(r); row.result!.category = row.category === 4 ? 6 : 4 }],
      ["a non-decimal record total", r => { calculated(r).result!.total!.display = "1e3" }],
      ["a duplicate record", r => { r.records.push(structuredClone(r.records[0]!)) }],
      ["fourteen categories", r => { r.coverage.categories.pop() }],
      ["categories out of order", r => { [r.coverage.categories[0], r.coverage.categories[1]] = [r.coverage.categories[1]!, r.coverage.categories[0]!] }],
      ["Scope 3 added to Scope 1 and 2", r => { (r.coverage as { addedToScope1And2: boolean }).addedToScope1And2 = true }],
      ["unknown shown as zero", r => { r.coverage.categories[8]!.subtotal = { unrounded: "0", display: "0.0000", unit: "kg CO2e", rounding: "half_even_4dp" } as never }],
      ["an unknown category status", r => { (r.coverage.categories[0] as { status: string }).status = "complete" }],
      ["a non-decimal known-source subtotal", r => { r.coverage.knownSourceSubtotal!.display = "NaN" }],
      ["a duplicate method run", r => { r.methods.push(structuredClone(r.methods[0]!)) }],
      ["a method with a release id but unreleased", r => { (r.methods[0] as { releaseId: string | null }).releaseId = "93000000-0000-4000-8000-0000000000ee" }],
      ["not synthetic", r => { (r as { syntheticOnly: boolean }).syntheticOnly = false }],
      ["another profile", r => { (r as { profile: string }).profile = "neuvetra.results.v1" }],
    ]
    for (const [name, tamper] of cases) {
      const response = copy()
      tamper(response)
      expect([name, (() => { try { decodeScope3Results(response, company); return "accepted" } catch { return "refused" } })()]).toEqual([name, "refused"])
    }
  })

  test("every reason and status the route returns has plain words", () => {
    const codes = new Set<string>()
    for (const row of fixture.records) for (const code of [...row.plan.reasons, ...(row.result?.findings ?? []), ...(row.result?.estimates ?? [])]) codes.add(code)
    for (const row of fixture.coverage.categories) for (const code of row.reasons) codes.add(code)
    // Every hold the Scope 3 adapter can give (scope3-collection.ts), plus the period holds.
    for (const code of ["electricity_record_held", "haul_basis_required", "load_basis_not_available_for_vehicle", "load_basis_required", "location_excluded_by_company_setup", "location_inclusion_unknown", "location_not_in_current_setup",
      "material_not_an_engine_token", "mode_not_an_engine_token", "passenger_segments_required", "quantity_not_calculable", "record_withdrawn", "saved_against_earlier_setup_version", "segment_distance_must_be_positive",
      "treatment_not_an_engine_token", "unit_not_an_engine_token", "vehicle_not_an_engine_token", "outside_reporting_period", "partly_outside_reporting_period"]) codes.add(code)
    for (const code of codes) expect([code, reasonText(code) !== code]).toEqual([code, true])
    for (const row of fixture.coverage.categories) expect(SCOPE3_STATUS_TEXT[row.status]).toBeTruthy()
  })
})

describe("the Scope 3 CSV (D4)", () => {
  const csv = scope3Csv(fixture, labels)
  const rows = parse(csv)
  const meta = rows.filter(row => row[0]!.startsWith("#"))
  const categoryRows = rows.filter(row => row[0] === "Category")
  const recordRows = rows.filter(row => row[0] === "Record")
  const totalRow = rows.find(row => row[0] === "Total")!

  test("header lines stay one cell each and say Scope 3 is reported separately", () => {
    expect(meta.every(row => row.length === 1)).toBe(true)
    expect(meta[0]![0]).toBe(`# ${fixture.label}`)
    expect(meta.map(row => row[0]).join("\n")).toContain("never added to the Scope 1 and 2 totals")
    expect(meta.some(row => row[0] === "# Grid losses (3C): calculated for each included electricity record")).toBe(true)
    expect(meta.some(row => row[0]!.startsWith("# CARB proposed mandatory categories (a proposal, not adopted): Incomplete:"))).toBe(true)
    expect(meta.filter(row => row[0]!.startsWith("# Disclosure")).length).toBe(fixture.coverage.disclosures.length)
    // I-06 (CSV v2): eight sections in order, each with its own header row and a fixed width; the first 19 category columns
    // and the first 16 record columns are the version-1 columns, in the same order.
    const headers = rows.filter(row => row[0] === "Section")
    expect(headers).toEqual(SCOPE3_CSV_SECTIONS.map(section => scope3CsvHeader(section)))
    expect(headers[0]!.slice(0, 19)).toEqual(["Section", "Category", "Title", "Status", "Screening", "Screening reason", "Records", "Calculated", "Partial boundary", "Input needed", "Outside period", "Excluded", "Withdrawn", "Unavailable", "Subtotal kg CO2e", "Subtotal basis", "Methods", "Reasons", "Disclosures"])
    expect(headers[1]!.slice(0, 16)).toEqual(["Section", "Category", "Activity", "Site", "Source ID", "Period start", "Last day covered", "Quantity", "Unit", "Data quality", "Status", "Reasons", "kg CO2e", "GWP set", "Method", "Evidence files"])
    for (const [i, section] of SCOPE3_CSV_SECTIONS.entries()) expect(rows.filter(row => row[0] === section).every(row => row.length === headers[i]!.length)).toBe(true)
    expect(rows.length).toBe(meta.length + SCOPE3_CSV_SECTIONS.length + SCOPE3_CSV_SECTIONS.reduce((n, section) => n + rows.filter(row => row[0] === section).length, 0))
  })

  test("15 category rows with the engine's subtotals; a category with nothing calculated has no figure, never 0", () => {
    expect(categoryRows.map(row => row[1])).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1)))
    categoryRows.forEach((row, index) => {
      const category = fixture.coverage.categories[index]!
      expect([row[3], row[14]]).toEqual([SCOPE3_REPORT_TEXT_V3.status[category.status] ?? SCOPE3_STATUS_TEXT[category.status], category.subtotal?.display ?? ""])
    })
    expect(categoryRows[8]![14]).toBe("") // category 9: a held record only
    expect(categoryRows[4]![15]).toBe("known sources only") // category 5: one waste record needs input
  })

  test("one row per record with the engine's exact figure; the total is the engine aggregate, not a re-sum", () => {
    expect(recordRows).toHaveLength(fixture.records.length)
    fixture.records.forEach((record, index) => expect([recordRows[index]![4], recordRows[index]![12]]).toEqual([record.sourceId.startsWith("=") ? `'${record.sourceId}` : record.sourceId, record.result?.total?.display ?? ""]))
    expect(totalRow[2]).toBe(fixture.coverage.knownSourceSubtotal!.display)
    const status = (source: string, kind?: string) => recordRows[fixture.records.findIndex(row => row.sourceId === source && (!kind || row.kind === kind))]![10]
    // Round 3, lane A (AC-5): M-1's 3C combustion line is closed by its 3C upstream line, so it prints as calculated and closed.
    expect([status("M-2", "td_losses"), status("W-2"), status("M-1", "td_losses"), status("LANE-1")]).toEqual(["Excluded", "Needs input", "Calculated — closed by its upstream line", "Calculated"])
    // Round 2 (owner decision 10): the withdrawn trip T-2 is counted in category 6, never listed as a line.
    expect(fixture.records.some(row => row.sourceId === "T-2")).toBe(false)
    expect(fixture.coverage.categories[5]!.counts.withdrawn).toBe(1)
    expect(recordRows.find(row => row[4] === "W-2")![11]).toBe(reasonText("material_not_an_engine_token"))
  })

  test("S3-10: the evidence column names each file's quarantine state, as the Results CSV does (only clean is “cleared”)", () => {
    const response = copy(), row = response.records.find(item => item.outcome === "calculated")!
    row.evidence = [{ id: "93000000-0000-4000-8000-0000000000e1", name: "bill.pdf", sha256: "a".repeat(64), status: "pending" }, { id: "93000000-0000-4000-8000-0000000000e2", name: "log.pdf", sha256: "b".repeat(64), status: "clean" }]
    const line = parse(scope3Csv(response, labels)).find(cells => cells[0] === "Record" && cells[4] === row.sourceId && cells[1] === String(row.category))!
    // Round 2 (ACC-11): the Scope 3 CSV prints each file's full SHA-256 (the Scope 1 and 2 CSV keeps its own short form).
    expect(line[15]).toBe(row.evidence.map(evidenceFileText).join("; ").replace(/sha256 a{12}\)/, `sha256 ${"a".repeat(64)})`).replace(/sha256 b{12}\)/, `sha256 ${"b".repeat(64)})`))
    expect(line[15]).toContain(`sha256 ${"a".repeat(64)}`)
    expect(line[15]).toContain(EVIDENCE_STATUS_TEXT.pending)
    expect(line[15]).toContain(EVIDENCE_STATUS_TEXT.clean)
    expect(line[12]).toBe(row.result!.total!.display) // the figure is unchanged by evidence status
  })

  test("user text never starts a formula cell, and no Scope 1 or 2 figure appears", () => {
    const formula = recordRows.find(row => row[4]!.includes("HYPERLINK"))!
    expect(formula[4]).toBe(`'=HYPERLINK("x")`)
    expect(csv).not.toMatch(/(^|,)[=+@]/m)
    expect(csv).not.toContain("Scope 1 subtotal")
    expect(csv).not.toContain("Scope 2")
  })
})

// Scope 3 completion I-02: the decoder knows every saved and derived kind, and the method-pending state ahead of the
// boundary emitting it (I-04).
describe("I-02: every Scope 3 kind, and lines awaiting a factor source", () => {
  const heldLike = (r: Scope3ResultsResponse, kind: string, category: number, status: "input_needed" | "method_pending", reason: string) => {
    const base = structuredClone(r.records.find(row => row.kind === "waste" && row.outcome === "held")!)
    return { ...base, recordId: crypto.randomUUID(), versionId: crypto.randomUUID(), kind, category, plan: { action: "hold" as const, status, reasons: [reason], notes: [] } }
  }
  const decodes = (r: Scope3ResultsResponse) => { try { decodeScope3Results(narrated(structuredClone(r)), company); return true } catch { return false } }

  test("a held record of a 0030 kind decodes in its own category, and only there", () => {
    const r = copy()
    // I-03: spend lines are calculated now, so the held line carries one of their own holds and category 2 (calculated by
    // the engine) needs input; before I-03 it was "not yet supported".
    r.records.push(heldLike(r, "purchase_spend", 2, "input_needed", "capital_goods_must_be_full_cost"))
    // I-06: the fixture's category 2 already has a calculated spend line and a supplier figure, so its counts grow by one.
    const two = r.coverage.categories[1]!
    Object.assign(two.counts, { records: two.counts.records + 1, inputNeeded: two.counts.inputNeeded + 1 })
    // I-04: `not_yet_supported` is retired; a held record makes its category need input, whatever the method support.
    expect(decodes(r)).toBe(false)
    ;(two as { status: string }).status = "input_needed"
    expect(decodes(r)).toBe(false) // its figure is now from known sources only
    ;(two as { subtotalBasis: string }).subtotalBasis = "known_sources_only"
    expect(decodes(r)).toBe(true)
    expect(r.coverage.categories[1]!.support).toBe("engine")
    expect(reasonText("capital_goods_must_be_full_cost")).toContain("full purchase cost")
    expect(reasonText("method_not_built_yet")).toContain("isn’t in this beta yet")
    expect(kindLabel("purchase_spend")).toBe("Purchases by spend")
    // I-02b: purchase_spend now serves category 3 too, so "only there" is shown with category 7, which it never serves.
    const wrong = copy()
    wrong.records.push(heldLike(wrong, "purchase_spend", 7, "input_needed", "method_not_built_yet"))
    Object.assign(wrong.coverage.categories[6]!.counts, { records: wrong.coverage.categories[6]!.counts.records + 1, inputNeeded: wrong.coverage.categories[6]!.counts.inputNeeded + 1 })
    expect(decodes(wrong)).toBe(false)
    for (const [kind, category] of [["investment", 15], ["sold_fuel", 11], ["end_of_life_split", 12], ["asset_energy", 14], ["energy_resold", 3]] as const) {
      const one = copy()
      one.records.push(heldLike(one, kind, category, "input_needed", "method_not_built_yet"))
      const counts = one.coverage.categories[category - 1]!.counts
      Object.assign(counts, { records: counts.records + 1, inputNeeded: counts.inputNeeded + 1 })
      const row = one.coverage.categories[category - 1]!
      // Screened out with an active record: needs review (rule 1); otherwise needs input unless the category has no method.
      // Round 2 (owner decision 5): screened out with an active record is a screening conflict.
      if (row.screening.decision === "excluded") (row as { status: string }).status = "screening_conflict"
      else (row as { status: string }).status = "input_needed"
      if (row.subtotal) (row as { subtotalBasis: string }).subtotalBasis = "known_sources_only"
      expect([kind, decodes(one)]).toEqual([kind, true])
    }
  })

  test("a method-pending line is counted apart and makes the category await its factor source", () => {
    const r = copy()
    r.records.push(heldLike(r, "td_losses_upstream", 3, "method_pending", "factor_source_not_yet_loaded"))
    const three = r.coverage.categories[2]! as unknown as { counts: Record<string, number>; status: string }
    Object.assign(three.counts, { records: three.counts.records + 1, methodPending: 1 })
    three.status = "awaiting_factor_source"
    ;(three as unknown as { subtotalBasis: string }).subtotalBasis = "known_sources_only" // a figure from known sources only
    expect(decodes(r)).toBe(true)
    expect(SCOPE3_STATUS_TEXT.awaiting_factor_source).toBe("Awaiting factor source")
    const stale = structuredClone(r); (stale.coverage.categories[2] as { status: string }).status = "partial_boundary"
    expect(decodes(stale)).toBe(false)
    const uncounted = structuredClone(r); delete (uncounted.coverage.categories[2]!.counts as Record<string, number>).methodPending
    expect(decodes(uncounted)).toBe(false)
    // I-04: the boundary sends both pending counts on every category; the route's own output decodes.
    expect(decodes(copy())).toBe(true)
  })
})

// Scope 3 completion I-02b (DESIGN §11): the widened categories of the amended kinds and the derived 3D upstream line
// (AM-08, AM-09, AM-04, AM-11) reach the decoder's KINDS from the shared contract.
describe("I-02b: widened categories and the 3D upstream line", () => {
  const heldLike = (r: Scope3ResultsResponse, kind: string, category: number, status: "input_needed" | "method_pending", reason: string) => {
    const base = structuredClone(r.records.find(row => row.kind === "waste" && row.outcome === "held")!)
    return { ...base, recordId: crypto.randomUUID(), versionId: crypto.randomUUID(), kind, category, plan: { action: "hold" as const, status, reasons: [reason], notes: [] } }
  }
  const decodes = (r: Scope3ResultsResponse) => { try { decodeScope3Results(narrated(structuredClone(r)), company); return true } catch { return false } }
  /** One more held line in `category`, with the coverage row adjusted as the boundary would. */
  const withHeld = (kind: string, category: number, status: "input_needed" | "method_pending" = "input_needed", reason = "method_not_built_yet") => {
    const r = copy()
    r.records.push(heldLike(r, kind, category, status, reason))
    const row = r.coverage.categories[category - 1]! as unknown as { counts: Record<string, number>; status: string; screening: { decision: string }; support: string; subtotal: unknown; subtotalBasis: string }
    row.counts.records += 1
    if (status === "method_pending") { row.counts.methodPending = 1; row.status = "awaiting_factor_source" } else row.counts.inputNeeded += 1
    if (status === "input_needed") row.status = row.screening.decision === "excluded" ? "screening_conflict" : "input_needed"
    if (row.subtotal) row.subtotalBasis = "known_sources_only"
    return r
  }

  test("a method-pending 3D upstream line decodes in category 3 and nowhere else", () => {
    expect(decodes(withHeld("energy_resold_upstream", 3, "method_pending", "factor_source_not_yet_loaded"))).toBe(true)
    for (const category of [4, 11]) expect([category, decodes(withHeld("energy_resold_upstream", category, "method_pending", "factor_source_not_yet_loaded"))]).toEqual([category, false])
    expect(kindLabel("energy_resold_upstream")).toBe("Upstream of energy resold (3D)")
  })

  test("the widened categories decode; categories a kind never serves do not", () => {
    for (const [kind, category] of [["purchase_spend", 5], ["purchase_spend", 3], ["asset_energy", 4], ["asset_energy", 9], ["partner_reported", 12], ["partner_reported", 5]] as const)
      expect([kind, category, decodes(withHeld(kind, category))]).toEqual([kind, category, true])
    for (const [kind, category] of [["purchase_spend", 7], ["asset_energy", 5], ["partner_reported", 11], ["purchase_spend", 8]] as const)
      expect([kind, category, decodes(withHeld(kind, category))]).toEqual([kind, category, false])
    const categoriesText = (kind: string) => SCOPE3_ACTIVITY_KINDS.find(item => item.kind === kind)!.categories
    expect([categoriesText("purchase_spend"), categoriesText("asset_energy"), categoriesText("partner_reported"), categoriesText("purchase_supplier")])
      .toEqual(["Categories 1 to 6 and 9 (9 by hand only)", "Categories 4, 8, 9, 10, 13 and 14", "Categories 4, 5, 8, 9, 10, 12, 13 and 14", "Categories 1 and 2"])
  })
})

/* eslint-disable @typescript-eslint/no-explicit-any -- the I-04 cases tamper with decoded responses field by field. */
// Scope 3 completion I-04 (DESIGN 3.4, 3.5, 5.3, A26, A27): the decoder re-derives every status as the boundary does, now
// with optional pending lines and documented within-category exclusions; it requires both pending counts and a valid
// assessment (or null) on every category; `not_yet_supported` is gone end to end.
describe("I-04: statuses, pending counts and assessments", () => {
  const decodes = (r: unknown) => { try { decodeScope3Results(narrated(structuredClone(r) as Scope3ResultsResponse), company); return true } catch { return false } }
  type Row = { counts: Record<string, number>; status: string; screening: { decision: string }; subtotal: unknown; subtotalBasis: string; assessment: any; support: string }
  const category = (r: Scope3ResultsResponse, n: number) => r.coverage.categories[n - 1] as unknown as Row
  const pendingLine = (r: Scope3ResultsResponse, kind: string, n: number, optional: boolean) => {
    const base = structuredClone(r.records.find(row => row.kind === "waste" && row.outcome === "held")!)
    return { ...base, recordId: crypto.randomUUID(), versionId: crypto.randomUUID(), kind, category: n, plan: { action: "hold" as const, status: "method_pending" as const, reasons: ["factor_source_not_yet_loaded"], notes: [], ...(optional ? { optional: true as const } : {}) } }
  }

  test("the fixture is the boundary's own I-04 output: no category is 'not yet supported', every row has both pending counts and an assessment key", () => {
    expect(fixture.coverage.categories.map(row => row.status)).not.toContain("not_yet_supported")
    expect(fixture.coverage.categories.every(row => row.counts.methodPending === 0 && row.counts.optionalPending === 0 && "assessment" in row)).toBe(true)
    expect(fixture.coverage.categories.filter(row => row.assessment).map(row => row.category)).toEqual([1, 4, 12])
    expect(Object.keys(SCOPE3_STATUS_TEXT)).not.toContain("not_yet_supported")
    expect(reasonText("screened_out_with_active_records")).toBe("This category is screened out in company setup, but it has active records. Review the screening or withdraw the records.")
    expect(reasonText("factor_source_not_yet_loaded")).toContain("factor source it needs isn’t loaded")
  })

  test("an optional pending line is counted apart and changes no status; a non-optional one makes the category await its source", () => {
    const optional = copy()
    optional.records.push(pendingLine(optional, "business_travel", 6, true))
    const six = category(optional, 6)
    six.counts.records += 1; six.counts.optionalPending = 1
    expect(six.status).toBe("calculated")
    expect(decodes(optional)).toBe(true)
    const miscounted = structuredClone(optional); category(miscounted, 6).counts.optionalPending = 0; category(miscounted, 6).counts.methodPending = 1
    expect(decodes(miscounted)).toBe(false)
    const required = copy()
    required.records.push(pendingLine(required, "business_travel", 6, false))
    const sixRequired = category(required, 6)
    sixRequired.counts.records += 1; sixRequired.counts.methodPending = 1
    expect(decodes(required)).toBe(false) // still "calculated": the boundary would say awaiting_factor_source
    sixRequired.status = "awaiting_factor_source"; sixRequired.subtotalBasis = "known_sources_only"
    expect(decodes(required)).toBe(true)
  })

  test("A26: a partial line whose partial note is documented in the category's assessment leaves the category calculated", () => {
    // The fixture's category 4 freight line, made partial for third-party facilities present and not included (the
    // decoder checks statuses and counts, not result hashes; the trusted boundary binds the result to the engine).
    const r = copy()
    const line = r.records.find(row => row.category === 4 && row.outcome === "calculated")!
    line.result!.boundary = { minimumBoundary: "partial", notes: ["tank_to_wheel_only", "third_party_facilities_not_included"] }
    const four = category(r, 4)
    four.counts.calculated -= 1; four.counts.partialBoundary += 1
    expect(decodes(r)).toBe(false) // still "calculated"
    four.status = "partial_boundary"
    expect(decodes(r)).toBe(true)
    four.assessment.withinCategoryExclusions = [{ noteCode: "third_party_facilities_not_included", justification: "One shared cross-dock.", magnitudeKind: "estimated", magnitudeTCo2e: "0.4", basis: "Throughput share." }]
    expect(decodes(r)).toBe(false) // documented: the boundary says calculated
    four.status = "calculated"
    expect(decodes(r)).toBe(true)
    // Not-assessed facilities can't be documented away.
    line.result!.boundary.notes = ["tank_to_wheel_only", "third_party_facilities_not_assessed"]
    expect(decodes(r)).toBe(false)
  })

  test("refuses a retired status, missing pending counts, a misplaced optional flag and any assessment that isn't exactly the category's", () => {
    const cases: Array<[string, (r: any) => void]> = [
      ["the retired status", r => { r.coverage.categories[1].status = "not_yet_supported" }],
      ["no optionalPending count", r => { delete r.coverage.categories[0].counts.optionalPending }],
      ["no methodPending count", r => { delete r.coverage.categories[0].counts.methodPending }],
      ["no assessment key", r => { delete r.coverage.categories[0].assessment }],
      ["optional on an input-needed line", r => { r.records.find((row: any) => row.plan.status === "input_needed").plan.optional = true }],
      ["optional false", r => { const line = pendingLine(r, "business_travel", 6, true); (line.plan as any).optional = false; r.records.push(line); r.coverage.categories[5].counts.records += 1; r.coverage.categories[5].counts.optionalPending = 1 }],
      ["an assessment of another category", r => { r.coverage.categories[1].assessment = r.coverage.categories[0].assessment }],
      ["an assessment of another company", r => { r.coverage.categories[0].assessment.companyId = "93000000-0000-4000-8000-0000000000ff" }],
      ["assessments of two reporting years", r => { r.coverage.categories[3].assessment.reportingYear = 2026 }],
      ["a malformed assessment", r => { r.coverage.categories[0].assessment.magnitudeTCo2e = "1e3" }],
      ["an assessment with an extra key", r => { r.coverage.categories[0].assessment.note = "x" }],
      ["a revision without its correction reason", r => { r.coverage.categories[3].assessment.correctionReason = null }],
    ]
    expect(decodes(fixture)).toBe(true)
    for (const [name, tamper] of cases) { const r = structuredClone(fixture) as any; tamper(r); expect([name, decodes(r)]).toEqual([name, false]) }
  })

  test("the CSV states the provisional deadline, the calendar-2025 limitation and the base year", () => {
    const meta = parse(scope3Csv(fixture, labels)).filter(row => row[0]!.startsWith("#")).map(row => row[0])
    expect(meta).toContain("# Provisional first SB 253 Scope 3 report: due 10 November 2027, for the fiscal year ending 31 December 2026. Provisional: CARB has not adopted the 2027 Scope 3 rule; Scope 3 is not required for 2026 reporting (17 CCR 96076(a)).")
    expect(meta).toContain("# Scope 3 records may cover 2025 and 2026 in this beta (fiscal year 2026, the first expected SB 253 Scope 3 report, and fiscal years spanning two calendar years), inside the reporting period in company setup. Factors stay the latest published editions, disclosed on each later line; Scope 1 and 2 for periods after 2025 are a separate package.")
    expect(meta).toContain("# Scope 3 base year: not yet established.")
  })
})
/* eslint-enable @typescript-eslint/no-explicit-any */
