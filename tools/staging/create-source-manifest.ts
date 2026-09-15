/** Explicit read-only source manifest. Imports never read an export, connect, or write a file. */
import { open, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { extractDatabaseUrl, connectionOptions, certificateAuthority, installedDriver, initializeClient, PROJECT_REF, type InventoryClient } from "../cloud/database-inventory"

/** Matches qa-cloud-verify.ts exactly: JSON keys sorted recursively; array order retained. */
export function canonicalManifestJson(value: unknown): string {
  if(value===null || typeof value!=="object") return JSON.stringify(value)
  if(Array.isArray(value)) return `[${value.map(canonicalManifestJson).join(",")}]`
  const object=value as Record<string,unknown>
  return `{${Object.keys(object).sort().map(key=>JSON.stringify(key)+":"+canonicalManifestJson(object[key])).join(",")}}`
}
export function hashManifestValue(value: unknown): string {
  return new Bun.CryptoHasher("sha256").update(canonicalManifestJson(value)).digest("hex")
}

// Keep SQL, aliases and ordering identical to the independent restore verifier.
export const SOURCE_METADATA_QUERIES = {
  tables:`select c.relname,pg_get_userbyid(c.relowner) owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' order by c.relname`,
  policies:`select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='neuvetra' order by tablename,policyname`,
  functions:`select p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,p.proacl::text,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' order by signature`,
  schema:`select nspname,pg_get_userbyid(nspowner) owner,nspacl::text from pg_namespace where nspname='neuvetra'`,
} as const
export const SOURCE_TABLE_NAMES_QUERY = `select c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' order by c.relname`

const ROLE_FLAGS_QUERY = `with owned_schema as (select oid,nspowner,nspacl from pg_namespace where nspname='neuvetra'),
  referenced_roles as (
    select oid from pg_roles where rolname in('postgres','neuvetra_runtime')
    union select nspowner from owned_schema
    union select c.relowner from pg_class c join owned_schema n on n.oid=c.relnamespace
    union select p.proowner from pg_proc p join owned_schema n on n.oid=p.pronamespace
    union select a.grantee from owned_schema n cross join lateral aclexplode(n.nspacl) a
    union select a.grantor from owned_schema n cross join lateral aclexplode(n.nspacl) a
    union select d.defaclrole from pg_default_acl d where d.defaclnamespace=0 or d.defaclnamespace in(select oid from owned_schema)
    union select a.grantee from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where d.defaclnamespace=0 or d.defaclnamespace in(select oid from owned_schema)
    union select a.grantor from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where d.defaclnamespace=0 or d.defaclnamespace in(select oid from owned_schema)
    union select a.grantee from pg_class c join owned_schema n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl) a
    union select a.grantor from pg_class c join owned_schema n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl) a
    union select a.grantee from pg_proc p join owned_schema n on n.oid=p.pronamespace cross join lateral aclexplode(p.proacl) a
    union select a.grantor from pg_proc p join owned_schema n on n.oid=p.pronamespace cross join lateral aclexplode(p.proacl) a
  ) select rolname,rolsuper,rolbypassrls,rolinherit,rolcanlogin,rolcreatedb,rolcreaterole,rolreplication
  from pg_roles where oid in(select oid from referenced_roles) order by rolname`

interface SourceSession {
  read_only:string; isolation:string; timezone:string; operator_superuser:boolean; operator_bypass_rls:boolean;
  database:string; database_role:string; server_version:string; snapshot_at:string; transaction_snapshot:string;
}
export interface SourceRoleFlags {
  rolname:string;rolsuper:boolean;rolbypassrls:boolean;rolinherit:boolean;rolcanlogin:boolean;
  rolcreatedb:boolean;rolcreaterole:boolean;rolreplication:boolean;
}
export interface SourceManifest {
  tables:Array<{name:string;count:number;sha256:string}>
  metadata:Record<keyof typeof SOURCE_METADATA_QUERIES,{sha256:string}>
  roles:SourceRoleFlags[]
  snapshot:SourceSession
}

/** One repeatable-read snapshot. Raw JSON rows/definitions exist only transiently in process memory. */
export async function collectSourceManifest(client:InventoryClient):Promise<SourceManifest> {
  const connection=await client.reserve()
  let begun=false
  try {
    await connection.unsafe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    begun=true
    await connection.unsafe("SET LOCAL timezone = 'UTC'")
    await connection.unsafe("SET LOCAL statement_timeout = '10s'")
    await connection.unsafe("SET LOCAL lock_timeout = '2s'")
    await connection.unsafe("SET LOCAL idle_in_transaction_session_timeout = '30s'")
    // Fail instead of silently hashing an RLS-filtered subset if the operator is misconfigured.
    await connection.unsafe("SET LOCAL row_security = off")
    const sessions=await connection.unsafe(`select current_setting('transaction_read_only') read_only,current_setting('transaction_isolation') isolation,
      current_setting('TimeZone') timezone,r.rolsuper operator_superuser,r.rolbypassrls operator_bypass_rls,current_database() database,
      current_user database_role,current_setting('server_version') server_version,transaction_timestamp()::text snapshot_at,
      txid_current_snapshot()::text transaction_snapshot from pg_roles r where r.rolname=current_user`) as SourceSession[]
    const snapshot=sessions[0]
    if(sessions.length!==1 || !snapshot || snapshot.read_only!=="on" || snapshot.isolation!=="repeatable read" || snapshot.timezone!=="UTC" || (!snapshot.operator_superuser&&!snapshot.operator_bypass_rls)) throw new Error("source_snapshot_refused")
    const names=await connection.unsafe(SOURCE_TABLE_NAMES_QUERY) as Array<{name:string}>
    if(!names.length || names.some(row=>typeof row.name!=="string"||!/^[a-z_]+$/.test(row.name)) || new Set(names.map(row=>row.name)).size!==names.length) throw new Error("source_schema_refused")
    const tables:SourceManifest["tables"]=[]
    for(const {name} of names){
      // Identifier is catalog-derived and strictly validated above, never supplied by the caller.
      const rows=(await connection.unsafe(`select to_jsonb(t) value from neuvetra.${name} t`) as Array<{value:unknown}>).map(row=>row.value)
        .sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)))
      tables.push({name,count:rows.length,sha256:hashManifestValue(rows)})
    }
    const metadata={} as SourceManifest["metadata"]
    for(const [key,sql] of Object.entries(SOURCE_METADATA_QUERIES)) metadata[key as keyof typeof metadata]={sha256:hashManifestValue(await connection.unsafe(sql))}
    const roles=await connection.unsafe(ROLE_FLAGS_QUERY) as SourceRoleFlags[]
    if(!roles.some(role=>role.rolname==="postgres") || !roles.some(role=>role.rolname==="neuvetra_runtime")) throw new Error("source_roles_missing")
    return {tables,metadata,roles,snapshot}
  } finally {
    if(begun) { try { await connection.unsafe("ROLLBACK") } catch { /* Caller closes the client; no raw error output. */ } }
    try { await connection.release() } catch { /* Caller closes the client. */ }
  }
}

