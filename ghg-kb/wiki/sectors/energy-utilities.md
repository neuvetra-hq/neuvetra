---
id: energy-utilities
type: sector
title: "Energy & Utilities"
aliases:
  - energy
  - utilities
  - power generation
  - electricity generation
  - gas utilities
  - oil and gas
  - renewables
  - electric utilities
jurisdiction: Global
scope: [1, 2, 3]
business_size: any
tags: [energy, utilities, power-generation, oil-gas, fugitive-emissions, combustion, scope-1, cat-11, eu-ets, carb-mrr, cap-and-trade]
last_updated: 2026-04-25
source_count: 2
references:
  - sb253-ccdaa
  - sb261
  - carb-mrr
  - carb-cap-and-trade
  - lcfs
  - csrd
  - esrs-e1
  - eu-ets
  - eu-directive-ets-revision-2023-959
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

Energy and utilities companies occupy a unique position in GHG accounting: their Scope 1 emissions from fuel combustion and fugitive releases are often among the largest of any sector, but the downstream use of the energy they sell creates emissions that appear in every other sector's Scope 2 and Scope 3 inventories. The emission factors that all other sectors use for electricity and heat calculations are derived from energy companies' reported Scope 1 data.

The sector divides into three distinct profiles:

**Fossil fuel power generators and gas utilities:** Scope 1 from combustion and fugitive methane is massive. Direct regulatory compliance obligations — CARB MRR, Cap-and-Trade in California; EU ETS in Europe — apply to most facilities above small thresholds. Cat 11 (use of sold products) is potentially the largest Scope 3 source: for a natural gas utility, the combustion of gas by customers is Category 11, and the total can dwarf the utility's own Scope 1.

**Oil and gas upstream and midstream:** Fugitive methane emissions from wellheads, compressor stations, storage tanks, and pipeline infrastructure are the defining emission source. Methane's high GWP means even small leak rates represent significant CO2e emissions. Flaring adds CO2 and incomplete combustion products. These operations are subject to CARB MRR in California and have separate EPA GHGRP obligations federally.

**Renewable energy (solar, wind, hydro, nuclear):** Near-zero Scope 1 during operations. Scope 3 Cat 1 from manufacturing equipment (solar panels, wind turbines, batteries) is the primary emission source. Cat 11 is near-zero — the electricity sold produces no combustion emissions at the point of use. Renewable energy operators are the key suppliers of the contractual instruments (RECs, GOs, PPAs) that other sectors use for market-based Scope 2 reporting.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000 and entity does business in California. Major utilities (PG&E, SCE, SDG&E), large oil and gas companies (Chevron, Valero, others), and large independent power producers qualify. First Scope 1/2 disclosure due 2026-08-10. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000. Transition risk (stranded assets, policy-driven fuel phase-out) and physical risk (drought affecting hydro, wildfire affecting transmission infrastructure) are both highly material. (→ [[regulations/sb261|SB 261]])
- **CARB MRR:** Energy companies are among the primary mandatory reporters. **Electricity generators** above 10,000 MT CO2e must report under a separate abbreviated schedule. **Fuel suppliers** (refiners, natural gas suppliers, importers) are mandatory reporters as first sellers into the California market. These reporting obligations are independent of facility size thresholds. (→ [[regulations/carb-mrr|CARB MRR]])
- **Cap-and-Trade:** Electricity generators and natural gas distributors are **covered entities** (first sellers) under the Cap-and-Trade program. This means they must hold and surrender allowances for the combustion emissions that will occur when their product is used, even before that use occurs. This is the primary compliance mechanism for the California energy sector. (→ [[regulations/carb-cap-and-trade|Cap-and-Trade]])
- **LCFS (Low Carbon Fuel Standard):** Title 17 CCR §§95480–95503 (Final Regulation Order OAL-approved 2025-06-27, effective 2025-07-01). The primary California regime regulating the **carbon intensity of transportation fuels**. Refiners producing CARBOB and ULSD diesel are first fuel reporting entities and incur both base deficits (fuel CI vs benchmark) and incremental deficits (annual three-year-average California crude CI vs the 12.61 gCO2e/MJ baseline). Natural gas utilities and biomethane producers are first fuel reporting entities for fossil and bio CNG/LNG/L-CNG dispensed into vehicles — bio-CNG/LNG/L-CNG can be a major credit source. Hydrogen station owners are first fuel reporting entities for vehicle hydrogen (with mandatory ≥80% renewable/CCS-paired threshold from 2030 and full fossil-feedstock ineligibility from 2035 unless 100% biomethane-matched or CCS-paired). EDUs (Electrical Distribution Utilities) are credit generators for residential EV charging base credits; non-residential EV charging credit generation is allocated per §95483(c). LCFS credits are tradable up to a CPI-adjusted Maximum Price (anchored at $200/MTCO2e in 2016) with a Credit Clearance Market window June 1–August 30. **LCFS is a separate compliance regime from Cap-and-Trade** — credits are not interchangeable with Cap-and-Trade allowances. (→ [[regulations/lcfs|LCFS]])

