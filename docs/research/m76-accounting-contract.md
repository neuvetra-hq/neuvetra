# M76 stationary-source accounting and reconciliation contract

Prepared 2026-09-16 for `M76-ACCOUNTING`; author `/root/m76_accounting`, accounting-validation role sponsored by QA. Requested `gpt-6-astra/high`; observed model/effort unknown. Role prompt SHA-256 `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`. Owned deliverable: this file only. Root owns records, integration, Git and hosting. This author has not authored the M73/M74 implementation and did not execute it for this assignment; authoring this contract does not constitute independent review of a later implementation.

## Verdict and boundary

**Recommend a bounded development candidate:** reconcile stationary equipment at the declared California office and distribution facility; reuse unchanged M73 natural-gas workpapers where each device satisfies M73 admission; add a separately versioned fossil-diesel emergency-generator workpaper. No source, factor, method, corpus or customer release is approved here. All reports remain synthetic, Scope 1 incomplete and ineligible for release.

The [completion matrix](scope1-completion-matrix.md), S1-01/02/03/08/09/10/11/13/14, governs the product outcome. Pin one corporate boundary/version/hash, operational control, California/U.S. entity and facilities, and the complete calendar year `2025-01-01` to `2026-01-01` exclusive. Discovered operations outside this supported profile remain in the source universe as gaps. New facilities or sources cannot be erased to make reconciliation pass. This is not a current SB 253 applicability or filing determination.

Natural gas: annual consumed HHV MMBtu, one stable stationary boiler or space-heating device per dedicated meter/source. Additional devices at the distribution facility require distinct evidence. Reusing the arithmetic across facilities does not authorize shared-meter allocation, device grouping or counting the same utility consumption twice. Preserve the [M73 contract](m73-accounting-contract.md), its frozen authority and historical reports.

Generator candidate ID: `m76.stationary-distillate-no2.ca2025.ar5.default-hhv.v1`. Admit one fixed stationary compression-ignition emergency generator, fuel documented as **100% fossil Distillate Fuel Oil No. 2**, and consumed U.S. gallons directly metered for that device. Generic “diesel,” its color, an asset nickname or M74 vehicle eligibility is insufficient fuel/technology evidence. Test and maintenance runs count as consumption. The initial default-HHV pathway requires an explicit record that supplier-specific HHV and carbon-content data are unavailable. Known source-specific data needs separate reviewed admission; do not discard it to choose defaults.

## Primary evidence inspected

