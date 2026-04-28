---
id: hospitality-hotels
type: sector
title: "Hospitality & Hotels"
aliases:
  - hospitality
  - hotels
  - accommodation
  - resorts
  - tourism
  - lodging
  - event venues
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [hospitality, hotels, accommodation, energy-intensity, refrigerants, scope-2, cat-1, food-service]
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

Hotels, resorts, event venues, and accommodation operators are energy-intensive businesses with a relatively concentrated and manageable GHG profile. Unlike sectors where the boundary question is complex or the dominant source is difficult to measure, hospitality emissions are predominantly building-based — energy for heating, cooling, hot water, laundry, pools, kitchens, and guest room comfort — and the data is almost entirely available from utility bills.

The sector's defining GHG characteristics are:

**High energy intensity per guest-night:** A hotel operates 24/7 whether rooms are occupied or not. HVAC, hot water, and security lighting run continuously. Amenities (pools, spas, restaurants, event ballrooms) add substantial load on top of base building operations. Energy intensity per square meter is typically 2–3× that of a comparable office building.

**Refrigerant leakage is systematically underreported:** Large hotel properties run multiple independent refrigeration systems — HVAC chillers, commercial kitchen walk-in coolers and freezers, bar refrigeration, minibar units, pool heat pumps, and laundry equipment. The cumulative refrigerant inventory in a large hotel can exceed a tonne of HFC refrigerant, and annual leakage from frequent maintenance and turnover of equipment is significant.

**Food and beverage operations add Scope 3 depth:** Hotels with significant F&B — restaurants, room service, event catering — resemble the Restaurants & Food Service sector in their Scope 3 profile. Cat 1 food purchasing, especially meat and dairy, will often be the largest single Scope 3 category for a full-service hotel. (→ [[sectors/restaurants-food-service|Restaurants & Food Service]])

