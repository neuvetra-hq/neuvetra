# M75 technical contract: controlled-vehicle roster reconciliation

Prepared 2026-09-15 for `M75-CONTRACT`; CTO executor `/root/m75_cto`, sponsor/root coordinator. Requested registry route: critical `gpt-6-astra` / `high`; observed settings unknown. This is an implementation contract, not an implementation, independent acceptance, source release or legal conclusion. Root owns Git, host and shared operational records.

## 1. Decision and inspected baseline

Implement a small append-only fleet roster and retained synthetic roster statement in additive schema 18. Compute reconciliation from that roster, current corporate coverage and current mobile workpapers. Do not persist a mutable reconciliation cache. Persist exact requested report snapshots so earlier reports remain reproducible after any dependency changes.

Reuse M71 for entities, facilities, organizational boundary and generic mobile-source records; reuse M74 for every supported vehicle's activity, evidence, calculation, corrections and workpaper review. Inspection of `m71-contract.ts` / `m71-validation.ts` shows that M71 sources contain no vehicle identity or eligibility facts and evidence references admit only its original pinned entity/screening fiction. Inspection of `m74-contract.ts`, `m74-validation.ts`, `m74.ts` and migration 0017 shows that vehicle facts first exist after a workpaper save, and are constrained to the supported diesel profile. A read-only wrapper over those records cannot establish an independently declared fleet universe or retain unsupported vehicles before calculation. This is the specific necessity for new persistence. Root selected this approach during M75 planning.

The observed repository baseline is schema 17, with M74 profile `synthetic-mobile-diesel-v1`, three workpaper streams per company and forty versions. The handoff identifies runtime `f5d7383` and final documentation HEAD `42b4194`; these are inherited observations, not fresh hosted checks by this assignment. Re-observe before rollout. Never alter historical migration 0015/0017, M71/M74 export contracts, evidence, method pins, arithmetic, report renderers or prior bytes. Do not renew the research catalog: the recorded expiry at `2026-09-15T23:20:32Z` remains enforced.

## 2. Product boundary

Calendar 2025, synthetic corporate inventory, California-based full-year operational-control entities/facilities; the population claim covers the declared on-road fleet and all its trips, including interstate trips. Discovered non-road vehicles remain visible as unsupported; this is not complete coverage of every mobile mode. The initial positive case uses two distinct supported vehicles. Known unsupported and uncertain facts must be saveable as roster findings, even when no M74 workpaper can be created. Empty, incomplete, unsupported or unreviewed input never becomes a zero fleet or a complete inventory.

No new calculator, factor, fuel, class, model-year support, regional product, exclusion method, allocation method, zero-fleet determination, source release, company aggregation or emissions total. The three-stream M74 limit remains unchanged. A fourth applicable supported vehicle is visible with a capacity blocker; never truncate it or raise the old constant silently. The new roster can contain more rows than available workpapers.

The strongest new status is **“Declared synthetic fleet reconciled to current internally reviewed workpapers.”** Even this retains `scope1Completeness:'incomplete'`, `corporateCompleteness:'incomplete'`, `releaseEligible:false`, `assurance:'none'`, `emissionsTotals:null`. All source/method release and broader inventory gaps remain explicit. Reconciliation is a bounded internal cross-check of declared evidence, not proof that a real company disclosed every vehicle.

## 3. Frozen authoring interface

New shared pure module `packages/neuvetra-database/src/m75-contract.ts` defines these interfaces before UI implementation. Exact keys apply at HTTP, database and browser boundaries. Use lowercase UUIDs, lowercase 64-character SHA-256 values, canonical UTC timestamps and M71 canonical JSON. Normalize text as NFC, trim, reject controls/unpaired surrogates, and bound fields. Numeric years are integers; unknown is null, never a guessed supported default.

