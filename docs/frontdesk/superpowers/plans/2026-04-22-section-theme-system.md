# Section Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a single `section-themes.ts` source of truth so that one hex change updates both Spirit particle colors and the UI ghost title color simultaneously.

**Architecture:** `section-themes.ts` exports `SectionTheme` (dark/mid/light) and `THEMES`. Each route in `routes.ts` references a theme by name. On `ROUTE_CHANGED`, appMachine runs two actions: `setCurrentTheme` (assign context) and `sendRouteToSpirit` (fire-and-forget with color1/color2 from theme). `AppPageShell` and `AppHomePage` read `currentTheme.light` from appMachine context via `useAppMachine`.

**Tech Stack:** XState v5, React, TypeScript, Playwright (tests)

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Create | `apps/web/src/data/section-themes.ts` | SectionTheme interface, THEMES, DEFAULT_THEME |
| Create | `apps/web/tests/app-section-themes.spec.ts` | E2E color verification tests |
| Modify | `apps/web/src/pages/app/routes.ts` | Add `theme: string` to each route entry |
| Modify | `apps/web/src/pages/app/machine/appMachine.types.ts` | Add `currentTheme: SectionTheme` to AppContext |
| Modify | `apps/web/src/pages/app/machine/appMachine.ts` | setCurrentTheme action, rename forwardPreset→sendRouteToSpirit, enrich with color1/color2, update ROUTE_CHANGED handlers, initial context |
| Modify | `apps/web/src/lib/spirit/spiritMachine.types.ts` | Extend SET_PRESET event: `color1?: string; color2?: string` |
| Modify | `apps/web/src/lib/spirit/spiritMachine.ts` | applyPreset uses `e.color1 ?? to.color1`, same for color2 |
| Modify | `apps/web/src/pages/app/AppPageShell.tsx` | Read `currentTheme.light` via useAppMachine, apply to h1 |
| Modify | `apps/web/src/pages/app/AppHomePage.tsx` | Read `currentTheme.light` via useAppMachine, replace hardcoded #668a93 |

---

## Task 1: Write failing E2E tests for theme colors

**Files:**
- Create: `apps/web/tests/app-section-themes.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
// apps/web/tests/app-section-themes.spec.ts
import { test, expect } from "@playwright/test"

// Expected computed CSS colors (hex → rgb):
// blue  #5ba3c9 → rgb(91, 163, 201)   Home / default
// green #3d9e60 → rgb(61, 158, 96)    How It Works
// purple #9060d0 → rgb(144, 96, 208)  Pricing

test.describe("section theme colors", () => {
  test("/app h1 uses blue theme color", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(91, 163, 201)")
  })

  test("/app/how-it-works h1 uses green theme color", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(61, 158, 96)")
  })

  test("/app/pricing h1 uses purple theme color", async ({ page }) => {
    await page.goto("/app/pricing")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(144, 96, 208)")
  })

  test("theme changes when navigating between sections", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(61, 158, 96)")

    await page.goto("/app/pricing")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(144, 96, 208)")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && bun run test:e2e --grep "section theme colors"
```

Expected: All 4 tests FAIL — current h1 has hardcoded `rgba(102, 138, 147, 0.5)` / `#668a93`, not theme colors.

---

## Task 2: Create section-themes.ts

**Files:**
- Create: `apps/web/src/data/section-themes.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/web/src/data/section-themes.ts
export interface SectionTheme {
  dark:  string   // Spirit dying particle color (color1 in preset)
  mid:   string   // Spirit alive particle color (color2 in preset)
  light: string   // UI ghost title color
}

export const THEMES: Record<string, SectionTheme> = {
  blue: {
    dark:  '#001020',
    mid:   '#00446d',
    light: '#5ba3c9',
  },
  green: {
    dark:  '#001508',
    mid:   '#005228',
    light: '#3d9e60',
  },
  purple: {
    dark:  '#0a0015',
    mid:   '#340060',
    light: '#9060d0',
  },
  teal: {
    dark:  '#001518',
    mid:   '#005568',
    light: '#3aaac0',
  },
  amber: {
    dark:  '#180a00',
    mid:   '#6b3200',
    light: '#d06030',
  },
}

export const DEFAULT_THEME = THEMES.blue
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/section-themes.ts
git commit -m "feat(theme): add section-themes.ts — SectionTheme interface, THEMES, DEFAULT_THEME"
```

