---
id: site-chat-backend
type: plan
status: active
created: 2026-04-26
updated: 2026-04-27
related: [site, parent-landing-experience, vercel-ai-sdk, langfuse, xstate, supabase, weaviate, neuvetra-kb, 2026-04-25-auth-billing-strategy, 2026-04-26-site-chat-backend-architecture, 2026-04-26-site-chat-backend-m1-shipped, 2026-04-27-site-deploy-and-dns, multi-product-launch]
mentions: [site, frontdesk, terrascope, neuvetra-kb]
sources: [2026-04-26-site-chat-backend-architecture, 2026-04-27-site-deploy-and-dns]
tags: [plan, ai, multi-agent, chat, backend]
---

# Site Chat Backend

The trajectory for [[site]]'s backend AI surface — wiring the homepage "Ask anything" input to a Claude-backed conversational AI, then evolving it into a multi-agent system with auth, persistence, RAG, and sub-agents. Architecture ratified 2026-04-26 in [[2026-04-26-site-chat-backend-architecture]]; design doc at `docs/superpowers/specs/2026-04-26-site-chat-backend-design.md`.

## Goal

Ship the AI-heavy backend that powers Neuvetra's brand-level salesperson chatbot, designed so per-product chatbots (FrontDesk signup bot, Terrascope intake bot) can plug into the same architecture.

## Architecture (locked)

