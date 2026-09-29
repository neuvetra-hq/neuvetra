import { useEffect, useRef, useState, type FormEvent } from "react"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { StagingWorkspace } from "./StagingWorkspace"
import { Landing } from "./Landing"
import { Icon } from "./Icon"
import { decodeStagingAccess, decodeStagingConfig } from "@/lib/staging-session"

import { createStagingAuthorization, type ActiveStagingSession } from "@/lib/staging-authorization"

export function PrivateStaging() {
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [active, setActive] = useState<ActiveStagingSession | null>(null)
  const [message, setMessage] = useState("Checking private staging…")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const authorization = useRef<ReturnType<typeof createStagingAuthorization> | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let alive = true
    let authClient: SupabaseClient | null = null
    let unsubscribe = () => {}
    let authEvents = 0
    const configuration = new AbortController()
    const lifecycle = createStagingAuthorization({
      verify: async (session, signal) => {
        const response = await fetch("/workspace-api/session", { headers: { authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal })
        if (!response.ok) throw new Error("Access unavailable")
        return decodeStagingAccess(await response.json(), session.user.id)
      },
      onActive: setActive, onSignedIn: setSignedIn, onMessage: setMessage,
    })
    authorization.current = lifecycle
    async function initialize() {
      try {
        const response = await fetch("/workspace-api/config", { cache: "no-store", signal: configuration.signal })
        if (!response.ok) throw new Error()
        const config = decodeStagingConfig(await response.json())
        if (!alive) return
        authClient = createClient(config.supabaseUrl, config.anonKey, { auth: { storageKey: `neuvetra:m63:${config.projectRef}:auth`, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } })
        setClient(authClient)
        const { data } = authClient.auth.onAuthStateChange((_event, session) => { authEvents++; void lifecycle.authorize(session) })
        unsubscribe = () => data.subscription.unsubscribe()
        const initialAuthEvents = authEvents
        const result = await authClient.auth.getSession()
        if (alive && authEvents === initialAuthEvents) await lifecycle.authorize(result.data.session)
      } catch { if (alive) setMessage("Private staging is unavailable. Please try again later.") }
    }
    const onFocus = () => { void lifecycle.refresh() }
    const interval = window.setInterval(onFocus, 60_000)
    window.addEventListener("focus", onFocus)
    void initialize()
    return () => { alive = false; lifecycle.dispose(); configuration.abort(); unsubscribe(); authClient?.auth.stopAutoRefresh(); window.clearInterval(interval); window.removeEventListener("focus", onFocus) }
  }, [])

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
    authorization.current?.signOut(); setBusy(true)
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
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + "/" } })
      if (error) throw error
      setMessage("If this email has an approved account, a sign-in link is on its way. Open it in this browser.")
    } catch { setMessage("The sign-in link could not be sent. Please try again later.") }
    finally { setBusy(false) }
  }

  const accessProblem = /unavailable|inactive|changed|could not/i.test(message)
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
    <StagingWorkspace key={`${active.session.user.id}:${active.epoch}`} headingRef={headingRef} staging={{ actor: active.actor, workspaceId: active.access.access.workspaceId, evidenceId: active.access.access.evidenceId }} />
  </div>
  if (signedIn) return <div className="nv-access">{live}<div className="nv-access__card">
    {accessProblem ? <Icon name="alert" size={32} className="nv-access__icon" /> : <div className="nv-spinner" aria-hidden="true" />}
    <h1 className="nv-h2">{accessProblem ? "We couldn’t open your workspace" : "Opening your workspace…"}</h1>
    <p className="nv-muted">{accessProblem ? message : "Checking your invitation and company access."}</p>
    <button type="button" className="nv-btn" disabled={busy} onClick={() => void signOut()}>Sign out</button>
  </div></div>
  return <div>{live}<Landing ready={Boolean(client)} busy={busy} message={message} email={email} password={password} onEmail={setEmail} onPassword={setPassword} onSignIn={event => void signIn(event)} onSendLink={() => void sendSignInLink()} /></div>
}
