/**
 * Upcoming Events tab tests
 *
 * Mocks Supabase auth and API so no real session or calendar connection needed.
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test"

const SUPABASE_URL = "https://icockcoguyadhryzydvl.supabase.co"
const FAKE_USER_ID = "00000000-0000-0000-0000-000000000001"
const FAKE_BIZ_ID  = "00000000-0000-0000-0000-000000000002"

const FAKE_SESSION = {
  access_token:  "fake-access-token",
  token_type:    "bearer",
  expires_in:    3600,
  expires_at:    Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "fake-refresh-token",
  user: {
    id:         FAKE_USER_ID,
    aud:        "authenticated",
    role:       "authenticated",
    email:      "test@neuvetra.com",
    created_at: "2026-01-01T00:00:00Z",
  },
}

async function mockAuth(context: BrowserContext) {
  await context.addInitScript(
    ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
    { key: `sb-icockcoguyadhryzydvl-auth-token`, value: JSON.stringify(FAKE_SESSION) }
  )
}

async function mockSupabaseRoutes(page: Page) {
  await page.route(`${SUPABASE_URL}/auth/v1/user*`, (route) =>
    route.fulfill({ json: FAKE_SESSION.user })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/users*`, (route) =>
    route.fulfill({ json: [{ id: FAKE_USER_ID, first_name: "Test", last_name: "User", phone: "+14155550001" }] })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/business_members*`, (route) =>
    route.fulfill({ json: [{ businesses: { id: FAKE_BIZ_ID, name: "Test Plumbing", status: "active", business_type: "plumbing", twilio_number: "+14155550000", stripe_plan_id: null, stripe_subscription_id: null, ai_config: { timezone: "America/Los_Angeles" } } }] })
  )
  await page.route(`**/calendar/connection/**`, (route) =>
    route.fulfill({ json: { connection: { isActive: true } } })
  )
  await page.route(`**/businesses/*/knowledge-base/seed*`, (route) =>
    route.fulfill({ json: { skipped: true } })
  )
  await page.route(`**/businesses/*/knowledge-base*`, (route) =>
    route.fulfill({ json: { items: [] } })
  )
}

// ---------------------------------------------------------------------------
// Mock event data
// ---------------------------------------------------------------------------

function makeEvent(id: string, daysFromNow: number, hour: number, customerName: string, customerPhone: string, reason: string) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  const end = new Date(d.getTime() + 60 * 60 * 1000)
  return {
    eventId:       id,
    summary:       `${reason} — ${customerName}`,
    startTime:     d.toISOString(),
    endTime:       end.toISOString(),
    customerName,
    customerPhone,
    reason,
  }
}

const TODAY_EVENT     = makeEvent("evt-1", 0, 10, "John Smith",  "+14155550101", "Plumbing inspection")
const TOMORROW_EVENT  = makeEvent("evt-2", 1, 14, "Sara Lee",    "+14155550202", "Pipe repair")
const NEXT_WEEK_EVENT = makeEvent("evt-3", 7, 9,  "Bob Johnson", "+14155550303", "Water heater install")

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Upcoming Events tab", () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test("tab is visible in the sidebar", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/upcoming-events*", (route) =>
      route.fulfill({ json: { events: [] } })
    )

    await page.goto("/dashboard/overview")
    await expect(page.getByRole("button", { name: /upcoming/i })).toBeVisible({ timeout: 10000 })
  })

  test("shows empty state when no events in the next 14 days", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/upcoming-events*", (route) =>
      route.fulfill({ json: { events: [] } })
    )

    await page.goto("/dashboard/upcoming")
    await expect(page.getByText(/no upcoming appointments/i)).toBeVisible({ timeout: 10000 })
  })

  test("shows no-calendar message when calendar is not connected", async ({ page }) => {
    await mockSupabaseRoutes(page)
    // Override calendar connection to inactive
    await page.route(`**/calendar/connection/**`, (route) =>
      route.fulfill({ json: { connection: null } })
    )
    await page.route("**/businesses/*/upcoming-events*", (route) =>
      route.fulfill({ json: { events: [], noCalendar: true } })
    )

    await page.goto("/dashboard/upcoming")
    // "Connect calendar" button is unique to the UpcomingEventsTab no-calendar state
    await expect(page.getByRole("button", { name: /connect calendar/i })).toBeVisible({ timeout: 10000 })
  })

  test("groups events by day with day headers", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/upcoming-events*", (route) =>
      route.fulfill({ json: { events: [TODAY_EVENT, TOMORROW_EVENT, NEXT_WEEK_EVENT] } })
    )

    await page.goto("/dashboard/upcoming")

    // Should see day group headers
    await expect(page.getByText(/today/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/tomorrow/i)).toBeVisible()

    // Events in correct groups
    await expect(page.getByText("John Smith")).toBeVisible()
    await expect(page.getByText("Sara Lee")).toBeVisible()
    await expect(page.getByText("Bob Johnson")).toBeVisible()
  })

  test("shows event details — customer name, phone, reason, time", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/upcoming-events*", (route) =>
      route.fulfill({ json: { events: [TODAY_EVENT] } })
    )

    await page.goto("/dashboard/upcoming")

    await expect(page.getByText("John Smith")).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("+14155550101")).toBeVisible()
    await expect(page.getByText("Plumbing inspection")).toBeVisible()
    // Time should be shown (10:00 AM)
    await expect(page.getByText(/10:00\s*AM/i)).toBeVisible()
  })

  test("shows correct event count in header", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/upcoming-events*", (route) =>
      route.fulfill({ json: { events: [TODAY_EVENT, TOMORROW_EVENT, NEXT_WEEK_EVENT] } })
    )

    await page.goto("/dashboard/upcoming")
    await expect(page.getByText(/3 event/i)).toBeVisible({ timeout: 10000 })
  })

  test("shows customer address in event card when present", async ({ page }) => {
    await mockSupabaseRoutes(page)
    const eventWithAddress = {
      ...TODAY_EVENT,
      customerAddress: "123 Main St, San Francisco, CA 94102",
    }
    await page.route("**/businesses/*/upcoming-events*", (route) =>
      route.fulfill({ json: { events: [eventWithAddress] } })
    )

    await page.goto("/dashboard/upcoming")

    await expect(page.getByText("John Smith")).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("123 Main St, San Francisco, CA 94102")).toBeVisible()
  })

  test("does not show address row when customerAddress is absent", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/upcoming-events*", (route) =>
      route.fulfill({ json: { events: [TODAY_EVENT] } })
    )

    await page.goto("/dashboard/upcoming")

    await expect(page.getByText("John Smith")).toBeVisible({ timeout: 10000 })
    // No address means no MapPin icon / address text rendered
    await expect(page.locator("[data-testid='event-address']")).not.toBeVisible()
  })
})
