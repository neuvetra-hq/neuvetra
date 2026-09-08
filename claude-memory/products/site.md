---
id: site
type: product
title: "Site — Neuvetra parent landing surface"
aliases: ["site", "neuvetra site", "parent landing", "neuvetra.com site", "neuvetra.ai"]
status: active
created: 2026-04-25
updated: 2026-09-08
related: [parent-landing-experience, spirit, frontdesk, terrascope, 2026-04-25-parent-landing-site, 2026-04-25-spirit-as-brand-icon, 2026-04-25-spirit-packaging, 2026-04-25-wiki-architecture-policy, 2026-04-27-site-deploy-and-dns, 2026-04-28-consolidate-into-single-monorepo, multi-product-launch, stack, site-chat-backend, langfuse, vercel-ai-sdk]
mentions: [frontdesk, terrascope, spirit]
discussed_in: [2026-04-25-site-scaffold, 2026-04-27-site-deploy-and-dns, 2026-09-08-neuvetra-ghg-focus]
sources: [2026-04-25-site-scaffold-conv, 2026-04-27-site-deploy-and-dns-conv]
tags: [product, brand, infra, landing]
---

# Site — Neuvetra parent landing surface

> **September 8:** the website is being refocused entirely on the Neuvetra GHG application, replacing the two-product marketing surface described below. First milestone: a truthful research preview and source discovery, followed by evidence-backed answers and deterministic calculations after review. See [[2026-09-08-neuvetra-ghg-focus]]. Existing production remains on the older Site repository until a deliberate cutover.

## Positioning

`Site` is the parent landing surface for `neuvetra.com` and `neuvetra.ai` — the codebase that hosts the Spirit (`[[spirit]]`) and the two product entry points (`[[frontdesk]]`, `[[terrascope]]`). It's the first impression for both products and the visual anchor of the Neuvetra brand. Greenlit by `[[2026-04-25-parent-landing-site]]`; full feature spec lives at `[[parent-landing-experience]]`.

Site is **independent** of the products it advertises — it has its own codebase, its own deployment, its own surface. The two products remain at their own subdomains/sub-routes (post-domain-re-routing). Site is what binds them to a single brand.

## Status

**LIVE in production at `https://www.neuvetra.ai`** as of 2026-04-27 ([[2026-04-27-site-deploy-and-dns]]). Deployed to Railway in the `Neuvetra-AI` project alongside Langfuse.

**Codebase home (as of 2026-04-28):** `apps/site-api/` + `apps/site-web/` in the unified Neuvetra monorepo at `github.com/neuvetra-hq/neuvetra` ([[2026-04-28-consolidate-into-single-monorepo]]). Was at `github.com/neuvetra-hq/site` HEAD `b7298b7` until the consolidation; the old repo remains for archival reference until Railway is repointed at the new monorepo.

**What's live:**
- **`https://www.neuvetra.ai`** — Homepage v1 (Spirit + wordmark + slogan + product cards + chat input). Railway-issued Let's Encrypt SSL.
- **`https://api.neuvetra.ai/chat`** — Site chat backend M1. Vercel AI SDK + Langfuse (OpenTelemetry-based) + XState skeleton + greeter agent. POST a message → Claude responds → trace lands in Langfuse within seconds.
- **`https://neuvetra.ai`** (apex) — 301 forwards to `https://www.neuvetra.ai` via Squarespace URL Forwarding.
- Lighthouse mobile = 100 on the homepage.

**Domain pattern (mirrors `neuvetra.com`):**
- `www.neuvetra.ai` → CNAME → site-web Railway target. Canonical site URL.
- `api.neuvetra.ai` → CNAME → site-api Railway target. Backend chat API.
- `neuvetra.ai` (apex) → Squarespace URL Forwarding → 301 → `https://www.neuvetra.ai`. Canonical redirect.
- **No apex CNAME** — Squarespace doesn't reliably support it. See [[2026-04-27-site-deploy-and-dns]] § Decision 5.
- **Apex SSL caveat:** Squarespace's URL Forwarding doesn't provision SSL on the apex. `https://neuvetra.ai` (bare apex over HTTPS) shows a cert warning. `http://neuvetra.ai` 301s correctly. Acceptable since `www` is canonical; remediation if needed is migrate DNS to Cloudflare (Squarespace stays as registrar).

**Domain split locked:**
- `neuvetra.ai` → Site (live).
- `neuvetra.com` → FrontDesk (unchanged, indefinitely). The Site-replaces-FrontDesk-on-`neuvetra.com` swap originally planned in [[parent-landing-experience]] Q8 is **deferred indefinitely** ([[2026-04-26-site-chat-backend-m1-shipped]] § Decision 2).

Spec: `docs\superpowers\specs\2026-04-25-neuvetra-site-scaffold-design.md` (initial scaffold). Chat backend design: `docs\superpowers\specs\2026-04-26-site-chat-backend-design.md`. Plan: [[site-chat-backend]].

## Tech

Standard Neuvetra stack per `[[stack]]` — Bun + Turborepo + Vite + React 19 + React Router v7 + Tailwind v4. Plus deps installed for next-cycle Spirit work: Three.js 0.184, XState 5 + @xstate/react 6.

