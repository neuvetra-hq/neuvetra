# M78 performance independent review

Task M78-PERF-INDEPENDENT-REVIEW-01. Reviewer /root/resume_release, 2026-09-22 17:25 UTC. Author /root/resume_recipe. Source/isolated native acceptance; no hosted performance or complete lifecycle claim.

## Verdict

Accept the bounded implementation at route SHA ab5018c64668dfe197755849aee1a2b3c5947f6c3da21e8d18869e998f3f9e01 and database SHA d492c23983b174662acb8728db88cb590a7446b6e5ec5e1a0a9a99e27ac0bf52. No blocking lock-path or shared-state escape found. The earlier independent proposal audit established all upstream writer company locks; this review challenges the implemented closure and native behavior.

POST reconstruction is removed only after route/auth/access/method checks. Input validation still precedes the writer, explaining the disclosed malformed-body/wrong-stream 422 ordering. Exact non-null stream/family validation occurs after the company exclusive lock and verified register build; only the dedicated missing-stream error becomes 404. Incomplete corporate proof remains a verification failure. GET reads retain the previous path.

The upstream graph is captured after m78_lock and reused only by a lexical closure holding the same transaction, company and policy. Full M78 rows, proofs, dependencies, review chronology, requests, discovery reservations, retained reports and capacity are reread and verified before and after native mutation. No exported graph injection or cross-request cache is introduced. Native SQL and accounting calculations are unchanged. Post-write verification failure rolls back the transaction.

## Independent execution

Executed the preserved author test and an explicitly derived independent extension using the existing exact loopback55472 fictional baseline; each creates a new isolated QA clone and closes its connections. Combined run: 4 tests / 85 assertions passed. Final independent extension rerun: 2 tests / 51 assertions passed. Strict targeted TypeScript passed. No migrations, original baseline data, hosted requests, credentials, failed journey keys, or shared journals were modified.

The independent extension expands six author barrier probes to 23 save/review/report entrypoints: corporate, gas, mobile, diesel, fleet, stationary and both fugitive source/population. Each actual competing native entrypoint receives lock timeout 55P03 while the first inventory writer holds its captured upstream graph. These use deliberately invalid payloads to prove lock-before-validation; they do not establish successful source/discovery correction outcomes. The first draft used an invalid discovery family label; this still hit the lock but was insufficiently precise. It was corrected to population and the final test passed on a fresh clone; the initial run is not represented as a valid population-path demonstration.

Inherited assertions, independently executed, cover valid other-tenant progress, a competing valid initial inventory conflict, a valid later corporate change followed by stale-dependency refusal, before/after access revocation, exact fresh-local idempotency, missing-stream refusal and post-write corruption rollback of version/request/audit rows. The reviewer did not repeat the author's full capacity/retained-report benchmark suite; its reported 3/76 capacity run and six paired local timing observations remain separately attributed author evidence. The full-data rollback comparison is likewise author evidence, beyond the reviewer's narrower native rollback assertions.

## Remaining release gates

Current CI, final source-map admission, fresh exact recovery, publication, hosted timing below the unchanged deadline and original-attempt nonduplicating continuation remain root gates. Local timing samples do not establish a hosted percentile or SLA. This review does not approve a method corpus, customer accounting release, legal compliance or external assurance.

Requested inherited compute gpt-6-astra/high; actual runtime settings unobservable. No product source edits by reviewer. Own test is derived from the author fixture with independently added lock matrix, not presented as wholly independently authored infrastructure.
