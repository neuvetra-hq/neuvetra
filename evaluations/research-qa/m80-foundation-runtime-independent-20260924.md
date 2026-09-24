# M80 synthetic foundation runtime independent review

Verdict: **pass_synthetic_foundation_runtime_only** for Candidate 2, snapshot `40c4ac822ef2d045457ade7dd63d471813178c8f3a585425be58eb81013de59b`, migration `0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35`. All 13 frozen file hashes matched before and after execution.

## Demonstrated controls

Two independent native tests passed with **322 assertions**. The main test covered 20 groups through the real PostgreSQL driver, database adapter and mounted staging HTTP server. Authentication and asset delivery used explicit synthetic stubs; no real authentication provider was contacted.

- Upgrade from the retained schema-21 synthetic template preserved 120 non-receipt table digests and all 21 old migration receipt rows (121 old tables in total), plus existing roles, memberships, default ACLs, relation/column/constraint/policy/index/trigger/function definitions and grants. Reapplication was a no-op; changed receipts and occupied migration objects refused.
- All six new tables force RLS. Owner/admin can save; member cannot. Two admitted tenants can reuse an idempotency key but cannot read or reuse each other's versions. The runtime cannot directly insert, update, delete, truncate or use the audit sequence. Only the bounded security-definer writer has runtime execute permission; its search path is fixed.
- Forty-five malformed setup variants were refused through HTTP and direct SQL, with valid direct write/readback controls. Exact metadata types, canonical timestamps, fixture identities, closed fields, explicit unknowns and zero released-supported results are enforced.
- Seven cumulative single-field corrections preserve original history. Changed-key content, stale predecessors and concurrent successors fail as required. Old-key replay after later saves returns the original record.
- Cached edit state does not survive role, active-access or fixture-admission revocation. Access revoked during pending authentication is refused. Corrupt, missing, duplicated, released, expired or superseded registry rows fail closed.
- Changed canonical bytes, missing audit/request rows, a changed request fingerprint and coordinated payload/hash/version-hash forgery fail current or historic reads. Each operator-only tamper stayed inside a rollback transaction; table baselines were restored. Staging logs omit payloads, bearer values and rejected canaries.

## Preserved first failure

Candidate 1 failed **F01**: the direct SQL writer accepted string `"2025"` instead of numeric `2025` in version metadata with a recomputed hash. The inserted row then failed the actual adapter's version-integrity check. The failed candidate, 209-assertion execution, retained local clone, reproduction and immutable FIRST-REVIEW snapshot remain preserved. Candidate 2 requires exact scalar/number types and canonical UTC millisecond timestamps; the adversarial variants now refuse and valid direct readback passes.

Initial harness attempts were interrupted while nested connection use and Bun's asynchronous rejection matcher stalled transactions. The reviewer replaced the matcher with explicit awaited try/catch before the recorded candidate-1 failure and candidate-2 pass. These were harness issues, not successful product checks.

## Limits and handoff

This verdict covers the local held-only synthetic runtime. It does not accept a hosted migration/deployment, real authentication-provider integration, frontend/browser behavior, source/domain/rights release, calculations, real documents, invitations, customer readiness, complete SB 253 reporting or professional assurance. Temporary HTTP service and QA connections are closed; isolated QA clones remain retained. The implementation author owns the local database cluster lifecycle.

Root may accept this review artifact and integrate only the exact reviewed candidate. Frontend integration needs its separate independent review.
