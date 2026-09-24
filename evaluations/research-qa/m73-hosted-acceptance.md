# M73 independent hosted acceptance

Reviewer: `/root/m73_cpo`, reused as an independent security/reliability reviewer. Requested `gpt-6-astra` / `high`; actual model and effort are unknown. The reviewer authored M73 product criteria, but did not author the product implementation, migration or operator helpers. This review is read-only and does not access credentials or control the host, Git or browser.

## Verdict

**PASS for the bounded M73 hosted synthetic milestone.** The exact reviewed commit passed six required checks, migrated from the recovered schema15 baseline to schema16 under maintenance, deployed successfully, completed the hosted exercise, restarted, and completed an exact zero-application-POST revisit. The saved hosted browser evidence shows the workflow and readable report. No critical, high or medium hosted-acceptance finding is open.

This accepts one synthetic 2025 California stationary natural-gas source workflow. It does not establish a production or customer release, complete Scope 1, factor/method release, legal compliance, external assurance or provider-level disaster recovery.

## Committed transition evidence

| Artifact | SHA-256 | Independent observation |
| --- | --- | --- |
| `.superpowers/m70-checks.json` | `b08f6cee82cce5630f9a275df2c61ac8bfd2f63981a944b1b0ceec85b7005585` | All six required checks completed successfully for exact commit `3f92fdac0bf1e681db634410ad455b61faaed790`. |
| `.superpowers/m73-maintenance.json` | `a35e9ceaf27b3d885c48aa951d946ba813f3931be1ff7b890900b59f2dfa7914` | Old deployment `e52f0923-ae92-46fb-82b2-0afd24a64781` recorded `REMOVED`; readiness returned 404 before migration. |
| `.superpowers/m73-operator-gate.json` | `4f269783361401ff483f6f32e38aee8d47e481419ae9f9c9c8f679d6e03f4abe` | Binds maintenance/check receipts, exact commit, migration, fresh backup/restore receipts, forward recovery and provider-recovery exclusion. |
| `.superpowers/m73-migration-receipt.json` | `7cd9728da096adc303a2cc5c334da84b71e22119d82262e8159d3cbc0b43f686` | Committed at `2026-09-15T20:31:59.748Z`; exact schema15-to16 transition. |
| Fresh backup receipt | `408f025efae3d4cb1488c9c2548ba91294c374e65e25e655ec331d9c06d04dfb` | Exact schema15 source state accepted in the prior fresh-recovery review. |
| Fresh restore receipt | `8650a0c2bdb7a55b997426887f70c8d6ab088f05d8ae58a94dd12df4df46505d` | Exact isolated recovery accepted in the prior fresh-recovery review. |

The migration receipt's gate hash matches the gate file. Its commit is the six-check commit, its migration SHA-256 is the reviewed `aa4968c63087f353b5bf80d64bced67270bc5ad17f715393b40313bb57f7f732`, and its backup archive hash matches the fresh backup. The receipt's entire `before` inventory equals the backup inventory: 67 tables and 176 rows.

The `after` inventory contains 74 tables and 177 rows. The only added old-schema row is the schema16 migration receipt; all seven `stationary_gas_*` tables are initially empty. Every preexisting table row and hash is retained, all prior catalog-object row hashes remain a subset of the post-migration catalog, and roles, memberships, default ACLs and external dependencies are exact before and after. These observations independently support the receipt's `oldRowsPreserved` and `rolesAndMembershipsPreserved` flags.

Schema16 is now the confirmed database state. Recovery is forward-only: a failed deployment must use the reviewed schema16 application or a separately reviewed fix-forward. Returning to a schema15 application, deleting the new tables or rewriting the migration receipt is outside this acceptance.

## Deployment, exercise and restart

`operations/agent-improvement/snapshots/M73-HOSTED-EXECUTION.json` matched SHA-256 `c50674aa40ef354b02d2cd1849962040847b41c6f6b2d1513d091eae81ebfa7f`; all 11 listed evidence files matched their recorded hashes.

