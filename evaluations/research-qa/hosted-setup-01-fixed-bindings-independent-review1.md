# Fixed artifact bindings — independent Candidate 1 review

Task HOSTED-SETUP-FIXED-BINDINGS-QA-01, 2026-09-26 UTC. Reviewer /root/compose_qa did not author the bindings or their candidate test. Requested registered critical qa-lead gpt-6-astra/high; observed model/effort unknown in reused independent context. Root reported registry dispatch briefly unavailable due an in-progress record. QA role and current integration scope refreshed. The reviewer previously authored the existing fresh-restore binder dependency; this report independently reviews the new composition and does not recertify that dependency as an independent reviewer.

**Verdict: FAIL, two bounded P2 findings (FIXED-BIND-F01 and FIXED-BIND-F02).** Preserve this first verdict. Large-file loading and all three ordered provider-observation phases passed independently and are recorded separately below. No candidate source, provider, database, Git or shared ledger changes were made.

## Exact frozen inputs

| File | SHA-256 |
|---|---|
| tools/staging/hosted-setup-artifact-bindings.ts | 1a05c80af013f462b71b17c13804f78a3bf2b738ffb00c17b2e6d85ed4051549 |
| tools/staging/hosted-setup-artifact-bindings.test.ts | a0b06fc85b2e88575a0b04ef0c2f5746f43c4b68f9144a0960465fd0844defe1 |
| evaluations/research-qa/hosted-setup-fixed-artifact-bindings-author-20260926.md | 9b7a5c0efe86f34abcbfa33cee021bd6536796cb42b7da1e5279359d0fc3da8f |

All pins matched dispatch and remained unchanged through the final check. The author report was found at its actual filename after an initial guessed report path was absent; this did not affect source/test execution.

## FIXED-BIND-F01 — P2 — array accessors bypass the claimed plain-payload boundary

At source line91, plain() handles arrays using value.map(...) before inspecting descriptors, symbols or prototypes. Thus an accessor at maintenance.stoppedCaptures[0] is invoked and its result accepted. Independent public-export probe: define an enumerable getter returning the original valid capture; call prepareHostedSetupArtifactUpgrade. Observed **rejected=false, arrayReads=1**. By contrast, an ordinary database.connectionString getter refused with PAYLOAD_ACCESSOR_REFUSED and zero getter reads. The test asserted array refusal and failed.

This violates the stated rejection of payload accessors and caller-selected executable behavior. It is specifically a direct exported API boundary defect: ordinary serialized JSON delivered by the actual fixed worker contains no getters, so this is not evidence of executable code smuggled through worker stdin. Do not broaden the demonstrated impact to a hosted exploit.

Minimum correction: validate array prototype, own keys/symbols and each indexed property descriptor before reading elements; never dispatch caller-provided map methods. Define and enforce treatment of sparse indices and extra array properties. Add both object and array negative cases with getter-invocation counters, plus customized array method/prototype variants.

## FIXED-BIND-F02 — P2 — explicit publication-review expiry is not checked at callback consumption

At source line233, prReview validates expiry once, before await loadEvidence at236. At278, the actual verifyReviewedExecutionArtifact callback validates exact bytes but returns a previously built accepted product binding without checking the current time. In contrast, currentProductHead at281 revalidates its separate evidence on every call.

Independent deterministic probe used fully matching synthetic review/publication hashes. Set publication review expiry to clock+100ms, prepare at clock, advance the test clock to clock+1000ms while keeping the separately pinned current-head evidence valid. Invoke the actual exported preparation's currentProductHead and verifyReviewedExecutionArtifact callbacks. **Current head returned the correct head; expired publication review still returned the accepted binding (rejected=false).** The test asserted refusal and failed. No provider call or database entry occurred.

This is relevant to the actual callback contract: the runner verifies accepted restore evidence before calling the publication verifier, and preparation also loads potentially large private files asynchronously after the only review-time check. Therefore valid-at-preparation review evidence can expire before the runner consumes it even without a caller mutating bytes or violating callback types. The current-head check does not close this separate review-expiry gap.

Minimum correction: revalidate publication/review time constraints using a fresh clock at the deferred execution-artifact verification boundary, including publication expiry; retain exact-byte/identity pins and refuse if evidence expires during preparation. Add a short-lived review with a still-valid current-head observation, exercising delayed consumption. The demonstrated failure concerns PR review expiry; publication-receipt expiry has the same cached-validation structure and should be covered by the repair rather than claimed as separately dynamically reproduced here.

## Independent passing evidence

