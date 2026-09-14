-- READ ONLY. Does not configure exposure, read secrets, or return customer rows.
-- Run on the already verified target; capture output before proposing a change.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

-- This is the operator connection's setting, NOT the running Data API's value.
SELECT current_database() AS database, current_user AS connection_role,
  current_setting('pgrst.db_schemas', true) AS operator_connection_db_schemas;

-- Return only the named setting, never complete rolconfig/setconfig arrays.
-- Include defaults which can apply to authenticator in the current database.
SELECT
  CASE WHEN s.setrole = 0 THEN 'all_roles' ELSE r.rolname END AS role_scope,
  CASE WHEN s.setdatabase = 0 THEN 'all_databases' ELSE d.datname END AS database_scope,
  substring(entry.setting FROM length('pgrst.db_schemas=') + 1) AS db_schemas
FROM pg_catalog.pg_db_role_setting s
LEFT JOIN pg_catalog.pg_roles r ON r.oid = s.setrole
LEFT JOIN pg_catalog.pg_database d ON d.oid = s.setdatabase
CROSS JOIN LATERAL unnest(s.setconfig) AS entry(setting)
WHERE (s.setrole = 0 OR r.rolname = 'authenticator')
  AND (s.setdatabase = 0 OR d.datname = current_database())
  AND split_part(entry.setting, '=', 1) = 'pgrst.db_schemas'
ORDER BY role_scope, database_scope;

ROLLBACK;
