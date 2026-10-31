/**
 * The provisional first SB 253 Scope 3 report (Scope 3 completion I-04; Claude, 30 October 2026; DESIGN 5.4, D11).
 * Browser-safe; no imports beyond the shared texts.
 *
 * Adopted: the Initial Regulation (17 CCR 96076(a), effective 12 October 2026) says "Scope 3 emissions reporting is not
 * required for 2026 reporting". Not adopted: CARB staff's concept (July 2026 workshop) of a 10 November deadline each year
 * for Scope 1, 2 and 3, which would make 10 November 2027 the first Scope 3 report. The fiscal year it would cover is
 * inferred from the adopted 96076(c) rule for the 2026 report, applied to 2027: a fiscal year ending on or before
 * 1 February of the reporting calendar year is that year's; otherwise it is the fiscal year ending in the previous
 * calendar year. Everything here is therefore labelled provisional and never gates anything.
 */
import { SCOPE3_PROVISIONAL_DEADLINE_LABEL } from './scope3-text'

export const SCOPE3_PROVISIONAL_FIRST_REPORT_DUE = '2027-11-10' as const
export interface Scope3ProvisionalDeadline {
  provisional: true
  dueDate: typeof SCOPE3_PROVISIONAL_FIRST_REPORT_DUE
  /** The last day (inclusive) of the fiscal year the first Scope 3 report would cover. */
  fiscalYearEnding: string
  label: typeof SCOPE3_PROVISIONAL_DEADLINE_LABEL
  /** One sentence for setup, results, print and CSV. */
  line: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const iso = (date: Date) => date.toISOString().slice(0, 10)
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

/**
 * From the end (exclusive, `YYYY-MM-DD`) of any one of the company's fiscal years, as company setup stores its reporting
 * period: the provisional first Scope 3 report. Null when the period end is not set. A fiscal year that ends on the last
 * day of a month keeps ending on that month's last day (a year ending 29 February 2024 ends 28 February 2026).
 */
export function provisionalFirstScope3Report(fiscalYearEndExclusive: string | null): Scope3ProvisionalDeadline | null {
  if (fiscalYearEndExclusive === null) return null
  const end = new Date(`${fiscalYearEndExclusive}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fiscalYearEndExclusive) || Number.isNaN(end.getTime()) || iso(end) !== fiscalYearEndExclusive) throw new Error('Invalid fiscal year end.')
  const last = new Date(end.getTime() - 86_400_000)
  const month = last.getUTCMonth(), day = last.getUTCDate(), monthEnd = day === daysIn(last.getUTCFullYear(), month)
  const endingIn = (year: number) => new Date(Date.UTC(year, month, monthEnd ? daysIn(year, month) : Math.min(day, daysIn(year, month))))
  // 96076(c), applied to the 2027 report: (1) ending on or before 1 February 2027 -> that fiscal year; (2) otherwise the one ending in 2026.
  const in2027 = endingIn(2027)
  const covered = in2027.getTime() <= Date.UTC(2027, 1, 1) ? in2027 : endingIn(2026)
  const fiscalYearEnding = iso(covered)
  const line = `Provisional first SB 253 Scope 3 report: due 10 November 2027, for the fiscal year ending ${covered.getUTCDate()} ${MONTHS[covered.getUTCMonth()]} ${covered.getUTCFullYear()}.`
  return { provisional: true, dueDate: SCOPE3_PROVISIONAL_FIRST_REPORT_DUE, fiscalYearEnding, label: SCOPE3_PROVISIONAL_DEADLINE_LABEL, line }
}
