import type { Session } from "@supabase/supabase-js"
import type { AnyActorRef } from "xstate"
import type { SectionTheme } from "@/data/section-themes"
import type { UserProfile as AppUserProfile, Business as AppBusiness } from "@/lib/account-data"

export type { UserProfile as AppUserProfile, Business as AppBusiness } from "@/lib/account-data"

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
