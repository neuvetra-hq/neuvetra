// WO-05b: the draft store (sessionStorage) for unsaved Activity and setup input. Key shape, value fields, who may hold a
// draft (admitted per user, company and role before the workspace renders), expiry, corrupt values and deliberate sign-out.
import { afterEach, expect, test } from "bun:test"
import { activityDraftFields, admitDrafts, clearAllDrafts, DRAFT_CLEAR_MESSAGE, DRAFT_CHANNEL, DRAFT_DEBOUNCE_MS, DRAFT_PREFIX, DRAFT_TEXT, DRAFT_TTL_MS, draftKey, draftTime, hasDraftsFor, keepDraft, readDraft, removeDraft, removeDraftSoon, setupDraftFields, writeDraft, type DraftScope } from "./draft-store"

const A = "aaaaaaaa-0000-4000-8000-000000000001", B = "bbbbbbbb-0000-4000-8000-000000000002"
const C1 = "c1c1c1c1-0000-4000-8000-000000000001", C2 = "c2c2c2c2-0000-4000-8000-000000000002"
const R = "dddddddd-0000-4000-8000-000000000001", V = "eeeeeeee-0000-4000-8000-000000000001", KEY = "ffffffff-0000-4000-8000-000000000001"
const NOW = Date.parse("2026-11-12T10:00:00Z")

function memoryStorage() {
  const entries = new Map<string, string>()
  return { entries, get length() { return entries.size }, key: (i: number) => [...entries.keys()][i] ?? null, getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v) }, removeItem: (k: string) => { entries.delete(k) } }
}
const activity = { kind: "natural_gas", locationId: "", setupVersionId: "", sourceId: "GAS-1", state: "active", withdrawalReason: null, quantity: { originalValue: "12", originalUnit: "therm" }, period: { start: "2025-01-01", endExclusive: "2025-02-01" }, reference: "", notes: "<img src=x onerror=alert(1)>", evidenceIds: [], payload: { heatContent: null } }
const checkActivity = activityDraftFields(new Set(["natural_gas", "electricity"]))
const scope = (userId = A, companyId = C1, item: string | null = R): DraftScope => ({ userId, companyId, view: "activity", item })
const value = (overrides: Record<string, unknown> = {}) => ({ fields: { recordId: R, activity, reason: "Meter read again" }, binding: { expectedRevision: 2, expectedVersionId: V }, idempotencyKey: null, request: null, ...overrides })

afterEach(() => clearAllDrafts(null))

test("the key is nv:draft:v1:<userId>:<companyId>:<view>[:<recordId|new>], and nothing else makes a key", () => {
  expect(draftKey(scope())).toBe(`nv:draft:v1:${A}:${C1}:activity:${R}`)
  expect(draftKey(scope(A, C1, "new"))).toBe(`nv:draft:v1:${A}:${C1}:activity:new`)
  expect(draftKey({ userId: A, companyId: C1, view: "setup" })).toBe(`nv:draft:v1:${A}:${C1}:setup`)
  for (const bad of [scope("a:b"), scope(A, ""), scope(A, C1, null), scope(A, C1, "../x"), scope(A, C1, "not-a-uuid"), { userId: A, companyId: C1, view: "setup" as const, item: R }, { userId: A, companyId: C1, view: "other" as never }]) expect(draftKey(bad)).toBeNull()
  expect(DRAFT_PREFIX).toBe("nv:draft:v1:")
  expect(DRAFT_DEBOUNCE_MS).toBe(1000)
  expect(DRAFT_TTL_MS).toBe(24 * 60 * 60 * 1000)
  expect([DRAFT_CHANNEL, DRAFT_CLEAR_MESSAGE]).toEqual(["nv-drafts", "nv:draft-clear"])
})

