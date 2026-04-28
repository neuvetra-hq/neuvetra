# App Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a loading state to the `/app` route that hides all content until the Spirit engine (Three.js renderer + audio buffers) is fully initialized, then transitions to the correct page — eliminating the white flash on load and the jittery first slide animation.

**Architecture:** `view` state in the XState machine gains a new initial `loading` state. While there, `ROUTE_CHANGED` events only update `context.currentRoute` (no view transition). When `useSpirit`'s `onReady` callback fires (after `engine.init()` resolves — Three.js + all audio buffered), `AppLayout` sends `SPIRIT_READY` into the machine, which uses `context.currentRoute` to jump to the right page. A dark fullscreen overlay is shown while `view === 'loading'` and fades out on transition.

**Tech Stack:** XState v5, `@xstate/react`, Framer Motion (already installed), Playwright for E2E tests.

---

## File Map

| Status | Path | Change |
|--------|------|--------|
| Modify | `apps/web/index.html` | Add `background: #0b0c0d` on `<html>` — prevents white flash before JS runs |
| Modify | `apps/web/src/pages/app/machine/appMachine.types.ts` | Add `{ type: "SPIRIT_READY" }` to `AppEvent` union |
| Modify | `apps/web/src/pages/app/machine/appMachine.ts` | Change `view` initial to `"loading"`; add `loading` state with `ROUTE_CHANGED` (store-only) + `SPIRIT_READY` (route-to-page) |
| Modify | `apps/web/src/hooks/useSpirit.ts` | Add optional `onReady?: () => void` param; call it after `engine.init()` resolves |
| Modify | `apps/web/src/components/layout/AppLayout.tsx` | Pass `onReady` to `useSpirit`; read `view.loading`; render `AppLoader` overlay |
| Modify | `apps/web/tests/app-route.spec.ts` | Add test: loader is shown then disappears (TDD) |

---

## Task 1: Fix the white flash — HTML background color

This is a pure HTML/CSS fix. The browser paints `<html>` background before any JS runs, so setting it dark eliminates the white frame entirely.

**Files:**
- Modify: `apps/web/index.html`

- [ ] **Step 1: Add inline style to `<html>`**

In `apps/web/index.html`, change:
```html
<html lang="en">
```
to:
```html
<html lang="en" style="background:#0b0c0d">
```

- [ ] **Step 2: Verify build still passes**

```bash
cd apps/web && bun run build 2>&1 | tail -5
```

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/index.html
git commit -m "fix(app): set html background to #0b0c0d to prevent white flash on load"
```

---

## Task 2: Add SPIRIT_READY test (TDD)

Write the failing test first. The test navigates to `/app`, checks that a loader element is visible on arrival, waits for it to disappear (engine init completes), then confirms the nav is visible.

**Files:**
- Modify: `apps/web/tests/app-route.spec.ts`

- [ ] **Step 1: Add the loader test to `app-route.spec.ts`**

Replace the full file:

```typescript
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
    await page.goto("/app")
    // Loader must be present in the DOM on arrival (view.loading state)
    const loader = page.getByTestId("app-loader")
    await expect(loader).toBeAttached()
    // Engine init completes (Three.js + audio buffers loaded) — loader fades out
    await expect(loader).not.toBeAttached({ timeout: 10000 })
    // Nav is visible once loading is done
    await expect(page.locator("nav")).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the new test to confirm it fails (expected)**

```bash
cd apps/web && bun run test:e2e -- --grep "shows loader" 2>&1 | tail -20
```

Expected: FAIL — `getByTestId("app-loader")` finds nothing because the loader doesn't exist yet.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/web/tests/app-route.spec.ts
git commit -m "test(app): add loader visibility test (red — loader not implemented yet)"
```

---

## Task 3: Add SPIRIT_READY to machine types

**Files:**
- Modify: `apps/web/src/pages/app/machine/appMachine.types.ts`

- [ ] **Step 1: Add the event**

Replace the full file:

```typescript
import type { Session } from "@supabase/supabase-js"

export interface AppUserProfile {
  id: string
  firstName: string
  lastName: string
  phone: string
}

export interface AppBusiness {
  id: string
  name: string
  status: "active" | "inactive" | "suspended"
  businessType: string | null
  twilioNumber: string | null
  stripePlanId: string | null
  stripeSubscriptionId: string | null
  aiConfig: Record<string, unknown> | null
}

