# /app How It Works — Content, Layout & Scroll Architecture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the `/app` shell a scrollable page architecture, upgrade the bottom nav legibility, build the How It Works section with staggered Framer Motion content reveal, and update all other non-home sections to use the new ghost-title layout shell.

**Architecture:** A new `AppPageShell` component owns the ghost title + descriptor + scrollable content slot for every non-home `/app` page. `AnimatedOutlet` in `AppLayout` gains `overflow-y-auto` to be the scroll container. Home (`AppHomePage`) is left entirely untouched. All How It Works content comes from the existing `HOW_IT_WORKS` constant in `contexts/constants/landing.ts` — no new copy needed.

**Tech Stack:** React 19 + TypeScript + Framer Motion + Tailwind v4 + Playwright E2E

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `apps/web/src/pages/app/AppPageShell.tsx` | Ghost title + descriptor + scrollable content slot |
| Modify | `apps/web/src/components/layout/AppLayout.tsx` | Outlet gets `overflow-y-auto`; nav font/gap bump |
| Rewrite | `apps/web/src/pages/app/AppHowItWorksPage.tsx` | Full implementation with stagger animation |
| Rewrite | `apps/web/src/pages/app/AppPricingPage.tsx` | Adopt AppPageShell, placeholder body |
| Rewrite | `apps/web/src/pages/app/AppSignInPage.tsx` | Adopt AppPageShell, placeholder body |
| Rewrite | `apps/web/src/pages/app/AppGetStartedPage.tsx` | Adopt AppPageShell, placeholder body |
| Create | `apps/web/tests/app-how-it-works.spec.ts` | E2E tests for the new section |

---

## Task 1: Write the failing E2E test

**Files:**
- Create: `apps/web/tests/app-how-it-works.spec.ts`

- [ ] **Step 1: Create the test file**

```ts
// apps/web/tests/app-how-it-works.spec.ts
import { test, expect } from "@playwright/test"

test.describe("/app/how-it-works", () => {
  test("shows ghost title heading", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toContainText("How It Works")
  })

  test("shows descriptor line", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.getByText(/live in under 10 minutes/i)).toBeVisible()
  })

  test("shows all 4 step titles", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.getByText("Create your account")).toBeVisible()
    await expect(page.getByText("Tell us about your business")).toBeVisible()
    await expect(page.getByText("Set up call forwarding")).toBeVisible()
    await expect(page.getByText("Go live")).toBeVisible()
  })

  test("bottom nav is visible with content present", async ({ page }) => {
    await page.goto("/app/how-it-works")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.getByText("Create your account")).toBeVisible()
    // Nav must remain visible — it's always-on-top
    await expect(page.locator("nav")).toBeVisible()
  })

  test("Home page is pixel-identical — still shows Front Desk centered", async ({ page }) => {
    await page.goto("/app")
    await expect(page.locator("nav")).toBeVisible()
    await expect(page.locator("h1")).toContainText("Front Desk")
    // Home must NOT have the ghost-title layout descriptor
    await expect(page.getByText(/live in under 10 minutes/i)).not.toBeAttached()
  })
})

test.describe("/app non-home shells", () => {
  const SHELLS = [
    { path: "/app/pricing",      titleText: "Pricing" },
    { path: "/app/sign-in",      titleText: "Sign In" },
    { path: "/app/get-started",  titleText: "Get Started" },
  ]

  for (const { path, titleText } of SHELLS) {
    test(`${path} shows ghost title with correct text`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator("nav")).toBeVisible()
      await expect(page.locator("h1")).toContainText(titleText)
    })
  }
})
```

- [ ] **Step 2: Run the tests to confirm they all fail**

```bash
cd apps/web && bun run test:e2e --grep "how-it-works|non-home"
```

Expected: all tests FAIL — the pages still show "coming soon" centered stubs, not the new layout.

---

## Task 2: Create AppPageShell

**Files:**
- Create: `apps/web/src/pages/app/AppPageShell.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/pages/app/AppPageShell.tsx
interface AppPageShellProps {
  title: string
  descriptor: string
  children?: React.ReactNode
}

export function AppPageShell({ title, descriptor, children }: AppPageShellProps) {
  return (
    <div className="min-h-full flex flex-col pb-32 select-none">
      {/* Ghost title — upper zone, clears top controls */}
      <div className="pt-20 md:pt-16 text-center px-8">
        <h1
          className="uppercase leading-none pointer-events-none"
          style={{
            color: 'rgba(102, 138, 147, 0.2)',
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

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd apps/web && bun run build 2>&1 | head -30
```

