---
id: defra-2024-methodology
type: source
title: "DEFRA 2024 Government GHG Conversion Factors — Methodology Paper"
jurisdiction: Global
scope: [3]
tags: [scope-3, category-6, business-travel, transport, freight, defra, uk, methodology]
last_updated: 2026-04-24
source_count: 0
references: []
---

## Metadata

| Field | Value |
|---|---|
| Full title | 2024 Government Gas Conversion Factors for Company Reporting — Methodology Paper |
| Publisher | UK Department for Energy Security and Net Zero (DESNZ) / DEFRA |
| Version | Final, June 2024; updated October 2024 (v1.1) |
| Raw file | `raw/guidance/defra-2024-methodology.pdf` (1.85 MB, 153 pages) |
| Source URL | https://assets.publishing.service.gov.uk/media/66a9fe4ca3c2a28abb50da4a/2024-greenhouse-gas-conversion-factors-methodology.pdf |
| Factor files | `raw/factors/defra/` |

## Key Takeaways

1. **Comprehensive transport coverage across 6 modes:** road (cars, vans, HGVs, buses, motorcycles), rail, air, sea, and freight (all modes). Covers both passenger travel (Cat 6) and freight (Cat 4) in a single consistent framework.

2. **Radiative Forcing (RF) for aviation:** DEFRA provides air factors both with RF (captures contrail and NOₓ warming effect at altitude) and without RF (direct CO₂ only). The with-RF factor is approximately 1.9× the without-RF factor. GHG Protocol allows either; disclose which is used.

3. **Cabin class multipliers:** business class allocates ~2.9× economy's per-passenger-km factor; first class ~4×. These reflect seat pitch and space allocation on the aircraft.

4. **GWP basis: predominantly AR4 and AR5** — DEFRA notes a mixed basis in Table 1 of the methodology. This is consistent with the GHG Protocol Scope 3 Standard which uses AR4/AR5.

5. **Globally applicable:** while derived from UK fleet data, the factors are widely used internationally for Scope 3 Cat 6 and Cat 4 calculations where country-specific factors are unavailable. No better freely available global standard exists for transport factors.

6. **Annual update cadence:** DEFRA publishes updated factors each year, typically in June/July with a minor revision in October. When a new year's factors are released, update the processed CSV and set `effective_end` on superseded records.

## What This Updated in the Wiki

- Created new methodology page: [[methodologies/scope-3-cat6-business-travel|Scope 3 Cat 6 — Business Travel]]

## Raw File Link

`raw/guidance/defra-2024-methodology.pdf`
