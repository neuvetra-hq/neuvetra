/**
 * Spend CSV import: the shared parser, ids, fingerprints, mapping precedence and reconciliation (Scope 3 completion I-09;
 * Claude, 30 October 2026; DESIGN §3.6, §7.3, A11, A23, A29, D9). Pure and browser-safe (no node:crypto: a SHA-256
 * function is passed in), so the web preview and the server read a file identically.
 *
 * A file becomes one `purchase_spend` record per line, each calculated by the engine or held by the adapter with a named
 * reason; nothing here calculates emissions. Amounts are activity data: the only arithmetic is the exact decimal sum of
 * amounts per currency for the reconciliation (file total = imported total), which 0030's `import_scope3_spend` repeats in
 * SQL. A file with any refused line (structure, category 9, an unreadable date, …) imports nothing (one transaction).
 */
import { scope3SpendNaicsAllowed, scope3SpendPossibleDuplicates, scope3SpendLineFingerprintInput, SCOPE3_YEAR_MAX, SCOPE3_YEAR_MIN, type Scope3SpendImportRequest, type Scope3SpendLineRef } from './scope3-collection-contract'
import { scope3SpendMappingKeyInput, SCOPE3_CATEGORY_3_SPEND_PROXY_ENABLED } from './scope3-collection'
import { validateCollectionSaveInput } from './collection-contract'
import { scope3SpendGroupKeyInput } from './scope3-spend-grouping'

export const SCOPE3_SPEND_IMPORT_PROFILE = 'neuvetra.scope3-spend-import.v1' as const
/** DESIGN 3.6: CSV only, ≤ 2 MB, ≤ 2,000 lines. */
export const SCOPE3_SPEND_IMPORT_MAX_BYTES = 2 * 1024 * 1024
export const SCOPE3_SPEND_IMPORT_MAX_ROWS = 2000
/** The template's columns (DESIGN 3.6), in the template's order. */
export const SCOPE3_SPEND_IMPORT_COLUMNS = ['line_id', 'date', 'vendor', 'gl_account', 'gl_description', 'description', 'amount', 'currency', 'dollar_year', 'category', 'naics_code', 'margin_choice', 'capital_full_cost'] as const
export type Scope3SpendImportColumn = typeof SCOPE3_SPEND_IMPORT_COLUMNS[number]
/**
 * Other header names a ledger export may use (compared case-insensitively, spaces and hyphens read as underscores). The
 * template's comment lines list them; anything else is refused (strict), so no column is silently dropped.
 */
export const SCOPE3_SPEND_IMPORT_HEADER_ALIASES: Readonly<Record<string, Scope3SpendImportColumn>> = {
  invoice: 'line_id', invoice_number: 'line_id', document_number: 'line_id', transaction_id: 'line_id', reference: 'line_id',
  invoice_date: 'date', posting_date: 'date', transaction_date: 'date',
  supplier: 'vendor', supplier_name: 'vendor', vendor_name: 'vendor', payee: 'vendor',
  account: 'gl_account', account_number: 'gl_account', gl_code: 'gl_account',
  account_name: 'gl_description', account_description: 'gl_description',
  memo: 'description', line_description: 'description',
  net_amount: 'amount', spend: 'amount',
  currency_code: 'currency',
  price_year: 'dollar_year',
  scope3_category: 'category', ghg_category: 'category',
  naics: 'naics_code', naics6: 'naics_code',
  margins: 'margin_choice', price_basis: 'margin_choice',
  full_cost: 'capital_full_cost', capital_at_full_cost: 'capital_full_cost',
}

