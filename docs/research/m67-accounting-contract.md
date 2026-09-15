# M67 accounting contract — 2023 manual electricity coverage

September 14, 2026, America/Los_Angeles. Policy `m67-accounting-policy-v1`; proposed accounting profile `manual-synthetic-2023-camx-monthly-kwh-v1`. **Approved bounded design/numerical contract for implementation, subject to independent implementation acceptance.** The board accepted M66 and authorized full-year coverage. Root's CPO brief `docs/research/annual-electricity-milestone-67.md` governs: at least one entered month is required to save. Preliminary discussion permitting all-null persistence is superseded. Parked M67 annual preparation is an unapproved stale draft, not authority for this contract.

Reviewer: M67-ACCOUNTING, requested critical Astra/high; actual inherited settings unknown. This reviewer authored M64–M66 accounting contracts and expected cases but no product implementation. This is internal synthetic design validation, not professional accreditation, factor release or assurance. Runtime/source/board notes record past observations; this review does not claim a fresh live tenant read.

## Boundary and evidence basis

One fictional facility under a declared operational-control boundary; grid-delivered purchased electricity consumed by the reporting company; United States / California / explicit CAMX; January 1–December 31, 2023; location-based Scope 2 only. CAMX is a declared condition, not inferred from California or a label. No new year, factor, market-based method, upstream/loss addition, Scope 1/3 or additional facility is authorized.

M67 annual entries are **synthetic manual entries without linked bills**, represented by a server-bound evidence basis such as `synthetic_manual_without_linked_bills`. Do not import M66 source IDs, January PDFs, confirmation actors/times, discrepancy explanations, review decisions or evidence claims into this annual profile. Keep M66 independently available. Even if a user manually copies the same January quantity, M67 records a new manual assertion, not M66 evidence-backed lineage. Neither approved M66 PDF supports February–December, and M67 must not imply that it does.

Required wording: **Annual entries are manual and have no linked bill evidence. The separate January bill-linked worksheet does not provide evidence or approval for this annual worksheet.** Do not change old M63–M66 records, profiles, decoders or report bytes to add annual scope. The annual policy/profile is additive; existing factor/method pins remain fixed.

## Exactly twelve month slots

The request contains exactly twelve chronological, unique rows from `2023-01` through `2023-12`. Each row has an explicit `month` and `quantityKwh`, where quantity is either a strict M64 decimal string or JSON null. Reject missing/duplicate/extra/out-of-order months, wrong year, omitted quantity field, unsupported units/geography/profile and additional unsupported row fields. A nullable row is present in the twelve-row grid; it is not an omitted month record.

For each non-null quantity use the complete M64 grammar: ASCII full-string `(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,3})?`, exact range `0 <= kWh <= 1000000`, maximum three fractional places, maximum eleven characters before canonicalization. No signs (including negative zero), exponent notation, separators, whitespace/newlines, Unicode digits, JSON numbers, booleans or coercion. Canonicalize each entered quantity to three fractional places and each monthly MWh value to six; never round an invalid input into acceptance.

UI blank maps deliberately to JSON null. API empty string is invalid. Null means **Not entered**, not estimated, excluded, not applicable, reviewed or zero. Explicit `0` is an entered manual zero assertion with canonical `0.000 kWh`, exact emissions `0`, display `0.0000 kg CO2e` and counts as an entered month. A missing row's quantity/emissions stay null or visibly `Not entered`; do not display numeric zero for it.

**All twelve null:** an unsaved UI empty draft only. Save must refuse before creating a version, calculation, report or success audit event. There is no persisted all-null report/review workflow. At least one non-null month, including explicit zero, is required. A correction that removes the last entered month also refuses atomically and preserves the existing version.

## Coverage is not inventory completeness

The server derives `coverage.knownMonths` as the number of entered months (1–12 in saved versions), `coverage.missingMonths` as the ordered list of null months, and `coverage.electricityComplete` as true exactly when all twelve quantities are non-null. `knownMonths` is a schema name for entered quantities, not evidence that they are verified.

