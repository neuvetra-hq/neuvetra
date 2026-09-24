# M75 product brief: controlled-vehicle register reconciliation

Prepared 2026-09-15 for `M75-PRODUCT`. Product owner: `/root/m75_product`; sponsor and shared-record owner: root coordinator. Requested CPO route: `gpt-5.6-sol` / `medium`; observed model and effort are unknown. This brief defines a bounded synthetic product increment. It does not release a source or method, establish actual fleet completeness, calculate a fleet total, determine SB 253 applicability, or provide assurance.

## Intended user and outcome

An inventory manager for the initial synthetic California corporate-services and distribution profile needs to answer a narrower question than “is Scope 1 complete?”:

> For calendar 2025, does the declared controlled on-road vehicle roster reconcile one-for-one to the current corporate boundary/source register and, where the M74 candidate supports the vehicle, to an exact current reviewed vehicle workpaper?

M75 gives the manager and a separate internal reviewer a complete, inspectable reconciliation of the **declared synthetic roster**. It shows every retained roster row and every registered or calculated mobile source, including unknown, unsupported, duplicate, orphan, stale and capacity-blocked records. It never infers completeness from the number of M74 workpapers.

The permitted successful claim is: `The declared synthetic 2025 controlled-vehicle roster was reconciled to the exact current M71 and M74 records for this bounded demonstration; candidate methods remain unreleased and corporate Scope 1 remains incomplete.`

## Supported scope and admission boundary

- Company and period: the existing synthetic Juniper operational-control boundary and `2025-01-01` through `2026-01-01`.
- Population: every vehicle declared by the retained synthetic roster evidence as owned or under operational control for the full year. All relevant operation and travel stays in the record even when fuel is consumed or miles are driven outside California. M75 does not create a separate interstate or regional reporting product.
- Unit of reconciliation: one physical vehicle for the company and reporting year, identified by a stable normalized asset ID. M75 has no grouping or pooled-fleet rule. It detects repeated normalized asset IDs, repeated exact source/workpaper mappings and alias conflicts explicitly declared in the roster evidence; it cannot independently discover an undisclosed vehicle or prove that two false unrelated IDs represent one physical asset.
- Eligible calculation profile: only the already implemented M74 candidate—on-road, fossil-diesel, full-year operational control, documented `Medium- and Heavy-Duty Vehicles` class and an M74-supported model year—with separate annual consumed gallons and vehicle miles. A newer or otherwise unmatched model year is a **current product-method limitation**, not an assertion that EPA prohibits it.
- Existing records: M75 reuses the M71 company/entity/facility/mobile-source identities and exact boundary version, and links eligible rows to exact M74 worksheet head versions, calculations and internal decisions. It does not copy or recalculate M74 emissions.
- Capacity: M74 remains limited to three workpaper streams per company. The roster must retain every disclosed row up to the separately bounded roster limit. A fourth applicable M74-profile vehicle is visible as `capacity_blocked` and prevents reconciliation; the product must not omit it or silently raise the M74 claim. A roster request over its advertised bound is rejected atomically rather than truncated.
- Evidence: the roster is separate retained evidence, with exact bytes/hash/locator, issuer/description, period and an explicit synthetic attestation that it lists the whole declared controlled on-road vehicle population for the company and year. That attestation is an input subject to review, not proof that all real vehicles were discovered; the product cannot find vehicles absent from all supplied evidence.

Initial M75 does not admit partial-year control, acquisitions/disposals, leased or third-party classification uncertainty, pooled fuel or mileage, biofuel or renewable-diesel blends, gasoline, electric vehicles, motorcycles, aircraft, marine, rail or off-road equipment as supported. A disclosed asset or mode stays visible as unknown or unsupported and blocks the bounded reconciliation. There is no exclusion shortcut in this increment.

## Reconciliation model and user-visible states

The server derives reconciliation from the union of:

1. every row in the exact roster version;
2. every current M71 `mobile_combustion` source for the same exact company boundary head; and
3. every M74 worksheet and its current head, including records absent from the roster.

Each row shows the roster identity and evidence, entity/facility/source relationship, vehicle facts, expected and actual M71/M74 links, exact linked version/review state, and actionable findings. At minimum, users can distinguish:

| State | Meaning | Effect |
| --- | --- | --- |
| `matched_reviewed` | One roster vehicle matches one eligible current M71 source and one current M74 head with both activity dimensions, a calculation and an exact `accepted_bounded_internal` decision. | Row is reconciled within the candidate demonstration. |
| `missing_workpaper` | A controlled vehicle and M71 source exist, but no eligible current M74 workpaper exists. | Blocks. |
| `missing_source` | The roster vehicle has no exact current M71 mobile source. | Blocks. |
| `orphan_source` / `orphan_workpaper` | M71 or M74 contains a mobile record not represented exactly once in the roster. | Blocks. |
| `unknown` | Control, period, stable identity, base entity/facility, class, model year, fuel or another required fact is unresolved or conflicting. | Blocks; never becomes zero. |
| `unsupported` | A known controlled asset falls outside the M74 candidate profile or mode. | Blocks; preserved for a separately reviewed method milestone. |
| `duplicate` | The roster evidence repeats a physical asset, or multiple M71 sources/M74 streams claim the same asset, source or vehicle-year identity. | Blocks; all conflicting rows remain visible. |
| `workpaper_incomplete` | The exact M74 head lacks usable fuel/mileage evidence, a calculation or a current accepted decision, including accepted workpapers with unresolved discrepancies. | Blocks. |
| `capacity_blocked` | An otherwise eligible vehicle cannot receive an M74 workpaper under the retained three-stream bound. | Blocks and names the limit. |
| `stale` | A roster, M71 boundary/source head or linked M74 head changed after the reconciliation snapshot or decision. | Blocks current acceptance; historic bytes remain valid history only. |

