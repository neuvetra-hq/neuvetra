---
id: 2026-04-26-site-chat-backend-architecture
type: meeting
title: "Meeting: Site chat backend architecture — multi-agent stack ratified"
status: shipped
created: 2026-04-26
updated: 2026-04-26
hats: [CTO, CPO]
related: [site, parent-landing-experience, frontdesk, terrascope, supabase, weaviate, anthropic, stack, multi-product-launch, 2026-04-25-auth-billing-strategy, 2026-04-25-weaviate-retrieval-store, 2026-04-26-neuvetra-kb-design, vercel-ai-sdk, langfuse, site-chat-backend]
mentions: [frontdesk, terrascope, site, supabase, weaviate]
sources: []
tags: [architecture, ai, multi-agent, chat, backend, schema]
---

# Meeting: Site chat backend architecture — multi-agent stack ratified

CEO opened a build-mode session: "the next feature is the backend for site." Initial scope was minimal — wire the homepage chat input to Claude, see "hello → hello back." The brainstorm evolved from there into a full architectural decision cycle for an AI-heavy backend, ratifying the stack that all of Site's chat features (and eventually FrontDesk's + Terrascope's per-product chatbots) will sit on top of. Design ratified, captured in `docs/superpowers/specs/2026-04-26-site-chat-backend-design.md`.

## What we discussed

Started with M1 already partially in flight: `superpowers:writing-plans` had produced `docs/superpowers/plans/2026-04-26-site-chat-backend.md` (Anthropic SDK direct, ~30-line wrapper, no framework), `superpowers:subagent-driven-development` was dispatched, Task 1 (install Anthropic SDK + env) was DONE. CEO paused execution mid-flow: *"This is going to be a very AI-heavy backend so let's discuss the tools that we need to use or that it is better to use. For example do we need to use lang chain and stuff like that?"* — triggered a full architecture brainstorm via the brainstorming skill.

**Brainstorm trajectory** (each step compressed):

1. **Scope clarification.** CEO picked D (multi-agent collaboration) initially, walked back to *"More like C at the moment"* (agentic + multi-step + tool use), then re-clarified *"And easily go to D as well"* — i.e., architecture ready for multi-agent without rewrite.

2. **Multi-agent from day one** (CEO clarification): one **greeter** agent for anonymous users (capture phone, drive signup), then handoff to **product-specialist** agents (Terrascope specialist for emissions/reports/calculations, FrontDesk specialist for receptionist work). Specialists can have **sub-agents** (PDF converter, KB retriever, calculator).

3. **Provider portability as a day-one constraint.** CEO directive: *"in the future if I want to switch, for example, to ChatGPT or Grok or any other AI and language or LLMs, I could easily do that. My data can easily be searched by other ones, like my prompt and everything."* This **flipped my earlier "skip Vercel AI SDK" recommendation** — the abstraction layer is precisely the point. Vercel AI SDK clarified as a TypeScript library, not a Vercel-deploy-only thing — runs on Bun/Railway fine.

4. **Prompt management as critical infrastructure.** CEO: *"It's gonna be very agentic and we are going to heavily need [a way to manage] prompts. We need to make sure that we save the prompts; we can log the prompts; we can work with the prompts. This is going to be a full AI training backend that we need to keep track of."* CPO surveyed alternatives (Langfuse self-hosted, LangSmith, Helicone, Braintrust, PromptLayer, build-it-ourselves) with pros/cons. CEO picked **Langfuse self-hosted on Railway**, primarily for performance: *"I really want site and application to be fast and very performant. That's my first criteria and it seems that Langfuse hosting a railway should be the fastest one."* Plus **code-first prompts** (TypeScript modules are the source of truth, synced to Langfuse for runtime fetching + UI editing).

5. **Auth + Supabase reuse.** CEO directive: *"we have everything in the FrontDesk application... we can use that technology we already built in FrontDesk and bring it here and reuse it here... We can actually use that one as our own site database."* CPO investigated FrontDesk's API code: confirmed Supabase Auth handles phone-OTP end-to-end (frontend calls `signInWithOtp`, Supabase calls Twilio internally based on project config), backend does only JWT validation via a 15-line middleware ([`FrontDesk/code/apps/api/src/middleware/auth.ts`](../../FrontDesk/code/apps/api/src/middleware/auth.ts)), A2P 10DLC campaign already approved at the Twilio account level. **Reuse strategy:** Site connects to FrontDesk's existing Supabase project as the Neuvetra-wide shared user base; ports the JWT middleware; mirrors the signup-UI pattern. Zero infrastructure setup needed — Twilio campaign approved, Supabase phone-auth configured. **This implicitly closes the open `[[2026-04-25-auth-billing-strategy]]` decision** in favor of single-Neuvetra-account.

