# M80 setup integration independent review

**Pass — local synthetic setup integration only.** UI Candidate2 `5f7464b2…` and runtime Candidate2 `40c4ac82…` match all 24 frozen files before and after review.

Eight tests passed with 90 assertions: 544 malformed variants refused, 603 legitimate corrections accepted, five component lifecycle tests and nine native client/API check groups. Actual saves, lost-response retry, correction/history, stale CAS, tenant/actor/request binding and role revocation passed against fresh local PostgreSQL.

## Retained first failures

- F01: enum arrays, changed source location and fabricated classification accepted. Closed by exact scalar/identity/semantic checks.
- F02: history creator/time/hash contradictions and impossible dates/lineage accepted. Closed by hash/head/lineage checks.
- F03: token refresh discarded unsaved correction. Closed: draft and exact retry preserved, old requests cancelled, current token used.

Three immutable first-review snapshots preserve all reproductions. Candidate2 lifecycle checks also cover pending save, pending initial load, actor/workspace/signal changes, late replies, unmount and session expiry.

## Limits and cleanup

Authentication was a synthetic token map; assets were stubbed. The real component ran with injected hooks/events, not a browser DOM or React reconciler. Root performs browser review separately. Both QA servers/connections closed; two isolated clones retained and cluster remains under runtime-author ownership. No hosted/Git/provider action or real data. This does not release methods or establish customer beta, numerical accounting or assurance readiness.
