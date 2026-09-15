import { createAnnualWorksheetRoutes } from "../workspace/m67-routes"
import { createAnnualWorksheetReportRoutes } from "../workspace/m67-report-routes"
import { createSourceWorksheetRoutes } from "../workspace/m66-routes"
import { createSourceWorksheetReportRoutes } from "../workspace/m66-report-routes"
import { createElectricitySourceRoutes } from "../workspace/m66-source-routes"
import { createWorksheetReportRoutes } from "../workspace/m65-routes"
import { createWorksheetRoutes } from "../workspace/m64-routes"
import { HostedWorkspaceDatabase, loadStagingDatabaseCa, type WorkspaceDatabase, type CompanyWorkspaceRecord } from "@neuvetra/database"
import { createClient } from "@supabase/supabase-js"
import { extractBearerToken, validateUserFromToken, type AuthenticatedUser } from "../lib/auth"
import { createRateLimiter } from "../lib/rate-limit"
import { createWorkspaceRoutes } from "../workspace/routes"
import { createWorkspaceStore } from "../workspace/service"
import { readStagingConfig, STAGING_PROFILE, type StagingConfig } from "./config"
import { serveStagingAsset, verifyStagingAssets } from "./assets"

const MAX_BODY_BYTES = 300_000
type Access = { workspace: CompanyWorkspaceRecord; role: "owner" | "admin" | "member"; evidenceId: string | null }
export type StagingDatabase = WorkspaceDatabase & {
  hasStagingAccess(userId: string): Promise<boolean>
  findStagingWorkspaceForUser(userId: string): Promise<Access | null>
  checkReadiness(): Promise<{ profile: string; schemaVersion: number; legacyContainmentVerified?: boolean }>
}

export interface StagingLog {
  event: "request"
  requestId: string
  route: "health" | "ready" | "config" | "session" | "workspace" | "asset" | "unknown"
  status: number
  durationMs: number
}

export interface StagingOverrides {
  database?: StagingDatabase
  validateUser?: (token: string) => Promise<AuthenticatedUser | null>
  verifyAssets?: () => Promise<void>
  serveAsset?: (pathname: string) => Promise<Response | null>
  log?: (event: StagingLog) => void
}

function json(status: number, value: unknown) { return Response.json(value, { status }) }

async function boundedRequest(request: Request, url: URL): Promise<Request> {
  const claimed = request.headers.get("content-length")
  if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > MAX_BODY_BYTES)) throw new Error("Request too large.")
  if (!request.body) return new Request(url, request)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("Request too large.") }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const body = new Uint8Array(total)
  let position = 0
  for (const chunk of chunks) { body.set(chunk, position); position += chunk.byteLength }
  return new Request(url, { method: request.method, headers: request.headers, body, signal: request.signal })
}

