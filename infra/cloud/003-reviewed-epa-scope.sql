-- Proposed M2-WEB-PUBLISH migration. No execution is implied by this file.
-- Extend only the isolated research scope/object checks. No grants, RLS,
-- memberships, approval, active pointers, Auth users or API settings change.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF current_database() <> 'postgres'
     OR current_setting('neuvetra.target_project_ref', true) IS DISTINCT FROM 'icockcoguyadhryzydvl' THEN
    RAISE EXCEPTION 'development_target_not_acknowledged';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'neuvetra-research-dev' AND NOT public) THEN
    RAISE EXCEPTION 'private_research_bucket_required';
  END IF;
  IF EXISTS (SELECT 1 FROM neuvetra_research_dev.research_scopes
             WHERE scope_id NOT IN ('90000000-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-00000000000b')) THEN
    RAISE EXCEPTION 'unexpected_existing_research_scope';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint
      WHERE conrelid = 'neuvetra_research_dev.research_scopes'::regclass AND contype = 'c' AND convalidated
      AND conname IN ('research_scopes_scope_id_check', 'research_scopes_label_check', 'research_scopes_is_synthetic_check')) <> 3
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = 'neuvetra_research_dev.research_objects'::regclass AND contype = 'c' AND convalidated AND conname = 'research_objects_check') THEN
    RAISE EXCEPTION 'expected_research_constraints_missing';
  END IF;
END $$;

ALTER TABLE neuvetra_research_dev.research_scopes
  DROP CONSTRAINT research_scopes_scope_id_check,
  DROP CONSTRAINT research_scopes_label_check,
  DROP CONSTRAINT research_scopes_is_synthetic_check,
  ADD CONSTRAINT research_scopes_scope_id_check CHECK (scope_id IN
    ('90000000-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-00000000000b', '90000000-0000-4000-8000-00000000000c')),
  ADD CONSTRAINT research_scopes_label_check CHECK ((scope_id, label) IN (
    ('90000000-0000-4000-8000-00000000000a'::uuid, 'synthetic-a'),
    ('90000000-0000-4000-8000-00000000000b'::uuid, 'synthetic-b'),
    ('90000000-0000-4000-8000-00000000000c'::uuid, 'reviewed-epa-private'))),
  ADD CONSTRAINT research_scopes_is_synthetic_check CHECK ((scope_id, label, is_synthetic) IN (
    ('90000000-0000-4000-8000-00000000000a'::uuid, 'synthetic-a', true),
    ('90000000-0000-4000-8000-00000000000b'::uuid, 'synthetic-b', true),
    ('90000000-0000-4000-8000-00000000000c'::uuid, 'reviewed-epa-private', false)));

ALTER TABLE neuvetra_research_dev.research_objects
  DROP CONSTRAINT research_objects_check,
  ADD CONSTRAINT research_objects_check CHECK (
    object_key = scope_id::text || '/sha256/' || object_sha256 || '/' ||
    CASE kind
      WHEN 'source' THEN CASE WHEN scope_id = '90000000-0000-4000-8000-00000000000c'::uuid THEN 'source.pdf' ELSE 'source.txt' END
      WHEN 'extraction' THEN 'extraction.json'
      ELSE 'release.json'
    END);
COMMIT;
