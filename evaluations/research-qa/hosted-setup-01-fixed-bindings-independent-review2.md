# Fixed artifact bindings repair 1 — independent review 2

2026-09-26. Task `HOSTED-SETUP-FIXED-BINDINGS-REPAIR1-QA-01`. Reviewer `/root/artifact_launcher`; author `/root/collection_backend`. **Bounded PASS: FIXED-BIND-F01 and FIXED-BIND-F02 are closed for the exact repaired bytes below.** The original FAIL remains preserved. This is local composition evidence, not publication, migration or launch authorization.

The reviewer did not author the fixed-bindings component or candidate tests. Prior authorship of the worker/source/materializer is disclosed; this review does not independently recertify those components. QA role, operating instructions, workflow, registry and current continuation were refreshed. Requested critical qa-lead `gpt-6-astra/high`; actual inherited model/effort unobserved because follow-up dispatch provides no selection evidence. Applicable lessons L04/L06: exercise actual public boundaries and deferred consumption, not only helper checks.

## Exact files

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-bindings.ts` | `cbe42173cd354559901fea9821c7314751c20b2e0febd895d7cb13fa27955514` |
| `tools/staging/hosted-setup-artifact-bindings.test.ts` | `4975c5f0d1b7ddb9e31a2ab1db5ec00891fbf9381d7cb1f63a9711864e693300` |
| `evaluations/research-qa/hosted-setup-01-fixed-bindings-repair1-author.md` | `f92ae212223aec641e26e7c279b679d2d3fed5d7249002b0a8e04f8367cdf033` |
| Preserved `hosted-setup-01-fixed-bindings-independent-review1.md` | `2b02ecf7d1b71f6ddf8dbfc33a9785c908e307c23b5f6f40632e26b262e21740` |

Supplied source/test hashes matched. Candidate and earlier report remained unchanged. Only this review and its own run record were written in the repository; probes use synthetic temporary files. No provider mutation, live capture, database connection, credentials, shared Git mutation or push occurred.

## Findings closure

**F01 — array accessor execution:** The original independent probe now records `rejected:true, arrayReads:0`. The repair checks exact array prototype, own descriptor keys, symbols, dense length and enumerable indexed data properties before recursively copying descriptor values. It does not dispatch caller `map`. Fresh independent cases additionally reject index 1 accessors, nonenumerable index accessors, `Symbol.iterator` getters, `toJSON` getters, and an accessor nested in deployment-policy capture hashes. Every hook counter stays zero. A frozen canonical array is accepted; later caller mutations to review/database values do not change prepared copies. The delivered tests also exercise own/inherited custom map, sparse entries, extra properties and symbols.

**F02 — deferred review expiry:** The original independent delayed-consumption case now refuses while `currentProductHead()` still succeeds, isolating the review expiry. New deterministic cases independently vary review expiry, publication expiry and current-head expiry. Each accepts at expiry minus 1 ms and refuses at the exact expiry instant; extending the original caller payload afterward cannot refresh the captured evidence. Errors are respectively `PR_REVIEW_TIME_REFUSED`, `PUBLICATION_EXPIRED`, and `PR_HEAD_TIME_REFUSED`.

A separate controlled `readFile` interception advances the process clock while reading the last private restore file. Preparation can return a data bundle after review expiry; its actual product-verification callback refuses before returning a binding. This is deliberately the deferred consumption boundary, not a claim that preparation itself throws after every await. Source inspection confirms the runner consumes `verifyReviewedExecutionArtifact` before entering `db.transaction`. No database operation was used to test that ordering.

The callback retains exact receipt/review equality checks and revalidates the pinned publication, review and current-head evidence using a fresh process clock. Product results continue to contain `runtimeLoadedCodeAttested:false` and `launchAuthorized:false`.

## Executed validation

- Bun 1.3.12 (700fc117), candidate suite plus unchanged QA1 independent probe: **14 passed, 0 failed, 60 assertions**. Command: `bun test tools/staging/hosted-setup-artifact-bindings.test.ts C:/Users/nimab/AppData/Local/Temp/hosted-fixed-bindings-independent.test.ts --timeout 30000`.
- Newly constructed independent suite: **10 passed, 0 failed, 26 assertions**. Command: `bun test C:/Users/nimab/AppData/Local/Temp/hosted-fixed-bindings-repair1-newqa.test.ts --timeout 30000`.
- Strict TypeScript against bindings, candidate tests and actual worker: **PASS**, exit 0, no diagnostics. Command: `bun node_modules/typescript/bin/tsc --project C:/Users/nimab/AppData/Local/Temp/hosted-fixed-bindings-qa-tsconfig.json`. Existing explicit Bun/pg type roots and pg declaration path; strict, noEmit, ES2022/ESNext/Bundler, skipLibCheck.

All this re-review's executions passed on their first invocation. The original candidate's failures are not overwritten. Total **24 tests / 86 assertions** across the two executions; no skipped cases in these commands.

Replaying QA1 also reconfirmed 9,466,390-byte archive and greater-than-8MiB snapshot transport, changed-byte and junction refusal, controlled file-read metadata race refusal, restore forgery/replay refusal and six ordered synthetic provider acquisitions (six status, six API and six version calls). The real collector/parser code ran against intercepted command output; Railway was not contacted. Reconciliation still refuses because an authenticated original-session resolution producer is absent.

## Reproduction and limits

The new probe reuses QA1's synthetic fixture construction while adding independently defined expectations. Its full source follows. Original probe SHA: `3a48795760da3184f1115eb9c6c7c17a89f8d01867cd7b7c1667cbb9dbfab786` (already embedded in QA1). New probe SHA: `2020020a074542b8f6c0112fd4b738f8f81078f1524958e1818881ddba871f58`. TypeScript config SHA: `c17cffbbed29eb4185b9ba21ce8d97f964701069f9575f047fcc4143556de141`.

Acceptance assumes the explicit trusted operator host, authentic externally acquired evidence/pins, the worker's serialized JSON payload and a trusted process clock. Ordinary array/accessor rejection does not establish a sandbox against arbitrary Proxy traps, patched intrinsics or a hostile host. Synthetic inspector/evidence values are test inputs, not authentic publication or hosted state. No full worker/native PostgreSQL success composition, real restore semantics or authenticated provider stop was demonstrated here. Reconciliation remains unavailable. No new material finding was observed within this repair scope; coordinator owns immutable packaging, integration and remaining operational gates.


## New independent probe

```typescript
import {describe,expect,test} from 'bun:test'
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import type {FixedBindingContext} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-worker'
import {ARTIFACT_PROFILE,ARTIFACT_SOURCE_PROFILE,PUBLICATION_PROFILE} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-source'
import {FRESH_RESTORE_POLICY_PROFILE} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-fresh-restore-binding'
import {DEPLOYMENT_BINDING_PROFILE,DEPLOYMENT_REVIEW_PROFILE,DEPLOYMENT_TARGET,createHostedSetupDeploymentReceipt,deploymentCaptureSha256} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-deployment-binding'
import {verifyHostedSetupStopped} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-postscale'
import {RAILWAY_CAPTURE_PROFILE} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-railway-capture'
import {HOSTED_SETUP_PROFILE,HOSTED_SETUP_PROJECT,canonical,sha256,type PinnedArtifact} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-upgrade'
import {
 FIXED_ARTIFACT_BINDINGS_PAYLOAD_PROFILE,FIXED_ARTIFACT_RECONCILIATION_PAYLOAD_PROFILE,
 prepareHostedSetupArtifactReconciliation,prepareHostedSetupArtifactUpgrade,
} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-bindings'

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

