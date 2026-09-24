# OPS-PILOT-01-A independent screening review

2026-09-22. Reviewer: `/root/metrics_qa`; requested gpt-6-astra/high, observed reviewer compute and cost unknown. No candidate output was executed. No credential file was read and no request or paid rerun was made by this reviewer.

Reviewed output: `build-pilot-output/OPS-PILOT-01-A.json`, SHA256 `1f2981738361ec98c03cd5c651b4387bcf311e626800fb1dc80f5b2426732c62`. Fixture SHA256 `4cbf395a45c8f9b8bcaed2fcc446f4930a63121feffa83541b962fa766d7f94d`; pre-existing expectations: `build-pilot-review-rubric.json`. Ledger observed SHA256 `1a253d4e68b8cb186e405aa899b1fd2a40d608bce51567aebcbf795aa3d38378`.

**Experiment evidence verdict: pass.** AC-CAP combines the independently accepted adapter with this batch's six unique matched settlements and total below the five-dollar ceiling. AC-QUALITY is met by both candidates receiving the same three fixture IDs/version and output limit, with all six now independently graded. AC-REPORT is met by the exact preserved output artifact, matched usage receipts, per-case findings and explicit limitations below. This accepts completion and evidence of the experiment, not correctness or qualification of every candidate answer. Failed answers are retained as results rather than hidden or repaired.

## Results

| Model | Case | Substantive verdict | Raw adapter result | Reported cost USD |
| --- | --- | --- | --- | ---: |
| MiniMax M3 | Decimal | **Fail** | Unusable: not JSON | 0.00728771 |
| MiniMax M3 | Tenant | **Insufficient evidence** | Unusable: not JSON | 0.00452365 |
| MiniMax M3 | QA scorecard | **Fail** | Unusable: not JSON | 0.00304447 |
| Kimi K2.7 Code | Decimal | **Fail** | Unusable: not JSON | 0.0167692206 |
| Kimi K2.7 Code | Tenant | **Pass, synthetic reasoning only** | Reviewable | 0.012688221 |
| Kimi K2.7 Code | QA scorecard | **Fail** | Unusable: not JSON | 0.0188250132 |

All six responses ended with `finish_reason: stop`; none is classified as truncated. The insufficiency above concerns the job trust boundary, not timeout or output truncation.

Raw formatting is a separate finding: five responses used Markdown fences. The request asked for JSON but the system prompt did not explicitly prohibit fences or use a structured response format. This is a shared orchestration/output-contract weakness, not evidence of accounting incompetence. Reviewer-only inspection removed exactly one JSON fence around a single block where present; trailing explanatory prose in the two QA responses was inspected separately. No syntax, numbers or prose were repaired. Four fenced blocks parsed as JSON objects; MiniMax Decimal still failed JSON parsing at its Python list comprehension. Original files and adapter statuses remain unchanged.

## Case evidence and findings

