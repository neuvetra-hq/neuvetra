import {expect,test} from 'bun:test'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {DEPLOYMENT_TARGET as T,DEPLOYMENT_REVIEW_PROFILE,createHostedSetupDeploymentReceipt,deploymentBindingSha256,deploymentCaptureSha256,verifyHostedSetupDeploymentBinding,type DeploymentCapture,type DeploymentBindingPolicy} from './hosted-setup-deployment-binding'
import {verifyHostedSetupStopped,hostedSetupStoppedVerificationSha256} from './hosted-setup-postscale'
import {RAILWAY_CAPTURE_PROFILE} from './hosted-setup-railway-capture'
import {HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE,snapshotHostedSetupDatabase,fingerprintSha256,exclusiveUpgradeJournal,hash,type PinnedArtifact} from './hosted-setup-upgrade'
import {HOSTED_SETUP_TRANSACTIONAL_PROFILE} from './hosted-setup-transactional-upgrade'
import {FIXED_WORKER_PROFILE} from './hosted-setup-artifact-worker'
import type {WorkspaceConnection} from './hosted-setup-dedicated-client'
import {POSTCOMMIT_PROFILE,POSTCOMMIT_REVIEW_PROFILE,observeHostedSetupPostcommit,resumeHostedSetupAfterPostcommit,type PostcommitInput,type PostcommitRuntime,type PostcommitResumeInput} from './hosted-setup-postcommit-live'
const IMAGE={deploymentId:'33333333-3333-4333-8333-333333333333',deployedCommit:'b'.repeat(40),imageDigest:'sha256:'+'c'.repeat(64)}
const INSTANCE='22222222-2222-4222-8222-222222222222'
let serial=0
function fixture(){
 const epoch=Date.now()+(++serial)*100_000,at=(ms:number)=>new Date(epoch+ms).toISOString()
 const meta={commitHash:IMAGE.deployedCommit,imageDigest:IMAGE.imageDigest}
 const raw=(replicas:0|1,config:string)=>{
  const deployment={id:IMAGE.deploymentId,status:'SUCCESS',meta,instances:replicas?[{id:INSTANCE,status:'RUNNING'}]:[],deploymentStopped:false}
  const status={id:T.projectId,services:{edges:[{node:{id:T.serviceId,name:'Site-Web'}}]},
   environments:{edges:[{node:{id:T.environmentId,name:'production',canAccess:true,unmergedChangesCount:null,
    serviceInstances:{edges:[{node:{serviceId:T.serviceId,environmentId:T.environmentId,serviceName:'Site-Web',numReplicas:null,
     latestDeployment:structuredClone(deployment),activeDeployments:[structuredClone(deployment)]}}]}}}]}}
  const inventory={data:{service:{id:T.serviceId,projectId:T.projectId,name:'Site-Web'},
   environment:{id:T.environmentId,projectId:T.projectId,name:'production',configEtag:config,unmergedChangesCount:null,
    config:{groups:{},privateNetworkDisabled:false,services:{[T.serviceId]:{build:{},source:{},variables:{},networking:{},
     deploy:{healthcheckPath:'/ready',ipv6EgressEnabled:false,multiRegionConfig:{[T.region]:{numReplicas:replicas}},runtime:'V2',useLegacyStacker:false}}},sharedVariables:{},volumes:{}}},
   environmentStagedChanges:{id:'<empty>',status:'STAGED',patch:{}},serviceInstanceAutoDeployStatus:{enabled:false,canEnable:true,reason:'MANUAL'},
   deployments:{edges:[{cursor:'current',node:{id:IMAGE.deploymentId,status:'SUCCESS',serviceId:T.serviceId,environmentId:T.environmentId,meta:structuredClone(meta)}}],pageInfo:{hasNextPage:false,endCursor:'current'}}}}
  return{statusJson:JSON.stringify(status),inventoryJson:JSON.stringify(inventory)}
 }
 const cap=(ms:number,replicas:0|1,config:string):DeploymentCapture=>({startedUtc:at(ms),completedUtc:at(ms+1000),...raw(replicas,config)})
 const initial:[DeploymentCapture,DeploymentCapture]=[cap(0,1,'d'.repeat(64)),cap(2000,1,'d'.repeat(64))]
 const receiptText=createHostedSetupDeploymentReceipt(initial,IMAGE,'observer')
 const reviewText=JSON.stringify({profile:DEPLOYMENT_REVIEW_PROFILE,verdict:'accepted',receiptSha256:deploymentBindingSha256(receiptText),reviewerId:'reviewer',reviewedUtc:at(4000)})
 const policy:DeploymentBindingPolicy={receiptSha256:deploymentBindingSha256(receiptText),reviewSha256:deploymentBindingSha256(reviewText),authenticatedCaptureSha256:initial.map(deploymentCaptureSha256) as[string,string],expectedImage:{...IMAGE},operatorId:'operator',observerId:'observer',independentReviewerId:'reviewer'}
 const binding=verifyHostedSetupDeploymentBinding(receiptText,reviewText,policy,at(5000))
 return{at,cap,binding}
}

