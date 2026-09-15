# M73 stationary natural-gas accounting contract

Date: 2026-09-15. Task: M73-ACCOUNTING. Author: /root/m73_accounting; functional sponsor QA/CPO. Requested critical gpt-6-astra/high; observed settings unknown. Role prompt SHA-256: `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`. This is the contract author's bounded candidate recommendation, not independent approval of its later implementation. Root assigns integrated independent accounting review. The board's acceptance of M72 and instruction to improve Scope 1 supersede the historical feedback wait.

## Supported profile

M73 supports a private synthetic annual source workpaper: fossil Natural Gas consumed by one stationary boiler under operational control at one California facility, entirely within `2025-01-01` to `2026-01-01` (exclusive). Quantity is energy already expressed in MMBtu on an HHV basis. Preserve the existing M42 validator; a separately versioned M73 adapter may reuse its pinned factors/GWP after checking the M73 profile.

The server resolves tenant, inventory, saved M71 version ID/hash, entity, facility, stationary source and applicable boundary decision from retained authoritative state. Facility and entity are US/CA; source domain is `stationary_combustion`; all selected activity and inclusion intervals cover the full reporting year. Consolidation is `operational_control`, with an explicit supported inclusion decision and documented synthetic control basis. Do not infer control from ownership percent alone. Unsupported or unresolved selected-boundary treatment refuses calculation and remains a gap. Other unresolved corporate gaps need not prevent this bounded source calculation.

The existing register has only purchased-electricity source rows. Add the stationary source plus matching missing/candidate coverage row through an ordinary saved M71 successor before binding a workpaper. Do not reinterpret electricity as gas, repurpose an existing ID or rewrite old register evidence. The original M71 screening artifact explicitly contains no activity measurements; it cannot substantiate fuel consumption. Relevant discovered operations elsewhere remain visible in the corporate register, even though their calculations are unsupported here.

The synthetic evidence must state energy consumed at this source; purchased or delivered fuel is not automatically combusted fuel. Shared meters, supplier-plus-distributor duplicate billing, inventory changes, feedstock use and losses require reconciliation outside this simple profile. The bounded fixture explicitly assumes a dedicated meter and no such adjustment; discovered contradictory facts prevent its use. EPA stationary guidance section 3.1 (printed page 8) specifically identifies these activity reconciliation issues.

No therm/scf/mass/volume/LHV conversion, mixed or renewable gas, mobile combustion, fugitive leaks, process emissions, fuel feedstock, offsets, equity allocation, acquisition-period splitting, monthly aggregation, CEMS or source-specific factor override is supported. These restrictions are M73 product choices, not claims that other accounting approaches are prohibited.

## Primary-source observations and release disposition

On 2026-09-15 the original retained workbook was independently opened as ZIP/XML and rehashed, without importing the application calculator:

- Path: `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-factors-hub-2025.xlsx`.
- Bytes: `1014275`; SHA-256: `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`.
- Sheet: `Emission Factors Hub`; edition locator `F3` gives January 15, 2025. Factor and GWP cells below are literal values, not formulas. This matches the retained download manifest and M42 review.

| Meaning | Exact workbook cells | Value or treatment |
| --- | --- | --- |
| Stationary table and fuel | B12/C12, C38 | Table 1; Natural Gas |
| Factor headings/units | E14:G14, E36:G36 | CO2 kg/MMBtu; CH4 and N2O g/MMBtu |
| CO2 | E38 | 53.06 kg CO2/MMBtu |
| CH4 | F38 | 1.0 g CH4/MMBtu (XML numeric value 1) |
| N2O | G38 | 0.10 g N2O/MMBtu (XML numeric value 0.1) |
| Heat and combustion basis | D14, C94, C95, C99 | HHV; full oxidation assumption; combustion only, upstream excluded |
| GWP table/horizon/assessment | B521/C521, E523, C10/C556 | AR5, 100 years |
| GWP by gas | E524, E525, E526 | CO2 1; CH4 28; N2O 265 |

