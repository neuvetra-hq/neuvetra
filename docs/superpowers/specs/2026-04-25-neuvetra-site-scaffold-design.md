# Neuvetra Site — Parent Landing Scaffold Design

**Date:** 2026-04-25
**Status:** Approved design — ready for implementation planning
**Scope:** Stand up the empty codebase that will host the parent landing surface at `neuvetra.com` / `neuvetra.ai`.

> **Wiki anchor:** [`wiki/features/parent-landing-experience.md`](../../../wiki/features/parent-landing-experience.md). This scaffold closes Open Q1 (directory name) and Open Q2 (Spirit packaging).

---

## North Star

A new sibling codebase at `Neuvetra/Site/` that mirrors FrontDesk's tech stack but ships **empty** — bones only, no functionality, no Spirit, no app-fsm route, no copied UI. Stand it up so it builds, runs locally, and is Railway-deployable. Subsequent cycles add real content (headline, product entry-point cards, Spirit, explainer chatbots) on top of this base.

---

## Decisions Locked In This Cycle

| # | Question | Call | Status |
|---|---|---|---|
| 1 | Codebase directory name | `Site/` (capital S, sibling of `FrontDesk/` and `Terrascope/`) | Closed |
| 2 | `code/` subdirectory | Drop it. `Site/` IS the code root. No knowledge-base sibling planned, so the level is dead weight. | Closed |
| 3 | Spirit code packaging | **Copy** when added (next cycle). Defer extract-to-shared-package until a 3rd consumer (Terrascope frontend) lights up. | Closed |
| 4 | Monorepo shape | Full Turborepo (`apps/web` + `apps/api`). No `packages/` until shared code earns it. | Closed |
| 5 | API scope | Empty Elysia shell — `/health` only, CORS configured, deployable. **No FrontDesk routes copied.** | Closed |
| 6 | Frontend scope | Empty Vite + React + Tailwind app — placeholder element only. **No Spirit, no app-fsm route, no UI deps beyond core stack.** | Closed |
| 7 | Package manager / runtime | **Bun for everything.** `bun add`/`bun remove` for installs, `bunx` for one-off tool runs. No `npm`/`pnpm`/`npx`. | Closed |
| 8 | Railway plumbing | Carry `railway.toml` + `Dockerfile` from FrontDesk (both web and api), strip workspace refs that don't exist yet (`packages/database`, `packages/config`) and Supabase/Stripe build args. | Closed |

---

## Out of Scope (Next Cycles)

The following are explicitly **not** part of this scaffold. Each gets its own design + plan cycle later:

- **Spirit copy** — `lib/spirit/*` (7 files) + `data/spirit-presets.ts` + `public/audio/*` (6 files) from FrontDesk. Adds Three.js usage and the XState behavior machine.
- **app-fsm route copy** — `pages/app-fsm/*` (4 files) + `machines/{appFsmMachine,spiritActor,loadAssetsActor,initializerMachine,probeActor}.ts`. The `authActor.ts` is dropped (Supabase-coupled).
- **Parent-landing real content** — headline ("AI tools for businesses"), two product entry-point cards (FrontDesk, Terrascope), `frontdeskHover` and `terrascopeHover` Spirit presets.
- **Explainer chat surfaces** — text + voice chatbot UIs per product, Anthropic SDK wiring on the API, system prompts.
- **Domain re-routing** — `neuvetra.com` and `neuvetra.ai` move from FrontDesk to Site. FrontDesk migrates to a subdomain.
- **Reduced-motion / mobile fallback** for the Spirit.
- **Auth + billing.** Still gated on the open [`wiki/decisions/2026-04-25-auth-billing-strategy.md`](../../../wiki/decisions/2026-04-25-auth-billing-strategy.md) decision.
- **Shared Spirit package extraction.** Triggered when Terrascope frontend becomes the third consumer.

---

## Directory Layout