export interface AppContext {
  session: Session | null
  profile: AppUserProfile | null
  business: AppBusiness | null
  currentRoute: string
}

export type AppEvent =
  | { type: "AUTH_STATE_CHANGED"; session: Session | null }
  | { type: "SIGN_OUT" }
  | { type: "ROUTE_CHANGED"; pathname: string }
  | { type: "USER_INTERACTED" }
  | { type: "TOGGLE_MUTE" }
  | { type: "SPIRIT_READY" }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/machine/appMachine.types.ts
git commit -m "feat(app): add SPIRIT_READY to AppEvent"
```

---

## Task 4: Update the machine — view starts as loading

The `view` state gains a new initial `loading` state. While there:
- `ROUTE_CHANGED` only stores the route in context — no view transition.
- `SPIRIT_READY` reads `context.currentRoute` and jumps to the matching page state.

The existing top-level `ROUTE_CHANGED` handler on `view` continues to handle page-to-page navigation once out of `loading` — child state transitions shadow parent ones in XState v5, so `loading`'s own `ROUTE_CHANGED` handler takes precedence while booting.

**Files:**
- Modify: `apps/web/src/pages/app/machine/appMachine.ts`

- [ ] **Step 1: Replace the full file**

```typescript
import { setup, assign } from "xstate"
import type { Session } from "@supabase/supabase-js"
import {
  checkWebGL,
  getSession,
  loadProfile,
  supabaseAuthListener,
} from "./appMachine.actors"
import type { AppContext, AppEvent, AppUserProfile, AppBusiness } from "./appMachine.types"

export const appMachine = setup({
  types: {} as {
    context: AppContext
    events: AppEvent
  },
  actors: {
    checkWebGL,
    getSession,
    loadProfile,
    supabaseAuthListener,
  },
  actions: {
    setSessionFromAuth: assign(({ event }) => ({
      session: (event as Extract<AppEvent, { type: "AUTH_STATE_CHANGED" }>).session,
    })),
    clearAuth: assign({
      session: null as Session | null,
      profile: null as AppUserProfile | null,
      business: null as AppBusiness | null,
    }),
    setRoute: assign(({ event }) => ({
      currentRoute: (event as Extract<AppEvent, { type: "ROUTE_CHANGED" }>).pathname,
    })),
  },
}).createMachine({
  id: "neuvetraAI",
  type: "parallel",
  invoke: {
    src: "supabaseAuthListener",
    id: "authListener",
  },
  context: {
    session: null,
    profile: null,
    business: null,
    currentRoute: "/app",
  },
  states: {
    // ── WebGL gate ──────────────────────────────────────────────
    webgl: {
      initial: "checking",
      states: {
        checking: {
          invoke: {
            src: "checkWebGL",
            onDone: [
              { guard: ({ event }) => event.output === true, target: "supported" },
              { target: "unsupported" },
            ],
          },
        },
        supported: { type: "final" },
        unsupported: { type: "final" },
      },
    },

    // ── Auth ─────────────────────────────────────────────────────
    auth: {
      initial: "loading",
      states: {
        loading: {
          invoke: {
            src: "getSession",
            onDone: [
              {
                guard: ({ event }) => event.output !== null,
                target: "authenticated",
                actions: assign(({ event }) => ({ session: event.output })),
              },
              { target: "unauthenticated" },
            ],
          },
          on: {
            AUTH_STATE_CHANGED: {
              guard: ({ event }) => event.session !== null,
              target: "authenticated",
              actions: "setSessionFromAuth",
            },
          },
        },
        unauthenticated: {
          on: {
            AUTH_STATE_CHANGED: {
              guard: ({ event }) => event.session !== null,
              target: "authenticated",
              actions: "setSessionFromAuth",
            },
          },
        },
        authenticated: {
          initial: "loadingProfile",
          on: {
            AUTH_STATE_CHANGED: [
              {
                guard: ({ event }) => event.session !== null,
                actions: "setSessionFromAuth",
              },
              {
                target: "#neuvetraAI.auth.unauthenticated",
                actions: "clearAuth",
              },
            ],
            SIGN_OUT: {
              target: "#neuvetraAI.auth.unauthenticated",
              actions: "clearAuth",
            },
          },
          states: {
            loadingProfile: {
              invoke: {
                src: "loadProfile",
                input: ({ context }) => ({ userId: context.session!.user.id }),
                onDone: [
                  {
                    guard: ({ event }) => event.output.business?.status === "active",
                    target: "ready",
                    actions: assign(({ event }) => ({
                      profile: event.output.profile,
                      business: event.output.business,
                    })),
                  },
                  {
                    target: "incomplete",
                    actions: assign(({ event }) => ({
                      profile: event.output.profile,
                      business: event.output.business,
                    })),
                  },
                ],
              },
            },
            incomplete: {},
            ready: {},
          },
        },
      },
    },

    // ── Audio ─────────────────────────────────────────────────────
    audio: {
      initial: "dormant",
      states: {
        dormant: {
          on: { USER_INTERACTED: "active" },
        },
        active: {
          initial: "unmuted",
          states: {
            unmuted: { on: { TOGGLE_MUTE: "muted" } },
            muted: { on: { TOGGLE_MUTE: "unmuted" } },
          },
        },
      },
    },

    // ── View ─────────────────────────────────────────────────────
    // Starts in 'loading' — stays there until SPIRIT_READY fires.
    // ROUTE_CHANGED in 'loading' only stores the pathname; it does not
    // transition view state. On SPIRIT_READY, jumps to the page that
    // matches context.currentRoute. After that, ROUTE_CHANGED at the
    // parent level handles all page-to-page navigation normally.
    view: {
      initial: "loading",
      on: {
        ROUTE_CHANGED: [
          {
            guard: ({ event }) => event.pathname === "/app",
            target: ".home",
            actions: "setRoute",
          },
          {
            guard: ({ event }) => event.pathname === "/app/how-it-works",
            target: ".howItWorks",
            actions: "setRoute",
          },
          {
            guard: ({ event }) => event.pathname === "/app/pricing",
            target: ".pricing",
            actions: "setRoute",
          },
          {
            guard: ({ event }) => event.pathname === "/app/sign-in",
            target: ".signIn",
            actions: "setRoute",
          },
          {
            guard: ({ event }) => event.pathname === "/app/get-started",
            target: ".getStarted",
            actions: "setRoute",
          },
        ],
      },
      states: {
        loading: {
          on: {
            // Shadow the parent ROUTE_CHANGED: store route only, no view transition
            ROUTE_CHANGED: { actions: "setRoute" },
            // On engine ready, jump to the page that matches the stored route
            SPIRIT_READY: [
              {
                guard: ({ context }) => context.currentRoute === "/app",
                target: "home",
              },
              {
                guard: ({ context }) => context.currentRoute === "/app/how-it-works",
                target: "howItWorks",
              },
              {
                guard: ({ context }) => context.currentRoute === "/app/pricing",
                target: "pricing",
              },
              {
                guard: ({ context }) => context.currentRoute === "/app/sign-in",
                target: "signIn",
              },
              {
                guard: ({ context }) => context.currentRoute === "/app/get-started",
                target: "getStarted",
              },
              // Fallback: any unknown /app/* path lands on home
              { target: "home" },
            ],
          },
        },
        home: {},
        howItWorks: {},
        pricing: {},
        signIn: {},
        getStarted: {},
      },
    },
  },
})

export type AppMachineSnapshot = ReturnType<typeof appMachine.transition>
```

- [ ] **Step 2: Run TypeScript build — must pass**

```bash
cd apps/web && bun run build 2>&1 | tail -10
```

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/app/machine/appMachine.ts
git commit -m "feat(app): view state starts as loading, transitions to page on SPIRIT_READY"
```

---

## Task 5: Add onReady callback to useSpirit

`engine.init()` already awaits all audio buffers. When it resolves, everything is loaded. We just need to surface that promise resolution as a callback.

**Files:**
- Modify: `apps/web/src/hooks/useSpirit.ts`

- [ ] **Step 1: Replace the full file**

```typescript
import { useRef, useEffect, useCallback, type RefObject } from 'react'
import { SpiritEngine } from '@/lib/spirit/engine'

export function useSpirit(
  containerRef: RefObject<HTMLDivElement | null>,
  onReady?: () => void,
): {
  transition: (presetName: string) => void
  toggleMute: () => boolean
} {
  const engineRef = useRef<SpiritEngine | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const engine = new SpiritEngine()
    engineRef.current = engine
    engine.init(container)
      .then(() => onReady?.())
      .catch((err) => {
        console.error('[useSpirit] engine init failed', err)
      })
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const transition = useCallback((presetName: string) => {
    engineRef.current?.transition(presetName)
  }, [])

  const toggleMute = useCallback((): boolean => {
    return engineRef.current?.toggleMute() ?? false
  }, [])

  return { transition, toggleMute }
}
```

