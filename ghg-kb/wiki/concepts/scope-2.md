---
id: scope-2
type: concept
title: "Scope 2 — Electricity Indirect GHG Emissions"
aliases:
  - Scope 2
  - electricity indirect emissions
  - purchased electricity emissions
jurisdiction: Global
scope: [2]
business_size: any
tags: [scope-2, indirect-emissions, electricity, purchased-electricity, grid]
last_updated: 2026-04-25
source_count: 2
references:
  - ghg-protocol-corporate-standard
  - ghg-protocol-scope-2-guidance
  - csrd
  - esrs-e1
parent: operational-boundary
calculated_by:
  - scope-2-location-based
  - scope-2-market-based
---

## Definition

Scope 2 covers **indirect GHG emissions from the generation of purchased electricity, steam, heat, and cooling** consumed by the reporting company. The emissions physically occur at the power plant or heat source, not at the company's facility. Scope 2 is an accounting construct that attributes those remote emissions to the consuming company.

The **GHG Protocol Scope 2 Guidance** (2015) is an official amendment to the Corporate Standard that introduced mandatory dual reporting — companies must now report scope 2 using both the location-based method and the market-based method.

(→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard]]) (→ [[sources/ghg-protocol-scope-2-guidance|GHG Protocol Scope 2 Guidance]])

## Why It Matters

Purchased electricity is a major source of GHG emissions for most businesses and represents a significant reduction opportunity. The GHG Protocol Corporate Standard makes Scope 2 **mandatory** to report alongside Scope 1. Because electricity-related emissions are tied to grid mix and can be influenced through procurement choices (renewable energy certificates, power purchase agreements, on-site generation), Scope 2 is often the most actionable near-term lever for companies.

## Key Distinctions

**What is included in Scope 2:**
- Purchased electricity consumed in operations
- Purchased heat or steam (where applicable — sometimes treated as Scope 2 by convention)

**What is NOT Scope 2 (revised edition change):**
- Electricity purchased for resale to another party — this was **moved to Scope 3** in the revised edition to prevent double counting. Under the first edition, such electricity was included in Scope 2.

**Scope 2 vs. Scope 1:** The company does not control the generating facility. The emissions happen off-site.

**Scope 2 vs. Scope 3:** Scope 2 is limited specifically to purchased electricity (and purchased heat/steam). All other indirect emissions — including transmission and distribution losses from third-party grids, which may be reported separately — are Scope 3.

**Dual reporting is required** — companies with operations in markets providing contractual instruments must report BOTH methods and label each:
- **Location-based method:** Uses average grid emission factors for the geographic region where consumption occurs. Applies to all grids globally. See [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]].
- **Market-based method:** Uses GHG emission rates from qualifying contractual instruments (RECs, GOs, PPAs, supplier-specific rates) that meet the 8 Scope 2 Quality Criteria. Reflects procurement choices. See [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]].

Companies only in markets without instruments may report location-based only.

**Scope 2 Quality Criteria** — contractual instruments must: (1) convey a GHG emission rate, (2) be unique (no double-counting), (3) be retired on behalf of the reporter, (4) match the reporting vintage, (5) come from the same market as consumption, (6) for utility factors: cover all delivered electricity, (7) for direct contracts: be third-party verified, (8) residual mix must be available or its absence disclosed.

**Residual mix** — the emission factor for unclaimed electricity in a market after all instruments are retired. Used in the market-based method for energy not covered by instruments. Published by the EU Association of Issuing Bodies (AIB) for European markets.

## Calculation Notes

**Location-based:** `Scope 2 (tCO₂e) = Consumption (MWh) × Grid Average Emission Factor (tCO₂e/MWh)`

**Market-based:** `Scope 2 (tCO₂e) = Covered consumption × Instrument emission rate + Uncovered consumption × Residual mix factor`

- Emission factor values are in the external database — do not embed numbers in wiki pages
- For operations without instruments, apply location-based factor in both methods (identical result)
- T&D losses from third-party grids are Scope 3 Category 3, not Scope 2
- Biogenic CO₂ from electricity generation (e.g., biomass combustion) is reported separately from the scopes; only CH₄ and N₂O from biogenic sources are included in Scope 2

## Regulatory References

- **GHG Protocol Corporate Standard (Revised)** — Chapter 4 defines Scope 2; Appendix A provides extended guidance on indirect electricity accounting
- **CSRD / ESRS E1** — mandatory Scope 2 disclosure; E1-6 requires both location-based and market-based Scope 2 (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])
- **CARB MRR** — Scope 2 reporting requirements for covered California entities
- **SB 253 (CCDAA)** — Scope 2 public reporting required for large companies

## Related

- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]]
- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-3|Scope 3 — Other Indirect GHG Emissions]]
- [[concepts/operational-boundary|Operational Boundary]]
- [[regulations/csrd|EU CSRD]] — mandates dual Scope 2 reporting
- [[regulations/esrs-e1|ESRS E1]] — E1-6 requires both location-based and market-based Scope 2
