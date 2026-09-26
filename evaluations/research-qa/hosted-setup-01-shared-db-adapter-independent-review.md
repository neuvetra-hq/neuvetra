# HOSTED-SETUP-SHARED-DB-ADAPTER-QA-01 — independent QA/security review

Date: 2026-09-26. Reviewer: `/root/txn_runner` acting as independent QA/security under the CEO sponsor. This execution context did not author the shared adapter, either reviewed test, the native harness or dependency changes. It previously authored the separate transactional runner, which is outside this candidate. The sibling's completed task final is the author handoff; no separate handoff file was posted. Requested critical QA route: `gpt-6-astra` / `high`; observed model, reasoning effort, token use and cost are unavailable.

## Verdict

**PASS, bounded to the frozen local shared-adapter candidate on Bun 1.3.12 and PostgreSQL 17.11.** The adapter acquires a `pg` pool client before `BEGIN`, keeps transaction SQL on that one client, revokes the callback capability before completion, drains already-dispatched work, destroys unsuccessful clients and allows healthy reuse only after confirmed `COMMIT`. Fresh native checks passed exclusive ownership, fatal/late-callback revocation, pool reuse, two-company RLS behavior, rollback independence, byte/JSON/array/numeric/date encoding and teardown.

This is not a live-hosted or composed-migration acceptance. No cross-tenant disclosure or corruption was reproduced against the prior local adapter, so this report does not claim that a demonstrated exploit was fixed. It establishes the tested behavior of this candidate under synthetic local concurrency and failure injection.

## Exact reviewed bytes

| Artifact | SHA-256 |
| --- | --- |
| `packages/neuvetra-database/src/hosted.ts` | `842055547bea75f6aeaf6ec7c2396da90b889631e21705854c3df08e20a2d30c` |
| `packages/neuvetra-database/src/hosted-adapter-native.test.ts` | `3256df547d2c8d9f77b9b4988f0c759c8a92677f0e69f33dc681a9c8fdcc89b7` |
| `packages/neuvetra-database/src/hosted.test.ts` | `4d86d6ff965a1e52f53eb8d214183259d2f05324178b3db6b0c3637bea2fd830` |
| `packages/neuvetra-database/src/hosted-adapter-native.ps1` | `1cd687babef94c04c5d240cae8fc75c7ed6de02283f549f2d3f9550614aa2acb` |
| `packages/neuvetra-database/package.json` | `69c99f9e0416530779416e61777f8e0c8edab475134fad311e25138cdc98c278` |
| `bun.lock` | `aa299ff0876bd7306ddef7c147596b433161f403cddab82668df6d2835f2afeb` |
| Research report | `36528c8f0109406abac56b12498312d4c723fe1d428928049cd4d5c59a8c8b3e` |

The three requested candidate hashes matched before review and again after every test and probe.

## Control findings

### Exclusive physical ownership and healthy reuse

Source inspection confirms `pool.connect()` completes before the adapter sends `BEGIN`; transaction queries use the leased `PoolClient`, and no transaction statement uses `pool.query`. The scoped wrapper closes over one client and one `usable` flag. It is revoked before pending work is drained and before `COMMIT`.

The author suite exercised actual schema 23, the `neuvetra_runtime` role and RLS with pool sizes 1 and 3. The independent native probe held a max-one transaction open, confirmed a root query remained queued, observed the same PID throughout the transaction, then observed the reused PID with a null transaction-local subject after commit. The retained transaction wrapper rejected both after healthy commit and after fatal failure.

### Fatal paths, late callbacks and teardown

Author tests separately terminated an idle transaction backend, terminated an active `pg_sleep`, triggered PostgreSQL `transaction_timeout`, closed a never-settling callback and verified replacement pool capacity. The independent probe triggered a 150 ms server transaction timeout while the callback was blocked in JavaScript. The outer transaction rejected within the 2.5 second test bound; its inserted row rolled back; the old PID was not reused; the replacement connection had no subject; a later callback write rejected before dispatch; and neither the original nor late row existed.

The adapter races active work against client error/end and local close signals, removes and destroys failed leases, and does not reconnect to issue rollback on a dead client. Successful rollback after callback error also destroys the lease conservatively. All decisive clusters reported `STOP_EXIT=0`, `STATUS_EXIT=3`, and no retained listener.

