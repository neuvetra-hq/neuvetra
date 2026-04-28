# XState Machine for `/app` (neuvetra.ai) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc `useState`/`useWebGPU`/`GpuRoute` approach in `/app` with a single XState v5 parallel machine that owns all four dimensions of app state: WebGL gate, auth, audio, and current view.

**Architecture:** Full parallel machine (`neuvetraAI`) with four orthogonal state regions running simultaneously. React Router owns the URL; a `useEffect` in `AppLayout` fires `ROUTE_CHANGED` events into the machine. Auth talks to Supabase directly (independent from the `.com` `AuthContext`). The machine is exposed via `createActorContext` from `@xstate/react`.

**Tech Stack:** XState v5 (`xstate`, `@xstate/react`), Supabase JS (`@supabase/supabase-js` already installed), React Router v7, Playwright for E2E tests.

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/pages/app/machine/appMachine.types.ts` | `AppContext`, `AppEvent` union, `AppUserProfile`, `AppBusiness` |
| Create | `apps/web/src/pages/app/machine/appMachine.actors.ts` | `checkWebGL`, `getSession`, `loadProfile`, `supabaseAuthListener` |
| Create | `apps/web/src/pages/app/machine/appMachine.ts` | `setup()` + `createMachine()` — the root definition |
| Create | `apps/web/src/pages/app/AppMachineProvider.tsx` | `createActorContext` + provider + WebGL gate component |
| Create | `apps/web/src/pages/app/hooks/useAppMachine.ts` | Typed selector hook + send hook |
| Modify | `apps/web/src/App.tsx` | Remove `GpuRoute` wrapper, add `AppMachineProvider` |
| Modify | `apps/web/src/components/layout/AppLayout.tsx` | Remove local `useState`, use machine state + send events |
| Modify | `apps/web/tests/app-route.spec.ts` | Replace WebGPU mocks with WebGL2 mocks |
| Delete | `apps/web/src/components/auth/GpuRoute.tsx` | Replaced by machine |
| Delete | `apps/web/src/hooks/useWebGPU.ts` | Replaced by `checkWebGL` actor |
| Delete | `apps/web/src/pages/AppPage.tsx` | Unused since `AppHomePage` was introduced |

---

## Task 1: Install packages

**Files:**
- Modify: `apps/web/package.json` (via bun add)

- [ ] **Step 1: Install xstate and @xstate/react**

```bash
cd apps/web && bun add xstate @xstate/react
```

Expected output: packages added to `apps/web/package.json` and `bun.lock` updated.

- [ ] **Step 2: Verify install**

```bash
cd apps/web && bun run build 2>&1 | tail -5
```

Expected: build succeeds (no xstate-related errors — we haven't used it yet).

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore: install xstate v5 and @xstate/react"
```

---

## Task 2: Update Playwright tests to use WebGL2 mocks (TDD)

The existing `app-route.spec.ts` mocks `navigator.gpu` (WebGPU). After our migration the gate checks `canvas.getContext('webgl2')`, so the old mocks will be wrong. Update the spec now — the redirect test will fail until the machine is wired up.

**Files:**
- Modify: `apps/web/tests/app-route.spec.ts`

- [ ] **Step 1: Replace the spec file with WebGL2-aware mocks**

Full replacement of `apps/web/tests/app-route.spec.ts`:

```typescript
import { test, expect, type Page } from "@playwright/test"

async function mockNoWebGL2(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2") return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (original as any).apply(this, [type, ...args])
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
    await expect(page.locator("div.absolute.inset-0")).toBeAttached()
    await expect(page.locator("nav")).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the tests to confirm first test fails (expected at this stage)**

```bash
cd apps/web && bun run test:e2e -- --grep "app route" 2>&1 | tail -20
```

Expected: "redirects to home when WebGL2 is not supported" **FAILS** (old WebGPU gate doesn't respond to our WebGL2 mock). "renders spirit layout when WebGL2 is available" **PASSES** (it already works). This failure is correct — it's the TDD red state.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/web/tests/app-route.spec.ts
git commit -m "test: update /app route tests to use WebGL2 mocks"
```

---

