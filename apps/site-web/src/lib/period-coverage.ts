/**
 * BF-13 (B-3, round 2 fix orders): the period-coverage check and the coverage statements, in one browser-safe module with
 * no imports at run time. A fact check, not a method: for each included site and each Scope 1 or 2 source kind with at
 * least one counted record there, the union of the records' periods (half-open) is compared with the reporting period
 * intersected with the site's coverage dates. Each uncovered stretch is a possible coverage gap.
 *
 * The Results screen's completeness column, the printed report and the live CSV all read the gaps this module produces
 * (through `coverageGaps` in journey-status.ts), so the screen and the CSV can never disagree. Nothing here changes a
 * figure: it only decides which gaps are listed and which coverage sentence is printed.
 *
 * Not checked (C-10, needs setup data the product does not hold yet): whether every meter, vehicle and piece of equipment
 * has its own record. One van's full-year record "covers" the fleet's vehicle kind at that site, and the statements say so.
 */
import type { CoverageGap } from "./journey-status"

/** The coverage statements. The wording is the order's (BF-13 rule 3); Codex's acceptance scripts read these strings. */
export const COVERAGE_TEXT = {
  /**
   * Results (screen, printed summary and the CSV's completeness lines), per scope, when nothing in that scope is held, open
   * or found by the checks. Each scope's line claims only what that scope's checks looked at (QA B1 on PR #66).
   */
  resultsNoGaps: (scope: 1 | 2) => scope === 1
    ? "No gaps found by these checks: every Scope 1 source type in company setup has records, and at each included site the records of each Scope 1 source type it has cover every day of the reporting period that the site's dates in company setup include. Not checked: whether every meter, vehicle and piece of equipment has its own record, or whether a site uses a source type that has records only at other sites."
    : "No gaps found by these checks: every Scope 2 source type in company setup and every included site has records, and at each included site the records of each Scope 2 source type it has cover every day of the reporting period that the site's dates in company setup include. Not checked: whether every meter has its own record.",
  /** The live CSV's coverage line when no open setup answer or gap remains (held records still count as covering: F2). */
  csvNoGaps: "Coverage checks: no open company-setup answers for Scope 1 and 2; every Scope 1 and 2 source type in company setup and every included site has records, and at each included site each source type's records (counted or not) cover every day of the reporting period that the site's dates include. Not checked: whether every meter, vehicle and piece of equipment has a record, or whether a site uses a Scope 1 source type recorded only at other sites.",
  /** The printed report's "Not counted, incomplete and possible gaps" section when it has nothing to list. */
  reportNoneFound: "None found by these checks: every record is counted, company setup has no open answers for Scope 1 and 2, every Scope 1 and 2 source type it lists and every included site has records, and at each included site each source type's records cover every day of the reporting period that the site's dates include. Not checked: whether every meter, vehicle and piece of equipment has its own record, or whether a site uses a Scope 1 source type recorded only at other sites.",
  /** One uncovered stretch: "Records for <kind> at <site> don't cover <dates> (<n> of <N> days uncovered)". */
  periodGap: (kind: string, site: string, dates: string, uncovered: number, days: number) => `Records for ${kind} at ${site} don't cover ${dates} (${uncovered} of ${days} days uncovered)`,
  periodGapDetail: "Add records for these dates. If the site had no such activity then, or its coverage dates are wrong, say so in that site’s details in company setup (04 Locations).",
} as const

export interface HalfOpenPeriod { start: string; endExclusive: string }
/** The parts of a setup location this check reads (company setup, 04 Locations). Missing modes count as unknown. */
export interface CoverageLocation { id: string; name: string; inclusion: string; start?: string | null; endExclusive?: string | null; startMode?: "unknown" | "period_start" | "specific"; endMode?: "unknown" | "period_end" | "specific" }
/** The parts of a record this check reads. */
export interface CoverageRecord { kind: string; locationId: string; periodStart: string; periodEndExclusive: string }

