// BF-01 part A (P0): the same bill saved twice is detected on the server. Repro H1 (auditor S12-02) first.
import { describe, expect, test } from "bun:test"
import { validateCollectionActivity, type CollectionActivityRecord, type CollectionContext, type CollectionEvidenceMetadata, type CompanySetupView } from "@neuvetra/database"
import { createScope1Engine } from "../calculation/scope1-authority"
import { createScope2Engine } from "../calculation/scope2-authority"
import { createScope3Engine } from "../calculation/scope3-authority"
import { buildCollectionResults, REVIEWED_SCOPE1_ENGINE_SHA256, REVIEWED_SCOPE2_ENGINE_SHA256 } from "./collection-results-routes"
import { buildScope3Results, REVIEWED_SCOPE3_ENGINE_SHA256 } from "./scope3-results-routes"
import { COLLECTION_DUPLICATE_POLICY, normalizedSourceId, periodsOverlapAsDuplicates, possibleDuplicateRecords, possibleDuplicatesCountedWarning } from "../../../../packages/neuvetra-database/src/collection-duplicates"
import { COLLECTION_SCOPE12_KINDS } from "../../../../packages/neuvetra-database/src/collection-contract"
import { SCOPE3_SETUP_CATEGORY_TOKENS } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { buildScope3ReportDocument, scope3ReportApprovalLines, scope3ReportCsv, scope3ReportText, validateScope3ReportDocument, type Scope3ReportDocument } from "../../../../packages/neuvetra-database/src/scope3-report-document"
import { scope3Csv } from "../../../../packages/neuvetra-database/src/scope3-report-csv"
import { SCOPE3_READINESS_WHY_TEXT } from "../../../../packages/neuvetra-database/src/scope3-text"
import { kindLabel, periodLabel, reasonText } from "../../../../packages/neuvetra-database/src/plain-language-labels"

const python = process.env.NEUVETRA_PYTHON ?? "python3"
const engines = {
  scope1: createScope1Engine({ python, expectedEngineSha256: REVIEWED_SCOPE1_ENGINE_SHA256 }),
  scope2: createScope2Engine({ python, expectedEngineSha256: REVIEWED_SCOPE2_ENGINE_SHA256 }),
}
const scope3Engine = createScope3Engine({ python, expectedEngineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })
const company = "7d000000-0000-4000-8000-000000000001", setup = "7d000000-0000-4000-8000-000000000002", office = "7d000000-0000-4000-8000-000000000003"
const owner = "7d000000-0000-4000-8000-0000000000a1"
const context: CollectionContext = { boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, companyId: company, setupVersionId: setup, setupRevision: 1, locations: [
  { id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, entity: null, start: null, endExclusive: null, startMode: "period_start", endMode: "period_end" }] } as CollectionContext
