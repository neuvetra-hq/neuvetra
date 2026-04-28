---
id: manufacturing
type: sector
title: "Manufacturing & Industrial"
aliases:
  - manufacturing
  - industrial
  - factories
  - production facilities
  - heavy industry
  - light manufacturing
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [manufacturing, industrial, process-emissions, scope-1, combustion, carb-mrr, cap-and-trade, eu-ets, cbam]
last_updated: 2026-04-25
source_count: 0
references:
  - sb253-ccdaa
  - sb261
  - carb-mrr
  - carb-cap-and-trade
  - csrd
  - esrs-e1
  - eu-ets
  - cbam
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

Manufacturing companies produce physical goods using raw materials, energy, and industrial processes. From a GHG perspective this is the most **Scope 1-intensive** sector — direct emissions from fuel combustion, industrial processes, and on-site chemical reactions dominate most manufacturers' inventories.

Manufacturing divides into two fundamentally different GHG profiles:

**Combustion-dominated (most manufacturers):** Emissions come primarily from burning fossil fuels for heat and power — natural gas for furnaces, kilns, boilers, and steam. Scope 1 from combustion + Scope 2 from electricity are the primary sources. Examples: food processing, textiles, plastics, general assembly.

**Process-emission-dominated (heavy industry):** Emissions arise from chemical reactions in the production process itself — not just from burning fuel. Examples: cement (calcination of limestone releases CO2), steel (reduction of iron ore), aluminum (electrolysis releases PFCs), chemicals, glass, pulp and paper. These **process emissions** require gas-specific emission factors and cannot be reduced simply by switching fuel or electricity sources.

