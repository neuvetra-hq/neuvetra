# M67 independent accounting implementation review

September 14, 2026, America/Los_Angeles. Review status: **bounded accounting implementation review passes for the artifact digests below.** Actual TypeScript and isolated SQL helper arithmetic, rendered report values and report wording pass; native integration and actual print layout remain separate gates. This is not milestone release approval.

Reviewer M67-ACCOUNTING authored the M64-M67 accounting contracts and public expected cases, but no annual product implementation. Requested critical Astra/high; actual inherited settings and resource consumption unknown. This is internal synthetic accounting validation, not professional accreditation, factor release, verification or assurance. Only this review and accounting evidence were written; product, cloud, Git and shared operational records were not changed.

## Contract and independence

The accepted accounting contract SHA-256 is `299405d311f009aaebd8dffa8e213d74511297236f426c550f87cf3fd484b2f1`; independent cases SHA-256 is `06ab494cc6cba1cbfbc5808517f990743ceb33e2531611d50fab5d9b5224956c`. Neither was changed during implementation review. The cases were independently derived using Python Decimal and integer rational arithmetic before implementation. Comparing the product with these public cases does not claim a held-out evaluation. No new sources or current-law claims were introduced.

## Actual executed checks

- `evaluations/research-qa/m67-accounting-implementation-check.ts`: actual exported TypeScript annual calculator matched all 12 accepted vectors, including all 144 monthly slots, exact and displayed monthly/aggregate values, fixed quantity representations and derived coverage. All 23 input refusal vectors rejected through the actual input validator. The actual frontend decoder accepted every valid vector and refused eight appended-newline challenges to monthly/aggregate quantity and emissions fields. Receipt: `m67-accounting-implementation-first-receipt.json` in the same directory, with exact reviewed file digests.
- `evaluations/research-qa/m67-accounting-sql-check.ts`: actual arithmetic helper functions extracted unchanged from migration 0013 were loaded into a separate in-memory PGlite database. All 12 accepted vectors and 144 month results matched the independently derived expected objects. The helpers use exact numeric multiplication, integer quotient/remainder and half-even rounding. The helper substring SHA-256 is `b59a4df24a358fcd42aa833ffb6c082660e6c7aa54bed95827ebe4c1822bcb90`; the tested draft migration SHA-256 was `d8f0d2acf749012bb1ae87d522e174d4c881fb9ee466afafd4fd8194c52ffc26`, unchanged during this run. Receipt: `m67-accounting-sql-receipt.json`. This was not full migration, native PostgreSQL driver, persisted workflow or role authorization execution.

The January-only 25000 example produced exact `4876.00722` and displayed `4876.0072`, with 11 missing months. Adding eleven explicit zeros left these numbers unchanged but correctly produced 12 entered months. Twelve minimum quantities produced exact `0.0023404834656` and aggregate display `0.0023`, although displayed monthly values sum to `0.0024`. The aggregate ties produced `12190.0180` and `36570.0542`. Twelve monthly maxima produced `12000000.000 kWh`, `12000.000000 MWh` and `2340483.4656 kg CO2e`. The maximum neighbor retained exact `2340483.4632595165344`, displayed `2340483.4633`, rather than the rounded-month sum `2340483.4632`. Explicit zero remained distinct from null, and all-null input refused.

## UI and report source inspection

Read-only inspection of `AnnualElectricityWorksheet.tsx`, `AnnualWorksheetReports.tsx`, `m67-api.ts` and `m67-report-api.ts` found the current accounting presentation consistent with the contract. Blank UI values deliberately map to null; the empty draft save action is disabled; monthly input help states the one-million/three-decimal constraint. Saved rows display `Not entered` for missing input, while canonical zero is displayed numerically. Saved partial totals are labeled entered-month subtotals. A full-year label appears only with 12 entered months and a nearby statement that the company inventory remains incomplete. The twelve-row table and sum-before-rounding explanation remain visible for both states.

The UI states that annual entries are manual with no linked bill evidence and the separate January worksheet provides neither evidence nor approval. A different manager reviews the exact saved version and acknowledges the actual missing-month limitations. Report controls describe frozen review state and no separate report approval. Hash verification refers to saved HTML bytes; browser print instructions do not promise identical PDF layout or bytes. These observations are source inspection, not browser execution or native print proof.

The draft report template contains the exact manual/no-bill separation, month-coverage scope, sum-before-rounding explanation and manager-decision qualification required by the accounting contract. It renders all twelve months with input state, canonical kWh/MWh, exact emissions and display emissions; includes retained factor/source/GWP/engine locators; and repeats draft/synthetic/incomplete/unreleased/no-assurance status in print margin rules. The actual generated reports were subsequently executed and checked as recorded below.

## First observations and disposition

1. The initial UI inspection showed mojibake punctuation and was reported to root. Root independently reported an earlier QA finding and repaired copied strings. Fresh explicit UTF-8/codepoint inspection confirmed correct ellipsis, middle dot, apostrophe and dash, and no current defect. Initial before-repair bytes were not archived by this reviewer; the current accepted digests bind the repaired candidate. This is not described as a clean first pass or a surviving accounting blocker.
2. During authoring, `m67-report.ts` temporarily contained a malformed `Object.prototype.function hasOwnProperty()` replacement guard. This was flagged to CTO before executing the renderer; the candidate had not been declared stable. CTO repaired the guard, then this reviewer executed all 36 report combinations successfully. The repaired renderer digest is bound below. Template prose itself showed no accounting-semantic blocker.

## Remaining gates

