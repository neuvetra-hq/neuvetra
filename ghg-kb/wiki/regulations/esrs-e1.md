---
id: esrs-e1
type: regulation
title: "ESRS E1 — Climate Change"
aliases: ["ESRS E1", "European Sustainability Reporting Standard E1", "ESRS Climate Change"]
jurisdiction: EU
scope: [1, 2, 3]
business_size: large
tags: [esrs, csrd, eu, scope-1, scope-2, scope-3, ghg-emissions, climate-change, transition-plan, double-materiality]
effective_date: 2023-07-31
last_updated: 2026-04-25
source_count: 3
requires: [csrd, esrs-1, esrs-2]
references: [ghg-protocol-corporate-standard, ghg-protocol-scope-2-guidance, ghg-protocol-scope-3-standard, eu-ets, eu-taxonomy, scope-3-categories, double-materiality, esrs-phase-in, efrag-ig2-value-chain-2024, double-materiality-assessment, scope-3, organizational-boundary, operational-boundary]
calculated_by: [scope-2-location-based, scope-2-market-based]
parent: csrd
---

## Overview

ESRS E1 (Climate Change) is the topical environmental standard governing GHG emissions and climate-related disclosures under the CSRD. It is one of 12 topical standards in the first ESRS set, adopted as Annex I of Commission Delegated Regulation (EU) 2023/2772 on 31 July 2023.

ESRS E1 contains nine disclosure requirements (E1-1 through E1-9) covering the full lifecycle of a company's climate-related strategy, actions, and quantitative performance. Like all ESRS topical standards, E1 plugs into the cross-cutting framework set by [[regulations/esrs-1|ESRS 1]] (architecture, materiality, value chain, time horizons) and [[regulations/esrs-2|ESRS 2]] (cross-cutting governance, strategy, IRO disclosures, plus the four Minimum Disclosure Requirements MDR-P/A/M/T that structure climate policies, actions, metrics, and targets).

E1 is structured around the four ESRS reporting areas: Governance, Strategy, Impact/Risk/Opportunity Management, and Metrics & Targets.

The standard explicitly references the **GHG Protocol Corporate Accounting and Reporting Standard** and **GHG Protocol Scope 2 Guidance** as the primary methodologies for calculating Scope 1, 2, and 3 emissions under E1-6.

(→ [[sources/esrs-set1-2023-2772|ESRS Set 1 — Commission Delegated Regulation 2023/2772 (Full Annex I)]])
(→ [[sources/esrs-e1-climate-change|ESRS E1 Source File — E1 Chapter Specific]])

## Who Must Comply

ESRS E1 applies to all companies in scope of CSRD (→ [[regulations/csrd|CSRD]]) for whom climate change is a **material topic** as determined by the double materiality assessment (→ [[concepts/double-materiality|Double Materiality]]).

**Exception — mandatory regardless of materiality:**
- **E1-1 (Transition Plan)**: Mandatory disclosure if the company has or is developing a climate transition plan, regardless of whether climate change was assessed as material

**Special non-materiality justification rule (ESRS 1 paragraph 32):** Climate is the only ESRS topic where finding non-materiality requires more than a brief explanation. If an undertaking concludes climate is non-material and omits all E1 disclosures, it must provide a **detailed forward-looking justification** under [[regulations/esrs-2|ESRS 2 IRO-2]], including a forward-looking analysis of conditions that could lead climate to become material in the future. For all other topical standards, a brief explanation suffices.

In practice, climate change is expected to be material for the vast majority of in-scope companies given the pervasive nature of Scope 1, 2, and 3 emissions across all sectors.

## Reporting Requirements

### E1-1 — Transition Plan for Climate Change Mitigation

Mandatory if the company has or is developing a transition plan. Disclose:
- Whether and how the business model and strategy are compatible with limiting global warming to 1.5°C
- Whether and by when the company aims to achieve climate neutrality across Scopes 1, 2, and 3
- Locked-in GHG emissions from current assets and planned phase-out timeline
- How different climate scenarios were used to stress-test the plan
- Resources and financing allocated to implement the plan
- Consistency with overall capital allocation plans

If no transition plan exists, state that fact and describe any plans to develop one.

### E1-2 — Policies Related to Climate Change Mitigation and Adaptation

Describe policies the company has adopted for:
- Climate change mitigation (reducing emissions)
- Climate change adaptation (managing physical climate risks)

Include scope of policies (own operations only vs. full value chain) and implementation mechanisms.

### E1-3 — Actions and Resources in Relation to Climate Change Policies

Disclose key climate actions taken or planned, including:
- Specific mitigation actions (e.g., fuel switching, electrification, energy efficiency)
- Adaptation actions (e.g., physical risk assessment, infrastructure hardening)
- CapEx and OpEx committed
- Planned investments in low-carbon assets

