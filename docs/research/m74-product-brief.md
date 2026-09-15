# M74 product brief — first mobile-combustion source workflow

Prepared 2026-09-15 for `M74-CPO-COMPLETION-MATRIX`. Product owner: `/root/m74_cpo`; sponsor: root coordinator. Requested CPO route: `gpt-5.6-sol` / `medium`; observed model and effort are unknown. The controlling profile and longer completion path are in [the Scope 1 completion matrix](scope1-completion-matrix.md).

## Intended user and outcome

An authorized inventory preparer can register one owned or operationally controlled on-road fossil-diesel distribution truck, retain separate annual fuel and mileage evidence, create a deterministic gas-level mobile-combustion result for calendar 2025, correct it without rewriting history, obtain review from a different authorized manager, and open/download an exact source workpaper.

M74 adds the next highest-value missing source family for the initial office/distribution profile: mobile combustion. It does not complete the fleet, stationary combustion, office/distribution HVAC, refrigeration or fire-suppression fugitive screening, process screening, company Scope 1, an SB 253 report, source/method release or assurance.

## Bounded demonstration profile

The demonstration uses the saved synthetic California operational-control company and distribution-center facility for the full `2025-01-01` to `2026-01-01` exclusive period. One new stable vehicle source represents one heavy-duty on-road fossil-diesel distribution truck with:

- one immutable vehicle/source ID, company, controlling entity and California base facility;
- operational control for the full year;
- a documented heavy-duty diesel truck that fits the primary source's exact `Medium- and Heavy-Duty Vehicles` class and model years 2007–2022; the class is supported by retained vehicle evidence rather than guessed from its label, and no later model year is extrapolated;
- all of that controlled vehicle's fuel and travel for the year, including interstate operation rather than a California-only slice;
- a dedicated synthetic annual fuel statement stating consumed U.S. gallons of fossil diesel; and
- separate synthetic odometer, service or approved telematics evidence supporting annual vehicle miles.

The positive fixture enters `1000.125` U.S. gallons and `12000.500` vehicle-miles. Under the pinned candidate factors and AR5 GWP values, the independently derived expectations are `10211.27625 kg CO2`, `0.11400475 kg CH4`, `0.51722155 kg N2O`, exact `10351.53209375 kg CO2e`, and displayed `10351.5321 kg CO2e` using four-decimal round-half-even. The product journey shows gallons and miles as independent activity bases and preserves their separate evidence links. These numbers bind the synthetic candidate test; the source/method still needs approval and release before customer use.

One stable vehicle equals one source stream. A pooled fleet, mixed class/model-year group, pooled or shared fuel card, mixed fuel, renewable diesel or blend, partial-year control, missing mileage, unsupported/newer model year, off-road equipment, leased vehicle with unresolved control, employee travel, third-party haulage, aircraft, marine or rail input is refused for calculation and recorded as an unresolved coverage item. Third-party haulage must not be forced into Scope 1 merely to make this worksheet accept it.

## User journey

1. **Register the source in corporate coverage.** Through the existing M71 correction shape, add a stable mobile-combustion source under the controlled distribution entity/facility with source name, domain and period. Do not retrofit vehicle-specific fields into M71. Existing M71–M73 records and gaps remain unchanged.
2. **Confirm boundary and uniqueness.** On the first M74 save, pin the M71 source/version/hash and capture the typed immutable vehicle ID, exact factor class, model year, fossil-diesel fuel and full-year control facts. The page names the company, entity, facility, vehicle and period and states `Mobile source subtotal · Scope 1 incomplete`. A duplicate vehicle/company/reporting-year key, mismatched control/period, stale coverage pin or inaccessible tenant is refused before activity entry.
3. **Inspect both retained evidence records.** Show exact metadata, locator, hash and download for the annual fuel statement and mileage evidence. Neither record substitutes for the other. Manual confirmation binds each artifact to this vehicle and period; no OCR or automated extraction is claimed.
4. **Enter and validate activity.** Enter consumed fossil-diesel U.S. gallons and annual vehicle miles as canonical non-negative decimals within accounting-contract precision. Select only the supported vehicle/fuel profile. Missing is distinct from explicit zero. A differing entered/evidence value requires a reason and remains a visible unresolved discrepancy.
5. **Calculate deterministically.** Server code produces CO2 from the fuel basis and CH4/N2O from the distance and supported vehicle profile, then applies the pinned GWP/rounding policy. Show gas-level activity, units, conversions, factor/source locators, exact values, display values, method status and hashes. The browser performs no accounting arithmetic.
6. **Review the exact version.** A different authorized manager outside the version's contributor set may accept for bounded internal use or request changes, with note and limitation acknowledgement. The decision releases no source/method and cannot clear a discrepancy or corporate gap.
7. **Correct without rewriting.** Append a mileage-only correction from `12000.500` to `12500.500` vehicle-miles, keep `1000.125` gallons unchanged, record a reason and any required evidence discrepancy, and produce exact `10357.37584375 kg CO2e`, displayed `10357.3758`. The successor resets review and preserves the original version, review and report bytes. Only the latest effective version may later enter aggregation; versions are never summed.
8. **Open the source workpaper.** The exact-version report includes boundary, vehicle facts, both evidence records, both activities, gas trace, candidate source/method status, discrepancy state, correction/review lineage and named incomplete-coverage items. Open, print-entry and exact HTML download controls follow the established workspace pattern.

