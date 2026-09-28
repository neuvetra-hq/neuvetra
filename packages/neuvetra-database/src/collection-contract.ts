export const COLLECTION_PROFILE = 'neuvetra.collection.v1' as const
export const COLLECTION_EVIDENCE_BUCKET = 'neuvetra-private-company-evidence' as const
export const COLLECTION_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024

export type CollectionQuality = 'actual' | 'estimated' | 'unknown'
export type CollectionActivityKind = 'natural_gas' | 'distillate_no2' | 'vehicle' | 'fugitive' | 'electricity'
export type CollectionQuarantineStatus = 'pending' | 'clean' | 'rejected' | 'error'

export interface CollectionPeriod { start: string; endExclusive: string }
export interface CollectionQuantity {
  originalValue: string
  originalUnit: string
  normalizedValue: string | null
  normalizedUnit: string | null
}
export interface CollectionInstrument {
  type: 'energy_attribute_certificate' | 'power_purchase_agreement' | 'green_tariff' | 'supplier_specific_rate'
  mwh: string
  qualityCriteriaMet: boolean
  vintageYear: number
  evidenceReference: string | null
  generationTechnology: 'wind' | 'solar_photovoltaic' | 'hydro' | 'nuclear' | 'geothermal' | 'natural_gas' | 'coal' | 'oil' | 'biomass' | 'biogas' | 'landfill_gas' | 'mixed' | 'unknown'
  rateLbPerMwh: null | { co2: string; ch4: string | null; n2o: string | null }
}
export type NaturalGasCollectionPayload = { heatContent: null | { value: string; unit: 'MMBtu per scf' | 'MMBtu per ccf' | 'MMBtu per mcf' | 'therm per ccf' } }
export type DistillateCollectionPayload = { consumption: { basis: 'measured'; gallons: string } | { basis: 'purchases_with_tank_levels'; purchasedGallons: string; openingGallons: string; closingGallons: string } | { basis: 'purchases_only'; purchasedGallons: string }; statedHhvMmbtuPerGallon: string | null }
export type VehicleCollectionPayload = { vehicleGroupId: string; fuel: string; vehicleType: string; modelYear: number; gallons: string; vehicleCount: number | null; miles: null | { value: string; basis: string }; fuelEconomy: null | { mpg: string; source: string } }
export type FugitiveCollectionPayload = { gas: 'HFC-134a' | 'HFC-227ea' | 'R-404A' | 'R-407C' | 'R-410A' | 'R-507A' | 'R-22' | 'R-12' | 'R-502'; unit: 'kg' | 'lb'; terms: { PN: string; CN: string; PS: string; CD: string; RD: string }; insideBoundary: boolean | null; maintainsRefrigerantStock: boolean | null; retrofitInPeriod: boolean | null; contractorRecordsComplete: boolean; eventChronologyComplete: boolean }
export type ElectricityCollectionPayload = { meterOrAccountNumber: string; utilityName: string; site: string; zip: string; subregion: string; utilityEiaId: string | null; instruments: CollectionInstrument[] }
export type CollectionPayload = NaturalGasCollectionPayload | DistillateCollectionPayload | VehicleCollectionPayload | FugitiveCollectionPayload | ElectricityCollectionPayload

