# M78 continuation4 baseline evaluator — independent source review

## Verdict

`m78_independent_continuation4_baseline_evaluator_passed`

The exact evaluator at SHA-256 `c71d714244c5608ab0cb20112f4290de5bab018b67524c2fb039742bba0598a7` is suitable for a later, separately admitted closed-baseline review. It is an offline reader: it requires an explicit admission file, reads pinned journals and artifacts, and creates one new result with exclusive-write semantics. It does not authenticate, call a host, access a database, or modify the journals it evaluates.

The continuation3 derivative retains the accepted lifecycle checks and updates the continuation-specific contract to the exact continuation4 journal/diagnostic namespaces, 173 source pins, nine evidence pins, accepted cleanup disposition, and the independently accepted preparation receipt. It also verifies exact actual/public continuation3 failure equality and semantics before it can accept a continuation4 baseline.

The evaluator requires a single successful baseline attempt, zero application POSTs, complete main and legacy session closure, zero unknown sessions, the exact six successful CI checks, fixed runtime identity and freshness, source/evidence closure, retained history/downloads, actual decoder success, and exact exported version/statement bytes. Diagnostics must have the exact prior-failure parent, `keepalive: false`, zero retries, ordered intent/header pairs, no request errors, and eight login plus eight logout requests.

## Independent challenge

The author suite and the new independent case pass together: 8 tests, 30 assertions, zero failures. The new case builds internally consistent, rehashed, final-`passed` diagnostics and proves rejection when:

- one response-header event is replaced with the observed no-header timeout shape; or
- one logout intent is relabeled as a benign GET while the final record still claims complete closure.

This ensures a valid hash chain and a success label cannot hide the two failure shapes most material to this transport change.

The workflow runs the seven-test public author suite. The independent case is frozen in this review supplement and may be added to CI separately; it has no private fixture or network dependency. Root reported the exact evaluator and author test passed its targeted strict TypeScript check. A standalone compiler invocation from this review was not a valid substitute for the workspace build because it traversed the wider repository with incompatible module settings and surfaced existing cross-workspace resolution errors; Bun compiled and executed both exact suites successfully.

## Boundary

This is source acceptance only. No continuation4 journals exist or were evaluated, no result was emitted by the evaluator, and no hosted baseline or lifecycle is accepted. The evaluator intentionally returns `hostedExerciseAccepted: false` and `fullLifecycleVerified: false`; a later baseline result still requires exact-artifact review.