const year = { start: "2025-01-01", endExclusive: "2026-01-01" }
const common = { locationId: office, setupVersionId: setup, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, reference: "Synthetic", notes: "", evidenceIds: [] as string[], period: year }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
let n = 0
function record(activity: Record<string, unknown>): CollectionActivityRecord {
  const id = `7d000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  const parsed = validateCollectionActivity({ ...common, ...activity })
  const version = { id: `7e000000-0000-4000-8000-${String(n).padStart(12, "0")}`, recordId: id, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, activity: parsed, payloadSha256: "b".repeat(64), createdBy: owner, createdAt: `2025-06-01T00:00:${String(n % 60).padStart(2, "0")}.000Z` }
  return { id, companyId: company, kind: parsed.kind, currentVersion: version, history: [{ ...version, activity: undefined } as never] }
}
const setupView = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, history: [], currentVersion: { id: setup, companyId: company, revision: 1, previousVersionId: null, correctionReason: null, payloadSha256: "c".repeat(64), createdBy: owner, createdAt: "2025-06-01T00:00:00.000Z",
  setup: { company: { legalName: "Synthetic Co", tradingName: "", countryCode: "US", regionCode: "CA", industry: "", naics: "", preparerRole: "", additionalBusinessActivities: "", otherIndustry: "" }, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01", firstInventory: "yes", priorInventoryReference: "" },
    boundary: { approach: "operational_control", notes: "", hasParent: "no", parentName: "", includedOperations: "" }, entities: [], relationships: [], locations: [{ id: office, name: "Office", inclusion: "included" }], screening: [], changes: [], changeNotes: "", review: { acknowledged: true, notes: "" } } } } as unknown as CompanySetupView
const evidence: CollectionEvidenceMetadata[] = []
const gas = (sourceId = "GAS-1", therm = "1000") => record({ kind: "natural_gas", sourceId, quantity: q(therm, "therm"), payload: { heatContent: null } })
const TIMEOUT = 120_000

const power = (kwh: string, unit = "kWh", sourceId = "M-1", period = year) => record({ kind: "electricity", sourceId, period, quantity: q(kwh, unit), payload: { meterOrAccountNumber: sourceId, utilityName: "City & County of San Francisco", site: "Office", zip: "94105", subregion: "CAMX", utilityEiaId: "16612", instruments: [] } })
const withdraw = (r: CollectionActivityRecord): CollectionActivityRecord => ({ ...r, currentVersion: { ...r.currentVersion, revision: 2, activity: { ...r.currentVersion.activity, state: "withdrawn", withdrawalReason: "Entered twice." } } })
const build = (records: CollectionActivityRecord[], duplicatePolicy?: "hold" | "count_and_warn") => buildCollectionResults({ companyId: company, context, records, evidence, setup: setupView, engines, ...(duplicatePolicy ? { duplicatePolicy } : {}) })
const rowOf = (r: Awaited<ReturnType<typeof build>>, id: string) => r.records.find(row => row.recordId === id)!
const HOLD_TEXT = "This record matches another active record (same activity type, location and source ID; for Scope 3, also the same category and quantity) for overlapping dates, so it may be the same record entered twice. It isn’t counted until you withdraw one of them or correct its source ID, location or dates."
const COUNTED_TEXT = "This record matches another active record (same activity type, location and source ID; for Scope 3, also the same category and quantity) for overlapping dates, so it may be the same record entered twice. Both records are included in the total. If they are the same record, withdraw or correct one of them; if they are different records, no action is needed."
const WARNING_ONE = "These totals include 1 possible duplicate: a record that matches another active record for overlapping dates. Both records are counted. If they are the same record, withdraw or correct one of them; if they are different records, no action is needed."

describe("BF-01 the shared rule (possibleDuplicateRecords)", () => {
  test("the policy defaults to count_and_warn (CEO ruling, 12 November 2026)", () => expect(COLLECTION_DUPLICATE_POLICY).toBe("count_and_warn"))
  test("the warning and reason texts are record-neutral and say what to do", () => {
    expect(possibleDuplicatesCountedWarning(1)).toBe(WARNING_ONE)
    expect(possibleDuplicatesCountedWarning(2)).toBe("These totals include 2 possible duplicates: records that match another active record for overlapping dates. Both records of each pair are counted. Where two are the same record, withdraw or correct one of them; where they are different records, no action is needed.")
    expect(reasonText("possible_duplicate_counted")).toBe(COUNTED_TEXT)
    expect(reasonText("possible_duplicate_record")).toBe(HOLD_TEXT)
    for (const text of [WARNING_ONE, COUNTED_TEXT, HOLD_TEXT]) expect(text).not.toContain("bill")
  })
  test("normalises source IDs: trim, NFC, en-US lower case, whitespace collapsed", () => {
    expect(normalizedSourceId("  M-1 ")).toBe("m-1")
    expect(normalizedSourceId("Gas\t  Meter\n 1")).toBe("gas meter 1")
    expect(normalizedSourceId("Café")).toBe(normalizedSourceId("Café"))
  })
  test("partial overlap is flagged; consecutive half-open periods are not", () => {
    const a = power("1000", "kWh", "M-1", { start: "2025-01-05", endExclusive: "2025-02-05" }), b = power("1000", "kWh", "M-1", { start: "2025-02-01", endExclusive: "2025-03-04" })
    expect([...possibleDuplicateRecords([a, b])]).toEqual([[b.id, a.id]])
    const jan = power("1000", "kWh", "M-1", { start: "2025-01-01", endExclusive: "2025-02-01" }), feb = power("1000", "kWh", "M-1", { start: "2025-02-01", endExclusive: "2025-03-01" })
    expect(possibleDuplicateRecords([jan, feb]).size).toBe(0)
  })
  test("the same bill under different source IDs (two meters) is not flagged; \"m-1 \" against \"M-1\" is", () => {
    expect(possibleDuplicateRecords([power("1000", "kWh", "M-1"), power("1000", "kWh", "M-2")]).size).toBe(0)
    const a = power("1000", "kWh", "M-1"), b = power("1000", "kWh", "m-1 ")
    expect([...possibleDuplicateRecords([a, b])]).toEqual([[b.id, a.id]])
  })
  test("not transitive: a record names the earliest-saved record it actually overlaps (QA B1, B3)", () => {
    const a = power("1", "kWh", "M-1", { start: "2025-01-01", endExclusive: "2025-02-01" }), b = power("1", "kWh", "M-1", { start: "2025-01-20", endExclusive: "2025-03-01" }), c = power("1", "kWh", "M-1", { start: "2025-02-20", endExclusive: "2025-04-01" })
    // Saved a, b, c: b overlaps a, c overlaps b only.
    expect(Object.fromEntries(possibleDuplicateRecords([a, b, c]))).toEqual({ [b.id]: a.id, [c.id]: b.id })
    // a saved last: it overlaps b (saved first); c overlaps b too. Nobody names a record it does not overlap.
    const later = { ...a, history: [{ createdAt: "2026-01-01T00:00:00.000Z" }] } as CollectionActivityRecord
    expect(Object.fromEntries(possibleDuplicateRecords([later, b, c]))).toEqual({ [a.id]: b.id, [c.id]: b.id })
    const tieA = { ...a, history: [{ createdAt: "2025-01-01T00:00:00.000Z" }] } as CollectionActivityRecord, tieB = { ...b, history: [{ createdAt: "2025-01-01T00:00:00.000Z" }] } as CollectionActivityRecord
    expect(Object.fromEntries(possibleDuplicateRecords([tieB, tieA]))).toEqual({ [b.id]: a.id })
  })
  test("a shared meter-read day (one day: the last of one record, the first of the other) is not an overlap; a longer or contained one is", () => {
    const p = (start: string, endExclusive: string) => ({ start, endExclusive })
    expect(periodsOverlapAsDuplicates(p("2025-01-01", "2025-02-02"), p("2025-02-01", "2025-03-02"))).toBe(false)
    expect(periodsOverlapAsDuplicates(p("2025-02-01", "2025-03-02"), p("2025-01-01", "2025-02-02"))).toBe(false)
    expect(periodsOverlapAsDuplicates(p("2025-01-01", "2025-02-03"), p("2025-02-01", "2025-03-02"))).toBe(true)
    // One-day records on the same day, and a one-day record inside a longer one, still overlap.
    expect(periodsOverlapAsDuplicates(p("2025-07-14", "2025-07-15"), p("2025-07-14", "2025-07-15"))).toBe(true)
    expect(periodsOverlapAsDuplicates(p("2025-07-01", "2025-08-01"), p("2025-07-14", "2025-07-15"))).toBe(true)
    // A one-day record on the last day of a month record: it starts on the shared day but is contained, so it overlaps.
    expect(periodsOverlapAsDuplicates(p("2025-07-01", "2025-08-01"), p("2025-07-31", "2025-08-01"))).toBe(true)
    expect(periodsOverlapAsDuplicates(p("2025-01-01", "2025-02-01"), p("2025-02-01", "2025-03-01"))).toBe(false)
  })
  test("QA B1: twelve monthly bills whose dates share a meter-read day are not possible duplicates of each other", () => {
    const starts = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}-01`)
    const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    const bills = starts.map((start, i) => power("10000", "kWh", "M-1", { start, endExclusive: i === 11 ? "2026-01-01" : nextDay(starts[i + 1]!) }))
    expect(possibleDuplicateRecords(bills).size).toBe(0)
  })
  test("QA B2/B3: the location is part of the key (two sites each with a \"Main meter\")", () => {
    const a = power("1000", "kWh", "Main meter"), b = { ...power("1000", "kWh", "Main meter") }
    const elsewhere = { ...b, currentVersion: { ...b.currentVersion, activity: { ...b.currentVersion.activity, locationId: "7d000000-0000-4000-8000-0000000000ff" } } } as CollectionActivityRecord
    expect(possibleDuplicateRecords([a, elsewhere]).size).toBe(0)
    expect(possibleDuplicateRecords([a, b]).size).toBe(1)
  })
  test("only active records, never a different kind, and never a record confirmed distinct", () => {
    const a = gas(), b = gas()
    expect(possibleDuplicateRecords([a, withdraw(b)]).size).toBe(0)
    expect(possibleDuplicateRecords([gas("X"), power("1000", "kWh", "X")]).size).toBe(0)
    const confirmed = { ...b, currentVersion: { ...b.currentVersion, activity: { ...b.currentVersion.activity, payload: { heatContent: null, duplicateConfirmedDistinct: true } } } } as unknown as CollectionActivityRecord
    expect(possibleDuplicateRecords([a, confirmed]).size).toBe(0)
  })
  test("the module's Scope 1 and 2 kinds are the contract's", () => {
    // A Scope 1/2 kind compares without the quantity: the same meter as 100,000 kWh and as 100 MWh is flagged.
    for (const kind of COLLECTION_SCOPE12_KINDS) {
      const make = (value: string) => ({ id: `${kind}-${value}`, kind, currentVersion: { activity: { state: "active", sourceId: "S", locationId: office, period: year, quantity: { originalValue: value, originalUnit: "u", normalizedValue: value, normalizedUnit: "u" }, payload: {} } }, history: [{ createdAt: value }] })
      expect([kind, possibleDuplicateRecords([make("1"), make("2")]).size]).toEqual([kind, 1])
    }
  })
})

