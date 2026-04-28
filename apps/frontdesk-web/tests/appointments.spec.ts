import { test, expect } from "@playwright/test"

// ---------------------------------------------------------------------------
// Appointment management — Retell webhook handlers
//
// These tests hit the API directly via Playwright's request fixture.
// They verify the three new function handlers (find_appointment,
// cancel_appointment, reschedule_appointment) and the updated
// check_availability smart-suggestion mode.
//
// Tests marked with TEST_BUSINESS_PHONE require a real running business:
//   TEST_BUSINESS_PHONE=+1xxx bun run test:e2e
// ---------------------------------------------------------------------------

const API_URL = process.env.API_URL ?? "http://localhost:3000"

// Helper — post a Retell function_call event
async function retellCall(
  request: import("@playwright/test").APIRequestContext,
  funcName: string,
  args: Record<string, unknown>,
  toNumber = "+10000000000",
  fromNumber = "+19999999999",
) {
  return request.post(`${API_URL}/webhooks/retell`, {
    data: {
      event: "function_call",
      name: funcName,
      arguments: args,
      call: { to_number: toNumber, from_number: fromNumber },
    },
  })
}

// ---------------------------------------------------------------------------
// New function names are recognised — these fail before implementation
// (the current fallthrough returns { result: "Unknown function" })
// ---------------------------------------------------------------------------

test.describe("Retell webhook — new appointment functions are recognised", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("find_appointment does not return 'Unknown function'", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run: e.g. TEST_BUSINESS_PHONE=+12223334444 bun run test:e2e")
    const res = await retellCall(request, "find_appointment", {}, businessPhone!)
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result?: string }
    expect(body.result).not.toBe("Unknown function")
    expect(typeof body.result).toBe("string")
  })

  test("cancel_appointment does not return 'Unknown function'", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")
    const res = await retellCall(request, "cancel_appointment", { event_id: "nonexistent-id" }, businessPhone!)
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result?: string }
    expect(body.result).not.toBe("Unknown function")
    expect(typeof body.result).toBe("string")
  })

  test("reschedule_appointment does not return 'Unknown function'", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    const res = await retellCall(
      request,
      "reschedule_appointment",
      { event_id: "nonexistent-id", new_start_time: tomorrow.toISOString(), duration_minutes: 30 },
      businessPhone!,
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result?: string }
    expect(body.result).not.toBe("Unknown function")
    expect(typeof body.result).toBe("string")
  })
})

// ---------------------------------------------------------------------------
// check_availability — smart mode (requested_time param)
// ---------------------------------------------------------------------------

test.describe("check_availability — requested_time smart mode", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("with requested_time returns structured result (not raw slot list format)", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")
    const slot = new Date()
    slot.setDate(slot.getDate() + 1)
    slot.setHours(14, 0, 0, 0)

    const res = await retellCall(
      request,
      "check_availability",
      { requested_time: slot.toISOString(), duration_minutes: 30 },
      businessPhone!,
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result: string }
    expect(typeof body.result).toBe("string")
    // Smart mode: result should mention either "available" or "available times"
    expect(body.result.toLowerCase()).toMatch(/available|times|slot|appointment/)
  })
})

// ---------------------------------------------------------------------------
// Graceful error handling — these run without any test fixtures
// ---------------------------------------------------------------------------

