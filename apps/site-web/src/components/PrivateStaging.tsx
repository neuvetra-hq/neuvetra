import { useEffect, useRef, useState, type FormEvent } from "react"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { StagingWorkspace } from "./StagingWorkspace"
import { Landing } from "./Landing"
import { signInNoticeTone } from "@/lib/sign-in-notice"
import { Icon } from "./Icon"
import { decodeStagingAccess, decodeStagingConfig } from "@/lib/staging-session"
import { acceptedViewHash, forgetReturnView, markDeliberateSignOut, parseViewHash, peekReturnView, recentlySignedOut, rememberReturnView, SIGNED_OUT_MARK_KEY, takeReturnView, viewHash } from "@/lib/view-route"

// WO-05b: unsaved activity and setup input kept in this tab (sessionStorage), admitted per user, company and role.
import { admitDrafts, announceDraftClear, clearAllDrafts, draftStorage, DRAFT_TEXT, hasDraftsFor, listenForDraftClear, SIGN_OUT_SERVER_NOT_TOLD } from "@/lib/draft-store"
import { removeStoredSignIn, revokeSession, SIGNED_OUT_ELSEWHERE, type AuthEndpoint } from "@/lib/device-sign-out"
import { ACCESS_TEXT, AccessCheckError, accessCheckFailure, createStagingAuthorization, type AccessProblem, type ActiveStagingSession } from "@/lib/staging-authorization"

// WO-05a: the session check has its own short limit (it is not a user action, so it doesn't raise the "Taking longer" notice).
const SESSION_CHECK_TIMEOUT_MS = 15_000

function viewStorage(): Storage | null { try { return window.localStorage } catch { return null } }
function storedSessionUser(key: string): string | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null")
    const id = value && typeof value === "object" ? (value as { user?: { id?: unknown } }).user?.id : null
    return typeof id === "string" ? id : null
  } catch { return null }
}
const SIGN_OUT_TEXT = {
  plain: { removed: "Signed out on this device. Telling the server…", done: "Signed out on this browser.", serverNotTold: SIGN_OUT_SERVER_NOT_TOLD.plain, notRemoved: "The workspace is closed, but the stored sign-in could not be removed from this browser. Close the browser before leaving a shared computer." },
  discard: { removed: "Unsaved changes discarded and signed out on this device. Telling the server…", done: DRAFT_TEXT.discardDone, serverNotTold: SIGN_OUT_SERVER_NOT_TOLD.discard, notRemoved: "Unsaved changes discarded, but the stored sign-in could not be removed from this browser. Close the browser before leaving a shared computer." },
} as const
/**
 * WO-13 (QA N1 of PR #56): after a deliberate sign-out, a session that shows up again (a token refresh that was already on
 * its way, another tab's client) is removed at once and, best effort, revoked. Nothing here waits for it.
 */
function purgeStoredSignIn(key: string | null, endpoint: AuthEndpoint | null) {
  const stored = removeStoredSignIn(viewStorage(), key)
  if (stored.accessToken || stored.refreshToken) void revokeSession(endpoint, stored)
}
function clearViewHash() { if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search) }

