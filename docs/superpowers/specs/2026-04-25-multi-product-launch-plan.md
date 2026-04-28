# Neuvetra — Multi-Product Launch Plan

**Date:** 2026-04-25
**Status:** Draft v1 — for joint planning between Nima and Claude
**Scope:** Bring FrontDesk and Terrascope to launchable state under the Neuvetra parent brand.

> Paths in this document use logical names (`<wiki>`, `<frontdesk>`, `<terrascope>`) rather than absolute paths because the monorepo restructure (see `2026-04-25-monorepo-restructure-plan.md`) is pending. After restructure, `<umbrella>` = `C:\Users\nimab\Neuvetra\`, `<wiki>` = `<umbrella>\ghg-wiki\`, `<frontdesk>` = `<umbrella>\front-desk\`, `<terrascope>` = `<umbrella>\terrascope\`.

---

## North Star

A visitor lands on `neuvetra.com` (or `.ai`), sees two clearly differentiated chatbot products under one brand, picks one, has a conversation that ends in a paid subscription. Both products feel like cousins, not strangers — same brand language, distinct personalities.

---

## Where Each Piece Stands Today

| Piece | Backend | Database | Frontend | Auth | Billing | Marketing |
|---|---|---|---|---|---|---|
| **FrontDesk** | Real (Elysia + Bun) | Real (Drizzle + Supabase) | Real — landing, auth, onboarding, legal pages, Playwright E2E | Implemented (Supabase) | Not yet | Single-product landing only |
| **Terrascope** | Real (Elysia + chat route + factors API) | Real (5 tables, 2,138 factors seeded, RLS on) | "Coming soon" placeholder | Not yet | Not yet | None |
| **Neuvetra Wiki** | n/a — content workspace | n/a (content lives in markdown) | n/a (Obsidian) | n/a | n/a | n/a |
| **Parent Neuvetra brand** | n/a | n/a | **Does not exist** | — | — | **Does not exist** |

**The bottlenecks:** Terrascope frontend, parent landing, billing for both, and a unified brand identity.

---

## Three Tracks, Run In Parallel

### Track A — Shared Foundations (cross-product)

These unblock both products. Doing them once is cheaper than doing each twice.

1. **Brand identity.** Logo, color palette, type system, tone of voice. Output: a one-page brand reference under `<umbrella>\docs\brand\` plus exported assets in `<umbrella>\assets\`.
2. **Design system.** Shared Tailwind config + component primitives (Button, Input, Chat bubble, Modal, Card). Lives as a sibling package eventually shared by both apps. For now: a reference implementation in either product, ported once stable.
3. ~~**Wiki retrieval store decision.**~~ **Decided 2026-04-25 — Weaviate.** Native graph + vector in one store. Build the wiki export pipeline against the Weaviate client. Inputs: design spec at `<wiki>\docs\superpowers\specs\2026-04-24-ghg-wiki-design.md`.
4. **Auth & billing model.** Decide whether subscriptions are per-product (each product has its own Stripe account/customer) or per-Neuvetra-account (one customer, two product entitlements). This decision shapes the Supabase auth schema for both products.
5. **Parent landing site.** Repo decision (new fourth folder vs. sub-route of an existing app), then build a two-product landing.

### Track B — Terrascope to MVP

Terrascope's gap is mostly frontend.

1. **Chat UI.** Replace the "coming soon" placeholder with a real chat surface that calls the existing `/chat` route. Streaming response handling. Source citations rendered inline.
2. **Auth.** Match the FrontDesk pattern (Supabase, OTP). Once the auth model decision (Track A.4) lands, implement.
3. **Onboarding.** Capture the company profile fields the database already has (name, NAICS, jurisdiction, revenue). Match FrontDesk's onboarding pattern.
4. **Pricing page + paywall.** Free conversation up to N turns; paid for full reports. Stripe integration.
5. **Reporting flow.** "Generate my SB 253 / SB 261 / CSRD report" — the actual product output. Pulls from `ghg_reports` table.
6. **Reproducibility cleanup.** Refactor `seed-factors.ts` to use env vars not hardcoded paths. Version the Supabase RLS policies as a migration so they're not just in the dashboard.
7. **Deploy config.** Railway `Procfile` / `railway.json` for both api and web.

### Track C — FrontDesk to launch

FrontDesk is closer; the remaining work is mostly the same Track A items applied here.

1. **Brand pass.** Re-skin the existing landing/auth/onboarding to the new Neuvetra-aligned brand from Track A.1.
2. **Pricing + Stripe.** Same Track A.4 outcome applied here.
3. **Production deploy.** Railway config; smoke tests; monitoring.
4. **Marketing site updates.** Position as one of two Neuvetra products (today the FrontDesk landing assumes it's standalone).

---

## Sequencing — What Blocks What

```
Track A.1 Brand identity ──┬──► Track C.1 FrontDesk brand pass
                           └──► Track B.1 Terrascope chat UI (uses brand from day one)

