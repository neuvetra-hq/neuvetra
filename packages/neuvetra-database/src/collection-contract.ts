import type { CompanySetup } from './company-setup-contract'
import {
  SCOPE3_COLLECTION_KINDS, SCOPE3_COLLECTION_UNITS, isScope3CollectionKind, validateScope3Payload, type BusinessTravelCollectionPayload, type CommutingCollectionPayload, type Scope3CollectionKind,
  type Scope3CompletionPayload, type Scope3PayloadByKind, type TransportCollectionPayload, type WasteCollectionPayload,
} from './scope3-collection-contract'

export const COLLECTION_PROFILE = 'neuvetra.collection.v1' as const
export const COLLECTION_EVIDENCE_BUCKET = 'neuvetra-private-company-evidence' as const
export const COLLECTION_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024

export type CollectionQuality = 'actual' | 'estimated' | 'unknown'
/** Scope 1 and 2 kinds (0027). */
export type CollectionScope12Kind = 'natural_gas' | 'distillate_no2' | 'vehicle' | 'fugitive' | 'electricity'
export const COLLECTION_SCOPE12_KINDS: readonly CollectionScope12Kind[] = ['natural_gas', 'distillate_no2', 'vehicle', 'fugitive', 'electricity']
/** Every stored kind: Scope 1 and 2 (0027), the four Scope 3 kinds of 0029 (Scope 3 package 2) and the thirteen of 0030 (Scope 3 completion I-02). */
export type CollectionActivityKind = CollectionScope12Kind | Scope3CollectionKind
/** The scope a stored kind belongs to, as the save function (0029, 0030) records it. */
export const collectionScope = (kind: CollectionActivityKind): 1 | 2 | 3 => isScope3CollectionKind(kind) ? 3 : kind === 'electricity' ? 2 : 1
/** I-02: narrows an activity to the Scope 3 kinds (every kind of 0029 and 0030), so Scope 1 and 2 code can set them aside. */
export const isScope3Activity = <T extends { kind: string }>(activity: T): activity is Extract<T, { kind: Scope3CollectionKind }> => isScope3CollectionKind(activity.kind)
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
  /**
   * BF-18 (0032), for BF-11: the certificate or contract identity, each optional and absent on every instrument saved before
   * 0032. `instrumentId`: the certificate serial or serial range, or the contract's settlement statement or retirement record
   * (1-120 characters, not blank, no control character); `registry`: 1-80 such characters, or null; `faceMwh`: the MWh the
   * document conveys, a QUANTITY decimal above 0. Stored as given (the ledger normalises). A database below schema 32 refuses
   * them, so the route refuses such a save first (`scope12PayloadAvailable`).
   */
  instrumentId?: string
  registry?: string | null
  faceMwh?: string
}
/**
 * BF-09 (0031): a Scope 1 or 2 payload may carry `duplicateConfirmedDistinct`, the user's confirmation that a record flagged as
 * a possible duplicate is a different record. Optional: absent (as every record saved before 0031), true or false. Storage and
 * validation only; nothing reads it yet. A database below schema 31 refuses the key, so the route refuses such a save first
 * (`scope12PayloadAvailable`), and the web must not send it while the server reports schema 30.
 */
export type DuplicateConfirmation = { duplicateConfirmedDistinct?: boolean }
export type NaturalGasCollectionPayload = DuplicateConfirmation & { heatContent: null | { value: string; unit: 'MMBtu per scf' | 'MMBtu per ccf' | 'MMBtu per mcf' | 'therm per ccf' } }
export type DistillateCollectionPayload = DuplicateConfirmation & { consumption: { basis: 'measured'; gallons: string } | { basis: 'purchases_with_tank_levels'; purchasedGallons: string; openingGallons: string; closingGallons: string } | { basis: 'purchases_only'; purchasedGallons: string }; statedHhvMmbtuPerGallon: string | null }
export type VehicleCollectionPayload = DuplicateConfirmation & { vehicleGroupId: string; fuel: string; vehicleType: string; modelYear: number; gallons: string; vehicleCount: number | null; miles: null | { value: string; basis: string }; fuelEconomy: null | { mpg: string; source: string } }
export type FugitiveCollectionPayload = DuplicateConfirmation & { gas: 'HFC-134a' | 'HFC-227ea' | 'R-404A' | 'R-407C' | 'R-410A' | 'R-507A' | 'R-22' | 'R-12' | 'R-502'; unit: 'kg' | 'lb'; terms: { PN: string; CN: string; PS: string; CD: string; RD: string }; insideBoundary: boolean | null; maintainsRefrigerantStock: boolean | null; retrofitInPeriod: boolean | null; contractorRecordsComplete: boolean; eventChronologyComplete: boolean }
export type ElectricityCollectionPayload = DuplicateConfirmation & { meterOrAccountNumber: string; utilityName: string; site: string; zip: string; subregion: string; utilityEiaId: string | null; instruments: CollectionInstrument[] }
export type CollectionPayload = NaturalGasCollectionPayload | DistillateCollectionPayload | VehicleCollectionPayload | FugitiveCollectionPayload | ElectricityCollectionPayload
  | TransportCollectionPayload | WasteCollectionPayload | BusinessTravelCollectionPayload | CommutingCollectionPayload | Scope3CompletionPayload

