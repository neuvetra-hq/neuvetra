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

async function mockSupabaseRoutes(page: Page, aiConfig: Record<string, unknown> = {}) {
  await page.route(`${SUPABASE_URL}/auth/v1/user*`, (route) =>
    route.fulfill({ json: FAKE_SESSION.user })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/users*`, (route) =>
    route.fulfill({ json: [{ id: FAKE_USER_ID, first_name: "Test", last_name: "User", phone: "+14155550001" }] })
  )
  await page.route(`${SUPABASE_URL}/rest/v1/business_members*`, (route) =>
    route.fulfill({ json: [{ businesses: { id: FAKE_BIZ_ID, name: "Nima Birgani Plumbing Services LLC", status: "active", business_type: "plumbing", twilio_number: "+14155550000", stripe_plan_id: null, stripe_subscription_id: null, ai_config: aiConfig } }] })
  )
  await page.route(`**/calendar/connection/**`, (route) =>
    route.fulfill({ json: { connection: null } })
  )
  await page.route(`**/businesses/*/knowledge-base/seed*`, (route) =>
    route.fulfill({ json: { skipped: true } })
  )
  await page.route(`**/businesses/*/knowledge-base*`, (route) =>
    route.fulfill({ json: { items: [] } })
  )
}

// ---------------------------------------------------------------------------
// AI Agent settings
// ---------------------------------------------------------------------------

test.describe("Settings — AI Agent section (mocked auth)", () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test("shows agent name field", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.goto("/dashboard/settings")
    await expect(page.getByLabel("Agent name")).toBeVisible({ timeout: 10000 })
  })

  test("shows business display name field", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.goto("/dashboard/settings")
    await expect(page.getByLabel(/business display name/i)).toBeVisible({ timeout: 10000 })
  })

  test("business display name pre-fills from aiConfig.businessName", async ({ page }) => {
    await mockSupabaseRoutes(page, { businessName: "Nima's Plumbing" })
    await page.goto("/dashboard/settings")
    await expect(page.getByLabel(/business display name/i)).toHaveValue("Nima's Plumbing", { timeout: 10000 })
  })

  test("business display name shows placeholder hinting at shorter name", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.goto("/dashboard/settings")
    const input = page.getByLabel(/business display name/i)
    await expect(input).toHaveAttribute("placeholder", /.+/, { timeout: 10000 })
  })

  test("saving agent settings shows success toast", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.route("**/businesses/**", (route) => {
      if (route.request().method() === "PATCH") {
        route.fulfill({ json: { updated: true } })
      } else {
        route.continue()
      }
    })

    await page.goto("/dashboard/settings")
    await page.getByLabel(/business display name/i).waitFor({ timeout: 10000 })
    await page.getByLabel(/business display name/i).fill("Nima's Plumbing")
    await page.getByRole("button", { name: /save agent settings/i }).click()

    await expect(page.getByText(/agent settings saved/i)).toBeVisible({ timeout: 5000 })
  })

  test("shows collect customer address toggle", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.goto("/dashboard/settings")
    await expect(page.getByRole("switch", { name: /collect customer address/i })).toBeVisible({ timeout: 10000 })
  })

  test("collect address toggle defaults to off when aiConfig has no collectAddress", async ({ page }) => {
    await mockSupabaseRoutes(page)
    await page.goto("/dashboard/settings")
    const toggle = page.getByRole("switch", { name: /collect customer address/i })
    await toggle.waitFor({ timeout: 10000 })
    await expect(toggle).toHaveAttribute("aria-checked", "false")
  })

  test("collect address toggle pre-fills from aiConfig.collectAddress true", async ({ page }) => {
    await mockSupabaseRoutes(page, { collectAddress: true })
    await page.goto("/dashboard/settings")
    const toggle = page.getByRole("switch", { name: /collect customer address/i })
    await toggle.waitFor({ timeout: 10000 })
    await expect(toggle).toHaveAttribute("aria-checked", "true")
  })
})
