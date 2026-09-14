---
id: overview
type: topic
title: "Neuvetra — overview"
aliases: [company overview, neuvetra at a glance]
status: active
created: 2026-04-25
updated: 2026-09-12
discussed_in: [2026-09-08-neuvetra-ghg-focus, 2026-09-09-answer-quality-and-session-handoff, 2026-09-11-neuvetra-m42-deterministic-calculation, 2026-09-11-neuvetra-m43-rag-pilot-readiness, 2026-09-12-neuvetra-m46-live-failure-and-m47-remediation, 2026-09-12-neuvetra-m49-h02-regression-readiness, 2026-09-12-neuvetra-m50-live-adapter-blocked, 2026-09-12-neuvetra-m50-v4-live-adapter-readiness, 2026-09-12-neuvetra-m50-v4-live-failure-and-m51-remediation]
tags: [overview, synthesis]
related: [frontdesk, terrascope, site, multi-product-launch, stack, ceo, c-suite, spirit, parent-landing-experience, 2026-04-25-spirit-as-brand-icon, 2026-04-25-spirit-packaging, 2026-04-25-wiki-architecture-policy, 2026-04-26-neuvetra-kb-design, 2026-04-27-site-deploy-and-dns, 2026-04-28-consolidate-into-single-monorepo]
mentions: [frontdesk, terrascope, site, spirit]
sources: [2026-09-09-answer-quality-and-session-handoff-conv]
---

# Neuvetra — overview

Evolving synthesis of Neuvetra's company state. Updated whenever a save materially shifts the picture. **First page to read** for any topic-based query that doesn't yet have a dedicated page.

## Definition

Neuvetra is now focused on one California/U.S. greenhouse-gas research and accounting application, owned and operated by [[ceo]] (Nima Birgani). The September 8 direction retires TerraScope as a customer-facing brand and defers FrontDesk. The C-level work combines founder, product and technology judgment with independently verified sources and staged demonstrations. See [[2026-09-08-neuvetra-ghg-focus]].

## Why it matters at Neuvetra

This page is the chatbot's "what is Neuvetra" answer. Every other curated page sits beneath it.

## Current state

**September 12 product checkpoint:** [[2026-09-12-neuvetra-m46-live-failure-and-m47-remediation]] records the failed, sealed and non-reusable first M43 canary. [[2026-09-12-neuvetra-m47-v4-offline-closure]] records its accepted local repair, and [[2026-09-12-neuvetra-m48-heldout-selection-blocked]] records why no remaining M43 case is novel inside S01–S18. The board chose the regression route; [[2026-09-12-neuvetra-m49-h02-regression-readiness]] records its offline package. M50 v4 later made one approved analyze request and failed safely after exact $0.033685 settlement, with no answer or retry. [[2026-09-12-neuvetra-m50-v4-live-failure-and-m51-remediation]] records that closure and the independently accepted M51 v4 provider-disabled diagnostic/wrapper repair. The exact M50 response subtype and live compatibility remain unknowable. No live rerun or publication is authorized. Customer pilot, tenant isolation and production remain open. M42 remains the first accepted local deterministic calculation slice. See [the current board report](../operations/board-report.md) and [handoff](../operations/next-session.md).

**September 9 live validation and benchmark:** [[2026-09-09-scope2-benchmark]] supersedes the earlier queued-only handoff. The initial live EPA test met13/21 expectations; the isolated official ten-question benchmark scored0/20, with original failures preserved. General question handling and a separately reviewed EPA supplier inquiry were improved; a provider compatibility failure was independently diagnosed and repaired. New GHG Protocol hosted content remains separately held. Current local work is unpublished; no persistent agent team or scheduled continuation is configured.

**September 8 correction:** the source repository is preserved at `checkpoint/pre-ghg-focus-2026-09-08` (`367497e`). Current GHG work must not inherit the completion claims below: the TypeScript calculator/database are throwing stubs, the Python suite has unfinished expectations, and the legacy RAG pipeline does not verify claim support. The new assessment and source manifests live in [`docs/research/`](../docs/research/). Signed-in Railway inspection confirms Site and FrontDesk still deploy from the old repositories; public FrontDesk API health failed. The following April sections are historical context, not current product scope or readiness.

### Repo structure

**As of 2026-04-28, single private monorepo at `github.com/neuvetra-hq/neuvetra`** ([[2026-04-28-consolidate-into-single-monorepo]]). Layout:

```
neuvetra/
├── apps/
│   ├── frontdesk-{api,web}    ← serves neuvetra.com
│   ├── site-{api,web}         ← serves www.neuvetra.ai
│   └── terrascope-{api,web}   ← not yet deployed
├── packages/
│   ├── frontdesk-{database,config}
│   └── terrascope-{database,config,calculator}
├── claude-memory/             ← C-level memory (this wiki)
├── neuvetra-kb/               ← public salesperson RAG
├── ghg-kb/                    ← Terrascope domain RAG
└── docs/
```

Old per-product GitHub repos (`neuvetra-hq/front-desk`, `neuvetra-hq/site`, `neuvetra-hq/neuvetra-ghg-wiki`) remain available for archival reference; will be flagged read-only once Railway is repointed at the new monorepo.

### The two products + the parent surface