L02 requires independent source/hash reconstruction and staged/committed identity reconciliation. L06 requires persisted single-label, month-reallocation and null/zero correction workflows through the actual frontend; the inspected effective-input comparison preserves these distinctions. L07 requires actual native PostgreSQL driver persist/read coverage for ties, tiny quantities and the maximum neighbor in CI. Those integration checks are QA/CTO ownership, not established by the isolated helper pass.

Root must demonstrate actual screens and native printed pages, including all twelve rows and repeated qualifications without clipping or overlap. This reviewer has not exercised hosted tenants, native printing, restore, concurrency, publication or current operational availability. Bounded arithmetic correctness does not establish evidence sufficiency, a complete company inventory or a released accounting method.

## Final renderer execution and bounded disposition

`evaluations/research-qa/m67-accounting-report-check.ts` executed the actual exported `buildAnnualWorksheetReport` using expected source values constructed directly from the independently derived cases, not from the product calculator. All **36 combinations** passed: twelve vectors in each of unreviewed, accepted-for-bounded-use and changes-requested states. Checks inspected **432 rendered monthly rows**, aggregate exact/display strings, canonical kWh/MWh values, null versus entered zero, scoped partial/full labels, all required qualifications, workbook/candidate/GWP/engine digests, escaped change-request text, resolved placeholders and deterministic repeated UTF-8 bytes. The HTML byte hashes matched independent rehashing. This is executed HTML generation and literal-content inspection, not native page rendering.

`evaluations/research-qa/m67-accounting-report-receipt.json` preserves the first executed report check. `m67-accounting-report-final-receipt.json` and `m67-accounting-implementation-final-receipt.json` record the final targeted reruns and current artifact binding. Each report receipt records every report hash and byte length. Three generated byte-exact samples are retained as `m67-accounting-report-january_25000_partial.html`, `m67-accounting-report-twelve_minimum.html` and `m67-accounting-report-twelve_below_maximum.html` in the same evidence directory. These are independently constructed synthetic engineering samples, not tenant records.

The report header correctly distinguishes the 1/12 January subtotal from the 12/12 full-year subtotal even when the numeric answer is identical. The all-zero report has twelve entered-zero rows and no missing months, while the one-zero partial report retains eleven missing rows. The full-year report states period coverage for this fictional facility and company incompleteness. The exact manager-decision qualification remains present in every review state, and no M66 bill evidence or approval is inherited. The report identifies the annual factor as the same regional annual average applied to each entered month, with no inferred, prorated or annualized missing quantities.

A post-run digest check detected an intervening author edit to `m67.ts`. CTO identified the change as replacing `versions.at(-1)` with `versions[versions.length-1]` for the package TypeScript target; no arithmetic or input-policy change. The first receipts were preserved, and both the calculator/input/decoder and all 36 renderer combinations were rerun successfully before binding the current candidate. The final files were then rehashed and matched the supplemental receipts.

No open accounting-semantic defect remains in the bounded candidate. This disposition does not close QA's native persistence, authorization, concurrency, restore or committed-blob checks, or root's actual browser/print demonstration. The approved contract and expected-case artifacts remain unchanged.

### Exact file binding

The report-template UTF-8 content pin is `7af3039e0a9b9e6a013013e1e274d805e685b500a6eb305079ef2c0f052e13ff`. File digests below describe the candidate verified by this reviewer and were rechecked unchanged after execution. A later edit requires a targeted comparison or recheck; the draft full migration hash in the isolated-helper receipt does not approve unrelated migration changes.

| File | SHA-256 |
| --- | --- |
| `docs/research/m67-accounting-contract.md` | `299405d311f009aaebd8dffa8e213d74511297236f426c550f87cf3fd484b2f1` |
| `evaluations/research-qa/m67-accounting-cases.json` | `06ab494cc6cba1cbfbc5808517f990743ceb33e2531611d50fab5d9b5224956c` |
| `packages/neuvetra-database/src/m67-contract.ts` | `359fd19312980632339e0c57e6e0ce42fb283648508804908d3370a00a4de9e3` |
| `packages/neuvetra-database/src/m67.ts` | `8779f5654db92b81326cf2f7b5718a365212233290590bfce0193a284af06519` |
| `packages/neuvetra-database/src/m67-report.ts` | `d40ae347acbaaf8e65a357a84103e68ef3ca5f5d54a961b4510c45e7af75b087` |
| `packages/neuvetra-database/src/m67-template.ts` | `18a2e1650223d83b9525339137125ff9f614e2574835bb94a4178f9e296ac807` |
| `apps/site-web/src/components/AnnualElectricityWorksheet.tsx` | `5a28ee829258cff878aa611ab664824ab1ff73473c75146e9ebf1bf992326ddc` |
| `apps/site-web/src/components/AnnualWorksheetReports.tsx` | `b652d485ee8fa3991aad62090b218667eaef1c56a8c2d3baf50f3627261822eb` |
| `apps/site-web/src/lib/m67-api.ts` | `6718402c1013a6ebc2adee34d02a4a671f29f29e81d003c8e685508ed893dde2` |
| `apps/site-web/src/lib/m67-report-api.ts` | `339c34280707c66257a40e18717bbe27ecf008ace9c527e8a2fb627879043e44` |
| `evaluations/research-qa/m67-accounting-report-check.ts` | `7b8d01eaaf471d61ea174cdc99dd2ebc53ed6b961086bdd9e3a4ebe9f615ce0a` |

Reproduction from repository root: `bun run evaluations/research-qa/m67-accounting-implementation-check.ts <new-receipt-path>`, `bun run evaluations/research-qa/m67-accounting-sql-check.ts <new-receipt-path>` and `bun run evaluations/research-qa/m67-accounting-report-check.ts <new-receipt-path>`. Use new receipt paths to preserve the original observations. The report harness also deterministically rewrites its three generated samples; retain earlier samples before testing a changed template.