Most independent hotels and small hospitality operators fall well below the $1B SB 253 threshold. The regulation applies primarily to major hotel chains (Marriott, Hilton, Hyatt, IHG) and large integrated hospitality and gaming companies.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000 and entity does business in California. Major hotel chains with California properties qualify. Independent hotels and most regional operators are below threshold. First Scope 1/2 disclosure due 2026-08-10; Scope 3 (including food supply chain Cat 1) due 2027. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000. Physical climate risk is material — wildfire smoke affects resort and outdoor venue operations; sea level rise affects coastal properties; drought affects water-intensive amenities (golf courses, pools). (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Unlikely to apply to most hotels at the facility level. On-site natural gas boilers, generators, or laundry plants at very large convention hotels might approach the 10,000 MT threshold, but most hotel facilities fall below. (→ [[regulations/carb-mrr|CARB MRR]])

**EU:**
- **CSRD / ESRS E1:** Applies to large hospitality groups with EU operations or listings meeting CSRD thresholds. Several of the world's largest hotel chains are EU-listed or have substantial EU operations. Building energy (Scope 2) and food supply chain (Scope 3 Cat 1) emissions are expected to be material for most full-service hotel operators. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

| Source | Applicability | Notes |
|---|---|---|
| Natural gas — space heating | All properties in heating climates | Boilers; fan coil units; corridor and lobby heating |
| Natural gas — domestic hot water | All properties | Guests, laundry, kitchens; hot water is one of the highest hotel energy loads |
| Natural gas — commercial kitchens | Properties with restaurants or event catering | High-intensity cooking equipment |
| **Refrigerants (HFCs)** | All properties | Chiller plants, walk-in coolers, bar refrigeration, minibar units, pool heat pumps; leakage is the most commonly missed Scope 1 source |
| Natural gas / LPG — pool and spa heating | Resort and leisure properties | Indoor and outdoor pools; hot tubs; high thermal load |
| Fleet — shuttle buses, valet vehicles | Hotels with transport services | Diesel or petrol |
| On-site generators (diesel) | Backup power for critical systems | |
| LPG / propane | Outdoor heating (terraces, events), smaller properties | |

### Scope 2

| Source | Notes |
|---|---|
| Electricity — guest rooms | HVAC, lighting, TV, devices; the largest single electricity load in most hotels |
| Electricity — common areas and back of house | Lobbies, corridors, kitchens, laundry, elevators |
| Electricity — HVAC central plant | Chillers, cooling towers, air handling units |
| Electricity — pools and spas | Pumps, filtration, heat exchangers |
| Steam / district heating | Some urban hotels use district heat; counted as Scope 2 |

Electricity dominates most hotels' total energy budget and is the primary decarbonization lever. Dual reporting required. Large hotel chains increasingly hold RECs or green tariffs for near-zero market-based Scope 2. (→ [[methodologies/scope-2-location-based|Location-Based]], [[methodologies/scope-2-market-based|Market-Based]])

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 1** — Food and beverage purchasing | Properties with F&B operations | **High** — meat and dairy procurement follows the same pattern as Restaurants & Food Service; typically the largest Scope 3 category for full-service hotels |
| **Cat 1** — Amenity supplies, linens, toiletries | All properties | Medium — single-use plastics, disposable amenities, textiles |
| **Cat 4** — Food and supply deliveries | All properties | Medium |
| **Cat 7** — Employee commuting | All properties | Medium — hotel workforces are large and often have limited public transport access |
| **Cat 6** — Business travel | Hospitality corporate staff | Low–medium |
| **Cat 8** — Upstream leased assets | Franchised hotels (franchisor perspective) | Medium — franchisor's Scope 3 includes emissions from franchisee hotel operations |

**Franchise vs. owned/managed:** Major hotel brands typically operate as franchise systems — they license the brand to independent owners but do not own or operate most properties. A franchisor's GHG inventory question: do franchisee hotels belong in Scope 3 Cat 8 (upstream leased assets)? Under GHG Protocol, franchised operations where the brand licensor does not control operations are commonly categorized as Cat 8 or omitted from the operational inventory. This is an area where reporting practice varies significantly across chains.

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Natural gas — boilers, water heating, kitchens | Fuel consumption × combustion factor | Utility bills (therms or MMBtu) by property |
| Refrigerants | Refrigerant tracking: purchases minus verified disposals | Maintenance logs; refrigerant procurement records by equipment |
| Fleet vehicles | Fuel consumption × combustion factor | Fuel purchase records |
| Scope 2 electricity | Dual: location-based + market-based | kWh bills by property; REC/green tariff contracts |
| Cat 1 food purchasing | Spend-based (Tier 3) or physical quantity × food category emission factor | F&B purchase records by category; meat and dairy are highest-priority categories |
| Cat 1 non-food supplies | Spend-based using EEIO emission factors | Purchase records by supplier category |
| Cat 7 employee commuting | Commuting survey → distance × mode share × emission factor | Employee survey data; distance to work, transport mode |

**Portfolio normalization:** Large hotel chains use **energy intensity metrics** (kWh/guest-night, kg CO2e/m²) for benchmarking across properties and setting portfolio-level targets. These are the same metrics used by green building certification schemes (LEED, BREEAM, Green Key) and are useful for separating occupancy effects from efficiency improvements.

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B, doing business in CA |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU hotel groups with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME hospitality operators |

## Sub-sectors

- **Full-Service Hotels and Resorts** — highest energy intensity; large F&B operations with meat/dairy supply chain Scope 3; pools, spas, event facilities add to energy load
- **Limited-Service / Budget Hotels** — lower energy intensity; smaller F&B footprint; Scope 1/2 from building energy dominates
- **Convention and Conference Centers** — event-based occupancy creates highly variable energy loads; large commercial kitchens; Cat 7 employee commuting and attendee travel are significant
- **Casino Resorts** — among the most energy-intensive hospitality sub-sectors due to 24/7 gaming floor operations (extreme lighting load), food courts, and entertainment venues
- **Vacation Rentals and Short-Term Lets** — fragmented; typically below mandatory thresholds; platform operators (Airbnb) face Scope 3 Cat 11 questions about listed properties
- **Tourism Operators and Travel Agencies** — asset-light; primary Scope 3 source is guest travel (air, ground) arranged by the operator — Scope 3 Cat 4 or Cat 6 depending on organizational boundary

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 1 food, Cat 7 commuting, Cat 8 franchises most material
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]]
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — GHG disclosure standard under CSRD
- [[sectors/restaurants-food-service|Restaurants & Food Service]] — F&B emissions methodology shared with this sector
