---
id: transportation-logistics
type: sector
title: "Transportation & Logistics"
aliases:
  - transportation
  - logistics
  - trucking
  - freight
  - shipping
  - fleet operations
  - delivery
  - supply chain transport
  - 3PL
  - third-party logistics
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [transportation, logistics, fleet, trucking, freight, combustion, scope-1, cat-4, eu-ets]
last_updated: 2026-04-25
source_count: 2
references:
  - sb253-ccdaa
  - sb261
  - carb-mrr
  - lcfs
  - csrd
  - esrs-e1
  - eu-ets
  - eu-directive-ets-revision-2023-959
  - scope-1
  - scope-2
  - scope-3-categories
  - scope-2-location-based
calculated_by:
  - scope-2-location-based
---

## Profile

Transportation and logistics companies — trucking fleets, freight forwarders, shipping lines, airlines, rail operators, courier and last-mile delivery services — are among the most Scope 1-intensive sectors. Fleet fuel combustion is the defining emission source.

The sector divides into two fundamentally different GHG profiles based on asset ownership:

**Asset-heavy operators (own the vehicles):** Trucking companies, airlines, shipping lines, rail operators. Scope 1 from fuel combustion in owned vehicles is large and directly controlled. Scope 2 is growing as electric vehicle and electric rail adoption increases. Scope 3 is relatively smaller but includes upstream fuel production (Cat 3) and supply chain emissions.

