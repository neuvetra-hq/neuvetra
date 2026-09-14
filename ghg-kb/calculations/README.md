# calculations/ — GHG Calculation Engine

The deterministic layer that sits between the chatbot's LLM and the emission factor database. **LLMs orchestrate; this package calculates.**

This is the Phase 1 walking skeleton from `docs/superpowers/specs/2026-04-25-calculation-engine-prd.md`. Right now it ships:

- The package scaffold (`base.py`, `unit_registry.py`, `factor_resolver.py`, `spec_loader.py`, `validator.py`)
- Four executable methodologies covering Scope 1 stationary combustion, Scope 1 fugitive refrigerants, and Scope 2 location- and market-based calculations
- A spec-driven pytest harness that auto-discovers executable and explicitly deferred test cases from methodology page frontmatter
- A CSV-backed factor resolver pointed at `factors/processed/` (Supabase swap-in lands when factors are loaded — separate workstream)

## Run the tests

```bash
cd <repo root>
pip install pint pytest pyyaml
python3 -m pytest calculations/tests/ -v
```

The suite must report real passing calculation tests. Explicitly deferred draft cases appear separately as skips with blocker reasons; they do not satisfy the nonzero executable-case guard.

To show the deferred reasons locally:

```bash
cd <repo root>/ghg-kb
python3 -m pytest calculations/tests/ -q -rs
```

## Use the engine directly

```python
from pathlib import Path
from calculations.base import CalculationContext
from calculations.factor_resolver import CsvFactorResolver
from calculations.scope1_stationary_combustion import calculate

resolver = CsvFactorResolver(
    csv_paths=tuple(Path("factors/processed").glob("*.csv"))
)
ctx = CalculationContext(
    regulatory_context="CARB-MRR",
    reporting_year=2025,
    boundary_method="operational-control",
    factor_resolver=resolver,
)

result = calculate(
    {"fuel_type": "Natural Gas", "quantity": 50000, "unit": "therm"},
    ctx,
)

print(result.value, result.unit)         # 265572.5 kg CO2e
print(result.factor_ids)                 # ('combustion-natural-gas-epa-cfr98-2025',)
print(result.to_audit_dict())            # full provenance
```

## Add a new methodology

1. Add a `calculation_spec` block to the methodology page's frontmatter. See `docs/specs/calculation-spec-schema.md`.
2. Create `calculations/<function_id>.py` exporting `calculate(inputs, context) -> CalculationResult`.
3. Add at least one `test_case` to the spec.
4. Run `pytest calculations/tests/` — the harness will pick up the new methodology automatically.

If a methodology is incomplete, preserve its draft cases with the `readiness.status: deferred` contract described in `docs/specs/calculation-spec-schema.md`. Normal `load_spec()` calls reject deferred specs. `load_spec(..., include_deferred=True)` and `load_all_specs(include_deferred=True)` are inspection-only paths for readiness reporting. Before promotion, supply the implementation and reviewed factor records, replace every `TBD` expectation with an approved finite number, and clear every blocker.

## Architecture invariants

- **No arithmetic in YAML.** The `formula` field is documentary; the Python module does the math.
- **No fallback factors.** If the structured query returns zero rows, raise `FactorNotFoundError`. Wrong factor under the wrong regulatory regime is the canonical failure mode.
- **No silent unit conversion.** `unit_registry.convert()` enforces an allowlist; anything outside it raises `UnitConversionError`.
- **No factor values in the wiki.** Values live in `factors/processed/` and Supabase. The wiki describes which factors to use, not what they equal. (Reinforces `CLAUDE.md` Absolute Rule #2.)
- **Every `CalculationResult` carries full provenance.** `methodology_id + methodology_version + factor_ids + inputs` must uniquely reproduce `value`.
- **Deferred capability stays visible but cannot execute.** Every draft case is counted by the harness, while runtime loading fails closed until all declared blockers are resolved.

## Roadmap

Phase 2: Multi-factor methodologies (refrigerants, Scope 2 market-based) and the `Inventory` aggregator.
Phase 3: Scope 3 categories.
Phase 4: Tool-schema generation for the chatbot.
Phase 5: Uncertainty propagation, sanity bounds, audit-trail rendering.

See the PRD for the full plan.
