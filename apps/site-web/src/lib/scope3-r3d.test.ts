// Round 3 lane D (Claude, 31 October 2026): the display rules behind decision 5 (one data-quality label), PR-6 / PR-12
// (stop a record the engine would hold, naming the field), PR-8 (plural units, provenance words, invoice date), PR-9 (one
// period), PR-10 (the headline's screened-out share) and PR-13 (the CSV as one file per section, in a ZIP).
import { describe, expect, test } from "bun:test"
import { kindLabel, periodLabel, QUALITY_LABELS, reasonText, shortUnit } from "./plain-language"
import { scope3Csv, type Scope3ResultsResponse } from "./scope3-results-api"
import { scope3CategoryDq, scope3CategoryDqText, scope3ConflictInHeadline, scope3DqScoresText, scope3PreSaveProblems, scope3ProvenanceText, scope3QuantityText, scope3SavedRecordWhen, scope3Sentence, scope3WasteTreatmentsFor } from "./scope3-display-r3d"
import { SCOPE3_WASTE_TREATMENTS_BY_MATERIAL } from "./scope3-waste-pairs"
import { scope3Crc32, scope3CsvRecords, scope3CsvSectionFiles, scope3CsvZip } from "./scope3-csv-zip"
import { SCOPE3_CSV_SECTIONS } from "../../../../packages/neuvetra-database/src/scope3-report-csv"
import { SCOPE3_DQ_RATING_TEXT } from "../../../../packages/neuvetra-database/src/scope3-text"

const fixture: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results.fixture.json", import.meta.url)).json()
const downstream: Scope3ResultsResponse = await Bun.file(new URL("./scope3-results-downstream.fixture.json", import.meta.url)).json()
const labels = { kind: kindLabel, reason: reasonText, period: periodLabel, quality: (code: string) => QUALITY_LABELS[code] ?? code, unit: (code: string) => shortUnit(code) }

describe("decision 5 (AC-3, PR-2): the capped label is the only category label", () => {
  test("a capped category shows fair (capped) and the weighted score as a number, never the engine's label word", () => {
    const capped = fixture.coverage.categories.filter(row => row.dataQualityLabel.capped)
    expect(capped.map(row => row.category)).toEqual([3, 5])
    for (const row of capped) {
      const text = scope3CategoryDqText(row)
      expect(text).toBe(`fair (capped) · weighted score ${row.profile!.dataQuality.overall.score!.display}`)
      expect(text).not.toContain(SCOPE3_DQ_RATING_TEXT[row.dataQualityLabel.engineLabel!]!)
      expect(scope3CategoryDq(row).reasons.length).toBeGreaterThan(0)
    }
    const uncapped = fixture.coverage.categories.find(row => row.category === 4)!
    expect(scope3CategoryDqText(uncapped)).toBe("good · weighted score 2.00")
    expect(scope3CategoryDqText(fixture.coverage.categories.find(row => row.profile === null)!)).toBe("—")
    // Print: the indicator scores and the weighted score as numbers only. Round 3 integration: the weighted score is the
    // fixture's own (lane A moved category 3's coal geography from very good to good, so 2.23 became 2.29).
    const weighted = capped[0]!.profile!.dataQuality.overall.score!.display
    expect(weighted).toMatch(/^\d+\.\d{2}$/)
    expect(scope3DqScoresText(capped[0]!.profile)).toMatch(new RegExp(`^T [\\d.]+ / Ti [\\d.]+ / G [\\d.]+ / C [\\d.]+ / R [\\d.]+ / weighted ${weighted.replace(".", "\\.")}$`))
  })
  test("a version stored before labels were capped shows the label it stored", () => {
    const row = fixture.coverage.categories.find(item => item.category === 5)!
    const v1 = { ...row, dataQualityLabel: undefined }
    const dq = scope3CategoryDq(v1)
    expect(dq).toEqual({ label: "good", capped: false, reasons: [], score: "2.40", beforeCap: true })
  })
})

