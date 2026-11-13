// BF-13 (finding B-3 of the accounting acceptance audit, round 2 fix orders): the coverage statement is truthful and the
// period-coverage check is a fact. The first test is the auditor's reproduction (/tmp/acct/zz-acct-coverage.test.ts), kept
// as a permanent test with the order's expected results in place of the defect it recorded.
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { COVERAGE_TEXT, coverageGaps, coverageIssues, coverageLines, setupMissing, type JourneyRecord } from "./journey-status"
import { periodCoverageGaps, siteCoverageWindow, uncoveredStretches } from "./period-coverage"

const office = "29400000-0000-4000-8000-000000000001", depot = "29400000-0000-4000-8000-000000000002"
/** The phrases B-3 retired. Built from parts so this file never matches its own search. */
const RETIRED = [["No known", "gaps"].join(" "), ["No open setup answers or", "possible gaps"].join(" ")]
type Location = { id: string; name: string; inclusion: string; operatorDetails: string; startMode?: string; endMode?: string; start?: string | null; endExclusive?: string | null }
function view(locations: Location[] = [{ id: office, name: "Office", inclusion: "included", operatorDetails: "" }], screening: unknown[] = []) {
  return { currentVersion: { revision: 1, setup: { company: { legalName: "Acme" }, reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: { approach: "operational_control" }, screening, locations } } } as never
}
const bill = (id: string, start: string, endExclusive: string, fields: Partial<JourneyRecord> = {}): JourneyRecord =>
  ({ id, kind: "electricity", label: "Purchased electricity", sourceId: `M-${id}`, locationId: office, site: "Office", state: "ready", reasons: [], evidenceCount: 1, quality: "actual", periodStart: start, periodEndExclusive: endExclusive, ...fields })
const monthStart = (month: number) => `${month > 12 ? 2026 : 2025}-${String(month > 12 ? 1 : month).padStart(2, "0")}-01`
const coverageOf = (setupView: never, records: JourneyRecord[]) => ({ state: "ready" as const, setupOpen: setupMissing(setupView), gaps: coverageGaps(setupView, records) })

describe("BF-13: the auditor's B-3 reproduction", () => {
  test("one January electricity bill, one van of 20 and one rooftop unit of 12 never claim full coverage of a full-year site", () => {
    const setupView = view(undefined, [{ id: "veh", scope: 1, category: "Road & off-road vehicles", state: "yes", details: "20 vans" }, { id: "cool", scope: 1, category: "Cooling & fire suppression", state: "yes", details: "12 rooftop units" }])
    const base = bill("e", "2025-01-01", "2025-02-01", { sourceId: "M-1 (January bill only)" })
    const records = [base, { ...base, id: "v", kind: "vehicle", sourceId: "VAN-1 (1 of 20)" }, { ...base, id: "f", kind: "fugitive", sourceId: "RTU-1 (1 of 12)" }]
    const coverage = coverageOf(setupView, records)
    const titles = coverage.gaps.map(gap => gap.title)
    expect(titles).toContain("Records for purchased electricity at Office don't cover Feb 1 – Dec 31, 2025 (334 of 365 days uncovered)")
    expect(coverage.gaps.filter(gap => gap.scope === 2)).toHaveLength(1)
    // The van and the rooftop unit cover January only too, so Scope 1 has two period gaps (one per kind at the site).
    expect(coverage.gaps.filter(gap => gap.scope === 1).map(gap => gap.title)).toEqual([
      "Records for company vehicles at Office don't cover Feb 1 – Dec 31, 2025 (334 of 365 days uncovered)",
      "Records for refrigerants and fire suppression at Office don't cover Feb 1 – Dec 31, 2025 (334 of 365 days uncovered)",
    ])
    expect(coverageIssues(coverage, 2)).toEqual({ open: 0, gaps: 1, unchecked: false })
    expect(coverageIssues(coverage, 1)).toEqual({ open: 0, gaps: 2, unchecked: false })
    const csv = coverageLines(coverage).join("\n")
    expect(csv).toContain("Possible gap (Scope 2): Records for purchased electricity at Office don't cover Feb 1 – Dec 31, 2025 (334 of 365 days uncovered).")
    for (const phrase of RETIRED) expect(csv).not.toContain(phrase)
    expect(csv).not.toContain(COVERAGE_TEXT.csvNoGaps)
  })
})

