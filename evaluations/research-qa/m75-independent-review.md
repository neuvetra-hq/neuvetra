# M75 independent implementation review

Status: **pass for the frozen local M75 implementation candidate described below**. Hosted deployment/acceptance, operator safety authorization, customer release, source/method approval and professional assurance are separate gates. This is not a complete fleet or Scope1 claim.

Reviewer `/root/m74_accounting`, assignment `M75-INDEPENDENT-QA`. Requested lead-QA route gpt-6-astra/high; fresh dispatch rejected by runtime limit, reused-context actual settings unknown. QA role prompt SHA256 `0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94`. Reviewer authored the M75 accounting acceptance criteria and historical M74 accounting contract/fixtures, but no M75 production implementation, author tests, root UI or CTO operators. Implementation independence is claimed only for those separately authored delivered artifacts, not this reviewer's requirements or tests.

## Prepared independent evidence

`m75-independent-scenarios.ts` defines independently chosen synthetic fixture mutations for classification, retained-population omissions, asset/source/alias collisions, accepted-but-discrepant workpapers, missing evidence, changed review dependencies and stale bindings. It was prepared while only the shared M75 contract had been delivered. Structural fixture hashes are placeholders used only for pure reconciliation tests, not persisted integrity evidence; actual database/API tests must create authoritative saved records.

## First runs, findings and repairs

The initial adapter invocation coincided with an in-flight change from an M74 register argument to an array of current M74 versions. All 48 cases initially failed on `workpapers.map is not a function`; this was harness wiring against an unfrozen changing interface, not a claimed production defect. The adapter was updated to the delivered signature. Actual effective-head selection remains a required native persistence check; pure tests only classify the heads they are given.

First substantive early run: 46 passed, 2 failed, 646 assertions (`m75-independent-classification-early1.log`). Expanded early run: 47 passed, 5 failed (`m75-independent-classification-early2.log`). These are exploratory runs while the author was building the module; they were not exact frozen integrated acceptance runs.

| Finding | Observed defect | Repair and targeted disposition |
| --- | --- | --- |
| QA-F01 | A current workpaper with the same coverage ID but a different bound coverage SHA could produce reconciled status. This was demonstrated at the pure composed boundary; native M74 readback also has its own integrity defenses. | Author added exact ID/hash comparison; pure check now blocks. Native composed check remains pending. |
| QA-F02 | Asset dates such as `2025-02-30` passed regex-only admission. | Author added exact calendar-date round-trip validation. Invalid-date and numeric/coerced-identifier cases pass. |
| QA-F03 | Source-specific excluded/not-applicable/estimate assertions did not block a positive reconciliation. | Author added source-screening checks; missing/unassessed variants also independently tested. The positive fixture now explicitly sets source disposition `included_activity`, consistent with the no-exclusion requirement. It does not invent activity measurements. Root was told the real journey must save this M71 correction and relink/review resulting stale M74 workpapers. |
| QA-F04 | An old coverage ID produced `workpaper_incomplete` rather than the specified distinct `stale` row status. | Author aligned stale finding/status handling; both ID and hash variants now classify stale. |
| QA-F05 | Literal `{{rows}}`, `{{snapshot}}`, `$&`, dollar-backtick and dollar-apostrophe in issuer/reference caused sequential report substitutions to corrupt evidence text and template placement. | Independent renderer first run 1 passed/1 failed (`m75-independent-renderer-early1.log`). Author replaced sequential string substitutions with one-pass callback substitution. Literal-marker fidelity and markup escaping now pass; no XSS was demonstrated. |
| QA-F06 | Historical report decoder accepted an unsupported-model blocked snapshot changed to reconciled status with findings removed and all snapshot/content/report/HTML hashes and metadata recomputed. Original blocked snapshot passed as control. | Original failure retained in `m75-independent-decoder-early1.log`. Repaired exact historical-proof endpoint plus browser semantic reconstruction passes the final independent decoder suite. |

Early inspection also warned that treating all M74 findings as material would block every valid workpaper because permanent `scope1_incomplete`/`method_not_released` findings always exist. Author corrected this before the first substantive pure run. This is recorded as implementation feedback, not an additional independently frozen failure.

## Frozen pure candidate 1

**Scoped result: pass for pure classification and renderer only.** `bun test evaluations/research-qa/m75-independent-classification.test.ts evaluations/research-qa/m75-independent-renderer.test.ts` passed **56 tests / 764 assertions**, no skips. Test output: `m75-independent-pure-candidate1.log`. `m75-independent-pure-candidate1-pins.json` records matching pre/post hashes; no tested artifact changed during this run.

