// WO-14a step 1: the lineage rules of the WO-14 sign-out design (§1, §2), as the specification the wiring steps are built
// against. E (the ended-lineages list), the storage adapter's getItem/setItem/removeItem decisions for every combination,
// the lastWritten repair, the boot drop of an ended session and the boot purge of drafts against E.
// WO-14b: R1 (only the generation's own lineage is handed over), F1 (repair only over an ended lineage), F3 (a lineage is a
// UUID), F4 (E's user IDs are UUIDs), the fetch pre-check's wouldRefuseSet/wouldRefuseRemove and R3's adoptLegacy.
import { expect, test } from "bun:test"
import { addEnded, adoptLegacy, decideGet, decideRemove, decideSet, dropEndedSession, ENDED_KEY, ENDED_MAX, ENDED_TTL_MS, isEnded, LINEAGE_FIELD, newLineage, pruneEnded, purgeEndedDrafts, readEnded, readStored, stampLineage, wouldRefuseRemove, wouldRefuseSet, type GenerationState } from "./auth-lineage"
import { DRAFT_PREFIX, DRAFT_TTL_MS } from "./draft-store"

const NOW = Date.parse("2026-11-12T10:00:00Z")
const DAY = 24 * 60 * 60 * 1000
const LA = "aaaaaaaa-1111-4111-8111-000000000001", LB = "bbbbbbbb-2222-4222-8222-000000000002", LC = "cccccccc-3333-4333-8333-000000000003"
const UA = "a0a0a0a0-0000-4000-8000-00000000000a", UB = "b0b0b0b0-0000-4000-8000-00000000000b"
const LD = "dddddddd-4444-4444-8444-000000000004"
const KEY = "neuvetra:m63:ref:auth"

function memoryStorage(initial: Record<string, string> = {}) {
  const entries = new Map<string, string>(Object.entries(initial))
  return { entries, get length() { return entries.size }, key: (i: number) => [...entries.keys()][i] ?? null, getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v) }, removeItem: (k: string) => { entries.delete(k) } }
}
/** A session as auth-js stores it, optionally carrying a lineage. */
function session(lineage: string | null, user = UA, access = "access-token-value") {
  return JSON.stringify({ access_token: access, refresh_token: "refresh-token-value", expires_at: 1_900_000_000, token_type: "bearer", user: { id: user }, ...(lineage ? { [LINEAGE_FIELD]: lineage } : {}) })
}
const gen = (overrides: Partial<GenerationState> = {}): GenerationState => ({ retired: false, deliberate: false, lineage: LA, lastWritten: null, ...overrides })
const ended = (...lineages: string[]) => lineages.map((lineage, index) => ({ lineage, userId: UA, at: NOW - index }))

// ---------- E ----------

test("E: add writes only lineage, userId and at, newest first, under nv:auth-ended:v1", () => {
  const storage = memoryStorage()
  expect(ENDED_KEY).toBe("nv:auth-ended:v1")
  addEnded(storage, { lineage: LA, userId: UA }, NOW - 1000)
  const list = addEnded(storage, { lineage: LB, userId: UB }, NOW)!
  expect(list.map(entry => entry.lineage)).toEqual([LB, LA])
  const stored = JSON.parse(storage.getItem(ENDED_KEY)!)
  expect(stored).toEqual([{ lineage: LB, userId: UB, at: NOW }, { lineage: LA, userId: UA, at: NOW - 1000 }])
  expect(readEnded(storage, NOW)).toEqual(stored)
  expect(isEnded(list, LA)).toBe(true)
  expect(isEnded(list, LA.toUpperCase())).toBe(true)
  expect(isEnded(list, LC)).toBe(false)
  expect(isEnded(list, null)).toBe(false)
})

