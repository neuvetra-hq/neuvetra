import { afterEach, describe, expect, setSystemTime, test } from "bun:test"
import { DevelopmentWorkspaceDatabase } from "@neuvetra/database"
import { createStagingServer, type StagingAddressWarning, type StagingDatabase, type StagingLog } from "./server"
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
const SPARE = "55555555-5555-4555-8555-555555555555"
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
  const db = await DevelopmentWorkspaceDatabase.create([OWNER, ADMIN, MEMBER, OUTSIDER, SPARE])
  const workspace = await db.createWorkspaceWithSyntheticMembers(OWNER, input, [{ userId: ADMIN, role: "admin" }, { userId: MEMBER, role: "member" }])
  const invited = new Set([OWNER, ADMIN, MEMBER, OUTSIDER, SPARE])
  const users: Record<string, string> = { "test-owner-session": OWNER, "test-admin-session": ADMIN, "test-member-session": MEMBER, "test-outsider-session": OUTSIDER, "test-spare-session": SPARE }
  let validations = 0
  const logs: StagingLog[] = []
  const warnings: StagingAddressWarning[] = []
  let healthy = true
  let evidenceId: string | null = null
  const database = Object.assign(db, {
    async hasStagingAccess(userId: string) { return invited.has(userId) },
    async findStagingWorkspaceForUser(userId: string) {
      const allowed = invited.has(userId) ? await db.findWorkspace(userId, workspace.id) : null
      if (!allowed) return null
      return { workspace: allowed, role: userId === OWNER ? "owner" as const : userId === ADMIN ? "admin" as const : "member" as const, evidenceId }
    },
    async findStagingMembershipForUser(userId: string) {
      const allowed = invited.has(userId) ? await db.findWorkspace(userId, workspace.id) : null
      if (!allowed) return null
      return { companyId: allowed.id, role: userId === OWNER ? "owner" as const : userId === ADMIN ? "admin" as const : "member" as const, evidenceId }
    },
    async checkReadiness() { if (!healthy) throw new Error("sensitive-driver-value"); return { profile: STAGING_PROFILE, schemaVersion: 30 } },
  }) as StagingDatabase
  const app = await createStagingServer(readStagingConfig(environment), {
    database, validateUser: async (token) => (validations++, token === "broken-session") ? Promise.reject(new Error("sensitive-auth-value")) : users[token] ? { id: users[token]!, phone: null, email: "private@example.invalid", fullName: "Private fixture" } : null,
    verifyAssets: async () => {}, serveAsset: async (name) => name === "/" ? new Response("Private staging sign-in") : null,
    log: (event) => logs.push(event), warn: (event) => warnings.push(event),
  })
  cleanup = app.close
  const request = (pathname: string, token?: string, options: RequestInit = {}) => app.fetch(new Request(`${ORIGIN}${pathname}`, { ...options, headers: { origin: ORIGIN, ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers } }))
  return { app, db, workspace, invited, logs, warnings, request, validations: () => validations, unhealthy: () => { healthy = false }, evidence: (id: string) => { evidenceId = id } }
}

