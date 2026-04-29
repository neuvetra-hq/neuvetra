# `packages/frontdesk-database` — `@frontdesk/database`

> **Parent:** repo root `CLAUDE.md`. Read that first for monorepo conventions.

Drizzle schema + migrations + client for FrontDesk-specific tables in the shared **Neuvetra** Supabase project. Imported by `apps/frontdesk-api` and (eventually) any product that needs FrontDesk-namespaced data.

## What's here

```
packages/frontdesk-database/
├── src/
│   ├── schema.ts          ← single source of truth for table + enum definitions
│   ├── client.ts          ← Drizzle client factory
│   ├── index.ts           ← public re-exports
│   └── migrate.ts         ← migration runner used by scripts
├── migrations/
│   ├── 0000_groovy_echo.sql
│   ├── 0001_ambitious_microbe.sql
│   ├── 0002_sync_users_trigger.sql       ← public.users mirror trigger (do not modify)
│   ├── 0003_unique_sally_floyd.sql
│   ├── 0004_stripe_billing.sql
│   ├── 0005_calendar_integration.sql
│   ├── 0006_callback_requests.sql
│   ├── 0007_neuvetra_namespace_reorg.sql ← moves FrontDesk tables to frontdesk schema
│   └── meta/
├── scripts/
│   ├── migrate.ts
│   ├── check-db.ts
│   └── clean-db.ts
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

## Critical context

### Schema lives in TWO Postgres schemas (since 2026-04-28)

Per migration `0007_neuvetra_namespace_reorg.sql`:

- **`public.users`** (still in `public`) — shared identity table mirroring `auth.users` via the `on_auth_user_created` trigger. **Don't move it; it's the cross-product identity layer.** Defined in [`src/schema.ts`](src/schema.ts) using `pgTable(...)`.
- **`frontdesk.businesses` / `business_members` / `calls` / `knowledge_base` / `calendar_connections` / `callback_requests`** — FrontDesk-specific tables, all in the `frontdesk` Postgres schema. Defined using `frontdesk.table(...)` from `pgSchema('frontdesk')`.
- **`frontdesk.business_status` / `business_type` / `member_role` / `call_status` / `calendar_provider`** — enums, all in `frontdesk`. Defined using `frontdesk.enum(...)`.

Cross-schema FK `frontdesk.business_members.user_id → public.users.id` is supported by Postgres natively. No special handling required in Drizzle.

### Sync trigger — **don't touch**

Migration `0002_sync_users_trigger.sql` creates `handle_new_auth_user()` in `public` and the `on_auth_user_created` trigger on `auth.users`. This is what mirrors Supabase's `auth.users` insertions into `public.users`. Auth flow depends on it.

### Adding a new FrontDesk table

1. Add the table definition in `src/schema.ts` using `frontdesk.table(...)` (NOT `pgTable`).
2. Run `bun run db:generate` from this package — Drizzle Kit reads `src/schema.ts` and writes a new migration file under `migrations/`.
3. Inspect the generated SQL — confirm the schema is `frontdesk`, not `public`.
4. Apply via `bun run db:push` or via Supabase MCP `apply_migration` tool.

### Adding a NON-FrontDesk product table

Don't add it here. Each product has its own database package. Site tables go to a future `packages/site-database/` (when created); Terrascope tables stay in `packages/terrascope-database/`. The `terrascope.*` and `site.*` Postgres schemas exist empty as of 2026-04-28, ready for those packages to populate.

## Commands

```bash
cd packages/frontdesk-database
bun run db:generate    # Drizzle Kit → generates migration from schema.ts changes
bun run db:push        # apply schema directly to DB (dev only)
```

## Skills to reach for

- **DB:** `supabase:supabase`, `supabase:supabase-postgres-best-practices`
- **Live docs:** `mcp__plugin_context7_context7__query-docs` for Drizzle (`drizzle-orm`, `drizzle-kit`)
