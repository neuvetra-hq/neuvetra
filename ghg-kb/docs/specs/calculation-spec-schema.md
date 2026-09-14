# calculation_spec — Schema and Conventions

**Status:** v1.1 — readiness contract added 2026-09-14
**Applies to:** every page in `wiki/methodologies/` that should be executable
**Owners:** wiki maintainers (the YAML block) and `calculations/` engine maintainers (the consumer)

---

## Purpose

`calculation_spec` is the structured, machine-executable contract embedded in every methodology page's YAML frontmatter. It declares:

- What inputs the methodology takes
- Which emission factor record(s) to look up and how
- The arithmetic that combines them
- Test cases that pin the methodology's behaviour

If a methodology page has an executable `calculation_spec` block, the calculation engine may compute under it. An explicitly deferred block preserves structured draft work while making the capability unavailable to calculation callers. Without a spec, the methodology is documentation-only and the chatbot must refuse to compute and instead surface the prose.

The wiki remains the single source of truth (`CLAUDE.md`). Specs are extensions of methodology pages, not duplicates of them.

---

## Top-level fields

```yaml
calculation_spec:
  function_id: <snake_case>           # REQUIRED — matches calculations/<function_id>.py
  version: <integer>                  # REQUIRED — bump on factor_query or formula change
  inputs: [ ... ]                     # REQUIRED — non-empty list of input declarations
  factor_query: { ... }               # REQUIRED — Supabase query template
  formula: <string>                   # REQUIRED — natural-language form of the arithmetic
  output_unit: <string>               # REQUIRED — must equal CalculationResult.unit
  test_cases: [ ... ]                 # REQUIRED — at least one
  readiness:                          # optional; absent means executable
    status: executable | deferred
    blockers: [<controlled code>, ...]
```

### `readiness`

Existing complete specs may omit `readiness`; omission means `status: executable`. An incomplete draft must declare `status: deferred` and one or more controlled blocker codes:

- `implementation_missing` — no callable calculation module is available.
- `factor_release_missing` — the required reviewed factor records are not released.
- `approved_expectations_missing` — numerical test expectations are not approved.

Executable specs cannot declare blockers. Deferred specs are available only through the loader's explicit inspection path (`include_deferred=True`); the normal runtime `load_spec()` path rejects them. The test harness retains each deferred test declaration as a separately identified skip with the blocker codes and also requires at least one real executable case, preventing a catalog of skips from appearing successful.

A deferred case may use the literal `TBD` for `expected.value`. That marker is invalid in an executable spec. Promotion requires clearing every blocker, replacing every `TBD` with an approved finite number, providing the implementation and reviewed factors, changing the status to executable (or removing the readiness block), and passing the full GHG suite. Readiness metadata does not approve a methodology or factor release.

### `function_id`

The Python module under `calculations/` that implements this methodology, without the `.py` extension. The module must export a callable named `calculate(inputs: dict, context: CalculationContext) -> CalculationResult`.

### `version`

Integer, starts at 1, monotonically increasing. **Bump rule:** any change that affects the numerical output for the same inputs requires a bump. See "Versioning Policy" below.

### `inputs`

List of input declarations. Each entry:

```yaml
- name: <snake_case>                  # required
  type: enum | number | string | integer | boolean   # required
  required: true | false              # default false
  default: <literal>                  # optional
  unit_class: energy | volume | mass | distance | currency | count | dimensionless
  values: [ ... ]                     # for enum types
  values_from:                        # for enums sourced from the DB
    table: <table>
    where: { <col>: <value>, ... }
    field: <column>
  description: <string>               # optional human-readable note
```

**Convention:** `regulatory_context` and `reporting_year` may be declared in `inputs` for documentation, but at execution time they live on `CalculationContext`, not in the inputs dict. The test harness handles this split automatically.

### `factor_query`

A Supabase query template. Field names match `emission_factors` columns exactly. Values prefixed with `$` are placeholders bound from inputs at execution time.

```yaml
factor_query:
  factor_type: combustion             # literal
  substance: $fuel_type               # bound from inputs.fuel_type
  geography: $geography               # bound from inputs.geography
  effective_at: $reporting_year       # bound from context.reporting_year
  required_by_contains: $regulatory_context   # bound from context.regulatory_context
```

Multi-factor methodologies (e.g. refrigerants need both leak rate and GWP) declare multiple keyed query blocks:

```yaml
factor_query:
  gwp:
    factor_type: refrigerant-gwp
    substance: $refrigerant_type
  leak_rate:
    factor_type: refrigerant-leak
    substance: $refrigerant_type
    equipment_class: $equipment_class
```

