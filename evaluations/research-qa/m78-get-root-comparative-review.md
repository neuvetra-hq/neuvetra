# Root GET comparative helper — independent source review

## Verdict

**Pass for candidate 3 source, conditional on separately accepted route and finite guard receipts.** Reviewed helper SHA-256: `7da53e00…`. No admission exists and the native helper was not imported or executed.

Candidate 1 left database construction outside cleanup and did not bind independent route and guard acceptance. Candidate 2 repaired those issues but wrote a pass result before closing its connections. Candidate 3 preserves both rejected versions and resolves all three findings: exact route and guard receipts are hashed and semantically validated before the lock; database construction is inside failure coverage; both connection closes are attempted through `Promise.allSettled`; any close rejection selects the failure-only result; and the pass result is written only after successful closure with `localConnectionsClosed: true`.

The measurement contract remains bounded. It rechecks the 173 historical source bytes in the original and isolated checkout, permits only the admitted route to differ, pins the helper and finite guard, and repeats source verification after measurement. The route calls are GET-only and runtime SQL must pass the admitted guard. It compares eight original and eight candidate route cases plus three direct reads. Every case gets one warm-up and three measured samples. Status, headers and body hashes must remain exact; candidate routes must perform one verified state read and non-root routes must reduce SQL count. All 121 `neuvetra` base-table row digests must remain equal.

The digest excludes sequences, settings, temporary state and external effects, so the zero-write conclusion also depends on the accepted finite SQL templates and pinned source. Timings are local comparative measurements and do not establish hosted cause, a latency prediction or an SLA. This receipt does not approve the route or guard, create the admission, execute the helper, accept a native result or authorize a release.

## Checks

Five offline source tests across the three preserved helper candidates pass with 36 assertions, and strict targeted TypeScript passes. No database, network, credential, provider or hosted action occurred.
