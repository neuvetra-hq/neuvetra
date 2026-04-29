# `apps/frontdesk-web` — FrontDesk Web

> **Parent:** repo root `CLAUDE.md`. Read that first for monorepo conventions.

Vite + React 19 SPA for FrontDesk. Live in production at `neuvetra.com`. Hosts the marketing/landing page, signup wizard (Supabase phone OTP), authenticated app dashboard (calendar, calls, KB editor, settings), legal pages, and the Spirit brand-icon renderer.

## Stack

- **Bundler:** Vite 7
- **UI:** React 19 + React Router v7 + Tailwind v4
- **Components:** ShadCN + Radix UI + Base UI + lucide-react + Framer Motion + Sonner (toasts) + cmdk (command palette) + react-day-picker + recharts
- **Forms:** react-hook-form + Zod via `@hookform/resolvers`
- **Auth client:** `@supabase/supabase-js`
- **API client:** `@elysiajs/eden` consuming `App` type from `apps/frontdesk-api`
- **State:** XState 5 + `@xstate/react` 6 (onboarding wizard machine, Spirit machine)
- **3D:** Three.js 0.184 (Spirit particle field) + `webgpu-threejs-tsl` skill for WebGPU/TSL guidance
- **Voice (browser):** `@twilio/voice-sdk` (in-browser click-to-call)
- **Payments:** `@stripe/stripe-js` + `@stripe/react-stripe-js`
- **OTP UI:** `input-otp`
- **Tests:** Playwright (`@playwright/test`)
- **Theming:** next-themes

## Commands

```bash
cd apps/frontdesk-web
bun run dev           # Vite dev server, port 5173
bun run build         # tsc -b && vite build
bun run preview       # preview production build
bun run typecheck     # tsc --noEmit
bun run lint          # eslint .
bun run test:e2e      # Playwright (auto-starts dev server)
bun run test:e2e:ui   # Playwright UI mode
```

## Layout

```
apps/frontdesk-web/
├── src/
│   ├── App.tsx, main.tsx, index.css
│   ├── pages/                  ← LoginPage, SignupPage, ContactPage, IndustryPage, app/*
│   ├── components/             ← landing/, auth/, signup/, get-started/, ui/ (shadcn)
│   ├── lib/spirit/             ← Three.js engine + particles + spiritMachine (XState)
│   ├── data/spirit-presets.ts  ← color palettes per Spirit mode
│   ├── machines/               ← XState machines (onboardingMachine.ts, etc.)
│   ├── contexts/               ← AuthContext + landing constants
│   └── hooks/, utils/, lib/
├── tests/                      ← Playwright .spec.ts files
├── public/                     ← static + public/audio/
├── Dockerfile
├── railway.toml
├── playwright.config.ts        ← defaults to http://localhost:5173, auto-starts dev server
├── vite.config.ts              ← @/* → src/*; proxies /api → :3000 in dev
└── package.json
```

## Critical context

### Signup flow + Twilio Campaign 1 consent

The signup wizard ([`src/pages/SignupPage.tsx`](src/pages/SignupPage.tsx)) uses Supabase phone OTP via `signInWithOtp` + `verifyOtp`. The on-page consent text at [`src/components/signup/StepIdentity.tsx:65-69`](src/components/signup/StepIdentity.tsx) is the **approved Campaign 1 consent** — **must NOT be touched.**

After verification, `SignupPage.handleVerified` POSTs to `/auth/optin-confirm` (in `apps/frontdesk-api`) which sends the Campaign 1 confirmation SMS. See [`claude-memory/topics/frontdesk-sms-architecture.md`](../../claude-memory/topics/frontdesk-sms-architecture.md) for the full two-campaign architecture.

**Issue 1 (deferred):** add a separate optional opt-in checkbox at end of signup for Campaign 2 (booking-alert SMS to owner). Default unchecked. Persist as `users.smsAppointmentAlertsOptIn` (column doesn't exist yet — needs Drizzle migration).

### The Spirit

`src/lib/spirit/` is the curl-noise-driven Three.js particle field that's the Neuvetra brand icon ([[claude-memory/brand/spirit.md]]). It will eventually be extracted to a shared workspace package per [[2026-04-25-spirit-packaging]] when Terrascope frontend lights up. In the monorepo this is now a one-line workspace move.

### Tests (TDD)

Playwright E2E lives in `tests/`. Convention: failing test first, then implement. Coverage areas: landing rendering + CTAs, auth flows (signup/login/OTP), protected route redirects, onboarding steps, legal pages. For protected-route tests, use Playwright `storageState` with a seeded Supabase session.

## Deploy

Railway service via [`Dockerfile`](Dockerfile) + [`railway.toml`](railway.toml). Multi-stage Bun build → static SPA served on port 8080 in production.

## Skills to reach for

**State machines (XState v5):**
- `xstate-v5` (syntax, setup, typed actors)
- `xstate-react` (React hooks integration)
- `xstate-testing` (machine + actor tests)
- `actor-model` (multi-actor architecture, when applicable)

**3D / Spirit:**
- `webgpu-threejs-tsl:webgpu-threejs-tsl` (WebGPU / TSL — applies to future migrations)
- `mcp__plugin_context7_context7__query-docs` for live Three.js docs (API churns version-to-version; don't lean on training data alone)

**UI / debugging:**
- `frontend-design:frontend-design`
- `chrome-devtools-mcp:chrome-devtools`, `chrome-devtools-mcp:debug-optimize-lcp`, `chrome-devtools-mcp:a11y-debugging`, `chrome-devtools-mcp:memory-leak-debugging`

**Stripe:**
- `stripe:stripe-best-practices`, `stripe:test-cards`, `stripe:explain-error`

**Process:** `superpowers:test-driven-development` (Playwright), `superpowers:systematic-debugging`, `superpowers:verification-before-completion`.
