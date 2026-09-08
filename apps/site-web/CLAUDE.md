# `apps/site-web` — Site Web (parent landing)

> **Parent:** repo root `CLAUDE.md`. Read that first for monorepo conventions.

Vite + React 19 SPA for Site, the Neuvetra parent landing surface. Live at `https://www.neuvetra.ai`. Hosts the Spirit, the homepage chat input, and the two product entry points (FrontDesk, Terrascope).

## Stack

- **Bundler:** Vite 7
- **UI:** React 19 + React Router v7 + Tailwind v4
- **AI client:** Vercel AI SDK 6 (`ai`) — streaming via `useChat`-style patterns
- **Markdown:** `react-markdown` for rendering chat responses
- **State machines:** XState 5 + `@xstate/react` 6 (frontend orchestrator + Spirit actor)
- **3D:** Three.js 0.184; Spirit is implemented in `src/lib/spirit/`
- **Auth client:** `@supabase/supabase-js`; phone OTP is implemented, with explicit unavailable state when local configuration is missing
- **API client:** plain typed `fetch()` wrapper at `src/lib/api.ts` (Eden was dropped 2026-04-27)

## Commands

```bash
cd apps/site-web
bun run dev           # Vite dev server, port 5174
bun run build         # tsc -b && vite build
bun run preview       # preview production build
bun run typecheck     # tsc -b, including referenced projects
bun run lint          # eslint .
bun run test          # offline unit tests
```

## Layout

```
apps/site-web/
├── src/
│   ├── App.tsx                ← homepage v1: Spirit + wordmark + slogan + product cards + chat input
│   ├── main.tsx, index.css
│   ├── lib/
│   │   ├── api.ts             ← typed fetch() wrapper for /chat (replaces Eden)
│   │   ├── spirit/            ← implemented Spirit renderer and actor
│   │   └── ...
│   ├── components/
│   ├── machines/              ← XState orchestrator + spiritActor (M2 pilot architecture)
│   └── data/
├── public/                    ← static assets, including Spirit audio
├── Dockerfile                 ← multi-stage Bun build → serve on port 8080
├── railway.toml
├── vite.config.ts             ← @/* → src/*; VITE_API_URL baked at build time
└── package.json
```

## Critical context

### Repository-root deployment context

The current Dockerfile requires Railway Root Directory `/` and config-file path `/apps/site-web/railway.toml`, using the root lockfile and shared configuration. The April deployment used an isolated app context; dashboard repointing remains unverified. See [`docs/deployment.md`](../../docs/deployment.md). The existing plain typed [`fetch()` wrapper](src/lib/api.ts) remains the API contract.

### Spirit ownership

Spirit is implemented in both Site and FrontDesk. The existing packaging decision defers extraction to a shared package until another product needs it. Any later extraction needs behavior and visual checks; see [[2026-04-25-spirit-packaging]].

### M2 pilot architecture (ratified)

Two-region UI (chat region + scene region), both XState actors on the frontend, communicating through a frontend orchestrator. Mobile = scene-as-bottom-sheet. Agent tool calls become scenario lifecycle events. Pilot tools `move_spirit({ direction })` and `set_spirit_color({ color })` validated end-to-end 2026-04-27. Full design at `docs/superpowers/specs/2026-04-27-site-chat-backend-m2-design-notes.md`.

**`SHOW_PRODUCT_CARDS` flag** in `App.tsx` is a temporary lever to hide FrontDesk + Terrascope cards during pilot-style testing. M2 will replace it with an agent-driven `consolidate_homepage_cards` scenario.

### `VITE_API_URL` baked at build

`VITE_API_URL=https://api.neuvetra.ai` is baked at build time in production. In dev, leave it blank: the client uses `/api`, and Vite proxies `/api/*` → `http://localhost:3001`. The homepage renders without credentials; real chat and OTP need a configured API/Supabase environment.

### Historical Lighthouse result

The April 27 notes record a mobile score of 100. This cleanup checked layout and console output, not a new Lighthouse score. Keep Three.js initialization deferred so the homepage can paint first.

## Deploy

Railway service `site-web` in the `Neuvetra-AI` project. Multi-stage [`Dockerfile`](Dockerfile) → static SPA served on port 8080. DNS: `www.neuvetra.ai` CNAME → Railway target with Let's Encrypt SSL.

Before deploying this checkout, verify the existing service and set Root Directory `/` with config-file path `/apps/site-web/railway.toml`. No production settings were changed during the foundation cleanup.

## Skills to reach for

- **State machines:** `xstate-v5`, `xstate-react`, `actor-model`
- **3D / Spirit:** `webgpu-threejs-tsl:webgpu-threejs-tsl`, `mcp__plugin_context7_context7__query-docs` for Three.js
- **UI / design:** `frontend-design:frontend-design`
- **Browser debugging:** `chrome-devtools-mcp:chrome-devtools`, `chrome-devtools-mcp:debug-optimize-lcp`, `chrome-devtools-mcp:a11y-debugging`
- **AI SDK:** `mcp__plugin_context7_context7__query-docs` for `ai`, `@ai-sdk/anthropic`
- **Process:** `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`
