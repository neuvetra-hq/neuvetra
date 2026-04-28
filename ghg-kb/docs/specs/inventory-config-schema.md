# inventory_config — Schema and Conventions

**Status:** v1 — locked 2026-04-25
**Applies to:** the three organizational boundary methodology pages in `wiki/methodologies/`
**Owners:** wiki maintainers (the YAML block) and `calculations/` engine maintainers (the consumer)
**Related:** `docs/specs/calculation-spec-schema.md` (the sibling spec for emission calculations)

---

## Purpose

`inventory_config` is a structured frontmatter block that appears on the three boundary methodology pages:

- `wiki/methodologies/equity-share-approach.md`
- `wiki/methodologies/financial-control-approach.md`
- `wiki/methodologies/operational-control-approach.md`

These pages do not compute emission quantities — they configure **how the `Inventory` aggregator consolidates emissions across entities**. They answer the question: *"What share of each entity's emissions does this company account for?"*

Because they configure rather than calculate, they use `inventory_config` instead of `calculation_spec`. The two blocks are mutually exclusive — a page has one or the other, never both.

**Why a separate block?**
`calculation_spec` means "this page computes a tCO2e value." Forcing boundary methods into that shape would produce a `calculate()` call returning a dimensionless multiplier — semantically wrong. `inventory_config` is honest: it says "this page configures the Inventory, not an emission calculation."

The wiki remains the single source of truth. `inventory_config` extends a methodology page; it does not duplicate the prose.

---

## Top-level fields

```yaml
inventory_config:
  method: <enum>                    # REQUIRED — identifies the consolidation approach
  version: <integer>                # REQUIRED — bump on any change that affects multiplier output
  multiplier_resolution: <enum>     # REQUIRED — how the multiplier is derived at runtime
  entity_inputs: [ ... ]            # REQUIRED — what the user/chatbot must supply per entity
  loader: Inventory.configure_boundary   # REQUIRED — the Python factory that reads this config
  regulatory_notes: [ ... ]         # RECOMMENDED — which regulations mandate or prohibit this method
  test_cases: [ ... ]               # REQUIRED — at least one
```

---

### `method`

Enum. Exactly one of:

| Value | Consolidation rule |
|---|---|
| `equity_share` | Consolidate emissions proportional to ownership stake (0.0–1.0 per entity) |
| `financial_control` | Consolidate 100% of financially controlled entities; 0% of others |
| `operational_control` | Consolidate 100% of operated entities; 0% of others |

Each boundary methodology page uses exactly one value.

---

### `version`

Integer, starts at 1, monotonically increasing. Follows the same bump rule as `calculation_spec.version`: bump when any change would produce different multipliers for the same inputs. Documentation edits do not require a bump.

---

### `multiplier_resolution`

Enum. Exactly one of:

| Value | Meaning | Used by |
|---|---|---|
| `per_entity_input` | User supplies a decimal per entity (e.g. equity %) | `equity_share` |
| `binary_control` | User supplies a boolean per entity; engine maps `true → 1.0`, `false → 0.0` | `financial_control`, `operational_control` |

---

### `entity_inputs`

List of input declarations describing what the chatbot must collect from the user for each entity in the inventory. Each entry:

```yaml
- name: <snake_case>          # REQUIRED
  type: number | boolean      # REQUIRED
  required: true | false      # default false
  range: [min, max]           # for number types — optional validation hint
  description: <string>       # REQUIRED — chatbot uses this to ask the right question
```

**`equity_share` entity input:**
```yaml
entity_inputs:
  - name: equity_pct
    type: number
    required: true
    range: [0.0, 1.0]
    description: "Ownership stake as a decimal. 0.35 = 35% equity stake."
```

**`financial_control` and `operational_control` entity input:**
```yaml
entity_inputs:
  - name: controlled
    type: boolean
    required: true
    description: "True if this entity meets the control threshold; false otherwise."
```

---

### `loader`

Always `Inventory.configure_boundary`. This is the Python factory method in `calculations/inventory.py` that:

1. Reads the `inventory_config` block from the methodology page via `spec_loader`
2. Validates the `method` and `entity_inputs` fields
3. Returns a `BoundaryConfig` dataclass that the `Inventory` holds for the session
4. The `Inventory` applies each entity's multiplier to every `CalculationResult` added for that entity

```python
# Signature in calculations/inventory.py
@classmethod
def configure_boundary(
    cls,
    config: BoundaryConfig,
    entities: list[EntityInput],
    context: CalculationContext,
) -> "Inventory": ...
```

`BoundaryConfig` fields: `method`, `version`, `multiplier_resolution`.
`EntityInput` fields: `entity_id`, `multiplier` (float, derived from `equity_pct` or `controlled`).

---

### `regulatory_notes`

Optional list of strings. States which regulations mandate or prohibit this boundary method. The chatbot uses these notes to guide the user toward the correct approach for their reporting obligation.

```yaml
regulatory_notes:
  - "Required by EU ETS for covered installations (operational control mandatory)"
  - "Required for ESRS/CSRD reporting — same perimeter as financial statements"
  - "Prohibited by PCAF for financed emissions (equity share prohibited; use financial or operational control)"
```

---

### `test_cases`

List of pinned entity-level input/output pairs the test harness asserts. At least one is required.

