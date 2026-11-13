// WO-14c: the page's sessions through auth generations (design step 4), against the REAL installed supabase-js/auth-js
// 2.105.1 with injected fetch, storage and lock (processLock), and Bun's real BroadcastChannel standing in for the
// browser's. Two controllers on one storage are two tabs of one browser; a plain `createClient` configured as main's
// PrivateStaging configures it is a tab still running the old bundle during the rollout.
import { afterAll, beforeAll, expect, test } from "bun:test"
import { createClient, processLock, type Session } from "@supabase/supabase-js"
import { LINEAGE_FIELD, readStored, stampLineage } from "./auth-lineage"
import { createAuthSessions, type AuthSessionsOptions } from "./auth-sessions"
import type { LockFunction } from "./auth-generation"

const URL_BASE = "https://abcdefghijklmnopqrstu.supabase.co"
const UA = "a0a0a0a0-0000-4000-8000-00000000000a", UB = "b0b0b0b0-0000-4000-8000-00000000000b"
const LA = "aaaaaaaa-1111-4111-8111-000000000001"
const lock = processLock as LockFunction

// ---------- environment: a browser for auth-js (BroadcastChannel, visibility, the address) ----------

const saved: Record<string, unknown> = {}
const location = { href: "https://app.example.test/", search: "" }
let warn: typeof console.warn, error: typeof console.error
beforeAll(() => {
  for (const name of ["window", "document"]) saved[name] = (globalThis as Record<string, unknown>)[name]
  Object.assign(globalThis, {
    window: { location, history: { state: null, replaceState(_state: unknown, _title: string, url: string) { location.href = url } }, addEventListener() {}, removeEventListener() {} },
    document: { visibilityState: "visible" },
  })
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

// ---------- a small Supabase Auth with real sessions ----------

let keyCounter = 0
const freshKey = () => `neuvetra:m63:sessions${++keyCounter}:auth`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function until(check: () => boolean, timeout = 3000) {
  const started = Date.now()
  while (!check()) { if (Date.now() - started > timeout) throw new Error("timed out waiting"); await sleep(2) }
}

function sharedStorage() {
  const entries = new Map<string, string>()
  return { entries, getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v) }, removeItem: (k: string) => { entries.delete(k) } }
}

/**
 * Sessions with rotating refresh tokens. The parent of the current refresh token is accepted (GoTrue's reuse window), so
 * two tabs refreshing the same token at once both succeed. Refresh answers can be held.
 */
function authServer() {
  let issued = 0
  const sessions = new Map<number, { user: string; current: string; parent: string | null; revoked: boolean; access: string[] }>()
  const calls: Array<{ path: string; grant: string | null; refreshToken?: string; bearer?: string | null }> = []
  let hold: Promise<void> | null = null, releaseHold = () => {}
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
  const issue = (id: number, life = 3600, rotate = true) => {
    const session = sessions.get(id)!
    const access = `${session.user.slice(0, 4)}-access-${++issued}`
    session.access.push(access)
    if (rotate) { session.parent = session.current; session.current = `refresh-${issued}` }
    return { access_token: access, refresh_token: session.current, token_type: "bearer", expires_in: life, expires_at: Math.floor(Date.now() / 1000) + life,
      user: { id: session.user, aud: "authenticated", role: "authenticated", email: `${session.user.slice(0, 4)}@example.test`, app_metadata: {}, user_metadata: {}, created_at: "2025-01-01T00:00:00Z" } }
  }
  const signIn = (user: string, life = 3600) => { const id = sessions.size + 1; sessions.set(id, { user, current: "", parent: null, revoked: false, access: [] }); return issue(id, life) }
  let nextLife = 3600
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input))
    const grant = url.searchParams.get("grant_type")
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, string>
    const bearer = new Headers(init?.headers).get("authorization")
    calls.push({ path: url.pathname, grant, refreshToken: body.refresh_token, bearer })
    if (grant === "password") return json(200, signIn(body.email!.startsWith("b0b0") ? UB : UA, nextLife))
    if (grant === "pkce") return body.auth_code === "good-code" && body.code_verifier ? json(200, signIn(UB)) : json(400, { error_code: "flow_state_not_found", msg: "invalid flow state" })
    if (grant === "refresh_token") {
      const entry = [...sessions.entries()].find(([, s]) => s.current === body.refresh_token || s.parent === body.refresh_token)
      if (hold) await hold
      if (!entry || entry[1].revoked) return json(400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" })
      return json(200, issue(entry[0], 3600, entry[1].current === body.refresh_token))
    }
    if (url.pathname.endsWith("/otp")) return json(200, {})
    if (url.pathname.endsWith("/logout")) {
      const entry = [...sessions.values()].find(s => s.access.some(a => bearer === `Bearer ${a}`))
      if (!entry || entry.revoked) return json(403, { error_code: "session_not_found", msg: "Session not found" })
      entry.revoked = true
      return new Response(null, { status: 204 })
    }
    return json(404, {})
  }
  return {
    fetch, calls, sessions, signIn,
    setLife(seconds: number) { nextLife = seconds },
    refreshCalls: () => calls.filter(call => call.grant === "refresh_token"),
    holdRefreshes() { hold = new Promise(resolve => { releaseHold = resolve }) },
    release() { releaseHold(); hold = null },
  }
}

