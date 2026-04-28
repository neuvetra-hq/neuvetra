---
id: threejs
type: tech
title: "Three.js"
aliases: ["three.js", "three", "webgl"]
status: active
created: 2026-04-25
updated: 2026-04-25
related: [stack, spirit, site, frontdesk, parent-landing-experience, 2026-04-25-skill-and-wiki-framework]
mentions: [spirit]
discussed_in: [2026-04-25-skill-and-wiki-framework]
sources: []
tags: [tech, frontend, webgl, brand]
---

# Three.js

## What we use

- **Library:** `three@0.184.0` (+ `@types/three@^0.184.0`).
- **Renderer:** classic WebGL2 today (the [[spirit]] uses a `WebGLRenderer` with custom GLSL shaders).
- **Pattern:** the Spirit ships as a self-contained engine class (`SpiritEngine`) plus a particle simulator, custom shaders, and an internal XState v5 behavior machine. See [[spirit]] for the full file inventory.
- **Where it ships:** `FrontDesk\code\apps\web\src\lib\spirit\` (production today on `neuvetra.com`). To be copied verbatim into `Site\apps\web\src\lib\spirit\` per [[2026-04-25-spirit-packaging]] in a follow-up cycle. Eventually Terrascope's frontend gains a Three.js consumer too — and that's the trigger to extract Spirit into a shared package.

## Why

- The [[spirit]] is the Neuvetra brand icon ([[2026-04-25-spirit-as-brand-icon]]). It is *not* a static logo — it's a curl-noise particle field, dynamic by definition. Three.js is the practical way to render that on a webpage with broad browser support and reasonable performance.
- Cross-product lockstep (root-level Cross-Product Absolute Rule #2): if FrontDesk pins `three@0.184`, Site pins `three@0.184`. Diverging Three.js versions across product surfaces creates pointless drift, especially since the Spirit code is shared verbatim.
- WebGL2 is enough today. WebGPU + TSL would be a meaningful rewrite; not justified by current requirements. Open to revisit if performance pressure emerges (mobile fallback, low-end devices).

## Where it appears

- `FrontDesk\code\apps\web\src\lib\spirit\` — production, `neuvetra.com` landing.
- `Site\apps\web\` — Three.js installed (`three@0.184.0`); Spirit copy lands in a follow-up cycle.
- `Terrascope\code\apps\web\` — not yet; will gain Three.js when the frontend is built out (and triggers the Spirit-extraction event).

## Skills to reach for when working on Three.js code

When the work touches Three.js — Spirit code, shaders, simulator, particles, future Three.js consumers — actively reach for:

- **`webgpu-threejs-tsl` skill** — the harness's Three.js skill. Today's Spirit is WebGL2 + GLSL, so this skill applies most directly when a WebGPU/TSL/node-material consumer is on the table (a future migration or new consumer). Still useful for general Three.js patterns.
- **`context7` MCP doc-fetching** (`mcp__plugin_context7_context7__query-docs`, `resolve-library-id`) — preferred over web search for current Three.js docs. The Three.js API churns version-to-version; lean on live docs even when something feels familiar. Library ID resolves to `/mrdoob/three.js`.
- **`chrome-devtools-mcp` skills** when debugging visual / performance issues in-browser — `lighthouse_audit`, `performance_start_trace`, `take_screenshot`, etc.

CEO directive (2026-04-25): assume training data is stale for Three.js specifics; use live docs and skill guidance to keep Spirit work technically correct.

## Alternatives considered

- **WebGPU via TSL.** Considered; rejected for now. Would require rewriting all of `lib/spirit/shaders.ts` and `lib/spirit/engine.ts`. WebGL2 meets requirements; revisit if performance pressure emerges.
- **Pure CSS / SVG fallback for the Spirit.** Out of scope as a *default*; required as a fallback for `prefers-reduced-motion`, mobile, low-end devices (Open Q9 of [[parent-landing-experience]]). Not yet specified.
- **A different particle library** (e.g., `babylon.js`, `pixi.js`). Not considered — Three.js is the de-facto choice given existing FrontDesk implementation, ecosystem, and `@types` quality.

## Related

- [[spirit]] — the brand artifact built on Three.js.
- [[stack]] — the broader Neuvetra tech-stack overview.
- [[site]] — current Three.js consumer (post-Spirit-copy).
- [[frontdesk]] — current Three.js consumer (production).
- [[parent-landing-experience]] — feature that puts Three.js front and center.
- [[2026-04-25-spirit-packaging]] — copy-vs-extract decision for Spirit code.
- [[2026-04-25-spirit-as-brand-icon]] — why Three.js is brand-critical.
- [[2026-04-25-skill-and-wiki-framework]] — meeting where the Three.js tooling preference was articulated.
