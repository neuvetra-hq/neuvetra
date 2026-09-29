# HOSTED-SETUP-ARTIFACT-LAUNCH-01 — bounded author delivery

2026-09-26. Author `/root/artifact_launcher`, security/reliability implementation under CTO/CEO. Requested critical route `gpt-6-astra/high`; observed model/effort, tokens and cost unknown. Role prompt SHA-256 `3b3c1d31d5e5e35bf90ad971d4511a7693b7f14d12f2eb7ac0ed4723cc0b79d3`. Independent QA remains pending. Root owns ledger, integration, publication and any subsequent execution decision.

## Disposition

**Delivered an offline artifact manifest verifier and private single-use SQL component, not an operational maintenance launcher.** Every successful inspection explicitly reports `launchAuthorized: false` and `claim: verified-at-rest-artifact-and-private-sql-only`. No complete loaded-module graph, hostile-host immutability, authenticated live publication, database preservation or launch authority follows from this component's success.

The CTO's `hosted-setup-01-execution-boundary-review.md` trusted-operator/host model is adopted. The old source lock, old refusal-only launcher, current transaction runner, dedicated/shared adapters, provider code, ledger, runbook and Git were not edited. No publication, provider operation, live credentials, customer data, DB connection or migration was used. Only the two new source/test files, this report and synthetic temporary test artifacts were written.

## Implemented contract

`verifyHostedSetupArtifact(paths, policy)` is built-in-filesystem verification with no injected reader, verifier callback, arbitrary executable flags or database capability. Required absolute paths identify publication receipt, source archive, private dependency archive, separately materialized source/dependency roots, executable, supervisor source and controlled config. Missing publication or dependency archive fails before any application import or database connection.

The **operator-provisioned trust policy** supplies an expected receipt digest, exact reviewed head, distinct operator/reviewer identities, required check names and active-checkout roots. This is a trusted external input; the component cannot authenticate how the operator obtained it. Supplying the digest of a self-authored receipt does not authenticate publication. No new signing key, signature prerequisite or pretend online observer was introduced.

The private receipt bytes must match that trust pin. The versioned publication receipt then binds `neuvetra-hq/neuvetra` / PR6 / exact head; each required check exactly once with successful conclusion at that head; review identities and zero material findings; a bounded observation/expiry window; complete source and dependency file inventories; raw and normalized migration pins; archive/runtime/supervisor/config digests; and the fixed future entrypoint/launch-policy identifiers. A fresh expiry check follows inventory work. Runtime config bytes must equal the fixed no-preload `logLevel` configuration. Filesystem verification refuses symlinks, junctions, nonregular entries, path traversal, case aliases, extra/missing files, checkout overlap and a `.git` entry. This is ordinary trusted-host path validation, not an atomic hostile-path-race defense.

The receipt's source/dependency inventories are checked against **already materialized** roots. The archive bytes are hashed but not parsed or extracted. The component therefore does not prove that the trees were extracted from those archives; the trusted materializer remains a missing dependency. It verifies the exact tree inventories pinned by the trusted receipt. A private `node_modules/pg/package.json` inventory entry is required, but that existence check is **not** complete `pg` import resolution, executable package acceptance or dependency installation. No dependency network acquisition or package scripts run.

SQL files are read once during inventory verification. Raw hashes, UTF-8 validity, normalized SQL hashes and the canonical complete migration manifest are checked. Their immutable strings remain private. `lockHostedSetupArtifactSql` accepts only an object actually minted by this verifier in this process; copied/forged objects and a second lock construction are refused. Application migration code is imported only at this worker-side step. It validates the migration names against the existing migration implementation, returns detached manifest copies for runner preflight, retains its own SQL and permits a single migration invocation in a single source operation. Backing-file or caller-copy changes cannot change the retained SQL.

This worker-side import uses the component's currently loaded module context. It **does not authenticate that loaded JavaScript came from the inspected artifact**. The supervisor must eventually put this component and its migration dependencies into the reviewed private artifact and control the fresh worker's import path. Testing from a development checkout establishes private SQL semantics only.

## Runner integration mapping

| Existing runner interface | Replacement / required integration |
| --- | --- |
| `ImmutableMigrationSourceBinding` with `sourceClosureSha256` | Intentionally incompatible `ArtifactSourceBinding`, profile `neuvetra.hosted-setup.private-artifact-sql.v1`, reviewed head, `executionArtifactSha256`, migration manifest digest. No old closure field is emitted or silently reinterpreted. |
| `withImmutableMigrationSource(binding, operation)` | New `withArtifactSource(binding, operation)` with the same per-lock consumed-on-entry single-use behavior. Runner/publication/journal profile must be deliberately versioned before use. |
| `migrationManifest()` | Synchronous detached copies of the privately retained manifest, compatible as preflight data. Mutating these copies does not affect `migrate`. |
| `migrate(db, projectRef)` | Existing reviewed `migratePrivateStagingFromManifest` on private SQL, one call inside the new wrapper. Returns the existing structured migration result; an integrating runner adapter must serialize it where the current runner expects a string. |
| Source identity | At-rest execution-artifact digest includes the receipt digest, archive/runtime/supervisor/config/entrypoint binding and complete file inventories. It does not assert that all runtime imports were observed. |

