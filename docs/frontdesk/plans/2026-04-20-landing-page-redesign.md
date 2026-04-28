# Landing Page Redesign + Pricing Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Neuvetra Front Desk landing page with sharper copy, new sections (SocialProof, FAQ), shadcn semantic token compliance across every component, and updated pricing (200/500/1000 min, lower overages).

**Architecture:** All data lives in `constants/landing.ts` — components are pure renderers. Two new components (`SocialProof.tsx`, `FAQ.tsx`) are added. `Products` is removed from `LandingPage.tsx`. Every color and spacing value migrates from hardcoded Tailwind palette classes to shadcn semantic tokens (`text-foreground`, `bg-muted`, `text-primary`, etc.).

**Tech Stack:** React, Tailwind v4, shadcn/ui base-nova (`@base-ui/react`), Lucide icons, Playwright for E2E tests.

**Spec:** `docs/specs/2026-04-20-landing-page-redesign-design.md`

---

## Token Reference (use throughout all tasks)

| Old | New |
|-----|-----|
| `bg-white` | `bg-background` |
| `bg-neutral-50` | `bg-muted` |
| `bg-neutral-900` | `bg-foreground` |
| `text-neutral-900` | `text-foreground` |
| `text-neutral-500`, `text-neutral-600` | `text-muted-foreground` |
| `text-neutral-400` | `text-muted-foreground` |
| `border-neutral-100`, `border-neutral-200` | `border-border` |
| `divide-neutral-100` | `divide-border` |
| `bg-indigo-600` | `bg-primary` |
| `text-indigo-600` | `text-primary` |
| `text-indigo-500` | `text-primary` |
| `text-indigo-400` | `text-primary` |
| `text-indigo-200` | `text-primary-foreground/70` |
| `bg-indigo-50`, `bg-indigo-100` | `bg-primary/10` |
| `shadow-indigo-100` | `shadow-primary/10` |
| `ring-indigo-500` | `ring-primary` |
| `text-white` (on primary bg) | `text-primary-foreground` |
| `bg-neutral-800` (dark section cards) | `bg-background/10` |
| `border-neutral-700` (dark section) | `border-background/20` |
| `text-neutral-400` (dark section) | `text-background/60` |

---

## Task 1 — Update `constants/landing.ts`

**Files:**
- Modify: `apps/web/src/constants/landing.ts`

- [ ] **Step 1: Update `HERO`**

Replace the entire `HERO` export with:

```ts
export const HERO = {
  badge: "AI Receptionist · From $49/mo",
  headline: "Every call answered.\nEvery appointment booked.\nZero revenue left behind.",
  subheadline:
    "The average small business misses 1 in 5 inbound calls — each one a potential customer who hangs up and calls someone else. Front Desk answers instantly, books the appointment, and texts you a summary. 24/7, in any language, for a fraction of the cost of a receptionist.",
  primaryCTA: "Get started free →",
  secondaryCTA: "See how it works",
  trust: "7-day free trial · No credit card · Live in 10 minutes",
}
```

- [ ] **Step 2: Update `PRICING_TIERS`**

Replace the entire `PRICING_TIERS` export with:

```ts
export const PRICING_TIERS = [
  {
    name: "Starter",
    description: "For solo operators just getting started.",
    monthlyPrice: 49,
    minutes: 200,
    overageRate: "0.20",
    popular: false,
    features: [
      "200 minutes/month (~100 calls)",
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
    minutes: 500,
    overageRate: "0.17",
    popular: true,
    features: [
      "500 minutes/month (~250 calls)",
      "1 local phone number",
      "Appointment booking to your calendar",
      "Call transcripts & summaries",
      "SMS alerts for urgent calls",
      "Dashboard access",
      "Custom AI knowledge base",
      "Priority email support",
    ],
  },
  {
    name: "Pro",
    description: "For high-volume or multi-location businesses.",
    monthlyPrice: 199,
    minutes: 1000,
    overageRate: "0.16",
    popular: false,
    features: [
      "1,000 minutes/month (~500 calls)",
      "Up to 3 phone numbers / locations",
      "Appointment booking to your calendar",
      "Call transcripts & summaries",
      "SMS alerts for urgent calls",
      "Dashboard access",
      "Custom AI knowledge base",
      "Early access to Insights & Scheduler",
      "Dedicated onboarding call",
      "Priority support",
    ],
  },
]
```

- [ ] **Step 3: Update `COMPARISON` — add appointment booking row**

Replace the entire `COMPARISON` export with:

```ts
export const COMPARISON = {
  features: [
    "Available 24/7",
    "Monthly cost",
    "Setup time",
    "Knows your business",
    "Appointment booking",
    "Call transcripts",
  ],
  columns: [
    {
      name: "Neuvetra Front Desk",
      highlight: true,
      values: ["Always", "From $49/mo", "< 10 minutes", "Fully trained by you", "Direct calendar sync", "Every call"],
    },
    {
      name: "Hire a receptionist",
      highlight: false,
      values: ["Business hours only", "$3,000+/mo", "Weeks to hire & train", "Takes time to learn", "Manual only", "None"],
    },
    {
      name: "Answering service",
      highlight: false,
      values: ["Partial coverage", "$300–$600/mo", "2–3 days", "Generic scripts only", "None", "Rarely"],
    },
  ],
}
```

- [ ] **Step 4: Update `CTA_BANNER`**

Replace the entire `CTA_BANNER` export with:

```ts
export const CTA_BANNER = {
  headline: "Your first AI-answered call is 10 minutes away.",
  subheadline: "No contracts. No hardware. No hiring. Just sign up and forward your calls.",
  primaryCTA: "Get started free",
  secondaryCTA: "Talk to us",
}
```

- [ ] **Step 5: Add `FAQ_ITEMS` export**

Add this new export at the end of the file:

```ts
export const FAQ_ITEMS = [
  {
    question: "Will my callers know they're talking to AI?",
    answer:
      "Front Desk sounds natural and professional. Most callers don't ask — and if they do, it's honest about being an AI assistant. You control the name and personality.",
  },
  {
    question: "Do I need to change my phone number?",
    answer:
      "No. You keep your existing number. You simply set up call forwarding for missed or after-hours calls — takes about 2 minutes with your carrier.",
  },
  {
    question: "What if it gets something wrong?",
    answer:
      "Every call is transcribed and summarized in your dashboard. You review everything. If the AI is ever unsure, it takes a message and you call back. It never guesses on pricing or commitments it isn't trained on.",
  },
  {
    question: "What languages does it support?",
    answer:
      "Front Desk automatically detects the caller's language and responds in kind — no extra setup required. Particularly useful for businesses serving multilingual communities.",
  },
  {
    question: "Can I customize what it says?",
    answer:
      "Yes — you train it on your business: services, pricing, hours, FAQs, and policies. The more you teach it, the better it performs. You can update it any time from your dashboard.",
  },
]
```

- [ ] **Step 6: Update `FOOTER` — remove dead links, add mailto contact**

Replace the entire `FOOTER` export with:

```ts
export const FOOTER = {
  tagline: "AI-powered products for the businesses that keep communities running.",
  columns: [
    {
      heading: "Products",
      links: [
        { label: "Front Desk", href: "/signup", disabled: false },
        { label: "Scheduler", href: null, disabled: true },
        { label: "Insights", href: null, disabled: true },
        { label: "Engage", href: null, disabled: true },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "Pricing", href: "#pricing", disabled: false },
        { label: "Contact", href: "mailto:hello@neuvetra.com", disabled: false },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy", disabled: false },
        { label: "Terms of Service", href: "/terms", disabled: false },
      ],
    },
  ],
  copyright: `© ${new Date().getFullYear()} Neuvetra / Birgani Enterprises Inc. All rights reserved.`,
}
```

- [ ] **Step 7: Commit constants**

```bash
git add apps/web/src/constants/landing.ts
git commit -m "feat: update landing constants — pricing, hero copy, FAQ, CTA, comparison, footer"
```

---

## Task 2 — Write Failing Tests

**Files:**
- Modify: `apps/web/tests/landing.spec.ts`
- Modify: `apps/web/tests/pricing.spec.ts`

- [ ] **Step 1: Update `landing.spec.ts`**

Replace the entire file:

