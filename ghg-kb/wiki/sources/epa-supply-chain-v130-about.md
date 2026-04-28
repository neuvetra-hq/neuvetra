---
id: epa-supply-chain-v130-about
type: source
title: "EPA Supply Chain GHG Emission Factors v1.3.0 — About Document (July 2024)"
jurisdiction: US-Federal
scope: [3]
tags: [scope-3, category-1, spend-based, eeio, useeio, naics, epa, supply-chain]
last_updated: 2026-04-24
source_count: 0
references: []
---

## Metadata

| Field | Value |
|---|---|
| Full title | About the Supply Chain Greenhouse Gas Emission Factors v1.3 NAICS-6 Datasets |
| Author | Wesley Ingwersen (US EPA CESER) |
| Published | July 5, 2024 |
| Raw file | `raw/guidance/epa-supply-chain-v130-about.docx` (35 KB) |
| Source URL | https://pasteur.epa.gov/uploads/10.23719/1531143/documents/Aboutv1.3SupplyChainGHGEmissionFactors.docx |
| Dataset URL | https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6 |

## Key Takeaways

1. **USEEIO-based methodology:** Factors are derived from the USEEIO v2.2.22-GHG model (US Environmentally-Extended Input-Output). They combine a sector attribution model for GHGs (SAM-GHG) with economic input-output data from BEA, applied to 2022 GHG inventory data.

2. **GWP basis: IPCC AR5.** All CO₂e values use 100-year GWPs from the IPCC Fifth Assessment Report (AR5). This differs from the AR6 GWPs used by the IPCC refrigerant table and some other sources — disclose this when combining factor types in an inventory.

3. **Three factor types per commodity:** SEF (Supply Chain Emissions without Margins), MEF (Margin Emission Factors — for trade, transport, and wholesale margins), and SEF+MEF (combined — recommended for most users). Always use SEF+MEF for Scope 3 Cat 1 reporting.

4. **1,016 NAICS-6 commodities** covered in v1.3.0. Range: 0.029 to 3.924 kg CO₂e / USD2022. Median: 0.173. Mean: 0.281. Highest factors: cement manufacturing (327310), cattle farming (112*), lime and gypsum (3274*).

5. **Dollar-year adjustment recommended:** factors are in 2022 USD. Multiply by a commodity-specific PPI ratio to convert spend from other years before applying factors.

6. **v1.3 vs v1.2 change:** median SEF decreased by 18% across all commodities. The dataset is compatible with GHG Protocol Technical Guidance for Calculating Scope 3 Emissions as the Tier 4 spend-based data source.

## What This Updated in the Wiki

- Created new methodology page: [[methodologies/scope-3-cat1-spend-based|Scope 3 Cat 1 — Spend-Based Method]]

## Raw File Link

`raw/guidance/epa-supply-chain-v130-about.docx`
