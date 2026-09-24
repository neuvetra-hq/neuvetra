# M73 independent security and reliability review

Reviewer: `/root/m73_cpo`, acting in security/reliability independent-review mode; sponsor QA/coordinator. Fresh `/root/m73_security` and historical `/root/m68_qa` dispatches were rejected by the runtime thread limit, so this existing context was reused. Critical `gpt-6-astra` / `high` was requested but could not be applied to the existing context; observed model/effort are unknown. Security role prompt SHA-256: `3b3c1d31d5e5e35bf90ad971d4511a7693b7f14d12f2eb7ac0ed4723cc0b79d3`.

The reviewer authored M73 product criteria in `docs/research/m73-product-brief.md`. The reviewer did not author the accounting contract, technical contract, database/API/calculation/report implementation or migration0016. Product authorship is a partial independence limitation; final implementation security testing remains independent of the implementation authors. This review covers the bounded synthetic M73 implementation only and cannot approve source/method release, production readiness, corporate Scope 1 completeness, legal compliance or external assurance.

## Current verdict

**PASS for the bounded local candidate 2 implementation, with no release or production claim.** F01 and F02 were repaired and independently verified. No open critical, high or medium security finding remains in the reviewed snapshot. This verdict covers the exact local artifacts and tests below. It does not approve the factor/method corpus, hosted migration, production readiness, corporate Scope 1 completeness, legal compliance or external assurance. Root-owned private backup/restore, hosted execution, actual browser/print evidence and publication remain separate gates.

## Reviewed planning inputs

| Input | First-reviewed SHA-256 | Disposition |
| --- | --- | --- |
| `docs/research/m73-technical-contract.md` | `c25efb1d9524a92df9f424a33c3d3481d044cb3873ae9095a86b09ab3ff69d86` | Strong overall design; F01–F02 require repair before implementation freeze. |
| `docs/research/m73-accounting-contract.md` | `925ddba8b37048cd0949361528f41e6b9e90e388cb3270797e89d45f45597d29` | Security-relevant evidence, candidate-release and immutable-lineage constraints are suitable planning inputs; no integrated verification yet. |
| `docs/research/m73-product-brief.md` | `3acfef7986104386d1513f17d2a81fdfc676848248127ecc1086cc469f83fa35` | Reviewer-authored product criteria; treated as requirements, not independent evidence. |

## Frozen artifacts and independent checks

| Artifact | SHA-256 | Independent result |
| --- | --- | --- |
| `operations/agent-improvement/snapshots/M73-INTEGRATED-CANDIDATE1.json` | `383ad6db367ec3dbfaac80c0279afad7b00917c5a053be8e5efd8b4210ffb1a5` | Snapshot and all 26 listed filesystem hashes matched. Preserved as the implementation first reviewed after F01/F02 repair. |
| `operations/agent-improvement/snapshots/M73-INTEGRATED-CANDIDATE2.json` | `2ba1377a9f7dab526072a042b9dcaaa9ca5c0d3c030773e07612afaebc121a47` | Snapshot and all 26 listed filesystem hashes matched. The exact delta from candidate 1 was limited to the report renderer, matching SQL renderer and evidence presentation component. |
| `packages/neuvetra-database/src/migrations/0016_stationary_natural_gas.sql` | `2f5489d37fdd59963d12e60947b8dddce34cc4e1dc4100813545b1c0dbb1c9b7` | Applied to a fresh schema15 clone and verified as described below. |
| `operations/agent-improvement/snapshots/M73-OPERATORS-CANDIDATE2.json` | `6d2055385df4a9d4aa64a6aecd9884a36af9275c480aaed83b32605a58eead06` | Snapshot and all 11 listed helper/note hashes matched. Static review found no material defect in the exact URL/TLS restriction, encrypted archive, new-database refusal, receipt, rollback-state or migration gates. Private execution was outside this review. |

Independent tests used a restored copy of the read-only `m71_author_release` schema15 source in the new disposable database `m73_security_r5` on loopback port55463. No existing database was changed.

- `evaluations/research-qa/m73-security-native.test.ts`: **2 passed, 41 assertions**. It applied the exact candidate2 migration, retained every earlier application row, confirmed all seven new tables force RLS, and retained the restricted runtime-role posture. The lifecycle probes covered signed-out, outsider and member denial; tenant-filtered runtime reads; direct-update denial; forged deterministic-result refusal; exact reviewed/unreviewed report binding; exact statement/report bytes and defensive headers; duplicate source/meter/reference refusal; identical retry and competing-CAS behavior; admission revocation before read and retry with no mutation; and fail-closed readback after privileged statement corruption.
- `evaluations/research-qa/m73-security-authority.test.ts`: **1 passed, 6 assertions**. Three simultaneous calculations admitted two children and refused the third, failures exposed only the fixed public error, and slots were released after both success and failure.
- Independent rerun of `apps/site-api/src/calculation/m73-authority.test.ts` and `apps/site-web/src/lib/m73-api.test.ts`: **6 passed, 45 assertions**. These exercised the real Python engine, accounting vectors and rounding ties, tampered replay, altered methods and statement bytes, self-consistent report-HTML forgery, aborted responses and private-error suppression.

The candidate2 report was also regenerated through the native route. Its gas trace and statement are readable labeled fields, the exact provenance JSON is contained in a collapsed technical appendix and excluded from ordinary print unless opened, and all supplied text is escaped. Code inspection confirmed the modal report viewer uses a scriptless sandbox, cleans up on actor/workspace lifetime changes and returns focus; the print action uses the exact freshly authorized retained HTML. Root owns the separate actual-browser/print demonstration.

