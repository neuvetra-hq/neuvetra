# Hosted setup transaction and sequence independent review

Date: 2026-09-26. Task: HOSTED-SETUP-TXN-INTEGRATION-QA-01. Independent reviewer: `/root/source_lock_holistic_qa`, QA/security under CEO sponsor. Reviewer did not author the runner, fence or snapshot extraction. Requested critical gpt-6-astra/high; observed model/effort/cost unknown. Prior failed reviews remain unchanged.

## Disposition

**Integrated runner: FAIL. Sequence-fence component: bounded native PASS. Snapshot extraction: bounded regression PASS.** Actual native PostgreSQL 17.11 integration completed migration 23 in one physical transaction with real sequence fencing and table locking. However, native adversarial probes committed successfully after mutating validated private evidence; reconciliation also changes its expected digest across an await. The advertised whole-transaction deadline is not enforced by a server transaction timeout, and the runner still requires the superseded held-write-gate contract.

No live permission or readiness follows from these results. Native execution used new synthetic loopback clusters, never the retained actual clone or hosted target. No ENV reads/changes, provider calls, Git or candidate changes occurred.

## TXN-F01 [P1] Private validated artifacts and bindings are exposed mutable to callbacks

Runner lines 73-77 clone JSON-compatible objects but do not freeze or strictly validate primitive field shapes. Line 150 passes the runner's own private artifact objects directly to the restore verifier. The verifier can replace bytes/digest and return a binding for those altered artifacts; validation then compares against the same altered private input. Invocation-time evidence is lost.

Native reproducible probe used the actual fence, actual schema-22 SQL, actual migration 23 through migratePrivateStagingFromManifest, real snapshots and in-memory journal. Only this verifier wrapper changed:

```typescript
const original = deps.verifyAcceptedRestore
deps.verifyAcceptedRestore = (receipt, ...args) => {
  const binding = original(receipt, ...args)
  receipt.bytes = 'FORGED_REVIEWER_BYTES'
  receipt.sha256 = sha256(receipt.bytes)
  binding.restoreReceiptSha256 = receipt.sha256
  return binding
}
```

Observed: `artifact_mutation`, one physical transaction, status `hosted_setup_schema23_transaction_committed_and_observed`. This is a synthetic trusted-boundary challenge; no claim is made that an actual reviewer was malicious.

A second native probe changed only observeHeld to mutate its already-validated argument:

```typescript
observeHeld: binding => {
  binding.writeGateHeld = false
  binding.applicationStopped = false
  return true
}
```

It ran at all three phases; the runner again committed and returned the success receipt. Each phase copies and validates, then exposes that copy to mutation; all three mutated copies compare equal. Source line 115 also reads candidate.observeHeld twice instead of capturing one method reference.

Repair: retain immutable, strictly typed invocation-time evidence privately; pass separate frozen copies to verifier/observer callbacks and validate against the retained originals. Capture callback references once. The replacement availability-only stop binding needs the same treatment even if the old held-gate fields are removed. Use immutable primitive serialization for asynchronous evidence outputs. Add tests asserting no journal/migration on artifact rebinding, and refusal or unchanged private state for observer mutation/getter swaps.

## TXN-F02 [P1] Reconciliation changes expected migration hash while awaiting resolution

Runner lines 208-215 validate caller input before awaiting input.observeOriginalTransactionResolved, then reread the same caller-owned expectedMigrationSha256 afterward.

Independent in-memory reproducer:

```typescript
const input = {
  profile: 'neuvetra.hosted-setup.uncertain-commit-reconciliation.v1',
  projectRef: HOSTED_SETUP_PROJECT,
  expectedMigrationSha256: 'a'.repeat(64),
  observeOriginalTransactionResolved: () => pendingResolution
}
const running = reconcileHostedSetupTransactionalCommit(dbReturningMarkerB, input)
input.expectedMigrationSha256 = 'b'.repeat(64)
resolveResolution(true)
await running
```

Observed `hosted_setup_commit_marker_present_after_resolution`, although the actual marker does not match the invocation-time expected hash a. noAutomaticRetry remains true, but the affirmative reconciliation is misbound.

Repair: synchronously capture and strictly validate all scalar inputs and observer/query methods before await; use only the captured values. Add input/getter mutation tests plus present/missing/wrong-hash/duplicate-row cases. The resolution observer itself must be concretely bound to the original transaction and authenticated primary; a boolean alone is not operational proof. Confirm target identity on the reconciliation connection. An absent marker before server-side resolution remains insufficient, and no outcome should automatically replay migration.

## TXN-F03 [P1] 180-second budget is not a hard whole-transaction deadline

