---
id: scope-1-fugitive-refrigerants
type: methodology
title: "Scope 1 — Fugitive Refrigerant Emissions"
aliases:
  - refrigerant leaks
  - fugitive HFC emissions
  - refrigerant tracking
  - HVAC emissions
  - air conditioning emissions
jurisdiction: Global
scope: [1]
business_size: any
tags: [scope-1, fugitive, refrigerants, hfc, gwp, hvac, refrigeration, carb-mrr]
last_updated: 2026-04-25
source_count: 2
references:
  - epa-fugitive-emissions-guidance
  - ghg-protocol-hfc-refrigerant-tool
  - carb-mrr-2018
parent: scope-1
calculation_spec:
  function_id: scope1_fugitive_refrigerants
  version: 1
  inputs:
    - name: refrigerant_type
      type: enum
      required: true
      values_from:
        table: emission_factors
        where: { factor_type: refrigerant-gwp }
        field: substance
      description: "IPCC substance name (e.g. HFC-134a, HFC-32). Blends like R-410A must be decomposed into components."
    - name: purchases_kg
      type: number
      required: true
      unit_class: mass
      description: "Total kg purchased during the reporting year (new equipment + service top-ups)."
    - name: recovered_at_disposal_kg
      type: number
      default: 0
      unit_class: mass
      description: "kg recovered when retired equipment was disposed of."
    - name: regulatory_context
      type: enum
      values: [CARB-MRR, SB-253, ESRS-E1, GHG-Protocol-voluntary, GHG-Protocol]
      required: true
      description: "Carried on the CalculationContext."
  factor_query:
    factor_type: refrigerant-gwp
    substance: $refrigerant_type
    effective_at: $reporting_year
    required_by_contains: $regulatory_context
  formula: "emissions_kg_co2e = (purchases_kg - recovered_at_disposal_kg) * gwp.value"
  output_unit: kg CO2e
  notes:
    - "Method: Simplified Material Balance (Method 1 on this page). Methods 2-4 will get separate function_ids in later sessions."
    - "Multi-step formula but single DB lookup. Locks the spec format for non-trivial arithmetic over a single factor."
  test_cases:
    - name: "HFC-134a — 15 kg purchased, no recovery (CARB-MRR 2025)"
      inputs:
        refrigerant_type: "HFC-134a"
        purchases_kg: 15
        recovered_at_disposal_kg: 0
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: 22950
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: refrigerant-gwp-hfc-134a-ipcc-ar6
    - name: "HFC-134a — 100 kg purchased, 30 kg recovered (net 70 kg)"
      inputs:
        refrigerant_type: "HFC-134a"
        purchases_kg: 100
        recovered_at_disposal_kg: 30
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: 107100
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: refrigerant-gwp-hfc-134a-ipcc-ar6
    - name: "HFC-32 — 5 kg purchased (smaller GWP demonstrates substance lookup)"
      inputs:
        refrigerant_type: "HFC-32"
        purchases_kg: 5
        recovered_at_disposal_kg: 0
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: 3855
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: refrigerant-gwp-hfc-32-ipcc-ar6
---

## Overview

Refrigerant leaks are a Scope 1 fugitive emission source from refrigeration and air conditioning (RAC) equipment. Modern refrigerants — HFCs, PFCs, and HFOs — have global warming potentials (GWPs) hundreds to tens of thousands of times greater than CO₂, meaning even small leaks can represent significant emissions.

This source is systematically underreported because it requires tracking refrigerant purchases and service records rather than reading a utility bill. CARB MRR includes fugitive refrigerants for facilities above thresholds.

(→ [[sources/epa-fugitive-emissions-guidance|EPA Fugitive Emissions Guidance, Dec 2023]])

## When To Use

Any facility that contains refrigeration or air conditioning equipment that uses HFCs, PFCs, or HFOs. Common applications:
- Office and building HVAC (split systems, chillers) — see [[sectors/real-estate-construction|Real Estate & Construction]]
- Commercial refrigeration (supermarkets, cold stores, restaurants) — see [[sectors/retail-consumer-goods|Retail & Consumer Goods]] and [[sectors/restaurants-food-service|Restaurants & Food Service]]
- Industrial refrigeration (food processing, pharmaceuticals) — see [[sectors/healthcare-pharmaceuticals|Healthcare & Pharmaceuticals]]
- Hotel HVAC and full-service kitchen refrigeration — see [[sectors/hospitality-hotels|Hospitality & Hotels]]
- Data center cooling
- Transport refrigeration (refrigerated trucks, shipping containers)

**What to exclude:** CFCs and HCFCs (ozone-depleting substances being phased out) are excluded from CO₂e totals under the GHG Protocol. They may be reported as separate memo items.

## Step-by-Step

There are four methods; choose based on available data. The **Simplified Material Balance** is recommended for most organisations.

---

### Method 1 — Simplified Material Balance (Recommended)

Tracks refrigerant purchased and consumed. Best for companies that do not maintain a refrigerant storage inventory and have not retrofitted equipment.

```
Emissions (kg) = (PN + PS) − RD

where:
  PN  = refrigerant purchased to charge new equipment
  PS  = refrigerant purchased for servicing existing equipment
  RD  = refrigerant recovered at disposal
```

