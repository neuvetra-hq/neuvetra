// apps/web/tests/app-how-it-works.spec.ts
import { test, expect } from "@playwright/test"

test.describe("/app/how-it-works", () => {
  test("shows ghost title heading", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toContainText("How It Works")
  })

  test("shows descriptor line", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.getByText(/your ai\. ready in minutes\./i)).toBeVisible()
  })

  test("shows all 4 step titles", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.getByText("Start with your phone number")).toBeVisible()
    await expect(page.getByText("Design your AI")).toBeVisible()
    await expect(page.getByText("Pick your AI's number")).toBeVisible()
    await expect(page.getByText("Call it. Then let it work.")).toBeVisible()
  })

  test("shows callout line for step 01", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.getByText(/7-day free trial/i)).toBeVisible()
  })

  test("bottom nav is visible with content present", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.getByText("Start with your phone number")).toBeVisible()
  })

  test("Home page is unchanged — still shows Front Desk centered", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toContainText("Front Desk")
    await expect(page.getByText(/live in under 10 minutes/i)).not.toBeAttached()
  })
})

test.describe("/app non-home shells", () => {
  const SHELLS = [
    { path: "/app/pricing",     titleText: "Pricing" },
    { path: "/app/sign-in",     titleText: "Sign In" },
    { path: "/app/get-started", titleText: "Get Started" },
  ]

  for (const { path, titleText } of SHELLS) {
    test(`${path} shows ghost title with correct text`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator("nav")).toBeVisible()
      await expect(page.locator("h1")).toContainText(titleText)
    })
  }
})
