import { test, expect } from "@playwright/test"

test.describe("Signup page", () => {
  test("renders phone input form", async ({ page }) => {
    await page.goto("/signup")
    await expect(page.getByRole("heading", { name: /sign up|get started|create/i })).toBeVisible()
    // Phone input or SMS consent text visible
    await expect(page.locator("input[type='tel'], input[placeholder*='phone'], input[placeholder*='Phone']").first()).toBeVisible()
  })

  test("shows OTP step after submitting phone", async ({ page }) => {
    await page.goto("/signup")
    // Fill the phone field with a dummy number — won't actually send OTP
    const phoneInput = page.locator("input[type='tel'], input[placeholder*='phone'], input[placeholder*='Phone']").first()
    await phoneInput.fill("+12025550199")
    await page.getByRole("button", { name: /send|continue|next/i }).first().click()
    // Expect an OTP/code input or message to appear
    await expect(
      page.getByText(/code|otp|verification/i).first()
    ).toBeVisible({ timeout: 5000 })
  })
})

test.describe("Login page", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login")
    await expect(page.locator("input[type='tel'], input[placeholder*='phone'], input[placeholder*='Phone']").first()).toBeVisible()
  })
})

test.describe("Protected routes", () => {
  test("unauthenticated user is redirected from /dashboard", async ({ page }) => {
    await page.goto("/dashboard")
    // Should redirect to login
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })
})
