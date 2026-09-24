# M71 independent implementation QA

Status: **PASS for the bounded local synthetic corporate coverage implementation**. Exact integrated bundle: `operations/agent-improvement/snapshots/M71-INTEGRATED.json`, SHA-256 `89dd31db7843be17379fe4ba90fa43f4442f086299faa2baf29e7117f994ed20`. All 27 source-file bytes and embedded UTF-8 contents were independently verified against that bundle. Publication, clean remote checks and any hosted rollout remain coordinator-owned gates.

Reviewer: `/root/m70_cpo`, M71-QA. This context authored the M70 product brief and fixture; it authors no M71 application implementation. Original product requirements are not independently authored here. Requested registry critical route applies to QA; actual inherited model/effort unknown after coordinator-reported fresh-agent limit.

Acceptance contract: [M71 criteria](../../docs/research/m71-acceptance.md). Final candidate hashes and completed-boundary evidence will be recorded when delivered. Native PostgreSQL/API and production frontend decoder checks have run below; integrated browser, coordinated service restart/restore, independent security disposition and final-candidate acceptance remain pending.

First-review findings and subsequent targeted rechecks will be preserved here; this initial pending state is not a failed implementation verdict or a release pass.

## Early review evidence (not a final candidate verdict)

- Independent `m71-qa-validation.test.ts`: 6 tests / 30 assertions passed on the in-progress validator. Covers California default, canonical set reordering, required NA/exclusion basis, explicit-zero basis, missing/invalid screening universe, unsupported geography retention, relationship cycle and fabricated evidence/client claims. This is validator-only evidence.
- Early inspection found missing rationale/evidence enforcement for exclusions/not-applicable decisions. Backend owner repaired it before the first executable independent test run; that run passed. No initial executable failure is claimed for this item.
- Reproduced hierarchy omission: `createM71Seed(); snapshot.relationships=[]` passed validation and yielded no control/relationship finding. Sent to backend owner for correction; targeted recheck pending.
- Expanded executable first challenge: 6 pass / 2 fail / 32 assertions. The two failed cases reproduce the hierarchy omission above and security-reviewer's location type finding (`countryCode: ["US"]` accepted through regular-expression coercion). Both are preserved as first failures; repairs and rechecks pending.
- Local setup: coordinator-authorized `m71_qa` was created and restored from a read-only dump of `m63_integration`; existing databases were not modified. The dump contained schema **11**, despite initial handoff describing schema 14. `m71-qa-baseline.ts` correctly refused to freeze it as schema 14. Coordinator is resolving the baseline. This is an environment evidence correction, not a product defect. No baseline file was written.
- Baseline correction: coordinator identified `m68_qa` as the actual schema-14 source. A read-only dump was restored into new isolated `m71_qa_v14`; the schema-11 attempt remains untouched. All 14 receipt names/hashes match the checked-in migration manifest. `m71-qa-schema14-baseline.json` freezes 62 tables / 2,101 row hashes without raw inherited records. This establishes pre-migration evidence only.

## Targeted repairs and current executable evidence

- Backend repaired expected relationship retention and strict location scalar types. Independent validator recheck: **8 pass / 43 assertions**; original two failures above remain part of the record.
- First native attempt encountered a QA-test harness variable shadowing JavaScript's `URL` constructor during import, before database setup or application tests. Reviewer renamed the test variable; this is a test-harness defect, not a product failure.
- `m71-qa-native.test.ts`: **6 pass / 133 assertions** against actual local PostgreSQL driver and staged API, restricted runtime role, migrated isolated `m71_qa_v14`. Verifies California-2025 creation/readback, malformed coverage/basis/period/location requests, label-only, screening-rationale-only, evidence-only and correction-explanation-only successors, canonical no-op refusal, explicit zero, estimate basis, unsupported non-California location/conflicting evidence findings, old-version exports and every frozen predecessor row hash. Actual successful responses also pass the production frontend decoders. The native fixture contains seven saved versions. No hosted deployment or real browser is implied by these tests.
- `m71-qa-frontend.test.ts`: **3 pass / 19 assertions** using that native fixture. Verifies production decoder success and malformed universe/findings/lineage/completeness refusals; exact selected-version export and rejection of another valid version or altered whitespace. Export transport substitution in this file is explicitly mocked fault injection, supplementing actual native exported bytes.

Current independent test total: **17 tests / 195 assertions passed** across the validator, native and frontend suites. This count does not close unexercised acceptance boundaries.

## Criterion evidence so far

