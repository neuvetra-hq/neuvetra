/**
 * Shared Scope 3 payload fixtures (Scope 3 completion I-02; Claude, 30 October 2026). Test data only, never imported by
 * runtime code. Each entry is one record's kind, quantity and payload, and whether the collection contract accepts it.
 * The same table drives three checks: the TypeScript contract (validateCollectionActivity), 0030's database check
 * (collection_assert_activity, which must agree on every entry) and, for the valid entries, a real save and read-back.
 * Later increments (forms in I-08, adapter branches in I-03/I-05/I-07) reuse it. Every kind has at least five valid and
 * five invalid entries; each invalid entry breaks one rule.
 *
 * I-02b (DESIGN §11): the amended shapes, and for every new rule (AM-04 ... AM-15) at least three valid and three invalid
 * entries tagged with the rule. `scope3AssessmentFixtures` does the same for the assessment contract (AM-03, AM-17).
 */
import type { Scope3CollectionKind } from './scope3-collection-contract'

export interface Scope3PayloadFixture {
  label: string
  kind: Scope3CollectionKind
  quantity: { originalValue: string; originalUnit: string; normalizedValue: string | null; normalizedUnit: string | null }
  payload: unknown
  /** Whether the contract (and 0030) accepts it. */
  valid: boolean
  /** I-02b: the amendment rule the entry exercises (DESIGN §11), when it exercises one. */
  rule?: string
}

/** A quantity normalized to an engine unit, or kept as written when `normalized` is false. */
export const fixtureQuantity = (value: string, unit: string, normalized = true) => ({ originalValue: value, originalUnit: unit, normalizedValue: normalized ? value : null, normalizedUnit: normalized ? unit : null })
const q = fixtureQuantity
export const FIXTURE_DATA_QUALITY = { indicators: { technological: 'good', temporal: 'very_good', geographical: null, completeness: 'fair', reliability: 'poor' }, activityDataOrigin: 'value_chain_partner', basis: 'Supplier statement reviewed against invoices.' }
const DQ = FIXTURE_DATA_QUALITY
const UUID1 = '30a00000-0000-4000-8000-000000000001'
const long = (n: number) => 'x'.repeat(n)
/** Replace keys, or drop them (`undefined`). */
const change = (base: Record<string, unknown>, edits: Record<string, unknown>) => {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(edits)) if (value === undefined) delete out[key]; else out[key] = value
  return out
}
const fixtures: Scope3PayloadFixture[] = []
const add = (kind: Scope3CollectionKind, valid: boolean, label: string, quantity: Scope3PayloadFixture['quantity'], payload: unknown, rule?: string) => fixtures.push({ label: `${kind}: ${label}`, kind, quantity, payload, valid, ...(rule ? { rule } : {}) })
/** A distinct SHA-256-shaped mapping key. */
export const fixtureMappingKey = (n: number) => n.toString(16).padStart(64, 'a')
const KEY = fixtureMappingKey
const UUID2 = '30a00000-0000-4000-8000-000000000002'

// ---- The four 0029 kinds: their 0029 payloads, plus what 0030 adds (dataQuality; business travel v2 and room-night).
const transport = { category: 4, vehicle: 'rail', loadBasis: 'shared_vehicle', thirdPartyFacilities: 'none' }
add('transport', true, '0029 payload', q('1200.5', 'short ton-mile'), transport)
add('transport', true, 'with data quality', q('1200.5', 'short ton-mile'), { ...transport, dataQuality: DQ })
add('transport', true, 'data quality null (method defaults)', q('300', 'vehicle-mile'), { ...transport, category: 9, vehicle: 'light_duty_truck', loadBasis: 'dedicated_vehicle', dataQuality: null })
add('transport', true, 'data quality with every indicator null', q('300', 'vehicle-km'), { ...transport, loadBasis: null, dataQuality: { indicators: { technological: null, temporal: null, geographical: null, completeness: null, reliability: null }, activityDataOrigin: null, basis: null } })
add('transport', true, 'data quality basis of 500 characters', q('1', 'tonne-km'), { ...transport, dataQuality: { ...DQ, basis: long(500) } })
add('transport', false, 'data quality rating not listed', q('1', 'tonne-km'), { ...transport, dataQuality: { ...DQ, indicators: { ...DQ.indicators, temporal: 'excellent' } } })
add('transport', false, 'data quality without its basis key', q('1', 'tonne-km'), { ...transport, dataQuality: change(DQ, { basis: undefined }) })
add('transport', false, 'data quality indicator missing', q('1', 'tonne-km'), { ...transport, dataQuality: { ...DQ, indicators: change(DQ.indicators, { reliability: undefined }) } })
add('transport', false, 'data quality basis of 501 characters', q('1', 'tonne-km'), { ...transport, dataQuality: { ...DQ, basis: long(501) } })
add('transport', false, 'data quality as text', q('1', 'tonne-km'), { ...transport, dataQuality: 'good' })
add('transport', false, 'data quality origin not listed', q('1', 'tonne-km'), { ...transport, dataQuality: { ...DQ, activityDataOrigin: 'supplier' } })
const waste = { category: 5, material: 'office_paper', treatment: 'recycled' }
add('waste', true, '0029 payload', q('850', 'kg'), waste)
add('waste', true, 'with data quality', q('2.5', 'metric_ton'), { ...waste, category: 12, dataQuality: DQ })
add('waste', true, 'unknown material kept (held later)', q('3', 'cubic_yard', false), { ...waste, material: 'unobtainium', dataQuality: null })
add('waste', true, 'blank treatment kept', q('1', 'lb'), { ...waste, treatment: '' })
add('waste', true, 'short tons with data quality', q('1', 'short_ton'), { ...waste, dataQuality: { ...DQ, activityDataOrigin: 'company_records' } })
add('waste', false, 'category 4', q('1', 'kg'), { ...waste, category: 4 })
add('waste', false, 'data quality with an extra key', q('1', 'kg'), { ...waste, dataQuality: { ...DQ, score: 2 } })
add('waste', false, 'normalized to room-night', q('1', 'room-night'), waste)
add('waste', false, 'extra key besides data quality', q('1', 'kg'), { ...waste, dataQuality: DQ, extra: true })
add('waste', false, 'material as a number', q('1', 'kg'), { ...waste, material: 7 })
const travel = { mode: 'air', passengerSegments: 4, haulBasis: null }
add('business_travel', true, '0029 payload', q('2400', 'mile'), travel)
add('business_travel', true, '0029 hotel record as saved by the r3 feeds (room-night not normalized)', q('10', 'room-night', false), { mode: 'hotel', passengerSegments: null, haulBasis: null })
add('business_travel', true, 'v2 with cabin class', q('2400', 'mile'), { ...travel, cabinClass: 'business', hotelCountry: null })
add('business_travel', true, 'v2 hotel stay in room-nights (normalized from 0030)', q('10', 'room-night'), { mode: 'hotel_stay', passengerSegments: null, haulBasis: null, cabinClass: null, hotelCountry: 'US' })
add('business_travel', true, 'v2 with data quality', q('9000', 'passenger-mile'), { mode: 'air_long_haul', passengerSegments: null, haulBasis: 'Agency itinerary', cabinClass: 'unknown', hotelCountry: null, dataQuality: DQ })
add('business_travel', true, '0029 payload with data quality', q('640', 'vehicle-km'), { mode: 'passenger_car', passengerSegments: null, haulBasis: null, dataQuality: null })
add('business_travel', false, 'cabin class without hotel country', q('2400', 'mile'), { ...travel, cabinClass: 'economy' })
add('business_travel', false, 'hotel country without cabin class', q('2400', 'mile'), { ...travel, hotelCountry: 'US' })
add('business_travel', false, 'hotel country in lower case', q('10', 'room-night'), { mode: 'hotel_stay', passengerSegments: null, haulBasis: null, cabinClass: null, hotelCountry: 'us' })
add('business_travel', false, 'hotel country of three letters', q('10', 'room-night'), { mode: 'hotel_stay', passengerSegments: null, haulBasis: null, cabinClass: null, hotelCountry: 'USA' })
add('business_travel', false, 'cabin class not listed', q('2400', 'mile'), { ...travel, cabinClass: 'coach', hotelCountry: null })
add('business_travel', false, 'normalized to night', q('10', 'night'), { mode: 'hotel_stay', passengerSegments: null, haulBasis: null })
add('business_travel', false, 'zero passenger segments (0029 rule)', q('2400', 'mile'), { ...travel, passengerSegments: 0, cabinClass: null, hotelCountry: null })
add('employee_commuting', true, '0029 payload', q('9800', 'passenger-mile'), { mode: 'bus' })
add('employee_commuting', true, 'with data quality', q('9800', 'passenger-mile'), { mode: 'bus', dataQuality: DQ })
add('employee_commuting', true, 'unknown mode kept', q('100', 'vehicle-mile'), { mode: 'e-scooter', dataQuality: null })
add('employee_commuting', true, 'mode of 80 characters', q('100', 'vehicle-km'), { mode: long(80) })
add('employee_commuting', true, 'blank mode kept', q('100', 'passenger-km'), { mode: '' })
add('employee_commuting', false, 'mode of 81 characters', q('100', 'vehicle-km'), { mode: long(81) })
add('employee_commuting', false, 'data quality as an array', q('100', 'vehicle-km'), { mode: 'bus', dataQuality: [] })
add('employee_commuting', false, 'extra key', q('100', 'vehicle-km'), { mode: 'bus', days: 220 })
add('employee_commuting', false, 'normalized to employee', q('100', 'employee'), { mode: 'bus' })
add('employee_commuting', false, 'cabin class on commuting', q('100', 'vehicle-km'), { mode: 'bus', cabinClass: null, hotelCountry: null })

