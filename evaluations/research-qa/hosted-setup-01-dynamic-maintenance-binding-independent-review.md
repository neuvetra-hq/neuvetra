# Dynamic maintenance binding — independent runner review

2026-09-26. Task HOSTED-SETUP-DYNAMIC-MAINTENANCE-BINDING-QA-01. Reviewer /root/compose_qa, qa-lead. Root authored this narrow change. This reviewer authored none of transactional-upgrade, its tests or the composition fixture; it authored a separate fresh-restore binder, which this review does not approve. Requested registered critical QA route gpt-6-astra/high; observed model/effort unknown because this existing-context follow-up supplied no observable override. QA role, operating/workflow guidance, current leading handoff and board status were refreshed.

**Verdict: PASS, bounded to the changed dynamic maintenance contract and local transaction regression.** No new material finding was established. This does not independently authenticate a real stopped deployment/image, implement the concrete verifier/observer callbacks, accept the separate post-scale repair, or authorize live migration/publication.

## Frozen reviewed candidate

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-transactional-upgrade.ts | 93eb9c31c16862f875449079a740880f6f02310a897121a7701c1a16f52fe203 |
| tools/staging/hosted-setup-transactional-upgrade.test.ts | fbedbee79c95f5c7fe29c4210e71de6e53673fd59f85ed355398f775456f03f2 |
| tools/staging/hosted-setup-transaction-compose.ts | 5b096a18f4c69d4aa3781b6d3a359378a1df69f0761b49f00721255252696174 |

All hashes matched at entry and after checks. Reviewer changed no candidate, existing report, ledger, Git or provider state. Only this new report, the separate QA run and temporary synthetic probe were written. Database activity was confined to fresh embedded/disposable local fixtures; the retained recovery cluster and hosted databases were untouched.

## Changed contract and criteria

The fixed maintenance target now holds only project/environment/service/region. The runner accepts reviewed-maintenance-stop-binding.v2 containing maintenance-stop.v2 evidence with a syntactically valid deployment UUID and sha256 image digest. The stopped deployment commit must equal the exact reviewed input PR head. Publication, current checkout head, private artifact binding and migration manifest still must agree with that head. Exact stop receipt/review pins, expected reviewer/operator, zero open findings, replicas zero, availability observed and databaseWritersExcluded false remain required.

| Criterion | Independent evidence and disposition |
| --- | --- |
| Dynamic exact target, image and profile | PASS. Twenty-five negative mutations reject before any observation, journal or database call: v1 binding/profile, foreign project/profile/provider target/region, invalid/null UUID or image digest, retired or different commit, wrong replica/availability/writer claims, blank configuration, wrong stop pins, wrong operator/reviewer and open findings. |
| Build/stop disagreement | PASS at the declared runner boundary. Different publication head, remote head, current head, publication receipt pin or execution artifact digest rejects before observations or transaction. The retired commit 75d8ec4b... refuses against the new reviewed aaaa... fixture head. |
| Immutable callback boundary | PASS. A maintenance image getter returns the accepted digest once and another digest on subsequent reads; exactly one read occurs and the private accepted digest reaches all three observer phases. After verification, the asynchronous head callback mutates source deployment/commit/reviewer; observer callbacks attempt to mutate their frozen binding copies and replace the source observer method. The runner retains the original values and callback through before_transaction, under_lock_before_migration and under_lock_before_commit. Caller input is also mutated after first observation; the returned head remains the invocation-time head. |
| Wrong-first getter and late refusal | PASS. Wrong-first image getter refuses after one read without journal entries. Loss of the stopped observation just before commit rolls back the schema-23 marker and records outcome unknown/do not retry. |
| One transaction and native semantics | PASS locally. A fresh native PG17 fixture commits once, preserves the sentinel and membership, rolls back forced failure, aborts timeout, refuses journal replay before a new transaction, and reconciles only in fresh processes after original transaction resolution. Native backend identity and lock observations remain coherent; separate embedded probe counts one physical transaction. |

The code snapshots maintenance scalars before awaiting current-head observation, then supplies frozen copies to a captured observer callback. This is unlike the still-open split-read defect in the separate post-scale resume verifier; this review does not erase or close POST-F02.

## Executed verification