## Task 3: Create machine types

**Files:**
- Create: `apps/web/src/pages/app/machine/appMachine.types.ts`

- [ ] **Step 1: Create the types file**

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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/machine/appMachine.types.ts
git commit -m "feat(app): add XState machine types"
```

---

## Task 4: Create machine actors

**Files:**
- Create: `apps/web/src/pages/app/machine/appMachine.actors.ts`

- [ ] **Step 1: Create the actors file**

```typescript
import { fromPromise, fromCallback } from "xstate"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { AppEvent, AppUserProfile, AppBusiness } from "./appMachine.types"

export const checkWebGL = fromPromise(async (): Promise<boolean> => {
  const canvas = document.createElement("canvas")
  return !!canvas.getContext("webgl2")
})

export const getSession = fromPromise(async (): Promise<Session | null> => {
  const { data } = await supabase.auth.getSession()
  return data.session
})

export const loadProfile = fromPromise(
  async ({
    input,
  }: {
    input: { userId: string }
  }): Promise<{ profile: AppUserProfile | null; business: AppBusiness | null }> => {
    const [{ data: userData }, { data: memberData }] = await Promise.all([
      supabase
        .from("users")
        .select("id, first_name, last_name, phone")
        .eq("id", input.userId)
        .maybeSingle(),
      supabase
        .from("business_members")
        .select(
          "businesses(id, name, status, business_type, twilio_number, stripe_plan_id, stripe_subscription_id, ai_config)"
        )
        .eq("user_id", input.userId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle(),
    ])

    const profile: AppUserProfile | null = userData
      ? {
          id: userData.id as string,
          firstName: userData.first_name as string,
          lastName: userData.last_name as string,
          phone: userData.phone as string,
        }
      : null

    const b = memberData?.businesses as unknown as Record<string, unknown> | null
    const business: AppBusiness | null = b
      ? {
          id: b.id as string,
          name: b.name as string,
          status: b.status as AppBusiness["status"],
          businessType: (b.business_type as string) ?? null,
          twilioNumber: (b.twilio_number as string) ?? null,
          stripePlanId: (b.stripe_plan_id as string) ?? null,
          stripeSubscriptionId: (b.stripe_subscription_id as string) ?? null,
          aiConfig: (b.ai_config as Record<string, unknown>) ?? null,
        }
      : null

    return { profile, business }
  }
)

export const supabaseAuthListener = fromCallback<AppEvent>(({ sendBack }) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    sendBack({ type: "AUTH_STATE_CHANGED", session })
  })
  return () => subscription.unsubscribe()
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/machine/appMachine.actors.ts
git commit -m "feat(app): add XState machine actors (checkWebGL, getSession, loadProfile, supabaseAuthListener)"
```

---

## Task 5: Create the machine

**Files:**
- Create: `apps/web/src/pages/app/machine/appMachine.ts`

- [ ] **Step 1: Create the machine file**

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
  // Supabase auth listener runs for the lifetime of the machine
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
            // Race condition safety: onAuthStateChange may fire before getSession resolves
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
              // Token refresh — update session in place, no state change
              {
                guard: ({ event }) => event.session !== null,
                actions: "setSessionFromAuth",
              },
              // Sign-out — clear everything
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

    // ── View — mirrors React Router ───────────────────────────────
    view: {
      initial: "home",
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

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/machine/appMachine.ts
git commit -m "feat(app): add neuvetraAI XState parallel machine"
```

---

## Task 6: Create AppMachineProvider

**Files:**
- Create: `apps/web/src/pages/app/AppMachineProvider.tsx`

- [ ] **Step 1: Create the provider file**

```typescript
import { useEffect } from "react"
import { useNavigate } from "react-router"
import { createActorContext } from "@xstate/react"
import { appMachine } from "./machine/appMachine"

export const AppMachineContext = createActorContext(appMachine)

function WebGLGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const webglState = AppMachineContext.useSelector((s) => s.value.webgl)

  useEffect(() => {
    if (webglState === "unsupported") {
      navigate("/", { replace: true })
    }
  }, [webglState, navigate])

  if (webglState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-300" />
      </div>
    )
  }

  if (webglState === "unsupported") return null

  return <>{children}</>
}

export function AppMachineProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppMachineContext.Provider>
      <WebGLGate>{children}</WebGLGate>
    </AppMachineContext.Provider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/AppMachineProvider.tsx
git commit -m "feat(app): add AppMachineProvider with WebGL gate"
```

