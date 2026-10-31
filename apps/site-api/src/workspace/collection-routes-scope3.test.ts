// Scope 3 package 2 (D5): the collection route saves the four Scope 3 kinds only when the database is at schema 29.
// Below it, a Scope 3 save is refused before any database call; Scope 1 and 2 behave the same either way.
// Scope 3 completion I-02: the 0030 kinds and payload features need schema 30; below it they are refused the same way
// (503, never a 422 from the database), and the capability lists the kinds the database stores.
import { describe, expect, test } from "bun:test"
import { SCOPE3_COLLECTION_KINDS, SCOPE3_LEGACY_KINDS } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"
import { SCOPE3_PAYLOAD_FIXTURES } from "../../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import { createCollectionRoutes, type CollectionRouteDatabase } from "./collection-routes"

const ORIGIN = "https://staging.example.test"
const COMPANY = "29000000-0000-4000-8000-000000000001", ACTOR = "29000000-0000-4000-8000-000000000002", RECORD = "29000000-0000-4000-8000-000000000003"
const SETUP = "29000000-0000-4000-8000-000000000009", LOCATION = "29000000-0000-4000-8000-00000000000a"
const common = { locationId: LOCATION, setupVersionId: SETUP, state: "active", withdrawalReason: null, quality: "actual", estimateBasis: null, period: { start: "2025-01-01", endExclusive: "2026-01-01" }, reference: "Synthetic", notes: "", evidenceIds: [] }
const q = (value: string, unit: string) => ({ originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit })
const activities = {
  transport: { ...common, kind: "transport", sourceId: "LANE-1", quantity: q("1200.5", "short ton-mile"), payload: { category: 4, vehicle: "rail", loadBasis: "shared_vehicle", thirdPartyFacilities: "none" } },
  waste: { ...common, kind: "waste", sourceId: "W-1", quantity: q("17.125", "metric_ton"), payload: { category: 5, material: "asphalt_concrete", treatment: "recycled" } },
  business_travel: { ...common, kind: "business_travel", sourceId: "T-1", quantity: q("2400", "mile"), payload: { mode: "air", passengerSegments: 4, haulBasis: null } },
  employee_commuting: { ...common, kind: "employee_commuting", sourceId: "C-1", quantity: q("9800", "passenger-mile"), payload: { mode: "bus" } },
  natural_gas: { ...common, kind: "natural_gas", sourceId: "G-1", quantity: q("12.5", "therm"), payload: { heatContent: null } },
}
const save = (activity: unknown) => ({ idempotencyKey: crypto.randomUUID(), expectedRevision: 0, expectedVersionId: null, correctionReason: null, activity })

function harness(schema: number | undefined) {
  const calls: string[] = []
  const database = {
    async findCollectionContext() { calls.push("context"); return { companyId: COMPANY, setupVersionId: SETUP, setupRevision: 1, sameContentSetupVersionIds: [SETUP], boundaryApproach: "operational_control", reportingPeriod: { start: "2025-01-01", endExclusive: "2026-01-01" }, locations: [{ id: LOCATION, name: "Office", inclusion: "included", control: "reporting_company", entityId: null, startMode: "period_start", endMode: "period_end" }] } },
    async saveCollectionActivity(...args: unknown[]) { calls.push("save"); const input = args[3] as { activity: { kind: string } }; return { record: { id: RECORD, kind: input.activity.kind }, version: {}, replayed: false } },
  } as unknown as CollectionRouteDatabase
  const route = createCollectionRoutes({ database, evidenceStorage: { put: async () => {}, get: async () => new Uint8Array() }, origin: ORIGIN, validateUser: async token => token === "valid" ? { id: ACTOR, email: null, phone: null, fullName: null } : null,
    ...(schema === undefined ? {} : { schemaVersion: async () => { calls.push("schema"); return schema } }) })
  const request = (path: string, init: RequestInit = {}) => route(new Request(`https://api.example.test${path}`, { ...init, headers: { origin: ORIGIN, authorization: "Bearer valid", "content-type": "application/json", ...(init.headers ?? {}) } }))
  return { calls, request }
}

