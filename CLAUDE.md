# Neuvetra — Business Operating Schema

> **You are at the top of the Neuvetra hierarchy.** Read this file first whenever a request touches "the company," "the products," or anything cross-product. CLAUDE.md cascades down — at any nested level, the most-specific CLAUDE.md applies, but the context from this file is always inherited.

---

## The Hierarchy

```
Neuvetra/                       ← business root (this file)
├── CLAUDE.md                   ← business-wide overview & memory
├── claude-memory/              ← Claude's persistent C-level memory store (renamed from `wiki/` 2026-04-26 — same store, more meaningful name)
│   ├── CLAUDE.md               ← memory schema + memory-first protocol + graph-query model
│   ├── index.md, log.md, next.md, overview.md
│   ├── raw/                    ← immutable conversation + inbox layer
│   ├── people/, products/, features/, decisions/, plans/, tech/, brand/, meetings/
│   └── audience/, market/, sales/, marketing/, ideas/, metrics/, risks/, topics/  ← business-domain buckets (taxonomy expanded 2026-04-25)
├── neuvetra-kb/                ← Public salesperson knowledge base (scaffolded 2026-04-26; brand-level RAG)
│   ├── CLAUDE.md               ← maintainer manual: page types, schema, trigger vocabulary, public-safe gate, workflows
│   ├── raw/conversations/      ← CEO-authoring conversation mirror (Policy A: deletable post-synthesis)
│   ├── wiki/                   ← page-type folders (products, features, plans, use-cases, integrations, comparisons, objections, faqs, stories) + index/log/overview
│   └── .claude/skills/         ← KB-specific skills (empty until needs surface)
├── .claude/skills/             ← business-wide skills
├── docs/                       ← cross-product specs and authored artifacts
│
├── ghg-kb/                     ← Terrascope domain RAG (regulations, methodologies, factor data — DATA INTEGRITY CRITICAL); elevated to root 2026-04-26
│   ├── CLAUDE.md               ← KB schema, ingestion/query workflows, integrity rules
│   └── .claude/skills/         ← KB-specific skills
│
├── Terrascope/                 ← GHG emissions reporting product (codebase only — KB elevated to root 2026-04-26)
│   ├── CLAUDE.md               ← Terrascope project memory (read second when working in Terrascope)
│   ├── status.md               ← Terrascope operational state (build, queues, audit findings)
│   ├── .claude/skills/         ← Terrascope-specific skills
│   └── code/                   ← codebase (apps, packages)
│       ├── CLAUDE.md           ← code stack, dev commands, conventions
│       └── .claude/skills/     ← code-specific skills
│
├── FrontDesk/                  ← AI voice front-desk product
│   ├── CLAUDE.md               ← FrontDesk project memory
│   ├── .claude/skills/         ← FrontDesk-specific skills
│   ├── wiki/                   ← REDUNDANT under wiki-architecture policy (2026-04-25), slated for review
│   │   ├── CLAUDE.md           ← placeholder + future structure guidance
│   │   └── .claude/skills/
│   └── code/                   ← codebase (apps, packages)
│       ├── CLAUDE.md           ← code stack, dev commands, conventions
│       └── .claude/skills/     ← code-specific skills
│
└── Site/                       ← parent landing surface for neuvetra.com / .ai (scaffolded 2026-04-25)
    ├── CLAUDE.md               ← Site code stack, dev commands, conventions
    ├── package.json, turbo.json, tsconfig.base.json, bun.lock
    └── apps/
        ├── api/                ← Elysia + CORS + /health, port 3000
        └── web/                ← Vite + React 19 + Tailwind v4, port 5173
```

