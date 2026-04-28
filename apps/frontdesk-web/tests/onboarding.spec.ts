import { test, expect } from "@playwright/test"

// The signup wizard at /signup is a 4-step flow:
//   Step 0: Identity (first name, last name, phone)
//   Step 1: Verify OTP
//   Step 2: Business info (business name, type)
//   Step 3: Pick a number
// Steps 2-3 require prior state (OTP verification), so we only test step 0 directly.
// Authenticated onboarding tests should use Playwright storageState with a seeded session.

test.describe("Signup wizard — identity step", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup")
  })

  test("shows first name and last name fields", async ({ page }) => {
    await expect(page.getByLabel("First name")).toBeVisible()
    await expect(page.getByLabel("Last name")).toBeVisible()
  })

  test("shows mobile number field", async ({ page }) => {
    await expect(page.getByLabel("Your mobile number")).toBeVisible()
  })

  test("shows 6-step progress indicator", async ({ page }) => {
    // 6 step bars rendered (Your info, Verify, Your business, Pick a number, Payment, Calendar)
    const bars = page.locator(".h-1.flex-1.rounded-full")
    await expect(bars).toHaveCount(6)
  })

  test("shows Send verification code button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /send verification code/i })).toBeVisible()
  })
})

test.describe("Protected route — /onboarding redirects to /signup", () => {
  test("/onboarding redirects to /signup", async ({ page }) => {
    await page.goto("/onboarding")
    await expect(page).toHaveURL(/signup/, { timeout: 5000 })
  })
})

test.describe("Legal pages", () => {
  test("Terms of Service page renders", async ({ page }) => {
    await page.goto("/terms")
    await expect(page.getByRole("heading", { name: "Terms of Service", exact: true })).toBeVisible()
    await expect(page.getByText(/Neuvetra/i).first()).toBeVisible()
  })

  test("Privacy Policy page renders", async ({ page }) => {
    await page.goto("/privacy")
    await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible()
    await expect(page.getByText(/Neuvetra/i).first()).toBeVisible()
  })
})