test("E never holds a token: extra fields are dropped, a lineage must be a UUID, a malformed userId is kept as null", () => {
  const storage = memoryStorage()
  const smuggled = { lineage: LA, userId: UA, access_token: "eyJhbGciOi.payload.sig", refresh_token: "r-secret" } as { lineage: string; userId: string }
  addEnded(storage, smuggled, NOW)
  expect(storage.getItem(ENDED_KEY)).not.toMatch(/eyJ|r-secret|access|refresh/)
  // A token in the lineage field is refused outright, and nothing is written.
  for (const notLineage of ["eyJhbGciOi.payload.sig", "abcdefghijkl", "", "a".repeat(36)]) expect(addEnded(storage, { lineage: notLineage, userId: UA }, NOW)).toBeNull()
  expect(JSON.parse(storage.getItem(ENDED_KEY)!)).toEqual([{ lineage: LA, userId: UA, at: NOW }])
  addEnded(storage, { lineage: LB, userId: "Bearer eyJ.x.y" }, NOW + 1)
  expect(readEnded(storage, NOW + 1)[0]).toEqual({ lineage: LB, userId: null, at: NOW + 1 })
  // F4: a user ID must be a UUID. Supabase's opaque refresh tokens (short alphanumeric strings) and any other non-UUID are
  // stored as null, so a caller passing the wrong field can't put a token in E.
  for (const notUser of ["v1a2b3c4d5e6", "u12", "refresh-token-value", `${UA}x`, ` ${UA}`]) {
    addEnded(storage, { lineage: LC, userId: notUser }, NOW + 3)
    expect(readEnded(storage, NOW + 3)[0]).toEqual({ lineage: LC, userId: null, at: NOW + 3 })
    if (!notUser.includes(UA)) expect(storage.getItem(ENDED_KEY)).not.toContain(notUser.trim())
  }
  addEnded(storage, { lineage: LC, userId: UA.toUpperCase() }, NOW + 4)
  expect(readEnded(storage, NOW + 4)[0]!.userId).toBe(UA)
  // A hand-edited E with token fields is read without them and rewritten without them.
  storage.setItem(ENDED_KEY, JSON.stringify([{ lineage: LC, userId: UA, at: NOW, access_token: "secret" }]))
  addEnded(storage, { lineage: LA, userId: UA }, NOW + 2)
  expect(storage.getItem(ENDED_KEY)).not.toContain("secret")
})

test("E is pruned at 30 days and at 50 entries, one entry per lineage", () => {
  const old = { lineage: LA, userId: UA, at: NOW - ENDED_TTL_MS - 1 }
  const edge = { lineage: LB, userId: UA, at: NOW - ENDED_TTL_MS }
  expect(ENDED_TTL_MS).toBe(30 * DAY)
  expect(pruneEnded([old, edge], NOW)).toEqual([edge])
  // A far-future timestamp (a clock set wrong) is not kept forever.
  expect(pruneEnded([{ lineage: LC, userId: UA, at: NOW + ENDED_TTL_MS + 1 }], NOW)).toEqual([])
  const many = Array.from({ length: 60 }, (_, index) => ({ lineage: `${String(index).padStart(8, "0")}-0000-4000-8000-000000000000`, userId: UA, at: NOW - index * 1000 }))
  const pruned = pruneEnded(many, NOW)
  expect(ENDED_MAX).toBe(50)
  expect(pruned).toHaveLength(50)
  expect(pruned[0]!.at).toBe(NOW)
  expect(pruned[49]!.at).toBe(NOW - 49_000)
  // Adding to a full list keeps the newest 50, the new one included.
  const storage = memoryStorage({ [ENDED_KEY]: JSON.stringify(many) })
  const list = addEnded(storage, { lineage: LA, userId: UA }, NOW + 1)!
  expect(list).toHaveLength(50)
  expect(list[0]!.lineage).toBe(LA)
  // The same lineage twice keeps the newest.
  expect(pruneEnded([{ lineage: LA, userId: UA, at: NOW - 5 }, { lineage: LA.toUpperCase(), userId: UA, at: NOW }], NOW)).toEqual([{ lineage: LA, userId: UA, at: NOW }])
})

