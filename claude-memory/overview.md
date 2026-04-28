---
id: overview
type: topic
title: "Neuvetra — overview"
aliases: [company overview, neuvetra at a glance]
status: active
created: 2026-04-25
updated: 2026-04-28
tags: [overview, synthesis]
related: [frontdesk, terrascope, site, multi-product-launch, stack, ceo, c-suite, spirit, parent-landing-experience, 2026-04-25-spirit-as-brand-icon, 2026-04-25-spirit-packaging, 2026-04-25-wiki-architecture-policy, 2026-04-26-neuvetra-kb-design, 2026-04-27-site-deploy-and-dns, 2026-04-28-consolidate-into-single-monorepo]
mentions: [frontdesk, terrascope, site, spirit]
sources: []
---

# Neuvetra — overview

Evolving synthesis of Neuvetra's company state. Updated whenever a save materially shifts the picture. **First page to read** for any topic-based query that doesn't yet have a dedicated page.

## Definition

Neuvetra is the parent brand for two independent subscription chatbots, owned and operated by [[ceo]] (Nima Birgani). The C-level is run by Nima as CEO and [[c-suite]] (Claude wearing CFO / CPO / CTO hats). Both products share a tech stack and a shared brand surface; otherwise they're independent.

## Why it matters at Neuvetra

This page is the chatbot's "what is Neuvetra" answer. Every other curated page sits beneath it.

## Current state

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
