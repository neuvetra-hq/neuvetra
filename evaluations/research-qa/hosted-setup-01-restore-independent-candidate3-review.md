# HOSTED-SETUP-RECOVERY-QA-03 — Candidate3 independent review

2026-09-26. **PASS for the bounded synthetic recovery helper and new separate-runtime execution path. No live backup, actual hosted archive restoration, provider recovery or migration is established or authorized by this review.**

Reviewer: `/root/hosted_recovery_qa`, independently dispatched critical Head of QA; no authorship of product helpers or author tests. Requested gpt-6-astra/high; inherited observed model/effort, tokens and cost unknown. Read Candidate3 handoff, eight-entry freeze manifest, changed backup/core and unchanged restore/I/O dependencies; compared them with the previously reviewed Candidate2 design and preserved original FAIL. All eight Candidate3 entries and supplied manifest digest matched before testing and at completion. Candidate2's accepted review and Candidate1's failed review hashes remain unchanged.

## Evidence-backed dispositions

| Boundary | Independent observations and disposition |
| --- | --- |
| Operator cannot SET ROLE | Fresh native fixture operator `postgres` was NOSUPERUSER/BYPASSRLS with no runtime membership. Actual `SET ROLE neuvetra_runtime` returned SQLSTATE 42501. Backup with a separate restricted runtime login then succeeded. No role/membership grants were added to circumvent the restriction. |
| Restricted runtime identity | Direct current/session readback both returned `neuvetra_runtime`. The helper rejected a privileged session using SET ROLE and rejected a restricted session with `row_security=off`. Author rerun separately rejected the wrong login. Core lines 69-74 require read-only repeatable read, row security on, and no superuser/BYPASSRLS/create-role/create-db/replication flags. |
| Same exported snapshot | Independent instrumentation recorded both runtime transactions importing the token before their first SELECT. The actual dump token hash matched the encrypted bundle's token digest. A real numeric update committed after first capture but before pg_dump; the restored database retained the original exact value while the current source had the new value. This verifies consistent historical state, not source freshness. |
| Database/project/marker binding | Core compares database name/OID, server address/port/version, marker OID and current snapshot fingerprint, with a source-verified fixed project. Independent wrong-marker substitution was refused; the author rerun rejected wrong project/database, wrong token digest and a different live snapshot. Runtime marker SELECT was absent in the independent fixture; source verification plus imported identity still bound the probe without granting extra access. |
| Forged/expired snapshots | Independent token injection, well-shaped nonexistent token and token after exporter transaction completion all failed with their expected fixed error codes. The author rerun also covered a changed hash and different still-live snapshot. |
| Denied table without transaction error latch | Independent source had an alphabetically first denied table and a denied marker. Both actor observations were recorded as `select-privilege-denied`. Later company/member and all-column-granted numeric-table reads succeeded, and actual restore comparison passed. The helper does not issue an intentionally denied table query or rely on manually rolling back a postgres.js savepoint error. |
| Genuine permission/policy error | An independently created RLS policy function raised actual SQLSTATE 42501 on an otherwise readable table. The entire backup failed with `HS_RECOVERY_TENANT_PROBE_FAILED` before its dump callback; no archive or receipt existed and its exclusive reservation remained. This is not falsely classified as a grant-denied table. |
| Tenant leak | Disabling RLS on the numeric table exposed the member company's row to the outsider; the separate-runtime probe refused with `HS_RECOVERY_TENANT_PROBE_FAILED`. Positive member company visibility and outsider expectations remain mandatory. |
| Idle/deadline | Independent transaction readback observed exactly 120 seconds for the source's local idle timeout. Source validation caps the configurable execution deadline at 300,000 ms and rejects invalid/unbounded values; hosted mode requires a cancellation hook. Independent shortened deadlines used real local PostgreSQL children, not only mocked timers. |
| Child termination and confirmation | With a 1,000 ms execution budget, confirmed cancellation returned `HS_RECOVERY_BACKUP_DEADLINE_EXCEEDED` after **1,030 ms**. Abort was observed, cancellation was called, and `await child.exited` completed with SIGTERM. A second run deliberately left the cancellation hook unresolved after reaping its child; the helper returned `HS_RECOVERY_BACKUP_CANCELLATION_UNCONFIRMED` after **6,026 ms**, exercising the bounded five-second grace. Both had no archive/receipt and retained reservations. |
| Preservation | Independent actual PG17 dump, CurrentUser DPAPI seal/unseal, absent-target pg_restore and source comparison passed with separate source/runtime roles, denied tables and column-only grants. Exact direct restored numeric readback matched the exported source. Author-native rerun retained the earlier precision, nested JSONB, empty-table, duplicate, sequence, policy, unsupported relation, target/role/hash, occupied-target and replay checks. |

Relevant implementation: `tools/staging/hosted-setup-backup.ts:18-52` contains reservation/deadline/cancellation handling, lines 55-70 establish source identity and the shared token, and lines 74-85 gate encrypted output. `tools/staging/hosted-setup-restore-core.ts:63-82` validates/imports the runtime snapshot and current/session identity; lines 86-122 distinguish grant absence from actual query/policy failures. Lossless PostgreSQL row text and unsupported-relation refusal from Candidate2 remain in place. Auth recovery remains referenced UUID stubs and the UID function only.

No blocking defect was observed within the reviewed boundaries. Cancellation, endpoint identity and actual data-preservation claims remain limited to the concrete synthetic cases and stated caller contract.

## Execution and preserved attempt history

Workdir: `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra`; Bun 1.3.12; independent native server version readback **PostgreSQL 17.11**.

