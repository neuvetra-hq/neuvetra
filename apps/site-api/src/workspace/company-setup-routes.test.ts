import { describe, expect, test } from "bun:test"
import type { CompanySetupSaveResult, CompanySetupVersion, CompanySetupView } from "@neuvetra/database"
import { createCompanySetupRoutes, type CompanySetupRouteDatabase } from "./company-setup-routes"

const ORIGIN = "https://staging.example.test"
const COMPANY = "80000000-0000-4000-8000-000000000901"
const OTHER = "80000000-0000-4000-8000-000000000902"
const ACTOR = "80000000-0000-4000-8000-000000000903"
const VERSION = "80000000-0000-4000-8000-000000000904"
const version = { id: VERSION, companyId: COMPANY, revision: 1, previousVersionId: null, correctionReason: null, setup: {} as CompanySetupVersion["setup"], payloadSha256: "1".repeat(64), createdBy: ACTOR, createdAt: "2026-09-25T12:00:00.000Z" } satisfies CompanySetupVersion
const view = { profile: "neuvetra.company-setup.v1", syntheticOnly: true, canManage: true, currentVersion: version, history: [{ ...version, setup: undefined }] } as unknown as CompanySetupView
const saved = { foundation: view, savedVersion: version, replayed: false } satisfies CompanySetupSaveResult

function database(overrides: Partial<CompanySetupRouteDatabase> = {}): CompanySetupRouteDatabase {
  return {
    findCompanySetup: async (_actor, company) => company === COMPANY ? view : null,
    findCompanySetupVersion: async (_actor, company, id) => company === COMPANY && id === VERSION ? version : null,
    saveCompanySetup: async () => saved,
    ...overrides,
  }
}
const route = (db = database()) => createCompanySetupRoutes({ database: db, origin: ORIGIN, validateUser: async token => token === "ok" ? { id: ACTOR, email: null, phone: null, fullName: null } : null })
const request = (path = `/workspace/${COMPANY}/setup`, init: RequestInit = {}) => new Request(ORIGIN + path, { ...init, headers: { authorization: "Bearer ok", ...(init.method && init.method !== "GET" ? { origin: ORIGIN } : {}), ...init.headers } })
const body = { idempotencyKey: VERSION, expectedRevision: 0, expectedVersionId: null, correctionReason: null, setup: {} }

describe("general company setup route", () => {
  test("member read and historical read are company-scoped", async () => {
    const app = route()
    expect((await app(request())).status).toBe(200)
    expect((await app(request(`/workspace/${COMPANY}/setup/versions/${VERSION}`))).status).toBe(200)
    const foreign = await app(request(`/workspace/${OTHER}/setup`))
    const unknown = await app(request(`/workspace/${COMPANY}/setup/versions/80000000-0000-4000-8000-000000000999`))
    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual(await unknown.json())
  })

  test("mutations require a manager and exact origin, and remain bounded", async () => {
    let writes = 0
    const app = route(database({ findCompanySetup: async () => ({ ...view, canManage: false }), saveCompanySetup: async () => { writes++; return saved } }))
    expect((await app(request(undefined, { method: "POST", body: JSON.stringify(body) }))).status).toBe(403)
    const allowed = route(database({ saveCompanySetup: async () => { writes++; return saved } }))
    expect((await allowed(request(undefined, { method: "POST", headers: { origin: "https://wrong.example" }, body: JSON.stringify(body) }))).status).toBe(403)
    expect((await allowed(request(undefined, { method: "POST", body: "{" }))).status).toBe(422)
    expect((await allowed(request(undefined, { method: "POST", body: "x".repeat(250_001) }))).status).toBe(413)
    expect(writes).toBe(0)
  })

  test("append, replay, stale write and revoked membership do not disclose database errors", async () => {
    const created = await route()(request(undefined, { method: "POST", body: JSON.stringify(body) }))
    expect(created.status).toBe(201)
    expect((await created.json()).savedVersion.id).toBe(VERSION)
    const replay = await route(database({ saveCompanySetup: async () => ({ ...saved, replayed: true }) }))(request(undefined, { method: "POST", body: JSON.stringify(body) }))
    expect(replay.status).toBe(200)
    const conflict = await route(database({ saveCompanySetup: async () => { throw Object.assign(new Error("private"), { code: "23505" }) } }))(request(undefined, { method: "POST", body: JSON.stringify(body) }))
    expect(conflict.status).toBe(409)
    expect(await conflict.text()).not.toContain("private")
    const revoked = await route(database({ findCompanySetup: async () => null }))(request(undefined, { method: "POST", body: JSON.stringify(body) }))
    expect(revoked.status).toBe(404)
  })
})