Manufacturing is the primary sector covered by **CARB MRR** and **Cap-and-Trade** in California, and by **EU ETS** in Europe. Facilities above the 25,000 MT CO2e threshold face compliance obligations beyond disclosure.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000 and entity does business in California. Large manufacturers qualify. First Scope 1/2 disclosure due 2026-08-10. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000. Physical climate risk (supply chain disruption, water stress) and transition risk (carbon pricing, stranded assets) are both material. (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Applies to California facilities emitting ≥ 10,000 MT CO2e. Manufacturing facilities — cement plants, refineries, glass plants, food processing with large boilers — frequently qualify. Annual reporting; verification required above 25,000 MT. (→ [[regulations/carb-mrr|CARB MRR]])
- **Cap-and-Trade:** Applies to California facilities with MRR-verified covered emissions ≥ 25,000 MT CO2e. Cement, petroleum refining, glass, lime, paper, and other heavy industrial sectors are directly covered. (→ [[regulations/carb-cap-and-trade|Cap-and-Trade]])

**EU:**
- **EU ETS:** Directly covers heavy industrial facilities in the EU (cement, steel, aluminum, chemicals, glass, ceramics, paper) above the 20 MW thermal input threshold. Installation-level compliance obligation; verified annual emissions report due 31 March, allowance surrender due 30 September; €100/tonne penalty for shortfalls. Separate from and additional to CSRD reporting. (→ [[regulations/eu-ets|EU ETS]])
- **CBAM (Regulation (EU) 2023/956 as amended by 2025/2083):** Applies to **EU importers** of cement, electricity, fertilisers, iron and steel, aluminium, and hydrogen (Annex I goods) from non-exempt third countries. Manufacturers that import covered precursors or finished goods, and EU producers competing with such imports, are both directly affected — CBAM phases in as EU ETS free allocation phases out for these sectors over 2026-2034. Authorised CBAM Declarant status mandatory from 2026-01-01; first annual CBAM declaration and certificate surrender due **2027-09-30** (for 2026 emissions); de minimis exemption at **50 tonnes/year** net mass aggregated across CN codes (does not apply to electricity or hydrogen). Excess-emissions penalty matches EU ETS rate (€100/tonne, inflation-indexed) per missing certificate; 3-5x for unauthorised importers. (→ [[regulations/cbam|CBAM]])
- **CSRD / ESRS E1:** Applies to large manufacturers with EU operations or listings meeting CSRD thresholds. Manufacturing companies covered by EU ETS must disclose the percentage of Scope 1 emissions covered by EU ETS allowances under ESRS E1-6 — the key quantitative bridge between the two regimes. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

Manufacturing has the most diverse Scope 1 source inventory of any sector. Sources fall into two types:

**Combustion emissions** (from burning fuel):

| Source | Applicability | Notes |
|---|---|---|
| Natural gas — process heat | Nearly all manufacturers | Furnaces, kilns, boilers, dryers, ovens |
| Natural gas — steam generation | Facilities with steam distribution | Paper, chemicals, food processing |
| Diesel / fuel oil — boilers | Facilities without gas access | Backup or primary heating fuel |
| Coal — high-temperature processes | Steel, cement, some chemicals | Declining but still present in heavy industry |
| LPG / propane — process and space heating | Smaller facilities | |
| Vehicle fleet — forklifts, site vehicles | All facilities | Diesel or LPG internal combustion |

**Process emissions** (from chemical reactions — not combustion):

| Source | Applicability | High GWP? |
|---|---|---|
| Calcination (cement) | Cement manufacturing | No — pure CO2 |
| Iron smelting / blast furnace (steel) | Steel manufacturing | No — CO2 and CO |
| Aluminium smelting (electrolysis) | Aluminium production | Yes — PFCs (CF4, C2F6) |
| Chemical production | Chemicals, fertilizers | Varies — N2O from nitric acid, CO2 from ammonia |
| Semiconductor fabrication | Chips, electronics | Yes — PFCs, SF6, NF3 |
| Refrigerant use | Food processing, cold chain, HVAC | Yes — HFCs |
| Wastewater treatment | Food, beverage, paper | Yes — CH4 from anaerobic processes |

Process emissions require source-specific emission factors — standard combustion methodologies do not apply. CARB MRR specifies calculation methods for each covered process type.

### Scope 2

| Source | Notes |
|---|---|
| Electric motors and drives | The largest Scope 2 source for most manufacturers — motors power pumps, compressors, conveyors, machine tools |
| Process cooling and refrigeration | Chillers, cooling towers |
| Lighting | Factory floors, warehouses |
| HVAC — offices and amenity spaces | Minor relative to process electricity |
| Electric arc furnaces | Steel mini-mills — electricity is the primary energy input |

Dual reporting required. Market-based method is less commonly used by heavy manufacturers (few hold PPAs), but is increasingly relevant as manufacturers set Scope 2 targets. (→ [[methodologies/scope-2-location-based|Location-Based]], [[methodologies/scope-2-market-based|Market-Based]])

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 1** — Purchased raw materials | All manufacturers | High — embedded emissions in raw material inputs (metals, chemicals, plastics, agricultural commodities) |
| **Cat 2** — Capital goods | Manufacturers investing in new equipment | Medium |
| **Cat 4** — Upstream transportation | Inbound raw material logistics | Medium–high |
| **Cat 11** — Use of sold products | Energy-consuming products | High for appliance, vehicle, equipment manufacturers |
| **Cat 12** — End-of-life treatment | Products containing hazardous materials | Medium |
| **Cat 7** — Employee commuting | Large workforces | Medium |

For manufacturers, Cat 1 upstream raw materials and Cat 11 use of sold products are often both large — the sector has significant Scope 3 exposure on both sides of the value chain.

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Combustion (natural gas, diesel, coal) | Fuel consumption × fuel-specific combustion emission factor | Fuel purchase records (volume or energy content) |
| Process emissions (cement, steel, etc.) | Source-specific method per CARB MRR / IPCC guidelines | Production quantities; process-specific parameters |
| High-GWP process gases (PFCs, SF6) | Mass balance or emission factor per gas type | Gas purchase and destruction records |
| Refrigerants | Refrigerant tracking: purchases minus disposals | Maintenance records |
| Scope 2 electricity | Dual: location-based + market-based | Utility bills (kWh); REC/PPA contracts |
| Cat 1 raw materials | Average-data by material type (Tier 3) | Purchase volumes by material category |
| Cat 11 sold products | Technical specification method | Product energy specs, estimated use lifetime, sales volumes |

**CARB MRR alignment:** California facilities already reporting under MRR use EPA 40 CFR Part 98 calculation methods. SB 253 requires GHG Protocol methods — for the same physical emissions, the calculated totals may differ. Both sets of numbers should be maintained for facilities subject to both obligations. (→ [[regulations/carb-mrr|CARB MRR]])

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-04-10** | CARB MRR annual report due | California facilities ≥ 10,000 MT CO2e |
| **2026-06-01** | CARB MRR abbreviated report (electric power) | Electricity generators |
| **2026-08-10** | CARB MRR verification statement due + First SB 253 Scope 1/2 | Facilities ≥ 25,000 MT; SB 253 for large companies |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| **31 March (annual)** | EU ETS verified annual emissions report due | EU installations ≥ 20 MW thermal input (cement, steel, chemicals, glass, paper, etc.) |
| **30 September (annual)** | EU ETS allowance surrender | EU ETS covered installations |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU manufacturers with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME manufacturers |
| **End of each quarter + 1 month** (through 2025-12-31) | Quarterly CBAM transitional report | EU importers of CBAM Annex I goods (cement, electricity, fertilisers, iron/steel, aluminium, hydrogen) |
| **2026-01-01** | Definitive CBAM period begins; Authorised CBAM Declarant status required to import covered goods | EU importers of CBAM Annex I goods |
| **2026-03-31** | Deadline to apply for Authorised CBAM Declarant status to retain provisional import rights | EU importers without prior authorisation |
| **2027-02-01** | CBAM certificate sales begin on common central platform | Authorised CBAM Declarants |
| **2027-09-30** | First annual CBAM declaration + first CBAM certificate surrender (for 2026 emissions); annually thereafter | Authorised CBAM Declarants |
| **End of each quarter from 2027** | CBAM Registry account holds ≥ 50% of year-to-date embedded emissions | Authorised CBAM Declarants |

## Sub-sectors

- **Food & Beverage Manufacturing** — combustion-dominated; refrigerant load; wastewater CH4; distinct from Food Service (restaurants) sector
- **Chemicals & Petrochemicals** — process emissions (N2O, CO2); high Scope 1 complexity; EU ETS covered; **hydrogen and ammonia/nitric-acid/nitrogenous fertiliser producers are CBAM Annex I goods** (→ [[regulations/cbam|CBAM]])
- **Cement & Glass** — calcination is the largest CO2 source; fuel combustion for kiln temperatures; Cap-and-Trade covered in California; **cement clinker, Portland and other hydraulic cements are CBAM Annex I goods** (CO₂)
- **Steel & Metals** — blast furnace CO2; electric arc furnace Scope 2; PFC emissions from aluminium smelting; **iron, steel, and aluminium are CBAM Annex I goods** (Annex II direct-emissions-only treatment for most CN headings) — CBAM exposes EU importers and competitors to a price equivalent to EU ETS on these imports
- **Automotive & Vehicles** — Cat 11 (use of vehicles by customers) typically the largest Scope 3 source; manufacturing Scope 1/2 also significant; CBAM-covered steel and aluminium inputs flow through to vehicle Cat 1 cost
- **Semiconductors & Electronics** — process gases (PFCs, SF6, NF3) are high-GWP Scope 1; energy-intensive fabrication
- **Paper & Packaging** — biogenic CO2 from biomass combustion; wastewater treatment; high water use
- **Pharmaceuticals** — process solvents; cold chain logistics; high Scope 3 Cat 1 from API sourcing

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]]
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]]
- [[regulations/carb-mrr|California Mandatory Reporting Regulation (CARB MRR)]] — facility-level compliance for California plants
- [[regulations/carb-cap-and-trade|California Cap-and-Trade / Cap-and-Invest Regulation]] — compliance mechanism for facilities ≥ 25,000 MT CO2e
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/eu-ets|EU ETS]] — direct compliance obligation for covered EU industrial facilities
- [[regulations/cbam|EU CBAM]] — carbon-leakage instrument for EU importers of cement, electricity, fertilisers, iron/steel, aluminium, hydrogen
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — EU ETS Scope 1 % disclosure required under E1-6
- [[organizations/carb|California Air Resources Board (CARB)]]
- [[organizations/eu-commission|European Commission]] — administers EU ETS, CBAM, and CSRD