/** The Scope 1 and 2 kinds (the results route's rule: every other saved kind is Scope 3), with the scope each belongs to. */
const KIND_SCOPE: Readonly<Record<string, 1 | 2>> = { natural_gas: 1, vehicle: 1, distillate_no2: 1, fugitive: 1, electricity: 2 }
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** F3 (QA on PR #66): a one-day stretch is named as one date ("Feb 29, 2024"), in the product's date style. */
const oneDay = (date: string) => `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`
const dayNumber = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / DAY_MS
/** Days in a half-open ISO date range. */
export const daysIn = (period: HalfOpenPeriod) => Math.max(0, dayNumber(period.endExclusive) - dayNumber(period.start))
const usable = (period: { start?: string | null; endExclusive?: string | null } | null | undefined): period is HalfOpenPeriod =>
  Boolean(period?.start && period.endExclusive && ISO_DATE.test(period.start) && ISO_DATE.test(period.endExclusive) && period.start < period.endExclusive)

/**
 * The dates a site must be covered for: the reporting period intersected with the site's coverage dates, as
 * `scope3ReportingLocationHold` reads them. A start or end that is unknown is taken as the reporting period's own, so an
 * unknown coverage date can only add a possible gap, never hide one. Null when nothing is left to check.
 */
export function siteCoverageWindow(reporting: HalfOpenPeriod, location: CoverageLocation): HalfOpenPeriod | null {
  const start = location.startMode === "specific" && location.start && ISO_DATE.test(location.start) && location.start > reporting.start ? location.start : reporting.start
  const end = location.endMode === "specific" && location.endExclusive && ISO_DATE.test(location.endExclusive) && location.endExclusive < reporting.endExclusive ? location.endExclusive : reporting.endExclusive
  return start < end ? { start, endExclusive: end } : null
}

/** The stretches of `window` that no period covers (half-open, in date order). Overlapping periods are merged first. */
export function uncoveredStretches(window: HalfOpenPeriod, periods: HalfOpenPeriod[]): HalfOpenPeriod[] {
  const clipped = periods.filter(usable)
    .map(period => ({ start: period.start > window.start ? period.start : window.start, endExclusive: period.endExclusive < window.endExclusive ? period.endExclusive : window.endExclusive }))
    .filter(period => period.start < period.endExclusive)
    .sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0)
  const stretches: HalfOpenPeriod[] = []
  let cursor = window.start
  for (const period of clipped) {
    if (period.start > cursor) stretches.push({ start: cursor, endExclusive: period.start })
    if (period.endExclusive > cursor) cursor = period.endExclusive
  }
  if (cursor < window.endExclusive) stretches.push({ start: cursor, endExclusive: window.endExclusive })
  return stretches
}

/**
 * The period-coverage gaps: one per uncovered stretch, per included site and Scope 1 or 2 kind with a counted record there.
 * `records` must already be the counted ones (not withdrawn, not excluded), as the presence check counts them.
 * `labels` names a kind and a period in words (the product's own `kindLabel` and `periodLabel`).
 */
export function periodCoverageGaps(input: { reportingPeriod: { start: string | null; endExclusive: string | null } | null | undefined; locations: readonly CoverageLocation[]; records: readonly CoverageRecord[] },
  labels: { kind: (kind: string) => string; period: (start: string, endExclusive: string) => string }): CoverageGap[] {
  const reporting = input.reportingPeriod
  if (!usable(reporting)) return []
  const gaps: CoverageGap[] = []
  for (const location of input.locations) {
    if (location.inclusion !== "included") continue
    const window = siteCoverageWindow(reporting, location)
    if (!window) continue
    const days = daysIn(window)
    const kinds = [...new Set(input.records.filter(record => record.locationId === location.id && KIND_SCOPE[record.kind]).map(record => record.kind))]
    for (const kind of kinds) {
      const periods = input.records.filter(record => record.locationId === location.id && record.kind === kind).map(record => ({ start: record.periodStart, endExclusive: record.periodEndExclusive }))
      const label = labels.kind(kind)
      const noun = label.charAt(0).toLowerCase() + label.slice(1)
      for (const stretch of uncoveredStretches(window, periods)) gaps.push({
        id: `period-${kind}-${location.id}-${stretch.start}`, scope: KIND_SCOPE[kind]!,
        title: COVERAGE_TEXT.periodGap(noun, location.name || "an unnamed site", daysIn(stretch) === 1 ? oneDay(stretch.start) : labels.period(stretch.start, stretch.endExclusive), daysIn(stretch), days),
        detail: COVERAGE_TEXT.periodGapDetail, note: null, noteFrom: "site",
      })
    }
  }
  return gaps
}
