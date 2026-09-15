# M71 independent security review

Status: **PASS for the bounded local M71 security/data-integrity scope on the frozen candidate below.** Task M71-SECURITY/QA; reviewer `/root/m70_research`, reused after the coordinator reported a new-dispatch runtime limit. Requested critical route Astra/high; actual inherited settings unknown. This context authored M70 research, not the M71 implementation under review. No M71 application, database or UI control was authored by this reviewer.

## Scope and expected evidence

The board's latest California-first direction governs the default fixture. Necessary company operations elsewhere are retained for boundary assessment with unsupported findings; this creates no separate regional product. The review concerns the synthetic versioned register, not real customer readiness, new emission methods, legal applicability or external assurance.

| Criterion | Independent challenge | Current result |
| --- | --- | --- |
| COV-05 | Anonymous/member/manager/outsider routes, foreign tenant IDs, runtime RLS/direct mutation refusal, admission and membership revocation during pending operations, stale browser response | Pass on final candidate; actual native API/SQL plus injected component/adapter tests |
| COV-06 | Unknown/duplicate keys, changed fingerprint, actor-scoped idempotency, stale-head race, no-op and explanation-only correction | Pass; normalization/domain cases additionally owned by independent product QA |
| COV-07 | Earlier contributor cannot review after another manager saves; independent manager can review the exact head; correction clears current review; old exported bytes remain fixed | Pass in actual native API, with production frontend decoder |
| COV-09 | Coordinated payload/hash corruption, invalid period, missing audit/request, corrupt retry outcome and retained export | Pass after F03 repair; actual route refusal plus rollback-only reader challenges |
| COV-12 | Forced RLS, non-owner least privilege, exact migration receipts, legacy preservation, restart and restore/readback | Native role/migration/old-row checks pass; independent QA restore and root HTTP restart evidence pass (separately attributed) |

Applicable lessons: L01 actor/tenant lifetime, L02 semantic integrity beyond self-consistent hashes, L04 actual public boundaries and L06 composed lifecycle. Author tests and inherited passes are leads, not independent evidence.

## Initial control handoff

Backend and coordinator were told to preserve transaction-current staging admission and membership with revocation-compatible lock order; uniform inaccessible-resource responses; server-derived identity; accumulated contributor independence; tenant/actor/operation-scoped idempotency; immutable exact-version exports; strict input handling; private no-store downloads and discarded late responses after authority changes.

At the initial handoff no implementation defect had been asserted. First actual findings and their repairs are preserved below rather than rewritten into a first-pass success. Review will bind the exact implementation and test bytes after the candidate is available. No hosted service, provider, paid call, real customer data or production tenant was accessed for this assignment.

## First findings (preserved)

**F01 — strict location types (reproduced in validation, native outcome pending).** Current `validateM71Snapshot` accepted entity `countryCode: ["US"]` and `regionCode: ["CA"]`; regular-expression tests coerced arrays to strings. Facility validation used the same pattern. A direct validator probe confirmed the returned country value remained an array. Backend and QA were notified to enforce primitive string types before the pattern checks. Native API refusal remains required; this finding alone does not claim the malformed record could be saved.

Initial parser test execution returned 1 pass / 2 failures: one F01 failure and one reviewer expectation-escaping error in the valid JSON control. The latter expected literal backslashes after JSON decoding; its expectation was repaired. This test defect is not attributed to product code.

### Inherited baseline checked

`bun test apps/site-web/src/lib/staging-authorization.test.ts` passed 7 tests / 50 assertions. This exercises the existing authorization subscription/component harness; it does not establish the new register's rendering or fetch-state behavior.

Static inspection found that the existing operator `revokeStagingAccess` updates `staging_access`, while the historical annual-electricity read lock locks `companies`. Backend was explicitly warned that copying the latter alone cannot prove the new admission/revocation ordering. This is an implementation precaution, not an asserted M71 defect. The independent native challenge will hold admission, begin a pending request, revoke, then release the lock and inspect the actual result.

### Native fixture baseline limitation (first observation)

