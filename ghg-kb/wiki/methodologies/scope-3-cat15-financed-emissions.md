---
id: scope-3-cat15-financed-emissions
type: methodology
title: "Scope 3 Cat 15 — Financed Emissions (PCAF Method)"
aliases:
  - financed emissions methodology
  - PCAF financed emissions
  - Cat 15 methodology
  - category 15 investments
jurisdiction: Global
scope: [3]
scope3_category: 15
business_size: large
tags: [scope-3, cat-15, financed-emissions, pcaf, financial-services, banking, asset-management]
last_updated: 2026-04-25
source_count: 1
references:
  - pcaf-financed-emissions-parta-2025
  - ghg-protocol-scope-3-standard
  - ghg-protocol-scope-3-calc-guidance
  - financed-emissions
  - pcaf
parent: scope-3-categories
applies_to:
  - financial-services
---

## Overview

The PCAF Global GHG Accounting and Reporting Standard Part A (Third Edition, December 2025) is the authoritative methodology for calculating Scope 3 Category 15 (Investments) emissions for financial institutions. It supplements the GHG Protocol Scope 3 Standard — which defines Category 15 but provides no asset-class-level calculation detail — with practical methods for ten distinct asset classes.

The standard is published by the Partnership for Carbon Accounting Financials (PCAF), an industry-led initiative with 670+ signatory financial institutions as of November 2025. The First Edition (2020) was reviewed by the GHG Protocol; subsequent editions have not been reviewed because the GHG Protocol closed its review service.

(→ [[organizations/pcaf|PCAF — Partnership for Carbon Accounting Financials]])

## When To Use

Use this methodology when a financial institution needs to calculate and disclose Scope 3 Category 15 emissions from:
- Loans and investments in businesses (listed or unlisted)
- Project finance
- Real estate mortgages and commercial property loans
- Motor vehicle loans
- Sovereign or sub-sovereign debt
- Use of proceeds structures (labeled bonds, sustainability-linked instruments)
- Securitizations and structured products

Do **not** use Part A for:
- Capital markets facilitation (underwriting, syndication) → use PCAF Part B
- Re/insurance underwriting attribution → use PCAF Part C
- General consumer finance not linked to a specific use of proceeds (e.g., credit cards, personal loans) → out of scope for Part A

## Step-by-Step

### Step 1 — Set the consolidation approach

Financial institutions must use either the **operational control** or **financial control** consolidation approach. The equity share approach is prohibited under PCAF because it would pull investee Scope 1 and 2 into the FI's own Scope 1 and 2 inventory — all financed emissions must be reported under Scope 3 Category 15.

### Step 2 — Select the asset class

Use the PCAF decision tree (Figure 5-1 of the Standard) to assign each exposure to the correct asset class method. Key questions:

| Question | If Yes | If No |
|---|---|---|
| Is the exposure debt and/or equity? | Continue | Out of scope (Part B or C may apply) |
| Are proceeds allocated to specific assets? | → Use of proceeds / project / mortgage / auto method | → Corporate method (listed/unlisted equity or business loan) |
| Is the structure securitized? | → Securitizations & Structured Products | → Use of proceeds method |
| Is the FI the sovereign or sub-sovereign issuer? | → Sovereign / Sub-sovereign Debt | → Corporate method |

### Step 3 — Calculate the attribution factor

For all corporate asset classes:

```
Attribution Factor = Outstanding amount (at fiscal year-end)
                     ─────────────────────────────────────────
                     EVIC (Enterprise Value Including Cash)
```

**EVIC** = total equity market cap + total debt of the borrower/investee. For listed companies, EVIC is directly observable. For unlisted companies, use book value of equity + total debt as a proxy.

For project finance and real estate, the denominator is total project or property value (equity + debt in the deal), not company-level EVIC.

### Step 4 — Obtain borrower/investee emissions data

PCAF defines a data quality hierarchy. Use the highest quality tier available:

| Score | Tier | Description |
|---|---|---|
| 1 | Verified reported | Third-party-audited Scope 1+2 emissions from borrower/investee |
| 2 | Unverified reported | Self-reported Scope 1+2 from borrower/investee (e.g., sustainability report) |
| 3 | Physical activity-based | FI estimates emissions from primary activity data (energy kWh, tonnes produced) × emission factors |
| 4 | Economic activity-based (company-specific) | Outstanding amount ÷ EVIC × revenue × sector emission intensity (tCO2e/$ revenue) |
| 5 | Economic activity-based (EEIO proxy) | Sector-average emission intensity from EEIO tables (EXIOBASE, USEEIO) × portfolio exposure |

