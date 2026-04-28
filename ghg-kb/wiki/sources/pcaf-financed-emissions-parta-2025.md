---
id: pcaf-financed-emissions-parta-2025
type: source
title: "PCAF Global GHG Accounting and Reporting Standard — Part A: Financed Emissions (3rd Edition, December 2025)"
aliases:
  - PCAF Financed Emissions Standard 3rd edition
  - PCAF Standard Part A
  - PCAF 2025
  - Global GHG Accounting and Reporting Standard for the Financial Industry
jurisdiction: Global
scope: [3]
business_size: large
tags: [pcaf, financed-emissions, scope-3, cat-15, financial-services, attribution, evic, data-quality, asset-class, standard]
effective_date: 2025-12-01
last_updated: 2026-04-24
source_count: 0
references:
  - ghg-protocol-corporate-standard
  - ghg-protocol-scope-3-standard
  - ghg-protocol-scope-3-calc-guidance
  - financed-emissions
  - scope-3-categories
  - scope-3-cat15-financed-emissions
  - pcaf
  - financial-services
supersedes:
  - pcaf-financed-emissions-2e-2023  # TODO: create page — Second Edition (2023) not yet ingested
  - pcaf-financed-emissions-1e-2020  # TODO: create page — First Edition (2020) not yet ingested
---

## Metadata

- **Publisher:** Partnership for Carbon Accounting Financials (PCAF)
- **Published:** December 2025
- **Edition:** Third
- **Pages:** ~210
- **File:** `raw/standards/global-standard-pcaf-financed-emissions-parta-2025.pdf`
- **Classification:** standards
- **Status:** In force; the leading methodology for Scope 3 Category 15 (Investments) accounting in the financial sector
- **Conformance with GHG Protocol:** Only the **first edition (Nov 2020)** carries the *Built on GHG Protocol* mark, granted for six asset classes (listed equity & corporate bonds; business loans & unlisted equity; project finance; commercial real estate; mortgages; motor vehicle loans). The second (Dec 2023) and third (Dec 2025) editions have **not** been reviewed because the GHG Protocol closed its *Built on GHG Protocol* review service.
- **Citation:** PCAF (2025). *The Global GHG Accounting and Reporting Standard Part A: Financed Emissions. Third Edition.*

## Key Takeaways

1. **Ten asset classes covered.** v3 adds four new methodologies — use-of-proceeds structures (§5.7), securitization and structured products (§5.8), sub-sovereign debt (§5.10), and an optional IFRS S1/S2 reporting track for undrawn loan commitments (§6.2). The original six asset classes from v1 plus sovereign debt (added in v2) round out the 10. Asset-class scope: listed equity & corporate bonds; business loans & unlisted equity; project finance; commercial real estate; mortgages; motor vehicle loans; use-of-proceeds structures; securitization & structured products; sovereign debt; sub-sovereign debt.

2. **Universal attribution principle.** Every asset class applies the same logic: the financial institution accounts for `attribution_factor × counterparty_emissions`, where `attribution_factor = outstanding_amount / counterparty_value`. The denominator is **EVIC** (Enterprise Value Including Cash) for listed companies and **total equity + debt** for private companies — aligned with EU TEG / Commission Delegated Regulation (EU) 2020/1818. Cash is *not* deducted, which (a) avoids negative enterprise values and (b) prevents over-100% attribution. (→ [[concepts/financed-emissions|Financed Emissions]])

3. **Three calculation options, five-tier data quality scoring.** Option 1 (reported emissions, verified=Score 1, unverified=Score 2); Option 2 (physical activity-based, Score 2–3); Option 3 (economic activity-based / EEIO, Score 4–5). Financial institutions must report a portfolio-weighted average data quality score. Recommended EEIO sources: EXIOBASE, CEDA, GTAP, WIOD; emission factor databases: ecoinvent, DEFRA, IPCC, GEMIS, FAO. (→ [[methodologies/scope-3-cat15-financed-emissions|Scope 3 Cat 15 — Financed Emissions Methodology]])