6. **Rename question.** CEO: *"since we are upgrading the front desk database to Neuvetra application database, maybe we just rename it everywhere from super base to everywhere as well inside of our code base here in site and also in the front desk."* CPO decomposed into three layers: (1) Supabase project label in dashboard (cosmetic, anytime), (2) `@frontdesk/database` workspace-package rename to `@neuvetra/database` (touches FrontDesk only, ~1-2 hours), (3) monorepo restructuring (whether Neuvetra becomes one mega-monorepo vs three independent ones — separate brainstorm). Decision: **rename Layer 1 anytime; defer Layer 2 to its own focused cycle; defer Layer 3 to a separate architecture brainstorm**. Site M1 doesn't touch the database, so the rename is invisible to M1.

7. **M1 scope settled.** Four options proposed (A/B/C-lite/C-full); CEO picked **B**: *"Just want you to do the scaffolding especially for the backend... wiring where Vercel AI SDK and Langfuse, that's good. No auth, no super base."* M1 ships: Vercel AI SDK + `@ai-sdk/anthropic`, Langfuse self-hosted on Railway with traces from day 1, greeter agent as a config object, one-state XState machine, generic chat handler, UI wired end-to-end. Auth/Supabase/persistence/multi-agent handoff/RAG/sub-agents all M2+.

## Decisions

Per Policy C (decision-page minimization) folded into this meeting note. Each is closed 2026-04-26.

### Decision 1 — LLM provider abstraction: Vercel AI SDK

**The call.** Adopt Vercel AI SDK (`ai` + provider adapters; today `@ai-sdk/anthropic` with `claude-sonnet-4-6`). Provider-portability is a day-one requirement; this is the canonical TS-native abstraction layer that achieves it. Switching providers later = config change, not refactor.