test("E: corrupt JSON, a non-array or bad entries read as nothing, and the next add replaces them", () => {
  for (const corrupt of ["{", "null", "{}", "\"x\"", "[1, null, \"a\", {\"lineage\": 3}]", JSON.stringify([{ lineage: LA, userId: UA, at: "yesterday" }])]) {
    const storage = memoryStorage({ [ENDED_KEY]: corrupt })
    expect(readEnded(storage, NOW)).toEqual([])
    addEnded(storage, { lineage: LB, userId: UB }, NOW)
    expect(JSON.parse(storage.getItem(ENDED_KEY)!)).toEqual([{ lineage: LB, userId: UB, at: NOW }])
  }
  // Storage that throws: reads as empty, an add reports failure, nothing throws.
  const refusing = { getItem: () => { throw new Error("SecurityError") }, setItem: () => { throw new Error("QuotaExceededError") } }
  expect(readEnded(refusing, NOW)).toEqual([])
  expect(addEnded(refusing, { lineage: LA, userId: UA }, NOW)).toBeNull()
  expect(readEnded(null, NOW)).toEqual([])
})

test("a lineage is a fresh UUID; a stored session's lineage and user are read; stamping sets nv_lineage and keeps the rest", () => {
  const one = newLineage(), two = newLineage()
  expect(one).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(one).not.toBe(two)
  expect(readStored(session(LA))).toEqual({ lineage: LA, userId: UA, readable: true })
  expect(readStored(session(null))).toEqual({ lineage: null, userId: UA, readable: true })
  expect(readStored(null)).toBeNull()
  expect(readStored("{not json")).toEqual({ lineage: null, userId: null, readable: false })
  expect(readStored(JSON.stringify({ [LINEAGE_FIELD]: "not-a-uuid" }))!.lineage).toBeNull()
  const stamped = JSON.parse(stampLineage(session(null), LB)!)
  expect(stamped[LINEAGE_FIELD]).toBe(LB)
  expect(stamped.access_token).toBe("access-token-value")
  expect(JSON.parse(stampLineage(session(LA), LB)!)[LINEAGE_FIELD]).toBe(LB)
  expect(stampLineage("[1]", LA)).toBeNull()
  expect(stampLineage("nope", LA)).toBeNull()
})

// ---------- getItem ----------

test("getItem: a retired generation reads nothing, whatever is stored", () => {
  for (const stored of [null, session(LA), session(LB), session(null), session(LC)]) expect(decideGet(gen({ retired: true }), stored, ended(LC))).toEqual({ kind: "none" })
})

test("getItem (R1): a generation is handed only its own lineage's session, or nothing stored", () => {
  for (const state of [gen(), gen({ deliberate: true })]) {
    expect(decideGet(state, session(LA), ended(LC))).toEqual({ kind: "value", value: session(LA) })
    expect(decideGet(state, session(LA.toUpperCase()), ended(LC))).toEqual({ kind: "value", value: session(LA.toUpperCase()) })
    expect(decideGet(state, null, ended(LC))).toEqual({ kind: "value", value: null })
  }
})

test("getItem (R1): another live lineage, a session without a lineage or an unreadable value reads as nothing", () => {
  for (const state of [gen(), gen({ deliberate: true }), gen({ lastWritten: session(LA) })]) {
    for (const stored of [session(LB), session(LC), session(null), "{garbled", "[]", "null"]) expect(decideGet(state, stored, ended(LD))).toEqual({ kind: "none" })
  }
})

test("getItem (R1, F3): a generation without a lineage, or with one that isn't a UUID, is handed no session at all", () => {
  for (const lineage of [null, "not-a-uuid", ` ${LA}`, "", `${LA}0`]) {
    for (const stored of [session(LA), session(LB), session(null), session(` ${LA}`)]) expect(decideGet(gen({ lineage }), stored, [])).toEqual({ kind: "none" })
    expect(decideGet(gen({ lineage }), null, [])).toEqual({ kind: "value", value: null })
  }
})

