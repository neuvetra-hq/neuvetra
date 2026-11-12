// WO-14a step 2, hardened in WO-14b: generations against the REAL installed auth-js (2.105.1, through supabase-js 2.105.1),
// with injected fetch, storage and lock (processLock stands in for navigatorLock). Each case has a control run without
// retire() (or with the allowed lineage), so a test can't pass because nothing happened at all. These pin the library's
// behaviour too: an auth-js upgrade that changes it fails here.
//
// WO-14b (CTO Addendum A, CEO Addendum B): a refused answer is stopped by the generation's fetch (a synthetic 503) before
// auth-js acts on it: no storage call, no event, no broadcast, no network call, and auth-js's refresh settles with a
// retryable error instead of rejecting a promise nobody awaits. The storage's throw stays as a backstop, tested on its own.
//
// auth-js only opens its BroadcastChannel in a browser (`window` and `document` defined), so this file installs a minimal
// window, document and a recording BroadcastChannel for its own tests and restores the globals afterwards.
// bun test fails a test on any unhandled rejection, so every case here also shows that it leaves none (the one auth-js
// makes on a refused refresh write is taken and asserted by `refreshOutcome`).
import { afterAll, beforeAll, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"
import { processLock } from "@supabase/supabase-js"
import { addEnded, ENDED_KEY, LINEAGE_FIELD, stampLineage } from "./auth-lineage"
import { createGeneration, type Generation, type LockFunction } from "./auth-generation"

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
/** The fake window's listeners, so a test can see whether a client left a `visibilitychange` listener behind. */
const windowListeners = new Set<unknown>()
let warn: typeof console.warn, error: typeof console.error
beforeAll(() => {
  for (const name of ["window", "document", "BroadcastChannel"]) saved[name] = (globalThis as Record<string, unknown>)[name]
  Object.assign(globalThis, {
    window: { location: { href: "https://app.example.test/" }, addEventListener(_type: string, listener: unknown) { windowListeners.add(listener) }, removeEventListener(_type: string, listener: unknown) { windowListeners.delete(listener) } },
    document: { visibilityState: "visible" },
    BroadcastChannel: RecordingChannel,
  })
  // auth-js logs every failed fetch, refresh error and "multiple clients" warning; the tests assert on behaviour instead.
  warn = console.warn; error = console.error
  console.warn = () => {}; console.error = () => {}
})
afterAll(() => {
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

function generation(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, server: ReturnType<typeof authServer>, key: string, lineage: string | null, deliberate = false, baseLock: LockFunction = lock) {
  const made = createGeneration({ url: URL_BASE, anonKey: "sb_publishable_test", storageKey: key, lineage, deliberate, storage, fetch: server.fetch, lock: baseLock })
  // Subscribed on the client itself, not through the generation (which hides events after retire): what auth-js emits.
  const events: string[] = []
  made.client.auth.onAuthStateChange(event => { events.push(event) })
  return { made, events }
}
/**
 * auth-js keeps the refresh in flight as a private `refreshingDeferred`. With the fetch pre-check it resolves (with a
 * retryable error) when an answer is refused; only the storage backstop would reject it, and nothing else awaits it, so
 * that rejection would be unhandled. Taking it here lets a test assert which of the two happened.
 */
function refreshOutcome(made: Generation): Promise<unknown> {
  const deferred = (made.client.auth as unknown as { refreshingDeferred: { promise: PromiseLike<unknown> } | null }).refreshingDeferred
  if (!deferred) throw new Error("no refresh in flight")
  return Promise.resolve(deferred.promise).then(value => ({ resolved: value }), (error: unknown) => ({ rejected: error }))
}
/**
 * auth-js retries a 503 for up to 30 s of Date.now() since the first attempt. Moving the clock on while the answer is
 * released makes it stop after the first refused answer, so the refresh settles now instead of 25 s later.
 */
async function settledNow<T>(release: () => void, outcome: Promise<T>): Promise<T> {
  const realNow = Date.now
  Date.now = () => realNow() + 60_000
  try { release(); return await outcome } finally { Date.now = realNow }
}
const refused = { resolved: { data: null, error: expect.objectContaining({ name: "AuthRetryableFetchError", status: 503 }) } }
const lockName = (key: string, lineage: string) => `lock:${key}:${lineage}`
const eventsOn = (key: string) => posted.filter(post => post.channel === key).map(post => post.event)
const sessionOps = (storage: ReturnType<typeof recordingStorage>, key: string, since = 0) => storage.ops.slice(since).filter(op => op.key === key)

// ---------- the library this was checked against ----------

test("the installed supabase-js and the auth-js it loads are 2.105.1 (the version design §0 was checked against)", () => {
  const supabaseJs = path.dirname(Bun.resolveSync("@supabase/supabase-js/package.json", import.meta.dir))
  const authJs = path.dirname(Bun.resolveSync("@supabase/auth-js/package.json", supabaseJs))
  for (const dir of [supabaseJs, authJs]) expect(JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version).toBe("2.105.1")
})

test("F3: a generation's lineage must be a UUID (or null)", () => {
  const server = authServer()
  for (const lineage of ["not-a-uuid", ` ${LA}`, `${LA}0`, ""]) expect(() => createGeneration({ url: URL_BASE, anonKey: "k", storageKey: freshKey(), lineage, deliberate: true, storage: recordingStorage(), fetch: server.fetch, lock })).toThrow(TypeError)
  const made = createGeneration({ url: URL_BASE, anonKey: "k", storageKey: freshKey(), lineage: LA.toUpperCase(), deliberate: false, storage: recordingStorage(), fetch: server.fetch, lock })
  expect(made.lineage).toBe(LA)
  made.retire()
})

// ---------- a held refresh answered after retire(): stopped at the fetch ----------

test("control: a held refresh answered 200 writes the new session with the lineage, emits and broadcasts TOKEN_REFRESHED", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const outcome = refreshOutcome(made)
  server.answerRefresh({ status: 200, body: sessionBody(UA, "a-new") })
  expect(await outcome).toEqual({ resolved: { data: expect.objectContaining({ access_token: "a-new" }), error: null } })
  await until(() => events.includes("TOKEN_REFRESHED"))
  const stored = JSON.parse(storage.entries.get(key)!)
  expect(stored.access_token).toBe("a-new")
  expect(stored[LINEAGE_FIELD]).toBe(LA)
  expect(eventsOn(key)).toContain("TOKEN_REFRESHED")
  made.retire()
})

test("a held refresh answered 200 after retire(): no storage call, no event, no broadcast, no network call; it settles as retryable", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const before = expiringSession(UA, LA)
  storage.entries.set(key, before)
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const opsBefore = storage.ops.length, callsBefore = server.calls.length
  const outcome = refreshOutcome(made)
  made.retire()
  // The answer was already read: it reaches the generation's fetch after the retire, which answers 503 instead.
  server.answerRefresh({ status: 200, body: sessionBody(UA, "a-late") })
  // auth-js retries the 503 at 200 and 400 ms: from memory, never at the network.
  await sleep(700)
  expect(server.calls.length).toBe(callsBefore)
  expect(await settledNow(() => {}, outcome)).toEqual(refused)
  expect(storage.ops.slice(opsBefore)).toEqual([])
  expect(storage.entries.get(key)).toBe(before)
  expect(events).not.toContain("TOKEN_REFRESHED")
  expect(eventsOn(key)).toEqual([])
  expect(server.calls.length).toBe(callsBefore)
})

test("control: a held refresh answered 400 removes the session and emits and broadcasts SIGNED_OUT", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  server.answerRefresh({ status: 400, body: { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" } })
  await until(() => events.includes("SIGNED_OUT"))
  expect(storage.entries.has(key)).toBe(false)
  expect(eventsOn(key)).toContain("SIGNED_OUT")
  made.retire()
})

test("a held refresh answered 400 after retire(): nothing removed, no SIGNED_OUT, no network call; it settles as retryable", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const before = expiringSession(UA, LA)
  storage.entries.set(key, before)
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const opsBefore = storage.ops.length, callsBefore = server.calls.length
  const outcome = refreshOutcome(made)
  made.retire()
  expect(await settledNow(() => server.answerRefresh({ status: 400, body: { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" } }), outcome)).toEqual(refused)
  await sleep(20)
  expect(storage.ops.slice(opsBefore)).toEqual([])
  expect(storage.entries.get(key)).toBe(before)
  expect(events).not.toContain("SIGNED_OUT")
  expect(eventsOn(key)).toEqual([])
  expect(server.calls.length).toBe(callsBefore)
})

test("a live generation whose lineage was signed out elsewhere (in E) refuses a refresh answer at the fetch and retires itself", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const before = expiringSession(UA, LA)
  storage.entries.set(key, before)
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  // Another tab signed A out: L_A is in E, but this tab hasn't heard yet (its generation is live).
  addEnded(storage, { lineage: LA, userId: UA }, Date.now())
  const opsBefore = storage.ops.length, callsBefore = server.calls.length
  const outcome = refreshOutcome(made)
  expect(await settledNow(() => server.answerRefresh({ status: 200, body: sessionBody(UA, "a-late") }), outcome)).toEqual(refused)
  expect(made.retired).toBe(true)
  expect(sessionOps(storage, key, opsBefore)).toEqual([])
  expect(storage.entries.get(key)).toBe(before)
  expect(events).not.toContain("TOKEN_REFRESHED")
  expect(eventsOn(key)).toEqual([])
  expect(server.calls.length).toBe(callsBefore)
})

test("backstop: if storage changes between the fetch's check and auth-js's setItem, the write is still refused (and the rejection is raised)", async () => {
  const key = freshKey(), base = recordingStorage(), server = authServer()
  base.entries.set(key, expiringSession(UA, LA))
  // E reads as empty for the fetch's own check, and holds L_A from the next read on: an artificial change in between.
  const endedNow = JSON.stringify([{ lineage: LA, userId: UA, at: Date.now() }])
  let armed = false
  const storage = {
    getItem: (k: string) => {
      if (k !== ENDED_KEY || !armed) return base.getItem(k)
      armed = false
      queueMicrotask(() => { base.entries.set(ENDED_KEY, endedNow) })
      return null
    },
    setItem: base.setItem, removeItem: base.removeItem,
  }
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const opsBefore = base.ops.length
  const outcome = refreshOutcome(made)
  armed = true
  server.answerRefresh({ status: 200, body: sessionBody(UA, "a-late") })
  expect(await outcome).toEqual({ rejected: expect.objectContaining({ name: "RetiredGeneration", reason: "ended" }) })
  expect(made.retired).toBe(true)
  expect(sessionOps(base, key, opsBefore).filter(op => op.op === "set")).toEqual([])
  expect(events).not.toContain("TOKEN_REFRESHED")
})

test("A2: auth-js gets a buffered answer, not a stream-backed Response: json() is ready within microtasks", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const { made } = generation(storage, server, key, LB, true)
  const authFetch = (made.client.auth as unknown as { fetch: (url: string, init?: RequestInit) => Promise<Response> }).fetch
  const answer = await authFetch(`${URL_BASE}/auth/v1/token?grant_type=password`, { method: "POST", body: JSON.stringify({ email: `${UB}@example.test` }) })
  expect(answer instanceof Response).toBe(false)
  expect(answer).toMatchObject({ ok: true, status: 200 })
  let body: unknown = null
  void answer.json().then(value => { body = value })
  for (let hop = 0; hop < 3; hop++) await Promise.resolve()
  expect(body).toMatchObject({ access_token: expect.any(String) })
  expect(answer.headers.get("content-type")).toBe("application/json")
  made.retire()
})

test("A2: an answer that arrives after retire() is discarded as a 503, also when it isn't a session (a sign-in refused)", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  let answerSignIn: (response: Response) => void = () => {}
  const holding = { ...server, fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    if (new URL(String(input)).searchParams.get("grant_type") === "password") return new Promise<Response>(resolve => { answerSignIn = resolve })
    return server.fetch(input, init)
  } }
  const { made, events } = generation(storage, holding, key, LB, true)
  const signIn = made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "wrong" })
  await sleep(10)
  made.retire()
  const realNow = Date.now
  Date.now = () => realNow() + 60_000
  try {
    answerSignIn(new Response(JSON.stringify({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }), { status: 400, headers: { "content-type": "application/json" } }))
    const { error } = await signIn
    // Not the server's "invalid credentials": the retired generation's answer is discarded.
    expect(error).toMatchObject({ name: "AuthRetryableFetchError", status: 503 })
  } finally { Date.now = realNow }
  expect(storage.ops).toEqual([])
  expect(events.filter(event => event !== "INITIAL_SESSION")).toEqual([])
})

test("A2: a refresh answered with a gateway error (502) is a network failure: the generation stays live and retries at the network", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const a = generation(storage, server, key, LA)
  await server.waitForRefresh()
  // B signs in meanwhile, so a removal would be refused: only a status auth-js treats as removal may retire A.
  const b = generation(storage, server, key, LB, true)
  expect((await b.made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })).error).toBeNull()
  const bSession = storage.entries.get(key)!
  server.answerRefresh({ status: 502, body: { message: "Bad gateway" } })
  await server.waitForRefresh()
  expect(a.made.retired).toBe(false)
  expect(server.refreshCalls()).toBe(2)
  expect(storage.entries.get(key)).toBe(bSession)
  const outcome = refreshOutcome(a.made)
  a.made.retire()
  expect(await settledNow(() => server.answerRefresh({ status: 200, body: sessionBody(UA, "a-late") }), outcome)).toEqual(refused)
  expect(storage.entries.get(key)).toBe(bSession)
  b.made.retire()
})

