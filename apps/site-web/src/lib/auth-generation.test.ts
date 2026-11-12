// WO-14a step 2: generations against the REAL installed auth-js (2.105.1, through supabase-js 2.105.1), with injected
// fetch, storage and lock (processLock stands in for navigatorLock). Each case of design §5 has a control run without
// retire() (or with the allowed lineage), so a test can't pass because nothing happened at all. These pin the library's
// behaviour too: an auth-js upgrade that changes it fails here.
//
// auth-js only opens its BroadcastChannel in a browser (`window` and `document` defined), so this file installs a minimal
// window, document and a recording BroadcastChannel for its own tests and restores the globals afterwards.
// bun test fails a test on any unhandled rejection, so every case here also shows that it leaves none (the one auth-js
// makes on a refused refresh write is taken and asserted by `refreshOutcome`).
import { afterAll, beforeAll, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"
import { processLock } from "@supabase/supabase-js"
import { addEnded, LINEAGE_FIELD, stampLineage } from "./auth-lineage"
import { createGeneration, RetiredGeneration, type Generation, type LockFunction } from "./auth-generation"

const URL_BASE = "https://abcdefghijklmnopqrst.supabase.co"
const LA = "aaaaaaaa-1111-4111-8111-000000000001", LB = "bbbbbbbb-2222-4222-8222-000000000002"
const UA = "a0a0a0a0-0000-4000-8000-00000000000a", UB = "b0b0b0b0-0000-4000-8000-00000000000b"
const lock = processLock as LockFunction

// ---------- environment ----------

const posted: Array<{ channel: string; event: string }> = []
class RecordingChannel {
  constructor(readonly name: string) {}
  postMessage(data: { event: string }) { posted.push({ channel: this.name, event: data.event }) }
  addEventListener() {}
  removeEventListener() {}
  close() {}
}
const saved: Record<string, unknown> = {}
let warn: typeof console.warn, error: typeof console.error
beforeAll(() => {
  for (const name of ["window", "document", "BroadcastChannel"]) saved[name] = (globalThis as Record<string, unknown>)[name]
  Object.assign(globalThis, {
    window: { location: { href: "https://app.example.test/" }, addEventListener() {}, removeEventListener() {} },
    document: { visibilityState: "visible" },
    BroadcastChannel: RecordingChannel,
  })
  // auth-js logs every failed fetch, refresh error and "multiple clients" warning; the tests assert on behaviour instead.
  warn = console.warn; error = console.error
  console.warn = () => {}; console.error = () => {}
})
/** Refresh retry loops a test left running (auth-js retries for up to 30 s); afterAll ends them before restoring the console. */
const retryLoops: Promise<unknown>[] = []
afterAll(async () => {
  // auth-js stops retrying once Date.now() says 30 s have passed since the first attempt: move the clock on until they end.
  const realNow = Date.now
  Date.now = () => realNow() + 60_000
  try { await Promise.all(retryLoops) } finally { Date.now = realNow }
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete (globalThis as Record<string, unknown>)[name]
    else (globalThis as Record<string, unknown>)[name] = value
  }
  console.warn = warn; console.error = error
})

// ---------- fakes ----------

let keyCounter = 0
/** A fresh storage key per test: processLock is per name and process-wide, as navigatorLock is per name and browser-wide. */
const freshKey = () => `neuvetra:m63:test${++keyCounter}:auth`

function recordingStorage() {
  const entries = new Map<string, string>()
  const ops: Array<{ op: "set" | "remove"; key: string; value?: string }> = []
  return {
    entries, ops,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { ops.push({ op: "set", key, value }); entries.set(key, value) },
    removeItem: (key: string) => { ops.push({ op: "remove", key }); entries.delete(key) },
  }
}

function sessionBody(user: string, access: string, lifeSeconds = 3600) {
  return { access_token: access, refresh_token: `refresh-${access}`, token_type: "bearer", expires_in: lifeSeconds, expires_at: Math.floor(Date.now() / 1000) + lifeSeconds,
    user: { id: user, aud: "authenticated", role: "authenticated", email: `${user.slice(0, 4)}@example.test`, app_metadata: {}, user_metadata: {}, created_at: "2025-01-01T00:00:00Z" } }
}
/** A stored session of `lineage` that expires within auth-js's 90 s margin, so the client refreshes it at once. */
function expiringSession(user: string, lineage: string) {
  return stampLineage(JSON.stringify(sessionBody(user, `${user.slice(0, 4)}-old`, 10)), lineage)!
}

