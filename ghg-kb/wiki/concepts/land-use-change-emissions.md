---
id: land-use-change-emissions
type: concept
title: "Land Use Change Emissions"
aliases:
  - LUC emissions
  - land use change
  - LULUC
  - LULUCF
  - dLUC
  - sLUC
  - deforestation emissions
jurisdiction: Global
scope: [1, 3]
business_size: any
tags: [land-use-change, lulucf, dluc, sluc, deforestation, biogenic, agriculture, scope-3-cat-1]
last_updated: 2026-04-25
source_count: 2
references:
  - ghg-protocol-land-sector-removals-2026
  - ipcc-ar6-wg3-ch7-afolu-2022
  - scope-3-categories
  - co2-removals
---

## Definition

**Land use change (LUC) emissions** are GHG emissions and removals resulting from a change in land use type (e.g., forest → cropland, grassland → built-up land, wetland → cropland). They include the loss of pre-conversion carbon stocks (above-ground biomass, below-ground biomass, dead organic matter, soil organic carbon) and any non-CO2 emissions associated with the conversion or its preparation (e.g., burning).

The GHG Protocol Land Sector and Removals Standard (v1.0, effective 2027-01-01) makes LUC emissions a **required accounting category** for companies with significant land-sector activity in their operations or value chain, distinct from land management and biogenic product emissions.

(→ [[ghg-protocol-land-sector-removals-2026|GHG Protocol Land Sector and Removals Standard, Chapter 7]])

## Why It Matters

Conversion of native ecosystems is one of the largest single sources of historical anthropogenic CO2. IPCC AR6 WG3 Chapter 7 attributes the majority of the +5.9 ± 4.1 GtCO2/yr net AFOLU CO2 source (2010–2019, book-keeping models) to land-use change — primarily tropical deforestation. For agricultural and food-product companies, LUC emissions associated with sourcing regions (soy, palm oil, beef, cocoa, rubber, paper) often dominate Scope 3 Category 1 — and in some cases exceed all other GHG categories combined.

Regulators are converging on LUC disclosure:
- **EU Deforestation Regulation (EUDR)** — due-diligence requirements for cattle, soy, palm oil, coffee, cocoa, wood, rubber
- **CSRD / ESRS E1** — material LUC-linked Scope 3 must be disclosed
- **GHG Protocol LSRS** — mandatory accounting category for in-scope companies
- **SBTi FLAG (Forest, Land, and Agriculture)** — separate target track for FLAG-related emissions ≥20% of total inventory

## Key Distinctions

**dLUC vs sLUC.** The Land Sector Standard quantifies LUC emissions through one of two approaches; the same approach must be applied consistently across categories.

| Approach | What it does | Use when |
|---|---|---|
| **dLUC** (direct land use change) | Allocates emissions from a specific conversion event to the products grown on the converted land for a fixed amortization period (typically 20 years per IPCC) | Physical traceability to a known land area is established (LMU, harvested area, sourcing region) |
| **sLUC** (statistical land use change) | Allocates a region's average per-hectare conversion emissions to all products sourced from that region, weighted by yield | No or limited traceability; jurisdiction or global spatial boundary applies |

**LUC emissions vs land management emissions vs land carbon leakage.**
- **LUC emissions (Ch. 7):** one-time stock loss/gain from a discrete conversion event, amortized
- **Land management net biogenic CO2 emissions (Ch. 9):** ongoing emissions and removals on land in continuous use under a given management regime (no land-use class change)
- **Land carbon leakage (Ch. 8):** indirect emissions outside the spatial boundary caused by land-use displacement (e.g., displaced food production driving conversion elsewhere)

These are reported separately by the LSRS — not summed into a single "LULUCF" line — to make the underlying drivers visible.

**Scope mapping.** LUC emissions on company-owned/controlled lands are **Scope 1**. LUC emissions in the value chain — typically from cropland or grazing-land expansion in supplier sourcing regions — are **Scope 3 Category 1** (purchased goods and services), and are part of the LSRS-mandated minimum boundary for agricultural inputs. There is no Scope 2 LUC.

**Amortization periods.** IPCC defaults amortize one-off conversion emissions over 20 years following the conversion event. The Land Sector Standard requires disclosure of the chosen amortization period and method.

## Calculation Notes

**LUC emissions from a single conversion event:**

```
LUC_emissions = (C_pre_conversion - C_post_conversion) × area × (44/12) / amortization_period
```

Where C represents per-hectare carbon stocks across the four pools (above-ground biomass, below-ground biomass, dead organic matter, soil organic carbon). The 44/12 factor converts mass of carbon to mass of CO2.

**Per-product allocation (dLUC):** total event-level emissions are allocated to products produced from the converted land during the amortization period, typically by yield × area.

**Per-product allocation (sLUC):** a region-wide statistical LUC factor (e.g., kg CO2e per kg soy from a country) is applied to procurement volumes — used when traceability is below sourcing-region level.

**Default carbon stock data (Tier 1):** IPCC 2006 Guidelines + 2019 Refinement provide default biomass and soil-carbon factors by climate region, ecosystem type, and management system. (→ [[methodologies/afolu-ipcc-tiers|AFOLU IPCC Tier Framework]])

**Spatial boundary requirement (LSRS Requirement 5):** the LUC accounting must use the same spatial boundary as all other land-emission categories for a given product volume, determined by traceability tier (global → jurisdiction → sourcing region → LMU → harvested area).

## Regulatory References

- **GHG Protocol Land Sector and Removals Standard, Chapter 7** — required accounting category, dLUC/sLUC framework
- **IPCC 2006 Guidelines + 2019 Refinement, Volume 4** — default biomass, dead-organic-matter, and soil-carbon stock factors
- **EU Deforestation Regulation (EUDR), Regulation (EU) 2023/1115** — due-diligence requirement for high-LUC-risk commodities
- **ESRS E1** — material LUC-linked Scope 3 disclosure under double materiality
- **SBTi FLAG Guidance** — separate target track for FLAG-related emissions

## Related

- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 1 minimum boundary explicitly includes LUC emissions for agricultural inputs (per LSRS)
- [[concepts/co2-removals|CO2 Removals]] — companion category covering reverse direction (carbon stock gain on land)
- [[methodologies/afolu-ipcc-tiers|AFOLU IPCC Tier Framework]] — Tier 1/2/3 application to biomass and soil-carbon stocks
- [[sectors/agriculture-food-production|Agriculture & Food Production]]
- [[ghg-protocol-land-sector-removals-2026|GHG Protocol Land Sector and Removals Standard]]
- [[ipcc-ar6-wg3-ch7-afolu-2022|IPCC AR6 WG3 Chapter 7 — AFOLU]]
