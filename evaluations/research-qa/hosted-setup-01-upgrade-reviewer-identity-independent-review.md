# Hosted setup upgrade reviewer identity independent review

Date: 2026-09-26. Task: HOSTED-SETUP-SAFETY-QA4. Independent QA/security reviewer: `/root/source_lock_holistic_qa`; CEO sponsor. Requested registry compute: critical gpt-6-astra/high; observed model, effort and cost unknown. Reviewer did not author the runner. Applied AGENTS and QA/security role instructions. Prior reviews remain unchanged.

## Verdict

**PASS, bounded reviewer-identity delta and tested runner regressions.** The single-reviewer coupling reported in QA3 is resolved. Historical restore, publication and stop evidence can retain three different actual reviewer identities. Each stage must match its own expected identity, and none may exactly equal the operator. No new race or material defect found in this change. This is not live authority or acceptance of a concrete end-to-end hosted composition.

The input fields are now restoreReviewerId, publicationReviewerId and stopReviewerId. privateInput reads them once before the first await (lines 179-187). Validation at line 253 rejects missing, non-string, empty/whitespace-only and exact operator identities. The restore, product and stop binding checks at lines 264, 271 and 277 use the corresponding field. The runner does not require those three reviewers to differ from each other: the same actual independent reviewer may legitimately perform multiple reviews. IDs are exact opaque trusted-adapter identifiers, not a person-authentication or alias-deduplication service.

## Independent evidence map

Reviewer-written synthetic stdin probe: **50 counted checks passed**. It imported the actual runner, transpiled only fixture declarations before the first test in the frozen upgrade test file, and supplied in-memory journal, snapshot, source callback and migration functions. No disk journal or real database/provider was used by this probe.

| Probe | Observed result |
| --- | --- |
| Distinct actual identities | Set restoreReviewerId to `/root/hosted_recovery_qa`, publicationReviewerId to `/root/publication_qa`, stopReviewerId to `/root/gate_qa`, with matching stage bindings. Success, one migration, three fresh strict-true gate observations. |
| Each binding mismatch | Changed only the corresponding binding independentReviewerId to different-actual-reviewer: restore, publication and stop each refused with the stage-specific validation error. Zero journal events and zero migrations. |
| Each operator self-review | Set each input reviewer and corresponding binding reviewer to operator: all three rejected by Separate actual reviewer identities required before reservation. |
| Malformed stage IDs | For each of three fields, supplied empty, whitespace, undefined, null, numeric 1 and object: all refused. |
| Caller mutation/getters | Held currentProductHead pending; each reviewer getter returned original only once and forged value on later reads; replaced all input fields and dependency verifier methods before release. Original private identities/methods retained; success; each getter read once. |
| Synchronous microtask mutation | Product verifier returned a matching object while queuing its reviewer mutation to operator. Private scalar copy captured original before microtask; valid original evidence succeeds. |
| Async binding refusal | Async restore verifier rejected at runtime before migration. Existing tests cover other Promise/thenable binding refusal and strict-true fresh gate observations. |
| At-most-once callback | Source wrapper attempted operation twice; only one migration call occurred, followed by commit-outcome-unknown/do-not-retry error. No success receipt. |

Probe stdout: `{"probe":"QA4 runner identities","checks":50,"status":"PASS"}`. For reproduction, start from the frozen test helpers input(), restore(i), publication(i), stopped(i), before()/after(), manifest and journal(events). Use synchronous verifier returns and a gate wrapper `{binding: stopped(i), observeHeld: async () => true}`. Snapshot/migration return JSON strings. Change the individual input and binding fields as recorded above; count journal events, migration calls and observer calls. All failure cases above happen before migration except the intentionally duplicated source operation.

## Regression and composition review

Combined runner/source-lock/adapter/gate suites: **41 pass, 0 fail, 238 assertions**, Bun 1.3.12. Strict TypeScript across all four sources and their tests passed, no diagnostics. Exact commands are in companion `hosted-setup-01-write-gate-adapter-independent-review3.md`. This includes actual migration SQL under local PGlite; it establishes local semantics, not external PostgreSQL/provider operation.

The synchronous verifier contract, private manifest, serialized async fingerprint/migration result, fixed absolute journal path and no-retry status handling remain intact. Frozen source-lock tests rerun successfully with the changed imported runner dependency. Synchronous manifest and serialized migration wrapper assumptions still apply. The trusted pre-import attestor/launcher and reviewed concrete verifier adapters are absent; the source closure must be rebuilt/reviewed for the new runner hash, and older loaded-code attestations cannot be reused.

The accepted restore helper remains unchanged; this probe used its historical reviewer ID in a synthetic matching binding, rather than rerunning that historical restore or claiming new authentication. Root must wire authenticated accepted restore output to restoreReviewerId, actual publication review to publicationReviewerId and actual stop review to stopReviewerId. No relabeling of historical evidence is needed. Existing journal reservation pins review artifact hashes; it does not duplicate reviewer names. Traceability still relies on retaining authenticated pinned artifacts and adapter provenance. A string alone does not establish who reviewed anything.

## Exact reviewed bytes

Initial/final hashes matched.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-upgrade.ts | 919153fbabc3e600b697cd589d3331d2f02ab41fa345468fcccb22bca3b9a329 |
| tools/staging/hosted-setup-upgrade.test.ts | 5f689847a0e7de525e89963c42f5f9a31b861081b4829d4726ad2197a1f9c26f |
| tools/staging/hosted-setup-source-lock.ts | b52b9f1d5347976b9bcb226917b40186e08a825dc2e4b78f1efe4a951053a20c |
| tools/staging/hosted-setup-source-lock.test.ts | 0fe36ace2fe71398ca79d9400c164a94fddd9472f9af7ff6da036c1f41500ce2 |
| tools/staging/hosted-setup-accepted-restore.ts | a5f4e5feb5aa5d651d222413f075142ca200171272cacb60b732470625342395 |

## Limits and next owner

Root/CTO can accept this exact reviewer-identity repair and update the ledger/publication evidence. Concrete transport and authenticated verifier/source-attestor implementations, continuous provider/admin writer hold, integrated no-retry reservation, current hosted observations and live approval remain open. A local component PASS cannot discharge any of those gates. Preserve QA1/QA2 FAIL and QA3 bounded PASS against their historical hashes.

Only this report and the assigned adapter report were written. No source/code, operations, Git, hosted/provider/external DB or ENV mutation occurred. Local execution/report writing used bounded managed-worktree permission escalation. Next owner: root/CTO for actual composition and refreshed exact-byte release closure, followed by independent integrated QA before any live action.
