# Hosted setup post-scale repair — targeted independent review 2

2026-09-26. Task HOSTED-SETUP-POSTSCALE-REPAIR-QA-01. Reviewer /root/compose_qa, qa-lead; author /root/artifact_runner. This reviewer authored none of the post-scale source/tests or their deployment-binding dependency. It authored a different fresh-restore binder, which is not accepted by this review. Registered critical request gpt-6-astra/high; observed settings and resource measurements unknown. Existing independent context reused with refreshed QA role and workflow guidance.

**Verdict: FAIL for repair candidate 1. POST-F01 is resolved, but new POST-F02 [P2] breaks accepted-stop hash binding to chronology and exact image.** Do not use the current resume verifier as an accepted evidence boundary until repaired and independently rechecked. This is a pure verifier failure, not an observed unauthorized live action.

## Frozen reviewed bytes

| Artifact | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-postscale.ts | 5f86f48655b7df926f89be258a084815157b3d9d739dcbe470c4f6f15aa0ccd8 |
| tools/staging/hosted-setup-postscale.test.ts | f2342b924070041731a2bf20496f9735db70022d7e49d5033d9d58186be491ec |
| evaluations/research-qa/hosted-setup-01-postscale-repair1-author.md | 5f6795908b017232cc2977d6f451c114fa663ecc62e5103d2b92dff323d3858f |
| Preserved original independent review1 | df340c53c2a1df82f31f9240dd97f4938dfdd361f8748a6c5bc9b5c0810ce77c |

All four hashes were checked again after the independent probes and remained unchanged. The original FAIL was not edited. No candidate, shared ledger, Git, provider, database, credential or live-service action was performed. Only this new report, its separate QA run record and temporary synthetic probe were written.

## POST-F02 — P2: validation, accepted hash and output can observe different stopped receipts

Location: acceptedStop around lines 197–206, verifyHostedSetupResume around lines 216–232. acceptedStop reads the submitted object's identity, timestamps, configuration and capture hashes, but returns `receipt:item`, retaining the caller-owned object. verifyHostedSetupResume subsequently calls hostedSetupStoppedVerificationSha256 on that object and rereads stoppedCompletedUtc for output. Stateful getters can serve different primitives to those reads. The externally pinned canonical hash therefore need not describe the values used in validation.

Two independent public-boundary proofs use a genuine stopped receipt returned by verifyHostedSetupStopped. Its pinned hash stays **79bb79b76f31fd45395a02de4c6a007c3ea390b9a810937387d3ea85e0fc4d3f**; there is no changed accepted hash or forged provider access.

1. **Chronology bypass.** The genuine stopped receipt completes at 2026-09-26T23:00:01.200Z. Supply migrationReviewCompletedUtc 23:00:00.600Z and resumed captures starting 23:00:01.000Z. The ordinary receipt correctly refuses RESUME_CHRONOLOGY_REFUSED. Replace only stoppedCompletedUtc with an enumerable getter returning 23:00:00.500Z on its first read and genuine 23:00:01.200Z thereafter. Verification incorrectly accepts after three getter reads. It returns stoppedCompletedUtc 01.200, migrationReviewCompletedUtc 00.600 and resumedCompletedUtc 02.200. Thus returned review precedes accepted stop, and resumed acquisition starts before that accepted stop completes, despite the unchanged valid external pin.
2. **Same-image bypass.** The genuine stopped receipt pins image `sha256:` followed by 64 twos. The supplied deployment binding and both resumed captures instead consistently use `sha256:` followed by 64 eights. The ordinary stopped receipt correctly refuses STOP_RECEIPT_BINDING_MISMATCH. Replace only imageDigest with a getter returning the eights image on its first validation read and the genuine twos image on its hash read. Verification incorrectly accepts after two getter reads, returning the eights image under the unchanged accepted stop hash for the twos image.

These are not a claim that ordinary JSON.parse produces getters. They exercise the public TypeScript/JavaScript object boundary, which currently accepts such objects and makes exact-pin claims. This is the same class of split-read defect previously preserved in accepted-restore QA. The current return flags remain false and the caller's provider authentication remains external, but those limits do not repair the contradictory evidence acceptance.