Windows/PowerShell, Bun 1.3.12, PostgreSQL 17.11.

1. `bun test tools/staging/hosted-setup-transactional-upgrade.test.ts tools/staging/hosted-setup-transaction-compose.test.ts --timeout 60000`: **18 pass, 0 fail, 162 expectations**, 38.09 seconds. Native composition actually ran; it was not skipped.
2. `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-transactional-upgrade.ts tools/staging/hosted-setup-transactional-upgrade.test.ts tools/staging/hosted-setup-transaction-compose.ts tools/staging/hosted-setup-transaction-compose.test.ts`: **exit 0**, explicitly checked separately from stopped-cluster status.
3. Independent temporary suite: **4 pass, 0 fail, 147 expectations**. It adapts the existing embedded fixture builder to exercise actual runner APIs; the adversarial mutations/expectations were independently added. Temporary path C:/Users/nimab/AppData/Local/Temp/hosted-setup-dynamic-maintenance-independent.test.ts; final SHA-256 3e2e47c6b79899ddd270d88a3f77aa0e93386be2912d4523cca7133b1d45a221.

**Preserved initial probe failure:** the first independent run was 3 pass/1 fail/137 expectations. The race test intentionally mutated caller input, but its inherited synthetic artifact-lock dependency also closed over that same mutable input and rejected before migration. That was a QA fixture coupling, not evidence of candidate acceptance or a product defect. The fixture now creates the trusted mock dependency from structuredClone(input), while the public caller input is still mutated. The corrected same challenge passes. No candidate source or expectations were weakened.

## Native disposable fixture evidence

Retained fixture: C:/Users/nimab/AppData/Local/Temp/hosted-setup-compose-xaERt3; loopback port **54421**, excluding recovery port 55479. Commit backend **36092**, rollback backend **45696**, timeout backend **33296**. Accepted migration digest **d9f4a69bfcd0c6fe19201d2893c19bb8a0356edb647b522812c7fce51d62babb**.

The native result explicitly says approvalEvidence synthetic-mock-only, localOnly true and launchAuthorized false. Commit marker present; rollback and timeout marker absent; journal replay refused before transaction. Final compose session count and lock count were both zero. A separate pg_ctl status on this exact fixture reported no server running, and its port had zero listening sockets after cleanup. Fixture data/journals remain retained.

## Limits and integration requirements

This runner validates a reviewed maintenance binding; it does not inspect raw provider captures itself. UUID/image-digest **provenance and image-to-commit authenticity** are delegated to the trusted synchronous verifyReviewedMaintenanceStop callback and its exact evidence/review pins. Publication evidence here binds the artifact and commit, not an OCI build attestation. A syntactically valid different digest supplied by a trusted but false verifier is not independently disproved by this runner. Do not claim this test proves a built image matches source merely because its commit string matches.

Removing fixed historical identity means this runner is not a standalone blacklist of every old deployment or commit. The tested old commit is refused because it differs from the reviewed current head. The concrete deployment/stop binder must establish the intended actual deployment and image. Exactly observed image identity must persist through all three observation callbacks; serial JSON true is a callback contract, not built-in provider authentication or a continuous lease.

The sequence fence, maintenance observer, reviewed restore/publication callbacks and local approval evidence are synthetic in composition. Actual one-transaction PostgreSQL execution and cleanup were exercised, but no actual hosted restore, scale, stop, image, reviewer authentication or continuous writer hold was established. Native regression does not accept the separate post-scale candidate, fresh-restore binder or forthcoming full integration. Root owns immutable packaging, final run closure and live sequencing.

## Independent probe source

