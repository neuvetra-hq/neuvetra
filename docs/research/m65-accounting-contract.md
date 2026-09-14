# M65 accounting contract — exact-version synthetic worksheet report

September 14, 2026. Policy `m65-accounting-report-policy-v1`. Task M65-ACCOUNTING. Requested compute `gpt-6-astra/high`; actual inherited settings unknown. The reviewer authored the M64 accounting contract and expected cases, but no M64 product calculator or M65 renderer. This is a bounded report contract and subsequent independent implementation review, not professional assurance.

**Approved to implement the report semantics below.** The existing M64 calculation/input/factor policy is unchanged. Final M65 implementation, rendered print and hosted behavior still require independent acceptance. The governing scope is `docs/research/worksheet-report-milestone-65.md`, read together with `evaluations/research-qa/m65-plan-review.md`; its immutable-snapshot decision supersedes the older optional-projection discussion in `docs/research/m65-planning-review.md`.

## Required report text and fields

Use the title **Synthetic electricity worksheet report** and the adjacent status **Draft · Synthetic · Incomplete · Unreleased · No assurance**. Keep the same five qualifications visible on every printed page, including overflow pages. Do not title the artifact an annual inventory, verified emissions report, compliance filing or assurance statement.

The following table defines required information, with approved wording for potentially ambiguous claims. Equivalent plain wording may be reviewed, but must preserve the distinctions.

| Section | Required content |
| --- | --- |
| Report identity | Report ID; immutable capture/creation instant with explicit timezone; report/template version; content fingerprint with a precise statement of what it identifies. |
| Source identity | Tenant/company binding, fictional company and facility labels, exact worksheet version number/ID, input/result fingerprints, source save instant and creator reference. Source identifiers must come from the authorized snapshot, never an inferred latest version. |
| Boundary | `January 1–31, 2023`; `United States · California · CAMX`; `Operational control · Location-based Scope 2`; `Grid-delivered purchased electricity consumed by the reporting company`. |
| Input and conversion | Canonical source kWh at three decimal places, converted MWh at six decimal places; exact conversion `1 MWh = 1,000 kWh`. Label evidence `Synthetic manual entry — no bill evidence`. |
| Result | `January location-based subtotal`; server-verified four-place `kg CO2e`; separately labeled `Exact subtotal before display rounding`, preserving the exact decimal string. |
| Method | Fixed method ID/version and candidate factor ID/version, rate/unit, workbook/cell locator and source fingerprint. Show `An annual 2023 regional average factor is applied to January consumption. This is not a January-specific factor or a complete annual inventory.` |
| Rounding | `Display rounded once to four decimal places, half to even; no intermediate rounding. Decimal precision does not establish measurement certainty.` |
| Correction | Exact saved correction reason and predecessor/version reference where present; for the initial record, `Initial saved version — no correction`. Do not invent a reason or reinterpret a note as verified evidence. |
| Worksheet decision | Captured worksheet review state, described below; bind decision to its source version/result fingerprint. |
| Missing coverage | Explicitly identify February–December as outside this one-month worksheet, other facilities/sources as not assessed, market-based Scope 2 absent, and Scope 1/3 absent. Do not imply zero consumption for missing coverage. |

The complete limitations remain present in the report: fictional manual data without bill evidence; overall inventory incomplete; January 2023 CAMX only; market-based Scope 2 excluded; factor/method unreleased candidates; Scope 1/3 not assessed; no assurance or filing approval. A concise repeated footer may carry the five overall status words while the body carries all seven full limitations.

An immutable report cannot promise that its source remains the latest worksheet forever. Label source/capture time directly. The application wrapper may show that a source is historical, but must not rewrite earlier report content to add later events.

## Worksheet review is not report approval

The section heading is **Worksheet review captured for this report**. The snapshot has exactly one of the following meanings:

| Captured state | Approved wording and details |
| --- | --- |
| No decision at capture | `No worksheet review was recorded when this report was created.` Include source version/result binding and capture time. Do not imply later reviews are absent or invalid. |
| Bounded acceptance | `The worksheet version was accepted for bounded internal use.` Include reviewing manager reference, decision time, decision fingerprint and explicit reviewed source version/result. Preserve the acknowledged limitations. |
| Changes requested | `A manager requested changes to this worksheet version.` Include manager reference, decision time/fingerprint, reviewed source version/result and exact escaped decision note. No accepted/approved badge. |

In every state include: **This is a snapshot of a worksheet decision, not approval of this report presentation or assurance.** Board acceptance of the product milestone is not a worksheet review and cannot create a decision in the report. In particular, the board's M64 Version 4 acceptance record says its worksheet decision remained absent; use a fresh server snapshot rather than assuming that historical state still holds at a later report creation.

