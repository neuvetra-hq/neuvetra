# M78 continuation 4 lifecycle evaluator independent QA

## Verdict

Candidate 3 passes the scoped offline preparation review. It can evaluate a closed exercise-only journal and, after a later restart/revisit, a full lifecycle. The review does not accept an actual exercise or full lifecycle. The exact immutable baseline is separately admitted by the strict-auth supplement.

Reviewed candidate snapshot: `operations/agent-improvement/snapshots/M78-CONT4-LIFECYCLE-REVIEW-PREP-01-CANDIDATE3.json`, SHA-256 `51edfe895ed02eecdee165debe7fe0d242b0c07ff014b0e29c23bf4a9c3d18ae`. Its three embedded files are text-exact with the live files and rehash to their recorded values.

## Findings and repairs

Candidate 1 is preserved and rejected. It did not bind the accepted baseline diagnostic prefix; validate response status and exact method/route/auth counts; require the exact 37 ordered recipes and identities; bind prior registers/downloads/M78 exports; or require independently decoded revisit state and bounded restart freshness.

Candidate 2 is preserved and rejected for full-lifecycle use. It measured the 15-minute restart freshness window from exercise closure, which would incorrectly reject a valid restart performed after a review pause. Candidate 3 retains the existing strict exercise-finish, restart-request, startup and observed chronology, then measures freshness from restart observation to revisit start. The review accepts a 366-day review pause when restart is fresh at revisit and rejects revisit one millisecond beyond 15 minutes or before restart observation.

The previously accepted baseline evaluator has an escaped source-level case: a fully rehashed diagnostic fixture with `GET auth:/auth/v1/token` passes it. The new QA test reproduces that case. The additive verifier and root closed-admission builder require `POST` on every token/logout request. On the exact immutable baseline diagnostics, the additive verifier found eight token and eight logout requests, all `POST`. This is an evaluator-coverage finding; the actual baseline does not contain the escaped behavior.

No material finding remains open in candidate 3.

## Evidence challenged

The complete evaluator is exercised on synthetic positive exercise-only and full-lifecycle fixtures. Both decode the final state and require one process version, two inventory versions, two process reports, three inventory reports, ten source-union rows, exact total `126850.17632025`, the exact ordered 37 recipe identities, 16/24 closed sessions, continuous journal and diagnostic hash chains, per-phase ordinal resets, `0/37/0` application writes, and exact baseline prefix bindings.

Independent negative fixtures rehash after mutations and reject changed baseline journal or diagnostic prefixes, non-201 exercise responses, GET authentication, duplicate or wrong recipe identities, changed retained registers/downloads/M78 exports, stale or pre-restart revisit timing, and changed independently observed revisit state. Combined author and QA validation passes 14 tests with 863 assertions on Bun 1.3.12. Strict targeted TypeScript passes over the evaluator, author test, QA helper and QA test.

## Revisit evidence basis

The frozen core journal records its own recomputed `exactRetainedState` assertion but does not contain the full revisited payload. Full admission therefore requires both that journal assertion and an additive, hash-pinned, read-only revisit observation. Candidate 3 decodes the observation through the actual frontend decoder and compares its Scope 1 state, registers, downloads, M78 exports and legacy data exactly with the accepted exercise state. This adds evidence without changing the 173-source core, gate or harness.

## Actual baseline supplement

The exact baseline journal, diagnostics, gate, closed-admission receipt and existing official result rehash successfully. The independent supplement records 42 main events, 572 diagnostic events, 285 requests, zero request errors, zero application writes, eight closed authentication sessions and zero unknown sessions. The official result writer was not rerun. QA used no network, database or credentials and changed none of those artifacts.

## CI and limits

The independent QA fixture reads preserved local `.superpowers` evidence and has no portable CI selector. Do not add that whole file to portable CI. The author test `evaluations/research-qa/m78-continuation4-lifecycle-independent.test.ts` is public and synthetic, so the whole file is suitable for targeted CI after root admission.

This review used the inherited task context. Registry dispatch requested `gpt-5.6-sol` with high effort; the actual model and effort are not observable, so no different model claim is made. No hosted calls, authentication, database access, credentials, Git operations or official journal writes were performed.
