# HOSTED-SETUP-SOURCE-LOCK-QA-03 — independent repair-2 review

Date: 2026-09-26. **Component verdict: FAIL — new SOURCE-LOCK-QA-F03 [P1].** The prior F02 argument-stability races are repaired, but the repair converts malformed or absent preload/loader evidence into affirmative empty lists. The pinned SQL and at-most-once invocation scope passes the focused review. No external runtime loader, executable identity mechanism, operator integration or hosted authority is accepted.

Reviewer: `/root/write_gate_qa`, independent Head of QA assignment; this context did not author the source lock, its tests, staging migration helper, upgrade runner or author handoff. Requested route: gpt-6-astra/high; observed compute and cost: unknown. QA role-prompt SHA-256: `0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94`.

Context: operating model and QA role, board rebuild brief, earlier source-lock reviews 1 and 2, repair-2 author handoff, current candidate source/test and relevant staging-migration/upgrade dependencies. Earlier shared mission/board context was retained from the preceding scoped review. Only this report was written; no candidate, previous review, shared operational file or Git state was changed. No hosted/provider action, credential access or external/native database connection occurred. The focused upgrade suite includes an ephemeral embedded PGlite migration test; this is local test evidence, not a hosted database exercise.

## SOURCE-LOCK-QA-F03 [P1]: snapshot turns unknown loader evidence into accepted absence

Location: `tools/staging/hosted-setup-source-lock.ts:129-132`, consumed by the check at line 234.

`snapshotRuntimeAttestation()` copies each preload/loader list only when it is an array; otherwise it substitutes `[]`. The later `Array.isArray(...) && length === 0` validation therefore passes both missing evidence and wrong-type evidence. Candidate2's direct validation rejected these shapes; this is a new regression introduced by the repair's snapshot construction.

Independent repro used actual migration-source collection, matching head/closure/manifest/process/module/executable/root values, and a verifier that simply parsed the **exact pinned artifact bytes it received**. For each field `runtimePreloads` and `runtimeLoaders`, separately set its artifact value to undefined (omitted by JSON), null, string `unexpected-loader`, or `{}`; recompute the artifact SHA-256; invoke the exported lock API. All **8 of 8 malformed variants constructed a lock successfully**. No disk mutation, compromised verifier, source change, race or hosted action is needed. The component accepts incomplete/nonconforming verifier output instead of failing closed. This is not proof that an actual external verifier would produce malformed output; it is a defect in this component's declared required-evidence boundary.

Minimal reproduction using the candidate fixture conventions:

```ts
const malformed = {...base.attestation, runtimeLoaders: 'unexpected-loader'};
const bytes = new TextEncoder().encode(JSON.stringify(malformed));
const input = {...base.input, runtimeAttestation: {bytes, sha256: sha256(bytes)}};
const lock = await lockHostedSetupSource(input, {
  currentProductHead: () => HEAD,
  verifyRuntimeLoadedCode: artifact => JSON.parse(new TextDecoder().decode(artifact)),
}); // Incorrectly succeeds. Repeat for either field and missing/null/object values.
```

Required repair: reject a missing/non-array `runtimePreloads` or `runtimeLoaders` synchronously while snapshotting, before normalizing or awaiting anything else. Alternatively preserve the invalid shape so downstream validation rejects it. Explicit empty arrays may pass; nonempty arrays must continue to refuse. Add regressions through the actual exported API with exact pinned artifacts and preserve the F02 timing protections. The same snapshot principle should apply to all required evidence: unknown must not be rewritten into an accepted negative assertion.

## Prior F02 disposition: repaired

The reviewer independently executed all three timing scenarios, beyond rerunning the candidate tests:

| Scenario | Observed Candidate3 result |
| --- | --- |
| Head observer pending; replace caller's byte array with same-length valid serialization in reversed property order | The replacement digest differs, but verifier receives original invocation-time bytes and inspection records their original digest |
| Verifier pending; change caller `sourceClosureSha256` from 64 zeroes to the actual attested closure | Refuses with `Runtime-loaded executable source differs from reviewed closure.` |
| Executable-realpath promise pending; mutate verifier result's first pin digest, operator, module-graph flag and preload/loader arrays | Lock retains original synchronous result snapshot and original closure; later mutations do not alter it |

