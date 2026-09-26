# HOSTED-SETUP-TRANSPORT-QA-02 — candidate2 independent review

Date:2026-09-26. **PASS for the bounded transport repair at the exact bytes below.** TRANSPORT-F01 and TRANSPORT-F02 are resolved. Candidate1 FAIL remains untouched in `hosted-setup-01-transport-independent-review.md`. This verdict does not establish a successful hosted backup, restore, preservation comparison or upgrade.

Reviewer `/root/hosted_qa` authored no product changes. Requested route:gpt-6-astra/high; actual inherited model/effort/cost remain unknown. Review used source inspection and synthetic local tests only. No credential-export file, provider, archive, Git or shared operations mutation was used. Only this review was written.

## Exact reviewed bytes

| File | SHA256 |
| --- | --- |
| tools/staging/hosted-setup-hosted-backup.ts | fd3b6932b8fd7ee58b2fc171cd2d9724183d5c3550d433281a497894df0ceb71 |
| tools/staging/hosted-setup-hosted-backup.test.ts | a3f9b1424e746724d92d8395599ae5f81631d7a3f97574fc4c026c16a348c190 |
| tools/staging/hosted-setup-backup.ts | 24fdd727af8caa4ae0ccbe33b5a5d13e36322178becc0357f2cb50fcab5c219c |
| tools/staging/hosted-setup-restore-io.ts | 6eb5f90da057e302bbc8ad91c81933e748ce8705b699bed53838aba5d451da71 |
| tools/staging/hosted-setup-restore-core.ts | 5fd5eff04e81d3179f2d39bfe6900b239c96b9f46613da83a70fdbaea5b0041b |
| packages/neuvetra-database/src/hosted.ts | 3bd3398fe582d2cf74e6868ab7fdfcd0f7158fb1e96dce5c5b59069ed1c59e04 |

## Repair verification

F01: `selectSyntheticTenantActors` now includes every unique member, refuses more than32 member actors, requires an exclusive authenticated actor for each company when there are multiple companies, and rejects an outsider that is a member. It retains the shared A+B actor without dropping A-only/B-only controls. Sources without the required exclusive actors fail before any backup is attempted. This is a deliberate fail-closed restriction, not a claim that shared-membership-only companies have passed isolation.

F02: the hosted dump callback now calls `boundedDump` with a20-second maximum. Its timer marks timeout, kills the child, waits for the child exit, and refuses timed-out or nonzero exits regardless of emitted bytes. The20-second ceiling is below the inspected source driver's30-second idle-transaction limit. The ordinary success path still awaits child exit and buffers before returning to the paired backup. A failed dump throws before archive/receipt success writes; only the core's reserved attempt journal may already exist. That journal still requires operator reconciliation.

## Executed evidence

1. `bun test tools/staging/hosted-setup-hosted-backup.test.ts`: **5 passed,0 failed,14 assertions** on Bun1.3.12. Includes the original shared-member case, stalled child and valid child output.
2. Independent inline Bun harness importing the actual repaired exports: **26 assertions passed**, four synthetic child processes spawned. No test or product file was modified. Cases:
   - Shared actor across A/B/C plus exclusive A-only,B-only,C-only actors; duplicated input memberships do not duplicate actors or company sets.
   - Missing C-only control, outsider/member collision, empty membership set and33-member input refused;32 members accepted with a separate outsider.
   - Deadlines0,-1,20001 and1.5 refused before spawning any process.
   - Child emitted35 plausible archive-prefix bytes and then remained alive: rejected within the bounded test deadline, child exit/signal state observed, and `process.kill(pid,0)` failed afterward, confirming the tested child PID no longer existed.
   - Child emitted the same bytes then exited7: rejected, reaped and PID absent. A successful child emitting only four bytes was also rejected and reaped.
   - A delayed successful child emitted35 bytes and completed before its deadline: exact output length accepted.
   The stalled test used a500ms deadline and asserted completion within3seconds; no long or unbounded hang reproduction occurred. This proves the actual Windows/Bun child behavior for the tested single process, not every possible descendant process tree.
3. Source inspection confirmed unchanged endpoint/CA/executable pins, URL restrictions, TLS verification, snapshot-token argument handling, credential environment confinement, sanitized CLI failure output, exclusive attempt/archive/receipt writes and no automatic retry. Candidate1's independently matched CA and pg_dump17.11 binary pins remain the same literals. The backup still awaits the dump before constructing/sealing a successful snapshot.

## Remaining execution limits

Actual hosted TLS and pooler snapshot behavior, private-directory ACLs, real pg_dump duration/output, DPAPI and full source-to-restored equivalence were not exercised in this review. A legitimate dump exceeding20seconds is refused; it must not be relabeled success or retried without reconciliation. The128MiB output check occurs after buffering, so it is an acceptance limit rather than a streaming memory bound; this review accepts only the fixed pinned pg_dump against the specifically authorized small synthetic source. General-purpose or untrusted child execution is not approved.

The recovery core's independent candidate2 review and actual paired backup/restore gate remain separate prerequisites. Follow any newer core verdict against its own exact bytes. This transport pass does not release methods, authorize real customer data, assert complete corporate reporting, or establish hosted readiness.