describe("PR-8, PR-9, PR-10: words and numbers", () => {
  test("units agree with the number and digits are grouped", () => {
    expect(scope3QuantityText("85000", "vehicle-mile")).toBe("85,000 vehicle-miles")
    expect(scope3QuantityText("86400", "passenger-mile")).toBe("86,400 passenger-miles")
    expect(scope3QuantityText("340", "room-night")).toBe("340 room-nights")
    expect(scope3QuantityText("1", "room-night")).toBe("1 room-night")
    expect(scope3QuantityText("25000", "unit")).toBe("25,000 units")
    expect(scope3QuantityText("18505.65", "USD")).toBe("18,505.65 USD")
    expect(scope3QuantityText("2", "short_ton")).toBe("2 short tons")
  })
  test("the transcription tag reads as words", () => {
    const cell = "row \"Total CI\" [transcription: webfetch_double_read; us-upstream-transcriptions.json id cagreet3_lut2018.ulsd.total]"
    expect(scope3ProvenanceText(cell)).toBe("row \"Total CI\" [transcribed from the source document (read twice); us-upstream-transcriptions.json id cagreet3_lut2018.ulsd.total]")
    expect(scope3ProvenanceText("D436")).toBe("D436")
  })
  test("one sentence end", () => {
    expect(scope3Sentence("Company: Acme Light Manufacturing Inc.")).toBe("Company: Acme Light Manufacturing Inc.")
    expect(scope3Sentence("Company: Synthetic Scope 3 Co")).toBe("Company: Synthetic Scope 3 Co.")
  })
  test("the headline names the tonnes it includes from screened-out categories", () => {
    const rows = [{ category: 15, status: "screening_conflict" as const, subtotal: { display: "102000.0000", unrounded: "102000", unit: "kg CO2e" } }, { category: 8, status: "screening_conflict" as const, subtotal: { display: "4.0049", unrounded: "4.0049", unit: "kg CO2e" } }, { category: 1, status: "calculated" as const, subtotal: { display: "5.0000", unrounded: "5", unit: "kg CO2e" } }]
    expect(scope3ConflictInHeadline(rows as never)).toEqual({ tonnes: "102.00", categories: [15, 8] })
    expect(scope3ConflictInHeadline(fixture.coverage.categories)).toBeNull()
  })
  test("a dated spend line shows its invoice date; other records their period", () => {
    expect(scope3SavedRecordWhen({ kind: "purchase_spend", period: { start: "2025-01-01" }, payload: { lineDate: "2025-06-30" } }, "2025-12-31")).toBe("Invoice date 2025-06-30")
    expect(scope3SavedRecordWhen({ kind: "purchase_spend", period: { start: "2025-01-01" }, payload: { lineDate: null } }, "2025-12-31")).toBe("2025-01-01 to 2025-12-31 (last day covered)")
    expect(scope3SavedRecordWhen({ kind: "waste", period: { start: "2025-01-01" }, payload: {} }, "2025-03-31")).toBe("2025-01-01 to 2025-03-31 (last day covered)")
  })
})

describe("PR-6, PR-12: the freight, travel and waste forms stop a record the engine would hold", () => {
  test("waste offers only the treatments EPA publishes a factor for, exactly as the verified register holds them", async () => {
    const register = await Bun.file(new URL("../../../../packages/neuvetra-database/src/method-reference/verified-scope3-register-2025.json", import.meta.url)).json() as { entries: Array<{ id: string }> }
    const pairs: Record<string, string[]> = {}
    for (const { id } of register.entries) if (id.startsWith("waste.")) { const [, material, treatment] = id.split("."); (pairs[material!] ??= []).push(treatment!) }
    expect(Object.keys(SCOPE3_WASTE_TREATMENTS_BY_MATERIAL).sort()).toEqual(Object.keys(pairs).sort())
    for (const [material, treatments] of Object.entries(pairs)) expect([...SCOPE3_WASTE_TREATMENTS_BY_MATERIAL[material]!].sort()).toEqual(treatments.sort())
    expect(scope3WasteTreatmentsFor("mixed_msw")).toEqual(["landfilled", "combusted"])
    expect(scope3WasteTreatmentsFor("something unlisted").length).toBe(6)
  })
  test("each problem names its field", () => {
    expect(scope3PreSaveProblems({ kind: "transport", payload: { vehicle: "", loadBasis: null } })).toEqual([{ field: "Vehicle", text: expect.stringMatching(/^Vehicle: choose the vehicle/) }])
    expect(scope3PreSaveProblems({ kind: "transport", payload: { vehicle: "other" } })).toEqual([])
    expect(scope3PreSaveProblems({ kind: "business_travel", payload: { mode: "air_short_haul", haulBasis: null } }).map(p => p.field)).toEqual(["How do you know the haul length?"])
    expect(scope3PreSaveProblems({ kind: "business_travel", payload: { mode: "air_short_haul", haulBasis: "Booking export" } })).toEqual([])
    expect(scope3PreSaveProblems({ kind: "waste", payload: { material: "mixed_msw", treatment: "recycled" } })).toEqual([{ field: "Treatment", text: "Treatment: EPA publishes no factor for Mixed MSW (municipal solid waste) that is recycled. Choose one of the treatments listed for this material." }])
    expect(scope3PreSaveProblems({ kind: "waste", payload: { material: "mixed_msw", treatment: "landfilled" } })).toEqual([])
    expect(scope3PreSaveProblems({ kind: "waste", payload: { material: "other", treatment: "recycled" } })).toEqual([])
  })
})