// ---- purchase_spend (categories 1-6 and 9).
const spend = { category: 1, naicsCode: '541511', dollarYear: 2024, marginChoice: 'with_margins', boughtAtFactoryGate: false, capitalFullCost: null, taxTreatment: 'excludes_sales_tax', supplierName: 'Synthetic Software LLC', glAccount: '6100', description: 'Software consulting', categoryConfirmed: false, activityOverlap: 'unknown', importId: null, importRow: null, mappingSource: 'user',
  paidByReportingCompany: null, spendEstimateBasis: null, lineDate: null, possibleDuplicateOf: null, duplicateConfirmedDistinct: false }
/** Category 9: transport of sold products the reporting company did not pay for, estimated by hand (AM-04). */
const downstream = { ...spend, category: 9, naicsCode: '484121', description: 'Customer-paid outbound freight', paidByReportingCompany: false, spendEstimateBasis: 'Customer-paid freight estimated from 2025 carrier rate cards.' }
add('purchase_spend', true, 'manual line', q('125000.5', 'USD'), spend)
add('purchase_spend', true, 'with data quality', q('125000.5', 'USD'), { ...spend, dataQuality: DQ })
add('purchase_spend', true, 'imported capital good, without margins', q('48000', 'USD'), { ...spend, category: 2, naicsCode: '333120', marginChoice: 'without_margins', boughtAtFactoryGate: true, capitalFullCost: true, importId: UUID1, importRow: 1, mappingSource: 'file', lineDate: '2025-03-31' })
add('purchase_spend', true, 'unmatched line: no NAICS, no dollar year, blank supplier and GL account', q('99.99', 'USD'), { ...spend, naicsCode: null, dollarYear: null, supplierName: '', glAccount: '', importId: UUID1, importRow: 2000, mappingSource: 'unmatched' })
add('purchase_spend', true, 'euro amount kept, not normalized (held later)', q('5000', 'EUR', false), { ...spend, category: 6, naicsCode: '721110', mappingSource: 'memory', importId: UUID1, importRow: 3 })
add('purchase_spend', true, 'negative amount kept as written (held later)', q('-250.00', 'USD', false), { ...spend, dataQuality: null })
add('purchase_spend', true, 'longest texts; category 9 with overlap confirmed', q('1', 'USD'), { ...downstream, description: long(200), supplierName: long(200), glAccount: long(120), activityOverlap: 'none_confirmed', categoryConfirmed: true, taxTreatment: 'unknown' })
add('purchase_spend', false, 'five-digit NAICS code', q('1', 'USD'), { ...spend, naicsCode: '54151' })
add('purchase_spend', false, 'margin choice spelled differently', q('1', 'USD'), { ...spend, marginChoice: 'with margins' })
add('purchase_spend', false, 'blank description', q('1', 'USD'), { ...spend, description: '   ' })
add('purchase_spend', false, 'import ID without its row', q('1', 'USD'), { ...spend, importId: UUID1 })
add('purchase_spend', false, 'normalized to EUR', q('1', 'EUR'), spend)
add('purchase_spend', false, 'GL account of 121 characters', q('1', 'USD'), { ...spend, glAccount: long(121) })
add('purchase_spend', false, 'capital full cost as text', q('1', 'USD'), { ...spend, capitalFullCost: 'yes' })
add('purchase_spend', false, 'import row 0', q('1', 'USD'), { ...spend, importId: UUID1, importRow: 0 })
add('purchase_spend', false, 'control character in supplier name', q('1', 'USD'), { ...spend, supplierName: 'Acme\u0007' })
add('purchase_spend', false, 'missing key', q('1', 'USD'), change(spend, { mappingSource: undefined }))
add('purchase_spend', false, 'upper-case import ID', q('1', 'USD'), { ...spend, importId: UUID1.toUpperCase(), importRow: 1 })
// AM-04: categories 1-6 and 9 (3 is the fuel-proxy contingency, 5 waste and wastewater); the code set is an adapter hold, not a shape rule.
const R_CATEGORIES = 'AM-04 spend categories 1-6 and 9'
add('purchase_spend', true, 'category 3 (fuel proxy, held later)', q('8000', 'USD'), { ...spend, category: 3, naicsCode: '324110' }, R_CATEGORIES)
add('purchase_spend', true, 'category 5 waste hauling, imported', q('8000', 'USD'), { ...spend, category: 5, naicsCode: '562212', importId: UUID1, importRow: 4, mappingSource: 'file' }, R_CATEGORIES)
add('purchase_spend', true, 'category 5 wastewater', q('2400', 'USD'), { ...spend, category: 5, naicsCode: '221320' }, R_CATEGORIES)
add('purchase_spend', true, 'category 4 with a code outside the freight set (held later)', q('2400', 'USD'), { ...spend, category: 4, naicsCode: '541511' }, R_CATEGORIES)
add('purchase_spend', false, 'category 7', q('1', 'USD'), { ...spend, category: 7 }, R_CATEGORIES)
add('purchase_spend', false, 'category 8', q('1', 'USD'), { ...spend, category: 8 }, R_CATEGORIES)
add('purchase_spend', false, 'category 15', q('1', 'USD'), { ...spend, category: 15 }, R_CATEGORIES)
add('purchase_spend', false, 'category as text', q('1', 'USD'), { ...spend, category: '1' }, R_CATEGORIES)
// AM-04: dollar years 2012-2035 (an unregistered index year is an engine finding, never a refusal).
const R_DOLLAR_YEAR = 'AM-04 dollar year 2012-2035'
add('purchase_spend', true, 'dollar year 2012', q('1', 'USD'), { ...spend, dollarYear: 2012 }, R_DOLLAR_YEAR)
add('purchase_spend', true, 'dollar year 2035', q('1', 'USD'), { ...spend, dollarYear: 2035 }, R_DOLLAR_YEAR)
add('purchase_spend', true, 'dollar year 2026 (fiscal 2026 spend)', q('1', 'USD'), { ...spend, dollarYear: 2026 }, R_DOLLAR_YEAR)
add('purchase_spend', false, 'dollar year 2011', q('1', 'USD'), { ...spend, dollarYear: 2011 }, R_DOLLAR_YEAR)
add('purchase_spend', false, 'dollar year 2036', q('1', 'USD'), { ...spend, dollarYear: 2036 }, R_DOLLAR_YEAR)
add('purchase_spend', false, 'dollar year as text', q('1', 'USD'), { ...spend, dollarYear: '2024' }, R_DOLLAR_YEAR)
add('purchase_spend', false, 'dollar year with a fraction', q('1', 'USD'), { ...spend, dollarYear: 2024.5 }, R_DOLLAR_YEAR)
// AM-04: category 9 has the attestation and the estimate basis, and only category 9.
const R_DOWNSTREAM = 'AM-04 category 9 attestation and estimate basis'
add('purchase_spend', true, 'category 9 not paid by the company', q('3200', 'USD'), downstream, R_DOWNSTREAM)
add('purchase_spend', true, 'category 9 marked paid by the company (shape only; held later)', q('3200', 'USD'), { ...downstream, paidByReportingCompany: true }, R_DOWNSTREAM)
add('purchase_spend', true, 'category 9 with a basis of 3 characters', q('3200', 'USD'), { ...downstream, spendEstimateBasis: 'est' }, R_DOWNSTREAM)
add('purchase_spend', true, 'category 9 with a basis of 300 characters', q('3200', 'USD'), { ...downstream, spendEstimateBasis: long(300) }, R_DOWNSTREAM)
add('purchase_spend', false, 'category 9 without the attestation', q('1', 'USD'), { ...downstream, paidByReportingCompany: null }, R_DOWNSTREAM)
add('purchase_spend', false, 'category 9 without an estimate basis', q('1', 'USD'), { ...downstream, spendEstimateBasis: null }, R_DOWNSTREAM)
add('purchase_spend', false, 'category 1 with the attestation', q('1', 'USD'), { ...spend, paidByReportingCompany: false }, R_DOWNSTREAM)
add('purchase_spend', false, 'category 4 with an estimate basis', q('1', 'USD'), { ...spend, category: 4, naicsCode: '484121', spendEstimateBasis: 'Rate card' }, R_DOWNSTREAM)
add('purchase_spend', false, 'category 9 with a basis of 2 characters', q('1', 'USD'), { ...downstream, spendEstimateBasis: 'ab' }, R_DOWNSTREAM)
add('purchase_spend', false, 'category 9 with a basis of 301 characters', q('1', 'USD'), { ...downstream, spendEstimateBasis: long(301) }, R_DOWNSTREAM)
add('purchase_spend', false, 'category 9 attestation as text', q('1', 'USD'), { ...downstream, paidByReportingCompany: 'no' }, R_DOWNSTREAM)
// AM-04: category 9 is entered by hand, never imported.
const R_DOWNSTREAM_MANUAL = 'AM-04 category 9 never imported'
add('purchase_spend', true, 'category 9 entered by hand', q('3200', 'USD'), { ...downstream, mappingSource: 'user' }, R_DOWNSTREAM_MANUAL)
add('purchase_spend', true, 'category 4 freight, imported', q('3200', 'USD'), { ...spend, category: 4, naicsCode: '484121', importId: UUID1, importRow: 5, mappingSource: 'file' }, R_DOWNSTREAM_MANUAL)
add('purchase_spend', true, 'category 6 hotel, imported from memory', q('3200', 'USD'), { ...spend, category: 6, naicsCode: '721110', importId: UUID1, importRow: 6, mappingSource: 'memory' }, R_DOWNSTREAM_MANUAL)
add('purchase_spend', false, 'category 9 imported (row 1)', q('1', 'USD'), { ...downstream, importId: UUID1, importRow: 1, mappingSource: 'file' }, R_DOWNSTREAM_MANUAL)
add('purchase_spend', false, 'category 9 imported (row 2000, from memory)', q('1', 'USD'), { ...downstream, importId: UUID1, importRow: 2000, mappingSource: 'memory' }, R_DOWNSTREAM_MANUAL)
add('purchase_spend', false, 'category 9 imported and unmatched', q('1', 'USD'), { ...downstream, naicsCode: null, importId: UUID2, importRow: 7, mappingSource: 'unmatched' }, R_DOWNSTREAM_MANUAL)
// AM-04: the line date (a real date or null).
const R_LINE_DATE = 'AM-04 line date'
add('purchase_spend', true, 'line date 31 March 2025', q('1', 'USD'), { ...spend, lineDate: '2025-03-31' }, R_LINE_DATE)
add('purchase_spend', true, 'leap-day line date', q('1', 'USD'), { ...spend, lineDate: '2024-02-29' }, R_LINE_DATE)
add('purchase_spend', true, 'line date outside the period (shape only; held later)', q('1', 'USD'), { ...spend, lineDate: '2099-12-31' }, R_LINE_DATE)
add('purchase_spend', false, 'line date 30 February', q('1', 'USD'), { ...spend, lineDate: '2025-02-30' }, R_LINE_DATE)
add('purchase_spend', false, 'line date as written in the file', q('1', 'USD'), { ...spend, lineDate: '03/31/2025' }, R_LINE_DATE)
add('purchase_spend', false, 'line date in 1899', q('1', 'USD'), { ...spend, lineDate: '1899-12-31' }, R_LINE_DATE)
add('purchase_spend', false, 'line date as a number', q('1', 'USD'), { ...spend, lineDate: 20250331 }, R_LINE_DATE)
// AM-04: the possible duplicate (an import and row) and its confirmation.
const R_DUPLICATE = 'AM-04 possible duplicate'
add('purchase_spend', true, 'possible duplicate of an earlier import', q('1', 'USD'), { ...spend, importId: UUID2, importRow: 3, mappingSource: 'file', possibleDuplicateOf: { importId: UUID1, row: 1 } }, R_DUPLICATE)
add('purchase_spend', true, 'possible duplicate of row 9999999', q('1', 'USD'), { ...spend, possibleDuplicateOf: { importId: UUID1, row: 9_999_999 } }, R_DUPLICATE)
add('purchase_spend', true, 'possible duplicate confirmed distinct', q('1', 'USD'), { ...spend, possibleDuplicateOf: { importId: UUID1, row: 2 }, duplicateConfirmedDistinct: true }, R_DUPLICATE)
add('purchase_spend', false, 'possible duplicate row 0', q('1', 'USD'), { ...spend, possibleDuplicateOf: { importId: UUID1, row: 0 } }, R_DUPLICATE)
add('purchase_spend', false, 'possible duplicate without its row', q('1', 'USD'), { ...spend, possibleDuplicateOf: { importId: UUID1 } }, R_DUPLICATE)
add('purchase_spend', false, 'possible duplicate with an extra key', q('1', 'USD'), { ...spend, possibleDuplicateOf: { importId: UUID1, row: 1, fingerprint: KEY(1) } }, R_DUPLICATE)
add('purchase_spend', false, 'possible duplicate with an upper-case import ID', q('1', 'USD'), { ...spend, possibleDuplicateOf: { importId: UUID1.toUpperCase(), row: 1 } }, R_DUPLICATE)
add('purchase_spend', false, 'possible duplicate row as text', q('1', 'USD'), { ...spend, possibleDuplicateOf: { importId: UUID1, row: '1' } }, R_DUPLICATE)
const R_CONFIRMED = 'AM-04 duplicate confirmed distinct'
add('purchase_spend', true, 'confirmed distinct without a duplicate', q('1', 'USD'), { ...spend, duplicateConfirmedDistinct: true }, R_CONFIRMED)
add('purchase_spend', true, 'not confirmed, with a duplicate', q('1', 'USD'), { ...spend, possibleDuplicateOf: { importId: UUID2, row: 12 }, duplicateConfirmedDistinct: false }, R_CONFIRMED)
add('purchase_spend', true, 'not confirmed, imported', q('1', 'USD'), { ...spend, importId: UUID2, importRow: 12, mappingSource: 'file', duplicateConfirmedDistinct: false }, R_CONFIRMED)
add('purchase_spend', false, 'confirmation null', q('1', 'USD'), { ...spend, duplicateConfirmedDistinct: null }, R_CONFIRMED)
add('purchase_spend', false, 'confirmation as text', q('1', 'USD'), { ...spend, duplicateConfirmedDistinct: 'yes' }, R_CONFIRMED)
add('purchase_spend', false, 'confirmation missing', q('1', 'USD'), change(spend, { duplicateConfirmedDistinct: undefined }), R_CONFIRMED)

