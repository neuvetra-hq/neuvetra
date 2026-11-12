/**
 * WO-14a (step 2 of the CTO's WO-14 sign-out design, §2; Claude, 12 November 2026): a **generation** is one Supabase
 * client whose fetch, storage and lock belong to it alone, tied to one lineage (see `auth-lineage.ts`). Nothing in the app
 * uses this module yet; `PrivateStaging.tsx` still makes its single client as before.
 *
 * WO-14b (CTO Addendum A, CEO Addendum B): hardened.
 * - **The fetch decides first (A2 iv).** Every Supabase Auth answer is read in full by the generation's fetch. In the same
 *   task in which auth-js will then act on it (from `json()` to `_saveSession`'s `setItem` or `_removeSession`'s
 *   `removeItem` is microtasks only), the fetch checks: retired → a synthetic 503; a session that the storage would refuse
 *   to store, or (on a refresh) an error that would remove a session the storage would refuse to remove → the generation
 *   retires and answers 503. auth-js treats a 503 as retryable: nothing is stored, removed, notified or broadcast, nothing
 *   is logged, and no promise rejects. Otherwise auth-js gets a Response-shaped object whose `json()` is ready at once.
 * - **The storage throws as a backstop.** `setItem`/`removeItem` still refuse by throwing. If that ever fires, the fetch's
 *   check has a bug; auth-js then rejects an internal promise, which a browser reports as an unhandled rejection (wanted:
 *   the suite's "no page error" check catches it).
 * - **Only its own lineage (R1).** `getItem` hands the client only its own lineage's session, so a generation never sends
 *   another lineage's refresh token.
 * - **The code verifier (R2).** A non-deliberate generation never removes `<key>-code-verifier` (silently: a throw there
 *   would reject `_saveSession`), so a refresh never breaks another tab's email link.
 * - **One deliberate write (L1).** A sign-in generation may replace another lineage's session once, with the sign-in's own
 *   session: the write must carry the answer to a sign-in request (never `grant_type=refresh_token`), and after it the
 *   generation is non-deliberate. A refresh is never deliberate, whatever the generation.
 * - **The lock (A3, F2).** The base lock is held until the work ends or `retire()`, whichever is first; after retire the
 *   work runs unlocked and inert. Its name carries the lineage, so generations of different lineages never wait for each
 *   other (a generation only ever refreshes its own lineage's session, R1); a lock stolen from running work doesn't fail
 *   that work.
 * - **`retire()` (A4)** stops auto-refresh again on the next macrotask after a pending initialize settles.
 */
import { createClient, navigatorLock, type SupabaseClient, type AuthChangeEvent, type Session } from "@supabase/supabase-js"
import { decideGet, decideRemove, decideSet, isLineage, readEnded, readStored, wouldRefuseRemove, wouldRefuseSet, type GenerationState, type RefusalReason } from "./auth-lineage"

/** Thrown by a generation's storage when it refuses a read-write it must never make (the backstop). Not an AuthError. */
export class RetiredGeneration extends Error {
  readonly reason: RefusalReason
  constructor(reason: RefusalReason = "retired") { super(`Auth generation refused: ${reason}`); this.name = "RetiredGeneration"; this.reason = reason }
}

export type LockFunction = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => Promise<R>
type SyncStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">
type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** Statuses auth-js treats as network failures (retryable, never a removal): `lib/fetch.ts` NETWORK_ERROR_CODES. */
const NETWORK_ERROR_CODES = [502, 503, 504, 520, 521, 522, 523, 524, 530]

export interface GenerationOptions {
  url: string
  anonKey: string
  storageKey: string
  /** The lineage this generation serves (a UUID); null on the landing page (it then never stores or sees a session). */
  lineage: string | null
  /** A sign-in (password, or the PKCE exchange): its one session write may replace another lineage's stored session. */
  deliberate: boolean
  /** Only the boot generation reads a sign-in from the address. */
  detectSessionInUrl?: boolean
  /** Defaults: localStorage, the global fetch, navigatorLock, Date.now. Tests inject their own. */
  storage?: SyncStorage
  fetch?: Fetch
  lock?: LockFunction
  now?: () => number
}

export interface Generation {
  readonly id: number
  readonly client: SupabaseClient
  readonly lineage: string | null
  /** True until the sign-in's own session is written (L1). */
  readonly deliberate: boolean
  readonly retired: boolean
  /** The last session value this generation wrote (for the repair rule), or null. */
  readonly lastWritten: string | null
  /** Subscribes to the client's auth events while the generation is live; retiring unsubscribes. */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void
  retire(): void
}

