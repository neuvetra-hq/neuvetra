import { test, expect, type Page } from "@playwright/test"

async function mockNoWebGL2(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext.bind(HTMLCanvasElement.prototype)
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2") return null
      return original.apply(this, [type, ...args] as Parameters<typeof original>)
    }
  })
}

test.describe("/app route", () => {
  test("redirects to home when WebGL2 is not supported", async ({ page }) => {
    await mockNoWebGL2(page)
    await page.goto("/app")
    await expect(page).toHaveURL("/")
  })

  test("renders spirit layout when WebGL2 is available", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("div.absolute.inset-0").first()).toBeAttached()
    await expect(page.locator("nav")).toBeVisible()
  })

  test("shows loader on arrival then hides it after engine init", async ({ page }) => {
    await page.goto("/app", { waitUntil: "domcontentloaded" })
    const loader = page.getByTestId("app-loader")
    await expect(loader).toBeAttached({ timeout: 10000 })
    await expect(loader).not.toBeAttached({ timeout: 10000 })
    await expect(page.locator("nav")).toBeVisible()
  })

  test("mute button is hidden before first user interaction", async ({ page }) => {
    await page.goto("/app")
    // Audio is locked until user gesture — mute button must not be visible
    const muteBtn = page.getByRole("button", { name: /mute|unmute/i })
    await expect(muteBtn).toBeHidden()
  })

  test("mute button appears after first interaction and toggles label", async ({ page }) => {
    await page.goto("/app")
    // Wait for AppLayoutInner to mount and register document listeners
    await expect(page.locator("nav")).toBeVisible()
    // Trigger USER_INTERACTED via a real user gesture click
    await page.locator("h1").click()
    const muteBtn = page.getByRole("button", { name: /mute|unmute/i })
    await expect(muteBtn).toBeVisible({ timeout: 3000 })
    // Default state is unmuted — button says "Mute"
    await expect(muteBtn).toHaveAttribute("aria-label", "Mute")
    // Click to mute
    await muteBtn.click()
    await expect(muteBtn).toHaveAttribute("aria-label", "Unmute")
    // Click to unmute
    await muteBtn.click()
    await expect(muteBtn).toHaveAttribute("aria-label", "Mute")
  })
})