Line 163 configures lock_timeout, statement_timeout and idle_in_transaction_session_timeout only. beforeDeadline is a JavaScript phase check. Awaited verifier, source, maintenance and journal callbacks can keep the transaction alive without reaching another check. Repeated short queries avoid both individual statement and idle timeouts. Idle timeout starts from inactivity, not the transaction's original start.

The successful native integrated probe queried `current_setting('transaction_timeout')` under the real fence and table locks: **0**. No hard 180-second server budget was active. The fence adjusts statement/lock timeouts to its remaining budget but also awaits operation without a transaction-wide watchdog; its author explicitly delegates whole lifecycle enforcement to the outer runner.

Repair: set an explicit PostgreSQL 17 transaction_timeout for the whole transaction at entry, retain appropriate smaller lock/statement/idle budgets, and define connection cancellation/rollback/outcome reconciliation when JavaScript callbacks never settle. Do not use Promise.race merely to abandon a still-running transaction. Recheck deadline after awaited journal/fence work and before permitting commit. Add native short-budget tests for repeated short queries and nonsettling callbacks, with observed rollback/session end and released locks. This review did not waste 180 seconds reproducing an unbounded callback; native configuration observation plus the missing control establishes the gap.

Reference from the prior read-only design review: https://www.postgresql.org/docs/17/runtime-config-client.html distinguishes transaction_timeout from per-statement/per-lock/idle settings. No external website request was needed for this test run.

## TXN-F04 [P1 integration] Superseded held-write-gate remains required

Dependencies line 38 and observeStop lines 112-117 still require a HeldApplicationWriteGate binding, writeGateHeld true and observeHeld at all three phases, in addition to observeMaintenanceStopped. The accepted design drops runtime-role connection-limit changes and provider-wide held-writer claims. A truthful availability-only stop cannot satisfy this older evidence contract without mislabeling what was observed or restoring the rejected gate dependency.

Repair: replace the old held-gate contract with a reviewed immutable availability-stop binding for exact target/deployment/reviewer evidence. Database preservation derives from this locked transaction, not the availability observer. Preserve the chosen maintenance operational policy without asserting runtime login refusal or all-writer exclusion. Update tests and outcome wording together. This is not a request for new board approval: the board requires preservation/backup/rehearsal/rollback, not the old gate mechanism.

## What passed independently

- Actual transaction + concrete sequence fence + pinned manifest migration executed successfully on native PostgreSQL **17.11**. Wrapped transaction counter was exactly **one**. The transaction-scoped adapter reused the same tx for the migration helper's nested callback; its catalog audit also used that adapter.
- During under-lock pre-migration observation, a separate native connection's table SELECT and direct audit-sequence nextval both failed with **55P03**, proving competing access blocked. READ COMMITTED was set before discovery; baseline follows sequence and AccessExclusive locks. There is no stale repeatable-read snapshot in this path.
- Native sequence suite independently rerun: **10 pass, 0 fail, 46 assertions**. It covered privileged/runtime/cached nextval/setval blocking; pre-existing long sequence transaction timeout without callback; unchanged serial/free-standing dependencies/OIDs/parameters/value/called flag; lock lifetime after helper return; callback rollback; autocommit refusal; identity-sequence and event-trigger rejection; profile drift; and detection of same-session setval with explicit non-rollback-safe behavior.
- Combined frozen transactional/fence/old-runner/source-lock suites: **34 pass, 11 skip, 0 fail, 184 assertions**. The 11 skip entries are the native suite and its lifecycle entries before the explicit native run; they were not counted as passes.
- Strict scoped TypeScript passed, no diagnostics.
- Existing synthetic uncertain-commit and no-replay cases passed. The external journal remains exclusive in its default implementation; source/fence operation entry guards exist. Native network-loss-at-COMMIT was not injected in this review; the existing test simulates driver failure after committing. This limitation is not described as a native outage test.

The native suite was run from a disposable test harness that changed only import paths and replaced the opt-in describe.skipIf expression with describe. It did not modify the frozen source/test or read/change ENV flags. The temporary harness was removed afterward. Other probes reused fixture declarations with an actual native connection and actual concrete fence/migration helper; their evidence verifiers and external journal were synthetic.

Commands for frozen local suites and compilation:

```text
bun test tools/staging/hosted-setup-transactional-upgrade.test.ts tools/staging/hosted-setup-sequence-fence.test.ts tools/staging/hosted-setup-upgrade.test.ts tools/staging/hosted-setup-source-lock.test.ts
bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-transactional-upgrade.ts tools/staging/hosted-setup-transactional-upgrade.test.ts tools/staging/hosted-setup-sequence-fence.ts tools/staging/hosted-setup-sequence-fence.test.ts tools/staging/hosted-setup-upgrade.ts tools/staging/hosted-setup-source-lock.ts
```

