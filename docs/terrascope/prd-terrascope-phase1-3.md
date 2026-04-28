# PRD: Terrascope — App & Data Engineering Layer
# Phases 1–3: Schema → Factor Load → Calculator → Chat

**Status:** Ready for execution  
**Author:** Audit session 2026-04-25  
**Repo:** `C:\Users\nimab\terrascope\`  
**Companion repo:** `C:\Users\nimab\Neuvetra\` (wiki + Python calculation engine)  
**Supabase project:** Terrascope (`jfjbiqeplnbxkadqnimt`, us-west-1)

---

## 1. What This Is

Terrascope is a SaaS chatbot that helps small-to-medium businesses in California and the EU calculate and report their GHG emissions. The user talks to the chatbot, the chatbot gathers their data, the calculation engine computes tCO2e numbers, and a reporting agent writes a government-ready report.

This repo is the **app and data engineering layer**. It owns:
- The Elysia API (`apps/api/`) — what the frontend and chatbot call
- The Drizzle schema (`packages/database/`) — the source of truth for all app tables
- The TypeScript calculation engine (`packages/calculator/` — to be built)
- The React frontend (`apps/web/`) — the user-facing chat + report UI

The wiki knowledge base lives in `C:\Users\nimab\Neuvetra\`. It feeds this app at runtime via:
1. **Supabase `emission_factors` table** — structured factor lookups (what is the California grid factor?)
2. **Weaviate vector store** — semantic wiki search (how do I calculate Scope 2?) — future phase

---

## 2. Current State

### What exists and works
- Monorepo: Bun 1.2 + Turborepo, three packages (api, web, database)
- Drizzle schema defined: 5 tables (emission_factors, companies, users, company_members, ghg_reports) + 2 enums
- API: `/health`, `/chat` (Claude passthrough), `/factors` (basic DB query)
- Supabase connected, tables exist, **0 rows in any table**
- Anthropic SDK wired (`claude-sonnet-4-6`)

### What's broken or missing
| Issue | Impact |
|---|---|
| No migrations generated — schema never applied via Drizzle | Production risk: schema drift between code and DB |
| `emission_factors` missing 3 columns vs schema.sql and calculation engine | Calculation engine queries will silently fail |
| RLS disabled on all 5 tables | Security: all data is publicly readable/writable |
| emission_factors has 0 rows | Chatbot cannot compute any emission number |
| `/chat` calls Claude directly — no factor lookup, no calculation engine | Chatbot fabricates numbers |
| Frontend is a "coming soon" placeholder | No user-facing product |
| Calculation engine is Python (Neuvetra repo) — API is TypeScript | Architectural gap — see Section 4 |

### Schema divergence (three-way mismatch)
The same table is defined in three places, all slightly different:

| Column | `Neuvetra/factors/schema.sql` | `packages/database/src/schema.ts` | Live Supabase |
|---|---|---|---|
| `required_by TEXT[]` | ✅ | ❌ missing | ❌ missing |
| `unit_class TEXT` | ❌ missing | ❌ missing | ❌ missing |
| `input_unit_canonical TEXT` | ❌ missing | ❌ missing | ❌ missing |

All three must be aligned before factor loading. The canonical source of truth going forward is the **Drizzle schema** — `Neuvetra/factors/schema.sql` is secondary documentation.

---

## 3. Architecture Overview

```
User (browser)
   │
   ▼
React chat UI (apps/web/)
   │ fetch POST /chat
   ▼
Elysia API (apps/api/)
   │
   ├── LLM intent + data extraction  ← Claude (Anthropic SDK)
   │
   ├── Factor lookup ──────────────► Supabase emission_factors (structured SQL)
   │
   ├── Calculation engine ─────────► packages/calculator/ (TypeScript — see Section 4)
   │
   ├── Inventory aggregator ────────► packages/calculator/inventory.ts
   │
   └── Report generation ──────────► Claude (formatting pass, no arithmetic)
         │
         ▼
   GHG report (PDF or structured JSON)
         │
         ▼
   Saved to ghg_reports table
