import { test, expect } from "@playwright/test"

// ---------------------------------------------------------------------------
// No-calendar graceful handling
//
// When a business has no calendar connected, all scheduling function calls
// must return a specific, honest message — not the generic "try again" fallback.
//
// The message must:
//   - Not say "try again" or "call back" (it won't fix itself)
//   - Mention that scheduling/calendar/appointments aren't available
//   - Give the caller a real next step ("contact us directly")
//
// Tests that require TEST_BUSINESS_PHONE skip automatically without it.
// ---------------------------------------------------------------------------

const API_URL = process.env.API_URL ?? "http://localhost:3000"

async function retellCall(
  request: import("@playwright/test").APIRequestContext,
  funcName: string,
  args: Record<string, unknown>,
  toNumber = "+10000000000",
  fromNumber = "+19999999999",
) {
  return request.post(`${API_URL}/webhooks/retell`, {
    data: {
      event:     "function_call",
      name:      funcName,
      arguments: args,
      call:      { to_number: toNumber, from_number: fromNumber },
    },
  })
}

// ---------------------------------------------------------------------------
// These tests require a real business phone (TEST_BUSINESS_PHONE) whose
// calendar has been DISCONNECTED before running. They verify the specific
// no-calendar message is returned for each function.
//
// To run: disconnect calendar in Settings, then:
//   TEST_BUSINESS_PHONE=+1... bun run test:e2e --grep "no-calendar"
// ---------------------------------------------------------------------------

test.describe("no-calendar: all scheduling functions return specific message", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  const calendarFunctions = [
    {
      name: "check_availability",
      args: { requested_time: new Date(Date.now() + 86400000).toISOString(), duration_minutes: 30 },
    },
    {
      name: "book_appointment",
      args: {
        start_time:       new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 30,
        customer_name:    "Test Caller",
        customer_phone:   "+19999999999",
        reason:           "Consultation",
      },
    },
    {
      name: "find_appointment",
      args: {},
    },
    {
      name: "cancel_appointment",
      args: { event_id: "fake-id" },
    },
    {
      name: "reschedule_appointment",
      args: {
        event_id:         "fake-id",
        new_start_time:   new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 30,
      },
    },
  ]

  for (const fn of calendarFunctions) {
    test(`${fn.name} returns a specific no-calendar message (not generic error)`, async ({ request }) => {
      test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run (and disconnect the calendar first)")

      const res  = await retellCall(request, fn.name, fn.args, businessPhone!)
      const body = await res.json() as { result?: string; error?: string }

      expect(res.ok()).toBeTruthy()

      // Must have a result, not just an error
      expect(typeof body.result).toBe("string")

      // Must mention scheduling/calendar/appointments not being available
      expect(body.result!.toLowerCase()).toMatch(
        /not able|can't|cannot|not connected|not set up|scheduling|calendar/
      )

      // Must give a real next step — not "try again" (it won't self-heal)
      expect(body.result!.toLowerCase()).not.toMatch(/try again in a moment|please try again/)

      // Must not say "unknown function" — it recognised the function
      expect(body.result!.toLowerCase()).not.toContain("unknown function")

      // Must not contain "Please ask the caller" (convention rule)
      expect(body.result!.toLowerCase()).not.toContain("ask the caller")
    })
  }
})

// ---------------------------------------------------------------------------
// Graceful structural tests — no fixtures needed
// (Unknown business → structured error, not a crash)
// ---------------------------------------------------------------------------

test.describe("no-calendar: graceful handling (no fixtures needed)", () => {
  test("scheduling functions with unknown business return { result } or { error } — not a crash", async ({ request }) => {
    const funcs = [
      { name: "check_availability",     args: { requested_time: new Date().toISOString(), duration_minutes: 30 } },
      { name: "book_appointment",        args: { start_time: new Date().toISOString(), duration_minutes: 30, customer_name: "X", customer_phone: "+1", reason: "test" } },
      { name: "find_appointment",        args: {} },
      { name: "cancel_appointment",      args: { event_id: "fake" } },
      { name: "reschedule_appointment",  args: { event_id: "fake", new_start_time: new Date().toISOString(), duration_minutes: 30 } },
    ]

    for (const { name, args } of funcs) {
      const res  = await retellCall(request, name, args) // unknown business (+10000000000)
      expect(res.ok(), `${name} must return 200`).toBeTruthy()
      const body = await res.json() as Record<string, unknown>
      expect(
        typeof body.result === "string" || typeof body.error === "string",
        `${name} must return result or error string`,
      ).toBeTruthy()
    }
  })
})
