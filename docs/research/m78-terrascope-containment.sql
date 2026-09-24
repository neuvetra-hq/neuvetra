-- M78-SECURITY-01 candidate3. Root only, AFTER independent review.
-- Exact target: Terrascope jfjbiqeplnbxkadqnimt. Dashboard identity is external
-- evidence; database name alone is NOT a project identity check.
-- Observed metadata: .superpowers/m78-terrascope-metadata-first.csv.
-- Removes unrestricted anon/authenticated access on exactly five tables.
-- Preserves rows, postgres/service_role, policies (none), schemas and roles.
-- No FORCE RLS. No new policy. No mutation of any Neuvetra project object.
-- A failed/uncertain execution requires fresh metadata inspection before retry.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
LOCK TABLE public.companies,public.company_members,public.emission_factors,
  public.ghg_reports,public.users IN ACCESS EXCLUSIVE MODE;
DO $m78$
DECLARE
  target_names text[] := ARRAY['companies','company_members','emission_factors','ghg_reports','users'];
  expected_before text := '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}';
  expected_after text := '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}';
  t record;
  r record;
  p text;
  changed integer := 0;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres'
     OR current_setting('server_version_num')::integer<170000 THEN
    RAISE EXCEPTION 'M78 operator or server version mismatch';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN
      ('postgres','anon','authenticated','service_role','authenticator'))<>5
     OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role' AND rolbypassrls AND NOT rolsuper)
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated','authenticator') AND(rolsuper OR rolbypassrls))
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles api_role ON api_role.oid=m.member
       WHERE api_role.rolname IN('anon','authenticated','service_role')) THEN
    RAISE EXCEPTION 'M78 API role drift';
  END IF;
  -- Catalog-only event-trigger bound: permit no matching hook, or only the
  -- exact provider watcher reviewed to issue NOTIFY pgrst,'reload schema'.
  -- DROP/CREATE-only hooks cannot match these REVOKE/ALTER TABLE statements.
  IF current_setting('session_replication_role')<>'origin'
     OR EXISTS(
       SELECT 1 FROM pg_catalog.pg_event_trigger event_hook
       JOIN pg_catalog.pg_proc hook_function ON hook_function.oid=event_hook.evtfoid
       JOIN pg_catalog.pg_namespace hook_schema ON hook_schema.oid=hook_function.pronamespace
       WHERE event_hook.evtenabled IN('O','A')
         AND event_hook.evtevent IN('ddl_command_start','ddl_command_end','table_rewrite')
         AND(event_hook.evttags IS NULL OR event_hook.evttags && ARRAY['ALTER TABLE','REVOKE','GRANT'])
         AND NOT(event_hook.evtname='pgrst_ddl_watch' AND event_hook.evtevent='ddl_command_end'
           AND event_hook.evttags IS NULL AND hook_schema.nspname='extensions'
           AND hook_function.proname='pgrst_ddl_watch' AND hook_function.pronargs=0
           AND pg_get_userbyid(hook_function.proowner)='supabase_admin' AND NOT hook_function.prosecdef
           AND md5(pg_get_functiondef(hook_function.oid))='afaad7193dcf8f81e728d2bedb85e43e')) THEN
    RAISE EXCEPTION 'M78 unexpected DDL event hook';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=ANY(target_names))<>5 THEN
    RAISE EXCEPTION 'M78 target set drift';
  END IF;
  -- Validate the complete target set before changing any relation.
  FOR t IN SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY(target_names) ORDER BY c.relname LOOP
    IF t.relkind<>'r' OR t.relispartition OR t.relowner<>'postgres'::regrole
       OR t.relrowsecurity OR t.relforcerowsecurity OR t.relacl::text IS DISTINCT FROM expected_before
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=t.oid)
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits WHERE inhrelid=t.oid OR inhparent=t.oid)
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL)
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=t.oid AND NOT tgisinternal)
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_depend WHERE classid='pg_catalog.pg_class'::regclass
           AND objid=t.oid AND refclassid='pg_catalog.pg_extension'::regclass AND deptype='e')
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_depend WHERE refclassid='pg_catalog.pg_class'::regclass
           AND refobjid=t.oid AND classid NOT IN('pg_catalog.pg_constraint'::regclass,
             'pg_catalog.pg_attrdef'::regclass,'pg_catalog.pg_class'::regclass,'pg_catalog.pg_type'::regclass)) THEN
      RAISE EXCEPTION 'M78 target catalog drift';
    END IF;
    FOR r IN SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated','service_role') LOOP
      IF NOT has_schema_privilege(r.oid,'public','USAGE') THEN RAISE EXCEPTION 'M78 schema access drift'; END IF;
      FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
        IF NOT has_table_privilege(r.oid,t.oid,p) THEN RAISE EXCEPTION 'M78 table access drift'; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  FOR t IN SELECT c.oid,c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY(target_names) ORDER BY c.relname LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated RESTRICT',t.relname);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.relname);
    changed:=changed+1;
  END LOOP;
  IF changed<>5 THEN RAISE EXCEPTION 'M78 changed count mismatch'; END IF;
  FOR t IN SELECT c.* FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY(target_names) ORDER BY c.relname LOOP
    IF NOT t.relrowsecurity OR t.relforcerowsecurity OR t.relowner<>'postgres'::regrole
       OR t.relacl::text IS DISTINCT FROM expected_after
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid=t.oid)
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL) THEN
      RAISE EXCEPTION 'M78 after catalog mismatch';
    END IF;
    FOR r IN SELECT oid,rolname FROM pg_catalog.pg_roles WHERE rolname IN('anon','authenticated') LOOP
      FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
        IF has_table_privilege(r.oid,t.oid,p) THEN RAISE EXCEPTION 'M78 retained endpoint table privilege'; END IF;
      END LOOP;
      IF has_any_column_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'M78 retained endpoint column privilege';
      END IF;
    END LOOP;
    FOR r IN SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN('postgres','service_role') LOOP
      IF NOT has_schema_privilege(r.oid,'public','USAGE') THEN RAISE EXCEPTION 'M78 retained role schema access mismatch'; END IF;
      FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
        IF NOT has_table_privilege(r.oid,t.oid,p) THEN RAISE EXCEPTION 'M78 retained role table access mismatch'; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $m78$;
COMMIT;
-- Root then executes the read-only metadata query and refreshes the advisor.
-- Do not automatically restore unrestricted access if an obsolete client fails.
