# Site homepage v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder content in `Site/apps/web/src/App.tsx` with a single-screen marketing landing page: Three.js Spirit running full-bleed behind a "Neuvetra" title, a slogan, and two big square product cards (Terrascope, FrontDesk) that render but do not navigate.

**Architecture:** A single React component tree composed of `<Spirit />` (fixed-position Three.js canvas at `z-0`), and a `position: relative; z-10` content layer holding `<Hero />` and a row of `<ProductCard />`. The Spirit engine code is a verbatim file-lift from `FrontDesk/code/apps/web/src/lib/spirit/` — no behavioral XState machine in v1, just the engine running its `default` preset. Card and other UI primitives come from shadcn/ui initialized in this task.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind v4, shadcn/ui (Vite + Tailwind v4 preset), Three.js 0.184, XState 5 (transitive — used by the Spirit engine, not directly here).

**Spec:** `docs/superpowers/specs/2026-04-26-site-homepage-design.md`.

**Working directory for all commands:** `C:\Users\nimab\Neuvetra\Site` (Site repo). All paths are relative to that root unless otherwise noted.

**Note on TDD:** the spec's acceptance gates are tooling (`bun run typecheck`, `bun run lint`, `bun run build`) plus manual viewport verification. Site has no unit-test runner installed yet, and adding one is out of scope for this iteration. Verification in this plan is via the spec's tooling gates and manual checks — not unit tests. The pages are visual / canvas-driven and would yield brittle DOM tests at this stage.

---

## File Structure

**New files:**
- `apps/web/components.json` — shadcn config (created by `shadcn init`)
- `apps/web/src/components/ui/card.tsx` — shadcn Card primitive (created by `shadcn add card`)
- `apps/web/src/lib/utils.ts` — shadcn `cn()` helper (created by `shadcn init`)
- `apps/web/src/lib/spirit/` — Spirit engine code (copied from FrontDesk: `engine.ts`, `particles.ts`, `shaders.ts`, `simulator.ts`, `spiritMachine.ts`, `spiritMachine.types.ts`, `spiritMachine.anchors.ts`)
- `apps/web/src/data/spirit-presets.ts` — Spirit presets (copied from FrontDesk)
- `apps/web/public/audio/` — Spirit audio assets (copied from FrontDesk)
- `apps/web/src/hooks/useSpiritEngine.ts` — minimal Spirit mount lifecycle hook
- `apps/web/src/components/Spirit.tsx` — Spirit canvas component with reduced-motion fallback
- `apps/web/src/components/Hero.tsx` — title + slogan
- `apps/web/src/components/ProductCard.tsx` — big square product card

