/** Inert postcommit observer and one-shot same-image resume. Evidence pins and
 * authorization are supplied by the trusted operator; hashes do not authenticate
 * an actor. Uncertain COMMITs deliberately have no resume path here. */
import {execFile} from 'node:child_process'
import {createHash} from 'node:crypto'
import {open,readFile,realpath,type FileHandle} from 'node:fs/promises'
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import type {HostedSetupDedicatedClientOptions,WorkspaceConnection} from './hosted-setup-dedicated-client'
import {HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE,HOSTED_SETUP_MIGRATION,fingerprintSha256,snapshotHostedSetupDatabase,hash,
 type PinnedArtifact,type HostedSetupFingerprint} from './hosted-setup-upgrade'
import {HOSTED_SETUP_TRANSACTIONAL_PROFILE,type HostedSetupTransactionalReceipt} from './hosted-setup-transactional-upgrade'
import {ARTIFACT_PROFILE,ARTIFACT_SOURCE_PROFILE} from './hosted-setup-artifact-source'
import {FIXED_WORKER_PROFILE,type FixedWorkerOutcome} from './hosted-setup-artifact-worker'
import {DEPLOYMENT_TARGET,type DeploymentBinding,type DeploymentCapture} from './hosted-setup-deployment-binding'
import {captureHostedSetupRailwayDeployment,RAILWAY_CAPTURE_PROFILE,type RailwayCaptureInput} from './hosted-setup-railway-capture'
import {HOSTED_SETUP_RAILWAY_CLI_SHA256} from './hosted-setup-railway-cli'
import {verifyHostedSetupStopped,verifyHostedSetupResume,hostedSetupStoppedVerificationSha256,
 type HostedSetupStoppedVerification,type HostedSetupResumeVerification} from './hosted-setup-postscale'

export const POSTCOMMIT_PROFILE='neuvetra.hosted-setup.postcommit-live.v1' as const
export const POSTCOMMIT_REVIEW_PROFILE='neuvetra.hosted-setup.postcommit-review.v1' as const
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),SHA=/^[a-f0-9]{64}$/
const digest=(value:string)=>createHash('sha256').update(value).digest('hex')
function check(value:unknown,code:string):asserts value{if(!value)throw Error('HS_POSTCOMMIT_'+code)}
function utc(value:string){const n=Date.parse(value);check(Number.isFinite(n)&&new Date(n).toISOString()===value,'TIME_REFUSED');return n}
/** Own data only: capture every caller value before awaiting or executing it. */
function copy<T>(value:T,seen=new Set<object>()):T{
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'){check(typeof value!=='number'||Number.isFinite(value),'DATA_REFUSED');return value}
 check(typeof value==='object'&&!seen.has(value as object)&&seen.size<64,'DATA_REFUSED')
 const source=value as object,array=Array.isArray(source),proto=Object.getPrototypeOf(source)
 check(proto===(array?Array.prototype:Object.prototype)||(!array&&proto===null),'DATA_REFUSED');seen.add(source)
 const ds=Object.getOwnPropertyDescriptors(source),names=Reflect.ownKeys(ds)
 check(names.every(n=>typeof n==='string')&&names.length<100000,'DATA_REFUSED')
 const result:any=array?[]:{}
 for(const name of names as string[]){const d=ds[name]!;check('value'in d,'ACCESSOR_REFUSED');if(array&&name==='length')continue
  check(d.enumerable===true,'DATA_REFUSED');Object.defineProperty(result,name,{value:copy(d.value,seen),enumerable:true})}
 if(array)check(result.length===(source as unknown[]).length&&names.length===result.length+1,'DATA_REFUSED')
 seen.delete(source);return Object.freeze(result) as T
}
function compact<T>(bytes:string):T{check(typeof bytes==='string'&&Buffer.byteLength(bytes)<=16*1024*1024,'BYTES_REFUSED');const text=bytes.trim(),value=JSON.parse(text);check(JSON.stringify(value)===text,'NONCANONICAL_JSON_REFUSED');return copy(value) as T}
function artifact<T>(value:PinnedArtifact):T{check(SHA.test(value.sha256)&&digest(value.bytes)===value.sha256,'ARTIFACT_PIN_REFUSED');return compact<T>(value.bytes)}
function id(value:string){check(typeof value==='string'&&/^[A-Za-z0-9_.:@/-]{1,160}$/.test(value),'ACTOR_REFUSED')}
function rail(value:RailwayCaptureInput){check(value.profile===RAILWAY_CAPTURE_PROFILE&&isAbsolute(value.executablePath)&&isAbsolute(value.workingDirectory)&&Number.isInteger(value.timeoutMs)&&value.timeoutMs>=1000&&value.timeoutMs<=30000,'TRANSPORT_REFUSED')}
function hosted(value:HostedSetupDedicatedClientOptions){check(value.target.kind==='hosted-supabase'&&value.target.expectedProjectRef===HOSTED_SETUP_PROJECT,'HOSTED_TARGET_REQUIRED')}
function outside(root:string,path:string){const r=relative(root,path);return r==='..'||r.startsWith('..'+sep)||isAbsolute(r)}
async function privateDirectory(path:string){check(isAbsolute(path),'PRIVATE_DIRECTORY_REQUIRED');const actual=await realpath(path);check(outside(await realpath(ROOT),actual),'PRIVATE_DIRECTORY_REQUIRED');return actual}

