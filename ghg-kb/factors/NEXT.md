# Next Step — Load Processed CSVs into Supabase

## What's ready

5 processed CSVs in `factors/processed/`, all schema-compliant (matches `factors/schema.sql`):

| File | Records | Type |
|---|---|---|
| `combustion_epa-cfr98-2025.csv` | 62 | Scope 1 stationary combustion, kg CO2e/MMBtu |
| `electricity_grid_egrid-2023.csv` | 27 | Scope 2 location-based grid, kg CO2e/MWh |
| `refrigerant_gwp_ipcc-ar6.csv` | 227 | Scope 1 fugitive GWP100 (AR6), kg CO2e/kg |
| `scope3_spend_epa-scghg-v130.csv` | 1,016 | Scope 3 Cat 1 spend-based, kg CO2e/USD2022 |
| `scope3_transport_defra-2024.csv` | 806 | Scope 3 Cat 4/6/7 transport, kg CO2e/passenger.km etc. |

**Total: 2,138 records.** None loaded to Supabase yet.

## What to do

1. Load each CSV into `public.emission_factors` on Supabase project `jfjbiqeplnbxkadqnimt`
2. Use `SUPABASE_SERVICE_ROLE_KEY` (service role bypasses RLS for writes)
3. After loading, update `factors/index.md` — set "Loaded to Supabase" = Yes and record the load date

## Supabase connection

```
SUPABASE_URL=https://jfjbiqeplnbxkadqnimt.supabase.co
# Keys from Supabase dashboard -> Settings -> API
```

Use the session pooler URL for the DB connection (IPv4-safe, required on Railway):
```
DATABASE_URL=postgresql://postgres.jfjbiqeplnbxkadqnimt:[PASSWORD]@aws-1-us-west-1.pooler.supabase.com:5432/postgres
```

## Notes

- The `required_by` column uses PostgreSQL array literal syntax: `{CARB-MRR,SB-253}` — the Supabase client handles this correctly on insert
- Empty string fields in the CSVs map to `NULL` in Postgres — coerce before inserting
- `effective_end` and `superseded_by` are NULL for all records (these are first-version records)
- Processing scripts that generated these CSVs are in `factors/scripts/process_*.py`
