/**
 * BF-32: the one text-length rule of the SAVE path (CEO decision, 13 November 2026). Browser-safe; imports nothing.
 *
 * The rule: a user's text is normalised to NFC first, then counted in UTF-16 code units (JavaScript `length`; a character
 * outside the Basic Multilingual Plane such as an emoji counts 2), then stored as normalised. A limit is therefore never
 * more generous than PostgreSQL's `length()` (code points, which never exceed code units, and which NFC-normalised text
 * satisfies by construction), and never more generous than the read path's own count of the stored value, so a value
 * that passes can always be stored and read back. Before this rule the contract counted BEFORE normalising, so a string
 * such as U+0958 repeated (NFC doubles it) passed the API and was refused by the database.
 *
 * This module is used on the save path only. Stored records are re-validated on read by the unchanged contract, which
 * never imports this file: a record saved under the old rule stays readable, byte for byte, with the same payload hash.
 *
 * `SAVE_TEXT_LIMITS` lists every free-text field of the collection contract (Scope 1, 2 and 3). A test finds the fields and
 * their limits by trying the contract itself and fails when this list and the contract disagree, so a new text field (for
 * example BF-11's certificate fields) cannot be added to the contract without a line here.
 */

/** [path, label, limit in characters]; `[]` is every element of an array. The path is the same for every record kind. */
export const SAVE_TEXT_LIMITS: ReadonlyArray<readonly [path: string, label: string, max: number]> = [
  ['sourceId', 'Source identifier', 120],
  ['quantity.originalValue', 'Quantity as written', 100],
  ['quantity.originalUnit', 'Unit as written', 80],
  ['reference', 'Reference', 1000],
  ['notes', 'Notes', 4000],
  ['estimateBasis', 'Estimate basis', 2000],
  ['withdrawalReason', 'Withdrawal reason', 2000],
  ['payload.heatContent.value', 'Heat content value', 100],
  ['payload.consumption.gallons', 'Gallons', 100],
  ['payload.consumption.purchasedGallons', 'Purchased gallons', 100],
  ['payload.consumption.openingGallons', 'Opening gallons', 100],
  ['payload.consumption.closingGallons', 'Closing gallons', 100],
  ['payload.vehicleGroupId', 'Vehicle group ID', 120],
  ['payload.fuel', 'Fuel', 80],
  ['payload.vehicleType', 'Vehicle type', 120],
  ['payload.gallons', 'Gallons', 100],
  ['payload.miles.value', 'Miles value', 100],
  ['payload.miles.basis', 'Miles basis', 500],
  ['payload.fuelEconomy.mpg', 'Fuel economy', 100],
  ['payload.fuelEconomy.source', 'Fuel economy source', 500],
  ['payload.terms.PN', 'Refrigerant term PN', 100],
  ['payload.terms.CN', 'Refrigerant term CN', 100],
  ['payload.terms.PS', 'Refrigerant term PS', 100],
  ['payload.terms.CD', 'Refrigerant term CD', 100],
  ['payload.terms.RD', 'Refrigerant term RD', 100],
  ['payload.meterOrAccountNumber', 'Meter or account number', 120],
  ['payload.utilityName', 'Utility name', 200],
  ['payload.site', 'Site', 200],
  ['payload.subregion', 'Subregion', 20],
  ['payload.utilityEiaId', 'Utility EIA ID', 40],
  ['payload.instruments[].mwh', 'Instrument MWh', 100],
  ['payload.instruments[].rateLbPerMwh.co2', 'Instrument CO2 rate', 100],
  ['payload.instruments[].rateLbPerMwh.ch4', 'Instrument CH4 rate', 100],
  ['payload.instruments[].rateLbPerMwh.n2o', 'Instrument N2O rate', 100],
  ['payload.instruments[].instrumentId', 'Instrument ID', 120],
  ['payload.instruments[].registry', 'Instrument registry', 80],
  ['payload.vehicle', 'Vehicle', 80],
  ['payload.dataQuality.basis', 'Data quality basis', 500],
  ['payload.material', 'Material', 80],
  ['payload.treatment', 'Treatment', 80],
  ['payload.mode', 'Mode', 80],
  ['payload.haulBasis', 'Haul basis', 200],
  ['payload.supplierName', 'Supplier name', 200],
  ['payload.glAccount', 'GL account', 120],
  ['payload.description', 'Description', 200],
  ['payload.spendEstimateBasis', 'Spend estimate basis', 300],
  ['payload.product', 'Product', 200],
  ['payload.factorUnit', 'Factor unit', 80],
  ['payload.supersedesSpend.supplierName', 'Superseded supplier name', 200],
  ['payload.modes[].mode', 'Commuting mode', 80],
  ['payload.sharesBasis', 'Shares basis', 300],
  ['payload.distanceBasis', 'Distance basis', 300],
  ['payload.baselineBasis', 'Baseline basis', 300],
  ['payload.assetLabel', 'Asset label', 200],
  ['payload.counterpartyName', 'Counterparty name', 200],
  ['payload.noOperationalControlBasis', 'Operational control basis', 500],
  ['payload.refrigerantGas', 'Refrigerant gas', 80],
  ['payload.cbecsActivity', 'Building activity', 80],
  ['payload.productLabel', 'Product', 200],
  ['payload.energyCarrier', 'Energy carrier', 80],
  ['payload.energyUnit', 'Energy unit', 80],
  ['payload.useRegion', 'Use region', 80],
  ['payload.lifetimeSource', 'Lifetime source', 300],
  ['payload.gas', 'Gas', 80],
  ['payload.releaseBasis', 'Release basis', 300],
  ['payload.splitBasis', 'Split basis', 300],
  ['payload.investeeName', 'Investee name', 200],
]

