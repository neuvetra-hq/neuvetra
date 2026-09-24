# M74 mobile diesel accounting contract

Date: 2026-09-15. Task: M74-ACCOUNTING-SCOPE1. Author: `/root/m74_accounting`; sponsor QA/CPO. Requested critical `gpt-6-astra/high`; observed model/effort unknown. Role prompt SHA-256: `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36`. This is a candidate contract, not independent approval of its implementation or a customer method release. Root owns shared records, integration, Git and hosting. Board standing authorization, relayed in the assignment, permits sequential bounded Scope 1 work without routine feedback stops; it does not waive review or release gates.

## Chosen increment and boundary

CPO and CTO were consulted directly. The recommended next family is on-road diesel distribution vehicles, because it adds a material source family and the distinct fuel-plus-distance accounting pathway. This priority is a product judgment, not a finding about a particular company's emissions or legal duties. An additional stationary-fuel worksheet alone would leave mobile coverage absent.

Candidate ID: `m74.mobile-diesel-medium-heavy.ca2025.ar5.v1`. One immutable annual stream represents one stable physical vehicle and one fuel, under a saved corporate inventory boundary. Supported vehicle classification is the EPA table's **Medium- and Heavy-Duty Vehicles**, diesel, model year 2007 through 2022 inclusive. A supplier or asset name alone does not prove classification. Retain vehicle identifier, model year, documented class basis and operational-control decision. Synthetic fixtures explicitly state these facts. Real classification evidence requires domain acceptance; this contract does not invent a GVWR threshold.

Company/entity and vehicle home facility are California/U.S.; period is `2025-01-01` through `2026-01-01` exclusive. Operational control and inclusion cover the full year. All activity of that vehicle in the boundary is included, including trips outside California; never clip activity at the state line. Cross-border fueling, non-U.S. units/fuels or partial control periods need separate applicability review and remain unsupported calculations, not omitted corporate sources. Leased assets require a supported control conclusion; ownership alone does not determine Scope 1. Third-party transportation is not admitted to this controlled-vehicle method.

Fuel is documented entirely fossil diesel consumed by the selected propulsion engine. Unknown composition, biodiesel or renewable diesel, blends, alternative fuels and multiple fuels are unsupported. Retain tank opening/closing reconciliation or an explicit synthetic no-change basis, consumed-versus-purchased distinction, fuel-card identity and exclusion of refunds, transfers, unrelated vehicles and auxiliary refrigeration fuel. Miles are actual vehicle-miles for the same vehicle and reporting period. Neither spend nor tonne-miles nor a guessed fuel-economy conversion is admitted. Dedicated auxiliary engines and refrigerant leaks require separate source records; they are not covered by this calculation.

## Primary evidence and exact factors

Reinspected 2026-09-15 without importing application code: retained `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/epa-factors-hub-2025.xlsx`, 1,014,275 bytes, SHA-256 `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`. ZIP/XML inspection confirms sheet **Emission Factors Hub**, edition cell F3 January 15, 2025. Current [EPA Hub](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) still lists the 2025 edition. Current [EPA PDF](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf), pages 2, 3 and 5, corroborates the following published values. Remote XLSX bytes were not downloaded/rehashed in this assignment; retained-byte identity is not a current-remote-byte claim.

| Quantity | Workbook locator | Published decimal used |
| --- | --- | --- |
| Diesel CO2 factor | Table 2, C107/D107/E107; headings C103:E103 | `10.21` kg CO2 per U.S. gallon |
| Vehicle/fuel class | Table 4, C255/D255; continued row 256 | Medium- and Heavy-Duty Vehicles / Diesel |
| Model year | E256 | 2007-2022 |
| CH4 factor | F256; unit heading F248 | `0.0095` g CH4 per vehicle-mile |
| N2O factor | G256; unit heading G248 | `0.0431` g N2O per vehicle-mile |
| GWP | Table 11 E524/E525/E526, heading E523 | CO2 `1`, CH4 `28`, N2O `265`; AR5, 100 years |