The Python module names each lookup explicitly; spec keys must match.

### `formula`

A short natural-language expression describing the arithmetic. Single-factor methodologies often have trivial formulas (`emissions_kg_co2e = quantity * factor.value`); multi-factor methodologies describe the composition (`emissions_kg_co2e = charge_kg * leak_rate * gwp.value`).

The formula field is **documentary**. The actual arithmetic lives in the Python module. The PRD's "expression DSL" idea is deferred to Phase 2 when multi-factor methodologies land — until then, `formula` is a string, not parsed.

### `output_unit`

Must equal the `unit` field on the `CalculationResult` the module returns. The validator enforces this on every call (PRD §8.1 rule 4 reframed at runtime).

### `test_cases`

List of pinned input/output pairs the test harness asserts:

```yaml
test_cases:
  - name: <human-readable label>      # required
    inputs:                            # required
      <input_name>: <value>
      ...
      regulatory_context: <value>     # required (split to context at runtime)
      reporting_year: <integer>       # required (split to context at runtime)
    expected:
      value: <finite number>           # required for executable specs; deferred may use literal TBD
      unit: <string>                   # required
      tolerance_pct: <number>          # default 0.5
    factor_used: <factor_id>           # optional but strongly recommended — asserts the resolver picked the right record
```

At least one test case is mandatory. Add a test case any time you fix a bug or extend the input space — the harness is the contract.

---

## Versioning Policy

Locked decision (2026-04-25): **bump `version` on any change that affects the numerical output for the same inputs**.

| Change | Bump? |
|---|---|
| `factor_query` filter changes | **Yes** |
| `formula` arithmetic changes | **Yes** |
| Output unit changes | **Yes** |
| New required input added | **Yes** (breaks back-compat) |
| New optional input with sensible default added | No |
| Documentation-only edits (descriptions, names) | No |
| New test case added | No |
| Factor record updated by source publisher (e.g. eGRID 2024) | No — that's a factor versioning event, handled by `effective_start/effective_end` on the factor record |

**Why this matters:** the audit trail goal in the PRD (success criterion #6) requires that an old `CalculationResult` can be reproduced. The `methodology_id + methodology_version + factor_ids + inputs` tuple must uniquely determine the value. Any change that breaks that determinism requires a version bump.

**Implementation:** when bumping, append a `## Version History` section near the bottom of the methodology page noting the change and effective date.

---

## Validation rules

The `spec_loader` performs cheap structural validation on every load:

1. All `REQUIRED_TOP_KEYS` present
2. `inputs` is a non-empty list, every entry has `name` and `type`
3. At least one `test_cases` entry
4. Every test case has a non-empty name, an inputs mapping, and an expected mapping with a non-empty unit and finite, non-negative tolerance
5. Every executable expected value is a finite number (numeric strings, booleans, `TBD`, NaN, and infinity are rejected)
6. Deferred specs declare at least one controlled blocker; executable specs declare none

Semantic validation (formula references declared inputs; `function_id` resolves to a real module; factor_query placeholders resolve) is enforced by the test harness — failures show up as visible test errors rather than hidden import errors.

---

## Authoring checklist

When adding a `calculation_spec` to a methodology page:

1. Pick a `function_id`. Create `calculations/<function_id>.py` with a `calculate()` entry function.
2. Declare every input the methodology needs. Mark required vs optional. Set `unit_class` for any quantity that gets converted.
3. Write the `factor_query` referencing real `emission_factors` columns.
4. Write at least one `test_case` against a published worked example or a known reference value. If the needed implementation, reviewed factor release, or approved expectation is missing, declare the whole spec deferred and name each blocker instead of inventing a number.
5. Add the methodology id to `calculated_by` in the page frontmatter.
6. Bump `last_updated` on the page.
7. Run `pytest calculations/tests/` and verify green.

---

## Boundary methodology pages

The three organizational boundary pages (`equity-share-approach`, `financial-control-approach`, `operational-control-approach`) use `inventory_config` instead of `calculation_spec`. These pages configure the `Inventory` aggregator rather than computing emission quantities. See `docs/specs/inventory-config-schema.md` for the full schema.

---

## Out of scope (for v1)

- Conditionals or loops in the `formula` field. If a methodology needs them, drop `formula` and rely entirely on the Python module.
- Cross-currency conversion in `unit_class: currency`. Inputs must be supplied in the factor's currency.
- Inline factor values. Never embed numerical factor values in a spec — they live in `factors/processed/` and Supabase. (Reinforces `CLAUDE.md` Absolute Rule #2.)
