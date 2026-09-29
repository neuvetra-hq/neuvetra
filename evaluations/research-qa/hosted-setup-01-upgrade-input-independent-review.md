# HOSTED-SETUP-UPGRADE-INPUT-QA-01 — independent runner review

2026-09-26. **FAIL for the changed upgrade runner.** Invocation-time caller input and ordinary own-property dependency snapshots work, but mutable verifier outputs and a mutable returned manifest can change accepted evidence after validation. Relative journal resolution can also change between validation and open. No actual database or hosted action was performed.

Reviewer `/root/source_lock_holistic_qa` did not author the runner or its tests. Requested QA route gpt-6-astra/high; observed model/effort, token use and cost unknown. The earlier role, board, operating and corporate context remains applicable. Read the complete changed runner/test, the source-lock integration boundary, and the concrete accepted-restore verifier. Only this report was written; no candidate, shared operations, Git, hosted/provider, secret or external/native database action occurred. Embedded PGlite was exercised by the existing local suite; independent probes used synthetic objects and in-memory journal/database adapters.

## UPGRADE-INPUT-QA-F01 [P1] — mutable verifier results replace accepted evidence

Locations: `tools/staging/hosted-setup-upgrade.ts:265-267`, consumed at `273-278` and `284`.

`privateInput` copies the caller's artifacts, but `restore`, `product` and `stop` are the objects returned by supplied verifiers. They are retained and reread across later awaits. Validation does not establish a private immutable snapshot. The product result even waits for `currentProductHead()` before its first validation.

Two independent synthetic reproductions reached `hosted_setup_schema23_committed_and_observed` with one migration:

1. A valid accepted restore result initially bound fingerprint `74b278c75c81a47666835babac74addd8f272d4db3bf4c9da38c13573eb85b0e`. The observed schema-22 fixture contained a changed legacy company row and hashed to `c3b6e4c31f9f793bcc2f623799e855c1d71013a0d38fffc4da047763dec89620`. The unchanged-result control refused before migration with `hosted_setup_upgrade_refused_no_retry_on_this_journal`. In the negative case, the subsequent publication callback changed `restore.expectedDatabaseFingerprintSha256` to the changed fixture hash after the restore result had passed validation. The runner accepted that new baseline, invoked migration and emitted success.
2. The publication result initially bound closure `4444...4444` (64 characters) and passed `validateProductHead`. During the later migration-manifest callback, its `sourceClosureSha256` changed to `5555...5555`. The journal reservation, immutable-source binding and success path used the new closure. The previously validated closure was not retained.

Minimal timing pattern:

```ts
verifyAcceptedRestore: () => restoreBinding,
verifyReviewedProductHead: () => {
  restoreBinding.expectedDatabaseFingerprintSha256 = hash(changedBefore);
  return publicationBinding;
},
// Separate probe, after publication validation:
migrationManifest: async () => {
  publicationBinding.sourceClosureSha256 = '5'.repeat(64);
  return manifest;
},
```

These probes model shared returned objects, not actual compromised hosted services. The concrete `verifyAcceptedHostedSetupRestore` currently returns frozen primitive fields, so the specific restore mutation cannot affect that implementation's result. This mitigates that one adapter; the generic runner contract and publication/write-gate handoffs do not require or enforce immutable ownership, and no complete accepted composition was tested.

Repair the whole verifier-result handoff with strict required scalar types and an enforceable immutable result contract or privately derived authenticated evidence. Capture before further awaits, including the pending current-head observation. A simple `snapshot(await verifier())` still admits the synchronous-return microtask gap established in source-lock F04. Ensure old/new write-gate comparisons compare retained values, not references to a shared object. Preserve unknown evidence as refusal.

## UPGRADE-INPUT-QA-F02 [P2] — journal location is validated and used under different path contexts

Locations: `tools/staging/hosted-setup-upgrade.ts:186-187` and `270`.

Validation resolves the journal path against the current working directory and compares it with `resolve('.')`. Later the original path string is sent to `openJournal`. Independent probe: from the repository root, use `journalPath='../qa-relative-no-disk.jsonl'`; after validation the restore callback changes cwd to the repository's `tools` directory. The journal opener receives the same relative string, now resolving to `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/qa-relative-no-disk.jsonl`, inside the repository. The in-memory run reached success. Cwd was restored in a finally block; no file was created at that path.

The comparison also uses cwd as a proxy for repository identity, which is not necessarily the importing module's repository. Capturing the string alone does not capture its filesystem meaning. Require or capture an absolute path before the first await, enforce outside-repository location against a module-anchored root, and open that exact captured path. Define the allowed parent symlink/junction policy in the concrete journal integration. Preserve exclusive-create behavior and durable reservation; do not repair by choosing a fresh fallback journal on error.

## UPGRADE-INPUT-QA-F03 [P1] — mutable manifest diverges from its recorded reviewed hash