export interface CollectionContext {
  companyId: string
  setupVersionId: string | null
  setupRevision: number | null
  /** Older servers omit boundary metadata; calculations then hold until it is available. */
  boundaryApproach?: CompanySetup['boundary']['approach']
  reportingPeriod?: Pick<CompanySetup['reportingPeriod'], 'start' | 'endExclusive'>
  locations: Array<{ id: string; name: string; inclusion: 'unknown' | 'included' | 'excluded'; control: string;
    entityId?: string | null; entity?: Pick<CompanySetup['entities'][number], 'id' | 'inclusion' | 'control' | 'ownershipPercent'> | null;
    start?: string | null; endExclusive?: string | null; startMode?: 'unknown' | 'period_start' | 'specific'; endMode?: 'unknown' | 'period_end' | 'specific' }>
  /**
   * BF2: every setup version whose saved content (payload SHA-256) equals the current version's, the current one included.
   * A version restored byte for byte, for example after a temporary period change, is the same setup. Absent (an older
   * server): only `setupVersionId` itself counts as current.
   */
  sameContentSetupVersionIds?: string[]
}

/**
 * BF2: whether a record was saved against the current company setup. Setup content is compared, not version IDs, so a
 * record saved before an identical restore is not flagged as saved against an earlier setup.
 */
export function savedAgainstCurrentSetup(setupVersionId: string, context: Pick<CollectionContext, 'setupVersionId' | 'sameContentSetupVersionIds'>): boolean {
  if (context.setupVersionId === null) return false
  return setupVersionId === context.setupVersionId || (context.sameContentSetupVersionIds ?? []).includes(setupVersionId)
}

/**
 * BF2: a record saved against a setup version with the current content, at a site the current setup still has, is saved
 * again against the current version (the database accepts only the current one); the site doesn't have to be chosen again.
 */