test("getItem: a session of an ended lineage is dropped, for any live generation (own lineage ended, other lineage, none)", () => {
  expect(decideGet(gen(), session(LA), ended(LA))).toEqual({ kind: "drop", lineage: LA })
  expect(decideGet(gen({ lineage: LB }), session(LA), ended(LA))).toEqual({ kind: "drop", lineage: LA })
  expect(decideGet(gen({ lineage: null }), session(LA), ended(LA))).toEqual({ kind: "drop", lineage: LA })
  expect(decideGet(gen({ deliberate: true, lineage: LB }), session(LA), ended(LA))).toEqual({ kind: "drop", lineage: LA })
  // Upper-case lineage in storage is the same lineage.
  expect(decideGet(gen({ lineage: LB }), session(LA.toUpperCase()), ended(LA)).kind).toBe("drop")
})

test("lastWritten repair: B's live generation whose key an ended lineage overwrote writes its own session back", () => {
  const mine = stampLineage(session(null, UB, "b-access"), LB)!
  expect(decideGet(gen({ lineage: LB, lastWritten: mine }), session(LA), ended(LA))).toEqual({ kind: "repair", value: mine, dropped: LA })
  expect(decideGet(gen({ lineage: LB, lastWritten: mine, deliberate: true }), session(LA), ended(LA))).toEqual({ kind: "repair", value: mine, dropped: LA })
  // No repair: retired; own lineage also ended; nothing written yet; lastWritten of another lineage; overwritten by a
  // live lineage (that is an adoption, not a repair); the key simply removed.
  expect(decideGet(gen({ lineage: LB, lastWritten: mine, retired: true }), session(LA), ended(LA)).kind).toBe("none")
  expect(decideGet(gen({ lineage: LB, lastWritten: mine }), session(LA), ended(LA, LB)).kind).toBe("drop")
  expect(decideGet(gen({ lineage: LB, lastWritten: null }), session(LA), ended(LA)).kind).toBe("drop")
  expect(decideGet(gen({ lineage: LB, lastWritten: stampLineage(session(null), LC) }), session(LA), ended(LA)).kind).toBe("drop")
  expect(decideGet(gen({ lineage: LB, lastWritten: mine }), null, ended(LA))).toEqual({ kind: "value", value: null })
})

test("F1: the repair never writes back over a live other lineage or a session without a lineage", () => {
  const mine = stampLineage(session(null, UB, "b-access"), LB)!
  for (const deliberate of [false, true]) {
    for (const displacing of [session(LA), session(LC), session(null), session(LA.toUpperCase())]) {
      const decision = decideGet(gen({ lineage: LB, lastWritten: mine, deliberate }), displacing, ended(LD))
      expect(decision).toEqual({ kind: "none" })
    }
  }
  // Only an ended displacing lineage is repaired over.
  expect(decideGet(gen({ lineage: LB, lastWritten: mine }), session(LC), ended(LC)).kind).toBe("repair")
})

// ---------- setItem ----------

test("setItem: retired refuses (already retired); a generation without a lineage never stores a session", () => {
  for (const deliberate of [false, true]) {
    for (const stored of [null, session(LA), session(LB), session(null)]) {
      expect(decideSet(gen({ retired: true, deliberate }), session(null), stored, [])).toEqual({ kind: "refuse", reason: "retired", retire: false })
      expect(decideSet(gen({ lineage: null, deliberate }), session(null), stored, [])).toEqual({ kind: "refuse", reason: "no-lineage", retire: false })
    }
  }
})

test("setItem (F3): a lineage that isn't a UUID is refused, deliberate or not, whatever is stored", () => {
  for (const lineage of ["not-a-uuid", ` ${LA}`, `${LA} `, "", `${LA}0`, "eyJhbGciOi.payload.sig"]) {
    for (const deliberate of [false, true]) {
      for (const stored of [null, session(LA), session(null)]) expect(decideSet(gen({ lineage, deliberate }), session(null), stored, [])).toEqual({ kind: "refuse", reason: "no-lineage", retire: false })
    }
    expect(decideRemove(gen({ lineage }), session(LA))).toEqual({ kind: "refuse", reason: "no-lineage" })
  }
})

