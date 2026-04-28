---
id: drizzle
type: tech
status: active
created: 2026-04-25
updated: 2026-04-25
related: [stack, supabase, terrascope, frontdesk]
tags: [tech, data]
---

# Drizzle

TypeScript ORM for both products. Schema-first, migration-friendly, plays well with [[supabase]].

## Schemas
- **Terrascope:** 5 tables (`emission_factors`, `companies`, `users`, `company_members`, `ghg_reports`) + 2 enums.
- **FrontDesk:** users, businesses, calendar tokens, voice events (in `FrontDesk\code\packages\database\`).

## Convention
- Schema lives in `apps/api/src/db/` or `packages/database/` per product.
- Migrations generated and committed; never apply schema changes directly to Supabase without a migration.

## Known issues
- [[terrascope]]: RLS rules live in Supabase but are not versioned in Drizzle migrations.
- [[terrascope]]: schema missing 3 columns (`unit_class`, `input_unit_canonical`, `required_by` enum constraint) per 2026-04-25 audit.

## Next
- Get RLS into migrations in both products.
- Add the 3 missing columns to Terrascope schema before any factor reload.
