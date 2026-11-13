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

function harness(options: { schema?: number } = {}) {
  let saveError: { code: string } | null = null
  const calls: Array<{ name: string; args: unknown[] }> = []
  let evidence: any[] = []
  let downloadable: any = null
  let stored: Uint8Array<ArrayBuffer> = new Uint8Array([1, 2, 3])
  let failPut = false
  let failRegister = false
  let hasAccess = true
  let others: any[] = []
  let listedRecord: any = null // BF-03b: the harness record as findCollectionActivities lists it (null: as saved, active)
  let lineages: any[] = []
  const failures: Record<string, unknown> = {} // BF-08: an error the named database method throws
  let zipLookup: any = { zip: "94105", subregions: ["CAMX"], utilities: [{ subregion: "CAMX", utility: "Pacific Gas and Electric Co", eiaId: "14328", state: "CA", predominantUtility: true }], needsUtilityChoice: false, found: true, source: "EPA Power Profiler zip.csv (eGRID2023)" }
  const current = { id: VERSION, recordId: RECORD, companyId: COMPANY, revision: 1, previousVersionId: null, correctionReason: null, activity: activity().activity, payloadSha256: "a".repeat(64), createdBy: ACTOR, createdAt: "2026-09-28T00:00:00.000Z" } as any
  const record = { id: RECORD, companyId: COMPANY, kind: "fugitive", currentVersion: current, history: [{ ...current, activity: undefined }] } as any
  const database: CollectionRouteDatabase = {
    async findCollectionContext(...args) { calls.push({ name: "findContext", args }); if (failures.context) throw failures.context; return hasAccess ? { companyId: COMPANY, setupVersionId: SETUP, setupRevision: 1, locations: [{ id: LOCATION, name: "Office", inclusion: "included", control: "operational_control" }] } : null },
    async findCollectionActivities(...args) { calls.push({ name: "findActivities", args }); return [listedRecord ?? record, ...others] },
    async findCollectionActivityVersion(...args) { calls.push({ name: "findVersion", args }); return current },
    async saveCollectionActivity(...args) { calls.push({ name: "save", args }); if (saveError) throw saveError; if (failures.save) throw failures.save; return { record, version: current, replayed: false } },
    async findCollectionEvidence(...args) { calls.push({ name: "findEvidence", args }); return evidence },
    async reserveCollectionEvidenceUpload(...args) { calls.push({ name: "reserveEvidence", args }); if (failures.reserve) throw failures.reserve; const input = args[2] as any; return { uploadId: input.uploadId, evidenceId: input.evidenceId, objectKey: input.objectKey, bucket: COLLECTION_EVIDENCE_BUCKET } },
    async registerCollectionEvidence(...args) { calls.push({ name: "registerEvidence", args }); if (failRegister) throw new Error("sensitive-registration-marker"); return { uploadId: (args[2] as any).uploadId, evidenceId: evidence[0]?.id ?? (args[2] as any).evidenceId, reused: evidence.length > 0, quarantineStatus: "pending", orphanRecoveryRequired: false } },
    async markCollectionEvidenceRegistrationFailed(...args) { calls.push({ name: "markRegistrationFailed", args }); return { recoveryId: "00000000-0000-4000-8000-000000000008" } },
    async findDownloadableCollectionEvidence(...args) { calls.push({ name: "downloadable", args }); return downloadable },
    async findGridLossLineage(...args) { calls.push({ name: "findLineage", args }); return lineages },
    async createGridLossLineage(...args) { calls.push({ name: "createLineage", args }); if (failures.lineage) throw failures.lineage; return { ...(args[2] as any), companyId: COMPANY, createdBy: ACTOR, createdAt: "2026-09-28T00:00:00.000Z" } },
  }
  const storage: CollectionEvidenceStorage = {
    async put(...args) { calls.push({ name: "put", args }); if (failPut) throw new Error("sensitive-storage-marker"); stored = args[3] },
    async get(...args) { calls.push({ name: "get", args }); return stored },
  }
  const route = createCollectionRoutes({ database, evidenceStorage: storage, origin: ORIGIN, ...(options.schema === undefined ? {} : { schemaVersion: async () => options.schema! }), lookupZip: async zip => { calls.push({ name: "lookupZip", args: [zip] }); return zipLookup }, validateUser: async token => token === "valid" ? { id: ACTOR, email: "fixture@example.test", phone: null, fullName: null } : null })
  const request = (path: string, init: RequestInit = {}) => route(new Request(`https://api.example.test${path}`, { ...init, headers: { origin: ORIGIN, authorization: "Bearer valid", ...(init.headers ?? {}) } }))
  return { calls, request, failures, setLineages(value: any[]) { lineages = value }, setOthers(value: any[]) { others = value }, setRecord(value: any) { listedRecord = value }, setEvidence(value: any[]) { evidence = value }, setDownloadable(value: any) { downloadable = value }, setStored(value: Uint8Array<ArrayBuffer>) { stored = value }, setAccess(value: boolean) { hasAccess = value }, setZipLookup(value: any) { zipLookup = value }, failNextPut() { failPut = true }, failNextRegistration() { failRegister = true }, failSavesWith(code: string) { saveError = { code } } }
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

  // BF-09: the same image runs against hosted staging at schema 30 (before the owner applies 0031) and at 31. At both the BF-03
  // route check refuses a new record at 400 before any SQL; 0031's own refusal (54N31: reactivation, or a save that raced
  // past the check) is the same 422; duplicateConfirmedDistinct is refused before any SQL below 31 and passed on at 31.
  for (const schema of [30, 31]) test(`at schema ${schema}: the cap, 0031's refusal and the duplicate confirmation`, async () => {
    const h = harness({ schema })
    const gas = (i: number) => ({ id: `55555555-0000-4000-8000-${String(i).padStart(12, "0")}`, companyId: COMPANY, kind: "natural_gas", currentVersion: { activity: { state: "active" } }, history: [] })
    const post = (id: string, body: unknown) => h.request(`/workspace/${COMPANY}/collection/activities/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const fresh = () => ({ ...activity(), idempotencyKey: crypto.randomUUID() })
    const saves = () => h.calls.filter(call => call.name === "save").length
    const capability = await (await h.request(`/workspace/${COMPANY}/collection`)).json() as any
    expect(capability.capabilities.duplicateConfirmation).toBe(schema >= 31)
    // The route check: 1 + 399 = 400 active, a new record is refused before any SQL.
    h.setOthers(Array.from({ length: 399 }, (_, i) => gas(i)))
    const refused = await post("00000000-0000-4000-8000-0000000000b1", fresh())
    expect([refused.status, (await refused.json() as any).code, saves()]).toEqual([422, "record_limit_reached", 0])
    h.setOthers([])
    // The flag: refused before any SQL below 31 (the answer any unknown key got before this change); sent on at 31.
    const confirmed = { ...activity(), idempotencyKey: crypto.randomUUID(), activity: { ...activity().activity, payload: { ...activity().activity.payload, duplicateConfirmedDistinct: true } } }
    const flagged = await post("00000000-0000-4000-8000-0000000000b2", confirmed)
    if (schema < 31) expect([flagged.status, await flagged.json(), saves()]).toEqual([422, { error: "Invalid or unsupported collection record." }, 0])
    else {
      expect([flagged.status, saves()]).toEqual([201, 1])
      expect((h.calls.find(call => call.name === "save")!.args[3] as any).activity.payload.duplicateConfirmedDistinct).toBe(true)
    }
    // A wrongly typed flag is invalid at every schema.
    expect((await post("00000000-0000-4000-8000-0000000000b3", { ...confirmed, activity: { ...confirmed.activity, payload: { ...confirmed.activity.payload, duplicateConfirmedDistinct: "yes" } } })).status).toBe(422)
    // BF-03b: at both schemas the route check also refuses a withdrawn record corrected back to active at 400, before any SQL
    // (0031's 54N31 repeats it under the lock at 31). The same correction is accepted below the cap, and a correction of a
    // record that is active now (or a withdrawal) is never refused.
    const withdrawn = { id: RECORD, companyId: COMPANY, kind: "fugitive", currentVersion: { activity: { state: "withdrawn" } }, history: [] }
    const restore = () => ({ ...fresh(), expectedRevision: 2, expectedVersionId: VERSION, correctionReason: "Reactivated" })
    h.setRecord(withdrawn); h.setOthers(Array.from({ length: 400 }, (_, i) => gas(i)))
    const savesBefore = saves()
    const refusedRestore = await post(RECORD, restore())
    expect([refusedRestore.status, await refusedRestore.json(), saves() - savesBefore]).toEqual([422, { code: "record_limit_reached", error: "This company already has 400 active Scope 1 and 2 records, the most one draft can calculate. Withdraw records you no longer need, then save again." }, 0])
    h.setOthers(Array.from({ length: 399 }, (_, i) => gas(i)))
    expect([(await post(RECORD, restore())).status, saves() - savesBefore]).toEqual([201, 1])
    h.setRecord(null); h.setOthers(Array.from({ length: 400 }, (_, i) => gas(i)))
    expect((await post(RECORD, restore())).status).toBe(201)
    // 0031's refusal (raised only at 31, mapped at every schema): a save that raced past the route check.
    h.setOthers([])
    h.failSavesWith("54N31")
    const reactivated = await post(RECORD, { ...fresh(), expectedRevision: 2, expectedVersionId: VERSION, correctionReason: "Reactivated" })
    expect([reactivated.status, await reactivated.json()]).toEqual([422, { code: "record_limit_reached", error: "This company already has 400 active Scope 1 and 2 records, the most one draft can calculate. Withdraw records you no longer need, then save again." }])
  })

  // BF-03 (BL-02): a new active Scope 1/2 record is refused once 400 are active; corrections and withdrawals are not.
  test("refuses a new active Scope 1 or 2 record when 400 are already active, but allows corrections and withdrawals", async () => {
    const h = harness()
    const gas = (i: number, state = "active") => ({ id: `44444444-0000-4000-8000-${String(i).padStart(12, "0")}`, companyId: COMPANY, kind: "natural_gas", currentVersion: { activity: { state } }, history: [] })
    const post = (id: string, body: unknown) => h.request(`/workspace/${COMPANY}/collection/activities/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const fresh = () => ({ ...activity(), idempotencyKey: crypto.randomUUID() })
    // 1 fugitive record from the harness + 398 gas records + 1 withdrawn = 399 active: the 400th is allowed.
    h.setOthers([...Array.from({ length: 398 }, (_, i) => gas(i)), gas(900, "withdrawn")])
    expect((await post("00000000-0000-4000-8000-0000000000a1", fresh())).status).toBe(201)
    // 1 + 399 = 400 active: the next new record is refused with the named code and nothing is saved.
    h.setOthers([...Array.from({ length: 399 }, (_, i) => gas(i)), gas(900, "withdrawn")])
    const savesBefore = h.calls.filter(call => call.name === "save").length
    const refused = await post("00000000-0000-4000-8000-0000000000a2", fresh())
    expect(refused.status).toBe(422)
    expect(await refused.json()).toEqual({ code: "record_limit_reached", error: "This company already has 400 active Scope 1 and 2 records, the most one draft can calculate. Withdraw records you no longer need, then save again." })
    expect(h.calls.filter(call => call.name === "save").length).toBe(savesBefore)
    // A correction (revision 1) and a withdrawal are allowed at the cap.
    const correction = { ...fresh(), expectedRevision: 1, expectedVersionId: VERSION, correctionReason: "Fix" }
    expect((await post(RECORD, correction)).status).toBe(201)
    const withdrawal = { ...correction, idempotencyKey: crypto.randomUUID(), correctionReason: "Entered twice", activity: { ...activity().activity, state: "withdrawn", withdrawalReason: "Duplicate" } }
    expect((await post(RECORD, withdrawal)).status).toBe(201)
    // A replay of an already-saved first version is not a new record, even at the cap.
    h.setOthers([...Array.from({ length: 399 }, (_, i) => gas(i)), { ...gas(901), id: "00000000-0000-4000-8000-0000000000a3" }])
    expect((await post("00000000-0000-4000-8000-0000000000a3", fresh())).status).toBe(201)
    // Scope 3 records never count toward, and are never refused by, the Scope 1/2 cap.
    h.setOthers(Array.from({ length: 450 }, (_, i) => ({ ...gas(i), kind: "purchase_spend" })).concat(Array.from({ length: 398 }, (_, i) => gas(1000 + i)) as never))
    expect((await post("00000000-0000-4000-8000-0000000000a4", fresh())).status).toBe(201)
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

describe("BF1 collection route fixes", () => {
  test("an uppercase electricity record ID in grid-loss lineage is saved in canonical lowercase form", async () => {
    const h = harness()
    const record = "00000000-0000-4000-8000-0000000000ab"
    const response = await h.request(`/workspace/${COMPANY}/collection/grid-losses/${LINEAGE}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ electricityRecordId: record.toUpperCase(), reference: "r", notes: "" }) })
    expect(response.status).toBe(201)
    expect((h.calls.find(call => call.name === "createLineage")?.args[2] as any).electricityRecordId).toBe(record)
  })

  test("an empty upload ID header is refused as invalid before the body is read or anything is reserved", async () => {
    const h = harness()
    const response = await h.request(`/workspace/${COMPANY}/collection/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "x-neuvetra-original-name": "bill.pdf", "x-neuvetra-upload-id": "" }, body: EVIDENCE_BYTES })
    expect([response.status, ((await response.json()) as any).error]).toEqual([422, "Evidence upload ID is invalid."])
    expect(h.calls.some(call => ["reserveEvidence", "put", "registerEvidence"].includes(call.name))).toBe(false)
  })

  test("rejected evidence is reported as rejected (final), not as waiting for review", async () => {
    const h = harness()
    h.setEvidence([{ id: EVIDENCE, quarantineStatus: "rejected" }])
    const rejected = await h.request(`/workspace/${COMPANY}/collection/evidence/${EVIDENCE}/download`)
    expect([rejected.status, ((await rejected.json()) as any).code]).toEqual([410, "quarantine_rejected"])
    h.setEvidence([{ id: EVIDENCE, quarantineStatus: "pending" }])
    expect((await h.request(`/workspace/${COMPANY}/collection/evidence/${EVIDENCE}/download`)).status).toBe(423)
    expect(h.calls.some(call => call.name === "get")).toBe(false)
  })
})

// BF-08 (BL-07, BL-05): which status a refused write gets depends on whether the actor could read the company in this request.
describe("BF-08 truthful write errors", () => {
  const sqlError = (code: string) => Object.assign(new Error("private-database-marker"), { code })
  const post = (h: ReturnType<typeof harness>, path: string, body: unknown) => h.request(`/workspace/${COMPANY}/collection/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  const upload = (h: ReturnType<typeof harness>) => h.request(`/workspace/${COMPANY}/collection/evidence`, { method: "POST", headers: { "content-type": "application/pdf", "x-neuvetra-original-name": "bill.pdf", "x-neuvetra-upload-id": EVIDENCE }, body: EVIDENCE_BYTES })
  const readOnly = { error: "You can view this company’s records but not change them.", code: "read_only" }
  const unavailable = { error: "This record ID can’t be used. Save again to use a new one.", code: "record_id_unavailable" }

  test("a member whose read of the company succeeded gets 403 read_only on every write; nothing is leaked", async () => {
    const h = harness()
    h.failures.save = sqlError("42501"); h.failures.reserve = sqlError("42501"); h.failures.lineage = sqlError("42501")
    const responses = [
      await post(h, `activities/${RECORD}`, activity()),
      await upload(h),
      await post(h, `grid-losses/${LINEAGE}`, { electricityRecordId: RECORD, reference: "", notes: "" }),
    ]
    expect(await Promise.all(responses.map(async r => [r.status, await r.json()]))).toEqual([[403, readOnly], [403, readOnly], [403, readOnly]])
  })

  test("someone who cannot read the company, or whose read itself is refused, still gets the plain 404", async () => {
    const h = harness()
    h.failures.save = sqlError("42501")
    h.setAccess(false)
    const absent = await post(h, `activities/${RECORD}`, activity())
    expect([absent.status, await absent.json()]).toEqual([404, { error: "Collection resource not found." }])
    expect(h.calls.some(call => call.name === "save")).toBe(false)
    const refusedRead = harness()
    refusedRead.failures.context = sqlError("42501")
    const response = await post(refusedRead, `activities/${RECORD}`, activity())
    expect([response.status, await response.json()]).toEqual([404, { error: "Collection resource not found." }])
  })

  test("a 42501 on a read stays 404 even for a member", async () => {
    const h = harness()
    h.failures.context = sqlError("42501")
    const response = await h.request(`/workspace/${COMPANY}/collection/activities`)
    expect(response.status).toBe(404)
  })

  test("a unique violation on a first save of an ID this company does not have is record_id_unavailable; a correction or a racing own save is still a conflict", async () => {
    const h = harness()
    h.failures.save = sqlError("23505")
    h.setOthers([]) // the harness' own record has another ID than the one saved here
    const other = "00000000-0000-4000-8000-0000000000b1"
    const first = await post(h, `activities/${other}`, activity())
    expect([first.status, await first.json()]).toEqual([409, unavailable])
    const correction = await post(h, `activities/${other}`, { ...activity(), expectedRevision: 1, expectedVersionId: VERSION, correctionReason: "Fix" })
    expect([correction.status, (await correction.json() as any).code]).toEqual([409, "revision_conflict"])
    // This company already has the record (two first saves racing): a true revision conflict.
    const racing = await post(h, `activities/${RECORD}`, activity())
    expect([racing.status, (await racing.json() as any).code]).toEqual([409, "revision_conflict"])
    // An idempotency or head conflict (40001) is unchanged.
    h.failures.save = sqlError("40001")
    expect((await (await post(h, `activities/${other}`, activity())).json() as any).code).toBe("revision_conflict")
  })

  test("an upload or lineage ID that another company holds is record_id_unavailable", async () => {
    const h = harness()
    h.failures.reserve = sqlError("23505"); h.failures.lineage = sqlError("23505")
    const up = await upload(h)
    expect([up.status, await up.json()]).toEqual([409, unavailable])
    const lineage = await post(h, `grid-losses/${LINEAGE}`, { electricityRecordId: RECORD, reference: "", notes: "" })
    expect([lineage.status, await lineage.json()]).toEqual([409, unavailable])
    // F1: this company already links that electricity record (a second source from a stale list): its own conflict, not an ID problem.
    h.setLineages([{ id: "00000000-0000-4000-8000-0000000000c1", electricityRecordId: RECORD }])
    const second = await post(h, `grid-losses/${LINEAGE}`, { electricityRecordId: RECORD, reference: "", notes: "" })
    expect([second.status, (await second.json() as any).code]).toEqual([409, "revision_conflict"])
    h.setLineages([{ id: "00000000-0000-4000-8000-0000000000c2", electricityRecordId: "00000000-0000-4000-8000-0000000000c3" }])
    expect((await (await post(h, `grid-losses/${LINEAGE}`, { electricityRecordId: RECORD, reference: "", notes: "" })).json() as any).code).toBe("record_id_unavailable")
    h.setLineages([])
    h.setEvidence([{ id: EVIDENCE }]) // this company already holds the upload: a racing own upload keeps the conflict answer
    const own = await upload(h)
    expect([own.status, (await own.json() as any).code]).toEqual([409, "revision_conflict"])
  })
})
