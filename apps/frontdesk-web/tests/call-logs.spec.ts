/**
 * Call Logs + Usage + Messages tab tests
 *
 * Mocks Supabase auth and all API calls so no real session is needed.
 * Tests verify empty states, populated data, and UI interactions.
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test"

// ---------------------------------------------------------------------------
// Auth + context mock helpers
// ---------------------------------------------------------------------------

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
    id:    FAKE_USER_ID,
    aud:   "authenticated",
    role:  "authenticated",
    email: "test@neuvetra.com",
    created_at: "2026-01-01T00:00:00Z",
  },
}

const FAKE_PROFILE = [
  { id: FAKE_USER_ID, first_name: "Test", last_name: "User", phone: "+14155550001" },
]

const FAKE_BUSINESS = [
  {
    businesses: {
      id: FAKE_BIZ_ID,
      name: "Test Plumbing",
      status: "active",
      business_type: "plumbing",
      twilio_number: "+14155550000",
      stripe_plan_id: null,
      stripe_subscription_id: null,
      ai_config: { timezone: "America/Los_Angeles" },
    },
  },
]

/**
 * Mock all Supabase and internal API calls needed for the dashboard to load.
 * Call this before page.goto() in every test.
 */
async function mockAuth(context: BrowserContext) {
  // Inject session into localStorage before the page loads
  await context.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value)
    },
    {
      key:   `sb-icockcoguyadhryzydvl-auth-token`,
      value: JSON.stringify(FAKE_SESSION),
    }
  )
}