/** What each template column means (the template's comment lines; DESIGN 3.6). */
const COLUMN_DOC: Readonly<Record<Scope3SpendImportColumn, string>> = {
  line_id: 'Your invoice or ledger line number. Optional; used to spot the same line in two exports.',
  date: 'Invoice or posting date, written yyyy-mm-dd or mm/dd/yyyy (US month first, e.g. 03/14/2025). Optional; a line dated outside the reporting period is held.',
  vendor: 'Supplier name (up to 200 characters).',
  gl_account: 'General-ledger account code (up to 120 characters).',
  gl_description: 'General-ledger account name. Used as the description when description is blank.',
  description: 'What was bought (up to 200 characters). Required unless gl_description is given.',
  amount: 'Amount paid, e.g. 1250.50 or 1,250.50. Required. Negative amounts and text are kept and held, never counted as zero.',
  currency: 'Three-letter currency code. Required. Only USD is calculated; other currencies are kept and held.',
  dollar_year: 'Year of the prices (2012-2035). Blank = the reporting year.',
  category: 'Scope 3 category: 1, 2, 4, 5 or 6. Category 9 (transport the company did not pay for) is entered by hand, never imported. Blank = mapped from memory, else 1 and held for mapping.',
  naics_code: 'Six-digit 2017 NAICS code of the producing sector (needs category). A code outside the category list is held for mapping.',
  margin_choice: 'with_margins (purchaser price, the default) or without_margins (producer price at the factory gate; held until the factory gate is confirmed).',
  capital_full_cost: 'Category 2 only: true when the amount is the full acquisition cost (required for capital goods to calculate).',
}
/**
 * The import template (`apps/site-web/public/templates/scope3-spend-import.csv` holds these exact bytes; the import panel
 * offers them as a download): comment lines documenting every column and its accepted header names, then the header.
 */
export function scope3SpendImportTemplate(): string {
  const lines = ['# Neuvetra Scope 3 spend import template (CSV, UTF-8, up to 2 MB and 2,000 lines). Lines starting with # are ignored.',
    '# Keep the header line below; add one line per purchase. Each line becomes a spend record: calculated, or held with a reason.',
    '# Columns (header names are not case-sensitive; spaces and hyphens read as underscores):']
  for (const column of SCOPE3_SPEND_IMPORT_COLUMNS) {
    const aliases = Object.entries(SCOPE3_SPEND_IMPORT_HEADER_ALIASES).filter(([, target]) => target === column).map(([alias]) => alias)
    lines.push(`# ${column}: ${COLUMN_DOC[column]}${aliases.length ? ` Also accepted as: ${aliases.join(', ')}.` : ''}`)
  }
  lines.push('# Example (put lines like this below the header, without the #): INV-1001,2025-03-14,Acme Office Supply,6100,Office supplies,Toner and paper,4820.50,USD,2025,1,339940,with_margins,')
  lines.push(SCOPE3_SPEND_IMPORT_COLUMNS.join(','))
  return lines.join('\n') + '\n'
}

export interface Scope3SpendImportProblem { line: number | null; row: number | null; message: string }
/** How an amount is read: a plain number (canonical), negative, a number the engine cannot take (> 12 integer or > 3 decimal digits), or not a number. */
export type Scope3SpendAmountKind = 'number' | 'negative' | 'not_calculable' | 'not_a_number'
export interface Scope3SpendImportLine {
  /** 1-based data line (blank lines skipped); `line` is the file line where it starts. */
  row: number; line: number
  lineId: string; date: string; vendor: string; glAccount: string; glDescription: string
  /** The spend line's description: the file's description, else its GL description. */
  description: string
  /** Canonical when a number (no grouping commas, leading or trailing zeros); otherwise as written. */
  amount: string; amountKind: Scope3SpendAmountKind
  currency: string; dollarYear: number | null; category: 1 | 2 | 3 | 4 | 5 | 6 | null; naicsCode: string | null
  marginChoice: 'with_margins' | 'without_margins' | null; capitalFullCost: boolean | null; lineDate: string | null
  /** Texts whose SHA-256 are the line fingerprint (AM-16) and the mapping key (as 0030 and the adapter compute them). */
  fingerprintInput: string; mappingKeyInput: string
}
export interface Scope3SpendImportCounts { rows: number; nonUsd: number; negative: number; notANumber: number; notCalculable: number; duplicatesInFile: number; outsidePeriod: number; withoutNaics: number }
export type Scope3SpendParse =
  | { ok: true; lines: Scope3SpendImportLine[]; fileTotals: Record<string, string>; nonNumericRows: number; counts: Scope3SpendImportCounts; errors: [] }
  | { ok: false; errors: Scope3SpendImportProblem[]; lines: Scope3SpendImportLine[] }

