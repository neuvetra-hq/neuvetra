// Claude UX journey (2026-09-29): the guided flow's pure logic — help matching, plain-language display, results decoding
// and progress — never invents a value and keeps the reviewed wording.
import { describe, expect, test } from "bun:test"
import { HELP_ENTRIES, isProgressQuestion, matchQuestion } from "./help-content"
import { groupDigits, kgToTonnes, periodLabel, reasonText, RECORD_STATE_LABELS } from "./plain-language"
import { decodeResults, resultsCsv, RESULTS_PROFILE } from "./results-api"
import { computeJourneyStatus, coverageGaps, coverageIssues, coverageLines, periodFit, progressAnswer, recordState, setupMissing, type JourneyRecord } from "./journey-status"
import { rowReasons, rowStatus } from "./results-view"

const company = "29200000-0000-4000-8000-000000000001"
const record = "29500000-0000-4000-8000-000000000001"

describe("Ask Neuvetra help matching", () => {
  test("answers known questions from the reviewed entries", () => {
    expect(matchQuestion("why do you need my zip code")?.entry.id).toBe("zip")
    expect(matchQuestion("What is SB 253?")?.entry.id).toBe("sb253")
    expect(matchQuestion("location vs market based scope 2")?.entry.id).toBe("location-market")
    expect(matchQuestion("how do I enter refrigerant top ups")?.entry.id).toBe("refrigerant")
    expect(matchQuestion("what does CO2e mean")?.entry.id).toBe("co2e")
  })
  test("near-miss questions reach the right entry, not a keyword neighbour", () => {
    expect(matchQuestion("how do I add a gas bill")?.entry.id).toBe("add-record")
    expect(matchQuestion("is this report audit ready")?.entry.id).toBe("draft")
    expect(matchQuestion("can I upload a spreadsheet of all my bills")?.entry.id).toBe("import")
    expect(matchQuestion("why do you need the heat content")?.entry.id).toBe("heat-content")
    expect(matchQuestion("how do I add a new site")?.entry.id).toBe("add-site")
    expect(matchQuestion("can I change my reporting year")?.entry.id).toBe("reporting-period")
    expect(matchQuestion("what if the landlord pays the electricity")?.entry.id).toBe("no-electricity")
    expect(matchQuestion("which sites should I include")?.entry.id).toBe("sites")
    expect(matchQuestion("when is limited assurance required")?.entry.id).toBe("sb253")
    expect(matchQuestion("do I need to report scope 3 in 2027")?.entry.id).toBe("sb253")
    expect(matchQuestion("how do I close a possible gap")?.entry.id).toBe("incomplete")
    expect(matchQuestion("what does not sure yet do to my report")?.entry.id).toBe("incomplete")
    expect(matchQuestion("our generator runs on propane")?.entry.id).toBe("other-fuels")
    expect(matchQuestion("how do I report generator diesel")?.entry.id).toBe("generator")
  })
  test("declines instead of guessing when nothing matches", () => {
    expect(matchQuestion("what is the weather tomorrow")).toBeNull()
    expect(matchQuestion("how much does neuvetra cost")).toBeNull()
    expect(matchQuestion("the report")).toBeNull()
    expect(matchQuestion("")).toBeNull()
  })
  test("routes progress questions to the user's own data", () => {
    expect(isProgressQuestion("What's left to do?")).toBe(true)
    expect(isProgressQuestion("what should I do next")).toBe(true)
    expect(isProgressQuestion("what is scope 2")).toBe(false)
  })
  test("every entry has a question, keywords and an answer", () => {
    for (const entry of HELP_ENTRIES) { expect(entry.question.length).toBeGreaterThan(5); expect(entry.keywords.length).toBeGreaterThan(2); expect(entry.answer.length).toBeGreaterThan(0) }
    expect(new Set(HELP_ENTRIES.map(entry => entry.id)).size).toBe(HELP_ENTRIES.length)
  })
})