4. **Scope 3 of borrowers/investees mandatory for all sectors as of 2025 reports.** Phase-in: oil & gas + mining (NACE L2: 05–09, 19, 20) from 2021 reports; transportation, construction, buildings, materials, industrial activities (NACE L2: 10–18, 21–33, 41–43, 49–53, 81) from 2023 reports; **every sector from 2025 reports onwards**. PCAF acknowledges this creates double counting across financial institutions and recommends separate disclosure of FI-to-FI exposure to enable de-duplication.

5. **Customer deposits count as debt for FI-to-FI exposures.** When the borrower or investee is itself a financial institution, the book value of debt used in the attribution denominator includes customer deposits, since these substitute for debt and equity in the funding base of a bank.

6. **Inventory fluctuation framework (new in v3).** Two new reporting recommendations developed in response to the 2024 *Inventory Fluctuation* discussion paper: (a) a fluctuation analysis decomposing year-on-year inventory change into emissions effect, attribution effect (EVIC/balance-sheet movement), and portfolio composition effect; (b) an inflation-adjustment factor applied to economic emission intensities to control for nominal vs real changes in EVIC. Both are *recommendations*, not requirements; uncorrected absolute emissions remain the mandatory floor.

7. **Emission removals reported separately, never netted into absolute emissions.** Verified company-level removals (e.g., reforestation, BECCS, DAC purchased by an investee) are attributed using the same attribution factor and reported as a separate line item alongside the gross financed inventory. Carbon credits retired and generated are also tracked but optional. Avoided-emissions accounting is **out of scope** of the Standard and covered in a separate PCAF supplemental guide. (→ [[concepts/co2-removals|CO2 Removals]])

8. **EVIC chosen over enterprise value because it includes cash.** Worked example: Equity 50, Debt 50, Cash 20. Standard EV (50+50−20 = 80) attributes 50/80 = 63% to equity *and* 50/80 = 63% to debt — totalling 125%. EVIC (50+50 = 100) attributes 50/100 = 50% to each — exactly 100%. EVIC is also the metric required by Commission Delegated Regulation (EU) 2020/1818 for EU Climate Transition Benchmarks and EU Paris-Aligned Benchmarks.

9. **Data quality scoring is portfolio-weighted, not minimum.** Institutions can mix Option 1 for high-coverage counterparties with Option 3 for the long tail; the average score reflects the actual data quality mix and steers clients toward improving the worst-scored portion of the portfolio.

10. **PCAF community: 670+ financial institutions globally** as of November 2025. Industry-led; secretariat operated by Guidehouse. Funded by Bloomberg Philanthropies, Sequoia Climate Foundation, Climate Arc, Laudes Foundation. Two-year v3 development cycle (Feb 2024 – Nov 2025) included a Dec 2024 – Feb 2025 public consultation.

## What This Updated in the Wiki

- New page: [[methodologies/scope-3-cat15-financed-emissions|Scope 3 Cat 15 — Financed Emissions Methodology]] — asset-class-specific equations and data quality scoring; worked examples; reporting requirements table
- New page: [[organizations/pcaf|Partnership for Carbon Accounting Financials (PCAF)]] — organization page with three-part standard structure, GHG Protocol relationship, and regulatory references
- Updated: [[sectors/financial-services|Financial Services]] — Cat 15 section rewritten for Third Edition: 10 asset classes listed; Part A/B/C structure clarified; PCAF attribution formula added; data quality scoring explained; Recommended Methodologies table expanded; Related section updated; source_count 0→1
- Updated: [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 15 table row updated with PCAF attribution formula, wikilink to methodology; Related section updated; source_count 3→4
- Supersedes the unverified PCAF references that previously existed only as descriptive text on the financial-services sector page
- Note: [[concepts/financed-emissions|Financed Emissions]] concept page (referenced in frontmatter) is pending — create on next relevant ingest

## Raw File Link

`raw/standards/global-standard-pcaf-financed-emissions-parta-2025.pdf`