type Answer = { status: number; body: unknown } | "network-error"
/**
 * Supabase Auth at the network level. Refresh requests are held until `answerRefresh`; with `honourAbort`, an aborted
 * request rejects with an AbortError as a browser's fetch does, otherwise the answer arrives anyway (it was already read).
 */
function authServer(options: { honourAbort?: boolean; refresh?: "hold" | "fail" } = {}) {
  const calls: Array<{ grant: string | null; at: number }> = []
  const held: Array<(answer: Answer) => void> = []
  const respond = (answer: Answer) => answer === "network-error" ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } }))
  const fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input))
    const grant = url.searchParams.get("grant_type")
    calls.push({ grant, at: Date.now() })
    if (grant === "password") {
      const { email } = JSON.parse(String(init?.body ?? "{}")) as { email: string }
      return respond({ status: 200, body: sessionBody(email.startsWith("b0b0") ? UB : UA, `signed-in-${calls.length}`) })
    }
    if (grant === "refresh_token") {
      if (options.refresh === "fail") return respond("network-error")
      return new Promise<Response>((resolve, reject) => {
        held.push(answer => { respond(answer).then(resolve, reject) })
        if (options.honourAbort) init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")))
      })
    }
    return respond({ status: 404, body: {} })
  }
  return {
    fetch, calls,
    refreshCalls: () => calls.filter(call => call.grant === "refresh_token").length,
    async waitForRefresh(count = 1) { await until(() => held.length >= count) },
    answerRefresh(answer: Answer) { const next = held.shift(); if (!next) throw new Error("no refresh held"); next(answer) },
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function until(check: () => boolean, timeout = 2000) {
  const started = Date.now()
  while (!check()) { if (Date.now() - started > timeout) throw new Error("timed out waiting"); await sleep(2) }
}

function generation(storage: ReturnType<typeof recordingStorage>, server: ReturnType<typeof authServer>, key: string, lineage: string | null, deliberate = false) {
  const made = createGeneration({ url: URL_BASE, anonKey: "sb_publishable_test", storageKey: key, lineage, deliberate, storage, fetch: server.fetch, lock })
  // Subscribed on the client itself, not through the generation (which hides events after retire): what auth-js emits.
  const events: string[] = []
  made.client.auth.onAuthStateChange(event => { events.push(event) })
  return { made, events }
}
/**
 * auth-js keeps the refresh in flight as a private `refreshingDeferred`; when `_saveSession` throws a non-auth error it
 * rejects that deferred, which nothing else awaits. Taking it here both pins that behaviour and keeps the rejection from
 * failing the test run as unhandled.
 */
function refreshOutcome(made: Generation): Promise<unknown> {
  const deferred = (made.client.auth as unknown as { refreshingDeferred: { promise: PromiseLike<unknown> } | null }).refreshingDeferred
  if (!deferred) throw new Error("no refresh in flight")
  return Promise.resolve(deferred.promise).then(value => ({ resolved: value }), (error: unknown) => ({ rejected: error }))
}
const eventsOn = (key: string) => posted.filter(post => post.channel === key).map(post => post.event)
const sessionOps = (storage: ReturnType<typeof recordingStorage>, key: string, since = 0) => storage.ops.slice(since).filter(op => op.key === key)

// ---------- the library this was checked against ----------

test("the installed supabase-js and the auth-js it loads are 2.105.1 (the version design §0 was checked against)", () => {
  const supabaseJs = path.dirname(Bun.resolveSync("@supabase/supabase-js/package.json", import.meta.dir))
  const authJs = path.dirname(Bun.resolveSync("@supabase/auth-js/package.json", supabaseJs))
  for (const dir of [supabaseJs, authJs]) expect(JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version).toBe("2.105.1")
})

// ---------- a held refresh answered after retire() ----------

test("control: a held refresh answered 200 writes the new session with the lineage, emits and broadcasts TOKEN_REFRESHED", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const { events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  server.answerRefresh({ status: 200, body: sessionBody(UA, "a-new") })
  await until(() => events.includes("TOKEN_REFRESHED"))
  const stored = JSON.parse(storage.entries.get(key)!)
  expect(stored.access_token).toBe("a-new")
  expect(stored[LINEAGE_FIELD]).toBe(LA)
  expect(eventsOn(key)).toContain("TOKEN_REFRESHED")
})

test("a held refresh answered 200 after retire() writes nothing and broadcasts nothing", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const before = expiringSession(UA, LA)
  storage.entries.set(key, before)
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const opsBefore = storage.ops.length
  const outcome = refreshOutcome(made)
  made.retire()
  // The answer was already read: it reaches auth-js's _saveSession after the retire.
  server.answerRefresh({ status: 200, body: sessionBody(UA, "a-late") })
  // auth-js rejects its refresh deferred with the storage's error (in a browser: an unhandled rejection).
  expect(await outcome).toEqual({ rejected: expect.any(RetiredGeneration) })
  await sleep(100)
  expect(storage.ops.slice(opsBefore)).toEqual([])
  expect(storage.entries.get(key)).toBe(before)
  expect(events).not.toContain("TOKEN_REFRESHED")
  expect(eventsOn(key)).toEqual([])
  expect(server.refreshCalls()).toBe(1)
})

