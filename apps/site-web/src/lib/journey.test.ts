// Claude UX journey (2026-09-29): the guided flow's pure logic — help matching, plain-language display, results decoding
// and progress — never invents a value and keeps the reviewed wording.
import { describe, expect, test } from "bun:test"
import { HELP_ENTRIES, isProgressQuestion, matchQuestion } from "./help-content"
import { groupDigits, kgToTonnes, periodLabel, reasonText, RECORD_STATE_LABELS } from "./plain-language"
import { decodeResults, resultsCsv, RESULTS_PROFILE } from "./results-api"
import { computeJourneyStatus, progressAnswer, recordState, setupMissing } from "./journey-status"
import { rowStatus } from "./results-view"

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
  test("declines instead of guessing when nothing matches", () => {
    expect(matchQuestion("what is the weather tomorrow")).toBeNull()
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
const row = (extra: Record<string, unknown>) => ({ recordId: record, versionId: record, revision: 1, kind: "natural_gas", scope: 1, sourceId: "GAS-1", locationId: record, locationName: "Office", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, quantity: { value: "10", unit: "therm" }, quality: "actual", estimateBasis: null, evidenceCount: 0, plan: { action: "calculate", status: null, reasons: [], notes: [] }, outcome: "calculated", refusalCode: null, scope1: s1("complete", "53.1180"), scope2: null, ...extra })
const response = (records: unknown[]) => ({ profile: RESULTS_PROFILE, label: "Draft", syntheticOnly: true, generatedAt: "2026-09-29T00:00:00.000Z", companyId: company, setup: null, records, scope1: null, scope2: null, counts: { records: records.length, calculated: 1, held: 0, withdrawn: 0, excluded: 0, inputNeeded: 0, unavailable: 0 }, warnings: [] })

describe("draft results decoding", () => {
  test("accepts the contract and rejects anything else", () => {
    expect(decodeResults(response([row({})]), company).records).toHaveLength(1)
    expect(() => decodeResults({ ...response([]), profile: "other" }, company)).toThrow()
    expect(() => decodeResults(response([]), "29200000-0000-4000-8000-000000000009")).toThrow()
    expect(() => decodeResults(response([row({ scope1: s1("complete", "12,5") })]), company)).toThrow()
    expect(() => decodeResults(response([row({ scope1: null })]), company)).toThrow()
  })
  test("held records keep the reviewed labels and never show a number", () => {
    expect(rowStatus(row({ outcome: "held", scope1: null, plan: { action: "hold", status: "input_needed", reasons: ["quantity_not_calculable"], notes: [] } }) as never).label).toBe("Input needed")
    expect(rowStatus(row({ outcome: "held", scope1: null, plan: { action: "hold", status: "excluded", reasons: [], notes: [] } }) as never).label).toBe("Excluded")
    expect(rowStatus(row({ scope1: s1("partial", "10.0000") }) as never).label).toBe("Partial calculation")
  })
  test("the CSV carries the engine's exact figures and a draft header", () => {
    const csv = resultsCsv(decodeResults(response([row({})]), company), { kind: kind => kind, reason: code => code })
    expect(csv.startsWith("# Draft")).toBe(true)
    expect(csv).toContain(",53.1180,")
  })
})

describe("journey progress", () => {
  test("an empty workspace starts with company setup", () => {
    const status = computeJourneyStatus({ setup: null, context: null, records: [], evidence: [], canManage: true })
    expect(status.next.panel).toBe("setup")
    expect(status.progress.setup).toBe("not_started")
    expect(setupMissing(null)).toEqual(["Save your company setup"])
    expect(progressAnswer(status)[0]).toMatch(/Set up your company/)
  })
  test("record states follow the reviewed readiness findings", () => {
    expect(recordState([])).toBe("ready")
    expect(recordState([{ status: "input_needed", reason: "x" }, { status: "partial", reason: "y" }])).toBe("input_needed")
    expect(recordState([{ status: "withdrawn", reason: "x" }])).toBe("withdrawn")
  })
})
