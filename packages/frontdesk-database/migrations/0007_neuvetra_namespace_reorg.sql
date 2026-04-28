-- Migration: Neuvetra namespace reorg
-- Applied 2026-04-28 via Supabase MCP (apply_migration: neuvetra_namespace_reorg).
-- This .sql file is the local record so the Drizzle migrations folder reflects
-- production reality. See claude-memory/decisions/2026-04-28-consolidate-into-single-monorepo.md.
--
-- Moves FrontDesk-specific tables and enums from public.* to frontdesk.*.
-- Adds empty terrascope and site schemas for future per-product tables.
-- Keeps public.users, auth.users, and the on_auth_user_created sync trigger unchanged.
-- After this migration, cross-schema FK frontdesk.business_members.user_id -> public.users.id
-- is supported by Postgres transparently.

CREATE SCHEMA IF NOT EXISTS frontdesk;
CREATE SCHEMA IF NOT EXISTS terrascope;
CREATE SCHEMA IF NOT EXISTS site;

-- Schema-level permissions for Supabase roles
GRANT USAGE ON SCHEMA frontdesk  TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA terrascope TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA site       TO postgres, anon, authenticated, service_role;
GRANT ALL   ON SCHEMA frontdesk  TO postgres, service_role;
GRANT ALL   ON SCHEMA terrascope TO postgres, service_role;
GRANT ALL   ON SCHEMA site       TO postgres, service_role;

-- Default privileges for future tables created in these schemas
ALTER DEFAULT PRIVILEGES IN SCHEMA frontdesk  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA terrascope GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA site       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

-- Move FrontDesk-specific enums to frontdesk schema
ALTER TYPE public.business_status   SET SCHEMA frontdesk;
ALTER TYPE public.business_type     SET SCHEMA frontdesk;
ALTER TYPE public.member_role       SET SCHEMA frontdesk;
ALTER TYPE public.call_status       SET SCHEMA frontdesk;
ALTER TYPE public.calendar_provider SET SCHEMA frontdesk;

-- Move FrontDesk-specific tables to frontdesk schema.
-- public.users intentionally stays in public (shared identity, mirrors auth.users).
ALTER TABLE public.businesses           SET SCHEMA frontdesk;
ALTER TABLE public.business_members     SET SCHEMA frontdesk;
ALTER TABLE public.calls                SET SCHEMA frontdesk;
ALTER TABLE public.knowledge_base       SET SCHEMA frontdesk;
ALTER TABLE public.calendar_connections SET SCHEMA frontdesk;
ALTER TABLE public.callback_requests    SET SCHEMA frontdesk;
