import type { WorkspaceSql } from "./workspace"

export const EXISTING_PROJECT_REF = "icockcoguyadhryzydvl"
// Exact provider namespaces only. Unknown and newly created schemas are applications by default.
export const SUPABASE_MANAGED_SCHEMAS = [
  "auth", "storage", "realtime", "extensions", "graphql", "graphql_public", "supabase_functions",
  "supabase_migrations", "vault", "net", "cron", "pgbouncer", "pgsodium", "pgsodium_masks",
] as const
export const REVIEWED_APPLICATION_SCHEMAS = ["public","frontdesk","site","terrascope","neuvetra_research_dev","neuvetra","drizzle"] as const
interface DefaultGrant { schema_name:string|null;owner:string;object_type:string;role:string;privilege:string }
const isContainedProviderDefault = (row:DefaultGrant) => row.owner==="supabase_admin" && row.schema_name==="public" && ["r","f","S"].includes(row.object_type)
// 0027's Storage RLS policies call these two security-definer guards. Their
// EXECUTE grant is deliberately PUBLIC so the restrictive policies can run for
// every Storage role. The separate schema-usage check must still deny direct
// access to neuvetra for anon and authenticated, and all other functions block.
const reviewedStoragePolicyGuards = new Set([
  "neuvetra.collection_storage_can_read(text,text)",
  "neuvetra.collection_storage_can_upload(text,text)",
])
const isReviewedStoragePolicyGuard = (row:LegacyExposureAudit["callableFunctions"][number]) =>
  row.schema_name === "neuvetra" && row.security_definer && reviewedStoragePolicyGuards.has(row.signature)
interface SchemaInventory { schema_name: string; owner: string }
export interface LegacyExposureAudit {
  legacyContainmentVerified: boolean
  scope: "all-application-schemas"
  applicationSchemas: string[]
  unreviewedApplicationSchemas: string[]
  providerDefaultPolicy: "supabase-admin-public-defaults-behind-denied-schema-v1"
  deferredProviderDefaultGrants: DefaultGrant[]
  blockingDefaultGrants: DefaultGrant[]
  managedSchemas: Array<SchemaInventory & { assessment: "provider-managed-separate-review-required" }>
  endpointRolesPresent: boolean
  databaseCreate: Array<{ role: string; allowed: boolean }>
  schemaUsage: Array<{ schema_name: string; role: string; allowed: boolean; create_allowed: boolean }>
  tableGrants: Array<{ schema_name: string; role: string; table_name: string; privilege: string; rls: boolean }>
  columnGrants: Array<{ schema_name: string; role: string; table_name: string; column_name: string; privilege: string }>
  sequenceGrants: Array<{ schema_name: string; role: string; sequence_name: string; privilege: string }>
  callableFunctions: Array<{ schema_name: string; role: string; signature: string; security_definer: boolean }>
  defaultGrants: DefaultGrant[]
}

