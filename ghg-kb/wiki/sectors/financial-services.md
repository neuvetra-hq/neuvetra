---
id: financial-services
type: sector
title: "Financial Services"
aliases:
  - banking
  - finance
  - insurance
  - asset management
  - investment management
  - financial institutions
  - banks
  - insurers
jurisdiction: Global
scope: [1, 2, 3]
business_size: large
tags: [financial-services, banking, insurance, asset-management, cat-15, financed-emissions, scope-3]
last_updated: 2026-04-25
source_count: 2
references:
  - sb253-ccdaa
  - sb261
  - csrd
  - esrs-e1
  - scope-3-categories
  - scope-2
  - financed-emissions
  - co2-removals
  - scope-2-location-based
  - scope-3-cat15-financed-emissions
  - pcaf
  - pcaf-financed-emissions-parta-2025
calculated_by:
  - scope-2-location-based
  - scope-3-cat15-financed-emissions
---

## Profile

Financial services companies — banks, insurers, asset managers, pension funds, and investment firms — have a highly unusual GHG profile: their **own operational emissions are small**, but the emissions financed through their loans, investments, and underwriting can be **orders of magnitude larger** than their entire direct footprint.

A regional bank's offices and data centers might emit 50,000 MT CO2e per year. Its loan portfolio — mortgages on buildings, commercial loans to manufacturers, project finance for infrastructure — may finance 5–50 million MT CO2e of emissions annually. This is **Scope 3 Category 15: Financed Emissions**, and it is the reason financial institutions have become central to global climate disclosure frameworks.

The sector is **heavily regulated under SB 261 and CSRD** for climate risk disclosure (financial risks from climate change affect loan books, investment portfolios, and insurance underwriting directly). SB 253 also applies to large institutions by revenue.

## Applicable Regulations

**California:**
- **SB 253 (CCDAA):** Applies if annual revenue exceeds $1,000,000,000. Most major banks, insurers, and asset managers qualify. First Scope 1/2 disclosure due 2026-08-10; Scope 3 (including Cat 15) due 2027. (→ [[regulations/sb253-ccdaa|SB 253]])
- **SB 261:** Applies if annual revenue exceeds $500,000,000. Climate-related financial risk is directly material to financial institutions — loan defaults from physical risk, stranded assets from transition risk. (→ [[regulations/sb261|SB 261]])
- **Insurance exclusion:** Entities regulated by the California Department of Insurance are **exempt from both SB 253 and SB 261**. This is a significant carve-out — pure California-regulated insurers are not covered. (→ [[regulations/sb253-ccdaa|SB 253 §96071]])

**EU:**
- **CSRD / ESRS E1:** Financial institutions with EU operations or listings meeting CSRD thresholds. The EU is further advanced on financed emissions disclosure — the European Banking Authority and ECB have issued supplementary climate risk guidance alongside CSRD. Cat 15 financed emissions are expected to be material for banks and asset managers under the double materiality assessment. (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])

## Typical Emission Sources

### Scope 1

Operational emissions are small relative to Cat 15. Most financial institutions have modest physical footprints.

| Source | Applicability | Notes |
|---|---|---|
| Natural gas — offices | Headquarters, branch network | HVAC and heating |
| Refrigerants (HFCs) | Office HVAC, data centers | Standard commercial building sources |
| Company vehicle fleet | Field appraisers, relationship managers | Minor for most; larger for insurance adjusters |
| Diesel — backup generators | Data centers, trading floors | Critical infrastructure backup power |

### Scope 2

| Source | Notes |
|---|---|
| Office electricity | Branch network, corporate offices |
| Data center electricity | Core banking systems, trading platforms — can be significant for large banks |

Use location-based method as primary; market-based if the institution holds RECs or PPAs. (→ [[methodologies/scope-2-location-based|Location-Based Method]])

### Scope 3

| Category | Applicability | Materiality |
|---|---|---|
| **Cat 15** — Financed emissions | Banks, insurers, asset managers | **Dominant — typically 95–99% of total GHG inventory** |
| **Cat 6** — Business travel | All institutions | Medium — significant air travel for deal teams, client meetings |
| **Cat 7** — Employee commuting | All institutions | Medium |
| **Cat 1** — Purchased goods & services | IT systems, office supplies, professional services | Low |
| **Cat 8** — Upstream leased assets | Leased office space | Low–medium |

**Cat 15 — Financed Emissions detail:**

This is the defining calculation challenge for financial services. Cat 15 covers the GHG emissions attributable to a financial institution's loans, investments, and underwriting activities. The **PCAF Global GHG Accounting and Reporting Standard** (Third Edition, December 2025) is the authoritative methodology. It is structured in three parts:

- **Part A — Financed Emissions** (loans and investments): covers Scope 3 Cat 15 for ten asset classes — listed equity & corporate bonds; business loans & unlisted equity; project finance; commercial real estate; mortgages; motor vehicle loans; use of proceeds structures; securitizations & structured products; sovereign debt; sub-sovereign debt.
- **Part B — Facilitated Emissions**: capital markets facilitation activity (underwriting, syndication).
- **Part C — Insurance-Associated Emissions**: re/insurance underwriting attribution.

**Core attribution formula (Part A, all corporate asset classes):**
```
Financed Emissions = (Outstanding amount ÷ EVIC) × Borrower/Investee total emissions
```
Where EVIC = Enterprise Value Including Cash (total equity + total debt). Attribution is proportional — if a bank holds 10% of a company's EVIC, it owns 10% of that company's emissions.

**Data quality scoring:** PCAF uses a 1–5 scoring system where 1 = verified reported emissions from the borrower and 5 = economy-wide EEIO proxy. Financial institutions must disclose both the emissions figure and the data quality score mix for each asset class. This is distinct from the GHG Protocol Scope 3 data quality tiers.