```typescript
import {describe,expect,test}from'bun:test'
import {PGlite}from'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/packages/neuvetra-database/node_modules/@electric-sql/pglite'
import{mkdtemp,mkdir,readFile,writeFile}from'node:fs/promises'
import{tmpdir}from'node:os'
import{dirname,join}from'node:path'
import {readMigrationManifest}from'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/packages/neuvetra-database/src/staging-migrations'
import type{WorkspaceConnection,WorkspaceSql}from'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/packages/neuvetra-database/src/workspace'
import{
 HOSTED_SETUP_PROFILE,HOSTED_SETUP_PROJECT,canonical,fingerprintSha256,hash,sha256,
 snapshotHostedSetupDatabase,type DurableJournal,type HostedSetupUpgradeInput,type PinnedArtifact,
}from'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-upgrade'
import{
 HOSTED_SETUP_MAINTENANCE_TARGET,HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE,HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE,HOSTED_SETUP_TRANSACTIONAL_PROFILE,HOSTED_SETUP_TRANSACTION_TIMEOUT_MS,
 reconcileHostedSetupTransactionalCommit,runHostedSetupTransactionalUpgrade,type HostedSetupArtifactSqlLock,type HostedSetupTransactionalDependencies,type ReviewedMaintenanceStopBinding,
}from'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-transactional-upgrade'
import{ARTIFACT_CONFIG,ARTIFACT_PROFILE,ARTIFACT_SOURCE_PROFILE,PUBLICATION_PROFILE,lockHostedSetupArtifactSql,verifyHostedSetupArtifact,type ArtifactPaths,type ArtifactTrustPolicy}from'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-source'

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


test('independent dynamic maintenance rejects exact target/image/profile/reviewer/evidence drift before journal or database',async()=>{
 const f=await fixture();let checked=0
 try{
  const cases:Array<[string,unknown]>=[['profile','neuvetra.hosted-setup.reviewed-maintenance-stop-binding.v1'],['maintenanceProfile','neuvetra.hosted-setup.maintenance-stop.v1'],['projectRef','wrong'],['targetProfile','wrong'],['projectId','wrong'],['environmentId','wrong'],['serviceId','wrong'],['region','other-region'],['deploymentId','not-uuid'],['deploymentId',null],['imageDigest','sha256:invalid'],['imageDigest','8'.repeat(64)],['imageDigest',null],['deployedCommit','75d8ec4b16054a1bbfc1a51ddaec99000ee1efe2'],['deployedCommit','b'.repeat(40)],['replicas',1],['availabilityStopObserved',false],['databaseWritersExcluded',true],['configurationVersion',''],['stopReceiptSha256','0'.repeat(64)],['stopReviewSha256','0'.repeat(64)],['operatorId','other'],['independentReviewerId','operator'],['independentReviewerId','other'],['materialFindingsOpen',1]]
  for(const [field,value]of cases){
   const i=input(),events:any[]=[],deps=dependencies(i,f.manifest,f.before,events),base=deps.verifyReviewedMaintenanceStop(i.stopReceipt,i.stopReview)
   deps.verifyReviewedMaintenanceStop=()=>({...base,[field]:value}) as any
   let journal=0,observations=0,dbAccess=0;deps.openJournal=async()=>{journal++;return memoryJournal(events)};deps.observeMaintenanceStopped=()=>{observations++;return 'true'}
   const db={transaction:async()=>{dbAccess++;throw Error('unexpected db')},exec:async()=>{dbAccess++},query:async()=>{dbAccess++;return{rows:[]}},close:async()=>{}} as unknown as WorkspaceConnection
   await expect(runHostedSetupTransactionalUpgrade(db,i,deps)).rejects.toThrow();expect(journal).toBe(0);expect(observations).toBe(0);expect(dbAccess).toBe(0);checked++
  }
  expect(checked).toBe(25)
 }finally{await f.db.close()}
},30000)
test('independent publication/stop disagreement refuses before observations or transaction',async()=>{
 const f=await fixture()
 try{for(const mode of ['build-head','remote-head','current-head','publication-pin','artifact-pin']){
  const i=input(),events:any[]=[],deps=dependencies(i,f.manifest,f.before,events),base=deps.verifyReviewedExecutionArtifact(i.publicationReceipt,i.publicationReview)
  if(mode==='build-head')base.reviewedProductHead='b'.repeat(40)
  if(mode==='remote-head')base.remoteHead='b'.repeat(40)
  if(mode==='current-head')deps.currentProductHead=()=> 'b'.repeat(40)
  if(mode==='publication-pin')base.publicationReceiptSha256='0'.repeat(64)
  if(mode==='artifact-pin')base.executionArtifactSha256='0'.repeat(64)
  deps.verifyReviewedExecutionArtifact=()=>base;let observations=0,dbAccess=0;deps.observeMaintenanceStopped=()=>{observations++;return'true'}
  const db={transaction:async()=>{dbAccess++;throw Error('unexpected db')},query:async()=>{dbAccess++;return{rows:[]}},exec:async()=>{dbAccess++},close:async()=>{}} as unknown as WorkspaceConnection
  await expect(runHostedSetupTransactionalUpgrade(db,i,deps)).rejects.toThrow();expect(observations).toBe(0);expect(dbAccess).toBe(0);expect(events).toHaveLength(0)
 }}finally{await f.db.close()}
},30000)
test('independent getter and asynchronous callback races retain one exact private maintenance binding across all phases',async()=>{
 const f=await fixture(),i=input(),events:any[]=[],deps=dependencies(structuredClone(i),f.manifest,f.before,events),base=deps.verifyReviewedMaintenanceStop(i.stopReceipt,i.stopReview)
 let digestReads=0,verifierCalls=0,physical=0;const phases:string[]=[];const seen:any[]=[]
 const source={...base,get imageDigest(){digestReads++;return digestReads===1?base.imageDigest:'sha256:'+'9'.repeat(64)}}
 deps.verifyReviewedMaintenanceStop=(r,v)=>{verifierCalls++;expect(Object.isFrozen(r)).toBe(true);expect(Object.isFrozen(v)).toBe(true);return source}
 deps.currentProductHead=async()=>{source.deploymentId='changed-after-validation';source.deployedCommit='b'.repeat(40);source.independentReviewerId='operator';return i.reviewedProductHead}
 deps.observeMaintenanceStopped=(binding,phase)=>{
  expect(Object.isFrozen(binding)).toBe(true);seen.push({...binding});phases.push(phase)
  try{(binding as any).imageDigest='sha256:'+'0'.repeat(64)}catch{}
  deps.observeMaintenanceStopped=()=>{throw Error('replacement observer must never run')}
  i.reviewedProductHead='c'.repeat(40);i.stopReview.bytes='mutated caller bytes'
  return 'true'
 }
 const wrapped:WorkspaceConnection={query:(q,p)=>f.db.query(q,p),exec:q=>f.db.exec(q),close:()=>f.db.close(),transaction:async op=>{physical++;return f.db.transaction(op)}}
 try{const receipt=await runHostedSetupTransactionalUpgrade(wrapped,i,deps);expect(receipt.onePhysicalTransaction).toBe(true);expect(physical).toBe(1);expect(digestReads).toBe(1);expect(verifierCalls).toBe(1);expect(phases).toEqual(['before_transaction','under_lock_before_migration','under_lock_before_commit']);for(const b of seen)expect(b).toEqual(base);expect(receipt.reviewedProductHead).toBe('a'.repeat(40))}finally{await f.db.close()}
},30000)
test('independent wrong-first image getter refuses once; late loss of same maintenance observation rolls back marker',async()=>{
 const f=await fixture()
 try{
  const i=input(),events:any[]=[],deps=dependencies(i,f.manifest,f.before,events),base=deps.verifyReviewedMaintenanceStop(i.stopReceipt,i.stopReview);let reads=0
  deps.verifyReviewedMaintenanceStop=()=>({...base,get imageDigest(){return ++reads===1?'wrong':base.imageDigest}})
  await expect(runHostedSetupTransactionalUpgrade(f.db as unknown as WorkspaceConnection,i,deps)).rejects.toThrow('Reviewed deployment identity mismatch');expect(reads).toBe(1);expect(events).toHaveLength(0)
  const j=input(),lateEvents:any[]=[],late=dependencies(j,f.manifest,f.before,lateEvents);late.observeMaintenanceStopped=(_b,phase)=>phase==='under_lock_before_commit'?'false':'true'
  await expect(runHostedSetupTransactionalUpgrade(f.db as unknown as WorkspaceConnection,j,late)).rejects.toThrow()
  expect((await f.db.query('select name from neuvetra.schema_migrations where name=$1',[f.manifest[22]!.name])).rows).toHaveLength(0)
  expect(lateEvents.at(-1)).toMatchObject({status:'hosted_setup_transaction_outcome_unknown_do_not_retry',noAutomaticRetry:true})
 }finally{await f.db.close()}
},30000)
```
