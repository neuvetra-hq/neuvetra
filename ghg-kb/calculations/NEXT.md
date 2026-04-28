# Next Step — Phase 3: Scope 3 + Boundary Methodologies

## Where we are

Phases 1 + 2 of the PRD (`docs/superpowers/specs/2026-04-25-calculation-engine-prd.md`) are complete.

| Phase | Methodologies | Tests | Status |
|---|---|---|---|
| 1 — Foundation | scope-1-stationary-combustion | 19 | ✓ |
| 2 — Multi-factor + Scope 2 | scope-1-fugitive-refrigerants, scope-2-location-based, scope-2-market-based + Inventory aggregator | 33 | ✓ |
| **3 — Scope 3** | scope-3-cat1-spend-based, scope-3-cat6-business-travel, scope-3-cat15-financed-emissions, afolu-ipcc-tiers, project/performance baselines, three boundary pages | — | next |
| 4 — Tool generation + chatbot | generate_tool_schemas.py, MCP/OpenAI contract, methodology resolver | — | — |
| 5 — Hardening | uncertainty propagation, sanity bounds, audit-trail rendering | — | — |

## Decision needed before Phase 3 starts

**PRD §13 Q5 — boundary methodology page shape.** Three pages exist:
- `wiki/methodologies/equity-share-approach.md`
- `wiki/methodologies/financial-control-approach.md`
- `wiki/methodologies/operational-control-approach.md`

These are not arithmetic methodologies — they configure the `Inventory` aggregator (boundary_method, boundary_multiplier per entity). Two reasonable shapes:

| Option | Implication |
|---|---|
| **A. `calculation_spec` like everything else** | Returns a synthetic `CalculationResult` whose value is the configured multiplier. Forces these into a shape they don't naturally fit, but keeps the spec format universal. |
| **B. New `inventory_config` frontmatter block** | Cleaner. Loader picks it up separately; `Inventory.from_config(boundary_page_id, ...)` factory method. Adds a second spec format to maintain. |

Resolve before authoring. Recommend **B** — shape mismatch is real and B keeps `calculation_spec` honest about being for emissions calculations.

## Phase 3 scope

In recommended order (each leaves a clean checkpoint):

### 3a. Scope 3 Cat 1 — spend-based (single factor)
- Spec: `methodologies/scope-3-cat1-spend-based.md`
- Module: `calculations/scope3_cat1_spend_based.py`
- Factor type: `scope3-spend` (1,016 EPA Supply Chain v1.3 NAICS records already processed)
- Formula: `emissions_kg_co2e = spend_USD * factor.value`
- `unit_class: currency` — already supported in registry
- Test cases: pick 2-3 representative NAICS commodities

### 3b. Scope 3 Cat 6 — business travel (multi-mode dispatch)
- Spec: `methodologies/scope-3-cat6-business-travel.md`
- Module: `calculations/scope3_cat6_business_travel.py`
- Factor type: `scope3-distance` (806 DEFRA 2024 transport records — air, rail, road)
- Formula: `emissions_kg_co2e = distance * mode_factor.value` — but mode dispatch is the interesting part. Air travel adds RF (radiative forcing) toggle.
- Locks the "single factor query, polymorphic over substance" pattern.

### 3c. Boundary methodology pages (after Q5 decided)
- Three pages get `inventory_config` (or `calculation_spec`) blocks
- New `Inventory.from_boundary_method(page_id, ...)` factory if Option B
- Tests: equity-share with 35% multiplier produces correct totals (already covered by aggregator tests; here we test the loader path)

### 3d. Scope 3 Cat 15 — financed emissions
- Spec: `methodologies/scope-3-cat15-financed-emissions.md`
- Module: `calculations/scope3_cat15_financed_emissions.py`
- Cross-references PCAF methodology — this is the genuinely novel arithmetic case. Multiple input rows (one per investee), attribution factor per row, may need a List[FactorReference].
- May surface a Phase 5-grade design need (List[FactorReference] currently flat tuple — tracked).

### 3e. AFOLU + project/performance baselines
- Documentation-heavy methodologies; the IPCC tiered framework is more about input shape than math. May ship later in Phase 3 or be split out.

## Definition of done for Phase 3

PRD §10.3 exit criterion: every methodology page in `wiki/methodologies/` (currently 13) has a working spec and Python implementation, all green in CI.

After Phase 3 the calc engine covers the full Scope 1-3 surface. Phase 4 (chatbot integration) and Phase 5 (hardening) are then unblocked.

## Phase 3 watch-items

- **CSV resolver still in place.** No Phase 3 work depends on Supabase being loaded; the resolver interface is stable. Once `factors/NEXT.md` ships (loader work), swap is mechanical.
- **Refrigerant blends** (R-410A etc.) are still a Phase 3+ TODO — IPCC AR6 supplementary lists pure substances only. Either build a blend resolver or document the per-component decomposition path on the refrigerants page.
- **Methods 2-4 of fugitive refrigerants** (full Material Balance, Screening, Purchased Gas) still need their own function_ids. Method 1 ships in Phase 2.
- **Spec_loader semantic validation** is still loose — `factor_query` placeholders aren't checked against `inputs` declarations. Cheap to add; tracked as Phase 5 work since failures show up as visible test errors.

## Run command

```
cd /sessions/nifty-optimistic-ritchie/mnt/Neuvetra && \
  python3 -B -m pytest calculations/tests/ -v \
    --basetemp=/tmp/pytest-runs --import-mode=importlib -p no:cacheprovider
```

Currently: **33 passed in 0.43s**.
