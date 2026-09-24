# M75 backend author evidence

Date: 2026-09-15

## Delivered boundary

- Persisted one append-only synthetic controlled-fleet roster stream per company, immutable statements, versions, independent reviews, reports, idempotency records and audit records in additive schema 18.
- Captured exact current M71 and all current M74 head/review pins under the company lock. Current registers include the current proof tuple and the exact roster-bound coverage version; historical report proof reconstructs retained pinned versions and captured null reviews.
- Derived the full roster/M71/M74 union deterministically. Unknown, unsupported, duplicate, orphan, incomplete, unreviewed and stale rows remain visible and blocking. No emissions aggregation, released method, complete Scope 1 claim or assurance claim is produced.
- Enforced the same nested activity normalization, exact roster-local findings, dependency tuple, statement bytes, reconciliation rows/findings/counts/pins, HTML renderer and immutable hashes in PostgreSQL. Runtime callers cannot use self-supplied hashes as authority.
- Kept reports compact in the register and exposed exact report bodies and retained historical proof by report ID.

## Verification

- Package and API TypeScript checks pass.
- Independent pure classification, renderer and browser decoder suite: 68 tests, 811 assertions passed.
- Fresh schema 14 to 18 author fixture and PostgreSQL/API lifecycle pass, including private access, idempotency, contributor review refusal, immutable blocked report/proof, concurrent correction conflict and fresh-connection replay.
- Exact SQL roster-finding parity: 50 independent cases passed before integration.
- Exact SQL reconciliation parity: 50 independent cases passed before integration.
- Independent direct-function adversarial suite: 35/35 probes passed, including valid controls and malformed, null, rehashed and coordinated semantic forgeries. Every probe rolled back.
- Independent native capacity lifecycle: 1 test, 51 assertions passed across 40 immutable versions and 40 reports; both 41st writes were refused and historical bytes remained unchanged.
- `git diff --check` passes for the owned files.

## Limits

- Calendar 2025, California-based synthetic initial profile only.
- The roster is a declared and internally reviewed population artifact; it cannot independently discover undisclosed physical vehicles or arbitrary false identities.
- M74 remains capped at three workpaper streams. Additional disclosed vehicles remain in the roster and block reconciliation.
- Customer uploads, private source retrieval, factor or method release, emissions aggregation, complete Scope 1 reporting and external assurance remain outside M75.

## Routing disclosure

The data-database registry requested Astra/high for this critical assignment. The reassigned existing worker context exposed Sol/medium and did not provide a verified runtime model override, so this delivery records that routing exception. Independent accounting QA and operator recovery review remain separate from implementation authorship.
