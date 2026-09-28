import {
  type M80BetaSetupVersion,
  type M80FoundationView,
} from "@neuvetra/database"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"

export interface M80RouteDatabase {
  hasStagingAccess?: (userId: string) => Promise<boolean>
  findM80Foundation(userId: string, companyId: string): Promise<M80FoundationView | null>
  findM80FoundationVersion(userId: string, companyId: string, versionId: string): Promise<M80BetaSetupVersion | null>
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
      if (request.method !== "GET") return respond(405, { error: "Method not allowed." })
      const value = versionId
        ? await deps.database.findM80FoundationVersion(actor.id, companyId, versionId)
        : await deps.database.findM80Foundation(actor.id, companyId)
      return value ? respond(200, value) : respond(404, { error: "Scope 1 beta setup not found." })
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === "M80_FOUNDATION_NOT_FOUND") return respond(404, { error: "Scope 1 beta setup not found." })
      if (code === "42501") return respond(403, { error: "Forbidden." })
      return respond(503, { error: "Scope 1 beta setup could not be verified." })
    }
  }
}
