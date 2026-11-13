/**
 * WO-14c (step 4 of the CTO's WO-14 design; Claude, 12 November 2026): the page's Supabase sessions through auth
 * generations. `PrivateStaging.tsx` uses this instead of one long-lived Supabase client.
 *
 * - **One current generation per tab.** At boot it serves the stored session's lineage (a session stored before WO-14,
 *   without `nv_lineage`, is stamped first: `adoptLegacy`, Addendum A R3), or none. When the URL carries a sign-in link's
 *   `?code=`, the boot generation is deliberate, with a fresh lineage, and is the only one that reads the address (F-B).
 * - **The app reads the stored session itself** (`sync`), never through a client (Addendum A R1/step 4), and never awaits
 *   `getSession`/`refreshSession` on a generation. It reads it at boot (after the boot generation's initialize settles),
 *   on every auth event of the current generation (including those relayed from other tabs), on a `storage` event for the
 *   session key, and when the current generation retires itself. Then:
 *   - the current generation's own lineage → that session is reported (`onSession`);
 *   - another live lineage (another tab signed in, or a tab still on old code refreshed and the session was re-stamped) →
 *     a new generation adopts it (`onAdopt`, then `onSession`);
 *   - nothing → `onSession(null)`.
 *   While a sign-in is in flight, only the signing-in generation's own session counts.
 * - **Sign-in.** Every sign-in gets a new deliberate generation with a fresh lineage (F-C); the old one retires. An answer
 *   that arrives after its generation retired is discarded, not shown as an error.
 * - **Sign-out is unchanged** (design §6 step 4): `client.auth.signOut({ scope: "local" })` on the current generation,
 *   after `sync` has made sure the current generation is the stored session's own.
 */
import type { Session, SupabaseClient } from "@supabase/supabase-js"
import { adoptLegacy, dropEndedSession, newLineage, readEnded, readStored } from "./auth-lineage"
import { createGeneration, type Generation, type GenerationOptions, type LockFunction } from "./auth-generation"

type SyncStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export interface AuthSessionsOptions {
  url: string
  anonKey: string
  storageKey: string
  /** The page address's query string at load (`?code=` makes the boot generation the email-link sign-in). */
  search: string
  /** The stored session as the app should treat it now (null: none). */
  onSession: (session: Session | null) => void
  /** Another tab's live session is being adopted (the app allows sign-in again before the session is reported). */
  onAdopt?: () => void
  storage?: SyncStorage
  fetch?: GenerationOptions["fetch"]
  lock?: LockFunction
  now?: () => number
}

export type SignInOutcome = "signed-in" | "failed" | "discarded"

/** A stored value that auth-js would accept as a session (the shape `_isValidSession` checks, plus a user ID). */
function storedSession(raw: string | null): Session | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    const user = record.user && typeof record.user === "object" ? record.user as Record<string, unknown> : null
    if (typeof record.access_token !== "string" || typeof record.refresh_token !== "string" || typeof record.expires_at !== "number" || typeof user?.id !== "string") return null
    return value as Session
  } catch { return null }
}

