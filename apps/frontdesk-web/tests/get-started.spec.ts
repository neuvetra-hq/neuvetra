import { test, expect } from "@playwright/test"

test.describe("/app/get-started wizard", () => {
  test("renders the IDENTIFY step title by default", async ({ page }) => {
    await page.goto("/app/get-started")
    await expect(page.getByText("IDENTIFY")).toBeVisible()
  })

  test("shows first name, last name, and phone inputs on step 0", async ({ page }) => {
    await page.goto("/app/get-started")
    await expect(page.getByPlaceholder("Jane")).toBeVisible()
    await expect(page.getByPlaceholder("Smith")).toBeVisible()
    await expect(page.getByPlaceholder("+1 (415) 555-0100")).toBeVisible()
  })

  test("back arrow is hidden on step 0", async ({ page }) => {
    await page.goto("/app/get-started")
    const back = page.getByTestId("wizard-back")
    await expect(back).toBeHidden()
  })

  test("renders 10 progress dots", async ({ page }) => {
    await page.goto("/app/get-started")
    const dots = page.getByTestId("wizard-dot")
    await expect(dots).toHaveCount(10)
  })

  test("shows sign-in link on step 0", async ({ page }) => {
    await page.goto("/app/get-started")
    await expect(page.getByText("Already have an account?")).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/login")
  })
})