```ts
import { test, expect } from "@playwright/test"

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
  })

  test("nav links are present", async ({ page }) => {
    const nav = page.locator("nav").first()
    await expect(nav.getByRole("link", { name: "How It Works", exact: true })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Industries", exact: true })).toBeVisible()
    await expect(nav.getByRole("link", { name: "Pricing", exact: true })).toBeVisible()
  })

  test("hero CTA links to signup", async ({ page }) => {
    const cta = page.getByRole("link", { name: /get started/i }).first()
    await expect(cta).toHaveAttribute("href", /signup/)
  })

  test("hero headline contains outcome copy", async ({ page }) => {
    const h1 = page.getByRole("heading", { level: 1 })
    await expect(h1).toContainText("Every call answered")
    await expect(h1).toContainText("Every appointment booked")
    await expect(h1).toContainText("Zero revenue left behind")
  })

  test("hero subheadline mentions missed calls stat", async ({ page }) => {
    await expect(page.getByText(/1 in 5 inbound calls/)).toBeVisible()
  })

  test("Products suite section is not on page", async ({ page }) => {
    await expect(page.locator("#products")).toHaveCount(0)
    await expect(page.getByText("The Neuvetra Suite")).toHaveCount(0)
  })

  test("social proof strip is visible", async ({ page }) => {
    await expect(page.getByText("Trusted by")).toBeVisible()
    await expect(page.getByText("Dental", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("Legal", { exact: true }).first()).toBeVisible()
  })

  test("FAQ section shows all questions", async ({ page }) => {
    await expect(page.getByText("Will my callers know they're talking to AI?")).toBeVisible()
    await expect(page.getByText("Do I need to change my phone number?")).toBeVisible()
    await expect(page.getByText("What if it gets something wrong?")).toBeVisible()
    await expect(page.getByText("What languages does it support?")).toBeVisible()
    await expect(page.getByText("Can I customize what it says?")).toBeVisible()
  })

  test("FAQ accordion reveals answer on click", async ({ page }) => {
    await page.getByText("Will my callers know they're talking to AI?").click()
    await expect(page.getByText("sounds natural and professional")).toBeVisible()
  })

  test("CTA banner has updated headline", async ({ page }) => {
    await expect(page.getByText("Your first AI-answered call is 10 minutes away.")).toBeVisible()
  })

  test("footer contact link is a mailto", async ({ page }) => {
    const footer = page.locator("footer")
    await expect(footer.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "mailto:hello@neuvetra.com")
  })

  test("footer has no dead hash links", async ({ page }) => {
    const deadLinks = page.locator('footer a[href="#"]')
    await expect(deadLinks).toHaveCount(0)
  })

  test("footer has legal links", async ({ page }) => {
    const footer = page.locator("footer")
    await expect(footer.getByRole("link", { name: "Privacy Policy" })).toBeVisible()
    await expect(footer.getByRole("link", { name: "Terms of Service" })).toBeVisible()
  })

  test("Industries section is present", async ({ page }) => {
    const section = page.locator("#industries")
    await expect(section.getByText("Home Services")).toBeVisible()
    await expect(section.getByText("Dental", { exact: true })).toBeVisible()
  })
})
```

- [ ] **Step 2: Add pricing minute tests to `pricing.spec.ts`**

Append these tests inside the existing `test.describe` block (before the closing `}`):

```ts
  test("starter plan shows 200 minutes", async ({ page }) => {
    await expect(page.locator("#pricing").getByText(/200 minutes/)).toBeVisible()
  })

  test("growth plan shows 500 minutes", async ({ page }) => {
    await expect(page.locator("#pricing").getByText(/500 minutes/)).toBeVisible()
  })

  test("pro plan shows 1,000 minutes", async ({ page }) => {
    await expect(page.locator("#pricing").getByText(/1,000 minutes/)).toBeVisible()
  })
```

- [ ] **Step 3: Run tests — verify they fail for the right reasons**

```bash
cd apps/web && bun run test:e2e --grep "hero headline|missed calls|Products suite|social proof|FAQ|CTA banner|footer contact|dead hash|200 minutes|500 minutes"
```

Expected: multiple FAILs referencing missing text / elements. If any fail unexpectedly (e.g., syntax error), fix before continuing.

---

## Task 3 — Rewrite `Hero.tsx`

**Files:**
- Modify: `apps/web/src/components/landing/Hero.tsx`

- [ ] **Step 1: Replace Hero component**

```tsx
import { buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/layout/Container"
import { HERO, STATS } from "@/constants/landing"

export function Hero() {
  const headlineLines = HERO.headline.split("\n")

  return (
    <section className="relative overflow-hidden bg-background py-24 md:py-36">
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Accent blobs */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />

      <Container className="relative">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {HERO.badge}
            </span>
          </div>

          {/* Headline — last line gets primary color */}
          <h1 className="text-5xl font-semibold tracking-tight text-foreground md:text-6xl lg:text-7xl leading-[1.05]">
            {headlineLines.map((line, i) => (
              <span
                key={i}
                className={`block ${i === headlineLines.length - 1 ? "text-primary" : ""}`}
              >
                {line}
              </span>
            ))}
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {HERO.subheadline}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/signup"
              className={
                buttonVariants({ size: "lg" }) +
                " w-full bg-foreground text-background hover:bg-foreground/80 sm:w-auto px-8 rounded-xl"
              }
            >
              {HERO.primaryCTA}
            </a>
            <a
              href="#how-it-works"
              className={
                buttonVariants({ size: "lg", variant: "outline" }) +
                " w-full border-border text-foreground hover:bg-muted sm:w-auto px-8 rounded-xl"
              }
            >
              {HERO.secondaryCTA}
            </a>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">{HERO.trust}</p>
        </div>

        {/* Stats bar */}
        <div className="mx-auto mt-20 grid max-w-2xl grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-muted shadow-sm">
          {STATS.map(({ value, label }) => (
            <div key={label} className="px-6 py-6 text-center">
              <p className="text-3xl font-bold text-foreground">{value}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: Run hero tests**

```bash
cd apps/web && bun run test:e2e --grep "hero headline|missed calls"
```

Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Hero.tsx
git commit -m "feat: rewrite hero with outcome+pain copy and semantic tokens"
```

