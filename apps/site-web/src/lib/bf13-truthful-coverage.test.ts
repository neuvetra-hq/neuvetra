// BF-13 (finding B-3 of the accounting acceptance audit, round 2 fix orders): the coverage statement is truthful and the
// period-coverage check is a fact. The first test is the auditor's reproduction (/tmp/acct/zz-acct-coverage.test.ts), kept
// as a permanent test with the order's expected results in place of the defect it recorded.
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { COVERAGE_TEXT, coverageGaps, coverageIssues, coverageLines, setupMissing, type JourneyRecord } from "./journey-status"
import { periodCoverageGaps, siteCoverageWindow, uncoveredStretches } from "./period-coverage"
import { READINESS_TEXT } from "./readiness"
import { HELP_ENTRIES } from "./help-content"

const office = "29400000-0000-4000-8000-000000000001", depot = "29400000-0000-4000-8000-000000000002"
/** The phrases B-3 retired. Built from parts so this file never matches its own search. */
const RETIRED = [["No known", "gaps"].join(" "), ["No open setup answers or", "possible gaps"].join(" "),
  // F1 (QA on PR #66): the Overview hint and the help answer that described the old one-record check.
  ["has a record — not that records cover", "the whole year"].join(" "), ["The check looks for at least one record per source type", "and included site"].join(" "),
  // B1 (QA on PR #66): the first BF-13 wording, which claimed the whole period for sites with their own dates.
  ["the records cover every day of the reporting period for each site", "and source type"].join(" "), ["has records covering every day of the", "reporting period. Not checked"].join(" "),
  // BF-13b F5 (QA round 3 on PR #66): round 1's Overview hint and help sentence, and main's old printed "None found" line.
  ["has records covering every day of the reporting period", "— not that"].join(" "), ["cover every day of the reporting period.", "It doesn’t check"].join(" "),
  ["has at least one record. This checks coverage", "by type and site"].join(" "),
  // BF-13b: round 2's wording, retired for F1 ("every record is counted"), F3 (per-unit records) and F6 ("site's dates").
  ["None found by these checks:", "every record is counted"].join(" "), ["that the site's dates", "in company setup include"].join(" "), ["of the reporting period that the site's", "dates include"].join(" "),
  ["within the site's dates", "— not that"].join(" "), ["within the site’s dates", "in company setup"].join(" "), ["has its own record,", "or whether"].join(" "), ["whether every meter has its own", "record."].join(" ")]
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
    expect(COVERAGE_TEXT.csvNoGaps).toBe("Coverage checks: no open company-setup answers for Scope 1 and 2, other than any site coverage dates left “Not sure” or incomplete (records at such a site are not counted); every Scope 1 and 2 source type in company setup and every included site has records, and at each included site each source type's records (counted or not) cover every day of the reporting period that the site's coverage dates include. Not checked: whether each meter, vehicle and piece of equipment has its own records covering those days, or whether a site uses a Scope 1 source type recorded only at other sites.")
    expect(COVERAGE_TEXT.resultsNoGaps(1)).toBe("No gaps found by these checks: every Scope 1 source type in company setup has records, and at each included site the records of each Scope 1 source type it has cover every day of the reporting period that the site's coverage dates include. Not checked: whether each meter, vehicle and piece of equipment has its own records covering those days, or whether a site uses a source type that has records only at other sites.")
    expect(COVERAGE_TEXT.resultsNoGaps(2)).toBe("No gaps found by these checks: every Scope 2 source type in company setup and every included site has records, and at each included site the records of each Scope 2 source type it has cover every day of the reporting period that the site's coverage dates include. Not checked: whether each meter has its own records covering those days.")
    expect(COVERAGE_TEXT.reportNoneFound).toBe("None found by these checks: every Scope 1 and 2 record is counted, company setup has no open answers for Scope 1 and 2, every Scope 1 and 2 source type it lists and every included site has records, and at each included site each source type's records cover every day of the reporting period that the site's coverage dates include. Not checked: whether each meter, vehicle and piece of equipment has its own records covering those days, or whether a site uses a Scope 1 source type recorded only at other sites.")
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

