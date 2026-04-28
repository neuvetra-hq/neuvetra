---
id: taxonomy-alignment
type: concept
title: "Taxonomy Alignment"
aliases: ["taxonomy-aligned", "Taxonomy alignment", "EU Taxonomy alignment", "environmentally sustainable activity", "Article 3 test"]
jurisdiction: EU
scope: [1, 2, 3]
tags: [eu-taxonomy, eu, alignment, sustainable-finance, article-3, dnsh, minimum-safeguards, technical-screening-criteria]
last_updated: 2026-04-25
source_count: 2
references: [eu-taxonomy-2020-852, eu-taxonomy-climate-delegated-act-2021-2139, eu-taxonomy, taxonomy-eligibility, six-environmental-objectives, dnsh-do-no-significant-harm, minimum-safeguards]
---

## Definition

An economic activity is **Taxonomy-aligned** — that is, qualifies as **environmentally sustainable** within the meaning of the EU Taxonomy Regulation (Regulation (EU) 2020/852) — if it satisfies **all four** conditions of **Article 3** simultaneously:

1. **Substantial contribution** — the activity contributes substantially to one or more of the six environmental objectives in Article 9, in accordance with the substantial-contribution criteria of Articles 10–16
2. **Do No Significant Harm (DNSH)** — the activity does not significantly harm any of the other five environmental objectives, in accordance with Article 17
3. **Minimum safeguards** — the activity is carried out in compliance with the minimum safeguards laid down in Article 18 (OECD Guidelines for Multinational Enterprises, UN Guiding Principles on Business and Human Rights, ILO fundamental conventions, International Bill of Human Rights)
4. **Technical screening criteria (TSCs)** — the activity complies with the activity-specific TSCs adopted by the Commission via Delegated Act under Articles 10(3), 11(3), 12(2), 13(2), 14(2) or 15(2)

Alignment is determined **at the level of the economic activity**, not at the level of the company. A given undertaking will typically have a mixed portfolio of aligned, non-aligned-but-eligible, and non-eligible activities.

(→ [[sources/eu-taxonomy-2020-852|EU Taxonomy Regulation 2020/852]])

## Why It Matters

Alignment is the *operative* status under the Regulation. It is what:
- A financial product must achieve (proportionally, across underlying investments) to be marketed as Article 9 SFDR ("dark green") under Article 5
- A non-financial undertaking discloses under Article 8 as the proportion of turnover, CapEx, and OpEx **aligned** (separately from the proportion **eligible**)
- Triggers the requirement under Article 6 that DNSH applies to the financial-product portion that takes Taxonomy criteria into account
- Defines "green" capital flow tracking for the EU Sustainable Finance regime — including the Green Bond Standard (Regulation (EU) 2023/2631), the Green Asset Ratio for credit institutions, and SFDR pre-contractual disclosures

Eligibility is necessary but not sufficient for alignment — see [[concepts/taxonomy-eligibility|Taxonomy Eligibility]].

## Key Distinctions

### The four-part test, in detail

| Leg | Article | What it requires | Where the detail lives |
|---|---|---|---|
| Substantial contribution | Articles 10–16 | Activity contributes substantially to at least one objective per the criteria specific to that objective; or qualifies as a transitional (Article 10(2)) or enabling (Article 16) activity | Climate Delegated Act (mitigation/adaptation), Environmental Delegated Act (other four) |
| DNSH | Article 17 | Activity does not significantly harm any of the other five objectives, considering life-cycle | Same Delegated Acts, in the per-activity DNSH criteria |
| Minimum safeguards | Article 18 | Procedures aligned with OECD MNE Guidelines, UNGPs, ILO core conventions, International Bill of Human Rights; SFDR DNSH principle (Article 2(17) SFDR) also applies | Article 18 itself + Platform on Sustainable Finance guidance |
| TSCs | Articles 10(3), 11(3), 12(2), 13(2), 14(2), 15(2) | Activity meets the activity-specific TSCs in the relevant Commission Delegated Act | Climate Delegated Act + Environmental Delegated Act |

