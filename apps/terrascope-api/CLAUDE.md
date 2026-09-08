# `apps/terrascope-api` — Terrascope API

> **Parent:** repo root `CLAUDE.md`. Read that first for monorepo conventions.

Bun + Elysia API for Terrascope, the GHG emissions reporting chatbot. **Not yet deployed.** Implements the 4-step `/chat` pipeline (extract → calculate → format), company CRUD, reports, and factor lookup against the GHG KB.

**Current correction (2026-09-08):** the packages described as empty below now contain manifests and explicit throwing stubs. Workspace installation/typechecking succeeds, but useful API requests remain blocked. Local port is **3002**. The shared build context for future deployment is the repository root; see `docs/deployment.md`, which supersedes the historical isolated-app instructions below.

> **⚠️ Known broken state (snapshot artifact, 2026-04-28):** Source files (`src/routes/{chat,companies,factors,reports}.ts`) import from `@terrascope/database` and `@terrascope/calculator`, but **`packages/terrascope-database/` and `packages/terrascope-calculator/` are empty** — they were gutted in the Terrascope working tree before the monorepo move and the CEO directive was to snapshot as-is. `bun install` at root will fail to resolve those workspace deps until the packages are restored or the imports are rewritten. **Recovery:** check the original Terrascope repo's git history (was at `Neuvetra/Terrascope/code/`, no longer accessible since `.git` was nuked). The on-disk Terrascope code is what shipped; the deleted packages may be in an earlier commit on the FrontDesk repo's reflog or a different machine.

## Stack

- **Runtime:** Bun 1.2+, port 3000
- **Framework:** Elysia
- **DB:** Drizzle ORM via `@terrascope/database` workspace package → shared Neuvetra Supabase project
- **Calc engine:** `@terrascope/calculator` workspace package — typed TS mirror of the Python reference
- **AI:** `@anthropic-ai/sdk` (Claude `claude-sonnet-4-6`)
- **Auth:** Supabase JS client

## Commands

```bash
cd apps/terrascope-api
bun run dev            # watch mode on port 3000
bun run typecheck      # tsc --noEmit
```

## Layout

```
apps/terrascope-api/
├── src/
│   ├── index.ts              ← Elysia entry
│   ├── env.ts
│   ├── routes/               ← /chat, /companies, /reports, /factors
│   ├── chat/                 ← 4-step pipeline (extract → calculate → format)
│   └── ...
├── STATUS.md                 ← operational status — read this BEFORE Phase 3 work
├── package.json
└── tsconfig.json
```

## Critical context

### **Architectural commitment: the LLM never does arithmetic.**

Every emission number returned to a user originates from a typed `CalculationResult` produced by a calculator function in `@terrascope/calculator`. The LLM extracts intent + entities, the calculator computes, the LLM formats the response. No exceptions.

### STATUS.md is the single source of truth for operational state

[`STATUS.md`](STATUS.md) tracks build state, factor queue, audit findings, the pre-Phase-3 gate. **Read it before starting any Terrascope-API session.** It's separate from strategic state in `claude-memory/products/terrascope.md`.

### Pre-Phase-3 gate (resume here next session)

Per [[next]] and [`STATUS.md`](STATUS.md):

1. Reconcile Supabase factor count — audit says 2,138 seeded vs `ghg-kb/factors/index.md` says "Loaded: No"
2. Fix `ghg-kb/factors/schema.sql` (3 missing columns/constraints) before any factor reload
3. Rebuild GHG KB git index (currently corrupted)
4. Update factor-CSV env var in [`packages/terrascope-database/src/seed-factors.ts`](../../packages/terrascope-database/src/seed-factors.ts) to point at `ghg-kb/factors/processed/` (path was `Neuvetra/ghg-kb/factors/processed/` pre-monorepo; relative path may need adjustment)

**Then** Phase 3: mobile combustion → Cat 1 spend → Cat 6 travel → boundary `inventory_config` → Cat 15 financed → AFOLU/baselines. Then Weaviate export.

### Schema

After 2026-04-28 namespace reorg, the `terrascope.*` Postgres schema exists but is **empty** — Terrascope's tables were not migrated yet (the existing tables live in the separate Terrascope Supabase project at `jfjbiqeplnbxkadqnimt`). When the eventual data consolidation lands, those tables move into `terrascope.*` in the unified Neuvetra project. Today, `@terrascope/database` still points at the separate Terrascope project; reconciling that is a future cycle.

### Critical regulatory facts

- **SB 253 first-year deadline:** August 10, 2026 (per §96076).
- **SB 261 enforcement:** suspended by Ninth Circuit injunction (2025-11-18) — CARB not enforcing until lifted.

## Deploy

No Railway service yet. When deployed, follow the Site pattern: per-app Root Directory = `apps/terrascope-api`, simple `COPY . . + bun install` Dockerfile, `Bun.serve` binding to `0.0.0.0`.

## Skills to reach for

- **DB:** `supabase:supabase`, `supabase:supabase-postgres-best-practices`
- **Anthropic / Claude API:** `claude-api`
- **Live docs:** `mcp__plugin_context7_context7__query-docs` for Elysia, Drizzle, Bun
- **Process:** `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`
- **Memory:** `save-claude-memory` (root)