Locations: `tools/staging/hosted-setup-upgrade.ts:268-280`.

The runner hashes the dependency-returned manifest, then retains that mutable array and rows through journal opening, preflight, execution and comparison. Independent probe reused only the existing synthetic `before`/`after` fixture constructors and supplied a new mutation at journal opening:

```ts
migrationManifest: async () => manifest,
openJournal: async () => {
  manifest[22].sql = 'select 999 /* after hash */';
  manifest[22].sha256 = sha256(manifest[22].sql);
  return inMemoryJournal;
},
migrate: async () => ({schemaVersion: 23, migrations: manifest}),
```

The fixture's pre/post snapshots stayed internally consistent with the migration the supplied adapter reported. The runner emitted success with one migration while its journal claimed the original reviewed manifest:

- Initial/reviewed/recorded manifest: `9238a951bd43aca02c0bd851eda6ccbd3fc0b6115370f2221a93f4f84425ec89`.
- Mutated manifest: `9750e0746d2ea077bac23c2883a6ebcc4f37bf92e90fd3157d969b7948768760`.
- Result migration-23 digest: `29923dbb989963bb98cabeac8bdcb1e0b690db6bc8e91b95408696d6f596e1d2`.

This demonstrates incorrect runner evidence binding with synthetic adapters; it does not demonstrate executing that SQL on a database. The accepted source lock's internal manifest is private and frozen, and its manifest getter returns an unshared clone, so correct full wiring provides a stronger boundary. The runner nevertheless accepts a shared manifest under its public dependency contract and can report a different migration from the reviewed hash. Privately copy and validate the complete ordered manifest at the handoff, retain it for every later check, and require execution/result evidence to match that captured manifest. Preserve correct full source-lock wiring rather than weakening it.

## Passed checks and limitations

- Caller artifact objects are read once into frozen private wrappers before the first await. The existing pending-verifier input-mutation test passed. An independent getter probe counted all eight artifact-property getters and all sixteen bytes/digest getters: **24 getters, each read exactly once**.
- Independent caller/dependency replacement while restore verification was pending retained the captured publication function and reached its expected sentinel. A separate initial probe used an original function whose closure still referenced the mutated input and correctly refused on head mismatch; copying functions cannot freeze their captured state. The final sentinel probe separated method replacement from mutable closure behavior.
- `Object.freeze({...sourceDeps})` captures ordinary own enumerable properties. It does not copy prototype methods from class instances; concrete adapters must not silently rely on prototype-method support. This is an integration limitation, not a demonstrated fail-open in these probes.
- Existing preflight/source refusal, uncertain migration result, postcommit/receipt failure and exclusive journal tests passed. No-retry status strings remain correct in those tested paths, and default exclusive creation refuses an already-existing journal. These are not proof of a cross-process reservation spanning arbitrary alternate journal paths.
- Restore verification has exact historical artifact pins and returns frozen scalar bindings. That does not establish live currentness. Source-lock execution remains private pinned SQL when all three methods are correctly connected; partial runner wiring remains unacceptable.

## Checks actually run

- Bun 1.3.12: `bun test tools/staging/hosted-setup-upgrade.test.ts --timeout 30000`: **8 passed, 0 failed, 63 assertions**. Includes local embedded PGlite.
- `bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-upgrade.ts tools/staging/hosted-setup-upgrade.test.ts`: passed, no diagnostics.
- Independent stdin probes: success control; changed-baseline refusal control; restore fingerprint substitution; publication closure substitution; journal cwd drift with no disk write; single-read getters and retained dependency sentinel; manifest substitution with original journal hash retained.

The initial guessed restore-verifier filename did not exist; the actual inspected module was `hosted-setup-accepted-restore.ts`. No native PostgreSQL, provider, current hosted state or actual operator composition test occurred. Full unrelated repository checks were not repeated. No permanent probe source was added.

## Exact reviewed bytes and integration status

Initial and final reviewed runner/test hashes matched.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-upgrade.ts` | `877b77dee8d42606dba69511fe1e8b77ff5c404414764860d96218b9625e2b56` |
| `tools/staging/hosted-setup-upgrade.test.ts` | `6c0d064e690c92f373f63f2291a88cf43083c71fcb0c7c72b7f631c11a1cafed` |
| `tools/staging/hosted-setup-source-lock.ts` | `8201172e25271da9dd3625ece7976dc002639adfb11d9ec9a996e240a82f0a5c` |
| `tools/staging/hosted-setup-accepted-restore.ts` | `a5f4e5feb5aa5d651d222413f075142ca200171272cacb60b732470625342395` |

**Source-lock review 5 was against old runner dependency hash `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c`.** Its historical component verdict does not approve this changed import graph. Repair the runner, return exact bytes and regressions, then independently review the integrated composition and new runtime closure. Root owns correction and operational disposition. This report grants no migration, deployment or hosted mutation authority.
