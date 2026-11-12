import { useEffect, useRef, useState, type FormEvent } from "react"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { StagingWorkspace } from "./StagingWorkspace"
import { Landing } from "./Landing"
import { signInNoticeTone } from "@/lib/sign-in-notice"
import { Icon } from "./Icon"
import { decodeStagingAccess, decodeStagingConfig } from "@/lib/staging-session"
import { acceptedViewHash, forgetReturnView, markDeliberateSignOut, parseViewHash, peekReturnView, recentlySignedOut, rememberReturnView, takeReturnView, viewHash } from "@/lib/view-route"

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
  const signInFromUrl = useRef(typeof window !== "undefined" && /[?&]code=/.test(window.location.search))
  // Whose session ended here: the sign-in link carries their view only if they are the one signing in again.
  const endedUser = useRef<{ userId: string; email: string | null } | null>(null)

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
          const trusted = !otherUser && (opened.current !== null || (loadUser.current === userId && !signInFromUrl.current))
          const shown = acceptedViewHash(window.location.hash)
          let target = shown
          if (shown && !trusted && parseViewHash(shown).recordId && returnView !== shown) target = returnView ?? viewHash(parseViewHash(shown).panel, null)
          if (!target && returnView) target = returnView
          if (target && target !== window.location.hash) window.history.replaceState(null, "", target)
          opened.current = { userId, epoch: value.epoch }
          endedUser.current = null
        }
        setActive(value)
      },
      onSignedIn: setSignedIn, onMessage: setMessage, onProblem: setProblem, onReconnecting: setReconnecting,
      onSessionEnded: ({ userId, email: endedEmail, cause }) => {
        // QA B1 / CEO ruling: the view is kept only in the stored return view (bound to this user) and leaves the URL.
        // A SIGNED_OUT caused by a deliberate sign-out in another tab doesn't write it back.
        if (!(cause === "signed_out" && recentlySignedOut(viewStorage()))) rememberReturnView(viewStorage(), userId, window.location.hash)
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
        const storageKey = `neuvetra:m63:${config.projectRef}:auth`
        if (opened.current === null && !signInFromUrl.current) loadUser.current = storedSessionUser(storageKey)
        authClient = createClient(config.supabaseUrl, config.anonKey, { auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } })
        setClient(authClient)
        const { data } = authClient.auth.onAuthStateChange((_event, session) => { authEvents++; void lifecycle.authorize(session) })
        unsubscribe = () => data.subscription.unsubscribe()
        const initialAuthEvents = authEvents
        const result = await authClient.auth.getSession()
        if (alive && authEvents === initialAuthEvents) await lifecycle.authorize(result.data.session)
      } catch { if (alive) setMessage("Neuvetra is unavailable right now. Please try again later.") }
    }
    const onFocus = () => { void lifecycle.refresh() }
    const interval = window.setInterval(onFocus, 60_000)
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onFocus)
    void initialize()
    return () => { alive = false; lifecycle.dispose(); configuration.abort(); unsubscribe(); authClient?.auth.stopAutoRefresh(); window.clearInterval(interval); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus) }
  }, [])

  // Each access state puts focus on its own heading when it appears (WO-05a).
  const accessState = active ? null : problem
  useEffect(() => { if (accessState) accessHeadingRef.current?.focus() }, [accessState])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!client || busy) return
    authorization.current?.allowSignIn(); setBusy(true); setMessage("Signing in…")
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMessage("Sign-in failed. Check your invited account details.")
    } catch { setMessage("Sign-in is unavailable. Please try again.") }
    finally { setPassword(""); setBusy(false) }
  }
  async function signOut() {
    // A deliberate sign-out is the only thing that forgets the view address.
    authorization.current?.signOut(); setBusy(true)
    clearViewHash(); forgetReturnView(viewStorage()); markDeliberateSignOut(viewStorage())
    opened.current = null; loadUser.current = null; endedUser.current = null
    try {
      if (!client) throw new Error("Authentication unavailable")
      const { error } = await client.auth.signOut({ scope: "local" })
      if (error) throw error
      setMessage("Signed out on this browser.")
    }
    catch { setMessage("The workspace is closed. Session sign-out could not be confirmed; retry before leaving a shared browser.") }
    finally { setBusy(false) }
  }
  async function sendSignInLink() {
    if (!client || busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage("Enter your invited email address first."); return }
    authorization.current?.allowSignIn(); setBusy(true)
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
    <header className="nv-topbar">
      <a className="nv-brand" href="/" aria-label="Neuvetra workspace home"><span className="nv-brand__mark" aria-hidden="true" />Neuvetra</a>
      <span className="nv-badge nv-badge--hide-sm">Private beta · synthetic data</span>
      <div className="nv-topbar__actions">
        <span className="nv-topbar__user" title={active.session.user.email ?? undefined}>{active.session.user.email}</span>
        <button type="button" className="nv-btn nv-btn--ghost nv-btn--sm" disabled={busy} onClick={() => void signOut()}>Sign out</button>
      </div>
    </header>
    {/* Risk 2: a transient failure keeps the workspace and its unsaved input; this notice is visual (the live region speaks). */}
    {reconnecting && <div className="nv-reconnecting-wrap"><div className="nv-notice nv-notice--warn"><Icon name="alert" /><p>{ACCESS_TEXT.retrying} Your work on this page stays here.</p></div></div>}
    <StagingWorkspace key={`${active.session.user.id}:${active.epoch}`} headingRef={headingRef} staging={{ actor: active.actor, workspaceId: active.access.access.workspaceId, evidenceId: active.access.access.evidenceId }} />
  </div>
  if (problem === "session_ended") return <div className="nv-access">{tone === "error" ? <p className="nv-sr" role="status" aria-live="polite" /> : live}<div className="nv-access__card">
    <Icon name="info" size={32} className="nv-access__icon" />
    <h1 className="nv-h2" tabIndex={-1} ref={accessHeadingRef}>Your session ended</h1>
    <p className="nv-muted">Sign in again to continue.</p>
    <form className="nv-access__form" onSubmit={event => { if (busy) { event.preventDefault(); return } void signIn(event) }}>
      <label className="nv-field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label className="nv-field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      {tone && <div key={tone} className={`nv-notice ${tone === "error" ? "nv-notice--error" : "nv-notice--ok"}`} style={{ margin: 0 }} role={tone === "error" ? "alert" : undefined}><Icon name={tone === "error" ? "alert" : "check"} /><p>{message}</p></div>}
      <button type="submit" className="nv-btn nv-btn--primary nv-btn--block" disabled={!client} aria-disabled={busy || undefined}>{busy ? "Signing in…" : "Sign in"}</button>
      <div className="nv-or">or</div>
      <button type="button" className="nv-btn nv-btn--block" disabled={!client} aria-disabled={busy || undefined} onClick={() => { if (!busy) void sendSignInLink() }}>Email me a sign-in link</button>
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
  return <div>{tone === "error" ? <p className="nv-sr" role="status" aria-live="polite" /> : live}<Landing ready={Boolean(client)} busy={busy} message={message} email={email} password={password} onEmail={setEmail} onPassword={setPassword} onSignIn={event => void signIn(event)} onSendLink={() => void sendSignInLink()} /></div>
}