export interface PostcommitInput {
 profile:typeof POSTCOMMIT_PROFILE
 workerOutcome:PinnedArtifact;transactionJournal:PinnedArtifact
 binding:DeploymentBinding;acceptedStop:HostedSetupStoppedVerification;acceptedStopSha256:string
 operatorId:string;observerId:string
 railway:RailwayCaptureInput;database:HostedSetupDedicatedClientOptions
 /** A single retained directory for this operation; never substitute a fresh
  * directory to replay a consumed transaction. Protected by the operator host. */
 evidenceDirectory:string
}
export interface PostcommitObservation {
 profile:typeof POSTCOMMIT_PROFILE;status:'schema23_freshly_observed'
 workerOutcomeSha256:string;transactionJournalSha256:string;transactionReceiptSha256:string
 transaction:HostedSetupTransactionalReceipt;commitResolvedUtc:string
 binding:DeploymentBinding;acceptedStop:HostedSetupStoppedVerification;acceptedStopSha256:string
 operatorId:string;observerId:string;startedUtc:string;completedUtc:string
 snapshotSha256:readonly[string,string];stopped:HostedSetupStoppedVerification
 rawStoppedCaptures:readonly[DeploymentCapture,DeploymentCapture,DeploymentCapture,DeploymentCapture]
 mutationAuthorized:false;databaseWritersExcluded:false;noAutomaticRetry:true
}
export interface PostcommitReview {
 profile:typeof POSTCOMMIT_REVIEW_PROFILE;verdict:'accepted';observationSha256:string
 reviewerId:string;reviewedUtc:string;materialFindingsOpen:0
}
export interface PostcommitResumeInput {
 profile:typeof POSTCOMMIT_PROFILE;observation:PinnedArtifact;review:PinnedArtifact
 /** These pins/identities are independently established, not copied from the
  * untrusted review artifact by an automated caller. */
 policy:{observationSha256:string;reviewSha256:string;operatorId:string;observerId:string;reviewerId:string;
  authorizationReference:string;authorizedTransactionReceiptSha256:string;authorizedImageDigest:string}
 railway:RailwayCaptureInput;database:HostedSetupDedicatedClientOptions;evidenceDirectory:string
}
/** Test seam only, at the same trusted-host boundary as existing capture/stop
 * helpers. Production callers omit it; it is never loaded from an artifact. */