```

**The rule that doesn't change:** Claude does extraction and formatting. Code does arithmetic. Every tCO2e number comes from `packages/calculator/`, not from Claude's inference.

---

## 4. Key Architectural Decision — Calculation Engine Language

### The question
The Python calculation engine (`Neuvetra/calculations/`) is fully tested (33 tests, green) for Scope 1 and Scope 2. Phase 3 in the Neuvetra repo will extend it to Scope 3. The Terrascope API is TypeScript/Elysia. How do they connect?

### Options considered

| Option | Description | Verdict |
|---|---|---|
| A — Port to TypeScript | Rewrite calculation logic in TS inside `packages/calculator/` | **Recommended** |
| B — Python microservice | Run Python engine as a separate HTTP service; API calls it | Viable but complex deployment |
| C — Subprocess | Elysia spawns Python per request | Not production-viable |

### Recommendation: Option A — Port to TypeScript

**Why:**
1. The calculation modules are not complex — they are mostly `quantity × factor` or `attribution × emissions`. The Python code is reference implementation; the math is simple.
2. The hard part of the Python engine (unit conversion) only covers ~6 conversions in practice (therms→MMBtu, gallons→MMBtu, km→km, USD→USD, kg→kg). No need for Pint — a typed conversion table suffices in TS.
3. One language = one deployment = one place to debug. Railway deploys one Bun process, not two services.
4. The Python test suite in Neuvetra serves as the specification. The TS port must pass the same test cases — the expected output values are pinned in the methodology page frontmatter.
5. The Drizzle client is already set up for typed DB queries; the calculator can query factors directly with full type safety.

**What the Python engine becomes:** The authoritative specification and reference implementation. Any discrepancy between Python and TypeScript outputs is a bug in the TS port.

### `packages/calculator/` structure (to be built)

```
packages/calculator/
  src/
    types.ts              ← CalculationResult, CalculationContext, CalculationError
    unit-registry.ts      ← typed conversion table (therms, gallons, km, etc.)
    factor-resolver.ts    ← Drizzle query layer (same interface as Python resolver)
    inventory.ts          ← Inventory class with boundary multiplier + audit trail
    validator.ts          ← post-calculation sanity checks
    methodologies/
      scope1-stationary-combustion.ts
      scope1-fugitive-refrigerants.ts
      scope2-location-based.ts
      scope2-market-based.ts
      scope3-cat1-spend-based.ts      ← Phase 3
      scope3-cat6-business-travel.ts  ← Phase 3
      scope3-cat15-financed.ts        ← Phase 3
  index.ts
  package.json
```

---

## 5. Implementation Phases

### Phase 1 — Schema, Migrations, Factor Load, RLS (1 session)

**Goal:** Supabase has all 2,138 factor rows loaded, all tables have correct RLS, schema is clean.

#### 1a — Fix Drizzle schema (`packages/database/src/schema.ts`)

Add three missing columns to `emissionFactors` table:
```typescript
requiredBy: text('required_by').array(),              // e.g. ['CARB-MRR', 'SB-253']
unitClass: text('unit_class'),                        // energy|volume|mass|distance|currency|count|dimensionless
inputUnitCanonical: text('input_unit_canonical'),     // e.g. 'MMBtu'
```

Add a check constraint for `requiredBy` valid values:
`CARB-MRR`, `SB-253`, `ESRS-E1`, `GHG-Protocol-voluntary`, `GHG-Protocol`

Also add a check constraint for `unitClass` valid values (the 7 enum values above).

#### 1b — Generate and apply migration

```bash
cd packages/database
bun run db:generate    # produces SQL migration in drizzle/
bun run db:push        # applies to Supabase
```

Verify columns exist in Supabase after push.

#### 1c — Write factor loading script

Create `packages/database/src/seed-factors.ts`:
- Reads each of the 5 CSVs from `C:\Users\nimab\Neuvetra\factors\processed\`
- Maps CSV columns to Drizzle schema columns (including the 3 new ones)
- Populates `unit_class` and `input_unit_canonical` per factor type:
  - `combustion` → `unit_class: 'energy'`, `input_unit_canonical: 'MMBtu'`
  - `electricity-grid` → `unit_class: 'energy'`, `input_unit_canonical: 'MWh'`
  - `refrigerant-gwp` → `unit_class: 'dimensionless'` (GWP is a pure ratio)
  - `scope3-spend` → `unit_class: 'currency'`, `input_unit_canonical: 'USD'`
  - `scope3-distance` → `unit_class: 'distance'`, `input_unit_canonical: 'km'`
- Upserts using `factorId` as the conflict target
- Logs count per source on completion

**Factor CSV locations:**
```
C:\Users\nimab\Neuvetra\factors\processed\combustion_epa-cfr98-2025.csv      (62 rows)
C:\Users\nimab\Neuvetra\factors\processed\electricity_grid_egrid-2023.csv    (27 rows)
C:\Users\nimab\Neuvetra\factors\processed\refrigerant_gwp_ipcc-ar6.csv       (227 rows)
C:\Users\nimab\Neuvetra\factors\processed\scope3_spend_epa-scghg-v130.csv    (1,016 rows)
C:\Users\nimab\Neuvetra\factors\processed\scope3_transport_defra-2024.csv    (806 rows)
```
Total: 2,138 rows.

Add a script entry in `packages/database/package.json`:
```json
"db:seed-factors": "bun run src/seed-factors.ts"
```

#### 1d — Enable RLS

For each table, apply via Supabase MCP or migration SQL:

```sql
-- emission_factors: public read, service role writes only
ALTER TABLE emission_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON emission_factors FOR SELECT USING (true);