- `bun test evaluations/research-qa/hosted-setup-01-restore-author-candidate3.test.ts`: **5 pass, 0 fail, 19 expectations**.
- `bun evaluations/research-qa/hosted-setup-01-restore-author-candidate3-native.ts`: **46 named checks passed** on a fresh disposable native cluster.
- `bun evaluations/research-qa/hosted-setup-01-restore-independent-candidate3-native.ts`: final frozen probe **20 named checks passed**, including the distinct policy-error and unconfirmed-cancellation cases above. Output was `independent-candidate3-pass`, `hostedAccess:false`, `providerAccess:false`.

The first independent launch failed before database work because port 55479 was temporarily occupied by another authorized synthetic test. Its own server log recorded bind refusal and shutdown; QA did not touch the occupying cluster. Root coordinated port release, and a new attempt was used. The next independent run reached confirmed child cancellation but failed a QA assertion requiring a numeric child exit code. A signal-killed Bun child legitimately reported `exitCode:null, signalCode:SIGTERM`; the test was corrected to require a real spawned child and completed `await child.exited`, then the complete final run passed. This was a QA-harness correction, not a product-code change. Both histories remain recorded rather than claiming a first-pass independent run.

Every started independent cluster was stopped in `finally`; synthetic temporary files were retained without deletion. No hosted credentials, ENV, actual hosted archive, provider, Git, shared operational records or product code were accessed or modified by QA. Commands used narrowly scoped local-synthetic execution permissions.

## Exact reviewed bytes

Candidate3 manifest SHA-256: `0fbba321381921a097daa4704fd7b47f1fe025c3b4816c2870b7b769abae9934`.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-restore-core.ts | 3add141768b2bde620627148bba5311c8689f19cf078ad8b23fe51417d92fc6b |
| tools/staging/hosted-setup-backup.ts | 4ceeddd0f8e1021e5f65492b30ee08dc21fab409b5b01f8e40cbf26c5f74e66f |
| tools/staging/hosted-setup-restore-io.ts | 6eb5f90da057e302bbc8ad91c81933e748ce8705b699bed53838aba5d451da71 |
| tools/staging/hosted-setup-restore.ts | abf30e15c57b865e43563c8ad4c0a8f6bc79167804493f3fe8338997ed3271f0 |
| evaluations/research-qa/hosted-setup-01-restore-author-candidate3.test.ts | 9bf27c6f6a8d6d54362b5504e71c3560dbdb81190737013a55672a509ef7577e |
| evaluations/research-qa/hosted-setup-01-restore-author-candidate3-native.ts | 52bbcb2ff049466ffc8e671e2500722812c1d1afca57ca7c7d242c0787be5859 |
| evaluations/research-qa/hosted-setup-01-restore-author-candidate3.md | 2e27d2d644e757437e7ad50614e388c1636215f6528744454814494b6ae6de4a |
| tools/staging/m78-inventory.ts | ea93686812910082438bf8ecfd9ef8756dddd6048897d369a494e0fdd700f40a |
| evaluations/research-qa/hosted-setup-01-restore-independent-candidate3-native.ts | b13a462e1bfb39724dc8ecc22d10b86d2c1a43c21f51a4f8a014277b5321ceff |
| evaluations/research-qa/hosted-setup-01-restore-independent-candidate2-review.md | 5a3f0283bf7ef4341e49d0d1287c06b29f0b31f650e978e2e102657c796d1b18 |
| evaluations/research-qa/hosted-setup-01-restore-independent-review.md (original FAIL) | baa496270a74ac24a9f1941114a0c66de53557bd7705cc55250db062d2acafe1 |

## Limits and root handoff

The timer starts after durable reservation. The configured backup execution deadline is at most 300 seconds; cancellation confirmation may consume up to five additional seconds. This is not a hard claim that every call, initial filesystem operation or process cleanup returns within 300 seconds. The independent probes shortened the execution budget rather than waiting a full five minutes. Source and runtime connections are consumed on timer expiry and must not be silently reused.

No-output evidence applies to the tested policy, dump and deadline failures **before encrypted publication**. Archive/receipt writes are separate durable steps: late filesystem errors, publication races, abrupt process death or expiry during output can leave partial or ambiguous files. Such files are unaccepted, remain associated with the consumed reservation and require reconciliation; do not infer success from their existence or delete evidence to replay. Disk-full, process-kill and output-publication races were not injected.

Root must independently review the exact hosted source/runtime/dump endpoint binding, TLS CA/hostname, pinned client and source dependencies, actor/company scope, private output paths and error sanitization. The helper does not acquire credentials or validate caller connection URLs. In particular, bind `dump(token, signal)` and `cancelDump` to the **same** concrete pg_dump child and await idempotent reaping; a callback's existence alone does not establish that implementation. The native sleeping-child tests establish behavior under correct/rejected test hooks, not correctness of a future hosted transport. An unconfirmed cancellation remains quarantined with no retry until actual process/connection state is reconciled.

A shared snapshot proves historical consistency and does not freeze current-world writes or establish freshness. The independently observed committed-write test intentionally demonstrates that distinction. Actual maintenance/quiet-window controls remain separate, including for sequence state. Each future paired backup and actual local restore requires its own evidence and independent acceptance. Do not revive a consumed failed attempt or transplant Candidate2/Candidate3 review onto unrelated archive bytes.

Changing denied-read evidence to `select-privilege-denied` is deliberate and truthful; it is not proof that a denied SELECT was executed and returned 42501. Old state evidence must pass exact comparison under its applicable reviewed version, not be manually relabeled. Full API/storage/export/job tenant isolation, provider Auth/accounts/sessions/configuration/storage recovery, schema23 upgrade, deployment and board demonstration remain outside this verdict. Root owns integration, ledger updates and any later authorized hosted work.
