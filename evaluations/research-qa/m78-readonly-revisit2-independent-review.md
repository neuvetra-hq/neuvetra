# M78 read-only revisit2 independent source review

## Verdict

**PASS for the frozen candidate2 source contract only.** Candidate2 is bound to snapshot `46700a55e97906e7d27f60a019fa3c2ede6316d1c318072db94e29c4fef844ac`. It does not prove that a restart or revisit occurred, and it does not authorize either action.

Candidate1 failed independent review. It accepted coordinated replacement of all three durable lock bytes when the caller supplied matching hashes, and it allowed an arbitrarily old restart receipt. The original candidate1 snapshot, failure result, and historical reproduction test are preserved. That reproduction test imports a live module path and is historical evidence only; it is not a current-positive test and is not the basis of this verdict.

## Candidate2 findings disposition

- The three durable locks now use fixed reviewed marker bytes. The caller cannot redefine lock identity with adjacent hashes. A coordinated three-lock substitution is refused before the inherited runner.
- Restart freshness is checked twice. Preflight requires the current clock to be between zero and 15 minutes after the restart observation. The produced revisit journal must begin with `attempt_started`, and that event must be between zero and 15 minutes after the same restart observation.
- The adapter pins the independently accepted actual recovery2 receipt `eaa2f3e35e3e7b939a15aa9122fdddfea19625eefc484d305ecce656d4491bd1`, reruns the corrected recovery evaluator, and requires the corrected evaluator source pin `c45f948482a53b9e2f2ba87c1b754bb70a6f2ced079dbf8b4d85657d7b77fa78` in the fresh source gate.
- The restart chain binds the accepted recovery result, observation, source gate, request, provider acknowledgment, sole startup event, independent review, fixed runtime, readiness, schema 21, legacy containment, and `autodeploy:false`.
- The adapter preserves both predecessor evidence sets and remaps only four inherited recovery2 evidence paths. It refuses any other IO path, reruns the full corrected evaluator on the new bytes, and compares all retained state families exactly.
- A runner failure remains failed. A pass requires zero application POSTs, all created sessions closed, zero unknown sessions, all four evidence outputs, exact retained state, ten Scope 1 sources, and company total `126850.17632025`.

## Checks

- Author candidate2 suite: 7 tests, 125 assertions passed.
- Independent candidate2 suite: 6 tests, 125 assertions passed.
- Strict targeted TypeScript passed with library declaration checking skipped because the installed PGlite declaration package lacks its Emscripten globals under this standalone invocation. Candidate and QA sources themselves reported no errors.
- The independent suite binds all four candidate files to the frozen snapshot, exercises a synthetic positive through the actual adapter boundary, and challenges actual-recovery evidence, corrected-evaluator source binding, coordinated lock substitution, stale/future preflight, stale/future attempt timestamps, chronology, used output paths, missing/wrong locks, each retained state family, inherited runner failure, and unsupported IO.

## Limits

All positive execution inputs are source-only fixtures with an injected runner and evaluator. No credentials, provider API, network, database, restart, hosted request, or revisit was used. Actual restart and revisit evidence require separate closed-run independent review.
