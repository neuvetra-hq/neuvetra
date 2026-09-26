import { createPostgresConnection } from '../../packages/neuvetra-database/src/hosted'
import { readMigrationManifest } from '../../packages/neuvetra-database/src/staging-migrations'
import { readCompanySetup, readCompanySetupVersion, saveCompanySetup, type CompanySetup } from '../../packages/neuvetra-database/src/company-setup'
import { createCompanySetupRoutes } from '../../apps/site-api/src/workspace/company-setup-routes'
import { M80_FIXTURE_SHA256 } from '../../packages/neuvetra-database/src/m80-fixture'

export const BASE='postgres://hosted_setup_qa_admin@127.0.0.1:55483'
export const REF='hostedsetupqatestonly'
export const names=['owner','member','other','uninvited'] as const
export const setup=():CompanySetup=>({company:{legalName:'Synthetic QA Company',tradingName:'',countryCode:'US',regionCode:'NV',industry:'Synthetic test',naics:'',preparerRole:'Owner',additionalBusinessActivities:'',otherIndustry:''},reportingPeriod:{start:'2025-01-01',endExclusive:'2026-01-01',firstInventory:'unknown',priorInventoryReference:''},boundary:{approach:'operational_control',notes:'Synthetic test only',hasParent:'unknown',parentName:'',includedOperations:''},entities:[{id:crypto.randomUUID(),name:'Synthetic parent',ownershipPercent:null,control:'unknown',inclusion:'unknown',reason:''}],relationships:[],locations:[],screening:[{id:crypto.randomUUID(),scope:1,category:'stationary_combustion',state:'unknown',reason:'',details:'',locationId:null},{id:crypto.randomUUID(),scope:2,category:'purchased_electricity',state:'no',reason:'Synthetic company does not purchase electricity',details:'',locationId:null},{id:crypto.randomUUID(),scope:3,category:'category_1',state:'not_applicable',reason:'Synthetic test rationale',details:'',locationId:null}],changes:[],changeNotes:'',review:{acknowledged:false,notes:''}})
export async function fixture(){
 const databaseName='hosted_setup_01_qa_'+Date.now(),cluster=createPostgresConnection(BASE+'/postgres',{tls:false,maxConnections:1})
 await cluster.exec(`create database ${databaseName} template template0`)
 await cluster.exec("do $$ begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$")
 await cluster.close()
 const op=createPostgresConnection(BASE+'/'+databaseName,{tls:false,maxConnections:4})
 await op.exec("create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$")
 const manifest=(await readMigrationManifest()).filter(m=>Number(m.name.slice(0,4))<=22)
 if(manifest.length!==22)throw Error('22 exact legacy migrations required')
 const role=(await op.query("select 1 from pg_roles where rolname='neuvetra_runtime'")).rows.length>0
 for(const m of manifest)await op.exec(role?m.sql.replace('create role neuvetra_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;',''):m.sql)
 await op.exec('alter role neuvetra_runtime login')
 const users=Object.fromEntries(names.map(n=>[n,crypto.randomUUID()])) as Record<typeof names[number],string>,a=crypto.randomUUID(),b=crypto.randomUUID()
 for(const id of Object.values(users))await op.query('insert into auth.users(id) values($1)',[id])
 for(const [id,owner] of [[a,users.owner],[b,users.other]]){
  await op.query("insert into neuvetra.companies(id,name,country_code,state_code,created_by) values($1,$2,'US','CA',$3)",[id,'Synthetic QA '+id,owner])
  await op.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'owner')",[id,owner])
  await op.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true)',[owner,id])
 }
 await op.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'member'),($1,$3,'owner')",[a,users.member,users.uninvited])
 await op.query('insert into neuvetra.staging_access(user_id,company_id,active) values($1,$2,true),($3,$2,false)',[users.member,a,users.uninvited])
 // SQL-conforming synthetic preservation sentinels, not claimed valid accounting outputs.
 const coverage=crypto.randomUUID(),stream=crypto.randomUUID(),inventory=crypto.randomUUID(),m80=crypto.randomUUID()
 await op.query('insert into neuvetra.corporate_inventory_heads(company_id,id) values($1,$2)',[a,crypto.randomUUID()])
 await op.query("insert into neuvetra.corporate_inventory_versions select $1,$2,id,1,null,'{\"qa\":\"synthetic preservation sentinel\"}',repeat('a',64),repeat('b',64),$3,now(),'synthetic sentinel' from neuvetra.corporate_inventory_heads where company_id=$2",[coverage,a,users.owner])
 await op.query("insert into neuvetra.corporate_inventory_audit values($1,$2,$3,'save',repeat('b',64),$4,now())",[crypto.randomUUID(),a,coverage,users.owner])
 await op.query("insert into neuvetra.scope1_heads(id,company_id,family) values($1,$2,'inventory')",[stream,a])
 await op.query("insert into neuvetra.scope1_versions values($1,$2,$3,'inventory',1,null,$4,'{\"qa\":\"synthetic preservation sentinel\"}','{}',repeat('a',64),repeat('b',64),repeat('c',64),$5,now(),'synthetic sentinel')",[inventory,a,stream,coverage,users.owner])
 await op.query("insert into neuvetra.scope1_audit(id,company_id,record_id,kind,record_sha256,actor_id,created_at) values($1,$2,$3,'save',repeat('c',64),$4,now())",[crypto.randomUUID(),a,inventory,users.owner])
 await op.query("insert into neuvetra.scope1_beta_fixture_admissions(company_id,fixture_profile_id,fixture_version,fixture_sha256,active,admitted_by) values($1,'m80-synthetic-scope1-foundation-v1',1,$3,true,$2)",[a,users.owner,M80_FIXTURE_SHA256])
 await op.query("insert into neuvetra.scope1_beta_setup_versions values($1,$2,2025,1,null,null,'m80-synthetic-scope1-foundation-v1',1,$4,'{\"qa\":\"synthetic preservation sentinel\"}','synthetic sentinel',repeat('e',64),repeat('f',64),$3,now(),null,'synthetic_rehearsal','incomplete',0)",[m80,a,users.owner,M80_FIXTURE_SHA256])
 await op.query("insert into neuvetra.scope1_beta_audit(id,company_id,record_id,event_type,record_sha256,actor_id,created_at) values($1,$2,$3,'setup_saved',repeat('f',64),$4,now())",[crypto.randomUUID(),a,m80,users.owner])
 const legacyTables=(await op.query<{tablename:string}>("select tablename from pg_tables where schemaname='neuvetra' order by tablename")).rows.map(r=>r.tablename)
 const snapshot=async()=>Object.fromEntries(await Promise.all(legacyTables.map(async t=>[t,(await op.query<{data:string}>(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text data from neuvetra."${t}" t`)).rows[0]!.data])))
 const before=await snapshot()
 await op.exec(await Bun.file(new URL('../../packages/neuvetra-database/src/migrations/0023_company_setup.sql',import.meta.url)).text())
 await op.exec("create table neuvetra.schema_migrations(name text primary key,sha256 text not null); create table neuvetra.staging_target(project_ref text,profile text); alter table neuvetra.schema_migrations enable row level security; alter table neuvetra.schema_migrations force row level security; alter table neuvetra.staging_target enable row level security; alter table neuvetra.staging_target force row level security; create policy qa_migrations_read on neuvetra.schema_migrations for select to neuvetra_runtime using(true); create policy qa_target_read on neuvetra.staging_target for select to neuvetra_runtime using(true); grant select on neuvetra.schema_migrations,neuvetra.staging_target to neuvetra_runtime")
 for(const m of await readMigrationManifest())await op.query('insert into neuvetra.schema_migrations values($1,$2)',[m.name,m.sha256])
 await op.query("insert into neuvetra.staging_target values($1,'neuvetra.private-synthetic-staging.v1')",[REF])
 const runtimeUrl=BASE.replace('hosted_setup_qa_admin','neuvetra_runtime')+'/'+databaseName
 const runtime=createPostgresConnection(runtimeUrl,{tls:false,maxConnections:4})
 const scoped=<T>(actor:string,fn:(tx:any)=>Promise<T>)=>runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);return fn(tx)})
 const database={findCompanySetup:(actor:string,company:string)=>scoped(actor,tx=>readCompanySetup(tx,company)),findCompanySetupVersion:(actor:string,company:string,id:string)=>scoped(actor,tx=>readCompanySetupVersion(tx,company,id)),saveCompanySetup:(actor:string,company:string,input:unknown)=>scoped(actor,tx=>saveCompanySetup(tx,actor,company,input))}
 const origin='http://127.0.0.1:48083',route=createCompanySetupRoutes({database,origin,validateUser:async token=>users[token as keyof typeof users]?{id:users[token as keyof typeof users],email:null,phone:null,fullName:null}:null})
 const call=(actor:string|null,company=a,input?:unknown,suffix='')=>route(new Request(origin+'/workspace/'+company+'/setup'+suffix,{method:input===undefined?'GET':'POST',headers:{origin,...(actor?{authorization:'Bearer '+actor}:{})},body:input===undefined?undefined:JSON.stringify(input)}))
 return {databaseName,op,runtime,runtimeUrl,scoped,database,call,users,a,b,before,snapshot,close:async()=>{await runtime.close();await op.close()}}
}
