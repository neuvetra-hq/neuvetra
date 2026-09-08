# Neuvetra — Monorepo Operating Schema

> **You are at the top of the Neuvetra monorepo.** Read this first when anything touches "the company," "the products," or anything cross-product. CLAUDE.md cascades — at any nested level the most-specific CLAUDE.md applies, but this file is always inherited.

Single private repo at `github.com/neuvetra-hq/neuvetra` (consolidated 2026-04-28 — see [[2026-04-28-consolidate-into-single-monorepo]]).

## Current development baseline (2026-09-08)

**Current CEO direction supersedes the historical multi-product plan below:** Neuvetra is the sole customer-facing GHG product for California and the United States. Retire TerraScope branding; preserve/defer FrontDesk. Read [`docs/roadmap-neuvetra-ghg.md`](docs/roadmap-neuvetra-ghg.md) and the [strategy record](claude-memory/meetings/2026-09-08-neuvetra-ghg-focus.md) first. Review notes before code, but independently verify all inherited AI claims, methods and factors. Every stage ends with a demonstrated result and feedback. The preserved baseline is GitHub tag `checkpoint/pre-ghg-focus-2026-09-08` at `367497e`.

The company Site, FrontDesk and Terrascope are separate product workspaces with shared tooling. See [`docs/architecture.md`](docs/architecture.md) for ownership and [`docs/deployment.md`](docs/deployment.md) for current public observations and the root-context Railway build contract. Historical deployment assertions below and in memory are not proof of current dashboard state.

Use Bun **1.3.12**. `bun run dev` previews Site web only; `dev:site`, `dev:frontdesk` and `dev:terrascope` explicitly select each web/API pair. `dev:all` starts every app. `bun run check` runs application typechecks, lint, unit tests and web builds. The Python GHG suite is separate (`test:ghg`) and still blocked by unfinished methodology expectations.

Shared compiler/lint settings live in `config/`. Product-specific legacy config packages remain compatibility wrappers. Terrascope's TypeScript database/calculator packages are **throwing stubs**, not working implementations; they install/typecheck but cannot support real product requests. The current work order is verified GHG research and a focused Neuvetra preview, then a small supported-answer/calculation demonstration, secure company workflows and a controlled pilot.

---

## The Hierarchy

```
neuvetra/                             ← repo root (this file)
├── CLAUDE.md
├── apps/                             ← deployable apps (each one is a "project")
│   ├── frontdesk-api/                ← Bun + Elysia, serves neuvetra.com (live)
│   ├── frontdesk-web/                ← Vite + React 19, serves neuvetra.com (live)
│   ├── site-api/                     ← serves api.neuvetra.ai (live)
│   ├── site-web/                     ← serves www.neuvetra.ai (live)
│   ├── terrascope-api/               ← not yet deployed
│   └── terrascope-web/               ← placeholder, not yet built
├── packages/                         ← shared workspace packages
│   ├── frontdesk-database/           ← Drizzle schema (frontdesk.* tables + public.users)
│   ├── frontdesk-config/
│   ├── terrascope-database/
│   ├── terrascope-config/
│   └── terrascope-calculator/        ← throwing stub; Python reference survives in ghg-kb
├── claude-memory/                    ← C-level strategic memory (this is Claude's, see § below)
│   └── CLAUDE.md                     ← memory schema + INGEST/QUERY/LINT workflows
├── neuvetra-kb/                      ← brand-level public salesperson RAG
│   └── CLAUDE.md                     ← Karpathy LLM Wiki model — DO NOT touch without coordination
├── ghg-kb/                           ← Terrascope domain RAG (data-integrity-critical)
│   └── CLAUDE.md                     ← Karpathy LLM Wiki model — DO NOT touch without coordination
├── docs/                             ← cross-product specs, PRDs, plans
├── config/                           ← shared TypeScript + frontend lint settings
├── .claude/                          ← repo-wide skills + settings
├── .github/                          ← Claude Code review workflows
├── package.json                      ← workspaces: ["apps/*", "packages/*"]
├── turbo.json
├── tsconfig.base.json
├── .gitignore
├── .gitattributes                    ← LF normalization (prevents Windows CRLF phantom diffs)
└── README.md
```