/** A save refused because text is over its limit: names the field, the limit and how far over the value is. */
export class CollectionTextLimitError extends Error {
  readonly code = 'text_too_long'
  /** `path` is the field's entry in `SAVE_TEXT_LIMITS` (or `correctionReason`), for screens that mark the field. */
  constructor(readonly field: string, readonly limit: number, readonly length: number, readonly note: string, readonly path: string = '') {
    super(`${field} is ${length.toLocaleString('en-US')} characters; the limit is ${limit.toLocaleString('en-US')} (${(length - limit).toLocaleString('en-US')} over).${note} Shorten it and save again.`)
  }
  get over(): number { return this.length - this.limit }
}

/** Every string of the value in NFC, keys untouched. */
export function normalizeTextDeep<T>(value: T): T {
  if (typeof value === 'string') return value.normalize('NFC') as T
  if (Array.isArray(value)) return value.map(normalizeTextDeep) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeTextDeep(item)])) as T
  return value
}

const ASTRAL = /[\ud800-\udbff][\udc00-\udfff]/
const noteFor = (value: string) => ASTRAL.test(value) ? ' Emoji and other rare characters count as 2 characters.' : ''

type Token = string | number
interface Occurrence { tokens: Token[]; shown: string; value: unknown }
function occurrences(root: unknown, keys: string[], label: string, tokens: Token[] = [], shown = label, out: Occurrence[] = []): Occurrence[] {
  if (keys.length === 0) { out.push({ tokens, shown, value: root }); return out }
  const [key, ...rest] = keys
  const isArray = key!.endsWith('[]'), name = isArray ? key!.slice(0, -2) : key!
  if (!root || typeof root !== 'object' || Array.isArray(root) || !Object.prototype.hasOwnProperty.call(root, name)) return out
  const child = (root as Record<string, unknown>)[name]
  if (!isArray) return occurrences(child, rest, label, [...tokens, name], shown, out)
  if (Array.isArray(child)) child.forEach((item, index) => occurrences(item, rest, label, [...tokens, name, index], `${shown} (item ${index + 1})`, out))
  return out
}
const valueAt = (root: unknown, tokens: Token[]): unknown => tokens.reduce<unknown>((at, token) => at && typeof at === 'object' ? (at as Record<Token, unknown>)[token] : undefined, root)
function setAt(root: unknown, tokens: Token[], value: unknown): void {
  const holder = valueAt(root, tokens.slice(0, -1)) as Record<Token, unknown> | undefined
  if (holder && typeof holder === 'object') holder[tokens[tokens.length - 1]!] = value
}