- **Private evidence transport:** exact 9,466,390-byte synthetic archive and 8,388,731-byte sourceSnapshot (8MiB+123) loaded from file references while the serialized payload stayed below8MiB. This validates transport only, not the deliberately nonsemantic snapshot fixture as restore evidence. Same-size altered archive bytes refused by SHA. A redirected parent junction refused by realpath validation. A controlled readFile race returned the original correctly pinned bytes, then changed the underlying file before the second lstat; metadata/hash checks refused with PRIVATE_EVIDENCE_CHANGED_OR_UNPINNED. Private files remained outside artifact/checkouts. No real backup or customer contents were used.
- **Actual collector code and phase contract:** invoked returned dependencies from prepareHostedSetupArtifactUpgrade and verified the same exact stopped image/review. The unchanged real capture module ran through an intercepted node:child_process.execFile boundary, using synthetic exact-target status/API responses. Each of before_transaction, under_lock_before_migration and under_lock_before_commit performed two separate acquisitions: **six status calls, six inventory API calls and six version checks**, with CLI file hashing still active. All calls targeted the pinned executable with shell:false. Each phase returned the exact serialized boolean string `true`, matching the actual transactional runner's decoder. Replayed phase and changed configuration refused. This exercises real bindings/capture/parser/postscale composition, but command output is synthetic and no Railway process or provider operation was executed in this task.
- **Image/review boundaries:** candidate and independent checks retained the exact reviewed commit/digest/stop configuration, refused wrong phase before transport and refused changed configuration during a fresh pair. Callback artifact substitution refused. No old deployment identity was introduced by these bindings. Deployment/stop inputs still require separate externally supplied reviewed pins; a synthesized matching set is not real provider authentication.
- **Forged restore and replay:** preparation may load pinned strings, but verifyAcceptedRestore rejected the nonsensical synthetic evidence. A second attempt refused RESTORE_BINDING_REPLAY; the archive is zeroed in finally. The accepted underlying fresh-restore implementation remains responsible for semantic archive/result/fingerprint/review verification, not just hashes.
- **Current head and reconciliation:** changed external current-head pin refused; currentProductHead refused after expiry; candidate stale/shape tests passed. Reconciliation always refused with ORIGINAL_TRANSACTION_RESOLUTION_PRODUCER_REQUIRED and did not accept a serialized resolved:true shortcut. This is deliberate incomplete functionality, not a demonstrated working reconciliation path.
- **Actual worker contract:** source inspection confirmed the worker imports these fixed exports, passes its inspected context and artifact lock, captures connection options, and passes returned dependencies to the transactional runner. Strict TypeScript against bindings, candidate test and actual worker passed with explicit existing Bun/pg type resolution. No full fixed-worker/native database success run was performed in this task; static interface compatibility and exercised callback composition do not replace that integration gate.

## Commands, failures and artifacts

Candidate Bun1.3.12 suite: **6 passed / 21 assertions**. First independent suite: **2 passed, 2 failed / 18 assertions**. Extended suite added file-read race and forged/replay/currentness probes: **4 passed, 2 failed / 25 assertions**, reproducing both original findings unchanged. No rerun erased those failures.

Initial ad hoc strict TypeScript invocation failed in imported hosted.ts because default pg type resolution left oid/format implicit-any. A first temporary explicit-path config was malformed by PowerShell array concatenation and reported missing files/type roots. Corrected only that temporary configuration, with parenthesized individual paths and existing package-local pg types; final **strict TypeScript passed**. Compiler options: noEmit, strict, ES2022, ESNext, Bundler, skipLibCheck, Bun/pg types, explicit repository typeRoots and pg declaration path. This skips third-party declaration checking; no candidate typing suppression was introduced.

Independent probe: `%TEMP%/hosted-fixed-bindings-independent.test.ts`, SHA `3a48795760da3184f1115eb9c6c7c17a89f8d01867cd7b7c1667cbb9dbfab786`. Strict config: `%TEMP%/hosted-fixed-bindings-qa-tsconfig.json`, SHA `c17cffbbed29eb4185b9ba21ce8d97f964701069f9575f047fcc4143556de141`. Complete probe is embedded below for repair/re-review. It borrows candidate fixture construction but defines independent expectations, controlled transport interception and file-race injection. No credential bytes are present; connection string/CA examples are synthetic and no client is constructed.

## Trust and release limits

Payload-provided hashes and issuer strings are trusted-operator-host inputs, not cryptographic issuer authentication. A coordinated attacker controlling all those authorized inputs can fabricate a matching story; this module is not the external authentication channel. Same-user file races, hostile host processes and inherited filesystem ACLs remain outside the claimed trusted-host boundary; the tested hash/metadata guards reject changed bytes but do not establish OS isolation or durable private-storage authority.

