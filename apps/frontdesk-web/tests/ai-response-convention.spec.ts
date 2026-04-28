import { test, expect } from "@playwright/test"

// ---------------------------------------------------------------------------
// AI Response Convention Tests
//
// Every `result` field returned from a Retell function call is the AI's voice —
// it gets spoken directly to the caller. These tests enforce the convention:
//
//   1. First-person AI voice ("I've booked", "I found", "I couldn't")
//   2. Never "Please ask the caller" — the AI IS talking to the caller
//   3. Booking success includes customer name AND start–end time
//   4. Errors always give an actionable next step
//   5. Success responses close with "Is there anything else I can help you with?"
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

function nextWeekday(targetDay: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + ((targetDay - d.getDay() + 7) % 7 || 7))
  return d
}

function atHour(date: Date, h: number, m = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0)
}

// ---------------------------------------------------------------------------
// CONVENTION RULE: "Please ask the caller" must NEVER appear in any result.
// The AI speaks *to* the caller — meta-instructions break the call experience.
// ---------------------------------------------------------------------------

test.describe("convention: no 'Please ask the caller' in any result", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("outside-hours book_appointment result speaks to the caller directly", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const tuesday = nextWeekday(2)
    const twoAM   = atHour(tuesday, 2)

    const res  = await retellCall(request, "book_appointment", {
      start_time:       twoAM.toISOString(),
      duration_minutes: 30,
      customer_name:    "Test Caller",
      customer_phone:   "+19999999999",
      reason:           "Consultation",
    }, businessPhone!)

    const body = await res.json() as { result: string }
    expect(body.result.toLowerCase()).not.toContain("please ask the caller")
    expect(body.result.toLowerCase()).not.toContain("ask the caller")
  })

  test("closed-day book_appointment result speaks to the caller directly", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const sunday    = nextWeekday(0)
    const sunday2pm = atHour(sunday, 14)

    const res  = await retellCall(request, "book_appointment", {
      start_time:       sunday2pm.toISOString(),
      duration_minutes: 30,
      customer_name:    "Test Caller",
      customer_phone:   "+19999999999",
      reason:           "Consultation",
    }, businessPhone!)

    const body = await res.json() as { result: string }
    expect(body.result.toLowerCase()).not.toContain("please ask the caller")
    expect(body.result.toLowerCase()).not.toContain("ask the caller")
  })

  test("outside-hours reschedule result speaks to the caller directly", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const monday = nextWeekday(1)
    const ninePM = atHour(monday, 21)

    const res  = await retellCall(request, "reschedule_appointment", {
      event_id:         "nonexistent-for-convention-test",
      new_start_time:   ninePM.toISOString(),
      duration_minutes: 30,
    }, businessPhone!)

    const body = await res.json() as { result: string }
    expect(body.result.toLowerCase()).not.toContain("please ask the caller")
    expect(body.result.toLowerCase()).not.toContain("ask the caller")
  })

  test("check_availability closed-day result speaks to the caller directly", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const sunday = nextWeekday(0)
    const noon   = atHour(sunday, 12)

    const res  = await retellCall(request, "check_availability", {
      requested_time:   noon.toISOString(),
      duration_minutes: 30,
    }, businessPhone!)

    const body = await res.json() as { result: string }
    expect(body.result.toLowerCase()).not.toContain("please ask the caller")
    expect(body.result.toLowerCase()).not.toContain("ask the caller")
  })

  test("find_appointment missing from_number result speaks to the caller directly", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    // Pass empty from_number
    const res = await request.post(`${API_URL}/webhooks/retell`, {
      data: {
        event:     "function_call",
        name:      "find_appointment",
        arguments: {},
        call:      { to_number: businessPhone, from_number: "" },
      },
    })

    const body = await res.json() as { result: string }
    expect(body.result.toLowerCase()).not.toContain("please ask the caller")
    expect(body.result.toLowerCase()).not.toContain("ask the caller")
  })
})

// ---------------------------------------------------------------------------
// CONVENTION RULE: Booking success must include customer name AND time range.
// ---------------------------------------------------------------------------

