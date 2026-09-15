# M73: first usable synthetic stationary natural-gas workflow

Prepared 2026-09-15. Task `M73-CPO`; sponsor CEO; author `/root/m73_cpo`. Requested role route: `gpt-5.6-sol` / `medium`; observed settings unknown. CPO role prompt SHA-256: `fe5237292aafa6fe307801d3d9d07414110d11dc6ecd7812ee52ed77feacb2e6`.

## Outcome and milestone boundary

An authorized inventory preparer can take one retained synthetic annual natural-gas statement for one stationary source, enter its activity against the exact saved corporate boundary, calculate a deterministic source subtotal, correct it without changing history, obtain a decision from a different manager, and open or download a readable exact-version report.

This is the first usable **stationary natural-gas source workflow** within the California-first synthetic corporate workspace. It is not “Scope 1 complete.” Its success must leave mobile combustion, fugitive emissions including refrigerants, process emissions, unassessed facilities and periods, and every other unresolved corporate coverage item visible. The result is one combustion-only source subtotal. It is never a corporate Scope 1 total, corporate inventory, SB 253 determination, production release or assurance conclusion.

The implementation reuses the M71/M72 private workspace, roles, visual language and saved corporate coverage history. It reuses M42 arithmetic under a new persisted adapter without changing or broadening the literal M42 demonstration contract. M42's factor, GWP and method remain development candidates: extraction/method approval and factor-release rights remain unresolved, runtime release stays false, and no source or method release follows from M73.

The candidate source and numerical boundary is grounded in the separately authored [M73 accounting contract](m73-accounting-contract.md) (SHA-256 `925ddba8b37048cd0949361528f41e6b9e90e388cb3270797e89d45f45597d29`) and [independent fixture expectations](m73-accounting-fixtures.json) (SHA-256 `acd47a6a1ec8387b95c825e0d4b8a8d791f5abab8016151f330005a22a7bb655`). Those artifacts precede implementation and do not approve the later integrated result.

## Supported synthetic profile and fixture

The profile is fixed to the existing M71 company:

- The current saved Synthetic Juniper workspace, calendar 2025 (`2025-01-01` through `2026-01-01` exclusive), operational-control consolidation. User-facing company labels may have legitimate corrections; exact IDs and the selected saved-version hash are authoritative.
- The existing California parent entity and `Synthetic California office` facility, resolved by stable IDs from the selected saved M71 version rather than hardcoded company-label text.
- New source `Synthetic California office boiler`, domain `stationary_combustion`, added through an ordinary M71 correction. The correction also adds the matching source-level coverage row as missing activity and updates the existing parent boundary decision with an explicit operational-control rationale plus the pinned fictional M71 screening reference. That reference supports only the synthetic boundary facts it states; it does not support activity. Every earlier M71 version, export and finding remains immutable; the successor keeps all unchanged records and re-derives its own findings, so the supported parent-boundary gap may resolve while unrelated gaps remain.
- The saved M73 source version pins the exact M71 coverage version ID and hash plus company, entity, facility, source, boundary-decision and reporting-period IDs/values. A later M71 correction cannot silently retarget the source version.
- The M71 corporate register remains the authority for the company/facility/source universe and its gaps. An M73 source decision does not rewrite or automatically clear a M71 group screening or finding.

The supplied fictional evidence is a newly retained, exact synthetic annual statement. The existing M71 screening memo says it contains no activity measurements and cannot support consumption. The new statement carries immutable bytes or exact canonical text, SHA-256, stable artifact ID and version, document label, fictional issuer and meter/account identifier, the pinned facility and source, period start/end-exclusive, stated `1250.125 MMBtu`, explicit `HHV`, and a human-readable locator. No upload parsing, OCR or model extraction is claimed. The user manually inspects the statement and confirms the link.

The activity record keeps the document quantity and entered quantity separate. The happy path enters exactly `1250.125 MMBtu`, Natural Gas, HHV. A different entered amount requires a nonblank discrepancy explanation; the original stated amount remains visible and the discrepancy remains an open warning after save and review.

The deterministic candidate applies:

```text
1250.125 MMBtu × 53.1145 kg CO2e/MMBtu
= 66399.7643125 kg CO2e exact
= 66399.7643 kg CO2e displayed (four decimals, ROUND_HALF_EVEN)
```

Expected gas-level results are `66331.63250 kg CO2`, `1.250125 kg CH4` and `35.003500 kg CO2e` from CH4, plus `0.1250125 kg N2O` and `33.1283125 kg CO2e` from N2O. Trailing zeros may be normalized only by the canonical decimal-text policy; numerical identity and the exact total must remain unchanged.

