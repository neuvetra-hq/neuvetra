# SpiritMachine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the imperative `engine.transition()` call with a parallel XState v5 machine (`spiritMachine`) that owns all Spirit behavior — visuals, attractor movement, speed surges, and audio state — and communicates with `SpiritEngine` through typed events.

**Architecture:** `createSpiritMachine(engineRef)` is a factory that captures a `RefObject<SpiritEngine | null>` in a closure; actions call `engineRef.current?.method()` safely. `AppLayout` creates the engine ref, creates the actor, initialises the engine into the container div, and wraps children in `SpiritActorContext.Provider`. `SpiritEngine` gains four setter methods (`setVisualTarget`, `setAttractorTarget`, `setSurge`, `setMuted`) and loses `transition()` and `toggleMute()`. The `appMachine` audio region is deleted; SpiritMachine's `audio` region is the single source of truth for mute state.

**Tech Stack:** XState v5 (`xstate`, `@xstate/react` — already installed), Three.js (existing), Playwright for E2E tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/lib/spirit/spiritMachine.types.ts` | `SpiritMachineContext`, `SpiritEvent` union, `NamedAnchor` |
| Create | `apps/web/src/lib/spirit/spiritMachine.anchors.ts` | Named anchor → `{x,y,z}` map |
| Create | `apps/web/src/lib/spirit/spiritMachine.ts` | `createSpiritMachine(engineRef)` factory + machine definition |
| Create | `apps/web/src/hooks/useSpiritMachine.ts` | React context, `useSpiritMachine` selector hook, `useSpiritSend` hook |
| Modify | `apps/web/src/lib/spirit/engine.ts` | Add `setVisualTarget`, `setAttractorTarget`, `setSurge`, `setMuted`, `unlockAudio`, `playSFX`; remove `transition`, `toggleMute`; refactor `_tick` |
| Modify | `apps/web/src/data/spirit-presets.ts` | Add `SFX` registry |
| Modify | `apps/web/src/hooks/useSpirit.ts` | Remove `transition` export; expose `engineRef` |
| Modify | `apps/web/src/pages/app/machine/appMachine.ts` | Remove `audio` region + `USER_INTERACTED`/`TOGGLE_MUTE` events |
| Modify | `apps/web/src/components/layout/AppLayout.tsx` | Create engine + actor; wire events; read audio from SpiritMachine |
| Modify | `apps/web/tests/app-route.spec.ts` | Add mute button tests |

---

## Task 1: Write failing Playwright tests (TDD)

Add new tests for mute button behavior driven by the SpiritMachine `audio` region. These will fail until Task 9 wires everything up.

**Files:**
- Modify: `apps/web/tests/app-route.spec.ts`

- [ ] **Step 1: Add the two new tests**

Replace the full contents of `apps/web/tests/app-route.spec.ts`:

```typescript
import { test, expect, type Page } from "@playwright/test"

async function mockNoWebGL2(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext.bind(HTMLCanvasElement.prototype)
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2") return null
      return original.apply(this, [type, ...args] as Parameters<typeof original>)
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
    await expect(page.locator("div.absolute.inset-0").first()).toBeAttached()
    await expect(page.locator("nav")).toBeVisible()
  })

  test("shows loader on arrival then hides it after engine init", async ({ page }) => {
    await page.goto("/app")
    const loader = page.getByTestId("app-loader")
    await expect(loader).toBeAttached()
    await expect(loader).not.toBeAttached({ timeout: 10000 })
    await expect(page.locator("nav")).toBeVisible()
  })

  test("mute button is hidden before first user interaction", async ({ page }) => {
    await page.goto("/app")
    // Audio is locked until user gesture — mute button must not be visible
    const muteBtn = page.getByRole("button", { name: /mute|unmute/i })
    await expect(muteBtn).toBeHidden()
  })

  test("mute button appears after first interaction and toggles label", async ({ page }) => {
    await page.goto("/app")
    // Trigger USER_INTERACTED via click
    await page.locator("body").click()
    const muteBtn = page.getByRole("button", { name: /mute|unmute/i })
    await expect(muteBtn).toBeVisible({ timeout: 3000 })
    // Default state is unmuted — button says "Mute"
    await expect(muteBtn).toHaveAttribute("aria-label", "Mute")
    // Click to mute
    await muteBtn.click()
    await expect(muteBtn).toHaveAttribute("aria-label", "Unmute")
    // Click to unmute
    await muteBtn.click()
    await expect(muteBtn).toHaveAttribute("aria-label", "Mute")
  })
})
```

- [ ] **Step 2: Run tests — confirm first 3 pass, last 2 fail**

```bash
cd apps/web && bun run test:e2e --reporter=line 2>&1 | tail -20
```

Expected: 3 pass, 2 fail (mute button tests fail because wiring isn't done yet).

---

## Task 2: Types

**Files:**
- Create: `apps/web/src/lib/spirit/spiritMachine.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// apps/web/src/lib/spirit/spiritMachine.types.ts
import type { SpiritPreset } from "@/data/spirit-presets"