test("setItem: a generation whose lineage is in E refuses and retires itself, deliberate or not, whatever is stored", () => {
  for (const deliberate of [false, true]) {
    for (const stored of [null, session(LA), session(LB), session(null)]) expect(decideSet(gen({ deliberate }), session(null), stored, ended(LA))).toEqual({ kind: "refuse", reason: "ended", retire: true })
  }
})

test("setItem, non-deliberate (refresh or adoption): writes over nothing or its own lineage, refuses and retires over any other", () => {
  const written = (stored: string | null) => decideSet(gen(), session(null, UA, "new-access"), stored, ended(LC))
  for (const stored of [null, session(LA)]) {
    const decision = written(stored)
    expect(decision.kind).toBe("write")
    const value = JSON.parse((decision as { value: string }).value)
    expect(value[LINEAGE_FIELD]).toBe(LA)
    expect(value.access_token).toBe("new-access")
  }
  for (const stored of [session(LB), session(null), session(LC), "{garbled"]) expect(written(stored)).toEqual({ kind: "refuse", reason: "other-lineage", retire: true })
})

test("setItem, deliberate (a sign-in): always writes with its own lineage, over any lineage, unless it has ended", () => {
  for (const stored of [null, session(LA), session(LB), session(null), session(LC)]) {
    const decision = decideSet(gen({ deliberate: true }), session(null, UA, "signed-in"), stored, ended(LC))
    expect(decision.kind).toBe("write")
    expect(JSON.parse((decision as { value: string }).value)[LINEAGE_FIELD]).toBe(LA)
  }
  // The incoming value's own nv_lineage (if any) is replaced, never trusted.
  const decision = decideSet(gen({ deliberate: true }), session(LB), null, [])
  expect(JSON.parse((decision as { value: string }).value)[LINEAGE_FIELD]).toBe(LA)
  // A value that isn't a JSON object is not stored.
  expect(decideSet(gen({ deliberate: true }), "nope", null, [])).toEqual({ kind: "refuse", reason: "no-lineage", retire: false })
})

// ---------- removeItem ----------

test("removeItem: retired refuses; only the generation's own lineage is removed (also once ended); another lineage is refused", () => {
  for (const deliberate of [false, true]) {
    expect(decideRemove(gen({ retired: true, deliberate }), session(LA))).toEqual({ kind: "refuse", reason: "retired" })
    expect(decideRemove(gen({ retired: true, deliberate }), null)).toEqual({ kind: "refuse", reason: "retired" })
    expect(decideRemove(gen({ deliberate }), null)).toEqual({ kind: "absent" })
    expect(decideRemove(gen({ deliberate }), session(LA))).toEqual({ kind: "remove" })
    expect(decideRemove(gen({ deliberate }), session(LA.toUpperCase()))).toEqual({ kind: "remove" })
    expect(decideRemove(gen({ deliberate }), session(LB))).toEqual({ kind: "refuse", reason: "other-lineage" })
    expect(decideRemove(gen({ deliberate }), session(null))).toEqual({ kind: "refuse", reason: "other-lineage" })
    expect(decideRemove(gen({ deliberate }), "{garbled")).toEqual({ kind: "refuse", reason: "other-lineage" })
    expect(decideRemove(gen({ deliberate, lineage: null }), session(LB))).toEqual({ kind: "refuse", reason: "no-lineage" })
    expect(decideRemove(gen({ deliberate, lineage: null }), null)).toEqual({ kind: "absent" })
  }
})

// ---------- boot ----------

