import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { SignInModal } from "./SignInModal"

const JOST = "'Jost Variable', 'Jost', sans-serif"

/**
 * Top-right pill that opens the sign-in modal when anonymous, or signs out
 * when authenticated. AgentIdentityBar (top-center) is the canonical
 * identity display — this button is purely the action affordance.
 *
 * Mirrors the chat-driven OTP flow in request-phone-verification + the
 * scene-mounted OtpInput; both paths land at the same `auth.users` row.
 */
export function SignInButton() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setAuthed(!!data.session?.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user)
      if (session?.user) setOpen(false)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    await supabase.auth.signOut()
    setSigningOut(false)
  }

  // Don't render until we've checked the session — avoids a "Sign in" flash
  // for already-authenticated users on page load.
  if (authed === null) return null

  return (
    <>
      <button
        type="button"
        onClick={() => (authed ? handleSignOut() : setOpen(true))}
        disabled={signingOut}
        className="pointer-events-auto fixed top-3 right-3 z-30 rounded-full px-4 py-1.5 backdrop-blur-md text-white/80 text-xs tracking-[0.18em] uppercase hover:text-white transition-colors duration-150 disabled:opacity-50 cursor-pointer"
        style={{
          fontFamily: JOST,
          background: "rgba(0, 0, 0, 0.32)",
          border: "1px solid rgba(120, 170, 220, 0.30)",
        }}
      >
        {authed ? (signingOut ? "Signing out…" : "Sign out") : "Sign in"}
      </button>
      {open && <SignInModal onClose={() => setOpen(false)} />}
    </>
  )
}
