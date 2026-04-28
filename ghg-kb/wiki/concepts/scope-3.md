---
id: scope-3
type: concept
title: "Scope 3 — Other Indirect GHG Emissions"
aliases:
  - Scope 3
  - value chain emissions
  - other indirect emissions
jurisdiction: Global
scope: [3]
business_size: any
tags: [scope-3, indirect-emissions, value-chain, upstream, downstream, supply-chain]
last_updated: 2026-04-25
source_count: 6
references:
  - ghg-protocol-corporate-standard
  - ghg-protocol-scope-3-standard
  - ghg-protocol-scope-3-calc-guidance
  - ghg-protocol-scope-3-faq
  - csrd
  - esrs-1
  - esrs-e1
  - esrs-phase-in
  - additionality
  - efrag-ig2-value-chain-2024
  - double-materiality-assessment
parent: operational-boundary
---

## Definition

Scope 3 is an **optional reporting category** (under the GHG Protocol Corporate Standard) that covers all other indirect GHG emissions — those that occur as a consequence of the company's activities but from sources not owned or controlled by the company and not captured in Scope 2.

Scope 3 encompasses the full value chain: emissions from suppliers upstream and from customers and end-of-life treatment downstream.

The **GHG Protocol Scope 3 Standard** (2011) operationalizes scope 3 accounting through 15 standardized categories and is the primary standard for scope 3 inventory preparation. It is a required supplement: companies completing a scope 3 inventory per the GHG Protocol are expected to apply it.

(→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard]]) (→ [[sources/ghg-protocol-scope-3-standard|GHG Protocol Scope 3 Standard]])

## Why It Matters

For most companies, Scope 3 is the largest share of their total GHG footprint — often 70–90%. While optional under the base GHG Protocol Corporate Standard, Scope 3 is increasingly **mandatory** under newer regulations:

- **CSRD / ESRS E1** requires Scope 3 reporting for large EU companies
- **SB 253 (California)** requires Scope 3 reporting for companies with >$1B revenue

Understanding Scope 3 is essential for setting science-based targets, managing supply chain risk, and responding to downstream customer requirements.

## Key Distinctions

**Scope 3 vs. Scope 1:** Scope 1 is from sources the company owns or controls. Scope 3 is from sources outside the company's operational control.

**Scope 3 vs. Scope 2:** Scope 2 is specifically limited to purchased electricity (and heat/steam). Scope 3 is everything else indirect.

**Revised edition change:** Electricity purchased for resale was moved from Scope 2 into Scope 3 (revised edition) to prevent two companies from counting the same emissions in the same scope.

**Categories (elaborated in GHG Protocol Scope 3 Standard, a separate document):**

| # | Category | Direction |
|---|---|---|
| 1 | Purchased goods and services | Upstream |
| 2 | Capital goods | Upstream |
| 3 | Fuel- and energy-related activities (not Scope 1 or 2) | Upstream |
| 4 | Upstream transportation and distribution | Upstream |
| 5 | Waste generated in operations | Upstream |
| 6 | Business travel | Upstream |
| 7 | Employee commuting | Upstream |
| 8 | Upstream leased assets | Upstream |
| 9 | Downstream transportation and distribution | Downstream |
| 10 | Processing of sold products | Downstream |
| 11 | Use of sold products | Downstream |
| 12 | End-of-life treatment of sold products | Downstream |
| 13 | Downstream leased assets | Downstream |
| 14 | Franchises | Downstream |
| 15 | Investments | Downstream |

*The 15 categories are defined in full — including minimum boundaries, calculation methods, and regulatory references — in [[concepts/scope-3-categories|Scope 3 Categories]]. The Corporate Standard provides a high-level overview only; the Scope 3 Standard is the authoritative source.*

**Transmission and distribution losses:** Grid losses from third-party electricity transmission may be included in Scope 3 rather than Scope 2, since the company does not control those losses.

**Double counting across companies is intentional.** The same physical emission can appear in multiple companies' scope 3 inventories simultaneously — for example, the same transportation emission in a manufacturer's Category 4 and a retailer's Category 9. This is by design: each entity has distinct reduction levers. As a consequence, **scope 3 totals must never be summed across companies** to estimate sector or regional emissions.

**Avoided emissions are not scope 3.** Category 11 captures actual use-phase emissions from sold products. It does not capture emissions avoided compared to alternative products. A wind turbine manufacturer's Cat 11 reflects the (near-zero) emissions from operating turbines, not the fossil fuel emissions displaced. Avoided emissions claims require separate project accounting methodology and must be reported outside the scopes, never deducted from the inventory.

(→ [[sources/ghg-protocol-scope-3-faq|GHG Protocol Scope 3 FAQ]])

## Calculation Notes