```ts
type M75Pin = { id: string; sha256: string }
type M75Period = { start: string; endExclusive: string }
type M75Control = 'owned_operational_control_full_year' |
  'other_control_arrangement' | 'unknown'
type M75Mode = 'on_road' | 'off_road' | 'rail' | 'marine' | 'air' | 'other' | 'unknown'
interface M75RosterAsset {
  rowId: string
  assetId: string | null
  aliases: string[]
  entityId: string | null
  facilityId: string | null
  period: M75Period | null
  mode: M75Mode
  vehicleClass: string | null
  modelYear: number | null
  fuel: string | null
  controlBasis: M75Control
  classificationBasis: string | null
  controlExplanation: string | null
}
interface M75StatementInput {
  issuer: string
  reference: string
  description: string
  discoveryBasis: string
  coveredEntityIds: string[]
  completeness: 'declared_complete' | 'partial' | 'unknown'
  allTripLocationsIncluded: boolean
  assets: M75RosterAsset[]
}
interface M75Link { rowId: string; sourceId: string | null }
interface M75SaveInput {
  profile: 'synthetic-controlled-fleet-v1'
  coverageVersionId: string
  coverageVersionSha256: string
  expectedDependencySha256: string
  period: M75Period
  rosterStatement: M75StatementInput | null
  manualConfirmation: boolean
  links: M75Link[]
  expectedVersionId: string | null
  expectedVersionSha256: string | null
  correctionReason: string | null
  idempotencyKey: string
}
```

The roster statement is independently entered or seeded **before** workpaper matching. Never generate its asset list by enumerating saved M74 worksheets or selected M71 mobile sources. `discoveryBasis` describes the fictional inventory records checked across the declared entities (asset list, vehicle ownership/control and operating-period records); source count alone is insufficient. The retained statement displays “SYNTHETIC — NOT AN ORIGINAL COMPANY RECORD OR INDEPENDENT MEASUREMENT.” Its original canonical declared facts, issuer, reference, description and attestation are frozen as text, SHA-256, byte length and resolving locator `m75-roster-statement:<id>:declared-fleet`. These are original bytes of this synthetic declaration, not a claim of an uploaded third-party original. Do not accept arbitrary documents or model extraction in M75.

`coveredEntityIds` must enumerate every entity in the bound M71 snapshot for a complete declaration, including entities with unresolved boundary status. Partial/unknown declarations can save but block. `assets` is the evidence universe; `links` separately maps every evidence row to zero or one M71 source. No link creates a source or vehicle. Require exactly one link entry per declared row (null is a visible missing mapping). Entity/facility references, when supplied, must exist in the pinned company snapshot; nonmatching parentage saves as a blocking finding or is rejected as a malformed reference, never auto-corrected. A supplied source reference must resolve within the same snapshot; non-mobile domain is a blocking conflict. Unknown IDs from another tenant are refused without disclosure.

Allow 0–25 statement assets so emptiness and capacity overflow can be demonstrated. Unique stable `rowId` is a structural requirement. Duplicate **asset identities** or duplicate source mappings are valid disclosed evidence with blocking findings; a uniqueness constraint must not erase or prevent retaining the conflicting rows. On corrections retain all prior row IDs; new discoveries append. No delete/exclusion/not-controlled shortcut. Correct identity/facts or a link with a reason; preserve the entire earlier statement/version. If a mistaken row needs deletion or an exclusion determination, that remains outside this increment and blocking. First versions may have a null statement; once a statement exists it cannot be replaced by null to hide the fleet. A successor cannot drop prior evidence rows.

Asset IDs and explicitly declared aliases use exactly M74's ASCII rule: trim, uppercase, match `[A-Z0-9][A-Z0-9._-]{0,63}`. Null is unknown; other invalid representations are refused. `aliases` has 0–8 normalized asset identifiers, sorted and unique within the row; the primary ID cannot repeat there. Any cross-row overlap among primary IDs and declared aliases blocks as duplicate. Do not infer aliases absent from evidence. No case-sensitive parallel identities, punctuation stripping, fuzzy matching, VIN inference or concatenation with fuel/class/year. `truck-01` and ` TRUCK-01 ` collide; `TRUCK-01` and `TRUCK01` remain different declared identifiers and require truthful manual evidence. The physical key is `(companyId, normalizedAssetId, reportingPeriod)`, independent of fuel/class/source label. Preserve every match in a multimap; never use “first match wins.”

