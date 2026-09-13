# M42 — first deterministic calculation slice

**State:** local development implementation complete; independent QA pass  
**Date:** September 11, 2026  
**Demo:** `http://127.0.0.1:5174/?view=calculation`

## Product outcome

M42 turns the approved Scope 1/2 paper design into Neuvetra's first working numerical product slice. A board reviewer can calculate, inspect, download and replay one fixed synthetic Scope 1 stationary-natural-gas record. The page also runs three fixed failure examples for an unsupported unit, missing geography and a mismatched reporting period. Every failure removes the earlier total.

The result is a calculated development subtotal for one synthetic source. It is not an inventory, factor release, compliance determination or production feature. The page contains no customer input, upload, save-to-inventory or provider path.

## Exact source and method boundary

The retained `epa-factors-hub-2025.xlsx` was rehashed at `43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7`, matching the download manifest. Independent accounting inspection found literal, formula-free values in sheet `Emission Factors Hub`:

| Meaning | Workbook locator | Pinned value |
|---|---|---:|
| Natural Gas | `C38` | `Natural Gas` |
| CO2 factor | `E38` | `53.06 kg CO2/MMBtu` |
| CH4 factor | `F38` | `1.0 g CH4/MMBtu` |
| N2O factor | `G38` | `0.10 g N2O/MMBtu` |
| CO2 GWP | `E524` | `1` |
| CH4 GWP | `E525` | `28` |
| N2O GWP | `E526` | `265` |

The factor is HHV, combustion-only and excludes upstream emissions. This method version accepts only an explicitly declared United States stationary source, the exact 2025 demonstration period, Natural Gas, and MMBtu activity. It does not convert scf, therms, LHV, mass or volume; cover upstream, fugitive, feedstock or blend treatment; establish CARB MRR or GHGRP applicability; or claim inventory completeness. The AR5 100-year policy is explicit and cannot be replaced by “latest.”

Rights and method/factor release review remain open. The source is retained, while extraction and method approval are pending; runtime is `not_released` and `release_eligible` is false.

## Canonical numerical result

The Python authority constructs every numeric input from a decimal string and performs no intermediate rounding:

```text
1 * 53.06                 = 53.06 kg CO2
1 * 1.0 / 1000            = 0.001 kg CH4
0.001 * 28                = 0.028 kg CO2e
1 * 0.10 / 1000           = 0.0001 kg N2O
0.0001 * 265              = 0.0265 kg CO2e
53.06 + 0.028 + 0.0265    = 53.1145 kg CO2e
```

The display rule quantizes only the final result to four decimal places with `ROUND_HALF_EVEN`; the exact fixture remains `53.1145 kg CO2e`. Source, factor, method, implementation, GWP policy, input snapshot and result payload hashes are carried in the record. Volatile time is absent. Replay rehashes the exported record, recalculates through the same Python authority and requires byte-equivalent content.

## Implementation boundary

- `apps/site-api/src/calculation/stationary_natural_gas.py` is the only arithmetic authority. It uses Python's standard-library `Decimal` and canonical JSON/SHA-256 functions.
- `apps/site-api/src/calculation/server.ts` is an isolated loopback-only Bun transport on port 3014. It uses an argument array with no shell, has finite input/output/time/concurrency bounds, returns finite errors and imports no research provider, authentication, telemetry or database module.
- `apps/site-web/src/lib/calculation-api.ts` strictly decodes decimal strings and refuses a release-eligible or non-`not_released` result.
- `apps/site-web/src/components/DeterministicCalculationDemo.tsx` renders only server-returned arithmetic. It is reachable only in Vite development with `VITE_DETERMINISTIC_CALC_DEMO=stationary-natural-gas`.
- An ordinary production build contains none of the M42 activity, factor, endpoint or result strings.

The inherited float calculator remains untouched and is not runtime authority.

## Demonstrated validation

- Python: 6 tests pass for exact gas math, repeat identity, zero, strict decimal rejection, the required negative examples, replay/tamper refusal and exact arithmetic at the maximum accepted 30-integer/18-fractional-digit boundary.
- Site API: all 602 tests / 5,254 assertions pass, including real Python transport and local-origin refusal; typecheck passes.
- Site web: all 48 tests / 169 assertions pass; typecheck, lint and production build pass.
- Production output contains zero matches for the M42 result, synthetic asset, factor ID, endpoint or development label.
- Browser: calculation and exact gas values render; replay matches; wrong unit clears the result and returns `unit_conversion_unapproved`; the expanded trace resolves all values and hashes; a 390 × 844 mobile pass has `scrollWidth == clientWidth`.

Independent QA first found two material issues: insufficient Decimal precision at the maximum accepted input, and missing locators for the source cells that substantiate the HHV/scope/GWP policy labels. The final implementation uses a justified 96-digit context, tests the exact 30-integer/18-fractional-digit boundary, and pins the Table 1 title/headers, `C94` HHV note, `C99` combustion boundary, Table 11 title, `E523` horizon, `E524:E526` values and `C10/C556` AR5 notes to the same workbook hash and sheet.

The repaired bytes passed independent QA. The reviewer reproduced exact fixture, half-even tie and maximum-boundary arithmetic; cross-runtime canonical hashes; tamper and binding replay refusal; all required UI errors and stale-total clearing; source cells; loopback/origin boundaries; local-only browser traffic; keyboard and desktop/mobile layout; ordinary production exclusion; and the full regression suites. The QA artifact is `evaluations/research-qa/milestone42-deterministic-calculation-review-10.json`, SHA-256 `eb448ec54476d6bfc34179baf6f69d5c6330629b46c907ab7f85a78ff18b14e7`.

M42 is complete as a bounded development demonstration. Release acceptance remains false. No external provider, paid request, credential, customer data, source expansion, database, deployment, merge, release or commit was used.
