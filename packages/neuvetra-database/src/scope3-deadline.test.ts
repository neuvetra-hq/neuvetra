// The provisional first SB 253 Scope 3 report (Scope 3 completion I-04, DESIGN 5.4). Expected values from the 15-day text
// of 17 CCR 96076(c) (staged: california-carb-15day-text-20260727.pdf, p.7) applied to a 10 November 2027 report.
import { describe, expect, test } from 'bun:test'
import { provisionalFirstScope3Report } from './scope3-deadline'
import { SCOPE3_BASE_YEAR_TEXT, SCOPE3_KNOWN_LIMITATION_TEXT, SCOPE3_PROVISIONAL_DEADLINE_LABEL } from './scope3-text'

describe('provisionalFirstScope3Report', () => {
  test('calendar and non-calendar fiscal years map to the fiscal year the 2027 report would cover', () => {
    const cases: Array<[string, string, string]> = [
      ['2026-01-01', '2026-12-31', 'calendar year: ends after 1 February, so the year ending in 2026'],
      ['2025-01-01', '2026-12-31', 'calendar year 2024 setup: the same month and day'],
      ['2025-02-01', '2027-01-31', 'ends 31 January: on or before 1 February, so the year ending in 2027'],
      ['2025-02-02', '2027-02-01', 'ends 1 February exactly: still that year'],
      ['2025-02-03', '2026-02-02', 'ends 2 February: after 1 February'],
      ['2025-07-01', '2026-06-30', 'ends 30 June'],
      ['2025-10-01', '2026-09-30', 'ends 30 September'],
      ['2024-03-01', '2026-02-28', 'ends 29 February 2024 (month end): 28 February 2026'],
      ['2023-03-01', '2026-02-28', 'ends 28 February 2023 (month end)'],
      ['2025-11-29', '2026-11-28', 'a 52/53-week year ending 28 November (not month end)'],
    ]
    for (const [endExclusive, fiscalYearEnding, why] of cases) expect([why, provisionalFirstScope3Report(endExclusive)?.fiscalYearEnding]).toEqual([why, fiscalYearEnding])
  })

  test('always provisional, due 10 November 2027, with the design label and a plain sentence; no period gives no deadline', () => {
    expect(provisionalFirstScope3Report('2026-01-01')).toEqual({ provisional: true, dueDate: '2027-11-10', fiscalYearEnding: '2026-12-31', label: SCOPE3_PROVISIONAL_DEADLINE_LABEL,
      line: 'Provisional first SB 253 Scope 3 report: due 10 November 2027, for the fiscal year ending 31 December 2026.' })
    expect(SCOPE3_PROVISIONAL_DEADLINE_LABEL).toBe('Provisional: CARB has not adopted the 2027 Scope 3 rule; Scope 3 is not required for 2026 reporting (17 CCR 96076(a)).')
    expect(provisionalFirstScope3Report(null)).toBeNull()
    for (const bad of ['2026-02-30', '26-01-01', '2026-1-1', '']) expect(() => provisionalFirstScope3Report(bad)).toThrow('Invalid fiscal year end')
  })

  test('the fixed beta statements (DESIGN 5.4)', () => {
    expect(SCOPE3_KNOWN_LIMITATION_TEXT).toBe('Scope 3 records may cover 2025 and 2026 in this beta (fiscal year 2026, the first expected SB 253 Scope 3 report, and fiscal years spanning two calendar years), inside the reporting period in company setup. Factors stay the latest published editions, disclosed on each later line; Scope 1 and 2 for periods after 2025 are a separate package.')
    expect(SCOPE3_BASE_YEAR_TEXT).toBe('Scope 3 base year: not yet established.')
  })
})
