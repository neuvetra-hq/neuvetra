# Terrascope — Project Operating Schema

> **Parent:** `..\CLAUDE.md` (Neuvetra business-wide). Read that first for the hierarchy and cross-product context.

---

## What Terrascope Is

A commercial SaaS chatbot that helps businesses calculate and report Scope 1, 2, and 3 greenhouse gas (GHG) emissions under California (SB 253, SB 261, CARB MRR) and EU (CSRD, ESRS E1) regulations. The chatbot serves both technical sustainability professionals and non-expert business owners, adapting depth to the question.

End goal: a paid subscription product that talks a visitor through their emissions inventory and produces filing-ready reports.

---

## Two Halves: Wiki and Code

Terrascope has **two distinct work surfaces** under this folder:

### `wiki/` — Knowledge base
The persistent, LLM-maintained source of truth for GHG accounting and reporting knowledge. Curated markdown pages (concepts, regulations, methodologies, sectors, organizations) plus raw source documents and emission factor data. Edited in Obsidian. Designed to export to Weaviate for runtime RAG.

When working in `wiki/`, read `wiki\CLAUDE.md` for the full operating schema (page types, frontmatter, ingest/query/lint workflows, factor layer, calculation engine layer).

### `code/` — Codebase
The Bun + Turborepo monorepo that runs the product: Elysia API, Vite + React frontend, Drizzle + Supabase, calculation engine in TypeScript.

When working in `code/`, read `code\CLAUDE.md` for the stack, dev commands, env, and runtime conventions.

### How they connect
- The chatbot's API (in `code/apps/api/`) calls Anthropic with a system prompt that grounds answers in wiki content; at runtime this becomes a Weaviate query.
- The calculation engine in `code/packages/calculator/` mirrors the methodologies in `wiki/calculations/` (Python). One of the open decisions at the business level is which is canonical.
- Emission factor CSVs live in `wiki/factors/processed/` and get loaded into the Supabase `emission_factors` table by `code/packages/database/src/seed-factors.ts`.

---

## Status Snapshot (last verified 2026-04-25)

| Surface | State |
|---|---|
| **Wiki content** | 106 pages, 39 ingested sources. EU layer is deepest (full ESRS Set 1, EFRAG IG 1/2/3). California complete (SB 253/261, CARB MRR, Cap-and-Trade). 5 PDFs unprocessed in `wiki/raw/` inbox. |
| **Wiki calculation engine (Python)** | Phase 1 + 2 complete. 4 methodologies (Scope 1 combustion, Scope 1 fugitive, Scope 2 location-based, Scope 2 market-based) + Inventory aggregator. 33 tests passing. |
| **Wiki git** | Index corrupted — `git log` and `git status` fail. Files intact. Needs index rebuild before further commits. |
| **Code API** | Real. Chat route runs 4-step pipeline (extract → calculate → format). `/companies` and `/reports` CRUD wired. Factors API live with regulatory_context filtering. |
| **Code calculator (TypeScript)** | Real. Same 4 methodologies as wiki Python. 9 test files, all passing. |
| **Code database** | 5 tables in Drizzle. 2,138 emission factors seeded. RLS enabled in Supabase but not versioned in migrations. |
| **Code frontend** | "Coming soon" placeholder. No chat UI, no auth, no Eden client wiring. |
| **Code deploy** | No Railway config. |

---

## Decisions Specific to Terrascope

- **Regulations covered first:** California (SB 253, SB 261, CARB MRR) + EU (CSRD, ESRS E1). Other jurisdictions tagged `status: expansion` in wiki frontmatter and filtered out for current phase.
- **Wiki retrieval store:** Weaviate (decided 2026-04-25 at business level).
- **Architectural commitment:** the LLM never does arithmetic. Every emission number returned to a user originates from a `CalculationResult` produced by a typed calculator function. See `wiki\CLAUDE.md` for details.

---

## Open Questions Specific to Terrascope

- Calculator duplication: Python (in wiki) vs TypeScript (in code) — see business-level open decision #4.
- Factor seeding reproducibility: `code/packages/database/src/seed-factors.ts` reads CSV paths via env var (set during restructure). The env var should be set in dev environments to point at `Neuvetra\Terrascope\wiki\factors\processed\`.
- Frontend is the largest visible gap — chat UI is not yet built.

---

## Working In Terrascope

Most requests will route to either `wiki/` or `code/`. If a request spans both (e.g., "add a new methodology"), the typical sequence is:

1. Add or update the methodology page in `wiki/wiki/methodologies/` with a `calculation_spec` frontmatter block.
2. Implement (or update) the corresponding calculator in `wiki/calculations/<function_id>.py` (the canonical Python version).
3. Mirror the change in `code/packages/calculator/src/methodologies/<name>.ts` if calculator-strategy decision keeps both implementations.
4. Run the test suites in both halves.
5. Commit in each git repo (wiki and code are separate git repos).

If the request is purely about content (new regulation, new factor source) → start in `wiki/`. If purely about runtime (new API route, frontend component) → start in `code/`.