Use 120-character issuer/reference, 2,000-character description/discovery basis, 500-character explanations, 100-character vehicle class/fuel; existing bounded label rules may be reused. Years 1900–2100 can be retained as declared facts; only the M74 supported range qualifies. Non-2025 or partial-year asset intervals are retained if valid ISO intervals and marked unsupported. The overall roster period remains exactly calendar 2025.

## 4. Version, review and read contracts

`M75Activity` is the save input without predecessor/correction/idempotency/expectedDependencySha256 fields. Every version also freezes `dependencies:M75Dependencies` (pins only), captured by the server at save. `M75Dependencies` contains `coveragePin`, `coverageReviewPin` (null stays null), sorted `workpaperPins`, and `dependencySha256`; the hash excludes the roster itself and M75 reviews, preventing a cycle. A save compares expectedDependencySha256 with the current external tuple under lock. `M75Statement` has `id`, profile `m75-synthetic-roster-statement-v1`, `input`, `locator`, `text`, `sha256`, `byteLength`. `M75Version` follows the M74 lifecycle: `id`, `companyId`, `rosterId`, integer `version`, predecessor IDs/hashes, creator/time, cumulative `contributorIds`, correction reason, activity, exact `coverageVersionId`/`coverageVersionSha256` pins (reconstructed from preserved M71 history), statement, roster-local findings, input/content/version hashes and explicit synthetic/incomplete/release/assurance flags. Reviews are returned separately on `M75Register.reviews`, never merged into or used to rewrite version exports. Statement and version hashes must not change when review is added. Each historical version reconstructs only its exact bound coverage version; never copy complete M71/M74 histories into roster versions.

Roster review input is `{versionId, expectedVersionSha256, expectedDependencySha256, decision, note, acknowledgedLimitations, idempotencyKey}`. Decision is `accepted_bounded_reconciliation|changes_requested`. A current authorized manager outside all roster, bound coverage and captured workpaper contributors may append one immutable decision per roster version. A review stores ID/hash, actor/time, exact version pin, the same frozen dependency tuple/hash, decision, note and acknowledgements. No correction inherits review. Acceptance requires a complete confirmed roster declaration, accepted current M71 head, exact current accepted M74 heads and zero reconciliation blockers **other than the absence of this M75 acceptance itself**. Blocked snapshots allow changes_requested only. The UI names this “Fleet reconciliation review,” never merely a count or declaration approval.

Any external head or review change makes the saved version and its decision stale. To review current state create a successor that captures the new tuple, even if authored roster fields are unchanged; changed dependency pins make that a real correction, not a no-op. The correction requires reason and predecessor. Reuse the existing roster statement bytes when the declaration itself is unchanged. Old versions reconstruct captured dependencies, including captured null decisions, from retained historical records; later decisions cannot be attached retroactively.

New `M75Reconciliation` is a derived object with profile `m75-fleet-reconciliation-v1`, `companyId`, period, `rosterPin:M75Pin|null`, `rosterReviewPin:M75Pin|null`, `coveragePin:M75Pin|null`, `coverageReviewPin:M75Pin|null`, sorted `workpaperPins` (worksheet/source/normalized asset IDs, current version pin and current decision pin or null), `rows`, `findings`, `counts`, `status:'blocked'|'reconciled_bounded_synthetic'`, `dependencySha256`, `contentSha256` and the fixed limitation flags above. Pins capture explicit absence. Adding a worksheet changes the external dependency tuple; adding the first roster changes the overall reconciliation digest. Hash a deterministic dependency/result payload, not wall-clock read time. Do not include all M71/M74 histories in this response.

