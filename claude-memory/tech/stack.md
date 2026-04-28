---
id: stack
type: tech
status: active
created: 2026-04-25
updated: 2026-04-27
related: [frontdesk, terrascope, site, anthropic, supabase, weaviate, drizzle, vercel-ai-sdk, langfuse, xstate]
tags: [tech, infra]
---

# Shared Tech Stack

Common stack across [[frontdesk]], [[terrascope]], and [[site]]. Diverging versions creates pointless drift — keep them in lockstep.

## Runtime
- **Bun** — package manager + runtime. v1.2+ in both products.
- **Turborepo** — monorepo orchestration.

## Backend
- **Elysia** — API framework, port 3000.
- **Drizzle** — ORM. See [[drizzle]].
- **Eden** — type-safe client (`export type App = typeof app` from `apps/api/src/index.ts`).

## Frontend
- **Vite** — bundler / dev server.
- **React 19**.
- **React Router v7**.
- **Tailwind v4**.

## Data
- **Supabase** — Postgres + auth. **Single Neuvetra-wide project shared across products** (closed [[2026-04-25-auth-billing-strategy]] on 2026-04-26 in favor of single-Neuvetra-account; FrontDesk's existing project is the shared one). [[terrascope]]'s eventual consolidation pending. See [[supabase]].
- **Weaviate** — vector + graph for [[terrascope]] wiki retrieval (M3+) and [[site]]'s salesperson chatbot retrieval against [[neuvetra-kb]] (M3+). See [[weaviate]].

## AI
- **Anthropic Claude SDK** — used directly in [[frontdesk]] and [[terrascope]] backends today. Default model `claude-sonnet-4-6`. See [[anthropic]].
- **[[vercel-ai-sdk]]** — provider-portable LLM abstraction layer. Adopted in [[site]] starting [[site-chat-backend]] M1 (2026-04-26) to satisfy the day-one provider-portability requirement. [[frontdesk]] + [[terrascope]] migrate when next touching their AI code. (Naming clarification: Vercel AI SDK is a TypeScript library; runs on Bun + Railway fine. Not a Vercel-deploy-only thing.)
- **[[langfuse]]** — prompt management + tracing + evals. Self-hosted on Railway as a sibling service. Code-first prompts (TypeScript modules are the source of truth, synced to Langfuse for runtime fetch + UI editing). Adopted starting [[site-chat-backend]] M1.
- **[[xstate]]** — multi-agent orchestration in the AI backend (added 2026-04-26). Each agent = state, sub-agents = invoked actors, handoffs = transitions. Already in stack for UI behavior (the [[spirit]]); now does double duty on the backend.

## Deploy
- **Railway** — deploy target for both products. **FrontDesk is live in production at `neuvetra.com`** (see [[2026-04-25-domain-deployment-state]]); `neuvetra.ai` DNS-aliases to it. Terrascope not yet deployed. Whether FrontDesk's Railway configs are committed in-repo is TBD.

## Environments
- **Today: a single environment per product, treated as production.** [[site]] live at `https://www.neuvetra.ai` is the only Site env. [[frontdesk]] live at `neuvetra.com` is the only FrontDesk env. [[terrascope]] not yet deployed (will start as one env too). Local development on a laptop is the de facto "dev" — there is no separate hosted dev / staging / QA target.
- **Trajectory** (no concrete date): split into at least **dev + production**, possibly **dev + QA + production**, when one of the following triggers fires: (a) public marketing push that puts real users on the live URL, (b) a regression caught in production that a staging environment would have caught, (c) a deploy that requires multi-day soak before going live. Until then, single-env discipline + careful PR review + the [[site-chat-backend]] hardening pile (see `Site/apps/api/HARDENING.md`) are the perimeter.
- **Implication for code:** any "is this production?" branch must use `NODE_ENV` (or an equivalent explicit env var) rather than assuming the deploy target is always live. Today the Langfuse OTel `environment` tag in `Site/apps/api/src/instrumentation.ts` does exactly this — it falls back to `"development"` if `NODE_ENV` is unset, which is correct behavior and pre-stages the future split.

## Env
- Typed access through `apps/api/src/env.ts`. Never hardcode keys.

## Workflow tooling
- **Claude Desktop + filesystem MCP** — primary brainstorming and lighter-weight reads happen via Claude Desktop projects scoped to each product. Claude Code remains primary for heavier work. See [[claude-desktop-setup]].

## Convention
- If a pattern emerges in one product that should apply to both, port it. The shared stack is a feature, not an accident.

## Tech we use but don't break out into separate pages yet
Turborepo, React, React Router, Tailwind, Vite, Eden, Bun, Elysia, Railway, Twilio (FrontDesk — A2P 10DLC campaign approved at the Twilio account level, **shared across products** via the unified Neuvetra Supabase project per [[2026-04-25-auth-billing-strategy]]), Retell (FrontDesk), Stripe.

These get their own pages once a strategic conversation justifies it.

## Next
- Commit Railway configs in both products.
- Pin Bun version across both products to the same minor.
