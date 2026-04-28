# Neuvetra — Business Operating Schema

> **You are at the top of the Neuvetra hierarchy.** Read this file first whenever a request touches "the company," "the products," or anything cross-product. CLAUDE.md cascades down — at any nested level, the most-specific CLAUDE.md applies, but the context from this file is always inherited.

---

## The Hierarchy

```
Neuvetra/                       ← business root (this file)
├── CLAUDE.md                   ← business-wide overview & memory
├── .claude/skills/             ← business-wide skills
├── docs/                       ← cross-product specs and plans
│
├── Terrascope/                 ← GHG emissions reporting product
│   ├── CLAUDE.md               ← Terrascope project memory (read second when working in Terrascope)
│   ├── .claude/skills/         ← Terrascope-specific skills
│   ├── wiki/                   ← knowledge base (only used by Terrascope)
│   │   ├── CLAUDE.md           ← wiki schema, ingestion/query workflows
│   │   └── .claude/skills/     ← wiki-specific skills
│   └── code/                   ← codebase (apps, packages)
│       ├── CLAUDE.md           ← code stack, dev commands, conventions
│       └── .claude/skills/     ← code-specific skills
│
└── FrontDesk/                  ← AI voice front-desk product
    ├── CLAUDE.md               ← FrontDesk project memory
    ├── .claude/skills/         ← FrontDesk-specific skills
    ├── wiki/                   ← reserved for future knowledge base (currently empty)
    │   ├── CLAUDE.md           ← placeholder + future structure guidance
    │   └── .claude/skills/
    └── code/                   ← codebase (apps, packages)
        ├── CLAUDE.md           ← code stack, dev commands, conventions
        └── .claude/skills/
```

**Domains:** `neuvetra.com`, `neuvetra.ai`. Both products live under one brand.

**Both products are subscription-based chatbots.** They greet a visitor, ask what they need, gather context, and convert them to a paid subscription. Independent products under a shared brand.

---

## Self-Awareness Rule

When the user says "my project" or talks about Neuvetra without qualifier, default to the most specific level you can infer. If unclear, ask before acting.

| User says | They probably mean |
|---|---|
| "the company" / "the business" / "Neuvetra" | This level — top-of-tree |
| "FrontDesk" / "the receptionist" / "the voice product" | `Neuvetra\FrontDesk\` (and usually `code\` within it) |
| "Terrascope" / "the emissions product" / "GHG" / "carbon" | `Neuvetra\Terrascope\` |
| "the wiki" / "the knowledge base" / "the factors" | `Neuvetra\Terrascope\wiki\` |
| "the code" / "the API" / "the backend" / "the frontend" | the relevant `code\` subfolder of whichever product is in scope |
| "my project" with no other clue | **Ask before acting** |

If the request crosses products (a launch plan, shared brand work, parent landing page), it lives at this level — under `Neuvetra\docs\`.

---

## The Two Products at a Glance

### Terrascope
GHG emissions reporting chatbot for businesses. Calculates Scope 1/2/3 emissions and produces filings under California (SB 253, SB 261, CARB MRR) and EU (CSRD, ESRS E1) regulations. Two halves: a knowledge base (`wiki/`) that powers RAG and methodology lookup, and a codebase (`code/`) that runs the actual product. **Backend + DB + calculation engine real**; **frontend is a placeholder**.

### FrontDesk
AI voice front-desk for businesses. No knowledge base today — everything is in `code/`. **Frontend further along than Terrascope** (landing, auth, onboarding, legal pages, Playwright E2E tests).

---

## Shared Conventions Across Products

Both products' `code/` folders follow the same patterns. When in doubt, match across them:

- **Package manager:** Bun.
- **Monorepo:** Turborepo.
- **API framework:** Elysia, port 3000.
- **Frontend:** Vite + React 19 + React Router v7 + Tailwind v4.
- **ORM:** Drizzle.
- **Database:** Supabase (each product has its own Supabase project).
- **Type-safe client:** Eden — `export type App = typeof app` from `apps/api/src/index.ts`.
- **Env access:** typed through `apps/api/src/env.ts`, never hardcode keys.
- **AI:** Anthropic SDK, `claude-sonnet-4-6`.
- **Deploy target:** Railway (configs not yet committed in either product).

If a pattern emerges in one product that should apply to both, port it.

---

## Decided

- **2026-04-25 — Wiki retrieval store: Weaviate.** Native graph + vector in one store. The wiki exports to Weaviate for both semantic search and graph relationships.
- **2026-04-25 — Folder hierarchy:** All three repos consolidated under this `Neuvetra\` root with `code/` and `wiki/` subfolders per product. Each level has its own `CLAUDE.md` and `.claude/skills/`.

## Open Decisions (cross-product)

These need a call before downstream work locks them in. Tracked in `docs\2026-04-25-multi-product-launch-plan.md`.

1. **Parent landing site repo.** No repo exists for `neuvetra.com` / `neuvetra.ai`. Decide: new sibling under this root, or sub-route inside one of the existing products?
2. **Brand identity.** No design system, no logo, no copy guidelines, no shared component library. Both product apps currently have stub UIs.
3. **Auth & billing strategy.** Each product has its own Supabase project. Decide whether subscriptions are billed per-product (separate Stripe accounts/products) or via a single Neuvetra account with two product entitlements.
4. **Calculator implementation strategy.** The same 4 GHG calculation methodologies exist in both `Terrascope\wiki\calculations\` (Python) and `Terrascope\code\packages\calculator\` (TypeScript). Decide: Python is canonical and TS is generated/derived, TS is canonical and Python is deprecated, or they stay parallel with a sync discipline.

---

## Cross-Product Absolute Rules

1. **The wiki is for Terrascope only.** `FrontDesk\wiki\` exists as a placeholder; do not mix Terrascope wiki content into FrontDesk runtime.
2. **Keep the two product code stacks in lockstep.** Diverging Bun/Elysia/Drizzle/Tailwind versions across products creates pointless drift.
3. **Cross-product work goes in `docs/` at this level, not in a product folder.** Launch plans, brand assets, parent landing site code, shared design tokens — all here.
4. **Ask which product a request is about** if there's any ambiguity.
5. **CLAUDE.md cascades.** When working at a nested level, the most-specific `CLAUDE.md` applies, but you also inherit context from every CLAUDE.md above it. Read up the tree if you need broader context.
