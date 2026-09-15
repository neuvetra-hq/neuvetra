# M64 accounting contract — synthetic January electricity worksheet

Version: `m64-accounting-policy-v1`. Reviewed September 14, 2026. Task: M64-ACCOUNTING, accounting-validation specialist, functional sponsor Head of QA. Requested compute: `gpt-6-astra` / `high`; observed runtime settings unknown. Role prompt SHA-256: `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`.

**Verdict: approved for implementing this bounded synthetic input profile.** This approves the variable-quantity policy and independently derived numerical expectations below. It does not approve the resulting software, release a factor/method, establish professional assurance, or authorize customer accounting. The author has not authored M64 product implementation or the inherited M53/M56 fixtures. Independent integrated QA remains required.

## Scope and applicability

Profile ID: `manual-synthetic-2023-01-camx-kwh-v1`. One explicitly fictional facility, January 1–31, 2023 inclusive, explicitly declared United States / California / CAMX, operational-control draft boundary, grid-delivered purchased electricity consumed by the reporting company, location-based Scope 2. A fictional facility name does not establish real geographic applicability. CAMX is a fixed declared condition of this profile, never inferred from California or the name.

The annual 2023 eGRID factor is applied to the January activity quantity. This is a January subtotal using an annual regional average, not a January-specific factor or an annual inventory. Do not annualize the quantity or prorate the factor by 31/365. The remaining months and other inventory sources remain outside this worksheet; overall completeness stays incomplete. Zero does not resolve those omissions.

EPA recommends matching historical inventory years to eGRID data years and using subregion output rates for electricity-use estimates. These support retention of the existing 2023/CAMX candidate for this historical synthetic slice; they do not prove any fictional facility's real service territory. [EPA eGRID FAQ, questions 11–12 and 18–19, rechecked September 14, 2026](https://www.epa.gov/egrid/frequent-questions-about-egrid).

Preserve M53's fixed 1 MWh contract, M56's fixed reviewed bill contract, and all existing M63 report/review bytes. Introduce a distinct profile and adapter; do not relax their fixed decoders. No market-based accounting, certificate claim, customer evidence, other dates/regions/units, negative consumption/export netting, Scope 1/3, upstream/loss addition, annual-report integration or new factor selection is approved.

## Original evidence and unchanged candidate pins

The retained workbook was independently opened as XLSX XML and its hash recomputed during this assignment:

- Local evidence: `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/egrid2023_data_metric_rev2.xlsx`.
- SHA-256: `3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab`.
- [EPA metric workbook, eGRID2023 revision 2](https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_metric_rev2.xlsx), `SRL23`: `A6=2023`, `B6=CAMX`, `C6=WECC California`. Headers `AC1`, `AE1`, `AG1`, `AI1` identify annual total-output rates in kg/MWh.

| Rate | Source cell | Existing candidate decimal |
| --- | --- | --- |
| CO2 mass | `SRL23!AC6` | `194.3512704 kg CO2/MWh` |
| CH4 mass | `SRL23!AE6` | `0.01134 kg CH4/MWh` |
| N2O mass | `SRL23!AG6` | `0.0013608 kg N2O/MWh` |
| Authoritative CO2e total | `SRL23!AI6` | `195.0402888 kg CO2e/MWh` |

Source precision disclosure: the workbook XML numeric serialization is `1.1339999999999999E-2` for AE6, `1.3607999999999999E-3` for AG6 and `195.04028880000001` for AI6. The table deliberately preserves the previously reviewed candidate decimal normalization; it does not claim that those decimal strings are the literal XML values. M64 must not reimport binary floating-point tails or silently change the candidate. A later factor-release review can reassess normalization separately.

Method ID/version: `scope2-location-based-egrid-subregion` / `2023-r2-camx-v1`. Factor ID/version: `epa-egrid2023-r2-camx-total-output` / `eGRID2023-revision-2`. Existing factor candidate digest: `8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356`. Existing GWP digest: `fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5`.

GWP stays AR5 100-year without climate-carbon feedbacks: CO2 1, CH4 28, N2O 265. This is the eGRID policy, not an independently selectable reporting-program policy. [EPA eGRID2023 Technical Guide, printed page 12, section 3.1.1.2 and Table 3-1, rechecked September 14, 2026](https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf).

Inspected engine: `apps/site-api/src/calculation/location_based_electricity.py`, SHA-256 `4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c`. Inspected conversion precedent: `apps/site-api/src/calculation/linked_bill_calculation.py`, SHA-256 `ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e`. Bind these authorities and the new adapter/policy version in M64 lineage; arithmetic approval is conditional on their pins remaining unchanged.

## Input grammar, bounds and missingness

The API quantity is a JSON **string**. Match the entire string against ASCII grammar `(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,3})?`, then perform an exact decimal range check `0 <= quantity <= 1000000`. Maximum accepted text length is 11 characters. Require true full-string matching: a final newline must not pass an end anchor. Do not trim, parse as binary float, coerce another JSON type or round an invalid input to make it valid.

Accepted examples: `0`, `0.000`, `1`, `1.2`, `1.230`, `12345.678`, `1000000.000`. Reject missing field, null, JSON number/boolean/array/object, empty or whitespace text, signs including `+0`/`-0`, leading zeroes, exponent notation, decimal comma, grouping separators, Unicode digits, units appended to quantity, `.5`, `1.`, and more than three fractional digits (including otherwise redundant zeros). Reject `1000000.001` and every larger value.

The three-place precision and 1,000,000 kWh ceiling are deliberate product constraints for synthetic testing, not EPA limits, a materiality threshold, or a statement about typical/maximum facility consumption. No arbitrary choice of measurement certainty is implied.

