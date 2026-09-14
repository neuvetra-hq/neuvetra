# Legacy database access review

CLOUD-SEC-01, September 9, 2026 UTC. Read-only code and catalog assessment; no customer rows, credentials or live calls by this reviewer. Proposed containment is separate from the synthetic research schema and does not make the legacy applications secure.

## Finding and bounded recommendation

The coordinator's successful direct inventory `.superpowers/cloud-db-inventory-05-direct.json`, SHA-256 `023973c8eec1fbf690375272963ce2c5433e437be8b5e251b7fc1d21c13d03d5`, records RLS disabled on `public.users` and six `frontdesk` tables. Each grants `anon`, `authenticated` and `service_role` SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER. The coordinator also observed `/users` in the REST schema. This establishes a dangerous access configuration, not proof that customer rows exist or have been accessed. Other schemas' actual Data API exposure and effective inherited/column grants still need the narrow checks below.

The subsequent read-only preflight `.superpowers/legacy-access-preflight-01.json`, SHA-256 `b6b0e358aa1a7daf90317d40c1b43bb7abda77b7ceeb163b0a427e4515273dce`, captures 56 anonymous rollback grants: eight per table, including `MAINTAIN`, which the earlier information-schema inventory omitted. All seven table owners and anonymous grantors are `postgres`. The target-specific effective checks below include all eight privileges; the exact ACL rollback query already captures `MAINTAIN` without filtering it out. The coordinator reports a no-row public-key HEAD returned 200 for `public.users`, while the FrontDesk endpoint check returned 406 and did not succeed; its exact cause was not established from HEAD alone.

The coordinator subsequently applied the exact containment SQL `82c71c10c66d270ef322365111ac8cbba3a4562ce155d3dcfdee23ca7e8ea102`. [Saved observation](../../evaluations/cloud-integration/observations/2026-09-09-legacy-anon-containment.json) records all eight anonymous table privileges and column access denied on all seven tables, unchanged non-anonymous ACLs/effective permissions and unchanged Auth trigger metadata. The no-row `public.users` HEAD changed from 200 to 401; FrontDesk remained 406. Independent QA checked the before/after metadata. No customer rows were requested or changed. This is anonymous containment only; the authenticated RLS and privileged API risks below remain unresolved.

The completed slice is reviewed **anon-only** containment on those seven relations. It keeps `authenticated` permissions unchanged because mounted FrontDesk workflows depend on them, and preserves backend database access and `service_role`. The separate [SQL artifact](../../infra/cloud/002-legacy-anon-containment.sql) revokes only direct anonymous table and column privileges, uses RESTRICT, and rolls back if effective anonymous privileges remain through another grant path. It does not enable RLS or alter Auth, data, functions, memberships, defaults or existing authenticated behavior. Its original proposed-state header is preserved as part of the exact executed bytes; the dated observation records application.

