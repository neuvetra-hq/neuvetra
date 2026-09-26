/** Independent QA for the fresh restore binder. Local synthetic PostgreSQL only. */
import {expect,test} from 'bun:test'
import {createServer,createConnection} from 'node:net'
import {mkdtemp,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {createHostedSetupBackup} from '../../tools/staging/hosted-setup-backup'
import {dpapi} from '../../tools/staging/hosted-setup-restore-io'
import {
  PROFILE,PROJECT,assertPreserved,captureState,hash as recoveryHash,normalizedState,sha,
  type Snapshot,type State,
} from '../../tools/staging/hosted-setup-restore-core'
import {
  FINGERPRINT_DERIVATION_INPUT_PROFILE,deriveExpectedHostedSetupFingerprint,
  type FingerprintDerivationInput,type HostedSetupRestoreResult,
} from '../../tools/staging/hosted-setup-fingerprint-derivation'
import {HOSTED_SETUP_PROFILE,hash as fingerprintHash,type PinnedArtifact} from '../../tools/staging/hosted-setup-upgrade'
import {
  FRESH_RESTORE_OBSERVATION_PROFILE,FRESH_RESTORE_POLICY_PROFILE,FRESH_RESTORE_REVIEW_PROFILE,
  freshRestoreReviewSubjectSha256,verifyFreshHostedSetupRestore,
  type FreshRestoreEvidence,type FreshRestorePolicy,type FreshRestoreReview,
} from '../../tools/staging/hosted-setup-fresh-restore-binding'

const actors=[
  {id:'00000000-0000-4000-8000-000000000001',companies:['10000000-0000-4000-8000-000000000001']},
  {id:'00000000-0000-4000-8000-000000000002',companies:[]},
]
const bin='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin'
const historicalArchive='22280e654a823d3922acfa56ddee1bc9ac0c9c17fa1c29fb672671071c488495'

function text(value:unknown):PinnedArtifact{
  const bytes=JSON.stringify(value,null,2)+'\n'
  return {bytes,sha256:sha(bytes)}
}
function retained(bytes:Uint8Array,sha256:string):PinnedArtifact{return{bytes:Buffer.from(bytes).toString('utf8'),sha256}}
function cleanEnv(port:number,database:string,user:string){
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG'))),
    PGHOST:'127.0.0.1',PGPORT:String(port),PGDATABASE:database,PGUSER:user,PGSSLMODE:'disable',PGPASSFILE:'NUL',PGCONNECT_TIMEOUT:'10',
  }
}
async function processOutput(command:string[],stdin?:Uint8Array,env?:Record<string,string|undefined>){
  const child=Bun.spawn(command,{env,stdin:stdin?'pipe':'ignore',stdout:'pipe',stderr:'pipe'})
  const stdout=new Response(child.stdout).arrayBuffer(),stderr=new Response(child.stderr).arrayBuffer()
  if(stdin){await child.stdin!.write(stdin);await child.stdin!.end()}
  const [out,,code]=await Promise.all([stdout,stderr,child.exited])
  if(code!==0)throw Error('QA_NATIVE_CHILD_FAILED_'+code)
  return Buffer.from(out)
}
async function port(){
  return new Promise<number>((resolve,reject)=>{
    const server=createServer()
    server.once('error',reject)
    server.listen(0,'127.0.0.1',()=>{
      const address=server.address(),selected=typeof address==='object'&&address?address.port:0
      server.close(error=>error?reject(error):selected===55479?reject(Error('QA_SHARED_PORT_SELECTED')):resolve(selected))
    })
  })
}
async function listening(selected:number){
  return new Promise<boolean>(resolve=>{
    const socket=createConnection({host:'127.0.0.1',port:selected})
    const done=(value:boolean)=>{socket.destroy();resolve(value)}
    socket.once('connect',()=>done(true));socket.once('error',()=>done(false));socket.setTimeout(1000,()=>done(true))
  })
}

