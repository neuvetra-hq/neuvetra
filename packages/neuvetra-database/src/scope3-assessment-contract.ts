/**
 * Scope 3 category assessments (Scope 3 completion I-02; Claude, 30 October 2026; DESIGN §3.5, A9, D5). Browser-safe; it
 * imports only constants of the (equally import-free) collection contract.
 *
 * The screening decision (included, excluded, not relevant) stays in company setup (0023). An assessment is the
 * structured record behind it, versioned per company and category in `neuvetra.scope3_category_assessments` (0030): the
 * reason code, the GHG Protocol Scope 3 Standard Table 6.1 relevance criteria, what the category covers, the
 * justification, an estimated magnitude or the reason it can't be quantified, the method types planned, and evidence.
 * Missing structure is disclosed (coverage, I-04), never a block. `validateScope3Assessment` refuses exactly what 0030's
 * `scope3_assert_assessment` refuses; lengths count characters (code points) as PostgreSQL does.
 *
 * I-02b (DESIGN §11, AM-03, AM-17): an assessment belongs to a reporting year (the year in which the setup version's
 * reporting period ends; 0030 refuses any other year with 22023), so screening is per inventory year; revisions and the
 * heads view are per company, year and category. It may also document within-category exclusions: only the
 * allow-listed partial-boundary notes, each with a justification and a magnitude (DESIGN A26).
 */
import { SCOPE3_EXCLUDABLE_NOTES, SCOPE3_YEAR_MAX, SCOPE3_YEAR_MIN } from './scope3-collection-contract'

export const SCOPE3_ASSESSMENT_PROFILE = 'neuvetra.scope3-assessment.v1' as const
/** The five method types (DESIGN A2): activity data with average factors, spend-based, supplier-specific, partner-reported, proxy. */
export const SCOPE3_METHOD_TYPES = ['activity_average_data', 'spend_based', 'supplier_specific', 'partner_reported', 'proxy'] as const
export type Scope3MethodType = typeof SCOPE3_METHOD_TYPES[number]
/** Reason codes for a category screened as not relevant (not applicable to the company). */
export const SCOPE3_NOT_RELEVANT_REASON_CODES = [
  'no_leased_assets', 'leases_in_scope1_2_by_boundary', 'lessor_assets_in_scope1_2', 'no_sold_physical_products', 'no_intermediate_products_sold',
  'no_energy_or_ghg_use_phase', 'not_franchisor', 'no_required_investment_types', 'no_transport_or_distribution', 'other',
] as const
/** Reason codes for a relevant category the company excludes (Scope 3 Standard §6.4 and 7.1). */
export const SCOPE3_EXCLUDED_REASON_CODES = ['immaterial_estimated', 'data_unavailable', 'intermediate_unknown_end_use', 'other'] as const
export const SCOPE3_ASSESSMENT_REASON_CODES = [...new Set<string>([...SCOPE3_NOT_RELEVANT_REASON_CODES, ...SCOPE3_EXCLUDED_REASON_CODES])] as ReadonlyArray<
  typeof SCOPE3_NOT_RELEVANT_REASON_CODES[number] | typeof SCOPE3_EXCLUDED_REASON_CODES[number]>
export type Scope3AssessmentReasonCode = typeof SCOPE3_ASSESSMENT_REASON_CODES[number]
/** Scope 3 Standard Table 6.1. */
export const SCOPE3_RELEVANCE_CRITERIA = ['size', 'influence', 'risk', 'stakeholders', 'outsourcing', 'sectorGuidance', 'other'] as const
export type Scope3RelevanceCriteria = Record<typeof SCOPE3_RELEVANCE_CRITERIA[number], boolean> & { otherText: string }