| Layer | Tool |
|---|---|
| LLM provider abstraction | [[vercel-ai-sdk]] + `@ai-sdk/anthropic` (model: `claude-sonnet-4-6`) |
| Multi-agent orchestration | [[xstate]] 5 (skeleton M1, full M2+) |
| Sub-agent invocation | agent-as-tool, AI-SDK-mediated |
| Prompt management + tracing | [[langfuse]] self-hosted on Railway, code-first prompts |
| Persistence | Shared Neuvetra [[supabase]] project (= FrontDesk's existing project; M2+) |
| Auth | Supabase Auth phone-OTP (FrontDesk reuse; M2+) |
| Retrieval | [[weaviate]] client direct (M3+) |
| Streaming | Vercel AI SDK `streamText` (M2+) |

## Milestones

### M1 — Wiring + scaffolding ✅ shipped 2026-04-26 + ✅ deployed to production 2026-04-27

Vercel AI SDK + Langfuse stand up; greeter agent as a config object; one-state XState skeleton; generic chat handler; UI wired end-to-end. **"Hello → hello back" working with full architecture validated.** No auth, no Supabase code, no second agent, no streaming, no RAG.

**Acceptance verified.** Type "hello" at `https://www.neuvetra.ai` → Claude replies (markdown-rendered). Every LLM call traces in Langfuse. Provider swap = one-line change. Adding a second agent is a config + state addition.

**What shipped (code, 2026-04-26):**
- 11 plan tasks executed via `superpowers:subagent-driven-development`. Six v6/lockstep deviations from the original plan resolved mid-flow (LanguageModelV1 → LanguageModel; `_types.ts` → `types.ts`; loose tools type → ToolSet; Langfuse orphan-safety + PII hardening; maxSteps → stopWhen; usage field renames). Each surfaced by implementer/reviewer with file:line evidence; plan amended each time.
- Plan v2 at `docs/superpowers/plans/2026-04-26-site-chat-backend-v2.md` (post-brainstorm; supersedes the v1 stale plan).
- Langfuse v3 self-hosted on Railway in the new `Neuvetra-AI` project: [https://langfuse-web-production-ea08.up.railway.app](https://langfuse-web-production-ea08.up.railway.app) (v3.170.0).
- Code published to [github.com/neuvetra-hq/site](https://github.com/neuvetra-hq/site). PR #1 squash-merged into `main`. M1-shipped meeting note: [[2026-04-26-site-chat-backend-m1-shipped]].

**What shipped (production, 2026-04-27):** [[2026-04-27-site-deploy-and-dns]]
- Both `site-web` and `site-api` services deployed in `Neuvetra-AI` Railway project. Per-app Root Directory; Docker `COPY . . + bun install` Dockerfiles; Elysia binds to `0.0.0.0:3000`; web served via `serve -s dist -l 8080`.
- Eden type-share dropped — `apps/web` now uses a self-contained typed `fetch()` wrapper (Eden's cross-app type import broke under per-app Root Directory).
- **Langfuse switched from manual SDK to OpenTelemetry-based integration** per the official Langfuse skill. `instrumentation.ts` boots `NodeSDK` with `LangfuseSpanProcessor`; AI SDK opts in via `experimental_telemetry: { isEnabled: true }`. Traces verified end-to-end after a MinIO credential mismatch on the Langfuse server side was fixed.
- DNS: `www.neuvetra.ai` (CNAME → site-web) + `api.neuvetra.ai` (CNAME → site-api) + `_railway-verify` TXTs. Apex `neuvetra.ai` 301-forwards to `https://www.neuvetra.ai` via Squarespace URL Forwarding. Mirrors the `.com` pattern.
- Railway-issued Let's Encrypt SSL on both subdomains.
- 11 commits on `main` from M1 ship through deploy+DNS+OTel-fix completion. HEAD: `b7298b7`.

### M2 — Greeter does its job + handoff

- Streaming responses (`streamText`).
- Phone-capture tool wired to the greeter; signup via Supabase Auth.
- JWT middleware ported from FrontDesk's `apps/api/src/middleware/auth.ts`.
- Conversation persistence in the shared Neuvetra Supabase project.
- Second agent (one product specialist — pick whichever's content lands first in [[neuvetra-kb]]).
- XState handoff transitions: greeter → specialist on signup completion.

**Acceptance:** anonymous user can chat with greeter; greeter prompts for phone; user completes OTP; conversation hands off to specialist; specialist continues with the same conversation history.

### M3 — Retrieval

- Weaviate client wired in `apps/api`.
- Per-agent retrieval scopes (greeter searches brand-level [[neuvetra-kb]] pages; specialists search per-product pages).
- Prompt-injection of retrieved chunks via system message (or via tool, depending on patterns that emerge).

**Acceptance:** specialist agent answers product-specific questions from `neuvetra-kb` content (e.g., "what plans does FrontDesk have" returns plan-page content with source attribution).

### M4 — Sub-agents + voice

- Sub-agent pattern: PDF converter, KB retriever, calculator (per product), each as a tool whose `execute` is itself a chat handler.
- Voice mode: wire the existing voice-mode button (currently visual stub) to actual voice I/O.

**Acceptance:** specialist agent invokes a sub-agent during a turn (e.g., Terrascope specialist calls `convertToPdf` on a draft report). User can speak to the chatbot via voice.

### M5+ — Per-product chatbots

The brand salesperson chatbot's pattern, applied per product:
- FrontDesk's signup chatbot lives in FrontDesk's runtime — same architecture (Vercel AI SDK + agent configs + Langfuse + XState), different agent set + different KB scope.
- Terrascope's intake chatbot lives in Terrascope's runtime — same pattern.

This is also the trigger for FrontDesk + Terrascope to migrate from Anthropic SDK direct to Vercel AI SDK (lockstep — they adopt the new stack when next touching their AI code).

## Pre-deploy hardening checklist

Site M1 is **deployed and reachable on the public internet** at `https://www.neuvetra.ai` as of 2026-04-27, but it's not yet **publicly marketed.** Before the marketing push:

- ❌ **Auth on `/chat`** — M2 ports the FrontDesk middleware; switching it on the chat route is a one-line change.
- ❌ **Rate limiting** — per-IP / per-session budget.
- [x] **CORS allowlist** — tightened 2026-04-27 to localhost dev + neuvetra.com / .ai variants only. Temp Railway-URL origin removed in commit `b7298b7`.
- ❌ **Cost monitoring** — Anthropic console + Langfuse + a hard token-budget cap as defense-in-depth.
- ❌ **Dedicated production `ANTHROPIC_API_KEY`** — currently shares Terrascope's dev key per [[2026-04-27-site-deploy-and-dns]] § Decision 6. Pull a fresh key with usage limits before public push.
- ❌ **Error envelope sanitization** — don't leak SDK internals to visitors.
- ❌ **Prompt-injection awareness** — the public-safe checklist in [[neuvetra-kb]]'s schema is relevant when the chatbot is wired against the KB (M3+).

## Decisions captured (closed by this plan's parent meeting)

- **[[2026-04-25-auth-billing-strategy]] closed** — single Neuvetra-wide user base, shared Supabase + Twilio infrastructure (FrontDesk reuse).
- New tech: [[vercel-ai-sdk]], [[langfuse]].
- Updated tech: [[xstate]] (now serves backend orchestration too).

## Decisions deferred (not coupled to this plan)

- `@frontdesk/database` → `@neuvetra/database` rename — standalone FrontDesk-only cycle.
- Monorepo restructure (one Neuvetra monorepo vs three independent ones) — separate brainstorm.

## Next

- [x] ~~Deploy Site to Railway.~~ Done 2026-04-27 ([[2026-04-27-site-deploy-and-dns]]). Both services in the `Neuvetra-AI` project. DNS swapped via `www` + `api` subdomain pattern.
- ☐ **Plan + execute M2** — streaming (`streamText`) + auth (FrontDesk JWT middleware reuse) + Supabase persistence + second agent + XState handoff transitions. Run `superpowers:brainstorming` → `writing-plans` → `subagent-driven-development` cycle when ready. **Trigger this when CEO is ready** — no immediate technical pressure; Site is live and serving the greeter agent.
- ☐ **Pre-deploy hardening** (above) before public marketing push. Not blocking M2 work; runs in parallel.
