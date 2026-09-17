# M78 Supabase alert assessment and metadata inspection plan

Task M78-SECURITY-01; assessment mode; author `/root/m78_security`; reviewed checkout `0e95d70ae77fdf412ab81ddd110a64abb95f8a9d`. Requested compute Astra/high; observed setting unknown. This report is an assessment deliverable, not an executed remediation or a current hosted security verdict.

## Disposition

The board supplied a September 15 email describing September 13 findings for `rls_disabled_in_public` on Neuvetra `icockcoguyadhryzydvl` and retired Terrascope `jfjbiqeplnbxkadqnimt`, without table names. Root subsequently obtained signed-in access and refreshed both advisors on September 17 UTC (September 16 Pacific). See [root's current observations](m78-security-observations.md). This worker made no hosted requests, read no private configuration or customer rows, and changed no grants, roles, policies, data or provider settings.

**Neuvetra: refreshed advisor has zero errors; the dated critical alert was not reproduced. Terrascope: the five confirmed table-access defects were contained by root's explicitly approved candidate3 execution; fresh catalog metadata confirms RLS enabled and anonymous/signed-in table access removed.** Retired branding does not prove the corresponding project is empty or unused. Neither finding establishes existence of customer rows or exploitation.

Root's first attempted browser Run action was rejected by automatic approval review **before execution**: the investigation request did not supply sufficient authorization for the exact five-table permission change. Root requested specific user approval and did not bypass that decision. The user then explicitly approved the exact fix. Root verified the selected SQL against candidate3 and completed the transaction successfully. The earlier approval rejection is preserved; it was not a SQL execution failure.

Actual root receipt `.superpowers/m78-terrascope-containment-result.json` records `approved_containment_committed_catalog_verified` at `2026-09-17T03:10:53.075959+00:00` for the exact Terrascope project and candidate3. Actual `.superpowers/m78-terrascope-post-containment.csv` SHA-256 `0a559d4f36f9aa079dad4c33b92ed8adae170a687109486aa00ef98738e97ef7` has 20 rows: all five tables enable RLS without FORCE or policies, retain only postgres/service_role ACLs, deny endpoint table/column privileges and retain privileged access. Root's [current observation record](m78-security-observations.md) owns the fresh advisor result and any later checks. No live customer-row reads or runtime CRUD tests were performed; synthetic row/CRUD preservation was exercised independently on the local fixture.

Root's completed explicit advisor rerun now reports zero errors, zero warnings and five informational `RLS Enabled No Policy` items for these exact tables (`.superpowers/m78-terrascope-advisor-final.json`). The absent policies intentionally deny endpoint access; they are not a claim of a functioning customer-facing Terrascope permission model. The five critical findings are cleared within this verified boundary, not a broader project security certification.

Supabase documents grants and RLS as separate controls: object privileges determine access to a table; policies determine accessible rows. Both should protect exposed objects. Its 0013 advisory recommends enabling RLS, which can prevent existing client access unless suitable policies exist. An alert alone does not establish that the relevant role currently has the schema/object access needed for a successful request. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api), [Supabase 0013 advisory](https://supabase.github.io/splinter/0013_rls_disabled_in_public/), consulted during this assessment.

## Evidence and limits

| Evidence locator | What it establishes | What it does not establish |
| --- | --- | --- |
| `docs/research/legacy-database-access-review.md`, Finding and bounded recommendation | September 9 inventory found RLS disabled on `public.users` and six FrontDesk tables; initial containment removed anonymous grants only. | Present grants or present table contents. Do not treat its then-open authenticated finding as the latest state. |
| `docs/research/private-staging-milestone-63.md:52` and `:56` | Later M63 history records 31 containment statements, both endpoint-role boundaries, denied application-schema access, zero exposed tables/functions, and three deferred provider-owner default statements. | A current provider observation or permission to repeat those statements. |
| `packages/neuvetra-database/src/staging-audit.ts:28`, `:71` | Catalog-only audit checks effective `anon` and `authenticated` database CREATE, schema USAGE/CREATE, table/column/sequence/function access, unknown application schemas and default privileges. It includes inherited/PUBLIC privilege paths. | The audit does **not** require public-table RLS to be enabled, prove provider API configuration, inspect service-role applications, or review managed schemas. |
| `packages/neuvetra-database/src/staging-audit.ts:11`, `:68` | Provider-owned public defaults for tables/functions/sequences are explicitly deferred, relying on denied schema access and absent current object privileges. | Those defaults have disappeared or new grants could never recur. |
| `packages/neuvetra-database/src/hosted.ts:77`–`:100` | Current readiness calls the containment audit, validates canonical migration receipts and requires restricted non-owner/non-bypass runtime role; ordinary `neuvetra` tables must enable and force RLS. | Every policy is semantically correct or a dated successful readiness result remains current. |
| `packages/neuvetra-database/src/migrations/0020_fugitive_sources.sql:3`–`:17`, `:111` | Eight fugitive tables are created in `neuvetra`, with ENABLE/FORCE RLS, runtime SELECT only through staging-access/company-membership predicates, immutable-history triggers and a bounded executable function list. | Those source bytes alone prove deployed state. These tables are not `public` tables named by the alert category. |
| `docs/research/m77-hosted-delivery.md` and `evaluations/research-qa/m77-hosted-acceptance.md` | Recorded M77 schema20/runtime acceptance and preserved history. | Reassessment of both Supabase projects at this moment. Root owns current observation. |

The Neuvetra historical candidate was `public.users`; the original email omitted relations and the refreshed advisor has no current error. Do not identify all seven historical tables as that alert: six were in `frontdesk`, not `public`. Root's current Terrascope catalog read identifies five tables: `public.companies`, `public.company_members`, `public.emission_factors`, `public.ghg_reports`, and `public.users`. All are owned by postgres, RLS/force RLS are false, policies are absent, and anon/authenticated/service_role each have schema USAGE and effective SELECT/INSERT/UPDATE/DELETE. Remaining full ACL/dependency inspection precedes the exact mitigation.

## Neuvetra's eight current warnings

Root observes seven mutable function search paths and disabled Auth leaked-password protection. Source definitions for six named `neuvetra` functions are invoker mode (no SECURITY DEFINER clause): `electricity_source_fixtures` at migration0012 line32, `m67_method`/`m67_limitations` at migration0013 lines86–87, `m68_limitations` at migration0014 line43, `annual_evidence_report_template` at migration0014 line189, and `reject_inventory_history_mutation` at migration0004 line72. Four return literal JSON, one literal HTML, and the trigger function only raises 42501. These source bodies do not perform unqualified application-table lookups. Their source-mode interpretation must be matched with hosted metadata from [the function query](m78-neuvetra-function-metadata.sql).

Smallest proposed hardening for those six is exact-signature `ALTER FUNCTION ... SET search_path = pg_catalog, pg_temp`, preserving owner, ACL, body, security mode and all retained report bytes. Deliver it as an additive reviewed migration with catalog/replay checks, not ad hoc edits to canonical schema20. The `public.set_updated_at` definition was not found in repository search; inspect its exact definition privately before selecting a safe path. Do not claim its security mode from its name. Leaked-password protection is a separate Auth setting requiring current plan/flow compatibility evidence; this assessment does not change it. Prioritize confirmed Terrascope access exposure.

Root's actual seven-row `.superpowers/m78-neuvetra-functions-first.csv` (SHA-256 `852e0cac517ad092b0535f5562b9075da5c70b3da720f42af07fd31fe14e0a4f`) now confirms all seven are invoker functions, owned by postgres with null function search paths. The six `neuvetra` function ACLs grant execution only to postgres; the public trigger also grants service_role. Definition hashes are recorded in that private metadata receipt. This supports low direct API exposure for these functions but does not prove every indirect invocation safe. CTO received the exact six no-argument signatures and fixed-path proposal for a separately reviewed additive schema21 section.

## Exact Terrascope containment candidate

Root's `.superpowers/m78-terrascope-metadata-first.csv` (SHA-256 `ff737f5659359adf3679b8658e4d5f9cdafb7a2417649e1068b816dae978d498`) contains 52 catalog rows. All five table ACLs are exactly `{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`. No column ACLs or noninternal table triggers appear. Recorded dependents are constraints/defaults/toast/types; that does not exclude dynamic SQL references in function bodies. service_role has BYPASSRLS; anon/authenticated/authenticator do not. Only authenticator holds the three API roles in the scoped membership result.

[Containment candidate](m78-terrascope-containment.sql) locks only those five ordinary tables, validates the observed complete set and exact ACLs, then revokes anon/authenticated table privileges and enables RLS without FORCE or policies. It asserts exact retained postgres/service_role ACLs and privileges plus absent endpoint table/column access. No row-reading or row-writing statement exists. No role, schema, function, sequence, default ACL, extension or Neuvetra object is changed by the explicit SQL. Existing unrestricted anonymous/signed-in Data API behavior intentionally stops; privileged administrator/service behavior remains. This is containment of direct table access, not proof all indirect API routes are secure.

Candidate1's database-name check prevented exact-byte rehearsal in a safely named isolated local database. Candidate2 removes only that check; a database named postgres never established project identity. Independent native review then found candidate2 SQLSTATE55000: the loop record `r` shadowed a SQL table alias before it was assigned. This failed before changes and earlier refusal cases that hit the same defect do not count as successful guard tests. Candidate3 renames the SQL alias and includes the event-hook bound below. Root must independently verify the exact Terrascope dashboard ref before execution. Independent reviewer `/root/m76_backend` reports exact candidate3 accepted: 94 native checks, 18 targeted refusals and 20 actual endpoint-role denials; original synthetic rows, owner/service access and unrelated catalog/role/default/helper/event state were preserved. The [independent review](../../evaluations/research-qa/m78-security-review.md) is the acceptance record. This local result is not a live execution claim.

Root inspected six enabled provider event triggers. Only `extensions.pgrst_ddl_watch()` can match these commands; the other configured command tags/events concern creation or dropping. Its actual invoker body has fixed empty search path, iterates PostgreSQL event-command metadata, and only issues `NOTIFY pgrst,'reload schema'` for its listed commands, including ALTER TABLE. Exact body export: `.superpowers/m78-terrascope-event-hook-first.csv`, SHA-256 `4bd47bdbeeca459262de18db807d408745f025ef41a591284b80122a6ab05785`; PostgreSQL definition MD5 `afaad7193dcf8f81e728d2bedb85e43e`. Candidate3 allows no matching hook (safe local fixture) or this exact notify-only hook; it rejects unknown enabled matching hooks and non-origin replication sessions. It does not disable provider triggers. Exact candidate3 SHA-256: `793a83110db1cf1abe419eab86623e5c032964a94403d1b74cc4535dda2e490d`.

## Current read plan, separately for each exact project

1. Root verifies the selected dashboard/project ref. Record observation time, project ref, advisor finding ID and exact affected schema/relation; read Data API enabled state, exposed schemas and automatic-grant setting. No table editor row view is necessary. Database name `postgres`, a session setting, or a caller-supplied marker alone cannot establish project identity.
2. Use the existing authorized credential channel without exporting or logging its content. Prefer verified TLS with a pinned expected host/project and one connection. Do not create a new role for this inspection. Use `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, short statement/lock/idle timeouts and guaranteed ROLLBACK/close. Only catalog reads and connection-local timeout statements are admitted. Save bounded, dated results to a new private receipt; never overwrite historical evidence.
3. Inspect all `public` ordinary/partitioned tables and exact advisor targets using the queries below. For Neuvetra also read the eight `neuvetra.fugitive_*` tables and runtime-role metadata; rerun **only** `auditLegacyStagingExposure` in this read-only transaction. Its raw metadata can inform both projects, but its Neuvetra-specific reviewed-schema/default-policy acceptance must not be treated as a Terrascope security approval.
4. Capture exact table/column/schema ACL metadata and effective privilege flags for `anon`, `authenticated`, `service_role` and the observed application runtime role. A missing expected role is a finding, not a clean empty result. Include PUBLIC and membership paths using effective privilege functions. Obtain policy names/roles/commands and hashes first; inspect exact predicates and dependent helpers privately for any proposed change. Never execute an application helper merely to inspect it.
5. If exposure remains uncertain, inspect catalog metadata for views, function EXECUTE/security-definer/owner/search-path, triggers (including the Auth profile trigger), schema/default ACLs and role memberships. Keep function bodies, role settings other than the exact `pgrst.db_schemas` key, provider secrets and application rows out of broad reports. Managed-schema changes require their own reviewed scope.
6. Corroborate catalog findings with provider settings. An optional root-run Data API check may request `select=<catalog-observed-column>&limit=0`, no count, using existing approved credentials and only the exact project/table. Do not POST/PATCH/DELETE or invoke RPCs to prove denial. A status/error alone does not prove tenant isolation; do not mint new Auth sessions solely for this metadata inspection.

### Fixed catalog queries

Run inside the read-only transaction. For each project start with `public`; add only the exact advisor schema and, on Neuvetra, `neuvetra`. Names returned here are metadata, not row contents. No `pg_authid`, `pg_stat_activity`, user-table count, row hash or backup is needed for this initial diagnosis.

```sql
SELECT current_database() AS database, current_user AS role,
       current_setting('transaction_read_only') AS read_only,
       current_setting('server_version_num') AS server_version_num,
       (SELECT ssl FROM pg_catalog.pg_stat_ssl
        WHERE pid=pg_backend_pid()) AS backend_tls;

SELECT n.nspname AS schema, c.relname AS relation, c.relkind,
       pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       c.relacl::text AS table_acl, n.nspacl::text AS schema_acl,
       e.extname AS owning_extension
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_class'::regclass
  AND d.objid=c.oid AND d.objsubid=0 AND d.deptype='e'
  AND d.refclassid='pg_catalog.pg_extension'::regclass
LEFT JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
ORDER BY 1,2;

SELECT n.nspname AS schema, c.relname AS relation, r.rolname AS role,
       has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
       has_schema_privilege(r.oid,n.oid,'CREATE') AS schema_create,
       has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
       has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
       has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
       has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
       has_table_privilege(r.oid,c.oid,'TRUNCATE') AS can_truncate,
       has_table_privilege(r.oid,c.oid,'REFERENCES') AS can_reference,
       has_table_privilege(r.oid,c.oid,'TRIGGER') AS can_trigger,
       has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
         AS any_column_access
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_catalog.pg_roles r
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
  AND r.rolname IN ('anon','authenticated','service_role','neuvetra_runtime')
ORDER BY 1,2,3;
```

On PostgreSQL 17 or newer also select `has_table_privilege(r.oid,c.oid,'MAINTAIN')`; do not issue that privilege name on older versions. The existing audit implements this version boundary. For column ACLs, query `pg_attribute.attacl` on the same relation OIDs where `attnum>0 AND NOT attisdropped AND attacl IS NOT NULL`. Capture policies using `pg_policy` with table OID, policy name, command, permissive flag, role OIDs and hashes of `pg_get_expr(polqual,polrelid)`/`pg_get_expr(polwithcheck,polrelid)`; a hash is a drift marker, not a policy correctness finding. Missing policies are material when RLS is enabled and non-owner access is intended.

For exact Data API role/database override metadata, the existing allowlisted `SETTINGS_QUERY` at `tools/cloud/data-api-exposure.ts:9` extracts only `pgrst.db_schemas`, rather than dumping all role settings. Absence of that override does not prove the API is disabled; dashboard/environment defaults remain separate evidence.

### Reuse boundaries for existing tooling

- `tools/cloud/database-inventory.ts:60`–`:93`, `:137` onward provide target/TLS guards, bounded diagnostics, READ ONLY and guaranteed rollback/connection cleanup. Its hard-coded target is Neuvetra and its historical schema list omits `neuvetra`; do not use its unmodified output as a schema20 audit or silently repoint it to Terrascope.
- `packages/neuvetra-database/src/staging-audit.ts:28` is the reusable catalog reader. Its `planLegacyStagingContainment` sibling is a mutation planner; no execution is authorized by merely importing the audit.
- `tools/staging/check-containment.ts` executes proposed revocations inside a rollback rehearsal. It is **not** a read-only observer and must not be run for this diagnosis.
- `tools/cloud/data-api-exposure.ts` includes ALTER ROLE operations. Reuse only the reviewed metadata query/probe design; do not call `changeExposure` or `runExposure`.
- Row-manifest/backup/replay tools read application contents even if their output is hashes. They are outside this initial catalog-only step.

## Remediation decision boundaries

| Fresh result | Next action |
| --- | --- |
| RLS disabled, but API-role schema/object/column/function paths remain denied | Record contained API access and outstanding RLS defense in depth separately. Prepare exact-table enable-RLS proposal only after ownership, existing policies, trigger/helper dependencies and actual runtime roles are checked. Advisor clearance still requires fresh advisor evidence. |
| RLS disabled with a reachable grant path | Treat as a concrete access-configuration defect. Identify exact role/path and smallest containment change; preserve original ACL/ownership/policy metadata and application compatibility. Do not read rows to establish their existence or exploit the path. |
| Provider/extension-owned table | Retain provider ownership and extension state; assess exposed grants and provider-supported action. Never force ownership changes, drop extensions or blanket-enable RLS merely to clear a warning. |
| Tables already have RLS enabled or alert names no longer present | Record dated/current divergence; refresh the advisor and investigate identity/refresh timing before claiming resolution. Do not delete residual objects. |
| Metadata/identity unavailable on either project | Record exact missing access and continue offline assessment. Do not transfer Neuvetra conclusions to Terrascope. |

A future fix must name each table and intended role behavior; use transactional, drift-checked changes with exact before-state restoration and independent review. Preserve every row and runtime grant unless a specifically justified access change is approved within root's authority. Enabling RLS does not delete rows, but can deny a non-owner backend; FORCE RLS can also affect owners, while privileged bypass paths remain separate. Do not add permissive `USING (true)` policies to mask a compatibility failure. Do not blanket-enable all schemas, disable the project's API, revoke all roles, replay M63 containment or delete the retired project from this alert alone.

Before any live fix, root must bind the reviewed candidate to fresh metadata and verify dependencies using appropriate synthetic/local checks. Afterward, compare table/column ACLs, roles/memberships, triggers and unaffected policies, rerun the relevant containment/runtime readiness checks and refresh the advisor. A fix touching `neuvetra` would also alter migration/catalog expectations and requires the product release path; no ad hoc schema20 edits are proposed.

## Handoff and verification

Author checks performed: read the current coordination records and relevant security code; inspected source RLS/grant/readiness conditions; checked primary Supabase advisory/API-control documentation; inspected root's saved catalog CSVs. SQL above is a proposed catalog query plan; root's actually executed queries and advisor observations are separately identified. This author made no hosted requests or changes. Exact containment SQL has independent acceptance as described above; final assessment wording is also routed to that reviewer.

Applicable lessons: L05 preserves the login/access limitation without substituting an unauthorized credential path; L02 requires exact reviewed artifact bytes when root freezes/publicizes this assessment. No product/UI actor-transition behavior changed, so L01 is outside this report's execution scope.

Next owner: root finishes recording the fresh advisor result and publication; the independent reviewer assesses actual execution evidence separately from local SQL acceptance. Do not rerun committed candidate3. Preserve the narrower current Neuvetra disposition (dated critical not reproduced; eight warnings remain). Continue independent Scope 1 planning in parallel. A later request for accounting compatibility review is a separate assignment.