```
Neuvetra/
└── Site/                                  ← new sibling, code root (no nested code/)
    ├── package.json                       ← root: workspaces + turbo scripts
    ├── turbo.json                         ← turbo pipeline (dev/build/typecheck/lint)
    ├── bun.lock                           ← generated
    ├── tsconfig.base.json                 ← shared TS config (extended by apps)
    ├── .gitignore                         ← node_modules, dist, .env, .turbo
    ├── README.md                          ← "Neuvetra parent landing — scaffold"
    ├── CLAUDE.md                          ← Site code-specific operating schema
    │
    └── apps/
        ├── web/
        │   ├── package.json
        │   ├── vite.config.ts             ← @vitejs/plugin-react + @tailwindcss/vite
        │   ├── tsconfig.json
        │   ├── tsconfig.node.json
        │   ├── eslint.config.js
        │   ├── index.html
        │   ├── railway.toml
        │   ├── Dockerfile
        │   ├── public/                    ← empty
        │   └── src/
        │       ├── main.tsx               ← BrowserRouter + StrictMode
        │       ├── App.tsx                ← single placeholder element
        │       ├── index.css              ← Tailwind v4 entry
        │       └── vite-env.d.ts
        │
        └── api/
            ├── package.json
            ├── tsconfig.json
            ├── railway.toml
            ├── Dockerfile
            └── src/
                └── index.ts               ← Elysia + cors + /health, exports App type
```

**Deviation from FrontDesk/Terrascope:** Site has no `code/` subdirectory **and no `wiki/` subdirectory**. Reasons:

- **No `code/` level** — FrontDesk and Terrascope each pair `code/` with a sibling. Site has none, so the level is empty nesting.
- **No `wiki/` level (by policy, 2026-04-25)** — memory / conversation wikis only live at the Neuvetra root (`Neuvetra/wiki/`). The single C-level wiki captures discussions across every level — brand, plans, products, decisions, conversations — for FrontDesk, Terrascope, Site, and the parent brand alike. The only exception is the Terrascope GHG KB (`Terrascope/ghg-kb/`), which serves a different purpose (domain-file ingestion → graph DB → product chatbot RAG), not conversation memory. The existing `FrontDesk/wiki/` placeholder is redundant under this policy and should be reviewed in a future cleanup.

Both deviations are documented in [`Site/CLAUDE.md`](../../../Site/CLAUDE.md) and rolled up into the root [`CLAUDE.md`](../../../CLAUDE.md) hierarchy diagram during the wiki write-back.

---

## Dependencies

### Root `package.json`

```json
{
  "name": "neuvetra-site",
  "private": true,
  "packageManager": "bun@1.2.0",
  "workspaces": ["apps/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "turbo": "^2.1.0",
    "typescript": "^5.0.0"
  }
}
```

### `apps/web/package.json` deps

**Runtime:**
- `react@^19.2.0`, `react-dom@^19.2.0`
- `react-router@^7.0.0`
- `three@0.184.0`
- `xstate@^5.30.0`, `@xstate/react@^6.1.0`
- `@elysiajs/eden@latest`
- `elysia@latest` (peer for Eden type imports)

**Dev:**
- `vite@^7.3.1`, `@vitejs/plugin-react@^5.1.1`
- `tailwindcss@^4.0.0`, `@tailwindcss/vite@^4.0.0`
- `typescript@~5.9.3`
- `@types/react@^19.2.7`, `@types/react-dom@^19.2.3`, `@types/three@^0.184.0`, `@types/node@^25.3.5`
- `eslint@^9.39.1`, `@eslint/js@^9.39.1`, `eslint-plugin-react-hooks@^7.0.1`, `eslint-plugin-react-refresh@^0.4.24`, `typescript-eslint@^8.48.0`, `globals@^16.5.0`

