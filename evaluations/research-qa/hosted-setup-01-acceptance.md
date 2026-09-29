# Hosted setup increment 1: independent acceptance matrix

Task HOSTED-SETUP-QA-01. Reviewer: separate Head of QA execution context `/root/hosted_qa`; authored no product code. Requested route gpt-6-astra/high; observed model/effort and actual cost unknown. Baseline supplied by coordinator: 4af86b4. Candidate hashes and actual execution results will be recorded separately. This plan is not test proof.

Board brief: `C:/Users/nimab/Neuvetra/notes/briefs/2026-09-25-hosted-setup-rebuild-brief.md`. New direction supersedes the import sequence in CONVERGENCE.md. Increment 1 is general company setup schema and API access foundation. Collection, original evidence storage and readiness are subsequent work unless explicitly delivered here.

| ID | Independent expectation | Required evidence |
| --- | --- | --- |
| I01 | Anonymous and invalid identity cannot obtain or alter setup. Company A actor cannot list/read/change company B setup or guessed version IDs. | Actual API requests with two synthetic companies/users, including reverse direction and malformed IDs. |
| I02 | Direct runtime-role database reads remain scoped to current membership, including nested/reference tables. Runtime cannot mutate versions or bypass write validation. | Native PostgreSQL RLS/privilege tests under least-privilege runtime, not superuser only. |
| I03 | Cross-company references are rejected atomically, even when both IDs exist; no partial version/head/audit write remains. | Direct DB and API negative requests with before/after state counts. |
| I04 | Revoked membership denies subsequent reads, writes, history and replay; ordinary member cannot perform manager-only writes. | Real membership mutation in disposable synthetic database then reuse existing API identity. Concurrent mutation/read-write boundary examined. |
| I05 | Corrections append versions, preserve predecessor bytes and link history; stale or concurrent successor requests cannot overwrite a newer version. | Two successful versions, old version hash/readback, conflicting request and concurrent transaction tests. |
| I06 | Idempotent identical retry returns the original outcome; changed body/actor/target under the key cannot silently reuse a result. | Actual requests and unchanged counts after rejected replay. |
| I07 | Unknown, No with reason and not applicable remain distinguishable. Blank unknown never becomes zero; reasons and original fields survive exact readback. | Round-trip valid cases and invalid No-without-reason rejection; native DB entrypoint validation examined. |
| I08 | General setup supports non-California facilities, entities/relationships and reporting boundaries without fixture-only assumptions. Invalid periods/references fail clearly. | Valid synthetic multi-state input plus invalid boundary/reference cases. |
| I09 | M71/M78/M80 versions, fixture admissions, audit histories and four held methods remain unchanged. No SQLite import pipeline or prototype feature is introduced. | Exact pre/post legacy row fingerprints, migration review and frozen-prototype diff. |
| I10 | Public executable function grants/default privileges do not expose write functions to unintended actors; SECURITY DEFINER ownership/search path safe. | Native ACL inspection and direct rejected calls; architecture review. |
| I11 | Returning read reconstructs persisted state after connections reopen; data is in Postgres rather than process memory. | Close/reopen API/database object and exact readback. Server restart and real sign-in remain separate hosted gate. |
| I12 | Exact reviewed source set is known; integrated existing regressions pass or failures are identified. | SHA-256 manifest before/after checks; relevant legacy/native/API suites. |

## Hosted and later-increment gates

These remain unpassed until their own evidence exists: fresh hosted backup and restore rehearsal before schema change; hosted preservation/recovery and documented rollback; actual invitation/session/revocation with two synthetic identities; signed-in browser journey including all 15 Bayline fixes; sign-out/sign-in and real server restart; company-scoped original evidence bytes, size/type/hash/quarantine, orphan recovery and duplicate reuse; downloads, exports and jobs under tenant authorization; shared plan/readiness logic and its original tests; live board walkthrough. Disabled or absent routes must not be reported as tested storage/export/job isolation.

No hosted mutation, deployment, customer data, method/factor release or public invitation is authorized to this reviewer. A local foundation pass cannot establish completion of the board brief or customer readiness.
