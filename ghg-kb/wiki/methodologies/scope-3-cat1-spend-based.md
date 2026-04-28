---
id: scope-3-cat1-spend-based
type: methodology
title: "Scope 3 Category 1 — Spend-Based Method (EEIO)"
aliases:
  - spend-based method
  - EEIO method
  - economic input-output
  - USEEIO
  - purchased goods spend-based
  - Scope 3 Cat 1
jurisdiction: US-Federal
scope: [3]
scope3_category: 1
business_size: any
tags: [scope-3, category-1, purchased-goods, spend-based, eeio, useeio, naics, tier-4]
last_updated: 2026-04-25
source_count: 2
references:
  - epa-supply-chain-v130-about
  - ghg-protocol-scope-3-calc-guidance
parent: scope-3-categories
---

## Overview

The spend-based (EEIO) method estimates Scope 3 Category 1 emissions — from purchased goods and services — by multiplying procurement spend by an economy-wide emission intensity factor. It is the least data-intensive calculation approach (GHG Protocol Tier 4) and is widely used as the default when supplier-specific data is unavailable.

Factors are derived from the EPA's USEEIO model (US Environmentally-Extended Input-Output), which attributes national GHG inventory data to every sector of the US economy based on economic input-output relationships. Each factor represents the total upstream supply chain emissions per dollar of economic output in a given commodity sector.

(→ [[sources/epa-supply-chain-v130-about|EPA Supply Chain GHG EF v1.3.0 Documentation]])

## When To Use

- **Default starting point** for any company that lacks supplier-specific emission factors (most companies)
- **Screening pass** to identify which spend categories have the largest emission footprints before investing in primary data collection
- **Mandatory coverage** when better data is unavailable — the GHG Protocol requires disclosure of all material Cat 1 sources, even at Tier 4 accuracy

**Limitations vs. better methods:**
- Tier 4 = lowest data quality; a Tier 1 or 2 supplier-specific approach is always preferred for high-spend, high-emission categories
- US-only: the EPA factors represent US average supply chain intensities; apply with caution to purchases from non-US suppliers
- Dollar-year sensitive: factors are in 2022 USD; spend in other years should be inflation-adjusted

## Step-by-Step

**1. Compile spend data by category**

Export a full list of purchases for the reporting year. Group by vendor or line item. Obtain total spend in USD (any year — adjust in step 3).

**2. Assign NAICS codes**

Map each spend category to the closest 6-digit NAICS-2017 code using the Census Bureau NAICS descriptions. This is the most time-consuming step. Tips:
- Use the vendor's primary business activity, not your use of the product
- Cloud computing → NAICS 518210 (Data Processing, Hosting)
- Office supplies (paper, pens) → NAICS 322122 or 453210
- Air travel → NAICS 481111 (Scheduled Air Transportation)
- Legal services → NAICS 541110 (Offices of Lawyers)

**3. Adjust spend to 2022 USD (optional but recommended)**

The factors are denominated in 2022 USD. To adjust prior-year spend:
```
Adjusted spend (2022 USD) = Actual spend (year Y USD) × PPI_2022 / PPI_Y
```
Use commodity-specific Producer Price Index (PPI) from BLS where available; use general CPI as fallback.

**4. Apply emission factors**

```
Emissions (kg CO₂e) = Adjusted spend (USD2022) × EF (kg CO₂e / USD2022)
```

Retrieve factors from the external database (`factor_type = 'scope3-spend'`, `geography = 'US-national'`). Use the **with-margins** factor (`SEF+MEF`) — this is the recommended value per EPA, as it includes the trade and transport margin emissions from getting goods to the purchaser.

**5. Aggregate and rank**

Sum across all spend categories. Rank by total emissions to identify hot spots for primary data collection in future years.

**6. Report and disclose data quality**

Report Cat 1 total in tCO₂e. Disclose that Tier 4 spend-based method was used and note which categories account for the majority of emissions.

## Data Requirements

| Data item | Source |
|---|---|
| Annual procurement spend by category (USD) | ERP/accounting system, AP ledger |
| NAICS-6 code per category | Census NAICS lookup + manual classification |
| PPI by commodity (if adjusting year) | US BLS Producer Price Index |
| Emission factor | External DB (`factor_type = 'scope3-spend'`) |

## Worked Example

*Structure only — retrieve factor values from the external database.*

A technology company has three major spend categories:
1. Cloud computing (AWS/Azure): $2M spend → assign NAICS 518210 → multiply by factor
2. Professional services (legal/consulting): $500K → assign NAICS 541110 → multiply by factor
3. Hardware components: $1M → assign NAICS 334111 → multiply by factor

Sum the three results for total Cat 1 Scope 3 emissions in kg CO₂e → divide by 1,000 for tCO₂e.

## Emission Factor Ranges (for context)

Factor values range from 0.029 to 3.924 kg CO₂e per USD2022, with a median of 0.173 and a mean of 0.281. High-intensity sectors: cement manufacturing, cattle farming, lime and gypsum. Low-intensity sectors: finance, software, professional services.

## Limitations

- **Economy average, not company-specific:** the factor for "Soybean Farming" represents the US average; an individual farm could be 10× higher or lower
- **No geographic differentiation:** one factor covers the entire US; no state-level or supplier country breakdown
- **Spend ≠ physical units:** inflation, price changes, and volume mix all affect the spend denominator without changing actual physical output
- **Does not support target-setting:** improvements in real-world supply chain emissions may not show up in spend-based numbers if prices change

## Related

- [[concepts/scope-3-categories|Scope 3 Categories — overview of all 15 categories]]
- [[methodologies/scope-3-cat6-business-travel|Scope 3 Cat 6 — Business Travel]]
- [[sources/ghg-protocol-scope-3-calc-guidance|GHG Protocol Scope 3 Calculation Guidance]]
- [[regulations/sb253-ccdaa|California SB 253 — requires Cat 1 disclosure]]
- [[sectors/technology|Technology sector — Cat 1 includes cloud services and hardware]]
- [[sectors/retail-consumer-goods|Retail — Cat 1 is 60–90% of total inventory]]
