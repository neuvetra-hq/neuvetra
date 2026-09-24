# Root GET comparative helper — candidate 1 source review

## Verdict

**Fail with two material findings open.** This is a source-only review of helper SHA-256 `07aed9f6…`. The native helper was not executed, no admission exists, and no database, credential, provider or hosted service was accessed.

## Findings

The helper creates its exclusive lock, then constructs `admin` and `runtime`, and only then enters `try/finally`. A construction-time error can leave the lock without the promised sanitized failure result. If `admin` succeeds and `runtime` fails, the admin handle is also outside cleanup. The repair should own nullable handles under one failure/cleanup region and emit a bounded failure receipt for every post-lock failure.

The helper verifies the admission status, historical route hash, 173 source pins, extra pins, guard presence and helper presence. It does not bind exact independent route and finite-guard QA receipts or validate their reviewer, zero-open-findings and candidate-hash fields before creating the lock. The admission and helper must require those whole-file receipt hashes and semantic fields. A status string and source hash alone do not establish independent acceptance.

## Properties retained for re-review

The source otherwise establishes a useful narrow comparison design: the original and isolated candidate share all 173 historical source bytes except the admitted route; the helper and guard are extra-pinned and rechecked after measurement; application route calls are GET-only; runtime SQL goes through the guard; admin reads use a read-only default and repeatable-read digest transactions; all 121 `neuvetra` base-table row sets are compared before and after; and 19 operations each receive one warm-up and three measured samples. Before/after route bodies, status and headers must match, candidate routes must have one state reconstruction, and all non-root routes must reduce query count. Timings remain local comparative samples without a hosted or SLA claim.

The 121-table digest does not cover sequences, settings, temporary state or external effects. The design's zero-write claim therefore also depends on the finite SQL template guard and exact source admission. The helper may be admitted for a native run only after both findings are repaired and the route and guard receive separate exact independent acceptance.

## Checks

Two offline source-reproduction tests with ten assertions pass, including the exact helper hash. Strict targeted TypeScript passes. The helper itself was never imported or executed.
