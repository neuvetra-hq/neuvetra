import type { Session } from "@supabase/supabase-js"
import type { HostedWorkspaceActor } from "./workspace-api"
import type { StagingAccess } from "./staging-session"

export interface ActiveStagingSession {
  session: Session
  access: StagingAccess
  epoch: number
  controller: AbortController
  actor: HostedWorkspaceActor
}

/**
 * WO-05a (Claude, 11 November 2026): why the workspace isn't open. Each has its own screen.
 *   session_ended  the server answered 401 (or the sign-in ended without a deliberate sign-out): sign in again here.
 *   no_access      the server answered 403: the invitation or membership isn't active.
 *   unreachable    no usable answer (network failure, timeout, 5xx, 429, or a response that wasn't recognized).
 */
export type AccessProblem = "session_ended" | "no_access" | "unreachable"

export const ACCESS_TEXT = {
  checking: "Checking your access…",
  signIn: "Sign in with your invited account.",
  verified: "Workspace access verified.",
  sessionEnded: "Your session ended. Sign in again to continue.",
  noAccess: "Your access to this workspace isn’t active. Contact the person who invited you.",
  unreachable: "We couldn’t reach Neuvetra. Check your connection, then try again.",
  retrying: "We couldn’t reach Neuvetra — retrying.",
  reconnected: "Reconnected to Neuvetra.",
} as const

/**
 * The outcome of a failed access check. `transient` failures (no answer, a timeout, 408, 425, 429 or 5xx) may pass by
 * themselves, as during a deploy restart; every other failure is final. Anything that isn't an AccessCheckError is final.
 */
export class AccessCheckError extends Error {
  override readonly name = "AccessCheckError"
  /** `retryAfterMs`: the server's Retry-After on a 429/503, already capped (see retryAfterMs). */
  constructor(readonly problem: AccessProblem, readonly transient: boolean, readonly retryAfterMs: number | null = null) { super(problem) }
}

/** The longest Retry-After honoured: a larger value (or a far-future date) waits this long instead. */
export const MAX_RETRY_AFTER_MS = 120_000
/** Reads a Retry-After header (seconds or an HTTP date) into a wait in milliseconds, capped; null if absent or unreadable. */
export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null
  const value = header.trim()
  const ms = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now
  if (!Number.isFinite(ms)) return null
  return Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS)
}

/** Focus, back-online and the 60 s timer check at most once in this period; Try again and new sessions always check. */
export const MIN_CHECK_GAP_MS = 10_000

/** How the session check reads an HTTP status that isn't 2xx. Fails closed: an unexpected status is final. */
export function accessCheckFailure(status: number, retryAfter: string | null = null): AccessCheckError {
  if (status === 401) return new AccessCheckError("session_ended", false)
  if (status === 403) return new AccessCheckError("no_access", false)
  const transient = status === 408 || status === 425 || status === 429 || status >= 500
  return new AccessCheckError("unreachable", transient, transient ? retryAfterMs(retryAfter) : null)
}

/** Retry delays while a mounted workspace can't reach Neuvetra; the last one repeats. Each is jittered by ±20 %. */
export const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000, 60_000] as const