const sha=(s:string)=>createHash('sha256').update(s).digest('hex')
const pin=(value:unknown):PinnedArtifact=>{const bytes=JSON.stringify(value);return {bytes,sha256:sha(bytes)}}
function fakeDb(changed=false):WorkspaceConnection {
 const query=async<T>(sql:string):Promise<{rows:T[]}>=>{
  let rows:unknown[]=[]
  if(sql.includes(' safe from pg_roles'))rows=[{safe:true}]
  else if(sql==='select project_ref,profile from neuvetra.staging_target')rows=[{project_ref:HOSTED_SETUP_PROJECT,profile:HOSTED_SETUP_PROFILE}]
  else if(sql==='select name,sha256 from neuvetra.schema_migrations order by name')rows=Array.from({length:23},(_,i)=>({name:i===22?'0023_company_setup.sql':String(i+1).padStart(4,'0')+'_test.sql',sha256:'a'.repeat(64)}))
  else if(sql.includes("c.relkind='r' order by 1"))rows=[{name:'staging_target'}]
  else if(sql.startsWith('select to_jsonb(t)::text'))rows=[{value:changed?'changed':'{"exact": 9007199254740993}'}]
  return {rows:rows as T[]}
 }
 const tx={query,exec:async()=>{}}
 return {...tx,transaction:async op=>op(tx),close:async()=>{}}
}
async function setup(){
 const f=fixture(),root=await mkdtemp(join(tmpdir(),'hs-postcommit-'))
 const initial=[f.cap(6000,0,'e'.repeat(64)),f.cap(8000,0,'e'.repeat(64))] as const
 const stop=verifyHostedSetupStopped(f.binding,initial,{nowUtc:f.at(10000),beforeStopConfigurationVersion:'d'.repeat(64),expectedStoppedConfigurationVersion:null})
 const after=fingerprintSha256(await snapshotHostedSetupDatabase(fakeDb()))
 const receipt={status:'hosted_setup_schema23_transaction_committed_and_observed',profile:HOSTED_SETUP_TRANSACTIONAL_PROFILE,projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:IMAGE.deployedCommit,executionArtifactSha256:'b'.repeat(64),executionArtifactProfile:'neuvetra.hosted-setup.execution-artifact.v1',artifactSourceProfile:'neuvetra.hosted-setup.private-artifact-sql.v1',artifactTrustBoundary:'trusted-operator-host',artifactClaim:'verified-at-rest-artifact-and-private-sql-only',runtimeLoadedCodeAttested:false,launchAuthorized:false,schemaVersion:23,migrationSha256:'a'.repeat(64),beforeFingerprintSha256:'a'.repeat(64),afterFingerprintSha256:after,onePhysicalTransaction:true,accessExclusiveTables:['staging_target'],sequenceFenceHeld:true,maintenanceStopObserved:true}
 const {status,...fields}=receipt
 const events=[{status:'hosted_setup_transaction_reserved',createdAt:f.at(11000)},{status:'hosted_setup_schema22_locked_and_verified',createdAt:f.at(12000)},{status:'hosted_setup_transaction_verified_pending_commit',createdAt:f.at(13000),...fields},{status:'hosted_setup_schema23_commit_resolved',createdAt:f.at(14000),...fields,noAutomaticRetry:true}]
 const transactionJournalPath=join(root,'transaction.jsonl')
 const actualJournal=await exclusiveUpgradeJournal(transactionJournalPath)
 try{for(const event of events)await actualJournal.append(event)}finally{await actualJournal.close()}
 const bytes=await readFile(transactionJournalPath,'utf8')
 const worker={profile:FIXED_WORKER_PROFILE,status:'completed',mode:'upgrade',workerPid:1,adapterConstructions:1,transactions:1,databaseMayHaveBeenEntered:true,resultStatus:status,resultSha256:sha(JSON.stringify(receipt)),executionArtifactSha256:receipt.executionArtifactSha256,launchAuthorized:false,noAutomaticRetry:true}
 const input:PostcommitInput={profile:POSTCOMMIT_PROFILE,workerOutcome:pin(worker),transactionJournal:{bytes,sha256:sha(bytes)},binding:f.binding,acceptedStop:stop,acceptedStopSha256:hostedSetupStoppedVerificationSha256(stop),operatorId:'operator',observerId:'observer',railway:{profile:RAILWAY_CAPTURE_PROFILE,executablePath:process.execPath,workingDirectory:root,timeoutMs:1000},database:{connectionString:'private-test-only',target:{kind:'hosted-supabase',expectedProjectRef:HOSTED_SETUP_PROJECT,caPem:'private-test-only'}},evidenceDirectory:root}
 let time=15000,captureCount=0,connectCount=0,scaleCount=0,changed=false,scaleError=false,changedImage=false,afterScaleImage=false,closeError=false
 const runtime:PostcommitRuntime={now:()=>f.at(time++),capture:async()=>{time+=1000;const capture=f.cap(time,scaleCount?1:0,scaleCount?'f'.repeat(64):'e'.repeat(64));time+=1001;captureCount++;return changedImage||(afterScaleImage&&scaleCount>0)?{...capture,statusJson:capture.statusJson.replaceAll(IMAGE.imageDigest,'sha256:'+'9'.repeat(64))}:capture},connect:async()=>{connectCount++;const db=fakeDb(changed);return closeError?{...db,close:async()=>{throw Error('PRIVATE_CLOSE_DETAIL')}}:db},scaleOne:async()=>{scaleCount++;if(scaleError)throw Error('PRIVATE_FAILURE');return JSON.stringify({regions:{[T.region]:{numReplicas:1}}})}}
 const resume=async()=>{
  const observation=await observeHostedSetupPostcommit(input,runtime),observationPin=pin(observation)
  const review=pin({profile:POSTCOMMIT_REVIEW_PROFILE,verdict:'accepted',observationSha256:observationPin.sha256,reviewerId:'reviewer',reviewedUtc:runtime.now(),materialFindingsOpen:0})
  const request:PostcommitResumeInput={profile:POSTCOMMIT_PROFILE,observation:observationPin,review,policy:{observationSha256:observationPin.sha256,reviewSha256:review.sha256,operatorId:'operator',observerId:'observer',reviewerId:'reviewer',authorizationReference:'board-authorized-test-only',authorizedTransactionReceiptSha256:observation.transactionReceiptSha256,authorizedImageDigest:IMAGE.imageDigest},railway:input.railway,database:input.database,evidenceDirectory:root}
  return request
 }
 return {input,runtime,resume,root,stats:()=>({captureCount,connectCount,scaleCount}),changeDb:()=>{changed=true},breakScale:()=>{scaleError=true},changeImage:()=>{changedImage=true},changeResumedImage:()=>{afterScaleImage=true},breakClose:()=>{closeError=true},advance:()=>{time+=300001}}
}

