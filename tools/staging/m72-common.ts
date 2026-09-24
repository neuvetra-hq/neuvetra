/** Operator helpers only. No connection, secrets, or writes occur on import. */
import {open} from 'node:fs/promises'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {loadStagingDatabaseCa} from '../../packages/neuvetra-database/src/staging-tls'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {SOURCE_METADATA_QUERIES,canonicalManifestJson,hashManifestValue} from './create-source-manifest'

export const PROJECT='icockcoguyadhryzydvl'
export const MIGRATION='2766561decde3ea64bf56f30b1b67a9144318e14b6efecaa71e05e8ae6351d19'
export const sha=(bytes:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
export function requireValue(value:unknown):asserts value {if(!value)throw Error('M72 gate refused')}
export async function exclusiveJson(path:string,value:unknown){const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value,null,2)+'\n');await f.sync()}finally{await f.close()}}
export function operatorUrl(value:string){const u=new URL(value);requireValue(['postgres:','postgresql:'].includes(u.protocol)&&u.hostname==='aws-1-us-west-1.pooler.supabase.com'&&u.port==='5432'&&decodeURIComponent(u.username)==='postgres.'+PROJECT&&u.pathname==='/postgres'&&u.password&&!u.hash);u.search='';return u}
export async function connectOperator(value:string){const u=operatorUrl(value);return createPostgresConnection(u.toString(),{maxConnections:1,tlsCaPem:await loadStagingDatabaseCa({caFile:'tools/cloud/fixtures/supabase-prod-ca-2021.crt'})})}
export function connectLocal(name:string,port=55463){requireValue(/^m72_(ops|qa|security)_[a-z0-9_]+$/.test(name)&&[55463,55472].includes(port));return createPostgresConnection(`postgres://${port===55472?'supabase_admin':'m63_test_admin'}@127.0.0.1:${port}/`+name,{maxConnections:1,tls:false})}
export async function canonicalReceipts(tx:WorkspaceSql,version:number){const manifest=await readMigrationManifest();requireValue(manifest.length===15&&manifest[14]?.sha256===MIGRATION);const receipts=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows;requireValue(receipts.length===version&&receipts.every((r,i)=>r.name===manifest[i]?.name&&r.sha256===manifest[i]?.sha256));const target=(await tx.query<{project_ref:string;profile:string}>('select project_ref,profile from neuvetra.staging_target')).rows;requireValue(target.length===1&&target[0]?.project_ref===PROJECT&&target[0]?.profile==='neuvetra.private-synthetic-staging.v1');return manifest}
export const ROLE_SQL="select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles where rolname !~ '^pg_' order by rolname"
export const MEMBERS_SQL="select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option from pg_auth_members order by 1,2,3"
export const DEFAULT_SQL="select pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'*') schema,d.defaclobjtype kind,d.defaclacl::text acl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace order by 1,2,3"
export async function inventory(tx:WorkspaceSql){
 const privilege=(await tx.query<{safe:boolean}>("select (rolsuper or rolbypassrls) safe from pg_roles where rolname=current_user")).rows;requireValue(privilege[0]?.safe===true)
 const tables=(await tx.query<{name:string}>("select c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' order by 1")).rows
 requireValue(tables.length>0&&tables.every(t=>/^[a-z_]+$/.test(t.name)))
 const rows=[]
 for(const {name}of tables){const values=(await tx.query<{value:unknown}>(`select to_jsonb(t) value from neuvetra.${name} t`)).rows.map(r=>r.value).sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)));rows.push({name,count:values.length,sha256:hashManifestValue(values),rowHashes:values.map(hashManifestValue).sort()})}
 const metadata:Record<string,string>={}
 for(const [key,sql]of Object.entries(SOURCE_METADATA_QUERIES))metadata[key]=hashManifestValue((await tx.query(sql)).rows)
 metadata.constraints=hashManifestValue((await tx.query("select c.relname table_name,k.conname,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' order by 1,2")).rows)
 const roles=(await tx.query(ROLE_SQL)).rows,memberships=(await tx.query(MEMBERS_SQL)).rows,defaultAcls=(await tx.query(DEFAULT_SQL)).rows
 const dependencies=(await tx.query("select distinct rn.nspname schema,rc.relname relation from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_class rc on rc.oid=k.confrelid join pg_namespace rn on rn.oid=rc.relnamespace where n.nspname='neuvetra' and rn.nspname<>'neuvetra' order by 1,2")).rows
 return {tables:rows,metadata,roles,memberships,defaultAcls,dependencies}
}
export type Inventory=Awaited<ReturnType<typeof inventory>>
export async function runtimeSafe(tx:WorkspaceSql){const row=(await tx.query<{safe:boolean}>(`select not r.rolsuper and not r.rolbypassrls and not r.rolcreatedb and not r.rolcreaterole and not r.rolreplication and not r.rolinherit and not exists(select 1 from pg_auth_members where member=r.oid) and not exists(select 1 from pg_namespace where nspname='neuvetra' and nspowner=r.oid) and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and p.proowner=r.oid) and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and (c.relowner=r.oid or(c.relkind='r' and(not c.relrowsecurity or not c.relforcerowsecurity)))) and not has_schema_privilege(r.rolname,'neuvetra','CREATE') and not has_schema_privilege(r.rolname,'public','CREATE') and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind in('r','p','v','m','f') and has_table_privilege(r.rolname,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) safe from pg_roles r where rolname='neuvetra_runtime'`)).rows;requireValue(row[0]?.safe===true)}
export function sameRows(before:Inventory,after:Inventory,allowAppend=false){for(const old of before.tables){const now=after.tables.find(t=>t.name===old.name);requireValue(now);if(!allowAppend)requireValue(old.sha256===now.sha256&&old.count===now.count);else{const remaining=[...now.rowHashes];for(const hash of old.rowHashes){const index=remaining.indexOf(hash);requireValue(index>=0);remaining.splice(index,1)}}}}
export async function lockedTables(tx:WorkspaceSql){const names=(await tx.query<{name:string}>("select tablename name from pg_tables where schemaname='neuvetra' order by tablename")).rows;requireValue(names.length&&names.every(t=>/^[a-z_]+$/.test(t.name)));await tx.exec('lock table '+names.map(t=>'neuvetra.'+t.name).join(',')+' in share mode')}
