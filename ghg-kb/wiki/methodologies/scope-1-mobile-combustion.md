---
id: scope-1-mobile-combustion
type: methodology
title: "Scope 1 — Mobile Combustion"
aliases:
  - mobile combustion
  - fleet emissions
  - vehicle fuel emissions
  - on-road vehicle emissions
  - off-road equipment emissions
  - fleet fuel combustion
jurisdiction: Global
scope: [1]
business_size: any
tags: [scope-1, combustion, mobile, fleet, vehicles, gasoline, diesel, on-road, off-road, carb-mrr]
last_updated: 2026-09-14
source_count: 4
references:
  - ghg-protocol-corporate-standard
  - ghg-protocol-scope-3-calc-guidance
  - defra-2024-methodology
  - carb-mrr-2018
parent: scope-1
calculation_spec:
  readiness:
    status: deferred
    blockers:
      - implementation_missing
      - factor_release_missing
      - approved_expectations_missing
  function_id: scope1_mobile_combustion_fuel
  version: 1
  inputs:
    - name: fuel_type
      type: enum
      required: true
      values_from:
        table: emission_factors
        where: { factor_type: combustion-mobile }
        field: substance
      description: "Mobile fuel — Motor Gasoline, Diesel No. 2 (On-road), Biodiesel (B100), Compressed Natural Gas, Liquefied Petroleum Gas, Aviation Gasoline (off-road), Jet Fuel, Residual Fuel Oil (marine). Mobile-specific records, not the stationary-combustion records."
    - name: vehicle_class
      type: enum
      required: true
      values:
        - passenger-car
        - light-duty-truck
        - medium-heavy-duty-vehicle
        - heavy-duty-vehicle
        - motorcycle
        - bus
        - off-road-equipment
        - marine-vessel
        - locomotive
      description: "Vehicle category. Drives CH4/N2O factor selection — CO2 per unit fuel is largely invariant, but CH4/N2O vary by ~10x across classes and emission control tiers."
    - name: model_year_band
      type: string
      default: "post-2010"
      description: "Bands like pre-1995 / 1995-2003 / 2004-2010 / post-2010 — determines emission-control tier for CH4/N2O. Defaults to most-recent band."
    - name: quantity
      type: number
      required: true
      unit_class: volume
      description: "Fuel consumed during the reporting period. Volume (gallons, litres) is the typical input; mass and energy units are converted via the unit_registry."
    - name: unit
      type: string
      required: true
      description: "Input unit. Converted to the factor's denominator unit before applying."
    - name: geography
      type: string
      default: US-national
    - name: regulatory_context
      type: enum
      values: [CARB-MRR, SB-253, ESRS-E1, GHG-Protocol-voluntary, GHG-Protocol]
      required: true
      description: "Carried on the CalculationContext, not in inputs dict."
  factor_query:
    factor_type: combustion-mobile
    substance: $fuel_type
    vehicle_class: $vehicle_class
    model_year_band: $model_year_band
    geography: $geography
    effective_at: $reporting_year
    required_by_contains: $regulatory_context
  formula: "emissions_kg_co2e = quantity_in_factor_unit * factor.value"
  output_unit: kg CO2e
  notes:
    - "Method: Fuel-based (Method 1 on this page). Distance-based (Method 2) will get a separate function_id `scope1_mobile_combustion_distance` in a later version."
    - "Factor records of factor_type='combustion-mobile' must be loaded before this spec is executable. Pending factor extraction from EPA GHG Emission Factors Hub 2025 (Mobile Combustion table within the Emission Factors Hub worksheet) and DEFRA 2024 (Passenger and Freight road tables)."
    - "Schema dependency: the emission_factors table needs a `vehicle_class` column and a `model_year_band` column. Tracked alongside the `unit_class` / `input_unit_canonical` / `required_by` enum schema fixes from the 2026-04-25 readiness audit."
  test_cases:
    - name: "Motor Gasoline — passenger car, 1,000 gallons (post-2010, US-national, CARB-MRR 2025)"
      inputs:
        fuel_type: "Motor Gasoline"
        vehicle_class: "passenger-car"
        model_year_band: "post-2010"
        quantity: 1000
        unit: "gallon"
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: TBD
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: combustion-mobile-motor-gasoline-passenger-car-post-2010-epa-cfr98-2025
      notes: "Pin numerical value against EPA Hub 2025 Mobile Combustion table on factor extraction. Approximate sanity bound: ~8,800 kg CO2e (≈8.8 kg CO2e per gallon for post-2010 light-duty gasoline)."
    - name: "Diesel No. 2 — heavy-duty vehicle, 5,000 gallons (post-2010, US-national, CARB-MRR 2025)"
      inputs:
        fuel_type: "Diesel No. 2 (On-road)"
        vehicle_class: "heavy-duty-vehicle"
        model_year_band: "post-2010"
        quantity: 5000
        unit: "gallon"
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: TBD
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: combustion-mobile-diesel-no2-heavy-duty-vehicle-post-2010-epa-cfr98-2025
      notes: "Pin against EPA Hub 2025. Approximate sanity bound: ~51,000 kg CO2e (≈10.2 kg CO2e per gallon for diesel)."
    - name: "Compressed Natural Gas — bus fleet, 50,000 standard cubic feet (post-2010, US-national, CARB-MRR 2025)"
      inputs:
        fuel_type: "Compressed Natural Gas"
        vehicle_class: "bus"
        model_year_band: "post-2010"
        quantity: 50000
        unit: "scf"
        regulatory_context: "CARB-MRR"
        reporting_year: 2025
      expected:
        value: TBD
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: combustion-mobile-cng-bus-post-2010-epa-cfr98-2025
      notes: "Tests the alt-fuel + transit-bus pathway. Pin against EPA Hub 2025."