The overall current state is `reconciled_bounded_synthetic` only when the roster attestation and exact roster version have an accepted internal decision, the exact current M71 head is accepted for bounded internal use, every union member resolves one-to-one, every controlled row is `matched_reviewed`, and there are zero unknown, unsupported, excluded-assertion, duplicate, orphan, incomplete, capacity or stale findings. Otherwise the state is `blocked` with counts and named findings. Neither state changes `releaseEligible:false`, `scope1Completeness:incomplete`, `corporateCompleteness:incomplete` or `assurance:none`.

## User journey

1. The manager opens **Fleet reconciliation** from the corporate register. The page identifies the company, period, current M71 boundary version and the M74 three-workpaper capacity before accepting input.
2. The manager records the bounded roster rows and attaches the supplied synthetic roster statement. The page keeps unknown facts and duplicates as findings rather than filtering them from the evidence population.
3. The manager saves an append-only roster version. Server-side validation compares the complete roster, all current M71 mobile sources and all M74 streams; the result shows matched, missing, unsupported, orphan, duplicate, capacity and stale rows in one table.
4. For an eligible unmatched row, the manager follows the exact M71 source and M74 workpaper link. M75 does not manufacture a workpaper or calculation. After the separately authorized M71/M74 correction is saved, the manager creates a new reconciliation version against the new exact heads.
5. A distinct eligible manager reviews the exact roster/evidence/link snapshot. A contributor cannot review it. `accepted_bounded_reconciliation` is available only with no blocking finding; `changes_requested` remains available for a blocked snapshot.
6. The user opens or downloads an exact reconciliation report. It lists the entire union, evidence and linked version identities, every blocker, review state and limitations. A later correction marks the old snapshot stale for current use while preserving its exact report and decision.

## Version, correction and stale-link behavior

- Roster versions are append-only and bind the full effective roster, original roster evidence, M71 head ID/hash, every current mobile source, each linked M74 worksheet/head/version hash and review decision, derived findings, actor, time and predecessor.
- A correction needs an exact expected head and reason. Changes to labels, facts, evidence, asset identity or links create a successor and reset reconciliation review. Full-tuple no-ops, stale expected heads and same-key/different-payload replays are refused.
- The authoritative physical-vehicle identity cannot be replaced inside one continuing row to evade duplicate detection. A genuine roster-source correction preserves the original evidence/version and explains the changed identity.
- Any new M71 head makes a prior reconciliation stale, even if a label-only change appears harmless, because source/boundary eligibility is version-bound. Any new M74 head makes its prior linked row stale, including a correction after an earlier accepted decision. A new roster version makes the prior fleet review historical.
- An old report is never rerendered. Current screens must not present an old accepted decision beside a newer unreviewed roster, boundary or workpaper as though they were one reviewed result.

## Report and demonstration requirements

Every report identifies the company/year, exact roster evidence locator/hash, roster version and predecessor, current-versus-historic state, M71 boundary version/review, and each union row. Each row includes stable asset ID, control/period/facility/class/model-year/fuel facts, M71 source ID, M74 worksheet/head/version and decision hashes where present, status and findings. The report links to retained roster evidence and eligible M74 workpapers without copying their arithmetic. It contains no fleet, facility, company or Scope 1 emissions total.

The report prominently states: synthetic evidence; declared roster coverage only; M74 factor/method candidate not released; no aggregate; Scope 1 and corporate inventory incomplete; requirements not determined; no external assurance. Blocked reports remain useful open-findings workpapers and cannot be labeled accepted reconciliation.

The actual M75 demonstration uses the existing calendar-2025 synthetic profile and shows, in the browser and persisted API/database state:

- one exact current roster/M71/M74 row that is matched and internally reviewed;
- one controlled eligible roster/M71 row with a missing workpaper;
- one known controlled row outside the M74 profile, clearly labeled as a product limitation;
- one duplicate or orphan case whose conflicting records remain visible;
- a correction that changes an M74 head and immediately makes the earlier fleet snapshot/report stale for current use while preserving its exact historic bytes;
- a new roster/reconciliation successor with reset review, plus a distinct-manager review outcome appropriate to its remaining findings; and
- exact report/evidence downloads before and after restart, readable by keyboard at desktop and 390-pixel width.

The demo does not need to clear all blockers. It succeeds when the matched path works and every other disclosed condition remains visible and prevents an unsupported acceptance. A separate clean positive fixture must establish that `reconciled_bounded_synthetic` is reachable when all rows and exact heads satisfy the rules.