| Coverage | Required interpretation and result label |
| --- | --- |
| Unsaved 0/12 | `No months entered — no subtotal. Enter at least one month to save.` |
| Saved 1–11/12 | `Entered-month electricity subtotal`; show `X of 12 months entered`, each missing month, and `This subtotal excludes months not entered.` Do not label this a full-year total. |
| Saved 12/12 | `Full-year electricity subtotal — all 12 months entered`; this establishes month coverage for this one fictional electricity activity only. |

All cases retain **overall company inventory incomplete**, outer `complete=false`, `releaseEligible=false`, synthetic/manual classification and no assurance. Twelve entered zeros satisfy period coverage but do not establish accurate evidence, actual zero annual use, complete facilities, complete Scope 2 or a complete company inventory. Other facilities/sources, market-based Scope 2 and Scope 1/3 remain unassessed. Missing periods must never be silently filled with zero or annualized from entered months.

## Numerical policy and bounds

Apply the same pinned **annual 2023 regional average factor** to each entered month's consumption; it is not a month-specific factor. Never prorate by days/month length or twelve, infer missing months, or annualize partial consumption. Use each entered monthly quantity once, then sum exact values before display rounding.

```
monthly_MWh[i] = monthly_kWh[i] / 1000                 # only entered months
monthly_exact_kg[i] = monthly_MWh[i] * 195.0402888
sum_kWh = sum(monthly_kWh[i] for entered i)
sum_MWh = sum_kWh / 1000
subtotal_exact_kg = sum(monthly_exact_kg[i] for entered i)
                 = sum_MWh * 195.0402888
subtotal_display_kg = ROUND_HALF_EVEN(subtotal_exact_kg, 4 fractional places)
```

Each monthly display may independently round its own exact value to four places. **Never sum monthly displays to calculate the annual/entered-month display.** Required report note: **The subtotal is rounded after summing exact monthly values. Displayed monthly amounts may not sum to the displayed subtotal.** Preserve every exact monthly value and the exact aggregate in lineage, even when presentation summarizes them.

The per-month 1,000,000 kWh ceiling is an existing synthetic product constraint, not an EPA limit or materiality rule. With twelve slots the derived aggregate maximum is **12,000,000.000 kWh = 12,000.000000 MWh**, exact/display **2,340,483.4656 kg CO2e**. Do not reuse the one-month ceiling for the aggregate. A supplied aggregate is never authoritative; derive it and refuse any contradictory claimed total.

Use exact Decimal/integer arithmetic throughout, with at least 40 significant digits if using a Decimal context (the existing 96 suffices). A valid aggregate may require eight integer digits in kWh and seven in kg CO2e, with up to thirteen fractional digits in exact kg CO2e. This exceeds previous display/input widths and must pass storage, JSON/API and frontend checks unchanged. Preserve fixed three-place aggregate kWh/six-place MWh, plain exact emissions strings without insignificant fractional zeros (`0` for zero), and fixed four-place display strings. No binary floating-point emissions calculation or intermediate division rounding is approved.

Independent integer reconstruction: let `n` be the sum of entered integer milli-kWh. Exact kg CO2e equals `n * 1950402888 / 10^13`. For four-place display, divide `n * 1950402888` by `10^9`; increment the integer quotient only if the remainder exceeds `500000000`, or equals it and the quotient is odd. Aggregate `n` is at most `12000000000`. Distinguish this exact-integer calculation from the much smaller one-month numeric validators.

## Retained primary authority

Method ID/version remains `scope2-location-based-egrid-subregion` / `2023-r2-camx-v1`; factor `epa-egrid2023-r2-camx-total-output` / `eGRID2023-revision-2`, exactly `195.0402888 kg CO2e/MWh`. The new annual adapter uses its own M67 policy/profile identity rather than claiming the old January input profile accepts annual data.

