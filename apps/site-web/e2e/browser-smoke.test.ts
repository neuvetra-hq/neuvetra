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
// E2E-02 (QA F2): outside CI the suite is skipped without a database; in CI a missing database is an error, never a
// silently green run with every test skipped. The CI job also checks the pass count (E2E_EXPECTED_PASS).
if (!DATABASE_URL && process.env.CI) throw new Error("E2E_DATABASE_URL is not set: in CI the browser smoke suite must run, not skip.")
const suite = DATABASE_URL ? describe : describe.skip

const ACTIVITY_LIST_HEADING = "Collect Scope 1, 2 and 3 activity"
const DISCARD_ACTIVITY = "confirm: Discard unsaved activity changes?"

/** Controls a view-only member may use on Activity: navigation, list filters and search, reloading, review tabs. */
const MEMBER_READING_CONTROLS = [
  /^button Results & report$/, /^button Reload saved records$/, /^button Ask about a field$/,
  /^select (Status|Activity type)$/, /^input Find a source, vendor or description$/, /^input Find lines$/,
  /^button (Needs a code|Other holds|Possible duplicates|Counted) \(\d+\)$/,
]
/**
 * WO-12 (P1, open on main eeb944b): write controls a member is still shown enabled; the server refuses their writes.
 * Exactly these, by accessible name: the new-record form (its 22 type buttons and the natural-gas form's fields and
 * evidence link), the file pickers, the spend import's setup location and the spend mapping's "Map". When WO-12 lands,
 * delete this list so the check becomes "no write control at all". If WO-10 (PR #46) renames a field, update its entry.
 */
const WO12_OPEN_MEMBER_CONTROLS = [
  new RegExp(`^button (${["Natural gas", "Diesel or fuel-oil generator", "Road vehicle or vehicle group", "Refrigerants and fire suppression", "Purchased electricity",
    "Purchases by spend", "Supplier-specific purchases", "Energy bought and resold", "Freight transport", "Waste", "End of life of sold products", "Business travel",
    "Employee commuting", "Employee commuting \\(survey averages\\)", "Teleworking", "Energy use of leased, processing or franchise sites", "Partner-reported emissions",
    "Buildings by floor area", "Fuels sold", "Energy-using products sold", "Products containing greenhouse gases", "Investments"].join("|")})( \\(Scope 3\\))?$`),
  /^select (Company-setup location|Data quality)$/,
  /^input\[text\] (Gas account or meter ID|Original quantity from source|Original unit as printed|Source reference)$/,
  /^input\[date\] (Period start|Last day covered)$/,
  /^textarea Notes and unresolved questions$/,
  /^input\[checkbox\] ledger-2025\.csv · /,
  /^input\[file\] (Spend file|Upload PDF, image, CSV or XLSX)/,
  /^select Setup location$/,
  /^button Map$/,
]

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
  await reasonInput(page).waitFor()
}

/**
 * Form fields by their label. `getByLabel` matches both the current markup (a label wrapping its input) and WO-10's
 * (PR #46: a label pointing at the input with `for`, plus "Required"/"Optional" text), so these survive that change.
 */
function quantityInput(page: Page) {
  return page.locator("#collection-record-editor").getByLabel("Original quantity from source").first()
}
function reasonInput(page: Page) {
  return page.locator("#collection-record-editor").getByLabel("Reason for this correction").first()
}

