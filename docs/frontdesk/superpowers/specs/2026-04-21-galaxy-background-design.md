# Galaxy Background for `/app` Route — Design Spec

**Date:** 2026-04-21
**Status:** Approved

## Overview

Replace the bare `/app` status page with an animated WebGPU galaxy simulation running as a full-screen background, with spatial audio. A named preset system (TypeScript file) defines visual + audio states. Calling `transition('presetName')` smoothly tweens all simulation parameters, the camera, and audio volumes over a configurable duration using smoothstep easing. A looping ambient soundtrack plays continuously; each preset can optionally trigger a one-shot sound effect on transition. An auto-cycle timer rotates through presets automatically; external `transition()` calls override it and reset the timer.

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `apps/web/src/data/galaxy-presets.ts` | All named presets + auto-cycle config + transition duration. The only file touched to tune visuals or add states. |
| `apps/web/src/lib/galaxy/helpers.ts` | Ported from upstream `helpers.js` — TSL math utilities (`hash`, `applyDifferentialRotation`, `applyMouseForce`, `applySpringForce`) |
| `apps/web/src/lib/galaxy/simulation.ts` | Ported from upstream `galaxy.js` — `GalaxySimulation` class with WebGPU compute shaders |
| `apps/web/src/lib/galaxy/engine.ts` | New class: owns Three.js renderer/scene/camera, animation loop, smoothstep transition lerper, auto-cycle timer |
| `apps/web/src/hooks/useGalaxy.ts` | React hook: mounts/unmounts engine into a container ref, returns `{ transition }` |

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/pages/AppPage.tsx` | Replace bare status text with full-screen canvas background + HTML overlay layer |

### Assets

- `apps/web/public/cloud.png` — dust cloud texture, copied from upstream repo
- `apps/web/public/audio/ambient.mp3` — looping background soundtrack (user-provided)
- `apps/web/public/audio/sfx/` — folder for transition sound effects (user-provided MP3s)

### Dependency

- `three@0.184.0` added to `apps/web` (latest; compatible with upstream TSL API surface)

---

## Preset System

### Types (`galaxy-presets.ts`)

```ts
interface CameraPreset {
  position: { x: number; y: number; z: number }
  target:   { x: number; y: number; z: number }
  fov: number
}

interface GalaxyPreset {
  // Galaxy structure
  rotationSpeed: number
  spiralTightness: number
  armCount: number
  armWidth: number
  randomness: number
  galaxyRadius: number
  galaxyThickness: number
  // Stars
  particleSize: number
  starBrightness: number
  denseStarColor: string    // CSS hex e.g. '#1885ff'
  sparseStarColor: string
  // Bloom
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  // Clouds
  cloudSize: number
  cloudOpacity: number
  cloudTintColor: string
  // Camera
  camera: CameraPreset
  // Audio
  soundEffect?: string   // path relative to /public, e.g. '/audio/sfx/whoosh.mp3' — optional
}
```

### Config exports

```ts
export const PRESETS: Record<string, GalaxyPreset> = { default, shining, void, ... }
export const TRANSITION_DURATION_MS = 3000
export const AUTO_CYCLE: { preset: string; holdMs: number }[] = [...]

export const AUDIO = {
  ambientLoop: '/audio/ambient.mp3',   // seamless looping background track
  ambientVolume: 0.3,                  // 0–1
  sfxVolume: 0.7,                      // 0–1, applies to all sound effects
}
```

### Constraints

- `starCount` and `cloudCount` are **NOT** in presets — changing them requires destroying/rebuilding GPU buffers (no smooth transition). Fixed at init time as constants in `engine.ts`.
- `mouseForce` and `mouseRadius` are **NOT** in presets — mouse interaction is disabled (HTML layer has pointer events; canvas does not). Fixed constants at init time.

---

## `GalaxyEngine` Class

```
GalaxyEngine
├── init(container: HTMLElement): Promise<void>
│   Creates renderer, scene, camera, GalaxySimulation, bloom, AudioEngine
│   Starts RAF loop and auto-cycle
├── dispose(): void
│   Cancels RAF, clears timeouts, disposes Three.js objects, removes canvas
│   Stops and destroys AudioEngine
├── transition(presetName: string): void
│   Begins smoothstep lerp for visuals + camera
│   Fires preset's soundEffect (if defined) via AudioEngine
│   Resets auto-cycle timer
└── (private) _tick(deltaTime): void
    Advances lerp, applies uniforms, updates camera, renders frame
```

---

## `AudioEngine` Class

Owned by `GalaxyEngine`. Uses the **Web Audio API** (`AudioContext`) — not `<audio>` elements — for gapless looping and independent volume control on ambient vs SFX tracks.

```
AudioEngine
├── init(): Promise<void>
│   Creates AudioContext, two GainNodes (ambient + sfx)
│   Fetches + decodes ambient MP3, schedules looping BufferSourceNode
│   Preloads all SFX files referenced across all presets into AudioBuffers
├── dispose(): void
│   Stops all sources, closes AudioContext
├── playSFX(path: string): void
│   Plays a preloaded one-shot buffer through the sfx GainNode
│   No-op if path not preloaded (logs warning)
└── unlock(): void
    Called on first user interaction — resumes AudioContext if suspended
    (required by browser autoplay policy)
