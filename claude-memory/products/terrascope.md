---
id: terrascope
type: product
title: "Neuvetra GHG — formerly Terrascope"
aliases: [Neuvetra GHG, TerraScope]
status: active
created: 2026-04-25
updated: 2026-09-08
discussed_in: [2026-09-08-neuvetra-ghg-focus]
related: [frontdesk, site, multi-product-launch, stack, supabase, weaviate, 2026-04-25-calculator-implementation-strategy, 2026-04-28-consolidate-into-single-monorepo, 2026-04-28-ghg-kb-confidence-provenance]
tags: [product]
---

# Terrascope

> **Current direction:** this historical page ID now refers to the GHG work being rebuilt as Neuvetra. TerraScope branding is retired, California/U.S. are the only initial jurisdictions, and every inherited claim/factor/method requires independent verification. The completion statements below are April history and are contradicted in several places by current source inspection. See [[2026-09-08-neuvetra-ghg-focus]] and [`the current roadmap`](../../docs/roadmap-neuvetra-ghg.md).

GHG emissions reporting chatbot. Subscription product that talks businesses through their emissions inventory and produces filing-ready reports.

## Positioning
Compliance + operational tool for SMBs subject to California (SB 253, SB 261, CARB MRR) and EU (CSRD, ESRS E1) reporting. Expansion-ready for US Federal, TCFD, ISSB, UK, Canada, Australia.

## Status (as of 2026-04-28 — full operational detail in `apps/terrascope-api/STATUS.md`)

- **Codebase home:** `apps/terrascope-api/` + `apps/terrascope-web/` + `packages/terrascope-database/` + `packages/terrascope-config/` + `packages/terrascope-calculator/` in the unified Neuvetra monorepo (was `Neuvetra/Terrascope/code/...` until 2026-04-28; was the only product without a GitHub remote pre-restructure).
- **GHG KB:** at `ghg-kb/` (top-level since 2026-04-26; absorbed into the monorepo 2026-04-28). 119 pages, 44 sources. EU + California complete.
- **Calculation engine (Python — reference spec):** Phase 1 + 2 complete. 4 methodologies + Inventory aggregator. 33 tests passing.
- **API:** real. 4-step `/chat` pipeline (extract → calculate → format). `/companies`, `/reports`, `/factors` wired.
- **TypeScript calculator:** 4 methodologies mirrored, 9 test files passing. Lives at `packages/terrascope-calculator/`.
- **Database:** 5 tables, 2,138 emission factors seeded (per audit), RLS on (not in migrations).
- **Frontend:** "coming soon" placeholder. Largest visible gap.
- **Deploy:** not yet deployed.
- **Defensibility moat workstream** (in flight 2026-04-28): confidence-tagged provenance for `ghg-kb` wiki body claims (Tier-2 inline `⟦E⟧` / `⟦I:0.7⟧` / `⟦A⟧` labels + per-claim markdown footnote footers) + dual-link source cards in chatbot UI. See [[2026-04-28-ghg-kb-confidence-provenance]] for the strategic call; brainstorm at Section 3 of 5 in [[2026-04-28-ghg-kb-provenance-design]]; spec doc + impl plan pending.

## Architectural commitment
The LLM never does arithmetic. Every emission number returned to a user originates from a typed `CalculationResult` produced by a calculator function.

## Tech
Standard Neuvetra stack — see [[stack]]. Notable additions:
- [[weaviate]] for KB retrieval (RAG + graph)
- Python calculation engine in parallel with TypeScript runtime — open: [[2026-04-25-calculator-implementation-strategy]]

## Critical regulatory facts
- **SB 253 first-year deadline:** August 10, 2026 (official, per §96076).
- **SB 261 enforcement:** suspended by Ninth Circuit injunction (2025-11-18) — CARB not enforcing until lifted.

## Open strategic questions
- Calculator implementation: Python canonical, TS canonical, or parallel → [[2026-04-25-calculator-implementation-strategy]]
- Brand alignment → [[2026-04-25-brand-identity]]

## Where the operational state lives
- **Operational status:** `apps/terrascope-api/STATUS.md` — build state, gaps, factor queue, audit findings (was `Neuvetra/Terrascope/status.md` until 2026-04-28).
- **GHG KB schema:** `ghg-kb/CLAUDE.md` (top-level; CLAUDE.md preserved per Karpathy LLM Wiki model — [[karpathy-llm-wiki]]).
- **Code:** `apps/terrascope-{api,web}/` and `packages/terrascope-{database,config,calculator}/`.

## Next
**Pre-Phase-3 gate** (resume next Terrascope session in this order, per `apps/terrascope-api/STATUS.md`):
1. Reconcile Supabase factor count — audit says 2,138 seeded vs `ghg-kb/factors/index.md` says "Loaded: No"
2. Fix `ghg-kb/factors/schema.sql` (3 missing columns/constraints) before any factor reload
3. Rebuild GHG KB git index (currently corrupted)
4. Update factor-CSV env var in `packages/terrascope-database/src/seed-factors.ts` to point at `ghg-kb/factors/processed/` (path was `Neuvetra/ghg-kb/factors/processed/` pre-monorepo; relative path may need adjustment)

**Then** Phase 3 (mobile combustion → Cat 1 spend → Cat 6 travel → boundary `inventory_config` → Cat 15 financed → AFOLU/baselines) and Weaviate export.

Will get an earthy/green Spirit preset when its frontend is built out — and triggers the Spirit-extraction event per [[2026-04-25-spirit-packaging]] (now a one-line workspace move in the monorepo).