test("boot: a stored session of an ended lineage is removed; a live lineage, a legacy session or nothing is left alone", () => {
  const storage = memoryStorage({ [KEY]: session(LA), [`${KEY}-user`]: "{}", other: "x" })
  expect(dropEndedSession(storage, KEY, ended(LA))).toBe(true)
  expect([...storage.entries.keys()]).toEqual(["other"])
  for (const stored of [session(LB), session(null)]) {
    const kept = memoryStorage({ [KEY]: stored })
    expect(dropEndedSession(kept, KEY, ended(LA))).toBe(false)
    expect(kept.getItem(KEY)).toBe(stored)
  }
  expect(dropEndedSession(memoryStorage(), KEY, ended(LA))).toBe(false)
  expect(dropEndedSession(null, KEY, ended(LA))).toBe(false)
  expect(dropEndedSession({ getItem: () => { throw new Error("denied") }, removeItem: () => {} }, KEY, ended(LA))).toBe(false)
})

test("boot purge of drafts against E: a user's drafts older than their latest sign-out go; newer drafts and other users stay", () => {
  const draft = (savedAt: number) => JSON.stringify({ savedAt, expiresAt: savedAt + DRAFT_TTL_MS, fields: {}, binding: { expectedRevision: 0, expectedVersionId: null }, idempotencyKey: null, request: null })
  const keyOf = (user: string, view: string) => `${DRAFT_PREFIX}${user}:c1c1c1c1-0000-4000-8000-000000000001:${view}`
  const storage = memoryStorage({
    [keyOf(UA, "setup")]: draft(NOW - 10_000), // A, before A's sign-out: goes (a closed tab restored with Ctrl+Shift+T)
    [keyOf(UA, "activity:new")]: draft(NOW + 5_000), // A, after A signed in again and typed: stays
    [`${keyOf(UA, "activity")}:${LC}`]: "{corrupt", // A, unreadable: goes
    [keyOf(UB, "setup")]: draft(NOW - 10_000), // B: no E entry, stays
    "unrelated": "kept",
  })
  const list = [{ lineage: LA, userId: UA, at: NOW - 60_000 }, { lineage: LB, userId: UA, at: NOW }, { lineage: LC, userId: null, at: NOW }]
  expect(purgeEndedDrafts(storage, list).sort()).toEqual([keyOf(UA, "setup"), `${keyOf(UA, "activity")}:${LC}`].sort())
  expect([...storage.entries.keys()].sort()).toEqual([keyOf(UA, "activity:new"), keyOf(UB, "setup"), "unrelated"].sort())
  // Nothing in E, or no storage: nothing removed.
  expect(purgeEndedDrafts(storage, [])).toEqual([])
  expect(purgeEndedDrafts(null, list)).toEqual([])
})

// ---------- the fetch pre-check (A2 iv) ----------

test("wouldRefuseSet and wouldRefuseRemove answer exactly as setItem and removeItem would decide", () => {
  const states = [gen(), gen({ deliberate: true }), gen({ retired: true }), gen({ lineage: null }), gen({ lineage: "nope" }), gen({ lineage: LB }), gen({ lineage: LB, deliberate: true })]
  const storeds = [null, session(LA), session(LB), session(null), "{garbled"]
  for (const state of states) {
    for (const stored of storeds) {
      for (const list of [[], ended(LA), ended(LB)]) {
        const set = decideSet(state, session(null), stored, list)
        expect(wouldRefuseSet(state, stored, list)).toEqual(set.kind === "refuse" ? set : null)
      }
      const remove = decideRemove(state, stored)
      expect(wouldRefuseRemove(state, stored)).toEqual(remove.kind === "refuse" ? remove : null)
    }
  }
  expect(wouldRefuseSet(gen(), session(LB), [])).toEqual({ kind: "refuse", reason: "other-lineage", retire: true })
  expect(wouldRefuseSet(gen(), session(LA), ended(LA))).toEqual({ kind: "refuse", reason: "ended", retire: true })
  expect(wouldRefuseSet(gen(), session(LA), [])).toBeNull()
  expect(wouldRefuseRemove(gen(), session(LB))).toEqual({ kind: "refuse", reason: "other-lineage" })
  expect(wouldRefuseRemove(gen(), session(LA))).toBeNull()
})

// ---------- R3: adopting a session without a lineage ----------

