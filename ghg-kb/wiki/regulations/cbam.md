---
id: cbam
type: regulation
title: "EU Carbon Border Adjustment Mechanism (CBAM)"
aliases: ["CBAM", "Carbon Border Adjustment Mechanism", "EU CBAM", "Regulation 2023/956", "Regulation (EU) 2023/956"]
jurisdiction: EU
scope: [1, 2]
business_size: any
tags: [cbam, eu, carbon-leakage, eu-ets, imports, embedded-emissions, cement, steel, aluminium, fertilisers, hydrogen, electricity]
effective_date: 2023-10-01
last_updated: 2026-04-25
source_count: 1
references: [cbam-2023-956, eu-ets, operational-control-approach]
applies_to: [manufacturing, energy-utilities]
---

## Overview

The Carbon Border Adjustment Mechanism (CBAM) is the EU's anti-carbon-leakage instrument established by **Regulation (EU) 2023/956** of 10 May 2023, materially amended by **Regulation (EU) 2025/2083** of 8 October 2025. It applies an EU ETS-equivalent carbon price to the **embedded emissions** of selected goods imported into the EU customs territory, mirroring — and progressively replacing — the free allocation of EU Allowances to EU producers under Article 10a of Directive 2003/87/EC.

CBAM is structured as a **certificate surrender regime** parallel to EU ETS: importers (or their indirect customs representatives) registered as **Authorised CBAM Declarants** must annually declare the embedded emissions of covered imports and surrender CBAM certificates equal to those emissions, less (i) any carbon price effectively paid in the country of origin and (ii) the proportion of free allocation that the equivalent EU producer would still receive under EU ETS.

**Relationship to EU ETS:** CBAM does **not** replace EU ETS — it complements it. EU ETS continues to govern emissions from EU-based installations; CBAM levels the playing field for imports of the same goods. The two instruments share a verifier accreditation framework (Regulation (EC) 765/2008 / Implementing Regulation (EU) 2018/2067), aligned production-process system boundaries, and an identical excess-emissions penalty rate (→ [[regulations/eu-ets|EU ETS]]).

(→ [[sources/cbam-2023-956|CBAM Regulation (EU) 2023/956 — Consolidated Source]])

### Phased Application

| Phase | Period | Obligation |
|---|---|---|
| **Transitional** | 2023-10-01 → 2025-12-31 | Quarterly **CBAM reports** only (Articles 32-35); no certificate surrender; no payment |
| **Definitive** | from 2026-01-01 | Authorised CBAM declarant status mandatory (Articles 4-5, 17); annual CBAM declaration (Article 6); embedded-emissions verification (Article 8); CBAM certificate purchase (from 2027-02-01) and surrender (from 2027); free-allocation adjustment under Article 31 |

### Goods in Scope (Annex I)

| Sector | CN headings (illustrative) | Greenhouse gases |
|---|---|---|
| Cement | 2507 00 80 (calcined kaolinic clays), 2523 (clinker, Portland and other hydraulic cements) | CO₂ |
| Electricity | 2716 00 00 | CO₂ |
| Fertilisers | 2808 00 00 (nitric acid), 2814 (ammonia), 2834 21 00 (potassium nitrate), 3102, 3105 (excl. PK fertilisers 3105 60 00) | CO₂, N₂O |
| Iron and steel | Chapter 72 (excl. listed ferro-alloys and 7204 scrap), 2601 12 00 (agglomerated iron ores), 7301-7311, 7318, 7326 | CO₂ |
| Aluminium | 7601, 7603-7614, 7616 | CO₂, PFCs |
| Chemicals | 2804 10 00 (hydrogen) | CO₂ |

For goods listed in **Annex II** (most iron/steel, aluminium, and hydrogen items) only **direct emissions** are counted; indirect (electricity) emissions are excluded. For Annex I goods not listed in Annex II (cement, fertilisers, electricity), both direct and indirect emissions count.

### Geographic Exclusions (Annex III)

Goods originating in Iceland, Liechtenstein, Norway, Switzerland, and the territories of Büsingen, Heligoland, Livigno, Ceuta, and Melilla are out of scope. A conditional exemption is available for electricity from third countries with market-coupled electricity systems aligned with EU electricity, climate, and renewables law (Article 2(7)-(11)).

## Who Must Comply

### During Transitional Period (2023-10-01 → 2025-12-31)
The **importer** — or the indirect customs representative where the importer is not established in a Member State (or by mutual agreement) — must submit quarterly CBAM reports for any covered goods imported (Article 32).

