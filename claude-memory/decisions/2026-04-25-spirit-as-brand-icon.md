---
id: 2026-04-25-spirit-as-brand-icon
type: decision
title: "Decision: Adopt the FrontDesk Spirit as the Neuvetra brand icon"
status: closed
created: 2026-04-25
updated: 2026-04-25
decided_on: 2026-04-25
decided_by: CEO
hats: [CPO]
related: [2026-04-25-brand-identity, 2026-04-25-parent-landing-site, parent-landing-experience, spirit, frontdesk, terrascope, multi-product-launch]
mentions: [frontdesk, terrascope]
discussed_in: [2026-04-25-spirit-as-brand-and-parent-landing]
sources: [2026-04-25-spirit-as-brand-and-parent-landing-conv]
tags: [brand]
---

# Closed: Adopt the FrontDesk Spirit as the Neuvetra brand icon

## Context

The brand identity for Neuvetra was an open call — see [[2026-04-25-brand-identity]]. No design system, no logo, no copy guidelines yet. Both products had stub UIs; [[frontdesk]] further along.

In the FrontDesk frontend (`Neuvetra\FrontDesk\code\apps\web\src\lib\spirit\` and `data\spirit-presets.ts`), there is already a working visual centerpiece — a curl-noise-driven Three.js particle field rendered as triangles, controlled by an XState machine, with named presets per page. It runs full-screen behind the FrontDesk landing hero today on `neuvetra.com`. The CEO opened this session asking the C-suite to confirm what "the spirit" referred to, and after confirmation, picked it as the Neuvetra brand icon.

## Current de-facto state

- The Spirit lives in [[frontdesk]]'s codebase only, not yet shared.
- It is rendered on the live FrontDesk landing at `neuvetra.com` (Railway-deployed).
- Its default preset is deep blue (`#001020`) and desaturated teal (`#00446d`) particles on a near-black (`#0b0c0d`) background, low motion, dreamlike.

## Options

1. **Adopt the Spirit as the Neuvetra brand icon.** Lift it up to the parent brand surface. Reuse the engine, develop a cross-product preset system that includes hover/voice/state-driven color shifts.
2. **Commission a static brand mark / logo** in parallel and treat the Spirit as a product-specific motif inside FrontDesk only.
3. **Both** — the Spirit as the dynamic brand surface online, plus a static mark for off-screen contexts (favicon, social previews, billing receipts, business cards). Likely the long-run answer regardless of the call here.

## Call

**Option 1**, with Option 3 implied for non-screen contexts in time. The Spirit is the Neuvetra brand icon "for now" — the explicit caveat the CEO attached. Static-mark / logotype work remains under [[2026-04-25-brand-identity]] but is decoupled from this call.

## Why

- It already exists, it works, and the CEO recognises it as expressive of the brand's feel.
- It is dynamic and reactive — fits the company positioning ("AI tools for businesses") better than a static glyph would.
- Both subscription chatbots are conversational surfaces; an ambient, reactive visual identity matches that conversational pattern.
- Does not commit to or block any future static-mark decision.
- Decoupling unblocks immediate work on the parent landing surface without waiting on a full brand-identity exercise.

## Consequences

- The Spirit is no longer a FrontDesk-internal motif. It becomes a Neuvetra-level asset and needs to be packaged accordingly. See open question on packaging in [[parent-landing-experience]].
- Per-product palettes need to be defined for the parent landing context — the Spirit's color shifts should signal "you're hovering FrontDesk" / "you're hovering Terrascope" without breaking visual continuity. Existing FrontDesk presets (`howItWorks` green, `pricing` purple, `signIn` teal, `getStarted` amber) are starting reference points; Terrascope likely gets an earthy/green identity.
- The Spirit's motion physics, bloom, and triangle vs particle rendering carry over as default brand-language. Designers / future hires inherit these as the visual baseline.
- Brand voice and copy guidelines remain unresolved in [[2026-04-25-brand-identity]] — this decision is the visual anchor, not the full brand system.
- The Spirit's accessibility and performance footprint on mobile / low-end devices becomes a brand concern, not a per-product concern. Needs a fallback-state spec.

## Next

- Capture the Spirit as a brand page: [[spirit]] (created in same save).
- Define parent-context Spirit presets (per-product hover states) — track on [[parent-landing-experience]].
- Decide Spirit-code packaging (shared package vs copy) — track on [[parent-landing-experience]].
- Continue the rest of [[2026-04-25-brand-identity]] for logotype, type system, voice/tone.
