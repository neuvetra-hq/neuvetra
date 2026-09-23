# M78 isolated GET route candidate 3 — independent review

## Verdict

**Pass for source and route-boundary behavior.** The verdict binds candidate snapshot SHA-256 `a785ad07…` and route SHA-256 `fd9b1115…`. It does not admit a native comparison, recovery run, hosted deployment or release.

The portable baseline fixture reconstructs the accepted historical route byte-for-byte after removing its provenance comment and restoring the exported function name. The candidate is identical to the historical route before dispatch and from the POST/catch tail onward. The changed GET section sends exact version and report paths directly to their existing full verified-state getters. Valid calls use one specific getter and zero root getters; root register and statement paths retain the root getter.

Candidate 1 returned fallback promises without awaiting them inside the route `try` and treated some non-null wrong-family results differently from the historical wrong-stream behavior. Candidate 2 repaired those issues but omitted requested ID equality. Candidate 3 preserves both rejected snapshots and repairs all three findings. Before releasing bytes it now requires exact requested ID, company, stream and family. A mismatch invokes the awaited root fallback: an actual other-family stream returns the generic record 404, while a missing specific record on a valid selected stream returns the version/report 404.

Independent tests exercise the transformed candidate source itself. They cover both families, all eight returned-identity mutations, actual cross-family version/report requests, and asynchronously rejected fallback reads with permission, capacity, input and corruption errors. Authentication and staging refusal occur before any getter, and no GET case calls a writer. The baseline reconstruction plus exact unchanged suffix establishes that POST parsing, management gates, writers and catch mappings are byte-identical to the accepted route.

## Checks and limits

Five independent tests pass with 88 assertions, and strict targeted TypeScript passes. The author snapshot records 12 passing portable tests, three guarded native skips and 157 assertions. The exact isolated candidate suite was independently rerun after granting scoped read access and passed nine tests with 141 assertions. The independent suite also uses an owned executable fixture whose only changes are import paths; it reverses that transformation and requires exact equality with the frozen candidate bytes.

No native database, network, provider, credential or hosted action occurred. The route still uses the full verified state reader. A separately reviewed finite SQL guard and root comparative runner must establish exact source closure, query reduction and 121-table row preservation before any recovery or release admission. Local performance samples cannot establish hosted latency or an SLA.