The technical contract already requires server-derived tenant/actor identity, current membership and admission, fixed lock order, forced RLS, nonowner runtime, no direct writes, constrained security-definer procedures, current-head source admission, immutable versions/statements/reviews/reports/audits, exact replay after renewed authorization, cumulative contributor separation, duplicate source/meter/reference controls, canonical serialization, deterministic report/statement regeneration, bounded Python execution, error sanitization, restart/restore evidence and fail-closed readback. These are design statements awaiting executable proof.

Applicable improvement lessons are L01 (actor/tenant changes and late responses) and L02 (semantic lineage beyond coordinated stored bytes/hash/length). Exact public downloads, browser actions and composed corrections remain required acceptance boundaries even though L04/L06 are owned by the implementation and QA workstreams.

## First findings — 2026-09-15

### F01 — report decision omission can create a misleading snapshot

**Severity: high within the bounded integrity model. Status: closed in candidate1 and reverified in candidate2.** `M73ReportInput` permits `expectedDecisionId` and `expectedDecisionSha256` to be null, while the report section says the caller pins the current decision “or null.” It did not require null/null only when the selected version actually had no decision. After a decision existed, a manager could therefore request null/null and create a report presented as unreviewed, breaking the exact review-state lineage and the two-state-per-version contract.

Required repair: inside the same authorized report transaction, load the selected version's one immutable decision and require the pair to match it exactly. Accept null/null only when no decision exists; reject mixed nulls or omission of an existing decision with 409 and no report/request/audit mutation. Exact idempotent replay still rechecks current admission and membership before returning the original result. Tests must exercise unreviewed creation before review, reviewed creation after review, omitted/changed/cross-version decision pins after review, concurrent review/report ordering and exact old report retention.

Implemented result: the SQL report function now compares the requested decision ID/hash pair with the one immutable decision selected inside the locked transaction, including exact null semantics. A reviewed-version request with null/null returned 409 and created no report. Idempotent access continues through current admission and membership checks.

### F02 — exact document downloads lacked a frozen response-header contract

**Severity: medium. Status: closed in candidate1 and reverified in candidate2.** The contract required deterministic escaping and exact HTML/text bytes but did not specify defensive response headers. A renderer defect or future template regression would otherwise expose a stored-script path when a report was opened, and content sniffing could reinterpret statement text.

Required repair: report download returns `text/html; charset=utf-8`, attachment disposition, private/no-store caching, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a restrictive CSP equivalent to `default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-modals`. Statement download returns `text/plain; charset=utf-8`, attachment disposition, private/no-store, nosniff and no-referrer. Tests must verify exact bytes and headers for authorized users plus uniform inaccessible-resource behavior for outsiders.

Implemented result: report and statement downloads returned exact retained bytes with attachment disposition, `no-store`, `nosniff` and `no-referrer`; HTML also returned the restrictive CSP and sandbox policy. Outsider access retained the resource-hiding response.

Both findings were sent immediately to the coordinator and CTO contract author. They were planning defects, not evidence of an exploited or deployed vulnerability.

## Integrated review result

The final review bound the exact integrated snapshot and exercised or inspected the following boundaries:

1. Migration0016 is additive; all seven tables force RLS; runtime flags/grants and security-definer ownership/search paths are least privilege; direct runtime writes and forged procedures fail.
2. Admission/member revocation and manager-to-member changes conflict with pending save/review/report locks. Owner-to-member-to-outsider-to-signed-out UI lifetimes abort or discard late results and clear actor-owned derived state.
3. Current M71 head, tenant, company, entity, facility, stable source, boundary decision, period and source domain are resolved from authoritative bytes inside the writer transaction. Labels, caller hashes and a quantity-free M71 screening memo grant no admission.
4. Concurrent first saves, corrections, reviews, reports, stream/version capacity and exact/same-key retries produce one durable outcome or a finite conflict. A newer M71 version cannot create a duplicate stream; a correction cannot change source ID.
5. Same company/source/fuel/year uniqueness and normalized meter/reference/year duplicate rules hold across streams, concurrency and M71 successors. Known differently worded-identity limits remain explicit.
6. Missing activity persists null without calculation; numeric activity without the exact statement/manual confirmation refuses; zero needs compatible zero evidence and rationale; statement/activity discrepancy remains visible after bounded acceptance.
7. Coordinated statement/report bytes/hash/length changes, binding swaps, native numeric/payload divergence, predecessor/contributor/request/audit corruption, factor/method changes and cross-review report bindings make the affected resource unavailable. A self-consistent caller/operator hash is not trusted provenance.
8. The Python child uses the pinned executable/dependency, argument-array invocation, bounded concurrency/time/input/output, minimal environment and sanitized errors; failures commit no partial statement/version rows.
9. Statement, calculation export and report downloads enforce current membership, exact tenant/stream binding, exact bytes and the repaired response-header contract. Report decision pins follow F01. HTML escapes every supplied label/description/reason and retains incomplete/candidate claims.
10. A new isolated schema15 clone upgraded through exact migration0016 and preserved all earlier application rows and receipts. Actual application restart, sealed-archive restore on port55472 and hosted rollout remain separate coordinator gates.

Known bounded limitations remain explicit: duplicate detection canonicalizes exact issuer/meter/reference wording and does not reconcile differently worded identities; the synthetic statement is manual evidence rather than an authenticated utility document; operator/provider recovery excludes real Auth accounts, sessions, provider configuration and storage; factors and methods remain unreleased candidates; and this single-source subtotal never represents full Scope 1. No host, provider credential, ENV export, customer data, paid request or publication was accessed or performed in this review.
