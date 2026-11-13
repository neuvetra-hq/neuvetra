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
import { addressesSeen, AUTH_STORAGE_KEY, closeJourney, focusReport, horizontalOverflow, launchBrowser, openJourney, pageHeading, unhandledRejections, type Journey, type JourneyOptions } from "./harness/browser"
import { COMPANIES, RECORDS } from "./harness/seed"
import { fixtureAssessment } from "../../../packages/neuvetra-database/src/scope3-payload-fixtures"
import { startStack, type Stack } from "./harness/stack"

const DATABASE_URL = process.env.E2E_DATABASE_URL
// E2E-02 (QA F2): outside CI the suite is skipped without a database; in CI a missing database is an error, never a
// silently green run with every test skipped. The CI job also checks the pass count (E2E_EXPECTED_PASS).
if (!DATABASE_URL && process.env.CI) throw new Error("E2E_DATABASE_URL is not set: in CI the browser smoke suite must run, not skip.")
const suite = DATABASE_URL ? describe : describe.skip

const ACTIVITY_LIST_HEADING = "Collect Scope 1, 2 and 3 activity"
const DISCARD_ACTIVITY = "confirm: Discard unsaved activity changes?"

/**
 * WO-12 (QA-220): the only controls a view-only member may use, on every route: navigation, filters and search,
 * disclosures, downloads, reloading, Ask and Sign out. Nothing else is shown to a member, enabled or disabled: no form
 * field, no write button (the WO-12 tolerance list is gone; the check is by real state).
 * - Activity: the list's filters, search and reload; a record's earlier versions; downloading a cleared original;
 *   "Ask about a field". The spend import's tabs, its "Find lines" search, "Show lines"/"Hide lines" and "Open" a line.
 * - Results: the record filters, downloads (CSV, ZIP, print), "Show all", disclosures (a record's details, "View the
 *   assessment"), "View" (opens a record read-only) and the report versions' "Open".
 * - The WO-08 shell: ≡ Menu, the sheet's Close menu, the context bar's Details toggle (its name ends in the ▸/▾ chevron), the
 *   sheet's navigation items and Ask (a step's text starts with its aria-hidden number, and each item's title is followed
 *   by its status line), and Sign out.
 */
const MEMBER_READING_CONTROLS = [
  /^button Results & report$/, /^button Reload saved records$/, /^button Ask about a field$/,
  /^select (Status|Activity type)$/, /^input Find a source, vendor or description$/, /^input Find lines$/,
  /^button (Needs a code|Other holds|Possible duplicates|Counted) \(\d+\)$/, /^button (Show lines|Hide lines|Open|Open the line)$/,
  /^button Version \d+ · /, /^button Download original$/,
  // Links and disclosures (WO-12 QA): a record's row (its address), the jump to the spend import, "← All activity", the
  // spend template download, and any <summary> (it only opens details).
  /^a [^·]+ · .+, (Needs input|No input needed|Withdrawn)$/, /^a (Spend import and mapping|New record|Download the template|(← )?All activity|Neuvetra workspace home)$/, /^summary /,
  /^button Menu$/, /^button Close menu$/, /^button Details[▸▾]$/,
  /^button (Overview|1Step 1: Company setup|2Step 2: Activity & evidence|3Step 3: Results & report|Ask Neuvetra)/,
  /^button Sign out$/,
]

let stack: Stack
let browser: Browser

/**
 * One journey: its own browser context, artifacts kept on failure, and no uncaught page error and no unhandled promise
 * rejection allowed in any of its pages (WO-14c, invariant I11).
 */
