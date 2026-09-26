# HOSTED-SETUP-RECOVERY-02 — Candidate3 author handoff

2026-09-26. Data/database critical route requested gpt-6-astra/high; observed model/effort/cost unknown. Synthetic implementation and tests complete; independent re-review required before hosted use.

## Problem and change

Root's bounded live diagnosis found the operator could read the application but could not SET ROLE to neuvetra_runtime. The refused attempt produced no archive and its reservation remains consumed. Candidate3 adds a separate restricted runtime connection without changing credentials, memberships, provider configuration, the root transport or any ledger. Local restore continues to use the existing superuser SET ROLE path.

Only two helper files changed: `tools/staging/hosted-setup-backup.ts` and `tools/staging/hosted-setup-restore-core.ts`. The restore runner, DPAPI transport and prior author/QA artifacts remain unchanged. Profile v2 and lossless row encoding remain the same: this is an additive execution-path change, not weaker content evidence.

New optional `BackupInput.runtimeConnection` accepts an already-created `WorkspaceConnection` to the same endpoint/database. The backup itself exports the snapshot token and captures its source identity. For each runtime capture, the helper starts a read-only repeatable-read transaction and imports that exact token **before the first SELECT**. It compares database name/OID, server address/port/version, project-marker OID and PostgreSQL snapshot fingerprint with the privileged source. It requires current_user **and** session_user to equal neuvetra_runtime, row security on, and no superuser/BYPASSRLS/create-role/create-db/replication flags. A privileged login merely SET ROLE to runtime is rejected.

Root's source marker is verified before exporting. When runtime already has SELECT on the marker, it must independently see the same single project/profile row. Otherwise, the verified project is bound by the same database/marker OIDs, server identity and imported snapshot; the helper adds no grant. All actor probes use the restricted current user. No connection URL or token plaintext enters public receipts; only the existing snapshot-token digest is archived.

### Runtime privilege denial

An additional native test discovered postgres.js retains a transaction error even after manually issued SQL ROLLBACK TO SAVEPOINT. A deliberately denied marker SELECT therefore caused an author test failure after the initial Candidate3 full run had passed. Candidate3 now checks effective table-or-all-column SELECT privileges before probing a table. An unavailable read is explicitly recorded as `select-privilege-denied`, not falsely described as a caught SQLSTATE. Actual allowed-table reads still exercise RLS and hash exact PostgreSQL row text; unexpected permission/policy/query errors abort the whole attempt. This also removes two savepoint round trips per table. The failing attempt and repair are preserved here.

### Bounded lifecycle and integration contract

The source transaction sets `idle_in_transaction_session_timeout` locally to 120 seconds after declaring isolation/read-only. The whole backup has a maximum 300,000 ms deadline; `maxDurationMs` may shorten it to at least 50 ms. Runtime transactions do not extend this deadline.

The dump signature is now `(snapshotToken: string, signal?: AbortSignal) => Promise<Uint8Array>`. Hosted mode additionally requires `cancelDump?: () => void | Promise<void>`. Root must bind both to the same child process, terminate it on abort/cancel, and reap it idempotently. On expiry, the helper aborts the signal, closes the caller-supplied source/runtime connections and invokes cancelDump. It waits at most five further seconds for cancellation/reaping. Success is never returned after expiry. `HS_RECOVERY_BACKUP_CANCELLATION_UNCONFIRMED` means cancellation failed or exceeded that grace: quarantine the consumed attempt and reconcile, do not retry. Ordinary deadline completion uses `HS_RECOVERY_BACKUP_DEADLINE_EXCEEDED`. Caller connections are consumed after timeout and must not be reused.

Activity checks occur before/after provider phases and before encrypted outputs. The native deadline and dump-failure tests produced neither archive nor receipt and retained their exclusive reservation. Disk-full/process-kill/publication races are not fault-injected; any partial output or ambiguous completion is unaccepted and must be reconciled against its consumed reservation. No plaintext dump/snapshot file is introduced.

## Observed verification

- `bun test evaluations/research-qa/hosted-setup-01-restore-author-candidate3.test.ts`: **5 passed, 0 failed; 19 expectations**. Includes hosted cancellation requirement and rejection of unbounded/invalid deadlines before reservation.
- `bun evaluations/research-qa/hosted-setup-01-restore-author-candidate3-native.ts`: **46 named checks passed** on fresh disposable PostgreSQL17.11 clusters, including actual DPAPI backup/restore. Final rerun after the bounded cancellation/reaping refinement passed. Each native run stopped its own cluster; synthetic temporary files were retained outside the repository.

Native fixture operator `postgres` is NOSUPERUSER/BYPASSRLS and demonstrably cannot SET ROLE to runtime. The old path actually returns 42501. The new path uses a separate restricted runtime login, and local restore still passes through SET ROLE. A real numeric update commits between first capture and pg_dump; runtime probes, dump, second capture and restored content all remain bound to the original exported snapshot. Exact source-local idle timeout of 120 seconds was read back from the transaction.

The suite rejects token injection, wrong token hash, well-shaped nonexistent token, a different live snapshot, an expired exporter token, wrong login, SET ROLE impersonation, wrong project/database/marker binding and actual cross-company exposure. It verifies the no-marker-SELECT boundary without granting extra access. A shortened 1.5-second deadline terminates and reaps a real local sleeping PostgreSQL child, consumes the reservation and leaves no archive/receipt; a separate dump-failure case does likewise. Prior precision, nested JSONB, duplicate/empty-table, unsupported view/materialized/foreign/partitioned/inherited surface, wrong archive/hash/role/target, occupied target and no-replay checks all pass.

No hosted database, credentials, ENV export, real archive, Railway variables or provider operation was accessed by this worker. Root independently owns endpoint/TLS/tool pinning, the caller transport and actual hosted execution. This candidate does not prove source freshness, full provider/Auth recovery, API/storage/export/job isolation, migration safety or a hosted demonstration. Auth reconstruction remains referenced UUID stubs and the UID function only. Same-snapshot consistency remains distinct from current-world freshness.

Freeze manifest: `hosted-setup-01-restore-author-candidate3-hashes.json`. It binds the two changed helpers, unchanged restore/DPAPI helpers, Candidate3 tests/handoff and legacy inventory dependency. Root owns independent review, integration and status.
