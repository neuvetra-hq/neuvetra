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
import type { Session } from "@supabase/supabase-js"
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

/** Supabase access tokens are JWTs carrying the server session's ID; anything else (a test stub's token) has none. */
function serverSessionId(accessToken: string | null | undefined): string | null {
  const payload = accessToken?.split(".")[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="))
    const id = (JSON.parse(json) as { session_id?: unknown }).session_id
    return typeof id === "string" && id ? id : null
  } catch { return null }
}

/** The session signed out in this tab (kept in memory until a deliberate sign-in here or a genuine adoption). */
interface SignedOut { lineage: string | null; userId: string | null; refreshToken: string | null; serverSession: string | null; at: number }
/** How far after the click a session of the same user still counts as the one signed out (when no server session ID is known). */
export const SIGNED_OUT_ISSUE_SLACK_MS = 2_000

/**
 * WO-14c (QA D10/D11): whether a stored session is the one signed out in this tab, or a late write of it (a refresh by a tab
 * on old code, re-stamped by this or another tab): the same lineage, the same refresh token, the same server session (JWT
 * `session_id`), or, without a server session ID, the same user with tokens issued before the sign-out (plus a little
 * slack for a refresh that was already on its way). A new sign-in (another user, or the same user later) doesn't match.
 */
export function matchesSignedOut(out: SignedOut, session: Session, lineage: string | null): boolean {
  if (out.lineage && lineage === out.lineage) return true
  if (out.refreshToken && session.refresh_token === out.refreshToken) return true
  const id = serverSessionId(session.access_token)
  if (id && out.serverSession) return id === out.serverSession
  if (!out.userId || session.user?.id !== out.userId) return false
  const issuedAt = typeof session.expires_at === "number" && typeof session.expires_in === "number" ? (session.expires_at - session.expires_in) * 1000 : null
  return issuedAt === null || issuedAt <= out.at + SIGNED_OUT_ISSUE_SLACK_MS
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
  /** A sign-out is in flight in this tab: nothing is adopted until it settles (its logout is never aborted). */
  let signingOut = false
  /**
   * What this tab signed out (D10/D11). Until a deliberate sign-in here, or the adoption of a genuinely new session from
   * another tab, that session (or a late write of it) never reopens this tab, is never stamped by it, and never lifts the
   * page's sign-out gate (`onAdopt`).
   */
  let signedOut: SignedOut | null = null
  function report(session: Session | null) {
    const token = session?.access_token ?? null
    if (token === reported) return
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

  /**
   * Reads the stored session and brings the page in line with it. Synchronous; safe to call at any time. `quiet` (used by
   * sign-out) only makes the current generation the stored session's own: it reports nothing and never calls `onAdopt`.
   */
  function sync(mode: { quiet?: boolean } = {}): void {
    if (disposed) return
    const ended = readEnded(storage, now())
    dropEndedSession(storage as Pick<Storage, "getItem" | "removeItem">, key, ended)
    const before = storage.getItem(key)
    const beforeSession = storedSession(before)
    // D10: a late, unstamped write of the session signed out here is not stamped (nor reported) by this tab.
    if (signedOut && beforeSession && !readStored(before)?.lineage && matchesSignedOut(signedOut, beforeSession, null)) return
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
    if (!session || !lineage) { if (!mode.quiet) report(null); return }
    // D10/D11: the session signed out here (or a late write of it) never reopens this tab.
    if (signedOut && matchesSignedOut(signedOut, session, lineage)) return
    // While a sign-out is in flight nothing is adopted: that would retire the signing-out generation and abort its logout.
    if (signingOut) return
    if (!current.retired && current.lineage === lineage) { if (!mode.quiet) report(session); return }
    replace(make(lineage, false))
    if (mode.quiet) return
    // A genuinely new session from another tab's sign-in: this tab opens again (design §1, difference 1).
    signedOut = null
    options.onAdopt?.()
    report(session)
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
    // A deliberate sign-in in this tab ends what its last sign-out kept closed.
    signedOut = null
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

  /**
   * Sign-out as before WO-14 (design §6 step 4): `client.auth.signOut({ scope: "local" })`, on the generation that serves the
   * stored session. The quiet sync only makes sure of that (D11: it never reopens the tab); what is signed out is kept so
   * that nothing but a new sign-in reopens this tab (D10).
   */
  async function signOut(): Promise<{ error: unknown }> {
    signedOut = null
    sync({ quiet: true })
    const raw = storage.getItem(key)
    const session = storedSession(raw)
    signedOut = { lineage: session ? readStored(raw)?.lineage ?? null : null, userId: session?.user?.id ?? null, refreshToken: session?.refresh_token ?? null, serverSession: serverSessionId(session?.access_token), at: now() }
    signingOut = true
    const signing = current
    try { return await signing.client.auth.signOut({ scope: "local" }) }
    finally {
      signingOut = false
      // Whatever arrived during the sign-out (another tab's new sign-in) is read now.
      if (!disposed) sync()
    }
  }

  return {
    boot, sync, signIn, sendSignInLink, signOut,
    /** The current generation's client (for tests and diagnostics; the app never awaits its session methods). */
    get client(): Generation["client"] { return current.client },
    get generation(): Generation { return current },
    dispose() { disposed = true; current?.retire() },
  }
}