Coordinator authorized a read-only dump of task-owned `m63_integration` and a restore into new isolated `m71_security` on loopback port 55463. The source had **11**, not 14, migration receipts. The canonical migration runner correctly refused the copied baseline: `0011_worksheet_reports.sql` receipt `9032e4ae40eb3e7e04b9329dca5c2bbafc52197a94742cd7a3720a055cd06fb0` differs from current canonical `a597d9b479321f308efa8de880a814c2ebd8dc29afa43fbff10a41a07ff66a99`. No receipts were rewritten and the source database was not changed. This is an inherited fixture limitation; M71 native execution remains pending a verified baseline or explicit isolated-bootstrap resolution. It is not an M71 implementation defect.

Coordinator subsequently authorized read-only copying `m68_qa` to a separate `m71_security_v14`. All 14 source receipts were independently compared with the canonical manifest before the dump and matched. Restore succeeded with 14 receipts. The failed earlier fixture remains preserved; neither source database was mutated. The native test target guard permits only `m71_security_v14` on the same authorized loopback port.

## Candidate execution and additional first findings

The first 0015 candidate (`66b1374e611d9f6087d0896c8574d4218600a31c0e62591cd24f68d18a02ca07`) migrated the verified clone. Initial actual staged API execution passed 4 tests / 57 assertions. F01 subsequently passed independent parser and actual HTTP refusal tests after explicit scalar checks were added.

**F02 — nullable SQL review decision (reproduced, repaired and retested).** The SECURITY DEFINER review function accepted `decision: null` with otherwise valid current-head independent review input. SQL's three-valued `NOT IN` predicate did not reject NULL. The independent probe deliberately rolled back. A valid direct-SQL review control proved the function was callable. The author added explicit scalar/UUID/hash/normalization checks. Re-cloned the original verified 14-receipt dump to new `m71_security_r2` and migrated candidate `fa2d0ebef1d2c7cbed6631f15aa9cdb028fb7e1e7f3264d70a4070aeb9e0026d`; the malformed decision now rejects with SQLSTATE 22023, while the positive control succeeds inside a rollback.

Reviewer test correction: the first direct-SQL negative probes used `$3::jsonb`, which lets the PostgreSQL driver encode the already serialized input as a JSON string. Generic rejection alone was therefore insufficient evidence. All affected probes now use `$3::text::jsonb`; the positive control and exact rejection-code assertion exposed F02. The initial 10-pass report is superseded by this corrected evidence. A later frontend hook harness also needed CRLF-safe import stripping and the newly imported maximum-version constant injected after the UI candidate changed; its two harness failures were not product failures.

**F03 — corrupt request outcome accepted on actual retry (open at this writing).** The reader verifies versions, heads, reviews and audits but omitted request records. In the isolated reviewer fixture, changing the creation request's `record_id` to a later valid version while retaining its original fingerprint caused actual staged POST retry to return HTTP 201, instead of rejecting inconsistent provenance. The exact request row was restored in `finally`. Backend and coordinator received the reproduction; CPO independently identified the same request/audit agreement gap. No tenant crossing or ordinary runtime write privilege is claimed by this corruption test. This is an integrity/replay defect within the required storage-corruption challenge.

Current corrected native run: **12 pass / 1 fail / 116 assertions**; sole failing test is F03. Actual missing-audit corruption returns 503 from collection, exact-version and coverage-export routes with `no-store` and no company label. Admission-revocation and membership-downgrade races observe a real `pg_stat_activity` lock wait before committing revocation; the pending read/save is refused and the head does not change. Runtime role is neither superuser nor BYPASSRLS, all five new tables force RLS, foreign-tenant SELECT returns no rows, and direct runtime DELETE is denied. Tests restore all temporary corruptions/revocations in the isolated fixture.

Frontend/parser checks: **7 pass / 31 assertions**, including actual fetch abort after headers/body, foreign-company/duplicate response refusal, actual transpiled register component ignoring late success/error after cleanup, and an unsaved owner's draft absent from a fresh read-only member lifetime. These are injected hook/network boundaries, not a real browser DOM/focus claim. Existing parent authorization harness supplies separate remount/epoch evidence. Coordinator owns actual browser demonstration.

The API parser's earlier request-size/response-size mismatch was communicated while the candidate was changing. The current register/export adapter uses the shared bounded response parser; exact final limits and bytes remain subject to final integrated verification.