- [EPA eGRID2023 revision-2 metric workbook](https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_metric_rev2.xlsx), `SRL23!AI6`; `A6=2023`, `B6=CAMX`, `C6=WECC California`; annual total-output CO2e rate. Retained local workbook SHA-256 was rechecked during this assignment: `3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab`.
- Candidate SHA-256 `8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356`; GWP policy SHA-256 `fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5`; reviewed original engine SHA-256 `4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c`.
- AR5 100-year without climate-carbon feedbacks: CO2 1, CH4 28, N2O 265. [EPA technical guide, printed page 12, section 3.1.1.2/Table 3-1](https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf).

The source cells/guide were independently inspected in preceding M64/M66 work. Current code pins and the retained workbook digest were rechecked here. Existing reviewed normalization from raw XLSX `195.04028880000001` to candidate `195.0402888` remains unchanged. This is reuse of a historical candidate, not a latest-edition/current-law/source-release claim. Do not substitute a sum of rounded gas columns for AI6 or claim that calculation precision measures source uncertainty.

## Whole-year versions, correction and review

Every saved annual version freezes all twelve rows, canonical quantities/nulls, monthly exact/display results, derived coverage, exact/display aggregate, fictional labels, evidence basis, policy/factor pins, actor/time and hashes. A correction creates a new whole-year immutable version with a nonblank safe reason and an explicit predecessor. Changes from null to zero or zero to null are material even if the aggregate remains zero. Moving the same quantity between months is a material input change even if coverage count and aggregate are unchanged.

Compare the complete supported effective-input tuple for no-op rejection: both labels and all twelve ordered canonical month/null values, plus any additional supported asserted field identified by the technical contract. Formatting-only differences, a fresh idempotency key, or a changed correction explanation alone do not create a changed worksheet. Actual label-only or single-month corrections must pass both server and frontend and receive new review. Equivalent retries converge; stale competing edits refuse rather than overwriting history.

A different authorized manager may accept a saved partial or full-period version for **bounded internal use**, with explicit acknowledgment of its manual/no-bill status, actual entered/missing coverage and overall-incomplete limitations. Acceptance does not complete missing months or verify manual values. All-null cannot be reviewed because it cannot be saved. Every corrected annual version starts unreviewed, including a quantity reallocation, zero/null coverage change or label-only edit; historical acceptance does not transfer.

Reports freeze the exact annual source and captured worksheet decision, including absence, as in M65/M66. Later review/correction cannot change earlier report bytes. Required wording: **This is a snapshot of a worksheet decision, not approval of the report presentation, verification of manual inputs or assurance.** Board milestone acceptance is not a manager decision. No annual report may inherit a January-only decision.

## Independently derived cases

`evaluations/research-qa/m67-accounting-cases.json` contains complete twelve-row input vectors, expected monthly/aggregate values, coverage and refusal cases. It is public engineering evidence, not a held-out evaluator corpus. Expectations were derived using standalone Python Decimal at precision 96 and independently cross-checked with integer quotient/remainder rounding, without importing the product calculator.

| Case | Entered months | Aggregate kWh | Exact subtotal kg CO2e | Display kg CO2e | Sum of monthly displays |
| --- | ---: | ---: | ---: | ---: | ---: |
| All missing | 0 | No saved value | Save refuses | No subtotal | Not applicable |
| January 25000, rest missing | 1 | 25000.000 | 4876.00722 | 4876.0072 | 4876.0072 |
| January 25000, rest explicit zero | 12 | 25000.000 | 4876.00722 | 4876.0072 | 4876.0072 |
| Twelve months of 25000 | 12 | 300000.000 | 58512.08664 | 58512.0866 | 58512.0864 |
| Twelve explicit zeros | 12 | 0.000 | 0 | 0.0000 | 0.0000 |
| January zero, rest missing | 1 | 0.000 | 0 | 0.0000 | 0.0000 |
| Twelve months of 1 | 12 | 12.000 | 2.3404834656 | 2.3405 | 2.3400 |
| Twelve months of 0.001 | 12 | 0.012 | 0.0023404834656 | 0.0023 | 0.0024 |
| January 62499.999 + February 0.001, rest zero | 12 | 62500.000 | 12190.01805 | 12190.0180 | 12190.0181 |
| January 187499.999 + February 0.001, rest zero | 12 | 187500.000 | 36570.05415 | 36570.0542 | 36570.0542 |
| Twelve monthly maxima | 12 | 12000000.000 | 2340483.4656 | 2340483.4656 | 2340483.4656 |
| Twelve months of 999999.999 | 12 | 11999999.988 | 2340483.4632595165344 | 2340483.4633 | 2340483.4632 |
| Jan 12345.678, Mar 1.230, Apr 0, others missing | 3 | 12346.908 | 2408.1445021070304 | 2408.1445 | 2408.1445 |

