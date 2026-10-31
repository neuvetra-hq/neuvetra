// Round 3 lane C (owner decision 9, product review PR-4 and PR-5; Claude, 31 October 2026): the spend import reads
// YYYY-MM-DD and US MM/DD/YYYY dates (the template says so); an impossible or unreadable date is a listed file error with
// its line number, never a thrown exception.
import { describe, expect, test } from "bun:test"
import { parseScope3SpendCsv, scope3SpendImportTemplate } from "./scope3-spend-import"

const file = (...rows: string[]) => new TextEncoder().encode(["line_id,date,vendor,description,amount,currency", ...rows].join("\n") + "\n")
const period = { start: "2025-01-01", endExclusive: "2026-01-01" }

describe("spend import dates (decision 9)", () => {
  test("US month/day/year (with or without leading zeros) is read as the ISO date; ISO stays as it is", () => {
    const parsed = parseScope3SpendCsv(file("A1,03/14/2025,Acme,Toner,10,USD", "A2,3/4/2025,Acme,Toner,10,USD", "A3,2025-12-31,Acme,Toner,10,USD", "A4,,Acme,Toner,10,USD"), { period })
    expect(parsed.ok).toBe(true)
    expect(parsed.lines.map(line => [line.date, line.lineDate])).toEqual([["2025-03-14", "2025-03-14"], ["2025-03-04", "2025-03-04"], ["2025-12-31", "2025-12-31"], ["", null]])
  })
  test("the same purchase written in either format has the same fingerprint (a re-export in the other format is a possible duplicate)", () => {
    const a = parseScope3SpendCsv(file("A1,03/14/2025,Acme,Toner,10,USD")), b = parseScope3SpendCsv(file("A1,2025-03-14,Acme,Toner,10,USD"))
    expect(a.lines[0]!.fingerprintInput).toBe(b.lines[0]!.fingerprintInput)
  })
  test("an impossible date is a listed error with its line number, never a thrown exception", () => {
    const run = () => parseScope3SpendCsv(file("A1,2025-13-01,Acme,Toner,10,USD", "A2,02/30/2025,Acme,Toner,10,USD", "A3,13/01/2025,Acme,Toner,10,USD", "A4,2025-02-29,Acme,Toner,10,USD", "A5,14 March 2025,Acme,Toner,10,USD", "A6,2025-03-14,Acme,Toner,10,USD"), { period })
    expect(run).not.toThrow()
    const parsed = run()
    expect(parsed.ok).toBe(false)
    expect(parsed.errors.map(error => [error.line, error.row])).toEqual([[2, 1], [3, 2], [4, 3], [5, 4], [6, 5]])
    expect(parsed.errors[0]!.message).toBe("Row 1: date “2025-13-01” is not a real date. Write dates as yyyy-mm-dd or mm/dd/yyyy (or leave the date blank).")
    expect(parsed.errors[4]!.message).toBe("Row 5: date “14 March 2025” is not readable. Write dates as yyyy-mm-dd or mm/dd/yyyy (or leave the date blank).")
  })
  test("the template documents both formats", () => {
    expect(scope3SpendImportTemplate()).toContain("# date: Invoice or posting date, written yyyy-mm-dd or mm/dd/yyyy (US month first, e.g. 03/14/2025).")
  })
})