### E1-4 — Targets Related to Climate Change Mitigation and Adaptation

For each GHG reduction target:
- Base year, base year emissions, and current year progress
- Whether absolute or intensity-based
- Which Scopes (1, 2, 3) are covered
- Coverage of Scope 3 categories included
- Whether aligned with science-based pathways (e.g., SBTi validation)
- Interim milestones toward long-term net-zero goals

### E1-5 — Energy Consumption and Mix

Quantitative disclosure of total energy in MWh or GJ:
- Total energy consumption
- From fossil fuel sources (with fuel-type breakdown where material)
- From nuclear sources
- From renewable sources
- From self-generated renewables (non-fuel)
- Energy intensity (per net revenue, or other appropriate metric)

### E1-6 — Gross Scopes 1, 2, 3 and Total GHG Emissions

The central quantitative GHG disclosure. All values in metric tonnes CO₂e.

**Reporting boundary (E1 ¶50, clarified by EFRAG IG 2 §2.3):**

| E1 paragraph | Boundary | What is reported |
|---|---|---|
| **¶50(a)** | Financial-control consolidation perimeter (same as financial statements) | Consolidated gross Scope 1, 2 (location + market), and Scope 3 (15 categories where material) |
| **¶50(b)** | Operational control (regardless of equity / financial control) | **Separate** disclosure of 100% Scope 1/2 from operationally-controlled sites and entities — *not netted* against ¶50(a) |
| **¶51** | Scope 3 Cat 15 (Investments) | Emissions of associates, joint ventures, and unconsolidated investments outside the financial-control perimeter — PCAF attribution methodology applies (→ [[methodologies/scope-3-cat15-financed-emissions|Scope 3 Cat 15]]) |

The **Seren Group worked example** (IG 2 ¶141–150) walks through these mechanics for a parent + subsidiaries + joint operation + associate scenario. See [[methodologies/double-materiality-assessment#worked-example|Double Materiality Assessment — Worked Example]].

**Scope 1 (Direct):**
- Total gross Scope 1 GHG emissions
- Percentage of Scope 1 covered by EU ETS allowances (required disclosure)
- Percentage from methane (CH₄) if significant
- Breakdown by GHG type (CO₂, CH₄, N₂O, HFCs, PFCs, SF₆, NF₃) where material

**Scope 2 (Indirect — Purchased Energy):**
- Gross Scope 2 emissions — **location-based** (mandatory)
- Gross Scope 2 emissions — **market-based** (mandatory where contractual instruments used)

**Scope 3 (Value Chain):**
- GHG emissions in each of the 15 GHG Protocol categories (→ [[concepts/scope-3-categories|Scope 3 Categories]]) that are material
- Total gross Scope 3

**Total:**
- Total GHG emissions (Scope 1 + Scope 2 + Scope 3)

**Biogenic CO₂:**
- Gross biogenic CO₂ emissions disclosed separately — NOT included in the Scope totals

**GHG intensity:**
- Total GHG emissions per net revenue (€ million)
- Additional intensity metrics may be disclosed (e.g., per tonne of product, per MWh generated)

**Methodology:** GHG Protocol Corporate Standard for Scope 1 and 3; GHG Protocol Scope 2 Guidance for Scope 2. ISO 14064-1 is permissible if consistent with GHG Protocol results.

### E1-7 — GHG Removals and GHG Mitigation Projects Financed Through Carbon Credits

Disclose separately from Scope 1/2/3 gross emissions:
- **GHG removals** within the value chain (e.g., forestry sequestration, BECCS)
- **Carbon credits** purchased and retired from external mitigation projects

For carbon credits, disclose: standard used, vintage year, project type, additionality basis, and co-benefits. Removals and credits must not be netted against gross emissions in the primary metrics.

### E1-8 — Internal Carbon Pricing

If the company uses an internal carbon price:
- Price per tonne CO₂e applied
- Which decisions or business units the price applies to
- How the price is set and updated

### E1-9 — Potential Financial Effects from Material Physical and Transition Risks

Quantify potential financial effects where possible:
- **Physical risks**: Acute (extreme weather events) and chronic (long-term climate shifts); assets and revenues exposed by risk category
- **Transition risks**: Policy/regulatory, technology, market, and reputational risks
- Identification of significant assets or activities that may be stranded, retired, or repurposed
- Methodology for estimating financial effects

## Deadlines

ESRS E1 follows the CSRD phased implementation schedule:

| Company Category | First ESRS E1 Reporting Year |
|---|---|
| Large listed (>500 employees, previously NFRD) | FY 2024 (reports published 2025) |
| All other large undertakings | FY 2025 (reports published 2026) |
| Listed SMEs | FY 2026 (reports published 2027) |
| Third-country undertakings | FY 2028 (reports published 2029) |

**Comparative data:** In Year 1 of reporting, comparative prior-year data may be omitted for most metrics.

## Penalties

Penalties are set by Member States under CSRD transposition. See (→ [[regulations/csrd|CSRD — Penalties section]]).

## Calculation Requirements

E1-6 mandates GHG accounting in accordance with:
- **GHG Protocol Corporate Accounting and Reporting Standard** (→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard]])
- **GHG Protocol Scope 2 Guidance** (→ [[sources/ghg-protocol-scope-2-guidance|GHG Protocol Scope 2 Guidance]]) for dual location-based/market-based reporting
- **GHG Protocol Scope 3 Standard** (→ [[sources/ghg-protocol-scope-3-standard|GHG Protocol Scope 3 Standard]]) for the 15 categories