test("adoptLegacy stamps a valid session without a lineage with a fresh lineage, keeping every other field", () => {
  const storage = memoryStorage({ [KEY]: session(null) })
  const result = adoptLegacy(storage, KEY, [], { lineage: () => LC })
  expect(result).toEqual({ kind: "stamped", lineage: LC })
  const stored = JSON.parse(storage.getItem(KEY)!)
  expect(stored[LINEAGE_FIELD]).toBe(LC)
  expect(stored.refresh_token).toBe("refresh-token-value")
  expect(stored.access_token).toBe("access-token-value")
  // With the default, the lineage is a fresh UUID.
  const other = memoryStorage({ [KEY]: session(null) })
  const fresh = adoptLegacy(other, KEY, [])
  expect(fresh.kind).toBe("stamped")
  expect(readStored(other.getItem(KEY))!.lineage).toBe((fresh as { lineage: string }).lineage)
})

test("adoptLegacy adopts an existing live lineage as it is, refuses an ended one, and writes nothing in either case", () => {
  for (const [stored, list, expected] of [[session(LA), [], { kind: "existing", lineage: LA }], [session(LA), ended(LA), { kind: "ended", lineage: LA }], [session(LA.toUpperCase()), [], { kind: "existing", lineage: LA }]] as const) {
    const storage = memoryStorage({ [KEY]: stored })
    let writes = 0
    const counting = { getItem: storage.getItem, setItem: (k: string, v: string) => { writes++; storage.setItem(k, v) } }
    expect(adoptLegacy(counting, KEY, list, { lineage: () => LC })).toEqual(expected)
    expect(writes).toBe(0)
    expect(storage.getItem(KEY)).toBe(stored)
  }
})

test("adoptLegacy is a compare-and-set: nothing stored, not a session, another refresh token, a bad lineage or refused storage write nothing", () => {
  const notSessions = [null, "{garbled", "[]", "null", JSON.stringify({ access_token: "a", user: {} }), JSON.stringify({ access_token: "a", refresh_token: "r" })]
  for (const stored of notSessions) {
    const storage = memoryStorage(stored === null ? {} : { [KEY]: stored })
    expect(adoptLegacy(storage, KEY, [], { lineage: () => LC })).toEqual({ kind: "none" })
    expect(storage.getItem(KEY)).toBe(stored)
  }
  // The caller saw refresh token X earlier; another tab's refresh has since replaced it: no stamp on the value it didn't see.
  const moved = memoryStorage({ [KEY]: session(null) })
  expect(adoptLegacy(moved, KEY, [], { expectedRefreshToken: "an-older-refresh-token", lineage: () => LC })).toEqual({ kind: "none" })
  expect(readStored(moved.getItem(KEY))!.lineage).toBeNull()
  expect(adoptLegacy(moved, KEY, [], { expectedRefreshToken: "refresh-token-value", lineage: () => LC })).toEqual({ kind: "stamped", lineage: LC })
  // A lineage source that doesn't give a UUID stamps nothing.
  const bad = memoryStorage({ [KEY]: session(null) })
  expect(adoptLegacy(bad, KEY, [], { lineage: () => "not-a-uuid" })).toEqual({ kind: "none" })
  expect(bad.getItem(KEY)).toBe(session(null))
  expect(adoptLegacy({ getItem: () => session(null), setItem: () => { throw new Error("QuotaExceededError") } }, KEY, [], { lineage: () => LC })).toEqual({ kind: "none" })
  expect(adoptLegacy(null, KEY, [])).toEqual({ kind: "none" })
})