export type NamedAnchor =
  | "center"
  | "top"
  | "bottom"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight"

export interface SpiritMachineContext {
  // visual
  currentPreset:    SpiritPreset
  fromPreset:       SpiritPreset
  toPreset:         SpiritPreset | null
  visualDurationMs: number
  // attractor
  attractorTarget:  { x: number; y: number; z: number } | null
  holdMs:           number
  returnMs:         number
  kickAngle:        number
  // motion
  surgeIntensity:   number
  surgeDurationMs:  number
}

export type SpiritEvent =
  | { type: "SET_PRESET";    name: string; durationMs?: number }
  | { type: "CHANGE_COLORS"; color1?: string; color2?: string; bgColor?: string; durationMs?: number }
  | { type: "MOVE_TO";       target: NamedAnchor | { x: number; y: number; z: number }; holdMs?: number; returnMs?: number }
  | { type: "WANDER" }
  | { type: "SURGE";         intensity?: number; durationMs?: number; kickAngle?: number }
  | { type: "SET_SPEED";     speed: number; followSpeed?: number }
  | { type: "SET_CURL";      curlSize: number; attraction?: number }
  | { type: "PLAY_SFX";      name: string }
  | { type: "USER_INTERACTED" }
  | { type: "TOGGLE_MUTE" }
  | { type: "RESET" }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/spirit/spiritMachine.types.ts
git commit -m "feat(spirit): add SpiritMachine types"
```

---

## Task 3: Named anchors

**Files:**
- Create: `apps/web/src/lib/spirit/spiritMachine.anchors.ts`

- [ ] **Step 1: Create the anchors file**

```typescript
// apps/web/src/lib/spirit/spiritMachine.anchors.ts
import type { NamedAnchor } from "./spiritMachine.types"

export const ANCHORS: Record<NamedAnchor, { x: number; y: number; z: number }> = {
  center:      { x:    0, y:   0, z:    0 },
  top:         { x:    0, y:  80, z:    0 },
  bottom:      { x:    0, y: -60, z:    0 },
  topLeft:     { x: -180, y:  80, z: -180 },
  topRight:    { x:  180, y:  80, z: -180 },
  bottomLeft:  { x: -180, y: -60, z:  180 },
  bottomRight: { x:  180, y: -60, z:  180 },
}