function journey(name: string, options: JourneyOptions, body: (journey: Journey) => Promise<void>, timeout = 45_000) {
  test(name, async () => {
    const opened = await openJourney(browser, stack, options)
    let failed = true
    try {
      await body(opened)
      expect(opened.errors).toEqual([])
      expect(await unhandledRejections(opened)).toEqual([])
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
 * Every enabled control under `roots`, by accessible name: aria-label, else the label's field name (`.setup-field__name`,
 * without the "Required" / "Needed for results" / "Optional" label and hints after it; else its first span), else text.
 * `withDisabled` also lists disabled controls (a member must not be shown those either).
 */
async function enabledControls(page: Page, roots: string, withDisabled = false) {
  return page.evaluate(([selector, all]) => [...document.querySelectorAll<HTMLElement>(selector)]
    .flatMap(root => [...root.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], summary")])
    .filter(element => element.getClientRects().length > 0 && (all || !(element as HTMLButtonElement).disabled && element.getAttribute("aria-disabled") !== "true"))
    .map(element => {
      const label = (element as HTMLInputElement).labels?.[0] ?? null
      const name = element.getAttribute("aria-label") ?? label?.querySelector(".setup-field__name")?.textContent ?? label?.querySelector("span")?.textContent ?? label?.textContent ?? element.textContent ?? ""
      const type = element.tagName === "INPUT" && element.getAttribute("type") ? `[${element.getAttribute("type")}]` : ""
      return `${element.tagName.toLowerCase()}${type} ${name.replace(/\s+/g, " ").trim()}`
    }), [roots, withDisabled] as const)
}

/** The controls a view-only member may not be offered (WO-12): anything not on the reading list. */
function notAllowed(controls: string[]) {
  return controls.filter(control => !MEMBER_READING_CONTROLS.some(rule => rule.test(control)))
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
    // WO-12: no new-record form, and no write control at all, enabled or disabled (by real state, no tolerance list).
    expect(await page.locator("#collection-record-editor").count()).toBe(0)
    await page.locator("#spend-import").getByText("View only: an owner or admin of your company imports spend files").waitFor({ timeout: 30_000 })
    // WO-08: the view-access notice became the context bar's "View only"; its sentence is under Details.
    const context = page.getByRole("region", { name: "Reporting context" })
    await context.getByText("View only", { exact: true }).waitFor()
    await context.getByRole("button", { name: "Details" }).click()
    await context.getByText("View only. You have view access. An owner or admin of your company can make changes.").waitFor()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: /^Counted \(/ }).waitFor()
    expect(notAllowed(await enabledControls(page, "main", true))).toEqual([])
    // Each spend review tab, with a group's lines shown: still nothing but reading controls.
    for (const tab of ["Needs a code", "Other holds", "Possible duplicates", "Counted"]) {
      await page.locator("#spend-import").getByRole("button", { name: new RegExp(`^${tab} \\(`) }).click()
      const show = page.locator("#spend-import").getByRole("button", { name: "Show lines" }).first()
      if (await show.count()) await show.click()
      expect(notAllowed(await enabledControls(page, "main", true))).toEqual([])
    }
    // The record view (WO-06) offers a member no "Correct this record".
    await page.evaluate(id => { window.location.hash = `#/activity/${id}` }, RECORDS.gasReady)
    await headingIs(page, "GAS-1", true)
    expect(await page.getByRole("button", { name: "Correct this record" }).count()).toBe(0)
    expect(notAllowed(await enabledControls(page, "main", true))).toEqual([])
    // WO-08: the shell's controls are a member's too, outside the main region. At 1360 px the top bar has Sign out and
    // the context bar Details; below 1080 px the top bar has ≡ Menu, and the sheet holds the navigation, Ask and Sign out.
    const shellWide = await enabledControls(page, "header.nv-topbar, [role=region][aria-label='Reporting context']")
    expect(shellWide.filter(control => control !== "a Neuvetra workspace home")).toEqual(["button Sign out", "button Details▸"])
    await page.setViewportSize({ width: 390, height: 844 })
    const shellNarrow = await enabledControls(page, "header.nv-topbar, [role=region][aria-label='Reporting context']")
    expect(shellNarrow.filter(control => control !== "a Neuvetra workspace home")).toEqual(["button Menu", "button Details▸"])
    expect(notAllowed([...shellWide, ...shellNarrow])).toEqual([])
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

  // WO-12 (QA-220): the member on Results and company setup. Results' controls are reading ones; a Scope 3 assessment
  // opens as text ("View the assessment"), never a form; nothing a member is shown there is a field or a write button.
  journey("a view-only member sees Results and Scope 3 assessments read-only, at 1360 and 390 px", { signedInAs: "member" }, async opened => {
    const { page } = opened
    // Results' reading controls: its filters and search, downloads and print, "Show all"/"Show fewer", "Go to the Scope 3
    // to-do list", "View …" (a record, the draft report, an assessment, company setup or the spend import: navigation or a
    // disclosure) and "Close the assessment". WO-12b: a member is not offered "Recalculate" (checked below).
    const RESULTS_READING = [/^button (Download|Print)/, /^button (Show all|Show fewer)/, /^button Go to the Scope 3 to-do list$/, /^button View /, /^button Close the assessment: /,
      /^select (Status|Category|Activity)$/, /^input\[search\] Search source ID or reference$/, /^button (All|Needs attention) \(\d+\)$/]
    const results = (controls: string[]) => notAllowed(controls).filter(control => !RESULTS_READING.some(rule => rule.test(control)))
    for (const [width, height] of [[1360, 900], [390, 844]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto("/#/results")
      await page.getByRole("heading", { name: "Scope 3 · value chain" }).waitFor({ timeout: 30_000 })
      await page.getByText("Scope 3 to-do").first().waitFor()
      await page.waitForLoadState("networkidle")
      const showAll = page.locator("#scope3-todo").getByRole("button", { name: /^Show all/ })
      if (await showAll.count()) await showAll.click()
      // The to-do never says "Add" or "Edit" the assessment to a member.
      expect(await page.locator("#scope3-results").getByRole("button", { name: /^(Add|Edit) the assessment/ }).count()).toBe(0)
      const view = page.locator("#scope3-results").getByRole("button", { name: /^View the assessment: / }).first()
      await view.waitFor({ timeout: 30_000 })
      await view.click()
      const assessment = page.locator("#scope3-results .scope3-assessment").first()
      await assessment.waitFor({ timeout: 30_000 })
      expect(await assessment.locator("input, select, textarea, button").count()).toBe(0)
      await assessment.getByText("View only: an owner or admin of your company can change it.").waitFor()
      expect(results(await enabledControls(page, "main", true))).toEqual([])
      expect(await page.locator("main").getByRole("button", { name: /^Recalculat/ }).count()).toBe(0)
    }
    // Company setup's category screening: a member is offered no "Add an assessment" or "Review or correct the assessment";
    // a saved assessment (saved here by the owner, category 6) is shown open, as text.
    const assessments = await stack.api<{ setupVersionId: string; reportingYear: number }>("owner", `/workspace/${COMPANIES.first}/scope3/assessments`)
    await stack.api("owner", `/workspace/${COMPANIES.first}/scope3/assessments/6`, { method: "PUT", body: { idempotencyKey: "e2e00000-0000-4000-8000-000000000a12", expectedRevision: 0, correctionReason: null,
      assessment: fixtureAssessment(assessments.setupVersionId, { category: 6, reportingYear: assessments.reportingYear, reasonCode: null, activitiesIncluded: "E2E: flights and hotel stays booked through the agency.",
        justification: "E2E: travel is a visible share of value chain emissions.", plannedMethodTypes: ["activity_average_data"] }) } })
    await page.setViewportSize({ width: 1360, height: 900 })
    await page.goto("/#/setup")
    await page.locator("main h1").first().waitFor()
    await page.getByRole("button", { name: /06 Source activities/ }).click()
    await page.getByText("Scope 3 · 1.", { exact: false }).first().waitFor({ timeout: 30_000 })
    await page.waitForLoadState("networkidle")
    expect(await page.locator("main").getByRole("button", { name: /assessment/i }).count()).toBe(0)
    const saved = page.locator('[aria-label="Assessment for category 6"]')
    await saved.getByText("E2E: travel is a visible share of value chain emissions.").waitFor({ timeout: 30_000 })
    expect(await saved.locator("input, select, textarea, button, summary").count()).toBe(0)
    expect(await page.locator(".scope3-assessment").count()).toBe(1)
    expect(opened.writes).toEqual([])
  }, 120_000)

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
    // WO-12b: an owner keeps "Recalculate" (a member is checked for its absence).
    expect(await page.locator("main").getByRole("button", { name: /^Recalculat/ }).count()).toBe(1)
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
    // WO-12b: an admin keeps "Recalculate" (a member is checked for its absence).
    expect(await page.locator("main").getByRole("button", { name: /^Recalculat/ }).count()).toBe(1)
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
  // WO-12b (CEO ruling after QA round 3 of PR #57): one answer that holds the record whatever else is filled in (here a
  // category 9 spend line the company paid for) is named at the top of the form, in a live region, with "Go to" its answer;
  // the other result fields read Optional meanwhile, and the held record still saves.
  journey("record holds (WO-12b): the notice comes and goes with the answer, labels follow, and a held record still saves, at 1360 and 390 px", { signedInAs: "owner" }, async opened => {
    const { page } = opened
    const editor = page.locator("#collection-record-editor")
    const notice = editor.locator(".wo12b-hold [role=status]")
    const needOf = (name: string) => editor.locator(".setup-field").filter({ has: page.locator(".setup-field__name", { hasText: new RegExp(`^${name.replace(/[()?]/g, "\\$&")}$`) }) }).locator(".setup-field__need").first()
    const paid = () => editor.getByLabel(/^Did the company pay for this transport\?/)
    for (const [width, height] of [[390, 844], [1360, 900]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto("/#/activity")
      await activityListLoaded(page)
      await editor.getByRole("button", { name: "Purchases by spend (Scope 3)" }).click()
      await editor.getByLabel(/^Category/).first().selectOption("9")
      // The live region is in the page before anything is held (so its first words are announced).
      expect(await notice.count()).toBe(1)
      expect((await notice.innerText()).trim()).toBe("")
      expect(await needOf("NAICS code (2017)").innerText()).toBe("Needed for results")
      await paid().selectOption("yes")
      await notice.getByText("This record won’t be counted as entered").waitFor()
      await notice.getByText("Your answer to “Did the company pay for this transport?” (Yes) holds this record, whatever else is filled in.").waitFor()
      await notice.getByText("Transport the company pays for is category 4, not category 9.", { exact: false }).waitFor()
      expect(await needOf("NAICS code (2017)").innerText()).toBe("Optional")
      expect(await needOf("Did the company pay for this transport?").innerText()).toBe("Required (this answer holds the record: see the notice at the top of the form)")
      expect(await horizontalOverflow(page)).toBe(0)
      // The notice is above the form's first field, and its button moves focus to the answer.
      const [noticeTop, firstFieldTop] = await Promise.all([notice.evaluate(node => node.getBoundingClientRect().top), editor.locator(".setup-field").first().evaluate(node => node.getBoundingClientRect().top)])
      expect(noticeTop).toBeLessThan(firstFieldTop)
      await editor.getByRole("button", { name: "Go to “Did the company pay for this transport?”" }).click()
      expect(await page.evaluate(() => document.activeElement?.closest(".setup-field")?.querySelector(".setup-field__name")?.textContent)).toBe("Did the company pay for this transport?")
      await paid().selectOption("no")
      await page.waitForFunction(() => (document.querySelector("#collection-record-editor .wo12b-hold [role=status]")?.textContent ?? "x").trim() === "")
      expect(await needOf("NAICS code (2017)").innerText()).toBe("Needed for results")
      if (width === 390) continue
      // A held record saves: the owner fills what the save needs, with the answer that holds it.
      await paid().selectOption("yes")
      await editor.getByLabel(/^Company-setup location/).selectOption({ index: 1 })
      await editor.getByLabel(/^Ledger line or invoice ID/).fill("E2E-HOLD-9")
      await editor.getByLabel(/^Description/).fill("E2E: customers’ freight we paid for")
      await editor.getByLabel(/^How the amount was estimated/).fill("Carrier invoices.")
      await editor.getByLabel(/^Amount spent|^Amount/).first().fill("1200")
      await editor.getByRole("button", { name: /^Save/ }).click()
      const deadline = Date.now() + 20_000
      let saved: Array<{ currentVersion: { activity: { sourceId: string; payload: { paidByReportingCompany: boolean | null } } } }> = []
      while (Date.now() < deadline) {
        saved = (await stack.api<{ records: typeof saved }>("owner", `/workspace/${COMPANIES.first}/collection/activities`)).records.filter(record => record.currentVersion.activity.sourceId === "E2E-HOLD-9")
        if (saved.length) break
        await page.waitForTimeout(200)
      }
      expect(saved.map(record => record.currentVersion.activity.payload.paidByReportingCompany)).toEqual([true])
    }
  }, 90_000)

  // WO-12b: a member reads company setup steps 01-07 as text: no field, no disabled form, no add, remove or save button.
  journey("a view-only member reads company setup steps 01-07 as text, at 1360 and 390 px (WO-12b)", { signedInAs: "member" }, async opened => {
    const { page } = opened
    const SETUP_READING = [/^button 0[1-7] /, /^button ← Back$/, /^button Continue →$/, /^button Reload saved setup$/, /^button Version \d+ · /]
    const setupControls = (controls: string[]) => notAllowed(controls).filter(control => !SETUP_READING.some(rule => rule.test(control)))
    for (const [width, height] of [[1360, 900], [390, 844]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto("/#/setup")
      await page.getByRole("button", { name: /^01 Company/ }).waitFor({ timeout: 30_000 })
      await page.locator(".setup-readonly").first().waitFor({ timeout: 30_000 })
      for (const step of ["01 Company", "02 Reporting period", "03 Entities & boundary", "04 Locations", "05 Changes & shared operations", "06 Source activities", "07 Review"]) {
        await page.getByRole("button", { name: new RegExp(`^${step}`) }).click()
        await page.locator("#setup-form-heading").filter({ hasText: step.replace(" ", " / ") }).waitFor()
        await page.waitForLoadState("networkidle")
        const main = page.locator("main")
        expect([step, await main.locator("input, select, textarea, fieldset").count()]).toEqual([step, 0])
        expect([step, setupControls(await enabledControls(page, "main", true))]).toEqual([step, []])
        expect([step, await main.locator(".setup-readonly").count() > 0]).toEqual([step, true])
        expect([step, await horizontalOverflow(page)]).toEqual([step, 0])
      }
    }
    expect(opened.writes).toEqual([])
  }, 120_000)
  // WO-12b QA round 2: a notice's "Open company setup (<section>)" opens setup at that section, after the unsaved-activity
  // prompt, with focus on the section's heading. Company 2 only (its setup is changed here; no later journey reads it).
  journey("record holds (WO-12b): a setup notice's link opens the section it names, at 1360 and 390 px", { signedInAs: "otherOwner" }, async opened => {
    const { page } = opened
    opened.answerDialogs = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a setup edited by path in this journey only.
    type AnySetup = Record<string, any>
    type Setup = { currentVersion: { id: string; revision: number; setup: AnySetup } }
    const correct = async (why: string, change: (setup: AnySetup) => void) => {
      const view = await stack.api<Setup>("otherOwner", `/workspace/${COMPANIES.second}/setup`)
      const setup = structuredClone(view.currentVersion.setup); change(setup)
      await stack.api("otherOwner", `/workspace/${COMPANIES.second}/setup`, { body: { idempotencyKey: crypto.randomUUID(), expectedRevision: view.currentVersion.revision, expectedVersionId: view.currentVersion.id, correctionReason: why, setup } })
    }
    const ENTITY = "e2e00000-0000-4000-8000-00000000e1b2", CLOSED = "e2e00000-0000-4000-8000-00000000a1b2", JV = "e2e00000-0000-4000-8000-00000000a1b3"
    await correct("E2E: equity share, a closed site and an excluded joint venture", setup => {
      const site = setup.locations[0]
      setup.boundary.approach = "equity_share"
      setup.entities.push({ id: ENTITY, name: "E2E excluded JV", ownershipPercent: "20", control: "operational_control", inclusion: "excluded", reason: "E2E: outside the boundary" })
      setup.locations.push({ ...site, id: CLOSED, name: "E2E closed site", inclusion: "excluded", reason: "E2E: closed" }, { ...site, id: JV, name: "E2E JV yard", entityId: ENTITY, control: "related_entity", inclusion: "included" })
    })
    const editor = page.locator("#collection-record-editor")
    /** A natural-gas draft at a site (so leaving asks to discard it), then the notice's setup link; returns the section shown. */
    const HQ = (await stack.api<Setup>("otherOwner", `/workspace/${COMPANIES.second}/setup`)).currentVersion.setup.locations[0].id as string
    async function follow(site: string, link: string) {
      await page.goto("/#/activity"); await page.reload()
      await editor.getByRole("button", { name: "Natural gas" }).click({ timeout: 30_000 })
      await editor.getByLabel(/^Company-setup location/).selectOption(site)
      await editor.locator(".wo12b-hold [role=status]").getByText("This record won’t be counted as entered").waitFor()
      expect(await horizontalOverflow(page)).toBe(0)
      const prompts = opened.dialogs.length
      await editor.getByRole("link", { name: link }).click()
      await page.locator("#setup-form-heading").waitFor()
      await page.waitForFunction(() => document.activeElement?.id === "setup-form-heading")
      expect(opened.dialogs.slice(prompts)).toEqual(["confirm: Discard unsaved activity changes?"])
      return { hash: await page.evaluate(() => location.hash), heading: (await page.locator("#setup-form-heading").innerText()).replace(/\s+/g, " ") }
    }
    await page.setViewportSize({ width: 1360, height: 900 })
    expect(await follow(HQ, "Open company setup (03 Entities & boundary)")).toEqual({ hash: "#/setup/03", heading: "03 / Entities & boundary" })
    // Reload keeps the section; Back leaves setup for Activity.
    await page.reload(); await page.locator("#setup-form-heading").filter({ hasText: "03 / Entities & boundary" }).waitFor()
    await page.goBack(); await editor.getByRole("button", { name: "Natural gas" }).waitFor()
    expect(await follow(CLOSED, "Open company setup (04 Locations)")).toEqual({ hash: "#/setup/04", heading: "04 / Locations" })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await follow(JV, "Open company setup (03 Entities & boundary)")).toEqual({ hash: "#/setup/03", heading: "03 / Entities & boundary" })
    await correct("E2E: operational control, no reporting period yet", setup => { setup.boundary.approach = "operational_control"; setup.reportingPeriod.start = null; setup.reportingPeriod.endExclusive = null })
    expect(await follow(HQ, "Open company setup (02 Reporting period)")).toEqual({ hash: "#/setup/02", heading: "02 / Reporting period" })
  }, 120_000)
  // ---------------------------------------------------------------------------------------------------------------------
  // WO-14c (design step 4): boot and sign-in through auth generations. Sign-out is unchanged (client.auth.signOut).

  /** The stored Supabase session as this page sees it: its user's email, its access token and its lineage (nv_lineage). */
  function storedSession(page: Page) {
    return page.evaluate(key => {
      const value = JSON.parse(localStorage.getItem(key) ?? "null") as { access_token?: string; user?: { email?: string }; nv_lineage?: string } | null
      return value ? { email: value.user?.email ?? null, token: value.access_token ?? null, lineage: value.nv_lineage ?? null } : null
    }, AUTH_STORAGE_KEY)
  }
  async function signInOn(page: Page, email: string) {
    const form = page.locator("form", { has: page.locator("input[type=email]") }).first()
    await form.locator("input[type=email]").fill(email)
    await form.locator("input[type=password]").fill("synthetic-password")
    await form.getByRole("button", { name: "Sign in", exact: true }).click()
  }
  async function signOutFromTopBar(page: Page) {
    await page.getByRole("button", { name: "Sign out", exact: true }).first().click()
    await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll("[role=status]")].some(item => item.textContent === "Signed out on this browser."))
  }

  // J7 (I8): user B after user A on the same page: no draft, email or record address of A, also after a reload.
  journey("J7: after user A signs out, user B signing in on the same page sees no draft, email or record address of A, also after a reload", { signedInAs: "owner" }, async opened => {
    const { page } = opened
    const leaked = RECORDS.gasHeld
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await openRecordByAddress(page, leaked)
    await reasonInput(page).fill("E2E J7: A's unsaved reason")
    await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith("nv:draft:v1:")))
    const before = (await addressesSeen(page)).length
    await signOutFromTopBar(page)
    // Sign-out as on main: the stored session and every draft are gone; one logout was sent.
    expect(await storedSession(page)).toBeNull()
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("nv:draft:v1:")))).toEqual([])
    expect(opened.auth.log.filter(entry => entry.path === "/auth/v1/logout").map(entry => entry.status)).toEqual([204])
    await signInOn(page, "admin@example.test")
    await page.locator(".nv-topbar__user").waitFor()
    await pageHeading(page).waitFor()
    await page.waitForLoadState("networkidle")
    const check = async () => {
      expect(await page.locator(".nv-topbar__user").textContent()).toBe("admin@example.test")
      const shown = await page.locator("body").innerText()
      expect(shown).not.toContain("owner@example.test")
      expect(shown).not.toContain("E2E J7: A's unsaved reason")
      expect(page.url()).not.toContain(leaked)
      expect(await page.evaluate(() => JSON.stringify(window.history.state) ?? "")).not.toContain(leaked)
      expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith("nv:draft:v1:")))).toEqual([])
      expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("owner@example.test")
      expect((await storedSession(page))?.email).toBe("admin@example.test")
    }
    await check()
    expect((await addressesSeen(page)).slice(before).filter(address => address.includes(leaked))).toEqual([])
    await page.reload()
    await page.locator(".nv-topbar__user").waitFor()
    await pageHeading(page).waitFor()
    await page.waitForLoadState("networkidle")
    await check()
  })

  // J8: a session stored before WO-14 (no nv_lineage, as every staging user has on deploy day), near expiry.
  journey("J8: a session stored before WO-14 opens the workspace, a refresh stores it with a lineage, and sign-out works as before", { signedInAs: "owner", sessionLifeSeconds: 60 }, async opened => {
    const { page } = opened
    await page.goto("/#/overview")
    await headingIs(page, "Synthetic Bayline")
    // The boot generation refreshed the near-expiry session (auth-js's 90 s margin) and stored it with its lineage.
    await page.waitForFunction(key => Boolean((JSON.parse(localStorage.getItem(key) ?? "null") as { nv_lineage?: string } | null)?.nv_lineage), AUTH_STORAGE_KEY)
    const stored = (await storedSession(page))!
    expect(stored.lineage).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const refreshes = opened.auth.log.filter(entry => entry.grant === "refresh_token")
    expect(refreshes.map(entry => entry.status)).toEqual([200])
    expect(stored.token).toBe([...opened.auth.sessions.values()][0]!.accessTokens.at(-1)!)
    // The workspace uses the refreshed token.
    const used = page.waitForRequest(request => request.url().includes("/workspace-api/") && request.headers().authorization === `Bearer ${stored.token}`)
    await page.goto("/#/activity")
    await activityListLoaded(page)
    await used
    await signOutFromTopBar(page)
    expect(await storedSession(page)).toBeNull()
    expect(opened.auth.log.filter(entry => entry.path === "/auth/v1/logout").map(entry => [entry.status, entry.bearer])).toEqual([[204, stored.token]])
    expect([...opened.auth.sessions.values()][0]!.revoked).toBe(true)
  })

  // Another tab's sign-in is adopted (standard multi-tab behaviour, now by reading the stored session).
  journey("two tabs: a sign-in in one tab opens the workspace in the other, which adopts the stored session", {}, async opened => {
    const one = opened.page
    await one.goto("/")
    await one.getByRole("heading", { name: "Sign in", exact: true }).waitFor()
    const two = await opened.context.newPage()
    await two.goto("/")
    await signInOn(two, "owner@example.test")
    await headingIs(two, "Synthetic Bayline")
    // Tab one opens the same user's workspace without a reload or a sign-in of its own.
    await headingIs(one, "Synthetic Bayline")
    expect(await one.locator(".nv-topbar__user").textContent()).toBe("owner@example.test")
    expect(opened.auth.log.filter(entry => entry.grant === "password")).toHaveLength(1)
    const [seenByOne, seenByTwo] = [await storedSession(one), await storedSession(two)]
    expect(seenByOne).toEqual(seenByTwo)
    expect(seenByOne!.lineage).toBeTruthy()
  })

  // A normal refresh near expiry (the 30 s auto-refresh tick) keeps the workspace open on the new token.
  journey("a refresh near expiry keeps the workspace open: same lineage, new token, the workspace uses it", { signedInAs: "owner", sessionLifeSeconds: 125 }, async opened => {
    const { page } = opened
    await page.goto("/#/activity")
    await activityListLoaded(page)
    const before = (await storedSession(page))!
    expect(before.lineage).toBeTruthy()
    // 125 s is outside auth-js's 90 s margin at load; the tick after about 30 s refreshes it.
    await page.waitForFunction(([key, old]) => (JSON.parse(localStorage.getItem(key) ?? "null") as { access_token?: string } | null)?.access_token !== old, [AUTH_STORAGE_KEY, before.token] as const, { timeout: 60_000 })
    const after = (await storedSession(page))!
    expect(after.lineage).toBe(before.lineage)
    expect(opened.auth.log.filter(entry => entry.grant === "refresh_token").map(entry => entry.status)).toEqual([200])
    // Still open (nothing remounted to the session-ended screen), and the next check of the session uses the new token.
    expect(await page.getByRole("heading", { name: "Your session ended" }).count()).toBe(0)
    const used = page.waitForRequest(request => request.url().includes("/workspace-api/") && request.headers().authorization === `Bearer ${after.token}`, { timeout: 30_000 })
    await page.goto("/#/overview")
    await overviewChecked(page)
    await used
    await headingIs(page, "Synthetic Bayline")
  }, 120_000)
})
