-- M78-SECURITY-01: root verifies project jfjbiqeplnbxkadqnimt in dashboard first.
-- Catalog metadata only. No application rows, function bodies or broad settings.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
WITH targets AS (
  SELECT c.* FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN
    ('companies','ghg_reports','users','emission_factors','company_members')
), endpoint_roles AS (
  SELECT * FROM pg_catalog.pg_roles
  WHERE rolname IN ('anon','authenticated','service_role','authenticator')
), privileges AS (
  SELECT v.p FROM (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
    ('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(p)
  UNION ALL SELECT 'MAINTAIN' WHERE current_setting('server_version_num')::int>=170000
)
SELECT jsonb_build_object(
  'observed_at',clock_timestamp(),
  'session',jsonb_build_object('database',current_database(),'role',current_user,
    'read_only',current_setting('transaction_read_only'),
    'server_version_num',current_setting('server_version_num')),
  'tables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table',t.relname,'kind',t.relkind,'owner',pg_get_userbyid(t.relowner),
    'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity,'acl',t.relacl::text)
    ORDER BY t.relname),'[]') FROM targets t),
  'schema',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl::text)
    FROM pg_catalog.pg_namespace WHERE nspname='public'),
  'roles',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',rolname,
    'superuser',rolsuper,'bypass_rls',rolbypassrls,'inherit',rolinherit,
    'schema_usage',has_schema_privilege(oid,'public','USAGE'),
    'schema_create',has_schema_privilege(oid,'public','CREATE')) ORDER BY rolname),'[]') FROM endpoint_roles),
  'effective_grants',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table',t.relname,'role',r.rolname,'privilege',p.p,
    'allowed',has_table_privilege(r.oid,t.oid,p.p)) ORDER BY t.relname,r.rolname,p.p),'[]')
    FROM targets t CROSS JOIN endpoint_roles r CROSS JOIN privileges p),
  'column_acl',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.relname,
    'column',a.attname,'acl',a.attacl::text) ORDER BY t.relname,a.attnum),'[]')
    FROM targets t JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid
    WHERE a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL),
  'effective_column_access',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table',t.relname,'role',r.rolname,'allowed',
    has_any_column_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
    ORDER BY t.relname,r.rolname),'[]') FROM targets t CROSS JOIN endpoint_roles r),
  'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.relname,
    'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
    'roles',p.polroles,'using_md5',md5(pg_get_expr(p.polqual,p.polrelid)),
    'check_md5',md5(pg_get_expr(p.polwithcheck,p.polrelid))) ORDER BY t.relname,p.polname),'[]')
    FROM targets t JOIN pg_catalog.pg_policy p ON p.polrelid=t.oid),
  'foreign_keys',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',k.conname,
    'from',k.conrelid::regclass::text,'to',k.confrelid::regclass::text)
    ORDER BY k.conrelid,k.conname),'[]') FROM pg_catalog.pg_constraint k
    WHERE k.contype='f' AND (k.conrelid IN(SELECT oid FROM targets) OR k.confrelid IN(SELECT oid FROM targets))),
  'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.relname,
    'trigger',g.tgname,'enabled',g.tgenabled,'function',p.oid::regprocedure::text,
    'security_definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner)) ORDER BY t.relname,g.tgname),'[]')
    FROM targets t JOIN pg_catalog.pg_trigger g ON g.tgrelid=t.oid
    JOIN pg_catalog.pg_proc p ON p.oid=g.tgfoid WHERE NOT g.tgisinternal),
  'catalog_dependents',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table',t.relname,'class',d.classid::regclass::text,'object_oid',d.objid,
    'subobject',d.objsubid,'dependency_type',d.deptype)
    ORDER BY t.relname,d.classid,d.objid,d.objsubid),'[]') FROM targets t
    JOIN pg_catalog.pg_depend d ON d.refobjid=t.oid AND d.refclassid='pg_catalog.pg_class'::regclass),
  'extension_ownership',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.relname,
    'extension',e.extname) ORDER BY t.relname),'[]') FROM targets t
    JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_class'::regclass
      AND d.objid=t.oid AND d.objsubid=0 AND d.deptype='e'
      AND d.refclassid='pg_catalog.pg_extension'::regclass
    JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid),
  'role_memberships',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'member',pg_get_userbyid(m.member),'granted_role',pg_get_userbyid(m.roleid),
    'admin_option',m.admin_option) ORDER BY m.member,m.roleid),'[]')
    FROM pg_catalog.pg_auth_members m WHERE m.member IN(SELECT oid FROM endpoint_roles)),
  'default_acl',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'owner',pg_get_userbyid(d.defaclrole),
    'object_type',d.defaclobjtype,'acl',d.defaclacl::text)
    ORDER BY d.defaclrole,d.defaclnamespace,d.defaclobjtype),'[]')
    FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
    WHERE d.defaclnamespace=0 OR n.nspname='public')
) AS metadata;
ROLLBACK;
