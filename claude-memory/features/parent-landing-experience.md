---
id: parent-landing-experience
type: feature
title: "Parent landing experience — Spirit + two product chat surfaces"
status: active
created: 2026-04-25
updated: 2026-04-25
related: [spirit, site, 2026-04-25-spirit-as-brand-icon, 2026-04-25-parent-landing-site, 2026-04-25-brand-identity, 2026-04-25-spirit-packaging, 2026-04-25-wiki-architecture-policy, multi-product-launch, frontdesk, terrascope, stack]
mentions: [frontdesk, terrascope, spirit, site]
decided_in: [2026-04-25-spirit-as-brand-icon, 2026-04-25-parent-landing-site, 2026-04-25-spirit-packaging]
discussed_in: [2026-04-25-spirit-as-brand-and-parent-landing, 2026-04-25-site-scaffold]
sources: [2026-04-25-spirit-as-brand-and-parent-landing-conv, 2026-04-25-site-scaffold-conv]
tags: [feature, brand, launch]
---

# Parent landing experience

The parent surface served at `neuvetra.com` and `neuvetra.ai`. The Spirit ([[spirit]]) is the brand icon; the two products ([[frontdesk]] and [[terrascope]]) are entry points that expand into chat surfaces.

## Summary

User loads `neuvetra.com`. They see:

- The Spirit ambient in the background — color-shifting, dancing, reactive to the user.
- A short headline / sub-headline about Neuvetra: *AI tools for businesses.*
- Two product entry points: FrontDesk and Terrascope.
- Clicking a product expands it into a chat surface where the user can type or speak (microphone) to learn about the product. Hand-off to the real product subscription flow happens from inside the chat surface.
- The Spirit keeps running behind the chat surface and reacts to interaction — color shifts on hover, surges on voice activity, gentle drift otherwise.

This is the **first impression** for both products and the visual anchor for the Neuvetra brand.

## Why we're building it

- The two products today have their own landings; there is no parent surface that frames them as siblings of one brand.
- The Spirit is the [[2026-04-25-spirit-as-brand-icon|adopted brand icon]] but lives only inside FrontDesk's app today. The parent landing is where it earns its name.
- Both products' real conversion surface is a chatbot anyway; a chat-first parent landing puts conversion forward instead of forcing the user through static marketing first.
- It collapses two of the four open decisions blocking [[multi-product-launch]] (parent-landing site + brand identity anchor).

## Status