interface CollectionActivityCommon {
  quantity: CollectionQuantity
  quality: CollectionQuality
  estimateBasis: string | null
  period: CollectionPeriod
  reference: string
  notes: string
  evidenceIds: string[]
}
export type CollectionActivity = CollectionActivityCommon & (
  | {kind:'natural_gas';payload:NaturalGasCollectionPayload}
  | {kind:'distillate_no2';payload:DistillateCollectionPayload}
  | {kind:'vehicle';payload:VehicleCollectionPayload}
  | {kind:'fugitive';payload:FugitiveCollectionPayload}
  | {kind:'electricity';payload:ElectricityCollectionPayload}
)
export interface CollectionActivitySaveInput {
  idempotencyKey: string
  expectedRevision: number
  expectedVersionId: string | null
  correctionReason: string | null
  activity: CollectionActivity
}
export interface CollectionActivityVersion {
  id: string
  recordId: string
  companyId: string
  revision: number
  previousVersionId: string | null
  correctionReason: string | null
  activity: CollectionActivity
  payloadSha256: string
  createdBy: string
  createdAt: string
}
export interface CollectionActivityRecord {
  id: string
  companyId: string
  kind: CollectionActivityKind
  currentVersion: CollectionActivityVersion
  history: Array<Omit<CollectionActivityVersion, 'activity'>>
}
export interface GridLossLineage {
  id: string
  companyId: string
  electricityRecordId: string
  reference: string
  notes: string
  createdBy: string
  createdAt: string
}
export interface CollectionEvidenceUploadInput {
  uploadId: string
  evidenceId: string
  objectKey: string
  originalName: string
  mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'text/csv' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  byteLength: number
  sha256: string
}
export interface CollectionEvidenceReceipt {
  uploadId: string
  evidenceId: string
  reused: boolean
  quarantineStatus: CollectionQuarantineStatus
  orphanRecoveryRequired: boolean
}
export interface CollectionEvidenceMetadata {
  id: string
  companyId: string
  bucket: typeof COLLECTION_EVIDENCE_BUCKET
  objectKey: string
  originalName: string
  mediaType: CollectionEvidenceUploadInput['mediaType']
  byteLength: number
  sha256: string
  quarantineStatus: CollectionQuarantineStatus
  uploadedBy: string
  createdAt: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SHA256 = /^[0-9a-f]{64}$/
const DECIMAL = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const fail = (message = 'Invalid collection record.'): never => { throw new Error(message) }
const object = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail()
  return value as Record<string, unknown>
}
const text = (value: unknown, max: number, allowBlank = true): string => {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value) || (!allowBlank && !value.trim())) fail()
  return (value as string).normalize('NFC')
}
const decimal = (value: unknown): string => typeof value === 'string' && DECIMAL.test(value) ? value : fail('Collection decimals allow 12 integer digits and 3 fractional digits.')
const numericInput = (value: unknown): string => value === '' || value === 'unknown' ? value : decimal(value)
const nullableDecimal = (value: unknown): string | null => value === null ? null : decimal(value)
const uuid = (value: unknown): string => typeof value === 'string' && UUID.test(value) ? value : fail()
const nullableText = (value: unknown, max: number): string | null => value === null ? null : text(value, max)
const enumeration = <T extends string>(value: unknown, allowed: readonly T[]): T => typeof value === 'string' && allowed.includes(value as T) ? value as T : fail()
const calendarDate = (value: unknown): string => {
  if (typeof value !== 'string' || !DATE.test(value) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) fail('A real calendar date is required.')
  return value as string
}
const nullableBoolean = (value: unknown): boolean | null => value === null || typeof value === 'boolean' ? value : fail('Unknown yes/no answers must be null.')

function validateInstrument(value: unknown): CollectionInstrument {
  const row = object(value, ['type','mwh','qualityCriteriaMet','vintageYear','evidenceReference','generationTechnology','rateLbPerMwh'])
  const type = enumeration(row.type, ['energy_attribute_certificate','power_purchase_agreement','green_tariff','supplier_specific_rate'] as const)
  const technology = enumeration(row.generationTechnology, ['wind','solar_photovoltaic','hydro','nuclear','geothermal','natural_gas','coal','oil','biomass','biogas','landfill_gas','mixed','unknown'] as const)
  if (typeof row.qualityCriteriaMet !== 'boolean' || !Number.isInteger(row.vintageYear) || (row.vintageYear as number) < 2024 || (row.vintageYear as number) > 2026) fail()
  let rate: CollectionInstrument['rateLbPerMwh'] = null
  if (row.rateLbPerMwh !== null) {
    const r = object(row.rateLbPerMwh, ['co2','ch4','n2o'])
    rate = { co2: decimal(r.co2), ch4: nullableDecimal(r.ch4), n2o: nullableDecimal(r.n2o) }
  }
  return { type, mwh: numericInput(row.mwh), qualityCriteriaMet: row.qualityCriteriaMet as boolean, vintageYear: row.vintageYear as number, evidenceReference: row.evidenceReference===null?null:uuid(row.evidenceReference), generationTechnology: technology, rateLbPerMwh: rate }
}

