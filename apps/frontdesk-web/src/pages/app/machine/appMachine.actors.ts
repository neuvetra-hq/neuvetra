import { fromPromise, fromCallback } from "xstate"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { loadUserProfile, loadOwnedBusiness } from "@/lib/account-data"
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
    const [profile, business] = await Promise.all([
      loadUserProfile(supabase, input.userId),
      loadOwnedBusiness(supabase, input.userId),
    ])
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