// ---- purchase_supplier (categories 1, 2).
const supplier = { category: 1, supplierName: 'Synthetic Steel Co', product: 'Hot-rolled coil', basis: 'product_factor', factorValue: '1.850125', factorUnit: 'kg CO2e per metric_ton', allocationBasis: 'supplier_allocated', allocationNumerator: null, allocationDenominator: null, boundary: 'cradle_to_gate', gwpBasis: 'AR5', verification: 'third_party_verified', dataYear: 2024,
  factorOrigin: 'supplier_primary', hybridUpstreamCoveredBy: null, supersedesSpend: null }
const allocated = { ...supplier, basis: 'allocated_total', factorValue: null, factorUnit: null, allocationBasis: 'revenue', allocationNumerator: '2500000', allocationDenominator: '100000000' }
add('purchase_supplier', true, 'product factor', q('120', 'metric_ton'), supplier)
add('purchase_supplier', true, 'allocated total by revenue, with data quality', q('145000', 'kg CO2e'), { ...allocated, dataQuality: DQ })
add('purchase_supplier', true, 'total the supplier allocated, capital good', q('12.5', 'metric_ton CO2e'), { ...allocated, category: 2, allocationBasis: 'supplier_allocated', allocationNumerator: null, allocationDenominator: null, gwpBasis: 'unknown', verification: 'unverified', boundary: 'other' })
add('purchase_supplier', true, 'zero factor per unit, data year 2015', q('500', 'unit'), { ...supplier, factorValue: '0', factorUnit: 'kg CO2e per unit', dataYear: 2015 })
add('purchase_supplier', true, 'unit not an engine token kept (held later)', q('40', 'pallet', false), { ...supplier, factorUnit: 'kg CO2e per pallet', dataYear: 2026, allocationBasis: 'physical', allocationNumerator: '1', allocationDenominator: '4' })
add('purchase_supplier', false, 'allocated total with a factor value', q('1', 'kg CO2e'), { ...allocated, factorValue: '1.5' })
add('purchase_supplier', false, 'product factor without a value', q('1', 'kg'), { ...supplier, factorValue: null })
add('purchase_supplier', false, 'factor value with seven decimals', q('1', 'kg'), { ...supplier, factorValue: '1.1234567' })
add('purchase_supplier', false, 'supplier-allocated with a numerator', q('1', 'kg'), { ...supplier, allocationNumerator: '1' })
add('purchase_supplier', false, 'revenue allocation without a denominator', q('1', 'kg CO2e'), { ...allocated, allocationDenominator: null })
add('purchase_supplier', false, 'data year 2011', q('1', 'kg'), { ...supplier, dataYear: 2011 })
add('purchase_supplier', false, 'category 4', q('1', 'kg'), { ...supplier, category: 4 })
add('purchase_supplier', false, 'blank supplier name', q('1', 'kg'), { ...supplier, supplierName: '' })
add('purchase_supplier', false, 'normalized to tonne', q('1', 'tonne'), supplier)
add('purchase_supplier', false, 'GWP basis AR3', q('1', 'kg'), { ...supplier, gwpBasis: 'AR3' })
// AM-07: the factor origin (only supplier_primary is supplier data; A21).
const R_ORIGIN = 'AM-07 factor origin'
add('purchase_supplier', true, 'secondary database factor (CG 1.4 average data)', q('120', 'metric_ton'), { ...supplier, factorOrigin: 'secondary_database', verification: 'unverified' }, R_ORIGIN)
add('purchase_supplier', true, 'secondary database allocated total', q('1', 'kg CO2e'), { ...allocated, factorOrigin: 'secondary_database' }, R_ORIGIN)
add('purchase_supplier', true, 'supplier primary factor', q('1', 'kg'), { ...supplier, factorOrigin: 'supplier_primary' }, R_ORIGIN)
add('purchase_supplier', false, 'factor origin supplier', q('1', 'kg'), { ...supplier, factorOrigin: 'supplier' }, R_ORIGIN)
add('purchase_supplier', false, 'factor origin null', q('1', 'kg'), { ...supplier, factorOrigin: null }, R_ORIGIN)
add('purchase_supplier', false, 'factor origin missing', q('1', 'kg'), change(supplier, { factorOrigin: undefined }), R_ORIGIN)
// AM-07: the hybrid boundary (CG [1.2]) says how upstream is covered; no other boundary does.
const R_HYBRID = 'AM-07 hybrid boundary'
add('purchase_supplier', true, 'hybrid, upstream in other records', q('1', 'kg CO2e'), { ...allocated, boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: 'other_records' }, R_HYBRID)
add('purchase_supplier', true, 'hybrid, upstream not covered', q('1', 'kg'), { ...supplier, boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: 'none' }, R_HYBRID)
add('purchase_supplier', true, 'other boundary, no coverage answer', q('1', 'kg'), { ...supplier, boundary: 'other', hybridUpstreamCoveredBy: null }, R_HYBRID)
add('purchase_supplier', false, 'hybrid without the coverage answer', q('1', 'kg'), { ...supplier, boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: null }, R_HYBRID)
add('purchase_supplier', false, 'cradle to gate with a coverage answer', q('1', 'kg'), { ...supplier, hybridUpstreamCoveredBy: 'none' }, R_HYBRID)
add('purchase_supplier', false, 'other boundary with a coverage answer', q('1', 'kg'), { ...supplier, boundary: 'other', hybridUpstreamCoveredBy: 'other_records' }, R_HYBRID)
add('purchase_supplier', false, 'hybrid covered partly', q('1', 'kg'), { ...supplier, boundary: 'supplier_scope1_2_only', hybridUpstreamCoveredBy: 'partial' }, R_HYBRID)
// AM-07: the spend lines the record supersedes (A22).
const R_SUPERSEDES = 'AM-07 supplier supersedes spend'
add('purchase_supplier', true, 'supersedes the supplier with no mapping keys', q('1', 'kg'), { ...supplier, supersedesSpend: { supplierName: 'Synthetic Steel Co', mappingKeys: [] } }, R_SUPERSEDES)
add('purchase_supplier', true, 'supersedes two mapping keys', q('1', 'kg'), { ...supplier, supersedesSpend: { supplierName: 'Synthetic Steel Co', mappingKeys: [KEY(1), KEY(2)] } }, R_SUPERSEDES)
add('purchase_supplier', true, 'supersedes fifty mapping keys', q('1', 'kg CO2e'), { ...allocated, supersedesSpend: { supplierName: long(200), mappingKeys: Array.from({ length: 50 }, (_, i) => KEY(i + 1)) } }, R_SUPERSEDES)
add('purchase_supplier', false, 'supersedes fifty-one mapping keys', q('1', 'kg'), { ...supplier, supersedesSpend: { supplierName: 'Synthetic Steel Co', mappingKeys: Array.from({ length: 51 }, (_, i) => KEY(i + 1)) } }, R_SUPERSEDES)
add('purchase_supplier', false, 'supersedes a mapping key twice', q('1', 'kg'), { ...supplier, supersedesSpend: { supplierName: 'Synthetic Steel Co', mappingKeys: [KEY(1), KEY(1)] } }, R_SUPERSEDES)
add('purchase_supplier', false, 'supersedes an upper-case mapping key', q('1', 'kg'), { ...supplier, supersedesSpend: { supplierName: 'Synthetic Steel Co', mappingKeys: [KEY(1).toUpperCase()] } }, R_SUPERSEDES)
add('purchase_supplier', false, 'supersedes a blank supplier', q('1', 'kg'), { ...supplier, supersedesSpend: { supplierName: ' ', mappingKeys: [] } }, R_SUPERSEDES)
add('purchase_supplier', false, 'supersedes with an extra key', q('1', 'kg'), { ...supplier, supersedesSpend: { supplierName: 'Synthetic Steel Co', mappingKeys: [], gl: '6100' } }, R_SUPERSEDES)
add('purchase_supplier', false, 'supersedes mapping keys as text', q('1', 'kg'), { ...supplier, supersedesSpend: { supplierName: 'Synthetic Steel Co', mappingKeys: KEY(1) } }, R_SUPERSEDES)
// AM-07: data years 2012-2035.
const R_DATA_YEAR = 'AM-07 data year 2012-2035'
add('purchase_supplier', true, 'data year 2012', q('1', 'kg'), { ...supplier, dataYear: 2012 }, R_DATA_YEAR)
add('purchase_supplier', true, 'data year 2035', q('1', 'kg'), { ...supplier, dataYear: 2035 }, R_DATA_YEAR)
add('purchase_supplier', true, 'data year 2030', q('1', 'kg'), { ...supplier, dataYear: 2030 }, R_DATA_YEAR)
add('purchase_supplier', false, 'data year 2036', q('1', 'kg'), { ...supplier, dataYear: 2036 }, R_DATA_YEAR)
add('purchase_supplier', false, 'data year null', q('1', 'kg'), { ...supplier, dataYear: null }, R_DATA_YEAR)
add('purchase_supplier', false, 'data year as text', q('1', 'kg'), { ...supplier, dataYear: '2024' }, R_DATA_YEAR)

