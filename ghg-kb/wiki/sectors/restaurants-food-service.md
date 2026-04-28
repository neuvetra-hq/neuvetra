---
id: restaurants-food-service
type: sector
title: "Restaurants & Food Service"
aliases:
  - restaurants
  - food service
  - cafeterias
  - fast food
  - quick service restaurants
  - QSR
  - catering
  - food & beverage service
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [restaurants, food-service, hospitality, natural-gas, refrigerants, food-waste, scope-1, cat-1, cat-5]
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
calculated_by:
  - scope-2-location-based
---

## Profile

Restaurants and food service businesses range from independent single-location operators to multinational quick-service chains with thousands of locations. This is the primary "small business asking for help" use case for this chatbot — the overwhelming majority of restaurants fall below mandatory reporting thresholds but can benefit from a voluntary GHG inventory for cost reduction, landlord requirements, or supply chain pressure.

From a GHG perspective, the sector has a distinctive profile: **Scope 1 dominates operational emissions** (natural gas cooking, refrigerants), while **Scope 3 Cat 1 — purchased food ingredients — is typically the largest single source overall**, often 5–10× larger than all operational emissions combined. Meat and dairy ingredients carry especially high embedded emissions.

**Mandatory reporting reality check:** Most independent restaurants and small chains are well below SB 253 ($1B revenue) and SB 261 ($500M revenue) thresholds. Large chains — McDonald's, Starbucks, Yum Brands, Darden — qualify. The chatbot should confirm applicability before discussing compliance obligations.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies only if annual revenue exceeds $1,000,000,000 and entity does business in California. Relevant for large national and international chains; not applicable to independent operators or small chains. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies only if annual revenue exceeds $500,000,000 and entity does business in California. A smaller set of large chains. (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Applies only if a single California facility emits ≥ 10,000 MT CO2e. No individual restaurant location approaches this threshold. Not applicable. (→ [[regulations/carb-mrr|CARB MRR]])
- **Cap-and-Trade:** Not applicable to restaurants. (→ [[regulations/carb-cap-and-trade|Cap-and-Trade]])

**Voluntary frameworks:**
Most restaurants doing GHG accounting do so voluntarily — for sustainability reporting, landlord or franchisor requirements, or supply chain pressure from large customers. GHG Protocol Corporate Standard applies for any voluntary inventory. (→ [[organizations/ghg-protocol-initiative|GHG Protocol Initiative]])

**EU:**
- **CSRD / ESRS E1:** Applies to large restaurant chains with EU operations or EU listings meeting CSRD thresholds. Independent restaurants and small chains are not covered. Large chains with significant EU footprints must conduct a double materiality assessment; Cat 1 food supply chain emissions are expected to be material for most in-scope operators. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

Restaurants typically have the highest Scope 1 intensity of any commercial building type due to continuous gas combustion for cooking and high refrigerant load from commercial refrigeration.

| Source | Applicability | Notes |
|---|---|---|
| Natural gas — cooking | Nearly all sit-down restaurants | Ranges, ovens, fryers, grills, broilers, steamers; largest Scope 1 source |
| Natural gas — water heating | Most locations | Dishwashers, hand washing, prep sinks |
| Natural gas — space heating | Cooler climates | HVAC, supplemental heating |
| Propane | Some locations, outdoor areas | Outdoor heaters, some cooking equipment where gas unavailable |
| Refrigerants (HFCs) | All locations | Walk-in coolers and freezers, reach-in refrigerators, ice machines, display cases, HVAC — **commercial refrigeration has among the highest leak rates of any equipment type** |
| Delivery and catering vehicles | Restaurant groups with delivery fleets | Van and truck fleets; Scope 1 if company-owned |

**Refrigerant emphasis:** Commercial refrigeration equipment in restaurants is opened, repaired, and recharged far more frequently than residential systems. Leak rates of 15–25% per year are common for poorly maintained walk-in units. HFC refrigerants (R-404A, R-410A, R-134a) have GWPs of 1,500–4,000× CO2. This makes refrigerant management disproportionately important for restaurant Scope 1 accuracy.

### Scope 2

Electricity powers refrigeration, lighting, ventilation, and some cooking equipment. Typically the second-largest operational emission source after natural gas.

| Source | Notes |
|---|---|
| Commercial refrigeration | Walk-in coolers/freezers, display cases, ice machines — runs 24/7 |
| Lighting | Dining room, kitchen, signage |
| HVAC | Air conditioning dominates in warm climates |
| Kitchen equipment | Electric fryers, ovens, dishwashers, exhaust fans |
| Point-of-sale and IT systems | Terminals, routers, displays — minor |