**Modified files:**
- `apps/web/src/App.tsx` — replaced body to compose the homepage
- `apps/web/src/index.css` — shadcn init may add CSS variables / Tailwind preflight wiring
- `apps/web/tsconfig.app.json` — shadcn init may verify `@/*` alias is present (it already is)
- `apps/web/vite.config.ts` — shadcn init may verify `@/*` alias is present (it already is)
- `apps/web/package.json` — adds shadcn-related deps (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`)

---

## Task 1: Initialize shadcn/ui in `apps/web`

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/components/ui/card.tsx`
- Modify: `apps/web/src/index.css` (shadcn may inject CSS variables)
- Modify: `apps/web/package.json` (shadcn may add deps)

- [ ] **Step 1: Run shadcn init in the web app**

```bash
cd apps/web && bunx shadcn@latest init --yes
```

When prompted (if not auto-resolved by `--yes`):
- Style: **Default**
- Base color: **Neutral**
- CSS variables: **Yes**
- Path alias: confirm `@/*` (already configured in `tsconfig.app.json` and `vite.config.ts`)
- Tailwind config: **Tailwind v4** (auto-detected via `@tailwindcss/vite`)

If `bunx` cannot interpret flags interactively on Windows, run without `--yes` and accept the defaults at each prompt.

Expected output: creates `apps/web/components.json`, `apps/web/src/lib/utils.ts`, updates `apps/web/src/index.css` with theme variables, and installs `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` into `apps/web/package.json`.

- [ ] **Step 2: Verify components.json**

Run: `cat apps/web/components.json`

Expected: a JSON object with at least `style`, `tailwind`, `aliases.components` (`@/components`), `aliases.utils` (`@/lib/utils`), `aliases.ui` (`@/components/ui`).

- [ ] **Step 3: Add the Card primitive**

```bash
cd apps/web && bunx shadcn@latest add card
```

Expected: creates `apps/web/src/components/ui/card.tsx`.

- [ ] **Step 4: Verify the typecheck passes**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0 with no errors. shadcn-installed files should compile against React 19 + TS 5.9 cleanly.

- [ ] **Step 5: Verify dev server still boots**

```bash
cd apps/web && bun run dev
```

Open `http://localhost:5173/` — expect the existing placeholder ("Neuvetra" centered text) still renders. Stop the dev server (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git -C apps/web/.. add apps/web/components.json apps/web/src/lib/utils.ts apps/web/src/components/ui/card.tsx apps/web/src/index.css apps/web/package.json bun.lock
git commit -m "feat(web): initialize shadcn/ui and add Card primitive"
```

(If git complains about path resolution on Windows, run from the repo root: `cd C:\Users\nimab\Neuvetra\Site && git add apps/web/components.json apps/web/src/lib/utils.ts apps/web/src/components/ui/card.tsx apps/web/src/index.css apps/web/package.json bun.lock && git commit -m "feat(web): initialize shadcn/ui and add Card primitive"`)

---

## Task 2: Copy Spirit assets from FrontDesk

**Files (all created via copy, no rewriting):**
- Create: `apps/web/src/lib/spirit/engine.ts` (from `Neuvetra/FrontDesk/code/apps/web/src/lib/spirit/engine.ts`)
- Create: `apps/web/src/lib/spirit/particles.ts`
- Create: `apps/web/src/lib/spirit/shaders.ts`
- Create: `apps/web/src/lib/spirit/simulator.ts`
- Create: `apps/web/src/lib/spirit/spiritMachine.ts`
- Create: `apps/web/src/lib/spirit/spiritMachine.types.ts`
- Create: `apps/web/src/lib/spirit/spiritMachine.anchors.ts`
- Create: `apps/web/src/data/spirit-presets.ts`
- Create: `apps/web/public/audio/air-whoosh.mp3`
- Create: `apps/web/public/audio/ambient.wav`
- Create: `apps/web/public/audio/blink.mp3`
- Create: `apps/web/public/audio/button-click.mp3`
- Create: `apps/web/public/audio/hero-click-button.mp3`
- Create: `apps/web/public/audio/wosoh-soft.mp3`

- [ ] **Step 1: Copy Spirit code directory**

From `Site/`:

```bash
mkdir -p apps/web/src/lib/spirit apps/web/src/data apps/web/public/audio
cp -r ../FrontDesk/code/apps/web/src/lib/spirit/. apps/web/src/lib/spirit/
cp ../FrontDesk/code/apps/web/src/data/spirit-presets.ts apps/web/src/data/spirit-presets.ts
cp ../FrontDesk/code/apps/web/public/audio/. apps/web/public/audio/ -r
```

- [ ] **Step 2: Verify all expected files exist**

```bash
ls apps/web/src/lib/spirit/ apps/web/src/data/spirit-presets.ts apps/web/public/audio/
```

Expected files in `lib/spirit/`: `engine.ts`, `particles.ts`, `shaders.ts`, `simulator.ts`, `spiritMachine.ts`, `spiritMachine.types.ts`, `spiritMachine.anchors.ts`.
Expected in `data/`: `spirit-presets.ts`.
Expected in `public/audio/`: `air-whoosh.mp3`, `ambient.wav`, `blink.mp3`, `button-click.mp3`, `hero-click-button.mp3`, `wosoh-soft.mp3`.

- [ ] **Step 3: Run typecheck and resolve any import issues**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0. The Spirit code uses `@/data/spirit-presets` and relative imports — both should resolve since the `@/*` alias maps to `apps/web/src/*` and the directory structure is mirrored.

If errors appear, they are most likely because:
- A FrontDesk-specific dependency was assumed. Check `engine.ts` and `spiritMachine.ts` imports against the dep list in `apps/web/package.json`. The needed deps (`three`, `xstate`, `@xstate/react`, `react`) are already present.
- A type import resolves to a different version. Site uses `@types/three` `^0.184.0` and `xstate` `^5.30.0`, matching FrontDesk.

Fix by reconciling import paths. Do not modify Spirit logic.

- [ ] **Step 4: Verify dev server still boots and renders the existing placeholder**

```bash
cd apps/web && bun run dev
```

Open `http://localhost:5173/`. Expected: the existing placeholder still renders, no console errors. Spirit is not yet mounted in `App.tsx`, so nothing visual changes. Stop the dev server.

- [ ] **Step 5: Commit**

From the Site repo root:

```bash
git add apps/web/src/lib/spirit apps/web/src/data/spirit-presets.ts apps/web/public/audio
git commit -m "feat(web): copy Spirit engine and presets from FrontDesk"
```

---

## Task 3: Build the `useSpiritEngine` hook

**Files:**
- Create: `apps/web/src/hooks/useSpiritEngine.ts`

This hook adapts FrontDesk's `useSpirit` to v1's needs: mount the engine on a container ref, run the default preset (no XState machine for v1), unlock audio on first user gesture, dispose on unmount.

- [ ] **Step 1: Create `apps/web/src/hooks/useSpiritEngine.ts`**

```typescript
import { useEffect, useRef, type RefObject } from "react"
import { SpiritEngine } from "@/lib/spirit/engine"

/**
 * Mounts a SpiritEngine inside the given container element. Engine instance
 * is owned by the hook; cleanup runs on unmount. Audio context unlocks on
 * the first user gesture (touch or click) anywhere in the document.
 *
 * v1: no XState machine wired in. Engine runs its default preset.
 */
export function useSpiritEngine(
  containerRef: RefObject<HTMLDivElement | null>,
): { engineRef: RefObject<SpiritEngine | null> } {
  const engineRef = useRef<SpiritEngine | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const engine = new SpiritEngine()
    engineRef.current = engine

    engine
      .init(container)
      .catch((err) => console.error("[useSpiritEngine] init failed", err))

    const unlock = () => engineRef.current?.unlockAudio()
    document.addEventListener("touchstart", unlock, { once: true, passive: true })
    document.addEventListener("click", unlock, { once: true })

    return () => {
      document.removeEventListener("touchstart", unlock)
      document.removeEventListener("click", unlock)
      engine.dispose()
      engineRef.current = null
    }
  }, [containerRef])

  return { engineRef }
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useSpiritEngine.ts
git commit -m "feat(web): add useSpiritEngine hook"
```

---

## Task 4: Build the `Spirit` component (with reduced-motion fallback)

**Files:**
- Create: `apps/web/src/components/Spirit.tsx`

The `Spirit` component is a fixed-position container that the engine renders into, full-bleed behind everything else. If the user has `prefers-reduced-motion: reduce`, render a static gradient backdrop instead of mounting the live engine.

- [ ] **Step 1: Create `apps/web/src/components/Spirit.tsx`**

```typescript
import { useEffect, useRef, useState } from "react"
import { useSpiritEngine } from "@/hooks/useSpiritEngine"

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])
  return reduced
}

function SpiritCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  useSpiritEngine(containerRef)
  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ background: "#0b0c0d" }}
    />
  )
}

function ReducedMotionFallback() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(ellipse at 30% 40%, rgba(0, 68, 109, 0.55), transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(0, 16, 32, 0.85), transparent 60%), #0b0c0d",
      }}
    />
  )
}

export function Spirit() {
  const reduced = usePrefersReducedMotion()
  // Branch at this level so the hook (with its WebGL allocation) only runs
  // when motion is allowed. Mounting/unmounting <SpiritCanvas /> when the
  // OS-level preference flips is the desired behavior.
  return reduced ? <ReducedMotionFallback /> : <SpiritCanvas />
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Smoke-test by mounting Spirit in App.tsx temporarily**

Edit `apps/web/src/App.tsx` to add the Spirit alongside the existing placeholder text — this is a temporary check to verify the engine boots without errors. Replace the file contents with:

```typescript
import { Spirit } from "@/components/Spirit"

export function App() {
  return (
    <>
      <Spirit />
      <div className="relative z-10 min-h-screen flex items-center justify-center text-white/60">
        <p className="text-sm uppercase tracking-widest text-blue-500">Neuvetra</p>
      </div>
    </>
  )
}
```

Run dev server:

```bash
cd apps/web && bun run dev
```

Open `http://localhost:5173/`. Expected:
- Background renders as the Spirit's deep-blue/teal particle field on near-black.
- "Neuvetra" text is visible above it.
- No console errors.

If `prefers-reduced-motion: reduce` is set in your OS, expect the static gradient fallback instead.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/Spirit.tsx apps/web/src/App.tsx
git commit -m "feat(web): mount Spirit canvas with reduced-motion fallback"
```

---

## Task 5: Build the `Hero` component

**Files:**
- Create: `apps/web/src/components/Hero.tsx`

- [ ] **Step 1: Create `apps/web/src/components/Hero.tsx`**

```typescript
// Placeholder copy. Final wording authored by Nima — edit the strings below.
const TITLE = "Neuvetra"
const SLOGAN = "AI tools for businesses."

export function Hero() {
  return (
    <header className="text-center">
      <h1 className="text-6xl md:text-8xl font-semibold tracking-tight text-white">
        {TITLE}
      </h1>
      <p className="mt-4 text-lg md:text-xl text-white/60">{SLOGAN}</p>
    </header>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/Hero.tsx
git commit -m "feat(web): add Hero component"
```

---

## Task 6: Build the `ProductCard` component

**Files:**
- Create: `apps/web/src/components/ProductCard.tsx`

A big square card with a product name centered. Hover state lifts and brightens the border. Built on shadcn's `Card`.

- [ ] **Step 1: Create `apps/web/src/components/ProductCard.tsx`**

```typescript
import { Card } from "@/components/ui/card"

export interface ProductCardProps {
  name: string
  onClick?: () => void  // Reserved for future routing — unused in v1.
}

export function ProductCard({ name, onClick }: ProductCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={[
        "aspect-square w-56 md:w-72",
        "flex items-center justify-center",
        "bg-white/5 hover:bg-white/10",
        "border border-white/10 hover:border-white/30",
        "backdrop-blur-md",
        "transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10",
        "cursor-pointer select-none",
      ].join(" ")}
    >
      <span className="text-2xl md:text-3xl font-medium tracking-wide text-white">
        {name}
      </span>
    </Card>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ProductCard.tsx
git commit -m "feat(web): add ProductCard component"
```

---

## Task 7: Compose the homepage in `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Replace `apps/web/src/App.tsx` with the composed homepage**

```typescript
import { Spirit } from "@/components/Spirit"
import { Hero } from "@/components/Hero"
import { ProductCard } from "@/components/ProductCard"

export function App() {
  return (
    <>
      <Spirit />
      <main className="relative z-10 min-h-screen flex items-center justify-center px-6 py-12 bg-[#0b0c0d]/0">
        <div className="flex flex-col items-center gap-12 md:gap-16">
          <Hero />
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
            <ProductCard name="Terrascope" />
            <ProductCard name="FrontDesk" />
          </div>
        </div>
      </main>
    </>
  )
}
```

Notes for the engineer:
- `bg-[#0b0c0d]/0` keeps the main element transparent so the Spirit canvas behind it is visible. The `/0` is intentional — we don't want a solid background here. The base body background is the Spirit's container itself.
- Vertical centering uses `min-h-screen flex items-center justify-center`; cards and hero stack vertically with `gap-12 md:gap-16`.
- On viewports below `md` (768px), product cards stack vertically (`flex-col md:flex-row`) per acceptance criterion 5.

- [ ] **Step 2: Verify the typecheck passes**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Verify lint passes**

```bash
cd apps/web && bun run lint
```

Expected: exits 0. If it complains about an unused `onClick` prop on `ProductCard` because we never pass one, it's a false positive — the prop is `?` optional and reserved.

- [ ] **Step 4: Verify the dev server renders the page correctly**

```bash
cd apps/web && bun run dev
```

Open `http://localhost:5173/`. Expected at viewport ≥ 1280×800:
- Spirit particle field running smoothly behind everything.
- "Neuvetra" rendered large and prominent in the upper portion of the centered group.
- Slogan "AI tools for businesses." beneath the title.
- Two equal-sized square cards labelled "Terrascope" and "FrontDesk" beneath the hero text, side by side.
- Hovering a card produces a subtle lift / brighter border.
- Clicking a card does nothing (no navigation, no console error).
- No vertical scroll on a normal laptop viewport.

Resize the window narrow (< 768px). Expected: cards stack vertically; layout remains usable.

If reduced-motion is enabled in the OS, the Spirit is replaced by a static gradient.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): compose homepage with Spirit, Hero, and product cards"
```

---

## Task 8: Final acceptance verification

- [ ] **Step 1: Run typecheck across both apps**

From the Site root:

```bash
bun run typecheck
```

Expected: both `web` and `api` exit 0.

- [ ] **Step 2: Run lint**

```bash
bun run lint
```

Expected: web exits 0 (api has no lint script — Turbo will skip it cleanly).

- [ ] **Step 3: Run build**

```bash
bun run build
```

Expected: web build succeeds (`dist/` populated; api has no build step).

- [ ] **Step 4: Final manual viewport check**

```bash
bun run dev
```

Walk through every acceptance criterion from the spec (`docs/superpowers/specs/2026-04-26-site-homepage-design.md`):

1. ✅ `bun run dev` boots; `http://localhost:5173/` shows Spirit + "Neuvetra" + slogan + two square cards labelled "Terrascope" and "FrontDesk".
2. ✅ Hovering a card produces a subtle visual response.
3. ✅ Clicking a card does nothing (no navigation, no console error).
4. ✅ Page does not scroll on a normal laptop viewport (≥ 1280×800).
5. ✅ On a narrow viewport (< 768px), cards stack vertically; layout remains usable.
6. ✅ `prefers-reduced-motion: reduce` swaps the Spirit canvas for a static gradient.
7. ✅ `bun run typecheck`, `bun run lint`, `bun run build` all pass.

Stop the dev server.

- [ ] **Step 5: If any commits accumulated since the last task, commit them as a final touch-up**

```bash
git status
# If anything is uncommitted, add and commit it with a meaningful message.
```

If everything was already committed in the per-task commits, this step is a no-op.

- [ ] **Step 6: Report completion to the user**

Summarize: "Homepage v1 shipped. `/` now shows the Spirit + Neuvetra title + slogan + two product cards. Cards are hover-reactive but non-functional. All seven acceptance gates pass. Ready for Nima to push around."
