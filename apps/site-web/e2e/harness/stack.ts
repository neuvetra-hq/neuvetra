/**
 * E2E-01: the real local stack. `createStagingServer` from apps/site-api, on a loopback listener, serving the built
 * site-web staging bundle (apps/site-web/dist-staging) and talking to the e2e PostgreSQL database as the restricted
 * runtime role. Only three things are injected, all through the server's existing test seams (`StagingOverrides`):
 * the database connection (loopback, no TLS), the token validator (no Supabase) and the evidence store (in memory).
 */
import path from "node:path"
import { COLLECTION_EVIDENCE_MAX_BYTES, createPostgresConnection, HostedWorkspaceDatabase, type WorkspaceConnection } from "../../../../packages/neuvetra-database/src/index"
import { createStagingServer, stagingListenerFetch, type StagingDatabase } from "../../../site-api/src/staging/server"
import { readStagingConfig, STAGING_PROFILE } from "../../../site-api/src/staging/config"
import { E2E_PROJECT_REF, prepareDatabase } from "./database"
import { seed, USERS, type UserKey } from "./seed"

/** The built staging bundle under test: apps/site-web/dist-staging, or E2E_WEB_ROOT (for example another branch's build). */
export const WEB_ROOT = path.resolve(process.env.E2E_WEB_ROOT || path.join(import.meta.dir, "../../dist-staging"))

/**
 * Who the server believes a bearer token belongs to. Tokens are `e2e-<user>-<n>`: a new sign-in gets a new token, and a
 * test ends a session by revoking its token (the server then answers 401, exactly as for an expired Supabase session).
 */
export class TokenDirectory {
  private readonly tokens = new Map<string, UserKey>()
  private issued = 0
  issue(user: UserKey): string { const token = `e2e-${user}-${++this.issued}`; this.tokens.set(token, user); return token }
  revoke(token: string) { this.tokens.delete(token) }
  revokeUser(user: UserKey) { for (const [token, owner] of this.tokens) if (owner === user) this.tokens.delete(token) }
  userOf(token: string): UserKey | null { return this.tokens.get(token) ?? null }
}

export interface Stack {
  origin: string
  tokens: TokenDirectory
  operator: WorkspaceConnection
  /** A JSON request to the workspace API as `user` (for seeding and for assertions against the server's own answers). */
  api<T = unknown>(user: UserKey, route: string, init?: { body?: unknown; raw?: Uint8Array<ArrayBuffer>; headers?: Record<string, string>; method?: "GET" | "POST" | "PUT" }): Promise<T>
  stop(): Promise<void>
}

export async function startStack(databaseUrl: string): Promise<Stack> {
  if (!await Bun.file(path.join(WEB_ROOT, "index.html")).exists()) throw new Error("Build the staging bundle first: cd apps/site-web && bun run build:staging")
  const prepared = await prepareDatabase(databaseUrl)
  const tokens = new TokenDirectory()
  const stored = new Map<string, Uint8Array<ArrayBuffer>>()
  // Requests per minute, to keep the suite well inside the server's per-user limit (300 a minute); printed with E2E_VERBOSE.
  const perMinute = new Map<number, number>()
  let handler: ((request: Request, server: { timeout(request: Request, seconds: number): void }) => Response | Promise<Response>) | null = null
  const listener = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 120, maxRequestBodySize: COLLECTION_EVIDENCE_MAX_BYTES,
    fetch: (request, server) => handler ? handler(request, server) : new Response("Starting", { status: 503 }) })
  const origin = `http://127.0.0.1:${listener.port}`
  const config = readStagingConfig({
    NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE, NEUVETRA_STAGING_PROJECT_REF: E2E_PROJECT_REF,
    NEUVETRA_STAGING_ORIGIN: origin, SUPABASE_URL: `https://${E2E_PROJECT_REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key",
    DATABASE_URL: `postgres://neuvetra_runtime:fixture@db.${E2E_PROJECT_REF}.supabase.co:5432/postgres`, NEUVETRA_STAGING_WEB_ROOT: WEB_ROOT,
  })
  // The hosted adapter's public factory insists on a Supabase host with TLS; the tests construct it on the loopback connection.
  const Database = HostedWorkspaceDatabase as unknown as new (connection: WorkspaceConnection, projectRef: string, reuseExistingProject: boolean) => StagingDatabase
  const database = new Database(createPostgresConnection(prepared.runtimeUrl, { tls: false, maxConnections: 6 }), E2E_PROJECT_REF, false)
  const app = await createStagingServer(config, {
    database,
    validateUser: async token => {
      const user = tokens.userOf(token)
      return user ? { id: USERS[user].id, email: USERS[user].email, phone: null, fullName: null } : null
    },
    collectionEvidenceStorage: { put: async (_token, _bucket, objectKey, bytes) => { stored.set(objectKey, bytes) }, get: async (_token, _bucket, objectKey) => {
      const bytes = stored.get(objectKey); if (!bytes) throw new Error("Evidence not found."); return bytes } },
    log: () => { const minute = Math.floor(Date.now() / 60_000); perMinute.set(minute, (perMinute.get(minute) ?? 0) + 1) }, warn: () => {},
  })
  handler = stagingListenerFetch(app)

  const api: Stack["api"] = async (user, route, init = {}) => {
    const token = tokens.issue(user)
    try {
      const hasBody = init.body !== undefined || init.raw !== undefined
      const response = await fetch(`${origin}/workspace-api${route}`, { method: init.method ?? (hasBody ? "POST" : "GET"), body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
        headers: { origin, authorization: `Bearer ${token}`, ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...init.headers } })
      const text = await response.text()
      if (response.status >= 300) throw new Error(`${route} answered ${response.status}: ${text.slice(0, 300)}`)
      return JSON.parse(text)
    } finally { tokens.revoke(token) }
  }
  await seed(prepared.operator, api)
  return {
    origin, tokens, operator: prepared.operator, api,
    stop: async () => {
      if (process.env.E2E_VERBOSE) console.info(`Server requests per minute: ${[...perMinute.values()].join(", ")}`)
      await listener.stop(true); await app.close(); await prepared.operator.close() },
  }
}
