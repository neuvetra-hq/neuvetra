# HOSTED-SETUP-MAINTENANCE-STOP-STAGED-PATCH-QA-01 — independent review

Date: 2026-09-26. Reviewer: `/root/txn_runner`, independent QA/security for this narrow maintenance-stop repair under the CEO sponsor. This reviewer did not author the maintenance-stop component or this repair. Requested critical registry route: `gpt-6-astra` / `high`; the follow-up runtime exposed no model, effort, token-use or cost telemetry, so all observed settings remain unknown. Only this new report was written. No provider, network, database, ENV, Git, deployment, scale or stop action occurred.

## Verdict

**PASS, bounded to the exact local bytes below.** The repair accepts Railway's `pendingChanges: null` only when the same serialized observation contains strict `stagedPatchEmpty: true`. That condition remains conjunctive with disabled automatic deployments, complete inventory, the exact pinned project/environment/service/region/deployment/commit, successful deployment status, the expected replica count and a bounded nonempty configuration version. Missing or false staged-patch evidence, a nonzero count, or failure of any retained condition refuses before provider mutation.

The same checks run on both pre-stop observations and both post-stop observations. A quiet-provider condition that drifts after scaling begins produces `HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY`, writes no success receipt, and does not authorize another scale. No actionable source finding was observed.

## Exact reviewed bytes

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-maintenance-stop.ts` | `b161aaf56268baceb5e716f957e909d6a1f4b9e9881130b5512dba6fd9671fdb` |
| `tools/staging/hosted-setup-maintenance-stop.test.ts` | `9d14819c2b8755fcb88def5c29f7e20afcf434469b893bed98e7a2c27d3ebe71` |
| `evaluations/research-qa/hosted-setup-01-railway-cli-observation-20260926.json` | `216e3cc04c22d75327571323b0b2647f61d352ceee5119354e7b0b084d85260b` |

The source, test and observation hashes were checked from the current worktree before testing. They are rechecked after the report below.

## Acceptance and refusal evidence

The focused suite passed **10 tests, 0 failures and 66 expectations** on Bun 1.3.12. Strict focused TypeScript passed with no diagnostics. The existing tests retain durable journal/no-replay behavior, exact-target scaling, pre-stop refusal, post-scale uncertainty, private paths, immutable input/dependency capture, serialized observation isolation, immutable receipt scope, one-read journal method capture and nondecreasing canonical timestamps.

A separate injected in-memory adversarial matrix exercised the new boundary without touching provider state or persistent receipts:

| Observation or drift | Scale calls | Receipt writes | Result |
| --- | ---: | ---: | --- |
| `pendingChanges: null`, `stagedPatchEmpty: false` | 0 | 0 | refused before mutation |
| `pendingChanges: null`, staged-patch field missing | 0 | 0 | refused before mutation |
| `pendingChanges: 1`, `stagedPatchEmpty: true` | 0 | 0 | refused before mutation |
| null/true with automatic deploy enabled | 0 | 0 | refused before mutation |
| null/true with incomplete inventory | 0 | 0 | refused before mutation |
| null/true with wrong deployment | 0 | 0 | refused before mutation |
| null/true with wrong pre-stop replica count | 0 | 0 | refused before mutation |
| null/true plus every retained prerequisite valid | 1 | 1 | accepted; `databaseWritersExcluded: false` |
| staged patch becomes nonempty after scale | 1 | 0 | uncertain; do not retry |
| pending count becomes nonzero after scale | 1 | 0 | uncertain; do not retry |
| automatic deploy becomes enabled after scale | 1 | 0 | uncertain; do not retry |
| inventory becomes incomplete after scale | 1 | 0 | uncertain; do not retry |
| deployment changes after scale | 1 | 0 | uncertain; do not retry |
| replica count differs after scale | 1 | 0 | uncertain; do not retry |

“Before mutation” here means no provider mutation: the injected `scaleToZero` was never called and no receipt was written. The local journal intentionally records reservation and refusal evidence before returning the refusal.

## Read-only observation evidence

The frozen observation artifact records a read-only Railway CLI 5.62.1 observation for the pinned production `Site-Web` service and deployment. It records `autoDeployEnabled: false`, `unmergedChangesCount: null`, and a later staged-change read with `stagedPatchId: "<empty>"`, status `STAGED`, property count 0, and a concrete environment configuration ETag. It explicitly records `pendingChangesInferredAsZero: false`; the repair therefore does not reinterpret the null count as zero.

The artifact separately records zero in-flight deployments among 20 recent deployments at that dated read. An empty staged patch does **not** prove that no deployment is in flight. These observations occurred at different timestamps, are not an atomic provider snapshot, and establish no lease. The source continues to require two fresh matching observations before scale and two after scale, but a separately reviewed authenticated provider adapter must construct `inventoryComplete` from a complete current inventory and must preserve the exact staged-patch/configuration semantics. That adapter is still absent. The file contains observation results and binary/version hashes; it does not by itself reproduce or independently authenticate the provider session.

## Truthful scope and retained limits

The receipt proves observed zero replicas only for the exact pinned Railway project, environment, service and region. It remains an availability-coordination receipt with `availabilityStopObserved: true` and `databaseWritersExcluded: false`. It does not establish a global provider freeze, database writer exclusion, database preservation, or absence of writes from any other service. Database preservation remains the responsibility of the separately reviewed single-transaction upgrade and its database locks.

The provider action still has no atomic configuration-version precondition, so a provider-side race can occur between observation and scale. Repeated observations are evidence, not a lease. The replay boundary remains the exclusive external journal path, and a receipt-path failure after scale remains uncertain/no-retry. No concrete provider transport, live inventory refresh, maintenance stop, restart, migration, deployment or release was exercised.

## Reproduction

```powershell
bun test tools/staging/hosted-setup-maintenance-stop.test.ts --timeout 30000
bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-maintenance-stop.ts tools/staging/hosted-setup-maintenance-stop.test.ts
```

The independent matrix used only injected in-memory provider, journal, receipt and clock doubles plus absolute private placeholder paths. It created no provider or database connection and left no probe file in the repository.