**Step 1:** Collect refrigerant purchase records for the year — both new equipment pre-charges and top-up service purchases. Separate by refrigerant type (e.g., R-410A, R-32, R-134a).

**Step 2:** Collect disposal recovery records — amount recovered when equipment was retired.

**Step 3:** Calculate emissions by refrigerant type:
`Emissions (kg) = Purchased − Recovered at disposal`

**Step 4:** Convert to CO₂e:
`Emissions (kg CO₂e) = Emissions (kg) × GWP₁₀₀`

Retrieve GWP₁₀₀ values from the external database (`factor_type = 'refrigerant-gwp'`). Use AR6 GWP values (the most current standard).

---

### Method 2 — Material Balance (Most Accurate)

Full tracking of all refrigerant flows. Required for CARB MRR reporters and recommended for facilities with large systems or on-site refrigerant storage.

```
Emissions (kg) = [Opening inventory + Purchases] − [Closing inventory + Sales + Recycled/destroyed + Remaining in disposed equipment]
```

All six flows require documentation. Service contractors should be able to provide this data from their logs.

---

### Method 3 — Screening (Default Equipment Factors)

Uses EPA default leak rates by equipment type. Use only when purchase or service records are unavailable.

| Equipment type | Typical annual leak rate |
|---|---|
| Domestic refrigeration | 1% of capacity/year |
| Stand-alone commercial | 3% of capacity/year |
| Medium/large commercial refrigeration | 3% of capacity/year |
| Industrial refrigeration | 3% of capacity/year |
| Chillers | 1% of capacity/year |
| Transport refrigeration | 1% of capacity/year |

```
Annual operating emissions (kg) = Equipment capacity (kg) × Annual leak rate (%)
```

Also calculate installation emissions (typically 1–3% of capacity lost during installation) and disposal emissions (capacity remaining × disposal emission factor).

---

### Method 4 — Purchased Gas Method

For industrial gases purchased in cylinders (CO₂, N₂ for fire suppression, etc.) where all purchases are assumed to be emitted in the year purchased:
```
Emissions (kg CO₂e) = Quantity purchased (kg) × GWP₁₀₀
```

---

## Data Requirements

| Data item | Source | Required for |
|---|---|---|
| Refrigerant type(s) in use | Equipment nameplates, service contracts | All methods |
| Refrigerant purchases (kg) | Purchase invoices, service records | Methods 1, 2, 4 |
| Opening/closing refrigerant stock (kg) | Inventory logs | Method 2 only |
| Refrigerant recovered at disposal (kg) | Disposal contractor records | Methods 1, 2 |
| Equipment capacity (kg) | Equipment specs | Method 3 |
| GWP₁₀₀ per refrigerant | External DB (`factor_type = 'refrigerant-gwp'`) | All methods |

## Blend Refrigerants

Common refrigerants such as R-410A and R-407C are blends of multiple HFC compounds. To obtain CO₂e:

1. Look up each component's GWP₁₀₀ from the external database
2. Weight by mass fraction of the blend
3. Multiply total kg leaked by the blended GWP

Blend compositions are standardised by ASHRAE. R-410A = 50% HFC-32 + 50% HFC-125.

## Worked Example

*Structure only — retrieve GWP values from the external database.*

A company has a 50 kg R-410A chiller. During the year it purchased 5 kg R-410A for servicing and recovered 2 kg at disposal of a smaller unit. Using Method 1:
- Emissions = 5 kg (service purchase) + 0 kg (new equipment, none installed) − 2 kg (recovery) = 3 kg R-410A released
- CO₂e = 3 kg × GWP₁₀₀ of R-410A → retrieve from external database

## Limitations

- Method 1 understates emissions when equipment leaks slowly over multiple years before needing a recharge (the leak is undetected until service is called)
- Screening method leak rates carry high uncertainty (±50%); use only for materiality assessment
- CFCs and HCFCs have ozone depletion considerations that make GWP treatment complicated — exclude from CO₂e totals as the GHG Protocol requires

## Regulatory References

- **CARB MRR (Title 17 CCR §95126)** — requires refrigerant tracking for covered California facilities; uses the material balance or screening methods (→ [[regulations/carb-mrr|CARB MRR]])
- **SB 253 (CCDAA)** — Scope 1 disclosure includes fugitive refrigerant emissions (→ [[regulations/sb253-ccdaa|SB 253]])
- **EPA Fugitive Emissions Guidance (Dec 2023)** — primary calculation guidance from EPA Center for Corporate Climate Leadership (→ [[sources/epa-fugitive-emissions-guidance|EPA Guidance]])
- **GHG Protocol HFC Tool** — GHG Protocol companion calculation workbook (→ [[sources/ghg-protocol-hfc-refrigerant-tool|HFC Tool]])

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[methodologies/scope-1-stationary-combustion|Scope 1 — Stationary Combustion]]
- [[regulations/carb-mrr|CARB Mandatory Reporting Regulation]]
- [[sectors/retail-consumer-goods|Retail — refrigerant leaks from commercial refrigeration]]
- [[sectors/real-estate-construction|Real Estate — refrigerant leaks from building HVAC]]
- [[sectors/hospitality-hotels|Hospitality & Hotels — hotel HVAC and F&B refrigeration]]
- [[sectors/healthcare-pharmaceuticals|Healthcare & Pharmaceuticals — pharma cold chain and medical refrigeration]]
