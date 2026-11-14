/**
 * Bulk currency conversion of held spend lines (round 3 lane C, product review PR-11; Claude, 31 October 2026). Pure and
 * browser-safe. The user states one rate per currency (US dollars per unit), its source and its date; each held imported
 * line in that currency is corrected to US dollars (amount × rate, exact, rounded once half-even to the cent), and the
 * line keeps the conversion in its notes and its correction reason. Amounts are activity data: nothing here calculates
 * emissions (the engine still receives a US-dollar amount, as for a line entered in dollars).
 */
export interface Scope3SpendConversionInput { currency: string; rate: string; rateSource: string; rateDate: string }
export interface Scope3SpendConversion extends Scope3SpendConversionInput { amount: string; usd: string }

const CURRENCY = /^[A-Z]{3}$/
const RATE = /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$/
const AMOUNT = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const ISO = /^\d{4}-\d{2}-\d{2}$/
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/
const realIso = (value: string) => { if (!ISO.test(value)) return false; const time = Date.parse(`${value}T00:00:00.000Z`); return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value }

/** The request body: exactly these four fields; a currency other than USD, a positive rate, a source, a real ISO date. */
export function validateScope3SpendConversionInput(value: unknown): Scope3SpendConversionInput {
  const bad = (message: string) => Object.assign(new Error(message), { code: '22023' })
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad('Invalid currency conversion.')
  const row = value as Record<string, unknown>
  if (Object.keys(row).sort().join('|') !== 'currency|rate|rateDate|rateSource') throw bad('Invalid currency conversion.')
  const { currency, rate, rateSource, rateDate } = row
  if (typeof currency !== 'string' || !CURRENCY.test(currency) || currency === 'USD') throw bad('Name a three-letter currency other than USD.')
  if (typeof rate !== 'string' || !RATE.test(rate) || !/[1-9]/.test(rate)) throw bad('The rate must be a positive number of US dollars per unit (at most 8 decimals).')
  if (typeof rateSource !== 'string' || !rateSource.trim() || rateSource.length > 200 || CONTROL.test(rateSource)) throw bad('Say where the rate comes from (up to 200 characters).')
  if (typeof rateDate !== 'string' || !realIso(rateDate)) throw bad('Give the rate date as yyyy-mm-dd.')
  return { currency, rate, rateSource: rateSource.trim(), rateDate }
}

/** amount × rate as an exact product, rounded once half-even to the cent, canonical (no trailing zeros). */
export function scope3SpendConvertAmount(amount: string, rate: string): string {
  if (!AMOUNT.test(amount) || !RATE.test(rate)) throw new Error('Not a plain amount or rate.')
  const scaled = (text: string) => { const [whole, fraction = ''] = text.split('.'); return { units: BigInt(whole! + fraction), scale: fraction.length } }
  const a = scaled(amount), r = scaled(rate)
  const product = a.units * r.units, scale = a.scale + r.scale
  // To cents: divide by 10^(scale-2), half-even.
  let cents: bigint
  if (scale <= 2) cents = product * 10n ** BigInt(2 - scale)
  else {
    const divisor = 10n ** BigInt(scale - 2), quotient = product / divisor, remainder = product % divisor, twice = remainder * 2n
    cents = twice > divisor || (twice === divisor && quotient % 2n === 1n) ? quotient + 1n : quotient
  }
  const whole = cents / 100n, fraction = String(cents % 100n).padStart(2, '0').replace(/0+$/, '')
  return `${whole}${fraction ? `.${fraction}` : ''}`
}

const NOTE_PREFIX = 'Currency conversion: '
/** The notes line a converted spend line keeps (one line; parsed back by `scope3SpendConversionOf`). */
export const scope3SpendConversionNote = (c: Scope3SpendConversion) =>
  `${NOTE_PREFIX}${c.currency} ${c.amount} × ${c.rate} USD per ${c.currency} = USD ${c.usd} (rate source: ${c.rateSource}; rate date: ${c.rateDate}; rounded half-even to the cent).`