```yaml
test_cases:
  - name: <human-readable label>       # REQUIRED
    inputs:
      entities:
        - entity_id: <string>
          equity_pct: <number>         # for equity_share
          # OR
          controlled: <boolean>        # for financial_control / operational_control
    expected_multipliers:              # REQUIRED
      <entity_id>: <float>             # 0.0 to 1.0
```

The test harness calls `Inventory.configure_boundary(config, entities, context)` and asserts that each entity's resolved multiplier matches `expected_multipliers` within a tolerance of ±0.0001.

---

## Complete examples

### `equity-share-approach.md`

```yaml
inventory_config:
  method: equity_share
  version: 1
  multiplier_resolution: per_entity_input
  entity_inputs:
    - name: equity_pct
      type: number
      required: true
      range: [0.0, 1.0]
      description: "Ownership stake as a decimal. 0.35 = 35% equity stake."
  loader: Inventory.configure_boundary
  regulatory_notes:
    - "Allowed under GHG Protocol Corporate Standard (Revised Edition) as one of three valid approaches"
    - "Prohibited by PCAF for Scope 3 Cat 15 financed emissions — use financial or operational control instead"
  test_cases:
    - name: "Three-entity portfolio — wholly owned, 50% JV, 25% minority"
      inputs:
        entities:
          - entity_id: plant-x
            equity_pct: 1.0
          - entity_id: jv-y
            equity_pct: 0.5
          - entity_id: facility-z
            equity_pct: 0.25
      expected_multipliers:
        plant-x: 1.0
        jv-y: 0.5
        facility-z: 0.25
```

### `financial-control-approach.md`

```yaml
inventory_config:
  method: financial_control
  version: 1
  multiplier_resolution: binary_control
  entity_inputs:
    - name: controlled
      type: boolean
      required: true
      description: "True if the company directs the financial and operating policies of this entity with a view to gaining economic benefits."
  loader: Inventory.configure_boundary
  regulatory_notes:
    - "Required for ESRS/CSRD reporting — reporting boundary equals the financial-statements consolidation perimeter"
    - "Required by PCAF Global GHG Accounting Standard for financed emissions"
    - "Commonly used by companies whose structure mirrors their financial reporting consolidation"
  test_cases:
    - name: "Wholly owned subsidiary + non-controlling JV interest"
      inputs:
        entities:
          - entity_id: subsidiary-a
            controlled: true
          - entity_id: jv-b
            controlled: false
      expected_multipliers:
        subsidiary-a: 1.0
        jv-b: 0.0
```

### `operational-control-approach.md`

```yaml
inventory_config:
  method: operational_control
  version: 1
  multiplier_resolution: binary_control
  entity_inputs:
    - name: controlled
      type: boolean
      required: true
      description: "True if the company has the full authority to introduce and implement its operating policies at this entity."
  loader: Inventory.configure_boundary
  regulatory_notes:
    - "Required by EU ETS for covered installations (Title 17 CCR §95811 for California; EU MRR Article 3)"
    - "Preferred when management accountability aligns with operational responsibility rather than ownership"
    - "Under ESRS E1 ¶50(b), operational-control entities must be disclosed as a separate line item even when the primary boundary uses financial control"
  test_cases:
    - name: "Operated facility + non-operated leased facility"
      inputs:
        entities:
          - entity_id: facility-a
            controlled: true
          - entity_id: leased-facility-b
            controlled: false
      expected_multipliers:
        facility-a: 1.0
        leased-facility-b: 0.0
```

---

## Versioning policy

Same rule as `calculation_spec`: bump `version` on any change that would produce different multipliers for the same inputs.

| Change | Bump? |
|---|---|
| `method` changes | Yes (breaking — different consolidation logic) |
| `multiplier_resolution` changes | Yes |
| New required `entity_input` added | Yes (breaks back-compat) |
| New optional `entity_input` with sensible default | No |
| Documentation edits, new test case added | No |
| `regulatory_notes` updated | No |

---

## Authoring checklist

When adding an `inventory_config` block to a boundary methodology page:

1. Set `method` to one of the three valid values.
2. Set `multiplier_resolution` to match (`per_entity_input` for equity_share; `binary_control` for control methods).
3. Declare `entity_inputs` with clear `description` text — the chatbot reads this to know what to ask the user.
4. Add at least one `test_case` covering both multiplier extremes (1.0 and 0.0 / a fractional value).
5. Add relevant `regulatory_notes` pointing to which regulations mandate or prohibit this approach.
6. Bump `last_updated` on the page.
7. Run `pytest calculations/tests/` and verify the boundary config test passes.

---

## What this does NOT cover

- **Mixed-boundary inventories**: a company may use different boundary approaches for different reporting obligations (e.g. financial control for CSRD, operational control for EU ETS). The `Inventory` handles this by allowing multiple `BoundaryConfig` instances keyed to regulatory context. Configuration detail lives in `calculations/inventory.py`, not in the spec block.
- **Intra-period equity changes**: if a company's equity stake changes during the reporting year, the GHG Protocol requires a weighted approach. This is a user-supplied input at runtime, not a spec-level field.
- **Sub-entity allocation**: the spec operates at the entity level. Asset-level or facility-level allocation within an entity is handled by the calculation modules for that entity's emissions, not by the boundary config.
