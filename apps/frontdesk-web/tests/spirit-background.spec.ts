import { test, expect, type Page } from "@playwright/test"

// WebGL2 is available by default in Chromium — no mock needed for the "supported" path.
// This helper is kept for symmetry with mockNoWebGL2 in app-route.spec.ts.
async function mockWebGL2(_page: Page) {
  // no-op: WebGL2 is supported in the Playwright Chromium browser by default
}

test.describe("spirit background", () => {
  test("renders background container and overlay on /app", async ({ page }) => {
    await mockWebGL2(page)
    await page.goto("/app")
    // Spirit canvas container (first absolute-inset-0 div behind everything)
    await expect(page.locator("div.absolute.inset-0").first()).toBeAttached()
    // Page content overlay (motion div with absolute inset-0 z-10)
    await expect(page.locator("div.absolute.inset-0.z-10")).toBeAttached()
  })
})