export function PrivateStaging() {
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [active, setActive] = useState<ActiveStagingSession | null>(null)
  const [message, setMessage] = useState<string>(ACCESS_TEXT.checking)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [problem, setProblem] = useState<AccessProblem | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const authorization = useRef<ReturnType<typeof createStagingAuthorization> | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const accessHeadingRef = useRef<HTMLHeadingElement>(null)
  const opened = useRef<{ userId: string; epoch: number } | null>(null)
  // The user whose session was already in this browser when the page loaded (a refresh), unless it came from a sign-in
  // link's code in this URL. Only that user's record address in the URL is trusted on a freshly loaded page.
  const loadUser = useRef<string | null>(null)
  // WO-05b (WO-05a QA follow-up 1): ...and only when that load-time session itself passes the server check. A failed check
  // (session ended, no access) or a sign-in started on this page before the first workspace opens withdraws the trust.
  const loadTrusted = useRef(true)
  const signInFromUrl = useRef(typeof window !== "undefined" && /[?&]code=/.test(window.location.search))
  // Whose session ended here: the sign-in link carries their view only if they are the one signing in again.
  const endedUser = useRef<{ userId: string; email: string | null } | null>(null)
  // WO-13 (QA F3/F4 of PR #56): the session-ended screen speaks of kept changes, and offers to discard them, whenever this
  // tab holds drafts of the person whose session ended (also after a reload, when the role is no longer known). The tab's
  // drafts are read when the screen renders; this counter renders it again when they may have changed (the workspace keeps
  // its draft as it closes, another tab's sign-out or discard removes them).
  const [, setDraftsSeen] = useState(0)
  const [endedUserId, setEndedUserId] = useState<string | null>(null)
  // WO-13 (WO-05b follow-up): "Discard unsaved changes on this device" asks first, inside the page (never a browser dialog).
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const discardButtonRef = useRef<HTMLButtonElement>(null)
  const discardHeadingRef = useRef<HTMLHeadingElement>(null)
  const discardAsked = useRef(false)
  // The localStorage key under which Supabase keeps this origin's sign-in session (set once the configuration loads).
  const sessionStorageKey = useRef<string | null>(null)
  // WO-13 (QA N1/F10 of PR #56): where Supabase Auth answers (for revoking a session without the client), once configured.
  const authEndpoint = useRef<AuthEndpoint | null>(null)
  // WO-13 (QA N1/N2 of PR #56): set from a deliberate sign-out (here or in another tab of this browser) until the next
  // deliberate sign-in (here, or in another tab, which removes the sign-out mark). Meanwhile no session may come back.
  const signedOutHere = useRef(false)

  useEffect(() => {
    let alive = true
    let authClient: SupabaseClient | null = null
    let unsubscribe = () => {}
    let authEvents = 0
    const configuration = new AbortController()
    const lifecycle = createStagingAuthorization({
      // 401 ends the session, 403 is no access; no answer, a timeout, 408/425/429 or 5xx is transient. Anything else fails closed.
      verify: async (session, signal) => {
        const request = new AbortController()
        const timer = setTimeout(() => request.abort(), SESSION_CHECK_TIMEOUT_MS)
        const stop = () => request.abort()
        signal.addEventListener("abort", stop, { once: true })
        let response: Response
        try { response = await fetch("/workspace-api/session", { headers: { authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: request.signal }) }
        catch (cause) { if (signal.aborted) throw cause; throw new AccessCheckError("unreachable", true) }
        finally { clearTimeout(timer); signal.removeEventListener("abort", stop) }
        if (!response.ok) throw accessCheckFailure(response.status, response.headers.get("retry-after"))
        let body: unknown
        try { body = await response.json() } catch { throw new AccessCheckError("unreachable", true) }
        // An answer for another person means this session isn't the one the server knows: treat it as ended.
        const named = body && typeof body === "object" ? (body as { user?: { id?: unknown } }).user?.id : undefined
        if (named !== undefined && named !== session.user.id) throw new AccessCheckError("session_ended", false)
        return decodeStagingAccess(body, session.user.id)
      },
      onActive: value => {
        if (value && (opened.current?.userId !== value.actor.userId || opened.current.epoch !== value.epoch)) {
          // A new workspace lifetime opens at the right address (QA B1): another person never inherits the last view.
          // The view a session ended on lives only in the user-bound stored return view and comes back through it.
          const userId = value.actor.userId
          const returnView = takeReturnView(viewStorage(), userId)
          const otherUser = opened.current !== null && opened.current.userId !== userId
          if (otherUser) clearViewHash()
          // A record address in the URL of a freshly loaded page is trusted only for the session that was already here at
          // load (a refresh), or when the same user's stored return view confirms it.
          const trusted = !otherUser && (opened.current !== null || (loadUser.current === userId && loadTrusted.current && !signInFromUrl.current))
          const shown = acceptedViewHash(window.location.hash)
          let target = shown
          if (shown && !trusted && parseViewHash(shown).recordId && returnView !== shown) target = returnView ?? viewHash(parseViewHash(shown).panel, null)
          if (!target && returnView) target = returnView
          if (target && target !== window.location.hash) window.history.replaceState(null, "", target)
          opened.current = { userId, epoch: value.epoch }
          endedUser.current = null
          // WO-05b: before this workspace renders, the tab keeps only this user's drafts for this company, and none at all
          // for a member (QA-142). Any other user's draft is removed here, whatever happened on this page before.
          admitDrafts(draftStorage(), { userId, companyId: value.access.access.workspaceId, role: value.actor.role })
        }
        setActive(value)
      },
      onSignedIn: setSignedIn, onMessage: setMessage, onReconnecting: setReconnecting,
      onProblem: value => {
        // The load-time session failed its check: a later sign-in on this page is not the load-time session (WO-05b).
        if (opened.current === null && (value === "session_ended" || value === "no_access")) loadTrusted.current = false
        setProblem(value)
      },
      onSessionEnded: ({ userId, email: endedEmail, cause }) => {
        // QA B1 / CEO ruling: the view is kept only in the stored return view (bound to this user) and leaves the URL.
        // A SIGNED_OUT caused by a deliberate sign-out in another tab doesn't write it back.
        const deliberateElsewhere = cause === "signed_out" && recentlySignedOut(viewStorage())
        // WO-05b (WO-05a QA follow-up 1): on a page where no workspace has opened yet, the load-time session failed its
        // check, so a record address in the URL was never verified for anyone: only its view is kept, not the record.
        const shown = window.location.hash, route = parseViewHash(shown)
        const kept = opened.current === null && route.recordId ? viewHash(route.panel, null) : shown
        if (!deliberateElsewhere) rememberReturnView(viewStorage(), userId, kept)
        // WO-05b (QA-141): another tab's deliberate sign-out clears this tab's drafts too (the broadcast may come later).
        else clearAllDrafts(draftStorage())
        setConfirmDiscard(false); discardAsked.current = false
        clearViewHash()
        endedUser.current = { userId, email: endedEmail }
        setEndedUserId(userId)
        // The next person at a shared computer doesn't see the previous email.
        setEmail(""); setPassword("")
      },
    })
    authorization.current = lifecycle
    async function initialize() {
      try {
        const response = await fetch("/workspace-api/config", { cache: "no-store", signal: configuration.signal })
        if (!response.ok) throw new Error()
        const config = decodeStagingConfig(await response.json())
        if (!alive) return
        // Whose session this browser already held when the page loaded (read before Supabase can change it).
        const storageKey = `neuvetra:m63:${config.projectRef}:auth`
        sessionStorageKey.current = storageKey
        authEndpoint.current = { url: config.supabaseUrl, anonKey: config.anonKey, fetch: (input, init) => fetch(input, init) }
        if (opened.current === null && !signInFromUrl.current) loadUser.current = storedSessionUser(storageKey)
        authClient = createClient(config.supabaseUrl, config.anonKey, { auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } })
        setClient(authClient)
        const { data } = authClient.auth.onAuthStateChange((_event, session) => {
          authEvents++
          // WO-13 (QA N1 of PR #56): signed out deliberately: a session that appears now (a late refresh answer, another
          // tab's client) is removed at once, never opened.
          if (session && signedOutHere.current) { purgeStoredSignIn(sessionStorageKey.current, authEndpoint.current); return }
          void lifecycle.authorize(session)
        })
        unsubscribe = () => data.subscription.unsubscribe()
        const initialAuthEvents = authEvents
        const result = await authClient.auth.getSession()
        if (alive && authEvents === initialAuthEvents) await lifecycle.authorize(result.data.session)
      } catch { if (alive) setMessage("Neuvetra is unavailable right now. Please try again later.") }
    }
    // WO-05b (QA-141): a deliberate sign-out in another tab removes every draft here, by BroadcastChannel or by the
    // sign-out mark it leaves in localStorage (whichever arrives first), and no draft is written until a workspace opens.
    // WO-13 (QA N2 of PR #56): ...and closes this tab's workspace at once, as Supabase's own sign-out did before this order,
    // whether or not the other tab could reach the server. A write from here can't be sent after that.
    const signedOutElsewhere = () => {
      clearAllDrafts(draftStorage()); setDraftsSeen(value => value + 1)
      if (signedOutHere.current) return
      signedOutHere.current = true
      void authClient?.auth.stopAutoRefresh()
      const hadSession = opened.current !== null || endedUser.current !== null
      lifecycle.signOut(); clearViewHash()
      opened.current = null; loadUser.current = null; endedUser.current = null; setEndedUserId(null)
      setConfirmDiscard(false); discardAsked.current = false
      purgeStoredSignIn(sessionStorageKey.current, authEndpoint.current)
      if (hadSession) setMessage(SIGNED_OUT_ELSEWHERE)
    }
    const stopDraftClear = listenForDraftClear(signedOutElsewhere)
    const onStorage = (event: StorageEvent) => {
      if (event.key === SIGNED_OUT_MARK_KEY) {
        if (event.newValue) signedOutElsewhere()
        // Another tab signed in deliberately: a session may appear again.
        else signedOutHere.current = false
      }
      // WO-13 (QA N1): a session written back while signed out (another tab's late refresh) goes at once.
      else if (signedOutHere.current && event.key !== null && event.key === sessionStorageKey.current && event.newValue) purgeStoredSignIn(sessionStorageKey.current, authEndpoint.current)
    }
    window.addEventListener("storage", onStorage)
    const onFocus = () => { void lifecycle.refresh() }
    const interval = window.setInterval(onFocus, 60_000)
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onFocus)
    void initialize()
    return () => { alive = false; lifecycle.dispose(); configuration.abort(); unsubscribe(); authClient?.auth.stopAutoRefresh(); window.clearInterval(interval); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); window.removeEventListener("storage", onStorage); stopDraftClear() }
  }, [])

  // Each access state puts focus on its own heading when it appears (WO-05a).
  const accessState = active ? null : problem
  useEffect(() => { if (accessState) accessHeadingRef.current?.focus() }, [accessState])
  // WO-13: the confirmation takes focus when it opens; Keep them returns focus to the button that opened it.
  // The workspace keeps its draft as it closes (its effect cleanup runs before this effect), so the screen looks again then.
  useEffect(() => {
    if (accessState !== "session_ended") return
    const timer = setTimeout(() => setDraftsSeen(value => value + 1), 0)
    return () => clearTimeout(timer)
  }, [accessState])
  useEffect(() => {
    if (confirmDiscard) { discardAsked.current = true; discardHeadingRef.current?.focus() }
    else if (discardAsked.current) { discardAsked.current = false; discardButtonRef.current?.focus() }
  }, [confirmDiscard])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!client || busy) return
    allowSignInAgain(); setBusy(true); setMessage("Signing in…")
    if (opened.current === null) loadTrusted.current = false
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMessage("Sign-in failed. Check your invited account details.")
    } catch { setMessage("Sign-in is unavailable. Please try again.") }
    finally { setPassword(""); setBusy(false) }
  }
  /**
   * A deliberate sign-out. WO-13 (QA B1 of PR #56): everything on this device goes first, at once and without the network,
   * so a stalled connection can't leave the sign-in behind: every unsaved draft (here, and in the other tabs by the
   * broadcast and the sign-out mark), the view address and this origin's stored Supabase session. Only then is the server
   * told, through the token that session held, for at most SIGN_OUT_TIMEOUT_MS. The message says whether it was told.
   * "discard" is the session-ended screen's "Discard unsaved changes on this device"; every other Sign out is "plain".
   */
  async function signOut(kind: "plain" | "discard" = "plain") {
    const text = SIGN_OUT_TEXT[kind]
    // WO-13 (QA N1 of PR #56): first, no refresh may start, and from now until a deliberate sign-in no session may come back.
    signedOutHere.current = true
    void client?.auth.stopAutoRefresh()
    // A deliberate sign-out is the only thing that forgets the view address. WO-05b: it also removes every unsaved draft in
    // this tab, stops further draft writes (before the workspace closes), and tells the other tabs to do the same (WO-13,
    // QA N2: they close their workspace too).
    clearAllDrafts(draftStorage()); markDeliberateSignOut(viewStorage()); announceDraftClear()
    authorization.current?.signOut(); setBusy(true)
    clearViewHash(); forgetReturnView(viewStorage())
    opened.current = null; loadUser.current = null; endedUser.current = null; setEndedUserId(null)
    setConfirmDiscard(false); discardAsked.current = false; setDraftsSeen(value => value + 1)
    const stored = removeStoredSignIn(viewStorage(), sessionStorageKey.current)
    if (!stored.removed) { setMessage(text.notRemoved); setBusy(false); return }
    setMessage(text.removed)
    try {
      const told = await revokeSession(authEndpoint.current, stored)
      // Anything written back while the server was asked (a refresh that was already on its way) goes too.
      purgeStoredSignIn(sessionStorageKey.current, authEndpoint.current)
      setMessage(told ? text.done : text.serverNotTold)
    } finally { setBusy(false) }
  }
  /** WO-13 (QA N1 of PR #56): a deliberate sign-in, here: sessions may appear again, here and in the other tabs. */
  function allowSignInAgain() {
    authorization.current?.allowSignIn()
    if (signedOutHere.current) {
      signedOutHere.current = false
      try { viewStorage()?.removeItem(SIGNED_OUT_MARK_KEY) } catch { /* best effort */ }
      void client?.auth.startAutoRefresh()
    }
  }
  /** WO-13: the session-ended screen's "Discard unsaved changes on this device", after its confirmation. */
  async function discardOnDevice() { await signOut("discard") }
  async function sendSignInLink() {
    if (!client || busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage("Enter your invited email address first."); return }
    allowSignInAgain(); setBusy(true)
    if (opened.current === null) loadTrusted.current = false
    try {
      // The link opens the view the session ended on (QA-146), but only for the person whose session ended: anyone else's
      // link goes to the bare origin (QA B1). The view comes from the user-bound stored return view, already validated.
      const ended = endedUser.current
      const view = ended?.email && ended.email.toLowerCase() === email.trim().toLowerCase() ? peekReturnView(viewStorage(), ended.userId) : null
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + "/" + (view ?? "") } })
      if (error) throw error
      setMessage("If this email has an approved account, a sign-in link is on its way. Open it in this browser.")
    } catch { setMessage("The sign-in link could not be sent. Please try again later.") }
    finally { setBusy(false) }
  }
  async function tryAgain() {
    if (retrying) return
    setRetrying(true)
    try { await authorization.current?.refresh({ force: true }) } finally { setRetrying(false) }
  }

  const tone = signInNoticeTone(message)
  // One polite live region in every state announces sign-in and access changes.
  const live = <p className="nv-sr" role="status" aria-live="polite">{message}</p>
  if (active) return <div className="nv-app">
    {live}
    <a className="nv-skip" href="#workspace-main">Skip to content</a>
    <StagingWorkspace key={`${active.session.user.id}:${active.epoch}`} headingRef={headingRef} staging={{ actor: active.actor, workspaceId: active.access.access.workspaceId, evidenceId: active.access.access.evidenceId }}
      // WO-08: the workspace draws the top bar (and the Menu sheet below 1080 px); both Sign out controls call this same deliberate sign-out.
      account={{ email: active.session.user.email ?? null, signingOut: busy, onSignOut: () => void signOut() }}
      // Risk 2: a transient failure keeps the workspace and its unsaved input; this notice is visual (the live region speaks).
      // WO-08: the workspace shows it as the last row of the sticky context bar, so it covers neither the heading nor the Menu sheet.
      notice={reconnecting ? <div className="nv-reconnecting-wrap"><div className="nv-notice nv-notice--warn"><Icon name="alert" /><p>{ACCESS_TEXT.retrying} Your work on this page stays here.</p></div></div> : null} />
  </div>
  const endedDrafts = problem === "session_ended" && endedUserId !== null && hasDraftsFor(draftStorage(), endedUserId)
  if (problem === "session_ended") return <div className="nv-access">{tone === "error" ? <p className="nv-sr" role="status" aria-live="polite" /> : live}<div className="nv-access__card">
    <Icon name="info" size={32} className="nv-access__icon" />
    <h1 className="nv-h2" tabIndex={-1} ref={accessHeadingRef}>Your session ended</h1>
    <p className="nv-muted">Sign in again to continue.{endedDrafts && ` ${DRAFT_TEXT.sessionEnded}`}</p>
    <form className="nv-access__form" onSubmit={event => { if (busy) { event.preventDefault(); return } void signIn(event) }}>
      <label className="nv-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="nv-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      {tone && <div key={tone} className={`nv-notice ${tone === "error" ? "nv-notice--error" : "nv-notice--ok"}`} style={{ margin: 0 }} role={tone === "error" ? "alert" : undefined}><Icon name={tone === "error" ? "alert" : "check"} /><p>{message}</p></div>}
      <button type="submit" className="nv-btn nv-btn--primary nv-btn--block" disabled={!client} aria-disabled={busy || undefined}>{busy ? "Signing in…" : "Sign in"}</button>
      <div className="nv-or">or</div>
      <button type="button" className="nv-btn nv-btn--block" disabled={!client} aria-disabled={busy || undefined} onClick={() => { if (!busy) void sendSignInLink() }}>Email me a sign-in link</button>
    </form>
    {/* WO-13: on a shared computer, the person can leave nothing behind without signing in again. */}
    <div className="nv-access__actions wo13-device-actions">
      {endedDrafts && <button type="button" className="nv-btn" ref={discardButtonRef} aria-expanded={confirmDiscard} aria-disabled={busy || undefined} onClick={() => { if (!busy) setConfirmDiscard(true) }}>{DRAFT_TEXT.discardOnDevice}</button>}
      <button type="button" className="nv-btn" aria-disabled={busy || undefined} onClick={() => { if (!busy) void signOut() }}>{endedDrafts ? DRAFT_TEXT.signOutAndDiscard : DRAFT_TEXT.signOut}</button>
    </div>
    {confirmDiscard && endedDrafts && <div className="nv-notice nv-notice--warn wo13-discard" role="group" aria-labelledby="wo13-discard-title" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setConfirmDiscard(false) } }}><Icon name="alert" /><div>
      <h2 className="nv-h3" id="wo13-discard-title" tabIndex={-1} ref={discardHeadingRef}>{DRAFT_TEXT.discardConfirmTitle}</h2>
      <p>{DRAFT_TEXT.discardConfirmBody}</p>
      <div className="nv-access__actions"><button type="button" className="nv-btn nv-btn--danger" aria-disabled={busy || undefined} onClick={() => { if (!busy) void discardOnDevice() }}>{DRAFT_TEXT.discardConfirm}</button><button type="button" className="nv-btn" onClick={() => setConfirmDiscard(false)}>{DRAFT_TEXT.discardCancel}</button></div>
    </div></div>}
  </div></div>
  if (problem) return <div className="nv-access">{live}<div className="nv-access__card">
    <Icon name="alert" size={32} className="nv-access__icon" />
    <h1 className="nv-h2" tabIndex={-1} ref={accessHeadingRef}>{problem === "no_access" ? "We couldn’t open your workspace" : "We couldn’t reach Neuvetra"}</h1>
    <p className="nv-muted">{problem === "no_access" ? ACCESS_TEXT.noAccess : "Check your connection, then try again. Nothing you saved is affected."}</p>
    <div className="nv-access__actions">
      {problem === "unreachable" && <button type="button" className="nv-btn nv-btn--primary" aria-disabled={retrying || undefined} onClick={() => void tryAgain()}>{retrying ? "Trying again…" : "Try again"}</button>}
      <button type="button" className="nv-btn" disabled={busy} onClick={() => void signOut()}>Sign out</button>
    </div>
  </div></div>
  if (signedIn) return <div className="nv-access">{live}<div className="nv-access__card">
    <div className="nv-spinner" aria-hidden="true" />
    <h1 className="nv-h2">Opening your workspace…</h1>
    <p className="nv-muted">Checking your invitation and company access.</p>
    <button type="button" className="nv-btn" disabled={busy} onClick={() => void signOut()}>Sign out</button>
  </div></div>
  // On the landing page an error is announced once, by the sign-in card's role="alert" (WO-02), so the polite region stays empty for it.
  return <div>{tone === "error" ? <p className="nv-sr" role="status" aria-live="polite" /> : live}<Landing ready={Boolean(client)} busy={busy} message={message} email={email} password={password} onEmail={setEmail} onPassword={setPassword} onSignIn={event => void signIn(event)} onSendLink={() => void sendSignInLink()} /></div>
}
