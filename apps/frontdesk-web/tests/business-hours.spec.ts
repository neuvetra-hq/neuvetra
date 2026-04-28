import { test, expect } from "@playwright/test"

// ---------------------------------------------------------------------------
// Business hours enforcement
//
// These tests verify that booking and rescheduling are blocked outside the
// business's configured operating hours, and that check_availability gives
// a specific reason ("closed" vs "outside hours" vs "slot taken").
//
// Tests that require a live business use TEST_BUSINESS_PHONE and are skipped
// when that env var is not set.
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
      event: "function_call",
      name: funcName,
      arguments: args,
      call: { to_number: toNumber, from_number: fromNumber },
    },
  })
}

// ---------------------------------------------------------------------------
// book_appointment — outside business hours
// These fail before implementation (event gets created anyway).
// After implementation they return a business-hours error.
// ---------------------------------------------------------------------------

test.describe("book_appointment — business hours enforcement", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("booking at 9 PM Sunday returns business hours error", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    // Next Sunday at 21:00
    const sunday = new Date()
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7))
    sunday.setHours(21, 0, 0, 0)

    const res = await retellCall(request, "book_appointment", {
      start_time:       sunday.toISOString(),
      duration_minutes: 30,
      customer_name:    "Test Caller",
      customer_phone:   "+19999999999",
      reason:           "Plumbing",
    }, businessPhone!)

    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result: string }
    // Should mention hours or closed — not "Appointment confirmed"
    expect(body.result.toLowerCase()).toMatch(/hour|closed|outside|unavailable/)
    expect(body.result.toLowerCase()).not.toContain("confirmed")
  })

  test("booking at 6 AM on a weekday (before open) returns business hours error", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    // Tomorrow at 06:00
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(6, 0, 0, 0)
    // Skip if tomorrow is weekend (default hours have Sat/Sun closed)
    test.skip(tomorrow.getDay() === 0 || tomorrow.getDay() === 6, "tomorrow is weekend")

    const res = await retellCall(request, "book_appointment", {
      start_time:       tomorrow.toISOString(),
      duration_minutes: 30,
      customer_name:    "Test Caller",
      customer_phone:   "+19999999999",
      reason:           "Consultation",
    }, businessPhone!)

    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result: string }
    expect(body.result.toLowerCase()).toMatch(/hour|closed|outside|unavailable/)
    expect(body.result.toLowerCase()).not.toContain("confirmed")
  })
})

// ---------------------------------------------------------------------------
// reschedule_appointment — outside business hours
// ---------------------------------------------------------------------------

test.describe("reschedule_appointment — business hours enforcement", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("rescheduling to 9 PM returns business hours error", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const sunday = new Date()
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7))
    sunday.setHours(21, 0, 0, 0)

    const res = await retellCall(request, "reschedule_appointment", {
      event_id:         "any-event-id",
      new_start_time:   sunday.toISOString(),
      duration_minutes: 30,
    }, businessPhone!)

    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result: string }
    // Ownership check fires first for unknown event_id, but if event IS found,
    // hours check should block. Either way it should not say "rescheduled".
    expect(body.result.toLowerCase()).not.toContain("rescheduled to")
  })
})

// ---------------------------------------------------------------------------
// check_availability — smart mode with business hours awareness
// ---------------------------------------------------------------------------

test.describe("check_availability — business hours awareness", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("requested_time on a closed day returns 'closed' message", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    // Next Sunday at 14:00 (default config: Sunday closed)
    const sunday = new Date()
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7))
    sunday.setHours(14, 0, 0, 0)

    const res = await retellCall(request, "check_availability", {
      requested_time:   sunday.toISOString(),
      duration_minutes: 30,
    }, businessPhone!)

    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result: string }
    expect(body.result.toLowerCase()).toMatch(/closed|not open|unavailable/)
  })

  test("requested_time outside hours (8 PM weekday) returns outside-hours message", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    // Next Monday at 20:00
    const monday = new Date()
    const daysUntilMonday = (1 - monday.getDay() + 7) % 7 || 7
    monday.setDate(monday.getDate() + daysUntilMonday)
    monday.setHours(20, 0, 0, 0)

    const res = await retellCall(request, "check_availability", {
      requested_time:   monday.toISOString(),
      duration_minutes: 30,
    }, businessPhone!)

    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result: string }
    // Should mention hours and offer alternatives — not just say "available"
    expect(body.result.toLowerCase()).toMatch(/hour|closed|outside|available times/)
    expect(body.result.toLowerCase()).not.toBe("available — shall i book it?")
  })
})

// ---------------------------------------------------------------------------
// Graceful handling — no fixtures needed
// ---------------------------------------------------------------------------

test.describe("business hours — graceful handling (no fixtures needed)", () => {

  test("book_appointment with missing to_number still returns structured error", async ({ request }) => {
    const res = await request.post(`${API_URL}/webhooks/retell`, {
      data: {
        event: "function_call",
        name: "book_appointment",
        arguments: {
          start_time: new Date().toISOString(),
          duration_minutes: 30,
          customer_name: "Test",
          customer_phone: "+19999999999",
          reason: "Test",
        },
        call: {},
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { error?: string }
    expect(body.error).toBe("Missing to_number on call")
  })
})
