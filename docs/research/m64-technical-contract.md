# M64 technical contract — immutable manual electricity worksheet

September 14, 2026. Author/executor M64-CTO, requested Astra/high; observed model/effort unavailable. This is implementation evidence, not independent release acceptance. Accounting approval: `docs/research/m64-accounting-contract.md`; reviewed exact expectations: `evaluations/research-qa/m64-accounting-cases.json`.

## Product and API boundary

The new profile is `neuvetra.synthetic.manual-electricity-worksheet.v1`, with accounting profile `manual-synthetic-2023-01-camx-kwh-v1` and policy `m64-accounting-policy-v1`. `packages/neuvetra-database/src/m64.ts` exports the concrete request/response types, qualifications and method pins. Each company has one worksheet containing immutable chronological versions. Fictional company/facility labels belong only to the worksheet version and never rename the existing company, facility, annual report or M63 fixtures.

All paths start `/workspace-api/workspace/:companyId/electricity-worksheet`. GET reads the entire verified worksheet, including empty history. POST creates the first version. POST `/corrections` requires the exact current predecessor ID/result hash and a changed canonical quantity with an ASCII reason. POST `/reviews` requires the exact version/result hash and a distinct authorized manager. Accepting requires the seven exact limitation acknowledgments; requesting changes requires an ASCII note and no acceptance acknowledgments. One immutable decision per version is allowed; correction preserves historical decisions and creates an unreviewed version.

Responses are direct `ElectricityWorksheet` objects. Reads return 200; writes/retries return 201; invalid input 422; member writes 403; inaccessible worksheet 404; exact-version or idempotency conflict 409; verification/dependency failures 503. Existing staging gates still return signed-out 401 and uninvited 403. Mutations require the configured exact Origin. Staging bounds request bodies, authenticates the real subject, validates current invitation, sanitizes logs and disables caching. The new route does not relax the fixed M54-M63 request/response schemas.

## Calculation and lineage

SQL NUMERIC computes authoritative results from validated ASCII decimal strings, converts kWh to MWh exactly, and implements half-even display using integer quotient/remainder. TypeScript BigInt independently recomputes every stored numerical result on read. No browser or model computes the authoritative subtotal. Original candidate/method/GWP/source hashes remain pinned. Result hashes bind input hashes, exact/display values, all method pins and synthetic/incomplete/unreleased/no-assurance limitations.

Input hashes bind profile, tenant, version identity/ordinal/predecessor, actor, fictional labels, canonical quantity, fixed period/geography/unit and correction reason. Review hashes bind tenant, review/version identities, exact result hash, decision/note/acknowledgments and reviewer identity. Timestamps are normalized to ISO and checked against the exact audit event. JSON payload keys and constant values are compared independently of object property order. Every read reconstructs the complete version chain, recalculates results/hashes, and verifies exactly one corresponding audit event. The current worksheet stays incomplete even when quantity is explicit zero.

M64 displays only the authoritative AI6 subtotal. It does not display or substitute component gas sums, expand factor selection, generalize annual reporting, or propagate a worksheet review into the retained M63 report.

## Tenant, concurrency and persistence controls

Migration `0010_manual_electricity_worksheet.sql` adds four tables: immutable versions, reviews, idempotency requests and audit events. Forced RLS uses the existing active-invitation/company membership helper. The hosted runtime has SELECT and only two explicit security-definer mutation entrypoints; it has no direct writes. Every mutation rechecks the verified subject and manager membership inside SQL. The member/outsider boundary therefore applies even without the HTTP layer.

Mutations lock the company row, serialize correction/review races, and generate all numerical data, hashes and audit events within one transaction. Canonicalized same-key and different-key retries by the same actor converge to one version and one audit event. A reused key with a different fingerprint refuses. A stale base with different content refuses; an exact retry may recover its committed result after a later correction. Request mappings are immutable and preserve cross-action key conflicts. Every correction starts without a review.

## Upgrade and rollback

The operator migrator accepts only an exact recorded nine-migration baseline or the exact current ten-migration baseline, checks every retained checksum and target, and applies the additive suffix atomically. Original 0001–0009 migration bytes and historical records stay unchanged. Ordinary startup never migrates. Schema10 readiness requires all ten canonical receipts and existing runtime-role/forced-RLS controls.

Root must take the authorized encrypted backup before hosted migration. The old M63 application hardcodes schema9 and cannot report ready after migration10. A bounded maintenance window between atomic migration10 and the new image is required unless a separately reviewed compatibility image is deployed beforehand. Rollback retains additive tables/history and uses a schema10-compatible image; do not delete accepted history or claim the old schema9 image is ready-compatible. Off-device recovery, provider Auth restoration, proactive alerts and scheduled backup remain explicit launch gaps.

The existing migration9 fresh bootstrap expects its cluster role to be absent. This milestone preserves that precondition and does not silently rewrite migration bytes or stamp checksums for different SQL. Independent QA clones the preserved local baseline into its dedicated database to test the actual nine-to-ten upgrade.

## Checks and handoff

Author tests pass new database/API boundary cases including the accounting-approved exact decimals, both half-even parity cases, zero, malformed/unsupported inputs, canonical no-op corrections, exact-version review, immutable history, concurrent retry convergence and actor boundaries. The broader database plus staging suite passes 40 tests / 392 assertions, with nine opt-in PostgreSQL cases visibly skipped in that run. Independent QA owns actual PostgreSQL upgrade, full numerical equivalence, active second-tenant refusal, corruption challenges, integrated frontend decoders and hosted browser acceptance. Root owns encrypted backup, deployment, rolling PR publication and operational records. No cloud, Git, secrets, invitation or customer data action was performed by this author.

## First-review findings retained

Independent accounting found M64-ACC-F01: PostgreSQL NUMERIC division rounded an intermediate exact total for `62499.999 kWh`; the read verifier refused the changed value. The migration now multiplies by exact decimal powers and uses `div` for the integer quotient. All 18 public accounting cases are exercised by the permanent author test through SQL persistence and readback, including near-tie neighbors; independent accounting re-review passes the repaired arithmetic.

Independent PostgreSQL QA found M64-QA-F01: the native driver JSON-serialized an already serialized request string when its SQL placeholder was typed directly as JSONB. Both domain entrypoints now bind serialized text with `::text::jsonb`. Focused author checks after both repairs pass 4 tests / 90 assertions and database/API typechecks. Native-driver recheck remains independently owned; these defects must remain in the role improvement record. The earlier 40-test broader count was measured before these final repairs and is not presented as a final integrated release check.

Reads now collect versions, reviews and audit rows using one PostgreSQL statement snapshot so a concurrent commit cannot split the record and audit views.

The permanent native staged-API regression in `apps/site-api/src/staging/postgres.test.ts` now extends the unchanged M63 flow with M64 initial create at `62499.999`, distinct-manager acceptance, correction to the half-even tie at `62500`, same-operation concurrent retries, stale/invalid refusals, member readback after pool recreation, and preservation of the old M63 report/review hashes. This extension typechecks; its actual execution is assigned to the native CI/independent QA boundary. CI must run the existing `hosted.test.ts` fixture bootstrap first with `M63_TEST_DATABASE_URL`, then this test with `M63_API_TEST_DATABASE_URL`, both against the guarded fresh loopback `m63_integration` fixture. Retained local M63 databases were not modified by this author.