## Product and accounting rules

- The method requires both valid activity bases. If gallons or miles are missing or invalid, the calculation result is `null`: no partial CO2 component or source subtotal is shown, and the UI identifies the missing dimension without inferring zero.
- Explicit zero needs compatible zero evidence and a nonblank no-operation reason for each applicable activity basis. A positive fuel statement cannot support zero through a discrepancy note. Zero does not prove fleet or company completeness.
- Evidence periods, vehicle/control period and reporting year must align. Partial-year acquisitions/disposals are outside M74.
- The fuel must be verified fossil diesel for the supported profile. Unknown blend, biodiesel fraction or renewable diesel fails closed; the system may not silently apply the fossil-diesel factor.
- Factor, method and GWP artifacts remain development candidates until source/domain approval, lawful-use/release decision and production release are recorded. A source hash alone is insufficient.
- Source versions bind boundary version/hash, vehicle identity/class/model year/control, both evidence artifacts, both entered and stated activities, discrepancy reasons, calculation implementation, factors/GWPs/methods, exact results and predecessor. No-op, stale-head and same-key/different-payload replay are refused.
- The physical vehicle/company/year key is locked independently of document references. Replacing a statement or changing a label cannot admit a duplicate stream.
- M74 never aggregates a fleet, facility or company total. Future aggregation may include exactly one effective version of this source; it must not add versions, overlapping fuel records or supplier/card duplicates, and must not subtract offsets or credits.

## Observable acceptance criteria

| ID | Acceptance behavior | Required evidence |
| --- | --- | --- |
| M74-P01 | Adding the source through the unchanged M71 coverage-correction shape creates an immutable successor with stable source ID, entity/facility, mobile domain and period, while all older exports, M73 records and unrelated gaps remain exact. It does not add vehicle-specific fields to M71. | Native database/API readback, actual browser save/history/export and old-record hash comparison. |
| M74-P02 | The first M74 save pins the exact M71 source/version/hash and immutably captures vehicle ID, documented factor class, model year, fossil-diesel fuel, full-year control, company/entity/facility and period. Missing, stale, foreign-tenant, changed or mismatched pins fail before evidence/activity/calculation; duplicate vehicle/company/year admission causes no mutation. | Server authorization/admission tests and browser-visible refusals with no stale total. |
| M74-P03 | Dedicated fuel and mileage artifacts download exactly and show required metadata/locators/hashes. Altered, unknown, cross-vehicle or quantity-free evidence, or using one artifact for both bases, is refused. | Exact byte/hash checks, semantic-lineage tests and actual browser downloads. |
| M74-P04 | For `1000.125` gallons and `12000.500` miles, the candidate returns `10211.27625 kg CO2`, `0.11400475 kg CH4`, `0.51722155 kg N2O`, exact `10351.53209375 kg CO2e` and display `10351.5321`, with pinned units, source cells, GWP and rounding. Repeated calculation is identical and the browser performs none of it. | Independent oracle plus native calculation, PostgreSQL/API/frontend-decoder and canonical-hash checks. |
| M74-P05 | Missing gallons, missing miles, unsupported class/model year/fuel, blend/renewable diesel, period/control mismatch, malformed/negative/over-precision input or changed binding produces `calculation: null`, no partial CO2 result and no source subtotal. The version remains incomplete and cannot be accepted or reported as complete. | Positive/negative boundary suite and keyboard browser exercise proving stale-total clearing and field-linked errors. |
| M74-P06 | A discrepancy between evidence and entered gallons or miles requires a reason and stays visible in worksheet, review and report. Acceptance for bounded internal use cannot erase it. | Saved/API/browser/report comparison. |
| M74-P07 | A different authorized non-contributor manager can decide the exact version after acknowledging limits. Contributor, ordinary member, outsider, signed-out actor, stale version and duplicate conflicting decision are refused without leakage or mutation. | Real tenant/role transitions, browser review and decision-hash verification. |
| M74-P08 | A mileage-only correction from `12000.500` to `12500.500` with gallons unchanged appends a successor with exact `10357.37584375 kg CO2e`, display `10357.3758`, resets review and leaves old version/review/report/download exact. No-op/stale/idempotency conflicts fail. Only the successor is effective; no view sums versions. | Composed native lifecycle test, exact old/new reads and downloads before/after restart. |
| M74-P09 | Exact-version report open, print entry and HTML download work through actual browser controls; stored/downloaded bytes match and survive restart. Report contains both inputs/evidence, vehicle and boundary facts, gas trace, source/method status, review/correction lineage and incomplete-coverage labels. | Server bytes/hash, browser controls/download, desktop/390-pixel readability and restart readback. |
| M74-P10 | Success leaves stationary distribution sources, other fleet vehicles, refrigerants/fugitives, process screening and the corporate inventory incomplete. It does not produce a fleet/facility/company total or offset-net figure. | Before/after coverage comparison and UI/report inspection. |
| M74-P11 | All pre-M74 data, reports, roles and permissions survive an additive change and independent recovery; cross-tenant mobile records remain indistinguishable from missing. | Row/hash/catalog preservation, tenant/security checks, restart/readback and reviewed recovery. |
| M74-P12 | Keyboard users can inspect/download both evidence records, enter both activities, correct, select history, review and open/report; errors/status are announced and content remains readable at 390 pixels without relying on color. | Integrated accessibility interaction and visual review. |