---

## Task 4 — Create `SocialProof.tsx`

**Files:**
- Create: `apps/web/src/components/landing/SocialProof.tsx`

- [ ] **Step 1: Create component**

```tsx
import { Star } from "lucide-react"
import { Container } from "@/components/layout/Container"

const INDUSTRIES = ["Dental", "Legal", "MedSpa", "Home Services", "Real Estate"]

export function SocialProof() {
  return (
    <section className="border-y border-border bg-muted py-4">
      <Container>
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Trusted by</span>
            {INDUSTRIES.map((industry) => (
              <span
                key={industry}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground"
              >
                {industry}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-sm font-medium text-muted-foreground">Rated 5.0 by our customers</span>
          </div>
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: Wire into `LandingPage.tsx` immediately** (just this one component)

In `apps/web/src/pages/LandingPage.tsx`, add the import and place `<SocialProof />` immediately after `<Hero />`:

```tsx
import { SocialProof } from "@/components/landing/SocialProof"
// ... existing imports ...

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <Industries />
        <WhyNeuvetra />
        <ComparisonTable />
        <Pricing />
        <Testimonials />
        <CTABanner />
      </main>
      <Footer />
    </div>
  )
}
```

(Keep `<Products />` in for now — removing it comes in Task 11 along with `<FAQ />`.)

- [ ] **Step 3: Run social proof test**

```bash
cd apps/web && bun run test:e2e --grep "social proof"
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/landing/SocialProof.tsx apps/web/src/pages/LandingPage.tsx
git commit -m "feat: add social proof strip below hero"
```

---

## Task 5 — Update `Features.tsx` — Lucide icons + tokens

**Files:**
- Modify: `apps/web/src/components/landing/Features.tsx`

- [ ] **Step 1: Replace Features component**

```tsx
import { Phone, Brain, CalendarCheck, Globe, FileText, Bell } from "lucide-react"
import { Container } from "@/components/layout/Container"
import { FRONT_DESK_FEATURES } from "@/constants/landing"
import type { LucideIcon } from "lucide-react"

const FEATURE_ICONS: LucideIcon[] = [Phone, Brain, CalendarCheck, Globe, FileText, Bell]