Track A.4 Auth/billing model ──┬──► Track B.2/B.4
                               └──► Track C.2

Track A.5 Parent landing ──── (depends on A.1)

Track A.3 Wiki store decision ──► Wiki export pipeline ──► Terrascope RAG (post-MVP)
```

The **first three things to do**, in order, that unblock everything else:

1. **Run the monorepo restructure script** (separate plan; ~30 min including verification).
2. **Decide Track A.1 (brand) and Track A.4 (auth/billing model).** These are cheap decisions but block visible work in both products.
3. **Build Terrascope chat UI** (Track B.1) using the new brand, in parallel with the FrontDesk re-skin (Track C.1).

---

## How We Work Together

The "communication plan" piece you asked for. Two-tier:

**Top level** — when you say "let's plan Q2" or "give me a status across both products," I read the parent CLAUDE.md and this plan, then think across products.

**Product level** — when you say "the chat UI" or "the auth flow," I disambiguate which product and read that product's CLAUDE.md.

**Doc conventions** for cross-product work, all under `<umbrella>\docs\`:

- `<umbrella>\docs\superpowers\specs\` — design specs and plans, date-prefixed (matches existing wiki convention).
- `<umbrella>\docs\brand\` — brand assets, voice guide, design tokens.
- `<umbrella>\docs\decisions\` — short ADRs for cross-product decisions (auth model, wiki store choice, billing approach). One file per decision, kebab-case slug.

**Status updates.** When we wrap a working session, I append a one-line entry to `<umbrella>\docs\status.md` summarizing what changed across products. Same format as the wiki's `log.md`:

```
## [YYYY-MM-DD] product | one-line summary
```

That gives us a grep-able cross-product timeline without ceremony.

---

## What's Out of Scope For This Plan

- Specific chat UI components (UX work, not in this doc).
- Pricing tiers / business model details (separate decision).
- Hiring, legal, finance — this is product/eng only.
- The parent landing site visual design — that's downstream of brand identity.

---

## Decided

- **2026-04-25 — Wiki retrieval store: Weaviate.** Native graph + vector in one store.

## Open Decisions Tracked Here

These need a call from Nima before downstream work commits:

1. **Parent landing site repo** — new fourth folder vs. sub-route of existing app.
2. **Auth/billing model** — per-product vs. per-Neuvetra-account.
3. **Component library hosting** — shared package now, or copy-paste between products until it stabilizes.
4. **First public launch order** — soft-launch one product first (which?), or both together.

---

## Next Session Suggestions

When you come back to this:

- "Run the restructure script" → I walk through dry-run output, then execute.
- "Make the brand decisions" → I facilitate Track A.1 (brand identity) as a working session.
- "Build the Terrascope chat UI" → Track B.1.
- "What's our cross-product status?" → I summarize from `<umbrella>\docs\status.md` and the two product repos.
