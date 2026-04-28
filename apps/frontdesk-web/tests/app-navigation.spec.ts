import { test, expect } from "@playwright/test"

// These tests are the regression safety net for Task 43 (XState architecture cleanup).
// They define the invariants that must hold before, during, and after refactoring:
//   - Route registry consolidation
//   - appMachine view simplification
//   - Audio unlock actor migration
//   - AppSpiritProvider split

const APP_ROUTES = [
  { path: "/app",               label: "Home",         heading: "Front Desk" },
  { path: "/app/how-it-works",  label: "How It Works", heading: "How It Works" },
  { path: "/app/pricing",       label: "Pricing",      heading: "Pricing" },
  { path: "/app/sign-in",       label: "Sign In",      heading: "Sign In" },
  { path: "/app/get-started",   label: "Get Started",  heading: "Get Started" },
]

test.describe("app nav links", () => {
  test("renders all 5 links with correct labels", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeVisible()

    for (const { label, path } of APP_ROUTES) {
      const link = page.locator("nav").getByRole("link", { name: label, exact: true })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute("href", path)
    }
  })

  test("renders exactly 5 nav links — no more, no fewer", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("nav").getByRole("link")).toHaveCount(5)
  })

  test("active link has aria-current=page for /app (Home)", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeVisible()
    const homeLink = page.locator("nav").getByRole("link", { name: "Home", exact: true })
    await expect(homeLink).toHaveAttribute("aria-current", "page")
    // Other links must NOT have aria-current
    const pricingLink = page.locator("nav").getByRole("link", { name: "Pricing", exact: true })
    await expect(pricingLink).not.toHaveAttribute("aria-current", "page")
  })

  test("active link has aria-current=page for /app/pricing", async ({ page }) => {
    await page.goto("/app/pricing")
    await expect(page.locator("nav")).toBeVisible()
    const pricingLink = page.locator("nav").getByRole("link", { name: "Pricing", exact: true })
    await expect(pricingLink).toHaveAttribute("aria-current", "page")
    const homeLink = page.locator("nav").getByRole("link", { name: "Home", exact: true })
    await expect(homeLink).not.toHaveAttribute("aria-current", "page")
  })
})

test.describe("app nav — clicking links navigates", () => {
  for (const { label, path } of APP_ROUTES.filter((r) => r.path !== "/app")) {
    test(`clicking '${label}' from /app navigates to ${path}`, async ({ page }) => {
      await page.goto("/app")
      await expect(page.locator("nav")).toBeVisible()
      await page.locator("nav").getByRole("link", { name: label, exact: true }).click()
      await expect(page).toHaveURL(path)
      await expect(page.locator("nav")).toBeVisible()
    })
  }

  test("clicking Home from /app/pricing navigates back to /app", async ({ page }) => {
    await page.goto("/app/pricing")
    await expect(page.locator("nav")).toBeVisible()
    await page.locator("nav").getByRole("link", { name: "Home", exact: true }).click()
    await expect(page).toHaveURL("/app")
  })
})

test.describe("app loader on deep routes", () => {
  // /app itself is covered by app-route.spec.ts — that test handles the faster engine init race.
  // Here we verify deep routes also show the loader on direct navigation.
  for (const { path } of APP_ROUTES.filter((r) => r.path !== "/app")) {
    test(`loader appears then hides on direct navigation to ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" })
      const loader = page.getByTestId("app-loader")
      await expect(loader).toBeAttached({ timeout: 10000 })
      await expect(loader).not.toBeAttached({ timeout: 10000 })
      await expect(page.locator("nav")).toBeVisible()
    })
  }
})
