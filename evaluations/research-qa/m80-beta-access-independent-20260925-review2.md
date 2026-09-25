# M80 beta access Candidate2: independent bounded acceptance

**Verdict: pass for the accepted local synthetic access increment.** F01 and F02 are resolved on the exact Candidate2 below. This is not hosted deployment, invitation readiness, accounting/source release or customer readiness. Reviewer `/root/m80_beta_access_qa` authored no implementation source. Requested Astra/high; observed compute and actual cost remain unknown.

## Exact candidate and evidence

Candidate snapshot `operations/agent-improvement/snapshots/M80-BETA-ACCESS-IMPLEMENTATION-20260925-CANDIDATE2.json`: SHA256 `1c4e9adfc358fddf20f79ab89747a29989624de456fe8faeab36d6787344e676`. All18 embedded/current source files match exact UTF8 bytes before and after native review. Author evidence SHA256 `346ae84e0b77fe2de21574df00d46ff4d059231654bbaf286badc2bafd7bc8e4`; its test totals were not substituted for independent results.

Independent results use prefix `evaluations/research-qa/m80-beta-access-independent-20260925-`:

| Evidence | Actual outcome |
| --- | --- |
| `c2-result-1790322732930.json` | Main suite:239 recorded checks passed, including source/bootstrap checks; not239 distinct tests. |
| `c2-supplement-result-1790322971984.json` |67 supplemental checks passed: ordered races, owner/identity/pool controls, disconnect lifecycle, native restore and legacy parity. |
| `c2-drift-result-1790323103762.json` |27 checks passed: committed new-role/default/helper/ownership drift refusals, restoration, competing invitation races and final legacy parity. |
| `c2-final-pins.json` | Final18 exact-byte pins, author evidence pin, private archive hash and decoding caveat. |

Executable sources are `c2-native.ts`, `c2-checks.ts`, `c2-supplement.ts` and `c2-drift.ts`; each native runner checks the frozen candidate and uses only the authorized synthetic targets.

## Correction findings closed

**F01 — future-function privilege defaults:** the new NOLOGIN/non-superuser/non-bypass owner owns the new schema/eight tables/three entrypoints. Only the two fixed private helpers remain operator-owned. Native checks confirmed no owner/runtime memberships in either direction, no owner direct auth/legacy privileges, private-helper denial to runtime and runtime inability to switch to owner/operator. A future benign function created using `SET LOCAL ROLE` new owner was denied to the real runtime login with SQLSTATE42501. Existing old-owner defaults remained unchanged.

Committed fault probes changed only the new beta boundary: owner function defaults, owner LOGIN, each membership direction between the two new roles, private-helper runtime grant and new-table owner. Both runtime readiness and exact installer replay refused every drift; the prior state was restored and readiness passed. Creating as the old operator then transferring ownership was not treated as the supported creator path. A malicious superuser remains outside this boundary.

**F02 — oversized request/connection lifecycle:** the actual Candidate2 `node:http` listener, forwarding to the same app/native adapter, returned decorated413 for a raw chunked2049-byte body with Connection-close and observed server EOF within the bounded probe. The following client request reconnected and received normal403 with security headers/log. Exact2048/2049, multibyte2049, strict/duplicate/authority fields, forbidden origin, global/per-actor bounds and safe logging passed. The listener binds loopback only.

An incomplete Content-Length request disconnected after entering the real app settled as422; it did not leave the body reader pending. A separate bounded synthetic response exercised the same actual listener under backpressure; peer disconnect cancelled the response after three256KiB pulls. This listener-only stress fixture is explicitly distinct from the small real API responses. Neither probe used a substitute listener.

## Access, race and recovery coverage

- One-use redemption, identical successful receipt recovery after original token expiry and server/pool restart, no duplicate write/audit, same-key/different-input conflict, consumed-token different-key denial, wrong current DB identity and unconfirmed identity all exercised actual HTTP/native boundaries.
- Same-token/different-key and competing owner/member invitation races produced exactly one membership; a losing invitation could not upgrade role. All four intermediate write failures rolled back atomically; the same token then remained usable.
- Native lock barriers proved post-lock expiry denial, revoke-first denial, admission-disable-first denial and identity-change ordering on both sides of the identity lock. Subsequent reads/retries denied revoked, disabled, unconfirmed, changed-generation, tampered-manifest or tombstoned authority. Synthetic admission-disable fault cleanup restored only a non-tombstoned prior active flag through the QA operator; no product reactivation endpoint or tombstone reset is claimed.
- Direct restricted SQL, private helpers, owner escape, temporary search-path shadows and cross-tenant access were denied. One real pool slot cleared transaction-local claims across A/B/signed-out/error transitions. Provider adapter checks used mocked confirmed/unconfirmed/banned/deleted/rejected outcomes; an injected provider timeout error produced503 without fallback.
- Native dump/restore into the exact new restore target preserved hashes of admissions, pending/consumed/revoked invitations, memberships, receipts and audit. Unrebound startup failed. After explicit target-name rebinding, active access survived; revoked/tombstoned reads and revoked receipt recovery stayed denied. The archive was written directly to the authorized private location; public artifacts contain only archive/state hashes. Two later race-only grants were revoked through supported operations; the earlier restore lacks those grants and could not resurrect them.

## Preservation and first failures

All127 prior `neuvetra` table row hashes/counts and captured schema/relation/column/function/constraint/policy/index/trigger/enum/role/membership/default-ACL metadata matched before install, after exact replay and after every completed suite. The only explicitly classified old-table dependency addition was two FK enforcement triggers linking new beta admissions to existing companies. Existing helper/migration bytes also remained pinned. No legacy role/default or staging admission was changed.

Candidate1 rejection/first failures and REVIEW1 snapshot remain immutable. Candidate2's first QA attempt stopped before beta install because its read-only IP guard compared `127.0.0.1/32` with `127.0.0.1`. Root authorized narrow continuation on the already-created `c` baseline after switching to `host(inet_server_addr())`; exact22 receipts, fixed fixtures and absent beta schema were verified before the first install. No bootstrap/role creation was replayed. Original result `c2-result-1790322648589.json` and first harness/helper versions remain retained. This was a QA guard error, not an implementation failure.

A final Python comparison using default Windows text decoding briefly misread a Unicode source character; explicit UTF8/raw-byte verification confirmed exact current/embedded bytes. No author-source mismatch was found.

## Limits and next owner

Acceptance covers the local synthetic contract plus root's owner/transport corrections. Real provider project binding, email behavior, timeout enforcement, distributed limits, proxy/parser behavior, hosted least privilege, hosted recovery and customer data remain untested gates. The timeout test establishes fail-closed handling of a provider timeout error, not a real-provider deadline guarantee. Full-repository checks/remote CI/publication were not independently rerun here; root owns those final steps. Four held methods and independent domain/accounting decisions remain unchanged.

Root may accept this exact reviewed correction and publish the frozen bytes on the rolling PR after its required artifact/remote checks. No hosted action, real invitation, new recipient/data authority or later dependent milestone is authorized by this review.
