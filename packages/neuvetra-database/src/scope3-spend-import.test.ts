// Spend CSV import: the shared parser, ids, fingerprints, mapping precedence and reconciliation (Scope 3 completion I-09;
// Claude, 30 October 2026; DESIGN §3.6, §7.3, A29). Pure and browser-safe: no database. The r4 pack's two C1 files are
// parsed exactly as the r4 oracle reads them (fingerprints, possible duplicate of import 1 row 3, totals).
import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  SCOPE3_SPEND_IMPORT_COLUMNS, SCOPE3_SPEND_IMPORT_HEADER_ALIASES, SCOPE3_SPEND_IMPORT_MAX_BYTES, SCOPE3_SPEND_IMPORT_MAX_ROWS,
  buildScope3SpendImportRequest, parseScope3SpendCsv, scope3CanonicalAmount, scope3DecimalSum, scope3SpendImportId, scope3SpendImportReconciliation,
  scope3SpendRecordId, type Scope3SpendAmountKind, type Scope3SpendParse,
} from './scope3-spend-import'
import { validateCollectionSaveInput } from './collection-contract'
import { scope3SpendLineFingerprintInput } from './scope3-collection-contract'
import { scope3SpendMappingKeyInput } from './scope3-collection'

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const bytes = (text: string) => new TextEncoder().encode(text)
const HEADER = SCOPE3_SPEND_IMPORT_COLUMNS.join(',')
const parse = (text: string, options = {}) => parseScope3SpendCsv(bytes(text), options)
const ok = (result: Scope3SpendParse) => { if (!result.ok) throw new Error(JSON.stringify(result.errors)); return result }
const company = '30910000-0000-4000-8000-000000000001', location = '30910000-0000-4000-8000-000000000002', setup = '30910000-0000-4000-8000-000000000003', evidence = '30910000-0000-4000-8000-000000000004'
const period = { start: '2025-01-01', endExclusive: '2026-01-01' }
// Round 2 ENG-1: the r4 pack's C1 spend files are committed fixtures (byte for byte), read relative to this file.
const R4_FILES: Record<string, string> = { 'spend-import.csv': 'spend-r4-c1.csv', 'spend-import-overlap.csv': 'spend-r4-c1-overlap.csv' }
const r4File = (name: string) => Bun.file(`${import.meta.dir}/testdata/${R4_FILES[name]}`)

