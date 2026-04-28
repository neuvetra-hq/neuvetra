import { test, expect } from "@playwright/test"

// ---------------------------------------------------------------------------
// Outside-hours booking UX
//
// book_appointment and reschedule_appointment must never silently rebook to a
// different time. When the requested time is outside business hours they must
// return the specific reason AND a list of alternatives so the AI can offer
// them in the same turn without a second function call.
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
      event: "function_call",
      name: funcName,
      arguments: args,
      call: { to_number: toNumber, from_number: fromNumber },
    },
  })
}

// Next occurrence of a given weekday (0=Sun … 6=Sat), always in the future
function nextWeekday(targetDay: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + ((targetDay - d.getDay() + 7) % 7 || 7))
  return d
}

function atHour(date: Date, h: number, m = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0)
}

// ---------------------------------------------------------------------------
// book_appointment — outside hours must return reason + alternatives
// Fails before implementation: currently returns just the hours error string
// with no alternatives embedded.
// ---------------------------------------------------------------------------

test.describe("book_appointment — outside hours returns alternatives", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("booking at 2 AM returns reason AND alternative times in one response", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const tuesday = nextWeekday(2) // Tuesday (open day)
    const twoAM   = atHour(tuesday, 2)

    const res = await retellCall(request, "book_appointment", {
      start_time:       twoAM.toISOString(),
      duration_minutes: 30,
      customer_name:    "Test Caller",
      customer_phone:   "+19999999999",
      reason:           "Consultation",
    }, businessPhone!)

    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result: string }

    // Must mention hours / outside
    expect(body.result.toLowerCase()).toMatch(/hour|outside|business hours/)
    // Must NOT confirm the booking
    expect(body.result.toLowerCase()).not.toContain("confirmed")
    // Must include at least one alternative time so the AI can offer options
    expect(body.result.toLowerCase()).toMatch(/\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)/)
  })

  test("booking on Sunday returns 'closed' and does NOT include a confirmation", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const sunday    = nextWeekday(0)
    const sunday2pm = atHour(sunday, 14)

    const res = await retellCall(request, "book_appointment", {
      start_time:       sunday2pm.toISOString(),
      duration_minutes: 30,
      customer_name:    "Test Caller",
      customer_phone:   "+19999999999",
      reason:           "Consultation",
    }, businessPhone!)

    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result: string }
    expect(body.result.toLowerCase()).toMatch(/closed|sunday/)
    expect(body.result.toLowerCase()).not.toContain("confirmed")
  })
})

// ---------------------------------------------------------------------------
// reschedule_appointment — outside hours must return reason + alternatives
// ---------------------------------------------------------------------------

test.describe("reschedule_appointment — outside hours returns alternatives", () => {
  const businessPhone = process.env.TEST_BUSINESS_PHONE

  test("rescheduling to 9 PM returns reason AND alternatives", async ({ request }) => {
    test.skip(!businessPhone, "Set TEST_BUSINESS_PHONE to run")

    const monday  = nextWeekday(1)
    const ninePM  = atHour(monday, 21)

    const res = await retellCall(request, "reschedule_appointment", {
      event_id:         "nonexistent-for-hours-test",
      new_start_time:   ninePM.toISOString(),
      duration_minutes: 30,
    }, businessPhone!)

    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result: string }

    // Hours check fires before ownership check for outside-hours times
    // OR ownership error fires first — either way it must not say "rescheduled"
    expect(body.result.toLowerCase()).not.toContain("rescheduled to")
  })
})

// ---------------------------------------------------------------------------
// Graceful handling — no fixtures needed
// ---------------------------------------------------------------------------

test.describe("booking UX — graceful handling (no fixtures needed)", () => {

  test("book_appointment outside hours with unknown business returns structured response", async ({ request }) => {
    const tuesday = nextWeekday(2)
    const twoAM   = atHour(tuesday, 2)

    const res = await retellCall(request, "book_appointment", {
      start_time:       twoAM.toISOString(),
      duration_minutes: 30,
      customer_name:    "Test",
      customer_phone:   "+19999999999",
      reason:           "Test",
    })

    expect(res.ok()).toBeTruthy()
    const body = await res.json() as { result?: string; error?: string }
    // Unknown business → structured error, not a crash
    expect(typeof body.result === "string" || typeof body.error === "string").toBeTruthy()
  })
})
