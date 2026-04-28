import type { Session } from "@supabase/supabase-js"
import type { AnyActorRef } from "xstate"
import type { SectionTheme } from "@/data/section-themes"

export interface AppUserProfile {
  id: string
  firstName: string
  lastName: string
  phone: string
}

export interface AppBusiness {
  id: string
  name: string
  status: "active" | "inactive" | "suspended"
  businessType: string | null
  twilioNumber: string | null
  stripePlanId: string | null
  stripeSubscriptionId: string | null
  aiConfig: Record<string, unknown> | null
}

export interface AppContext {
  session: Session | null
  profile: AppUserProfile | null
  business: AppBusiness | null
  currentRoute: string
  currentTheme: SectionTheme
  spiritActorRef: AnyActorRef | null
}

export type AppEvent =
  | { type: "AUTH_STATE_CHANGED"; session: Session | null }
  | { type: "SIGN_OUT" }
  | { type: "ROUTE_CHANGED"; pathname: string }
  | { type: "SPIRIT_READY" }
  | { type: "REGISTER_SPIRIT"; actorRef: AnyActorRef }
