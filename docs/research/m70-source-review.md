# M70 primary-source review and coverage handoff

**Candidate for independent review.** Observed September 14, 2026 in America/Los_Angeles (retrieval session September 15 UTC). Task M70-RESEARCH; executor `/root/m70_research`; requested registry critical GPT-6 Astra/high; actual model/effort unknown. Author review is not independent QA. Root owns publication and shared operations records.

## Deliverable and use

[m70-requirements-matrix.json](m70-requirements-matrix.json) contains 35 bounded research rows: 11 California/program rows, nine GHG Protocol rows and 15 category-screening rows. Every row provides primary locators, edition/status, observed/effective/data/reporting dates or explicit unknowns, needed company facts, proposed behavior, release gaps and a proposed test case. These are design inputs, not implemented eligibility rules, exhaustive legal coverage, approved sources/factors or evidence of a complete company inventory.

M70-CA-01 through M70-CA-11 distinguish law, implementation, discretion and a separate financial-risk program. M70-GHGP-01 through M70-GHGP-09 describe the initial accounting boundary. M70-S3-01 through M70-S3-15 reference the shared coverage rule M70-GHGP-05. The wholly owned California/Nevada operational-control example is a synthetic design choice; a real customer's consolidation policy needs evidence and review.

## Consequential findings