/** Authorization requests have generations; a workspace lifetime changes only with its authority. */
export function createStagingAuthorization(deps: {
  verify: (session: Session, signal: AbortSignal) => Promise<StagingAccess>
  onActive: (value: ActiveStagingSession | null) => void
  onSignedIn: (value: boolean) => void
  onMessage: (value: string) => void
  /** The screen to show while no workspace is open; null when there is no problem. */
  onProblem?: (value: AccessProblem | null) => void
  /** True while a mounted workspace is kept open through a transient failure and the check is being retried. */
  onReconnecting?: (value: boolean) => void
  /**
   * A workspace closed because the session ended (not a deliberate sign-out), so its address can be offered back to the
   * same person. `cause` is "signed_out" for a Supabase SIGNED_OUT (which may be another tab's deliberate sign-out).
   */
  onSessionEnded?: (ended: { userId: string; email: string | null; cause: "rejected" | "signed_out" }) => void
  schedule?: (run: () => void, ms: number) => () => void
  random?: () => number
  now?: () => number
}) {
  const schedule = deps.schedule ?? ((run, ms) => { const id = setTimeout(run, ms); return () => clearTimeout(id) })
  const random = deps.random ?? Math.random
  const now = deps.now ?? Date.now
  let lastCheckAt = -Infinity
  let active: ActiveStagingSession | null = null
  let latest: Session | null = null
  let generation = 0
  let epoch = 0
  let disposed = false
  let signedOut = false
  // Set once a session has been seen in this page, until a deliberate sign-out: a later null session is a session end.
  let hadSession = false
  // While the session has ended, the periodic re-check of the rejected token stops; a new session restarts it.
  let ended = false
  let problem: AccessProblem | null = null
  let reconnecting = false
  // Set by a workspace 403: the next check must not reuse one already in flight.
  let forced = false
  let retryStep = 0
  let cancelRetry: (() => void) | null = null
  let pending: { token: string; userId: string; controller: AbortController; promise: Promise<void>; forced: boolean } | null = null

  function cancelCheck() { generation++; pending?.controller.abort(); pending = null }
  function stopRetrying() {
    cancelRetry?.(); cancelRetry = null; retryStep = 0
    if (reconnecting) { reconnecting = false; deps.onReconnecting?.(false) }
  }
  function closeWorkspace() { stopRetrying(); active?.controller.abort(); active = null; deps.onActive(null) }
  function setProblem(value: AccessProblem | null) { if (problem !== value) { problem = value; deps.onProblem?.(value) } }
  function endSession(cause: "rejected" | "signed_out" = "rejected") {
    const user = active?.session.user ?? latest?.user ?? null
    ended = true
    cancelCheck(); closeWorkspace()
    setProblem("session_ended")
    deps.onMessage(ACCESS_TEXT.sessionEnded)
    if (user) deps.onSessionEnded?.({ userId: user.id, email: user.email ?? null, cause })
  }
  /**
   * A workspace request was refused. 401 ends the session and closes workspace data access now. A 403 can also be a
   * role-forbidden write or an origin refusal, so it re-checks /session first: the workspace stays open (the action shows
   * its own error) unless that check answers 403 (no access) or 401 (session ended).
   */
  function invalidate(status?: number) {
    if (disposed) return
    if (status === 403) {
      if (active && latest && active.actor.userId === latest.user.id) { forced = true; void authorize(latest); return }
      cancelCheck(); closeWorkspace()
      setProblem("no_access")
      deps.onMessage(ACCESS_TEXT.noAccess)
      return
    }
    endSession()
  }
  function retryLater(retryAfter: number | null) {
    cancelRetry?.()
    const base = RETRY_DELAYS_MS[Math.min(retryStep, RETRY_DELAYS_MS.length - 1)]!
    retryStep++
    // The server's Retry-After (capped) wins when it asks for a longer wait than the backoff.
    const delay = Math.max(Math.round(base * (0.8 + 0.4 * random())), retryAfter ?? 0)
    cancelRetry = schedule(() => { cancelRetry = null; if (latest && active) void authorize(latest) }, delay)
  }
  async function authorize(session: Session | null): Promise<void> {
    if (disposed || (signedOut && session)) return
    if (!session) {
      deps.onSignedIn(false)
      // A Supabase SIGNED_OUT on its own is not a deliberate sign-out: if a session was open here, it ended.
      if (hadSession && !signedOut) { endSession("signed_out"); latest = null; return }
      latest = null
      cancelCheck(); closeWorkspace()
      setProblem(null)
      deps.onMessage(ACCESS_TEXT.signIn)
      return
    }
    if (ended && latest && latest.access_token === session.access_token && latest.user.id === session.user.id) return
    ended = false
    latest = session
    hadSession = true
    deps.onSignedIn(true)
    if (active && active.actor.userId !== session.user.id) closeWorkspace()
    // A check already running for this token answers this request too, unless a workspace 403 needs a fresh answer.
    if (pending?.token === session.access_token && pending.userId === session.user.id && (!forced || pending.forced)) { forced = false; return pending.promise }
    const fresh = forced
    forced = false
    cancelCheck()
    lastCheckAt = now()
    const current = generation, controller = new AbortController()
    if (!active && !problem) deps.onMessage(ACCESS_TEXT.checking)
    const promise = (async () => {
      try {
        const access = await deps.verify(session, controller.signal)
        if (disposed || signedOut || current !== generation) return
        const wasReconnecting = reconnecting
        stopRetrying()
        const sameAuthority = active && active.actor.userId === session.user.id && active.access.access.role === access.access.role && active.access.access.workspaceId === access.access.workspaceId && active.access.access.evidenceId === access.access.evidenceId
        const opened = !sameAuthority
        if (sameAuthority && active) {
          // Existing form/request closures retain this actor object and receive the refreshed token.
          active.actor.accessToken = session.access_token
          active = { ...active, session, access }
        } else {
          closeWorkspace()
          const workspaceController = new AbortController()
          const actor: HostedWorkspaceActor = {
            accessToken: session.access_token, userId: session.user.id, role: access.access.role, signal: workspaceController.signal,
            onUnauthorized: status => { if (active?.controller === workspaceController) invalidate(status) },
          }
          active = { session, access, epoch: ++epoch, controller: workspaceController, actor }
        }
        setProblem(null)
        deps.onActive(active)
        if (wasReconnecting) deps.onMessage(ACCESS_TEXT.reconnected)
        else if (opened) deps.onMessage(ACCESS_TEXT.verified)
      } catch (error) {
        if (disposed || current !== generation) return
        const failure = error instanceof AccessCheckError ? error : new AccessCheckError("unreachable", false)
        // Risk 2 (CTO audit): a transient failure while this user's workspace is open keeps it open, with its unsaved
        // input, and retries with backoff. Only a 401 or 403 (or a final failure) closes it.
        if (failure.transient && active && active.actor.userId === session.user.id) {
          // The token came from this user's own Supabase session; every request is still checked by the server.
          active.actor.accessToken = session.access_token
          if (!reconnecting) { reconnecting = true; deps.onReconnecting?.(true) }
          deps.onMessage(ACCESS_TEXT.retrying)
          retryLater(failure.retryAfterMs)
          return
        }
        if (failure.problem === "session_ended") { endSession(); return }
        cancelCheck(); closeWorkspace()
        setProblem(failure.problem)
        deps.onMessage(failure.problem === "no_access" ? ACCESS_TEXT.noAccess : ACCESS_TEXT.unreachable)
      } finally { if (current === generation) pending = null }
    })()
    if (current === generation) pending = { token: session.access_token, userId: session.user.id, controller, promise, forced: fresh }
    return promise
  }
  return {
    authorize,
    /**
     * Checks the current session again. Try again passes `force`. The 60 s timer, focus and back-online don't: they wait
     * while a retry is scheduled (the backoff and any Retry-After stand) and check at most once per MIN_CHECK_GAP_MS.
     */
    refresh: (options: { force?: boolean } = {}) => {
      if (!latest || ended) return Promise.resolve()
      if (!options.force && (cancelRetry || now() - lastCheckAt < MIN_CHECK_GAP_MS)) return pending?.promise ?? Promise.resolve()
      return authorize(latest)
    },
    invalidate,
    allowSignIn: () => { signedOut = false },
    signOut: () => { signedOut = true; hadSession = false; ended = false; latest = null; cancelCheck(); closeWorkspace(); setProblem(null); deps.onSignedIn(false) },
    dispose: () => { disposed = true; latest = null; cancelCheck(); cancelRetry?.(); cancelRetry = null; active?.controller.abort(); active = null },
  }
}
