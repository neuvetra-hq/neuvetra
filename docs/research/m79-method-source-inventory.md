# M79 method/source inventory preparation

Date: 2026-09-22. Task `M79-METHOD-SOURCE-INVENTORY-01`; author `/root/m79_inventory`, accounting-validation role. Requested route `gpt-5.6-sol/high`; observed model and effort are unavailable. Role prompt SHA-256 `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`.

This inventory maps every numerical binding in the four calculation profiles consumed by the M78 synthetic candidate. It is source and accounting preparation for independent review. It does not approve a source, method, rights position, production release, customer inventory, SB 253 claim, filing readiness or assurance. The machine-readable authority for this preparation is [m79-method-source-inventory.json](m79-method-source-inventory.json).

## Result

All four current profiles and all twelve gas/factor rows are accounted for. Every row resolves to a retained source hash, exact workbook cell, unit, period, method identity, GWP policy, rounding rule and estimate/zero treatment. The retained source bytes were freshly reopened read-only on 2026-09-22. The exact hashes matched the historical manifests and M78 observations; the selected XLSX cells were read again from ZIP/XML, and selected PDF pages were parsed again locally.

The result remains fail-closed. Every profile is a development candidate. Production domain applicability and intended-use rights remain unresolved; no effective-dated release record exists; real customer evidence is absent. Therefore every profile remains blocked for production and `releaseEligible=false`.

## Evidence boundary

Historical evidence and fresh verification are kept distinct:

- Historical M78 observations: `evaluations/calculation-specs/m78-source-observations.json`, SHA-256 `4e3dcd2188a951a73a480a2d12b4f8b97a6e27fd32d1838c470f1a7252065eb0`.
- Fresh local verification: seven retained files were present; fresh SHA-256 and byte lengths matched. The EPA workbook was opened as XLSX ZIP/XML, not through application calculation code. Selected PDFs were reopened with a local read-only parser. No current remote bytes were downloaded or rehashed.
- Source catalog state remains `runtime_eligible=false`, `runtime_approval=not_evaluated`, and `rights_review=null` for every retained artifact used here. A hash and URL establish neither applicability nor permission.

| Retained original | Edition / locator | Bytes | Fresh SHA-256 |
| --- | --- | ---: | --- |
| EPA GHG Emission Factors Hub workbook | `Emission Factors Hub!F3`: January 15, 2025 | 1,014,275 | `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7` |
| EPA Factors Hub PDF | January 15, 2025; PDF pp. 1-3, 5 | 478,277 | `5d07c678fae6783623acb1e23faa4a7c46268ee6c5a0654c9e49c50de7caf924` |
| EPA stationary guidance | December 2023; printed pp. 4-5, 8-16 | 632,187 | `9e9899f728932125543d85f97f71f11d4928580e7ca17ae9858f4c34d0a9c124` |
| EPA mobile guidance | December 2023; printed pp. 1-5, 7-13 | 600,190 | `f80e3400d2485d4e253211cfb69a923e16920d393da21f6991cbaed493804402` |
| EPA fugitive guidance | December 2023; printed pp. 3, 8, 15 | 525,314 | `fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88` |
| GHG Protocol required-gases/GWP amendment | February 2013 per inherited contracts; printed pp. 1-2 | 258,571 | `2bc8b42d4cb94d1f74ae477f3bfaf3eb7ab55f216f575050ebdd67c9447a3a7f` |
| GHG Protocol Corporate Standard | Revised Edition retained bytes; printed pp. 17-18, 62 | 3,680,902 | `cfcda4dd20a0b0936b30e5e5c7c635c26efdfa770d29c1004f549bf082c0fe3c` |

## Exact profile and method identities

The governing M78 policy remains `proposed_accounting_candidate`, raw SHA-256 `0fe8cb9bfb48e7a8dd0b5b40d491918f57f33288da12daa9de1d9406080da6c4`, canonical SHA-256 `22ce42a64147cca75c4fe8028a51a416d8232c72d167518f23dc31e28c989f0e`, and `releaseEligible=false`.

