# M57 — bounded draft inventory review

Date: 2026-09-13

## Outcome

M57 puts the accepted M56 calculation into immutable inventory version 1 for the fixed synthetic 2023 operational-control boundary. It contains exactly one location-based purchased-electricity line for the Synthetic California office and January 2023:

`12.346000 MWh × 195.0402888 kg CO2e/MWh = 2407.9674055248 kg CO2e`

The displayed current draft subtotal is `2,407.9674 kg CO2e`. The inventory references the accepted M56 calculation and result hash; it does not copy a browser-editable total or recalculate the line.

## Honest completeness contract

The frozen denominator is one expected boundary facility across twelve 2023 monthly periods for location-based purchased electricity. The snapshot covers one facility and one period. February through December remain missing and are not interpreted as zero.

Every version preserves these ordered warnings:

1. Annual coverage is incomplete: 1 of 12 months.
2. Market-based Scope 2 is not included.
3. The factor and method are development candidates and are not released.
4. The local synthetic workflow is not assurance; Scope 1 and Scope 3 are not assessed.

`completeness` remains `incomplete`, the reporting boundary remains `draft`, and `releaseEligible` remains `false` before and after review.

## Review gate

An owner or administrator may seal the version. The submitting manager cannot decide it. The other authorized manager must acknowledge the exact four-warning set before `approve_bounded_draft`, or may record `changes_requested`. The terminal decision, actor, time, reason, acknowledgments, inventory snapshot hash, idempotency key and server-derived operation fingerprint are immutable.

“Approved bounded draft” means only that the exact synthetic evidence, lineage, arithmetic and disclosed limitations were accepted for continued internal development. It does not mean annual completeness, factor release, Stage 4 acceptance, filing approval, assurance or production release.

## Security and integrity

- New inventory, decision and audit tables enforce enabled and forced row-level security.
- Members can inspect authorized history but cannot prepare or decide. Foreign tenants see no inventory rows.
- Direct authenticated writes are not granted. Immutable triggers also reject update and delete attempts.
- M57 revokes the earlier broad authenticated mutation grants for reporting boundaries and boundary-facility links, closing a direct status-bypass path while preserving the fixed security-definer workflows.
- Tenant-scoped uniqueness, idempotency keys and operation fingerprints converge duplicate work and refuse conflicts.
- The browser accepts only the exact M57 response shape and sends bounded commands without totals, release flags, roles or actor identities.

## Demonstration and checks

The ordinary local browser journey passed:

1. The owner created the fixed workspace, reviewed the bill, linked version 2, ran the accepted M56 calculation and sealed inventory version 1.
2. The owner could not self-review.
3. The administrator acknowledged all four limitations and recorded `approved_bounded_draft`.
4. The page continued to show “Incomplete synthetic draft,” 1 of 12 periods, a draft boundary and release eligibility false.
5. A read-only member revisited the same decision history with no approval control.

Automated checks pass: 12 Python calculation tests; 625 site API tests / 5,372 assertions; 60 site web tests / 224 assertions; 19 database tests / 139 assertions; API, web and database TypeScript checks; site web lint; production build; and a production-output scan for M57 profile, warning, decision, result and feature-flag markers. The default production bundle contains none of those markers.

The local preview used an isolated in-memory PGlite database and loopback services. Missing OneDrive-backed development dependency files prevented the ordinary Vite dependency-optimization path, so the visual walkthrough used the successfully built flagged demonstration bundle behind a temporary loopback static/proxy host. This does not affect the production build or automated application checks.

## Limits

M57 uses fictional data only. It does not add other months, facilities, sources, market-based accounting, Scope 1, Scope 3, customer data, hosted persistence, production authentication, distributed concurrency, source expansion, filing output, assurance, deployment or release. PGlite tests do not establish hosted PostgreSQL or Supabase behavior.
