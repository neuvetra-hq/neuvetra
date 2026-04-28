---
id: scope-3-categories
type: concept
title: "Scope 3 Categories — The 15 Value Chain Emission Categories"
aliases:
  - 15 scope 3 categories
  - scope 3 categories
  - value chain categories
  - GHG Protocol scope 3 categories
jurisdiction: Global
scope: [3]
business_size: any
tags: [scope-3, categories, value-chain, upstream, downstream]
last_updated: 2026-04-25
source_count: 6
references:
  - ghg-protocol-scope-3-standard
  - ghg-protocol-scope-3-calc-guidance
  - ghg-protocol-scope-3-faq
  - pcaf-financed-emissions-parta-2025
  - ghg-protocol-land-sector-removals-2026
  - esrs-1
  - esrs-e1
  - esrs-phase-in
parent: scope-3
---

## Definition

The GHG Protocol Scope 3 Standard organizes all value chain indirect emissions into **15 mutually exclusive categories**. The categories provide a systematic framework so that every company accounts for scope 3 emissions in a consistent, comparable way.

Categories are divided into:
- **Upstream (1–8):** emissions related to purchased/acquired goods and services
- **Downstream (9–15):** emissions related to sold goods and services

(→ [[sources/ghg-protocol-scope-3-standard|GHG Protocol Scope 3 Standard]])

## Why It Matters

Companies are **required** to report scope 3 emissions by category under the Scope 3 Standard. If a category is excluded, the exclusion must be disclosed and justified. The 15-category structure:
- Enables consistent comparison across companies
- Prevents cherry-picking of only low-emission categories
- Maps directly to reduction strategies (each category points to different levers)
- Satisfies CSRD/ESRS E1 and SB 253 scope 3 reporting requirements

## Key Distinctions

**Mutually exclusive for one company:** No emission falls in two categories for the same reporter. The categories are designed so that every value chain activity has exactly one home.

**Not mutually exclusive across companies:** The same physical emission can appear in multiple companies' scope 3 inventories (e.g., a manufacturer's Category 11 is a retailer's Category 1). Scope 3 inventories must never be summed across companies.

**Minimum boundary vs. optional activities:** Each category has a minimum boundary below which companies must not go. Companies may expand coverage beyond the minimum; any exclusions within the minimum must be justified.

**Time boundary variation:** Some categories capture emissions that occurred in the past (Cat 1, 2, 3), some simultaneous with the reporting year (Cat 4–8), and some **future** expected emissions that result from goods sold or waste generated in the reporting year (Cat 5, 11, 12). Future-year categories must be labelled clearly to avoid misinterpretation.

## Calculation Notes

Data quality tiers from most to least accurate (→ [[sources/ghg-protocol-scope-3-calc-guidance|Scope 3 Calculation Guidance]]):

1. **Supplier-specific data** — primary activity data directly from value chain partners
2. **Hybrid data** — primary activity data combined with secondary emission factors
3. **Average industry data** — sector-average emission factors applied to activity data
4. **Spend-based (EEIO)** — economic input-output emission intensity multiplied by procurement spend

Companies should use the highest-quality data tier feasible for their largest emission categories. Category 1 and Category 11 are typically the largest for most companies and warrant primary data efforts.

## The 15 Categories

### Upstream Categories (1–8)

| # | Category | What it Covers | Minimum Boundary |
|---|---|---|---|
| 1 | **Purchased goods and services** | Extraction, production, and transport of all goods/services purchased in the reporting year (excluding Categories 2–8). For agricultural inputs, the **GHG Protocol Land Sector and Removals Standard (v1.0, eff. 2027)** explicitly requires inclusion of life-cycle GHG emissions of feed, fertilizer, pesticides, herbicides; emissions from food loss and waste prior to purchase; and **land use change emissions** linked to sourcing regions. (→ [[concepts/land-use-change-emissions\|Land Use Change Emissions]]) | All upstream (cradle-to-gate) emissions of purchased goods/services |
| 2 | **Capital goods** | Extraction, production, and transport of capital goods purchased in the reporting year | All upstream (cradle-to-gate) emissions of purchased capital goods |
| 3 | **Fuel- and energy-related activities** (not Scope 1/2) | Well-to-tank emissions of purchased fuels; upstream of purchased electricity; T&D losses; electricity sold to end users (utilities only) | Cradle-to-gate of fuels; upstream of electricity; T&D losses |
| 4 | **Upstream transportation and distribution** | Transport of purchased products from tier-1 suppliers to reporting company; transport between company facilities (in third-party vehicles) | Scope 1 + 2 of transport providers |
| 5 | **Waste generated in operations** | Disposal and treatment of waste from operations (at third-party facilities) | Scope 1 + 2 of waste management suppliers |
| 6 | **Business travel** | Transport of employees for business purposes (in third-party vehicles) | Scope 1 + 2 of transport carriers |
| 7 | **Employee commuting** | Transport of employees between home and worksite (in third-party or employee-owned vehicles) | Scope 1 + 2 of employees and carriers |
| 8 | **Upstream leased assets** | Operation of assets leased by the reporting company (lessee) that are excluded from scope 1/2 | Scope 1 + 2 of lessors during company's operation of the asset |

