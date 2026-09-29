import {describe,expect,test} from 'bun:test'
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import type {FixedBindingContext} from './hosted-setup-artifact-worker'
import {ARTIFACT_PROFILE,ARTIFACT_SOURCE_PROFILE,PUBLICATION_PROFILE} from './hosted-setup-artifact-source'
import {FRESH_RESTORE_POLICY_PROFILE} from './hosted-setup-fresh-restore-binding'
import {DEPLOYMENT_BINDING_PROFILE,DEPLOYMENT_REVIEW_PROFILE,DEPLOYMENT_TARGET,createHostedSetupDeploymentReceipt,deploymentCaptureSha256,verifyHostedSetupDeploymentBinding} from './hosted-setup-deployment-binding'
import {HOSTED_SETUP_LIVE_STOP_PROFILE,stopHostedSetupExactImage,type LiveStopRuntime} from './hosted-setup-live-stop'
import {verifyHostedSetupStopped} from './hosted-setup-postscale'
import {RAILWAY_CAPTURE_PROFILE} from './hosted-setup-railway-capture'
import {HOSTED_SETUP_PROFILE,HOSTED_SETUP_PROJECT,canonical,sha256,type PinnedArtifact} from './hosted-setup-upgrade'
import {
 FIXED_ARTIFACT_BINDINGS_PAYLOAD_PROFILE,FIXED_ARTIFACT_RECONCILIATION_PAYLOAD_PROFILE,
 prepareHostedSetupArtifactReconciliation,prepareHostedSetupArtifactUpgrade,
} from './hosted-setup-artifact-bindings'

const HEAD='a'.repeat(40),OPERATOR='operator',ARTIFACT_REVIEWER='artifact-reviewer',STOP_REVIEWER='stop-reviewer'
const IMAGE={deploymentId:'8946ec8e-3dba-484c-8f84-80fa71d8da5f',deployedCommit:HEAD,imageDigest:'sha256:'+'8'.repeat(64)}
const pin=(bytes:string):PinnedArtifact=>({bytes,sha256:sha256(bytes)})
const jpin=(value:unknown)=>pin(JSON.stringify(value))
const now=()=>Date.now()
function headEvidence(observedAtMs:number,expiresAtMs:number){return jpin({profile:'neuvetra.hosted-setup.authenticated-pr-head.v1',repository:'neuvetra-hq/neuvetra',pullRequest:6,head:HEAD,observedAtMs,expiresAtMs})}
function reviewEvidence(reviewedAtMs:number,expiresAtMs:number){return jpin({profile:'neuvetra.hosted-setup.authenticated-pr-review.v1',repository:'neuvetra-hq/neuvetra',pullRequest:6,head:HEAD,operatorId:OPERATOR,independentReviewerId:ARTIFACT_REVIEWER,verdict:'accepted',materialFindingsOpen:0,reviewedAtMs,expiresAtMs})}
function capture(startedUtc:string,completedUtc:string){return{startedUtc,completedUtc,statusJson:'{}',inventoryJson:'{}'}}
function providerCapture(clock:number,startOffset:number,replicas:0|1,configurationVersion:string){
 const instances=replicas?[{id:'33333333-3333-4333-8333-333333333333',status:'RUNNING'}]:[],meta={commitHash:HEAD,imageDigest:IMAGE.imageDigest},active={id:IMAGE.deploymentId,status:'SUCCESS',meta,instances,deploymentStopped:false}
 const status={id:DEPLOYMENT_TARGET.projectId,services:{edges:[{node:{id:DEPLOYMENT_TARGET.serviceId,name:'Site-Web'}}]},environments:{edges:[{node:{id:DEPLOYMENT_TARGET.environmentId,name:'production',canAccess:true,unmergedChangesCount:null,serviceInstances:{edges:[{node:{serviceId:DEPLOYMENT_TARGET.serviceId,environmentId:DEPLOYMENT_TARGET.environmentId,serviceName:'Site-Web',numReplicas:null,region:null,latestDeployment:structuredClone(active),activeDeployments:[structuredClone(active)]}}]}}}]}}
 const region=replicas?{numReplicas:1}:null
 const inventory={data:{service:{id:DEPLOYMENT_TARGET.serviceId,projectId:DEPLOYMENT_TARGET.projectId,name:'Site-Web'},environment:{id:DEPLOYMENT_TARGET.environmentId,projectId:DEPLOYMENT_TARGET.projectId,name:'production',configEtag:configurationVersion,unmergedChangesCount:null,config:{groups:{},privateNetworkDisabled:false,services:{[DEPLOYMENT_TARGET.serviceId]:{build:{},deploy:{healthcheckPath:'/ready',ipv6EgressEnabled:false,multiRegionConfig:{[DEPLOYMENT_TARGET.region]:region},runtime:'V2',useLegacyStacker:false},networking:{},source:{},variables:{}}},sharedVariables:{},volumes:{}}},environmentStagedChanges:{id:'<empty>',status:'STAGED',patch:{}},serviceInstanceAutoDeployStatus:{enabled:false,canEnable:true,reason:'MANUAL'},deployments:{edges:[{cursor:'current',node:{id:IMAGE.deploymentId,status:'SUCCESS',serviceId:DEPLOYMENT_TARGET.serviceId,environmentId:DEPLOYMENT_TARGET.environmentId,meta}}],pageInfo:{hasNextPage:false,endCursor:'current'}}}}
 return{startedUtc:new Date(clock+startOffset).toISOString(),completedUtc:new Date(clock+startOffset+100).toISOString(),statusJson:JSON.stringify(status),inventoryJson:JSON.stringify(inventory)}
}
function validMaintenance(value:any,clock:number){
 const running:[any,any]=[providerCapture(clock,-7000,1,'c'.repeat(64)),providerCapture(clock,-6500,1,'c'.repeat(64))]
 const deploymentReceipt=pin(createHostedSetupDeploymentReceipt(running,IMAGE,'provider-observer'))
 const deploymentReview=jpin({profile:DEPLOYMENT_REVIEW_PROFILE,verdict:'accepted',receiptSha256:deploymentReceipt.sha256,reviewerId:STOP_REVIEWER,reviewedUtc:new Date(clock-6000).toISOString()})
 const deploymentPolicy:any={receiptSha256:deploymentReceipt.sha256,reviewSha256:deploymentReview.sha256,authenticatedCaptureSha256:running.map(deploymentCaptureSha256),expectedImage:{...IMAGE},operatorId:OPERATOR,observerId:'provider-observer',independentReviewerId:STOP_REVIEWER}
 const binding:any={profile:DEPLOYMENT_BINDING_PROFILE,...DEPLOYMENT_TARGET,...IMAGE,receiptSha256:deploymentReceipt.sha256,reviewSha256:deploymentReview.sha256,mutationAuthorized:false}
 const stopped:[any,any]=[providerCapture(clock,-5000,0,'d'.repeat(64)),providerCapture(clock,-4500,0,'d'.repeat(64))]
 const stoppedPolicy={nowUtc:new Date(clock-4300).toISOString(),beforeStopConfigurationVersion:'c'.repeat(64),expectedStoppedConfigurationVersion:'d'.repeat(64)}
 const stoppedVerification=verifyHostedSetupStopped(binding,stopped,stoppedPolicy),stopReceipt=pin(JSON.stringify(stoppedVerification))
 const stopReview=jpin({profile:'neuvetra.hosted-setup.maintenance-stop-review.v2',verdict:'accepted',stopReceiptSha256:stopReceipt.sha256,deploymentReceiptSha256:deploymentReceipt.sha256,deploymentReviewSha256:deploymentReview.sha256,operatorId:OPERATOR,independentReviewerId:STOP_REVIEWER,reviewedUtc:new Date(clock-4000).toISOString(),materialFindingsOpen:0,availabilityStopObserved:true,databaseWritersExcluded:false,migrationAuthorized:false})
 Object.assign(value.maintenance,{deploymentReceipt,deploymentReview,deploymentPolicy,stoppedCaptures:stopped,stoppedPolicy,stopReceipt,stopReview})
 value.trustedPins.deploymentPolicySha256=sha256(canonical(deploymentPolicy));value.trustedPins.stopReviewSha256=stopReview.sha256
}

async function fixture(changes?:(value:any)=>void|Promise<void>,archiveSize=7){
 const clock=now(),historical=headEvidence(clock-2000,clock+120000),current=headEvidence(clock-100,clock+120000),review=reviewEvidence(clock-1500,clock+120000)
 const publication:any={profile:PUBLICATION_PROFILE,trustBoundary:'trusted-operator-host',reviewedProductHead:HEAD,repository:'neuvetra-hq/neuvetra',pullRequest:6,operatorId:OPERATOR,independentReviewerId:ARTIFACT_REVIEWER,materialFindingsOpen:0,observedAtMs:clock-1800,expiresAtMs:clock+120000,checks:[{name:'required',head:HEAD,conclusion:'success'}],publisherEvidence:{profile:'neuvetra.hosted-setup.offline-artifact-publisher.v1',sourceRead:'exact-clean-git-commit',gitSha256:'1'.repeat(64),headEvidenceSha256:historical.sha256,checksEvidenceSha256:'2'.repeat(64),reviewEvidenceSha256:review.sha256},sourceFiles:[],dependencyFiles:[],migrations:[],migrationManifestSha256:'3'.repeat(64),artifact:{}}
 const publicationBytes=JSON.stringify(publication),root=await mkdtemp(join(tmpdir(),'hosted-artifact-bindings-')),artifactRoot=join(root,'artifact'),evidenceRoot=join(root,'private-evidence'),publicationPath=join(artifactRoot,'publication.json');await mkdir(artifactRoot,{recursive:true});await mkdir(evidenceRoot,{recursive:true});await writeFile(publicationPath,publicationBytes)
 const fileRef=async(name:string,bytes:string|Uint8Array)=>{const path=join(evidenceRoot,name);await writeFile(path,bytes);const raw=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;return{path,sha256:sha256(raw),byteLength:raw.byteLength}}
 const evidence:any={sourceReceipt:await fileRef('source-receipt.json','source-receipt'),sourceArchive:await fileRef('source-archive.bin',new Uint8Array(archiveSize).fill(7)),sourceSnapshot:await fileRef('source-snapshot.json','source-snapshot'),restoredState:await fileRef('restored-state.json','restored-state'),restoreResult:await fileRef('restore-result.json','restore-result'),restoreObservation:await fileRef('restore-observation.json','restore-observation'),fingerprintDerivation:await fileRef('fingerprint-derivation.json','fingerprint-derivation'),restoreReview:await fileRef('restore-review.json','restore-review'),fingerprintReview:await fileRef('fingerprint-review.json','fingerprint-review')}
 const policy:any={profile:FRESH_RESTORE_POLICY_PROFILE,projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,notBeforeUtc:new Date(clock-5000).toISOString(),maxAgeMs:60000,operatorId:OPERATOR,restoreReviewerId:'restore-reviewer',fingerprintReviewerId:'fingerprint-reviewer',artifactSha256:{sourceReceipt:evidence.sourceReceipt.sha256,sourceArchive:evidence.sourceArchive.sha256,sourceSnapshot:evidence.sourceSnapshot.sha256,restoredState:evidence.restoredState.sha256,restoreResult:evidence.restoreResult.sha256,restoreObservation:evidence.restoreObservation.sha256,fingerprintDerivation:evidence.fingerprintDerivation.sha256},restoreReviewSha256:evidence.restoreReview.sha256,fingerprintReviewSha256:evidence.fingerprintReview.sha256,sourceStateSha256:'4'.repeat(64),restoredStateSha256:'5'.repeat(64),expectedDatabaseFingerprintSha256:'6'.repeat(64),sourceExternalDefaultAclsSha256:'7'.repeat(64),sourceExternalDefaultAclCount:0}
 const deploymentReceipt=jpin({profile:'candidate'}),deploymentReview=jpin({profile:DEPLOYMENT_REVIEW_PROFILE}),deploymentPolicy:any={receiptSha256:deploymentReceipt.sha256,reviewSha256:deploymentReview.sha256,authenticatedCaptureSha256:['9'.repeat(64),'a'.repeat(64)],expectedImage:{...IMAGE},operatorId:OPERATOR,observerId:'provider-observer',independentReviewerId:STOP_REVIEWER}
 const stopReceipt=jpin({profile:'candidate-stop'}),stopReview=jpin({profile:'candidate-stop-review'})
 const first=capture(new Date(clock-1400).toISOString(),new Date(clock-1300).toISOString()),second=capture(new Date(clock-1200).toISOString(),new Date(clock-1100).toISOString())
 const payload:any={profile:FIXED_ARTIFACT_BINDINGS_PAYLOAD_PROFILE,attemptId:'11111111-1111-4111-8111-111111111111',database:{connectionString:`postgresql://postgres:${encodeURIComponent('secret')}@db.${HOSTED_SETUP_PROJECT}.supabase.co:5432/postgres`,caPem:'-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----'},trustedPins:{freshRestorePolicySha256:sha256(canonical(policy)),deploymentPolicySha256:sha256(canonical(deploymentPolicy)),currentHeadEvidenceSha256:current.sha256,stopReviewSha256:stopReview.sha256},restore:{evidence,policy},publication:{review,headEvidence:historical,currentHeadEvidence:current},maintenance:{deploymentReceipt,deploymentReview,deploymentPolicy,stoppedCaptures:[first,second],stoppedPolicy:{nowUtc:new Date(clock-1000).toISOString(),beforeStopConfigurationVersion:null,expectedStoppedConfigurationVersion:null},stopReceipt,stopReview,railwayCaptureInput:{profile:RAILWAY_CAPTURE_PROFILE,executablePath:resolve(root,'missing-railway.exe'),workingDirectory:root,timeoutMs:1000}}}
 await changes?.(payload)
 const inspection:any={profile:ARTIFACT_PROFILE,trustBoundary:'trusted-operator-host',claim:'verified-at-rest-artifact-and-private-sql-only',reviewedProductHead:HEAD,publicationSha256:sha256(publicationBytes),executionArtifactSha256:'b'.repeat(64),migrationManifestSha256:'3'.repeat(64),sourceRoot:root,dependencyRoot:root,runtimeExecutable:resolve(root,'bun.exe'),operatorId:OPERATOR,independentReviewerId:ARTIFACT_REVIEWER,launchAuthorized:false}
 const context:any={profile:'neuvetra.hosted-setup.fixed-artifact-worker.v1',mode:'upgrade',paths:{publication:publicationPath,sourceArchive:resolve(artifactRoot,'source.tar'),dependencyArchive:resolve(artifactRoot,'deps.tar'),sourceRoot:resolve(artifactRoot,'source'),dependencyRoot:resolve(artifactRoot,'dependencies'),runtimeExecutable:resolve(artifactRoot,'bun.exe'),supervisor:resolve(artifactRoot,'supervisor.ts'),config:resolve(artifactRoot,'bunfig.toml')},policy:{publicationSha256:inspection.publicationSha256,reviewedProductHead:HEAD,operatorId:OPERATOR,independentReviewerId:ARTIFACT_REVIEWER,requiredChecks:['required'],activeCheckoutRoots:[resolve(root,'checkout')]},transactionJournalPath:resolve(root,'transaction.jsonl'),payload,deadlineMs:300000,inspection}
 return{context:context as FixedBindingContext,payload,publicationArtifact:pin(publicationBytes),review,current,stopReceipt,stopReview,first,second}
}

async function fixedReader(context:FixedBindingContext){
 const bindings=new URL('./hosted-setup-artifact-bindings.ts',import.meta.url).href
 const script=`const {prepareHostedSetupArtifactUpgrade}=await import(${JSON.stringify(bindings)});try{const context=JSON.parse(await Bun.stdin.text()),prepared=await prepareHostedSetupArtifactUpgrade(context),stop=prepared.dependencies.verifyReviewedMaintenanceStop(prepared.input.stopReceipt,prepared.input.stopReview);let replay='';try{prepared.dependencies.verifyReviewedMaintenanceStop(prepared.input.stopReceipt,prepared.input.stopReview)}catch(error){replay=String(error)}console.log(JSON.stringify({accepted:true,stopReceiptSha256:stop.stopReceiptSha256,replay}))}catch(error){console.log(JSON.stringify({accepted:false,error:String(error)}))}`
 const child=Bun.spawn([process.execPath,'--no-env-file','--no-install','--eval',script],{stdin:'pipe',stdout:'pipe',stderr:'pipe',windowsHide:true})
 await child.stdin.write(JSON.stringify(context));await child.stdin.end()
 const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited])
 expect(code).toBe(0);expect(stderr).toBe('')
 return JSON.parse(stdout) as {accepted:boolean;stopReceiptSha256?:string;replay?:string;error?:string}
}

describe('fixed hosted setup artifact bindings',()=>{
 test('copies exact trusted-host payload and binds publication/current head without caller callbacks',async()=>{
  const f=await fixture(),prepared=await prepareHostedSetupArtifactUpgrade(f.context)
  f.payload.database.connectionString='mutated';f.payload.publication.currentHeadEvidence.bytes='mutated'
  expect(prepared.clientOptions).toMatchObject({connectionString:expect.stringContaining(`db.${HOSTED_SETUP_PROJECT}.supabase.co`),target:{kind:'hosted-supabase',expectedProjectRef:HOSTED_SETUP_PROJECT},transactionTimeoutMs:180000,applicationName:'neuvetra-hosted-setup-11111111-1111-4111-8111-111111111111'})
  expect(prepared.input).toMatchObject({reviewedProductHead:HEAD,operatorId:OPERATOR,publicationReviewerId:ARTIFACT_REVIEWER,stopReviewerId:STOP_REVIEWER,journalPath:f.context.transactionJournalPath})
  const product=prepared.dependencies.verifyReviewedExecutionArtifact(f.publicationArtifact,f.review)
  expect(product).toMatchObject({profile:'neuvetra.hosted-setup.reviewed-execution-artifact-binding.v1',reviewedProductHead:HEAD,remoteHead:HEAD,executionArtifactProfile:ARTIFACT_PROFILE,artifactSourceProfile:ARTIFACT_SOURCE_PROFILE,executionArtifactSha256:'b'.repeat(64),runtimeLoadedCodeAttested:false,launchAuthorized:false})
  expect(await prepared.dependencies.currentProductHead()).toBe(HEAD)
  expect(()=>prepared.dependencies.verifyReviewedExecutionArtifact(pin('wrong'),f.review)).toThrow('PUBLICATION_CALLBACK_CHANGED')
  expect(()=>prepared.dependencies.verifyAcceptedRestore(pin('wrong'),prepared.input.restoreReview,prepared.input.fingerprintDerivation,prepared.input.fingerprintDerivationReview)).toThrow('RESTORE_RECEIPT_CALLBACK_CHANGED')
  await expect(prepared.dependencies.observeMaintenanceStopped({} as never,'before_transaction')).rejects.toThrow('MAINTENANCE_OBSERVER_STATE_REFUSED')
 })

 test('refuses stale or untrusted current-head evidence and exact-shape drift before database access',async()=>{
  const stale=await fixture(value=>{const t=Date.now();value.publication.currentHeadEvidence=headEvidence(t-600000,t+60000);value.trustedPins.currentHeadEvidenceSha256=value.publication.currentHeadEvidence.sha256})
  await expect(prepareHostedSetupArtifactUpgrade(stale.context)).rejects.toThrow('CURRENT_PR_HEAD_STALE')
  const changed=await fixture(value=>{value.extra=true})
  await expect(prepareHostedSetupArtifactUpgrade(changed.context)).rejects.toThrow('SHAPE_REFUSED')
  const pinSwap=await fixture(value=>{value.trustedPins.stopReviewSha256='0'.repeat(64)})
  await expect(prepareHostedSetupArtifactUpgrade(pinSwap.context)).rejects.toThrow('STOP_REVIEW_TRUST_PIN_REFUSED')
 })

 test('refuses array accessors, custom iteration, sparse indices and extra properties without invoking caller code',async()=>{
  const accessor=await fixture(),original=accessor.payload.maintenance.stoppedCaptures[0];let accessorReads=0
  Object.defineProperty(accessor.payload.maintenance.stoppedCaptures,'0',{enumerable:true,get(){accessorReads++;return original}})
  await expect(prepareHostedSetupArtifactUpgrade(accessor.context)).rejects.toThrow('PAYLOAD_ACCESSOR_REFUSED')
  expect(accessorReads).toBe(0)

  const customMap=await fixture();let mapCalls=0
  Object.defineProperty(customMap.payload.maintenance.stoppedCaptures,'map',{enumerable:true,value(){mapCalls++;return []}})
  await expect(prepareHostedSetupArtifactUpgrade(customMap.context)).rejects.toThrow('PAYLOAD_ARRAY_REFUSED')
  expect(mapCalls).toBe(0)

  const customPrototype=await fixture(),prototype=Object.create(Array.prototype);let inheritedMapCalls=0
  Object.defineProperty(prototype,'map',{value(){inheritedMapCalls++;return []}})
  Object.setPrototypeOf(customPrototype.payload.maintenance.stoppedCaptures,prototype)
  await expect(prepareHostedSetupArtifactUpgrade(customPrototype.context)).rejects.toThrow('PAYLOAD_ARRAY_PROTOTYPE_REFUSED')
  expect(inheritedMapCalls).toBe(0)

  const sparse=await fixture();delete sparse.payload.maintenance.stoppedCaptures[0]
  await expect(prepareHostedSetupArtifactUpgrade(sparse.context)).rejects.toThrow('PAYLOAD_ARRAY_REFUSED')
  const extra=await fixture();extra.payload.maintenance.stoppedCaptures.extra='caller-selected'
  await expect(prepareHostedSetupArtifactUpgrade(extra.context)).rejects.toThrow('PAYLOAD_ARRAY_REFUSED')
  const symbol=await fixture();symbol.payload.maintenance.stoppedCaptures[Symbol('caller-selected')]='value'
  await expect(prepareHostedSetupArtifactUpgrade(symbol.context)).rejects.toThrow('PAYLOAD_ARRAY_REFUSED')
 })

 test('revalidates pinned publication review, receipt and current head at deferred product consumption',async()=>{
  const savedNow=Date.now,clock=savedNow()
  try{
   Date.now=()=>clock
   const reviewExpiry=await fixture(),review=JSON.parse(reviewExpiry.review.bytes);review.expiresAtMs=clock+100
   reviewExpiry.payload.publication.review=jpin(review)
   const publication=JSON.parse(reviewExpiry.publicationArtifact.bytes);publication.publisherEvidence.reviewEvidenceSha256=reviewExpiry.payload.publication.review.sha256
   const revised=jpin(publication);await writeFile(reviewExpiry.context.paths.publication,revised.bytes);reviewExpiry.context.inspection.publicationSha256=revised.sha256;reviewExpiry.context.policy.publicationSha256=revised.sha256
   const prepared=await prepareHostedSetupArtifactUpgrade(reviewExpiry.context)
   Date.now=()=>clock+1000
   expect(prepared.dependencies.currentProductHead()).toBe(HEAD)
   expect(()=>prepared.dependencies.verifyReviewedExecutionArtifact(prepared.input.publicationReceipt,prepared.input.publicationReview)).toThrow('PR_REVIEW_TIME_REFUSED')

   Date.now=()=>clock
   const receiptExpiry=await fixture(),expiredPublication=JSON.parse(receiptExpiry.publicationArtifact.bytes);expiredPublication.expiresAtMs=clock+100
   const expiringReceipt=jpin(expiredPublication);await writeFile(receiptExpiry.context.paths.publication,expiringReceipt.bytes);receiptExpiry.context.inspection.publicationSha256=expiringReceipt.sha256;receiptExpiry.context.policy.publicationSha256=expiringReceipt.sha256
   const preparedReceipt=await prepareHostedSetupArtifactUpgrade(receiptExpiry.context)
   Date.now=()=>clock+1000
   expect(preparedReceipt.dependencies.currentProductHead()).toBe(HEAD)
   expect(()=>preparedReceipt.dependencies.verifyReviewedExecutionArtifact(preparedReceipt.input.publicationReceipt,preparedReceipt.input.publicationReview)).toThrow('PUBLICATION_EXPIRED')
  }finally{Date.now=savedNow}
 })

 test('keeps a historical-size restore package out of stdin and refuses private evidence under artifact roots',async()=>{
  const f=await fixture(undefined,9_466_390)
  expect(Buffer.byteLength(JSON.stringify(f.payload))).toBeLessThan(8*1024*1024)
  expect(f.payload.restore.evidence.sourceArchive.byteLength).toBe(9_466_390)
  expect((await prepareHostedSetupArtifactUpgrade(f.context)).input.restoreReceipt.sha256).toBe(f.payload.restore.policy.artifactSha256.restoreObservation)
  const nested=await fixture(value=>{value.restore.evidence.sourceArchive.path=resolve(value.maintenance.railwayCaptureInput.workingDirectory,'artifact','publication.json')})
  await expect(prepareHostedSetupArtifactUpgrade(nested.context)).rejects.toThrow('PRIVATE_EVIDENCE_LOCATION_REFUSED')
 })

 test('does not turn serialized stop assertions into provider authority',async()=>{
  const f=await fixture(),prepared=await prepareHostedSetupArtifactUpgrade(f.context)
  expect(()=>prepared.dependencies.verifyReviewedMaintenanceStop(f.stopReceipt,f.stopReview)).toThrow()
  expect(deploymentCaptureSha256(f.first)).not.toBe(deploymentCaptureSha256(f.second))
 })

 test('binds the exact stopped image and refuses phase progress when fresh provider transport is unavailable',async()=>{
  const f=await fixture(value=>validMaintenance(value,Date.now())),prepared=await prepareHostedSetupArtifactUpgrade(f.context)
  const stop=prepared.dependencies.verifyReviewedMaintenanceStop(prepared.input.stopReceipt,prepared.input.stopReview)
  expect(stop).toMatchObject({...DEPLOYMENT_TARGET,...IMAGE,replicas:0,availabilityStopObserved:true,databaseWritersExcluded:false,configurationVersion:'d'.repeat(64),independentReviewerId:STOP_REVIEWER})
  await expect(prepared.dependencies.observeMaintenanceStopped(stop,'under_lock_before_migration')).rejects.toThrow('MAINTENANCE_PHASE_REFUSED')
  await expect(prepared.dependencies.observeMaintenanceStopped(stop,'before_transaction')).rejects.toThrow()
 })

 test('consumes the exact durable live-stop receipt and refuses newline tamper and replay',async()=>{
  const clock=Date.now();let durableReceipt=''
  const f=await fixture(async value=>{
   validMaintenance(value,clock)
   const maintenance=value.maintenance,binding=verifyHostedSetupDeploymentBinding(maintenance.deploymentReceipt.bytes,maintenance.deploymentReview.bytes,maintenance.deploymentPolicy,new Date(clock-5900).toISOString())
   const before=[providerCapture(clock,-5800,1,'c'.repeat(64)),providerCapture(clock,-5600,1,'c'.repeat(64))] as const
   const captures=[...before,...maintenance.stoppedCaptures],times=[-5400,-5300,-5200,-4300];let time=0
   const runtime:LiveStopRuntime={capture:async()=>captures.shift()!,scale:async()=>JSON.stringify({regions:{[DEPLOYMENT_TARGET.region]:null}}),now:()=>new Date(clock+times[time++]!).toISOString()}
   const root=maintenance.railwayCaptureInput.workingDirectory,journalPath=join(root,'writer-reader-stop.jsonl'),receiptPath=join(root,'writer-reader-stop.json')
   const result=await stopHostedSetupExactImage({profile:HOSTED_SETUP_LIVE_STOP_PROFILE,binding,railway:maintenance.railwayCaptureInput,journalPath,receiptPath},runtime)
   durableReceipt=await readFile(receiptPath,'utf8')
   expect(durableReceipt).toBe(canonical(result));expect(durableReceipt.endsWith('\n')).toBe(false)
   maintenance.stopReceipt=pin(durableReceipt)
   maintenance.stopReview=jpin({profile:'neuvetra.hosted-setup.maintenance-stop-review.v2',verdict:'accepted',stopReceiptSha256:maintenance.stopReceipt.sha256,deploymentReceiptSha256:maintenance.deploymentReceipt.sha256,deploymentReviewSha256:maintenance.deploymentReview.sha256,operatorId:OPERATOR,independentReviewerId:STOP_REVIEWER,reviewedUtc:new Date(clock-4000).toISOString(),materialFindingsOpen:0,availabilityStopObserved:true,databaseWritersExcluded:false,migrationAuthorized:false})
   value.trustedPins.stopReviewSha256=maintenance.stopReview.sha256
  })
  const accepted=await fixedReader(f.context)
  expect(accepted).toMatchObject({accepted:true,stopReceiptSha256:sha256(durableReceipt)})
  expect(accepted.replay).toContain('MAINTENANCE_BINDING_REPLAY')

  const tampered=structuredClone(f.context) as any
  tampered.payload.maintenance.stopReceipt={bytes:durableReceipt+'\n',sha256:sha256(durableReceipt+'\n')}
  const refused=await fixedReader(tampered)
  expect(refused.accepted).toBe(false)
  expect(refused.error).toContain('STOP_RECEIPT_NONCANONICAL')
 })

 test('reconciliation refuses without an authenticated original-session resolution producer',async()=>{
  const f=await fixture();f.context.mode='reconcile';f.context.payload={profile:FIXED_ARTIFACT_RECONCILIATION_PAYLOAD_PROFILE}
  await expect(prepareHostedSetupArtifactReconciliation(f.context)).rejects.toThrow('ORIGINAL_TRANSACTION_RESOLUTION_PRODUCER_REQUIRED')
  f.context.payload={profile:FIXED_ARTIFACT_RECONCILIATION_PAYLOAD_PROFILE,resolved:true}
  await expect(prepareHostedSetupArtifactReconciliation(f.context)).rejects.toThrow('RECONCILIATION_PAYLOAD_SHAPE_REFUSED')
 })
})
