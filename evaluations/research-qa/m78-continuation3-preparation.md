# M78 continuation3 source preparation

Author /root/resume_recipe; September22,2026. Source candidate only. Actual independent cleanup disposition is pending. No hosted/auth/DB calls, application writes, journal resets or source/deployment changes were performed.

## Bounded change

New `check-m78-continuation3.ts` retains continuation2's reviewed storage/diagnostic behavior in a separate adapter, with new main/diagnostic/lock/stop filenames. It still calls the unchanged original `runM78Continuation`. All160 admitted parent files are byte-preserved. Original0/37/0 semantics, first retained inventory/report, source gate,30-second signal, report/version integrity, tenant roles,37-operation recipe, limits and post-exercise restart checks remain unchanged.

Before any request or new evidence write, the adapter verifies exact interrupted15/30 journals and their pinned hashes/heads, then requires the actual cleanup-disposition receipt at `.superpowers/m78-continuation3-cleanup-disposition.json` with an independently supplied SHA. The old24 zero-write failure and original72 initial-save provenance remain required. No prior journal is a write destination.

The input parser preserves `interruptionDisposition:{path,sha256}` in addition to the original inner gate/restart fields. Root's new outer wrapper must independently bind that exact receipt pin before credential unsealing. Receipt fields are:

- status `m78_interrupted_sessions_independently_disposed`, independent true, reviewerId under `/root/` distinct from the author and `/root` operator;
- exact `interruption` object containing mainSha256/mainHead/diagnosticsSha256/diagnosticsHead;
- knownSessions4, resolvedSessions4, unresolvedSessions0, `sessionResolutionScope:'session_rows_and_linked_refresh_rows'`, disposition `exact_session_cleanup`;
- `actualCleanupCommitted:true`, `refreshDispositionVerified:true`, `nonselectedSessionsPreserved:true`, `syntheticContinuationApproved:true`;
- exact `tokenUsability:'not_verified'` and `expiryVerified:false`; no JWT invalidation claim;
- reviewedAt after the interruption; nonempty bounded unique evidencePins, including distinct `actualCleanupResult` and `independentPostconditionReview` pins. Every evidence byte hash is checked.

This schema narrows admission to the independently reviewed session-row cleanup plan. It does not infer expiration. Synthetic receipt tests use only in-memory files and are not actual cleanup evidence. The actual receipt remains a separate independently reviewed artifact, not a source fixture.

## Graceful stop

Creating `.superpowers/m78-hosted-continuation3.stop` requests a graceful stop. The adapter checks it before phase entry, before each nonlogout request and before writing each new login intent. The transport stop is latched even if the marker later disappears. Existing core cleanup always retains access to logout without reading the marker. The adapter never deletes the stop marker or breaks diagnostic file permissions.

A stop does not interrupt a request already in progress, change its30-second signal, roll back a committed operation or authorize replay. The first following boundary refuses and the unchanged core finally closes known sessions and writes its truthful failed terminal; diagnostic phase closure records paused status. This is a graceful request-boundary stop, not protection against process termination. A marker appearing in the tiny interval after login intent but before transport can leave the core's conservative unknown-session counter nonzero despite local preflight refusal; admission remains failed/unresolved in that case. No invented logout or certainty is recorded.

Diagnostics retain the same minimal header/error instrumentation and unread identical Response behavior as continuation2. They do not consume bodies or establish the cause of a later decode/content mismatch.

## Evidence

Six focused tests passed with244 assertions. Actual unchanged core tests use in-memory transport/session responses: stopping after two and four logins closes every issued session, leaves unknown0, records a failed terminal and performs0 application writes. Additional tests refuse missing disposition, evidence, approval and altered fields before any request/write, check latched stop and cleanup access, and verify all166 source hashes. Strict targeted TypeScript passes. Initial mock config omitted no-store and correctly failed before authentication; the fixture header was corrected before the successful pause tests.

`m78Continuation3SourcePins()` verifies the exact admitted continuation2 receipt4a1ee046... and preserves its160 pins, adding six minimal roots (new adapter/test/collector, two exact interrupted-journal fixtures and historical parent receipt). `M78_CONTINUATION3_EVIDENCE_PINS` contains six fixed parent pins; the actual disposition pin is supplied separately in input and must also be bound by outer admission.

Independent source review, actual cleanup/postcondition receipt, fresh runtime/wrapper binding and hosted execution remain pending. Requested software-engineering registry route is Terra/medium; reused-context actual model/effort is unknown. Author is not the independent cleanup or release reviewer.
