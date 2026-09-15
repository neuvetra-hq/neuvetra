# M73 independent accounting review

Date: 2026-09-15. Assignment: M73-INDEPENDENT-ACCOUNTING. Reviewer: `/root/m73_independent_accounting`; functional sponsor QA, handoff to CEO coordinator. No M73 implementation, contract or fixture authorship. Requested critical compute route: gpt-6-astra/high; actual applied model/effort, tokens and cost are not observable and remain unknown. Role prompt SHA-256: `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`.

## Disposition

**Pass for the bounded synthetic accounting scope of frozen candidate2.** Candidate1 arithmetic and retained accounting lineage passed, then candidate2's exact changed files and uniquely pinned native outputs passed the targeted follow-up. No accounting defect was found in the tested profile. This approves neither method/factor release, a complete Scope 1 inventory, SB 253 compliance nor external assurance. The reviewer made no database, deployment, implementation or common-ledger changes. Independent QA/security, browser/print, publication and board demonstration remain separate gates.

## Exact reviewed evidence and sequence

- Reviewed worktree: `C:/Users/nimab/.codex/worktrees/4441/Neuvetra`; coordinator supplied base `ac359261d53d1800a8a64f3183c15a92c42572aa`, with an uncommitted M73 candidate. Commit/publication validation remains the coordinator's gate.
- Candidate1 bundle `operations/agent-improvement/snapshots/M73-INTEGRATED-CANDIDATE1.json`: SHA-256 `383ad6db367ec3dbfaac80c0279afad7b00917c5a053be8e5efd8b4210ffb1a5`. All 26 listed current file hashes matched during this review.
- Candidate1 SQL0016: `e98ca39c7dac074406b39a94b6e6b65519534ac55ff6cd8282aa8f0bd522823e`.
- Python adapter: `e1b91d4fa6afa1126eeb642769c458d0b0b747c12ad5ee172543afb9246eaa14`; preserved M42 dependency: `eebade88f291cec281f38efe09597a107ce24904f28782d51405e739c4d37603`.
- Candidate1 native fixture, observed and checked before replacement: `.tmp/m73-native-fixture.json`, SHA-256 `cc10ea761865777c6b186ce45c037e984079b010f4b80bf9a4508cef8c59b69e`. It contained 11 versions and 10 calculations, including all assigned vectors. The immutable independent results artifact records this hash.
- The coordinator subsequently reported that the implementation owner overwrote the generic fixture path during candidate2 report tests. The original candidate1 database/reports were reported untouched. This reviewer does not treat the current generic path as candidate1 evidence; unique candidate2 paths/pins are required for the follow-up.

## Independent primary-source derivation