test('composed resolved worker, real fingerprint collector, observer, independent review and same-image resume',async()=>{
 const s=await setup(),input=await s.resume()
 expect(s.stats().connectCount).toBe(2)
 const result=await resumeHostedSetupAfterPostcommit(input,s.runtime)
 expect(result.imageDigest).toBe(IMAGE.imageDigest);expect(s.stats().scaleCount).toBe(1);expect(s.stats().connectCount).toBe(3)
 expect(await readFile(join(s.root,input.policy.authorizedTransactionReceiptSha256+'.resume.journal.jsonl'),'utf8')).toContain('resume_observed_pending_finalization')
 await expect(resumeHostedSetupAfterPostcommit(input,s.runtime)).rejects.toThrow();expect(s.stats().scaleCount).toBe(1)
 await expect(observeHostedSetupPostcommit(s.input,s.runtime)).rejects.toThrow();expect(s.stats().connectCount).toBe(3)
})

test('unknown worker result and tampered pinned journal refuse before database/provider use',async()=>{
 for(const kind of ['unknown','tamper','pending'] as const){const s=await setup()
  if(kind==='unknown')s.input.workerOutcome=pin({...JSON.parse(s.input.workerOutcome.bytes),status:'refused_or_uncertain'})
  if(kind==='tamper')s.input.transactionJournal.bytes+=' '
  if(kind==='pending'){const bytes=s.input.transactionJournal.bytes.trim().split('\n').slice(0,-1).join('\n')+'\n';s.input.transactionJournal={bytes,sha256:sha(bytes)}}
  await expect(observeHostedSetupPostcommit(s.input,s.runtime)).rejects.toThrow();expect(s.stats()).toEqual({captureCount:0,connectCount:0,scaleCount:0})
 }
})

