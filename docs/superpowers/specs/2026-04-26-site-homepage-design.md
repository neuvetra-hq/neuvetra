# Site homepage v1 — design spec

**Date:** 2026-04-26
**Codebase:** `Neuvetra/Site/`
**Scope:** First real content on the homepage at `/`. Replaces the placeholder centered-text in `apps/web/src/App.tsx`. Marketing landing only — no chat surfaces, no app shell chrome (topbar / side panels / dock are all deferred to a later iteration).

Parent context: `[[parent-landing-experience]]` (wiki feature page), `[[2026-04-25-spirit-as-brand-icon]]`, `[[2026-04-25-spirit-packaging]]`.

---

## Goal

Visitor lands on `neuvetra.com` (eventually — see Open Q8 in `[[parent-landing-experience]]`) and sees a single-screen marketing page that:

1. Establishes Neuvetra as the brand (large title + slogan).
2. Shows the Spirit (Three.js particle field) full-bleed behind everything.
3. Presents two product entry points as **big square cards**: Terrascope and FrontDesk.

Cards render but are non-functional for v1 — clicking does nothing yet. Routing into product surfaces is a separate iteration.

## What we're building

A single-route, single-screen page composed of:

- **Spirit canvas** — full-bleed, behind everything, ambient.
- **Hero text block** — vertically centered above the cards:
  - Title: **Neuvetra** (large, prominent).
  - Slogan: a one-line secondary title under the title (placeholder copy below; Nima to author final).
- **Two product cards** — large squares side-by-side below the hero text:
  - Card 1: **Terrascope**.
  - Card 2: **FrontDesk**.
- Cards are visually balanced, equal-sized, hover-responsive (subtle visual feedback to telegraph future interactivity).

That's it. No nav, no header, no footer, no scroll.

## Out of scope (this iteration)

- Card click behavior / routing into `/terrascope` or `/frontdesk`.
- Product routes themselves.
- Topbar, side panels, dock — none of them ship in v1.
- Per-product Spirit hover presets (the Spirit runs with its existing `default` preset).
- Voice / microphone / chat surfaces.
- Marketing copy beyond placeholders.
- Mobile-specific tuning beyond "doesn't break on a phone" (real responsive pass is a follow-up).

## Layout

Single full-viewport stage:

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│              Neuvetra                       │  ← title
│      <slogan, secondary title>              │  ← sub
│                                             │
│   ┌──────────────┐   ┌──────────────┐       │
│   │              │   │              │       │
│   │  Terrascope  │   │  FrontDesk   │       │  ← two cards
│   │              │   │              │       │
│   └──────────────┘   └──────────────┘       │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
   (Spirit particle field full-bleed behind)
```

Vertical centering: hero text + cards as one centered group; the page does not scroll. On viewports too short to hold all three comfortably, content gets a small top padding rather than overflowing — vertical stacking of cards on narrow viewports is acceptable for v1.

## Components

Three new components, all in `apps/web/src/`:

1. **Spirit** — pure file lift from `FrontDesk/code/apps/web/`, preserving directory layout:
   - `src/lib/spirit/*` → `Site/apps/web/src/lib/spirit/*`
   - `src/data/spirit-presets.ts` → `Site/apps/web/src/data/spirit-presets.ts`
   - `public/audio/*` → `Site/apps/web/public/audio/*`

   The Spirit's React entry component (whatever FrontDesk exports from `lib/spirit/`) is mounted at the top of the tree and renders the Three.js particle field as a fixed-position `<canvas>` that fills the viewport. Runs the existing `default` preset on mount. The XState behavior machine and presets transfer as-is per `[[2026-04-25-spirit-packaging]]`. The implementation plan will identify the exact entry export and any FrontDesk-specific imports that need rewriting.

2. **`Hero`** (`components/Hero.tsx`).
   Renders the title (`Neuvetra`) and slogan. Pure presentational — props or hard-coded strings.

3. **`ProductCard`** (`components/ProductCard.tsx`).
   Renders one big square with a product name. Props: `name: string`, optional `tagline?: string`, optional `onClick?: () => void` (unused in v1 but reserved). Hover state with subtle scale / glow / border treatment. Uses shadcn `Card` as the underlying primitive.

`App.tsx` composes them: `<Spirit />` followed by a positioned content layer that holds `<Hero />` and a flex-row of two `<ProductCard />`.

## Styling

- **Tailwind v4** for all styling (already configured).
- **shadcn primitives** where they fit naturally:
  - `Card` for the product squares.
  - `Button` if/when we attach interactivity (deferred).
- Run `bunx shadcn@latest init` once during implementation to generate `components.json`. Pick the Vite + Tailwind v4 preset, default style.
- Color palette pulls from the Spirit's existing palette (deep blues / desaturated teals on near-black `#0b0c0d`) so the foreground harmonises with the background. No new palette work in this spec — keep it monochrome-ish with high-contrast white-ish title text.

## Spirit integration details

- Mount the Spirit canvas at the top of the React tree as `position: fixed; inset: 0; z-index: 0; pointer-events: none`.
- Foreground content (Hero + cards) sits in a `position: relative; z-index: 1` layer above it.
- Spirit runs `default` preset on mount; no events are wired into it yet.
- Audio assets copy across but autoplay stays off by default (browser policy + first-impression UX).
- Reduced-motion handling: if `prefers-reduced-motion: reduce` is set, fall back to a static gradient backdrop instead of the live canvas. Detail can be a single `useReducedMotion` check at mount.

## Placeholder copy

Final copy to come from Nima. Draft starting points (clearly marked as placeholder in code comments):

- **Title:** `Neuvetra`
- **Slogan:** `AI tools for businesses.`
  - Pulled from the existing wiki framing in `[[parent-landing-experience]]`.

Nima can revise these by editing two string constants in `Hero.tsx`.

## Acceptance criteria

1. `bun run dev` from `Site/` boots both apps; visiting `http://localhost:5173/` shows:
   - Spirit running smoothly in the background.
   - "Neuvetra" rendered prominently with the slogan beneath it.
   - Two equal-sized square cards labelled "Terrascope" and "FrontDesk" beneath the hero text.
2. Hovering a card produces a subtle visual response (scale or glow).
3. Clicking a card does nothing (no navigation, no console error).
4. Page does not scroll on a normal laptop viewport (≥ 1280×800).
5. On a narrow viewport (< 768px), cards stack vertically and the layout remains usable.
6. `prefers-reduced-motion: reduce` swaps the Spirit canvas for a static gradient.
7. `bun run typecheck`, `bun run lint`, `bun run build` all pass.

## Implementation notes (for the plan stage)

- Spirit copy is a pure file lift from `Neuvetra/FrontDesk/code/apps/web/`; check imports for any cross-app dependencies and rewrite as needed.
- shadcn init creates `components.json`; commit it. Add `Card` (and any other shadcn primitives needed) via `bunx shadcn@latest add card`.
- `App.tsx` currently exports a tiny placeholder component; replace its body, keep the export shape.
- No router work in v1 — `App.tsx` is the only route.

## Open items (acceptable to ship without resolving)

- Final headline / slogan copy (Nima to author; placeholder ships).
- Card content beyond product name (tagline? icon? preview image?). Default: just the name. Easy to extend.
- Per-product Spirit hover presets (deferred per `[[parent-landing-experience]]` Q5).
- Mobile responsive polish (deferred per `[[parent-landing-experience]]` Q9).
- Accessibility pass (deferred per `[[parent-landing-experience]]` Q10).
