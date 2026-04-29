# `apps/terrascope-web` — Terrascope Web (placeholder)

> **Parent:** repo root `CLAUDE.md`. Read that first for monorepo conventions.

Vite + React 19 SPA for Terrascope. **Currently a placeholder** — the largest visible gap in the product. Backend + DB + calculation engine are real and tested; this frontend is "coming soon."

## Stack

- **Bundler:** Vite 7
- **UI:** React 19 + React Router v7 + Tailwind v4
- **Components:** ShadCN + lucide-react + Framer Motion + Sonner
- **Forms:** react-hook-form + Zod
- **State machines:** XState 5 + `@xstate/react` 6
- **API client:** `@elysiajs/eden` consuming `App` type from `apps/terrascope-api`
- **Auth client:** `@supabase/supabase-js`
- **3D:** **NOT installed yet.** When the frontend is built and the Spirit lands here (third consumer triggers Spirit-extraction per [[2026-04-25-spirit-packaging]]), Three.js + the Spirit package join the deps.

## Commands

```bash
cd apps/terrascope-web
bun run dev           # Vite dev server, port 5173
bun run build         # tsc -b && vite build
bun run preview
bun run typecheck     # tsc --noEmit
bun run lint          # eslint .
```

## Critical context

### When this is built out

Per [[claude-memory/products/terrascope.md]]: this frontend is the largest visible gap. When work picks up, the natural cycle:

1. **Auth + onboarding** — reuse FrontDesk's signup/login pattern (Supabase phone OTP), now sharing the same `auth.users` + `public.users` via the Neuvetra-wide Supabase project ([[supabase]]).
2. **Chat surface** — the existing 4-step API pipeline (`apps/terrascope-api/src/chat/`) needs a frontend.
3. **Spirit lands here** — earthy/green preset for Terrascope's brand expression. **This is the Spirit-extraction trigger** per [[2026-04-25-spirit-packaging]]: the third consumer (FrontDesk + Site already use it) means time to lift it into a shared workspace package, e.g., `packages/spirit`.
4. **Reports surface** — the API has `/reports`; the web needs a viewer + filing-export UI for SB 253 / CSRD output.

### Auth model (when wired)

Phone OTP via Supabase, same as FrontDesk and Site. The `users` table is in `public.*` (shared identity). Terrascope-specific tables go in the `terrascope.*` Postgres schema (currently empty).

## Deploy

No Railway service yet. When deployed, follow the Site pattern.

## Skills to reach for

When this frontend is built out:
- **State machines:** `xstate-v5`, `xstate-react`
- **UI / design:** `frontend-design:frontend-design`
- **3D (when Spirit arrives):** `webgpu-threejs-tsl:webgpu-threejs-tsl`, `mcp__plugin_context7_context7__query-docs` for Three.js
- **Browser debugging:** `chrome-devtools-mcp:chrome-devtools`, `chrome-devtools-mcp:debug-optimize-lcp`, `chrome-devtools-mcp:a11y-debugging`
- **Process:** `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`