---

## Task 3: Update routes.ts with theme field

**Files:**
- Modify: `apps/web/src/pages/app/routes.ts`

- [ ] **Step 1: Add theme field to each route**

Replace the entire file with:

```typescript
export const APP_ROUTES = [
  { path: "/app",              label: "Home",         preset: "default",    theme: "blue",   end: true  },
  { path: "/app/how-it-works", label: "How It Works", preset: "howItWorks", theme: "green",  end: false },
  { path: "/app/pricing",      label: "Pricing",      preset: "pricing",    theme: "purple", end: false },
  { path: "/app/sign-in",      label: "Sign In",      preset: "signIn",     theme: "teal",   end: false },
  { path: "/app/get-started",  label: "Get Started",  preset: "getStarted", theme: "amber",  end: false },
] as const

export type AppRouteDef = (typeof APP_ROUTES)[number]

export const ROUTE_BY_PATH = Object.fromEntries(
  APP_ROUTES.map((r) => [r.path, r])
) as Record<string, AppRouteDef>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/routes.ts
git commit -m "feat(theme): add theme field to each APP_ROUTES entry"
```

---

## Task 4: Update appMachine.types.ts

**Files:**
- Modify: `apps/web/src/pages/app/machine/appMachine.types.ts`

- [ ] **Step 1: Add SectionTheme import and currentTheme field**

Replace the entire file with:

```typescript
import type { Session } from "@supabase/supabase-js"
import type { AnyActorRef } from "xstate"
import type { SectionTheme } from "@/data/section-themes"

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
  currentTheme: SectionTheme
  spiritActorRef: AnyActorRef | null
}

export type AppEvent =
  | { type: "AUTH_STATE_CHANGED"; session: Session | null }
  | { type: "SIGN_OUT" }
  | { type: "ROUTE_CHANGED"; pathname: string }
  | { type: "SPIRIT_READY" }
  | { type: "REGISTER_SPIRIT"; actorRef: AnyActorRef }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/machine/appMachine.types.ts
git commit -m "feat(theme): add currentTheme: SectionTheme to AppContext"
```

---

## Task 5: Update appMachine.ts

**Files:**
- Modify: `apps/web/src/pages/app/machine/appMachine.ts`

- [ ] **Step 1: Replace the entire file**

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
import { ROUTE_BY_PATH } from "@/pages/app/routes"
import { AUDIO } from "@/data/spirit-presets"
import { THEMES, DEFAULT_THEME } from "@/data/section-themes"

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
    setCurrentTheme: assign(({ event }) => {
      const e = event as Extract<AppEvent, { type: "ROUTE_CHANGED" }>
      const themeName = ROUTE_BY_PATH[e.pathname]?.theme ?? "blue"
      return { currentTheme: THEMES[themeName] ?? DEFAULT_THEME }
    }),
    registerSpirit: assign(({ event }) => ({
      spiritActorRef: (event as Extract<AppEvent, { type: "REGISTER_SPIRIT" }>).actorRef,
    })),
    sendRouteToSpirit: ({ context, event }) => {
      const e = event as Extract<AppEvent, { type: "ROUTE_CHANGED" }>
      const routeDef = ROUTE_BY_PATH[e.pathname]
      const preset = routeDef?.preset ?? "default"
      const themeName = routeDef?.theme ?? "blue"
      const theme = THEMES[themeName] ?? DEFAULT_THEME
      context.spiritActorRef?.send({
        type: "SET_PRESET",
        name: preset,
        color1: theme.dark,
        color2: theme.mid,
      })
    },
    playNavSfx: ({ context }) => {
      context.spiritActorRef?.send({ type: "PLAY_SFX", name: AUDIO.nav })
    },
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
    currentTheme: DEFAULT_THEME,
    spiritActorRef: null,
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

    // ── View ─────────────────────────────────────────────────────
    // Starts in 'loading' — blocks the overlay until SPIRIT_READY fires.
    // ROUTE_CHANGED in loading: record route + forward preset (no SFX yet).
    // ROUTE_CHANGED in active: record route + forward preset + play nav SFX.
    view: {
      initial: "loading",
      states: {
        loading: {
          on: {
            SPIRIT_READY:  { target: "active" },
            ROUTE_CHANGED: { actions: ["setRoute", "setCurrentTheme", "sendRouteToSpirit"] },
          },
        },
        active: {
          on: {
            ROUTE_CHANGED: { actions: ["setRoute", "setCurrentTheme", "sendRouteToSpirit", "playNavSfx"] },
          },
        },
      },
    },
  },
  on: {
    REGISTER_SPIRIT: { actions: "registerSpirit" },
  },
})

