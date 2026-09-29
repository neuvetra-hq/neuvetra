# HOSTED-SETUP-RAILWAY-ADAPTER-01 — author handoff

Date: 2026-09-26. Mode: security/reliability implementation under CTO. Author: `/root/txn_runner`. Requested critical registry route: `gpt-6-astra` / `high`; the follow-up runtime exposed no model, effort, token-use or cost telemetry, so observed settings are unknown. This is author evidence and still requires independent QA.

No Railway, provider, database, deployment, scale, stop, ENV, secret, Git, network or live action occurred. The candidate and its tests are inert until an operator explicitly calls the adapter through the separately reviewed maintenance-stop helper.

## Candidate

`tools/staging/hosted-setup-railway-cli.ts` implements a fixed-target Railway CLI binding for `MaintenanceStopDependencies.observe` and `scaleToZero`. It pins Railway CLI 5.62.1 and binary SHA-256, accepts only absolute executable/work directories and a 1–30 second process timeout, calls `execFile` with a frozen argument array and `shell: false`, and passes only a small path/OS environment allowlist to the child. It does not put credentials into source, arguments, observations or error messages.

Each observation combines:

- `railway status --project <exact> --environment <exact> --json` for the exact production environment, `Site-Web`, pinned successful deployment/commit, its active-deployment array and its current instance IDs/statuses;
- one authenticated `railway api` request for direct `configEtag`, a non-decrypted exact-shape environment config, the staged patch, automatic-deploy state and a complete first-100 deployment connection with `hasNextPage: false`;
- the exact `multiRegionConfig` key `us-east4-eqdc4a`, reconciled with both latest- and active-deployment instance arrays.

`unmergedChangesCount: null` remains null and is accepted only alongside a strict empty staged patch and disabled automatic deployments. Zero remains zero. The adapter refuses changed identity, configuration shape, extra region, unknown/in-flight deployments, another successful deployment, pagination, duplicate inventory, runtime/config replica disagreement, output overflow, executable drift, version drift, concurrent operations or any command failure.

The adapter requires two byte-identical preflight observations before it can invoke exactly:

```text
railway scale --project 119f3652-9d84-4d16-983c-1a17c0fd1aaa --environment 6642d65a-15a2-41e9-b25e-b7b01990aa28 --service f43abcf9-72f0-4034-828a-8d83ca26b0db --json us-east4-eqdc4a=0
```

After any scale attempt, the instance is one-shot: command failure, malformed output, post-scale drift or overlapping calls poison it, and it never replays the mutation. When composed with `stopHostedSetupForMaintenance`, success also requires two byte-identical postflight observations with changed `configEtag`, config replicas zero and empty active/latest runtime-instance arrays. The receipt continues to say `availabilityStopObserved: true` and `databaseWritersExcluded: false`.

## Exact bytes and validation

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-railway-cli.ts` | `dd4dc01ed4fcc294767078186d0e1d303b9b9b7c0354b7f0fef6b25a25e1a410` |
| `tools/staging/hosted-setup-railway-cli.test.ts` | `5a80b7af77d256cc356b64e8ad50458896baae4425dd0ad1b4053bf07360571a` |
| integrated helper `tools/staging/hosted-setup-maintenance-stop.ts` | `b161aaf56268baceb5e716f957e909d6a1f4b9e9881130b5512dba6fd9671fdb` |
| integrated helper test | `9d14819c2b8755fcb88def5c29f7e20afcf434469b893bed98e7a2c27d3ebe71` |
| dated read-only observation | `216e3cc04c22d75327571323b0b2647f61d352ceee5119354e7b0b084d85260b` |

Focused mock-only validation passed **10 tests, 0 failures and 375 expectations**. The combined adapter/helper regression passed **20 tests, 0 failures and 441 expectations**. Strict focused TypeScript passed with no diagnostics:

```powershell
bun test tools/staging/hosted-setup-railway-cli.test.ts tools/staging/hosted-setup-maintenance-stop.test.ts
bunx tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --types bun tools/staging/hosted-setup-railway-cli.ts tools/staging/hosted-setup-railway-cli.test.ts tools/staging/hosted-setup-maintenance-stop.ts tools/staging/hosted-setup-maintenance-stop.test.ts
```

The injected tests cover the exact command, null-versus-zero preservation, changed target, missing/nonempty staged patch, auto-deploy, pagination, in-flight and extra successful deployments, incomplete config, region/runtime disagreement, two-preflight binding, overlap poisoning, binary/version mismatch, stderr redaction, malformed/failed scale no-replay, post-scale uncertainty and helper receipt scope. Targeted ESLint was unavailable because this worktree has no ESLint 9 flat configuration.

## Limits and integration handoff

The dated provider evidence supports the pre-stop response shape only. There is no observed scale-zero CLI JSON or committed environment-config shape. The candidate accepts only a scale result and postflight config that retain the one target region as either `null` or `{numReplicas:0}`; omission or any new shape fails after the mutation as uncertain/do-not-retry. Independent QA should challenge this boundary before any operator use.

Railway scale exposes no configuration-version compare-and-set. Two fresh matching reads narrow the race window but do not create a lease or provider-wide freeze. The status arrays expose no pagination marker; the candidate treats their exact returned arrays as the CLI's current active inventory while separately requiring a complete GraphQL deployment connection. The stop concerns one service and one region only. Database locks in the transactional upgrade, rather than this availability stop, prove preservation.

The adapter intentionally performs no restart. The external `wx` journal and receipt behavior remain owned by `stopHostedSetupForMaintenance`; a new adapter instance alone is not a durable replay barrier.

Separate integration defect to repair outside this file ownership: the current transactional runner still validates `sourceClosureSha256` and invokes `withImmutableMigrationSource` from the retired source-lock v2 contract. The accepted artifact path exposes `executionArtifactSha256` and `withArtifactSource`. A separately owned runner/compose repair should change the frozen input binding and same-transaction callback to the accepted artifact names, update adversarial source-pin tests, and receive independent QA. Until then, the accepted source artifact cannot be reliably type/runtime-bound into the composed hosted upgrade; substituting or aliasing the old fields risks validating one artifact while executing another.

Primary CLI contract references used for the implementation: Railway CLI [`scale`](https://docs.railway.com/cli/scale), authenticated [`api`](https://docs.railway.com/cli/api), and GraphQL connection pagination guidance at [Railway GraphQL overview](https://docs.railway.com/integrations/api/graphql-overview).