async function mockSupabaseRoutes(page: Page) {
  // Supabase auth: /auth/v1/user — validate session
  await page.route(`${SUPABASE_URL}/auth/v1/user*`, (route) =>
    route.fulfill({ json: FAKE_SESSION.user })
  )
  // Supabase REST: users table
  await page.route(`${SUPABASE_URL}/rest/v1/users*`, (route) =>
    route.fulfill({ json: FAKE_PROFILE })
  )
  // Supabase REST: business_members table
  await page.route(`${SUPABASE_URL}/rest/v1/business_members*`, (route) =>
    route.fulfill({ json: FAKE_BUSINESS })
  )
  // Calendar connection check
  await page.route(`**/calendar/connection/**`, (route) =>
    route.fulfill({ json: { connection: null } })
  )
  // Knowledge base (may be fetched by other tabs in the sidebar)
  await page.route(`**/businesses/*/knowledge-base/seed*`, (route) =>
    route.fulfill({ json: { skipped: true } })
  )
  await page.route(`**/businesses/*/knowledge-base*`, (route) =>
    route.fulfill({ json: { items: [] } })
  )
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CALLS = [
  {
    id: "call-1",
    callerNumber: "+14155550101",
    status: "completed",
    durationSeconds: 185,
    summary: "Caller asked about pricing and booked an appointment for Thursday 9am.",
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    endedAt:   new Date(Date.now() - 2 * 60 * 60 * 1000 + 185 * 1000).toISOString(),
  },
  {
    id: "call-2",
    callerNumber: "+14155550202",
    status: "missed",
    durationSeconds: null,
    summary: null,
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endedAt:   null,
  },
]

// Second page of calls for load-more tests
const MOCK_CALLS_PAGE2 = [
  {
    id: "call-3",
    callerNumber: "+14155550303",
    status: "completed",
    durationSeconds: 90,
    summary: null,
    startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    endedAt:   new Date(Date.now() - 48 * 60 * 60 * 1000 + 90 * 1000).toISOString(),
  },
]

const MOCK_USAGE = {
  minutesUsed: 47,
  totalCalls: 12,
  stripePlanId: null,
  periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
}

const MOCK_MESSAGES = [
  {
    id: "msg-1",
    callerPhone: "+14155550303",
    callerName: "John Smith",
    message: "Wants a callback about a burst pipe emergency.",
    status: "pending",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: "msg-2",
    callerPhone: "+14155550404",
    callerName: "Sara Lee",
    message: "General plumbing inquiry.",
    status: "handled",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

// ---------------------------------------------------------------------------
// Call Logs tab
// ---------------------------------------------------------------------------

test.describe("Call Logs tab", () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test("shows empty state when there are no calls", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/calls*", (route) =>
      route.fulfill({ json: { calls: [], total: 0, hasMore: false } })
    )

    await page.goto("/dashboard/calls")
    await expect(page.getByText("No calls yet")).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByText(/Calls will appear here once/)
    ).toBeVisible()
  })

  test("renders a table row for each call", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/calls*", (route) =>
      route.fulfill({ json: { calls: MOCK_CALLS, total: 2, hasMore: false } })
    )

    await page.goto("/dashboard/calls")

    // Table headers
    await expect(page.getByRole("columnheader", { name: /caller/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("columnheader", { name: /status/i })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: /duration/i })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: /summary/i })).toBeVisible()

    // Completed call row
    await expect(page.getByText("+14155550101")).toBeVisible()
    await expect(page.getByText("Answered")).toBeVisible()
    await expect(page.getByText(/3m 5s/)).toBeVisible()
    // Summary is behind a "View summary" button, not inline
    await expect(page.getByRole("button", { name: /view summary/i })).toBeVisible()

    // Missed call row
    await expect(page.getByText("+14155550202")).toBeVisible()
    await expect(page.getByText("Missed")).toBeVisible()
  })

  test("clicking summary button opens modal with full summary text", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/calls*", (route) =>
      route.fulfill({ json: { calls: MOCK_CALLS, total: 2, hasMore: false } })
    )

    await page.goto("/dashboard/calls")
    await expect(page.getByRole("columnheader", { name: /summary/i })).toBeVisible({ timeout: 10000 })

    // Summary cell should show a "View" button, not the raw text inline
    await expect(page.getByRole("button", { name: /view summary/i })).toBeVisible()

    // Click it — modal should open with full summary
    await page.getByRole("button", { name: /view summary/i }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("Caller asked about pricing and booked an appointment for Thursday 9am.")).toBeVisible()

    // Close button dismisses modal (first match = X button in dialog header)
    await page.getByRole("button", { name: /close/i }).first().click()
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 })
  })

  test("shows call count in header", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/calls*", (route) =>
      route.fulfill({ json: { calls: MOCK_CALLS, total: 2, hasMore: false } })
    )

    await page.goto("/dashboard/calls")
    await expect(page.getByText("2 calls")).toBeVisible({ timeout: 10000 })
  })

  test("Load more button hidden when hasMore is false", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/calls*", (route) =>
      route.fulfill({ json: { calls: MOCK_CALLS, total: 2, hasMore: false } })
    )

    await page.goto("/dashboard/calls")
    await expect(page.getByRole("columnheader", { name: /caller/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /load more/i })).not.toBeVisible()
  })

  test("Load more button appears and appends results when hasMore is true", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/calls*", (route) => {
      const offset = Number(new URL(route.request().url()).searchParams.get("offset") ?? "0")
      if (offset === 0) {
        return route.fulfill({ json: { calls: MOCK_CALLS, total: 3, hasMore: true } })
      }
      return route.fulfill({ json: { calls: MOCK_CALLS_PAGE2, total: 3, hasMore: false } })
    })

    await page.goto("/dashboard/calls")
    await expect(page.getByText("+14155550101")).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /load more/i })).toBeVisible()

    await page.getByRole("button", { name: /load more/i }).click()

    // Page 2 row appended
    await expect(page.getByText("+14155550303")).toBeVisible({ timeout: 5000 })
    // Page 1 rows still visible
    await expect(page.getByText("+14155550101")).toBeVisible()
    // Load more gone now
    await expect(page.getByRole("button", { name: /load more/i })).not.toBeVisible()
  })

  test("search input filters calls by phone number", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/calls*", (route) => {
      const url = new URL(route.request().url())
      const search = url.searchParams.get("search") ?? ""
      const filtered = MOCK_CALLS.filter((c) => c.callerNumber.includes(search))
      return route.fulfill({ json: { calls: filtered, total: filtered.length, hasMore: false } })
    })

    await page.goto("/dashboard/calls")
    await expect(page.getByText("+14155550101")).toBeVisible({ timeout: 10000 })

    // Type in search
    await page.getByPlaceholder(/search/i).fill("0202")
    await expect(page.getByText("+14155550202")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("+14155550101")).not.toBeVisible()
  })

  test("clearing search restores full list", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/calls*", (route) => {
      const url = new URL(route.request().url())
      const search = url.searchParams.get("search") ?? ""
      const filtered = MOCK_CALLS.filter((c) => c.callerNumber.includes(search))
      return route.fulfill({ json: { calls: filtered, total: filtered.length, hasMore: false } })
    })

    await page.goto("/dashboard/calls")
    await expect(page.getByText("+14155550101")).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder(/search/i).fill("0202")
    await expect(page.getByText("+14155550101")).not.toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder(/search/i).clear()
    await expect(page.getByText("+14155550101")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("+14155550202")).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Usage tab