---

## Task 7: Create useAppMachine hook

**Files:**
- Create: `apps/web/src/pages/app/hooks/useAppMachine.ts`

- [ ] **Step 1: Create the hook file**

```typescript
import type { SnapshotFrom } from "xstate"
import { AppMachineContext } from "../AppMachineProvider"
import type { appMachine } from "../machine/appMachine"

export function useAppMachine<T>(
  selector: (snapshot: SnapshotFrom<typeof appMachine>) => T
): T {
  return AppMachineContext.useSelector(selector)
}

export function useAppSend() {
  return AppMachineContext.useActorRef().send
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/hooks/useAppMachine.ts
git commit -m "feat(app): add useAppMachine selector hook and useAppSend"
```

---

## Task 8: Update App.tsx

Replace the `<GpuRoute><AppLayout /></GpuRoute>` wrapper with `<AppMachineProvider><AppLayout /></AppMachineProvider>`.

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Update App.tsx**

Replace the full file content of `apps/web/src/App.tsx`:

```typescript
import { Routes, Route, Navigate } from "react-router"
import { LandingPage } from "@/pages/LandingPage"
import { LoginPage } from "@/pages/LoginPage"
import { SignupPage } from "@/pages/SignupPage"
import { AuthCallbackPage } from "@/pages/AuthCallbackPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { TermsPage } from "@/pages/TermsPage"
import { PrivacyPage } from "@/pages/PrivacyPage"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { CalendarCallbackPage } from "@/pages/CalendarCallbackPage"
import { IndustryPage } from "@/pages/IndustryPage"
import { ContactPage } from "@/pages/ContactPage"
import { MarketingLayout } from "@/components/layout/MarketingLayout"
import { AppLayout } from "@/components/layout/AppLayout"
import { AppMachineProvider } from "@/pages/app/AppMachineProvider"
import { VoiceCallProvider } from "@/contexts/VoiceCallContext"
import { CallFAB } from "@/components/landing/CallFAB"
import { ScrollToTop } from "@/components/layout/ScrollToTop"
import { AppHomePage } from "@/pages/app/AppHomePage"
import { AppHowItWorksPage } from "@/pages/app/AppHowItWorksPage"
import { AppPricingPage } from "@/pages/app/AppPricingPage"
import { AppSignInPage } from "@/pages/app/AppSignInPage"
import { AppGetStartedPage } from "@/pages/app/AppGetStartedPage"

export function App() {
  return (
    <VoiceCallProvider>
      <ScrollToTop />
      <Routes>
        {/* Marketing routes */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/industries/:slug" element={<IndustryPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>

        {/* /app — XState machine owns WebGL gate + all app state */}
        <Route
          path="/app"
          element={
            <AppMachineProvider>
              <AppLayout />
            </AppMachineProvider>
          }
        >
          <Route index element={<AppHomePage />} />
          <Route path="how-it-works" element={<AppHowItWorksPage />} />
          <Route path="pricing" element={<AppPricingPage />} />
          <Route path="sign-in" element={<AppSignInPage />} />
          <Route path="get-started" element={<AppGetStartedPage />} />
        </Route>

        {/* Auth + legal */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Signup wizard */}
        <Route path="/signup" element={<SignupPage />} />

        {/* Legacy redirect */}
        <Route path="/onboarding" element={<Navigate to="/signup" replace />} />

        {/* Calendar OAuth return */}
        <Route path="/calendar/callback" element={<ProtectedRoute><CalendarCallbackPage /></ProtectedRoute>} />
        <Route path="/calendar/microsoft/callback" element={<ProtectedRoute><CalendarCallbackPage /></ProtectedRoute>} />
        <Route path="/calendar/caldav/callback" element={<ProtectedRoute><CalendarCallbackPage /></ProtectedRoute>} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/dashboard/overview" replace /></ProtectedRoute>} />
        <Route path="/dashboard/:tab" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      </Routes>
      <CallFAB />
    </VoiceCallProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(app): wire AppMachineProvider into /app route, remove GpuRoute"
```