### Downstream Categories (9–15)

| # | Category | What it Covers | Minimum Boundary |
|---|---|---|---|
| 9 | **Downstream transportation and distribution** | Transport of sold products from reporting company to end consumer (in third-party vehicles/facilities) | Scope 1 + 2 of transport providers, distributors, and retailers |
| 10 | **Processing of sold products** | Processing of intermediate products sold to downstream manufacturers | Scope 1 + 2 of downstream processors |
| 11 | **Use of sold products** | End use of goods/services sold in the reporting year over their expected lifetime | Direct use-phase emissions over lifetime (energy consumed by, fuels in, or GHGs emitted from sold products). **Note:** captures actual use-phase emissions only — not avoided emissions vs. alternatives. Avoided emissions are outside the scopes. |
| 12 | **End-of-life treatment of sold products** | Disposal and treatment of sold products at end of product life | Scope 1 + 2 of waste managers handling sold products |
| 13 | **Downstream leased assets** | Operation of company-owned assets leased to other entities (lessor perspective) | Scope 1 + 2 of lessees |
| 14 | **Franchises** | Operation of franchises (franchisor perspective) | Scope 1 + 2 of franchisees |
| 15 | **Investments** | GHG emissions from equity investments, project finance, and debt not consolidated in scope 1/2. The PCAF Global GHG Accounting and Reporting Standard Part A (Third Edition, 2025) is the authoritative methodology — it provides asset-class-specific calculation methods and a 1–5 data quality scoring framework. (→ [[methodologies/scope-3-cat15-financed-emissions\|Cat 15 Methodology]]) | Scope 1 + 2 of investees (proportional to outstanding exposure ÷ EVIC); Scope 3 of investees optional |

## Regulatory References

- **GHG Protocol Scope 3 Standard** — defines all 15 categories, minimum boundaries, and reporting requirements (Chapter 5, Table 5.4); reporting requirements in Chapter 11
- **ESRS E1** — requires Scope 3 disclosure by category under CSRD
- **SB 253 (CCDAA)** — requires Scope 3 reporting for California-filing large companies; categories aligned with GHG Protocol

## ESRS value-chain proxy provision

Under CSRD/ESRS reporting, sector-average data and other proxies are explicitly permitted for any Scope 3 category where direct collection from value-chain partners is impractical (ESRS 1 Chapter 5.2). This applies particularly to Categories 1, 4, 9, 11, 12, and 15 where SME suppliers, complex multi-tier supply chains, or millions of end-users make direct collection infeasible. ESRS 1 Section 10.2 also provides a 3-year transitional provision allowing exclusion of metric-level value-chain information not reasonably available, with required disclosure of efforts. See [[regulations/esrs-1|ESRS 1]] and [[concepts/esrs-phase-in|ESRS Phase-in]].

## Related

- [[concepts/scope-3|Scope 3 — Other Indirect GHG Emissions]]
- [[concepts/scope-1|Scope 1 — Direct GHG Emissions]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/organizational-boundary|Organizational Boundary]]
- [[concepts/financed-emissions|Financed Emissions]] — Cat 15 concept page
- [[concepts/land-use-change-emissions|Land Use Change Emissions]] — required component of Cat 1 for agricultural inputs
- [[concepts/co2-removals|CO2 Removals]] — reported separately, not netted into Cat 15 or Cat 1
- [[concepts/esrs-phase-in|ESRS Phase-in]] — 750-employee Scope 3 omission and 3-year value-chain transitional provision
- [[methodologies/scope-3-cat15-financed-emissions|Scope 3 Cat 15 — Financed Emissions (PCAF Method)]]
- [[regulations/esrs-1|ESRS 1]] — value chain inclusion rules underpinning Scope 3 categories
- [[regulations/esrs-e1|ESRS E1]] — E1-6 is the Scope 3 disclosure requirement
- [[sources/ghg-protocol-scope-3-standard|GHG Protocol Scope 3 Standard]]
- [[sources/ghg-protocol-scope-3-calc-guidance|Technical Guidance for Calculating Scope 3 Emissions]]
- [[sources/ghg-protocol-land-sector-removals-2026|GHG Protocol Land Sector and Removals Standard]]
- [[sources/esrs-set1-2023-2772|ESRS Set 1 — Commission Delegated Regulation 2023/2772]]
