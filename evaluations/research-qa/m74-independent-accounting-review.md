# M74 independent accounting review

## Scope, independence and current disposition

Reviewer `/root/m72_ops`, task `M74-INDEPENDENT-ACCOUNTING-REVIEW`, 2026-09-15. Requested critical `gpt-6-astra/high`; actual inherited model/effort unknown. Root reports fresh reviewer dispatch failed at the agent thread limit. This reused context authored M73 backend and hosted-helper code, **not** the M74 accounting contract, author fixtures or implementation. This is independent review of M74 with that prior-history disclosure; it is not professional accreditation or external assurance.

**Source/method disposition: acceptable for the expressly bounded synthetic development candidate. Implementation disposition: PENDING.** No M74 implementation output has been inspected or accepted at this first checkpoint. Rights, method release, real evidence sufficiency, inventory completeness and customer/legal applicability remain unresolved or excluded. The source-method disposition does not authorize runtime release.

Bound artifacts inspected:

- Accounting contract `docs/research/m74-accounting-contract.md`: SHA-256 `dd8cf96d3402197af373c009a90e8641a9449a1811a24bed30c8c5caddfcf372`.
- Author fixture file identity only: `51d88182ad1a2cfaf92569a687d2186eb4394b11d422190e6e3927612888661c`. Its numerical contents were not imported into the independent oracle.
- Technical and product contracts inspected for boundaries, not treated as primary scientific evidence.
- Independent expectations, frozen before implementation inspection: `m74-independent-accounting-expectations.json`, SHA-256 `1068fba315aa68d517bb29532a23d9c9e3ab1ddd47f8ee075aa609a23d42724b`.

## First source inspection — retained evidence and current primary guidance