**Hierarchy notes (2026-04-25 / -26):**
- **All three knowledge stores are top-level siblings** of `Site/`, `FrontDesk/`, and `Terrascope/` (consolidated 2026-04-26 — see `claude-memory\meetings\2026-04-26-ghg-kb-elevation.md`):
  - `claude-memory/` — C-level memory (renamed from `wiki/` 2026-04-26).
  - `neuvetra-kb/` — brand-level public-salesperson RAG.
  - `ghg-kb/` — Terrascope product-domain RAG (was `Terrascope/ghg-kb/` until 2026-04-26).
  Memory wikis live only at root (per `claude-memory/decisions/2026-04-25-wiki-architecture-policy.md`). Domain RAGs sit at root by convention now too — even though `ghg-kb` is product-scoped to Terrascope, putting all KBs at the same level keeps mental and on-disk model symmetric.
- **`Site/` has no `code/` subdirectory** — Site IS the code root. No knowledge-base sibling planned, so the `code/` level is dropped.
- **`Site/` has no `wiki/` subdirectory.** Same applies to FrontDesk and Terrascope — no product carries an embedded `wiki/` or `kb/`.
- **`FrontDesk/wiki/` is redundant** historical placeholder, slated for review.
- **`Terrascope/` now contains only the codebase + project-state files** (`CLAUDE.md`, `status.md`, `code/`). The ghg-kb that used to live inside it is now at root.

**Domains:** `neuvetra.com`, `neuvetra.ai`. Currently a FrontDesk surface (live, Railway). Will re-point to `Site/` once parent-landing content ships; FrontDesk migrates to a subdomain. See `claude-memory/products/site.md`.

**Both products are subscription-based chatbots.** They greet a visitor, ask what they need, gather context, and convert them to a paid subscription. Independent products under a shared brand. **`Site/`** is the parent landing surface that frames them as siblings of one brand.

---

## The C-Level Memory Store (`claude-memory/`)

**`Neuvetra\claude-memory\` is Claude's persistent memory across sessions, and by virtue of that, the SOLE memory store for everything strategic about Neuvetra** — decisions, plans, products, features, brand, tech-stack rationale, audience, market, sales, marketing, ideas, metrics, risks. Established 2026-04-25; taxonomy expanded and declared sole memory store + claimed as Claude's memory 2026-04-25 (see `claude-memory\meetings\2026-04-25-skill-and-wiki-framework.md` § Decisions 1 and 2).

> **The wiki is Claude's, not the CEO's.** Claude (CFO/CPO/CTO hats) owns its structure, schema, depth of detail, and lifecycle. The CEO talks, asks, decides; Claude synthesizes into the wiki for its own future-self recall. Optimize the wiki for Claude's recall first; chatbot queryability follows from the same structure.

> **Override:** Claude Code's per-project memory directory (`~/.claude/projects/<encoded-cwd>/memory/`) is **OFF** for any work in or under `Neuvetra/`. The "auto memory" section of the system prompt is overridden by `claude-memory\meetings\2026-04-25-skill-and-wiki-framework.md` § Decision 1. Behavioral preferences, user/project facts, references — all of it goes into the wiki (typed by page type) plus skill-guidance lines in the relevant `CLAUDE.md`. Never read from or write to the per-project memory dir for Neuvetra work.

Operating model:
- The **CEO** (Nima) talks, asks, decides. Does not manage the wiki day-to-day.
- **Claude** (CFO/CPO/CTO hats) writes and maintains the wiki, saves proactively when context surfaces that's worth recalling, recalls from the wiki before answering any Neuvetra question.
- Every material C-level chat produces a wiki delta — `log.md` entry minimum, full meeting note when material — under the lifecycle policies (don't proliferate; update existing; raw is disposable).

**Wiki-first protocol — before answering any Neuvetra question:**
1. Read `Neuvetra\claude-memory\index.md` to find relevant pages.
2. Read those pages plus any `[[linked]]` ones needed.
3. Read `Neuvetra\claude-memory\log.md` if the question is about recency.
4. Cite the wiki pages used in the answer.
5. After the conversation, propagate updates back into the wiki.

If the wiki has no answer, say so explicitly — don't fabricate.

**Boundary with product knowledge:**
- The C-level wiki is **strategic** (cross-cutting decisions, plans, brand, product POVs).
- Product-operational state lives with the product — `Terrascope\status.md`, `FrontDesk\CLAUDE.md`. The Terrascope domain RAG (`ghg-kb\`, root level) is operational/data-integrity work, not strategic memory — also outside this wiki.
- Don't mix the two — different lifecycles, different audiences.

See `Neuvetra\claude-memory\CLAUDE.md` for the full schema, page types, and conventions.

### Save protocol — "save", "update memory", "log this"

When the CEO says any of these (or close variants), treat it as a request to **persist the current conversation into the wiki via the raw-first flow** ([[2026-04-25-wiki-raw-layer]]):

- "save" / "save memory" / "save to memory"
- "update memory" / "update wiki" / "save to wiki"
- "log this" / "write this up"

**Raw-first principle:** the conversation lands in `claude-memory\raw\conversations\YYYY-MM-DD-slug.md` immutably **before** any synthesis. The raw is the audit trail; the curated wiki is the synthesis.

Workflow (full version in `claude-memory\CLAUDE.md` § Workflow 1 — INGEST):

1. **Find the save horizon.** Open `claude-memory\log.md` — the most recent `ingest` entry marks where the last save left off.
2. **Write the raw.** Create `claude-memory\raw\conversations\YYYY-MM-DD-slug.md` (frontmatter `type: conversation`, `id:`, `hats:`). Heading structure: Metadata, Topics covered, Key statements, Files referenced, Decisions raised, Action items, Open questions.
3. **Synthesize per page type** (only if material): `meetings\` for non-trivial discussions, `decisions\` for raised / made decisions, `plans\` for new initiatives, `features\` for features, `topics\` / `brand\` / `tech\` for concept updates. Each synthesized page references the raw via `sources:`.
4. **Update typed relationships** in frontmatter — `related`, `mentions`, `discussed_in`, `decided_in`, `sources`. The wiki is a graph; keep edges current.
5. **Update navigation** — `index.md`, `next.md`, `overview.md`. Bump `Last updated:`.
6. **Append `claude-memory\log.md`.** Required every save so the next horizon is known.
7. **Report** with `computer://` links.