// ---- energy_resold (category 3D).
const resold = { gridBasis: 'subregion', zip: '94105', subregion: 'CAMX', utilityEiaId: null, resoldEnergyNotInScope2: true }
add('energy_resold', true, 'subregion', q('1200.5', 'MWh'), resold)
add('energy_resold', true, 'U.S. average, no location', q('250', 'kWh'), { gridBasis: 'us_average', zip: null, subregion: null, utilityEiaId: null, resoldEnergyNotInScope2: true })
add('energy_resold', true, 'with utility and data quality', q('250', 'kWh'), { ...resold, utilityEiaId: '14328', dataQuality: DQ })
add('energy_resold', true, 'blank subregion kept (held later)', q('250', 'kWh'), { ...resold, subregion: '' })
add('energy_resold', true, 'longest subregion and utility texts', q('1', 'MWh'), { ...resold, subregion: long(20), utilityEiaId: long(40), dataQuality: null })
add('energy_resold', false, 'U.S. average with a ZIP', q('1', 'MWh'), { gridBasis: 'us_average', zip: '94105', subregion: null, utilityEiaId: null, resoldEnergyNotInScope2: true })
add('energy_resold', false, 'subregion basis without a ZIP', q('1', 'MWh'), { ...resold, zip: null })
add('energy_resold', false, 'four-digit ZIP', q('1', 'MWh'), { ...resold, zip: '9410' })
add('energy_resold', false, 'grid basis by state', q('1', 'MWh'), { ...resold, gridBasis: 'state' })
add('energy_resold', false, 'subregion of 21 characters', q('1', 'MWh'), { ...resold, subregion: long(21) })
add('energy_resold', false, 'normalized to therm', q('1', 'therm'), resold)
add('energy_resold', false, 'extra key', q('1', 'MWh'), { ...resold, meter: 'M-1' })
// AM-11: whether the resold electricity is kept out of the company's Scope 2 records (false is saved and held later).
const R_SCOPE2 = 'AM-11 resold energy not in Scope 2'
add('energy_resold', true, 'kept out of Scope 2', q('1', 'MWh'), { ...resold, resoldEnergyNotInScope2: true }, R_SCOPE2)
add('energy_resold', true, 'not confirmed out of Scope 2 (held later)', q('1', 'MWh'), { ...resold, resoldEnergyNotInScope2: false }, R_SCOPE2)
add('energy_resold', true, 'U.S. average, not confirmed', q('1', 'kWh'), { gridBasis: 'us_average', zip: null, subregion: null, utilityEiaId: null, resoldEnergyNotInScope2: false }, R_SCOPE2)
add('energy_resold', false, 'Scope 2 attestation null', q('1', 'MWh'), { ...resold, resoldEnergyNotInScope2: null }, R_SCOPE2)
add('energy_resold', false, 'Scope 2 attestation as text', q('1', 'MWh'), { ...resold, resoldEnergyNotInScope2: 'true' }, R_SCOPE2)
add('energy_resold', false, 'Scope 2 attestation missing', q('1', 'MWh'), change(resold, { resoldEnergyNotInScope2: undefined }), R_SCOPE2)

// ---- commuting_average (category 7).
const mode = (name: string, share: string, distance: string, occupancy: string | null = null, unit = 'mile') => ({ mode: name, sharePercent: share, oneWayDistance: distance, distanceUnit: unit, occupancy })
const commuting = { workingDays: 230, modes: [mode('passenger_car', '62.5', '14.2', '1.1'), mode('bus', '25', '8'), mode('non_motorized', '12.5', '1.5', null, 'km')], sharesBasis: '2025 staff survey (n=212)', distanceBasis: 'Survey home ZIP to office', activityOverlap: 'unknown' }
add('commuting_average', true, 'three modes', q('180', 'employee'), commuting)
add('commuting_average', true, 'one mode', q('180', 'employee'), { ...commuting, modes: [mode('bus', '100', '8')] })
add('commuting_average', true, 'ten modes', q('180', 'employee'), { ...commuting, modes: Array.from({ length: 10 }, () => mode('bus', '10', '8')) })
add('commuting_average', true, 'unknown mode kept, occupancy 1', q('180', 'employee'), { ...commuting, modes: [mode('e-scooter', '100', '2', '1')] })
add('commuting_average', true, 'with data quality, 366 working days', q('12', 'employee'), { ...commuting, workingDays: 366, dataQuality: DQ })
add('commuting_average', false, 'no modes', q('180', 'employee'), { ...commuting, modes: [] })
add('commuting_average', false, 'eleven modes', q('180', 'employee'), { ...commuting, modes: Array.from({ length: 11 }, () => mode('bus', '9', '8')) })
add('commuting_average', false, 'occupancy below 1', q('180', 'employee'), { ...commuting, modes: [mode('passenger_car', '100', '10', '0.9')] })
add('commuting_average', false, 'share with a percent sign', q('180', 'employee'), { ...commuting, modes: [mode('bus', '12.5%', '8')] })
add('commuting_average', false, 'distance unit miles', q('180', 'employee'), { ...commuting, modes: [mode('bus', '100', '8', null, 'miles')] })
add('commuting_average', false, 'shares basis of 2 characters', q('180', 'employee'), { ...commuting, sharesBasis: 'ab' })
add('commuting_average', false, '367 working days', q('180', 'employee'), { ...commuting, workingDays: 367 })
add('commuting_average', false, 'mode row with an extra key', q('180', 'employee'), { ...commuting, modes: [{ ...mode('bus', '100', '8'), note: 'x' }] })
add('commuting_average', false, 'normalized to person', q('180', 'person'), commuting)
// AM-10: whether distance-based commuting records for the same staff and period overlap (unknown is saved and held later).
const R_OVERLAP = 'AM-10 commuting activity overlap'
add('commuting_average', true, 'overlap ruled out', q('180', 'employee'), { ...commuting, activityOverlap: 'none_confirmed' }, R_OVERLAP)
add('commuting_average', true, 'overlap unknown', q('180', 'employee'), { ...commuting, activityOverlap: 'unknown' }, R_OVERLAP)
add('commuting_average', true, 'one mode, overlap ruled out', q('40', 'employee'), { ...commuting, modes: [mode('bus', '100', '8')], activityOverlap: 'none_confirmed' }, R_OVERLAP)
add('commuting_average', false, 'overlap null', q('180', 'employee'), { ...commuting, activityOverlap: null }, R_OVERLAP)
add('commuting_average', false, 'overlap none', q('180', 'employee'), { ...commuting, activityOverlap: 'none' }, R_OVERLAP)
add('commuting_average', false, 'overlap missing', q('180', 'employee'), change(commuting, { activityOverlap: undefined }), R_OVERLAP)