**Domains:** `neuvetra.com` → FrontDesk (live, indefinite). `www.neuvetra.ai` → Site (live). Both on Squarespace as registrar; Railway as host. See [[overview]] for the full domain map.

**Two products share a company website.** Site introduces FrontDesk and Terrascope and provides the greeter/chat surface; each product owns its domain workflows and subscriptions.

---

## Three knowledge stores at root

| Store | Role | Touch policy |
|---|---|---|
| **`claude-memory/`** | Claude's persistent C-level memory across sessions. Strategic decisions, plans, brand, products, conversations. | Internal-only forever. Owned by Claude — write proactively, recall first. |
| **`neuvetra-kb/`** | Public salesperson RAG. Brand, product, plan, use-case, comparison, objection, FAQ, story pages. | Public-safe gated. Trigger-vocabulary boundary with `claude-memory/`. **Don't auto-bridge in either direction.** |
| **`ghg-kb/`** | Terrascope domain RAG (regulations, methodologies, factor data). | **Data-integrity-critical.** RAG source. Don't edit casually. |

**Trigger boundary:** memory triggers ("save", "log this", "update memory") write only to `claude-memory/`. Public-KB triggers ("update our users", "publish this") write only to `neuvetra-kb/`. Default to memory and ask if ambiguous.

---

## The C-Level Memory Store (`claude-memory/`)

**This is Claude's persistent memory across sessions** and the sole memory store for everything strategic about Neuvetra. The CEO talks, asks, decides — but doesn't manage the wiki. Claude (CFO/CPO/CTO hats) synthesizes conversation into the wiki for its own future-self recall.

> **Override:** Claude Code's per-project memory directory is **OFF** for Neuvetra. Behavioral preferences, user/project facts, references — all go into the wiki, not auto-memory.

**Wiki-first protocol — before answering any Neuvetra question:**
1. Read `claude-memory/index.md` to find relevant pages.
2. Read those pages plus any `[[linked]]` ones needed.
3. Read `claude-memory/log.md` if the question is about recency.
4. Cite the wiki pages used in the answer.
5. After the conversation, propagate updates back into the wiki.

If the wiki has no answer, say so — don't fabricate.

**Save triggers** ("save", "save memory", "update memory", "save to wiki", "log this", "write this up") invoke the `save-claude-memory` skill, which follows `claude-memory/CLAUDE.md` § Workflow 1 — INGEST. Raw-first principle: the conversation lands in `claude-memory/raw/conversations/YYYY-MM-DD-slug.md` immutably **before** synthesis; raw is deleted post-verify per Policy A.

**Boundary with product knowledge:** strategic state in `claude-memory/`. Product-operational state stays with the app (`apps/terrascope-api/STATUS.md`, `apps/site-api/HARDENING.md`, per-app `CLAUDE.md`). Don't mix.

See `claude-memory/CLAUDE.md` for the full schema.

---

## Self-Awareness Rule

When the user says "my project" or talks about Neuvetra without qualifier, default to the most specific level you can infer. If unclear, ask before acting.

| User says | They probably mean |
|---|---|
| "the company" / "Neuvetra" / "the business" | This file — repo root, top-of-tree |
| "claude memory" / "Claude's memory" / "the wiki" (legacy) / "decisions" / strategic anything | `claude-memory/` |
| "the public KB" / "neuvetra-kb" / "the salesperson" / "what the chatbot knows" | `neuvetra-kb/` |
| "the GHG KB" / "the factors" / "Terrascope KB" | `ghg-kb/` |
| "the knowledge base" alone | **Ask** — could be `ghg-kb/` or `neuvetra-kb/` |
| "FrontDesk" / "the receptionist" / "the voice product" | `apps/frontdesk-{api,web}/` + `packages/frontdesk-*/` |
| "Terrascope" / "the emissions product" / "GHG" / "carbon" | `apps/terrascope-{api,web}/` + `packages/terrascope-*/` |
| "Site" / "the parent landing" / "neuvetra.ai" | `apps/site-{api,web}/` |
| "the database" alone | The single shared **Neuvetra** Supabase project (was named "FrontDesk", being renamed). See [[supabase]]. |
| "the code" / "the API" / "the backend" / "the frontend" | the relevant `apps/<product>-{api,web}/` — ask if which product is ambiguous |
| "my project" with no other clue | **Ask before acting** |

