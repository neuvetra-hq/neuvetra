# `apps/site-web` — Site Web (parent landing)

> **Parent:** repo root `CLAUDE.md`. Read that first for monorepo conventions.

Vite + React 19 SPA for Site, the Neuvetra parent landing surface. Live at `https://www.neuvetra.ai`. Hosts the Spirit, the homepage chat input, and the two product entry points (FrontDesk, Terrascope).

## Stack

- **Bundler:** Vite 7
- **UI:** React 19 + React Router v7 + Tailwind v4
- **AI client:** Vercel AI SDK 6 (`ai`) — streaming via `useChat`-style patterns
- **Markdown:** `react-markdown` for rendering chat responses
- **State machines:** XState 5 + `@xstate/react` 6 (frontend orchestrator + Spirit actor)
- **3D:** Three.js 0.184 (Spirit will land here when copied from `apps/frontdesk-web/src/lib/spirit/` per [[2026-04-25-spirit-packaging]])
- **Auth client (planned, M2):** `@supabase/supabase-js`
- **API client:** plain typed `fetch()` wrapper at `src/lib/api.ts` (Eden was dropped 2026-04-27 — see § Per-app Root Directory below)

## Commands

```bash
cd apps/site-web
bun run dev           # Vite dev server, port 5173
bun run build         # tsc -b && vite build
bun run preview       # preview production build
bun run typecheck     # tsc --noEmit
bun run lint          # eslint .
```

## Layout

```
apps/site-web/
├── src/
│   ├── App.tsx                ← homepage v1: Spirit + wordmark + slogan + product cards + chat input
│   ├── main.tsx, index.css
│   ├── lib/
│   │   ├── api.ts             ← typed fetch() wrapper for /chat (replaces Eden)
│   │   ├── spirit/            ← (will land here in Cycle 2 — copied from FrontDesk)
│   │   └── ...
│   ├── components/
│   ├── machines/              ← XState orchestrator + spiritActor (M2 pilot architecture)
│   └── data/
├── public/                    ← static assets (will include audio/ when Spirit copies)
├── Dockerfile                 ← multi-stage Bun build → serve on port 8080
├── railway.toml
├── vite.config.ts             ← @/* → src/*; VITE_API_URL baked at build time
└── package.json
```

## Critical context

### Per-app Root Directory on Railway → no Eden

Railway uses per-app Root Directory; this app's build context is `apps/site-web`, isolated from `apps/site-api`. The original Eden type-bridge (`@elysiajs/eden` consuming `App` type from the API) couldn't resolve at build time. **Replaced with a plain typed `fetch()` wrapper at [`src/lib/api.ts`](src/lib/api.ts).** See [[2026-04-27-site-deploy-and-dns]] § Decision 3.

### Spirit not yet here

The Spirit (`src/lib/spirit/`, `data/spirit-presets.ts`, `public/audio/`) is currently in `apps/frontdesk-web`. Cycle 2 of [[parent-landing-experience]] copies it here. In a monorepo this is a one-line workspace move when Terrascope's frontend lights up and triggers extraction to `packages/spirit` per [[2026-04-25-spirit-packaging]].

### M2 pilot architecture (ratified)

Two-region UI (chat region + scene region), both XState actors on the frontend, communicating through a frontend orchestrator. Mobile = scene-as-bottom-sheet. Agent tool calls become scenario lifecycle events. Pilot tools `move_spirit({ direction })` and `set_spirit_color({ color })` validated end-to-end 2026-04-27. Full design at `docs/superpowers/specs/2026-04-27-site-chat-backend-m2-design-notes.md`.

**`SHOW_PRODUCT_CARDS` flag** in `App.tsx` is a temporary lever to hide FrontDesk + Terrascope cards during pilot-style testing. M2 will replace it with an agent-driven `consolidate_homepage_cards` scenario.

### `VITE_API_URL` baked at build

`VITE_API_URL=https://api.neuvetra.ai` is baked at build time in production. In dev, Vite's proxy rule sends `/api/*` → `http://localhost:3000`.

### Lighthouse mobile = 100 on the homepage

Maintained 2026-04-27. Don't break it. Heavy work (Three.js init, OTel boot) is deferred or skipped on the homepage.

## Deploy

Railway service `site-web` in the `Neuvetra-AI` project. Multi-stage [`Dockerfile`](Dockerfile) → static SPA served on port 8080. DNS: `www.neuvetra.ai` CNAME → Railway target with Let's Encrypt SSL.

Pending Railway re-point: when this monorepo replaces the old `neuvetra-hq/site` repo, the Root Directory is `apps/site-web`.

## Skills to reach for

- **State machines:** `xstate-v5`, `xstate-react`, `actor-model`
- **3D / Spirit (when it lands):** `webgpu-threejs-tsl:webgpu-threejs-tsl`, `mcp__plugin_context7_context7__query-docs` for Three.js
- **UI / design:** `frontend-design:frontend-design`
- **Browser debugging:** `chrome-devtools-mcp:chrome-devtools`, `chrome-devtools-mcp:debug-optimize-lcp`, `chrome-devtools-mcp:a11y-debugging`
- **AI SDK:** `mcp__plugin_context7_context7__query-docs` for `ai`, `@ai-sdk/anthropic`
- **Process:** `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`
