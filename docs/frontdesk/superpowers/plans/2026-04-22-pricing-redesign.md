# Pricing Section Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `Pricing.tsx` with a dark `bg-foreground` background, custom sliding billing toggle, rectangular glassmorphism cards with violet accent, and an enterprise bar.

**Architecture:** Two-file change only. First update `PRICING_TIERS` constants with new fields (`annualPrice`, `goodFor`, corrected overage). Then fully rewrite `Pricing.tsx` as a self-contained component — no new files, no new dependencies.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite

---

### Task 1: Update PRICING_TIERS constants

**Files:**
- Modify: `apps/web/src/contexts/constants/landing.ts`

- [ ] Replace the `PRICING_TIERS` export with the updated version below

```ts
export const PRICING_TIERS = [
  {
    name: "Starter",
    description: "For solo operators just getting started.",
    monthlyPrice: 49,
    annualPrice: 39,
    minutes: 200,
    overageRate: "0.20",
    popular: false,
    goodFor: "Solo operators who need AI coverage after hours with no secretary on staff.",
    features: [
      "200 minutes / month (~100 calls)",
      "1 local phone number",
      "Appointment booking to your calendar",
      "Call transcripts & summaries",
      "SMS alerts for urgent calls",
      "Dashboard access",
      "Email support",
    ],
  },
  {
    name: "Growth",
    description: "For active businesses with steady call volume.",
    monthlyPrice: 99,
    annualPrice: 79,
    minutes: 500,
    overageRate: "0.18",
    popular: true,
    goodFor: "Businesses ready for a dedicated AI line that handles every call, all day long.",
    features: [
      "500 minutes / month (~250 calls)",
      "1 local phone number",
      "Full-day AI coverage, including business hours",
      "Appointment booking to your calendar",
      "Call transcripts & summaries",
      "SMS alerts for urgent calls",
      "Custom AI knowledge base",
      "Dashboard access",
      "Priority email support",
    ],
  },
  {
    name: "Pro",
    description: "For high-volume businesses.",
    monthlyPrice: 199,
    annualPrice: 159,
    minutes: 1000,
    overageRate: "0.16",
    popular: false,
    goodFor: "High-volume businesses that want hands-on setup, personal training, and priority access when they need it.",
    features: [
      "1,000 minutes / month (~500 calls)",
      "1 local phone number",
      "Full-day AI coverage, including business hours",
      "Appointment booking to your calendar",
      "Call transcripts & summaries",
      "SMS alerts for urgent calls",
      "Custom AI knowledge base",
      "Early access to Insights & Scheduler",
      "Personalized AI training and setup call",
      "Priority support via phone and email",
    ],
  },
]
```

- [ ] Commit

```bash
git add apps/web/src/contexts/constants/landing.ts
git commit -m "feat(pricing): update PRICING_TIERS — annualPrice, goodFor, overage rates, Pro features"
```

---

### Task 2: Write failing Playwright test

**Files:**
- Create: `apps/web/tests/pricing.spec.ts`

- [ ] Create the file

```ts
import { test, expect } from '@playwright/test'

test.describe('Pricing section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders three pricing cards', async ({ page }) => {
    const cards = page.locator('#pricing .plan-card')
    await expect(cards).toHaveCount(3)
  })

  test('shows monthly prices by default', async ({ page }) => {
    const section = page.locator('#pricing')
    await expect(section.getByText('49')).toBeVisible()
    await expect(section.getByText('99')).toBeVisible()
    await expect(section.getByText('199')).toBeVisible()
  })

  test('switches to annual prices when Annual tab is clicked', async ({ page }) => {
    await page.locator('#pricing').getByText('Annual').click()
    const section = page.locator('#pricing')
    await expect(section.getByText('39')).toBeVisible()
    await expect(section.getByText('79')).toBeVisible()
    await expect(section.getByText('159')).toBeVisible()
  })

  test('shows enterprise bar', async ({ page }) => {
    await expect(
      page.locator('#pricing').getByText('Replacing a call center')
    ).toBeVisible()
  })

  test('start free trial CTA links to /signup', async ({ page }) => {
    const cta = page.locator('#pricing a[href="/signup"]')
    await expect(cta).toBeVisible()
  })
})
```

