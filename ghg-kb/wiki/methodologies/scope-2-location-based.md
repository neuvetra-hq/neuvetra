---
id: scope-2-location-based
type: methodology
title: "Scope 2 Location-Based Method"
aliases:
  - location-based method
  - grid average method
  - location-based scope 2
jurisdiction: Global
scope: [2]
business_size: any
tags: [scope-2, methodology, location-based, grid-average, electricity]
last_updated: 2026-04-25
source_count: 1
references:
  - ghg-protocol-scope-2-guidance
parent: scope-2
calculation_spec:
  function_id: scope2_location_based
  version: 1
  inputs:
    - name: consumption
      type: number
      required: true
      unit_class: energy
      description: "Numerical electricity consumption (or steam/heat with appropriate unit)."
    - name: unit
      type: string
      required: true
      description: "Energy unit; converted to MWh before applying the grid factor."
    - name: grid_geography
      type: string
      required: true
      description: "eGRID-style code: CAMX (California), AKGD (Alaska), ERCT (ERCOT), etc."
    - name: regulatory_context
      type: enum
      values: [CARB-MRR, SB-253, ESRS-E1, GHG-Protocol-voluntary, GHG-Protocol]
      required: true
      description: "Carried on the CalculationContext."
  factor_query:
    factor_type: electricity-grid
    geography: $grid_geography
    effective_at: $reporting_year
    required_by_contains: $regulatory_context
  formula: "emissions_kg_co2e = consumption_in_MWh * grid_factor.value"
  output_unit: kg CO2e
  test_cases:
    - name: "California office — 50,000 kWh on CAMX (eGRID 2023, SB-253)"
      inputs:
        consumption: 50000
        unit: "kWh"
        grid_geography: "CAMX"
        regulatory_context: "SB-253"
        reporting_year: 2025
      expected:
        value: 9752.015
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: electricity-grid-camx-egrid-2023
    - name: "California office — 50 MWh on CAMX (round-trip MWh→MWh)"
      inputs:
        consumption: 50
        unit: "MWh"
        grid_geography: "CAMX"
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: 9752.015
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: electricity-grid-camx-egrid-2023
---

## Overview

The location-based method calculates scope 2 emissions using **average grid emission factors** for the geographic region where energy consumption occurs. It reflects the average GHG intensity of the grid, regardless of any specific electricity procurement choices.

This method applies to **all electricity grids worldwide**, making it universally applicable. It is required as one of the two scope 2 reporting totals under the dual reporting requirement of the GHG Protocol Scope 2 Guidance.

(→ [[sources/ghg-protocol-scope-2-guidance|GHG Protocol Scope 2 Guidance]])

## When To Use

- **Required** for all companies as one of the two dual-reported scope 2 totals (where markets with contractual instruments exist)
- **Sole method** for companies operating only in markets without differentiated electricity products or supplier-specific data
- Preferred by most national mandatory reporting frameworks (e.g., CARB MRR, UK SECR, EU ETS)
- Useful for comparing GHG intensity across locations independent of procurement decisions

## Step-by-Step

1. **Identify consumption sites** — list all facilities where electricity, steam, heat, or cooling is purchased
2. **Measure activity data** — obtain total purchased energy per facility per reporting period (MWh for electricity; GJ or MWh equivalent for steam/heat/cooling)
3. **Select emission factor** — choose the most granular geographic level available:
   - National grid average (e.g., IEA, IPCC, government-published factors)
   - Regional/sub-national grid (e.g., EPA eGRID sub-regions for the US)
   - Local grid operator factor where published
4. **Calculate:** `Scope 2 Emissions (tCO₂e) = Energy Consumed (MWh) × Grid Average Emission Factor (tCO₂e/MWh)`
5. **Aggregate** across all facilities
6. **Label and report** as the location-based scope 2 total; report separately from market-based total

## Data Requirements

- **Activity data:** Utility bills, sub-metering, or energy management systems for each facility
- **Emission factors:** National or regional grid average factors — see external emission factor database (do not embed numerical values in this wiki)
- **Biogenic note:** Most published grid average factors treat biogenic CO₂ as zero; disclose this omission in the GHG inventory

## Worked Example

*Structure only — emission factor values are in the external database.*

A company has two facilities: one in Germany, one in California. Apply the relevant national/regional grid average factor to each facility's annual electricity consumption. Sum the results for the total location-based Scope 2 figure. No adjustment is made for any renewable energy certificates the company may hold.

## Limitations

- **Does not reflect procurement choices:** A company using 100% renewable energy certificates has the same location-based result as a company with no renewables, if both are on the same grid.
- **Grid averages are lagged:** Published factors are typically 1–2 years behind current conditions.
- **Cannot track renewable energy procurement:** Companies setting reduction targets around their purchasing decisions need the market-based method for tracking against those goals.
- **Granularity varies by country:** Some countries publish only national averages; others have fine-grained regional factors.

## Related

- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[sources/ghg-protocol-scope-2-guidance|GHG Protocol Scope 2 Guidance]]
