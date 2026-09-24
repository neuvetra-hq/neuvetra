# M75 accounting acceptance: controlled-vehicle roster reconciliation

Prepared 2026-09-15 for `M75-ACCOUNTING`, executor `/root/m74_accounting`, sponsor root/QA. The requested fresh critical `gpt-6-astra/high` dispatch was rejected by the runtime agent-thread limit; root explicitly reassigned this existing context. Requested settings are manifest-only; actual model/effort remain unknown. Role prompt SHA-256: `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`.

This author prepared the M74 accounting contract and fixtures, but did not author M74 application code or any M75 implementation. This document defines acceptance cases; it does not report executed M75 tests or independent approval of itself. A subsequent implementation review must disclose this requirements authorship and inspect the actual candidate. Root owns Git, hosting, shared records and reviewer assignment. File ownership for this assignment is this document only.

## Outcome and unchanged accounting boundary

An authorized preparer can reconcile a separately evidenced expected on-road vehicle population with the current corporate mobile-source register and effective M74 workpapers. The result identifies omissions, unmatched records, conflicting identities, unsupported vehicles, incomplete evidence, discrepancies, missing reviews and stale bindings. It neither calculates nor aggregates emissions.

Calendar 2025, synthetic California corporate operational-control profile, all controlled trips regardless of travel location. Existing M74 admission remains unchanged: owned/full-year operationally controlled fossil-diesel medium/heavy vehicles, model years 2007-2022, consumed U.S. gallons and actual vehicle-miles, separate evidence, existing candidate method/GWP. Other controlled vehicles remain discoverable but unsupported. A leased vehicle may be in an accounting boundary, but it does not thereby meet M74's current owned-vehicle admission. No new factors, quantity conversion, estimation, split-year calculation, fuel profile or release authority is introduced.