describe("Scope 3 collection behind the schema 29 gate (D5)", () => {
  test("at schema 28 every Scope 3 kind is refused before the database; Scope 1 still saves", async () => {
    for (const schema of [28, undefined]) {
      const { calls, request } = harness(schema)
      for (const kind of ["transport", "waste", "business_travel", "employee_commuting"] as const) {
        const response = await request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", body: JSON.stringify(save(activities[kind])) })
        expect([kind, response.status]).toEqual([kind, 503])
        expect(await response.json()).toEqual({ error: "Scope 3 activity is not available yet.", code: "scope3_unavailable" })
      }
      expect(calls.filter(call => call === "save")).toEqual([])
      expect((await request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", body: JSON.stringify(save(activities.natural_gas)) })).status).toBe(201)
      expect(calls.filter(call => call === "save")).toHaveLength(1)
      const root = await (await request(`/workspace/${COMPANY}/collection`)).json()
      expect(root.capabilities).toEqual({ calculations: false, zipLookup: "available", scope3: { gridLossLineage: true, calculations: false, kinds: [], completion: false } })
    }
  })

  test("at schema 29 the four Scope 3 kinds save, and the capability says so", async () => {
    const { calls, request } = harness(29)
    for (const kind of ["transport", "waste", "business_travel", "employee_commuting"] as const) {
      const response = await request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", body: JSON.stringify(save(activities[kind])) })
      expect([kind, response.status]).toEqual([kind, 201])
    }
    expect(calls.filter(call => call === "save")).toHaveLength(4)
    const root = await (await request(`/workspace/${COMPANY}/collection`)).json()
    expect(root.capabilities.scope3).toEqual({ gridLossLineage: true, calculations: true, kinds: [...SCOPE3_LEGACY_KINDS], completion: false })
  })

  test("I-02: at schema 29 every 0030 kind and payload feature is refused with 503 before the database; at 30 each saves", async () => {
    const needs30 = SCOPE3_PAYLOAD_FIXTURES.filter(f => f.valid && (!(SCOPE3_LEGACY_KINDS as readonly string[]).includes(f.kind) || f.label.includes("data quality") || f.label.includes("v2") || f.label.includes("(normalized from 0030)")))
    expect(new Set(needs30.map(f => f.kind)).size).toBe(SCOPE3_COLLECTION_KINDS.length)
    for (const schema of [29, 30]) {
      const { calls, request } = harness(schema)
      for (const f of needs30) {
        const response = await request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", body: JSON.stringify(save({ ...common, kind: f.kind, sourceId: "S-1", quantity: f.quantity, payload: f.payload })) })
        if (schema === 29) {
          expect([f.label, response.status]).toEqual([f.label, 503])
          expect(await response.json()).toEqual({ error: "This record type needs database schema 30.", code: "scope3_schema_30_required" })
        } else expect([f.label, response.status]).toEqual([f.label, 201])
      }
      expect(calls.filter(call => call === "save")).toHaveLength(schema === 29 ? 0 : needs30.length)
      const root = await (await request(`/workspace/${COMPANY}/collection`)).json()
      expect(root.capabilities.scope3).toEqual({ gridLossLineage: true, calculations: true, kinds: schema === 29 ? [...SCOPE3_LEGACY_KINDS] : [...SCOPE3_COLLECTION_KINDS], completion: schema === 30 })
    }
    // A 0029 hotel record (room-night written, not normalized) still saves at 29.
    const { request } = harness(29)
    const hotel = { ...common, kind: "business_travel", sourceId: "H-1", quantity: { originalValue: "10", originalUnit: "room-night", normalizedValue: null, normalizedUnit: null }, payload: { mode: "hotel", passengerSegments: null, haulBasis: null } }
    expect((await request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", body: JSON.stringify(save(hotel)) })).status).toBe(201)
  })

  test("an invalid Scope 3 record is refused as invalid at either schema, never as unavailable", async () => {
    for (const schema of [29, 28, 30]) {
      const { calls, request } = harness(schema)
      const bad = { ...activities.waste, payload: { category: 4, material: "glass", treatment: "recycled" } }
      const response = await request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", body: JSON.stringify(save(bad)) })
      expect(response.status).toBe(422)
      expect(calls).not.toContain("save")
    }
  })
  test("DB-01: text the database can't store is refused as invalid (422) before the save, never as an outage (503)", async () => {
    const bad = [
      { ...activities.waste, payload: { category: 5, material: "unknown\u0000material", treatment: "recycled" } },
      { ...activities.waste, payload: { category: 5, material: "glass", treatment: "lone \ud800 surrogate" } },
      { ...activities.transport, payload: { category: 4, vehicle: "truck\u0007", loadBasis: "shared_vehicle", thirdPartyFacilities: "none" } },
      { ...activities.business_travel, payload: { mode: "air", passengerSegments: 1, haulBasis: "agency report\u0000" } },
      { ...activities.employee_commuting, payload: { mode: "\udc00bus" } },
    ]
    for (const activity of bad) {
      const { calls, request } = harness(29)
      const response = await request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", body: JSON.stringify(save(activity)) })
      expect([activity.kind, response.status, calls.includes("save")]).toEqual([activity.kind, 422, false])
    }
  })
})