export function resolveTarget(
  target: NamedAnchor | { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return typeof target === "string" ? ANCHORS[target] : target
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/spirit/spiritMachine.anchors.ts
git commit -m "feat(spirit): add named anchor map"
```

---

## Task 4: SFX registry

**Files:**
- Modify: `apps/web/src/data/spirit-presets.ts`

- [ ] **Step 1: Add SFX export after the AUDIO export**

Open `apps/web/src/data/spirit-presets.ts` and append after the `AUDIO` export at the bottom:

```typescript
export const SFX: Record<string, string> = {
  whoosh: "/audio/sfx/whoosh.mp3",
  click:  "/audio/sfx/click.mp3",
  chime:  "/audio/sfx/chime.mp3",
  surge:  "/audio/sfx/surge.mp3",
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/data/spirit-presets.ts
git commit -m "feat(spirit): add SFX registry"
```

---

## Task 5: Refactor SpiritEngine

Remove `transition()` and `toggleMute()`. Add `setVisualTarget`, `setAttractorTarget`, `setSurge`, `setMuted`, `unlockAudio`, `playSFX`. Refactor `_tick` to use the new separate surge + attractor state.

**Files:**
- Modify: `apps/web/src/lib/spirit/engine.ts`

- [ ] **Step 1: Update AudioEngine inside engine.ts**

Replace the `toggleMute` method on `AudioEngine` with `setMuted`:

```typescript
setMuted(muted: boolean): void {
  this.muted = muted
  if (this.ambientGain) this.ambientGain.gain.value = muted ? 0 : AUDIO.ambientVolume
}
```

Remove the old `toggleMute(): boolean` method from `AudioEngine`.

- [ ] **Step 2: Replace SpiritEngine private fields**

Remove these fields from `SpiritEngine`:
```typescript
private lerpState: { from: SpiritPreset; to: SpiritPreset; elapsed: number; active: boolean; kickAngle: number } | null = null
```

Add these fields:
```typescript
private visualLerp: { from: SpiritPreset; to: SpiritPreset; elapsed: number; durationMs: number; active: boolean } | null = null
private attractorTarget: { x: number; y: number; z: number } | null = null
private attractorKickAngle = 0
private surgeState: { elapsed: number; intensity: number; durationMs: number } | null = null
```

- [ ] **Step 3: Replace SpiritEngine public methods**

Remove `transition()` and `toggleMute()` entirely. Add these public methods:

```typescript
setVisualTarget(from: SpiritPreset, to: SpiritPreset, durationMs: number): void {
  this.visualLerp = { from, to, elapsed: 0, durationMs, active: true }
}

setAttractorTarget(pos: { x: number; y: number; z: number } | null, kickAngle: number): void {
  this.attractorTarget = pos
  this.attractorKickAngle = kickAngle
}

setSurge(intensity: number, durationMs: number, kickAngle?: number): void {
  this.surgeState = { elapsed: 0, intensity, durationMs }
  if (kickAngle !== undefined) this.attractorKickAngle = kickAngle
}

unlockAudio(): void {
  this.audio?.unlock()
}

setMuted(muted: boolean): void {
  this.audio?.setMuted(muted)
}

playSFX(name: string): void {
  this.audio?.playSFX(name)
}
```

- [ ] **Step 4: Refactor `_tick` — replace the lerp/burst block**

Find this block in `_tick` (from `// Advance transition` to the end of the follow-point kick) and replace it entirely:

```typescript
// ── Visual lerp ──────────────────────────────────────────────────────────────
let current = this.currentPreset
if (this.visualLerp?.active) {
  this.visualLerp.elapsed += dt
  const t = Math.min(this.visualLerp.elapsed / this.visualLerp.durationMs, 1)
  const eased = t * t * (3 - 2 * t)
  current = this._lerp(this.visualLerp.from, this.visualLerp.to, eased)
  if (t >= 1) {
    this.currentPreset = this.visualLerp.to
    this.visualLerp.active = false
  }
}

// ── Surge overlay ─────────────────────────────────────────────────────────────
let surgeFactor = 0
if (this.surgeState) {
  this.surgeState.elapsed += dt
  const t = Math.min(this.surgeState.elapsed / this.surgeState.durationMs, 1)
  surgeFactor = Math.sin(Math.PI * t) * this.surgeState.intensity
  if (t >= 1) this.surgeState = null
}
current = { ...current, speed: current.speed + surgeFactor }

// ── Follow point ──────────────────────────────────────────────────────────────
const effectiveFollowSpeed = current.followSpeed * (1 + surgeFactor * 7)
this.followTime += dt * 0.001 * effectiveFollowSpeed
const wanderX = Math.cos(this.followTime) * FOLLOW_R
const wanderY = Math.cos(this.followTime * 4) * FOLLOW_H
const wanderZ = Math.sin(this.followTime * 2) * FOLLOW_R

if (this.attractorTarget) {
  // Lerp toward machine-specified target
  this.followPoint.lerp(
    new THREE.Vector3(this.attractorTarget.x, this.attractorTarget.y, this.attractorTarget.z),
    0.04,
  )
} else {
  // Wander / returning — ease back to Lissajous orbit
  this.followPoint.lerp(new THREE.Vector3(wanderX, wanderY, wanderZ), 0.04)
}

// Kick offset riding on surge
if (surgeFactor > 0) {
  const kick = surgeFactor * 420
  this.followPoint.x += Math.cos(this.attractorKickAngle) * kick
  this.followPoint.z += Math.sin(this.attractorKickAngle) * kick
  this.followPoint.y += surgeFactor * 100
}
```

Also remove the `TRANSITION_BURST` constant and the `_scheduleCycle` private method if it no longer references `lerpState` (the auto-cycle timer used `transition()` internally — update it to call `setVisualTarget` + `setSurge` directly, or remove it; the machine will own cycling).

- [ ] **Step 5: Remove `_scheduleCycle` and `cycleTimer` / `cycleIndex`**

The machine owns preset cycling now. Remove these from `SpiritEngine`:
- `private cycleTimer`
- `private cycleIndex`
- `private _scheduleCycle()`
- The `this._scheduleCycle()` call in `init()`

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd apps/web && bun run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors referencing `engine.ts`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/spirit/engine.ts
git commit -m "refactor(spirit): replace transition()/toggleMute() with setter API"
```

---

## Task 6: Machine definition

**Files:**
- Create: `apps/web/src/lib/spirit/spiritMachine.ts`

- [ ] **Step 1: Create the machine**

```typescript
// apps/web/src/lib/spirit/spiritMachine.ts
import { setup, assign } from "xstate"
import type { RefObject } from "react"
import { PRESETS } from "@/data/spirit-presets"
import { resolveTarget } from "./spiritMachine.anchors"
import type { SpiritMachineContext, SpiritEvent } from "./spiritMachine.types"
import type { SpiritEngine } from "./engine"
import type { SpiritPreset } from "@/data/spirit-presets"

export type SpiritMachineSnapshot = ReturnType<typeof createSpiritMachine> extends
  { transition: (...args: any[]) => infer S } ? S : never

export function createSpiritMachine(engineRef: RefObject<SpiritEngine | null>) {
  const eng = () => engineRef.current

  return setup({
    types: {} as {
      context: SpiritMachineContext
      events: SpiritEvent
    },
    guards: {
      isKnownPreset: ({ event }) =>
        event.type === "SET_PRESET" && event.name in PRESETS,
    },
    actions: {
      // ── visual ───────────────────────────────────────────────────────
      applyPreset: assign(({ context, event }) => {
        const e = event as Extract<SpiritEvent, { type: "SET_PRESET" }>
        const to = PRESETS[e.name]
        const from = context.currentPreset
        const durationMs = e.durationMs ?? 1400
        eng()?.setVisualTarget(from, to, durationMs)
        return { fromPreset: from, toPreset: to, visualDurationMs: durationMs }
      }),

      applyColors: assign(({ context, event }) => {
        const e = event as Extract<SpiritEvent, { type: "CHANGE_COLORS" }>
        const to: SpiritPreset = { ...context.currentPreset }
        if (e.color1)  to.color1  = e.color1
        if (e.color2)  to.color2  = e.color2
        if (e.bgColor) to.bgColor = e.bgColor
        const durationMs = e.durationMs ?? 1400
        eng()?.setVisualTarget(context.currentPreset, to, durationMs)
        return { fromPreset: context.currentPreset, toPreset: to, visualDurationMs: durationMs }
      }),

      commitPreset: assign(({ context }) => ({
        currentPreset: context.toPreset ?? context.currentPreset,
        toPreset: null,
      })),

      resetVisual: assign(() => {
        eng()?.setVisualTarget(PRESETS.default, PRESETS.default, 0)
        return { currentPreset: PRESETS.default, fromPreset: PRESETS.default, toPreset: null }
      }),

      // ── attractor ────────────────────────────────────────────────────
      applyAttractorTarget: assign(({ event }) => {
        const e = event as Extract<SpiritEvent, { type: "MOVE_TO" }>
        const pos = resolveTarget(e.target)
        const kickAngle = Math.random() * Math.PI * 2
        eng()?.setAttractorTarget(pos, kickAngle)
        return {
          attractorTarget: pos,
          holdMs: e.holdMs ?? 2000,
          returnMs: e.returnMs ?? 1200,
          kickAngle,
        }
      }),

      beginReturn: ({ context }) => {
        eng()?.setAttractorTarget(null, context.kickAngle)
      },

      clearAttractorTarget: assign(() => {
        eng()?.setAttractorTarget(null, 0)
        return { attractorTarget: null }
      }),

      // ── motion ───────────────────────────────────────────────────────
      applySurge: assign(({ event }) => {
        const e = event as Extract<SpiritEvent, { type: "SURGE" }>
        const intensity  = e.intensity  ?? 0.55
        const durationMs = e.durationMs ?? 1400
        const kickAngle  = e.kickAngle  ?? Math.random() * Math.PI * 2
        eng()?.setSurge(intensity, durationMs, kickAngle)
        return { surgeIntensity: intensity, surgeDurationMs: durationMs, kickAngle }
      }),

      applySpeed: assign(({ context, event }) => {
        const e = event as Extract<SpiritEvent, { type: "SET_SPEED" }>
        const patched: SpiritPreset = {
          ...context.currentPreset,
          speed: e.speed,
          followSpeed: e.followSpeed ?? context.currentPreset.followSpeed,
        }
        eng()?.setVisualTarget(patched, patched, 0)
        return { currentPreset: patched }
      }),

      applyCurl: assign(({ context, event }) => {
        const e = event as Extract<SpiritEvent, { type: "SET_CURL" }>
        const patched: SpiritPreset = {
          ...context.currentPreset,
          curlSize: e.curlSize,
          attraction: e.attraction ?? context.currentPreset.attraction,
        }
        eng()?.setVisualTarget(patched, patched, 0)
        return { currentPreset: patched }
      }),

      autoSurgePreset: () => {
        const kickAngle = Math.random() * Math.PI * 2
        eng()?.setSurge(0.55, 1400, kickAngle)
      },

      autoSurgeMove: () => {
        const kickAngle = Math.random() * Math.PI * 2
        eng()?.setSurge(0.4, 800, kickAngle)
      },

      // ── audio ────────────────────────────────────────────────────────
      unlockAudio: () => { eng()?.unlockAudio() },
      playSFX:     ({ event }) => {
        const e = event as Extract<SpiritEvent, { type: "PLAY_SFX" }>
        eng()?.playSFX(e.name)
      },
      setMuted:    (_, params: { muted: boolean }) => { eng()?.setMuted(params.muted) },
    },
  }).createMachine({
    id: "spirit",
    type: "parallel",
    context: {
      currentPreset:    PRESETS.default,
      fromPreset:       PRESETS.default,
      toPreset:         null,
      visualDurationMs: 1400,
      attractorTarget:  null,
      holdMs:           2000,
      returnMs:         1200,
      kickAngle:        0,
      surgeIntensity:   0.55,
      surgeDurationMs:  1400,
    },
    on: {
      RESET: {
        actions: ["resetVisual", "clearAttractorTarget"],
        target: "#spirit.motion.calm",
      },
      SET_SPEED: { actions: "applySpeed" },
      SET_CURL:  { actions: "applyCurl" },
    },
    states: {

      // ── attractor ──────────────────────────────────────────────────────
      attractor: {
        initial: "wandering",
        on: {
          WANDER: { target: ".wandering", actions: "clearAttractorTarget" },
        },
        states: {
          wandering: {
            entry: "clearAttractorTarget",
            on: {
              MOVE_TO: {
                target: "targeting",
                actions: ["applyAttractorTarget", "autoSurgeMove"],
              },
            },
          },
          targeting: {
            after: {
              holdMs: { target: "returning", actions: "beginReturn" },
            },
          },
          returning: {
            after: {
              returnMs: { target: "wandering" },
            },
          },
        },
      },

      // ── visual ─────────────────────────────────────────────────────────
      visual: {
        initial: "stable",
        on: {
          SET_PRESET: {
            guard: "isKnownPreset",
            target: ".transitioning",
            actions: ["applyPreset", "autoSurgePreset"],
          },
          CHANGE_COLORS: {
            target: ".transitioning",
            actions: "applyColors",
          },
        },
        states: {
          stable: {},
          transitioning: {
            after: {
              visualDurationMs: { target: "stable", actions: "commitPreset" },
            },
            on: {
              // Re-entrant: restart transition from mid-lerp snapshot
              SET_PRESET: {
                guard: "isKnownPreset",
                target: "transitioning",
                reenter: true,
                actions: ["applyPreset", "autoSurgePreset"],
              },
              CHANGE_COLORS: {
                target: "transitioning",
                reenter: true,
                actions: "applyColors",
              },
            },
          },
        },
      },

      // ── motion ─────────────────────────────────────────────────────────
      motion: {
        initial: "calm",
        on: {
          SURGE: { target: ".surging", actions: "applySurge" },
        },
        states: {
          calm: {},
          surging: {
            after: {
              surgeDurationMs: { target: "calm" },
            },
            on: {
              SURGE: { target: "surging", reenter: true, actions: "applySurge" },
            },
          },
        },
      },

      // ── audio ──────────────────────────────────────────────────────────
      audio: {
        initial: "locked",
        states: {
          locked: {
            on: {
              USER_INTERACTED: { target: "unlocked", actions: "unlockAudio" },
            },
          },
          unlocked: {
            initial: "unmuted",
            states: {
              unmuted: {
                entry: { type: "setMuted", params: { muted: false } },
                on: {
                  TOGGLE_MUTE: { target: "muted" },
                  PLAY_SFX:    { actions: "playSFX" },
                },
              },
              muted: {
                entry: { type: "setMuted", params: { muted: true } },
                on: {
                  TOGGLE_MUTE: { target: "unmuted" },
                },
              },
            },
          },
        },
      },

    },
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && bun run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors from `spiritMachine.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/spirit/spiritMachine.ts
git commit -m "feat(spirit): add spiritMachine parallel machine"
```

---

## Task 7: React context and hooks

**Files:**
- Create: `apps/web/src/hooks/useSpiritMachine.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/web/src/hooks/useSpiritMachine.ts
import { createContext, useContext } from "react"
import { useSelector } from "@xstate/react"
import type { Actor, SnapshotFrom } from "xstate"
import type { createSpiritMachine } from "@/lib/spirit/spiritMachine"

type SpiritActor = Actor<ReturnType<typeof createSpiritMachine>>
export type SpiritSnapshot = SnapshotFrom<ReturnType<typeof createSpiritMachine>>

export const SpiritActorContext = createContext<SpiritActor | null>(null)

export function useSpiritMachine<T>(selector: (s: SpiritSnapshot) => T): T {
  const actor = useContext(SpiritActorContext)
  if (!actor) throw new Error("useSpiritMachine must be used inside AppLayout")
  return useSelector(actor, selector)
}

export function useSpiritSend() {
  const actor = useContext(SpiritActorContext)
  if (!actor) throw new Error("useSpiritSend must be used inside AppLayout")
  return actor.send
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useSpiritMachine.ts
git commit -m "feat(spirit): add useSpiritMachine hooks"
```

---

## Task 8: Update useSpirit.ts

Remove `transition()` (replaced by machine events). Expose `engineRef` so `AppLayout` can pass it to the machine factory.

**Files:**
- Modify: `apps/web/src/hooks/useSpirit.ts`

- [ ] **Step 1: Replace the file**

```typescript
// apps/web/src/hooks/useSpirit.ts
import { useRef, useEffect, type RefObject } from "react"
import { SpiritEngine } from "@/lib/spirit/engine"

export function useSpirit(
  containerRef: RefObject<HTMLDivElement | null>,
  onReady?: () => void,
): { engineRef: RefObject<SpiritEngine | null> } {
  const engineRef = useRef<SpiritEngine | null>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const engine = new SpiritEngine()
    engineRef.current = engine
    const MIN_BOOT_MS = 1200
    Promise.all([
      engine.init(container),
      new Promise<void>(r => setTimeout(r, MIN_BOOT_MS)),
    ])
      .then(() => onReadyRef.current?.())
      .catch(err => console.error("[useSpirit] engine init failed", err))
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  return { engineRef }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useSpirit.ts
git commit -m "refactor(spirit): remove transition() from useSpirit, expose engineRef"
```

---

## Task 9: Wire AppLayout

Replace imperative `transition()` + `toggleMute()` calls with machine events. Create the actor inside `AppLayout` and provide context to children. Read audio state from SpiritMachine.

**Files:**
- Modify: `apps/web/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Replace AppLayout.tsx**

```typescript
// apps/web/src/components/layout/AppLayout.tsx
import { useRef, useEffect, useState } from "react"
import { NavLink, useLocation, useOutlet } from "react-router"
import { AnimatePresence, motion } from "framer-motion"
import { createActor } from "xstate"
import { useSpirit } from "@/hooks/useSpirit"
import { useAppSend } from "@/pages/app/hooks/useAppMachine"
import { SpiritActorContext, useSpiritMachine, useSpiritSend } from "@/hooks/useSpiritMachine"
import { SpiritContext } from "@/contexts/SpiritContext"
import { createSpiritMachine } from "@/lib/spirit/spiritMachine"

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

// Inner component — rendered inside SpiritActorContext.Provider so hooks work
function AppLayoutInner() {
  const location = useLocation()
  const sendApp = useAppSend()
  const sendSpirit = useSpiritSend()

  const isLoading     = useSpiritMachine((s) => s.matches({ visual: "stable" }) === false
    // loading = appMachine view.loading — keep reading from appMachine for this
    // We still need isLoading from appMachine; see note below
    && false // placeholder — see Step 2
  )
  const audioUnlocked = useSpiritMachine((s) => !s.matches({ audio: "locked" }))
  const isMuted       = useSpiritMachine((s) => s.matches({ audio: { unlocked: "muted" } }))

  useEffect(() => {
    const preset = ROUTE_PRESET[location.pathname]
    if (preset) sendSpirit({ type: "SET_PRESET", name: preset })
  }, [location.pathname])

  useEffect(() => {
    sendSpirit({ type: "ROUTE_CHANGED" as any, pathname: location.pathname })
  }, [location.pathname, sendSpirit])

  useEffect(() => {
    const handler = () => sendSpirit({ type: "USER_INTERACTED" })
    document.addEventListener("click",      handler, { once: true })
    document.addEventListener("keydown",    handler, { once: true })
    document.addEventListener("touchstart", handler, { once: true })
    return () => {
      document.removeEventListener("click",      handler)
      document.removeEventListener("keydown",    handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [sendSpirit])

  return (
    <>
      <style>{`
        @keyframes soundbar {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
      `}</style>

      <div className="absolute top-9 right-10 z-50">
        <button
          onClick={() => sendSpirit({ type: "TOGGLE_MUTE" })}
          aria-label={isMuted ? "Unmute" : "Mute"}
          className={`flex items-end gap-[3px] h-5 transition-opacity duration-500 cursor-pointer ${
            audioUnlocked ? "opacity-40 hover:opacity-90" : "opacity-0 pointer-events-none"
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

      <nav className="absolute bottom-10 left-0 right-0 z-50 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 select-none">
        {NAV_LINKS.map((link) => (
          <NavItem key={link.href} label={link.href} href={link.href} end={link.end} />
        ))}
      </nav>

      <AnimatedOutlet />
    </>
  )
}

export function AppLayout() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sendApp = useAppSend()

  const { engineRef } = useSpirit(containerRef, () => {
    sendApp({ type: "SPIRIT_READY" })
  })

  const [actor] = useState(() => createActor(createSpiritMachine(engineRef)))

  useEffect(() => {
    actor.start()
    return () => actor.stop()
  }, [actor])

  return (
    <SpiritActorContext.Provider value={actor}>
      <SpiritContext.Provider value={{}}>
        <div
          className="relative w-screen h-screen overflow-hidden"
          style={{ background: "radial-gradient(circle at 3% 5%, #253239 0%, #0b0c0d 50%)" }}
        >
          <div ref={containerRef} className="absolute inset-0" />
          <AppLayoutInner />
          <AppLoaderOverlay />
        </div>
      </SpiritContext.Provider>
    </SpiritActorContext.Provider>
  )
}
```

- [ ] **Step 2: Fix `isLoading` and `AppLoaderOverlay`**

`isLoading` still needs to come from `appMachine` (the `view.loading` state is in `appMachine`, not `spiritMachine`). Add this import and fix the component:

```typescript
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"
```

Add `AppLoaderOverlay` as a separate inner component (needs `useAppMachine`):

```typescript
function AppLoaderOverlay() {
  const isLoading = useAppMachine((s) => s.matches({ view: "loading" }))
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          data-testid="app-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0 z-[200] flex items-center justify-center"
          style={{ background: "#0b0c0d" }}
        >
          <span
            className="text-[0.6rem] uppercase tracking-[0.3em]"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            Loading
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

Remove the broken `isLoading` from `AppLayoutInner` (delete that `useSpiritMachine` call entirely).

Also remove `ROUTE_CHANGED` from the second `useEffect` in `AppLayoutInner` — that event is still handled by `appMachine`, so send it via `sendApp`:

```typescript
// In AppLayoutInner:
useEffect(() => {
  sendApp({ type: "ROUTE_CHANGED", pathname: location.pathname })
}, [location.pathname, sendApp])
```

Fix the `NavItem` label prop — it was `label={link.href}`, change back to `label={link.label}`.

- [ ] **Step 3: Update SpiritContext**

`SpiritContext` previously provided `{ transition, toggleMute }`. Since `AppLayout` now passes `{}`, update the context type. Open `apps/web/src/contexts/SpiritContext.tsx` and change it to:

```typescript
import { createContext } from "react"

export const SpiritContext = createContext<Record<string, never>>({})
```

If nothing consumes `SpiritContext` elsewhere, you can remove it entirely from `AppLayout` too — check with:

```bash
grep -r "SpiritContext" apps/web/src --include="*.tsx" --include="*.ts"
```

If no consumers besides `AppLayout`, remove the `SpiritContext.Provider` wrapper.

- [ ] **Step 4: Build check**

```bash
cd apps/web && bun run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/AppLayout.tsx apps/web/src/contexts/SpiritContext.tsx
git commit -m "feat(spirit): wire AppLayout to SpiritMachine"
```

---

## Task 10: Remove audio region from appMachine

**Files:**
- Modify: `apps/web/src/pages/app/machine/appMachine.ts`

- [ ] **Step 1: Remove audio region and events**

In `appMachine.ts`:
1. Remove the entire `audio` region from the parallel states object (the `audio: { initial: "dormant", states: { dormant: ..., active: ... } }` block)
2. Remove `USER_INTERACTED` and `TOGGLE_MUTE` from the `AppEvent` type in `appMachine.types.ts`
3. Remove the `clearAuth` and other actions only used by audio if any (check — likely none)

The `AppEvent` type (in `appMachine.types.ts`) should no longer include:
```typescript
| { type: "USER_INTERACTED" }
| { type: "TOGGLE_MUTE" }
```

- [ ] **Step 2: Build check**

```bash
cd apps/web && bun run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/app/machine/appMachine.ts apps/web/src/pages/app/machine/appMachine.types.ts
git commit -m "refactor(app): remove audio region from appMachine — owned by spiritMachine"
```

---

## Task 11: Run all tests

- [ ] **Step 1: Run the full test suite**

```bash
cd apps/web && bun run test:e2e --reporter=line 2>&1 | tail -30
```

Expected: all 5 `/app route` tests pass. The 13 pre-existing failures in `calendar.spec.ts` and `call-logs.spec.ts` are unchanged — do not fix them here.

- [ ] **Step 2: If mute button tests still fail — debug**

The mute button tests require the button to be visible after a click. Check:
- `aria-label` attribute is set correctly on the `<button>` in `AppLayoutInner`
- The button's opacity class toggles on `audioUnlocked` (from `useSpiritMachine`)
- `USER_INTERACTED` is sent on `document.addEventListener("click", ...)` in `AppLayoutInner`

- [ ] **Step 3: Final build**

```bash
cd apps/web && bun run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(spirit): SpiritMachine — event-driven Spirit control with audio source of truth"
```

---

## Task 12: Task file

- [ ] **Step 1: Create task file**

Create `tasks/42-spirit-machine.md`:

```markdown
---
status: done
---
# Task 42: SpiritMachine

## What was done
- Added `spiritMachine` XState v5 parallel machine with 4 regions: attractor, visual, motion, audio
- `SpiritEngine.transition()` removed; replaced by `setVisualTarget()`, `setAttractorTarget()`, `setSurge()`, `setMuted()`
- `appMachine` audio region removed — `spiritMachine` is single source of truth for mute state
- AppLayout fires `SET_PRESET` events on route change instead of calling engine directly
- Named anchors for `MOVE_TO`: topLeft, topRight, bottomLeft, bottomRight, center, top, bottom
- `PLAY_SFX` silently dropped when audio locked or muted (no handler in those states)
- 5 Playwright tests pass for /app route including new mute button tests

## Key decisions
- Closure pattern: `createSpiritMachine(engineRef)` captures engine ref; actions call `engineRef.current?.method()`
- `after(holdMs)` / `after(returnMs)` / `after(visualDurationMs)` drive all auto-transitions — no setTimeout in app code
- SET_PRESET while transitioning is re-entrant (snapshots mid-lerp as new from)
- AudioEngine.toggleMute() replaced by setMuted(bool) — machine owns the boolean
```

- [ ] **Step 2: Commit**

```bash
git add tasks/42-spirit-machine.md
git commit -m "chore: add task file for SpiritMachine (task 42)"
```
