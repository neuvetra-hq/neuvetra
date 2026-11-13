// WO-14c: the page's sessions through auth generations (design step 4), against the REAL installed supabase-js/auth-js
// 2.105.1 with injected fetch, storage and lock (processLock), and Bun's real BroadcastChannel standing in for the
// browser's. Two controllers on one storage are two tabs of one browser; a plain `createClient` configured as main's
// PrivateStaging configures it is a tab still running the old bundle during the rollout.
import { afterAll, beforeAll, expect, test } from "bun:test"
import { createClient, processLock, type Session } from "@supabase/supabase-js"
import { addEnded, LINEAGE_FIELD, readStored, stampLineage } from "./auth-lineage"
import { createAuthSessions, matchesSignedOut, SIGNED_OUT_ISSUE_SLACK_MS, type AuthSessionsOptions } from "./auth-sessions"
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
  let logoutHold: Promise<void> | null = null, releaseLogout = () => {}
  let pkceHold: Promise<void> | null = null, releasePkce = () => {}
  let logoutFails = false
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
    if (grant === "pkce") { if (pkceHold) await pkceHold; return body.auth_code === "good-code" && body.code_verifier ? json(200, signIn(UB)) : json(400, { error_code: "flow_state_not_found", msg: "invalid flow state" }) }
    if (grant === "refresh_token") {
      // As GoTrue: the server answers at once (a held refresh only delays the answer on its way back).
      const entry = [...sessions.entries()].find(([, s]) => s.current === body.refresh_token || s.parent === body.refresh_token)
      const answer = !entry || entry[1].revoked ? json(400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }) : json(200, issue(entry[0], 3600, entry[1].current === body.refresh_token))
      if (hold) await hold
      return answer
    }
    if (url.pathname.endsWith("/otp")) return json(200, {})
    if (url.pathname.endsWith("/logout")) {
      if (logoutFails) throw new TypeError("Failed to fetch")
      if (logoutHold) await logoutHold
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
    failLogouts() { logoutFails = true },
    holdLogouts() { logoutHold = new Promise(resolve => { releaseLogout = resolve }) },
    releaseLogouts() { releaseLogout(); logoutHold = null },
    holdPkce() { pkceHold = new Promise(resolve => { releasePkce = resolve }) },
    releasePkce() { releasePkce(); pkceHold = null },
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
  // Nothing but its boot's "none" is reported while its own sign-in is in flight.
  expect(one.reported).toEqual([null])
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

// ---------- WO-14c QA round: D11, D10 and the gaps the mutation check found ----------

/** Removes `nv_lineage` from the stored session in place, as a tab on main's code writes it (same tokens). */
function unstamp(storage: ReturnType<typeof sharedStorage>, key: string) {
  const value = JSON.parse(storage.getItem(key)!)
  delete value[LINEAGE_FIELD]
  storage.setItem(key, JSON.stringify(value))
}

test("D11: sign-out clicked as an unstamped write lands: the quiet re-read adopts it without onAdopt or a report, and nothing reopens the tab", async () => {
  for (const logout of ["stalled", "ok"] as const) {
    const key = freshKey(), storage = sharedStorage(), server = authServer()
    const t = tab(storage, server, key)
    await t.sessions.boot()
    expect(await t.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
    const reportedBefore = t.reported.length
    if (logout === "stalled") server.holdLogouts()
    // In the same task as the click: the stored session is rewritten without nv_lineage (QA's deterministic D11 case).
    unstamp(storage, key)
    const signingOut = t.sessions.signOut()
    await sleep(50)
    t.sessions.sync()
    await sleep(50)
    // No onAdopt (the page's sign-out gate stays shut), and no session reported (only "none" once it is removed).
    expect(t.adopted()).toBe(0)
    expect(t.reported.slice(reportedBefore).filter(token => token !== null)).toEqual([])
    // The logout went out once, with the session's token, from the generation that now serves it.
    expect(server.calls.filter(call => call.path.endsWith("/logout"))).toHaveLength(1)
    if (logout === "stalled") server.releaseLogouts()
    expect((await signingOut).error).toBeNull()
    expect(storage.getItem(key)).toBeNull()
    expect(t.adopted()).toBe(0)
    expect(t.reported.slice(reportedBefore)).toEqual([null])
    t.sessions.dispose()
  }
})

test("D10: a signed-out tab neither stamps nor adopts an old-code tab's late refresh of the session it signed out", async () => {
  for (const logout of ["ok", "refused"] as const) {
    const key = freshKey(), storage = sharedStorage(), server = authServer()
    const old = oldTab(storage, server, key)
    expect((await old.client.auth.signInWithPassword({ email: `${UA}@example.test`, password: "x" })).error).toBeNull()
    const fresh = tab(storage, server, key)
    await fresh.sessions.boot()
    // The old tab's refresh reaches the server (which issues new tokens) but its answer is held.
    server.holdRefreshes()
    const late = old.client.auth.refreshSession()
    await until(() => server.refreshCalls().length === 1)
    if (logout === "refused") server.failLogouts()
    const reportedBefore = fresh.reported.length
    const result = await fresh.sessions.signOut()
    if (logout === "ok") { expect(result.error).toBeNull(); expect(storage.getItem(key)).toBeNull() }
    // Refused (no answer): as on main, the client reports the error and the stored session stays.
    else { expect(result.error).toMatchObject({ name: "AuthRetryableFetchError" }); expect(storage.getItem(key)).not.toBeNull() }
    // The old tab's late answer lands: an unstamped session of the user just signed out here.
    server.release()
    expect((await late).error).toBeNull()
    expect(lineageOf(storage, key)).toBeNull()
    fresh.sessions.sync()
    await sleep(20)
    expect(fresh.adopted()).toBe(0)
    expect(fresh.reported.slice(reportedBefore).filter(token => token !== null)).toEqual([])
    // Not stamped by the signed-out tab.
    expect(lineageOf(storage, key)).toBeNull()
    fresh.sessions.dispose()
    await old.client.auth.stopAutoRefresh()
  }
})

test("D10 control: after a sign-out, a genuinely new sign-in reopens the tab: same user in an old-code tab later, or another user in a new-code tab", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const fresh = tab(storage, server, key)
  await fresh.sessions.boot()
  expect(await fresh.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  expect((await fresh.sessions.signOut()).error).toBeNull()
  // Another user signs in in another new-code tab at once: adopted.
  const other = tab(storage, server, key)
  await other.sessions.boot()
  expect(await other.sessions.signIn(`${UB}@example.test`, "x")).toBe("signed-in")
  fresh.sessions.sync()
  expect(fresh.adopted()).toBe(1)
  expect(fresh.reported.at(-1)).toBe(JSON.parse(storage.getItem(key)!).access_token)
  // That user signs out there; later the first user signs in again in an old-code tab (a new server session): adopted.
  expect((await fresh.sessions.signOut()).error).toBeNull()
  await sleep(2_100)
  const old = oldTab(storage, server, key)
  expect((await old.client.auth.signInWithPassword({ email: `${UA}@example.test`, password: "x" })).error).toBeNull()
  fresh.sessions.sync()
  expect(fresh.adopted()).toBe(2)
  expect(lineageOf(storage, key)).toBe(fresh.sessions.generation.lineage)
  expect(fresh.reported.at(-1)).toBe(JSON.parse(storage.getItem(key)!).access_token)
  fresh.sessions.dispose(); other.sessions.dispose()
  await old.client.auth.stopAutoRefresh()
}, 10_000)

test("a sign-in elsewhere landing during a slow sign-out isn't adopted until the sign-out settles (its logout isn't aborted)", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const one = tab(storage, server, key), two = tab(storage, server, key)
  await one.sessions.boot(); await two.sessions.boot()
  expect(await one.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  const signingOutGeneration = one.sessions.generation
  server.holdLogouts()
  const signingOut = one.sessions.signOut()
  await until(() => server.calls.some(call => call.path.endsWith("/logout")))
  expect(await two.sessions.signIn(`${UB}@example.test`, "x")).toBe("signed-in")
  one.sessions.sync()
  expect(one.adopted()).toBe(0)
  expect(signingOutGeneration.retired).toBe(false)
  server.releaseLogouts()
  // The logout reached the server; the removal finds B's session (another lineage) and is refused, so B's session stays.
  await signingOut.catch(() => null)
  expect([...server.sessions.values()][0]!.revoked).toBe(true)
  expect(JSON.parse(storage.getItem(key)!).user.id).toBe(UB)
  // Then B's sign-in is adopted.
  expect(one.adopted()).toBe(1)
  expect(one.sessions.generation.lineage).toBe(two.sessions.generation.lineage)
  one.sessions.dispose(); two.sessions.dispose()
})

test("a retired current generation is replaced on the next read, even when the stored session is its own lineage", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  storage.setItem(key, stampLineage(legacy(server.signIn(UA)), LA)!)
  const t = tab(storage, server, key)
  await t.sessions.boot()
  const first = t.sessions.generation
  first.retire()
  await sleep(5)
  const next = t.sessions.generation
  expect(next).not.toBe(first)
  expect(next.retired).toBe(false)
  expect(next.lineage).toBe(LA)
  t.sessions.dispose()
})

test("F-B: while the email link's code is being exchanged, another tab's sign-in isn't adopted; the link's session wins", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  storage.setItem(`${key}-code-verifier`, JSON.stringify("verifier-of-this-browser"))
  location.href = "https://app.example.test/?code=good-code"
  try {
    server.holdPkce()
    const t = tab(storage, server, key, { search: "?code=good-code" })
    const booting = t.sessions.boot()
    await until(() => server.calls.some(call => call.grant === "pkce"))
    const linkGeneration = t.sessions.generation
    const other = tab(storage, server, key)
    await other.sessions.boot()
    expect(await other.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
    t.sessions.sync()
    expect(t.adopted()).toBe(0)
    expect(linkGeneration.retired).toBe(false)
    server.releasePkce()
    await booting
    expect(JSON.parse(storage.getItem(key)!).user.id).toBe(UB)
    expect(lineageOf(storage, key)).toBe(linkGeneration.lineage)
    t.sessions.dispose(); other.sessions.dispose()
  } finally { location.href = "https://app.example.test/" }
})

test("a sign-in link is sent from a live generation even when the current one has retired", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const t = tab(storage, server, key)
  await t.sessions.boot()
  t.sessions.generation.retire()
  await sleep(5)
  const { error } = await t.sessions.sendSignInLink(`${UA}@example.test`, "https://app.example.test/")
  expect(error).toBeNull()
  expect(server.calls.filter(call => call.path.endsWith("/otp"))).toHaveLength(1)
  expect(storage.getItem(`${key}-code-verifier`)).not.toBeNull()
  t.sessions.dispose()
})