**Explicitly NOT carried** (FrontDesk has these — we don't yet): shadcn, all `@radix-ui/*`, `@base-ui-components/react`, `framer-motion`, `sonner`, `lucide-react`, `cmdk`, `vaul`, `embla-carousel-react`, `react-hook-form`, `zod`, `@hookform/resolvers`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `next-themes`, `recharts`, `react-day-picker`, `react-resizable-panels`, `input-otp`, all `@supabase/*`, all `@stripe/*`, `@twilio/voice-sdk`, all fonts (`@fontsource-variable/*`), `webgpu-threejs-tsl`, `@webgpu/types`, `@playwright/test`, `date-fns`. Add when the feature that needs them lands.

### `apps/api/package.json` deps

**Runtime:**
- `elysia@latest`
- `@elysiajs/cors@^1.4.1`

**Dev:**
- `bun-types@latest`

**Explicitly NOT carried:** `@supabase/supabase-js`, `drizzle-orm`, `drizzle-kit`, `stripe`, `twilio`, `retell-sdk`, `node-fetch`, `tsdav`. Add when the feature that needs them lands.

### Scripts

**`apps/web/package.json` scripts** (mirror FrontDesk):
```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit",
  "lint": "eslint ."
}
```

**`apps/api/package.json` scripts:**
```json
{
  "dev": "bun run --watch src/index.ts",
  "typecheck": "tsc --noEmit"
}
```

---

## Key File Contents

### `apps/api/src/index.ts`

```ts
import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"

const app = new Elysia()
  .use(cors({
    origin: [
      "http://localhost:5173",
      "https://neuvetra.com",
      "https://www.neuvetra.com",
      "https://neuvetra.ai",
      "https://www.neuvetra.ai",
    ],
    credentials: true,
  }))
  .get("/health", () => ({ status: "ok" }))
  .listen(Bun.env.PORT ?? 3000)

export type App = typeof app

console.log(`API running at ${app.server?.hostname}:${app.server?.port}`)
```

### `apps/web/src/App.tsx`

```tsx
export function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0c0d] text-white/60">
      <p className="text-sm uppercase tracking-widest">Neuvetra</p>
    </div>
  )
}
```

### `apps/web/src/main.tsx`

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"
import "./index.css"
import { App } from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

### `apps/web/src/index.css`

```css
@import "tailwindcss";
```

### `apps/web/vite.config.ts`

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "lint": {}
  }
}
```

### Boilerplate config files (mirror FrontDesk's structure)

The following files are mechanical and mirror their counterparts in [`FrontDesk/code/`](../../../FrontDesk/code/):

- `apps/web/index.html` — standard Vite entry pointing to `/src/main.tsx`, with `<div id="root"></div>`.
- `apps/web/eslint.config.js` — flat-config eslint setup for React + TS.
- `apps/web/tsconfig.json` + `apps/web/tsconfig.node.json` — Vite-recommended TS project references with `@/*` path alias matching `vite.config.ts`.
- `apps/api/tsconfig.json` — Bun-recommended TS config.
- `tsconfig.base.json` — shared `compilerOptions` extended by both apps.
- `.gitignore` — `node_modules`, `dist`, `.env`, `.env.local`, `.turbo`, `.DS_Store`.

The implementation plan will produce these by copying the FrontDesk versions and stripping any FrontDesk-specific paths.

---

## Railway / Dockerfile Adaptations

### `apps/api/railway.toml` — copy verbatim from FrontDesk

```toml
[build]
builder = "nixpacks"
installCommand = "bun install"

[deploy]
startCommand = "bun run src/index.ts"
```

### `apps/api/Dockerfile` — adapted from FrontDesk

```dockerfile
FROM oven/bun:1.3.12
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/

RUN bun install

COPY apps/api/ ./apps/api/

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

Diff from FrontDesk: drops `COPY packages/database/package.json`, `COPY packages/config/`, `COPY packages/`. We have no `packages/` yet.

### `apps/web/railway.toml` — copy verbatim from FrontDesk

```toml
[build]
dockerfilePath = "apps/web/Dockerfile"
```

### `apps/web/Dockerfile` — adapted from FrontDesk

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/

RUN bun install

COPY apps/web/ ./apps/web/

RUN cd apps/web && bun run build

FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=builder /app/apps/web/dist ./dist
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
```

Diff from FrontDesk: drops Supabase build args (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`); keeps `VITE_API_URL` since the web app will eventually hit the API; drops `packages/database/package.json` and `packages/` COPY lines.

---

## Site CLAUDE.md

A slim mirror of [`FrontDesk/code/CLAUDE.md`](../../../FrontDesk/code/CLAUDE.md). Key additions:

- Parent context: `..\CLAUDE.md` (Neuvetra business root) and `..\wiki\` (C-level wiki).
- **Hierarchy deviation:** `Site/` has no `code/` subdirectory — code lives at the Site root. Reason: no knowledge-base sibling planned.
- **Bun-only rule.** No `npm`, `pnpm`, or `npx` anywhere.
- Workspace structure: `apps/web` (Vite SPA on 5173) + `apps/api` (Elysia on 3000).
- Dev commands: `bun run dev` (all apps via turbo), `bun run build`, `bun run typecheck`, `bun run lint`.
- Eden type bridge: `export type App = typeof app` from `apps/api/src/index.ts`, consumed by `apps/web` via `@elysiajs/eden`.
- Stack-version pinning rationale: keep in lockstep with FrontDesk and Terrascope per cross-product Absolute Rule #2.

---

## Verification — How We Know This Works

The scaffold is "done" when **all** of these pass:

1. `bun install` at `Site/` root completes without errors.
2. `bun run dev` boots both apps via turbo.
3. `apps/api` listens on `localhost:3000`. `curl localhost:3000/health` returns `{"status":"ok"}`.
4. `apps/web` serves on `localhost:5173`. Page loads showing "NEUVETRA" placeholder.
5. `bun run typecheck` passes both apps.
6. `bun run build` succeeds for `apps/web` and produces `apps/web/dist/`. (`apps/api` has no build step — Bun runs TS directly. Turbo skips api since it has no `build` script.)
7. `bun run lint` passes (web app only; api has no lint script in scaffold).
8. `apps/api/Dockerfile` and `apps/web/Dockerfile` build cleanly with `docker build` (verification optional — not required if Docker isn't installed locally; Railway will exercise them on first deploy).

---

## Wiki Write-Backs (Post-Scaffold)

Done as a separate "save" pass after the scaffold lands, following the standard wiki-first protocol per [`wiki/CLAUDE.md`](../../../wiki/CLAUDE.md):

1. **New page** `wiki/products/site.md` — strategic view of the Site codebase.
2. **Update** [`wiki/features/parent-landing-experience.md`](../../../wiki/features/parent-landing-experience.md):
   - Open Q1 → closed: directory is `Site/`.
   - Open Q2 → resolved: copy-when-added; defer extraction to 3rd consumer.
   - Add note about dropped `code/` deviation.
3. **Update** [`wiki/log.md`](../../../wiki/log.md) with an `ingest` entry.
4. **Update** [`wiki/next.md`](../../../wiki/next.md) — Site scaffold complete; next moves are Spirit copy + parent-landing content.
5. **Resolve open observation** in [`wiki/meetings/2026-04-25-domain-deployment-state.md`](../../../wiki/meetings/2026-04-25-domain-deployment-state.md) — Railway configs ARE committed in-repo (confirmed today via [`FrontDesk/code/apps/api/railway.toml`](../../../FrontDesk/code/apps/api/railway.toml) + Dockerfile and the matching web pair).
6. **Update root** [`CLAUDE.md`](../../../CLAUDE.md) hierarchy diagram to add `Site/` and explain why it has no `code/` or `wiki/` level.
7. **Capture wiki-architecture policy (2026-04-25)** — open a decision page (or an `Absolute Rules` update in root `CLAUDE.md`) stating: memory / conversation wikis live only at the Neuvetra root; the GHG KB is the sole exception because it serves product-RAG, not memory; the `FrontDesk/wiki/` placeholder is redundant under this policy and slated for review.

---

## Open Questions Deferred to Later Cycles

These are tracked in [`wiki/features/parent-landing-experience.md`](../../../wiki/features/parent-landing-experience.md) Open Questions and **do not block** this scaffold:

- Q3: Spirit zone on the page (full-bleed vs scoped).
- Q4: Spirit reactivity event wiring.
- Q5: Per-product hover presets (`frontdeskHover`, `terrascopeHover`).
- Q6: Real-product chatbot vs lightweight explainer scope.
- Q7: Voice on the parent for Terrascope.
- Q8: Domain re-routing plan.
- Q9: Mobile / low-end device performance fallback.
- Q10: Accessibility (reduced-motion, screen reader, keyboard nav).