// ---------------------------------------------------------------------------

test.describe("Usage tab", () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test("shows stats cards with correct values", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/usage*", (route) =>
      route.fulfill({ json: MOCK_USAGE })
    )

    await page.goto("/dashboard/usage")

    await expect(page.getByText("12")).toBeVisible({ timeout: 10000 })  // total calls
    // Minutes used — use first() since no-plan edge case collapses overage to 0
    await expect(page.getByText("47 min").first()).toBeVisible()
    await expect(page.getByText("None")).toBeVisible()                  // no overage (no plan)
  })

  test("shows period label", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/usage*", (route) =>
      route.fulfill({ json: MOCK_USAGE })
    )

    await page.goto("/dashboard/usage")

    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
    await expect(page.getByText(new RegExp(month))).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// Messages tab
// ---------------------------------------------------------------------------

test.describe("Messages tab", () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test("shows empty state when there are no messages", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/messages*", (route) =>
      route.fulfill({ json: { messages: [], total: 0, hasMore: false } })
    )

    await page.goto("/dashboard/messages")
    await expect(page.getByText("No callback requests yet")).toBeVisible({ timeout: 10000 })
  })

  test("renders pending and handled sections", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/messages*", (route) =>
      route.fulfill({ json: { messages: MOCK_MESSAGES, total: 2, hasMore: false } })
    )

    await page.goto("/dashboard/messages")

    await expect(page.getByText(/Pending \(1\)/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Handled \(1\)/i)).toBeVisible()

    await expect(page.getByText("John Smith")).toBeVisible()
    await expect(page.getByText("Wants a callback about a burst pipe emergency.")).toBeVisible()
    await expect(page.getByRole("button", { name: /mark handled/i })).toBeVisible()

    await expect(page.getByText("Sara Lee")).toBeVisible()
  })

  test("mark-handled removes message from pending section", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/messages*", (route) => {
      if (route.request().method() === "PATCH") {
        return route.fulfill({ json: { updated: true } })
      }
      return route.fulfill({ json: { messages: MOCK_MESSAGES, total: 2, hasMore: false } })
    })

    await page.goto("/dashboard/messages")
    await expect(page.getByRole("button", { name: /mark handled/i })).toBeVisible({ timeout: 10000 })

    await page.getByRole("button", { name: /mark handled/i }).click()

    // Pending section should disappear after optimistic update
    await expect(page.getByText(/Pending \(1\)/i)).not.toBeVisible({ timeout: 3000 })
  })

  test("search input filters messages by phone number", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/*/messages*", (route) => {
      if (route.request().method() === "PATCH") return route.fulfill({ json: { updated: true } })
      const url = new URL(route.request().url())
      const search = url.searchParams.get("search") ?? ""
      const filtered = MOCK_MESSAGES.filter((m) => m.callerPhone.includes(search) || (m.callerName ?? "").toLowerCase().includes(search.toLowerCase()))
      return route.fulfill({ json: { messages: filtered, total: filtered.length, hasMore: false } })
    })

    await page.goto("/dashboard/messages")
    await expect(page.getByText("John Smith")).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder(/search/i).fill("0404")
    await expect(page.getByText("Sara Lee")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("John Smith")).not.toBeVisible()
  })

  test("Load more button appears and appends messages when hasMore is true", async ({ page }) => {
    await mockSupabaseRoutes(page)
    const extraMessage = {
      id: "msg-3",
      callerPhone: "+14155550505",
      callerName: "Bob Jones",
      message: "Third message",
      status: "pending",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    }
    await page.route("**/businesses/*/messages*", (route) => {
      if (route.request().method() === "PATCH") return route.fulfill({ json: { updated: true } })
      const offset = Number(new URL(route.request().url()).searchParams.get("offset") ?? "0")
      if (offset === 0) return route.fulfill({ json: { messages: MOCK_MESSAGES, total: 3, hasMore: true } })
      return route.fulfill({ json: { messages: [extraMessage], total: 3, hasMore: false } })
    })

    await page.goto("/dashboard/messages")
    await expect(page.getByText("John Smith")).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole("button", { name: /load more/i })).toBeVisible()

    await page.getByRole("button", { name: /load more/i }).click()
    await expect(page.getByText("Bob Jones")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("John Smith")).toBeVisible()
    await expect(page.getByRole("button", { name: /load more/i })).not.toBeVisible()
  })
})