async function fixture(changes?:(value:any)=>void,archiveSize=7){
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
 changes?.(payload)
 const inspection:any={profile:ARTIFACT_PROFILE,trustBoundary:'trusted-operator-host',claim:'verified-at-rest-artifact-and-private-sql-only',reviewedProductHead:HEAD,publicationSha256:sha256(publicationBytes),executionArtifactSha256:'b'.repeat(64),migrationManifestSha256:'3'.repeat(64),sourceRoot:root,dependencyRoot:root,runtimeExecutable:resolve(root,'bun.exe'),operatorId:OPERATOR,independentReviewerId:ARTIFACT_REVIEWER,launchAuthorized:false}
 const context:any={profile:'neuvetra.hosted-setup.fixed-artifact-worker.v1',mode:'upgrade',paths:{publication:publicationPath,sourceArchive:resolve(artifactRoot,'source.tar'),dependencyArchive:resolve(artifactRoot,'deps.tar'),sourceRoot:resolve(artifactRoot,'source'),dependencyRoot:resolve(artifactRoot,'dependencies'),runtimeExecutable:resolve(artifactRoot,'bun.exe'),supervisor:resolve(artifactRoot,'supervisor.ts'),config:resolve(artifactRoot,'bunfig.toml')},policy:{publicationSha256:inspection.publicationSha256,reviewedProductHead:HEAD,operatorId:OPERATOR,independentReviewerId:ARTIFACT_REVIEWER,requiredChecks:['required'],activeCheckoutRoots:[resolve(root,'checkout')]},transactionJournalPath:resolve(root,'transaction.jsonl'),payload,deadlineMs:300000,inspection}
 return{context:context as FixedBindingContext,payload,publicationArtifact:pin(publicationBytes),review,current,stopReceipt,stopReview,first,second}
}