Current PR/head/check evidence is offline and freshness-bounded, not live GitHub acquisition. This review made no GitHub/provider/DB requests, did not claim that the real stopped state exists, and did not test real backup parsing or native one-physical-transaction execution. Reconciliation's missing original-session resolution producer remains a blocker for that operation. No publication, maintenance stop, migration, resumption, new tenant or launch authority follows from any passing subcheck. Fix both findings, preserve this report, and independently re-review the exact repaired bytes before integrated acceptance. QA run metadata awaits coordinator review and immutable packaging.

## Independent probe

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

import {mock} from 'bun:test';
import {readFile,lstat,symlink} from 'node:fs/promises';
import {dirname} from 'node:path';
const CLI='C:/Users/nimab/Neuvetra/m63-runtime/railway-cli/node_modules/@railway/cli/bin/railway.exe';
let transportCalls:any[]=[],transportDrift=false;
mock.module('node:child_process',()=>({execFile:(exe:string,args:string[],options:any,callback:Function)=>{
 transportCalls.push({exe,args:[...args],shell:options.shell});
 setTimeout(()=>{
  const c=providerCapture(Date.now(),0,0,transportDrift?'e'.repeat(64):'d'.repeat(64));
  callback(null,args[0]==='--version'?'railway 5.62.1':args[0]==='status'?c.statusJson:c.inventoryJson,'');
 },8);return {};
}}));
test('private references load exact 9466390 archive and >8MiB snapshot without enlarging payload',async()=>{
 const f=await fixture(undefined,9466390),bytes='x'.repeat(8*1024*1024+123),ref=f.payload.restore.evidence.sourceSnapshot;
 await writeFile(ref.path,bytes);ref.byteLength=Buffer.byteLength(bytes);ref.sha256=sha256(bytes);f.payload.restore.policy.artifactSha256.sourceSnapshot=ref.sha256;f.payload.trustedPins.freshRestorePolicySha256=sha256(canonical(f.payload.restore.policy));
 expect(Buffer.byteLength(JSON.stringify(f.payload))).toBeLessThan(8*1024*1024);
 const p=await prepareHostedSetupArtifactUpgrade(f.context);expect(p.input.restoreReceipt.sha256).toBe(f.payload.restore.policy.artifactSha256.restoreObservation);
 const bad=await fixture();await writeFile(bad.payload.restore.evidence.sourceArchive.path,new Uint8Array(7).fill(8));
 await expect(prepareHostedSetupArtifactUpgrade(bad.context)).rejects.toThrow('PRIVATE_EVIDENCE_CHANGED_OR_UNPINNED');
 const alias=await fixture(),link=join(dirname(alias.payload.restore.evidence.sourceArchive.path),'junction');
 await symlink(dirname(alias.payload.restore.evidence.sourceArchive.path),link,'junction');alias.payload.restore.evidence.sourceArchive.path=join(link,'source-archive.bin');
 await expect(prepareHostedSetupArtifactUpgrade(alias.context)).rejects.toThrow('PRIVATE_EVIDENCE_FILE_REFUSED');
});
test('object and array accessors must both refuse before invoking getters',async()=>{
 const f=await fixture();let objectReads=0;Object.defineProperty(f.payload.database,'connectionString',{enumerable:true,get(){objectReads++;return 'x'}});
 await expect(prepareHostedSetupArtifactUpgrade(f.context)).rejects.toThrow('PAYLOAD_ACCESSOR_REFUSED');expect(objectReads).toBe(0);
 const g=await fixture(),old=g.payload.maintenance.stoppedCaptures[0];let arrayReads=0;Object.defineProperty(g.payload.maintenance.stoppedCaptures,'0',{enumerable:true,get(){arrayReads++;return old}});
 let rejected=false;try{await prepareHostedSetupArtifactUpgrade(g.context)}catch{rejected=true}
 console.log(JSON.stringify({probe:'array-accessor',rejected,arrayReads}));expect(rejected).toBe(true);expect(arrayReads).toBe(0);
});
test('actual collector module performs two separate reads in each of three ordered phases, then refuses replay',async()=>{
 const f=await fixture(value=>validMaintenance(value,Date.now()));f.payload.maintenance.railwayCaptureInput.executablePath=CLI;
 const p=await prepareHostedSetupArtifactUpgrade(f.context),stop=p.dependencies.verifyReviewedMaintenanceStop(p.input.stopReceipt,p.input.stopReview);
 transportCalls=[];
 for(const phase of ['before_transaction','under_lock_before_migration','under_lock_before_commit'] as const)expect(await p.dependencies.observeMaintenanceStopped(stop,phase)).toBe('true');
 expect(transportCalls.filter(c=>c.args[0]==='status')).toHaveLength(6);expect(transportCalls.filter(c=>c.args[0]==='api')).toHaveLength(6);expect(transportCalls.filter(c=>c.args[0]==='--version')).toHaveLength(6);
 expect(transportCalls.every(c=>c.exe===CLI&&c.shell===false)).toBe(true);
 await expect(p.dependencies.observeMaintenanceStopped(stop,'before_transaction')).rejects.toThrow('MAINTENANCE_PHASE_REFUSED');
 const g=await fixture(value=>validMaintenance(value,Date.now()));g.payload.maintenance.railwayCaptureInput.executablePath=CLI;const q=await prepareHostedSetupArtifactUpgrade(g.context),other=q.dependencies.verifyReviewedMaintenanceStop(q.input.stopReceipt,q.input.stopReview);
 transportDrift=true;try{await expect(q.dependencies.observeMaintenanceStopped(other,'before_transaction')).rejects.toThrow()}finally{transportDrift=false}
});
test('publication review expiry must still be enforced when its deferred callback is used',async()=>{
 const f=await fixture(),clock=Date.now(),review=JSON.parse(f.payload.publication.review.bytes);review.expiresAtMs=clock+100;
 const updated=jpin(review);f.payload.publication.review=updated;
 const publication=JSON.parse(f.publicationArtifact.bytes);publication.publisherEvidence.reviewEvidenceSha256=updated.sha256;
 const revised=jpin(publication);await writeFile(f.context.paths.publication,revised.bytes);(f.context.inspection as any).publicationSha256=revised.sha256;f.context.policy.publicationSha256=revised.sha256;
 const saved=Date.now;Date.now=()=>clock;
 try{
  const p=await prepareHostedSetupArtifactUpgrade(f.context);Date.now=()=>clock+1000;
  expect(p.dependencies.currentProductHead()).toBe(HEAD);
  let rejected=false;try{p.dependencies.verifyReviewedExecutionArtifact(p.input.publicationReceipt,p.input.publicationReview)}catch{rejected=true}
  console.log(JSON.stringify({probe:'expired-review-callback',rejected,reviewExpired:true,currentHeadStillValid:true}));expect(rejected).toBe(true);
 }finally{Date.now=saved}
});
test('file metadata changed during read refuses even when returned bytes match their original pin',async()=>{
 const native={...await import('node:fs/promises')};let racePath='';
 mock.module('node:fs/promises',()=>({...native,readFile:async(...args:any[])=>{
  const result=await (native.readFile as any)(...args);
  if(String(args[0])===racePath)await native.writeFile(racePath,'different size after original bytes were read');
  return result;
 }}));
 const f=await fixture();racePath=f.payload.restore.evidence.sourceArchive.path;
 try{await expect(prepareHostedSetupArtifactUpgrade(f.context)).rejects.toThrow('PRIVATE_EVIDENCE_CHANGED_OR_UNPINNED')}finally{racePath=''}
});
test('forged restore text, callback swaps and later stale current-head observation refuse',async()=>{
 const f=await fixture(),p=await prepareHostedSetupArtifactUpgrade(f.context);
 expect(()=>p.dependencies.verifyAcceptedRestore(p.input.restoreReceipt,p.input.restoreReview,p.input.fingerprintDerivation,p.input.fingerprintDerivationReview)).toThrow();
 expect(()=>p.dependencies.verifyAcceptedRestore(p.input.restoreReceipt,p.input.restoreReview,p.input.fingerprintDerivation,p.input.fingerprintDerivationReview)).toThrow('RESTORE_BINDING_REPLAY');
 expect(()=>p.dependencies.verifyReviewedExecutionArtifact(pin('forged'),p.input.publicationReview)).toThrow('PUBLICATION_CALLBACK_CHANGED');
 const saved=Date.now,clock=saved();Date.now=()=>clock+300001;
 try{expect(()=>p.dependencies.currentProductHead()).toThrow()}finally{Date.now=saved}
 const g=await fixture();g.payload.trustedPins.currentHeadEvidenceSha256='0'.repeat(64);
 await expect(prepareHostedSetupArtifactUpgrade(g.context)).rejects.toThrow('PR_HEAD_TRUST_PIN_REFUSED');
 const r=await fixture();r.context.mode='reconcile';r.context.payload={profile:FIXED_ARTIFACT_RECONCILIATION_PAYLOAD_PROFILE};
 await expect(prepareHostedSetupArtifactReconciliation(r.context)).rejects.toThrow('ORIGINAL_TRANSACTION_RESOLUTION_PRODUCER_REQUIRED');
});
```