**EU:**
- **EU ETS (ETS1):** Power generation has been covered since Phase 1 (2005). Electricity generators are the largest buyers of EU allowances (EUAs). Free allocations have been reduced progressively; power sector free allocation was eliminated in most EU states by Phase 3. All stationary installations above 20 MW thermal input are covered. Annual verified emissions report due 31 March; allowance surrender due 30 September (deadline shifted from 30 April by Directive (EU) 2023/959). **Phase 4 cap radically tightened by Directive (EU) 2023/959:** linear reduction factor stepped from 2.2% to 4.3% (2024–2027) and 4.4% (2028+); one-time cap rebasings of −90 M allowances in 2024 and −27 M in 2026; 62% reduction target by 2030 vs 2005. **From 2026, free allocation is conditional** on energy-efficiency / emissions-reduction measures, and the **20% highest-emission-intensity installations** under any product benchmark must adopt a climate-neutrality plan. **Hydrogen production threshold lowered to >5 t/day** (was 25 t/day) — captures more electrolytic and reformer-based H₂ producers. **CBAM-factor phase-out** of free allocation 2026–2034 directly affects refineries, ammonia/hydrogen producers, and other CBAM-covered industrial energy users. (→ [[regulations/eu-ets|EU ETS]], [[sources/eu-directive-ets-revision-2023-959|Directive 2023/959]])
- **EU ETS2 (Buildings + Additional Sectors) — Chapter IVa, trading from 2027:** A separate parallel cap-and-trade system for fuels released for consumption in buildings (commercial/institutional and residential heating fuels), road transport, and "additional sectors" — Energy Industries (1A1) and Manufacturing & Construction (1A2) categories that fall outside ETS1 Annex I. **Compliance falls on fuel suppliers / wholesalers** (regulated entities defined by reference to Council Directive (EU) 2020/262 on excise duties). For natural gas utilities, heating-oil distributors, and LPG suppliers, ETS2 creates a direct compliance obligation parallel to (but separate from) ETS1: ETS1 covers their own Scope 1 combustion; ETS2 covers the carbon content of fuels they place onto the market for consumption in buildings. CHP and heat plants (1A1aii/iii) supplying buildings or additional sectors are covered under ETS2. Permit required from 1 January 2025; trading from 2027 (possible delay to 2028 under Article 30k); first surrender 31 May 2028. **No free allocation** under ETS2. (→ [[regulations/eu-ets|EU ETS]], [[sources/eu-directive-ets-revision-2023-959|Directive 2023/959]])
- **CSRD / ESRS E1:** Applies to large energy companies with EU operations or listings meeting CSRD thresholds. EU ETS-covered Scope 1 percentage must be disclosed under ESRS E1-6, creating a direct quantitative link between the two compliance regimes. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

