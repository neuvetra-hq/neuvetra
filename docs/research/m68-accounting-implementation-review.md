# M68 independent accounting implementation review

September 14, 2026 America/Los_Angeles; final local observation `2026-09-15T03:23:52Z`. Task M68-ACCOUNTING; independent domain reviewer sponsored by QA/root. **PASS for the bounded synthetic accounting implementation at the exact file hashes in the receipt.** No accounting defect was found in this review. This is not publication, hosted acceptance, source/method release, customer readiness or professional assurance.

## Independence and reviewed version

This execution authored the M68 accounting design/cases and the independent checker, but no product database, API, UI or renderer. The implementation was assessed against previously recorded expectations plus an independent integer arithmetic reconstruction. Existing author test assertion counts were not used as proof. Requested model/effort remains gpt-6-astra/high; actual observed model/effort and cost remain unknown. Role prompt SHA-256: `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`.

Reviewed current source includes the M68 contract, database reader, migration, report builder/template, API routes, frontend decoders and both UI components, alongside the M68 execution record, prior accounting contract and cases, author native test, and independent QA native/frontend expectations. The full 13-file hash map is in `evaluations/research-qa/m68-accounting-implementation-receipt.json`. Material pins:

| Artifact | SHA-256 |
| --- | --- |
| Migration 0014 | `81686f3c62f8130a60dbbc096ae758eb6d56ecd80df3d533621a1990ae33d425` |
| Database reader `m68.ts` | `dbfb55a42a2368b8a32a226c3e7c8127c4cfb39470c944110f3094e03401e026` |
| Report builder `m68-report.ts` | `56799a03434fcb546936cfd116d428bb5c9642250653ef433fe9408ddad8c08f` |
| Template module file | `378e485b0db60aa76f43987451087b069a589882a6fd50cf7b46108f5037e9cf` |
| Actual template string | `69bbb2738c0abf8893bb8636640408b41cd5cab4d91ec3b1ef6ead7013c13604` |
| Prior independent cases | `1bd58b8c6552ed7d47ab8480118612d3fbb51e7ab839619a2441ac83af0eb756` |

## Checks actually performed

Ran `bun evaluations/research-qa/m68-accounting-implementation-check.ts` against existing local `m68_author`, explicitly inside a PostgreSQL read-only transaction (`transaction_read_only=on`). The check made no database writes and did not touch QA's database. It passed on first execution; a second targeted execution added explicit persisted transition classification and also passed. No failed check has been replaced by a success claim.

- **126 persisted evidence versions:** independently reconstructed entered/missing-input, attached/single-document, missing-document, overlap and quantity-difference coverage; compared both persisted counts and the real backend coverage function. Every embedded annual snapshot exactly equals its selected original M67 row with review set to null.
- **992 entered monthly values:** reconstructed exact kg CO2e and half-even four-place display using integer milli-kWh, factor numerator `1950402888`, and denominator `10^13`. Recomputed all 126 annual totals by summing original monthly quantities once. Null rows retained null results. Factor `195.0402888` and development-candidate classification persisted. This introduces no new factor applicability claim.
- **All 13 independent M68 design vectors existed in native records**, including no links, matching A/B, overlapping matching/differing bills, explicit zero, missing January with February entered, twelve zeros, twelve 25,000 entries, the 301,000 kWh board vector and minimum inputs. Native records can include repeated prior author executions; counts describe inspected rows, not distinct scenarios or newly authored tests.
- **Original source support:** every linked source resolves to a retained source row, recomputed original-byte hash and approved A/B digest; printed quantity remains `12345.000 kWh`, page/month and January 1-31 period agree. Neither February statement date becomes February evidence. There were 26 source rows available; this is not a claim that each unrelated source row was newly validated.
- **Actual frontend decoder:** reconstructed complete company evidence/annual histories from persisted rows and passed them through `decodeAnnualElectricityEvidence`, including persisted evidence review records.
- **60 persisted reports:** rebuilt each with the actual M68 renderer and its captured source, actor/time/identity. Stored bytes, reported hash and actual template pin matched exactly. Checked coverage counts, exact emissions, unresolved-difference wording and qualifications in generated HTML. Reports covered no links, overlap, mismatch, explicit zero and missing January.
- **Observed successor records:** 34 source-only, 4 discrepancy-explanation-only and 56 annual-only transitions. Source changes preserve annual totals; explanation-only changes preserve discrepancy coverage. These classifications inspect committed histories; they do not themselves execute a save/retry or prove race behavior.
- **Nine additional pure boundary refusal probes:** repeated ID, repeated bytes with a different ID, February link, wrong page, absent confirmation, linking missing January, unexplained zero/nonzero mismatch, and non-null explanation for an equal quantity. These directly exercised product validation functions. They were not native SQL write/refusal tests.

## Accounting and presentation disposition

The SQL save function copies the exact M67 annual payload and derives coverage from accepted January links. It does not calculate emissions from PDFs, add bills, allocate dates, fill missing input, annualize or treat zero as documented consumption. Reader and frontend checks validate the composed source/annual/coverage tuple. The existing M67 engine remains the arithmetic authority; independently derived expectations agreed with the saved results.

One mismatching document correctly gives one attached month and one month with a single document while January remains in the quantity-difference list. Two distinct approved January documents give one attached month, zero single-document months and January overlap; quantity differences count the month once. Missing-document coverage remains a separate twelve-month list. UI/report text explains that these diagnostics overlap and must not be added, matching quantity is not verification, and an explanation or manager decision does not clear the discrepancy.

The report retains printed quantities, manual January quantity in its twelve-row table, discrepancy explanations, source identities/periods, exact/display totals, review state and method pins. It explains that the historical M67 manual/no-bill record and the additive M68 links are separate. Draft/synthetic/incomplete/unreleased/no-assurance qualifications and the one-facility 2023 CAMX/location-based boundary remain explicit. Manager acceptance is bounded internal use, not authentication, verified inputs, report-presentation approval or assurance. No additional professional-release gate is introduced for this synthetic milestone.

Lifecycle source inspection and observed histories agree with L06: source-only, explanation-only and annual-version-only changes remain material; correction-reason-only and canonical reordered equivalent links are no-ops. Source/report bytes and earlier decisions are read without retroactive mutation. L02 is addressed here by independent original/snapshot reconstruction and stored report byte comparison. Coordinated corruption/refusal, concurrency and restore remain independently challenged by the separate QA owner.

## Limits and handoff

This reviewer did not rerun the author's write suite or mutate a separate clone, execute cross-tenant/race/restore tests, inspect hosted M68 behavior, or independently view every rendered print page. Root's six-page normal print inspection is reported separately in `m68-print-layout-verification.json`; its long-note and native print-preview limitations remain explicit. HTML byte verification does not establish browser PDF bytes or print entry-point behavior.

Root/independent QA own final integrated acceptance, source/report temporal-history and tampering checks, restore, staged/committed hash equivalence, CI, deployment/restart and hosted demonstration. The initial author template-encoding defect and independent packaging finding remain preserved in the execution/QA record; this scoped pass does not relabel the overall milestone as first-pass success. Any later modification to a reviewed artifact requires a targeted recheck.

Deliverables: this review, the reproducible `m68-accounting-implementation-check.ts`, and its timestamped receipt. No product, migration, shared operational record, deployment or Git publication was changed by this accounting execution.