export function createAuthSessions(options: AuthSessionsOptions) {
  const storage: SyncStorage = options.storage ?? globalThis.localStorage
  const now = options.now ?? Date.now
  const key = options.storageKey
  let disposed = false
  let current!: Generation
  /** The generation whose sign-in is in flight (only its own session counts until it settles). */
  let signingIn: Generation | null = null
  /**
   * The access token last reported (null: "no session"; undefined: nothing reported yet). The same session read again
   * (an auth event and a storage event for one write, a sign-in's own event and its settling) is reported once, as the
   * single client's events reported it once before WO-14.
   */
  let reported: string | null | undefined = undefined
  function report(session: Session | null, always = false) {
    const token = session?.access_token ?? null
    if (!always && token === reported) return
    reported = token
    options.onSession(session)
  }

  function make(lineage: string | null, deliberate: boolean, detectSessionInUrl = false): Generation {
    const made = createGeneration({
      url: options.url, anonKey: options.anonKey, storageKey: key, lineage, deliberate, detectSessionInUrl,
      storage, fetch: options.fetch, lock: options.lock, now,
      // A generation that retires itself (a refused answer) leaves the page to re-read the stored session.
      onRetire: retired => { if (!disposed && retired === current) sync() },
    })
    // The event's own session is never used: the stored session is read instead. INITIAL_SESSION is only the client's
    // view at its start, which `boot` and `sync` cover.
    made.onAuthStateChange(event => { if (event !== "INITIAL_SESSION" && made === current) sync() })
    return made
  }
  function replace(next: Generation) {
    const previous = current
    current = next
    if (previous && previous !== next) previous.retire()
  }

  /** Reads the stored session and brings the page in line with it. Synchronous; safe to call at any time. */
  function sync(): void {
    if (disposed) return
    const ended = readEnded(storage, now())
    dropEndedSession(storage as Pick<Storage, "getItem" | "removeItem">, key, ended)
    // A session without a lineage (stored before WO-14, or refreshed by a tab still on old code) is stamped first.
    adoptLegacy(storage, key, ended)
    const raw = storage.getItem(key)
    const session = storedSession(raw)
    const lineage = session ? readStored(raw)?.lineage ?? null : null
    if (signingIn) {
      // Only the signing-in generation's own session counts while its answer is awaited.
      if (session && lineage && lineage === signingIn.lineage && !signingIn.retired) report(session)
      return
    }
    if (!session || !lineage) { report(null); return }
    if (!current.retired && current.lineage === lineage) { report(session); return }
    replace(make(lineage, false))
    options.onAdopt?.()
    report(session, true)
  }

  /** Creates the boot generation and reports the stored session once its initialize (and any refresh) has settled. */
  async function boot(): Promise<void> {
    const fromLink = /[?&]code=/.test(options.search)
    if (fromLink) {
      // F-B: the email link's one-time code is exchanged by a deliberate generation, so its session may replace another.
      current = make(newLineage(), true, true)
    } else {
      const ended = readEnded(storage, now())
      dropEndedSession(storage as Pick<Storage, "getItem" | "removeItem">, key, ended)
      const adopted = adoptLegacy(storage, key, ended)
      current = make(adopted.kind === "existing" || adopted.kind === "stamped" ? adopted.lineage : null, false)
    }
    const booting = current
    // An email link's exchange is a sign-in in flight: no other session is adopted until it settles.
    if (fromLink) signingIn = booting
    try { await booting.client.auth.initialize() } finally { if (signingIn === booting) signingIn = null }
    if (!disposed && booting === current) sync()
  }

  /** A password sign-in on a new deliberate generation. */
  async function signIn(email: string, password: string): Promise<SignInOutcome> {
    const signing = make(newLineage(), true)
    replace(signing)
    signingIn = signing
    try {
      const { error } = await signing.client.auth.signInWithPassword({ email, password })
      if (signing.retired || signing !== current) return "discarded"
      return error ? "failed" : "signed-in"
    } finally {
      if (signingIn === signing) signingIn = null
      if (!disposed && signing === current) sync()
    }
  }

  /** Sends a sign-in link (the PKCE verifier is kept in this browser for the link). */
  async function sendSignInLink(email: string, redirectTo: string): Promise<{ error: unknown }> {
    if (current.retired) replace(make(null, false))
    const sending = current
    const { error } = await sending.client.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
    return { error }
  }

  /** Sign-out exactly as before WO-14 (design §6 step 4), on the generation that serves the stored session. */
  async function signOut(): Promise<{ error: unknown }> {
    sync()
    return current.client.auth.signOut({ scope: "local" })
  }

  return {
    boot, sync, signIn, sendSignInLink, signOut,
    /** The current generation's client (for tests and diagnostics; the app never awaits its session methods). */
    get client(): SupabaseClient { return current.client },
    get generation(): Generation { return current },
    dispose() { disposed = true; current?.retire() },
  }
}