**Primary evidence checked:** [EPA Direct Emissions from Mobile Combustion Sources, December 2023](https://www.epa.gov/sites/default/files/2020-12/documents/mobileemissions.pdf), printed p10, supports comparing inventory sources with independent fleet/insurance records. Printed p12 identifies supporting activity records. Printed p1 separates combustion from mobile refrigerant leakage and electricity. These support the reconciliation purpose; they do not certify this synthetic roster or California legal applicability.

**Clarification discovered during this review:** printed p9 of that guidance permits using the most recent available model-year factors for newer vehicles. The M74 year cap is a conservative **product admission limit**, not an EPA prohibition or proof newer vehicles cannot be accounted for. M75 must retain that cap and show a newer vehicle as unsupported; any future expansion needs a separately approved contract and independent validation. This nuance was sent to root and CTO before implementation planning was frozen.

## Baseline actually inspected

- Local HEAD read as `42b4194ba7211779c415c02b590ff5f6ced88a4e`; leading next-session, board report and ledger describe M74 live acceptance/schema17. This author made no fresh host observation.
- `docs/corporate-reporting-direction.md`, `scope1-completion-matrix.md`, M71 implementation and M74 accounting/product/technical contracts.
- Actual `packages/neuvetra-database/src/m71-contract.ts`, `m74-contract.ts`, `m74-validation.ts` and selected `m74.ts` read/review semantics. M71's original artifact contains no activity measurements or fleet census. M74 exposes immutable normalized asset identity, current stream head, exact corporate binding, separate dimension status and exact-version review. It currently has three-stream/40-version demonstration limits.
- M74 permits a numeric candidate result with an explained positive discrepancy, and an internal reviewer may accept such a result. Therefore neither `calculation != null` nor `accepted_bounded_internal` means discrepancy-free reconciliation. M74 register reads flag a changed corporate head separately from historical workpaper findings.
- Current methods remain `development_candidate_not_released`, rights unresolved, `releaseEligible=false`; the research corpus expiry reported at M74 closure is not renewed by M75.

## Population evidence and matching rules

The roster is a separate append-only synthetic statement with exact retained bytes, ID/version/hash/byte length/locator, issuer/reference, reporting period, corporate/entity universe, discovery basis and explicit full-population/all-trips declaration. Its vehicle list must exist independently of the M74 list: generating a list from workpaper IDs and asking a user to confirm it is not the required independent population evidence. A manually entered synthetic statement is labeled accordingly; its attestation records a declaration, not authentication of real records or proof of universal coverage.

Each evidence row has a stable row identity and a nullable normalized asset identity, company/entity/facility and relevant class/model-year/fuel/control/effective-period facts. Missing facts are preserved as unknown; unsupported facts remain expressible. M75 maps a row to a nullable M71 source ID separately from its original evidence. Roster source mapping cannot rewrite original statement text. Each M71 entity in the chosen boundary needs an explicit population disposition, including a supported declaration of no on-road vehicles where applicable; omission of an entity is not a no-vehicle declaration.

Reconcile the **union** of:

1. every original roster row and its current mapping;
2. every current M71 `mobile_combustion` source, including ineligible/unmapped entries; and
3. every M74 stream and its current head.

Use multimaps for matching so duplicate keys produce findings. Never deduplicate evidence rows silently with a map overwrite, collapse unmatched M71 sources into an existing vehicle, or filter the universe to sources with calculators. The same source ID cannot cover two distinct vehicles, and a normalized asset ID cannot become two physical vehicles because row IDs/source IDs differ. Asset/source identity conflicts remain blocking even if all displayed quantities happen to agree. Unknown IDs stay separate rows; multiple null IDs are not a single vehicle.

A source name is not an asset identifier. Exact normalized identity detects only declared duplicates; different plausible aliases for the same real truck require external evidence/manual investigation. M75 must not promise universal physical-asset duplicate detection.

On-road population is the bounded declaration coordinated with CPO. CTO permits arbitrary mode/class facts to retain discoveries. A non-road mobile source discovered in the union remains visible as unsupported/outside this reconciliation's calculation coverage; it cannot silently disappear or be taken as proof of all-mobile coverage. Mobile refrigerants, auxiliary engines and purchased vehicle electricity remain separate source-family gaps.

## Status model and bounded success

Expose separate dimensions rather than a single green coverage flag:

| Dimension | Required distinction |
| --- | --- |
| Roster evidence | Missing, wrong subject/period, declared population retained, or currentness/integrity failure. |
| Identity/source linkage | Unmapped roster row; unrostered source/workpaper; duplicate/conflicting identity; unique consistent link. |
| Calculation profile | Supported by unchanged M74 admission; unknown facts; explicitly unsupported. |
| Workpaper | Missing; present current head; selected historical head; stale corporate binding. |
| Activity/evidence | Missing fuel/mileage, missing statement, unconfirmed, mixed-zero contradiction, supported explicit zero, or usable positive entry. |
| Disagreement | Each entered-versus-stated discrepancy remains visible even if explained/reviewed. |
| Review | No decision, changes requested, or bounded acceptance of the exact current version/hash. Roster review is distinct from workpaper review. |
| Release/completeness | Synthetic; methods not released; Scope1/corporate incomplete; assurance none, regardless of linkage success. |

`all_links_reconciled` (or equivalent bounded wording) is possible only for the current retained roster/current M71/current M74 heads with unique identity links, no omitted entity/source/stream, no unsupported/unknown/excluded-assertion rows, no missing evidence/activity, no discrepancy and every applicable current M74 head accepted by an eligible separate reviewer. If M75 adds an independent roster review, its exact-version acceptance is additionally required for a reviewed reconciliation package. An internal roster decision cannot override row findings or substitute for M74 review.

An empty roster cannot earn vacuous success because all zero workpapers were inspected. Preserve a specific empty/unsubstantiated-population state; without a separately scoped evidence-backed empty-fleet route, do not show `all_links_reconciled`. A company/entity no-vehicle assertion is not zero Scope1 emissions. Counts may aid navigation, but count equality is not set equality, emissions coverage or an assurance score. Multi-label findings need not sum to row counts; never describe them as emissions percentages.

No exclusion shortcut is admitted in this increment. An asserted excluded/third-party/not-controlled vehicle remains visible with reason/evidence and unresolved disposition. Known controlled but unsupported vehicles block successful linkage status. Disputed control is unknown, not automatically Scope1, Scope3 or outside boundary. A later validated exclusion workflow would be a new acceptance decision.

## Concrete acceptance cases

The following are **required tests, not results**. Fixture names are synthetic labels. A, B and C use distinct stable row/source/asset identities unless a case deliberately changes one. Avoid editing historical M71/M74 fixtures or hardcoding one existing vehicle name. Positive setup uses current saved M71 version C1, separately retained roster R1 listing A/B, two valid supported current M74 heads W-A1/W-B1 and eligible distinct-manager reviews. The roster statement declares all expected on-road vehicles for the named synthetic boundary and full 2025; both vehicles' activity includes all trip locations.

| ID | Fixture/action | Required accounting outcome and evidence |
| --- | --- | --- |
| A01 | R1 lists A/B; both unique current source/workpaper links are clean and accepted. | Both rows reconcile; bounded link success allowed, no emissions sum, method release or Scope1-complete label. Retained roster independently lists A/B. |
| A02 | R1 lists A/B; only W-A1 exists. | B appears with missing-workpaper finding; A's review does not close B. |
| A03 | All existing workpapers A/B accepted; roster successor R2 additionally declares C. | C appears immediately as missing source/workpaper or unsupported as appropriate; prior reconciliation becomes stale. No two-of-two completeness claim. |
| A04 | Current M71 has mobile source C absent from R1 and M74. | Separate unrostered/unmatched source finding for C, even with no asset ID. |
| A05 | M74 has stream C absent from R1. | C appears as unrostered workpaper; reviewed C is still a population disagreement. |
| A06 | R1 says A/B while M71/M74 cover A/C; both counts equal two. | B missing and C unmatched remain; equal counts cannot pass. |
| A07 | Roster attestation missing, copied from workpaper enumeration, wrong company, wrong year or omits an entity. | Incomplete/invalid population evidence; reject invalid submission or retain visibly unresolved. No successful reconciliation. Test each fact independently. |
| A08 | Empty roster with zero streams, or empty roster with a mobile source/stream. | No vacuous complete result; latter exposes orphan rows. Blank roster never means zero emissions. |
| A09 | Two row IDs normalize to the same asset (` truck-a ` and `TRUCK-A`), with different sources. | Duplicate identity finding or strict duplicate refusal before commit; never overwrite/coalesce to one covered row. |
| A10 | Distinct assets A/B map to the same source UUID. | Conflicting source allocation; neither gets a clean link from the same workpaper. |
| A11 | Duplicate source ID or stable row ID appears twice in submitted mapping/evidence. | Reject invalid duplicate structure, or retain both as explicit duplicate findings if schema admits them; do not silently pick first/last. |
| A12 | Same label on genuinely distinct assets A/B, unique IDs and evidence. | Do not falsely deduplicate by label; both remain separate. |
| A13 | Unknown/null asset IDs on two rows; no matching workpaper. | Two unknown-identity rows, not zero vehicles or one merged row. |
| A14 | Mapped source's entity/facility/domain or workpaper asset contradicts roster facts. | Identity/boundary conflict; matching one ID cannot override incompatible facts. |
| A15 | Wrong fuel/model/class/control/period facts in roster despite supported M74 workpaper. | Fact disagreement or unsupported finding remains; workpaper does not become proof the roster facts are correct. |
| A16 | Null fuel activity, null mileage, or both null on current head. | Distinct missing findings; no zero or ready/reconciled row. Exercise all three states. |
| A17 | Quantity present but its statement missing or manual confirmation false. | Evidence-missing/unconfirmed finding for the correct dimension; other dimension cannot substitute. |
| A18 | Positive entered/stated fuel mismatch, mileage mismatch, then both; explanations present and M74 accepted. | Each discrepancy remains unresolved; internal acceptance/calculation presence does not turn row green. |
| A19 | Both activities zero with exact zero evidence and reason; clean current binding/review. | Can satisfy bounded per-row activity checks; still no assertion of zero fleet/Scope1. Missing statements/reason fail this case. |
| A20 | One quantity zero and the other positive. | Mixed-zero incompatibility/calculation-null remains visible; no zero assumption or ready row. |
| A21 | Current M74 head has no review or changes-requested review. | Distinct review-pending/changes-requested finding; former accepted predecessor is insufficient. |
| A22 | W-A1 accepted; W-A2 correction has identical numeric results but different evidence/explanation. | Select W-A2 only; reset review/currentness as required. Identical total does not preserve acceptance. |
| A23 | M71 successor C2 changes only a label. | Old M74 C1 binding and old reconciliation are stale under the existing exact-head rule; preserve historical downloads. No opportunistic semantic-equivalence waiver. |
| A24 | M74 source correction/review or roster correction arrives after a reconciliation snapshot. | Prior snapshot remains historical; current view identifies changed dependency and recomputes/rebuilds deliberately. Review decision ID/hash changes are dependencies even without changed source quantities. |
| A25 | Known controlled 2024-model vehicle, gasoline/blended/unknown fuel, light-duty or non-road vehicle. | Retain each discovery as unsupported/unknown under M74; do not coerce class/year/fuel to gain admission. Newer-year restriction is product scope. |
| A26 | Partial-year control/acquisition/disposal or leased-control facts. | Retain period/control gap; no automatic prorating, full-year extrapolation or owned-status assumption. |
| A27 | Excluded/not-controlled/third-party assertion supplied with a reason and reference. | Retain assertion and evidence, unresolved under M75's no-exclusion-shortcut policy. It cannot remove an included stream or manufacture coverage success. |
| A28 | Controlled California-base vehicle has interstate miles; roster/all-trips statement excludes those trips or covers only California. | All-trip declaration/evidence conflict; no matched-ready finding based on a California-only subset. |
| A29 | Fourth eligible controlled vehicle discovered while M74 remains at its three-stream limit. | Fourth roster/source gap remains visible; capacity refusal cannot erase it or imply fleet support. No hidden increase of M74 limits. |
| A30 | Edit asset/source identity to reuse a previously represented physical vehicle or replace it with another. | Preserve prior row/evidence/history and expose correction/reassignment conflicts; a new physical vehicle is a discovery, not silent repurposing. |
| A31 | Original roster says A/B; corrected mapping omits B or a successor drops B without retained disposition. | Refuse destructive omission or preserve B as unresolved historical/current disposition according to append-only contract; no disappearance of expected activity. |
| A32 | Roster or source evidence bytes changed together with claimed hash/length. | Read/replay fails authoritative semantic lineage (L02); recomputed attacker-controlled hash alone cannot pass. |
| A33 | A request supplies fabricated ready status/count/review, or a version/hash from another company. | Server derives findings from authorized authoritative objects; refuse forged/cross-tenant links, no identity or count leakage. |
| A34 | Same frozen report downloaded after roster/workpaper corrections and restart. | Original bytes/selection/review remain exact; current reconciliation separately shows successor state. No historical report retroactive mutation. |
| A35 | M75 success view or export attempts to include gross/net emissions totals, offset subtraction, released method, fleet/Scope1 complete or assurance approval. | Reject/remove those unsupported claims. Retain only linkage findings and existing exact source links; no new emissions arithmetic. |

## Evidence needed from implementation and independent review

Use L04 actual boundaries: positive and hostile cases through the real validator/database transaction/API/frontend decoder, not only fabricated in-memory rows. Required proofs are case-specific; a passing test count alone is insufficient. At minimum, A01-A06/A09-A10/A16-A24/A29-A34 must demonstrate the composed saved-data path, with representative UI inspection of omitted, unsupported, discrepancy, unreviewed and stale rows. The author may group variants but must map each case to observed outcomes. Capacity/exclusion/unsupported discovery cases must not be treated as optional merely because a calculator refuses them.

For the working demonstration, begin with separate R1 listing A/B and only A's accepted workpaper. Show B's missing row. Link or add B through the existing supported workflow and obtain its independent review; show bounded current linkage success. Then change the roster to reveal C or correct a workpaper, and show the result becoming incomplete/stale without losing prior report bytes. Also show an accepted workpaper with a discrepancy still blocked. Demonstrating the entire sequence is more informative than a static all-green list.

The evidence package pins original roster bytes/version, M71 head ID/hash, every selected current M74 head ID/hash and its exact decision ID/hash/null, row-to-source mapping, population declaration/dispositions, derived findings, actor/time and any correction/review. Historical immutable exports can be valid while no longer current. A mutable latest view needs consistent reads of all dependencies and a fresh currentness check; it cannot combine different transaction moments into a supposedly reviewed snapshot. Independent review must challenge a concurrent dependency change at save/report time.

Exact server-derived statuses may use different field names than this document, but their meanings cannot collapse unknown, unsupported, excluded assertion, missing, discrepancy, unreviewed and stale. Old M71/M74 contracts, immutable bytes and synthetic flags remain unchanged. No generated aggregate, client-side summation or extra factor source is authorized.

## Limits, design coordination and next gate

CPO and CTO confirmed independent retained statement plus union reconciliation, no exclusion shortcut, unsupported discoveries retained and no totals. CTO proposed additive schema18, append-only roster snapshots and separate review; these remain implementation proposals until actual reviewed artifacts exist. This document grants no migration/host approval.

The principal design conflicts flagged early were: roster completeness cannot be inferred from workpaper existence; 'all eligible rows linked' is insufficient when unsupported rows remain; M71 mobile sources have no vehicle asset field; M74's three-stream bound must not shrink the declared population; and positive discrepancies can coexist with accepted M74 reviews. The expected outcomes above resolve these at the accounting-contract level, but actual implementation remains untested.

No customer roster, real-world source census, legal filing determination, method release, off-platform communication or host action occurred. The artifact is a test contract, not evidence that the listed cases passed. Root/CTO implement, then a disclosed independent implementation reviewer verifies exact integrated bytes and the case map. Qualified human review and independent external assurance remain separate future gates.