---

## Overview

Mobile combustion covers GHG emissions from fuel burned in vehicles and other mobile equipment owned or controlled by the reporting company — passenger cars, light- and heavy-duty trucks, buses, motorcycles, off-road equipment (forklifts, construction machinery, farm equipment), marine vessels, and locomotives. It is the defining Scope 1 source for any organisation operating a fleet, and the second most common Scope 1 source after [[methodologies/scope-1-stationary-combustion|stationary combustion]] across the broader population of reporters.

Like stationary combustion, CO₂ emissions are determined by the carbon content of the fuel and are well-characterised. CH₄ and N₂O emissions, however, are substantially more variable for mobile sources — they depend on engine technology, emission-control equipment, vehicle age, and operating conditions, and can swing by an order of magnitude across vehicle classes and model-year bands. This is why mobile factors are indexed by vehicle class and model-year band in addition to fuel type.

(→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard]] for the Scope 1 framing; → [[sources/defra-2024-methodology|DEFRA 2024 Methodology Paper]] for the distance-based approach across all transport modes)

## When To Use

Any organisation that owns or operates vehicles or mobile equipment under its operational control. Common applications:

- Delivery and logistics fleets (last-mile vans, regional and long-haul trucking) — see [[sectors/transportation-logistics|Transportation & Logistics]] and [[sectors/retail-consumer-goods|Retail & Consumer Goods]]
- Restaurant delivery vehicles and food-truck operations — see [[sectors/restaurants-food-service|Restaurants & Food Service]]
- Sales fleets, field-service vehicles, and pool cars — see [[sectors/professional-services|Professional Services]]
- Farm equipment, on-site harvesters, irrigation pumps — see [[sectors/agriculture-food-production|Agriculture & Food Production]]
- Construction equipment under company control (graders, excavators, generators) — see [[sectors/real-estate-construction|Real Estate & Construction]]
- Owned aircraft, vessels, and rail rolling stock — required at facility level for any operator
- Off-road material handling — forklifts, yard tractors

**What to exclude:**
- Employee-owned vehicles used for commuting (→ [[concepts/scope-3-categories|Scope 3 Cat 7 — Employee Commuting]])
- Business travel in third-party transport — flights on commercial airlines, taxis, rental cars, train tickets (→ [[methodologies/scope-3-cat6-business-travel|Scope 3 Cat 6 — Business Travel]])
- Contracted freight transport not under operational control — third-party logistics providers (→ Scope 3 Cat 4 / Cat 9)
- Refrigerant leaks from vehicle A/C and reefer units — these are Scope 1 but **fugitive**, not combustion (→ [[methodologies/scope-1-fugitive-refrigerants|Scope 1 — Fugitive Refrigerant Emissions]])
- Electricity charged into company-owned EVs — that emission is Scope 2 (charged from the grid) under most reporting schemes, not Scope 1 mobile combustion

## Step-by-Step

There are two methods. Choose the highest-tier method your data supports — the **fuel-based** method is preferred under EPA, GHG Protocol, and CARB MRR guidance, and is the planned v1 of this methodology. Execution is deferred pending reviewed factors, schema/resolver support, a calculation module and independently pinned expected results. The **distance-based** method is the fallback when fuel records are unavailable.

---

### Method 1 — Fuel-Based (Planned; execution deferred)

Tracks fuel consumed by vehicle. Most accurate when fuel records exist (fleet fuel cards, bulk fuel deliveries with logbook attribution, sub-metered fuelling stations).

**Step 1 — Identify all mobile combustion sources within the operational boundary.**

List every vehicle and mobile equipment piece under company operational control. Group by fuel type and vehicle class. Use vehicle registration records, telematics rosters, and equipment asset registers. Include emergency-use vehicles and seasonal equipment even if they were used for only part of the year.

**Step 2 — Collect fuel consumption by vehicle class.**

