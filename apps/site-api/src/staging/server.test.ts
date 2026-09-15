import { afterEach, describe, expect, test } from "bun:test"
import { DevelopmentWorkspaceDatabase } from "@neuvetra/database"
import { createStagingServer, type StagingDatabase, type StagingLog } from "./server"
import { readStagingConfig, STAGING_PROFILE } from "./config"
import { serveStagingAsset, verifyStagingAssets } from "./assets"
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const REF = "abcdefghijklmnopqrst"
const OWNER = "11111111-1111-4111-8111-111111111111"
const ADMIN = "33333333-3333-4333-8333-333333333333"
const MEMBER = "44444444-4444-4444-8444-444444444444"
const OUTSIDER = "22222222-2222-4222-8222-222222222222"
const ORIGIN = "http://127.0.0.1:3015"
const environment = {
  NODE_ENV: "test", NEUVETRA_STAGING_ENABLED: "enabled", NEUVETRA_STAGING_PROFILE: STAGING_PROFILE,
  NEUVETRA_STAGING_PROJECT_REF: REF, NEUVETRA_STAGING_ORIGIN: ORIGIN,
  SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: "sb_publishable_synthetic_fixture_not_a_real_key",
  DATABASE_URL: `postgres://neuvetra_runtime:synthetic-password@db.${REF}.supabase.co:5432/postgres`,
}
const input = { companyName: "Synthetic Acme, Inc.", facilityName: "Synthetic California office", countryCode: "US", stateCode: "CA", egridSubregion: "CAMX", reportingYear: 2023, approach: "operational_control" } as const
let cleanup: (() => Promise<void>) | undefined
afterEach(async () => { await cleanup?.(); cleanup = undefined })

async function fixture() {
  const db = await DevelopmentWorkspaceDatabase.create([OWNER, ADMIN, MEMBER, OUTSIDER])
  const workspace = await db.createWorkspaceWithSyntheticMembers(OWNER, input, [{ userId: ADMIN, role: "admin" }, { userId: MEMBER, role: "member" }])
  const invited = new Set([OWNER, ADMIN, MEMBER, OUTSIDER])
  const users: Record<string, string> = { "test-owner-session": OWNER, "test-admin-session": ADMIN, "test-member-session": MEMBER, "test-outsider-session": OUTSIDER }
  const logs: StagingLog[] = []
  let healthy = true
  let evidenceId: string | null = null
  const database = Object.assign(db, {
    async hasStagingAccess(userId: string) { return invited.has(userId) },
    async findStagingWorkspaceForUser(userId: string) {
      const allowed = invited.has(userId) ? await db.findWorkspace(userId, workspace.id) : null
      if (!allowed) return null
      return { workspace: allowed, role: userId === OWNER ? "owner" as const : userId === ADMIN ? "admin" as const : "member" as const, evidenceId }
    },
    async checkReadiness() { if (!healthy) throw new Error("sensitive-driver-value"); return { profile: STAGING_PROFILE, schemaVersion: 15 } },
  }) as StagingDatabase
  const app = await createStagingServer(readStagingConfig(environment), {
    database, validateUser: async (token) => token === "broken-session" ? Promise.reject(new Error("sensitive-auth-value")) : users[token] ? { id: users[token]!, phone: null, email: "private@example.invalid", fullName: "Private fixture" } : null,
    verifyAssets: async () => {}, serveAsset: async (name) => name === "/" ? new Response("Private staging sign-in") : null,
    log: (event) => logs.push(event),
  })
  cleanup = app.close
  const request = (pathname: string, token?: string, options: RequestInit = {}) => app.fetch(new Request(`${ORIGIN}${pathname}`, { ...options, headers: { origin: ORIGIN, ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers } }))
  return { app, db, workspace, invited, logs, request, unhealthy: () => { healthy = false }, evidence: (id: string) => { evidenceId = id } }
}