**Asset-light operators (contract third-party carriers):** Third-party logistics providers (3PLs), freight brokers, non-vessel-operating common carriers (NVOCCs), and freight forwarders that charter or hire transport from other companies. Their direct Scope 1 is minimal (office buildings, small local fleet). The emissions from contracted transport services fall in **Scope 3 Category 4** (upstream transportation and distribution) — which can be enormous, sometimes matching or exceeding Scope 1 figures for comparable asset-heavy operators. This distinction is the most important boundary question in the sector.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000 and entity does business in California. Large trucking companies, logistics operators, airlines, and freight forwarders qualify. First Scope 1/2 disclosure due 2026-08-10. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000. Physical climate risk (fuel price volatility, extreme weather disruption to routes) and transition risk (EV mandates, fuel regulations) are both highly material. (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Applies to California fuel suppliers and to stationary sources at logistics facilities (fuel terminals, rail yards, warehouse boilers). Fuel suppliers above 10,000 MT CO2e threshold must report. (→ [[regulations/carb-mrr|CARB MRR]])
- **LCFS (Low Carbon Fuel Standard):** Title 17 CCR §§95480–95503 (effective 2025-07-01). Direct compliance obligation for California gasoline/diesel/jet fuel producers and importers (deficits) and a credit-revenue opportunity for fleet operators of CNG/LNG/H2/EV vehicles via opt-in fuel reporting (the EDU, charging-equipment owner, hydrogen station owner, or biomethane producer is the credit generator). Quarterly fuel transactions reports + annual compliance report due April 30; up to $1,000 per uncleared deficit per day. The 2025 amendment dropped the gasoline benchmark from 87.01 to 76.60 gCO2e/MJ for fuel transactions on/after 2025-07-01, declining to 9.91 by 2045. Asset-heavy fleet electrification and biomethane/RNG procurement in California are partially funded by LCFS credit revenue. (→ [[regulations/lcfs|LCFS]])

**EU:**
- **EU ETS (Aviation):** Intra-EEA flights have been covered since 2012; aviation allowances (EUAA) are separate from the main ETS allowances. Scope expanded under the Fit for 55 package. Annual verified emissions report due 31 March; allowance surrender due 30 September (deadline shifted from 30 April by Directive (EU) 2023/959). The aviation-specific phase-out of free allowances and the integration of CORSIA / sustainable aviation fuel allowances are governed by sister Directive (EU) 2023/958 (not yet ingested). (→ [[regulations/eu-ets|EU ETS]])
- **EU ETS (Maritime) — added by Directive (EU) 2023/959:** Maritime transport (ships ≥ 5,000 GT, per Regulation (EU) 2015/757) included in EU ETS from 2024. Voyages between two EU ports and emissions within EU ports covered at 100%; voyages with one EU and one non-EU port covered at 50%. Phased surrender obligations: 40% of 2024 verified emissions, 70% of 2025, 100% from 2026. CH₄ and N₂O become covered for maritime from 1 January 2026; offshore ships from 2027. The **shipping company** (ISM Code "company") is the regulated entity, with cost pass-through right (Article 3gc) where fuel/operations are contracted to a charterer. Anti-evasion list of "neighbouring container transhipment ports" (>65% transhipment share, <300 nm from an EU port) treats those calls as EU port calls. (→ [[regulations/eu-ets|EU ETS]], [[sources/eu-directive-ets-revision-2023-959|Directive 2023/959]])
- **EU ETS2 (Road Transport Fuel) — Chapter IVa, trading from 2027:** A separate parallel cap-and-trade system for fuels released for consumption in road transport (IPCC source category 1A3b, excluding agricultural vehicles on paved roads), buildings, and additional sectors. Compliance falls on **fuel suppliers / wholesalers** (regulated entities defined by reference to Council Directive (EU) 2020/262 on excise duties), **not on transport operators or end-user drivers**. Permit required from 1 January 2025; trading and first surrender obligation from 2027 (first surrender deadline 31 May 2028); possible one-year delay to 2028 if Article 30k gas/oil price triggers fire. For 3PLs and asset-light freight forwarders, ETS2 will manifest as a fuel-cost increase passed through by suppliers and carriers. (→ [[regulations/eu-ets|EU ETS]], [[sources/eu-directive-ets-revision-2023-959|Directive 2023/959]])
- **CSRD / ESRS E1:** Applies to large transport and logistics companies with EU operations or listings meeting CSRD thresholds. EU ETS-covered Scope 1 percentage must be disclosed under ESRS E1-6. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

| Source | Applicability | Notes |
|---|---|---|
| Diesel — heavy goods vehicles (HGVs) | Trucking, freight | Primary Scope 1 source for road freight operators |
| Diesel — delivery vans and light commercial vehicles | Last-mile delivery, couriers | Growing electrification pressure from CARB Advanced Clean Trucks rule |
| Jet fuel (Jet-A/JPA-1) | Airlines, air freight | Combustion + non-CO2 effects (contrails, NOx) — only CO2 counts in GHG inventories |
| Bunker fuel (HFO, MDO, LNG) | Shipping, maritime operators | Scope 1; EU ETS coverage phasing in 2024–2026 |
| Diesel/LNG — locomotives | Rail freight operators | Electric rail → Scope 2 instead |
| CNG / LNG — fleet vehicles | Companies transitioning from diesel | Lower CO2 per km but methane slip risk |
| Refrigerants (HFCs) | Refrigerated transport (reefer trucks, cold chain vessels) | Leakage during coupling/uncoupling; significant in fresh food and pharma logistics |
| Diesel — yard equipment and forklifts | Distribution centers, ports | |
| Natural gas — terminal and depot heating | Logistics hubs | Secondary source |

### Scope 2

| Source | Notes |
|---|---|
| Electric vehicle (EV) charging | Growing rapidly as fleets electrify under CARB Advanced Clean Trucks mandate |
| Warehouse and depot electricity | Conveyor systems, refrigeration, lighting, loading docks |
| Electric rail traction | Applies to rail operators on electrified routes |
| Office electricity | Minor relative to fleet emissions |

As fleets electrify, Scope 2 will grow relative to Scope 1. Dual reporting required. (→ [[methodologies/scope-2-location-based|Location-Based]])

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 3** — Fuel & energy-related activities | All fleet operators | Medium-high — upstream extraction, refining, and distribution of diesel, jet fuel, and bunker fuel |
| **Cat 4** — Upstream transportation & distribution | Asset-light 3PLs and freight forwarders | **High** — contracted carrier emissions; may exceed Scope 1 for 3PLs |
| **Cat 7** — Employee commuting | Large logistics workforces | Medium |
| **Cat 1** — Purchased goods & services | Vehicle parts, tires, maintenance | Low–medium |
| **Cat 2** — Capital goods | Fleet acquisition (trucks, aircraft, vessels) | Low — typically amortized over vehicle lifetime |

**Cat 4 for 3PLs:** A freight forwarder that charters aircraft or hires trucking companies reports those transport emissions in Cat 4. The calculation uses distance-based methods (tonne-km × modal emission factor) or fuel-based methods where fuel data is available from carriers.

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Diesel / jet fuel / bunker — owned fleet | Fuel-based: fuel consumption × combustion emission factor | Fuel purchase records (litres or tonnes) by vehicle/route |
| Road freight — contracted carriers | Distance-based: tonne-km × road freight emission factor | Shipment weight and distance data; carrier-reported emission factors where available |
| Air freight — contracted | Distance-based: tonne-km × air freight emission factor (ICAO method) | Freight manifests (kg and route) |
| Maritime — contracted | Distance-based: tonne-km × vessel type emission factor | Bill of lading data (TEUs, routes) |
| Refrigerant leakage | Refrigerant tracking: purchases minus verified disposals | Maintenance and refrigerant procurement records |
| Scope 2 electricity (EV charging, warehouses) | Location-based; market-based if RECs held | kWh by location; utility bills |
| Cat 3 upstream fuel | GHG Protocol Scope 3 Tier 1: fuel quantity × upstream emission factor | Fuel volumes (derived from Scope 1 data) |

**Fuel-based vs. distance-based:** Fuel-based methods are always preferred where fuel consumption data is available — they capture real operating conditions. Distance-based (tonne-km) methods are the fallback for contracted transport where carrier fuel data is not accessible. The Scope 3 Calculation Guidance provides modal emission factors for road, rail, air, and sea. (→ [[sources/ghg-protocol-scope-3-calc-guidance|Scope 3 Calculation Guidance]])

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-04-10** | CARB MRR annual report due | CA facilities/fuel suppliers ≥ 10,000 MT CO2e |
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B, doing business in CA |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **31 March (annual)** | EU ETS verified annual emissions report due | EU aviation operators (intra-EEA + departures to CH/UK); EU maritime operators |
| **1 April (annual)** | Maritime emissions marked verified in Union Registry | EU maritime operators |
| **30 September (annual)** | EU ETS allowance surrender (shifted from 30 April by Directive 2023/959) | EU ETS covered aviation and maritime operators |
| **2025-09-30** | First maritime allowance surrender — 40% of 2024 verified emissions | Shipping companies (≥ 5,000 GT) under ETS scope |
| **2026-09-30** | Maritime surrender — 70% of 2025 verified emissions | Shipping companies under ETS scope |
| **2026-01-01** | CH₄ and N₂O become covered ETS gases for maritime | Shipping companies operating EU voyages |
| **2027-09-30** | Maritime surrender — 100% (full compliance) | Shipping companies under ETS scope |
| **2025-01-01** | ETS2 GHG permit required for road-transport-fuel suppliers | Fuel wholesalers / regulated entities under Chapter IVa |
| **2027-01-01** | ETS2 trading begins (may be delayed to 2028 under Article 30k) | Fuel suppliers (buildings, road transport, additional sectors) |
| **2028-05-31** | First ETS2 allowance surrender (covering 2027 verified emissions) | ETS2 regulated entities |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU transport and logistics companies with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME transport operators |

## Sub-sectors

- **Long-Haul Trucking (TL/LTL)** — diesel Scope 1 is the entire story; Cat 3 upstream fuel is a consistent secondary source; CARB Advanced Clean Trucks rule creates significant transition risk
- **Last-Mile Delivery** — high vehicle count, short routes; electrification economics are favorable; urban congestion creates idling emissions not captured well by distance-based methods
- **Freight Forwarding & 3PLs** — asset-light; Cat 4 dominates; Scope 3 data quality is the central reporting challenge; carrier data requests and GLEC Framework are the primary tools
- **Airlines & Air Freight** — jet fuel Scope 1 is large; non-CO2 effects (contrails, NOx) are real but excluded from standard GHG inventories; EU ETS aviation allowances (EUAA) create direct compliance cost for EU carriers
- **Maritime Shipping** — bunker fuel; EU ETS coverage from 2024; IMO Carbon Intensity Indicator (CII) creates separate fleet-level compliance
- **Rail Freight** — diesel rail → Scope 1 heavy; electric rail → Scope 2 heavy; emissions per tonne-km significantly lower than road or air
- **Warehousing & Distribution** — Scope 2 electricity dominant; refrigerated warehousing adds HFC Scope 1; automation increases electricity intensity

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 3 and Cat 4 are most material for this sector
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[regulations/carb-mrr|California Mandatory Reporting Regulation (CARB MRR)]] — fuel suppliers; stationary sources at logistics facilities
- [[regulations/lcfs|California Low Carbon Fuel Standard (LCFS)]] — declining transportation-fuel CI benchmarks; deficit obligation for CARBOB/diesel/jet importers and producers; opt-in credit-generation pathway for fleet electrification, RNG/CNG, hydrogen, and alternative jet fuel
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/eu-ets|EU ETS]] — covers aviation (intra-EEA) and maritime (EU voyages) operators
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — EU ETS Scope 1 % disclosure required under E1-6
- [[organizations/carb|California Air Resources Board (CARB)]]
- [[organizations/eu-commission|European Commission]] — administers EU ETS aviation and maritime coverage