describe("BF-01 possible duplicate records (Scope 1 and 2 results)", () => {
  test("H1 in hold mode: the same gas record saved twice is counted once", async () => {
    const a = gas(), b = gas()
    const r = await build([a, b], "hold")
    expect(r.scope1?.knownSourceSubtotal.display).toBe("5311.4500")
    expect(rowOf(r, a.id)).toMatchObject({ outcome: "calculated", plan: { action: "calculate", notes: ["has_possible_duplicates:1"] } })
    expect(rowOf(r, b.id)).toMatchObject({ outcome: "held", inSubtotal: { scope1: false }, plan: { action: "hold", status: "input_needed", reasons: ["possible_duplicate_record"], notes: [`possible_duplicate_of:${a.id}`] } })
    expect(r.counts).toMatchObject({ records: 2, calculated: 1, inputNeeded: 1, held: 1 })
    expect(r.scope1?.includedResults.length).toBe(1)
    expect(r.warnings).toEqual([])
    expect(reasonText("possible_duplicate_record")).toBe(HOLD_TEXT)
  }, TIMEOUT)
  test("H1 in count mode (the default): both are counted (10622.9000), with the warning and the note", async () => {
    const a = gas(), b = gas()
    const r = await build([a, b])
    expect(r.scope1?.knownSourceSubtotal.display).toBe("10622.9000")
    expect(r.warnings).toEqual([WARNING_ONE])
    expect(rowOf(r, b.id)).toMatchObject({ outcome: "calculated", plan: { action: "calculate", reasons: [], notes: [`possible_duplicate_of:${a.id}`] } })
    expect(r.counts).toMatchObject({ calculated: 2, inputNeeded: 0 })
  }, TIMEOUT)
  test("H1b: the same meter as 100,000 kWh and as 100 MWh gives the single-bill location-based figure", async () => {
    const a = power("100000"), b = power("100", "MWh")
    const single = await build([a])
    const r = await build([a, b], "hold")
    expect(r.scope2?.locationBasedSubtotal.display).toBe(single.scope2!.locationBasedSubtotal.display)
    expect(Number(r.scope2!.locationBasedSubtotal.display)).toBeCloseTo(19502.61, 2)
    expect(rowOf(r, b.id).plan.reasons).toEqual(["possible_duplicate_record"])
    const counted = await build([a, b], "count_and_warn")
    expect(counted.scope2?.locationBasedSubtotal.display).toBe("39005.2244")
  }, TIMEOUT)
  test("withdrawing the duplicate restores the single-record subtotal with no warning and no note", async () => {
    const a = gas(), b = gas()
    const alone = await build([a])
    for (const policy of ["hold", "count_and_warn"] as const) {
      const r = await build([a, withdraw(b)], policy)
      expect(r.scope1?.knownSourceSubtotal.display).toBe("5311.4500")
      expect(r.warnings).toEqual([])
      expect(rowOf(r, a.id).plan).toEqual(rowOf(alone, a.id).plan)
    }
  }, TIMEOUT)
  test("withdrawn, excluded and outside-period keep their precedence over the duplicate hold", async () => {
    // Reporting period January to June: the second bill (June to July) overlaps the first but is partly outside the period.
    const half = { start: "2025-01-01", endExclusive: "2025-07-01" }
    const a = record({ kind: "natural_gas", sourceId: "GAS-1", period: half, quantity: q("500", "therm"), payload: { heatContent: null } })
    const outside = record({ kind: "natural_gas", sourceId: "GAS-1", period: { start: "2025-06-01", endExclusive: "2025-08-01" }, quantity: q("1000", "therm"), payload: { heatContent: null } })
    const base = setupView.currentVersion!
    const halfSetup = { ...setupView, currentVersion: { ...base, setup: { ...base.setup, reportingPeriod: { ...base.setup.reportingPeriod, ...half } } } } as unknown as CompanySetupView
    const r = await buildCollectionResults({ companyId: company, context: { ...context, reportingPeriod: half }, records: [a, outside], evidence, setup: halfSetup, engines, duplicatePolicy: "hold" })
    expect(rowOf(r, outside.id)).toMatchObject({ periodCheck: "partial", plan: { notes: [] } })
    expect(rowOf(r, outside.id).plan.reasons).not.toContain("possible_duplicate_record")
    expect(r.counts).toMatchObject({ outsidePeriod: 1, inputNeeded: 0 })
  }, TIMEOUT)
  test("responses without duplicates are unchanged", async () => {
    const records = [gas("GAS-1"), gas("GAS-2"), power("1000", "kWh", "M-1"), power("1000", "kWh", "M-2")]
    for (const policy of ["hold", "count_and_warn"] as const) {
      const r = await build(records, policy)
      expect(r.records.every(row => row.plan.notes.every(note => !note.includes("duplicate")) && !row.plan.reasons.includes("possible_duplicate_record"))).toBe(true)
      expect(r.warnings).toEqual([])
    }
  }, TIMEOUT)
})