| Source | Applicability | Notes |
|---|---|---|
| Combustion — natural gas (power generation) | Gas-fired power plants | CCGT (combined cycle), peaker plants, cogeneration |
| Combustion — coal (power generation) | Coal plants | Phasing out in California (last CA coal plant retired 2020); still present in EU, US Southeast |
| Combustion — fuel oil | Fuel oil peaker plants, backup generation | Declining |
| **Fugitive emissions — natural gas systems** | Gas utilities, upstream oil & gas | Methane leakage from wellheads, compressors, pipelines, distribution mains; GWP 27.9; the most significant emission source for gas infrastructure |
| **Flaring** | Oil & gas production and refining | Incomplete combustion yields CO2 + CH4 + N2O; volume-based calculation |
| Process emissions — refineries | Petroleum refining | Catalytic cracker regeneration, hydrogen production, coking |
| Fugitive emissions — wastewater (refineries) | Petroleum refining | Minor |
| Refrigerants (HFCs) | Power plant cooling, LNG facilities | |
| Combustion — diesel for auxiliary systems | All facilities | Backup generators, on-site vehicles |

**Fugitive methane note:** The natural gas system in the US leaks an estimated 1.4–3% of total throughput from production through distribution. At GWP 27.9, even a 1% leak rate creates significant CO2e exposure. California's gas distribution system and upstream production in the San Joaquin Valley are subject to CARB MRR fugitive reporting requirements. Measurement methodologies range from component-level leak detection and repair (LDAR) surveys to aerial mass-balance approaches.

### Scope 2

| Source | Notes |
|---|---|
| Electricity — compression and pumping | Natural gas compressor stations, pipeline pumping |
| Electricity — auxiliary and parasitic loads | Power plant auxiliary systems; wind turbine controls |
| Electricity — office and control buildings | Minor |

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 11** — Use of sold energy products | Gas utilities, oil producers | **Potentially dominant** — combustion of natural gas by customers is Cat 11 for the gas utility; can represent 90%+ of total inventory |
| **Cat 3** — Fuel & energy-related | All fossil fuel operators | Medium — upstream extraction and processing of purchased fuel inputs |
| **Cat 4** — Upstream transportation | Gas and oil companies | Medium — pipeline transport of purchased gas/oil before use |
| **Cat 1** — Purchased goods & services | Renewable energy developers | Medium — solar panels, wind turbines, battery storage systems have significant embedded manufacturing carbon |
| **Cat 2** — Capital goods | Power plant construction | Low — amortized over long asset lifetimes |
| **Cat 15** — Financed emissions | Utility holding companies with investment arms | Varies |

