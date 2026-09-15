# M69 replacement-candidate security recheck — FAIL

Reviewed 2026-09-15 UTC by independent `/root/m69_security`, requested Astra/high, observed settings unknown. No paid request, credential access or account mutation. The earlier rejected-candidate review remains unchanged.

## Exact candidate

- Candidate: `f78916917cdefc44c0c076992f5e9976b19ee5ea61289cb78c6a523c87a2a5dc`.
- Executable: `9f21cd0d97682f8001eb5a5d82e4dca5be2bc5ffe552d9b88264fec7f650abb6`.
- Replacement compiled rehearsal closure: `1018118939823f9ebbd25e132c58e18987ba5783c2479d0f1a310f253eeb9493` (supplied); answer: `650d6094d6c690cd45aee71dfbac2829be3081844565d6d154bff673ec54e7f9` observed in checked fixture.

Candidate and executable hashes were independently checked and match. The four earlier mutation defects now reject. Local-file/no-search answer provenance is a useful correction and does not imply a cloud retrieval test.

## Expanded checks and remaining defects

`evaluations/research-qa/m69-final-security.test.ts` was expanded with request, uncertainty and extra-attempt mutations. The first expanded run returned **11 passed, 3 failed, 24 assertions**. A further targeted failed-response cost mutation returned **1 failure, 1 assertion**, preserving the original results rather than replacing them with eventual repairs.

The replacement correctly rejects wrong model, enabled plugin, unlisted extra attempt, nonboolean uncertainty, and an unbound uncertainty file. It also retains the three successful compiled refusals for invalid authority, wrong root and replayed rehearsal directory. The unchanged compiled fixture remains mechanically valid.

Four material gaps remain:

1. **Settlement source disagreement is accepted.** Changing `attempt-1-settled.json` from `response` to `generation` leaves terminal native metadata as `response`, yet validates. Enumerating allowed sources is insufficient; the sources must agree across records.
2. **Reviewed output-token cap is not bound to captured request.** Changing analyze `max_tokens` from 8192 to 8193, rehashing the request and reservation metadata, validates. The estimator still uses the fixed 8192 ceiling. Validate the entire request profile against the production request builder, including token/thinking/schema/prompt settings, not only routing fields.
3. **Exact question/stage input binding was absent by static inspection; the original mutation result is invalid evidence.** Correction: the revised question contained no `fictional`, so the original `fictional` to `malicious` probe made no change. Its failure remains in the original test count but does not demonstrate a bypass. The probe now asserts that `yearly` exists, changes it to same-length `annual`, and asserts that the payload changed before requiring rejection. Analyze must exactly match `analysisInput(question)` and its generated request; each started-event input digest must match its actual message input. The corrected probe must be run against the rebuilt candidate before making a final claim.
4. **Failed-response native cost disagreement is accepted.** An actual injected response fails inner JSON after native cost 0.001 is preserved. Changing its settlement/receipt/aggregate total to zero validates despite the unchanged failed-stage native cost. Cost reconciliation is required for failed stages as well as completed ones. This reproduces the risk of understating paid failure cost addressed by M50/M51.

The validator also needs to reject clean exact-cost continuation after an attempt exceeds its reservation. Preserve a known overage as known, mark its accounting/control exception, and ensure no subsequent dispatch is accepted. These requested repairs concern consistency with surviving records, not a claim that hashes can defeat a fully coordinated malicious rewrite of all trusted evidence.

## Verdict and next action

**FAIL for this replacement candidate.** Complete request-profile/input binding and reconcile native cost/source across success and failure, then refreeze and re-review the exact replacement executable. Preserve both rejected candidates and failures. Two incomplete validator candidates have now been rejected: apply the improvement workflow's whole-contract review rather than addressing only individual probe fields.

Account readiness remains separately blocked by the signed-out session. This review neither reads credentials nor upgrades that evidence to pass. A passed future code review still cannot establish account balance/settings, live compatibility, source-rights renewal or paid execution. The revised question and its resulting reservation require the final exact candidate/board evidence; prior $3.946085 notes describe earlier bytes, not automatically this replacement.
