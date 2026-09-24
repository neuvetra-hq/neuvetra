import {
  M80ValidationError,
  parseM80Json,
  validateM80SaveSetup,
  type M80BetaSetupVersion,
  type M80FoundationView,
  type M80SaveSetupResult,
} from "@neuvetra/database"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"

export interface M80RouteDatabase {
  hasStagingAccess?: (userId: string) => Promise<boolean>
  canManageWorkspace(userId: string, companyId: string): Promise<boolean>
  findM80Foundation(userId: string, companyId: string): Promise<M80FoundationView | null>
  findM80FoundationVersion(userId: string, companyId: string, versionId: string): Promise<M80BetaSetupVersion | null>
  saveM80Foundation(userId: string, companyId: string, input: unknown): Promise<M80SaveSetupResult>
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const ROUTE = new RegExp(`^/workspace/(${UUID})/scope1-beta-setup(?:/versions/(${UUID}))?$`)

export function createM80BetaRoutes(deps: {
  database: M80RouteDatabase
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  origin: string
}) {
  return async (request: Request): Promise<Response> => {
    const respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
    const match = ROUTE.exec(new URL(request.url).pathname)
    if (!match) return respond(404, { error: "Scope 1 beta setup not found." })
    const companyId = match[1]!
    const versionId = match[2] ?? null
    const origin = request.headers.get("origin")
    if ((origin && origin !== deps.origin) || (request.method !== "GET" && origin !== deps.origin)) return respond(403, { error: "Forbidden." })
    const token = extractBearerToken(request.headers)
    if (!token) return respond(401, { error: "Authentication required." })
    const actor = await deps.validateUser(token)
    if (!actor) return respond(401, { error: "Authentication required." })
    try {
      if (deps.database.hasStagingAccess && !await deps.database.hasStagingAccess(actor.id)) return respond(403, { error: "Forbidden." })
      if (request.method !== "GET" && request.method !== "POST") return respond(405, { error: "Method not allowed." })
      if (request.method === "GET") {
        const value = versionId
          ? await deps.database.findM80FoundationVersion(actor.id, companyId, versionId)
          : await deps.database.findM80Foundation(actor.id, companyId)
        return value ? respond(200, value) : respond(404, { error: "Scope 1 beta setup not found." })
      }
      if (versionId) return respond(405, { error: "Method not allowed." })
      if (!await deps.database.canManageWorkspace(actor.id, companyId)) return respond(403, { error: "Forbidden." })
      const input = validateM80SaveSetup(parseM80Json(await request.text()))
      const result = await deps.database.saveM80Foundation(actor.id, companyId, input)
      return respond(result.replayed ? 200 : 201, result)
    } catch (error) {
      if (error instanceof M80ValidationError) return respond(422, { error: error.message })
      const code = (error as { code?: string }).code
      if (code === "M80_FOUNDATION_NOT_FOUND") return respond(404, { error: "Scope 1 beta setup not found." })
      if (code === "42501") return respond(403, { error: "Forbidden." })
      if (code === "23505") return respond(409, { error: "Scope 1 beta setup changed. Refresh current setup." })
      if (code === "54000") return respond(422, { error: "Scope 1 beta setup history capacity reached.", code: "history_limit" })
      if (["22023", "22P02", "22007", "22008", "22003"].includes(code ?? "")) return respond(422, { error: "Invalid or unsupported Scope 1 beta setup." })
      return respond(503, { error: "Scope 1 beta setup could not be verified." })
    }
  }
}