### Third candidate: repaired provenance and retained export

Preserved `m71_security_r2` and restored the same verified-14 dump into new `m71_security_r3`, then applied 0015 `acb1a515c7b7c9867b075c6ebb1cfe26a7916e99f165dfc2e82490c66cfcc74a`. F03 is repaired: readback reconstructs each request fingerprint from the exact immutable save/review, matches counts/kind/record/company, and rejects remapping, missing request and changed fingerprint. Native retry corruption now returns 503. Stored export text is compared byte-for-byte with the verified canonical snapshot and derived findings; appended whitespace fails readback. The unsupported-period test recomputes content/version hashes and audit hash consistently, and verifies those hashes before observing semantic refusal.

Final third-candidate command: `M71_SECURITY_DATABASE_URL=postgres://m63_test_admin@127.0.0.1:55463/m71_security_r3 bun test evaluations/research-qa/m71-security-native.test.ts evaluations/research-qa/m71-security-frontend.test.ts evaluations/research-qa/m71-security-parser.test.ts apps/site-web/src/lib/staging-authorization.test.ts`. PowerShell execution set this single synthetic test variable locally. **29 tests / 207 assertions pass**: 15 native tests, 7 new frontend/parser tests, and 7 inherited actual-parent lifecycle tests. Nothing skipped in that run.

All **2,101 original row hashes across 62 original tables** remain present, including all 14 original migration receipts; zero mismatches after this candidate and its adversarial tests. New application/operator connections were used; no hosted execution occurred. Independent QA separately supplied [restore evidence](m71-qa-recovery-result.json): a fresh process on restored `m71_qa_restore` decoded seven versions, preserved original export hash, and matched the full 67-table/2,137-row/catalog/role manifest. That evidence belongs to the QA reviewer, not this agent's own execution.

Packaging static review confirms explicit copies and deny-by-default allowlist entries for M71 contracts, validator, runtime, route and migration15, exclusion of the local-preview entry point, CI native M71 test wiring and image manifest expectation15. This does not claim a local Docker build or remote CI pass. Coordinator retains publication, real browser demonstration and HTTP process restart gates.

After this run, backend/coordinator identified a theoretical aggregate response-size gap between up to40 snapshots and the4MB decoder limit. They elected to add a3.8MB retained-export aggregate budget with review reserve. This is a pending candidate change, so the third-candidate pass is not a final-byte verdict. First findings above remain preserved.

### Fourth candidate and final author-discovered consistency gaps

The aggregate-budget candidate `bf3642a34486ba32173ddffdc3834d977bd84f8befa3a27be06db887dbe18f4c` was applied to fresh `m71_security_r4`. Initial 30 tests /213 assertions passed. The added capacity challenge injects3.8MB storage pressure within one transaction, invokes the real SQL save function as runtime role, observes SQLSTATE54001 and complete rollback, then verifies unchanged readable head and both current/original exports. This is an explicit rollback-only guard challenge, **not** a naturally accumulated valid history at capacity. The route maps54001 to bounded422 `history_bytes_limit`; that mapping was statically inspected.

**F04 — extra partial-year group SQL screening; F05 — Unicode ordering mismatch.** Before freeze the backend author identified both gaps. Independent challenges reproduced each against the fourth candidate: an extra group row with partial-year interval was accepted by the SQL function although TypeScript refused it; TypeScript ordered an astral character before U+E000, contrary to PostgreSQL C ordering for missing facts/evidence purposes. The first new SQL probe expected rejection without unconditional rollback; unexpected acceptance therefore committed a malformed successor in its newly created synthetic company. Subsequent reader checks correctly returned503, causing dependent failures. The full reproduction run was9pass/8fail: two primary defects and consequent state failures, not eight distinct product defects. The fourth fixture is preserved. All malformed SQL probes now unconditionally roll back and check exact22023 rejection, preventing that test-state cascade. Final repaired candidate and exact-byte recheck remain pending here.

## Final scoped verdict — 2026-09-15 UTC

