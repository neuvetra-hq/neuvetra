-- PROPOSED, NOT APPLIED. Synthetic CLOUD-DB-01 slice only.
-- First verify the connection target with the read-only inventory helper.
-- Caller must explicitly SET neuvetra.target_project_ref = 'icockcoguyadhryzydvl'.
-- That acknowledgement is not independent proof of the server's project identity.
-- Abort on an existing schema; never adopt/move/drop existing product objects.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF current_database() <> 'postgres'
     OR current_setting('neuvetra.target_project_ref', true) IS DISTINCT FROM 'icockcoguyadhryzydvl' THEN
    RAISE EXCEPTION 'development_target_not_acknowledged';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'neuvetra-research-dev' AND public) THEN
    RAISE EXCEPTION 'development_bucket_must_be_private';
  END IF;
END $$;

CREATE SCHEMA neuvetra_research_dev;
REVOKE ALL ON SCHEMA neuvetra_research_dev FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA neuvetra_research_dev TO authenticated, service_role;
CREATE DOMAIN neuvetra_research_dev.sha256 AS text CHECK (VALUE ~ '^[0-9a-f]{64}$');

CREATE TABLE neuvetra_research_dev.research_scopes (
  scope_id uuid PRIMARY KEY CHECK (scope_id IN ('90000000-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-00000000000b')),
  label text NOT NULL CHECK (label IN ('synthetic-a', 'synthetic-b')),
  is_synthetic boolean NOT NULL DEFAULT true CHECK (is_synthetic),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE neuvetra_research_dev.research_memberships (
  scope_id uuid NOT NULL REFERENCES neuvetra_research_dev.research_scopes,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, user_id)
);
CREATE INDEX research_memberships_reader ON neuvetra_research_dev.research_memberships(user_id, scope_id);