test('fresh DB mismatch prevents observation and before-resume mismatch prevents scale',async()=>{
 const initial=await setup();initial.changeDb();await expect(observeHostedSetupPostcommit(initial.input,initial.runtime)).rejects.toThrow('STAY_STOPPED');expect(initial.stats().scaleCount).toBe(0)
 const s=await setup(),input=await s.resume();s.changeDb();await expect(resumeHostedSetupAfterPostcommit(input,s.runtime)).rejects.toThrow('STAY_STOPPED');expect(s.stats().scaleCount).toBe(0)
})

test('self review, missing authority, stale review and changed image all fail before scale',async()=>{
 for(const kind of ['self','authority','stale','image','review-tamper'] as const){const s=await setup(),input=await s.resume()
  if(kind==='self')input.policy.reviewerId='observer'
  if(kind==='authority')input.policy.authorizationReference=''
  if(kind==='stale')s.advance()
  if(kind==='image')s.changeImage()
  if(kind==='review-tamper')input.review.bytes+=' '
  await expect(resumeHostedSetupAfterPostcommit(input,s.runtime)).rejects.toThrow();expect(s.stats().scaleCount).toBe(0)
 }
})

test('ambiguous scale stays uncertain, redacts provider errors and cannot replay',async()=>{
 const s=await setup(),input=await s.resume();s.breakScale()
 await expect(resumeHostedSetupAfterPostcommit(input,s.runtime)).rejects.toThrow('HS_POSTCOMMIT_RESUME_OUTCOME_UNCERTAIN_DO_NOT_RETRY')
 const journal=await readFile(join(s.root,input.policy.authorizedTransactionReceiptSha256+'.resume.journal.jsonl'),'utf8')
 expect(journal).toContain('resume_outcome_uncertain_do_not_retry');expect(journal).not.toContain('PRIVATE_FAILURE')
 await expect(resumeHostedSetupAfterPostcommit(input,s.runtime)).rejects.toThrow();expect(s.stats().scaleCount).toBe(1)
})

