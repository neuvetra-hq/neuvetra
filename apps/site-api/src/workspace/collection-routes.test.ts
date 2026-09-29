import { describe, expect, test } from "bun:test"
import { COLLECTION_EVIDENCE_BUCKET, COLLECTION_EVIDENCE_MAX_BYTES } from "@neuvetra/database"
import { createCollectionRoutes, type CollectionEvidenceStorage, type CollectionRouteDatabase } from "./collection-routes"

const ORIGIN = "https://staging.example.test"
const COMPANY = "00000000-0000-4000-8000-000000000001"
const ACTOR = "00000000-0000-4000-8000-000000000002"
const RECORD = "00000000-0000-4000-8000-000000000003"
const VERSION = "00000000-0000-4000-8000-000000000004"
const EVIDENCE = "00000000-0000-4000-8000-000000000005"
const LINEAGE = "00000000-0000-4000-8000-000000000006"
const SETUP = "00000000-0000-4000-8000-000000000009"
const LOCATION = "00000000-0000-4000-8000-00000000000a"
const EVIDENCE_BYTES = new TextEncoder().encode("%PDF-1.7\nsynthetic evidence")
const EVIDENCE_SHA = new Bun.CryptoHasher("sha256").update(EVIDENCE_BYTES).digest("hex")

function activity() {
  return {
    idempotencyKey: "00000000-0000-4000-8000-000000000007",
    expectedRevision: 0,
    expectedVersionId: null,
    correctionReason: null,
    activity: {
      kind: "fugitive",
      locationId: LOCATION,
      setupVersionId: SETUP,
      sourceId: "cooling-group-a",
      state: "active",
      withdrawalReason: null,
      quantity: { originalValue: "12.5", originalUnit: "kg", normalizedValue: "12.5", normalizedUnit: "kg" },
      quality: "unknown",
      estimateBasis: null,
      period: { start: "2025-01-01", endExclusive: "2026-01-01" },
      reference: "synthetic test fixture",
      notes: "",
      evidenceIds: [],
      payload: {
        gas: "HFC-134a", unit: "kg", terms: { PN: "12.5", CN: "0", PS: "0", CD: "0", RD: "0" },
        insideBoundary: null, maintainsRefrigerantStock: null, retrofitInPeriod: null,
        contractorRecordsComplete: false, eventChronologyComplete: false,
      },
    },
  }
}