Expected: no errors from the new file (it's not imported anywhere yet so no build impact).

---

## Task 3: Enable overflow scroll in AnimatedOutlet + bump nav sizing

**Files:**
- Modify: `apps/web/src/components/layout/AppLayout.tsx`

Two changes in one file, one commit.

- [ ] **Step 1: Add `overflow-y-auto` to the AnimatedOutlet motion div**

Find this block in `AppLayout.tsx` (around line 31):

```tsx
      <motion.div
        key={location.pathname}
        initial={SLIDE.initial}
        animate={SLIDE.animate}
        exit={SLIDE.exit}
        transition={SLIDE.transition}
        className="absolute inset-0 z-10"
      >
```

Change `className` to:

```tsx
        className="absolute inset-0 z-10 overflow-y-auto"
```

- [ ] **Step 2: Bump bottom nav font size and gap**

Find this block (around line 177):

```tsx
      <nav
        className="absolute left-0 right-0 z-50 hidden md:flex flex-wrap items-center justify-center gap-x-10 gap-y-3 select-none"
        style={{ bottom: "max(2.5rem, env(safe-area-inset-bottom, 2.5rem))" }}
      >
```

Change `gap-x-10` → `gap-x-14` and update `NavItem` (around line 54):

```tsx
      className="text-[0.8rem] uppercase tracking-[0.2em]"
```

The full updated `NavItem` className line (the only change):
```tsx
      className="text-[0.8rem] uppercase tracking-[0.2em]"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/AppLayout.tsx
git commit -m "feat(app): enable overflow scroll on outlet, bump bottom nav font + spacing"
```

---

## Task 4: Implement AppHowItWorksPage

**Files:**
- Rewrite: `apps/web/src/pages/app/AppHowItWorksPage.tsx`

- [ ] **Step 1: Rewrite the page**

```tsx
// apps/web/src/pages/app/AppHowItWorksPage.tsx
import { motion } from "framer-motion"
import { AppPageShell } from "./AppPageShell"
import { HOW_IT_WORKS } from "@/contexts/constants/landing"

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
}

export function AppHowItWorksPage() {
  return (
    <AppPageShell title="How It Works" descriptor="Live in under 10 minutes">
      <motion.ol
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col max-w-md mx-auto w-full"
        style={{ gap: '0' }}
      >
        {HOW_IT_WORKS.map((step, index) => (
          <motion.li
            key={step.step}
            variants={itemVariants}
            className="flex gap-6 items-start py-5"
            style={{
              borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Step number */}
            <span
              className="shrink-0 w-7 text-right pt-px"
              style={{
                color: 'rgba(255,255,255,0.18)',
                fontSize: '0.7rem',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 200,
                letterSpacing: '0.05em',
              }}
            >
              {step.step}
            </span>

            {/* Step content */}
            <div className="flex flex-col gap-1.5">
              <h3
                className="uppercase"
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.18em',
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 300,
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  color: 'rgba(255,255,255,0.38)',
                  fontSize: '0.75rem',
                  lineHeight: '1.75',
                  fontWeight: 300,
                  maxWidth: '26rem',
                }}
              >
                {step.description}
              </p>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </AppPageShell>
  )
}
```

- [ ] **Step 2: Run the How It Works tests — they should now pass**

```bash
cd apps/web && bun run test:e2e --grep "how-it-works"
```

Expected: all 5 "how-it-works" tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/app/AppHowItWorksPage.tsx apps/web/src/pages/app/AppPageShell.tsx
git commit -m "feat(app): implement How It Works page with ghost title and staggered steps"
```

---

## Task 5: Update placeholder pages to use AppPageShell

**Files:**
- Rewrite: `apps/web/src/pages/app/AppPricingPage.tsx`
- Rewrite: `apps/web/src/pages/app/AppSignInPage.tsx`
- Rewrite: `apps/web/src/pages/app/AppGetStartedPage.tsx`

- [ ] **Step 1: Rewrite AppPricingPage**

```tsx
// apps/web/src/pages/app/AppPricingPage.tsx
import { AppPageShell } from "./AppPageShell"

export function AppPricingPage() {
  return (
    <AppPageShell title="Pricing" descriptor="Starter · Growth · Pro">
      <div className="flex items-center justify-center py-12">
        <p
          className="uppercase"
          style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', letterSpacing: '0.35em' }}
        >
          Coming soon
        </p>
      </div>
    </AppPageShell>
  )
}
```

- [ ] **Step 2: Rewrite AppSignInPage**

```tsx
// apps/web/src/pages/app/AppSignInPage.tsx
import { AppPageShell } from "./AppPageShell"

export function AppSignInPage() {
  return (
    <AppPageShell title="Sign In" descriptor="Welcome back">
      <div className="flex items-center justify-center py-12">
        <p
          className="uppercase"
          style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', letterSpacing: '0.35em' }}
        >
          Coming soon
        </p>
      </div>
    </AppPageShell>
  )
}
```

- [ ] **Step 3: Rewrite AppGetStartedPage**

```tsx
// apps/web/src/pages/app/AppGetStartedPage.tsx
import { AppPageShell } from "./AppPageShell"

export function AppGetStartedPage() {
  return (
    <AppPageShell title="Get Started" descriptor="7-day free trial">
      <div className="flex items-center justify-center py-12">
        <p
          className="uppercase"
          style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', letterSpacing: '0.35em' }}
        >
          Coming soon
        </p>
      </div>
    </AppPageShell>
  )
}
```

- [ ] **Step 4: Run the non-home shell tests**

```bash
cd apps/web && bun run test:e2e --grep "non-home"
```

Expected: all 3 ghost-title shell tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/app/AppPricingPage.tsx apps/web/src/pages/app/AppSignInPage.tsx apps/web/src/pages/app/AppGetStartedPage.tsx
git commit -m "feat(app): adopt AppPageShell for Pricing, Sign In, Get Started placeholders"
```

---

## Task 6: Full test run + build gate

- [ ] **Step 1: Run the full app-related test suite**

```bash
cd apps/web && bun run test:e2e --grep "app-"
```

Also run the new tests:

```bash
cd apps/web && bun run test:e2e apps/web/tests/app-how-it-works.spec.ts
```

Expected: all tests in `app-route.spec.ts`, `app-navigation.spec.ts`, `app-mobile-menu.spec.ts`, and `app-how-it-works.spec.ts` pass. The existing `app-route.spec.ts` test that clicks `h1` still works because Home is untouched.

- [ ] **Step 2: Production build**

```bash
cd apps/web && bun run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Verify visually in the browser**

Navigate to:
- `/app` — Front Desk centered, unchanged
- `/app/how-it-works` — ghost "How It Works" title in upper zone, descriptor "Live in under 10 minutes", 4 steps cascade in
- `/app/pricing` — ghost "Pricing" title, descriptor "Starter · Growth · Pro", "coming soon" placeholder
- Bottom nav — noticeably larger text, more air between items

- [ ] **Step 4: Commit test file**

```bash
git add apps/web/tests/app-how-it-works.spec.ts
git commit -m "test(app): add E2E tests for How It Works section and non-home ghost-title shells"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] All non-home pages adopt ghost title layout → Tasks 2, 4, 5
- [x] AnimatedOutlet supports overflow scrolling → Task 3
- [x] Bottom nav always visible, no content overlap → `pb-32` in AppPageShell + `z-50` nav already above `z-10` outlet
- [x] Bottom nav legibility (font + spacing) → Task 3
- [x] How It Works fully implemented with 4 steps + stagger → Task 4
- [x] Pricing / SignIn / GetStarted as styled shells → Task 5
- [x] Home untouched → `AppHomePage.tsx` not in File Map
- [x] Framer Motion only, no GSAP → no new deps

**Type consistency:**
- `AppPageShell` props: `title: string`, `descriptor: string`, `children?: React.ReactNode` — used consistently in Tasks 4 and 5
- `HOW_IT_WORKS` is typed as `Array<{ step: string; title: string; description: string }>` in landing.ts — `step.step`, `step.title`, `step.description` used in Task 4
- `containerVariants` / `itemVariants` define `hidden` and `show` keys — both used in `initial="hidden" animate="show"` on the motion elements

**Placeholder scan:** No TBDs, no "similar to Task N" references, no missing code blocks.

**Open questions (tune in browser, not blockers):**
- Ghost title opacity is `0.2` — adjust if it competes with or disappears into the particle field
- `pb-32` (128px) bottom padding — adjust if nav height changes
- Ghost title font `clamp(2.5rem, 8vw, 7rem)` on very small mobile screens — verify in DevTools