The retained original workbook was opened as ZIP/XML and hashed before comparing application calculations. No `docs/research/m73-accounting-fixtures.json` oracle was used. Workbook: `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-factors-hub-2025.xlsx`, SHA-256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`. Its single sheet is **Emission Factors Hub**; F3 records January 15, 2025.

| Meaning | Original cells | Independently read value |
| --- | --- | --- |
| Fuel | C38 | Natural Gas |
| Factors | E38, F38, G38 | 53.06 kg CO2/MMBtu; 1 g CH4/MMBtu; 0.1 g N2O/MMBtu |
| Factor units | E36:G36 | CO2 kg, CH4 and N2O grams per MMBtu |
| Heat/oxidation/boundary | C94, C95, C99 | HHV; full oxidation; combustion only, upstream excluded |
| GWP | E523:E526, C10, C556 | 100-year AR5: CO2 1, CH4 28, N2O 265 |

The live [EPA Hub](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) was checked on the review date and links the 2025 edition. The [EPA stationary-combustion guidance](https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf), December 2023, printed pages 5–9, corroborates multiplying energy by gas factors, converting CH4/N2O mass using GWP and separating purchased fuel from combusted fuel. Its section 3.1 describes supplier/distributor double counting, inventory changes, feedstock and losses. These sources support a bounded fossil-combustion method; they do not validate a customer's evidence or filing applicability. The retained workbook was rehashed; current remote workbook bytes were not downloaded/rehashed by this reviewer.

For Q MMBtu HHV, independently derive kg gas as `(Q × 53.06, Q × 1 / 1000, Q × 0.1 / 1000)`. Apply GWPs `(1, 28, 265)` and sum exact gas contributions. Thus exact kg CO2e is `Q × 53.1145`. Decimal precision 96 and half-even rounding of only the final display total preserve all supported inputs. Four displayed decimals express the product's display convention, not measured accuracy.

| Q MMBtu HHV | CO2 kg | CH4 kg | N2O kg | Exact total kg CO2e | Display kg CO2e |
| --- | --- | --- | --- | --- | --- |
| 1250.125 | 66331.63250 | 1.250125 | 0.1250125 | 66399.7643125 | 66399.7643 |
| 1500.125 | 79596.63250 | 1.500125 | 0.1500125 | 79678.3893125 | 79678.3893 |
| 0.100 | 5.30600 | 0.0001 | 0.00001 | 5.31145 | 5.3114 |
| 0.300 | 15.91800 | 0.0003 | 0.00003 | 15.93435 | 15.9344 |
| 999999999999.999 | 53059999999999.94694 | 999999999.999999 | 99999999.9999999 | 53114499999999.9468855 | 53114499999999.9469 |
| 0.000 | 0 | 0 | 0 | 0 | 0.0000 |
| null | Missing | Missing | Missing | No calculation | No zero substitution |

For 1250.125, the individual CO2e contributions are 66331.63250, 35.003500 and 33.1283125 kg. Every vector's full gas and CO2e intermediates are retained in the independent JSON artifact.

## Criterion evidence

| Criterion | Evidence and result |
| --- | --- |
| Original factors, GWP, units and context | Workbook hash/cell read above; method values in every native calculation agree with those original cells. Source/hash/current method pins are explicitly unreleased. |
| Actual deterministic engine | Read-only executable independently invoked the actual Python adapter for six quantity vectors, then replayed all 10 native calculations. Gas masses, gas CO2e, exact total, units, input/result hashes and half-even display agree. Invalid amount representations, above-maximum, negative, extra precision, fuel, heat basis, unit and period were refused. |
| Native maximum and tie quantities | Actual saved-output fixture includes maximum numeric value, both opposing half-even ties and corrected quantity. Independent oracle comparison passed for all gas components, not merely rounded display strings. This reviewer did not generate the native DB run; it inspected the retained public-route/native-driver test implementation and independently checked its output. |
| Missing and zero | Native missing version has null calculation and activity-missing finding. Zero version retains a zero-supporting statement, positive manual confirmation and explicit reason; display is 0.0000. Static admission checks refuse unsubstantiated numeric/zero claims. |
| Source and corporate boundary | Actual binding retains coverage version ID/hash, source/facility/entity and inclusion decision. TS resolver and SQL verify full-year2025 California operational-control context and source relationships. M71 validator requires each source's matching full-interval screening. This restricted profile is not a general operational-control rule or geographic completeness claim. |
| Evidence and discrepancies | All calculated native versions bind statement bytes/hash/length and source context to the actual engine input. 1500.125 entered versus 1250.125 stated retains the unresolved discrepancy and explanation. Distinct synthetic manual statements are explicitly not utility bills. |
| Duplicates | Static SQL unique company/source stream and current-head issuer+meter/year and issuer+reference/year guards; author native test contains a second-source same-statement rejection and new independent-statement acceptance. This is bounded label-based deduplication, not physical-meter verification, fuzzy duplicate detection or cross-issuer consumption reconciliation. No aggregation exists. |
| Corrections/reviews | Native predecessor IDs/hashes, complete effective input, correction reason and contributor chain agree. Separate reviewer is outside contributor set. Corrected version retains no inherited review. Original report still captures the original unreviewed source version after later review/corrections. |
| Replay and integrity | Actual adapter replay accepts native records and rejects both a forged exact total with recomputed result hash and a forged source pin with recomputed result hash. Stored report HTML and snapshot hashes/lengths and captured source content agree. This is accounting replay evidence; broader server tamper/security coverage belongs to independent QA/security. |
| Corporate coverage/unreleased semantics | Every retained version states synthetic, incomplete Scope1/corporate coverage, releaseEligible false, assurance none. Original HTML explicitly retains other sources/facilities/periods, Scope2, all15Scope3 categories, upstream exclusion and no filing/assurance determination. |

Applicable lessons: L02 (stored bytes and semantic replay) and L07 (native decimal boundary). L04 distinction is preserved: no independent browser/print/download interaction or independently executed database mutation is claimed here.

## Executable evidence and limits

`m73-accounting-independent-check.py` ran successfully against candidate1: **446 checks passed**, 11 native versions/10 calculations. `m73-accounting-independent-results.json` SHA-256: `daab7e45f8dd2d6571543d16a2586cf4a83c8d364dfdac5e5b23a631aacc24ef`. The results include the original cell values, independently derived vectors and exact criterion names. Subsequent harness changes add explicit snapshot/native path and hash arguments for candidate2; the candidate1 results remain unchanged.

The independently written `m73-accounting-independent-boundaries.test.ts` exercises source eligibility, unsupported profiles, missing/zero/discrepancy distinctions, duplicate source register, actual frontend decoders and report reproduction. Its first local attempt could not load the active-worktree module: `EPERM reading .../m73-validation.ts`, 0 passed and 1 unhandled error. This was a harness/execution limitation, not an application failure. The coordinator subsequently executed the reviewer's identical file under the active worktree: **5 passed, 0 failed, 46 assertions, exit 0**. Independent test authorship and verdict remain with this reviewer; execution was by the implementation coordinator. No native database writes were repeated by that test.

Report/test/results delivery is under `C:/Users/nimab/OneDrive/Documents/ChatGPT/Neuvetra/evaluations/research-qa/`, inside the reviewer's writable scope, for coordinator handoff. The active worktree is outside that write scope; no bypass was attempted.

## Candidate2 targeted acceptance

All 26 candidate2 live file hashes match `operations/agent-improvement/snapshots/M73-INTEGRATED-CANDIDATE2.json`, SHA-256 `2ba1377a9f7dab526072a042b9dcaaa9ca5c0d3c030773e07612afaebc121a47`. Exactly three entries changed from candidate1:

| Changed artifact | Candidate2 SHA-256 | Review |
| --- | --- | --- |
| `packages/neuvetra-database/src/m73-report.ts` | `7dc4da0b5967472626c3ad0acfc668888822a01ea6825695cab3505828ee398e` | Readable gas table, statement labels, optional explanation wording; full provenance remains in the appendix. |
| `packages/neuvetra-database/src/migrations/0016_stationary_natural_gas.sql` | `2f5489d37fdd59963d12e60947b8dddce34cc4e1dc4100813545b1c0dbb1c9b7` | Bundle diff confines changes to the report-rendering function. Calculation and admission logic are unchanged. |
| `apps/site-web/src/components/StationaryNaturalGas.tsx` | `4cfcfb04788bfba2cf7081dc41878d21d086f63bcc8f0654f26d3cf586684477` | Evidence presentation change; actual browser/visual acceptance belongs to separate QA. |

The unique candidate2 fixture `.tmp/m73-native-fixture-candidate2.json` independently hashes to `349b4242ceb481535abf1cebfead9d869bda7463d954e8d31b3dc43a2424c50f`. The complete source-derived executable recheck passed **447 checks**, 11 versions and 10 calculations. `m73-accounting-independent-candidate2-results.json` SHA-256 is `d6e5330a3e36f932044de591c3e35cc2cd59e278471b22c79fd99bd0a10431f4`. Candidate1's 446-check result and its original fixture hash remain unchanged historical evidence.

The original candidate2 report's visible HTML gas table was independently parsed, outside the hidden provenance appendix. Rows match the source-derived figures exactly: CO2 mass/CO2e `66331.6325`; CH4 mass `1.250125`, CO2e `35.0035`; N2O mass `0.1250125`, CO2e `33.1283125`. Report HTML/snapshot hashes, original unreviewed capture, complete provenance, exact subtotal and incomplete-coverage wording also pass. The coordinator-executed independent test reproduces the report with the actual renderer and validates it with the actual frontend decoder.

Execution receipt `.tmp/m73-accounting-test-execution.json` was independently rehashed to `9c86beb3f228f032c6ac88fdbf0dd580a323c258693b942d20d5afa3eeaa8604`. It binds the exact candidate2 snapshot, unique fixture and independent test SHA-256 `1a4652c8f3b0cc15f9973ddb99320be0adac2f728a589fe8ad688e8dd4eaf1f9`; the reviewer's original and copied active-worktree test have that same hash. This is independently authored testing executed by the coordinator because of the import restriction, not a claim that the reviewer reran the native writer.

Author native receipt `.tmp/m73-backend-native-evidence.json` independently hashes to `ca8fc41673af7af204f99dad86037d612103dbb759c5c25d8d51a505bf766c04`. It reports 3 passes/85 assertions in fresh isolated `m73_author_12` and identifies the unique candidate2 fixture. All its implementation-file pins match. The current native test has a later output-filename-only change: SHA-256 `c620274dc795b4fab0cb1132345d5c296709579c3c32f4f0dd91d33c69f3d10a`. Reversing only that filename expression in memory exactly reproduces tested SHA-256 `9226a45728c141eff7dedddf3b94d2d69eab7522dbd141b3aae9bdbd17c0e875`. This confirms the disclosed harness difference; it does not rewrite the historical execution receipt. The native receipt is author evidence, supported here by an independently derived check of its actual output.

Reproduction: run `m73-accounting-independent-check.py` with `--candidate` set to the reviewed worktree, `--workbook` set to the retained workbook, explicit `--snapshot`, `--snapshot-sha256`, `--native-fixture`, `--native-sha256` above and a new `--output` path. For the Bun boundary suite, set `M73_ACCOUNTING_CANDIDATE` to that worktree and `M73_ACCOUNTING_FIXTURE` to the unique candidate2 fixture, then run the independently authored test. Do not overwrite either historical results file or assume the generic native fixture path is frozen.

Next owner: coordinator for separate QA/security, browser/print/public-download evidence, staged/committed-byte equality, required checks, publication and demonstration. Any real-customer release additionally needs applicable source/method/rights review and qualified independent human accounting/assurance judgment. This synthetic annual source workpaper remains incomplete corporate coverage with no aggregation, no released method and no external assurance.
