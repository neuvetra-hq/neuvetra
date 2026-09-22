# M79 numerical compatibility candidate1 — independent accounting review

Date observed: **2026-09-22**. Task `M79-NUMERICAL-INDEPENDENT-REVIEW-01`; reviewer `/root/m79_numerical_review`; accounting-validation role reporting to Head of QA. Registered route `gpt-5.6-sol/high` was requested; observed model and effort are unavailable. Role prompt SHA-256 `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`. The reviewer did not author the M79 inventory, numerical candidate, source workbook, M73–M78 engines or expected/result files.

## Verdict

**Accept candidate1 for bounded numerical preparation only.** The exact frozen dossier and its four supporting files establish arithmetic compatibility between the four current candidate profiles and the current pinned engines. No material numerical discrepancy was found. This acceptance does not approve the source or method for production, domain applicability, intended-use rights, customer data, inventory completeness, SB 253 reporting, a release record, legal claims or external assurance.

The reviewed dossier SHA-256 is `84e189333b1c36d3dbfec041e8cb74a5182955877a27c94736df29fd7c3daafc`. Author snapshot SHA-256 `2ca05e1fe65f3376035343ee5fc09350f80fe747b58c001524b104e87f74f090` contains five files whose embedded hashes and current bytes all match: derivation script `0e7dfc697abcc0e849a3e1d50f6092136ef5ed8184b0abada3a357003157535f`, expectations `4631c72e76e9a65972eaa7a82a306514ed1d2ad70e9c42e2b8d35d7882780c46`, result receipt `2544773778df3592f5699995616fce1a187a0d56c3d0f6c2a1c3ab9762b675fd`, application tests `f0dc9cfce03b6d4d20ded211c558909ee6e60ccb484b9e2554eaa04cb0a63c32`, and the dossier hash above.

## Source and engine binding

The accepted method/source inventory remains exact at SHA-256 `d5f50b6e2d49b1ce027affe08ccfe422174b59df60c408b544212f232b9a8022`. I reopened the retained EPA workbook read-only. Its 1,014,275 bytes rehashed to `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`, and `F3` still identifies the January 15, 2025 edition.

The workbook values and number formats independently confirm the candidate's published precision: natural gas `E38/F38/G38 = 53.06/1.0/0.10`; stationary diesel `D55/E55/F55/G55 = 0.138/73.96/3.0/0.60`; mobile diesel `D107/F256/G256 = 10.21/0.0095/0.0431`; common GWP cells `E524/E525/E526 = 1/28/265`; and fugitive values `E532/E538/D575 = 1300/3350/1924`. `C575:E575` identifies R-410A, published whole-blend GWP 1924 and the 50% HFC-32 / 50% HFC-125 disclosure. This review relies on the already accepted source inventory for the PDF method/applicability mapping; it does not convert source identity into domain or rights approval.

The current engine bytes match every candidate pin: natural gas `e1b91d4fa6afa1126eeb642769c458d0b0b747c12ad5ee172543afb9246eaa14`, its frozen dependency `eebade88f291cec281f38efe09597a107ce24904f28782d51405e739c4d37603`, mobile diesel `1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6`, stationary diesel `60de93b901185527affd1eae73d400582cc9d041ecd13bb5668c9041374f6266`, and fugitive `3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4`. The four method hashes are inherited from the exact accepted inventory, whose independent review recomputed the descriptors; this numerical review did not substitute label or value equality for those pins.

## Independent numerical challenge

I recalculated all 18 expected cases independently with decimal arithmetic from the workbook values, including every gas row and total. All 18 matched the frozen expected gas masses, gas CO2e, exact totals and four-decimal displays. This check did not run the author script or rewrite its expected/result/snapshot files.

The conversions are coherent and explicit. Natural-gas and stationary-diesel CH4/N2O factors convert grams to kilograms by dividing by 1,000. Mobile CO2 uses consumed gallons while CH4/N2O use actual vehicle-miles. Stationary diesel first converts gallons through `0.138 MMBtu HHV/gallon`, then applies the three HHV energy factors. The candidate exposes that route as `default_hhv_estimate`, and the application validator requires direct-meter facts plus explicit unavailability of supplier-specific HHV and carbon data.

Both half-even tie directions are discriminating in every profile. The even-lower cases `5.31145`, `10.23805`, `768.00105` and `0.01005` round down at four decimals; the odd-lower cases `15.93435`, `10.21935`, `256.00035` and `0.00335` round up. The two aggregation challenges also pass: exact components of `0.00335` sum to `0.0067` rather than the displayed-component sum `0.0068`, while exact components of `0.01005` sum to `0.0201` rather than `0.0200`. The current M78 layer therefore sums unrounded contributions and rounds the parent once.

R-410A is treated correctly as an opaque published blend: `2.5 kg × 1924 = 4810 kg CO2e`. The `1923.5` constituent comparison gives `4808.75` but remains explicitly unused. No constituent mass, constituent line or additional constituent CO2e is inferred.

## Admission and boundary challenge

The author receipt records six refusals plus one linked-release reconciliation across the exact pinned engines. The five application tests passed again with 24 assertions and exercise public validator/reconciliation behavior: missing versus explicit zero, mobile mixed-zero refusal, stationary default-HHV eligibility and unsupported zero, fugitive estimate/unsupported gas-equipment handling, and round-once aggregation. These are meaningful admission checks rather than the source-derived numerical oracle; the arithmetic oracle remains separate.

The frozen expectations list negative combustion activity as a refusal expectation, but no negative case appears among the author's seven recorded engine boundary results. I therefore sent isolated `-0.001` inputs to each of the three pinned combustion engines. Natural gas, mobile diesel and stationary diesel each returned their generic error status and exit code 2. This is a reviewer-side coverage supplement, not a change to the author result. Fugitive negative mass is independently blocked by the engine's unsigned mass grammar and positive-refill rule. The omission is non-material to the bounded verdict because the behavior is directly verified here and the dossier did not claim negative activity was one of its seven author cases.

Explicit arithmetic zero remains distinct from missing, excluded or unsupported activity. The linked HFC-227ea release is reconciled to its refill and is not added again. The fugitive zero remains an unauthenticated candidate estimate, not measured zero. No tested admission path turns absent activity, incompatible units, an unsupported vehicle/gas/equipment combination or supplier-specific-factor availability into a calculated zero.

## Remaining gates

This pass closes only independent review of candidate1's bounded numerical-preparation evidence. All four methods remain development candidates and `releaseEligible=false`. Qualified accounting/domain review must still decide factor and method applicability, GWP policy, estimate rules and supersession. Rights review, immutable effective-dated source/method release decisions, actual customer boundary/activity/evidence reconciliation, current legal requirements, product integration, tenant/security/recovery testing and independent external assurance remain separate gates. Root remains the final admission owner.
