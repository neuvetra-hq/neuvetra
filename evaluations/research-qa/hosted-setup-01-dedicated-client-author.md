# HOSTED-SETUP-MAINTENANCE-DB-ADAPTER-01 — bounded author result

Date: 2026-09-26. Role: data/database specialist under CTO. Requested registry route: critical `gpt-6-astra` / `high`; observed model and effort unavailable. Dispatch prompt SHA-256: `9f5a9ec9fb9c99d0cb0352fed641e77c97c6b388b6793706603628900d8a457e`.

## Disposition

**Bounded PASS for one dedicated `pg.Client` in one supervised, single-use process. Not accepted for successive maintenance adapters in one Bun process.** The candidate has no pool, reconnect or release path. It validates an exact Supabase project/role/host/database/port or an explicit loopback-only synthetic target, requires a validated CA for the hosted route, supplies every connection field explicitly, attaches `error` and `end` listeners before connect, requires PostgreSQL 17, sets and reads back session `transaction_timeout`, and then verifies timeout, isolation and backend PID after `BEGIN ISOLATION LEVEL READ COMMITTED`.

The immutable transaction wrapper serializes operations, rejects concurrent root/transaction use, tracks and observes unawaited SQL before commit, converts `Uint8Array` parameters to `Buffer`, permits reviewed multi-statement batches only through `exec`, and rejects semicolon-bearing `query` text before dispatch. Callback capability is permanently revoked on return, failure, fatal error, end or deadline. The local deadline covers BEGIN, configuration readback, callback work, queued operations and COMMIT. A failure after the COMMIT path starts is classified `HOSTED_SETUP_CLIENT_COMMIT_OUTCOME_UNCERTAIN_DO_NOT_RETRY`. Public errors contain only a bounded code and optional SQLSTATE; SQL and parameters are not copied into them. Teardown is idempotent, bounded and hard-destroys the original stream after the graceful bound.

No full launcher, runner, shared application adapter, package file, lockfile, ENV export, hosted provider, live database, deployment or Git state was changed by this assignment.

## Native PostgreSQL 17 result

Final native run used Bun 1.3.12, `pg` 8.23.0 and a fresh PostgreSQL 17.11 cluster on loopback port 53784, explicitly excluding retained port 55479. It passed 2 tests and 27 expectations in 3.81 seconds. The test proved:

- one physical backend PID and xid across ordinary query, multi-statement `exec`, typed parameter work and the transaction callback;
- bytea, high-precision numeric text, timestamptz and array round trips;
- an unawaited insert completed before COMMIT;
- root queries and a second transaction were refused while the transaction was active;
- normal commit closed the adapter, and retained callback/root capabilities remained revoked;
- a separate supervised child received real PostgreSQL SQLSTATE `25P04` after the server's 350 ms `transaction_timeout` terminated an open transaction;
- the timed-out write rolled back, the adapter application had zero remaining sessions and locks, and two SQL attempts released after timeout were rejected as `HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED` before a new backend appeared;
- the child exited 0 without an uncaught asynchronous error, and explicit cluster stop succeeded.

Successful fixture log and data were retained at `C:\Users\nimab\AppData\Local\Temp\hosted-setup-pg-client-rDhmjC`. No PostgreSQL or dedicated-client Bun process remained after validation.

Validation commands:

- Targeted strict TypeScript compile of the adapter, supervised native child and focused test: PASS, exit 0.
- `bun test tools/staging/hosted-setup-dedicated-client.test.ts --timeout 30000`: 2 pass, 0 fail, 27 expectations.
- `bun test tools/staging/hosted-setup-transactional-upgrade.test.ts --timeout 30000`: 15 pass, 0 fail, 89 expectations. This is runner regression coverage; the shared runner is not yet wired to the new adapter.
- `git diff --check` on the three adapter files: PASS.

## Preserved Bun process-lifecycle failure

An earlier harness opened a normal maintenance adapter and then a second maintenance adapter in the same Bun process. The first adapter's transaction had returned after its automatic close, the observer saw zero sessions for its application name, a retained callback was refused, and two additional awaited `close()` calls returned. The second adapter then connected and completed its pre-BEGIN PostgreSQL 17 configuration. Its `transaction()` reached the BEGIN dispatch, but the pg promise did not resolve. PostgreSQL later recorded `FATAL: terminating connection due to transaction timeout`; the Bun test still did not exit at its 30-second bound. Repeating the probe reproduced the same condition. Exact retained examples include:

- `C:\Users\nimab\AppData\Local\Temp\hosted-setup-pg-client-A9uhw1\postgres.log`, server timeout at `2026-09-26 06:28:53.115 PDT`;
- `...\hosted-setup-pg-client-QtfPvD\postgres.log`, timeout at `06:30:22.526 PDT`;
- `...\hosted-setup-pg-client-XggXZk\postgres.log`, timeout at `06:32:59.038 PDT`;
- `...\hosted-setup-pg-client-ErUXjS\postgres.log`, timeout at `06:34:10.005 PDT`;
- `...\hosted-setup-pg-client-MTMuso\postgres.log`, timeout at `06:34:57.495 PDT`.

The exact orphaned Bun test processes were identified by command line and terminated; each exact disposable PostgreSQL data directory was stopped. This is a material pg 8.23.0 / Bun 1.3.12 process-lifecycle finding. The passing test therefore runs the forced-timeout adapter in a supervised child process, matching the research requirement for an isolated one-shot worker. A future live coordinator must launch the maintenance adapter and any reconciliation client in fresh supervised processes. It must never infer rollback, commit absence or replay authority from a hung second adapter. Independent QA must preserve and challenge this limitation before any hosted execution proposal.

## Frozen candidate hashes

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-dedicated-client.ts` | `6305d5600551226d41b0c1597b67de20e988488705b38416434c55f36d712869` |
| `tools/staging/hosted-setup-dedicated-client.native.ts` | `455adf32d9fe52e1a50620bc014de44401fe5c5eb7118555ae781a55f1c9a5bd` |
| `tools/staging/hosted-setup-dedicated-client.test.ts` | `9379999166bd1a653c17467752f78c6fbb30face555b9ef5130f39c550f8af29` |
| sibling-owned `packages/neuvetra-database/package.json` | `69c99f9e0416530779416e61777f8e0c8edab475134fad311e25138cdc98c278` |
| sibling-owned `bun.lock` | `aa299ff0876bd7306ddef7c147596b433161f403cddab82668df6d2835f2afeb` |
| installed `pg/package.json` | `e42dd36cba6e9dd8dbb6f773a2f7be8a8c3c273e18b155e42e75961a4cb8bc28` |
| installed `pg/lib/client.js` | `992c12d10cd42ece06b0b224601fa783a02ed08f3ace8bd8089cc441b6308abf` |

The adapter is an inert candidate until a reviewed launcher supplies the exact secret outside logs/repository, runs it in a one-shot supervised process, and independently verifies the integrated schema-22 to 23 transaction, uncertain-COMMIT resolver and complete loaded-source closure. This evidence grants no live access, migration authority, release approval, compliance claim or assurance conclusion.