| Production artifact | SHA-256 |
| --- | --- |
| `packages/neuvetra-database/src/m75-contract.ts` | `e14264d94c140a5385d1663952f3d50f36d20573b734a6b122493ee9f3650213` |
| `packages/neuvetra-database/src/m75-validation.ts` | `ebc8873b718ec0ea4f5cc18b70e8f2604aaf7237fccd9c07c1b736f16dd66fc1` |
| `packages/neuvetra-database/src/m75-report.ts` | `312b2093341e019f1c43d2bb6a3a4d03b3a6427fc78dddbfdc72a426e147d49e` |

The independent tests cover declared-population omissions, entity omissions, empty/absent/unconfirmed/partial roster, two axes of aliases, duplicate source mappings, same-label distinct assets, unsupported/unknown classification, missing/unconfirmed workpapers, accepted discrepancies, both stale binding components, changed reviews, unresolved source screenings, three-stream capacity with a fourth retained vehicle, literal report text and escaping. Every scenario checks permanent synthetic/incomplete/unreleased/no-total flags. A positive structural fixture is not proof that the database will safely create or replay it.

QA-F06 exercised the real exported browser download helper against a mocked HTTP response and coordinated metadata; it is not a demonstrated unauthorized database write or production exploit. The observed decoder hash was `cc78ce5578188f380a06111da477522dd332557915664954be230cf9de036981`. Current-register decoding already reconstructs from proof; the missing protection was historical report semantics. The same in-progress backend report reader initially checked self-consistent rendering/hashes without rederiving historical status, which was also sent to the author. Final native rejection and repaired browser proof checks remain required.

## Original required checks (current dispositions below)

- Bind one exact delivered candidate manifest and run the independent pure classification/reconciliation adapter.
- Exercise native PostgreSQL/API persistence, current dependency pins, reviewers, tenant isolation, direct-write refusal, concurrent changes and coordinated evidence tampering in a new isolated approved fixture.
- Challenge actual root browser decoders and actor/company/late-response state. Browser/download/print and hosted acceptance remain separate gates.
- Inspect report historical dependency reconstruction and exact retained bytes after correction/restart and independently verify actual backup restoration with unchanged legacy rows/catalog/roles.
- Confirm no arithmetic/factor changes, totals, zero assumptions, profile expansion, release/completeness claims or catalog renewal.

No prepared test fixture, author test count or earlier M74 acceptance is a pass for these pending gates. Root owns current milestone status and publication. Findings and original failures will be preserved here and bound to candidate versions before any scoped pass.

## Continued independent checks, 2026-09-16 UTC

QA-F06 was repaired with an exact historical-proof endpoint and real M71/M74 decoding. A further **QA-F07** exposed the stale-boundary case: deleting the old roster's unsupported-model finding, then recomputing all enclosing hashes, passed when only newer current coverage was supplied. The overall result stayed blocked, but the material unsupported finding disappeared. Original failure is retained in `m75-independent-decoder-stale-early1.log` (9 pass / 1 fail / 41 assertions). Root/backend added exact `boundCoverageVersion`; targeted repaired suite passed **12 tests / 47 assertions**, including unchanged control, null/wrong bound proof, stale findings forgery, report POST/HTML proof verification, abort and authorization invalidation. Log `m75-independent-decoder-repair3.log`. This remains an exploratory module result pending final candidate pins.

Actual React `ControlledFleet` ran in a local reviewer-owned browser harness with synthetic intercepted HTTP, using the delivered component, editor and decoders. Node 24/installed Chrome/Playwright passed **six composed scenarios**, no page errors: delayed initial company switch, delayed initial actor switch, delayed save after company switch, delayed report after company switch, closing an existing report on actor switch with member write controls hidden, and unmount cleanup. Evidence `m75-independent-ui-result.json`. Vite's dependency scan failed on sandbox path traversal; the harness instead bundled the actual source in memory with Bun and served only localhost. Bun's Playwright launch stalled; the equivalent Node runner succeeded. No hosted Auth, real browser print appearance or PDF output is claimed.

Native exploratory lifecycle passed **1 test / 28 assertions** with a reused max-one runtime connection and explicit awaited exception handling. It exercised positive persisted read plus real browser decoder, unknown-user denials, direct DML denial, no-op refusal, one-record exact retry, conflicting retry rejection, contributor review denial, separate acceptance, M74 successor staleness, unchanged historical report bytes and exact historical proof. Fresh per-operation connections also passed the lifecycle (26 assertions). The original harness using `expect(promise).rejects` stalled at a ninth BEGIN after eight callbacks had completed, with no database lock; this occurred with both one and four pool slots. Replacing that matcher with explicit awaited try/catch made the reused-pool sequence complete. Root independently passed standalone pooled rollback/read/refusal probes. This is retained as a test-runner scheduling limitation, **not a demonstrated application/driver failure**. Final candidate/max-four/concurrency checks remain outstanding.

