import { test, expect } from "@playwright/test"

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
  })

  test("nav links are present", async ({ page }) => {
    const nav = page.locator("nav").first()
    await expect(nav.getByRole("link", { name: "How It Works", exact: true })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Pricing", exact: true })).toBeVisible()
    // Industries is a dropdown trigger (button), not a direct link
    await expect(nav.getByRole("button", { name: /industries/i })).toBeVisible()
  })

  test("hero CTA links to signup", async ({ page }) => {
    const cta = page.getByRole("link", { name: /get started/i }).first()
    await expect(cta).toHaveAttribute("href", /signup/)
  })

  test("hero headline contains outcome copy", async ({ page }) => {
    const h1 = page.getByRole("heading", { level: 1 })
    await expect(h1).toContainText("Every call answered")
    await expect(h1).toContainText("Every appointment booked")
    await expect(h1).toContainText("Zero revenue left behind")
  })

  test("hero subheadline mentions missed calls stat", async ({ page }) => {
    await expect(page.getByText(/1 in 5 inbound calls/)).toBeVisible()
  })

  test("Products suite section is not on page", async ({ page }) => {
    await expect(page.locator("#products")).toHaveCount(0)
    await expect(page.getByText("The Neuvetra Suite")).toHaveCount(0)
  })

  test("social proof strip is visible", async ({ page }) => {
    const strip = page.locator("section").filter({ hasText: "Trusted by" })
    await expect(strip).toBeVisible()
    await expect(strip.getByText("Dental")).toBeVisible()
    await expect(strip.getByText("Legal")).toBeVisible()
  })

  test("FAQ section shows all questions", async ({ page }) => {
    const faq = page.locator("#faq")
    await faq.scrollIntoViewIfNeeded()
    await expect(faq.getByText("Will my callers know they're talking to AI?")).toBeVisible()
    await expect(faq.getByText("Do I need to change my phone number?")).toBeVisible()
    await expect(faq.getByText("What if it gets something wrong?")).toBeVisible()
    await expect(faq.getByText("What languages does it support?")).toBeVisible()
    await expect(faq.getByText("Can I customize what it says?")).toBeVisible()
  })

  test("FAQ accordion reveals answer on click", async ({ page }) => {
    const faq = page.locator("#faq")
    await faq.scrollIntoViewIfNeeded()
    const trigger = faq.getByText("Will my callers know they're talking to AI?")
    const answer = page.getByText("sounds natural and professional")
    await expect(answer).not.toBeVisible()
    await trigger.click()
    await expect(answer).toBeVisible()
  })

  test("CTA banner has updated headline", async ({ page }) => {
    await expect(page.getByText("Your first AI-answered call is 10 minutes away.")).toBeVisible()
  })

  test("footer contact link goes to contact page", async ({ page }) => {
    const footer = page.locator("footer")
    await expect(footer.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact")
  })

  test("footer has no dead hash links", async ({ page }) => {
    const deadLinks = page.locator('footer a[href="#"]')
    await expect(deadLinks).toHaveCount(0)
  })

  test("footer has legal links", async ({ page }) => {
    const footer = page.locator("footer")
    await expect(footer.getByRole("link", { name: "Privacy Policy" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Terms of Service" })).toBeVisible()
  })

  test("Industries section is present", async ({ page }) => {
    const section = page.locator("#industries")
    await section.scrollIntoViewIfNeeded()
    // "Home Services" is a category filter button
    await expect(section.getByRole("button", { name: "Home Services" })).toBeVisible()
    // "Dental" appears as an industry card
    await expect(section.getByText("Dental", { exact: true }).first()).toBeVisible()
  })

  test("CallFAB is visible on the landing page", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Call our AI receptionist" })).toBeVisible()
  })

  test("CallFAB tooltip shows demo number on hover", async ({ page }) => {
    await page.getByRole("button", { name: "Call our AI receptionist" }).hover()
    await expect(page.getByText("+1 (650) 433-9442")).toBeVisible()
  })
})
