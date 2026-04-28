---
id: agriculture-food-production
type: sector
title: "Agriculture & Food Production"
aliases:
  - agriculture
  - farming
  - food production
  - agribusiness
  - livestock
  - ranching
  - aquaculture
  - food manufacturing
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [agriculture, food-production, livestock, enteric-fermentation, methane, nitrous-oxide, scope-1, cat-1, non-co2]
last_updated: 2026-04-25
source_count: 3
references:
  - sb253-ccdaa
  - sb261
  - carb-mrr
  - csrd
  - esrs-e1
  - scope-1
  - scope-2
  - scope-3-categories
  - land-use-change-emissions
  - co2-removals
  - scope-2-location-based
  - afolu-ipcc-tiers
  - ghg-protocol-land-sector-removals-2026
  - ipcc-ar6-wg3-ch7-afolu-2022
  - ipcc-2019-refinement-overview
calculated_by:
  - scope-2-location-based
  - afolu-ipcc-tiers
---

## Profile

Agriculture has the most distinctive GHG profile of any sector: it is the primary source of **non-CO2 greenhouse gases** in the economy. Methane (CH4, GWP 27.9 over 100 years per IPCC AR6) from livestock digestion and anaerobic processes, and nitrous oxide (N2O, GWP 273) from nitrogen in soils and manure, dominate agricultural inventories. The fact that these gases have much higher GWPs than CO2 means even relatively small farms generate large CO2e totals — and the mitigation levers are fundamentally different from energy-focused sectors.

This sector covers **primary producers** — farms, ranches, dairies, aquaculture operations, and agribusinesses — and **food and beverage manufacturers** that transform raw agricultural commodities into processed products. The Restaurants & Food Service sector covers the downstream end of the food supply chain. The supply chain between them — agricultural commodities as Cat 1 inputs — is typically 70–90% of a food company's total GHG inventory, making agricultural sourcing the highest-leverage decarbonization lever for the entire food system.

Two further distinctions matter:

**Livestock vs. crop operations:** Livestock operations (beef, dairy, pork, poultry) generate large enteric fermentation and manure management emissions. Crop operations generate N2O from soil nitrogen management and CO2/CH4 from land use change. Many operations are mixed.

**Land use change:** Conversion of forests, peatlands, or wetlands to agricultural use releases large amounts of stored carbon. The **GHG Protocol Land Sector and Removals Standard v1.0** (Jan 2026, effective 2027-01-01) makes land use change emissions a **required** corporate-inventory category for companies with significant land-sector activity in operations or value chain — closing what was previously a major boundary exclusion. Cat 1 (purchased agricultural inputs) must include LUC emissions linked to sourcing regions. (→ [[concepts/land-use-change-emissions|Land Use Change Emissions]] · [[ghg-protocol-land-sector-removals-2026|Land Sector and Removals Standard]])

**Sectoral context — IPCC AR6 WG3 Ch. 7:** AFOLU is 13–21% of global anthropogenic GHG (2010–2019). Agricultural CH4 (mostly enteric fermentation) and N2O (mostly fertilizer + manure) account for ~6 GtCO2-eq/yr at AR6 GWP100. Sectoral economic mitigation potential 2020–2050 is 4.1 (1.7–6.7) GtCO2-eq/yr at <USD100/tCO2-eq from soil-carbon management, agroforestry, biochar, improved rice cultivation, and livestock/nutrient management. Bookkeeping models and national GHG inventories disagree on net AFOLU CO2 by ~5.5 GtCO2/yr — relevant to the credibility of agricultural offsetting claims. (→ [[ipcc-ar6-wg3-ch7-afolu-2022|IPCC AR6 WG3 Ch. 7 — AFOLU]])

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000. Large agribusinesses (Dole, Driscoll's, large dairy cooperatives), food processors, and vertically integrated agriculture companies may qualify. Most family farms and mid-size operators are far below threshold. First Scope 1/2 disclosure due 2026-08-10. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000. Physical climate risk (drought, wildfire, heat stress on livestock, shifting growing seasons) is the primary material risk category for this sector. (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Applies to California facilities ≥ 10,000 MT CO2e. Large food processing facilities (slaughterhouses, canneries with large boilers), large dairies with biogas digesters, and fuel suppliers may qualify. (→ [[regulations/carb-mrr|CARB MRR]])
- **SB 1383 / CARB SLCP Regulation:** California's Short-Lived Climate Pollutant Reduction regulation requires dairy and livestock operations to reduce methane emissions from manure management by 40% from 2013 levels by 2030. This is a separate compliance obligation from GHG reporting, administered through the Dairy Digester Research and Development Program (DDRDP) and the Alternative Manure Management Program (AMMP). Not a GHG reporting regulation per se, but directly affects what counts as Scope 1 for large California dairies.

**EU:**
- **CSRD / ESRS E1:** Applies to large agribusinesses with EU operations or listings meeting CSRD thresholds. Agriculture is a priority sector given its share of EU GHG emissions. Non-CO2 gases (enteric fermentation CH4, soil N2O) and deforestation-linked supply chain emissions are expected to be material under the double materiality assessment. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])
- **EU Deforestation Regulation (EUDR):** Effective 2024 (implementation delayed); requires due diligence to ensure commodities (cattle, soy, palm oil, coffee, cocoa, wood, rubber) do not originate from deforested land. Not a GHG reporting regulation but directly linked to Scope 3 Cat 1 land-use disclosure under ESRS E1.