Source inspection confirms caller binding strings, identities, digest, bytes and dependency function references are captured before the first await. The verifier receives a separate byte copy; its post-verification byte digest is checked. The returned attestation's required scalar fields and pin entries are copied/frozen immediately after resolution, before executable realpath awaits. The newly discovered F03 concerns malformed list validation, not failure of these timing fixes. Do not erase either earlier failed review when repairing F03.

## Accepted bounded behavior and limits

- Migration collection is anchored to the importing module rather than cwd. Actual cwd-independence test passed. Injected symlink-file and resolved parent-junction refusal tests passed. These are inspection/callback tests; no live symlink swap or hostile-filesystem stress test was performed. A trustworthy immutable runtime tree remains an external prerequisite.
- `pinStagingMigrationManifest` copies, hashes and freezes every ordered SQL entry synchronously. The source-lock callback state becomes active synchronously, and migration entry is consumed synchronously before the migration promise. It executes retained SQL without a later file reread. Focused backing-file change, mutable caller manifest and subsequent-entry refusal cases passed. This is at-most-once invocation, not guaranteed commit or full independent native-database preservation evidence.
- Independently recomputed migration count: **23**. Normalized manifest SHA-256: `ec11c9b39bb706f64c970745d0d122ec5fb76b480ea0cd2362d685c8b2620452`.
- Required runtime-source pins and matching closure claims do not themselves prove complete loaded code. This candidate depends on a future accepted pre-import launcher/verifier and controlled runtime/dependency resolution. The verifier fixtures use synthetic runtime pin digests and establish API behavior only.
- The upgrade runner's coupled manifest, immutable-source callback and migrate dependencies still require reviewed integration. Publication/head observers, restore acceptance, writer/operator controls, one-time durable journal and postcommit reconciliation remain separate gates. No source-lock receipt from this component alone grants hosted mutation authority.

## Checks actually run

| Check | Result |
| --- | --- |
| `bun test tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-upgrade.test.ts --timeout 30000` on Bun 1.3.12 | 17 passed, 0 failed, 98 assertions |
| `bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-source-lock.ts tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-upgrade.ts` | Passed; no diagnostics |
| Three independent pending-promise timing probes | Original bytes/bindings/results retained as described above |
| Eight exact-artifact malformed loader-list probes | 8 incorrectly accepted; F03 reproduced |

Bun/compiler access to the managed worktree required reviewed permission escalation. No external loader, native PostgreSQL, provider or hosted test was run. Full unrelated repository checks were not rerun.

## Exact reviewed bytes

Hashes were collected before tests and checked again before report delivery.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-source-lock.ts` | `be6f37a7f518c8666d22e13dba734f480adbc56b96b0550186c7e80222b71bd2` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `baed541188ac15f237c4a757c85dc189c4ec4c81b913fca0bf38cdd79fcdc65e` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |
| `tools/staging/hosted-setup-upgrade.ts` | `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c` |
| `evaluations/research-qa/hosted-setup-01-source-lock-repair2-author.md` | `11cce06da37fd8561fee45c5a967b3770ce65a11bd13945967472a88dd1525b3` |
| `evaluations/research-qa/hosted-setup-01-source-lock-independent-review1.md` | `ff50a30843dec6899436b7e6979eaa4b6f291508b317849bf7effc49db437b75` |
| `evaluations/research-qa/hosted-setup-01-source-lock-independent-review2.md` | `1dd64e2e34b08b14571e7f85ec94f69207907ca9a4eb9c31acdcd175f42e34b0` |

Next owner: source-lock author, coordinated by root. Repair F03, keep the prior failures, and return the changed bytes plus regression tests for targeted independent re-review. Component acceptance is withheld until required loader evidence fails closed.