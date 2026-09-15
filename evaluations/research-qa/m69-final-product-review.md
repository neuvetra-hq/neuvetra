# M69 final independent product review — first frozen candidate

**Verdict: FAIL for exact-question task fit and answer-level provenance. PASS for the bounded citation/qualification contract. INSUFFICIENT EVIDENCE for live model accuracy or live readiness.**

Reviewed 2026-09-15 UTC by `/root/m69_product`, task `M69-FINAL-PRODUCT`, sponsor QA. This execution context did not author the candidate, runtime, fixture, or tests under review. Requested GPT-6 Astra/high; observed model/effort and resource cost are unknown. This is internal product QA, not professional accounting, legal, or source-rights approval. Applied lessons L02 (exact artifact identity) and L04 (actual boundary and accurately labeled fixtures).

## Exact version and reproduction

| Artifact | SHA-256 |
| --- | --- |
| `docs/research/m69-live-candidate.json` | `4d691a46e74a6f7e88d920fb5ef77d59b8d64c36f53c1101c05e0c2fcb5cf280` |
| `.superpowers/m69-build/m69-canary.exe` | `c2ea124b7bbc93fb4d06168a0965b4d0de3ad5dceeba7a137d043858f51c0488` |
| `.superpowers/m69-rehearsal-final/closure.json` | `ed2e229e5d0e060aa0c14ba83177d32bab8dce2bd830ee879007ca867d58d8ff` |
| `.superpowers/m69-rehearsal-final/answer.json` | `9fa51b8c7cc6efdbc789d45b74d676be103125ce360c0ebc46d83990131ed513` |
| `evaluations/research-qa/m69-compiled-product.test.ts` | `3ec3eac0a1867afcda15958ef81b767f69005b68b29a607f9c60be3944577026` |
| `evaluations/research-qa/m69-compiled-rehearsal-fixture.json` | `2d7db383ee55fa399ce52b65508e10861d3e3c068b12d5016e6aa4b3e4e8b231` |

All listed bytes were independently hashed. All 36 candidate file pins matched the working files at inspection. Nine answer evidence objects exactly matched the released passage text, locator, and source ID. Candidate reservation is 3,946,085,000 nano-USD; this is an internal estimate, not a provider billing cap. The older preparation record's lower reservation is not this candidate's budget.

Executed `bun test evaluations/research-qa/m69-compiled-product.test.ts evaluations/research-qa/m69-independent-security.test.ts`: **8 passed, 0 failed, 66 assertions** on Bun 1.3.12. This reruns the actual composed runtime using injected responses; it does not execute a real provider. I inspected the existing compiled rehearsal rather than launching another executable rehearsal. Its closure records three injected transport invocations, zero provider requests, analyze/plan/verify, `qualified`, and controlled exit. Its 3,000,000 nano-USD settlement is fixture data, not incurred cost.

## Exact question and independent task-fit grading

> For a fictional office preparing its annual electricity draft, what records establish purchased electricity use, and how should their reporting period and units be documented?

Question hash: `3de94c518116a02e386d24e4b1e893c6ee3f3eed7ee75b40657e88e1cd1c199e`.

| Material need | Disposition | Evidence |
| --- | --- | --- |
| Identify purchased-electricity records | PASS | U04/S03 names utility bills and other purchase records and identifies electricity entering the facility, with incomplete submetering caveat. |
| Explain how those records' reporting period is documented | FAIL | U04 says purchased electricity during the reporting year, but does not resolve the documentation request. Fixture analysis replaces it with `source_date_recordkeeping`; U21 concerns factor edition, factor data period, calculation date, and inventory period. Those are not the billing/record period referred to by “their.” |
| Explain electricity units | PARTIAL | U06/S05 correctly identifies kWh and MWh. It does not prescribe a documentation format or validate actual units. A narrow explanation is supportable; no quantity conversion is demonstrated. |
| Stay proportionate and faithful | FAIL | U10/U17/U20/U21 dominate the six-claim answer with factor publication/update/uncertainty material that the question did not request. The scripted verifier's `faithful`, `task_fit`, and `proportionate` booleans are authored expectations, not independent semantic evidence. |

