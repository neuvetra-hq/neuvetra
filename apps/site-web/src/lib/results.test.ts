// Results & report: board option 1 (synthetic only, unreleased methods named), per-basis subtotal membership,
// half-even tonnes and the loading state after a failed reload. Claude, 2026-09-30.
import { describe, expect, test } from "bun:test"
import { kgToTonnes } from "./plain-language"
import { decodeResults, DRAFT_LABEL, lastDayCovered, methodLabel, NotSyntheticResultsError, resultsCsv, RESULTS_PROFILE, type ResultsResponse } from "./results-api"
import { INITIAL_RESULTS_STATE, needsWork, resultsReducer, rowStatus } from "./results-view"

const company = "29200000-0000-4000-8000-000000000001", other = "29200000-0000-4000-8000-000000000002"
const id = (n: number) => `29300000-0000-4000-8000-${String(n).padStart(12, "0")}`
const ENGINE1 = "6fdcfa3926698250d577df8d456b4d567ec3e9569788f3c96373421276fa36a4", ENGINE2 = "8d259406feb989372592269c0daef156733ebe67a2b12b87a39e897642a8c320"
const REGISTER = "f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02", REGISTER2 = "4873b8c08dbab395336a2273501724118661cf505ad19fa48a6f625661e3a14d"
const total = (display: string) => ({ unrounded: display, display, unit: "kg CO2e", rounding: "half_even_4dp" })
const basis = (status: string, display: string | null) => ({ status, findings: [], gases: display ? {} : null, total: display ? total(display) : null })
const gas = { recordId: id(1), versionId: id(11), revision: 1, kind: "natural_gas", scope: 1, sourceId: "GAS-1", locationId: id(21), locationName: "Office", period: { start: "2025-01-01", endExclusive: "2026-01-01" },
  quantity: { value: "100", unit: "therm" }, quality: "actual", estimateBasis: null, evidenceCount: 0, evidence: [], plan: { action: "calculate", status: null, reasons: [], notes: [] }, periodCheck: "inside", outcome: "calculated",
  inSubtotal: { scope1: true, scope2LocationBased: false, scope2MarketBased: false }, refusalCode: null, scope2: null,
  scope1: { methodVersionId: "scope1.stationary.natural_gas.v2", gwpSetId: "AR5-100", status: "complete", gases: {}, missingGases: [], estimates: [], findings: [], memo: null, factorsUsed: [], total: total("531.1450"), resultSha256: "a".repeat(64) } }
// A meter whose instrument MWh is unknown: in the location-based subtotal, not the market-based one.
const meter = { ...gas, recordId: id(2), versionId: id(12), kind: "electricity", scope: 2, sourceId: "M-BLANK", quantity: { value: "10000", unit: "kWh" }, period: { start: "2025-01-01", endExclusive: "2025-02-01" },
  inSubtotal: { scope1: false, scope2LocationBased: true, scope2MarketBased: false }, scope1: null,
  scope2: { methodVersionId: "scope2.electricity.egrid2023_greene2025.v3", gwpSetId: "AR5-100", status: "review_required", findings: [], estimates: [], activity: { mwh: "10", instrumentMwh: null, subregion: "CAMX" },
    locationBased: basis("complete", "1950.2612"), marketBased: { ...basis("input_needed", null), residualMix: null }, factorsUsed: [], resultSha256: "b".repeat(64) } }
const methods = [
  { methodVersionId: "scope1.stationary.natural_gas.v2", scope: 1, engineSha256: ENGINE1, registerSha256: REGISTER, releaseStatus: "unreleased_beta" },
  { methodVersionId: "scope2.electricity.egrid2023_greene2025.v3", scope: 2, engineSha256: ENGINE2, registerSha256: REGISTER2, releaseStatus: "unreleased_beta" }]
const response = (extra: Record<string, unknown> = {}) => ({ profile: RESULTS_PROFILE, label: DRAFT_LABEL, syntheticOnly: true, environment: "synthetic_staging", methods, generatedAt: "2026-09-30T00:00:00.000Z", companyId: company,
  setup: null, records: [gas, meter], counts: { records: 2, calculated: 2, held: 0, withdrawn: 0, excluded: 0, inputNeeded: 0, outsidePeriod: 0, unavailable: 0 }, warnings: [],
  scope1: { knownSourceSubtotal: total("531.1450"), includedResults: ["a".repeat(64)], incompleteResults: [], notCalculated: [], reportedOutsideScopes: [], resultCount: 1, complete: true },
  scope2: { resultCount: 1, locationBasedSubtotal: total("1950.2612"), locationBasedIncluded: ["b".repeat(64)], locationBasedComplete: true, marketBasedSubtotal: total("0.0000"), marketBasedIncluded: [], marketBasedProvisional: [], marketBasedComplete: false }, ...extra })
const labels = { kind: (kind: string) => kind, reason: (code: string) => code, status: () => "Calculated", boundary: (code: string) => code, period: () => "2025" }

