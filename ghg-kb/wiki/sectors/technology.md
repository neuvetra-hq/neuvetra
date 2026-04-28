---
id: technology
type: sector
title: "Technology & Software"
aliases:
  - tech sector
  - software companies
  - SaaS
  - cloud computing
  - data centers
  - hardware manufacturers
  - semiconductors
  - IT services
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [technology, software, saas, data-centers, hardware, semiconductors, cloud, telecommunications, scope-2, cat-11]
last_updated: 2026-04-24
source_count: 0
references:
  - sb253-ccdaa
  - sb261
  - carb-mrr
  - carb-cap-and-trade
  - csrd
  - esrs-e1
  - scope-2
  - scope-3-categories
  - scope-2-market-based
  - scope-2-location-based
calculated_by:
  - scope-2-market-based
  - scope-2-location-based
---

## Profile

Technology and software companies span a wide range of business models — cloud-hosted SaaS, hardware manufacturing, semiconductors, telecommunications, and IT services. From a GHG perspective the sector divides into two distinct profiles:

**Asset-light (software, SaaS, IT services):** Minimal Scope 1; Scope 2 from leased offices and third-party data centers dominates the near-term footprint; Scope 3 is primarily business travel (Cat 6), employee commuting (Cat 7), and purchased cloud services (Cat 1).

**Asset-heavy (hardware, semiconductors, cloud infrastructure):** Scope 2 from owned and operated data centers can be very large; Scope 3 Cat 11 — the electricity consumed by sold devices over their lifetime — often exceeds all other categories combined for consumer electronics manufacturers.

Many of the world's largest technology companies are California-based or operate significantly in California, making SB 253 the primary near-term mandatory compliance driver. EU operations or listings trigger CSRD obligations independently.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000 and entity does business in California. First Scope 1/2 disclosure due 2026-08-10; Scope 3 due 2027 per CARB schedule. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000 and entity does business in California. Biennial TCFD-aligned climate risk report; enforcement suspended under Ninth Circuit injunction as of 2025-11-18. (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Applies only if a California facility emits ≥ 10,000 MT CO2e. Most software and SaaS companies fall below this threshold; large owned data centers in California may qualify. (→ [[regulations/carb-mrr|CARB MRR]])
- **Cap-and-Trade:** Applies only if a California facility's MRR-verified covered emissions reach ≥ 25,000 MT CO2e. Rare for technology companies unless operating very large grid-connected data centers. (→ [[regulations/carb-cap-and-trade|Cap-and-Trade]])

**EU:**
- **CSRD / ESRS E1:** Applies to large EU companies and EU-listed entities meeting at least 2 of 3 thresholds (>250 employees, >€50M turnover, >€25M balance sheet). Technology companies with significant EU operations or EU stock exchange listings are subject to CSRD independently of California obligations. Scope 2 electricity and Scope 3 supply chain emissions are expected to be material for most large technology companies under the double materiality assessment. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

Direct emissions from owned or controlled sources. Typically smaller than Scope 2 for most technology companies. Backup generator diesel and refrigerant leaks are the two sources most commonly underreported.

| Source | Applicability | Notes |
|---|---|---|
| Natural gas combustion | Offices, owned data centers | HVAC, heating |
| Diesel combustion | Owned data centers | Backup generators — material if test-run regularly or used in outages |
| Refrigerants (HFCs) | Data center cooling, office HVAC | High-GWP gases; fugitive leaks from cooling equipment |
| Company vehicle fleet | Field service, sales | Usually small unless operating a large logistics or service fleet |
| Natural gas / propane | On-site cafeterias | Minor |

### Scope 2

Purchased electricity is the dominant emission source for most technology companies. Both methods must be calculated and reported under GHG Protocol dual reporting:

**Location-based:** Uses regional grid average emission factors. Use EPA eGRID factors by grid region for US operations (CAMX for California). (→ [[methodologies/scope-2-location-based|Location-Based Method]])

**Market-based:** Uses contractual instrument rates from RECs, PPAs, or green tariffs. Technology companies are the largest buyers of renewable energy certificates and power purchase agreements — many report near-zero market-based Scope 2 as a result. (→ [[methodologies/scope-2-market-based|Market-Based Method]])

For **leased or co-location data centers** where the company does not hold the electricity contract: use a supplier-specific emission rate if available; otherwise use the location-based grid average.

