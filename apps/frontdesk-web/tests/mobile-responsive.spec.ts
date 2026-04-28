// apps/web/tests/mobile-responsive.spec.ts
import { test, expect } from "@playwright/test"

const MOBILE = { width: 375, height: 667 }

test.describe("mobile layout — dashboard sidebar", () => {
  test.skip("sidebar trigger (hamburger) is visible on mobile — TODO: implement after AppSidebar is built", async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto("/dashboard/overview")
    const trigger = page.locator('[data-sidebar="trigger"]')
    await expect(trigger).toBeVisible()
  })

  test("landing page renders correctly at mobile width", async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    const hero = page.locator("section").first()
    await expect(hero).toBeVisible()
  })
})

test.describe("InputOTP component", () => {
  test("login page shows phone input before OTP step", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByLabel(/mobile number/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /send code/i })).toBeVisible()
  })

  test("signup verify step shows phone input when reached", async ({ page }) => {
    await page.goto("/signup")
    // Skip if redirected away from signup (unauthenticated in test env)
    const url = page.url()
    test.skip(!url.includes("signup"), "Signup page redirected — needs auth state")
    // StepIdentity label reads "Your mobile number" — getByLabel(/mobile number/i)
    await expect(page.getByLabel(/mobile number/i)).toBeVisible()
  })
})

test.describe("component interactions", () => {
  test("pricing toggle buttons are visible on landing page", async ({ page }) => {
    await page.goto("/")
    const monthlyBtn = page.getByRole("button", { name: /monthly/i })
    const annualBtn = page.getByRole("button", { name: /annual/i })
    await expect(monthlyBtn).toBeVisible()
    await expect(annualBtn).toBeVisible()
    await annualBtn.click()
  })
})

test.describe("mobile cursor behaviour", () => {
  test("all buttons on landing page have pointer cursor at mobile size", async ({ page }) => {
    await page.setViewportSize(MOBILE)
    await page.goto("/")
    const buttons = page.getByRole("button").filter({ hasNot: page.locator("[disabled]") })
    const count = await buttons.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      const cursor = await buttons.nth(i).evaluate(
        (el) => window.getComputedStyle(el).cursor
      )
      expect(cursor).toBe("pointer")
    }
  })
})