## Acceptance criteria and evidence map

| ID | Observable acceptance behavior | Required evidence |
| --- | --- | --- |
| M75-P01 | Saving a roster pins exact synthetic roster evidence and full-year company/period attestation independently of M71/M74. Every supplied row is retained within the bound; over-bound input refuses atomically. | Exact statement download/hash, API/native database readback, row-count and refusal checks. |
| M75-P02 | Reconciliation uses the full union of roster, current M71 mobile sources and M74 streams. Roster-only, source-only and workpaper-only records appear as blocking rows; none disappears through filtering. | Positive/negative union fixtures, native query/API response and browser row comparison. |
| M75-P03 | Only an exact one-to-one row with current eligible M71 source/boundary and complete current accepted M74 head becomes `matched_reviewed`. Missing evidence/activity, discrepancy, changed/requested review, foreign/old version or mismatched facts blocks. | Composed M71/M74 lifecycle tests and decoded browser state. |
| M75-P04 | Unknown and unsupported-profile facts remain distinct. Known controlled non-M74 fuel/class/model year/mode is `unsupported`; missing/conflicting facts are `unknown`. A newer model year is described as current product-method coverage, not an EPA prohibition. | Status fixtures and user-facing copy/report inspection. |
| M75-P05 | Duplicate normalized asset IDs, exact source/workpaper mappings and declared alias conflicts are visible and blocking. Renaming a label or evidence reference does not defeat those exact checks; arbitrary false unrelated IDs remain outside the detection claim. | Adversarial duplicate fixtures, concurrent-save test and no-aggregate inspection. |
| M75-P06 | M74's three-stream limit is visible. Additional disclosed eligible vehicles remain in the roster as `capacity_blocked`; no row is dropped and no fourth calculation is implied. | Four-vehicle fixture, API/browser report and unchanged M74 capacity checks. |
| M75-P07 | A roster correction appends a successor, requires a reason, resets review and preserves old evidence, decision and report bytes. No-op, stale-head and idempotency conflicts do not mutate state. | Native/API correction tests and exact old/new download hashes. |
| M75-P08 | A successor M71 or M74 head marks the old reconciliation stale immediately. The UI never combines an old acceptance with a current head; creating a current successor requires exact new pins and fresh review. | Composed head-change test and browser history/current-state exercise. |
| M75-P09 | Only a distinct authorized non-contributor manager can accept an exact blocker-free snapshot. Blocked snapshots permit changes requested but not accepted reconciliation. Role changes, tenant changes, stale decisions and direct forged writes fail without leakage. | Real role/tenant transitions, restricted SQL/API tests and decision-hash verification. |
| M75-P10 | The exact report/download contains the entire union, evidence/version/link/review identities, every finding and all required limitations, with no emissions aggregation or completeness/assurance claim. It survives restart and isolated recovery with earlier M71/M73/M74 bytes unchanged. | Renderer/hash checks, actual browser open/download, restart/readback, recovery and preservation comparison. |
| M75-P11 | The demonstrated mixed state includes matched-reviewed, missing-workpaper, unsupported and duplicate/orphan rows, plus stale-link behavior after correction. A separate clean fixture reaches bounded synthetic reconciliation without changing release or Scope 1 flags. | Actual browser walkthrough and independently reviewed fixture-to-screen/report map. |
| M75-P12 | Keyboard users can inspect status and findings, follow evidence/workpaper links, compare history and download reports; status does not rely on color and remains readable at 390 pixels. | Integrated keyboard and narrow-layout review with announced errors/status. |

Criterion mapping: S1-01 is exercised by exact M71 boundary pinning; S1-04 by complete declared roster/union reconciliation; S1-05 by exact current M74 workpaper eligibility without new arithmetic; S1-09 by retained roster provenance and unchanged method-release flags; S1-11 by duplicate/orphan detection without aggregation; S1-13 by append-only corrections and stale-link behavior; S1-14 by the reconciliation/open-findings report; and S1-15 by tenant isolation, restart and recovery. L01 is tested through actor and state transitions across manager, reviewer, stale and revoked states. L04 is tested at the real native database, API, browser, download, restart and recovery boundaries rather than by a type-only fixture.

## Claims, exclusions and handoff

M75 does not authorize a real-company fleet roster, source/method renewal or release, an emissions aggregation, fleet/Scope 1 completeness, filing, a regional expansion, paid RAG work, or an assurance conclusion. Corporate Scope 2 and all 15 Scope 3 categories remain outside this increment and visibly incomplete. Unsupported mobile profiles become separately scoped accounting/method milestones; they are not silently absorbed into M75.

CTO owns the additive implementation and capacity/security boundaries while preserving schema 17 data and the rolling PR. Accounting independently supplies the positive and negative roster/link expectations and checks that candidate source limitations are described accurately. QA challenges the exact integrated candidate, including union omissions, duplicates, stale accepted/current-unreviewed combinations, tenant/role transitions, reports and recovery. Root alone owns Git, hosting, shared ledgers and publication.