| Criteria | Current evidence | Remaining |
| --- | --- | --- |
| A01–A04 | Actual native/API domain and state cases; production decoder; all scoped validator cases | Integrated browser and final candidate |
| A05 | Native runtime used; independent security specialist assigned | Security verdict including direct SQL, revocation and actor-switch lifecycle |
| A06 | Native single-field successor variants, canonical no-op, immutable history and decoder | Security specialist's concurrency/idempotency evidence; final candidate |
| A07 | Contributor accumulation observed; native old exports preserved | Independent review eligibility/current-version and browser controls |
| A08–A09 | Unknown/conflicting requirements cannot become applicable; pinned reference/locator and wrong-period refusals; explicit conflict finding | Security specialist's synthetic integrity/tamper evidence; final candidate |
| A10 | Exact schema-14 receipt baseline; migration 15 applied; all 2,101 inherited row hashes preserved | Coordinated service restart and local restore/readback; final migration hash |
| A11 | Production decoder and actual API/export bytes | Actual interactive browser demonstration, keyboard/narrow-layout review |

## UI findings sent to author

Early component inspection found generic repeated finding messages without entity/category context, and explicit-zero quantity/unit values persisting invisibly after activity state changed to missing. Root owns the UI corrections and evidence; targeted review remains pending. No implementation fixes were authored by this QA role.

## Subsequent candidate and recovery evidence

The backend added frozen export text, complete idempotency-request provenance and aggregate history limits after the first native candidate. Independent native tests were rerun on fresh isolated clones for each delivered migration; no migration receipt was overwritten. Earlier data remained in its isolated database.

- Candidate `acb1a515c7b7c9867b075c6ebb1cfe26a7916e99f165dfc2e82490c66cfcc74a`: native/API/decoder and UI checks passed. Local dump/restore of `m71_qa_final` to `m71_qa_restore` reproduced all 67 tables / 2,137 rows, catalog and role hashes, seven saved versions and exact original export. The first recovery comparison incorrectly included observation metadata (database name, read timestamp and transaction ID); the QA harness was corrected to compare data/catalog/role evidence while retaining both observations. This was a harness comparison error, not data loss. Prior evidence retained as `m71-qa-pre-budget-*`.
- Candidate `bf3642a34486ba32173ddffdc3834d977bd84f8befa3a27be06db887dbe18f4c`: fresh `m71_qa_release` passed 20 tests / 209 assertions. Decoder/UI tests ran after native-fixture regeneration. Restore to `m71_qa_release_restore` passed the same full data/catalog/role, exact-export and seven-version checks. Author/security subsequently identified SQL/TypeScript parity gaps; these passes therefore do **not** constitute final-candidate acceptance.
- Root repaired finding labels, including facility context for identically named electricity sources, and clearing invisible numeric fields when activity state changes. Actual component handlers were independently tested with injected hooks/transport: 3 pass / 14 assertions. This is supplemental component evidence, not a React DOM/browser claim. Early harness failures concerned text spacing/wording and were repaired without changing application code.
- Root tightened frontend review-decision scalar typing and safe capacity errors. Independent frontend suite now 5 pass / 29 assertions: a valid review control is accepted, a decision array with a newly recomputed valid hash is refused, only allowlisted capacity codes produce a specific message, arbitrary server text is not displayed, and abort during error-body reading remains an AbortError. Fault-injected transport is labeled mocked.

**Final-candidate native/restore and integrated browser disposition remain pending the backend's stable parity repair and the independent security verdict.** Previous passed artifacts are not silently promoted to cover changed SQL.

## Final scoped verdict and criterion disposition

**PASS**, 2026-09-15 UTC, for [M71-A01–A11](../../docs/research/m71-acceptance.md) within the explicitly synthetic, calendar-2025 coverage-register profile. No open product QA defect remains in the exercised scope. This context authored M70 requirements and M71 acceptance criteria but no M71 application implementation. The independent security context also authored no M71 implementation. Browser actions were performed by root and independently assessed here from the artifacts below; this reviewer does not claim personally executing those browser actions.

### Exact candidate and checks