export type AppMachineSnapshot = ReturnType<typeof appMachine.transition>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/machine/appMachine.ts
git commit -m "feat(theme): setCurrentTheme action + rename forwardPreset→sendRouteToSpirit with theme color overrides"
```

---

## Task 6: Extend SET_PRESET event in spiritMachine.types.ts

**Files:**
- Modify: `apps/web/src/lib/spirit/spiritMachine.types.ts`

- [ ] **Step 1: Add color1/color2 to SET_PRESET**

Change only the `SET_PRESET` line in the `SpiritEvent` union. Replace:

```typescript
  | { type: "SET_PRESET";    name: string; durationMs?: number }
```

With:

```typescript
  | { type: "SET_PRESET";    name: string; durationMs?: number; color1?: string; color2?: string }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/spirit/spiritMachine.types.ts
git commit -m "feat(theme): extend SET_PRESET event with optional color1/color2 overrides"
```

---

## Task 7: Update applyPreset in spiritMachine.ts

**Files:**
- Modify: `apps/web/src/lib/spirit/spiritMachine.ts`

- [ ] **Step 1: Update applyPreset to use theme color overrides**

Find the `applyPreset` action (currently lines 36–43) and replace it with:

```typescript
      applyPreset: assign(({ context, event }) => {
        const e = event as Extract<SpiritEvent, { type: "SET_PRESET" }>
        const base = PRESETS[e.name]
        const to: SpiritPreset = {
          ...base,
          color1: e.color1 ?? base.color1,
          color2: e.color2 ?? base.color2,
        }
        const from = context.currentPreset
        const durationMs = e.durationMs ?? 1400
        eng()?.setVisualTarget(from, to, durationMs)
        return { fromPreset: from, toPreset: to, visualDurationMs: durationMs }
      }),
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/spirit/spiritMachine.ts
git commit -m "feat(theme): applyPreset uses e.color1/color2 overrides, falls back to preset colors"
```

---

## Task 8: Update AppPageShell.tsx

**Files:**
- Modify: `apps/web/src/pages/app/AppPageShell.tsx`

- [ ] **Step 1: Read currentTheme.light from appMachine context**

Replace the entire file with:

```typescript
// apps/web/src/pages/app/AppPageShell.tsx
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

interface AppPageShellProps {
  title: string
  descriptor: string
  children?: React.ReactNode
}

