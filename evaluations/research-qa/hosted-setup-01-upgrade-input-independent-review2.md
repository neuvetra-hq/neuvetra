# HOSTED-SETUP-UPGRADE-INPUT-QA2 — independent repaired-runner review

2026-09-26. **FAIL for the generic changed runner: F01 [P1] remains partially unresolved at asynchronous result handoff.** Synchronous-result copying and later verifier-object mutation are repaired. F02 journal cwd drift is repaired. F03 no longer produces a false success after a post-pin manifest change; it correctly requires postcommit reconciliation without retry. The exact candidate is not approved for hosted execution.

Reviewer `/root/source_lock_holistic_qa`, independent Head of QA/security reviewer, CEO sponsor. I authored the prior independent review, not the implementation or tests. Requested critical gpt-6-astra/high; observed compute, tokens and cost unknown. Context: previous complete runner/source-lock reviews and operating/board direction, complete changed functions/tests, unchanged source-lock and concrete accepted-restore boundaries. Only this report was written. No code, operations, Git, ENV, provider, hosted or external/native database action occurred. Existing tests use local embedded PGlite; independent probes use synthetic objects and in-memory adapters.

## F01 residual [P1]: asynchronous producer can mutate before the copy reaction runs

Location: `tools/staging/hosted-setup-upgrade.ts:216-218`, consumed at 311–314 and fingerprint captures.

`captureResult` correctly calls `copy(result)` immediately for synchronous results. For a promise, it schedules `Promise.resolve(result).then(copy)`. That callback executes later. A producer can resolve a shared mutable object and change it before the copy reaction runs. Neither the result contract nor a runtime check requires immutable ownership transfer, so the runner accepts altered evidence that was not present at resolution.

I independently repeated the same changed-baseline case three ways. The original accepted fingerprint was `5cd5e83a731a791e3f07b2100710e16848b0eec2782c9980487671a3bd59c8cb`; a changed company-row fixture had fingerprint `5e27ba5584a0914e4ea50f5493c14c77d2f22786927493be551cb9755f17c3c9`.

| Verifier handoff | Observed result |
| --- | --- |
| Return shared restore result synchronously; queue a microtask replacing its expected fingerprint | Correct refusal before migration; copied original fingerprint retained |
| Return an already-fulfilled Promise of that result; queue the same mutation before returning control | Incorrect success; one synthetic migration and committed-and-observed receipt against changed baseline |
| Return a pending Promise; later call resolve(result), then immediately change its expected fingerprint in the same callback | Incorrect success; one synthetic migration and committed-and-observed receipt against changed baseline |

Minimal exported-runner reproductions, using an otherwise valid synthetic fixture:

```ts
verifyAcceptedRestore: () => {
  const pending = Promise.resolve(restoreResult);
  queueMicrotask(() => {
    restoreResult.expectedDatabaseFingerprintSha256 = hash(changedBefore);
  });
  return pending;
}
// Independently reproduced with a genuinely pending promise:
verifyAcceptedRestore: () => new Promise(resolve => {
  setTimeout(() => {
    resolve(restoreResult);
    restoreResult.expectedDatabaseFingerprintSha256 = hash(changedBefore);
  }, 0);
})
```

This is a remaining generic handoff defect, not evidence that the concrete accepted-restore helper is compromised: that helper returns frozen primitive fields synchronously and is not vulnerable to these probes. The public runner interface still accepts mutable asynchronous restore, publication and stop bindings. The same capture helper is also used for asynchronous fingerprints; this review did not independently reproduce an asynchronous fingerprint substitution and does not claim it did.

Required correction: establish an enforceable immutable producer-to-consumer handoff for asynchronous evidence. A producer-owned frozen, validated data-only snapshot created before resolving, an immutable serialized result, or private parsing of pinned bytes authenticated separately are candidate approaches. A consumer-only `.then(copy)` cannot run before a mutation that occurs immediately after `resolve`. Do not declare the generic race fixed by adding more awaits. Preserve the now-correct synchronous capture and later-mutation protections, and add both async reproductions as regressions. A deliberately dishonest trusted adapter remains outside what snapshots can solve; this finding concerns shared-object lifetime within the declared asynchronous contract.

## Evidence map and repaired behavior