describe("plain-language display", () => {
  test("groups digits without changing any digit", () => {
    expect(groupDigits("116323.7905")).toBe("116,323.7905")
    expect(groupDigits("12")).toBe("12")
    expect(groupDigits("not a number")).toBe("not a number")
  })
  test("tonnes are a display conversion only", () => {
    expect(kgToTonnes("116323.7905")).toBe("116.32")
    expect(kgToTonnes(null)).toBe("—")
    expect(kgToTonnes("")).toBe("—")
  })
  test("shows the inclusive last day of an exclusive period", () => {
    expect(periodLabel("2025-01-01", "2026-01-01")).toBe("Jan 1 – Dec 31, 2025")
    expect(periodLabel(null, null)).toBe("Period not set")
  })
  test("keeps the reviewed status words", () => {
    expect(RECORD_STATE_LABELS.input_needed).toBe("Input needed")
    expect(RECORD_STATE_LABELS.excluded).toBe("Excluded")
    expect(RECORD_STATE_LABELS.withdrawn).toBe("Withdrawn")
  })
  test("translates adapter and engine codes, and never hides an unknown code", () => {
    expect(reasonText("location_excluded_by_company_setup")).toMatch(/excluded/)
    expect(reasonText("ch4_n2o_missing")).toMatch(/CH4 and N2O/)
    expect(reasonText("model_year_proxy:2007-2022")).toMatch(/2007-2022/)
    expect(reasonText("some_new_code")).toBe("Some new code.")
  })
})

const s1 = (status: string, display: string | null) => ({ methodVersionId: "scope1.stationary.natural_gas.v2", gwpSetId: "AR5-100", status, gases: {}, missingGases: [], estimates: [], findings: [], memo: null, factorsUsed: [], total: display ? { unrounded: display, display, unit: "kg CO2e", rounding: "half_even_4dp" } : null, resultSha256: "a".repeat(64) })
const row = (extra: Record<string, unknown>) => ({ recordId: record, versionId: record, revision: 1, kind: "natural_gas", scope: 1, sourceId: "GAS-1", locationId: record, locationName: "Office", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, quantity: { value: "10", unit: "therm" }, quality: "actual", estimateBasis: null, evidenceCount: 0, evidence: [], plan: { action: "calculate", status: null, reasons: [], notes: [] }, periodCheck: "inside", outcome: "calculated", refusalCode: null, scope1: s1("complete", "53.1180"), scope2: null, ...extra })
const response = (records: unknown[]) => ({ profile: RESULTS_PROFILE, label: "Draft", syntheticOnly: true, generatedAt: "2026-09-29T00:00:00.000Z", companyId: company, setup: null, records, scope1: null, scope2: null, counts: { records: records.length, calculated: 1, held: 0, withdrawn: 0, excluded: 0, inputNeeded: 0, outsidePeriod: 0, unavailable: 0 }, warnings: [] })