- [ ] **Step 2: Run TypeScript build — must pass**

```bash
cd apps/web && bun run build 2>&1 | tail -10
```

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useSpirit.ts
git commit -m "feat(app): add onReady callback to useSpirit — fires after engine.init() resolves"
```

---

## Task 6: Add loader overlay to AppLayout

Wire `onReady` → `SPIRIT_READY`, read `view.loading` state, and render a dark fullscreen overlay while booting. The overlay fades out using Framer Motion's `AnimatePresence` so the transition is smooth.

**Files:**
- Modify: `apps/web/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Replace the full file**

```typescript
import { useRef, useEffect, useState } from "react"
import { NavLink, useLocation, useOutlet } from "react-router"
import { AnimatePresence, motion } from "framer-motion"
import { useSpirit } from "@/hooks/useSpirit"
import { SpiritContext } from "@/contexts/SpiritContext"
import { useAppMachine, useAppSend } from "@/pages/app/hooks/useAppMachine"

const BAR_DELAYS = ["0s", "0.2s", "0.4s", "0.2s"]

const NAV_LINKS = [
  { label: "Home",         href: "/app",               end: true },
  { label: "How It Works", href: "/app/how-it-works" },
  { label: "Pricing",      href: "/app/pricing" },
  { label: "Sign In",      href: "/app/sign-in" },
  { label: "Get Started",  href: "/app/get-started" },
]

const ROUTE_PRESET: Record<string, string> = {
  "/app":               "default",
  "/app/how-it-works":  "howItWorks",
  "/app/pricing":       "pricing",
  "/app/sign-in":       "signIn",
  "/app/get-started":   "getStarted",
}

const SLIDE = {
  initial: { y: "100vh" },
  animate: { y: 0 },
  exit:    { y: "100vh" },
  transition: { duration: 0.55, ease: [0.76, 0, 0.24, 1] as const },
}

function FrozenRoute({ children }: { children: React.ReactNode }) {
  const frozen = useRef(children)
  return <>{frozen.current}</>
}

function AnimatedOutlet() {
  const location = useLocation()
  const outlet = useOutlet()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={SLIDE.initial}
        animate={SLIDE.animate}
        exit={SLIDE.exit}
        transition={SLIDE.transition}
        className="absolute inset-0 z-10"
      >
        <FrozenRoute>{outlet}</FrozenRoute>
      </motion.div>
    </AnimatePresence>
  )
}

function NavItem({ label, href, end }: { label: string; href: string; end?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <NavLink
      to={href}
      end={end}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-[0.65rem] uppercase tracking-[0.25em]"
      style={({ isActive }) => ({
        color: isActive
          ? "rgba(255,255,255,0.95)"
          : hovered
            ? "rgba(255,255,255,0.85)"
            : "rgba(255,255,255,0.6)",
        textShadow: isActive
          ? "0 0 12px rgba(255,255,255,0.7), 0 0 28px rgba(255,255,255,0.3)"
          : hovered
            ? "0 0 10px rgba(255,255,255,0.45)"
            : "none",
        transition: "color 0.3s ease, text-shadow 0.3s ease",
      })}
    >
      {label}
    </NavLink>
  )
}

export function AppLayout() {
  const containerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const send = useAppSend()
  const isLoading = useAppMachine((s) => s.matches({ view: "loading" }))
  const audioStarted = useAppMachine((s) => !s.matches({ audio: "dormant" }))
  const isMuted = useAppMachine((s) => s.matches({ audio: { active: "muted" } }))

  const { transition, toggleMute } = useSpirit(
    containerRef,
    () => send({ type: "SPIRIT_READY" }),
  )

  // Fire Spirit preset the moment the URL changes — syncs burst with slide-down
  useEffect(() => {
    const preset = ROUTE_PRESET[location.pathname]
    if (preset) transition(preset)
  }, [location.pathname])

  // Keep machine view state in sync with React Router
  useEffect(() => {
    send({ type: "ROUTE_CHANGED", pathname: location.pathname })
  }, [location.pathname, send])

  // Lift audio gate on first user gesture (browser autoplay policy)
  useEffect(() => {
    const handler = () => send({ type: "USER_INTERACTED" })
    document.addEventListener("click", handler, { once: true })
    document.addEventListener("keydown", handler, { once: true })
    document.addEventListener("touchstart", handler, { once: true })
    return () => {
      document.removeEventListener("click", handler)
      document.removeEventListener("keydown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [send])

  function handleToggleMute() {
    toggleMute()
    send({ type: "TOGGLE_MUTE" })
  }

  return (
    <SpiritContext.Provider value={{ transition, toggleMute }}>
      <div
        className="relative w-screen h-screen overflow-hidden"
        style={{ background: "radial-gradient(circle at 3% 5%, #253239 0%, #0b0c0d 50%)" }}
      >
        <style>{`
          @keyframes soundbar {
            0%, 100% { height: 4px; }
            50% { height: 16px; }
          }
        `}</style>

        {/* Spirit canvas — always behind everything */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Sound toggle — always top-right */}
        <div className="absolute top-9 right-10 z-50">
          <button
            onClick={handleToggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className={`flex items-end gap-[3px] h-5 transition-opacity duration-500 cursor-pointer ${
              audioStarted ? "opacity-40 hover:opacity-90" : "opacity-0 pointer-events-none"
            }`}
          >
            {BAR_DELAYS.map((delay, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-white"
                style={{
                  height: isMuted ? "3px" : "4px",
                  animation: isMuted ? "none" : "soundbar 0.8s ease-in-out infinite",
                  animationDelay: delay,
                }}
              />
            ))}
          </button>
        </div>

        {/* Persistent bottom nav */}
        <nav className="absolute bottom-10 left-0 right-0 z-50 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 select-none">
          {NAV_LINKS.map((link) => (
            <NavItem key={link.href} label={link.label} href={link.href} end={link.end} />
          ))}
        </nav>

        {/* Page content — slides in/out per route */}
        <AnimatedOutlet />

        {/* Loader overlay — visible while view is in 'loading' state */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              data-testid="app-loader"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0 z-[200] flex items-center justify-center"
              style={{ background: "#0b0c0d" }}
            >
              <span
                className="text-[0.6rem] uppercase tracking-[0.3em]"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                Loading
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SpiritContext.Provider>
  )
}
```

