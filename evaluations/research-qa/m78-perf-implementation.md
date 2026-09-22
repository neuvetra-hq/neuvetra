# M78-PERF-F01 author implementation

Author `/root/resume_recipe`, software engineering, September22. Root explicitly admitted the two-file implementation following independent lock-path review. Original hosted outcome reconciliation belongs to root and is not rerun here. No hosted calls, SQL/role/method/limit/timeout/harness edits or source-pin updates were made.

## Change and invariants

Admitted POSTs no longer perform a separate `findScope1` read. The writer checks exact non-null stream/family identity against the validated register inside the existing actor/company lock. Only `M78_STREAM_NOT_FOUND` maps to404; generic integrity errors still map to503. Initial-null stream idempotency is preserved before native duplicate-stream enforcement. Malformed body plus wrong stream now returns validation422 before the locked stream check; that denial-order difference is intentional. A manager's own company without corporate coverage still returns503, verified for GET and POST; it was already an incomplete-proof failure rather than a null register.

`beforeWrite` captures upstream once after the exclusive company lock. A private lexical `reload` closure reuses that graph only in the same transaction, company and authority/policy scope. It rereads all M78 rows after the unchanged native write, then runs the same full history/proof/review/audit/request/report/capacity validation. Returned records come from that verified post-write state. Any failed post-write verification aborts the transaction. Read-only GET behavior and native SQL remain unchanged. There is no shared cache or exported trusted-graph input.

## Executed evidence

- Focused unit/browser/contract run:38 passed,73 assertions, four native cases explicitly skipped in that invocation. Separate new native route/concurrency run:2 passed,34 assertions. Strict targeted TypeScript passed.
- Native barrier after upstream capture: actual corporate/gas/mobile/fleet/stationary/fugitive writer entrypoints block with55P03 before their payload validation. These probes deliberately use malformed payloads to establish lock order; they do not claim successful source/discovery corrections. Another tenant completes a valid corporate save while the first company's lock is held.
- Second valid initial inventory writer conflicts23505 after the first commits. A later valid corporate successor changes the head; an inventory correction carrying stale dependency hashes is refused23505. Access revocation during admitted work blocks55P03; a request after completed revocation is refused.
- Forced post-write response corruption makes validation fail and rolls back stored version/request/audit rows. A separate representative full-data guard run compares all121 tables after this rollback and finds them unchanged. Fresh local idempotency creates exactly one request/audit/version and returns the exact retained envelope on replay. No hosted key is reused.
- Matched before/after clones preserve112 non-M78 table digests. Every save/report/review measured returned201; actual browser decoders passed and reports retained their original absent review after a later decision. The existing native integrity/capacity suite passed3 tests/76 assertions in124.05s: actual30MB history refusal, actual10MB response refusal and positive retained-report replay with coordinated historical-review forgery refusal.

## Local timing observations

One sample for each operation/variant; original template identical within each pair, new generated IDs/timestamps differ. Full results and exact source hashes are in `m78-perf-local-evidence.json`.

| Local case | Before ms | After ms |
| --- | ---: | ---: |
| Initial inventory save | 3563 | 1333 |
| Initial retained report | 3706 | 1540 |
| Initial review | 3726 | 1441 |
| Late-history inventory correction | 6793 | 3610 |
| Late-history retained report | 7265 | 3793 |
| Late-history review | 6870 | 3428 |

Per operation, caller SQL queries fell132→50; corporate-reader calls30→10; full M78 row verification passes3→2. Native writer time remains separately recorded. These are local loopback/in-process-auth measurements, not hosted latency, percentiles or an SLA. The accepted hosted deadline still requires its own new bounded execution after publication and independent approval.

The initial benchmark bundle failed source-relative migration lookup; the second failed source-relative authority lookup. Both batches' clones/results remain preserved and made no application POST. The private comparison builder then preserved original module `import.meta.dir/url` for both variants. The before variant substitutes only the two frozen pre-change files; the after variant uses current source. Two initial portable-test failures (request-table sort column and native writer arity) were test-harness defects, repaired before the passing fresh-clone run; failed clones remain preserved.

## Portable CI and review boundary

Run `bun test evaluations/research-qa/m78-perf-concurrency.test.ts` with `M78_PERF_NATIVE_BASELINE_URL` set to the existing exact `M78_QA_CI_BASELINE_URL` (`m63_test_admin` loopback55463/m63_integration). The existing fixture creates its own uniquely named clone and rejects other hosts/credentials. With the variable absent, only the source-independent route test runs. Local execution used the fixture's separately allowed55472 synthetic baseline; no CI execution is claimed yet.

Independent QA, historical-test adaptation where needed, source-map refresh, publication/checks, recovery, hosted timing and nonduplicating continuation remain root gates. This artifact is an implementation candidate, not a release or complete Scope1 claim.

## Root-authored CI workflow review

Read-only review confirms `.github/workflows/verify.yml` invokes the new native test after the existing M78 CI lifecycle, with the exact fixture allowlisted55463 baseline and a separate fresh clone. The three new continuation/plan/backup offline test paths exist and their combined local run passed19 tests/296 assertions. This checks workflow wiring and local execution, not future remote CI or independent acceptance of every continuation implementation detail.
