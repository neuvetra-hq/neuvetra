import { extractBearerToken } from "../lib/auth"
import { BetaAccessDatabase } from "../../../../packages/neuvetra-database/src/beta-access"
import type { VerifiedBetaIdentity } from "./auth"
import type { BetaAccessConfig } from "./config"
import { handleBetaAccessRoute } from "./routes"

export interface BetaAccessLog { event: "request"; requestId: string; route: "redeem" | "session" | "workspace" | "unknown"; status: number; durationMs: number }
export interface BetaAccessServerOverrides {
  database?: BetaAccessDatabase
  validateIdentity: (token: string) => Promise<VerifiedBetaIdentity | null>
  log?: (event: BetaAccessLog) => void
  now?: () => number
}

export function createBetaRateLimiter(max: number, windowMs: number, maxBuckets: number, now: () => number) {
  const buckets = new Map<string, { start: number; count: number }>()
  return {
    check(key: string) {
      const timestamp = now()
      let bucket = buckets.get(key)
      if (!bucket) {
        if (buckets.size >= maxBuckets) {
          for (const [candidate, value] of buckets) {
            if (timestamp - value.start >= windowMs) buckets.delete(candidate)
          }
        }
        if (buckets.size >= maxBuckets) return false
        bucket = { start: timestamp, count: 0 }; buckets.set(key, bucket)
      } else if (timestamp - bucket.start >= windowMs) {
        bucket = { start: timestamp, count: 0 }; buckets.set(key, bucket)
      }
      bucket.count += 1
      return bucket.count <= max
    },
  }
}

function json(status: number, body: unknown) { return Response.json(body, { status }) }
function routeName(pathname: string): BetaAccessLog["route"] { return pathname.endsWith("/redeem") ? "redeem" : pathname.endsWith("/session") ? "session" : pathname.startsWith("/beta-api/workspaces/") ? "workspace" : "unknown" }

/** Composition only. Importing this module never connects, migrates, issues or listens. */
export async function createBetaAccessServer(config: BetaAccessConfig, overrides: BetaAccessServerOverrides) {
  const database = overrides.database ?? await BetaAccessDatabase.create({ connectionString: config.databaseUrl, databaseName: config.databaseName, runtimeRole: config.runtimeRole })
  const log = overrides.log ?? ((event: BetaAccessLog) => console.info(JSON.stringify(event)))
  const now = overrides.now ?? Date.now
  const global = createBetaRateLimiter(60, 60_000, 1, now)
  const actors = createBetaRateLimiter(5, 60_000, 1_000, now)
  try { await database.checkReadiness() } catch { await database.close(); throw new Error("Beta access dependency is unavailable.") }

  async function dispatch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith("/beta-api/")) return json(404, { error: "Not found." })
    if (request.headers.get("origin") !== config.origin) return json(403, { error: "Forbidden." })
    if (!global.check("server")) return json(429, { error: "Request limit reached." })
    const token = extractBearerToken(request.headers)
    if (!token || token.length > 8192) return json(401, { error: "Authentication required." })
    let identity: VerifiedBetaIdentity | null
    try { identity = await overrides.validateIdentity(token) } catch { return json(503, { error: "Authentication is unavailable." }) }
    if (!identity) return json(401, { error: "Authentication required." })
    if (url.pathname === "/beta-api/invitations/redeem" && !actors.check(identity.id)) return json(429, { error: "Request limit reached." })
    return handleBetaAccessRoute(request, { database, identity })
  }

  return {
    async fetch(request: Request) {
      const started = performance.now(), requestId = crypto.randomUUID(), pathname = new URL(request.url).pathname
      let response: Response
      try { response = await dispatch(request) } catch { response = json(503, { error: "Beta access is unavailable." }) }
      const headers = new Headers(response.headers)
      headers.set("cache-control", "no-store"); headers.set("x-request-id", requestId); headers.set("x-content-type-options", "nosniff")
      headers.set("referrer-policy", "no-referrer"); headers.set("x-frame-options", "DENY"); headers.set("content-security-policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
      try { log({ event: "request", requestId, route: routeName(pathname), status: response.status, durationMs: Math.round(performance.now() - started) }) } catch { /* Logging cannot alter a committed response. */ }
      return new Response(response.body, { status: response.status, headers })
    },
    close: () => database.close(),
  }
}