Use the **location-based method** for restaurant Scope 2 — restaurants rarely hold REC or PPA contracts. Use EPA eGRID factors for California locations (CAMX region). (→ [[methodologies/scope-2-location-based|Location-Based Method]])

### Scope 3

Scope 3 typically dwarfs Scope 1+2 combined for restaurants when food ingredients are included. Cat 1 is almost always the dominant category.

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 1** — Purchased food & beverages | All restaurants | **Very high — often 70–90% of total GHG inventory** |
| **Cat 5** — Waste | All restaurants | High — food waste to landfill generates methane; significant in food service |
| **Cat 4** — Upstream transport | Supplier deliveries to restaurant | Medium — daily produce, protein, and beverage deliveries |
| **Cat 7** — Employee commuting | All restaurants | Medium — high staff headcount relative to revenue |
| **Cat 11** — End-of-life of sold products | Takeout and delivery operations | Medium — single-use packaging (cups, containers, straws) |
| **Cat 6** — Business travel | Corporate offices of chains | Low for most; relevant for chain management teams |

**Cat 1 purchased food detail:** Food ingredient emissions vary enormously by type. Beef and lamb carry the highest embedded emissions per kg due to methane from enteric fermentation and land use change. Dairy is also high. Poultry, pork, and fish are materially lower. Vegetables, grains, and legumes are lowest. For a practical inventory:

- **Tier 4 (spend-based):** Multiply supplier spend by an environmentally extended input-output (EEIO) emission factor for the food category. Least accurate but requires only financial data — appropriate for a first-year inventory.
- **Tier 3 (average-data):** Multiply kg purchased per food category (beef, chicken, dairy, produce, etc.) by average lifecycle emission factors from IPCC or published food LCA databases. More accurate; requires purchase records by food type.
- **Tier 2 (supplier-specific):** Use emission rates published by specific food suppliers. Available from some large distributors and protein companies; rare for produce.

**Cat 5 food waste detail:** Food wasted to landfill decomposes anaerobically and generates methane — a high-GWP gas. The calculation requires: tonnes of food waste × waste disposal method (landfill vs composting vs anaerobic digestion) × waste-type emission factor. Composting and anaerobic digestion have significantly lower GHG impact than landfill. California's SB 1383 mandates food waste diversion for many commercial generators, which incidentally reduces Scope 3 Cat 5.

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Natural gas (all uses) | Fuel consumption × combustion emission factor | Monthly gas bills (therms or MMBtu) by location |
| Refrigerants | Refrigerant tracking: purchases minus disposals | Maintenance service records; refrigerant type and quantity |
| Electricity | Location-based; EPA eGRID by grid region | Monthly electricity bills (kWh) by location |
| Cat 1 food (first year) | Spend-based (Tier 4) | Supplier invoices by food category |
| Cat 1 food (mature inventory) | Average-data by food type (Tier 3) | Purchase records in kg by protein, dairy, produce, grain |
| Cat 5 food waste | Waste quantity × disposal method factor | Waste hauler records; disposal destination |
| Cat 7 employee commuting | Average-based or employee survey | Headcount by location; approximate commute distances |

(→ [[methodologies/scope-2-location-based|Location-Based Method]], [[concepts/scope-3-categories|Scope 3 Categories]])

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B chains doing business in CA |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B chains |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU restaurant chains with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME restaurant operators |

Independent restaurants and small chains: no mandatory California or EU filing obligations under current law.

## Sub-sectors

- **Independent Restaurants** — single or few locations; voluntary inventory only; natural gas and refrigerants dominate; Cat 1 food supply chain is the largest lever
- **Quick Service / Fast Food (QSR)** — high standardization across locations; corporate-level reporting for large chains; drive-through operations add vehicle idling emissions
- **Fast Casual** — similar to QSR; fresh ingredient sourcing increases Cat 1 complexity
- **Full Service / Fine Dining** — higher protein and premium ingredient content increases Cat 1 intensity per meal
- **Cafeterias & Institutional Food Service** — universities, hospitals, corporate campuses; often consolidated under operator entity reporting
- **Catering & Events** — highly variable; transport and single-use packaging add to Cat 4 and Cat 11
- **Coffee Shops & Beverage Focused** — dairy (milk, cream) is the dominant Cat 1 source; equipment electricity significant

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 1, 5, 7 are most material for this sector
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]] — large chains only
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]] — large chains only
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting for large chains
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — GHG disclosure standard under CSRD
- [[organizations/ghg-protocol-initiative|GHG Protocol Initiative]] — voluntary inventory standard
