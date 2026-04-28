import { createContext, useContext, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  phone: string
}

export interface Business {
  id: string
  name: string
  status: "active" | "inactive" | "suspended"
  businessType: string | null
  twilioNumber: string | null
  stripePlanId: string | null
  stripeSubscriptionId: string | null
  aiConfig: Record<string, unknown> | null
}

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

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("users")
    .select("id, first_name, last_name, phone")
    .eq("id", userId)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id as string,
    firstName: data.first_name as string,
    lastName: data.last_name as string,
    phone: data.phone as string,
  }
}

async function fetchBusiness(userId: string): Promise<Business | null> {
  const { data } = await supabase
    .from("business_members")
    .select("businesses(id, name, status, business_type, twilio_number, stripe_plan_id, stripe_subscription_id, ai_config)")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle()

  if (!data?.businesses) return null
  const b = data.businesses as unknown as Record<string, unknown>
  return {
    id: b.id as string,
    name: b.name as string,
    status: b.status as Business["status"],
    businessType: (b.business_type as string) ?? null,
    twilioNumber: (b.twilio_number as string) ?? null,
    stripePlanId: (b.stripe_plan_id as string) ?? null,
    stripeSubscriptionId: (b.stripe_subscription_id as string) ?? null,
    aiConfig: (b.ai_config as Record<string, unknown>) ?? null,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)

  const loadAll = async (userId: string) => {
    const [p, b] = await Promise.all([fetchProfile(userId), fetchBusiness(userId)])
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
      const p = await fetchProfile(session.user.id)
      setProfile(p)
    }
  }

  const refreshBusiness = async () => {
    if (session?.user) {
      const b = await fetchBusiness(session.user.id)
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
