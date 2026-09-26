# HOSTED-SETUP-TXN-INTEGRATION-QA-02 — independent repaired transaction review

Date: 2026-09-26. Reviewer: `/root/source_lock_holistic_qa`, QA/security under CEO sponsor. This context did not author the runner, fence, database adapter or repair. Requested registry routing: critical gpt-6-astra/high; observed settings/cost unavailable. Only this new report was written. Candidate code, shared operations, Git, ENV and secrets were untouched. No live provider or hosted database was contacted. Native tests used newly initialized synthetic PostgreSQL 17.11 clusters bound to loopback, excluding retained port 55479.

## Disposition

**Runner and client integration: FAIL. Concrete sequence fence and server transaction-timeout enforcement: bounded native PASS.** Original F01 artifact/observer exposure, F02 invocation-time reconciliation binding and F04 obsolete writer-gate requirement are repaired. F03 now has a real server-enforced transaction deadline and verified rollback/lock release, but the installed client exhibits an uncaught error during that lifecycle. Additional path and journal-evidence defects remain.

No live stop, migration, deployment, restart or release approval follows. The independent QA1 FAIL is preserved at its prior hash.

## Exact frozen evidence

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-transactional-upgrade.ts` | `b0a53121ed4fdffb59a2d5a006ce18e65a64da8b80805def02770cc7878775d2` |
| `tools/staging/hosted-setup-transactional-upgrade.test.ts` | `30d86bc0e41b68c6aafd6dc881dba52372ef93efa0ee05d6e709491312fe8f2d` |
| `evaluations/research-qa/hosted-setup-01-transactional-upgrade-repair-author.md` | `2b2dfa3853c256c1a1e8c0fd4e29011b09d5c1f1537f786e2e6d23caa85297a7` |
| Prior `hosted-setup-01-transaction-sequence-independent-review.md` | `941658e755997b2a953af713ac977f9f52a6a3b67b6f14101a0913e61a315c36` |
| `tools/staging/hosted-setup-sequence-fence.ts` | `d48edfa567d847e55200fc6864ad20ad5d38de554c93ed0dd3c05109fc936876` |
| `tools/staging/hosted-setup-upgrade.ts` | `2134c09da9f5638f11c3634e272b5918c9fa78a8c090dc13852d4b92646fca11` |
| `packages/neuvetra-database/src/hosted.ts` | `3bd3398fe582d2cf74e6868ab7fdfcd0f7158fb1e96dce5c5b59069ed1c59e04` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |
| Installed `node_modules/.bun/postgres@3.4.9/node_modules/postgres/src/connection.js` | `ee3a218d9aa6a6f2887c1a19da50009335fe84c11a5431d5cab72d6bc528632f` |

Source/test hashes were checked before testing and after the independent native and initial adversarial probes; unchanged. All paths are relative to the managed inventory-plan-delivery/Neuvetra worktree unless stated otherwise.

## TXN-QA2-F05 — P2: relative paths bypass the absolute journal contract

`privateInput`, line 102, performs `resolve(source.journalPath)` before `validateInput` checks `isAbsolute`. The check consequently validates a generated absolute path rather than the caller's path. A relative path which resolves outside the repository is accepted and remains dependent on invocation cwd.

Independent reproduction extracted the frozen test's baseline fixture/dependencies, used actual schema 1–23 SQL in isolated PGlite, and changed only:

```ts
input.journalPath = '../qa-relative-outside.jsonl'
const open = deps.openJournal
deps.openJournal = async path => { capturedPath = path; return open(path) }
const receipt = await runHostedSetupTransactionalUpgrade(db, input, deps)
```

Observed success and schema 23. Captured path was `C:\Users\nimab\.codex\worktrees\inventory-plan-delivery\qa-relative-outside.jsonl`; input remained relative. Journal was in memory, so this probe created no output file. This is a contract bypass, not a demonstration of inside-repository writes: the external-root check still applies to the normalized path.

Repair: read raw path once, require a primitive absolute string before normalization, then normalize and enforce module-anchored external-root/real-parent policy. Retain that private validated path across every await. Add relative parent, drive-relative and cwd-change cases with zero journal/database activity on refusal.

## TXN-QA2-F06 — P2: journal callbacks can alter private evidence and operation handles

At line 218 the journal receives the live `initial.tables` and `initial.sequences` arrays. Line 228 later derives the returned receipt's `accessExclusiveTables` from `initial.tables`. An append callback can therefore alter retained private evidence after real locks have been acquired.

Independent PGlite probe changed only the in-memory append implementation:

```ts
if (event.status === 'hosted_setup_schema22_locked_and_verified') {
  event.accessExclusiveTables.length = 0
  event.accessExclusiveTables.push('never_locked_table')
}
events.push(structuredClone(event))
```

Observed actual migration to schema 23 and success receipt containing `accessExclusiveTables: ['never_locked_table']`. The table was never in the lock statement. The final relation validation still uses a separate `locked.tables` inventory, so this probe does not demonstrate loss of the actual table locks or corrupt migration. It demonstrates that successful evidence is false despite private-copy claims.

A related independently reproduced handle case: first append records reservation, then assigns `journal.append = async () => {}`. Lines 200/218/230/238 reread that method. Migration committed and returned success with only `hosted_setup_transaction_reserved` recorded. This is the ordinary handle-replacement defect already discovered in the separate maintenance helper; it remains present here.

Repair: keep relation inventory immutable privately and give journals separate immutable data or immutable serialized records; capture each append/close function once before validating/binding that same value. Preserve the reservation and every required synced event. Add both callback mutation and method/getter replacement regressions. The concrete journal must still be trusted to persist records: isolation does not prove external durability.

## TXN-QA2-F07 — P1 integration: server timeout works, installed client teardown is not clean

The runner now sets and verifies PostgreSQL 17 `transaction_timeout` in its physical transaction. The native production-budget success observed `3min`. To test lifecycle without waiting 180 seconds, QA used an in-memory module variant replacing only `HOSTED_SETUP_TRANSACTION_TIMEOUT_MS=180_000` with `...=1_200`; original import-meta anchoring and relative imports were mapped to the frozen module's real URL for execution. No candidate file was changed. Variant source text after timeout/anchor substitution had SHA-256 `219a22d955a02f48446471f3534823861b19d207af4756a5dd3c942546b25d1b`.

Both decisive native scenarios used separate fresh connection pools and the actual sequence fence, schema-22 snapshot, migration 23, preservation verification and default postgres adapter:

- **Idle callback:** after migration, the final availability observation awaited 1,700 ms. Server killed the transaction after its 1,200 ms budget while JavaScript was still waiting. Another connection subsequently observed zero matching backend sessions and zero locks. Exact schema-22 fingerprint was restored; a fresh transaction could acquire the same sequence fence. Runner reported `hosted_setup_transaction_outcome_unknown_do_not_retry` and retained reservation/locked/uncertain journal events.
- **Repeated short queries:** the final observation issued successive `select pg_sleep(0.08)` statements. Eleven completed; the next failed with `CONNECTION_CLOSED`. Server log recorded transaction-timeout termination. Exact schema-22 fingerprint and released locks were independently checked, and a fresh sequence-fence acquisition succeeded. Runner again reported uncertainty, never success or permission to retry.

For **each** case, Bun also emitted an uncaught asynchronous error from postgres 3.4.9:

```text
TypeError: null is not an object (evaluating 'socket.write')
  at nextWrite (.../postgres/src/connection.js:255:15)