test("a stored value without a user ID isn't a session: nothing is reported", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const noUser = { ...server.signIn(UA) } as Record<string, unknown>
  delete noUser.user
  storage.setItem(key, stampLineage(JSON.stringify(noUser), LA)!)
  const t = tab(storage, server, key)
  await t.sessions.boot()
  expect(t.reported).toEqual([null])
  t.sessions.dispose()
})

test("matchesSignedOut: the same lineage, refresh token or server session, or the same user issued by the sign-out; nothing else", () => {
  const at = Date.parse("2026-11-12T10:00:00Z")
  const jwt = (sessionId: string) => `h.${btoa(JSON.stringify({ sub: UA, session_id: sessionId })).replace(/=+$/, "")}.s`
  const out = { lineage: LA, userId: UA, refreshToken: "r-signed-out", serverSession: null as string | null, at }
  const session = (overrides: Record<string, unknown> = {}) => ({ access_token: "a", refresh_token: "r-other", token_type: "bearer", expires_in: 3600, expires_at: Math.floor((at + 60_000) / 1000) + 3600, user: { id: UB }, ...overrides }) as unknown as Session
  // Each rule on its own.
  expect(matchesSignedOut(out, session(), LA)).toBe(true)
  expect(matchesSignedOut(out, session({ refresh_token: "r-signed-out" }), null)).toBe(true)
  expect(matchesSignedOut(out, session({ user: { id: UA }, expires_at: Math.floor((at - 5_000) / 1000) + 3600 }), null)).toBe(true)
  expect(matchesSignedOut(out, session({ user: { id: UA }, expires_at: Math.floor((at + SIGNED_OUT_ISSUE_SLACK_MS - 1_000) / 1000) + 3600 }), null)).toBe(true)
  expect(matchesSignedOut(out, session({ user: { id: UA }, expires_in: undefined }), null)).toBe(true)
  // Not the signed-out session: another user; the same user issued later; another lineage.
  expect(matchesSignedOut(out, session(), "bbbbbbbb-2222-4222-8222-000000000002")).toBe(false)
  expect(matchesSignedOut(out, session({ user: { id: UA } }), null)).toBe(false)
  expect(matchesSignedOut(out, session(), null)).toBe(false)
  // With server session IDs (Supabase JWTs) the server session decides, whatever the issue time says.
  const withId = { ...out, serverSession: "s-1" }
  expect(matchesSignedOut(withId, session({ user: { id: UA }, access_token: jwt("s-1") }), null)).toBe(true)
  expect(matchesSignedOut(withId, session({ user: { id: UA }, access_token: jwt("s-2"), expires_at: Math.floor((at - 5_000) / 1000) + 3600 }), null)).toBe(false)
})