/** The correction reason of a converted line before BF-20 (kept for the per-line reference the BF-20 differential tests run). */
export const scope3SpendConversionReason = (c: Scope3SpendConversion) =>
  `Converted from ${c.currency} ${c.amount} to USD ${c.usd} at ${c.rate} USD per ${c.currency} (${c.rateSource}, rate date ${c.rateDate}; rounded half-even to the cent).`
/** BF-20: the one correction reason of a whole conversion (each line's own amounts are in its notes line). */
export const scope3SpendConversionGroupReason = (c: Scope3SpendConversionInput) =>
  `Converted from ${c.currency} to USD at ${c.rate} USD per ${c.currency} (${c.rateSource}, rate date ${c.rateDate}; rounded half-even to the cent).`
const NOTE = /^Currency conversion: ([A-Z]{3}) (\S+) × (\S+) USD per \1 = USD (\S+) \(rate source: (.{1,200}); rate date: (\d{4}-\d{2}-\d{2}); rounded half-even to the cent\)\.$/
/** The conversion a line's notes record, or null. */
export function scope3SpendConversionOf(notes: string): Scope3SpendConversion | null {
  for (const line of notes.split('\n')) { const m = NOTE.exec(line); if (m) return { currency: m[1]!, amount: m[2]!, rate: m[3]!, usd: m[4]!, rateSource: m[5]!, rateDate: m[6]! } }
  return null
}
/** Notes with the conversion line added (replacing an earlier conversion line, so a line converted twice says the last one). */
export const scope3SpendNotesWithConversion = (notes: string, c: Scope3SpendConversion) => [...notes.split('\n').filter(line => line && !line.startsWith(NOTE_PREFIX)), scope3SpendConversionNote(c)].join('\n')
/** Notes without the conversion line (the import's own notes, e.g. its GL description). */
export const scope3SpendNotesWithoutConversion = (notes: string) => notes.split('\n').filter(line => !line.startsWith(NOTE_PREFIX)).join('\n')

// --- BF-14 --- (accounting audit B-5; 13 November 2026)
/**
 * The calendar year a spend line belongs to for choosing an exchange rate (its "line year"): the year of its line date; a
 * line without a date takes the year of its period when the whole period lies inside one calendar year; otherwise null
 * (a period crossing years with no date: the year is not known, so no rate can be shown to be of the line's year). A
 * fiscal period that crosses years therefore never gives a year by itself; the line's own date does. Which rate to use
 * (transaction date, annual average or per import) is not decided here (accountant question C-6): this only says which
 * calendar year a rate's date must be in.
 */
export function scope3SpendLineYear(line: { lineDate: string | null; period: { start: string; endExclusive: string } }): number | null {
  const year = (date: string) => ISO.test(date) ? Number(date.slice(0, 4)) : null
  if (line.lineDate !== null) return year(line.lineDate)
  const start = year(line.period.start)
  if (start === null || !realIso(line.period.endExclusive) || !realIso(line.period.start)) return null
  const last = new Date(Date.parse(`${line.period.endExclusive}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10)
  return Number(last.slice(0, 4)) === start && last >= line.period.start ? start : null
}
/** The calendar year of a rate date (`yyyy-mm-dd`), or null. */
export const scope3SpendRateYear = (rateDate: string): number | null => realIso(rateDate) ? Number(rateDate.slice(0, 4)) : null
/** Whether a conversion's rate date is in the line's year (false when the line's year is not known). */
export const scope3SpendRateMatchesLineYear = (line: Parameters<typeof scope3SpendLineYear>[0], rateDate: string): boolean => {
  const lineYear = scope3SpendLineYear(line)
  return lineYear !== null && lineYear === scope3SpendRateYear(rateDate)
}
// --- end BF-14 ---