```

The harness completed its explicit cleanup, but process exit was **1**. This cannot be labeled a fully passing native lifecycle. It is an observed dependency/client integration failure, not evidence that PostgreSQL failed to roll back or retain locks. Database preservation controls worked in these tests.

Next owner: CTO/database adapter owner must define and test safe handling of server-terminated connections and pending callbacks under the installed Bun/postgres combination. Preserve the no-retry journal, retire the affected connection/pool, prevent late callback SQL from being treated as a fresh authorized operation, and avoid unhandled process errors. Any driver or wrapper repair needs native regression. Do not suppress the error and call the lifecycle accepted without testing connection/session ownership.

A preliminary harness reused one client between timeout scenarios before its old callback had finished. That produced an interfering late rollback and made the second busy scenario non-isolated; it is **not** counted as passing timeout evidence. The decisive run used separate connection pools and allowed the pending callbacks to settle before inspection/cleanup. This reinforces the need to discard an uncertain operation's connection context; it is not proof that the runner automatically retries.

## Original findings and integrated criteria

| Criterion | QA2 disposition |
| --- | --- |
| F01 invocation-time restore artifacts | Repaired. Separate frozen artifact copies; native attempt to change bytes and return forged digest refused before any transaction. |
| F01 reviewed verifier/observer bindings | Repaired in tested path. Required synchronous scalar copies; frozen observer arguments; native mutation attempts failed at all three phases. Journal boundary remains F06. |
| F02 reconciliation caller-input race | Repaired. Captures digest/observer/bound transaction method before await; focused tests reject raced wrong hash and duplicate markers. |
| F03 actual whole-transaction deadline | Server control bounded native PASS; client lifecycle FAIL F07. Native rollback/session end/lock release proved with short-budget variant. |
| F04 obsolete held-writer gate | Repaired. Exact availability binding requires `databaseWritersExcluded: false`; no runtime-role connection-limit requirement remains. |
| One physical connection/transaction | Native normal run PASS: one outer transaction, identical PID 31264 before migration and through the migration adapter. |
| Lock-before-baseline and isolation | Source sets READ COMMITTED, acquires complete initial table AX locks inside actual sequence fence, rechecks inventory, then snapshots. Native competing table SELECT and sequence nextval each refused with 55P03 while held. |
| Commit/receipt reconciliation | Native successful commit marker reconciled on the same synthetic database; tests cover absent, wrong, duplicate and unresolved cases. Actual network loss during COMMIT was not injected. |
| No automatic retry | Focused consumed-journal/uncertain-commit tests PASS; every uncertain result retains no-retry semantics. Journal handle defect F06 remains. |
| Absolute external journal input | FAIL F05. Underlying default journal path/real-parent controls do not cure validation after normalization. |
| Current hosted authority and external source closure | Absent; not approved. |

The normal native run used the exact unmodified runner constant 180,000, not the short variant. It completed schema 23 through `migratePrivateStagingFromManifest` with the actual pinned SQL manifest, observed all three availability phases and reconciled the real unique marker. Evidence verifier callbacks and the source-lock wrapper were synthetic, so that run is not authentication of loaded-source closure or independent review artifacts.

## Validation and reproducibility

- `bun test tools/staging/hosted-setup-transactional-upgrade.test.ts tools/staging/hosted-setup-sequence-fence.test.ts tools/staging/hosted-setup-upgrade.test.ts tools/staging/hosted-setup-source-lock.test.ts --timeout 30000`: **40 pass, 11 skip, 0 fail, 212 assertions**. Eleven native-suite/lifecycle entries were skipped by their normal opt-in gate; they are not relabeled as part of this command's pass. This run includes 13 transactional tests and the source-lock/old-runner regressions.
- `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-transactional-upgrade.ts tools/staging/hosted-setup-transactional-upgrade.test.ts tools/staging/hosted-setup-sequence-fence.ts tools/staging/hosted-setup-sequence-fence.test.ts tools/staging/hosted-setup-upgrade.ts tools/staging/hosted-setup-source-lock.ts`: **PASS**, exit 0.
- Three independent in-memory migration probes reproduced F05, F06 inventory corruption and F06 method replacement. Initial harness import used the root package name, which did not resolve; correction used the repository's installed `packages/neuvetra-database/node_modules/@electric-sql/pglite` path. No package install or code change occurred.
- Decisive native harness reached **34 checks**, then verified cleanup; process exit 1 is preserved because of F07. SQL configuration/lock/preservation assertions passed. Exact native executable version was `170011` / PostgreSQL 17.11. Fresh fixture used trust auth only on its loopback listener with synthetic data.
- Native fixtures were initialized with `initdb`, started with `pg_ctl -h 127.0.0.1` on a randomly allocated port excluding 55479, and stopped by exact data directory with `pg_ctl -m fast -w stop`. No persistent test harness or modified module file was added; Bun transpilation/import occurred in memory.

Native fixture accounting, retained for evidence under `C:\Users\nimab\AppData\Local\Temp`:

| Fixture | Port | Outcome | Shutdown |
| --- | --- | --- | --- |
| `qa-transaction-repair2-IhswdX` | 58341 | Initial harness used `before.sequences` instead of `before.catalog.sequences`; corrected before acceptance run. | stop 0, status 3, TCP false |
| `qa-transaction-repair2-wUV0Yu` | 58352 | Preliminary same-client sequence was not isolated from pending callback; excluded as decisive busy-timeout evidence. Normal native commit succeeded. | stop 0, status 3, TCP false |
| `qa-transaction-repair2-eelNvA` | 53722 | Decisive separate-pool idle/busy timeout and normal commit run; server behavior passed, client F07 reproduced twice. | all six closes fulfilled; stop 0, status 3, TCP false |

The decisive server log contains two `FATAL: terminating connection due to transaction timeout` entries at 06:07:40.838 and 06:07:43.028 PDT. Cluster files were retained; no processes/listeners were retained.

## Remaining limits and next owner

Maintenance stopping is an availability/compatibility action. The exact single-service binding is consistent with the combined Site-Web corporate web/workspace API architecture examined in the separate maintenance QA2 report; historical chat Site-API being Online does not prove it writes corporate tables or needs stopping. Live image/route/inventory mapping, authentic availability observations and independent receipt verification are still required. No arbitrary privileged/provider-admin writer exclusion is claimed. Concurrent schema/role/security maintenance remains outside the supported operating window; own-session sequence writes remain outside rollback-safe preservation, so pinned SQL must continue avoiding them.

The external pre-import source attestor, updated loaded-module closure including runner/fence/snapshot dependencies, authenticated primary/original-transaction resolver, concrete durable journal and provider transport are not established by these synthetic adapters. A unique migration marker supports reconciliation only after the original server transaction is independently resolved on the exact primary/target. Absence does not authorize blind replay; presence alone does not authenticate reviewer identity or the original baseline.

Root/runner author: repair F05 and F06, preserve both QA FAIL reports and return frozen hashes. CTO/database adapter owner: resolve F07 with native lifecycle evidence and an explicit dead-connection/pending-callback policy. Independent QA should then recheck the affected boundaries and composed launcher/transport before any hosted execution proposal. No live authority is granted here.
