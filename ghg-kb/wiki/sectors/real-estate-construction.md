---
id: real-estate-construction
type: sector
title: "Real Estate & Construction"
aliases:
  - real estate
  - property
  - construction
  - REITs
  - property management
  - commercial real estate
  - residential development
  - developers
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [real-estate, construction, buildings, cat-13, embodied-carbon, refrigerants, scope-2]
last_updated: 2026-04-24
source_count: 0
references:
  - sb253-ccdaa
  - sb261
  - csrd
  - esrs-e1
  - scope-1
  - scope-2
  - scope-3-categories
  - scope-2-location-based
  - scope-2-market-based
calculated_by:
  - scope-2-location-based
  - scope-2-market-based
---

## Profile

Real estate and construction companies straddle two distinct GHG profiles depending on their role in the built environment.

**Real estate operators (landlords, REITs, property managers):** Emissions come primarily from building energy use — heating, cooling, lighting, and elevators in the buildings they own and manage. Scope 1 from on-site combustion and refrigerant leakage, plus Scope 2 from electricity, dominate the operational inventory. The sector's distinctive challenge is the **tenant-landlord boundary**: energy consumed by tenants in leased spaces technically belongs to tenants' Scope 1/2, not the landlord's. Tenant energy appears in the landlord's Scope 3 Category 13 (downstream leased assets). Many large landlords voluntarily report whole-building consumption to reflect their actual influence over building performance.

**Construction companies and developers:** Emissions come from two distinct streams: **operational** (diesel combustion in construction equipment and vehicles during the build phase) and **embodied** (the upstream Scope 3 emissions locked into building materials — concrete, steel, glass, aluminum — before the project is complete). For large developers, Cat 1 embodied carbon in construction materials and Cat 11 use of sold buildings (lifetime energy consumption by buyers) often dwarf operational emissions.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000 and entity does business in California. Large REITs, national developers, and major construction companies qualify. First Scope 1/2 disclosure due 2026-08-10; Scope 3 (including Cat 13) due 2027. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000. Physical climate risk is acutely material for this sector — wildfire, flood, and sea level rise directly affect asset values and insurance costs. (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Unlikely to apply to most real estate operators (building energy doesn't typically reach 10,000 MT at a single facility), but large industrial real estate complexes or facilities with significant on-site generation may qualify. (→ [[regulations/carb-mrr|CARB MRR]])

**EU:**
- **CSRD / ESRS E1:** Applies to large real estate operators and construction companies with EU operations or listings meeting CSRD thresholds. Buildings are the EU's largest energy-consuming sector, making real estate a priority disclosure category. Building energy (Scope 2) and embodied carbon in construction materials (Scope 3 Cat 1) are expected to be material for most in-scope operators. Note: ETS2 (covering fuel distributors for buildings) adds a separate compliance layer for large landlords' heating fuel supply chains from 2027. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]], [[regulations/eu-ets|EU ETS/ETS2]])

## Typical Emission Sources

### Scope 1

| Source | Applicability | Notes |
|---|---|---|
| Natural gas — space heating | Commercial and residential buildings | Boilers, furnaces, perimeter heating |
| Natural gas — domestic hot water | Hotels, multifamily, office with showers | Significant in properties with high occupancy |
| Refrigerants (HFCs) | All commercial buildings | Chiller plants, rooftop HVAC units, packaged DX systems — leakage is the most-missed source |
| Diesel — construction equipment | Construction companies | Excavators, cranes, compactors, generators on site |
| Diesel/gasoline — fleet vehicles | Property management, construction crews | Site visits, materials transport |
| On-site generators (diesel) | Data centers, critical facilities, backup power | |
| LPG / propane | Smaller buildings, rural properties | Space and water heating |

Refrigerant leakage is the most commonly underreported Scope 1 source in commercial real estate. Large chiller plants serving office towers or data centers contain hundreds of kilograms of HFC refrigerant; annual leakage rates of 5–15% are typical without active management.

### Scope 2

