import { useState, useEffect } from "react"
import { AUTH_UNAVAILABLE_MESSAGE, supabase } from "@/lib/supabase"
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
  const [authed, setAuthed] = useState<boolean | null>(supabase ? null : false)
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!supabase) return
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
    if (signingOut || !supabase) return
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
        disabled={signingOut || !supabase}
        title={!supabase ? AUTH_UNAVAILABLE_MESSAGE : undefined}
        className="shrink-0 rounded-full px-3 py-2 text-[0.65rem] tracking-[0.1em] text-white/80 uppercase backdrop-blur-md transition-colors duration-150 hover:bg-white/5 hover:text-white disabled:cursor-default disabled:text-white/45 sm:px-4 sm:text-xs sm:tracking-[0.16em] cursor-pointer"
        style={{
          fontFamily: JOST,
          background: "rgba(0, 0, 0, 0.32)",
          border: "1px solid rgba(120, 170, 220, 0.30)",
        }}
      >
        {!supabase ? "Sign-in unavailable" : authed ? (signingOut ? "Signing out…" : "Sign out") : "Sign in"}
      </button>
      {open && <SignInModal onClose={() => setOpen(false)} />}
    </>
  )
}