test("D11: during a stalled sign-out, the signed-out lineage refreshed by another tab is not reported here", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const one = tab(storage, server, key)
  await one.sessions.boot()
  expect(await one.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  const two = tab(storage, server, key)
  await two.sessions.boot()
  expect(two.sessions.generation.lineage).toBe(one.sessions.generation.lineage)
  server.holdLogouts()
  const signingOut = one.sessions.signOut()
  await until(() => server.calls.some(call => call.path.endsWith("/logout")))
  const reportedBefore = one.reported.length
  // A refresh of the same lineage lands meanwhile (tab two, which shares the lineage's lock, after stealing it): a new token
  // under the signed-out lineage. Tab one doesn't report it, nor adopt anything.
  const value = JSON.parse(storage.getItem(key)!)
  storage.setItem(key, JSON.stringify({ ...value, access_token: "refreshed-meanwhile", refresh_token: "r-meanwhile" }))
  one.sessions.sync()
  expect(one.reported.slice(reportedBefore)).toEqual([])
  expect(one.adopted()).toBe(0)
  server.releaseLogouts()
  await signingOut.catch(() => null)
  one.sessions.dispose(); two.sessions.dispose()
})

test("a genuine adoption ends what the last sign-out kept closed: the first user signing in again soon after is adopted too", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const one = tab(storage, server, key), two = tab(storage, server, key)
  await one.sessions.boot(); await two.sessions.boot()
  expect(await one.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  expect((await one.sessions.signOut()).error).toBeNull()
  // B signs in in tab two: tab one opens (genuine adoption); B signs out there.
  expect(await two.sessions.signIn(`${UB}@example.test`, "x")).toBe("signed-in")
  one.sessions.sync()
  expect(one.adopted()).toBe(1)
  expect((await two.sessions.signOut()).error).toBeNull()
  one.sessions.sync()
  // A signs in again in tab two at once (within the issue-time slack of A's sign-out in tab one): tab one opens again.
  expect(await two.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  one.sessions.sync()
  expect(one.adopted()).toBe(2)
  expect(one.reported.at(-1)).toBe(JSON.parse(storage.getItem(key)!).access_token)
  one.sessions.dispose(); two.sessions.dispose()
})

test("a stored session of an ended lineage (E) is dropped at boot and on a later read, and never reported", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  storage.setItem(key, stampLineage(legacy(server.signIn(UA)), LA)!)
  addEnded(storage, { lineage: LA, userId: UA }, Date.now())
  const t = tab(storage, server, key)
  await t.sessions.boot()
  expect(storage.getItem(key)).toBeNull()
  expect(t.reported).toEqual([null])
  expect(t.sessions.generation.lineage).toBeNull()
  // Written again later (a lagging tab): dropped on the next read.
  storage.setItem(key, stampLineage(legacy(server.signIn(UA)), LA)!)
  t.sessions.sync()
  expect(storage.getItem(key)).toBeNull()
  expect(t.reported).toEqual([null])
  expect(t.adopted()).toBe(0)
  t.sessions.dispose()
})

test("D10/D11: after a refused logout, the signed-out session (still stored) refreshed by another tab is never reported here", async () => {
  const key = freshKey(), storage = sharedStorage(), server = authServer()
  const t = tab(storage, server, key)
  await t.sessions.boot()
  expect(await t.sessions.signIn(`${UA}@example.test`, "x")).toBe("signed-in")
  server.failLogouts()
  expect((await t.sessions.signOut()).error).toMatchObject({ name: "AuthRetryableFetchError" })
  // As on main, a refused logout leaves the session stored. Another tab of the same lineage refreshes it.
  const value = JSON.parse(storage.getItem(key)!)
  storage.setItem(key, JSON.stringify({ ...value, access_token: "refreshed-later", refresh_token: "r-later" }))
  const reportedBefore = t.reported.length
  t.sessions.sync()
  expect(t.reported.slice(reportedBefore)).toEqual([])
  expect(t.adopted()).toBe(0)
  t.sessions.dispose()
})