The 25,000 January quantity is a synthetic acceptance example matching the quantity in root's prior M66 observation; it does not import or authenticate that live record. The contrast between 1/12 and 12/12 with identical numeric totals is intentional: hashes, coverage labels and review obligations must reflect the different month assertions.

## Required implementation evidence and limits

- **L02:** Reconstruct all month/null values, coverage and totals from source rows, not claimed aggregate hashes; challenge coordinated row/coverage/total/hash tampering. Root/publication QA must compare exact staged and committed blob hashes with accepted evidence, including line-ending policy. Filesystem-only review does not prove publication identity.
- **L06:** Exercise null-to-zero, zero-to-null while another month remains entered, clearing the final entered month (refuse), changing only one label, redistributing quantities without changing total, and complete-to-partial corrections through actual persistence/frontend decoders. Preserve historical reports/reviews and reject true canonical no-ops.
- **L07:** Persist both aggregate half-even ties, minimum quantities and the maximum neighbor through the actual native PostgreSQL driver, then API/frontend decoders, in CI. A Decimal/PGlite/unit pass alone does not establish that boundary; M64's intermediate numeric division defect must not recur.

Actual screen/report/print must show all twelve rows, missingness, exact/display totals, coverage scope, manual/no-bill evidence basis, candidate/source locators, immutable source/review fingerprints and repeated **Draft · Synthetic · Incomplete company inventory · Unreleased · No assurance**. Broad security, hosted/native runtime, printed-page layout, publication and professional assurance are outside this design validation. No product/cloud/Git changes were made by the accounting reviewer.

## Coordinated technical-contract disposition

The accountant reviewed `docs/research/m67-technical-contract.md` at SHA-256 `df9c3ab8b1911b0c2ac6bee08bb72d41bba63eb73e47d37e1c466f7e8ed17dd2`. **Its proposed types, one-or-more-entered save rule, monthly null/aggregate non-null distinction, exact sum/rounding, annual bounds, coverage flags, manual evidence basis and correction/review semantics agree with this accounting contract.** The nine proposed limitation codes are approved for their stated meanings: synthetic manual input; no linked annual bills; overall incomplete inventory; calendar-2023/CAMX/single-facility scope; missing months not zero; market-based Scope 2 excluded; candidate factor/method unreleased; Scope 1/3 unassessed; no assurance. The UI must still display the actual count/list of missing months when obtaining bounded acceptance.

The independent case artifact SHA-256 is `06ab494cc6cba1cbfbc5808517f990743ceb33e2531611d50fab5d9b5224956c`: twelve accepted vectors with 144 explicit month slots, 23 refusal cases and eight lifecycle expectations. All accepted aggregate values match standalone exact monthly summation and integer rounding. This disposition is design validation of accounting semantics, not executed verification of SQL canonicalization, row-level authorization, concurrency, restore, browser behavior or the future implementation. Those remain independent QA gates.

Independent QA found a first-review fixture-text defect: the Windows script input encoding produced a mojibake dash in the full-year subtotal labels. The same issue affected the adversarial Unicode-digit specimen. Expected labels were repaired to U+2014 and the digit to U+0661 using explicit codepoints; both were re-read as UTF-8 before final binding. Numeric values were unchanged. This first-review artifact defect is retained here rather than described as a first-pass acceptance.
