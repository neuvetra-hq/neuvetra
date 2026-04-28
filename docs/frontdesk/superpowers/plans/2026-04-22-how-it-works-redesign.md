# How It Works Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder step copy with "Your AI" character-creation framing, add a benefit callout per step, and update the step number visual to ghost-green fading style.

**Architecture:** Two data changes (landing.ts copy + callout field) and one component change (AppHowItWorksPage.tsx descriptor + step number style + callout element). E2E tests updated first per TDD convention.

**Tech Stack:** React, Framer Motion, Playwright (E2E)

---

### Task 1: Update E2E tests with new copy assertions

**Files:**
- Modify: `apps/web/tests/app-how-it-works.spec.ts`

- [ ] **Step 1: Update descriptor test**

Replace line 14 (old descriptor assertion):

```ts
// Before
await expect(page.getByText(/live in under 10 minutes/i)).toBeVisible()

// After
await expect(page.getByText(/your ai\. ready in minutes\./i)).toBeVisible()
```

- [ ] **Step 2: Update step title tests**

Replace lines 19–23 (old step title assertions):

```ts
// Before
await expect(page.getByText("Create your account")).toBeVisible()
await expect(page.getByText("Tell us about your business")).toBeVisible()
await expect(page.getByText("Set up call forwarding")).toBeVisible()
await expect(page.getByText("Go live")).toBeVisible()

// After
await expect(page.getByText("Start with your phone number")).toBeVisible()
await expect(page.getByText("Design your AI")).toBeVisible()
await expect(page.getByText("Pick your AI's number")).toBeVisible()
await expect(page.getByText("Call it. Then let it work.")).toBeVisible()
```

- [ ] **Step 3: Update bottom nav test**

Replace line 29 (old step title used as presence check):

```ts
// Before
await expect(page.getByText("Create your account")).toBeVisible()

// After
await expect(page.getByText("Start with your phone number")).toBeVisible()
```

- [ ] **Step 4: Add callout visibility test**

Add a new test after "shows all 4 step titles":

```ts
test("shows callout line for step 01", async ({ page }) => {
  await page.goto("/app/how-it-works")
  await expect(page.locator("nav")).toBeVisible()
  await expect(page.getByText(/7-day free trial/i)).toBeVisible()
})
```

- [ ] **Step 5: Update "Home page unchanged" test**

The existing assertion on line 37 is still valid (home page doesn't have this descriptor), but the comment should reflect what we're testing. The test body does not need to change — `not.toBeAttached()` for `/live in under 10 minutes/i` on `/app` is still correct since `/app` uses `AppHomePage`, not `AppPageShell` with a descriptor.

No change needed on this test.

- [ ] **Step 6: Run tests to verify they fail**

```bash
cd apps/web && bun run test:e2e --grep "how-it-works"
```

Expected: FAIL — "shows descriptor line", "shows all 4 step titles", "bottom nav is visible", "shows callout line for step 01" should all fail because the implementation hasn't changed yet.

- [ ] **Step 7: Commit failing tests**

```bash
git add apps/web/tests/app-how-it-works.spec.ts
git commit -m "test(how-it-works): update assertions for redesigned copy + callout"
```

---

### Task 2: Update HOW_IT_WORKS data with new copy and callout field

**Files:**
- Modify: `apps/web/src/contexts/constants/landing.ts:103-124`

- [ ] **Step 1: Replace the HOW_IT_WORKS export**

Find the current `HOW_IT_WORKS` block (lines 103–124) and replace with:

```ts
export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Start with your phone number",
    description:
      "That's all we need to get going. Verify with a one-time code — your free trial begins immediately. No credit card, no commitment, no forms to fill out.",
    callout: "7-day free trial · 100 free minutes · no card required",
  },
  {
    step: "02",
    title: "Design your AI",
    description:
      "Give your AI a name. Choose its voice — the one that represents your business. Then train it: your services, your pricing, your hours, exactly how you like things handled. This is your AI — built by you, for you.",
    callout: "Your name, your voice, your rules — edit any time",
  },
  {
    step: "03",
    title: "Pick your AI's number",
    description:
      "Choose a real local number for your AI — one you can advertise, put on your website, or hand to clients directly. Forward missed calls from your existing number, or let clients call your AI's number straight. Either way, your current number stays exactly as it is.",
    callout: "Keep your existing number · your AI gets its own",
  },
  {
    step: "04",
    title: "Call it. Then let it work.",
    description:
      "Dial your AI's number before you go live — hear it handle a call exactly the way your clients will. When you're satisfied, it answers every call, books every appointment, and texts you instantly when something needs your attention. In English and Spanish, around the clock.",
    callout: "24/7 · English & Spanish · instant SMS alerts",
  },
]
```

- [ ] **Step 2: Commit data change**

```bash
git add apps/web/src/contexts/constants/landing.ts
git commit -m "feat(how-it-works): update HOW_IT_WORKS copy — Your AI framing + callout field"
```

---

### Task 3: Update AppHowItWorksPage.tsx — descriptor, ghost step numbers, callout element

**Files:**
- Modify: `apps/web/src/pages/app/AppHowItWorksPage.tsx`

- [ ] **Step 1: Replace the entire component with updated version**

Overwrite `apps/web/src/pages/app/AppHowItWorksPage.tsx` with:

```tsx
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
    <AppPageShell title="How It Works" descriptor="Your AI. Ready in minutes.">
      <motion.ol
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col max-w-md mx-auto w-full"
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
            {/* Step number — ghost green, fades 01→04 */}
            <span
              className="shrink-0 w-14 text-right"
              style={{
                color: `rgba(61,158,96,${0.22 - index * 0.04})`,
                fontSize: '3rem',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 200,
                lineHeight: 1,
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
              <span
                style={{
                  color: 'rgba(61,158,96,0.75)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  marginTop: '2px',
                  display: 'block',
                }}
              >
                ✓ {step.callout}
              </span>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </AppPageShell>
  )
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd apps/web && bun run test:e2e --grep "how-it-works"
```

Expected: all 5 tests PASS — descriptor, step titles, callout line, bottom nav, and home page unchanged.

- [ ] **Step 3: Run build to verify no TS errors**

```bash
cd apps/web && bun run build
```

Expected: exits 0, no TypeScript errors. The `callout` field is a new property on HOW_IT_WORKS items — confirm nothing else reads HOW_IT_WORKS expecting only `step`, `title`, `description` (landing page uses this array too).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/app/AppHowItWorksPage.tsx
git commit -m "feat(how-it-works): ghost-green step numbers, Your AI descriptor, callout lines"
```

---

## Self-Review

**Spec coverage:**
- ✅ Descriptor change: `"Live in under 10 minutes"` → `"Your AI. Ready in minutes."` — Task 3, Step 1
- ✅ `HOW_IT_WORKS` new titles, descriptions, callout strings — Task 2
- ✅ Step number ghost-green fading style (`3rem`, `rgba(61,158,96,${0.22 - index * 0.04})`, `w-14`) — Task 3
- ✅ Callout span per step (green, uppercase, `✓ {step.callout}`) — Task 3
- ✅ E2E test updates: descriptor, all 4 step titles, callout visibility, bottom nav — Task 1
- ✅ Build gate — Task 3, Step 3
- ✅ `AppPageShell.tsx` unchanged per spec — not touched in any task

**Placeholder scan:** No TBDs, no vague steps, all code blocks are complete.

**Type consistency:** `step.callout` used in Task 3 matches the `callout` field added in Task 2. `HOW_IT_WORKS` items gain `callout: string` — no other consumers in the codebase read this field (landing page step section uses the array but only accesses `step`, `title`, `description`).