### From the Definitive Period (2026-01-01)
- **Authorised CBAM Declarant status is mandatory** before importing Annex I goods (Article 4). Customs authorities will not allow importation by any other person.
- Importers established in a Member State apply for the status (Article 5(1)). Importers not established in a Member State must use an indirect customs representative who holds the status (Article 5(2)).
- Authorisation granted by the competent authority of the Member State of establishment after meeting Article 17(2) criteria: no serious customs/tax/market-abuse infringements in the prior 5 years, demonstrable financial/operational capacity, EU establishment, and an EORI number. A bank guarantee may be required for applicants with less than two financial years of operations (Article 17(5)).
- A **provisional importation right** applies for any importer/representative who applied by 2026-03-31 and is awaiting a decision (Article 17(7a)).

### De Minimis Exemption (Article 2a, from 2026-01-01)

An importer is exempt from CBAM obligations where the **total net mass** of Annex I goods imported in a calendar year does not exceed the **single mass-based threshold** of **50 tonnes** (Annex VII point 1). The threshold is aggregated across all Annex I CN codes per importer per calendar year.

- **Does NOT apply to electricity or hydrogen** (Article 2a(4)).
- The Commission reviews the threshold annually (by 30 April) to ensure ≥ 99% of embedded emissions remain in scope; amendments by delegated act if the recalculated threshold deviates by more than 15 tonnes.
- Once exceeded, the full year's emissions become subject to CBAM. Anti-circumvention rules treat artificial splitting to stay below the threshold as a **serious infringement** (Article 25a(4), Article 27(2)(b)).

### Operators in Third Countries
Operators of producing installations in third countries may **register voluntarily** with the Commission (Article 10), enabling them to disclose verified embedded-emission and carbon-price data directly to authorised CBAM declarants for use in their declarations.

## Reporting Requirements

### Transitional CBAM Report (Article 35)

Submitted to the Commission **no later than one month after the end of each quarter** (first report: Q4 2023, due 2024-01-31). Contents per Article 35(2):

| Field | Detail |
|---|---|
| Quantity of each type of goods | MWh for electricity; tonnes for other goods; per producing installation per country of origin |
| Actual total embedded emissions | tonnes CO₂e per MWh / per tonne of each type of goods, calculated per Annex IV |
| Total indirect emissions | calculated per implementing acts (Article 35(7)(e)) |
| Carbon price due in country of origin | accounting for any rebate or compensation |

Penalties for incomplete, incorrect, or non-submitted reports are imposed by the competent authority of the importer's Member State (Article 35(5)) and are **effective, proportionate, and dissuasive**.

### Definitive Annual CBAM Declaration (Article 6)

By **30 September** of each year, and **for the first time in 2027 for emissions in the year 2026**, each authorised CBAM declarant submits via the CBAM Registry:

| Item | Detail |
|---|---|
| Total quantity per goods type | imported in the preceding calendar year (incl. quantities under the de minimis threshold) |
| Total embedded emissions | per Annex IV; if based on **actual emissions**, verified per Article 8 + Annex VI |
| Total CBAM certificates to surrender | embedded emissions − Article 9 carbon-price reduction − Article 31 free-allocation adjustment |
| Verification reports | from accredited verifiers (where applicable) |

### Verification (Article 8, Annex VI)

Where embedded emissions are based on **actual emissions**, an **accredited verifier** must verify them with **reasonable assurance** that the report is free of material misstatement and material non-conformity with the Annex IV calculation rules. Verifiers are accredited by national accreditation bodies under **Regulation (EC) 765/2008** — the same framework as EU ETS. EU ETS verifiers accredited under Implementing Regulation (EU) 2018/2067 for the relevant activity group are recognised when applying for CBAM accreditation (Article 18(2)). Installation visits are mandatory unless waiver criteria in implementing acts are met (Annex VI point 1(c)).

### Recordkeeping (Articles 7(5)-(6), Annex V)

Authorised CBAM declarants retain records of imports, embedded-emissions calculations, verification reports, and (where claiming) third-country carbon-price documentation for **four years** after the year in which the CBAM declaration was or should have been submitted.

## Deadlines

