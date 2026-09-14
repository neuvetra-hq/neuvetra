---
id: 2026-09-11-neuvetra-m42-deterministic-calculation
type: meeting
date: 2026-09-11
status: complete
related:
  - 2026-09-08-neuvetra-ghg-focus
---

# M42 deterministic calculation slice

The board accepted M41's local presentation and directed Neuvetra to move to the next milestone. M42 was defined as the smallest useful Stage 3 increment: one deterministic Scope 1 stationary-natural-gas calculation using a fixed synthetic activity and the already-retained EPA 2025 Factors Hub.

The implemented fixture is exactly `1 MMBtu`. It returns `53.06 kg CO2`, `0.001 kg CH4` contributing `0.028 kg CO2e`, and `0.0001 kg N2O` contributing `0.0265 kg CO2e`, for `53.1145 kg CO2e`. The application exposes the exact arithmetic, source cells, factor and GWP policy, units, versions and hashes. Export/replay must match the canonical record. Wrong unit, missing geography and wrong period fail closed and clear the total.

## Decisions

1. Use one standard-library Python `Decimal` implementation as the numerical authority behind an isolated loopback Bun transport. The existing float implementation remains only historical design input.
2. Keep this first slice MMBtu-only. Therm and volume conversions remain later method extensions even though independent accounting reproduced EPA's therm example.
3. Treat the EPA values as a development factor candidate. Source retention and numerical inspection do not approve rights, applicability, method release or customer use.
4. Keep the UI development-only and synthetic. It cannot accept customer data, save an inventory, call an AI provider or enter an ordinary production build.

## Evidence and remaining gate

Independent accounting rehashed the original EPA workbook and companion source files, verified the literal factor/GWP cells and reproduced the exact result. Independent QA found and caused repair of two material issues: upper-bound Decimal precision and incomplete policy locators. It then re-audited the final bytes and passed arithmetic, hashes/replay, source binding, failure states, isolation, production exclusion, accessibility and responsive layout. QA SHA-256: `eb448ec54476d6bfc34179baf6f69d5c6330629b46c907ab7f85a78ff18b14e7`.

M42 is complete as a local bounded development demonstration. Factor/method and product release remain false. No paid call, source expansion, deployment, merge, release or commit occurred.

[Milestone record](../../docs/research/deterministic-calculation-milestone-42.md) · [Independent QA](../../evaluations/research-qa/milestone42-deterministic-calculation-review-10.json)