Independent read-only recovery collector `m75-independent-recovery.ts` uses all application tables, full PostgreSQL JSONB row text, multiset-preserving hashes, schema/function/trigger/constraint/index definitions, RLS policies, ACLs and role observations. It does not import operator inventory/replay/recovery helpers. Baseline17 restored comparison matched **83 tables / 2,220 rows**; provisional populated18 comparison matched **90 tables / 2,263 rows**. Sources remained unchanged. Evidence `m75-independent-recovery17.json` and `m75-independent-recovery18-provisional.json`. These compare supplied restored fixtures; they do not independently execute DPAPI restore or prove cross-cluster role recreation. Final SQL18 bytes require refreshed recovery evidence.

Root's small legacy M74 test-only manifest-length repair was independently inspected and run: **7 tests / 85 assertions**. The unchanged `m74-common.ts` still refuses manifest18 before any query; the added test asserts both16/17 refusal and zero queries, retaining exact migration17 hash checking. Reviewed test SHA256 `3a3fd7126a4ec463da8aa1a3c1af94d3748ef47879bb9a41b930008d2a0f4cf8`; legacy helper `66fd28391abdeb57feb7f078e27b89be299c4bc69a784cc9395b7f69958c3879`.

### Direct SQL candidate failure: QA-F08 / QA-F09

`m75-independent-direct-sql.ts` created a fresh isolated schema17 clone, applied exact SQL18 `dd1fbe03a5ec0cd2c6aea88faa2071b513687c08e7cb9a42a6a73c096709da39`, and used the author fixture only for setup. Every independently crafted SQL call ran as `neuvetra_runtime` with the authorized synthetic subject, followed by forced rollback. Valid save/report controls succeeded. The SQL bytes were unchanged during the run, and retained version count stayed one. Evidence `m75-independent-direct-sql-early1.json`, database `m75_qa_sql_1789538501896`.

| Finding | Invalid accepted input | Consequence / current disposition |
| --- | --- | --- |
| QA-F08 | Save accepted `manualConfirmation:null`, and an unsupported2024 model with a different invented blocking finding after all activity/content/version/statement hashes were recomputed. | Database admission is weaker than the public contract and exact findings derivation. A caller using the granted runtime function could commit a version that subsequent readback rejects. Author notified; repair/recheck pending. |
| QA-F09 | Report function accepted arbitrary replacement HTML, changed reconciliation rows/count99, and `reconciliation.status:null`, all with coordinated valid hashes and otherwise retained snapshot/version identity. | Could commit an invalid immutable report even though browser/API readback would later refuse it. Author notified; repair/recheck pending. |

The same SQL candidate correctly refused completely hidden unsupported findings, null synthetic flag, deletion of retained row, hidden duplicate alias, and26 rows. Five invalid admissions failed the independent expectations; seven controls/refusals passed. This was a native direct-function failure, not merely mocked HTTP. No invalid test row was committed. The later repair and final disposition follow.

## Frozen local candidate 2: accepted

Canonical migration18 SHA256: **`76c8a17a46d96b40ed98213ceb3cf79caf564c5a639583197bd0adaf1c8a98f3`**. `m75-independent-candidate2-pins.json` records exact raw SHA256 pins for14 production/setup files before and after the final checks; **no pinned file changed**. It also pins14 reviewer harness/fixture files. Root authored portions of the final SQL findings/reconciliation implementation and renderer; this reviewer authored none of that production code. Root's author parity tests were not substituted for independent evidence.

| Independent check | Result | Evidence |
| --- | --- | --- |
| Pure classification, report rendering and actual browser decoders | **68 passed / 811 assertions**, no skips | `m75-independent-pure-candidate2.log` |
| Native runtime direct SQL, all mutations rolled back | **35/35 cases passed**, including three positive controls | `m75-independent-direct-sql-result.json` |
| Native SQL roster findings/full reconciliation/renderer vs reviewer-chosen fixtures and expected classifications | **53 scenarios passed**, no mismatch | `m75-independent-sql-parity-result.json` |
| Actual public route handler and native PostgreSQL lifecycle with reused four-connection runtime pool | **1 test / 66 assertions passed**, no skips,35.80s | `m75-independent-native-candidate2.log`, `m75-independent-native-result.json` |
| Actual React component, local intercepted synthetic responses, Node24/installed Chrome | **6 composed scenarios passed**, zero page errors | `m75-independent-ui-result.json` |
| Independent final populated18 recovery comparison | **90 tables / 2,263 rows exact**, catalog/ACL definitions exact, source unchanged | `m75-independent-recovery18-final.json` |

