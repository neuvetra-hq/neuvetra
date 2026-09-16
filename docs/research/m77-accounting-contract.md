# M77 candidate accounting contract — stable serviced equipment

Prepared 2026-09-16 by root, after the board accepted M76. This is the first accounting foundation for M77, not completed M77, a released method, an inventory total, legal applicability advice or independent assurance. The requested accounting specialist dispatch and historical-worker continuation both failed with `agent thread limit reached`. Root authors this contract; `/root/m77_cpo` independently checks the candidate with the routing exception disclosed. Actual model/effort is unknown.

## Primary evidence and interpretation

[EPA's December 2023 fugitive guidance](https://www.epa.gov/sites/default/files/2020-12/documents/fugitiveemissions.pdf), printed pages 3 and 8, describes a simplified balance for users without refrigerant stocks or gas retrofits. Equation 6 separates installation, servicing and retirement; footnote 3 extends the method to fire suppressants. For unchanged equipment, installation/retirement terms are absent and the result is servicing replacement mass. Printed page 15 explains delayed detection of leakage between recharges. These observations support a bounded estimate, not measured annual leakage or an automatic zero. The current [EPA guidance index](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance) linked this edition when checked 2026-09-16. Retrieved PDF SHA256: `fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88`.

The [January 2025 EPA Factors Hub](https://www.epa.gov/climateleadership/ghg-emission-factors-hub) provides the candidate AR5 100-year GWPs below. Its retained workbook SHA256 is `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`; worksheet `Emission Factors Hub`. The [published PDF](https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf), page 5, Tables 11–12, corroborates the values. No general gas lookup or user-entered GWP is permitted.

| Exact gas | Admitted equipment | GWP | Workbook locator |
| --- | --- | ---: | --- |
| R-410A | Fixed HVAC | 1924 | C575/D575; E575 composition |
| HFC-134a | Fixed refrigeration | 1300 | C532/E532 |
| HFC-227ea | Fixed or portable fire suppression | 3350 | C538/E538 |

R-410A uses the published whole-blend value 1924. The 50/50 constituents give an unrounded comparison of 1923.5; that is not an alternate factor. Do not add constituent results to the blend result. The workbook source note identifies AR5; this is a candidate consistency choice with existing workpapers, not a finding that a particular regulation mandates this GWP edition. Third-party rights, approved release packaging and qualified human review remain separate gates.

## Conservative product admission — narrower than the source method

One identified physical asset, one gas and one complete calendar 2025 under stable operational control. It must be at the declared California office/distribution facility and operating for the entire year. The numeric workpaper is unavailable for unknown control, partial-year ownership, new/retired/converted equipment, manufacturer charging, recovered/reused/transferred gas, any company-held gas stock or unknown service completeness. These are deliberate initial product restrictions, not assertions that EPA prohibits other methods.

Both opening and closing records must independently establish the asset was at its documented full and proper charge at the reporting boundaries (2025-01-01 and 2025-12-31), with the same capacity and gas. A nameplate alone or a midyear service visit does not establish either boundary condition. Capacity must be positive. Missing boundary evidence blocks this method; a different estimation method would need separate review.

Require an identified contractor's complete annual service/discharge record covering the asset and reporting year, including explicit coverage of all providers, visits and known leaks/fire discharges. Each refill records new gas consumed in servicing this asset, including documented servicing escape; it is not just the amount retained in the asset, a purchase/delivery, container capacity or inventory movement. For example, 1.0 kg used during servicing with 0.9 kg retained and 0.1 kg escaping records 1.0 kg. Records giving retained charge alone without establishing total servicing consumption are unsupported. Recovered/reused gas, stock issues and cross-asset allocations are unsupported. The preparer provides uncertainty and evidence limitations; internal review remains separate.

Known operational/fire release events have stable IDs, dates, mass and evidence, and link to exactly one later refill within the year. Multiple releases may link to one refill; their total mass cannot exceed that refill. A linked refill may also replace other evidenced operational losses. Known releases are reconciliation facts only: never add their mass to refill mass. Missing, duplicate, reversed-date, unlinked or unrecharged releases block. Every release requires explicit evidence-backed confirmation that it preceded its linked refill, including same-day events; dates alone do not prove same-day order. Servicing escape is documented inside the servicing event and never added as a separate operational/fire release. A complete contractor attestation must state whether all known releases are included. Code checks the declared structure, not the truth of the evidence.

Zero needs explicit zero-activity attestation, complete annual records, both full-charge boundary records and no refill/release entries. An empty event list alone fails. Label an accepted zero as a candidate method estimate; never label it observed absence of leakage. No unsupported gas is substituted, silently zeroed, excluded or marked not applicable.

## Physical population and integration boundary

The future declaration must independently discover office/distribution HVAC, refrigeration, fixed and portable fire protection, plus controlled mobile air conditioning/refrigerated transport and other discovered fugitive sources. This calculator does not admit mobile refrigeration; those discoveries remain blocking. Reconcile the union of physical declaration, corporate sources and all fugitive workpapers. Every facility/source must remain visible even where no supported numerical method exists. No complete-fugitive or Scope 1 claim follows from supported workpaper results.

One physical device has one effective workpaper per year. Normalize contractor/reference IDs and prevent a servicing event from being reused across devices. Preserve reservations and evidence for superseded versions; reuse within a correction of the same device is lineage, not another physical release. Database enforcement, corporate/version bindings, cumulative contributor reviews, retained reports, actual frontend decoding, tenant isolation, migrations/recovery and hosted demonstrations remain implementation gates. The standalone calculator cannot satisfy them.

## Deterministic calculation boundary

Canonical input is a strict JSON object with the exact schema in `apps/site-api/src/calculation/m77_fugitive.py`. Masses are base-10 strings in kg, nonnegative, maximum `999999.999999`, at most six decimal places, no sign/exponent/commas/whitespace, no numeric JSON coercion. Reject booleans where strings/integers are expected. At most 100 refills and 100 known releases per asset. Identifiers use uppercase ASCII letters, digits, period, underscore or hyphen; evidence references are identifiers, not resolved documents. Capacity and event precision describe computation, not measurement accuracy.

All eligibility declarations must be explicitly true, not truthy; missing fields, extra fields, unsupported gas/device/unit/year, malformed dates, duplicate IDs/references, contradictory balances and unsupported events fail without a numerical result. The server/data integration must bind declarations to retained evidence before a workpaper can be reviewed.

For admitted data: `estimated emitted kg = sum(actual servicing refill kg)`; `kg CO2e = estimated emitted kg × pinned GWP`. Use Decimal with precision 96. Preserve exact strings and intermediates; display kg CO2e to four decimals using half-even rounding. Do not round event masses or multiply by capacity/leak-rate percentages. Do not deduct recovery, offsets or avoided emissions. Output includes candidate status, gas, method/GWP pins, exact and display results, event count and uncertainty notice; no complete-inventory status.

## Independently reproducible examples and refusal cases

These expectations were derived from source factors and decimal arithmetic before implementation. Independent review must exercise its own variants.

| Case | Refill kg | Expected exact kg CO2e | Four decimals |
| --- | ---: | ---: | ---: |
| R-410A HVAC | 1.250000 + 0.750000 | 3848 | 3848.0000 |
| HFC-134a refrigeration | 0.125000 | 162.5 | 162.5000 |
| HFC-227ea fire protection | 2.500000 | 8375 | 8375.0000 |
| HFC-227ea lower tie | 0.000001 | 0.00335 | 0.0034 |
| HFC-227ea upper tie | 0.000003 | 0.01005 | 0.0100 |
| Explicit fully evidenced zero | 0 events | 0 | 0.0000 |

Require independent negative variants for missing/false declarations, zero without evidence, mismatched boundary capacities, unknown/fire-protection gases, mobile equipment, installation/disposal/retrofit/stock facts, incomplete contractor coverage, refill/document duplicates, unrecharged release, releases exceeding or occurring after the linked refill, unverified same-day order, wrong year/units, numeric rather than string masses, negative/nonfinite/exponent/overprecision/oversized input and forged method/factor keys. A known discharge followed by a refill is counted once. Changing a refill must change its result and reset its eventual review without changing old reports.

## Remaining gates

This contract does not approve physical evidence or release an accounting method. Complete M77 still needs persistent corporate-bound workpapers and discovery reconciliation, independent accounting/security/integrated QA, actual browser correction/downloads/restart, preservation/recovery, same-PR publication and board demonstration. M78 aggregation, broader Scope 2/3, regulatory requirements, real-customer readiness and external human assurance remain unfinished.