A later worksheet decision must not rewrite an earlier unreviewed report. A newly requested report can capture that later decision as a different immutable snapshot. A correction produces a different source version; it neither inherits prior worksheet approval nor changes a historical report. An explicitly requested older version is valid historical input; staleness means a mismatched source/hash/review binding, not merely age. Concurrent operations must capture one coherent committed source/review state, never a mixed snapshot.

No additional report-approval workflow, professional sealing, evidentiary archive or filing acceptance is authorized. Creation is a manager action; members may read authorized existing reports. CTO owns the specific identity, idempotency, transaction and authorization schema, consistent with these semantics and the independent plan review.

## Pinned numerical and primary-source authority

Reuse `m64-accounting-policy-v1`, accounting profile `manual-synthetic-2023-01-camx-kwh-v1`, method `scope2-location-based-egrid-subregion` / `2023-r2-camx-v1`, candidate factor `epa-egrid2023-r2-camx-total-output` / `eGRID2023-revision-2` and exactly `195.0402888 kg CO2e/MWh`.

- Source locator: EPA metric workbook `SRL23!AI6`, annual total-output CO2e rate; `A6=2023`, `B6=CAMX`, `C6=WECC California`. [Original EPA workbook](https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_metric_rev2.xlsx).
- Workbook SHA-256: `3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab`.
- Candidate SHA-256: `8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356`.
- GWP policy: AR5, 100 years, without climate-carbon feedbacks; CO2 1, CH4 28, N2O 265. Policy SHA-256: `fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5`. [EPA eGRID2023 Technical Guide, printed page 12, section 3.1.1.2/Table 3-1](https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf).

The reviewer independently opened the retained original workbook and checked its hash/cells earlier in this same September 14 session for M64. The reviewed normalization remains explicit: raw XLSX AI6 serialization is `195.04028880000001`, while the already approved candidate decimal remains `195.0402888`. M65 does not reimport, renormalize or release the source. Historical-year/subregion applicability and the guide's GWP passage were checked against EPA during that assignment; this report milestone asserts no new latest-edition/current-law finding.

The report renders verified existing numerical strings; it does not introduce another calculator. Do not rescale for days, annualize consumption, add losses/upstream emissions or replace AI6 with a sum of rounded gas columns. Component data need not be added to this total-only report. If shown, they remain inspection references under the unchanged M64 policy and must not widen scope.

## Independently verified report expectations

The companion `evaluations/research-qa/m65-accounting-cases.json` records independently computed expected quantities/totals plus review-state semantics. The public report fixtures are not a held-out evaluator corpus. They were derived with standalone Python Decimal and checked with integer rational arithmetic, without importing a product calculator.

| Report case | Canonical kWh | Canonical MWh | Exact kg CO2e | Display kg CO2e |
| --- | ---: | ---: | ---: | ---: |
| Board Version 4 quantity | 25000.000 | 25.000000 | 4876.00722 | 4876.0072 |
| Historical quantity example | 12346.000 | 12.346000 | 2407.9674055248 | 2407.9674 |
| Explicit zero | 0.000 | 0.000000 | 0 | 0.0000 |
| Minimum positive input | 0.001 | 0.000001 | 0.0001950402888 | 0.0002 |
| Half-even downward tie | 62500.000 | 62.500000 | 12190.01805 | 12190.0180 |
| Half-even upward tie | 187500.000 | 187.500000 | 36570.05415 | 36570.0542 |
| Fractional precision regression | 62499.999 | 62.499999 | 12190.0178549597112 | 12190.0179 |

The Version 4 label/value comes from root's observed board acceptance record; this accounting assignment has not read the live tenant record. Historical/zero/tie fixtures are synthetic report acceptance cases, not claims about which versions presently exist in the hosted database. Report creation must use the actual selected source snapshot.

## Content safety, print and acceptance evidence

Labels, reasons and review notes remain escaped data, including allowed `<`, `>`, `&` and quotation characters. No executable script, active remote resource or implicit evidence claim may be introduced through them. Normal primary-source hyperlinks are locators, not dynamically loaded factor authority. A report hash identifies precisely specified canonical report content/template and source/review snapshot; any self-hash exclusion or outer metadata is explicit in the CTO contract. Do not claim a browser print/PDF has the same byte hash as the HTML artifact. Browser layout/settings may differ.

Implementation accounting acceptance must compare source, report screen and actual rendered print numbers, exact values, qualifiers and review semantics for the cases above. Challenge absent review followed by later review, corrections followed by historical revisit, accepted versus changes-requested decisions, zero versus missing source, and long escaped labels/reasons/notes. Exact captured bytes must remain unchanged across later activity. A passing API or CSS source check alone does not establish rendered print acceptance.

This contract authorizes no product edits, factor/method changes, cloud mutation, Git operation or external communication by the accounting reviewer. Independent integrated QA retains the technical/security/browser gate. Customer use, factor release, annual completeness and professional assurance remain outside M65.
