# HOSTED-SETUP-SEQUENCE-FENCE-01 — author evidence, 2026-09-26

**Author verdict: bounded local PASS; independent integrated review pending.** No hosted provider, hosted database, retained actual clone on port 55479, environment export, or secrets were accessed. No publication or live-upgrade claim is made.

Owner: data/database specialist under CTO, dispatched as `sequence_fence`. Requested compute: registry critical `gpt-6-astra/high`; observed model/effort unavailable. Role prompt SHA-256: `9f5a9ec9fb9c99d0cb0352fed641e77c97c6b388b6793706603628900d8a457e`. Scope was the two new sequence-fence source/test files and this author report. Shared operational files and Git were not changed. Reviewed context includes current operations entry points, migration 0023, the workspace connection contract, role instructions, and agent improvement workflow. Current coordinator steering replaces the older continuous privileged-writer hold proposal with the bounded no-concurrent-application-DDL/security-maintenance operating condition.

## Deliverable and integration contract

`tools/staging/hosted-setup-sequence-fence.ts` exports `withSequenceFence<T>(tx, {projectRef, sequenceNames, deadlineAtMs}, operation)`, matching the transaction-runner author. The existing outer transaction must contain this helper and the full baseline/migration/preservation work. The operation executes exactly once only after every discovered Neuvetra sequence is fenced and verified. Locks survive the helper returning and end only with the outer transaction. SAVEPOINT refuses accidental autocommit use; backend PID and transaction ID are checked before and after the operation.

The caller supplies the exact expected sequence-name inventory. The helper sorts and validates it, checks the entire discovered sequence inventory, and retains exact OID, parameters, owner, ACL, persistence, storage identity, column ownership and incoming/outgoing dependency definitions. Numeric state is kept in PostgreSQL text, including values above JavaScript's safe integer range. Each supported permanent serial/free-standing sequence receives an identical `ALTER SEQUENCE ... OWNED BY` clause. Identifier input uses a deliberately narrow allowlist and quoting; project/timeout values are parameterized. Every sequence must show this backend's granted `ShareRowExclusiveLock` before the callback. Unsupported identity/dependency profiles, unusual identifiers, missing/unexpected sequences and any event trigger cause refusal.

The server must be PostgreSQL 17 in origin replication mode with the exact target project/profile. Extension/preload/session/target/event-trigger profiles and complete sequence definitions are rechecked across the operation. The helper rejects **all** event triggers, including disabled triggers; no allowlist or claim that a provider's triggers were reviewed exists. Initial extension/preload values are observations, not approvals; their review belongs to the enclosing trusted runtime/profile gate. The existing schema-22 migrations define three `bigserial` audit sequences and migration 0023 contains no sequence writes.

## PostgreSQL primary evidence

