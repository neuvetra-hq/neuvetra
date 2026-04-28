---
id: scope-3-cat6-business-travel
type: methodology
title: "Scope 3 Category 6 — Business Travel"
aliases:
  - business travel emissions
  - Scope 3 Cat 6
  - flight emissions
  - employee travel emissions
  - air travel calculation
jurisdiction: Global
scope: [3]
scope3_category: 6
business_size: any
tags: [scope-3, category-6, business-travel, air-travel, defra, distance-based, flights, hotels]
last_updated: 2026-04-25
source_count: 2
references:
  - defra-2024-methodology
  - ghg-protocol-scope-3-calc-guidance
parent: scope-3-categories
---

## Overview

Scope 3 Category 6 covers GHG emissions from employee travel for business purposes in vehicles not owned or controlled by the reporting company: flights, trains, taxis, rental cars, buses, ferries, and hotel stays.

**Important boundary:** company-owned or -leased vehicles used for business travel are Scope 1 (direct combustion), not Category 6. Category 6 is strictly third-party transport.

For most professional services, consulting, and advisory firms, Cat 6 represents 80–90% of total GHG inventory. It is also material for technology companies, pharma, and any sales-heavy organisation.

(→ [[sources/defra-2024-methodology|DEFRA 2024 GHG Conversion Factors — Methodology Paper]])

## When To Use

- Any organisation with employees travelling for business in third-party vehicles
- Required under CSRD/ESRS E1 for large EU companies reporting Scope 3
- Required under SB 253 for California-filing companies in the Scope 3 disclosure year
- Relevant for all sectors — particularly high for professional services, tech, financial services

## Step-by-Step

**1. Collect travel data**

Sources of activity data, in order of preference:
- Corporate travel management system (most complete — includes all flights, hotels booked through the company)
- Corporate credit card / expense report data
- Employee travel surveys (fallback — has non-response bias)

For each trip collect: origin, destination, transport mode, and class (for air).

**2. Calculate distance**

For flights: use great-circle distance between airports × 1.09 detour factor (GHG Protocol recommendation) — or use origin-destination pairs directly if the emission factor source provides them.

Classify air travel by haul:
- **Domestic / short-haul (≤ 3,700 km):** lower per-km factor; more of the trip is non-cruise (high-thrust) flight phases
- **Long-haul (> 3,700 km):** higher efficiency per km; lower factor per passenger-km

For ground transport: record distance in km or use city-pair lookups.

**3. Apply emission factors by mode**

```
Emissions (kg CO₂e) = Distance (km) × EF (kg CO₂e / passenger.km)
```

Retrieve factors from the external database (`factor_type = 'scope3-distance'`, `scope3_category = 6`). DEFRA 2024 factors are the standard source, covering:

| Mode | Factor basis |
|---|---|
| Air — domestic | Per passenger-km; with and without radiative forcing (RF) |
| Air — short-haul | Per passenger-km; cabin class adjustments |
| Air — long-haul | Per passenger-km; cabin class adjustments |
| Rail | Per passenger-km; UK average or international rail |
| Car (average) | Per passenger-km or vehicle-km |
| Taxi / ride-share | Per passenger-km |
| Bus / coach | Per passenger-km |
| Ferry | Per passenger-km |

**Radiative Forcing (RF):** Aviation emits contrails and NOₓ at altitude that amplify warming beyond the direct CO₂ effect. DEFRA provides factors both with RF (total climate impact; recommended) and without RF (CO₂ only). GHG Protocol allows reporting either way but requires disclosure of which basis is used.

**4. Hotel stays**

Add hotel night emissions:
```
Emissions (kg CO₂e) = Room-nights × EF (kg CO₂e / room-night)
```
DEFRA provides a UK average hotel factor; use it as a global proxy unless country-specific hotel factors are available.

**5. Adjust for cabin class (air travel)**

Economy class is the baseline. Business and first class use a larger seat footprint and therefore allocate a higher share of aircraft emissions per passenger:

| Cabin class | DEFRA multiplier (approximate) |
|---|---|
| Economy | 1.0× |
| Premium economy | ~1.6× |
| Business | ~2.9× |
| First | ~4.0× |

Apply multipliers at the individual trip level if booking data includes class; use a fleet average if not.

**6. Aggregate and report**

Sum by mode. Report Cat 6 total in tCO₂e. Disclose: data source (travel management system vs. survey), RF treatment (with/without), and share of total Scope 3.

## Data Requirements

| Data item | Source |
|---|---|
| Trips by mode and distance | Travel management system, expense reports |
| Cabin class (air) | Booking records |
| Hotel room-nights | Expense reports, travel system |
| Emission factors | External DB (`factor_type = 'scope3-distance'`) |

## Worked Example

*Structure only — retrieve factor values from the external database.*

A consulting firm has three categories of travel in the year:
1. 150 long-haul flights averaging 8,000 km (economy) → 150 × 8,000 km × EF_long-haul_economy
2. 400 short-haul flights averaging 900 km (economy) → 400 × 900 km × EF_short-haul_economy
3. 500 hotel room-nights → 500 × EF_hotel

Sum all three for total Cat 6 emissions in kg CO₂e → divide by 1,000 for tCO₂e.

## Limitations

- **Travel management coverage gaps:** employees booking outside the corporate travel system (personal cards, direct booking) are missed; surveys are needed to estimate leakage
- **DEFRA factors are UK-derived:** for global fleets, they are reasonable proxies but may not reflect regional fleet differences; no better freely available global standard exists
- **RF multipliers are contested:** the IPCC acknowledges high uncertainty in the aviation RF factor; some companies report with and without RF as separate figures
- **Distance vs. actual routing:** great-circle distances understate actual flight paths; applying a detour factor corrects most of the gap

## Regulatory References

- **GHG Protocol Scope 3 Standard, Chapter 11** — defines Cat 6 minimum boundary (Scope 1 and 2 of transport carriers); calculation methods; data quality tiers (→ [[sources/ghg-protocol-scope-3-calc-guidance|Scope 3 Calc Guidance]])
- **ESRS E1 (CSRD)** — requires Scope 3 by category for large EU companies; Cat 6 must be disclosed where material (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])
- **SB 253 (CCDAA)** — Cat 6 must be included in the Scope 3 disclosure (→ [[regulations/sb253-ccdaa|SB 253]])

## Related

- [[concepts/scope-3-categories|Scope 3 Categories — overview of all 15]]
- [[methodologies/scope-3-cat1-spend-based|Scope 3 Cat 1 — Spend-Based]]
- [[sectors/professional-services|Professional Services — Cat 6 typically 80–90% of inventory]]
- [[sectors/technology|Technology sector — Cat 6 high for sales-heavy and pre-IPO companies]]
- [[sources/defra-2024-methodology|DEFRA 2024 Methodology Paper]]