- [ ] Run to confirm it fails

```bash
cd apps/web && bun run test:e2e --grep "Pricing section"
```

Expected: FAIL — current `Pricing.tsx` has no `.plan-card` elements and different structure.

---

### Task 3: Rewrite Pricing.tsx

**Files:**
- Modify: `apps/web/src/components/landing/Pricing.tsx`

- [ ] Replace the entire file

```tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { Container } from "@/components/layout/Container"
import { PRICING_TIERS } from "@/contexts/constants/landing"

export function Pricing() {
  const [annual, setAnnual] = useState(false)
  const monthlyRef = useRef<HTMLButtonElement>(null)
  const annualRef  = useRef<HTMLButtonElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const tab = annual ? annualRef.current : monthlyRef.current
    if (!tab) return
    setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth })
  }, [annual])

  return (
    <section id="pricing" className="bg-foreground py-24 md:py-32">
      <Container>

        {/* ── Header — structure preserved from original, tokens updated for dark bg ── */}
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
            Pricing
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-background md:text-5xl">
            Simple, transparent pricing.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-background/60">
            Start free for 7 days. Your card won't be charged until day 8. Cancel any time.
          </p>

          {/* ── Billing toggle ── */}
          <div className="mt-8 flex justify-center">
            <div className="relative inline-flex items-center">
              <button
                ref={monthlyRef}
                onClick={() => setAnnual(false)}
                className={`relative z-10 px-5 py-2.5 text-[11px] font-light tracking-[.18em] uppercase transition-colors cursor-pointer bg-transparent border-0 ${
                  !annual ? "text-background/90" : "text-background/30 hover:text-background/55"
                }`}
              >
                Monthly
              </button>
              <button
                ref={annualRef}
                onClick={() => setAnnual(true)}
                className={`relative z-10 px-5 py-2.5 text-[11px] font-light tracking-[.18em] uppercase transition-colors cursor-pointer bg-transparent border-0 ${
                  annual ? "text-background/90" : "text-background/30 hover:text-background/55"
                }`}
              >
                Annual
                <span className="relative ml-0.5 -top-1.5 text-[9px] font-extralight tracking-[.06em] text-violet-400">
                  −20%
                </span>
              </button>
              {/* sliding rectangle — no border-radius, purple bottom border */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none border-b border-violet-500/35 bg-background/[1.5]"
                style={{
                  left: indicator.left,
                  width: indicator.width,
                  transition: "left 250ms cubic-bezier(0.4,0,0.2,1), width 250ms cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Cards grid ── */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3 items-stretch">
          {PRICING_TIERS.map((tier) => {
            const price = annual ? tier.annualPrice : tier.monthlyPrice
            const overageCents = Math.round(parseFloat(tier.overageRate) * 100)

            return (
              <div
                key={tier.name}
                className={`plan-card relative flex flex-col p-7 ${
                  tier.popular
                    ? "order-first md:order-none border border-violet-500/20 bg-violet-500/3"
                    : "border border-background/10 bg-background/[1.5]"
                }`}
              >
                {/* Plan name */}
                <p className={`text-[11px] font-semibold tracking-[.14em] uppercase mb-5 ${
                  tier.popular ? "text-violet-200/70" : "text-background/45"
                }`}>
                  {tier.name}
                </p>

                {/* Price — dollar, amount, /month all on one line */}
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-base font-light self-start mt-2 ${
                    tier.popular ? "text-violet-200/45" : "text-background/40"
                  }`}>
                    $
                  </span>
                  <span className="text-[52px] font-light tracking-tight text-background leading-none"
                    style={{ transition: "opacity 150ms" }}>
                    {price}
                  </span>
                  <span className={`text-xs font-light self-end pb-1.5 ${
                    tier.popular ? "text-violet-200/30" : "text-background/30"
                  }`}>
                    /month
                  </span>
                </div>

                {/* Divider */}
                <div className={`h-px mb-5 ${
                  tier.popular ? "bg-violet-500/12" : "bg-background/7"
                }`} />

                {/* Features */}
                <ul className="flex flex-col gap-2.5 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className={`text-xs leading-snug pl-3 relative ${
                      tier.popular ? "text-background/55" : "text-background/45"
                    }`}>
                      <span className={`absolute left-0 top-0.5 text-[9px] ${
                        tier.popular ? "text-violet-400/40" : "text-background/18"
                      }`}>—</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Overage */}
                <p className={`text-[10px] mt-4 ${
                  tier.popular ? "text-violet-200/20" : "text-background/20"
                }`}>
                  Overage: {overageCents}¢ / min after {tier.minutes.toLocaleString()} min
                </p>

                {/* Good for */}
                <div className={`mt-5 pt-4 border-t ${
                  tier.popular ? "border-violet-500/10" : "border-background/5"
                }`}>
                  <p className={`text-[9px] font-semibold tracking-[.14em] uppercase mb-1.5 ${
                    tier.popular ? "text-violet-200/20" : "text-background/20"
                  }`}>
                    Good for
                  </p>
                  <p className={`text-[11px] leading-relaxed ${
                    tier.popular ? "text-violet-200/35" : "text-background/35"
                  }`}>
                    {tier.goodFor}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Enterprise bar ── */}
        <div className="mt-4 flex flex-col gap-4 border border-background/6 bg-background/1 px-8 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[.14em] uppercase text-background/30 mb-1">
              Enterprise
            </p>
            <p className="text-[15px] font-normal text-background/70">
              Replacing a call center? Let's build something custom.
            </p>
            <p className="text-xs text-background/30 mt-0.5">
              Custom minutes, dedicated infrastructure, white-glove onboarding.
            </p>
          </div>
          <a
            href="mailto:hello@neuvetra.com"
            className="shrink-0 text-[11px] font-light tracking-[.08em] uppercase text-violet-300/70 border-b border-violet-500/30 pb-px hover:text-violet-200 hover:border-violet-500/60 transition-colors"
          >
            Contact us →
          </a>
        </div>

        {/* ── Single CTA ── */}
        <div className="mt-10 flex justify-center">
          <a
            href="/signup"
            className="px-8 py-3.5 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors"
          >
            Start free trial
          </a>
        </div>

        {/* ── Footer note ── */}
        <p className="mt-10 text-center text-sm text-background/35">
          All plans include 1 dedicated local number, call transcripts, SMS alerts, and full dashboard access.
          <br />
          Need more?{" "}
          <a href="mailto:hello@neuvetra.com" className="text-violet-400 hover:underline">
            Contact us
          </a>{" "}
          for custom volume pricing.
        </p>

      </Container>
    </section>
  )
}
```

