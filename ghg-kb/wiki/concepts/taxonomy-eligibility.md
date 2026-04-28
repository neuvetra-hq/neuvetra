---
id: taxonomy-eligibility
type: concept
title: "Taxonomy Eligibility"
aliases: ["taxonomy-eligible", "eligible activity", "Taxonomy eligibility", "EU Taxonomy eligibility"]
jurisdiction: EU
scope: [1, 2, 3]
tags: [eu-taxonomy, eu, eligibility, sustainable-finance, article-8, kpi]
last_updated: 2026-04-25
source_count: 1
references: [eu-taxonomy-2020-852, eu-taxonomy, taxonomy-alignment, six-environmental-objectives]
---

## Definition

An economic activity is **Taxonomy-eligible** if it appears in one of the activity catalogues set out in a Commission Delegated Act adopted under the EU Taxonomy Regulation (Regulation (EU) 2020/852) — i.e., if there exists a defined activity description and corresponding **technical screening criteria (TSCs)** for that activity in the Climate Delegated Act, the Environmental Delegated Act, or any future sector- or objective-extending Delegated Act.

Eligibility is a **scope question**: it asks whether the Taxonomy framework has yet defined criteria for an activity, not whether the activity actually meets them. An activity can be eligible without being [[concepts/taxonomy-alignment|aligned]]. An activity that is *not* eligible cannot, by definition, be aligned — the Regulation has nothing to say about it.

(→ [[sources/eu-taxonomy-2020-852|EU Taxonomy Regulation 2020/852]])

## Why It Matters

Eligibility is the **first-pass disclosure metric** under Article 8 of the Taxonomy Regulation. In the early years of Article 8 reporting (FY 2021–FY 2022), undertakings were required to disclose **eligibility KPIs only** — the proportion of turnover, CapEx, and OpEx associated with eligible activities — before being required to also disclose **alignment KPIs**. This phase-in reflects two practical realities:

1. The Climate Delegated Act (covering mitigation + adaptation) was adopted before the Environmental Delegated Act (covering the four other objectives), so eligibility for the latter was undefined until the second Act took effect from 2023-01-01.
2. Determining eligibility is materially simpler than determining alignment — an internal classification of revenue and capex against a published activity catalogue, versus a four-part legal/technical assessment per activity.

Eligibility therefore functions as the floor: it sets an upper bound on alignment (you cannot be more aligned than you are eligible), and it indicates the proportion of an undertaking's economic footprint that the Taxonomy framework even reaches.

## Key Distinctions

### Eligibility vs. alignment

- **Eligible** = the activity is on the published list (a Delegated Act covers it with an activity code and TSCs)
- **Aligned** = the activity is eligible **and** passes the four-part Article 3 test: substantial contribution, DNSH, minimum safeguards, compliance with the activity-specific TSCs

An eligible-but-not-aligned activity is one for which the Taxonomy has criteria, but the undertaking's specific implementation fails one or more legs of the test (e.g., emission intensity above the substantial-contribution threshold; or DNSH failure on biodiversity; or minimum-safeguards gaps).

### Eligibility population

The set of eligible activities is determined by the activity catalogues in the Delegated Acts:
- The **Climate Delegated Act (Commission Delegated Regulation (EU) 2021/2139)** lists eligible activities for objectives (a) climate change mitigation and (b) climate change adaptation
- The **Environmental Delegated Act (Commission Delegated Regulation (EU) 2023/2486)** lists eligible activities for objectives (c) water/marine, (d) circular economy, (e) pollution, (f) biodiversity
- Activities outside these catalogues are simply **non-eligible** (not "non-aligned") — they sit outside the Taxonomy's universe entirely

### Sector and KPI templates

The **Article 8 Delegated Act (Commission Delegated Regulation (EU) 2021/2178)** sets the templates that translate eligibility (and alignment) into reported KPIs. For non-financial undertakings, eligibility is reported as the proportion of turnover, CapEx, and OpEx that derives from or relates to eligible activities. For financial institutions, sector-specific templates apply (e.g., the Green Asset Ratio for credit institutions).

## Calculation Notes

Eligibility KPIs are computed as proportions, with numerator/denominator definitions in the Article 8 Delegated Act:

> Eligibility KPI = (turnover / CapEx / OpEx from eligible activities) ÷ (total turnover / CapEx / OpEx)

Determination of eligibility for a given revenue stream or asset typically requires:
1. Mapping the undertaking's NACE-coded activities (or asset/process descriptions) against the activity descriptions in the relevant Delegated Act
2. Allocating revenue, CapEx, and OpEx to those activity codes consistent with the undertaking's financial-statement consolidation perimeter

Eligibility is not a GHG calculation — it does not require emission factors or measurement of Scope 1/2/3 emissions. The GHG-related calculation work enters at the **alignment** stage, where TSCs may include emission-intensity thresholds.

## Regulatory References

- **Regulation (EU) 2020/852, Article 8** — disclosure trigger that surfaces eligibility KPIs (and, eventually, alignment KPIs) in non-financial reports
- **Commission Delegated Regulation (EU) 2021/2178 (Article 8 Delegated Act)** — KPI calculation methodology and templates
- **Commission Delegated Regulation (EU) 2021/2139 (Climate Delegated Act)** — defines eligible activities for objectives (a) mitigation and (b) adaptation
- **Commission Delegated Regulation (EU) 2023/2486 (Environmental Delegated Act)** — defines eligible activities for objectives (c)–(f)
- **CSRD (Directive (EU) 2022/2464)** — broadens the population of undertakings subject to Article 8 Taxonomy disclosures via amendments to the Accounting Directive

## Related

- [[concepts/taxonomy-alignment|Taxonomy Alignment]] — the four-part test that an eligible activity must additionally pass
- [[regulations/eu-taxonomy|EU Taxonomy Regulation]] — parent regulation
- [[concepts/six-environmental-objectives|Six Environmental Objectives]] — the structure that organises the eligible-activity catalogues
- [[concepts/dnsh-do-no-significant-harm|Do No Significant Harm]] — second-leg test for alignment
- [[concepts/minimum-safeguards|Minimum Safeguards]] — third-leg test for alignment
- [[regulations/csrd|CSRD]] — disclosure framework into which Article 8 KPIs feed
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — sits alongside Taxonomy KPIs in the CSRD environmental information block
