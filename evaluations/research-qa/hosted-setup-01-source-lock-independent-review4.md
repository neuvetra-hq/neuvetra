# HOSTED-SETUP-SOURCE-LOCK-QA-04 — holistic independent review

2026-09-26. **Component verdict: FAIL.** New **SOURCE-LOCK-QA-F04 [P1]** permits verifier-result mutation before the supposedly synchronous snapshot. **SOURCE-LOCK-QA-F05 [P2]** accepts malformed runtime pin paths/digests. The narrowed pinned-SQL and at-most-once-invocation component passes; F03's malformed preload/loader-list regression is repaired. External executable authenticity, complete loaded-module closure, operator integration and hosted authority are **NOT ESTABLISHED**.

Reviewer: `/root/source_lock_holistic_qa`, fresh Head of QA/security review context, not an author of any reviewed implementation. Task: HOSTED-SETUP-SOURCE-LOCK-QA-04. Requested gpt-6-astra/high; observed model, effort, token use and cost unknown. QA role hash: `0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94`; security role hash: `3b3c1d31d5e5e35bf90ad971d4511a7693b7f14d12f2eb7ac0ed4723cc0b79d3`.

Read: operating instructions, QA/security roles, improvement workflow/role registry, leading board/continuation sections, current hosted-setup ledger scope, corporate direction/roadmap, local notes index and September 25 hosted rebuild brief; complete candidate and tests, staging migration and upgrade dependencies, relevant staging audit boundary, prior independent reviews 1–3 and repair-3 author handoff. This review writes only this file. No candidate/code/operations/Git mutation, credential access, provider/hosted action or external/native database connection occurred. The existing upgrade suite exercises ephemeral embedded PGlite locally; the additional probes use synthetic evidence and an in-memory database adapter.

## F04 [P1]: synchronous verifier return yields before evidence is copied

Location: `tools/staging/hosted-setup-source-lock.ts:225`, `snapshotRuntimeAttestation(await verifyRuntimeLoadedCode(verifierBytes))`.

The verifier API explicitly permits a synchronous result. Nevertheless `await` always yields before `snapshotRuntimeAttestation` runs. A microtask that holds the returned object can change the evidence between verifier return and snapshot. This is a remaining argument-stability hole, distinct from the fixed mutation during the later executable-realpath await.

Independent reproduction used real migration collection, the exact invocation-time artifact bytes and a verifier that parses those bytes. The pinned artifact explicitly contained `runtimePreloads: ['unreviewed-preload.ts']`. At synchronous return the parsed object contained that same list. A queued microtask cleared the list before the lock resumed. The exported lock **accepted**, retaining the SHA-256 of the artifact declaring a preload while accepting an empty-list assertion that was absent from that artifact.

```ts
const bad = {...validAttestation, runtimePreloads: ['unreviewed-preload.ts']};
const bytes = new TextEncoder().encode(JSON.stringify(bad));
const input = {...validInput, runtimeAttestation: {bytes, sha256: sha256(bytes)}};
await lockHostedSetupSource(input, {
  currentProductHead: () => reviewedHead,
  verifyRuntimeLoadedCode: artifact => {
    const result = JSON.parse(new TextDecoder().decode(artifact));
    queueMicrotask(() => { result.runtimePreloads.length = 0; });
    return result;
  },
}); // Observed: accepted; artifact still declares a preload.
```

Observed artifact SHA-256 for this process-specific reproduction: `fd85cddf081a18357782296471630d883a3b1a7f8f95bc82c9865f0c0668bc15`. Process ID is part of the artifact, so a rerun will have another artifact hash. No filesystem changes, modified source, falsified parser result at return, hosted action or native database is required. The probe deliberately schedules a shared-object mutation; it does not establish that a future concrete verifier will do so. The advertised component boundary must nevertheless either isolate the result correctly or explicitly require an immutable ownership-transfer contract and enforce it.

Required repair: snapshot synchronous verifier results in the calling turn, without an unconditional await. Define and enforce an immutable result handoff for asynchronous verifiers too; copying only after arbitrary promise resolution cannot protect an object that its producer mutates before the consumer continuation. Prefer having the verifier authenticate the already-pinned private bytes and the consumer independently parse/validate those exact private bytes, or another reviewed immutable return contract. Preserve caller-input and post-resolution protections. Add the exact synchronous microtask regression, plus the applicable asynchronous handoff case. Do not repair this merely by adding another delayed hash of the shared object.

## F05 [P2]: runtime pin shape validation admits traversal and non-string digests

Location: `tools/staging/hosted-setup-source-lock.ts:115-126`, especially the path and digest checks at 120–121; snapshot at 134.

Two independent exact-artifact probes constructed accepted locks after recomputing the matching closure and artifact hashes:

1. Add sorted pin `{path:'zz/../../outside.ts', sha256:'b'.repeat(64)}` alongside all required pins. It passes because the validator only forbids a leading `../`; resolved against the repository it escapes to a sibling path. The field fails the declared repository-contained runtime-pin meaning.
2. Replace one required pin's digest with `[originalDigest]`. `DIGEST.test(pin.sha256)` coerces this one-element array into a digest string and accepts it. The snapshot preserves the array rather than obtaining a string; it is not the declared scalar digest schema and remains a shared nested object despite freezing the pin wrapper.

Observed accepted artifact hashes: traversal `32c7045a40e2ec391774333a26d53382e41eaba493f0ee90bbd4e7c51a403280`; array digest `416e2fbfc0f9849e48c0a9bd4bd9b5d576a3ef1d4dfb869380aa93fc6e8b10b6`. These hashes are process-specific for the same reason as F04.

