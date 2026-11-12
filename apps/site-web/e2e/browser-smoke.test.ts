/**
 * E2E-01: browser smoke suite for site-web against a real local stack (see README.md in this folder).
 *
 * Runs only when E2E_DATABASE_URL names a disposable loopback PostgreSQL database called `neuvetra_e2e` (it is dropped
 * and recreated). Needs the staging bundle (`bun run build:staging`) and a Chrome (CHROME_PATH, or a usual location).
 *
 *   cd apps/site-web && E2E_DATABASE_URL=postgres://e2e_admin@127.0.0.1:55432/neuvetra_e2e bun run test:e2e
 *
 * Each journey is one of the browser-only defects QA found by hand in November 2026: a false ✓ on the Overview, a record
 * that didn't open at its own address, input lost on navigation, a cross-user address leak, an outage that closed the
 * workspace, write controls shown to a view-only member, page overflow on Results, and stale claims on the landing page.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import type { Browser, Page } from "playwright-core"
import { addressesSeen, closeJourney, focusReport, horizontalOverflow, launchBrowser, openJourney, pageHeading, type Journey, type JourneyOptions } from "./harness/browser"
import { COMPANIES, RECORDS } from "./harness/seed"
import { startStack, type Stack } from "./harness/stack"

const DATABASE_URL = process.env.E2E_DATABASE_URL
const suite = DATABASE_URL ? describe : describe.skip


const ACTIVITY_LIST_HEADING = "Collect Scope 1, 2 and 3 activity"
const DISCARD_ACTIVITY = "confirm: Discard unsaved activity changes?"

let stack: Stack
let browser: Browser

/** One journey: its own browser context, artifacts kept on failure, and no uncaught page error allowed. */
function journey(name: string, options: JourneyOptions, body: (journey: Journey) => Promise<void>, timeout = 45_000) {
  test(name, async () => {
    const opened = await openJourney(browser, stack, options)
    let failed = true
    try {
      await body(opened)
      expect(opened.errors).toEqual([])
      failed = false
    } finally { await closeJourney(opened, name, failed) }
  }, timeout)
}

/** Waits until the visible page heading reads `text` (exactly, or as a part with `partial`). */
async function headingIs(page: Page, text: string, partial = false) {
  await page.waitForFunction(([expected, part]) => {
    const heading = [...document.querySelectorAll("main h1")].find(item => item.getClientRects().length > 0)
    const shown = heading?.textContent?.trim() ?? ""
    return part ? shown.includes(expected) : shown === expected
  }, [text, partial] as const)
}

/**
 * Makes the app check its session the way a returning user does (window focus), until `done` resolves. The app checks
 * at most once per 10 s on focus (MIN_CHECK_GAP_MS), so the focus is repeated every half second until a check happens.
 */
async function focusUntil(page: Page, done: Promise<unknown>, timeoutMs = 25_000) {
  let finished = false
  const result = done.finally(() => { finished = true })
  const deadline = Date.now() + timeoutMs
  while (!finished && Date.now() < deadline) {
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    await Promise.race([result.catch(() => {}), new Promise(resolve => setTimeout(resolve, 500))])
  }
  await result
}

/** Waits until the Activity list has loaded its saved records. */
async function activityListLoaded(page: Page) {
  await headingIs(page, ACTIVITY_LIST_HEADING)
  await page.locator("#saved-activities select").first().waitFor()
}

/** Opens a record by changing the address in the page (an in-app navigation that keeps history), and waits for it. */
async function openRecordByAddress(page: Page, recordId: string) {
  await page.evaluate(id => { window.location.hash = `#/activity/${id}` }, recordId)
  await page.waitForFunction(id => window.location.hash === `#/activity/${id}`, recordId)
  // The record view (WO-06): "Correct this record" reveals the correction form.
  await page.getByRole("button", { name: "Correct this record" }).click()
  await page.locator("label.setup-field", { hasText: "Reason for this correction" }).waitFor()
}

function quantityInput(page: Page) {
  return page.locator("#collection-record-editor label.setup-field", { hasText: "Original quantity from source" }).locator("input")
}