function harness() {
  const calls: Array<{ name: string; args: unknown[] }> = []
  let evidence: any[] = []
  let downloadable: any = null
  let stored: Uint8Array<ArrayBuffer> = new Uint8Array([1, 2, 3])
  let failPut = false
  let failRegister = false
  let hasAccess = true
  let zipLookup: any = { zip: "94105", subregions: ["CAMX"], utilities: [{ subregion: "CAMX", utility: "Pacific Gas and Electric Co", eiaId: "14328", state: "CA", predominantUtility: true }], needsUtilityChoice: false, found: true, source: "EPA Power Profiler zip.csv (eGRID2023)" }
  const current = { id: VERSION, recordId: RECORD, companyId: COMPANY, revision: 1, previousVersionId: null, correctionReason: null, activity: activity().activity, payloadSha256: "a".repeat(64), createdBy: ACTOR, createdAt: "2026-09-28T00:00:00.000Z" } as any
  const record = { id: RECORD, companyId: COMPANY, kind: "fugitive", currentVersion: current, history: [{ ...current, activity: undefined }] } as any
  const database: CollectionRouteDatabase = {
    async findCollectionContext(...args) { calls.push({ name: "findContext", args }); return hasAccess ? { companyId: COMPANY, setupVersionId: SETUP, setupRevision: 1, locations: [{ id: LOCATION, name: "Office", inclusion: "included", control: "operational_control" }] } : null },
    async findCollectionActivities(...args) { calls.push({ name: "findActivities", args }); return [record] },
    async findCollectionActivityVersion(...args) { calls.push({ name: "findVersion", args }); return current },
    async saveCollectionActivity(...args) { calls.push({ name: "save", args }); return { record, version: current, replayed: false } },
    async findCollectionEvidence(...args) { calls.push({ name: "findEvidence", args }); return evidence },
    async reserveCollectionEvidenceUpload(...args) { calls.push({ name: "reserveEvidence", args }); const input = args[2] as any; return { uploadId: input.uploadId, evidenceId: input.evidenceId, objectKey: input.objectKey, bucket: COLLECTION_EVIDENCE_BUCKET } },
    async registerCollectionEvidence(...args) { calls.push({ name: "registerEvidence", args }); if (failRegister) throw new Error("sensitive-registration-marker"); return { uploadId: (args[2] as any).uploadId, evidenceId: evidence[0]?.id ?? (args[2] as any).evidenceId, reused: evidence.length > 0, quarantineStatus: "pending", orphanRecoveryRequired: false } },
    async markCollectionEvidenceRegistrationFailed(...args) { calls.push({ name: "markRegistrationFailed", args }); return { recoveryId: "00000000-0000-4000-8000-000000000008" } },
    async findDownloadableCollectionEvidence(...args) { calls.push({ name: "downloadable", args }); return downloadable },
    async findGridLossLineage(...args) { calls.push({ name: "findLineage", args }); return [] },
    async createGridLossLineage(...args) { calls.push({ name: "createLineage", args }); return { ...(args[2] as any), companyId: COMPANY, createdBy: ACTOR, createdAt: "2026-09-28T00:00:00.000Z" } },
  }
  const storage: CollectionEvidenceStorage = {
    async put(...args) { calls.push({ name: "put", args }); if (failPut) throw new Error("sensitive-storage-marker"); stored = args[3] },
    async get(...args) { calls.push({ name: "get", args }); return stored },
  }
  const route = createCollectionRoutes({ database, evidenceStorage: storage, origin: ORIGIN, lookupZip: async zip => { calls.push({ name: "lookupZip", args: [zip] }); return zipLookup }, validateUser: async token => token === "valid" ? { id: ACTOR, email: "fixture@example.test", phone: null, fullName: null } : null })
  const request = (path: string, init: RequestInit = {}) => route(new Request(`https://api.example.test${path}`, { ...init, headers: { origin: ORIGIN, authorization: "Bearer valid", ...(init.headers ?? {}) } }))
  return { calls, request, setEvidence(value: any[]) { evidence = value }, setDownloadable(value: any) { downloadable = value }, setStored(value: Uint8Array<ArrayBuffer>) { stored = value }, setAccess(value: boolean) { hasAccess = value }, setZipLookup(value: any) { zipLookup = value }, failNextPut() { failPut = true }, failNextRegistration() { failRegister = true } }
}

