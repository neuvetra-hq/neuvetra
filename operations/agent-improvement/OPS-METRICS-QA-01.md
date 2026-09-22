# OPS-METRICS-QA-01 independent review

Date: 2026-09-22. Reviewer: `/root/metrics_qa`, independent of implementation. Requested compute: gpt-6-astra/high, matching the QA registry. Observed runtime model/effort and resource usage: unknown; requested settings are not claimed as observations. Role prompt SHA256: `0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94`.

## Initial design disposition

The model-performance policy is suitable for bounded synthetic reasoning screening. Its three cases establish neither the five-comparable-assignment probation threshold nor general accounting/security competence. Independent review remains separate from candidate responses. No live calls, model-default changes, generated-code execution or production actions were performed by this reviewer.

Reviewer-only expectations are saved in `build-pilot-review-rubric.json`. They must remain outside candidate requests. Decimal lexical grammar and aggregation granularity are partially unspecified; a documented reasonable assumption is not by itself a defect. The required exact arithmetic, final four-place half-up rounding, explicit missing-data behavior and synthetic/unreleased scope remain binding.

Relevant context read: root AGENTS/CLAUDE instructions, operating model and QA role, corporate direction/roadmap, current main and improvement status, board report/continuation, improvement workflow/registry/lessons, feature metrics design, model-performance policy and fixtures. Main product notes contain dated M67 state; they are not treated as current worker observations or permission to change product work.

## Pending implementation gate

Verdict: **insufficient evidence, author handoff pending**. Initial tool inventory contained none of the four proposed tool/test files. No code pass is claimed. Required review covers deterministic QA/count/cost/timing results, unknown coverage, stale acceptance, append-only findings, duplicate settlements, durable aggregate cap including timeouts/retries/concurrency, and request/response schema plus secrets handling. L02/L03/L04/L06 guide exact-byte, cross-record and public-boundary checks.

Final handoff will record exact reviewed SHA256s, meaningful tests actually run, findings with preserved first dispositions, and residual limitations. Reviewer owns only this report and the rubric; author code remains read-only.

## First implementation review — failed

Independent Python boundary probes executed locally without network or credentials. Feature candidate SHA256: `9580f2a460b7094c15d28adfef47d4b489e6f115f73d7c805b0fd99c6f210840`. Runner candidate SHA256: `fb11a4cfcbae8f34256d268303111ed2c77ca045c4c856fccc41502d052896c5`. Author tests were still being prepared; no final gate is implied.

- **MET-F01, high:** `validate_feature_events` plus `build_scorecards` accepted a registry state of accepted with only a criterion pass and accepted event, no QA round. Result counted accepted with first review null. Require independent QA at the actual acceptance boundary.
- **MET-F02, high:** QA pass and criterion pass on v1 followed by accepted v2 produced accepted state with first-review pass. Require current artifact binding across QA, criteria and lifecycle; later edits cannot inherit acceptance.
- **MET-F03, high:** A later QA-disposition correction changed original fail to pass for the same round, and the scorecard reported first-review pass. The append-only raw stream existed, but derived metrics erased the original failure. Preserve first disposition/failure accounting and append explicit corrections.
- **PIL-F01, medium:** Two reserved requests settled using the same provider generation receipt both counted charges. A temporary ledger with two one-dollar reservations, repeated `receipt.response_id`, and 0.10-dollar settlements reported 0.20. Require uniqueness of provider generation across calls and retain unresolved duplicate reservation.
- **PIL-F02, medium:** A response with `content='not JSON'` and `finish_reason='length'` was returned as settled without invalid/truncated-output metadata. Known billing may settle independently; output usability must be tracked separately. Response/cost/model verification failures also discarded text needed for diagnosis. Separate validated candidate output, unusable output and unknown billing, retaining bounded untrusted evidence.

Findings sent directly to both implementation owners and coordinator. These first failures remain part of the record after repairs. No author code modified.

## Runner targeted re-review — pass, offline scope

PIL-F01 and PIL-F02 are resolved in the exact artifacts below. Duplicate generation IDs now retain the later request reservation as uncertain, and known billing settlement is distinct from unusable/truncated output. Untrusted output survives missing-cost diagnosis. Original failed disposition remains above.

| Artifact | SHA256 |
| --- | --- |
| `tools/build_model_pilot.py` | `8f28f99db4e369b8973b3bece0b699c042a0de68a8abf43bab064178e02724f3` |
| `tools/test_build_model_pilot.py` | `9a27e086057adfd2164d73f258db1228e84f7d9836c572c8f721ed35153eadbf` |
| `operations/agent-improvement/build-pilot-usage.md` | `0d8b50c3d12cbd2e30613aaf35570e80086ef444817d063463861fe9ef85741d` |

