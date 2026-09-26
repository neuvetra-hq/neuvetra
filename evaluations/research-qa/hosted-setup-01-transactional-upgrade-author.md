# HOSTED-SETUP-TXN-RUNNER-01 — transactional upgrade author handoff

Date: 2026-09-26. Author: `/root/txn_runner`, software-engineering specialist under CTO. Requested registry route: `gpt-5.6-sol` / `high`. Observed model, effort, token use and cost are unavailable. Role prompt SHA-256: `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b`.

## Outcome

Implemented an inert local schema-22 to schema-23 transaction candidate. It performs no work on import and has no launcher, credentials, provider transport or live authorization. One outer `WorkspaceConnection.transaction` uses `READ COMMITTED`; the source-lock migration receives a transaction-scoped adapter whose nested transaction callback reuses that same `WorkspaceSql` connection. The runner inventories and validates safe relation names, requires `schema_migrations` and `staging_target`, takes one deterministic `ACCESS EXCLUSIVE` lock statement over every existing Neuvetra table, re-enumerates under lock, fingerprints schema 22 under lock, compares it to the accepted historical restore binding, invokes the pinned migration, verifies the schema-23 receipt and preservation, then rechecks the exact expected additive table inventory before commit.

The runner requires two integrations with no defaults: `observeMaintenanceStopped` at `before_transaction`, `under_lock_before_migration` and `under_lock_before_commit`, and `withSequenceFence(tx,{projectRef,sequenceNames,deadlineAtMs},operation)`. The fence callback encloses the table locks, both fingerprints, pinned migration and pre-commit verification. Its callback is guarded for one entry. The separate sequence-fence workstream owns the concrete implementation.

Lock timeout is 30 seconds. Statement timeout and idle-in-transaction timeout are 180 seconds, with an application deadline checked at phase boundaries and supplied to the fence. The runner makes no broad provider-admin or privileged-DDL freeze claim. A reviewed operating procedure must exclude concurrent privileged DDL and security maintenance.

The external exclusive journal is reserved before the transaction, syncs the locked preflight before migration, records verified-pending-commit inside the transaction and records resolved commit only after the outer transaction promise resolves. Any error after migration entry is `hosted_setup_transaction_outcome_unknown_do_not_retry`; no path retries. Read-only reconciliation requires strict observation that the original server-side transaction has resolved before interpreting the unique `0023_company_setup.sql` receipt. Receipt absence before that observation is rejected.

## Exact artifacts

| Path | SHA-256 | Change |
| --- | --- | --- |
| `tools/staging/hosted-setup-transactional-upgrade.ts` | `7a3e199c5a8bf34b6d0132cb87b254e777fbb0a1d163e0cf9da2b60e512daf17` | New inert transaction runner and reconciliation contract |
| `tools/staging/hosted-setup-transactional-upgrade.test.ts` | `ba9e8d51799c9b7818c2fc3fd8b5baeec303c12f656ea5e9e343387090721148` | New native PGlite and failure-path tests |
| `tools/staging/hosted-setup-upgrade.ts` | `2134c09da9f5638f11c3634e272b5918c9fa78a8c090dc13852d4b92646fca11` | Only extraction of `snapshotHostedSetupDatabaseInTransaction`; existing wrapper retains its repeatable-read/read-only transaction |

Read-only dependency hashes used by the candidate:

| Path | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-source-lock.ts` | `b52b9f1d5347976b9bcb226917b40186e08a825dc2e4b78f1efe4a951053a20c` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |
| `packages/neuvetra-database/src/migrations/0023_company_setup.sql` | `d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb` |

## Checks

- Bun 1.3.12 transactional suite: **7 passed, 0 failed, 36 expectations**. It executes migrations 1–22 and the real migration 23 in PGlite. Cases cover one outer physical transaction, exact source binding, required controls, rollback on post-state mismatch, uncertain commit, single-use/no replay, marker reconciliation only after transaction resolution, initial maintenance refusal, and a mocked stop-loss writer race before commit.
- Combined source-lock, prior runner and transactional suites on the exact listed bytes: **33 passed, 0 failed, 177 expectations**. This preserved old runner behavior and source-lock behavior.
- Strict TypeScript over the combined prior runner/source-lock/new runner sources and tests on the exact listed bytes: passed with no diagnostics.
- Secret/network scan of the two new files found no environment, credential, network or database-transport access.

## Limits and next review

PGlite validates real migration SQL and rollback semantics but does not establish native multi-connection PostgreSQL lock behavior. The mocked stop-loss race is not a native concurrent writer test. Independent QA should run the candidate with the concrete sequence fence against a disposable native PostgreSQL schema-22 clone, including blocked DML/DDL attempts, sequence activity, lock timeout, connection loss after server commit and exact transaction/connection identity.

The accepted source lock's required-pin list predates this new runner. A future launcher must include both `hosted-setup-transactional-upgrade.ts` and the changed `hosted-setup-upgrade.ts` in the reviewed runtime source pins and rebuild the source-closure digest; older attestations and publication bindings cannot be reused. The concrete sequence fence, maintenance/provider stop transport, runtime attestation, accepted evidence verifiers and durable external journal path remain integration dependencies. No Git, ENV, credential, network, provider, hosted database, deployment, PR or publication action occurred.
