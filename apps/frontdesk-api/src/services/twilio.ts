import twilio from "twilio"

const client = twilio(Bun.env.TWILIO_ACCOUNT_SID, Bun.env.TWILIO_AUTH_TOKEN)

const webhookBaseUrl = Bun.env.TWILIO_WEBHOOK_BASE_URL

if (!webhookBaseUrl) {
  console.warn("⚠️  TWILIO_WEBHOOK_BASE_URL not set — provisioning will fail")
}

export async function searchAvailableNumbers(areaCode: string) {
  const numbers = await client
    .availablePhoneNumbers("US")
    .local.list({ areaCode: parseInt(areaCode), voiceEnabled: true, limit: 5 })

  return numbers.map((n) => ({
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    locality: n.locality,
    region: n.region,
  }))
}

export async function provisionNumber(phoneNumber: string) {
  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber,
    voiceUrl: `${webhookBaseUrl}/webhooks/voice`,
    voiceMethod: "POST",
  })

  return {
    phoneNumber: purchased.phoneNumber,
    sid: purchased.sid,
    friendlyName: purchased.friendlyName,
  }
}

export async function releaseNumber(sid: string) {
  await client.incomingPhoneNumbers(sid).remove()
}

export async function sendSms(to: string, from: string, body: string) {
  await client.messages.create({ to, from, body })
}

export async function sendOptinConfirmation(phone: string): Promise<void> {
  const from = Bun.env.TWILIO_PHONE_NUMBER
  if (!from) {
    console.warn("[sendOptinConfirmation] TWILIO_PHONE_NUMBER not set — skipping")
    return
  }
  const body =
    "You're subscribed to Front Desk by Neuvetra transactional alerts " +
    "(appointment bookings, cancellations, callbacks). " +
    "Msg freq varies. Reply STOP to opt out, HELP for help. " +
    "Msg & Data Rates May Apply."
  await client.messages.create({ to: phone, from, body })
}