**Extraction decision:** raw XLSX XML stores D107=`10.210000000000001`, F256=`9.4999999999999998E-3`, G256=`4.3099999999999999E-2`. D107 format is two decimal places; F256/G256 format is four. The method pins the published displayed decimals corroborated by the PDF; it does not turn binary storage artifacts into extra scientific precision. Store raw text, formatting and selected exact decimal in factor provenance. Independent domain review must confirm this normalization. Do not apply arbitrary decimal trimming to other sources.

The table notes identify combustion-only factors and cite EPA's 2024 national inventory annexes A-84/A-85 for non-CO2 factors. This is organizational default-factor accounting, not proof of vehicle-specific accuracy or GHGRP/MRR applicability. Source table years are vehicle **model years**, not a ban on using an older vehicle during reporting year 2025; later model years remain outside this bounded candidate.

[EPA mobile guidance, December 2023](https://www.epa.gov/sites/default/files/2020-12/documents/mobileemissions.pdf), printed pp. 1-5 and 7-13, supports separate fuel-based CO2 and distance/technology-based on-road CH4/N2O, all-three-gas accounting, activity reconciliation and uncertainty disclosure. Its default-volume approach has greater uncertainty than suitable fuel-specific information. This candidate does not silently override superior available data: a real-use reviewer must justify defaults or select another approved method. The [GHG Protocol gases/GWP amendment, February 2013](https://ghgprotocol.org/sites/default/files/2022-12/Required%20gases%20and%20GWP%20values_0.pdf), printed pp. 1-2, calls for IPCC 100-year GWPs and consistency, recommends the most recent assessment but permits other assessments. AR5 is the retained candidate policy, not a claim that it is the latest assessment or mandatory for SB 253. Before customer use, resolve applicable reporting-program GWP policy across the entire inventory.

## Input and exact arithmetic

Two independent nullable JSON strings: `quantityGallons` and `distanceMiles`. Non-null syntax is `^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,3})?$`; accepted range `0` to `999999999999.999`. Persist/transport fixed three decimals. This computational bound is not a plausible vehicle activity assertion. Reject signs, exponent notation, spaces, separators, leading zeros, nonfinite values, JSON numbers and excess precision. Reject unsupported units; no automatic litre, imperial-gallon, kilometre, MMBtu or passenger-mile conversion.

For G U.S. gallons and D vehicle-miles:

1. CO2 kg = G × `10.21`.
2. CH4 kg = D × `0.0095` / `1000`; CH4 kg CO2e = CH4 kg × `28`.
3. N2O kg = D × `0.0431` / `1000`; N2O kg CO2e = N2O kg × `265`.
4. Exact total kg CO2e = G × `10.21` + D × `0.0116875`.

Use exact decimal/scaled-integer arithmetic, decimal precision at least 96 if using Decimal, with every input, factor, intermediate and output serialized as strings. No floating-point intermediate. Preserve exact gas and CO2e values; canonical exact strings omit insignificant trailing zeros. Round only the final display total to four decimals, half-to-even. Future tonnes views divide exact kilograms by 1000 before their declared display rounding. Never sum display-rounded components or old version totals. The factor-derived estimates remain uncertain despite exact computation.

`m74-accounting-fixtures.json` contains independently derived expectations using rational arithmetic cross-checked with Decimal, without application imports. Positive example G=`1000.125`, D=`12000.500` gives CO2=`10211.27625`, CH4=`0.11400475`, N2O=`0.51722155` kg; exact total=`10351.53209375`, display=`10351.5321` kg CO2e. The demonstrated mileage-only correction should keep G and change D to `12500.500`: exact `10357.37584375`, display `10357.3758`. True half-even ties use G=`1.000`, D=`2.400` giving `10.23805` -> `10.2380`, and D=`0.800` giving `10.21935` -> `10.2194`. Boundary/tie fixtures are arithmetic stress cases, not realistic fleet measurements. Include native database/API/frontend replay of maximum and half-even cases (lesson L07); arithmetic-only fixtures do not establish integrated correctness.

## Missing, zero and evidence disagreement

| Entered activity | Required behavior |
| --- | --- |
| Either or both quantities absent | Save incomplete workpaper, total null; do not show a full numeric subtotal or replace missing with zero. |
| Both strictly positive | Calculate only with matching retained evidence, supported profile and required discrepancy explanations. |
| Both zero | Require compatible zero evidence and explicit no-operation/no-consumption reason; missing documents do not establish zero. |
| Gallons zero, miles positive | Refuse numeric admission; retain unresolved inconsistency. No assumed tow/electric/hybrid explanation. |
| Gallons positive, miles zero | Refuse full numeric admission in this candidate; idling-only or auxiliary use needs a separately reviewed non-CO2 method. |

These restrictions are conservative product boundaries, not assertions that every mixed-zero real-world case is impossible. A source can be saved incomplete for investigation.

Retain separately the entered and statement quantities for **both** dimensions. Each mismatching dimension needs its own nonempty explanation, displayed as an unresolved finding. The calculation uses entered quantities explicitly, and internal review must not erase differences. A zero entry contradicted by positive statement data cannot qualify as supported zero. Missing/wrong source identity, date, class, fuel, unit, evidence hash or control basis refuses numeric admission. Annual evidence must cover both dimensions; no automatic annualization or extrapolation.

Retained evidence is visibly synthetic, exact bytes plus source/version/locator/hash/byte length. It identifies vehicle, facility, period, model year/class, fossil composition, consumed gallons, vehicle-miles, measurement basis, quantity reconciliation and its fictional issuer. Human-entered text is identified as such; retaining it is not independent authentication, OCR or audit proof. A real company needs source documents and measured/reconciled evidence beyond this fixture.

## Duplication, corrections and review

Uniqueness follows tenant/company/inventory/stable physical vehicle/fuel/year, regardless of new register versions, source aliases, renamed evidence or changed statement IDs. Asset identity must be retained authoritatively; a new source ID cannot create another counted copy of the same vehicle-year. Fleet-pooled allocations, replacement engines or fuel shifts are unsupported. A legitimate second vehicle may use the same factor, never the first vehicle's activity evidence as if it were its own.

Reuse the immutable M73 stream pattern: exact expected-head checks, idempotent same-key/same-input replay, changed-input/key conflict refusal, append-only corrections with reason/actor/time and predecessor hash. Correcting either quantity, evidence, explanation or source metadata binds a fresh complete effective-input tuple and resets review. Only one effective version can later enter a subtotal. A non-contributor reviewer acts on exact version/hash; historical reports retain exact bytes. `accepted_bounded_internal` is not method release or external assurance. L02 requires authoritative semantic reconstruction, including adversarial coordinated byte/hash/length changes; a self-consistent payload is not a trusted factor or evidence pin.

Every report shows each gas's mass and CO2e, both input/statement quantities, evidence and factor locators, GWP/edition/normalization/rounding, source/boundary/version identity, review state and unresolved findings. Label **vehicle mobile-combustion subtotal**. Set `synthetic=true`, `incompleteScope1=true`, `corporateCompleteness=incomplete`, `releaseEligible=false`, `assurance=none`.

## Release and acceptance separation

Current [EPA copyright policy](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers), Copyright Status, distinguishes noncommercial use, commercial use and individual-document terms. Current [GHG Protocol terms](https://ghgprotocol.org/terms-use), IP assets/license and prohibited uses, contain commercial-use restrictions. Neither a government URL nor a dated draft licensing announcement proves commercial corpus rights. Record `rights=unresolved_for_factor_release`; obtain specific source/use analysis before redistribution or customer factor release. No legal opinion or permission request is made by this contract.

Retained M73 authority remains `development_candidate_not_released` with `releaseEligible=false`. Research-answer corpus authorization is separate from application calculation-method authorization. A later rights finding must not itself switch runtime admission. Separate evidence-domain review, lawful-use disposition, integrated numerical/security/QA review, explicit versioned runtime method release and qualified human/customer-readiness review are required. This author grants none of them.

Required independent challenges: missing each quantity; both-zero and each mixed-zero case; minimum/maximum and half-even cases; unsupported units/model years/class/fuel; out-of-state trip preservation; wrong source/year and swapped evidence; per-dimension disagreement; duplicate physical vehicle with new IDs; single-field successors and review reset; current-only selection and immutable report replay. Root owns implementation and release evidence. This contract's preparation does not claim those checks ran.
