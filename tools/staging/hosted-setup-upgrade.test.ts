import {expect,test} from 'bun:test'
import {mkdtemp,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {PGlite} from '../../packages/neuvetra-database/node_modules/@electric-sql/pglite'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'
import {STAGING_MIGRATIONS,readMigrationManifest as readActualMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {
 CHANGED_GEOGRAPHY_CONSTRAINTS,EXPECTED_GEOGRAPHY_CONSTRAINT_DEFINITIONS,HOSTED_SETUP_PRIOR_DEPLOYMENT,HOSTED_SETUP_PROFILE,HOSTED_SETUP_PROJECT,
 NEW_SETUP_TABLES,exclusiveUpgradeJournal,fingerprintSha256,hash,hashDatabaseJsonText,runHostedSetupUpgrade,sha256,snapshotHostedSetupDatabase,verifyPostcommitPreservation,
 type AcceptedRestoreBinding,type DurableJournal,type HeldApplicationWriteGate,type HostedSetupFingerprint,type HostedSetupUpgradeInput,type ImmutableMigrationSourceBinding,type PinnedArtifact,type ReviewedProductHeadBinding,
}from './hosted-setup-upgrade'

const manifest=STAGING_MIGRATIONS.map((name,index)=>{const sql=`select ${index}`;return{name,sha256:sha256(sql),sql}})
const row=(name:string,values:unknown[])=>({name,count:values.length,rowHashes:values.map(hash).sort(),sha256:hash(values.map(hash).sort())})
const geography=(current=false)=>CHANGED_GEOGRAPHY_CONSTRAINTS.map(key=>{const [table_name,name]=key.split('.')as[string,string];return{table_name,name,definition:current?EXPECTED_GEOGRAPHY_CONSTRAINT_DEFINITIONS[key]:`CHECK (old_${name})`}})
function before():HostedSetupFingerprint{
 const receipts=manifest.slice(0,22).map(({name,sha256})=>({name,sha256}))
 return {profile:'neuvetra.hosted-setup.database-fingerprint.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,receipts,
  tables:[row('companies',[{id:'legacy-company'}]),row('facilities',[{id:'legacy-facility'}]),row('schema_migrations',receipts)],
  catalog:{tables:[{name:'companies'},{name:'facilities'},{name:'schema_migrations'}],columns:[{table_name:'companies',name:'id'},{table_name:'facilities',name:'id'},{table_name:'schema_migrations',name:'name'}],constraints:geography(),indexes:[],policies:[],triggers:[],functions:[{signature:'neuvetra.legacy()'}],sequences:[{name:'fugitive_audit_sequence_seq',owner:'postgres',last_value:'1',is_called:false}],schema:[{name:'neuvetra'}],roles:[{name:'postgres'}],memberships:[],defaultAcls:[],dependencies:[{schema:'auth',relation:'users'}]}}
}
function after(source=before()):HostedSetupFingerprint{
 const receipts=manifest.map(({name,sha256})=>({name,sha256})),tables=source.tables.map(table=>structuredClone(table))
 const migrationTable=tables.find(table=>table.name==='schema_migrations')!,receiptHash=hash(receipts[22])
 migrationTable.rowHashes.push(receiptHash);migrationTable.rowHashes.sort();migrationTable.count++;migrationTable.sha256=hash(migrationTable.rowHashes)
 for(const name of NEW_SETUP_TABLES)tables.push(row(name,[]))
 return {...structuredClone(source),schemaVersion:23,receipts,tables,catalog:{...structuredClone(source.catalog),tables:[...structuredClone(source.catalog.tables),...NEW_SETUP_TABLES.map(name=>({name}))],constraints:geography(true),functions:[...structuredClone(source.catalog.functions),{signature:'neuvetra.save_company_setup(uuid,jsonb)'}]}}
}
const artifact=(bytes:string)=>({bytes,sha256:sha256(bytes)})
function input():HostedSetupUpgradeInput{return{profile:'neuvetra.hosted-setup.upgrade-input.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,reviewedProductHead:'a'.repeat(40),operatorId:'operator',restoreReviewerId:'restore-reviewer',publicationReviewerId:'publication-reviewer',stopReviewerId:'stop-reviewer',journalPath:join(tmpdir(),'unused-hosted-setup-upgrade.jsonl'),restoreReceipt:artifact('{"restore":true}\n'),restoreReview:artifact('{"accepted":true}\n'),fingerprintDerivation:artifact('{"fingerprint":true}\n'),fingerprintDerivationReview:artifact('{"accepted":true}\n'),publicationReceipt:artifact('{"head":true}\n'),publicationReview:artifact('{"accepted":true}\n'),stopReceipt:artifact('{"stopped":true}\n'),stopReview:artifact('{"accepted":true}\n')}}
function restore(i:HostedSetupUpgradeInput,b=before()):AcceptedRestoreBinding{return{profile:'neuvetra.hosted-setup.accepted-restore-binding.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,restoreReceiptSha256:i.restoreReceipt.sha256,restoreReviewSha256:i.restoreReview.sha256,fingerprintDerivationSha256:i.fingerprintDerivation.sha256,fingerprintDerivationReviewSha256:i.fingerprintDerivationReview.sha256,sourceSnapshotSha256:'1'.repeat(64),sourceArchiveSha256:'2'.repeat(64),sourceStateSha256:'3'.repeat(64),restoredStateSha256:'3'.repeat(64),expectedDatabaseFingerprintSha256:fingerprintSha256(b),databaseFingerprintIndependentlyDerived:true,exactApplicationPreserved:true,tenantControlsVerified:true,operatorId:i.operatorId,independentReviewerId:i.restoreReviewerId,materialFindingsOpen:0}}
function publication(i:HostedSetupUpgradeInput):ReviewedProductHeadBinding{return{profile:'neuvetra.hosted-setup.reviewed-product-head-binding.v1',projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:i.reviewedProductHead,remoteHead:i.reviewedProductHead,requiredChecksPassed:true,publicationReceiptSha256:i.publicationReceipt.sha256,publicationReviewSha256:i.publicationReview.sha256,migrationManifestSha256:hash(manifest),sourceClosureSha256:'4'.repeat(64),independentReviewerId:i.publicationReviewerId,materialFindingsOpen:0}}
function stopped(i:HostedSetupUpgradeInput):HeldApplicationWriteGate{return{profile:'neuvetra.hosted-setup.held-write-gate.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,deployedApplicationCommit:HOSTED_SETUP_PRIOR_DEPLOYMENT,applicationStopped:true,writeGateHeld:true,stopReceiptSha256:i.stopReceipt.sha256,stopReviewSha256:i.stopReview.sha256,operatorId:i.operatorId,independentReviewerId:i.stopReviewerId,materialFindingsOpen:0}}
const gate=(binding:HeldApplicationWriteGate)=>({binding,observeHeld:async()=>true as const})
const encoded=(value:unknown)=>JSON.stringify(value)
function journal(events:unknown[],failAt=0):DurableJournal{return{append:async value=>{if(failAt===events.length+1)throw Error('durability');events.push(value)},close:async()=>{}}}
function withImmutable<T>(_binding:ImmutableMigrationSourceBinding,operation:()=>Promise<T>){return operation()}
const db={}as WorkspaceConnection

test('postcommit comparison admits only the reviewed additive schema-23 delta',()=>{
 const a=before(),b=after(a);expect(()=>verifyPostcommitPreservation(a,b,manifest)).not.toThrow()
 const mutations:Array<[string,(value:HostedSetupFingerprint)=>void]>=[
  ['legacy row',value=>value.tables.find(table=>table.name==='companies')!.rowHashes[0]='f'.repeat(64)],
  ['new table content',value=>{const table=value.tables.find(table=>table.name===NEW_SETUP_TABLES[0])!;table.count=1;table.rowHashes=[hash('unexpected')]}],
  ['unexpected table',value=>value.tables.push(row('unexpected_table',[]))],
  ['legacy column',value=>(value.catalog.columns[0]as any).name='changed'],
  ['sequence last value',value=>(value.catalog.sequences[0]as any).last_value='999'],
  ['sequence called flag',value=>(value.catalog.sequences[0]as any).is_called=true],
  ['geography constraint',value=>value.catalog.constraints.find(item=>item.name==='companies_country_code_check')!.definition='CHECK (true)'],
  ['legacy function',value=>(value.catalog.functions[0]as any).signature='neuvetra.changed()'],
  ['role',value=>value.catalog.roles.push({name:'new-role'})],
  ['receipt',value=>value.receipts[22]!.sha256='f'.repeat(64)],
 ]
 for(const [label,mutate]of mutations){const value=after(a);mutate(value);let refused=false;try{verifyPostcommitPreservation(a,value,manifest)}catch{refused=true}expect(refused,label).toBeTrue()}
})

test('database JSON text hashing preserves numeric precision beyond JavaScript safe integers',()=>{
 const left='{"amount":9007199254740992.0000000000000001}',right='{"amount":9007199254740992.0000000000000002}'
 expect(JSON.parse(left).amount).toBe(JSON.parse(right).amount);expect(hashDatabaseJsonText(left)).not.toBe(hashDatabaseJsonText(right))
})

test('actual migration preserves sequence state, emits exact constraints and rejects outsider-readable views',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
  const actualManifest=await readActualMigrationManifest()
  for(const migration of actualManifest.slice(0,22))await db.exec(migration.sql)
  await db.exec('create table neuvetra.staging_target(project_ref text,profile text);create table neuvetra.schema_migrations(name text primary key,sha256 text,applied_at timestamptz default now())')
  await db.query('insert into neuvetra.staging_target values($1,$2)',[HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE])
  for(const migration of actualManifest.slice(0,22))await db.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[migration.name,migration.sha256])
  const schema22=await snapshotHostedSetupDatabase(db as any),sequence=schema22.catalog.sequences.find(item=>(item as any).name==='fugitive_audit_sequence_seq')as any
  expect(sequence).toMatchObject({last_value:'1',is_called:false})
  await db.query('select setval($1::regclass,999,true)', ['neuvetra.fugitive_audit_sequence_seq'])
  const sequenceDrift=await snapshotHostedSetupDatabase(db as any);expect(fingerprintSha256(sequenceDrift)).not.toBe(fingerprintSha256(schema22));expect((sequenceDrift.catalog.sequences.find(item=>(item as any).name==='fugitive_audit_sequence_seq')as any)).toMatchObject({last_value:'999',is_called:true})
  await db.query('select setval($1::regclass,$2,$3)', ['neuvetra.fugitive_audit_sequence_seq',sequence.last_value,sequence.is_called])
  await db.exec(actualManifest[22]!.sql);await db.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[actualManifest[22]!.name,actualManifest[22]!.sha256])
  const schema23=await snapshotHostedSetupDatabase(db as any);expect(()=>verifyPostcommitPreservation(schema22,schema23,actualManifest)).not.toThrow()
  const definitions=(await db.query<{table_name:string;name:string;definition:string}>("select c.relname table_name,k.conname name,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relname in('companies','facilities') and k.conname in('companies_country_code_check','companies_state_code_check','facilities_country_code_check','facilities_state_code_check') order by 1,2")).rows
  expect(Object.fromEntries(definitions.map(row=>[`${row.table_name}.${row.name}`,row.definition]))).toEqual(EXPECTED_GEOGRAPHY_CONSTRAINT_DEFINITIONS)
  await db.exec('create table precision_probe(amount numeric); insert into precision_probe values(9007199254740992.0000000000000001),(9007199254740992.0000000000000002)')
  const exact=(await db.query<{value:string}>('select to_jsonb(t)::text value from precision_probe t order by amount')).rows.map(row=>row.value)
  expect(exact).toEqual(['{"amount": 9007199254740992.0000000000000001}','{"amount": 9007199254740992.0000000000000002}']);expect(new Set(exact.map(hashDatabaseJsonText)).size).toBe(2)
  await db.exec(`insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
    insert into neuvetra.companies(id,name,country_code,state_code,created_by) values('10000000-0000-4000-8000-000000000001','Synthetic QA','US','CA','00000000-0000-4000-8000-000000000001');
    insert into neuvetra.company_members(company_id,user_id,role) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner');
    create view neuvetra.qa_view with(security_invoker=true) as select id from neuvetra.companies;grant select on neuvetra.qa_view to neuvetra_runtime`)
  const outsiderRead=()=>db.transaction(async tx=>{await tx.exec('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",['00000000-0000-4000-8000-000000000002']);return(await tx.query('select id from neuvetra.qa_view')).rows.length})
  expect(await outsiderRead()).toBe(0);await expect(snapshotHostedSetupDatabase(db as any)).rejects.toThrow('Unsupported view, partition, inheritance or foreign relation')
  await db.exec('alter view neuvetra.qa_view set(security_invoker=false)');expect(await outsiderRead()).toBe(1);await expect(snapshotHostedSetupDatabase(db as any)).rejects.toThrow('Unsupported view, partition, inheritance or foreign relation')
 }finally{await db.close()}
},30000)

test('runner requires concrete accepted restore and held stop-review bindings before database work',async()=>{
 const i=input(),events:unknown[]=[];let snapshots=0
 await expect(runHostedSetupUpgrade(db,i,{verifyAcceptedRestore:()=>{throw Error('paired restore contract pending')},verifyReviewedProductHead:()=>publication(i),currentProductHead:()=>i.reviewedProductHead,verifyHeldWriteGate:()=>gate(stopped(i)),withImmutableMigrationSource:withImmutable,openJournal:async()=>journal(events),migrationManifest:()=>manifest,snapshot:async()=>{snapshots++;return encoded(before())},migrate:async()=>encoded({schemaVersion:23,migrations:manifest})})).rejects.toThrow('paired restore contract pending')
 expect(events).toHaveLength(0);expect(snapshots).toBe(0)
 const changed=input();changed.restoreReceipt.bytes+='changed'
 await expect(runHostedSetupUpgrade(db,changed,{verifyAcceptedRestore:()=>restore(changed),verifyReviewedProductHead:()=>publication(changed),currentProductHead:()=>changed.reviewedProductHead,verifyHeldWriteGate:()=>gate(stopped(changed)),withImmutableMigrationSource:withImmutable})).rejects.toThrow('Restore receipt digest')
 const stale=input();await expect(runHostedSetupUpgrade(db,stale,{verifyAcceptedRestore:()=>restore(stale),verifyReviewedProductHead:()=>publication(stale),currentProductHead:()=> 'b'.repeat(40),verifyHeldWriteGate:()=>gate(stopped(stale)),withImmutableMigrationSource:withImmutable})).rejects.toThrow('Current, reviewed and remote heads differ')
 const changedManifest=input(),changedPublication=publication(changedManifest);changedPublication.migrationManifestSha256='f'.repeat(64);await expect(runHostedSetupUpgrade(db,changedManifest,{verifyAcceptedRestore:()=>restore(changedManifest),verifyReviewedProductHead:()=>changedPublication,currentProductHead:()=>changedManifest.reviewedProductHead,verifyHeldWriteGate:()=>gate(stopped(changedManifest)),withImmutableMigrationSource:withImmutable,migrationManifest:()=>manifest,migrate:async()=>encoded({schemaVersion:23,migrations:manifest})})).rejects.toThrow('Reviewed migration manifest bytes changed')
})

test('runner binds each independent review to its actual reviewer identity',async()=>{
 const i=input(),base={currentProductHead:()=>i.reviewedProductHead,withImmutableMigrationSource:withImmutable}
 const wrongRestore=restore(i);wrongRestore.independentReviewerId=i.publicationReviewerId
 await expect(runHostedSetupUpgrade(db,i,{...base,verifyAcceptedRestore:()=>wrongRestore,verifyReviewedProductHead:()=>publication(i),verifyHeldWriteGate:()=>gate(stopped(i))})).rejects.toThrow('Restore review identities differ')
 const wrongPublication=publication(i);wrongPublication.independentReviewerId=i.stopReviewerId
 await expect(runHostedSetupUpgrade(db,i,{...base,verifyAcceptedRestore:()=>restore(i),verifyReviewedProductHead:()=>wrongPublication,verifyHeldWriteGate:()=>gate(stopped(i))})).rejects.toThrow('Publication review not accepted')
 const wrongStop=stopped(i);wrongStop.independentReviewerId=i.restoreReviewerId
 await expect(runHostedSetupUpgrade(db,i,{...base,verifyAcceptedRestore:()=>restore(i),verifyReviewedProductHead:()=>publication(i),verifyHeldWriteGate:()=>gate(wrongStop)})).rejects.toThrow('Stop review identities differ')
})

test('runner records exact preflight, one migration and verified postcommit result',async()=>{
 const i=input(),a=before(),b=after(a),events:any[]=[];let snapshots=0,migrations=0
 let stopChecks=0,immutableCalls=0
 const result=await runHostedSetupUpgrade(db,i,{verifyAcceptedRestore:()=>restore(i,a),verifyReviewedProductHead:()=>publication(i),currentProductHead:()=>i.reviewedProductHead,verifyHeldWriteGate:()=>{stopChecks++;return gate(stopped(i))},withImmutableMigrationSource:async(binding,operation)=>{immutableCalls++;expect(binding).toEqual({reviewedProductHead:i.reviewedProductHead,migrationManifestSha256:hash(manifest),sourceClosureSha256:'4'.repeat(64)});return operation()},openJournal:async()=>journal(events),migrationManifest:()=>manifest,snapshot:async()=>encoded(++snapshots===1?a:b),migrate:async(_db,project)=>{migrations++;expect(project).toBe(HOSTED_SETUP_PROJECT);return encoded({schemaVersion:23,migrations:manifest})},now:()=> '2026-09-26T12:00:00.000Z'})
 expect(result.status).toBe('hosted_setup_schema23_committed_and_observed');expect(result.legacyRowsPreserved).toBeTrue();expect(events.map(event=>event.status)).toEqual(['hosted_setup_upgrade_reserved','hosted_setup_schema22_preflight_passed','hosted_setup_schema23_committed_and_observed']);expect(snapshots).toBe(2);expect(migrations).toBe(1);expect(stopChecks).toBe(3);expect(immutableCalls).toBe(1)
})

test('runner retains invocation-time input and artifact bytes across verifier awaits',async()=>{
 const i=input(),original=structuredClone(i),a=before(),b=after(a),events:unknown[]=[]
 let release!:()=>void,artifactReads=0
 const pending=new Promise<void>(resolve=>{release=resolve})
 const originalBytes=i.restoreReceipt.bytes
 i.restoreReceipt={
  get bytes(){artifactReads++;return artifactReads===1?originalBytes:'forged-after-entry'},
  sha256:i.restoreReceipt.sha256,
 }as PinnedArtifact
 let receivedReceipt=''
 const running=runHostedSetupUpgrade(db,i,{
  verifyAcceptedRestore:(receipt)=>{receivedReceipt=receipt.bytes;return restore(original,a)},
  verifyReviewedProductHead:()=>publication(original),currentProductHead:async()=>{await pending;return original.reviewedProductHead},
  verifyHeldWriteGate:()=>gate(stopped(original)),withImmutableMigrationSource:withImmutable,
  openJournal:async()=>journal(events),migrationManifest:()=>manifest,
  snapshot:async()=>encoded(events.length===1?a:b),
  migrate:async()=>encoded({schemaVersion:23,migrations:manifest}),
 })
 i.reviewedProductHead='b'.repeat(40);i.operatorId='changed';i.restoreReview.bytes='forged';i.publicationReceipt.bytes='forged'
 release()
 const result=await running
 expect(result.status).toBe('hosted_setup_schema23_committed_and_observed')
 expect(receivedReceipt).toBe(originalBytes)
 expect(artifactReads).toBe(1)
 expect(events).toHaveLength(3)
})

test('runner retains validated restore, publication and stop scalars across later callbacks',async()=>{
 const i=input(),accepted=before(),changed=before(),events:any[]=[]
 changed.tables.find(table=>table.name==='companies')!.rowHashes[0]='f'.repeat(64)
 const restoreResult=restore(i,accepted),productResult=publication(i),stopResult=stopped(i)
 let migrations=0
 await expect(runHostedSetupUpgrade(db,i,{
  verifyAcceptedRestore:()=>restoreResult,
  verifyReviewedProductHead:()=>{restoreResult.expectedDatabaseFingerprintSha256=fingerprintSha256(changed);return productResult},
  currentProductHead:()=>i.reviewedProductHead,
  verifyHeldWriteGate:()=>gate(stopResult),
  withImmutableMigrationSource:withImmutable,openJournal:async()=>journal(events),migrationManifest:()=>manifest,
  snapshot:async()=>encoded(changed),migrate:async()=>{migrations++;return encoded({schemaVersion:23,migrations:manifest})},
 })).rejects.toThrow('hosted_setup_upgrade_refused_no_retry_on_this_journal')
 expect(migrations).toBe(0)
 const cleanEvents:any[]=[];let closure=''
 const result=await runHostedSetupUpgrade(db,i,{
  verifyAcceptedRestore:()=>restore(i,accepted),verifyReviewedProductHead:()=>productResult,
  currentProductHead:()=>i.reviewedProductHead,verifyHeldWriteGate:()=>gate(stopResult),
  withImmutableMigrationSource:async(binding,operation)=>{closure=binding.sourceClosureSha256;return operation()},
  migrationManifest:()=>{productResult.sourceClosureSha256='5'.repeat(64);return manifest},
  openJournal:async()=>journal(cleanEvents),snapshot:async()=>encoded(cleanEvents.length===1?accepted:after(accepted)),
  migrate:async()=>encoded({schemaVersion:23,migrations:manifest}),
 })
 expect(result.status).toBe('hosted_setup_schema23_committed_and_observed')
 expect(closure).toBe('4'.repeat(64))
 expect(cleanEvents[0].sourceClosureSha256).toBe('4'.repeat(64))
 const changedStop=stopped(i),stopEvents:any[]=[]
 await expect(runHostedSetupUpgrade(db,i,{
  verifyAcceptedRestore:()=>restore(i,accepted),verifyReviewedProductHead:()=>publication(i),currentProductHead:()=>i.reviewedProductHead,
  verifyHeldWriteGate:()=>gate(changedStop),withImmutableMigrationSource:withImmutable,
  migrationManifest:()=>{(changedStop as unknown as {writeGateHeld:boolean}).writeGateHeld=false;return manifest},
  openJournal:async()=>journal(stopEvents),snapshot:async()=>encoded(accepted),migrate:async()=>encoded({schemaVersion:23,migrations:manifest}),
 })).rejects.toThrow('hosted_setup_upgrade_refused_no_retry_on_this_journal')
})

test('runner rejects asynchronous object bindings and requires a fresh strict-true gate observation',async()=>{
 const i=input(),a=before(),events:any[]=[];let migrations=0
 const base={
  verifyAcceptedRestore:()=>restore(i,a),verifyReviewedProductHead:()=>publication(i),currentProductHead:()=>i.reviewedProductHead,
  verifyHeldWriteGate:()=>gate(stopped(i)),withImmutableMigrationSource:withImmutable,
  openJournal:async()=>journal(events),migrationManifest:()=>manifest,
  snapshot:async()=>encoded(a),migrate:async()=>{migrations++;return encoded({schemaVersion:23,migrations:manifest})},
 }
 await expect(runHostedSetupUpgrade(db,i,{...base,verifyAcceptedRestore:(()=>Promise.resolve(restore(i,a))) as unknown as typeof base.verifyAcceptedRestore})).rejects.toThrow('Synchronous verifier binding required')
 await expect(runHostedSetupUpgrade(db,i,{...base,verifyReviewedProductHead:(()=>Promise.resolve(publication(i))) as unknown as typeof base.verifyReviewedProductHead})).rejects.toThrow('Synchronous verifier binding required')
 await expect(runHostedSetupUpgrade(db,i,{...base,verifyHeldWriteGate:(()=>Promise.resolve(gate(stopped(i)))) as unknown as typeof base.verifyHeldWriteGate})).rejects.toThrow('Synchronous write-gate binding required')
 await expect(runHostedSetupUpgrade(db,i,{...base,verifyHeldWriteGate:()=>({binding:stopped(i),observeHeld:async()=> 'true' as unknown as true})})).rejects.toThrow('Fresh write-gate observation refused')
 await expect(runHostedSetupUpgrade(db,i,{...base,migrationManifest:(()=>Promise.resolve(manifest)) as unknown as typeof base.migrationManifest})).rejects.toThrow('Synchronous verifier binding required')
 expect(events).toHaveLength(0);expect(migrations).toBe(0)
})

test('runner fixes the outside-repository journal path before callbacks can change cwd',async()=>{
 const originalCwd=process.cwd(),i=input(),a=before(),events:any[]=[]
 i.journalPath='../qa-relative-no-disk.jsonl'
 const expectedPath=resolve(i.journalPath)
 let openedPath=''
 try{
  const result=await runHostedSetupUpgrade(db,i,{
   verifyAcceptedRestore:()=>{process.chdir(join(originalCwd,'tools'));return restore(i,a)},
   verifyReviewedProductHead:()=>publication(i),currentProductHead:()=>i.reviewedProductHead,
   verifyHeldWriteGate:()=>gate(stopped(i)),withImmutableMigrationSource:withImmutable,
   openJournal:async path=>{openedPath=path;return journal(events)},migrationManifest:()=>manifest,
   snapshot:async()=>encoded(events.length===1?a:after(a)),migrate:async()=>encoded({schemaVersion:23,migrations:manifest}),
  })
  expect(result.status).toBe('hosted_setup_schema23_committed_and_observed')
  expect(openedPath).toBe(expectedPath)
 }finally{process.chdir(originalCwd)}
})

test('runner refuses a manifest changed after its reviewed hash was captured',async()=>{
 const i=input(),a=before(),events:any[]=[],returnedManifest=manifest.map(row=>({...row}))
 let migrations=0
 await expect(runHostedSetupUpgrade(db,i,{
  verifyAcceptedRestore:()=>restore(i,a),verifyReviewedProductHead:()=>publication(i),currentProductHead:()=>i.reviewedProductHead,
  verifyHeldWriteGate:()=>gate(stopped(i)),withImmutableMigrationSource:withImmutable,
  migrationManifest:()=>returnedManifest,
  openJournal:async()=>{returnedManifest[22]!.sql='select 999 /* after hash */';returnedManifest[22]!.sha256=sha256(returnedManifest[22]!.sql);return journal(events)},
  snapshot:async()=>encoded(events.length===1?a:after(a)),
  migrate:async()=>{migrations++;return encoded({schemaVersion:23,migrations:returnedManifest})},
 })).rejects.toThrow('hosted_setup_postcommit_reconciliation_required_do_not_retry')
 expect(events[0].migrationManifestSha256).toBe(hash(manifest))
 expect(events.at(-1).status).toBe('hosted_setup_postcommit_reconciliation_required_do_not_retry')
 expect(migrations).toBe(1)
})

test('preflight refusal never migrates; attempted or returned migration can never authorize retry',async()=>{
 const i=input(),a=before()
 for(const mode of ['preflight','source','commit','postcommit','receipt']as const){
  const events:any[]=[];let migrations=0,snapshots=0
  const source=structuredClone(a);if(mode==='preflight')source.projectRef='foreign'
  const changed=after(a);if(mode==='postcommit')changed.tables.find(table=>table.name==='companies')!.rowHashes=[]
  const operation=runHostedSetupUpgrade(db,i,{verifyAcceptedRestore:()=>restore(i,a),verifyReviewedProductHead:()=>publication(i),currentProductHead:()=>i.reviewedProductHead,verifyHeldWriteGate:()=>gate(stopped(i)),withImmutableMigrationSource:mode==='source'?async()=>{throw Error('source closure changed')}:withImmutable,openJournal:async()=>journal(events,mode==='receipt'?3:0),migrationManifest:()=>manifest,snapshot:async()=>encoded(++snapshots===1?source:changed),migrate:async()=>{migrations++;if(mode==='commit')throw Error('transport lost');return encoded({schemaVersion:23,migrations:manifest})}})
  const expected=['preflight','source'].includes(mode)?'hosted_setup_upgrade_refused_no_retry_on_this_journal':mode==='commit'?'hosted_setup_commit_outcome_unknown_do_not_retry':'hosted_setup_postcommit_reconciliation_required_do_not_retry'
  await expect(operation).rejects.toThrow(expected);expect(migrations).toBe(['preflight','source'].includes(mode)?0:1);expect(events.at(-1)?.status??'').toBe(mode==='receipt'?'hosted_setup_schema22_preflight_passed':expected)
 }
})

test('exclusive journal rejects a second writer and chains synced events',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'hosted-setup-upgrade-')),path=join(directory,'journal.jsonl')
 try{const first=await exclusiveUpgradeJournal(path);await first.append({status:'reserved'});await expect(exclusiveUpgradeJournal(path)).rejects.toMatchObject({code:'EEXIST'});await first.append({status:'outcome'});await first.close();const lines=(await Bun.file(path).text()).trim().split('\n').map(line=>JSON.parse(line));expect(lines).toHaveLength(2);expect(lines[0].sequence).toBe(1);expect(lines[1].previousSha256).toBe(lines[0].sha256);expect(lines[1].sequence).toBe(2)}finally{await rm(directory,{recursive:true,force:true})}
})
