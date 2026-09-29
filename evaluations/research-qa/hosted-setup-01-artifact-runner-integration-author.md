# HOSTED-SETUP-ARTIFACT-RUNNER-INTEGRATION-01 — author handoff

Date: 2026-09-26. Author: `/root/artifact_runner`, software-engineering specialist with CTO sponsorship. The critical registry route requested `gpt-5.6-sol` / `high`; this execution context did not expose observed model, effort, token-use or cost telemetry, so those values remain unknown. Role prompt SHA-256: `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b`.

## Outcome

The transactional runner now has a versioned artifact contract, `neuvetra.hosted-setup.artifact-transactional-upgrade.v2`. It no longer reads, validates, journals or passes the retired `sourceClosureSha256` / `withImmutableMigrationSource` contract. Instead, one cohesive artifact SQL lock supplies its exact `private-artifact-sql.v1` binding, pinned manifest, `withArtifactSource` operation and migration method. The runner requires the separately reviewed artifact binding to match that lock on reviewed product head, migration manifest and `executionArtifactSha256` before journal or database work.

The reviewed-artifact binding preserves the exact input publication receipt/review hashes, the artifact publication digest, remote/reviewed head, required-check disposition, operator/reviewer identities and zero-open-findings result. It also preserves the accepted artifact limits: `trusted-operator-host`, `verified-at-rest-artifact-and-private-sql-only`, `runtimeLoadedCodeAttested: false` and `launchAuthorized: false`. Those limits and the artifact identity are carried into the reservation journal and final receipt. Extra legacy closure fields, artifact-identity drift, publication-digest drift and inflated launch/loaded-code claims refuse before database work.

The existing one-transaction path is retained: the same physical PostgreSQL transaction applies table locks, the sequence fence, under-lock schema-22 fingerprint, pinned private migration SQL, preservation verification and pending-commit journal event. Migration-entry failures remain journal-consuming refusals, uncertain transaction outcomes remain no-retry, and resolution remains a separate read-only transaction after the original server transaction is observed as resolved.

The local compose uses only unmistakably synthetic mocks: fixed fake head/digests, synthetic approval artifact bytes and `approvalEvidence: "synthetic-mock-only"`. It does not treat the mock artifact lock as source authentication or launch authority.

## Blocking QA finding and repair

Independent QA found that the first candidate's handwritten `HostedSetupArtifactSqlLock.migrate` signature incorrectly required `Promise<string>`, while the accepted `lockHostedSetupArtifactSql(...).migrate` returns `Promise<{schemaVersion,migrations}>`. The compose mocks hid the mismatch by calling `JSON.stringify`. That first candidate is rejected for integration; its hashes remain in earlier coordination evidence and are superseded by the repaired bytes below.

The repair derives `HostedSetupArtifactSqlLock` directly as `Awaited<ReturnType<typeof lockHostedSetupArtifactSql>>`, removes the serialization shim from every mock, and privately copies, freezes and exact-shape-validates the real migration result before comparing every returned migration name/digest with the pinned manifest. A compile-checked test assignment now passes the exact real lock into the runner. The same regression creates a wholly synthetic at-rest artifact, calls the real `verifyHostedSetupArtifact`, obtains the real `lockHostedSetupArtifactSql` capability, and completes the runner through that capability. The test uses a synthetic safe catalog adapter for the existing-project containment audit; the separate native composition below exercises real PostgreSQL 17 catalog and transaction behavior.

## Validation

- Focused runner suite: `bun test tools/staging/hosted-setup-transactional-upgrade.test.ts --timeout 30000` — **17 pass, 0 fail, 103 expectations**. This includes the direct real verifier/lock/runner regression.
- Native composition: `bun test tools/staging/hosted-setup-transaction-compose.test.ts --timeout 120000` — **1 pass, 0 fail, 56 expectations**, Bun 1.3.12 and PostgreSQL 17.11 on fresh loopback port 50274. Commit marker present; deliberate rollback and timeout markers absent; replay refused before transaction; final compose sessions and locks both zero. Retained disposable fixture: `C:/Users/nimab/AppData/Local/Temp/hosted-setup-compose-yPdRMw`.
- Strict TypeScript over the runner, compose, child and both tests — **PASS**, no diagnostics:

```text
bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-transactional-upgrade.ts tools/staging/hosted-setup-transactional-upgrade.test.ts tools/staging/hosted-setup-transaction-compose.ts tools/staging/hosted-setup-transaction-compose.test.ts tools/staging/hosted-setup-transaction-compose.child.ts
```

The first sandboxed Bun invocation failed before test execution with Windows `EPERM` while reading the managed worktree. The same read-only suite ran outside that restricted sandbox. Its first executable run found one stale expected error message after the new cohesive-lock precondition; the expectation was corrected, and the final run above passed. No implementation failure was hidden or relabeled.

During the repair, the first authentic-lock regression reached the real migration and exposed that the original PGlite fixture had not established legacy containment. An attempted catalog preparation then hit PGlite's `tuple concurrently deleted` defect on database privilege revocation. The final focused regression uses an explicit synthetic safe-catalog adapter for that audit only and leaves all migration/result/runner calls real; PostgreSQL 17 composition independently covers the real catalog path. These two first failures are preserved rather than counted as passing evidence.

## Exact candidate bytes

| Artifact | SHA-256 |
| --- | --- |
| accepted read-only `tools/staging/hosted-setup-artifact-source.ts` | `3e1069aba42eca77a861f9c395c966269758a79a16207c53c19b15b6c8d4c691` |
| `tools/staging/hosted-setup-transactional-upgrade.ts` | `e4819c88fd17b64c6f9e6e18149c6c8803d136cf388f9b69fb38af9698b30cc4` |
| `tools/staging/hosted-setup-transactional-upgrade.test.ts` | `9dc21cf9132120d439a19fa9b74356a850413d1d8e6143fc29bb4655921c0ae4` |
| `tools/staging/hosted-setup-transaction-compose.ts` | `8fcee47ec1275a315f63fd3fb2ce5f764e250c25029e37710ec1252e9e8a3159` |
| `tools/staging/hosted-setup-transaction-compose.test.ts` | `4eec7ab6b3fb500004b6063ad07efb80304b1240690ea1aefab2a9acaf073dca` |
| unchanged `tools/staging/hosted-setup-transaction-compose.child.ts` | `20abad7a82e41d4923edc256b6d88da75ac4857c5223764c07f3536c3617706d` |

## Required integration and limits

The successful native composition proves only the runner/adapter behavior with synthetic approval and artifact mocks. A trusted publication binder and supervisor remain essential and are outside this file ownership. The binder must receive the authentic `ArtifactInspection`, the exact lock returned by `lockHostedSetupArtifactSql(inspection)`, and independently authenticated publication review evidence; verify the inspection profile, trusted-host boundary, claim, reviewed head, publication digest, execution-artifact digest, manifest digest and operator/reviewer identities against the exact input artifacts and remote check disposition; then return the exact `ReviewedExecutionArtifactBinding` fields with both authority flags false. The supervisor must keep that inspection and lock paired, supply the real one-shot worker, dedicated database client, credentials and external journal, and enforce fresh-process termination and separate uncertain-commit reconciliation. The runner's structural interface alone cannot prove method provenance or runtime-loaded JavaScript identity.

The intended worker API sequence is: call `verifyHostedSetupArtifact(paths, policy)` once; call `lockHostedSetupArtifactSql(inspection)` once; retain the result as `HostedSetupArtifactSqlLock`; build `HostedSetupTransactionalDependencies` with that exact `artifactSqlLock` plus a closure-bound `verifyReviewedExecutionArtifact` that authenticates the exact inspection/publication review; then call `runHostedSetupTransactionalUpgrade(db, input, dependencies)` once. The worker must pass the lock unchanged. It must not serialize `migrate`, replace lock methods, construct a structurally similar object or infer launch authority from successful at-rest verification.

The required schema-22/23 bridge image will be deployed before the stop, which will change the Site-Web deployment ID and commit currently frozen in `HOSTED_SETUP_MAINTENANCE_TARGET`. This candidate cannot accept that future stop receipt. A separately owned, independently reviewed dynamic exact-deployment binding must replace the historical fixed deployment/commit before live use; one writer should own subsequent runner edits after this hash freeze.

No live source authentication, operational launcher, provider call, credential read, hosted database connection, deployment, stop, migration, Git publication, package/database mutation outside disposable fixtures, or claim of live readiness occurred. Independent QA must review these exact runner and compose bytes before any integration or live use.