describe("board option 1: synthetic companies only, unreleased methods named", () => {
  test("numbers are refused unless the server says synthetic staging", () => {
    expect(decodeResults(response(), company).environment).toBe("synthetic_staging")
    for (const extra of [{ environment: "production" }, { environment: undefined }, { syntheticOnly: false }])
      expect(() => decodeResults(response(extra), company)).toThrow(NotSyntheticResultsError)
  })
  test("every figure must name a listed, unreleased method", () => {
    expect(() => decodeResults(response({ methods: undefined }), company)).toThrow(/not recognized/)
    expect(() => decodeResults(response({ methods: [{ ...methods[0], releaseStatus: "released" }, methods[1]] }), company)).toThrow(/not recognized/)
    expect(() => decodeResults(response({ methods: [{ ...methods[0], engineSha256: "short" }, methods[1]] }), company)).toThrow(/not recognized/)
    expect(() => decodeResults(response({ methods: [methods[1]] }), company)).toThrow(/not recognized/)
    expect(methodLabel("scope1.stationary.natural_gas.v2")).toBe("scope1.stationary.natural_gas.v2 (unreleased beta)")
  })
  test("subtotal flags are required and can't claim a figure that isn't there", () => {
    expect(() => decodeResults(response({ records: [{ ...gas, inSubtotal: undefined }] }), company)).toThrow(/not recognized/)
    expect(() => decodeResults(response({ records: [{ ...gas, inSubtotal: { scope1: true, scope2LocationBased: true, scope2MarketBased: false } }] }), company)).toThrow(/not recognized/)
  })
})

describe("CSV", () => {
  const csv = resultsCsv(decodeResults(response(), company) as ResultsResponse, labels)
  const lines = csv.split("\n")
  const header = lines.find(line => line.startsWith("Scope,"))!.split(",")
  const cells = (source: string) => { const line = lines.find(item => item.includes(`,${source},`))!.split(","); return Object.fromEntries(header.map((name, i) => [name, line[i]])) }
  test("each subtotal basis has its own column", () => {
    expect(header).toContain("In Scope 1 subtotal"); expect(header).toContain("In location-based subtotal"); expect(header).toContain("In market-based subtotal")
    expect(header).not.toContain("Counted in subtotal")
    expect([cells("M-BLANK")["In location-based subtotal"], cells("M-BLANK")["In market-based subtotal"], cells("M-BLANK")["In Scope 1 subtotal"]]).toEqual(["Yes", "No", ""])
    expect([cells("GAS-1")["In Scope 1 subtotal"], cells("GAS-1")["In location-based subtotal"]]).toEqual(["Yes", ""])
  })
  test("the last day covered, not the exclusive end, and methods named as unreleased", () => {
    expect(header).toContain("Last day covered"); expect(header).not.toContain("Period end (exclusive)")
    expect(cells("M-BLANK")["Last day covered"]).toBe("2025-01-31"); expect(cells("GAS-1")["Last day covered"]).toBe("2025-12-31")
    expect(cells("GAS-1").Method).toBe("scope1.stationary.natural_gas.v2 (unreleased beta)")
    expect(csv).toContain(`# Methods (unreleased beta, not released): scope1.stationary.natural_gas.v2 engine ${ENGINE1.slice(0, 12)} register ${REGISTER.slice(0, 12)}`)
    expect(csv.startsWith(`# ${DRAFT_LABEL}`)).toBe(true)
    expect(lastDayCovered("2024-03-01")).toBe("2024-02-29")
  })
})

describe("tonnes use the engine's half-even rule in exact decimal arithmetic", () => {
  test.each([
    ["2345.0000", "2.34"], ["2355.0000", "2.36"], ["1005.0000", "1.00"], ["1015.0000", "1.02"], ["1235.0000", "1.24"], ["1234.9999", "1.23"],
    ["116323.7905", "116.32"], ["0.0049", "0.00"], ["5.0000", "0.00"], ["5.0001", "0.01"], ["123456789012.3456", "123,456,789.01"], ["-2345.0000", "−2.34"], ["-4.0000", "0.00"],
  ])("%s kg → %s t", (kg, tonnes) => expect(kgToTonnes(kg)).toBe(tonnes))
  test("anything but a plain decimal shows a dash", () => { expect(kgToTonnes("1,234.5")).toBe("—"); expect(kgToTonnes(null)).toBe("—") })
})

describe("loading state (Codex review of PR #7)", () => {
  const loaded = resultsReducer(resultsReducer(INITIAL_RESULTS_STATE, { type: "start", workspaceId: company }), { type: "success", value: decodeResults(response(), company) })
  test("a failed reload clears the earlier figures instead of leaving them on screen", () => {
    const retrying = resultsReducer(loaded, { type: "start", workspaceId: company })
    expect(retrying.results).not.toBeNull(); expect(retrying.busy).toBe(true)
    const failed = resultsReducer(retrying, { type: "failure", message: "Results could not be prepared.", missingRoute: false })
    expect(failed).toEqual({ results: null, error: { message: "Results could not be prepared.", missingRoute: false }, busy: false })
  })
  test("another company's figures are never shown while its results load", () => {
    expect(resultsReducer(loaded, { type: "start", workspaceId: other }).results).toBeNull()
    expect(resultsReducer(loaded, { type: "no_workspace" }).results).toBeNull()
  })
  test("a meter calculated location-based but not market-based is partial and needs attention", () => {
    const decoded = decodeResults(response(), company)
    const blank = decoded.records.find(item => item.sourceId === "M-BLANK")!
    expect(rowStatus(blank).label).toBe("Partial calculation"); expect(needsWork(blank)).toBe(true)
    expect(needsWork(decoded.records.find(item => item.sourceId === "GAS-1")!)).toBe(false)
  })
  test("records outside the reporting period are labelled as such", () => {
    expect(rowStatus({ ...gas, outcome: "held", scope1: null, periodCheck: "partial", inSubtotal: { scope1: false, scope2LocationBased: false, scope2MarketBased: false } } as never).label).toBe("Outside reporting period")
  })
})
