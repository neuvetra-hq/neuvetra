// Round 2 lane E (UX-12; Claude, 31 October 2026): a spend file with several header problems lists every one, each with its
// line number, so the user fixes the file once (round 1: only "Unknown column "Total"" was listed for a file that also had
// no amount and no currency column). Row problems were already all listed, with line numbers.
import { describe, expect, test } from 'bun:test'
import { parseScope3SpendCsv } from './scope3-spend-import'

const parse = (text: string) => parseScope3SpendCsv(new TextEncoder().encode(text))
describe('round 2 lane E: every import problem is listed with its line number', () => {
  test('the reviewer’s broken file: the unknown column and both missing required columns, all on line 1', () => {
    const result = parse('Date,Supplier,Description,Total\n2025-02-03,Staples TEST,Paper,120\n')
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      { line: 1, row: null, message: 'Unknown column "Total". Use the template’s columns (or a listed alias).' },
      { line: 1, row: null, message: 'Missing required column "amount".' },
      { line: 1, row: null, message: 'Missing required column "currency".' },
    ])
  })
  test('header problems are numbered after leading comment lines, and a repeated column is listed too', () => {
    const result = parse('# exported 2025\nsupplier,supplier,Bogus\nA,B,C\n')
    expect(result.errors.map(e => [e.line, e.message])).toEqual([
      [2, 'Column "vendor" appears twice (as "supplier" and "supplier").'],
      [2, 'Unknown column "Bogus". Use the template’s columns (or a listed alias).'],
      [2, 'Missing required column "amount".'],
      [2, 'Missing required column "currency".'],
      [2, 'Missing required column "description" (or "gl_description").'],
    ])
  })
})