test("control: a held refresh answered 400 removes the session and emits and broadcasts SIGNED_OUT", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const { events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  server.answerRefresh({ status: 400, body: { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" } })
  await until(() => events.includes("SIGNED_OUT"))
  expect(storage.entries.has(key)).toBe(false)
  expect(eventsOn(key)).toContain("SIGNED_OUT")
})

test("a held refresh answered 400 after retire() removes nothing and emits no SIGNED_OUT", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const before = expiringSession(UA, LA)
  storage.entries.set(key, before)
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const opsBefore = storage.ops.length
  made.retire()
  server.answerRefresh({ status: 400, body: { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" } })
  await sleep(100)
  expect(storage.ops.slice(opsBefore)).toEqual([])
  expect(storage.entries.get(key)).toBe(before)
  expect(events).not.toContain("SIGNED_OUT")
  expect(eventsOn(key)).toEqual([])
})

// ---------- retire during the retry loop ----------

test("control: a refresh that fails at the network is retried at the network (200, 400 ms backoff)", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer({ refresh: "fail" })
  storage.entries.set(key, expiringSession(UA, LA))
  const { made } = generation(storage, server, key, LA)
  await until(() => server.refreshCalls() >= 1)
  retryLoops.push(refreshOutcome(made))
  await until(() => server.refreshCalls() >= 3, 3000)
  made.retire()
})

test("retire() during the retry loop: the in-flight request is aborted and zero further requests reach the network", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer({ honourAbort: true })
  const before = expiringSession(UA, LA)
  storage.entries.set(key, before)
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  expect(server.refreshCalls()).toBe(1)
  const outcome = refreshOutcome(made)
  retryLoops.push(outcome)
  made.retire()
  // auth-js turns the AbortError into a retryable error and retries after 200, 400 and 800 ms: none reaches the network.
  await sleep(1700)
  expect(server.refreshCalls()).toBe(1)
  expect(server.calls).toHaveLength(1)
  expect(storage.entries.get(key)).toBe(before)
  expect(events).not.toContain("SIGNED_OUT")
  expect(events).not.toContain("TOKEN_REFRESHED")
}, 5000)

test("a retired generation's fetch rejects with an AbortError without calling the network", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const { made } = generation(storage, server, key, null)
  await sleep(20)
  made.retire()
  const callsBefore = server.calls.length
  const { error } = await made.client.auth.signInWithPassword({ email: `${UA}@example.test`, password: "x" })
  expect(error?.name).toBe("AuthRetryableFetchError")
  expect(server.calls.length).toBe(callsBefore)
  expect(storage.entries.has(key)).toBe(false)
})

// ---------- the lock ----------

test("control: while a refresh is held, the client's lock stays held and another client can't take it", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const { made } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  await expect(lock(`lock:${key}`, 100, async () => "acquired")).rejects.toMatchObject({ isAcquireTimeout: true })
  made.retire()
})

test("retire() releases the lock within 10 ms, though the held refresh hasn't answered", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const { made } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const waiting = lock(`lock:${key}`, 5000, async () => Date.now())
  await sleep(50)
  const retiredAt = Date.now()
  made.retire()
  const acquiredAt = await waiting
  expect(acquiredAt - retiredAt).toBeLessThanOrEqual(10)
})

test("a retired generation doesn't queue behind another lock holder: its work runs without the lock and reads no session", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, stampLineage(JSON.stringify(sessionBody(UA, "a-live")), LA)!)
  const { made } = generation(storage, server, key, LA)
  expect((await made.client.auth.getSession()).data.session?.access_token).toBe("a-live")
  made.retire()
  const blocker = lock(`lock:${key}`, 5000, () => sleep(1000))
  await sleep(5)
  const started = Date.now()
  const { data } = await made.client.auth.getSession()
  expect(data.session).toBeNull()
  expect(Date.now() - started).toBeLessThan(10)
  expect(storage.entries.has(key)).toBe(true)
  await blocker
})

