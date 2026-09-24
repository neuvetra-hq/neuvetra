import { describe, expect, test } from "bun:test"
import {
  M80_FIXTURE_PROFILE,
  M80_FIXTURE_SHA256,
  M80_FIXTURE_VERSION,
  M80_HELD_REGISTRY,
  M80_RUNTIME_PROFILE,
  classifyM80Foundation,
  createM80FixtureSetup,
  validateM80Setup,
  type M80BetaSetupVersion,
  type M80FoundationView,
  type M80SaveSetupResult,
} from "@neuvetra/database"
import { createM80BetaRoutes, type M80RouteDatabase } from "./m80-beta-routes"

const ORIGIN = "https://staging.example.test"
const COMPANY = "80000000-0000-4000-8000-000000000901"
const OTHER = "80000000-0000-4000-8000-000000000902"
const ACTOR = "80000000-0000-4000-8000-000000000903"
const VERSION = "80000000-0000-4000-8000-000000000904"
const admission = { companyId: COMPANY, fixtureProfileId: M80_FIXTURE_PROFILE, fixtureVersion: M80_FIXTURE_VERSION, fixtureSha256: M80_FIXTURE_SHA256, active: true }
const setupInput = () => createM80FixtureSetup(COMPANY)
const setup = validateM80Setup(setupInput(), admission)
const eligibility = classifyM80Foundation(setupInput(), admission, M80_HELD_REGISTRY)
const version: M80BetaSetupVersion = { id: VERSION, companyId: COMPANY, reportingYear: 2025, revision: 1, previousVersionId: null, previousVersionSha256: null, setup, payloadSha256: "1".repeat(64), versionSha256: "2".repeat(64), createdBy: ACTOR, createdAt: "2026-09-24T12:00:00.000Z" }
const { setup: _historySetup, ...historyVersion } = version
const view: M80FoundationView = { profile: M80_RUNTIME_PROFILE, syntheticOnly: true, canManage: true, fixtureAdmission: admission, releaseRegistry: structuredClone(M80_HELD_REGISTRY) as any, currentVersion: version, history: [historyVersion], setup, eligibility }
const save: M80SaveSetupResult = { foundation: view, savedVersion: version, replayed: false }

function database(overrides: Partial<M80RouteDatabase> = {}): M80RouteDatabase {
  return {
    hasStagingAccess: async () => true,
    canManageWorkspace: async (_user, company) => company === COMPANY,
    findM80Foundation: async (_user, company) => company === COMPANY ? view : null,
    findM80FoundationVersion: async (_user, company, id) => company === COMPANY && id === VERSION ? version : null,
    saveM80Foundation: async () => save,
    ...overrides,
  }
}

const route = (db: M80RouteDatabase = database()) => createM80BetaRoutes({ database: db, origin: ORIGIN, validateUser: async token => token === "ok" ? { id: ACTOR, email: null, phone: null, fullName: null } : null })
const request = (path = `/workspace/${COMPANY}/scope1-beta-setup`, init: RequestInit = {}) => new Request(ORIGIN + path, { ...init, headers: { authorization: "Bearer ok", ...(init.method && init.method !== "GET" ? { origin: ORIGIN } : {}), ...init.headers } })
const initialBody = () => ({ idempotencyKey: "80000000-0000-4000-8000-000000000905", expectedRevision: 0, expectedVersionId: null, expectedVersionSha256: null, correctionReason: null, setup: setupInput() })

describe("M80 beta routes", () => {
  test("lets an authorized member read the current view and one immutable historical version", async () => {
    let manageCalls = 0
    const app = route(database({ canManageWorkspace: async () => { manageCalls++; return false } }))
    const current = await app(request())
    expect(current.status).toBe(200)
    expect(await current.json()).toEqual(view)
    const historical = await app(request(`/workspace/${COMPANY}/scope1-beta-setup/versions/${VERSION}`))
    expect(historical.status).toBe(200)
    expect(await historical.json()).toEqual(version)
    expect(manageCalls).toBe(0)
  })

  test("collapses foreign tenant and unknown history reads to the same not-found response", async () => {
    const app = route()
    const foreign = await app(request(`/workspace/${OTHER}/scope1-beta-setup`))
    const missing = await app(request(`/workspace/${COMPANY}/scope1-beta-setup/versions/80000000-0000-4000-8000-000000000999`))
    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual({ error: "Scope 1 beta setup not found." })
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: "Scope 1 beta setup not found." })
  })

  test("requires manager authority, exact origin and the strict closed save body", async () => {
    let writes = 0
    const app = route(database({ canManageWorkspace: async () => false, saveM80Foundation: async () => { writes++; return save } }))
    expect((await app(request(undefined, { method: "POST", body: JSON.stringify(initialBody()) }))).status).toBe(403)
    expect(writes).toBe(0)
    const allowed = route(database({ saveM80Foundation: async () => { writes++; return save } }))
    const extra = { ...initialBody(), releaseEligible: true }
    const invalid = await allowed(request(undefined, { method: "POST", body: JSON.stringify(extra) }))
    expect(invalid.status).toBe(422)
    expect(writes).toBe(0)
    const wrongOrigin = await allowed(request(undefined, { method: "POST", headers: { origin: "https://evil.example" }, body: JSON.stringify(initialBody()) }))
    expect(wrongOrigin.status).toBe(403)
  })

  test("returns created for a new append, success for exact replay and conflict for stale content", async () => {
    const created = await route()(request(undefined, { method: "POST", body: JSON.stringify(initialBody()) }))
    expect(created.status).toBe(201)
    expect((await created.json()).savedVersion.id).toBe(VERSION)
    const replayedResult = { ...save, replayed: true }
    const replayed = await route(database({ saveM80Foundation: async () => replayedResult }))(request(undefined, { method: "POST", body: JSON.stringify(initialBody()) }))
    expect(replayed.status).toBe(200)
    expect((await replayed.json()).replayed).toBe(true)
    const conflict = Object.assign(new Error("private detail"), { code: "23505" })
    const stale = await route(database({ saveM80Foundation: async () => { throw conflict } }))(request(undefined, { method: "POST", body: JSON.stringify(initialBody()) }))
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: "Scope 1 beta setup changed. Refresh current setup." })
  })

  test("keeps authentication, methods, database details and history limits bounded", async () => {
    expect((await route()(new Request(ORIGIN + `/workspace/${COMPANY}/scope1-beta-setup`))).status).toBe(401)
    expect((await route()(request(undefined, { method: "DELETE", headers: { origin: ORIGIN } }))).status).toBe(405)
    const unavailable = await route(database({ findM80Foundation: async () => { throw new Error("PRIVATE DATABASE DETAIL") } }))(request())
    expect(unavailable.status).toBe(503)
    expect(JSON.stringify(await unavailable.json())).not.toContain("PRIVATE")
    const limit = Object.assign(new Error("private"), { code: "54000" })
    const limited = await route(database({ saveM80Foundation: async () => { throw limit } }))(request(undefined, { method: "POST", body: JSON.stringify(initialBody()) }))
    expect(limited.status).toBe(422)
    expect(await limited.json()).toEqual({ error: "Scope 1 beta setup history capacity reached.", code: "history_limit" })
  })
})
