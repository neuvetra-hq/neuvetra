---
id: scope-1-stationary-combustion
type: methodology
title: "Scope 1 — Stationary Combustion"
aliases:
  - stationary combustion
  - fuel combustion emissions
  - boiler emissions
  - natural gas combustion
  - diesel generator emissions
jurisdiction: Global
scope: [1]
business_size: any
tags: [scope-1, combustion, stationary, natural-gas, diesel, propane, carb-mrr, fuel]
last_updated: 2026-04-25
source_count: 2
references:
  - ghg-protocol-stationary-combustion-guidance
  - ghg-protocol-corporate-standard
  - carb-mrr-2018
parent: scope-1
calculation_spec:
  function_id: scope1_stationary_combustion        # matches calculations/<function_id>.py
  version: 1                                        # bump on factor_query or formula change
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
      unit_class: energy
    - name: unit
      type: string
      required: true
      description: "Input unit; converted to MMBtu before applying the factor."
    - name: geography
      type: string
      default: US-national
    - name: regulatory_context
      type: enum
      values: [CARB-MRR, SB-253, ESRS-E1, GHG-Protocol-voluntary, GHG-Protocol]
      required: true
      description: "Carried on the CalculationContext, not in inputs dict."
  factor_query:
    factor_type: combustion
    substance: $fuel_type
    geography: $geography
    effective_at: $reporting_year
    required_by_contains: $regulatory_context
  formula: "emissions_kg_co2e = quantity_in_MMBtu * factor.value"
  output_unit: kg CO2e
  test_cases:
    - name: "Natural Gas baseline — 5,000 MMBtu under CARB-MRR (2025)"
      inputs:
        fuel_type: "Natural Gas"
        quantity: 5000
        unit: "MMBtu"
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: 265572.5
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: combustion-natural-gas-epa-cfr98-2025
    - name: "Natural Gas in therms — 50,000 therms (= 5,000 MMBtu)"
      inputs:
        fuel_type: "Natural Gas"
        quantity: 50000
        unit: "therm"
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: 265572.5
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: combustion-natural-gas-epa-cfr98-2025
    - name: "Distillate Fuel Oil No. 2 — 27.6 MMBtu (= 200 gallons) under CARB-MRR"
      inputs:
        fuel_type: "Distillate Fuel Oil No. 2"
        quantity: 27.6
        unit: "MMBtu"
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: 2048.0
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: combustion-distillate-fuel-oil-no-2-epa-cfr98-2025
---

## Overview

Stationary combustion covers GHG emissions from fuels burned in fixed equipment owned or controlled by the reporting company — boilers, furnaces, heaters, turbines, engines, and emergency generators. It is the most common Scope 1 source for any organisation operating facilities.

CO₂ from fuel combustion is determined by the carbon content of the fuel; it is relatively straightforward to estimate with published emission factors. CH₄ and N₂O emissions are smaller but depend on combustion technology, fuel type, and maintenance conditions.

(→ [[sources/ghg-protocol-stationary-combustion-guidance|GHG Protocol Stationary Combustion Guidance]])

## When To Use

- Any facility that burns fuel in fixed equipment (offices, warehouses, manufacturing plants, data centers)
- Required for CARB MRR reporting (California facilities ≥ 10,000 MT CO₂e/year)
- Required for SB 253 Scope 1 disclosure
- Applies to: natural gas, diesel, propane/LPG, fuel oil, gasoline, coal, wood residuals, and all other fuels burned on-site

**Does not apply to:**
- Fuel burned in company vehicles (→ mobile combustion, a separate Scope 1 category)
- Electricity or steam purchased from a utility (→ Scope 2)
- Upstream extraction or transport of purchased fuels (→ Scope 3 Cat 3)

## Step-by-Step

**1. Identify all stationary combustion sources**

List every fixed piece of fuel-burning equipment within the organisational boundary: boilers, furnaces, heaters, chillers, backup generators, cooking equipment, on-site cogeneration units.

**2. Collect activity data — fuel consumption**

Obtain total fuel consumed per source per reporting period. Preferred sources in order:
- Utility bills (natural gas in therms or MMBtu)
- Fuel purchase records (diesel/propane in gallons, coal in tons)
- Sub-metering or energy management systems
- Equipment run-hour logs × nameplate fuel consumption rate (fallback)

