---
id: 2026-04-25-spirit-as-brand-and-parent-landing
type: meeting
title: "Meeting: Spirit adopted as brand icon, parent landing greenlit in new codebase"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO, CTO]
related: [2026-04-25-spirit-as-brand-icon, 2026-04-25-parent-landing-site, 2026-04-25-brand-identity, parent-landing-experience, spirit, frontdesk, terrascope, multi-product-launch]
mentions: [frontdesk, terrascope]
sources: [2026-04-25-spirit-as-brand-and-parent-landing-conv]
tags: [brand, launch]
---

# Meeting: Spirit as brand icon + parent landing greenlit

## What we discussed

The CEO opened a brand-identity conversation by asking the C-suite to verify what "the spirit" referred to in the FrontDesk app. After confirmation, the CEO declared the Spirit the Neuvetra brand icon, sketched a parent-landing experience built around it, and instructed that the parent be built in a new codebase under `Neuvetra\`.

**On the Spirit.** CPO/CTO read `Neuvetra\FrontDesk\code\apps\web\src\lib\spirit\` and `data\spirit-presets.ts` and confirmed: a curl-noise-driven Three.js particle simulation, controlled by an XState machine, with named presets per page. Default preset on the live FrontDesk landing: deep blue (`#001020`) and desaturated teal (`#00446d`) on near-black (`#0b0c0d`), low motion, dreamlike. The engine accepts behavior events (`SET_PRESET`, `CHANGE_COLORS`, `MOVE_TO`, `WANDER`, `SURGE`, `SET_SPEED`, `SET_CURL`, `PLAY_SFX`).

**On the parent landing.** The CEO described: a load screen with a few lines about Neuvetra (AI tools for businesses), two product entry points (FrontDesk and Terrascope), the Spirit dancing behind everything, color-shifting and reactive to the user. Clicking a product opens a chat surface where the user can type or speak (microphone) to learn about that product before being handed off to the real subscription flow. Both product surfaces support voice + text input.

**On scope.** CPO surfaced five questions: full-bleed Spirit vs scoped zone; which engine events drive the reactivity; embedded real chatbots vs lightweight explainer chatbots; voice on parent for Terrascope (whose real product is text-only today); Spirit code as shared package vs copy. CPO recommendations: full-bleed reading is the literal interpretation; explainer-chatbot first; voice on parent yes (it's a marketing surface, not the product runtime); extract the Spirit into a shared package.

**On where it lives.** The CEO closed the parent-landing-site decision with the instruction to build in a new codebase under the Neuvetra workspace. This is a sibling to `Neuvetra\FrontDesk\` and `Neuvetra\Terrascope\`. Directory name not yet picked.

## Decisions

- **Closed:** [[2026-04-25-spirit-as-brand-icon]] — Adopt the FrontDesk Spirit as the Neuvetra brand icon.
- **Closed:** [[2026-04-25-parent-landing-site]] — Parent landing site lives in a new sibling codebase under `Neuvetra\` (Option 1).

## Action items

1. Save this conversation and synthesize wiki pages — done in this save.
2. Stand up the new codebase under `Neuvetra\`. Pick the directory name. Match the standard Neuvetra stack ([[stack]]). Add Three.js + XState for the Spirit.
3. Decide the Spirit-code packaging approach: extract into a shared package vs copy. CPO recommendation on file: extract.
4. Spec the explainer-chatbot per product — FAQ scope, prompt template, hand-off CTA, voice + text input.
5. Define `frontdeskHover` and `terrascopeHover` Spirit presets and the reactivity event wiring (which engine events fire on which interactions).
6. Define the reduced-motion / mobile fallback for the Spirit (accessibility + performance).
7. Plan the domain re-routing — `neuvetra.com` and `neuvetra.ai` move from FrontDesk to the new parent site once shipped; FrontDesk migrates to a subdomain or sub-route.

## Open questions

See [[parent-landing-experience]] § Open questions for the complete list. Most material:

- **Embedded real chatbots vs explainer chatbots** for the product surfaces on the parent. Recommendation on file (explainer-first); CEO did not explicitly close.
- **Spirit code packaging.** Extract vs copy. Recommendation on file (extract); not confirmed.
- **Static-mark / logotype** counterpart to the Spirit for off-screen contexts. Tracked under [[2026-04-25-brand-identity]] which remains open for these sub-questions.
- **Voice/tone copy guidelines.** Same — open under [[2026-04-25-brand-identity]].

## CEO direction captured

Verbatim where attribution matters:

- *"I want to pick that spirit as our type of brand icon for now."* — Spirit is the brand icon, with "for now" as the explicit caveat.
- *"The very first screens in Neuvetra have a very few lines about what we do, providing AI tools for businesses; and then we have two products … and then the spirit is dancing behind those two products."*
- *"Both front desk and Terrascope, when a user clicks on them, become kind of a chat box that the user can even type in or talk to them via the microphone and get some information about the product."*
- *"We are building it in the new work base. And code base."* — parent landing in a new codebase under `Neuvetra\`.

> **Transcription note.** The CEO is using voice transcription. One artifact in the source conversation rendered "neuvetra.com" as "wetrob.com"; the raw conversation file flags this and the CEO subsequently confirmed mid-save that voice transcription is in use. Future saves should expect occasional name-recognition artifacts and disambiguate from context.
