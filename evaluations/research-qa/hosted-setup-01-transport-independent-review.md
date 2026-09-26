# HOSTED-SETUP-TRANSPORT-QA-01 — candidate1 independent review

Date:2026-09-26. **FAIL for hosted use: one P1 and one P2 remain open.** Reviewer `/root/hosted_qa` did not author this transport. This is an independent security/reliability review in an existing reviewer context because fresh dispatch hit the thread limit. Requested route:gpt-6-astra/high; actual inherited model/effort and cost are unknown. No provider, ENV export, archive, Git mutation or shared operations-file access/change was performed. Only this review was written.

## Exact reviewed bytes

| File | SHA256 |
| --- | --- |
| tools/staging/hosted-setup-hosted-backup.ts | 6df737b6345848030cccb8c70d93d98d41dd88f8129296c624654d2d8c049af6 |
| tools/staging/hosted-setup-hosted-backup.test.ts | 43c8f32636ffba989f0ce2a0ae6679b5ea3ace0677bd15b946e377706c700952 |
| tools/staging/hosted-setup-backup.ts | 24fdd727af8caa4ae0ccbe33b5a5d13e36322178becc0357f2cb50fcab5c219c |
| tools/staging/hosted-setup-restore-io.ts | 6eb5f90da057e302bbc8ad91c81933e748ce8705b699bed53838aba5d451da71 |
| tools/staging/hosted-setup-restore-core.ts | 5fd5eff04e81d3179f2d39bfe6900b239c96b9f46613da83a70fdbaea5b0041b |

## Material findings

**TRANSPORT-F01 [P1]: Greedy actor selection can omit every authenticated cross-company denial control.** `hosted-setup-hosted-backup.ts:39–41` skips a user when an already-selected user covers that company. If the first sorted user belongs to A+B, available A-only and B-only users are both omitted. The resulting member is authorized for both companies, while the sole outsider has no membership. A faulty policy granting every company to any member could therefore satisfy the selected control set. Representing each company in `captureAuth` does not recover the missing authenticated denial cases.

Executed reproduction used the exact selector function extracted from the reviewed source and transpiled with Bun, with an injected synthetic read-only query adapter. Sorted memberships were `(A,shared)`, `(A,onlyA)`, `(B,shared)`, `(B,onlyB)`, using distinct valid synthetic UUIDs. The selector returned only `shared→[A,B]` plus the random outsider; `exclusiveControlsSelected` was false. No provider access or production data was involved. Fix by retaining distinct membership/access profiles needed to distinguish companies, with explicit cross-company positive/negative coverage; fail closed or clearly withhold that isolation claim when the source cannot provide it. Add this overlapping-membership case to executable tests.

**TRANSPORT-F02 [P2]: Dump execution is unbounded and its lifetime is inconsistent with the source snapshot session.** `hosted-setup-hosted-backup.ts:65–66` sets only `PGCONNECT_TIMEOUT=15`; `hosted-setup-restore-io.ts:5–12` waits for both output streams and child exit without a deadline or kill/reap cleanup. A dump blocked on a relation lock or stalled after connection can keep the process running indefinitely. Meanwhile `packages/neuvetra-database/src/hosted.ts:39` configures `idle_in_transaction_session_timeout=30000`; `hosted-setup-backup.ts:24` awaits the dump without source SQL activity. A dump taking over30 seconds loses the source transaction, so the second capture cannot complete the paired backup even if the child later succeeds. This is a source-reviewed lifecycle defect, not a reproduced hosted failure. The initial informal concern that the SQL snapshot itself remained indefinitely open was corrected after inspecting the driver; the source session has the30-second server timeout. Fix with a bounded child lifecycle, termination/reaping on timeout or cancellation, and a deliberate snapshot idle lifetime consistent with the total dump deadline. Test delayed and never-completing child cases and confirm no orphan process or false success receipt.

## Controls observed and checks executed

- `bun test tools/staging/hosted-setup-hosted-backup.test.ts`: **2 passed,0 failed,6 assertions**, Bun1.3.12. Exact operator target accepted; duplicate credentials, wrong role, query options and redirected host refused. Parser testing does not exercise a hosted connection.
- Fixed pg_dump executable independently hashed to `e856d19e6b73f351069d2d3d9f442e8c0371bebfc53c7e55b455adfc0b8ee14b`; direct `--version` reported PostgreSQL17.11. Checked-in CA independently hashed to `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`. Both match transport pins.
- Source review: fixed credential/recovery paths reject realpath redirection; fixed dump path is content/version pinned. CA is content pinned. SQL and dump derive endpoint, database and project-qualified user from the same narrowly accepted URL. Source transaction verifies database, server major, operator and project marker. The exported snapshot token is syntax checked and passed as a discrete argument to pg_dump, with no shell interpolation.
- SQL uses the provided pinned CA with `rejectUnauthorized:true`; dump uses `verify-full` and the same CA. Its environment is explicitly limited, with fixed host/port/database/user/SSL settings rather than inheriting PG options. Credentials enter the child environment, not command arguments. No subprocess diagnostics or credential values are forwarded by the CLI failure path.
- The backup core reserves an exclusive attempt file before source snapshot work, writes encrypted/archive and receipt files exclusively, validates DPAPI roundtrip and sealed readback, and emits hashes/paths rather than snapshot contents. It does not automatically retry. A new invocation chooses new paths, so reconciliation remains an operator obligation; the generic failure message is not evidence reconciliation occurred.
- Actor selection precedes the repeatable-read snapshot, but in-snapshot membership/state validation detects incompatible changes rather than accepting stale membership assertions. This does not fix F01's incomplete choice of actors.

## Scope and next action

No hosted call, export parsing with actual credentials, encryption/decryption, dump or restore was performed. Private-directory ACLs, actual certificate handshake, pooler snapshot support and end-to-end transport integration remain unverified here. The separately reviewed recovery core is still being repaired; this transport verdict cannot substitute for its final integrated preservation review. Author should repair F01/F02, preserve this first verdict, and request a focused re-review of exact new bytes before hosted execution. A backup success would still require the separately accepted restore/preservation gate before upgrade.
