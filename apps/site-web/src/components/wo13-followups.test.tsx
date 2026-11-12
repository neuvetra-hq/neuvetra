/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures are hand-built; storage and fetch are replaced for the test. */
// WO-13 (12 November 2026): QA's follow-ups 2–4 of PR #55 and the WO-05b follow-up on "new record" drafts. Each block below
// failed on main 46cb733 before this change. Follow-up 1 (the Results banner) is pinned in ResultsReport.test.tsx and the
// session-ended screen in lib/staging-authorization.test.ts.
import { afterEach, describe, expect, mock, test } from "bun:test"
import { computeReadiness, duplicatePairTitle, progressAnswer, READINESS_TEXT, scope12Items, type Readiness } from "@/lib/readiness"
import { computeJourneyStatus } from "@/lib/journey-status"
import { subscribeWriteActivity, subscribeWrites, sharedFetch } from "@/lib/shared-get"
import { activityDraftFields, admitDrafts, clearAllDrafts, draftKey, draftStorage, noteSavedRecords, readDraft, type DraftScope } from "@/lib/draft-store"
import { listCollectionActivities } from "@/lib/collection-api"
import * as plain from "@/lib/plain-language"

const ready = (readiness: Readiness) => { if (readiness.state !== "ready") throw new Error(`readiness is ${readiness.state}`); return readiness }
const record = (id: string, kind: string, state: string, extra: Record<string, unknown> = {}) => ({ id, kind, label: plain.kindLabel(kind), sourceId: id.toUpperCase(), locationId: "l1", site: "Office", state, reasons: [`Reason for ${id}.`], evidenceCount: 1, quality: "actual", ...extra })
function finished(records: any[]) {
  return {
    setup: { saved: true, revision: 4, legalName: "Bayline Foods", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, boundary: "operational_control", sites: { total: 1, included: 1, excluded: 0, undecided: 0 }, missing: [] as any[] },
    collection: { total: records.length, active: records.length, ready: records.length, attention: 0, held: 0, olderSetup: 0, partial: 0, withdrawn: 0, excluded: 0, noEvidence: 0, qualityUnknown: 0, byKind: {}, records },
    gaps: [] as any[], evidence: { total: 2, checking: 0, cleared: 2, rejected: 0 }, canManage: true,
    next: { panel: "results", title: "Review your draft results", body: "", action: "View results" },
    progress: { setup: "done", collection: "done", results: "ready" },
  } as any
}
const duplicate = (id: string) => record(id, "natural_gas", "ready", { possibleDuplicate: "Possible duplicate of GAS-0.", possibleDuplicateOther: { id: "gas-0", label: "Natural gas", sourceId: "GAS-0" } })

describe("follow-up 2: one possible duplicate “is listed”, several “are listed”, in the Next step and in Ask", () => {
  test("one", () => {
    const r = ready(computeReadiness({ status: finished([record("gas-0", "natural_gas", "ready"), duplicate("gas-1")]), statusFailed: false, scope3: { state: "off" } }))
    const listed = "1 possible duplicate to confirm (both records are counted; not counted as open) is listed under “What needs attention”."
    expect(r.next.body).toEndWith(` ${listed}`)
    expect(progressAnswer(r)[0]).toEndWith(` ${listed}`)
    expect(progressAnswer(r).join("\n")).not.toContain("are listed")
  })
  test("several", () => {
    const r = ready(computeReadiness({ status: finished([record("gas-0", "natural_gas", "ready"), duplicate("gas-1"), duplicate("gas-2")]), statusFailed: false, scope3: { state: "off" } }))
    expect(r.next.body).toEndWith(" 2 possible duplicates to confirm (both records are counted; not counted as open) are listed under “What needs attention”.")
    expect(READINESS_TEXT.duplicatesListed(3)).toContain("3 possible duplicates to confirm (both records are counted; not counted as open) are listed")
  })
})