| Date | Obligation | Source |
|---|---|---|
| **2023-10-01** | CBAM transitional period begins; first reporting obligations attach | Art. 32, 36(2) |
| **End of each quarter + 1 month** (transitional, first 2024-01-31) | Quarterly CBAM report due to Commission | Art. 35(1) |
| **2024-12-31** | Definitive-period authorisation framework provisions enter into force (Articles 5, 10, 14, 16, 17) | Art. 36(2)(a) |
| **2025-12-31** | End of transitional period | Art. 32 |
| **2026-01-01** | Definitive period begins: authorisation, declaration, verification, certificate, penalty regime applies (Articles 2(2), 2a, 4, 6-9, 10a, 15, 19, 21, 22(1), 22(3), 23-27, 31) | Art. 36(2)(b) |
| **2026-03-31** | Deadline for importers/representatives to apply for authorised CBAM declarant status to retain provisional import rights | Art. 17(7a) |
| **2027-01-01** | Quarterly CBAM-certificate balance obligation (≥ 50% of in-year embedded emissions) begins (Article 22(2)) | Art. 36(2)(c) |
| **2027-02-01** | Member States begin selling CBAM certificates on the common central platform (Article 20(1), (3)-(5)) | Art. 36(2)(d) |
| **2027-09-30** | First annual definitive **CBAM declaration** due (for calendar year 2026) | Art. 6(1) |
| **2027-09-30** | First annual **CBAM certificate surrender** (for 2026 emissions) | Art. 22(1) |
| **2027-10-31** | Annual deadline for authorised declarants to request repurchase of excess certificates | Art. 23(1) |
| **2027-11-01** | Cancellation of any CBAM certificates purchased in 2027 against 2026 emissions that remain unsurrendered | Art. 24(2) |
| **30 September annually thereafter** | Annual CBAM declaration + certificate surrender for the preceding calendar year | Art. 6(1), 22(1) |
| **End of each quarter from 2027 onward** | Account holding ≥ 50% of year-to-date embedded emissions | Art. 22(2) |
| **1 November annually** | Cancellation of certificates purchased in the year before the previous calendar year that remain unsurrendered | Art. 24(1) |
| **Before 2028-01-01, then biennially** | Commission reports to the European Parliament and Council on CBAM application | Art. 30(6) |

## Penalties

### Failure to surrender (authorised declarant) — Article 26(1)
Per missing CBAM certificate: **identical to the EU ETS excess-emissions penalty** of Article 16(3) Directive 2003/87/EC (€100 per tonne, inflation-indexed per Article 16(4) — i.e., the same EICP/HICP-adjusted amount that applies under EU ETS in the year of importation). **Payment of the penalty does not discharge the surrender obligation** (Article 26(3)).

Where the under-surrender results from incorrect third-party information (operator, verifier, independent carbon-price certifier), the competent authority **may reduce** the penalty considering duration, gravity, scope, intent, repetition, and cooperation (Article 26(1a)).

### Importation by non-authorised person — Article 26(2)
**3 to 5 times** the Article 26(1) penalty per missing CBAM certificate, scaled by duration, gravity, scope, intent, repetition, and cooperation.

### Exceeding de minimis without authorisation — Article 26(2a) (added by 2025/2083)
Article 26(2) penalties apply, but calculated on **the entirety of emissions embedded in the importer's full calendar-year imports**. Payment releases the importer from the surrender and declaration obligations for those imports. Reduced penalty (≥ Article 26(1) level) available where the threshold was exceeded by ≤ 10% or where Article 17(7a) provisional-import situations apply.

### Transitional-period reporting penalties — Article 35(5)
Member-State competent authorities impose effective, proportionate, dissuasive penalties for failure to submit, correct, or complete CBAM reports during the transitional period. Indicative ranges and criteria set by Commission implementing acts (Article 35(7)(b)).

### Circumvention — Article 27
The Commission monitors and investigates trade-pattern changes lacking due cause or economic justification — including slight modification of goods to escape Annex I CN codes and artificial splitting to stay under the de minimis threshold. Investigations conclude within 9 months and may trigger delegated acts amending Annex I.

### Public disclosure
Identical to EU ETS: non-compliance and penalty decisions are recorded in the CBAM Registry; final payments are registered there (Article 26(6)).

## Calculation Requirements

### What's "embedded"?
- **Direct emissions** (Article 3(21)): emissions from production processes, including from heating/cooling consumed during production, irrespective of the location of heating/cooling production.
- **Indirect emissions** (Article 3(34)): emissions from electricity consumed in production processes, irrespective of where the electricity was produced.
- For **Annex II goods** (most iron/steel, aluminium, hydrogen) only direct emissions count (Article 7(1)).
- For other Annex I goods (cement, fertilisers, electricity) both direct and indirect count.

### Two routes to determine embedded emissions (Article 7, Annex IV)

**Actual emissions (Annex IV pts 2-3):**
- Calculated from operator primary data using EU ETS-aligned production-process system boundaries (Article 7(7))
- For **simple goods** (no embedded-emission-bearing precursors): SEEₘ = AttrEmₘ / ALₘ where AttrEmₘ = DirEm + IndirEm
- For **complex goods**: extends the formula to add Σ (Mᵢ × SEEᵢ) for each Annex I precursor input from non-exempted countries, divided by the activity level
- Must be **verified by an accredited verifier** (Article 8) — installation visit mandatory unless waived