Each reconciliation row has stable `rowKey`, `rosterRowId:string|null`, `sourceId:string|null`, `assetId:string|null`, `worksheetIds:string[]`, source/entity/facility labels, `status`, and `findings`. Status vocabulary: `unknown`, `unsupported`, `duplicate`, `missing_source`, `missing_workpaper`, `orphan_source`, `orphan_workpaper`, `stale`, `workpaper_incomplete`, `capacity_blocked`, `matched_reviewed`. Findings retain **all** applicable problems with `{code, rowKey:string|null, message, blocking:boolean}`; the summary status never hides secondary issues. Fixed precedence is duplicate, unsupported, unknown, orphan_source/orphan_workpaper, missing_source, stale, capacity_blocked, missing_workpaper, workpaper_incomplete, matched_reviewed. Preserve each orphan as a separate row where no unambiguous association exists. Counts distinguish evidence rows, declared unique known assets, current mobile sources, current workpaper streams, reconciled rows and blocking findings; none is an emissions total or a completion percentage.

`M75Register` contains current company/profile/head, roster versions/reviews, report metadata and current reconciliation. Stored report bodies are retrieved by exact report ID, not bundled into unbounded register reads. Limit to 40 roster versions, 100 KiB per canonical version, 128 KiB per report, 3,800,000 retained-history bytes and 4,000,000 response bytes, checked before writes; refusal preserves earlier history. Backend freezes any measured refinement before UI dispatch.

## 5. Deterministic reconciliation

1. Authorize the actor/company before reading any roster or downstream record. Read verified M71, M74 and M75 data in one consistent company snapshot. Do not combine independent HTTP responses and label them authoritative current state.
2. Construct the full union of every roster statement asset, **every** current M71 `mobile_combustion` source (including missing/excluded/not-applicable screenings), and every M74 worksheet head. Never begin with only eligible choices or saved workpapers. Preserve unmatched/orphan nodes and every duplicate edge.
3. Confirm the roster's exact coverage pin equals the current M71 head; its declaration covers all entities, is nonempty, declared complete, manually confirmed and all-trip inclusive. Require current accepted M71 review and current accepted M75 reconciliation review for a positive result. Require saved dependencies to match the current external tuple; otherwise stale. Missing statement, unknown declaration or unreviewed roster produces global blockers even if visible vehicle counts match.
4. Compare roster links against source entity/facility/domain and supported full-year boundary facts. Reuse M74 source-choice eligibility for the supported boundary, while retaining ineligible sources in reconciliation. Source screenings with unassessed/missing/conflicting/unsupported/excluded/estimate assertions remain visible; a screening label alone never replaces a verified workpaper or resolves an exclusion.
5. Evaluate typed roster facts. Exact on-road `Medium- and Heavy-Duty Vehicles`, model years 2007–2022, `Fossil Diesel`, full-year owned operational control and nonempty classification/control basis can match M74. Unknown facts are unknown; other known facts are unsupported. No coercion to the nearest supported value. The 2022 model-year ceiling is conservative M74 product admission, not a claim that EPA prohibits using a most-recent available model-year factor for newer vehicles. M75 does not broaden the released or candidate method. All trips remain included.
6. Require exactly one evidence row ↔ one M71 mobile source ↔ one M74 stream, with equal normalized asset identity, entity/facility/source binding, period, fuel/class/year/control facts. Compare material classifications; differing explanatory prose may remain separate retained evidence, but missing bases block. Duplicate roster identity, repeated mapping or a source/stream that represents another asset produces a blocking identity conflict. Unsupported or unmatched discovered sources cannot disappear by lacking an asset ID.
7. Select only `headVersionId`, never the newest accepted historical version. Require its exact current coverage pin, both entered or valid explicit-zero activity dimensions, both statements/manual confirmations, replayed calculation, and no unresolved discrepancy/mixed-zero/unsupported findings. M74 can retain a calculation alongside a explained discrepancy; its presence or accepted internal review does **not** resolve that discrepancy for fleet reconciliation.
8. Require `accepted_bounded_internal` on the selected current M74 version/hash. A changes-requested, absent, prior-version or stale decision blocks. Roster edits require a new roster review; workpaper edits require that workpaper review and a new M75 successor/review for the new dependency tuple. M71 edits require new roster coverage binding and every affected M74 relink/review. No prior review is rewritten: its stale status is derived from dependency comparison.
9. Diagnose capacity explicitly for unmatched applicable rows once all three M74 streams exist. Do not truncate fleet rows or hide prior streams to free capacity.
10. Only no reconciliation blockers yields `reconciled_bounded_synthetic`. Permanent release/inventory limitations are a separate findings class and keep all company/release claims false. No source emissions are summed, copied into fleet totals, rounded or recalculated by M75.