describe("M63 private staging boundary", () => {
  test("configuration refuses demo mode, privileged key/login and mismatched targets without displaying secrets", () => {
    expect(readStagingConfig(environment).profile).toBe(STAGING_PROFILE)
    const serviceKey = `x.${Buffer.from(JSON.stringify({ role: "service_role", ref: REF })).toString("base64url")}.y`
    const bad = [
      { NODE_ENV: "development" }, { NEUVETRA_STAGING_ENABLED: "" }, { NEUVETRA_STAGING_PROFILE: "local_synthetic_development" },
      { SUPABASE_URL: "https://other.supabase.co" }, { SUPABASE_ANON_KEY: serviceKey }, { SUPABASE_ANON_KEY: "sb_secret_fixture" },
      { SUPABASE_ANON_KEY: "sb_publishable_" }, { NEUVETRA_STAGING_PROJECT_REF: "icockcoguyadhryzydvl", SUPABASE_URL: "https://icockcoguyadhryzydvl.supabase.co" },
      { DATABASE_URL: `postgres://postgres:sensitive@db.${REF}.supabase.co/postgres` },
      { DATABASE_URL: environment.DATABASE_URL + "?sslmode=disable" }, { NEUVETRA_STAGING_ORIGIN: "https://example.invalid/path" },
      { NEUVETRA_STAGING_DB_CA_PEM: "public-ca-fixture", NEUVETRA_STAGING_DB_CA_FILE: "/public-ca.crt" },
    ]
    for (const change of bad) expect(() => readStagingConfig({ ...environment, ...change })).toThrow("Private staging configuration is invalid.")
    const existing = { ...environment, NEUVETRA_STAGING_PROJECT_REF: "icockcoguyadhryzydvl", NEUVETRA_STAGING_REUSE_EXISTING: "confirmed", SUPABASE_URL: "https://icockcoguyadhryzydvl.supabase.co", DATABASE_URL: environment.DATABASE_URL.replace(REF, "icockcoguyadhryzydvl") }
    expect(readStagingConfig(existing).reuseExistingProject).toBe(true)
  })

  test("explicit existing-project reuse still requires verified database containment at startup", async () => {
    let closed = false
    const database = { checkReadiness: async () => ({ profile: STAGING_PROFILE, schemaVersion: 15 }), close: async () => { closed = true } } as unknown as StagingDatabase
    const config = readStagingConfig({ ...environment, NEUVETRA_STAGING_PROJECT_REF: "icockcoguyadhryzydvl", NEUVETRA_STAGING_REUSE_EXISTING: "confirmed", SUPABASE_URL: "https://icockcoguyadhryzydvl.supabase.co", DATABASE_URL: environment.DATABASE_URL.replace(REF, "icockcoguyadhryzydvl") })
    await expect(createStagingServer(config, { database, validateUser: async () => null, verifyAssets: async () => {} })).rejects.toThrow("Private staging dependencies are unavailable.")
    expect(closed).toBe(true)
    let contained = true
    database.checkReadiness = async () => ({ profile: STAGING_PROFILE, schemaVersion: 15, legacyContainmentVerified: contained })
    const app = await createStagingServer(config, { database, validateUser: async () => null, verifyAssets: async () => {}, log: () => {} })
    cleanup = app.close
    expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/config`))).status).toBe(200)
    contained = false
    expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/config`))).status).toBe(503)
    expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/session`, { headers: { authorization: "Bearer any-token" } }))).status).toBe(503)
    expect((await app.fetch(new Request(`${ORIGIN}/ready`))).status).toBe(503)
  })

  test("session uses verified identity and current membership; public config contains only public fields", async () => {
    const f = await fixture()
    const config = await f.request("/workspace-api/config")
    expect(await config.json()).toEqual({ profile: STAGING_PROFILE, supabaseUrl: environment.SUPABASE_URL, anonKey: environment.SUPABASE_ANON_KEY })
    for (const token of [undefined, "m54-synthetic-owner", "expired-session"]) expect((await f.request("/workspace-api/session", token)).status).toBe(401)
    const session = await f.request("/workspace-api/session", "test-admin-session")
    expect(await session.json()).toEqual({ profile: STAGING_PROFILE, user: { id: ADMIN }, access: { role: "admin", workspaceId: f.workspace.id, evidenceId: null } })
    f.invited.delete(ADMIN)
    expect((await f.request("/workspace-api/session", "test-admin-session")).status).toBe(403)
    expect((await f.request(`/workspace-api/workspace/${f.workspace.id}`, "test-admin-session")).status).toBe(403)
  })

  test("same-origin wrapper reaches actual SQL routes, withholds foreign workspace and preserves multipart uploads", async () => {
    const f = await fixture()
    const own = await f.request(`/workspace-api/workspace/${f.workspace.id}`, "test-owner-session")
    expect(own.status).toBe(200)
    expect((await own.json()).id).toBe(f.workspace.id)
    const foreign = await f.request(`/workspace-api/workspace/${f.workspace.id}`, "test-outsider-session")
    const unknown = await f.request("/workspace-api/workspace/99999999-9999-4999-8999-999999999999", "test-outsider-session")
    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual(await unknown.json())
    const form = new FormData()
    form.append("file", new File([await Bun.file(new URL("../../../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf", import.meta.url)).bytes()], "neuvetra-m55-synthetic-electricity-bill.pdf", { type: "application/pdf" }))
    const upload = await f.request(`/workspace-api/workspace/${f.workspace.id}/bills`, "test-owner-session", { method: "POST", body: form })
    expect(upload.status).toBe(200)
    const evidence = await upload.json()
    expect(evidence.companyId).toBe(f.workspace.id)
    f.evidence(evidence.id)
    expect((await (await f.request("/workspace-api/session", "test-admin-session")).json()).access.evidenceId).toBe(evidence.id)
    const mutation = await f.request(`/workspace-api/workspace/${f.workspace.id}/bills`, "test-member-session", { method: "POST", body: form })
    expect(mutation.status).toBe(403)
  })

  test("readiness fails closed and errors/logs contain no credentials, personal metadata or body", async () => {
    const f = await fixture()
    expect((await f.request("/ready")).status).toBe(200)
    f.unhealthy()
    const readiness = await f.request("/ready")
    expect(readiness.status).toBe(503)
    expect(await readiness.json()).toEqual({ status: "unavailable" })
    expect((await f.request("/health")).status).toBe(200)
    const failure = await f.request("/workspace-api/session", "broken-session")
    expect(failure.status).toBe(503)
    expect(await failure.text()).not.toContain("sensitive")
    const serialized = JSON.stringify(f.logs)
    for (const forbidden of ["broken-session", "private@example.invalid", "sensitive", environment.DATABASE_URL, OWNER]) expect(serialized).not.toContain(forbidden)
    expect(f.logs.every((entry) => Object.keys(entry).sort().join("|") === "durationMs|event|requestId|route|status")).toBe(true)
  })

  test("origin, size and path refusals cover actual dispatch; no-store applies to every response", async () => {
    const f = await fixture()
    expect((await f.request("/workspace-api/session", "test-owner-session", { headers: { origin: "https://foreign.invalid" } })).status).toBe(403)
    const tooLarge = await f.request("/workspace-api/workspace", "test-owner-session", { method: "POST", body: "x".repeat(300_001) })
    expect(tooLarge.status).toBe(413)
    for (const pathname of ["/", "/workspace-api/config", "/health", "/.env", "/workspace-api/no-such-route"]) {
      const response = await f.request(pathname, "test-owner-session")
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(response.headers.get("x-content-type-options")).toBe("nosniff")
      if (pathname === "/.env" || pathname.endsWith("no-such-route")) expect(response.status).toBe(404)
    }
  })

  test("static serving is confined to the approved web root and asset namespace", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "neuvetra-m63-static-"))
    cleanup = async () => rm(root, { recursive: true, force: true })
    await mkdir(path.join(root, "assets"))
    await writeFile(path.join(root, "index.html"), "<html><body>Staging</body></html>")
    await writeFile(path.join(root, "assets", "app.js"), "export {}")
    await writeFile(path.join(root, ".env"), "private fixture")
    expect((await serveStagingAsset(root, "/"))?.status).toBe(200)
    expect((await serveStagingAsset(root, "/assets/app.js"))?.status).toBe(200)
    for (const target of ["/.env", "/assets/../.env", "/assets/%2e%2e/.env", "/output/report.html", "/assets/app.js.map"]) expect(await serveStagingAsset(root, target)).toBeNull()
    await verifyStagingAssets(root)
  })
})

