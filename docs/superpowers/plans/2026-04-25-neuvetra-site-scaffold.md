# Neuvetra Site Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an empty, Railway-deployable Turborepo at `Neuvetra/Site/` containing one Elysia API (`/health` only) and one Vite + React 19 web app (placeholder element only), with the full FrontDesk-aligned tech-stack dependencies installed but no functionality.

**Architecture:** Bun-managed Turborepo monorepo with two apps and no shared packages yet. `apps/api` runs Elysia on port 3000. `apps/web` runs Vite on port 5173 with a `/api` → `localhost:3000` dev proxy. Both apps have a Dockerfile + `railway.toml` adapted from the live FrontDesk deploy. Dependencies are installed for the eventual Spirit + parent-landing work (Three, XState, etc.) but no Spirit code is copied — that's the next cycle.

**Tech Stack:** Bun (runtime + package manager), Turborepo, Elysia + @elysiajs/cors + @elysiajs/eden, Vite + @vitejs/plugin-react, React 19 + react-dom, React Router v7, Tailwind CSS v4 + @tailwindcss/vite, Three.js 0.184 (deps only), XState 5 + @xstate/react 6 (deps only), TypeScript ~5.9, ESLint 9 (flat config).

**Spec:** [`docs/superpowers/specs/2026-04-25-neuvetra-site-scaffold-design.md`](../specs/2026-04-25-neuvetra-site-scaffold-design.md)

**Working directory for all commands:** `C:\Users\nimab\Neuvetra` unless stated otherwise. Shell: bash (use Unix syntax). All `cd` commands use absolute paths.

---

## Pre-Flight

### Task 0: Verify Bun is installed and create the Site directory

**Files:** None yet.

- [ ] **Step 0.1: Verify Bun is installed**

Run: `bun --version`
Expected: a semver string `1.x.y` (FrontDesk pins to `1.2.0` but newer is fine).
If missing: install Bun from https://bun.sh and re-run.

- [ ] **Step 0.2: Verify the Site directory does not yet exist**

Run: `ls Site 2>/dev/null && echo EXISTS || echo OK_NOT_PRESENT`
Expected: `OK_NOT_PRESENT`. If `EXISTS`, stop and ask the user — we don't want to overwrite anything.

- [ ] **Step 0.3: Create the Site directory and apps subdirectories**

Run: `mkdir -p Site/apps/web/src Site/apps/web/public Site/apps/api/src`
Expected: no output, exit 0.

- [ ] **Step 0.4: Verify directory structure**

Run: `find Site -type d | sort`
Expected output:
```
Site
Site/apps
Site/apps/api
Site/apps/api/src
Site/apps/web
Site/apps/web/public
Site/apps/web/src
```

---

## Task 1: Initialize git and write .gitignore + README

**Files:**
- Create: `Site/.gitignore`
- Create: `Site/README.md`
- Create: `Site/.git/` (via `git init`)