export function withCurrentSetupVersion<T extends { setupVersionId: string; locationId: string }>(activity: T, context: Pick<CollectionContext, 'setupVersionId' | 'sameContentSetupVersionIds' | 'locations'> | null): T {
  if (!context?.setupVersionId || activity.setupVersionId === context.setupVersionId) return activity
  if (!savedAgainstCurrentSetup(activity.setupVersionId, context) || !context.locations.some(location => location.id === activity.locationId)) return activity
  return { ...activity, setupVersionId: context.setupVersionId }
}
interface CollectionActivityCommon {
  locationId: string
  setupVersionId: string
  sourceId: string
  state: 'active' | 'withdrawn'
  withdrawalReason: string | null
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
  | {kind:'transport';payload:TransportCollectionPayload}
  | {kind:'waste';payload:WasteCollectionPayload}
  | {kind:'business_travel';payload:BusinessTravelCollectionPayload}
  | {kind:'employee_commuting';payload:CommutingCollectionPayload}
  | { [K in Exclude<Scope3CollectionKind, 'transport' | 'waste' | 'business_travel' | 'employee_commuting'>]: { kind: K; payload: Scope3PayloadByKind[K] } }[Exclude<Scope3CollectionKind, 'transport' | 'waste' | 'business_travel' | 'employee_commuting'>]
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
export interface CollectionEvidenceUploadIntent {
  uploadId: string
  evidenceId: string
  objectKey: string
  bucket: typeof COLLECTION_EVIDENCE_BUCKET
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
const STATED_HHV_DECIMAL = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/
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
const numericInput = (value: unknown): string => text(value,100)
const nullableDecimal = (value: unknown): string | null => value === null ? null : decimal(value)
const nullableStatedHhv = (value: unknown): string | null => value === null ? null : typeof value === 'string' && value === value.trim() && STATED_HHV_DECIMAL.test(value) ? value : fail('Stated HHV allows 12 integer digits and 6 fractional digits.')
const uuid = (value: unknown): string => typeof value === 'string' && UUID.test(value) ? value : fail()
const nullableText = (value: unknown, max: number): string | null => value === null ? null : text(value, max)
const enumeration = <T extends string>(value: unknown, allowed: readonly T[]): T => typeof value === 'string' && allowed.includes(value as T) ? value as T : fail()
const calendarDate = (value: unknown): string => {
  if (typeof value !== 'string' || !DATE.test(value) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) fail('A real calendar date is required.')
  return value as string
}
const nullableBoolean = (value: unknown): boolean | null => value === null || typeof value === 'boolean' ? value : fail('Unknown yes/no answers must be null.')

function validateInstrument(value: unknown): CollectionInstrument {
  // BF-18 (0032): the optional identity keys are checked below and the seven keys of 0027 without them, as 0032 does.
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  const { instrumentId, registry, faceMwh: face, ...base } = value as Record<string, unknown>
  const identity = Object.fromEntries(Object.entries({ instrumentId, registry, faceMwh: face }).filter(([key]) => Object.prototype.hasOwnProperty.call(value, key)))
  const row = object(base, ['type','mwh','qualityCriteriaMet','vintageYear','evidenceReference','generationTechnology','rateLbPerMwh'])
  const type = enumeration(row.type, ['energy_attribute_certificate','power_purchase_agreement','green_tariff','supplier_specific_rate'] as const)
  const technology = enumeration(row.generationTechnology, ['wind','solar_photovoltaic','hydro','nuclear','geothermal','natural_gas','coal','oil','biomass','biogas','landfill_gas','mixed','unknown'] as const)
  if (typeof row.qualityCriteriaMet !== 'boolean' || !Number.isInteger(row.vintageYear) || (row.vintageYear as number) < 1000 || (row.vintageYear as number) > 9999) fail()
  let rate: CollectionInstrument['rateLbPerMwh'] = null
  if (row.rateLbPerMwh !== null) {
    const r = object(row.rateLbPerMwh, ['co2','ch4','n2o'])
    rate = { co2: numericInput(r.co2), ch4: r.ch4===null?null:numericInput(r.ch4), n2o: r.n2o===null?null:numericInput(r.n2o) }
  }
  const instrument: CollectionInstrument = { type, mwh: numericInput(row.mwh), qualityCriteriaMet: row.qualityCriteriaMet as boolean, vintageYear: row.vintageYear as number, evidenceReference: row.evidenceReference===null?null:uuid(row.evidenceReference), generationTechnology: technology, rateLbPerMwh: rate }
  // BF-18 (0032): each identity key kept present only when sent, so a saved payload reads back byte for byte.
  if (Object.prototype.hasOwnProperty.call(identity, 'instrumentId')) instrument.instrumentId = identityText(identity.instrumentId, 120)
  if (Object.prototype.hasOwnProperty.call(identity, 'registry')) instrument.registry = identity.registry === null ? null : identityText(identity.registry, 80)
  if (Object.prototype.hasOwnProperty.call(identity, 'faceMwh')) instrument.faceMwh = faceMwh(identity.faceMwh)
  return instrument
}
/** BF-18 (0032): identity text is collection text with no control character at all (tab and line breaks included). */
const identityText = (value: unknown, max: number): string => {
  const valid = text(value, max, false)
  return /[\u0000-\u001f\u007f-\u009f]/u.test(valid) ? fail() : valid
}
/** BF-18 (0032): a QUANTITY decimal (12 integer and 3 fractional digits) above 0. */
const faceMwh = (value: unknown): string => {
  const valid = decimal(value)
  return /^0(\.0+)?$/.test(valid) ? fail('The face value of a certificate or contract must be above 0 MWh.') : valid
}

function validatePayload(kind: CollectionActivityKind, value: unknown): CollectionPayload {
  if (isScope3CollectionKind(kind)) {
    try { return validateScope3Payload(kind, value) } catch { return fail() }
  }
  // BF-09: the optional confirmation is validated here and the kind's own key list is checked without it, as 0031 does.
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  const { duplicateConfirmedDistinct, ...rest } = value as Record<string, unknown>
  const confirmed = Object.prototype.hasOwnProperty.call(value, 'duplicateConfirmedDistinct')
  if (confirmed && typeof duplicateConfirmedDistinct !== 'boolean') fail()
  const payload = validateScope12Payload(kind, rest)
  return confirmed ? { ...payload, duplicateConfirmedDistinct: duplicateConfirmedDistinct as boolean } : payload
}

function validateScope12Payload(kind: CollectionScope12Kind, value: unknown): CollectionPayload {
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
    return { consumption, statedHhvMmbtuPerGallon: nullableStatedHhv(p.statedHhvMmbtuPerGallon) }
  }
  if (kind === 'vehicle') {
    const p = object(value, ['vehicleGroupId','fuel','vehicleType','modelYear','gallons','vehicleCount','miles','fuelEconomy'])
    if (!Number.isInteger(p.modelYear) || (p.modelYear as number) < 1900 || (p.modelYear as number) > 2026 || !(p.vehicleCount === null || Number.isSafeInteger(p.vehicleCount) && (p.vehicleCount as number) > 0)) fail()
    const miles = p.miles === null ? null : object(p.miles, ['value','basis'])
    const economy = p.fuelEconomy === null ? null : object(p.fuelEconomy, ['mpg','source'])
    return { vehicleGroupId:text(p.vehicleGroupId,120,false), fuel: text(p.fuel,80,false), vehicleType: text(p.vehicleType,120,false), modelYear:p.modelYear as number, gallons:numericInput(p.gallons), vehicleCount:p.vehicleCount as number|null, miles:miles?{value:numericInput(miles.value),basis:text(miles.basis,500)}:null, fuelEconomy:economy?{mpg:numericInput(economy.mpg),source:text(economy.source,500)}:null }
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
  const row = object(value, ['kind','locationId','setupVersionId','sourceId','state','withdrawalReason','quantity','quality','estimateBasis','period','reference','notes','evidenceIds','payload'])
  const kind = enumeration(row.kind, [...COLLECTION_SCOPE12_KINDS, ...SCOPE3_COLLECTION_KINDS] as const)
  const locationId=uuid(row.locationId), setupVersionId=uuid(row.setupVersionId), sourceId=text(row.sourceId,120,false)
  const state=enumeration(row.state,['active','withdrawn'] as const), withdrawalReason=nullableText(row.withdrawalReason,2000)
  if(state==='withdrawn' ? !withdrawalReason || withdrawalReason.trim().length<3 : withdrawalReason!==null)fail('Withdrawal requires a reason.')
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
  // Round 2 (owner decision 1): a Scope 3 record may cover 2025 or 2026 (FY2026, fiscal years spanning two calendar years); Scope 1
  // and 2 records keep calendar 2025. The adapter applies setup's reporting period (else calendar 2025) before calculating.
  if ((SCOPE3_COLLECTION_KINDS as readonly string[]).includes(kind)) {
    if (start < '2025-01-01' || endExclusive > '2027-01-01' || start >= endExclusive) fail('Scope 3 periods must fall between 1 January 2025 and 31 December 2026.')
  } else if (start < '2025-01-01' || endExclusive > '2026-01-01' || start >= endExclusive) fail('Collection periods must fall inside calendar 2025.')
  if (!Array.isArray(row.evidenceIds) || row.evidenceIds.length > 20) fail()
  const evidenceIds = (row.evidenceIds as unknown[]).map(uuid)
  if (new Set(evidenceIds).size !== evidenceIds.length) fail()
  const payload=validatePayload(kind,row.payload)
  const supportedUnits:Record<CollectionActivityKind,readonly string[]>={natural_gas:['therm','MMBtu','scf','ccf','mcf'],distillate_no2:['US_gallon'],vehicle:['US_gallon'],fugitive:['kg','lb'],electricity:['kWh','MWh'],...SCOPE3_COLLECTION_UNITS}
  if(normalizedUnit!==null&&!supportedUnits[kind].includes(normalizedUnit))fail('Only engine unit tokens may be normalized; unsupported units remain saved with null normalized fields.')
  if(kind==='electricity'&&!(payload as ElectricityCollectionPayload).instruments.every(i=>i.evidenceReference===null||evidenceIds.includes(i.evidenceReference)))fail('Instrument evidence must be linked to the activity version.')
  if(kind==='vehicle' && (payload as VehicleCollectionPayload).vehicleGroupId!==sourceId || kind==='electricity' && (payload as ElectricityCollectionPayload).meterOrAccountNumber!==sourceId)fail('Source identifier must match the meter or vehicle group.')
  const submittedQuantity={originalValue,originalUnit:text(q.originalUnit,80),normalizedValue,normalizedUnit}
  if(kind==='fugitive' && (submittedQuantity.originalUnit!==(payload as FugitiveCollectionPayload).unit || normalizedUnit!==null && normalizedUnit!==(payload as FugitiveCollectionPayload).unit))fail('Refrigerant quantity unit must match the terms unit.')
  const quantity=deriveCollectionQuantity(kind,payload,submittedQuantity)
  return { kind, locationId, setupVersionId, sourceId, state, withdrawalReason, quantity, quality, estimateBasis, period:{start,endExclusive}, reference:text(row.reference,1000), notes:text(row.notes,4000), evidenceIds, payload } as CollectionActivity
}

export function validateCollectionSaveInput(value: unknown): CollectionActivitySaveInput {
  const row = object(value, ['idempotencyKey','expectedRevision','expectedVersionId','correctionReason','activity'])
  uuid(row.idempotencyKey)
  if (!Number.isInteger(row.expectedRevision) || (row.expectedRevision as number) < 0 || (row.expectedRevision as number) > 1000) fail()
  if (!(row.expectedVersionId === null || typeof row.expectedVersionId === 'string' && UUID.test(row.expectedVersionId))) fail()
  const correctionReason = nullableText(row.correctionReason,2000)
  if ((row.expectedRevision === 0) !== (row.expectedVersionId === null) || (row.expectedRevision === 0 ? correctionReason !== null : !correctionReason?.trim())) fail()
  if(row.expectedRevision===0 && (row.activity as CollectionActivity)?.state==='withdrawn')fail('Save a record before withdrawing it.')
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

/** Derive duplicate display quantities from source inputs using exact decimal arithmetic. */
export function deriveCollectionQuantity(kind:CollectionActivityKind,payload:CollectionPayload,submitted:CollectionQuantity):CollectionQuantity {
  let value:string
  let unit='US_gallon'
  if(kind==='vehicle')value=(payload as VehicleCollectionPayload).gallons
  else if(kind==='distillate_no2') {
    const c=(payload as DistillateCollectionPayload).consumption
    if(c.basis==='measured')value=c.gallons
    else if(c.basis==='purchases_only')value=c.purchasedGallons
    else {
      const values=[c.purchasedGallons,c.openingGallons,c.closingGallons]
      if(!values.every(v=>DECIMAL.test(v)))value=''
      else {
        const scaled=values.map(v=>{const [whole,fraction='']=v.split('.');return BigInt(whole!)*1000n+BigInt(fraction.padEnd(3,'0'))})
        const total=scaled[0]!+scaled[1]!-scaled[2]!
        value=total<0n?'':`${total/1000n}.${String(total%1000n).padStart(3,'0')}`
      }
    }
  } else if(kind==='fugitive') {
    const p=payload as FugitiveCollectionPayload
    unit=p.unit
    const values=[p.terms.PN,p.terms.CN,p.terms.PS,p.terms.CD,p.terms.RD]
    if(!values.every(v=>DECIMAL.test(v)))value=''
    else {
      const scaled=values.map(v=>{const [whole,fraction='']=v.split('.');return BigInt(whole!)*1000n+BigInt(fraction.padEnd(3,'0'))})
      const total=scaled[0]!-scaled[1]!+scaled[2]!+scaled[3]!-scaled[4]!
      value=total<0n?'':`${total/1000n}.${String(total%1000n).padStart(3,'0')}`
    }
  } else return submitted
  const normalized=DECIMAL.test(value)
  return {originalValue:value,originalUnit:unit,normalizedValue:normalized?value:null,normalizedUnit:normalized?unit:null}
}