/** One tab running this branch's code: the controller, and what it reported. */
function tab(storage: ReturnType<typeof sharedStorage>, server: ReturnType<typeof authServer>, key: string, extra: Partial<AuthSessionsOptions> = {}) {
  const reported: Array<string | null> = []
  let adopted = 0
  const sessions = createAuthSessions({
    url: URL_BASE, anonKey: "sb_publishable_test", storageKey: key, search: "", storage, fetch: server.fetch, lock,
    onSession: (session: Session | null) => { reported.push(session?.access_token ?? null) },
    onAdopt: () => { adopted++ },
    ...extra,
  })
  return { sessions, reported, adopted: () => adopted }
}
/** One tab still on main's bundle: one long-lived client, configured as main's PrivateStaging configures it. */
function oldTab(storage: ReturnType<typeof sharedStorage>, server: ReturnType<typeof authServer>, key: string) {
  const client = createClient(URL_BASE, "sb_publishable_test", { global: { fetch: server.fetch as typeof fetch }, auth: { storageKey: key, storage, lock: processLock, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" } })
  const events: string[] = []
  client.auth.onAuthStateChange(event => { events.push(event) })
  return { client, events }
}
const legacy = (session: object) => JSON.stringify(session)
const lineageOf = (storage: ReturnType<typeof sharedStorage>, key: string) => readStored(storage.getItem(key))?.lineage ?? null

// ---------- boot ----------

test("boot with a session stored before WO-14 (no nv_lineage): it is stamped, adopted and reported once, nothing refreshed", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const stored = server.signIn(UA)
  storage.setItem(key, legacy(stored))
  const t = tab(storage, server, key)
  await t.sessions.boot()
  const lineage = lineageOf(storage, key)
  expect(lineage).toMatch(/^[0-9a-f-]{36}$/)
  expect(t.sessions.generation.lineage).toBe(lineage)
  expect(JSON.parse(storage.getItem(key)!).access_token).toBe(stored.access_token)
  expect(t.reported).toEqual([stored.access_token])
  expect(server.refreshCalls()).toEqual([])
  t.sessions.dispose()
})

test("boot with a legacy session near expiry: the boot generation refreshes it and a stamped session is stored and reported", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const stored = server.signIn(UA, 30)
  storage.setItem(key, legacy(stored))
  const t = tab(storage, server, key)
  await t.sessions.boot()
  const now = JSON.parse(storage.getItem(key)!)
  expect(now.access_token).not.toBe(stored.access_token)
  expect(now[LINEAGE_FIELD]).toBe(t.sessions.generation.lineage)
  expect(server.refreshCalls()).toHaveLength(1)
  // The expired token is never reported: only the refreshed one (main: getSession waited for the refresh too).
  expect(t.reported).toEqual([now.access_token])
  t.sessions.dispose()
})

test("boot without a session reports none, and its generation has no lineage", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const t = tab(storage, server, key)
  await t.sessions.boot()
  expect(t.reported).toEqual([null])
  expect(t.sessions.generation.lineage).toBeNull()
  expect(server.calls).toEqual([])
  t.sessions.dispose()
})

