/** Operator helpers only. No connection, secrets, or writes occur on import. */
import {open} from 'node:fs/promises'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {loadStagingDatabaseCa} from '../../packages/neuvetra-database/src/staging-tls'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {SOURCE_METADATA_QUERIES,canonicalManifestJson,hashManifestValue} from './create-source-manifest'

export const PROJECT='icockcoguyadhryzydvl'
export const BASELINE_MANIFEST_SHA256='476fae6510167b9c30063bf442d8cd10a2def42ea2ed5d84fa23369aeada1634'
// Coordinator-supplied author candidate. Hosted execution separately requires an independent exact-byte gate.
export const MIGRATION='aa4968c63087f353b5bf80d64bced67270bc5ad17f715393b40313bb57f7f732'
export const MIGRATION_NAME='0016_stationary_natural_gas.sql'
export const NEW_TABLES=['stationary_gas_audit','stationary_gas_heads','stationary_gas_reports','stationary_gas_requests','stationary_gas_reviews','stationary_gas_statements','stationary_gas_versions'] as const
export const sha=(bytes:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
export function requireValue(value:unknown):asserts value {if(!value)throw Error('M73 gate refused')}
export async function exclusiveJson(path:string,value:unknown){const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value,null,2)+'\n');await f.sync()}finally{await f.close()}}
export function operatorUrl(value:string){const u=new URL(value);requireValue(['postgres:','postgresql:'].includes(u.protocol)&&u.hostname==='aws-1-us-west-1.pooler.supabase.com'&&u.port==='5432'&&decodeURIComponent(u.username)==='postgres.'+PROJECT&&u.pathname==='/postgres'&&u.password&&!u.hash);u.search='';return u}
export async function connectOperator(value:string){const u=operatorUrl(value);return createPostgresConnection(u.toString(),{maxConnections:1,tlsCaPem:await loadStagingDatabaseCa({caFile:'tools/cloud/fixtures/supabase-prod-ca-2021.crt'})})}
export function connectLocal(name:string,port=55463){requireValue(/^m73_(ops|qa|security)_[a-z0-9_]+$/.test(name)&&[55463,55472].includes(port));return createPostgresConnection(`postgres://${port===55472?'supabase_admin':'m63_test_admin'}@127.0.0.1:${port}/`+name,{maxConnections:1,tls:false})}
export async function canonicalReceipts(tx:WorkspaceSql,version:15|16){
 const manifest=await readMigrationManifest()
 requireValue((manifest.length===15||manifest.length===16)&&hashManifestValue(manifest.slice(0,15).map(({name,sha256})=>({name,sha256})))===BASELINE_MANIFEST_SHA256)
 if(version===16)requireValue(/^[a-f0-9]{64}$/.test(MIGRATION)&&manifest.length===16&&manifest[15]?.name===MIGRATION_NAME&&manifest[15]?.sha256===MIGRATION)
 const receipts=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
 requireValue(receipts.length===version&&receipts.every((r,i)=>r.name===manifest[i]?.name&&r.sha256===manifest[i]?.sha256))
 const target=(await tx.query<{project_ref:string;profile:string}>('select project_ref,profile from neuvetra.staging_target')).rows
 requireValue(target.length===1&&target[0]?.project_ref===PROJECT&&target[0]?.profile==='neuvetra.private-synthetic-staging.v1')
 return manifest
}
export const ROLE_SQL="select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles where rolname !~ '^pg_' order by rolname"
export const MEMBERS_SQL="select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option from pg_auth_members order by 1,2,3"
export const DEFAULT_SQL="select pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'*') schema,d.defaclobjtype kind,d.defaclacl::text acl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace order by 1,2,3"
// Compare effective ACL semantics: pg_restore may encode explicit owner-only ACLs as NULL defaults.
const effectiveAcl=(column:string,owner:string,kind:string)=>`(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) from aclexplode(coalesce(${column},acldefault('${kind}',${owner}))) a)`
const CATALOG_QUERIES={...SOURCE_METADATA_QUERIES,
 tables:`select c.relname,pg_get_userbyid(c.relowner) owner,c.relrowsecurity,c.relforcerowsecurity,${effectiveAcl('c.relacl','c.relowner','r')} acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' order by c.relname`,
 functions:`select p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,${effectiveAcl('p.proacl','p.proowner','f')} acl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' order by signature`,
 schema:`select nspname,pg_get_userbyid(nspowner) owner,${effectiveAcl('nspacl','nspowner','n')} acl from pg_namespace where nspname='neuvetra'`
}
export async function inventory(tx:WorkspaceSql){
 const privilege=(await tx.query<{safe:boolean}>("select (rolsuper or rolbypassrls) safe from pg_roles where rolname=current_user")).rows;requireValue(privilege[0]?.safe===true)
 const tables=(await tx.query<{name:string}>("select c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' order by 1")).rows
 requireValue(tables.length>0&&tables.every(t=>/^[a-z_]+$/.test(t.name)))
 const rows=[]
 for(const {name}of tables){const values=(await tx.query<{value:unknown}>(`select to_jsonb(t) value from neuvetra.${name} t`)).rows.map(r=>r.value).sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)));rows.push({name,count:values.length,sha256:hashManifestValue(values),rowHashes:values.map(hashManifestValue).sort()})}
 const metadata:Record<string,string>={},catalogRowHashes:Record<string,string[]>={}
 for(const [key,sql]of Object.entries({...CATALOG_QUERIES,
  constraints:"select c.relname table_name,k.conname,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' order by 1,2",
  indexes:"select tablename,indexname,indexdef from pg_indexes where schemaname='neuvetra' order by 1,2",
  triggers:"select c.relname table_name,t.tgname,pg_get_triggerdef(t.oid) definition,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and not t.tgisinternal order by 1,2",
  columns:"select table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_schema,udt_name,character_maximum_length,numeric_precision,numeric_scale,is_identity,is_generated,generation_expression,collation_name from information_schema.columns where table_schema='neuvetra' order by table_name,ordinal_position"
 })){
  const values=(await tx.query(sql)).rows;metadata[key]=hashManifestValue(values);catalogRowHashes[key]=values.map(hashManifestValue).sort()
 }
 const roles=(await tx.query(ROLE_SQL)).rows,memberships=(await tx.query(MEMBERS_SQL)).rows,defaultAcls=(await tx.query(DEFAULT_SQL)).rows
 const dependencies=(await tx.query("select distinct rn.nspname schema,rc.relname relation from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_class rc on rc.oid=k.confrelid join pg_namespace rn on rn.oid=rc.relnamespace where n.nspname='neuvetra' and rn.nspname<>'neuvetra' order by 1,2")).rows
 return {tables:rows,metadata,catalogRowHashes,roles,memberships,defaultAcls,dependencies}
}
export type Inventory=Awaited<ReturnType<typeof inventory>>
export async function runtimeSafe(tx:WorkspaceSql){const row=(await tx.query<{safe:boolean}>(`select not r.rolsuper and not r.rolbypassrls and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and not r.rolinherit and not exists(select 1 from pg_auth_members where member=r.oid) and not exists(select 1 from pg_namespace where nspname='neuvetra' and nspowner=r.oid) and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and p.proowner=r.oid) and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and (c.relowner=r.oid or(c.relkind='r' and(not c.relrowsecurity or not c.relforcerowsecurity)))) and not has_schema_privilege(r.rolname,'neuvetra','CREATE') and not has_schema_privilege(r.rolname,'public','CREATE') and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind in('r','p','v','m','f') and has_table_privilege(r.rolname,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) safe from pg_roles r where rolname='neuvetra_runtime'`)).rows;requireValue(row[0]?.safe===true)}
export function sameRows(before:Inventory,after:Inventory,allowAppend=false){for(const old of before.tables){const now=after.tables.find(t=>t.name===old.name);requireValue(now);if(!allowAppend)requireValue(old.sha256===now.sha256&&old.count===now.count);else{const remaining=[...now.rowHashes];for(const hash of old.rowHashes){const index=remaining.indexOf(hash);requireValue(index>=0);remaining.splice(index,1)}}}}
export async function lockedTables(tx:WorkspaceSql){const names=(await tx.query<{name:string}>("select tablename name from pg_tables where schemaname='neuvetra' order by tablename")).rows;requireValue(names.length&&names.every(t=>/^[a-z_]+$/.test(t.name)));await tx.exec('lock table '+names.map(t=>'neuvetra.'+t.name).join(',')+' in share mode')}

export function sameCatalog(before:Inventory,after:Inventory,allowAppend=false){
 requireValue(hashManifestValue(Object.keys(before.catalogRowHashes).sort())===hashManifestValue(Object.keys(after.catalogRowHashes).sort()))
 for(const [key,old] of Object.entries(before.catalogRowHashes)){
  const now=after.catalogRowHashes[key]!;if(!allowAppend){requireValue(hashManifestValue(old)===hashManifestValue(now));continue}
  const remaining=[...now];for(const h of old){const i=remaining.indexOf(h);requireValue(i>=0);remaining.splice(i,1)}
 }
}