Preferred sources, in order:
- Fleet fuel card data, broken out by vehicle ID
- Bulk fuel delivery records cross-referenced to assigned vehicles
- Sub-metered fuelling stations on company premises
- Reimbursed fuel receipts from drivers (mileage-based fallback applies if quantity is missing)
- Vehicle telematics fuel-flow data (where instrumented)

For mixed fleets where fuel cards do not distinguish vehicle class, allocate by registered vehicle category and average annual mileage.

**Step 3 — Apply mobile-specific emission factors.**

```
Emissions (kg CO₂e) = Fuel quantity × Mobile EF (kg CO₂e per fuel unit)
```

The combined CO₂e factor incorporates CO₂, CH₄, and N₂O contributions weighted by GWP. The planned mobile factors require applicability review and extraction from candidate sources such as the EPA GHG Emission Factors Hub 2025 (Mobile Combustion table) and the DEFRA 2024 Conversion Factors. No mobile factor records are currently released in the external database; `factor_type = 'combustion-mobile'` remains a proposed schema dependency.

For regulatory reporting requiring individual gas breakdown:

```
CO₂ emissions  = Fuel × CO₂ factor (per fuel unit; invariant across vehicle class)
CH₄ emissions  = Fuel × CH₄ factor (per fuel unit; varies by vehicle class & model year) × GWP_CH₄
N₂O emissions  = Fuel × N₂O factor (per fuel unit; varies by vehicle class & model year) × GWP_N₂O
```

**Step 4 — Aggregate and report.**

Sum across all vehicles, fuels, and classes. Report in tonnes CO₂e (divide kg total by 1,000). Disclose by fuel type and vehicle class in supporting documentation. CARB MRR additionally requires breakdown by source category code.

---

### Method 2 — Distance-Based (Fallback, queued for executable v2)

When fuel records are unavailable, calculate from distance travelled and a per-distance emission factor by vehicle class and fuel type:

```
Emissions (kg CO₂e) = Distance × Distance EF (kg CO₂e per vehicle-km or vehicle-mile)
```

Distance EFs are published by DEFRA (well-validated for UK and broadly applicable) and can be derived from EPA Hub fuel EFs combined with average fuel-economy assumptions for the vehicle class. Distance-based is less accurate than fuel-based because it assumes average fuel economy for the class rather than real fuel consumption, and is generally used only where fleet fuel records are absent (e.g. small SMBs reimbursing employee mileage).

A separate `function_id: scope1_mobile_combustion_distance` will be added to this page in a later version.

---

### Choosing between methods

| Available data | Use |
|---|---|
| Fleet fuel records by vehicle | **Method 1 (Fuel-Based)** |
| Mileage records only (e.g. odometer readings, telematics distance logs) | Method 2 (Distance-Based) |
| Neither — only spend on fuel | Spend-based fallback (least accurate; consider proxy via fuel-spend ÷ price per gallon for the year, then Method 1) |

For partial coverage (some vehicles fuel-tracked, others mileage-tracked), apply Method 1 to the fuel-tracked subset and Method 2 to the rest, document the split, and avoid double-counting.

## Data Requirements

| Data item | Source | Required for | Unit |
|---|---|---|---|
| Fuel consumption per vehicle / class | Fuel cards, bulk delivery logs, telematics | Method 1 | gallons, litres, scf, MMBtu |
| Vehicle class and fuel type | Asset register, vehicle registrations | Both methods | — |
| Model-year band | Asset register | Both methods (drives CH₄/N₂O factor) | — |
| Distance travelled per vehicle / class | Odometer, telematics, mileage logs | Method 2 | miles, km, vehicle-km |
| Fuel emission factor (mobile-specific) | External DB (`factor_type = 'combustion-mobile'`) | Method 1 | kg CO₂e per fuel unit |
| Distance emission factor | External DB (Method 2 factor type, TBD on factor extraction) | Method 2 | kg CO₂e per vehicle-mile |
| GWP₁₀₀ values | External DB (`factor_type = 'refrigerant-gwp'` shared table) | Gas-by-gas reporting | dimensionless |

## Worked Example

*Structure only — retrieve actual factor values from the external database.*

A regional logistics company with a California depot operates a mixed fleet during the year:
- 12 light-duty delivery vans on motor gasoline → 8,500 gallons total
- 8 heavy-duty Class 8 trucks on diesel → 42,000 gallons total
- 3 CNG transit buses (route service) → 580,000 standard cubic feet

Using Method 1:
1. Look up `combustion-mobile` factors for each (fuel × vehicle class × post-2010 model band) at `regulatory_context = CARB-MRR, reporting_year = 2025`.
2. Multiply each fuel quantity by its mobile EF to get kg CO₂e.
3. Sum the three lines for total mobile combustion Scope 1.
4. Divide by 1,000 to report in tCO₂e.