- [ ] **Step 1.1: Initialize git in Site/**

Run: `cd Site && git init -b main && cd ..`
Expected: `Initialized empty Git repository in C:/Users/nimab/Neuvetra/Site/.git/`

- [ ] **Step 1.2: Write `.gitignore`**

Path: `Site/.gitignore`
Content:
```gitignore
# Dependencies
node_modules/

# Build outputs
dist/
build/
.turbo/

# Environment files
.env
.env.local
.env.*.local

# Editor / OS
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Bun
.bun/
```

- [ ] **Step 1.3: Write `README.md`**

Path: `Site/README.md`
Content:
```markdown
# Neuvetra Site

Parent landing surface for `neuvetra.com` and `neuvetra.ai`. Hosts the Spirit (brand icon) and the two product entry points for FrontDesk and Terrascope.

> **Status:** scaffold only. No real content yet — see [`../docs/superpowers/specs/2026-04-25-neuvetra-site-scaffold-design.md`](../docs/superpowers/specs/2026-04-25-neuvetra-site-scaffold-design.md).

## Stack

- **Runtime / package manager:** Bun
- **Monorepo:** Turborepo
- **API:** Elysia on port 3000 (`apps/api`)
- **Web:** Vite + React 19 + React Router v7 + Tailwind v4 on port 5173 (`apps/web`)

See [`CLAUDE.md`](./CLAUDE.md) for code-level conventions and dev commands.

## Quick start

```bash
bun install
bun run dev
```

- API: http://localhost:3000/health
- Web: http://localhost:5173
```

- [ ] **Step 1.4: Stage and verify**

Run: `cd Site && git status`
Expected: shows `.gitignore` and `README.md` as untracked.

- [ ] **Step 1.5: Commit**

Run:
```bash
cd Site && git add .gitignore README.md && git commit -m "chore: initialize Site repo with .gitignore and README"
```
Expected: one commit created on `main`. Stay in `Site/` for subsequent tasks.

---

## Task 2: Root package.json, turbo.json, tsconfig.base.json

**Files:**
- Create: `Site/package.json`
- Create: `Site/turbo.json`
- Create: `Site/tsconfig.base.json`

All commands in this task assume current directory is `C:\Users\nimab\Neuvetra\Site`.

- [ ] **Step 2.1: Write root `package.json`**

Path: `Site/package.json`
Content:
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

- [ ] **Step 2.2: Write `turbo.json`**

Path: `Site/turbo.json`
Content:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 2.3: Write `tsconfig.base.json`**

Path: `Site/tsconfig.base.json`
Content:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true
  }
}
```

- [ ] **Step 2.4: Verify files**

Run: `ls -la package.json turbo.json tsconfig.base.json`
Expected: all three files listed, non-zero size.

- [ ] **Step 2.5: Commit**

Run:
```bash
git add package.json turbo.json tsconfig.base.json && git commit -m "chore: add root package.json, turbo.json, shared TS base config"
```

---

## Task 3: API package.json, tsconfig, src/index.ts

**Files:**
- Create: `Site/apps/api/package.json`
- Create: `Site/apps/api/tsconfig.json`
- Create: `Site/apps/api/src/index.ts`

- [ ] **Step 3.1: Write `apps/api/package.json`**

Path: `Site/apps/api/package.json`
Content:
```json
{
  "name": "api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@elysiajs/cors": "^1.4.1",
    "elysia": "latest"
  },
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

- [ ] **Step 3.2: Write `apps/api/tsconfig.json`**

Path: `Site/apps/api/tsconfig.json`
Content:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3.3: Write `apps/api/src/index.ts`**

Path: `Site/apps/api/src/index.ts`
Content:
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

- [ ] **Step 3.4: Verify files**

Run: `ls -la apps/api/package.json apps/api/tsconfig.json apps/api/src/index.ts`
Expected: all three files listed, non-zero size.

- [ ] **Step 3.5: Commit**

Run:
```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/src/index.ts && git commit -m "feat(api): scaffold empty Elysia API with /health endpoint and CORS"
```

---

## Task 4: API railway.toml + Dockerfile

**Files:**
- Create: `Site/apps/api/railway.toml`
- Create: `Site/apps/api/Dockerfile`

- [ ] **Step 4.1: Write `apps/api/railway.toml`**

Path: `Site/apps/api/railway.toml`
Content:
```toml
[build]
builder = "nixpacks"
installCommand = "bun install"

[deploy]
startCommand = "bun run src/index.ts"
```

- [ ] **Step 4.2: Write `apps/api/Dockerfile`**

Path: `Site/apps/api/Dockerfile`
Content:
```dockerfile
FROM oven/bun:1.3.12
WORKDIR /app

# Copy workspace root manifest + lockfile
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/

RUN bun install

COPY apps/api/ ./apps/api/

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

- [ ] **Step 4.3: Verify files**

Run: `ls -la apps/api/railway.toml apps/api/Dockerfile`
Expected: both files listed, non-zero size.

- [ ] **Step 4.4: Commit**

Run:
```bash
git add apps/api/railway.toml apps/api/Dockerfile && git commit -m "build(api): add Railway nixpacks config and Dockerfile"
```

---

## Task 5: Web package.json, tsconfig files, eslint config

**Files:**
- Create: `Site/apps/web/package.json`
- Create: `Site/apps/web/tsconfig.json`
- Create: `Site/apps/web/tsconfig.app.json`
- Create: `Site/apps/web/tsconfig.node.json`
- Create: `Site/apps/web/eslint.config.js`

- [ ] **Step 5.1: Write `apps/web/package.json`**

Path: `Site/apps/web/package.json`
Content:
```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "@elysiajs/eden": "latest",
    "@xstate/react": "^6.1.0",
    "elysia": "latest",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router": "^7.0.0",
    "three": "0.184.0",
    "xstate": "^5.30.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@tailwindcss/vite": "^4.0.0",
    "@types/node": "^25.3.5",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.184.0",
    "@vitejs/plugin-react": "^5.1.1",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.48.0",
    "vite": "^7.3.1"
  }
}
```

- [ ] **Step 5.2: Write `apps/web/tsconfig.json` (project references root)**

Path: `Site/apps/web/tsconfig.json`
Content:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 5.3: Write `apps/web/tsconfig.app.json` (app TS config)**

Path: `Site/apps/web/tsconfig.app.json`
Content:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

Note: dropped `"types": ["@webgpu/types"]` from FrontDesk's version — we don't have that dep.

- [ ] **Step 5.4: Write `apps/web/tsconfig.node.json` (Vite config TS)**

Path: `Site/apps/web/tsconfig.node.json`
Content:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5.5: Write `apps/web/eslint.config.js` (flat config)**

Path: `Site/apps/web/eslint.config.js`
Content:
```js
import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
)
```

- [ ] **Step 5.6: Verify files**

Run: `ls -la apps/web/package.json apps/web/tsconfig.json apps/web/tsconfig.app.json apps/web/tsconfig.node.json apps/web/eslint.config.js`
Expected: all five files listed, non-zero size.

- [ ] **Step 5.7: Commit**

Run:
```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/tsconfig.app.json apps/web/tsconfig.node.json apps/web/eslint.config.js && git commit -m "feat(web): scaffold web app package.json, tsconfigs, and ESLint flat config"
```

---

## Task 6: Web vite.config.ts and index.html

**Files:**
- Create: `Site/apps/web/vite.config.ts`
- Create: `Site/apps/web/index.html`

- [ ] **Step 6.1: Write `apps/web/vite.config.ts`**

Path: `Site/apps/web/vite.config.ts`
Content:
```ts
import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
})
```

- [ ] **Step 6.2: Write `apps/web/index.html`**

Path: `Site/apps/web/index.html`
Content:
```html
<!doctype html>
<html lang="en" style="background:#0b0c0d">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Neuvetra — AI tools for businesses</title>
    <meta name="description" content="Neuvetra builds AI tools for businesses." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6.3: Verify files**

Run: `ls -la apps/web/vite.config.ts apps/web/index.html`
Expected: both files listed, non-zero size.

- [ ] **Step 6.4: Commit**

Run:
```bash
git add apps/web/vite.config.ts apps/web/index.html && git commit -m "feat(web): add Vite config with /api dev proxy and index.html shell"
```

---

## Task 7: Web src files (main.tsx, App.tsx, index.css, vite-env.d.ts)

**Files:**
- Create: `Site/apps/web/src/main.tsx`
- Create: `Site/apps/web/src/App.tsx`
- Create: `Site/apps/web/src/index.css`
- Create: `Site/apps/web/src/vite-env.d.ts`

- [ ] **Step 7.1: Write `apps/web/src/main.tsx`**

Path: `Site/apps/web/src/main.tsx`
Content:
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

- [ ] **Step 7.2: Write `apps/web/src/App.tsx`**

Path: `Site/apps/web/src/App.tsx`
Content:
```tsx
export function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0c0d] text-white/60">
      <p className="text-sm uppercase tracking-widest">Neuvetra</p>
    </div>
  )
}
```

- [ ] **Step 7.3: Write `apps/web/src/index.css`**

Path: `Site/apps/web/src/index.css`
Content:
```css
@import "tailwindcss";
```

- [ ] **Step 7.4: Write `apps/web/src/vite-env.d.ts`**

Path: `Site/apps/web/src/vite-env.d.ts`
Content:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7.5: Verify files**

Run: `ls -la apps/web/src/main.tsx apps/web/src/App.tsx apps/web/src/index.css apps/web/src/vite-env.d.ts`
Expected: all four files listed, non-zero size.

- [ ] **Step 7.6: Commit**

Run:
```bash
git add apps/web/src/main.tsx apps/web/src/App.tsx apps/web/src/index.css apps/web/src/vite-env.d.ts && git commit -m "feat(web): add main.tsx, App.tsx placeholder, Tailwind entry, vite-env types"
```

---

## Task 8: Web railway.toml + Dockerfile

**Files:**
- Create: `Site/apps/web/railway.toml`
- Create: `Site/apps/web/Dockerfile`

- [ ] **Step 8.1: Write `apps/web/railway.toml`**

Path: `Site/apps/web/railway.toml`
Content:
```toml
[build]
dockerfilePath = "apps/web/Dockerfile"
```

- [ ] **Step 8.2: Write `apps/web/Dockerfile`**

Path: `Site/apps/web/Dockerfile`
Content:
```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app

# Build-time env var for Vite — API base URL at build time
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

- [ ] **Step 8.3: Verify files**

Run: `ls -la apps/web/railway.toml apps/web/Dockerfile`
Expected: both files listed, non-zero size.

- [ ] **Step 8.4: Commit**

Run:
```bash
git add apps/web/railway.toml apps/web/Dockerfile && git commit -m "build(web): add Railway config and multi-stage Dockerfile (bun build → serve)"
```

---

## Task 9: Install dependencies

**Files:** None modified directly. Generates `Site/bun.lock` and `Site/node_modules/`.

- [ ] **Step 9.1: Install all workspace dependencies with Bun**

Run: `bun install`
Expected: prints package install summary, ends with `Done` and a duration. May take 30s–2min depending on network. No errors.

- [ ] **Step 9.2: Verify lockfile and node_modules exist**

Run: `ls -la bun.lock && ls node_modules | head -5`
Expected: `bun.lock` exists with non-zero size; `node_modules/` contains directories (turbo, typescript, etc.).

- [ ] **Step 9.3: Verify workspace packages are linked**

Run: `ls -la apps/web/node_modules apps/api/node_modules 2>/dev/null | head`
Expected: each has its own `node_modules` symlinks to the hoisted store.

- [ ] **Step 9.4: Stage the lockfile**

Run: `git add bun.lock`
Expected: no error.

- [ ] **Step 9.5: Commit the lockfile**

Run: `git commit -m "chore: add bun.lock from initial install"`
Expected: one commit. Exit 0.

---

## Task 10: Boot dev servers and verify

**Files:** None modified.

- [ ] **Step 10.1: Boot both dev servers in the background**

Run: `bun run dev > /tmp/site-dev.log 2>&1 &`
Expected: command returns immediately with the background PID.
Note: turbo should boot both `apps/api` (Bun watch) and `apps/web` (Vite). Give it ~5 seconds to come up before the next step.

- [ ] **Step 10.2: Wait briefly for both servers to bind**

Run: `sleep 5`
Expected: no output.

- [ ] **Step 10.3: Verify the API health endpoint**

Run: `curl -s http://localhost:3000/health`
Expected output (exact): `{"status":"ok"}`

- [ ] **Step 10.4: Verify the web app serves the index.html**

Run: `curl -s http://localhost:5173/ | grep -E '<title>|<div id="root">'`
Expected: at least the `<title>Neuvetra — AI tools for businesses</title>` line.

- [ ] **Step 10.5: Stop the dev servers**

Run: `kill %1 2>/dev/null; pkill -f "bun run --watch" 2>/dev/null; pkill -f vite 2>/dev/null; sleep 1; echo done`
Expected: `done` printed. Servers stopped.

- [ ] **Step 10.6: Open the dev log briefly to confirm clean boot**

Run: `tail -30 /tmp/site-dev.log`
Expected: lines indicating both `api` started on 3000 and `vite` ready on 5173. No fatal errors.

---

## Task 11: Run typecheck, build, and lint

**Files:** None modified directly. May produce `Site/apps/web/dist/`.

- [ ] **Step 11.1: Run typecheck across all workspaces**

Run: `bun run typecheck`
Expected: turbo summary at the end, all tasks pass. No TS errors.

- [ ] **Step 11.2: Run build**

Run: `bun run build`
Expected: turbo runs `build` for `web` (api has none, turbo skips). `apps/web/dist/index.html` and `apps/web/dist/assets/*` produced. No errors.

- [ ] **Step 11.3: Verify the web build artifacts**

Run: `ls apps/web/dist/`
Expected: `index.html` and `assets/` directory present.

- [ ] **Step 11.4: Run lint**

Run: `bun run lint`
Expected: turbo runs `lint` for `web`. No errors. Warnings allowed (none expected for the placeholder code).

- [ ] **Step 11.5: Verify dist is gitignored (no dist files staged)**

Run: `git status --short | grep dist || echo "OK: dist not tracked"`
Expected: `OK: dist not tracked`.

---

## Task 12: Site CLAUDE.md

**Files:**
- Create: `Site/CLAUDE.md`

- [ ] **Step 12.1: Write `Site/CLAUDE.md`**

Path: `Site/CLAUDE.md`
Content:
````markdown
# Neuvetra Site — Code Operating Schema

> **Parents:** `..\CLAUDE.md` (Neuvetra business root) and `..\wiki\` (C-level wiki — single source of conversation memory). Read those first for company-wide context. This file owns Site **code-specific** rules only.

## Project Overview

Parent landing surface for `neuvetra.com` and `neuvetra.ai`. Hosts the Spirit (brand icon, `[[spirit]]`) and the two product entry points (`[[frontdesk]]`, `[[terrascope]]`). Currently a **scaffold** — empty Vite app + empty Elysia API. Real content lands in subsequent cycles per `[[parent-landing-experience]]`.

Sibling products: `..\FrontDesk\code\` and `..\Terrascope\code\`.

## Hierarchy Deviations from FrontDesk / Terrascope

- **No `code/` subdirectory.** `Site/` IS the code root. FrontDesk and Terrascope each pair `code/` with a knowledge-base sibling (`Terrascope/ghg-kb/`, `FrontDesk/wiki/` placeholder); Site has none, so the level is dropped.
- **No `wiki/` subdirectory** — by policy (2026-04-25). Memory / conversation wikis live only at `Neuvetra/wiki/`. The Terrascope GHG KB is the sole exception (it's product-RAG, not memory). The existing `FrontDesk/wiki/` placeholder is redundant under this policy and slated for review.

## Stack

- **Runtime + package manager:** Bun
- **Monorepo:** Turborepo (`apps/web`, `apps/api`; no `packages/` yet)
- **API:** Elysia on port 3000 (`apps/api`)
- **Web:** Vite + React 19 + React Router v7 + Tailwind v4 on port 5173 (`apps/web`)
- **Types-only deps already installed for next cycle:** Three.js 0.184, XState 5 + @xstate/react 6 (no usage yet)
- **Type-safe API client:** `@elysiajs/eden` consuming `export type App = typeof app` from `apps/api/src/index.ts`

## Workspace Structure

```
Site/
├── apps/
│   ├── api/      ← Elysia + CORS + /health, port 3000
│   └── web/      ← Vite + React 19 SPA, port 5173 (dev), 8080 (Docker)
├── package.json
├── turbo.json
├── tsconfig.base.json
├── bun.lock
├── README.md
└── CLAUDE.md
```

## Dev Commands

```bash
bun install                            # all workspaces
bun run dev                            # both apps via turbo
bun run build                          # web only (api has no build step)
bun run typecheck                      # both apps
bun run lint                           # web only

cd apps/api && bun run dev             # API only (port 3000)
cd apps/web && bun run dev             # Web only (Vite, port 5173)
```

## Key Conventions

- **Bun-only.** `bun add` / `bun remove` for installs. `bunx` for one-off tool runs. **No `npm`, `pnpm`, or `npx` anywhere.**
- API entry: `apps/api/src/index.ts`. Always use Bun APIs over Node (`Bun.file`, `Bun.env`).
- Use Elysia's built-in type system — no separate validation library.
- Eden type bridge: `export type App = typeof app` from `apps/api/src/index.ts`; web app imports it via `@elysiajs/eden`.
- Path alias `@/*` → `apps/web/src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`).
- Vite dev server proxies `/api/*` → `http://localhost:3000` so the web app can fetch `/api/health` in dev.

## Deploy

- **Railway, configs in-repo:** `apps/api/railway.toml` (nixpacks) + `apps/api/Dockerfile`; `apps/web/railway.toml` + `apps/web/Dockerfile` (multi-stage bun build → `serve` on 8080).
- **Domain plan:** `neuvetra.com` and `neuvetra.ai` will eventually point to Site once parent-landing content lands. FrontDesk migrates to a subdomain at the same time. See `[[parent-landing-experience]]` Open Q8.

## Cross-Product Lockstep

Per the root `..\CLAUDE.md` Absolute Rule #2: keep stack versions aligned with `..\FrontDesk\code\` and `..\Terrascope\code\`. If a version diverges here, port the change.
````

- [ ] **Step 12.2: Verify file**

Run: `ls -la CLAUDE.md && wc -l CLAUDE.md`
Expected: file exists, ~70 lines.

- [ ] **Step 12.3: Commit**

Run: `git add CLAUDE.md && git commit -m "docs: add Site/CLAUDE.md with hierarchy deviations and dev commands"`

---

## Task 13: Final verification + summary

**Files:** None modified.

- [ ] **Step 13.1: Print git log of the scaffold**

Run: `git log --oneline`
Expected: ~9 commits, all on `main`, message style consistent (chore/feat/build/docs prefixes).

- [ ] **Step 13.2: Final tree**

Run: `find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path '*/dist/*' -not -path '*/node_modules/*' | sort`
Expected: every file listed in the spec's directory layout. Sanity-check against spec.

- [ ] **Step 13.3: Final dev-server smoke test (one more pass)**

Run: `bun run dev > /tmp/site-dev-final.log 2>&1 &` then `sleep 5` then `curl -s http://localhost:3000/health` then `kill %1; pkill -f "bun run --watch"; pkill -f vite; sleep 1; echo done`
Expected: `{"status":"ok"}` then `done`.

- [ ] **Step 13.4: Report scaffold complete**

Print a one-line summary:
```
Site scaffold complete. N commits on main. Verification: bun install ✓ | bun run dev ✓ | /health ✓ | bun run typecheck ✓ | bun run build ✓ | bun run lint ✓
```

---

## After This Plan — Out of Scope

These belong in their own future cycles, **not** this plan:

1. **Wiki write-back** ("save" pass) — done by the user invoking the save protocol once they confirm scaffold is good. Updates per spec § Wiki Write-Backs.
2. **Spirit copy** — copy `lib/spirit/*`, `data/spirit-presets.ts`, `public/audio/*` from FrontDesk; install no new deps (Three + XState already in scaffold).
3. **app-fsm route copy** — copy `pages/app-fsm/*` and supporting machines, dropping `authActor.ts`.
4. **Parent-landing real content** — headline, two product entry-point cards, hover Spirit presets, explainer chatbots, voice support.
5. **Domain re-routing** — `neuvetra.com` / `.ai` from FrontDesk to Site; FrontDesk to subdomain.
6. **Reduced-motion / mobile fallback for the Spirit.**
7. **Auth + billing** — gated on the open `wiki/decisions/2026-04-25-auth-billing-strategy.md`.

Each gets its own design + plan cycle.