[PostgreSQL 17 ALTER SEQUENCE documentation](https://www.postgresql.org/docs/17/sql-altersequence.html) states that ALTER SEQUENCE blocks concurrent sequence calls and describes OWNED BY semantics and session caching. The [PostgreSQL REL_17_11 sequence.c source](https://github.com/postgres/postgres/blob/REL_17_11/src/backend/commands/sequence.c) supplies the finer reasoning: `AlterSequence` acquires `ShareRowExclusiveLock`; `lock_and_open_sequence` acquires `RowExclusiveLock` once per transaction, before nextval can return cached values. `init_params` identifies OWNED BY as the exception to storage rewrite. `process_owned_by` replaces the matching dependency and rejects identity ownership. Therefore a transaction already using a sequence must finish before the fence can succeed; a backend with cached values in a subsequent transaction still encounters the lock. The native tests below corroborate the supported behavior, including semantic dependency preservation after the no-op replacement. These sources do not establish protection against hostile platform administration.

## Reproducible native validation

Final commands from the exact worktree `C:\Users\nimab\.codex\worktrees\inventory-plan-delivery\Neuvetra`:

```powershell
$env:HOSTED_SETUP_SEQUENCE_NATIVE='1'
bun test tools/staging/hosted-setup-sequence-fence.test.ts
bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-sequence-fence.ts tools/staging/hosted-setup-sequence-fence.test.ts
```

Observed Bun 1.3.12, native PostgreSQL **17.11**, exact server version `170011`. Final native result **10 passed, 0 failed, 46 assertions**, 3.89 seconds. Strict scoped TypeScript exited 0. Native fixture binds only `127.0.0.1`, chooses a fresh port (explicitly excluding 55479), and initializes a new synthetic cluster. Final retained directory: `C:\Users\nimab\AppData\Local\Temp\neuvetra-sequence-fence-C20Yn5`, port **64245**. Final cleanup evidence: stop exit 0, status exit 3, TCP listening false, all connection closes fulfilled, synthetic data retained. No broad deletion or process termination is in the test.

| Criterion | Observed evidence |
| --- | --- |
| No migration callback without fence | Invalid/injection/duplicate identifiers, missing inventory, autocommit, identity sequence, event trigger and already-running sequence transaction all refuse; callback count remains zero. |
| Ordinary and privileged direct calls | Both nextval and setval reach lock timeout `55P03` for superuser, ordinary runtime and a pre-cached session while held. Three sequence locks are observed. |
| Cached and long-running sessions | Cached session resumes with its previously reserved value 2 after commit. A transaction already holding a sequence lock prevents acquisition until the bounded timeout, without entering callback. |
| Successful preservation | Owned serial and free-standing cache-7/uncalled sequences retain exact OIDs, parameters, ACLs, storage identity, dependencies, last_value and is_called across a successful callback/commit. Includes `9007199254740993`. |
| Failed callback preservation | Deliberate callback error propagates; outer rollback preserves all sequence state. A following caller can use the previously uncalled sequence. |
| Lock lifetime | A direct nextval still refuses after the helper has returned inside the outer transaction. |
| Profile and same-session mutation | Changed target profile refuses and rolls back. Deliberate same-session setval is detected and returns the explicit do-not-retry error; the test confirms its value survives rollback. |

The native test is opt-in; without `HOSTED_SETUP_SEQUENCE_NATIVE=1`, only caller-input validation runs and the native group is visibly skipped. Native binary location is the existing local `C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin`; no binaries were installed or downloaded.

## Preserved failed attempts and limits

The first invocation was blocked by local sandbox file-read EPERM before any native fixture; the authorized synthetic test was then run with tool-reviewed filesystem permission. The first full native run passed the concurrent-writer case but timed out on subsequent `expect(promise).rejects.toThrow` database assertions. An isolated attempt reproduced the timeout with the server idle at BEGIN. Replacing those native promise matchers with normal awaited try/catch assertions allowed the isolated case and full suite to pass. No production helper semantics were changed to hide a failing database assertion. Failed synthetic directories `neuvetra-sequence-fence-d6dq4h` (port 56096) and `neuvetra-sequence-fence-uRMyAd` (port 63672) remain in local temporary storage. The first cluster was explicitly stopped by its exact data directory, which then reported no server running; its identified hung Bun test process was stopped after inspection. The isolated fixture's finalizer independently reported stop 0/status 3/TCP false. The first strict check reported test-context literal type widening; an explicit const context corrected it before the successful strict check.

This fence assumes a trusted reviewed same-session migration, a trusted PostgreSQL server/connection, and the bounded no-concurrent-application-DDL/security-maintenance operating condition. Application DDL or extension/hook changes outside that condition are not claimed prevented by sequence locks or catalog rechecks. Hostile platform administrators and native-code hooks are outside scope. The helper does not fence table writes; the enclosing runner owns table locks and final integrated catalog/security checks.

Locks cannot block the lock owner's own nextval/setval, and PostgreSQL sequence increments are not generally rolled back. The helper detects such writes after the operation but cannot repair them; the migration must remain pinned and have no sequence writes. No statement of universal rollback safety is made. The helper does not run COMMIT, ROLLBACK, reconnect, replay, or a JavaScript cancellation race. It applies transaction-local server statement/lock timeouts and checks a copied absolute deadline (at most ten minutes); the outer runner must enforce its lifecycle budget, propagate all errors to rollback, and retain a no-retry/uncertain outcome when rollback or connection cleanup cannot be confirmed. A nonsettling JavaScript callback requires that enclosing lifecycle control.

## Frozen artifact identity and next owner

- `tools/staging/hosted-setup-sequence-fence.ts`: `d48edfa567d847e55200fc6864ad20ad5d38de554c93ed0dd3c05109fc936876`
- `tools/staging/hosted-setup-sequence-fence.test.ts`: `3a4fdcaf08762328fb4caa55f4f4c8ae227da7fd770274ee71466458f69ef840`

Next owner: CTO/root integrates with the transaction runner and its loaded-source closure; independent QA challenges the combined catalog/table/sequence boundary and exact final bytes before any publication/live use. No outside permission or board decision is requested by this bounded author deliverable.
