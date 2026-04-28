---
id: 2026-04-25-brand-identity
type: decision
title: "Open: define Neuvetra brand identity"
status: open
created: 2026-04-25
updated: 2026-04-25
related: [multi-product-launch, frontdesk, terrascope, 2026-04-25-spirit-as-brand-icon, 2026-04-25-parent-landing-site, spirit, parent-landing-experience]
mentions: [frontdesk, terrascope, spirit]
discussed_in: [2026-04-25-spirit-as-brand-and-parent-landing]
sources: [2026-04-25-spirit-as-brand-and-parent-landing-conv]
tags: [brand]
---

# Open: define Neuvetra brand identity

## Context
No design system, no logo, no copy guidelines, no shared component library. Both product apps currently have stub UIs ([[frontdesk]] further along).

A first anchor was set [[2026-04-25-spirit-as-brand-icon|on 2026-04-25]]: the **Spirit** ([[spirit]]) is the Neuvetra brand icon. It defines the dynamic, on-screen visual identity. The rest of the brand system below remains open.

## Scope of the decision

- **Logo / static mark** — Spirit is the dynamic brand icon. A static counterpart (logotype, glyph) is still needed for favicon, social previews, billing receipts, contracts, business cards, and any off-screen context.
- **Color palette** — Spirit's preset palettes establish the brand colors in motion. A formal palette spec (primary, secondary, neutrals, semantic) extending the Spirit colors is still needed.
- **Type scale** — not yet defined.
- **Voice/tone guidelines** — not yet defined. Both products are conversational (chatbots) so this is high-leverage.
- **Shared component library** (or design tokens) used by both products and the parent landing — not yet defined.
- **Domain alignment** between `neuvetra.com` and `neuvetra.ai` — partially handled by [[2026-04-25-parent-landing-site]] (parent surface shared across both).

## Status

Partially anchored.

- **Anchored:** dynamic visual identity → [[spirit]].
- **Still open:** static mark, type, palette spec, voice/tone, component library.

Needs a focused CPO session to draft `brand\identity.md` covering the still-open sub-questions.

## Next

- Decide whether to commission a designer or do it in-house.
- Spec the static-mark counterpart to the Spirit. Direction: should resolve well at favicon size, work on light and dark backgrounds, and visually rhyme with the Spirit's deep-blue / triangle / curl-organic feel.
- Draft type scale and extended palette in a `brand\identity.md` page.
- Draft voice/tone guidelines — particularly important for the explainer chatbots on [[parent-landing-experience]].