test("design §0: signInWithPassword takes no lock, so a held refresh holding the lock doesn't delay it", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const holder = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const signer = generation(storage, server, key, LB, true)
  const started = Date.now()
  const { error } = await signer.made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })
  expect(error).toBeNull()
  expect(Date.now() - started).toBeLessThan(100)
  expect(JSON.parse(storage.entries.get(key)!)[LINEAGE_FIELD]).toBe(LB)
  // Let the signer's own initialize (queued behind the held lock) finish before the next test.
  holder.made.retire()
  await signer.made.client.auth.initialize()
})

// ---------- deliberate and non-deliberate writes across lineages ----------

test("a deliberate generation (a sign-in) overwrites another lineage's stored session and stamps its own lineage", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, stampLineage(JSON.stringify(sessionBody(UA, "a-live")), LA)!)
  const { made, events } = generation(storage, server, key, LB, true)
  const { error } = await made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })
  expect(error).toBeNull()
  const stored = JSON.parse(storage.entries.get(key)!)
  expect(stored.user.id).toBe(UB)
  expect(stored[LINEAGE_FIELD]).toBe(LB)
  expect(made.lastWritten).toBe(storage.entries.get(key)!)
  await until(() => events.includes("SIGNED_IN"))
  expect(eventsOn(key)).toContain("SIGNED_IN")
})

test("a non-deliberate generation can't overwrite another lineage's session: A's late refresh leaves B's sign-in, and A retires", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const a = generation(storage, server, key, LA)
  await server.waitForRefresh()
  // B signs in (another tab, or this tab's new generation) while A's refresh is held; A is not retired.
  const b = generation(storage, server, key, LB, true)
  expect((await b.made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })).error).toBeNull()
  const bSession = storage.entries.get(key)!
  const outcome = refreshOutcome(a.made)
  server.answerRefresh({ status: 200, body: sessionBody(UA, "a-late") })
  expect(await outcome).toEqual({ rejected: expect.objectContaining({ name: "RetiredGeneration", reason: "other-lineage" }) })
  expect(a.made.retired).toBe(true)
  await sleep(50)
  expect(storage.entries.get(key)).toBe(bSession)
  expect(a.events).not.toContain("TOKEN_REFRESHED")
  expect(eventsOn(key).filter(event => event === "TOKEN_REFRESHED")).toEqual([])
})

test("a late 400 from A's generation never removes B's session and emits no SIGNED_OUT", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const a = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const b = generation(storage, server, key, LB, true)
  expect((await b.made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })).error).toBeNull()
  const bSession = storage.entries.get(key)!
  server.answerRefresh({ status: 400, body: { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" } })
  await sleep(100)
  expect(storage.entries.get(key)).toBe(bSession)
  expect(a.events).not.toContain("SIGNED_OUT")
  expect(eventsOn(key)).not.toContain("SIGNED_OUT")
  a.made.retire()
})

test("a live generation whose lineage was signed out elsewhere (in E) refuses a refresh answer and retires itself", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const before = expiringSession(UA, LA)
  storage.entries.set(key, before)
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  // Another tab signed A out: L_A is in E, but this tab hasn't heard yet (its generation is live).
  addEnded(storage, { lineage: LA, userId: UA }, Date.now())
  const outcome = refreshOutcome(made)
  server.answerRefresh({ status: 200, body: sessionBody(UA, "a-late") })
  expect(await outcome).toEqual({ rejected: expect.objectContaining({ name: "RetiredGeneration", reason: "ended" }) })
  expect(made.retired).toBe(true)
  expect(storage.entries.get(key)).toBe(before)
  expect(sessionOps(storage, key).filter(op => op.op === "set")).toEqual([])
  expect(events).not.toContain("TOKEN_REFRESHED")
})

test("a generation reading a session of an ended lineage drops it (lineage-bound) and sees no session", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, stampLineage(JSON.stringify(sessionBody(UA, "a-live")), LA)!)
  addEnded(storage, { lineage: LA, userId: UA }, Date.now())
  const { made } = generation(storage, server, key, null)
  const { data } = await made.client.auth.getSession()
  expect(data.session).toBeNull()
  expect(storage.entries.has(key)).toBe(false)
  expect(server.refreshCalls()).toBe(0)
  made.retire()
})

test("the generation's own subscriptions stop at retire()", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const made: Generation = createGeneration({ url: URL_BASE, anonKey: "k", storageKey: key, lineage: LB, deliberate: true, storage, fetch: server.fetch, lock })
  const seen: string[] = []
  made.onAuthStateChange(event => { seen.push(event) })
  await made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })
  await until(() => seen.includes("SIGNED_IN"))
  made.retire()
  seen.length = 0
  await sleep(20)
  expect(seen).toEqual([])
})
