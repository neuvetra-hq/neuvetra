# Landing Page Redesign + Pricing Update — Design Spec
**Date:** 2026-04-20  
**Status:** Approved by user

---

## Overview

Two coordinated changes before public launch:
1. **Pricing adjustment** — same price points, more generous minute allocations, lower overage rates
2. **Landing page redesign** — sharper copy, new sections, removed dead weight, full shadcn token compliance

All landing page components must use **shadcn semantic tokens only** — no hardcoded Tailwind palette values (no `indigo-*`, `neutral-*`, etc.). This makes the entire site themeable from one place.

---

## Part 1 — Pricing Changes

### Approved Structure

| Tier | Price | Minutes (was) | Minutes (new) | Overage (was) | Overage (new) |
|------|-------|--------------|--------------|--------------|--------------|
| Starter | $49/mo | 150 | **200** | $0.25/min | **$0.20/min** |
| Growth | $99/mo | 400 | **500** | $0.20/min | **$0.17/min** |
| Pro | $199/mo | 1,000 | 1,000 ✓ | $0.18/min | **$0.16/min** |

Annual billing (20% off) unchanged: $39 / $79 / $159 per month.

### Margin Analysis (at $0.12/min blended cost — Retell $0.11 + Twilio $0.01)

| Tier | Revenue | Cost | Gross Profit | Margin |
|------|---------|------|-------------|--------|
| Starter | $49 | $24 | $25 | 55% |
| Growth | $99 | $60 | $39 | 44% |
| Pro | $199 | $120 | $79 | 40% |

All tiers profitable. Overage rates all yield positive margin above cost.

### Rationale

- Rosie AI now offers unlimited minutes at $49 — our minutes felt thin by comparison. Bumping to 200/500 min closes the perceived gap without changing price.
- Our key differentiator over Rosie: **real calendar appointment booking** (Google, Outlook, Apple iCloud), not just sending a scheduling link.
- Price points ($49/$99/$199) are competitive and should not be lowered — we are premium-adjacent and that is the right position.

### Files to Update

- `apps/web/src/constants/landing.ts` — `PRICING_TIERS` array (minutes + overageRate)

---

## Part 2 — Landing Page Redesign

### Design Principles

- **shadcn semantic tokens everywhere**: `text-foreground`, `text-muted-foreground`, `bg-background`, `bg-muted`, `border-border`, `text-primary`, `bg-primary`, `bg-primary/5`, `bg-primary/10`, etc.
- No hardcoded `bg-indigo-*`, `text-neutral-*`, `bg-white` (use `bg-background`), etc.
- The HowItWorks dark section uses `bg-foreground` / `text-background` for the inversion — single token, themeable.

---

### Section Order (Final)

```
Navbar                    — minor: mobile menu
Hero                      — full rewrite
Social Proof Strip        — NEW
Features                  — Lucide icons, same copy structure
How It Works              — unchanged
Industries                — unchanged
Why Neuvetra              — unchanged
Comparison Table          — add one row
Pricing                   — updated numbers
Testimonials              — unchanged
FAQ                       — NEW
CTA Banner                — copy update
Footer                    — remove dead links
[Products section REMOVED as standalone section]
```

---

### Section Specs

#### Navbar
- Add mobile hamburger menu (Sheet from shadcn) — currently nav links disappear on mobile, only CTA shows
- Token: `bg-background/90`, `border-border`

#### Hero (full rewrite)

**Badge:** `AI Receptionist · From $49/mo`

**Headline (3 lines):**
```
Every call answered.
Every appointment booked.
Zero revenue left behind.
```

**Subheadline:**
> The average small business misses 1 in 5 inbound calls — each one a potential customer who hangs up and calls someone else. Front Desk answers instantly, books the appointment, and texts you a summary. 24/7, in any language, for a fraction of the cost of a receptionist.

**Primary CTA:** `Get started free →` → `/signup`  
**Secondary CTA:** `See how it works` → `#how-it-works`  
**Trust line:** `7-day free trial · No credit card · Live in 10 minutes`

**Stats bar** (below CTAs, same 3 stats):
- `< 1s` — Answer time
- `24/7` — Always on
- `80%` — Calls handled

**Token notes:** Background `bg-background`, blobs use `bg-primary/10` and `bg-primary/5`, headline uses `text-foreground`, stat bar uses `bg-muted`, `border-border`.

---

#### Social Proof Strip — NEW

A single horizontal bar immediately below the Hero. No new component file needed — inline in a new `SocialProof.tsx`.

**Content:**
- Left: `Trusted by` + industry pill badges: `Dental · Legal · MedSpa · Home Services · Real Estate`
- Right: `★★★★★  5.0 · Rated by our customers`

**Token:** `bg-muted`, `border-border`, pills use `bg-background border-border text-foreground`

---

#### Features

- Replace all 6 emoji icons with Lucide icons:
  - 📞 → `Phone`
  - 🧠 → `Brain`
  - 📆 → `CalendarCheck`
  - 🌐 → `Globe`
  - 📋 → `FileText`
  - 🔔 → `Bell`
- Icon container: `bg-primary/10 text-primary` (replaces `bg-indigo-50 text-indigo-600`)
- Cards: `bg-muted border-border hover:bg-primary/5 hover:border-primary/20`

---

#### Comparison Table

Add one row to `COMPARISON` in `landing.ts`:

| Feature | Neuvetra Front Desk | Hire a receptionist | Answering service |
|---------|--------------------|--------------------|------------------|
| Appointment booking | Direct calendar sync | Takes time to learn | ❌ None |

This row goes after "Knows your business" — it's our biggest differentiator vs. answering services.

---

#### Pricing

Update `PRICING_TIERS` in `landing.ts`:
- Starter: `minutes: 200`, `overageRate: "0.20"`, description update: `"~100 calls"`
- Growth: `minutes: 500`, `overageRate: "0.17"`, description update: `"~250 calls"`
- Pro: `overageRate: "0.16"` (minutes unchanged at 1,000)

Update feature list strings to match new minute counts.

---

#### FAQ — NEW

New component `apps/web/src/components/landing/FAQ.tsx`.  
Uses shadcn `Accordion` component (already installed).

**Questions:**

1. **Will my callers know they're talking to AI?**  
   Front Desk sounds natural and professional. Most callers don't ask — and if they do, it's honest about being an AI assistant. You control the name and personality.

2. **Do I need to change my phone number?**  
   No. You keep your existing number. You simply set up call forwarding for missed or after-hours calls — takes about 2 minutes with your carrier.

3. **What if it gets something wrong?**  
   Every call is transcribed and summarized in your dashboard. You review everything. If the AI is ever unsure, it takes a message and you call back. It never guesses on pricing or commitments it isn't trained on.

4. **What languages does it support?**  
   Front Desk automatically detects the caller's language and responds in kind — no extra setup required. Particularly useful for businesses serving multilingual communities.

5. **Can I customize what it says?**  
   Yes — you train it on your business: services, pricing, hours, FAQs, policies. The more you teach it, the better it performs. You can update it any time from your dashboard.

**Token:** Section uses `bg-muted`. Accordion uses default shadcn styling (already token-compliant).

---

#### CTA Banner

**Headline:** `Your first AI-answered call is 10 minutes away.`  
**Subheadline:** `No contracts. No hardware. No hiring. Just sign up and forward your calls.`  
**CTA:** `Get started free →`  
**Trust line:** `No credit card required · Cancel anytime · Setup in minutes`

**Token:** Section uses `bg-primary text-primary-foreground`. Blobs use `bg-primary-foreground/5`. Button uses `bg-background text-primary hover:bg-muted`.

---

#### Footer

Remove dead links:
- Remove `About Neuvetra` link (no page exists)
- Change `Contact` → `mailto:hello@neuvetra.com`
- Remove coming-soon product links from Products column OR mark clearly as `Coming soon` in text rather than as links

Products section removed as a standalone landing page section. The Products column in the footer is sufficient visibility for the roadmap.

---

#### Products Section — REMOVED

The `<Products />` component is removed from `LandingPage.tsx`. The component file can stay for now (no need to delete), just stop rendering it. The Neuvetra suite products (Scheduler, Insights, Engage) get visibility through the footer Products column only.

**Reason:** Showing 3 "coming soon" cards in the second section of the page undermines the product's credibility. Front Desk needs the full spotlight.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/pages/LandingPage.tsx` | Remove `<Products />`, add `<SocialProof />`, add `<FAQ />` |
| `apps/web/src/constants/landing.ts` | Pricing numbers, hero copy, CTA banner copy, comparison row, FAQ content, footer links |
| `apps/web/src/components/landing/Hero.tsx` | New copy, token-compliant colors |
| `apps/web/src/components/landing/Features.tsx` | Lucide icons, token colors |
| `apps/web/src/components/landing/Pricing.tsx` | Token colors (numbers come from constants) |
| `apps/web/src/components/landing/ComparisonTable.tsx` | Token colors |
| `apps/web/src/components/landing/CTABanner.tsx` | New copy, token colors |
| `apps/web/src/components/landing/Footer.tsx` | Remove dead links, token colors |
| `apps/web/src/components/landing/Navbar.tsx` | Mobile menu (Sheet), token colors |
| `apps/web/src/components/landing/SocialProof.tsx` | NEW component |
| `apps/web/src/components/landing/FAQ.tsx` | NEW component |
| `apps/web/tests/landing.spec.ts` | TDD — new tests for hero copy, social proof, FAQ |

---

## Token Reference (Quick Lookup)

| Old (hardcoded) | New (semantic token) |
|----------------|---------------------|
| `bg-white` | `bg-background` |
| `bg-neutral-50` | `bg-muted` |
| `bg-neutral-900` | `bg-foreground` |
| `text-neutral-900` | `text-foreground` |
| `text-neutral-500` / `text-neutral-600` | `text-muted-foreground` |
| `border-neutral-100` / `border-neutral-200` | `border-border` |
| `bg-indigo-600` | `bg-primary` |
| `text-indigo-600` | `text-primary` |
| `bg-indigo-50` | `bg-primary/10` |
| `text-indigo-700` / `text-white` (on primary) | `text-primary-foreground` |
| `bg-neutral-800` (dark section) | `bg-foreground` |
| `text-neutral-400` (dark section) | `text-background/60` |
| `text-indigo-400` (dark section label) | `text-primary` |

---

## Out of Scope

- Hero illustration / product screenshot (nice to have, not blocking launch)
- "About" page (remove link for now, build later)
- Mobile animations / scroll effects
- Dark mode for landing page (dashboard already supports it; landing page can follow later)
