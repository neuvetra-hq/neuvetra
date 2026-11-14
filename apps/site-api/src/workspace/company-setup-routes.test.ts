import { describe, expect, test } from "bun:test"
import type { CompanySetupSaveResult, CompanySetupVersion, CompanySetupView } from "@neuvetra/database"
import { createCompanySetupRoutes, type CompanySetupRouteDatabase } from "./company-setup-routes"
import { SCOPE3_CAPACITY_TEXT, type CollectionActivityRecord } from "@neuvetra/database"

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

// BF-08 (BL-06): a repeated ID or screening pair is invalid input (422), refused before any SQL; a unique violation is still a 409.
test("BF-08: a setup that repeats an entity, location or screening key is 422 duplicate_setup_id and never reaches the database", async () => {
  let writes = 0
  const app = route(database({ saveCompanySetup: async () => { writes++; return saved } }))
  const entity = { id: "81000000-0000-4000-8000-000000000001" }, location = { id: "81000000-0000-4000-8000-000000000002" }
  const row = (id: string, scope: number, category: string) => ({ id, scope, category })
  const post = (setup: unknown) => app(request(undefined, { method: "POST", body: JSON.stringify({ ...body, setup }) }))
  const repeated = [
    { entities: [entity, entity] }, { entities: [entity, { id: entity.id.toUpperCase() }] }, { locations: [location, location] }, { relationships: [entity, entity] },
    { screening: [row("a", 1, "x"), row("a", 2, "y")] }, { screening: [row("a", 1, "x"), row("b", 1, "x")] }, { changes: [{ id: "c" }, { id: "c" }] },
  ]
  for (const setup of repeated) {
    const response = await post(setup)
    expect([JSON.stringify(setup), response.status, await response.json()]).toEqual([JSON.stringify(setup), 422, { error: "Invalid or unsupported company setup.", code: "duplicate_setup_id" }])
  }
  expect(writes).toBe(0)
  // The same category in two scopes, and distinct IDs, are fine.
  expect((await post({ entities: [entity, { id: "81000000-0000-4000-8000-000000000003" }], screening: [row("a", 1, "x"), row("b", 2, "x")], changes: [{ id: "c" }, { id: "d" }] })).status).toBe(201)
  expect(writes).toBe(1)
  // A unique violation from the database is a conflict again, never mistaken for invalid input.
  const conflict = await route(database({ saveCompanySetup: async () => { throw Object.assign(new Error("private"), { code: "23505" }) } }))(request(undefined, { method: "POST", body: JSON.stringify(body) }))
  expect([conflict.status, await conflict.json()]).toEqual([409, { error: "Company setup changed. Refresh current setup." }])
})

test("BF1: an uppercase company or version ID reaches the same setup as its lowercase form", async () => {
  const company = "80000000-0000-4000-8000-0000000abc01", versionId = "80000000-0000-4000-8000-0000000abc02"
  const seen: string[] = []
  const app = route(database({
    findCompanySetup: async (_actor, id) => { seen.push(id); return id === company ? view : null },
    findCompanySetupVersion: async (_actor, id, v) => { seen.push(`${id}/${v}`); return id === company && v === versionId ? version : null },
  }))
  expect((await app(request(`/workspace/${company.toUpperCase()}/setup`))).status).toBe(200)
  expect((await app(request(`/workspace/${company.toUpperCase()}/setup/versions/${versionId.toUpperCase()}`))).status).toBe(200)
  expect(seen).toEqual([company, `${company}/${versionId}`])
})

// BF-21 (BI-03 option C, CEO decision): from schema 32 nothing refuses a setup save for Scope 3 volume, so a save that includes
// category 3 while energy-resold records are saved (each then counts twice) can take the stored count past 3,000. The save
// stands and says so; every other answer is exactly as before (no extra key).
test("BF-21: a setup save that takes the stored Scope 3 lines over 3,000 (schema 32, category 3 included) is saved with a warning", async () => {
  const withCategory3 = (included: boolean) => {
    const v = { ...version, setup: { screening: [{ id: "s3-3", scope: 3, category: "fuel_and_energy_related_activities", state: included ? "yes" : "no", reason: included ? "" : "Not material.", details: "", locationId: null }] } as unknown as CompanySetupVersion["setup"] }
    return { foundation: { ...view, currentVersion: v }, savedVersion: v, replayed: false } as CompanySetupSaveResult
  }
  const rec = (i: number, kind: string, state = "active") => ({ id: `81000000-0000-4000-8000-${String(i).padStart(12, "0")}`, companyId: COMPANY, kind, currentVersion: { activity: { state } }, history: [] }) as unknown as CollectionActivityRecord
  // 2,998 stored Scope 3 lines plus two energy-resold records: 3,000 with category 3 excluded, 3,002 with it included.
  const records = [...Array.from({ length: 2998 }, (_, i) => rec(i, "waste")), rec(9001, "energy_resold"), rec(9002, "energy_resold"), rec(9003, "electricity"), rec(9004, "waste", "withdrawn")]
  let reads = 0
  const app = (schema: number | undefined, included: boolean, list = records) => createCompanySetupRoutes({ database: database({ saveCompanySetup: async () => withCategory3(included), findCollectionActivities: async () => { reads++; return list } }), origin: ORIGIN,
    ...(schema === undefined ? {} : { schemaVersion: async () => schema }), validateUser: async token => token === "ok" ? { id: ACTOR, email: null, phone: null, fullName: null } : null })
  const save = async (schema: number | undefined, included: boolean, list = records) => { const r = await app(schema, included, list)(request(undefined, { method: "POST", body: JSON.stringify(body) })); return { status: r.status, body: await r.json() as Record<string, unknown> } }
  const warned = await save(32, true)
  expect(warned.status).toBe(201)
  expect(warned.body.warnings).toEqual([{ code: "scope3_line_budget_exceeded", lineBudget: { max: 3000, used: 3002 }, message: SCOPE3_CAPACITY_TEXT.setupOverLineBudget(3000, 3002) }])
  expect(SCOPE3_CAPACITY_TEXT.setupOverLineBudget(3000, 3002)).toBe("Company setup is saved. With category 3 included, Scope 3 now has 3,002 saved lines, more than its limit of 3,000 (each energy-resold record counts twice while category 3 is included), so Scope 3 results and report versions can’t be prepared until it is back within the limit. Withdraw Scope 3 lines you no longer need, or exclude category 3 again. Scope 1 and 2 are not affected.")
  // No warning (and the exact answer before BF-21) when category 3 is excluded, below schema 32, without a schema reader, or within the limit.
  reads = 0
  for (const [schema, included, list] of [[32, false, records], [31, true, records], [undefined, true, records], [32, true, records.slice(2)]] as const) {
    const plain = await save(schema, included, list)
    expect([plain.status, Object.keys(plain.body).sort()]).toEqual([201, ["foundation", "replayed", "savedVersion"]])
  }
  expect(reads).toBe(1) // only the in-limit case at 32 with category 3 included reads the records
  // A failed read never fails a committed save.
  const failing = createCompanySetupRoutes({ database: database({ saveCompanySetup: async () => withCategory3(true), findCollectionActivities: async () => { throw new Error("read failed") } }), origin: ORIGIN, schemaVersion: async () => 32, validateUser: async () => ({ id: ACTOR, email: null, phone: null, fullName: null }) })
  const committed = await failing(request(undefined, { method: "POST", body: JSON.stringify(body) }))
  expect([committed.status, Object.keys(await committed.json()).sort()]).toEqual([201, ["foundation", "replayed", "savedVersion"]])
})