for(const variant of ['index-one','hidden-index','iterator-getter','toJSON-getter','nested-policy-index'])test('fresh plain-array refusal '+variant,async()=>{
 const f=await fixture();let reads=0;const pair=f.payload.maintenance.stoppedCaptures,original=pair[1];
 if(variant==='index-one'||variant==='hidden-index')Object.defineProperty(pair,'1',{enumerable:variant!=='hidden-index',get(){reads++;return original}});
 if(variant==='iterator-getter')Object.defineProperty(pair,Symbol.iterator,{get(){reads++;throw Error('caller hook')}});
 if(variant==='toJSON-getter')Object.defineProperty(pair,'toJSON',{get(){reads++;throw Error('caller hook')}});
 if(variant==='nested-policy-index'){const a=f.payload.maintenance.deploymentPolicy.authenticatedCaptureSha256;Object.defineProperty(a,'1',{enumerable:true,get(){reads++;return 'a'.repeat(64)}})}
 await expect(prepareHostedSetupArtifactUpgrade(f.context)).rejects.toThrow('PAYLOAD_');expect(reads).toBe(0);
});
test('frozen canonical array is accepted and copied without retaining mutable caller children',async()=>{
 const f=await fixture();Object.freeze(f.payload.maintenance.stoppedCaptures);const p=await prepareHostedSetupArtifactUpgrade(f.context);
 f.payload.publication.review.bytes='caller mutation';f.payload.database.connectionString='caller mutation';
 expect(p.dependencies.verifyReviewedExecutionArtifact(p.input.publicationReceipt,p.input.publicationReview).launchAuthorized).toBe(false);expect(p.clientOptions.connectionString).not.toBe('caller mutation');
});
for(const kind of ['review','publication','currentHead'])test('exact deferred expiry boundary '+kind,async()=>{
 const saved=Date.now,clock=saved();Date.now=()=>clock;
 try{
  const f=await fixture(),expiry=clock+1000,pub=JSON.parse(f.publicationArtifact.bytes);
  if(kind==='review'){const doc=JSON.parse(f.payload.publication.review.bytes);doc.expiresAtMs=expiry;f.payload.publication.review=jpin(doc);pub.publisherEvidence.reviewEvidenceSha256=f.payload.publication.review.sha256}
  if(kind==='publication')pub.expiresAtMs=expiry;
  if(kind==='currentHead'){const doc=JSON.parse(f.payload.publication.currentHeadEvidence.bytes);doc.expiresAtMs=expiry;f.payload.publication.currentHeadEvidence=jpin(doc);f.payload.trustedPins.currentHeadEvidenceSha256=f.payload.publication.currentHeadEvidence.sha256}
  const pubPin=jpin(pub);await writeFile(f.context.paths.publication,pubPin.bytes);f.context.inspection.publicationSha256=pubPin.sha256;f.context.policy.publicationSha256=pubPin.sha256;
  const p=await prepareHostedSetupArtifactUpgrade(f.context);Date.now=()=>expiry-1;
  expect(p.dependencies.verifyReviewedExecutionArtifact(p.input.publicationReceipt,p.input.publicationReview).reviewedProductHead).toBe(HEAD);
  Date.now=()=>expiry;const expected=kind==='review'?'PR_REVIEW_TIME_REFUSED':kind==='publication'?'PUBLICATION_EXPIRED':'PR_HEAD_TIME_REFUSED';
  expect(()=>p.dependencies.verifyReviewedExecutionArtifact(p.input.publicationReceipt,p.input.publicationReview)).toThrow(expected);
  if(kind!=='currentHead')expect(p.dependencies.currentProductHead()).toBe(HEAD);
  f.payload.publication.review=reviewEvidence(clock-1000,clock+99999);Date.now=()=>expiry+100;
  expect(()=>p.dependencies.verifyReviewedExecutionArtifact(p.input.publicationReceipt,p.input.publicationReview)).toThrow(expected);
 }finally{Date.now=saved}
});
import {mock} from 'bun:test';
test('expiry crossed during private evidence await cannot yield accepted callback',async()=>{
 const native={...await import('node:fs/promises')},saved=Date.now,clock=saved();let trigger='';Date.now=()=>clock;
 mock.module('node:fs/promises',()=>({...native,readFile:async(...args:any[])=>{const bytes=await (native.readFile as any)(...args);if(String(args[0])===trigger)Date.now=()=>clock+1000;return bytes}}));
 try{
  const f=await fixture(),doc=JSON.parse(f.payload.publication.review.bytes);doc.expiresAtMs=clock+100;f.payload.publication.review=jpin(doc);
  const pub=JSON.parse(f.publicationArtifact.bytes);pub.publisherEvidence.reviewEvidenceSha256=f.payload.publication.review.sha256;const pubPin=jpin(pub);
  await writeFile(f.context.paths.publication,pubPin.bytes);f.context.inspection.publicationSha256=pubPin.sha256;f.context.policy.publicationSha256=pubPin.sha256;trigger=f.payload.restore.evidence.fingerprintReview.path;
  const p=await prepareHostedSetupArtifactUpgrade(f.context);expect(Date.now()).toBe(clock+1000);expect(p.dependencies.currentProductHead()).toBe(HEAD);
  expect(()=>p.dependencies.verifyReviewedExecutionArtifact(p.input.publicationReceipt,p.input.publicationReview)).toThrow('PR_REVIEW_TIME_REFUSED');
 }finally{trigger='';Date.now=saved;mock.restore()}
});
```