describe("follow-up 3: a vehicle-group pair with the same period is told apart by fuel, then model year, before the record ID", () => {
  const a = { id: "rec-2", label: "Company vehicles", sourceId: "FLEET-1", site: "Depot", period: "Jan 1 – Dec 31, 2025" }
  test("fuel first", () => {
    expect(duplicatePairTitle({ ...a, fuel: "diesel", modelYear: 2020 }, { ...a, id: "rec-1", fuel: "gasoline", modelYear: 2018 }))
      .toBe("Company vehicles · FLEET-1 (diesel) and Company vehicles · FLEET-1 (gasoline)")
  })
  test("then the model year, when the fuel is the same", () => {
    expect(duplicatePairTitle({ ...a, fuel: "diesel", modelYear: 2020 }, { ...a, id: "rec-1", fuel: "diesel", modelYear: 2018 }))
      .toBe("Company vehicles · FLEET-1 (model year 2020) and Company vehicles · FLEET-1 (model year 2018)")
  })
  test("the record ID only when nothing else differs; a period that differs still comes first", () => {
    expect(duplicatePairTitle({ ...a, fuel: "diesel", modelYear: 2020 }, { ...a, id: "rec-1", fuel: "diesel", modelYear: 2020 }))
      .toBe("Company vehicles · FLEET-1 (Jan 1 – Dec 31, 2025, record rec-2) and Company vehicles · FLEET-1 (Jan 1 – Dec 31, 2025, record rec-1)")
    expect(duplicatePairTitle({ ...a, fuel: "diesel" }, { ...a, id: "rec-1", fuel: "gasoline", period: "Jan 1 – Jun 30, 2025" }))
      .toBe("Company vehicles · FLEET-1 (Jan 1 – Dec 31, 2025) and Company vehicles · FLEET-1 (Jan 1 – Jun 30, 2025)")
  })
  test("from saved records: the journey status carries each side's fuel and model year to the Overview's title", () => {
    const vehicle = (id: string, fuel: string, modelYear: number, saved: string) => ({ id, kind: "vehicle", currentVersion: { id: `${id}-v`, revision: 1, createdAt: saved, activity: { kind: "vehicle", sourceId: "FLEET-1", locationId: "l1", period: { start: "2025-01-01", endExclusive: "2026-01-01" }, quantity: { originalValue: "10", originalUnit: "US_gallon", normalizedValue: "10", normalizedUnit: "US_gallon" }, payload: { vehicleGroupId: "FLEET-1", fuel, vehicleType: `${fuel}_light_duty_truck`, modelYear, gallons: "10", vehicleCount: null, miles: null, fuelEconomy: null }, evidenceIds: [], quality: "actual", state: "active" } }, history: [{ createdAt: saved }] })
    const status = computeJourneyStatus({ setup: null, context: null, records: [vehicle("v-1", "gasoline", 2018, "2025-03-01T00:00:00Z"), vehicle("v-2", "diesel", 2020, "2025-03-02T00:00:00Z")] as any, evidence: [], canManage: true })
    for (const row of status.collection.records) row.state = "ready"
    expect(scope12Items(status).find(item => item.group === "duplicate")!.title).toBe("Company vehicles · FLEET-1 (diesel) and Company vehicles · FLEET-1 (gasoline)")
  })
})

describe("follow-up 4: a write's start says so at once, and a failed write ends it", () => {
  const actor = { userId: "11111111-1111-4111-8111-111111111111" }
  const original = globalThis.fetch
  afterEach(() => { globalThis.fetch = original })
  test("sharedFetch tells the listeners a write started before it is answered, and a failed write's end", async () => {
    const events: string[] = []
    const stopActivity = subscribeWriteActivity(write => events.push(`${write.phase} ${write.path}`))
    const stopDone = subscribeWrites(write => events.push(`done ${write.path}`))
    let answer: (response: Response) => void = () => {}
    globalThis.fetch = mock(() => new Promise<Response>(resolve => { answer = resolve })) as any
    try {
      const pending = sharedFetch(actor, "/workspace-api/workspace/w/collection/evidence", { method: "POST", body: "x" })
      await Promise.resolve()
      expect(events).toEqual(["started /workspace-api/workspace/w/collection/evidence"])
      answer(new Response("{}", { status: 201 }))
      await pending
      expect(events).toEqual(["started /workspace-api/workspace/w/collection/evidence", "done /workspace-api/workspace/w/collection/evidence"])
      events.length = 0
      globalThis.fetch = mock(async () => new Response("{}", { status: 500 })) as any
      await sharedFetch(actor, "/workspace-api/workspace/w/scope3/spend-imports", { method: "POST", body: "x" })
      globalThis.fetch = mock(async () => { throw new TypeError("network") }) as any
      await sharedFetch(actor, "/workspace-api/workspace/w/setup", { method: "PUT", body: "x" }).catch(() => {})
      globalThis.fetch = mock(async () => new Response("{}", { status: 200 })) as any
      await sharedFetch(actor, "/workspace-api/workspace/w/setup", { method: "GET" })
      expect(events).toEqual(["started /workspace-api/workspace/w/scope3/spend-imports", "failed /workspace-api/workspace/w/scope3/spend-imports", "started /workspace-api/workspace/w/setup", "failed /workspace-api/workspace/w/setup"])
    } finally { stopActivity(); stopDone() }
  })
})