**PASS** for the independently exercised local synthetic authorization, immutable lineage/review, replay, parsing, database integrity and retained-export boundaries. F01–F05 are repaired on the exact reviewed bytes below. This is not a customer-readiness, emissions-method, legal-compliance or assurance verdict. Root publication/remote checks remain separate milestone gates; completed local browser/restart evidence is attributed in the publication-byte reconciliation below. Independent QA final-candidate restore passes as separately attributed below; earlier restore evidence above is explicitly historical.

Restored the original verified14 dump to new `m71_security_r5`, preserving earlier fixtures, and applied migration15 `2766561decde3ea64bf56f30b1b67a9144318e14b6efecaa71e05e8ae6351d19`. Final command uses the same four test paths above with `M71_SECURITY_DATABASE_URL=postgres://m63_test_admin@127.0.0.1:55463/m71_security_r5`: **32 pass, zero fail/skip, 233 assertions** (18 native,7 new frontend/parser,7 inherited parent-lifetime tests). Extra partial-year group SQL rejects22023; Unicode BMP/astral set ordering survives actual API/SQL/production decoder;300-emoji correction and independent-review notes persist and decode. The rollback-only capacity test proves atomic refusal under injected storage pressure, not naturally full history. Rechecked all 2,101 original row hashes across 62 original tables after final tests: zero mismatches.

No open security defect was observed in this bounded final test set. Native tests use the real restricted PostgreSQL role and staged HTTP handler, with only external authentication/provider/assets replaced by explicit synthetic fixtures. Component tests use actual transpiled source with injected hooks/network; they are not browser evidence. Tamper probes exercise operator-level synthetic corruption, not a claim of runtime privilege to alter immutable records. No hosted/provider call, source/factor release, real customer data, app implementation edit or Git publication was performed by this reviewer.

### Exact reviewed SHA-256

| File | SHA-256 |
| --- | --- |
| `packages/neuvetra-database/src/migrations/0015_corporate_coverage.sql` | `2766561decde3ea64bf56f30b1b67a9144318e14b6efecaa71e05e8ae6351d19` |
| `packages/neuvetra-database/src/m71.ts` | `e0a1aa8cd01809af115057e46e9911d47ff801c93902ec59aa5bb21852f42385` |
| `packages/neuvetra-database/src/m71-contract.ts` | `9ab26510a66e93ae00e35e87e79e1289b275961ab02b6021b023c16ecbfa265c` |
| `packages/neuvetra-database/src/m71-validation.ts` | `44add799b85939bc0825a0e1fe095e41104faea13796d5ee1b58227660b0b7ec` |
| `packages/neuvetra-database/src/workspace.ts` | `f8838d11f29cff4d4fa672a2bcef04ca925b0c01f69c5792ab16e346d3774c62` |
| `packages/neuvetra-database/src/hosted.ts` | `9b5b06f5c4e64eb07dc3b989e48cbc85e6939504845a696bae2ce698ba8f0ad1` |
| `packages/neuvetra-database/src/staging-migrations.ts` | `2a6b4d0c2c9aac3a0921aee653ac5aa14251dee40b3988627a93d5751c699aef` |
| `apps/site-api/src/workspace/m71-routes.ts` | `8cbd9fbf874030042b6f8abd69286bc2b7f5b65aa8e0c429b1b772a3e8a3e7bd` |
| `apps/site-api/src/staging/server.ts` | `1739cc97996be84595811563ed83c9dde836aaceddf924a6d0100bba6b005ca8` |
| `apps/site-web/src/lib/m71-api.ts` | `8ea72360915c1f00f9bb4e8c431cdbc618af39ea049eb485ed49c44e29520460` |
| `apps/site-web/src/components/CorporateCoverageRegister.tsx` | `52a0c474386aacf7be2b15e91204a2bd9e9b473cd3bce5da910ee508b10f2fd3` |
| `apps/site-web/src/components/StagingWorkspace.tsx` | `439a3752506ede32a32567c6c32958cfca3b91f63f18ab329c6772e8affbbae6` |
| `apps/site-web/src/components/PrivateStaging.tsx` | `f396519817fcac2fb94c003fb46ab06a4fa02130add170e4cac73dc8df4a9080` |
| `Dockerfile.staging` | `194ff030bbdcaba6158d9f5424290096eedbd14f8c2bdc817ac5c6670b999295` |
| `Dockerfile.staging.dockerignore` | `795398b18c00d3c76414708c9a887e0ab629ae969a696d5c6a92bed4abddbdfa` |
| `.github/workflows/verify.yml` | `56a5dcdcd6bb30e90b5178fef20505a91d21acc02eb2d70e1c435a50bddb6717` |
| `evaluations/research-qa/m71-security-native.test.ts` | `db306855240f80968490f3abb1d28470f5a4233eca76cf52bd83285238d30867` |
| `evaluations/research-qa/m71-security-frontend.test.ts` | `1893204871e89e478c73dbd27f80625e34e58b3a27b573216449fed84e423b4b` |
| `evaluations/research-qa/m71-security-parser.test.ts` | `9f1d636ec5e3a5fa82587039246f49a390fd3a80030d19643b1290e9e65c04f6` |