The [EPA Hub page](https://www.epa.gov/climateleadership/ghg-emission-factors-hub), checked 2026-09-15, describes organizational default factors and links the 2025 workbook. The [linked PDF](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf), page 1 Table 1 and page 5 Table 11, corroborates this pinned candidate. The [canonical workbook URL](https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx) resolved as XLSX in browsing; the web parser cannot read that content type. A separate live byte download was denied by the local network sandbox. Thus the retained bytes were rehashed today; exact current remote workbook bytes were not rehashed. No automatic latest-edition substitution is allowed.

[EPA stationary-combustion guidance, December 2023](https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf), printed pages 1-2, 4 and 8-16, supports source-level direct combustion accounting, separates upstream and fugitive emissions, and requires consideration of activity quality, completeness, uncertainty and documentation. [EPA boundary guidance](https://www.epa.gov/climateleadership/determine-organizational-boundaries), Table 1, describes operational control as 100% consolidation of controlled operations. These support the candidate's conceptual treatment; they do not establish a specific customer's facts or a California filing determination.

[EPA copyright policy](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers), Copyright Status, checked 2026-09-15 (page last updated December 22, 2025), distinguishes commercial use and individual-document conditions. It does not provide the specific commercial corpus-release clearance needed here. Preserve `rights=unresolved_for_factor_release`, `factor/method=development_candidate_not_released`, `releaseEligible=false`, `assurance=none`. Factual extraction, rights, context applicability, GWP policy, independent numerical validation and runtime release are separate gates. No production source/factor release or SB 253/MRR/GHGRP compliance recommendation is made. Required next owner for any real-customer release: separate domain/rights review plus independent integrated accounting/security/release acceptance.

## Quantity and deterministic arithmetic

Accepted quantity is a JSON string matching `^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$`, from `0` through `999999999999.999`. Persist and transport activity quantity as fixed three decimals. Reject numeric JSON values, signs, exponent notation, commas, whitespace, empty strings, nonfinite values, leading-zero variants, negative values and extra precision. Do not silently round an overprecise entry. Missing is the explicit supported null state; it is not a malformed numeric string or zero.

All input, factor, intermediate and result numerics cross JSON/driver/browser boundaries as strings. Use exact decimal arithmetic or proved scaled integers; no binary-float intermediate. A Decimal precision of 96 exceeds this bounded profile's maximum exact coefficient length and matches the repaired M42 arithmetic authority. Retain exact gas values and exact total; canonical exact values omit insignificant trailing zeros, while display total is fixed four decimals.

For Q MMBtu HHV:

1. CO2 mass kg = Q * 53.06.
2. CH4 mass kg = Q * 1.0 / 1000; CH4 kg CO2e = that mass * 28.
3. N2O mass kg = Q * 0.10 / 1000; N2O kg CO2e = that mass * 265.
4. Source total kg CO2e = CO2 mass + CH4 kg CO2e + N2O kg CO2e = Q * 53.1145.
5. Round only the final display total to four decimals using round-half-to-even. Do not sum rounded components or rounded historic versions. If a tonnes view is introduced, divide the exact kg value by 1000 before its separately declared display rounding; tonnes are not required in M73.

Full numeric detail in `m73-accounting-fixtures.json` is derived independently using integer fractions and cross-checked with standalone Decimal, without invoking M42/M73 code. Key cases: `1250.125` -> exact `66399.7643125`, displayed `66399.7643`; `0.100` -> `5.3114` and `0.300` -> `15.9344`. The maximum quantity must remain exact through the actual PostgreSQL driver/API/frontend decoder. The four-place convention is a product display policy, not an accuracy or uncertainty claim.

## Activity evidence, missing, zero and discrepancy

One immutable, visibly fictional annual statement/workpaper is retained as exact UTF-8 text or original supported bytes with its own artifact ID/version, hash, byte count and locator. Minimum metadata: document label, fictional issuer, meter/source identity, facility, fuel, start/endExclusive, stated quantity, MMBtu and HHV. Bind authoritative statement bytes to those metadata, selected saved corporate source and activity version. A manually entered description is described as such; no upload, OCR, extraction or third-party authentication claim follows from a description. Separate statement quantity from manually entered quantity. A fixed bundled fixture is acceptable if the application restricts it to its declared synthetic subject and exposes that limitation.

Missing quantity saves a clearly incomplete workpaper with result null, never a zero total. Evidence may also be missing in that state. A numeric calculation requires the supported retained evidence reference. A reference alone does not prove real-world sufficiency. `Q=0` additionally requires a nonempty explicit no-consumption rationale and compatible zero-supporting evidence; blank, missing, excluded and not-applicable are different states. A positive statement with entered zero does not establish no consumption; refuse a claimed supported zero until a corrected supporting statement is retained. Zero is an edge fixture, not the happy-path demonstration.

A nonzero entered/stated discrepancy is permitted only with a nonempty explanation, displayed beside both values and retained as an unresolved finding. The calculation uses the explicitly entered quantity. An explanation or bounded internal acceptance must not silently resolve the discrepancy or turn a partial-period document into annual evidence. Evidence with wrong source/facility/fuel/year/period/unit/HHV or a hash mismatch refuses numeric admission. Do not annualize, interpolate or combine bills automatically.

## Duplicates, corrections and version/report binding

At most one effective annual workpaper stream exists for a given company, inventory, stable physical source and fuel/year; a new saved corporate boundary version does not authorize a second counted stream. A repeat idempotency key with identical effective input returns its original result. The same key with changed input refuses. A correction appends a successor and supersedes the effective input; it is never an additional consumption entry. Same retained statement/meter and annual period cannot be allocated in full to a second source; block supported-profile duplicate claims or explicitly retain them uncalculated. Cross-source aggregation and sophisticated allocation remain outside M73.

Every successor retains predecessor ID/hash, saved corporate version/hash, selected source/facility/entity, complete effective input, evidence versions/hashes, pinned factors/GWP/method, correction reason, actor and timestamp. Require current expected head/hash to prevent lost corrections. Existing saved reports retain exact original bytes after later corrections or reviews. A newer corporate register must not mutate an old workpaper; new workpaper binding requires deliberate revalidation. Reviewer decisions refer to an exact workpaper version/hash; a successor starts unreviewed. A manager who contributed to the stream cannot be its independent internal reviewer. `accepted_bounded_internal` and `changes_requested` are limited workpaper judgments and never method release, legal approval or external assurance.

Report and exported evidence package expose company/facility/source/year, register and calculation versions, input/stated quantities, evidence locator/hash, full gas trace, factor/GWP/workbook provenance, exact/display totals, rounding, correction and review state, and all unresolved findings. Recompute semantic lineage against trusted inputs on read/replay, including coordinated bytes/hash/length corruption. A self-consistent attacker-supplied hash is not a trusted source pin. Exercise the actual download entry point, compare exact stored and downloaded bytes, and assess print presentation separately.

## Required incomplete-coverage semantics and handoff

Every result/report states `synthetic=true`, `incompleteScope1=true`, `corporateCompleteness=incomplete`, `releaseEligible=false`, `assurance=none`. Label the figure as this source's stationary-combustion subtotal. A full annual entry is not all Scope 1, all stationary sources, all facilities or a corporate Scope 1-3 inventory. Mobile/process/fugitive sources, other fuels, out-of-profile facilities, Scope 2 and all 15 Scope 3 categories remain visible gaps or separate supported workstreams; upstream fuel activity is not hidden inside this total. Preserve M71 requirement uncertainty and independent assurance needs.

Required verification is mapped in fixtures: representative positive and exact zero, missing, both half-even ties, minimum/max precision, unsupported profiles/evidence, discrepancy, duplicates, corrections/review reset and immutable report replay. L02 exact stored-byte/semantic lineage and L04 actual public-boundary checks apply; L07 requires native-driver tie/boundary evidence. Contract authorship and source reinspection are complete here; M73 implementation tests, independent integrated accounting review, production rights/method release and hosted demonstration were not performed by this author.

Retained historical evidence rehashed on 2026-09-15: M42 Python `eebade88f291cec281f38efe09597a107ce24904f28782d51405e739c4d37603`; M42 QA JSON `eb448ec54476d6bfc34179baf6f69d5c6330629b46c907ab7f85a78ff18b14e7`; M71 contract TypeScript `9ab26510a66e93ae00e35e87e79e1289b275961ab02b6021b023c16ecbfa265c`. Their historical QA does not certify the new adapter or integration. Root owns staged/committed-blob checks and publication; these two contract files are UTF-8/LF with final newline.
