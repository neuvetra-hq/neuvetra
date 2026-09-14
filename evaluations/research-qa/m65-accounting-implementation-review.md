# M65 independent accounting report implementation review

September 14, 2026. **PASS for the reviewed numerical rendering, report wording and captured worksheet-review semantics.** Actual rendered print pages, hosted PostgreSQL/browser, broader security/concurrency, M63 preservation, publication and deployment remain separate acceptance gates. This review does not close M65 or provide professional assurance.

Executor: reused M64 accounting-validation context. Requested critical compute Astra/high; inherited runtime settings unknown. This reviewer authored M64/M65 accounting contracts and public expected cases, but no M64/M65 product calculator or report renderer. The implementation review is independent of product authorship; contract authorship is disclosed rather than represented as separate independent review of that contract.

## Exact delivered evidence

| Artifact | SHA-256 |
| --- | --- |
| `packages/neuvetra-database/src/m65.ts` | `880ec7c889e0c60f0efa2abf3eef849950d32dbccdeff0516c32c66016f6d911` |
| `packages/neuvetra-database/src/m65-template.ts` | `6b1e4a084cf6841224040cbf10228380b8cd345b2012f876082d73313ecc8931` |
| `packages/neuvetra-database/src/m65-contract.ts` | `61f2debef54cea1c7d4553b6ce60b8166483e6016e4b932a4c9c21c10bae9a89` |
| `packages/neuvetra-database/src/migrations/0011_worksheet_reports.sql` | `821fcbd2601f21f7fa74370ef13e62a2941399d68b4774f0e09ffb09fe1ee983` |
| `evaluations/research-qa/m65-accounting-renderer-check.ts` | `62d760c670fa1f24d3879cac017b88536499d76adad0c79d0e73ed08fc366e32` |
| `evaluations/research-qa/m65-accounting-renderer-results.json` | `402f9b77131133b5dfaa2600816a1ad6d5ac8600c5df027f7a78d68b4e5943b5` |
| `evaluations/research-qa/m65-accounting-v4-fixture.html` | `926c147ceede15fd969b2b97e35aa1c2ee073dbb3d0bcea6770392b5911eb482` |

Table hashes identify raw local bytes. Migration 0011 contains CRLF locally; its canonical LF digest is `9032e4ae40eb3e7e04b9329dca5c2bbafc52197a94742cd7a3720a055cd06fb0`, matching the CTO publication-oriented identity. No semantic change is implied by that line-ending normalization.

The HTML fixture uses the board's 25,000 kWh quantity with invented report/source identities. It is not a downloaded copy of the board's live Version 4. Its source version number is an independent fixture number; do not present it as hosted Version 4 evidence. The result JSON records every rendered report hash and the four exact implementation hashes. Re-running the persisted checks generates fresh synthetic IDs/timestamps and therefore different persisted report hashes; preserve this receipt if making a later run.

## Checks executed

Command: `bun run evaluations/research-qa/m65-accounting-renderer-check.ts`, runtime Bun 1.3.12. Result: **21 direct rendered report cases, 14 actual persisted/downloaded reports, seven historical reports unchanged**. The first group crosses seven independently derived numerical expectations with three review states: absent, bounded acceptance and changes requested.

The script consumed the approved independent expected strings rather than importing an arithmetic calculator to derive them. It verified canonical kWh/MWh and exact/displayed kg CO2e for 25,000, 12,346, zero, 0.001, both half-even ties and the 62,499.999 precision-regression neighbor. In particular, 25,000 kWh appeared as `25000.000 kWh`, `25.000000 MWh`, exact `4876.00722 kg CO2e`, displayed `4876.0072 kg CO2e`; the renderer never recalculated those values.

Direct rendering also checked required boundary/qualification text, full source/candidate/GWP fingerprints, resolved placeholders, label/correction/note escaping including `<script>`, quotes, ampersands and template-like braces, no executable/active-resource elements, report-byte hash agreement and deterministic repeat rendering. Print header/footer containers were present; this is structural evidence only, not proof that a browser repeats them on every rendered page.

The persistence group used the real local PGlite application migrations and public worksheet/report save/read/download methods. For each of seven quantities it saved a source, created/downloaded an absent-review report, recorded a different manager's accepted or changes-requested worksheet decision, and created/downloaded a new report capturing that decision. New decision snapshots had distinct report IDs/byte hashes. After all subsequent decisions/corrections, the seven original absent-review reports reopened with the same complete bytes/hash and absent-at-capture state. The tests used only invented local company/facility/actor data and closed the in-memory database afterward.

## Wording, source and hash disposition

The report calls the result a January location-based subtotal, shows the annual 2023 regional factor applied to January consumption, declares the operational-control/location-based and CAMX boundaries, and explicitly excludes annual completeness. Manual fictional input is not represented as bill evidence. Februaryâ€“December and other facilities/sources are outside assessed coverage, with missingness distinguished from zero; market-based Scope 2 and Scope 1/3 remain excluded.

Each review state uses the approved **Worksheet review captured for this report** language. It identifies the exact source and decision references, manager and UTC decision/capture times, and explicitly says the worksheet decision is not approval of the report presentation or assurance. Absent review is stated as absent at capture rather than permanently absent. Changed snapshots do not rewrite the earlier report. Board milestone acceptance is not inserted as a manager decision.

The exact existing factor/method IDs, source cell `SRL23!AI6`, workbook/candidate/GWP hashes, AR5 100-year policy and official EPA source/guide hyperlinks are present. Candidate normalization is disclosed as retained. No new factor release, method selection, gas-component sum or accounting coverage was introduced. Full four-place half-even wording and the distinction between decimal precision and measurement certainty are visible.

The hash presentation is accepted: the document embeds a **snapshot identity fingerprint** expressly binding source/review/template identity, and the template fingerprint; the authenticated receipt/header carries SHA-256 of all UTF-8 HTML bytes. The HTML does not claim to embed its own full-byte hash. It expressly separates browser print/PDF bytes and layout from the HTML hash and does not promise that its selected source remains the latest worksheet. This avoids self-referential hash claims and false PDF reproducibility.

## Preserved first-review finding and limits

Independent QA first reported unresolved fingerprint placeholders caused by an alphabetic-only substitution expression that omitted the digits in `Sha256`. That finding belongs to QA's first-review record (M65-QA-F01); this accounting review does not claim to have discovered it. The reviewer saw the original expression in source, then executed all final checks after CTO's alphanumeric replacement/guard repair. Final rendered cases contain the actual required hashes and no unresolved placeholders. The failure must remain in the milestone record rather than being erased by this pass.

During final hash reconciliation, independent QA identified a further review/report concurrency chronology defect and CTO appended an additive replacement of the review function to migration 0011. New review and audit timestamps now use one millisecond-truncated wall-clock capture after acquiring the company lock, instead of transaction-start time; existing reviews and original migration 0010 remain unchanged. The accountant inspected that delta and reran the complete 21-render/14-persisted/seven-historical check successfully against the final migration hash above. The original run receipt is retained as `m65-accounting-renderer-results-initial.json` (SHA-256 `812570dca2e90b32f233e70d9cda1a90d88779947efca44f2c9b3f9d272c7236`). The accountant did not independently reproduce the blocked concurrent transaction; QA owns that distinct challenge and its first-review finding.

No additional material accounting implementation finding remains for the exact reviewed bytes. This reviewer did not inspect actual printed pages or operate the hosted browser, did not exercise a live PostgreSQL connection, and did not certify general security, concurrent authorization or historic M63 immutability. Those checks remain with root and independent integrated QA. Product edits, Git, cloud changes and factor changes were not performed by this assignment.
