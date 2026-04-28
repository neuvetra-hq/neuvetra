---
id: afolu-ipcc-tiers
type: methodology
title: "AFOLU IPCC Tier 1 / 2 / 3 Framework"
aliases:
  - IPCC AFOLU tiers
  - AFOLU Tier 1 method
  - AFOLU Tier 2 method
  - AFOLU Tier 3 method
  - IPCC tier framework
jurisdiction: Global
scope: [1, 3]
business_size: any
tags: [ipcc, afolu, agriculture, livestock, soils, methodology, tier-1, tier-2, tier-3, enteric-fermentation, manure, n2o, ch4]
last_updated: 2026-04-25
source_count: 2
references:
  - ipcc-2019-refinement-overview
  - ipcc-ar6-wg3-ch7-afolu-2022
  - ghg-protocol-land-sector-removals-2026
  - agriculture-food-production
  - land-use-change-emissions
  - co2-removals
applies_to:
  - agriculture-food-production
---

## Overview

The IPCC Tier framework is the foundational methodology for activity-based GHG quantification in the **Agriculture, Forestry and Other Land Uses (AFOLU)** sector. It scales from a globally applicable default method (Tier 1) to country-/region-specific (Tier 2) to facility- or model-based (Tier 3). The tiers were formalized in the *2006 IPCC Guidelines for National Greenhouse Gas Inventories* and substantially updated in the *2019 Refinement to the 2006 IPCC Guidelines*.

While the Tier framework was designed for **national** GHG inventories under the UNFCCC, the same emission factors and methods cascade into corporate accounting via:
- The GHG Protocol Land Sector and Removals Standard (Jan 2026), which uses IPCC EFs as Tier 1 defaults
- PCAF Option 2 (physical activity-based emissions), which lists IPCC as a recommended emission-factor source
- CDP, SBTi FLAG, and CSRD/ESRS E1 sector implementation guidance

(→ [[ipcc-2019-refinement-overview|IPCC 2019 Refinement]] · [[ipcc-ar6-wg3-ch7-afolu-2022|IPCC AR6 WG3 Ch. 7]])

## When To Use

Use the AFOLU IPCC Tier framework for:
- Enteric fermentation CH4 (livestock)
- Manure management CH4 and N2O
- Agricultural soils direct and indirect N2O (synthetic and organic N inputs)
- Rice cultivation CH4
- Land use change carbon stock loss/gain (the four pools: AGB, BGB, DOM, SOC)
- Biomass burning (savanna, crop residues)
- Liming and urea application CO2
- Harvested wood products (HWP) carbon stock changes
- Flooded land CO2 and CH4 (added in the 2019 Refinement)

Do *not* use this framework for:
- Stationary or mobile combustion (use IPCC Volume 2 Energy combustion factors instead — different methodology family)
- IPPU sources (IPCC Volume 3)
- Waste sector sources (IPCC Volume 5; Volume 5 has its own tier framework)

## Step-by-Step

### Step 1 — Choose the appropriate Tier per source

Tier choice should reflect data availability and source significance. *Key categories* (those contributing >5% of inventory or critical to trend) merit higher tiers.

| Tier | Data | Activity scale | Typical use |
|---|---|---|---|
| **Tier 1** | Global default EFs, broad activity classes | National or region | First inventory; minor sources; data-limited contexts |
| **Tier 2** | Country/region-specific EFs, finer activity disaggregation | Country / production system | Established inventories; major sources |
| **Tier 3** | Site-specific or process-based model | Facility / plot | Large operators; key categories; verified operations |

Higher tiers are not universally better — they require commensurate data quality and produce defensible results only when the input data themselves are reliable.

### Step 2 — Apply the activity × emission factor formula

The general AFOLU emission equation:

```
Emissions = Σ (Activity_i × EF_i)
              i
```

Examples:

| Source | Tier 1 formula |
|---|---|
| Enteric fermentation CH4 | head_count × annual EF (kg CH4/head/yr by species & production system) |
| Manure CH4 | head_count × VS_excretion × Bo × MCF (system, climate region) |
| Manure N2O | N_excretion × N2O_EF (by management system) |
| Soils direct N2O | total N applied × EF1 (climate-region-disaggregated in 2019 Refinement) |
| Soils indirect N2O | (FRAC_GASF × N_synthetic + FRAC_GASM × N_organic) × EF4 (volatilization) + FRAC_LEACH × EF5 (leaching) |
| Rice cultivation CH4 | area × cultivation_period × EF (with scaling factors for water management, organic amendments) |
| LUC biomass loss | (C_pre − C_post) × area × 44/12 |
| Soil carbon change | (SOC_after − SOC_before) × area × 44/12, amortized over 20 years |

### Step 3 — Apply 2019 Refinement updates where relevant

Major Tier 1 updates introduced in the 2019 Refinement:

- **Livestock Tier 1 EFs** now differentiate high- vs low-productivity systems for major animal categories
- **Enteric Ym (methane conversion rate)** for cattle and buffalo is diet- and productivity-dependent
- **Manure MCF** is keyed to **climate region** (not annual mean temperature) plus a simple monthly-temperature model
- **Soil N2O EFs** disaggregated by **climate region** for both direct (EF1) and indirect (EF4, EF5) pathways
- **Soil-carbon stock-change factors** updated; many show *smaller* anthropogenic impact than 2006 defaults
- **Reference soil C stocks** updated by soil type × climate region from a global dataset
- **Rice Tier 1 baseline EFs**, water-management scaling factors, and organic-amendment conversion factors updated
- **New Flooded-Land methods** (CO2 + non-CO2) moved from appendix to main guidance — Managed Land Proxy with optional anthropogenic component
- **Biochar effects** on cropland and grassland mineral-soil C now have Tier 2/3 methods
- **HWP** updated for stock-change, production, simple-decay, and atmospheric-flow approaches

### Step 4 — Compose into the inventory and check uncertainty

Per the 2019 Refinement, both Approach 1 (error propagation) and Approach 2 (Monte Carlo) uncertainty assessment are accepted. Approach 2 is preferred for AFOLU because activity data uncertainty often follows non-normal distributions (e.g., land-area survey, soil C measurement).

### Step 5 — Apply Global Warming Potentials

Convert CH4 and N2O to CO2-eq using **IPCC AR6 100-year GWP values** (recommended by GHG Protocol LSRS):
- CH4 (non-fossil): 27.9
- CH4 (fossil): 29.8
- N2O: 273

Earlier ARs are still seen in some regulatory regimes (CARB MRR uses AR4; EU ETS used AR5 historically) — disclose the GWP basis used.

## Data Requirements

| Input | Tier 1 source | Tier 2 source | Tier 3 source |
|---|---|---|---|
| Livestock headcount | National statistics | National census | Farm records |
| Animal categories | Default species list | Production system disaggregation | Individual animal performance data |
| Feed intake | — | Diet composition surveys | Per-animal intake records |
| Synthetic N applied | National fertilizer sales | Crop-by-crop application rate | Field-level prescription |
| Organic N applied | Default ratio | Manure N excretion × management losses | Field-level applied manure |
| Soil C stocks | IPCC reference SOC × land-use factors | Country-specific reference SOC | Direct soil sampling or process model |
| Rice area & cultivation period | National agricultural statistics | Province- or system-disaggregated | Field-level plot records |
| Manure management system distribution | Default by region | Country-specific shares | Farm-level system reporting |

## Worked Example

**Beef cattle enteric fermentation CH4 — Tier 1**

A US Midwest beef-cattle operation with 5,000 mature cattle (high-productivity feedlot system).

- IPCC 2019 Refinement Tier 1 EF (mature beef cattle, North America, high-productivity): ~75 kg CH4/head/yr (illustrative — refer to the actual 2019 Refinement Vol. 4 tables for the precise number)
- Annual CH4 emissions = 5,000 × 75 = 375,000 kg CH4 = 375 t CH4
- CO2-eq (AR6 GWP100, non-fossil CH4 = 27.9): 375 × 27.9 = 10,463 t CO2-eq

Tier 2 refinement: replace the 75 kg/head/yr default with a feed-based Ym calculation using the operation's actual ration composition and gross energy intake — often produces a 10–25% lower estimate for high-productivity feedlot diets vs. extensive grazing.

## Limitations

- **Tier 1 defaults are global generalizations.** Where a source is a key category (>5% of inventory) Tier 1 is unlikely to satisfy verification; Tier 2 is generally needed.
- **Activity data quality dominates.** Higher-tier methods amplify both signal and noise — a Tier 3 model with poor activity data is worse than a clean Tier 1.
- **Soil C high inter-annual variability.** Tier 1 stock-change factors give long-run trends; reporting on annual basis without statistical modeling is unreliable.
- **No methodology for tropospheric precursors.** The Tier framework does not provide methods for NOx, NMVOC, CO, NH3 used as ozone or aerosol precursors — only direct GHGs.
- **Bookkeeping vs national-inventory boundary differs.** IPCC AR6 WG3 Ch. 7 documents a 5.5 GtCO2/yr discrepancy between national GHG inventories (using IPCC tiers) and global bookkeeping models — primarily over which forests count as "managed land" and how human-induced environmental-change effects are attributed.
- **2019 Refinement is a refinement, not replacement.** Inventory compilers must consult both the 2006 IPCC Guidelines and the 2019 Refinement; per-section status is given in volume mapping tables.

## Related

- [[ipcc-2019-refinement-overview|IPCC 2019 Refinement to the 2006 IPCC Guidelines — Overview]]
- [[ipcc-ar6-wg3-ch7-afolu-2022|IPCC AR6 WG3 Chapter 7 — AFOLU]]
- [[ghg-protocol-land-sector-removals-2026|GHG Protocol Land Sector and Removals Standard]] — uses IPCC EFs as Tier 1 defaults
- [[concepts/land-use-change-emissions|Land Use Change Emissions]] — applies Tier 1 stock-change factors
- [[concepts/co2-removals|CO2 Removals]] — biological removals quantified via the same Tier framework
- [[sectors/agriculture-food-production|Agriculture & Food Production]]
- [[methodologies/scope-1-stationary-combustion|Scope 1 — Stationary Combustion]] — separate methodology family for combustion sources
