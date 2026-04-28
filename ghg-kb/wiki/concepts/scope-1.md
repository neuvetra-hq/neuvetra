---
id: scope-1
type: concept
title: "Scope 1 — Direct GHG Emissions"
aliases:
  - Scope 1
  - direct emissions
  - direct GHG emissions
jurisdiction: Global
scope: [1]
business_size: any
tags: [scope-1, direct-emissions, combustion, fugitive, process-emissions]
last_updated: 2026-04-25
source_count: 1
references:
  - ghg-protocol-corporate-standard
  - csrd
  - esrs-e1
  - eu-ets
parent: operational-boundary
---

## Definition

Scope 1 covers **direct GHG emissions** from sources that are owned or controlled by the reporting company. These emissions physically occur at facilities or in equipment the company owns or operates.

(→ [[sources/ghg-protocol-corporate-standard|GHG Protocol Corporate Standard]])

## Why It Matters

Scope 1 is the most directly controllable portion of a company's emissions profile. It is **mandatory to report** under the GHG Protocol Corporate Standard and required under all major regulatory frameworks (CSRD/ESRS E1, CARB MRR, SB 253). Because the company owns or controls the emitting sources, it also bears the most direct regulatory and financial exposure when carbon pricing applies.

## Key Distinctions

**Scope 1 vs. Scope 2:** Scope 1 is direct — the company burns the fuel or runs the process. Scope 2 is indirect — a utility burns fuel elsewhere to generate electricity the company buys.

**Scope 1 vs. Scope 3:** Scope 3 captures indirect emissions up and down the value chain that are outside the company's operational control (suppliers, customers, business travel in third-party vehicles, etc.).

**Four source categories within Scope 1:**

| Category | Description | Examples |
|---|---|---|
| Stationary combustion | Fuel burned in fixed equipment | Boilers, furnaces, turbines, generators |
| Mobile combustion | Fuel burned in owned/controlled vehicles | Company trucks, ships, planes, cars, trains |
| Process emissions | Chemical or physical manufacturing reactions | Cement production, aluminum smelting, chemical synthesis |
| Fugitive emissions | Intentional or unintentional releases | Refrigerant leaks, methane from coal mines, gas pipeline leaks |

**Sale of own-generated electricity:** Emissions from electricity generated on-site and sold to another party are **not** deducted from Scope 1. Both the generator (Scope 1) and the purchaser (Scope 2) account for their respective sides.

## Calculation Notes

The general calculation formula is:

> **Emissions = Activity Data × Emission Factor**

- **Activity data:** Fuel consumption (liters, MMBtu), process throughput, refrigerant purchased, etc.
- **Emission factors:** Source-specific factors from IPCC, EPA, or sector-specific tools. Do not embed numerical values here — see external emission factor database.
- **GHG Protocol calculation tools** are available for stationary combustion, mobile combustion, fugitive emissions, and process sources at ghgprotocol.org.

All six Kyoto Protocol gases must be covered: CO₂, CH₄, N₂O, HFCs, PFCs, SF₆. Results are converted to CO₂-equivalent (CO₂e) using Global Warming Potentials (GWPs).

## Regulatory References

- **GHG Protocol Corporate Standard (Revised)** — Chapter 4, pp. 25–33 defines Scope 1 sources and boundary
- **CSRD / ESRS E1** — mandatory Scope 1 GHG disclosure; E1-6 requires Scope 1 in tCO₂e and the percentage covered by EU ETS allowances (→ [[regulations/csrd|CSRD]], [[regulations/esrs-e1|ESRS E1]])
- **EU ETS** — covered installations must surrender one EU allowance per tonne of Scope 1 CO₂e; annual verified reporting (→ [[regulations/eu-ets|EU ETS]])
- **CARB MRR** — mandatory Scope 1 reporting for California facilities above thresholds
- **SB 253 (CCDAA)** — requires large companies to publicly report Scope 1

## Related

- [[concepts/scope-2|Scope 2 — Electricity Indirect GHG Emissions]]
- [[concepts/scope-3|Scope 3 — Other Indirect GHG Emissions]]
- [[concepts/operational-boundary|Operational Boundary]]
- [[concepts/organizational-boundary|Organizational Boundary]]
- [[methodologies/operational-control-approach|Operational Control Approach]]
- [[methodologies/equity-share-approach|Equity Share Approach]]
- [[regulations/csrd|EU CSRD]] — mandates Scope 1 disclosure
- [[regulations/esrs-e1|ESRS E1]] — GHG disclosure standard; E1-6 is the Scope 1 metric
- [[regulations/eu-ets|EU ETS]] — compliance obligation tied directly to Scope 1 verified emissions
