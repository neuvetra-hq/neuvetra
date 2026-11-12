import type { HostedWorkspaceActor } from "./workspace-api"
import { validateScope3AssessmentRecord, type Scope3Assessment, type Scope3AssessmentRecord, type Scope3AssessmentSaveInput } from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import { scope3SelectiveDownstreamExclusion, type Scope3SetupDecision } from "../../../../packages/neuvetra-database/src/scope3-coverage"
import { provisionalFirstScope3Report } from "../../../../packages/neuvetra-database/src/scope3-deadline"
import { SCOPE3_BASE_YEAR_TEXT, SCOPE3_DISCLOSURE_TEXT, SCOPE3_KNOWN_LIMITATION_TEXT, scope3CategoryMethodNote } from "../../../../packages/neuvetra-database/src/scope3-text"
import { SCOPE3_REPORT_TEXT_V3 } from "../../../../packages/neuvetra-database/src/scope3-text-v3"

/**
 * Scope 3 category assessments for company setup (Scope 3 completion I-04; Claude, 30 October 2026; DESIGN 3.5, 7.1).
 * The setup screen reads the reporting year's assessments and saves one revision per category. Every response is decoded
 * strictly: each assessment exactly as the database stores it (the shared contract), for this company and year.
 */
export type { Scope3Assessment, Scope3AssessmentRecord, Scope3AssessmentSaveInput }
export const SCOPE3_ASSESSMENTS_PROFILE = "neuvetra.scope3-assessments.v1"
export interface Scope3AssessmentsView {
  companyId: string; canManage: boolean; setupVersionId: string | null; reportingYear: number | null
  assessments: Scope3AssessmentRecord[]
  evidence: Array<{ id: string; name: string; status: "pending" | "clean" | "rejected" | "failed" }>
}

export class Scope3AssessmentApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) { super(message) }
  get conflict() { return this.status === 409 }
  /** The database is below schema 30 (0030), so assessments don't exist yet. */
  get unavailable() { return this.status === 503 && this.code === "scope3_schema_30_required" }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const fail = (): never => { throw new Error("The Scope 3 assessments response was not recognized.") }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
const keys = (value: Record<string, unknown>, expected: readonly string[]) => Object.keys(value).sort().join("|") === [...expected].sort().join("|")
const record = (value: unknown, companyId: string) => { try { return validateScope3AssessmentRecord(value, companyId) } catch { return fail() } }

export function decodeScope3Assessments(value: unknown, companyId: string): Scope3AssessmentsView {
  if (!object(value) || !keys(value, ["profile", "companyId", "canManage", "setupVersionId", "reportingYear", "assessments", "evidence"]) || value.profile !== SCOPE3_ASSESSMENTS_PROFILE || value.companyId !== companyId) fail()
  const v = value as Record<string, unknown>
  if (typeof v.canManage !== "boolean" || !(v.setupVersionId === null || (typeof v.setupVersionId === "string" && UUID.test(v.setupVersionId)))) fail()
  if (!(v.reportingYear === null || (Number.isSafeInteger(v.reportingYear) && (v.reportingYear as number) >= 2012 && (v.reportingYear as number) <= 2035))) fail()
  // No saved setup has no reporting year; no reporting year has no assessments.
  if ((v.setupVersionId === null && v.reportingYear !== null) || !Array.isArray(v.assessments) || !Array.isArray(v.evidence) || (v.reportingYear === null && v.assessments.length > 0)) fail()
  const assessments = (v.assessments as unknown[]).map(item => record(item, companyId))
  if (assessments.some(item => item.reportingYear !== v.reportingYear) || new Set(assessments.map(item => item.category)).size !== assessments.length) fail()
  const evidence = (v.evidence as unknown[]).map(item => {
    if (!object(item) || !keys(item, ["id", "name", "status"]) || typeof item.id !== "string" || !UUID.test(item.id) || typeof item.name !== "string" || !["pending", "clean", "failed"].includes(String(item.status))) fail()
    return item as Scope3AssessmentsView["evidence"][number]
  })
  return { companyId, canManage: v.canManage as boolean, setupVersionId: v.setupVersionId as string | null, reportingYear: v.reportingYear as number | null, assessments, evidence }
}

