# Scope 2 compound-question feedback — independent QA

**Scoped pass for the final board-feedback correction.** Source review, final offline checks and the ten-case targeted live recheck pass. Run 03's earlier 18/20 result remains a recorded failure; the full twenty-question live suite was not repeated on final code. This does not widen the pilot to legal applicability, numerical calculations or commercial/production use. Reviewer `independent QA /root/site_review` did not author the evidence or implementation; this reviewer owns this report and the new feedback fixtures. No real provider or production calls were made by this reviewer.

## Defect and acceptance

The board asked: “What is the difference between the location-based and market-based calculation methods, and why must companies report both?” The observed response was unsupported. Independent offline reproduction showed that the old router requested only the two method topics and retrieved P01/P02. It omitted approved P03, and the release did not contain an explicit practical reporting rationale. This establishes the coverage gap; it does not establish the model's private reason for abstaining.

The fix must explain both methods, state EPA's reporting recommendation, and explain the practical value of retaining both perspectives while correcting the assumed universal duty. A comparison alone cannot count as a complete answer to this compound question. “Calculation methods” is a conceptual phrase here; a request to compute a result, file a report or decide company/global legal duties remains outside coverage.

## Exact evidence disposition

| Artifact | SHA-256 |
| --- | --- |
| [Reviewed v2 candidate](../../data/research/releases/scope2-pilot.v2.json), before approval metadata | `0cd75fe4933f94481e9abeddea22b8061d4992dff3b81ccd481826d8bf7c4fc6` |
| Approved v2, UTF-8 LF | `5e735bba3c029f2c41c94edb12fd57ff13c4859047446be520fc3a81533b8d99` |
| [Feedback fixtures](../../evaluations/research-qa/scope2-pilot-feedback-fixtures.json), UTF-8 LF | `c64abdac6bdf4d1b761bc79325fe2498920d124ec695c860852ac2d9b73e9d06` |
| Preserved [v1 release](../../data/research/releases/scope2-pilot.v1.json) | `c926e527ebb276aad1f279f950cb87f997557f86b3e993ba65957de9bb51ed0f` |

The candidate hash is historical provenance, not the current linked file's bytes. All eight source records and thirteen evidence records equal v1 exactly. Existing proposition text, evidence references and qualifications are unchanged; P03 moves to topic `dual_reporting`. P04 remains `scope2_general` and cannot substitute for reporting coverage. New P05 has topic `reporting_rationale`.