| Profile | Method / version | Whole method SHA-256 | Engine SHA-256 | Factor / GWP identity |
| --- | --- | --- | --- | --- |
| Stationary natural gas | `stationary-natural-gas-combustion` / `m73-development-v1` | `a596ea0d377f33ac34e1333852c313c855c2a18ac08006525a78bbfb7cce9898` | `e1b91d4fa6afa1126eeb642769c458d0b0b747c12ad5ee172543afb9246eaa14`; dependency `eebade88f291cec281f38efe09597a107ce24904f28782d51405e739c4d37603` | factor `80da7b01f57c852a1bca9a6f80a23636baef02091cd26880a7395c8331f5a20f`; GWP `d87fb6c54a170e1dff70327bf475774febb3681a754cb8abec9c4c31efa3b908` |
| Controlled mobile diesel | `mobile-diesel-combustion` / `m74-development-v1` | `7598384902729e8a6708beb359e7564f500ad85c0d3ad38f094ee580a05c0497` | `1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6` | factor `416931c40b347f1e22e9d4019ca1c28bd27ce40d7c16a3beeac3dadbbb783187`; GWP `c151f9b90b23eba7ee9d36dd57a851ecf7a6f200c915579819b683d2b3b3c1c7` |
| Stationary No. 2 distillate | `m76.stationary-distillate-no2.ca2025.ar5.default-hhv.v1` / `m76-development-v1` | `8924b6c99a7b2b1525f2f2ef641978bbdfc5c7116c40a9fc828e418e56a4a722` | `60de93b901185527affd1eae73d400582cc9d041ecd13bb5668c9041374f6266` | factor `7f2a655ff2fc3a214f8f076aeaf7acebc25a50f89801985f255157a3ab3a85d0`; GWP `c151f9b90b23eba7ee9d36dd57a851ecf7a6f200c915579819b683d2b3b3c1c7` |
| Stable serviced fugitive equipment | `m77-stable-serviced-equipment-2025-candidate-v1` | `acbfed90deaf7c164fe889b87732a998396ace265c92973ba3f79c6a71c038af` | `3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4` | expanded factor/GWP descriptor `80a514d4596fc214ea3086941b37377f9e939f7541e40590fa4ee243deb1e24d`; guidance `fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88` |

M73’s GWP descriptor has a different schema from the shared M74/M76 descriptor. The frozen M78 allowlist maps both exact hashes to the same published CO2/CH4/N2O values `1/28/265`; equality of labels or numbers cannot admit another hash.

## Method/source matrix