/** A documented within-category exclusion (AM-17): a magnitude estimate in t CO2e, or not quantifiable. A user statement, never added to any total. */
export interface Scope3WithinCategoryExclusion {
  noteCode: typeof SCOPE3_EXCLUDABLE_NOTES[number]
  justification: string
  magnitudeKind: 'estimated' | 'not_quantifiable'
  magnitudeTCo2e: string | null
  basis: string
}
export interface Scope3Assessment {
  category: number
  /** I-02b (AM-03): the inventory year; it must be the year of the setup version's reporting period (`scope3ReportingYearOf`). */
  reportingYear: number
  /** The company setup version the user saw; the database requires it to be the current one. */
  setupVersionId: string
  reasonCode: Scope3AssessmentReasonCode | null
  criteria: Scope3RelevanceCriteria
  activitiesIncluded: string
  justification: string
  /** An estimated magnitude (t CO2e, a user statement, never added to any total), or the reason it can't be quantified. */
  magnitudeKind: 'estimated' | 'not_quantifiable' | null
  magnitudeTCo2e: string | null
  magnitudeBasis: string
  notQuantifiableReason: string
  plannedMethodTypes: Scope3MethodType[]
  /** Category 3 only: whether the company resells purchased energy (3D applies). */
  energyResale: 'none' | 'resells_energy' | null
  evidenceIds: string[]
  /** I-02b (AM-17): at most 20, one per note code. */
  withinCategoryExclusions: Scope3WithinCategoryExclusion[]
}
export interface Scope3AssessmentSaveInput { idempotencyKey: string; expectedRevision: number; correctionReason: string | null; assessment: Scope3Assessment }

const NOT_STORABLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ud800-\udfff]/u
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DEC3 = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/
const fail = (label: string): never => { throw new Error(`Invalid Scope 3 assessment: ${label}.`) }
const characters = (text: string) => [...text].length
const spaceTrimmed = (text: string) => text.replace(/^ +| +$/g, '')
function exact(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label)
  const own = Object.keys(value as object)
  if (own.length !== keys.length || own.some(key => !keys.includes(key))) fail(label)
  return value as Record<string, unknown>
}
function text(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string' || characters(value) > max || characters(spaceTrimmed(value)) < min || NOT_STORABLE.test(value)) fail(label)
  return value as string
}
function choice<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) fail(label)
  return value as T
}
function uuids(value: unknown, max: number, label: string): string[] {
  if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== 'string' || !UUID.test(item)) || new Set(value).size !== value.length) fail(label)
  return [...value as string[]]
}

/** [scope3_assert_within_category_exclusions] AM-17. */
function withinCategoryExclusions(value: unknown): Scope3WithinCategoryExclusion[] {
  if (!Array.isArray(value) || value.length > 20) fail('within-category exclusions')
  const out = (value as unknown[]).map(item => {
    const e = exact(item, ['noteCode', 'justification', 'magnitudeKind', 'magnitudeTCo2e', 'basis'], 'within-category exclusion')
    const magnitudeKind = choice(e.magnitudeKind, ['estimated', 'not_quantifiable'] as const, 'within-category exclusion magnitude kind')
    if (e.magnitudeTCo2e !== null && (typeof e.magnitudeTCo2e !== 'string' || !DEC3.test(e.magnitudeTCo2e))) fail('within-category exclusion magnitude')
    if ((magnitudeKind === 'estimated') !== (e.magnitudeTCo2e !== null)) fail('an estimated exclusion has a magnitude, and only an estimate')
    return { noteCode: choice(e.noteCode, SCOPE3_EXCLUDABLE_NOTES, 'within-category exclusion note'), justification: text(e.justification, 'within-category exclusion justification', 3, 1000),
      magnitudeKind, magnitudeTCo2e: e.magnitudeTCo2e as string | null, basis: text(e.basis, 'within-category exclusion basis', 0, 1000) }
  })
  if (new Set(out.map(e => e.noteCode)).size !== out.length) fail('one exclusion per note')
  return out
}
const reportingYear = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < SCOPE3_YEAR_MIN || value > SCOPE3_YEAR_MAX) fail('reporting year')
  return value as number
}

