# Terrascope — Operational Status

> **Strategic view:** see `Neuvetra\claude-memory\products\terrascope.md`.
> **This file:** current build state, gaps, queues, audit findings — operational detail that changes session-to-session.
>
> Last consolidated: 2026-04-25 (post 5-source inbox-clearing ingest + Workflow 3 lint pass; KB migration-ready).

---

## Stack reminder
Bun 1.2 + Turborepo + React 19 + Vite + Elysia + Drizzle + Supabase project `jfjbiqeplnbxkadqnimt` (us-west-1) + Anthropic Claude SDK + Railway. Mirrors FrontDesk stack.

PRD: `Terrascope\code\docs\prd-terrascope-phase1-3.md`.

---

## Current state (audited 2026-04-25)

### GHG KB content
- **119 pages, 44 sources ingested.** EU layer now the deepest (full ESRS Set 1, EFRAG IG 1/2/3, EU ETS + Phase 4 Revision Directive 2023/959, CBAM, EU Taxonomy parent + Climate Delegated Act). California complete (SB 253, SB 261, CARB MRR, Cap-and-Trade, **LCFS added 2026-04-25**). PCAF Cat 15 done.
- **Inbox EMPTY** as of 2026-04-25. Workflow 3 lint pass GREEN after a 17-edge prefix-strip cleanup; KB is migration-ready for the Supabase + Weaviate write paths.

### GHG KB calculation engine (Python — canonical reference)
- **Phase 1 + 2 complete.** 4 methodologies (Scope 1 combustion, Scope 1 fugitive, Scope 2 location-based, Scope 2 market-based) + Inventory aggregator.
- 33 tests passing.

### GHG KB git
- **Index corrupted** — `git log` and `git status` fail. Files intact. Needs index rebuild before further commits.

### Code API
- Real. `/chat` runs the 4-step pipeline (extract → calculate → format).
- `/companies`, `/reports`, `/factors` CRUD wired. Factors API has `regulatory_context` filtering.

### Code calculator (TypeScript runtime)
- 4 methodologies mirrored from Python. 9 test files passing.

### Code database
- 5 tables in Drizzle (`emission_factors`, `companies`, `users`, `company_members`, `ghg_reports`) + 2 enums.
- 2,138 emission factors seeded *(reconcile: factor-processing memory says zero — verify on next factor session)*.
- RLS enabled in Supabase but **not versioned in migrations** — fix needed.
- Schema missing 3 columns the audit called out: `unit_class`, `input_unit_canonical`, `required_by` enum constraint.

### Code frontend
- "Coming soon" placeholder. **Largest visible gap.**

### Code deploy
- No Railway config.

---

## Critical live regulatory facts
- **SB 253 first-year deadline:** August 10, 2026 (official, per §96076).
- **SB 261 enforcement:** suspended by Ninth Circuit injunction (2025-11-18) — CARB not enforcing until lifted.

---

