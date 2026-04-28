---
id: langfuse
type: tech
status: active
created: 2026-04-26
updated: 2026-04-27
related: [stack, vercel-ai-sdk, anthropic, site-chat-backend, 2026-04-26-site-chat-backend-architecture, 2026-04-27-site-deploy-and-dns]
discussed_in: [2026-04-26-site-chat-backend-architecture, 2026-04-27-site-deploy-and-dns]
tags: [tech, ai, observability, prompts, evals, otel]
---

# Langfuse

Open source LLM-engineering platform. Self-hosted on Railway, alongside the Site API. The "AI training backend" the CEO described — *"We need to make sure that we save the prompts; we can log the prompts; we can work with the prompts."*

## What it does for us

Six capabilities, all on day one:

1. **Prompt versioning.** Prompts stored by `name + version`, fetched at runtime by version. Update a prompt without redeploying code; roll back when a new version regresses.
2. **Tracing.** Every LLM call captured: full input/output, model, latency, cost, tool calls, sub-agent calls. Multi-agent threading — parent agent's trace contains sub-agent spans as children. Exactly the shape needed for our agent + sub-agent architecture.
3. **Datasets.** Curate real production traces into test sets. Promote interesting interactions to "this is what good looks like" or "this is the regression we just fixed."
4. **Evals.** Run a prompt version against a dataset; score outputs (LLM-as-judge, custom metrics, human review). Compare versions side-by-side.
5. **Playground.** Tune prompts interactively in the Langfuse UI without writing code or deploying. CEO can iterate without calling for a release.
6. **Cost tracking.** Per-prompt, per-agent, per-user $ spend. Catches a regression where one agent suddenly burns 10× tokens.

## Where it lives
- **Self-hosted on Railway** in the `Neuvetra-AI` project, a sibling project of `Neuvetra` (which hosts FrontDesk). Postgres-backed.
- Architecture (Langfuse v3 default): four sibling services in the project — `langfuse-web`, `langfuse-worker`, `clickhouse` (analytics store for traces/observations), `redis` (queue), `minio` (S3-compatible blob store for ingestion events + media). Plus a managed Postgres.
- Env vars (`LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`) on the consumer side — Site's `apps/api`, FrontDesk + Terrascope when they migrate.
- **Integration: OpenTelemetry-based** (see "Code integration" below). The legacy manual `langfuse` SDK approach was abandoned 2026-04-27 per the official Langfuse skill ([[2026-04-27-site-deploy-and-dns]] § Decision 4).

## Why self-hosted (not SaaS)

CEO performance-first directive — co-located on Railway = sub-millisecond network for trace ingestion. Trace ingestion is async/batched anyway, so user-facing latency isn't on the critical path either way, but co-location is the right default for our perf-first product.

Other reasons self-hosted wins:
- **No vendor risk.** Open source under MIT. Can fork or migrate if the project changes direction.
- **Data control.** Every LLM call's full input + output stays on our infra.
- **Cost.** ~$10-30/month on Railway (the service + Postgres) vs Langfuse SaaS pricing per-trace at scale.
- **SaaS escape hatch.** If self-hosting becomes a maintenance burden, switch to Langfuse Cloud — same SDK, just a different `LANGFUSE_HOST`.

## Code integration — OpenTelemetry, not manual SDK

Per the official `langfuse` skill (`github.com/langfuse/skills`), the recommended Vercel AI SDK integration is OTel-based, not manual. Site's `apps/api` follows this pattern; FrontDesk + Terrascope adopt it lockstep when they migrate from Anthropic SDK direct.