**Cat 11 for gas utilities:** If a gas utility delivers 10 billion cubic feet of natural gas to customers per year, the combustion of that gas by customers (for heating, cooking, industrial use) is Category 11. This is not a small rounding error — it represents the emissions that appear as Scope 1 in all the customers' inventories. For the gas utility, disclosing Cat 11 means taking responsibility for the downstream combustion of its product. This is why Cat 11 reporting is the most contentious Scope 3 item for fossil fuel companies.

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Combustion (natural gas, coal, oil) | Fuel consumption × combustion emission factor | Fuel purchase/consumption records (volume or energy content) |
| Fugitive CH4 — gas distribution | Component-level LDAR × emission factor by component type, or mass-balance measurement | Component count inventory; inspection and repair records; throughput data |
| Fugitive CH4 — upstream oil & gas | EPA GHGRP Subpart W methods or measurement-based (continuous monitoring) | Equipment inventory; production volumes; measurement data |
| Flaring | Volume flared × gas composition × combustion efficiency factor | Flare meter data; gas composition analysis |
| Scope 2 electricity | Location-based; market-based if RECs held | kWh by facility |
| Cat 11 sold gas | Customer gas consumption × combustion emission factor | Gas delivery volumes (m³ or MMBtu) by customer segment |
| Cat 1 solar/wind equipment (renewables) | Physical quantity × manufacturer EPD or industry average emission factor | Equipment purchase records (kW nameplate capacity) |

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-04-10** | CARB MRR annual report due | CA facilities/fuel suppliers ≥ applicable threshold |
| **2026-06-01** | CARB MRR abbreviated annual report | California electricity generators |
| **2026-08-10** | First SB 253 Scope 1/2 disclosure + CARB MRR verification statement | SB 253 covered entities; MRR ≥ 25,000 MT |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |
| Quarterly | Cap-and-Trade compliance period auctions | California covered entities |
| **31 March (annual)** | EU ETS verified annual emissions report due | EU power generators and other stationary installations ≥ 20 MW |
| **30 June (annual, ETS1)** | Free-allocation grant by competent authorities to operators (deadline shifted from 28 February by Directive 2023/959) | EU ETS-covered installations receiving free allocation |
| **30 September (annual)** | EU ETS allowance surrender (shifted from 30 April by Directive 2023/959) | EU ETS covered energy installations |
| **2025-01-01** | ETS2 GHG permit required for fuel suppliers (buildings + additional sectors) | Natural gas utilities, heating-oil distributors, LPG suppliers, fuel wholesalers |
| **2025-04-30** | First ETS2 historical-emissions report (covering 2024) | ETS2 regulated entities |
| **2027-01-01** | ETS2 trading begins (may be delayed to 2028 under Article 30k) | ETS2 regulated entities |
| **2028-05-31** | First ETS2 allowance surrender (covering 2027 verified emissions) | ETS2 regulated entities |
| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU energy companies with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME energy operators |

## Sub-sectors

- **Natural Gas Utilities** — Cat 11 (downstream gas combustion) is typically the largest single inventory item; fugitive CH4 from distribution is the critical Scope 1 challenge; mandatory Cap-and-Trade covered entities in California
- **Electricity Generation (Fossil)** — Scope 1 combustion dominates; EU ETS and Cap-and-Trade covered; emission factors derived from generation mix are used by all electricity consumers
- **Petroleum Refining** — process emissions, flaring, and fugitive H2S/VOCs; CARB MRR and Cap-and-Trade covered; large Scope 3 Cat 11 from refined product combustion
- **Oil & Gas Upstream (E&P)** — fugitive methane is the defining issue; flaring adds CO2; significant regulatory and investor scrutiny; EPA GHGRP Subpart W
- **Oil & Gas Midstream (Pipelines)** — compressor station emissions; fugitive pipeline leakage; high Cat 11 throughput
- **Electric Utilities (Integrated)** — generation + transmission + distribution; T&D losses appear in customers' Scope 3 Cat 3 calculations
- **Renewable Energy (Solar, Wind)** — near-zero operational Scope 1/2; Cat 1 from equipment manufacture is primary Scope 3 source; producers of RECs and GOs used by other sectors

## Related

- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 3, Cat 11 most material; Cat 15 for holding companies
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]]
- [[regulations/carb-mrr|California Mandatory Reporting Regulation (CARB MRR)]] — primary compliance mechanism; fuel suppliers and generators are mandatory reporters
- [[regulations/carb-cap-and-trade|California Cap-and-Trade / Cap-and-Invest Regulation]] — electricity generators and gas distributors are covered entities
- [[regulations/lcfs|California Low Carbon Fuel Standard (LCFS)]] — first fuel reporting entity obligation for refiners (CARBOB, ULSD), gas utilities (fossil and bio CNG/LNG), hydrogen producers, biomethane producers, and EDUs supplying transport electricity; declining annual CI benchmarks; tradable credits via LRT-CBTS
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]]
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]]
- [[regulations/eu-ets|EU ETS]] — direct compliance obligation for EU power generators (>20 MW); largest sector by allowance volume
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — EU ETS Scope 1 % disclosure required under E1-6
- [[organizations/carb|California Air Resources Board (CARB)]]
- [[organizations/eu-commission|European Commission]] — administers EU ETS cap and auctioning