/** Waits until the page has opened `count` dialogs, then a short settle so a second, unwanted dialog would be seen. */
async function dialogsReach(journey: Journey, count: number) {
  const deadline = Date.now() + 10_000
  while (journey.dialogs.length < count && Date.now() < deadline) await journey.page.waitForTimeout(50)
  expect(journey.dialogs.length).toBeGreaterThanOrEqual(count)
  await journey.page.waitForTimeout(300)
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
    await dialogsReach(opened, 1)
    expect(opened.dialogs).toEqual([DISCARD_ACTIVITY])
    expect(new URL(page.url()).hash).toBe(address)
    expect(await quantityInput(page).inputValue()).toBe("250001")
    // 2. The browser's Back.
    await page.goBack()
    await dialogsReach(opened, 2)
    expect(opened.dialogs).toEqual([DISCARD_ACTIVITY, DISCARD_ACTIVITY])
    await page.waitForFunction(target => window.location.hash === target, address)
    expect(await quantityInput(page).inputValue()).toBe("250001")
    expect(opened.writes).toEqual([])
  })

  journey("saving a correction, even by double-click, creates exactly one new version", { signedInAs: "owner" }, async opened => {
    const { page } = opened
    const before = await savedRecord(RECORDS.gasReady)
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await openRecordByAddress(page, RECORDS.gasReady)
    await quantityInput(page).fill("12600")
    await reasonInput(page).fill("E2E: corrected meter reading")
    const saved = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/collection/activities/${RECORDS.gasReady}`))
    // E2E-02 (QA F3): an impatient double-click must still save once (the busy guard, the disabled button and the
    // reused idempotency key all protect this).
    await page.getByRole("button", { name: "Save correction" }).dblclick()
    expect((await saved).status()).toBe(201)
    // The screen settles on the saved version before the server is asked again.
    await page.getByRole("button", { name: new RegExp(`^Version ${before.currentVersion.revision + 1} ·`) }).waitFor()
    await page.waitForTimeout(1000)
    const after = await savedRecord(RECORDS.gasReady)
    expect(after.currentVersion.revision).toBe(before.currentVersion.revision + 1)
    expect(after.history.length).toBe(before.history.length + 1)
    // The database itself, not only the API: one new version row for this record.
    const versions = await stack.operator.query<{ count: string }>("select count(*)::text as count from neuvetra.collection_activity_versions where record_id = $1", [RECORDS.gasReady])
    expect(Number(versions.rows[0]?.count)).toBe(before.history.length + 1)
    expect(opened.writes.filter(write => write.endsWith(`/collection/activities/${RECORDS.gasReady}`))).toHaveLength(1)
  })

  journey("a view-only member is offered no write action on Activity", { signedInAs: "member" }, async opened => {
    const { page } = opened
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await page.getByText("You have view access.").waitFor()
    await page.getByRole("button", { name: /^Counted \(/ }).waitFor()
    // Every enabled control in the page's main region, by accessible name: aria-label, else the label's name (its first
    // span, in both the current field markup and WO-10's, where "Required"/"Optional" and hints follow it), else text.
    const enabled = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main button, main input, main select, main textarea")]
      .filter(element => element.getClientRects().length > 0 && !(element as HTMLButtonElement).disabled && element.getAttribute("aria-disabled") !== "true")
      .map(element => {
        const label = (element as HTMLInputElement).labels?.[0] ?? null
        const name = element.getAttribute("aria-label") ?? label?.querySelector("span")?.textContent ?? label?.textContent ?? element.textContent ?? ""
        const type = element.tagName === "INPUT" && element.getAttribute("type") ? `[${element.getAttribute("type")}]` : ""
        return `${element.tagName.toLowerCase()}${type} ${name.replace(/\s+/g, " ").trim()}`
      }))
    const unexpected = enabled.filter(control => !MEMBER_READING_CONTROLS.some(rule => rule.test(control)) && !WO12_OPEN_MEMBER_CONTROLS.some(rule => rule.test(control)))
    expect(unexpected).toEqual([])
    // The record view (WO-06) offers a member no "Correct this record".
    await page.evaluate(id => { window.location.hash = `#/activity/${id}` }, RECORDS.gasReady)
    await headingIs(page, "GAS-1", true)
    expect(await page.getByRole("button", { name: "Correct this record" }).count()).toBe(0)
    expect(opened.writes).toEqual([])
  })

  // E2E-02 (QA F1): B is the company-1 admin, so A's record exists for B too and no "record not found" fallback can hide
  // a leak. The address is checked where it can leak: on the "Your session ended" screen and after B signs in.
  journey("after user A's session ends, user B of the same company signing in on the same page never sees A's record address", { signedInAs: "owner" }, async ({ page }) => {
    const leaked = RECORDS.gasNeedsInput
    const addressNow = () => page.evaluate(() => ({ hash: window.location.hash, url: window.location.href, state: JSON.stringify(window.history.state) ?? "" }))
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await page.evaluate(id => { window.location.hash = `#/activity/${id}` }, leaked)
    await headingIs(page, "GAS-2", true)
    const before = (await addressesSeen(page)).length
    // The server now answers 401 for A's token, as for an expired session; a focus makes the app check it.
    stack.tokens.revokeUser("owner")
    await focusUntil(page, page.getByRole("heading", { name: "Your session ended" }).waitFor({ timeout: 25_000 }))
    const onEndedScreen = await addressNow()
    expect(onEndedScreen.url).not.toContain(leaked)
    expect(onEndedScreen.state).not.toContain(leaked)
    const form = page.locator("form", { has: page.locator("input[type=email]") }).first()
    await form.locator("input[type=email]").fill("admin@example.test")
    await form.locator("input[type=password]").fill("synthetic-password")
    await form.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.locator("nav").first().waitFor()
    await pageHeading(page).waitFor()
    // Let the workspace settle (progress and the shown view load) before the final checks.
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(500)
    const afterSignIn = await addressNow()
    expect(afterSignIn.url).not.toContain(leaked)
    expect(afterSignIn.state).not.toContain(leaked)
    expect(await pageHeading(page).textContent()).not.toContain("GAS-2")
    expect((await addressesSeen(page)).slice(before).filter(address => address.includes(leaked))).toEqual([])
    // B is in the workspace as themselves.
    expect(await page.locator(".nv-topbar__user").textContent()).toBe("admin@example.test")
  })

  journey("a transient 503 on the session check keeps the workspace and typed input", { signedInAs: "owner" }, async ({ page }) => {
    await page.goto("/#/activity")
    await activityListLoaded(page)
    const reference = page.locator("#collection-record-editor").getByLabel("Source reference").first()
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