// ---------- the retry loop and the network ----------

test("control: a refresh that fails at the network is retried at the network (200, 400 ms backoff)", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer({ refresh: "fail" })
  storage.entries.set(key, expiringSession(UA, LA))
  const { made } = generation(storage, server, key, LA)
  await until(() => server.refreshCalls() >= 1)
  const outcome = refreshOutcome(made)
  await until(() => server.refreshCalls() >= 3, 3000)
  made.retire()
  await settledNow(() => {}, outcome)
})

test("retire() during the retry loop: the in-flight request is aborted and zero further requests reach the network", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer({ honourAbort: true })
  const before = expiringSession(UA, LA)
  storage.entries.set(key, before)
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  expect(server.refreshCalls()).toBe(1)
  const outcome = refreshOutcome(made)
  made.retire()
  // auth-js retries after 200, 400 and 800 ms: each attempt is answered 503 from memory, none reaches the network.
  await sleep(1700)
  expect(server.calls).toHaveLength(1)
  expect(await settledNow(() => {}, outcome)).toEqual(refused)
  expect(server.calls).toHaveLength(1)
  expect(storage.entries.get(key)).toBe(before)
  expect(events).not.toContain("SIGNED_OUT")
  expect(events).not.toContain("TOKEN_REFRESHED")
}, 5000)