describe("M63 private staging boundary", () => {
  test("nonexisting-project runtime refuses the schema-28 and schema-29 bridges and older prefixes before serving", async () => {
    for (const schemaVersion of [23, 26, 27, 28, 29]) {
      let closed=false
      const database={checkReadiness:async()=>({profile:STAGING_PROFILE,schemaVersion}),close:async()=>{closed=true}} as unknown as StagingDatabase
      await expect(createStagingServer(readStagingConfig(environment),{database,validateUser:async()=>null,verifyAssets:async()=>{}})).rejects.toThrow("Private staging dependencies are unavailable.")
      expect(closed).toBe(true)
    }
  })

  test("existing-project schema-28 bridge serves setup, collection and results, and keeps serving them at 29 and 30", async () => {
    const company = "80000000-0000-4000-8000-000000000901"
    let schemaVersion = 28, setupReads = 0, collectionReads = 0
    const database = {
      checkReadiness: async () => ({ profile: STAGING_PROFILE, schemaVersion, legacyContainmentVerified: true }),
      close: async () => {},
      hasStagingAccess: async () => true,
      findStagingMembershipForUser: async () => ({ companyId: company, role: "owner" as const, evidenceId: null }),
      findCompanySetup: async () => { setupReads++; return null },
      findCollectionContext: async () => { collectionReads++; return null },
    } as unknown as StagingDatabase
    const config = readStagingConfig({ ...environment, NEUVETRA_STAGING_PROJECT_REF: "icockcoguyadhryzydvl", NEUVETRA_STAGING_REUSE_EXISTING: "confirmed", SUPABASE_URL: "https://icockcoguyadhryzydvl.supabase.co", DATABASE_URL: environment.DATABASE_URL.replace(REF, "icockcoguyadhryzydvl") })
    const app = await createStagingServer(config, { database, validateUser: async token => token === "ok" ? { id: OWNER, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, log: () => {} })
    cleanup = app.close
    const request = (pathname: string, token?: string) => app.fetch(new Request(`${ORIGIN}${pathname}`, { headers: token ? { authorization: `Bearer ${token}` } : undefined }))
    const routes = [`/workspace-api/workspace/${company}/collection`, `/workspace-api/workspace/${company}/collection/evidence`, `/workspace-api/workspace/${company}/results`]
    // Before and after the operator applies 0029 and 0030 (hosted 0029 is on hold): same readiness, same routes.
    for (const version of [28, 29, 30]) {
      schemaVersion = version
      const ready = await request("/ready")
      expect(ready.status).toBe(200)
      expect(await ready.json()).toMatchObject({ status: "ready", schemaVersion: version, legacyContainmentVerified: true })
      expect((await request("/workspace-api/config")).status).toBe(200)
      expect((await request("/workspace-api/session", "ok")).status).toBe(200)
      expect((await request(`/workspace-api/workspace/${company}/setup`)).status).toBe(401)
      const setupBefore = setupReads
      expect((await request(`/workspace-api/workspace/${company}/setup`, "ok")).status).toBe(404)
      expect(setupReads).toBe(setupBefore + 1)
      for (const route of routes) {
        expect((await request(route)).status).toBe(401)
        const before = collectionReads
        const reached = await request(route, "ok")
        // The fixture has no collection context, so reaching the route gives its own 404.
        expect(reached.status).toBe(404)
        expect(await reached.json()).not.toMatchObject({ code: "collection_unavailable" })
        expect(collectionReads).toBe(before + 1)
      }
      const before = collectionReads
      const upload = await app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/${company}/collection/evidence`, { method: "POST", headers: { origin: ORIGIN, authorization: "Bearer ok" }, body: "x".repeat(350_000) }))
      expect(upload.status).toBe(404)
      expect(collectionReads).toBe(before + 1)
      // Scope 3 results exist only at 29 (0029, D5): at the bridge they are refused before any database read.
      const scope3 = `/workspace-api/workspace/${company}/results/scope3`
      expect((await request(scope3)).status).toBe(401)
      const beforeScope3 = collectionReads
      const reachedScope3 = await request(scope3, "ok")
      if (version === 28) {
        expect(reachedScope3.status).toBe(503)
        expect(await reachedScope3.json()).toMatchObject({ code: "scope3_unavailable" })
        expect(collectionReads).toBe(beforeScope3)
      } else {
        expect(reachedScope3.status).toBe(404)
        expect(collectionReads).toBe(beforeScope3 + 1)
      }
      // Scope 3 assessments, spend imports and report versions exist only at 30 (0030): below it they are refused first.
      for (const path of ["assessments/1", "spend-imports", "reports"]) {
        const route = `/workspace-api/workspace/${company}/scope3/${path}`
        expect((await request(route)).status).toBe(401)
        const before = collectionReads + setupReads
        const reached = await request(route, "ok")
        if (version < 30) {
          expect([path, reached.status]).toEqual([path, 503])
          expect(await reached.json()).toMatchObject({ code: "scope3_schema_30_required" })
        } else expect([path, reached.status === 503]).toEqual([path, false])
        // Below 30 nothing is read. At 30 the spend-import route (I-09) and the report-version route (I-10) exist and read company
        // setup first (this fixture has none: 404).
        expect(collectionReads + setupReads).toBe(before + (version >= 30 && (path === "spend-imports" || path === "reports") ? 1 : 0))
      }
    }
  })

  test("existing-project runtime refuses to start at any prefix other than 28, 29 or 30", async () => {
    const config = readStagingConfig({ ...environment, NEUVETRA_STAGING_PROJECT_REF: "icockcoguyadhryzydvl", NEUVETRA_STAGING_REUSE_EXISTING: "confirmed", SUPABASE_URL: "https://icockcoguyadhryzydvl.supabase.co", DATABASE_URL: environment.DATABASE_URL.replace(REF, "icockcoguyadhryzydvl") })
    for (const schemaVersion of [22, 23, 26, 27, 31]) {
      let closed = false
      const database = { checkReadiness: async () => ({ profile: STAGING_PROFILE, schemaVersion, legacyContainmentVerified: true }), close: async () => { closed = true } } as unknown as StagingDatabase
      await expect(createStagingServer(config, { database, validateUser: async () => null, verifyAssets: async () => {}, log: () => {} })).rejects.toThrow("Private staging dependencies are unavailable.")
      expect(closed).toBe(true)
    }
  })

  test("a running existing-project server stops serving if the database leaves 28, 29 or 30", async () => {
    const config = readStagingConfig({ ...environment, NEUVETRA_STAGING_PROJECT_REF: "icockcoguyadhryzydvl", NEUVETRA_STAGING_REUSE_EXISTING: "confirmed", SUPABASE_URL: "https://icockcoguyadhryzydvl.supabase.co", DATABASE_URL: environment.DATABASE_URL.replace(REF, "icockcoguyadhryzydvl") })
    let schemaVersion = 28
    const database = { checkReadiness: async () => ({ profile: STAGING_PROFILE, schemaVersion, legacyContainmentVerified: true }), close: async () => {} } as unknown as StagingDatabase
    const app = await createStagingServer(config, { database, validateUser: async token => token === "ok" ? { id: OWNER, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, log: () => {} })
    cleanup = app.close
    expect((await app.fetch(new Request(`${ORIGIN}/ready`))).status).toBe(200)
    for (const version of [27, 31]) {
      schemaVersion = version
      expect((await app.fetch(new Request(`${ORIGIN}/health`))).status).toBe(200)
      expect((await app.fetch(new Request(`${ORIGIN}/ready`))).status).toBe(503)
      expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/config`))).status).toBe(503)
      expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/80000000-0000-4000-8000-000000000901/collection`, { headers: { authorization: "Bearer ok" } }))).status).toBe(503)
      // API-02: an invalid token is refused before the readiness query, so it gets 401, not the database's 503.
      expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/80000000-0000-4000-8000-000000000901/collection`, { headers: { authorization: "Bearer junk" } }))).status).toBe(401)
    }
  })
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
    const database = { checkReadiness: async () => ({ profile: STAGING_PROFILE, schemaVersion: 28 }), close: async () => { closed = true } } as unknown as StagingDatabase
    const config = readStagingConfig({ ...environment, NEUVETRA_STAGING_PROJECT_REF: "icockcoguyadhryzydvl", NEUVETRA_STAGING_REUSE_EXISTING: "confirmed", SUPABASE_URL: "https://icockcoguyadhryzydvl.supabase.co", DATABASE_URL: environment.DATABASE_URL.replace(REF, "icockcoguyadhryzydvl") })
    await expect(createStagingServer(config, { database, validateUser: async () => null, verifyAssets: async () => {} })).rejects.toThrow("Private staging dependencies are unavailable.")
    expect(closed).toBe(true)
    let contained = true
    database.checkReadiness = async () => ({ profile: STAGING_PROFILE, schemaVersion: 28, legacyContainmentVerified: contained })
    const app = await createStagingServer(config, { database, validateUser: async token => token === "any-token" ? { id: OWNER, email: null, phone: null, fullName: null } : null, verifyAssets: async () => {}, log: () => {} })
    cleanup = app.close
    expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/config`))).status).toBe(200)
    contained = false
    expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/config`))).status).toBe(503)
    expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/session`, { headers: { authorization: "Bearer any-token" } }))).status).toBe(503)
    // API-02: an invalid token never reaches the readiness query (401, no SQL).
    expect((await app.fetch(new Request(`${ORIGIN}/workspace-api/session`, { headers: { authorization: "Bearer other-token" } }))).status).toBe(401)
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

  test("California-only legacy paths refuse non-California geography before reaching old calculators", async () => {
    const f = await fixture()
    const root = `/workspace-api/workspace/${f.workspace.id}`
    const california = await f.request(`${root}/electricity-worksheet`, "test-owner-session")
    expect(california.status).toBe(200)
    expect(await f.db.findCompanyGeography(OWNER, f.workspace.id)).toEqual({ countryCode: "US", stateCode: "CA" })

    const lookup = f.db.findCompanyGeography.bind(f.db)
    const checked: string[] = []
    f.db.findCompanyGeography = async (userId, companyId) => {
      checked.push(companyId)
      return companyId === f.workspace.id ? { countryCode: "US", stateCode: "NY" } : lookup(userId, companyId)
    }
    const paths = [
      "/electricity-worksheet", "/electricity-worksheet/corrections", "/electricity-worksheet/reviews",
      `/electricity-worksheet/reports/${crypto.randomUUID()}/download`,
      "/source-electricity-worksheet", "/source-electricity-worksheet/sources",
      `/source-electricity-worksheet/sources/${crypto.randomUUID()}/download`,
      `/source-electricity-worksheet/reports/${crypto.randomUUID()}/download`,
      "/annual-electricity-worksheet", `/annual-electricity-worksheet/reports/${crypto.randomUUID()}/download`,
      "/annual-electricity-evidence", `/annual-electricity-evidence/reports/${crypto.randomUUID()}/download`,
      "/fugitive-sources", `/fugitive-sources/${crypto.randomUUID()}/versions`,
      "/fugitive-population", `/fugitive-population/${crypto.randomUUID()}/reports/${crypto.randomUUID()}/download`,
    ]
    for (const suffix of paths) {
      const response = await f.request(root + suffix, "test-owner-session")
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: "Not found." })
    }
    for (const suffix of ["/electricity-worksheet", "/annual-electricity-evidence", "/fugitive-population"]) {
      const response = await f.request(root + suffix, "test-owner-session", { method: "POST", body: "{}" })
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: "Not found." })
    }
    expect(checked).toEqual(Array(paths.length + 3).fill(f.workspace.id))
    expect((await f.request(`${root}/electricity-worksheet`, "test-outsider-session")).status).toBe(404)
  })

  test("mounts M80 current and history reads but refuses writes behind staging authentication", async () => {
    const f = await fixture()
    const versionId = "88888888-8888-4888-8888-888888888888"
    const view = { profile: "m80-scope1-beta-foundation-runtime-v1", syntheticOnly: true, canManage: true, fixtureAdmission: {}, releaseRegistry: [], currentVersion: null, history: [], setup: {}, eligibility: {} } as any
    const version = { id: versionId } as any
    ;(f.db as any).findM80Foundation = async (userId: string, companyId: string) => userId === OWNER && companyId === f.workspace.id ? view : null
    ;(f.db as any).findM80FoundationVersion = async (userId: string, companyId: string, id: string) => userId === OWNER && companyId === f.workspace.id && id === versionId ? version : null
    ;(f.db as any).saveM80Foundation = async () => { throw new Error("M80 write route reached the database") }
    const current = await f.request(`/workspace-api/workspace/${f.workspace.id}/scope1-beta-setup`, "test-owner-session")
    expect(current.status).toBe(200)
    expect((await current.json()).syntheticOnly).toBe(true)
    const history = await f.request(`/workspace-api/workspace/${f.workspace.id}/scope1-beta-setup/versions/${versionId}`, "test-owner-session")
    expect(history.status).toBe(200)
    const refused = await f.request(`/workspace-api/workspace/${f.workspace.id}/scope1-beta-setup`, "test-owner-session", { method: "POST", body: "{}" })
    expect(refused.status).toBe(405)
    expect(await refused.json()).toEqual({ error: "Method not allowed." })
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

describe("BF1 staging boundary fixes", () => {
  test("requests without a token never use up the shared admission budget, so invited users are not locked out", async () => {
    const { request } = await fixture()
    for (let i = 0; i < 400; i++) expect((await request("/workspace-api/session")).status).toBe(401)
    // The public config endpoint has its own budget: exhausting it doesn't touch the authenticated one either.
    for (let i = 0; i < 1200; i++) expect((await request("/workspace-api/config")).status).toBe(200)
    expect((await request("/workspace-api/config")).status).toBe(429)
    expect((await request("/workspace-api/session", "test-owner-session")).status).toBe(200)
  })

  // Round 3 lane C (PR-3): a refused request says what to do and when (Retry-After), so the screens can wait and retry.
  test("a user over the per-user limit gets 429 with Retry-After, code rate_limited and a message that says to wait", async () => {
    const { request } = await fixture()
    let last: Response | null = null
    for (let i = 0; i < 300; i++) expect((await request("/workspace-api/session", "test-owner-session")).status).toBe(200)
    last = await request("/workspace-api/session", "test-owner-session")
    expect(last!.status).toBe(429)
    const seconds = Number(last!.headers.get("retry-after"))
    expect(seconds).toBeGreaterThan(0)
    expect(seconds).toBeLessThanOrEqual(60)
    expect(await last!.json()).toEqual({ code: "rate_limited", error: "Too many requests in the last minute. Wait about a minute, then try again; nothing you saved was lost." })
  })

  test("the shared limit admits 1,200 staging-user requests independently of each user's 300-request allowance", async () => {
    const { request } = await fixture()
    for (const token of ["test-owner-session", "test-admin-session", "test-member-session"])
      for (let i = 0; i < 300; i++) expect((await request("/workspace-api/session", token)).status).toBe(200)
    // The outsider has staging access but no company: its requests are admitted (then 403) and count toward the 1,200.
    for (let i = 0; i < 300; i++) expect((await request("/workspace-api/session", "test-outsider-session")).status).toBe(403)
    // API-01: an invalid token never spends the instance budget, so it still gets 401 here, not 429.
    expect((await request("/workspace-api/session", "unknown-synthetic-session")).status).toBe(401)
    // A fifth staging user, well within their own 300, is refused by the exhausted instance budget.
    const over = await request("/workspace-api/session", "test-spare-session")
    expect([over.status, (await over.json()).code]).toEqual([429, "rate_limited"])
    expect(Number(over.headers.get("retry-after"))).toBeGreaterThan(0)
  })

  test("an auth provider failure is 503 (retry), never 401 (signed out)", async () => {
    const { request } = await fixture()
    const response = await request("/workspace-api/session", "broken-session")
    expect([response.status, await response.json()]).toEqual([503, { error: "Authentication is unavailable." }])
  })

  test("configuration refuses pooler targets the hosted adapter would refuse at startup", () => {
    for (const url of [
      `postgres://neuvetra_runtime.${REF}:synthetic-password@aws-0-us-west-1.pooler.supabase.com/postgres`,
      `postgres://neuvetra_runtime.${REF}:synthetic-password@us-west-1.pooler.supabase.com:6543/postgres`,
    ]) expect(() => readStagingConfig({ ...environment, DATABASE_URL: url })).toThrow()
    expect(() => readStagingConfig({ ...environment, DATABASE_URL: `postgres://neuvetra_runtime.${REF}:synthetic-password@aws-0-us-west-1.pooler.supabase.com:6543/postgres` })).not.toThrow()
  })
})