**Default values (Annex IV pt 4):**
- Set by Commission implementing acts based on best-available data
- For goods other than electricity (Annex IV 4.1): country-average emission intensity per goods type plus a Commission-set mark-up; if country data unreliable, average of the 10 highest-emission-intensity exporting countries with reliable data
- For electricity (Annex IV 4.2): country/region-specific CO₂ emission factor where available; otherwise the EU CO₂ emission factor; lower alternative permitted with reliable evidence
- Indirect-emission default values (Annex IV 4.3): average of EU grid factor, country-of-origin grid factor, or country-of-origin price-setting source factor — Commission to specify by implementing act (deadline 2025-06-30)

**Actual values for imported electricity (Annex IV pt 5)** require all of: a PPA between the declarant and a third-country producer; direct connection to the EU transmission system or no congestion; producer ≤ 550 g CO₂/kWh fossil; firmly nominated allocated interconnection capacity matched per ≤ 1-hour period; verifier certification with at least monthly interim reports.

### Article 9 carbon-price reduction
The number of CBAM certificates to surrender may be reduced for any **carbon price effectively paid in the country of origin**. Documentation must include a certification by an independent person and must be retained for 4 years. From 2027 the Commission may publish **default carbon prices** per third country. Where embedded emissions are determined by default values, only the default-carbon-price route is available (Article 9(4)).

### Article 31 free-allocation adjustment
The number of CBAM certificates to surrender is **adjusted downward** to reflect the proportion of EU ETS allowances still allocated for free under Article 10a of Directive 2003/87/EC to EU producers of the same goods. As EU ETS free allocation phases out for CBAM sectors over 2026-2034, the CBAM obligation phases in proportionately. Detailed rules in Commission implementing acts; benchmarks combine ETS product benchmarks for the goods concerned.

### CBAM certificate price (Article 21)
- Each CBAM certificate corresponds to **one tonne CO₂e** of embedded emissions (Article 3(24))
- Price = **weekly average of EU ETS allowance closing prices on the auction platform** (Delegated Regulation (EU) 2023/2830), published the first working day of the following week
- For embedded emissions in calendar year **2026** specifically, price = **quarterly average** of EU ETS closing prices for the quarter of importation (Article 21(1a))

### Quarterly balance obligation (Article 22(2), from 2027)
At each quarter-end, the declarant's CBAM Registry account must hold certificates corresponding to **≥ 50% of the year-to-date embedded emissions**, calculated by reference to either Annex IV default values (without the 4.1 mark-up) or the prior year's surrendered numbers for the same goods/origin. Excess certificates above the year's surrendered total are repurchased (Article 23) at the original purchase price; on 1 November of each year unused certificates from the year-before-previous are cancelled without compensation (Article 24).

### Operational boundary
CBAM obligations sit on the **importer/authorised CBAM declarant** in the EU. The producing installation operator in the third country is the data source (and may register voluntarily under Article 10), but is not the EU-side compliance actor. For the underlying production-side data the regulation aligns system boundaries with EU ETS, which uses the **operational control approach** (→ [[methodologies/operational-control-approach|Operational Control Approach]]).

## Related

- [[regulations/eu-ets|EU ETS]] — CBAM is the carbon-leakage instrument complementing EU ETS free allocation (Article 31); excess-emissions penalty rate, verifier accreditation framework, and production-process system boundaries are aligned
- [[methodologies/operational-control-approach|Operational Control Approach]] — underlying production-side data follows EU ETS-aligned system boundaries (Article 7(7))
- [[concepts/scope-1|Scope 1]] — direct embedded emissions of imported goods are Scope 1 of the producing installation; CBAM exposes EU importers to a price on those upstream Scope 1 emissions
- [[concepts/scope-2|Scope 2]] — indirect embedded emissions correspond to Scope 2 of the producing installation; relevant for cement, fertilisers, and electricity in CBAM
- [[sectors/manufacturing|Manufacturing & Industrial]] — primary sector affected (cement, iron and steel, aluminium, fertilisers, hydrogen producers and EU importers)
- [[sectors/energy-utilities|Energy & Utilities]] — electricity importers in scope; conditional country exemption for market-coupled grids
- [[organizations/eu-commission|European Commission]] — administers the CBAM Registry, sells certificates via the common central platform, sets default values and free-allocation adjustment rules
