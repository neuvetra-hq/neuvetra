import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

const JOST = "'Jost Variable', 'Jost', sans-serif"

interface UserSummary {
  phone: string | null
  name: string | null
}

/**
 * Top-of-page identity strip. Anonymous users see a soft "Iris — Neuvetra
 * greeter" label. Authenticated users see "Iris — talking to <name|phone>".
 *
 * Listens to Supabase auth state changes so the bar flips immediately
 * after OTP success without a page reload.
 */
export function AgentIdentityBar() {
  const [user, setUser] = useState<UserSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const u = data.session?.user ?? null
      setUser(
        u
          ? {
              phone: u.phone ?? null,
              name: (u.user_metadata?.full_name as string | undefined) ?? null,
            }
          : null,
      )
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(
        u
          ? {
              phone: u.phone ?? null,
              name: (u.user_metadata?.full_name as string | undefined) ?? null,
            }
          : null,
      )
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <div
      className="pointer-events-auto fixed top-3 left-1/2 -translate-x-1/2 z-30 rounded-full px-4 py-1.5 backdrop-blur-md"
      style={{
        fontFamily: JOST,
        background: "rgba(0, 0, 0, 0.32)",
        border: "1px solid rgba(120, 170, 220, 0.30)",
      }}
    >
      <span className="text-white/80 text-xs tracking-[0.18em] uppercase">
        {user
          ? `Iris · talking to ${user.name ?? user.phone ?? "you"}`
          : "Iris · Neuvetra greeter"}
      </span>
    </div>
  )
}