// API-01 (CTO audit risk 3): junk tokens used to spend the one instance-wide budget before validation, so one script
// could refuse every user for a minute. Now only validated staging users spend it; everything else is limited per address.
describe("API-01: rate limits after authentication", () => {
  const from = (address: string) => ({ headers: { "x-real-ip": address } })

  test("a flood of junk tokens from one address never refuses a valid user elsewhere, and stops reaching validation", async () => {
    const f = await fixture()
    const statuses: number[] = []
    for (let i = 0; i < 1500; i++) statuses.push((await f.request("/workspace-api/session", `junk-${i}`, from("198.51.100.7"))).status)
    expect(statuses.slice(0, 120).every(status => status === 401)).toBe(true)
    expect(statuses.slice(120).every(status => status === 429)).toBe(true)
    // Only the first 120 junk tokens were validated; the rest were refused before any validation call.
    expect(f.validations()).toBe(120)
    const refused = await f.request("/workspace-api/session", "junk-final", from("198.51.100.7"))
    expect([refused.status, (await refused.json()).code]).toEqual([429, "rate_limited"])
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0)
    for (const [token, address] of [["test-owner-session", "203.0.113.10"], ["test-admin-session", "203.0.113.11"], ["test-member-session", "203.0.113.12"]] as const)
      expect((await f.request("/workspace-api/session", token, from(address))).status).toBe(200)
  })

  test("junk tokens spread over many addresses (more than the old 1,200 global budget) never lock users out", async () => {
    const f = await fixture()
    for (let i = 0; i < 1300; i++) expect((await f.request("/workspace-api/session", `junk-${i}`, from(`198.51.100.${i % 13}`))).status).toBe(401)
    for (let i = 0; i < 300; i++) expect((await f.request("/workspace-api/session", "test-owner-session", from("203.0.113.10"))).status).toBe(200)
  })

  test("a valid user's requests do not use up their address's budget for unverified requests", async () => {
    const f = await fixture()
    // 300 admitted requests from one address, well past the 120 per-address limit, all succeed.
    for (let i = 0; i < 300; i++) expect((await f.request("/workspace-api/session", "test-owner-session", from("203.0.113.20"))).status).toBe(200)
    // The address still has its full 120 for unverified requests, then is refused.
    for (let i = 0; i < 120; i++) expect((await f.request("/workspace-api/session", `junk-${i}`, from("203.0.113.20"))).status).toBe(401)
    expect((await f.request("/workspace-api/session", "junk-over", from("203.0.113.20"))).status).toBe(429)
  })

  test("one abusive authenticated user is limited without affecting another user", async () => {
    const f = await fixture()
    for (let i = 0; i < 300; i++) expect((await f.request("/workspace-api/session", "test-owner-session", from("203.0.113.30"))).status).toBe(200)
    for (let i = 0; i < 500; i++) expect((await f.request("/workspace-api/session", "test-owner-session", from("203.0.113.30"))).status).toBe(429)
    // Refusals after the user's own limit are not given back, so validation calls stay bounded per address (120).
    expect(f.validations()).toBe(300 + 120)
    // Another user, on another address, is unaffected.
    expect((await f.request("/workspace-api/session", "test-admin-session", from("203.0.113.31"))).status).toBe(200)
  })

  test("a user retrying a few times past their own limit does not refuse a colleague on the same address", async () => {
    const f = await fixture()
    for (let i = 0; i < 300; i++) expect((await f.request("/workspace-api/session", "test-owner-session", from("203.0.113.32"))).status).toBe(200)
    for (let i = 0; i < 20; i++) expect((await f.request("/workspace-api/session", "test-owner-session", from("203.0.113.32"))).status).toBe(429)
    expect((await f.request("/workspace-api/session", "test-admin-session", from("203.0.113.32"))).status).toBe(200)
  })

  test("public config is limited per address, so one address cannot refuse it to everyone", async () => {
    const f = await fixture()
    for (let i = 0; i < 1200; i++) expect((await f.request("/workspace-api/config", undefined, from("198.51.100.9"))).status).toBe(200)
    expect((await f.request("/workspace-api/config", undefined, from("198.51.100.9"))).status).toBe(429)
    expect((await f.request("/workspace-api/config", undefined, from("203.0.113.40"))).status).toBe(200)
  })

  test("the client address comes from the edge-written header, never the caller-controlled leftmost forwarded hop", async () => {
    const f = await fixture()
    // Rotating the leftmost x-forwarded-for entry does not give the caller fresh buckets: the rightmost hop is used.
    for (let i = 0; i < 120; i++) expect((await f.request("/workspace-api/session", `junk-${i}`, { headers: { "x-forwarded-for": `10.0.${i}.1, 198.51.100.50` } })).status).toBe(401)
    expect((await f.request("/workspace-api/session", "junk-over", { headers: { "x-forwarded-for": "10.9.9.9, 198.51.100.50" } })).status).toBe(429)
    // x-real-ip takes precedence over x-forwarded-for.
    expect((await f.request("/workspace-api/session", "junk-other", { headers: { "x-real-ip": "198.51.100.51", "x-forwarded-for": "198.51.100.50" } })).status).toBe(401)
  })
})

