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
  constructor(readonly field: string, readonly limit: number, readonly length: number, readonly note: string) {
    super(`${field} is ${length.toLocaleString('en-US')} characters; the limit is ${limit.toLocaleString('en-US')} (${(length - limit).toLocaleString('en-US')} over).${note} Shorten it and save again.`)
  }
  get over(): number { return this.length - this.limit }
}

/** Every string of the value in NFC, keys untouched. Not a copy when the value has no string that changes. */
export function normalizeTextDeep<T>(value: T): T {
  if (typeof value === 'string') return value.normalize('NFC') as T
  if (Array.isArray(value)) return value.map(normalizeTextDeep) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeTextDeep(item)])) as T
  return value
}

const ASTRAL = /[\ud800-\udbff][\udc00-\udfff]/
const noteFor = (value: string) => ASTRAL.test(value) ? ' Emoji and other rare characters count as 2 characters.' : ''
function atPath(root: unknown, keys: string[], shown: string, out: Array<{ shown: string; value: unknown }>): void {
  if (keys.length === 0) { out.push({ shown, value: root }); return }
  const [key, ...rest] = keys
  if (key!.endsWith('[]')) {
    const holder = (root as Record<string, unknown> | null)?.[key!.slice(0, -2)]
    if (Array.isArray(holder)) holder.forEach((item, index) => atPath(item, rest, `${shown} (item ${index + 1})`, out))
    return
  }
  if (root && typeof root === 'object' && !Array.isArray(root) && Object.prototype.hasOwnProperty.call(root, key!)) atPath((root as Record<string, unknown>)[key!], rest, shown, out)
}

/** Throws `CollectionTextLimitError` for the first text of an NFC-normalised activity (or correction reason) over its limit. */
export function checkTextLimits(normalized: unknown, correctionReason?: unknown): void {
  const found: Array<{ label: string; max: number; shown: string; value: unknown }> = []
  for (const [path, label, max] of SAVE_TEXT_LIMITS) {
    const hits: Array<{ shown: string; value: unknown }> = []
    atPath(normalized, path.split('.'), label, hits)
    for (const hit of hits) found.push({ label, max, shown: hit.shown, value: hit.value })
  }
  if (typeof correctionReason === 'string') found.push({ label: 'Correction reason', max: 2000, shown: 'Correction reason', value: correctionReason })
  for (const { max, shown, value } of found) if (typeof value === 'string' && value.length > max) throw new CollectionTextLimitError(shown, max, value.length, noteFor(value))
}
