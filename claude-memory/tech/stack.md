---
id: stack
type: tech
status: active
created: 2026-04-25
updated: 2026-04-28
related: [frontdesk, terrascope, site, anthropic, supabase, weaviate, drizzle, vercel-ai-sdk, langfuse, xstate, 2026-04-28-consolidate-into-single-monorepo]
tags: [tech, infra]
---

# Shared Tech Stack

Common stack across [[frontdesk]], [[terrascope]], and [[site]]. **As of 2026-04-28, all three apps live in a single Bun + Turborepo monorepo at `github.com/neuvetra-hq/neuvetra`** ([[2026-04-28-consolidate-into-single-monorepo]]). Bun workspace resolution enforces version lockstep automatically — no more drift via manual coordination.

## Runtime
- **Bun** — package manager + runtime. v1.2+. Workspace lockfile at root regenerated post-consolidation.
- **Turborepo** — monorepo orchestration. Single `turbo.json` at root.

## Backend
- **Elysia** — API framework, port 3000. Lives in `apps/<product>-api/`.
- **Drizzle** — ORM. See [[drizzle]]. Per-product schema packages: `packages/frontdesk-database/`, `packages/terrascope-database/`.
- **Eden** — type-safe client. **Note:** [[site]] dropped Eden 2026-04-27 in favor of a typed `fetch()` wrapper because per-app Railway Root Directory builds make the cross-app `App` type import awkward at build time ([[2026-04-27-site-deploy-and-dns]] § Decision 3). FrontDesk + Terrascope still use Eden for their internal `web → api` communication.

## Frontend
- **Vite** — bundler / dev server.
- **React 19**.
- **React Router v7**.
- **Tailwind v4**.

## Data
- **Supabase** — Postgres + auth. **Single Neuvetra-wide project shared across products** (closed [[2026-04-25-auth-billing-strategy]] on 2026-04-26). The historical FrontDesk project is being renamed to "Neuvetra" + reorganized into per-product Postgres schemas (`frontdesk.*`, `terrascope.*`, `site.*`) as part of the 2026-04-28 infrastructuring cycle. `auth.users` + `public.users` + sync trigger stay untouched. See [[supabase]].
- **Weaviate** — vector + graph for [[terrascope]] wiki retrieval (M3+) and [[site]]'s salesperson chatbot retrieval against [[neuvetra-kb]] (M3+). See [[weaviate]].

## AI
- **Anthropic Claude SDK** — used directly in [[frontdesk]] and [[terrascope]] backends today. Default model `claude-sonnet-4-6`. See [[anthropic]].
- **[[vercel-ai-sdk]]** — provider-portable LLM abstraction layer. Adopted in [[site]] starting [[site-chat-backend]] M1 (2026-04-26) to satisfy the day-one provider-portability requirement. [[frontdesk]] + [[terrascope]] migrate when next touching their AI code. (Naming clarification: Vercel AI SDK is a TypeScript library; runs on Bun + Railway fine. Not a Vercel-deploy-only thing.)
- **[[langfuse]]** — prompt management + tracing + evals. Self-hosted on Railway as a sibling service. Code-first prompts (TypeScript modules are the source of truth, synced to Langfuse for runtime fetch + UI editing). Adopted starting [[site-chat-backend]] M1.
- **[[xstate]]** — multi-agent orchestration in the AI backend (added 2026-04-26). Each agent = state, sub-agents = invoked actors, handoffs = transitions. Already in stack for UI behavior (the [[spirit]]); now does double duty on the backend.

## Deploy
- **Railway** — deploy target for all three apps. FrontDesk live at `neuvetra.com`; Site live at `https://www.neuvetra.ai` (in `Neuvetra-AI` Railway project alongside Langfuse); Terrascope not yet deployed. Railway configs (`railway.toml` + `Dockerfile`) committed in-repo per app. **Pending in 2026-04-28 cycle:** re-point both live services from the OLD `front-desk` and `site` GitHub repos to the new `neuvetra` monorepo, with per-app Root Directory set (e.g., `apps/frontdesk-web`, `apps/site-api`). See [[2026-04-28-consolidate-into-single-monorepo]] § Consequences.

## Environments
- **Today: a single environment per product, treated as production.** [[site]] live at `https://www.neuvetra.ai` is the only Site env. [[frontdesk]] live at `neuvetra.com` is the only FrontDesk env. [[terrascope]] not yet deployed (will start as one env too). Local development on a laptop is the de facto "dev" — there is no separate hosted dev / staging / QA target.
- **Trajectory** (no concrete date): split into at least **dev + production**, possibly **dev + QA + production**, when one of the following triggers fires: (a) public marketing push that puts real users on the live URL, (b) a regression caught in production that a staging environment would have caught, (c) a deploy that requires multi-day soak before going live. Until then, single-env discipline + careful PR review + the [[site-chat-backend]] hardening pile (see `apps/site-api/HARDENING.md`) are the perimeter.
- **Implication for code:** any "is this production?" branch must use `NODE_ENV` (or an equivalent explicit env var) rather than assuming the deploy target is always live. Today the Langfuse OTel `environment` tag in `apps/site-api/src/instrumentation.ts` does exactly this — it falls back to `"development"` if `NODE_ENV` is unset, which is correct behavior and pre-stages the future split.

## Env
- Typed access through `apps/<product>-api/src/env.ts`. Never hardcode keys.

## Workflow tooling
- **Claude Desktop + filesystem MCP** — primary brainstorming and lighter-weight reads happen via Claude Desktop projects scoped to each product. Claude Code remains primary for heavier work. See [[claude-desktop-setup]].

## Convention
- If a pattern emerges in one product that should apply to both, port it. The shared stack is a feature, not an accident.

## Tech we use but don't break out into separate pages yet
Turborepo, React, React Router, Tailwind, Vite, Eden, Bun, Elysia, Railway, Twilio (FrontDesk — A2P 10DLC campaign approved at the Twilio account level, **shared across products** via the unified Neuvetra Supabase project per [[2026-04-25-auth-billing-strategy]]), Retell (FrontDesk), Stripe.

These get their own pages once a strategic conversation justifies it.

## Next
- Re-point Railway services to the new monorepo (Issue 3b in [[2026-04-28-monorepo-restructure]]).
- Run `bun install` at root to regenerate the unified `bun.lock`.
- Pin Bun version across all apps to the same minor (workspace lockfile makes this automatic now).
