---
id: scope-2-market-based
type: methodology
title: "Scope 2 Market-Based Method"
aliases:
  - market-based method
  - contractual instrument method
  - EAC method
  - REC method
jurisdiction: Global
scope: [2]
business_size: any
tags: [scope-2, methodology, market-based, RECs, GOs, PPAs, energy-attribute-certificates, EACs]
last_updated: 2026-04-25
source_count: 1
references:
  - ghg-protocol-scope-2-guidance
parent: scope-2
calculation_spec:
  function_id: scope2_market_based
  version: 1
  inputs:
    - name: contracted_consumption
      type: number
      required: true
      unit_class: energy
      description: "Energy covered by qualifying contractual instruments (RECs, GOs, PPAs, supplier-specific rate)."
    - name: contracted_unit
      type: string
      required: true
      description: "Unit alias for contracted_consumption."
    - name: contracted_factor_kg_per_mwh
      type: number
      required: true
      description: "Emission rate of the contractual instrument. Each instrument is unique; not in DB."
    - name: uncovered_consumption
      type: number
      required: true
      unit_class: energy
      description: "Energy not covered by any instrument; residual-mix factor applies."
    - name: uncovered_unit
      type: string
      required: true
    - name: grid_geography
      type: string
      required: true
      description: "eGRID-style geography for residual-mix proxy lookup (CAMX, ERCT, etc.)."
    - name: residual_mix_factor_kg_per_mwh
      type: number
      description: "Optional override. When supplied, the eGRID residual-mix proxy lookup is skipped."
    - name: regulatory_context
      type: enum
      values: [CARB-MRR, SB-253, ESRS-E1, GHG-Protocol-voluntary, GHG-Protocol]
      required: true
      description: "Carried on the CalculationContext."
  factor_query:
    # Multi-factor: keyed query blocks document each lookup. Module performs them.
    residual_mix_proxy:
      factor_type: electricity-grid
      geography: $grid_geography
      effective_at: $reporting_year
      required_by_contains: $regulatory_context
      note: "Used only when residual_mix_factor_kg_per_mwh input is not supplied. Documented fallback per methodology page."
    contracted_instrument:
      source: user_input
      field: contracted_factor_kg_per_mwh
      note: "Each contractual instrument is unique; emission rate must be supplied by the user (PPA terms, supplier disclosure, REC vintage rate). Synthetic FactorReference is created on the result for provenance."
  formula: "emissions_kg_co2e = contracted_mwh * contracted_factor + uncovered_mwh * residual_factor"
  output_unit: kg CO2e
  test_cases:
    - name: "California 1,000 MWh — 600 MWh wind PPA (0 kg/MWh) + 400 MWh uncovered (CAMX residual proxy)"
      inputs:
        contracted_consumption: 600
        contracted_unit: "MWh"
        contracted_factor_kg_per_mwh: 0.0
        uncovered_consumption: 400
        uncovered_unit: "MWh"
        grid_geography: "CAMX"
        regulatory_context: "SB-253"
        reporting_year: 2025
      expected:
        value: 78016.12
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: electricity-grid-camx-egrid-2023
    - name: "100% covered by REC at 0 kg/MWh — emissions = 0"
      inputs:
        contracted_consumption: 1000
        contracted_unit: "MWh"
        contracted_factor_kg_per_mwh: 0.0
        uncovered_consumption: 0
        uncovered_unit: "MWh"
        grid_geography: "CAMX"
        regulatory_context: "SB-253"
        reporting_year: 2025
      expected:
        value: 0.0
        unit: "kg CO2e"
        tolerance_pct: 1.0
      factor_used: electricity-grid-camx-egrid-2023
    - name: "Explicit residual-mix override skips DB lookup (no eGRID factor cited)"
      inputs:
        contracted_consumption: 600
        contracted_unit: "MWh"
        contracted_factor_kg_per_mwh: 0.0
        uncovered_consumption: 400
        uncovered_unit: "MWh"
        grid_geography: "CAMX"
        residual_mix_factor_kg_per_mwh: 250.0
        regulatory_context: "SB-253"
        reporting_year: 2025
      expected:
        value: 100000.0
        unit: "kg CO2e"
        tolerance_pct: 0.5
      factor_used: user-supplied-residual-CAMX
---

## Overview