## Typical Emission Sources

### Scope 1

| Source | Applicability | Notes |
|---|---|---|
| **Enteric fermentation** | Cattle, sheep, goats, buffalo | Methane produced during digestion in ruminant animals; **the largest agricultural Scope 1 source globally**; no combustion involved |
| **Manure management — CH4** | Livestock with liquid manure systems | Anaerobic decomposition of manure in lagoons, pits, and tanks; most significant for large dairy and hog operations |
| **Manure management — N2O** | All livestock | Nitrous oxide from manure nitrogen during storage and land application |
| **Agricultural soils — N2O** | All crop operations | Nitrogen fertilizer (synthetic + organic) applied to soils → microbial N2O production; emission rates vary by soil type, moisture, and temperature |
| **Rice cultivation — CH4** | Rice paddies | Anaerobic decomposition under flooded conditions; significant in California's Sacramento Valley rice production |
| Fuel combustion — tractors, harvesters | All farm operations | Diesel; emission factor approach |
| Fuel combustion — irrigation pumps | Irrigated operations | Diesel or natural gas |
| Fuel combustion — grain drying | Grain operations | Natural gas or propane; significant seasonal peak |
| Refrigerants (HFCs) | Cold storage, refrigerated transport | Packing houses, distribution centers |
| On-farm generators | Remote operations | Diesel |

**Enteric fermentation note:** A single beef cow emits approximately 70–120 kg CH4 per year (GWP equivalent ~2,000–3,200 kg CO2e). A feedlot with 10,000 head can emit 20,000–30,000 MT CO2e annually from enteric fermentation alone. This cannot be reduced by switching energy sources — mitigation requires feed additives (e.g., 3-NOP, seaweed extracts), breed selection, or shifts in production systems.

### Scope 2

| Source | Notes |
|---|---|
| Irrigation electricity | Large-scale irrigation is electricity-intensive; the largest single Scope 2 source for many irrigated crop operations |
| Processing facility electricity | Post-harvest processing, cold storage, packing lines |
| Milking and barn ventilation | Dairy operations |
| Greenhouse / controlled-environment agriculture | LED lighting, HVAC, CO2 supplementation — electricity-intensive |

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 1** — Purchased fertilizers | Crop operations | **High** — nitrogen fertilizer manufacture is energy-intensive; ammonia synthesis (Haber-Bosch) is one of the most GHG-intensive industrial processes |
| **Cat 1** — Purchased animal feed | Livestock, aquaculture | **High** — soy meal and corn feed have embedded land-use and energy emissions; fishmeal for aquaculture |
| **Cat 2** — Agricultural machinery | All operations | Low–medium — amortized over long equipment lifetimes |
| **Cat 4** — Upstream transportation | Post-harvest logistics | Medium |
| **Cat 5** — Waste | Food waste, crop residues | Low–medium depending on disposal method |
| **Cat 11** — Use of sold products | Commodity sellers | Low for raw commodities; applicable if sold products require energy for processing or cooking |

