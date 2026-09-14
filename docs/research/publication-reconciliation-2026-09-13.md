# Publication reconciliation through M55

**Date:** 2026-09-13
**Branch:** `work/scope2-answer-demo`
**Starting published revision:** `ca233f5bdc2d4c9e229c7f3e134853f88d4f1282`

## Result

All current application and database implementation under `apps/` and `packages/` is tracked and published to the existing pull-request branch. The audit found no modified or untracked product file in those directories.

The audit repaired one publication-record gap and resolved one apparent omission:

1. M34 was not an unpublished implementation commit. It reached candidate and runtime readiness, then closed before frontend admission, browser submission, provider dispatch or spend because its local permit executable was stale and unpinned. Five stages were retired and the run was superseded by M35. M35 later completed the fresh bounded W11 diagnostic. M33's implementation commits `e8718df` and `ee083c3` are ancestors of the current PR branch.
2. The published M43 record and independent review name five reviewed provider-disabled artifacts that remain local. This is intentional: the evaluation matrix contains the held-out expected evidence, forbidden claims, abstention rationale and grading checks, while the generator and tests depend on that evaluator-side matrix. Publishing the complete package on the product branch would expose the held-out key. The exact local hashes still match the accepted review.

## Restricted M43 package

| Artifact | Reviewed SHA-256 |
| --- | --- |
| `evaluations/research-qa/m43-pilot-evaluation-cases-v1.json` | `9f6e68cbe55805f9737a8a908e23875b2bb5c1c77bd74d3d50feae69dd716e6d` |
| `tools/research/m43-pilot-preflight.ts` | `93b0c6e7653d92cc6bbfd5926070a37f00dec50085d4b1bd8ad01174a7138eca` |
| `tools/research/m43-pilot-preflight.test.ts` | `fe952e839dd4565db9e86bda08509b086925c0c9c1c04ebf0a5fadd5866b64e8` |
| `tools/research/m43-heldout-first-batch-v1.json` | `a2dc2014be922f5a795863203dedc92af066dce04cda7de06e5d52d257e7c17d` |
| `tools/research/m43-pilot-preflight-report-v1.json` | `fae791ec1912e75b7d2b7a8a6272ae07da0e328fc094d8f055eaabde13bc86b8` |

The focused M43 preflight test passes 4 tests and 44 assertions on the current checkout. A bounded credential-pattern scan found no API key, bearer token, private key or provider secret in the five files. The inputs are public/synthetic, but the evaluator expectations remain restricted so the cases retain their evaluation value. These files are evaluation controls, not application runtime dependencies or pending product implementation.

## Local archive disposition

The remaining untracked material is research and evaluation history rather than pending product code. It includes rejected candidate generations, failed or consumed live-run records, independent probes, generated traces and machine-bound `.superpowers` runtime/executable trees. Those records remain local because they are superseded, non-reusable, ignored local tooling, or operational evidence that is not needed by the current product build. Final product behavior from M41, M42, the M47 question-analysis repair, M52's accepted checkpoint, and M53–M55 is present on the PR branch.

M43 evaluator controls, M47 and M49 local wrapper/preparation packages, and the M52 builder/lifecycle sources remain historical or restricted development harnesses. The accepted M47 application fix and M52 candidate, manifest, rehearsal and reviews are published. Their omitted local wrappers are not customer-facing or production runtime dependencies.

This reconciliation does not merge the pull request, deploy the application, release a factor or method, authorize customer data, or make Stage 4 complete.