describe("BF-13: the period-coverage check", () => {
  test("twelve consecutive monthly bills: no gap, and the CSV says what was and was not checked", () => {
    const records = Array.from({ length: 12 }, (_, index) => bill(`m${index + 1}`, monthStart(index + 1), monthStart(index + 2)))
    const coverage = coverageOf(view(), records)
    expect(coverage.gaps).toEqual([])
    expect(coverageLines(coverage)).toEqual([COVERAGE_TEXT.csvNoGaps])
    expect(COVERAGE_TEXT.csvNoGaps).toBe("Coverage checks: no open setup answers; each source type and included site in company setup has records covering every day of the reporting period. Not checked: whether every meter, vehicle and piece of equipment has a record.")
    expect(COVERAGE_TEXT.resultsNoGaps).toBe("No gaps found by these checks: every source type and included site in company setup has records, and the records cover every day of the reporting period for each site and source type. Not checked: whether every meter, vehicle and piece of equipment has its own record.")
  })
  test("eleven months with March missing: one gap naming March only", () => {
    const records = Array.from({ length: 12 }, (_, index) => bill(`m${index + 1}`, monthStart(index + 1), monthStart(index + 2))).filter(record => record.id !== "m3")
    expect(coverageGaps(view(), records).map(gap => gap.title)).toEqual(["Records for purchased electricity at Office don't cover Mar 1 – Mar 31, 2025 (31 of 365 days uncovered)"])
  })
  test("overlapping bills give no false gap; two uncovered stretches give two gaps", () => {
    expect(coverageGaps(view(), [bill("a", "2025-01-01", "2025-07-15"), bill("b", "2025-07-01", "2026-01-01")])).toEqual([])
    // A bill inside another bill adds nothing; the October hole is still found.
    expect(coverageGaps(view(), [bill("a", "2025-01-01", "2025-10-01"), bill("b", "2025-03-01", "2025-04-01"), bill("c", "2025-11-01", "2026-01-01")]).map(gap => gap.title))
      .toEqual(["Records for purchased electricity at Office don't cover Oct 1 – Oct 31, 2025 (31 of 365 days uncovered)"])
    expect(coverageGaps(view(), [bill("a", "2025-01-01", "2025-03-01"), bill("c", "2025-06-01", "2025-07-01")]).map(gap => gap.title)).toEqual([
      "Records for purchased electricity at Office don't cover Mar 1 – May 31, 2025 (92 of 365 days uncovered)",
      "Records for purchased electricity at Office don't cover Jul 1 – Dec 31, 2025 (184 of 365 days uncovered)",
    ])
    const stretches = uncoveredStretches({ start: "2025-01-01", endExclusive: "2026-01-01" }, [{ start: "2025-02-01", endExclusive: "2025-03-01" }, { start: "2025-05-01", endExclusive: "2025-06-01" }])
    expect(stretches).toEqual([{ start: "2025-01-01", endExclusive: "2025-02-01" }, { start: "2025-03-01", endExclusive: "2025-05-01" }, { start: "2025-06-01", endExclusive: "2026-01-01" }])
  })
  test("a site that starts mid-year is checked from its own start; one that ends early, to its own end", () => {
    const midYear = view([{ id: office, name: "Office", inclusion: "included", operatorDetails: "", startMode: "specific", start: "2025-07-01", endMode: "period_end" }])
    expect(coverageGaps(midYear, [bill("h2", "2025-07-01", "2026-01-01")])).toEqual([])
    expect(coverageGaps(midYear, [bill("q3", "2025-07-01", "2025-10-01")]).map(gap => gap.title)).toEqual(["Records for purchased electricity at Office don't cover Oct 1 – Dec 31, 2025 (92 of 184 days uncovered)"])
    const closed = view([{ id: office, name: "Office", inclusion: "included", operatorDetails: "", startMode: "period_start", endMode: "specific", endExclusive: "2025-04-01" }])
    expect(coverageGaps(closed, [bill("q1", "2025-01-01", "2025-04-01")])).toEqual([])
    // A coverage date that is unknown is taken as the reporting period's own: it can add a possible gap, never hide one.
    expect(siteCoverageWindow({ start: "2025-01-01", endExclusive: "2026-01-01" }, { id: office, name: "Office", inclusion: "included", startMode: "unknown", start: "2025-07-01" })).toEqual({ start: "2025-01-01", endExclusive: "2026-01-01" })
    expect(siteCoverageWindow({ start: "2025-01-01", endExclusive: "2026-01-01" }, { id: office, name: "Office", inclusion: "included", startMode: "specific", start: "2026-02-01" })).toBeNull()
  })
  test("only counted records at included sites cover days, per site and per kind", () => {
    const twoSites = view([{ id: office, name: "Office", inclusion: "included", operatorDetails: "" }, { id: depot, name: "Depot", inclusion: "excluded", operatorDetails: "" }])
    const full = bill("full", "2025-01-01", "2026-01-01")
    expect(coverageGaps(twoSites, [full, { ...full, id: "w", state: "withdrawn", periodStart: "2025-01-01", periodEndExclusive: "2025-02-01" }])).toEqual([])
    // A withdrawn record covers nothing: the half-year bill still leaves July to December uncovered.
    expect(coverageGaps(twoSites, [bill("h1", "2025-01-01", "2025-07-01"), bill("w", "2025-07-01", "2026-01-01", { state: "withdrawn" })]).map(gap => gap.id)).toEqual([`period-electricity-${office}-2025-07-01`])
    // The excluded depot is not checked; another kind at the office is checked on its own.
    expect(coverageGaps(twoSites, [full, bill("d", "2025-01-01", "2025-02-01", { locationId: depot })])).toEqual([])
    expect(coverageGaps(twoSites, [full, bill("g", "2025-01-01", "2025-12-01", { kind: "natural_gas" })]).map(gap => [gap.scope, gap.title])).toEqual([[1, "Records for natural gas at Office don't cover Dec 1 – Dec 31, 2025 (31 of 365 days uncovered)"]])
    // Scope 3 kinds are not part of this check.
    expect(periodCoverageGaps({ reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: office, name: "Office", inclusion: "included" }], records: [{ kind: "waste", locationId: office, periodStart: "2025-01-01", periodEndExclusive: "2025-02-01" }] }, { kind: kind => kind, period: (a, b) => `${a}/${b}` })).toEqual([])
    // Without a reporting period there is nothing to compare with (setup already lists the period as an open answer).
    expect(periodCoverageGaps({ reportingPeriod: { start: null, endExclusive: null }, locations: [{ id: office, name: "Office", inclusion: "included" }], records: [{ kind: "electricity", locationId: office, periodStart: "2025-01-01", periodEndExclusive: "2025-02-01" }] }, { kind: kind => kind, period: (a, b) => `${a}/${b}` })).toEqual([])
  })
})

describe("BF-13: the retired claims appear nowhere", () => {
  // apps/site-web/src (screens, the live CSV and the printed report are all produced there) and the server-side text modules
  // (apps/site-api/src and packages/neuvetra-database/src: Scope 3 texts, frozen report and CSV builders).
  const root = join(import.meta.dir, "../../../..")
  const folders = ["apps/site-web/src", "apps/site-web/e2e", "apps/site-api/src", "packages/neuvetra-database/src"]
  const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (name === "node_modules" || name.startsWith(".")) return []
    return statSync(path).isDirectory() ? files(path) : /\.(tsx?|py|json|md|sql)$/.test(name) ? [path] : []
  })
  test("neither retired phrase is printed, shipped or expected by any test", () => {
    const scanned = folders.flatMap(folder => files(join(root, folder)))
    expect(scanned.length).toBeGreaterThan(100)
    const hits = scanned.flatMap(path => RETIRED.filter(phrase => readFileSync(path, "utf8").toLowerCase().includes(phrase.toLowerCase())).map(phrase => `${relative(root, path)}: ${phrase}`))
    expect(hits).toEqual([])
  })
})