Explicit zero is a saved manual assertion with canonical `0.000 kWh`, `0.000000 MWh`, exact emissions `0` and displayed `0.0000 kg CO2e`. It retains synthetic/manual provenance and still needs exact-version review. Missing/blank input has no quantity and produces no calculation or saved calculated version; it must never become zero. UI may retain unsaved text locally while correcting validation, but must not show the previous result as the new input's result.

Unit must be exactly `kWh`; profile geography must include CAMX and match its fixed country/state; period must match both fixed dates. Server-resolved profile fields are acceptable, but any client-supplied conflicting period/geography/unit/factor/method must refuse, not be silently ignored or overridden. Unsupported profile IDs refuse. Synthetic/manual status is server-bound and cannot be supplied away by a client.

## Exact arithmetic and serialization

After validation, canonicalize kWh to exactly three decimal places and MWh to exactly six. Equivalent allowed spellings (`1`, `1.0`, `1.000`) produce the same canonical numeric input. Treat canonicalization as representation only; preserve source/manual provenance separately. Canonical exact numerical input participates in the immutable input hash. Actor, tenant, facility, profile, dates, version identity, previous-version link and correction reason also need lineage; CTO owns the precise server schema.

Use the existing deterministic Python Decimal boundary with at least 40 significant digits of context (the existing 96 is sufficient), or an independently accepted exact equivalent. No intermediate rounding, binary floating-point arithmetic, browser-generated total, or exponent notation in serialized results.

```
MWh = canonical_kWh / 1000
authoritative_kg_CO2e = MWh * 195.0402888
CO2_kg = MWh * 194.3512704
CH4_kg = MWh * 0.01134
N2O_kg = MWh * 0.0013608
reference_component_kg_CO2e = CO2_kg + CH4_kg * 28 + N2O_kg * 265
published_rate_rounding_delta = authoritative_kg_CO2e - reference_component_kg_CO2e
```

The component reference rate is exactly `195.0294024`; its difference from the authoritative rate is `0.0108864 kg CO2e/MWh`. Show any component reconciliation as an inspection reference, never substitute it for AI6 or relabel the difference as quantified uncertainty. These rounded source-rate differences do not establish measurement accuracy.

Serialize exact totals, gas quantities and reconciliation quantities as plain decimal strings with insignificant trailing fractional zeros removed (`0` for zero). At most 13 fractional places are necessary for this profile's exact authoritative total. Only display formatting rounds: `ROUND_HALF_EVEN` to four fractional places, including trailing zeros, unit `kg CO2e`. Round once from the exact total. Thousands separators may be visual formatting only; stored/API decimal strings have none. Arithmetic precision does not represent measurement uncertainty or inventory completeness.

## Corrections and review

Corrections create immutable versions linked to their predecessor, canonical changed quantity and a required nonblank reason. Require a changed canonical quantity: changing `1` to `1.000` alone is a no-op and must not create a correction version. Keep the prior input, result, hash and review intact. A new version starts unreviewed even if its four-place displayed subtotal matches the earlier one. Changing back to a historically used quantity is still a new version; historical approval never transfers. Same-version retries converge; a stale base version refuses. No valid result/version/success event may be created for invalid quantity or context.

A different authorized manager reviews the exact saved version and its input/result hashes. Manual entry and manager acceptance do not authenticate a bill or establish released accounting. Every version and its review remain synthetic, incomplete, unreleased, without assurance and `release_eligible=false`. M64 worksheet acceptance must not flow into the existing M63 annual report.

## Independently derived acceptance cases

The companion `evaluations/research-qa/m64-accounting-cases.json` is a public engineering contract fixture, not a held-out evaluator answer set. It was generated using standalone Python Decimal calculations from the reviewed candidate rates without importing the product engine; each authoritative total and displayed total was cross-checked with integer rational arithmetic. All inputs are invented synthetic test quantities.

| Case | kWh | Exact kg CO2e | Display kg CO2e |
| --- | ---: | ---: | ---: |
| Explicit zero | 0 | 0 | 0.0000 |
| Smallest positive increment | 0.001 | 0.0001950402888 | 0.0002 |
| One kWh | 1 | 0.1950402888 | 0.1950 |
| M53 authority scale | 1000 | 195.0402888 | 195.0403 |
| Correction predecessor | 12345 | 2407.772365236 | 2407.7724 |
| M56 equality checkpoint | 12346 | 2407.9674055248 | 2407.9674 |
| Fractional manual quantity | 12345.678 | 2407.9046025518064 | 2407.9046 |
| Half-even rounds downward | 62500 | 12190.01805 | 12190.0180 |
| Half-even rounds upward | 187500 | 36570.05415 | 36570.0542 |
| Immediately below ceiling | 999999.999 | 195040.2886049597112 | 195040.2886 |
| Inclusive ceiling | 1000000 | 195040.2888 | 195040.2888 |

For independent reconstruction, let `n` be the integer number of milli-kWh. Exact total is `n * 1950402888 / 10^13`. To get four-place display, divide `n * 1950402888` by `10^9`, retain the quotient, and increment only when the remainder exceeds half the divisor or equals half with an odd quotient. The two exact tie cases exercise both parity outcomes. Correction `12345 -> 12346` increases the exact result by `0.1950402888 kg CO2e`; correction back to zero yields exact `0`, never missing.

Validation evidence for this specification: original workbook hash/cell/header inspection; direct official guide/FAQ review; inherited engine/conversion source inspection; standalone Decimal versus integer-rational cross-check of every positive expected case; companion JSON parse and grammar/range assertions. Product API/database/browser behavior is untested by this accounting assignment and remains CTO/independent QA work. Applicable lessons: L02 (semantic lineage, not claimed hashes alone) and L03 (canonical strings across storage/API/browser).
