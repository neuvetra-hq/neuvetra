---
id: spirit
type: brand
title: "The Spirit — Neuvetra brand icon"
aliases: ["the spirit", "brand spirit", "neuvetra spirit"]
status: active
created: 2026-04-25
updated: 2026-04-25
related: [2026-04-25-spirit-as-brand-icon, 2026-04-25-brand-identity, parent-landing-experience, frontdesk, terrascope, multi-product-launch]
mentions: [frontdesk]
decided_in: [2026-04-25-spirit-as-brand-icon]
discussed_in: [2026-04-25-spirit-as-brand-and-parent-landing]
sources: [2026-04-25-spirit-as-brand-and-parent-landing-conv]
tags: [brand, identity]
---

# The Spirit

The Spirit is the Neuvetra brand icon — adopted [[2026-04-25-spirit-as-brand-icon|on 2026-04-25]]. It's a real, working visual artifact (not a metaphor): a curl-noise-driven Three.js particle field, rendered as triangles, controlled by an XState behavior machine, with named presets per context.

## Definition

A particle simulation that lives behind Neuvetra surfaces — ambient, slow, dreamlike by default, reactive to the user. Particles drift along curl-noise vector fields, are bloomed for soft glow, fade between two colors as they live and die, and respond to behavior events (color shifts, attractor moves, motion surges, sound effects).

The Spirit is dynamic by nature. It is *not* a static logo, mark, or wordmark. The brand identity work captured under [[2026-04-25-brand-identity]] still owes a static counterpart for off-screen contexts (favicon, social previews, billing receipts).

## Specification

### Where the code lives today

`Neuvetra\FrontDesk\code\apps\web\src\lib\spirit\` and `Neuvetra\FrontDesk\code\apps\web\src\data\spirit-presets.ts`. Key files: `engine.ts`, `simulator.ts`, `particles.ts`, `spiritMachine.ts`, `spiritMachine.types.ts`, `spirit-presets.ts`. React surface: `AppSpiritProvider.tsx`, `useSpirit.ts`, `useSpiritMachine.ts`.

> **Packaging is unresolved.** The Spirit must reach the parent landing codebase too. Options: extract into a shared package (CPO recommendation) or copy. Tracked on [[parent-landing-experience]] § Open questions.

### The default preset (current FrontDesk landing)

| Field | Value | Note |
|---|---|---|
| `color1` | `#001020` | bright/alive particle color — deep dark blue |
| `color2` | `#00446d` | dim/dying particle color — desaturated teal-blue |
| `bgColor` | `#0b0c0d` | background + fog — near-black |
| `speed` | `0.28` | low → "more dreamlike" |
| `dieSpeed` | `0.016` | particle turnover rate |
| `radius` | `1.0` | spawn spread |
| `curlSize` | `0.014` | curl-noise scale — tighter organic waves |
| `attraction` | `0.15` | very low — curl noise dominates, no surging |
| `followSpeed` | `0.12` | barely perceptible directional drift |
| `useTriangles` | `true` | renders triangles, not points |
| `bloomStrength` | `0.55` | soft glow |

This is the brand-default Spirit. Other contexts shift palette and motion via named presets.

### Other named presets (FrontDesk-internal today)

- `howItWorks` — green palette, slightly faster.
- `pricing` — purple palette, higher bloom.
- `signIn` — teal, much higher attraction (responds to interaction).
- `getStarted` — amber/orange palette.
- `storm` — high-energy, blue + red, with `storm.mp3` SFX. Stylistic.
- `drift` — slow, mint/teal, with `drift.mp3` SFX. Stylistic.

For the parent landing, two new presets are needed: `frontdeskHover` and `terrascopeHover`. See [[parent-landing-experience]].

### Behavior events (the engine vocabulary)

The Spirit's XState machine accepts (from `spiritMachine.types.ts`):

- `SET_PRESET` — switch to a named preset, optionally with a transition duration and color overrides.
- `CHANGE_COLORS` — fade `color1` / `color2` / `bgColor` over a duration without switching presets.
- `MOVE_TO` — drive the attractor to a named anchor (`center`, `top`, `bottom`, four corners) or an explicit `{x, y, z}`, hold, then return.
- `WANDER` — release back to curl-noise drift.
- `SURGE` — short burst of intensity at a kick angle.
- `SET_SPEED`, `SET_CURL` — tune motion live.
- `PLAY_SFX` — play a sound from `SFX` map at a rate / volume.
- `USER_INTERACTED`, `TOGGLE_MUTE`, `RESET` — meta events.

These are the brand's expressive vocabulary. When a designer or PM specifies a Spirit moment, they specify it in these terms.

### Audio

Optional ambient loop and SFX defined in `spirit-presets.ts` under `AUDIO` and `SFX`. Off by default; gated on `USER_INTERACTED`.

## Where it applies

- **`neuvetra.com` / `neuvetra.ai` parent landing** — full-bleed brand surface. See [[parent-landing-experience]].
- **[[frontdesk]] product surface** — already in use. Continues unchanged for now; future alignment with the parent's preset evolution as part of the FrontDesk re-skin tracked in `Neuvetra\FrontDesk\CLAUDE.md`.
- **[[terrascope]] product surface** — TBD. Likely adopts a Terrascope-flavored preset (earthy/green) when its frontend is built out.
- **Marketing assets / off-screen** — out of scope. Static-mark work remains in [[2026-04-25-brand-identity]].

## Open questions

- **Static-mark counterpart.** What logotype or glyph stands in for the Spirit on favicons, social previews, billing receipts, business cards, contracts? Tracked under [[2026-04-25-brand-identity]].
- **Reduced-motion / accessibility fallback.** Required for `prefers-reduced-motion`, mobile, low-end devices, and screen readers. Spec not yet written.
- **Per-product palette presets** for parent-landing hover states — `frontdeskHover`, `terrascopeHover`. Not yet defined.
- **Voice/tone counterpart.** The Spirit defines visual brand. Copy voice and tone are still open under [[2026-04-25-brand-identity]].
- **Code packaging.** Extract the Spirit into a shared package or copy across the parent + FrontDesk + Terrascope codebases. CPO recommendation: extract. Not yet confirmed.

## Related

- [[2026-04-25-spirit-as-brand-icon]] — the decision adopting it.
- [[2026-04-25-parent-landing-site]] — where it gets to live as the brand-level surface.
- [[parent-landing-experience]] — the feature page that consumes it.
- [[2026-04-25-brand-identity]] — the larger brand-system decision still open.
- [[frontdesk]] — where the Spirit code lives today.
