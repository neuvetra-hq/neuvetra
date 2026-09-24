# M79 numerical compatibility dossier

Date: 2026-09-22. Task `M79-NUMERICAL-COMPATIBILITY-01`; author `/root/m79_numerical`, accounting-validation role reporting to Head of QA. Requested route `gpt-5.6-sol/high`; observed model and effort are unavailable. Role prompt SHA-256 `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`.

## Verdict

**PASS for bounded numerical compatibility of the four current M78 candidate profiles and their twelve current gas/factor rows.** Eighteen independently derived numerical cases matched the exact pinned calculation engines, seven direct engine boundary cases had the expected disposition, and five current application-boundary tests passed with 24 assertions. No numerical discrepancy was observed.

This verdict is only arithmetic and admission compatibility for the exact retained candidate versions. It does not approve any source, method, domain applicability, intended-use right, customer data, production release, SB 253 claim, inventory completeness, filing readiness, legal conclusion or external assurance. All four methods remain development candidates and `releaseEligible=false`.

The independent expectations are [m79-numerical-expected.json](../../evaluations/calculation-specs/m79-numerical-expected.json), the black-box comparison receipt is [m79-numerical-result.json](../../evaluations/calculation-specs/m79-numerical-result.json), the reproducible derivation/comparison is [m79-numerical-compatibility.py](../../evaluations/calculation-specs/m79-numerical-compatibility.py), and application boundary checks are [m79-numerical-boundaries.test.ts](../../evaluations/calculation-specs/m79-numerical-boundaries.test.ts). The expectation code imports no Neuvetra calculation module or formula.

## Exact review boundary

The accepted method/source inventory was read at SHA-256 `d5f50b6e2d49b1ce027affe08ccfe422174b59df60c408b544212f232b9a8022`. The candidate M78 policy remains raw SHA-256 `0fe8cb9bfb48e7a8dd0b5b40d491918f57f33288da12daa9de1d9406080da6c4`, status `proposed_accounting_candidate`, and release-ineligible.

| Profile | Method SHA-256 | Exact engine SHA-256 | Rows tested |
| --- | --- | --- | --- |
| Stationary natural gas, supplied HHV MMBtu | `a596ea0d377f33ac34e1333852c313c855c2a18ac08006525a78bbfb7cce9898` | `e1b91d4fa6afa1126eeb642769c458d0b0b747c12ad5ee172543afb9246eaa14`; frozen dependency `eebade88f291cec281f38efe09597a107ce24904f28782d51405e739c4d37603` | CO2, CH4, N2O |
| Controlled on-road fossil diesel, medium/heavy 2007–2022 | `7598384902729e8a6708beb359e7564f500ad85c0d3ad38f094ee580a05c0497` | `1dc0bb7249d91e854004a8cadd34068be3fc03ecdd6e10b4cf297d375d7f52a6` | CO2, CH4, N2O |
| Stationary fossil Distillate No. 2 generator, default HHV | `8924b6c99a7b2b1525f2f2ef641978bbdfc5c7116c40a9fc828e418e56a4a722` | `60de93b901185527affd1eae73d400582cc9d041ecd13bb5668c9041374f6266` | CO2, CH4, N2O |
| Stable serviced fugitive equipment | `acbfed90deaf7c164fe889b87732a998396ace265c92973ba3f79c6a71c038af` | `3c81c8d1b4ee6b2435765013d0578021556b70d35f16e4512ebecf1c873f25b4` | HFC-134a, HFC-227ea, whole-blend R-410A |