async function main():Promise<void> {
  let client:InventoryClient|undefined
  let output:Awaited<ReturnType<typeof open>>|undefined
  try {
    const [source,target,...extra]=process.argv.slice(2)
    if(!source||!target||extra.length||resolve(source)===resolve(target)) throw new Error("explicit_distinct_paths_required")
    const authority=certificateAuthority(await readFile(fileURLToPath(new URL("../cloud/fixtures/supabase-prod-ca-2021.crt",import.meta.url))))
    const options=connectionOptions(extractDatabaseUrl(await readFile(source,"utf8")),authority)
    // Atomic exclusive creation prevents a check/write race or overwriting an existing artifact.
    output=await open(target,"wx",0o600)
    client=initializeClient(installedDriver(),options)
    const manifest=await collectSourceManifest(client)
    await output.writeFile(JSON.stringify({
      profile:"neuvetra.cloud-source-manifest.v1",project_ref:PROJECT_REF,
      scope:"neuvetra regular-table row hashes and catalog metadata hashes; no raw application rows or Auth contents persisted",
      canonicalization:"qa-cloud-verify canonical JSON; recursive sorted keys; canonical row strings sorted with localeCompare; UTC to_jsonb",
      client_tls:"hostname and configured CA verified; pooler backend transport is a separate observation",ca_sha256:authority.sha256,
      ...manifest,
    },null,2)+"\n","utf8")
    await output.sync()
    console.log(JSON.stringify({status:"source_manifest_created",tables:manifest.tables.length,records:manifest.tables.reduce((sum,table)=>sum+table.count,0)}))
  } catch { console.error(JSON.stringify({status:"source_manifest_unavailable"}));process.exitCode=1 }
  finally {
    try { await output?.close() } catch { /* Sanitize close failures. */ }
    try { await client?.end({timeout:3}) } catch { /* Never emit credential-bearing driver diagnostics. */ }
  }
}

if(import.meta.main) await main()
