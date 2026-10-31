/**
 * Scope 3 category assessments: database access (Scope 3 completion I-04; Claude, 30 October 2026; DESIGN 3.5, 7.1, A9,
 * A24). Server-only. The structured screening record behind each setup decision lives in 0030's insert-only
 * `scope3_category_assessments`, one revision chain per company, reporting year and category; the heads view
 * (`security_invoker`) gives the latest revision of each, read under the caller's own company read policy.
 *
 * Every row read back is checked against the same contract the save used (`validateScope3AssessmentRecord`), so a row the
 * contract would refuse is an integrity failure, never shown. The caller supplies a transaction with the
 * server-authenticated JWT subject and the runtime role (HostedWorkspaceDatabase.asUser / asTrustedUser).
 */
import type { WorkspaceSql } from './workspace'
import { validateScope3AssessmentRecord, validateScope3AssessmentSaveInput, type Scope3AssessmentRecord } from './scope3-assessment-contract'
export type { Scope3Assessment, Scope3AssessmentRecord, Scope3AssessmentSaveInput } from './scope3-assessment-contract'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
type Row = {
  id: string; company_id: string; reporting_year: number; category: number; revision: number; previous_id: string | null; setup_version_id: string
  reason_code: string | null; criteria: unknown; activities_included: string; justification: string; magnitude_kind: string | null; magnitude_t_co2e: string | null
  magnitude_basis: string; not_quantifiable_reason: string; planned_method_types: unknown; energy_resale: string | null; evidence_ids: unknown
  within_category_exclusions: unknown; correction_reason: string | null; created_by: string; created_at: string
}
// Arrays as JSON, so the pg and PGlite drivers return the same shapes; the time as text, normalized below.
const COLUMNS = `id,company_id,reporting_year,category,revision,previous_id,setup_version_id,reason_code,criteria,activities_included,justification,magnitude_kind,
  magnitude_t_co2e,magnitude_basis,not_quantifiable_reason,to_jsonb(planned_method_types) planned_method_types,energy_resale,to_jsonb(evidence_ids) evidence_ids,
  within_category_exclusions,correction_reason,created_by,created_at::text created_at`

function decode(row: Row, companyId: string): Scope3AssessmentRecord {
  try {
    return validateScope3AssessmentRecord({
      category: row.category, reportingYear: row.reporting_year, setupVersionId: row.setup_version_id, reasonCode: row.reason_code, criteria: row.criteria,
      activitiesIncluded: row.activities_included, justification: row.justification, magnitudeKind: row.magnitude_kind, magnitudeTCo2e: row.magnitude_t_co2e,
      magnitudeBasis: row.magnitude_basis, notQuantifiableReason: row.not_quantifiable_reason, plannedMethodTypes: row.planned_method_types, energyResale: row.energy_resale,
      evidenceIds: row.evidence_ids, withinCategoryExclusions: row.within_category_exclusions,
      id: row.id, companyId: row.company_id, revision: row.revision, previousId: row.previous_id, correctionReason: row.correction_reason, createdBy: row.created_by,
      createdAt: new Date(row.created_at).toISOString(),
    }, companyId)
  } catch { throw new Error('Scope 3 assessment integrity check failed.') }
}

/**
 * The latest assessment of each category for one reporting year, in category order. Empty for a non-member (the read
 * policy shows nothing) and for a year with no assessment.
 */
export async function readScope3Assessments(tx: WorkspaceSql, companyId: string, reportingYear: number): Promise<Scope3AssessmentRecord[]> {
  if (!UUID.test(companyId) || !Number.isSafeInteger(reportingYear)) return []
  const rows = await tx.query<Row>(`select ${COLUMNS} from neuvetra.scope3_category_assessment_heads where company_id=$1 and reporting_year=$2 order by category`, [companyId, reportingYear])
  const out = rows.rows.map(row => decode(row, companyId))
  if (out.some(item => item.reportingYear !== reportingYear) || new Set(out.map(item => item.category)).size !== out.length) throw new Error('Scope 3 assessment integrity check failed.')
  return out
}

/** One saved revision by its id (any revision of the company's chain). */
export async function readScope3AssessmentRevision(tx: WorkspaceSql, companyId: string, assessmentId: string): Promise<Scope3AssessmentRecord | null> {
  if (!UUID.test(companyId) || !UUID.test(assessmentId)) return null
  const rows = await tx.query<Row>(`select ${COLUMNS} from neuvetra.scope3_category_assessments where company_id=$1 and id=$2`, [companyId, assessmentId])
  return rows.rows[0] ? decode(rows.rows[0], companyId) : null
}

/**
 * Saves one assessment revision through 0030's `save_scope3_category_assessment` (owner or admin; the setup version must
 * be the current one and the reporting year its year; optimistic revision per year and category; idempotent by key), then
 * reads the saved revision back. `category` is the category the request names (the route's path); it must be the
 * assessment's own.
 */
export async function saveScope3Assessment(tx: WorkspaceSql, actorId: string, companyId: string, category: number, input: unknown): Promise<{ assessment: Scope3AssessmentRecord; replayed: boolean }> {
  if (!UUID.test(actorId) || !UUID.test(companyId)) throw new Error('Scope 3 assessment unavailable.')
  const actor = await tx.query<{ id: string }>('select neuvetra.current_user_id() id')
  if (actor.rows[0]?.id !== actorId) throw Object.assign(new Error('Scope 3 assessment unavailable.'), { code: '42501' })
  let valid
  try { valid = validateScope3AssessmentSaveInput(input) } catch (error) { throw Object.assign(new Error((error as Error).message), { code: '22023' }) }
  if (valid.assessment.category !== category) throw Object.assign(new Error('Invalid Scope 3 assessment: category differs from the request.'), { code: '22023' })
  const receipt = await tx.query<{ assessment_id: string; revision: number; replayed: boolean }>('select * from neuvetra.save_scope3_category_assessment($1,$2::text::jsonb)', [companyId, JSON.stringify(valid)])
  const row = receipt.rows[0]
  if (!row) throw new Error('Scope 3 assessment save returned no receipt.')
  const assessment = await readScope3AssessmentRevision(tx, companyId, row.assessment_id)
  // The stored revision is exactly what was sent (a replay returns the revision the same request saved before).
  const sent = valid.assessment as unknown as Record<string, unknown>, stored = assessment as unknown as Record<string, unknown> | null
  if (!assessment || assessment.revision !== row.revision || Object.keys(sent).some(key => JSON.stringify(sent[key]) !== JSON.stringify(stored![key]))
    || assessment.correctionReason !== valid.correctionReason || assessment.createdBy !== actorId) throw new Error('Scope 3 assessment save could not be read back.')
  return { assessment, replayed: row.replayed }
}