**Phase-in provisions for E1 (full detail at [[concepts/esrs-phase-in|ESRS Phase-in]]):**

| DR / Data Point | Phase-In |
|---|---|
| E1-6 Scope 3 + Total GHG datapoints | Year 1 omission permitted for undertakings ≤750 employees (size-conditional) |
| E1-9 Anticipated financial effects | Year 1 omission permitted for all undertakings; first 3 years qualitative-only permitted if quantitative measurement is impracticable |
| Comparative prior-period data | Year 1 omission permitted where impracticable |
| Value chain metric information | First 3 years exclusion permitted under ESRS 1 Section 10.2 if not reasonably available |

## Related

- [[regulations/csrd|CSRD]] — parent directive that mandates ESRS E1
- [[regulations/esrs-1|ESRS 1 — General Requirements]] — cross-cutting architecture, materiality, value-chain, time-horizons rules that govern E1
- [[regulations/esrs-2|ESRS 2 — General Disclosures]] — cross-cutting GOV/SBM/IRO disclosures and MDR-P/A/M/T structure for E1 policies, actions, metrics, targets
- [[regulations/eu-ets|EU ETS]] — parallel compliance regime; Scope 1 coverage % by ETS required under E1-6
- [[regulations/eu-taxonomy|EU Taxonomy Regulation]] — companion EU sustainable-finance disclosure regime; Taxonomy KPIs (turnover/CapEx/OpEx aligned with environmentally sustainable activities) are disclosed under CSRD Article 8 in the same **environmental information block** as ESRS E1; the Taxonomy's climate change mitigation objective and Climate Delegated Act TSCs intersect directly with E1-6 Scope 1/2/3 measurement
- [[regulations/esrs-e2|ESRS E2]], [[regulations/esrs-e3|ESRS E3]], [[regulations/esrs-e4|ESRS E4]], [[regulations/esrs-e5|ESRS E5]] — companion environmental standards (often co-material with E1)
- [[concepts/double-materiality|Double Materiality]] — determines whether E1 applies in full; climate-specific non-materiality forward-looking-justification rule
- [[concepts/esrs-phase-in|ESRS Phase-in]] — full detail on E1-6 size-conditional and E1-9 first-year/3-year qualitative reliefs
- [[concepts/scope-1|Scope 1]], [[concepts/scope-2|Scope 2]], [[concepts/scope-3|Scope 3]] — GHG scope definitions measured in E1-6
- [[concepts/scope-3-categories|Scope 3 Categories]] — all 15 categories must be assessed for materiality under E1-6
- [[concepts/additionality|Additionality]] — E1-7 requires disclosure of carbon credits quality including additionality basis
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]] — required method under E1-6
- [[methodologies/scope-2-market-based|Scope 2 Market-Based Method]] — required method under E1-6 where contractual instruments used
- [[methodologies/project-specific-baseline|Project-Specific Baseline Procedure]] — relevant to E1-7 carbon credit quality assessment
- [[methodologies/performance-standard-baseline|Performance Standard Baseline Procedure]] — relevant to E1-7 carbon credit quality assessment
- [[methodologies/double-materiality-assessment|Double Materiality Assessment]] — financial-control vs operational-control boundary mechanics for E1-6
- [[concepts/organizational-boundary|Organizational Boundary]] — financial-control consolidation perimeter as ESRS reporting boundary
- [[concepts/operational-boundary|Operational Boundary]] — operational control as separate environmental-disclosure trigger
- [[sources/efrag-ig2-value-chain-2024|EFRAG IG 2 — Value Chain]] — Seren Group worked example for E1 ¶50(a) / ¶50(b) / ¶51
- [[organizations/efrag|EFRAG]] — standard-setter for ESRS
