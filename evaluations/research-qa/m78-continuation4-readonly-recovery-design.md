# Continuation4 read-only recovery design

## Decision

Treat exercise session `57177` as a closed **failed** attempt. Preserve its journals and every earlier gate, prefix, source pin, and historical journal. Do not append a success event, reset a journal, replay any of the 37 operations, repeat the original inventory save, or reuse the exercise-success evaluator, restart admission, or revisit entry.

The recommended recovery is a new, exclusive, read-only state-proof run. It must independently show that the current application state is exactly the state implied by the accepted baseline plus the 37 recorded operations, that every earlier record and artifact remains present, that legacy state is unchanged, and that all newly created test sessions close. Only a separately reviewed recovery receipt may authorize one restart and one recovery-aware read-only revisit.

## Observed failure and limits of the evidence

The immutable failure inputs are:

- exercise gate `9fe233c964b8c40f6c7a9871eecf75a318e7a800f2ec14570c6803288ff9dce7` and the unchanged 173-file source inventory;
- failed main journal SHA-256 `44e7bec2d2e6a4a554de6ba23775150bfdf29582fd69ff12bc6cfbc73770ba8b`;
- failed diagnostic journal SHA-256 `d77a8f58ec92a0642a5b0b4a91113920ccd4013b9bcfee9a9c7e5de90d93e651`;
- all 37 application POST outcomes and verified identities recorded before the failure;
- no `exercise_complete`, no successful legacy-read terminal, and a failed `attempt_finished` after request ordinal 384 timed out at approximately 30 seconds;
- all four main test sessions closed and `unknownAuthSessions == 0`.

The provider observation reports adjacent final inventory report/proof/snapshot requests completing in roughly 19.4–29.4 seconds, followed by a snapshot response with status 499 at 29.965 seconds, aligned with the client timeout at 30.011 seconds. This supports server-side slowness at the failure boundary. It does not prove a single root cause or prove that current state is complete.

A later authenticated browser observation displayed total `126850.1763`, ten sources, one reviewed process version, two inventory versions whose successor alone is reviewed while the initial version remains awaiting review, and five reports; reviewed report metadata matched the recorded report identity. The reviewed report GET completed in about 20.1 seconds and its retained HTML was 2,573,401 bytes. A separate snapshot GET eventually completed with status 200 after about 90.4 seconds, and the browser response body equalled the decoded reviewed report's `snapshotJson`. Neighboring session reads took about 2.8–6.3 seconds. This is useful triage evidence only: it is not the pinned, complete, independently decoded recovery observation required below. The 90-second successful snapshot also makes a performance probe and reviewed disposition mandatory before another full recovery run.

Source inspection provides a bounded performance hypothesis. `m78-routes.ts` obtains the full Scope 1 register before dispatching every GET. A version or report request then calls `findScope1Version` or `findScope1Report`, which reconstructs and verifies the full state again. That state read loads all seven upstream registers and verifies retained versions, proofs, reviews, reports, request fingerprints, audits, rendered bytes, and response capacity. Repeated full-graph verification and database round trips are therefore a plausible contributor. They are not established as the sole hosted cause.

## Recovery evidence contract

Use new paths only. Proposed implementation paths for a later bounded task are:

- `tools/staging/check-m78-continuation4-readonly-recovery.ts` — public read-only runner and closed-failure parser;
- `evaluations/research-qa/m78-continuation4-readonly-recovery-independent-review.ts` — offline admission evaluator;
- `.superpowers/m78-continuation4-readonly-recovery.jsonl` and `-diagnostics.jsonl` — exclusive new journals;
- `.superpowers/m78-continuation4-readonly-recovery-observation.json` — exclusive full-state observation;
- a root-owned private wrapper and gate with exact credentials, current runtime, failure, source, evaluator, and independent-review pins.

None of these files exists or is authorized by this design alone.

### 1. Closed-failure admission before authentication

A new offline parser must verify the exact main and diagnostic bytes before any credential access. It must:

1. Verify the accepted continuation4 baseline main and diagnostic prefixes byte-for-byte, including their event counts and heads.
2. Verify the exercise gate and its historical 173 source pins against the frozen checkout or immutable commit blobs. If a performance repair changes runtime source, separately verify the complete fresh source inventory, published runtime, and new recovery gate; never compare historical pins to changed working-tree bytes or let the historical gate authorize new source.
3. Require exactly one exercise attempt after the baseline and exactly 37 contiguous `post_intent`, `post_outcome`, `post_verified` triples in the accepted recipe order.
4. Require every outcome status to be 201, every response hash to match its paired verified event, and all 37 verified identities to be distinct and valid.
5. Require the failed terminal shape: no `exercise_complete`, no `legacy_read_verified`, failure at the final read-only boundary, 37 application POSTs, all main sessions closed, and zero unknown sessions.
6. Verify the diagnostic request/response chain through ordinal 384, the exact timed-out GET, the absence of a successful response for that ordinal, and all four logout outcomes. Diagnostic transport remains Bun fetch with pooling disabled, `keepalive:false`, zero retries, and the original 30-second timeout.
7. Refuse any existing recovery journal, observation, success receipt, or lock. A refusal creates no new evidence file.

This admission may state only that the writes were recorded as successful and individually verified before the read failure. It must not infer final aggregate state.

### 2. Mandatory performance disposition before recovery

Do not launch the full recovery reader until a separately reviewed local probe resolves whether the existing runtime is suitable for the bounded graph-first request set.

Use an isolated final-shaped local database and a `WorkspaceSql` proxy that records query count, per-query elapsed time, transaction boundary, and total elapsed time without recording parameters or row contents. Measure:

- `findScope1` for the root register;
- `findScope1Version` for one exact final version;
- `findScope1Report` for the exact reviewed final inventory report;
- HTTP GET, report GET, report download, and report snapshot through the real route handler.

Run one warm-up and three measured calls per case. Report individual values, median, maximum, verified-state construction count, database query count, response byte length, and response hash. Timings are comparative local evidence rather than hosted predictions.

The accompanying route test must inject counting database methods and prove the current report GET/download/snapshot path calls both `findScope1` and `findScope1Report`. The narrow candidate must call only `findScope1Report` and return identical status, headers, report body, download body, and snapshot body. Repeat equivalent cases for version GET/export/proof. Assert unchanged outcomes for signed-out, outsider, wrong tenant, wrong stream, wrong family, missing version/report, malformed ID, corruption/throw, staging-access refusal, and unsupported methods.

The narrow source candidate is confined to GET dispatch in `apps/site-api/src/workspace/m78-routes.ts`:

1. authenticate and enforce staging access exactly as today;
2. use `findScope1` only for the root register and statement paths that require the selected stream;
3. dispatch exact version paths directly to `findScope1Version` and require returned company/stream/family identity before responding or exporting proof;
4. dispatch exact report paths directly to `findScope1Report` and require returned company/stream/family identity before returning metadata, download, snapshot, or proof;
5. preserve tenant checks, UUID parsing, origin policy, cache/security headers, response byte identity, capacity/corruption refusal, 401/403/404/405/422/503 mapping, and every POST path unchanged.

`findScope1Version` and `findScope1Report` still execute the complete verified state reader, so this removes one redundant graph construction without replacing provenance validation with a direct unverified row lookup. Source inspection also shows sequential upstream readers and repeated corporate/source work inside fleet and stationary reconstruction; the query/timing probe must expose those costs, but no broader database optimization is admitted without separate evidence.

This route file belongs to the frozen 173-file set. Preserve the historical bytes through the existing commit/blob and candidate snapshots. Develop any repair in an isolated worktree, freeze a new source inventory, obtain independent security and performance review, publish it through the rolling PR checks, and create a fresh runtime/deployment/recovery gate. Gate `9fe233…` remains historical and cannot authorize changed source. If the probe does not show meaningful structural and timing improvement, do not deploy the candidate and do not run recovery.

### 3. One graph-first read-only recovery run

The runner must call the supplied fetch exactly once per request, retain `keepalive:false`, and reject any application request whose method is not GET. Authentication token and logout POSTs remain limited to the auth host. No application POST adapter is present.

The run sequence is:

1. Recheck the failure admission, gate/source pins, published checks, exact deployment/runtime identity, ready response, configuration, and role/session access.
2. Create fresh sessions for the four test roles and record every intent/header pair. Unknown-session accounting remains fail-closed.
3. Read the Scope 1 register as manager and member and require byte-equivalent decoded state.
4. Read the seven upstream registers once each and decode them with the production decoders.
5. Reconstruct artifact hashes locally from the freshly decoded records using the production canonical exporters and renderers. For records whose full body is absent from a register, fetch the full retained record once and derive its download, snapshot, and proof hashes from that decoded response. Do not repeat separate download/snapshot/proof endpoint reads when the exact bytes are already carried and hash-validated by the full retained record.
6. Run the unchanged legacy read and require exact equality with the accepted original legacy observation and zero application writes.
7. Logout every created session in `finally`, then write a terminal event only if closure is known. Any read, decode, comparison, or logout uncertainty produces a failed recovery and no success observation.

