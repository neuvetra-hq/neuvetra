# M78 local GET comparison — independent actual-result review

## Verdict

**Pass for the exact local comparison evidence.** The verdict binds result SHA-256 `caae59a5…`, admission SHA-256 `51771857…`, executed helper SHA-256 `7da53e00…`, accepted route SHA-256 `fd9b1115…`, finite guard SHA-256 `8ffb4f74…`, and portable operator-source archive SHA-256 `a3bec864…`. It does not authorize publication, deployment, hosted recovery, or release.

The frozen result contains 19 cases: three direct getters plus eight historical and eight candidate route requests. Every case has one warmup and three measured samples. Each historical/candidate route pair has identical response-body hashes, byte counts, HTTP status, and the complete sorted response-header list across all samples. The root register route remains at one state read and 44 SQL queries. All seven record-specific routes change from two state reads and 86 SQL queries to one state read and 44 SQL queries. Direct getters correctly record 42 SQL queries; route requests add two staging/authentication queries. Transaction counts also reconcile with that boundary: one direct, two for root/candidate routes, and three for historical specific routes.

Both 121-table row-set digests equal `cec9b5e4…` before and after. The result records zero hosted calls, zero application writes, zero HTTP POST requests, and both local connections closed before the pass file was written. The archived exact helper verifies the 173-file historical closure in both checkouts before and after execution, admits only the candidate route difference, uses the accepted finite SQL guard, refuses response mismatches, and emits success only after both connections close. At review time, 172 historical source pins remain unchanged and the one route path equals the accepted candidate, consistent with the separately recorded post-run integration.

## Independent checks

Nine portable tests pass with 230 assertions, including the exact actual result and source archive. Strict targeted TypeScript passes. Adversarial copies are refused after changing a case count, body hash, full header set, sample ordinal, database digest, cleanup flag, source count, write counter, direct query count, historical query count, or candidate state-read count. The admission's exact route, guard, and helper-review receipts are rehashed and their acceptance semantics checked.

## Limits

This is one serial local sample on the synthetic `m78_ops_continuation_20260922` database. The seven record-specific median times were about 3.61–3.80 seconds before and 1.83–1.90 seconds after, but the run was not randomized and may include cache or order effects. It does not predict hosted latency or establish an SLA.

The digest covers canonical row sets in 121 `neuvetra` base tables. It does not cover sequences, settings, temporary state, or external effects. The zero-write conclusion also relies on the accepted finite trusted-source guard and pinned reader closure; it is not an arbitrary in-process JavaScript sandbox. The review accepts this exact local evidence only.