export function AppPageShell({ title, descriptor, children }: AppPageShellProps) {
  const themeLight = useAppMachine((s) => s.context.currentTheme.light)

  return (
    <div className="min-h-full flex flex-col pb-32 select-none">
      {/* Ghost title — upper zone, clears top controls (mute button / hamburger) */}
      <div className="pt-20 md:pt-16 text-center px-8">
        <h1
          className="uppercase leading-none pointer-events-none"
          style={{
            color: themeLight,
            fontSize: 'clamp(2.5rem, 8vw, 7rem)',
            letterSpacing: '0.25em',
            fontFamily: "'Jost', sans-serif",
            fontWeight: 200,
          }}
        >
          {title}
        </h1>
        <p
          className="mt-4 uppercase"
          style={{
            color: 'rgba(255, 255, 255, 0.35)',
            fontSize: '0.65rem',
            letterSpacing: '0.4em',
          }}
        >
          {descriptor}
        </p>
      </div>

      {/* Content area — grows below the header */}
      {children && (
        <div className="mt-12 flex-1 px-8">
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/AppPageShell.tsx
git commit -m "feat(theme): AppPageShell reads currentTheme.light from appMachine context"
```

---

## Task 9: Update AppHomePage.tsx

**Files:**
- Modify: `apps/web/src/pages/app/AppHomePage.tsx`

- [ ] **Step 1: Read currentTheme.light from appMachine context**

Replace the entire file with:

```typescript
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

export function AppHomePage() {
  const themeLight = useAppMachine((s) => s.context.currentTheme.light)

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-8 select-none">
      <div className="flex flex-col items-center text-center">
        <h1
          className="uppercase leading-none"
          style={{ color: themeLight, fontSize: 'clamp(1.8rem, 7vw, 9rem)', letterSpacing: '0.25em', fontFamily: "'Jost', sans-serif", fontWeight: 200 }}
        >
          Front Desk
        </h1>
        <p
          className="mt-5 uppercase text-white/50"
          style={{ fontSize: 'clamp(0.65rem, 2vw, 1rem)', letterSpacing: '0.5em' }}
        >
          AI Receptionist &nbsp;·&nbsp; By Neuvetra
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/app/AppHomePage.tsx
git commit -m "feat(theme): AppHomePage reads currentTheme.light — replaces hardcoded #668a93"
```

---

## Task 10: Run E2E tests

- [ ] **Step 1: Run the new theme tests**

```bash
cd apps/web && bun run test:e2e --grep "section theme colors"
```

Expected: All 4 tests PASS.

- [ ] **Step 2: Run the full existing app-suite to confirm no regressions**

```bash
cd apps/web && bun run test:e2e --grep "app-route|app-navigation|app-mobile-menu|app-how-it-works"
```

Expected: All tests PASS. (h1 text content tests are unchanged; color is different but those tests only check text.)

---

## Task 11: Run build

- [ ] **Step 1: TypeScript build**

```bash
cd apps/web && bun run build
```

Expected: Exit 0, no TypeScript errors.

- [ ] **Step 2: Commit task file update**

```bash
git add tasks/47-section-theme-system.md
git commit -m "chore: mark task 47 done"
```

Update the task file frontmatter to `status: done` before committing.

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| `section-themes.ts` is authority | Task 2 |
| Three shades per theme (dark/mid/light) | Task 2 |
| appMachine stores `currentTheme` in context | Tasks 4 + 5 |
| Routes without theme fall back to DEFAULT_THEME | Task 5 (`?? DEFAULT_THEME`) |
| Spirit receives enriched SET_PRESET with color1/color2 | Tasks 5 + 6 + 7 |
| AppPageShell reads `currentTheme.light` | Task 8 |
| AppHomePage reads `currentTheme.light` | Task 9 |
| One hex change updates both Spirit AND ghost title | Architectural — fulfilled by Tasks 2+5+7+8+9 |
| Existing E2E tests still pass | Task 10 step 2 |
| `bun run build` exits 0 | Task 11 |

### No placeholders — all code is complete.

### Type consistency check:
- `SectionTheme` defined in Task 2, imported in Tasks 4 and 5 ✓
- `THEMES`, `DEFAULT_THEME` defined in Task 2, imported in Task 5 ✓
- `SET_PRESET` event extended in Task 6, consumed in Task 5 and Task 7 ✓
- `currentTheme` added to AppContext in Task 4, set in Task 5, read in Tasks 8 + 9 ✓
- `sendRouteToSpirit` (not `forwardPreset`) used consistently in Task 5 ✓