function validatePayload(kind: CollectionActivityKind, value: unknown): CollectionPayload {
  if (kind === 'natural_gas') {
    const p = object(value, ['heatContent'])
    if (p.heatContent === null) return { heatContent: null }
    const h = object(p.heatContent, ['value','unit'])
    return { heatContent: { value: numericInput(h.value), unit: enumeration(h.unit, ['MMBtu per scf','MMBtu per ccf','MMBtu per mcf','therm per ccf'] as const) } }
  }
  if (kind === 'distillate_no2') {
    const p = object(value, ['consumption','statedHhvMmbtuPerGallon'])
    const c = p.consumption as Record<string, unknown>
    if (!c || typeof c !== 'object' || Array.isArray(c)) fail()
    const basis = enumeration(c.basis, ['measured','purchases_with_tank_levels','purchases_only'] as const)
    let consumption: DistillateCollectionPayload['consumption']
    if (basis === 'measured') { object(c, ['basis','gallons']); consumption = { basis, gallons: numericInput(c.gallons) } }
    else if (basis === 'purchases_only') { object(c, ['basis','purchasedGallons']); consumption = { basis, purchasedGallons: numericInput(c.purchasedGallons) } }
    else { object(c, ['basis','purchasedGallons','openingGallons','closingGallons']); consumption = { basis, purchasedGallons: numericInput(c.purchasedGallons), openingGallons: numericInput(c.openingGallons), closingGallons: numericInput(c.closingGallons) } }
    return { consumption, statedHhvMmbtuPerGallon: nullableDecimal(p.statedHhvMmbtuPerGallon) }
  }
  if (kind === 'vehicle') {
    const p = object(value, ['vehicleGroupId','fuel','vehicleType','modelYear','gallons','vehicleCount','miles','fuelEconomy'])
    if (!Number.isInteger(p.modelYear) || (p.modelYear as number) < 1900 || (p.modelYear as number) > 2026 || !(p.vehicleCount === null || Number.isInteger(p.vehicleCount) && (p.vehicleCount as number) > 0)) fail()
    const miles = p.miles === null ? null : object(p.miles, ['value','basis'])
    const economy = p.fuelEconomy === null ? null : object(p.fuelEconomy, ['mpg','source'])
    return { vehicleGroupId:text(p.vehicleGroupId,120,false), fuel: text(p.fuel,80,false), vehicleType: text(p.vehicleType,120,false), modelYear:p.modelYear as number, gallons:numericInput(p.gallons), vehicleCount:p.vehicleCount as number|null, miles:miles?{value:numericInput(miles.value),basis:text(miles.basis,500,false)}:null, fuelEconomy:economy?{mpg:numericInput(economy.mpg),source:text(economy.source,500,false)}:null }
  }
  if (kind === 'fugitive') {
    const p = object(value, ['gas','unit','terms','insideBoundary','maintainsRefrigerantStock','retrofitInPeriod','contractorRecordsComplete','eventChronologyComplete'])
    const terms = object(p.terms, ['PN','CN','PS','CD','RD'])
    if (typeof p.contractorRecordsComplete !== 'boolean' || typeof p.eventChronologyComplete !== 'boolean') fail()
    return { gas:enumeration(p.gas,['HFC-134a','HFC-227ea','R-404A','R-407C','R-410A','R-507A','R-22','R-12','R-502'] as const), unit:enumeration(p.unit,['kg','lb'] as const), terms:{PN:numericInput(terms.PN),CN:numericInput(terms.CN),PS:numericInput(terms.PS),CD:numericInput(terms.CD),RD:numericInput(terms.RD)}, insideBoundary:nullableBoolean(p.insideBoundary), maintainsRefrigerantStock:nullableBoolean(p.maintainsRefrigerantStock), retrofitInPeriod:nullableBoolean(p.retrofitInPeriod), contractorRecordsComplete:p.contractorRecordsComplete as boolean, eventChronologyComplete:p.eventChronologyComplete as boolean }
  }
  const p = object(value, ['meterOrAccountNumber','utilityName','site','zip','subregion','utilityEiaId','instruments'])
  if (typeof p.zip !== 'string' || !/^\d{5}$/.test(p.zip) || !Array.isArray(p.instruments) || p.instruments.length > 100) fail()
  return { meterOrAccountNumber:text(p.meterOrAccountNumber,120,false), utilityName:text(p.utilityName,200,false), site:text(p.site,200,false), zip:p.zip as string, subregion:text(p.subregion,20), utilityEiaId:nullableText(p.utilityEiaId,40), instruments:(p.instruments as unknown[]).map(validateInstrument) }
}