test("F-B: with ?code= the boot generation is deliberate: the link's session replaces another lineage's, and only it reads the address", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const other = server.signIn(UA)
  storage.setItem(key, stampLineage(legacy(other), LA)!)
  storage.setItem(`${key}-code-verifier`, JSON.stringify("verifier-of-this-browser"))
  location.href = "https://app.example.test/?code=good-code"
  try {
    const t = tab(storage, server, key, { search: "?code=good-code" })
    await t.sessions.boot()
    const now = JSON.parse(storage.getItem(key)!)
    expect(now.user.id).toBe(UB)
    expect(now[LINEAGE_FIELD]).toBe(t.sessions.generation.lineage)
    expect(now[LINEAGE_FIELD]).not.toBe(LA)
    expect(t.reported).toEqual([now.access_token])
    // The one-time code left the address; the verifier was used up.
    expect(location.href).toBe("https://app.example.test/")
    expect(storage.getItem(`${key}-code-verifier`)).toBeNull()
    expect(server.calls.filter(call => call.grant === "pkce")).toHaveLength(1)
    t.sessions.dispose()
  } finally { location.href = "https://app.example.test/" }
})

test("F-B control: a boot without ?code= never exchanges a code, even with a verifier stored", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  storage.setItem(`${key}-code-verifier`, JSON.stringify("v"))
  location.href = "https://app.example.test/?code=good-code"
  try {
    const t = tab(storage, server, key, { search: "" })
    await t.sessions.boot()
    expect(server.calls.filter(call => call.grant === "pkce")).toEqual([])
    expect(t.reported).toEqual([null])
    t.sessions.dispose()
  } finally { location.href = "https://app.example.test/" }
})

// ---------- sign-in ----------

test("each sign-in runs on a new deliberate generation (F-C); the session is stamped with its lineage and reported once", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const t = tab(storage, server, key)
  await t.sessions.boot()
  const boot = t.sessions.generation
  expect(await t.sessions.signIn(`${UB}@example.test`, "x")).toBe("signed-in")
  const first = t.sessions.generation
  expect(first).not.toBe(boot)
  expect(boot.retired).toBe(true)
  expect(lineageOf(storage, key)).toBe(first.lineage)
  const firstToken = JSON.parse(storage.getItem(key)!).access_token
  expect(t.reported).toEqual([null, firstToken])
  // A second sign-in (another user at a shared computer) gets its own generation and lineage.
  expect(await t.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  expect(t.sessions.generation).not.toBe(first)
  expect(first.retired).toBe(true)
  expect(JSON.parse(storage.getItem(key)!).user.id).toBe(UA)
  expect(lineageOf(storage, key)).toBe(t.sessions.generation.lineage)
  expect(t.reported).toHaveLength(3)
  t.sessions.dispose()
})

test("a failed sign-in is 'failed' and reports nothing new; an answer after its generation retired is 'discarded'", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const failing = { ...server, fetch: async (input: RequestInfo | URL, init?: RequestInit) => new URL(String(input)).searchParams.get("grant_type") === "password" ? new Response(JSON.stringify({ error_code: "invalid_credentials", msg: "Invalid login credentials" }), { status: 400, headers: { "content-type": "application/json" } }) : server.fetch(input, init) }
  const t = tab(storage, failing, key)
  await t.sessions.boot()
  expect(await t.sessions.signIn(`${UA}@example.test`, "wrong")).toBe("failed")
  expect(t.reported).toEqual([null])
  // The answer arrives after the page let the generation go (here: the page closed).
  let answer: (response: Response) => void = () => {}
  const held = { ...server, fetch: (input: RequestInfo | URL, init?: RequestInit) => new URL(String(input)).searchParams.get("grant_type") === "password" ? new Promise<Response>(resolve => { answer = resolve }) : server.fetch(input, init) }
  const key2 = freshKey(), t2 = tab(storage, held, key2)
  await t2.sessions.boot()
  const pending = t2.sessions.signIn(`${UA}@example.test`, "x")
  await sleep(10)
  t2.sessions.dispose()
  answer(new Response(JSON.stringify({ error_code: "invalid_credentials", msg: "Invalid login credentials" }), { status: 400, headers: { "content-type": "application/json" } }))
  const realNow = Date.now
  Date.now = () => realNow() + 60_000
  try { expect(await pending).toBe("discarded") } finally { Date.now = realNow }
  expect(storage.getItem(key2)).toBeNull()
  t.sessions.dispose()
})