- **No effective initial-regulation deadline established here.** CARB's freshly downloaded [rulemaking index](https://ww2.arb.ca.gov/rulemaking/2025/california-corporate-greenhouse-gas-reporting-and-climate-related-financial-risk) still says the OAL stage has not been reached and the package was withdrawn. The [July notice](https://ww2.arb.ca.gov/sites/default/files/barcu/regact/2026/sb%20253-261/15_day_notice%20253-261.pdf), p1, records May20 submission and June23 withdrawal. Its pp4-5 discuss proposed modifications. An old page-review label and a link titled Final Regulation Order do not establish effectiveness.
- The [September1 guidance](https://ww2.arb.ca.gov/sites/default/files/2026-09/2026_SB253_Reporting_Guidance.pdf), pp1-4, conditions the regulation on OAL approval while discussing November10 reporting. It separates first-year discretion from statutory interpretation and later cycles. Do not turn its acceptance of unassured first-cycle submissions into a permanent assurance exemption. The public [intake information page](https://ww2.arb.ca.gov/our-work/programs/corporate-ghg-reporting/corporate-disclosure-climate-data) also mixes an announced November10 date with proposed-rule language and an outdated promise of September guidance. No submission platform was exercised.
- The [Scope2 corrections PDF](https://ghgprotocol.org/sites/default/files/2023-03/List%20of%20Corrections%20to%20the%20Scope%202%20Guidance.pdf), pp1-2, includes April2025, although its [publication page](https://ghgprotocol.org/scope-2-guidance) labels the link December2022. Use document-level correction dates. The [Scope3 corrections](https://ghgprotocol.org/sites/default/files/2022-12/List%20of%20Corrections%20for%20Scope%203%20Standard.pdf) separately affect an electricity example and threshold terminology; do not assume printed and electronic editions agree.
- Current publication pages link the [Corporate Standard](https://ghgprotocol.org/corporate-standard), [Scope2 Guidance](https://ghgprotocol.org/scope-2-guidance) and [Scope3 Standard](https://ghgprotocol.org/corporate-value-chain-scope-3-standard). Their baseline editions remain distinct from the [corporate-suite development process](https://ghgprotocol.org/ghg-protocol-corporate-suite-standards-and-guidance-update-process). The separately published [LSR v1.1 page](https://ghgprotocol.org/land-sector-and-removals-standard) states January1,2027 effectiveness; detailed land, biogenic and removals applicability is not reviewed by this increment.

## Access, provenance and limits

Legislative current text and both amendment texts were freshly inspected through the web reader. GHG Protocol publication pages and relevant PDF passages/corrections were inspected through that reader. CARB returned JavaScript challenges there; initial direct retrieval was blocked by the network sandbox. Read-only network escalation allowed public downloads. A missing default Python PDF dependency and then console encoding errors were repaired using the bundled runtime and UTF-8; no source result was inferred from failed extraction.

CARB PDF text was read with the bundled PDF tools; the proposed fiscal-selection/redline page8 was also rendered and visually inspected. No full-document visual QA, clean codification, detailed factor-method validation or legal opinion is claimed. GHG document upload-directory dates are not edition dates. PDF locators in the matrix are printed page numbers unless otherwise stated.

Fresh CARB bytes remain in the operating-system temporary directory for this review; they are not committed raw-source releases. Exact URLs are in the matrix except the intake page linked above. SHA-256 fingerprints:

| Temporary filename | Bytes | SHA-256 |
| --- | ---: | --- |
| m70-guidance.pdf | 397432 | aabd1093859088497fb2f095e22ae86f5b8facb43ab86642805c2e1d04d4518e |
| m70-index | 54050 | 5346dba5cde1117a9ffd9caf31fe859fc145beb8ff10525e9d0c95f9a1bfdf92 |
| m70-notice | 249425 | 22033b191fa5d94b8b98879c529d3707ff1e72a6b4cc09bfb221667d62fbe3e9 |
| m70-enforcement | 109749 | 291e2e01e91f8e4741ea355e4f4d7e0fbe6a233252a803d8064ad56c2dc7cdc3 |
| m70-sb261 | 59561 | e4c7d6281fc8bafcb9b2a8f0c84edaaad849269d2b0f719e41b085a3fa858a8a |
| m70-intake | 54642 | 9e76b40f7fccd4c3fe518a07a0660fc14cd3655127d0a4ef139b5af96d777d1d |
| m70-text.pdf | 246741 | 53dc47221126f059a52177faa6496ffd2390a4633b4d7a4cbc3a9d4cdf68f47f |

The court search did not obtain a complete authenticated current Ninth Circuit docket. Case-number-only results from other circuits were rejected. The freshly retrieved [SB261 advisory](https://ww2.arb.ca.gov/sites/default/files/2025-12/Dec%201%20SB%20261%20Enforcement%20Advisory.pdf) is evidence of CARB's stated response to the historical injunction, not proof that no subsequent court action exists. A current SB253 injunction or definitive absence of one is not established by this review. Current court status remains a gate before consequential filing advice.

The requested inherited `docs/research/scope12-coverage-matrix.md` is absent from this worktree; filename search found no replacement. Earlier California/Protocol research was used as discovery context only. Referenced tax definitions, all proposed exclusions, assurance standards, later fee administration and detailed 2027 reporting concepts are deliberately unresolved; these omissions prevent exhaustive-coverage claims.

## Runtime boundary and verification

Local inspection confirmed the 97 source-catalog records all remain `runtime_approval: not_evaluated`; catalog SHA-256 is `5417de55cd9c8bb82ff924b554cf305569b96eab164ba74f7afe3e5bee9318e8`. The local website release contains18 passages and hashes to `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f`; its authored catalog contains24 units and hashes to `97b2c4e0f4121c1d2ea7fa33d569f53344193f12a80e9d1349577c3a86e17e50`. These match the dated [M69 source handoff](m69-source-readiness.md). This task did not validate cloud freshness, renew the existing September15 operational review deadline, make paid calls, release sources or change factors.

JSON parsing, unique IDs, all15 category numbers and explicit unexecuted-test labels passed. No proposed product test was run and no numerical accounting capability was established. Independent QA should challenge exact locators, authority/modality, dates, source contradictions and each completeness refusal. Root/CPO should bind accepted research rows to implementation acceptance; qualified legal/accounting reviewers and the independent assurance provider own consequential judgments. The applicable L02 lesson is semantic lineage and exact reviewed-byte verification; root must bind the accepted snapshot and staged/committed bytes at publication.