test("a retired generation's fetch answers 503 without calling the network", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  const { made } = generation(storage, server, key, null)
  await sleep(20)
  made.retire()
  const callsBefore = server.calls.length
  const realNow = Date.now
  Date.now = () => realNow() + 60_000
  try {
    const { error } = await made.client.auth.signInWithPassword({ email: `${UA}@example.test`, password: "x" })
    expect(error).toMatchObject({ name: "AuthRetryableFetchError", status: 503 })
  } finally { Date.now = realNow }
  expect(server.calls.length).toBe(callsBefore)
  expect(storage.entries.has(key)).toBe(false)
})

// ---------- the lock ----------

test("control: while a refresh is held, the client's lock (named for its lineage) stays held and another client can't take it", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const { made } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  await expect(lock(lockName(key, LA), 100, async () => "acquired")).rejects.toMatchObject({ isAcquireTimeout: true })
  made.retire()
})

test("retire() releases the lock within 10 ms, though the held refresh hasn't answered", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const { made } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const waiting = lock(lockName(key, LA), 5000, async () => Date.now())
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
  const blocker = lock(lockName(key, LA), 5000, () => sleep(1000))
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
  holder.made.retire()
  await signer.made.client.auth.initialize()
  signer.made.retire()
})

test("F2: A's held refresh never delays another lineage's generation: B's boot (initialize, getSession) doesn't wait for A's lock", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const a = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const started = Date.now()
  const b = generation(storage, server, key, LB, true)
  await b.made.client.auth.initialize()
  expect((await b.made.client.auth.getSession()).data.session).toBeNull()
  expect(Date.now() - started).toBeLessThan(50)
  // Control: a second generation of A's own lineage (another tab of A) still waits for A's held refresh: refreshes of one
  // lineage stay coordinated across tabs.
  const a2 = generation(storage, server, key, LA)
  await sleep(150)
  expect(server.refreshCalls()).toBe(1)
  a.made.retire()
  // Once A's lock is released, the other tab of A takes it and refreshes A's session itself.
  await until(() => server.refreshCalls() === 2)
  a2.made.retire(); b.made.retire()
})