**Wiring:**
1. `npm` deps: `@langfuse/tracing` + `@langfuse/otel` + `@opentelemetry/sdk-node`. (Drop `langfuse` if it's there.)
2. Create `apps/api/src/instrumentation.ts` — boots `NodeSDK` with `LangfuseSpanProcessor` configured (publicKey, secretKey, baseUrl, environment).
3. Import `instrumentation.ts` FIRST at the top of the entrypoint (`index.ts`), before any code that emits spans (the AI SDK).
4. Pass `experimental_telemetry: { isEnabled: true, functionId: 'chat:<agentId>', metadata: { agentId } }` to `generateText` (and `streamText`, `generateObject`).
5. The `LangfuseSpanProcessor`'s smart default filter recognizes `ai`-scoped spans (from the Vercel AI SDK) and ships them. No manual `client.trace()` / `generation.end()` / `flushAsync()` plumbing needed.

**Why OTel over manual SDK:**
- Skill explicitly flags manual instrumentation as a "common mistake" — more code, less context, harder to maintain.
- OTel path captures more out-of-the-box (token usage, model, latency, parent/child span hierarchy for sub-agents, tool calls).
- Future-friendly: any other OTel-emitting code (HTTP client traces, DB query traces, custom spans) is automatically captured by the same pipeline.

## Code-first prompt strategy

Prompts as TypeScript modules in version control are the source of truth:

```typescript
// Site/apps/api/src/agents/greeter.ts
export const greeterPrompt = {
  key: "greeter",
  version: 1,
  text: `You are Neuvetra's AI assistant on the homepage. ...`,
}
```

A sync step on deploy pushes them to Langfuse so the runtime can fetch by `name + version`. The Langfuse UI can edit prompts (CEO iterates without a deploy); edits flow back to code via PR. Source of truth: code. UI edits are proposals.

**Why code-first:**
- Diffable, code-reviewable, branchable (works with the standard PR flow).
- Survives Langfuse going down — the prompts are in git; the Langfuse fetch is a runtime concern.
- Onboarding-friendly — a new engineer reads the agent file and sees the prompt; no out-of-band tooling to learn first.

## Alternatives considered (rejected)

| Tool | Why we said no |
|---|---|
| **Helicone (self-hosted, proxy-based)** | Every LLM call routes through the proxy, adding 50-200ms per call. Multi-agent flows with 5+ LLM calls per turn = 250ms-1s of pure overhead. Fails the perf requirement. Tracing is also shallower (no native concept of "this is a sub-agent of this parent"). |
| **LangSmith** | LangChain's offering. SaaS-only, vendor-locked, LangChain-flavored workflows. We've already rejected LangChain for the LLM-call layer. |
| **Braintrust** | Excellent product, strong evals, polished UX. SaaS-only, paid. Goes against self-hosted preference. Worth knowing about; might revisit if Langfuse self-hosted ever becomes painful. |
| **PromptLayer** | Prompt-registry-focused, weaker on the full observability story. SaaS-only. Less rich than Langfuse for our needs. |
| **Phoenix (Arize)** | Strong on evals, comes from an ML observability company. More focused on debugging than prompt management. Worth keeping in mind. |
| **Build it ourselves on Supabase** | Weeks of work to match Langfuse's table stakes (traces UI, prompt diff views, eval runners, multi-agent thread visualization). YAGNI for a tool that exists. Right answer if we'd ruled out external tools for compliance reasons; wrong answer for "let's just start." |

## Status
- Decision locked 2026-04-26 in [[2026-04-26-site-chat-backend-architecture]] § Decision 4.
- **Deployed 2026-04-26** at [https://langfuse-web-production-ea08.up.railway.app](https://langfuse-web-production-ea08.up.railway.app) (Langfuse v3.170.0).
- Hosted in a **separate Railway project named `Neuvetra-AI`** (not consolidated into the existing `Neuvetra` project that hosts FrontDesk's `web` + `api` services). CEO's call; cleaner separation of "production product surface" vs "AI/observability infrastructure." See [[2026-04-26-site-chat-backend-m1-shipped]] § Decision 1.
- Org `Neuvetra` + project `site-chat` provisioned in the Langfuse UI.
- **Tracing verified end-to-end 2026-04-27** ([[2026-04-27-site-deploy-and-dns]]) — Site's deployed `apps/api` produces spans on every chat call, traces appear in the Langfuse UI within seconds. Switched to **OTel-based integration** in commit `96d7803`.

## Deploy notes (Railway template gotchas)
Three glitches hit + resolved during the initial deploy + first-trace verification, recorded for future reference and for FrontDesk + Terrascope when they consume the same instance:

- **Redis pull failure (2026-04-26).** Template pinned `bitnami/redis:7.2.5` via Railway's Auto-Updates feature; Bitnami had pruned that patch. Fixed by disabling Auto-Updates on the Redis service so it uses the rolling `bitnami/redis:7.2` tag.
- **Worker `NEXTAUTH_URL` validation (2026-04-26).** Worker crashed at boot with `ZodError: Invalid URL` because `NEXTAUTH_URL` wasn't auto-populated on the worker after the web service's public domain was generated. Fixed by manually setting `NEXTAUTH_URL` on the worker to match the web's public URL.
- **MinIO credential mismatch (2026-04-27).** `LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID` and `LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY` on `langfuse-web` + `langfuse-worker` didn't match MinIO's actual `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`. Symptom: chat completions worked, but Langfuse rejected ingestion with `Failed to upload JSON to S3 — InvalidAccessKeyId`. The Railway template was supposed to wire these via service-reference variables (`${{minio.MINIO_ROOT_USER}}`); the wire didn't take. Fixed by manually aligning credentials. Surfaced via diagnostic span-processor logging on the consumer side ([[2026-04-27-site-deploy-and-dns]] § Topic 2).

All three are typical-flaky-first-deploy template issues; the template recovers cleanly with these manual interventions.

## Next
- ☐ Author the first Langfuse-fetched prompt version (`greeter@v1`) — currently the greeter prompt is a TS constant that's NOT yet synced to Langfuse for fetch-by-version. M2 work; design's "code-first prompts" decision says code is source of truth, sync-on-deploy is an additional layer.
- ☐ FrontDesk + Terrascope consume the same Langfuse instance as their AI work matures (cross-product lockstep — they migrate from Anthropic SDK direct to Vercel AI SDK + the OTel-based Langfuse integration when next touching their AI code; do NOT use the legacy manual SDK).
- ☐ Pre-deploy hardening for [[site-chat-backend]] before Site is publicly marketed: PII masking on traces (Langfuse supports `mask` callback in `LangfuseSpanProcessor` config), trace-level user_id / session_id when auth lands in M2, cost dashboard tags (`feature: 'chat'`, `agent: 'greeter'`, etc.).
