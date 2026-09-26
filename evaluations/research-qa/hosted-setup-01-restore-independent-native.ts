/** Independent synthetic-only regression probes. No hosted inputs or provider access. */
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPostgresConnection } from '../../packages/neuvetra-database/src/hosted'
import { createHostedSetupBackup } from '../../tools/staging/hosted-setup-backup'
import { rehearseHostedSetupRestore } from '../../tools/staging/hosted-setup-restore'
import { child, localEnvironment } from '../../tools/staging/hosted-setup-restore-io'
import { captureState, assertPreserved, sha, requireRecovery } from '../../tools/staging/hosted-setup-restore-core'
const bin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
const actors=[{id:'00000000-0000-4000-8000-000000000001',companies:['10000000-0000-4000-8000-000000000001']},{id:'00000000-0000-4000-8000-000000000002',companies:[]}]
async function main(){
 const root=await mkdtemp(join(tmpdir(),'hosted-setup-independent-')),data=join(root,'cluster'),stamp=Date.now(),sourceName=`hosted_setup_source_${stamp}`
 let started=false,admin:any,source:any,restored:any
 async function control(args:string[]){const p=Bun.spawn([join(bin,'pg_ctl.exe'),...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});requireRecovery(await p.exited===0,'QA_CONTROL_FAILED')}
 const result:any={hostedAccess:false,providerAccess:false,checks:[]}
 try{
  await child([join(bin,'initdb.exe'),'-D',data,'-U','supabase_admin','--auth=trust','--no-locale','--encoding=UTF8'])
  await control(['-D',data,'-l',join(root,'server.log'),'-o','-h 127.0.0.1 -p 55479','-w','start']);started=true
  const connect=(name:string)=>createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55479/${name}`,{tls:false,maxConnections:1})
  admin=connect('postgres');await admin.exec('create role neuvetra_runtime login nosuperuser nobypassrls nocreaterole');await admin.exec(`create database ${sourceName}`)
  source=connect(sourceName)
  result.server=(await source.query('show server_version')).rows[0].server_version
  await source.exec(`create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to neuvetra_runtime;create schema neuvetra;grant usage on schema neuvetra to neuvetra_runtime;
   create table neuvetra.staging_target(project_ref text,profile text);insert into neuvetra.staging_target values('icockcoguyadhryzydvl','neuvetra.private-synthetic-staging.v1');
   create table neuvetra.companies(id uuid primary key);create table neuvetra.company_members(company_id uuid references neuvetra.companies(id),user_id uuid references auth.users(id));
   create table neuvetra.precise_records(id int primary key,company_id uuid references neuvetra.companies(id),amount numeric,payload jsonb);
   create view neuvetra.record_view as select id,amount+1 amount from neuvetra.precise_records;
   alter table neuvetra.companies enable row level security;alter table neuvetra.companies force row level security;
   alter table neuvetra.company_members enable row level security;alter table neuvetra.company_members force row level security;
   alter table neuvetra.precise_records enable row level security;alter table neuvetra.precise_records force row level security;
   create policy members on neuvetra.company_members for select to neuvetra_runtime using(user_id=auth.uid());
   create policy companies on neuvetra.companies for select to neuvetra_runtime using(id in(select company_id from neuvetra.company_members));
   create policy records on neuvetra.precise_records for select to neuvetra_runtime using(company_id in(select company_id from neuvetra.company_members));
   grant select on all tables in schema neuvetra to neuvetra_runtime;
   insert into auth.users values('00000000-0000-4000-8000-000000000001');insert into neuvetra.companies values('10000000-0000-4000-8000-000000000001');
   insert into neuvetra.company_members values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
   insert into neuvetra.precise_records values(1,'10000000-0000-4000-8000-000000000001',9007199254740992,'{"n":9007199254740992}');`)
  const capture=(db:any)=>db.transaction(async(tx:any)=>{await tx.exec('set transaction isolation level repeatable read read only');return captureState(tx,actors)})
  const before=await capture(source)
  const archivePath=join(root,'synthetic.dpapi'),receiptPath=join(root,'receipt.json')
  const receipt=await createHostedSetupBackup({source,sourceMode:'synthetic-local',expectedDatabase:sourceName,actors,archivePath,receiptPath,dump:token=>child([join(bin,'pg_dump.exe'),'--format=custom','--schema=neuvetra','--no-password',`--snapshot=${token}`],undefined,localEnvironment(sourceName))})
  const database=`hosted_setup_restore_${stamp}_abcdef01`
  await rehearseHostedSetupRestore({host:'127.0.0.1',port:55479,role:'supabase_admin',database,archivePath,archiveSha256:receipt.archiveSha256,receiptPath,receiptSha256:sha(await readFile(receiptPath)),pgRestorePath:join(bin,'pg_restore.exe'),pgRestoreSha256:sha(await readFile(join(bin,'pg_restore.exe'))),journalPath:join(root,'attempt.json'),resultPath:join(root,'result.json')})
  result.checks.push('actual paired pg17 dump, DPAPI seal/unseal and pristine restore pass')
  restored=connect(database)
  await restored.exec(`update neuvetra.precise_records set amount=9007199254740993,payload='{"n":9007199254740993}'`)
  result.numericDirectReadback=(await restored.query('select amount::text amount,payload::text payload from neuvetra.precise_records')).rows[0]
  try{assertPreserved(before,await capture(restored));result.numericDriftAccepted=true}catch{result.numericDriftAccepted=false}
  await restored.exec(`update neuvetra.precise_records set amount=9007199254740992,payload='{"n":9007199254740992}'`)
  await restored.exec('create or replace view neuvetra.record_view as select id,amount+2 amount from neuvetra.precise_records')
  try{assertPreserved(before,await capture(restored));result.viewDefinitionDriftAccepted=true}catch{result.viewDefinitionDriftAccepted=false}
  // A granted owner-security view exposes the sole member company to the outsider,
  // but captureState only probes ordinary tables and reports success.
  result.outsiderViewRows=await restored.transaction(async(tx:any)=>{await tx.exec('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors[1].id]);return (await tx.query('select id from neuvetra.record_view')).rows.length})
  await restored.exec('create or replace view neuvetra.record_view as select id,amount+1 amount from neuvetra.precise_records')
  await restored.exec('alter table neuvetra.precise_records disable row level security')
  try{await capture(restored);result.tableTenantLeakRefused=false}catch{result.tableTenantLeakRefused=true}
  result.status=result.numericDriftAccepted||result.viewDefinitionDriftAccepted?'independent-findings-reproduced':'regressions-rejected'
  console.log(JSON.stringify(result,null,2))
 }finally{await restored?.close();await source?.close();await admin?.close();if(started)await control(['-D',data,'-m','fast','-w','stop'])}
}
main().catch(()=>{console.error('INDEPENDENT_SYNTHETIC_TEST_FAILED');process.exitCode=1})
