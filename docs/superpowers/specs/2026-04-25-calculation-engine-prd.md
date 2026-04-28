# PRD: GHG Calculation Engine

**Status:** In execution — Phases 1 + 2 shipped, Phase 3 next
**Author:** Prior session (2026-04-25)
**Audience:** Next session continuing this work
**Decision required from user before Phase 3 begins:** Yes — see PRD §13 Q5 (boundary methodology page shape)

> ## Execution status (2026-04-25)
>
> | Phase | Methodologies | Tests | Status |
> |---|---|---|---|
> | 1 — Foundation | scope-1-stationary-combustion + spec_loader, factor_resolver (CSV), unit_registry, validator, base | 19 | ✓ shipped |
> | 2 — Multi-factor + Scope 2 | scope-1-fugitive-refrigerants, scope-2-location-based, scope-2-market-based + Inventory aggregator | 33 (cumulative) | ✓ shipped |
> | 3 — Scope 3 | Cat 1 spend, Cat 6 travel, Cat 15 financed, AFOLU, baselines, boundary pages | — | next — see `calculations/NEXT.md` |
> | 4 — Tool generation + chatbot | — | — | — |
> | 5 — Hardening | — | — | — |
>
> **Locked decisions** (PRD §13): Q1 frontmatter spec ✓, Q2 Python-subset formula (deferred — `formula` documentary-only for now) ✓, Q6 versioning rule = bump on any factor_query/formula/output_unit/required-input change ✓.
> **Still open:** Q3 (tool-calling target), Q4 (uncertainty timing — Phase 5 default), Q5 (boundary page shape — blocks Phase 3).
>
> Engine is operational against the CSV-backed factor resolver. Supabase swap (`factors/NEXT.md`) is independent — engine interface is stable.

---

## 1. Summary

The Neuvetra wiki currently describes how to calculate Scope 1, 2, and 3 emissions in human-readable prose. The end goal is a commercial SaaS chatbot, backed by a graph database (Weaviate) and an emission factor database (Supabase), that can compute accurate emission inventories on demand.

This PRD proposes the architecture and execution plan for the **Calculation Engine** — the deterministic layer that sits between the chatbot's LLM and the factor database, executes methodologies, and returns auditable emission numbers with full provenance.

The central commitment: **the LLM never does arithmetic.** It orchestrates and presents; structured code calculates.

---

## 2. Problem Statement

A chatbot that calculates GHG emissions has four failure modes that destroy commercial viability:

1. **Hallucinated numbers.** LLMs invent factor values, swap units, and silently misapply methodologies.
2. **Wrong methodology choice.** Same fuel, same quantity, three different correct answers depending on regulatory regime (CARB MRR vs SB 253 vs ESRS E1). LLMs guess; auditors don't accept guesses.
3. **No provenance.** Auditors require every output number to be reconstructible from cited factor records and methodology versions. A black-box LLM answer is not auditable.
4. **Silent unit errors.** Therms/MMBtu, lbs/kg, miles/km — the #1 source of error in production carbon-accounting systems.

The wiki today is a great knowledge base for humans. It is not yet executable by a chatbot. This PRD closes that gap.

---

## 3. Goals

- Every emission number returned by the chatbot is computed by deterministic code, not an LLM.
- Every emission number is fully reconstructible: methodology_id, factor_id(s), inputs, units, regulatory context, and version are all preserved.
- The wiki remains the single source of truth. Methodology pages are extended, not duplicated, to become executable.
- The calculation layer can be invoked by the chatbot as a typed tool, by automated tests as a Python function, and by future ETL systems as a service.
- All 13 existing methodology pages have working calculation specs and reference Python implementations by end of Phase 3.
- A test suite enforces correctness against published worked examples and catches regressions when factor sources update.

## 4. Non-Goals

- Building the chatbot itself. This PRD scopes the calculation engine that the chatbot will call.
- Migrating the wiki to Weaviate. That is a separate workstream.
- Loading factors into Supabase. Factors are already processed; loading is an existing in-flight task tracked in `factors/index.md`.
- Replacing or rewriting wiki prose. Specs are added as structured frontmatter; prose continues to serve human readers and vector-embedding chunking.
- Real-time / streaming calculation. The engine is request-response.

---

## 5. Core Architectural Principle

**LLMs orchestrate at the edges. Code calculates in the middle.**

