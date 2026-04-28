import { Elysia } from "elysia"
import twilio from "twilio"

const twilioClient = twilio(Bun.env.TWILIO_ACCOUNT_SID, Bun.env.TWILIO_AUTH_TOKEN)

export const neuvetraRoutes = new Elysia()

  // Called by Retell during live calls when the agent invokes `capture_lead`
  .post("/neuvetra/lead", async ({ body }) => {
    const b = body as Record<string, string>
    const name    = b.caller_name    ?? "Unknown"
    const company = b.caller_company ?? ""
    const email   = b.caller_email   ?? ""
    const phone   = b.caller_phone   ?? ""
    const useCase = b.use_case       ?? ""

    const notifyPhone = Bun.env.NEUVETRA_NOTIFY_PHONE
    if (notifyPhone) {
      const lines = [
        `🎯 New Front Desk lead`,
        `Name: ${name}`,
        company ? `Company: ${company}` : null,
        phone   ? `Phone: ${phone}`     : null,
        email   ? `Email: ${email}`     : null,
        useCase ? `Interest: ${useCase}` : null,
      ].filter(Boolean).join("\n")

      await twilioClient.messages.create({
        to:   notifyPhone,
        from: Bun.env.TWILIO_PHONE_NUMBER!,
        body: lines,
      }).catch(() => {/* fire-and-forget */})
    }

    return { result: "Got it — someone from Neuvetra will be in touch within one business day." }
  })

  // Receives call_ended / call_analyzed events from Retell for the Neuvetra agent
  .post("/neuvetra/webhook", () => ({ received: true }))