---

## Task 9: Update AppLayout.tsx

Replace local `useState` for `muted`/`audioStarted` with machine state. Add `ROUTE_CHANGED`, `USER_INTERACTED`, and `TOGGLE_MUTE` event dispatch.

**Files:**
- Modify: `apps/web/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Replace AppLayout.tsx with the machine-driven version**

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
  const { transition, toggleMute } = useSpirit(containerRef)
  const location = useLocation()
  const send = useAppSend()
  const audioStarted = useAppMachine((s) => !s.matches({ audio: "dormant" }))
  const isMuted = useAppMachine((s) => s.matches({ audio: { active: "muted" } }))

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
      </div>
    </SpiritContext.Provider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/AppLayout.tsx
git commit -m "feat(app): wire AppLayout to XState machine (audio + route events)"
```

---

## Task 10: Delete old files and run build + tests

**Files:**
- Delete: `apps/web/src/components/auth/GpuRoute.tsx`
- Delete: `apps/web/src/hooks/useWebGPU.ts`
- Delete: `apps/web/src/pages/AppPage.tsx`

- [ ] **Step 1: Delete the replaced files**

```bash
rm apps/web/src/components/auth/GpuRoute.tsx
rm apps/web/src/hooks/useWebGPU.ts
rm apps/web/src/pages/AppPage.tsx
```

- [ ] **Step 2: Run TypeScript build — must pass with zero errors**

```bash
cd apps/web && bun run build 2>&1 | tail -20
```

Expected: `✓ built in Xs` with no TypeScript errors. If you see errors referencing `GpuRoute` or `useWebGPU`, check that `App.tsx` no longer imports them. If you see errors in `AppLayout.tsx`, check that `useAppMachine` and `useAppSend` are imported from the correct path (`@/pages/app/hooks/useAppMachine`).

- [ ] **Step 3: Run the /app Playwright tests — both should now pass**

```bash
cd apps/web && bun run test:e2e -- --grep "app route" 2>&1 | tail -20
```

Expected: both tests **PASS**:
- "redirects to home when WebGL2 is not supported" ✓
- "renders spirit layout when WebGL2 is available" ✓

- [ ] **Step 4: Run full test suite to check for regressions**

```bash
cd apps/web && bun run test:e2e 2>&1 | tail -30
```

Expected: all previously-passing tests still pass.

- [ ] **Step 5: Commit deletions**

```bash
git add -A
git commit -m "feat(app): remove GpuRoute, useWebGPU, unused AppPage — replaced by XState machine"
```

---

## Task 11: Create tasks file

- [ ] **Step 1: Create `tasks/40-xstate-app-machine.md`**

```markdown
---
status: done
---
# Task 40: XState Machine for /app (neuvetra.ai)

## What was done
- Installed xstate v5 + @xstate/react in apps/web
- Created parallel machine `neuvetraAI` with 4 orthogonal states: webgl, auth, audio, view
- WebGL2 gate replaces the old WebGPU gate (Spirit uses THREE.WebGLRenderer, not WebGPU)
- Machine owns auth state (Supabase direct, independent from .com AuthContext)
- AppLayout sends ROUTE_CHANGED, USER_INTERACTED, TOGGLE_MUTE events into machine
- Deleted GpuRoute.tsx, useWebGPU.ts, unused AppPage.tsx
- Updated Playwright tests to use WebGL2 mocks

## Key decisions
- Parallel machine (not actor federation) — simpler, right-sized for current scope
- Router drives machine (not machine drives router) — React Router owns URL
- Auth is independent from .com AuthContext — /app is its own product (neuvetra.ai)
- supabaseAuthListener invoked at machine root so it runs for the full lifetime
- Machine exposed via createActorContext from @xstate/react
```

```bash
git add tasks/40-xstate-app-machine.md
git commit -m "chore: add task file for XState app machine (task 40)"
```