- Deployment `30c5a4af-138f-4127-b2f8-3ea8df1abc6b` reached `SUCCESS` on commit `3f92fdac0bf1e681db634410ad455b61faaed790`, image digest `sha256:e677c7a93c9ad703bc2f2734c054178e9bc199041701793d8816ef97e53566c6`. Readiness returned the private synthetic profile, schema16 and legacy containment verified. The readiness receipt is SHA-256 `fd069320eadb8848ea3bffd96fe90b8a111cd8ab0d30ec65eaa0d450c5566d49`.
- The final journal `.superpowers/m73-hosted-journey.jsonl` matched SHA-256 `575728bdb7dc50f5e9562e1363f1bf605a4cc4465122715c2508e377f54060c5`. Independent parsing with the reviewed reader validated all 35 sequence, predecessor, workspace and event hashes.
- Exercise completed at event 30, SHA-256 `e194a332a2770ceecb10eff179cf3cd73cb2b6e34050deed45be247810f6db43`. It recorded the exact M71 source addition, member/outsider/signed-out save refusals, source save, unreviewed report, contributor/member review refusals, separate-manager review, reviewed report and append-only correction. The terminal event passed with 11 application POSTs and all created Auth sessions closed.
- The exercise retained version1 at exact `66399.7643125` and display `66399.7643 kg CO2e`, then appended version2 at exact `79678.3893125` and display `79678.3893`. Version2 remains unreviewed with the statement discrepancy open. Both reports, both statements and both calculation records have distinct retained download entries; corporate and Scope 1 gaps remain visible and the factor/method remains unreleased.
- `.superpowers/m73-restart-receipt.json` matched SHA-256 `f51a6747e3316361c19c2f72f9d7aa41e396d9628b3a66b45361645db152381b`. The restart mutation returned true and the same deployment, commit and image returned schema16 readiness.
- The post-restart revisit ended at sequence 35, terminal SHA-256 `e4ec8162a96bb5d807d728f4b258d7f109c9d45ff64136976b2c1792c9671bea`. It made zero application POSTs, closed all created Auth sessions and emitted `revisit_verified` bound to the exact exercise-complete hash. The helper only emits that event after reproducing the corporate exports, M73 register and all downloads exactly. The final journal contains none of the reviewed credential-marker strings.

## Hosted browser and report evidence

`evaluations/research-qa/m73-hosted-browser-verification.md` matched SHA-256 `e7ec693f45293bc948afda2aa31d89383d5f94ff9dad16e58ba2246e9aa7115b`. The reviewer inspected the four saved images independently; the root coordinator controlled the browser.

| Artifact | SHA-256 | Observation |
| --- | --- | --- |
| `m73-hosted-correction.png` | `beac9904f962357a91749fa0ca9ae9a990ec32c6ee5ab6b94040416b82ebb339` | Deployed worksheet shows version2, exact/display subtotal, open discrepancy, correction reason, unreviewed status, candidate language and incomplete-scope limits. |
| `m73-hosted-reviewed-report.png` | `c46ca03380cb6a63d2ff1ef93c28e6f070da27c2a0068dc5e6c0558bde5e6275` | Readable reviewed version1 report with company, boundary, source, period, activity, exact/display subtotal, review and gas trace. |
| `m73-hosted-report-narrow.png` | `2b7358b7c91dcc21be7c8deb27907c347e425d57e83d6ae89840b0bee6848806` | At 390 pixels, the report heading and source context wrap inside the report frame. |
| `m73-hosted-report-gases-narrow.png` | `d5d6f7918a46db640f1691cd94ee14d8b831f8a3f5fe606df8f7c55d51194371` | Gas table, precision note and labeled synthetic statement remain readable in the narrow report frame. |

The narrow capture shows a browser-level horizontal bar for the underlying worksheet, so this hosted artifact does not independently re-prove full-page worksheet containment. It does show the report content fits its own frame without internal horizontal scrolling; the separately accepted local candidate3 visual review covers the full 390-pixel worksheet criterion.

The actual hosted **Download HTML** control produced 55,929 bytes at SHA-256 `5f5200296b16178d943af8ada51ca13ad024c4eb925679a1ca40ee4434028a37`, exactly matching the retained reviewed report; `.superpowers/m73-browser-download.json` matched SHA-256 `185bc345f79f93a517c4daf1879fd240867cbf7ffb45a59a91f22ca16a6d4ca3`. Keyboard history selection, report open and Escape close were also observed. Print entry-point acceptance remains grounded in the earlier actual invocation and direct board confirmation.

An additional browser reload after restart was blocked by an open Chrome extension surface and was not bypassed. No post-restart browser read is claimed. The zero-write hosted revisit independently establishes post-restart authorized reads and exact retained bytes, which satisfies the original persistence criterion.

## Limits

The milestone remains private and synthetic. It supports Natural Gas, MMBtu, HHV, calendar 2025, one dedicated-meter source and the pinned California operational-control boundary. Mobile, fugitive, refrigerant, process, other facility/source/period, Scope 2 and Scope 3 gaps remain outside this subtotal. Shared-meter reconciliation, supplier/distributor duplicates, stock, feedstock, loss and allocation adjustments are unsupported. Factors and methods remain development candidates with unresolved release rights. No physical print, saved PDF, pagination fidelity, production readiness, complete inventory, legal determination or assurance is claimed.
