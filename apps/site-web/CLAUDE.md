# `apps/site-web` — Neuvetra GHG research preview

> **Parent:** repo root `CLAUDE.md`. Read that first for monorepo conventions.

Vite + React 19 SPA for Neuvetra's California/U.S. greenhouse-gas research and accounting direction. The current `App.tsx` mounts only `ResearchPreview`: an overview of the planned workflow and a searchable, filterable primary-source browser. Neuvetra is the sole customer-facing brand; FrontDesk is deferred and TerraScope is retired as a brand. Historical workspace names remain for traceability.

This checkout is a local research preview, not the current production website. The signed-in Railway assessment confirms that production still uses the old Site repository. No cutover has occurred. See the [deployment guide](../../docs/deployment.md) for the verified assignments and remaining work.

## Current behavior

- Overview/Sources navigation, topic/publisher search, category filters, an empty-result reset, and four original publisher links from GHG Protocol, EPA, and CARB.
- Explicit preview status: source-backed Q&A and deterministic calculations are in development. The source browser contains publisher entry points, not approved calculation-factor data.
- Optional decorative Spirit, loaded separately on desktop. Motion can be paused; small screens and reduced-motion preferences use the static illustration. The preview does not unlock audio.
- No mounted chat, authentication, OTP, billing, uploads, or calculation flow. The preview needs no API or credentials. Retained chat/auth source files and tests are not evidence that these features are active.

Keep this distinction clear when editing copy or features. Do not reconnect the historical salesperson/greeter to answer GHG questions from the old brand KB. Future answers and calculations need the reviewed evidence and deterministic contracts described in the [product architecture](../../docs/research/product-architecture.md).

## Stack

- **Bundler:** Vite 7; `@/*` aliases `src/*`.
- **UI:** React 19 + React Router v7 + Tailwind v4; Jost typography.
- **3D:** Three.js 0.184; decorative renderer in `src/lib/spirit/`, dynamically imported by `ResearchSpirit`.
- **Retained historical dependencies:** Vercel AI SDK 6, `react-markdown`, XState 5, `@xstate/react` 6, and `@supabase/supabase-js` support the older chat/auth implementation. They are not mounted by the current homepage.

## Commands

```bash
cd apps/site-web
bun run dev           # Vite dev server, port 5174; no API needed for preview
bun run build         # tsc -b && vite build
bun run preview       # preview production build locally
bun run typecheck     # tsc -b, including referenced projects
bun run lint          # eslint .
bun run test          # offline unit tests, including retained chat/auth behavior
```

Use Bun **1.3.12**. From the repository root, `bun run dev` starts only this frontend. `bun run dev:site` additionally starts the retained Site API and requires that API's development configuration.

## Layout

```text
apps/site-web/
├── src/
│   ├── App.tsx                         ← mounts ResearchPreview only
│   ├── main.tsx, index.css             ← app entry and research-preview styles
│   ├── components/
│   │   ├── ResearchPreview.tsx         ← overview and source browser
│   │   ├── ResearchSpirit.tsx          ← optional decorative renderer lifecycle
│   │   └── ...                        ← retained historical chat/auth components
│   ├── data/research-sources.ts        ← publisher references and search/filter logic
│   ├── lib/
│   │   ├── spirit/                    ← existing renderer and behavior machinery
│   │   └── ...                        ← retained API/auth helpers
│   ├── actors/                        ← historical chat/scene actors and tests
│   ├── hooks/                         ← retained Spirit/chat hooks
│   └── scenes/                        ← historical OTP scene and tests
├── public/                            ← static assets, including retained Spirit audio
├── index.html                         ← Neuvetra GHG title and metadata
├── Dockerfile                         ← repository-root Bun build, static SPA on 8080
├── railway.toml
├── vite.config.ts
└── package.json
```

## Deployment and environment

The current Dockerfile requires Railway Root Directory `/` and config-file path `/apps/site-web/railway.toml`, using the root lockfile and shared configuration. This is the prepared monorepo build contract, not the active production assignment. The verified `Neuvetra-AI` / `Site-Web` service still deploys the old `neuvetra-hq/site` repository to `https://www.neuvetra.ai`. Reconfirm that recorded state at cutover and follow [docs/deployment.md](../../docs/deployment.md); no production change is implied by a local build.

`VITE_API_URL` and Supabase browser configuration remain relevant to the retained API/auth clients. The development proxy still maps `/api/*` to the local Site API on port 3001. The research preview does not invoke these clients, and changing those variables does not enable Q&A or sign-in. Never place server credentials in browser variables.

## Historical chat and M2 notes

The April homepage combined Spirit, multi-product cards, a greeter chat, identity display, and phone OTP. That composition is preserved in the GitHub tag `checkpoint/pre-ghg-focus-2026-09-08` (`367497e`). Related components, hooks, actors, helpers, and tests remain in this tree for reference; the current `App.tsx` does not import them. There is no active `SHOW_PRODUCT_CARDS` switch.

The historical M2 design used chat and scene regions, XState orchestration, and tool-driven Spirit actions such as `move_spirit` and `set_spirit_color`. Those plans do not describe the current research preview. See the [M2 design notes](../../docs/superpowers/specs/2026-04-27-site-chat-backend-m2-design-notes.md) if reviewing the old implementation.

The retained typed `fetch()` wrapper at `src/lib/api.ts` is the old chat API contract, not the future GHG answer contract. Historical knowledge-base content, model responses, and readiness claims require verification before reuse.

## Spirit ownership and visual checks

Spirit implementations remain in both Site and FrontDesk. The prior packaging decision deferred extraction into a shared package; this preview reuses Site's renderer directly. Any extraction needs behavior and visual checks.

Keep initialization deferred and preserve static/reduced-motion behavior. The optional Three.js chunk still produces a build-size warning. Historical notes record an April Lighthouse score; that is not a current performance measurement.

## Skills to reach for

- **UI / design:** relevant frontend-design skills when available.
- **3D / Spirit:** Three.js documentation and applicable rendering skills.
- **Browser review:** accessible navigation, keyboard use, mobile layout, and motion preferences.
- **Historical state-machine or AI work:** applicable XState or AI SDK skills only when that work is explicitly in scope.

Use the session's actual skill/tool catalog; the historical skill names in older notes do not establish present availability.
