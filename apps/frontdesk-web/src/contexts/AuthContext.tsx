import { createContext, useContext, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { loadUserProfile, loadOwnedBusiness, type UserProfile, type Business } from "@/lib/account-data"

export type { UserProfile, Business } from "@/lib/account-data"

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  profile: UserProfile | null
  business: Business | null
  isAuthenticated: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshBusiness: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)

  const loadAll = async (userId: string) => {
    const [p, b] = await Promise.all([loadUserProfile(supabase, userId), loadOwnedBusiness(supabase, userId)])
    setProfile(p)
    setBusiness(b)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user) await loadAll(data.session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadAll(session.user.id)
      } else {
        setProfile(null)
        setBusiness(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setBusiness(null)
  }

  // Silent refreshes — no loading state, children stay mounted
  const refreshProfile = async () => {
    if (session?.user) {
      const p = await loadUserProfile(supabase, session.user.id)
      setProfile(p)
    }
  }

  const refreshBusiness = async () => {
    if (session?.user) {
      const b = await loadOwnedBusiness(supabase, session.user.id)
      setBusiness(b)
    }
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      profile,
      business,
      isAuthenticated: !!session,
      signOut,
      refreshProfile,
      refreshBusiness,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
