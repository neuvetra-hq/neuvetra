/**
 * WO-14a (step 2 of the CTO's WO-14 sign-out design, §2; Claude, 12 November 2026): a **generation** is one Supabase
 * client whose fetch, storage and lock belong to it alone, tied to one lineage (see `auth-lineage.ts`). Nothing in the app
 * uses this module yet; `PrivateStaging.tsx` still makes its single client as before.
 *
 * `retire()` makes a generation inert, so nothing it started can reach this browser's stored session afterwards:
 * - its fetch aborts what is in flight and rejects every later request without touching the network (auth-js turns the
 *   rejection into a retryable error, so its refresh retry loop spins without sending anything and gives up);
 * - its storage refuses every read and write by throwing. auth-js (2.105.1) writes a refreshed session with `_saveSession`
 *   and removes it with `_removeSession` before it notifies subscribers or posts on its BroadcastChannel, and a non-auth
 *   error thrown there stops both: a late answer writes nothing and broadcasts nothing, a late 400 emits no SIGNED_OUT;
 * - its lock releases at once, so a held refresh doesn't make the next client wait the lock timeout before stealing.
 *
 * One side effect of auth-js remains: when a refused write is a refresh's `_saveSession`, auth-js rejects its internal
 * refresh deferred with the RetiredGeneration error, and nothing awaits that promise, so a browser reports an unhandled
 * rejection (`auth-generation.test.ts` pins it). The wiring step has to decide how to treat it.
 *
 * A live generation's storage follows the lineage rules: it never stores a session of an ended lineage, a non-deliberate
 * generation never replaces another lineage's session, and it removes only its own lineage's session.
 */
import { createClient, navigatorLock, type SupabaseClient, type AuthChangeEvent, type Session } from "@supabase/supabase-js"
import { decideGet, decideRemove, decideSet, readEnded, readStored, type GenerationState, type RefusalReason } from "./auth-lineage"

/** Thrown by a generation's storage once it is retired or refuses a write (its fetch rejects with an AbortError instead). Not an AuthError. */
export class RetiredGeneration extends Error {
  readonly reason: RefusalReason
  constructor(reason: RefusalReason = "retired") { super(`Auth generation refused: ${reason}`); this.name = "RetiredGeneration"; this.reason = reason }
}

export type LockFunction = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>) => Promise<R>
type SyncStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">
type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface GenerationOptions {
  url: string
  anonKey: string
  storageKey: string
  /** The lineage this generation serves; null on the landing page (it then never stores a session). */
  lineage: string | null
  /** A sign-in (password, or the PKCE exchange): it may replace another lineage's stored session. */
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
  readonly deliberate: boolean
  readonly retired: boolean
  /** The last session value this generation wrote (for the repair rule), or null. */
  readonly lastWritten: string | null
  /** Subscribes to the client's auth events while the generation is live; retiring unsubscribes. */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void
  retire(): void
}

let nextId = 0

export function createGeneration(options: GenerationOptions): Generation {
  const storage = options.storage ?? globalThis.localStorage
  const baseFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const baseLock = options.lock ?? (navigatorLock as LockFunction)
  const now = options.now ?? Date.now
  const sessionKey = options.storageKey
  const abort = new AbortController()
  let markRetired: () => void = () => {}
  const retiredSignal = new Promise<void>(resolve => { markRetired = resolve })
  const subscriptions = new Set<() => void>()
  const state: GenerationState = { retired: false, deliberate: options.deliberate, lineage: options.lineage ? options.lineage.toLowerCase() : null, lastWritten: null }

  const refuse = (reason: RefusalReason): never => { throw new RetiredGeneration(reason) }

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
      const decision = decideSet(state, value, storage.getItem(key), readEnded(storage, now()))
      if (decision.kind === "refuse") {
        if (decision.retire) generation.retire()
        refuse(decision.reason)
        return
      }
      storage.setItem(key, decision.value)
      state.lastWritten = decision.value
    },
    removeItem(key) {
      if (key !== sessionKey) { if (state.retired) refuse("retired"); storage.removeItem(key); return }
      const decision = decideRemove(state, storage.getItem(key))
      if (decision.kind === "refuse") refuse(decision.reason)
      if (decision.kind === "remove") { storage.removeItem(key); state.lastWritten = null }
    },
  }

  const genFetch: Fetch = (input, init) => {
    if (state.retired) return Promise.reject(new DOMException("retired", "AbortError"))
    const signals = [init?.signal, abort.signal].filter((signal): signal is AbortSignal => Boolean(signal))
    return baseFetch(input, { ...init, signal: signals.length > 1 ? AbortSignal.any(signals) : abort.signal })
  }

  /**
   * The base lock (navigatorLock in a browser) is held only while the generation is live: at retire() the lock callback
   * returns at once, which releases the lock, while auth-js's own call still waits for its work (now inert) to finish.
   * Once retired, auth-js's work runs without taking the lock at all: its storage reads nothing and its fetch never reaches
   * the network, so it settles quietly. (Rejecting here instead, as design §2 sketches, would surface as unhandled
   * rejections: auth-js's auto-refresh tick rethrows any lock error that isn't an acquire timeout from a timer, and
   * `_startAutoRefresh` awaits the initialize promise from a timer.)
   */
  const genLock: LockFunction = <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
    if (state.retired) return fn()
    let work: Promise<R> | null = null
    const held = baseLock<R | null>(name, acquireTimeout, () => {
      if (state.retired) return Promise.resolve(null)
      work = fn()
      return Promise.race([work, retiredSignal.then(() => null)])
    })
    return held.then(() => work ?? fn())
  }

  const client = createClient(options.url, options.anonKey, {
    global: { fetch: genFetch as typeof fetch },
    auth: { storageKey: sessionKey, storage: genStorage, lock: genLock, persistSession: true, autoRefreshToken: true, flowType: "pkce", detectSessionInUrl: options.detectSessionInUrl ?? false },
  })

  const generation: Generation = {
    id: ++nextId,
    client,
    lineage: state.lineage,
    deliberate: state.deliberate,
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
      // An initialize still in flight restarts the auto-refresh ticker when it finishes: stop it again then.
      void client.auth.initialize().catch(() => null).then(() => client.auth.stopAutoRefresh()).catch(() => {})
      for (const unsubscribe of [...subscriptions]) unsubscribe()
    },
  }
  return generation
}
