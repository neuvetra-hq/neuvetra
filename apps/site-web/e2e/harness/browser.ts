/**
 * E2E-01: the browser side. playwright-core drives an installed Chrome (no browser download). Each test gets its own
 * browser context with:
 * - the Supabase Auth API stubbed at the network level (`AuthStub`: password sign-in, refresh, user, logout, OTP, with
 *   real sessions), so no real Supabase is contacted. The stub issues tokens from the stack's TokenDirectory, which the
 *   server's injected validator reads;
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

/** Launches Chrome. With E2E_CHROME_VERSION set (CI pins one), any other version is refused rather than used. */
export async function launchBrowser(): Promise<Browser> {
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--disable-gpu"] })
  const expected = process.env.E2E_CHROME_VERSION
  if (expected && browser.version() !== expected) {
    const actual = browser.version()
    await browser.close()
    throw new Error(`Chrome ${actual} is not the pinned ${expected} (E2E_CHROME_VERSION).`)
  }
  return browser
}

/** The session object supabase-js keeps in localStorage and returns from the token endpoint. */
export function sessionFor(user: UserKey, accessToken: string, refreshToken = `refresh-${accessToken}`, lifeSeconds = 86_400) {
  const now = Math.floor(Date.now() / 1000)
  return { access_token: accessToken, refresh_token: refreshToken, token_type: "bearer", expires_in: lifeSeconds, expires_at: now + lifeSeconds,
    user: { id: USERS[user].id, aud: "authenticated", role: "authenticated", email: USERS[user].email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2025-01-01T00:00:00Z" } }
}

/**
 * One Supabase Auth session of the stub: every access token it issued (with its expiry), the refresh token that is
 * current, and the ones it replaced (with when), for the reuse window.
 */
export interface StubSession {
  id: number; user: UserKey; revoked: boolean; accessTokens: string[]; refreshToken: string
  /** Access token → expiry (ms since the epoch). */
  expires: Map<string, number>
  /** Refresh tokens this session has rotated away from → when they were replaced. */
  replaced: Map<string, number>
}
/** GoTrue's default `refresh_token_reuse_interval` (10 s): the parent of the current refresh token is still accepted. */
export const REFRESH_REUSE_WINDOW_MS = 10_000
/** One request the stub answered (`status` is absent while it is held or stalled). */
export interface AuthRequest { at: number; path: string; grant: string | null; scope: string | null; bearer: string | null; session: number | null; status?: number }
export type LogoutMode = "ok" | "stall" | "refused"

/**
 * WO-14a: Supabase Auth, stubbed at the network level per browser context, with real sessions (ported from QA's GoTrue
 * stand-in for PR #56, round 3). Access tokens come from the stack's TokenDirectory, so the server accepts exactly the
 * tokens of live sessions.
 * - Password sign-in starts a session; a refresh rotates its refresh token (the previous one is refused) and issues a new
 *   access token, earlier access tokens stay valid until revoked, as JWTs do.
 * - `POST /logout` (mode `ok`) revokes the session: all its access tokens are refused by the server from then on and its
 *   refresh token answers 400. Mode `stall` never answers; `refused` fails the connection.
 * - `holdRefresh()` holds refresh answers until `releaseRefresh()`; the server has already issued the new token by then,
 *   only the answer is late (the hardest case for a sign-out).
 * - A session whose access tokens were all revoked from the TokenDirectory (`stack.tokens.revokeUser`, which journeys use
 *   to end a session) counts as revoked: it can't be refreshed.
 *
 * WO-14b (QA's stub gaps on PR #59), as GoTrue does it as far as documented (still to confirm on staging, design §4):
 * - **Reuse window.** The refresh token a session has just rotated away from is still accepted for
 *   `REFRESH_REUSE_WINDOW_MS`: the answer is a new access token with the session's *current* refresh token (no second
 *   rotation). An older refresh token, or the previous one after the window, is reuse: the whole session is revoked and the
 *   answer is 400 `refresh_token_already_used`.
 * - **Access-token expiry at the Auth API.** `/user` and `/logout` refuse an expired access token, and any token the stub
 *   never issued, with 403 `bad_jwt` (a revoked session's token still gets 403 `session_not_found`).
 *
 * Still not like real Supabase: the workspace server (the stack's TokenDirectory) accepts an access token after its expiry;
 * any password signs in; `scope`, `apikey`, `X-Client-Info` and CORS are not checked (assert on `log[].scope`); no rate
 * limits on `/token`; PKCE (`/verify`, `grant_type=pkce`) answers 404 `not_stubbed`; tokens aren't JWTs.
 */
export class AuthStub {
  readonly sessions = new Map<number, StubSession>()
  readonly log: AuthRequest[] = []
  logoutMode: LogoutMode = "ok"
  private nextSession = 0
  private held: Promise<void> | null = null
  private releaseHeld: () => void = () => {}
  private readonly stalled: Array<() => void> = []
  constructor(private readonly stack: Stack) {}

  /** A new live session for `user`, as a sign-in would give (also used to start a journey signed in). */
  newSession(user: UserKey, lifeSeconds = 86_400) {
    const session: StubSession = { id: ++this.nextSession, user, revoked: false, accessTokens: [], refreshToken: "", expires: new Map(), replaced: new Map() }
    this.sessions.set(session.id, session)
    return this.issue(session, lifeSeconds)
  }
  holdRefresh() { if (!this.held) this.held = new Promise(resolve => { this.releaseHeld = resolve }) }
  releaseRefresh() { this.releaseHeld(); this.held = null }
  setLogout(mode: LogoutMode) { this.logoutMode = mode }
  /** Whether the server still accepts this session: not logged out, and some access token not revoked. */
  isLive(session: StubSession) { return !session.revoked && session.accessTokens.some(token => this.stack.tokens.userOf(token) !== null) }
  sessionOfAccess(token: string) { return [...this.sessions.values()].find(session => session.accessTokens.includes(token)) ?? null }
  revoke(session: StubSession) { session.revoked = true; for (const token of session.accessTokens) this.stack.tokens.revoke(token) }
  /** Answers whatever is still held or stalled (called when the journey closes). */
  dispose() { this.releaseRefresh(); for (const release of this.stalled.splice(0)) release() }

  /** Whether an access token has passed its expiry (as the Auth API sees it). */
  isExpired(session: StubSession, token: string) { return (session.expires.get(token) ?? 0) <= Date.now() }

  /** A new access token; with `rotate`, a new refresh token too (the previous one is kept for the reuse window). */
  private issue(session: StubSession, lifeSeconds: number, rotate = true) {
    const access = this.stack.tokens.issue(session.user)
    session.accessTokens.push(access)
    session.expires.set(access, Date.now() + lifeSeconds * 1000)
    if (rotate) {
      if (session.refreshToken) session.replaced.set(session.refreshToken, Date.now())
      session.refreshToken = `refresh-s${session.id}-${session.accessTokens.length}`
    }
    return sessionFor(session.user, access, session.refreshToken, lifeSeconds)
  }

  async handle(route: Route) {
    const request = route.request()
    const url = new URL(request.url())
    const bearer = (request.headers().authorization ?? "").replace(/^Bearer /, "") || null
    const entry: AuthRequest = { at: Date.now(), path: url.pathname, grant: url.searchParams.get("grant_type"), scope: url.searchParams.get("scope"), bearer, session: null }
    this.log.push(entry)
    const json = (status: number, body: unknown) => { entry.status = status; return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }) }
    const notFound = () => json(403, { code: 403, error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" })
    const badJwt = () => json(403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired" })
    const refreshRefused = (code: string, message: string) => json(400, { code: 400, error_code: code, error: "invalid_grant", error_description: `Invalid Refresh Token: ${message}`, msg: `Invalid Refresh Token: ${message}` })

    if (url.pathname === "/auth/v1/token" && entry.grant === "password") {
      const { email } = JSON.parse(request.postData() ?? "{}") as { email?: string }
      const user = (Object.keys(USERS) as UserKey[]).find(key => USERS[key].email === email)
      if (!user) return json(400, { code: 400, error_code: "invalid_credentials", error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" })
      const issued = this.newSession(user)
      entry.session = this.nextSession
      return json(200, issued)
    }
    if (url.pathname === "/auth/v1/token" && entry.grant === "refresh_token") {
      const { refresh_token: refresh } = JSON.parse(request.postData() ?? "{}") as { refresh_token?: string }
      const current = [...this.sessions.values()].find(item => item.refreshToken === refresh) ?? null
      const parent = current ? null : [...this.sessions.values()].find(item => refresh !== undefined && item.replaced.has(refresh)) ?? null
      const session = current ?? parent
      entry.session = session?.id ?? null
      if (!session || !this.isLive(session)) {
        if (this.held) await this.held
        return refreshRefused("refresh_token_not_found", "Refresh Token Not Found").catch(() => {})
      }
      if (parent) {
        // The parent of the current refresh token within the reuse window: a new access token, same current refresh token.
        const replacedAt = parent.replaced.get(refresh!)!
        const newest = Math.max(...parent.replaced.values())
        if (replacedAt !== newest || Date.now() - replacedAt > REFRESH_REUSE_WINDOW_MS) {
          this.revoke(parent)
          if (this.held) await this.held
          return refreshRefused("refresh_token_already_used", "Already Used").catch(() => {})
        }
      }
      // The server issues the new token now; a held refresh only delays the answer on its way back.
      const issued = this.issue(session, 3600, !parent)
      if (this.held) await this.held
      return json(200, issued).catch(() => {})
    }
    if (url.pathname === "/auth/v1/user") {
      const session = bearer ? this.sessionOfAccess(bearer) : null
      if (!session || this.isExpired(session, bearer!)) return badJwt()
      if (!this.isLive(session)) return notFound()
      return json(200, sessionFor(session.user, bearer!).user)
    }
    if (url.pathname === "/auth/v1/logout") {
      if (this.logoutMode === "refused") return route.abort("connectionrefused")
      if (this.logoutMode === "stall") { await new Promise<void>(resolve => this.stalled.push(resolve)); return route.abort("timedout").catch(() => {}) }
      const session = bearer ? this.sessionOfAccess(bearer) : null
      entry.session = session?.id ?? null
      if (!session || this.isExpired(session, bearer!)) return badJwt()
      if (!this.isLive(session)) return notFound()
      this.revoke(session)
      entry.status = 204
      return route.fulfill({ status: 204, body: "" })
    }
    if (url.pathname === "/auth/v1/otp") return json(200, {})
    return json(404, { error: "not_stubbed" })
  }
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
  /** This context's Supabase Auth stub: its sessions, request log, held refreshes and logout mode. */
  auth: AuthStub
}

export interface JourneyOptions {
  width?: number
  height?: number
  /** Start already signed in as this user (the session is in localStorage before the app loads). */
  signedInAs?: UserKey
  /**
   * WO-14c: the lifetime of that session's access token in seconds (default 24 h). Under 90 s the app refreshes it as it
   * loads (auth-js's margin); a little more lets a journey watch the 30 s auto-refresh tick do it.
   */
  sessionLifeSeconds?: number
}

export async function openJourney(browser: Browser, stack: Stack, options: JourneyOptions = {}): Promise<Journey> {
  const context = await browser.newContext({ viewport: { width: options.width ?? 1360, height: options.height ?? 900 }, deviceScaleFactor: 1, reducedMotion: "reduce", baseURL: stack.origin })
  await context.tracing.start({ screenshots: true, snapshots: true })
  const auth = new AuthStub(stack)
  await context.route(SUPABASE, route => auth.handle(route))
  if (options.signedInAs) {
    // Only on the first document of this context: a later reload must see whatever the app itself left in storage.
    // Stored as main's code (before WO-14) stores it: without nv_lineage. The app adopts it as it loads.
    const session = JSON.stringify(auth.newSession(options.signedInAs, options.sessionLifeSeconds))
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
  // WO-14c (I11): every unhandled promise rejection in any page of the journey is recorded too (pageerror also reports it).
  await context.addInitScript(() => {
    window.addEventListener("unhandledrejection", event => {
      const reason = event.reason as { message?: unknown } | undefined
      const store = window as unknown as { __nvUnhandled?: string[] }
      ;(store.__nvUnhandled ??= []).push(String(reason?.message ?? reason))
    })
  })
  const journey: Journey = { context, page: null as unknown as Page, errors: [], dialogs: [], answerDialogs: false, writes: [], auth }
  const page = await context.newPage()
  journey.page = page
  page.on("pageerror", error => journey.errors.push(error.message))
  // Every later page of the context (a journey may open a second tab) reports its uncaught errors too, except from its
  // initial about:blank document, where the init scripts can't use sessionStorage (the first page's listener is attached
  // after that document, as before).
  context.on("page", opened => { if (opened !== page) opened.on("pageerror", error => { if (opened.url() !== "about:blank") journey.errors.push(error.message) }) })
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

/** WO-14c (I11): the unhandled promise rejections each open page has recorded since it loaded. */
export async function unhandledRejections(journey: Journey): Promise<string[]> {
  const found: string[] = []
  for (const page of journey.context.pages()) {
    if (page.isClosed()) continue
    found.push(...await page.evaluate(() => (window as unknown as { __nvUnhandled?: string[] }).__nvUnhandled ?? []).catch(() => []))
  }
  return found
}

/** Every address the page has shown in this tab, oldest first. */
export function addressesSeen(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(window.sessionStorage.getItem("e2e:hashes") ?? "[]") as string[])
}

/** Closes the journey; on failure, keeps a screenshot of each page and the trace under test-results/browser-smoke. */
export async function closeJourney(journey: Journey, name: string, failed: boolean) {
  journey.auth.dispose()
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