export function validateCollectionActivity(value: unknown): CollectionActivity {
  const row = object(value, ['kind','quantity','quality','estimateBasis','period','reference','notes','evidenceIds','payload'])
  const kind = enumeration(row.kind, ['natural_gas','distillate_no2','vehicle','fugitive','electricity'] as const)
  const q = object(row.quantity, ['originalValue','originalUnit','normalizedValue','normalizedUnit'])
  const originalValue = text(q.originalValue,100)
  const normalizedValue = nullableDecimal(q.normalizedValue)
  const normalizedUnit = nullableText(q.normalizedUnit,80)
  if ((normalizedValue === null) !== (normalizedUnit === null)) fail()
  if ((originalValue === '' || originalValue === 'unknown') && normalizedValue !== null) fail('Unknown quantity cannot be normalized.')
  const quality = enumeration(row.quality, ['actual','estimated','unknown'] as const)
  const estimateBasis = nullableText(row.estimateBasis,2000)
  if (quality === 'estimated' ? !estimateBasis?.trim() : estimateBasis !== null) fail('Only estimated records carry an estimate basis.')
  const period = object(row.period, ['start','endExclusive'])
  const start = calendarDate(period.start), endExclusive = calendarDate(period.endExclusive)
  if (start < '2025-01-01' || endExclusive > '2026-01-01' || start >= endExclusive) fail('Collection periods must fall inside calendar 2025.')
  if (!Array.isArray(row.evidenceIds) || row.evidenceIds.length > 20) fail()
  const evidenceIds = (row.evidenceIds as unknown[]).map(uuid)
  if (new Set(evidenceIds).size !== evidenceIds.length) fail()
  const payload=validatePayload(kind,row.payload)
  const supportedUnits:Record<CollectionActivityKind,readonly string[]>={natural_gas:['therm','MMBtu','scf','ccf','mcf'],distillate_no2:['US_gallon'],vehicle:['US_gallon'],fugitive:['kg','lb'],electricity:['kWh','MWh']}
  if(normalizedUnit!==null&&!supportedUnits[kind].includes(normalizedUnit))fail('Only engine unit tokens may be normalized; unsupported units remain saved with null normalized fields.')
  if(kind==='electricity'&&!(payload as ElectricityCollectionPayload).instruments.every(i=>i.evidenceReference===null||evidenceIds.includes(i.evidenceReference)))fail('Instrument evidence must be linked to the activity version.')
  return { kind, quantity:{originalValue,originalUnit:text(q.originalUnit,80),normalizedValue,normalizedUnit}, quality, estimateBasis, period:{start,endExclusive}, reference:text(row.reference,1000), notes:text(row.notes,4000), evidenceIds, payload } as CollectionActivity
}

export function validateCollectionSaveInput(value: unknown): CollectionActivitySaveInput {
  const row = object(value, ['idempotencyKey','expectedRevision','expectedVersionId','correctionReason','activity'])
  uuid(row.idempotencyKey)
  if (!Number.isInteger(row.expectedRevision) || (row.expectedRevision as number) < 0 || (row.expectedRevision as number) > 1000) fail()
  if (!(row.expectedVersionId === null || typeof row.expectedVersionId === 'string' && UUID.test(row.expectedVersionId))) fail()
  const correctionReason = nullableText(row.correctionReason,2000)
  if ((row.expectedRevision === 0) !== (row.expectedVersionId === null) || (row.expectedRevision === 0 ? correctionReason !== null : !correctionReason?.trim())) fail()
  return { idempotencyKey:row.idempotencyKey as string, expectedRevision:row.expectedRevision as number, expectedVersionId:row.expectedVersionId as string|null, correctionReason, activity:validateCollectionActivity(row.activity) }
}

export function validateCollectionEvidenceUpload(value: unknown, companyId: string): CollectionEvidenceUploadInput {
  const row = object(value, ['uploadId','evidenceId','objectKey','originalName','mediaType','byteLength','sha256'])
  uuid(row.uploadId); uuid(row.evidenceId)
  const objectKey = text(row.objectKey,500,false)
  if (!objectKey.startsWith(`${companyId}/original/`) || objectKey.includes('..') || objectKey.includes('\\')) fail('Evidence object key must stay in its company prefix.')
  if (!Number.isInteger(row.byteLength) || (row.byteLength as number) < 1 || (row.byteLength as number) > COLLECTION_EVIDENCE_MAX_BYTES || typeof row.sha256 !== 'string' || !SHA256.test(row.sha256)) fail()
  return { uploadId:row.uploadId as string, evidenceId:row.evidenceId as string, objectKey, originalName:text(row.originalName,255,false), mediaType:enumeration(row.mediaType,['application/pdf','image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] as const), byteLength:row.byteLength as number, sha256:row.sha256 as string }
}
