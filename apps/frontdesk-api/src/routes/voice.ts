import { Elysia } from "elysia"
import twilio from "twilio"

const AccessToken = twilio.jwt.AccessToken
const VoiceGrant = AccessToken.VoiceGrant
const VoiceResponse = twilio.twiml.VoiceResponse

export const voiceRoutes = new Elysia()
  .get("/voice-token", () => {
    const token = new AccessToken(
      Bun.env.TWILIO_ACCOUNT_SID!,
      Bun.env.TWILIO_API_KEY_SID!,
      Bun.env.TWILIO_API_SECRET!,
      { identity: "browser-caller", ttl: 3600 }
    )
    token.addGrant(new VoiceGrant({
      outgoingApplicationSid: Bun.env.TWILIO_TWIML_APP_SID!,
    }))
    return { token: token.toJwt() }
  })
  .post("/voice/outbound", ({ set }) => {
    const response = new VoiceResponse()
    const dial = response.dial({ callerId: Bun.env.TWILIO_PHONE_NUMBER! })
    dial.number(Bun.env.TWILIO_PHONE_NUMBER!)
    set.headers["content-type"] = "text/xml"
    return response.toString()
  })