export function validateScope3Assessment(value: unknown): Scope3Assessment {
  const a = exact(value, ['category', 'reportingYear', 'setupVersionId', 'reasonCode', 'criteria', 'activitiesIncluded', 'justification', 'magnitudeKind', 'magnitudeTCo2e', 'magnitudeBasis', 'notQuantifiableReason', 'plannedMethodTypes', 'energyResale', 'evidenceIds', 'withinCategoryExclusions'], 'fields')
  if (typeof a.category !== 'number' || !Number.isSafeInteger(a.category) || a.category < 1 || a.category > 15) fail('category')
  if (typeof a.setupVersionId !== 'string' || !UUID.test(a.setupVersionId)) fail('setup version')
  const reasonCode = a.reasonCode === null ? null : choice(a.reasonCode, SCOPE3_ASSESSMENT_REASON_CODES, 'reason code')
  const c = exact(a.criteria, [...SCOPE3_RELEVANCE_CRITERIA, 'otherText'], 'relevance criteria')
  for (const name of SCOPE3_RELEVANCE_CRITERIA) if (typeof c[name] !== 'boolean') fail('relevance criteria')
  const otherText = text(c.otherText, 'other criterion', 0, 300)
  if (c.other === false && otherText !== '') fail('other criterion')
  const magnitudeKind = a.magnitudeKind === null ? null : choice(a.magnitudeKind, ['estimated', 'not_quantifiable'] as const, 'magnitude kind')
  if (a.magnitudeTCo2e !== null && (typeof a.magnitudeTCo2e !== 'string' || !DEC3.test(a.magnitudeTCo2e))) fail('estimated magnitude')
  if ((magnitudeKind === 'estimated') !== (a.magnitudeTCo2e !== null)) fail('an estimate has a magnitude, and only an estimate')
  const magnitudeBasis = text(a.magnitudeBasis, 'magnitude basis', 0, 1000)
  if (magnitudeKind !== 'estimated' && magnitudeBasis !== '') fail('only an estimate has a basis')
  const notQuantifiableReason = magnitudeKind === 'not_quantifiable' ? text(a.notQuantifiableReason, 'not-quantifiable reason', 3, 1000) : text(a.notQuantifiableReason, 'not-quantifiable reason', 0, 0)
  if (!Array.isArray(a.plannedMethodTypes) || a.plannedMethodTypes.length > 5 || new Set(a.plannedMethodTypes).size !== a.plannedMethodTypes.length) fail('planned method types')
  const plannedMethodTypes = (a.plannedMethodTypes as unknown[]).map(type => choice(type, SCOPE3_METHOD_TYPES, 'planned method types'))
  const energyResale = a.energyResale === null ? null : choice(a.energyResale, ['none', 'resells_energy'] as const, 'energy resale')
  if (energyResale !== null && a.category !== 3) fail('energy resale is a category 3 question')
  return {
    category: a.category as number, reportingYear: reportingYear(a.reportingYear), setupVersionId: a.setupVersionId as string, reasonCode,
    criteria: { ...Object.fromEntries(SCOPE3_RELEVANCE_CRITERIA.map(name => [name, c[name] as boolean])), otherText } as Scope3RelevanceCriteria,
    activitiesIncluded: text(a.activitiesIncluded, 'activities included', 0, 2000), justification: text(a.justification, 'justification', 0, 4000),
    magnitudeKind, magnitudeTCo2e: a.magnitudeTCo2e as string | null, magnitudeBasis, notQuantifiableReason, plannedMethodTypes, energyResale,
    evidenceIds: uuids(a.evidenceIds, 20, 'evidence list'), withinCategoryExclusions: withinCategoryExclusions(a.withinCategoryExclusions),
  }
}