All four must be met for the activity to be aligned. A failure on any single leg means the activity is non-aligned (even if it remains eligible).

### Three categories of contributing activity

Under the substantial-contribution leg, three activity categories may qualify:

- **Own-performance contribution** — activity itself meets substantial-contribution criteria
- **Transitional activity (Article 10(2)) — mitigation only** — activity for which there is no technologically and economically feasible low-carbon alternative, with GHG performance corresponding to the **best in sector**, that does not lock in carbon-intensive assets and does not hamper deployment of low-carbon alternatives
- **Enabling activity (Article 16)** — directly enables one or more substantial-contribution activities, without locking in assets that undermine long-term environmental goals and with substantial positive environmental impact on a life-cycle basis

The Article 8 KPI templates require enabling and transitional activity proportions to be reported separately from the overall aligned proportion (Article 5(2)).

### Solid fossil fuel exclusion

Article 19(3) categorically excludes solid fossil fuel power generation from qualifying as Taxonomy-aligned under any objective. This is the only Regulation-level activity exclusion; all other exclusions sit in the Delegated Acts.

### Alignment vs. eligibility

| | Eligibility | Alignment |
|---|---|---|
| Definition | Activity is on the published catalogue with TSCs defined | Activity is eligible **and** passes all four legs of Article 3 |
| Article 8 KPI | Proportion of turnover/CapEx/OpEx eligible | Proportion of turnover/CapEx/OpEx aligned |
| Scope question | "Has the Taxonomy defined criteria here?" | "Do we meet them?" |
| Required GHG calculation | None | Often yes (TSCs frequently set GHG-intensity thresholds for energy/transport/manufacturing) |

See [[concepts/taxonomy-eligibility|Taxonomy Eligibility]].

## Calculation Notes

Alignment determination is an activity-by-activity assessment, applied to the same set of activities used for eligibility KPI computation. Alignment KPIs are reported alongside eligibility KPIs per Commission Delegated Regulation (EU) 2021/2178 (the Article 8 Delegated Act):

> Alignment KPI = (turnover / CapEx / OpEx from aligned activities) ÷ (total turnover / CapEx / OpEx)

For activities where TSCs are GHG-intensity-based (common in energy generation, transport, manufacturing under the Climate Delegated Act), determining alignment requires:
1. Measuring the activity's emissions per relevant unit of output (per kWh, per passenger-km, per tonne of clinker, etc.) using the methodology referenced by the TSC
2. Comparing against the substantial-contribution threshold and any applicable DNSH thresholds
3. Documenting compliance with the activity-specific DNSH criteria for the other five objectives
4. Demonstrating compliance with the Article 18 minimum safeguards at the undertaking level

### Worked example — Solar PV electricity generation (Climate Delegated Act Annex I Section 4.1)

A 50 MW utility-scale solar photovoltaic installation seeking Taxonomy-aligned classification under climate change mitigation (→ [[sources/eu-taxonomy-climate-delegated-act-2021-2139|Climate Delegated Act 2021/2139]]):

1. **Eligibility** — Section 4.1 of Annex I covers "Electricity generation using solar photovoltaic technology" (NACE D35.11). The activity is on the catalogue → eligible.
2. **Substantial contribution** (Article 10 mitigation) — the substantial-contribution criterion in Section 4.1 is that the activity generates electricity using solar PV. Solar PV qualifies categorically subject to the universal **<100 g CO2e/kWh life-cycle GHG threshold** that applies across electricity-generation activities. Calculation: life-cycle GHG emissions per kWh produced, computed using **PEF Recommendation 2013/179/EU** (preferred) or **ISO 14067:2018** or **ISO 14064-1:2018**, with **independent third-party verification**. Modern silicon PV typically delivers ~20–50 g CO2e/kWh life-cycle, well under the 100 g threshold.
3. **DNSH** against the other five objectives — composes from generic Appendices plus the activity-specific overlay in Section 4.1:
   - (b) Adaptation — Appendix A climate-risk assessment performed.
   - (c) Water — Appendix B; PV uses negligible water in operation.
   - (d) Circular economy — components designed for high durability, recyclability, end-of-life recovery routes for PV modules per WEEE Directive.
   - (e) Pollution — Appendix C compliance on chemicals/substances used in module manufacture or maintenance.
   - (f) Biodiversity — Appendix D; for ground-mounted installations, EIA per Directive 2011/92/EU and any required Habitats Directive Article 6 appropriate assessment for Natura 2000 sites.