// ---- teleworking (category 7).
const telework = { carrier: 'electricity', zip: '94105', subregion: 'CAMX', utilityEiaId: null, baselineBasis: 'Incremental above the office baseline' }
add('teleworking', true, 'electricity', q('3200', 'kWh'), telework)
add('teleworking', true, 'natural gas, no location', q('85', 'therm'), { ...telework, carrier: 'natural_gas', zip: null, subregion: null, utilityEiaId: null })
add('teleworking', true, 'electricity in MWh with utility', q('3.2', 'MWh'), { ...telework, utilityEiaId: '14328' })
add('teleworking', true, 'natural gas in MMBtu with data quality', q('8.5', 'MMBtu'), { ...telework, carrier: 'natural_gas', zip: null, subregion: null, utilityEiaId: null, dataQuality: DQ })
add('teleworking', true, 'natural gas in scf', q('8500', 'scf'), { ...telework, carrier: 'natural_gas', zip: null, subregion: null, utilityEiaId: null, baselineBasis: long(300) })
add('teleworking', false, 'natural gas with a ZIP', q('85', 'therm'), { ...telework, carrier: 'natural_gas' })
add('teleworking', false, 'electricity without a ZIP', q('1', 'kWh'), { ...telework, zip: null, subregion: null })
add('teleworking', false, 'blank baseline basis', q('1', 'kWh'), { ...telework, baselineBasis: '' })
add('teleworking', false, 'carrier heat', q('1', 'kWh'), { ...telework, carrier: 'heat' })
add('teleworking', false, 'normalized to ccf', q('1', 'ccf'), { ...telework, carrier: 'natural_gas', zip: null, subregion: null, utilityEiaId: null })

// ---- asset_energy (categories 8, 10, 13, 14).
const asset = { category: 8, carrier: 'electricity', assetLabel: 'Leased warehouse, Fresno', counterpartyName: 'Synthetic Landlord LP', leaseType: 'operating', noOperationalControlBasis: 'Landlord operates HVAC and metering.', zip: '93721', subregion: 'CAMX', utilityEiaId: null, refrigerantGas: null, allocation: null }
const gasAsset = { ...asset, carrier: 'natural_gas', zip: null, subregion: null, utilityEiaId: null }
add('asset_energy', true, 'electricity, sub-metered', q('48000', 'kWh'), asset)
add('asset_energy', true, 'natural gas with area allocation, category 13 finance lease', q('5200', 'therm'), { ...gasAsset, category: 13, leaseType: 'finance', allocation: { reportingArea: '12000', buildingArea: '48000', occupancyPercent: '95', areaUnit: 'sqft' } })
add('asset_energy', true, 'refrigerant, category 14, no lease type', q('3.5', 'lb'), { ...gasAsset, category: 14, carrier: 'refrigerant', refrigerantGas: 'R-410A', leaseType: null })
add('asset_energy', true, 'natural gas in mcf, category 10', q('120', 'mcf'), { ...gasAsset, category: 10, leaseType: null, noOperationalControlBasis: null })
add('asset_energy', true, 'blank counterparty with data quality', q('1', 'MWh'), { ...asset, counterpartyName: '', noOperationalControlBasis: null, dataQuality: DQ })
add('asset_energy', false, 'refrigerant without a gas', q('1', 'kg'), { ...gasAsset, carrier: 'refrigerant' })
add('asset_energy', false, 'electricity with a refrigerant gas', q('1', 'kWh'), { ...asset, refrigerantGas: 'R-410A' })
add('asset_energy', false, 'category 5', q('1', 'kWh'), { ...asset, category: 5 })
add('asset_energy', false, 'lease type capital', q('1', 'kWh'), { ...asset, leaseType: 'capital' })
add('asset_energy', false, 'allocation without its area unit', q('1', 'therm'), { ...gasAsset, allocation: { reportingArea: '1', buildingArea: '2', occupancyPercent: '100' } })
add('asset_energy', false, 'occupancy percent with four decimals', q('1', 'therm'), { ...gasAsset, allocation: { reportingArea: '1', buildingArea: '2', occupancyPercent: '95.5555', areaUnit: 'm2' } })
add('asset_energy', false, 'natural gas with a ZIP', q('1', 'therm'), { ...asset, carrier: 'natural_gas' })
add('asset_energy', false, 'blank asset label', q('1', 'kWh'), { ...asset, assetLabel: ' ' })
add('asset_energy', false, 'operational control basis of 501 characters', q('1', 'kWh'), { ...asset, noOperationalControlBasis: long(501) })
add('asset_energy', false, 'normalized to US_gallon', q('1', 'US_gallon'), asset)
// AM-09: third-party warehouses and distribution centres (categories 4 and 9).
const R_ASSET = 'AM-09 asset categories'
add('asset_energy', true, 'third-party warehouse electricity, category 4', q('64000', 'kWh'), { ...asset, category: 4, assetLabel: 'Third-party DC, Stockton', counterpartyName: 'Synthetic 3PL LLC', leaseType: null }, R_ASSET)
add('asset_energy', true, 'retailer distribution centre gas, category 9', q('900', 'therm'), { ...gasAsset, category: 9, assetLabel: 'Retail partner DC', leaseType: null }, R_ASSET)
add('asset_energy', true, 'cold-storage refrigerant, category 4', q('12', 'kg'), { ...gasAsset, category: 4, carrier: 'refrigerant', refrigerantGas: 'R-404A', leaseType: null }, R_ASSET)
add('asset_energy', false, 'category 12', q('1', 'kWh'), { ...asset, category: 12 }, R_ASSET)
add('asset_energy', false, 'category 3', q('1', 'kWh'), { ...asset, category: 3 }, R_ASSET)
add('asset_energy', false, 'category 11', q('1', 'kWh'), { ...asset, category: 11 }, R_ASSET)

// ---- partner_reported (categories 8, 10, 13, 14).
const partner = { category: 13, counterpartyName: 'Synthetic Tenant Inc', scope2Basis: 'location', allocationBasis: 'area', allocationNumerator: '12000', allocationDenominator: '48000', leaseType: 'operating', noOperationalControlBasis: null, gwpBasis: 'AR5', verification: 'unverified', periodMatches: true, supersedesSpend: null }
add('partner_reported', true, 'tenant share by area', q('355000', 'kg CO2e'), partner)
add('partner_reported', true, 'exclusive franchise, tonnes', q('12.5', 'metric_ton CO2e'), { ...partner, category: 14, allocationBasis: 'exclusive', allocationNumerator: null, allocationDenominator: null, leaseType: null })
add('partner_reported', true, 'processor by revenue with data quality', q('1700', 'kg CO2e'), { ...partner, category: 10, allocationBasis: 'revenue', leaseType: null, dataQuality: DQ })
add('partner_reported', true, 'other basis, market, period mismatch', q('1', 'kg CO2e'), { ...partner, allocationBasis: 'other', scope2Basis: 'market', periodMatches: false, noOperationalControlBasis: 'Partner operates the site.' })
add('partner_reported', true, 'landlord figure, AR6, verified', q('1', 'kg CO2e'), { ...partner, category: 8, gwpBasis: 'AR6', verification: 'third_party_verified', leaseType: 'finance' })
add('partner_reported', false, 'exclusive with a numerator', q('1', 'kg CO2e'), { ...partner, allocationBasis: 'exclusive', allocationDenominator: null })
add('partner_reported', false, 'area without a numerator', q('1', 'kg CO2e'), { ...partner, allocationNumerator: null })
add('partner_reported', false, 'Scope 2 basis mixed', q('1', 'kg CO2e'), { ...partner, scope2Basis: 'mixed' })
add('partner_reported', false, 'period matches unknown', q('1', 'kg CO2e'), { ...partner, periodMatches: null })
add('partner_reported', false, 'blank counterparty', q('1', 'kg CO2e'), { ...partner, counterpartyName: '' })
add('partner_reported', false, 'category 11', q('1', 'kg CO2e'), { ...partner, category: 11 })
add('partner_reported', false, 'normalized to kg', q('1', 'kg'), partner)
// AM-08: carriers and 3PLs (4, 9) and waste contractors (5, 12).
const R_PARTNER = 'AM-08 partner categories'
add('partner_reported', true, 'carrier allocation by tonne-km, category 4', q('8200', 'kg CO2e'), { ...partner, category: 4, counterpartyName: 'Synthetic Freight Co', allocationBasis: 'mass', leaseType: null }, R_PARTNER)
add('partner_reported', true, 'waste contractor, category 5', q('3.1', 'metric_ton CO2e'), { ...partner, category: 5, counterpartyName: 'Synthetic Hauling', allocationBasis: 'exclusive', allocationNumerator: null, allocationDenominator: null, leaseType: null }, R_PARTNER)
add('partner_reported', true, '3PL downstream, category 9', q('500', 'kg CO2e'), { ...partner, category: 9, counterpartyName: 'Synthetic 3PL LLC', allocationBasis: 'volume', leaseType: null }, R_PARTNER)
add('partner_reported', true, 'end-of-life processor, category 12', q('900', 'kg CO2e'), { ...partner, category: 12, counterpartyName: 'Synthetic Recycler', allocationBasis: 'mass', leaseType: null }, R_PARTNER)
add('partner_reported', false, 'category 3', q('1', 'kg CO2e'), { ...partner, category: 3 }, R_PARTNER)
add('partner_reported', false, 'category 7', q('1', 'kg CO2e'), { ...partner, category: 7 }, R_PARTNER)
add('partner_reported', false, 'category 15', q('1', 'kg CO2e'), { ...partner, category: 15 }, R_PARTNER)
const R_PARTNER_SUPERSEDES = 'AM-08 partner supersedes spend'
add('partner_reported', true, 'carrier record supersedes freight spend', q('8200', 'kg CO2e'), { ...partner, category: 4, allocationBasis: 'mass', leaseType: null, supersedesSpend: { supplierName: 'Synthetic Freight Co', mappingKeys: [KEY(7)] } }, R_PARTNER_SUPERSEDES)
add('partner_reported', true, 'supersedes a supplier with no keys', q('1', 'kg CO2e'), { ...partner, supersedesSpend: { supplierName: 'Synthetic Tenant Inc', mappingKeys: [] } }, R_PARTNER_SUPERSEDES)
add('partner_reported', true, 'waste contractor supersedes hauling spend', q('3.1', 'metric_ton CO2e'), { ...partner, category: 5, allocationBasis: 'exclusive', allocationNumerator: null, allocationDenominator: null, leaseType: null, supersedesSpend: { supplierName: 'Synthetic Hauling', mappingKeys: [KEY(8), KEY(9)] } }, R_PARTNER_SUPERSEDES)
add('partner_reported', false, 'supersedes without a supplier name', q('1', 'kg CO2e'), { ...partner, supersedesSpend: { mappingKeys: [] } }, R_PARTNER_SUPERSEDES)
add('partner_reported', false, 'supersedes as text', q('1', 'kg CO2e'), { ...partner, supersedesSpend: 'Synthetic Tenant Inc' }, R_PARTNER_SUPERSEDES)
add('partner_reported', false, 'supersedes missing', q('1', 'kg CO2e'), change(partner, { supersedesSpend: undefined }), R_PARTNER_SUPERSEDES)
add('partner_reported', false, 'supersedes a short mapping key', q('1', 'kg CO2e'), { ...partner, supersedesSpend: { supplierName: 'Synthetic Tenant Inc', mappingKeys: ['abc'] } }, R_PARTNER_SUPERSEDES)