- [ ] Run the Playwright tests

```bash
cd apps/web && bun run test:e2e --grep "Pricing section"
```

Expected: all 5 tests PASS.

- [ ] Run the build to verify no TypeScript errors

```bash
cd apps/web && bun run build
```

Expected: clean build, no errors.

- [ ] Commit

```bash
git add apps/web/src/components/landing/Pricing.tsx
git commit -m "feat(pricing): redesign — dark bg, custom toggle, glassmorphism cards, enterprise bar"
```

---

### Task 4: Create task file

**Files:**
- Create: `tasks/46-pricing-redesign.md`

- [ ] Create the file

```markdown
---
status: done
---
# Task 46: Pricing Section Redesign

## What was done
- Changed section background from bg-muted to bg-foreground (matches HowItWorks)
- Replaced shadcn ToggleGroup with custom sliding-indicator tab toggle
- Rectangular cards, no border-radius anywhere, violet accent on popular (Growth)
- Card layout: plan name, price inline with /month, feature list, overage, good-for note
- Enterprise bar below cards grid
- Single CTA button, uppercase thin style matching toggle tabs
- Updated PRICING_TIERS: annualPrice, goodFor, Growth overage 0.17 to 0.18, Pro features updated

## Key decisions
- No border-radius (design rule for this section)
- Violet accent used instead of primary green to differentiate pricing section visually
- Growth differentiated only by subtle violet tint, no badge or elevation
- Header structure preserved exactly from original; only color tokens updated for dark background
```

- [ ] Commit

```bash
git add tasks/46-pricing-redesign.md
git commit -m "chore: add task 46 pricing redesign"
```
