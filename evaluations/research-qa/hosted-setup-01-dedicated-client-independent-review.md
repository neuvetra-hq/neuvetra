# HOSTED-SETUP-MAINTENANCE-DB-ADAPTER-QA-01 — independent QA/security review

Date: 2026-09-26. Reviewer: `/root/txn_runner` in independent security/reliability review mode under CEO sponsor. This execution context did not author the dedicated adapter, child, focused test or author report. It previously authored the separate transactional runner. Requested critical security route: `gpt-6-astra` / `high`; this follow-up runtime could not override or observe model, effort, token use or cost, so those remain unknown.

## Verdict

**Bounded PASS for exactly one dedicated adapter used by one schema-upgrade transaction in a fresh, externally supervised Bun process. The composed launcher remains blocked until it enforces that process boundary.**

The frozen adapter passed one-client PID/xid ownership, PostgreSQL 17 transaction-timeout enforcement, normal callback rollback, pending-query drain, permanent late-dispatch refusal, bounded teardown and an actual schema-22 to schema-23 runner integration. It is not accepted for a second dedicated adapter, reconciliation client or retry in the same process.

The source enforces one transaction per adapter instance, but it has no process-global guard against constructing a later instance. The author reproduced a second-instance timeout hang five times. My three fresh attempts did not reproduce it, including a normal adapter followed by a forced-timeout adapter under `bun test`. That makes the failure intermittent or context-sensitive; it does not close the retained evidence. A supervisor must treat a worker deadline as uncertain, kill the exact worker if necessary, and start reconciliation in a separate fresh process. No replay follows from a timeout or process exit.