type ActivityRecord = { id: string; currentVersion: { id: string; revision: number }; history: Array<{ id: string; revision: number }> }
async function savedRecord(id: string): Promise<ActivityRecord> {
  const { records } = await stack.api<{ records: ActivityRecord[] }>("owner", `/workspace/${COMPANIES.first}/collection/activities`)
  const found = records.find(record => record.id === id)
  if (!found) throw new Error(`Seeded record ${id} is missing.`)
  return found
}

suite("site-web browser smoke (E2E-01)", () => {
  beforeAll(async () => {
    stack = await startStack(DATABASE_URL!)
    browser = await launchBrowser()
  }, 120_000)
  afterAll(async () => {
    await browser?.close()
    await stack?.stop()
  })

  journey("the landing page makes none of the withdrawn claims", {}, async ({ page }) => {
    await page.goto("/")
    await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor()
    const text = await page.evaluate(() => document.documentElement.textContent ?? "")
    for (const banned of ["Coming next", "Scope 3 is not calculated"]) expect(text.toLowerCase()).not.toContain(banned.toLowerCase())
  })

  journey("an owner signs in and lands on the Overview", {}, async ({ page }) => {
    await page.goto("/")
    const form = page.locator("form", { has: page.locator("input[type=email]") }).first()
    await form.locator("input[type=email]").fill("owner@example.test")
    await form.locator("input[type=password]").fill("synthetic-password")
    await form.getByRole("button", { name: "Sign in", exact: true }).click()
    await headingIs(page, "Synthetic Bayline")
    expect(new URL(page.url()).hash).toBe("#/overview")
    await page.getByRole("heading", { name: "Your three steps" }).waitFor()
  })

  journey("with Scope 3 on, the Overview and navigation show no false ✓", { signedInAs: "owner" }, async ({ page }) => {
    await page.goto("/#/overview")
    // The Scope 3 row appears only once progress has loaded, so every check below sees the loaded state.
    await page.getByText("Scope 3 to-do: see Results").waitFor()
    expect(await page.locator(".nv-journey__step[data-state=done]").count()).toBe(0)
    expect(await page.locator(".nv-navitem__icon--done").count()).toBe(0)
    // The check mark icon's path, anywhere in the journey steps or the navigation.
    expect(await page.locator(".nv-journey path[d^='M5 12.5'], nav path[d^='M5 12.5']").count()).toBe(0)
    const text = await page.locator("body").innerText()
    for (const banned of ["(done)", "Draft ready", "Nothing is flagged", "Complete ·"]) expect(text).not.toContain(banned)
  })

  test("record view (WO-06): a click and the keyboard open a record at its own address, and Back returns to the list", async () => {
    for (const [mode, width, height] of [["click", 1360, 900], ["keyboard", 390, 844]] as const) {
      const opened = await openJourney(browser, stack, { signedInAs: "owner", width, height })
      let failed = true
      try {
        const { page } = opened
        await page.goto("/#/activity")
        await activityListLoaded(page)
        const row = page.locator(`a[href="#/activity/${RECORDS.gasReady}"]`)
        if (mode === "click") await row.click()
        else { await row.focus(); await page.keyboard.press("Enter") }
        await page.waitForFunction(id => window.location.hash === `#/activity/${id}`, RECORDS.gasReady)
        await headingIs(page, "GAS-1", true)
        await page.waitForFunction(() => document.activeElement?.tagName === "H1")
        const shown = await focusReport(page)
        expect(shown.headingFocused).toBe(true)
        expect(shown.unobscured).toBe(true)
        expect(shown.top!).toBeGreaterThanOrEqual(shown.stickyOffset)
        expect(shown.bottom!).toBeLessThanOrEqual(shown.viewportHeight)
        await page.goBack()
        await page.waitForFunction(() => /^#\/activity(\?|$)/.test(window.location.hash))
        await headingIs(page, ACTIVITY_LIST_HEADING)
        expect(opened.errors).toEqual([])
        failed = false
      } finally { await closeJourney(opened, `record view ${mode}`, failed) }
    }
  }, 60_000)

  journey("leaving a correction with unsaved input prompts once per attempt, and declining keeps the input", { signedInAs: "owner" }, async opened => {
    const { page } = opened
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await openRecordByAddress(page, RECORDS.electricityReady)
    const address = `#/activity/${RECORDS.electricityReady}`
    await quantityInput(page).fill("250001")
    opened.answerDialogs = false
    // 1. The navigation's Overview.
    await page.locator("nav").getByRole("button", { name: /Overview/ }).first().click()
    await page.waitForTimeout(300)
    expect(opened.dialogs).toEqual([DISCARD_ACTIVITY])
    expect(new URL(page.url()).hash).toBe(address)
    expect(await quantityInput(page).inputValue()).toBe("250001")
    // 2. The browser's Back.
    await page.goBack()
    await page.waitForTimeout(300)
    expect(opened.dialogs).toEqual([DISCARD_ACTIVITY, DISCARD_ACTIVITY])
    await page.waitForFunction(target => window.location.hash === target, address)
    expect(await quantityInput(page).inputValue()).toBe("250001")
    expect(opened.writes).toEqual([])
  })

  journey("saving a correction creates exactly one new version", { signedInAs: "owner" }, async opened => {
    const { page } = opened
    const before = await savedRecord(RECORDS.gasReady)
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await openRecordByAddress(page, RECORDS.gasReady)
    await quantityInput(page).fill("12600")
    await page.locator("label.setup-field", { hasText: "Reason for this correction" }).locator("input").fill("E2E: corrected meter reading")
    const saved = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/collection/activities/${RECORDS.gasReady}`))
    await page.getByRole("button", { name: "Save correction" }).click()
    expect((await saved).status()).toBe(201)
    // The screen settles on the saved version before the server is asked again.
    await page.getByRole("button", { name: new RegExp(`^Version ${before.currentVersion.revision + 1} ·`) }).waitFor()
    await page.waitForTimeout(500)
    const after = await savedRecord(RECORDS.gasReady)
    expect(after.currentVersion.revision).toBe(before.currentVersion.revision + 1)
    expect(after.history.length).toBe(before.history.length + 1)
    expect(opened.writes.filter(write => write.endsWith(`/collection/activities/${RECORDS.gasReady}`))).toHaveLength(1)
  })

  journey("a view-only member is offered no write action on Activity", { signedInAs: "member" }, async opened => {
    const { page } = opened
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await page.getByText("You have view access.").waitFor()
    await page.getByRole("button", { name: /^Counted \(/ }).waitFor()
    const enabled = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main button, main input, main select, main textarea")]
      .filter(element => element.getClientRects().length > 0 && !(element as HTMLButtonElement).disabled && element.getAttribute("aria-disabled") !== "true")
      .map(element => ({ tag: element.tagName.toLowerCase(), type: element.getAttribute("type") ?? "", name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 60),
        inRecordForm: Boolean(element.closest("#collection-record-editor")) })))
    // No enabled button that saves, imports, withdraws, corrects or starts a record.
    const WRITE_ACTION = /^(save|import|withdraw|correct this record|start a new record|link grid-loss|restore|prepare|approve|delete|remove)/i
    expect(enabled.filter(control => control.tag === "button" && WRITE_ACTION.test(control.name))).toEqual([])
    // WO-12 (P1, open on main c580f77): a member still sees the new-record form's fields, the file pickers and the spend
    // mapping's "Map" button enabled; the server refuses their writes. They are tolerated here and nothing else is. When
    // WO-12 lands, delete this tolerance so the check becomes "no write control at all".
    const tolerated = (control: (typeof enabled)[number]) => control.inRecordForm || control.type === "file" || control.name === "Map"
    const navigationAndReading = /^(Results & report|Ask about a field|Review or correct|Reload saved records|Needs a code|Other holds|Possible duplicates|Counted|.*\(\d+\)$)/
    const unexpected = enabled.filter(control => !tolerated(control) && !(control.tag === "button" && navigationAndReading.test(control.name))
      && !(control.tag === "select") && !(control.tag === "input" && ["", "text", "search"].includes(control.type)))
    expect(unexpected).toEqual([])
    // The record view (WO-06) offers a member no "Correct this record".
    await page.evaluate(id => { window.location.hash = `#/activity/${id}` }, RECORDS.gasReady)
    await headingIs(page, "GAS-1", true)
    expect(await page.getByRole("button", { name: "Correct this record" }).count()).toBe(0)
    expect(opened.writes).toEqual([])
  })

  journey("after user A's session ends, user B signing in on the same page never lands on A's record", { signedInAs: "owner" }, async ({ page }) => {
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await page.evaluate(id => { window.location.hash = `#/activity/${id}` }, RECORDS.gasNeedsInput)
    await page.waitForFunction(id => window.location.hash === `#/activity/${id}`, RECORDS.gasNeedsInput)
    await page.waitForTimeout(500)
    const before = (await addressesSeen(page)).length
    // The server now answers 401 for A's token, as for an expired session; a focus makes the app check it.
    stack.tokens.revokeUser("owner")
    await focusUntil(page, page.getByRole("heading", { name: "Your session ended" }).waitFor({ timeout: 25_000 }))
    const form = page.locator("form", { has: page.locator("input[type=email]") }).first()
    await form.locator("input[type=email]").fill("other-owner@example.test")
    await form.locator("input[type=password]").fill("synthetic-password")
    await form.getByRole("button", { name: "Sign in", exact: true }).click()
    await pageHeading(page).waitFor()
    await page.locator("nav").first().waitFor()
    await page.waitForTimeout(1000)
    const afterEnd = (await addressesSeen(page)).slice(before)
    expect(afterEnd.filter(address => address.includes(RECORDS.gasNeedsInput))).toEqual([])
    expect(new URL(page.url()).hash).not.toContain(RECORDS.gasNeedsInput)
    expect(JSON.stringify(await page.evaluate(() => window.history.state))).not.toContain(RECORDS.gasNeedsInput)
    // B is in their own company: A's record is not on B's Activity page either.
    await page.evaluate(() => { window.location.hash = "#/activity" })
    await activityListLoaded(page)
    expect(await page.locator("#saved-activities").innerText()).not.toContain("GAS-2")
  })

  journey("a transient 503 on the session check keeps the workspace and typed input", { signedInAs: "owner" }, async ({ page }) => {
    await page.goto("/#/activity")
    await activityListLoaded(page)
    const reference = page.locator("#collection-record-editor label.setup-field", { hasText: "Source reference" }).locator("input")
    await reference.fill("E2E typed, not saved")
    let refused = 0
    await page.route("**/workspace-api/session", route => { refused++; return route.fulfill({ status: 503, contentType: "application/json", headers: { "retry-after": "1" }, body: JSON.stringify({ error: "Unavailable." }) }) })
    await focusUntil(page, page.locator(".nv-reconnecting-wrap", { hasText: "We couldn’t reach Neuvetra — retrying." }).waitFor({ timeout: 25_000 }))
    expect(refused).toBeGreaterThan(0)
    await headingIs(page, ACTIVITY_LIST_HEADING)
    expect(await reference.inputValue()).toBe("E2E typed, not saved")
    await page.unroute("**/workspace-api/session")
    // The app retries on its own; the notice goes and the input is still there.
    await page.locator(".nv-reconnecting-wrap").waitFor({ state: "detached", timeout: 20_000 })
    await headingIs(page, ACTIVITY_LIST_HEADING)
    expect(await reference.inputValue()).toBe("E2E typed, not saved")
    expect(await page.getByRole("heading", { name: "Your session ended" }).count()).toBe(0)
  })

  journey("Results renders with Scope 3 and has no horizontal overflow at 1360 and 320 px", { signedInAs: "owner" }, async ({ page }) => {
    await page.goto("/#/results")
    await page.getByRole("heading", { name: "Scope 3 · value chain" }).waitFor({ timeout: 30_000 })
    await page.getByText("Scope 3 to-do").first().waitFor()
    await page.waitForLoadState("networkidle")
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    await page.setViewportSize({ width: 320, height: 720 })
    await page.waitForTimeout(400)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  }, 60_000)
})