Executed independently: `python tools/test_build_model_pilot.py -v` passed all 10 tests; real CLI offline preflight reported 3 fixtures, 6 planned requests, 8,192 output tokens per request, no credential/network/ledger mutation. A separate two-process probe, beyond the author's two-thread test, raced two three-dollar reservations against one temporary ledger: exactly one succeeded, one refused, and reopened exposure was exactly three dollars. This exercises the OS lock and persisted boundary, not only the in-process mutex.

Independent plan arithmetic using the test catalog and real synthetic fixtures gave a six-request conservative reservation of `0.1166030388` USD; this is test-rate arithmetic, **not refreshed provider pricing or measured spend**. Both candidates receive the same 8,192-token ceiling. Fixture hash observed at preflight: `4cbf395a45c8f9b8bcaed2fcc446f4930a63121feffa83541b962fa766d7f94d`.

Limits: no live provider request or credential handling was exercised; external pricing/availability, actual billing and model quality remain unobserved. `reviewable` means nontruncated JSON-object text with basic response checks, not case-schema correctness or reviewer acceptance; substantive and expected-shape checks belong to independent rubric grading. Unknown reasoning/cache breakdown is not reconstructed. No staffing promotion or product assurance claim follows this offline pass. Feature-tool repair review remains pending separately.

## Feature second review — prior findings repaired; one new failure

Feature candidate `7dd07582be3c9750dadfa9ce77c8e62e9a5613ca5c0785f3e26969b74262faa0`; test candidate `9e0820e5daa4b85a76ac9b02cd0be056b6c216a538a908fc870405c67563b713`; usage documentation `d4df7ddea79b1fc2c4e1084a4b566fa26b1f95dadb46fa4980478a195646c2bf`.

All 19 author tests passed when run independently. The real migrated input CLI validation passed with 2 features, 16 events, no usage calls and 3 distinct joined run records at that observation. MET-F01/02/03 are repaired: prior passing applicable criteria and latest independent QA must match the accepted artifact; later artifact events cannot retain accepted state; unresolved high/critical findings block acceptance; QA/finding corrections cannot replace original history. Native run fields remain distinct from provider calls and unknown observations remain null.

**MET-F04, medium, new finding in the added native-run input boundary:** the scorecard CLI protected registry/event inputs against overwrite but omitted linked native run files. Independent temporary-root reproduction passed `--runs-dir <temporary>/runs --json-out <temporary>/runs/R1.json`; command returned 0 and replaced the native run record with a scorecard. No repository run record was modified. This contradicts the declared read-only input contract. The author was asked to protect both report outputs against all resolved linked native paths and add a targeted regression. Verdict on this candidate: **fail** solely for MET-F04; earlier failed rounds and resolved findings remain preserved.

## Feature third review — pass, bounded offline scope

MET-F04 is resolved. Independent probes tested **both** JSON and Markdown destinations pointing at a linked native run record: each returned 1 and preserved source bytes exactly. All 20 tests passed independently. No author code was changed by this reviewer.

| Artifact | SHA256 |
| --- | --- |
| `tools/feature_metrics.py` | `594bd35f185949b5083eb693feafa28c64895a191001824f5be0147b788a7ad3` |
| `tools/test_feature_metrics.py` | `a72a29e98326b7e6c7c63cf5759f90aae414b08c836cfba6ae9e8ee28267ada7` |
| `operations/agent-improvement/feature-metrics-usage.md` | `d4df7ddea79b1fc2c4e1084a4b566fa26b1f95dadb46fa4980478a195646c2bf` |

The real scorecard command was also exercised with migrated registry/events, actual linked native records and temporary JSON/Markdown output paths. It preserved zero measured provider calls, unknown dollar/model observations and first-review failures. Shared reviewer records appear as feature/run links (four links across two features, three distinct source records), without invented API calls or added cost. The original pre-independence stream and its migration snapshot were independently byte-compared and matched the recorded SHA256 `4e17b8e93b6d9a7ce54324ff196aafb679a5d6e07fd9fdb21a030b6eb07862d4`.

Final dispositions: MET-F01, MET-F02, MET-F03, MET-F04, PIL-F01 and PIL-F02 resolved for the exact accepted versions recorded here. Feature first and second review failures and runner first failure remain recorded. The overall review passes the bounded local tools and policy/fixture preparation; it does not establish a live paid comparison, model selection outcome, complete future dashboard/KPIs, deployed instrumentation or corporate-reporting readiness. Parent coordinator owns final event/status updates, publication and any approved credential-dependent evaluation.
