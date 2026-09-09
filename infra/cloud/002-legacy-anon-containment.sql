-- PROPOSED, NOT APPLIED. Existing legacy tables: anonymous-role containment only.
-- Run the metadata preflight/rollback capture in
-- docs/research/legacy-database-access-review.md first and retain its exact output.
-- Execute as the verified table owner over the reviewed direct TLS connection.
-- Caller must SET neuvetra.target_project_ref = 'icockcoguyadhryzydvl'.
-- This acknowledgement is not independent proof of server identity.
-- No customer rows, RLS changes, authenticated/service-role grants or CASCADE.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE relation_name text; relation_oid oid; owner_oid oid; anon_oid oid;
BEGIN
  IF current_database() <> 'postgres'
     OR current_setting('neuvetra.target_project_ref', true) IS DISTINCT FROM 'icockcoguyadhryzydvl'
     OR (SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid = pg_backend_pid()) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'verified_direct_target_required';
  END IF;
  SELECT oid INTO anon_oid FROM pg_catalog.pg_roles WHERE rolname = 'anon';
  IF anon_oid IS NULL THEN RAISE EXCEPTION 'anonymous_role_missing'; END IF;
  FOREACH relation_name IN ARRAY ARRAY[
    'public.users', 'frontdesk.businesses', 'frontdesk.business_members',
    'frontdesk.calls', 'frontdesk.knowledge_base',
    'frontdesk.calendar_connections', 'frontdesk.callback_requests'
  ] LOOP
    relation_oid := to_regclass(relation_name);
    SELECT relowner INTO owner_oid FROM pg_catalog.pg_class
      WHERE oid = relation_oid AND relkind = 'r';
    IF NOT FOUND OR owner_oid IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user) THEN
      RAISE EXCEPTION 'expected_owned_legacy_table_missing';
    END IF;
    -- Restrict this script to grants this owner can restore exactly. If another
    -- grantor is present, stop for a separately reviewed grantor-aware plan.
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      CROSS JOIN LATERAL aclexplode(c.relacl) acl
      WHERE c.oid = relation_oid AND acl.grantee = anon_oid AND acl.grantor <> owner_oid
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      CROSS JOIN LATERAL aclexplode(a.attacl) acl
      WHERE a.attrelid = relation_oid AND a.attnum > 0 AND NOT a.attisdropped
        AND acl.grantee = anon_oid AND acl.grantor <> owner_oid
    ) THEN RAISE EXCEPTION 'unexpected_legacy_grantor'; END IF;
  END LOOP;
END $$;

-- PostgreSQL also revokes corresponding column privileges on these tables.
-- Preflight captures column ACLs so an explicit rollback can restore them exactly.
REVOKE ALL PRIVILEGES ON TABLE
  public.users,
  frontdesk.businesses,
  frontdesk.business_members,
  frontdesk.calls,
  frontdesk.knowledge_base,
  frontdesk.calendar_connections,
  frontdesk.callback_requests
FROM anon RESTRICT;

-- Effective checks also detect PUBLIC/inherited access. Do not broaden this
-- migration to other roles when such a path exists: abort the whole transaction.
DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'public.users', 'frontdesk.businesses', 'frontdesk.business_members',
    'frontdesk.calls', 'frontdesk.knowledge_base',
    'frontdesk.calendar_connections', 'frontdesk.callback_requests'
  ] LOOP
    IF has_table_privilege('anon', relation_name,
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
       OR has_any_column_privilege('anon', relation_name, 'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'effective_anonymous_access_remains';
    END IF;
  END LOOP;
END $$;

COMMIT;