Independently opened the retained XLSX ZIP/XML and styles, without application imports: `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-factors-hub-2025.xlsx`, 1,014,275 bytes, SHA-256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`. The sheet name is `Emission Factors Hub`; F3 identifies January 15, 2025. Current EPA Hub still links the 2025 edition; current online PDF text independently corroborates the displayed values. No current-remote XLSX byte identity is claimed. [EPA Hub](https://www.epa.gov/climateleadership/ghg-emission-factors-hub), [2025 factors PDF, tables 2, 4 and 11](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf).

| Independent locator check | Raw XLSX value | Displayed decimal / meaning |
| --- | --- | --- |
| C107/D107/E107, D103 heading | `10.210000000000001` | Diesel CO2: `10.21` kg/gallon; number format 43, two decimals |
| C255/D255/E256 | Shared strings | Medium- and Heavy-Duty Vehicles; Diesel; model years 2007–2022 |
| F248/F256 | `9.4999999999999998E-3` | `0.0095` g CH4/vehicle-mile; format 166, four decimals |
| G248/G256 | `4.3099999999999999E-2` | `0.0431` g N2O/vehicle-mile; format 166, four decimals |
| E523/E524:E526 | `1`, `28`, `265` | 100-year CO2/CH4/N2O GWPs; AR5 source note |

Normalization is accepted **for these identified cells**, based on displayed precision plus PDF corroboration. Binary storage tails are not additional factor precision. No general-purpose trimming rule is authorized. The neighboring 1960–2006 diesel row differs; 2007–2022 is vehicle model year, not inventory reporting year. Reject extrapolation to 2023+ models and other classes. The source covers combustion, not upstream fuel lifecycle emissions.

EPA's December 2023 mobile guidance distinguishes fuel-based CO2 from distance-based on-road CH4/N2O, describes stock reconciliation and losses when purchases proxy consumption, and prefers actual fuel and distance records. Refrigerants are outside this method. It warns that default volume factors and non-CO2 estimates carry uncertainty; exact arithmetic does not eliminate that uncertainty. Inventory completeness covers the chosen organization's sources, not merely a selected California trip segment. The contract's actual-distance-only, fossil-only, dedicated-vehicle, full-year, no-adjustment profile is narrower than the guidance; it must be labeled as a product restriction. [Mobile guidance, printed pp. 1–7 and 9–13](https://www.epa.gov/sites/default/files/2020-12/documents/mobileemissions.pdf).

The 2013 GHG Protocol amendment permits choosing an older IPCC assessment while recommending the most recent and requiring 100-year values and consistent reporting. AR5 is therefore a pinned candidate policy; this review does not call it latest or an SB 253 mandate. [Gases and GWP amendment, printed pp. 1–2](https://ghgprotocol.org/sites/default/files/2022-12/Required%20gases%20and%20GWP%20values_0.pdf).

## Independent arithmetic and admission expectations

The independent oracle uses Python `Fraction`, source-transcribed rational coefficients and integer quotient/remainder half-even rounding. A separate Decimal96 calculation cross-checks every result. It imports neither application code nor author fixtures. Eleven vectors, each with seven exact/component/display expectations, passed this internal cross-check. The stored source extraction includes XML text and formatting, so the factor-selection rationale is inspectable.

CO2 follows consumed U.S. gallons; CH4 and N2O follow vehicle-miles. Each gram factor is divided by 1,000 before kilogram gas mass is multiplied by GWP. There is no litre/imperial-gallon/kilometre conversion, fuel-economy inference, or HHV adjustment to this volume-factor profile. All components remain exact strings; only the final kg CO2e display is rounded to four decimals.

Two newly derived ties, distinct from the author's examples:

| Gallons | Miles | Exact kg CO2e | Four-decimal half-even |
| --- | --- | --- | --- |
| `2.125` | `12.800` | `21.84585` | `21.8458` |
| `2.125` | `11.200` | `21.82715` | `21.8272` |

Additional cases independently cover both minima, fuel-maximum/distance-minimum, the reverse asymmetric maximum, both maxima, an irregular positive pair, and independent fuel-only and distance-only successors. Computational extremes are stress cases, not plausible vehicle measurements.

Admission expectations are frozen alongside the vectors: either missing dimension prevents a numeric total; both zero needs two compatible zero statements plus confirmation and reason; mixed zero cannot yield a full numeric subtotal in this profile; unsupported class/year/fuel/units cannot be silently coerced; each positive evidence discrepancy needs its own persistent explanation. Full-year operational control, source/facility/vehicle linkage, both distinct evidence artifacts and all trip locations must remain bound. New document references or source UUIDs cannot evade the physical-vehicle/year reservation. Corrections reset review and never replace historical report bytes.

## Rights and release separation

Current EPA policy distinguishes noncommercial use and possible commercial restrictions, including document-specific terms. Current GHG Protocol terms also restrict commercial use. Neither policy is a source-specific legal clearance. Keeping `rights=unresolved_for_factor_release`, candidate status and `releaseEligible=false` is appropriate; obtaining a hash or accepting this numerical method does not grant redistribution rights. [EPA copyright status](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers), [GHG Protocol terms](https://ghgprotocol.org/terms-use).

## First findings and remaining implementation gate

No material factor-selection or arithmetic-policy defect identified at the source checkpoint. This first disposition must remain in the history if later implementation findings arise.

Clarification retained for integrated review: technical rules allow incomplete/mixed-zero workpapers with null calculation; unsupported strict profile values may be refused at validation. The product brief's broad phrase “calculation: null” must not be interpreted as permission to silently normalize unsupported classes, fuels or model years. The required invariant is no admitted numeric total and a visible unresolved source.

Pending exact frozen candidate review: Python and SQL source/method parity; all independent vectors through native storage/API/frontend; model-year/class/units; zero/missing and per-dimension evidence; coordinated evidence/factor/hash forgeries; immutable physical-vehicle reservations; single-field correction lineage; distinct review; actual report units, normalization, pins and exact bytes. Source approval alone is **not** implementation PASS. Actual hosted deployment and recovery are outside this reviewer assignment.

## Post-freeze author-fixture cross-check

After freezing independent expectations and the first source disposition, recalculated all eight author-provided numeric cases using the independently derived rational oracle. All 56 gas/component/exact/display values agree. This checks the contract examples without using them to generate the independent expectations. Implementation comparison remains pending.

## Final implementation disposition — 2026-09-15

**PASS for the bounded synthetic M74 accounting implementation identified below.** This supersedes the pending implementation disposition above while preserving its chronological source checkpoint. No material accounting implementation defect was found in the tested scope. This is neither overall milestone release approval nor source/factor release, legal applicability, real-customer evidence acceptance, complete Scope 1 coverage or external assurance.

The independent expectations were frozen before implementation inspection. Executed `bun test evaluations/research-qa/m74-independent-accounting-native.test.ts`: **2 tests passed, 0 failed, 254 assertions**, 30.48 seconds. Tests used actual Python authority, native PostgreSQL SQL/storage, actual workspace API and actual frontend decoder in a new local clone `m74_qa_accounting_064cd1e08b5b43048a31bcee27be87c4` of the read-only author baseline `m74_author_backend_20260915c`. The clone has a new synthetic company and local actors; authentication uses injected verified identities, not the hosted Auth provider. No original database, global role, hosted state or implementation file was changed.

Demonstrated outcomes:

- All 11 independent vectors matched all exact gas/component/subtotal/display expectations across Python, SQL, stored NUMERIC values, API and frontend decoding. This includes separate asymmetric maxima, simultaneous maxima, both minimum dimensions, both independently derived ties, and independent fuel-only versus mileage-only changes.
- Ten incomplete or contradictory cases persisted a null calculation, rendered no gas table or hidden partial subtotal, and refused acceptance with 422: missing dimensions, mixed zero, zero contradicted by positive statements, missing fuel evidence, absent mileage confirmation and missing per-dimension discrepancy explanations. Compatible supported zero calculated zero. Twelve unsupported profile/input cases refused with 422, including model-year limits, class, fossil-fuel policy, classification basis, units, numeric type/precision and period.
- Five single-field successors retained previous totals and history while resetting review. Both positive discrepancy explanations survived a separate reviewer decision and its exact report snapshot. A second source could not reuse the same physical vehicle/year; an old mileage reference remained reserved after a correction changed that reference.
- The original version export, both original statement downloads and original report download remained byte-exact. Reports exposed the separate fuel and mileage quantities, gas units, source locators, normalization rationale, AR5 GWP policy, half-even rounding, all-trip/interstate basis, candidate status and unresolved rights. Reports remained version-bound after correction.
- A coordinated arithmetic forgery that changed calculation content and related payload/hash/export/audit records was refused on authoritative read; the local test transaction rolled back and a subsequent valid read succeeded. The authority also refused method-policy forgery on replay, while independently reconstructed factor/GWP digests and source/engine pins matched. Supported boundary years 2007 and 2022 passed; 2006 and 2023 failed.

The Python calculation entry point is a deterministic numeric primitive; it is not the complete evidence-admission boundary. Null/mixed-zero/evidence rules are enforced before admission by the service and native SQL and were tested there. Calling that primitive alone does not establish an admissible corporate workpaper.

### Exact candidate identities

All SHA-256 values were rechecked after the successful tests.

| Artifact | SHA-256 |
| --- | --- |
| `packages/neuvetra-database/src/migrations/0017_mobile_diesel.sql` | `4486f83e2f2f6e5cb8db5991575a74f540b891eefd1ff65317801545c5b6c071` |
| `apps/site-api/src/calculation/m74_mobile_diesel.py` | `1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6` |
| `packages/neuvetra-database/src/m74.ts` | `494eb69227a8d18ac5068fcc5225daab1edbc88979fa3694f3f89981898bced9` |
| `packages/neuvetra-database/src/m74-contract.ts` | `96d2469c1b79d0f26e1908e5971fdf602c3b9881828d53e2752d7220a3d19207` |
| `apps/site-api/src/calculation/m74-authority.ts` | `c78867dbf1554605fc50eb9ec9555e768ed0af12ef1cbbeac49e8b60ed469c0b` |
| `packages/neuvetra-database/src/m74-validation.ts` | `53ee389bb6b554f5be8b6dc6487300377a589c293063c3d8a2fbfca9a6871412` |
| `packages/neuvetra-database/src/m74-report.ts` | `e0035c892ddc11367662c6d06cbdbac6b5cfaeffa4d8fc5bb393aefd33426579` |
| `apps/site-api/src/workspace/m74-routes.ts` | `e422393deb3b8d1bc9efde0a3db5e9892e3b2b77b5f34b0468eab9ccad6efe50` |

### Independent evidence identities

- Oracle `m74-independent-accounting-oracle.py`: `b0dfd69cf9482dea1022b2b1b9b6834ae45a45322813c891b244a822583b27e4`.
- Frozen expectations `m74-independent-accounting-expectations.json`: `1068fba315aa68d517bb29532a23d9c9e3ab1ddd47f8ee075aa609a23d42724b`.
- Executed test `m74-independent-accounting-native.test.ts`: `3a6a51a0b8e180094e9b22367c747e0f44f0cdef1ad9392ca4ba284eb24a1df4`.
- Latest retained receipt `m74-independent-accounting-native-m74_qa_accounting_064cd1e08b5b43048a31bcee27be87c4.json`: `8d2c80688b73bf80b62ee0fe78c9334ccf55a670e03f13166ac5e8052acc55a8`.
- Earlier passing 225-assertion receipt for `m74_qa_accounting_dbc9b0512b2e495b93fd5d753b7e9b80` remains preserved. The final test adds authority, discrepancy-review and coordinated-forgery challenges; it does not rewrite that earlier receipt.

## Independent acceptance of the frontend QA deliverable

**PASS for the submitted bounded frontend QA deliverable.** Inspected `evaluations/research-qa/m74-frontend-review.md`, SHA-256 `2184e715a69e529104cd0d3abf3f210c35fd05b0e215a60f6865a8f67783b921`, and `operations/agent-improvement/snapshots/M74-FRONTEND-REPAIRED1.json`, SHA-256 `2c500a95c4c0991e6d57f7d58f6f63c7df4a33b9cc39ec556100e1eafbba5483`. All eight snapshot entries matched both embedded content hashes and current on-disk files. This reviewer authored neither M74 UI nor these frontend tests. The submitting reviewer disclosed authorship of technical requirements, not UI implementation.

Independently reran the submitted four-file command: `bun test evaluations/research-qa/m74-frontend-ui.test.ts evaluations/research-qa/m74-frontend-decoder.test.ts evaluations/research-qa/m74-frontend-registration.test.ts evaluations/research-qa/m74-frontend-version.test.ts`. Result: **46 passed, 0 failed, 191 assertions**. The review preserves its six original findings and repair checks: historical selection versus latest review, demotion and stale owner controls, malformed binding identifiers, duplicate choices/findings, report timing relative to review, and duplicate report state/identifiers.

This acceptance covers the review artifact and its demonstrated component-handler/decoder checks, including actual Python output. It does not convert injected-hook tests into browser/DOM evidence, or accept hosted runtime, packaging, restart, migration/recovery or release gates. Root owns those remaining integration and demonstration responsibilities. No broad Scope 1, Scope 2, Scope 3 or SB 253 completeness claim follows from this bounded vehicle subtotal.
