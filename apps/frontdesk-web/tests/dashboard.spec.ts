import { test, expect } from "@playwright/test"

test.describe("Dashboard — unauthenticated", () => {
  test("redirects to /login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })
})

// Authenticated dashboard tests require storageState with a seeded session.
// Run: bun run scripts/gen-test-session.ts to generate test-session.json
// then uncomment the tests below.

// test.describe("Dashboard — authenticated", () => {
//   test.use({ storageState: "tests/fixtures/test-session.json" })
//
//   test("shows AI phone number", async ({ page }) => {
//     await page.goto("/dashboard")
//     await expect(page.getByText("AI Number")).toBeVisible()
//   })
//
//   test("shows business name", async ({ page }) => {
//     await page.goto("/dashboard")
//     await expect(page.getByText("Business")).toBeVisible()
//   })
//
//   test("shows plan badge", async ({ page }) => {
//     await page.goto("/dashboard")
//     await expect(page.getByText("Plan")).toBeVisible()
//   })
//
//   test("all tabs are present", async ({ page }) => {
//     await page.goto("/dashboard")
//     await expect(page.getByRole("button", { name: "Overview" })).toBeVisible()
//     await expect(page.getByRole("button", { name: "Call Logs" })).toBeVisible()
//     await expect(page.getByRole("button", { name: "Usage" })).toBeVisible()
//     await expect(page.getByRole("button", { name: "Knowledge Base" })).toBeVisible()
//     await expect(page.getByRole("button", { name: "Settings" })).toBeVisible()
//   })
// })
