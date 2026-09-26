import {describe,expect,test}from'bun:test'
import {PGlite}from'../../packages/neuvetra-database/node_modules/@electric-sql/pglite'
import{mkdtemp,mkdir,readFile,writeFile}from'node:fs/promises'
import{tmpdir}from'node:os'
import{dirname,join}from'node:path'
import {readMigrationManifest}from'../../packages/neuvetra-database/src/staging-migrations'
import type{WorkspaceConnection,WorkspaceSql}from'../../packages/neuvetra-database/src/workspace'
import{
 HOSTED_SETUP_PROFILE,HOSTED_SETUP_PROJECT,canonical,fingerprintSha256,hash,sha256,
 snapshotHostedSetupDatabase,type DurableJournal,type HostedSetupUpgradeInput,type PinnedArtifact,
}from'./hosted-setup-upgrade'
import{
 HOSTED_SETUP_MAINTENANCE_TARGET,HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE,HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE,HOSTED_SETUP_TRANSACTIONAL_PROFILE,HOSTED_SETUP_TRANSACTION_TIMEOUT_MS,
 reconcileHostedSetupTransactionalCommit,runHostedSetupTransactionalUpgrade,type HostedSetupArtifactSqlLock,type HostedSetupTransactionalDependencies,type ReviewedMaintenanceStopBinding,
}from'./hosted-setup-transactional-upgrade'
import{ARTIFACT_CONFIG,ARTIFACT_PROFILE,ARTIFACT_SOURCE_PROFILE,PUBLICATION_PROFILE,lockHostedSetupArtifactSql,verifyHostedSetupArtifact,type ArtifactPaths,type ArtifactTrustPolicy}from'./hosted-setup-artifact-source'

const artifact=(label:string):PinnedArtifact=>({bytes:label,sha256:sha256(label)})
const input=():HostedSetupUpgradeInput=>({
 profile:'neuvetra.hosted-setup.upgrade-input.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,
 reviewedProductHead:'a'.repeat(40),operatorId:'operator',restoreReviewerId:'restore-reviewer',publicationReviewerId:'publication-reviewer',stopReviewerId:'stop-reviewer',
 journalPath:'C:\\hosted-setup-transaction-test.jsonl',restoreReceipt:artifact('restore'),restoreReview:artifact('restore-review'),fingerprintDerivation:artifact('derivation'),fingerprintDerivationReview:artifact('derivation-review'),publicationReceipt:artifact('publication'),publicationReview:artifact('publication-review'),stopReceipt:artifact('stop'),stopReview:artifact('stop-review'),
})
const memoryJournal=(events:any[]):DurableJournal=>({append:async value=>{events.push(structuredClone(value))},close:async()=>{}})
async function put(path:string,bytes:string|Uint8Array){await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes)}

async function authenticArtifactFixture(manifest:Awaited<ReturnType<typeof readMigrationManifest>>){
 const root=await mkdtemp(join(tmpdir(),'hosted-artifact-runner-'))
 const paths:ArtifactPaths={publication:join(root,'publication.json'),sourceArchive:join(root,'source.tar'),dependencyArchive:join(root,'dependencies.tar'),sourceRoot:join(root,'source'),dependencyRoot:join(root,'dependencies'),runtimeExecutable:join(root,'bun.exe'),supervisor:join(root,'supervisor.ts'),config:join(root,'runtime.toml')}
 const checkout=join(root,'active-checkout');await mkdir(checkout)
 const sourceFiles:Array<{path:string;sha256:string}>=[],migrations:Array<{path:string;name:string;sha256:string;normalizedSha256:string}>=[]
 for(const row of manifest){const path='packages/neuvetra-database/src/migrations/'+row.name;await put(join(paths.sourceRoot,path),row.sql);sourceFiles.push({path,sha256:sha256(row.sql)});migrations.push({path,name:row.name,sha256:sha256(row.sql),normalizedSha256:row.sha256})}
 const worker='tools/staging/hosted-setup-artifact-worker.ts',workerBytes='throw Error("synthetic non-launchable runner fixture")\n'
 await put(join(paths.sourceRoot,worker),workerBytes);sourceFiles.push({path:worker,sha256:sha256(workerBytes)});sourceFiles.sort((left,right)=>left.path<right.path?-1:1)
 const dependencyBytes='{"name":"pg","synthetic":true}\n',dependencyFiles=[{path:'node_modules/pg/package.json',sha256:sha256(dependencyBytes)}]
 await put(join(paths.dependencyRoot,dependencyFiles[0]!.path),dependencyBytes)
 for(const key of ['sourceArchive','dependencyArchive','runtimeExecutable','supervisor']as const)await put(paths[key],'SYNTHETIC '+key)
 await put(paths.config,ARTIFACT_CONFIG)
 const receipt:any={profile:PUBLICATION_PROFILE,trustBoundary:'trusted-operator-host',reviewedProductHead:'a'.repeat(40),repository:'neuvetra-hq/neuvetra',pullRequest:6,operatorId:'artifact-runner-operator',independentReviewerId:'artifact-runner-reviewer',materialFindingsOpen:0,observedAtMs:Date.now()-1000,expiresAtMs:Date.now()+600000,checks:[{name:'synthetic-artifact-runner-check',head:'a'.repeat(40),conclusion:'success'}],sourceFiles,dependencyFiles,migrations,migrationManifestSha256:hash(manifest),artifact:{entrypoint:worker,launchPolicy:'neuvetra.hosted-setup.fixed-bun-worker.v1',configSha256:sha256(ARTIFACT_CONFIG)}}
 for(const[key,pin]of[['sourceArchive','sourceArchiveSha256'],['dependencyArchive','dependencyArchiveSha256'],['runtimeExecutable','runtimeSha256'],['supervisor','supervisorSha256']]as const)receipt.artifact[pin]=sha256(await readFile(paths[key]))
 const bytes=JSON.stringify(receipt);await put(paths.publication,bytes)
 const policy:ArtifactTrustPolicy={publicationSha256:sha256(bytes),reviewedProductHead:'a'.repeat(40),operatorId:receipt.operatorId,independentReviewerId:receipt.independentReviewerId,requiredChecks:['synthetic-artifact-runner-check'],activeCheckoutRoots:[checkout]}
 return{paths,policy,publicationBytes:bytes}
}