CREATE TABLE neuvetra_research_dev.research_objects (
  scope_id uuid NOT NULL REFERENCES neuvetra_research_dev.research_scopes,
  object_sha256 neuvetra_research_dev.sha256 NOT NULL,
  kind text NOT NULL CHECK (kind IN ('source', 'extraction', 'release')),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  bucket text NOT NULL CHECK (bucket = 'neuvetra-research-dev'),
  object_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, object_sha256),
  UNIQUE (bucket, object_key),
  CHECK (object_key = scope_id::text || '/sha256/' || object_sha256 || '/' ||
    CASE kind WHEN 'source' THEN 'source.txt' WHEN 'extraction' THEN 'extraction.json' ELSE 'release.json' END)
);
CREATE TABLE neuvetra_research_dev.research_sources (
  scope_id uuid NOT NULL,
  source_sha256 neuvetra_research_dev.sha256 NOT NULL,
  source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 120),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  canonical_url text NOT NULL CHECK (canonical_url LIKE 'https://%' AND length(canonical_url) < 2000),
  version text NOT NULL CHECK (length(version) BETWEEN 1 AND 120),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'withdrawn')),
  PRIMARY KEY (scope_id, source_sha256),
  FOREIGN KEY (scope_id, source_sha256) REFERENCES neuvetra_research_dev.research_objects(scope_id, object_sha256)
);
-- One immutable release projection per build; the same release bytes can be
-- indexed by a separately identified profile/build without changing their hash.
CREATE TABLE neuvetra_research_dev.research_releases (
  scope_id uuid NOT NULL,
  release_sha256 neuvetra_research_dev.sha256 NOT NULL,
  build_id uuid NOT NULL,
  profile_sha256 neuvetra_research_dev.sha256 NOT NULL,
  namespace text NOT NULL CHECK (length(namespace) BETWEEN 1 AND 300),
  version text NOT NULL CHECK (length(version) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'approved', 'withdrawn')),
  review_expires_at timestamptz NOT NULL,
  commercial_runtime_approval boolean NOT NULL DEFAULT false CHECK (NOT commercial_runtime_approval),
  PRIMARY KEY (scope_id, release_sha256, build_id),
  UNIQUE (scope_id, build_id),
  UNIQUE (namespace),
  FOREIGN KEY (scope_id, release_sha256) REFERENCES neuvetra_research_dev.research_objects(scope_id, object_sha256)
);
CREATE TABLE neuvetra_research_dev.research_passages (
  scope_id uuid NOT NULL,
  release_sha256 neuvetra_research_dev.sha256 NOT NULL,
  build_id uuid NOT NULL,
  passage_id text NOT NULL CHECK (length(passage_id) BETWEEN 1 AND 120),
  vector_id text NOT NULL CHECK (length(vector_id) BETWEEN 1 AND 512),
  source_sha256 neuvetra_research_dev.sha256 NOT NULL,
  extraction_sha256 neuvetra_research_dev.sha256 NOT NULL,
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 16000),
  text_sha256 neuvetra_research_dev.sha256 NOT NULL,
  locator text NOT NULL CHECK (length(locator) BETWEEN 1 AND 1000),
  spans jsonb NOT NULL CHECK (jsonb_typeof(spans) = 'array' AND jsonb_array_length(spans) > 0),
  dependency_ids text[] NOT NULL DEFAULT '{}' CHECK (cardinality(dependency_ids) <= 32 AND array_position(dependency_ids, NULL) IS NULL),
  qualifications text[] NOT NULL DEFAULT '{}' CHECK (array_position(qualifications, NULL) IS NULL),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'withdrawn')),
  is_active boolean NOT NULL DEFAULT false,
  PRIMARY KEY (scope_id, release_sha256, build_id, passage_id),
  UNIQUE (scope_id, build_id, vector_id),
  FOREIGN KEY (scope_id, release_sha256, build_id) REFERENCES neuvetra_research_dev.research_releases,
  FOREIGN KEY (scope_id, source_sha256) REFERENCES neuvetra_research_dev.research_sources,
  FOREIGN KEY (scope_id, extraction_sha256) REFERENCES neuvetra_research_dev.research_objects(scope_id, object_sha256),
  CHECK (text_sha256 = encode(sha256(convert_to(text, 'UTF8')), 'hex'))
);
CREATE TABLE neuvetra_research_dev.research_ingestion_runs (
  scope_id uuid NOT NULL,
  build_id uuid NOT NULL,
  release_sha256 neuvetra_research_dev.sha256 NOT NULL,
  manifest_sha256 neuvetra_research_dev.sha256 NOT NULL,
  expected_passage_ids text[] NOT NULL CHECK (cardinality(expected_passage_ids) BETWEEN 1 AND 32 AND array_position(expected_passage_ids, NULL) IS NULL),
  state text NOT NULL DEFAULT 'staged' CHECK (state IN ('staged', 'verified', 'active', 'failed', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, build_id),
  FOREIGN KEY (scope_id, release_sha256, build_id) REFERENCES neuvetra_research_dev.research_releases
);
CREATE TABLE neuvetra_research_dev.research_active_builds (
  scope_id uuid PRIMARY KEY,
  release_sha256 neuvetra_research_dev.sha256 NOT NULL,
  build_id uuid NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (scope_id, release_sha256, build_id) REFERENCES neuvetra_research_dev.research_releases,
  FOREIGN KEY (scope_id, build_id) REFERENCES neuvetra_research_dev.research_ingestion_runs
);

-- Content projections are immutable; only explicit approval/withdrawal flags
-- can change. Objects can be deleted only after their references are removed.
CREATE FUNCTION neuvetra_research_dev.reject_content_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status', 'review_status', 'is_active'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'review_status', 'is_active']) THEN
    RAISE EXCEPTION 'immutable_research_content';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_objects BEFORE UPDATE ON neuvetra_research_dev.research_objects FOR EACH ROW EXECUTE FUNCTION neuvetra_research_dev.reject_content_change();
CREATE TRIGGER immutable_sources BEFORE UPDATE ON neuvetra_research_dev.research_sources FOR EACH ROW EXECUTE FUNCTION neuvetra_research_dev.reject_content_change();
CREATE TRIGGER immutable_releases BEFORE UPDATE ON neuvetra_research_dev.research_releases FOR EACH ROW EXECUTE FUNCTION neuvetra_research_dev.reject_content_change();
CREATE TRIGGER immutable_passages BEFORE UPDATE ON neuvetra_research_dev.research_passages FOR EACH ROW EXECUTE FUNCTION neuvetra_research_dev.reject_content_change();

-- Ordinary identities can read only. No function accepts a caller-selected
-- auth identity; membership is evaluated from the signed request's auth.uid().
ALTER TABLE neuvetra_research_dev.research_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuvetra_research_dev.research_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuvetra_research_dev.research_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuvetra_research_dev.research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuvetra_research_dev.research_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuvetra_research_dev.research_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuvetra_research_dev.research_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE neuvetra_research_dev.research_active_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_memberships ON neuvetra_research_dev.research_memberships FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY member_scopes ON neuvetra_research_dev.research_scopes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM neuvetra_research_dev.research_memberships m WHERE m.scope_id = research_scopes.scope_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY member_objects ON neuvetra_research_dev.research_objects FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM neuvetra_research_dev.research_memberships m WHERE m.scope_id = research_objects.scope_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY member_sources ON neuvetra_research_dev.research_sources FOR SELECT TO authenticated USING (review_status = 'approved' AND EXISTS (SELECT 1 FROM neuvetra_research_dev.research_memberships m WHERE m.scope_id = research_sources.scope_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY member_runs ON neuvetra_research_dev.research_ingestion_runs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM neuvetra_research_dev.research_memberships m WHERE m.scope_id = research_ingestion_runs.scope_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY member_active ON neuvetra_research_dev.research_active_builds FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM neuvetra_research_dev.research_memberships m WHERE m.scope_id = research_active_builds.scope_id AND m.user_id = (SELECT auth.uid())));
CREATE POLICY active_releases ON neuvetra_research_dev.research_releases FOR SELECT TO authenticated USING (status = 'approved' AND review_expires_at > now() AND EXISTS (SELECT 1 FROM neuvetra_research_dev.research_active_builds a WHERE a.scope_id = research_releases.scope_id AND a.release_sha256 = research_releases.release_sha256 AND a.build_id = research_releases.build_id));
CREATE POLICY active_passages ON neuvetra_research_dev.research_passages FOR SELECT TO authenticated USING (is_active AND review_status = 'approved' AND EXISTS (SELECT 1 FROM neuvetra_research_dev.research_releases r WHERE r.scope_id = research_passages.scope_id AND r.release_sha256 = research_passages.release_sha256 AND r.build_id = research_passages.build_id));
REVOKE ALL ON ALL TABLES IN SCHEMA neuvetra_research_dev FROM PUBLIC, anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA neuvetra_research_dev TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA neuvetra_research_dev TO service_role;
REVOKE INSERT, UPDATE, DELETE ON neuvetra_research_dev.research_active_builds FROM service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA neuvetra_research_dev REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA neuvetra_research_dev REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Admin-only activation, atomically switching one scope pointer. External
-- vector/object byte verification is the trusted provisioner's responsibility;
-- the 'verified' state does not independently prove those external operations.
CREATE FUNCTION neuvetra_research_dev.activate_research_build(p_scope_id uuid, p_build_id uuid, p_manifest_sha256 text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE run_record record; actual_ids text[]; expected_ids text[];
BEGIN
  PERFORM 1 FROM neuvetra_research_dev.research_scopes WHERE scope_id = p_scope_id FOR UPDATE;
  SELECT i.*, r.status, r.review_expires_at INTO run_record
    FROM neuvetra_research_dev.research_ingestion_runs i
    JOIN neuvetra_research_dev.research_releases r USING (scope_id, release_sha256, build_id)
    WHERE i.scope_id = p_scope_id AND i.build_id = p_build_id FOR UPDATE OF i;
  IF NOT FOUND OR run_record.manifest_sha256 IS DISTINCT FROM p_manifest_sha256
     OR run_record.state NOT IN ('verified','active') OR run_record.status <> 'approved'
     OR run_record.review_expires_at <= now() THEN RAISE EXCEPTION 'build_not_verified'; END IF;
  SELECT array_agg(x ORDER BY x) INTO expected_ids FROM unnest(run_record.expected_passage_ids) x;
  SELECT array_agg(passage_id ORDER BY passage_id) INTO actual_ids
    FROM neuvetra_research_dev.research_passages WHERE scope_id = p_scope_id AND build_id = p_build_id AND is_active AND review_status = 'approved';
  IF expected_ids IS DISTINCT FROM actual_ids THEN RAISE EXCEPTION 'incomplete_build'; END IF;
  IF EXISTS (
    SELECT 1 FROM neuvetra_research_dev.research_passages p
    JOIN neuvetra_research_dev.research_sources s USING (scope_id, source_sha256)
    JOIN neuvetra_research_dev.research_objects o ON o.scope_id = p.scope_id AND o.object_sha256 = p.source_sha256
    JOIN neuvetra_research_dev.research_objects e ON e.scope_id = p.scope_id AND e.object_sha256 = p.extraction_sha256
    WHERE p.scope_id = p_scope_id AND p.build_id = p_build_id AND p.is_active
      AND (s.review_status <> 'approved' OR o.kind <> 'source' OR e.kind <> 'extraction')
  ) OR NOT EXISTS (SELECT 1 FROM neuvetra_research_dev.research_objects WHERE scope_id = p_scope_id AND object_sha256 = run_record.release_sha256 AND kind = 'release')
    THEN RAISE EXCEPTION 'source_not_verified'; END IF;
  IF EXISTS (
    SELECT 1 FROM neuvetra_research_dev.research_passages p CROSS JOIN LATERAL unnest(p.dependency_ids) dep
    LEFT JOIN neuvetra_research_dev.research_passages d ON d.scope_id = p.scope_id AND d.build_id = p.build_id AND d.release_sha256 = p.release_sha256 AND d.passage_id = dep
    WHERE p.scope_id = p_scope_id AND p.build_id = p_build_id AND p.is_active
      AND (d.passage_id IS NULL OR NOT d.is_active OR d.review_status <> 'approved')
  ) THEN RAISE EXCEPTION 'dependency_not_verified'; END IF;
  IF EXISTS (
    WITH RECURSIVE walk(id, seen, cycle) AS (
      SELECT passage_id, ARRAY[passage_id], false FROM neuvetra_research_dev.research_passages WHERE scope_id = p_scope_id AND build_id = p_build_id AND is_active
      UNION ALL
      SELECT dep, w.seen || dep, dep = ANY(w.seen) FROM walk w
      JOIN neuvetra_research_dev.research_passages p ON p.scope_id = p_scope_id AND p.build_id = p_build_id AND p.passage_id = w.id
      CROSS JOIN LATERAL unnest(p.dependency_ids) dep WHERE NOT w.cycle
    ) SELECT 1 FROM walk WHERE cycle
  ) THEN RAISE EXCEPTION 'dependency_cycle'; END IF;
  UPDATE neuvetra_research_dev.research_ingestion_runs SET state = 'inactive' WHERE scope_id = p_scope_id AND state = 'active' AND build_id <> p_build_id;
  INSERT INTO neuvetra_research_dev.research_active_builds(scope_id, release_sha256, build_id)
    VALUES (p_scope_id, run_record.release_sha256, p_build_id)
    ON CONFLICT (scope_id) DO UPDATE SET release_sha256 = EXCLUDED.release_sha256, build_id = EXCLUDED.build_id, activated_at = now();
  UPDATE neuvetra_research_dev.research_ingestion_runs SET state = 'active' WHERE scope_id = p_scope_id AND build_id = p_build_id;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA neuvetra_research_dev FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION neuvetra_research_dev.activate_research_build(uuid, uuid, text) TO service_role;

-- Only the new bucket is affected by these additive Storage policies. The
-- coordinator creates/verifies it PRIVATE via the Storage API, never public.
CREATE POLICY neuvetra_research_dev_member_download ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'neuvetra-research-dev' AND EXISTS (SELECT 1 FROM neuvetra_research_dev.research_objects o WHERE o.bucket = bucket_id AND o.object_key = name));
CREATE POLICY neuvetra_research_dev_anon_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO anon
USING (bucket_id <> 'neuvetra-research-dev');
CREATE POLICY neuvetra_research_dev_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (bucket_id <> 'neuvetra-research-dev' OR EXISTS (SELECT 1 FROM neuvetra_research_dev.research_objects o WHERE o.bucket = bucket_id AND o.object_key = name));
CREATE POLICY neuvetra_research_dev_insert_fence ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (bucket_id <> 'neuvetra-research-dev');
CREATE POLICY neuvetra_research_dev_update_fence ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (bucket_id <> 'neuvetra-research-dev') WITH CHECK (bucket_id <> 'neuvetra-research-dev');
CREATE POLICY neuvetra_research_dev_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (bucket_id <> 'neuvetra-research-dev');

COMMIT;
