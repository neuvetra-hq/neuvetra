---
id: retail-consumer-goods
type: sector
title: "Retail & Consumer Goods"
aliases:
  - retail
  - consumer goods
  - e-commerce
  - wholesale
  - consumer products
  - CPG
  - FMCG
  - fast-moving consumer goods
jurisdiction: Global
scope: [1, 2, 3]
business_size: large
tags: [retail, consumer-goods, cpg, fmcg, e-commerce, supply-chain, cat-1, cat-11, scope-3]
last_updated: 2026-04-24
source_count: 0
references:
  - sb253-ccdaa
  - sb261
  - csrd
  - esrs-e1
  - scope-3-categories
  - scope-2
  - scope-2-location-based
  - scope-2-market-based
calculated_by:
  - scope-2-location-based
  - scope-2-market-based
---

## Profile

Retail and consumer goods companies sell physical products to end consumers — through physical stores, e-commerce, or both. The sector spans grocery chains, general merchandise, apparel, electronics retail, wholesale clubs, and consumer packaged goods (CPG) manufacturers that sell through retail channels.

From a GHG perspective this is a **Scope 3-dominated sector**. Operational emissions (Scope 1/2 from stores, warehouses, offices) are real but relatively small compared to the embedded emissions in purchased merchandise (Cat 1) and the emissions from customer use and disposal of sold products (Cat 11, Cat 12). A grocery chain's Scope 3 from its food supply chain is typically 10–30× its entire operational footprint.

The sector divides into two GHG profiles:

**Pure retailers** (do not manufacture): Scope 3 Cat 1 from purchased merchandise dominates. Operational Scope 1/2 from stores and distribution centers is the near-term calculation focus.

**Vertically integrated / CPG manufacturers** (design and manufacture their own products): Add significant Scope 1 from manufacturing facilities, and Cat 11 from product use phase depending on product type (electronics, appliances, personal care).

