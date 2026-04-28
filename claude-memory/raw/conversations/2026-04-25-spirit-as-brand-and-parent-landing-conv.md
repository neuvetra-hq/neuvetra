---
id: 2026-04-25-spirit-as-brand-and-parent-landing-conv
type: conversation
title: "Conversation: Spirit adopted as Neuvetra brand icon, parent landing greenlit in new codebase"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO, CTO]
related: [2026-04-25-spirit-as-brand-and-parent-landing, 2026-04-25-spirit-as-brand-icon, 2026-04-25-parent-landing-site, 2026-04-25-brand-identity, parent-landing-experience, spirit, frontdesk, terrascope, multi-product-launch]
sources: []
---

# Conversation: Spirit adopted as Neuvetra brand icon, parent landing greenlit in new codebase

## Metadata

- **Date:** 2026-04-25
- **Surface:** Cowork (Claude Desktop / Cowork mode)
- **Hats worn:** CPO (brand), CTO (codebase architecture)
- **Trigger:** CEO opened a brand-identity conversation, said "I want to pick something that's defined our brand at the moment with it. What I have in mind is basically the spirit that we picked in the front desk application."

## Topics covered

In order:

1. CEO asks the C-suite to verify it understands what "the spirit" refers to in the FrontDesk app.
2. CPO/CTO confirms the Spirit is a literal, named thing in the FrontDesk frontend — a curl-noise-driven Three.js particle field rendered as triangles, with an XState machine and named presets.
3. CPO/CTO summarises the current default preset on the live `neuvetra.com` landing: deep blue (`#001020`) and desaturated teal (`#00446d`) on near-black (`#0b0c0d`), low speed, low attraction, dreamlike motion.
4. CEO declares the Spirit is now the Neuvetra brand icon ("for now").
5. CEO sketches the parent-landing experience: short copy about Neuvetra (AI tools for businesses), two product entry points (FrontDesk and Terrascope), Spirit dancing behind everything, color-shifting and reactive to the user.
6. CEO specifies that clicking either product opens a chat surface where the user can type or speak (microphone) to learn about that product.
7. CPO/CTO surfaces design questions: full-bleed Spirit vs scoped zone; what events drive the color/behavior shifts; embedded-real-product chatbots vs lightweight explainer chatbots; voice on parent for Terrascope (whose real product is text-only today); Spirit code as shared dependency vs copy.
8. CEO instructs: save to wiki, build the parent landing for `neuvetra.com` / `neuvetra.ai` in a **new codebase** under the `Neuvetra\` workspace.

## Key statements

**CEO:** "I would like to pick something that's defined our brand at the moment with it. What I have in mind is basically the spirit that we picked in the front desk application."

**CEO:** "Can you go and check and make sure that you know what we're talking about?"

**CPO:** Verified the Spirit by reading `apps/web/src/data/spirit-presets.ts`, `lib/spirit/spiritMachine.types.ts`, and `components/landing/Hero.tsx`. Reported back that the Spirit is concrete code: a Three.js + curl-noise particle simulation driven by an XState actor, with named presets (`default`, `howItWorks`, `pricing`, `signIn`, `getStarted`, plus stylistic `storm` / `drift`). Default preset palette: `#001020` / `#00446d` on `#0b0c0d`. Engine events include `SET_PRESET`, `CHANGE_COLORS`, `MOVE_TO`, `WANDER`, `SURGE`, `SET_SPEED`, `SET_CURL`, `PLAY_SFX`.

**CEO:** "I want to pick that spirit as our type of brand icon for now."

**CEO:** "The idea is in nuvetra.com or nuvetra.ai — we load the screen, and then the very first screens in Neuvetra have a very few lines about what we do, providing AI tools for businesses; and then we have two products: one of those, the other one is Terrascope; and then the spirit is dancing behind those two products, behind the scenes, and interacts with the user. It changes colors and stuff like that as a fun thing behind the scenes, just to make the pleasant experience of the user."

> **Transcription note:** The CEO message that contained this section was rendered with a typo, "wetrob.com" — read as a transcription artifact for "neuvetra.com" given the prior turn explicitly used `neuvetra.com` and `neuvetra.ai`. Flagged on save for CEO confirmation.

**CEO:** "Both front desk and Terrascope, when a user clicks on them, become kind of a chat box that the user can even type in or talk to them via the microphone and get some information about the product and stuff like that."

**CPO:** Read the vision back. Liked it because it (a) makes the parent brand a real surface, not a redirect; (b) reuses working code; (c) makes the chatbot — already the conversion surface for both products — the way the parent introduces them. Surfaced five questions:

1. Spirit zone — full-bleed behind everything, or scoped behind the product cards.
2. Spirit reactivity — which engine events to wire (hover-driven `CHANGE_COLORS`, voice-activity `SURGE`, chat-open `MOVE_TO`).
3. Embedded real chatbots vs lightweight explainer chatbots — recommended explainer-first because Terrascope's real product is a long structured emissions intake, not a marketing first-touch.
4. Voice on the parent for both products — Terrascope's actual product is text-only today; the parent explainer would still get voice.
5. Spirit code as shared dependency — extract from `FrontDesk\code\` into a shared package vs copy. Recommended extract.

**CPO:** Noted the new direction collapses two of the four open decisions: parent-landing-site (becomes "yes, build it as its own thing") and brand-identity (gets a concrete anchor in the Spirit; remaining sub-questions are logo, type, palette extension, voice/tone).

**CEO:** "Can save within the wiki, and also we would like to basically build our [neuvetra.com] application there, so we are building it in the new work base. And code base."

**Joint:** Closed two decisions: Spirit as brand icon (new decision page), and parent-landing-site (the existing open decision picks Option 1 — new sibling repo under `Neuvetra\`). Created a feature page for the parent-landing experience as the graph hub.

## Files referenced

Read during this conversation:

- `Neuvetra\CLAUDE.md`
- `Neuvetra\wiki\index.md`
- `Neuvetra\wiki\log.md`
- `Neuvetra\wiki\CLAUDE.md`
- `Neuvetra\wiki\next.md`
- `Neuvetra\wiki\overview.md`
- `Neuvetra\wiki\plans\multi-product-launch.md`
- `Neuvetra\wiki\products\frontdesk.md`
- `Neuvetra\wiki\decisions\2026-04-25-parent-landing-site.md`
- `Neuvetra\wiki\decisions\2026-04-25-brand-identity.md`
- `Neuvetra\wiki\raw\conversations\README.md`
- `Neuvetra\.claude\skills\save-wiki\SKILL.md`
- `Neuvetra\FrontDesk\CLAUDE.md`
- `Neuvetra\FrontDesk\code\apps\web\src\data\spirit-presets.ts`
- `Neuvetra\FrontDesk\code\apps\web\src\lib\spirit\spiritMachine.types.ts`
- `Neuvetra\FrontDesk\code\apps\web\src\contexts\SpiritContext.tsx`
- `Neuvetra\FrontDesk\code\apps\web\src\components\landing\Hero.tsx`

## Decisions raised

**Closed in this session:**

1. **Adopt the FrontDesk Spirit as the Neuvetra brand icon** ("for now"). New page: [[2026-04-25-spirit-as-brand-icon]].
2. **Parent landing site lives in a new codebase under `Neuvetra\`** — closes the previously-open [[2026-04-25-parent-landing-site]] in favor of Option 1 (new sibling repo). Exact directory name TBD; the CEO's phrase was "new work base. And code base."

**Still open after this session:**

- [[2026-04-25-brand-identity]] remains open for the rest of the brand system (logo, typography, palette extension beyond the Spirit's own colors, voice/tone). The Spirit anchors the visual identity but doesn't resolve all sub-questions.
- Whether the product chat surfaces on the parent are **real product chatbots embedded** vs **lightweight explainer chatbots** — CPO recommended explainer-first; CEO did not contradict but did not explicitly close this. Tracked as open question on the feature page.
- Spirit code packaging — extract to a shared package vs copy across repos. Tracked as open question on the feature page.
- Specific Spirit reactivity behaviors (which events to wire, per-product palette presets for the parent context). Tracked on the feature page.

## Action items

1. Save this conversation and synthesize into wiki pages (this work).
2. Stand up a new code workspace for the parent-landing app under `Neuvetra\` — directory name and stack to be decided in a follow-up session. Likely matches the standard Neuvetra stack (Bun + Vite + React + Tailwind) per [[stack]].
3. Plan the Spirit code lift: decide between shared-package extraction and copy. CPO's recommendation: extract.
4. Define the parent-context Spirit presets (one per product hover state) — Terrascope's earthy/green and FrontDesk's blue-teal as the obvious starting points.
5. Spec the explainer-chatbot scope per product (FAQs, voice-or-text, hand-off CTA).

## Open questions

- **Naming the parent codebase directory.** `Neuvetra\landing\`? `Neuvetra\site\`? `Neuvetra\neuvetra-com\`? Not decided.
- **Spirit zone on the parent.** Full-bleed behind everything (legibility scrim under product cards), or scoped zone behind the product cards. Not decided.
- **Real-product vs explainer chatbots** on the parent for FrontDesk and Terrascope. Recommendation on file; not decided.
- **Voice on parent for Terrascope** — confirmed by CEO that both products get a chat surface with voice + text. Real Terrascope product remains text-only; parent explainer adds voice as a marketing surface.
- **Spirit code packaging** — shared package vs copy. Recommendation on file; not decided.
- **Brand identity beyond the Spirit** — logo treatment, type system, palette extension, voice/tone. Tracked under the still-open [[2026-04-25-brand-identity]].
- **`wetrob.com` transcription artifact** — CEO confirmation pending that the intended domain is `neuvetra.com` / `neuvetra.ai` (strong contextual signal but not explicitly re-stated).
