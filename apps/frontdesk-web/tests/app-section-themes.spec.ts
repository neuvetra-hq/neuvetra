import { test, expect } from "@playwright/test"

// Expected computed CSS colors (hex → rgb):
// blue   #5ba3c9 → rgb(91, 163, 201)   Home / default
// green  #3d9e60 → rgb(61, 158, 96)    How It Works
// purple #9060d0 → rgb(144, 96, 208)  Pricing
// teal   #3aaac0 → rgb(58, 170, 192)   Sign In
// amber  #d06030 → rgb(208, 96, 48)    Get Started

test.describe("section theme colors", () => {
  test("/app h1 uses blue theme color", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(91, 163, 201)")
  })

  test("/app/how-it-works h1 uses green theme color", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(61, 158, 96)")
  })

  test("/app/pricing h1 uses purple theme color", async ({ page }) => {
    await page.goto("/app/pricing")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(144, 96, 208)")
  })

  test("theme changes when navigating between sections", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(61, 158, 96)")

    await page.goto("/app/pricing")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(144, 96, 208)")
  })

  test("/app/sign-in h1 uses teal theme color", async ({ page }) => {
    await page.goto("/app/sign-in")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(58, 170, 192)")
  })

  test("/app/get-started h1 uses amber theme color", async ({ page }) => {
    await page.goto("/app/get-started")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(208, 96, 48)")
  })
})