| Criterion | Disposition and observed evidence |
| --- | --- |
| `privateScalars` | Copies each required own field once, admits only primitive string/number/boolean values, freezes the resulting object. Downstream exact-value and strict digest checks reject wrong required meanings. Missing or object-valued fields are not silently normalized. Lifetime is safe after capture; asynchronous pre-capture gap remains F01. |
| Earlier late restore mutation | Existing regression now rejects changed preflight with zero migrations. Independent synchronous microtask variant also rejects. |
| Earlier late publication mutation | Independently changed original closure from 64 fours to 64 fives during manifest acquisition. Journal/source binding retained 64 fours and valid control completed. |
| Write-gate result handling | Existing stop-mutation test rejects before migration. Captured initial/before/postcommit stop records no longer share the same result object after copying. Async handoff remains subject to F01. |
| F02 absolute journal path | Independent original cwd-change probe now passes the exact invocation-time absolute outside-repository path to the opener, despite changing cwd to repository/tools. Cwd restored in finally; no probe file written. Validation uses a module-anchored repository root. |
| Default journal parent | Inspection confirms absolute/outside checks plus realpath(parent) refusal when parent resolves inside repository, followed by exclusive create. Existing real temporary-journal test verifies collision refusal and chained synced events. No hostile parent-swap stress test was run; checks are not an atomic OS no-follow operation. |
| `privateManifest` / F03 | Complete ordered migration names and actual SQL digests are validated via `pinStagingMigrationManifest`, and rows/array are copied and frozen. Independent late source-manifest mutation no longer changes the retained reviewed manifest. The supplied migration's differing result caused `hosted_setup_postcommit_reconciliation_required_do_not_retry`; one synthetic migration had already returned. |
| `privateFingerprint` | Canonical serialization/parse creates a private nested copy. Independently mutating caller-owned preflight table hashes during migration did not change the retained baseline: the original consistent postcommit observation completed successfully. This is isolation evidence, not permission to ignore real database drift. |
| Result comparison | The runner compares schema version, result count and migration 23 name/digest with its private manifest, then compares all postcommit receipts and preservation observations with the retained manifest/baseline. This catches the tested late-manifest discrepancy after the adapter returns; it does not by itself prevent a wrongly wired adapter from executing different SQL. |
| No-retry behavior | Existing preflight/source refusal, uncertain execution, postcommit/receipt failures and exclusive journal cases all pass. Independently observed changed-manifest return enters reconciliation, not retry. Cross-process reservation under arbitrary alternate journal paths remains an external operational contract. |

Correct source-lock composition is still essential: supply the same lock's manifest, immutable-source wrapper and migration method. The runner's generic migrate dependency does not receive the captured manifest, so evidence checking alone cannot prove it executed those bytes. Source-lock's private migration execution provides that guarantee within its accepted scope. No actual operator composition was exercised in this review.

## Reviewer identity integration constraint

The runner still requires one `input.independentReviewerId` to equal the historical restore reviewer, publication reviewer and held-stop reviewer. The concrete accepted-restore helper truthfully returns `/root/hosted_recovery_qa` (line 59). Consequently, newly prepared publication/stop evidence from another reviewer cannot pass this interface with its actual reviewer identity.

This is a restrictive integration constraint, not a demonstrated false-attribution action or new fail-open. Do not relabel a different review as `/root/hosted_recovery_qa` to satisfy the equality. If that exact reviewer actually performs all required new reviews, equality can be truthful. Otherwise root should separate stage-specific reviewer identities, each bound to its own exact artifact, while retaining operator-versus-reviewer independence. A final integration approver, if needed, should be a separately named role and must not replace historical provenance. Decide and review this schema before concrete publication/stop adapters are accepted.

## Checks actually run

- Bun 1.3.12: `bun test tools/staging/hosted-setup-upgrade.test.ts tools/staging/hosted-setup-source-lock.test.ts --timeout 30000`: **24 passed, 0 failed, 131 assertions**. These are separate component suites, not a complete runtime-launcher/operator integration test.
- Strict TypeScript for both components and tests: `bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-upgrade.ts tools/staging/hosted-setup-upgrade.test.ts tools/staging/hosted-setup-source-lock.ts tools/staging/hosted-setup-source-lock.test.ts`: passed, no diagnostics.
- Independent stdin probes reused existing synthetic fixture constructors but independently supplied the mutation timings and expected dispositions: control, synchronous microtask, fulfilled and pending async settlement, late publication mutation, late manifest mutation, cwd drift, and late preflight-object mutation. Both async cases exposed the residual failure.

Unrun: external authenticator/pre-import launcher, real immutable runtime tree, exact integrated operator wiring, hostile filesystem races, native PostgreSQL, provider or current hosted state. No permanent probe source was added. Local execution/report writing required bounded managed-worktree access escalation.

## Exact reviewed bytes

Initial and final hashes matched before report writing.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-upgrade.ts` | `a8bd3a4b4545632af35355e11e386956e4fc10520f5158cf06ec38418de41520` |
| `tools/staging/hosted-setup-upgrade.test.ts` | `758a60303c23a11398b91e5e529278df45a2b3e1478c15dac314c0b931b0b575` |
| `tools/staging/hosted-setup-source-lock.ts` | `8201172e25271da9dd3625ece7976dc002639adfb11d9ec9a996e240a82f0a5c` |
| `tools/staging/hosted-setup-accepted-restore.ts` | `a5f4e5feb5aa5d651d222413f075142ca200171272cacb60b732470625342395` |

Prior source-lock review 5 bound old runner hash `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c`; its historical PASS does not approve this new imported closure. Passing the rerun source-lock suite is useful regression evidence, not renewed full integration acceptance.

Next owner: root/CTO to repair the async ownership contract, preserve both failed runner reviews, resolve truthful stage-reviewer attribution, and return exact artifacts plus adversarial tests. Then perform independent integrated composition/runtime-closure review before any live currentness, writer gate or upgrade work. No migration, deployment or hosted mutation authority is granted.
