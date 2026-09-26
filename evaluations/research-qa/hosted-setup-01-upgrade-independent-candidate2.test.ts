/** Independent Candidate2 regression: real schema state plus synthetic gate adapters. */
import {test,expect} from 'bun:test'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {PGlite} from '../../packages/neuvetra-database/node_modules/@electric-sql/pglite'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {snapshotHostedSetupDatabase,verifyPostcommitPreservation,fingerprintSha256,HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE,HOSTED_SETUP_PRIOR_DEPLOYMENT,runHostedSetupUpgrade,hash,sha256} from '../../tools/staging/hosted-setup-upgrade'

test('Candidate2 rejects independent sequence/view regressions and source-gate bypasses',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
  const manifest=await readMigrationManifest()
  for(const migration of manifest.slice(0,22))await db.exec(migration.sql)
  await db.exec('create table neuvetra.staging_target(project_ref text,profile text);create table neuvetra.schema_migrations(name text primary key,sha256 text,applied_at timestamptz default now())')
  await db.query('insert into neuvetra.staging_target values($1,$2)',[HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE])
  for(const m of manifest.slice(0,22))await db.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[m.name,m.sha256])
  const before=await snapshotHostedSetupDatabase(db as any),sequence=(before.catalog.sequences[0] as any).name
  expect(sequence).toBeTruthy()
  const sequenceBefore=(await db.query<{last_value:string;is_called:boolean}>(`select last_value::text last_value,is_called from neuvetra.${sequence}`)).rows[0]!
  await db.query('select setval($1::regclass,999,true)',[`neuvetra.${sequence}`])
  expect(fingerprintSha256(await snapshotHostedSetupDatabase(db as any))).not.toBe(fingerprintSha256(before))
  await db.query('select setval($1::regclass,$2,false)',[`neuvetra.${sequence}`,sequenceBefore.last_value])
  expect(fingerprintSha256(await snapshotHostedSetupDatabase(db as any))).toBe(fingerprintSha256(before))
  await db.query('select setval($1::regclass,$2,true)',[`neuvetra.${sequence}`,sequenceBefore.last_value])
  expect(fingerprintSha256(await snapshotHostedSetupDatabase(db as any))).not.toBe(fingerprintSha256(before))
  await db.query('select setval($1::regclass,$2,$3)',[`neuvetra.${sequence}`,sequenceBefore.last_value,sequenceBefore.is_called])
  await db.exec(manifest[22]!.sql);await db.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[manifest[22]!.name,manifest[22]!.sha256])
  const after=await snapshotHostedSetupDatabase(db as any)
  expect(()=>verifyPostcommitPreservation(before,after,manifest)).not.toThrow()
  for(const [value,called] of [['999',false],[sequenceBefore.last_value,true]] as const){
   await db.query('select setval($1::regclass,$2,$3)',[`neuvetra.${sequence}`,value,called])
   const drift=await snapshotHostedSetupDatabase(db as any)
   expect(()=>verifyPostcommitPreservation(before,drift,manifest)).toThrow('Legacy sequences changed')
  }
  await db.query('select setval($1::regclass,$2,$3)',[`neuvetra.${sequence}`,sequenceBefore.last_value,sequenceBefore.is_called])
  await db.exec(`insert into auth.users values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
   insert into neuvetra.companies(id,name,country_code,state_code,created_by) values('10000000-0000-4000-8000-000000000001','Synthetic QA','US','CA','00000000-0000-4000-8000-000000000001');
   insert into neuvetra.company_members(company_id,user_id,role) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','owner');
   create view neuvetra.qa_view with(security_invoker=true) as select id from neuvetra.companies;grant select on neuvetra.qa_view to neuvetra_runtime`)
  const outsiderRead=()=>db.transaction(async tx=>{await tx.exec('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",['00000000-0000-4000-8000-000000000002']);return(await tx.query('select id from neuvetra.qa_view')).rows.length})
  expect(await outsiderRead()).toBe(0);await expect(snapshotHostedSetupDatabase(db as any)).rejects.toThrow('Unsupported view, partition, inheritance or foreign relation')
  await db.exec('alter view neuvetra.qa_view set(security_invoker=false)')
  expect(await outsiderRead()).toBe(1);await expect(snapshotHostedSetupDatabase(db as any)).rejects.toThrow('Unsupported view, partition, inheritance or foreign relation')

  // These adapter bindings are explicitly synthetic, not accepted hosted evidence.
  const artifact=(bytes:string)=>({bytes,sha256:sha256(bytes)})
  const input:any={profile:'neuvetra.hosted-setup.upgrade-input.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,reviewedProductHead:'a'.repeat(40),operatorId:'synthetic-operator',independentReviewerId:'synthetic-reviewer',journalPath:join(tmpdir(),'unused-upgrade-qa-candidate2.jsonl')}
  for(const key of ['restoreReceipt','restoreReview','fingerprintDerivation','fingerprintDerivationReview','publicationReceipt','publicationReview','stopReceipt','stopReview'])input[key]=artifact(JSON.stringify({synthetic:key}))
  const restore:any={profile:'neuvetra.hosted-setup.accepted-restore-binding.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,sourceSnapshotSha256:'1'.repeat(64),sourceArchiveSha256:'2'.repeat(64),sourceStateSha256:'3'.repeat(64),restoredStateSha256:'3'.repeat(64),expectedDatabaseFingerprintSha256:fingerprintSha256(before),databaseFingerprintIndependentlyDerived:true,exactApplicationPreserved:true,tenantControlsVerified:true,operatorId:input.operatorId,independentReviewerId:input.independentReviewerId,materialFindingsOpen:0}
  for(const key of ['restoreReceipt','restoreReview','fingerprintDerivation','fingerprintDerivationReview'])restore[key+'Sha256']=input[key].sha256
  const publication={profile:'neuvetra.hosted-setup.reviewed-product-head-binding.v1',projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:input.reviewedProductHead,remoteHead:input.reviewedProductHead,requiredChecksPassed:true,publicationReceiptSha256:input.publicationReceipt.sha256,publicationReviewSha256:input.publicationReview.sha256,migrationManifestSha256:hash(manifest),sourceClosureSha256:'4'.repeat(64),independentReviewerId:input.independentReviewerId,materialFindingsOpen:0}
  const stop={profile:'neuvetra.hosted-setup.held-write-gate.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,deployedApplicationCommit:HOSTED_SETUP_PRIOR_DEPLOYMENT,applicationStopped:true,writeGateHeld:true,stopReceiptSha256:input.stopReceipt.sha256,stopReviewSha256:input.stopReview.sha256,operatorId:input.operatorId,independentReviewerId:input.independentReviewerId,materialFindingsOpen:0}
  for(const mode of ['missing-wrapper','wrapper-refuses','callback-twice','manifest-changed','source-pin-missing','success']){
   const events:any[]=[];let migrations=0,snapshots=0,sourceCalls=0
   const deps:any={verifyAcceptedRestore:()=>restore,verifyReviewedProductHead:()=>({...publication,...(mode==='manifest-changed'?{migrationManifestSha256:'f'.repeat(64)}:{}),...(mode==='source-pin-missing'?{sourceClosureSha256:undefined}:{})}),currentProductHead:()=>input.reviewedProductHead,verifyHeldWriteGate:()=>stop,openJournal:async()=>({append:async(v:any)=>{events.push(v)},close:async()=>{}}),migrationManifest:async()=>manifest,snapshot:async()=>++snapshots===1?before:after,migrate:async()=>{migrations++;return{schemaVersion:23,migrations:manifest}}}
   if(mode!=='missing-wrapper')deps.withImmutableMigrationSource=async(binding:any,operation:any)=>{sourceCalls++;expect(binding).toEqual({reviewedProductHead:input.reviewedProductHead,migrationManifestSha256:hash(manifest),sourceClosureSha256:'4'.repeat(64)});if(mode==='wrapper-refuses')throw Error('synthetic source refusal');const value=await operation();if(mode==='callback-twice')await operation();return value}
   if(mode==='success'){
    const receipt=await runHostedSetupUpgrade({} as any,input,deps);expect(receipt.status).toBe('hosted_setup_schema23_committed_and_observed');expect(migrations).toBe(1);expect(sourceCalls).toBe(1)
   }else{
    const code=mode==='manifest-changed'?'Reviewed migration manifest bytes changed':mode==='source-pin-missing'?'Reviewed executable source closure required':mode==='callback-twice'?'hosted_setup_commit_outcome_unknown_do_not_retry':'hosted_setup_upgrade_refused_no_retry_on_this_journal'
    await expect(runHostedSetupUpgrade({} as any,input,deps)).rejects.toThrow(code)
    expect(migrations).toBe(mode==='callback-twice'?1:0)
    if(['manifest-changed','source-pin-missing'].includes(mode)){expect(events.length).toBe(0);expect(snapshots).toBe(0)}else{expect(events.at(-1).status).toBe(code)}
   }
  }
 }finally{await db.close()}
},30000)