// QA B1 on PR #66: the "no gaps" statements must stay true when they print in these two states.
describe("BF-13: the no-gaps statements claim only what was checked (QA B1)", () => {
  const warehouse = "29400000-0000-4000-8000-000000000003"
  test("a warehouse that opens on 1 July with bills July to December: no gap, and no sentence claims the whole period for it", () => {
    const setupView = view([{ id: office, name: "Office", inclusion: "included", operatorDetails: "", startMode: "period_start", endMode: "period_end" },
      { id: warehouse, name: "New warehouse", inclusion: "included", operatorDetails: "", startMode: "specific", start: "2025-07-01", endMode: "period_end" }])
    const records = [...Array.from({ length: 12 }, (_, index) => bill(`o${index + 1}`, monthStart(index + 1), monthStart(index + 2))),
      ...Array.from({ length: 6 }, (_, index) => bill(`w${index + 7}`, monthStart(index + 7), monthStart(index + 8), { locationId: warehouse, site: "New warehouse" }))]
    const coverage = coverageOf(setupView, records)
    expect(coverage.gaps).toEqual([])
    // The statements that now print say "that the site's coverage dates include", never "every day of the reporting period" alone.
    for (const statement of [COVERAGE_TEXT.resultsNoGaps(2), ...coverageLines(coverage), COVERAGE_TEXT.reportNoneFound]) {
      expect(statement).toMatch(/every day of the reporting period that the site's coverage dates include/)
      expect(statement).not.toMatch(/every day of the reporting period(\.| for each site)/)
    }
  })
  test("vehicles answered yes company-wide, one full-year van at the Office and none at the Depot: Scope 1 has no gap, and the statement names the unchecked pairing", () => {
    const setupView = view([{ id: office, name: "Office", inclusion: "included", operatorDetails: "" }, { id: depot, name: "Depot", inclusion: "included", operatorDetails: "" }],
      [{ id: "veh", scope: 1, category: "Road & off-road vehicles", state: "yes", details: "Vans at both sites" }])
    const records = [bill("van", "2025-01-01", "2026-01-01", { kind: "vehicle", sourceId: "VAN-1" }), bill("e-o", "2025-01-01", "2026-01-01"), bill("e-d", "2025-01-01", "2026-01-01", { locationId: depot, site: "Depot" })]
    const coverage = coverageOf(setupView, records)
    expect(coverage.gaps).toEqual([])
    expect(coverageIssues(coverage, 1)).toEqual({ open: 0, gaps: 0, unchecked: false })
    expect(COVERAGE_TEXT.resultsNoGaps(1)).toContain("Not checked: whether each meter, vehicle and piece of equipment has its own records covering those days, or whether a site uses a source type that has records only at other sites.")
    expect(COVERAGE_TEXT.resultsNoGaps(1)).toContain("at each included site the records of each Scope 1 source type it has")
    expect(coverageLines(coverage)).toEqual([COVERAGE_TEXT.csvNoGaps])
    expect(COVERAGE_TEXT.csvNoGaps).toContain("or whether a site uses a Scope 1 source type recorded only at other sites.")
    expect(COVERAGE_TEXT.reportNoneFound).toContain("or whether a site uses a Scope 1 source type recorded only at other sites.")
  })
  test("each scope's line claims only that scope: a site with no records at all never reads as \"every included site has records\" in Scope 1", () => {
    // Depot has no records: Scope 2 has the gap; Scope 1 (no Scope 1 gap) must not claim every included site has records.
    const setupView = view([{ id: office, name: "Office", inclusion: "included", operatorDetails: "" }, { id: depot, name: "Depot", inclusion: "included", operatorDetails: "" }],
      [{ id: "veh", scope: 1, category: "Road & off-road vehicles", state: "yes", details: "" }])
    const coverage = coverageOf(setupView, [bill("van", "2025-01-01", "2026-01-01", { kind: "vehicle" }), bill("e-o", "2025-01-01", "2026-01-01")])
    expect(coverageIssues(coverage, 1).gaps).toBe(0)
    expect(coverageIssues(coverage, 2).gaps).toBe(1)
    expect(COVERAGE_TEXT.resultsNoGaps(1)).not.toContain("every included site has records")
  })
  test("F3: a one-day gap is named as one date", () => {
    const leap = { currentVersion: { revision: 1, setup: { company: { legalName: "Acme" }, reportingPeriod: { start: "2024-01-01", endExclusive: "2025-01-01" }, boundary: { approach: "operational_control" }, screening: [], locations: [{ id: office, name: "Office", inclusion: "included", operatorDetails: "" }] } } } as never
    expect(coverageGaps(leap, [bill("a", "2024-01-01", "2024-02-29"), bill("b", "2024-03-01", "2025-01-01")]).map(gap => gap.title)).toEqual(["Records for purchased electricity at Office don't cover Feb 29, 2024 (1 of 366 days uncovered)"])
  })
})

// BF-13b (QA round 3 on PR #66): the remaining follow-ups, each in a state that made the round-2 wording false or loose.
describe("BF-13b: coverage wording follow-ups", () => {
  test("F3: two meters (or two vans) each recorded for half the year read no gaps, and the statements say per-unit coverage is not checked", () => {
    const meters = [bill("m1", "2025-01-01", "2025-07-01", { sourceId: "M-1" }), bill("m2", "2025-07-01", "2026-01-01", { sourceId: "M-2" })]
    expect(coverageOf(view(), meters).gaps).toEqual([])
    const vans = [bill("v1", "2025-01-01", "2025-07-01", { kind: "vehicle", sourceId: "VAN-1" }), bill("v2", "2025-07-01", "2026-01-01", { kind: "vehicle", sourceId: "VAN-2" }), bill("e", "2025-01-01", "2026-01-01")]
    expect(coverageOf(view(undefined, [{ id: "veh", scope: 1, category: "Road & off-road vehicles", state: "yes", details: "2 vans" }]), vans).gaps).toEqual([])
    // Each meter and van has its own record, so "has its own record" would not name what is left unchecked: coverage per unit is.
    expect(COVERAGE_TEXT.resultsNoGaps(2)).toContain("Not checked: whether each meter has its own records covering those days.")
    for (const statement of [COVERAGE_TEXT.resultsNoGaps(1), COVERAGE_TEXT.csvNoGaps, COVERAGE_TEXT.reportNoneFound]) expect(statement).toContain("whether each meter, vehicle and piece of equipment has its own records covering those days")
  })
  test("F6: the statements name the site's coverage dates (not its original opening date), which is what the check uses", () => {
    const opened = view([{ id: office, name: "Office", inclusion: "included", operatorDetails: "", startMode: "specific", start: "2025-07-01", endMode: "period_end", opened: "2025-03-01" } as Location])
    expect(coverageOf(opened, [bill("h2", "2025-07-01", "2026-01-01")]).gaps).toEqual([])
    for (const statement of [COVERAGE_TEXT.resultsNoGaps(1), COVERAGE_TEXT.resultsNoGaps(2), COVERAGE_TEXT.csvNoGaps, COVERAGE_TEXT.reportNoneFound]) {
      expect(statement).toContain("the site's coverage dates include")
      expect(statement).not.toContain("the site's dates")
    }
  })
  test("F4: the Overview hint and the help answer carry the same scope of checks as Results, including the unchecked other-sites case", () => {
    const hint = READINESS_TEXT.s2Hint
    expect(hint).toContain("each included site has electricity records")
    expect(hint).toContain("the records of each Scope 1 and 2 source type it has cover every day of the reporting period that the site's coverage dates include")
    expect(hint).toContain("or whether a site uses a Scope 1 source type recorded only at other sites.")
    expect(hint).toContain("whether each meter, vehicle and piece of equipment has its own records covering those days")
    const help = JSON.stringify(HELP_ENTRIES)
    expect(help).toContain("It doesn’t check whether a site uses a Scope 1 source type that only other sites have records for.")
    expect(help).toContain("within the site’s coverage dates in company setup")
  })
  test("F2: with a site's coverage dates left \"Not sure\", the CSV line still prints and says such dates are not counted as open answers", () => {
    const unsure = view([{ id: office, name: "Office", inclusion: "included", operatorDetails: "", startMode: "unknown", endMode: "unknown" }])
    const coverage = coverageOf(unsure, Array.from({ length: 12 }, (_, index) => bill(`m${index + 1}`, monthStart(index + 1), monthStart(index + 2))))
    expect(coverage.setupOpen).toEqual([])
    expect(coverageLines(coverage)).toEqual([COVERAGE_TEXT.csvNoGaps])
    expect(COVERAGE_TEXT.csvNoGaps).toContain("no open company-setup answers for Scope 1 and 2, other than any site coverage dates left “Not sure” or incomplete (records at such a site are not counted);")
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