Malformed or unverifiable retained bytes fail the whole derived read with 503, not an empty successful register. A supported but incomplete input returns 200 with blocking findings. Historical report reads reconstruct the **captured** dependencies and renderer, never the current heads. “Current” is computed alongside report metadata by comparing the complete pinned dependency tuple; it is not written into historic HTML.

## 6. Routes, report and authority

Private root `/workspace/:companyId/controlled-fleet`:

| Method/path suffix | Contract |
| --- | --- |
| GET root | Verified register/history metadata plus derived current reconciliation; no writes |
| POST root | First roster save using `M75SaveInput` |
| POST `/:rosterId/versions` | Append correction using exact predecessor and current coverage pin |
| GET `/:rosterId/versions/:versionId` | Exact retained version |
| GET `/:rosterId/versions/:versionId/roster-export` | Canonical version JSON, excluding separately retained reviews |
| GET `/:rosterId/statements/:statementId/download` | Exact retained synthetic roster text |
| POST `/:rosterId/reviews` | Separate authorized roster review |
| POST `/:rosterId/reports` | Freeze current reconciliation and complete dependency tuple |
| GET `/:rosterId/reports/:reportId/download` | Exact immutable HTML |
| GET `/:rosterId/reports/:reportId/snapshot` | Exact canonical report snapshot JSON |

Report input is `{expectedReconciliationSha256, idempotencyKey}`; the server derives every dependency. A stale digest produces 409. A report may document a blocked current state, conspicuously labeled blocked, with all findings and limitations. Rendering includes roster evidence locator/hash, coverage/version/review pins, every union row, reasons and exact M74 workpaper references. Do not present a blocked report as reviewed fleet acceptance. Report object includes ID/company/roster, renderer `m75-fleet-reconciliation-report-v1`, snapshot JSON/hash, HTML/hash/length, report hash and actor/time. Cap to forty report snapshots per company; deduplicate identical dependency/result digest. An idempotent retry returns the exact prior report even after heads advance, after fresh authorization.

Use verified bearer actors, same-origin writes, duplicate-key JSON refusal, 256 KiB request bound, no-store, strict route shapes, escaped HTML, attachment filenames and existing sandbox/CSP protections. Preserve 401 unauthenticated, 403 authorized-company insufficient role, 404 inaccessible company/resource, 409 stale/idempotency conflict, 422 malformed/unsupported request or capacity, 503 verification unavailable. Unknown structured facts may be retained; unsupported *requests* do not mean silently rejecting disclosed unsupported vehicles. Deny extra path segments and caller-supplied actor, totals, findings, review or hashes of derived results.

## 7. Database and concurrency

Add `0018_controlled_fleet.sql` with one company roster head, immutable statements, versions, reviews, reports, requests and audit (seven tables). Composite company/record foreign keys bind all children and exact M71 coverage version; native source references must be resolved within its pinned snapshot. Freeze M74 report dependency IDs/hashes and decisions in canonical report snapshot, with referenced records checked at creation and read. No vehicle-result table, mutable cache, automatic release or scheduler.

Expose `findControlledFleet`, `saveControlledFleet`, `reviewControlledFleet`, `createControlledFleetReport` on `WorkspaceDatabase`. All paths receive a verified actor; reads use the same RLS enforcement and M74 authority replay as existing workpapers. Create a bounded M75 lock entry point that reuses `m71_lock`, then company lock, corporate head lock, roster head and mobile heads in sorted ID order. Reads take a company share lock covering the complete composed read; existing M74 writers take company update locks; verify M71 save/review and membership writers serialize with the chosen locks in native tests before claiming a consistent boundary. Mutations take update locks and revalidate current membership/manager status inside the transaction, not only HTTP. No lock-order inversion.

