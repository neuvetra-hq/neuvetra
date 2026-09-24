/** Independent read-only recovery comparison. Deliberately does not import any
 * operator inventory, replay, recovery, or canonicalization implementation. */
import {createHash} from 'node:crypto'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
const [sourceName,restoredName,outputName]=process.argv.slice(2)
if(!sourceName||!restoredName||!outputName||!/^m7[45]_(ops|qa)_[a-z0-9_]+$/.test(sourceName)||!/^m75_(ops|qa)_[a-z0-9_]+$/.test(restoredName)||!/^evaluations\/research-qa\/m75-[a-z0-9-]+\.json$/.test(outputName))throw Error('Only named synthetic local fixtures and reviewer evidence paths are allowed')
const digest=(v:string)=>createHash('sha256').update(v,'utf8').digest('hex')
const sortedHash=(values:string[])=>digest(JSON.stringify(values.sort()))
const connect=(name:string)=>createPostgresConnection(`postgres://m63_test_admin@127.0.0.1:55463/${name}`,{tls:false,maxConnections:1})
async function collect(tx:WorkspaceSql){
 await tx.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
 const names=(await tx.query<{name:string}>("select tablename as name from pg_tables where schemaname='neuvetra' order by tablename")).rows.map(x=>x.name)
 const tables=[]
 for(const name of names){
  if(!/^[a-z_]+$/.test(name))throw Error('Unexpected identifier')
  const rows=(await tx.query<{body:string}>(`select to_jsonb(t)::text as body from neuvetra."${name}" t`)).rows.map(x=>x.body)
  // PostgreSQL JSONB text includes exact escaped text values and all retained columns.
  // Multiset retains duplicates; no author-selected ID/column allowlist is used.
  tables.push({name,count:rows.length,byteLength:rows.reduce((n,x)=>n+Buffer.byteLength(x),0),sha256:sortedHash(rows)})
 }
 const queries={
  columns:"select table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name from information_schema.columns where table_schema='neuvetra' order by table_name,ordinal_position",
  tables:"select c.relname,pg_get_userbyid(c.relowner) owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind in ('r','p','v','m','S') order by c.relname",
  policies:"select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='neuvetra' order by tablename,policyname",
  functions:"select p.proname,pg_get_function_identity_arguments(p.oid) arguments,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proacl::text,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and p.prokind='f' order by p.proname,arguments",
  triggers:"select c.relname,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and not t.tgisinternal order by c.relname,t.tgname",
  constraints:"select c.relname,p.conname,pg_get_constraintdef(p.oid) definition from pg_constraint p join pg_class c on c.oid=p.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' order by c.relname,p.conname",
  indexes:"select tablename,indexname,indexdef from pg_indexes where schemaname='neuvetra' order by tablename,indexname",
  schemaAcl:"select nspname,pg_get_userbyid(nspowner) owner,nspacl::text from pg_namespace where nspname='neuvetra'",
  defaultAcl:"select pg_get_userbyid(d.defaclrole) role,n.nspname,d.defaclobjtype,d.defaclacl::text from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='neuvetra' order by role,d.defaclobjtype",
  roles:"select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconfig from pg_roles order by rolname",
  memberships:"select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option from pg_auth_members order by role,member,grantor"
 }
 const catalog:Record<string,{count:number;sha256:string}>={}
 for(const [key,q] of Object.entries(queries)){const rows=(await tx.query<Record<string,unknown>>(q)).rows.map(x=>JSON.stringify(x));catalog[key]={count:rows.length,sha256:sortedHash(rows)}}
 return {tables,catalog,sha256:digest(JSON.stringify({tables,catalog}))}
}
const source=connect(sourceName),restored=connect(restoredName)
try{
 const before=await source.transaction(collect),after=await restored.transaction(collect),sourceAgain=await source.transaction(collect)
 const result={profile:'m75-independent-readonly-recovery-v1',createdAt:new Date().toISOString(),sourceName,restoredName,schemaVersion:before.tables.find(x=>x.name==='schema_migrations')?.count,sourceUnchanged:before.sha256===sourceAgain.sha256,exactEqual:before.sha256===after.sha256,tableCount:before.tables.length,rowCount:before.tables.reduce((n,x)=>n+x.count,0),before,after,scriptSha256:digest(await Bun.file(import.meta.path).text()),limitations:['Same-cluster independently collected retained-state comparison.','Does not execute restore or certify DPAPI archive integrity; compares independently selected retained rows, text values, definitions and ACLs.','Global roles are shared by both databases; role hash establishes unchanged observations, not cross-cluster reconstruction.']}
 await Bun.write(outputName,JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify({exactEqual:result.exactEqual,sourceUnchanged:result.sourceUnchanged,tableCount:result.tableCount,rowCount:result.rowCount,outputName}))
 if(!result.exactEqual||!result.sourceUnchanged)process.exitCode=1
}finally{await source.close();await restored.close()}