4. **Minimum safeguards** (Article 18) — the operator demonstrates OECD MNE, UNGP, ILO, and International Bill of Human Rights compliance at the undertaking level (not the activity level).
5. **TSC compliance** — confirmed by the third-party verification report and the DNSH evidence file.

If all five legs pass, the revenue, CapEx, and OpEx attributable to this installation enter the **aligned numerator** of the operator's Article 8 KPIs.

The corresponding contrast — what makes alignment *fail* even when eligibility and substantial contribution are met — is most often (i) Appendix A adaptation assessment skipped or insufficient, (ii) DNSH biodiversity failure for ground-mounted projects without proper EIA/Natura 2000 screening, or (iii) minimum-safeguards gaps at the undertaking level.

The specific GHG-measurement methodologies invoked by Climate Delegated Act TSCs — PEF, ISO 14067, ISO 14064-1, EU ETS verified emissions for product-benchmark-derived thresholds in cement/steel/aluminium/chemicals, and the EU CO2 fleet standards for vehicles — are detailed on the [[sources/eu-taxonomy-climate-delegated-act-2021-2139|Climate Delegated Act source page]] and the parent [[regulations/eu-taxonomy|EU Taxonomy Regulation]] page.

## Regulatory References

- **Regulation (EU) 2020/852, Article 3** — the four-part test that defines alignment
- **Regulation (EU) 2020/852, Articles 10–16** — substantial-contribution criteria per objective + enabling-activity rule
- **Regulation (EU) 2020/852, Article 17** — DNSH triggers per objective
- **Regulation (EU) 2020/852, Article 18** — minimum safeguards
- **Regulation (EU) 2020/852, Article 19** — cross-cutting requirements for TSCs and the solid fossil fuel exclusion
- **Regulation (EU) 2020/852, Article 8** — surfaces alignment KPIs in non-financial reports
- **Commission Delegated Regulation (EU) 2021/2139 (Climate Delegated Act)** — TSCs for objectives (a) mitigation and (b) adaptation, including DNSH criteria
- **Commission Delegated Regulation (EU) 2023/2486 (Environmental Delegated Act)** — TSCs for objectives (c)–(f)
- **Commission Delegated Regulation (EU) 2021/2178 (Article 8 Delegated Act)** — KPI templates and methodology

## Related

- [[concepts/taxonomy-eligibility|Taxonomy Eligibility]] — the necessary precursor to alignment
- [[concepts/six-environmental-objectives|Six Environmental Objectives]] — the catalogue against which substantial contribution and DNSH are assessed
- [[concepts/dnsh-do-no-significant-harm|Do No Significant Harm (DNSH)]] — second-leg test
- [[concepts/minimum-safeguards|Minimum Safeguards]] — third-leg test
- [[regulations/eu-taxonomy|EU Taxonomy Regulation]] — parent regulation
- [[regulations/csrd|CSRD]] — disclosure framework into which Article 8 alignment KPIs feed
- [[regulations/esrs-e1|ESRS E1 — Climate Change]] — sits alongside Taxonomy alignment KPIs in the CSRD environmental information block
- [[regulations/eu-ets|EU ETS]] — Climate Delegated Act TSCs reference EU ETS benchmarks for "best-in-sector" performance in some transitional activities
