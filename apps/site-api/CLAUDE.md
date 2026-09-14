# `apps/site-api` — isolated research pilot and retained chat backend

> **Parent:** repo root `CLAUDE.md`. Read that first for monorepo conventions.

The current opt-in passage experiment uses `src/research-passages-server.ts` and `bun run start:research-passages`. Read its [scope, source pins and evaluation instructions](../../docs/milestones/m2-passage-retrieval.md) and [independent QA](../../docs/research/scope2-passages-qa.md). It has a separate reviewed release, semantic passage selection, drafting and fresh-context verification. It retains the same loopback port; do not run both research entry points together. Carry remaining model-stage allowances across restarts. The earlier fixed-statement pilot below and its evidence remain historical, separately runnable artifacts.

The earlier `src/research-server.ts` is a separate local-only entry point for the fixed-statement Scope 2 pilot. It imports no inherited greeter, authentication, database or telemetry startup. Run `bun run start:research` with the [explicit research configuration](../../docs/milestones/m2-answer-demo.md); it binds only `127.0.0.1:3012`, uses origin 5174, defaults to provider-disabled, and validates independently reviewed evidence and source pins. Do not introduce watch-mode restarts around the in-memory model budget or expose this unauthenticated demo publicly.

The historical Bun + Elysia `/chat` backend below remains separate. Its earlier deployment is at `https://api.neuvetra.ai`; these notes do not imply the new research service is deployed there. Vercel AI SDK, Langfuse and XState descriptions below apply to the retained backend.

## Stack

- **Runtime:** Bun 1.3.12; local example port 3001, container default 3000 (binds to `0.0.0.0` for Railway proxy reachability)
- **Framework:** Elysia + `@elysiajs/cors`
- **AI:** Vercel AI SDK 6 (`ai`) + `@ai-sdk/anthropic` (Claude `claude-sonnet-4-6`)
- **Direct Anthropic SDK:** `@anthropic-ai/sdk` (carried alongside AI SDK)
- **Tracing:** Langfuse via OpenTelemetry — `@langfuse/tracing` + `@langfuse/otel` + `@opentelemetry/sdk-node`
- **Auth:** optional Supabase JWT context on chat, sharing the Neuvetra-wide auth backbone
- **State machines:** XState 5 (multi-agent orchestration)

## Commands

```bash
cd apps/site-api
bun run dev            # watch mode; PORT=3001 in the local environment example
bun run typecheck      # tsc --noEmit
bun run test           # offline unit tests
bun run sync-kb        # sync KB corpus (script in scripts/sync-kb-corpus.ts)
```

## Layout

```
apps/site-api/
├── src/
│   ├── index.ts              ← Elysia entry. Imports instrumentation FIRST.
│   ├── instrumentation.ts    ← Boots NodeSDK + LangfuseSpanProcessor BEFORE app
│   ├── env.ts                ← typed Bun.env
│   ├── routes/
│   │   └── chat.ts           ← createChatRoutes(deps) factory — testable
│   ├── chat-handler.ts       ← AI SDK generateText with experimental_telemetry
│   ├── lib/
│   │   ├── rate-limit.ts     ← in-memory token bucket, per-IP
│   │   ├── origin-check.ts   ← strict server-side Origin allowlist
│   │   └── ...
│   ├── config/
│   │   └── allowed-origins.ts ← single source of truth (used by CORS + origin-check)
│   ├── agents/               ← agent definitions (greeter today; specialists in M2)
│   ├── tools/                ← Vercel AI SDK tools — move_spirit, set_spirit_color (M2 pilot)
│   └── tests/
├── scripts/sync-kb-corpus.ts
├── HARDENING.md              ← operator checklist BEFORE public marketing push
├── Dockerfile
├── railway.toml
└── package.json
```

## Critical context

### Langfuse OTel (the "common mistake")

Langfuse instrumentation is **OpenTelemetry-based**, not the manual `langfuse@3.x` SDK. The official Langfuse skill explicitly flags the manual SDK as a "common mistake" for Vercel AI SDK projects. `instrumentation.ts` boots `NodeSDK` with `LangfuseSpanProcessor`; AI SDK opts in via `experimental_telemetry: { isEnabled: true, functionId: 'chat:<agentId>', metadata: { agentId } }`. **`instrumentation.ts` must be imported FIRST in `index.ts`** so OTel spans are captured from boot. See [[2026-04-27-site-deploy-and-dns]] § Decision 4.

### Hardening (already done; checklist for operator actions)

The `/chat` route has three hardening layers, all shipped 2026-04-27 ([[next.md]] hardening pass):

1. **Origin allowlist** (`lib/origin-check.ts`) — runs FIRST so junk doesn't burn IP rate-limit budget
2. **IP rate limit** (`lib/rate-limit.ts`) — in-memory token bucket, 10k bucket cap with oldest-first eviction; configurable via `CHAT_RATE_LIMIT_MAX` + `CHAT_RATE_LIMIT_WINDOW_MS` (defaults: 10/min)
3. **Error sanitization** — `try/catch` returns `{ error: <sanitized> }` with 500; upstream Anthropic error details never reach the browser

**Operator actions remain in [`HARDENING.md`](HARDENING.md)** — must be done BEFORE public marketing push: dedicated production `ANTHROPIC_API_KEY` (currently shares Terrascope dev key), Anthropic workspace spend cap, Langfuse Triggers.

### Single environment

The legacy marketing service has no separately verified staging deployment. The new private research preview has an isolated development scope in the existing Supabase/Pinecone resources and an explicit loopback server entry point at `src/research-composed-server.ts`; see [its runbook](../../docs/research/website-composed-runtime.md). It is not part of the production startup or the legacy `/chat` endpoint. `Bun.env.NODE_ENV ?? "development"` keys the legacy Langfuse environment tag. See [[stack]] § Environments for historical context.

### Repository-root deployment context

The current Dockerfile requires Railway Root Directory `/` and config-file path `/apps/site-api/railway.toml`, with a frozen install from the root lockfile. The April isolated-app deployment instructions are historical; dashboard repointing remains unverified. See [`docs/deployment.md`](../../docs/deployment.md) for the current build and runtime contract.

### Testing

Tests are colocated under `src/lib/` and `src/routes/`. Coverage includes chat with mocked dependencies, rate limiting, origin checks and the public KB export gate. AI SDK 6 quirk caught during M2 pilot: `result.toolCalls` is **last-step-only** when tools have an `execute` function. Aggregate via `result.steps.flatMap(s => s.toolCalls)` instead. See [[2026-04-27-site-deploy-and-dns]] § Bug.

## Deploy

Railway service `site-api` in the `Neuvetra-AI` project (alongside Langfuse). [`Dockerfile`](Dockerfile) + [`railway.toml`](railway.toml). DNS: `api.neuvetra.ai` CNAME → Railway target with Let's Encrypt SSL.

Before deploying this checkout, verify the existing service and set Root Directory `/` with config-file path `/apps/site-api/railway.toml`. No production settings were changed during the foundation cleanup.

## Skills to reach for

- **Anthropic / Claude API:** `claude-api`
- **AI SDK / state machines:** `xstate-v5`, `actor-model`, `mcp__plugin_context7_context7__query-docs` (resolve `ai`, `@ai-sdk/anthropic`, `@langfuse/tracing`, `@langfuse/otel`)
- **Process:** `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`
- **Live docs:** `mcp__plugin_context7_context7__query-docs` for Elysia, Bun
