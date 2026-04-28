---
id: six-environmental-objectives
type: concept
title: "Six Environmental Objectives (EU Taxonomy)"
aliases: ["six environmental objectives", "Article 9 objectives", "Taxonomy environmental objectives", "EU Taxonomy objectives"]
jurisdiction: EU
scope: [1, 2, 3]
tags: [eu-taxonomy, eu, environmental-objectives, climate-mitigation, climate-adaptation, water, circular-economy, pollution, biodiversity]
last_updated: 2026-04-25
source_count: 2
references: [eu-taxonomy-2020-852, eu-taxonomy-climate-delegated-act-2021-2139, eu-taxonomy, taxonomy-alignment, dnsh-do-no-significant-harm]
---

## Definition

The **six environmental objectives** are the catalogue of environmental aims defined in **Article 9 of the EU Taxonomy Regulation (Regulation (EU) 2020/852)**. They are the universe of objectives against which an economic activity must be assessed for the four-part Taxonomy alignment test:

1. **(a) Climate change mitigation** — defined in Article 2(5) as "the process of holding the increase in the global average temperature to well below 2 °C and pursuing efforts to limit it to 1.5 °C above pre-industrial levels, as laid down in the Paris Agreement"
2. **(b) Climate change adaptation** — defined in Article 2(6) as "the process of adjustment to actual and expected climate change and its impacts"
3. **(c) Sustainable use and protection of water and marine resources**
4. **(d) Transition to a circular economy** — defined in Article 2(9) as an economic system whereby the value of products, materials and other resources in the economy is maintained for as long as possible, enhancing their efficient use in production and consumption, minimising waste and the release of hazardous substances, and applying the waste hierarchy
5. **(e) Pollution prevention and control**
6. **(f) Protection and restoration of biodiversity and ecosystems**

For each objective, the Regulation sets out the criteria for an activity to be deemed to **substantially contribute** (Articles 10, 11, 12, 13, 14, 15 respectively) and delegates the **technical screening criteria (TSCs)** to a Commission Delegated Act.

(→ [[sources/eu-taxonomy-2020-852|EU Taxonomy Regulation 2020/852]])

## Why It Matters

The six objectives are the framework through which the entire EU sustainable finance regime defines "green":
- They define the universe of activities considered for **substantial contribution** under the [[concepts/taxonomy-alignment|Taxonomy alignment]] test
- They simultaneously define the universe of objectives against which the [[concepts/dnsh-do-no-significant-harm|DNSH]] test must be applied (an activity contributing substantially to one objective must not significantly harm any of the other five)
- They structure the Commission's delegated rule-making — there is one **Climate Delegated Act** for objectives (a) and (b), and one **Environmental Delegated Act** for objectives (c)–(f)
- They structure the **Article 8 disclosure** — Taxonomy KPIs are reported objective-by-objective for both eligibility and alignment

For GHG accounting practitioners, only the first two objectives — climate change mitigation and climate change adaptation — directly intersect with Scope 1/2/3 emissions calculation. The other four objectives are environmental aims that the alignment regime requires GHG-relevant activities not to undermine.

## Key Distinctions

### Substantial-contribution criteria, by objective

| Objective | Article | What "substantial contribution" means (high-level) |
|---|---|---|
| (a) Climate change mitigation | Article 10 | Stabilising atmospheric GHG concentrations consistent with the Paris long-term temperature goal, through avoidance/reduction of emissions or increase of removals — via renewable energy, energy efficiency, clean mobility, sustainably sourced renewable materials, environmentally safe CCU/CCS, land carbon sinks, decarbonisation infrastructure, clean fuels, or enabling activities (Article 16). Also covers **transitional activities** (Article 10(2)) where no low-carbon alternative exists, with best-in-sector emission performance and no carbon lock-in. |
| (b) Climate change adaptation | Article 11 | Either adaptation solutions that substantially reduce climate-risk impacts on the activity itself **without increasing risk elsewhere**, or solutions that contribute substantially to reducing climate-risk impacts on people, nature, or assets. Adaptation solutions must be assessed using best available climate projections. |
| (c) Sustainable use and protection of water and marine resources | Article 12 | Substantially contributing to good status of bodies of water (surface, groundwater) or good environmental status of marine waters — via wastewater treatment, drinking water protection, water management efficiency, marine ecosystem services, or enabling activities. |
| (d) Transition to a circular economy | Article 13 | Resource efficiency, product durability/reparability/recyclability, hazardous-substance reduction, secondary raw materials, waste prevention, recycling infrastructure, minimisation of incineration and landfill in line with the waste hierarchy, litter reduction, or enabling activities. |
| (e) Pollution prevention and control | Article 14 | Preventing or reducing **non-GHG** pollutant emissions to air, water, or land; improving local environmental quality; preventing chemical impacts on health; cleaning up litter; or enabling activities. (Note: "other than greenhouse gases" — GHGs sit under objective (a).) |
| (f) Protection and restoration of biodiversity and ecosystems | Article 15 | Nature and biodiversity conservation; sustainable land use and management; sustainable agricultural and forestry practices; or enabling activities. |

### Three categories of contributing activity (cross-cutting)

These categories apply across all six objectives:

- **Own-performance contribution** — the activity itself meets the substantial-contribution criteria (default)
- **Transitional activity (Article 10(2))** — *mitigation only*. Activities for which no technologically and economically feasible low-carbon alternative exists, with GHG performance at the **best in sector**, that do not lock in carbon-intensive assets and do not hamper deployment of low-carbon alternatives
- **Enabling activity (Article 16)** — directly enables another activity to make a substantial contribution to one or more objectives, provided it does not lock in assets undermining long-term environmental goals and has substantial positive environmental impact on a life-cycle basis

### Solid fossil fuel power generation excluded

Article 19(3) prohibits TSCs from qualifying solid fossil fuel power generation as environmentally sustainable under any of the six objectives. This is the only categorical activity exclusion in the Regulation itself — all other activity-level exclusions are set in the Delegated Acts.

### Delegated Act structure

| Delegated Act | Covers objectives | Adopted |
|---|---|---|
| **Climate Delegated Act** — Commission Delegated Regulation (EU) 2021/2139 | (a) mitigation, (b) adaptation | 2021 (consolidated 2025) |
| **Environmental Delegated Act** — Commission Delegated Regulation (EU) 2023/2486 | (c) water/marine, (d) circular economy, (e) pollution, (f) biodiversity | 2023 |
| **Article 8 Delegated Act** — Commission Delegated Regulation (EU) 2021/2178 | KPI templates for all six | 2021 |

## Calculation Notes

The Article 9 catalogue itself is not a calculation framework — it is the index over which substantial-contribution and DNSH tests are organised.

For objectives **(a) climate change mitigation** and **(b) climate change adaptation**, the Climate Delegated Act (Commission Delegated Regulation (EU) 2021/2139) provides fully fleshed-out activity-level technical screening criteria across two large Annexes (→ [[sources/eu-taxonomy-climate-delegated-act-2021-2139|Climate Delegated Act 2021/2139]]):

- **Annex I (mitigation)** — ~90 numbered activities organised into nine macro-sectors (Forestry, Environmental protection, Manufacturing, Energy, Water/sewerage/waste, Transport, Construction and real estate, Information and communication, Professional/scientific/technical), each NACE-coded. Substantial-contribution thresholds are typically **quantitative** — expressed in g CO2e per unit of output (per kWh for power generation/heat/cool/co-generation, per tonne of clinker/cement/steel/aluminium/HVC, per km for vehicles, per kg/MJ for hydrogen) and most often derived from **EU ETS product benchmarks** (cement, steel, aluminium, chemicals) or **PEF / ISO 14067 / ISO 14064-1** life-cycle methodologies (power, hydrogen, fuels). The flagship threshold is **<100 g CO2e/kWh life-cycle** for almost all electricity and heat generation.
- **Annex II (adaptation)** — ~120+ activities with broader sectoral reach (adds Financial and insurance services, Education, Human health and social work, Arts/entertainment/recreation). Substantial-contribution criteria are dominated by the **climate-risk and vulnerability assessment** requirement plus deployment of adaptation solutions, rather than per-unit GHG thresholds.

For objectives **(c)–(f)** — water/marine, circular economy, pollution, biodiversity — the equivalent operative numbers live in the Environmental Delegated Act (Regulation (EU) 2023/2486) *(separate ingest pending)*.

Within the alignment test, an activity assessed for substantial contribution to one objective must simultaneously be tested for DNSH against the other five — meaning the six objectives operate as a fully cross-linked matrix, not a list of independent silos. The Climate Delegated Act operationalises this cross-linking through generic Appendices (A: adaptation; B: water; C: pollution/chemicals; D: biodiversity; E: water-appliance specs) plus activity-specific overlays.

## Regulatory References

- **Regulation (EU) 2020/852, Article 9** — the catalogue itself
- **Regulation (EU) 2020/852, Articles 10–16** — substantial-contribution criteria for each objective and the enabling-activity rule
- **Regulation (EU) 2020/852, Article 17** — DNSH triggers, defined per objective
- **Regulation (EU) 2020/852, Article 19** — cross-cutting requirements that all TSCs must satisfy, including the solid fossil fuel exclusion
- **Regulation (EU) 2020/852, Article 27(2)** — staged application: 2022-01-01 for objectives (a) and (b); 2023-01-01 for (c)–(f)
- **Climate Delegated Act — Commission Delegated Regulation (EU) 2021/2139** — TSCs for objectives (a) and (b)
- **Environmental Delegated Act — Commission Delegated Regulation (EU) 2023/2486** — TSCs for objectives (c)–(f)

## Related

- [[regulations/eu-taxonomy|EU Taxonomy Regulation]] — parent regulation establishing the six objectives
- [[concepts/taxonomy-alignment|Taxonomy Alignment]] — the four-part test that ranges over the six objectives
- [[concepts/taxonomy-eligibility|Taxonomy Eligibility]] — first-step screen against the activity catalogues in the Delegated Acts
- [[concepts/dnsh-do-no-significant-harm|Do No Significant Harm (DNSH)]] — second-leg test that ranges over the other five objectives once one is selected for substantial contribution
- [[concepts/minimum-safeguards|Minimum Safeguards]] — third-leg test (independent of the six objectives)
- [[regulations/csrd|CSRD]] — Article 8 Taxonomy KPIs disclosed for each objective
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — the GHG-specific CSRD standard intersecting most with objectives (a) and (b)
- [[organizations/eu-commission|European Commission]] — adopts the Climate, Environmental, and Article 8 Delegated Acts that set the operative TSCs and KPI methodology