export interface PostcommitRuntime {
 capture(input:RailwayCaptureInput):Promise<DeploymentCapture>
 connect(input:HostedSetupDedicatedClientOptions):Promise<WorkspaceConnection>
 scaleOne(input:RailwayCaptureInput):Promise<string>
 now():string
}
const nativeRuntime:PostcommitRuntime=Object.freeze({
 capture:async(input:RailwayCaptureInput)=>(await captureHostedSetupRailwayDeployment(input)).capture,
 connect:async(input:HostedSetupDedicatedClientOptions)=>(await import('./hosted-setup-dedicated-client')).createHostedSetupDedicatedClient(input),now:()=>new Date().toISOString(),
 scaleOne:async(input:RailwayCaptureInput)=>{
  check(createHash('sha256').update(await readFile(input.executablePath)).digest('hex')===HOSTED_SETUP_RAILWAY_CLI_SHA256,'CLI_PIN_REFUSED')
  const env:NodeJS.ProcessEnv={NO_COLOR:'1'}
  for(const key of ['APPDATA','HOME','LOCALAPPDATA','PATH','SystemRoot','TEMP','TMP','USERPROFILE'])if(process.env[key])env[key]=process.env[key]
  const t=DEPLOYMENT_TARGET
  return new Promise<string>((resolve,reject)=>execFile(input.executablePath,
   ['scale','--project',t.projectId,'--environment',t.environmentId,'--service',t.serviceId,'--json',t.region+'=1'],
   {cwd:input.workingDirectory,encoding:'utf8',windowsHide:true,shell:false,env,timeout:input.timeoutMs,maxBuffer:1024*1024},
   (error,stdout,stderr)=>error||stderr?reject(Error('HS_POSTCOMMIT_SCALE_REFUSED')):resolve(stdout)))
 },
})
function runtimeCopy(source:PostcommitRuntime):PostcommitRuntime{
 const descriptors=Object.getOwnPropertyDescriptors(source),result:any={}
 for(const key of ['capture','connect','scaleOne','now'] as const){const d=descriptors[key];check(d&&'value'in d&&typeof d.value==='function','RUNTIME_REFUSED');result[key]=d.value.bind(source)}
 return Object.freeze(result)
}
function transaction(input:PostcommitInput){
 const worker=artifact<FixedWorkerOutcome>(input.workerOutcome)
 check(worker.profile===FIXED_WORKER_PROFILE&&worker.status==='completed'&&worker.mode==='upgrade'&&worker.transactions===1&&worker.adapterConstructions===1&&worker.databaseMayHaveBeenEntered===true&&worker.noAutomaticRetry===true&&worker.launchAuthorized===false,'WORKER_UNRESOLVED')
 check(SHA.test(input.transactionJournal.sha256)&&digest(input.transactionJournal.bytes)===input.transactionJournal.sha256,'JOURNAL_PIN_REFUSED')
 // exclusiveUpgradeJournal writes a canonical-hashed envelope around each
 // event. Validate the complete persisted chain before interpreting its data.
 const journalBytes=input.transactionJournal.bytes
 check(Buffer.byteLength(journalBytes)<=16*1024*1024&&journalBytes.endsWith('\n'),'JOURNAL_TRUNCATED_OR_OVERSIZED')
 let previousSha256:string|null=null
 const events=journalBytes.slice(0,-1).split('\n').map((line,index)=>{
  const envelope=compact<Record<string,unknown>>(line)
  check(Object.keys(envelope).sort().join('|')==='data|previousSha256|profile|sequence|sha256','JOURNAL_ENVELOPE_REFUSED')
  const {sha256:entrySha256,...body}=envelope
  check(body.profile==='neuvetra.hosted-setup.upgrade-journal.v1'&&body.sequence===index+1&&body.previousSha256===previousSha256,'JOURNAL_CHAIN_REFUSED')
  check(typeof entrySha256==='string'&&SHA.test(entrySha256)&&hash(body)===entrySha256,'JOURNAL_ENTRY_HASH_REFUSED')
  check(body.data!==null&&typeof body.data==='object'&&!Array.isArray(body.data),'JOURNAL_EVENT_REFUSED')
  previousSha256=entrySha256
  return body.data as Record<string,unknown>
 })
 check(events.length===4&&events.map(e=>e.status).join('|')==='hosted_setup_transaction_reserved|hosted_setup_schema22_locked_and_verified|hosted_setup_transaction_verified_pending_commit|hosted_setup_schema23_commit_resolved','COMMIT_UNRESOLVED')
 for(let i=1;i<events.length;i++)check(utc(events[i]!.createdAt as string)>=utc(events[i-1]!.createdAt as string),'COMMIT_CHRONOLOGY_REFUSED')
 const {status:_status,createdAt,noAutomaticRetry,...fields}=events[3]!
 const receipt={status:'hosted_setup_schema23_transaction_committed_and_observed',...fields} as HostedSetupTransactionalReceipt
 const {status:_pendingStatus,createdAt:_pendingTime,...pendingFields}=events[2]!
 check(JSON.stringify(pendingFields)===JSON.stringify(fields)&&noAutomaticRetry===true,'COMMIT_EVIDENCE_REFUSED')
 const receiptSha256=digest(JSON.stringify(receipt))
 check(worker.resultSha256===receiptSha256&&worker.resultStatus===receipt.status&&worker.executionArtifactSha256===receipt.executionArtifactSha256,'WORKER_RECEIPT_MISMATCH')
 check(receipt.profile===HOSTED_SETUP_TRANSACTIONAL_PROFILE&&receipt.projectRef===HOSTED_SETUP_PROJECT&&receipt.schemaVersion===23&&receipt.reviewedProductHead===input.binding.deployedCommit&&receipt.onePhysicalTransaction===true&&receipt.sequenceFenceHeld===true&&receipt.maintenanceStopObserved===true&&receipt.launchAuthorized===false,'TRANSACTION_REFUSED')
 check(receipt.executionArtifactProfile===ARTIFACT_PROFILE&&receipt.artifactSourceProfile===ARTIFACT_SOURCE_PROFILE&&receipt.artifactTrustBoundary==='trusted-operator-host'&&receipt.artifactClaim==='verified-at-rest-artifact-and-private-sql-only'&&receipt.runtimeLoadedCodeAttested===false,'ARTIFACT_BOUNDARY_REFUSED')
 check([receipt.afterFingerprintSha256,receipt.beforeFingerprintSha256,receipt.migrationSha256,receipt.executionArtifactSha256].every(v=>SHA.test(v)),'TRANSACTION_PIN_REFUSED')
 check(hostedSetupStoppedVerificationSha256(input.acceptedStop)===input.acceptedStopSha256&&utc(createdAt as string)>utc(input.acceptedStop.stoppedCompletedUtc),'STOP_PIN_OR_CHRONOLOGY_REFUSED')
 return {receipt:copy(receipt),receiptSha256,commitResolvedUtc:createdAt as string}
}
async function pair(runtime:PostcommitRuntime,railway:RailwayCaptureInput){return copy([await runtime.capture(railway),await runtime.capture(railway)] as const)}
function stopped(binding:DeploymentBinding,prior:HostedSetupStoppedVerification,captures:readonly[DeploymentCapture,DeploymentCapture],now:string){
 const result=verifyHostedSetupStopped(binding,captures,{nowUtc:now,beforeStopConfigurationVersion:null,expectedStoppedConfigurationVersion:prior.stoppedConfigurationVersion})
 check(Object.keys(result).sort().join('|')===Object.keys(prior).sort().join('|'),'STOP_SHAPE_REFUSED')
 const temporal=new Set(['stoppedStartedUtc','stoppedCompletedUtc','stoppedCaptureSha256'])
 for(const name of Object.keys(result) as (keyof HostedSetupStoppedVerification)[])if(!temporal.has(name))check(result[name]===prior[name],'STOP_BINDING_REFUSED')
 check(utc(prior.stoppedCompletedUtc)>utc(prior.stoppedStartedUtc)&&prior.stoppedCaptureSha256.length===2&&prior.stoppedCaptureSha256.every(h=>SHA.test(h))&&new Set(prior.stoppedCaptureSha256).size===2,'STOP_EVIDENCE_REFUSED')
 return result
}
async function snapshot(runtime:PostcommitRuntime,options:HostedSetupDedicatedClientOptions,receipt:HostedSetupTransactionalReceipt){
 const db=await runtime.connect(options)
 let value:HostedSetupFingerprint
 try{value=await snapshotHostedSetupDatabase(db)}finally{await db.close()}
 check(value.projectRef===HOSTED_SETUP_PROJECT&&value.targetProfile===HOSTED_SETUP_PROFILE&&value.schemaVersion===23&&value.receipts[22]?.name===HOSTED_SETUP_MIGRATION&&value.receipts[22]?.sha256===receipt.migrationSha256,'SCHEMA23_REFUSED')
 const pin=fingerprintSha256(value);check(pin===receipt.afterFingerprintSha256,'FRESH_FINGERPRINT_MISMATCH');return pin
}
async function reserve(directory:string,key:string,phase:string){
 const root=await privateDirectory(directory),journal=await open(join(root,key+'.'+phase+'.journal.jsonl'),'wx',0o600)
 return {root,journal,append:async(status:string,extra:Record<string,unknown>={})=>{await journal.writeFile(JSON.stringify({profile:POSTCOMMIT_PROFILE,status,...extra,noAutomaticRetry:true})+'\n');await journal.sync()}}
}
async function persist(file:FileHandle,value:unknown){await file.writeFile(JSON.stringify(value)+'\n');await file.sync()}

/** Reopens two fresh read-only DB transactions after resolved COMMIT. The
 * expected hash was computed after precommit legacy preservation verification. */
export async function observeHostedSetupPostcommit(source:PostcommitInput,supplied:PostcommitRuntime=nativeRuntime):Promise<Readonly<PostcommitObservation>>{
 const input=copy(source),runtime=runtimeCopy(supplied);check(input.profile===POSTCOMMIT_PROFILE,'PROFILE_REFUSED');rail(input.railway);hosted(input.database)
 id(input.operatorId);id(input.observerId);check(input.operatorId!==input.observerId,'INDEPENDENT_OBSERVER_REQUIRED')
 const tx=transaction(input),attempt=await reserve(input.evidenceDirectory,tx.receiptSha256,'observe')
 let output:FileHandle|undefined
 try{
  output=await open(join(attempt.root,tx.receiptSha256+'.observation.json'),'wx',0o600)
  await attempt.append('observation_reserved',{transactionReceiptSha256:tx.receiptSha256})
  const startedUtc=runtime.now();check(utc(startedUtc)>utc(tx.commitResolvedUtc),'OBSERVATION_CHRONOLOGY_REFUSED')
  const before=await pair(runtime,input.railway);stopped(input.binding,input.acceptedStop,before,runtime.now())
  check(utc(before[0].startedUtc)>=utc(startedUtc),'CAPTURE_REPLAY')
  const first=await snapshot(runtime,input.database,tx.receipt),second=await snapshot(runtime,input.database,tx.receipt)
  const snapshotsCompletedUtc=runtime.now(),after=await pair(runtime,input.railway),completedUtc=runtime.now()
  const stop=stopped(input.binding,input.acceptedStop,after,completedUtc)
  check(utc(after[0].startedUtc)>=utc(snapshotsCompletedUtc)&&utc(after[0].startedUtc)>utc(before[1].completedUtc)&&utc(completedUtc)-utc(startedUtc)<=300000,'OBSERVATION_CHRONOLOGY_REFUSED')
  const observation:PostcommitObservation=copy({profile:POSTCOMMIT_PROFILE,status:'schema23_freshly_observed',workerOutcomeSha256:input.workerOutcome.sha256,transactionJournalSha256:input.transactionJournal.sha256,transactionReceiptSha256:tx.receiptSha256,transaction:tx.receipt,commitResolvedUtc:tx.commitResolvedUtc,binding:input.binding,acceptedStop:input.acceptedStop,acceptedStopSha256:input.acceptedStopSha256,operatorId:input.operatorId,observerId:input.observerId,startedUtc,completedUtc,snapshotSha256:[first,second],stopped:stop,rawStoppedCaptures:[...before,...after],mutationAuthorized:false,databaseWritersExcluded:false,noAutomaticRetry:true})
  await persist(output,observation);await output.close();output=undefined
  await attempt.append('observation_saved',{observationSha256:digest(JSON.stringify(observation)+'\n')})
  await attempt.journal.close();return observation
 }catch{try{await attempt.append('observation_refused_stay_stopped')}catch{}throw Error('HS_POSTCOMMIT_OBSERVATION_REFUSED_STAY_STOPPED')}
 finally{let failed=false;try{await output?.close()}catch{failed=true}try{await attempt.journal.close()}catch{failed=true}if(failed)throw Error('HS_POSTCOMMIT_OBSERVATION_REFUSED_STAY_STOPPED')}
}

/** No review/authorization is generated here. A reviewed point-in-time snapshot
 * is rechecked immediately before one scale call. This is not a global DB fence. */
export async function resumeHostedSetupAfterPostcommit(source:PostcommitResumeInput,supplied:PostcommitRuntime=nativeRuntime):Promise<Readonly<HostedSetupResumeVerification>>{
 const input=copy(source),runtime=runtimeCopy(supplied),p=input.policy
 check(input.profile===POSTCOMMIT_PROFILE,'PROFILE_REFUSED');rail(input.railway);hosted(input.database)
 const observation=artifact<PostcommitObservation>(input.observation),review=artifact<PostcommitReview>(input.review)
 check(input.observation.sha256===p.observationSha256&&input.review.sha256===p.reviewSha256,'REVIEW_PIN_REFUSED')
 for(const actor of [p.operatorId,p.observerId,p.reviewerId])id(actor)
 check(new Set([p.operatorId,p.observerId,p.reviewerId]).size===3,'INDEPENDENT_REVIEW_REQUIRED')
 check(observation.profile===POSTCOMMIT_PROFILE&&observation.status==='schema23_freshly_observed'&&observation.operatorId===p.operatorId&&observation.observerId===p.observerId&&observation.mutationAuthorized===false&&observation.databaseWritersExcluded===false,'OBSERVATION_REFUSED')
 check(review.profile===POSTCOMMIT_REVIEW_PROFILE&&review.verdict==='accepted'&&review.materialFindingsOpen===0&&review.observationSha256===input.observation.sha256&&review.reviewerId===p.reviewerId,'REVIEW_REFUSED')
 check(utc(review.reviewedUtc)>utc(observation.completedUtc)&&utc(observation.startedUtc)>utc(observation.commitResolvedUtc),'REVIEW_CHRONOLOGY_REFUSED')
 check(typeof p.authorizationReference==='string'&&p.authorizationReference.trim().length>0&&p.authorizationReference.length<=256&&p.authorizedTransactionReceiptSha256===observation.transactionReceiptSha256&&p.authorizedImageDigest===observation.binding.imageDigest,'EXPLICIT_RESUME_AUTHORITY_REQUIRED')
 check(digest(JSON.stringify(observation.transaction))===observation.transactionReceiptSha256&&observation.transaction.reviewedProductHead===observation.binding.deployedCommit&&observation.snapshotSha256.length===2&&observation.snapshotSha256.every(h=>h===observation.transaction.afterFingerprintSha256),'OBSERVATION_TRANSACTION_MISMATCH')
 check(hostedSetupStoppedVerificationSha256(observation.acceptedStop)===observation.acceptedStopSha256,'STOP_PIN_REFUSED')
 check(observation.rawStoppedCaptures.length===4,'OBSERVATION_CAPTURE_REFUSED')
 const priorPair=observation.rawStoppedCaptures.slice(0,2) as [DeploymentCapture,DeploymentCapture]
 const finalPair=observation.rawStoppedCaptures.slice(2) as [DeploymentCapture,DeploymentCapture]
 stopped(observation.binding,observation.acceptedStop,priorPair,observation.completedUtc)
 const recordedStop=stopped(observation.binding,observation.acceptedStop,finalPair,observation.completedUtc)
 check(hostedSetupStoppedVerificationSha256(recordedStop)===hostedSetupStoppedVerificationSha256(observation.stopped)&&utc(priorPair[0].startedUtc)>=utc(observation.startedUtc)&&utc(finalPair[0].startedUtc)>utc(priorPair[1].completedUtc),'OBSERVATION_CAPTURE_REFUSED')
 const attempt=await reserve(input.evidenceDirectory,observation.transactionReceiptSha256,'resume')
 let output:FileHandle|undefined,attempted=false
 try{
  output=await open(join(attempt.root,observation.transactionReceiptSha256+'.resume.json'),'wx',0o600)
  await attempt.append('resume_reserved',{observationSha256:p.observationSha256,reviewSha256:p.reviewSha256,authorizationReference:p.authorizationReference})
  const now=utc(runtime.now());check(now>=utc(review.reviewedUtc)&&now-utc(review.reviewedUtc)<=300000,'REVIEW_STALE_OR_FUTURE')
  const before=await pair(runtime,input.railway);stopped(observation.binding,observation.stopped,before,runtime.now())
  check(utc(before[0].startedUtc)>utc(review.reviewedUtc),'CAPTURE_REPLAY')
  await snapshot(runtime,input.database,observation.transaction)
  const snapshotCompleted=runtime.now(),last=await pair(runtime,input.railway)
  stopped(observation.binding,observation.stopped,last,runtime.now())
  check(utc(last[0].startedUtc)>=utc(snapshotCompleted)&&utc(last[0].startedUtc)>utc(before[1].completedUtc),'CAPTURE_REPLAY')
  const scaleStartedUtc=runtime.now();check(utc(scaleStartedUtc)>=utc(last[1].completedUtc)&&utc(scaleStartedUtc)-utc(review.reviewedUtc)<=300000,'SCALE_CHRONOLOGY_REFUSED')
  await attempt.append('scale_one_attempt_started',{scaleStartedUtc});attempted=true
  const response=compact<{regions:Record<string,{numReplicas:number}|null>}>(await runtime.scaleOne(input.railway))
  check(Object.keys(response).join('|')==='regions'&&Object.keys(response.regions).join('|')===DEPLOYMENT_TARGET.region,'SCALE_RESPONSE_REFUSED')
  const region=response.regions[DEPLOYMENT_TARGET.region];check(region===null||(region&&Object.keys(region).join('|')==='numReplicas'&&region.numReplicas===1),'SCALE_RESPONSE_REFUSED')
  const scaleCompletedUtc=runtime.now();check(utc(scaleCompletedUtc)>=utc(scaleStartedUtc),'SCALE_CHRONOLOGY_REFUSED')
  const resumed=await pair(runtime,input.railway);check(utc(resumed[0].startedUtc)>=utc(scaleCompletedUtc),'CAPTURE_REPLAY')
  const receipt=verifyHostedSetupResume(observation.binding,observation.acceptedStop,resumed,{nowUtc:runtime.now(),migrationReviewCompletedUtc:review.reviewedUtc,acceptedStoppedVerificationSha256:observation.acceptedStopSha256,expectedResumedConfigurationVersion:null})
  await persist(output,receipt);await output.close();output=undefined
  await attempt.append('resume_observed_pending_finalization',{receiptSha256:digest(JSON.stringify(receipt)+'\n')})
  await attempt.journal.close();return receipt
 }catch{try{await attempt.append(attempted?'resume_outcome_uncertain_do_not_retry':'resume_refused_stay_stopped')}catch{}throw Error(attempted?'HS_POSTCOMMIT_RESUME_OUTCOME_UNCERTAIN_DO_NOT_RETRY':'HS_POSTCOMMIT_RESUME_REFUSED_STAY_STOPPED')}
 finally{let failed=false;try{await output?.close()}catch{failed=true}try{await attempt.journal.close()}catch{failed=true}if(failed)throw Error(attempted?'HS_POSTCOMMIT_RESUME_OUTCOME_UNCERTAIN_DO_NOT_RETRY':'HS_POSTCOMMIT_RESUME_REFUSED_STAY_STOPPED')}
}