Authenticated unrestricted access remains a required RLS/authorization follow-up. A signed-in account must not be able to read other profiles, change membership/ownership or access calendar credentials. Do not report this anon-only step as tenant isolation. Supabase distinguishes unsigned `anon` requests from signed-in `authenticated` requests; even Supabase anonymous-auth users use the latter role. [Official RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Actual code dependencies

| Surface | Relevant code | Consequence |
| --- | --- | --- |
| Browser client | `apps/frontdesk-web/src/lib/supabase.ts:3` reads public URL/key build settings. | Source file only inspected; no actual key/URL values read. |
| Signed-in bootstrap | `apps/frontdesk-web/src/contexts/AuthContext.tsx:30`, `:38`, `:44`; `src/lib/account-data.ts:23`, `:39`, `:63`. | Reads `public.users` and `frontdesk.business_members` joined to `businesses` after obtaining a session. Browser filters are not authorization. |
| Mounted login | `apps/frontdesk-web/src/App.tsx:54`; `src/pages/LoginPage.tsx:70`. | User-table lookup occurs after `verifyOtp`; anon grants are not its intended dependency. |
| Mounted onboarding | `src/pages/SignupPage.tsx:62`, `:77`; `src/pages/app/AppGetStartedPage.tsx:121`; OTP components `src/components/signup/StepVerify.tsx:33` and `src/components/get-started/StepVerify.tsx:34`. | Direct user upserts and membership lookups follow OTP verification. Removing authenticated SELECT/INSERT/UPDATE would break profile/onboarding flows. The app get-started upsert also ignores its returned error. |
| Retained alternate form | `src/components/auth/SignupForm.tsx:43`, `:60`, `:66`. | Inserts business/membership after email signup without checking for a session. No import/mount found anywhere in current `frontdesk-web/src`; an older deployed build could differ. Do not preserve anonymous writes to support this unsafe retained path. |
| API database operations | `packages/frontdesk-database/src/client.ts:5`; `apps/frontdesk-api/src/routes/businesses.ts:2`; `src/routes/billing.ts:3`. | Backend uses Drizzle/Postgres with `DATABASE_URL`, not browser anon table grants. Runtime role on an existing deployment was not inspected. |
| API Supabase clients | `apps/frontdesk-api/src/middleware/auth.ts:4`; `src/routes/billing.ts:8`; `src/routes/calendar.ts:17`. | Service-role client primarily validates Auth tokens; billing also performs administrative Auth deletion. Table operations use Drizzle. |
| Auth profile trigger | `packages/frontdesk-database/migrations/0002_sync_users_trigger.sql:5`. | Declared SECURITY DEFINER; proposed table grants do not change it. Live owner/security-definer metadata must be checked; a migration file is not proof of deployment. |
| Current Neuvetra preview/research | `apps/site-web/src/App.tsx:1`; `apps/site-api/src/research-passages-server.ts:1`. | Current mounted preview and isolated experiment do not use legacy table access. Retained Site auth uses Auth APIs (`apps/site-api/src/lib/auth.ts:39`), not `public.users` queries. |

The current browser source contains no mounted direct reads/writes of `calls`, `knowledge_base`, `calendar_connections` or `callback_requests`. Their backend-only use makes unrestricted authenticated grants unnecessary in this checkout, but changing them is outside this anon-only slice and requires checking the actual deployed build. Schema code includes phone fields, calendar access/refresh tokens and call transcripts/recording URLs (`packages/frontdesk-database/src/schema.ts:73`, `:151`, `:196`); no contents were inspected.

An independent remaining path is the legacy API: `apps/frontdesk-api/src/routes/businesses.ts:8` defines routes without the auth middleware, and `src/index.ts:32` mounts that group directly. For example it accepts a caller-supplied user ID when creating a business. Revoking PostgREST grants does not secure an API operating under a privileged database role. This review did not probe live API behavior.

## Metadata-only preflight and reversible change

The coordinator should save these query results privately **before** executing the proposed SQL. Use the reviewed direct TLS connection and a read-only transaction. None of these queries reads application rows. Freeze the proposed SQL hash and the preflight result; if ownership/grants change, re-review instead of blindly applying a stale rollback.

First capture table ownership/RLS and full table/column ACLs, including PUBLIC and other grantors. Raw ACL fields are privilege metadata, not credentials:

```sql
WITH targets AS (
  SELECT unnest(ARRAY['public.users','frontdesk.businesses','frontdesk.business_members',
    'frontdesk.calls','frontdesk.knowledge_base','frontdesk.calendar_connections',
    'frontdesk.callback_requests'])::regclass AS oid
)
SELECT n.nspname AS schema, c.relname AS relation, pg_get_userbyid(c.relowner) AS owner,
  c.relrowsecurity, c.relforcerowsecurity, c.relacl::text AS table_acl,
  a.attname AS column_name, a.attacl::text AS column_acl
FROM targets t JOIN pg_catalog.pg_class c ON c.oid=t.oid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0
  AND NOT a.attisdropped AND a.attacl IS NOT NULL
ORDER BY 1,2,7;
```

Capture exact anonymous rollback statements with original grantor and grant options. The proposed migration requires each table owner to be the executing role and refuses anonymous ACL entries from any other grantor. That keeps these restoration statements faithful to the captured explicit grants when executed as that same owner. Do not synthesize broad `GRANT ALL`:

```sql
WITH targets AS (
  SELECT unnest(ARRAY['public.users','frontdesk.businesses','frontdesk.business_members',
    'frontdesk.calls','frontdesk.knowledge_base','frontdesk.calendar_connections',
    'frontdesk.callback_requests'])::regclass AS oid
), grants AS (
  SELECT c.oid, c.relnamespace, c.relname, NULL::text AS column_name, acl.*
  FROM targets t JOIN pg_catalog.pg_class c ON c.oid=t.oid
  CROSS JOIN LATERAL aclexplode(c.relacl) acl
  UNION ALL
  SELECT c.oid, c.relnamespace, c.relname, a.attname, acl.*
  FROM targets t JOIN pg_catalog.pg_class c ON c.oid=t.oid
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
  CROSS JOIN LATERAL aclexplode(a.attacl) acl
)
SELECT n.nspname AS schema, g.relname AS relation, g.column_name,
  pg_get_userbyid(g.grantor) AS grantor, g.privilege_type, g.is_grantable,
  format('GRANT %s%s ON TABLE %I.%I TO anon%s;', g.privilege_type,
    CASE WHEN g.column_name IS NULL THEN '' ELSE format(' (%I)',g.column_name) END,
    n.nspname,g.relname,CASE WHEN g.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
  ) AS rollback_sql
FROM grants g JOIN pg_catalog.pg_namespace n ON n.oid=g.relnamespace
WHERE g.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='anon')
ORDER BY 1,2,3 NULLS FIRST,5;
```

Before and after the change, compare effective privileges for all three roles. Both functions include privileges reachable through inheritance/PUBLIC; the column check catches separately granted column access. Schema USAGE is also reported, without changing it. [PostgreSQL privilege inquiry functions](https://www.postgresql.org/docs/current/functions-info.html)

```sql
WITH targets(relation) AS (VALUES ('public.users'),('frontdesk.businesses'),
  ('frontdesk.business_members'),('frontdesk.calls'),('frontdesk.knowledge_base'),
  ('frontdesk.calendar_connections'),('frontdesk.callback_requests')),
roles(role) AS (VALUES ('anon'),('authenticated'),('service_role'))
SELECT relation,role,
  has_schema_privilege(role,split_part(relation,'.',1),'USAGE') AS schema_usage,
  has_table_privilege(role,relation,'SELECT') AS can_select,
  has_table_privilege(role,relation,'INSERT') AS can_insert,
  has_table_privilege(role,relation,'UPDATE') AS can_update,
  has_table_privilege(role,relation,'DELETE') AS can_delete,
  has_table_privilege(role,relation,'TRUNCATE') AS can_truncate,
  has_table_privilege(role,relation,'REFERENCES') AS can_reference,
  has_table_privilege(role,relation,'TRIGGER') AS can_trigger,
  has_table_privilege(role,relation,'MAINTAIN') AS can_maintain,
  has_any_column_privilege(role,relation,'SELECT,INSERT,UPDATE,REFERENCES') AS any_column_access
FROM targets CROSS JOIN roles ORDER BY 1,2;

SELECT t.tgname,t.tgenabled,p.proname,p.prosecdef,pg_get_userbyid(p.proowner) AS function_owner
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='auth.users'::regclass AND t.tgname='on_auth_user_created'
  AND NOT t.tgisinternal;
```

Expected after-state: all eight table-operation flags and `any_column_access` are false for anon, while authenticated/service-role effective flags and ACL entries remain identical to the preflight. Capture the added `can_maintain` value before and after execution; the earlier effective matrix did not include that field. The migration's effective check fails and rolls back if an inherited or PUBLIC path survives; do not add CASCADE or revoke unrelated roles to force it through. PostgreSQL automatically revokes corresponding column privileges when table privileges are revoked. Column ACL capture and effective checks still matter for exact rollback and detection of surviving grant paths. [PostgreSQL REVOKE](https://www.postgresql.org/docs/current/sql-revoke.html)

Then the coordinator may make a bounded no-row Data API check using the public key only: `GET /rest/v1/users?select=id&limit=0`, and the six corresponding relations with `Accept-Profile: frontdesk` only if that schema is exposed. Use no `Prefer: count`, no customer filters and no returned row request. An HTTP denial or schema omission should corroborate SQL privilege results. Do not prove write denial by issuing INSERT/PATCH/DELETE/TRUNCATE against real data; the effective privilege probes suffice for this slice. This does not cover indirect views/functions or privileged API routes.

Before commit, any error rolls back atomically. After commit, rollback is an explicit operator decision to restore only the pre-captured anonymous grants in a bounded transaction as the same owner, followed by the same effective/ACL comparison. It reopens the exposure and should not be automatic merely because an outdated client fails. No rollback removes data or touches authenticated grants.

## Validation and remaining boundary

Only repository/source inspection and saved inventory/preflight/result metadata were read by this reviewer. The coordinator executed the preflight and containment, and independent QA verified the scoped outcome above. Real signed-in flow compatibility, deployed-build identity, default future grants, indirect RPC/view exposure and the authenticated RLS work remain separate checks. Public configuration source files are `apps/frontdesk-web/src/lib/supabase.ts` and retained `apps/site-web/src/lib/supabase.ts`; their configured values were not read by this reviewer. The preflight/rollback procedure remains above as reproducible history; do not reapply it merely because the original SQL header says proposed.