- [ ] **Step 2: Run TypeScript build — must pass**

```bash
cd apps/web && bun run build 2>&1 | tail -10
```

Expected: `✓ built in Xs` — no errors.

- [ ] **Step 3: Run the loader test — should now pass**

```bash
cd apps/web && bun run test:e2e -- --grep "shows loader" 2>&1 | tail -20
```

Expected: PASS — loader is found on arrival, disappears after engine init, nav is visible.

- [ ] **Step 4: Run all /app tests**

```bash
cd apps/web && bun run test:e2e -- --grep "app route" 2>&1 | tail -20
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full test suite — no regressions**

```bash
cd apps/web && bun run test:e2e 2>&1 | tail -30
```

Expected: same pass/fail count as before this task. The 13 pre-existing failures (calendar.spec.ts, call-logs Usage tab) are known and unrelated.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/AppLayout.tsx
git commit -m "feat(app): add loading overlay — hides content until Spirit engine is ready"
```

---

## Task 7: Create tasks file

- [ ] **Step 1: Create `tasks/41-app-loader.md`**

```markdown
---
status: done
---
# Task 41: App Loader

## What was done
- Fixed white flash: added `background: #0b0c0d` to `<html>` in index.html
- Added `loading` initial state to `view` in the XState machine
- `SPIRIT_READY` event transitions `view.loading` → correct page based on `context.currentRoute`
- `ROUTE_CHANGED` in `loading` stores route but does not transition view
- Added `onReady` callback to `useSpirit` — fires when `engine.init()` resolves (Three.js + audio buffered)
- Added dark fullscreen overlay in `AppLayout` with Framer Motion fade-out on SPIRIT_READY

## Key decisions
- Loading state lives in `view` (not a new parallel dimension) — loading screen is a first-class view
- `onReady` is called after `engine.init()` which awaits ALL audio buffers — true "everything loaded" signal
- Overlay uses `z-[200]` to sit above all other layers including nav and page content
- Loader text is placeholder — visual design intentionally deferred
```

- [ ] **Step 2: Commit**

```bash
git add tasks/41-app-loader.md
git commit -m "chore: add task file for app loader (task 41)"
```