The native lifecycle covers positive persisted register and actual client decode; missing authentication, invalid token, origin, other tenant, member write and malformed JSON/method refusals; restricted download headers and exact historical proof; direct DML refusal; no-op and conflicting retry refusal; separate/contributor review boundaries; concurrent different corrections producing exactly one successor; concurrent identical retries yielding one record; M74 successor staleness; a later coverage review preserving captured null decisions and exact historical bytes; actual40-version and40-report capacity, rejecting both41st records without losing the earliest report. The route's Auth validator is a synthetic injected test identity source; real hosted JWT/session acceptance remains separate.

The final SQL probes reject wrong findings, hidden unsupported/duplicate profiles, removed retained rows,26 assets, malformed nested keys/types/IDs/enums/text, string booleans, null outer identities/version, empty review acknowledgments, null review note/decision, wrong dependencies, contributor review, arbitrary report HTML, recomputed false row/count/status/asset/entity content, string flags and null rows. Each positive save/review/report control succeeds inside the same rollback-only harness. QA-F08/F09 are **repaired and independently rechecked** on this exact candidate. Extended earlier results are retained as `m75-independent-direct-sql-early2.json` (canonical `f60984e146816b7c66301ddcf9f17f08a3b67f9c4bdc3a0c50816fbc00bc1f74`,14pass/10fail) and `m75-independent-direct-sql-early3.json` (canonical `1f959943a885da0a1dc151ac0805c47bed5845e57bc4f6877db76706bc33b181`,33pass/2fail). No historical failing evidence was relabeled a pass.

The SQL parity suite uses49 independent classification cases plus literal template/markup cases and absent-coverage/absent-roster states. It checks exact output equality and independent expected blocked/reconciled classifications, including null emissions totals. The renderer checks include literal `{{rows}}`, `{{summary}}`, `{{snapshot}}`, replacement metacharacters, script-like markup, Unicode and newlines. These complement native persistence; structural fixtures alone are not claimed valid saved records.

The final recovered databases were author-produced `m75_ops_author_1789539665453` and `m75_ops_forward18_1789539665453` on local55463. This reviewer rebuilt the full row/catalog comparison independently; CTO performed archive/DPAPI restore execution and root separately reviews operator safety. Author execution evidence `.tmp/m75-ops-1789539665453/author-result.json` SHA256 `a3ab8483e8e77530d24d602538f1b2428fb0c3a720b1e68b74ba2bb61414c3b7`; author operator freeze manifest SHA256 `0ebcf4dd187bbfbd0d2efa4b79fb98e68f84febd17e6b4dc4cde781d155fc26a`. Same-cluster global role observations do not establish independent cross-cluster role restoration.

All13 operator/helper files in that freeze manifest were independently rehashed after the final recovery comparison; none differed. This includes `check-m75-hosted.ts` and its author tests. Helper source inspection confirmed fixed host/Auth route allowlisting, explicit exercise-only POST admission, intent journaling before each write and exact browser decoder use for downloaded report/proof verification. The helper's full local exercise evidence remains CTO-authored; this review does not relabel it an independently executed hosted journey or replace root's separate operator safety review.

Final native setup once safely refused `CREATE DATABASE` while an operator rehearsal held the shared schema17 template open (`m75-independent-native-template-busy.log`). The final run used the previously retained independent schema17 restore as its read-only template, then applied the exact missing18 migration and generated fresh actors/company. No other agent's database was terminated or mutated. CI uses `M75_QA_TEMPLATE=m63_integration`; see `m75-independent-running.md` for exact commands and prerequisites.

### Residual scope

- No deployed-host acceptance, real Auth-provider/session certification, browser print appearance/PDF output or remote-head/CI publication evidence is supplied by this local review.
- The independent recovery comparator verifies supplied restored state; it does not claim to have executed the operator's DPAPI process. Root retains the separate operator safety decision.
- The bounded synthetic profile and inherited unreleased M74 method remain unchanged. No emissions aggregation, zero assumption, complete real fleet/Scope1/Scope2/Scope3 statement, source renewal, applicable-law determination, customer release or accredited assurance is approved by these tests.
- Acceptance binds the exact candidate pins. Any production correction invalidates the affected scope until rechecked; hosted evidence and final Git publication remain root-owned.