Final recovery cross-reference, supplied and executed by independent QA: `m71_qa_parity` restored to `m71_qa_parity_restore`, schema15, seven versions, production decoder and original export preserved, full 67-table/2,137-row/catalog/role manifest equal. The current [recovery result](m71-qa-recovery-result.json) was inspected; SHA-256 `77e82c552876421cfaf441262c5bb8d18d6a5a5c1ada0e8ce0ebd2a681d8c707`. The earlier observation hash `9e081cf45f0da8146184b785c18005279a62de8086f6077cd20aa54fe2bf11f4` is historical; the refreshed observation preserves the same table, export and register results. This closes the separately owned local restore evidence; root actual browser/HTTP process restart remains separate.

### Publication-byte reconciliation

After the first verdict, inspected the added authorized-read check that hashes the bundled `M71_ARTIFACT.text` against its fixed pin. A new targeted native test changes the in-memory fictional artifact text, observes actual authorized collection/export503, restores it in `finally`, and confirms normal readback. No SQL/schema bytes changed. The author native-test addition for40 versions/41st refusal and updated implementation contract were statically reviewed; their3,910-assertion result is author evidence, not a new independent execution claim.

Normalized the two owned native/frontend test files to LF and verified equality of their decoded text after CRLF normalization. Coordinator normalized component/adapter line endings separately. Re-ran all four targeted test files against `m71_security_r5`: **33 pass, zero fail/skip, 238 assertions** (19 native, 7 new frontend/parser, 7 inherited parent). The exact table above is refreshed to these final publication bytes, including latest `m71.ts` and LF frontend/tests. The preceding32-test result remains historical rather than erased.

Inspected coordinator browser/restart evidence: before/after records have the same final migration pin, two versions, accepted bounded review, register hash and original 25,651-byte download hash `39ad96d0bdf6d96cb64624bb3da28d3010661b7f80e1622dabd51d17a360f6b2`. Coordinator reports an actual HTTP process stop/start and real Chrome reload, keyboard and320/390-width checks in [browser verification](m71-browser-verification.md). This is explicitly author-executed browser evidence assessed alongside independent native/component tests; this reviewer did not repeat the Chrome journey. Together with the separately attributed QA restore, local restart/restore evidence is present. Remote publication/required checks remain root-owned.

Additional inspected artifact hashes:

| File | SHA-256 |
| --- | --- |
| `apps/site-api/src/workspace/m71-postgres.test.ts` | `02a6f0e9913b3e2504a24fbcbdf677895007fc20d027c9f1b07bc5cfd5c078ce` |
| `docs/research/m71-implementation-contract.md` | `0d1fa53e1df7ca1b7787857932fc45989d048ce1eb43023f8c06b82938aa335e` |
| `evaluations/research-qa/m71-browser-verification.md` | `add34d452a877cb4de51861d109b39bf0f19d34740a47744d7c52a23e664ab02` |
| `evaluations/research-qa/m71-browser-before-restart.json` | `259bcb8d66807acdaa7a572375d8b402bbbf1b0a3968894cb4c5a20571c1f0a2` |
| `evaluations/research-qa/m71-browser-after-restart.json` | `ae35fa21a5875374d9342d175601eab9df66fe54400bee6b5f955d68f60dadde` |