Acceptance requires the accounting contract and fixture to supply exact factor pins, decimal/rounding rules and expected positive/zero/tie/boundary outcomes. The retained candidate primary artifact is `epa-factors-hub-2025.xlsx`, SHA-256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`, 1,014,275 bytes. Accounting reinspection identifies worksheet `Emission Factors Hub`, revision cell `F3` (`January 15, 2025`), Table 2 cells `C107:E107` (Diesel Fuel, displayed `10.21 kg CO2/gallon`), Table 4 cells `C255`, `D255`, `E256:G256` (`Medium- and Heavy-Duty Vehicles`, Diesel, model years `2007–2022`, displayed `0.0095 g CH4/mile` and `0.0431 g N2O/mile`), and Table 11 cells `E524:E526` (1, 28, 265). The displayed published decimals govern; the workbook's binary XML artifacts are not extra precision. The workbook hash and locators are candidate evidence, not source/method approval or a rights/release decision. The implementation author cannot be the sole reviewer. Independent accounting, security and integrated QA review the exact frozen candidate.

## Claims and explicit exclusions

Permitted demonstration claim: `Synthetic annual 2025 mobile-combustion workpaper for one supported, operationally controlled fossil-diesel truck; development candidate; corporate Scope 1 incomplete.`

Do not claim fleet coverage, all mobile combustion, stationary completion, refrigerant/process coverage, complete Scope 1, a corporate inventory, SB 253 applicability/compliance, released factors/methods, production readiness, validation by a qualified assurance provider or a predetermined assurance result. M74 has no implementation, hosted action or publication in this CPO assignment. Standing board approval allows sequential work to proceed without routine repermission, but it does not waive source, method, independent-review, human-qualification, rolling-PR or release gates.

## Dependencies and next handoff

- Accounting finalizes and independently checks the exact fixture, factor pins, arithmetic, GWP/rounding and unsupported boundaries. Product limits received: fossil-diesel on-road truck documented within the source's `Medium- and Heavy-Duty Vehicles` class, model years 2007–2022, gallons for CO2 and miles for CH4/N2O; no automatic extrapolation.
- Regulatory/source review establishes primary-source status, current applicability context and rights/release disposition. This brief makes no factual current-law conclusion.
- CTO maps this behavior into an additive implementation that preserves M73 and schema16. Root alone owns Git, hosting, the rolling PR and shared operational records.
- QA challenges the full journey, especially duplicate vehicle admission, missing-mile handling, blended-fuel refusal, cross-tenant behavior, correction/review lineage and recovery.
- After M74, proceed through mobile-fleet reconciliation, stationary completion, refrigerants/other fugitives, process screening and integrated gross aggregation as defined in the completion matrix. An applicable unsupported source creates another bounded method milestone; it is not removed from the customer profile.
