import { createM75Routes } from "../workspace/m75-routes"
import { createM76Routes } from "../workspace/m76-routes"
import { createM76DieselAuthority } from "../calculation/m76-authority"
import { createM77Routes } from "../workspace/m77-routes"
import { createM77Authority } from "../calculation/m77-authority"
import { createCorporateInventoryRoutes } from "../workspace/m71-routes"
import { createM73Routes } from "../workspace/m73-routes"
import { createM73Authority } from "../calculation/m73-authority"
import { createM74Routes } from "../workspace/m74-routes"
import { createM74Authority } from "../calculation/m74-authority"
import { createAnnualEvidenceRoutes } from "../workspace/m68-routes"
import { createAnnualEvidenceReportRoutes } from "../workspace/m68-report-routes"
import { createAnnualWorksheetRoutes } from "../workspace/m67-routes"
import { createAnnualWorksheetReportRoutes } from "../workspace/m67-report-routes"
import { createSourceWorksheetRoutes } from "../workspace/m66-routes"
import { createSourceWorksheetReportRoutes } from "../workspace/m66-report-routes"
import { createElectricitySourceRoutes } from "../workspace/m66-source-routes"
import { createWorksheetReportRoutes } from "../workspace/m65-routes"
import { createWorksheetRoutes } from "../workspace/m64-routes"
import { COLLECTION_EVIDENCE_MAX_BYTES, EXISTING_PROJECT_REF, HostedWorkspaceDatabase, STAGING_COLLECTION_SCHEMA_VERSION, STAGING_SCHEMA_BRIDGE_VERSION, STAGING_SCHEMA_VERSION, STAGING_SCOPE3_COMPLETION_SCHEMA_VERSION, STAGING_SCOPE3_SCHEMA_VERSION, STAGING_SERVED_SCHEMA_VERSIONS, loadStagingDatabaseCa, SCOPE3_CSV_LABELS, type WorkspaceDatabase, type CompanyWorkspaceRecord } from "@neuvetra/database"
import { createClient } from "@supabase/supabase-js"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"
import { extractBearerToken, isPlausibleUnexpiredJwt, validateUserFromToken, type AuthenticatedUser } from "../lib/auth"
import { CLIENT_ADDRESS_HEADERS, createRateLimiter, proxiedClientAddress } from "../lib/rate-limit"
import { createWorkspaceRoutes } from "../workspace/routes"
import { createWorkspaceStore } from "../workspace/service"
import { createM80BetaRoutes } from "../workspace/m80-beta-routes"
import { createCompanySetupRoutes } from "../workspace/company-setup-routes"
import { createCollectionRoutes, type CollectionEvidenceStorage } from "../workspace/collection-routes"
import { createCollectionResultsRoutes, REVIEWED_SCOPE1_ENGINE_SHA256, REVIEWED_SCOPE2_ENGINE_SHA256, REVIEWED_SCOPE12_BATCH_SHA256, type CollectionResultsEngines } from "../workspace/collection-results-routes"
import { createScope1Engine } from "../calculation/scope1-authority"
import { createScope2Engine } from "../calculation/scope2-authority"
import { createScope3Engine } from "../calculation/scope3-authority"
import { createScope3ResultsRoutes, createScope3ResultsRunner, REVIEWED_SCOPE3_ENGINE_SHA256, type Scope3ResultsEngine } from "../workspace/scope3-results-routes"
import { createSupabaseCollectionEvidenceStorage } from "../workspace/collection-storage"
import { createScope3AssessmentRoutes } from "../workspace/scope3-assessment-routes"
import { createScope3SpendImportRoutes } from "../workspace/scope3-spend-import-routes"
import { createBulkWriteGate } from "../workspace/bulk-write-gate"
// Round 3 (EN-9): the package's public export.
import { SCOPE3_SPEND_IMPORT_MAX_BYTES } from "@neuvetra/database"
import { createScope3ReportRoutes } from "../workspace/scope3-report-routes"
import { readStagingConfig, STAGING_PROFILE, type StagingConfig } from "./config"
import { serveStagingAsset, verifyStagingAssets } from "./assets"
import { createReadinessCache } from "./readiness-cache"

