import { useEffect, useRef, useState, type FormEvent } from "react"
// WO-14c (design step 4): sessions through auth generations (boot, adoption, sign-in); sign-out unchanged.
import { createAuthSessions } from "@/lib/auth-sessions"
import { StagingWorkspace } from "./StagingWorkspace"
import { Landing } from "./Landing"
import { signInNoticeTone } from "@/lib/sign-in-notice"
import { Icon } from "./Icon"
import { decodeStagingAccess, decodeStagingConfig } from "@/lib/staging-session"
import { acceptedViewHash, forgetReturnView, markDeliberateSignOut, parseViewHash, peekReturnView, recentlySignedOut, rememberReturnView, SIGNED_OUT_MARK_KEY, takeReturnView, viewHash } from "@/lib/view-route"

// WO-05b: unsaved activity and setup input kept in this tab (sessionStorage), admitted per user, company and role.
import { admitDrafts, announceDraftClear, clearAllDrafts, draftStorage, DRAFT_TEXT, listenForDraftClear } from "@/lib/draft-store"
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
function clearViewHash() { if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search) }

export function PrivateStaging() {
  // WO-14c: the page's Supabase sessions (one auth generation at a time); ready once the configuration has loaded.
  const sessions = useRef<ReturnType<typeof createAuthSessions> | null>(null)
  const [ready, setReady] = useState(false)
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
  // WO-05b: the role of the workspace that was open, so the session-ended screen speaks of kept changes only to an owner or admin.
  const lastRole = useRef<string | null>(null)
  const [endedCanStore, setEndedCanStore] = useState(false)

  useEffect(() => {
    let alive = true
    let storageKey: string | null = null
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
          lastRole.current = value.actor.role
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
        setEndedCanStore(!deliberateElsewhere && (lastRole.current === "owner" || lastRole.current === "admin"))
        clearViewHash()
        endedUser.current = { userId, email: endedEmail }
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
        const key = `neuvetra:m63:${config.projectRef}:auth`
        storageKey = key
        if (opened.current === null && !signInFromUrl.current) loadUser.current = storedSessionUser(key)
        // WO-14c: the stored session is read by the page itself and reported here; a session another tab signed in (or a
        // tab still on old code refreshed) is adopted. The email link's ?code= is exchanged by the boot generation.
        const created = createAuthSessions({
          url: config.supabaseUrl, anonKey: config.anonKey, storageKey: key, search: window.location.search,
          onSession: session => { if (alive) void lifecycle.authorize(session) },
          onAdopt: () => lifecycle.allowSignIn(),
        })
        sessions.current = created
        setReady(true)
        await created.boot()
      } catch { if (alive) setMessage("Neuvetra is unavailable right now. Please try again later.") }
    }
    // WO-05b (QA-141): a deliberate sign-out in another tab removes every draft here, by BroadcastChannel or by the
    // sign-out mark it leaves in localStorage (whichever arrives first), and no draft is written until a workspace opens.
    const stopDraftClear = listenForDraftClear(() => clearAllDrafts(draftStorage()))
    const onStorage = (event: StorageEvent) => {
      if (event.key === SIGNED_OUT_MARK_KEY && event.newValue) clearAllDrafts(draftStorage())
      // WO-14c: another tab wrote or removed the stored session (or cleared storage): read it again.
      if (storageKey && (event.key === storageKey || event.key === null)) sessions.current?.sync()
    }
    window.addEventListener("storage", onStorage)
    const onFocus = () => { void lifecycle.refresh() }
    const interval = window.setInterval(onFocus, 60_000)
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onFocus)
    void initialize()
    return () => { alive = false; lifecycle.dispose(); configuration.abort(); sessions.current?.dispose(); sessions.current = null; window.clearInterval(interval); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); window.removeEventListener("storage", onStorage); stopDraftClear() }
  }, [])

  // Each access state puts focus on its own heading when it appears (WO-05a).
  const accessState = active ? null : problem
  useEffect(() => { if (accessState) accessHeadingRef.current?.focus() }, [accessState])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    const current = sessions.current
    if (!current || busy) return
    authorization.current?.allowSignIn(); setBusy(true); setMessage("Signing in…")
    if (opened.current === null) loadTrusted.current = false
    try {
      // WO-14c: each sign-in runs on a new generation; an answer that arrives after it was retired is discarded.
      const outcome = await current.signIn(email.trim(), password)
      if (outcome === "failed") setMessage("Sign-in failed. Check your invited account details.")
    } catch { setMessage("Sign-in is unavailable. Please try again.") }
    finally { setPassword(""); setBusy(false) }
  }
  async function signOut() {
    // A deliberate sign-out is the only thing that forgets the view address. WO-05b: it also removes every unsaved draft in
    // this tab, stops further draft writes (before the workspace closes), and tells the other tabs to do the same.
    clearAllDrafts(draftStorage()); markDeliberateSignOut(viewStorage()); announceDraftClear()
    authorization.current?.signOut(); setBusy(true)
    clearViewHash(); forgetReturnView(viewStorage())
    opened.current = null; loadUser.current = null; endedUser.current = null; lastRole.current = null
    try {
      if (!sessions.current) throw new Error("Authentication unavailable")
      // Unchanged in WO-14c: `client.auth.signOut({ scope: "local" })`, on the generation serving the stored session.
      const { error } = await sessions.current.signOut()
      if (error) throw error
      setMessage("Signed out on this browser.")
    }
    catch { setMessage("The workspace is closed. Session sign-out could not be confirmed; retry before leaving a shared browser.") }
    finally { setBusy(false) }
  }
  async function sendSignInLink() {
    if (!sessions.current || busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage("Enter your invited email address first."); return }
    authorization.current?.allowSignIn(); setBusy(true)
    if (opened.current === null) loadTrusted.current = false
    try {
      // The link opens the view the session ended on (QA-146), but only for the person whose session ended: anyone else's
      // link goes to the bare origin (QA B1). The view comes from the user-bound stored return view, already validated.
      const ended = endedUser.current
      const view = ended?.email && ended.email.toLowerCase() === email.trim().toLowerCase() ? peekReturnView(viewStorage(), ended.userId) : null
      const { error } = await sessions.current.sendSignInLink(email.trim(), window.location.origin + "/" + (view ?? ""))
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
  if (problem === "session_ended") return <div className="nv-access">{tone === "error" ? <p className="nv-sr" role="status" aria-live="polite" /> : live}<div className="nv-access__card">
    <Icon name="info" size={32} className="nv-access__icon" />
    <h1 className="nv-h2" tabIndex={-1} ref={accessHeadingRef}>Your session ended</h1>
    <p className="nv-muted">Sign in again to continue.{endedCanStore && ` ${DRAFT_TEXT.sessionEnded}`}</p>
    <form className="nv-access__form" onSubmit={event => { if (busy) { event.preventDefault(); return } void signIn(event) }}>
      <label className="nv-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="nv-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      {tone && <div key={tone} className={`nv-notice ${tone === "error" ? "nv-notice--error" : "nv-notice--ok"}`} style={{ margin: 0 }} role={tone === "error" ? "alert" : undefined}><Icon name={tone === "error" ? "alert" : "check"} /><p>{message}</p></div>}
      <button type="submit" className="nv-btn nv-btn--primary nv-btn--block" disabled={!ready} aria-disabled={busy || undefined}>{busy ? "Signing in…" : "Sign in"}</button>
      <div className="nv-or">or</div>
      <button type="button" className="nv-btn nv-btn--block" disabled={!ready} aria-disabled={busy || undefined} onClick={() => { if (!busy) void sendSignInLink() }}>Email me a sign-in link</button>
    </form>
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
  return <div>{tone === "error" ? <p className="nv-sr" role="status" aria-live="polite" /> : live}<Landing ready={ready} busy={busy} message={message} email={email} password={password} onEmail={setEmail} onPassword={setPassword} onSignIn={event => void signIn(event)} onSendLink={() => void sendSignInLink()} /></div>
}