Institutions must disclose the weighted-average data quality score across the portfolio for each asset class. Score mix (e.g., "40% score 1, 35% score 2, 25% score 5") is a standard disclosure requirement.

### Step 5 — Calculate financed emissions

```
Financed Emissions (tCO2e) = Attribution Factor × Total Emissions of Borrower/Investee
```

For a portfolio, sum across all exposures within each asset class. Report by asset class and in aggregate.

### Step 6 — Apply reporting requirements

**Required ("shall"):**
- Disclose absolute financed emissions at minimum annually
- Align reporting period with financial accounting cycle
- Report by asset class and disclose coverage percentage (what share of total loans/investments is included)
- Disclose data quality score mix for each asset class
- Establish and disclose a significance threshold for base-year recalculation
- Use operational or financial control consolidation approach
- Disclose and justify any exclusions

**Recommended ("should"):**
- Report multiple comparable time periods
- Conduct a fluctuation analysis year-over-year *(new — Third Edition)*
- Apply an inflation adjustment when comparing across years *(new — Third Edition)*
- Report scope 1+2 and scope 3 of borrowers/investees separately to enable double-counting transparency

**Separate reporting required:**
- Emission removals (e.g., forestry project finance) must be reported separately from absolute emissions
- Avoided emissions (e.g., renewable energy project finance) must be reported separately — PCAF Part A excludes avoided emissions calculations; use PCAF supplemental guidance

## Data Requirements

| Data item | Source |
|---|---|
| Outstanding loan/investment amounts at fiscal year-end | FI's own books |
| EVIC (listed companies) | Bloomberg, Refinitiv, FactSet |
| Book equity + debt (unlisted companies) | Borrower financials |
| Scope 1+2 emissions of borrowers/investees | CDP, Bloomberg ESG, MSCI ESG, Sustainalytics, S&P Trucost; or borrower sustainability reports |
| Sector emission intensities (Score 3–5) | EXIOBASE, USEEIO, CEDA, WIOD, PCAF emission factor database (signatories only) |
| Physical activity data (Score 3) | Borrower operational data (energy bills, production records) |

## Worked Example

**Corporate loan — Score 2 (unverified reported emissions)**

- Bank holds a $50M loan to Acme Manufacturing
- Acme's EVIC = $400M (equity $250M + debt $150M)
- Acme's Scope 1+2 emissions (self-reported) = 200,000 tCO2e

```
Attribution Factor = $50M / $400M = 12.5%
Financed Emissions = 12.5% × 200,000 = 25,000 tCO2e
Data quality score = 2 (unverified reported emissions)
```

**Commercial real estate loan — Score 5 (EEIO proxy)**

- Bank holds a $10M loan on a 50,000 sq ft office building
- Total property value = $25M
- Sector emission intensity (US office, EEIO) = 0.15 tCO2e / sq ft

```
Attribution Factor = $10M / $25M = 40%
Building emissions (estimated) = 50,000 × 0.15 = 7,500 tCO2e
Financed Emissions = 40% × 7,500 = 3,000 tCO2e
Data quality score = 5 (physical area × sector intensity proxy)
```

## Limitations

- **Data gap for private companies:** Most borrowers/investees in private debt portfolios do not disclose GHG data. Score 3–5 proxies introduce significant uncertainty; data quality disclosure is required precisely because of this.
- **No GHG Protocol review of recent additions:** PCAF's Second and Third Edition additions have not been reviewed by the GHG Protocol. The "Built on GHG Protocol" mark applies only to the six original asset classes from the 2020 First Edition.
- **Scope 3 of borrowers not required:** PCAF requires capturing Scope 1+2 of borrowers/investees as the minimum. Scope 3 of investees is optional; where included it must be reported separately to avoid double-counting distortions.
- **Avoided emissions excluded:** Renewable energy project finance, for example, displaces emissions from the grid. PCAF Part A does not calculate these avoided emissions — a supplemental PCAF guidance document handles that optionally.
- **Insurance underwriting not covered:** Emissions from insured assets are governed by PCAF Part C (Insurance-Associated Emissions), not Part A.

## Related

- [[organizations/pcaf|PCAF — Partnership for Carbon Accounting Financials]]
- [[concepts/financed-emissions|Financed Emissions]] — concept page covering the universal attribution principle
- [[concepts/co2-removals|CO2 Removals]] — separately reported alongside attributed gross emissions
- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 15 definition
- [[sectors/financial-services|Financial Services]] — primary sector applying this method
- [[sources/pcaf-financed-emissions-parta-2025|PCAF Financed Emissions Standard — Third Edition (2025)]]
- [[sources/ghg-protocol-scope-3-standard|GHG Protocol Scope 3 Standard]] — parent standard defining Cat 15