Concretely, the LLM is allowed to:

- Classify intent (which scope, which methodology candidate)
- Extract structured inputs from natural-language user input
- Format the final answer with citations and disclaimers
- Decide when to refuse and ask the user a clarifying question

The LLM is forbidden from:

- Performing any arithmetic
- Looking up or estimating a factor value
- Choosing between methodologies when the choice materially affects the result without surfacing the choice to the user

This is enforced by architecture, not by prompting. The chatbot's tool layer accepts only structured calls into the calculation engine; it has no path to return a number that wasn't produced by a typed function.

---

## 6. System Architecture

### Pipeline

```
User question (natural language)
   │
   ▼
[LLM intent classifier]      identifies scope, category, candidate methodology(s)
   │
   ▼
[LLM data extractor]         pulls quantities, units, fuel types, geography, year
   │
   ▼
[Methodology resolver]       selects exactly one methodology; refuses if ambiguous
   │
   ▼
[Factor resolver]            structured Supabase query against emission_factors
   │
   ▼
[Calculation engine]         deterministic Python; returns CalculationResult
   │
   ▼
[Validator]                  unit dimensional analysis, sanity bounds, applicability
   │
   ▼
[Inventory aggregator]       optional; rolls up multiple results with provenance
   │
   ▼
[LLM presenter]              formats answer with citations and caveats
```

### Component responsibilities

| Component | Implementation | Owner | Stateful? |
|---|---|---|---|
| Intent classifier | LLM with tool schema derived from methodology specs | Chatbot layer | No |
| Data extractor | LLM with Pydantic-typed extraction targets | Chatbot layer | No |
| Methodology resolver | Hybrid: Weaviate semantic match + rule-based filter on regulatory_context | Engine | No |
| Factor resolver | Supabase SQL query templated from `factor_query` block in spec | Engine | No |
| Calculation engine | Pure Python, one function per methodology_id | Engine | No |
| Validator | Pure Python; runs after every calculation | Engine | No |
| Inventory aggregator | Python class holding boundary state, regulatory context, accumulated results | Engine | Yes (per-conversation) |
| Presenter | LLM with strict template that cannot mutate numbers | Chatbot layer | No |

The chatbot layer and the engine are separate deployable units. The engine has a stable Python API and can be invoked without an LLM at all.

---

## 7. Data Model Changes

### 7.1 Methodology page frontmatter — add `calculation_spec` block

Every page in `wiki/methodologies/` gets a new optional frontmatter block. If present, the methodology is executable. If absent, the methodology is documentation-only and the chatbot must refuse to compute under it.

```yaml
calculation_spec:
  function_id: scope1_stationary_combustion        # matches Python module name
  version: 1                                        # bump on breaking spec change
  inputs:
    - name: fuel_type
      type: enum
      required: true
      values_from:
        table: emission_factors
        where: { factor_type: combustion }
        field: substance
    - name: quantity
      type: number
      required: true
      unit_class: energy                            # enables unit conversion
    - name: geography
      type: string
      default: US-national
    - name: reporting_year
      type: integer
      default: latest
    - name: regulatory_context
      type: enum
      values: [CARB-MRR, SB-253, ESRS-E1, GHG-Protocol-voluntary]
      required: true                                # gates factor selection
  factor_query:
    factor_type: combustion
    substance: $fuel_type
    geography: $geography
    effective_at: $reporting_year
    required_by_contains: $regulatory_context
  formula: "emissions_kg_co2e = quantity_in_mmbtu * factor.value"
  output_unit: kg CO2e
  test_cases:
    - name: "Natural gas baseline"
      inputs: { fuel_type: "Natural Gas", quantity: 5000, unit: "MMBtu",
                regulatory_context: "CARB-MRR", reporting_year: 2024 }
      expected: { value: 265550, tolerance_pct: 0.5 }
      factor_used: epa-cfr98-2025-natural-gas
```

### 7.2 `emission_factors` schema — add columns

Two new columns required for safe execution:

```sql
ALTER TABLE emission_factors
  ADD COLUMN unit_class TEXT CHECK (unit_class IN
    ('energy', 'volume', 'mass', 'distance', 'currency', 'count', 'dimensionless')),
  ADD COLUMN input_unit_canonical TEXT;
```

