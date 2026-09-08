import { AUTH_UNAVAILABLE_MESSAGE, supabase } from "./supabase"

export type VerifyOtp = (
  phone: string,
  code: string,
) => Promise<{ ok: true } | { ok: false; reason: string }>

export const defaultVerifyOtp: VerifyOtp = async (phone, code) => {
  if (!supabase) return { ok: false, reason: AUTH_UNAVAILABLE_MESSAGE }
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  })
  if (error) return { ok: false, reason: error.message ?? "verify_failed" }
  return { ok: true }
}