test("F2: a lock stolen from running work (navigatorLock after its timeout) doesn't fail that work or raise a rejection", async () => {
  // navigatorLock's steal: the stolen holder's request rejects with an AbortError while its callback keeps running.
  const holders = new Map<string, (error: unknown) => void>()
  const stealable: LockFunction = (name, _timeout, fn) => new Promise((resolve, reject) => { holders.set(name, reject); fn().then(resolve, reject) })
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const { made, events } = generation(storage, server, key, LA, false, stealable)
  await server.waitForRefresh()
  holders.get(lockName(key, LA))!(new DOMException("Lock broken by another request with the 'steal' option.", "AbortError"))
  await sleep(10)
  server.answerRefresh({ status: 200, body: sessionBody(UA, "a-new") })
  await made.client.auth.initialize()
  await until(() => events.includes("TOKEN_REFRESHED"))
  expect(JSON.parse(storage.entries.get(key)!).access_token).toBe("a-new")
  made.retire()
})

// ---------- R1: a generation sees only its own lineage ----------

test("R1 / I9: a generation never sends another lineage's refresh token, nor that of a session without a lineage", async () => {
  for (const stored of [expiringSession(UB, LB), JSON.stringify(sessionBody(UB, "legacy", 10))]) {
    const key = freshKey(), storage = recordingStorage(), server = authServer()
    storage.entries.set(key, stored)
    const a = generation(storage, server, key, LA)
    const idle = generation(storage, server, key, null)
    await a.made.client.auth.initialize(); await idle.made.client.auth.initialize()
    await sleep(100)
    expect(server.calls).toEqual([])
    expect((await a.made.client.auth.getSession()).data.session).toBeNull()
    expect(storage.entries.get(key)).toBe(stored)
    expect(storage.ops).toEqual([])
    a.made.retire(); idle.made.retire()
  }
  // Control: the same near-expiry session of its own lineage is refreshed at once.
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const own = generation(storage, server, key, LA)
  await server.waitForRefresh()
  expect(server.refreshCalls()).toBe(1)
  own.made.retire()
})

