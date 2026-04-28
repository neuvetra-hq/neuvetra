# Emission Factor Layer — Index
Last updated: 2026-04-24 (processed all 5 sources)

## Supabase Project

| Field | Value |
|---|---|
| Project name | Terrascope |
| Project ID | `jfjbiqeplnbxkadqnimt` |
| Project URL | `https://jfjbiqeplnbxkadqnimt.supabase.co` |
| Region | us-west-1 |
| Status | ACTIVE_HEALTHY |
| Table | `public.emission_factors` |
| RLS | Enabled — public SELECT, service role writes only |

**API keys are not stored here.** Use environment variables:
```
SUPABASE_URL=https://jfjbiqeplnbxkadqnimt.supabase.co
SUPABASE_ANON_KEY=<from Supabase dashboard → Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API>
```

## Purpose

This folder holds the processed emission factor data that feeds the Supabase database.
Raw downloaded source files live in `raw/factors/` (immutable).
Processed CSVs here are cleaned, unit-normalized, and schema-compliant — ready for Supabase import.

The wiki describes *which* factors to use. This layer holds the *values*.

---

## Source Inventory

| Source | Raw subfolder | Factor types covered | Geography | Update cadence | Status |
|---|---|---|---|---|---|
| EPA eGRID | `raw/factors/egrid/` | Electricity grid (Scope 2 location-based) | US subregions incl. CAMX (California) | Annual (data year N, published ~N+2) | **Downloaded 2026-04-24** — egrid2023_data_metric_rev2.xlsx (23.7 MB), egrid2023_data_rev2.xlsx (20.2 MB) |
| EPA GHG Emission Factors Hub 2025 | `raw/factors/epa-40cfr98/` | Combustion (stationary + mobile) + refrigerants — consolidated (Scope 1) | US / global | Annual (Jan each year) | **Downloaded 2026-04-24** — ghg-emission-factors-hub-2025.xlsx (991 KB). Note: EPA now publishes this consolidated hub instead of standalone Table C-1. |
| IPCC AR6 Chapter 7 Supplementary | `raw/factors/ipcc-ar6/` | GWP100 values for all GHGs incl. refrigerants, CH4, N2O (Scope 1) | Global | Every 5–7 years | **Downloaded 2026-04-24** — IPCC_AR6_WGI_Chapter07_SM.pdf (2.5 MB) |
| EPA Supply Chain GHG EF v1.3.0 | `raw/factors/epa-supply-chain/` | Scope 3 Cat 1 spend-based — 1,016 NAICS-6 commodities, USD2022 base | US economy | Every 2–3 years | **Downloaded 2026-04-24** — v1.3.0 CO2e CSV (121 KB), v1.3.0 by-GHG CSV (2.4 MB), v1.2 CO2e CSV retained as prior version |
| DEFRA UK Conversion Factors 2024 | `raw/factors/defra/` | Transport, business travel, freight (Scope 3 Cat 4/6/7/9) | UK / broadly applicable | Annual (published Oct 2024, v1.1) | **Downloaded 2026-04-24** — FlatFormat xlsx (531 KB), full set xlsx (2.0 MB) |

---

## Processed Files

| Filename | Source | Data year | Loaded to Supabase | Records |
|---|---|---|---|---|
| `combustion_epa-cfr98-2025.csv` | EPA GHG Emission Factors Hub 2025 | 2025 | No | 62 |
| `electricity_grid_egrid-2023.csv` | EPA eGRID 2023 (metric rev2) | 2023 | No | 27 |
| `refrigerant_gwp_ipcc-ar6.csv` | IPCC AR6 Chapter 7 Supplementary, Table 7.SM.7 | 2021 | No | 227 |
| `scope3_spend_epa-scghg-v130.csv` | EPA Supply Chain GHG EF v1.3.0 | 2022 | No | 1,016 |
| `scope3_transport_defra-2024.csv` | DEFRA UK GHG Conversion Factors 2024 v1.1 | 2024 | No | 806 |

**Processing scripts:** `factors/scripts/process_*.py` — run individually to regenerate CSVs from raw files.

**Key values (spot-checked 2026-04-24):**
- Natural Gas combustion: 53.11 kg CO2e/MMBtu
- CAMX (California) grid: 195.04 kg CO2e/MWh
- HFC-134a (R-134a) GWP100: 1,530 (AR6)
- HCFC-22 (R-22) GWP100: 1,960 (AR6)

---

## Schema

See `factors/schema.sql` for the full PostgreSQL table definition.

Key fields every processed CSV must include:

```
factor_id, name, factor_type, scope, scope3_category, substance,
value, unit, geography, jurisdiction, required_by,
gwp_basis, tier, uncertainty_pct,
source_document, source_url, data_year, published_date,
effective_start, effective_end, superseded_by,
wiki_method_page, last_verified
```

Units must always be normalized to **kg CO2e per [denominator]** before import.
Never import lb, short ton, or other non-SI units — convert at processing time.

---

## Retrieval Patterns

The chatbot uses Supabase for structured factor lookups alongside Weaviate for wiki semantic search.

| Question type | Query pattern |
|---|---|
| Scope 1 combustion (California MRR) | `factor_type = 'combustion' AND 'CARB-MRR' = ANY(required_by)` |
| Scope 2 location-based (California) | `factor_type = 'electricity-grid' AND geography = 'CAMX' AND effective_end IS NULL` |
| Refrigerant leak → CO2e | `factor_type = 'refrigerant-gwp' AND substance = '[refrigerant]' AND effective_end IS NULL` |
| Scope 3 Cat 1 spend-based | `factor_type = 'scope3-spend' AND scope3_category = 1 AND geography = 'US-national'` |
| Business travel (air) | `factor_type = 'scope3-distance' AND scope3_category = 6 AND substance LIKE 'air%'` |

---

## Versioning

When a source publishes a new version:
1. Download to `raw/factors/[source]/` with the new year in the filename — do not overwrite the old file
2. Process to a new CSV in `factors/processed/` with a new `factor_id`
3. Set `effective_end` on all superseded records
4. Populate `superseded_by` on superseded records pointing to new `factor_id`
5. Update this index (Loaded to Supabase column and Records count)
6. Update `wiki/log.md` with an `update` entry

---

## Priority Download Order (California MVP)

1. **EPA 40 CFR Part 98 Table C-1** — unlocks all Scope 1 combustion questions; required by CARB MRR
2. **EPA eGRID 2023 (CAMX subregion)** — unlocks all California Scope 2 location-based questions
3. **IPCC AR6 GWP values** — unlocks refrigerant leak questions (missed by most companies)
4. **EPA Supply Chain GHG EF v1.3** — unlocks Scope 3 Cat 1 for companies without supplier data
5. **DEFRA UK Conversion Factors 2024** — unlocks business travel and freight Scope 3
