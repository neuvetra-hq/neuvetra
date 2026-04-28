import type { ScenarioDescriptor } from "./types"

export const collectOtpVerification: ScenarioDescriptor = {
  id: "collect_otp_verification",
  name: "Collect OTP verification code",
  description:
    "The user has just been sent a 6-digit verification code to their phone. Mount the OTP input on the scene region so they can enter it.",
  goal: "Receive a valid 6-digit code from the user and authenticate them via Supabase.",
  surface: "scene",
  scene: {
    component: "otp_input",
    propNames: ["phone"],
  },
}