The market-based method calculates scope 2 emissions using GHG emission rates from **qualifying contractual instruments** — reflecting the choices a company has made in its electricity procurement. It captures the emissions impact of purchasing decisions such as renewable energy contracts, RECs, and Guarantees of Origin.

The method requires markets that provide consumer choice through differentiated electricity products or supplier-specific data. Where no such market exists, the location-based method is used as the proxy.

(→ [[sources/ghg-protocol-scope-2-guidance|GHG Protocol Scope 2 Guidance]])

## When To Use

- **Required** (alongside location-based) for companies with any operations in markets with contractual instruments — currently including the EU, US, Australia, Japan, India, and most Latin American countries
- Used when companies want their GHG inventory to reflect voluntary renewable energy purchases
- Required for SBTi targets and other programs that credit power purchase agreements and RECs
- Required when setting reduction goals based on electricity procurement strategy

## Step-by-Step

1. **Identify consumption by market** — determine which facilities are in markets with contractual instruments and which are not
2. **Inventory contractual instruments** — collect all RECs, GOs, I-RECs, PPAs, and supplier-specific rates held for the reporting period
3. **Screen against Scope 2 Quality Criteria** — each instrument must pass all applicable criteria (see Data Requirements); failing instruments are ineligible
4. **Apply instrument emission rates** to covered consumption: `Emissions = Consumption × Instrument Emission Rate`
5. **Handle uncovered consumption:**
   - Use the **residual mix** emission factor for the relevant market (published by AIB for EU, state/regional bodies for US)
   - If no residual mix is available: use location-based grid average and disclose the absence in the inventory
6. **Operations without instruments:** apply location-based method (result is identical in both methods)
7. **Label and report** as market-based scope 2 total; report separately from location-based total

## Data Requirements

**Scope 2 Quality Criteria** — all contractual instruments must satisfy:

| # | Criterion |
|---|---|
| 1 | Conveys the direct GHG emission rate of the generation source |
| 2 | Unique claim — no other instrument conveys the same claim for the same MWh |
| 3 | Tracked and retired/redeemed/canceled on behalf of the reporting entity |
| 4 | Vintage matches (or is close to) the reporting period |
| 5 | Sourced from the same market as the energy-consuming operations |
| 6 | Utility-specific factors based on all delivered electricity, not just owned generation |
| 7 | Direct contracts must be third-party verified to be unique |
| 8 | Residual mix is available for the market, or its absence is disclosed |

**Types of qualifying contractual instruments:**
- **RECs** (Renewable Energy Certificates) — US and some other markets
- **GOs** (Guarantees of Origin) — European Union; issued and tracked by the Association of Issuing Bodies (AIB)
- **I-RECs** (International Renewable Energy Certificates) — other markets
- **PPAs** (Power Purchase Agreements) — direct long-term contracts with generators
- **Supplier-specific emission rates** — disclosed by the electricity supplier for their delivered mix

**Residual mix:** The emission factor representing unclaimed electricity after all instruments in a market have been retired. Required to prevent double-counting.

## Worked Example

*Structure only — emission factor values are in the external database.*

A company consumes 1,000 MWh in Germany. It holds EU Guarantees of Origin (wind generation) covering 600 MWh. The remaining 400 MWh is not covered by instruments.

- **600 MWh:** Apply the wind GO emission rate → near-zero market-based emissions
- **400 MWh:** Apply the EU/German residual mix emission factor → market-based emissions for uncovered portion
- **Total:** Sum for the company's German market-based Scope 2

## Limitations

- **Instrument integrity required:** Improperly retired or unverified instruments overstate emissions reductions.
- **Geographic mismatch:** Certificates purchased from distant markets may not reflect local grid improvements.
- **Residual mix gaps:** Not all markets publish residual mix factors; US residual mix differs from location-based average but has historically been similar in aggregate; EU residual mixes vary substantially by country.
- **EU ETS interaction:** Purchasing GOs in an emissions-capped market does not guarantee net system-level reductions unless associated allowances are retired.
- **Scope 2 is not offsets:** Market-based scope 2 reflects the emission rate of purchased energy, not avoided emissions. Offsets are separate from the scopes.

## Related

- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[sources/ghg-protocol-scope-2-guidance|GHG Protocol Scope 2 Guidance]]
