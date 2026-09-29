# M80 beta access Candidate1: independent review rejected

Reviewer `/root/m80_beta_access_qa`, task `M80-BETA-ACCESS-QA-20260925`. **Verdict: reject Candidate1; correction and targeted independent re-review required.** No implementation source was authored or changed by this reviewer. Requested Astra/high; observed settings and actual cost unknown.

## Exact reviewed candidate

- Snapshot: `operations/agent-improvement/snapshots/M80-BETA-ACCESS-IMPLEMENTATION-20260925-CANDIDATE1.json`, SHA256 `5385252e78342ddf3152060c5b6d12e16023f6f911e12f4a5325f8d1a3686cd5`.
- Author evidence: `evaluations/research-qa/m80-beta-access-author-20260925.json`, SHA256 `d79bf6b36e59d41ae38abc864b37f1cc6d5be314db0e67857ad7fc0e9f799186`.
- Verified all 16 embedded/current candidate file hashes before execution, and again after the native supplement and before the focused transport reproduction. Independently pinned 25 existing migration/adapter dependencies. These are local exact-byte checks, not remote publication checks.

## Findings

### BETA-ACCESS-F01 — P2: future functions inherit PUBLIC EXECUTE

The frozen migration revokes PUBLIC privileges from its current functions but does not establish restrictive defaults for future functions created by its owner. Native catalog inspection found no default-ACL entries for the fixture owner. In the QA-created `b` database, the operator created a benign new `SECURITY DEFINER` function returning integer719 with no explicit grants. The real restricted runtime login called it directly. The probe was then dropped. Evidence: `Q07.future_function_default_denied` in the supplemental result.

**Exact impact:** the five existing Candidate1 functions were inspected; only the intended three entrypoints were callable by runtime. No unauthorized existing candidate function exposure or customer-data access was observed. The gap arises when a later owner-created helper is added without an explicit revoke. Entry-point readiness checks cannot prevent direct execution of that new helper.

Required repair: a narrowly reviewed ownership/installation design that keeps future helpers inaccessible by default while preserving all existing legacy owner defaults, roles, grants and consumed migrations. A separate beta owner with constrained privileges/defaults is one possible design, subject to new explicit scope. A documented manual revoke convention alone does not provide the tested fail-closed default. PostgreSQL states that schema-specific revocation cannot subtract global/default privileges; adding only `ALTER DEFAULT PRIVILEGES IN SCHEMA ... REVOKE EXECUTE` is ineffective for default PUBLIC EXECUTE. Do not change the old owner's global defaults to repair this. [PostgreSQL17 default-privilege documentation](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

### BETA-ACCESS-F02 — P2: oversized streamed request disrupts the next response boundary

On Bun1.3.12, the real loopback listener accepted a chunked2049-byte request and the application returned413 with the required headers/log. The next forbidden-Origin request on the reused connection returned a **listener-level400**, empty body, no cache-control, request ID, nosniff or CSP, and no application request/log event. A subsequent forbidden-Origin request reached the app and correctly returned403 with headers/log. This repeated after the original harness failure, including a focused minimal reproduction.

Relevant boundary: `apps/site-api/src/beta-access/routes.ts:28` cancels the oversized body; `server.ts:73` can decorate only responses that reach the app. Reproduction uses listener max-body8192 so the real application's2048-byte streaming limit is exercised.

**Exact impact:** this behavior failed closed; no authentication/tenant bypass, grant or sensitive response was observed. It is sufficient for denying access in this specific sequence, but does not meet the agreed exact HTTP/security-header/observability contract and makes the next valid request vulnerable to an unexpected transport error. Recommendation: review listener/body-cancellation/connection handling as one boundary, ensure an oversized request cannot poison the next request, and test actual listener-generated failures. If the approved contract is narrowed to permit platform-level400 without app headers/log, record that explicit exception and its operational limitation; do not silently change expected403 to400. No such exception was accepted here.

## Demonstrated successes and preserved failures

- First `a` fixture attempt stopped before admissions/HTTP because the provisional QA fixture-hash algorithm predated the final canonical manifest validation. Read-only diagnosis showed0 admissions/invitations/requests. This is **QA setup failure, not product failure**; original result and harness retained. Root authorized new `b` targets; `a` was neither reused nor deleted.
- The `b` harness recorded126 checks, including source/bootstrap checks:125 passed, then the original Origin check failed. Passed native cases include post-expiry receipt recovery after server/pool restart, no replay mutation, current DB identity mismatch, same-key concurrency, rollback after each of four writes, usable token after rollback, changed generation, revocation/tombstone/hash fences, restricted direct SQL, FORCE RLS, escaped duplicate keys and exact2048/2049 streamed bytes.
- The supplement completed28 checks:26 passed; F01 and the repeated F02 failed. A barrier observed the runtime waiting on the admission lock, expired its invitation, then verified404 and no membership. Redeem-then-revoke and revoke-before-redeem denial passed. Global60/min limiting preceded expensive auth, forwarded headers did not evade it, bucket capacity/expiry passed, and multibyte2049 bytes received413. Logs contained no synthetic token/digest/email canaries.
- Actual `pg_dump`/`pg_restore` into the new exact `b` restore target preserved hashes for admissions, pending/consumed/revoked invitations, memberships, receipts and audit. Startup rejected the unrebound target. After explicit target-name rebinding, the active member survived, revoked and tombstoned members remained denied, and the revoked receipt could not restore access. Source access-table hashes remained unchanged. This is wholly synthetic local recovery only.
- Root's provisional concern about the global-limit test was withdrawn after checking that the actor cap applies only to redemption; that test uses session reads. No product defect was assigned to that concern.

## Evidence and remaining scope

Evidence files share prefix `evaluations/research-qa/m80-beta-access-independent-20260925-`:

- `result-1790320333506.json`: preserved first QA setup failure.
- `result-1790320443548.json`: first integrated `b` result.
- `supplement-result-1790320635187.json`: native default-ACL probe, ordered-expiry race and actual restore results.
- `origin-result-1790320736176.json`: exact413/400/403 sequence, missing listener headers/log, Bun version.
- `harness-attempt1.ts`, `harness.ts`, `supplement.ts`, `origin-repro.ts`, `baseline-pins.json`: reproducible QA sources and source pins. The retained synthetic dump is diagnostic only and excluded from the public text snapshot/publication recommendation.

Not completed on the rejected candidate: full before/after legacy catalog/row/role parity, ordered concurrent admission-disable/revoke-first races, all pool-slot/identity-switch variations, explicit Auth timeout/banned-provider outcomes and malicious search-path shadowing. These remain pending; tested subsets do not establish full acceptance. Local fixture owner remains the preexisting superuser; no hosted owner/identity/security/recovery claim is made. No hosted credentials, ENV exports, real invitation/customer data, provider mutations, Git publication, legacy-role mutation or method/source releases occurred. Official PostgreSQL documentation was consulted read-only for F01.

Next owner: root routes a bounded correction/design assignment, preserves this first rejection, and supplies a newly frozen candidate plus exact newly authorized synthetic targets for independent re-review. Candidate1 is not cleared for publication as accepted access code. Four held methods and customer readiness remain separate gates.
