# M65 planning review — exact-version worksheet report

September 14, 2026. Task M65-PLAN-REVIEW; independent planning challenge by the existing CTO context, which authored part of M64. This is not independent implementation QA. Existing requested compute route applies; actual runtime model/effort is unobserved. No product code, cloud, Git, credentials or operational ledgers were changed.

## Recommendation

Select **M65: a readable, printable report from an exact saved synthetic electricity worksheet version**. An invited manager should be able to take the quantity they entered in M64, inspect a coherent January subtotal and its provenance, and reopen/download precisely the same report later. This closes the gap between the variable entry workflow and its usable output. The existing M63 example report remains a separate, unchanged historical fixture.

This is the strongest immediate product increment under the current synthetic boundary. More months would introduce missing-period/completeness and inventory aggregation decisions. Uploads would introduce document evidence, extraction and correction semantics. Broader factors would reopen applicability/release review. Recovery and monitoring are consequential launch prerequisites, but they do not displace this bounded demonstration while all input remains fictional and no customer launch is proposed. If the board instead requests real customer use next, operational and source-release prerequisites take priority.

The current handoff says the board accepted M64 after saving version4 at 25000 kWh. That direction supersedes the still-stale local continuation/ledger entries awaiting board feedback. I have not independently read that live version or verified a new remote commit; root owns those observations and publication assurance.

## Small product contract

Generate a self-contained HTML report with print styling from one explicitly selected, freshly verified M64 version. The report identifies fictional company/facility labels, January 1–31 2023, declared CAMX geography, manual kWh input, exact MWh conversion, displayed and inspectable exact kg CO2e subtotal, pinned annual eGRID candidate and source locator, version/correction provenance, and the seven limitations. It explains that an annual regional factor was applied to January activity; it must not imply January-specific factors or annual completeness.

Show the exact worksheet review state: unreviewed, changes requested, or bounded internal acceptance, with its version and decision reference. Label this **worksheet review**, not approval of the report presentation, assurance or verification of a real bill. Permit an unreviewed version to produce an unmistakably unreviewed draft. No additional report-approval workflow is needed in M65.

Bind immutable report bytes/hash to the source version ID, input/result hashes, explicit review snapshot (including absence), and report-template version/hash. Creation by an authorized manager should converge under duplicate/concurrent retries; members may inspect/download authorized existing reports. A later worksheet decision or correction must never silently rewrite a previously generated report. If the same source version later receives a review, creating a new report snapshot preserves the earlier unreviewed artifact. The in-app wrapper can identify historical/superseded source versions; frozen bytes should state their exact source and capture time, rather than claim they are perpetually current.

## Acceptance and independent QA gates

1. From the board's saved version4, generate and reopen a report whose labels, input, exact/display result, version hashes and review state agree with a fresh authorized worksheet read. An older report remains byte-identical after correction or later review; a new report reflects only its explicit snapshot.
2. Exercise unreviewed, accepted and changes-requested worksheet states, explicit zero, near-half-even values, and a changed version that must not inherit earlier review. Reuse the approved M64 arithmetic; do not create another calculator or change accounting policy.
3. Reconstruct source lineage on creation and read. Refuse tampered bytes, hashes, metadata, review references, template pins, missing source records and conflicting replay requests. Test one-statement/snapshot consistency during concurrent correction/review/report creation.
4. Test real PostgreSQL and the actual frontend decoders in CI. Preserve M64's native-driver JSON and numerical-neighbor regressions; require one report and one audit event for equivalent concurrent creation retries. Verify no M63 report/review or M64 version hash changes.
5. Enforce active tenant membership on report records and downloadable bytes. Challenge member mutation, active invited second-company access, uninvited/signed-out access, revoked membership, and actor changes while a download is pending. Do not expose public bearer URLs, customer content or unauthenticated report caches.
6. Independently inspect the signed-in hosted browser, narrow viewport, keyboard access and rendered print pages. Long permitted labels/notes, escaping, headings, source references and repeated synthetic/draft/incomplete/unreleased/no-assurance labeling must remain readable. Server-generated numerical strings must agree across screen, download and print; no external scripts/resources in the report.
7. Demonstrate restart/revisit with unchanged report/source hashes. Before any additive schema upgrade take the authorized encrypted backup and define a compatible rollback sequence, learning from the M64 schema9-to10 readiness interruption. Publish the independently accepted milestone on the same rolling PR and collect board feedback before dependent work.

## Dependencies and exclusions

Root should first record actual M64 board acceptance and verify current remote PR head/checks, deployed revision and any documentation-only head difference. A recorded earlier six-check receipt does not prove a later commit is published or deployed. Preserve the original M64 plan as historical evidence while updating current operational pointers.

Before implementation, CPO/CTO should freeze the report snapshot and review-state contract; accounting should review wording and reconciliation to the existing numerical contract; a nonauthor QA should challenge the lifecycle and download boundary. Use the existing hosting. New factors, months, facilities, customer evidence, public sharing/email, automatic report scheduling, filing, PDF generation, annual inventory generalization, report approval and professional assurance remain outside this milestone. Browser print/save-as-PDF is a user action, not a claim of server-generated PDF support.

## Review of the coordinator's exact draft

Reviewed `docs/research/worksheet-report-milestone-65.md` and the newly recorded `operations/feedback/2026-09-14-milestone-64.md`. **The selected scope is suitable to proceed to the contract-design gate.** It captures the useful increment, retained boundaries, exact version4 expectation, print/accessibility checks and worksheet-versus-report review distinction. Root's acceptance record now supplies the reported publication/deployment observation; this planner did not independently call those systems.

The coordinator intentionally permits either a reproducible projection or an immutable exported artifact. My immutable-byte recommendation above is a design preference, not an additional board requirement. A read-only projection may be the smaller M65 implementation and avoids a schema migration. Before coding, choose explicitly: a source-version report with a clearly labelled current/as-of review section cannot also claim immutable report bytes. If the report promises an unchanged historical review snapshot or persistent exact report hash, bind that snapshot and renderer version explicitly and preserve its reproducibility. Do not conflate a stable worksheet version with a stable report while review state can change.

Three refinements belong in the implementation contract without broadening the chosen milestone: include an active invited second-company actor and revocation in the report-route negatives; test permitted labels/reasons as escaped data in HTML and print; and explain January activity using an annual 2023 regional factor. The current plan's required identity decision and independent QA gate are sufficient to resolve these before implementation. No new board permission question is needed for ordinary reversible design choices within this scope.