- Final SQL migration: `2766561decde3ea64bf56f30b1b67a9144318e14b6efecaa71e05e8ae6351d19`. Fresh isolated `m71_qa_parity` ran native/API and validator tests, followed by production decoder/component tests using its newly generated fixture. Final independent suites total **24 tests / 230 assertions passed**: 8 validator / 43 assertions; 6 native / 133; 6 frontend / 37; 3 component / 14; 1 native restored-source-pin / 3. No skipped cases in these scoped runs.
- The final readback-only bundled-evidence pin guard was checked through the real native restored database: valid read and production decode succeed, in-process alteration of the synthetic artifact text refuses readback, restoring the original text restores valid read. Database records were not changed. This covers final `m71.ts` SHA-256 `e0a1aa8cd01809af115057e46e9911d47ff801c93902ec59aa5bb21852f42385`.
- Root normalized its component/adapter from CRLF to LF without changing text. Targeted independent frontend/component checks passed afterward. Final adapter hash `8ea72360915c1f00f9bb4e8c431cdbc618af39ea049eb485ed49c44e29520460`; component hash `52a0c474386aacf7be2b15e91204a2bd9e9b473cd3bce5da910ee508b10f2fd3`.
- The independent [security review](m71-security-review.md) supplies the separately executed final authorization, revocation, direct-SQL, concurrency, idempotency, contributor-review, corruption and parity evidence. Its preserved F01–F05 are repaired. Its aggregate-capacity pressure test is explicitly a rollback-only injected-pressure challenge; author tests additionally demonstrate naturally accumulated 40-version history. These are distinct evidence types.
- [Recovery result](m71-qa-recovery-result.json): `m71_qa_parity` restored into separate `m71_qa_parity_restore`; all 67 tables / 2,137 rows plus catalog/role hashes match. Seven versions, production decode and exact original export survive fresh-process native readback. All original 2,101 rows across 62 schema-14 tables remained unchanged through migration/native tests. Repeated final readback after the source-pin guard also passed. Earlier database clones and first-failure records remain preserved.

### Browser and service restart evidence assessed

Read [root's action report](m71-browser-verification.md), before/after JSON and final DOM; visually inspected `m71-browser-390.png` and `m71-browser-history.png`. The final 2766561 candidate browser saved version 1, created a label-only version 2, recorded a distinct eligible review, downloaded original version 1 and reloaded after stopping/starting the local HTTP process. Both records have register hash `eb33968ac71aa0e0a98ee74bd4ddc2400a19d612098d6ce99116f719e078eadb`; the exact original 25,651-byte download remains SHA-256 `39ad96d0bdf6d96cb64624bb3da28d3010661b7f80e1622dabd51d17a360f6b2`. PostgreSQL itself stayed running during that HTTP restart; the independent full-database restore is the separate recovery check above.

Member has no correction action, outsider is unavailable and owner returns to saved state. Enter-key navigation to scopes/history shows a visible focus indicator and 15 Scope 3 buttons. Root's 390/320 width measurements report no horizontal overflow; inspected screenshots show readable scope labels and controls. The real UI clearly labels fictional accounts/local database, incomplete inventory and no assurance, and explains that later reviews are separate from the frozen export. Earlier detached-element/locator/timing corrections remain disclosed in the browser report. Final-candidate native tests independently cover the invalid not-applicable path previously exercised in the earlier-candidate browser.

| Criteria | Final disposition and evidence |
| --- | --- |
| A01–A04 | Pass: native/API and decoder universe, hierarchy, periods, categories, separate states, refusal cases, explicit zero/estimates and visible unsupported findings; inspected real browser. |
| A05 | Pass locally: separately attributed independent security native/runtime/revocation/lifecycle tests plus actual browser member/outsider transitions. External hosted authentication is not established. |
| A06 | Pass: native single-field correction variants, normalized no-op, immutable history; security exact replay and stale-head concurrency evidence. |
| A07 | Pass: independent security contributor/current-version review challenges and exact frozen exports; inspected actual browser distinct reviewer. |
| A08–A09 | Pass within synthetic placeholders: no legal applicability promotion, pinned evidence and locator/period refusals, explicit conflicts, coordinated corruption/request/audit/export refusal and final bundled-source pin check. General evidence intake remains deferred. |
| A10 | Pass locally: exact schema-14 receipt/row preservation, restricted runtime, final full restore/readback and attributed actual HTTP restart. |
| A11 | Pass for the demonstrated journey: native-backed real component, save/correction/review/history/download, keyboard navigation and narrow display; author actions independently inspected. |

### Limits and next owner

This pass does not establish the full corporate MVP, released emissions methods, real customer-data readiness, regulatory compliance, professional assurance, hosted deployment or universal accessibility. Scope stays synthetic calendar 2025 with one pinned fictional reference, unresolved requirements, no emissions totals and the reviewed 40-version/50,000-byte snapshot/3.8-MB retained-export bounds. Other reporting years are refused; complex operation periods/locations remain unsupported findings within the retained boundary.

Relevant local checks and the staging web build were supplied by root; no local Docker pass is claimed. Root records the whole-repository check's pre-existing missing FrontDesk dependency blocker. Clean remote checks and exact staged/committed byte verification remain necessary before publication is called accepted; a local scoped QA pass is not a remote release receipt. Root owns publication to the rolling PR, truthful operating status, demonstration handoff and board feedback before dependent expansion. [Operating notes](../../docs/research/m71-operating-notes.md) correctly separate local evidence from a later existing-host rollout.

Exact supplementary evidence/test hashes are in [reviewed artifacts](m71-qa-reviewed-artifacts.json); the integrated bundle above is the release-review source binding. This report and mutable operating status are not included in their own source hash bundle.