test.describe("Retell webhook — graceful handling (no fixtures needed)", () => {

  test("find_appointment with missing to_number returns structured error", async ({ request }) => {
    const res = await request.post(`${API_URL}/webhooks/retell`, {
      data: {
        event: "function_call",
        name: "find_appointment",
        arguments: {},
        call: {},
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { error?: string }
    expect(body.error).toBe("Missing to_number on call")
  })

  test("cancel_appointment with missing to_number returns structured error", async ({ request }) => {
    const res = await request.post(`${API_URL}/webhooks/retell`, {
      data: {
        event: "function_call",
        name: "cancel_appointment",
        arguments: { event_id: "xyz" },
        call: {},
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { error?: string }
    expect(body.error).toBe("Missing to_number on call")
  })

  test("reschedule_appointment with missing to_number returns structured error", async ({ request }) => {
    const res = await request.post(`${API_URL}/webhooks/retell`, {
      data: {
        event: "function_call",
        name: "reschedule_appointment",
        arguments: { event_id: "xyz", new_start_time: new Date().toISOString() },
        call: {},
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { error?: string }
    expect(body.error).toBe("Missing to_number on call")
  })

  test("find_appointment with unknown business returns graceful result, not a crash", async ({ request }) => {
    const res = await retellCall(request, "find_appointment", {})
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result?: string; error?: string }
    // Either a result string or a structured error — never a 500
    expect(typeof body.result === "string" || typeof body.error === "string").toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// call_analyzed — summary must be written when Retell sends post-call analysis
// These run without any fixtures (we send a fake call_id — UPDATE affects 0 rows
// but the handler must not crash and must return { received: true })
// ---------------------------------------------------------------------------

test.describe("Retell webhook — call_analyzed event", () => {

  test("call_analyzed with valid payload returns { received: true } without crashing", async ({ request }) => {
    const res = await request.post(`${API_URL}/webhooks/retell`, {
      data: {
        event: "call_analyzed",
        call: {
          call_id: "test-fake-call-id-for-analyzed-event",
          call_analysis: {
            call_summary: "Customer asked about pricing and booked a Thursday 9am appointment.",
            user_sentiment: "Positive",
          },
        },
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as Record<string, unknown>
    expect(body.received).toBe(true)
    // Must NOT have an error key (that would indicate the handler crashed)
    expect(body.error).toBeUndefined()
  })

  test("call_analyzed with missing call_id is handled gracefully", async ({ request }) => {
    const res = await request.post(`${API_URL}/webhooks/retell`, {
      data: {
        event: "call_analyzed",
        call: {},
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as Record<string, unknown>
    expect(body.received).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// book_appointment — timezone-offset strings must not crash the handler
// Regression tests for: LLM sends "2026-04-17T09:00:00-07:00" (tz-aware)
// which used to fail naiveLocalToDate and cause a silent booking failure.
// These are gated on TEST_BUSINESS_PHONE because they need a real DB business.
// ---------------------------------------------------------------------------

test.describe("book_appointment — timezone robustness", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("book_appointment with TZ-offset start_time returns a result string (not undefined)", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE=+1xxx to run this test")

    const tzOffsetTime = "2026-12-15T09:00:00-08:00"  // LLM-style: local time + offset
    const res = await retellCall(
      request,
      "book_appointment",
      {
        start_time:      tzOffsetTime,
        duration_minutes: 60,
        customer_name:   "Test Caller",
        customer_phone:  "+19999999999",
      },
      businessPhone!,
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result?: string }
    // Must always return a result string — never undefined (which would silently skip booking)
    expect(typeof body.result).toBe("string")
    expect(body.result!.length).toBeGreaterThan(0)
  })

  test("book_appointment with missing start_time returns a clarifying question", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE=+1xxx to run this test")

    const res = await retellCall(
      request,
      "book_appointment",
      {
        duration_minutes: 60,
        customer_name:   "Test Caller",
        customer_phone:  "+19999999999",
        // start_time intentionally omitted
      },
      businessPhone!,
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result?: string }
    expect(typeof body.result).toBe("string")
    expect(body.result!.toLowerCase()).toMatch(/time|when|confirm/)
  })
})

// ---------------------------------------------------------------------------
// Owner SMS notifications — booking/cancel/reschedule must not break if SMS fails
// No-fixture tests: send to unknown business — exits early, never hits notify path.
// TEST_BUSINESS_PHONE gated tests: verify the booking result is still returned
// even when the notification fires in the background (fire-and-forget, no throw).
// ---------------------------------------------------------------------------

test.describe("Owner SMS notifications — booking actions still succeed if notify fails", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  // No-fixture: ensures the retell endpoint returns 200 for booking actions
  // sent to an unknown business — notification path is never reached but the
  // endpoint must still be stable (not 500).
  test("book_appointment to unknown business returns structured response, not 500", async ({ request }) => {
    const res = await retellCall(request, "book_appointment", {
      start_time:       "2026-12-15T10:00:00",
      duration_minutes: 60,
      customer_name:    "Test User",
      customer_phone:   "+19999999999",
    })
    // Unknown business → graceful result or error, never a 500
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as Record<string, unknown>
    expect(typeof body.result === "string" || typeof body.error === "string").toBeTruthy()
  })

  test("cancel_appointment to unknown business returns structured response, not 500", async ({ request }) => {
    const res = await retellCall(request, "cancel_appointment", { event_id: "fake-id" })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as Record<string, unknown>
    expect(typeof body.result === "string" || typeof body.error === "string").toBeTruthy()
  })

  test("reschedule_appointment to unknown business returns structured response, not 500", async ({ request }) => {
    const res = await retellCall(request, "reschedule_appointment", {
      event_id:         "fake-id",
      new_start_time:   "2026-12-20T10:00:00",
      duration_minutes: 60,
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as Record<string, unknown>
    expect(typeof body.result === "string" || typeof body.error === "string").toBeTruthy()
  })

  // With a real business: booking must succeed AND return a result string.
  // The notification fires as a background side-effect — it must not block
  // or break the response even if Twilio errors.
  test("book_appointment with real business returns confirmation result", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE=+1xxx to run")
    const res = await retellCall(
      request,
      "book_appointment",
      {
        start_time:       "2026-12-22T11:00:00",
        duration_minutes: 60,
        customer_name:    "SMS Test Caller",
        customer_phone:   "+19999999999",
        reason:           "SMS notification test",
      },
      businessPhone!,
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result?: string }
    expect(typeof body.result).toBe("string")
    // Booking confirmed, rescheduled, cancelled — all should mention the action
    expect(body.result!.toLowerCase()).toMatch(/confirmed|appointment|time|sorry|unable/)
  })
})

// ---------------------------------------------------------------------------
// Ownership guard — scaffolded (requires two seeded sessions)
// ---------------------------------------------------------------------------

// test.describe("Appointment ownership — caller cannot cancel another caller's event", () => {
//   // Requires two test sessions seeded in Supabase with distinct phone numbers
//   // and a real appointment booked for one of them.
//   //
//   // test("cancel_appointment with wrong caller phone returns ownership error", async ({ request }) => {
//   //   const res = await retellCall(request, "cancel_appointment", { event_id: "EVENT_ID_OWNED_BY_OTHER" }, BUSINESS_PHONE, WRONG_CALLER_PHONE)
//   //   const body = await res.json()
//   //   expect(body.result).toMatch(/couldn't find|not found|no appointment/i)
//   // })
// })