**Rejected.** LangChain/LangGraph (too heavy, Python-first DNA, abstractions over Anthropic-native features), raw Anthropic SDK only (fails portability), OpenRouter (latency hop, can't surface provider-specific features), build-our-own (reinvents AI SDK badly).

**Lockstep note.** FrontDesk + Terrascope use Anthropic SDK direct today. Site adopting Vercel AI SDK is intentional divergence — Site sets the new pattern; FrontDesk + Terrascope adopt it when they next touch their AI code. Per cross-product Absolute Rule #2's "if a pattern emerges, port it" escape hatch.

### Decision 2 — Multi-agent orchestration: XState 5

**The call.** Use XState 5 (already in Site's `apps/web/package.json` for the Spirit; now also in `apps/api`) to orchestrate agents. Each agent = a state. Sub-agents = invoked actors / nested states. Handoffs = state transitions.

**Why over LangGraph.** XState is fundamentally the same primitive (a state-machine framework), but without LangChain's weight. Plus visualization in Stately Studio, deterministic routing, replayable, persistable. We get the state machine without the LangChain debt.

**Concretely.** XState now serves both UI behavior (Spirit) and backend conversation orchestration. Updated [[xstate]] tech page captures both roles.

### Decision 3 — Sub-agent pattern: agent-as-tool

**The call.** Sub-agents are agents whose entry point is a tool call from a parent agent. The parent's tool list includes a tool whose `execute` function is itself a chat handler. Recursive — works at arbitrary depth.

**Why.** This is Anthropic's native pattern, mediated through Vercel AI SDK's `maxSteps` tool-execution loop. No special framework needed; the existing infrastructure handles it.

### Decision 4 — Prompt management + tracing + evals: Langfuse self-hosted on Railway

**The call.** Open source [Langfuse](https://langfuse.com), self-hosted on Railway as a sibling service to the Site API. Code-first prompts (TypeScript modules are the source of truth, synced to Langfuse for runtime fetching + UI editing).

**Why self-hosted.** CEO performance-first directive — co-located on Railway = sub-millisecond network for trace ingestion. (Trace ingestion is async-batched anyway, so user-facing latency isn't on the critical path either way — but co-location is the right default.)

**Why Langfuse over alternatives.** Helicone's proxy approach adds 50-200ms per LLM call, which compounds badly for multi-agent flows (5+ LLM calls per turn = 250ms-1s of pure proxy overhead — fails the perf requirement). LangSmith + Braintrust + PromptLayer are SaaS-only. Build-it-ourselves is weeks of work to match Langfuse's table stakes.

**Why code-first prompts.** Diffable, code-reviewable, branchable. UI editing in Langfuse is supported as proposals that sync back via PR.

### Decision 5 — Single Neuvetra-wide user base; auth via FrontDesk reuse — closes [[2026-04-25-auth-billing-strategy]]

**The call.** Reuse FrontDesk's existing Supabase project as the Neuvetra-wide shared user base. Site connects via env vars (M2). Terrascope eventually consolidates onto it too.

**Closes** the open `[[2026-04-25-auth-billing-strategy]]` decision in favor of **Option 2** (single Neuvetra account, shared infrastructure). Original options were per-product, single-account, or shared-identity-separate-billing.

**Implications.**
- One identity per user across all Neuvetra surfaces.
- Schema changes to shared tables (`users`, eventually `conversations`) need cross-product discipline.
- Twilio costs (per-message SMS) billed once at the Neuvetra level.
- Future products inherit auth + identity for free.
- A2P 10DLC campaign already approved at the Twilio account level; no re-registration needed.

**Site M1 has no auth code.** The FrontDesk-reuse path is documented for M2 to proceed against the right Supabase project.

### Decision 6 — Defer `@frontdesk/database` → `@neuvetra/database` rename to standalone cycle

**The call.** The workspace-package rename (Layer 2 of the broader rename question) is a focused FrontDesk-only cycle, not coupled to Site M1. Ship before Site or Terrascope start consuming the package, so we don't propagate the FrontDesk-named import elsewhere. Effort: ~1-2 hours, all in FrontDesk.

**Site M1 doesn't touch the database**, so this rename is invisible to M1.

### Decision 7 — Defer monorepo restructure to separate brainstorm

**The call.** Whether `Neuvetra/` becomes one mega-monorepo (where Site, FrontDesk, Terrascope share `@neuvetra/database`, etc.) or stays as three independent ones is a separate architectural question. Trigger to revisit: the next time a real second shared-package candidate emerges.

### Decision 8 — M1 scope: Option B (scaffolding, no auth, no Supabase)

**The call.** M1 ships the wiring + architecture validation; no feature-bearing work.

**In M1:**
- Vercel AI SDK + `@ai-sdk/anthropic` installed and integrated.
- Langfuse self-hosted on Railway (separate service); Site API instrumented to trace every LLM call.
- Greeter agent as a config object (prompt + model; no tools, no sub-agents).
- One-state XState machine (just the greeter; no transitions yet).
- Generic chat handler.
- Frontend chat UI wired end-to-end.

**Out of M1 (deferred):**
- Streaming responses (M2)
- Auth + Supabase wiring (M2)
- Phone-capture tool + signup (M2)
- Second agent + handoff transitions (M2)
- Conversation persistence beyond browser (M2)
- RAG + Weaviate (M3)
- Sub-agents (M4)
- Voice mode (M4+)

## Action items

- [x] Capture today's architecture in `docs/superpowers/specs/2026-04-26-site-chat-backend-design.md` (design ratified). **Done 2026-04-26.**
- [x] File this meeting note + close `[[2026-04-25-auth-billing-strategy]]` + write new tech pages ([[vercel-ai-sdk]], [[langfuse]]) + write plan page ([[site-chat-backend]]) + update [[stack]] + update navigation. **Done 2026-04-26 (this save).**
- [ ] **Rewrite the stale M1 plan** (`docs/superpowers/plans/2026-04-26-site-chat-backend.md`) against the new design via the `superpowers:writing-plans` skill. Old plan was Anthropic-SDK-direct; new plan reflects Vercel AI SDK + Langfuse + agent abstraction + XState skeleton.
- [ ] **Resume subagent-driven execution** of the new plan. Task 1 of the OLD plan (install `@anthropic-ai/sdk` + env) was DONE before the brainstorm — those changes need re-evaluation against the new plan (the new plan installs `ai` + `@ai-sdk/anthropic` instead, which supersedes the raw `@anthropic-ai/sdk` package).
- [ ] **Pre-deploy gates** before Site M1 reaches public internet: auth, rate limiting, CORS allowlist, cost monitoring, error envelope sanitization. All deferred to M2 or pre-deploy explicitly per the design's pre-deploy checklist.

## Open questions surfaced (not blocking)

- Naming of the Supabase project label (cosmetic). CEO can rename in the dashboard anytime; project ID stays the same.
- Specific A2P opt-in confirmation message text for Site (separate from FrontDesk's). Currently FrontDesk's says *"You're subscribed to Front Desk by Neuvetra transactional alerts"* — Site's may need its own copy when M2 lands the auth UI.
- Cost ceiling per session / per user / per day. Anthropic spend visible in console + Langfuse traces; M2 can add a hard token-budget cap if warranted.

## Files referenced

- **New:** `claude-memory/tech/vercel-ai-sdk.md`, `claude-memory/tech/langfuse.md`, `claude-memory/tech/xstate.md`, `claude-memory/plans/site-chat-backend.md`, this meeting note. Plus design doc at `docs/superpowers/specs/2026-04-26-site-chat-backend-design.md`.
- **Updated:** `claude-memory/decisions/2026-04-25-auth-billing-strategy.md` (status: open → closed). `claude-memory/tech/stack.md` (Vercel AI SDK + Langfuse + XState backend role added; Supabase note updated to reflect shared model). `claude-memory/next.md` (auth-billing-strategy moved from open → closed; Site M1 chat backend marked in-flight). `claude-memory/index.md` (new pages listed). `claude-memory/log.md` (this entry appended).
- **Touched in code (pre-brainstorm):** `Site/apps/api/package.json` (Anthropic SDK installed), `Site/apps/api/.env.example`, `Site/apps/api/src/env.ts`, `Site/.gitignore`. Committed as `0d84a04 chore(api): add Anthropic SDK + typed env access` on `feat/homepage-v1`. **Re-evaluate against new plan** — likely needs to be revised to install `ai` + `@ai-sdk/anthropic` instead of (or in addition to) `@anthropic-ai/sdk` direct.