async function fixture(){
 const db=new PGlite()
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid()to authenticated;`)
 const manifest=await readMigrationManifest()
 for(const migration of manifest.slice(0,22))await db.exec(migration.sql)
 await db.exec('create table neuvetra.staging_target(project_ref text,profile text);create table neuvetra.schema_migrations(name text primary key,sha256 text,applied_at timestamptz default now())')
 await db.query('insert into neuvetra.staging_target values($1,$2)',[HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE])
 for(const migration of manifest.slice(0,22))await db.query('insert into neuvetra.schema_migrations(name,sha256)values($1,$2)',[migration.name,migration.sha256])
 return{db,manifest,before:await snapshotHostedSetupDatabase(db as unknown as WorkspaceConnection)}
}
function dependencies(i:HostedSetupUpgradeInput,manifest:Awaited<ReturnType<typeof readMigrationManifest>>,before:Awaited<ReturnType<typeof snapshotHostedSetupDatabase>>,events:any[],hooks:{afterMigration?:(tx:WorkspaceSql)=>Promise<void>}={}):HostedSetupTransactionalDependencies{
 const migrationManifestSha256=hash(manifest)
 const executionArtifactSha256='5'.repeat(64)
 const stop:ReviewedMaintenanceStopBinding={profile:HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE,maintenanceProfile:'neuvetra.hosted-setup.maintenance-stop.v2',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,...HOSTED_SETUP_MAINTENANCE_TARGET,deploymentId:'8946ec8e-3dba-484c-8f84-80fa71d8da5f',deployedCommit:i.reviewedProductHead,imageDigest:'sha256:'+'8'.repeat(64),replicas:0,availabilityStopObserved:true,databaseWritersExcluded:false,configurationVersion:'configuration-v2',stopReceiptSha256:i.stopReceipt.sha256,stopReviewSha256:i.stopReview.sha256,operatorId:i.operatorId,independentReviewerId:i.stopReviewerId,materialFindingsOpen:0}
 let lockPhase:'ready'|'active'|'consumed'='ready',migrationEntered=false
 const artifactSqlLock:HostedSetupArtifactSqlLock={
  binding:Object.freeze({profile:ARTIFACT_SOURCE_PROFILE,reviewedProductHead:i.reviewedProductHead,executionArtifactSha256,migrationManifestSha256}),
  migrationManifest:()=>manifest.map(row=>({...row})),
  withArtifactSource:async(binding,operation)=>{expect(binding).toEqual({profile:ARTIFACT_SOURCE_PROFILE,reviewedProductHead:i.reviewedProductHead,executionArtifactSha256,migrationManifestSha256});if(lockPhase!=='ready')throw Error('synthetic artifact lock consumed');lockPhase='active';try{const value=await operation();if(!migrationEntered)throw Error('synthetic migration not entered');return value}finally{lockPhase='consumed'}},
  migrate:async(connection)=>{if(lockPhase!=='active'||migrationEntered)throw Error('synthetic artifact migration refused');migrationEntered=true;await connection.transaction(async tx=>{await tx.exec(manifest[22]!.sql);await tx.query('insert into neuvetra.schema_migrations(name,sha256)values($1,$2)',[manifest[22]!.name,manifest[22]!.sha256]);await hooks.afterMigration?.(tx)});return{schemaVersion:23,migrations:manifest.map(({name,sha256})=>({name,sha256}))}},
 }
 return{
  verifyAcceptedRestore:()=>({profile:'neuvetra.hosted-setup.accepted-restore-binding.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,restoreReceiptSha256:i.restoreReceipt.sha256,restoreReviewSha256:i.restoreReview.sha256,fingerprintDerivationSha256:i.fingerprintDerivation.sha256,fingerprintDerivationReviewSha256:i.fingerprintDerivationReview.sha256,sourceSnapshotSha256:'1'.repeat(64),sourceArchiveSha256:'2'.repeat(64),sourceStateSha256:'3'.repeat(64),restoredStateSha256:'4'.repeat(64),expectedDatabaseFingerprintSha256:fingerprintSha256(before),databaseFingerprintIndependentlyDerived:true,exactApplicationPreserved:true,tenantControlsVerified:true,operatorId:i.operatorId,independentReviewerId:i.restoreReviewerId,materialFindingsOpen:0}),
  verifyReviewedExecutionArtifact:()=>({profile:HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE,projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:i.reviewedProductHead,remoteHead:i.reviewedProductHead,requiredChecksPassed:true,publicationReceiptSha256:i.publicationReceipt.sha256,publicationReviewSha256:i.publicationReview.sha256,artifactPublicationSha256:i.publicationReceipt.sha256,executionArtifactProfile:ARTIFACT_PROFILE,artifactSourceProfile:ARTIFACT_SOURCE_PROFILE,artifactTrustBoundary:'trusted-operator-host',artifactClaim:'verified-at-rest-artifact-and-private-sql-only',executionArtifactSha256,migrationManifestSha256,runtimeLoadedCodeAttested:false,launchAuthorized:false,operatorId:i.operatorId,independentReviewerId:i.publicationReviewerId,materialFindingsOpen:0}),
  currentProductHead:()=>i.reviewedProductHead,
  verifyReviewedMaintenanceStop:()=>stop,
  observeMaintenanceStopped:()=>canonical(true),
  withSequenceFence:async(tx,context,operation)=>{expect(context.sequenceNames).toEqual([...context.sequenceNames].sort());const timeout=(await tx.query<{milliseconds:string}>("select (extract(epoch from current_setting('transaction_timeout')::interval)*1000)::bigint::text milliseconds")).rows;expect(timeout).toEqual([{milliseconds:String(HOSTED_SETUP_TRANSACTION_TIMEOUT_MS)}]);return operation()},
  artifactSqlLock,
  openJournal:async()=>memoryJournal(events),now:()=> '2026-09-26T12:00:00.000Z',
 }
}

describe('hosted setup transactional upgrade candidate',()=>{
 test('rejects raw relative and drive-relative journal paths before resolution or side effects',async()=>{
  for(const path of ['..\\qa-relative-outside.jsonl','C:qa-drive-relative.jsonl']){
   const i=input();let pathReads=0,journalOpened=false,databaseTouched=false
   Object.defineProperty(i,'journalPath',{configurable:true,get(){pathReads++;return pathReads===1?path:'C:\\should-not-be-read.jsonl'}})
   const db={query:async()=>{databaseTouched=true;return{rows:[]}},exec:async()=>{databaseTouched=true},transaction:async()=>{databaseTouched=true},close:async()=>{}}as unknown as WorkspaceConnection
   const deps={openJournal:async()=>{journalOpened=true;return memoryJournal([])}}as unknown as HostedSetupTransactionalDependencies
   await expect(runHostedSetupTransactionalUpgrade(db,i,deps)).rejects.toThrow('Absolute external journal path required')
   expect(pathReads).toBe(1);expect(journalOpened).toBeFalse();expect(databaseTouched).toBeFalse()
  }
  const i=input();i.journalPath='.\\qa-cwd-relative.jsonl'
  let journalOpened=false,databaseTouched=false
  const db={query:async()=>{databaseTouched=true;return{rows:[]}},exec:async()=>{databaseTouched=true},transaction:async()=>{databaseTouched=true},close:async()=>{}}as unknown as WorkspaceConnection
  const deps={openJournal:async()=>{journalOpened=true;return memoryJournal([])}}as unknown as HostedSetupTransactionalDependencies
  const originalCwd=process.cwd(),running=runHostedSetupTransactionalUpgrade(db,i,deps)
  try{process.chdir('..');await expect(running).rejects.toThrow('Absolute external journal path required')}
  finally{process.chdir(originalCwd)}
  expect(journalOpened).toBeFalse();expect(databaseTouched).toBeFalse()
 })

 test('uses one physical transaction for lock, fingerprint, pinned migration and preservation',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[];let physicalTransactions=0
  const wrapped:WorkspaceConnection={query:(sql,params)=>db.query(sql,params),exec:sql=>db.exec(sql),close:()=>db.close(),transaction:async operation=>{physicalTransactions++;return db.transaction(operation)}}
  try{
   const result=await runHostedSetupTransactionalUpgrade(wrapped,i,dependencies(i,manifest,before,events))
    expect(result).toMatchObject({status:'hosted_setup_schema23_transaction_committed_and_observed',profile:HOSTED_SETUP_TRANSACTIONAL_PROFILE,executionArtifactSha256:'5'.repeat(64),executionArtifactProfile:ARTIFACT_PROFILE,artifactSourceProfile:ARTIFACT_SOURCE_PROFILE,artifactTrustBoundary:'trusted-operator-host',artifactClaim:'verified-at-rest-artifact-and-private-sql-only',runtimeLoadedCodeAttested:false,launchAuthorized:false,onePhysicalTransaction:true,sequenceFenceHeld:true,maintenanceStopObserved:true})
   expect(physicalTransactions).toBe(1)
    expect(events.map(row=>row.status)).toEqual(['hosted_setup_transaction_reserved','hosted_setup_schema22_locked_and_verified','hosted_setup_transaction_verified_pending_commit','hosted_setup_schema23_commit_resolved'])
    expect(events[0]).toMatchObject({profile:HOSTED_SETUP_TRANSACTIONAL_PROFILE,executionArtifactSha256:'5'.repeat(64),executionArtifactProfile:ARTIFACT_PROFILE,artifactSourceProfile:ARTIFACT_SOURCE_PROFILE,artifactTrustBoundary:'trusted-operator-host',artifactClaim:'verified-at-rest-artifact-and-private-sql-only',runtimeLoadedCodeAttested:false,launchAuthorized:false,noAutomaticRetry:true})
    expect(events[0]).not.toHaveProperty('sourceClosureSha256')
   expect((await db.query('select name from neuvetra.schema_migrations where name=$1',[manifest[22]!.name])).rows).toHaveLength(1)
  }finally{await db.close()}
 },30_000)

 test('composes the authentic verified artifact lock without a serialization shim',async()=>{
  const{db,manifest,before}=await fixture(),artifactFixture=await authenticArtifactFixture(manifest),events:any[]=[]
  const artifact=await verifyHostedSetupArtifact(artifactFixture.paths,artifactFixture.policy)
  const artifactSqlLock:HostedSetupArtifactSqlLock=await lockHostedSetupArtifactSql(artifact)
  const i=input();i.reviewedProductHead=artifact.reviewedProductHead;i.operatorId=artifact.operatorId;i.publicationReviewerId=artifact.independentReviewerId
  i.publicationReceipt={bytes:artifactFixture.publicationBytes,sha256:artifact.publicationSha256}
  const deps=dependencies(i,manifest,before,events);deps.artifactSqlLock=artifactSqlLock
  deps.verifyReviewedExecutionArtifact=()=>({profile:HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE,projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:artifact.reviewedProductHead,remoteHead:artifact.reviewedProductHead,requiredChecksPassed:true,publicationReceiptSha256:i.publicationReceipt.sha256,publicationReviewSha256:i.publicationReview.sha256,artifactPublicationSha256:artifact.publicationSha256,executionArtifactProfile:artifact.profile,artifactSourceProfile:artifactSqlLock.binding.profile,artifactTrustBoundary:artifact.trustBoundary,artifactClaim:artifact.claim,executionArtifactSha256:artifact.executionArtifactSha256,migrationManifestSha256:artifact.migrationManifestSha256,runtimeLoadedCodeAttested:false,launchAuthorized:artifact.launchAuthorized,operatorId:artifact.operatorId,independentReviewerId:artifact.independentReviewerId,materialFindingsOpen:0})
  let transactionFailure:unknown
  const wrapped:WorkspaceConnection={query:(sql,params)=>db.query(sql,params),exec:sql=>db.exec(sql),close:()=>db.close(),transaction:operation=>db.transaction(async tx=>{
   const auditAware:WorkspaceSql={exec:sql=>tx.exec(sql),query:async<T>(sql:string,params?:unknown[])=>{
    if(sql.includes("pg_get_userbyid(nspowner) owner from pg_namespace"))return{rows:[{schema_name:'public',owner:'postgres'},{schema_name:'auth',owner:'postgres'},{schema_name:'neuvetra',owner:'postgres'}]as T[]}
    if(sql.includes("has_database_privilege(rolname,current_database(),'CREATE')"))return{rows:[{role:'anon',allowed:false},{role:'authenticated',allowed:false}]as T[]}
    if(sql.includes('has_schema_privilege')||sql.includes('has_table_privilege')||sql.includes('has_column_privilege')||sql.includes('has_sequence_privilege')||sql.includes('has_function_privilege')||sql.includes('from pg_default_acl'))return{rows:[]as T[]}
    return tx.query<T>(sql,params)
   }}
   try{return await operation(auditAware)}catch(error){transactionFailure=error;throw error}
  })}
  try{
   let result:Awaited<ReturnType<typeof runHostedSetupTransactionalUpgrade>>
   try{result=await runHostedSetupTransactionalUpgrade(wrapped,i,deps)}catch{throw transactionFailure}
   expect(result).toMatchObject({status:'hosted_setup_schema23_transaction_committed_and_observed',executionArtifactSha256:artifact.executionArtifactSha256,runtimeLoadedCodeAttested:false,launchAuthorized:false})
   expect(events.map(row=>row.status)).toEqual(['hosted_setup_transaction_reserved','hosted_setup_schema22_locked_and_verified','hosted_setup_transaction_verified_pending_commit','hosted_setup_schema23_commit_resolved'])
  }finally{await db.close()}
 },30_000)

 test('isolates lock evidence and captures journal methods before callbacks can replace them',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[]
  let appendReads=0,closeReads=0,closeCalls=0
  const journal:any={}
  Object.defineProperties(journal,{
   append:{configurable:true,get(){appendReads++;return async(event:any)=>{
    if(event.status==='hosted_setup_transaction_reserved'){
     Object.defineProperty(journal,'append',{configurable:true,value:async()=>{}})
     Object.defineProperty(journal,'close',{configurable:true,value:async()=>{}})
    }
    if(event.status==='hosted_setup_schema22_locked_and_verified'){
     try{event.accessExclusiveTables.length=0;event.accessExclusiveTables.push('never_locked_table')}catch{}
     try{event.sequenceNames.length=0;event.sequenceNames.push('never_fenced_sequence')}catch{}
     try{event.accessExclusiveTables=['never_locked_table'];event.sequenceNames=['never_fenced_sequence']}catch{}
    }
    events.push(structuredClone(event))
   }}},
   close:{configurable:true,get(){closeReads++;return async()=>{closeCalls++}}},
  })
  const deps=dependencies(i,manifest,before,events);deps.openJournal=async()=>journal
  try{
   const receipt=await runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,deps)
   expect(events.map(row=>row.status)).toEqual(['hosted_setup_transaction_reserved','hosted_setup_schema22_locked_and_verified','hosted_setup_transaction_verified_pending_commit','hosted_setup_schema23_commit_resolved'])
   const locked=events[1]
   expect(locked.accessExclusiveTables).toContain('schema_migrations');expect(locked.accessExclusiveTables).toContain('staging_target')
   expect(locked.accessExclusiveTables).not.toContain('never_locked_table');expect(locked.sequenceNames).not.toContain('never_fenced_sequence')
   expect(receipt.accessExclusiveTables).toEqual(locked.accessExclusiveTables);expect(Object.isFrozen(receipt)).toBeTrue();expect(Object.isFrozen(receipt.accessExclusiveTables)).toBeTrue()
   expect(appendReads).toBe(1);expect(closeReads).toBe(1);expect(closeCalls).toBe(1)
  }finally{await db.close()}
 },30_000)

 test('fails closed without both injected controls before database work',async()=>{
  const i=input(),events:any[]=[];let touched=false
  const db={query:async()=>{touched=true;return{rows:[]}},exec:async()=>{touched=true},transaction:async()=>{touched=true},close:async()=>{}}as unknown as WorkspaceConnection
  const blank={}as HostedSetupTransactionalDependencies
   await expect(runHostedSetupTransactionalUpgrade(db,i,blank)).rejects.toThrow('Cohesive artifact SQL lock required')
  expect(touched).toBeFalse();expect(events).toHaveLength(0)
  })

 test('refuses retired closure fields, artifact-identity drift and inflated runtime claims before database work',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[];let transactions=0
  const wrapped:WorkspaceConnection={query:(sql,params)=>db.query(sql,params),exec:sql=>db.exec(sql),close:()=>db.close(),transaction:async operation=>{transactions++;return db.transaction(operation)}}
  try{
   const legacyProduct=dependencies(i,manifest,before,events),verifyLegacy=legacyProduct.verifyReviewedExecutionArtifact
   legacyProduct.verifyReviewedExecutionArtifact=(receipt,review)=>({...verifyLegacy(receipt,review),sourceClosureSha256:'6'.repeat(64)})as unknown as ReturnType<typeof verifyLegacy>
   await expect(runHostedSetupTransactionalUpgrade(wrapped,i,legacyProduct)).rejects.toThrow('Reviewed execution artifact binding exact fields required')

   const legacySource=dependencies(i,manifest,before,events),lock=legacySource.artifactSqlLock
   legacySource.artifactSqlLock={...lock,binding:{...lock.binding,sourceClosureSha256:'6'.repeat(64)}}as unknown as HostedSetupArtifactSqlLock
   await expect(runHostedSetupTransactionalUpgrade(wrapped,i,legacySource)).rejects.toThrow('Artifact SQL source binding exact fields required')

   const changedIdentity=dependencies(i,manifest,before,events),verifyChanged=changedIdentity.verifyReviewedExecutionArtifact
   changedIdentity.verifyReviewedExecutionArtifact=(receipt,review)=>({...verifyChanged(receipt,review),executionArtifactSha256:'7'.repeat(64)})
   await expect(runHostedSetupTransactionalUpgrade(wrapped,i,changedIdentity)).rejects.toThrow('Reviewed execution artifact changed')

   const changedPublication=dependencies(i,manifest,before,events),verifyPublication=changedPublication.verifyReviewedExecutionArtifact
   changedPublication.verifyReviewedExecutionArtifact=(receipt,review)=>({...verifyPublication(receipt,review),artifactPublicationSha256:'8'.repeat(64)})
   await expect(runHostedSetupTransactionalUpgrade(wrapped,i,changedPublication)).rejects.toThrow('Publication evidence not bound')

   for(const field of ['runtimeLoadedCodeAttested','launchAuthorized']as const){
    const inflated=dependencies(i,manifest,before,events),verifyInflated=inflated.verifyReviewedExecutionArtifact
    inflated.verifyReviewedExecutionArtifact=((receipt:Parameters<typeof verifyInflated>[0],review:Parameters<typeof verifyInflated>[1])=>({...verifyInflated(receipt,review),[field]:true}))as unknown as typeof verifyInflated
    await expect(runHostedSetupTransactionalUpgrade(wrapped,i,inflated)).rejects.toThrow('At-rest artifact claim boundary required')
   }
   expect(transactions).toBe(0);expect(events).toHaveLength(0)
  }finally{await db.close()}
 },30_000)

 test('retains immutable invocation-time artifacts against verifier rebinding',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[];let transactions=0
  const deps=dependencies(i,manifest,before,events),original=deps.verifyAcceptedRestore
  deps.verifyAcceptedRestore=(receipt,review,derivation,derivationReview)=>{
   try{(receipt as{bytes:string}).bytes='forged';(receipt as{sha256:string}).sha256=sha256('forged')}catch{}
   return{...original(receipt,review,derivation,derivationReview),restoreReceiptSha256:sha256('forged')}
  }
  const wrapped:WorkspaceConnection={query:(sql,params)=>db.query(sql,params),exec:sql=>db.exec(sql),close:()=>db.close(),transaction:async operation=>{transactions++;return db.transaction(operation)}}
  try{await expect(runHostedSetupTransactionalUpgrade(wrapped,i,deps)).rejects.toThrow('Accepted restore artifacts not bound');expect(transactions).toBe(0);expect(events).toHaveLength(0)}finally{await db.close()}
 },30_000)

 test('retains invocation-time input while current-head observation is pending',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),original=structuredClone(i),events:any[]=[];let release!:()=>void
  const pending=new Promise<void>(resolve=>{release=resolve}),deps=dependencies(original,manifest,before,events)
  deps.currentProductHead=async()=>{await pending;return original.reviewedProductHead}
  const running=runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,deps)
  i.reviewedProductHead='b'.repeat(40);i.restoreReceipt.bytes='forged';i.restoreReceipt.sha256=sha256('forged');i.stopReview.bytes='forged';i.stopReview.sha256=sha256('forged');release()
  try{expect((await running).status).toBe('hosted_setup_schema23_transaction_committed_and_observed')}finally{await db.close()}
 },30_000)

 test('captures one observer callback and exposes only frozen maintenance copies',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[];const deps=dependencies(i,manifest,before,events)
  let getterReads=0,calls=0,mutationSucceeded=false;const phases:string[]=[]
  Object.defineProperty(deps,'observeMaintenanceStopped',{configurable:true,get(){getterReads++;return(binding:Readonly<ReviewedMaintenanceStopBinding>,phase:string)=>{calls++;phases.push(phase);try{(binding as{replicas:number}).replicas=1;mutationSucceeded=true}catch{}return canonical(true)}}})
  try{const result=await runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,deps);expect(result.status).toBe('hosted_setup_schema23_transaction_committed_and_observed');expect(getterReads).toBe(1);expect(calls).toBe(3);expect(phases).toEqual(['before_transaction','under_lock_before_migration','under_lock_before_commit']);expect(mutationSucceeded).toBeFalse()}finally{await db.close()}
 },30_000)

 test('requires synchronous reviewed maintenance binding and serialized strict-true observations',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[]
  try{
   const asynchronous=dependencies(i,manifest,before,events);asynchronous.verifyReviewedMaintenanceStop=(()=>Promise.resolve({}))as unknown as HostedSetupTransactionalDependencies['verifyReviewedMaintenanceStop']
   await expect(runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,asynchronous)).rejects.toThrow('Reviewed maintenance binding synchronous object required')
   const raw=dependencies(i,manifest,before,events);raw.observeMaintenanceStopped=(()=>true)as unknown as HostedSetupTransactionalDependencies['observeMaintenanceStopped']
   await expect(runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,raw)).rejects.toThrow('Serialized maintenance-stop observation required')
   expect(events).toHaveLength(0)
  }finally{await db.close()}
 },30_000)

 test('accepts only the exact availability stop and preserves the false database-writer claim',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[]
  try{
   const claimed=dependencies(i,manifest,before,events),binding=claimed.verifyReviewedMaintenanceStop(i.stopReceipt,i.stopReview)
   claimed.verifyReviewedMaintenanceStop=()=>({...binding,databaseWritersExcluded:true})as unknown as ReviewedMaintenanceStopBinding
   await expect(runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,claimed)).rejects.toThrow('Availability-only stop evidence required')
   const drifted=dependencies(i,manifest,before,events),exact=drifted.verifyReviewedMaintenanceStop(i.stopReceipt,i.stopReview)
   drifted.verifyReviewedMaintenanceStop=()=>({...exact,serviceId:'different-service'})as unknown as ReviewedMaintenanceStopBinding
   await expect(runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,drifted)).rejects.toThrow('Maintenance target mismatch')
   for(const [field,value] of [['deployedCommit','75d8ec4b16054a1bbfc1a51ddaec99000ee1efe2'],['deploymentId','not-a-deployment-id'],['imageDigest','sha256:invalid']] as const){
    const unsafe=dependencies(i,manifest,before,events),reviewed=unsafe.verifyReviewedMaintenanceStop(i.stopReceipt,i.stopReview)
    unsafe.verifyReviewedMaintenanceStop=()=>({...reviewed,[field]:value})as ReviewedMaintenanceStopBinding
    await expect(runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,unsafe)).rejects.toThrow('Reviewed deployment identity mismatch')
   }
   expect(events).toHaveLength(0)
  }finally{await db.close()}
 },30_000)

 test('rolls back migration and consumes the journal when locked post-state mismatches',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[]
  try{
   await expect(runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,dependencies(i,manifest,before,events,{afterMigration:tx=>tx.query("update neuvetra.staging_target set profile='changed'").then(()=>{})}))).rejects.toThrow('hosted_setup_transaction_outcome_unknown_do_not_retry')
   const after=await snapshotHostedSetupDatabase(db as unknown as WorkspaceConnection)
   expect(fingerprintSha256(after)).toBe(fingerprintSha256(before));expect(after.schemaVersion).toBe(22)
   expect(events.at(-1).status).toBe('hosted_setup_transaction_outcome_unknown_do_not_retry')
  }finally{await db.close()}
 },30_000)

 test('requires original transaction resolution before interpreting the unique receipt marker',async()=>{
  const expected='a'.repeat(64),queries:string[]=[]
  const tx:WorkspaceSql={query:async<T>(sql:string)=>{queries.push(sql);return{rows:(sql.includes('staging_target')?[{project_ref:HOSTED_SETUP_PROJECT,profile:HOSTED_SETUP_PROFILE}]:[])as T[]}},exec:async()=>{}}
  const db={...tx,transaction:async<T>(operation:(value:WorkspaceSql)=>Promise<T>)=>operation(tx),close:async()=>{}}as WorkspaceConnection
  await expect(reconcileHostedSetupTransactionalCommit(db,{profile:'neuvetra.hosted-setup.uncertain-commit-reconciliation.v1',projectRef:HOSTED_SETUP_PROJECT,expectedMigrationSha256:expected,observeOriginalTransactionResolved:()=>false as true})).rejects.toThrow('Original transaction resolution')
  expect(queries).toHaveLength(0)
  const result=await reconcileHostedSetupTransactionalCommit(db,{profile:'neuvetra.hosted-setup.uncertain-commit-reconciliation.v1',projectRef:HOSTED_SETUP_PROJECT,expectedMigrationSha256:expected,observeOriginalTransactionResolved:()=>true as const})
  expect(result).toEqual({status:'hosted_setup_no_commit_marker_after_resolution',noAutomaticRetry:true});expect(queries).toHaveLength(2)
 })

 test('reconciliation retains hash and observer across await and rejects wrong or duplicate markers',async()=>{
  let release!:(value:true)=>void,getterReads=0
  const pending=new Promise<true>(resolve=>{release=resolve}),source:any={profile:'neuvetra.hosted-setup.uncertain-commit-reconciliation.v1',projectRef:HOSTED_SETUP_PROJECT,expectedMigrationSha256:'a'.repeat(64)}
  Object.defineProperty(source,'observeOriginalTransactionResolved',{configurable:true,get(){getterReads++;return()=>pending}})
  const connection=(markers:Array<{name:string;sha256:string}>):WorkspaceConnection=>{
   const tx:WorkspaceSql={query:async<T>(sql:string)=>({rows:(sql.includes('staging_target')?[{project_ref:HOSTED_SETUP_PROJECT,profile:HOSTED_SETUP_PROFILE}]:markers)as T[]}),exec:async()=>{}}
   return{...tx,transaction:<T>(operation:(value:WorkspaceSql)=>Promise<T>)=>operation(tx),close:async()=>{}}
  }
  const running=reconcileHostedSetupTransactionalCommit(connection([{name:'0023_company_setup.sql',sha256:'b'.repeat(64)}]),source)
  source.expectedMigrationSha256='b'.repeat(64);Object.defineProperty(source,'observeOriginalTransactionResolved',{value:()=>true})
  release(true)
  await expect(running).rejects.toThrow('Schema migration commit marker mismatch');expect(getterReads).toBe(1)
  await expect(reconcileHostedSetupTransactionalCommit(connection([{name:'0023_company_setup.sql',sha256:'a'.repeat(64)},{name:'0023_company_setup.sql',sha256:'a'.repeat(64)}]),{profile:'neuvetra.hosted-setup.uncertain-commit-reconciliation.v1',projectRef:HOSTED_SETUP_PROJECT,expectedMigrationSha256:'a'.repeat(64),observeOriginalTransactionResolved:()=>true as const})).rejects.toThrow('Non-unique schema migration marker')
 })

 test('records uncertain commit, never replays a consumed journal, and reconciles only by the unique marker',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[];let transactions=0,journalOpened=false
  const uncertain:WorkspaceConnection={query:(sql,params)=>db.query(sql,params),exec:sql=>db.exec(sql),close:()=>db.close(),transaction:async operation=>{transactions++;await db.transaction(operation);throw Error('synthetic connection loss after server commit')}}
  const deps=dependencies(i,manifest,before,events)
  deps.openJournal=async()=>{if(journalOpened)throw Error('single-use journal already exists');journalOpened=true;return memoryJournal(events)}
  try{
   await expect(runHostedSetupTransactionalUpgrade(uncertain,i,deps)).rejects.toThrow('hosted_setup_transaction_outcome_unknown_do_not_retry')
   expect(transactions).toBe(1);expect(events.at(-1)).toMatchObject({status:'hosted_setup_transaction_outcome_unknown_do_not_retry',noAutomaticRetry:true,reconcileBeforeAnyNewDecision:true})
   await expect(runHostedSetupTransactionalUpgrade(uncertain,i,deps)).rejects.toThrow('single-use journal already exists')
   expect(transactions).toBe(1)
   const reconciled=await reconcileHostedSetupTransactionalCommit(db as unknown as WorkspaceConnection,{profile:'neuvetra.hosted-setup.uncertain-commit-reconciliation.v1',projectRef:HOSTED_SETUP_PROJECT,expectedMigrationSha256:manifest[22]!.sha256,observeOriginalTransactionResolved:()=>true as const})
   expect(reconciled).toEqual({status:'hosted_setup_commit_marker_present_after_resolution',noAutomaticRetry:true})
  }finally{await db.close()}
 },30_000)

 test('propagates strict maintenance refusal and does not enter the sequence fence',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[];let fenceCalls=0
  const deps=dependencies(i,manifest,before,events);deps.observeMaintenanceStopped=()=>canonical(false);deps.withSequenceFence=async(_tx,_context,operation)=>{fenceCalls++;return operation()}
  try{
   await expect(runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,deps)).rejects.toThrow('Maintenance-stop observation refused')
   expect(fenceCalls).toBe(0);expect(events).toHaveLength(0)
  }finally{await db.close()}
 },30_000)

 test('rolls back when a mocked writer-stop race is observed before commit',async()=>{
  const{db,manifest,before}=await fixture(),i=input(),events:any[]=[]
  const deps=dependencies(i,manifest,before,events);deps.observeMaintenanceStopped=(_binding,phase)=>canonical(phase!=='under_lock_before_commit')
  try{
   await expect(runHostedSetupTransactionalUpgrade(db as unknown as WorkspaceConnection,i,deps)).rejects.toThrow('hosted_setup_transaction_outcome_unknown_do_not_retry')
   const after=await snapshotHostedSetupDatabase(db as unknown as WorkspaceConnection)
   expect(after.schemaVersion).toBe(22);expect(fingerprintSha256(after)).toBe(fingerprintSha256(before))
   expect(events.at(-1)).toMatchObject({status:'hosted_setup_transaction_outcome_unknown_do_not_retry',noAutomaticRetry:true})
  }finally{await db.close()}
 },30_000)
})