// ---- building_average (categories 8, 13, 14; CBECS loaded late).
const building = { category: 8, cbecsActivity: 'office', usesNaturalGas: 'yes', gridBasis: 'subregion', zip: '94105', subregion: 'CAMX', utilityEiaId: null, coveredDays: 365, leaseType: 'operating', noOperationalControlBasis: 'Shared building; landlord meters.' }
add('building_average', true, 'office', q('12000', 'sqft'), building)
add('building_average', true, 'U.S. average grid, square metres, gas unknown', q('1100', 'm2'), { ...building, gridBasis: 'us_average', zip: null, subregion: null, usesNaturalGas: 'unknown' })
add('building_average', true, 'franchise for one day', q('1', 'sqft'), { ...building, category: 14, coveredDays: 1, leaseType: null, noOperationalControlBasis: null })
add('building_average', true, 'unknown activity kept', q('1', 'sqft'), { ...building, cbecsActivity: 'data_center' })
add('building_average', true, 'lessor with data quality', q('1', 'sqft'), { ...building, category: 13, usesNaturalGas: 'no', dataQuality: DQ })
// AM-14: a leap year has 366 days.
const R_DAYS = 'AM-14 covered days 1-366'
add('building_average', true, '366 covered days', q('1', 'sqft'), { ...building, coveredDays: 366 }, R_DAYS)
add('building_average', true, '365 covered days', q('1', 'sqft'), { ...building, coveredDays: 365 }, R_DAYS)
add('building_average', true, 'one covered day', q('1', 'sqft'), { ...building, coveredDays: 1 }, R_DAYS)
add('building_average', false, '367 covered days', q('1', 'sqft'), { ...building, coveredDays: 367 }, R_DAYS)
add('building_average', false, 'no covered days', q('1', 'sqft'), { ...building, coveredDays: 0 }, R_DAYS)
add('building_average', false, 'covered days null', q('1', 'sqft'), { ...building, coveredDays: null }, R_DAYS)
add('building_average', false, 'category 10', q('1', 'sqft'), { ...building, category: 10 })
add('building_average', false, 'uses natural gas maybe', q('1', 'sqft'), { ...building, usesNaturalGas: 'maybe' })
add('building_average', false, 'U.S. average with a ZIP', q('1', 'sqft'), { ...building, gridBasis: 'us_average' })
add('building_average', false, 'activity of 81 characters', q('1', 'sqft'), { ...building, cbecsActivity: long(81) })
add('building_average', false, 'normalized to ft2', q('1', 'ft2'), building)

// ---- sold_fuel (category 11).
add('sold_fuel', true, 'propane in gallons', q('120000', 'US_gallon'), { fuel: 'propane', combustedInUse: 'yes' })
add('sold_fuel', true, 'feedstock, not combusted', q('5000', 'US_gallon'), { fuel: 'propane', combustedInUse: 'no_feedstock' })
add('sold_fuel', true, 'in MMBtu', q('4500.25', 'MMBtu'), { fuel: 'natural_gas', combustedInUse: 'yes' })
add('sold_fuel', true, 'in scf with data quality', q('1000000', 'scf'), { fuel: 'natural_gas', combustedInUse: 'yes', dataQuality: DQ })
add('sold_fuel', true, 'blank fuel kept, short tons', q('12', 'short_ton'), { fuel: '', combustedInUse: 'yes' })
add('sold_fuel', false, 'combusted in use no', q('1', 'MMBtu'), { fuel: 'propane', combustedInUse: 'no' })
add('sold_fuel', false, 'fuel null', q('1', 'MMBtu'), { fuel: null, combustedInUse: 'yes' })
add('sold_fuel', false, 'extra key', q('1', 'MMBtu'), { fuel: 'propane', combustedInUse: 'yes', blend: 'B20' })
add('sold_fuel', false, 'normalized to gallon', q('1', 'gallon'), { fuel: 'propane', combustedInUse: 'yes' })
add('sold_fuel', false, 'fuel of 81 characters', q('1', 'MMBtu'), { fuel: long(81), combustedInUse: 'yes' })

// ---- sold_energy_product (category 11).
const product = { productLabel: 'Synthetic 2 kW space heater', lifetimeBasis: 'years', lifetimeQuantity: '10', energyPerBasis: '1250.5', energyCarrier: 'electricity', energyUnit: 'kWh', useRegion: 'US', lifetimeSource: 'Manufacturer test standard' }
add('sold_energy_product', true, 'electricity over ten years', q('5000', 'unit'), product)
add('sold_energy_product', true, 'gas per use in a subregion', q('5000', 'unit'), { ...product, lifetimeBasis: 'uses', energyCarrier: 'natural_gas', energyUnit: 'scf', useRegion: 'CAMX' })
add('sold_energy_product', true, 'used outside the U.S. (held later)', q('5000', 'unit'), { ...product, useRegion: 'non_US' })
add('sold_energy_product', true, 'with data quality', q('1', 'unit'), { ...product, dataQuality: DQ })
add('sold_energy_product', true, 'lifetime source of 300 characters', q('1', 'unit'), { ...product, lifetimeSource: long(300) })
add('sold_energy_product', false, 'lifetime unknown', q('1', 'unit'), { ...product, lifetimeQuantity: null })
add('sold_energy_product', false, 'negative energy', q('1', 'unit'), { ...product, energyPerBasis: '-1' })
add('sold_energy_product', false, 'lifetime in months', q('1', 'unit'), { ...product, lifetimeBasis: 'months' })
add('sold_energy_product', false, 'lifetime source of 2 characters', q('1', 'unit'), { ...product, lifetimeSource: 'ab' })
add('sold_energy_product', false, 'blank product', q('1', 'unit'), { ...product, productLabel: '' })
add('sold_energy_product', false, 'normalized to units', q('1', 'units'), product)

