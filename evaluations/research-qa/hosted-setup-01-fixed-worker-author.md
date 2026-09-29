# HOSTED-SETUP-FIXED-WORKER-01 — bounded author handoff

2026-09-26. Author `/root/artifact_launcher`, software-engineering under CTO/CEO. Requested registry critical route `gpt-5.6-sol/high`; actual model/effort and resource usage unknown because this follow-up cannot override the existing context. Refreshed role hash `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b`; applied L04/L06 to public process lifecycle and uncertainty. Independent QA is pending.

## Disposition

**Delivered fixed supervisor/worker mechanics, with no production evidence binding or launch approval.** All returned records retain `launchAuthorized: false` and `noAutomaticRetry: true`. The required fixed integration module, `tools/staging/hosted-setup-artifact-bindings.ts`, is absent from the actual repository as checked at author freeze. The real worker refuses before adapter construction if it is absent. Root explicitly owns that future module; this assignment neither created a permissive binding nor invoked hosted work.

New files are `hosted-setup-artifact-worker.ts`, `hosted-setup-artifact-supervisor.ts` and their tests under `tools/staging/`, this report and the task run record. No existing verifier/materializer/runner/adapter/provider, live service, Git state or source corpus was edited. There were no database connections, credentials, provider calls, installations or network acquisition in author tests.

## Fixed execution path

The supervisor takes the existing exact artifact paths/trust policy, an explicit `upgrade` or `reconcile` mode, private JSON payload, new outer/transaction journal paths and a bounded deadline. Unknown request fields/flags refuse. It requires the supervisor path to name this module, verifies real non-aliased source/dependency/checkout roots, and requires new external journal files with conservative ordinary filenames. It exclusively reserves and syncs the outer journal, verifies the full artifact through the accepted verifier, then starts exactly one child at `tools/staging/hosted-setup-artifact-worker.ts` with an absolute pinned executable. The literal arguments disable env files and installation and select the exact config. The child receives a newly created home/config/temp directory and a fixed dependency-root NODE_PATH; arbitrary parent environment/flags are not inherited.

Private request data goes only over the child's stdin, after artifact validation, with an 8 MiB limit. It does not enter argv, the outer journal or errors. Worker stdout/stderr are independently capped at 64 KiB, unexpected stderr refuses, and only the exact structured result schema is accepted. The parent writes fixed statuses, process/count evidence and result digest; it never copies private input, arbitrary exception text or child stderr into the journal. A timeout, unexpected exit/output, journal/processing failure or malformed result yields `refused_or_uncertain`, never rollback or automatic retry. The deadline kills only the child object created for this attempt. New reconciliation requests always create a new process and need a new journal.

The worker reserves its one process-local invocation before accessing caller serialization hooks. It checks its own entrypoint root and runtime identity/version, re-verifies the artifact, confirms private NODE_PATH and pg entrypoint resolution, then imports only the fixed manifest-pinned bindings module. It never accepts a caller-selected module path, executable arguments or factory callback. The application runner and dedicated adapter imports are fixed. The worker obtains its own genuine private SQL lock for upgrades.

The connection factory is lazy: runner evidence preflight, stop observation and journal reservation occur before its first `db.transaction` opens the dedicated adapter. Reconciliation's original-transaction-resolution callback also precedes connection creation. A private counter claims the sole transaction before construction, and exactly one dedicated adapter construction site is available through this wrapper. Root query/exec/close methods are refused to the runner; the worker owns teardown. The connection options are privately copied before deferred imports. Completion requires one adapter and one transaction and one mode-appropriate runner status. Only the fixed result status and SHA-256 of the actual runner result leave the worker, rather than arbitrary binding objects. The actual runner's transaction journal remains the detailed transaction receipt source.

The supervisor bounds teardown/hanging code externally; the child has its own deadline as well. A process exit is not evidence that a server transaction resolved. Binding code remains reviewed trusted code and **must not construct another adapter or perform a second transaction itself**: these counters enforce the fixed worker-managed path, not a hostile-module sandbox. No complete runtime-loader graph or hostile-host filesystem isolation is asserted. The supervisor itself must be loaded under the trusted operator/host discipline; checking its disk hash does not retroactively attest an arbitrary already-compromised parent process.

## Root-owned binding contract

The worker exports TypeScript interfaces for the fixed module:

- `prepareHostedSetupArtifactUpgrade(context)` returns `{ clientOptions, input, dependencies }`. `input` is `HostedSetupUpgradeInput`; its journal path must exactly match the supervisor's transaction journal path. `dependencies` is `Omit<HostedSetupTransactionalDependencies, 'artifactSqlLock'>`; the worker supplies and overrides that field with its genuine lock.
- `prepareHostedSetupArtifactReconciliation(context)` returns `{ clientOptions, reconciliation }`, where reconciliation is the existing `HostedSetupUncertainCommitReconciliation` contract. An authentic original-server-transaction-resolution observer is required, not a request boolean.
- `context` contains mode, paths, policy, verified inspection, transaction journal path, private payload and deadline. It is an in-process trusted integration context, not independent authority.

Root must implement authentic restore/fingerprint, publication and exact-image stop bindings/current observations, exact DB/TLS target and original-transaction resolution through this **fixed path**, publish/pin its complete imports and dependency bytes in the artifact, and independently review that final composition. The current worker does not synthesize these facts. Provider integration or explicit production binding decisions do not belong to this author.

## Tests actually performed

`bun test tools/staging/hosted-setup-artifact-worker.test.ts tools/staging/hosted-setup-artifact-supervisor.test.ts --timeout 30000`: **7 passed, 0 failed, 48 assertions**, Bun 1.3.12. Installed strict TypeScript on all four files: **PASS**, no diagnostics, including compatibility with the current actual runner/client type contracts.

The tests package the **real worker, verifier and migration/SQL-lock dependencies** into private materialized synthetic artifacts. They deliberately replace the runner, dedicated adapter and bindings with small **synthetic lifecycle fixture modules** inside those same pinned archives. They exercise the exported supervisor, actual fresh Bun processes and private stdin/journal path, not an injected spawn callback. They do **not** establish native pg/database execution of this new worker or authenticate a real publication.

Observed cases:

1. One fresh child, one fixture adapter, one fixture transaction and one close; invocation counts/PIDs match. Ambient parent NODE_OPTIONS/BUN_OPTIONS are absent; source-root `.env` and a throwing Bun preload do not execute under the controlled profile. The synthetic private sentinel does not enter the journal. Reusing the outer journal refuses.
2. Missing fixed bindings and runner preflight refusal produce zero adapter constructions and no fixture DB calls. Exceptions containing the sentinel are not journaled.
3. A fixture runner's second transaction attempt refuses after exactly one adapter. A separately invoked reconciliation with unresolved original status constructs zero adapters; a resolved fixture control runs in a different PID and uses exactly one new adapter. Those boolean fixtures test sequencing only, not authentic server resolution.
4. A nonsettling binding is terminated by the outer deadline and recorded uncertain/no-retry. A separate unrelated Bun child remains alive and is then explicitly cleaned up by the test. All test children exited.
5. Artifact drift is rejected before spawn. Extra caller flags refuse. Abrupt worker exit and unexpected stderr remain uncertain, create no fixture DB calls and do not copy private sentinel text into the outer journal.
6. A direct serialization-getter reentry attempt refuses the nested worker invocation before any adapter; the worker remains consumed afterward.

The first focused suite and compiler run passed (6 tests/36 assertions). Adding abrupt-exit/output and private-tree preload cases passed 7/48; the final private connection-options snapshot retained 7/48 and clean TypeScript. There is no hidden first product failure in these author runs.

Unrun: native PostgreSQL worker composition, real dedicated-client teardown and server deadline in this new entrypoint, loss during COMMIT, forced disk/journal I/O failure after a real migration, original-server-transaction reconciliation, live provider/TLS/evidence authentication and exact publication. Existing native runner/adapter reviews are useful dependencies but do not establish those unrun composed cases. The outer journal uses exclusive file creation and per-event sync; parent directory crash-durability and hostile shared-account access are not separately established.

## Frozen candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-worker.ts` | `1b13adb2e63fdfcc2adf298ce7653b93d7fff94ce75ab665bc0d8c6f388ea765` |
| `tools/staging/hosted-setup-artifact-supervisor.ts` | `258faea55ed095d79d3f6680830763945d9f5fb88abf3123d456fb5f3837d009` |
| `tools/staging/hosted-setup-artifact-worker.test.ts` | `0804a4b249ac11147555114123a02f79a34cb26457a51da3ba1a21814e76f890` |
| `tools/staging/hosted-setup-artifact-supervisor.test.ts` | `6a458f5df1686ada80a02009a2b2edb5742d094bf231b6e217af284fb7a45c5f` |
| Read-only actual transactional runner | `e4819c88fd17b64c6f9e6e18149c6c8803d136cf388f9b69fb38af9698b30cc4` |
| Read-only repaired materializer | `7f1c644e4b3520c51e585f283d52d2e3200ea5840e1723a1a841a1a6be42db3d` |

Next owner: independent QA for the fixed process boundary; root for the absent authenticated binding module and later exact native composition/publication. No hosted execution is authorized or claimed by this report.
