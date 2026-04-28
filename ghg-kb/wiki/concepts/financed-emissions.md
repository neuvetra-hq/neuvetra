---
id: financed-emissions
type: concept
title: "Financed Emissions"
aliases:
  - financed emissions
  - portfolio emissions
  - scope 3 category 15 financed emissions
  - investment emissions
jurisdiction: Global
scope: [3]
business_size: large
tags: [scope-3, cat-15, financed-emissions, attribution, evic, financial-services, pcaf, portfolio]
last_updated: 2026-04-25
source_count: 1
references:
  - pcaf-financed-emissions-parta-2025
  - ghg-protocol-scope-3-standard
  - scope-3-cat15-financed-emissions
  - financial-services
  - pcaf
parent: scope-3-categories
---

## Definition

**Financed emissions** are the GHG emissions associated with a financial institution's loans, investments, and other on-balance-sheet financial activities, attributed to the institution proportionally to its share of the financed entity's funding. Financed emissions are **Scope 3 Category 15 (Investments)** under the GHG Protocol Scope 3 Standard.

They are the largest share of most financial institutions' overall climate impact — typically 95–99% of total inventory for banks, insurers, and asset managers — and are the foundation for portfolio-level climate risk assessment and disclosure.

(→ [[pcaf-financed-emissions-parta-2025|PCAF Financed Emissions Standard, 3rd Edition]])

## Why It Matters

A financial institution's own operational footprint (Scope 1 + Scope 2) is dwarfed by the emissions of the companies, projects, and assets it finances. Reporting only the operational footprint materially misrepresents the climate impact of a bank or asset manager. Financed emissions are now required under:

- **PCAF** (industry-led) — third edition (Dec 2025) covers ten asset classes; the GHG-Protocol-aligned methodology is the de facto standard with 670+ signatories.
- **CSRD / ESRS E1** — financial institutions must disclose Cat 15 under the double-materiality assessment.
- **SB 253 (CCDAA)** — large financial institutions doing business in California must report Scope 3 (including Cat 15) under the CARB-set schedule.
- **TCFD-aligned frameworks** (referenced by SB 261, IFRS S2) — financed emissions feed into portfolio climate-risk scenario analysis.
- **SBTi Financial Institutions framework** — Cat 15 baseline and target-setting use PCAF data quality scoring.

## Key Distinctions

**Financed emissions ≠ a company's own emissions.** They are *attributed* — a proportional share of a counterparty's emissions, allocated based on the financial institution's share of that counterparty's funding base.

**Same physical emission appears in multiple inventories.** A power plant's CO2 is reported (a) by the operator as Scope 1, (b) by its bank as Cat 15 financed emissions, (c) by its electricity buyer as Scope 2, and (d) by every shareholder/bondholder proportional to their holdings. Cat 15 is *not* added across institutions — the same tonne is intentionally double-counted across the value chain. PCAF requires separate disclosure of FI-to-FI exposure to enable de-duplication when comparing across the financial sector.

**Generated vs avoided vs removal emissions.** Financed emissions are *generated* emissions only. Carbon removals (e.g., investee-operated DAC, reforestation projects) and carbon credits retired or generated must be reported **separately** and never netted into the gross financed-emissions figure. Avoided-emissions accounting (e.g., financed renewable projects displacing fossil generation) is **out of scope of the PCAF Standard** and covered in supplemental guidance. (→ [[concepts/co2-removals|CO2 Removals]])

**Categories 15a / 15b / 15c.** Cat 15 has three sub-categories under the GHG Protocol Scope 3 Standard: (a) equity and debt investments; (b) corporate loans and project finance; (c) insurance underwriting. PCAF Part A covers the first two; PCAF Part C covers underwriting separately.

## Calculation Notes

The universal PCAF attribution principle, applied to every asset class:

```
financed_emissions = Σ (attribution_factor_c × emissions_c)
                       c

attribution_factor_c = outstanding_amount_c / counterparty_value_c
```

Where the **denominator** depends on the counterparty type:

| Counterparty | Denominator | Notes |
|---|---|---|
| Listed company | EVIC | Enterprise Value Including Cash; market cap (ordinary + preferred) + total book debt + minorities; cash *not* deducted |
| Private company / unlisted equity | Total equity + total debt | From client balance sheet; if equity is negative, set to 0 (all emissions attributed to debt) |
| Other financial institution | EVIC or Total equity + debt + customer deposits | Customer deposits substitute for debt/equity in a bank's funding base |
| Project finance | Total project debt + equity | Look-through to project SPV |
| Real estate (CRE / mortgage) | Property value at origination | Loan-to-value-style attribution |
| Sovereign / sub-sovereign debt | Government PPP-adjusted GDP (sovereign) or sub-sovereign equivalent | Specific equations in PCAF §5.9 / §5.10 |

**Three calculation options for the emissions term**, with five-tier data quality scoring:

| Option | Source of emissions data | Data quality score |
|---|---|---|
| 1a Reported (verified) | Counterparty's verified disclosure (e.g., assured CDP submission) | 1 (best) |
| 1b Reported (unverified) | Counterparty's unverified disclosure | 2 |
| 2a Physical-activity (energy) | EFs applied to fuel/electricity consumption | 2 |
| 2b Physical-activity (production) | EFs applied to physical output (e.g., tonnes of steel) | 3 |
| 3a Economic-activity (revenue × sector EF) | EEIO factor × counterparty revenue | 4 |
| 3b Economic-activity (asset × sector EF) | EEIO factor × sector assets, when revenue unavailable | 5 |
| 3c Economic-activity (revenue × turnover) | Sector revenue EF + asset-turnover ratio | 5 (worst) |

Institutions report the **portfolio-weighted average** data quality score, not the minimum. A mixed portfolio (Option 1 for high-disclosure counterparties, Option 3 for the long tail) is normal and the score reflects the actual mix.

## Regulatory References

- **PCAF Part A: Financed Emissions, 3rd Edition** (Dec 2025) — covers 10 asset classes; the de facto industry standard
- **GHG Protocol Scope 3 Standard** — Category 15 definition, minimum boundary
- **GHG Protocol Scope 3 Calculation Guidance** — Chapter 15 worked examples
- **Commission Delegated Regulation (EU) 2020/1818** — defines EVIC for EU Climate Transition Benchmarks; the PCAF EVIC definition aligns with this
- **EU TEG Handbook of Climate Transition Benchmarks** — original EVIC formalization
- **CSRD / ESRS E1** — disclosure requirement for financial sector
- **SB 253 (CCDAA)** — Scope 3 disclosure requirement for large CA-doing-business institutions

## Related

- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 15 is the parent category
- [[concepts/scope-3|Scope 3 — Other Indirect GHG Emissions]]
- [[concepts/co2-removals|CO2 Removals]] — reported separately from financed gross emissions
- [[methodologies/scope-3-cat15-financed-emissions|Scope 3 Cat 15 — Financed Emissions Methodology]] — asset-class equations
- [[organizations/pcaf|Partnership for Carbon Accounting Financials (PCAF)]]
- [[sectors/financial-services|Financial Services]]
- [[pcaf-financed-emissions-parta-2025|PCAF Financed Emissions Standard, 3rd Edition]]