**Data challenge:** Most counterparties — especially private companies — do not publicly disclose GHG data. Score 3–5 proxies (physical activity intensity, revenue-based EEIO factors) fill the gap. Third-party data providers (Trucost/S&P, MSCI ESG, Bloomberg ESG, Sustainalytics, CDP) are the primary source for score 1–2 data on public companies.

(→ [[methodologies/scope-3-cat15-financed-emissions|Scope 3 Cat 15 — Financed Emissions (PCAF Method)]], [[organizations/pcaf|PCAF]])

## Recommended Methodologies

| Emission source | Recommended method | Data needed |
|---|---|---|
| Scope 1 natural gas | Fuel consumption × combustion factor | Utility bills |
| Scope 2 electricity | Location-based; market-based if RECs held | kWh bills by location |
| Listed equity & corporate bonds | PCAF Part A: (outstanding ÷ EVIC) × company emissions | Company Scope 1+2 disclosures; EVIC from Bloomberg/FactSet |
| Business loans & unlisted equity | PCAF Part A: (outstanding ÷ EVIC) × borrower emissions; EEIO proxy if no data | Borrower sustainability reports; revenue + sector intensity factors |
| Project finance | PCAF Part A: (loan ÷ total project equity+debt) × project emissions | Project-level Scope 1+2 data |
| Commercial real estate | PCAF Part A: (loan ÷ property value) × building emissions | Energy performance certificates; utility data; intensity proxies |
| Mortgages | PCAF Part A: (loan ÷ property value) × building emissions | EPC ratings; floor area × intensity factor |
| Motor vehicle loans | PCAF Part A: (loan ÷ vehicle value) × vehicle lifetime emissions | Vehicle type; fuel efficiency; mileage assumptions |
| Insurance underwriting (P&C) | PCAF Part C: premium share × insured asset emissions | Policy data; asset emission estimates |
| Scope 2 electricity | Location-based; market-based if RECs held | kWh bills by location |
| Cat 6 business travel | Distance-based using DEFRA factors | Flight and hotel records |

**PCAF Standard (Third Edition, December 2025):** The authoritative GHG Protocol-aligned methodology for Cat 15, now covering ten asset classes. Defines data quality scores 1–5 for each asset class. Referenced by SBTi's Financial Institutions framework, TCFD supplemental guidance, and CDP financial sector questionnaire. Note: First Edition (2020) was reviewed by GHG Protocol; Second and Third Edition additions have not been reviewed as the GHG Protocol closed its review service. (→ [[organizations/pcaf|PCAF]], [[methodologies/scope-3-cat15-financed-emissions|Cat 15 Methodology]])

## Filing Calendar

| Date | Obligation | Applies to |
|---|---|---|
| **2026-08-10** | First SB 253 Scope 1/2 disclosure | Revenue > $1B, doing business in CA (non-insurance) |
| **2026-09-10** | Annual SB 253/261 fee notice from CARB | All covered entities |
| **2027** (CARB schedule TBD) | First SB 253 Scope 3 disclosure (including Cat 15) | Revenue > $1B |
| **2026-01-01** | SB 261 first climate risk report | Revenue > $500M (enforcement suspended) |

| **FY2025 (reports due 2026)** | First CSRD / ESRS E1 disclosure | Large EU financial institutions with EU operations or listings |
| **FY2026 (reports due 2027)** | First CSRD / ESRS E1 disclosure | Listed SME financial operators |

**Insurance exemption reminder:** Pure California-regulated insurers are exempt from both SB 253 and SB 261 under Title 17 CCR §96071. Multi-line financial conglomerates with both banking and insurance operations should confirm which legal entities are covered.

## Sub-sectors

- **Commercial & Retail Banking** — loan portfolio (Cat 15b) dominates; branch network creates distributed Scope 1/2 footprint
- **Investment Banking** — Cat 15a from underwritten securities; relatively small physical footprint; high business travel (Cat 6)
- **Asset Management** — Cat 15a from managed portfolios; significant pressure from institutional clients and regulators on portfolio decarbonization disclosure
- **Insurance (Property & Casualty)** — Cat 15c from underwriting; also exposed to physical climate risk on the liability side (flood, wildfire, storm claims); California Department of Insurance exemption may apply
- **Insurance (Life & Health)** — Cat 15c; lower physical risk exposure than P&C
- **Pension Funds** — Cat 15a from equity and fixed income holdings; often subject to fiduciary duty arguments around climate risk integration

## Related

- [[concepts/scope-3-categories|Scope 3 Categories]] — Cat 15 is the defining category for this sector
- [[concepts/financed-emissions|Financed Emissions]] — concept page with attribution principle and EVIC explained
- [[concepts/co2-removals|CO2 Removals]] — attributed removals reported separately from gross financed emissions
- [[methodologies/scope-3-cat15-financed-emissions|Scope 3 Cat 15 — Financed Emissions (PCAF Method)]] — detailed calculation methodology
- [[organizations/pcaf|PCAF — Partnership for Carbon Accounting Financials]] — standard-setter for Cat 15
- [[sources/pcaf-financed-emissions-parta-2025|PCAF Financed Emissions Standard, 3rd Edition]]
- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[methodologies/scope-2-location-based|Scope 2 Location-Based Method]]
- [[regulations/sb253-ccdaa|California SB 253 — CCDAA]] — insurance exemption at §96071
- [[regulations/sb261|California SB 261 — Climate-Related Financial Risk Disclosure]] — highly material for this sector
- [[regulations/csrd|EU CSRD]] — EU mandatory sustainability reporting
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — GHG disclosure standard under CSRD; Cat 15 financed emissions expected to be material
- [[organizations/ghg-protocol-initiative|GHG Protocol Initiative]]
