# HOSTED-SETUP-ROLE-QA-02 — independent candidate2 review

Date:2026-09-26. **FAIL for candidate2: ROLE-F01 is resolved; new ROLE-F02 [P2] remains.** This is a narrower failure-receipt integrity defect. Native cleanup itself succeeded in the failed-close case. Candidate1 FAIL/probe/result remain unchanged.

Independent reviewer `/root/hosted_qa`, requested gpt-6-astra/high, observed inherited model/effort/cost unknown. Only new independent probe/result/report files were authored. No product, provider, actual archive, Git or shared-ledger changes occurred.

## Exact bytes verified before and after native tests

| File | SHA256 |
| --- | --- |
| tools/staging/hosted-setup-local-roles.ts | a6c710dc517e0d47d0bde9722d90a96c9ab5801e8c132030523c5ac53b2ef2b1 |
| tools/staging/hosted-setup-local-roles.test.ts | 3c8923371fbb5192b8e03a6808ba06f9167a9fb1472b608b34f7f8f73ba9bd80 |
| evaluations/research-qa/hosted-setup-01-local-role-bootstrap-author.md | 8cabf0a5814ab5a159e663638bc31e029d8a67c9ca82f2f99afa4b1badd613a9 |

## ROLE-F02 [P2]: bootstrap failure receipt falsely confirms a rejected close

At `hosted-setup-local-roles.ts:220–221`, `closeForCleanup(admin)` returns false when closing the connection rejects or times out; the implementation clears `admin` and throws `HS_RECOVERY_CONNECTION_CLOSE_FAILED`. The catch at line225 calls `closeForCleanup(undefined)`, which returns true. Line229 records that new true value as `connectionCloseConfirmed`, losing the actual failed-close observation.

Independent native reproduction let a complete PostgreSQL17.11 bootstrap reach the final close. A spy on the connection factory retained the actual native connection and all queries; only its close wrapper was changed to await the real close and then reject with a synthetic error. The bootstrap failed and stopped the exact cluster correctly. Its persisted result nevertheless contained both `causeCode:HS_RECOVERY_CONNECTION_CLOSE_FAILED` and `connectionCloseConfirmed:true`. A late rejection was injected deliberately; no natural database-close failure is claimed. The same control flow also loses a timeout result.

Required fix: retain the first close observation across the try/catch boundary. A failed or timed-out close must remain false/unknown unless a separate real verification establishes otherwise. Absence of the cleared connection object cannot become evidence of successful close. Keep cluster cleanup status independent; do not mislabel a confirmed server shutdown as failed merely because the client-close observation was false.

## Executed re-review

`bun test evaluations/research-qa/hosted-setup-01-local-role-candidate2-independent.test.ts`: **0 passed,1 failed,58 assertions** on Bun1.3.12. All checks preceding the final `connectionCloseConfirmed===false` assertion passed. The durable receipt is `hosted-setup-01-local-role-candidate2-independent-result.json`.

- Actual native start succeeded, but the injected pg_ctl completion reported exit1: candidate2 attempted exact-data-directory stop, confirmed status exit3 and closed port, retained its data directory/journal/failure result, refused replay, and returned the cleanup-confirmed failure code. **ROLE-F01 resolved.**
- Actual native start succeeded while injected stop/status controls returned failure: candidate2 reported cleanup unconfirmed, `confirmedStopped:false`, `portListening:true`, and `replayAllowed:false`; it did not falsely claim shutdown. The independent harness restored the real control function and stopped only its own exact directory.
- Recorded start/stop/status invocations used pinned pg_ctl and the exact reserved data directory. Source inspection found no broad process or port kill.
- Normal native bootstrap succeeded. During the explicit stop API, the same actual-close-then-reject fault produced `connectionCloseConfirmed:false` while still stopping and confirming the server. Stop and bootstrap replay refused.
- Final-close rejection during bootstrap produced ROLE-F02. The server was confirmed stopped, and all test cluster data/journals remained retained.
- All four disposable test clusters were stopped. Independent TCP checks and final OS listener inspection confirmed **PORT_55479_FREE**.

The candidate1 role/membership and input-boundary evidence remains scoped to its frozen files; this re-review focused on candidate2's lifecycle delta. No successful actual hosted restore, encrypted-archive use, hosted upgrade or provider recovery is claimed. Author should repair the receipt field and request a focused check, preserving both prior review failures.