const SQL_NUMERIC = /^-?(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const DEC3 = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ud800-\udfff]/u
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** DESIGN 3.6 canonical amount (0030's reconciliation compares canonical decimals). */
export function scope3CanonicalAmount(written: string): { amount: string; kind: Scope3SpendAmountKind } {
  const s = written.trim()
  const m = /^(-?)(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/.exec(s)
  if (!m) return { amount: s, kind: 'not_a_number' }
  const whole = m[2]!.replace(/,/g, '').replace(/^0+(?=\d)/, '')
  const fraction = (m[3] ?? '').replace(/0+$/, '')
  const zero = /^0$/.test(whole) && fraction === ''
  const amount = `${m[1] && !zero ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
  if (whole.length > 12 || fraction.length > 3) return { amount, kind: 'not_calculable' }
  return { amount, kind: amount.startsWith('-') ? 'negative' : 'number' }
}

/** Exact sum of canonical decimals (≤ 3 dp), as a canonical decimal. Amounts only: TypeScript never sums emissions. */
export function scope3DecimalSum(values: readonly string[]): string {
  let total = 0n
  for (const value of values) {
    const m = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(value)
    if (!m) throw new Error('Not a decimal amount.')
    const scaled = BigInt(m[2]!) * 1000n + BigInt((m[3] ?? '').padEnd(3, '0'))
    total += m[1] ? -scaled : scaled
  }
  const negative = total < 0n, abs = negative ? -total : total
  const fraction = String(abs % 1000n).padStart(3, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${abs / 1000n}${fraction ? `.${fraction}` : ''}`
}

/** RFC 4180 records with the file line each starts on. Throws a problem on broken quoting. */
function records(text: string, firstLine: number): Array<{ line: number; fields: string[]; raw: string }> {
  const out: Array<{ line: number; fields: string[]; raw: string }> = []
  let i = 0, line = firstLine
  while (i < text.length) {
    const start = line, from = i
    const fields: string[] = []
    let field = '', quoted = false, afterQuote = false
    for (;;) {
      if (i >= text.length) { if (quoted) throw { line: start, row: null, message: 'A quoted field is not closed.' }; fields.push(field); break }
      const c = text[i]!
      if (quoted) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue } quoted = false; afterQuote = true; i++; continue }
        if (c === '\n') line++
        field += c; i++; continue
      }
      if (c === ',') { fields.push(field); field = ''; afterQuote = false; i++; continue }
      if (c === '\r' && text[i + 1] === '\n') { fields.push(field); i += 2; line++; break }
      if (c === '\n') { fields.push(field); i++; line++; break }
      if (afterQuote) throw { line: start, row: null, message: 'A quoted field must be followed by a comma or the end of the line.' }
      if (c === '"') { if (field.trim() === '') { field = ''; quoted = true; i++; continue } throw { line: start, row: null, message: 'A quote inside an unquoted field: quote the whole field.' } }
      if (c === '\r') throw { line: start, row: null, message: 'Line breaks must be CRLF or LF.' }
      field += c; i++
    }
    out.push({ line: start, fields, raw: text.slice(from, i) })
  }
  return out
}

const headerName = (cell: string) => cell.trim().toLowerCase().replace(/[\s-]+/g, '_')
/** An ISO date that exists (no NaN: `2025-13-01` is not a date, never a thrown RangeError). */
const realDate = (value: string) => { if (!DATE.test(value)) return false; const time = Date.parse(`${value}T00:00:00.000Z`); return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value }
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
/**
 * Round 3 lane C (owner decision 9): a written date as an ISO date. `yyyy-mm-dd`, or the US `mm/dd/yyyy` (month first,
 * leading zeros optional) that US accounting exports use. Null for an unreadable or impossible date (the caller lists it).
 */
