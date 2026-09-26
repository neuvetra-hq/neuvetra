# HOSTED-SETUP-ARTIFACT-SOURCE-QA-02

2026-09-26. Targeted independent security/CTO re-review of ARTIFACT-LAUNCH-REPAIR-01 by `/root/upgrade_boundary_review`, sponsored by `/root`. Requested critical route `gpt-6-astra/high`; actual model/effort, tokens and cost remain unknown. Role prompt SHA-256: `3b3c1d31d5e5e35bf90ad971d4511a7693b7f14d12f2eb7ac0ed4723cc0b79d3`. This context authored the design assessment and first independent FAIL report, not the implementation or author tests. This is a separate review turn with fresh synthetic fixtures.

## Verdict

**Bounded PASS for the exact repaired offline artifact verifier/private SQL component below. AS-QA-F01 and AS-QA-F02 are closed.** No new material finding arose in the targeted tests. The original FAIL report remains unchanged at SHA-256 `84502c0e52c87b2e2c00559bc310240cf550947708031e6154eccb1ad1e8754c`.

This verdict accepts the repaired source-operation lifecycle and ordinary trusted-host checkout-path exclusions, together with their focused regressions. It does not accept an operational supervisor, loaded JavaScript identity, authenticated publication, archive extraction, dependency resolution, database preservation, migration or deployment.

## AS-QA-F01 closure: reserve before binding access

The source now enters the private `validating` phase before calling the binding serializer. Both another wrapper invocation and `migrate` refuse during that phase. The candidate becomes `active` only after exact binding comparison and a function check. The encompassing `finally` changes the phase to `consumed` after success or any validation/operation failure.

I independently reproduced the previous getter attack with the repaired real exported lock. The getter attempted both nested `withArtifactSource` and direct `migrate`. Both refused; the inner operation was never entered, exactly one outer callback ran, and exactly one synthetic SQL transaction executed the original migration-23 SQL. I repeated the attack through a Proxy `ownKeys` trap to exercise an earlier serialization hook. That variant also refused both nested actions with exactly one outer callback and one original-SQL transaction.

Independent lifecycle controls also passed:

- Wrong profile, wrong artifact digest, an added legacy `sourceClosureSha256`, a throwing binding getter and a nonfunction operation each refuse before an operation callback or SQL. Each attempted lock is consumed and refuses a subsequent valid request.
- An operation that throws and an operation that returns without invoking migration each refuse and consume their lock, with no SQL.
- An equivalent binding with reordered properties succeeds and retains original SQL.
- A second operation during an active callback, a second migration in that operation and a migration after callback completion all refuse.

The repaired candidate intentionally consumes a lock on binding mismatch; the prior unaccepted version allowed correcting that mismatch on the same lock. This stricter per-attempt behavior is now explicit and independently tested. It does not create cross-process replay protection, a durable journal or a guarantee that arbitrary caller callbacks await their SQL; those remain composed-runner responsibilities.

## AS-QA-F02 closure: exclusion roots receive filesystem validation

Every checkout exclusion is now passed through the same regular-directory/realpath checks before overlap comparison. The implementation chooses to refuse alias paths rather than normalize and accept them. Missing or nondirectory exclusions cannot be silently ignored.

Using actual Windows junctions in a fresh temporary fixture, I independently retested:

- A direct junction alias for the exact source root: refused.
- An alias in an ancestor directory followed by the source child path: refused.
- A junction alias for the whole ancestor root: refused.
- A dependency-root junction alias: refused.
- Missing root and regular file used as an exclusion: refused.
- Real source root, real dependency root and real common ancestor as exclusions: refused by overlap checks.
- A list combining one valid unrelated checkout and one alias: refused.
- The original unrelated real checkout directory: accepted, retaining the frozen offline-only inspection and `launchAuthorized: false`.

Temporary junctions created by the independent probe were unlinked in its cleanup. This closes the ordinary Windows alias bypass. It is not an atomic defense against a hostile process remapping filesystem paths during verification; the declared trusted-operator-host assumption is unchanged.

## Checks performed

1. Bun 1.3.12 focused suite: **12 passed, 0 failed, 69 assertions**. This reruns the new regressions plus publication/artifact refusals, private SQL, capability ownership, caller mutation and the controlled Bun child probe.
2. Installed strict TypeScript for the two changed files: **PASS**, exit 0, no diagnostics. No package installation.
3. Separate reviewer-written targeted probe: **50 checks passed**, with four in-memory stub transactions across distinct valid locks. No native or hosted database was used. Probe source: `C:/Users/nimab/AppData/Local/Temp/artifact-repair-independent-0c59581ada8347c4b10ed32d5f263b77/repair.ts`. Fresh fixture and retained results: `C:/Users/nimab/AppData/Local/Temp/artifact-independent-fixture-mL4zJL/repair-independent-observation.json`.
4. The focused suite's harmless actual Bun launch-input experiment passed again. Observation directory: `C:/Users/nimab/AppData/Local/Temp/hosted-artifact-launch-probe-K9eGt3/`. It verifies that test profile's preload/env controls and uncertainty-preserving synthetic timeout. It remains a test harness, not the production supervisor. Its child processes exited; the independent targeted probe spawned none.
5. Candidate hashes rechecked after tests; unchanged. Original FAIL report hash rechecked; unchanged.

No provider action, credentials, ENV export, native database, real `pg` connection, source edit, ledger edit or Git operation occurred. The only new repository artifact is this report; synthetic probes/results are retained in temporary directories.

## Exact reviewed bytes

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-source.ts` | `3e1069aba42eca77a861f9c395c966269758a79a16207c53c19b15b6c8d4c691` |
| `tools/staging/hosted-setup-artifact-source.test.ts` | `4a57883a54b387cf1356ecacfda5e05c80a792cbc230be0f8bce2ddc1c9992c9` |
| `evaluations/research-qa/hosted-setup-01-artifact-launch-repair1-author.md` | `18a45d89a66eb552fb359e0902165a138d3c80841640970104cc9b1636e23756` |

## Remaining integration boundaries

All operational exclusions from the first review remain in force. The receipt pin still needs an independently authenticated publication/check channel. Materialized trees must still be proven to originate from the source/dependency archives. The actual private dependency layout and `createRequire(...package.json)('pg')` resolution are unverified. Worker-side migration code still imports relative to the loaded verifier module; this component does not establish that the executing JavaScript came from the inspected artifact.

A real fixed supervisor/worker must still enforce the fresh process, single dedicated adapter/transaction, private credential input, external durable journal, bounded termination, target/TLS identity and separate uncertain-COMMIT reconciliation process. The new artifact binding must be deliberately integrated with the transactional runner and its publication/restore/stop/fence/preservation contracts. Native integrated review and exact publication must precede any hosted operation.

`launchAuthorized: false` and the at-rest/private-SQL-only claim remain unchanged. No old complete-module-graph or hostile-host immutability assertion is reintroduced. Root may accept these exact repaired component bytes and continue the separately owned integration; this report supplies no live launch or migration verdict.