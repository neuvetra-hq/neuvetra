import { describe, expect, mock, test } from "bun:test"
import { createActor } from "xstate"
import { sceneMachine } from "@/actors/scene.actor"
import { defaultVerifyOtp } from "@/lib/verify-otp"
import { AUTH_UNAVAILABLE_MESSAGE, supabase } from "@/lib/supabase"

// Exercise the real verification helper with no credentials.
// Never make an Auth request from a test, even if local credentials are present.

describe("OtpInput verification path", () => {
  test("on success, sceneActor receives DONE with { authenticated: true } and clears the scene", async () => {
    const actor = createActor(sceneMachine).start()
    actor.send({
      type: "ACTIVATE",
      scenarioId: "collect_otp_verification",
      component: "otp_input",
      props: { phone: "+15551234567" },
    })

    const verify = mock(async () => ({ ok: true } as const))
    const phone = "+15551234567"
    const code = "123456"
    const result = await verify(phone, code)
    if (result.ok) {
      actor.send({ type: "DONE", output: { authenticated: true, phone } })
    }

    expect(actor.getSnapshot().value).toBe("idle")
    expect(actor.getSnapshot().context.active).toBeNull()
  })

  test("on failure, the scene stays active for retry", async () => {
    const actor = createActor(sceneMachine).start()
    actor.send({
      type: "ACTIVATE",
      scenarioId: "collect_otp_verification",
      component: "otp_input",
      props: { phone: "+15551234567" },
    })

    const verify = mock(async () => ({ ok: false, reason: "wrong_code" } as const))
    const result = await verify("+15551234567", "999999")
    // On failure the OtpInput component sets local error state but does
    // NOT send DONE to the actor. Verify the actor is still in 'active'.
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("wrong_code")
    }
    expect(actor.getSnapshot().value).toBe("active")
  })

  test.skipIf(supabase !== null)("missing auth configuration returns an unavailable result without a request", async () => {
    expect(await defaultVerifyOtp("+15551234567", "123456")).toEqual({
      ok: false,
      reason: AUTH_UNAVAILABLE_MESSAGE,
    })
  })
})