test("the value holds savedAt, expiresAt (24 h), fields, binding and the idempotency key, and reads back as written", () => {
  const storage = memoryStorage()
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW)
  expect(writeDraft(storage, scope(), value({ idempotencyKey: KEY, request: { expectedRevision: 2, expectedVersionId: V, correctionReason: "x", activity } }), NOW)).toBe(true)
  const stored = JSON.parse(storage.getItem(draftKey(scope())!)!)
  expect(Object.keys(stored).sort()).toEqual(["binding", "expiresAt", "fields", "idempotencyKey", "request", "savedAt"])
  expect(stored.expiresAt - stored.savedAt).toBe(DRAFT_TTL_MS)
  expect(stored.binding).toEqual({ expectedRevision: 2, expectedVersionId: V })
  expect(stored.idempotencyKey).toBe(KEY)
  // Nothing but what the person typed and the request it would send: no token, no file, no server response.
  expect(JSON.stringify(stored)).not.toMatch(/access_token|accessToken|Bearer|refresh/)
  const read = readDraft(storage, scope(), checkActivity, NOW + 1000)!
  expect(read.fields.activity.notes).toBe("<img src=x onerror=alert(1)>")
  expect(read.fields.reason).toBe("Meter read again")
  expect(read.idempotencyKey).toBe(KEY)
  expect(hasDraftsFor(storage, A, NOW)).toBe(true)
  expect(hasDraftsFor(storage, B, NOW)).toBe(false)
  // A key without its request (or a request without its key) is never kept.
  writeDraft(storage, scope(), value({ idempotencyKey: KEY, request: null }), NOW)
  expect(JSON.parse(storage.getItem(draftKey(scope())!)!).idempotencyKey).toBeNull()
})

test("only an admitted owner or admin writes, and only for the user and company admitted", () => {
  const storage = memoryStorage()
  expect(writeDraft(storage, scope(), value(), NOW)).toBe(false)
  admitDrafts(storage, { userId: A, companyId: C1, role: "member" }, NOW)
  expect(writeDraft(storage, scope(), value(), NOW)).toBe(false)
  admitDrafts(storage, { userId: A, companyId: C1, role: "admin" }, NOW)
  expect(writeDraft(storage, scope(B), value(), NOW)).toBe(false)
  expect(writeDraft(storage, scope(A, C2), value(), NOW)).toBe(false)
  expect(writeDraft(storage, scope(), value(), NOW)).toBe(true)
  expect(storage.entries.size).toBe(1)
})

test("admitting a user removes every other user's and company's draft, and expired or corrupt ones, before anything renders", () => {
  const storage = memoryStorage()
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW)
  writeDraft(storage, scope(), value(), NOW)
  writeDraft(storage, scope(A, C1, "new"), value(), NOW)
  storage.setItem(`${DRAFT_PREFIX}${A}:${C1}:setup`, "{not json")
  storage.setItem(`${DRAFT_PREFIX}${A}:${C2}:setup`, storage.getItem(draftKey(scope())!)!)
  storage.setItem("unrelated", "kept")
  // User B of the same company signs in on the same tab: A's drafts go, all of them.
  admitDrafts(storage, { userId: B, companyId: C1, role: "admin" }, NOW)
  expect([...storage.entries.keys()]).toEqual(["unrelated"])
  expect(readDraft(storage, scope(), checkActivity, NOW)).toBeNull()

  // A again, at another company: drafts for C1 go.
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW)
  writeDraft(storage, scope(), value(), NOW)
  admitDrafts(storage, { userId: A, companyId: C2, role: "owner" }, NOW)
  expect(storage.entries.has(draftKey(scope())!)).toBe(false)

  // A's own draft survives A's return, but not past 24 hours.
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW)
  writeDraft(storage, scope(), value(), NOW)
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW + DRAFT_TTL_MS - 1)
  expect(storage.entries.has(draftKey(scope())!)).toBe(true)
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW + DRAFT_TTL_MS + 1)
  expect(storage.entries.has(draftKey(scope())!)).toBe(false)

  // The role changing to member removes every draft.
  writeDraft(storage, scope(), value(), NOW + DRAFT_TTL_MS + 2)
  admitDrafts(storage, { userId: A, companyId: C1, role: "member" }, NOW + DRAFT_TTL_MS + 3)
  expect([...storage.entries.keys()]).toEqual(["unrelated"])
})