describe('spend CSV parser (I-09)', () => {
  test('columns, aliases and limits are the design’s', () => {
    expect(SCOPE3_SPEND_IMPORT_COLUMNS).toEqual(['line_id', 'date', 'vendor', 'gl_account', 'gl_description', 'description', 'amount', 'currency', 'dollar_year', 'category', 'naics_code', 'margin_choice', 'capital_full_cost'])
    expect(SCOPE3_SPEND_IMPORT_MAX_BYTES).toBe(2 * 1024 * 1024)
    expect(SCOPE3_SPEND_IMPORT_MAX_ROWS).toBe(2000)
    for (const [alias, column] of Object.entries(SCOPE3_SPEND_IMPORT_HEADER_ALIASES)) {
      expect(SCOPE3_SPEND_IMPORT_COLUMNS as readonly string[]).toContain(column)
      expect(SCOPE3_SPEND_IMPORT_COLUMNS as readonly string[]).not.toContain(alias)
    }
  })

  test('canonical amounts: no grouping commas, no leading zeros, no trailing fractional zeros; others are kept as written', () => {
    const cases: Array<[string, string, Scope3SpendAmountKind]> = [
      ['4820.5', '4820.5', 'number'], ['4,820.50', '4820.5', 'number'], ['0012', '12', 'number'], ['1,234,567.000', '1234567', 'number'], ['0.000', '0', 'number'], ['-0', '0', 'number'],
      ['-50.00', '-50', 'negative'], ['-1,000', '-1000', 'negative'], ['12.3456', '12.3456', 'not_calculable'], ['1234567890123', '1234567890123', 'not_calculable'],
      ['$12', '$12', 'not_a_number'], ['(12.50)', '(12.50)', 'not_a_number'], ['12,34', '12,34', 'not_a_number'], ['1.2.3', '1.2.3', 'not_a_number'], ['+5', '+5', 'not_a_number'], ['n/a', 'n/a', 'not_a_number'],
    ]
    for (const [written, canonical, kind] of cases) expect([written, scope3CanonicalAmount(written)]).toEqual([written, { amount: canonical, kind }])
  })

  test('exact decimal sums (activity amounts, never emissions)', () => {
    expect(scope3DecimalSum(['4820.5', '2310', '1275.25'])).toBe('8405.75')
    expect(scope3DecimalSum(['0.1', '0.2'])).toBe('0.3')
    expect(scope3DecimalSum(['-50', '20.005'])).toBe('-29.995')
    expect(scope3DecimalSum(['999999999999.999', '999999999999.999'])).toBe('1999999999999.998')
    expect(scope3DecimalSum([])).toBe('0')
  })

  test('the r4 C1 files: rows, file totals, fingerprints and the mapping keys as the oracle reads them', async () => {
    const first = ok(parseScope3SpendCsv(new Uint8Array(await r4File('spend-import.csv').arrayBuffer())))
    const overlap = ok(parseScope3SpendCsv(new Uint8Array(await r4File('spend-import-overlap.csv').arrayBuffer())))
    expect(first.lines.map(line => [line.row, line.lineId, line.amount, line.currency, line.category, line.naicsCode, line.marginChoice, line.dollarYear, line.lineDate, line.capitalFullCost])).toEqual([
      [1, 'INV-2025-0101', '4820.5', 'USD', 1, '339940', 'with_margins', 2025, '2025-03-14', null],
      [2, 'INV-2025-0102', '2310', 'USD', 1, '541430', 'with_margins', 2025, '2025-06-30', null],
      [3, 'INV-2025-0103', '1275.25', 'USD', 1, '722320', 'with_margins', 2024, '2025-11-20', null],
    ])
    expect(first.fileTotals).toEqual({ USD: '8405.75' })
    expect(first.nonNumericRows).toBe(0)
    // DESIGN 3.6 fingerprint: line ID and vendor trimmed and lower-cased, date as written, canonical amount, currency upper-cased.
    const oracle = (row: Record<string, string>) => sha256([row.line_id!.trim().toLowerCase(), row.date, row.vendor!.trim().toLowerCase(), row.amount, row.currency!.toUpperCase()].join('\u001f'))
    expect(sha256(overlap.lines[0]!.fingerprintInput)).toBe(oracle({ line_id: 'INV-2025-0103', date: '2025-11-20', vendor: 'Mission Catering TEST', amount: '1275.25', currency: 'USD' }))
    expect(sha256(overlap.lines[0]!.fingerprintInput)).toBe(sha256(first.lines[2]!.fingerprintInput))
    expect(sha256(overlap.lines[0]!.fingerprintInput).slice(0, 12)).toBe('3b91c5ea727f')
    expect(overlap.lines[0]!.mappingKeyInput).toBe(scope3SpendMappingKeyInput({ glAccount: '6300', supplierName: 'Mission Catering TEST', description: 'Client meeting catering' }))
    expect(overlap.counts).toMatchObject({ rows: 2, duplicatesInFile: 0, nonUsd: 0, negative: 0, notANumber: 0, notCalculable: 0 })
  })

  test('RFC 4180: quotes, escaped quotes, commas and line breaks inside quotes, CRLF, BOM, comment and blank lines', () => {
    const text = '﻿# Neuvetra spend import template\r\n# a comment line\r\n\r\n' + HEADER + '\r\n'
      + '"A-1",2025-02-01,"Smith, Jones & Co","6100","Office","Toner ""black""\nand paper","1,250.00",usd,,1,339940,,\r\n'
      + ',,,,,,,,,,,,\r\n'
      + 'A-2,2025-02-02,Acme,6100,Office,,99,USD,2025,,,,\r\n'
    const result = ok(parse(text))
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]).toMatchObject({ row: 1, line: 5, lineId: 'A-1', vendor: 'Smith, Jones & Co', description: 'Toner "black"\nand paper', amount: '1250', amountKind: 'number', currency: 'USD', dollarYear: null })
    // gl_description stands in for a missing description.
    expect(result.lines[1]).toMatchObject({ row: 2, line: 8, description: 'Office', glDescription: 'Office', category: null, naicsCode: null })
    expect(result.fileTotals).toEqual({ USD: '1349' })
  })

  test('header aliases and case are accepted; unknown, duplicate and missing required columns refuse the file', () => {
    const aliased = ok(parse('Invoice Number,Posting Date,Supplier,Account,Account Name,Memo,Net Amount,Currency Code,Price Year,Scope3 Category,NAICS,Margins,Full Cost\nX1,2025-05-05,Acme,6100,Office,Toner,10,USD,2025,1,339940,with_margins,no\n'))
    expect(aliased.lines[0]).toMatchObject({ lineId: 'X1', vendor: 'Acme', glAccount: '6100', description: 'Toner', amount: '10', category: 1, naicsCode: '339940', capitalFullCost: false })
    const unknown = parse('amount,currency,description,department\n1,USD,a,Ops\n')
    expect(unknown.ok).toBe(false)
    expect(unknown.errors[0]).toEqual({ line: 1, row: null, message: 'Unknown column "department". Use the template’s columns (or a listed alias).' })
    expect(parse('amount,currency,description,memo\n1,USD,a,b\n').errors[0]!.message).toBe('Column "description" appears twice (as "description" and "memo").')
    expect(parse('amount,description\n1,a\n').errors[0]!.message).toBe('Missing required column "currency".')
    expect(parse('currency,description\nUSD,a\n').errors[0]!.message).toBe('Missing required column "amount".')
    expect(parse('amount,currency\n1,USD\n').errors[0]!.message).toBe('Missing required column "description" (or "gl_description").')
  })

  test('file-level refusals: not UTF-8, too large, no rows, too many rows, broken quoting, wrong field count', () => {
    const bad = parseScope3SpendCsv(new Uint8Array([0x61, 0x6d, 0xff, 0x0a]))
    expect(bad.errors[0]!.message).toBe('The file is not UTF-8 text.')
    expect(parseScope3SpendCsv(new Uint8Array(SCOPE3_SPEND_IMPORT_MAX_BYTES + 1).fill(0x61)).errors[0]!.message).toBe('The file is larger than 2 MB.')
    expect(parse(HEADER + '\n').errors[0]!.message).toBe('The file has no spend lines.')
    expect(parse('').errors[0]!.message).toBe('The file has no header line.')
    const many = HEADER + '\n' + Array.from({ length: SCOPE3_SPEND_IMPORT_MAX_ROWS + 1 }, (_, i) => `L${i},,V,,,d,1,USD,,,,,`).join('\n') + '\n'
    expect(parse(many).errors[0]!.message).toBe('The file has more than 2,000 spend lines.')
    expect(parse(HEADER + '\n"open,,,,,,1,USD,,,,,\n').errors[0]!.message).toBe('A quoted field is not closed.')
    expect(parse(HEADER + '\nA"B,,,,,d,1,USD,,,,,\n').errors[0]).toEqual({ line: 2, row: null, message: 'A quote inside an unquoted field: quote the whole field.' })
    expect(parse(HEADER + '\nA,,,,,d,1,USD\n').errors[0]).toEqual({ line: 2, row: 1, message: 'Row 1 has 8 fields; the header has 13.' })
  })

  test('row refusals name the row: category 9, other categories, NAICS shape, dollar year, margin, capital, currency, date, lengths', () => {
    const row = (cells: Partial<Record<string, string>>) => SCOPE3_SPEND_IMPORT_COLUMNS.map(column => cells[column] ?? ({ description: 'Line', amount: '10', currency: 'USD' } as Record<string, string>)[column] ?? '').join(',')
    const refused = (cells: Partial<Record<string, string>>, options = {}) => { const r = parse(`${HEADER}\n${row(cells)}\n`, options); expect(r.ok).toBe(false); return r.errors.map(e => e.message) }
    expect(refused({ category: '9' })).toEqual(['Row 1: category 9 is transport the company did not pay for; it cannot come from your ledger. Enter it by hand.'])
    expect(refused({ category: '3' })).toEqual(['Row 1: category 3 spend is not enabled in this beta (use 1, 2, 4, 5 or 6).'])
    expect(parse(`${HEADER}\n${row({ category: '3', naics_code: '324110' })}\n`, { category3Enabled: true }).ok).toBe(true)
    expect(refused({ category: '7' })).toEqual(['Row 1: category must be 1, 2, 4, 5 or 6.'])
    expect(refused({ naics_code: '33994', category: '1' })).toEqual(['Row 1: NAICS code must be six digits.'])
    expect(refused({ naics_code: '339940' })).toEqual(['Row 1: a NAICS code needs its category (1, 2, 4, 5 or 6).'])
    expect(refused({ dollar_year: '2011' })).toEqual(['Row 1: dollar year must be a year from 2012 to 2035.'])
    expect(refused({ margin_choice: 'retail' })).toEqual(['Row 1: margin choice must be with_margins or without_margins.'])
    expect(refused({ capital_full_cost: 'maybe' })).toEqual(['Row 1: capital_full_cost must be true or false (or blank).'])
    expect(refused({ currency: 'US$' })).toEqual(['Row 1: currency must be a three-letter code such as USD.'])
    expect(refused({ currency: '' })).toEqual(['Row 1: currency is required.'])
    expect(refused({ amount: '' })).toEqual(['Row 1: amount is required.'])
    expect(refused({ description: '' })).toEqual(['Row 1: a description (or GL description) is required.'])
    // DESIGN 3.6 held unreadable dates; the adapter cannot tell an unreadable date from no date (I-03b gap), so it is refused.
    // Round 3 lane C (decision 9): US month/day/year is read (scope3-spend-dates.test.ts); a day-first or impossible date is refused, named.
    expect(refused({ date: '14/03/2025' })).toEqual(['Row 1: date “14/03/2025” is not a real date. Write dates as yyyy-mm-dd or mm/dd/yyyy (or leave the date blank).'])
    expect(refused({ date: '2025-02-30' })).toEqual(['Row 1: date “2025-02-30” is not a real date. Write dates as yyyy-mm-dd or mm/dd/yyyy (or leave the date blank).'])
    expect(refused({ vendor: 'v'.repeat(201) })).toEqual(['Row 1: vendor is longer than 200 characters.'])
    expect(refused({ gl_account: 'g'.repeat(121) })).toEqual(['Row 1: GL account is longer than 120 characters.'])
    expect(refused({ line_id: 'l'.repeat(121) })).toEqual(['Row 1: line ID is longer than 120 characters.'])
    expect(refused({ description: 'bad\u0007bell' })).toEqual(['Row 1: description has a control character.'])
  })

  test('amounts that cannot be calculated are kept and counted, never zero: non-numeric, negative, too precise, other currencies', () => {
    const text = `${HEADER}\nA,,V,,,d,n/a,USD,,,,,\nB,,V,,,d,-25.50,USD,,,,,\nC,,V,,,d,1.2345,USD,,,,,\nD,,V,,,d,"1,000",eur,,,,,\nE,,V,,,d,7,USD,,,,,\nF,,V,,,d,abc,EUR,,,,,\n`
    const result = ok(parse(text))
    expect(result.lines.map(line => [line.amount, line.amountKind, line.currency])).toEqual([['n/a', 'not_a_number', 'USD'], ['-25.5', 'negative', 'USD'], ['1.2345', 'not_calculable', 'USD'], ['1000', 'number', 'EUR'], ['7', 'number', 'USD'], ['abc', 'not_a_number', 'EUR']])
    // The file totals are the plain decimals per currency (0030's reconciliation rule); the rest are non-numeric rows.
    expect(result.fileTotals).toEqual({ USD: '-18.5', EUR: '1000' })
    expect(result.nonNumericRows).toBe(3)
    expect(result.counts).toMatchObject({ rows: 6, nonUsd: 2, negative: 1, notANumber: 2, notCalculable: 1 })
  })

  test('preview counts: in-file duplicates and lines dated outside the reporting period', () => {
    const text = `${HEADER}\nA,2025-03-01,Acme,,,d,10,USD,,,,,\n a ,2025-03-01, ACME ,,,d,10.00,usd,,,,,\nB,2024-12-31,Acme,,,d,5,USD,,,,,\nC,2026-01-01,Acme,,,d,5,USD,,,,,\nD,,Acme,,,d,5,USD,,,,,\n`
    const result = ok(parse(text, { period }))
    expect(result.counts.duplicatesInFile).toBe(1)
    expect(result.counts.outsidePeriod).toBe(2)
  })
})