const MAX_BODY_BYTES = 300_000
const COLLECTION_EVIDENCE_UPLOAD = /^\/workspace\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/collection\/evidence$/i
/** I-09: a spend import carries the CSV bytes (≤ 2 MB, DESIGN 3.6), bounded on its own like evidence uploads. */
const SCOPE3_SPEND_IMPORT = /^\/workspace\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/scope3\/spend-imports$/i
const LEGACY_CALIFORNIA_ROUTE = /^\/workspace\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(?:electricity-worksheet|source-electricity-worksheet|annual-electricity-worksheet|annual-electricity-evidence|fugitive-sources|fugitive-population)(?:\/|$)/i
type Access = { workspace: CompanyWorkspaceRecord; role: "owner" | "admin" | "member"; evidenceId: string | null }
export type StagingDatabase = WorkspaceDatabase & {
  hasStagingAccess(userId: string): Promise<boolean>
  findStagingWorkspaceForUser(userId: string): Promise<Access | null>
  findStagingMembershipForUser(userId: string): Promise<{ companyId: string; role: "owner" | "admin" | "member"; evidenceId: string | null } | null>
  checkReadiness(): Promise<{ profile: string; schemaVersion: number; legacyContainmentVerified?: boolean; storageGuardGrantsMissing?: boolean; missingStorageGuardGrants?: Array<{ signature: string; role: string }> }>
}

/**
 * BF-10: emitted at boot and then at most once a minute while readiness reports a reviewed Storage policy guard that anon
 * or authenticated cannot execute (Storage uploads and reads then fail with 42501). The workspace keeps serving.
 */
export interface StagingStorageGuardWarning {
  event: "storage_guard_grants_missing"
  missing: Array<{ signature: string; role: string }>
}

export interface StagingLog {
  event: "request"
  requestId: string
  route: "health" | "ready" | "config" | "session" | "workspace" | "asset" | "unknown"
  status: number
  durationMs: number
}

/**
 * API-02: emitted at most once a minute when a workspace request had no usable client-address header and fell back to
 * the shared "unknown" per-address key (every such client then shares one budget). Names headers only, never values.
 */
export interface StagingAddressWarning {
  event: "client_address_unknown"
  /** Each address header and whether it was absent or present without a usable value. */
  headers: Record<(typeof CLIENT_ADDRESS_HEADERS)[number], "absent" | "empty">
  /** Requests that fell back since the previous warning, this one included. */
  occurrences: number
}

export interface StagingOverrides {
  database?: StagingDatabase
  validateUser?: (token: string) => Promise<AuthenticatedUser | null>
  verifyAssets?: () => Promise<void>
  serveAsset?: (pathname: string) => Promise<Response | null>
  collectionEvidenceStorage?: CollectionEvidenceStorage
  resultsEngines?: CollectionResultsEngines
  /** Scope 3 package 2: the Scope 3 engine for draft Scope 3 results (tests only). */
  scope3ResultsEngine?: Scope3ResultsEngine
  log?: (event: StagingLog) => void
  /** API-02: sink for `StagingAddressWarning`; defaults to one JSON line on stderr. */
  warn?: (event: StagingAddressWarning) => void
  /** BF-10: sink for `StagingStorageGuardWarning`; defaults to one JSON line on stderr. */
  storageGuardWarn?: (event: StagingStorageGuardWarning) => void
  /** BF-19: the readiness cache's clock in milliseconds (tests only; default `performance.now`). */
  readinessClock?: () => number
}

/** BF-19: the one readiness failure the owner can act on; /ready and the start-up log name it (nothing else is disclosed). */
const SESSION_SETTINGS_REASON = "database_session_settings_not_applied"
const failureReason = (error: unknown) => (error as { reason?: unknown } | null)?.reason === SESSION_SETTINGS_REASON ? { reason: SESSION_SETTINGS_REASON } : {}

function json(status: number, value: unknown) { return Response.json(value, { status }) }
/** Round 3 lane C (PR-3): a refused request says to wait, and when (Retry-After, seconds until the window resets). */
export const STAGING_RATE_LIMIT_TEXT = "Too many requests in the last minute. Wait about a minute, then try again; nothing you saved was lost."
function rateLimited(resetAt: number) { return Response.json({ code: "rate_limited", error: STAGING_RATE_LIMIT_TEXT }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.min(60, Math.ceil((resetAt - Date.now()) / 1000)))) } }) }