test("while a sign-in is in flight, another tab's session isn't adopted; afterwards this tab's own sign-in is what it reports", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  let answer: () => void = () => {}
  const slow = { ...server, fetch: async (input: RequestInfo | URL, init?: RequestInit) => { if (new URL(String(input)).searchParams.get("grant_type") === "password" && String(init?.body).includes("b0b0")) await new Promise<void>(resolve => { answer = resolve }); return server.fetch(input, init) } }
  const one = tab(storage, slow, key), two = tab(storage, server, key)
  await one.sessions.boot(); await two.sessions.boot()
  const signing = one.sessions.signIn(`${UB}@example.test`, "x")
  await sleep(10)
  // Tab two signs A in meanwhile; tab one sees the storage event.
  expect(await two.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  one.sessions.sync()
  expect(one.adopted()).toBe(0)
  answer()
  expect(await signing).toBe("signed-in")
  expect(JSON.parse(storage.getItem(key)!).user.id).toBe(UB)
  expect(one.reported.at(-1)).toBe(JSON.parse(storage.getItem(key)!).access_token)
  one.sessions.dispose(); two.sessions.dispose()
})

// ---------- adoption across tabs ----------

test("another tab's sign-in is adopted: a new generation for its lineage, onAdopt, then its session", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const one = tab(storage, server, key), two = tab(storage, server, key)
  await one.sessions.boot(); await two.sessions.boot()
  const before = one.sessions.generation
  expect(await two.sessions.signIn(`${UB}@example.test`, "x")).toBe("signed-in")
  // The relayed SIGNED_IN (BroadcastChannel) or the storage event makes tab one read the stored session.
  await until(() => one.reported.length === 2)
  one.sessions.sync()
  expect(one.adopted()).toBe(1)
  expect(before.retired).toBe(true)
  expect(one.sessions.generation.lineage).toBe(two.sessions.generation.lineage)
  expect(one.reported).toEqual([null, JSON.parse(storage.getItem(key)!).access_token])
  one.sessions.dispose(); two.sessions.dispose()
})

test("a refresh in one tab is followed by the other tab (same lineage, the refreshed token) without a sign-out", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  server.setLife(30)
  const one = tab(storage, server, key), two = tab(storage, server, key)
  await one.sessions.boot()
  expect(await one.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  // Tab one refreshes the near-expiry session (its tick); tab two boots on the refreshed session.
  await until(() => server.refreshCalls().length >= 1)
  await until(() => one.reported.length === 3)
  await two.sessions.boot()
  expect(two.sessions.generation.lineage).toBe(one.sessions.generation.lineage)
  expect(two.reported).toEqual([one.reported.at(-1)!])
  // Tab one reported "none" only at its boot, before the sign-in; never after.
  expect([...one.reported.slice(1), ...two.reported]).not.toContain(null)
  one.sessions.dispose(); two.sessions.dispose()
})

// ---------- sign-out (unchanged) ----------

test("sign-out is client.auth.signOut on the generation serving the stored session: one logout, the session removed, none reported", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const stored = server.signIn(UA)
  storage.setItem(key, legacy(stored))
  const t = tab(storage, server, key)
  await t.sessions.boot()
  const { error } = await t.sessions.signOut()
  expect(error).toBeNull()
  expect(storage.getItem(key)).toBeNull()
  const logouts = server.calls.filter(call => call.path.endsWith("/logout"))
  expect(logouts).toEqual([expect.objectContaining({ bearer: `Bearer ${stored.access_token}` })])
  expect(t.reported).toEqual([stored.access_token, null])
  t.sessions.dispose()
})

test("sign-out right after an old-code tab wrote an unstamped refresh: the session is adopted first, then signed out as before", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const t = tab(storage, server, key)
  await t.sessions.boot()
  expect(await t.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  // An old-code tab's refresh writes the session without nv_lineage, and this tab hasn't seen the storage event yet.
  const old = JSON.parse(storage.getItem(key)!)
  delete old[LINEAGE_FIELD]
  storage.setItem(key, JSON.stringify(old))
  const { error } = await t.sessions.signOut()
  expect(error).toBeNull()
  expect(storage.getItem(key)).toBeNull()
  expect(server.calls.filter(call => call.path.endsWith("/logout"))).toHaveLength(1)
  t.sessions.dispose()
})

// ---------- rollout: a tab on main's bundle and a tab on this branch ----------

