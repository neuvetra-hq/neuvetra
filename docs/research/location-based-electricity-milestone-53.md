# M53 — location-based purchased electricity slice

**State:** complete and independently accepted for the bounded local development milestone; release acceptance remains false
**Started:** September 12, 2026
**Demo:** `http://127.0.0.1:5174/?view=calculation`

## CEO outcome

M53 completes the second method required by Stage 3: a fixed synthetic California facility can calculate, inspect, download and replay one location-based Scope 2 purchased-electricity result. The calculation is local and deterministic. It accepts no customer input, does not infer a subregion from a state, and does not release a factor or inventory result.

The fixed fixture is `1 MWh` of grid-delivered purchased electricity consumed by `Synthetic California office 001` during calendar 2023. Its geography explicitly declares the United States, California and the reviewed `CAMX` eGRID subregion.

## Source and method boundary

EPA's current eGRID pages were rechecked on September 12, 2026 and retained in `m53-epa-currentness-observation-2026-09-12.json`. EPA still identifies eGRID2023 as the latest edition; revision 2 was released June 12, 2025. EPA recommends using the most recent factor available for ongoing work and aligning historical inventory years with the corresponding eGRID year. The retained metric workbook matches the existing manifest at SHA-256 `3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab`.

The development candidate pins sheet `SRL23`, CAMX row 6:

| Meaning | Cell | Value |
|---|---:|---:|
| Data year | `A6` | `2023` |
| Subregion | `B6` | `CAMX` |
| Subregion name | `C6` | `WECC California` |
| CO2 total-output rate | `AC6` | `194.3512704 kg CO2/MWh` |
| CH4 total-output rate | `AE6` | `0.01134 kg CH4/MWh` |
| N2O total-output rate | `AG6` | `0.0013608 kg N2O/MWh` |
| CO2e total-output rate | `AI6` | `195.0402888 kg CO2e/MWh` |

The exact calculation authority is the published total-output CO2e rate in `AI6`, so `1 × 195.0402888 = 195.0402888 kg CO2e`. The final display is `195.0403 kg CO2e` under round-half-even at four decimal places.

EPA's eGRID2023 technical guide identifies a 100-year AR5 policy without climate-carbon feedbacks: CO2 `1`, CH4 `28`, N2O `265`. The gas-specific published rate columns are rounded. Resumming those visible columns yields `195.0294024 kg CO2e`, a `0.0108864 kg CO2e` difference from the published total. The product shows that reconciliation explicitly and does not silently replace the published CO2e rate.

## Implemented boundary

- `location_based_electricity.py` validates the exact synthetic activity, uses Python `Decimal`, returns strings, binds source/method/input/result hashes and replays only byte-equivalent records.
- The existing loopback calculation service dispatches this method without adding a provider, database, credential or shell path.
- The development page opens on the Scope 2 method and retains the accepted Scope 1 method as a selectable companion.
- Wrong unit, missing geography and wrong reporting period stop before a total is returned. No kWh conversion, subregion lookup or latest-factor substitution occurs.

Ten Python calculation tests, all 608 API tests / 5,289 assertions, all 49 web tests / 174 assertions, both TypeScript checks and the production build pass. The production bundle contains none of the M53 fixture, factor or result strings. Browser inspection reproduced the exact result, replay and stale-total-clearing wrong-unit refusal; the expanded trace resolved the factor cells and hashes, the page produced no browser warning/error, and a 390-pixel viewport had no horizontal overflow. Independent accounting and product review passed in `milestone53-location-electricity-review-10.json`; all six findings were resolved in the reviewed bytes. The review completes the bounded M53 development gate while keeping the factor and method as development candidates with `release_eligible: false`.

No provider request, credential access, customer data, source expansion, deployment, merge, inventory release or filing is part of M53.