/** No listener, migration or credential read occurs at import time. */
export async function createStagingServer(config: StagingConfig, overrides: StagingOverrides = {}) {
  if (config.profile !== STAGING_PROFILE) throw new Error("Private staging profile is invalid.")
  const database: StagingDatabase = overrides.database ?? await HostedWorkspaceDatabase.create({ connectionString: config.databaseUrl, expectedProjectRef: config.projectRef, reuseExistingProject: config.reuseExistingProject, tlsCaPem: await loadStagingDatabaseCa({ caPem: config.databaseCaPem, caFile: config.databaseCaFile }) })
  const auth = overrides.validateUser ?? (() => {
    const boundedFetch = ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(5_000) })) as typeof fetch
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: boundedFetch } })
    return (token: string) => validateUserFromToken(token, client)
  })()
  const checkAssets = overrides.verifyAssets ?? (() => verifyStagingAssets(config.webRoot))
  const serveAsset = overrides.serveAsset ?? ((pathname: string) => serveStagingAsset(config.webRoot, pathname))
  const log = overrides.log ?? ((event: StagingLog) => console.info(JSON.stringify(event)))
  const admission = createRateLimiter({ max: 360, windowMs: 60_000, maxBuckets: 1 })
  const actors = createRateLimiter({ max: 120, windowMs: 60_000, maxBuckets: 100 })
  const validateUser = async (token: string) => {
    const user = await auth(token)
    return user && await database.hasStagingAccess(user.id) ? user : null
  }
  const routes = createWorkspaceRoutes({
    allowedOrigins: [config.origin], validateUser,
    store: createWorkspaceStore(database, async (userId) => {
      const access = await database.findStagingWorkspaceForUser(userId)
      if (!access || access.role !== "owner") throw new Error("Workspace not found.")
      return access.workspace
    }),
  })
  const annualWorksheetRoutes=createAnnualWorksheetRoutes({database,validateUser,origin:config.origin})
  const annualReportRoutes=createAnnualWorksheetReportRoutes({database,validateUser,origin:config.origin})
  const sourceWorksheetRoutes=createSourceWorksheetRoutes({database,validateUser,origin:config.origin})
  const sourceReportRoutes=createSourceWorksheetReportRoutes({database,validateUser,origin:config.origin})
  const electricitySourceRoutes=createElectricitySourceRoutes({database,validateUser,origin:config.origin})
  const reportRoutes = createWorksheetReportRoutes({ database, validateUser, origin: config.origin })
  const worksheetRoutes = createWorksheetRoutes({ database, validateUser, origin: config.origin })
  const databaseReadiness = async () => {
    const receipt = await database.checkReadiness()
    if (receipt.profile !== STAGING_PROFILE || receipt.schemaVersion !== 13) throw new Error("Staging database unavailable.")
    if (config.projectRef === "icockcoguyadhryzydvl" && (!config.reuseExistingProject || receipt.legacyContainmentVerified !== true)) throw new Error("Existing project containment unavailable.")
    return receipt
  }
  const readiness = async () => { const receipt = await databaseReadiness(); await checkAssets(); return receipt }
  try { await readiness() } catch { await database.close(); throw new Error("Private staging dependencies are unavailable.") }

  const routeName = (pathname: string): StagingLog["route"] => pathname === "/health" ? "health" : pathname === "/ready" ? "ready" : pathname === "/workspace-api/config" ? "config" : pathname === "/workspace-api/session" ? "session" : pathname.startsWith("/workspace-api/workspace") ? "workspace" : pathname === "/" || pathname === "/workspace" || pathname.startsWith("/assets/") ? "asset" : "unknown"

  async function dispatch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const isGet = request.method === "GET"
    if (url.pathname === "/health" && isGet) return json(200, { status: "alive" })
    if (url.pathname === "/ready" && isGet) {
      try { const receipt = await readiness(); return json(200, { status: "ready", ...receipt }) }
      catch { return json(503, { status: "unavailable" }) }
    }
    if (url.pathname.startsWith("/workspace-api/")) {
      const origin = request.headers.get("origin")
      if ((origin && origin !== config.origin) || (!isGet && origin !== config.origin)) return json(403, { error: "Forbidden." })
      if (!admission.check("staging").allowed) return json(429, { error: "Request limit reached." })
      if (config.projectRef === "icockcoguyadhryzydvl") await databaseReadiness()
      if (url.pathname === "/workspace-api/config" && isGet) return json(200, { profile: STAGING_PROFILE, supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey })
      const token = extractBearerToken(request.headers)
      if (!token || token.length > 8192) return json(401, { error: "Authentication required." })
      let user: AuthenticatedUser | null
      try { user = await auth(token) } catch { return json(503, { error: "Authentication is unavailable." }) }
      if (!user) return json(401, { error: "Authentication required." })
      if (!actors.check(user.id).allowed) return json(429, { error: "Request limit reached." })
      if (!await database.hasStagingAccess(user.id)) return json(403, { error: "Private staging access required." })
      if (url.pathname === "/workspace-api/session" && isGet) {
        const access = await database.findStagingWorkspaceForUser(user.id)
        if (!access) return json(403, { error: "Private staging access required." })
        return json(200, { profile: STAGING_PROFILE, user: { id: user.id }, access: { role: access.role, workspaceId: access.workspace.id, evidenceId: access.evidenceId } })
      }
      url.pathname = url.pathname.slice("/workspace-api".length)
      let forwarded: Request
      try { forwarded = await boundedRequest(request, url) } catch { return json(413, { error: "Request too large." }) }
      if (url.pathname.includes("/annual-electricity-worksheet/reports")) return annualReportRoutes(forwarded)
      if (url.pathname.includes("/annual-electricity-worksheet")) return annualWorksheetRoutes(forwarded)
      if (url.pathname.includes("/source-electricity-worksheet/sources")) return electricitySourceRoutes(forwarded)
      if (url.pathname.includes("/source-electricity-worksheet/reports")) return sourceReportRoutes(forwarded)
      if (url.pathname.includes("/source-electricity-worksheet")) return sourceWorksheetRoutes(forwarded)
      if (url.pathname.includes("/electricity-worksheet/reports")) return reportRoutes(forwarded)
      if (url.pathname.includes("/electricity-worksheet")) return worksheetRoutes(forwarded)
      return routes.handle(forwarded)
    }
    if (isGet) return await serveAsset(url.pathname) ?? json(404, { error: "Not found." })
    return json(404, { error: "Not found." })
  }

  return {
    async fetch(request: Request) {
      const started = performance.now()
      const requestId = crypto.randomUUID()
      let response: Response
      try { response = await dispatch(request) } catch { response = json(503, { error: "Private staging is unavailable." }) }
      const headers = new Headers(response.headers)
      headers.set("cache-control", "no-store")
      headers.set("x-request-id", requestId)
      headers.set("x-content-type-options", "nosniff")
      headers.set("referrer-policy", "no-referrer")
      headers.set("x-frame-options", "DENY")
      if (!headers.has("content-security-policy")) headers.set("content-security-policy", `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${config.supabaseUrl}; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'`)
      if (config.origin.startsWith("https:")) headers.set("strict-transport-security", "max-age=31536000")
      try { log({ event: "request", requestId, route: routeName(new URL(request.url).pathname), status: response.status, durationMs: Math.round(performance.now() - started) }) } catch { /* Log failures cannot disclose request contents or turn a committed write into a client failure. */ }
      return new Response(response.body, { status: response.status, headers })
    },
    close: () => database.close(),
  }
}

if (import.meta.main) {
  try {
    const config = readStagingConfig()
    const app = await createStagingServer(config)
    const server = Bun.serve({ hostname: "0.0.0.0", port: config.port, maxRequestBodySize: MAX_BODY_BYTES, idleTimeout: 30, fetch: app.fetch })
    const shutdown = async () => { await server.stop(); await app.close(); process.exit(0) }
    process.once("SIGINT", shutdown)
    process.once("SIGTERM", shutdown)
    console.info(JSON.stringify({ event: "staging_started", profile: STAGING_PROFILE }))
  } catch {
    console.error(JSON.stringify({ event: "staging_start_failed" }))
    process.exitCode = 1
  }
}