// Round 3 (EN-7, lane B): the longer listener allowance is granted by the server after authentication and the route match,
// never by path alone (the listener hands the server `extendTimeout`; listener-timeout.test.ts covers the socket side).
describe("round 3 EN-7: long request limits only after authentication", () => {
  test("prepare and Scope 3 results are extended only for a user with staging access; anonymous, unknown and other routes never", async () => {
    const { app, workspace } = await fixture()
    const extended = async (pathname: string, method: string, token?: string) => {
      const seen: number[] = []
      await app.fetch(new Request(`${ORIGIN}${pathname}`, { method, body: method === "POST" ? "{}" : undefined, headers: { origin: ORIGIN, "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) } }), { extendTimeout: seconds => seen.push(seconds) })
      return seen
    }
    const prepare = `/workspace-api/workspace/${workspace.id}/scope3/reports`, results = `/workspace-api/workspace/${workspace.id}/results/scope3`
    expect(await extended(prepare, "POST")).toEqual([])
    expect(await extended(prepare, "POST", "unknown-session")).toEqual([])
    expect(await extended(prepare, "POST", "test-owner-session")).toEqual([120])
    expect(await extended(results, "GET", "test-member-session")).toEqual([90])
    expect(await extended(prepare, "GET", "test-owner-session")).toEqual([])
    expect(await extended(`/workspace-api/workspace/${workspace.id}/scope3/spend-imports`, "GET", "test-owner-session")).toEqual([])
  })
})

// API-02 (PR #36 QA F1, F2, F3): cheap token pre-check before the Supabase call, readiness SQL after validation, one
// validation per admitted request, and a rate-limited warning when the client address falls back to "unknown".
describe("API-02: token pre-check, readiness after validation, address observability", () => {
  const EXISTING = "icockcoguyadhryzydvl"
  const existingConfig = () => readStagingConfig({ ...environment, NEUVETRA_STAGING_PROJECT_REF: EXISTING, NEUVETRA_STAGING_REUSE_EXISTING: "confirmed", SUPABASE_URL: `https://${EXISTING}.supabase.co`, DATABASE_URL: environment.DATABASE_URL.replace(REF, EXISTING) })
  const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const jwt = (payload: Record<string, unknown>) => `${segment({ alg: "ES256", typ: "JWT", kid: "synthetic" })}.${segment(payload)}.c3ludGhldGljLXNpZ25hdHVyZQ`
  const nowSeconds = () => Math.floor(Date.now() / 1000)
  const from = (address: string) => ({ "x-real-ip": address })

  /** The real (non-injected) Supabase validator, with Supabase's HTTP API replaced by a counting stub. */
  async function realValidatorServer() {
    const live = jwt({ sub: OWNER, exp: nowSeconds() + 3600 })
    let supabaseCalls = 0, readinessQueries = 0, accessQueries = 0
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (!url.startsWith(`https://${EXISTING}.supabase.co/`)) return original(input as RequestInfo, init)
      supabaseCalls++
      const authorization = new Headers(input instanceof Request ? input.headers : init?.headers).get("authorization")
      if (url.endsWith("/auth/v1/user") && authorization === `Bearer ${live}`) return Response.json({ id: OWNER, aud: "authenticated", email: null, phone: "", user_metadata: {}, app_metadata: {} })
      return Response.json({ code: 403, error_code: "bad_jwt", msg: "invalid JWT" }, { status: 403 })
    }) as typeof fetch
    const database = {
      checkReadiness: async () => { readinessQueries++; return { profile: STAGING_PROFILE, schemaVersion: 30, legacyContainmentVerified: true } },
      close: async () => {},
      hasStagingAccess: async (userId: string) => { accessQueries++; return userId === OWNER },
      findStagingMembershipForUser: async () => ({ companyId: "80000000-0000-4000-8000-000000000901", role: "owner" as const, evidenceId: null }),
    } as unknown as StagingDatabase
    const app = await createStagingServer(existingConfig(), { database, verifyAssets: async () => {}, log: () => {}, warn: () => {} })
    cleanup = async () => { globalThis.fetch = original; await app.close() }
    const session = (token: string, address = "198.51.100.70") => app.fetch(new Request(`${ORIGIN}/workspace-api/session`, { headers: { origin: ORIGIN, authorization: `Bearer ${token}`, ...from(address) } }))
    return { live, session, counts: () => ({ supabaseCalls, readinessQueries, accessQueries }) }
  }

  test("a random string and a structurally valid but expired token make no Supabase call, no SQL and spend no budget", async () => {
    const s = await realValidatorServer()
    const start = s.counts()
    const refused = [
      "not-a-token", "a.b.c", "x".repeat(400), `${segment({ alg: "ES256" })}.${segment([1])}.sig`, `${segment({ alg: "ES256" })}.${segment({ exp: "soon" })}.sig`,
      `${segment({ alg: "ES256" })}.${segment({ exp: nowSeconds() + 3600 })}`, `${segment({ alg: "ES256" })}.${segment({ exp: nowSeconds() + 3600 })}.`,
      jwt({ sub: OWNER, exp: nowSeconds() - 3600 }), jwt({ sub: OWNER, exp: nowSeconds() - 61 }),
    ]
    for (const token of refused) {
      const response = await s.session(token)
      expect([token, response.status, await response.json()]).toEqual([token, 401, { error: "Authentication required." }])
    }
    expect(s.counts()).toEqual(start)
    // 500 expired tokens from one address (over its 120 unverified allowance) never spend that allowance.
    for (let i = 0; i < 500; i++) expect((await s.session(jwt({ sub: `junk-${i}`, exp: nowSeconds() - 3600 }))).status).toBe(401)
    expect(s.counts()).toEqual(start)
    expect((await s.session(s.live)).status).toBe(200)
    for (let i = 0; i < 120; i++) expect((await s.session(jwt({ sub: `forged-${i}`, exp: nowSeconds() + 3600 }))).status).toBe(401)
    expect((await s.session(jwt({ sub: "forged-over", exp: nowSeconds() + 3600 }))).status).toBe(429)
  })

  test("a valid-shaped unexpired token (or one inside the clock skew, or without exp) still reaches Supabase", async () => {
    const s = await realValidatorServer()
    const start = s.counts()
    const live = await s.session(s.live)
    expect(live.status).toBe(200)
    expect((await live.json()).user).toEqual({ id: OWNER })
    expect(s.counts()).toEqual({ supabaseCalls: start.supabaseCalls + 1, readinessQueries: start.readinessQueries + 1, accessQueries: start.accessQueries + 1 })
    // Forged but plausible tokens are not authentic: Supabase refuses them (401), and they never reach readiness SQL.
    for (const token of [jwt({ sub: OWNER, exp: nowSeconds() + 7200 }), jwt({ sub: OWNER, exp: nowSeconds() - 30 }), jwt({ sub: OWNER })]) expect((await s.session(token)).status).toBe(401)
    expect(s.counts()).toEqual({ supabaseCalls: start.supabaseCalls + 4, readinessQueries: start.readinessQueries + 1, accessQueries: start.accessQueries + 1 })
  })

  test("existing project: readiness SQL runs only after a token is validated, once per admitted request", async () => {
    let readinessQueries = 0, validations = 0
    const database = {
      checkReadiness: async () => { readinessQueries++; return { profile: STAGING_PROFILE, schemaVersion: 30, legacyContainmentVerified: true } },
      close: async () => {}, hasStagingAccess: async () => true,
      findStagingMembershipForUser: async () => ({ companyId: "80000000-0000-4000-8000-000000000901", role: "owner" as const, evidenceId: null }),
    } as unknown as StagingDatabase
    const app = await createStagingServer(existingConfig(), { database, validateUser: async token => (validations++, token === "ok" ? { id: OWNER, email: null, phone: null, fullName: null } : null), verifyAssets: async () => {}, log: () => {}, warn: () => {} })
    cleanup = app.close
    const afterStartup = readinessQueries
    const session = (token: string) => app.fetch(new Request(`${ORIGIN}/workspace-api/session`, { headers: { authorization: `Bearer ${token}`, ...from("198.51.100.80") } }))
    for (let i = 0; i < 50; i++) expect((await session(`junk-${i}`)).status).toBe(401)
    expect([validations, readinessQueries - afterStartup]).toEqual([50, 0])
    expect((await session("ok")).status).toBe(200)
    expect(readinessQueries - afterStartup).toBe(1)
  })

  test("an admitted workspace request validates its token once, and routes keep their own per-user authorization", async () => {
    const f = await fixture()
    const before = f.validations()
    expect((await f.request(`/workspace-api/workspace/${f.workspace.id}`, "test-owner-session")).status).toBe(200)
    expect(f.validations()).toBe(before + 1)
    // The route still authorizes the verified user: an invited outsider is refused the owner's workspace.
    expect((await f.request(`/workspace-api/workspace/${f.workspace.id}`, "test-outsider-session")).status).toBe(404)
    expect((await f.request(`/workspace-api/workspace/${f.workspace.id}/electricity-worksheet`, "test-outsider-session")).status).toBe(404)
    expect(f.validations()).toBe(before + 3)
    // Staging access withdrawn: refused by the dispatcher, before any route.
    f.invited.delete(OWNER)
    expect((await f.request(`/workspace-api/workspace/${f.workspace.id}`, "test-owner-session")).status).toBe(403)
  })

  test("falling back to the shared 'unknown' address logs one warning a minute, naming the missing headers only", async () => {
    const f = await fixture()
    try {
      setSystemTime(new Date("2026-11-11T12:00:00Z"))
      for (let i = 0; i < 200; i++) await f.request("/workspace-api/session", "test-owner-session")
      await f.request("/workspace-api/config", undefined, { headers: { "x-real-ip": "", "x-forwarded-for": " , " } })
      expect(f.warnings).toEqual([{ event: "client_address_unknown", headers: { "x-real-ip": "absent", "x-forwarded-for": "absent" }, occurrences: 1 }])
      // A request with an address never warns.
      await f.request("/workspace-api/session", "test-owner-session", { headers: from("203.0.113.90") })
      setSystemTime(new Date("2026-11-11T12:01:00.500Z"))
      await f.request("/workspace-api/config", undefined, { headers: { "x-forwarded-for": " " } })
      expect(f.warnings).toHaveLength(2)
      expect(f.warnings[1]).toEqual({ event: "client_address_unknown", headers: { "x-real-ip": "absent", "x-forwarded-for": "empty" }, occurrences: 201 })
      expect(JSON.stringify(f.warnings)).not.toContain("test-owner-session")
    } finally { setSystemTime() }
  })

  test("the default warning sink writes one JSON line without token or authorization contents", async () => {
    const original = console.warn
    const lines: string[] = []
    console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(" ")) }
    try {
      const database = { checkReadiness: async () => ({ profile: STAGING_PROFILE, schemaVersion: 30 }), close: async () => {}, hasStagingAccess: async () => false } as unknown as StagingDatabase
      const app = await createStagingServer(readStagingConfig(environment), { database, validateUser: async () => null, verifyAssets: async () => {}, log: () => {} })
      cleanup = app.close
      for (let i = 0; i < 5; i++) await app.fetch(new Request(`${ORIGIN}/workspace-api/session`, { headers: { authorization: "Bearer secret-token-value" } }))
    } finally { console.warn = original }
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toEqual({ event: "client_address_unknown", headers: { "x-real-ip": "absent", "x-forwarded-for": "absent" }, occurrences: 1 })
    expect(lines[0]).not.toContain("secret-token-value")
  })
})