/** The correction reason the web sends with a withdrawal. The save's own limit for the reason the user typed is what is left of 2,000. */
export const WITHDRAWN_REASON_PREFIX = 'Withdrawn: '
const CORRECTION_REASON_MAX = 2000
const NOTE_FOR_WITHDRAWAL = ` The saved note begins with "${WITHDRAWN_REASON_PREFIX.trim()}", which leaves ${(CORRECTION_REASON_MAX - WITHDRAWN_REASON_PREFIX.length).toLocaleString('en-US')} characters for the reason.`

/**
 * The save path's text step (BF-32): returns the activity with every text in NFC, and the correction reason in NFC, after checking each
 * limit. Throws `CollectionTextLimitError` for the first text over its limit.
 *
 * A field the request does not change is not re-validated (CEO ruling F3): when `previous` is the version the request corrects and a
 * field's text is exactly what that version stored, it is kept as stored (not normalised, not counted), so an old record whose text
 * is over the new rule can still be withdrawn or corrected elsewhere; a field the request changes must meet the rule. The stored
 * value passed the rule that saved it, so it reads back and satisfies the database.
 */
export function prepareSaveText(activity: unknown, previous: unknown, correctionReason: unknown): { activity: unknown; correctionReason: unknown } {
  const normalized = normalizeTextDeep(activity)
  const reason = typeof correctionReason === 'string' ? correctionReason.normalize('NFC') : correctionReason
  const unchanged = new Set<string>()
  if (previous && typeof previous === 'object') {
    for (const [path, label] of SAVE_TEXT_LIMITS) for (const hit of occurrences(activity, path.split('.'), label)) {
      if (typeof hit.value === 'string' && valueAt(previous, hit.tokens) === hit.value) { setAt(normalized, hit.tokens, hit.value); unchanged.add(hit.tokens.join('.')) }
    }
  }
  const withdrawnReason = (normalized as Record<string, unknown> | null)?.withdrawalReason
  const composed = (normalized as Record<string, unknown> | null)?.state === 'withdrawn' && typeof withdrawnReason === 'string' && reason === WITHDRAWN_REASON_PREFIX + withdrawnReason
  for (const [path, label, max] of SAVE_TEXT_LIMITS) for (const hit of occurrences(normalized, path.split('.'), label)) {
    if (typeof hit.value !== 'string' || unchanged.has(hit.tokens.join('.'))) continue
    const effective = composed && path === 'withdrawalReason' ? CORRECTION_REASON_MAX - WITHDRAWN_REASON_PREFIX.length : max
    if (hit.value.length > effective) throw new CollectionTextLimitError(hit.shown, effective, hit.value.length, noteFor(hit.value) + (effective < max ? NOTE_FOR_WITHDRAWAL : ''), path)
  }
  if (typeof reason === 'string' && !composed && reason.length > CORRECTION_REASON_MAX) throw new CollectionTextLimitError('Correction reason', CORRECTION_REASON_MAX, reason.length, noteFor(reason), 'correctionReason')
  return { activity: normalized, correctionReason: reason }
}

/** A text typed outside the collection contract (a withdrawal reason, a mapping's vendor): NFC first, then the same count and refusal. */
export function limitedText(value: string, max: number, label: string, path = ''): string {
  const normalized = value.normalize('NFC')
  if (normalized.length > max) throw new CollectionTextLimitError(label, max, normalized.length, noteFor(normalized), path)
  return normalized
}