SQL functions validate exact keys/canonical values, current pins, full effective tuple, evidence reconstruction, identity/findings and report dependency snapshots. Neither caller-supplied findings nor a matching self-supplied hash is authority. Reuse immutable-history triggers, forced RLS, narrow select/function grants and fixed definer search paths. Runtime cannot mutate existing statements/versions/reviews/reports, forge a review, bypass contributor checks or write another tenant. Server readback independently reconstructs canonical values, lineage, statement text, request/audit correspondence, review independence and report output; replay exact M74 records with the existing authority. Coordinated bytes/hash/length tamper must fail.

One company has one roster stream. Compare the entire effective input including captured external dependency pins for no-op rejection; description-only, link-only, identity-only, classification-only, attestation-only and coverage-only corrections are permitted changes. Cumulative contributors include all previous roster, bound coverage and captured workpaper contributors. Idempotency fingerprints cover actor/company/operation/full request, scoped per company. Conflicting actors or content cannot reuse a key. Limits and compare-and-swap checks are transactional; concurrent predecessor saves produce one successor and one conflict. New M74 heads/reviews or M71 changes racing report creation yield either one consistent old snapshot or a conflict/reload, never mixed pins. If inspection shows an existing writer does not serialize against these locks, use an explicit repeatable-read composed transaction plus exact current-pin revalidation for writes; freeze that implementation choice with root rather than assuming consistency.

## 8. UI and demonstration

New controlled-fleet panel adjacent to existing corporate coverage and mobile workpapers. Explain “declare the whole fleet first,” collect the retained synthetic declaration, show all rows including unsupported and unlinked assets, then map to already registered mobile sources. Do not seed from current workpaper count. Offer navigation to existing source registration and M74 workpapers; keep their forms/contracts unchanged. Show independent roster review, each current source review, permanent release limitations and outstanding actions separately.

Clear actor-owned drafts, reconciliation, report selection and downloads on company/actor change; discard late responses using request generations. An unsaved draft never changes the saved current reconciliation. Show selected history explicitly; show historical report status beside immutable download links. Actual reads must pass the new strict browser decoder. Verify desktop and 390px layouts, real downloads and print entry/presentation separately.

Demonstrate two independently declared supported vehicles: one existing workpaper and one initially missing. Save the roster and show a changes-requested review with the missing vehicle blocker, register/link and complete/review the second vehicle using M74, then create a current roster successor, accept it with a distinct eligible manager and show bounded reconciliation. Correct one mileage value: current fleet becomes review-required while earlier report bytes remain identical. Review the workpaper correction, create/review a current roster successor and create a new fleet report. Separate negative fixture adds a known unsupported asset and shows the blocker. A new M71 coverage version requires explicit relinks; preserve older gas/electricity/corporate/mobile histories throughout.

## 9. Workstreams and acceptance

Root assigns each writer explicitly before execution. Maximum four concurrent contexts, reserve independent review capacity.

| Owner/workstream | Allowed files | Required handoff |
| --- | --- | --- |
| Backend author | New database `m75-contract.ts`, `m75-validation.ts`, `m75.ts`, `m75-report.ts`, migration 0018; new API `workspace/m75-routes.ts`, `m75-postgres.test.ts`; database exports only; `workspace.ts` and API wiring/readiness remain root-owned unless explicitly delegated | Frozen shared contract first; strict persistence, derived reconciliation, routes and native transaction evidence |
| Root UI/integration | New `ControlledFleet.tsx`, `lib/m75-api.ts` and tests; bounded workspace navigation/styles; migration manifest, asset packaging, hosted/staging wiring, CI, local/hosted demo harness, common records and Git | Actual decoder/browser journey, packaging and publication |
| Explicit operator delegate | New `tools/staging/m75-*` only; do not edit M74 operators | Schema17 backup/restore/recovery manifest, exact17→18 rehearsal/apply, schema18 restore verification |
| Independent QA/accounting/security | New M75 artifacts/tests in `evaluations/research-qa/` | Challenge frozen integrated bytes, native database/API/browser/restore boundaries; authors cannot supply sole release verdict |