describe("WO-05b follow-up: a “new record” draft carrying an existing record's ID or version is refused on restore", () => {
  const U = "aaaaaaaa-0000-4000-8000-000000000001", W = "c1c1c1c1-0000-4000-8000-000000000001"
  const EXISTING = "dddddddd-0000-4000-8000-000000000001", FRESH = "dddddddd-0000-4000-8000-0000000000ff", V = "eeeeeeee-0000-4000-8000-000000000001"
  const activity = { kind: "natural_gas", locationId: "", setupVersionId: "", sourceId: "GAS-1", state: "active", withdrawalReason: null, quantity: { originalValue: "12", originalUnit: "therm" }, period: { start: "2025-01-01", endExclusive: "2025-02-01" }, reference: "", notes: "", evidenceIds: [], payload: {} }
  const check = activityDraftFields(new Set(["natural_gas"]))
  const scope: DraftScope = { userId: U, companyId: W, view: "activity", item: "new" }
  /** A tab's sessionStorage, which a person (or a broken extension) can edit by hand. */
  function tab() {
    const entries = new Map<string, string>()
    const storage = { get length() { return entries.size }, key: (i: number) => [...entries.keys()][i] ?? null, getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v) }, removeItem: (k: string) => { entries.delete(k) }, clear: () => entries.clear() }
    ;(globalThis as any).sessionStorage = storage
    return storage
  }
  const tamper = (storage: ReturnType<typeof tab>, fields: Record<string, unknown>, binding: Record<string, unknown>, sent: { idempotencyKey: string | null; request: Record<string, unknown> | null } = { idempotencyKey: null, request: null }) => {
    const now = Date.now()
    storage.setItem(draftKey(scope)!, JSON.stringify({ savedAt: now, expiresAt: now + 86_400_000, fields, binding, ...sent }))
  }
  const original = globalThis.fetch
  afterEach(() => { clearAllDrafts(null); delete (globalThis as any).sessionStorage; globalThis.fetch = original })

  test("a saved version in a new-record draft (hand-edited binding) is refused and removed", () => {
    const storage = tab()
    admitDrafts(draftStorage(), { userId: U, companyId: W, role: "owner" })
    tamper(storage, { recordId: FRESH, activity, reason: "" }, { expectedRevision: 3, expectedVersionId: V })
    expect(readDraft(draftStorage(), scope, check)).toBeNull()
    expect(storage.getItem(draftKey(scope)!)).toBeNull()
  })
  test("a stored request aimed at a saved version is refused too", () => {
    const storage = tab()
    admitDrafts(draftStorage(), { userId: U, companyId: W, role: "owner" })
    tamper(storage, { recordId: FRESH, activity, reason: "" }, { expectedRevision: 0, expectedVersionId: null }, { idempotencyKey: "ffffffff-0000-4000-8000-000000000001", request: { expectedRevision: 2, expectedVersionId: V, correctionReason: null, activity } })
    expect(readDraft(draftStorage(), scope, check)).toBeNull()
  })
  test("an existing record's ID, as listed by the Activity list's own request, is refused and removed; a fresh ID is kept", async () => {
    const storage = tab()
    admitDrafts(draftStorage(), { userId: U, companyId: W, role: "owner" })
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ profile: "x", records: [{ id: EXISTING.toUpperCase() }] }), { status: 200, headers: { "content-type": "application/json" } })) as any
    await listCollectionActivities(W, { userId: U, role: "owner", accessToken: "token" } as any)
    tamper(storage, { recordId: EXISTING, activity, reason: "" }, { expectedRevision: 0, expectedVersionId: null })
    expect(readDraft(draftStorage(), scope, check)).toBeNull()
    expect(storage.getItem(draftKey(scope)!)).toBeNull()
    tamper(storage, { recordId: FRESH, activity, reason: "Typed before the session ended" }, { expectedRevision: 0, expectedVersionId: null })
    expect(readDraft(draftStorage(), scope, check)?.fields).toEqual({ recordId: FRESH, activity: activity as any, reason: "Typed before the session ended" })
  })
  test("the saved IDs are per user and company, and a correction draft of an existing record is unaffected", () => {
    const storage = tab()
    admitDrafts(draftStorage(), { userId: U, companyId: W, role: "owner" })
    noteSavedRecords({ userId: U, companyId: "c2c2c2c2-0000-4000-8000-000000000002" }, [EXISTING])
    tamper(storage, { recordId: EXISTING, activity, reason: "" }, { expectedRevision: 0, expectedVersionId: null })
    expect(readDraft(draftStorage(), scope, check)).not.toBeNull()
    noteSavedRecords({ userId: U, companyId: W }, [EXISTING])
    const correction: DraftScope = { ...scope, item: EXISTING }
    const now = Date.now()
    storage.setItem(draftKey(correction)!, JSON.stringify({ savedAt: now, expiresAt: now + 86_400_000, fields: { recordId: EXISTING, activity, reason: "Meter read again" }, binding: { expectedRevision: 1, expectedVersionId: V }, idempotencyKey: null, request: null }))
    expect(readDraft(draftStorage(), correction, check)?.binding).toEqual({ expectedRevision: 1, expectedVersionId: V })
  })
})