---

## Cross-Product Absolute Rules

1. **Three knowledge stores, three roles, no mixing.** Memory triggers → `claude-memory/` only. Public-KB triggers → `neuvetra-kb/` only. Domain RAG edits → `ghg-kb/` via its own workflow only. Never auto-bridge.
2. **Lockstep stack.** All apps share Bun + Turborepo + Elysia + Drizzle + Vite + React 19 + RR v7 + Tailwind v4. The workspace `bun.lock` enforces version alignment automatically. If a pattern emerges in one app that should apply to others, port it.
3. **Cross-product work splits two ways:** strategic (decisions, plans, brand, positioning) → `claude-memory/`. Authored artifacts (PRDs, specs, design docs) → `docs/`.
4. **Ask which app a request is about** if there's any ambiguity.
5. **CLAUDE.md cascades.** When working in a nested level, the most-specific `CLAUDE.md` applies; you also inherit context from every parent. Read up the tree if you need broader context.
6. **Wiki-first protocol** before answering any Neuvetra question — see § The C-Level Memory Store.
7. **Bun-only.** `bun add` / `bun remove` for installs, `bunx` for one-off tool runs. **No `npm` / `pnpm` / `npx`.**
8. **Single shared Supabase project.** `auth.users` + `public.users` + sync trigger are common across all products; product-specific tables live in product schemas (`frontdesk.*`, `terrascope.*`, `site.*`). Don't add tables to `public.*` for product-specific data.

---

## Dev commands (root)

```bash
bun install                    # install all workspaces
bun run dev                    # Site frontend preview
bun run dev:site               # Site web + API
bun run dev:frontdesk          # FrontDesk web + API
bun run dev:terrascope         # explicit opt-in; Terrascope runtime still incomplete
bun run dev:all                # all apps via turbo
bun run build                  # all apps
bun run typecheck              # all apps
bun run lint                   # all apps
bun run test                   # available offline application unit tests
bun run check                  # typecheck + lint + test + build

# Per-app:
cd apps/<name> && bun run dev
```

---

## Skills to reach for at this level

> Operating model: all skills installed at user level. Selection is runtime, by Claude, based on directory + conversation. Lists below are guidance hints. Per-app `CLAUDE.md` files add app-specific skill suggestions on top.

When working at the **repo root** (cross-product strategy, planning, brand, sales / marketing / audience / risk strategy):

- **Strategy & writing:** `superpowers:brainstorming`, `superpowers:writing-plans`, `write-a-prd`, `prd-to-issues`, `grill-me`, `improve-codebase-architecture`.
- **State-machine design (business workflows):** `statechart-design`, `actor-model` (design only — XState v5 implementation lives at the app level).
- **Telemetry / product strategy:** `product-tracking-skills:product-tracking-business-case`, `product-tracking-skills:product-tracking-design-tracking-plan`, `product-tracking-skills:product-tracking-model-product`.
- **Memory ingestion:** `save-claude-memory` (at `.claude/skills/save-claude-memory/`).
- **Live docs (any topic):** `mcp__plugin_context7_context7__query-docs` and `resolve-library-id` — preferred over web search for library/SDK/framework docs.
- **Process meta:** `superpowers:using-superpowers`, `superpowers:dispatching-parallel-agents`, `superpowers:finishing-a-development-branch`.

Engineering-implementation skills (XState v5 syntax, React, Three.js, Supabase, etc.) belong at the relevant app's `CLAUDE.md`.

---

## Where to find what

- **Open / closed decisions, what's next, what's in flight:** [`claude-memory/next.md`](claude-memory/next.md).
- **Company state synthesis:** [`claude-memory/overview.md`](claude-memory/overview.md).
- **Product / tech strategy:** `claude-memory/products/`, `claude-memory/tech/`.
- **Per-app dev rules:** `apps/<name>/CLAUDE.md`.
- **Specs and PRDs:** `docs/`.
