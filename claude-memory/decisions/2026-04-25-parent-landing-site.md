---
id: 2026-04-25-parent-landing-site
type: decision
title: "Decision: Parent Neuvetra landing site lives in a new sibling codebase under Neuvetra\\"
status: closed
created: 2026-04-25
updated: 2026-04-25
decided_on: 2026-04-25
decided_by: CEO
hats: [CPO, CTO]
related: [multi-product-launch, 2026-04-25-brand-identity, 2026-04-25-spirit-as-brand-icon, parent-landing-experience, spirit, frontdesk, terrascope]
mentions: [frontdesk, terrascope]
discussed_in: [2026-04-25-domain-deployment-state, 2026-04-25-spirit-as-brand-and-parent-landing]
sources: [2026-04-25-domain-deployment-state-conv, 2026-04-25-spirit-as-brand-and-parent-landing-conv]
tags: [brand, infra, launch]
---

# Closed: parent Neuvetra landing site lives in a new sibling codebase

## Context

The two domains `neuvetra.com` and `neuvetra.ai` are owned. Both [[frontdesk]] and [[terrascope]] currently have their own landings. No repo exists yet for the parent brand site. Captured originally as an open decision after [[2026-04-25-domain-deployment-state]].

## Current de-facto state (as of 2026-04-25)

- `neuvetra.com` → [[frontdesk]] (live, Railway-deployed). Surface served (marketing / chatbot / authed app) was not yet pinned down.
- `neuvetra.ai` → DNS alias to `neuvetra.com`.
- This was a de-facto state, not a deliberate decision — it predated this page.

## Options

1. **New sibling repo at `Neuvetra\<slug>\`** — clean separation, parallel `code/` structure to the products.
2. **Sub-route inside one product** (e.g., FrontDesk hosts `/` and the products live at `/frontdesk` and `/terrascope`) — leverages existing infra, fewer deploys.
3. **Static-site framework (Astro / 11ty) at root** — no React app, fastest to ship, easiest to keep cheap.

## Call

**Option 1: a new sibling codebase under `Neuvetra\`.** The parent landing is its own product surface — not a redirect, not a static page, not a sub-route of one product. CEO direction in [[2026-04-25-spirit-as-brand-and-parent-landing-conv]]: *"we are building it in the new work base. And code base."*

The parent landing is the Spirit ([[2026-04-25-spirit-as-brand-icon]]) layered with copy plus two product entry points (FrontDesk, Terrascope) that expand into chat surfaces with voice + text input. The full feature spec lives at [[parent-landing-experience]].

## Why

- A parent landing with the Spirit as the brand icon and embedded product chat surfaces is meaningfully more than a static page. It is its own product surface and benefits from a clean home.
- Sub-routing the parent inside FrontDesk would couple the parent brand evolution to the FrontDesk codebase's release cadence and component library — wrong shape now that the Spirit becomes the Neuvetra-level asset.
- A static-site framework (Astro) cannot host the Spirit (Three.js + XState) or the chat-with-voice surfaces with the fidelity envisioned.
- Putting the parent landing in its own codebase gives the Spirit a natural home to be lifted into (whether copied or extracted as a shared package — see [[parent-landing-experience]]).

## Consequences

- A third sibling under `Neuvetra\` joins `Neuvetra\FrontDesk\` and `Neuvetra\Terrascope\`. Likely structure: `code/` for the app and possibly `wiki/` placeholder, mirroring product layout. Exact directory name TBD ("`landing/`", "`site/`", "`neuvetra-com/`").
- `neuvetra.com` and `neuvetra.ai` need to be re-pointed from FrontDesk to the new parent site once it ships. FrontDesk needs its own subdomain (e.g., `frontdesk.neuvetra.com` or similar). Terrascope needs the same. **Domain re-routing is downstream of M2 in [[multi-product-launch]].**
- The new codebase should match the standard Neuvetra stack per [[stack]] (Bun + Vite + React 19 + Tailwind v4) for consistency, plus the Spirit's runtime dependencies (Three.js, XState).
- The Spirit code currently in `Neuvetra\FrontDesk\code\apps\web\src\lib\spirit\` becomes a candidate for extraction into a shared package or copy into the parent codebase. CPO recommendation: extract. Tracked on [[parent-landing-experience]].
- This unblocks milestone M2 in [[multi-product-launch]].

## Next

- Stand up the new codebase. Pick the directory name. Match the Neuvetra stack.
- Decide on Spirit-code packaging (extract vs copy) before the lift.
- Define per-product Spirit presets for the parent landing.
- Spec the explainer-chatbot per product (text-or-voice surface, FAQ scope, hand-off CTA) — see [[parent-landing-experience]].
