---
id: 2026-04-25-spirit-packaging
type: decision
title: "Decision: Copy the Spirit into Site for now; defer extraction to the third consumer"
status: closed
created: 2026-04-25
updated: 2026-04-25
decided_on: 2026-04-25
decided_by: CEO
hats: [CPO, CTO]
related: [parent-landing-experience, spirit, 2026-04-25-spirit-as-brand-icon, 2026-04-25-parent-landing-site, frontdesk, terrascope, site]
mentions: [spirit, frontdesk, terrascope, site]
discussed_in: [2026-04-25-site-scaffold]
sources: [2026-04-25-site-scaffold-conv]
tags: [brand, code, packaging]
---

# Closed: copy the Spirit into Site; defer extraction

Closes Open Q2 of `[[parent-landing-experience]]`.

## Context

The Spirit (`[[spirit]]`) was adopted as the Neuvetra brand icon `[[2026-04-25-spirit-as-brand-icon|on 2026-04-25]]`. Its code lives today in `FrontDesk\code\apps\web\src\lib\spirit\` (7 files) plus `data\spirit-presets.ts`. The new `[[site|Site]]` codebase needs the Spirit too — it's the visual anchor for the parent-landing experience. Eventually `[[terrascope]]`'s frontend will need it as well, with an earthy/green preset.

The wiki had a CPO recommendation (in `[[parent-landing-experience]]` Open Q2) to **extract** the Spirit into a shared package. This decision revisits that recommendation against the constraint that FrontDesk is **live in production** at `neuvetra.com`.

## Current de-facto state (as of 2026-04-25)

- Spirit code: `FrontDesk\code\apps\web\src\lib\spirit\{engine,simulator,particles,shaders,spiritMachine,spiritMachine.types,spiritMachine.anchors}.ts` + `data\spirit-presets.ts`.
- One consumer today: FrontDesk (in production).
- One imminent consumer: Site (this scaffold cycle's next-cycle work).
- One eventual consumer: Terrascope (when its frontend is built out).

## Options

1. **Extract now into a shared package.** Cleanest architecturally — one source of truth, no drift. But to share across three independent `code/` trees (Site, FrontDesk, Terrascope), the package needs a shared home: a new top-level Neuvetra workspace, a published npm package, or a git submodule. All require touching FrontDesk in production for one new consumer.
2. **Copy into Site for now; defer extraction.** Zero risk to FrontDesk in production. Site moves fast. Drift risk bounded — two consumers, same team, both repos co-located. Natural extraction trigger when the third consumer (Terrascope frontend) lights up.
3. **Hybrid co-locate.** Place the Spirit at `Neuvetra\packages\spirit\` and have Site reference via relative path; FrontDesk consumes on its next deploy. Half-measure with elements of both downsides.

## Call

**Option 2: copy into Site for now; defer extraction to the third consumer.**

CEO direction (`[[2026-04-25-site-scaffold-conv|verbatim]]`):

> "let's copy it."

In the same exchange the CEO authorized using the FrontDesk app-fsm route as the reference for what to lift, then later **rescoped the Site scaffold itself to deps-only** (no Spirit copy in this scaffold cycle — that becomes a separate next cycle). So the operative resolution is: **when the Spirit is copied into Site, it will be a copy, not a shared-package extract.**

## Why

- **FrontDesk is in production at `neuvetra.com`.** Restructuring its monorepo to consume the Spirit from outside its tree is meaningful risk for one new consumer. Cost-benefit doesn't favor it.
- **The Spirit is small.** ~7 files plus presets. Copying isn't egregious.
- **Drift is manageable at 2 consumers.** Same team owns both repos; both are co-located under `Neuvetra\`; sync is mechanical when needed.
- **The third-consumer trigger is the right extraction signal.** When Terrascope's frontend lights up and the Spirit needs to land in a third place, the cost of restructuring (one-time) is amortized across all three consumers and the drift management cost (recurring) becomes worth eliminating.
- **Wiki recommendation was theoretical; this decision is empirical.** The "extract" recommendation in `[[parent-landing-experience]]` predated the realization that FrontDesk's prod state changes the cost model. Decisions update on new information.

## Consequences

- **Site's next cycle (after this scaffold) copies `lib/spirit/*`, `data/spirit-presets.ts`, and `public/audio/*` from FrontDesk verbatim.** No `import` from FrontDesk; no submodule; no shared package. Just files.
- **FrontDesk is untouched.** No restructure, no migration, no risk to the live deploy.
- **Drift management responsibility:** when either FrontDesk or Site touches Spirit code (bugfix, preset addition), the change must be ported to the other. Convention to be documented in `[[spirit]]` and `Site\CLAUDE.md` once the copy lands.
- **Extraction trigger codified:** when Terrascope's frontend adds its first `lib/spirit/` reference, that's the cue to extract the Spirit into a shared package and refactor all three consumers in one PR. Scoped as a future plan.
- **`[[parent-landing-experience]]` Open Q2 is closed.**

## Next

- ☐ Site cycle 2 (separate from this scaffold) copies Spirit + presets + audio assets into `Site\apps\web\src\lib\spirit\`, `Site\apps\web\src\data\spirit-presets.ts`, `Site\apps\web\public\audio\`.
- ☐ Document the drift-management convention in `Site\CLAUDE.md` and update `[[spirit]]` § "Code packaging" to reflect the closed state.
- ☐ Triggered on Terrascope-frontend-spirit-first-use: open a new decision page for shared-package extraction; expected to land all three consumers in one PR.