```

### Autoplay policy

Browsers block audio until the user interacts with the page. `AudioEngine.unlock()` is called on the first `click`, `keydown`, or `touchstart` event on the document. Until unlocked, the ambient loop is queued but silent. The unlock is a one-time operation — after the first interaction, audio plays freely for the rest of the session.

### Audio graph

```
AudioContext
├── ambientSource (looping BufferSourceNode) → ambientGain → destination
└── sfxSource     (one-shot BufferSourceNode) → sfxGain    → destination
```

Volumes for `ambientGain` and `sfxGain` come from `AUDIO.ambientVolume` and `AUDIO.sfxVolume` in `galaxy-presets.ts`.

### Gapless looping

Ambient track is loaded as an `AudioBuffer` and played with `loop: true` on a `BufferSourceNode`. Web Audio handles the loop point at the sample level — no audible gap.

### Transition system

If `transition()` is called while a transition is already in progress, the engine captures the **current interpolated values** as the new `from` state — no jarring snap, the new transition starts from wherever the galaxy currently is.

Every frame during a transition:

1. Advance `elapsed` by `deltaTime`
2. Compute `t = clamp(elapsed / TRANSITION_DURATION_MS, 0, 1)`
3. Apply smoothstep easing: `eased = t * t * (3 - 2 * t)`
4. For each **numeric** param: `current = from + (to - from) * eased`
5. For each **color** param (hex string): parse both to `THREE.Color`, call `.lerp(target, eased)`, convert back to hex
6. For **camera**: lerp `position.x/y/z`, `target.x/y/z`, and `fov` using same `eased` value; call `camera.updateProjectionMatrix()` and `camera.lookAt()`
7. Call `galaxySimulation.updateUniforms(currentParams)` and `bloomNode.strength.value = currentParams.bloomStrength` etc.
8. When `t >= 1`: snap to final values, mark transition complete

### Auto-cycle

- On `init()`: schedule first auto-cycle transition using `setTimeout`
- After each hold period: call `transition(nextPreset)`, schedule next timeout
- On external `transition()` call: cancel pending timeout, restart cycle from that preset's hold period
- Cycle order and hold times come from `AUTO_CYCLE` array in `galaxy-presets.ts`

### Camera

- Fixed position (no `OrbitControls`) — camera is driven entirely by presets
- Default camera: `position (0, 12, 17)`, `target (0, -2, 0)`, `fov 60` (matches upstream defaults)
- Each preset can move camera anywhere for cinematic effect

---

## `useGalaxy` Hook

```ts
function useGalaxy(containerRef: RefObject<HTMLDivElement>): {
  transition: (presetName: string) => void
}
```

- On mount: `new GalaxyEngine()`, call `engine.init(containerRef.current)`
- On unmount: `engine.dispose()`
- Returns stable `transition` callback (wrapped in `useCallback`)
- Handles `init()` failure gracefully — logs error, does not crash the page (GpuRoute already gates WebGPU availability, but hardware adapter failures are still possible)

---

## `AppPage` Layout

```tsx
<div className="relative w-screen h-screen overflow-hidden bg-black">
  {/* Galaxy canvas — full-screen background */}
  <div ref={containerRef} className="absolute inset-0" />

  {/* HTML app layer — on top, pointer events enabled */}
  <div className="relative z-10">
    {/* future app content goes here */}
  </div>
</div>
```

- Canvas rendered by Three.js into the background `div`
- HTML content layer sits above via `z-10`
- `bg-black` prevents flash of white before renderer init

---

## Error Handling

| Scenario | Handling |
|----------|---------|
| `renderer.init()` rejects | Log error, leave page as black screen (GpuRoute already validated WebGPU) |
| Unknown preset name passed to `transition()` | Log warning, no-op — current state held |
| `cloud.png` fails to load | Galaxy renders without dust clouds — simulation continues |
| Color parse fails (invalid hex) | Fall back to `THREE.Color(0, 0, 0)` black — no crash |
| `AudioContext` blocked by autoplay | Audio queued silently, starts on first user interaction |
| Ambient MP3 fails to load | Log warning, galaxy runs silently — no crash |
| SFX file not found / not preloaded | `playSFX()` is a no-op, logs warning — transition still plays visually |

---

## Testing

Playwright spec: `apps/web/tests/galaxy-background.spec.ts`

- Mock WebGPU adapter (same pattern as `app-route.spec.ts`)
- Assert canvas element is present inside `/app`
- Assert `<div class="absolute inset-0">` background container exists
- Assert HTML overlay layer (`z-10`) is present and above canvas

Note: actual galaxy rendering is not testable in Playwright (WebGPU compute shaders require real GPU). Tests cover mount/unmount and DOM structure only.

---

## Public API Summary

```ts
// In any component inside /app:
const { transition } = useGalaxy(containerRef)

transition('shining')   // lerps all params + camera over 3s
transition('void')      // camera pulls back, colors fade
transition('default')   // returns to base state
```

The preset file is the single source of truth for all visual and audio states. Adding a new state = adding one object to `PRESETS` and one entry to `AUTO_CYCLE`. Drop audio files in `public/audio/sfx/` and reference them by path in the preset's `soundEffect` field.
