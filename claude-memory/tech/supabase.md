---
id: supabase
type: tech
title: "Supabase"
status: active
created: 2026-04-25
updated: 2026-04-28
related: [stack, terrascope, frontdesk, site, drizzle, 2026-04-25-auth-billing-strategy, 2026-04-26-site-chat-backend-architecture, 2026-04-28-consolidate-into-single-monorepo]
tags: [tech, data, auth]
---

# Supabase

Postgres + auth for all Neuvetra products. **Single shared "Neuvetra" project** (decided 2026-04-26 in [[2026-04-26-site-chat-backend-architecture]] § Decision 5; execution underway in the 2026-04-28 cycle).

## What we use

- **Postgres** — primary data store for all three products.
- **Supabase Auth** — single shared identity layer. `auth.users` (Supabase-managed) is the authoritative user table; `public.users` mirrors it with profile fields via a sync trigger. Phone OTP is the supported auth method; email/Google deferred per [[2026-04-26-site-chat-backend-architecture]] M2 design.
- **RLS** — per-table row-level security, scoped to product ownership.

## Why

- **One identity across products.** A user who signs up via FrontDesk's onboarding can authenticate against Site's chat backend without re-registering — same `auth.users.id`, same JWT, same session. Closes the per-product-vs-shared tension that was open as [[2026-04-25-auth-billing-strategy]].
- **One source of pricing/billing.** Stripe customer ID lives on the Neuvetra-wide user; subscriptions reference product-specific entitlements.
- **Operational simplicity.** One project to monitor, one set of migrations, one Postgres to back up.

## Where it appears

- **Auth in code:** `apps/frontdesk-web/src/pages/{SignupPage,LoginPage}.tsx` use `supabase.auth.signInWithOtp({ phone })` + `supabase.auth.verifyOtp(...)`. Site M2 will reuse the same Auth backbone (per the M2 design ratified 2026-04-27).
- **Drizzle schemas:** `packages/frontdesk-database/src/schema.ts` (currently flat in `public.*`); `packages/terrascope-database/src/schema.ts` (also currently flat in `public.*`).
- **Sync trigger:** keeps `public.users` rows in lockstep with `auth.users` insertions. Migration `0002_sync_users_trigger.sql` in `packages/frontdesk-database/migrations/`.

## Project rename + schema reorg (in flight as of 2026-04-28)

The historical FrontDesk Supabase project becomes the canonical Neuvetra-wide project. Plan:

1. **Rename in dashboard:** FrontDesk → "Neuvetra" (cosmetic; project ID stays `<frontdesk-project-id>`). CEO action.
2. **Postgres schema reorg via migration:**
   - `auth.users` (Supabase-managed) — untouched.
   - `public.users` (shared identity profile) + sync trigger — untouched.
   - Move FrontDesk-specific tables (`businesses`, `business_members`, `calls`, `callback_requests`, `knowledge_base`, `calendar_connections`, etc.) from `public.*` into a new `frontdesk` schema.
   - Add empty `terrascope` schema. When Terrascope's frontend lights up and persistence ships, its tables go here.
   - Add empty `site` schema. Site's persistence (chat conversations, etc.) goes here when M2 ships.
3. **Drizzle schemas updated** in `packages/frontdesk-database/` and `packages/terrascope-database/` to point at the namespaced tables (Drizzle supports `pgSchema` for this).
4. **Verify auth flow** end-to-end after migration — phone OTP signup, login, session creation must all still work. The user explicitly authorized downtime ("even if we break the current site, that's fine because we don't have any live users").

Tracked in [[2026-04-28-monorepo-restructure]] § Action items.

## Alternatives considered
- **Per-product Supabase projects** — was the original setup. Rejected 2026-04-26 because it doubles infra cost, blocks shared auth, and creates user duplication.
- **Self-hosted Postgres + custom auth** — heavier ops burden than the value justifies; Supabase Auth + RLS handles the use case cleanly.

## Related

- [[drizzle]] — the ORM layer
- [[stack]] — overall stack
- [[2026-04-26-site-chat-backend-architecture]] § Decision 5 — the shared-Supabase decision
- [[2026-04-28-consolidate-into-single-monorepo]] — the monorepo decision (the rename + reorg is execution of the shared-Supabase decision in the new repo structure)