The saved result also preserves the gas-level CO2, CH4 and N2O values, unit conversions, factor/GWP/method/source locators and hashes, calculation implementation binding, input snapshot hash and result hash. Code returns numerical values; the browser does no accounting arithmetic.

## User journey and labels

Add `Stationary natural gas` to the existing workspace navigation after `Corporate coverage`. Keep the established worksheet cards, context chips, status messages, history selector, review form and report actions; do not introduce a separate design system.

1. **Establish the source in corporate coverage.** In `Corporate coverage`, a manager makes a correction, selects `Synthetic California office`, adds `Synthetic California office boiler` as stationary combustion, records and supports the existing parent entity's operational-control inclusion, and saves it with the reason `Add office boiler for synthetic 2025 gas workflow`. The resulting source screening reads `Missing activity · Missing evidence · Candidate method`, and all existing gaps remain.
2. **Confirm source and reporting boundary.** The new page heading is `Stationary natural gas`. Context chips read `2025 calendar year`, `California · Operational control`, and `Source subtotal · Inventory incomplete`. A `Source and reporting boundary` card names the company, entity, facility, source, period and pinned corporate-coverage version. If any required pin is absent, mismatched, stale or inaccessible, saving is refused and no total appears.
3. **Inspect retained evidence and enter activity.** `Supporting statement` shows the synthetic label, issuer/meter, document period, stated amount, unit, heat basis, locator and fingerprint, with `Download original statement`. The form heading is `Create stationary source draft`; fields are `Fuel`, `Heat basis`, `Entered natural gas`, `Unit`, and `I manually confirmed this statement for this source and period`. Only the fixed Natural Gas / HHV / MMBtu case is enabled.
4. **Inspect the deterministic subtotal and trace.** After save, `Stationary source version 1` shows `Entered natural gas`, `Exact source subtotal`, and `Displayed source subtotal`, followed by `Gas results and calculation trace`, `Factor and method status`, `Supporting evidence`, `Corporate coverage gaps`, and `Version fingerprint`. The page always says `Development candidate · Not released` and `Combustion only; upstream fuel emissions excluded`.
5. **Review independently.** A different authorized manager who did not contribute to this version or its predecessors sees `Review stationary source version 1`, chooses `Accept for bounded internal use` or `Request changes`, adds the required note, and acknowledges the exact limitations. Acceptance binds the exact boundary/evidence/activity/calculation version. It releases no method, clears no corporate gap and provides no assurance.
6. **Correct without rewriting history.** `Make a correction` requires the current version/hash and a correction reason. The demonstration changes entered activity to `1500.125 MMBtu`, records `Correct synthetic annual meter total`, and requires an evidence discrepancy explanation because the statement still says `1250.125 MMBtu`. The corrected exact subtotal is `79678.3893125 kg CO2e`, displayed `79678.3893`. Version 2 points to version 1 and its hash; version 1, its decision and its report bytes remain unchanged. Version 2 starts unreviewed.
7. **Read the exact-version report.** `Create source report` freezes the selected source version and its review state. `Open report`, `Print report`, and `Download HTML` operate on server-verified bytes. The title is `Stationary natural-gas source report — synthetic internal draft`. It contains the boundary, activity and evidence, exact/display totals, gas-level trace, candidate method/factor provenance, review decision as captured, correction lineage and a prominent `Corporate coverage remains incomplete` section listing the unresolved Scope 1 and corporate gaps. A newer correction or review creates a new report; it never changes an earlier report.

## Calculation, evidence and state rules

