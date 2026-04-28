---
id: terrascope
type: product
status: active
created: 2026-04-25
updated: 2026-04-25
related: [frontdesk, multi-product-launch, stack, weaviate, 2026-04-25-calculator-implementation-strategy]
tags: [product]
---

# Terrascope

GHG emissions reporting chatbot. Subscription product that talks businesses through their emissions inventory and produces filing-ready reports.

## Positioning
Compliance + operational tool for SMBs subject to California (SB 253, SB 261, CARB MRR) and EU (CSRD, ESRS E1) reporting. Expansion-ready for US Federal, TCFD, ISSB, UK, Canada, Australia.

## Status (as of 2026-04-25 — full detail in `Terrascope\status.md`)
- **Wiki content:** 106 pages, 39 sources ingested. EU + California complete. PCAF Cat 15 done. 5 PDFs unprocessed in inbox.
- **Wiki calculation engine (Python — reference spec):** Phase 1 + 2 complete. 4 methodologies + Inventory aggregator. 33 tests passing.
- **API:** real. 4-step `/chat` pipeline (extract → calculate → format). `/companies`, `/reports`, `/factors` wired.
- **TypeScript calculator:** 4 methodologies mirrored, 9 test files passing.
- **Database:** 5 tables, 2,138 emission factors seeded, RLS on (not in migrations).
- **Frontend:** "coming soon" placeholder. Largest visible gap.
- **Deploy:** no Railway config.

## Architectural commitment
The LLM never does arithmetic. Every emission number returned to a user originates from a typed `CalculationResult` produced by a calculator function.

## Tech
Standard Neuvetra stack — see [[stack]]. Notable additions:
- [[weaviate]] for wiki retrieval (RAG + graph)
- Python calculation engine in parallel with TypeScript runtime — open: [[2026-04-25-calculator-implementation-strategy]]

## Critical regulatory facts
- **SB 253 first-year deadline:** August 10, 2026 (official, per §96076).
- **SB 261 enforcement:** suspended by Ninth Circuit injunction (2025-11-18) — CARB not enforcing until lifted.

## Open strategic questions
- Calculator implementation: Python canonical, TS canonical, or parallel → [[2026-04-25-calculator-implementation-strategy]]
- Brand alignment → [[2026-04-25-brand-identity]]
- Billing model → [[2026-04-25-auth-billing-strategy]]

## Where the operational state lives
- **Operational status:** `Neuvetra\Terrascope\status.md` (build state, gaps, factor queue, audit findings)
- **GHG KB schema:** `Neuvetra\ghg-kb\CLAUDE.md` (top-level since 2026-04-26; was `Neuvetra\Terrascope\ghg-kb\CLAUDE.md`)
- **Code:** `Neuvetra\Terrascope\code\` — see `code\CLAUDE.md`

## Next
- Phase 1 cleanup: Drizzle migrations, schema columns (`unit_class`, `input_unit_canonical`), RLS in migrations.
- Process 5 inbox PDFs (LCFS, GHG Protocol Land/Removals, IPCC AR6 Ch7, EU CBAM, EU Taxonomy).
- Ship a real frontend.
- Resolve calculator strategy.
