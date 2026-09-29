import type { CompanySetupSaveResult, CompanySetupVersion, CompanySetupView } from "@neuvetra/database"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"

export interface CompanySetupRouteDatabase {
  findCompanySetup(userId: string, companyId: string): Promise<CompanySetupView | null>
  findCompanySetupVersion(userId: string, companyId: string, versionId: string): Promise<CompanySetupVersion | null>
  saveCompanySetup(userId: string, companyId: string, input: unknown): Promise<CompanySetupSaveResult>
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const ROUTE = new RegExp(`^/workspace/(${UUID})/setup(?:/versions/(${UUID}))?$`, "i")
const NOT_FOUND = { error: "Company setup not found." }

/** The staging wrapper also authenticates and bounds the request. Keep this route safe when used alone. */
export function createCompanySetupRoutes(deps: {
  database: CompanySetupRouteDatabase
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  origin: string
}) {
  return async (request: Request): Promise<Response> => {
    const respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
    const match = ROUTE.exec(new URL(request.url).pathname)
    if (!match) return respond(404, NOT_FOUND)
    const companyId = match[1]!
    const versionId = match[2] ?? null
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
      const result = await deps.database.saveCompanySetup(actor.id, companyId, input)
      return respond(result.replayed ? 200 : 201, result)
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