**3. Convert to a common energy unit (MMBtu)**

If fuel consumption is in volume or mass units, convert to MMBtu using the fuel's higher heating value (HHV):

| Fuel | Typical HHV conversion |
|---|---|
| Natural gas | 1 therm = 0.1 MMBtu; 1 Mcf ≈ 1.02 MMBtu |
| Diesel No. 2 | 1 gallon = 0.1380 MMBtu |
| Propane | 1 gallon = 0.0911 MMBtu |
| Motor gasoline | 1 gallon = 0.1250 MMBtu |

*Do not embed factor values in this wiki — retrieve current HHV and emission factors from the external database.*

**4. Apply emission factors**

```
Emissions (kg CO₂e) = Fuel Consumption (MMBtu) × EF (kg CO₂e / MMBtu)
```

The combined CO₂e factor already incorporates CO₂, CH₄, and N₂O contributions weighted by GWP. Factors are sourced from the EPA GHG Emission Factors Hub and stored in the external database with `factor_type = 'combustion'`.

For regulatory reporting requiring individual gas breakdown:
```
CO₂ emissions  = Fuel (MMBtu) × CO₂ factor (kg CO₂ / MMBtu)
CH₄ emissions  = Fuel (MMBtu) × CH₄ factor (kg CH₄ / MMBtu) × GWP_CH₄
N₂O emissions  = Fuel (MMBtu) × N₂O factor (kg N₂O / MMBtu) × GWP_N₂O
```

**5. Aggregate and report**

Sum across all combustion sources and fuel types. Report in tonnes CO₂e (divide kg total by 1,000). Disclose each fuel type separately in supporting documentation.

## Data Requirements

| Data item | Source | Unit |
|---|---|---|
| Fuel consumption per source | Utility bills, purchase records, meters | Therms, gallons, MMBtu, short tons |
| Fuel type | Equipment specs, purchase records | — |
| Heating value (if not in energy units) | EPA Factors Hub (HHV column) or fuel supplier spec | MMBtu per unit |
| Emission factor | External database (`factor_type = 'combustion'`) | kg CO₂e / MMBtu |

## Worked Example

*Structure only — retrieve actual factor values from the external database.*

A company's California facility burns natural gas in a boiler and diesel in a backup generator:
- Natural gas: 5,000 MMBtu consumed in the year → multiply by natural gas EF
- Diesel No. 2: 200 gallons × 0.1380 MMBtu/gallon = 27.6 MMBtu → multiply by diesel EF
- Sum both results → total facility Scope 1 combustion emissions in kg CO₂e → divide by 1,000 for tCO₂e

## Limitations

- CH₄ and N₂O factors carry higher uncertainty than CO₂ factors; they vary with combustion temperature and maintenance
- Biomass fuels require separate treatment: biogenic CO₂ is excluded from the Scope 1 total and reported as a memo item; CH₄ and N₂O from biomass are still included in Scope 1
- Emergency generator fuel use is included even if the generator ran only for testing

## Regulatory References

- **CARB MRR (Title 17 CCR §95111–95113)** — mandates facility-level stationary combustion reporting using specific fuel-type EFs aligned with the EPA hub; required for California facilities above thresholds (→ [[regulations/carb-mrr|CARB MRR]])
- **SB 253 (CCDAA)** — Scope 1 disclosure required annually for entities > $1B revenue doing business in California (→ [[regulations/sb253-ccdaa|SB 253]])
- **GHG Protocol Corporate Standard** — defines stationary combustion as a Scope 1 source; Chapter 4 (→ [[sources/ghg-protocol-corporate-standard|Corporate Standard]])
- **EPA GHG Emission Factors Hub 2025** — primary source for all EF values used in calculations (→ [[sources/ghg-protocol-stationary-combustion-guidance|GHG Protocol Guidance]])

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[methodologies/scope-1-fugitive-refrigerants|Scope 1 — Fugitive Refrigerant Emissions]]
- [[regulations/carb-mrr|CARB Mandatory Reporting Regulation]]
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