/** Catalog only. Effective privileges include PUBLIC and inherited roles; no application rows are read. */
export async function auditLegacyStagingExposure(db: WorkspaceSql): Promise<LegacyExposureAudit> {
  const inventory = await db.query<SchemaInventory>("select nspname schema_name,pg_get_userbyid(nspowner) owner from pg_namespace where nspname !~ '^pg_' and nspname <> 'information_schema' order by nspname")
  const managed = new Set<string>(SUPABASE_MANAGED_SCHEMAS)
  const applicationSchemas = inventory.rows.filter(row => !managed.has(row.schema_name)).map(row => row.schema_name)
  const reviewed = new Set<string>(REVIEWED_APPLICATION_SCHEMAS)
  const unreviewedApplicationSchemas = applicationSchemas.filter(schema => !reviewed.has(schema))
  const managedSchemas = inventory.rows.filter(row => managed.has(row.schema_name)).map(row => ({...row,assessment:"provider-managed-separate-review-required" as const}))
  const roles = await db.query<{ role: string; allowed: boolean }>("select rolname role,has_database_privilege(rolname,current_database(),'CREATE') allowed from pg_roles where rolname in ('anon','authenticated') order by rolname")
  const schemas = await db.query<LegacyExposureAudit["schemaUsage"][number]>(`select n.nspname schema_name,r.rolname role,
    has_schema_privilege(r.oid,n.oid,'USAGE') allowed,has_schema_privilege(r.oid,n.oid,'CREATE') create_allowed
    from pg_namespace n cross join pg_roles r where n.nspname=any($1::text[]) and r.rolname in('anon','authenticated') order by n.nspname,r.rolname`,[applicationSchemas])
  const tables = await db.query<LegacyExposureAudit["tableGrants"][number]>(`select n.nspname schema_name,r.rolname role,c.relname table_name,p.privilege,c.relrowsecurity rls
    from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r
    cross join (select column1 privilege from (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) q union all select 'MAINTAIN' where current_setting('server_version_num')::integer>=170000) p
    where n.nspname=any($1::text[]) and c.relkind in ('r','p','v','m','f') and r.rolname in ('anon','authenticated')
    and has_table_privilege(r.oid,c.oid,p.privilege) order by n.nspname,r.rolname,c.relname,p.privilege`,[applicationSchemas])
  const columns = await db.query<LegacyExposureAudit["columnGrants"][number]>(`select n.nspname schema_name,r.rolname role,c.relname table_name,a.attname column_name,p.privilege
    from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid cross join pg_roles r
    cross join (values('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) p(privilege)
    where n.nspname=any($1::text[]) and c.relkind in('r','p','v','m','f') and a.attnum>0 and not a.attisdropped and a.attacl is not null
    and r.rolname in('anon','authenticated') and has_column_privilege(r.oid,c.oid,a.attnum,p.privilege)
    order by n.nspname,c.relname,a.attname,r.rolname,p.privilege`,[applicationSchemas])
  const sequences = await db.query<LegacyExposureAudit["sequenceGrants"][number]>(`select n.nspname schema_name,r.rolname role,c.relname sequence_name,p.privilege
    from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r cross join(values('USAGE'),('SELECT'),('UPDATE')) p(privilege)
    where n.nspname=any($1::text[]) and c.relkind='S' and r.rolname in('anon','authenticated') and has_sequence_privilege(r.oid,c.oid,p.privilege)
    order by n.nspname,c.relname,r.rolname,p.privilege`,[applicationSchemas])
  const functions = await db.query<LegacyExposureAudit["callableFunctions"][number]>(`select n.nspname schema_name,r.rolname role,p.oid::regprocedure::text signature,p.prosecdef security_definer
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join pg_roles r
    where n.nspname=any($1::text[]) and r.rolname in ('anon','authenticated') and has_function_privilege(r.oid,p.oid,'EXECUTE') order by n.nspname,role,signature`,[applicationSchemas])
  const blockingCallableFunctions = functions.rows.filter(row => !isReviewedStoragePolicyGuard(row))
  const defaults = await db.query<LegacyExposureAudit["defaultGrants"][number]>(`select n.nspname schema_name,pg_get_userbyid(d.defaclrole) owner,d.defaclobjtype::text object_type,
    case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end role,a.privilege_type privilege
    from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl) a
    where (d.defaclnamespace=0 or n.nspname=any($1::text[]))
    and (a.grantee=0 or exists(select 1 from pg_roles r where r.rolname in('anon','authenticated') and pg_has_role(r.oid,a.grantee,'USAGE')))
    order by n.nspname,owner,object_type,role,privilege`,[applicationSchemas])
  const deferredProviderDefaultGrants=defaults.rows.filter(isContainedProviderDefault)
  const blockingDefaultGrants=defaults.rows.filter(row=>!isContainedProviderDefault(row))
  return {
    legacyContainmentVerified: unreviewedApplicationSchemas.length===0 && roles.rows.length===2 && roles.rows.every(r=>!r.allowed) && schemas.rows.every(r=>!r.allowed&&!r.create_allowed)
      && tables.rows.length===0 && columns.rows.length===0 && sequences.rows.length===0 && blockingCallableFunctions.length===0 && blockingDefaultGrants.length===0,
    scope:"all-application-schemas",applicationSchemas,unreviewedApplicationSchemas,managedSchemas,
    providerDefaultPolicy:"supabase-admin-public-defaults-behind-denied-schema-v1",deferredProviderDefaultGrants,blockingDefaultGrants,endpointRolesPresent:roles.rows.length===2,
    databaseCreate:roles.rows,schemaUsage:schemas.rows,tableGrants:tables.rows,columnGrants:columns.rows,sequenceGrants:sequences.rows,
    callableFunctions:functions.rows,defaultGrants:defaults.rows,
  }
}

/** Reviewable application containment only. Never modifies provider-managed schemas automatically. */
export async function planLegacyStagingContainment(db: WorkspaceSql): Promise<{ audit: LegacyExposureAudit; statements: string[]; globalDefaultPrivilegeOwners: string[]; providerAdminStatements: string[]; deferredProviderDefaultGrants: DefaultGrant[] }> {
  const audit = await auditLegacyStagingExposure(db)
  const quote = (value: string) => `"${value.replaceAll('"','""')}"`
  const current = await db.query<{ name:string }>("select current_database() name")
  if (!current.rows[0]) throw new Error("Database catalog unavailable.")
  const kind:Record<string,string>={r:"TABLES",S:"SEQUENCES",f:"FUNCTIONS",T:"TYPES",n:"SCHEMAS"}
  const statements=[`REVOKE CREATE ON DATABASE ${quote(current.rows[0].name)} FROM PUBLIC, anon, authenticated;`]
  for(const schema of audit.applicationSchemas){
    statements.push(`REVOKE ALL ON SCHEMA ${quote(schema)} FROM PUBLIC, anon, authenticated;`,
      `REVOKE ALL ON ALL TABLES IN SCHEMA ${quote(schema)} FROM PUBLIC, anon, authenticated;`,
      `REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${quote(schema)} FROM PUBLIC, anon, authenticated;`,
      `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${quote(schema)} FROM PUBLIC, anon, authenticated;`)
  }
  // Table-level REVOKE does not clear column-level grants. Include every observed column privilege.
  for(const row of audit.columnGrants) statements.push(`REVOKE ${row.privilege} (${quote(row.column_name)}) ON TABLE ${quote(row.schema_name)}.${quote(row.table_name)} FROM PUBLIC, anon, authenticated;`)
  const providerAdminStatements:string[]=[]
  for(const row of audit.defaultGrants){
    if(!kind[row.object_type]) throw new Error("Unknown default privilege object type requires review.")
    const target=isContainedProviderDefault(row)?providerAdminStatements:statements
    target.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(row.owner)}${row.schema_name?` IN SCHEMA ${quote(row.schema_name)}`:""} REVOKE ALL ON ${kind[row.object_type]} FROM PUBLIC, anon, authenticated;`)
  }
  return {audit,statements:[...new Set(statements)],providerAdminStatements:[...new Set(providerAdminStatements)],deferredProviderDefaultGrants:audit.deferredProviderDefaultGrants,globalDefaultPrivilegeOwners:[...new Set(audit.defaultGrants.filter(row=>row.schema_name===null).map(row=>row.owner))].sort()}
}