## Architecture decision (locked 2026-04-25)
Calculation engine is **ported to TypeScript** in `code/packages/calculator/` rather than calling the Python engine as a microservice. Python engine in `Neuvetra\ghg-kb\calculations\` is the reference spec (was `Neuvetra\Terrascope\ghg-kb\calculations\` until 2026-04-26 elevation). Test cases pinned in methodology page frontmatter; must match within 0.5%.

> **Open at C-level:** `Neuvetra\claude-memory\decisions\2026-04-25-calculator-implementation-strategy.md` — should one become canonical?

---

## Inbox queue

**Inbox is EMPTY as of 2026-04-25.** All previously queued PDFs have been ingested.

### Next priority sources (NOT yet downloaded — for future intake sessions)
| Source | Why |
|---|---|
| EU Taxonomy Environmental Delegated Act (Reg (EU) 2023/2486) | TSCs for water/marine, circular economy, pollution, biodiversity objectives — completes the Taxonomy operative-content stack alongside the now-ingested Climate DA |
| EU Taxonomy Article 8 Delegated Act (Reg (EU) 2021/2178) | KPI computation methodology (turnover/CapEx/OpEx) for Article 8 disclosures — the missing "how do you actually report it" piece |
| EU ETS Sister Directive (EU) 2023/958 | Aviation Phase 4 revisions — CORSIA, free-allocation phase-out for aircraft operators, sustainable aviation fuel allowances; referenced by the now-ingested Directive 2023/959 |
| EU Social Climate Fund Regulation (EU) 2023/955 | Member State implementation framework cross-referenced by Directive 2023/959 |
| CBAM Article 31 implementing act | Quantitative free-allocation adjustment formula linking CBAM surrender to residual EU ETS free allocation — the missing piece for CBAM cost calculator |
| CBAM Annex IV default-value implementing acts | Operational defaults for embedded-emissions calculations |
| PCAF Part B (Facilitated Emissions) and Part C (Insurance-Associated Emissions) | Complete the PCAF stack |
| GHG Protocol Land Sector and Removals **Guidance** companion document | Companion to the already-ingested LSRS *Standard* |
| Second CARB rulemaking for SB 253 (reporting content/format, verification requirements, future-year deadlines) | Not yet drafted by CARB |

---

## Factor processing — next session

All 5 priority emission-factor source files downloaded to `Neuvetra\ghg-kb\raw\factors\` (was `Terrascope\ghg-kb\raw\factors\` until 2026-04-26 elevation). The audit row above lists 2,138 seeded factors; the factor-processing memory (now migrated) said zero. **Reconcile at start of next factor session before doing anything else.**

### Per-source plan
1. **EPA GHG Emission Factors Hub 2025** (`raw/factors/epa-40cfr98/ghg-emission-factors-hub-2025.xlsx`)
   - Stationary combustion + mobile combustion + refrigerant factors.
   - Output: `factors/processed/combustion-epa-ef-hub-2025.csv`.
   - Wiki page: `methodologies/stationary-combustion`.
2. **EPA eGRID 2023** (`raw/factors/egrid/egrid2023_data_metric_rev2.xlsx`)
   - 26 US subregion grid emission rates. Key row: CAMX = California.
   - Output: `factors/processed/electricity-grid-egrid2023.csv`.
   - Wiki page: update `methodologies/scope2-location-based`.
3. **IPCC AR6 Chapter 7 Supplementary** (`raw/factors/ipcc-ar6/IPCC_AR6_WGI_Chapter07_SM.pdf`)
   - GWP100 table. CH4 fossil=27.9, N2O=273, common HFCs 700–3,900, SF6=25,200.
   - Output: `factors/processed/gwp-ipcc-ar6.csv`.
   - Wiki page: `concepts/gwp`.
4. **EPA Supply Chain v1.3.0** (`raw/factors/epa-supply-chain/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv`)
   - 1,016 NAICS-6 commodities, kg CO2e per 2022 USD. Use the CO2e file (not byGHG).
   - Output: `factors/processed/scope3-spend-epa-supply-chain-v1.3.csv`.
   - Wiki page: `methodologies/scope3-spend-based`.
5. **DEFRA 2024** (`raw/factors/defra/ghg-conversion-factors-2024-FlatFormat_v1_1.xlsx`)
   - Use FlatFormat (not full set). Travel/freight/transport.
   - Output: `factors/processed/scope3-distance-defra-2024.csv`.
   - Wiki page: `methodologies/scope3-distance-based`.

### Loading rules
- **Schema:** `Neuvetra\ghg-kb\factors\schema.sql` — every row needs `factor_id, name, factor_type, scope, value, unit, geography, source_document, data_year, effective_start` minimum.
- **Units rule:** Always normalize to kg CO2e per [denominator] before import. Never import lb, short ton, or non-SI.
- **Versioning:** Records have `effective_start`, `effective_end`, `superseded_by`. Old versions are never deleted, just retired.
- **Loading method:** Run a script (Node.js or Python alongside each CSV) or Supabase dashboard CSV upload — discuss with CEO at start of session.

### Factor architecture (locked 2026-04-25)
- `raw/factors/[source]/` — immutable raw downloads (CSV, Excel), same rule as all `raw/` files.
- `factors/processed/` — cleaned, unit-normalized CSVs in the standard schema.
- `factors/schema.sql` — PostgreSQL table definition, single source of truth.
- Numerical factor values **never** live in KB pages. The KB describes which factors to use; Supabase holds the values.
- The chatbot uses Weaviate (vector search on KB) AND Supabase (structured factor lookup) as two parallel retrieval paths.

---

## Known gaps (from 2026-04-25 readiness audit)

### Chatbot readiness
| Gap | Severity | Blocks |
|---|---|---|
| Mobile combustion methodology missing | Critical | Fleet-owning clients get no calculation |
| Supabase factor count reconciliation | Critical | All production calculations |
| Missing concept pages: `gwp`, `co2e`, `verification-assurance`, `carbon-offset`, `net-zero` | High | Plain-language explanations |
| No EU electricity grid emission factors | High | EU client Scope 2 calculations |
| Cat 5 (waste) + Cat 7 (commuting) — no methodology pages | Medium | Restaurant, retail, professional services |
| No org pages for `epa`, `ipcc` | Low | "Where does this factor come from?" |

### Data architecture
| Issue | Severity | Blocks |
|---|---|---|
| ~~Source ID prefix inconsistency — `sources/` prefix missing from ~21 `references` lists~~ **RESOLVED 2026-04-25 (sign flipped):** the canonical convention is **bare kebab-case slugs** in all frontmatter relationship arrays — matching the bare-slug `id:` field. Wiki-wide normalization stripped 99 prefixed entries across 40 files; verification grep clean. Schema clarified in `Neuvetra\ghg-kb\CLAUDE.md` Frontmatter section. | Resolved | — |
| `unit_class` + `input_unit_canonical` missing from `schema.sql` | Critical | Factor loading correctness |
| `required_by` TEXT[] has no enum constraint | High | Factor query reliability via typos |
| `calculated_by` semantic drift (points to function_ids, not page IDs) | Medium | Dangling edges on graph export |
| `source_count` field unreliable | Low | Misleading node metadata |

### Concept pages still missing
`gwp`, `co2e`, `verification-assurance`, `carbon-offset`, `net-zero`, `science-based-targets`, `financed-emissions`.

### Org pages still missing
`epa`, `ipcc`, `sbti`, `tcfd`.

### Boundary methodology decision (Q5) — Resolved 2026-04-25
**Option B (`inventory_config` block) is correct.** Boundary pages configure the Inventory at session start; they are not emission calculations. Forcing them into `calculation_spec` would produce a `calculate()` call that returns a dimensionless multiplier — semantically wrong. The `inventory_config` block declares: `method` (enum), `default_multiplier` (null for control methods), description. Spec loader reads it separately from `calculation_spec`.

---

## Recommended pre-Phase-3 execution order
1. Reconcile factor count (audit says seeded; migrated memory said empty).
2. Fix `schema.sql` — add `unit_class`, `input_unit_canonical`, `required_by` enum constraint before any reload.
3. Fix source ID prefix — one lint pass to standardize `sources/` prefix across all `references` fields.
4. Then Phase 3, in order: mobile combustion → Cat 1 spend → Cat 6 travel → boundary `inventory_config` → Cat 15 financed → AFOLU/baselines.

---

## Integrity guardian role (carry-over from prior memory)

Active in every Terrascope GHG KB session. Before accepting any input, ask: *would this help or harm a downstream LLM agent using this as a knowledge base?* The GHG KB feeds a chatbot that generates real GHG compliance reports for real businesses. Noise = wrong answers = compliance risk for users.

Flag proactively when seeing:
1. **Unofficial sources** — recommend fetching the primary document (eur-lex.europa.eu, leginfo.legislature.ca.gov, etc.).
2. **Duplicate / redundant content** — consolidate.
3. **Vague / unanchored claims** — flag and request the source.
4. **Structural drift** from required heading schema — non-standard headings break semantic chunking.
5. **Broken graph edges** — IDs that don't match real pages.
6. **Embedding-hostile content** — long prose blocks without headings, inconsistent tables, mixed concepts.
7. **Numeric emission factor values in KB pages** — values belong in Supabase, not the KB.
8. **Scope creep** — input that's interesting but off-topic for GHG accounting/reporting.

**Tone when flagging:** Direct but not alarmist. State the issue, why it matters downstream, recommended fix. One short paragraph. Then ask if the CEO wants to proceed with the fix or override.

---

## Two repos, two roles (historical reference — both now live under `Neuvetra\Terrascope\`)
| Surface | Role |
|---|---|
| `Neuvetra\ghg-kb\` | GHG knowledge base, Python calc engine, factor CSVs (was `Terrascope\ghg-kb\` until 2026-04-26 elevation) |
| `Terrascope\code\` | App, API, TypeScript calc engine, frontend |

These were two separate top-level repos before the 2026-04-25 folder consolidation. They're now both under `Terrascope\`, but still treated as distinct work surfaces.

## Full business vision (carried from migrated memory)
The GHG KB is the source-of-truth knowledge layer for a full GHG reporting platform:
1. **GHG KB** — clean, graph-ready, source-cited knowledge base.
2. **Graph DB export** — Weaviate; KB page IDs become nodes, typed relationship fields become named edges.
3. **Postgres / Supabase** — structured data store for emission factors, company records, report data.
4. **Index + chatbot** — users ask questions, get cited answers drawn from the graph/vector store.
5. **File upload** — users upload their own documents (invoices, utility bills) for the platform to process.
6. **GHG report generation** — platform produces valid, regulation-compliant GHG reports by jurisdiction.
7. **Monetization** — subscription; charging model deferred but architecture must support it from day one.

Every KB page, heading section, and relationship edge ultimately serves an LLM agent answering real business questions and generating real compliance reports. Quality here = quality of output there.

---

## How this file is maintained
- This is the migration target for what used to live in C-level auto-memory. It's the **operational** source of truth for Terrascope, scoped to this product only.
- Strategic Terrascope topics (calculator strategy, billing, brand) live in the C-level wiki at `Neuvetra\claude-memory\`, not here.
- Update this file when build state changes — at the end of any Terrascope-focused session.
