-- HOSTED-STORAGE-01 revision 2: forward-only, policy-only Storage repair for a
-- project that ran infra/cloud/001 revision 1 and is at schema 27 (hosted).
-- A new project runs 001 revision 2 and never needs this file.
-- Board decision, 1 Oct 2026: research-dev Storage objects are readable only by
-- service_role. Signed-in users and anon cannot read them through Storage.
--
-- Cause: 001 revision 1 gave storage.objects two SELECT policies for
-- authenticated that query neuvetra_research_dev.research_objects, whose own RLS
-- queries research_memberships. The legacy containment later revoked
-- anon/authenticated access to that schema. PostgreSQL checks table privileges
-- for every policy on storage.objects before it runs a query, whatever bucket it
-- asks for, so every authenticated read of storage.objects fails with
-- "permission denied for table research_memberships".
--
-- Change: drop neuvetra_research_dev_member_download, and make
-- neuvetra_research_dev_read_fence table-free. Nothing else changes: no rows,
-- Storage objects, buckets, tables, grants, functions or other policies.
--
-- Exact-state contract. The whole set of storage.objects policies, with each
-- policy's command, mode, roles and both expressions as pg_policies renders
-- them, must equal one of two known sets before anything changes:
--   * the hosted schema-27 set (001 revision 1 plus 0027): repair it;
--   * the repaired set (001 revision 2 plus 0027): change nothing.
-- Anything else (an altered predicate, a weakened 0027 policy, an extra or a
-- missing policy) is refused. After the change, the set must equal the repaired
-- set exactly, real reads must succeed as anon and authenticated, and no Storage
-- policy for those roles may read a table they cannot read. Any failure rolls
-- the whole transaction back. The expected sets were taken from the hosted
-- read-only inventory of 30 Sep 2026 (storage-policy-inventory-readonly.json).
-- Limits: this certifies policy definitions, not the bodies of the 0027 guard
-- functions they call.
--
-- Caller must SET neuvetra.target_project_ref = 'icockcoguyadhryzydvl'. That is an
-- acknowledgement, not proof of the server's identity or schema receipts.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

CREATE TEMPORARY TABLE neuvetra_storage_policy_sets ON COMMIT DROP AS
SELECT $set${
  "neuvetra_collection_clean_read_allow": ["SELECT", "PERMISSIVE", "authenticated", "neuvetra.collection_storage_can_read(bucket_id, name)", null],
  "neuvetra_collection_clean_read_guard": ["SELECT", "RESTRICTIVE", "public", "\nCASE\n    WHEN (bucket_id = 'neuvetra-private-company-evidence'::text) THEN neuvetra.collection_storage_can_read(bucket_id, name)\n    ELSE true\nEND", null],
  "neuvetra_collection_no_direct_delete": ["DELETE", "RESTRICTIVE", "public", "(bucket_id <> 'neuvetra-private-company-evidence'::text)", null],
  "neuvetra_collection_no_direct_update": ["UPDATE", "RESTRICTIVE", "public", "(bucket_id <> 'neuvetra-private-company-evidence'::text)", "(bucket_id <> 'neuvetra-private-company-evidence'::text)"],
  "neuvetra_collection_upload_allow": ["INSERT", "PERMISSIVE", "authenticated", null, "neuvetra.collection_storage_can_upload(bucket_id, name)"],
  "neuvetra_collection_upload_guard": ["INSERT", "RESTRICTIVE", "public", null, "\nCASE\n    WHEN (bucket_id = 'neuvetra-private-company-evidence'::text) THEN neuvetra.collection_storage_can_upload(bucket_id, name)\n    ELSE true\nEND"],
  "neuvetra_research_dev_anon_read_fence": ["SELECT", "RESTRICTIVE", "anon", "(bucket_id <> 'neuvetra-research-dev'::text)", null],
  "neuvetra_research_dev_delete_fence": ["DELETE", "RESTRICTIVE", "anon,authenticated", "(bucket_id <> 'neuvetra-research-dev'::text)", null],
  "neuvetra_research_dev_insert_fence": ["INSERT", "RESTRICTIVE", "anon,authenticated", null, "(bucket_id <> 'neuvetra-research-dev'::text)"],
  "neuvetra_research_dev_read_fence": ["SELECT", "RESTRICTIVE", "authenticated", "(bucket_id <> 'neuvetra-research-dev'::text)", null],
  "neuvetra_research_dev_update_fence": ["UPDATE", "RESTRICTIVE", "anon,authenticated", "(bucket_id <> 'neuvetra-research-dev'::text)", "(bucket_id <> 'neuvetra-research-dev'::text)"]
}$set$::jsonb AS repaired,
       $set${
  "neuvetra_research_dev_member_download": ["SELECT", "PERMISSIVE", "authenticated", "((bucket_id = 'neuvetra-research-dev'::text) AND (EXISTS ( SELECT 1\n   FROM neuvetra_research_dev.research_objects o\n  WHERE ((o.bucket = objects.bucket_id) AND (o.object_key = objects.name)))))", null],
  "neuvetra_research_dev_read_fence": ["SELECT", "RESTRICTIVE", "authenticated", "((bucket_id <> 'neuvetra-research-dev'::text) OR (EXISTS ( SELECT 1\n   FROM neuvetra_research_dev.research_objects o\n  WHERE ((o.bucket = objects.bucket_id) AND (o.object_key = objects.name)))))", null]
}$set$::jsonb AS historical_changes;