// ---------- R2: the code verifier ----------

test("R2: a refresh by a non-deliberate generation leaves another tab's PKCE code verifier in place", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  storage.entries.set(`${key}-code-verifier`, "\"verifier-of-an-email-link-in-another-tab\"")
  const { made, events } = generation(storage, server, key, LA)
  await server.waitForRefresh()
  server.answerRefresh({ status: 200, body: sessionBody(UA, "a-new") })
  await until(() => events.includes("TOKEN_REFRESHED"))
  expect(JSON.parse(storage.entries.get(key)!).access_token).toBe("a-new")
  expect(storage.entries.get(`${key}-code-verifier`)).toBe("\"verifier-of-an-email-link-in-another-tab\"")
  made.retire()
  // Control: a sign-in (deliberate) removes it, as auth-js does before saving its session.
  const key2 = freshKey(), storage2 = recordingStorage()
  storage2.entries.set(`${key2}-code-verifier`, "\"v\"")
  const signer = generation(storage2, server, key2, LB, true)
  expect((await signer.made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })).error).toBeNull()
  expect(storage2.entries.has(`${key2}-code-verifier`)).toBe(false)
  signer.made.retire()
})

// ---------- deliberate and non-deliberate writes across lineages ----------

test("a deliberate generation (a sign-in) overwrites another lineage's stored session and stamps its own lineage", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, stampLineage(JSON.stringify(sessionBody(UA, "a-live")), LA)!)
  const { made, events } = generation(storage, server, key, LB, true)
  expect(made.deliberate).toBe(true)
  const { error } = await made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })
  expect(error).toBeNull()
  const stored = JSON.parse(storage.entries.get(key)!)
  expect(stored.user.id).toBe(UB)
  expect(stored[LINEAGE_FIELD]).toBe(LB)
  expect(made.lastWritten).toBe(storage.entries.get(key)!)
  // L1: that was its one deliberate write.
  expect(made.deliberate).toBe(false)
  await until(() => events.includes("SIGNED_IN"))
  expect(eventsOn(key)).toContain("SIGNED_IN")
  made.retire()
})

