import { test, expect } from "@playwright/test"

// ---------------------------------------------------------------------------
// Dashboard tab URL routing
//
// Each dashboard tab must have its own unique URL so users can bookmark,
// share, and navigate with browser back/forward.
//
// These tests run without authentication — they verify the redirect chain
// (unauthenticated → /login) and the URL structure. Authenticated tab
// rendering tests would require a seeded session (future work).
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173"

test.describe("dashboard routing — unauthenticated redirects", () => {
  const tabs = ["overview", "calls", "messages", "usage", "knowledge", "settings"]

  test("/dashboard redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await expect(page).toHaveURL(/\/login/)
  })

  for (const tab of tabs) {
    test(`/dashboard/${tab} redirects to /login when unauthenticated`, async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/${tab}`)
      await expect(page).toHaveURL(/\/login/)
    })
  }
})

test.describe("dashboard routing — unknown tab redirect", () => {
  test("/dashboard/nonexistent redirects to /login (unauthenticated)", async ({ page }) => {
    // Unauthenticated: hits ProtectedRoute → /login
    // The important thing is it doesn't crash or 404
    await page.goto(`${BASE_URL}/dashboard/nonexistent`)
    await expect(page).toHaveURL(/\/login|\/dashboard/)
    // Must not show an error page
    await expect(page.locator("body")).not.toContainText("Cannot GET")
    await expect(page.locator("body")).not.toContainText("404")
  })
})