DO $$
DECLARE
  repaired jsonb;
  historical jsonb;
  actual jsonb;
BEGIN
  IF current_database() <> 'postgres'
     OR current_setting('neuvetra.target_project_ref', true) IS DISTINCT FROM 'icockcoguyadhryzydvl' THEN
    RAISE EXCEPTION 'development_target_not_acknowledged';
  END IF;
  SELECT s.repaired, s.repaired || s.historical_changes INTO repaired, historical FROM neuvetra_storage_policy_sets s;
  actual := (SELECT coalesce(jsonb_object_agg(p.policyname, jsonb_build_array(
           p.cmd, p.permissive,
           (SELECT string_agg(r::text, ',' ORDER BY r::text) FROM unnest(p.roles) r),
           p.qual, p.with_check)), '{}'::jsonb)
         FROM pg_catalog.pg_policies p WHERE p.schemaname = 'storage' AND p.tablename = 'objects');

  IF actual = historical THEN
    EXECUTE 'DROP POLICY neuvetra_research_dev_member_download ON storage.objects';
    EXECUTE 'ALTER POLICY neuvetra_research_dev_read_fence ON storage.objects USING (bucket_id <> ''neuvetra-research-dev'')';
  ELSIF actual = repaired THEN
    RAISE NOTICE 'research_dev_storage_read_fence_already_applied';
  ELSE
    RAISE EXCEPTION 'unexpected_storage_policy_state';
  END IF;
END $$;

-- Post-conditions, in the same transaction.
DO $$
DECLARE
  probe_role text;
BEGIN
  IF (SELECT coalesce(jsonb_object_agg(p.policyname, jsonb_build_array(
             p.cmd, p.permissive,
             (SELECT string_agg(r::text, ',' ORDER BY r::text) FROM unnest(p.roles) r),
             p.qual, p.with_check)), '{}'::jsonb)
           FROM pg_catalog.pg_policies p WHERE p.schemaname = 'storage' AND p.tablename = 'objects')
     IS DISTINCT FROM (SELECT repaired FROM neuvetra_storage_policy_sets) THEN
    RAISE EXCEPTION 'postcheck_storage_policies_mismatch';
  END IF;

  -- No Storage policy that applies to anon or authenticated may read a table
  -- that role cannot read (security-definer guard functions are allowed).
  IF EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_depend d ON d.classid = 'pg_policy'::regclass AND d.objid = p.oid AND d.refclassid = 'pg_class'::regclass
    JOIN pg_class c ON c.oid = d.refobjid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) role_name(name)
    WHERE p.polrelid IN ('storage.objects'::regclass, 'storage.buckets'::regclass)
      AND n.nspname <> 'storage'
      AND (0 = ANY (p.polroles) OR (SELECT oid FROM pg_roles WHERE rolname = role_name.name) = ANY (p.polroles))
      AND NOT has_table_privilege(role_name.name, c.oid, 'SELECT')
  ) THEN
    RAISE EXCEPTION 'postcheck_storage_policy_reads_unreadable_table';
  END IF;

  -- Real reads as each role. This also catches nested RLS, which pg_depend does not record.
  FOREACH probe_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', probe_role);
    PERFORM count(*) FROM storage.objects;
    PERFORM count(*) FROM storage.objects WHERE bucket_id = 'neuvetra-private-company-evidence';
    IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'neuvetra-research-dev') THEN
      RAISE EXCEPTION 'postcheck_research_object_visible_to_%', probe_role;
    END IF;
    EXECUTE 'RESET ROLE';
  END LOOP;
END $$;

COMMIT;