Required correction: snapshot every stopped-receipt field, including the capture-hash array, into private immutable primitive data once, then validate, canonically hash and render **that same snapshot**. Alternatively, strictly refuse accessor/proxy-style input before use. Do not retain/re-read the caller-owned receipt. Apply the same retention principle to relevant policy and capture values where later output could differ from the checked value. Add both adversarial regressions, reverse getter cases and ordinary serialization round-trip checks. Preserve this failure; repair under new hashes and re-review it independently.

## POST-F01 and other criterion dispositions

- **Stopped-only boundary: PASS.** verifyHostedSetupStopped accepts two current stable zero-runtime captures before any migration/resume evidence exists, at the stop clock. Exact target/image and capture hashes are returned with mutation/provider-authentication/migration/resume/launch flags false. The old retrospective API still correctly rejects an empty resumed pair.
- **Phase-specific freshness: PASS for ordinary retained values.** Independent probes accept the exact 300,000 ms stopped-phase boundary and reject 300,001 ms or a completion 1 ms in the future. Resume succeeds after ten minutes and after a full day with fresh resumed captures; its own exact five-minute boundary accepts and boundary+1 ms refuses. The phase separation resolves the old global-five-minute obstacle.
- **Ordinary identity/chronology/receipt/replay checks: PASS.** Independently changing all nine stop binding/image fields under recomputed stop hashes rejects. All five false-authority fields cannot become true. Wrong accepted stop hash refuses. Review at/before stop completion, at resumed start or in the future refuses. Running stop, changed stop image/etag, repeated or overlapping pair, cross-phase raw hash replay, changed resumed image/etag/runtime, and unchanged stopped/resumed configuration refuse.
- **Hash covers values used for identity/chronology: FAIL POST-F02.** The two getter probes establish this failure despite ordinary cases passing.

## Commands and exact execution results

Windows/PowerShell; Bun 1.3.12. All runtime inputs are synthetic. The fixture is adapted from the original independent reviewer probe, not copied from the author's tests; it includes a same-name wrong-ID service before exact Site-Web. No source or test modification was necessary.

1. `bun test tools/staging/hosted-setup-deployment-binding.test.ts tools/staging/hosted-setup-postscale.test.ts --timeout 30000`: **26 pass, 0 fail, 134 expectations**.
2. `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-postscale.ts tools/staging/hosted-setup-postscale.test.ts`: **exit 0**.
3. Initial independent targeted probe: **5 pass, 1 fail, 54 expectations**, failing chronology invariant as above.
4. Expanded independent probe: **5 pass, 2 fail, 56 expectations**, adding the image invariant failure. Both failures remain; no harness repair changed an expected safety result. The final enclosing shell command returned 0 because the later hash-reporting command succeeded; the Bun test invocation itself returned failure and printed 2 failed tests. Do not label this a passing execution.

Temporary probe path: C:/Users/nimab/AppData/Local/Temp/hosted-setup-postscale-repair-independent.test.ts. SHA-256: 4838e50b9cb28e8e114d03e265d7923e50648fc653c69132c9337a9776c50ac1. The complete probe is embedded below for portability.

## Limits

This review establishes no actual stopped service, completed migration/review, live Railway authentication, continuous provider hold, durable replay exclusion or launch permission. Migration review time and accepted stopped hash are external policy authority; their origin is not authenticated here. The original report's selected-field/etag configuration stability and terminal-inventory pagination limits remain unchanged. This repair does not prove full raw configuration preservation across phases. Repeated verification of the same evidence is possible; this is a pure verifier, not a consumed durable journal. Root owns immutable packaging and repair routing. This report grants no live mutation authority.

## Independent probe source