export function validateScope3AssessmentSaveInput(value: unknown): Scope3AssessmentSaveInput {
  const r = exact(value, ['idempotencyKey', 'expectedRevision', 'correctionReason', 'assessment'], 'request')
  if (typeof r.idempotencyKey !== 'string' || !UUID.test(r.idempotencyKey)) fail('idempotency key')
  if (typeof r.expectedRevision !== 'number' || !Number.isSafeInteger(r.expectedRevision) || r.expectedRevision < 0 || r.expectedRevision > 9999) fail('expected revision')
  const correctionReason = r.correctionReason === null ? null : text(r.correctionReason, 'correction reason', 0, 2000)
  // The first revision has no correction reason; every later one needs one of at least 3 characters (0030 checks it too).
  if (r.expectedRevision === 0 ? correctionReason !== null : correctionReason === null || characters(spaceTrimmed(correctionReason)) < 3) fail('correction reason')
  return { idempotencyKey: r.idempotencyKey as string, expectedRevision: r.expectedRevision as number, correctionReason, assessment: validateScope3Assessment(r.assessment) }
}

/** Reason codes offered for a decision (the UI filter; the database accepts any listed code). */
export function scope3ReasonCodesFor(decision: 'excluded' | 'not_relevant'): readonly string[] {
  return decision === 'excluded' ? SCOPE3_EXCLUDED_REASON_CODES : SCOPE3_NOT_RELEVANT_REASON_CODES
}

// --- I-02b: the reporting year (AM-03) and the report requests that carry it.

/**
 * [scope3_assert_reporting_year] The reporting year of a setup version: the calendar year of the last day of its
 * reporting period (`period_end_exclusive` minus one day), so a fiscal year ending 30 June 2026 is 2026 and a calendar
 * 2025 period (ending exclusive 1 January 2026) is 2025. Null when the period end is not set. `periodEndExclusive` is a
 * YYYY-MM-DD date.
 */
export function scope3ReportingYearOf(periodEndExclusive: string | null): number | null {
  if (periodEndExclusive === null) return null
  const end = new Date(`${periodEndExclusive}T00:00:00.000Z`)
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(periodEndExclusive) || Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== periodEndExclusive) throw new Error('Invalid reporting period end.')
  return new Date(end.getTime() - 86_400_000).getUTCFullYear()
}
/**
 * `prepare_scope3_report` (DESIGN §3.7, AM-03): revisions, the expected revision and the previous version are per
 * company and reporting year; the year must be the setup version's (22023 otherwise).
 */
export interface Scope3ReportPrepareRequest {
  idempotencyKey: string; expectedRevision: number; reason: string | null; reportingYear: number
  /** Round 3: the company the report is about (0030 checks it against the call's company and the report text). */
  companyId: string
  reportSha256: string; csvSha256: string; engineSha256: string
  registerSha256s: Record<string, string>; inputVersionIds: string[]; setupVersionId: string
  /** Round 3 (owner decision 6): the frozen results' readiness, sent beside the texts so 0030 never parses the report. */
  readiness: { ready: boolean; openIssues: Array<{ category: number; code: string }> }
  /** Round 3 (EN-5): the assessments the results used (the latest of each category of the year), sorted. */
  assessmentIds: string[]
  /** Round 3 (EN-5): the files linked by the input versions that the results saw rejected, sorted (rejection is terminal). */
  rejectedEvidenceIds: string[]
  /** Round 3 (EN-5): the approved version the change log compares with (the year's latest approved), or null. */
  previousApprovedVersionId: string | null
  /** Round 3 (owner decision 6): this version's change-log basis (canonical JSON), which the next version's change log reads. */
  changeLogBasis: string
}
/**
 * Round 3 (owner decision 6): a prepare call. The two texts travel as plain text parameters beside the small request (never
 * inside a jsonb), so neither the API nor PostgreSQL serialises, parses or copies a 160 MB request.
 */
export interface Scope3ReportPrepareCall { request: Scope3ReportPrepareRequest; reportText: string; csvText: string }
/**
 * `approve_scope3_report`: the version and the report hash the approver saw. Round 2 (owner decision 7): an explicit
 * acknowledgement of the version's open issues (required exactly when it has some) and an explicit self-approval
 * confirmation (required exactly when the approver prepared it).
 */