Acceptance cases must exercise actual boundaries, not only pure helpers:

1. Independent roster before any workpaper; missing declaration, empty roster, omitted covered entity, missing asset identity/profile/basis and unsupported known values remain blocking after save/reload. A declared unsupported asset without an M74 stream cannot disappear.
2. Union cases: roster-only, M71-only, M74 mismatch, two source rows for one asset, two normalized roster identities, wrong entity/facility/source and fourth applicable vehicle. Assert every original row and every blocker survives; no aggregate exists.
3. Currentness: old accepted M74 followed by missing/discrepant/unreviewed correction, roster correction, coverage advance, additional stream and later review all change appropriate current status/report digest. A prior accepted result never substitutes for a current incomplete head.
4. Positive control: two supported nonduplicate assets, complete declaration/current roster review/current boundary, complete replayed workpaper heads with their exact accepted decisions produce bounded reconciliation while all release/completeness flags remain false/incomplete.
5. Full correction matrix through PostgreSQL → API → actual browser decoder: identity, linkage, unknown-to-known fact, explanation-only, statement-only, coverage-only and attestation-only. Equivalent reordered JSON succeeds canonically; true no-op, stale head and changed idempotent request refuse without new rows.
6. Concurrent saves/report creation versus M71/M74 writes/reviews and actor demotion; direct restricted SQL forged report/findings/statement, outsider IDs/downloads and owner→member→outsider→signed-out plus late responses. No cross-tenant or mixed-snapshot disclosure.
7. Exact canonical export, synthetic roster text, HTML and snapshot downloads replay after real restart and isolated actual-backup restore. Tamper both content and corresponding hashes/lengths to challenge semantic reconstruction. Old M71/M73/M74 bytes and all earlier rows/catalog/roles remain equal to baseline.
8. Desktop/390px signed-in hosted workflow and real hosted responses through actual frontend decoder. Confirm displayed blockers, history, downloads and print entry separately. API-only evidence is not browser acceptance.
9. Research at/after real expiry still refuses before provider request/spend; M75 changes no catalog dates or method/source release status. Existing M74 gas calculations/exports/reports retain exact historical behavior.
10. Exact reviewed filesystem, staged and committed artifact hashes match (including LF normalization), meaningful native tests execute in CI, same rolling draft PR5 remote head and all required checks verified before publication. No merge. Legacy M73 and M74 operator tests must assert safe refusal under schema18/its newer manifest, without changing frozen old operators to accept newer schema.

L01: actor/tenant/late-response test; L02: semantic reconstruction and exact preserved bytes; L03: canonical cross-layer tuples and timestamps; L04: actual native/public/browser/export boundaries. This planning assignment ran file/contract inspection only; no tests, migration, host action or acceptance is claimed.

## 10. Migration, rollout and recovery

Schema18 is additive; keep all first seventeen receipt bytes. New operators pin expected receipt/catalog/role state, exact 0018 bytes and an exclusive operation journal; refuse mismatches and unresolved earlier writes. Do not parameter-substitute M74's16→17 operators or edit old backup archives. Rehearse on an isolated restored schema17 snapshot and verify every old row/content/download, then new roster/report reconstruction after18.

Before hosted mutation root re-observes actual service/head/image/readiness, obtains a fresh encrypted backup, independently restores it, verifies historical evidence and tests18-compatible forward recovery. Use the established stopped-writer/maintenance receipt workflow and any actually applicable approval constraint; this document grants no host permission. An automatic-review rejection must be reported and resolved, never bypassed. After committed18 never deploy17-only code; use18-compatible fix-forward. Keep failed attempts and backups intact.

Deploy the exact checked commit/image; verify readiness18, perform bounded journaled synthetic saves/reviews/reports, actual restart and zero-application-write revisit, then independently check exact UI/download/history preservation. Restore prior automatic-deploy state and close verification sessions. Root records demonstrated evidence and proceeds under standing Scope1 direction; complete-fleet calculation/method release and company Scope1 completion remain separate future gates.