test("rollout: an old-code tab signed in, a new-code tab boots on its session; refreshes on either side sign neither out", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const old = oldTab(storage, server, key)
  expect((await old.client.auth.signInWithPassword({ email: `${UA}@example.test`, password: "x" })).error).toBeNull()
  // main's code stores the session without nv_lineage.
  expect(lineageOf(storage, key)).toBeNull()
  const fresh = tab(storage, server, key)
  await fresh.sessions.boot()
  const lineage1 = lineageOf(storage, key)
  expect(lineage1).toBe(fresh.sessions.generation.lineage)

  // 1. The old tab refreshes: it writes an unstamped session. The new tab (storage event) stamps it under a fresh lineage
  //    and adopts it, reporting the new token; nobody is signed out.
  const refreshedByOld = await old.client.auth.refreshSession()
  expect(refreshedByOld.error).toBeNull()
  expect(lineageOf(storage, key)).toBeNull()
  fresh.sessions.sync()
  const lineage2 = lineageOf(storage, key)
  expect(lineage2).not.toBeNull()
  expect(lineage2).not.toBe(lineage1)
  expect(fresh.sessions.generation.lineage).toBe(lineage2)
  expect(fresh.reported.at(-1)).toBe(refreshedByOld.data.session!.access_token)

  // 2. The new tab refreshes (its generation, on the stamped session): the old tab reads it from storage and refreshes
  //    after it with the newest refresh token.
  const refreshedByNew = await fresh.sessions.client.auth.refreshSession()
  expect(refreshedByNew.error).toBeNull()
  expect(lineageOf(storage, key)).toBe(lineage2)
  const oldSees = await old.client.auth.getSession()
  expect(oldSees.data.session?.access_token).toBe(refreshedByNew.data.session!.access_token)
  const again = await old.client.auth.refreshSession()
  expect(again.error).toBeNull()
  expect(server.refreshCalls().at(-1)!.refreshToken).toBe(refreshedByNew.data.session!.refresh_token)

  // Neither tab was signed out at any point.
  expect(old.events).not.toContain("SIGNED_OUT")
  expect(fresh.reported).not.toContain(null)
  fresh.sessions.dispose()
  await old.client.auth.stopAutoRefresh()
})

test("rollout: a new-code refresh answered after an old-code tab's unstamped write is refused, and the tab re-adopts the stored session", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const old = oldTab(storage, server, key)
  expect((await old.client.auth.signInWithPassword({ email: `${UA}@example.test`, password: "x" })).error).toBeNull()
  const fresh = tab(storage, server, key)
  await fresh.sessions.boot()
  const before = fresh.sessions.generation
  // The new tab's refresh is held at the server; the old tab refreshes meanwhile (the parent token is accepted).
  server.holdRefreshes()
  const held = fresh.sessions.client.auth.refreshSession()
  await until(() => server.refreshCalls().length === 1)
  server.release()
  const byOld = await old.client.auth.refreshSession()
  void byOld
  // Whichever answer lands second finds a stored session of another lineage (or none) and is refused, never written
  // over; the page ends up on the stored session, stamped, with no sign-out reported.
  await held.catch(() => null)
  await sleep(20)
  fresh.sessions.sync()
  const stored = JSON.parse(storage.getItem(key)!)
  expect(stored[LINEAGE_FIELD]).toBe(fresh.sessions.generation.lineage)
  expect(fresh.reported).not.toContain(null)
  expect(fresh.reported.at(-1)).toBe(stored.access_token)
  expect(old.events).not.toContain("SIGNED_OUT")
  void before
  fresh.sessions.dispose()
  await old.client.auth.stopAutoRefresh()
})

test("a generation that retires itself makes the page re-read the stored session (onRetire): no sign-out is reported", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  server.setLife(30)
  const t = tab(storage, server, key)
  await t.sessions.boot()
  // Its auto-refresh (the session is near expiry from the start) is held at the server.
  server.holdRefreshes()
  expect(await t.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  const signedIn = t.sessions.generation
  await until(() => server.refreshCalls().length >= 1)
  // Meanwhile another writer replaces the stored session with an unstamped one (a tab on old code).
  const other = JSON.parse(storage.getItem(key)!)
  delete other[LINEAGE_FIELD]
  other.access_token = "written-by-old-code"
  storage.setItem(key, JSON.stringify(other))
  server.release()
  await until(() => signedIn.retired)
  await until(() => t.sessions.generation !== signedIn)
  // The stored (old-code) session is adopted and reported; being near expiry too, the adopting generation then refreshes
  // it under its own lineage. The refused answer of the retired generation was never written.
  expect(t.reported).toContain("written-by-old-code")
  await until(() => t.reported.at(-1) === JSON.parse(storage.getItem(key)!).access_token)
  expect(t.reported.slice(1)).not.toContain(null)
  expect(lineageOf(storage, key)).toBe(t.sessions.generation.lineage)
  t.sessions.dispose()
})
