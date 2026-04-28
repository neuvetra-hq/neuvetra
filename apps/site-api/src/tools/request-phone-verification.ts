import { tool, jsonSchema } from "ai"
import { getSupabase } from "../lib/supabase"
import { collectOtpVerification } from "../scenarios/collect-otp-verification"

export interface RequestPhoneVerificationInput {
  phone: string
}

/**
 * Triggers Supabase Auth's signInWithOtp flow for the given phone, then
 * returns a SCENARIO_ACTIVATE directive so the client surfaces the OTP
 * input. Called by the greeter when it has the user's phone number from
 * conversation and the user is not yet authenticated.
 *
 * Phone format: tool accepts free-form input and normalizes via simple
 * E.164 cleanup (10-digit numbers default to +1 / US). Supabase rejects
 * malformed numbers; we surface the failure as { ok: false, error: ... }
 * so the agent can ask the user to re-state.
 */
export const requestPhoneVerificationTool = tool({
  description:
    "Send a 6-digit verification code to the user's phone via SMS. Use when you have the user's phone number from conversation and they are not yet authenticated. The system surfaces the OTP input automatically — don't ask the user to read the code aloud.",
  inputSchema: jsonSchema<RequestPhoneVerificationInput>({
    type: "object",
    properties: {
      phone: {
        type: "string",
        description:
          "User's phone number in any format. Will be normalized to E.164.",
      },
    },
    required: ["phone"],
    additionalProperties: false,
  }),
  execute: async ({ phone }) => {
    const normalized = normalizeE164(phone)
    if (!normalized) {
      return { ok: false, error: "phone_invalid" as const }
    }
    const supabase = getSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { channel: "sms" },
    })
    if (error) {
      console.error(
        "[request_phone_verification] signInWithOtp failed:",
        error.message,
      )
      return { ok: false, error: "send_failed" as const }
    }
    // Returning a structured scenario directive — the route's stream
    // surfaces this verbatim in the tool-output, the orchestrator picks
    // it up, the scene region mounts OtpInput.
    return {
      ok: true,
      scenario: {
        id: collectOtpVerification.id,
        props: { phone: normalized },
      },
    }
  },
})

function normalizeE164(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) {
    return digits.length >= 10 && digits.length <= 16 ? digits : null
  }
  // 10-digit US number → assume +1
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return null
}
