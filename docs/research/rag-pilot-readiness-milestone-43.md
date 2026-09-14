# M43 bounded RAG pilot-readiness milestone

Date: 2026-09-11  
Disposition: **offline preparation complete; independent QA pass**  
Live run authorized: **no**  
Customer pilot, deployment and release authorized: **no**

## Result

M43 turns the accepted EPA-only research behaviors into a reviewable pilot-readiness package without making a provider request. It defines a narrow internal evaluation against the approved EPA December 2023 purchased-electricity release, S01-S18, and keeps customer data, source expansion and production work outside the milestone.

The matrix contains 14 new questions: nine development cases and five held-out cases. It tests qualified direct support, multiple-passage reasoning, missing company context, absent source coverage, out-of-scope calculation requests, misleading premises, citation fidelity and rejection of retrieval instructions. It deliberately reruns none of the three earlier accepted questions.

The first proposed paid canary is limited to two held-out questions in order:

1. `M43-H01` tests a qualified supplier-factor answer with direct claim support and complete citation dependencies.
2. `M43-H04` tests refusal of a district-steam calculation and factor-selection request that the corpus cannot perform.

`M43-H01` must be preserved and independently pass its semantic, citation, latency, mechanics and cost checks before `M43-H04` may be submitted. The other three held-out cases require a later, separate board decision after reconciliation.

## Acceptance contract

Both primary cases must pass every case-specific check. No unsupported displayed material claim or topical-but-nonsupporting citation is allowed. Each case must finish within 240 seconds; the two answer windows together must stay within 480 seconds; and the arithmetic mean of the two terminal latencies must stay at or below 120 seconds. These two observations do not establish a production percentile or service level.

The run design allows at most five stages per case, ten across the primary batch, with zero question retries and zero cross-run stage carry. A fixed 30-minute supervisor remains a separate safety boundary. Any pending, uncertain or unmatched cost event stops the run.

Historical settled runs imply an expected two-case cost of **$0.455912001**. The conservative local reservation is **$4.58956 per case**, or **$9.17912** for the primary batch. The reservation and the internal monitoring target are estimates, not provider-enforced or guaranteed billing caps.

## Evidence and limits

The source-readiness review found the S01-S18 release fit for this bounded internal evaluation through `2026-09-15T23:20:32Z`, subject to a fresh review immediately before any live request. Its `commercial_runtime_approval` remains false. A successful evaluation would provide evidence about this narrow public/synthetic workflow; it would not authorize a customer pilot, establish source rights for commercial runtime, demonstrate tenant isolation, or approve deployment or release.

Provider-disabled preflight reproduced the question-only fixture and report, matched all nine current source and policy pins, and failed closed on nine of nine pin mutations. Independent QA passed the final package after verifying 14/14 locators and dependency closure, zero prior-question duplicates, no evaluator leakage, targeted type validation, 69 tests / 696 assertions, and a separate 34-test / 460-assertion integration and security suite.

No provider request, credential access, customer data, external network request, source expansion, deployment, merge, release or commit occurred in M43.

## Reviewed artifacts

| Artifact | SHA-256 |
|---|---|
| [Pilot contract](rag-pilot-contract-m43.md) | `7da5d2ae0d111ece485bd0578c3a720b45da3dbcc049065d83cb39b66218afe8` |
| [Evaluation matrix](../../evaluations/research-qa/m43-pilot-evaluation-cases-v1.json) | `9f6e68cbe55805f9737a8a908e23875b2bb5c1c77bd74d3d50feae69dd716e6d` |
| [Source readiness](rag-pilot-source-readiness-m43.md) | `77c0cf54669b426943c858fc0d336dbf3793955152b3476747bd49740b979653` |
| [Execution plan](rag-pilot-execution-plan-m43.md) | `8d1730c214da3d68f28da02de1e47d0e71b9f96c4b62e32cd7a68c14c012651d` |
| [Provider-disabled preflight](../../tools/research/m43-pilot-preflight.ts) | `93b0c6e7653d92cc6bbfd5926070a37f00dec50085d4b1bd8ad01174a7138eca` |
| [Preflight tests](../../tools/research/m43-pilot-preflight.test.ts) | `fe952e839dd4565db9e86bda08509b086925c0c9c1c04ebf0a5fadd5866b64e8` |
| [Primary question-only fixture](../../tools/research/m43-heldout-first-batch-v1.json) | `a2dc2014be922f5a795863203dedc92af066dce04cda7de06e5d52d257e7c17d` |
| [Preflight report](../../tools/research/m43-pilot-preflight-report-v1.json) | `fae791ec1912e75b7d2b7a8a6272ae07da0e328fc094d8f055eaabde13bc86b8` |
| [Independent QA](../../evaluations/research-qa/m43-pilot-readiness-review-10.json) | `0c986584466ecf1f1db9ef7bc1ab9c5d7939e5f5d4b1d5a22c497266ce5d9f25` |

## Board decision

The next step is a yes/no decision on the exact two-question `M43-H01` then gated `M43-H04` paid canary. Any approval must still be bound to a fresh source/runtime review, the frozen public/synthetic question bodies, approved S01-S18 passages, direct OpenRouter Messages API routing to Anthropic Claude Opus 5/Sonnet 5, the limits above, and immutable capture plus independent grading and native-cost reconciliation. Optional cases and every customer or release action stay outside that decision.