Detailed instructions live at `Neuvetra\.claude\skills\save-claude-memory\SKILL.md`. The point of routing through this section in the cascading `CLAUDE.md` is that every save behaves the same way regardless of which Claude surface (Code, Desktop, Cowork) handles it.

What this protocol does **not** touch: product code, `Terrascope\status.md`, `FrontDesk\CLAUDE.md`, or either of the two RAGs (`ghg-kb\`, `neuvetra-kb\`). Different stores, different workflows.

---

## Self-Awareness Rule

When the user says "my project" or talks about Neuvetra without qualifier, default to the most specific level you can infer. If unclear, ask before acting.

| User says | They probably mean |
|---|---|
| "the company" / "the business" / "Neuvetra" | This level — top-of-tree |
| "the C-level memory" / "claude memory" / "Claude's memory" / "our memory" / "the memory" / "the wiki" (legacy) / "decisions" / "plans" / strategic anything | `Neuvetra\claude-memory\` (sole memory store; renamed from `wiki/` 2026-04-26) |
| "the GHG KB" / "the factors" / "Terrascope KB" / "Terrascope wiki" | `Neuvetra\ghg-kb\` (top-level since 2026-04-26; was `Neuvetra\Terrascope\ghg-kb\`) |
| "the public KB" / "the salesperson knowledge" / "neuvetra-kb" / "what the chatbot knows" / "the pitch wiki" | `Neuvetra\neuvetra-kb\` |
| "the knowledge base" alone | **Ask** — could be `Terrascope\ghg-kb\` (Terrascope domain expertise) or `neuvetra-kb\` (brand/product sales). |
| "the wiki" alone (legacy term) | **Almost always `Neuvetra\claude-memory\`** (renamed from `wiki/` 2026-04-26 — the term still resolves to this memory store). If the conversation is clearly Terrascope-domain, the GHG KB is also possible. If the conversation is clearly about public/marketing/sales content, `neuvetra-kb` is also possible. Ask if ambiguous. |
| "FrontDesk" / "the receptionist" / "the voice product" | `Neuvetra\FrontDesk\` (and usually `code\` within it) |
| "Terrascope" / "the emissions product" / "GHG" / "carbon" | `Neuvetra\Terrascope\` |
| "Site" / "the parent landing" / "the landing site" / "neuvetra.com site" | `Neuvetra\Site\` (no `code/` subdir — Site IS the code root) |
| "the code" / "the API" / "the backend" / "the frontend" | the relevant `code\` subfolder of whichever product is in scope (or `Site\apps\{api,web}\` if Site is in scope) |
| "my project" with no other clue | **Ask before acting** |

If the request crosses products: **strategic work** (decisions, plans, brand thinking, product positioning) lives in `Neuvetra\claude-memory\`. **Authored artifacts** (specs, launch-plan documents, brand assets, design tokens) live in `Neuvetra\docs\`.

---

## The Two Products at a Glance

### Terrascope
GHG emissions reporting chatbot for businesses. Calculates Scope 1/2/3 emissions and produces filings under California (SB 253, SB 261, CARB MRR) and EU (CSRD, ESRS E1) regulations. Two halves now living at the same hierarchical level: a knowledge base at `Neuvetra\ghg-kb\` (powers RAG + methodology lookup; was `Terrascope\ghg-kb\` until 2026-04-26) and a codebase at `Neuvetra\Terrascope\code\` (runs the product). **Backend + DB + calculation engine real**; **frontend is a placeholder**.

Strategic view: `claude-memory\products\terrascope.md`. Operational status: `Terrascope\status.md`.

### FrontDesk
AI voice front-desk for businesses. No knowledge base today — everything is in `code/`. **Frontend further along than Terrascope** (landing, auth, onboarding, legal pages, Playwright E2E tests).

Strategic view: `claude-memory\products\frontdesk.md`.

---

## Shared Conventions Across Products

Both products' `code/` folders follow the same patterns. When in doubt, match across them. Strategic detail lives in `claude-memory\tech\stack.md`.

- **Package manager:** Bun.
- **Monorepo:** Turborepo.
- **API framework:** Elysia, port 3000.
- **Frontend:** Vite + React 19 + React Router v7 + Tailwind v4.
- **ORM:** Drizzle.
- **Database:** Supabase (each product has its own Supabase project).
- **Type-safe client:** Eden — `export type App = typeof app` from `apps/api/src/index.ts`.
- **Env access:** typed through `apps/api/src/env.ts`, never hardcode keys.
- **AI:** Anthropic SDK, `claude-sonnet-4-6`.
- **Deploy target:** Railway. **FrontDesk is live in production at `neuvetra.com`** (`neuvetra.ai` DNS-aliases to `neuvetra.com`). Terrascope not yet deployed. **Railway configs ARE committed in-repo** for FrontDesk (`apps/{api,web}/railway.toml` + `Dockerfile`); same pattern carried into `Site/` per `claude-memory/meetings/2026-04-25-site-scaffold.md`. Resolved 2026-04-25.

If a pattern emerges in one product that should apply to both, port it.

---

## Decided

- **2026-04-25 — C-level wiki established at `Neuvetra\claude-memory\`.** Source of truth for cross-product strategy, decisions, plans. See `claude-memory\decisions\2026-04-25-establish-c-level-wiki.md`.
- **2026-04-25 — Wiki retrieval store: Weaviate.** Native graph + vector in one store. The Terrascope GHG KB exports to Weaviate for both semantic search and graph relationships.
- **2026-04-25 — Folder hierarchy:** All repos consolidated under this `Neuvetra\` root. Terrascope had `code/` + `ghg-kb/` (later elevated 2026-04-26); FrontDesk has `code/` + `wiki/` (placeholder, now redundant); **Site has neither** (see wiki-architecture policy below). Each level has its own `CLAUDE.md` and `.claude/skills/`.
- **2026-04-25 — Terrascope knowledge base renamed `wiki\` → `ghg-kb\`.** Flags its data-integrity-critical RAG role and disambiguates from the C-level `wiki\` and the empty `FrontDesk\wiki\` placeholder. See `claude-memory\log.md`.
- **2026-04-26 — `ghg-kb` elevated to root** as a top-level sibling of `wiki\` and `neuvetra-kb\`. All three knowledge stores now live at the same hierarchical level; product folders (`Terrascope/`, `FrontDesk/`, `Site/`) hold codebases only. The product-domain RAG is still Terrascope-scoped in content, just no longer in path. See `claude-memory\meetings\2026-04-26-ghg-kb-elevation.md`.
- **2026-04-25 — The Spirit is the Neuvetra brand icon (for now).** A curl-noise-driven Three.js particle field with an XState behavior machine, currently living in `FrontDesk\code\apps\web\src\lib\spirit\`. Becomes a Neuvetra-level asset; static-mark / logotype counterpart still TBD. See `claude-memory\decisions\2026-04-25-spirit-as-brand-icon.md` and `claude-memory\brand\spirit.md`.
- **2026-04-25 — Parent landing site lives in a new sibling codebase under `Neuvetra\`.** Closes the previously-open parent-landing-site question in favor of Option 1 (new sibling repo). See `claude-memory\decisions\2026-04-25-parent-landing-site.md` and `claude-memory\features\parent-landing-experience.md`.
- **2026-04-25 — Site directory name + scaffolded.** Parent landing codebase lives at `Neuvetra\Site\` (capital S, no `code/` subdir, no `wiki/` subdir). Empty Turborepo (Bun + Elysia + Vite + React 19 + Tailwind v4), `/health` live, Three.js + XState installed for next-cycle Spirit work. 10 commits on `main`. See `claude-memory\products\site.md` and `claude-memory\meetings\2026-04-25-site-scaffold.md`.
- **2026-04-25 — Spirit packaging: copy when added; defer extraction to 3rd consumer.** When Terrascope's frontend lights up, that's the cue to extract the Spirit into a shared package. Until then, copy. See `claude-memory\decisions\2026-04-25-spirit-packaging.md`.
- **2026-04-25 — Wiki-architecture policy: memory wikis live only at the Neuvetra root.** `Neuvetra\claude-memory\` is the SOLE memory store across all C-level conversation. Domain RAGs are a different category (purpose: product/brand RAG, not memory). `FrontDesk\wiki\` placeholder is redundant under this policy and slated for review. Site has no `wiki/`. See `claude-memory\decisions\2026-04-25-wiki-architecture-policy.md`. **Spatial framing extended 2026-04-26:** all knowledge stores now sit at the Neuvetra root (`wiki\`, `neuvetra-kb\`, `ghg-kb\`) — see Decided 2026-04-26 below.
- **2026-04-25 — Wiki is the sole memory store; Claude Code per-project memory dir is OFF for Neuvetra work.** Auto-memory section of the system prompt is overridden. Behavioral preferences, facts, references all land in the wiki (typed pages) plus skill-guidance lines in CLAUDE.md. See `claude-memory\meetings\2026-04-25-skill-and-wiki-framework.md` § Decision 1.
- **2026-04-25 — Wiki taxonomy expanded by seven business-domain buckets.** Added `audience/`, `market/`, `sales/`, `marketing/`, `ideas/`, `metrics/`, `risks/`. `topics/` redefined as last-resort. New "Wiki as a Graph" section in `claude-memory/CLAUDE.md` formalizes the ranking algorithm and adds Pattern C (ranking queries) to the QUERY workflow. INGEST tightened with the five-question relationship-typing discipline. See `claude-memory\meetings\2026-04-25-skill-and-wiki-framework.md` § Decision 2.
- **2026-04-25 — Skill management operating model: install all at user level; select at runtime.** All plugin and authored skills are user-level (global). Claude self-selects based on directory + conversation context, guided by per-level CLAUDE.md "Skills to reach for at this level" sections. No per-project skill configuration. See `claude-memory\meetings\2026-04-25-skill-and-wiki-framework.md`.
- **2026-04-25 — Wiki lifecycle policy: don't proliferate nodes.** (A) Raw conversations are deletable post-synthesis (write → synthesize → verify → delete; log entry retains the trace). (B) Update existing pages by default; create new only when no existing page absorbs the content. (C) Decision-page minimization: same-day-closed schema/policy/operational calls fold into the meeting note's `## Decisions` section; standalone `decisions/` pages reserved for cross-cutting architectural ADRs. Codified in `claude-memory/CLAUDE.md` § Workflow 1.
- **2026-04-26 — `Neuvetra\neuvetra-kb\` scaffolded** as the brand-level public salesperson RAG. PRD signed off (`docs\superpowers\specs\2026-04-26-neuvetra-kb-design.md`); M1 directory tree + maintainer `CLAUDE.md` (page types, schema, trigger vocabulary, public-safe boundary, INGEST/QUERY/LINT workflows) landed empty. M2 is conversational content authoring; M3 exports to Weaviate; M4 wires the salesperson chatbot to the homepage `Ask anything` input. Trigger-vocabulary boundary between memory (`Neuvetra\claude-memory\`) and the public KB is the new operational rule of the day. See `claude-memory\meetings\2026-04-26-neuvetra-kb-design.md`.

## Open Decisions (cross-product)

These need a call before downstream work locks them in. Each has its own page in the C-level wiki under `claude-memory\decisions\`. The parent initiative is `claude-memory\plans\multi-product-launch.md`; the source spec is `docs\superpowers\specs\2026-04-25-multi-product-launch-plan.md`.

1. **Brand identity (remaining)** — partially anchored on the Spirit; logotype, type scale, palette spec, voice/tone still open. See `claude-memory\decisions\2026-04-25-brand-identity.md`.
2. **Auth & billing strategy** — see `claude-memory\decisions\2026-04-25-auth-billing-strategy.md`.
3. **Calculator implementation strategy** — see `claude-memory\decisions\2026-04-25-calculator-implementation-strategy.md`.

## In Flight

- **Site (parent landing) cycle 2** — copy the Spirit (`lib/spirit/*` + `data/spirit-presets.ts` + `public/audio/*`) from `FrontDesk\code\apps\web\` into `Site\apps\web\` per `claude-memory\decisions\2026-04-25-spirit-packaging.md`. Then cycles 3–6 add real content, chatbots, domain re-routing, mobile/a11y. Build spec: `claude-memory\features\parent-landing-experience.md` (Open Q3–Q10). Note: `Site\` homepage v1 already shipped on `feat/homepage-v1` — Spirit + wordmark + slogan + product cards + ChatGPT-style chat input + Lighthouse 100 mobile (8 commits, branch not yet merged).
- **`neuvetra-kb` M2 — conversational content authoring.** Empty wiki today; first content lands when the CEO issues a public-KB trigger ("let's update our users about [X]"). Likely first targets: brand-level "what is Neuvetra", `frontdesk` product page, `terrascope` product page, FrontDesk plans (currently being decided as part of `[[2026-04-25-auth-billing-strategy]]`).

---

## Cross-Product Absolute Rules

1. **Three knowledge stores at root, three roles** — keep them separated (per `claude-memory\decisions\2026-04-25-wiki-architecture-policy.md` + the elevation in `claude-memory\meetings\2026-04-26-ghg-kb-elevation.md`):
   - `Neuvetra\claude-memory\` — **the SOLE memory wiki.** C-level strategy + conversation memory across every level (FrontDesk, Terrascope, Site, brand, plans). Internal-only forever.
   - `Neuvetra\neuvetra-kb\` — **the brand-level public-salesperson RAG** (scaffolded 2026-04-26 per `claude-memory\meetings\2026-04-26-neuvetra-kb-design.md`). Brand, product, plan, feature, use-case, comparison, objection, FAQ, story pages. Authored conversationally with the CEO, public-safe gated, exported to Weaviate. **PUBLIC-SAFE CRITICAL — every write clears the public-safe checklist before disk.**
   - `Neuvetra\ghg-kb\` — **the Terrascope product-domain RAG** (regulations, methodologies, factor data). Elevated to root 2026-04-26 (was `Neuvetra\Terrascope\ghg-kb\`). Document-driven ingestion → graph DB → product-RAG chatbot. **DATA INTEGRITY CRITICAL — RAG source. Do not edit casually.**
   - `Neuvetra\FrontDesk\wiki\` — historical placeholder, redundant, slated for review.
   - **No `wiki/` or `kb/` subdirs under any product or codebase.** New memory goes to `Neuvetra\claude-memory\`. New RAGs go at root.

   **Trigger vocabulary keeps memory and `neuvetra-kb` apart.** Memory triggers ("save", "save this", "log this", "update memory") write only to `Neuvetra\claude-memory\`. Public-KB triggers ("let's update our users", "publish this", "add to the public KB") write only to `Neuvetra\neuvetra-kb\`. **Never auto-bridge in either direction.** When in doubt, default to memory and ask. See `Neuvetra\neuvetra-kb\CLAUDE.md` § Trigger Vocabulary for the full list.

   Don't mix content across stores.
2. **Keep the code stacks in lockstep across `FrontDesk\code\`, `Terrascope\code\`, and `Site\`.** Diverging Bun/Elysia/Drizzle/Tailwind/Vite/React/RR versions creates pointless drift.
3. **Cross-product work splits two ways:**
   - **Strategic** (decisions, plans, brand thinking, product positioning, conversation memory) → `Neuvetra\claude-memory\`.
   - **Authored artifacts** (PRDs, launch-plan documents, design assets, specs, plans) → `Neuvetra\docs\`.
4. **Ask which product / codebase a request is about** if there's any ambiguity. ("Site" is the parent landing surface; "FrontDesk" / "Terrascope" are the products.)
5. **CLAUDE.md cascades.** When working at a nested level, the most-specific `CLAUDE.md` applies, but you also inherit context from every CLAUDE.md above it. Read up the tree if you need broader context.
6. **Wiki-first protocol** — before answering any Neuvetra question, check `Neuvetra\claude-memory\index.md` and `claude-memory\log.md` first. See "The C-Level Wiki" section above.
7. **Bun-only across `Site\`** (and a strong default across all code stacks). `bun add` / `bun remove` for installs, `bunx` for one-off tool runs. No `npm` / `pnpm` / `npx` in `Site\`. See `Site\CLAUDE.md`.

---

## Skills to reach for at this level

> **Operating model** ([[2026-04-25-skill-and-wiki-framework]]): all skills are installed at user level (global). Selection is runtime, by Claude, based on the directory context + the conversation. The lists below are *guidance* — hints about which skills typically fit work at this level. Read up the cascade for inherited skill guidance from parent CLAUDE.md files; nested levels add more specific skills.

When working at the **Neuvetra root** (cross-product strategy, planning, brand thinking, sales / marketing / audience / risk strategy, business-level conversations), reach for:

- **Strategy & writing:** `superpowers:brainstorming`, `superpowers:writing-plans`, `write-a-prd`, `prd-to-issues`, `grill-me`, `improve-codebase-architecture`.
- **State-machine design (when modeling business workflows):** `statechart-design`, `actor-model` (design phase only — implementation skills live at the code level).
- **Telemetry / product strategy:** `product-tracking-skills:product-tracking-business-case`, `product-tracking-skills:product-tracking-design-tracking-plan`, `product-tracking-skills:product-tracking-model-product`.
- **Wiki ingestion:** authored skill at `Neuvetra/.claude/skills/save-wiki/`.
- **Live docs (any topic):** `mcp__plugin_context7_context7__query-docs` and `resolve-library-id` — preferred over web search for library/SDK/framework docs at any level.
- **Process meta:** `superpowers:using-superpowers`, `superpowers:dispatching-parallel-agents`, `superpowers:finishing-a-development-branch`.

Engineering-implementation skills (XState v5 syntax, React, Three.js, Supabase, etc.) are **not** the right fit at this level — pick those at the relevant `code/` or `Site/apps/{web,api}/` level. See those `CLAUDE.md` files for guidance.