for (const answer of [200, 400] as const) {
  test(`L1: A signed in deliberately and stays signed in; after B signs in, A's held refresh answered ${answer} leaves B's session, B hears nothing`, async () => {
    const key = freshKey(), storage = recordingStorage()
    // A's sign-in gives a session near expiry, so A refreshes it.
    const server = authServer()
    const shortLived = { ...server, fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const grant = new URL(String(input)).searchParams.get("grant_type")
      if (grant === "password" && String(init?.body ?? "").includes("a0a0")) { server.calls.push({ grant, at: Date.now() }); return Promise.resolve(new Response(JSON.stringify(sessionBody(UA, "a-signed-in", 10)), { status: 200, headers: { "content-type": "application/json" } })) }
      return server.fetch(input, init)
    } }
    const a = generation(storage, shortLived, key, LA, true)
    expect((await a.made.client.auth.signInWithPassword({ email: `${UA}@example.test`, password: "x" })).error).toBeNull()
    expect(a.made.deliberate).toBe(false)
    void a.made.client.auth.refreshSession().catch(() => {})
    await server.waitForRefresh()
    const b = generation(storage, shortLived, key, LB, true)
    const bHeard: string[] = []
    b.made.onAuthStateChange(event => { bHeard.push(event) })
    expect((await b.made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })).error).toBeNull()
    await until(() => bHeard.includes("SIGNED_IN"))
    const bSession = storage.entries.get(key)!
    const opsBefore = storage.ops.length, callsBefore = server.calls.length, postedBefore = eventsOn(key).length
    bHeard.length = 0
    const outcome = refreshOutcome(a.made)
    const body = answer === 200 ? sessionBody(UA, "a-late") : { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }
    expect(await settledNow(() => server.answerRefresh({ status: answer, body }), outcome)).toEqual(refused)
    await sleep(20)
    expect(storage.entries.get(key)).toBe(bSession)
    expect(storage.ops.slice(opsBefore)).toEqual([])
    expect(bHeard.filter(event => event !== "INITIAL_SESSION")).toEqual([])
    expect(eventsOn(key).slice(postedBefore)).toEqual([])
    expect(a.made.retired).toBe(true)
    expect(server.calls.length).toBe(callsBefore)
    b.made.retire()
  })
}

test("L1: a deliberate generation's refresh is never deliberate: its first write being a refresh doesn't let it overwrite B", async () => {
  // QA's g2 row: a generation made deliberate, but its first write is a refresh of A's stored session (not a sign-in).
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  storage.entries.set(`${key}-code-verifier`, "\"verifier-of-another-tab\"")
  const a = generation(storage, server, key, LA, true)
  await server.waitForRefresh()
  const b = generation(storage, server, key, LB, true)
  expect((await b.made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })).error).toBeNull()
  storage.entries.set(`${key}-code-verifier`, "\"verifier-of-another-tab\"")
  const bSession = storage.entries.get(key)!
  const opsBefore = storage.ops.length
  const outcome = refreshOutcome(a.made)
  expect(await settledNow(() => server.answerRefresh({ status: 200, body: sessionBody(UA, "a-late") }), outcome)).toEqual(refused)
  expect(storage.entries.get(key)).toBe(bSession)
  expect(storage.ops.slice(opsBefore)).toEqual([])
  expect(storage.entries.get(`${key}-code-verifier`)).toBe("\"verifier-of-another-tab\"")
  expect(a.made.retired).toBe(true)
  b.made.retire()
  // Control: the same deliberate generation's refresh of its own lineage, with nothing else stored, goes through, and it
  // stays deliberate (its sign-in's write is still to come) but removed no verifier.
  const key2 = freshKey(), storage2 = recordingStorage(), server2 = authServer()
  storage2.entries.set(key2, expiringSession(UA, LA))
  storage2.entries.set(`${key2}-code-verifier`, "\"v\"")
  const own = generation(storage2, server2, key2, LA, true)
  await server2.waitForRefresh()
  server2.answerRefresh({ status: 200, body: sessionBody(UA, "a-new") })
  await until(() => own.events.includes("TOKEN_REFRESHED"))
  expect(JSON.parse(storage2.entries.get(key2)!).access_token).toBe("a-new")
  expect(storage2.entries.get(`${key2}-code-verifier`)).toBe("\"v\"")
  expect(own.made.deliberate).toBe(true)
  own.made.retire()
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
  const opsBefore = storage.ops.length
  const outcome = refreshOutcome(a.made)
  expect(await settledNow(() => server.answerRefresh({ status: 200, body: sessionBody(UA, "a-late") }), outcome)).toEqual(refused)
  expect(a.made.retired).toBe(true)
  expect(storage.entries.get(key)).toBe(bSession)
  expect(storage.ops.slice(opsBefore)).toEqual([])
  expect(a.events).not.toContain("TOKEN_REFRESHED")
  expect(eventsOn(key).filter(event => event === "TOKEN_REFRESHED")).toEqual([])
  b.made.retire()
})

