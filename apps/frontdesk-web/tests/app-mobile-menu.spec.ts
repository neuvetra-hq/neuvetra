import { test, expect } from "@playwright/test"

// iPhone 14 portrait
const MOBILE_PORTRAIT  = { width: 390,  height: 844 }
// iPhone 14 landscape
const MOBILE_LANDSCAPE = { width: 844,  height: 390 }

const NAV_LABELS = ["Home", "How It Works", "Pricing", "Sign In", "Get Started"]

// ---------------------------------------------------------------------------
// Viewport — no page scroll on mobile
// ---------------------------------------------------------------------------

test.describe("app route — no scroll on mobile portrait", () => {
  test.use({ viewport: MOBILE_PORTRAIT })

  test("page does not overflow vertically on /app", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeHidden() // bottom nav hidden on mobile
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight
    )
    expect(overflow).toBe(false)
  })
})

test.describe("app route — no scroll on mobile landscape", () => {
  test.use({ viewport: MOBILE_LANDSCAPE })

  test("page does not overflow vertically on /app in landscape", async ({ page }) => {
    await page.goto("/app")
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight
    )
    expect(overflow).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Mobile menu — hamburger button
// ---------------------------------------------------------------------------

test.describe("app route — mobile menu button", () => {
  test.use({ viewport: MOBILE_PORTRAIT })

  test("hamburger button is visible on mobile", async ({ page }) => {
    await page.goto("/app")
    await expect(page.getByTestId("hamburger-button")).toBeVisible()
  })

  test("bottom nav is hidden on mobile", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeHidden()
  })

  test("hamburger button has accessible label", async ({ page }) => {
    await page.goto("/app")
    await expect(page.getByTestId("hamburger-button")).toHaveAttribute("aria-label", "Open menu")
  })
})

// ---------------------------------------------------------------------------
// Mobile menu — opening and closing
// ---------------------------------------------------------------------------

test.describe("app route — mobile menu overlay", () => {
  test.use({ viewport: MOBILE_PORTRAIT })

  test("tapping hamburger opens the mobile menu overlay", async ({ page }) => {
    await page.goto("/app")
    await page.getByTestId("hamburger-button").click()
    await expect(page.getByTestId("mobile-menu")).toBeVisible()
  })

  test("mobile menu overlay contains all nav links", async ({ page }) => {
    await page.goto("/app")
    await page.getByTestId("hamburger-button").click()
    const menu = page.getByTestId("mobile-menu")
    for (const label of NAV_LABELS) {
      await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible()
    }
  })

  test("mobile menu shows exactly 5 nav links", async ({ page }) => {
    await page.goto("/app")
    await page.getByTestId("hamburger-button").click()
    await expect(page.getByTestId("mobile-menu").getByRole("link")).toHaveCount(5)
  })

  test("tapping X closes the mobile menu overlay", async ({ page }) => {
    await page.goto("/app")
    await page.getByTestId("hamburger-button").click()
    await expect(page.getByTestId("mobile-menu")).toBeVisible()
    await page.getByRole("button", { name: "Close menu" }).click()
    await expect(page.getByTestId("mobile-menu")).not.toBeVisible()
  })

  test("hamburger button shows aria-label=Close menu when overlay is open", async ({ page }) => {
    await page.goto("/app")
    await page.getByTestId("hamburger-button").click()
    await expect(page.getByTestId("hamburger-button")).toHaveAttribute("aria-label", "Close menu")
  })
})

// ---------------------------------------------------------------------------
// Mobile menu — navigation
// ---------------------------------------------------------------------------

test.describe("app route — mobile menu navigation", () => {
  test.use({ viewport: MOBILE_PORTRAIT })

  test("tapping a nav link in the overlay navigates to that route", async ({ page }) => {
    await page.goto("/app")
    await page.getByTestId("hamburger-button").click()
    await page.getByTestId("mobile-menu").getByRole("link", { name: "Pricing", exact: true }).click()
    await expect(page).toHaveURL("/app/pricing")
  })

  test("tapping a nav link closes the overlay after navigation", async ({ page }) => {
    await page.goto("/app")
    await page.getByTestId("hamburger-button").click()
    await page.getByTestId("mobile-menu").getByRole("link", { name: "Pricing", exact: true }).click()
    await expect(page.getByTestId("mobile-menu")).not.toBeVisible({ timeout: 2000 })
  })

  test("active route link is marked aria-current=page inside the overlay", async ({ page }) => {
    await page.goto("/app/pricing")
    await page.getByTestId("hamburger-button").click()
    const menu = page.getByTestId("mobile-menu")
    await expect(menu.getByRole("link", { name: "Pricing", exact: true })).toHaveAttribute("aria-current", "page")
    await expect(menu.getByRole("link", { name: "Home", exact: true })).not.toHaveAttribute("aria-current", "page")
  })
})

// ---------------------------------------------------------------------------
// Desktop — hamburger must NOT appear on wide screens
// ---------------------------------------------------------------------------

test.describe("app route — no hamburger on desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test("hamburger button is not visible on desktop", async ({ page }) => {
    await page.goto("/app")
    await expect(page.getByTestId("hamburger-button")).not.toBeVisible()
  })

  test("bottom nav is visible on desktop", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeVisible()
  })
})