## Preserved probe failures and native cleanup

First integration fixture refused after migration entry because its default public-schema privileges did not meet the real migration helper's legacy-containment precondition. Candidate errors were not bypassed. The second harness revoked PUBLIC/endpoint-role access to its own synthetic public schema before baseline capture; integrated migration then passed. Its second scenario hit an unrelated cluster-global role-already-exists fixture error. Subsequent scenarios were isolated into separate fresh clusters and passed/reproduced findings. These setup failures are not candidate defects and are preserved here.

All roots below remain synthetic retained evidence under `C:/Users/nimab/AppData/Local/Temp/`. Every started fixture reported stop exit **0**, pg_ctl status **3**, and TCP listening **false**. No retained actual clone port 55479 was used.

| Temp directory | Port | Outcome |
| --- | --- | --- |
| qa-transaction-integration-ECr4lf | 55769 | Initial containment refusal; stopped |
| qa-transaction-integration2-02Ooqr | 59978 | Native integration passed; later fixture role collision; stopped |
| qa-transaction-integration2-BG8Z6s | 59991 | F01 artifact mutation committed; stopped |
| qa-transaction-integration2-dJ2zpY | 59995 | F01 held-binding mutation committed; stopped |
| neuvetra-sequence-fence-fDWabl | 60009 | Independent native fence suite 10/46; stopped; connection closes fulfilled |

## Component boundaries and remaining integration

Sequence-fence PASS is limited to trusted same-transaction use, the tested PostgreSQL 17 profile, supported ordinary permanent serial/free-standing sequences, pinned migration without sequence writes, and no concurrent application DDL/security maintenance. Extension/preload values are observed/rechecked, not approved. Native hooks/platform administration are not excluded. Same-session nextval/setval cannot be prevented by the lock or automatically repaired; the test correctly shows setval can survive rollback. Table locks are the runner's responsibility. The fence is not by itself a whole-transaction deadline mechanism.

The extracted snapshot function leaves transaction ownership/isolation with its caller; the old wrapper preserves repeatable-read/read-only behavior. Existing snapshot/source-lock regressions pass. The source lock's required runtime-pin set still predates this runner/fence. The production launcher must include these exact modules and changed snapshot dependency in a new reviewed loaded-source closure. The native integration used the pinned manifest API with a synthetic source-binding verifier; it did not authenticate a real launcher or current hosted head.

Availability restart compatibility, authenticated real review artifacts, durable real external journal, primary-specific uncertain-commit resolution and live maintenance action remain unimplemented/unobserved. Do not use the earlier failing transport as implicit authority. No live gate/migration/deployment approval is granted.

## Exact frozen bytes and next owner

Initial/final source hashes match assignment.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-transactional-upgrade.ts | 7a3e199c5a8bf34b6d0132cb87b254e777fbb0a1d163e0cf9da2b60e512daf17 |
| tools/staging/hosted-setup-transactional-upgrade.test.ts | ba9e8d51799c9b7818c2fc3fd8b5baeec303c12f656ea5e9e343387090721148 |
| tools/staging/hosted-setup-upgrade.ts | 2134c09da9f5638f11c3634e272b5918c9fa78a8c090dc13852d4b92646fca11 |
| tools/staging/hosted-setup-sequence-fence.ts | d48edfa567d847e55200fc6864ad20ad5d38de554c93ed0dd3c05109fc936876 |
| tools/staging/hosted-setup-sequence-fence.test.ts | 3a4fdcaf08762328fb4caa55f4f4c8ae227da7fd770274ee71466458f69ef840 |
| evaluations/research-qa/hosted-setup-01-sequence-fence-author.md | fe17da8394767e9098147ae18208f97d908302cba6c366d284934b097f0d3cee |
| evaluations/research-qa/hosted-setup-01-transactional-upgrade-author.md | bd39e3cdb2dfeb610a23cd7c49de9abc34f4aeace839c777f9bb48c41c16909a |

Next owner: runner author under root/CTO for F01-F04; sequence author need not redesign the accepted primitive merely because enclosing integration failed. Return exact repaired runner/tests and closure dependencies for independent integrated review. Only this report was written permanently in the repository; local synthetic fixture evidence is retained and stopped. No candidate/shared operations/notes/Git/live provider/live DB/ENV edits occurred. Local test/report permissions were bounded managed-worktree escalations.
