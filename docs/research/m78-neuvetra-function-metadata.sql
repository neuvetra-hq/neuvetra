-- Root verifies Neuvetra icockcoguyadhryzydvl before execution.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SELECT n.nspname AS schema, p.proname, p.oid::regprocedure::text AS signature,
  pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS security_definer,
  p.provolatile, p.proacl::text AS acl,
  (SELECT setting FROM unnest(p.proconfig) AS setting
   WHERE split_part(setting,'=',1)='search_path') AS function_search_path,
  md5(pg_get_functiondef(p.oid)) AS definition_md5,
  l.lanname AS language
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid=p.prolang
WHERE (n.nspname='neuvetra' AND p.proname IN('electricity_source_fixtures',
 'reject_inventory_history_mutation','m67_method','m67_limitations','m68_limitations',
 'annual_evidence_report_template')) OR(n.nspname='public' AND p.proname='set_updated_at')
ORDER BY 1,2,3;
ROLLBACK;
