/** Independent Candidate3 native fixture. No hosted inputs, secrets, or provider operations. */
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {createHostedSetupBackup} from '../../tools/staging/hosted-setup-backup'
import {rehearseHostedSetupRestore} from '../../tools/staging/hosted-setup-restore'
import {child,localEnvironment,dpapi} from '../../tools/staging/hosted-setup-restore-io'
import {captureRuntimeSnapshotAccess,captureRuntimeSnapshotIdentity,sha,hash,requireRecovery,type RuntimeSnapshotProbe} from '../../tools/staging/hosted-setup-restore-core'
const bin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin',checks:string[]=[]
const actors=[{id:'00000000-0000-4000-8000-000000000001',companies:['10000000-0000-4000-8000-000000000001']},{id:'00000000-0000-4000-8000-000000000002',companies:[]}]
async function refusal(label:string,fn:()=>Promise<unknown>,code:string){let observed='';try{await fn()}catch(e){observed=(e as Error).message}requireRecovery(observed===code,'QA_REFUSAL_MISSING');checks.push(label)}
async function main(){
 const root=await mkdtemp(join(tmpdir(),'hosted-setup-qa-c3-')),data=join(root,'cluster'),stamp=Date.now(),database=`hosted_setup_source_${stamp}`
 let started=false,admin:any,source:any,operator:any,runtime:any
 const connect=(name:string,role='supabase_admin')=>createPostgresConnection(`postgres://${role}@127.0.0.1:55479/${name}`,{tls:false,maxConnections:1})
 async function control(args:string[]){const p=Bun.spawn([join(bin,'pg_ctl.exe'),...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});requireRecovery(await p.exited===0,'QA_CLUSTER_CONTROL_FAILED')}
 const noOutputs=async(path:string)=>{requireRecovery(!await Bun.file(path).exists()&&!await Bun.file(path+'.receipt').exists()&&await Bun.file(path+'.attempt.json').exists(),'QA_FAILURE_OUTPUT_BOUNDARY')}
 try{
  await child([join(bin,'initdb.exe'),'-D',data,'-U','supabase_admin','--auth=trust','--no-locale','--encoding=UTF8'])
  await control(['-D',data,'-l',join(root,'server.log'),'-o','-h 127.0.0.1 -p 55479','-w','start']);started=true
  admin=connect('postgres');await admin.exec('create role postgres login nosuperuser bypassrls nocreaterole nocreatedb noinherit;create role neuvetra_runtime login nosuperuser nobypassrls nocreaterole nocreatedb noreplication noinherit')
  await admin.exec(`create database ${database}`);source=connect(database)
  const version=(await source.query('show server_version')).rows[0].server_version
  await source.exec(`create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create schema neuvetra;grant usage on schema neuvetra,auth to postgres,neuvetra_runtime;
   create table neuvetra.staging_target(project_ref text,profile text);insert into neuvetra.staging_target values('icockcoguyadhryzydvl','neuvetra.private-synthetic-staging.v1');
   create table neuvetra.aaa_denied(company_id uuid,payload text);
   create table neuvetra.companies(id uuid primary key);create table neuvetra.company_members(company_id uuid references neuvetra.companies(id),user_id uuid references auth.users(id));
   create table neuvetra.precise_records(id bigserial primary key,company_id uuid references neuvetra.companies(id),amount numeric);
   alter table neuvetra.companies enable row level security;alter table neuvetra.companies force row level security;
   alter table neuvetra.company_members enable row level security;alter table neuvetra.company_members force row level security;
   alter table neuvetra.precise_records enable row level security;alter table neuvetra.precise_records force row level security;
   create policy company on neuvetra.companies for select to neuvetra_runtime using(id in(select company_id from neuvetra.company_members));
   create policy member on neuvetra.company_members for select to neuvetra_runtime using(user_id=auth.uid());
   create policy precise on neuvetra.precise_records for select to neuvetra_runtime using(company_id in(select company_id from neuvetra.company_members));
   grant select on neuvetra.companies,neuvetra.company_members to neuvetra_runtime;
   grant select(id,company_id,amount) on neuvetra.precise_records to neuvetra_runtime;
   insert into auth.users values('00000000-0000-4000-8000-000000000001');
   insert into neuvetra.companies values('10000000-0000-4000-8000-000000000001');
   insert into neuvetra.company_members values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001');
   insert into neuvetra.precise_records(company_id,amount) values('10000000-0000-4000-8000-000000000001',9007199254740992);
   grant select on all tables in schema neuvetra to postgres;grant select on all sequences in schema neuvetra to postgres;`)
  operator=connect(database,'postgres');runtime=connect(database,'neuvetra_runtime')
  let forbidden=false;try{await operator.exec('set role neuvetra_runtime')}catch(e){forbidden=(e as any).code==='42501'}requireRecovery(forbidden,'QA_OPERATOR_CAN_SET_ROLE');checks.push('operator-native-42501-setting-runtime-role')
  const session=(await runtime.query('select current_user actor,session_user session')).rows[0];requireRecovery(session.actor==='neuvetra_runtime'&&session.session==='neuvetra_runtime','QA_RUNTIME_IDENTITY');checks.push('separate-runtime-current-and-session-identity')
  const runtimeOrder:string[][]=[]
  const tracedRuntime={...runtime,transaction:(fn:any)=>runtime.transaction(async(tx:any)=>{const order:string[]=[];runtimeOrder.push(order);return fn({...tx,exec:async(sql:string)=>{order.push(sql);return tx.exec(sql)},query:async(sql:string,args?:unknown[])=>{order.push('SELECT');return tx.query(sql,args)}})})}
  let idle=0,tokenPin=''
  const measuredOperator={...operator,transaction:(fn:any)=>operator.transaction((tx:any)=>fn({...tx,exec:async(sql:string)=>{await tx.exec(sql);if(sql.includes('idle_in_transaction_session_timeout'))idle=(await tx.query("select extract(epoch from current_setting('idle_in_transaction_session_timeout')::interval)::int seconds")).rows[0].seconds}}))}
  const archivePath=join(root,'paired.dpapi'),receiptPath=archivePath+'.receipt'
  const receipt=await createHostedSetupBackup({source:measuredOperator,runtimeConnection:tracedRuntime,sourceMode:'synthetic-local',expectedDatabase:database,actors,archivePath,receiptPath,dump:async(token)=>{tokenPin=sha(token);await source.exec('update neuvetra.precise_records set amount=amount+1');return child([join(bin,'pg_dump.exe'),'--format=custom','--schema=neuvetra','--no-password',`--snapshot=${token}`],undefined,{...localEnvironment(database),PGUSER:'postgres'})}})
  requireRecovery(idle===120,'QA_IDLE_TIMEOUT');checks.push('120-second-source-idle-setting')
  requireRecovery(runtimeOrder.length===2&&runtimeOrder.every(o=>o[0]==='set transaction isolation level repeatable read read only'&&o[1]?.startsWith('set transaction snapshot ')&&o[2]==='SELECT'),'QA_SNAPSHOT_ORDER');checks.push('both-runtime-captures-import-before-first-select')
  const snapshot=JSON.parse((await dpapi('Unprotect',await readFile(archivePath))).toString())
  requireRecovery(snapshot.snapshotTokenHash===tokenPin,'QA_DUMP_TOKEN_BINDING')
  for(const table of ['aaa_denied','staging_target'])requireRecovery(snapshot.state.tenantAccess.filter((p:any)=>p.table===table).every((p:any)=>p.outcome==='select-privilege-denied'),'QA_DENIED_LABEL')
  requireRecovery(snapshot.state.tenantAccess.some((p:any)=>p.table==='precise_records'&&p.actor===actors[0].id&&p.count===1),'QA_COLUMN_GRANT_READ');checks.push('denied-marker-and-first-table-do-not-latch-column-grant-read')
  const clone=`hosted_setup_restore_${stamp}_ab12cd34`
  await rehearseHostedSetupRestore({host:'127.0.0.1',port:55479,role:'supabase_admin',database:clone,archivePath,archiveSha256:receipt.archiveSha256,receiptPath,receiptSha256:sha(await readFile(receiptPath)),pgRestorePath:join(bin,'pg_restore.exe'),pgRestoreSha256:sha(await readFile(join(bin,'pg_restore.exe'))),journalPath:join(root,'restore.json'),resultPath:join(root,'restored.json')})
  const restored=connect(clone);try{requireRecovery((await restored.query('select amount::text amount from neuvetra.precise_records')).rows[0].amount==='9007199254740992','QA_RESTORED_SNAPSHOT_WRONG')}finally{await restored.close()}
  requireRecovery((await source.query('select amount::text amount from neuvetra.precise_records')).rows[0].amount==='9007199254740993','QA_CONCURRENT_WRITE_MISSING');checks.push('actual-dump-dpapi-restore-retains-exported-snapshot-across-commit')
  const tables=snapshot.state.inventory.tables.map((t:any)=>t.name);let stale:any
  await operator.transaction(async(tx:any)=>{
   await tx.exec('set transaction isolation level repeatable read read only');const token=(await tx.query('select pg_export_snapshot() token')).rows[0].token
   const probe:RuntimeSnapshotProbe={connection:runtime,token,tokenSha256:sha(token),source:await captureRuntimeSnapshotIdentity(tx)};stale=probe
   const valid=await captureRuntimeSnapshotAccess(probe,actors,tables);requireRecovery(valid.length===tables.length*actors.length,'QA_PROBE_COUNT');checks.push('current-live-exported-snapshot-probe')
   await refusal('token-injection',()=>captureRuntimeSnapshotAccess({...probe,token:token+"';select 1;--"},actors,tables),'HS_RECOVERY_SNAPSHOT_TOKEN_REFUSED')
   await refusal('well-shaped-unknown-token',()=>captureRuntimeSnapshotAccess({...probe,token:'00000000-00000000-1',tokenSha256:sha('00000000-00000000-1')},actors,tables),'HS_RECOVERY_SNAPSHOT_IMPORT_FAILED')
   await refusal('wrong-marker-oid',()=>captureRuntimeSnapshotAccess({...probe,source:{...probe.source,markerOid:'1'}},actors,tables),'HS_RECOVERY_RUNTIME_SNAPSHOT_IDENTITY_REFUSED')
   const impersonator={...source,transaction:(fn:any)=>source.transaction(async(t:any)=>{await t.exec('set local role neuvetra_runtime');return fn(t)})}
   await refusal('privileged-session-set-role-impersonation',()=>captureRuntimeSnapshotAccess({...probe,connection:impersonator},actors,tables),'HS_RECOVERY_RUNTIME_SESSION_REFUSED')
   await runtime.exec('set row_security=off')
   await refusal('runtime-row-security-off',()=>captureRuntimeSnapshotAccess(probe,actors,tables),'HS_RECOVERY_RUNTIME_SESSION_REFUSED')
   await runtime.exec('set row_security=on')
  })
  await refusal('expired-exporter-snapshot',()=>captureRuntimeSnapshotAccess(stale,actors,tables),'HS_RECOVERY_SNAPSHOT_IMPORT_FAILED')
  // A real policy permission error is not equivalent to an absent SELECT grant.
  await source.exec(`create function neuvetra.qa_policy_error() returns boolean language plpgsql as $$begin raise exception 'synthetic policy failure' using errcode='42501';end$$;
   alter policy precise on neuvetra.precise_records using(neuvetra.qa_policy_error())`)
  const failed=join(root,'policy-error.dpapi');let dumpCalled=false
  await refusal('allowed-table-policy-42501-aborts',()=>createHostedSetupBackup({source:operator,runtimeConnection:runtime,sourceMode:'synthetic-local',expectedDatabase:database,actors,archivePath:failed,receiptPath:failed+'.receipt',dump:async()=>{dumpCalled=true;return new Uint8Array()}}),'HS_RECOVERY_TENANT_PROBE_FAILED')
  requireRecovery(!dumpCalled,'QA_POLICY_FAILURE_DUMPED');await noOutputs(failed);checks.push('policy-failure-no-archive-or-receipt-reservation-retained')
  await source.exec('alter policy precise on neuvetra.precise_records using(company_id in(select company_id from neuvetra.company_members))')
  await source.exec('alter table neuvetra.precise_records disable row level security')
  await operator.transaction(async(tx:any)=>{await tx.exec('set transaction isolation level repeatable read read only');const token=(await tx.query('select pg_export_snapshot() token')).rows[0].token;await refusal('actual-outsider-table-leak',async()=>captureRuntimeSnapshotAccess({connection:runtime,token,tokenSha256:sha(token),source:await captureRuntimeSnapshotIdentity(tx)},actors,tables),'HS_RECOVERY_TENANT_PROBE_FAILED')})
  await source.exec('alter table neuvetra.precise_records enable row level security')
  for(const mode of ['confirmed','unconfirmed'] as const){
   const s=connect(database,'postgres'),r=connect(database,'neuvetra_runtime'),path=join(root,mode+'.dpapi');let proc:ReturnType<typeof Bun.spawn>|undefined,aborted=false,reaped=false,cancelled=false
   const startedAt=Date.now()
   try{
    await refusal('deadline-'+mode,()=>createHostedSetupBackup({source:s,runtimeConnection:r,sourceMode:'synthetic-local',expectedDatabase:database,actors,archivePath:path,receiptPath:path+'.receipt',maxDurationMs:1000,
     dump:async(_token,signal)=>{signal?.addEventListener('abort',()=>{aborted=true},{once:true});proc=Bun.spawn([join(bin,'psql.exe'),'--no-password','-c','select pg_sleep(30)'],{env:{...localEnvironment(database),PGUSER:'postgres'},stdin:'ignore',stdout:'ignore',stderr:'ignore'});await proc.exited;throw Error('SYNTHETIC_CHILD_EXITED')},
     cancelDump:async()=>{cancelled=true;proc?.kill();await proc?.exited;reaped=true;if(mode==='unconfirmed')await new Promise(()=>{})}
    }),mode==='confirmed'?'HS_RECOVERY_BACKUP_DEADLINE_EXCEEDED':'HS_RECOVERY_BACKUP_CANCELLATION_UNCONFIRMED')
    console.log(JSON.stringify({cancellationMode:mode,aborted,cancelled,reaped,exitCode:proc?.exitCode,signalCode:proc?.signalCode,elapsedMs:Date.now()-startedAt}))
    requireRecovery(aborted&&cancelled&&reaped&&!!proc&&Date.now()-startedAt<8000,'QA_CANCELLATION_BOUNDARY');await noOutputs(path);checks.push(mode+'-child-reaped-and-no-output')
   }finally{proc?.kill();await proc?.exited;await s.close();await r.close()}
  }
  console.log(JSON.stringify({status:'independent-candidate3-pass',version,checks,hostedAccess:false,providerAccess:false},null,2))
 }finally{await runtime?.close();await operator?.close();await source?.close();await admin?.close();if(started)await control(['-D',data,'-m','fast','-w','stop'])}
}
main().catch(e=>{console.error(JSON.stringify({status:'independent-candidate3-failed',code:e instanceof Error&&/^HS_RECOVERY_[A-Z0-9_]+$/.test(e.message)?e.message:'QA_SYNTHETIC_FAILED',checks}));process.exitCode=1})