-- companies, users, company_members, ghg_reports: auth-gated (placeholder)
-- Exact policies depend on auth strategy — add as auth is built
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghg_reports ENABLE ROW LEVEL SECURITY;
```

**Exit criterion for Phase 1:**
```sql
SELECT factor_type, COUNT(*) FROM emission_factors GROUP BY factor_type;
-- Should return 5 rows with counts: combustion=62, electricity-grid=27, refrigerant-gwp=227, scope3-spend=1016, scope3-distance=806
```

---

### Phase 2 — TypeScript Calculator + Wired Chat (1 session)

**Goal:** The `/chat` endpoint calls the calculator, which queries real factors from Supabase, and returns a cited Scope 1+2 inventory. No fabricated numbers.

#### 2a — Build `packages/calculator/`

Port these four modules from Python to TypeScript (use Python modules in `Neuvetra/calculations/` as the spec):
1. `scope1-stationary-combustion.ts` — `quantity_MMBtu × combustion_factor`
2. `scope1-fugitive-refrigerants.ts` — `charge_kg × leak_rate × GWP100`
3. `scope2-location-based.ts` — `kWh × grid_factor`
4. `scope2-market-based.ts` — `contracted_kWh × supplier_EF + residual_kWh × grid_EF`

Also port:
- `types.ts` — `CalculationResult`, `CalculationContext`, typed errors
- `unit-registry.ts` — conversion table for therms→MMBtu, gallons→MMBtu, MWh→kWh, etc.
- `factor-resolver.ts` — Drizzle query layer; same interface as Python resolver
- `inventory.ts` — `Inventory` class with `addScope1()`, `addScope2()`, `scope1Total()`, `audit_trail()`
- `validator.ts` — post-calculation unit check + sanity bounds

**Test:** Port the Python exit criterion test to Vitest:
> California office: 50,000 kWh electricity + 12,000 therms natural gas + 15 kg HFC-134a leak
> → Must produce a fully-cited Scope 1+2 inventory with correct tCO2e totals matching the Python engine within 0.5%

#### 2b — Wire `/chat` to the calculator

Refactor `apps/api/src/routes/chat.ts` into a multi-step pipeline:

```
1. First Claude call — intent + data extraction
   System: "Extract structured emission data from this conversation"
   Output: structured JSON { scope, fuel_type, quantity, unit, geography, regulatory_context, ... }

2. Factor resolver — query Supabase via Drizzle
   Input: extracted structured data
   Output: matched CalculationResult(s)

3. Calculator — compute tCO2e
   Input: factor + quantity
   Output: CalculationResult with provenance

4. Second Claude call — formatting pass
   System: "Format this CalculationResult into a friendly cited response. Never change the numbers."
   Input: CalculationResult JSON
   Output: user-facing message