This does **not** demonstrate arbitrary SQL execution or an implemented loader escaping the repository. The component never loads these pin paths, and actual graph authenticity is external. It does demonstrate malformed closure evidence being admitted by its own structural gate. Reject non-string digests before regex use; require canonical nonempty path segments, forbid dot/dot-dot segments and validate resolved containment with the stated root policy. Regression tests must recompute a matching closure; testing a malformed pin only against an unchanged digest can hide the structural defect behind a closure mismatch.

## Whole-contract dispositions

| Boundary | Disposition and evidence |
| --- | --- |
| Module-anchored SQL | PASS, bounded. `import.meta.url` anchors collection; the real cwd-independence test passed. The normalized manifest has 23 entries and SHA-256 `ec11c9b39bb706f64c970745d0d122ec5fb76b480ea0cd2362d685c8b2620452`. |
| Filesystem symlinks/path checks | PASS for tested static checks: repository root equality, file lstat and resolved path equality reject the injected symlink/junction cases. Not an OS-level atomic no-follow open: lstat, realpath and read are separate awaits. A hostile swap remains outside the proven path-origin claim; differing SQL still fails the reviewed manifest digest, and retained SQL is not reread. An accepted immutable tree is still required. No real symlink-swap stress test was run. |
| SQL pin and execution | PASS, bounded. The migration helper copies, verifies and freezes the ordered manifest before its first await. Existing backing-file mutation and caller-manifest mutation tests passed. Independent clone mutation left subsequent manifest reads and executed migration 23 unchanged. |
| Invocation-time caller snapshot | PASS for the existing pending-head byte substitution and pending-verifier closure substitution tests. Inputs and dependency function references are captured before the first await. Independent verifier-byte-copy mutation was rejected by the post-verification digest check. |
| Verifier snapshot | FAIL, F04. Existing later-realpath mutation test passes, but the synchronous return-to-snapshot microtask gap remains. |
| Missing/unknown evidence | F03 repaired: independently reran all eight missing/null/string/object preload/loader variants, all rejected. Both explicit nonempty lists rejected; empty control accepted. Missing pre-import/tree/graph flags, material-findings count, PID and pin array also rejected. Runtime-pin schema still fails F05. |
| Single-use state | PASS for at-most-once invocation on a lock instance. Independent pending synthetic transaction rejected a concurrent wrapper and second migration call; exactly one transaction and original SQL execution occurred. Callback failure and callback without migration both consumed the lock and blocked retry. This is not guaranteed successful commit, cross-process reservation, or prevention of constructing another lock. |
| Artifact authenticity and loaded graph | NOT ESTABLISHED. A caller-provided verifier can return synthetic claims; byte hashing and required-pin membership are not signature/authentication or actual graph measurement. Same PID/module/root/executable/head assertions are checked, but no accepted pre-import launcher/immutable runtime mechanism/authenticator exists here. Fixed required pins are only a minimum, not proof of every bare dependency, dynamic import, runtime native dependency or resolver input. |
| Upgrade integration | NOT ESTABLISHED. The upgrade runner must receive the same lock's `migrationManifest`, `withImmutableMigrationSource`, and `migrate` methods together. Its manifest/migrate defaults still use disk-backed helpers. Wiring only the wrapper can invoke a default migration before the wrapper notices `migrationEntered` stayed false. This is an explicit integration prerequisite, not permission to partially wire the component. No concrete production wiring was found in the scoped staging search. |
| Hosted upgrade authority | NOT ESTABLISHED. Concrete restore/publication verification, fresh held writer gate, same runtime and source identity, trusted database adapter, durable no-replay journal, postcommit reconciliation and exact reviewed operator integration remain separate gates. No current hosted fact was observed in this review. |

The mutable input/output boundaries of the general upgrade runner also require a complete integration review before live use; this source-lock verdict does not extend immunity to caller-owned runner evidence or adapters. The source lock binds reviewed SQL and claims, not database destination/credentials, an independent human's authority or a durable once-only operation across processes.

## Validation actually performed

- Bun 1.3.12: `bun test tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-upgrade.test.ts --timeout 30000`: **18 passed, 0 failed, 109 assertions**.
- Strict focused TypeScript: `bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-source-lock.ts tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-upgrade.ts`: passed, no diagnostics.
- Independent stdin probes: accepted control; 8 malformed-list refusals; 2 nonempty-list refusals; 6 missing-evidence refusals; reproduced F04 and both F05 shapes; independently confirmed clone isolation, concurrent at-most-once execution, consumption after failure/no migration, and rejection of verifier byte mutation.
- Initial sandbox Bun execution failed with EPERM before tests loaded; the identical focused run succeeded after bounded permission escalation. This was an access issue, not an initial product test failure. No permanent probe code was added.

Unrun: actual external launcher/authenticator, hostile OS filesystem race, native PostgreSQL, provider/hosted state, actual target operator integration, full unrelated repository suite. Existing embedded PGlite evidence is not proof of a live upgrade or complete database preservation.

## Exact reviewed bytes

Initial and final hashes matched before this report was written.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-source-lock.ts` | `1f022cd69c6a4751807a5dabc61dd94f0f659665754f4c952fc32707e69ba448` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `9b35a37f1f45b097e3aaac901c66ae0911866eacbc4494f01d8c1f41a00ae1f9` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |
| `tools/staging/hosted-setup-upgrade.ts` | `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c` |
| Repair-3 author handoff | `7ec1910811c6d5285de36a4e804829d33a85b1dd78fa093f2c011b585816d5f6` |

Next owner: root and source-lock author. Preserve all prior failures; repair the complete evidence handoff and pin schema, then return exact bytes and adversarial regressions for independent re-review. Component acceptance is withheld. This review grants no migration, deployment, invitation or hosted mutation authority.