test('actual fresh PostgreSQL 17 restore binds a dynamic reviewed chain and refuses normalization or identity abuse',async()=>{
  const root=await mkdtemp(join(tmpdir(),'hosted-setup-fresh-binding-')),data=join(root,'data'),selected=await port()
  const control=async(args:string[])=>{
    const child=Bun.spawn([join(bin,'pg_ctl.exe'),...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'})
    const code=await child.exited
    if(code!==0)throw Error('QA_CLUSTER_CONTROL_FAILED_'+code)
  }
  let started=false,dumpChild:ReturnType<typeof Bun.spawn>|undefined
  let admin:ReturnType<typeof createPostgresConnection>|undefined
  let source:ReturnType<typeof createPostgresConnection>|undefined
  let runtime:ReturnType<typeof createPostgresConnection>|undefined
  let restored:ReturnType<typeof createPostgresConnection>|undefined
  let snapshotBytes:Buffer|undefined,dumpBytes:Buffer|undefined
  try{
    await processOutput([join(bin,'initdb.exe'),'-D',data,'-U','supabase_admin','--auth=trust','--no-locale','--encoding=UTF8'])
    await control(['-D',data,'-l',join(root,'server.log'),'-o','-h 127.0.0.1 -p '+selected,'-w','start']);started=true
    admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+selected+'/postgres',{tls:false,maxConnections:1})
    await admin.exec('create role neuvetra_runtime login nosuperuser nobypassrls nocreaterole nocreatedb noinherit;create role postgres login nosuperuser bypassrls nocreaterole nocreatedb noinherit;grant create on database postgres to postgres')
    source=createPostgresConnection('postgres://postgres@127.0.0.1:'+selected+'/postgres',{tls:false,maxConnections:1})
    runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:'+selected+'/postgres',{tls:false,maxConnections:1})
    await source.exec("create schema auth authorization postgres;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create schema neuvetra authorization postgres;grant usage on schema auth,neuvetra to neuvetra_runtime")
    await source.exec("create table neuvetra.staging_target(project_ref text,profile text);insert into neuvetra.staging_target values('"+PROJECT+"','"+HOSTED_SETUP_PROFILE+"');create table neuvetra.schema_migrations(name text primary key,sha256 text not null);create table neuvetra.companies(id uuid primary key,name text);create table neuvetra.company_members(company_id uuid references neuvetra.companies(id),user_id uuid references auth.users(id));create table neuvetra.precise_records(company_id uuid references neuvetra.companies(id),amount numeric,payload jsonb);create sequence neuvetra.fugitive_audit_sequence_seq")
    const manifest=await readMigrationManifest();expect(manifest.length).toBeGreaterThanOrEqual(22)
    for(const row of manifest.slice(0,22))await source.query('insert into neuvetra.schema_migrations values($1,$2)',[row.name,row.sha256])
    for(const actor of actors)await source.query('insert into auth.users values($1)',[actor.id])
    await source.query("insert into neuvetra.companies values($1,'QA Company')",[actors[0]!.companies[0]])
    await source.query('insert into neuvetra.company_members values($1,$2)',[actors[0]!.companies[0],actors[0]!.id])
    await source.query("insert into neuvetra.precise_records values($1,$2::text::numeric,$3::text::jsonb)",[actors[0]!.companies[0],'9007199254740993.123456789012345678901','{"nested":{"integer":9007199254740993,"fraction":0.123456789012345678901234567890}}'])
    await source.exec("select setval('neuvetra.fugitive_audit_sequence_seq',9007199254740993,true);alter table neuvetra.companies enable row level security;alter table neuvetra.companies force row level security;alter table neuvetra.company_members enable row level security;alter table neuvetra.company_members force row level security;alter table neuvetra.precise_records enable row level security;alter table neuvetra.precise_records force row level security")
    await source.exec("create policy members on neuvetra.company_members for select to neuvetra_runtime using(user_id=auth.uid());create policy company on neuvetra.companies for select to neuvetra_runtime using(id in(select company_id from neuvetra.company_members));create policy precise on neuvetra.precise_records for select to neuvetra_runtime using(company_id in(select company_id from neuvetra.company_members));grant select on all tables in schema neuvetra to neuvetra_runtime;grant usage,select on all sequences in schema neuvetra to neuvetra_runtime")
    await source.exec('alter default privileges for role postgres in schema neuvetra grant select on tables to neuvetra_runtime')
    for(let index=1;index<=27;index++){
      const schema='external_'+String(index).padStart(2,'0')
      await source.exec('create schema '+schema+' authorization postgres;alter default privileges for role postgres in schema '+schema+' grant select on tables to neuvetra_runtime')
    }

    const archivePath=join(root,'fresh.snapshot.dpapi'),receiptPath=join(root,'fresh.receipt.json')
    const receipt=await createHostedSetupBackup({
      source,runtimeConnection:runtime,sourceMode:'hosted',expectedDatabase:'postgres',actors,archivePath,receiptPath,
      dump:async token=>{
        const child=Bun.spawn([join(bin,'pg_dump.exe'),'--format=custom','--no-password','--schema=neuvetra','--snapshot='+token],{env:cleanEnv(selected,'postgres','postgres'),stdin:'ignore',stdout:'pipe',stderr:'pipe'})
        dumpChild=child
        const out=new Response(child.stdout).arrayBuffer(),err=new Response(child.stderr).arrayBuffer()
        const [bytes,,code]=await Promise.all([out,err,child.exited])
        if(code!==0)throw Error('QA_NATIVE_DUMP_FAILED')
        return new Uint8Array(bytes)
      },
      cancelDump:async()=>{dumpChild?.kill();await dumpChild?.exited},
    })
    const archive=await readFile(archivePath),receiptBytes=await readFile(receiptPath)
    snapshotBytes=await dpapi('Unprotect',archive)
    expect(sha(snapshotBytes)).toBe(receipt.snapshotSha256)
    expect(receipt.archiveSha256).toBe(sha(archive))
    expect(receipt.archiveSha256).not.toBe(historicalArchive)
    const snapshot=JSON.parse(snapshotBytes.toString()) as Snapshot
    dumpBytes=Buffer.from(snapshot.dumpBase64,'base64')
    expect(sha(dumpBytes)).toBe(receipt.dumpSha256)
    expect(snapshot.state.inventory.defaultAcls.filter((row:any)=>row.schema!=='neuvetra'&&row.schema!=='*')).toHaveLength(27)

    const target='hosted_setup_restore_'+Date.now()+'_b1f2a12a',restoreStartedUtc=new Date().toISOString()
    await admin.exec('create database '+target+' template template0')
    restored=createPostgresConnection('postgres://supabase_admin@127.0.0.1:'+selected+'/'+target,{tls:false,maxConnections:1})
    await restored.exec("revoke all on schema public from public;create schema auth;create table auth.users(id uuid primary key);grant usage on schema auth to neuvetra_runtime;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$")
    for(const id of snapshot.auth.ids)await restored.query('insert into auth.users values($1)',[id])
    await processOutput([join(bin,'pg_restore.exe'),'--exit-on-error','--single-transaction','--no-password','--dbname='+target],dumpBytes,cleanEnv(selected,target,'supabase_admin'))
    const restoredState=await restored.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return captureState(tx,actors)})
    const restoreCompletedUtc=new Date().toISOString()
    assertPreserved(snapshot.state,restoredState)
    expect(recoveryHash(snapshot.state)).not.toBe(recoveryHash(restoredState))
    expect(recoveryHash(normalizedState(snapshot.state))).toBe(recoveryHash(normalizedState(restoredState)))
    const result:HostedSetupRestoreResult={profile:PROFILE,status:'local-restore-preservation-passed',database:target,sourceReceiptSha256:sha(receiptBytes),sourceStateSha256:recoveryHash(snapshot.state),restoredStateSha256:recoveryHash(restoredState),applicationRowsExact:true,applicationCatalogEquivalent:true,tenantReadAccessExact:true,providerRecoveryExcluded:true,hostedMigrationAuthorized:false}
    const resultArtifact=text(result)
    const sourceExternal=snapshot.state.inventory.defaultAcls.filter((row:any)=>row.schema!=='neuvetra'&&row.schema!=='*')
    const derivationInput:FingerprintDerivationInput={profile:FINGERPRINT_DERIVATION_INPUT_PROFILE,projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,expectedExternalDefaultAclCount:27,expectedExternalDefaultAclsSha256:fingerprintHash(sourceExternal),sourceSnapshot:{bytes:snapshotBytes,sha256:receipt.snapshotSha256},sourceReceipt:{bytes:receiptBytes,sha256:sha(receiptBytes)},sourceArchive:{bytes:archive,sha256:receipt.archiveSha256},restoreResult:{bytes:Buffer.from(resultArtifact.bytes),sha256:resultArtifact.sha256}}
    const derivation=await deriveExpectedHostedSetupFingerprint(restored,derivationInput),fingerprintCompletedUtc=new Date().toISOString()
    const identity=(await restored.query<{database:string;host:string;port:number;version:number}>("select current_database() database,host(inet_server_addr()) host,inet_server_port() port,current_setting('server_version_num')::int version")).rows[0]!
    await restored.close();restored=undefined
    await runtime.close();runtime=undefined
    await source.close();source=undefined
    await admin.close();admin=undefined
    await control(['-D',data,'-m','fast','-w','stop']);started=false
    expect(await listening(selected)).toBe(false)

    const evidence:FreshRestoreEvidence={sourceReceipt:retained(receiptBytes,sha(receiptBytes)),sourceArchive:{bytes:archive,sha256:receipt.archiveSha256},sourceSnapshot:retained(snapshotBytes,receipt.snapshotSha256),restoredState:text(restoredState),restoreResult:resultArtifact,restoreObservation:text({profile:FRESH_RESTORE_OBSERVATION_PROFILE,projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,operatorId:'qa-fixture-operator',restoreStartedUtc,restoreCompletedUtc,fingerprintCompletedUtc,runtime:{database:identity.database,host:identity.host,port:identity.port,serverVersionNum:identity.version},sourceReceiptSha256:sha(receiptBytes),sourceArchiveSha256:receipt.archiveSha256,sourceSnapshotSha256:receipt.snapshotSha256,sourceStateSha256:recoveryHash(snapshot.state),restoredStateSha256:recoveryHash(restoredState),restoreResultSha256:resultArtifact.sha256,fingerprintDerivationSha256:text(derivation).sha256,clusterStopped:true,clusterDataRetained:true,localListenerAbsent:true,sourceCurrentnessObserved:false,providerRecoveryExcluded:true,upgradeAuthorized:false}),fingerprintDerivation:text(derivation),restoreReview:text({}),fingerprintReview:text({})}
    const policy:FreshRestorePolicy={profile:FRESH_RESTORE_POLICY_PROFILE,projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,notBeforeUtc:new Date(Date.parse(receipt.createdUtc)-1000).toISOString(),maxAgeMs:600_000,operatorId:'qa-fixture-operator',restoreReviewerId:'qa-restore-reviewer',fingerprintReviewerId:'qa-fingerprint-reviewer',artifactSha256:{sourceReceipt:evidence.sourceReceipt.sha256,sourceArchive:evidence.sourceArchive.sha256,sourceSnapshot:evidence.sourceSnapshot.sha256,restoredState:evidence.restoredState.sha256,restoreResult:evidence.restoreResult.sha256,restoreObservation:evidence.restoreObservation.sha256,fingerprintDerivation:evidence.fingerprintDerivation.sha256},restoreReviewSha256:'0'.repeat(64),fingerprintReviewSha256:'0'.repeat(64),sourceStateSha256:recoveryHash(snapshot.state),restoredStateSha256:recoveryHash(restoredState),expectedDatabaseFingerprintSha256:derivation.expectedDatabaseFingerprintSha256,sourceExternalDefaultAclsSha256:fingerprintHash(sourceExternal),sourceExternalDefaultAclCount:27}
    const reviewTime=new Date().toISOString()
    for(const stage of ['restore','fingerprint'] as const){
      const review:FreshRestoreReview={profile:FRESH_RESTORE_REVIEW_PROFILE,stage,verdict:'accepted',operatorId:policy.operatorId,reviewerId:stage==='restore'?policy.restoreReviewerId:policy.fingerprintReviewerId,reviewedUtc:reviewTime,subjectSha256:freshRestoreReviewSubjectSha256(policy),materialFindingsOpen:0,checks:stage==='restore'?{actualPostgres17RestoreVerified:true,archiveSnapshotPairVerified:true,applicationPreservationVerified:true,tenantControlsVerified:true}:{coherentSnapshotVerified:true,quietSequenceWritersVerified:true,fingerprintIndependentlyDerived:true,externalDefaultAclScopeVerified:true},sourceCurrentnessObserved:false,liveHostedPreflightRequired:true,upgradeAuthorized:false,providerRecoveryExcluded:true}
      const artifact=text(review)
      if(stage==='restore'){evidence.restoreReview=artifact;policy.restoreReviewSha256=artifact.sha256}else{evidence.fingerprintReview=artifact;policy.fingerprintReviewSha256=artifact.sha256}
    }
    const now=new Date().toISOString(),binding=verifyFreshHostedSetupRestore(evidence,policy,now)
    expect(binding.sourceArchiveSha256).toBe(receipt.archiveSha256)
    expect(binding.sourceSnapshotSha256).toBe(receipt.snapshotSha256)
    expect(binding.sourceStateSha256).not.toBe(binding.restoredStateSha256)
    expect(binding.expectedDatabaseFingerprintSha256).toBe(derivation.expectedDatabaseFingerprintSha256)
    expect(binding.independentReviewerId).toBe('qa-restore-reviewer')
    expect(()=>verifyFreshHostedSetupRestore(evidence,{...policy,restoreReviewerId:policy.operatorId},now)).toThrow('INDEPENDENT_REVIEW_REQUIRED')
    const selfReviewEvidence=structuredClone(evidence),selfReviewPolicy=structuredClone(policy)
    const selfReview=JSON.parse(selfReviewEvidence.restoreReview.bytes)
    selfReview.reviewerId=policy.operatorId
    selfReviewEvidence.restoreReview=text(selfReview);selfReviewPolicy.restoreReviewSha256=selfReviewEvidence.restoreReview.sha256
    expect(()=>verifyFreshHostedSetupRestore(selfReviewEvidence,selfReviewPolicy,now)).toThrow('REVIEW_REFUSED')
    expect(()=>verifyFreshHostedSetupRestore(evidence,policy,new Date(Date.parse(receipt.createdUtc)+policy.maxAgeMs+1).toISOString())).toThrow('STALE_BACKUP_REFUSED')

    const driftEvidence=structuredClone(evidence),driftPolicy=structuredClone(policy)
    const drift=JSON.parse(driftEvidence.restoredState.bytes) as State
    drift.inventory.tables[0]!.rowHashes[0]='0'.repeat(64)
    driftEvidence.restoredState=text(drift);driftPolicy.artifactSha256.restoredState=driftEvidence.restoredState.sha256;driftPolicy.restoredStateSha256=recoveryHash(drift)
    expect(()=>verifyFreshHostedSetupRestore(driftEvidence,driftPolicy,now)).toThrow('PRESERVATION_MISMATCH')

    console.log(JSON.stringify({profile:'neuvetra.hosted-setup.fresh-restore-binding-independent-result.v1',postgres:String(identity.version),dynamicPort:selected,fixtureRoot:root,archiveSha256:receipt.archiveSha256,snapshotSha256:receipt.snapshotSha256,sourceStateSha256:binding.sourceStateSha256,restoredStateSha256:binding.restoredStateSha256,expectedDatabaseFingerprintSha256:binding.expectedDatabaseFingerprintSha256,archiveSnapshotDpapiPairVerified:true,rawStateDiffers:true,normalizedStateMatches:true,selfAuthorizationRefused:true,staleClockRefused:true,applicationDriftRefused:true,listenerAfterStop:false,localOnly:true}))
  }finally{
    await restored?.close();await runtime?.close();await source?.close();await admin?.close()
    if(started)await control(['-D',data,'-m','fast','-w','stop'])
    snapshotBytes?.fill(0);dumpBytes?.fill(0)
  }
},180000)
