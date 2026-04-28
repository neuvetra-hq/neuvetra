# SpiritMachine — Design Spec

**Date:** 2026-04-21
**Status:** Approved — ready for implementation planning

## What we're building

A new XState v5 parallel machine (`spiritMachine`) that owns all Spirit particle system behavior — visuals, attractor movement, speed, and audio. The app communicates with Spirit exclusively through events. `SpiritEngine` becomes a pure executor that responds to what the machine tells it; it holds no policy of its own.

This replaces the current pattern where `AppLayout` calls `engine.transition(presetName)` directly and `appMachine` tracks audio state independently.

---

## Architecture

`spiritMachine` is a parallel machine with **4 orthogonal regions** running simultaneously. Each region manages one independent dimension of Spirit behavior and finishes on its own timeline.

```
spiritMachine [parallel]
├── attractor   — where the invisible follow point is
├── visual      — colors, curl, bloom, preset values
├── motion      — speed overlay (surges)
└── audio       — sound lock, mute state, SFX dispatch
```

### Why parallel

All four dimensions can be active at the same time. Navigating to Pricing might simultaneously lerp colors, kick the attractor to a corner, surge speed, and play a whoosh — each on its own clock. Parallel regions let each finish independently without state combinatorics.

---

## Regions

### `attractor`

Controls the invisible 3D follow point that all particles chase.

| State | Behavior |
|---|---|
| `wandering` *(initial)* | Follow point moves on a Lissajous orbit: `cos(t)×200, cos(4t)×60, sin(2t)×200` |
| `targeting` | Engine lerps follow point toward `ctx.attractorTarget`. Holds there for `holdMs`. |
| `returning` | Engine eases follow point back into Lissajous orbit over `returnMs`. |

**Transitions:**
- `MOVE_TO` → `targeting` (guard: valid anchor name or `{x,y,z}`)
  - entry action: `setAttractorTarget`, `notifyEngine`
  - `after(holdMs)` → `returning`
- `returning` `after(returnMs)` → `wandering`
  - entry action: `clearAttractorTarget`
- `WANDER` from any state → `wandering` immediately (cancels targeting/returning)

**Named anchors** map to 3D world coordinates (±200 x/z, ±60 y):

| Name | x | y | z |
|---|---|---|---|
| `center` | 0 | 0 | 0 |
| `topLeft` | -180 | 80 | -180 |
| `topRight` | 180 | 80 | -180 |
| `bottomLeft` | -180 | -60 | 180 |
| `bottomRight` | 180 | -60 | 180 |
| `top` | 0 | 80 | 0 |
| `bottom` | 0 | -60 | 0 |

Raw `{x, y, z}` coordinates are also accepted for precise control.

---

### `visual`

Controls all preset values: colors, curl size, attraction, bloom, die speed, radius.

| State | Behavior |
|---|---|
| `stable` *(initial)* | `ctx.currentPreset` is applied. No lerp active. |
| `transitioning` | Smoothstep lerp from `ctx.fromPreset` → `ctx.toPreset` over `ctx.visualDurationMs`. |

**Transitions:**
- `SET_PRESET` → `transitioning` (guard: `name` exists in `PRESETS` map)
  - action: snapshot current lerp position as `fromPreset`, set `toPreset`, set `visualDurationMs`
  - if already `transitioning`: snapshots mid-lerp state as new `fromPreset`, restarts timer — no jump
  - `after(visualDurationMs)` → `stable`; exit action: `commitPreset` (currentPreset = toPreset)
- `CHANGE_COLORS` → `transitioning`
  - action: patches only provided color fields onto a copy of `currentPreset` as `toPreset`
  - no implicit surge — intended for subtle ambient shifts
  - `after(visualDurationMs)` → `stable`
- `RESET` → `stable` immediately, `currentPreset = defaultPreset`

---

### `motion`

Controls a speed overlay on top of the base preset speed.

| State | Behavior |
|---|---|
| `calm` *(initial)* | Speed from `ctx.currentPreset.speed`. No overlay. |
| `surging` | Engine adds `sin(π×t) × ctx.surgeIntensity` to base speed. Bell curve — peaks at midpoint, auto-decays. |

**Transitions:**
- `SURGE` → `surging`
  - action: `setSurgeParams` (intensity, durationMs)
  - `after(surgeDurationMs)` → `calm`
- `SET_PRESET` implicitly fires `SURGE { intensity: 0.55, durationMs: 1400 }`
- `MOVE_TO` implicitly fires `SURGE { intensity: 0.4, durationMs: 800 }`
- `SET_SPEED` — no state change; updates `ctx.currentPreset.speed` and `followSpeed` in place. Works in both `calm` and `surging`.
- `SET_CURL` — no state change; updates `ctx.currentPreset.curlSize` and `attraction` in place.

---

### `audio`

Owns mute state and sound dispatch. Single source of truth for all audio state in the application. **Replaces `appMachine`'s audio region entirely.**

| State | Behavior |
|---|---|
| `locked` *(initial)* | AudioContext not yet unlocked (browser autoplay policy). All sound events silently dropped. |
| `unlocked.unmuted` | Handles `PLAY_SFX` — calls `engine.playSFX(name)`. |
| `unlocked.muted` | `PLAY_SFX` has no handler — XState drops it silently. Engine never called. |

**Transitions:**
- `USER_INTERACTED` → `unlocked.unmuted`
  - action: `engine.unlockAudio()`