export function Features() {
  return (
    <section id="features" className="bg-background py-24 md:py-32">
      <Container>
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
            Neuvetra Front Desk
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Everything your receptionist does.<br />
            <span className="text-muted-foreground">For a fraction of the cost.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Front Desk handles every inbound call with the knowledge, professionalism, and
            availability your business needs.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FRONT_DESK_FEATURES.map((feature, i) => {
            const Icon = FEATURE_ICONS[i]
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-muted p-6 hover:border-primary/20 hover:bg-primary/5 transition-all"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-5 text-primary" strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```bash
cd apps/web && bun run test:e2e --grep "Landing page|Pricing"
```

Expected: all passing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Features.tsx
git commit -m "feat: replace emoji icons with Lucide icons in Features, migrate to tokens"
```

---

## Task 6 — Create `FAQ.tsx`

**Files:**
- Create: `apps/web/src/components/landing/FAQ.tsx`

Note: The Accordion component uses `@base-ui/react/accordion`. The `AccordionItem` requires a `value` prop. Root accepts standard props; use `openMultiple={false}` to allow only one item open at a time.

- [ ] **Step 1: Create component**

```tsx
import { Container } from "@/components/layout/Container"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { FAQ_ITEMS } from "@/constants/landing"

export function FAQ() {
  return (
    <section id="faq" className="bg-muted py-24 md:py-32">
      <Container>
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">FAQ</p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Common questions, honest answers.
          </h2>
        </div>

        <div className="mx-auto max-w-2xl">
          <Accordion openMultiple={false}>
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-semibold text-foreground py-4">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: Wire into `LandingPage.tsx`** — add import, place before `<CTABanner />`

```tsx
import { FAQ } from "@/components/landing/FAQ"

// In JSX — add between Testimonials and CTABanner:
<Testimonials />
<FAQ />
<CTABanner />
```

- [ ] **Step 3: Run FAQ tests**

```bash
cd apps/web && bun run test:e2e --grep "FAQ"
```

Expected: both FAQ tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/landing/FAQ.tsx apps/web/src/pages/LandingPage.tsx
git commit -m "feat: add FAQ section with accordion before CTA banner"
```

---

## Task 7 — Update `CTABanner.tsx`

**Files:**
- Modify: `apps/web/src/components/landing/CTABanner.tsx`

- [ ] **Step 1: Replace CTABanner component**

```tsx
import { Link } from "react-router"
import { Container } from "@/components/layout/Container"
import { CTA_BANNER } from "@/constants/landing"

export function CTABanner() {
  return (
    <section className="relative overflow-hidden bg-primary py-24 md:py-32">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-foreground/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-foreground/5 blur-3xl" />

      <Container className="relative text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/70 mb-4">
          Get Started
        </p>
        <h2 className="text-4xl font-semibold tracking-tight text-primary-foreground md:text-5xl">
          {CTA_BANNER.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/70">
          {CTA_BANNER.subheadline}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex w-full items-center justify-center rounded-xl bg-background px-8 py-3.5 text-sm font-bold text-primary hover:bg-muted transition-colors sm:w-auto"
          >
            {CTA_BANNER.primaryCTA} →
          </Link>
        </div>
        <p className="mt-6 text-sm text-primary-foreground/60">
          No credit card required · Cancel anytime · Setup in minutes
        </p>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: Run CTA banner test**

```bash
cd apps/web && bun run test:e2e --grep "CTA banner"
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/CTABanner.tsx
git commit -m "feat: update CTA banner copy and migrate to semantic tokens"
```

---

## Task 8 — Update `Footer.tsx`

**Files:**
- Modify: `apps/web/src/components/landing/Footer.tsx`

- [ ] **Step 1: Replace Footer component**

The `FOOTER.columns` now include `disabled` and nullable `href` fields. Render `<span>` for disabled items, `<a>` for active ones.

```tsx
import { Container } from "@/components/layout/Container"
import { FOOTER } from "@/constants/landing"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-16">
      <Container>
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground">
                <span className="text-sm font-black text-background">N</span>
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight">Neuvetra</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{FOOTER.tagline}</p>
            <p className="mt-4 text-xs text-muted-foreground">Birgani Enterprises Inc.</p>
          </div>

          {/* Link columns */}
          {FOOTER.columns.map((col) => (
            <div key={col.heading}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {col.heading}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.disabled || !link.href ? (
                      <span className="text-sm text-muted-foreground/50">{link.label}</span>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">{FOOTER.copyright}</p>
          <p className="text-xs text-muted-foreground">Powered by Twilio · Retell AI · OpenAI</p>
        </div>
      </Container>
    </footer>
  )
}
```

- [ ] **Step 2: Run footer tests**

```bash
cd apps/web && bun run test:e2e --grep "footer contact|dead hash|footer has legal"
```

Expected: all 3 PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/Footer.tsx
git commit -m "feat: remove dead footer links, add mailto contact, migrate to tokens"
```

---

## Task 9 — Update `Navbar.tsx` — mobile menu + tokens

**Files:**
- Modify: `apps/web/src/components/landing/Navbar.tsx`

Note: Before writing, read `apps/web/src/components/ui/sheet.tsx` to confirm the `SheetTrigger` API (base-nova may use `render` prop instead of `asChild`).

- [ ] **Step 1: Read the Sheet component to verify API**

```bash
cat apps/web/src/components/ui/sheet.tsx
```

Look for how `SheetTrigger` is exported and whether it uses `asChild` or `render`. If it uses `render`, replace `asChild` with `render={<Button variant="ghost" size="icon" />}` in Step 2 below.

- [ ] **Step 2: Replace Navbar component**

```tsx
import { Link } from "react-router"
import { Menu } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/layout/Container"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { NAV_LINKS } from "@/constants/landing"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <img src="/logo-v2.png" alt="Front Desk" className="h-9 w-9 object-contain" />
          <span className="text-lg font-bold text-foreground tracking-tight">Front Desk</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA + mobile hamburger */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:block"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className={
              buttonVariants({ size: "sm" }) +
              " bg-foreground text-background hover:bg-foreground/80 rounded-lg px-5"
            }
          >
            Get Started
          </Link>

          {/* Mobile hamburger — hidden on md+ */}
          <Sheet>
            <SheetTrigger
              render={
                <button
                  className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-background pt-10">
              <nav className="flex flex-col gap-6">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-base font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  to="/login"
                  className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className={
                    buttonVariants({ size: "sm" }) +
                    " bg-foreground text-background hover:bg-foreground/80 rounded-lg w-full justify-center"
                  }
                >
                  Get Started
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  )
}
```

If the Sheet API uses `asChild` instead of `render`, replace the `<SheetTrigger render={...}>` block with:

```tsx
<SheetTrigger asChild>
  <button
    className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
    aria-label="Open menu"
  >
    <Menu className="size-5" />
  </button>
</SheetTrigger>
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && bun run test:e2e --grep "nav links"
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/landing/Navbar.tsx
git commit -m "feat: add mobile hamburger menu to Navbar, migrate to semantic tokens"
```

---

## Task 10 — Token Migration: Remaining Components

Migrate `HowItWorks`, `Industries`, `WhyNeuvetra`, `Pricing`, `Testimonials`, and `ComparisonTable` to semantic tokens. No copy changes — pure class replacement.

**Files:**
- Modify: `apps/web/src/components/landing/HowItWorks.tsx`
- Modify: `apps/web/src/components/landing/Industries.tsx`
- Modify: `apps/web/src/components/landing/WhyNeuvetra.tsx`
- Modify: `apps/web/src/components/landing/Pricing.tsx`
- Modify: `apps/web/src/components/landing/Testimonials.tsx`
- Modify: `apps/web/src/components/landing/ComparisonTable.tsx`

- [ ] **Step 1: Replace `HowItWorks.tsx`**

```tsx
import { Container } from "@/components/layout/Container"
import { HOW_IT_WORKS } from "@/constants/landing"

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-foreground py-24 md:py-32">
      <Container>
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Setup</p>
          <h2 className="text-4xl font-semibold tracking-tight text-background md:text-5xl">
            Live in under 10 minutes.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-background/60">
            No IT team. No hardware. No phone system changes. Just sign up and forward your calls.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.step}
              className="relative rounded-2xl border border-background/20 bg-background/10 p-6"
            >
              <p className="mb-3 text-3xl font-bold text-primary opacity-60">{item.step}</p>
              <h3 className="text-sm font-bold text-background">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-background/60">{item.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: Replace `Industries.tsx`**

```tsx
import { Container } from "@/components/layout/Container"
import { INDUSTRIES } from "@/constants/landing"

export function Industries() {
  return (
    <section id="industries" className="bg-background py-24 md:py-32">
      <Container>
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Industries</p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Built for the businesses<br />that keep communities running.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            If your phone rings and missing it costs you money, Neuvetra is for you.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {INDUSTRIES.map(({ label, icon }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted px-4 py-6 text-center transition-all hover:border-primary/20 hover:bg-primary/5"
            >
              <span className="text-3xl">{icon}</span>
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 3: Replace `WhyNeuvetra.tsx`**

```tsx
import { Container } from "@/components/layout/Container"
import { WHY_NEUVETRA } from "@/constants/landing"

export function WhyNeuvetra() {
  return (
    <section className="bg-muted py-24 md:py-32">
      <Container>
        <div className="grid gap-16 md:grid-cols-2 md:items-center">
          {/* Left — text */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Why Neuvetra</p>
            <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl leading-tight">
              Enterprise AI.<br />Small business price.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              We believe the AI tools that help Fortune 500 companies grow should be available to
              every local business owner. Neuvetra makes that possible.
            </p>
            <a
              href="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background hover:bg-foreground/80 transition-colors"
            >
              Get started free →
            </a>
          </div>

          {/* Right — pillars */}
          <div className="grid gap-4 sm:grid-cols-2">
            {WHY_NEUVETRA.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-background p-5">
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 4: Replace `Pricing.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Container } from "@/components/layout/Container"
import { PRICING_TIERS } from "@/constants/landing"
import { Check } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="bg-muted py-24 md:py-32">
      <Container>
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Pricing</p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Simple, transparent pricing.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Start free for 7 days. No credit card required. Cancel any time.
          </p>

          <div className="mt-8">
            <ToggleGroup
              value={[annual ? "annual" : "monthly"]}
              onValueChange={(v) => { if (v[0]) setAnnual(v[0] === "annual") }}
              spacing={1}
              className="rounded-xl border border-border bg-background p-1"
            >
              <ToggleGroupItem value="monthly" className="rounded-lg px-4 py-2 text-sm font-semibold">
                Monthly
              </ToggleGroupItem>
              <ToggleGroupItem value="annual" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
                Annual
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Save 20%
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => {
            const price = annual ? Math.round(tier.monthlyPrice * 0.8) : tier.monthlyPrice

            return (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
                  tier.popular
                    ? "border-primary bg-background shadow-lg shadow-primary/10 ring-1 ring-primary"
                    : "border-border bg-background shadow-sm"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>

                <div className="mt-6 flex items-end gap-1">
                  <span className="text-5xl font-bold tracking-tight text-foreground">${price}</span>
                  <span className="mb-1.5 text-sm text-muted-foreground">/mo</span>
                </div>
                {annual && (
                  <p className="mt-1 text-xs text-emerald-600 font-medium">
                    Billed ${price * 12}/year · save ${(tier.monthlyPrice - price) * 12}/yr
                  </p>
                )}

                <a
                  href="/signup"
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    tier.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-foreground text-background hover:bg-foreground/80"
                  }`}
                >
                  Start free trial →
                </a>

                <p className="mt-2 text-center text-xs text-muted-foreground">
                  7-day free trial · No credit card
                </p>

                <div className="my-6 border-t border-border" />

                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <p className="mt-6 text-xs text-muted-foreground">
                  Overage: <span className="font-medium text-foreground">${tier.overageRate}/min</span>{" "}
                  after {tier.minutes} min · capped at your limit by default
                </p>
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          All plans include 1 dedicated local phone number, call transcripts, SMS alerts, and full
          dashboard access.
          <br />
          Need more?{" "}
          <a href="mailto:hello@neuvetra.com" className="text-primary hover:underline">
            Contact us
          </a>{" "}
          for custom volume pricing.
        </p>
      </Container>
    </section>
  )
}
```

- [ ] **Step 5: Replace `Testimonials.tsx`**

```tsx
import { Star } from "lucide-react"
import { Container } from "@/components/layout/Container"
import { TESTIMONIALS } from "@/constants/landing"

export function Testimonials() {
  return (
    <section className="bg-background py-24 md:py-32">
      <Container>
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Customer Stories</p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Real businesses. Real results.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            From dental offices to plumbers — here's what Neuvetra customers are saying.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, business, stars }) => (
            <div key={name} className="flex flex-col rounded-2xl border border-border bg-muted p-7">
              <div className="mb-4 flex gap-0.5">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">"{quote}"</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {name.split(" ").map((n: string) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">{business}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 6: Replace `ComparisonTable.tsx`**

Also update `iconFor` to recognise `"Direct calendar sync"` as a checkmark.

```tsx
import { Check, X, Minus } from "lucide-react"
import { Container } from "@/components/layout/Container"
import { COMPARISON } from "@/constants/landing"

const iconFor = (value: string) => {
  if (
    value === "Always" ||
    value === "Every call" ||
    value === "Fully trained by you" ||
    value === "< 10 minutes" ||
    value === "Direct calendar sync"
  )
    return <Check className="mx-auto h-4 w-4 text-emerald-500" />
  if (value === "None")
    return <X className="mx-auto h-4 w-4 text-red-400" />
  if (value === "Partial coverage" || value === "Rarely")
    return <Minus className="mx-auto h-4 w-4 text-amber-400" />
  return null
}

export function ComparisonTable() {
  return (
    <section className="bg-background py-24">
      <Container>
        <div className="mb-12 text-center">
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Comparison
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Why Front Desk beats the alternatives
          </h2>
          <p className="mt-4 text-muted-foreground">
            See how we stack up against hiring staff or using a generic answering service.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="bg-muted px-6 py-4 text-left font-medium text-muted-foreground w-1/4" />
                {COMPARISON.columns.map((col) => (
                  <th
                    key={col.name}
                    className={`px-6 py-4 text-center font-semibold ${
                      col.highlight
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {col.highlight && (
                      <span className="mb-1 block text-xs font-normal text-primary-foreground/70">
                        Recommended
                      </span>
                    )}
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COMPARISON.features.map((feature, rowIdx) => (
                <tr key={feature} className="hover:bg-muted/50">
                  <td className="px-6 py-4 font-medium text-foreground">{feature}</td>
                  {COMPARISON.columns.map((col) => {
                    const val = col.values[rowIdx]
                    const icon = iconFor(val)
                    return (
                      <td
                        key={col.name}
                        className={`px-6 py-4 text-center ${
                          col.highlight
                            ? "bg-primary/5 font-medium text-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        {icon ?? val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 7: Run full test suite**

```bash
cd apps/web && bun run test:e2e
```

Expected: all previously passing tests still pass, no regressions.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/landing/HowItWorks.tsx \
        apps/web/src/components/landing/Industries.tsx \
        apps/web/src/components/landing/WhyNeuvetra.tsx \
        apps/web/src/components/landing/Pricing.tsx \
        apps/web/src/components/landing/Testimonials.tsx \
        apps/web/src/components/landing/ComparisonTable.tsx
git commit -m "feat: migrate all remaining landing components to shadcn semantic tokens"
```

---

## Task 11 — Wire `LandingPage.tsx` — remove Products, confirm all sections

**Files:**
- Modify: `apps/web/src/pages/LandingPage.tsx`

- [ ] **Step 1: Replace LandingPage**

```tsx
import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { SocialProof } from "@/components/landing/SocialProof"
import { Features } from "@/components/landing/Features"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { Industries } from "@/components/landing/Industries"
import { WhyNeuvetra } from "@/components/landing/WhyNeuvetra"
import { ComparisonTable } from "@/components/landing/ComparisonTable"
import { Pricing } from "@/components/landing/Pricing"
import { Testimonials } from "@/components/landing/Testimonials"
import { FAQ } from "@/components/landing/FAQ"
import { CTABanner } from "@/components/landing/CTABanner"
import { Footer } from "@/components/landing/Footer"

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <Industries />
        <WhyNeuvetra />
        <ComparisonTable />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd apps/web && bun run test:e2e
```

Expected: all tests pass including "Products suite section is not on page".

- [ ] **Step 3: Final commit**

```bash
git add apps/web/src/pages/LandingPage.tsx \
        apps/web/tests/landing.spec.ts \
        apps/web/tests/pricing.spec.ts
git commit -m "feat: wire final LandingPage — remove Products section, all new sections active"
```

---

## Task 12 — Create task file and update memory

**Files:**
- Create: `tasks/38-landing-page-redesign.md`

- [ ] **Step 1: Create task file**

```markdown
---
status: done
---
# Task 38: Landing Page Redesign + Pricing Update

## What was done
- Pricing updated: Starter 150→200 min, Growth 400→500 min, overages lowered ($0.25→$0.20, $0.20→$0.17, $0.18→$0.16)
- Hero rewritten: outcome-first + pain stat ("1 in 5 calls missed"), three punchy lines
- Products section removed from LandingPage (3 "coming soon" cards hurt credibility)
- New SocialProof strip: industry badges + 5-star rating, right after Hero
- Features: emoji replaced with Lucide icons (Phone, Brain, CalendarCheck, Globe, FileText, Bell)
- Comparison table: new "Appointment booking" row showing our calendar sync differentiator
- New FAQ section: 5 questions answering core small-business objections, uses Accordion
- CTA Banner: new copy — "Your first AI-answered call is 10 minutes away."
- Footer: dead links removed, Contact → mailto:hello@neuvetra.com, coming-soon products shown as plain text
- Navbar: mobile hamburger menu (Sheet) added
- All components migrated to shadcn semantic tokens — no hardcoded indigo/neutral palette values

## Key decisions
- Price points ($49/$99/$199) unchanged — competitive, not racing to bottom
- Rosie AI does unlimited at $49 but no real appointment booking — our differentiator is calendar sync
- HowItWorks dark section uses bg-foreground/text-background for inversion (single token, themeable)
- Amber star colors (fill-amber-400) kept — status/decorative, not brand colors
```

- [ ] **Step 2: Final commit**

```bash
git add tasks/38-landing-page-redesign.md
git commit -m "docs: mark task 38 done — landing page redesign and pricing update"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Pricing: 200/500/1000 min, $0.20/$0.17/$0.16 overage — Task 1
- ✅ Hero copy — Task 1 (constants) + Task 3 (component)
- ✅ SocialProof strip — Task 4
- ✅ Features Lucide icons — Task 5
- ✅ FAQ section — Task 6
- ✅ CTA Banner copy — Task 7
- ✅ Footer dead links — Task 8
- ✅ Navbar mobile menu — Task 9
- ✅ Token migration (HowItWorks, Industries, WhyNeuvetra, Pricing, Testimonials, ComparisonTable) — Task 10
- ✅ Products section removed — Task 11
- ✅ Comparison table new row (appointment booking) — Task 10 Step 6
- ✅ TDD tests written first — Task 2

**Placeholder scan:** None found. All steps contain complete code.

**Type consistency:** `FAQ_ITEMS` used in Task 1 (constants) and Task 6 (FAQ.tsx). `FOOTER.columns[].links[].disabled` and `FOOTER.columns[].links[].href` (nullable) introduced in Task 1 and consumed in Task 8. Consistent.