Many of the largest US retailers are SB 253-covered entities by revenue and California presence.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000 and entity does business in California. Most national and international retail chains qualify. First Scope 1/2 disclosure due 2026-08-10. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000 and entity does business in California. (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Applies if a California facility (e.g. a large distribution center or cold storage warehouse) emits ≥ 10,000 MT CO2e. Large refrigerated distribution centers may qualify depending on refrigerant load and on-site combustion. (→ [[regulations/carb-mrr|CARB MRR]])

**EU:**
- **CSRD / ESRS E1:** Applies to large retailers with EU operations or EU listings meeting CSRD thresholds. EU retail is one of the largest CSRD-covered sectors by entity count. Supply chain (Cat 1) emissions are expected to be material for virtually all in-scope retailers. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

| Source | Applicability | Notes |
|---|---|---|
| Refrigerants (HFCs) | Grocery, convenience, any retailer with refrigerated display cases | **Largest Scope 1 source for grocery retailers** — supermarket refrigeration systems are among the highest commercial leak-rate equipment |
| Natural gas — space heating | Stores, warehouses, offices | HVAC systems |
| Natural gas / diesel — distribution | Owned truck fleets | Significant for retailers with private label distribution networks |
| Diesel — backup generators | Large stores, data centers, distribution hubs | |
| Natural gas — on-site food prep | Grocery with deli/bakery, restaurants inside stores | |

Grocery and supermarket refrigeration refrigerant leaks are frequently the largest single Scope 1 source — often larger than all fuel combustion combined — and are routinely underreported.

### Scope 2

| Source | Notes |
|---|---|
| Store lighting and HVAC | Retail stores are large consumers of electricity for lighting (historically high; improving with LED) and HVAC |
| Refrigerated display cases | Grocery — open display cases for dairy, beverages, frozen food |
| Distribution center operations | Conveyor systems, lighting, refrigeration |
| Corporate offices | Minor relative to store footprint |

Dual reporting required: location-based and market-based. Large retailers frequently purchase RECs or enter PPAs to reduce market-based Scope 2. (→ [[methodologies/scope-2-location-based|Location-Based]], [[methodologies/scope-2-market-based|Market-Based]])

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 1** — Purchased goods & services | All retailers — the merchandise they sell | **Dominant — typically 60–90% of total inventory for pure retailers** |
| **Cat 4** — Upstream transportation | Supplier-to-DC and DC-to-store logistics | High — especially for imported goods |
| **Cat 5** — Waste | Store and warehouse waste; food waste for grocery | Medium–high for grocery |
| **Cat 6** — Business travel | Corporate and regional management | Low–medium |
| **Cat 7** — Employee commuting | Large store and warehouse workforce | Medium |
| **Cat 9** — Downstream transportation | Customer transport to and from stores | Medium — customers driving to stores |
| **Cat 11** — Use of sold products | Electronics, appliances, personal care, food | High for electronics/appliance retailers; very high for CPG energy products |
| **Cat 12** — End-of-life treatment | Packaging, single-use products | Medium |

**Cat 1 detail:** For a retailer, Cat 1 is the embedded GHG content of every unit of merchandise purchased from suppliers. Calculating this requires either:
- **Spend-based (Tier 4):** Supplier spend × EEIO emission factor by product category. Practical for a first inventory; low accuracy.
- **Average-data (Tier 3):** Physical quantity purchased by product category × average lifecycle emission factor. More accurate for high-volume commodity categories (food, clothing, electronics).
- **Supplier-specific (Tier 2):** Supplier-reported product carbon footprints. Increasingly available from large consumer goods manufacturers; requires supplier engagement program.

**Cat 11 detail:** Only applicable where the product consumes energy during use. Relevant for: electronics retailers (devices draw power), appliance retailers (refrigerators, washing machines), and CPG companies selling energy-using products. Not relevant for clothing, furniture, or most grocery items.

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Scope 1 refrigerants | Refrigerant tracking: purchases minus disposals | Maintenance service records; refrigerant type |
| Scope 1 natural gas | Fuel consumption × combustion factor | Utility bills (therms/MMBtu) |
| Scope 1 owned fleet | Fuel consumption × diesel/petrol factor | Fuel card records or odometer + MPG |
| Scope 2 electricity | Dual: location-based + market-based | kWh bills by location; REC/PPA contracts |
| Cat 1 merchandise (first year) | Spend-based (Tier 4) | Supplier spend by product category |
| Cat 1 merchandise (mature) | Average-data by product type (Tier 3) | Purchase volumes by category |
| Cat 4 upstream logistics | Distance-based or spend-based | Freight invoices; tonne-km data from logistics providers |
| Cat 9 downstream (customer transport) | Average-based (store visits × average distance × modal split) | Store visit data; regional transport statistics |

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B, doing business in CA |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU retailers with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME retailers |

## Sub-sectors

- **Grocery & Supermarket** — refrigerant-heavy Scope 1; food supply chain (Cat 1) and food waste (Cat 5) dominate Scope 3; CARB MRR may apply to large refrigerated DCs
- **General Merchandise / Department Stores** — store electricity (Scope 2) and merchandise supply chain (Cat 1) primary; lower refrigerant Scope 1 than grocery
- **Apparel & Footwear** — Cat 1 from textile manufacturing (often overseas) is dominant; manufacturing energy and dye/chemical processes embedded in supply chain
- **Electronics Retail** — Cat 11 (use of sold electronics) is very large; Cat 1 from hardware manufacturing supply chain also significant
- **E-commerce / Online Retail** — warehouse operations (Scope 2) replace store footprint; last-mile delivery (Cat 4/9) becomes primary Scope 3 focus; packaging waste (Cat 12) material
- **Wholesale & Club Stores** — similar to general merchandise; large distribution center footprint; bulk packaging reduces Cat 12 per unit
- **Consumer Packaged Goods (CPG) Manufacturers** — add Scope 1 from manufacturing; Cat 11 varies by product energy intensity

## Related

- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 1, 4, 9, 11 most material
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]]
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/carb-mrr|California Mandatory Reporting Regulation (CARB MRR)]]
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — GHG disclosure standard under CSRD
- [[organizations/ghg-protocol-initiative|GHG Protocol Initiative]]
