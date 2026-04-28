---
id: supabase
type: tech
status: active
created: 2026-04-25
updated: 2026-04-25
related: [stack, terrascope, frontdesk, drizzle, 2026-04-25-auth-billing-strategy]
tags: [tech, data]
---

# Supabase

Postgres + auth for both products. Each product has its own Supabase project.

## Projects
- **Terrascope:** project `jfjbiqeplnbxkadqnimt` (us-west-1)
- **FrontDesk:** separate project (id documented in `FrontDesk\code\.env`)

## What's in each
- Drizzle-defined schema, see [[drizzle]].
- Per-product RLS rules.

## Open question
- Will billing/auth consolidate into one Neuvetra account, or stay per-product? See [[2026-04-25-auth-billing-strategy]].

## Next
- Commit RLS policies to migrations in both products (currently live but not versioned in [[terrascope]]).
