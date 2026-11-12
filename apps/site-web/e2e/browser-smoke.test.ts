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

/**
 * Controls a view-only member may use on Activity: navigation, list filters and search, reloading, review tabs; and the
 * WO-08 shell's: ≡ Menu, the sheet's Close menu, the context bar's Details toggle (its name ends in the ▸/▾ chevron), the
 * sheet's navigation items and Ask (a step's text starts with its aria-hidden number, and each item's title is followed by
 * its status line), and Sign out.
 */
const MEMBER_READING_CONTROLS = [
  /^button Results & report$/, /^button Reload saved records$/, /^button Ask about a field$/,
  /^select (Status|Activity type)$/, /^input Find a source, vendor or description$/, /^input Find lines$/,
  /^button (Needs a code|Other holds|Possible duplicates|Counted) \(\d+\)$/,
  /^button Menu$/, /^button Close menu$/, /^button Details[▸▾]$/,
  /^button (Overview|1Step 1: Company setup|2Step 2: Activity & evidence|3Step 3: Results & report|Ask Neuvetra)/,
  /^button Sign out$/,
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

/** The address a request was made from (which visit fired it). */
function visitOf(page: Page) { return new URL(page.url()).hash }
/** WO-04b: waits until the Overview has checked Scope 1, 2 and 3, and returns its open items (keys) and its summary line. */
async function overviewChecked(page: Page) {
  await page.locator("[data-readiness-summary]").waitFor({ timeout: 30_000 })
  await page.locator("li[data-readiness-item^='scope3:']").first().waitFor({ timeout: 60_000 })
  const items = await page.locator("li[data-readiness-item]").evaluateAll(rows => rows.map(row => row.getAttribute("data-readiness-item")!))
  return { items, summary: await page.locator("[data-readiness-summary]").innerText() }
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

/**
 * Every enabled control under `roots`, by accessible name: aria-label, else the label's name (its first span, in both the
 * current field markup and WO-10's, where "Required"/"Optional" and hints follow it), else text.
 */
async function enabledControls(page: Page, roots: string) {
  return page.evaluate(selector => [...document.querySelectorAll<HTMLElement>(selector)]
    .flatMap(root => [...root.querySelectorAll<HTMLElement>("button, input, select, textarea")])
    .filter(element => element.getClientRects().length > 0 && !(element as HTMLButtonElement).disabled && element.getAttribute("aria-disabled") !== "true")
    .map(element => {
      const label = (element as HTMLInputElement).labels?.[0] ?? null
      const name = element.getAttribute("aria-label") ?? label?.querySelector("span")?.textContent ?? label?.textContent ?? element.textContent ?? ""
      const type = element.tagName === "INPUT" && element.getAttribute("type") ? `[${element.getAttribute("type")}]` : ""
      return `${element.tagName.toLowerCase()}${type} ${name.replace(/\s+/g, " ").trim()}`
    }), roots)
}

/** The controls a view-only member may not be offered: on neither the reading list nor the known WO-12 list. */
function notAllowed(controls: string[]) {
  return controls.filter(control => !MEMBER_READING_CONTROLS.some(rule => rule.test(control)) && !WO12_OPEN_MEMBER_CONTROLS.some(rule => rule.test(control)))
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
    // WO-04b: wait until Scope 3 has been checked too (its items are in the list), so every check below sees the loaded state.
    await overviewChecked(page)
    expect(await page.locator(".nv-journey__step[data-state=done]").count()).toBe(0)
    expect(await page.locator(".nv-navitem__icon--done").count()).toBe(0)
    // The check mark icon's path, anywhere in the journey steps or the navigation.
    expect(await page.locator(".nv-journey path[d^='M5 12.5'], nav path[d^='M5 12.5']").count()).toBe(0)
    const text = await page.locator("body").innerText()
    for (const banned of ["(done)", "Draft ready", "Nothing is flagged", "Complete ·"]) expect(text).not.toContain(banned)
  })

  journey("readiness (WO-04b): the Overview, side navigation, Menu sheet, Results and Ask agree, and Scope 3 is requested once per visit", { signedInAs: "owner" }, async ({ page }) => {
    const scope3Requests: string[] = []
    page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/results/scope3")) scope3Requests.push(visitOf(page)) })
    await page.goto("/#/overview")
    // Scope 1 and 2 first; the Scope 3 part says "Checking…" (never a count of zero) until its one request answers.
    const early = await page.locator("nav.nv-sidenav .nv-navitem__meta").allInnerTexts()
    for (const meta of early) expect(meta).not.toMatch(/\b0 (open|block|waiting)|nothing open/)
    const { items, summary } = await overviewChecked(page)
    await page.waitForTimeout(1_000)
    expect(scope3Requests).toEqual(["#/overview"])
    const steps = await page.locator(".nv-journey__step .nv-journey__meta").allInnerTexts()
    const side = await page.locator("nav.nv-sidenav .nv-navitem__meta").allInnerTexts()
    // Sidebar: Overview (next step), S1, S2, S3 — the same words as the Overview's steps.
    expect(side.slice(1, 4)).toEqual([steps[0]!, steps[1]!, steps[3]!])
    expect(side[0]).toBe(await page.locator("[data-readiness-next]").innerText())
    const s3 = /Draft results available · (\d+) open · (\d+|none) blocks? internal approval/.exec(side[3]!)
    expect(s3).not.toBeNull()
    expect(Number(s3![1])).toBe(items.length)
    // The Scope 3 part of the count is the Results to-do's own count, and its blocking count is the approval count.
    const parts = /(\d+) open items · (\d+) in Scope 1 and 2 · (\d+) in Scope 3 .* · (\d+) blocks? internal approval/.exec(summary)!
    expect(Number(parts[1])).toBe(items.length)
    expect(Number(parts[2]) + Number(parts[3])).toBe(items.length)
    expect(items.filter(key => key.startsWith("scope3:")).length).toBe(Number(parts[3]))
    expect(parts[4]).toBe(s3![2])
    // Ask lists the same items in the same order.
    await page.getByRole("button", { name: "Ask a question" }).click()
    await page.getByRole("button", { name: "What’s left for me to do?" }).click()
    const answer = await page.locator(".nv-msg--bot").last().locator("p").allInnerTexts()
    const titles = await page.locator("li[data-readiness-item] .nv-list__title").allInnerTexts()
    const numbered = answer.filter(line => /^\d+\. /.test(line))
    expect(numbered.length).toBe(titles.length)
    titles.forEach((title, index) => expect(numbered[index]!.startsWith(`${index + 1}. `) && (numbered[index]!.endsWith(` — ${title}.`) || numbered[index]!.endsWith(` — ${title} (blocks internal approval).`))).toBe(true))
    await page.keyboard.press("Escape")
    // Results: the to-do chip shows the same Scope 3 numbers, and its own request is the only one on this visit.
    await page.locator("nav.nv-sidenav").getByRole("button", { name: /Results & report/ }).click()
    await page.getByText(new RegExp(`^${parts[3]} to do · ${parts[4]} blocks? approval$`)).waitFor({ timeout: 30_000 })
    await page.waitForTimeout(1_000)
    expect(scope3Requests).toEqual(["#/overview", "#/results"])
    await page.waitForFunction(text => document.querySelectorAll("nav.nv-sidenav .nv-navitem__meta")[3]?.textContent === text, side[3]!)
    // The Menu sheet (below 1080 px) holds the same lines.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("button", { name: "Menu" }).click()
    expect((await page.locator(".nv-sheetnav .nv-navitem__meta").allInnerTexts()).slice(1, 4)).toEqual(side.slice(1, 4))
  }, 90_000)

  journey("readiness (WO-04b): each next-step action opens its route, by keyboard at 390 and 1360 px, with focus on the page heading", { signedInAs: "admin", width: 390, height: 844 }, async ({ page }) => {
    for (const [width, height] of [[390, 844], [1360, 900]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto("/#/overview")
      const { items } = await overviewChecked(page)
      // The next step's action, and the first item of each kind of target (a record, the spend import, setup, Activity and
      // Results). Each visit costs about a dozen requests, so not every item is opened (the server allows 300 a minute).
      expect(items.length).toBeGreaterThan(0)
      const targets = await page.locator("[data-readiness-target]").evaluateAll(buttons => buttons.map(button => [button.getAttribute("data-readiness-target")!, button.getAttribute("data-readiness-action")!] as const))
      const actions: string[] = ["next", ...new Map([...targets].reverse()).values()]
      // WO-04c: "Add the assessment" opens its category on Results ("assessment"), so no item opens Results at the top.
      expect(new Set(targets.map(([target]) => target))).toEqual(new Set(["record", "spend", "setup", "assessment", "collection"]))
      for (const action of actions) {
        if (action !== actions[0]) { await page.goto("/#/overview"); await overviewChecked(page) }
        const button = page.locator(`[data-readiness-action="${action}"]`)
        await button.focus()
        await page.keyboard.press("Enter")
        await page.waitForFunction(() => !/^#\/overview/.test(window.location.hash))
        const spend = action.startsWith("scope3:spend:"), assessment = action.endsWith(":assessment_missing") || action.endsWith(":assessment_excluded")
        if (spend) await page.waitForFunction(() => document.activeElement?.closest("#spend-import") !== null, undefined, { timeout: 20_000 })
        // WO-04c: the category's group in the Results to-do takes focus, with its assessment open.
        else if (assessment) await page.waitForFunction(() => /^scope3-todo-cat-\d+$/.test(document.activeElement?.id ?? "") && document.activeElement!.querySelector(".s3-todo__assessment") !== null, undefined, { timeout: 20_000 })
        else await page.waitForFunction(() => document.activeElement?.tagName === "H1" && document.activeElement.getClientRects().length > 0, undefined, { timeout: 20_000 })
        const hash = await page.evaluate(() => window.location.hash)
        expect(hash).toMatch(/^#\/(setup|activity|results)/)
        // The spend import's grouped review takes focus by design (bug hunt C-06); every other action lands on the h1.
        if (!spend && !assessment) expect(await page.evaluate(() => (document.activeElement as HTMLElement).innerText.length > 0)).toBe(true)
      }
    }
  }, 180_000)

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
    // WO-04b B1: every Scope 3 results request, with the time it was sent.
    let scope3Sent = 0, beforeSave = -1
    page.on("request", request => {
      const path = new URL(request.url()).pathname
      if (path.endsWith("/results/scope3")) scope3Sent++
      if (request.method() === "POST" && path.endsWith(`/collection/activities/${RECORDS.gasReady}`) && beforeSave < 0) beforeSave = scope3Sent
    })
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
    // WO-04b B1 (QA of PR #51): the completed save checks Scope 3 again in the same visit (one request), so the
    // navigation's Scope 3 part is never the answer from before the save; it settles on a checked state, not "Checking…".
    expect(scope3Sent - beforeSave).toBe(1)
    await page.waitForFunction(() => !(document.querySelectorAll("nav.nv-sidenav .nv-navitem__meta")[3]?.textContent ?? "Checking").includes("Checking"), undefined, { timeout: 30_000 })
    expect(await page.locator("nav.nv-sidenav .nv-navitem__meta").nth(3).innerText()).toMatch(/^Draft results available · (\d+ open|nothing open)/)
  })

  journey("a view-only member is offered no write action on Activity", { signedInAs: "member" }, async opened => {
    const { page } = opened
    await page.goto("/#/activity")
    await activityListLoaded(page)
    // WO-08: the view-access notice became the context bar's "View only"; its sentence is under Details.
    const context = page.getByRole("region", { name: "Reporting context" })
    await context.getByText("View only", { exact: true }).waitFor()
    await context.getByRole("button", { name: "Details" }).click()
    await context.getByText("View only. You have view access. An owner or admin of your company can make changes.").waitFor()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: /^Counted \(/ }).waitFor()
    expect(notAllowed(await enabledControls(page, "main"))).toEqual([])
    // The record view (WO-06) offers a member no "Correct this record".
    await page.evaluate(id => { window.location.hash = `#/activity/${id}` }, RECORDS.gasReady)
    await headingIs(page, "GAS-1", true)
    expect(await page.getByRole("button", { name: "Correct this record" }).count()).toBe(0)
    // WO-08: the shell's controls are a member's too, outside the main region. At 1360 px the top bar has Sign out and
    // the context bar Details; below 1080 px the top bar has ≡ Menu, and the sheet holds the navigation, Ask and Sign out.
    const shellWide = await enabledControls(page, "header.nv-topbar, [role=region][aria-label='Reporting context']")
    expect(shellWide).toEqual(["button Sign out", "button Details▸"])
    await page.setViewportSize({ width: 390, height: 844 })
    const shellNarrow = await enabledControls(page, "header.nv-topbar, [role=region][aria-label='Reporting context']")
    expect(shellNarrow).toEqual(["button Menu", "button Details▸"])
    await page.getByRole("button", { name: "Menu", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: "Menu" })
    await sheet.waitFor()
    const inSheet = await enabledControls(page, "[role=dialog][aria-modal=true]")
    expect(notAllowed(inSheet)).toEqual([])
    expect(inSheet.filter(control => /^button (Close menu|Overview|[123]Step [123]: |Ask Neuvetra|Sign out)/.test(control))).toHaveLength(7)
    await page.keyboard.press("Escape")
    await sheet.waitFor({ state: "detached" })
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
    // B is in the workspace as themselves: at the suite's 1360 px the WO-08 top bar shows the email.
    expect(await page.locator(".nv-topbar__user").isVisible()).toBe(true)
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

  // WO-05b (a): a correction typed before the session ends is offered back to the same person, restored, and saved once.
  journey("unsaved correction input survives a session end: the same user restores it and saves exactly one new version", { signedInAs: "owner" }, async opened => {
    const { page } = opened
    const before = await savedRecord(RECORDS.gasReady)
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await openRecordByAddress(page, RECORDS.gasReady)
    await quantityInput(page).fill("12750")
    await reasonInput(page).fill("E2E: kept through a session end")
    // Kept a second after typing stops (owner, this tab only).
    await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith("nv:draft:v1:")))
    stack.tokens.revokeUser("owner")
    await focusUntil(page, page.getByRole("heading", { name: "Your session ended" }).waitFor({ timeout: 25_000 }))
    await page.getByText("Unsaved changes are kept on this browser tab until you sign out.").waitFor()
    const form = page.locator("form", { has: page.locator("input[type=email]") }).first()
    await form.locator("input[type=email]").fill("owner@example.test")
    await form.locator("input[type=password]").fill("synthetic-password")
    await form.getByRole("button", { name: "Sign in", exact: true }).click()
    // The same view opens, and nothing is restored until the person chooses to.
    await page.waitForFunction(id => window.location.hash === `#/activity/${id}`, RECORDS.gasReady)
    const offer = page.getByRole("group", { name: /^Restore unsaved changes from \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC\?$/ })
    await offer.waitFor()
    expect(await page.locator("#collection-record-editor").count()).toBe(0)
    // Keyboard, once the screen has settled (focus on its h1): Tab reaches Restore, and focus goes to the form's heading.
    await page.waitForFunction(() => document.activeElement?.tagName === "H1")
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Restore")
    await page.keyboard.press("Enter")
    await page.waitForFunction(() => document.activeElement?.id === "collection-editor-heading")
    expect(await quantityInput(page).inputValue()).toBe("12750")
    expect(await reasonInput(page).inputValue()).toBe("E2E: kept through a session end")
    const saved = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/collection/activities/${RECORDS.gasReady}`))
    await page.getByRole("button", { name: "Save correction" }).click()
    expect((await saved).status()).toBe(201)
    await page.getByRole("button", { name: new RegExp(`^Version ${before.currentVersion.revision + 1} ·`) }).waitFor()
    const after = await savedRecord(RECORDS.gasReady)
    expect(after.currentVersion.revision).toBe(before.currentVersion.revision + 1)
    const versions = await stack.operator.query<{ count: string }>("select count(*)::text as count from neuvetra.collection_activity_versions where record_id = $1", [RECORDS.gasReady])
    expect(Number(versions.rows[0]?.count)).toBe(before.history.length + 1)
    expect(opened.writes.filter(write => write.endsWith(`/collection/activities/${RECORDS.gasReady}`))).toHaveLength(1)
    // A saved draft is gone from the tab.
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("nv:draft:v1:")))).toEqual([])
  })

  // WO-05b (b): after A's session ends with a draft, the company-1 admin signs in on the same page: offered nothing, and A's
  // draft keys are gone before the workspace first renders.
  journey("after user A's session ends with unsaved input, user B signing in on the same page is offered nothing and A's draft keys are gone first", { signedInAs: "owner" }, async ({ page }) => {
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await openRecordByAddress(page, RECORDS.gasHeld)
    await reasonInput(page).fill("E2E: A's unsaved reason")
    await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith("nv:draft:v1:")))
    stack.tokens.revokeUser("owner")
    await focusUntil(page, page.getByRole("heading", { name: "Your session ended" }).waitFor({ timeout: 25_000 }))
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("nv:draft:v1:")).length)).toBeGreaterThan(0)
    // Record the draft keys present at the moment the workspace's markup first appears.
    await page.evaluate(() => {
      const report = (window as unknown as { __draftKeysAtFirstRender?: string[] })
      const observer = new MutationObserver(() => {
        if (report.__draftKeysAtFirstRender || !document.querySelector(".nv-app")) return
        report.__draftKeysAtFirstRender = Object.keys(sessionStorage).filter(key => key.startsWith("nv:draft:v1:"))
        observer.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    const form = page.locator("form", { has: page.locator("input[type=email]") }).first()
    await form.locator("input[type=email]").fill("admin@example.test")
    await form.locator("input[type=password]").fill("synthetic-password")
    await form.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.locator("nav").first().waitFor()
    expect(await page.evaluate(() => (window as unknown as { __draftKeysAtFirstRender?: string[] }).__draftKeysAtFirstRender)).toEqual([])
    // B opens A's record: no offer, A's reason nowhere.
    await page.evaluate(id => { window.location.hash = `#/activity/${id}` }, RECORDS.gasHeld)
    await headingIs(page, "GAS-DEC", true)
    await page.getByRole("button", { name: "Correct this record" }).waitFor()
    expect(await page.getByText(/Restore unsaved changes/).count()).toBe(0)
    expect(await page.locator("body").innerText()).not.toContain("E2E: A's unsaved reason")
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("nv:draft:v1:")))).toEqual([])
    expect(await page.locator(".nv-topbar__user").textContent()).toBe("admin@example.test")
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

  journey("readiness follow-ups (WO-04c): Scope 3 possible duplicates read the same on the Overview and Results, Ask's Try again retries once, and a spend import rechecks once", { signedInAs: "admin" }, async ({ page }) => {
    // Runs last: it adds a business-travel record that repeats T-1 for overlapping dates (counted, so listed to confirm)
    // and a two-line spend import to company 1.
    const { records } = await stack.api<{ records: Array<{ id: string; currentVersion: { activity: Record<string, unknown> } }> }>("admin", `/workspace/${COMPANIES.first}/collection/activities`)
    const travel = records.find(record => record.id === RECORDS.travel)!
    await stack.api("admin", `/workspace/${COMPANIES.first}/collection/activities/e2e00000-0000-4000-8000-00000000a0d1`, { body: { idempotencyKey: "e2e00000-0000-4000-8000-0000000004c1", expectedRevision: 0, expectedVersionId: null, correctionReason: null,
      activity: { ...travel.currentVersion.activity, period: { start: "2025-03-01", endExclusive: "2025-07-01" } } } })
    const scope3Requests: number[] = []
    let failNext = false
    await page.route("**/results/scope3", async route => {
      if (failNext) { failNext = false; await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Scope 3 results are unavailable right now." }) }) }
      else await route.continue()
    })
    page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/results/scope3")) scope3Requests.push(Date.now()) })

    // 1. With a Scope 3 possible duplicate, the Overview's count names Results' "to do" and "to confirm (counted)" numbers.
    await page.goto("/#/overview")
    const { summary } = await overviewChecked(page)
    const note = /(\d+) in Scope 3 \(Results’ Scope 3 to-do shows the same (\d+) to do and 1 to confirm \(counted\): the possible duplicate listed below\)/.exec(summary)
    expect(note).not.toBeNull()
    expect(note![1]).toBe(note![2])
    const pair = await page.locator("li[data-readiness-duplicate^='scope3:'] .nv-list__title").innerText()
    const [left, right] = pair.replace(/^Category \d+[^:]*: /, "").split(" and ")
    expect(left).not.toBe(right)
    await page.locator("nav.nv-sidenav").getByRole("button", { name: /Results & report/ }).click()
    await page.locator("#scope3-todo .nv-chip").getByText(new RegExp(`^${note![1]} to do · 1 to confirm \\(counted\\)( · \\d+ blocks? approval)?$`)).waitFor({ timeout: 30_000 })
    // The to-do shows its first 8 items until "Show all" is pressed.
    const showAll = page.locator("#scope3-todo").getByRole("button", { name: /^Show all/ })
    if (await showAll.count()) await showAll.click()
    expect(await page.locator("#scope3-todo .s3-todo__item .nv-chip", { hasText: "To confirm (counted)" }).count()).toBe(1)

    // 4. Scope 3 fails on the Overview; Ask's Try again checks it again with exactly one request.
    failNext = true
    await page.goto("/#/overview")
    await page.locator("li[role=alert]", { hasText: "Couldn’t check Scope 3" }).waitFor({ timeout: 30_000 })
    await page.waitForTimeout(500)
    const beforeRetry = scope3Requests.length
    await page.getByRole("button", { name: "Ask a question" }).click()
    await page.getByRole("button", { name: "What’s left for me to do?" }).click()
    await page.locator(".nv-msg--bot").last().getByText("Use Try again below", { exact: false }).waitFor()
    await page.locator(".nv-msg--bot").last().getByRole("button", { name: "Try again →" }).click()
    await page.locator("li[data-readiness-item^='scope3:']").first().waitFor({ timeout: 60_000 })
    await page.waitForTimeout(1_000)
    expect(scope3Requests.length - beforeRetry).toBe(1)
    expect(await page.locator("li[role=alert]", { hasText: "Couldn’t check Scope 3" }).count()).toBe(0)

    // 5. A spend import is two writes (the file, then the import): "Checking…" at the first, one recheck after the last.
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await page.getByLabel("Spend file").waitFor({ timeout: 30_000 })
    await page.waitForTimeout(1_500)
    await page.evaluate(() => {
      const w = window as unknown as { checkingAt?: number }
      const look = () => { if (w.checkingAt === undefined && [...document.querySelectorAll("nav.nv-sidenav .nv-navitem__meta")].some(item => item.textContent?.includes("Checking…"))) w.checkingAt = Date.now() }
      new MutationObserver(look).observe(document.body, { subtree: true, childList: true, characterData: true })
    })
    const writes: Array<{ path: string; answeredAt: number }> = []
    page.on("response", response => { const request = response.request(); if (request.method() !== "GET" && /\/workspace-api\/workspace\//.test(request.url())) writes.push({ path: new URL(request.url()).pathname, answeredAt: Date.now() }) })
    const beforeImport = scope3Requests.length
    await page.getByLabel("Spend file").setInputFiles({ name: "wo-04c.csv", mimeType: "text/csv", buffer: Buffer.from("line_id,date,vendor,gl_account,gl_description,description,amount,currency,dollar_year,category,naics_code,margin_choice,capital_full_cost\nW4C-1,2025-03-14,Acme Consulting LLC,6110,Professional services,Workshop,1200.00,USD,2025,1,541611,with_margins,\nW4C-2,2025-04-02,Byte Systems Inc,6120,IT services,Support,800.00,USD,2025,1,541512,with_margins,\n") })
    await page.getByRole("button", { name: "Import spend lines" }).click()
    await page.locator("#spend-import-result").waitFor({ timeout: 30_000 })
    await page.waitForFunction(() => ![...document.querySelectorAll("nav.nv-sidenav .nv-navitem__meta")].some(item => item.textContent?.includes("Checking…")), undefined, { timeout: 60_000 })
    await page.waitForTimeout(1_000)
    expect(writes.map(write => write.path.replace(/^.*\/workspace\/[^/]+/, ""))).toEqual(["/collection/evidence", "/scope3/spend-imports"])
    const after = scope3Requests.slice(beforeImport)
    expect(after.length).toBe(1)
    const checkingAt = await page.evaluate(() => (window as unknown as { checkingAt?: number }).checkingAt)
    expect(checkingAt).toBeDefined()
    // "Checking…" came with the first write, well before the debounced request; the request waited for the last write.
    expect(checkingAt! - writes[0]!.answeredAt).toBeLessThan(300)
    expect(after[0]!).toBeGreaterThan(checkingAt!)
    expect(after[0]! - writes[1]!.answeredAt).toBeGreaterThanOrEqual(300)

    // 6. At 390 px, no action button in "What needs attention" wraps to more than two lines.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/#/overview")
    await overviewChecked(page)
    const lines = await page.locator("#overview-open-items .nv-btn").evaluateAll(buttons => buttons.map(button => {
      const range = document.createRange(); range.selectNodeContents(button)
      return [button.textContent, new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size] as const
    }))
    expect(lines.filter(([, count]) => count > 2)).toEqual([])
  }, 150_000)
})
