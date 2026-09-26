/** Candidate2 independent native regressions; only new synthetic local state. */
import { mkdtemp,readFile,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPostgresConnection } from '../../packages/neuvetra-database/src/hosted'
import { createHostedSetupBackup } from '../../tools/staging/hosted-setup-backup'
import { rehearseHostedSetupRestore } from '../../tools/staging/hosted-setup-restore'
import { child,localEnvironment,dpapi } from '../../tools/staging/hosted-setup-restore-io'
import { captureState,assertPreserved,sha,hash,requireRecovery,validateBundle } from '../../tools/staging/hosted-setup-restore-core'
const bin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
const actors=[{id:'00000000-0000-4000-8000-000000000001',companies:['10000000-0000-4000-8000-000000000001']},{id:'00000000-0000-4000-8000-000000000002',companies:[]}]
const checks:string[]=[]
async function refused(label:string,fn:()=>unknown|Promise<unknown>,code:string){let actual='';try{await fn()}catch(e){actual=(e as Error).message}requireRecovery(actual===code,'QA_EXPECTED_REFUSAL_MISSING');checks.push(label)}
async function main(){
 const root=await mkdtemp(join(tmpdir(),'hosted-setup-independent-c2-')),data=join(root,'cluster'),stamp=Date.now(),sourceName=`hosted_setup_source_${stamp}`
 let started=false,admin:any,source:any,restored:any
 async function control(args:string[]){const p=Bun.spawn([join(bin,'pg_ctl.exe'),...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});requireRecovery(await p.exited===0,'QA_CONTROL_FAILED')}
 try{
  await child([join(bin,'initdb.exe'),'-D',data,'-U','supabase_admin','--auth=trust','--no-locale','--encoding=UTF8'])
  await control(['-D',data,'-l',join(root,'server.log'),'-o','-h 127.0.0.1 -p 55479','-w','start']);started=true
  const connect=(name:string)=>createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55479/${name}`,{tls:false,maxConnections:1})
  admin=connect('postgres');await admin.exec('create role neuvetra_runtime login nosuperuser nobypassrls nocreaterole');await admin.exec(`create database ${sourceName}`)
  source=connect(sourceName)
  const server=(await source.query('show server_version')).rows[0].server_version
  await source.exec(`create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to neuvetra_runtime;create schema neuvetra;grant usage on schema neuvetra to neuvetra_runtime;
   create table neuvetra.staging_target(project_ref text,profile text);insert into neuvetra.staging_target values('icockcoguyadhryzydvl','neuvetra.private-synthetic-staging.v1');
   create table neuvetra.companies(id uuid primary key);create table neuvetra.company_members(company_id uuid references neuvetra.companies(id),user_id uuid references auth.users(id));
   create table neuvetra.precise_records(id int primary key,company_id uuid references neuvetra.companies(id),amount numeric,payload jsonb);
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
  const before=await capture(source),archivePath=join(root,'synthetic.dpapi'),receiptPath=join(root,'receipt.json')
  const receipt=await createHostedSetupBackup({source,sourceMode:'synthetic-local',expectedDatabase:sourceName,actors,archivePath,receiptPath,dump:token=>child([join(bin,'pg_dump.exe'),'--format=custom','--schema=neuvetra','--no-password',`--snapshot=${token}`],undefined,localEnvironment(sourceName))})
  const database=`hosted_setup_restore_${stamp}_abcdef01`
  const input={host:'127.0.0.1' as const,port:55479 as const,role:'supabase_admin' as const,database,archivePath,archiveSha256:receipt.archiveSha256,receiptPath,receiptSha256:sha(await readFile(receiptPath)),pgRestorePath:join(bin,'pg_restore.exe'),pgRestoreSha256:sha(await readFile(join(bin,'pg_restore.exe'))),journalPath:join(root,'attempt.json'),resultPath:join(root,'result.json')}
  await rehearseHostedSetupRestore(input);checks.push('pristine-paired-dump-dpapi-actual-restore')
  restored=connect(database)
  for(const [label,sql] of [['numeric-integer','update neuvetra.precise_records set amount=9007199254740993'],['jsonb-integer',`update neuvetra.precise_records set payload='{"n":9007199254740993}'`]]){
   await restored.exec(sql);const changed=await capture(restored)
   await refused(label,()=>assertPreserved(before,changed),'HS_RECOVERY_PRESERVATION_MISMATCH')
   requireRecovery(hash(before.tenantAccess)!==hash(changed.tenantAccess),'QA_TENANT_DIGEST_UNCHANGED')
   const row=(await restored.query('select amount::text amount,payload::text payload from neuvetra.precise_records')).rows[0]
   requireRecovery(label==='numeric-integer'?row.amount==='9007199254740993':row.payload.includes('9007199254740993'),'QA_EXACT_READBACK_FAILED')
   await restored.exec(`update neuvetra.precise_records set amount=9007199254740992,payload='{"n":9007199254740992}'`);assertPreserved(before,await capture(restored))
  }
  for(const column of ['amount','payload']){
   const value=(n:string)=>column==='amount'?n:`'{"nested":{"n":${n}}}'`
   await restored.exec(`update neuvetra.precise_records set ${column}=${value('0.123456789012345678901234567891')}`);const baseline=await capture(restored)
   await restored.exec(`update neuvetra.precise_records set ${column}=${value('0.123456789012345678901234567892')}`)
   await refused(column+'-fraction',async()=>assertPreserved(baseline,await capture(restored)),'HS_RECOVERY_PRESERVATION_MISMATCH')
  }
  await restored.exec('create view neuvetra.record_view as select id,amount+1 amount from neuvetra.precise_records;grant select on neuvetra.record_view to neuvetra_runtime')
  const outsiderRows=await restored.transaction(async(tx:any)=>{await tx.exec('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors[1].id]);return (await tx.query('select id from neuvetra.record_view')).rows.length})
  requireRecovery(outsiderRows===1,'QA_VIEW_LEAK_NOT_EXERCISED')
  await refused('granted-view-leak-refused',()=>capture(restored),'HS_RECOVERY_UNSUPPORTED_RELATION_SURFACE')
  await restored.exec('create or replace view neuvetra.record_view as select id,amount+2 amount from neuvetra.precise_records')
  await refused('changed-view-refused',()=>capture(restored),'HS_RECOVERY_UNSUPPORTED_RELATION_SURFACE')
  await source.exec('create view neuvetra.record_view as select * from neuvetra.precise_records')
  let dumped=false
  await refused('source-view-before-dump',()=>createHostedSetupBackup({source,sourceMode:'synthetic-local',expectedDatabase:sourceName,actors,archivePath:join(root,'refused.dpapi'),receiptPath:join(root,'refused-receipt.json'),dump:async()=>{dumped=true;return new Uint8Array()}}),'HS_RECOVERY_UNSUPPORTED_RELATION_SURFACE')
  requireRecovery(!dumped,'QA_UNSUPPORTED_SOURCE_DUMPED')
  const snapshot=JSON.parse((await dpapi('Unprotect',await readFile(archivePath))).toString())
  const v1={...snapshot,profile:'neuvetra.hosted-setup.recovery.v1'},v1Receipt={...receipt,profile:'neuvetra.hosted-setup.recovery.v1',snapshotSha256:sha(JSON.stringify(v1))}
  await refused('internally-pinned-v1-bundle',()=>validateBundle(v1 as any,v1Receipt as any),'HS_RECOVERY_BOUNDARY_REFUSED')
  const oldReceipt=join(root,'v1-receipt.json');await writeFile(oldReceipt,JSON.stringify(v1Receipt))
  await refused('v1-receipt-before-nonexistent-archive-read',async()=>rehearseHostedSetupRestore({...input,archivePath:join(root,'does-not-exist.dpapi'),receiptPath:oldReceipt,receiptSha256:sha(await readFile(oldReceipt))}),'HS_RECOVERY_PAIRED_SOURCE_SNAPSHOT_REQUIRED')
  const unversioned=structuredClone(snapshot);delete unversioned.state.rowEncoding
  await refused('correctly-hashed-unversioned-state',()=>validateBundle(unversioned,{...receipt,snapshotSha256:sha(JSON.stringify(unversioned)),stateSha256:hash(unversioned.state)}),'HS_RECOVERY_ROW_ENCODING_REFUSED')
  console.log(JSON.stringify({status:'independent-candidate2-pass',server,checks,hostedAccess:false,providerAccess:false},null,2))
 }finally{await restored?.close();await source?.close();await admin?.close();if(started)await control(['-D',data,'-m','fast','-w','stop'])}
}
main().catch(()=>{console.error(JSON.stringify({status:'independent-candidate2-failed',checks}));process.exitCode=1})