- **[[frontdesk]]** — AI voice front-desk for SMBs. **Live in production at `neuvetra.com`** (Railway, currently pointed at the OLD `front-desk` repo until [[2026-04-28-consolidate-into-single-monorepo]] § Consequences "Railway re-point" lands). Targets accounting, auto-repair, car dealerships, chiropractic, cleaning. Frontend further along; no knowledge base yet. *(Note from 2026-04-27: the `neuvetra.com` `www` CNAME points at `vercel-dns-017.com` — possible Vercel involvement to verify next FrontDesk-focused session.)*
- **[[terrascope]]** — GHG emissions reporting chatbot. Backend + DB + calculation engine real; frontend placeholder. Powered by the GHG knowledge base at `ghg-kb/`. Targets US (SB 253, SB 261, CARB MRR) and EU (CSRD, ESRS E1) regulated businesses. Not yet deployed.
- **[[site]]** — Neuvetra parent landing surface. **LIVE in production at `https://www.neuvetra.ai`** as of 2026-04-27 ([[2026-04-27-site-deploy-and-dns]]). Both services (`site-web` + `site-api`) deployed in Railway `Neuvetra-AI` project alongside Langfuse. Homepage v1 (Spirit + wordmark + slogan + product cards + chat input) + chat backend M1 (Vercel AI SDK + OpenTelemetry-based Langfuse + XState skeleton + greeter agent) + M2 pilot tools (Spirit movement + color via agent tool calls). End-to-end verified including production traces. Currently pointed at OLD `site` repo until Railway re-point.

The two products follow the same pattern: greet → context-gather → convert to subscription. Site is the first impression that frames them as siblings of one brand.

### Domains

- `neuvetra.com` — FrontDesk's home (live, Railway). Indefinitely — the original "swap to Site" plan is closed.
- `neuvetra.ai` — Site's home (live, Railway `Neuvetra-AI`). `www.neuvetra.ai` is canonical; `api.neuvetra.ai` for the chat backend; bare apex 301-forwards to `www` via Squarespace URL Forwarding. Same `www` + `api` subdomain pattern as `.com`. See [[2026-04-27-site-deploy-and-dns]] § Decision 5.

Both domains stay on Squarespace as registrar + DNS host. Cloudflare migration is the contingency if apex SSL ever becomes a real user issue.

### Brand

- **Brand icon:** [[spirit]] — a curl-noise-driven Three.js particle field, adopted [[2026-04-25-spirit-as-brand-icon|on 2026-04-25]] as the Neuvetra brand icon. Lives in [[frontdesk]]'s + [[site]]'s codebases today (duplicated per [[2026-04-25-spirit-packaging]]); extraction trigger fires when [[terrascope]]'s frontend lights up. In the new monorepo, that extraction is a one-line workspace move.
- **Static-mark / logotype, type scale, palette spec, voice/tone:** still open under [[2026-04-25-brand-identity]].

### Knowledge stores at Neuvetra (three, all version-controlled now)

- `claude-memory/` — **this wiki. C-level strategy + memory for ALL Neuvetra conversation.** Source of truth for cross-product decisions, plans, brand, products, features, tech rationale, conversations. **Internal-only forever.** Now version-controlled in the monorepo (was untracked pre-2026-04-28).
- `neuvetra-kb/` — **the brand-level public salesperson RAG.** Scaffolded 2026-04-26. Public-safe gated; conversation-driven authoring; nine sales-shaped page types; `products: []` tagging; `visibility: public | draft`; exports to Weaviate; feeds the eventual Site homepage salesperson chatbot. **Trigger-vocabulary boundary** with `claude-memory/` per root `CLAUDE.md` Cross-Product Absolute Rule #1.
- `ghg-kb/` — **the Terrascope product-domain RAG** (regulations, methodologies, factor data). Document-driven ingestion → graph DB → product-RAG chatbot. **Data-integrity-critical.** Mirrors this wiki's raw → curated pattern. Was its own GitHub repo (`neuvetra-hq/neuvetra-ghg-wiki`) until 2026-04-28; now absorbed into the monorepo.

The previously-flagged `FrontDesk/wiki/` placeholder was deleted in the 2026-04-28 restructure (was empty; redundant under [[2026-04-25-wiki-architecture-policy]]).

### Open decisions (calls outstanding)

1. `[[2026-04-25-brand-identity]]` — partially anchored on `[[spirit]]`; logotype, type scale, palette spec, voice/tone still open.
2. `[[2026-04-25-calculator-implementation-strategy]]` — Python canonical, TS canonical, or parallel.

**Recently closed (2026-04-28):** `[[2026-04-28-consolidate-into-single-monorepo]]`.

Parent initiative: `[[multi-product-launch]]`.

### Tech stack at a glance

All three apps share: Bun + Turborepo + Elysia (port 3000) + Vite + React 19 + React Router v7 + Tailwind v4 + Railway (deploy). Drizzle + Supabase (single shared Neuvetra project, was FrontDesk's, being renamed) + Anthropic SDK / Vercel AI SDK (`claude-sonnet-4-6`) for chat. [[site]] adds Three.js + XState. See [[stack]].

## Related

- [[frontdesk]], [[terrascope]] — the products.
- [[site]] — the parent landing surface.
- [[multi-product-launch]] — the active plan.
- [[parent-landing-experience]] — the parent-surface feature (Spirit + two product chat surfaces).
- [[spirit]] — the brand icon.
- [[ceo]], [[c-suite]] — the people.
- [[stack]] — the shared tech.
- [[2026-04-28-consolidate-into-single-monorepo]] — the monorepo decision.
- [[2026-04-25-establish-c-level-wiki]], [[2026-04-25-wiki-raw-layer]], [[2026-04-25-wiki-architecture-policy]] — meta-decisions about this wiki itself.