```typescript
import {verifyHostedSetupPostscale,verifyHostedSetupStopped,verifyHostedSetupResume,hostedSetupStoppedVerificationSha256} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-postscale.ts'
import {DEPLOYMENT_BINDING_PROFILE,DEPLOYMENT_TARGET as T} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-deployment-binding.ts'
const base=Date.parse('2026-09-26T23:00:00.000Z'),time=(ms:number)=>new Date(base+ms).toISOString()
const image={deploymentId:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',deployedCommit:'1'.repeat(40),imageDigest:'sha256:'+'2'.repeat(64)}
const rid='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb',other='cccccccc-3333-4333-8333-cccccccccccc'
function cap(replicas:number,start:number){
 const d={id:image.deploymentId,status:'SUCCESS',meta:{commitHash:image.deployedCommit,imageDigest:image.imageDigest},instances:replicas?[{id:rid,status:'RUNNING'}]:[],deploymentStopped:false}
 return {startedUtc:time(start),completedUtc:time(start+200),statusJson:JSON.stringify({id:T.projectId,services:{edges:[{node:{id:other,name:'Site-Web'}},{node:{id:T.serviceId,name:'Site-Web'}}]},environments:{edges:[{node:{id:T.environmentId,name:'production',canAccess:true,unmergedChangesCount:0,serviceInstances:{edges:[{node:{serviceId:other,environmentId:T.environmentId,serviceName:'Site-Web',latestDeployment:{meta:{imageDigest:'sha256:'+'0'.repeat(64)}}}},{node:{serviceId:T.serviceId,environmentId:T.environmentId,serviceName:'Site-Web',numReplicas:null,region:'',latestDeployment:d,activeDeployments:[d]}}]}}}]}}),inventoryJson:JSON.stringify({data:{service:{id:T.serviceId,name:'Site-Web',projectId:T.projectId},environment:{id:T.environmentId,name:'production',projectId:T.projectId,unmergedChangesCount:0,configEtag:(replicas?'4':'3').repeat(64),config:{groups:{},privateNetworkDisabled:false,services:{[T.serviceId]:{build:{},deploy:{healthcheckPath:'/ready',ipv6EgressEnabled:false,multiRegionConfig:{[T.region]:{numReplicas:replicas}},runtime:'V2',useLegacyStacker:false},networking:{},source:{},variables:{}}},sharedVariables:{},volumes:{}}},environmentStagedChanges:{id:'<empty>',status:'STAGED',patch:{}},serviceInstanceAutoDeployStatus:{enabled:false},deployments:{edges:[{cursor:'new',node:{id:image.deploymentId,status:'SUCCESS',serviceId:T.serviceId,environmentId:T.environmentId,meta:d.meta}}],pageInfo:{hasNextPage:false,endCursor:'new'}}}})}
}
function fixture():any{return{binding:{profile:DEPLOYMENT_BINDING_PROFILE,...T,...image,receiptSha256:'5'.repeat(64),reviewSha256:'6'.repeat(64),mutationAuthorized:false},stopped:[cap(0,0),cap(0,1000)],resumed:[cap(1,3000),cap(1,4000)],policy:{nowUtc:time(5000),beforeStopConfigurationVersion:'7'.repeat(64),expectedStoppedConfigurationVersion:'3'.repeat(64),expectedResumedConfigurationVersion:'4'.repeat(64)}}}
function call(f:any){return verifyHostedSetupPostscale(f.binding,f.stopped,f.resumed,f.policy)}
function mutate(c:any,field:string,fn:(o:any)=>void){const o=JSON.parse(c[field]);fn(o);c[field]=JSON.stringify(o)}
const inst=(o:any)=>o.environments.edges[0].node.serviceInstances.edges[1].node
import {expect,test} from 'bun:test'
function stop(f=fixture(),now=1200){return verifyHostedSetupStopped(f.binding,f.stopped,{nowUtc:time(now),beforeStopConfigurationVersion:'7'.repeat(64),expectedStoppedConfigurationVersion:'3'.repeat(64)})}
function resumeFixture(){const f=fixture(),s=stop(f);return {...f,s,resumed:[cap(1,601000),cap(1,602000)],rp:{nowUtc:time(603000),migrationReviewCompletedUtc:time(600000),acceptedStoppedVerificationSha256:hostedSetupStoppedVerificationSha256(s),expectedResumedConfigurationVersion:'4'.repeat(64)}}}
function resume(f:any){return verifyHostedSetupResume(f.binding,f.s,f.resumed,f.rp)}
test('public stopped-only result exists before migration and resume observations',()=>{
 const f=fixture(),s=stop(f);expect(s.stoppedCompletedUtc).toBe(time(1200));expect(s.deploymentId).toBe(image.deploymentId)
 for(const field of ['mutationAuthorized','providerAuthenticationEstablished','migrationAuthorized','resumeAuthorized','launchAuthorized'])expect((s as any)[field]).toBe(false)
 expect(Object.isFrozen(s)).toBe(true);expect(Object.isFrozen(s.stoppedCaptureSha256)).toBe(true)
 expect(()=>verifyHostedSetupPostscale(f.binding,f.stopped,[] as never,f.policy)).toThrow('TWO_CAPTURES_REQUIRED')
})
test('stopped phase independently enforces exact clock boundaries and stopped runtime',()=>{
 expect(stop(fixture(),300000).stoppedCompletedUtc).toBe(time(1200))
 for(const now of [1199,300001])expect(()=>stop(fixture(),now)).toThrow('STOPPED_STALE_OR_FUTURE')
 for(const mode of ['running','etag','image','pair-replay','pair-overlap']){
  const f=fixture();if(mode==='running')f.stopped[0]=cap(1,0)
  if(mode==='etag')mutate(f.stopped[1],'inventoryJson',o=>o.data.environment.configEtag='8'.repeat(64))
  if(mode==='image')mutate(f.stopped[1],'statusJson',o=>inst(o).latestDeployment.meta.imageDigest='sha256:'+'8'.repeat(64))
  if(mode==='pair-replay')f.stopped[1]=f.stopped[0]
  if(mode==='pair-overlap')f.stopped[1].startedUtc=f.stopped[0].completedUtc
  expect(()=>stop(f)).toThrow()
 }
})
test('resume uses separate clock after ten minutes or one day with exact five-minute resumed boundary',()=>{
 for(const delay of [600000,86400000]){
  const f=resumeFixture();f.rp.migrationReviewCompletedUtc=time(delay);f.resumed=[cap(1,delay+1000),cap(1,delay+2000)];f.rp.nowUtc=time(delay+301000)
  const r=resume(f);expect(r.resumedCompletedUtc).toBe(time(delay+2200));expect(r.stoppedCompletedUtc).toBe(time(1200));expect(r.launchAuthorized).toBe(false)
  f.rp.nowUtc=time(delay+301001);expect(()=>resume(f)).toThrow('RESUMED_STALE_OR_FUTURE')
 }
 const f=resumeFixture();f.rp.nowUtc=time(602199);expect(()=>resume(f)).toThrow('RESUMED_STALE_OR_FUTURE')
})
test('accepted stop exact hash, binding/image, flags and chronology reject ordinary mutations',()=>{
 const f=resumeFixture();f.rp.acceptedStoppedVerificationSha256='0'.repeat(64);expect(()=>resume(f)).toThrow('STOP_RECEIPT_PIN_MISMATCH')
 for(const field of ['bindingReceiptSha256','bindingReviewSha256','projectId','environmentId','serviceId','region','deploymentId','deployedCommit','imageDigest']){
  const c=resumeFixture();c.s={...c.s,[field]:'wrong'};c.rp.acceptedStoppedVerificationSha256=hostedSetupStoppedVerificationSha256(c.s);expect(()=>resume(c)).toThrow('STOP_RECEIPT_BINDING_MISMATCH')
 }
 for(const field of ['mutationAuthorized','providerAuthenticationEstablished','migrationAuthorized','resumeAuthorized','launchAuthorized']){
  const c=resumeFixture();c.s={...c.s,[field]:true};c.rp.acceptedStoppedVerificationSha256=hostedSetupStoppedVerificationSha256(c.s);expect(()=>resume(c)).toThrow('STOP_RECEIPT_AUTHORITY_REFUSED')
 }
 for(const reviewed of [1200,1199,601000,604000]){const c=resumeFixture();c.rp.migrationReviewCompletedUtc=time(reviewed);expect(()=>resume(c)).toThrow('RESUME_CHRONOLOGY_REFUSED')}
})
test('resumed pair rejects replays and changed selected image configuration runtime fields',()=>{
 for(const mode of ['pair-replay','cross-replay','image','config','runtime','same-config']){
  const f=resumeFixture();if(mode==='pair-replay')f.resumed[1]=f.resumed[0]
  if(mode==='cross-replay'){f.s={...f.s,stoppedCaptureSha256:[deploymentCaptureHash(f.resumed[0]),f.s.stoppedCaptureSha256[1]]};f.rp.acceptedStoppedVerificationSha256=hostedSetupStoppedVerificationSha256(f.s)}
  if(mode==='image')for(const c of f.resumed)mutate(c,'inventoryJson',o=>o.data.deployments.edges[0].node.meta.commitHash='8'.repeat(40))
  if(mode==='config')mutate(f.resumed[1],'inventoryJson',o=>o.data.environment.configEtag='8'.repeat(64))
  if(mode==='runtime')mutate(f.resumed[1],'statusJson',o=>{inst(o).latestDeployment.instances[0].id=other;inst(o).activeDeployments[0].instances[0].id=other})
  if(mode==='same-config'){for(const c of f.resumed)mutate(c,'inventoryJson',o=>o.data.environment.configEtag='3'.repeat(64));f.rp.expectedResumedConfigurationVersion=null as any}
  expect(()=>resume(f)).toThrow()
 }
})
import {deploymentCaptureSha256 as deploymentCaptureHash} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-deployment-binding.ts'
test('accepted stop hash must cover chronology values actually validated (getter adversary)',()=>{
 const f=resumeFixture();f.resumed=[cap(1,1000),cap(1,2000)];f.rp.nowUtc=time(3000);f.rp.migrationReviewCompletedUtc=time(600)
 expect(()=>resume(f)).toThrow('RESUME_CHRONOLOGY_REFUSED')
 const original=f.s;let reads=0
 f.s={...original,get stoppedCompletedUtc(){return ++reads===1?time(500):original.stoppedCompletedUtc}}
 const result=resume(f)
 console.log(JSON.stringify({getterReads:reads,acceptedStopSha:f.rp.acceptedStoppedVerificationSha256,returnedStopCompleted:result.stoppedCompletedUtc,returnedReviewCompleted:result.migrationReviewCompletedUtc,returnedResumeCompleted:result.resumedCompletedUtc}))
 expect(Date.parse(result.migrationReviewCompletedUtc)).toBeGreaterThan(Date.parse(result.stoppedCompletedUtc))
})
test('accepted stop hash must bind the same image used for resume (getter adversary)',()=>{
 const f=resumeFixture(),pinned=f.s,different='sha256:'+'8'.repeat(64)
 f.binding={...f.binding,imageDigest:different}
 for(const c of f.resumed){mutate(c,'statusJson',o=>{inst(o).latestDeployment.meta.imageDigest=different;inst(o).activeDeployments[0].meta.imageDigest=different});mutate(c,'inventoryJson',o=>o.data.deployments.edges[0].node.meta.imageDigest=different)}
 expect(()=>resume(f)).toThrow('STOP_RECEIPT_BINDING_MISMATCH')
 let reads=0;f.s={...pinned,get imageDigest(){return ++reads===1?different:pinned.imageDigest}}
 const result=resume(f)
 console.log(JSON.stringify({imageGetterReads:reads,acceptedStopSha:f.rp.acceptedStoppedVerificationSha256,pinnedStopImage:pinned.imageDigest,returnedResumeImage:result.imageDigest}))
 expect(result.imageDigest).toBe(pinned.imageDigest)
})
```