Scaffolded. New codebase exists at `Neuvetra\Site\` — see `[[site]]`. Empty shell only; real content (Spirit copy, headline, product cards, chatbots) lands in subsequent cycles.

- **Decisions closed:** `[[2026-04-25-spirit-as-brand-icon]]`, `[[2026-04-25-parent-landing-site]]`, `[[2026-04-25-spirit-packaging]]`.
- **Open questions:** Q1 + Q2 closed (see below); Q3–Q10 remain.
- **Next milestone:** M2 in `[[multi-product-launch]]`.

## Decisions that shaped it

- `[[2026-04-25-spirit-as-brand-icon]]` — the Spirit is the brand icon.
- `[[2026-04-25-parent-landing-site]]` — the parent site lives in a new sibling codebase under `Neuvetra\`.
- `[[2026-04-25-spirit-packaging]]` — copy the Spirit into Site (next cycle); defer extract-to-shared-package to the third consumer (Terrascope frontend).
- `[[2026-04-25-wiki-architecture-policy]]` — Site has no `wiki/` subdir (memory wikis live only at the Neuvetra root).
- Pending input from `[[2026-04-25-brand-identity]]` for non-Spirit brand elements (logotype, type system, voice/tone).

## Tech

Standard Neuvetra stack per [[stack]]: Bun + Turborepo (likely sibling-monorepo layout matching FrontDesk and Terrascope), Vite + React 19 + React Router v7 + Tailwind v4. Plus:

- **Three.js** — the Spirit's renderer. Already a transitive dep through the Spirit code.
- **XState** — drives the Spirit's behavior machine.
- **Anthropic SDK** — backs the explainer chatbots per product. Default model `claude-sonnet-4-6` per [[anthropic]].
- **Voice input** — for both product chat surfaces. FrontDesk has Retell-based voice infra to learn from, but the parent's chat surfaces are scoped to explainer-chat behavior, not the full product runtime.

The new codebase is the sibling `[[site|Site]]` at `Neuvetra\Site\`. Note deviations from FrontDesk / Terrascope: **no `code/` subdir** (Site IS the code root) and **no `wiki/` subdir** (per `[[2026-04-25-wiki-architecture-policy]]`).

## Open questions

> **Q1 + Q2 closed by `[[2026-04-25-site-scaffold]]`.** Q3–Q10 remain.

1. ~~**Codebase directory name.**~~ **Closed 2026-04-25 → `Neuvetra\Site\`.** See `[[site]]`.
2. ~~**Spirit code packaging.**~~ **Closed 2026-04-25 → copy when added (next cycle); defer extraction to 3rd consumer.** See `[[2026-04-25-spirit-packaging]]`.
3. **Spirit zone on the page.** Full-bleed behind everything (with a soft scrim under chat / cards for legibility) vs scoped zone behind product cards. Full-bleed is the literal reading of the CEO's "dancing behind those two products."
4. **Spirit reactivity events.** Which engine events ([[spirit]] documents the available set) get wired to which interactions:
   - Hover FrontDesk → palette shifts toward FrontDesk's identity.
   - Hover Terrascope → palette shifts toward a Terrascope identity (likely earthy/green).
   - Chat opens → `MOVE_TO` an anchor near the chat surface.
   - User speaks (microphone active) → `SURGE` on voice activity.
   - Idle → `WANDER`.
5. **Per-product Spirit presets for the parent context.** Existing FrontDesk presets (`default` blue/teal, `howItWorks` green, `pricing` purple, `signIn` teal, `getStarted` amber) are available reference points but were defined for FrontDesk's internal flow. The parent landing needs a `frontdeskHover` and a `terrascopeHover` preset designed for the parent context.
6. **Product chat surface scope: real product chatbot vs lightweight explainer.** The CEO described "a chat box that the user can even type in or talk to them via the microphone and get some information about the product." That reads as an explainer surface — not the full Terrascope intake or full FrontDesk receptionist runtime. **CPO recommendation: explainer-first**, with a CTA into the real product. Not yet confirmed.
7. **Voice on the parent for Terrascope.** Confirmed: both product chat surfaces support text + voice. Note: Terrascope's *real product* is text-only today. The parent's voice support is a marketing-first-impression decision, not a product-runtime one.
8. **Domain re-routing.** Once the parent ships, `neuvetra.com` and `neuvetra.ai` move from FrontDesk to the new parent site. FrontDesk needs its own subdomain or sub-route. Same for Terrascope.
9. **Mobile / low-end device performance.** The Spirit is a Three.js + curl-noise simulation. Needs a fallback / reduced-motion path that still feels brand-aligned.
10. **Accessibility.** Reduced-motion, screen-reader behavior with an ambient animated background, focus order between product entry points, keyboard activation for the chat surfaces.

## Next

- ~~Stand up the new codebase~~ → **done 2026-04-25**, see `[[site]]` and `[[2026-04-25-site-scaffold]]`.
- ~~Decide on Spirit code packaging~~ → **closed**, see `[[2026-04-25-spirit-packaging]]`.
- **Cycle 2:** copy Spirit (`lib/spirit/*`, `data/spirit-presets.ts`, `public/audio/*`) from FrontDesk into Site per the closed packaging decision.
- **Cycle 3:** parent-landing real content — headline, two product entry-point cards, `frontdeskHover` + `terrascopeHover` presets, ambient Spirit on the parent page (closes Q3–Q5).
- **Cycle 4:** explainer chatbot per product (text + voice). Adds Anthropic SDK on the API; voice infra on the web (closes Q6 + Q7).
- **Cycle 5:** domain re-routing — `neuvetra.com` / `.ai` from FrontDesk to Site; FrontDesk to a subdomain (closes Q8).
- **Cycle 6:** mobile / reduced-motion / accessibility pass for Spirit (closes Q9 + Q10).
