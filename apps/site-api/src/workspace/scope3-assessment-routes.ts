import type { CollectionEvidenceMetadata, CompanySetupView } from "@neuvetra/database"
import { scope3ReportingYearOf, type Scope3AssessmentRecord } from "../../../../packages/neuvetra-database/src/scope3-assessment-contract"
import type { AuthenticatedUser } from "../lib/auth"
import { readScope3JsonBody, scope3RoutePrelude, Scope3RouteProblem, SCOPE3_UUID_SOURCE } from "./scope3-route-helpers"

/**
 * Scope 3 category assessments (Scope 3 completion I-04; Claude, 30 October 2026; DESIGN 3.5, 7.1). The structured
 * screening record behind each setup decision, per reporting year:
 * - GET  /workspace/:id/scope3/assessments            the setup's reporting year, the latest assessment of each category,
 *                                                      and the company evidence an assessment may cite;
 * - PUT  /workspace/:id/scope3/assessments/:category   saves one revision (owner or admin) through 0030's RPC.
 * The reporting year is always the current setup version's (the year its reporting period ends, 0030 AM-03). The staging
 * server refuses every /workspace/:id/scope3/... route below schema 30 before any SQL; this route is safe used alone too.
 */
export const SCOPE3_ASSESSMENTS_PROFILE = "neuvetra.scope3-assessments.v1" as const
export interface Scope3AssessmentsResponse {
  profile: typeof SCOPE3_ASSESSMENTS_PROFILE
  companyId: string
  canManage: boolean
  /** The current setup version and its reporting year; null when setup is not saved or has no period end. */
  setupVersionId: string | null
  reportingYear: number | null
  assessments: Scope3AssessmentRecord[]
  /** Collection evidence an assessment may link (not rejected, as 0030's evidence check requires). */
  evidence: Array<{ id: string; name: string; status: CollectionEvidenceMetadata["quarantineStatus"] }>
}
export interface Scope3AssessmentSaveResponse { profile: typeof SCOPE3_ASSESSMENTS_PROFILE; assessment: Scope3AssessmentRecord; replayed: boolean }

export interface Scope3AssessmentRouteDatabase {
  findCompanySetup(userId: string, companyId: string): Promise<CompanySetupView | null>
  findCollectionEvidence(userId: string, companyId: string): Promise<CollectionEvidenceMetadata[]>
  findScope3Assessments(userId: string, companyId: string, reportingYear: number): Promise<Scope3AssessmentRecord[]>
  saveScope3Assessment(userId: string, companyId: string, category: number, input: unknown): Promise<{ assessment: Scope3AssessmentRecord; replayed: boolean }>
}

const ROUTE = new RegExp(`^/workspace/(${SCOPE3_UUID_SOURCE})/scope3/assessments(?:/([1-9]|1[0-5]))?$`, "i")
const NOT_FOUND = { error: "Scope 3 assessments not found." }
const MAX_BODY_BYTES = 150_000

export function createScope3AssessmentRoutes(deps: {
  database: Scope3AssessmentRouteDatabase
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  origin: string
}) {
  return async (request: Request): Promise<Response> => {
    const respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
    const match = ROUTE.exec(new URL(request.url).pathname)
    if (!match) return respond(404, NOT_FOUND)
    const companyId = match[1]!.toLowerCase()
    const category = match[2] ? Number(match[2]) : null
    // Round 2 (ENG-14): the shared prelude; the PUT body must be application/json.
    const prelude = await scope3RoutePrelude(request, deps, category === null ? ["GET"] : ["PUT"])
    if ("response" in prelude) return prelude.response
    const actor: AuthenticatedUser = prelude.actor
    try {
      const setup = await deps.database.findCompanySetup(actor.id, companyId)
      if (!setup) return respond(404, NOT_FOUND)
      const current = setup.currentVersion
      const reportingYear = scope3ReportingYearOf(current?.setup.reportingPeriod.endExclusive ?? null)
      if (category === null) {
        const [assessments, evidence] = await Promise.all([
          reportingYear === null ? Promise.resolve([]) : deps.database.findScope3Assessments(actor.id, companyId, reportingYear),
          deps.database.findCollectionEvidence(actor.id, companyId),
        ])
        const body: Scope3AssessmentsResponse = {
          profile: SCOPE3_ASSESSMENTS_PROFILE, companyId, canManage: setup.canManage, setupVersionId: current?.id ?? null, reportingYear, assessments,
          evidence: evidence.filter(file => file.quarantineStatus !== "rejected").map(file => ({ id: file.id, name: file.originalName, status: file.quarantineStatus })),
        }
        return respond(200, body)
      }
      if (!setup.canManage) return respond(403, { error: "Forbidden." })
      if (!current || reportingYear === null) return respond(409, { code: "setup_required", error: "Save company setup with a reporting period before assessing Scope 3 categories." })
      const input = await readScope3JsonBody(request, MAX_BODY_BYTES, "Invalid Scope 3 assessment JSON.")
      const saved = await deps.database.saveScope3Assessment(actor.id, companyId, category, input)
      const body: Scope3AssessmentSaveResponse = { profile: SCOPE3_ASSESSMENTS_PROFILE, assessment: saved.assessment, replayed: saved.replayed }
      return respond(saved.replayed ? 200 : 201, body)
    } catch (error) {
      if (error instanceof Scope3RouteProblem) return respond(error.status, error.body)
      const code = (error as { code?: string }).code
      if (code === "42501") return respond(404, NOT_FOUND)
      // 0030 gives 23503 when the setup version is no longer the current one, or a linked evidence file is not the company's.
      if (code === "23503") return respond(409, { code: "reload_required", error: "Company setup or the linked evidence changed. Reload and try again." })
      if (code === "23505" || code === "40001") return respond(409, { code: "assessment_changed", error: "This assessment changed elsewhere. Reload it before saving." })
      if (code === "54000") return respond(422, { code: "history_limit", error: "This assessment's history capacity is reached." })
      if (["22023", "22P02", "22007", "22008", "22003", "23514", "23502"].includes(code ?? "")) return respond(422, { error: "Invalid or unsupported Scope 3 assessment." })
      return respond(503, { error: "Scope 3 assessments could not be read or saved. Try again shortly." })
    }
  }
}
