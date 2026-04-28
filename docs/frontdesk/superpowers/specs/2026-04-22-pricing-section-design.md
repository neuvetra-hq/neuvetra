# Pricing Section Redesign — Spec
**Date:** 2026-04-22
**Status:** Approved for implementation

---

## Overview

Redesign `apps/web/src/components/landing/Pricing.tsx` to match the futuristic dark aesthetic established by `HowItWorks.tsx`. The section changes from a light `bg-muted` background to the same dark `bg-foreground` used by HowItWorks, with rectangular glassmorphism cards, a custom billing toggle, and an enterprise bar below the cards.

---

## What Does NOT Change

- The section header (eyebrow, headline, subheadline) is kept **exactly as-is** from the current `Pricing.tsx` — class names, copy, and structure are untouched. Only the color tokens need to flip from dark-on-light to light-on-dark since the background changes.
- `PRICING_TIERS` in `landing.ts` remains the source of truth for tier data.

---

## Section Background

| Before | After |
|--------|-------|
| `bg-muted` | `bg-foreground` |

All text tokens flip accordingly: `text-foreground` → `text-background`, `text-muted-foreground` → `text-background/60`, etc.

---

## Billing Toggle

Replace the existing shadcn `ToggleGroup` with a custom React tab component.

**Visual behavior:**
- Two tabs: `MONTHLY` and `ANNUAL` — all uppercase, `font-weight: 300`, `letter-spacing: .18em`
- A sliding rectangle highlight (no border-radius) moves between the active tab
- The highlight has: `background: rgba(255,255,255,0.015)` + `border-bottom: 1px solid rgba(139,92,246,0.35)`
- Active tab: `text-background/90`. Inactive tab: `text-background/30`, brightens to `text-background/55` on hover
- `ANNUAL` tab has a superscript `−20%` label in violet: `font-size: 9px`, `font-weight: 200`, no background or border, positioned `top: -5px`
- Sliding indicator uses `transition: left 250ms cubic-bezier(0.4,0,0.2,1), width 250ms`

**State:** `useState<'monthly' | 'annual'>` — drives price display across all cards.

---

## Cards Grid

- Layout: `grid grid-cols-1 md:grid-cols-3 gap-4` — equal height via `items-stretch`
- **No border-radius anywhere** — `rounded-none` on all card elements
- All cards share the same base treatment; the popular card differs only by color tint

### Base card
```
border border-background/10
bg-background/[0.015]
p-7
```

### Popular card (Growth) — only difference
```
border-background/[0.15] → border-violet-500/20
bg-violet-500/[0.03]
```
No badge, no elevation, no size difference from the other cards.

### Card structure (top to bottom)

1. **Plan name** — `text-[11px] font-semibold tracking-[.14em] uppercase text-background/45`
   - Popular: `text-violet-200/70`

2. **Price row** — all on one line:
   - `$` dollar sign: `text-base font-light text-background/40`, `align-self: flex-start`, `mt-2`
   - Amount: `text-[52px] font-light tracking-tight text-background`, fades on toggle switch
   - `/month`: `text-xs font-light text-background/30`, `align-self: flex-end pb-1.5`

3. **Divider** — `h-px bg-background/7` (popular: `bg-violet-500/12`)

4. **Features list** — `text-xs text-background/45`, `leading-[1.4]`, gap between items
   - Bullet: `—` em dash in CSS `::before`, `text-[9px] text-background/18` (popular: `text-violet-400/40`)
   - Popular features: `text-background/55`

5. **Overage line** — `text-[10px] text-background/20` at bottom of list

6. **Good for section** — separated by a top border `border-t border-background/5` (popular: `border-violet-500/10`), `mt-5 pt-4`
   - Label: `text-[9px] font-semibold tracking-[.14em] uppercase text-background/20`
   - Text: `text-[11px] text-background/35`, `leading-[1.5]`
   - Popular label/text use `text-violet-200/XX` equivalents

### Tier data (updated from `PRICING_TIERS`)

| | Starter | Growth | Pro |
|--|---------|--------|-----|
| Price | $49 | $99 | $199 |
| Annual price | $39 | $79 | $159 |
| Minutes | 200 | 500 | 1,000 |
| Overage | 20¢/min | 18¢/min | 16¢/min |
| Popular | No | Yes | No |
| Support | Email | Priority email | Priority via phone and email |
| Extra | — | Custom AI knowledge base | Personalized AI training and setup call |

**Good for copy (no em dashes):**
- Starter: "Solo operators who need AI coverage after hours with no secretary on staff."
- Growth: "Businesses ready for a dedicated AI line that handles every call, all day long."
- Pro: "High-volume businesses that want hands-on setup, personal training, and priority access when they need it."

---

## Enterprise Bar

Below the cards grid, a full-width horizontal strip:

```
border border-background/6
bg-background/[0.01]
px-8 py-5
flex items-center justify-between
```

- Left: label `ENTERPRISE` (eyebrow style) + headline "Replacing a call center? Let's build something custom." + subtext "Custom minutes, dedicated infrastructure, white-glove onboarding."
- Right: `Contact us →` link to `mailto:hello@neuvetra.com` — uppercase, `font-weight: 300`, `letter-spacing: .08em`, violet color, `border-bottom: 1px solid violet-500/30`
- Mobile: stacks to column, same max-width as cards

---

## CTA Button

Single button below the enterprise bar, centered:

- Text: `START FREE TRIAL` — uppercase, `font-weight: 300`, `letter-spacing: .18em`, `text-[11px]`
- Style: `bg-violet-500/15 border border-violet-500/35 text-violet-200` — no border-radius
- Links to `/signup`

---

## Footer Note

Kept as-is from current `Pricing.tsx`, colors updated for dark background.

---

## Mobile Behavior

- Cards stack to single column, `max-width: 400px`, centered
- Popular card floats to top (`order-first`)
- Enterprise bar matches cards width (`max-width: 400px`, centered)
- Price amount scales down to `text-[44px]`
- Section padding reduces to `py-16 px-4`

---

## Constants Updates Required

`apps/web/src/contexts/constants/landing.ts` — update `PRICING_TIERS`:
- Change Growth overage from `"0.17"` to `"0.18"`
- Add `goodFor` string to each tier
- Add `annualPrice` to each tier (39, 79, 159)
- Remove multi-number mention from Pro features

---

## Implementation Files

1. `apps/web/src/contexts/constants/landing.ts` — update `PRICING_TIERS`
2. `apps/web/src/components/landing/Pricing.tsx` — full redesign