// ---- sold_ghg_product (category 11). I-02b (AM-12): the use-phase release percent is required with its basis; no 100% default.
const ghg = { productLabel: 'Synthetic split AC unit', gas: 'R-410A', chargePerUnit: '2.75', chargeUnit: 'kg', useReleasePercent: '4', releaseBasis: 'Annual operating leak rate, EPA Vintaging Model, residential unitary AC' }
add('sold_ghg_product', true, 'annual leak rate', q('1200', 'unit'), ghg)
add('sold_ghg_product', true, 'pounds with data quality', q('1200', 'unit'), { ...ghg, chargeUnit: 'lb', dataQuality: DQ })
add('sold_ghg_product', true, 'unknown gas kept (held later)', q('1200', 'unit'), { ...ghg, gas: 'R-9999' })
add('sold_ghg_product', false, 'charge in grams', q('1', 'unit'), { ...ghg, chargeUnit: 'g' })
add('sold_ghg_product', false, 'charge unknown', q('1', 'unit'), { ...ghg, chargePerUnit: null })
add('sold_ghg_product', false, 'gas of 81 characters', q('1', 'unit'), { ...ghg, gas: long(81) })
add('sold_ghg_product', false, 'normalized to kg', q('1', 'kg'), ghg)
add('sold_ghg_product', false, 'blank product', q('1', 'unit'), { ...ghg, productLabel: '' })
const R_RELEASE = 'AM-12 use-phase release percent'
add('sold_ghg_product', true, 'released in full during use', q('1200', 'unit'), { ...ghg, useReleasePercent: '100', releaseBasis: 'Aerosol propellant: the whole charge is released in use' }, R_RELEASE)
add('sold_ghg_product', true, 'nothing released during use', q('1200', 'unit'), { ...ghg, useReleasePercent: '0', releaseBasis: 'Sealed system; released only at end of life (category 12)' }, R_RELEASE)
add('sold_ghg_product', true, 'release 100.000', q('1', 'unit'), { ...ghg, useReleasePercent: '100.000' }, R_RELEASE)
add('sold_ghg_product', true, 'release 2.5', q('1', 'unit'), { ...ghg, useReleasePercent: '2.5' }, R_RELEASE)
add('sold_ghg_product', false, 'release missing (no default)', q('1', 'unit'), { ...ghg, useReleasePercent: null }, R_RELEASE)
add('sold_ghg_product', false, 'release 100.001', q('1', 'unit'), { ...ghg, useReleasePercent: '100.001' }, R_RELEASE)
add('sold_ghg_product', false, 'release 101', q('1', 'unit'), { ...ghg, useReleasePercent: '101' }, R_RELEASE)
add('sold_ghg_product', false, 'release negative', q('1', 'unit'), { ...ghg, useReleasePercent: '-1' }, R_RELEASE)
add('sold_ghg_product', false, 'release with four decimals', q('1', 'unit'), { ...ghg, useReleasePercent: '2.5555' }, R_RELEASE)
add('sold_ghg_product', false, 'the old release percent key', q('1', 'unit'), { ...change(ghg, { useReleasePercent: undefined }), releasePercent: '4' }, R_RELEASE)
const R_RELEASE_BASIS = 'AM-12 release basis'
add('sold_ghg_product', true, 'release basis of 3 characters', q('1', 'unit'), { ...ghg, releaseBasis: 'EPA' }, R_RELEASE_BASIS)
add('sold_ghg_product', true, 'release basis of 300 characters', q('1', 'unit'), { ...ghg, releaseBasis: long(300) }, R_RELEASE_BASIS)
add('sold_ghg_product', true, 'release basis with spaces around it', q('1', 'unit'), { ...ghg, releaseBasis: '  Manufacturer data sheet  ' }, R_RELEASE_BASIS)
add('sold_ghg_product', false, 'release basis of 2 characters', q('1', 'unit'), { ...ghg, releaseBasis: 'ab' }, R_RELEASE_BASIS)
add('sold_ghg_product', false, 'release basis of 301 characters', q('1', 'unit'), { ...ghg, releaseBasis: long(301) }, R_RELEASE_BASIS)
add('sold_ghg_product', false, 'release basis null', q('1', 'unit'), { ...ghg, releaseBasis: null }, R_RELEASE_BASIS)

// ---- end_of_life_split (category 12).
const split = { recycled: '75', landfilled: '20', combusted: '5', composted: '0', anaerobic_digestion_dry: '0', anaerobic_digestion_wet: '0' }
const eol = { material: 'corrugated_containers', basis: 'packaging', split, splitBasis: 'EPA Facts and Figures 2018, containers and packaging', productLabel: 'Synthetic shipping box' }
add('end_of_life_split', true, 'packaging with a known split', q('85.5', 'short_ton'), eol)
add('end_of_life_split', true, 'unknown split (held later)', q('85.5', 'short_ton'), { ...eol, split: null, splitBasis: null })
add('end_of_life_split', true, 'sold products in tonnes', q('12', 'metric_ton'), { ...eol, basis: 'sold_products', material: 'mixed_plastics' })
add('end_of_life_split', true, 'with data quality, in pounds', q('1', 'lb'), { ...eol, dataQuality: DQ })
add('end_of_life_split', true, 'unknown material kept', q('1', 'kg'), { ...eol, material: 'unobtainium' })
add('end_of_life_split', false, 'split missing a treatment', q('1', 'kg'), { ...eol, split: change(split, { composted: undefined }) })
add('end_of_life_split', false, 'split with a percent sign', q('1', 'kg'), { ...eol, split: { ...split, recycled: '75%' } })
add('end_of_life_split', false, 'split basis of 2 characters', q('1', 'kg'), { ...eol, splitBasis: 'ab' })
add('end_of_life_split', false, 'basis products', q('1', 'kg'), { ...eol, basis: 'products' })
add('end_of_life_split', false, 'split with an extra treatment', q('1', 'kg'), { ...eol, split: { ...split, incinerated: '0' } })
add('end_of_life_split', false, 'normalized to tonne', q('1', 'tonne'), eol)
// AM-13: the product label (to match a category 11 record of the same product).
const R_PRODUCT = 'AM-13 end-of-life product label'
add('end_of_life_split', true, 'no product label', q('1', 'kg'), { ...eol, productLabel: '' }, R_PRODUCT)
add('end_of_life_split', true, 'product label of 200 characters', q('1', 'kg'), { ...eol, productLabel: long(200) }, R_PRODUCT)
add('end_of_life_split', true, 'product label matching a category 11 product', q('1', 'kg'), { ...eol, basis: 'sold_products', productLabel: 'Synthetic split AC unit' }, R_PRODUCT)
add('end_of_life_split', false, 'product label of 201 characters', q('1', 'kg'), { ...eol, productLabel: long(201) }, R_PRODUCT)
add('end_of_life_split', false, 'product label null', q('1', 'kg'), { ...eol, productLabel: null }, R_PRODUCT)
add('end_of_life_split', false, 'product label missing', q('1', 'kg'), change(eol, { productLabel: undefined }), R_PRODUCT)

// ---- investment (category 15).
const investment = { investeeName: 'Synthetic Solar Holdings', holdingType: 'equity_unlisted', path: 'investee_reported', attribution: { basis: 'equity_share_percent', percent: '12.5' }, investeeEmissions: '4930000', emissionsVerified: true, revenue: null, revenueYear: null, naicsCode: null, initialSponsor: false, projectedAnnual: null, lifetimeYears: null, snapshotDate: '2025-12-31', gwpBasis: 'AR5' }
add('investment', true, 'equity share, investee reported', q('2500000', 'USD'), investment)
add('investment', true, 'listed equity over EVIC', q('1000000', 'USD'), { ...investment, holdingType: 'equity_listed', attribution: { basis: 'outstanding_over_denominator', denominatorType: 'evic', denominator: '125000000' }, emissionsVerified: null })
add('investment', true, 'revenue EEIO proxy', q('1000000', 'USD'), { ...investment, path: 'revenue_eeio', investeeEmissions: null, emissionsVerified: null, revenue: '35000000', revenueYear: 2024, naicsCode: '541511' })
add('investment', true, 'project finance as initial sponsor', q('20000000', 'USD'), { ...investment, holdingType: 'project_finance', path: 'project_reported', attribution: { basis: 'outstanding_over_denominator', denominatorType: 'total_project_cost', denominator: '80000000' }, initialSponsor: true, projectedAnnual: '1200000', lifetimeYears: 25 })
add('investment', true, 'leap-day snapshot with data quality', q('1', 'USD'), { ...investment, snapshotDate: '2024-02-29', dataQuality: DQ, gwpBasis: 'unknown' })
add('investment', false, 'attribution basis equity_share', q('1', 'USD'), { ...investment, attribution: { basis: 'equity_share', percent: '12.5' } })
add('investment', false, 'attribution without its denominator', q('1', 'USD'), { ...investment, attribution: { basis: 'outstanding_over_denominator', denominatorType: 'evic' } })
add('investment', false, 'snapshot 30 February', q('1', 'USD'), { ...investment, snapshotDate: '2025-02-30' })
add('investment', false, 'snapshot in 1899', q('1', 'USD'), { ...investment, snapshotDate: '1899-12-31' })
// AM-15: revenue years 2012-2035.
const R_REVENUE_YEAR = 'AM-15 revenue year 2012-2035'
add('investment', true, 'revenue year 2026', q('1', 'USD'), { ...investment, path: 'revenue_eeio', revenue: '1000', revenueYear: 2026, naicsCode: '541511' }, R_REVENUE_YEAR)
add('investment', true, 'revenue year 2012', q('1', 'USD'), { ...investment, revenue: '1000', revenueYear: 2012 }, R_REVENUE_YEAR)
add('investment', true, 'revenue year 2035', q('1', 'USD'), { ...investment, revenue: '1000', revenueYear: 2035 }, R_REVENUE_YEAR)
add('investment', false, 'revenue year 2011', q('1', 'USD'), { ...investment, revenueYear: 2011 }, R_REVENUE_YEAR)
add('investment', false, 'revenue year 2036', q('1', 'USD'), { ...investment, revenueYear: 2036 }, R_REVENUE_YEAR)
add('investment', false, 'revenue year as text', q('1', 'USD'), { ...investment, revenueYear: '2024' }, R_REVENUE_YEAR)
add('investment', false, 'lifetime 101 years', q('1', 'USD'), { ...investment, lifetimeYears: 101 })
add('investment', false, 'four-digit NAICS code', q('1', 'USD'), { ...investment, naicsCode: '5415' })
add('investment', false, 'holding type bond', q('1', 'USD'), { ...investment, holdingType: 'bond' })
add('investment', false, 'no attribution', q('1', 'USD'), { ...investment, attribution: null })
add('investment', false, 'normalized to EUR', q('1', 'EUR'), investment)

export const SCOPE3_PAYLOAD_FIXTURES: readonly Scope3PayloadFixture[] = fixtures