export function scope3SpendDate(written: string): { iso: string } | { problem: 'not_real' | 'not_readable' } {
  const us = US_DATE.exec(written)
  const iso = us ? `${us[3]}-${us[1]!.padStart(2, '0')}-${us[2]!.padStart(2, '0')}` : written
  if (!us && !DATE.test(written)) return { problem: 'not_readable' }
  return realDate(iso) ? { iso } : { problem: 'not_real' }
}

/**
 * Reads a spend file (bytes as uploaded). Comment lines starting with `#` and blank lines before the header are skipped
 * (the template documents itself that way); lines whose fields are all blank are skipped. `period` (the setup reporting
 * period) only feeds the preview count of lines dated outside it (the adapter holds them).
 */
export function parseScope3SpendCsv(bytes: Uint8Array, options: { period?: { start: string; endExclusive: string } | null; category3Enabled?: boolean } = {}): Scope3SpendParse {
  const refuse = (message: string, line: number | null = null): Scope3SpendParse => ({ ok: false, errors: [{ line, row: null, message }], lines: [] })
  if (bytes.byteLength > SCOPE3_SPEND_IMPORT_MAX_BYTES) return refuse('The file is larger than 2 MB.')
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return refuse('The file is not UTF-8 text.') }
  if (text.startsWith('﻿')) text = text.slice(1)
  // Leading comment lines (`#`) and blank lines are skipped as text, before any CSV reading, so a comment may hold quotes.
  let offset = 0, skipped = 0
  while (offset < text.length) {
    const end = text.indexOf('\n', offset), next = end === -1 ? text.length : end + 1
    const lineText = text.slice(offset, end === -1 ? text.length : end).replace(/\r$/, '')
    if (!lineText.trimStart().startsWith('#') && lineText.trim() !== '') break
    offset = next; skipped++
  }
  let parsed: ReturnType<typeof records>
  try { parsed = records(text.slice(offset), skipped + 1) } catch (problem) {
    const p = problem as Scope3SpendImportProblem
    return { ok: false, errors: [{ line: p.line, row: null, message: p.message }], lines: [] }
  }
  const h = 0
  const header = parsed[h]
  if (!header) return refuse('The file has no header line.')
  const columns: Partial<Record<Scope3SpendImportColumn, number>> = {}
  const written: Partial<Record<Scope3SpendImportColumn, string>> = {}
  // Round 2 lane E (UX-12): every header problem is listed (each with the header's line number), not only the first.
  const headerProblems: string[] = []
  for (const [index, cell] of header.fields.entries()) {
    const name = headerName(cell)
    const column = (SCOPE3_SPEND_IMPORT_COLUMNS as readonly string[]).includes(name) ? name as Scope3SpendImportColumn : SCOPE3_SPEND_IMPORT_HEADER_ALIASES[name]
    if (!column) { headerProblems.push(`Unknown column "${cell.trim()}". Use the template’s columns (or a listed alias).`); continue }
    if (columns[column] !== undefined) { headerProblems.push(`Column "${column}" appears twice (as "${written[column]}" and "${cell.trim()}").`); continue }
    columns[column] = index; written[column] = cell.trim()
  }
  for (const required of ['amount', 'currency'] as const) if (columns[required] === undefined) headerProblems.push(`Missing required column "${required}".`)
  if (columns.description === undefined && columns.gl_description === undefined) headerProblems.push('Missing required column "description" (or "gl_description").')
  if (headerProblems.length) return { ok: false, errors: headerProblems.map(message => ({ line: header.line, row: null, message })), lines: [] }
  const body = parsed.slice(h + 1).filter(record => !record.fields.every(f => f.trim() === ''))
  if (body.length === 0) return refuse('The file has no spend lines.')
  if (body.length > SCOPE3_SPEND_IMPORT_MAX_ROWS) return refuse('The file has more than 2,000 spend lines.')

  const errors: Scope3SpendImportProblem[] = []
  const lines: Scope3SpendImportLine[] = []
  const allowedCategories = options.category3Enabled ?? SCOPE3_CATEGORY_3_SPEND_PROXY_ENABLED ? ['1', '2', '3', '4', '5', '6'] : ['1', '2', '4', '5', '6']
  const categoryWords = allowedCategories.length === 6 ? '1, 2, 3, 4, 5 or 6' : '1, 2, 4, 5 or 6'
  for (const [index, record] of body.entries()) {
    const row = index + 1
    const problems: string[] = []
    const say = (message: string) => problems.push(`Row ${row}: ${message}`)
    if (record.fields.length !== header.fields.length) { errors.push({ line: record.line, row, message: `Row ${row} has ${record.fields.length} fields; the header has ${header.fields.length}.` }); continue }
    const cell = (column: Scope3SpendImportColumn) => columns[column] === undefined ? '' : record.fields[columns[column]!]!.trim().normalize('NFC')
    const textCell = (column: Scope3SpendImportColumn, label: string, max: number) => {
      const value = cell(column)
      if (CONTROL.test(value)) say(`${label} has a control character.`)
      else if (value.length > max) say(`${label} is longer than ${max} characters.`)
      return value
    }
    const lineId = textCell('line_id', 'line ID', 120), vendor = textCell('vendor', 'vendor', 200), glAccount = textCell('gl_account', 'GL account', 120)
    const glDescription = textCell('gl_description', 'GL description', 200), ownDescription = textCell('description', 'description', 200)
    const description = ownDescription || glDescription
    if (!description) say('a description (or GL description) is required.')
    const amountText = cell('amount')
    if (!amountText) say('amount is required.')
    else if (amountText.length > 100 || CONTROL.test(amountText)) say('amount is not readable.')
    const currencyText = cell('currency')
    if (!currencyText) say('currency is required.')
    else if (!/^[A-Za-z]{3}$/.test(currencyText)) say('currency must be a three-letter code such as USD.')
    // Round 3 lane C (decision 9): ISO or US month/day/year, kept as the ISO date (the fingerprint uses it).
    const writtenDate = cell('date')
    const readDate = writtenDate ? scope3SpendDate(writtenDate) : { iso: '' }
    if ('problem' in readDate) say(`date “${writtenDate}” is ${readDate.problem === 'not_real' ? 'not a real date' : 'not readable'}. Write dates as yyyy-mm-dd or mm/dd/yyyy (or leave the date blank).`)
    const date = 'iso' in readDate ? readDate.iso : ''
    const categoryText = cell('category')
    let category: Scope3SpendImportLine['category'] = null
    if (categoryText === '9') say('category 9 is transport the company did not pay for; it cannot come from your ledger. Enter it by hand.')
    else if (categoryText === '3' && !allowedCategories.includes('3')) say(`category 3 spend is not enabled in this beta (use ${categoryWords}).`)
    else if (categoryText && !allowedCategories.includes(categoryText)) say(`category must be ${categoryWords}.`)
    else if (categoryText) category = Number(categoryText) as Scope3SpendImportLine['category']
    const naicsText = cell('naics_code')
    if (naicsText && !/^\d{6}$/.test(naicsText)) say('NAICS code must be six digits.')
    else if (naicsText && !categoryText) say(`a NAICS code needs its category (${categoryWords}).`)
    const yearText = cell('dollar_year')
    let dollarYear: number | null = null
    if (yearText) { if (/^\d{4}$/.test(yearText) && Number(yearText) >= SCOPE3_YEAR_MIN && Number(yearText) <= SCOPE3_YEAR_MAX) dollarYear = Number(yearText); else say(`dollar year must be a year from ${SCOPE3_YEAR_MIN} to ${SCOPE3_YEAR_MAX}.`) }
    const marginText = cell('margin_choice').toLowerCase()
    const marginChoice = !marginText ? null : marginText === 'with_margins' || marginText === 'with' ? 'with_margins' as const : marginText === 'without_margins' || marginText === 'without' ? 'without_margins' as const : (say('margin choice must be with_margins or without_margins.'), null)
    const capitalText = cell('capital_full_cost').toLowerCase()
    const capitalFullCost = !capitalText ? null : ['true', 'yes', 'y', '1'].includes(capitalText) ? true : ['false', 'no', 'n', '0'].includes(capitalText) ? false : (say('capital_full_cost must be true or false (or blank).'), null)
    if (problems.length) { for (const message of problems) errors.push({ line: record.line, row, message }); continue }
    const { amount, kind } = scope3CanonicalAmount(amountText)
    const currency = currencyText.toUpperCase()
    lines.push({
      row, line: record.line, lineId, date, vendor, glAccount, glDescription, description, amount, amountKind: kind, currency, dollarYear, category,
      naicsCode: naicsText || null, marginChoice, capitalFullCost, lineDate: date || null,
      fingerprintInput: scope3SpendLineFingerprintInput({ lineId, date, vendor, amount, currency }),
      mappingKeyInput: scope3SpendMappingKeyInput({ glAccount, supplierName: vendor, description }),
    })
  }
  if (errors.length) return { ok: false, errors, lines }
  const numeric = lines.filter(line => SQL_NUMERIC.test(line.amount))
  const fileTotals: Record<string, string> = {}
  for (const currency of [...new Set(numeric.map(line => line.currency))].sort()) fileTotals[currency] = scope3DecimalSum(numeric.filter(line => line.currency === currency).map(line => line.amount))
  const seen = new Set<string>()
  let duplicatesInFile = 0
  for (const line of lines) { if (seen.has(line.fingerprintInput)) duplicatesInFile++; seen.add(line.fingerprintInput) }
  const period = options.period
  const counts: Scope3SpendImportCounts = {
    rows: lines.length, nonUsd: lines.filter(line => line.currency !== 'USD').length, negative: lines.filter(line => line.amountKind === 'negative').length,
    notANumber: lines.filter(line => line.amountKind === 'not_a_number').length, notCalculable: lines.filter(line => line.amountKind === 'not_calculable').length, duplicatesInFile,
    outsidePeriod: period ? lines.filter(line => line.lineDate !== null && (line.lineDate < period.start || line.lineDate >= period.endExclusive)).length : 0,
    withoutNaics: lines.filter(line => line.naicsCode === null).length,
  }
  return { ok: true, lines, fileTotals, nonNumericRows: lines.length - numeric.length, counts, errors: [] }
}