test('accessors are refused without execution',async()=>{
 const s=await setup();let called=0
 Object.defineProperty(s.input,'workerOutcome',{enumerable:true,get(){called++;throw Error('secret')}})
 await expect(observeHostedSetupPostcommit(s.input,s.runtime)).rejects.toThrow('ACCESSOR_REFUSED');expect(called).toBe(0)
})

test('a changed resumed image is uncertain after exactly one mutation',async()=>{
 const s=await setup(),input=await s.resume();s.changeResumedImage()
 await expect(resumeHostedSetupAfterPostcommit(input,s.runtime)).rejects.toThrow('OUTCOME_UNCERTAIN_DO_NOT_RETRY')
 expect(s.stats().scaleCount).toBe(1)
 expect(await readFile(join(s.root,input.policy.authorizedTransactionReceiptSha256+'.resume.json'),'utf8')).toBe('')
})

test('database close failure cannot issue observation or resume authority',async()=>{
 const s=await setup();s.breakClose()
 await expect(observeHostedSetupPostcommit(s.input,s.runtime)).rejects.toThrow('HS_POSTCOMMIT_OBSERVATION_REFUSED_STAY_STOPPED')
 expect(s.stats().connectCount).toBe(1);expect(s.stats().scaleCount).toBe(0)
 const t=await setup(),input=await t.resume();t.breakClose()
 await expect(resumeHostedSetupAfterPostcommit(input,t.runtime)).rejects.toThrow('HS_POSTCOMMIT_RESUME_REFUSED_STAY_STOPPED');expect(t.stats().scaleCount).toBe(0)
})

test('unreviewed replacement of exact observation or accepted stop fails before scale',async()=>{
 for(const kind of ['observation','stop'] as const){const s=await setup(),input=await s.resume()
  if(kind==='observation')input.observation=pin({...JSON.parse(input.observation.bytes),snapshotSha256:['0'.repeat(64),'0'.repeat(64)]})
  else{const obs=JSON.parse(input.observation.bytes);obs.acceptedStop.resumeAuthorized=true;input.observation=pin(obs)}
  await expect(resumeHostedSetupAfterPostcommit(input,s.runtime)).rejects.toThrow('REVIEW_PIN_REFUSED');expect(s.stats().scaleCount).toBe(0)
 }
})

test('native journal chain tampering, reordering, bare events and truncation fail before observation',async()=>{
 for(const kind of ['event-data','entry-hash','previous-hash','sequence','reorder','extra-field','bare','truncate-line','missing-newline'] as const){
  const s=await setup(),entries=s.input.transactionJournal.bytes.trim().split('\n').map(line=>JSON.parse(line))
  if(kind==='event-data')entries[0].data.createdAt='2000-01-01T00:00:00.000Z'
  if(kind==='entry-hash')entries[1].sha256='0'.repeat(64)
  if(kind==='previous-hash'){
   entries[1].previousSha256='0'.repeat(64)
   const {sha256:_old,...body}=entries[1];entries[1].sha256=hash(body)
  }
  if(kind==='sequence'){
   entries[0].sequence=0
   const {sha256:_old,...body}=entries[0];entries[0].sha256=hash(body)
  }
  if(kind==='reorder')[entries[0],entries[1]]=[entries[1],entries[0]]
  if(kind==='extra-field')entries[0].unreviewed=true
  let bytes=entries.map(entry=>JSON.stringify(kind==='bare'?entry.data:entry)).join('\n')+'\n'
  if(kind==='truncate-line')bytes=bytes.slice(0,-20)+'\n'
  if(kind==='missing-newline')bytes=bytes.slice(0,-1)
  // Refresh the outer pin so each case exercises the chain verifier itself.
  s.input.transactionJournal={bytes,sha256:sha(bytes)}
  await expect(observeHostedSetupPostcommit(s.input,s.runtime)).rejects.toThrow()
  expect(s.stats()).toEqual({captureCount:0,connectCount:0,scaleCount:0})
 }
})