async function boundedRequest(request: Request, url: URL, maxBytes = MAX_BODY_BYTES): Promise<Request> {
  const claimed = request.headers.get("content-length")
  if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > maxBytes)) throw new Error("Request too large.")
  if (!request.body) return new Request(url, request)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) { await reader.cancel(); throw new Error("Request too large.") }
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
  const database: StagingDatabase = overrides.database ?? await HostedWorkspaceDatabase.create({ connectionString: config.databaseUrl, expectedProjectRef: config.projectRef, reuseExistingProject: config.reuseExistingProject, maxConnections: config.databasePoolSize, tlsCaPem: await loadStagingDatabaseCa({ caPem: config.databaseCaPem, caFile: config.databaseCaFile }) })
  // API-02: the cheap structural/`exp` pre-check accompanies the real Supabase validator, whose tokens are JWTs. A test
  // that injects its own validator also chooses its own token format, so the pre-check is not applied to it.
  const precheck = overrides.validateUser ? null : isPlausibleUnexpiredJwt
  const auth = overrides.validateUser ?? (() => {
    const boundedFetch = ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(5_000) })) as typeof fetch
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: boundedFetch } })
    return (token: string) => validateUserFromToken(token, client, { throwWhenUnavailable: true })
  })()
  const checkAssets = overrides.verifyAssets ?? (() => verifyStagingAssets(config.webRoot))
  const serveAsset = overrides.serveAsset ?? ((pathname: string) => serveStagingAsset(config.webRoot, pathname))
  const evidenceStorage = overrides.collectionEvidenceStorage ?? createSupabaseCollectionEvidenceStorage({
    url: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) })) as typeof fetch,
  })
  const log = overrides.log ?? ((event: StagingLog) => console.info(JSON.stringify(event)))
  const warn = overrides.warn ?? ((event: StagingAddressWarning) => console.warn(JSON.stringify(event)))
  const storageGuardWarn = overrides.storageGuardWarn ?? ((event: StagingStorageGuardWarning) => console.warn(JSON.stringify(event)))
  let storageGuardWarnedAt = -Infinity
  const noteStorageGuards = (missing: Array<{ signature: string; role: string }> | undefined) => {
    if (!missing?.length) return
    const now = Date.now()
    if (now - storageGuardWarnedAt < 60_000) return
    storageGuardWarnedAt = now
    try { storageGuardWarn({ event: "storage_guard_grants_missing", missing: missing.map(({ signature, role }) => ({ signature, role })) }) } catch { /* A log failure never changes the response. */ }
  }
  // API-02 (QA F2): Railway is assumed to send a per-client address. If a request ever falls back to the shared "unknown"
  // key, say so, at most once a minute, so the assumption can be checked from the logs without flooding them.
  let unknownAddressWarnedAt = -Infinity, unknownAddressOccurrences = 0
  const noteUnknownAddress = (headers: Headers) => {
    unknownAddressOccurrences += 1
    const now = Date.now()
    if (now - unknownAddressWarnedAt < 60_000) return
    unknownAddressWarnedAt = now
    const state = (name: (typeof CLIENT_ADDRESS_HEADERS)[number]) => headers.get(name) === null ? "absent" as const : "empty" as const
    const event: StagingAddressWarning = { event: "client_address_unknown", headers: { "x-real-ip": state("x-real-ip"), "x-forwarded-for": state("x-forwarded-for") }, occurrences: unknownAddressOccurrences }
    unknownAddressOccurrences = 0
    try { warn(event) } catch { /* A log failure never changes the response. */ }
  }
  // Spend review can make several authenticated reads per correction. Allow a sustained review session
  // (300/user/minute), while bounding the instance to 1,200/minute of staging users' requests.
  // API-01 (CTO audit risk 3): nothing a caller can send before proving who they are spends a budget other people
  // depend on. Order per request, after the local token pre-check: `overLimitTokens` (a token already refused by its
  // user's limit this window is refused again before anything else) -> `unverified` (per client address, before any
  // token validation or SQL) -> token validation -> readiness -> staging access -> `actors` (per user) -> release of
  // `unverified`, only for a staging user within their own limit -> `admission` (instance ceiling).
  // `unverified` is the only bound on validation calls and SQL per address for callers who are not staging users, so
  // it stays spent by invalid and expired tokens, by validated accounts without staging access (the shared Supabase
  // project has self-service sign-up elsewhere, so such accounts can be minted) and by requests still in flight.
  // BF-04 (BL-04): a staging user within their own limit gives the count back, so their traffic never spends their
  // address's budget. When `actors` refuses one, the count stays spent and the token is remembered until the user's
  // window resets: repeating that token is refused before the address budget, validation or SQL, so an over-limit user
  // never refuses a colleague behind the same address, and each new token they bring costs that address one count (so
  // cycling fresh tokens is still bounded at 120 validations per address per minute).
  // `actors` tracks up to 10,000 users so count eviction cannot reset a user's limit (worst case a few MB; see BF-04).
  // Public config is limited per address too, so no single address can refuse the app's configuration to everyone else.
  const admission = createRateLimiter({ max: 1200, windowMs: 60_000, maxBuckets: 1 })
  const configAdmission = createRateLimiter({ max: 1200, windowMs: 60_000, maxBuckets: 10_000 })
  const unverified = createRateLimiter({ max: 120, windowMs: 60_000, maxBuckets: 10_000 })
  const actors = createRateLimiter({ max: 300, windowMs: 60_000, maxBuckets: 10_000 })
  // BF-04: SHA-256 of a staging user's validated token that `actors` refused -> when that user's window resets. Only ever
  // refuses (never admits), holds only tokens that validated, and is bounded; an evicted entry's next request spends
  // the address budget again, as any new token does.
  const overLimitTokens = new Map<string, number>()
  const tokenKey = (token: string) => createHash("sha256").update(token).digest("hex")
  const overLimitUntil = (token: string) => {
    const key = tokenKey(token), resetAt = overLimitTokens.get(key)
    if (resetAt === undefined) return null
    if (Date.now() < resetAt) return resetAt
    overLimitTokens.delete(key)
    return null
  }
  const rememberOverLimit = (token: string, resetAt: number) => {
    const key = tokenKey(token)
    overLimitTokens.delete(key)
    overLimitTokens.set(key, resetAt)
    if (overLimitTokens.size > 1_000) overLimitTokens.delete(overLimitTokens.keys().next().value!)
  }
  // API-02 (QA F1): the dispatcher has already validated this request's token and checked staging access before any
  // route runs. It records the result in this per-request async context (set only by server code, never derived from
  // anything the client sends), so a route validating the same token in the same request reuses it instead of calling
  // Supabase and the database again. Any other token, or a call outside a dispatched request, is validated in full.
  const verifiedRequest = new AsyncLocalStorage<{ token: string; user: AuthenticatedUser }>()
  const validateUser = async (token: string) => {
    const verified = verifiedRequest.getStore()
    if (verified && verified.token === token) return verified.user
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
  const corporateInventoryRoutes=createCorporateInventoryRoutes({database,validateUser,origin:config.origin})
  const stationaryGasRoutes=createM73Routes({database,validateUser,origin:config.origin,authority:createM73Authority()})
  const controlledFleetRoutes=createM75Routes({database,validateUser,origin:config.origin,authority:createM74Authority()})
  const stationaryEquipmentRoutes=createM76Routes({database,validateUser,origin:config.origin,authorities:{gas:createM73Authority(),diesel:createM76DieselAuthority()}})
  const fugitiveRoutes=createM77Routes({database,validateUser,origin:config.origin,authority:createM77Authority()})
  const scope1Routes=createM78Routes({database,validateUser,origin:config.origin,authorities:{gas:createM73Authority(),mobile:createM74Authority(),diesel:createM76DieselAuthority(),fugitive:createM77Authority()},policy:M78_REVIEWED_POLICY})
  const scope1BetaRoutes=createM80BetaRoutes({database,validateUser,origin:config.origin})
  const companySetupRoutes=createCompanySetupRoutes({database,validateUser,origin:config.origin})
  // Scope 3 package 2 (D5) and completion I-02: the 0029 kinds exist from schema 29 and the 0030 kinds and payload
  // features from 30; below that the route refuses the save with 503 before any SQL.
  const collectionRoutes=createCollectionRoutes({database,validateUser,origin:config.origin,evidenceStorage,schemaVersion:async()=>(await databaseReadiness()).schemaVersion})
  // Board 2026-09-29: draft numbers from unreleased methods only in this private synthetic staging server (profile checked above).
  const resultsRoutes=createCollectionResultsRoutes({database,validateUser,origin:config.origin,environment:"synthetic_staging",engines:overrides.resultsEngines ?? { scope1: createScope1Engine({ expectedEngineSha256: REVIEWED_SCOPE1_ENGINE_SHA256, expectedBatchSha256: REVIEWED_SCOPE12_BATCH_SHA256 }), scope2: createScope2Engine({ expectedEngineSha256: REVIEWED_SCOPE2_ENGINE_SHA256, expectedBatchSha256: REVIEWED_SCOPE12_BATCH_SHA256 }) }})
  // I-04: Scope 3 results read the category assessments only when the database is at schema 30 (0030); below it, never.
  // I-10: the results route and the report route share one runner, so a frozen report version holds exactly the figures
  // /results/scope3 gives (one run per company at a time).
  const scope3Engine=overrides.scope3ResultsEngine ?? createScope3Engine({ expectedEngineSha256: REVIEWED_SCOPE3_ENGINE_SHA256 })
  const scope3Results=createScope3ResultsRunner({database,engine:scope3Engine,schemaVersion:async()=>(await databaseReadiness()).schemaVersion})
  const scope3ResultsRoutes=createScope3ResultsRoutes({database,validateUser,origin:config.origin,environment:"synthetic_staging",engine:scope3Engine,schemaVersion:async()=>(await databaseReadiness()).schemaVersion,runner:scope3Results})
  // I-10: frozen Scope 3 report versions (0030); the /scope3/ gate below refuses them before any SQL below schema 30. The
  // stored CSV is written with the web's own label functions, so it is the bytes the Results screen would download.
  const scope3ReportRoutes=createScope3ReportRoutes({database,validateUser,origin:config.origin,results:scope3Results,engineSha256:REVIEWED_SCOPE3_ENGINE_SHA256,labels:SCOPE3_CSV_LABELS})
  // I-04: Scope 3 category assessments (0030); the /scope3/ gate below refuses them before any SQL below schema 30.
  const scope3AssessmentRoutes=createScope3AssessmentRoutes({database,validateUser,origin:config.origin})
  // I-09: spend CSV imports and mappings (0030); behind the same /scope3/ schema-30 gate.
  // BF-19 (BI-02): one gate per instance for every bulk spend write (import, conversion, mapping correction, withdrawal).
  const bulkWriteGate=createBulkWriteGate()
  const scope3SpendImportRoutes=createScope3SpendImportRoutes({database,validateUser,origin:config.origin,bulkWriteGate})
  const mobileDieselRoutes=createM74Routes({database,validateUser,origin:config.origin,authority:createM74Authority()})
  const annualEvidenceRoutes=createAnnualEvidenceRoutes({database,validateUser,origin:config.origin})
  const annualEvidenceReportRoutes=createAnnualEvidenceReportRoutes({database,validateUser,origin:config.origin})
  const annualWorksheetRoutes=createAnnualWorksheetRoutes({database,validateUser,origin:config.origin})
  const annualReportRoutes=createAnnualWorksheetReportRoutes({database,validateUser,origin:config.origin})
  const sourceWorksheetRoutes=createSourceWorksheetRoutes({database,validateUser,origin:config.origin})
  const sourceReportRoutes=createSourceWorksheetReportRoutes({database,validateUser,origin:config.origin})
  const electricitySourceRoutes=createElectricitySourceRoutes({database,validateUser,origin:config.origin})
  const reportRoutes = createWorksheetReportRoutes({ database, validateUser, origin: config.origin })
  const worksheetRoutes = createWorksheetRoutes({ database, validateUser, origin: config.origin })
  const checkDatabaseReadiness = async () => {
    const receipt = await database.checkReadiness()
    // BF-10 (CEO ruling): reported and logged, never a reason to stop serving.
    if (receipt.storageGuardGrantsMissing) noteStorageGuards(receipt.missingStorageGuardGrants)
    const existingProject = config.projectRef === EXISTING_PROJECT_REF
    const current = receipt.schemaVersion === STAGING_SCHEMA_VERSION
    const upgrading = existingProject && config.reuseExistingProject && receipt.legacyContainmentVerified === true
      && receipt.schemaVersion >= STAGING_SCHEMA_BRIDGE_VERSION && receipt.schemaVersion < STAGING_SCHEMA_VERSION
    if (receipt.profile !== STAGING_PROFILE || (!current && !upgrading)) throw new Error("Staging database unavailable.")
    if (existingProject && (!config.reuseExistingProject || receipt.legacyContainmentVerified !== true)) throw new Error("Existing project containment unavailable.")
    return receipt
  }
  // BF-19 (lead 5): the guard before every workspace request keeps a fully validated success for 5 s and never a failure;
  // /ready always checks afresh (and its answer replaces the kept one). See readiness-cache.ts.
  const readinessCache = createReadinessCache(checkDatabaseReadiness, overrides.readinessClock ? { now: overrides.readinessClock } : {})
  const databaseReadiness = async (fresh = false) => {
    const receipt = await readinessCache.get({ fresh })
    // BF-10: a kept receipt still reports a missing Storage guard grant (the warning keeps its own once-a-minute limit).
    if (receipt.storageGuardGrantsMissing) noteStorageGuards(receipt.missingStorageGuardGrants)
    return receipt
  }
  const served = (schemaVersion: number) => STAGING_SERVED_SCHEMA_VERSIONS.includes(schemaVersion)
  const readiness = async () => {
    const receipt = await databaseReadiness(true)
    if (!served(receipt.schemaVersion)) throw new Error("Staging database is upgrading.")
    await checkAssets()
    return receipt
  }
  // The schema-30 image starts and reports ready at exactly 28, 29 and 30 (hosted
  // 0029 is on hold); any other prefix refuses to start.
  try { await databaseReadiness(true); await checkAssets() } catch (error) { await database.close(); throw Object.assign(new Error("Private staging dependencies are unavailable."), failureReason(error)) }

  const routeName = (pathname: string): StagingLog["route"] => pathname === "/health" ? "health" : pathname === "/ready" ? "ready" : pathname === "/workspace-api/config" ? "config" : pathname === "/workspace-api/session" ? "session" : pathname.startsWith("/workspace-api/workspace") ? "workspace" : pathname === "/" || pathname === "/workspace" || pathname.startsWith("/assets/") ? "asset" : "unknown"

  /** A workspace request whose user is validated, has staging access and is within every limit. */
  async function routeAdmitted(request: Request, url: URL, user: AuthenticatedUser, requestReadiness: Awaited<ReturnType<typeof databaseReadiness>> | undefined, options: StagingFetchOptions): Promise<Response> {
    const isGet = request.method === "GET"
    url.pathname = url.pathname.slice("/workspace-api".length)
    // Round 3 (EN-7): a longer listener allowance only here, after the bearer token named a user with staging access, and
    // only for the two routes that need it at the line cap (prepare: about 30-40 s; results: one run of up to 25 s, plus
    // the wait behind a run already in progress for the company). Every other request keeps the listener's 30 s.
    if (request.method === "POST" && SCOPE3_REPORT_PREPARE_ROUTE.test(url.pathname)) options.extendTimeout?.(SCOPE3_REPORT_PREPARE_TIMEOUT_SECONDS)
    if (isGet && SCOPE3_RESULTS_ROUTE.test(url.pathname)) options.extendTimeout?.(SCOPE3_RESULTS_TIMEOUT_SECONDS)
    // BI-01: the Scope 1 and 2 results route gets the same allowance (one run has a 25 s budget, and a request that arrives
    // while a run is in progress for the company waits for it first).
    if (isGet && COLLECTION_RESULTS_ROUTE.test(url.pathname)) options.extendTimeout?.(SCOPE3_RESULTS_TIMEOUT_SECONDS)
    // Collection and draft-results SQL exist from schema 27 (0027), so both stay
    // available at 28, 29 and 30. Scope 3 records and Scope 3 results exist only
    // from 29 (0029): below it they are refused here, and the collection route
    // refuses a Scope 3 save before any SQL. Scope 3 assessments, spend imports
    // and report versions exist only from 30 (0030): below it every
    // /workspace/:id/scope3/... route is refused here before any SQL.
    if (/^\/workspace\/[0-9a-f-]+\/(?:collection(?:\/|$)|results(?:\/scope3)?$|scope3(?:\/|$))/i.test(url.pathname)) {
      const receipt = requestReadiness ?? await databaseReadiness()
      if (receipt.schemaVersion < STAGING_COLLECTION_SCHEMA_VERSION) return json(503, { code: "collection_unavailable", error: "Activity and evidence is not available yet." })
      if (/\/results\/scope3$/i.test(url.pathname) && receipt.schemaVersion < STAGING_SCOPE3_SCHEMA_VERSION) return json(503, { code: "scope3_unavailable", error: "Scope 3 results are not available yet." })
      if (/^\/workspace\/[0-9a-f-]+\/scope3(?:\/|$)/i.test(url.pathname) && receipt.schemaVersion < STAGING_SCOPE3_COMPLETION_SCHEMA_VERSION) return json(503, { code: "scope3_schema_30_required", error: "This Scope 3 feature needs database schema 30." })
    }
    let forwarded: Request
    const evidenceUpload = request.method === "POST" && COLLECTION_EVIDENCE_UPLOAD.test(url.pathname)
    try {
      // Evidence is the only larger request class. Its route consumes the
      // stream with its own 10 MiB bound; ordinary workspace requests retain
      // the 300 kB buffered cap.
      forwarded = evidenceUpload ? new Request(url, request) : await boundedRequest(request, url, request.method === "POST" && SCOPE3_SPEND_IMPORT.test(url.pathname) ? SCOPE3_SPEND_IMPORT_MAX_BYTES : undefined)
    } catch { return json(413, { error: "Request too large." }) }
    const legacyCalifornia = LEGACY_CALIFORNIA_ROUTE.exec(url.pathname)
    if (legacyCalifornia) {
      const geography = await database.findCompanyGeography(user.id, legacyCalifornia[1]!)
      if (geography?.countryCode !== "US" || geography.stateCode !== "CA") return json(404, { error: "Not found." })
    }
    if (url.pathname.includes("/corporate-inventories")) return corporateInventoryRoutes(forwarded)
    if (/^\/workspace\/[0-9a-f-]+\/results$/i.test(url.pathname)) return resultsRoutes(forwarded)
    if (/^\/workspace\/[0-9a-f-]+\/results\/scope3$/i.test(url.pathname)) return scope3ResultsRoutes(forwarded)
    if (/^\/workspace\/[0-9a-f-]+\/collection(?:\/|$)/i.test(url.pathname)) return collectionRoutes(forwarded)
    if (/^\/workspace\/[0-9a-f-]+\/scope3\/assessments(?:\/|$)/i.test(url.pathname)) return scope3AssessmentRoutes(forwarded)
    if (/^\/workspace\/[0-9a-f-]+\/scope3\/spend-(?:(?:imports|mappings)(?:\/[0-9a-f-]+\/withdrawal)?|currency-conversions)$/i.test(url.pathname)) return scope3SpendImportRoutes(forwarded)
    if (/^\/workspace\/[0-9a-f-]+\/scope3\/reports(?:\/|$)/i.test(url.pathname)) return scope3ReportRoutes(forwarded)
    if (/^\/workspace\/[0-9a-f-]+\/setup(?:\/|$)/i.test(url.pathname)) {
      // Company setup exists at 28, 29 and 30.
      const receipt = requestReadiness ?? await databaseReadiness()
      if (!served(receipt.schemaVersion)) return json(503, { error: "Company setup is unavailable." })
      return companySetupRoutes(forwarded)
    }
    if (url.pathname.includes("/scope1-beta-setup")) return scope1BetaRoutes(forwarded)
    if (url.pathname.includes('/process-screen') || url.pathname.includes('/scope1-inventory')) return scope1Routes(forwarded)
    if (url.pathname.includes("/stationary-natural-gas")) return stationaryGasRoutes(forwarded)
    if (url.pathname.includes("/controlled-fleet")) return controlledFleetRoutes(forwarded)
    if (url.pathname.includes("/stationary-equipment") || url.pathname.includes("/stationary-diesel")) return stationaryEquipmentRoutes(forwarded)
    if (url.pathname.includes("/fugitive-sources") || url.pathname.includes("/fugitive-population")) return fugitiveRoutes(forwarded)
    if (url.pathname.includes("/mobile-diesel")) return mobileDieselRoutes(forwarded)
    if (url.pathname.includes("/annual-electricity-evidence/reports")) return annualEvidenceReportRoutes(forwarded)
    if (url.pathname.includes("/annual-electricity-evidence")) return annualEvidenceRoutes(forwarded)
    if (url.pathname.includes("/annual-electricity-worksheet/reports")) return annualReportRoutes(forwarded)
    if (url.pathname.includes("/annual-electricity-worksheet")) return annualWorksheetRoutes(forwarded)
    if (url.pathname.includes("/source-electricity-worksheet/sources")) return electricitySourceRoutes(forwarded)
    if (url.pathname.includes("/source-electricity-worksheet/reports")) return sourceReportRoutes(forwarded)
    if (url.pathname.includes("/source-electricity-worksheet")) return sourceWorksheetRoutes(forwarded)
    if (url.pathname.includes("/electricity-worksheet/reports")) return reportRoutes(forwarded)
    if (url.pathname.includes("/electricity-worksheet")) return worksheetRoutes(forwarded)
    return routes.handle(forwarded)
  }

  async function dispatch(request: Request, options: StagingFetchOptions): Promise<Response> {
    const url = new URL(request.url)
    const isGet = request.method === "GET"
    if (url.pathname === "/health" && isGet) return json(200, { status: "alive" })
    if (url.pathname === "/ready" && isGet) {
      try { const receipt = await readiness(); return json(200, { status: "ready", ...receipt }) }
      // BF-19: a session without lock_timeout/statement_timeout says so; every other failure keeps its exact body.
      catch (error) { return json(503, { status: "unavailable", ...failureReason(error) }) }
    }
    if (url.pathname.startsWith("/workspace-api/")) {
      const origin = request.headers.get("origin")
      if ((origin && origin !== config.origin) || (!isGet && origin !== config.origin)) return json(403, { error: "Forbidden." })
      const publicConfig = url.pathname === "/workspace-api/config" && isGet
      const token = extractBearerToken(request.headers)
      // A request that cannot authenticate never spends any budget. API-02: neither does a token that cannot be a live
      // Supabase JWT (wrong shape, or `exp` in the past); it is refused here without a network call or any SQL.
      if (!publicConfig && (!token || token.length > 8192 || (precheck && !precheck(token)))) return json(401, { error: "Authentication required." })
      // BF-04: a token already found over its user's limit this window spends nothing and makes no validation call.
      const overLimitResetAt = !publicConfig && token ? overLimitUntil(token) : null
      if (overLimitResetAt !== null) return rateLimited(overLimitResetAt)
      const proxied = proxiedClientAddress(request.headers)
      if (!proxied) noteUnknownAddress(request.headers)
      const client = proxied ?? "unknown"
      const provisional = (publicConfig ? configAdmission : unverified).check(client)
      if (!provisional.allowed) return rateLimited(provisional.resetAt)
      const existingProject = config.projectRef === EXISTING_PROJECT_REF
      if (publicConfig) {
        if (existingProject && !served((await databaseReadiness()).schemaVersion)) return json(503, { error: "Staging database is upgrading." })
        return json(200, { profile: STAGING_PROFILE, supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey })
      }
      if (!token) return json(401, { error: "Authentication required." })
      let user: AuthenticatedUser | null
      try { user = await auth(token) } catch { return json(503, { error: "Authentication is unavailable." }) }
      if (!user) return json(401, { error: "Authentication required." })
      // API-02 (QA F1): the existing project's per-request readiness SQL runs only for a validated user, and still before
      // this request's first other SQL (staging access).
      const requestReadiness = existingProject ? await databaseReadiness() : undefined
      if (requestReadiness && !served(requestReadiness.schemaVersion)) return json(503, { error: "Staging database is upgrading." })
      // Without staging access the address count stays spent, so such accounts stay bounded per address.
      if (!await database.hasStagingAccess(user.id)) return json(403, { error: "Private staging access required." })
      const allowance = actors.check(user.id)
      // BF-04: over their own limit, the count stays spent and the token is remembered (see `overLimitTokens`).
      if (!allowance.allowed) { rememberOverLimit(token, allowance.resetAt); return rateLimited(allowance.resetAt) }
      // BF-04 (BL-04): a staging user within their own limit leaves the per-address budget and spends the instance one.
      unverified.release(client, provisional)
      const admitted = admission.check("staging")
      if (!admitted.allowed) return rateLimited(admitted.resetAt)
      if (url.pathname === "/workspace-api/session" && isGet) {
        const access = await database.findStagingMembershipForUser(user.id)
        if (!access) return json(403, { error: "Private staging access required." })
        return json(200, { profile: STAGING_PROFILE, user: { id: user.id }, access: { role: access.role, workspaceId: access.companyId, evidenceId: access.evidenceId } })
      }
      return verifiedRequest.run({ token, user }, () => routeAdmitted(request, url, user, requestReadiness, options))
    }
    if (isGet) return await serveAsset(url.pathname) ?? json(404, { error: "Not found." })
    return json(404, { error: "Not found." })
  }

  return {
    async fetch(request: Request, options: StagingFetchOptions = {}) {
      const started = performance.now()
      const requestId = crypto.randomUUID()
      let response: Response
      try { response = await dispatch(request, options) } catch { response = json(503, { error: "Private staging is unavailable." }) }
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

/**
 * Round 2c integration (DESIGN 13.8): the listener closes a connection idle for 30 seconds, and a request whose response
 * has not started counts as idle. Preparing a Scope 3 report at the line cap took 38 s natively (3,000 worst-case commuting
 * records), so that route gets 120 seconds (Bun allows up to 255); every other request keeps the listener's 30.
 * Round 3 (EN-7): the allowance is granted by the server itself, only after authentication (a bearer token naming a user
 * with staging access) and the route match, through `extendTimeout`; the listener no longer grants it by path, so an
 * unauthenticated request never holds a socket longer than 30 s. The Scope 3 results route gets a documented 90 s: one run
 * at the line cap took about 10 s (budget 25 s), and a request that arrives while a run is in progress for the company
 * waits for it and then runs (about 20 s measured for two at once).
 */
export const SCOPE3_REPORT_PREPARE_TIMEOUT_SECONDS = 120
export const SCOPE3_RESULTS_TIMEOUT_SECONDS = 90
const SCOPE3_REPORT_PREPARE_ROUTE = /^\/workspace\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/scope3\/reports$/i
const COLLECTION_RESULTS_ROUTE = /^\/workspace\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/results$/i
const SCOPE3_RESULTS_ROUTE = /^\/workspace\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/results\/scope3$/i
/** Round 3 (EN-7): what the listener lets the server do for one request (the server decides when). */
export interface StagingFetchOptions { extendTimeout?(seconds: number): void }
export function stagingListenerFetch(app: { fetch: (request: Request, options?: StagingFetchOptions) => Response | Promise<Response> }) {
  return (request: Request, server: { timeout(request: Request, seconds: number): void }) => app.fetch(request, { extendTimeout: seconds => server.timeout(request, seconds) })
}

if (import.meta.main) {
  try {
    const config = readStagingConfig()
    const app = await createStagingServer(config)
    const server = Bun.serve({ hostname: "0.0.0.0", port: config.port, maxRequestBodySize: COLLECTION_EVIDENCE_MAX_BYTES, idleTimeout: 30, fetch: stagingListenerFetch(app) })
    const shutdown = async () => { await server.stop(); await app.close(); process.exit(0) }
    process.once("SIGINT", shutdown)
    process.once("SIGTERM", shutdown)
    console.info(JSON.stringify({ event: "staging_started", profile: STAGING_PROFILE }))
  } catch (error) {
    // BF-19: the session-settings cause is named for the owner (operations/hosted-setup/bf19-database-pool-runbook.md).
    console.error(JSON.stringify({ event: "staging_start_failed", ...failureReason(error) }))
    process.exitCode = 1
  }
}
import {createM78Routes} from '../workspace/m78-routes'
import {M78_REVIEWED_POLICY} from '../../../../packages/neuvetra-database/src/m78-policy'