Scope 3 calculations are highly category-dependent. The GHG Protocol Scope 3 Standard and its companion Technical Guidance define four data quality tiers (best to least accurate):

1. **Supplier-specific data** — primary activity data directly from value chain partners
2. **Hybrid** — primary activity data combined with secondary emission factors
3. **Average industry data** — sector-average emission factors applied to activity data
4. **Spend-based (EEIO)** — economic input-output emission intensity applied to procurement spend

Companies should target the highest available tier for their largest emission categories. For most businesses, Category 1 (Purchased goods and services) is the largest scope 3 source and merits primary data investment. For product manufacturers, Category 11 (Use of sold products) frequently dominates.

Do not embed numerical emission factor values in wiki pages — see external emission factor database.

**ESRS value-chain proxy provision (ESRS 1 Chapter 5.2):** Under CSRD reporting, the use of sector-average data and other proxies (Tier 3 and Tier 4 in the GHG Protocol hierarchy above) is **explicitly permitted** when the undertaking cannot collect direct value-chain information after reasonable efforts — particularly relevant for SME suppliers outside the scope of mandatory reporting. This is the legal basis for spend-based EEIO methods in CSRD/ESRS E1-6 disclosures. ESRS 1 Section 10.2 also provides a **3-year transitional provision** allowing exclusion of metric-level value-chain information not reasonably available, with disclosure of efforts. See [[regulations/esrs-1|ESRS 1]] and [[concepts/esrs-phase-in|ESRS Phase-in]].

**ESRS reporting boundary for Scope 3 (per EFRAG IG 2 §2.3):** The Scope 3 reporting boundary follows the **financial-statement consolidation perimeter** (same parent + financially-controlled subsidiaries as the financial statements). Material IROs in business relationships outside the consolidation perimeter — upstream suppliers, downstream customers, end-of-life paths — are reported as Scope 3. Importantly:

- **Cat 15 (Investments)** captures emissions of **associates, joint ventures, and unconsolidated investments** outside the financial-control perimeter. Equity-method investees flow into Cat 15 (PCAF attribution methodology applies — see [[methodologies/scope-3-cat15-financed-emissions|Scope 3 Cat 15]]).
- **ESRS E1 ¶50(b)** requires a **separate** disclosure of 100% Scope 1/2 from operationally-controlled sites — even where not financially controlled. This is *additional* to Scope 3, not a substitute. The two are not netted.
- The IG 2 **Seren Group worked example** (¶141–150) walks through the mechanics for a parent + subsidiaries + joint operation + associate scenario.

(→ [[sources/efrag-ig2-value-chain-2024|EFRAG IG 2 — Value Chain (May 2024)]]) (→ [[methodologies/double-materiality-assessment|Double Materiality Assessment]])

(→ [[sources/ghg-protocol-scope-3-calc-guidance|Technical Guidance for Calculating Scope 3 Emissions]])
(→ [[sources/esrs-set1-2023-2772|ESRS Set 1 — Commission Delegated Regulation 2023/2772]])

## Regulatory References

- **GHG Protocol Corporate Standard (Revised)** — Chapter 4, pp. 25–33; Appendix D lists Scope 3 categories by sector
- **GHG Protocol Scope 3 Standard (2011)** — defines the 15 categories, minimum boundaries, and all reporting requirements
- **Technical Guidance for Calculating Scope 3 Emissions (2013)** — calculation methods and worked examples for all 15 categories
- **CSRD / ESRS E1** — mandatory Scope 3 disclosure for large EU companies; E1-6 requires all 15 categories where material; Year 1 opt-out on full category breakdown (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])
- **SB 253 (CCDAA)** — Scope 3 reporting required for California-reporting companies above $1B revenue

## Related

- [[concepts/scope-3-categories|Scope 3 Categories — The 15 Value Chain Emission Categories]]
- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/operational-boundary|Operational Boundary]]
- [[concepts/additionality|Additionality]] — relevant for carbon credit and offset accounting in Scope 3 inventories
- [[regulations/csrd|EU CSRD]] — mandates Scope 3 for large EU companies
- [[regulations/esrs-1|ESRS 1]] — value chain inclusion rules and proxy permission underpinning Scope 3 reporting
- [[regulations/esrs-e1|ESRS E1]] — E1-6 is the Scope 3 disclosure requirement; E1-7 covers carbon credits
- [[concepts/esrs-phase-in|ESRS Phase-in]] — 750-employee size-conditional Scope 3 omission and 3-year value-chain transitional provision
- [[methodologies/double-materiality-assessment|Double Materiality Assessment]] — financial-control vs operational-control vs value-chain boundary mechanics
- [[methodologies/scope-3-cat15-financed-emissions|Scope 3 Cat 15 — Financed Emissions]] — Cat 15 covers associates / JVs / unconsolidated investees in ESRS reporting