### Tenant and value behavior

The author suite used the real hosted migrations and runtime role for two companies, interleaved reads/writes, outsider refusals, forced tenant-session termination, rollback independence and subject clearing. The independent probe added 40 interleaved RLS transactions with two subjects, confirmed each saw only its own company, and received SQLSTATE `42501` for cross-tenant inserts. This is local synthetic evidence, not evidence of a prior exploit or the current live deployment.

Both author and independent checks round-tripped `bytea`, nested JSON, arrays including nulls, a numeric value beyond JavaScript integer precision, bigint, date-only text and a millisecond timestamp. `query()` rejects multiple result sets, while `exec()` accepts the reviewed multi-statement use. The independent close check found zero other `application_name='neuvetra-m63'` sessions after both runtime pools closed.

### Narrow legacy-test change

The reviewed legacy test still performs the same injected callback rollback and checks the exact `injected rollback` message. Its assertion now awaits the helper directly instead of using Bun's asynchronous rejection matcher. No behavior assertion was removed. The full legacy native suite passed 9 tests and 124 expectations on a fresh cluster.

The preserved author evidence explains the narrow change: the earlier matcher stalled callback progression until pool connection timeout, followed by a Bun segmentation-fault report, while another preliminary run reused a cluster and collided on the global `neuvetra_runtime` role. The final candidate keeps the adapter bytes unchanged and uses fresh clusters plus direct awaited settlement. These are test-harness/runtime failures, not passing candidate evidence, and remain recorded at `C:/Users/nimab/AppData/Local/Temp/shared-adapter-author-ee668affdc714f9cafb1f89cc3c786ea`.

## Checks and retained evidence

1. Fresh author shared suite: **11 passed, 0 failed, 391 expectations**. Fixture `shared-adapter-shared-b497bd3805f14b139963e5a4e2d5a6d2`, port 51807; stopped cleanly.
2. Fresh legacy hosted suite: **9 passed, 0 failed, 124 expectations**. Fixture `shared-adapter-legacy-bfa8178ed8354c95a70e84a032ebd23d`, port 51877; stopped cleanly.
3. Independent corrected native probe: **PASS, 97 checks**, including exclusive PID ownership, pool exhaustion, RLS, fatal timeout, late callback, replacement PID, exact values and zero remaining adapter sessions. Fixture `shared-adapter-qa-c3de322a28044de7aaff356862ad7d7c`, port 63723; stopped cleanly.
4. Company-setup compatibility suite: **6 passed, 0 failed, 37 expectations**.
5. Focused strict TypeScript: **PASS**, no diagnostics.

The first independent native probe is preserved as excluded evidence. It stopped on reviewer SQL `... $6::date day ...` with PostgreSQL `42601`; the adapter surfaced the syntax error and the fixture shut down cleanly. No lifecycle conclusion was drawn from it. Fixture `shared-adapter-qa-adbdd769100f4e4e90f779c03d105f6f`, port 63698. The corrected probe changed only the alias to `calendar_date` and ran on a new cluster.

## Residual limits

- Native tests used loopback trust authentication with `tls: false`; no real certificate chain, hostname verification, Supabase pooler/direct endpoint, credential rotation, network partition or hosted failover was exercised.
- The exact postgres.js #1189 backpressure trigger was not reproduced. The candidate avoids that transaction implementation by using exclusive `pg@8.23.0` clients; this does not establish a general finding about every driver or deployment.
- The legacy suite emits pg's future-v9 deprecation warning when existing application code issues parallel queries on one client. Pinned pg 8.23.0 passed; a pg major upgrade requires explicit serialization or new validation.
- The adapter retains `postgres@3.4.9` as an installed dependency for other preserved code/evidence even though `hosted.ts` no longer imports it. Dependency removal and the incidental lockfile resolution noted by the author require separate publication review.
- `query()` discovers a multi-result statement only after PostgreSQL executes it. Callers remain trusted to use `exec()` for reviewed batches; this check is not a SQL authorization boundary.
- The composed schema-22 to schema-23 runner, uncertain-COMMIT resolution, source closure, provider stop, live topology and release gates require their own integrated review. This report grants no hosted database, provider, deployment, restart, migration or release authority.

No reviewed source or test was edited. No provider, live database, ENV export, secret or Git action occurred. Only this report was written.