// ---- Category assessments (scope3-assessment-contract.ts and 0030's scope3_assert_assessment). I-02: the base rules;
// I-02b: the reporting year (AM-03) and within-category exclusions (AM-17), each with at least three valid and three
// invalid entries. The database's other checks (the setup's year, the current setup) are RPC rules, tested separately.
export interface Scope3AssessmentFixture { label: string; value: Record<string, unknown>; valid: boolean; rule?: string }
export const FIXTURE_CRITERIA = { size: true, influence: false, risk: false, stakeholders: false, outsourcing: false, sectorGuidance: false, other: false, otherText: '' }
/** A valid category 1 assessment for the 2025 reporting year, with `extra` keys replaced (or dropped when undefined). */
export const fixtureAssessment = (setupVersionId: string, extra: Record<string, unknown> = {}) => change({ category: 1, reportingYear: 2025, setupVersionId, reasonCode: 'immaterial_estimated', criteria: FIXTURE_CRITERIA, activitiesIncluded: '',
  justification: 'Below 1% of the estimated total.', magnitudeKind: 'estimated', magnitudeTCo2e: '120.5', magnitudeBasis: 'Spend times the sector average factor.', notQuantifiableReason: '', plannedMethodTypes: ['spend_based'],
  energyResale: null, evidenceIds: [], withinCategoryExclusions: [] }, extra)
/**
 * I-04: a saved assessment revision as the database returns it (`Scope3AssessmentRecord`), for coverage, route and
 * decoder tests: a valid category 1 assessment by default, with `extra` keys replaced. Revision 1 unless `revision` is given.
 */
export const fixtureAssessmentRecord = (companyId: string, setupVersionId: string, extra: Record<string, unknown> = {}) => {
  const revision = (extra.revision as number | undefined) ?? 1
  return change({ ...fixtureAssessment(setupVersionId), id: crypto.randomUUID(), companyId, revision, previousId: revision === 1 ? null : crypto.randomUUID(),
    correctionReason: revision === 1 ? null : 'Corrected after review.', createdBy: companyId, createdAt: '2026-10-30T12:00:00.000Z' }, extra)
}
const NUCLEAR = 'nuclear_biomass_byproduct_fuels_upstream_excluded', FACILITIES_NOTE = 'third_party_facilities_not_included'
const exclusion = (extra: Record<string, unknown> = {}) => change({ noteCode: NUCLEAR, justification: 'Nuclear and biomass fuels are under 1% of purchased fuel energy.', magnitudeKind: 'estimated', magnitudeTCo2e: '0.8', basis: 'Fuel mix share times the 3B estimate.' }, extra)
export function scope3AssessmentFixtures(setupVersionId: string): Scope3AssessmentFixture[] {
  const a = (extra: Record<string, unknown> = {}) => fixtureAssessment(setupVersionId, extra)
  const c = FIXTURE_CRITERIA
  const out: Scope3AssessmentFixture[] = [
    { label: 'estimate', value: a(), valid: true },
    { label: 'not quantifiable', value: a({ magnitudeKind: 'not_quantifiable', magnitudeTCo2e: null, magnitudeBasis: '', notQuantifiableReason: 'No spend data for the year.' }), valid: true },
    { label: 'no magnitude', value: a({ reasonCode: null, magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: '' }), valid: true },
    { label: 'other criterion with its text', value: a({ criteria: { ...c, other: true, otherText: 'Customer request' } }), valid: true },
    { label: 'every method type', value: a({ plannedMethodTypes: ['activity_average_data', 'spend_based', 'supplier_specific', 'partner_reported', 'proxy'] }), valid: true },
    { label: 'category 3 with no energy resale', value: a({ category: 3, energyResale: 'none' }), valid: true },
    { label: 'longest texts', value: a({ activitiesIncluded: 'a'.repeat(2000), justification: 'j'.repeat(4000), magnitudeBasis: 'b'.repeat(1000) }), valid: true },
    { label: 'category 16', value: a({ category: 16 }), valid: false },
    { label: 'reason code not listed', value: a({ reasonCode: 'too_hard' }), valid: false },
    { label: 'estimate without a magnitude', value: a({ magnitudeTCo2e: null }), valid: false },
    { label: 'magnitude without an estimate', value: a({ magnitudeKind: null }), valid: false },
    { label: 'basis without an estimate', value: a({ magnitudeKind: 'not_quantifiable', magnitudeTCo2e: null, notQuantifiableReason: 'No data at all.' }), valid: false },
    { label: 'not quantifiable without a reason', value: a({ magnitudeKind: 'not_quantifiable', magnitudeTCo2e: null, magnitudeBasis: '', notQuantifiableReason: 'no' }), valid: false },
    { label: 'reason without not quantifiable', value: a({ notQuantifiableReason: 'No data at all.' }), valid: false },
    { label: 'magnitude with four decimals', value: a({ magnitudeTCo2e: '1.2345' }), valid: false },
    { label: 'criterion missing', value: a({ criteria: change(c, { risk: undefined }) }), valid: false },
    { label: 'other text without the other criterion', value: a({ criteria: { ...c, otherText: 'x' } }), valid: false },
    { label: 'other text of 301 characters', value: a({ criteria: { ...c, other: true, otherText: 'o'.repeat(301) } }), valid: false },
    { label: 'repeated method type', value: a({ plannedMethodTypes: ['spend_based', 'spend_based'] }), valid: false },
    { label: 'unknown method type', value: a({ plannedMethodTypes: ['hybrid'] }), valid: false },
    { label: 'energy resale on category 5', value: a({ category: 5, energyResale: 'none' }), valid: false },
    { label: 'repeated evidence', value: a({ evidenceIds: [setupVersionId, setupVersionId] }), valid: false },
    { label: 'justification of 4001 characters', value: a({ justification: 'j'.repeat(4001) }), valid: false },
    { label: 'control character', value: a({ justification: 'tab\tok but bell\u0007' }), valid: false },
    { label: 'extra key', value: { ...a(), decision: 'excluded' }, valid: false },
  ]
  const R_YEAR = 'AM-03 reporting year', R_EXCLUSIONS = 'AM-17 within-category exclusions'
  out.push(
    { label: 'reporting year 2012', value: a({ reportingYear: 2012 }), valid: true, rule: R_YEAR },
    { label: 'reporting year 2035', value: a({ reportingYear: 2035 }), valid: true, rule: R_YEAR },
    { label: 'reporting year 2026 (first SB 253 Scope 3 year)', value: a({ reportingYear: 2026 }), valid: true, rule: R_YEAR },
    { label: 'reporting year 2011', value: a({ reportingYear: 2011 }), valid: false, rule: R_YEAR },
    { label: 'reporting year 2036', value: a({ reportingYear: 2036 }), valid: false, rule: R_YEAR },
    { label: 'reporting year null', value: a({ reportingYear: null }), valid: false, rule: R_YEAR },
    { label: 'reporting year as text', value: a({ reportingYear: '2025' }), valid: false, rule: R_YEAR },
    { label: 'reporting year missing', value: a({ reportingYear: undefined }), valid: false, rule: R_YEAR },
    { label: 'one estimated exclusion (3B nuclear and biomass)', value: a({ category: 3, withinCategoryExclusions: [exclusion()] }), valid: true, rule: R_EXCLUSIONS },
    { label: 'both notes, one not quantifiable with no basis', value: a({ withinCategoryExclusions: [exclusion(), exclusion({ noteCode: FACILITIES_NOTE, magnitudeKind: 'not_quantifiable', magnitudeTCo2e: null, basis: '' })] }), valid: true, rule: R_EXCLUSIONS },
    { label: 'exclusion with the longest texts', value: a({ withinCategoryExclusions: [exclusion({ justification: 'j'.repeat(1000), basis: 'b'.repeat(1000), magnitudeTCo2e: '999999999999.999' })] }), valid: true, rule: R_EXCLUSIONS },
    { label: 'exclusion of a note not on the allow-list', value: a({ withinCategoryExclusions: [exclusion({ noteCode: 'tank_to_wheel_only' })] }), valid: false, rule: R_EXCLUSIONS },
    { label: 'the same note twice', value: a({ withinCategoryExclusions: [exclusion(), exclusion({ magnitudeTCo2e: '1' })] }), valid: false, rule: R_EXCLUSIONS },
    { label: 'estimated exclusion without a magnitude', value: a({ withinCategoryExclusions: [exclusion({ magnitudeTCo2e: null })] }), valid: false, rule: R_EXCLUSIONS },
    { label: 'not-quantifiable exclusion with a magnitude', value: a({ withinCategoryExclusions: [exclusion({ magnitudeKind: 'not_quantifiable' })] }), valid: false, rule: R_EXCLUSIONS },
    { label: 'exclusion justification of 2 characters', value: a({ withinCategoryExclusions: [exclusion({ justification: 'ok' })] }), valid: false, rule: R_EXCLUSIONS },
    { label: 'exclusion justification of 1001 characters', value: a({ withinCategoryExclusions: [exclusion({ justification: 'j'.repeat(1001) })] }), valid: false, rule: R_EXCLUSIONS },
    { label: 'exclusion basis of 1001 characters', value: a({ withinCategoryExclusions: [exclusion({ basis: 'b'.repeat(1001) })] }), valid: false, rule: R_EXCLUSIONS },
    { label: 'exclusion magnitude with four decimals', value: a({ withinCategoryExclusions: [exclusion({ magnitudeTCo2e: '0.8125' })] }), valid: false, rule: R_EXCLUSIONS },
    { label: 'exclusion with an extra key', value: a({ withinCategoryExclusions: [{ ...exclusion(), category: 3 }] }), valid: false, rule: R_EXCLUSIONS },
    { label: 'exclusions as an object', value: a({ withinCategoryExclusions: exclusion() }), valid: false, rule: R_EXCLUSIONS },
    { label: 'exclusions null', value: a({ withinCategoryExclusions: null }), valid: false, rule: R_EXCLUSIONS },
    { label: 'twenty-one exclusions', value: a({ withinCategoryExclusions: Array.from({ length: 21 }, () => exclusion()) }), valid: false, rule: R_EXCLUSIONS },
  )
  return out
}