- Supported input is a canonical non-negative decimal with at most 12 integer and 3 fractional digits, persisted and displayed to three decimals. Missing activity is `null`, never `0`; missing evidence or manual confirmation yields no calculation.
- Explicit zero is supported only as a separate acceptance case with quantity `0.000`, a nonblank no-consumption reason and a separate compatible zero-supporting synthetic statement. The happy-path positive statement cannot support zero even with a discrepancy explanation. Zero remains distinct from missing or unassessed activity and does not close facility or company coverage.
- Unit must be `MMBtu`, fuel must be `Natural Gas`, heat basis must be `HHV`, geography must be United States/California as pinned, and the evidence/activity/source/boundary periods must equal the 2025 fixture. No therm, scf, volume, mass, LHV, blend or hidden heat-content conversion is permitted.
- The method covers direct stationary combustion CO2, CH4 and N2O for the pinned source. It excludes upstream fuel emissions, biogenic treatment, feedstock use, flaring, mobile, process, fugitive/refrigerant and other fuels or sources. Unsupported input fails closed and clears any stale displayed total.
- The fixture represents energy consumed at a dedicated boiler meter. Shared meters, supplier/distributor duplicate billing, fuel stocks, feedstock use, loss adjustments and allocation are unsupported reconciliation cases; retain them as unresolved rather than calculating this profile.
- Each source version immutably binds its predecessor, corporate-coverage version/hash and record IDs, retained evidence ID/version/hash, document and entered amounts, discrepancy reason, manual confirmation, canonical activity, method/factor/GWP/implementation versions and hashes, exact result and display policy, author and captured time. No-op, stale-head and changed-idempotency replays are refused.
- A correction is append-only and resets review for the new version. Old versions, evidence, decisions, reports and downloads remain readable. Review is one decision per exact current version by a different manager outside the accumulated contributor set.
- A report is a source workpaper snapshot. It may state that this source has annual activity evidence for the pinned period. It must not call the source, facility, Scope 1 or corporate inventory complete. It must display the M71 coverage version and unresolved findings used at report creation.

## Technical integration boundary

Key each immutable annual stationary-natural-gas worksheet stream by company, stable source ID, fuel and reporting year 2025. The first save selects one source from the current M71 head. A correction cannot change the source ID; it may deliberately pin a newer validated M71 coverage version only when that version contains the same stable physical source. Another source requires a separate stream. The synthetic profile permits at most three streams and 40 total source versions per company, and never aggregates streams or versions. Fixture company and facility names are illustrative labels, not admission evidence or authorization; the server resolves tenant access and exact saved IDs/hashes. The candidate resource shape is:

- `GET/POST /workspace/{companyId}/stationary-natural-gas`
- `POST /workspace/{companyId}/stationary-natural-gas/{worksheetId}/versions`
- `POST /workspace/{companyId}/stationary-natural-gas/{worksheetId}/reviews`
- `GET /workspace/{companyId}/stationary-natural-gas/{worksheetId}/versions/{versionId}` and `/calculation-export`
- `POST /workspace/{companyId}/stationary-natural-gas/{worksheetId}/reports`
- `GET /workspace/{companyId}/stationary-natural-gas/{worksheetId}/reports/{reportId}/download`

The source admission gate requires the current saved M71 head to be operational control, full calendar 2025, United States/California, with the selected entity included by an explicit rationale and pinned fictional boundary reference, and with the exact selected facility/source row present. Preserve one decision per version, at most two report snapshots per version (unreviewed and reviewed), and a 4 MB bounded response/history envelope. These are synthetic demonstration limits, not a customer retention policy. Final route naming may change in the CTO contract if all user behavior and acceptance bindings remain exact.

## Corporate gap contract

The page and every report must show, without relying on color alone:

- `Stationary combustion — partial`: the office boiler has a bounded draft; stationary sources at `Synthetic California distribution center` remain unassessed for the 2025 period, and any undiscovered source remains a coverage risk.
- `Mobile combustion — unassessed`.
- `Fugitive emissions, including refrigerants — unassessed`.
- `Process emissions — unassessed`.
- `Corporate inventory — incomplete`: Scope 2, all 15 Scope 3 categories, reporting-requirement applicability and other M71 findings remain as recorded in the pinned register.

These are gap statements, not percentages or inferred zeroes. The UI may count open findings if it labels the number `Recorded open findings`; it may not show percent complete, a green complete state, `full Scope 1`, `SB 253 ready`, `assured`, `verified emissions`, `production ready` or an aggregate corporate emissions total.

## Acceptance criteria