- **MM-DEC-01, medium, fail:** MiniMax correctly identifies binary floats, premature rounding, missing-zero substitution and lost evidence IDs, and proposes final decimal half-up rounding. However, F3/T5 incorrectly say `float()` accepts hexadecimal `0x10`; F3 also lists empty string as accepted. T11 claims NaN and -1 convert to zero. Independent builtin controls instead raised ValueError for hex/empty, produced NaN for NaN and -1 for -1. Its T6 claims Python rounding of 0.12345 to four places gives 0.1234; the observed builtin result is 0.1235. These are false validation/test-oracle claims, not an optional-case omission. T1 embeds a Python comprehension inside purported JSON, so removing the fence does not repair its format.
- **MM-TEN-01, high boundary uncertainty, insufficient evidence:** MiniMax covers server authorization before cache, namespaced cache, cross-tenant negative and same-tenant positive cases, missing identity and untrusted report directives. But `proposed_algorithm.steps_job[1]` explicitly uses the job's tenant as authoritative and skips tenant derivation because the worker is trusted. It does not establish that job tenant/requester fields were securely bound by an authorized enqueuer or revalidate `requested_by`. A trusted worker alone does not establish trusted job contents. This requires a targeted forged-job/revoked-requester clarification before acceptance. No implemented exploit or actual disclosure is claimed.
- **MM-QA-01, high, fail:** MiniMax correctly derives 2 unique findings, 3 rounds and 2 rework cycles. It then invents a second call z, returns measured cost 0.04 rather than 0.03, and makes `total_cost_complete` the number 0.04 rather than false. It returns unknown call IDs instead of the requested count. Later-version invalidation is correct; timeout discussion acknowledges reservation but does not cure the invented call. Numerical truth and typed-output gates fail independently of formatting.
- **KI-DEC-01, medium, fail:** Kimi's main decimal algorithm, 3.7637 happy-path result, 0.0100 premature-rounding example and 0.1235 half-up result are sound for the supplied examples. But F9 falsely states that `float()` accepts malformed `1.2.3`; independent builtin evaluation rejects it with ValueError. The response therefore fails the factual validation-claim gate and needs correction. Lack of an extra zero-only example is recorded as coverage to improve, not the decisive failure. No claim is made that its proposed arithmetic produced an observed wrong total.
- **KI-TEN-01, pass:** Kimi requires identity-derived tenant context, server/job authorization, authorization before cache access, tenant cache keys, rejection of missing identity and treating report text as non-authoritative. It supplies cross-tenant, same-tenant, cache and content-injection controls. Its optional explicit-sharing branch relies on an authoritative policy store, not document text; the supplied no-grant fixture still denies access. No actual patch, persistence or security implementation was exercised. A further trial should explicitly test forged job payloads and requester revocation.
- **KI-QA-01, high, fail:** Kimi also derives 2 findings/3 rounds/2 repairs correctly, but invents two z calls and three y calls: expected measured cost is 0.03 and unknown-call count is 1, not 0.04 and 3. `total_cost_complete: false`, stale-version handling and retention of timeout reservation are correct. Fabricated call cardinality fails the numerical truth gate.

Both QA responses fail a consequential numerical gate by inventing usage history. Neither is qualified for deterministic metrics or accounting ownership from this trial. No real regulatory approval claim, executed authorization violation or critical production incident was observed; candidate labels such as “critical” describe defects in the fictional fixture, not new incidents discovered here.

## Measurements and recommendation

All six distinct provider-generation receipts matched the six ledger settlements. Reported API cost totals **0.0631382848 USD**; remaining aggregate capacity is **4.9368617152 USD**. There are no unresolved charges in this batch. These are provider-reported usage costs, not an independently obtained invoice. Do not add the same imported receipts again.

| Model | Cases | Input tokens | Output tokens | Reported USD |
| --- | ---: | ---: | ---: | ---: |
| MiniMax M3 | 3 | 1,097 | 15,212 | 0.01485583 |
| Kimi K2.7 Code | 3 | 618 | 14,509 | 0.0482824548 |

Actual model strings match requested model strings in all six receipts. Effort, reasoning/cache token breakdown and reviewer/orchestration cost remain unknown; output tokens are not assumed to be visible prose alone. Both candidates had the same 8,192-token maximum and the same three fixtures. Different tokenizers and sequential scheduling limit comparisons.

The ledger reserve-to-last-settlement interval was 610.179 seconds. Consecutive reserve/settlement intervals were approximately 183.651, 126.244, 93.131, 62.292, 48.292 and 96.569 seconds. They include local overhead and are **not individually instrumented model latency**; no active-worker timing or speed ranking is asserted.

Recommendation: keep existing role defaults. Kimi's one passed tenant reasoning case supports consideration for a fresh, bounded nonnumerical engineering trial with independent review and forged-job/revocation controls. MiniMax needs the job-authority gap clarified before that task-class acceptance. Both need a fresh supplied-call-cardinality case before reconsideration for numerical work. Three cases do not meet the policy's five-comparable-assignment probation threshold, and this report authorizes no further spending, automatic rerun, critical-role promotion or production access. Preserve the remaining budget for a separately targeted comparison.