describe("draft results decoding", () => {
  test("accepts the contract and rejects anything else", () => {
    expect(decodeResults(response([row({})]), company).records).toHaveLength(1)
    expect(() => decodeResults({ ...response([]), profile: "other" }, company)).toThrow()
    expect(() => decodeResults(response([]), "29200000-0000-4000-8000-000000000009")).toThrow()
    expect(() => decodeResults(response([row({ scope1: s1("complete", "12,5") })]), company)).toThrow()
    expect(() => decodeResults(response([row({ scope1: null })]), company)).toThrow()
  })
  test("records outside the reporting period are held pending correction and can't arrive calculated", () => {
    const outside = row({ outcome: "held", scope1: null, periodCheck: "outside" })
    expect(rowStatus(outside as never).label).toBe("Held pending correction")
    expect(rowReasons(outside as never)[0]).toMatch(/outside the reporting period/)
    expect(() => decodeResults(response([row({ periodCheck: "outside" })]), company)).toThrow()
    expect(() => decodeResults(response([row({ periodCheck: undefined })]), company)).toThrow()
  })
  test("held records keep the reviewed labels and never show a number", () => {
    expect(rowStatus(row({ outcome: "held", scope1: null, plan: { action: "hold", status: "input_needed", reasons: ["quantity_not_calculable"], notes: [] } }) as never).label).toBe("Input needed")
    expect(rowStatus(row({ outcome: "held", scope1: null, plan: { action: "hold", status: "excluded", reasons: [], notes: [] } }) as never).label).toBe("Excluded")
    expect(rowStatus(row({ scope1: s1("partial", "10.0000") }) as never).label).toBe("Partial calculation")
  })
  test("the CSV carries the engine's exact figures and a draft header", () => {
    const csv = resultsCsv(decodeResults({ ...response([row({})]), scope1: { knownSourceSubtotal: { unrounded: "53.1180", display: "53.1180", unit: "kg CO2e", rounding: "half_even_4dp_once" }, includedResults: ["a".repeat(64)], incompleteResults: [], notCalculated: [], reportedOutsideScopes: [], resultCount: 1, complete: true } }, company), { kind: kind => kind, reason: code => code, status: () => "Calculated", boundary: code => code, period: () => "Jan 1 – Dec 31, 2025" })
    expect(csv.startsWith("# Draft")).toBe(true)
    expect(csv).toContain("# Reporting period: Jan 1 – Dec 31, 2025")
    expect(csv).toContain(",Calculated,complete,Yes,53.1180,")
    expect(csv).toContain("Subtotal,Scope 1,")
  })
  test("the CSV carries completeness and coverage lines, and neutralises formula-like text", () => {
    const csv = resultsCsv(decodeResults(response([row({ sourceId: "=HYPERLINK(1)" })]), company), { kind: kind => kind, reason: code => code, status: () => "Calculated", boundary: code => code, period: () => "2025", quality: () => "Actual", unit: () => "therms",
      completeness: { scope1: "Incomplete — 1 setup answer still open", scope2Location: "No calculated meters", scope2Market: "No calculated meters" }, coverage: ["Open in company setup: Answer “Cooling”.\nNext line"] })
    expect(csv).toContain("# Completeness, Scope 1: Incomplete — 1 setup answer still open")
    expect(csv).toContain("# Open in company setup: Answer “Cooling”. Next line")
    expect(csv).toContain(",'=HYPERLINK(1),")
    expect(csv).toContain(",therms,Actual,")
  })
})