- `TOGGLE_MUTE` in `unlocked.unmuted` → `unlocked.muted`
- `TOGGLE_MUTE` in `unlocked.muted` → `unlocked.unmuted`
- `PLAY_SFX` in `unlocked.unmuted` → action only (no state change): `engine.playSFX(event.name)`
- `PLAY_SFX` in `locked` or `unlocked.muted` → silently ignored (no handler)

**UI reads from this region** — mute button visibility and sound bar animation read `spiritMachine` state, not `appMachine`.

---

## Full event API

| Event | Params | Regions affected | Notes |
|---|---|---|---|
| `SET_PRESET` | `name: string`, `durationMs?: number = 1400` | visual, motion | Guard: name in PRESETS. Auto-surges. Mid-transition safe. |
| `CHANGE_COLORS` | `color1?: string`, `color2?: string`, `bgColor?: string`, `durationMs?: number = 1400` | visual | Partial patch. No auto-surge. |
| `MOVE_TO` | `target: NamedAnchor \| {x,y,z}`, `holdMs?: number = 2000`, `returnMs?: number = 1200` | attractor, motion | Auto-surges at lower intensity. |
| `WANDER` | — | attractor | Cancels targeting/returning immediately. |
| `SURGE` | `intensity?: number = 0.55`, `durationMs?: number = 1400` | motion | Bell-curve speed burst. |
| `SET_SPEED` | `speed: number`, `followSpeed?: number` | motion | In-place context update, no transition. |
| `SET_CURL` | `curlSize: number`, `attraction?: number` | motion | In-place context update, no transition. |
| `PLAY_SFX` | `name: string` | audio | No-op when locked or muted. |
| `USER_INTERACTED` | — | audio | Unlocks AudioContext. |
| `TOGGLE_MUTE` | — | audio | Flips muted state. |
| `RESET` | — | all | All regions to initial. defaultPreset. |

---

## Context

```typescript
interface SpiritMachineContext {
  // visual
  currentPreset:    SpiritPreset
  fromPreset:       SpiritPreset
  toPreset:         SpiritPreset | null
  visualDurationMs: number          // default 1400

  // attractor
  attractorTarget:  { x: number; y: number; z: number } | null
  holdMs:           number          // default 2000
  returnMs:         number          // default 1200
  kickAngle:        number          // random 0–2π, set on MOVE_TO

  // motion
  surgeIntensity:   number          // default 0.55
  surgeDurationMs:  number          // default 1400
}
```

Audio state (`locked`/`unlocked`, `muted`/`unmuted`) is captured by the `audio` region's state — not stored in context. UI reads `machine.matches({ audio: { unlocked: "muted" } })`.

---

## Engine interface changes

`SpiritEngine` exposes three new setter methods. The existing `transition()` method is removed.

```typescript
// Called by machine actions when state changes
engine.setVisualTarget(from: SpiritPreset, to: SpiritPreset, durationMs: number): void
engine.setAttractorTarget(pos: { x,y,z } | null, kickAngle: number): void
engine.setSurge(intensity: number, durationMs: number): void

// Audio (stateless — engine no longer tracks mute internally)
engine.unlockAudio(): void
engine.playSFX(name: string): void
engine.setMuted(muted: boolean): void  // replaces toggleMute()
```

`SpiritEngine._tick()` is unchanged — it still runs the rAF loop and does all lerp math. The machine pushes intent via the methods above; the engine executes it frame by frame.

---

## What changes in existing files

| File | Change |
|---|---|
| `apps/web/src/lib/spirit/engine.ts` | Remove `transition()`. Add `setVisualTarget()`, `setAttractorTarget()`, `setSurge()`, `setMuted()`. Remove `this.muted` boolean. |
| `apps/web/src/hooks/useSpirit.ts` | Remove `transition()` export. No longer needed — app uses machine events. |
| `apps/web/src/pages/app/machine/appMachine.ts` | Remove `audio` region entirely. Remove `USER_INTERACTED`, `TOGGLE_MUTE` events. |
| `apps/web/src/components/layout/AppLayout.tsx` | Replace `transition(presetName)` calls with `send({ type: "SET_PRESET", ... })`. Mute button reads from `spiritMachine`. |
| `apps/web/src/data/spirit-presets.ts` | Add `SFX` registry (name → file path). |

---

## New files

| File | Purpose |
|---|---|
| `apps/web/src/lib/spirit/spiritMachine.ts` | Machine definition — `setup()` + `createMachine()` |
| `apps/web/src/lib/spirit/spiritMachine.types.ts` | `SpiritMachineContext`, `SpiritEvent`, `NamedAnchor` |
| `apps/web/src/lib/spirit/spiritMachine.actions.ts` | All named actions (`setAttractorTarget`, `setSurgeParams`, etc.) |
| `apps/web/src/lib/spirit/spiritMachine.anchors.ts` | Named anchor → `{x,y,z}` map |
| `apps/web/src/hooks/useSpiritMachine.ts` | `createActorContext` provider + typed selector + send hook |

---

## SFX registry (initial)

```typescript
export const SFX: Record<string, string> = {
  whoosh:  '/audio/sfx/whoosh.mp3',
  click:   '/audio/sfx/click.mp3',
  chime:   '/audio/sfx/chime.mp3',
  surge:   '/audio/sfx/surge.mp3',
  // storm and drift remain per-preset in PRESETS
}
```

---

## What is NOT in scope

- Changing the `SpiritSimulator` or `SpiritParticles` internals
- Changing the GPGPU shader logic
- Adding new presets
- Auto-cycle timer (already in engine, stays there)