- `unit_class` lets the engine validate dimensional consistency before multiplication
- `input_unit_canonical` is the unit the factor expects (e.g., `MMBtu`); user inputs in `therms` are converted to this unit before applying the factor

### 7.3 New file: `factors/unit_registry.py`

A frozen unit-conversion table built on Pint, listing every unit used in the emission factor database and its conversion to the canonical unit. The registry is versioned; conversion rates do not change between releases.

---

## 8. Component Specifications

### 8.1 The `calculation_spec` format

Defined in Section 7.1. Schema for the spec itself lives in `docs/specs/calculation-spec-schema.md` (created in Phase 1).

Validation: a spec is valid if (1) every input referenced in `factor_query` and `formula` is declared in `inputs`, (2) every `unit_class` referenced exists in the unit registry, (3) at least one test case is provided, (4) the `function_id` matches an existing or planned Python module in `calculations/`.

### 8.2 `calculations/` Python implementations

New top-level folder, sibling to `wiki/` and `factors/`:

```
calculations/
  __init__.py
  base.py                              # CalculationResult, CalculationContext, exceptions
  unit_registry.py                     # Pint-based unit conversion
  factor_resolver.py                   # Supabase query layer
  spec_loader.py                       # parses calculation_spec from methodology frontmatter
  scope1_stationary_combustion.py
  scope1_fugitive_refrigerants.py
  scope1_mobile_combustion.py          # gap — no methodology page yet
  scope2_location_based.py
  scope2_market_based.py
  scope3_cat1_spend_based.py
  scope3_cat6_business_travel.py
  scope3_cat15_financed_emissions.py
  ...
  inventory.py                         # aggregator (Section 8.4)
  validator.py                         # post-calculation checks
  tests/
    test_harness.py                    # auto-discovers test_cases from specs
    test_<each_methodology>.py         # additional edge cases
```

Each methodology module exports exactly one entry function with this signature:

```python
def calculate(inputs: dict, context: CalculationContext) -> CalculationResult: ...
```

`CalculationResult` is a dataclass with fields: `value`, `unit`, `methodology_id`, `methodology_version`, `factor_ids` (list), `inputs`, `regulatory_context`, `boundary_basis`, `uncertainty_pct`, `computed_at`, `warnings` (list).

`CalculationContext` carries cross-call state: organizational boundary choice, regulatory context, reporting year, GWP basis (AR5/AR6), Supabase connection, unit registry handle.

### 8.3 Test harness

A pytest-based harness at `calculations/tests/test_harness.py` that:

1. Walks `wiki/methodologies/` and parses every `calculation_spec` block.
2. For every `test_cases` entry, instantiates a `CalculationContext`, calls the corresponding Python function with the declared inputs, and asserts the output is within `tolerance_pct` of `expected.value`.
3. Asserts `factor_used` matches the `factor_id` actually selected by the resolver.
4. Reports per-methodology pass/fail and surfaces any spec/implementation drift.

Wired to CI. When EPA publishes eGRID 2024 next year, this suite tells us within minutes whether anything broke.

### 8.4 Inventory aggregator

`calculations/inventory.py` exposes an `Inventory` class:

```python
inv = Inventory(
    boundary_method="operational-control",
    regulatory_context="SB-253",
    reporting_year=2024,
    gwp_basis="AR6",
)
inv.add_scope1(stationary_combustion_result)
inv.add_scope1(fugitive_refrigerant_result)
inv.add_scope2(location_based_result)
inv.add_scope3(cat1_result, cat6_result, cat15_result)

inv.scope1_total()        # propagates uncertainty via root-sum-of-squares
inv.scope2_total()
inv.scope3_total()
inv.grand_total()
inv.audit_trail()         # full list of factor_ids, methodology_ids, inputs, conversions
```

The aggregator is the only piece of stateful logic in the engine. It enforces:

- Boundary multipliers (e.g., equity share of 35% applied uniformly to that entity's results)
- Regulatory regime consistency (a single inventory cannot mix CARB-MRR and ESRS-E1 factors)
- Double-count detection (warns when the same factor_id is applied across scopes — a Cat 3 vs Scope 1 fuel-extraction collision is the canonical case)
- Scope-2 dual reporting (location-based and market-based both required by CSRD; aggregator holds both totals)

### 8.5 Chatbot tool layer

Generated, not hand-written. A build step reads every `calculation_spec` and emits an MCP tool schema or OpenAI-style function-calling JSON, one tool per methodology. The LLM picks the tool; the tool's typed inputs are enforced by the framework, not by the prompt.

Generation script: `calculations/scripts/generate_tool_schemas.py`. Runs in CI on any spec change.

---

## 9. The Seven Hard Problems

Each subsection below describes a failure mode and the architectural choice that mitigates it. The next session should evaluate whether the chosen mitigation is the right one before execution.

### 9.1 Unit conversion

**Failure mode:** User says "5,000 therms" while factor expects MMBtu. Multiplying directly gives an answer 10× too high.

**Mitigation:** `unit_class` on every factor. Engine refuses to multiply unless the input unit's class matches the factor's `unit_class`. Conversion uses Pint with a frozen registry. Every test case must round-trip: input in any acceptable unit, internal conversion to canonical, expected output value matches regardless of input unit.

### 9.2 Factor selection under regulatory regime

**Failure mode:** Same fuel, same quantity, three different correct factors depending on whether the user is reporting under CARB MRR (specific Tier 3 EPA factor with uncertainty), SB 253 (GHG Protocol broadly), or ESRS E1 (also GHG Protocol but with AR6 GWPs and dual Scope 2).

**Mitigation:** `regulatory_context` is a required input on every methodology spec. The `factor_query` block uses `required_by_contains: $regulatory_context` to filter. The factor resolver returns no result rather than the wrong result when the regime has no matching factor — the engine then surfaces a structured error to the chatbot, which asks the user to clarify or confirm.

### 9.3 Boundary state

**Failure mode:** A user with 35% equity in a JV reports 100% of the JV's emissions, or reports nothing because the JV is operationally controlled by the partner.

**Mitigation:** `boundary_method` is set on the `Inventory` at construction and applied uniformly to every result added. Per-result overrides are allowed but logged as warnings. The aggregator's `audit_trail()` makes the boundary method visible on every output.

### 9.4 Multi-step composition

**Failure mode:** Refrigerant emissions are `charge_kg × leak_rate_pct × GWP100` — three lookups, not one. Scope 2 market-based is `(contracted_MWh × supplier_EF) + (residual_MWh × residual_mix_EF)`. A spec format that supports only `quantity × factor` cannot express these.

**Mitigation:** `formula` field in the spec accepts a small expression DSL (Python expression subset, sandboxed) with named factors. Multi-factor methodologies declare multiple `factor_query` blocks (e.g., `factor_query.gwp`, `factor_query.leak_rate`). Reference: HFC and Scope 2 market-based methodologies will be the first multi-factor specs and will lock the DSL semantics in Phase 2.

### 9.5 Aggregation with provenance

**Failure mode:** Auditor asks "where did the 41,200 tonnes come from?" The system can't answer to the row.

**Mitigation:** Every `CalculationResult` carries the full input tuple, factor_ids, methodology_id, methodology version, and unit conversions used. The `Inventory` keeps these immutably; `audit_trail()` returns the complete tree. An external "explain" endpoint can render this as a human-readable trace.

### 9.6 Versioning and reproducibility

**Failure mode:** "Recalculate my 2024 inventory in 2026" silently uses 2025 factors instead of factors that were valid in 2024. Base-year recalculation breaks.

**Mitigation:** `reporting_year` is a required input on the `Inventory`. The factor resolver applies `effective_start <= reporting_year_end AND (effective_end IS NULL OR effective_end > reporting_year_start)` automatically. `methodology_version` is captured on every result so methodology changes are traceable across years.

### 9.7 Uncertainty propagation

**Failure mode:** Aggregating Scope 1+2+3 totals without uncertainty propagation gives false precision (e.g., "1,234,567 kg CO2e" with no error bound). Auditors flag this.

**Mitigation:** Every factor record's `uncertainty_pct` propagates into the `CalculationResult.uncertainty_pct`. The aggregator uses root-sum-of-squares for independent sources at minimum (with a clear note that correlated sources are an open problem — see Section 13). Output formatting always includes the bound: "1,234,567 ± 89,000 kg CO2e".

---

## 10. Implementation Phases

### Phase 1 — Foundation (estimated 1 session)

- Create `calculations/` folder with `base.py`, `unit_registry.py`, `factor_resolver.py`, `spec_loader.py`, `validator.py`
- Define `CalculationResult` and `CalculationContext` dataclasses
- Apply schema migration: `unit_class` and `input_unit_canonical` columns on `emission_factors`
- Backfill `unit_class` on all 2,138 existing factor records
- Document the `calculation_spec` format in `docs/specs/calculation-spec-schema.md`
- Add `calculation_spec` block to `methodologies/scope-1-stationary-combustion.md` as the proof of concept
- Implement `calculations/scope1_stationary_combustion.py`
- Set up the test harness; verify the proof-of-concept methodology passes

**Exit criterion:** `pytest calculations/tests/` runs green for Scope 1 stationary combustion against real Supabase data.

### Phase 2 — Multi-factor and Scope 2 (estimated 1 session)

- Add `calculation_spec` blocks to `scope-1-fugitive-refrigerants`, `scope-2-location-based`, `scope-2-market-based`
- Implement corresponding Python modules
- Lock the multi-factor DSL semantics
- Implement the `Inventory` aggregator with boundary multiplier and dual-reporting Scope 2 support
- Test harness covers all four Phase 2 methodologies

**Exit criterion:** A user-facing test like "office consumed 50,000 kWh in California, 12,000 therms gas, 15 kg R-410A leak" produces a correct, fully-cited Scope 1+2 inventory.

### Phase 3 — Scope 3 (estimated 2 sessions)

- Add specs and implementations for `scope-3-cat1-spend-based`, `scope-3-cat6-business-travel`, `scope-3-cat15-financed-emissions`
- Add specs and implementations for the boundary-method methodologies (`equity-share`, `financial-control`, `operational-control`) — these are not arithmetic but produce `Inventory` configuration
- Add specs for the AFOLU IPCC tiered framework and project-baseline methodologies

**Exit criterion:** All 13 existing methodology pages have working specs and Python implementations, all green in CI.

### Phase 4 — Tool generation and chatbot integration (estimated 1 session)

- Build `generate_tool_schemas.py`
- Define the chatbot's tool-calling contract (MCP, OpenAI function-calling, or both)
- Document the methodology-resolver rule set (semantic match + regulatory filter + ambiguity refusal)
- End-to-end test: natural-language question → engine call → cited answer

**Exit criterion:** A reference chatbot harness in `calculations/scripts/chatbot_demo.py` answers a battery of test questions correctly with full provenance.

### Phase 5 — Hardening (estimated 1 session)

- Uncertainty propagation across the aggregator
- Sanity-bound checks (per-sector ranges) in the validator
- Audit-trail rendering as Markdown and JSON
- Performance benchmarks on Supabase queries; add indexes if needed
- Documentation: `calculations/README.md` for engineers consuming the engine

**Exit criterion:** Calculation engine is ready to be wired into the production chatbot. PRD considered fulfilled.

---

## 11. Success Criteria

The calculation engine is successful when:

1. Every emission number it returns can be reconstructed from `methodology_id + factor_id(s) + inputs + version` without invoking the LLM.
2. The test harness covers ≥1 published worked example per methodology, all green in CI.
3. Adding a new methodology takes a contributor < 1 day, end-to-end (spec block + Python module + test cases).
4. A factor source update (e.g., eGRID 2024 release) is detectable in CI within 10 minutes of being loaded into Supabase.
5. A user asking the chatbot "what would my Scope 1 be under CARB MRR vs ESRS E1" gets two different, correct, cited numbers.
6. An external auditor can be handed the audit_trail JSON and reproduce every line item by hand.

## 12. Risks

- **Spec complexity creeps.** As more methodologies are added, the `calculation_spec` format may need extensions. Mitigation: version the spec schema; bump major version on breaking changes; pin specs to schema version.
- **Factor coverage gaps.** Some methodologies will have no matching factor under some regulatory regimes (e.g., a niche refrigerant under CARB MRR). The factor resolver must surface this as a structured "no factor available" error, not a silent zero.
- **Multi-factor DSL becomes a real programming language.** If too many specs need conditionals or loops, the spec is no longer declarative. Mitigation: when a methodology needs that much logic, drop the formula field and rely entirely on the Python implementation; the spec then carries inputs/queries/test cases only.
- **LLM non-compliance.** A future LLM upgrade may try to compute when the architecture says it shouldn't. Mitigation: the chatbot tool layer has no path to return a number that wasn't produced by the engine. The presenter LLM is given results, not raw factors.
- **Uncertainty correlation.** Root-sum-of-squares assumes independence. Many emission sources are correlated (e.g., regional grid uncertainty applies to every facility on that grid). Mitigation: document this as a known limitation in Phase 5; tackle properly in a follow-up.

## 13. Open Questions / Decisions to Validate

The next session should not begin execution until the user has resolved or accepted these:

1. **Spec location.** Embed `calculation_spec` in methodology page frontmatter (proposed) vs separate sidecar files in `calculations/specs/<id>.yaml`? Frontmatter keeps single source of truth; sidecars keep the wiki cleaner. **Recommend frontmatter.**
2. **Formula DSL scope.** Sandboxed Python expression subset (proposed) vs a custom mini-language? Python subset is faster to ship and familiar. **Recommend Python subset with allowlist of names.**
3. **Tool-calling target.** MCP, OpenAI function-calling, or both? Depends on the chatbot platform decision, which is upstream of this PRD.
4. **Uncertainty model in Phase 1.** Skip in early phases (proposed) and add in Phase 5, or build in from day one? Skipping makes Phase 1 ship faster; adding later means rewriting result aggregation.
5. **Where do "boundary methodologies" live?** `equity-share-approach`, `financial-control-approach`, `operational-control-approach` are not arithmetic methodologies — they configure the `Inventory`. Should they have specs at all, or should they be treated differently (e.g., as `inventory_config` rather than `calculation_spec`)?
6. **Versioning of methodology specs.** When a spec changes (e.g., a new factor query rule), what triggers a `methodology_version` bump and how is it surfaced to users running old inventories?

## 14. Out of Scope

- The chatbot's natural-language interface itself
- Migrating the wiki to Weaviate
- Loading the 2,138 processed factors into Supabase (existing in-flight task)
- Building UI / dashboards on top of inventory results
- Carbon offsets and removals accounting beyond what the existing methodology pages cover
- Reporting templates (e.g., generating a CARB MRR-formatted submission file). That is a separate "Reporting" workstream that consumes the calculation engine's outputs.
- Real-time monitoring or streaming inventories

---

## Appendix A — File and Folder Inventory After Full Execution

```
Neuvetra/
├── wiki/methodologies/                   # extended with calculation_spec frontmatter
├── factors/
│   ├── schema.sql                        # +unit_class, +input_unit_canonical
│   └── ...
├── calculations/                         # NEW
│   ├── base.py
│   ├── unit_registry.py
│   ├── factor_resolver.py
│   ├── spec_loader.py
│   ├── validator.py
│   ├── inventory.py
│   ├── scope1_stationary_combustion.py
│   ├── scope1_fugitive_refrigerants.py
│   ├── scope2_location_based.py
│   ├── scope2_market_based.py
│   ├── scope3_cat1_spend_based.py
│   ├── scope3_cat6_business_travel.py
│   ├── scope3_cat15_financed_emissions.py
│   ├── afolu_ipcc_tiers.py
│   ├── project_specific_baseline.py
│   ├── performance_standard_baseline.py
│   ├── tests/
│   │   ├── test_harness.py
│   │   └── test_<each_methodology>.py
│   ├── scripts/
│   │   ├── generate_tool_schemas.py
│   │   └── chatbot_demo.py
│   └── README.md
└── docs/specs/
    └── calculation-spec-schema.md        # NEW
```

## Appendix B — Glossary

- **Calculation spec.** Structured block in methodology frontmatter declaring inputs, factor query, and formula. Machine-executable.
- **Factor query.** The structured Supabase query template embedded in a calculation spec, with placeholders bound from inputs at execution time.
- **CalculationResult.** Immutable dataclass returned by every methodology function; carries value, unit, full provenance.
- **CalculationContext.** Per-call config object holding boundary, regulatory context, reporting year, GWP basis, DB connections.
- **Inventory.** Stateful aggregator that holds an ongoing emissions calculation for a single reporting entity and reporting period.
- **Regulatory context.** One of `CARB-MRR`, `SB-253`, `ESRS-E1`, `GHG-Protocol-voluntary` (extensible). Gates factor selection.
- **Unit class.** One of `energy`, `volume`, `mass`, `distance`, `currency`, `count`, `dimensionless`. Used for dimensional analysis at calculation time.

---

*End of PRD.*