test("a draft that can't be read, has expired, or fails its field check is removed when read", () => {
  const storage = memoryStorage()
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW)
  const key = draftKey(scope())!
  const good = () => { writeDraft(storage, scope(), value(), NOW); return JSON.parse(storage.getItem(key)!) }
  const corrupt: unknown[] = [
    "{", "null", "[]", { ...good(), expiresAt: good().savedAt + 1 }, { ...good(), binding: { expectedRevision: 1, expectedVersionId: null } },
    { ...good(), binding: { expectedRevision: -1, expectedVersionId: V } }, { ...good(), idempotencyKey: "x", request: {} }, { ...good(), fields: { ...good().fields, recordId: "r" } },
    { ...good(), fields: { ...good().fields, activity: { ...activity, kind: "transport_unknown" } } }, { ...good(), fields: { ...good().fields, activity: { ...activity, payload: null } } },
    { ...good(), fields: { ...good().fields, activity: { ...activity, quantity: "12" } } }, { ...good(), fields: { ...good().fields, reason: 3 } },
  ]
  for (const item of corrupt) {
    storage.setItem(key, typeof item === "string" ? item : JSON.stringify(item))
    expect(readDraft(storage, scope(), checkActivity, NOW)).toBeNull()
    expect(storage.entries.has(key)).toBe(false)
  }
  good()
  expect(readDraft(storage, scope(), checkActivity, NOW + DRAFT_TTL_MS + 1)).toBeNull()
  expect(storage.entries.has(key)).toBe(false)
})

test("a deliberate sign-out removes every draft and stops writes until the next workspace opens", () => {
  const storage = memoryStorage()
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW)
  writeDraft(storage, scope(), value(), NOW)
  writeDraft(storage, { userId: A, companyId: C1, view: "setup" }, { ...value(), fields: { setup: {}, reason: "", step: 0 } }, NOW)
  clearAllDrafts(storage)
  expect(storage.entries.size).toBe(0)
  // A late write (a debounce, a form closing as the workspace closes) is refused.
  expect(writeDraft(storage, scope(), value(), NOW)).toBe(false)
  expect(readDraft(storage, scope(), checkActivity, NOW)).toBeNull()
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW)
  expect(writeDraft(storage, scope(), value(), NOW)).toBe(true)
})

test("leaving a form removes its draft at the end of the task, unless the same form mounts again at once", async () => {
  const storage = memoryStorage()
  admitDrafts(storage, { userId: A, companyId: C1, role: "owner" }, NOW)
  writeDraft(storage, scope(), value(), NOW)
  removeDraftSoon(storage, scope()); keepDraft(scope())
  await new Promise(resolve => setTimeout(resolve, 5))
  expect(storage.entries.size).toBe(1)
  removeDraftSoon(storage, scope())
  await new Promise(resolve => setTimeout(resolve, 5))
  expect(storage.entries.size).toBe(0)
  writeDraft(storage, scope(), value(), NOW)
  removeDraft(storage, scope())
  expect(storage.entries.size).toBe(0)
})

test("setup drafts check their shape; the texts are the order's", () => {
  const check = setupDraftFields(7)
  const setup = { company: { legalName: "Bayline" }, reportingPeriod: {}, boundary: {}, entities: [], relationships: [], locations: [], screening: [], changes: [], changeNotes: "", review: { acknowledged: false, notes: "" } }
  expect(check({ setup, reason: "", step: 6 })).toEqual({ setup, reason: "", step: 6 })
  for (const bad of [{ setup, reason: "", step: 7 }, { setup, reason: 1, step: 0 }, { setup: { ...setup, locations: {} }, reason: "", step: 0 }, { setup: { ...setup, company: null }, reason: "", step: 0 }]) expect(check(bad)).toBeNull()
  expect(DRAFT_TEXT.offer(draftTime(NOW))).toBe("Restore unsaved changes from 2026-11-12 10:00 UTC?")
  expect(DRAFT_TEXT.sessionEnded).toBe("Unsaved changes are kept on this browser tab until you sign out.")
  expect(DRAFT_TEXT.sharedComputer).toBe("Sign out when you finish — it clears this browser’s session and any unsaved changes kept in this tab.")
})

test("Landing's \"Shared computer?\" line and nothing renders draft content as HTML", async () => {
  const landing = await Bun.file(new URL("../components/Landing.tsx", import.meta.url)).text()
  expect(landing).toContain(DRAFT_TEXT.sharedComputer)
  for (const file of ["../components/CollectionWorkspace.tsx", "../components/CompanySetup.tsx", "../components/PrivateStaging.tsx", "./draft-store.ts"]) {
    expect(await Bun.file(new URL(file, import.meta.url)).text()).not.toContain("dangerouslySetInnerHTML")
  }
})
