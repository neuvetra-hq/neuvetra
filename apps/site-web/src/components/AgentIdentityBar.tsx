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
    if (!supabase) return
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
      className="min-w-0 rounded-full px-3 py-2 backdrop-blur-md sm:px-4"
      style={{
        fontFamily: JOST,
        background: "rgba(0, 0, 0, 0.32)",
        border: "1px solid rgba(120, 170, 220, 0.30)",
      }}
    >
      <span className="block truncate text-[0.65rem] tracking-[0.1em] text-white/75 uppercase sm:text-xs sm:tracking-[0.16em]">
        {user
          ? `Iris · talking to ${user.name ?? user.phone ?? "you"}`
          : "Iris · Neuvetra greeter"}
      </span>
    </div>
  )
}