/** A Response-shaped answer whose body is already read: `json()` settles in a microtask (a real Response needs a task). */
function bufferedResponse(status: number, statusText: string, headers: Headers, text: string): Response {
  const answer = {
    ok: status >= 200 && status < 300, status, statusText, headers,
    json: async () => JSON.parse(text) as unknown,
    text: async () => text,
  }
  return answer as unknown as Response
}
const unavailable = () => bufferedResponse(503, "Service Unavailable", new Headers(), "{}")

function sessionBody(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const { access_token: access, refresh_token: refresh, expires_in: expiresIn } = value as Record<string, unknown>
  return Boolean(access && refresh && expiresIn)
}

let nextId = 0

export function createGeneration(options: GenerationOptions): Generation {
  // F3: a lineage is a UUID; anything else would write a session that can never be recognised or ended.
  if (options.lineage !== null && !isLineage(options.lineage)) throw new TypeError("A generation's lineage must be a UUID.")
  const id = ++nextId
  const storage = options.storage ?? globalThis.localStorage
  const baseFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const baseLock = options.lock ?? (navigatorLock as LockFunction)
  const now = options.now ?? Date.now
  const sessionKey = options.storageKey
  const verifierKey = `${sessionKey}-code-verifier`
  const authUrl = `${options.url.replace(/\/+$/, "")}/auth/v1/`
  const abort = new AbortController()
  let markRetired: () => void = () => {}
  const retiredSignal = new Promise<void>(resolve => { markRetired = resolve })
  const subscriptions = new Set<() => void>()
  const state: GenerationState = { retired: false, deliberate: options.deliberate, lineage: options.lineage ? options.lineage.toLowerCase() : null, lastWritten: null }

  const refuse = (reason: RefusalReason): never => { throw new RetiredGeneration(reason) }
  /**
   * L1: whether the session auth-js is about to write is a sign-in's answer. Set by the fetch when it passes a sign-in
   * answer on, and read by the storage in the same task (microtasks only in between); any write consumes it.
   */
  let signInAnswer = false
  /** The generation as the storage judges the next write: deliberate only for a sign-in's own answer. */
  const writing = (): GenerationState => ({ ...state, deliberate: state.deliberate && signInAnswer })

  const genStorage: SyncStorage = {
    getItem(key) {
      if (key !== sessionKey) return state.retired ? null : storage.getItem(key)
      const stored = storage.getItem(key)
      const decision = decideGet(state, stored, readEnded(storage, now()))
      switch (decision.kind) {
        case "none": return null
        case "value": return decision.value
        case "drop":
          // Lineage-bound: only while the key still holds that ended lineage.
          if (readStored(storage.getItem(key))?.lineage === decision.lineage) storage.removeItem(key)
          return null
        case "repair":
          storage.setItem(key, decision.value)
          return decision.value
      }
    },
    setItem(key, value) {
      if (key !== sessionKey) { if (state.retired) refuse("retired"); storage.setItem(key, value); return }
      const judged = writing()
      signInAnswer = false
      const decision = decideSet(judged, value, storage.getItem(key), readEnded(storage, now()))
      if (decision.kind === "refuse") {
        if (decision.retire) generation.retire()
        refuse(decision.reason)
        return
      }
      storage.setItem(key, decision.value)
      state.lastWritten = decision.value
      // L1: the deliberate privilege covered the sign-in's own write and ends with it.
      if (judged.deliberate) state.deliberate = false
    },
    removeItem(key) {
      if (key === verifierKey) {
        if (state.retired) refuse("retired")
        // R2: only a sign-in removes the verifier (auth-js does so before saving the sign-in's session); a refresh never
        // does, silently: a throw here would reject `_saveSession`.
        if (writing().deliberate) storage.removeItem(key)
        return
      }
      if (key !== sessionKey) { if (state.retired) refuse("retired"); storage.removeItem(key); return }
      const decision = decideRemove(state, storage.getItem(key))
      if (decision.kind === "refuse") refuse(decision.reason)
      if (decision.kind === "remove") { storage.removeItem(key); state.lastWritten = null }
    },
  }

  const genFetch: Fetch = async (input, init) => {
    if (state.retired) return unavailable()
    const url = input instanceof Request ? input.url : String(input)
    const signals = [init?.signal, abort.signal].filter((signal): signal is AbortSignal => Boolean(signal))
    let response: Response, text: string
    try {
      response = await baseFetch(input, { ...init, signal: signals.length > 1 ? AbortSignal.any(signals) : abort.signal })
      if (!url.startsWith(authUrl)) return response
      text = await response.text()
    } catch (error) {
      if (state.retired) return unavailable()
      throw error
    }
    // From here to auth-js's storage call everything runs in this task (microtasks only): nothing can change in between.
    if (state.retired) return unavailable()
    let body: unknown = null, parsed = false
    try { body = JSON.parse(text); parsed = true } catch { body = null }
    // A 2xx JSON body that isn't an object would make auth-js's response handling throw a TypeError (not an AuthError),
    // which rejects promises nobody awaits; no real Supabase Auth answer looks like that.
    if (response.ok && parsed && (body === null || typeof body !== "object")) return unavailable()
    const stored = storage.getItem(sessionKey)
    const refresh = new URL(url).searchParams.get("grant_type") === "refresh_token"
    signInAnswer = false
    if (response.ok && sessionBody(body)) {
      // A refresh is never deliberate (L1); a sign-in's answer is, while the generation still is.
      const refusal = wouldRefuseSet(refresh ? { ...state, deliberate: false } : state, stored, readEnded(storage, now()))
      if (refusal) { generation.retire(); return unavailable() }
      signInAnswer = !refresh
      // Never beyond this task: auth-js writes it within the task (microtasks), or not at all.
      if (signInAnswer) setTimeout(() => { signInAnswer = false }, 0)
    }
    // On a refresh, auth-js removes the session after an error answer that isn't a network failure, or a 2xx without one.
    const removes = refresh && (response.ok ? !sessionBody(body) && body !== null : !NETWORK_ERROR_CODES.includes(response.status))
    if (removes && wouldRefuseRemove(state, stored)) { generation.retire(); return unavailable() }
    return bufferedResponse(response.status, response.statusText, response.headers, text)
  }

  /**
   * The base lock (navigatorLock in a browser) is held only while the generation is live: at retire() the lock callback
   * returns at once, which releases the lock, while auth-js's own call still waits for its work (now inert) to finish.
   * Once retired, auth-js's work runs without taking the lock at all: its storage reads nothing and its fetch never reaches
   * the network, so it settles quietly. (Rejecting instead would surface as unhandled rejections: auth-js's auto-refresh
   * tick rethrows any lock error that isn't an acquire timeout, and `_startAutoRefresh` awaits initialize from a timer.)
   *
   * F2: the lock's name carries the lineage. A generation only ever refreshes its own lineage's session (R1), so the tabs
   * that need to coordinate refreshes are those of one lineage; a held refresh of A's generation never makes B's sign-in
   * generation wait the 5 s acquire timeout and steal. And when another request steals the lock from work that is
   * already running (navigatorLock after its timeout), the work's own result is returned rather than the steal error.
   */
  const lockSuffix = state.lineage ?? `none-${id}`
  const genLock: LockFunction = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
    if (state.retired) return fn()
    let work: Promise<R> | null = null
    const held = baseLock<R | null>(`${name}:${lockSuffix}`, acquireTimeout, () => {
      if (state.retired) return Promise.resolve(null)
      work = fn()
      return Promise.race([work, retiredSignal.then(() => null)])
    })
    return held.then(() => work ?? fn(), (error: unknown) => {
      if (work) return work
      throw error
    })
  }

  const client = createClient(options.url, options.anonKey, {
    global: { fetch: genFetch as typeof fetch },
    auth: { storageKey: sessionKey, storage: genStorage, lock: genLock, persistSession: true, autoRefreshToken: true, flowType: "pkce", detectSessionInUrl: options.detectSessionInUrl ?? false },
  })

  const generation: Generation = {
    id,
    client,
    lineage: state.lineage,
    get deliberate() { return state.deliberate },
    get retired() { return state.retired },
    get lastWritten() { return state.lastWritten },
    onAuthStateChange(callback) {
      if (state.retired) return () => {}
      const { data } = client.auth.onAuthStateChange((event, session) => { if (!state.retired) callback(event, session) })
      const unsubscribe = () => { data.subscription.unsubscribe(); subscriptions.delete(unsubscribe) }
      subscriptions.add(unsubscribe)
      return unsubscribe
    },
    retire() {
      if (state.retired) return
      state.retired = true
      abort.abort()
      markRetired()
      void client.auth.stopAutoRefresh().catch(() => {})
      // A4: an initialize still in flight restarts the ticker and the visibility listener in its `finally`; once it has
      // settled, stop both again on the next macrotask (after `_startAutoRefresh`'s own microtasks have set the ticker).
      void client.auth.initialize().catch(() => null)
        .then(() => new Promise<void>(resolve => { setTimeout(resolve, 0) }))
        .then(() => client.auth.stopAutoRefresh()).catch(() => {})
      for (const unsubscribe of [...subscriptions]) unsubscribe()
    },
  }
  return generation
}
