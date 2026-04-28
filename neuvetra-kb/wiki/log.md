# Neuvetra Public KB — Log

Chronological record of every INGEST, QUERY, and LINT operation against this wiki. Append-only, most recent at the top.

Entry format: `## [YYYY-MM-DD] <type> | <summary>`. Types: `ingest`, `query`, `lint`, `scaffold`.

---

## [2026-04-27] ingest | M2 cycle 2 — `products/frontdesk.md` + `products/terrascope.md` published; agent now reads from KB
**Trigger:** CEO directive "let's start" on the proposed scope of "feed the agent some material so it can answer what is Neuvetra / products / features / plans."
**Page type:** `product` × 2.
**Pages created:** [[products/frontdesk]] (FrontDesk product page, AI receptionist, all 7 canonical product sections), [[products/terrascope]] (Terrascope product page, AI emissions analyst, same canonical structure). Both authored from existing `claude-memory/products/*.md` strategic content + the brand-level wedge in [[overview]]. Industry-fit listings on FrontDesk derived from the existing FrontDesk codebase's industry presets (auto repair, cleaning, dealerships, chiropractic, accounting). Jurisdiction lists on Terrascope mirror the GHG KB's regulatory perimeter (California: SB 253 / SB 261 / CARB MRR; EU: CSRD / ESRS E1 / EU ETS).
**Public-safe flags raised:** none. Both pages cleared the eight-category checklist:
- Internal stack/vendors → not mentioned (no Retell, Twilio, Bun, Elysia, Stripe on FrontDesk; no Weaviate, Python engine on Terrascope).
- Internal cost numbers → none (plan pages deferred until pricing is set).
- Team identities → none.
- Unshipped roadmap by name → none ("more specialists on the way" stays at the brand-level overview, not on product pages).
- Sales playbook content → none (no objection-handling tactics, no "we always say X").
- Customer names → none.
- Named competitors → none (Terrascope's regulations are factual; alternatives are framed as "you don't have to learn the GHG Protocol or hire a consultant" — category, not company).
- Internal codenames → none.
**Cross-track change:** `Site/apps/api/scripts/sync-kb-corpus.ts` (new) reads every `visibility: public` page from `wiki/` and emits `Site/apps/api/src/generated/kb-corpus.ts`. The greeter agent's system prompt now includes the full corpus as a `=== KNOWLEDGE BASE ===` block. The sync script is the bridge between this wiki (which is *not* in the Site repo) and the deployed API. Workflow: edit page → `bun run sync-kb` from `Site/apps/api/` → commit the regenerated TS file → push → Railway redeploys with the new corpus baked in.
**Raw mirror:** none (Policy A — content authored conversationally inside the broader Site dev session; this log entry is the durable trace).

## [2026-04-26] ingest | M2 cycle 1 — brand `overview.md` published with wedge "AI specialists for every job in your business"
**Trigger:** CEO directive "let's do item 1, neuvetra-kb M2" + Adobe brand-architecture study + wedge selection ("AI specialists for every job in your business").
**Page type:** `overview` (brand-level, `products: []`).
**Pages created:** none net-new (M1 placeholder updated). **Pages updated:** [[overview]] — promoted from `visibility: draft` to `public`; full body authored against the canonical `product` heading structure (## What It Is / ## Who It's For / ## How It Works / ## Key Features / ## Plans / ## Common Questions / ## Related). Wedge bold-anchored on first line for embedding retrieval. Wikilinks to [[products/frontdesk]] and [[products/terrascope]] form Weaviate edges (those product pages don't exist yet — next M2 cycle). `Site/apps/web/src/App.tsx` homepage slogan updated to the full wedge in the same session (cross-track Site change, not a KB edit but linked by wedge consistency).
**Public-safe flags raised:** none. Checklist clean — no internal stack/vendor names, no internal cost numbers, no team identities, no unshipped features by name (the "more specialists are on the way" line is a category-level horizon statement, not a named feature commitment), no sales playbook content, no customer names, no named competitors (alternatives are framed as categories: "hire it / build it / configure it"), no internal codenames.
**Raw mirror:** [[2026-04-26-overview-wedge-and-draft]] (Policy A — deletable post-synthesis; log entry retains the trace).

## [2026-04-26] scaffold | M1 directory + CLAUDE.md scaffold landed
**Trigger:** "Let's do it" (CEO sign-off on the staged `CLAUDE.md` draft after PRD review).
Pages created: none (this is structural — empty wiki). Files written: `CLAUDE.md`, `wiki/index.md`, `wiki/log.md`, `wiki/overview.md`, per-folder `README.md` × 9, `raw/conversations/README.md`. M1 done per `docs/superpowers/specs/2026-04-26-neuvetra-kb-design.md` § Success Criteria. Next: M2 — content authored conversationally with the CEO via public-KB triggers.