The reviewer rehashed the original [EPA electricity guidance](https://www.epa.gov/sites/default/files/2020-12/documents/electricityemissions.pdf), December 2023: `14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3`. PDF pages 4 and 9 were reread in full for P05. E01 identifies PDF p4/printed p1, third body paragraph, which describes grid-average and contractual approaches. E03 identifies PDF p9/printed p6, opening §3.3 paragraph, which recommends two clearly labeled results. Original locator and visual checks from the [v1 independent review](scope2-pilot-qa.md) remain applicable because those records and original bytes are unchanged.

P05's exact approved text is: “Reporting both keeps the grid-average perspective and the contractual procurement perspective visible.” Its qualification is: “This is an explanatory synthesis of EPA guidance, not a determination that every company is legally required to report both.” This is a bounded practical synthesis of E01 and E03, not a quotation of EPA's policy rationale or proof of a legal requirement. P03 separately retains its U.S. guidance and non-universal/legal-duty qualification. Both must remain visible.

Approval is limited to EPA source `epa-electricity-2023`, evidence E01–E06 and propositions P01–P05 for private internal research/evaluation, including the selected concise attributed text supplied to the configured Anthropic adapter. Every comparative source/evidence record and GP01/GP02/DP01 remains withheld. `commercial_runtime_approval` is false; rights limits from the prior review and [new evidence handoff](scope2-pilot-feedback-evidence.md) remain. No publisher terms, full-publication ingestion or commercial rights were newly cleared.

The author applied the reviewer's exact disposition at `2026-09-09T00:22:45Z`. The operational review deadline remains `2026-09-15T23:20:32Z`; it was not extended and is not a regulatory effective date. Final approval metadata and P05 text/qualification were independently rechecked.

## Implementation and executed offline checks

The router now independently requests the two method topics, reporting recommendation and reporting rationale. Indirect phrasing such as explaining EPA's recommendation also requests the rationale. Existing topic validation therefore rejects either omitted P03 or omitted P05. A context-only proposition cannot fill either requirement. Accepted statements render in reviewed release order rather than retrieval-score order. The provider instruction permits correction of a general “must” premise using the reviewed qualifications; it continues to prohibit legal applicability and numerical work.

The four changed backend files and the runner's two changes were read independently. The runner changes only its default fixture path and the recorded scope's case count. The strict candidate schema, evidence validation, release/source pinning, no-stream/no-cache behavior and provider budgets remain in place.

Initial independent execution on Windows, Bun 1.3.12, before live run 03:

| Check | Result |
| --- | --- |
| `bun test src/research` in Site API | 32 tests pass, 131 assertions; no real network. |
| Every question definition against the actual v2 loader with a controlled provider | 24 pass, ten mock selections, zero real calls. Exact rendered text/qualifications/references and client decoding checked. |
| F01 exact question; F02 compound paraphrase; F04 reporting rationale | Qualified, P01/P02/P03/P05 in reviewed order. |
| F03 comparison-only “calculation methods” | Qualified, P01/P02; no reporting topic forced. |
| F05 computation, F06 California filing, F07 worldwide legal duty | Unsupported with empty factual content and zero provider calls. |
| F08 comparison-only, missing P03, missing P05, and P04-substitution candidates | All four variants rejected with `needs_review` and no factual output despite using real proposition/evidence IDs. |
| Six inherited candidate attacks | All rejected: unrelated citation, extra prose, missing comparison topic, unretrieved proposition, withheld proposition and trimmed context. |
| Remove P05 from the actual retrieved proposition set | Unsupported before provider invocation; no context-checklist fallback. |

The new file preserves all **31 inherited case definitions unchanged** and adds eight definitions: seven questions and one candidate case containing four negative variants. It therefore has **39 definitions**, **24 question definitions**, and **20 live-eligible questions**. Nine live model calls are expected; eleven live-eligible requests should route locally. The additional comparison-only and mixed-scope questions remain offline in this run. These counts are different measures, not a claim that 39 cases ran end to end.

### Correction after the live failures

The final router distinguishes explicit comparison intent from the phrase “report both.” F04 therefore requires only P03/P05; F01/F02 still require P01/P02/P03/P05. The provider receives server-generated required-topic and question-kind metadata. General questions requesting company facts are withheld as `needs_review`; actual company-result diagnoses cannot turn method definitions into an approved answer.

A proposed exact-phrase exception for one existing test question was rejected by the coordinator and independent QA before final approval. The final classification requires a diagnostic target such as results/totals/inventory together with company, actual or personal-result context. A generic definition request mentioning company details remains general. This is still conservative lexical classification, not universal intent understanding.

Final independent checks: **35 research tests / 148 assertions pass**; all **24 question definitions** pass again with ten controlled mock selections and no real calls. F04 now returns P03/P05, S2-15 returns P01/P02, and F01/F02 return all four required statements. A deliberately minimal P03/P05 selection passes F04 but is rejected for F01, as are four further incomplete/context-substitute selections. A generic company-details paraphrase and an actual measured-results question receive their distinct expected treatment. An erroneous model context request for a general question is withheld.

The original mock provider selected every retrieved proposition, which concealed the reporting-only overrequirement. The final probes deliberately select the minimal sufficient reporting subset. Offline mocks still cannot establish live model behavior; the targeted live recheck below provides separate evidence.

| Final corrected backend file | Independently checked SHA-256 |
| --- | --- |
| `provider.ts` | `aa4eff5c50e0accd1a10ec07985a27337be20def73d366f2a4d6707fc91505c9` |
| `retrieval.ts` | `aa991694002c9a9624cca01fd4b02c82206139743e38eaadf305211ff97ec952` |
| `service.ts` | `b26588919064eafddb4495959245d7687e16acc1271b0c2e7224f230dd828813` |
| `research.test.ts` | `483f105a66a1ecb684004ce976f49bcb76c51b66c52e4b88b19312e00bd54989` |

These files are under `apps/site-api/src/research/`. The coordinator separately reports the full Site API suite passing 80 tests / 244 assertions on this frozen correction; that broader run was not repeated by this reviewer.

## Live feedback-run review

The coordinator's [run 03](../../evaluations/research-qa/runs/2026-09-08-scope2-pilot-03.json), SHA `bf03596c1f06ada4d17e373ecbdfa2b582e50d42973c63e1ebd07b2c00bbb9c9`, ran twenty questions at `2026-09-09T00:27:47Z`–`00:28:07Z`. It records nine model calls and **18/20 passing cases**, with overall `passed: false`. The exact board question F01 and indirect compound F02 passed. Two cases failed:

- S2-15, “Why are the two Scope 2 results different?”, returned `needs_input` and asked for company facts despite being a general concept question.
- F04, “Why does EPA recommend reporting both Scope 2 results?”, returned `needs_review`. The router unnecessarily demanded method-definition topics as well as reporting topics. A minimal P03/P05 answer should satisfy this question; the live model's actual candidate selection is not stored or inferred here.

Both failed responses contained no factual claims, evidence or sources. They are usability/coverage failures and remain recorded; they are not counted as passes merely because the service withheld content. The successful offline mock run did not predict these live model outcomes.

The [targeted recheck fixture](../../evaluations/research-qa/scope2-pilot-feedback-recheck-fixtures.json), SHA `8a54387944abe699deb5e91a6ed971186f260b73d9bf2de1685b9623bb2f2ccf`, copies ten definitions exactly from the frozen 39-case file. S2-15/F04/F01/F02 allow four model calls; S2-06/09/10/11/12/A09 are six zero-model guards. No expected answer, question or definition was relaxed.

The coordinator's final [run 04](../../evaluations/research-qa/runs/2026-09-08-scope2-pilot-04.json), SHA `b755df8c4e1679df739d91e4c52554ea24de4ee47543570d79dc5c802eb05b38`, ran at `2026-09-09T00:39:07Z`–`00:39:19Z` and **passed 10/10**. Independent inspection verified every saved response against the unchanged expected definition and current release, including exact text, qualifications, complete evidence/source references, provider metadata and client decoding:

| Final live case | Verified result |
| --- | --- |
| S2-15: general method difference | Qualified; P01/P02, no company-context request. |
| F04: reporting-only rationale | Qualified; P03/P05, no unnecessary method-definition requirement. |
| F01: exact board question | Qualified; P01/P02/P03/P05 with both reporting qualifications. |
| F02: compound paraphrase | Qualified; P01/P02/P03/P05. |
| Six context/numeric/filing/status/history/injection guards | Expected states, empty factual content and zero model calls. |

Run 04 records `claude-sonnet-5`, four call-counter decrements from six remaining to two, and a $0.24 reserved-spend increase. These are service counters/reservations, not provider billing receipts. The approved v2 and recheck fixture hashes, all ten recorded current backend/test/runner hashes, and the artifact-unchanged result were independently verified. Fifteen checked source-release, fixture, run and runtime text files use LF and are unchanged by Git's configured clean filters. Run 03's artifact hash and failed states remain unchanged. This is a targeted correction pass, not a claim of 20/20 on final code or universal model accuracy.

The coordinator reports a separate final browser check at approximately `00:40Z`: the exact F01 question displayed the four reviewed statements and qualifications with evidence version 2. Clicking the E03 citation expanded PDF p9/printed p6, §3.3, with the anchor “Both results” and an original EPA link ending `#page=9`. The coordinator reports this additional call left one attempt available in the configured session envelope. No frontend code changed during the feedback fix. These browser observations belong to the coordinator; this reviewer did not operate that browser or independently inspect its screenshot.

Earlier [run 01](../../evaluations/research-qa/runs/2026-09-08-scope2-pilot-01.json) and [run 02](../../evaluations/research-qa/runs/2026-09-08-scope2-pilot-02.json), their historical bindings and the previous QA report are preserved. Run 03 is preserved alongside them.

## Limits

This remains a small private concept pilot with lexical routing and fixed reviewed statements. Passing the added questions does not establish universal paraphrase coverage, company-specific reporting applicability, historical rules, calculations, filing, commercial rights or production readiness. The prior browser/accessibility/concurrency/security limits remain. A new release pin records the bounded change; it does not retroactively alter earlier results or eliminate the need for board feedback.
