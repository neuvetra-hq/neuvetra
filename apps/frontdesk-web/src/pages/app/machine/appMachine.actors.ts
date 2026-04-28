import { fromPromise, fromCallback } from "xstate"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { AppEvent, AppUserProfile, AppBusiness } from "./appMachine.types"

export const checkWebGL = fromPromise(async (): Promise<boolean> => {
  const canvas = document.createElement("canvas")
  return !!canvas.getContext("webgl2")
})

export const getSession = fromPromise(async (): Promise<Session | null> => {
  const { data } = await supabase.auth.getSession()
  return data.session
})

export const loadProfile = fromPromise(
  async ({
    input,
  }: {
    input: { userId: string }
  }): Promise<{ profile: AppUserProfile | null; business: AppBusiness | null }> => {
    const [{ data: userData }, { data: memberData }] = await Promise.all([
      supabase
        .from("users")
        .select("id, first_name, last_name, phone")
        .eq("id", input.userId)
        .maybeSingle(),
      supabase
        .from("business_members")
        .select(
          "businesses(id, name, status, business_type, twilio_number, stripe_plan_id, stripe_subscription_id, ai_config)"
        )
        .eq("user_id", input.userId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle(),
    ])

    const profile: AppUserProfile | null = userData
      ? {
          id: userData.id as string,
          firstName: userData.first_name as string,
          lastName: userData.last_name as string,
          phone: userData.phone as string,
        }
      : null

    const b = memberData?.businesses as unknown as Record<string, unknown> | null
    const business: AppBusiness | null = b
      ? {
          id: b.id as string,
          name: b.name as string,
          status: b.status as AppBusiness["status"],
          businessType: (b.business_type as string) ?? null,
          twilioNumber: (b.twilio_number as string) ?? null,
          stripePlanId: (b.stripe_plan_id as string) ?? null,
          stripeSubscriptionId: (b.stripe_subscription_id as string) ?? null,
          aiConfig: (b.ai_config as Record<string, unknown>) ?? null,
        }
      : null

    return { profile, business }
  }
)

export const supabaseAuthListener = fromCallback<AppEvent>(({ sendBack }) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    sendBack({ type: "AUTH_STATE_CHANGED", session })
  })
  return () => subscription.unsubscribe()
})