test("adoptLegacy: two tabs adopting at once converge on the stamp written last", () => {
  // One shared localStorage, seen by each tab through its own (possibly lagging) copy, as Chrome's renderers do.
  const shared = memoryStorage({ [KEY]: session(null) })
  const tab = () => {
    let copy = new Map(shared.entries)
    return {
      sync() { copy = new Map(shared.entries) },
      storage: { getItem: (k: string) => copy.get(k) ?? null, setItem: (k: string, v: string) => { copy.set(k, v); shared.setItem(k, v) } },
    }
  }
  const one = tab(), two = tab()
  // Both read the legacy session before either write reached the other.
  const first = adoptLegacy(one.storage, KEY, [], { lineage: () => LA })
  const second = adoptLegacy(two.storage, KEY, [], { lineage: () => LB })
  expect(first).toEqual({ kind: "stamped", lineage: LA })
  expect(second).toEqual({ kind: "stamped", lineage: LB })
  // The last write wins in the shared store; when each tab next reads it (syncFromStorage), it adopts that lineage.
  one.sync(); two.sync()
  const again = [adoptLegacy(one.storage, KEY, [], { lineage: () => LC }), adoptLegacy(two.storage, KEY, [], { lineage: () => LC })]
  expect(again).toEqual([{ kind: "existing", lineage: LB }, { kind: "existing", lineage: LB }])
  expect(readStored(shared.getItem(KEY))!.lineage).toBe(LB)
  // Once stamped, a later adopter never stamps again.
  const late = memoryStorage({ [KEY]: shared.getItem(KEY)! })
  expect(adoptLegacy(late, KEY, [], { lineage: () => LC })).toEqual({ kind: "existing", lineage: LB })
})

test("F-D: adoptLegacy refuses a session without a lineage whose user signed out here after it was issued", () => {
  const issued = (at: number, life = 3600) => JSON.stringify({ access_token: "a", refresh_token: "r", token_type: "bearer", expires_in: life, expires_at: Math.floor(at / 1000) + life, user: { id: UA } })
  const signedOut = (at: number, userId: string | null = UA) => [{ lineage: LD, userId, at }]
  // Issued before the sign-out (an old-code tab's late refresh of the ended session): refused, nothing written.
  const late = memoryStorage({ [KEY]: issued(NOW - 60_000) })
  expect(adoptLegacy(late, KEY, signedOut(NOW), { lineage: () => LC })).toEqual({ kind: "ended-user", userId: UA })
  expect(late.getItem(KEY)).toBe(issued(NOW - 60_000))
  // Issued after the sign-out (the same user signed in again in an old-code tab): adopted.
  const again = memoryStorage({ [KEY]: issued(NOW + 60_000) })
  expect(adoptLegacy(again, KEY, signedOut(NOW), { lineage: () => LC })).toEqual({ kind: "stamped", lineage: LC })
  // Another user's sign-out, or an E entry without a user, doesn't touch this user.
  for (const list of [signedOut(NOW, UB), signedOut(NOW, null), []]) expect(adoptLegacy(memoryStorage({ [KEY]: issued(NOW - 60_000) }), KEY, list, { lineage: () => LC }).kind).toBe("stamped")
  // The issue time can't be read and the user is in E: refused; not in E: adopted.
  const unknown = JSON.stringify({ access_token: "a", refresh_token: "r", expires_at: Math.floor(NOW / 1000) + 3600, user: { id: UA } })
  expect(adoptLegacy(memoryStorage({ [KEY]: unknown }), KEY, signedOut(NOW), { lineage: () => LC })).toEqual({ kind: "ended-user", userId: UA })
  expect(adoptLegacy(memoryStorage({ [KEY]: unknown }), KEY, [], { lineage: () => LC }).kind).toBe("stamped")
  // User IDs compare in lower case (E stores them so): an upper-case user ID in the session is the same user.
  const upper = JSON.stringify({ ...JSON.parse(issued(NOW - 60_000)), user: { id: UA.toUpperCase() } })
  expect(adoptLegacy(memoryStorage({ [KEY]: upper }), KEY, signedOut(NOW), { lineage: () => LC })).toEqual({ kind: "ended-user", userId: UA })
  // A session that already has a live lineage is unaffected by F-D (it is adopted as it is).
  expect(adoptLegacy(memoryStorage({ [KEY]: stampLineage(issued(NOW - 60_000), LA)! }), KEY, signedOut(NOW), { lineage: () => LC })).toEqual({ kind: "existing", lineage: LA })
})