**For food and beverage manufacturers using agricultural inputs:** Cat 1 (purchased goods) is where the upstream agricultural emissions land in the manufacturer's inventory. A beef processing company's largest Scope 3 source is the cattle it purchases — their lifetime enteric fermentation and manure emissions are embedded in the purchased commodity. (→ [[concepts/scope-3-categories|Scope 3 Categories]])

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Enteric fermentation | IPCC Tier 1: livestock headcount × annual emission factor by species and production system | Herd count by species; production system (dairy, beef, feedlot) |
| Enteric fermentation (more accurate) | IPCC Tier 2: gross energy intake × methane conversion factor (Ym) | Feed intake data; feed composition analysis |
| Manure management CH4 | IPCC Tier 1: headcount × manure CH4 emission factor by management system | Livestock numbers; manure management system type (lagoon, pit, pasture, digester) |
| Manure management N2O | IPCC Tier 1: nitrogen excretion × N2O conversion factor | Livestock numbers; manure management system |
| Soils N2O (direct) | IPCC Tier 1: nitrogen application × emission factor (EF1 = 0.01 kg N2O-N/kg N) | Fertilizer application records (kg N by type); crop residue data |
| Soils N2O (indirect) | IPCC Tier 1: nitrogen inputs → volatilization → leaching pathways | Fertilizer types and application rates |
| Fuel combustion | Fuel consumption × combustion emission factor | Diesel and fuel purchase records |
| Cat 1 nitrogen fertilizer | Physical quantity × fertilizer-specific emission factor | Fertilizer purchase records (tonnes N content) |
| Cat 1 animal feed | Physical quantity × feed commodity emission factor | Feed purchase records (tonnes) |

**Data tier note:** IPCC Tier 1 uses global default emission factors and is appropriate for initial inventories. Tier 2 uses region- and production-system-specific parameters and is required for national inventories and preferred for large operators claiming emissions reductions. The current authoritative reference is the **2019 Refinement to the 2006 IPCC Guidelines** (Volume 4, AFOLU): livestock Tier 1 EFs now differentiate high-/low-productivity systems; manure MCF is climate-region-keyed; soil N2O direct (EF1) and indirect (EF4, EF5) factors are disaggregated by climate region; rice baseline EFs and water-management scaling factors updated; new flooded-land methods. (→ [[methodologies/afolu-ipcc-tiers|AFOLU IPCC Tier Framework]] · [[ipcc-2019-refinement-overview|IPCC 2019 Refinement]])

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-04-10** | CARB MRR annual report due | CA facilities ≥ 10,000 MT CO2e |
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B, doing business in CA |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **2030** | CARB SLCP 40% dairy methane reduction target | California dairy and livestock operations |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU agribusinesses and food companies with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME agricultural operators |

## Sub-sectors

- **Beef Cattle (Feedlot and Cow-Calf)** — enteric fermentation is the dominant Scope 1 source; no viable direct reduction pathway except feed additives and production system changes; Cat 1 inputs (feed, fertilizer) are the major Scope 3 source for processors
- **Dairy** — enteric fermentation + manure management (lagoon CH4); California dairies subject to CARB SLCP regulation requiring digester deployment or alternative manure management; organic nitrogen from manure is a Co-product
- **Pork and Poultry** — lower enteric fermentation than ruminants but significant manure CH4 (especially hog lagoons); high Cat 1 soy feed dependency
- **Grain and Oilseed Cropping** — soil N2O from nitrogen fertilizer; fuel combustion; low direct emissions relative to livestock but high fertilizer Cat 1 embedded carbon
- **Fruit and Vegetable Production** — refrigerant Scope 1 in cold storage; irrigation electricity; relatively low overall emission intensity compared to livestock
- **Aquaculture** — feed (fishmeal, soy) is Cat 1; pond CH4 from anaerobic sediment; electricity for aeration and water management
- **Food & Beverage Manufacturing** — processes agricultural commodities; combustion and refrigerants for Scope 1; Cat 1 raw material inputs are typically 60–80% of total inventory

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 1 is the critical category linking agriculture to downstream food companies
- [[concepts/land-use-change-emissions|Land Use Change Emissions]] — required component of Cat 1 for sourcing-region attribution
- [[concepts/co2-removals|CO2 Removals]] — soil carbon, agroforestry, biochar; reported separately from gross emissions
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[methodologies/afolu-ipcc-tiers|AFOLU IPCC Tier Framework]] — Tier 1/2/3 for livestock, soils, rice, manure, LUC stock changes
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/carb-mrr|California Mandatory Reporting Regulation (CARB MRR)]]
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — GHG disclosure standard under CSRD; non-CO2 gases and deforestation-linked supply chains expected to be material
- [[ghg-protocol-land-sector-removals-2026|GHG Protocol Land Sector and Removals Standard]] — effective 2027-01-01
- [[ipcc-ar6-wg3-ch7-afolu-2022|IPCC AR6 WG3 Chapter 7 — AFOLU]]
- [[ipcc-2019-refinement-overview|IPCC 2019 Refinement to the 2006 IPCC Guidelines]]
- [[sectors/restaurants-food-service|Restaurants & Food Service]] — the downstream sector; agricultural inputs appear in their Cat 1