/** A UUID (version-4 layout) from the first 128 bits of a SHA-256. */
function uuidFromSha(hex: string): string {
  const variant = (8 + (parseInt(hex[16]!, 16) & 3)).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
const NS = 'neuvetra.scope3-spend-import.v1'
/** Deterministic ids (DESIGN 3.6): a retried import that failed saves the same records; the same file replays. */
export const scope3SpendImportId = (companyId: string, fileSha256: string, sha256: (text: string) => string) => uuidFromSha(sha256([NS, companyId, fileSha256].join('\u001f')))
export const scope3SpendRecordId = (companyId: string, fileSha256: string, row: number, sha256: (text: string) => string) => uuidFromSha(sha256([NS, companyId, fileSha256, String(row)].join('\u001f')))
const idempotencyKey = (companyId: string, fileSha256: string, row: number, sha256: (text: string) => string) => uuidFromSha(sha256([NS, companyId, fileSha256, String(row), 'request'].join('\u001f')))

/** A remembered mapping (0030 `scope3_spend_mapping_heads`). */
export interface Scope3SpendMappingHead { mappingKeySha256: string; category: number; naicsCode: string; marginChoice: string }
export interface Scope3SpendImportBuiltLine { row: number; recordId: string; lineFingerprint: string; mappingKeySha256: string; mappingSource: 'file' | 'memory' | 'unmatched'; possibleDuplicateOf: Scope3SpendLineRef | null }

/**
 * The `import_scope3_spend` request for a parsed file (server side; I-02 log decision 12 and AM-16). Mapping precedence
 * (DESIGN 3.6): the file's category and NAICS code (`file`; a code outside its category's set is `unmatched`), else the
 * company's remembered mapping for the line's key, else for its vendor-and-account group (`memory`; not when the file
 * states another category; round 2 UX-1), else
 * `unmatched` (no code: the adapter holds `naics_code_required`, the unmatched queue). `earlierLines` are the company's
 * saved import lines in the database's order; `possibleDuplicateOf` is what 0030 re-checks.
 */
export function buildScope3SpendImportRequest(input: {
  companyId: string; parsed: Extract<Scope3SpendParse, { ok: true }>; fileSha256: string; fileName: string; evidenceId: string; locationId: string; setupVersionId: string
  reportingYear: number; reportingPeriod: { start: string; endExclusive: string }; mappings: readonly Scope3SpendMappingHead[]
  earlierLines: ReadonlyArray<{ importId: string; row: number; fingerprint: string }>; sha256: (text: string) => string
}): { request: Scope3SpendImportRequest; lines: Scope3SpendImportBuiltLine[] } {
  if (!input.parsed || input.parsed.ok !== true) throw new Error('The spend file has errors; nothing can be imported.')
  const { parsed, sha256 } = input
  const importId = scope3SpendImportId(input.companyId, input.fileSha256, sha256)
  const memory = new Map(input.mappings.map(head => [head.mappingKeySha256, head]))
  const fingerprints = parsed.lines.map(line => sha256(line.fingerprintInput))
  const duplicates = scope3SpendPossibleDuplicates(importId, fingerprints, input.earlierLines.filter(line => line.importId !== importId))
  const lines: Scope3SpendImportBuiltLine[] = []
  const rows = parsed.lines.map((line, index) => {
    const mappingKeySha256 = sha256(line.mappingKeyInput)
    // Round 2 UX-1: the line's own remembered mapping (its key, a per-line override) first, else its vendor-and-account
    // group's (scope3-spend-grouping.ts), so a new description of a mapped vendor and account is mapped from memory.
    const groupInput = scope3SpendGroupKeyInput({ glAccount: line.glAccount, supplierName: line.vendor })
    const head = memory.get(mappingKeySha256) ?? (groupInput === null ? undefined : memory.get(sha256(groupInput)))
    let mapping: { category: number; naicsCode: string | null; marginChoice: string; source: Scope3SpendImportBuiltLine['mappingSource'] }
    if (line.naicsCode !== null && line.category !== null) mapping = scope3SpendNaicsAllowed(line.category, line.naicsCode)
      ? { category: line.category, naicsCode: line.naicsCode, marginChoice: line.marginChoice ?? 'with_margins', source: 'file' }
      : { category: line.category, naicsCode: null, marginChoice: line.marginChoice ?? 'with_margins', source: 'unmatched' }
    else if (head && (line.category === null || line.category === head.category)) mapping = { category: head.category, naicsCode: head.naicsCode, marginChoice: line.marginChoice ?? head.marginChoice, source: 'memory' }
    else mapping = { category: line.category ?? 1, naicsCode: null, marginChoice: line.marginChoice ?? 'with_margins', source: 'unmatched' }
    const usd = line.currency === 'USD' && DEC3.test(line.amount)
    const possibleDuplicateOf = duplicates[index] ?? null
    const activity = {
      kind: 'purchase_spend', locationId: input.locationId, setupVersionId: input.setupVersionId, sourceId: line.lineId || `row-${line.row}`, state: 'active', withdrawalReason: null,
      quantity: { originalValue: line.amount, originalUnit: line.currency, normalizedValue: usd ? line.amount : null, normalizedUnit: usd ? 'USD' : null },
      quality: 'actual', estimateBasis: null, period: { start: input.reportingPeriod.start, endExclusive: input.reportingPeriod.endExclusive },
      reference: `spend import ${input.fileName} sha256 ${input.fileSha256.slice(0, 12)} row ${line.row}`,
      notes: line.glDescription && line.glDescription !== line.description ? `GL description: ${line.glDescription}` : '',
      evidenceIds: [input.evidenceId],
      payload: {
        category: mapping.category, naicsCode: mapping.naicsCode, dollarYear: line.dollarYear, marginChoice: mapping.marginChoice, boughtAtFactoryGate: false, capitalFullCost: line.capitalFullCost,
        taxTreatment: 'unknown', supplierName: line.vendor, glAccount: line.glAccount, description: line.description, categoryConfirmed: false, activityOverlap: 'unknown',
        importId, importRow: line.row, mappingSource: mapping.source, paidByReportingCompany: null, spendEstimateBasis: null, lineDate: line.lineDate, possibleDuplicateOf, duplicateConfirmedDistinct: false,
      },
    }
    const recordId = scope3SpendRecordId(input.companyId, input.fileSha256, line.row, sha256)
    const request = { idempotencyKey: idempotencyKey(input.companyId, input.fileSha256, line.row, sha256), expectedRevision: 0 as const, expectedVersionId: null, correctionReason: null, activity }
    // The shared contract decides; a line it refuses is the parser's defect, never a silent drop.
    try { validateCollectionSaveInput(request) } catch { throw new Error(`Row ${line.row} could not be turned into a spend record.`) }
    lines.push({ row: line.row, recordId, lineFingerprint: fingerprints[index]!, mappingKeySha256, mappingSource: mapping.source, possibleDuplicateOf })
    return { recordId, request, lineFingerprint: fingerprints[index]! }
  })
  return {
    request: { importId, fileSha256: input.fileSha256, fileName: input.fileName, evidenceId: input.evidenceId, locationId: input.locationId, setupVersionId: input.setupVersionId, reportingYear: input.reportingYear,
      rowCount: rows.length, fileTotals: parsed.fileTotals, nonNumericRows: parsed.nonNumericRows, rows },
    lines,
  }
}

export interface Scope3SpendReconciliation {
  reconciled: boolean
  nonNumericRows: { file: number; imported: number }
  currencies: Array<{ currency: string; fileTotal: string | null; importedTotal: string | null; lines: number; matches: boolean }>
}
/**
 * File total = imported total, per currency (D9): the import's stored file totals against the amounts of the lines it
 * saved (their first revision), plain decimals only; the other lines are counted apart on both sides.
 */
export function scope3SpendImportReconciliation(fileTotals: Readonly<Record<string, string>>, fileNonNumericRows: number, saved: ReadonlyArray<{ amount: string; currency: string }>): Scope3SpendReconciliation {
  const numeric = saved.filter(line => SQL_NUMERIC.test(line.amount))
  const currencies = [...new Set([...Object.keys(fileTotals), ...numeric.map(line => line.currency)])].sort().map(currency => {
    const mine = numeric.filter(line => line.currency === currency)
    const importedTotal = mine.length ? scope3DecimalSum(mine.map(line => line.amount)) : null
    const fileTotal = Object.prototype.hasOwnProperty.call(fileTotals, currency) ? fileTotals[currency]! : null
    const matches = fileTotal !== null && importedTotal !== null && scope3DecimalSum([fileTotal]) === importedTotal
    return { currency, fileTotal, importedTotal, lines: mine.length, matches }
  })
  const imported = saved.length - numeric.length
  return { reconciled: currencies.every(row => row.matches) && imported === fileNonNumericRows, nonNumericRows: { file: fileNonNumericRows, imported }, currencies }
}