test("a late 400 from A's generation never removes B's session and emits no SIGNED_OUT", async () => {
  const key = freshKey(), storage = recordingStorage(), server = authServer()
  storage.entries.set(key, expiringSession(UA, LA))
  const a = generation(storage, server, key, LA)
  await server.waitForRefresh()
  const b = generation(storage, server, key, LB, true)
  expect((await b.made.client.auth.signInWithPassword({ email: `${UB}@example.test`, password: "x" })).error).toBeNull()
  const bSession = storage.entries.get(key)!
  const opsBefore = storage.ops.length
  const outcome = refreshOutcome(a.made)
  expect(await settledNow(() => server.answerRefresh({ status: 400, body: { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" } }), outcome)).toEqual(refused)
  expect(a.made.retired).toBe(true)
  expect(storage.entries.get(key)).toBe(bSession)
  expect(storage.ops.slice(opsBefore)).toEqual([])
  expect(a.events).not.toContain("SIGNED_OUT")
  expect(eventsOn(key)).not.toContain("SIGNED_OUT")
  b.made.retire()
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

// ---------- retire() and auto-refresh ----------

test("A4: retire() while initialize waits for the lock: once it settles, no ticker and no visibilitychange listener remain", async () => {
  const internals = (made: Generation) => made.client.auth as unknown as { autoRefreshTicker: unknown; visibilityChangedCallback: unknown }
  // Control: a live generation that initialized has its ticker and its listener.
  const key0 = freshKey(), storage0 = recordingStorage(), server = authServer()
  storage0.entries.set(key0, stampLineage(JSON.stringify(sessionBody(UA, "a-live")), LA)!)
  const before0 = new Set(windowListeners)
  const live = generation(storage0, server, key0, LA)
  await live.made.client.auth.initialize()
  await sleep(5)
  expect(internals(live.made).autoRefreshTicker).not.toBeNull()
  expect([...windowListeners].filter(listener => !before0.has(listener))).toHaveLength(1)
  live.made.retire()
  await sleep(5)
  expect(internals(live.made).autoRefreshTicker).toBeNull()

  const key = freshKey(), storage = recordingStorage()
  storage.entries.set(key, stampLineage(JSON.stringify(sessionBody(UA, "a-live")), LA)!)
  let releaseHolder: () => void = () => {}
  const holder = lock(lockName(key, LA), 5000, () => new Promise<void>(resolve => { releaseHolder = resolve }))
  const before = new Set(windowListeners)
  const { made } = generation(storage, server, key, LA)
  await sleep(20)
  made.retire()
  releaseHolder()
  await holder
  await made.client.auth.initialize()
  // The second stop runs on the next macrotask after initialize settles.
  await sleep(0); await sleep(0)
  expect(internals(made).autoRefreshTicker).toBeNull()
  expect(internals(made).visibilityChangedCallback).toBeNull()
  expect([...windowListeners].filter(listener => !before.has(listener))).toEqual([])
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
