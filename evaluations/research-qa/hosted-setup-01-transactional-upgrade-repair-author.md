# HOSTED-SETUP-TXN-RUNNER-REPAIR-01 — author handoff

Date: 2026-09-26. Author: `/root/txn_runner`, software engineering under CTO. Requested compute: `gpt-5.6-sol` / `high`; observed model, effort, token use and cost unavailable. The frozen Candidate 1 sources and independent FAIL remain preserved by their recorded hashes. This repair changes only the transactional runner and its test and adds this report.

## Disposition

F01–F04 are repaired in a new inert local candidate. No import-time behavior, launcher, provider client, credentials, hosted database connection or live authority was added.

### F01 — private evidence and callback boundaries

The runner now captures every input primitive and each artifact's bytes/digest before its first await, freezes the retained copies, and passes separate frozen artifact copies to synchronous verifiers. Restore, publication and maintenance verifier results are copied field-by-field as required primitive scalars and frozen before any later callback. Dependency method references are captured once. The availability observer receives a fresh frozen scalar-only binding copy at each phase and must return serialized JSON whose decoded value is strict `true`. The pinned migration result must also be serialized before its promise resolves.

Targeted tests attempt to rewrite frozen artifact bytes/digests and rebind the restore digest, mutate the input while current-head observation is pending, replace the observer getter, and flip the observer's maintenance copy. Rebinding is refused before journal/database work; the pending-input and frozen-observer cases retain the original evidence.

### F02 — uncertain-COMMIT reconciliation

Reconciliation copies and validates profile, project, expected migration digest, resolution observer and bound transaction method before awaiting resolution. It then uses only those retained values. After strict-true resolution it verifies the exact staging target and profile in one transaction before reading the unique schema-migration marker. Tests cover absent, present, wrong-hash, duplicate and across-await mutation/getter replacement cases. Every result remains `noAutomaticRetry: true`.

### F03 — server transaction deadline

The transaction now sets PostgreSQL 17 `transaction_timeout` to 180,000 ms at transaction entry in addition to the existing 30,000 ms lock timeout and 180,000 ms statement/idle-in-transaction timeouts. It immediately reads `current_setting('transaction_timeout')`, converts it to milliseconds and refuses unless the observed value is exactly 180,000. The real migration test also reads and asserts that setting from the same transaction before entering the fence operation.

This is server-side transaction termination, not a JavaScript `Promise.race`. A concrete connection adapter still must surface a server-terminated session to the caller; a callback that never settles in JavaScript was not held open for 180 seconds in the local suite. Independent native QA should use a short-budget test variant or transport fixture to observe server rollback, connection termination and released locks.

### F04 — availability-only maintenance stop

The old `HeldApplicationWriteGate`, runtime-role limit and all-writer/provider-admin exclusion contract is removed from this runner. The replacement verifier must synchronously authenticate pinned stop receipt/review evidence into `neuvetra.hosted-setup.reviewed-maintenance-stop-binding.v1` for the exact Railway project, environment, service, deployment, commit and region, zero replicas, distinct operator/reviewer and zero open material findings. It requires `availabilityStopObserved: true` and `databaseWritersExcluded: false`. Fresh serialized strict-true observations are required before the transaction, under lock before migration and under lock before commit. Tests reject target drift and any claim that the availability stop excludes database writers.

Preservation remains grounded in the database transaction's concrete sequence fence, complete existing-table `ACCESS EXCLUSIVE` locks, under-lock fingerprint and post-migration verification. The runner makes no global provider-admin or privileged-DDL exclusion claim.

## Exact repair bytes

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-transactional-upgrade.ts` | `b0a53121ed4fdffb59a2d5a006ce18e65a64da8b80805def02770cc7878775d2` |
| `tools/staging/hosted-setup-transactional-upgrade.test.ts` | `30d86bc0e41b68c6aafd6dc881dba52372ef93efa0ee05d6e709491312fe8f2d` |

Frozen review/dependency hashes rechecked unchanged:

| File | SHA-256 |
| --- | --- |
| `evaluations/research-qa/hosted-setup-01-transaction-sequence-independent-review.md` | `941658e755997b2a953af713ac977f9f52a6a3b67b6f14101a0913e61a315c36` |
| `tools/staging/hosted-setup-sequence-fence.ts` | `d48edfa567d847e55200fc6864ad20ad5d38de554c93ed0dd3c05109fc936876` |
| `tools/staging/hosted-setup-upgrade.ts` | `2134c09da9f5638f11c3634e272b5918c9fa78a8c090dc13852d4b92646fca11` |

## Validation

- Focused transactional suite on Bun 1.3.12: **13 passed, 0 failed, 64 expectations**. It executes the actual schema 1–22 baseline and migration 23 under PGlite for success, rollback and uncertain-commit cases.
- Combined transactional, sequence-fence, old-runner and source-lock suites: **40 passed, 11 skipped, 0 failed, 212 expectations**. The 11 opt-in native sequence tests were skipped in this command; their prior separate native result is not relabeled as part of this repair run.
- Strict TypeScript across all four scoped sources and tests: passed with no diagnostics.
- Scan of the repaired source/test found no ENV, credential, network or provider access.

## Remaining integration limits

The reviewed maintenance binding verifier, concrete provider availability observer, primary-authenticated uncertain-transaction resolver, durable external journal path and runtime loaded-source closure remain unimplemented integration work. The root-authored maintenance helper was used only as a receipt-shape reference; this runner does not import it or establish its independent acceptance. A new source closure must pin this repaired runner, the concrete sequence fence and the previously changed snapshot source. Native PostgreSQL must independently repeat the integrated one-connection migration, adversarial evidence tests and transaction-timeout lifecycle. Concurrent privileged DDL/security maintenance remains an explicit operating exclusion. No Git, provider, hosted database, ENV, deployment, PR or publication action occurred.
