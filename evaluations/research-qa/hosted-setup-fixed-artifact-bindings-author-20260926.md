# Fixed artifact bindings: author Candidate 1

2026-09-26. Task `HOSTED-SETUP-FIXED-BINDINGS-01`. Author: `/root/collection_backend`, critical software engineering under CTO sponsorship. Requested route `gpt-5.6-sol/high`; observed model and effort are unknown because this follow-up could not expose or override them. No provider, database, credential, Git, deployment, scale, stop, migration, publication or live reconciliation operation was performed.

## Frozen candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-bindings.ts` | `1a05c80af013f462b71b17c13804f78a3bf2b738ffb00c17b2e6d85ed4051549` |
| `tools/staging/hosted-setup-artifact-bindings.test.ts` | `a0b06fc85b2e88575a0b04ef0c2f5746f43c4b68f9144a0960465fd0844defe1` |

These are working-tree byte hashes. Independent QA and publication are pending. The publisher already names the bindings entry as a source seed, but a committed publication has not been produced from these bytes.

## Implemented boundary

The additive module supplies the two fixed-worker exports. Upgrade preparation rejects unknown payload fields, accessors, symbols, prototypes, unsafe integers, malformed pins and mutable caller references. It derives target, product head, artifact identity, migration identity, operator and publication reviewer from the worker's verified `ArtifactInspection` and `ArtifactTrustPolicy`, rather than payload-selected callbacks or authorization booleans.

All nine restore artifacts use absolute private file references containing only path, SHA-256 and byte length. Preparation requires regular non-link files outside the source artifact, dependency artifact and every active checkout, rereads file metadata after reading, verifies exact length/hash, requires fatal UTF-8 for text artifacts, and assembles the existing `FreshRestoreEvidence` in worker memory. Binary archive bytes never enter supervisor stdin, journals or stdout and are zeroed after the one accepted restore-verifier call. A 9,466,390-byte archive fixture proves the payload remains below the worker's 8 MiB envelope; evidence under an artifact root refuses.

The publication receipt is read from the verified publication path and must equal the inspection pin. Its embedded historical head and independent PR-review pins are checked against exact evidence bytes. A separately trusted-host-pinned current PR-head observation must target `neuvetra-hq/neuvetra#6`, equal the reviewed head, postdate publication observation, remain unexpired and be at most five minutes old. This is an offline trusted-host observation, not a live GitHub API read by the isolated worker.

The restore callback requires exact runner callback bytes before invoking `verifyFreshHostedSetupRestore`. Publication callback output binds the verified at-rest execution artifact, source profile, migration manifest, current head, independent reviewer, false runtime-loaded-code claim and false launch authority.

The maintenance callback reconstructs the process-local deployment binding from exact receipt/review/policy pins, replays the original raw stopped pair through `verifyHostedSetupStopped`, requires the canonical stopped receipt and a separate exact v2 stop review, and emits the runner's dynamic reviewed stop binding for the exact deployment UUID, commit, image digest, fixed target, stopped configuration, operator and distinct reviewer. Serialized booleans cannot issue this binding.

For each runner phase—`before_transaction`, `under_lock_before_migration`, and `under_lock_before_commit`—the observer requires the exact order and binding, performs two new calls to the fixed Railway capture module, rejects overlap or any reused capture hash, requires capture start after callback entry and after the preceding phase, reruns the stopped verifier against the same image and configuration, then returns serialized JSON `true`. The fixed `withSequenceFence` export is passed directly. Dedicated-client options select the fixed hosted Supabase project, verified TLS CA, fixed timeouts and a per-attempt application name; the dedicated client remains responsible for URL, CA and PostgreSQL 17 validation.

Reconciliation deliberately has no acceptance path. It accepts only the exact reconciliation payload profile and then refuses with `ORIGINAL_TRANSACTION_RESOLUTION_PRODUCER_REQUIRED`. The worker has no authenticated original backend/session observation, so it cannot turn a serialized `resolved: true` assertion into authority.

## Validation

- `bun test tools/staging/hosted-setup-artifact-bindings.test.ts --timeout 30000`: **6 passed, 0 failed, 21 expectations**. Cases cover exact copied bindings, callback-byte drift, stale/untrusted current-head evidence, unknown payload fields, trust-pin swaps, historical-size private archive transport, evidence-location refusal, no serialized stop authority, exact dynamic stopped image, missing provider transport refusal, wrong phase refusal and unconditional reconciliation refusal.
- Relevant hosted chain across bindings, fixed worker/supervisor, artifact publisher/source, transactional runner, fresh restore, deployment binding, postscale, Railway capture and sequence fence: **94 passed, 11 skipped, 0 failed, 580 expectations**. The 11 skips are the sequence-fence suite's opt-in native PostgreSQL group; no live database was started for this task.
- Strict TypeScript for the new source and test plus their imports: **passed**, using ES2022, the repository Bun type root and package-local pg type root/path. The package database typecheck also passed separately.
- LF-only source/test bytes were used by the candidate.

## Preserved findings and limitations

The initial implementation embedded restore evidence and base64 archive bytes in stdin. Focused tests passed, but the coordinator supplied the actual historical paired archive size of 9,466,390 bytes, proving that design exceeded the worker's 8 MiB envelope. The candidate was not frozen. All restore evidence was changed to externally pinned private file references and the exact historical size is now a passing regression.

The first direct Bun import was denied by the filesystem sandbox before execution; the approved scoped rerun passed. A direct ad hoc TypeScript invocation initially exposed repository package type-root resolution errors. The repository database package typecheck passed, and a focused strict config with explicit existing Bun/pg roots passed. Neither was a product-test failure.

The fixed observer needs an authenticated Railway CLI session in the supervisor-created private HOME. The coordinator separately reported a successful read-only isolated-home experiment by copying only the existing Railway config, but that supervisor provisioning is separately owned and not established by this candidate. Without it, the observer refuses before returning `true`.

Trusted policy/review/head hashes are assumed to have been independently acquired on the trusted operator host. Hashes and identity strings do not cryptographically authenticate issuers. This task intentionally did not add signatures or a key infrastructure.

A future reconciliation producer must durably bind a unique original attempt/application name and backend identity to worker-exit and PostgreSQL session-resolution evidence, then expose that evidence through a separately reviewed non-payload assertion interface. Until then, uncertain COMMIT reconciliation cannot run through these bindings. No live readiness or launch authorization is claimed.