// --- Scope 3 ---
type Screen = "unknown" | "yes" | "no" | "not_applicable"
function scope3Setup(screen: Partial<Record<number, Screen>>): CompanySetupView {
  const screening = Object.entries(screen).map(([category, state]) => ({ id: `s3-${category}`, scope: 3, category: SCOPE3_SETUP_CATEGORY_TOKENS[Number(category) - 1]!, state, reason: state === "no" || state === "not_applicable" ? "Synthetic screening reason." : "", details: "", locationId: null }))
  const base = setupView.currentVersion!
  return { ...setupView, currentVersion: { ...base, setup: { ...base.setup, locations: [{ id: office, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }], screening } } } as unknown as CompanySetupView
}
const included: Partial<Record<number, Screen>> = { 3: "yes", 6: "yes" }
const build3 = (records: CollectionActivityRecord[], duplicatePolicy?: "hold" | "count_and_warn") =>
  buildScope3Results({ companyId: company, context: { ...context, sameContentSetupVersionIds: [setup] } as CollectionContext, records, evidence, setup: scope3Setup(included), engine: scope3Engine, now: () => new Date("2026-11-12T00:00:00Z"), ...(duplicatePolicy ? { duplicatePolicy } : {}) })
const trip = (miles = "2400", sourceId = "T-1") => record({ kind: "business_travel", sourceId, quantity: q(miles, "mile"), payload: { mode: "air", passengerSegments: 4, haulBasis: null } })
const category = (r: Awaited<ReturnType<typeof build3>>, n: number) => r.coverage.categories.find(row => row.category === n)!

describe("BF-01 possible duplicate records (Scope 3 results)", () => {
  test("S11: identical business travel is counted once in category 6 (hold mode)", async () => {
    const a = trip(), b = trip()
    const single = await build3([a])
    expect(category(single, 6).subtotal?.display).toBe("1578.1901")
    const r = await build3([a, b], "hold")
    expect(category(r, 6).subtotal?.display).toBe("1578.1901")
    const held = r.records.find(row => row.recordId === b.id)!
    expect(held).toMatchObject({ outcome: "held", plan: { action: "hold", status: "input_needed", reasons: ["possible_duplicate_record"], notes: [`possible_duplicate_of:${a.id}`] } })
    expect(category(r, 6).status).toBe("input_needed")
    expect(r.readiness.openIssues).toContainEqual({ category: 6, code: "input_needed" })
    const counted = await build3([a, b])
    expect(category(counted, 6).subtotal?.display).toBe("3156.3802")
    expect(counted.warnings).toContain(WARNING_ONE)
  }, TIMEOUT)
  test("two trips with the same source ID but different miles are not flagged", async () => {
    const r = await build3([trip("2400"), trip("1800")])
    expect(r.records.every(row => !row.plan.reasons.includes("possible_duplicate_record") && row.plan.notes.every(note => !note.startsWith("possible_duplicate_of:")))).toBe(true)
  }, TIMEOUT)
  test("a duplicated electricity record holds its derived 3C, 3C upstream and 3B lines too (hold mode)", async () => {
    const a = power("250000"), b = power("250000")
    const r = await build3([a, b], "hold")
    const lines = r.records.filter(row => row.recordId === b.id)
    expect(lines.map(row => row.kind)).toEqual(["td_losses", "td_losses_upstream", "electricity_upstream"])
    for (const line of lines) expect([line.kind, line.outcome, line.plan.reasons.includes("possible_duplicate_record")]).toEqual([line.kind, "held", true])
    expect(r.records.filter(row => row.recordId === a.id).every(row => row.outcome === "calculated")).toBe(true)
    const counted = await build3([a, b], "count_and_warn")
    expect(counted.records.filter(row => row.recordId === b.id).every(row => row.outcome === "calculated" && row.plan.notes.includes(`possible_duplicate_of:${a.id}`))).toBe(true)
  }, TIMEOUT)
  test("a frozen version prepared with a held duplicate shows the reason in its CSV and lists it as an open issue", async () => {
    const a = trip(), b = trip()
    const r = await build3([a, b], "hold")
    const document = buildScope3ReportDocument({ results: r, reportingYear: 2025, revision: 1, setupVersionId: setup, consolidationApproach: "operational_control", preparedBy: owner, preparedAt: "2026-11-12T00:00:00.000Z", previous: null })
    const stored = validateScope3ReportDocument(JSON.parse(scope3ReportText(document)), company) as Scope3ReportDocument
    expect(stored.results.readiness?.openIssues).toContainEqual({ category: 6, code: "input_needed" })
    const csv = scope3ReportCsv(stored, { kind: kindLabel, reason: reasonText, period: periodLabel })
    const line = csv.split("\n").find(text => text.startsWith("Record,") && text.includes(b.id))!
    expect(line).toContain("Needs input")
    expect(line).toContain("matches another active record")
    // Count mode: the counted duplicate's CSV line carries the possible_duplicate_counted words.
    const counted = await build3([a, b], "count_and_warn")
    const countedLine = scope3Csv(counted, { kind: kindLabel, reason: reasonText, period: periodLabel }).split("\n").find(text => text.startsWith("Record,") && text.includes(b.id))!
    expect(countedLine).toContain(reasonText("possible_duplicate_counted"))
  }, TIMEOUT)
})

// QA of PR #48 (B1–B3) and the CEO's ruling: count mode is the default, and a counted possible duplicate needs an
// acknowledgement before a Scope 3 version can be approved (readiness `needs_review`, a code 0030 already accepts).
describe("BF-01 count mode: readiness, naming and QA scenarios", () => {
  const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  const starts = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}-01`)
  test("a counted possible duplicate makes its category needs_review; the frozen version lists it, so approval needs an acknowledgement", async () => {
    const a = trip(), b = trip()
    const r = await build3([a, b])
    expect(category(r, 6).status).toBe("calculated")
    expect(r.readiness.openIssues).toContainEqual({ category: 6, code: "needs_review" })
    expect(r.readiness.ready).toBe(false)
    const document = buildScope3ReportDocument({ results: r, reportingYear: 2025, revision: 1, setupVersionId: setup, consolidationApproach: "operational_control", preparedBy: owner, preparedAt: "2026-11-12T00:00:00.000Z", previous: null })
    const stored = validateScope3ReportDocument(JSON.parse(scope3ReportText(document)), company) as Scope3ReportDocument
    expect(stored.results.readiness?.openIssues).toContainEqual({ category: 6, code: "needs_review" })
    // The 0030 gate accepts exactly these codes (prepare_scope3_report_version); the issue uses one of them.
    for (const issue of stored.results.readiness!.openIssues) expect(["input_needed", "screening_conflict", "needs_review", "assessment_missing", "included_category_has_no_records"]).toContain(issue.code)
    // Without the possible duplicate, category 6 has no needs_review issue.
    const single = await build3([a])
    expect(single.readiness.openIssues).not.toContainEqual({ category: 6, code: "needs_review" })
  }, TIMEOUT)
  test("a duplicated electricity record's derived lines make category 3 needs_review in count mode", async () => {
    const r = await build3([power("250000"), power("250000")])
    expect(r.readiness.openIssues).toContainEqual({ category: 3, code: "needs_review" })
  }, TIMEOUT)
  test("QA B1: twelve monthly bills sharing meter-read days count in full in both modes, with no warning", async () => {
    const bills = starts.map((start, i) => power("10000", "kWh", "M-1", { start, endExclusive: i === 11 ? "2026-01-01" : nextDay(starts[i + 1]!) }))
    for (const policy of ["hold", "count_and_warn"] as const) {
      const r = await build(bills, policy)
      expect([policy, r.scope2?.locationBasedSubtotal.display, r.counts.calculated, r.warnings]).toEqual([policy, "23403.1346", 12, []])
    }
  }, TIMEOUT)
  test("QA B3: a stray annual record saved after twelve monthly bills names January, the record it overlaps first; only it is flagged", async () => {
    const monthly = starts.map((start, i) => power("10000", "kWh", "M-1", { start, endExclusive: i === 11 ? "2026-01-01" : starts[i + 1]! }))
    const annual = power("120000")
    const hold = await build([...monthly, annual], "hold")
    expect(hold.scope2?.locationBasedSubtotal.display).toBe("23403.1346")
    expect(rowOf(hold, annual.id).plan.notes).toEqual([`possible_duplicate_of:${monthly[0]!.id}`])
    expect(hold.records.filter(row => row.plan.reasons.includes("possible_duplicate_record")).map(row => row.recordId)).toEqual([annual.id])
    const counted = await build([...monthly, annual])
    expect(counted.scope2?.locationBasedSubtotal.display).toBe("46806.2692")
    expect(counted.warnings).toEqual([WARNING_ONE])
  }, TIMEOUT)
  test("QA B3: a record at another site with the same source ID is not a possible duplicate", async () => {
    const plant = "7d000000-0000-4000-8000-0000000000ff"
    const twoSites = { ...context, locations: [...context.locations, { ...context.locations[0]!, id: plant, name: "Plant" }] } as CollectionContext
    const base = setupView.currentVersion!
    const twoSetup = { ...setupView, currentVersion: { ...base, setup: { ...base.setup, locations: [...base.setup.locations, { id: plant, name: "Plant", inclusion: "included" }] } } } as unknown as CompanySetupView
    const a = power("50000", "kWh", "Main meter"), b = record({ ...a.currentVersion.activity, locationId: plant, quantity: q("80000", "kWh") } as unknown as Record<string, unknown>)
    for (const policy of ["hold", "count_and_warn"] as const) {
      const r = await buildCollectionResults({ companyId: company, context: twoSites, records: [a, b], evidence, setup: twoSetup, engines, duplicatePolicy: policy })
      expect([policy, r.counts.calculated, r.warnings, r.records.every(row => row.plan.notes.length === 0)]).toEqual([policy, 2, [], true])
    }
  }, TIMEOUT)
})

// BF-01c (QA follow-ups of PR #48): the Scope 3 CSV's Category and Total rows carry the Scope 1 and 2 Subtotal sentence when
// counted possible duplicates are in their figures, and a newly prepared version's frozen "Lines need review" says why.
// Stored versions keep their stored bytes (the CSV is written once, at prepare; see the PR for the byte comparison).
describe("BF-01c: the Scope 3 CSV and frozen readiness name counted possible duplicates", () => {
  const labels = { kind: kindLabel, reason: reasonText, period: periodLabel }
  const rowsOf = (csv: string, section: string) => csv.split("\n").filter(text => text.startsWith(`${section},`))
  test("count mode: category 6 and the Total row say the figure may be overstated; without duplicates neither does", async () => {
    const a = trip(), b = trip()
    const counted = await build3([a, b])
    const csv = scope3Csv(counted, labels)
    const cat6 = rowsOf(csv, "Category").find(text => text.startsWith("Category,6,"))!
    expect(cat6).toContain("Includes 1 possible duplicate: this figure may be overstated.")
    expect(rowsOf(csv, "Category").filter(text => text.includes("may be overstated"))).toHaveLength(1)
    expect(rowsOf(csv, "Total")[0]).toStartWith("Total,Known-source Scope 3 subtotal (known sources only). Includes 1 possible duplicate: this figure may be overstated.,3156.3802,")
    const single = scope3Csv(await build3([a]), labels)
    expect(single).not.toContain("may be overstated")
    expect(rowsOf(single, "Total")[0]).toStartWith("Total,Known-source Scope 3 subtotal (known sources only),1578.1901,")
    // Hold mode: the held duplicate is in no figure, so nothing is said to be overstated.
    expect(scope3Csv(await build3([a, b], "hold"), labels)).not.toContain("may be overstated")
  }, TIMEOUT)
  test("a newly prepared version's frozen open issue says why lines need review; the approval lines keep their words", async () => {
    const a = trip(), b = trip()
    const r = await build3([a, b])
    const document = buildScope3ReportDocument({ results: r, reportingYear: 2025, revision: 1, setupVersionId: setup, consolidationApproach: "operational_control", preparedBy: owner, preparedAt: "2026-11-12T00:00:00.000Z", previous: null })
    const stored = validateScope3ReportDocument(JSON.parse(scope3ReportText(document)), company) as Scope3ReportDocument
    const csv = scope3ReportCsv(stored, labels)
    expect(csv).toContain("# Open issue, category 6: Lines need review: 1 counted line may repeat another record (possible duplicate, counted; confirm or withdraw).")
    expect(csv).not.toContain("# Open issue, category 6: Lines need review.")
    expect(scope3ReportApprovalLines({ approval: { approvedBy: owner, approvedAt: "2026-11-12T00:00:00.000Z", acknowledgedOpenIssues: [{ category: 6, code: "needs_review" }], selfApproved: false, selfApprovalConfirmed: false } as never }))
      .toContain("Open issue, category 6: Lines need review.")
    // Without a counted possible duplicate the frozen words stay exactly as before (engine review only), so versions prepared
    // from data without duplicates are byte-identical; with both, both reasons are named.
    expect(SCOPE3_READINESS_WHY_TEXT.needsReview(2, 0)).toBe("Lines need review")
    expect(SCOPE3_READINESS_WHY_TEXT.needsReview(1, 2)).toBe("Lines need review: 1 line returned for review by the calculation (not counted); 2 counted lines may repeat another record (possible duplicates, counted; confirm or withdraw)")
  }, TIMEOUT)
})