For **third-party cloud infrastructure** (AWS, Azure, GCP): if the company does not control the data centers, the associated emissions are **Scope 3 Category 1** (purchased services), not Scope 2. Cloud providers publish annual sustainability reports with emission factor data; use supplier-reported rates where available.

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 1** — Purchased goods & services | Hardware procurement, cloud services, software licenses | High for hardware companies and large cloud customers |
| **Cat 2** — Capital goods | Server and networking equipment purchases | High for companies building owned data centers |
| **Cat 3** — Fuel & energy-related | Transmission and distribution losses, upstream fuel | Medium |
| **Cat 4** — Upstream transportation | Hardware shipping from contract manufacturers | Medium for hardware companies |
| **Cat 5** — Waste | E-waste from replaced servers and office hardware | Low–medium |
| **Cat 6** — Business travel | Flights, hotels, rail | High for sales-heavy and pre-IPO companies |
| **Cat 7** — Employee commuting | Office commutes, remote/hybrid work | Medium; meaningfully reduced by remote work policies |
| **Cat 8** — Upstream leased assets | Leased data centers and co-location facilities | High if company leases rather than owns data center space |
| **Cat 11** — Use of sold products | Electricity consumed by sold devices over lifetime | **Dominant category for hardware and consumer electronics** |
| **Cat 12** — End-of-life treatment | E-waste disposal of sold devices | Medium for hardware companies |

**Cat 11 detail:** For consumer electronics manufacturers (laptops, phones, networking equipment, servers), Cat 11 typically represents 60–80% of total corporate GHG inventory. Calculation: average device wattage × estimated lifetime hours × grid emission factor for the end-user geography. Requires product-specific technical specifications and sales volume data. (→ [[concepts/scope-3-categories|Scope 3 Categories]])

**Semiconductors note:** Chip fabrication introduces Scope 1 process gases — perfluorocarbons (PFCs) and sulfur hexafluoride (SF6) — with very high global warming potentials. These are not covered by the standard combustion methodology and require gas-specific emission factors.

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Scope 2 electricity | Dual: market-based (primary) + location-based | Electricity bills (kWh); REC/PPA contracts and instrument rates |
| Scope 1 natural gas | Fuel consumption × combustion emission factor | Gas bills (therms or MMBtu) |
| Scope 1 refrigerants | Refrigerant tracking: purchases minus disposals | Maintenance records, refrigerant type |
| Scope 1 backup generators | Fuel consumption × diesel emission factor | Fuel purchase records or run-hour logs |
| Cat 1 cloud / services | Spend-based (Tier 4) or supplier-reported rate | Invoices; cloud provider ESG sustainability reports |
| Cat 6 business travel | Distance-based using DEFRA emission factors | Flight itineraries, hotel nights, ground transport |
| Cat 7 employee commuting | Employee survey or average-based | Headcount, office locations, hybrid policy |
| Cat 11 use of sold products | Technical specification method | Product wattage specs, lifetime estimates, sales volumes |

(→ [[methodologies/scope-2-market-based|Market-Based Method]], [[methodologies/scope-2-location-based|Location-Based Method]], [[concepts/scope-3-categories|Scope 3 Categories]])

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B, doing business in CA |
| **2026-09-10** | Annual SB 253/261 fee notice issued by CARB | All covered entities |
| **2026-10-10** | Annual fee payment due (60 days after notice) | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B, doing business in CA |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **2030-01-01** | SB 253 Scope 1/2 escalates to reasonable assurance | All SB 253 reporters |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU undertakings with EU operations or listings (>250 employees, >€50M turnover, >€25M balance sheet — 2 of 3) |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SMEs with EU operations |

## Sub-sectors

- **Software & SaaS** — asset-light; Scope 2 from leased offices and third-party cloud; Cat 6/7 are the most material Scope 3 categories
- **Cloud & Hyperscale Data Centers** — very large Scope 2 from owned data centers; renewable energy procurement (PPAs, RECs) is central to near-zero market-based strategy
- **Hardware & Consumer Electronics** — Cat 11 (use of sold products) dominates total inventory; manufacturing supply chain (Cat 1, 2) also material
- **Semiconductors & Chip Manufacturing** — process gases (PFCs, SF6) create significant high-GWP Scope 1; energy-intensive fabrication creates large Scope 2
- **Telecommunications** — network infrastructure electricity (Scope 2) across towers and cable plant dominates; geographically distributed
- **IT Services & Consulting** — profile similar to professional services; business travel (Cat 6) and employee commuting (Cat 7) are primary sources; low Scope 1

## Related

- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 1, 6, 7, 8, 11 are most material for this sector
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]] — preferred for companies with REC/PPA programs
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]] — required alongside market-based for dual reporting
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/carb-mrr|California Mandatory Reporting Regulation (CARB MRR)]]
- [[regulations/carb-cap-and-trade|California Cap-and-Trade / Cap-and-Invest Regulation]]
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — GHG disclosure standard under CSRD
- [[organizations/carb|California Air Resources Board (CARB)]]
- [[organizations/efrag|EFRAG]] — ESRS standard-setter