async function request(actor: HostedWorkspaceActor, path: string, body?: unknown): Promise<unknown> {
  if (!actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  actor.signal?.throwIfAborted()
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "PUT", cache: "no-store", signal: actor.signal, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { authorization: `Bearer ${actor.accessToken}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
  })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) actor.onUnauthorized?.(response.status)
  const value: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Scope3AssessmentApiError(object(value) && typeof value.error === "string" ? value.error : "Scope 3 assessments are unavailable right now.", response.status, object(value) && typeof value.code === "string" ? value.code : null)
  return value
}
const path = (companyId: string, category?: number) => {
  if (!UUID.test(companyId) || (category !== undefined && !(Number.isSafeInteger(category) && category >= 1 && category <= 15))) throw new Error("Invalid Scope 3 assessment reference.")
  return `/workspace-api/workspace/${companyId}/scope3/assessments${category === undefined ? "" : `/${category}`}`
}

export async function loadScope3Assessments(companyId: string, actor: HostedWorkspaceActor): Promise<Scope3AssessmentsView> {
  return decodeScope3Assessments(await request(actor, path(companyId)), companyId)
}

/** Saves one revision and checks the server stored exactly what was sent, as the next revision (or replayed it). */
export async function saveScope3Assessment(companyId: string, input: Scope3AssessmentSaveInput, actor: HostedWorkspaceActor): Promise<{ assessment: Scope3AssessmentRecord; replayed: boolean }> {
  const value = await request(actor, path(companyId, input.assessment.category), input)
  if (!object(value) || !keys(value, ["profile", "assessment", "replayed"]) || value.profile !== SCOPE3_ASSESSMENTS_PROFILE || typeof value.replayed !== "boolean") fail()
  const assessment = record((value as Record<string, unknown>).assessment, companyId)
  const sent = input.assessment as unknown as Record<string, unknown>, stored = assessment as unknown as Record<string, unknown>
  if (Object.keys(sent).some(key => JSON.stringify(sent[key]) !== JSON.stringify(stored[key])) || assessment.correctionReason !== input.correctionReason || assessment.revision !== input.expectedRevision + 1 || assessment.createdBy !== actor.userId) fail()
  return { assessment, replayed: (value as Record<string, unknown>).replayed as boolean }
}

/** An empty assessment for a category and reporting year (the editor's starting point when none is saved). */
export function blankScope3Assessment(category: number, reportingYear: number, setupVersionId: string): Scope3Assessment {
  return { category, reportingYear, setupVersionId, reasonCode: null, criteria: { size: false, influence: false, risk: false, stakeholders: false, outsourcing: false, sectorGuidance: false, other: false, otherText: "" },
    activitiesIncluded: "", justification: "", magnitudeKind: null, magnitudeTCo2e: null, magnitudeBasis: "", notQuantifiableReason: "", plannedMethodTypes: [], energyResale: null, evidenceIds: [], withinCategoryExclusions: [] }
}

/** Audit D13: the setup note for a category (proposed mandatory, and what this beta calculates, from the method catalog). */
export function scope3SetupCategoryNote(category: number, proposedMandatory: boolean): string {
  return [proposedMandatory ? "Proposed mandatory (CARB proposal, not adopted)." : "", category === 10 ? SCOPE3_REPORT_TEXT_V3.processingPartnerDataOnly : scope3CategoryMethodNote(category)].filter(Boolean).join(" ")
}
/** DESIGN 5.4 and 7.1: the fixed statements on the setup screen (the deadline needs the setup's period end). */
export function scope3SetupStatements(periodEndExclusive: string | null): string[] {
  let deadline: ReturnType<typeof provisionalFirstScope3Report> = null
  try { deadline = provisionalFirstScope3Report(periodEndExclusive) } catch { deadline = null }
  return [...(deadline ? [`${deadline.line} ${deadline.label}`] : []), SCOPE3_KNOWN_LIMITATION_TEXT, SCOPE3_BASE_YEAR_TEXT]
}
/**
 * DESIGN 3.5 / Std 6.4: the warning when the setup decisions and saved assessments exclude only some of categories 9 to 12
 * for intermediate products with unknown end use (the same rule and words as the results disclosure), else null.
 */
export function scope3DownstreamWarning(decisionOf: (category: number) => Scope3SetupDecision, assessments: readonly Pick<Scope3AssessmentRecord, "category" | "reasonCode">[]): string | null {
  return scope3SelectiveDownstreamExclusion(decisionOf, category => assessments.find(item => item.category === category) ?? null) ? SCOPE3_DISCLOSURE_TEXT.selective_downstream_exclusion! : null
}
