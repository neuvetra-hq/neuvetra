import { useEffect, useRef, useState, type FormEvent } from "react"
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { StagingWorkspace } from "./StagingWorkspace"
import { decodeStagingAccess, decodeStagingConfig, type StagingAccess } from "@/lib/staging-session"

interface ActiveSession { session: Session; access: StagingAccess; epoch: number; controller: AbortController }

export function PrivateStaging() {
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [active, setActive] = useState<ActiveSession | null>(null)
  const [message, setMessage] = useState("Checking private staging…")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const epoch = useRef(0)
  const activeController = useRef<AbortController | null>(null)
  const clearSession = useRef<() => void>(() => {})
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let alive = true
    let authClient: SupabaseClient | null = null
    let unsubscribe = () => {}
    let latest: Session | null = null
    const configuration = new AbortController()
    const invalidate = () => {
      epoch.current += 1
      activeController.current?.abort()
      activeController.current = null
      if (alive) setActive(null)
    }
    clearSession.current = () => { invalidate(); setMessage("Your access changed. Sign in again or contact the staging owner.") }
    async function authorize(session: Session | null, reset = true) {
      if (!alive) return
      if (reset) invalidate()
      latest = session
      setSignedIn(Boolean(session))
      if (!session) { setMessage("Sign in with your invited staging account."); return }
      const current = epoch.current
      try {
        const response = await fetch("/workspace-api/session", { headers: { authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: configuration.signal })
        if (!response.ok) throw new Error()
        const access = decodeStagingAccess(await response.json(), session.user.id)
        if (!alive || current !== epoch.current) return
        if (reset) {
          const controller = new AbortController()
          activeController.current = controller
          setActive({ session, access, epoch: current, controller })
        } else {
          setActive(previous => {
            if (!previous || previous.access.access.role !== access.access.role || previous.access.access.workspaceId !== access.access.workspaceId) {
              activeController.current?.abort()
              return null
            }
            return previous
          })
        }
        setMessage("Private staging access verified.")
      } catch {
        if (!alive || current !== epoch.current) return
        invalidate()
        setMessage("Staging access is unavailable or your invitation is inactive. Contact the staging owner.")
      }
    }
    async function initialize() {
      try {
        const response = await fetch("/workspace-api/config", { cache: "no-store", signal: configuration.signal })
        if (!response.ok) throw new Error()
        const config = decodeStagingConfig(await response.json())
        if (!alive) return
        authClient = createClient(config.supabaseUrl, config.anonKey, { auth: { storageKey: `neuvetra:m63:${config.projectRef}:auth`, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } })
        setClient(authClient)
        const { data } = authClient.auth.onAuthStateChange((_event, session) => { void authorize(session) })
        unsubscribe = () => data.subscription.unsubscribe()
        const initialEpoch = epoch.current
        const result = await authClient.auth.getSession()
        if (alive && epoch.current === initialEpoch) await authorize(result.data.session)
      } catch { if (alive) setMessage("Private staging is unavailable. Please try again later.") }
    }
    const onFocus = () => { if (latest) void authorize(latest, false) }
    const interval = window.setInterval(onFocus, 60_000)
    window.addEventListener("focus", onFocus)
    void initialize()
    return () => { alive = false; invalidate(); configuration.abort(); unsubscribe(); authClient?.auth.stopAutoRefresh(); window.clearInterval(interval); window.removeEventListener("focus", onFocus) }
  }, [])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!client || busy) return
    setBusy(true); setMessage("Signing in…")
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMessage("Sign-in failed. Check your invited account details.")
    } catch { setMessage("Sign-in is unavailable. Please try again.") }
    finally { setPassword(""); setBusy(false) }
  }
  async function signOut() {
    clearSession.current(); setSignedIn(false); setBusy(true)
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
    setBusy(true)
    try {
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + "/" } })
      if (error) throw error
      setMessage("If this email has an approved account, a sign-in link is on its way. Open it in this browser.")
    } catch { setMessage("The sign-in link could not be sent. Please try again later.") }
    finally { setBusy(false) }
  }

  return <main className="staging-shell">
    <header className="staging-header"><a href="/" aria-label="Neuvetra private staging home">Neuvetra</a><span>Private staging</span>{signedIn && <button type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>}</header>
    <p className="staging-notice">Synthetic company records only. This is a private testing environment, not a customer inventory, filing or assurance service.</p>
    <p role="status" aria-live="polite">{message}</p>
    {!active && !signedIn && <section className="staging-signin"><h1>Welcome back</h1><p>Use the account approved for this private staging environment.</p><form onSubmit={event => void signIn(event)}><label>Email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label><button type="button" disabled={!client || busy} onClick={() => void sendSignInLink()}>Email me a sign-in link</button><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label><button type="submit" disabled={!client || busy}>{busy ? "Signing in…" : "Sign in with password"}</button></form><p>Access is by invitation. There is no public registration.</p></section>}
    {active && <StagingWorkspace key={`${active.session.user.id}:${active.epoch}`} headingRef={headingRef} staging={{ actor: { accessToken: active.session.access_token, userId: active.session.user.id, role: active.access.access.role, signal: active.controller.signal, onUnauthorized: () => clearSession.current() }, workspaceId: active.access.access.workspaceId, evidenceId: active.access.access.evidenceId }} />}
  </main>
}