| ID | Observable acceptance behavior | Required evidence |
| --- | --- | --- |
| M73-P01 | Adding the boiler through the real M71 correction path creates an immutable coverage successor with the matching stationary source-level row and supported parent operational-control decision; every earlier M71 record/export and every other gap remains unchanged. | Native database/API readback plus actual browser save/history/export against the integrated version. |
| M73-P02 | The source draft resolves the exact saved company/entity/facility/source/boundary/period and M71 version/hash. Missing, stale, foreign-tenant, changed-value or mismatched pins are refused before evidence or calculation is accepted. | Integrated server authorization/driver tests and browser-visible refusal with no total. |
| M73-P03 | The exact retained synthetic statement downloads byte-for-byte; the page shows all minimum metadata and keeps stated `1250.125` separate from entered activity. The quantity-free M71 memo and altered/unknown evidence cannot support calculation. | Download hash/length verification, readback validation and actual browser entry point. |
| M73-P04 | Saving the happy path returns the independently expected gas-level values and exact `66399.7643125 kg CO2e`, displayed `66399.7643`, with no browser arithmetic and with all source/method/factor/GWP bindings. A repeated request is identical. | Independent accounting oracle, actual Python adapter, PostgreSQL/API/frontend decoder and exact canonical hashes. |
| M73-P05 | Missing quantity saves an incomplete version with a null result and no displayed total. Numeric input with missing evidence/manual confirmation, unsupported unit/fuel/heat basis/geography, period mismatch, malformed/negative/over-precision quantity or altered bindings is refused and clears a prior total. `0.000` succeeds only with a reason and separate compatible zero evidence. | Meaningful positive/negative boundary tests plus keyboard browser exercise of stale-total clearing and field-linked errors. |
| M73-P06 | A differing entered amount requires a discrepancy reason. Saving retains both values and keeps `Quantity discrepancy — unresolved` visible in version, review and report; accepting bounded internal use cannot erase it. | Saved/API/browser/report comparison. |
| M73-P07 | A different non-contributor manager can accept or request changes for the exact current source version after acknowledging limitations. The author, contributor, member, outsider, signed-out actor, stale version and duplicate conflicting decision are refused. | Real server/tenant/role transitions and browser review; decision hash binds the complete effective tuple. |
| M73-P08 | The correction to `1500.125 MMBtu` appends version 2 with exact `79678.3893125 kg CO2e` and displayed `79678.3893`, binds version 1/hash, resets review and leaves version 1, its review and report exact. Only the successor is effective; totals never sum versions. No-op, stale-head and same-key/different-payload corrections fail without mutation. | Native lifecycle test, exact old/new reads and downloads after restart. |
| M73-P09 | The exact-version report opens, prints and downloads through the actual browser controls. Exact saved bytes/hash survive restart and contain boundary, evidence, activity, trace, candidate status, captured review/correction lineage and all required corporate gap labels. | Server byte/hash validation, actual open/print/download entry points, saved-file comparison and readable desktop/390px review. |
| M73-P10 | Success never changes the M71 group row to complete, calculates a corporate total, or hides mobile, fugitive/refrigerants, process, unassessed distribution-facility/period and other corporate gaps. | Before/after register comparison and report/UI inspection. |
| M73-P11 | Existing M63–M72 data, downloads and role behavior survive the additive change; authorized reads recover after an actual restart, and cross-tenant records remain indistinguishable from missing. | Bounded regression, row/hash preservation, restart/readback and independent security review. |
| M73-P12 | Keyboard users can reach source selection, evidence inspection/download, entry, correction, history, review and report controls; status/error text is announced; labels remain readable without color and at 390px width. | Integrated accessibility interaction and visual review. |

Apply lesson L04 to the real database, API, frontend decoder, browser save/review/correction and report open/print/download paths. Apply lesson L06 to every single-field correction that is permitted and to the full composed lifecycle; review of one repaired field does not approve the remaining tuple. Independent QA must inspect the frozen integrated candidate. The product author and implementation authors cannot be the sole final reviewers.

## Explicit exclusions and claims

M73 does not add arbitrary customer uploads, parsing/OCR, multiple statements, monthly allocation, therm/scf conversion, other fuels, other stationary methods, facility or corporate aggregation, estimates, Scope 1 categories beyond this one source, Scope 2/3 changes, source acquisition, factor/method release, customer data, legal applicability, filing, external reviewer access, deployment, production readiness or external assurance. Hosting and publication are separate coordinator-owned actions after implementation, checks and independent review.

Customer-facing claim allowed after demonstrated acceptance: `Synthetic internal workflow for one 2025 California stationary natural-gas source, with traceable evidence, deterministic candidate calculation, immutable corrections, separate internal review and a readable source report.` Always pair it with: `Corporate inventory incomplete; factors and methods unreleased; no filing determination or external assurance.`

## Handoff and unresolved gates

CTO owns the additive schema/API/adapter boundaries, exact resource names, isolation and recovery plan. Accounting owns the independent expected gas-level results, candidate source/method applicability and correction/review checks. Software engineering should extend the existing private workspace and style rather than create a parallel product surface. Head of QA should challenge the exact integrated version, especially stale pins, quantity/evidence discrepancies, review independence, immutable reports and the temptation to imply full Scope 1.

Implementation can begin once the CTO and accounting contracts agree with this product boundary. Any claim of a released method, actual corporate MVP, production use, current legal compliance or assurance requires its own later evidence and approval.
