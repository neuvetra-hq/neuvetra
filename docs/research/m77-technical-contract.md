# M77 implementation boundary and sequencing

Root prepares this contract after M76 board feedback on 2026-09-16. Baseline: rolling PR5 `2fec9c4`; accepted live application `152fcb0`, schema19. No M77 database or browser integration exists yet. No migration or deployment is proposed for the offline calculation foundation. This is coordinator technical work after specialist dispatch failed due to the runtime agent-thread limit; actual compute unknown.

## First reviewable artifact

`apps/site-api/src/calculation/m77_fugitive.py` is a strict, pure, unmounted candidate calculator. It imports only standard-library date/Decimal/regex modules. It accepts no factor overrides, opens no files, makes no network calls and writes no persistent state. It returns no result for unsupported declarations. Returned `evidence_verified: false` is intentional: evidence identifiers cannot attest to their own validity. Candidate test success is not native-driver or hosted acceptance.

Pin source evidence and candidate method constants before integration. Run author tests plus an independently authored fixture suite in CI. Independent review must confirm gas/profile eligibility, exact decimal results, half-even ties, known-loss/refill reconciliation, malformed input refusal, explicit zero and the separation of declaration from verified evidence. Freeze reviewed source/contract/test bytes. Do not patch a prior accepted migration, report renderer or method to add fugitive coverage.

## Next integrated workstream

1. Add append-only fugitive workpapers, source statements, versions, contributor sets, reviews, retained reports and event reservations. Propose the smallest additive schema20 migration only after independent data/security review. Reuse the existing corporate boundary/source and authorization contracts. Inventory all previous tables and prove preservation on a restored database before live action. Never run schema19 code against20 or replay M76 migration/journals.
2. Add an independent physical fugitive declaration and reconciliation. The universe is the union of physical assets, corporate fugitive sources and all fugitive workpaper heads. Include every inspected facility and controlled mobile refrigerant asset, even where unsupported. No omission, unworked asset, unknown gas, ambiguous device mapping, shared event or stale company binding can be accepted. No aggregate emissions total in this milestone.
3. Server validation resolves source/evidence/asset/year bindings. Exact source/GWP/method inputs feed the Python calculator through a bounded subprocess authority with timeout/output limits, strict output verification and frozen input digest. A response from the pure calculator alone is never a reviewable workpaper. Evidence and event reservations belong to the company/asset/year; a corrected same-asset version may reuse its predecessor evidence while another asset may not.
4. Require separate source and reconciliation reviews. Exclude all cumulative contributors from approval. Meaningful source/evidence/label/explanation corrections append a successor and invalidate current derived reconciliation until rebound. Captured missing reviews remain absent in old reports. Reconstruct report semantics from authoritative retained versions; coordinated hash/byte corruption must fail.
5. Add actual frontend decoders, source workpaper editor and physical population page. Use the existing pending/error/actor-reset behavior, with source selectors exposing unsupported gaps. Clarify contractor servicing consumption, full-charge boundary evidence and explicit zero; never prefill unknown as zero. The browser renders deterministic server results, not client calculations.
6. Verify native persistence through actual routes/decoders, independent security/accounting review, exact old/new report bytes, actor changes and late responses. Then run local desktop/narrow browser correction, separate review, downloads and restart. Prepare a bounded hosted exercise with exact approved synthetic data, backup/recovery and one writer, before any rollout. Keep M76 failure journals intact.

## Reconciliation and performance requirements

Application source admission is intentionally narrower than physical discovery. R-410A HVAC, HFC-134a fixed refrigeration and HFC-227ea fire protection may receive candidate workpapers only if the accounting contract passes. Other gases, mobile refrigerants and incomplete records remain displayed blockers. Any future expansion requires its own source/method review.

The prior full-register proof sweeps were slow. Design source/report reads to retrieve the exact dependency closure without loading every report repeatedly. This is a design target, not a measured speed improvement. Do not weaken authoritative reconstruction, historical guarantees or final verification to shorten checks. Avoid broad unrelated performance work in the calculation foundation.

## Acceptance boundary

The offline foundation may be called tested and independently reviewed only for its exact files. It cannot satisfy product P01–P10. Full M77 remains open until persistence, equipment reconciliation, UI, integration/security/accounting QA, migration/recovery, actual hosted demonstration and publication pass. End that product milestone with board feedback before M78. No inventory-completeness, method-release, legal-compliance or assurance claim is authorized by this document.