describe("collection routes", () => {
  test("exposes engine-independent capabilities and tenant-scoped activity reads", async () => {
    const h = harness()
    const capability = await h.request(`/workspace/${COMPANY}/collection`)
    expect(capability.status).toBe(200)
    expect(await capability.json()).toMatchObject({ context: { setupVersionId: SETUP, locations: [{ id: LOCATION }] }, capabilities: { calculations: false, zipLookup: "available", scope3: { gridLossLineage: true, calculations: false } } })
    const response = await h.request(`/workspace/${COMPANY}/collection/activities`)
    expect(response.status).toBe(200)
    expect((await response.json() as any).records[0].companyId).toBe(COMPANY)
    expect(h.calls.find(call => call.name === "findActivities")?.args).toEqual([ACTOR, COMPANY])
  })

  test("preserves literal unknown tri-state and sends validated immutable save input", async () => {
    const h = harness()
    const input = activity()
    const response = await h.request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })
    expect(response.status).toBe(201)
    const sent = h.calls.find(call => call.name === "save")?.args[3] as any
    expect(sent.activity.payload.insideBoundary).toBeNull()
    expect(sent.activity.payload.maintainsRefrigerantStock).toBeNull()
    expect(sent.activity.payload.retrofitInPeriod).toBeNull()
    expect(sent.activity.quantity.originalValue).toBe("12.5")
  })

  test("rejects unreal dates before any persistence call", async () => {
    const h = harness()
    const input = activity()
    input.activity.period.start = "2025-02-30"
    const response = await h.request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })
    expect(response.status).toBe(422)
    expect(h.calls.some(call => call.name === "save")).toBe(false)
  })

  test("preserves incomplete inputs for later resolution instead of coercing them to zero", async () => {
    const h = harness()
    const sourceDecimal = activity()
    sourceDecimal.activity.quantity = { originalValue: "12.3456", originalUnit: "kg", normalizedValue: null, normalizedUnit: null } as any
    const vehicle = activity()
    vehicle.activity = {
      ...vehicle.activity,
      kind: "vehicle",
      sourceId: "fleet-a",
      quantity: { originalValue: "unknown", originalUnit: "US_gallon", normalizedValue: null, normalizedUnit: null },
      payload: { vehicleGroupId: "fleet-a", fuel: "diesel", vehicleType: "heavy_duty", modelYear: 2025, gallons: "unknown", vehicleCount: null, miles: null, fuelEconomy: null },
    } as any
    const electricity = activity()
    electricity.activity = {
      ...electricity.activity,
      kind: "electricity",
      quantity: { originalValue: "unknown", originalUnit: "kWh", normalizedValue: null, normalizedUnit: null },
      sourceId: "meter-a",
      payload: { meterOrAccountNumber: "meter-a", utilityName: "Utility", site: "Site", zip: "94105", subregion: "CAMX", utilityEiaId: null, instruments: [{ type: "supplier_specific_rate", mwh: "unknown", qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: null, generationTechnology: "natural_gas", rateLbPerMwh: null }] },
    } as any
    for (const input of [sourceDecimal, vehicle, electricity]) {
      const response = await h.request(`/workspace/${COMPANY}/collection/activities/${RECORD}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) })
      expect(response.status).toBe(201)
    }
    const saved = h.calls.filter(call => call.name === "save").map(call => (call.args[3] as any).activity)
    expect(saved[0].quantity).toEqual({ originalValue: "12.3456", originalUnit: "kg", normalizedValue: null, normalizedUnit: null })
    expect(saved[1].payload).toMatchObject({ gallons: "unknown", miles: null, fuelEconomy: null })
    expect(saved[2].payload).toMatchObject({ subregion: "CAMX", utilityEiaId: null, instruments: [{ mwh: "unknown", evidenceReference: null, rateLbPerMwh: null }] })
  })

  test("creates Scope 3 category 3 lineage only through an electricity record reference", async () => {
    const h = harness()
    const response = await h.request(`/workspace/${COMPANY}/collection/grid-losses/${LINEAGE}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ electricityRecordId: RECORD, reference: "source 2 record", notes: "no calculation" }) })
    expect(response.status).toBe(201)
    expect(h.calls.find(call => call.name === "createLineage")?.args[2]).toEqual({ id: LINEAGE, electricityRecordId: RECORD, reference: "source 2 record", notes: "no calculation" })
    expect((await response.json() as any).lineage.electricityRecordId).toBe(RECORD)
  })

  test("hashes an accepted upload, scopes its key, and registers it pending", async () => {
    const h = harness()
    const bytes = EVIDENCE_BYTES
    const response = await h.request(`/workspace/${COMPANY}/collection/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "x-neuvetra-original-name": encodeURIComponent("bill 2025.pdf"), "x-neuvetra-upload-id": EVIDENCE }, body: bytes })
    expect(response.status).toBe(201)
    expect(h.calls.filter(call => ["reserveEvidence", "put", "registerEvidence"].includes(call.name)).map(call => call.name)).toEqual(["reserveEvidence", "put", "registerEvidence"])
    const put = h.calls.find(call => call.name === "put")!
    expect(put.args.slice(0, 3)).toEqual(["valid", COLLECTION_EVIDENCE_BUCKET, `${COMPANY}/original/${EVIDENCE}`])
    const registered = h.calls.find(call => call.name === "registerEvidence")?.args[2] as any
    expect(registered).toMatchObject({ uploadId: EVIDENCE, evidenceId: EVIDENCE, originalName: "bill 2025.pdf", mediaType: "application/pdf", byteLength: bytes.byteLength, sha256: EVIDENCE_SHA })
    expect(h.calls.find(call => call.name === "reserveEvidence")?.args[2]).toEqual(registered)
  })

  test("reuses same-company duplicate metadata without uploading another object", async () => {
    const h = harness()
    const bytes = EVIDENCE_BYTES
    h.setEvidence([{ id: RECORD, companyId: COMPANY, bucket: COLLECTION_EVIDENCE_BUCKET, objectKey: `${COMPANY}/original/existing`, originalName: "first.pdf", mediaType: "application/pdf", byteLength: bytes.byteLength, sha256: EVIDENCE_SHA, quarantineStatus: "pending", uploadedBy: ACTOR, createdAt: "2026-09-28T00:00:00.000Z" }])
    const response = await h.request(`/workspace/${COMPANY}/collection/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "x-neuvetra-original-name": "duplicate.pdf", "x-neuvetra-upload-id": EVIDENCE }, body: bytes })
    expect(response.status).toBe(200)
    expect(h.calls.some(call => call.name === "put")).toBe(false)
    expect(h.calls.filter(call => ["reserveEvidence", "registerEvidence"].includes(call.name)).map(call => call.name)).toEqual(["reserveEvidence", "registerEvidence"])
    expect((h.calls.find(call => call.name === "registerEvidence")?.args[2] as any).objectKey).toBe(`${COMPANY}/original/existing`)
  })

  test("fails closed without probing pending bytes when storage upload is unavailable", async () => {
    const h = harness()
    const bytes = EVIDENCE_BYTES
    h.failNextPut()
    const response = await h.request(`/workspace/${COMPANY}/collection/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "x-neuvetra-original-name": "retry.pdf", "x-neuvetra-upload-id": EVIDENCE }, body: bytes })
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain("sensitive-storage-marker")
    expect(h.calls.map(call => call.name)).not.toContain("get")
    expect(h.calls.map(call => call.name)).not.toContain("registerEvidence")
    expect(h.calls.map(call => call.name)).not.toContain("markRegistrationFailed")
    expect(h.calls.filter(call => ["reserveEvidence", "put"].includes(call.name)).map(call => call.name)).toEqual(["reserveEvidence", "put"])
  })

  test("records orphan recovery after storage succeeds but evidence registration fails", async () => {
    const h = harness()
    h.failNextRegistration()
    const response = await h.request(`/workspace/${COMPANY}/collection/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "x-neuvetra-original-name": "orphan.pdf", "x-neuvetra-upload-id": EVIDENCE }, body: EVIDENCE_BYTES })
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain("sensitive-registration-marker")
    expect(h.calls.filter(call => ["reserveEvidence", "put", "registerEvidence", "markRegistrationFailed"].includes(call.name)).map(call => call.name)).toEqual(["reserveEvidence", "put", "registerEvidence", "markRegistrationFailed"])
    expect(h.calls.find(call => call.name === "markRegistrationFailed")?.args).toEqual([ACTOR, COMPANY, EVIDENCE])
  })

  test("does not release pending evidence and verifies clean bytes before download", async () => {
    const h = harness()
    h.setEvidence([{ id: EVIDENCE }])
    const pending = await h.request(`/workspace/${COMPANY}/collection/evidence/${EVIDENCE}/download`)
    expect(pending.status).toBe(423)
    expect(h.calls.some(call => call.name === "get")).toBe(false)
    h.setStored(new Uint8Array([1, 2, 3]))
    h.setDownloadable({ bucket: COLLECTION_EVIDENCE_BUCKET, objectKey: `${COMPANY}/original/${EVIDENCE}`, sha256: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81", mediaType: "application/pdf", byteLength: 3 })
    const clean = await h.request(`/workspace/${COMPANY}/collection/evidence/${EVIDENCE}/download`)
    expect(clean.status).toBe(200)
    expect(clean.headers.get("x-content-type-options")).toBe("nosniff")
    expect(clean.headers.get("x-content-sha256")).toBe("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81")
    h.setStored(new Uint8Array([9, 9, 9]))
    const changed = await h.request(`/workspace/${COMPANY}/collection/evidence/${EVIDENCE}/download`)
    expect(changed.status).toBe(503)
  })

  test("rejects unsupported and oversized evidence before storage", async () => {
    const h = harness()
    const unsupported = await h.request(`/workspace/${COMPANY}/collection/evidence`, { method: "POST", headers: { "content-type": "text/html", "x-neuvetra-original-name": "bad.html" }, body: "bad" })
    expect(unsupported.status).toBe(415)
    const oversized = await h.request(`/workspace/${COMPANY}/collection/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "content-length": String(COLLECTION_EVIDENCE_MAX_BYTES + 1), "x-neuvetra-original-name": "large.pdf" }, body: "x" })
    expect(oversized.status).toBe(413)
    expect(h.calls.some(call => call.name === "put")).toBe(false)
  })

  test("refuses evidence whose first bytes contradict its declared type", async () => {
    const h = harness()
    const spoofed = await h.request(`/workspace/${COMPANY}/collection/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "x-neuvetra-original-name": "spoofed.pdf" }, body: new TextEncoder().encode("not a PDF") })
    expect(spoofed.status).toBe(422)
    expect((await spoofed.json() as any).code).toBe("file_type_mismatch")
    expect(h.calls.some(call => call.name === "reserveEvidence")).toBe(false)
  })

  test("returns not found for a foreign company before reading any collection data", async () => {
    const h = harness()
    h.setAccess(false)
    for (const path of ["", "/activities", "/evidence", "/zip-lookup?zip=94105"]) {
      const response = await h.request(`/workspace/${COMPANY}/collection${path}`)
      expect(response.status).toBe(404)
    }
    expect(h.calls.every(call => call.name === "findContext")).toBe(true)
  })

  test("validates an electricity ZIP, subregion and utility against the pinned lookup", async () => {
    const h = harness()
    const base = activity()
    base.activity = { ...base.activity, kind: "electricity", sourceId: "meter-a", quantity: { originalValue: "100", originalUnit: "kWh", normalizedValue: "100", normalizedUnit: "kWh" }, payload: { meterOrAccountNumber: "meter-a", utilityName: "Utility", site: "Site", zip: "94105", subregion: "NYUP", utilityEiaId: null, instruments: [] } } as any
    const route = `/workspace/${COMPANY}/collection/activities/${RECORD}`
    const post = () => h.request(route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(base) })
    expect((await post()).status).toBe(422)
    ;(base.activity.payload as any).subregion = "CAMX"
    expect((await post()).status).toBe(201)
    h.setZipLookup({ zip: "94105", subregions: ["CAMX", "NWPP"], utilities: [{ subregion: "CAMX", utility: "Example utility", eiaId: "123", state: "CA", predominantUtility: true }], needsUtilityChoice: true, found: true, source: "test" })
    expect((await post()).status).toBe(422)
    ;(base.activity.payload as any).utilityEiaId = "wrong"
    expect((await post()).status).toBe(422)
    ;(base.activity.payload as any).utilityEiaId = "123"
    expect((await post()).status).toBe(201)
    expect(h.calls.filter(call => call.name === "save")).toHaveLength(2)
    const lookup = await h.request(`/workspace/${COMPANY}/collection/zip-lookup?zip=94105`)
    expect(lookup.status).toBe(200)
    expect((await lookup.json() as any).lookup.needsUtilityChoice).toBe(true)
  })

  test("requires exact origin for writes and authentication for every route", async () => {
    const h = harness()
    const forbidden = await h.request(`/workspace/${COMPANY}/collection/grid-losses/${LINEAGE}`, { method: "POST", headers: { origin: "https://other.example.test", "content-type": "application/json" }, body: "{}" })
    expect(forbidden.status).toBe(403)
    const unauthorized = await createCollectionRoutes({ database: {} as any, evidenceStorage: {} as any, origin: ORIGIN, validateUser: async () => null })(new Request(`https://api.example.test/workspace/${COMPANY}/collection`, { headers: { authorization: "Bearer invalid" } }))
    expect(unauthorized.status).toBe(401)
  })
})
