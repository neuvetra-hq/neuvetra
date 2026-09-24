# M78 read latency: bounded triage

September22, task `M78-LATENCY-TRIAGE-01`, author `/root/resume_recipe`, software engineering. Read-only source/evidence inspection; no host calls, database queries, journal access, frozen-source edits or Git actions. Requested registry default Terra/medium; inherited actual compute unknown.

## Evidence and diagnosis

Root reports five live GETs at16:32:15–32UTC, all200, taking3991–4531ms on accepted2002fea/schema21. This assignment did not independently collect those timings or establish their individual routes. Five observations do not establish a latency percentile, sustained throughput, timeout rate or user-visible completion time.

The code contains plausible, concrete amplification:

- `apps/site-api/src/workspace/m78-routes.ts`: each authenticated, admitted GET/POST that passes the route/access/method guards loads `findScope1` before selecting an action. Earlier rejected requests do not enter this reconstruction. A version/report GET then calls `findScope1Version`/`findScope1Report` as well. Each database method calls the full `state` reader again (`packages/neuvetra-database/src/m78.ts:44`). Thus selected version/report reads reconstruct the combined state twice.
- `m78.ts:27` sequentially reads corporate, gas, mobile, diesel, fleet, stationary and fugitive registers. Discovery readers repeat their corporate and source reads (`m75.ts:26`, `m76.ts:34`, `m77.ts:23`); the successful static call tree contains ten corporate-reader invocations per combined reconstruction. This is a call-tree count, not a measured SQL query count.
- `m78.ts:35` loads all retained M78 rows, then verifies histories, captured dependencies and reviews. Its report loop at40 reparses and re-renders every retained report and hashes the full HTML/snapshot on a read. This work grows with retained history. Removing these checks without equivalent integrity protection is unacceptable.
- The deployed `HostedWorkspaceDatabase.asUser` override (`hosted.ts:103`) opens a transaction, sets the actor claim, and checks `neuvetra.has_staging_access()` before the operation. It does not execute the base class's `SET LOCAL ROLE` path. `auth.ts` calls Supabase `auth.getUser` per authenticated request. Database round trips, authentication, payload transfer and synchronous verification/serialization can all contribute. The auth source's historical50–100ms comment is not a current measurement. Driver default pool size4 and timeout settings (`hosted.ts:30`) are configuration evidence, not proof of current pool saturation or deployment-region distance.

The existing local recovery acceptance records a244-second whole operator run including restoration, migration/rollback controls and66 retained GETs. The fresh recipe acceptance proves38 writes plus16 independent GETs and10 exact downloads. Neither artifact supplies a per-request latency breakdown; dividing total recovery time by GET count would be invalid. Local Auth is stubbed and database transport is loopback, so local correctness evidence does not establish hosted performance.

**Inference:** repeated reconstruction, sequential data access and history verification are credible contributors. No trace establishes the dominant cost, and the reported five requests cannot yet be attributed specifically to M78. There is no evidence here that a larger provider plan, index, cache or timeout change would solve the issue.

## Smallest measured follow-up

After the frozen release journey finishes, use one separately approved read-only profiling run on a fixed representative synthetic dataset. Measure corporate register, combined register, selected inventory version and report download: two warmups then20 serial samples per route, with cold-start samples labeled separately. Record elapsed time, response bytes, exact dataset/head, auth duration, pool wait, SQL count/time, verification/rendering time and serialization time. Capture browser fetch-to-decoded-display separately. Then run one bounded three-reader concurrency sample if serial reads succeed; no writes or retry of the release recipe. Report empirical median/p95/range and failures, with the small-sample limitation.

If duplication dominates, first propose request-scoped reuse of one fully validated actor/tenant state for selection and downloads; then consider sharing upstream reads within the same transaction. Preserve dependency freshness, captured-review semantics, tenant isolation, fail-closed corruption checks and byte-identical exports. Do not add cross-request caches or skip verification based on this triage.

## Release judgment

The observed delays alone do not invalidate successful synthetic correctness/recovery checks or justify interrupting the active frozen journey. **Customer performance acceptance remains open and should block a customer-ready claim** until representative interaction and concurrency measurements meet a product-approved budget. A proposed initial discussion target is a warm combined-register median≤2s and p95≤5s for the agreed bounded dataset, with report-download and browser-decoding budgets set separately. These are proposed product criteria, not an existing SLA or universal limit; five current measurements cannot pass or fail them reliably.

## Independent review correction

Candidate1 remains frozen. Independent reviewer `/root/resume_release` verified the repeated-read counts but identified the incorrect base-class transaction citation and overbroad request wording. Candidate2 corrects both source descriptions; it changes no application code, measurements or performance conclusion. Final independent acceptance remains pending.