**F1 — material task substitution:** The test passes because it expects the same U21 mapping supplied by the fixture. It checks IDs, nonempty qualifications, and an approved source ID; it cannot establish that a different question has not been answered. Either preserve the original record-period question and explicitly withhold any unsupported documentation detail, or freeze a new question that genuinely asks for factor-source date recordkeeping. A new question is a changed candidate requiring new hashes and targeted review. Do not silently reinterpret this failed candidate as passed.

## Every rendered claim and its support

| Claim | Exact support location and dependency role | Grade |
| --- | --- | --- |
| U04 — annual purchased quantity, utility/purchase records, facility-entry versus internal submetering | S03, PDF page 7 / printed page 4 | Supported paraphrase. No claim that supplied bills were assessed or missing consumption estimated. |
| U06 — common kWh/MWh activity units | S05, PDF page 8 / printed page 5 | Supported. Explicitly excludes conversion and purchased steam/heat/cooling calculations. |
| U10 — eGRID/Factors Hub routes and possible update lag | S09, PDF page 9 / printed page 6; S06 page 8 / printed 5 and S07/S08 page 9 / printed 6 supply generation/geography boundaries | Supported with current-edition/value/selection caveats. Unrequested in this question. |
| U17 — factor represented period changes with generation mix/efficiency and purchasing choices | S16, PDF page 12 / printed page 9; S17 same page supports separate methodology/base-year treatment; S18 page 17 / printed 14 supports temporal uncertainty | Supported. Factor period is correctly distinguished from inventory period; no universal timing rule or historical recalculation is prescribed. |
| U20 — average factors vary by time/season and may mismatch purchase year | S18, PDF page 17 / printed page 14 | Supported, with no quantified uncertainty or current-factor certification. Unrequested here. |
| U21 — separately record publisher edition, factor period, calculation date, inventory period | S06–S09 and S16–S18 at the locations above; selected dependency units U10/U17/U20 present | Reasonable bounded interpretation, explicitly labeled `reviewed_interpretation` and “not an additional EPA filing rule.” Its support does not make it an answer to the records-period request. |

All six rendered claim texts retain their reviewed wording. All have claim-level evidence IDs and qualifications. All nine referenced excerpts resolve to the exact EPA December 2023 release (`38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f`). S16's repeated same-page locator is cosmetically redundant but resolvable, not a material support defect. Publisher title, edition, URL, and published-guidance status are retained. Source rights/freshness for live processing require the separate final source review; this local check does not refresh the original from EPA.

## Provenance and refusal boundaries

**F2 — false answer-level source mode:** The frozen answer says `retrieval.mode: cloud`, `store: Supabase`, and `search: Pinecone`, while its closure says `verified_local_original_and_extraction_no_cloud_retrieval` and the repository returns the locally loaded 18 passages. `build_id: local-pinned-corpus` and a truthful closure do not correct the contradictory fields in the answer a consumer reads. PASS for closure wording; FAIL for answer-level provenance. `answer_mode: cloud_reviewed_composition` is also potentially misleading in this provider-disabled artifact unless explicitly defined as an implementation mode. Review the actual serialized answer, not just launcher commentary, after repair.

The supported answer does not calculate, choose a current factor, authenticate records, file a report, determine California obligations, or assert whole-inventory completeness. PASS for those limits in the inspected answer. Invalid-cost and timeout tests exercise fail-closed runtime behavior; invalid-cost checks observe empty claims. They do not demonstrate semantic handling of new missing-context, out-of-scope, or adversarial questions. The compiled product suite contains no such semantic cases, and its policy test only checks direct routing/no fallback/no enabled plugins. Do not claim prompt-injection resistance or unseen live question accuracy from this fixture. The earlier P1–P5 product tests validate a static map, not service answers to P1–P5.

The runtime's local repository has no bill, saved worksheet version, annual report, customer-data store, or cloud-index retrieval connection. Existing application bill/version/report features cannot establish that this answer inspected them. Such integration and authorization remain unproved here.

## Remaining gates and next owner

Root/CTO owns F1 and F2 repair, a new frozen artifact, and targeted independent re-review. Preserve this first failure. Account preflight is reported blocked by the signed-out OpenRouter browser; this reviewer did not access an account, credential, or paid endpoint. Account balance/settings, real provider compatibility, live semantic accuracy, customer integration, and production readiness remain **INSUFFICIENT EVIDENCE**. No paid request or source release was authorized by this review. The supplied operational deadline remains `2026-09-15T23:20:32Z`; this report does not extend it.