| Layer | Technology | Notes |
|---|---|---|
| Runtime + package manager | **Bun 1.2+** | `bun add` / `bunx` only — no `npm` / `pnpm` / `npx` anywhere |
| Monorepo | Turborepo 2 | `apps/web` + `apps/api`. No `packages/` yet — added when shared code earns it. |
| API framework | Elysia (latest) | Port 3000. Listen on `0.0.0.0` (Railway proxy reachability). CORS allow-list: localhost dev + neuvetra.com / .ai variants. Routes: `/health`, `/chat`. |
| API client (web → api) | Plain typed `fetch()` wrapper at `apps/web/src/lib/api.ts` | Eden was dropped 2026-04-27 because per-app Root Directory means `apps/web` has no access to `apps/api`'s App type at build time. See [[2026-04-27-site-deploy-and-dns]] § Decision 3. |
| AI tracing | OpenTelemetry-based Langfuse integration | `instrumentation.ts` boots `NodeSDK` + `LangfuseSpanProcessor`; AI SDK opts in via `experimental_telemetry: { isEnabled: true }`. See [[langfuse]]. |
| Frontend | Vite 7 + React 19 + React Router v7 + Tailwind v4 | Port 5173 dev / 8080 production (Docker). `@/*` → `src/*` alias. `VITE_API_URL` baked at build time (`https://api.neuvetra.ai` in production). |
| Visual runtime (next cycle) | Three.js 0.184 | Powers the Spirit; deps installed, no usage yet |
| State machines (next cycle) | XState 5 + @xstate/react 6 | For the Spirit behavior machine; deps installed, no usage yet |
| Type checking | TypeScript ~5.9 | Strict; project references in web app (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`) |
| Linting | ESLint 9 (flat config) | `@eslint/js` + `typescript-eslint` + `react-hooks` + `react-refresh` |
| Deploy | Railway, **`Neuvetra-AI` project** | Both `site-api` and `site-web` services live. **Per-app Root Directory** (`apps/api` / `apps/web`) — each app is its own Docker build context (the staged-COPY pattern hit a BuildKit edge case; both Dockerfiles now use simple `COPY . . + bun install`). `railway.toml` + `Dockerfile` for both apps committed in-repo. |

### Layout in the monorepo

As of 2026-04-28, all products are flattened siblings under `apps/`. There's no per-product folder containing a `code/` subdirectory anymore. Site lives at `apps/site-api/` and `apps/site-web/`; FrontDesk at `apps/frontdesk-{api,web}/`; Terrascope at `apps/terrascope-{api,web}/`. The three knowledge stores (`claude-memory/`, `neuvetra-kb/`, `ghg-kb/`) sit at root.

## Open strategic questions

These are deferred from `[[parent-landing-experience]]` and remain blockers for getting Site's content (not its scaffold) to launchable state:

1. **Q3** — Spirit zone on the page (full-bleed vs scoped behind product cards).
2. **Q4** — Spirit reactivity event wiring (hover, chat-open, mic-active, idle).
3. **Q5** — Per-product hover presets: `frontdeskHover`, `terrascopeHover`.
4. **Q6** — Real-product chatbot vs lightweight explainer scope per product.
5. **Q7** — Voice on the parent for Terrascope (its real product is text-only today).
6. **Q8** — Domain re-routing plan (FrontDesk → subdomain when Site takes `neuvetra.com`).
7. **Q9** — Mobile / low-end device performance fallback for the Spirit.
8. **Q10** — Accessibility (reduced-motion, screen reader behavior, keyboard nav).

## Where the operational state lives

- **Build / deploy state, dev commands, conventions:** root `CLAUDE.md` (rewritten in the 2026-04-28 cycle) and per-app CLAUDE.md files in `apps/site-{api,web}/` if they exist.
- **Scaffold spec + plan:** `docs/superpowers/specs/2026-04-25-neuvetra-site-scaffold-design.md` and `docs/superpowers/plans/2026-04-25-neuvetra-site-scaffold.md`.
- **Memory / strategy:** this wiki (`claude-memory/`).

## Next

- [x] ~~Push `Site\` to GitHub.~~ Done 2026-04-26.
- [x] ~~Wire Railway services (api + web) to the new repo.~~ Done 2026-04-27. Both services live in `Neuvetra-AI` project.
- [x] ~~`neuvetra.ai` DNS swap.~~ Done 2026-04-27. `www.neuvetra.ai` + `api.neuvetra.ai` via CNAME; apex 301-forwards.
- ☐ **M2 of [[site-chat-backend]]** — streaming + auth (FrontDesk JWT middleware reuse) + Supabase persistence + second agent + XState handoff transitions.
- ☐ **Cycle 2:** copy Spirit (`lib/spirit/*`, `data/spirit-presets.ts`, `public/audio/*`) from FrontDesk per `[[2026-04-25-spirit-packaging]]`.
- ☐ **Cycle 3:** parent-landing real content — headline, two product entry-point cards, `frontdeskHover` + `terrascopeHover` presets, ambient Spirit on the parent page.
- ☐ **Cycle 4:** explainer chatbot per product (text + voice). Adds voice infra on the web. Closes Q6 + Q7.
- ☐ **Cycle 5:** ~~domain re-routing~~ — **closed differently.** `neuvetra.ai` is Site's home (live); `neuvetra.com` stays FrontDesk indefinitely. Q8 from [[parent-landing-experience]] is resolved.
- ☐ **Cycle 6:** mobile / reduced-motion / accessibility pass for Spirit. Closes Q9 + Q10.
- ☐ **Pre-deploy hardening before public marketing push:** auth gate on `/chat`, rate limiting, dedicated production `ANTHROPIC_API_KEY` (currently shares Terrascope's dev key), error envelope sanitization. See [[site-chat-backend]] § Pre-deploy checklist.
- ☐ **Apex SSL** (low priority): if `https://neuvetra.ai` cert warning becomes a real user issue, migrate DNS to Cloudflare (Squarespace stays as registrar). Otherwise live with it; `www` is canonical.
