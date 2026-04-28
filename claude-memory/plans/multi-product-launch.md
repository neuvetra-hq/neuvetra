---
id: multi-product-launch
type: plan
status: active
created: 2026-04-25
updated: 2026-04-25
related: [frontdesk, terrascope, site, 2026-04-25-parent-landing-site, 2026-04-25-brand-identity, 2026-04-25-spirit-as-brand-icon, 2026-04-25-spirit-packaging, 2026-04-25-wiki-architecture-policy, 2026-04-25-auth-billing-strategy, 2026-04-25-calculator-implementation-strategy, parent-landing-experience, spirit]
discussed_in: [2026-04-25-spirit-as-brand-and-parent-landing, 2026-04-25-site-scaffold]
tags: [launch]
---

# Plan: multi-product launch under Neuvetra brand

## Goal
Ship [[frontdesk]] and [[terrascope]] as paid subscription products under a unified Neuvetra brand at `neuvetra.com` / `neuvetra.ai`.

## Reference
Cross-product launch plan document: `Neuvetra\docs\superpowers\specs\2026-04-25-multi-product-launch-plan.md`.

## Dependencies (open decisions — blockers)
- ~~[[2026-04-25-parent-landing-site]]~~ — **closed 2026-04-25**: new sibling codebase under `Neuvetra\`.
- [[2026-04-25-brand-identity]] — partially anchored on [[spirit]]; logo, type, voice/tone still open.
- [[2026-04-25-auth-billing-strategy]] — single account or per-product.
- [[2026-04-25-calculator-implementation-strategy]] — Terrascope-specific gating.

## Status
Scoping. Two of the original four blockers cleared on 2026-04-25:

- Parent-landing-site decision closed → see [[2026-04-25-parent-landing-site]] and [[parent-landing-experience]].
- Brand-identity partially anchored on the Spirit → see [[2026-04-25-spirit-as-brand-icon]] and [[spirit]]. Sub-questions (logo, type, voice/tone, palette spec) remain open under [[2026-04-25-brand-identity]].

Two original blockers remain: [[2026-04-25-auth-billing-strategy]] and [[2026-04-25-calculator-implementation-strategy]].

## Milestones (provisional)
- **M1** — Brand identity v1.
  - **M1a (done):** Spirit adopted as brand icon. `[[2026-04-25-spirit-as-brand-icon]]`.
  - **M1b:** Static-mark / logotype, type scale, palette spec, voice/tone — under `[[2026-04-25-brand-identity]]`.
- **M2** — Parent landing site live at `neuvetra.com` and `neuvetra.ai` — see `[[parent-landing-experience]]`. Includes:
  - ~~Stand up new codebase under `Neuvetra\`~~ → **done 2026-04-25 → `[[site|Site]]` at `Neuvetra\Site\`.** See `[[2026-04-25-site-scaffold]]`.
  - ~~Decide Spirit-code packaging~~ → **closed → copy.** See `[[2026-04-25-spirit-packaging]]`.
  - Lift the Spirit (Cycle 2 — copy `lib/spirit/*` + presets + audio from FrontDesk into Site).
  - Build parent-landing real content (Cycle 3 — headline, two product entry-point cards, hover presets).
  - Build the two product chat surfaces (Cycle 4 — text + voice; explainer scope per `[[parent-landing-experience]]` Q6).
  - Re-route `neuvetra.com` / `neuvetra.ai` to Site; FrontDesk migrates to a subdomain (Cycle 5).
  - Mobile / reduced-motion / accessibility pass for Spirit (Cycle 6).
- **M3** — FrontDesk shippable end-to-end (frontend + voice + billing).
- **M4** — Terrascope shippable end-to-end (frontend + chatbot + factor pipeline + billing).
- **M5** — Cross-product nav + (if decided) unified account.

## Next
- Resolve the remaining two open decisions: billing → calculator.
- M2 Cycle 2: copy the Spirit into Site. See `[[parent-landing-experience]]` § Next.
- Continue the rest of `[[2026-04-25-brand-identity]]` (logotype, type, voice/tone) — particularly voice/tone for the parent's explainer chatbots.
- Resolve `FrontDesk\wiki\` placeholder under `[[2026-04-25-wiki-architecture-policy]]`.
