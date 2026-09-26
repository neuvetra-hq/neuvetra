# HOSTED-SETUP-SOURCE-LOCK-01 author handoff

**Role/mode:** Security and reliability implementation under CTO.  
**Execution context:** `/root/convergence`.  
**Routing:** requested `gpt-6-astra/high`; actual model and effort were not observable.  
**Baseline:** local rolling-PR checkout at `f8bde80515ce69830add7ac543bca96cd49c27ff`.  
**Status:** implementation candidate complete; independent QA required. No hosted action, credential access, migration, deployment, Git publication or database mutation was performed.

## Implemented boundary

`hosted-setup-source-lock.ts` reads the executable closure once before an upgrade attempt. It recursively resolves the source lock, the unchanged upgrade runner and their relative TypeScript imports; it explicitly includes all 23 migration files, `bun.lock`, and the relevant package/TypeScript resolver files. Every raw file byte sequence is hashed, sorted and bound with the exact 40-character reviewed product head. This is an explicit 95-file current closure, not a blanket repository hash.

The lock separately builds the normalized 23-entry migration manifest from those same in-memory SQL bytes. It checks the current-head observation, reviewed manifest hash and reviewed closure hash before returning a one-use adapter. The adapter supplies all three coupled upgrade dependencies:

```ts
const locked = await lockHostedSetupSource(reviewedBinding, {currentProductHead})
await runHostedSetupUpgrade(db, input, {
  ...otherReviewedDependencies,
  migrationManifest: locked.migrationManifest,
  withImmutableMigrationSource: locked.withImmutableMigrationSource,
  migrate: locked.migrate,
})
```

The wrapper refuses a changed runner binding, use outside the lock, a second callback or a second migration. The migration function can consume only its private pinned manifest.

`staging-migrations.ts` now exports `migratePrivateStagingFromManifest`. It copies, orders, hashes and freezes all 23 entries synchronously before its first `await`, then executes those strings without rereading a migration file. Existing `migratePrivateStaging` remains compatible: it reads the manifest once and delegates to the pinned API. No change was made to `hosted-setup-upgrade.ts`, fingerprint derivation or hosted state.

## Adversarial evidence

Final local checks:

- `bun test tools/staging/hosted-setup-source-lock.test.ts tools/staging/hosted-setup-upgrade.test.ts --timeout 30000`: **11 passed, 118 assertions**.
- `bun test packages/neuvetra-database/src --timeout 30000`: **55 passed, 9 skipped, 651 assertions**. The nine skips are the pre-existing actual-PostgreSQL cases that require an external configured runtime.
- Existing independent upgrade regression: **1 passed, 34 assertions**.
- Database package and focused source-lock TypeScript checks: passed.
- `git diff --check`: passed.

The focused tests verify:

1. deterministic, unique, transitive closure resolution with the runner, staging helper, audit helper, workspace dependency, lock/config files and every migration;
2. mutation of every backing file after pinning does not change the SQL executed and causes no further source reads;
3. current-head, manifest, non-SQL source, SQL source, unresolved-dependency and runner-binding mismatches refuse;
4. use outside the lock and lock reuse refuse;
5. changed, incomplete or reordered in-memory manifests refuse; caller mutation after invocation cannot alter the executed SQL.

The first focused run is preserved: three closure tests timed out because the recursive walker revisited processed modules, and the readonly manifest return type conflicted with the unchanged upgrade runner. The walker now tracks processed modules, while the existing public reader keeps its prior mutable type and the execution API privately repins an immutable copy.

## Exact candidate bytes

| Artifact | SHA-256 |
|---|---|
| `tools/staging/hosted-setup-source-lock.ts` | `18d6535a50d4049a4d1e9b1e90b965fdfdc00e91762d97499b99916485787592` |
| `tools/staging/hosted-setup-source-lock.test.ts` | `8db78442534d4805ab3a334981ce106cbb23ee1dfea15a7a67a8d81eccf521ee` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |

The normalized manifest contains 23 migrations. Its current SHA-256 under the upgrade runner's canonical hash is `ec11c9b39bb706f64c970745d0d122ec5fb76b480ea0cd2362d685c8b2620452`; migration 23 remains `d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb`.

A local diagnostic using baseline head `f8bde805...` produced closure hash `16263e81da8fc0ea026a16fadda086975d372e9ded71f78f223f32650f6c72d1`. It is **not an execution pin** because the new candidate is not contained in that baseline commit. After publication and independent review, the closure must be recomputed with the exact new reviewed/remote head; the changed head intentionally changes the closure hash.

## Remaining gates and limits

- Independent QA must review these exact bytes and challenge closure completeness, pre-pin mismatches, post-pin mutation, one-shot behavior and use with the unchanged runner.
- The future operator integration must derive its expected manifest and closure hashes from the exact published head and pass the same current-head observer to the runner/source-lock boundary. It must not use the live inspection result as self-approval.
- The future concrete operator entrypoint and the still-pending restore/publication/write-gate verifiers require their own reviewed closure. This candidate covers the migration execution closure that exists now; it does not invent or approve those not-yet-integrated components.
- This lock does not stop writers or authorize the upgrade. Backup/restore acceptance, exact publication/check evidence, continuous application stop/write gate, durable journal, postcommit reconciliation and independent review remain mandatory.