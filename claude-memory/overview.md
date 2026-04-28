---
id: overview
type: topic
title: "Neuvetra — overview"
aliases: [company overview, neuvetra at a glance]
status: active
created: 2026-04-25
updated: 2026-04-27
tags: [overview, synthesis]
related: [frontdesk, terrascope, site, multi-product-launch, stack, ceo, c-suite, spirit, parent-landing-experience, 2026-04-25-spirit-as-brand-icon, 2026-04-25-spirit-packaging, 2026-04-25-wiki-architecture-policy, 2026-04-26-neuvetra-kb-design, 2026-04-27-site-deploy-and-dns]
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

### The two products + the parent surface

- **[[frontdesk]]** — AI voice front-desk for SMBs. **Live in production at `neuvetra.com`** (deployed to Railway, alongside the wider `Neuvetra` Railway project). Targets accounting, auto-repair, car dealerships, chiropractic, cleaning. Frontend further along; no knowledge base yet. *(Note: 2026-04-27 conversation surfaced that the `neuvetra.com` `www` CNAME points at `vercel-dns-017.com` — possible Vercel involvement to verify next FrontDesk-focused session.)*
- **[[terrascope]]** — GHG emissions reporting chatbot. Backend + DB + calculation engine real; frontend placeholder. Powered by the GHG knowledge base at `Neuvetra\ghg-kb\` (top-level since 2026-04-26; was `Terrascope\ghg-kb\`). Targets US (SB 253, SB 261, CARB MRR) and EU (CSRD, ESRS E1) regulated businesses. Not yet deployed.
- **[[site]]** — Neuvetra parent landing surface. **LIVE in production at `https://www.neuvetra.ai`** as of 2026-04-27 ([[2026-04-27-site-deploy-and-dns]]). Both services (`site-web` + `site-api`) deployed in Railway `Neuvetra-AI` project alongside Langfuse. Homepage v1 (Spirit + wordmark + slogan + product cards + chat input) + chat backend M1 (Vercel AI SDK + OpenTelemetry-based Langfuse + XState skeleton + greeter agent). End-to-end verified including production traces.

The two products follow the same pattern: greet → context-gather → convert to subscription. Site is the first impression that frames them as siblings of one brand.

### Domains

- `neuvetra.com` — FrontDesk's home (live, Railway). Indefinitely — the original "swap to Site" plan is closed.
- `neuvetra.ai` — Site's home (live, Railway `Neuvetra-AI`). `www.neuvetra.ai` is canonical; `api.neuvetra.ai` for the chat backend; bare apex 301-forwards to `www` via Squarespace URL Forwarding. Same `www` + `api` subdomain pattern as `.com`. See [[2026-04-27-site-deploy-and-dns]] § Decision 5.

Both domains stay on Squarespace as registrar + DNS host. Cloudflare migration is the contingency if apex SSL ever becomes a real user issue.

The de-facto state was captured in [[2026-04-25-domain-deployment-state]] (initial); [[2026-04-26-site-chat-backend-m1-shipped]] locked the split; [[2026-04-27-site-deploy-and-dns]] wired it. The parent-landing-site decision was closed [[2026-04-25-parent-landing-site|on 2026-04-25]] in favor of a new sibling codebase under `Neuvetra\` — the spec lives at [[parent-landing-experience]].

### Brand

- **Brand icon:** [[spirit]] — a curl-noise-driven Three.js particle field, adopted [[2026-04-25-spirit-as-brand-icon|on 2026-04-25]] as the Neuvetra brand icon. Lives in [[frontdesk]]'s codebase today; will be lifted to the parent landing.
- **Static-mark / logotype, type scale, palette spec, voice/tone:** still open under [[2026-04-25-brand-identity]].

### Knowledge stores at Neuvetra (three by policy, one redundant)

Per root `CLAUDE.md`, `[[2026-04-25-establish-c-level-wiki]]`, `[[2026-04-25-folder-hierarchy]]`, `[[2026-04-25-wiki-architecture-policy]]`, and `[[2026-04-26-neuvetra-kb-design]]`:

- `Neuvetra\claude-memory\` — **this wiki. C-level strategy + memory for ALL Neuvetra conversation, regardless of which product/level it touches.** Source of truth for cross-product decisions, plans, brand, products, features, tech rationale, conversations. **Internal-only forever.**
- `Neuvetra\neuvetra-kb\` — **the brand-level public salesperson RAG.** Scaffolded 2026-04-26. Public-safe gated; conversation-driven authoring; nine sales-shaped page types (`product`, `feature`, `plan`, `use-case`, `integration`, `comparison`, `objection`, `faq`, `story`); `products: []` tagging; `visibility: public | draft`; exports to Weaviate; feeds the eventual Site homepage salesperson chatbot. **Trigger-vocabulary boundary** with `Neuvetra\claude-memory\` is the new operational rule — see root `CLAUDE.md` Cross-Product Absolute Rule #1.
- `Neuvetra\ghg-kb\` — **the Terrascope product-domain RAG** (regulations, methodologies, factor data). Top-level since 2026-04-26 (was `Neuvetra\Terrascope\ghg-kb\`); content is still Terrascope-scoped, just no longer nested under the product folder. Document-driven ingestion → graph DB → product-RAG chatbot. **Data-integrity-critical.** Mirrors this wiki's raw → curated pattern.
- `Neuvetra\FrontDesk\wiki\` — placeholder, currently empty. **Redundant under `[[2026-04-25-wiki-architecture-policy]]`** and slated for review (delete or repurpose for FrontDesk product-RAG). Site has no `wiki/` (or any embedded memory store) for the same policy reason.

### Open decisions (calls outstanding)

1. `[[2026-04-25-brand-identity]]` — partially anchored on `[[spirit]]`; logotype, type scale, palette spec, voice/tone still open.
2. `[[2026-04-25-auth-billing-strategy]]` — single Neuvetra account or per-product.
3. `[[2026-04-25-calculator-implementation-strategy]]` — Python canonical, TS canonical, or parallel.

**Recently closed (2026-04-25):** `[[2026-04-25-spirit-as-brand-icon]]`, `[[2026-04-25-parent-landing-site]]`, `[[2026-04-25-spirit-packaging]]`, `[[2026-04-25-wiki-architecture-policy]]`.

Parent initiative: `[[multi-product-launch]]`.

### Tech stack at a glance

All three codebases share: Bun + Turborepo + Elysia (port 3000) + Vite + React 19 + React Router v7 + Tailwind v4 + Eden (type-safe client) + Railway (deploy). The two products add Drizzle + Supabase (per-product project) + Anthropic SDK (`claude-sonnet-4-6`) for chat. `[[site]]` is currently a deps-only scaffold — Three.js + XState installed for the next-cycle Spirit copy, no DB. See `[[stack]]`.

## Related

- `[[frontdesk]]`, `[[terrascope]]` — the products.
- `[[site]]` — the parent landing surface codebase (scaffolded 2026-04-25).
- `[[multi-product-launch]]` — the active plan.
- `[[parent-landing-experience]]` — the parent-surface feature (Spirit + two product chat surfaces).
- `[[spirit]]` — the brand icon.
- `[[ceo]]`, `[[c-suite]]` — the people.
- `[[stack]]` — the shared tech.
- `[[2026-04-25-establish-c-level-wiki]]`, `[[2026-04-25-wiki-raw-layer]]`, `[[2026-04-25-wiki-architecture-policy]]` — meta-decisions about this wiki itself.
