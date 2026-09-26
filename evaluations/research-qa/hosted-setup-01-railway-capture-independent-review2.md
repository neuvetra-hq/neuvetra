# Railway capture independent review — repaired candidate

Date: 2026-09-26. Task: HOSTED-SETUP-RAILWAY-CAPTURE-QA-01. Reviewer: /root/compose_qa, qa-lead. Author: /root. I authored none of the capture/binder source or candidate tests. Requested registered critical route: gpt-6-astra/high; observed model/effort unknown. Refreshed QA role and agent-improvement guidance; used L01/L04/L06 public-boundary and composed-actor checks. Actual arrangement is an existing independent specialist context, not a new worker or an author self-review.

Verdict: **PASS, bounded to local synthetic acquisition/binding behavior and source review.** CAPTURE-F01 is resolved by per-command executable checks. The original FAIL is preserved in hosted-setup-01-railway-capture-independent-review.md. No current live deployment, authentication session, publication, stop/resume, or upgrade acceptance is established.

## Reviewed repaired bytes

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-railway-capture.ts | 3c384fb1ac6ff2ffb06b4cb8d4b62c67d87e9cd1dd972ae24fa197a4acb39b83 |
| tools/staging/hosted-setup-railway-capture.test.ts | 5bb58972c48277c7e3d434a7209cae4df8ac4f552d5c90acdcb173373a3b8097 |
| tools/staging/hosted-setup-deployment-binding.ts | ddc00cd264cce8c1b49060453fee73c40f96682b3706e33f11ede26d2b0a8333 |
| tools/staging/hosted-setup-deployment-binding.test.ts | 84e7664d4bc8c27886b695f15b59e470f80bf4e26137c4997eec067f76e5ce54 |

The repaired source adds a digest check at the start of the shared status/api command function. Original binder bytes remained unchanged throughout this review. Final hashes were checked against this table; any later change requires targeted review.

## Verification

Environment: Windows/PowerShell, Bun 1.3.12. No provider connection or mutation was used. Tests ran with filesystem permission necessary to read the worktree.

- Candidate baseline before repair: 13 tests, 85 expectations, all passed. This did not catch the independent drift finding.
- Repaired candidate plus independent temporary suite: **19 tests, 141 expectations, 0 failures**. Candidate suites contribute 13 tests/89 expectations; independent suite contributes 6 tests/52 expectations.
- Focused strict TypeScript: `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --types bun tools/staging/hosted-setup-railway-capture.ts tools/staging/hosted-setup-railway-capture.test.ts tools/staging/hosted-setup-deployment-binding.ts tools/staging/hosted-setup-deployment-binding.test.ts`: exit 0 on repaired bytes.
- Temporary independent suite: `%TEMP%/hosted-railway-capture-independent-20260926.test.ts`. Its synthetic status/inventory builder was adapted from candidate fixtures to exercise actual collector outputs through the actual public receipt builder; assertions/mutations below were independently derived. It made no source edits. Initial QA field-order assertion and subsequent source-drift failure are preserved in the original report.

## Criterion disposition and independent probes

| Criterion | Evidence and disposition |
| --- | --- |
| Executable pin at acquisition | PASS. Independent runtime changed its digest after --version and after status. Repair throws STATUS_EXECUTABLE_HASH_REFUSED after 2 hash reads with calls [--version], or INVENTORY_EXECUTABLE_HASH_REFUSED after 3 hash reads with calls [--version,status]. No disallowed command or retry occurs. Stable acquisition uses 3 hash reads and returns mutation authority false. Version/hash rejection is also in candidate tests. |
| Exact target without project root | PASS. Two actual synthetic collector results compose into a receipt. Receipt builder rejects missing service.projectId, missing environment.projectId, both wrong together, all three status/API project identities coordinated wrong, wrong service ID, wrong environment ID, wrong status instance service ID, and unexpected restored project root. Removing the GraphQL project root does not remove service/environment ownership checks. |
| Exact service filtering | PASS. Independent fixture prepends a different service and service-instance whose image lacks commitHash. Exact Site-Web result still binds the intended deployment. The first service-instance edge is never used as a proxy for Site-Web. |
| Raw capture and provider errors | PASS at the composed acceptance boundary. Collector preserves raw JSON and complete-capture hash; invalid JSON/process/size/duration failures reject. Syntactically valid GraphQL errors, data:null, null, array and empty object are collected as raw evidence but all fail in the real receipt builder. The collector is not a schema-validity or deployment-acceptance verdict. |
| Missing identity fails closed | PASS. Independently deleting the expected commit from latest, active, or inventory metadata refuses. Replacing the active inventory entry with a terminal different deployment refuses. No commit is inferred from an image, PR head or unrelated service. |
| No shell, no provider mutation, no retry | PASS from default-runtime source and recorded synthetic argv. node execFile uses shell:false, windowsHide:true, bounded buffer and timeout, a limited environment and absolute executable/cwd validation. Only --version, exact-project/environment status and exact service/environment inventory API argv are issued. Signal/status exit/inventory exit/oversize probes reject; each command executes at most once. Errors do not echo provider stderr. |
| Independent trust/binding controls | PASS within existing binder contract. Existing tests enforce two sequential captures, unchanged runtime/image/config/inventory, empty staged patch, preserved null pending count, wrong/missing/duplicate raw fields, exact externally pinned capture/receipt/review bytes, distinct reviewer, time bounds, consumed capability, replay and fresh observation failures. Binding mutationAuthorized remains false. |

## Authentication, authority and runtime limits

Authentication is conditional on the trusted operator host, accepted Railway executable, its provider session and independently supplied external capture pins. This module does not verify credentials or supply a signed provider attestation. An injected runtime or forged JSON/hash pair cannot prove provider origin. Neither the collector's target label nor its SHA is an authentication verdict. The binder explicitly states this boundary; capture evidence must remain private, and an operator must independently authenticate its acquisition before treating pins as trusted.

Per-command hashing closes observed between-command drift, not every file-replacement race between hashing and process creation. Synthetic time/process cases do not validate operating-system termination, provider API availability, real CLI output shape or current session authorization. Default process options were inspected rather than exercised against a live CLI. No raw private provider output or secrets were copied into this review.

The coordinator corrected the initial live diagnostic: deployment 50917421... was another service selected by first-edge position, not Site-Web. The coordinator reports exact Site-Web remains deployment 40546ef7-9004-4486-a471-370aaa305c80 / commit 75d8ec4b16054a1bbfc1a51ddaec99000ee1efe2 and appears in inventory. Those are supplied observations, not independently refreshed facts in this review. They confer no new-image acceptance. Independently tested missing-target commit/inventory cases remain valid negative cases.

The returned in-process capability and fresh observation checks do not implement durable cross-process replay protection, a provider compare-and-swap, continuous writer fencing or mutation authorization. A separately reviewed launcher/journal/stop integration and fresh actual observations are still required. No Git or publication action was performed; coordinator owns immutable snapshot packaging and final run closure.