The retained EPA workbook was freshly opened as XLSX ZIP/XML. Its 1,014,275 bytes matched SHA-256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`; `Emission Factors Hub!F3` identified the January 15, 2025 edition. The independent derivation used the published display precision of the source cells, not binary-storage tails:

| Source rows | Locators and published values used |
| --- | --- |
| Natural gas | `E38=53.06 kg CO2/MMBtu`; `F38=1.0 g CH4/MMBtu`; `G38=0.10 g N2O/MMBtu` |
| Mobile diesel | `D107=10.21 kg CO2/US gallon`; `F256=0.0095 g CH4/vehicle-mile`; `G256=0.0431 g N2O/vehicle-mile` |
| Stationary diesel | `D55=0.138 MMBtu HHV/US gallon`; `E55=73.96 kg CO2/MMBtu`; `F55=3.0 g CH4/MMBtu`; `G55=0.60 g N2O/MMBtu` |
| Common GWPs | `E524=1`; `E525=28`; `E526=265` |
| Fugitive GWPs | `E532=1300`; `E538=3350`; `D575=1924`; `E575="50% HFC-32 , 50% HFC-125"` |

The retained EPA factor PDF corroborated stationary factors on PDF page 1, mobile CO2 on page 2, medium/heavy 2007–2022 diesel CH4/N2O on page 3, and the GWP/mixture tables on page 5. The retained stationary guidance described direct energy-factor multiplication and HHV use on printed pages 4–5; the mobile guidance described vehicle-mile CH4/N2O calculation and source-data choices on printed pages 5–9; the fugitive guidance described the simplified material-balance method and its no-stock/no-retrofit boundary on printed page 8 and uncertainty on printed page 15. These local retained bytes were not refreshed from remote sources in this task.

## Independently derived results versus current engines

The representative cases exercise every one of the twelve rows. Each engine returned the same gas mass, gas CO2e, exact source total and four-decimal display as the independent Fraction-based result.

| Profile / activity | Independent exact kg CO2e | Display | Result |
| --- | ---: | ---: | --- |
| Natural gas `1250.125 MMBtu HHV` | `66399.7643125` | `66399.7643` | exact match |
| Mobile diesel `1000.125 US gal`, `12000.500 vehicle-mi` | `10351.53209375` | `10351.5321` | exact match |
| Stationary diesel `250.125 US gal`; derived `34.51725 MMBtu HHV` | `2561.28350175` | `2561.2835` | exact match |
| HFC-134a service refill `0.125000 kg` | `162.5` | `162.5000` | exact match |
| HFC-227ea service refill `2.500003 kg` | `8375.01005` | `8375.0100` | exact match |
| Whole-blend R-410A service refill `2.500000 kg` | `4810` | `4810.0000` | exact match |

The source-unit conversions also matched: natural-gas CH4 `1.0 g → 0.001 kg` per MMBtu, natural-gas N2O `0.10 g → 0.0001 kg` per MMBtu, mobile CH4 `0.0095 g → 0.0000095 kg` per vehicle-mile, mobile N2O `0.0431 g → 0.0000431 kg` per vehicle-mile, and stationary diesel first converts each gallon to `0.138 MMBtu HHV` before applying the three energy factors. The stationary engine exposed `basis=default_hhv_estimate`; the application validator separately required explicit unavailability of supplier-specific HHV and carbon data.

## Rounding and aggregation

The pinned policy is **round-half-to-even at four decimal kg CO2e**, not half-up. Both tie directions were tested for every profile:

| Profile | Even-lower tie: exact → display | Odd-lower tie: exact → display |
| --- | --- | --- |
| Natural gas | `5.31145 → 5.3114` | `15.93435 → 15.9344` |
| Mobile diesel | `10.23805 → 10.2380` | `10.21935 → 10.2194` |
| Stationary diesel | `768.00105 → 768.0010` | `256.00035 → 256.0004` |
| HFC-227ea | `0.01005 → 0.0100` | `0.00335 → 0.0034` |

The four even-lower cases would round upward under half-up, so they distinguish the actual policy. All matched the pinned engines; there was no policy discrepancy.

The current M78 aggregation functions were compared with separately generated expected values. Two sources of exact `0.00335` each aggregate to exact/display `0.0067`; summing their displayed values would incorrectly yield `0.0068`. Two sources of exact `0.01005` each aggregate to exact/display `0.0201`; summing their displayed values would yield `0.0200`. Current behavior sums unrounded contributions and rounds the parent once. The `±0.0001` display deltas are presentation reconciliation values, not emissions adjustments.

## Zero, missing, unsupported and estimate boundaries

- All four explicit arithmetic-zero cases returned exact `0` and display `0.0000` only when invoked with the exact numerical contract. The application checks separately distinguish evidence-backed explicit zero from missing activity. Natural gas rejects a zero save without its matching statement and no-consumption rationale. Stationary diesel labels an unsupported zero and requires a rationale covering testing and maintenance. Fugitive zero remains `candidate_method_estimate` with `evidence_verified=false` and requires full-charge, annual-record and explicit zero-evidence facts.
- Natural gas missing quantity and unsupported `scf` input were refused by the pinned engine. Missing natural-gas activity remains a named `activity_missing` application finding and produces no calculation.
- Mobile diesel unsupported vehicle class was refused by the pinned engine. The numerical engine can represent any two admitted decimal quantities, while the application layer correctly blocks a mixed-zero gallons/miles pair with `mixed_zero_contradiction` and produces no calculation. Both quantities zero are admitted only with aligned statements, confirmations and a rationale.
- Stationary diesel rejected a noncontract `MMBtu` activity unit. The application layer refused the default-HHV statement when supplier-specific HHV was marked available, and it admitted the default estimate only with the exact direct-meter and supplier-unavailability facts.
- Fugitive unsupported `SF6` and the wrong R-410A/equipment pairing were refused. A `2.000000 kg` HFC-227ea refill linked to a `1.000000 kg` known release still produced estimated emitted mass `2 kg` and `6700 kg CO2e`; the known release reconciles to the refill and is not added again.
- Missing/unsupported compatible sources remain blockers outside an eligible known-source subtotal. An incompatible or unreviewed method/GWP policy permits no common CO2e subtotal. This dossier did not construct a production inventory or clear those coverage findings.

## Opaque R-410A treatment

The test uses `2.5 kg × 1924 = 4810 kg CO2e` once for the whole blend. The composition text was retained as disclosure only. No HFC-32 or HFC-125 mass was inferred and no constituent line was added. The arithmetic comparison `2.5 × 1923.5 = 4808.75` is explicitly retained as **not used**; it does not replace the source's published whole-blend value.

## Reproduction and evidence

Executed from the repository root:

```text
python evaluations/calculation-specs/m79-numerical-compatibility.py
PASS M79: 4 profiles, 12 rows, 18 numerical cases, 7 engine boundaries

bun test evaluations/calculation-specs/m79-numerical-boundaries.test.ts
5 pass, 0 fail, 24 assertions
```

The black-box result retains every expected refusal and has an empty `failures` list. Existing M78 tests and expectations were read as context but were not used as the numerical oracle and were not rewritten. No hosted service, authentication, database, customer data, provider, original journal, rehearsal, product runtime, Git or shared-ledger action occurred.

## Remaining gates

This task closes only the candidate numerical-compatibility preparation gate. Independent review of this exact dossier/snapshot remains required. Qualified accounting/domain review, intended-use rights review, immutable effective-dated source/method release decisions, customer-specific boundary/activity/evidence reconciliation, current legal requirements, product integration, tenant/security/recovery verification, and qualified external assurance all remain open. No current method is authorized for production by this result.