describe("PR-13: the Scope 3 CSV as one CSV per section", () => {
  for (const [name, results] of [["fixture", fixture], ["downstream", downstream]] as const) test(`${name}: every record lands in its own section's file, unchanged and in order`, () => {
    const csv = scope3Csv(results, labels)
    const files = scope3CsvSectionFiles(csv, "neuvetra-draft-scope3-2026-10-31")
    expect(files.map(file => file.name)).toEqual(["neuvetra-draft-scope3-2026-10-31/00-notes-and-columns.csv", ...SCOPE3_CSV_SECTIONS.map((section, i) => `neuvetra-draft-scope3-2026-10-31/${String(i + 1).padStart(2, "0")}-${section.toLowerCase()}.csv`)])
    const records = scope3CsvRecords(csv)
    const notes = records.filter(record => record.startsWith("#") || record.startsWith("\"#"))
    expect(files[0]!.text.split("\n").slice(1, -1)).toEqual(notes)
    // The section files, in order, are exactly the other records; each starts with its header row and holds only its rows.
    expect(files.slice(1).flatMap(file => file.text.split("\n").slice(0, -1))).toEqual(records.filter(record => !notes.includes(record)))
    for (const file of files.slice(1)) { const lines = file.text.split("\n").slice(0, -1); expect(lines[0]!.startsWith("Section,")).toBe(true); expect(lines.slice(1).every(line => line.startsWith(`${file.section},`))).toBe(true) }
  })
  test("the ZIP is a valid stored archive of those files (local headers, CRC-32, central directory)", () => {
    const csv = scope3Csv(fixture, labels), when = new Date("2026-10-31T12:34:56Z")
    const zip = scope3CsvZip(csv, "neuvetra-draft-scope3-2026-10-31.csv", when), view = new DataView(zip.buffer)
    const files = scope3CsvSectionFiles(csv, "neuvetra-draft-scope3-2026-10-31")
    const end = zip.length - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 10, true)).toBe(files.length)
    let at = view.getUint32(end + 16, true)
    const decoder = new TextDecoder()
    for (const file of files) {
      expect(view.getUint32(at, true)).toBe(0x02014b50)
      const size = view.getUint32(at + 20, true), nameLength = view.getUint16(at + 28, true), local = view.getUint32(at + 42, true)
      expect(decoder.decode(zip.slice(at + 46, at + 46 + nameLength))).toBe(file.name)
      expect(view.getUint32(local, true)).toBe(0x04034b50)
      const data = zip.slice(local + 30 + view.getUint16(local + 26, true), local + 30 + view.getUint16(local + 26, true) + size)
      expect(decoder.decode(data)).toBe(file.text)
      expect(view.getUint32(at + 16, true)).toBe(scope3Crc32(data))
      expect(scope3Crc32(data)).toBe(Bun.hash.crc32(data))
      at += 46 + nameLength
    }
  })
  test("a CSV without the documented layout is refused, never split wrongly", () => {
    expect(() => scope3CsvSectionFiles("Section,a\nRecord,1\n", "x")).toThrow()
  })
})

describe("PR-7: Fix lands on the field the hold names (freight, air, waste)", () => {
  test("the vehicle, haul-basis and waste-pair holds name their fields", async () => {
    const { scope3FixFields } = await import("./scope3-checklist")
    expect(scope3FixFields(["vehicle_not_an_engine_token"])).toEqual(["Vehicle"])
    expect(scope3FixFields(["haul_basis_required"])).toEqual(["How do you know the haul length?"])
    expect(scope3FixFields(["no_published_factor_for_material_and_treatment"])).toEqual(["Treatment", "Treatment split", "Material"])
    expect(scope3FixFields(["passenger_segments_required"])).toEqual(["One-way flights (passenger segments) at this distance"])
  })
})