On 2026-09-16 the retained workbook was read directly as ZIP/XML, including cell formats, without importing application arithmetic. Path: `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-factors-hub-2025.xlsx`; bytes `1014275`; SHA-256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`. Sheet `Emission Factors Hub`; F3 dates the edition January 15, 2025. These are retained-byte observations, not a hash of the current remote download.

| Local workbook locator | Published decimal or meaning |
| --- | --- |
| Table 1 C38/E38/F38/G38; E36:G36 | Natural Gas; `53.06` kg CO2/MMBtu; `1.0` g CH4/MMBtu; `0.10` g N2O/MMBtu |
| Table 1 C55; D14 and D47:G47 | Distillate Fuel Oil No. 2; HHV, MMBtu/gallon; kg CO2/MMBtu; g CH4/MMBtu; g N2O/MMBtu |
| D55/E55/F55/G55 | `0.138` MMBtu/gallon; `73.96`; `3.0`; `0.60` |
| H55/I55/J55, excluded from chosen arithmetic | Rounded per-gallon factors `10.21` kg CO2; `0.41` g CH4; `0.08` g N2O |
| C94/C95/C99 | Heat-basis/default-factor notes; full carbon oxidation; direct combustion boundary |
| Table 11 E523/E524/E525/E526; C10/C556 | 100-year AR5; CO2 `1`, CH4 `28`, N2O `265` |

D55 raw XML is `0.13800000000000001` with three-decimal format; E55 is `73.959999999999994` with two-decimal format. F55 is `3` with one-decimal format; G55 is `0.6` with two-decimal format. Pin the published decimal values, retain the raw/format normalization decision, and never use binary-storage tails as extra precision.

The current [EPA Hub page](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) lists the 2025 edition. Its [2025 PDF](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf), page 1 Table 1 and page 5 Table 11, corroborates the local factor and GWP cells. These sources were browsed on 2026-09-16; no latest-version substitution or remote-byte identity is implied.

[EPA stationary guidance, December 2023](https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf), printed pages 4-5 (equations), 8-11 (activity/heat basis), 12-13 (completeness), and 14-16 (uncertainty/documentation/QA), distinguishes consumed fuel from purchases, storage changes, losses and feedstock use. It discusses generator hour-based estimates and facility allocations, but this candidate excludes those pathways. Actual heat/carbon information is preferred when available; converting with a default HHV does not improve its underlying uncertainty. Sections 3-4 support separate fuel records, source-list reconciliation and investigation of omitted sources.

[GHG Protocol Corporate Standard](https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf), printed pages 8-9, chapters 3-4 and printed page 40, addresses completeness, boundaries and distinct stationary/mobile source categories. [EPA boundary guidance](https://www.epa.gov/climateleadership/determine-organizational-boundaries), Table 1, describes operational-control consolidation. These establish accounting concepts, not this synthetic company's facts or a regulatory exemption for emergency equipment.

## Exact admission and evidence

Server-side bindings resolve tenant/company/inventory, immutable corporate version/hash, entity/facility/source and full-year control decision. Each device record retains stable physical asset key, equipment type, identifying serial or documented alternative, make/model if available, facility, fuel grade/composition, active interval, control basis, dedicated meter identifier and evidence relationship. Identity fields do not supply fuel factors. Unknown identity, control, fuel, period or meter relationship blocks reconciliation.

For generator numeric admission, retain one immutable annual consumption statement with exact bytes, artifact/version/hash/byte length and locator; fictional issuer and synthetic label; device/facility/meter identity; period; fuel grade and fossil composition; `US gallon`; separately stated consumption; direct-meter measurement basis; no supplier HHV/carbon available; and explanation of the consumption boundary. A tank may exist upstream: direct measured consumption makes opening/closing storage unnecessary for this selected activity basis. Delivery-only evidence, unexplained stock changes or shared-tank allocations cannot masquerade as measured consumption. No tank-balance engine is introduced.

Retain a separate equipment/source-universe statement from the workpaper collection. For the synthetic demo it explicitly declares the two facilities and all stationary devices, including an office boiler, distribution gas heater and distribution emergency generator; cite the fictional equipment schedule/site review basis. A real inventory would require actual equipment/maintenance/site/utility evidence and reviewer evaluation. Text entered by a user is labeled as such; storing it does not authenticate a third-party document.

### Required structured generator facts

The following fields are required in addition to authoritative binding/period and activity/review lifecycle metadata. These facts must be validated and bound into retained evidence and report content, not inferred from prose. Storage/API names may be mapped explicitly in the technical contract; omission or a contradictory value cannot admit a calculated result.

| Record | Fields and admitted values |
| --- | --- |
| Equipment | `assetId` stable key; `identifierBasis` nonempty; `equipmentType=stationary_emergency_generator`; `engineType=compression_ignition`; `stationaryInstallation=fixed`; `controlBasis=owned_operational_control_full_year`; nonempty `controlExplanation`; `fuel=Fossil Distillate Fuel Oil No. 2`; `fossilFraction=1.000`; nonempty `fuelGradeBasis` |
| Statement identity/activity | Nonempty `issuer`, `reference`, `meterLabel`, `description`; `statedQuantityGallons` fixed-three-decimal string; authoritative equipment/facility/fuel/year bindings; `consumptionBasis=dedicated_generator_consumed_no_adjustments` |
| Statement measurement eligibility | `measurementBasis=direct_device_fuel_meter`; `dedicatedToSingleDevice=true`; `includesTesting=true`; `stockDerivedConsumption=false`; `sharedFuelAllocation=false`; nonempty `consumptionBoundaryExplanation` explaining the meter location and why the value represents this engine's consumed fuel |
| Statement factor eligibility | `supplierSpecificHhvAvailable=false`; `supplierSpecificCarbonAvailable=false`; nonempty `defaultFactorEligibilityExplanation` describing the absence of those supplier/source data |

HHV/carbon availability belongs to the fuel statement for the reporting period, not a permanent equipment property. The initial `owned_operational_control_full_year` enum is a narrower implementation choice within operational-control accounting; leased or other control arrangements remain unsupported until explicitly admitted. A known upstream tank with directly metered downstream consumption is not stock-derived consumption. A purchase volume and a free-text assertion of no adjustment cannot satisfy `measurementBasis=direct_device_fuel_meter`.

The stationary roster additionally records facility/entity coverage and discovery basis, equipment asset IDs/aliases, period, equipment class/fuel/control, corporate-source match and meter/evidence relationship. `allControlledLocationsIncluded` is a declarant assertion that must be compared with the authoritative boundary; it cannot override a missing facility. Retain unsupported enum values or an explicit unknown classification as blocking roster rows rather than quietly deleting the equipment.

Quantity grammar: JSON string `^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$`; range `0` to `999999999999.999`; persist fixed three decimals. Reject numbers, signs, commas, exponents, whitespace, leading-zero variants, negatives and excess precision. No silent rounding/conversion. Missing is an explicit null activity state, saved with null result and a visible gap. Numeric admission requires compatible retained evidence; wrong source/facility/period/fuel/unit/basis or hash refuses calculation.

Zero needs aligned zero statement and nonempty no-consumption rationale covering test/maintenance runs. Missing, excluded and not-applicable are distinct. Positive entered/stated disagreement may calculate entered quantity only with explanation; retain both quantities and an unresolved finding that prevents reconciled status. Positive statement plus entered zero cannot qualify as supported zero. Internal review never resolves a discrepancy simply by accepting it.

Unsupported: portable/non-road generators, vehicles, CHP allocation, other fuels, unknown/bio/renewable fuel or blends, LHV, liters/imperial gallons/therms/scf conversions, supplier-specific factor/HHV overrides, shared or grouped meters, fuel-stock calculation, fuel-hour/rate or spend estimates, partial-year control, extrapolation, feedstock and loss adjustments. These are bounded product exclusions, not statements that the standards prohibit such methods. Discovered losses/fugitives remain separate source gaps.

## Decimal method and independent expectations

All activity, conversion, factor, intermediate and result values remain decimal strings across storage/API/browser boundaries. Use exact Decimal with precision 96 or equivalently proved scaled integers. Preserve full gas masses and CO2e; canonical exact values omit insignificant trailing zeros, never use exponent notation. Round only final displayed source total to four decimals, half-even. Computational digits do not assert measurement accuracy.

For natural gas Q MMBtu: CO2 kg = Q × 53.06; CH4 kg = Q × 1.0 / 1000; N2O kg = Q × 0.10 / 1000. Multiply CH4 by 28 and N2O by 265. Exact total is Q × 53.1145 kg CO2e.

For generator G U.S. gallons:

1. H MMBtu HHV = G × 0.138.
2. CO2 kg = H × 73.96 = G × 10.20648.
3. CH4 kg = H × 3.0 / 1000 = G × 0.000414; CH4 kg CO2e = G × 0.011592.
4. N2O kg = H × 0.60 / 1000 = G × 0.0000828; N2O kg CO2e = G × 0.021942.
5. Exact total = G × 10.240014 kg CO2e.

This is the chosen default-HHV chain, not a claim to more accurate fuel data. Do not mix it with H55:J55: those rounded per-gallon factors yield `10.24268` kg CO2e/gallon, a different route. Do not use M74 mobile CO2/mileage factors or Table 5 non-road factors. Reports show both original gallons and derived HHV with default-estimate limitation. The U.S. gallon is an explicit candidate unit convention; no gallon conversion is performed.

The following expectations were derived on 2026-09-16 using Python standard-library Fraction from decimal literals and independently expanded gas formulas, checked against exact total coefficients, then rendered with Decimal precision 96. No application calculator was invoked.

| Case | Quantity | Exact kg CO2e | Display kg CO2e |
| --- | --- | --- | --- |
| NG zero with evidence | `0.000` | `0` | `0.0000` |
| NG minimum | `0.001` | `0.0531145` | `0.0531` |
| NG even/odd ties | `0.100`; `0.300` | `5.31145`; `15.93435` | `5.3114`; `15.9344` |
| Office NG | `1250.125` | `66399.7643125` | `66399.7643` |
| Distribution NG | `875.375` | `46495.1054375` | `46495.1054` |
| NG maximum | `999999999999.999` | `53114499999999.9468855` | `53114499999999.9469` |
| Generator zero with evidence | `0.000` | `0` | `0.0000` |
| Generator minimum | `0.001` | `0.010240014` | `0.0102` |
| Generator unit | `1.000` | `10.240014` | `10.2400` |
| Generator odd/even ties | `25.000`; `75.000` | `256.00035`; `768.00105` | `256.0004`; `768.0010` |
| Generator positive | `250.125` | `2561.28350175` | `2561.2835` |
| Generator maximum | `999999999999.999` | `10240013999999.989759986` | `10240013999999.9898` |

Positive generator trace: H `34.51725`; CO2 kg `2552.89581`; CH4 kg `0.10355175` and CO2e `2.899449`; N2O kg `0.02071035` and CO2e `5.48824275`. Source-display values must come from server arithmetic. Audit-only cross-check of the three illustrative sources is `115456.15325175` kg CO2e; it does not authorize a product aggregate or corporate completeness claim. Do not sum rounded displays or prior versions.

## Source-universe reconciliation and lifecycle

Reconcile independently declared facility/device universe ↔ saved corporate stationary-source register ↔ one effective current workpaper per physical source/year. Also reconcile the complete declared facility list to the corporate boundary: silence at one site is a gap, not no equipment. Keep unmatched declaration devices, unmatched corporate sources, orphan workpapers, unsupported profiles, duplicate identities/meters/evidence, missing reviews, stale bindings and all unresolved findings visible. An all-zero or empty collection cannot establish completeness.

Require every declared device to have a supported calculated/explicit-zero workpaper with compatible evidence and separate review. The M76 implementation contract excludes not-applicable and exclusion dispositions: unresolved classification/control or a request to exclude a device remains blocking, with the reason visible. Later milestones may separately support evidence-backed dispositions; that general accounting possibility is not an M76 implemented pathway. An applicable unsupported source cannot be excluded merely to pass. Supported estimates require a separately reviewed method: M76 introduces none. Exhaustive declaration and source matching is a bounded reconciliation judgment, not independent confirmation that the real-world source universe is exhaustive.

Physical identity persists across source aliases, labels and corporate versions. One meter/statement's full annual consumption cannot count for two devices or both mobile and stationary activity. Preserve M74 fuel boundaries and M75 fleet findings. A capacity limit refuses the bounded reconciled conclusion with an explicit overflow finding; it must not truncate the universe and declare success.

Append corrections with predecessor/version/hash, reason, actor/time and expected head. Any effective-input/evidence/source-only change resets review. Only one current version is considered. A changed corporate binding or corrected source workpaper invalidates current reconciliation until rechecked; historical reports remain frozen. A different non-contributor reviews the exact roster/workpaper version. Report labels distinguish “stationary declaration reconciled within this synthetic candidate” from complete stationary emissions, complete Scope 1 or corporate completeness. No M76 aggregate is required.

## Acceptance map and unrun gates

| Criterion | Evidence delivered here | Required next independent implementation challenge |
| --- | --- | --- |
| Factor provenance and candidate scope | Rehashed workbook; row38/55 and GWP XML/format inspection; current primary pages above | Replay trusted source/method bindings; reject coordinated factor/bytes/hash/length changes (L02) |
| Gas arithmetic and rounding | Fraction/Decimal expectations and gas trace above | Persist minimum/maximum/ties through native driver, API and actual frontend decoder (L07); generator route-mixing negative control |
| Missing/zero/evidence | Exact admission rules above | Missing evidence/quantity; wrong unit/fuel/site/year; zero contradicting test-run data; positive discrepancies; changed-only source/evidence successors |
| Universe completeness | Three-way reconciliation plus boundary facility comparison above | Hidden generator, omitted distribution facility, unsupported fourth device, alias duplicate, shared meter, orphan workpaper, capacity overflow, no-equipment-without-evidence |
| Correction/review/history | Exact-head/current-only/report rules above | Correct one source after reviewed roster, prove stale state; new separate review; unchanged historical downloads |
| Bounded claims and publication | Explicit unreleased/incomplete dispositions | Actual report/browser/download/restart/security/recovery checks by independent QA; no author-only release acceptance |

Only contract preparation, source inspection and standalone arithmetic derivation ran in this assignment. No M76 implementation, native-driver, browser, tenant, migration, recovery, deployment or corpus test ran. This document is a candidate recommendation awaiting separate review, not their acceptance result.

[EPA copyright policy](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers), Copyright Status, and [GHG Protocol terms](https://ghgprotocol.org/terms-use), Usage and IP sections, were checked 2026-09-16. Specific commercial source-use clearance remains unresolved; this is not a legal rights opinion. Retain `methodStatus=development_candidate_not_released`, `rights=unresolved_for_factor_release`, `synthetic=true`, `incompleteScope1=true`, `corporateCompleteness=incomplete`, `releaseEligible=false`, `assurance=none`. Method-domain review, rights disposition, integrated independent acceptance, explicit versioned release and qualified human/customer-readiness review remain separate gates. Expired research-answer sources are not renewed by this contract.

Next owner: root/CTO selects the exact implementation scope; software specialist implements it; independent QA challenges integrated source admission, calculations and reconciliation. Root records this file's exact hash and freezes the reviewed version before publication.