describe('spend import request (I-09): deterministic ids, mapping precedence, duplicates, records the contract accepts', () => {
  const head = (key: string, category: number, naicsCode: string, marginChoice = 'with_margins') => ({ mappingKeySha256: sha256(key), category, naicsCode, marginChoice })
  const build = (text: string, extra: Partial<Parameters<typeof buildScope3SpendImportRequest>[0]> = {}) => {
    const parsed = ok(parse(text))
    return buildScope3SpendImportRequest({ companyId: company, parsed, fileSha256: sha256(text), fileName: 'ledger.csv', evidenceId: evidence, locationId: location, setupVersionId: setup, reportingYear: 2025,
      reportingPeriod: period, mappings: [], earlierLines: [], sha256, ...extra })
  }

  test('ids are deterministic per company, file and row; UUID v4 layout', () => {
    const fileSha = sha256('x')
    const importId = scope3SpendImportId(company, fileSha, sha256)
    expect(importId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(scope3SpendImportId(company, fileSha, sha256)).toBe(importId)
    expect(scope3SpendImportId(location, fileSha, sha256)).not.toBe(importId)
    expect(scope3SpendRecordId(company, fileSha, 1, sha256)).not.toBe(scope3SpendRecordId(company, fileSha, 2, sha256))
    const text = `${HEADER}\nA,2025-03-01,Acme,6100,Office,Toner,10,USD,2025,1,339940,with_margins,\n`
    expect(build(text).request).toEqual(build(text).request)
  })

  test('every row is a purchase_spend save the shared contract accepts, at the import’s location, setup version, period and evidence', () => {
    const text = `${HEADER}\nA,2025-03-01,Acme,6100,Office,Toner,10,USD,2025,1,339940,with_margins,\n,,Beta,,Office,,-5,USD,,2,334111,,true\nC,,Gamma,,,Item,99,EUR,,,,,\n`
    const { request, lines } = build(text)
    expect(request).toMatchObject({ fileSha256: sha256(text), fileName: 'ledger.csv', evidenceId: evidence, locationId: location, setupVersionId: setup, reportingYear: 2025, rowCount: 3, fileTotals: { USD: '5', EUR: '99' }, nonNumericRows: 0 })
    for (const [index, row] of request.rows.entries()) {
      const valid = validateCollectionSaveInput(row.request)
      expect(valid.activity).toMatchObject({ kind: 'purchase_spend', locationId: location, setupVersionId: setup, state: 'active', quality: 'actual', period, evidenceIds: [evidence] })
      expect(valid.activity.payload).toMatchObject({ importId: request.importId, importRow: index + 1, boughtAtFactoryGate: false, taxTreatment: 'unknown', categoryConfirmed: false, activityOverlap: 'unknown',
        paidByReportingCompany: null, spendEstimateBasis: null, duplicateConfirmedDistinct: false })
      expect(row.recordId).toBe(scope3SpendRecordId(company, sha256(text), index + 1, sha256))
      expect(row.lineFingerprint).toBe(lines[index]!.lineFingerprint)
      expect(valid.activity.reference).toBe(`spend import ledger.csv sha256 ${sha256(text).slice(0, 12)} row ${index + 1}`)
    }
    const activities = request.rows.map(row => validateCollectionSaveInput(row.request).activity)
    expect(activities.map(a => [a.sourceId, a.quantity.originalValue, a.quantity.originalUnit, a.quantity.normalizedValue, a.quantity.normalizedUnit])).toEqual([
      ['A', '10', 'USD', '10', 'USD'], ['row-2', '-5', 'USD', null, null], ['C', '99', 'EUR', null, null]])
    expect(activities.map(a => { const p = a.payload as Record<string, unknown>; return [p.category, p.naicsCode, p.marginChoice, p.mappingSource, p.dollarYear, p.lineDate, p.capitalFullCost, p.description, p.supplierName, p.glAccount] })).toEqual([
      [1, '339940', 'with_margins', 'file', 2025, '2025-03-01', null, 'Toner', 'Acme', '6100'],
      [2, '334111', 'with_margins', 'file', null, null, true, 'Office', 'Beta', ''],
      [1, null, 'with_margins', 'unmatched', null, null, null, 'Item', 'Gamma', '']])
  })

  test('mapping precedence: file → memory → unmatched; a file code outside its category is unmatched; memory never overrides a stated other category', () => {
    const keyOf = (gl: string, vendor: string, description: string) => scope3SpendMappingKeyInput({ glAccount: gl, supplierName: vendor, description })
    const text = `${HEADER}\nA,,Acme,6100,,Toner,10,USD,,1,339940,,\nB,,Truckco,5100,,Freight,10,USD,,4,541611,,\nC,,Cater,6300,,Lunch,10,USD,,,,,\nD,,Cater,6300,,Lunch,10,USD,,2,,,\nE,,Cater,6300,,Lunch,10,USD,,1,,without_margins,\nF,,Nobody,,,Thing,10,USD,,,,,\n`
    const { request, lines } = build(text, { mappings: [head(keyOf('6300', 'Cater', 'Lunch'), 1, '722320'), head(keyOf('6100', 'Acme', 'Toner'), 2, '334111')] })
    const payloads = request.rows.map(row => validateCollectionSaveInput(row.request).activity.payload as Record<string, unknown>)
    expect(payloads.map(p => [p.mappingSource, p.category, p.naicsCode, p.marginChoice])).toEqual([
      ['file', 1, '339940', 'with_margins'],
      ['unmatched', 4, null, 'with_margins'],
      ['memory', 1, '722320', 'with_margins'],
      ['unmatched', 2, null, 'with_margins'],
      ['memory', 1, '722320', 'without_margins'],
      ['unmatched', 1, null, 'with_margins']])
    expect(lines.map(line => line.mappingKeySha256)).toEqual([keyOf('6100', 'Acme', 'Toner'), keyOf('5100', 'Truckco', 'Freight'), keyOf('6300', 'Cater', 'Lunch'), keyOf('6300', 'Cater', 'Lunch'), keyOf('6300', 'Cater', 'Lunch'), keyOf('', 'Nobody', 'Thing')].map(sha256))
  })

  test('possibleDuplicateOf: the earliest earlier line of an earlier import, else an earlier row of this file (0030 AM-16)', () => {
    const text = `${HEADER}\nA,2025-03-01,Acme,,,d,10,USD,,,,,\nB,2025-03-02,Acme,,,d,10,USD,,,,,\na ,2025-03-01, acme,,,d,10.0,usd,,,,,\n`
    const fingerprintA = sha256(scope3SpendLineFingerprintInput({ lineId: 'A', date: '2025-03-01', vendor: 'Acme', amount: '10', currency: 'USD' }))
    const fingerprintB = sha256(scope3SpendLineFingerprintInput({ lineId: 'B', date: '2025-03-02', vendor: 'Acme', amount: '10', currency: 'USD' }))
    const fresh = build(text)
    const dup = (r: typeof fresh) => r.request.rows.map(row => (validateCollectionSaveInput(row.request).activity.payload as Record<string, unknown>).possibleDuplicateOf)
    expect(dup(fresh)).toEqual([null, null, { importId: fresh.request.importId, row: 1 }])
    const earlierImport = '30910000-0000-4000-8000-0000000000e1'
    const later = build(text, { earlierLines: [{ importId: earlierImport, row: 7, fingerprint: fingerprintB }, { importId: earlierImport, row: 9, fingerprint: fingerprintA }] })
    expect(dup(later)).toEqual([{ importId: earlierImport, row: 9 }, { importId: earlierImport, row: 7 }, { importId: earlierImport, row: 9 }])
    // A replay of this very file: its own lines are not "earlier" lines.
    expect(dup(build(text, { earlierLines: [{ importId: fresh.request.importId, row: 1, fingerprint: fingerprintA }] }))).toEqual(dup(fresh))
  })

  test('the r4 overlap file after the first file: row 1 points at import 1 row 3, as the oracle expects', async () => {
    const files = await Promise.all(['spend-import.csv', 'spend-import-overlap.csv'].map(async name => ({ name, bytes: new Uint8Array(await r4File(name).arrayBuffer()) })))
    const earlier: Array<{ importId: string; row: number; fingerprint: string }> = []
    const built = files.map(file => {
      const parsed = ok(parseScope3SpendCsv(file.bytes))
      const fileSha = createHash('sha256').update(file.bytes).digest('hex')
      const result = buildScope3SpendImportRequest({ companyId: company, parsed, fileSha256: fileSha, fileName: file.name, evidenceId: evidence, locationId: location, setupVersionId: setup, reportingYear: 2025, reportingPeriod: period, mappings: [], earlierLines: [...earlier], sha256 })
      earlier.push(...result.request.rows.map((row, i) => ({ importId: result.request.importId, row: i + 1, fingerprint: row.lineFingerprint })))
      return result
    })
    const payload = (i: number, row: number) => validateCollectionSaveInput(built[i]!.request.rows[row]!.request).activity.payload as Record<string, unknown>
    expect(payload(1, 0).possibleDuplicateOf).toEqual({ importId: built[0]!.request.importId, row: 3 })
    expect(payload(1, 1).possibleDuplicateOf).toBeNull()
    expect([0, 1, 2].map(row => payload(0, row).possibleDuplicateOf)).toEqual([null, null, null])
    expect(built[0]!.request.fileSha256).toBe('cb5871465315cd4528ae8db7055db4586cd7e8940867c97813b268420a81c0ca')
    expect(built[1]!.request.fileSha256).toBe('6571ed6d0116b867259b9c2e5a5f19ee6a6dffd8ac70eb0bbb2fd2baa176719b')
  })

  test('a file with row errors builds nothing', () => {
    const parsed = parse(`${HEADER}\nA,,V,,,d,10,USD,,9,,,\n`)
    expect(parsed.ok).toBe(false)
    expect(() => buildScope3SpendImportRequest({ companyId: company, parsed: parsed as never, fileSha256: sha256('x'), fileName: 'f.csv', evidenceId: evidence, locationId: location, setupVersionId: setup, reportingYear: 2025, reportingPeriod: period, mappings: [], earlierLines: [], sha256 })).toThrow('The spend file has errors')
  })
})

describe('reconciliation (I-09): file total = imported total per currency', () => {
  test('equal totals reconcile; a lost, changed or extra line does not; non-numeric rows are listed apart', () => {
    const fileTotals = { USD: '8405.75', EUR: '1000' }
    const saved = [{ amount: '4820.5', currency: 'USD' }, { amount: '2310', currency: 'USD' }, { amount: '1275.25', currency: 'USD' }, { amount: '1000', currency: 'EUR' }, { amount: 'n/a', currency: 'USD' }]
    expect(scope3SpendImportReconciliation(fileTotals, 1, saved)).toEqual({ reconciled: true, nonNumericRows: { file: 1, imported: 1 }, currencies: [
      { currency: 'EUR', fileTotal: '1000', importedTotal: '1000', lines: 1, matches: true },
      { currency: 'USD', fileTotal: '8405.75', importedTotal: '8405.75', lines: 3, matches: true }] })
    expect(scope3SpendImportReconciliation(fileTotals, 1, saved.slice(1)).reconciled).toBe(false)
    expect(scope3SpendImportReconciliation(fileTotals, 1, [...saved, { amount: '1', currency: 'GBP' }]).currencies.find(c => c.currency === 'GBP')).toEqual({ currency: 'GBP', fileTotal: null, importedTotal: '1', lines: 1, matches: false })
    expect(scope3SpendImportReconciliation(fileTotals, 0, saved).reconciled).toBe(false)
  })
})
