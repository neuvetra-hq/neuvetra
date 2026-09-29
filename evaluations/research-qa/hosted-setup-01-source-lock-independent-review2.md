# HOSTED-SETUP-SOURCE-LOCK-QA-02 — independent repair review

2026-09-26. **FAIL. SOURCE-LOCK-QA-F02 [P1] must be repaired before this component can bind an accepted runtime attestation or reviewed source closure.** The narrowed migration-SQL pinning and at-most-once invocation behavior pass this review, and the prior cwd/symlink/loaded-module overclaim is materially improved. A new native JavaScript interleaving changes caller-owned input after lock acquisition begins but before awaited verification completes; the lock accepts and records evidence different from the bytes and reviewed closure supplied at invocation.

Reviewer: `/root/hosted_upgrade`, independently assigned Head of QA for this source-lock repair. This execution context did not author the source-lock implementation, source-lock tests, staging migration helper, upgrade runner or author handoff. It previously authored separate fingerprint-derivation files, which are outside this review. Requested compute was gpt-6-astra/high; observed model, effort, token use and cost were not exposed. The review used only source inspection and safe local Bun checks. No hosted/provider/database action, actual archive, secret, ENV export, product code edit, Git action, executable launcher or shared operational record was used or changed.

## SOURCE-LOCK-QA-F02 [P1]: mutable reviewed inputs can change across awaits

Locations: `tools/staging/hosted-setup-source-lock.ts:173-182`, `184-202`.

`lockHostedSetupSource` validates the caller-owned `input` object and hashes `input.runtimeAttestation.bytes` at lines 173-176. It does not synchronously copy the scalar binding or bytes. It then awaits the current-head observer and migration-source collection. Line 182 creates the verifier copy from the original mutable byte array only after those awaits. Later comparisons and the returned inspection reread the mutable `input` fields.

Two independent in-process reproductions used the real migration-source collector and a verifier that parsed the exact bytes it received:

1. The call began with valid attestation serialization A and SHA-256 `8d049460b676a15596d066e4a95d941524c508fae306c2cea02c38ac25a22cf7`. While the head observer was deliberately pending, the same-length byte array was replaced with serialization B of the same valid attestation fields in a different property order. The verifier parsed B and observed SHA-256 `7da11df81f39378de367b165159b7e977861fdba40a4d7812c7c8704664a8adb`. Lock construction succeeded, while `inspection.runtimeAttestationSha256` recorded A. Thus the purported exact artifact pin did not identify the bytes actually verified.
2. A second call began with `sourceClosureSha256` equal to 64 zeroes. The exact attestation artifact validly bound closure `61e1d135f66b73f80adcbbd4bdd1101428eed293ddc2d495abec95506852f61c`. While the verifier was deliberately pending, the caller-owned input field was changed to that closure. Lock construction succeeded and the returned inspection adopted the replacement closure, even though it was not the closure supplied when acquisition began.

These are argument-stability failures inside the source-lock API; they do not depend on changing disk files, cwd, module resolution or a database. The second reproducer's verifier independently checked that the byte array it received still matched the artifact it parsed. The first reproducer used two distinct valid JSON byte encodings, so it demonstrates an exact-byte mismatch even when the semantic attestation fields are unchanged.

Required repair: at function entry, before the first `await`, copy every reviewed scalar and identity into private locals, copy the attestation `Uint8Array`, validate and retain the digest of that private copy, and use only those retained values for all comparisons, the runner binding and returned inspection. After `verifyRuntimeLoadedCode` resolves, synchronously deep-copy its required scalar fields and every runtime source pin/preload/loader before any further `await`; validate and use only that private result. Add both adversarial timing regressions. The component should never record an artifact SHA for bytes other than the private bytes supplied to the verifier.

## Accepted bounded behavior

The previous review's failure remains preserved. Candidate 2 no longer claims that a cwd-relative disk walk proves already-loaded executable identity. Migration paths are anchored to `import.meta.url`; the repository real path must equal the lexical root; and each migration must be a regular non-symlink file whose real path equals its expected path. The focused cwd and injected symlink/junction cases passed.

Executable identity is now explicitly delegated to a future pre-import loader/verifier. The component requires same-process, same-module, repository-root, runtime-executable, reviewed-head, manifest, closure, distinct-identity, zero-finding and complete-loader-graph claims, and refuses declared preloads or custom loaders. No such independently accepted launcher/verifier exists in this candidate. Therefore even after F02 is repaired, this source lock alone is not executable authority and cannot approve a hosted migration.

The migration SQL path passed its narrowed claim. `migratePrivateStagingFromManifest` validates, copies and freezes all 23 ordered SQL entries synchronously before its first `await`, and executes only those retained strings. The source lock sets its wrapper state to `active` before entering the callback and sets `migrationEntered` synchronously before migration execution, so competing or later entry cannot obtain a second invocation. This is at-most-once invocation, not proof that the database committed successfully. The existing backing-file and caller-object mutation tests passed.

The independently recomputed normalized manifest contains 23 entries and hashes to `ec11c9b39bb706f64c970745d0d122ec5fb76b480ea0cd2362d685c8b2620452`; migration 23 hashes to `d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb`.

## Checks and exact reviewed bytes

| Check | Result |
|---|---|
| `bun test tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-upgrade.test.ts --timeout 30000` | 14 passed, 0 failed, 90 assertions |
| Focused TypeScript compile of source lock, its test and upgrade runner | passed, no diagnostics |
| Attestation-byte substitution during pending head observation | lock incorrectly succeeded; recorded hash A while verifier observed hash B |
| Reviewed-closure substitution during pending verifier | lock incorrectly succeeded; adopted closure not supplied at invocation |

All dependency hashes matched on initial and final reads:

| Artifact | SHA-256 |
|---|---|
| `tools/staging/hosted-setup-source-lock.ts` | `badd0ed72c06c1c5757385b58870d97d6a2d999db83637e98111587b57a87a9b` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `ce940497b2cb8c3165ab644cc802828f3018e6350c97c1e8804f267c597000e0` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |
| `evaluations/research-qa/hosted-setup-01-source-lock-repair-author.md` | `84c37f8d7bb94350dfa5df55c8779fd5a3efd10ac956b50dcc71ec1ba5c58428` |
| `evaluations/research-qa/hosted-setup-01-source-lock-independent-review1.md` | `ff50a30843dec6899436b7e6979eaa4b6f291508b317849bf7effc49db437b75` |
| `tools/staging/hosted-setup-upgrade.ts` | `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c` |

The full database-package regression and any actual PostgreSQL test were not rerun because F02 is independent of database behavior and the focused upgrade suite already exercised the composed migration boundary. No runtime loader, immutable-tree mechanism, artifact authenticator, publication verifier or operator launcher was implemented or accepted here.

## Disposition

The reviewed Candidate 2 bytes fail the runtime-attestation and reviewed-closure binding scope. The prior first-review failure is not erased; Candidate 2's architectural narrowing is sound direction but does not close the new mutable-input gap. Restore acceptance, publication, continuous writer stop, durable journal, postcommit reconciliation and live execution remain separate unfulfilled gates. This review grants no migration, deployment or hosted authority.