describe("journey progress", () => {
  test("an empty workspace starts with company setup", () => {
    const status = computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true })
    expect(status.next.panel).toBe("setup")
    expect(status.progress.setup).toBe("not_started")
    expect(setupMissing(null).map(item => item.title)).toEqual(["Save your company setup"])
    expect(progressAnswer(status)[0]).toMatch(/Set up your company/)
  })
  test("setup answers without matching records are gaps, never complete", () => {
    const office = "29400000-0000-4000-8000-000000000001"
    const view = { currentVersion: { setup: { screening: [{ id: "s3", category: "Road & off-road vehicles", state: "yes", details: "" }, { id: "s4", category: "Cooling & fire suppression", state: "no", details: "" }], locations: [{ id: office, name: "Office", inclusion: "included", operatorDetails: "" }] } } } as never
    const gas: JourneyRecord = { id: "r", kind: "natural_gas", label: "Natural gas", sourceId: "G", locationId: office, site: "Office", state: "ready", reasons: [], evidenceCount: 1, quality: "actual" }
    const gaps = coverageGaps(view, [gas])
    expect(gaps.map(gap => gap.id)).toEqual(["screen-s3", `electricity-${office}`])
    expect(gaps[0]!.title).toBe("Setup says you have vehicles, but there are no vehicle records yet")
    expect(coverageGaps(view, [gas, { ...gas, id: "v", kind: "vehicle" }, { ...gas, id: "e", kind: "electricity" }])).toEqual([])
    expect(coverageGaps(view, [gas, { ...gas, id: "v", kind: "vehicle", state: "withdrawn" }, { ...gas, id: "e", kind: "electricity" }]).map(gap => gap.id)).toEqual(["screen-s3"])
  })
  test("“Not sure yet” answers and undecided sites stay open and are never read as complete", () => {
    const office = "29400000-0000-4000-8000-000000000001", depot = "29400000-0000-4000-8000-000000000002"
    const setup = { company: { legalName: "Acme" }, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: { approach: "operational_control" },
      screening: [{ id: "s4", category: "Cooling & fire suppression", state: "unknown", details: "" }, { id: "s3", category: "Road & off-road vehicles", state: "no", details: "" }],
      locations: [{ id: office, name: "Office", inclusion: "included", operatorDetails: "Landlord pays electricity" }, { id: depot, name: "Depot", inclusion: "unknown", operatorDetails: "" }] }
    const view = { currentVersion: { revision: 1, setup } } as never
    const open = setupMissing(view)
    expect(open.map(item => item.id)).toEqual([`site-${depot}`, "screen-s4"])
    expect(open[1]!.title).toContain("Cooling & fire suppression")
    expect(open[1]!.scopes).toEqual([1])
    const gaps = coverageGaps(view, [])
    expect(gaps.map(gap => gap.id)).toEqual([`electricity-${office}`])
    expect(gaps[0]!.note).toBe("Landlord pays electricity")
    const coverage = { state: "ready" as const, setupOpen: open, gaps }
    expect(coverageIssues(coverage, 1)).toEqual({ open: 2, gaps: 0, unchecked: false })
    expect(coverageIssues(coverage, 2)).toEqual({ open: 1, gaps: 1, unchecked: false })
    expect(coverageIssues({ state: "unavailable" }, 1).unchecked).toBe(true)
    expect(coverageLines({ state: "unavailable" })[0]).toMatch(/Coverage check unavailable/)
    expect(coverageLines(coverage).join(" ")).toContain("Site note (04 Locations): Landlord pays electricity")
    const status = computeJourneyStatus({ setup: view, context: null, records: [], evidence: [], canManage: false })
    expect(status.progress.setup).toBe("in_progress")
    expect(status.next.action).toBe("View records")
    expect(progressAnswer(status).join(" ")).toContain("still “Not sure yet”")
  })
  test("a reporting period outside the beta year is an open answer, and out-of-period records are held", () => {
    const office = "29400000-0000-4000-8000-000000000001"
    const setup = { company: { legalName: "Acme" }, reportingPeriod: { start: "2024-01-01", endExclusive: "2025-01-01" }, boundary: { approach: "operational_control" }, screening: [], locations: [{ id: office, name: "Office", inclusion: "included", operatorDetails: "" }] }
    const view = { currentVersion: { revision: 1, setup } } as never
    expect(setupMissing(view).map(item => item.id)).toEqual(["beta-period"])
    expect(periodFit({ start: "2025-01-01", endExclusive: "2026-01-01" }, setup.reportingPeriod)).toBe("outside")
    expect(periodFit({ start: "2025-01-01", endExclusive: "2026-01-01" }, { start: "2025-07-01", endExclusive: "2026-07-01" })).toBe("partial")
    expect(periodFit({ start: "2025-02-01", endExclusive: "2025-03-01" }, { start: "2025-01-01", endExclusive: "2026-01-01" })).toBe("inside")
  })
  test("record states follow the reviewed readiness findings", () => {
    expect(recordState([])).toBe("ready")
    expect(recordState([{ status: "input_needed", reason: "x" }, { status: "partial", reason: "y" }])).toBe("input_needed")
    expect(recordState([{ status: "withdrawn", reason: "x" }])).toBe("withdrawn")
  })
})