## Exact frozen bytes

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-dedicated-client.ts` | `6305d5600551226d41b0c1597b67de20e988488705b38416434c55f36d712869` |
| `tools/staging/hosted-setup-dedicated-client.native.ts` | `455adf32d9fe52e1a50620bc014de44401fe5c5eb7118555ae781a55f1c9a5bd` |
| `tools/staging/hosted-setup-dedicated-client.test.ts` | `9379999166bd1a653c17467752f78c6fbb30face555b9ef5130f39c550f8af29` |
| Author report | `748d1a3be3f7dad3beccf638a0d8741d81ebe06862597a3ddad5ec7219785680` |

The candidate hashes matched before and after all review work. No candidate file was edited.

## Verified controls

### Same-client transaction and one-shot capability

The adapter creates one non-pooled `pg.Client`, attaches failure listeners before connect, checks PostgreSQL 17, sets and reads back session `transaction_timeout`, then verifies timeout, READ COMMITTED isolation and backend PID after `BEGIN`. A serialized dispatch chain keeps all root and scoped SQL on that client. Root SQL and a concurrent transaction refuse while the transaction is active. Callback return stops new dispatch before tracked pending work drains; commit or failure consumes and closes the adapter.

The rerun author test observed one PID and xid across query, multi-statement `exec`, typed parameters and the callback. It also proved that an unawaited insert finishes before commit, retained callback and root capabilities refuse after commit, and the adapter has no remaining session.

### Hard timeout, late dispatch and teardown

The supervised timeout child received PostgreSQL SQLSTATE `25P04` from the real 350 ms server `transaction_timeout`, returned `HOSTED_SETUP_CLIENT_CONNECTION_TERMINATED`, rejected two released-late SQL attempts as `HOSTED_SETUP_CLIENT_CAPABILITY_REVOKED`, and exited cleanly. Observer evidence showed zero timed-out rows, sessions and locks. The local deadline also covers BEGIN, readback, callback work, pending operations and COMMIT; teardown tries `client.end()` within a bound and then destroys only the original stream.

An independent ordinary callback-error probe inserted a row and threw text not safe for public output. The adapter returned only `HOSTED_SETUP_CLIENT_QUERY_FAILED`, rolled the row back, rejected the retained wrapper, closed idempotently and left zero adapter sessions. This distinguishes normal rollback evidence from the fatal-server rollback path.

### Actual runner composition

A fresh supervised child prepared the real schema-22 manifest in PostgreSQL 17.11, used the frozen runner, real sequence fence and frozen dedicated adapter, then invoked the existing same-transaction migration callback. The result was schema 23 with the exact `0023_company_setup.sql` marker, all four required journal statuses and zero adapter sessions. The frozen integration dependencies were:

| Artifact | SHA-256 |
| --- | --- |
| Transactional runner | `1cd07dc9789aec7f42b19c3951fde8c52844ff556e888ba0618d9b028bf719a4` |
| Sequence fence | `d48edfa567d847e55200fc6864ad20ad5d38de554c93ed0dd3c05109fc936876` |
| Snapshot/upgrade helper | `2134c09da9f5638f11c3634e272b5918c9fa78a8c090dc13852d4b92646fca11` |
| Migration API/source | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |

This proves the sequential second-instance failure does not block the single upgrade transaction when a fresh worker constructs one adapter. It does block a design that performs uncertain-commit reconciliation or any new maintenance decision by constructing another adapter in that worker.

## Sequential second-instance investigation

The author retained five PostgreSQL logs where a first adapter completed and closed, a second adapter connected and configured, then the second transaction stalled at BEGIN until the server timeout while Bun did not exit by its bound. Exact paths are listed in the author report.

Independent probes on fresh clusters observed:

- Plain supervised Bun: two successive normal adapters completed. Fixture `dedicated-client-sequential-qa-7d65b4502946411bb7481fa906ca70a5`, port 57154.
- Supervised `bun test`: two successive normal adapters completed. Fixture `dedicated-client-sequential-test-qa-fd04806053f84eb688cb37f5d8350c9c`, port 57195.
- Supervised `bun test`: a normal adapter followed by an intentionally blocked adapter received server timeout `25P04`, rejected the retained capability and exited 0. Fixture `dedicated-client-sequential-timeout-qa-3b2bb6bfc12241ae8c730fa40ef9cc97`, port 56515.

All three clusters stopped with exit 0 and status 3. These non-reproductions narrow neither the trigger nor the safe operating contract enough to overrule the repeated author failure. The source still permits the unsafe construction pattern.

### DC-QA-F01 — open P1 launcher constraint

A live launcher must enforce, rather than merely document, all of the following:

1. Spawn a new supervised worker for the upgrade.
2. Create exactly one dedicated adapter in that worker and call exactly one transaction.
3. On success or any error, exit that worker after bounded teardown.
4. If COMMIT is uncertain, independently establish original-transaction resolution and run reconciliation in another new worker with a new connection.
5. Kill a worker that exceeds the outer bound and retain the uncertain/no-retry journal; do not infer rollback or marker absence from process termination.

The adapter source itself does not provide this process-level enforcement. This finding blocks accepting a direct in-process launcher, but it does not require changing the frozen adapter before a compliant supervised launcher is implemented and independently tested.

## Checks performed

1. Frozen focused suite on a fresh fixture: **2 passed, 0 failed, 27 expectations**; Bun 1.3.12 / PostgreSQL 17.11. Fixture `hosted-setup-pg-client-E3567L`, port 62939.
2. Focused strict TypeScript: **PASS**, no diagnostics.
3. Independent callback-error rollback: **PASS**; zero rows and sessions, retained capability revoked. Fixture `dedicated-client-rollback-qa-4e1992d85b654530976b5d72d746124b`, port 53801.
4. Independent full runner integration: **PASS**; schema 23, exact marker, four journal events, zero sessions. Fixture `dedicated-client-runner-qa-a58da53626ed4420a9c654db4a3fd9a6`, port 62437.
5. Three independent sequential-instance probes: completed cleanly as described above; retained author hang remains open because it was not deterministically disproved.

Every initialized independent cluster was stopped by its exact data directory with stop exit 0 and status exit 3. No PostgreSQL or Bun child started by this review remains running.

## Preserved excluded harness failures

- A preliminary sequential wrapper used PowerShell's automatic `$args` name for its explicit argument parameter; `initdb` received no data directory and no server started. Fixture `dedicated-client-sequential-qa-a5da8839a46649d699ea73df3ef8b7cd`.
- The first runner harness used an interpolating PowerShell template, which consumed JavaScript backticks; Bun refused to parse before any database operation. Fixture `dedicated-client-runner-qa-85aecb8a05794b5d8d11e1538fbdabeb`, port 62410; the empty cluster stopped cleanly.
- The next runner harness called the operator migration API for the pinned existing project without its required reuse/containment approval. The runner failed closed as `hosted_setup_transaction_outcome_unknown_do_not_retry`; no PostgreSQL error appeared and the cluster stopped cleanly. Fixture `dedicated-client-runner-qa-8ebf963f21b84c9f837516610d99e6ba`, port 58484. The decisive adapter test used the runner's existing reviewed same-transaction migration callback on a new cluster.

None of these excluded harness outcomes is counted as candidate success or failure.

## Retained limits

- Hosted TLS/CA negotiation, real credentials, Supabase direct and transaction-pooler routing, network partitions, COMMIT disconnect timing and current provider topology were not exercised.
- The process-wide second-instance trigger remains unexplained and was not reproduced independently. A passing same-process probe is not authorization to relax the fresh-worker rule.
- Parameter arrays are copied and `Uint8Array` becomes a `Buffer`; arbitrary nested mutable JSON/array objects remain trusted caller inputs.
- Semicolon rejection is deliberately conservative and does not parse SQL grammar. Multi-statement migration batches remain confined to `exec`.
- The successful composed test used synthetic reviewed bindings and an in-memory journal. It does not authenticate restore/source/provider evidence or external durability.
- A real launcher, fresh-process reconciliation worker, complete loaded-source closure and supervisor failure injection still require independent review before any hosted action.

No provider, hosted database, ENV export, credential, deployment, restart, Git action or live migration occurred. This report grants no live execution or release authority.