| Source | Notes |
|---|---|
| Building electricity — common areas | Lobbies, corridors, car parks, elevators, shared HVAC |
| Building electricity — tenant spaces | Where landlord-metered (gross lease structures); categorized as Scope 3 Cat 13 if sub-metered to tenants |
| Construction site temporary power | Grid-connected temporary supply during build phase |

Dual reporting required. Large commercial landlords increasingly hold PPAs or RECs to reduce market-based Scope 2; this is a primary lever for portfolio decarbonization. (→ [[methodologies/scope-2-location-based|Location-Based]], [[methodologies/scope-2-market-based|Market-Based]])

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 1** — Construction materials | Developers, construction companies | **High** — concrete, steel, aluminum, glass carry significant embedded carbon from manufacture |
| **Cat 13** — Downstream leased assets | Landlords, REITs | **High** — tenant energy consumption in leased spaces; often 2–5× the landlord's direct Scope 2 |
| **Cat 11** — Use of sold products | Residential and commercial developers | **High** — lifetime energy consumption of buildings sold; applies to developers that sell completed assets |
| **Cat 4** — Upstream transportation | Construction companies | Medium — materials delivery to site |
| **Cat 7** — Employee commuting | All operators | Medium |
| **Cat 2** — Capital goods | Equipment-heavy construction companies | Medium |
| **Cat 5** — Waste | Construction waste (demolition, off-cuts) | Low–medium |

**Cat 13 boundary note:** Under GHG Protocol Scope 3 Standard, if the landlord controls HVAC and the tenant cannot independently procure energy, the energy falls in the landlord's Scope 2. If tenants are directly metered and manage their own energy procurement, that energy is in the landlord's Cat 13. The boundary follows control, not physical location.

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Natural gas — buildings | Fuel consumption × combustion factor | Utility bills (therms or MMBtu) by building |
| Refrigerants — HVAC/chillers | Refrigerant tracking: purchases minus disposals | Maintenance logs; refrigerant purchase invoices |
| Diesel — construction equipment | Fuel consumption × combustion factor | Fuel purchase records by project |
| Scope 2 electricity | Dual: location-based + market-based | kWh by building/meter; REC/PPA contracts |
| Cat 1 construction materials | Physical quantity × material-specific emission factor | Bills of quantities: concrete (m³), steel (tonnes), aluminum (tonnes) |
| Cat 13 tenant energy | Tenant energy consumption × grid emission factor | Sub-meter data; tenant energy bills (request as part of green lease clauses) |
| Cat 11 sold buildings | Estimated lifetime energy use × grid factor | Building energy models (ASHRAE, EPC ratings); projected occupancy |

**Green lease clauses** are increasingly used to require tenants to share energy data and meter access — enabling landlords to calculate Cat 13 from actual data rather than modeled estimates.

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B, doing business in CA |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU real estate and construction companies with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME property operators |

## Sub-sectors

- **Commercial Real Estate (Offices & Retail)** — Scope 2 electricity is the largest source; refrigerant leakage from chiller plants is the most commonly missed Scope 1; Cat 13 tenant energy is the largest Scope 3 source
- **Residential Development** — Cat 11 use of sold homes dominates Scope 3; embodied carbon in materials significant; SB 253 thresholds less likely to trigger for smaller developers
- **Industrial & Logistics Real Estate (Warehouses)** — lower energy intensity per m² than offices; refrigerated warehouses (cold storage) have large refrigerant Scope 1
- **Data Center Real Estate** — extreme Scope 2 intensity; large operators hold significant RECs and PPAs for near-zero market-based Scope 2
- **Construction Contractors** — diesel combustion in equipment defines Scope 1; Cat 1 embodied carbon in procured materials is the key Scope 3 source
- **Infrastructure Development** — roads, tunnels, bridges; massive Cat 1 concrete and steel inputs; long asset lives mean embodied carbon per year of use is low

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 1, Cat 11, Cat 13 are most material for this sector
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]]
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — GHG disclosure standard under CSRD
- [[regulations/eu-ets|EU ETS]] — ETS2 affects buildings sector via fuel distributor compliance from 2027
