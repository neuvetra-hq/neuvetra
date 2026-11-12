/**
 * E2E-01: the browser side. playwright-core drives an installed Chrome (no browser download). Each test gets its own
 * browser context with:
 * - the Supabase Auth API stubbed at the network level (password sign-in, user, logout, OTP), so no real Supabase is
 *   contacted. The stub issues tokens from the stack's TokenDirectory, which the server's injected validator reads;
 * - a trace (screenshots and DOM snapshots) that is written, with a screenshot of each open page, only when the test fails.
 */
import { existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright-core"
import { E2E_PROJECT_REF } from "./database"
import { USERS, type UserKey } from "./seed"
import type { Stack } from "./stack"

export const ARTIFACTS = path.resolve(import.meta.dir, "../../test-results/browser-smoke")
export const AUTH_STORAGE_KEY = `neuvetra:m63:${E2E_PROJECT_REF}:auth`
const SUPABASE = new RegExp(`^https://${E2E_PROJECT_REF}\\.supabase\\.co/`)

/** CHROME_PATH, or the usual install locations of Chrome or Chromium on Linux and macOS. */
export function chromePath(): string {
  const candidates = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter((value): value is string => Boolean(value))
  const found = candidates.find(candidate => existsSync(candidate))
  if (!found) throw new Error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium executable.")
  return found
}

export function launchBrowser(): Promise<Browser> {
  return chromium.launch({ executablePath: chromePath(), headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--disable-gpu"] })
}

/** The session object supabase-js keeps in localStorage and returns from the token endpoint. */
export function sessionFor(user: UserKey, accessToken: string) {
  const now = Math.floor(Date.now() / 1000)
  return { access_token: accessToken, refresh_token: `refresh-${accessToken}`, token_type: "bearer", expires_in: 86_400, expires_at: now + 86_400,
    user: { id: USERS[user].id, aud: "authenticated", role: "authenticated", email: USERS[user].email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2025-01-01T00:00:00Z" } }
}

async function stubSupabase(route: Route, stack: Stack) {
  const request = route.request()
  const url = new URL(request.url())
  const json = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
    const { email } = JSON.parse(request.postData() ?? "{}") as { email?: string }
    const user = (Object.keys(USERS) as UserKey[]).find(key => USERS[key].email === email)
    if (!user) return json(400, { error: "invalid_grant", error_description: "Invalid login credentials" })
    return json(200, sessionFor(user, stack.tokens.issue(user)))
  }
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
    const { refresh_token: refresh } = JSON.parse(request.postData() ?? "{}") as { refresh_token?: string }
    const user = refresh ? stack.tokens.userOf(refresh.replace(/^refresh-/, "")) : null
    return user ? json(200, sessionFor(user, stack.tokens.issue(user))) : json(400, { error: "invalid_grant", error_description: "Invalid Refresh Token" })
  }
  if (url.pathname === "/auth/v1/user") {
    const token = (request.headers().authorization ?? "").replace(/^Bearer /, "")
    const user = stack.tokens.userOf(token)
    return user ? json(200, sessionFor(user, token).user) : json(401, { error: "invalid_token" })
  }
  if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" })
  if (url.pathname === "/auth/v1/otp") return json(200, {})
  return json(404, { error: "not_stubbed" })
}

export interface Journey {
  context: BrowserContext
  page: Page
  /** Uncaught page errors seen so far (a test asserts this is empty). */
  errors: string[]
  /** Every dialog the page opened, as "type: message". */
  dialogs: string[]
  /** How the next confirm() is answered (default: decline, which is the safe choice). */
  answerDialogs: boolean
  /** Workspace API writes the page sent, as "METHOD /path". */
  writes: string[]
}

export interface JourneyOptions {
  width?: number
  height?: number
  /** Start already signed in as this user (the session is in localStorage before the app loads). */
  signedInAs?: UserKey
}

export async function openJourney(browser: Browser, stack: Stack, options: JourneyOptions = {}): Promise<Journey> {
  const context = await browser.newContext({ viewport: { width: options.width ?? 1360, height: options.height ?? 900 }, deviceScaleFactor: 1, reducedMotion: "reduce", baseURL: stack.origin })
  await context.tracing.start({ screenshots: true, snapshots: true })
  await context.route(SUPABASE, route => stubSupabase(route, stack))
  if (options.signedInAs) {
    // Only on the first document of this context: a later reload must see whatever the app itself left in storage.
    const session = JSON.stringify(sessionFor(options.signedInAs, stack.tokens.issue(options.signedInAs)))
    await context.addInitScript(([key, value]) => {
      if (window.sessionStorage.getItem("e2e:seeded")) return
      window.sessionStorage.setItem("e2e:seeded", "1")
      window.localStorage.setItem(key, value)
    }, [AUTH_STORAGE_KEY, session] as const)
  }
  // Every address the page shows, in order, across pushState, replaceState, hash changes and reloads.
  await context.addInitScript(() => {
    const seen: string[] = JSON.parse(window.sessionStorage.getItem("e2e:hashes") ?? "[]")
    const note = () => { seen.push(window.location.hash); window.sessionStorage.setItem("e2e:hashes", JSON.stringify(seen)) }
    for (const name of ["pushState", "replaceState"] as const) {
      const original = window.history[name].bind(window.history)
      window.history[name] = (...args: Parameters<History["pushState"]>) => { original(...args); note() }
    }
    window.addEventListener("hashchange", note)
    note()
  })
  const page = await context.newPage()
  const journey: Journey = { context, page, errors: [], dialogs: [], answerDialogs: false, writes: [] }
  page.on("pageerror", error => journey.errors.push(error.message))
  page.on("dialog", dialog => {
    journey.dialogs.push(`${dialog.type()}: ${dialog.message()}`)
    void (journey.answerDialogs ? dialog.accept() : dialog.dismiss())
  })
  page.on("request", request => {
    const url = new URL(request.url())
    if (request.method() !== "GET" && url.pathname.startsWith("/workspace-api/")) journey.writes.push(`${request.method()} ${url.pathname}`)
  })
  return journey
}

/** Every address the page has shown in this tab, oldest first. */
export function addressesSeen(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(window.sessionStorage.getItem("e2e:hashes") ?? "[]") as string[])
}

/** Closes the journey; on failure, keeps a screenshot of each page and the trace under test-results/browser-smoke. */
export async function closeJourney(journey: Journey, name: string, failed: boolean) {
  const slug = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 80)
  if (failed) {
    mkdirSync(ARTIFACTS, { recursive: true })
    let index = 0
    for (const page of journey.context.pages()) await page.screenshot({ path: path.join(ARTIFACTS, `${slug}-${++index}.png`), fullPage: true }).catch(() => {})
    await journey.context.tracing.stop({ path: path.join(ARTIFACTS, `${slug}-trace.zip`) }).catch(() => {})
  } else await journey.context.tracing.stop().catch(() => {})
  await journey.context.close()
}

/** The workspace's page heading: the first visible h1 inside the main region. */
export function pageHeading(page: Page) {
  return page.locator("main h1:visible").first()
}

/** Where the element with focus is, and whether it is the visible page heading, fully inside the area below the sticky bars. */
export function focusReport(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    const heading = [...document.querySelectorAll<HTMLElement>("main h1")].find(item => item.getClientRects().length > 0) ?? null
    const probe = document.createElement("div")
    probe.style.cssText = "position:absolute;visibility:hidden;height:var(--nv-sticky-offset, 0px)"
    document.body.appendChild(probe)
    const stickyOffset = probe.getBoundingClientRect().height
    probe.remove()
    const rect = heading?.getBoundingClientRect()
    const hit = heading && rect ? document.elementFromPoint(rect.left + Math.min(8, rect.width / 2), rect.top + Math.min(8, rect.height / 2)) : null
    return {
      hash: window.location.hash,
      heading: heading?.textContent?.trim() ?? null,
      headingFocused: Boolean(heading && active === heading),
      focused: active ? `${active.tagName.toLowerCase()} ${(active.textContent ?? "").trim().slice(0, 60)}` : null,
      top: rect ? Math.round(rect.top) : null,
      bottom: rect ? Math.round(rect.bottom) : null,
      stickyOffset: Math.round(stickyOffset),
      viewportHeight: window.innerHeight,
      unobscured: Boolean(heading && hit && heading.contains(hit)),
    }
  })
}

/** Horizontal overflow of the page in CSS pixels (0 when nothing is wider than the viewport). */
export function horizontalOverflow(page: Page) {
  return page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth)
}