Refrigerant leaks from the trucks' reefer units are calculated separately under [[methodologies/scope-1-fugitive-refrigerants|fugitive refrigerants]] and added to total Scope 1 — they are not part of mobile combustion despite being on the same vehicle.

## Limitations

- CH₄ and N₂O factors carry materially higher uncertainty than CO₂ factors for mobile sources — they vary with engine technology, emission-control tier, fuel quality, and operating conditions; vehicle-class × model-year-band binning reduces but does not eliminate this uncertainty.
- The fuel-based method is silent on the distinction between on-road and off-road operation for the same fuel-vehicle pair; that distinction matters for CARB MRR source-category coding but does not change the CO₂e total at the corporate-inventory level.
- Biofuel blends (E85, B20, B100, renewable diesel) require separate treatment: the biogenic CO₂ component is excluded from the Scope 1 total and reported as a memo item; CH₄ and N₂O from biofuel combustion are still included in Scope 1. Renewable diesel and conventional diesel use different factors despite chemical similarity — confirm fuel pathway against [[regulations/lcfs|LCFS]] designations where applicable.
- Distance-based factors assume average fleet fuel economy for the vehicle class; fleets with materially different fuel economy from class average (e.g. heavily-loaded vs empty heavy-duty trucks) should prefer Method 1.
- Electricity used in EVs is **not** mobile combustion — it is Scope 2 under most reporting schemes. Hybrid vehicles that consume both fuel and grid electricity require both pathways; report fuel under this methodology and grid charging under [[methodologies/scope-2-location-based|Scope 2 location-based]] / [[methodologies/scope-2-market-based|Scope 2 market-based]].
- Refrigerant leaks from vehicle A/C and refrigerated trailers are Scope 1 fugitive, not combustion — see [[methodologies/scope-1-fugitive-refrigerants|fugitive refrigerants]].

## Regulatory References

- **CARB MRR (Title 17 CCR §95111, §95113)** — facility-level mandatory reporting includes mobile combustion for facilities exceeding the 10,000 MT CO₂e threshold; uses fuel-based method with EPA-aligned factors (→ [[regulations/carb-mrr|CARB MRR]])
- **SB 253 (CCDAA)** — Scope 1 disclosure required annually for entities >$1B revenue doing business in California; mobile combustion is included in the Scope 1 boundary (→ [[regulations/sb253-ccdaa|SB 253]])
- **GHG Protocol Corporate Standard** — defines mobile combustion as a Scope 1 source; Chapter 4 catalogues fleet fuel as a direct emission category (→ [[sources/ghg-protocol-corporate-standard|Corporate Standard]])
- **GHG Protocol Scope 3 Calculation Guidance** — distinguishes operational-control fleet (Scope 1 mobile combustion, this page) from contracted transport (Scope 3 Cat 4 / Cat 9) and employee commuting (Scope 3 Cat 7); the boundary between Scope 1 and Scope 3 for transportation is set by operational control, not by what is on wheels (→ [[sources/ghg-protocol-scope-3-calc-guidance|Scope 3 Calculation Guidance]])
- **DEFRA 2024 GHG Conversion Factors Methodology Paper** — primary published source for distance-based factors across all road, rail, marine, and aviation modes; globally applicable (→ [[sources/defra-2024-methodology|DEFRA 2024 Methodology]])
- **EPA GHG Emission Factors Hub 2025** — primary source for fuel-based mobile factors in the US (factor records pending extraction from the Mobile Combustion table; downloaded raw, not yet processed into `factor_type = 'combustion-mobile'`)
- **California LCFS** — designates fuel pathway carbon-intensity values that interact with mobile combustion accounting for regulated fuel suppliers; not directly used for corporate inventory but affects fuel-pathway selection for renewable diesel, biodiesel, and CNG biomethane (→ [[regulations/lcfs|LCFS]])

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[methodologies/scope-1-stationary-combustion|Scope 1 — Stationary Combustion]]
- [[methodologies/scope-1-fugitive-refrigerants|Scope 1 — Fugitive Refrigerant Emissions]]
- [[methodologies/scope-3-cat6-business-travel|Scope 3 Cat 6 — Business Travel]]
- [[regulations/carb-mrr|CARB Mandatory Reporting Regulation]]
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/lcfs|California Low Carbon Fuel Standard]]
- [[sectors/transportation-logistics|Transportation & Logistics]]
- [[sectors/retail-consumer-goods|Retail & Consumer Goods — last-mile delivery fleets]]
- [[sectors/restaurants-food-service|Restaurants & Food Service — delivery vehicles]]
- [[sectors/agriculture-food-production|Agriculture & Food Production — farm equipment]]
- [[sectors/real-estate-construction|Real Estate & Construction — construction equipment]]
- [[sectors/professional-services|Professional Services — sales fleets]]