All rows use the January 15, 2025 EPA workbook SHA-256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`, sheet `Emission Factors Hub`, calendar 2025 (`2025-01-01` to `2026-01-01` exclusive), AR5 100-year GWP, exact decimal intermediates and final half-even rounding to four decimal kg CO2e.

| Row | Activity / heat basis | Exact factor cell and published value | Mass / GWP binding | Estimate and zero treatment |
| --- | --- | --- | --- | --- |
| `natural_gas.co2` | Consumed MMBtu, HHV (`D14`, `C94`) | `E38` = `53.06 kg CO2/MMBtu` | kg CO2; `E524` = 1 | Default factor on supplied consumed energy; no activity conversion. Zero requires aligned evidence and rationale. |
| `natural_gas.ch4` | Consumed MMBtu, HHV | `F38` = `1.0 g CH4/MMBtu` | divide 1,000 to kg; `E525` = 28 | Same. Raw XML `1`; displayed one decimal governs. |
| `natural_gas.n2o` | Consumed MMBtu, HHV | `G38` = `0.10 g N2O/MMBtu` | divide 1,000 to kg; `E526` = 265 | Same. Raw XML `0.1`; displayed two decimals govern. |
| `mobile_diesel.co2` | Consumed U.S. gallons; direct volume factor | `D107` = `10.21 kg CO2/gallon`; `C107:E107` | kg CO2; `E524` = 1 | No fuel-economy, spend or annualization estimate. Both gallons and miles required; mixed zero refused. |
| `mobile_diesel.ch4` | Actual vehicle-miles; Medium/Heavy Diesel, model years 2007-2022 (`C255:E256`) | `F256` = `0.0095 g CH4/vehicle-mile`; unit `F248` | divide 1,000 to kg; `E525` = 28 | Same. Raw XML tail is not precision. |
| `mobile_diesel.n2o` | Same actual vehicle-miles and class/year | `G256` = `0.0431 g N2O/vehicle-mile`; unit `G248` | divide 1,000 to kg; `E526` = 265 | Same. Raw XML tail is not precision. |
| `stationary_diesel.co2` | Directly metered U.S. gallons; default `D55` = `0.138 MMBtu HHV/gallon` | `E55` = `73.96 kg CO2/MMBtu` | kg CO2; `E524` = 1 | Default HHV estimate only when supplier HHV/carbon are unavailable. Never mix rounded `H55:J55`. |
| `stationary_diesel.ch4` | Same default HHV route | `F55` = `3.0 g CH4/MMBtu` | divide 1,000 to kg; `E525` = 28 | Same. Zero requires a statement/rationale covering test and maintenance runs. |
| `stationary_diesel.n2o` | Same default HHV route | `G55` = `0.60 g N2O/MMBtu` | divide 1,000 to kg; `E526` = 265 | Same. Binary XML tails are not precision. |
| `fugitive.hfc134a` | Sum total kg HFC-134a consumed in servicing; no heat basis | gas `C532`; `E532` = GWP `1300` | whole named gas kg × 1300 | Candidate method estimate, not measured leakage. Zero requires complete annual/full-charge evidence and explicit zero attestation. |
| `fugitive.hfc227ea` | Sum total kg HFC-227ea consumed in admitted fire-suppression servicing | gas `C538`; `E538` = GWP `3350` | whole named gas kg × 3350 | Linked discharge reconciles to later refill and is never added again. Same strict zero rule. |
| `fugitive.r410a` | Sum total kg whole R-410A blend consumed in fixed-HVAC servicing | gas `C575`; `D575` = GWP `1924`; composition `E575` | whole-blend kg × 1924 | Use published opaque-blend GWP once. Do not substitute constituent comparison `1923.5`, infer constituent masses or add constituent CO2e. |

The combustion formulas are:

- Natural gas: `CO2=Q×53.06`; `CH4=Q×1.0/1000`; `N2O=Q×0.10/1000`; total `Q×53.1145 kg CO2e`.
- Mobile diesel: `CO2=G×10.21`; `CH4=D×0.0095/1000`; `N2O=D×0.0431/1000`; total `G×10.21 + D×0.0116875 kg CO2e`.
- Stationary diesel: `H=G×0.138`; `CO2=H×73.96`; `CH4=H×3.0/1000`; `N2O=H×0.60/1000`; total `G×10.240014 kg CO2e`.
- Fugitive: `estimated emitted kg=sum(servicing-consumed refill kg)`; `kg CO2e=estimated emitted kg×exact gas or whole-blend GWP`.

At source, facility, entity and company levels, sum unrounded current-source gas contributions and round that level once. An incompatible or unreviewed policy permits no common CO2e total or subtotal. Missing or unsupported sources permit only a compatible eligible known-source subtotal with named blockers. Gross totals cannot be reduced by offsets, credits, removals, avoided emissions or negative activity.

## Missing gates

| Gate | Current state | Required owner and action |
| --- | --- | --- |
| Exact source rows | Prepared; independent review pending | Independent source reviewer rehashes originals and confirms all 12 locators, units, displayed precision and normalization. |
| Domain applicability | Unresolved | Qualified accounting/domain reviewer approves or blocks each exact profile, factor route, GWP basis, estimate/zero rule, period and supersession policy. |
| Intended-use rights | Unresolved; may require counsel | Rights owner decides numeric calculation, excerpt/report redistribution and hosted corpus/RAG use separately for each artifact and derivative value. Public availability or government hosting is insufficient. |
| Numerical compatibility | Pending for this M79 candidate | Independent accounting reviewer rederives representative, boundary and tie cases across all four profiles and checks units, HHV, gram-to-kg conversion, R-410A, estimate/zero rules and round-once aggregation. Do not rewrite retained M73-M78 outputs. |
| Production release | Blocked | Separately authorized release owner records immutable, effective-dated release or blocked decisions after the evidence reviews. This inventory and its hashes grant no authority. |
| Customer admission | Blocked; no real evidence | Authorized customer preparer and qualified accounting reviewer reconcile actual entity, facility, source, asset, control, period, fuel, meter, mileage and servicing evidence. |
| Current requirements and claims | Separate pending work | Regulatory research, CPO and qualified legal review bind a dated customer/reporting-year requirements matrix. |
| Runtime and assurance | Out of this task | CTO/backend/security/QA integrate only after evidence decisions and the exact accepted M78 dependency; an independent assurance provider later judges the real package. |

Profile-specific customer blockers remain explicit:

- Natural gas: no real source/meter, consumed-HHV activity, fuel, period or boundary evidence.
- Mobile diesel: no real vehicle register, control, class/model-year/fuel, consumed-gallons or odometer/telematics evidence; grouping and allocation remain unsupported.
- Stationary diesel: no real generator identity, exact fuel grade, direct-meter consumption, test/maintenance coverage, or supplier-HHV/carbon availability evidence.
- Fugitive: no real equipment population, opening/closing full-charge, all-provider service/discharge, gas, retrofit, stock, recovery or disposal evidence.

## Smallest independent review handoff

Review the frozen JSON and Markdown together. The review must remain source/accounting review; it grants no release or rights approval.

1. Parse the JSON and require exactly four unique profiles and twelve unique row IDs, with three rows per profile.
2. Recompute the raw M78 policy hash, each canonical `descriptor` hash, and current engine byte hashes. Match them to this inventory without executing or rewriting old calculations or snapshots.
3. Rehash all seven retained originals. Open the workbook read-only as ZIP/XML and independently confirm `F3`, rows 38/55/107/256, units and notes, `E523:E526`, `E532`, `E538`, and `C575:E575`, including displayed styles for binary-storage tails.
4. Reopen the cited PDF pages and verify that they corroborate the mapped values/method boundaries. Record local retained-byte verification separately from any fresh remote observation.
5. Challenge every row for source edition, locator, unit, heat basis, gas, GWP, blend, rounding, estimate, zero, reporting period and method identity. Any missing or inconsistent row blocks the inventory verdict.
6. Confirm that all domain, rights, production, customer, legal and assurance gates remain unresolved or blocked. Do not translate an internal candidate acceptance into source release, license, compliance or assurance.

Minimal structural check from the repository root:

```powershell
$inventory = Get-Content -Raw -LiteralPath docs/research/m79-method-source-inventory.json | ConvertFrom-Json
$rows = @($inventory.profiles | ForEach-Object { $_.rows })
if ($inventory.profiles.Count -ne 4 -or $rows.Count -ne 12 -or (@($rows.rowId | Sort-Object -Unique).Count -ne 12)) { throw 'M79 inventory cardinality mismatch' }
if ($inventory.inventoryVerdict.productionReleased -or $inventory.inventoryVerdict.releaseEligible -or $inventory.inventoryVerdict.scope1Complete) { throw 'M79 inventory contains an unauthorized release claim' }
```

The next owner is an independent accounting/source reviewer. Qualified rights and domain owners then decide each row; CTO/backend integration begins only after those decisions and the exact accepted M78 release dependency are frozen.
