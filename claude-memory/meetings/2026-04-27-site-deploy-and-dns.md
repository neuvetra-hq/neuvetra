---
id: 2026-04-27-site-deploy-and-dns
type: meeting
title: "Site deployed to Railway + neuvetra.ai DNS swap + Langfuse OTel migration"
date: 2026-04-27
status: active
created: 2026-04-27
updated: 2026-04-27
hats: [cto, cpo]
related: [site, langfuse, vercel-ai-sdk, site-chat-backend, parent-landing-experience, 2026-04-26-site-chat-backend-architecture, 2026-04-26-site-chat-backend-m1-shipped, frontdesk]
mentions: [site, langfuse, vercel-ai-sdk]
sources: [2026-04-27-site-deploy-and-dns-conv]
tags: [deploy, dns, railway, langfuse, otel, site, milestone]
---

# Site deployed to Railway + neuvetra.ai DNS swap + Langfuse OTel migration

The day Site went from "code in GitHub" to "production live at `https://www.neuvetra.ai`." This session ran the full deploy → DNS → tracing-fix sequence end-to-end. M1 of [[site-chat-backend]] is now reachable on the public internet on the brand domain.

## Outcome

- **`https://www.neuvetra.ai`** — Site homepage live (Spirit + wordmark + slogan + product cards + chat input). Railway-issued Let's Encrypt SSL.
- **`https://api.neuvetra.ai/chat`** — Chat backend live. POST a message → Claude responds. Every call traced in self-hosted Langfuse.
- **`https://neuvetra.ai`** (apex) — 301 forwards to `https://www.neuvetra.ai` via Squarespace URL Forwarding.
- **Both services** in the Railway `Neuvetra-AI` project alongside Langfuse + ClickHouse + MinIO + Redis.
- **All commits on `main`** of [github.com/neuvetra-hq/site](https://github.com/neuvetra-hq/site) — HEAD `b7298b7`.

## Topics covered

### 1. Railway deployment of `site-web` + `site-api`

Both services added to the `Neuvetra-AI` Railway project (joining Langfuse). Per-app Docker build, with Railway's "Root Directory" set to `apps/api` and `apps/web` respectively — meaning each app is its own build context, not the monorepo root.

**Six deploy issues hit + resolved**, each pushed as its own commit:

1. **BuildKit COPY edge case** (commit `5e47954`) — original Dockerfiles staged copies (`COPY package.json bun.lock ./`, then `COPY apps/api/package.json`, then `COPY apps/api/`) to optimize layer caching. Last step failed with `failed to compute cache key: "/apps/api": not found` — Railway's BuildKit choking on the directory copy after `bun install`. Simplified to `COPY . .` (no caching benefit, but reliable).

2. **`WORKDIR /app/apps/api` mismatch** (commit `697bacc`) — once Root Directory was `apps/api`, the Docker context was the app folder itself, not the monorepo. The `WORKDIR /app/apps/api` line tried to `cd` into a non-existent subdirectory; runtime crashed with `Module not found "src/index.ts"`. Removed the WORKDIR line so the app runs from `/app` directly.

3. **`apps/web` Eden type-import broke** (commit `8c0db84`) — `apps/web/src/lib/api.ts` imported the API's `App` type via the `@api` path alias (resolving to `../api/src/index.ts`). With per-app Root Directory, `apps/api` isn't in the web build context — TS errored with *"Cannot find module '@api'"* and *"Property 'chat' does not exist on type 'Please install Elysia before using Eden'"* (Eden's stub message when the App type doesn't resolve). **Fix:** replaced Eden client with a plain typed fetch wrapper (`postChat()` returning `{ message: string }`); dropped `@elysiajs/eden` and `elysia` from web's deps; removed the `@api` alias from `vite.config.ts` and `tsconfig.app.json`. Trade-off: lost compile-time type sharing between web and api for the `/chat` endpoint — for one endpoint with two trivial types it's hand-syncable; if endpoints multiply, revisit by publishing a shared types package.

4. **App bound to `localhost:8080` instead of `0.0.0.0:3000`** (commit `ba94b4a`) — Bun.serve's default hostname inside the Railway container was `localhost`, which only accepts container-local connections. Railway's proxy runs outside that namespace. Plus `Bun.env.PORT` was being auto-set by Railway to `8080` while the public domain target port was `3000`. **Fix:** explicitly bind to `0.0.0.0`; CEO added `PORT=3000` to Variables to make app port match the public domain target.

5. **Wrong `ANTHROPIC_API_KEY`** — placeholder key in env vars caused `/chat` to 500 with `invalid x-api-key`. CEO reused the dev key from `Terrascope/code/apps/api/.env` for now (production-grade key TBD).

6. **CORS rejection of Railway URL** (commit `009e823`, later cleaned in `b7298b7`) — `apps/api/src/index.ts` CORS allow-list had `neuvetra.com` / `neuvetra.ai` / localhost but not the temp `site-web-production-b810.up.railway.app` origin. Added it temporarily; removed once DNS swap completed.

### 2. Langfuse OpenTelemetry migration

Initially the manual `langfuse@3.x` SDK was wired (per the M1 spec) — `client.trace()` + `generation.end()` + `flushAsync()` wrapped around the Vercel AI SDK call. After deploy, **chat worked but no traces appeared in Langfuse**. CEO directive: *"Install the Langfuse AI skill from github.com/langfuse/skills and use it to add tracing to this application following best practices."*

The official Langfuse skill (`skills/langfuse/SKILL.md` + `references/instrumentation.md`) flagged the manual approach as a "common mistake" and prescribed the OpenTelemetry-based integration. Migrated:

- Removed `langfuse` SDK + manual `traceChat()` wrapper.
- Added `@langfuse/tracing`, `@langfuse/otel`, `@opentelemetry/sdk-node`.
- Created `apps/api/src/instrumentation.ts` — boots `NodeSDK` with `LangfuseSpanProcessor`. Imported FIRST at the top of `index.ts`.
- `chat-handler.ts` now passes `experimental_telemetry: { isEnabled: true, functionId: 'chat:<agentId>', metadata: { agentId } }` to `generateText`. The AI SDK auto-emits OTel spans; LangfuseSpanProcessor's smart default filter recognizes `ai`-scoped spans and ships them.
- Deleted `lib/langfuse.ts` + its test.

Commit: `96d7803`.

**But traces still didn't appear.** Added diagnostic logging to `instrumentation.ts`: a `DebugSpanProcessor` logging every `onStart`/`onEnd`, plus an override of `LangfuseSpanProcessor.shouldExportSpan` logging every span the filter sees. Result:

- AI SDK ✅ emits OTel spans (`ai.generateText`, `ai.generateText.doGenerate`).
- DebugSpanProcessor ✅ receives them.
- LangfuseSpanProcessor ✅ accepts them (`shouldExportSpan` fires + returns true).
- OTLP exporter ✅ POSTs to Langfuse.
- **Langfuse server ❌ rejects with `Failed to upload JSON to S3 — InvalidAccessKeyId`.**

Langfuse v3 stores ingestion blobs in S3-compatible storage. Self-hosted on Railway, that's MinIO. The Langfuse Railway template was supposed to wire `LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID` / `..._SECRET_ACCESS_KEY` to MinIO's `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` via service-reference variables — the wire didn't take during initial deploy, so Langfuse was sending S3 calls with credentials MinIO didn't recognize. CEO aligned the env vars across `langfuse-web` + `langfuse-worker` to match MinIO's actual creds. Traces flowed within seconds.

Diagnostics removed; `instrumentation.ts` reverted to its minimal production form (commit `9abf329`).

### 3. DNS swap to `neuvetra.ai`

Original plan: `neuvetra.ai` (apex) → CNAME → site-web's Railway target. **Squarespace doesn't reliably support CNAME at apex** — even after deleting the existing Vercel A/CNAME records, the apex CNAME save kept failing with *"Custom record not saved."*

CEO recalled that `neuvetra.com` works the same way (CNAME at apex isn't actually used) — the live `.com` setup uses `www` + `api` subdomain CNAMEs only, with apex handled separately. **Mirroring the `.com` pattern for `.ai`:**

| Type | Name | Value | Purpose |
|---|---|---|---|
| CNAME | `www` | site-web Railway target | apex of the user-facing site |
| CNAME | `api` | site-api Railway target | brand-level chat backend |
| TXT | `_railway-verify` | `railway-verify=…` | Railway domain ownership proof |

Apex `neuvetra.ai` → 301 forward to `https://www.neuvetra.ai` via **Squarespace's URL Forwarding** feature (Domains → Website → Domain Forwarding, permanent 301, maintain paths).

Once Railway verified the TXT records, it auto-issued Let's Encrypt certs for both subdomains. Smoke-tested both URLs end-to-end.

Caveat: **Squarespace URL Forwarding doesn't provision SSL on the apex.** `https://neuvetra.ai` (bare apex over HTTPS) shows a cert warning; `http://neuvetra.ai` 301s correctly to `https://www.neuvetra.ai`. Modern browsers default to HTTPS-first, so users typing `neuvetra.ai` may hit the warning. Acceptable for now — `www.neuvetra.ai` is the canonical URL; if this becomes a paper-cut, fix is to migrate DNS to Cloudflare (free, supports CNAME flattening + apex SSL via proxy) without changing registrar.

### 4. Final cleanup

- `VITE_API_URL` on `site-web` updated to `https://api.neuvetra.ai` → triggered rebuild → bundled JS now POSTs to the brand domain.
- Temporary `site-web-production-b810.up.railway.app` origin dropped from CORS allow-list (commit `b7298b7`).
- All work pushed to `main`. No open branches. No PRs in flight.

## Decisions (fold-ins per Policy C)

Same-day operational calls captured here rather than as standalone `decisions/` pages.

### Decision 1 — Site deploys into `Neuvetra-AI` Railway project (alongside Langfuse, separate from `Neuvetra`)

`Neuvetra` project hosts FrontDesk's web + api. `Neuvetra-AI` was created 2026-04-26 for Langfuse self-host (per [[2026-04-26-site-chat-backend-m1-shipped]] § Decision 1). `site-web` + `site-api` joined the AI project — co-located with Langfuse, kept separate from FrontDesk's production surface. Cleaner mental model: *"production product (FrontDesk) vs AI/observability infra (Langfuse + Site backend)."* Cross-project networking unnecessary since Site doesn't yet talk to FrontDesk's Supabase.

**How to apply:** When future AI-heavy services land, default to `Neuvetra-AI` unless they have a hard dependency on a service in `Neuvetra`. M2's Supabase persistence will revisit this — Supabase lives in `Neuvetra` (FrontDesk reuse), so cross-project networking will become a real consideration.

### Decision 2 — Per-app Root Directory on Railway (each app is its own build context)

`site-api` Root Directory = `apps/api`; `site-web` Root Directory = `apps/web`. Docker builds happen against the app folder, not the monorepo root.

**Why:** Cleaner mental model, faster build context upload to Railway, easier debugging. Forced the consequence in Decision 3.

**How to apply:** This is the deploy pattern for any Bun + Turborepo monorepo on Railway. Mirror in FrontDesk + Terrascope deploys (FrontDesk already does this — it's why `apps/api` and `apps/web` work independently there).

### Decision 3 — `apps/web` deploys self-contained; no cross-app type imports

Eden's `treaty<App>()` was elegant for local dev (single workspace, both apps in scope) but broke at Railway build time when `apps/api` wasn't in `apps/web`'s build context. Replaced with a plain typed fetch wrapper. `@elysiajs/eden` + `elysia` removed from web deps. The `@api` path alias is gone from `vite.config.ts` and `tsconfig.app.json`.

**Why:** Production deploys must not depend on cross-app build-time references. The trade-off (lost compile-time type sharing for `/chat`) is acceptable — two trivial types, easy to keep in sync by hand.

**How to apply:** If web ever needs richer typed access to api endpoints, publish a shared `@neuvetra/site-types` package (or move back to a unified Root Directory). For one endpoint, the manual approach is fine.

### Decision 4 — Langfuse instrumentation: OpenTelemetry-based, not manual SDK

Per the official `langfuse` skill (`github.com/langfuse/skills`), the recommended integration for Vercel AI SDK is the OTel-based one: `LangfuseSpanProcessor` registered via `@opentelemetry/sdk-node` at startup, AI SDK calls opt in via `experimental_telemetry: { isEnabled: true }`. The smart default filter recognizes `ai`-scoped spans and ships them to Langfuse.

**Why:** The skill explicitly flags manual instrumentation as a "common mistake" — more code, less context, harder to maintain. The OTel path also works for any future non-AI-SDK code that emits OTel spans (e.g., HTTP client traces, DB query traces).

**How to apply:**
- Lockstep across products: when FrontDesk + Terrascope migrate from Anthropic SDK direct to Vercel AI SDK (M5+ of [[site-chat-backend]]), they adopt the same OTel-based Langfuse pattern. No manual SDK anywhere new.
- The `instrumentation.ts` file is the canonical pattern for the `Neuvetra-AI` project's services.

### Decision 5 — DNS pattern for `neuvetra.ai`: www + api subdomains, no apex CNAME

Mirrors `neuvetra.com`. Squarespace stays as the registrar + DNS host. Apex (`neuvetra.ai`) handled by Squarespace's URL Forwarding (301 → `https://www.neuvetra.ai`).

**Why:** Squarespace doesn't reliably support apex CNAME (the only way to point apex at Railway's CNAME-only target). The `www` + `api` pattern works, mirrors `.com`, and keeps DNS management consistent across both brand domains.

**How to apply:**
- New brand domains follow the same pattern.
- If apex-over-HTTPS becomes a real user-experience issue, the fix is **migrate DNS to Cloudflare** (Squarespace stays as registrar; Cloudflare runs DNS with CNAME flattening + apex SSL via proxy). Don't move just the registrar.

### Decision 6 — `claude-sonnet-4-6` `ANTHROPIC_API_KEY` shared with Terrascope dev environment for now

Production Site uses the same Anthropic API key as Terrascope's dev `.env`. Production-grade key + cost separation deferred.

**Why:** Speed-of-delivery for M1; production-grade key creation is friction that doesn't gate verification.

**How to apply:** Pre-deploy hardening (per [[site-chat-backend]] pre-deploy checklist) includes provisioning a dedicated production Anthropic key with usage limits before public exposure. Not blocking M2 work but flagged in the deploy-readiness pile.

## Action items

- [x] Site deployed to Railway (both services) → done.
- [x] Langfuse OTel migration + S3 credential fix → traces flowing.
- [x] DNS swap → `https://www.neuvetra.ai` live.
- [x] CORS cleanup → temp Railway origin removed.
- [x] Memory updated for next session → this note.
- [ ] **M2 of [[site-chat-backend]]** — streaming + Supabase persistence + auth (FrontDesk JWT middleware reuse) + second agent + XState handoff. CEO decides when to brainstorm.
- [ ] Reconcile `claude-memory/products/frontdesk.md` — CEO mentioned in passing that `neuvetra.com`'s `www` CNAME points at `vercel-dns-017.com`, suggesting FrontDesk may be on Vercel rather than (or in addition to) Railway. Verify on next FrontDesk-focused session and update.
- [ ] **Pre-deploy hardening** before Site is publicly marketed (auth gate, rate limiting, cost monitoring, dedicated Anthropic key, error envelope sanitization). Not blocking but required before public push.
- [ ] **Pull a fresh production-grade `ANTHROPIC_API_KEY`** with usage limits — replace the dev-shared one.

## Files referenced

- `Site/apps/api/src/instrumentation.ts` (created — OTel + LangfuseSpanProcessor boot)
- `Site/apps/api/src/lib/chat-handler.ts` (rewritten — `experimental_telemetry` instead of manual trace wrapper)
- `Site/apps/api/src/lib/langfuse.ts` (deleted)
- `Site/apps/api/src/lib/langfuse.test.ts` (deleted)
- `Site/apps/api/src/lib/chat-handler.test.ts` (updated)
- `Site/apps/api/src/index.ts` (CORS, listen on 0.0.0.0, instrumentation import-first)
- `Site/apps/api/Dockerfile` (simplified `COPY . .`)
- `Site/apps/web/Dockerfile` (simplified `COPY . .`)
- `Site/apps/web/src/lib/api.ts` (rewritten — `postChat()` typed fetch wrapper)
- `Site/apps/web/src/hooks/useChat.ts` (updated for new api.ts)
- `Site/apps/web/vite.config.ts` (dropped `@api` alias)
- `Site/apps/web/tsconfig.app.json` (dropped `@api` alias)
- `Site/apps/web/package.json` (dropped `@elysiajs/eden`, `elysia`)
- `Site/apps/api/package.json` (added OTel + Langfuse OTel packages, removed legacy `langfuse`)

## Commits (in order)

```
ffeed84 Homepage v1 + Site chat backend M1 (M1 shipped)
5e47954 fix(deploy): simplify Dockerfiles to avoid BuildKit COPY edge case
697bacc fix(deploy): adjust Dockerfile WORKDIRs for per-app Root Directory
8c0db84 fix(web): replace Eden/@api type-import with self-contained fetch wrapper
ba94b4a fix(api): bind to 0.0.0.0 so Railway proxy can reach the container
009e823 fix(api): allow Railway-hosted site-web origin in CORS
96d7803 refactor(api): migrate Langfuse to OpenTelemetry integration
5f07850 debug(api): add diagnostic logging to OTel instrumentation
3b92d24 debug(api): wrap LangfuseSpanProcessor + force periodic flush
9abf329 chore(api): clean up Langfuse OTel diagnostics
b7298b7 chore(api): drop temporary Railway-URL entry from CORS allow-list
```

## Open questions / for next session

- M2 brainstorm trigger — when CEO is ready to think through streaming, auth wiring (FrontDesk middleware port), Supabase persistence schema, second-agent definition, and XState handoff transitions.
- The FrontDesk-on-Vercel-vs-Railway reconciliation noted in Action items.
- Apex SSL: revisit only if it becomes a real user issue. Cloudflare migration is the path.