This graph-first sequence proves retained state while avoiding the original harness's repeated traversal of every deterministic artifact endpoint. It does not change the application or its timeout.

### 4. Exact current-state comparison

The independent evaluator must bind the fresh observation to both the accepted baseline and the 37-operation journal. It must require all of the following:

- Apply the production `preservesM77History` semantics to baseline and prior upstream registers: every earlier immutable version payload/core and report remains byte-equivalent, and an earlier review remains exact when it already existed. Explicitly allow the expected new reviews and current-head advancement recorded by the 37 operations rather than requiring blanket equality of an entire register or attached review.
- Preserve the accepted baseline Scope 1 immutable payload/history, original initial inventory version payload, legacy data, and every baseline/prior download hash under the same rule; current heads and newly attached reviews may differ only where the exact 37-operation delta requires them.
- The set difference between baseline records and fresh records contains exactly the 37 journal result identities, with no unrecorded version, review, or report.
- Every operation name and route matches the candidate4 recipe mapping. Each verified identity equals the typed fresh record for that exact corporate, source, discovery, process, inventory, review, or report operation.
- Each journal request, excluding its unique UUID idempotency key, validates under the production input validator and matches the fresh record's activity, predecessor, dependency, review, or report binding. Idempotency keys must be unique valid UUIDs.
- The fresh server read has independently verified its stored request/audit fingerprints as part of the normal production graph reconstruction; the evaluator does not claim access to private database rows.
- The current graph has one reviewed process version, two inventory versions with only the successor reviewed and the initial version still awaiting review, two process reports, three inventory reports, ten source-union rows, company total `126850.17632025`, and the exact five report identities.
- Fresh deterministic artifact hashes preserve all baseline, prior-failure, and original download maps and contain only the expected additions associated with the 37 identities.
- Main and legacy application POST counts are zero, all created sessions are closed, unknown sessions are zero, and diagnostics contain no unpaired or unexpected request.

The resulting status should be distinct, for example `m78_independent_continuation4_readonly_recovery_passed`. It must pin the failed main/diagnostic journals, recovery journals, full observation, gate, source inventory, baseline acceptance, candidate4 lifecycle receipt, and independent recovery review. It must never emit `m78_independent_continuation4_exercise_passed`.

## Restart and revisit after recovery

The existing exercise restart validator and existing continuation4 revisit entry must continue to refuse this failed journal; both require a successful `exercise_complete` history. Recovery must not manufacture one.

After an independent reviewer accepts the exact recovery candidate and actual observation:

1. A new root-owned restart admission accepts only the distinct recovered status and all failure/recovery pins above. It re-runs the recovery evaluator read-only immediately before the provider mutation.
2. Request one restart for the exact admitted deployment. Preserve exclusive intent/acknowledgement, no retry, one unique post-intent startup, and the existing startup chronology and sanitation rules.
3. Within 15 minutes of the observed startup, run one new recovery-aware read-only revisit. It repeats the graph-first reader with zero application writes and compares the complete fresh observation exactly to the accepted recovery observation.
4. A final independent evaluator binds failed exercise, recovered state, actual restart, and revisit equality. Only that evaluator may issue a full recovered-lifecycle receipt.

Any restart uncertainty, multiple startup events, state difference, timeout, session uncertainty, or missing artifact stops the sequence. It does not authorize another restart, revisit, or any recipe write.

## Recovery launch threshold

The current browser evidence has crossed the threshold for the mandatory probe: a successful 90.4-second snapshot is incompatible with relying on the unchanged 30-second journey boundary. A timeout increase, retry, or omission of state proof is not an acceptable repair. Proceed to recovery only after the probe and independent review either admit the graph-first request set on the unchanged runtime or admit the narrow route optimization under a new source/runtime gate. A recovery failure never falls through to an automatic second attempt.

## Trust boundaries and release limits

- Root alone owns credentials, hosted execution, provider actions, restart, deployment, and private wrappers.
- The recovery author owns only new public recovery code/tests; an independent agent must challenge exact journal admission, recipe/result binding, extra-record detection, artifact reconstruction, zero-write enforcement, session cleanup, and failure paths.
- Current failed journals, the 173 frozen files, all accepted baseline evidence, and prior snapshots remain immutable.
- This design provides no success evidence. The actual current state, recovery outcome, restart, and revisit are unknown until their exclusive artifacts exist and pass independent review.
- Customer Scope 1 release readiness and external assurance remain incomplete.