```

When Claude cannot extract enough data, it asks a clarifying question instead of computing.

#### 2c — Add `GET /factors` enhancements

Current `/factors` route works but has no `required_by` filter. Add:
- `?regulatory_context=CARB-MRR` → filters `required_by @> ARRAY['CARB-MRR']`
- `?effective_at=2024` → filters by `effective_start <= date AND (effective_end IS NULL OR effective_end > date)`

**Exit criterion for Phase 2:**
POST `/chat` with "I burned 12,000 therms of natural gas in my California facility last year, reporting under CARB MRR" → response cites the correct EPA combustion factor, shows the correct tCO2e, and includes `factor_id` in the response metadata.

---

### Phase 3 — Scope 3 Calculator + Report Generation (1–2 sessions)

**Goal:** Full Scope 1+2+3 inventory and a generated report ready to download.

#### 3a — Scope 3 calculator modules
Port from Python (Phase 3 of Neuvetra will implement these in Python first; port to TS after):
- `scope3-cat1-spend-based.ts` — `spend_USD × NAICS_factor`
- `scope3-cat6-business-travel.ts` — `distance_km × mode_factor` with RF toggle for air
- `scope3-cat15-financed.ts` — `(outstanding / EVIC) × borrower_emissions`

#### 3b — Inventory completion
- `Inventory.addScope3()` with category tracking
- `grandTotal()` with Scope 1+2+3 rollup
- `auditTrail()` as structured JSON (factor_id, methodology_id, version, inputs, result per line item)

#### 3c — Report generation route

`POST /reports` — triggers a full inventory calculation and generates a report:

```typescript
{
  company_id: string,
  reporting_year: number,
  regulatory_context: 'SB-253' | 'ESRS-E1' | 'CARB-MRR' | 'GHG-Protocol-voluntary',
  boundary_method: 'operational_control' | 'financial_control' | 'equity_share',
  emission_data: { ... }  // all line items
}
```

Output: saves to `ghg_reports` table + returns structured report JSON.

#### 3d — Company + report API routes

```
POST /companies              ← create company
GET  /companies/:id          ← get company + reports
POST /companies/:id/reports  ← start a new report
GET  /companies/:id/reports/:reportId  ← get report with audit trail
```

---

## 6. Session Startup Checklist

When opening a session in `C:\Users\nimab\terrascope\`:

1. Read this PRD
2. Read `CLAUDE.md` in this folder
3. Check what phase is current — look for the most recent exit criterion that hasn't been met
4. Run `bun dev` and confirm API and web start clean
5. Do NOT read or modify anything in `C:\Users\nimab\Neuvetra\` — that's the wiki layer. Pull info from it (read the Python calculation modules as spec) but don't commit to it.

---

## 7. What NOT to Do in This Repo

- **Do not use Claude to compute tCO2e** — all numbers from `packages/calculator/` only
- **Do not import from `C:\Users\nimab\Neuvetra\`** — reference it for spec, don't import it
- **Do not modify `emission_factors` rows from app code** — seed script only, `Neuvetra` repo owns the source CSVs
- **Do not enable RLS bypass** — the service role key is server-only; never expose it to the frontend
- **Do not skip migrations** — every schema change goes through `db:generate` → `db:push`, not raw SQL edits in Supabase dashboard
- **Do not match FrontDesk auth patterns without checking** — auth model may differ for a B2B SaaS vs consumer product

---

## 8. Key File References

| File | What it is |
|---|---|
| `packages/database/src/schema.ts` | Drizzle table definitions — source of truth for all tables |
| `packages/database/src/seed-factors.ts` | Factor loading script (to be written in Phase 1) |
| `packages/database/drizzle/` | Generated SQL migrations — commit these |
| `apps/api/src/routes/chat.ts` | Chat endpoint — wire to calculator in Phase 2 |
| `apps/api/src/routes/factors.ts` | Factor query endpoint — enhance in Phase 2 |
| `packages/calculator/` | TypeScript calculation engine (to be built in Phase 2) |
| `C:\Users\nimab\Neuvetra\calculations\` | Python reference implementation — read as spec |
| `C:\Users\nimab\Neuvetra\factors\processed\` | Source CSVs for factor loading |
| `C:\Users\nimab\Neuvetra\wiki\methodologies\` | Calculation spec frontmatter — test case values live here |

---

## 9. Exit Criteria Summary

| Phase | Done when |
|---|---|
| 1 | `SELECT COUNT(*) FROM emission_factors` returns 2138; RLS enabled on all tables |
| 2 | POST /chat with a real emission question returns cited tCO2e from a real factor_id |
| 3 | POST /reports returns a complete Scope 1+2+3 inventory with audit trail JSON |
