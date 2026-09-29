# Fixed artifact bindings repair 1 — author report

2026-09-26. Task `HOSTED-SETUP-FIXED-BINDINGS-REPAIR-01`. Author `/root/collection_backend`, critical software engineering under CTO sponsorship. The requested route was `gpt-5.6-sol/high`; the inherited follow-up context did not expose the actual model or effort. No provider, database, credential, Git, deployment, stop, migration, resume or reconciliation operation was performed.

## Preserved first review

The independent Candidate 1 report remains an immutable FAIL at SHA-256 `2b02ecf7d1b71f6ddf8dbfc33a9785c908e307c23b5f6f40632e26b262e21740`. It records two P2 findings:

- `FIXED-BIND-F01`: an accessor at an array index executed through caller-selected `Array.map` and its value was accepted.
- `FIXED-BIND-F02`: deferred `verifyReviewedExecutionArtifact` returned a cached product binding after the pinned publication review had expired.

The same report separately established the large private-file transport and six fresh synthetic provider acquisitions. This repair does not rewrite that first verdict or inflate those local observations into live evidence.

## Frozen repair candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-bindings.ts` | `cbe42173cd354559901fea9821c7314751c20b2e0febd895d7cb13fa27955514` |
| `tools/staging/hosted-setup-artifact-bindings.test.ts` | `4975c5f0d1b7ddb9e31a2ab1db5ec00891fbf9381d7cb1f63a9711864e693300` |

Both files are LF-only. Independent re-review of these exact bytes is pending.

## FIXED-BIND-F01 repair

`plain()` no longer dispatches an array's `map` method. It first reads the array prototype and own property descriptors, requires the exact built-in array prototype, rejects symbol keys, sparse indices and extra properties, and accepts only enumerable indexed data descriptors. It recursively copies each descriptor value. An index getter is therefore rejected as `PAYLOAD_ACCESSOR_REFUSED` without invocation; custom methods and prototypes cannot become execution hooks.

The regression covers the exact QA1 accessor with an invocation counter, an own custom `map`, an inherited custom `map`, a sparse array, an extra string property and an extra symbol property. The exact pre-repair run resolved the accessor payload and failed the refusal assertion with 6 passes, 2 failures and 24 assertions across both new regressions. After repair, getter and custom-method counters remain zero.

## FIXED-BIND-F02 repair

Preparation still verifies the exact at-rest publication, historical head, independently pinned review and current-head observation. A shared internal check now validates publication expiry, the same pinned review bytes and the same independently pinned current-head bytes at a supplied process clock.

`verifyReviewedExecutionArtifact` first requires the callback receipt and review to equal the immutable prepared copies, then reruns that complete check at `Date.now()` before returning the binding. A review that expires after preparation now refuses with `PR_REVIEW_TIME_REFUSED`; a publication receipt that expires after preparation refuses with `PUBLICATION_EXPIRED`. In both tests, separately pinned current-head evidence remains fresh and `currentProductHead()` still returns the exact reviewed head, isolating the repaired expiry condition.

The product binding retains `runtimeLoadedCodeAttested:false` and `launchAuthorized:false`. No new caller callback, serialized authority flag, issuer authentication claim or live transport was added.

## Validation

- Pre-repair regression run: **6 passed, 2 failed, 24 assertions**. The two failures exactly reproduced FIXED-BIND-F01 and FIXED-BIND-F02.
- Final focused suite: **8 passed, 0 failed, 34 assertions**.
- Preserved QA1 embedded probe replayed unchanged against the repair: **6 passed, 0 failed, 26 assertions**. It rechecked the exact 9,466,390-byte archive and an 8 MiB + 123 byte snapshot through private path/hash/length references while the serialized payload stayed below 8 MiB. It also performed two synthetic acquisitions in each of three ordered maintenance phases: six status calls, six inventory API calls and six CLI version checks, followed by replay refusal. The real collector/parser code ran through controlled transport interception; Railway was not contacted.
- Relevant hosted setup composition across bindings, fixed worker/supervisor, publisher/source, transaction runner, fresh restore, deployment binding, postscale, Railway capture and sequence fence: **107 passed, 11 skipped, 0 failed, 654 assertions**. The 11 skips are opt-in native PostgreSQL sequence-fence cases; no database was started.
- Strict TypeScript for the repaired source/test and imports: **PASS** using explicit existing Bun and package-local pg type roots. The database package typecheck also passed.

The first direct strict invocation exposed the repository's package-local pg type-resolution issue plus one new descriptor-map annotation incompatibility. The descriptor result was narrowed to the string-key map used after explicit symbol rejection; the explicit-root strict check then passed. The first attempt to extract QA1's embedded probe failed before writing because PowerShell interpreted Markdown backticks; delimiter parsing without shell backticks succeeded. Neither was a product execution failure.

## Remaining limits

The trusted policy, review and current-head bytes are assumed to have been independently acquired on the trusted operator host. Their hashes and identity fields do not cryptographically authenticate an issuer. The fresh clock is the worker process clock; this module does not establish host-clock integrity. Private evidence validation detects byte/metadata/path drift within its boundary but does not establish OS-level isolation from a privileged same-host process.

The six provider acquisitions used synthetic command output. No current Railway stop, image, configuration or authentication is established here. Captures remain point-in-time observations rather than a provider lease, and the reviewed stop explicitly retains `databaseWritersExcluded:false`. Reconciliation still fails closed because no authenticated original PostgreSQL transaction/session resolution producer exists. Independent QA of these exact repaired hashes remains required before integration or operational use.