export interface Scope3ReportApproveRequest { versionId: string; reportSha256: string; acknowledgeOpenIssues: boolean; confirmSelfApproval: boolean }
/**
 * Round 2 (owner decision 10, ENG-3): 0030's limit on a stored report text and CSV text (each), measured against the line cap.
 * Round 2c integration (owner decision, 31 October 2026): 128 MiB. 64 MiB was not enough for every company at the line cap:
 * 3,000 ten-mode average commuting records with every free-text field at its maximum, 20 evidence files each and the
 * longest numbers freeze as 83,903,788 bytes of report text and 68,205,657 of CSV (DESIGN 13.8).
 */
export const SCOPE3_REPORT_MAX_TEXT_BYTES = 134_217_728
/**
 * Round 3 (owner decision 6): 0030's limit on the prepare request's text form (`octet_length(request::text)`), 4 MiB. The
 * texts no longer travel in the request (round 2c's 255 MiB bound them together inside one jsonb); what is left is small
 * (at most 20,000 input version ids, about 0.8 MB). `scope3ReportDraft` refuses a larger one before any call.
 */
export const SCOPE3_REPORT_MAX_REQUEST_BYTES = 4_194_304
export const SCOPE3_REPORT_REQUEST_SLACK_BYTES = 65_536

// --- I-04: a saved assessment as the database returns it (one head per company, reporting year and category).

/** One saved revision of a category assessment: the assessment plus its version metadata (0030 `scope3_category_assessments`). */
export interface Scope3AssessmentRecord extends Scope3Assessment {
  id: string
  companyId: string
  revision: number
  previousId: string | null
  correctionReason: string | null
  createdBy: string
  createdAt: string
}
export const SCOPE3_ASSESSMENT_RECORD_META = ['id', 'companyId', 'revision', 'previousId', 'correctionReason', 'createdBy', 'createdAt'] as const
const ASSESSMENT_KEYS = ['category', 'reportingYear', 'setupVersionId', 'reasonCode', 'criteria', 'activitiesIncluded', 'justification', 'magnitudeKind', 'magnitudeTCo2e', 'magnitudeBasis', 'notQuantifiableReason', 'plannedMethodTypes', 'energyResale', 'evidenceIds', 'withinCategoryExclusions'] as const

/**
 * A saved assessment revision, checked exactly: the assessment fields by `validateScope3Assessment` (what 0030 accepted),
 * and the revision chain 0030 enforces (revision 1 has no previous revision and no correction reason; every later one
 * has both). Used by the database reader, the results decoder and the setup screen, so all three refuse the same things.
 */
export function validateScope3AssessmentRecord(value: unknown, companyId?: string): Scope3AssessmentRecord {
  const r = exact(value, [...ASSESSMENT_KEYS, ...SCOPE3_ASSESSMENT_RECORD_META], 'saved assessment')
  const assessment = validateScope3Assessment(Object.fromEntries(ASSESSMENT_KEYS.map(key => [key, r[key]])))
  for (const key of ['id', 'companyId', 'createdBy'] as const) if (typeof r[key] !== 'string' || !UUID.test(r[key] as string)) fail('saved assessment identity')
  if (companyId !== undefined && r.companyId !== companyId) fail('saved assessment company')
  if (typeof r.revision !== 'number' || !Number.isSafeInteger(r.revision) || r.revision < 1 || r.revision > 1000) fail('saved assessment revision')
  if (r.revision === 1 ? r.previousId !== null || r.correctionReason !== null
    : typeof r.previousId !== 'string' || !UUID.test(r.previousId) || typeof r.correctionReason !== 'string' || characters(spaceTrimmed(r.correctionReason)) < 3 || characters(r.correctionReason) > 2000) fail('saved assessment revision chain')
  if (typeof r.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.createdAt) || Number.isNaN(Date.parse(r.createdAt))) fail('saved assessment time')
  return { ...assessment, id: r.id as string, companyId: r.companyId as string, revision: r.revision as number, previousId: r.previousId as string | null,
    correctionReason: r.correctionReason as string | null, createdBy: r.createdBy as string, createdAt: r.createdAt as string }
}
