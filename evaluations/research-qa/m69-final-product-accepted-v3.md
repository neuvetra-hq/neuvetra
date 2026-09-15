# M69 final exact product review — version 3

**PASS for the exact offline product candidate below: P1 question fit, two rendered claims, claim-level citations, qualifications, proportionality, and explicit local/provider-disabled provenance. Live model accuracy and live readiness remain INSUFFICIENT EVIDENCE.**

Reviewer `/root/m69_product`, sponsor QA, 2026-09-15 UTC. This execution context did not author the candidate, fixture, runtime or tests. Requested Astra/high; actual model/effort and resource cost are unknown. Applied L02 exact-artifact checks and L04 actual-boundary verification. This is internal product QA, not source-rights approval, professional assurance, or authorization to spend.

## Exact accepted scope

| Artifact | SHA-256 |
| --- | --- |
| Candidate, `docs/research/m69-live-candidate.json` | `97edd66e74705418e759e56a41a091faf363bca50a1de4fd7e2f6206ac419007` |
| Compiled executable, `.superpowers/m69-build/m69-canary.exe` | `aa66fc95bfa373e2716bbecaa1f44bfff88685729cc0770c1a102dae73daf126` |
| Runtime, `tools/research/m69-canary-runtime.ts` | `10ab17b090033b11f36a140f5af001c9875172d42592dc86c6cde2f038462b20` |
| Rehearsal closure, `.superpowers/m69-rehearsal-final/closure.json` | `61fb0d9e0cc86c97863bc2c29e6ace63277293517080f4f8b738cc7469048d65` |
| Rehearsal answer, `.superpowers/m69-rehearsal-final/answer.json` | `b5b5d00e4b5cab899145e9f9e00fb0933e49b02df842f648c360dc4110d3661a` |
| Fixture, `evaluations/research-qa/m69-compiled-rehearsal-fixture.json` | `ef67ae15310b2057d0e3430780c3bfd0d954c7a213d513770e03c2674ccf0195` |
| Preparation, `docs/research/m69-canary-preparation.json` | `a1e1d804b4ad491f813d8e08d9265752919db62b5ae998a36951ddee9d702dcf` |

Every listed hash was independently checked. All 36 candidate pins matched current files. Both rendered claim texts, all required unit dependencies and qualifications, and both passage excerpts/source IDs/locators exactly matched the approved catalog/release. The snapshot accompanying this review preserves the reviewed text artifacts; this report must remain unchanged if a successor is produced.

## Exact question, claims and evidence

> For a yearly purchased-electricity report, what source records should we collect for electricity entering a facility, and what should we check if both a commodity supplier and the local utility invoice the same consumption?

Question SHA-256: `3d07f2af45ca8e0b538f8b8678747c95f3b38d5ab076d6638f3bf417bbb15cd4`.

| Material requirement | Rendered evidence and grading |
| --- | --- |
| Identify source records for purchased electricity entering a facility | **PASS.** U04/S03 explains purchased quantity during the reporting year, utility bills or other purchase records, and facility-entry data compared with potentially incomplete internal submetering. Locator: **PDF page 7 / printed page 4**. |
| Handle separate commodity and local-utility invoices for the same consumption | **PASS.** U05/S04 retains the condition, attributes EPA's recommendation to use local-utility metered consumption, and excludes the same consumption from the commodity supplier to prevent duplicate counting. S03 is present as U05's dependency. Both locators: **PDF page 7 / printed page 4**. |
| Stay proportionate and preserve limits | **PASS.** Exactly U04/U05 and S03/S04 appear. No unrelated factor-date guidance. The answer does not assess actual records, diagnose bills, estimate missing consumption, prepare an inventory, select a factor, calculate emissions, or determine filing/completeness obligations. |

Both source summaries preserve reviewed wording and claim-level evidence IDs. The same-consumption condition limits the duplicate exclusion; it does not imply all commodity invoices must always be excluded. The EPA December 2023 title, canonical URL, edition, published-guidance status and release SHA `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f` remain visible. No unresolved customer facts are required for this conceptual explanation.

## Provenance and validation

**PASS.** Serialized answer provenance says local retrieval, verified local files, no search, local-pinned-corpus build, and provider-disabled fixture. The closure agrees: zero provider requests, three injected transport invocations, analyze/plan/verify, qualified answer and controlled exit. The historical `answer_mode: cloud_reviewed_composition` value is an internal answer-contract discriminator; it is not evidence of cloud retrieval or live model execution. Explicit retrieval/provider fields govern this internal artifact's execution description. No public UI provenance acceptance is claimed.

Independently ran on Bun 1.3.12:

`bun test tools/research/m69-canary.test.ts evaluations/research-qa/m69-compiled-product.test.ts evaluations/research-qa/m69-final-security.test.ts evaluations/research-qa/m69-independent-security.test.ts evaluations/research-qa/m69-preflight.test.ts evaluations/research-qa/m69-product-evaluation.test.ts`

Result: **33 passed, 0 failed, 218 assertions, exit 0**. The previously reproduced settlement-source, rebound output-token-limit, and altered analyze-question checks now pass. Readback code now reconstructs the exact stage request, binds analyze input to the frozen question, and cross-checks settlement/native stage cost sources. The suite also verifies candidate/executable pins and missing-account failure. Independent security review still owns its full domain verdict.

The existing compiled rehearsal was read and hashed. Tests exercised the real composed service with injected responses and the compiled refusal paths; I did not perform a live request or another successful compiled rehearsal. The fixture's settlement total of 3,000,000 nano-USD is synthetic data, not incurred cost.

## Failure history and remaining boundaries

The first failure remains in `m69-final-product-review.md`; the replacement-question follow-up and its three reproduced security failures remain in `m69-final-product-recheck.md`. F1 was resolved by replacing the original reporting-period question with the source-reviewed P1 question, not by demonstrating a correct answer to the original question. F2's false cloud/Supabase/Pinecone retrieval fields were repaired. The three later test failures are repaired in this exact candidate. None is rewritten as first-pass success.

The question and scripted responses are exposed development/regression material. Passing them does not demonstrate unseen live semantic accuracy, general prompt-injection resistance, or missing-context/out-of-scope model classification. No customer bill, saved version, annual report or private cloud index was queried. The fixture supplies semantic decisions; this reviewer independently grades the rendered claims, not a live model's decision-making.

Account preflight remains blocked by the coordinator-reported signed-out OpenRouter browser, and the local preflight test confirms missing account evidence fails closed. No credential access, network/paid request, source release, publication or deployment was performed by this reviewer. Live compatibility, account readiness and customer integration remain unproved. The operational source deadline remains `2026-09-15T23:20:32Z`. This review does not extend it or authorize a paid run. Root owns final domain-review integration, any board decision and exact successor handling.
