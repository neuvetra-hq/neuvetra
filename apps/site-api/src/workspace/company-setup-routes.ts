import { duplicateCompanySetupIds, SCOPE3_CAPACITY_TEXT, type CollectionActivityRecord, type CompanySetupSaveResult, type CompanySetupVersion, type CompanySetupView } from "@neuvetra/database"
import { MAX_SCOPE3_LINES, scope3GridLossesIncluded, scope3LineCountRule, scope3StoredLineCount } from "./scope3-results-routes"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"

export interface CompanySetupRouteDatabase {
  findCompanySetup(userId: string, companyId: string): Promise<CompanySetupView | null>
  findCompanySetupVersion(userId: string, companyId: string, versionId: string): Promise<CompanySetupVersion | null>
  saveCompanySetup(userId: string, companyId: string, input: unknown): Promise<CompanySetupSaveResult>
  /** BF-21: read after a save that includes category 3 at schema 32, for the line-budget warning (absent: no warning). */
  findCollectionActivities?(userId: string, companyId: string): Promise<CollectionActivityRecord[]>
}

/**
 * BF-21 (BI-03 option C, CEO decision): the one warning a setup save can carry. From schema 32 the database counts stored
 * Scope 3 records only, and nothing refuses a setup save for it, so a save that includes category 3 while energy-resold
 * records are saved (each then counts twice) can take the count past 3,000. The save stands (setup is never blocked by
 * Scope 3 volume); the answer says so, with the count and the ways back. Sent only then, so every other answer is unchanged.
 */
export const SETUP_SCOPE3_LINE_BUDGET_WARNING = "scope3_line_budget_exceeded" as const
export interface CompanySetupWarning { code: typeof SETUP_SCOPE3_LINE_BUDGET_WARNING; lineBudget: { max: number; used: number }; message: string }

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const ROUTE = new RegExp(`^/workspace/(${UUID})/setup(?:/versions/(${UUID}))?$`, "i")
const NOT_FOUND = { error: "Company setup not found." }

/** The staging wrapper also authenticates and bounds the request. Keep this route safe when used alone. */
export function createCompanySetupRoutes(deps: {
  database: CompanySetupRouteDatabase
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  origin: string
  /** BF-21: the database's schema version (the warning needs 0032's count, schema 32). Absent: no warning. */
  schemaVersion?: () => Promise<number>
}) {
  /** BF-21: the warning for a saved setup, or null. The save has committed, so a failed read gives no warning, never an error. */
  const scope3BudgetWarning = async (actorId: string, result: CompanySetupSaveResult): Promise<CompanySetupWarning | null> => {
    try {
      if (!deps.schemaVersion || !deps.database.findCollectionActivities || !scope3GridLossesIncluded(result.foundation)) return null
      if (scope3LineCountRule(await deps.schemaVersion()) !== "stored") return null
      const used = scope3StoredLineCount(await deps.database.findCollectionActivities(actorId, result.savedVersion.companyId), true)
      return used > MAX_SCOPE3_LINES ? { code: SETUP_SCOPE3_LINE_BUDGET_WARNING, lineBudget: { max: MAX_SCOPE3_LINES, used }, message: SCOPE3_CAPACITY_TEXT.setupOverLineBudget(MAX_SCOPE3_LINES, used) } : null
    } catch { return null }
  }
  return async (request: Request): Promise<Response> => {
    const respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
    const match = ROUTE.exec(new URL(request.url).pathname)
    if (!match) return respond(404, NOT_FOUND)
    const companyId = match[1]!.toLowerCase()
    const versionId = match[2]?.toLowerCase() ?? null
    const origin = request.headers.get("origin")
    if ((origin && origin !== deps.origin) || (request.method !== "GET" && origin !== deps.origin)) return respond(403, { error: "Forbidden." })
    if (request.method !== "GET" && request.method !== "POST") return respond(405, { error: "Method not allowed." })
    if (versionId && request.method !== "GET") return respond(405, { error: "Method not allowed." })
    const token = extractBearerToken(request.headers)
    if (!token || token.length > 8192) return respond(401, { error: "Authentication required." })
    let actor: AuthenticatedUser | null
    try { actor = await deps.validateUser(token) } catch { return respond(503, { error: "Authentication is unavailable." }) }
    if (!actor) return respond(401, { error: "Authentication required." })
    try {
      if (versionId) {
        const value = await deps.database.findCompanySetupVersion(actor.id, companyId, versionId)
        return value ? respond(200, value) : respond(404, NOT_FOUND)
      }
      const view = await deps.database.findCompanySetup(actor.id, companyId)
      if (!view) return respond(404, NOT_FOUND)
      if (request.method === "GET") return respond(200, view)
      if (!view.canManage) return respond(403, { error: "Forbidden." })
      const body = await request.text()
      if (new TextEncoder().encode(body).byteLength > 250_000) return respond(413, { error: "Request too large." })
      let input: unknown
      try { input = JSON.parse(body) } catch { return respond(422, { error: "Invalid company setup JSON." }) }
      // BF-08 (BL-06): a repeated entity, relationship, location or change ID, or a repeated screening ID or (scope, category), is invalid input,
      // refused before any SQL, so a unique violation below means only a head or idempotency conflict.
      if (duplicateCompanySetupIds((input as { setup?: unknown } | null)?.setup)) return respond(422, { error: "Invalid or unsupported company setup.", code: "duplicate_setup_id" })
      const result = await deps.database.saveCompanySetup(actor.id, companyId, input)
      const warning = await scope3BudgetWarning(actor.id, result)
      return respond(result.replayed ? 200 : 201, warning ? { ...result, warnings: [warning] } : result)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === "42501") return respond(404, NOT_FOUND)
      if (["23505", "40001", "23P01"].includes(code ?? "")) return respond(409, { error: "Company setup changed. Refresh current setup." })
      if (code === "54000") return respond(422, { error: "Company setup history capacity reached.", code: "history_limit" })
      if (["22023", "22P02", "22007", "22008", "22003", "23514", "23503", "23502"].includes(code ?? "")) return respond(422, { error: "Invalid or unsupported company setup." })
      return respond(503, { error: "Company setup could not be verified." })
    }
  }
}