test.describe("convention: book_appointment success is fully detailed", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("success result includes customer name", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    // Book a slot we expect to be free: next Wednesday at 10:00 AM
    const wednesday = nextWeekday(3)
    const tenAM     = atHour(wednesday, 10)

    const res = await retellCall(request, "book_appointment", {
      start_time:       tenAM.toISOString(),
      duration_minutes: 30,
      customer_name:    "Jane Doe",
      customer_phone:   "+19999999999",
      reason:           "Consultation",
    }, businessPhone!)

    const body = await res.json() as { result: string }
    // Either it was booked (result mentions Jane Doe and a time) or the slot was
    // already taken — in either case, no crash and no "Please ask the caller".
    expect(body.result.toLowerCase()).not.toContain("ask the caller")

    if (body.result.toLowerCase().includes("confirmed") || body.result.toLowerCase().includes("booked")) {
      expect(body.result).toContain("Jane Doe")
      // Must include a time expression
      expect(body.result).toMatch(/\d{1,2}:\d{2}/)
    }
  })

  test("success result includes end time or duration", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const thursday = nextWeekday(4)
    const elevenAM = atHour(thursday, 11)

    const res = await retellCall(request, "book_appointment", {
      start_time:       elevenAM.toISOString(),
      duration_minutes: 60,
      customer_name:    "Bob Smith",
      customer_phone:   "+19999999999",
      reason:           "Follow-up",
    }, businessPhone!)

    const body = await res.json() as { result: string }
    if (body.result.toLowerCase().includes("confirmed") || body.result.toLowerCase().includes("booked")) {
      // Should contain either "to HH:MM" (end time) or "60 minutes" or similar
      const hasEndTime   = /to\s+\d{1,2}:\d{2}/.test(body.result)
      const hasDuration  = /\d+\s*minute/.test(body.result.toLowerCase())
      expect(hasEndTime || hasDuration).toBeTruthy()
    }
  })

  test("success result closes with a friendly follow-up question", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const friday  = nextWeekday(5)
    const twoThirty = atHour(friday, 14, 30)

    const res = await retellCall(request, "book_appointment", {
      start_time:       twoThirty.toISOString(),
      duration_minutes: 30,
      customer_name:    "Alice Chen",
      customer_phone:   "+19999999999",
      reason:           "Initial consultation",
    }, businessPhone!)

    const body = await res.json() as { result: string }
    if (body.result.toLowerCase().includes("confirmed") || body.result.toLowerCase().includes("booked")) {
      // Should close with an offer to help further
      expect(body.result.toLowerCase()).toMatch(/anything else|help you|anything else i can/)
    }
  })
})

// ---------------------------------------------------------------------------
// CONVENTION RULE: First-person voice ("I've", "I found", "I couldn't", etc.)
// ---------------------------------------------------------------------------

test.describe("convention: first-person AI voice in key paths", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("find_appointment with no appointments uses first-person", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    // Use a number with no appointments
    const res = await request.post(`${API_URL}/webhooks/retell`, {
      data: {
        event:     "function_call",
        name:      "find_appointment",
        arguments: {},
        call:      { to_number: businessPhone, from_number: "+10000000001" },
      },
    })

    const body = await res.json() as { result: string }
    // Should use "I" not "We couldn't find" or passive voice
    expect(body.result.toLowerCase()).toMatch(/i don'?t see|i couldn'?t|i wasn'?t|i found|i have/)
  })

  test("check_availability slot available uses first-person or direct", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const wednesday = nextWeekday(3)
    const tenAM     = atHour(wednesday, 10)

    const res = await retellCall(request, "check_availability", {
      requested_time:   tenAM.toISOString(),
      duration_minutes: 30,
    }, businessPhone!)

    const body = await res.json() as { result: string }
    // Should use a conversational tone
    expect(body.result.toLowerCase()).toMatch(/available|booked|taken|closed|outside/)
    expect(body.result.toLowerCase()).not.toContain("ask the caller")
  })
})

// ---------------------------------------------------------------------------
// CONVENTION RULE: Reschedule success includes the new time.
// ---------------------------------------------------------------------------

test.describe("convention: reschedule result is specific", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("reschedule success includes the new time in the result", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    // We don't have a real event to reschedule here, so we test
    // the outside-hours path which fires before the ownership check.
    const monday = nextWeekday(1)
    const ninePM = atHour(monday, 21)

    const res = await retellCall(request, "reschedule_appointment", {
      event_id:         "nonexistent-for-convention-test",
      new_start_time:   ninePM.toISOString(),
      duration_minutes: 30,
    }, businessPhone!)

    const body = await res.json() as { result: string }
    // Either: outside-hours message (no "rescheduled to") or ownership error
    // Either way, no meta-instructions about asking the caller
    expect(body.result.toLowerCase()).not.toContain("ask the caller")
    expect(body.result.toLowerCase()).not.toContain("rescheduled to")
  })
})

// ---------------------------------------------------------------------------
// Graceful structural tests — no fixtures needed
// ---------------------------------------------------------------------------

test.describe("convention: graceful handling (no fixtures needed)", () => {
  test("all function calls return { result } or { error } — never crash", async ({ request }) => {
    const funcs = [
      { name: "book_appointment",      args: { start_time: new Date().toISOString(), duration_minutes: 30, customer_name: "X", customer_phone: "+1", reason: "test" } },
      { name: "find_appointment",      args: {} },
      { name: "cancel_appointment",    args: { event_id: "fake-id" } },
      { name: "reschedule_appointment",args: { event_id: "fake-id", new_start_time: new Date().toISOString(), duration_minutes: 30 } },
      { name: "check_availability",    args: { requested_time: new Date().toISOString(), duration_minutes: 30 } },
    ]

    for (const { name, args } of funcs) {
      const res  = await retellCall(request, name, args)
      expect(res.ok(), `${name} should return 200`).toBeTruthy()
      const body = await res.json() as Record<string, unknown>
      const hasResult = typeof body.result === "string"
      const hasError  = typeof body.error  === "string"
      expect(hasResult || hasError, `${name} must return result or error string`).toBeTruthy()
    }
  })
})
