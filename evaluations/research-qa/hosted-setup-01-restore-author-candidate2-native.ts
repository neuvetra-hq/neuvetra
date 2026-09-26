/** Explicit synthetic-only native integration. Uses a fresh temp cluster; never reads hosted inputs. */
import { mkdtemp,readFile,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPostgresConnection } from '../../packages/neuvetra-database/src/hosted'
import { createHostedSetupBackup } from '../../tools/staging/hosted-setup-backup'
import { rehearseHostedSetupRestore,type RestoreInput } from '../../tools/staging/hosted-setup-restore'
import { child,localEnvironment,dpapi } from '../../tools/staging/hosted-setup-restore-io'
import { sha,hash,requireRecovery,captureState,assertPreserved,type Snapshot } from '../../tools/staging/hosted-setup-restore-core'
const BIN='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
const completedChecks:string[]=[]
const actors=[{id:'00000000-0000-4000-8000-000000000001',companies:['10000000-0000-4000-8000-000000000001']},{id:'00000000-0000-4000-8000-000000000002',companies:['10000000-0000-4000-8000-000000000002']},{id:'00000000-0000-4000-8000-000000000003',companies:[]}]
async function control(args:string[]){const p=Bun.spawn([join(BIN,'pg_ctl.exe'),...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});requireRecovery(await p.exited===0,'TEST_CLUSTER_CONTROL_FAILED')}
async function run(){
  const root=await mkdtemp(join(tmpdir(),'hosted-setup-restore-author-candidate2-')),data=join(root,'data'),stamp=Date.now(),sourceName=`hosted_setup_source_${stamp}`
  let started=false,db:ReturnType<typeof createPostgresConnection>|undefined,source:ReturnType<typeof createPostgresConnection>|undefined
  const checks=completedChecks
  try{
    await child([join(BIN,'initdb.exe'),'-D',data,'-U','supabase_admin','--auth=trust','--no-locale','--encoding=UTF8'])
    await control(['-D',data,'-l',join(root,'server.log'),'-o','-h 127.0.0.1 -p 55479','-w','start']);started=true
    db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55479/postgres',{tls:false,maxConnections:1})
    await db.exec('create role neuvetra_runtime login nosuperuser nobypassrls nocreaterole')
    await db.exec(`create database ${sourceName}`)
    source=createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55479/${sourceName}`,{tls:false,maxConnections:1})
    await source.exec(`create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to neuvetra_runtime;
      create schema neuvetra;grant usage on schema neuvetra to neuvetra_runtime;
      create table neuvetra.staging_target(project_ref text,profile text);
      insert into neuvetra.staging_target values('icockcoguyadhryzydvl','neuvetra.private-synthetic-staging.v1');
      create table neuvetra.companies(id uuid primary key,name text);
      create table neuvetra.company_members(company_id uuid references neuvetra.companies(id),user_id uuid references auth.users(id));
      create table neuvetra.histories(id bigserial primary key,company_id uuid references neuvetra.companies(id),actor_id uuid references auth.users(id),payload jsonb);
      create table neuvetra.empty_history(id uuid primary key,company_id uuid references neuvetra.companies(id));
      create table neuvetra.precise_records(company_id uuid references neuvetra.companies(id),amount numeric,payload jsonb);
      alter table neuvetra.companies enable row level security;alter table neuvetra.companies force row level security;
      alter table neuvetra.company_members enable row level security;alter table neuvetra.company_members force row level security;
      alter table neuvetra.histories enable row level security;alter table neuvetra.histories force row level security;
      alter table neuvetra.precise_records enable row level security;alter table neuvetra.precise_records force row level security;
      create policy members on neuvetra.company_members for select to neuvetra_runtime using(user_id=auth.uid());
      create policy company on neuvetra.companies for select to neuvetra_runtime using(id in(select company_id from neuvetra.company_members));
      create policy history on neuvetra.histories for select to neuvetra_runtime using(company_id in(select company_id from neuvetra.company_members));
      create policy precise on neuvetra.precise_records for select to neuvetra_runtime using(company_id in(select company_id from neuvetra.company_members));
      grant select on all tables in schema neuvetra to neuvetra_runtime;`)
    for(const actor of actors){await source.query('insert into auth.users(id) values($1)',[actor.id]);if(actor.companies.length){await source.query("insert into neuvetra.companies values($1,'Fictional Company')",[actor.companies[0]]);await source.query('insert into neuvetra.company_members values($1,$2)',[actor.companies[0],actor.id]);await source.query("insert into neuvetra.histories(company_id,actor_id,payload) values($1,$2,'{\"synthetic\":true,\"unknown\":null,\"quantity\":\"1.000\"}')",[actor.companies[0],actor.id])}}
    // Two identical rows deliberately exercise multiset multiplicity.
    await source.exec(`insert into neuvetra.precise_records select '10000000-0000-4000-8000-000000000001',9007199254740992,'{"nested":{"n":9007199254740992,"fraction":0.123456789012345678901234567890}}'::jsonb from generate_series(1,2)`)
    const archivePath=join(root,'synthetic.dpapi'),receiptPath=join(root,'synthetic.receipt.json')
    const receipt=await createHostedSetupBackup({source,sourceMode:'synthetic-local',expectedDatabase:sourceName,actors,archivePath,receiptPath,dump:token=>child([join(BIN,'pg_dump.exe'),'--format=custom','--no-password','--schema=neuvetra',`--snapshot=${token}`],undefined,localEnvironment(sourceName))})
    checks.push('paired-exported-snapshot-backup-dpapi-roundtrip')
    const syntheticSnapshot=JSON.parse((await dpapi('Unprotect',await readFile(archivePath))).toString()) as Snapshot
    requireRecovery(syntheticSnapshot.state.inventory.tables.some(t=>t.name==='empty_history'&&t.count===0),'TEST_EMPTY_TABLE_MISSING')
    for(const [label,mutate] of [
      ['changed-row-hash',(s:any)=>{s.inventory.tables.find((t:any)=>t.name==='histories').rowHashes[0]='0'.repeat(64)}],
      ['missing-zero-row-table',(s:any)=>{s.inventory.tables=s.inventory.tables.filter((t:any)=>t.name!=='empty_history')}],
      ['changed-sequence',(s:any)=>{s.inventory.sequences[0].lastValue='999'}],
      ['changed-policy-catalog',(s:any)=>{s.inventory.tableObjects.find((o:any)=>o.kind==='policy').definition='changed'}],
      ['changed-tenant-access',(s:any)=>{s.tenantAccess[0].count=999}],
    ] as Array<[string,(s:any)=>void]>){const changed=structuredClone(syntheticSnapshot.state);mutate(changed);let refused=false;try{assertPreserved(syntheticSnapshot.state,changed)}catch{refused=true}requireRecovery(refused,'TEST_COMPARATOR_FAILED');checks.push(label)}
    const base:RestoreInput={host:'127.0.0.1',port:55479,role:'supabase_admin',database:`hosted_setup_restore_${stamp}_abcdef12`,archivePath,archiveSha256:receipt.archiveSha256,receiptPath,receiptSha256:sha(await readFile(receiptPath)),pgRestorePath:join(BIN,'pg_restore.exe'),pgRestoreSha256:sha(await readFile(join(BIN,'pg_restore.exe'))),journalPath:join(root,'attempt.json'),resultPath:join(root,'result.json')}
    async function refusal(label:string,input:RestoreInput,code:string){let caught=false;try{await rehearseHostedSetupRestore(input)}catch(e){caught=(e as Error).message.includes(code)}requireRecovery(caught,'TEST_REFUSAL_MISSING');checks.push(label)}
    await refusal('wrong-receipt-hash',{...base,receiptSha256:'0'.repeat(64)},'RECEIPT_PIN_CHANGED')
    await refusal('wrong-archive-hash',{...base,archiveSha256:'0'.repeat(64)},'PAIRED_SOURCE_SNAPSHOT_REQUIRED')
    await refusal('hosted-target-refused',{...base,host:'example.com' as any},'LOCAL_TARGET_REQUIRED')
    await refusal('wrong-role-refused',{...base,role:'postgres' as any},'LOCAL_TARGET_REQUIRED')
    const tampered=join(root,'tampered.dpapi');await writeFile(tampered,Buffer.from('not the archive'))
    await refusal('wrong-archive-bytes',{...base,archivePath:tampered},'ARCHIVE_PIN_CHANGED')
    const oldReceipt=join(root,'old-receipt.json');await writeFile(oldReceipt,JSON.stringify({status:'encrypted_backup_verified',sha256:receipt.dumpSha256}))
    await refusal('unpaired-legacy-archive-refused-before-unseal',{...base,receiptPath:oldReceipt,receiptSha256:sha(await readFile(oldReceipt))},'PAIRED_SOURCE_SNAPSHOT_REQUIRED')
    await rehearseHostedSetupRestore(base);checks.push('native-pg17-restore-rows-catalog-sequences-auth-and-tenant-read-comparison')
    await refusal('durable-no-replay',base,'EEXIST')
    await refusal('occupied-target',{...base,journalPath:join(root,'occupied.json')},'OCCUPIED_TARGET_REFUSED')
    await db.exec('alter role neuvetra_runtime bypassrls')
    await refusal('role-attribute-drift',{...base,database:`hosted_setup_restore_${stamp}_abcdef13`,journalPath:join(root,'role.json')},'OWNER_ROLE_BOUNDARY_CHANGED')
    await db.exec('alter role neuvetra_runtime nobypassrls')
    const restored=createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55479/${base.database}`,{tls:false,maxConnections:1})
    try{
      const count=(await restored.query<{n:string}>('select count(*)::text n from neuvetra.histories')).rows[0]?.n;requireRecovery(count==='2','NATIVE_ROW_COUNT_FAILED')
      const capture=()=>restored.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return captureState(tx,actors)})
      const baseline=await capture();assertPreserved(syntheticSnapshot.state,baseline)
      const original="9007199254740992",changed="9007199254740993"
      const originalJson='{"nested":{"n":9007199254740992,"fraction":0.123456789012345678901234567890}}'
      const changedJson='{"nested":{"n":9007199254740993,"fraction":0.123456789012345678901234567890}}'
      const fractionalJson='{"nested":{"n":9007199254740992,"fraction":0.123456789012345678901234567891}}'
      for(const [label,amount,payload] of [
        ['native-numeric-near-collision',changed,originalJson],
        ['native-nested-jsonb-integer-near-collision',original,changedJson],
        ['native-nested-jsonb-fraction-near-collision',original,fractionalJson],
        ['native-numeric-fraction-precision','0.123456789012345678901234567890',originalJson],
      ]){
        await restored.query('update neuvetra.precise_records set amount=$1::text::numeric,payload=$2::text::jsonb',[amount,payload])
        const actual=(await restored.query<{amount:string;payload:string}>('select amount::text amount,payload::text payload from neuvetra.precise_records limit 1')).rows[0]!
        requireRecovery(actual.amount===amount,'TEST_LOSSLESS_READBACK_FAILED')
        const after=await capture();let rejected=false;try{assertPreserved(baseline,after)}catch{rejected=true}
        requireRecovery(rejected&&hash(after.tenantAccess)!==hash(baseline.tenantAccess),'TEST_PRECISION_REGRESSION')
        checks.push(label)
        await restored.query('update neuvetra.precise_records set amount=$1::text::numeric,payload=$2::text::jsonb',[original,originalJson])
        assertPreserved(baseline,await capture())
      }
      await restored.exec('update neuvetra.precise_records set amount=0.123456789012345678901234567890')
      const fractionalBaseline=await capture()
      await restored.exec('update neuvetra.precise_records set amount=0.123456789012345678901234567891')
      const fractionalAfter=await capture();let fractionalRefused=false;try{assertPreserved(fractionalBaseline,fractionalAfter)}catch{fractionalRefused=true}
      requireRecovery(fractionalRefused&&hash(fractionalAfter.tenantAccess)!==hash(fractionalBaseline.tenantAccess),'TEST_NUMERIC_FRACTION_COLLISION')
      checks.push('native-numeric-fraction-near-collision')
      await restored.query('update neuvetra.precise_records set amount=$1::text::numeric',[original]);assertPreserved(baseline,await capture())
      await restored.exec('delete from neuvetra.precise_records where ctid=(select ctid from neuvetra.precise_records limit 1)')
      let duplicateRefused=false;try{assertPreserved(baseline,await capture())}catch{duplicateRefused=true}
      requireRecovery(duplicateRefused,'TEST_DUPLICATE_MULTIPLICITY_FAILED');checks.push('native-identical-row-multiplicity')
      await restored.query('insert into neuvetra.precise_records values($1,$2::text::numeric,$3::text::jsonb)',[actors[0].companies[0],original,originalJson]);assertPreserved(baseline,await capture())
      async function unsupported(label:string,create:string,cleanup:string){
        await restored.exec(create)
        let refused=false;try{await capture()}catch(e){refused=(e as Error).message==='HS_RECOVERY_UNSUPPORTED_RELATION_SURFACE'}
        requireRecovery(refused,'TEST_UNSUPPORTED_SURFACE_ACCEPTED');checks.push(label)
        await restored.exec(cleanup);assertPreserved(baseline,await capture())
      }
      // A real granted owner-security view leaks to outsider: refuse it before evidence.
      await restored.exec('create view neuvetra.unsafe_view as select amount+1 amount from neuvetra.precise_records;grant select on neuvetra.unsafe_view to neuvetra_runtime')
      const outsiderRows=await restored.transaction(async tx=>{await tx.exec('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors[2].id]);return (await tx.query('select amount::text from neuvetra.unsafe_view')).rows.length})
      requireRecovery(outsiderRows===2,'TEST_VIEW_LEAK_NOT_EXERCISED')
      for(const addition of ['1','2']){
        await restored.exec(`create or replace view neuvetra.unsafe_view as select amount+${addition} amount from neuvetra.precise_records`)
        let refused=false;try{await capture()}catch(e){refused=(e as Error).message==='HS_RECOVERY_UNSUPPORTED_RELATION_SURFACE'}
        requireRecovery(refused,'TEST_VIEW_ACCEPTED')
      }
      checks.push('native-granted-view-outsider-leak-and-definition-change-refused')
      await restored.exec('drop view neuvetra.unsafe_view')
      await unsupported('native-materialized-view-refused','create materialized view neuvetra.materialized_records as select amount from neuvetra.precise_records','drop materialized view neuvetra.materialized_records')
      await unsupported('native-partitioned-relation-refused','create table neuvetra.partitioned_records(id int) partition by range(id);create table neuvetra.partitioned_records_one partition of neuvetra.partitioned_records for values from(0) to(100)','drop table neuvetra.partitioned_records')
      await unsupported('native-inherited-relation-refused','create table neuvetra.inherited_records(extra text) inherits(neuvetra.precise_records)','drop table neuvetra.inherited_records')
      // No FDW server connection is opened; the relation gate must precede access.
      await restored.exec('create foreign data wrapper recovery_test_fdw;create server recovery_test_server foreign data wrapper recovery_test_fdw')
      await unsupported('native-foreign-table-refused-without-access','create foreign table neuvetra.foreign_records(id int) server recovery_test_server','drop foreign table neuvetra.foreign_records')
      await restored.exec('drop server recovery_test_server;drop foreign data wrapper recovery_test_fdw')
    }finally{await restored.close()}
    await source.exec('create view neuvetra.backup_view as select amount from neuvetra.precise_records;grant select on neuvetra.backup_view to neuvetra_runtime')
    let dumpCalled=false,backupRefused=false
    try{await createHostedSetupBackup({source,sourceMode:'synthetic-local',expectedDatabase:sourceName,actors,archivePath:join(root,'unsupported.dpapi'),receiptPath:join(root,'unsupported.receipt.json'),dump:async()=>{dumpCalled=true;return new Uint8Array()}})}catch(e){backupRefused=(e as Error).message==='HS_RECOVERY_UNSUPPORTED_RELATION_SURFACE'}
    requireRecovery(backupRefused&&!dumpCalled,'TEST_SOURCE_VIEW_NOT_REFUSED_BEFORE_DUMP');checks.push('native-source-view-refused-before-dump')
    checks.push('independent-direct-native-readback-two-history-rows')
    return {status:'candidate2-synthetic-native-pass',checks,hostedArchiveRead:false,providerAccess:false,requestedCompute:{model:'gpt-6-astra',effort:'high'},observedCompute:null}
  }finally{await source?.close();await db?.close();if(started)await control(['-D',data,'-m','fast','-w','stop'])}
}
if(import.meta.main){try{console.log(JSON.stringify(await run(),null,2))}catch(e){console.error(JSON.stringify({status:'synthetic-native-failed',code:e instanceof Error?e.message:'unknown',completedChecks}));process.exitCode=1}}