The in-process WeakMap capability cannot be serialized into a fresh child. A real worker must mint its own capability using the supervisor-established paths and trusted policy delivered through a fixed private channel, after the supervisor has authenticated/materialized and pinned the package. A worker self-report alone does not establish those facts.

## Author checks and exact limits

- Bun 1.3.12: `bun test tools/staging/hosted-setup-artifact-source.test.ts --timeout 30000` — **10 pass, 0 fail, 57 assertions**.
- Strict installed TypeScript on both new files — **PASS**, no diagnostics. The initial compiler run found one test-only attempt to mutate a readonly array; the explicit test cast repaired it. Initial unprivileged Bun invocations were denied `EPERM` before loading the test/compiler; bounded local execution escalation succeeded. No test failure was converted into a pass by hiding it.
- Negative tests cover wrong trust pin/head/checks/reviewer/expiry; missing publication/dependency archive; changed source/dependency archive, executable, supervisor, config and installed dependency; unknown source files; a real external Windows junction; traversal/alias paths; arbitrary flags; wrong normalized SQL or binding; forged/reused capability; input mutation after invocation; concurrent/repeated source entry; and consumption after failure.
- A synthetic in-memory database adapter observed exactly one migration transaction and the accepted migration-23 SQL after both the backing SQL file and returned manifest copy were changed. This is **not** a native PostgreSQL transaction, adapter-construction or full runner test. Active-checkout drift was an unrelated synthetic file mutation; it proves the pinned component does not read that file, not a running production worker's import independence.
- A separate real Bun child probe used absolute runtime, literal flags (`--no-env-file`, `--no-install`, fixed config), private cwd/home and a constructed environment. A positive control executed the harmless local preload marker. Under the controlled profile local/home preload and `.env` fixtures did not execute/set the sentinel; inherited malicious `NODE_OPTIONS`, `BUN_OPTIONS`, `NODE_PATH` and PATH did not enter the child. A nonsettling synthetic child was killed by its own 200ms deadline and recorded `uncertain_do_not_retry`, never rollback. Probe files/observation: `C:/Users/nimab/AppData/Local/Temp/hosted-artifact-launch-probe-uICsOM/`. All spawned test children exited. This test harness is **not** an exported production supervisor, journal or migration launch path.
- No archive extraction, native `pg` resolution/connection, one-worker/one-dedicated-adapter enforcement, durable journal failure, server deadline, COMMIT disconnect, original-transaction resolution, native preservation race or real artifact publication test was performed. These remain the composed launcher acceptance criteria, not inferred from 10 local tests.

## Missing concrete dependencies and next owner

1. Root must obtain independently authenticated exact PR6 head/check evidence and provision a trusted receipt pin. No authentic publication receipt in the new profile was supplied or fabricated.
2. A reviewed materializer must create the private tree from the clean published source archive and a real complete private dependency archive, choose a working dependency layout, establish actual `createRequire(...package.json)('pg')` resolution entirely within that package, and bind its exact runtime/config/supervisor bytes. The two-tree offline interface is an input verification boundary, not a completed final runtime layout.
3. A fixed-entry supervisor/worker must bind this versioned source contract to the existing restore/publication/stop/sequence-fence/transaction contract, with one fresh worker, exactly one dedicated adapter/transaction, external exclusive durable journal, private credential channel, bounded teardown and uncertainty-preserving timeout. No new worker file is delivered by this assignment; the required entrypoint string is a future fixed launch identifier.
4. Independent QA must challenge that exact package and native restored PostgreSQL composition before root publishes/revalidates and considers any one-time hosted action. A fresh reconciliation worker requires independently authenticated original-transaction resolution. The board's preservation/demo requirements remain unchanged.

These are implementation/integration dependencies, not a request to add a new platform, signing infrastructure or board approval gate. The component is reviewable independently while all operational launch claims remain closed.

## Frozen candidate hashes

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-source.ts` | `0821c9f1a5fc4d03f0ae2a257a1fde614a4d1be6c57c3400374d0dde8e94f8c7` |
| `tools/staging/hosted-setup-artifact-source.test.ts` | `b711e47e0d1929e2bc6b7214b3bdf096bdef7c8633bf8403fd866b4660d42fa7` |
| Read-only old source lock | `b52b9f1d5347976b9bcb226917b40186e08a825dc2e4b78f1efe4a951053a20c` |
| Read-only transactional runner | `1cd07dc9789aec7f42b19c3951fde8c52844ff556e888ba0618d9b028bf719a4` |
| Read-only migration implementation | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |
