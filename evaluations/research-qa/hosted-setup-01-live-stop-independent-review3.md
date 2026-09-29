# Exact-image live stop — independent repair 2 review

Task HOSTED-SETUP-LIVE-STOP-REPAIR2-QA-01. Date2026-09-26 UTC. Reviewer /root/compose_qa did not author source or test. Registered critical qa-lead gpt-6-astra/high requested; actual follow-up settings unknown. QA role and registry refreshed. Prior reports remain unchanged: Candidate1 FAIL, hosted-setup-01-live-stop-independent-review1.md SHA5eb6d00949c5c7cc631a54227c7c882ca679613a49fdc6bf1b346cc79ed020f5; repair1 FAIL, hosted-setup-01-live-stop-independent-review2.md SHA1e88363b82c4652e33a3de8838d7883967f1aedf9c3d5d4a36cf925693b94275.

**Verdict: bounded PASS for repaired production helper behavior F01–F05; FAIL for the frozen source-and-test package because the candidate test leaves a concrete cross-test filesystem fault active (new LIVE-STOP-F06, P2).** No production-source regression was found in the tested scope. Fix and independently recheck the test cleanup before package acceptance. No live stop or provider/database operation occurred; source/test bytes were not edited.

## Exact reviewed bytes

| Artifact | SHA-256 |
|---|---|
| tools/staging/hosted-setup-live-stop.ts | 334c357cd645b88a8bf3007895474315998a4ec123bcec0a558a47565b96e706 |
| tools/staging/hosted-setup-live-stop.test.ts | 01933364602abc12b9177f873724e613e8acf4e161dc11e6dfcff676615af2c4 |
| evaluations/research-qa/hosted-setup-01-live-stop-repair2-author.md | 6f1942f1f5e4fcf6c0a7d9c4ac8a54c7418c2970797066f7bb5c24fe4fc13763 |

Pins matched dispatch and remained unchanged after testing.

## F01–F05 dispositions

All original reproducers remain exercised, with genuine ordinary-success controls:

- F01: original consumed WeakMap capability stays selected. Changing caller binding during scale cannot certify the substituted deployment/commit/digest; it refuses after one synthetic scale. Changing caller binding alone while observations still name the original image yields only the original image. Caller path and runtime-method replacement cannot redirect the selected operations.
- F02: executable-path getter refuses with zero getter reads and zero scale calls. The ordinary default runtime still invokes exactly the pinned executable and fixed project/environment/service/region argv with shell:false; all native invocations are intercepted by the independent harness.
- F03: existing receipt refuses before captures/scale and preserves old bytes. A new failed attempt keeps an empty reserved receipt, not a completed accepted artifact. Existing journal, copied capability and consumed capability cannot cause another scale.
- F04: captures from before preflight/scale response refuse. Reversed scale-start clock refuses before scale; reversed completion and stopped-start-before-response refuse after one attempt. Ordinary chronological stop still succeeds; no retry.
- F05: both receipt-close and journal-close injected failures now return exactly the generic no-retry uncertainty category, suppress raw synthetic exception detail, attempt both handle closures, and retain uncertainty evidence in the observed journal. No old terminal success event appears. Receipt-close failure is caught before receipt_synced_pending_finalization; journal-close failure uses a best-effort append through a new handle. This helper cannot guarantee writing an event after storage becomes unavailable; failure to write must remain uncertainty.

Original F05 probe, against exact repair2, observed for **both** close-fault cases: scaleCalls1, uncertainError=true, rawErrorLeaked=false, receiptCloseAttempted=true, journalCloseAttempted=true, uncertaintyRecorded=true, successRecorded=false. These were synthetic faults after closing actual local fixture file handles. No real secret was involved.

## LIVE-STOP-F06 — P2 — candidate test leaves fs/promises mocked across later tests

The last test in hosted-setup-live-stop.test.ts calls mock.module('node:fs/promises', ...) to override open and inject close failures. It neither restores the original module exports nor resets the final faultPath. Consequently later code in the same Bun process continues to receive proxy handles and the synthetic error for the previous test's journal path.

Independent isolation probe statically imports the frozen candidate test module, captures the original fs.open before tests execute, then registers one later test. After all seven candidate tests pass, the later test compares the module export and reopens/closes only newly created candidate fixture journals. Observed:

- openRestored=false.
- One later close throws the candidate's SYNTHETIC_PRIVATE_CLOSE_DETAIL for the prior fixture journal.
- The seven candidate tests pass; the follow-on isolation test fails: **7 passed,1 failed /42 assertions**.

This is concrete behavior, not merely a function-identity concern. It is a test-package isolation defect and can make subsequent tests order-dependent or cause them to exercise an unintended filesystem wrapper. It is not a demonstrated production-provider vulnerability. The synthetic fixture journal was closed before the wrapper threw; no native handle was intentionally left open by this follow-on check.

A nominal combined run of artifact-bindings, deployment-binding and live-stop tests passed26/145, but Bun executed live-stop last. That run therefore did not prove cleanup of a mock installed at the end. The explicit follow-on test exposes the missing coverage.

Required correction is test-only: restore original fs/promises behavior in finally even if an assertion throws (or isolate this fault suite in its own process), clear fault state and verify a later test sees native behavior. Do not assume a generic mock-reset helper restores module replacement without observing that result. No author file was changed during QA.

## Validation and preserved harness mismatch

- Frozen candidate suite: **7 passed /41 assertions**, Bun1.3.12.
- Literal repair1 probe replay: **11 passed,1 failed /78 assertions**. The only failure was a stale expected journal event name exact_image_stopped_and_receipt_written; repair2 intentionally uses receipt_synced_pending_finalization. F05 already passed in this literal replay. Original probe preserved.
- New probe copy changed only that event-name assertion. All original adversarial inputs remained: **12 passed /79 assertions**. Coverage includes ordinary success, uncertainty, immutable binding/executable/path/runtime, capability/journal replay, invalid/oversize output, token-environment exclusion, generic scale errors, null/zero stopped shapes, reversed phase clocks and both close failures.
- Combined local suite: **26 passed /145 assertions** across artifact-bindings, deployment-binding and live-stop; no broader acceptance of those other changing artifacts is implied.
- Explicit candidate-plus-follow-on isolation probe: **7 passed,1 failed /42 assertions**, F06 above.
- Scoped strict TypeScript on source/test passed using noEmit, strict, ESNext, Bundler, Bun types and skipLibCheck. This does not check excluded third-party declarations.

Temporary probes, embedded below:

- hosted-live-stop-repair2-independent.test.ts SHA124aa139b2d3a888fc067a245e2dc29be77ea4d34e93560f613a2b641b4da262.
- hosted-live-stop-repair2-mock-isolation.test.ts SHA1e4c6d2932be88292dbbab61c6f29ada4c6c44d60454fb288f468a1aeae82ddc.

No candidate edits, live Railway scale, provider reads/writes, database mutation, credentials or Git operations. Tests use actual local filesystem fixtures and intercepted native command calls. A passing synthetic stopped shape is not evidence that the live service is stopped. The reviewed helper coordinates availability only and does not exclude database writers, authorize migration or implement resume. Trusted-host storage/ACLs and authenticated operator inputs remain external assumptions. Returned result plus verifiable receipt and independent current provider evidence remain distinct from a pending journal event; an uncertain run must never be replayed. Coordinator review and immutable QA packaging remain pending.

## Original repair probes with updated event assertion

```typescript
import {expect,test} from 'bun:test'
import {mkdtemp,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DEPLOYMENT_TARGET as T,DEPLOYMENT_REVIEW_PROFILE,createHostedSetupDeploymentReceipt,
 deploymentBindingSha256,deploymentCaptureSha256,verifyHostedSetupDeploymentBinding,
 type DeploymentCapture,type DeploymentBindingPolicy} from "C:\\Users\\nimab\\.codex\\worktrees\\inventory-plan-delivery\\Neuvetra\\tools\\staging\\hosted-setup-deployment-binding"
import {HOSTED_SETUP_LIVE_STOP_PROFILE,stopHostedSetupExactImage,type LiveStopRuntime} from "C:\\Users\\nimab\\.codex\\worktrees\\inventory-plan-delivery\\Neuvetra\\tools\\staging\\hosted-setup-live-stop"
import {RAILWAY_CAPTURE_PROFILE} from "C:\\Users\\nimab\\.codex\\worktrees\\inventory-plan-delivery\\Neuvetra\\tools\\staging\\hosted-setup-railway-capture"

const IMAGE={deploymentId:'33333333-3333-4333-8333-333333333333',deployedCommit:'b'.repeat(40),imageDigest:'sha256:'+'c'.repeat(64)}
const INSTANCE='22222222-2222-4222-8222-222222222222'
let serial=0
function fixture(){
 const epoch=Date.now()-10_000+(++serial),at=(ms:number)=>new Date(epoch+ms).toISOString()
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

import {mock} from 'bun:test';
import {writeFile} from 'node:fs/promises';
async function scenario(){
 const f=fixture(),root=await mkdtemp(join(tmpdir(),'hs-stop-independent-'));
 const input={profile:HOSTED_SETUP_LIVE_STOP_PROFILE,binding:f.binding,railway:{profile:RAILWAY_CAPTURE_PROFILE,executablePath:process.execPath,workingDirectory:root,timeoutMs:1000},journalPath:join(root,'attempt.jsonl'),receiptPath:join(root,'receipt.json')};
 const captures=[f.cap(6000,1,'d'.repeat(64)),f.cap(8000,1,'d'.repeat(64)),f.cap(10000,0,'e'.repeat(64)),f.cap(12000,0,'e'.repeat(64))];
 let calls=0,clocks=0;
 const runtime:LiveStopRuntime={capture:async()=>captures.shift()!,scale:async()=>{calls++;return JSON.stringify({regions:{[T.region]:null}})},now:()=>f.at(++clocks<=3?9500:14000)};
 return {f,root,input,captures,runtime,calls:()=>calls};
}
function changeImage(c:DeploymentCapture){
 const s=JSON.parse(c.statusJson),d=JSON.parse(c.inventoryJson),i=s.environments.edges[0].node.serviceInstances.edges[0].node;
 for(const row of [i.latestDeployment,...i.activeDeployments,...d.data.deployments.edges.map((e:any)=>e.node)]){row.id='44444444-4444-4444-8444-444444444444';row.meta.commitHash='e'.repeat(40);row.meta.imageDigest='sha256:'+'f'.repeat(64)}
 c.statusJson=JSON.stringify(s);c.inventoryJson=JSON.stringify(d);
}
test('post-scale binding reassignment must not certify a different image',async()=>{
 const s=await scenario(),scale=s.runtime.scale;s.runtime.scale=async r=>{s.input.binding={...s.f.binding,deploymentId:'44444444-4444-4444-8444-444444444444',deployedCommit:'e'.repeat(40),imageDigest:'sha256:'+'f'.repeat(64)};for(const c of s.captures)changeImage(c);return scale(r)};
 let result:any,rejected=false;try{result=await stopHostedSetupExactImage(s.input,s.runtime)}catch{rejected=true}
 console.log(JSON.stringify({probe:'binding-reassignment',rejected,scaleCalls:s.calls(),receiptDeployment:result?.deploymentId,originalDeployment:s.f.binding.deploymentId}));expect(rejected).toBe(true);
});
test('existing receipt must refuse before any irreversible scale attempt',async()=>{
 const s=await scenario();await writeFile(s.input.receiptPath,'DO-NOT-OVERWRITE');let refused=false;try{await stopHostedSetupExactImage(s.input,s.runtime)}catch{refused=true}
 expect(refused).toBe(true);expect(await readFile(s.input.receiptPath,'utf8')).toBe('DO-NOT-OVERWRITE');console.log(JSON.stringify({probe:'existing-receipt',scaleCalls:s.calls()}));expect(s.calls()).toBe(0);
});
test('stopped captures predating running preflight must not establish this stop outcome',async()=>{
 const s=await scenario();s.captures.splice(2,2,s.f.cap(1000,0,'e'.repeat(64)),s.f.cap(3000,0,'e'.repeat(64)));
 let rejected=false;try{await stopHostedSetupExactImage(s.input,s.runtime)}catch{rejected=true}
 console.log(JSON.stringify({probe:'old-stopped-captures',rejected,scaleCalls:s.calls()}));expect(rejected).toBe(true);
});
const CLI='C:/Users/nimab/Neuvetra/m63-runtime/railway-cli/node_modules/@railway/cli/bin/railway.exe';
let nativeFixture:ReturnType<typeof fixture>,nativeScaled=false,cliCalls:any[]=[];
mock.module('node:child_process',()=>({execFile:(exe:string,args:string[],options:any,callback:Function)=>{
 cliCalls.push({exe,args:[...args],shell:options.shell,envKeys:Object.keys(options.env)});
 setTimeout(()=>{if(args[0]==='scale'){nativeScaled=true;callback(null,JSON.stringify({regions:{[T.region]:null}}),'');return}
 const c=nativeFixture.cap(0,nativeScaled?0:1,(nativeScaled?'e':'d').repeat(64));callback(null,args[0]==='--version'?'railway 5.62.1':args[0]==='status'?c.statusJson:c.inventoryJson,'')},6);return {};
}}));
test('default runtime must execute the same binary whose hash was checked despite executable getter drift',async()=>{
 const s=await scenario();nativeFixture=s.f;nativeScaled=false;cliCalls=[];let reads=0;
 Object.defineProperty(s.input.railway,'executablePath',{enumerable:true,get(){return ++reads===4?join(s.root,'unverified.exe'):CLI}});
 let rejected=false;try{await stopHostedSetupExactImage(s.input)}catch{rejected=true}
 const scaleCalls=cliCalls.filter(c=>c.args[0]==='scale');
 console.log(JSON.stringify({probe:'executable-getter-drift',rejected,reads,scaleExecutable:scaleCalls[0]?.exe,scaleCount:scaleCalls.length}));
 expect(scaleCalls.every(c=>c.exe===CLI)).toBe(true);
});
test('harness sanity direct capability consume and basic successful stop reach the mutation boundary',async()=>{
 const {consumeHostedSetupDeploymentBinding}=await import("C:\\Users\\nimab\\.codex\\worktrees\\inventory-plan-delivery\\Neuvetra\\tools\\staging\\hosted-setup-deployment-binding");
 const f=fixture();expect(()=>consumeHostedSetupDeploymentBinding(f.binding,[f.cap(6000,1,'d'.repeat(64)),f.cap(8000,1,'d'.repeat(64))],f.at(9500))).not.toThrow();
 const s=await scenario();await stopHostedSetupExactImage(s.input,s.runtime);expect(s.calls()).toBe(1);
});
test('captured default CLI argv and environment stay fixed in the ordinary successful path',async()=>{
 const s=await scenario();nativeFixture=s.f;nativeScaled=false;cliCalls=[];s.input.railway.executablePath=CLI;
 const token=process.env.RAILWAY_TOKEN;process.env.RAILWAY_TOKEN='SYNTHETIC-NOT-A-REAL-TOKEN';
 try{
  const result=await stopHostedSetupExactImage(s.input);expect(result.deploymentId).toBe(IMAGE.deploymentId);
  const scales=cliCalls.filter(c=>c.args[0]==='scale');expect(scales).toHaveLength(1);expect(scales[0].exe).toBe(CLI);expect(scales[0].shell).toBe(false);
  expect(scales[0].args).toEqual(['scale','--project',T.projectId,'--environment',T.environmentId,'--service',T.serviceId,'--json',T.region+'=0']);
  expect(scales[0].envKeys).not.toContain('RAILWAY_TOKEN');expect(cliCalls.filter(c=>c.args[0]==='status')).toHaveLength(4);expect(cliCalls.filter(c=>c.args[0]==='api')).toHaveLength(4);
 }finally{if(token===undefined)delete process.env.RAILWAY_TOKEN;else process.env.RAILWAY_TOKEN=token}
});
test('scale response failures remain uncertain, secret-free, single attempt, without a completed receipt',async()=>{
 const responses=['not-json','{}',JSON.stringify({regions:{other:null}}),JSON.stringify({regions:{[T.region]:1}}),JSON.stringify({regions:{[T.region]:{numReplicas:1}}}),JSON.stringify({regions:{[T.region]:null},extra:true}),'X'.repeat(1024*1024+1)];
 for(const raw of responses){const s=await scenario();let scaleCalls=0;s.runtime.scale=async()=>{scaleCalls++;return raw};await expect(stopHostedSetupExactImage(s.input,s.runtime)).rejects.toThrow('OUTCOME_UNCERTAIN_DO_NOT_RETRY');expect(scaleCalls).toBe(1);expect(await readFile(s.input.receiptPath,'utf8')).toBe('');expect(await readFile(s.input.journalPath,'utf8')).toContain('outcome_uncertain_do_not_retry')}
 const s=await scenario();let calls=0;s.runtime.scale=async()=>{calls++;throw Error('SYNTHETIC-PRIVATE-SENTINEL')};
 let error='';try{await stopHostedSetupExactImage(s.input,s.runtime)}catch(e){error=String(e)}
 expect(calls).toBe(1);expect(error).toContain('OUTCOME_UNCERTAIN');expect(error).not.toContain('SYNTHETIC-PRIVATE-SENTINEL');expect(await readFile(s.input.journalPath,'utf8')).not.toContain('SYNTHETIC-PRIVATE-SENTINEL');
});
test('single-use capability, copied binding and journal replay cannot issue another scale',async()=>{
 const s=await scenario();await stopHostedSetupExactImage(s.input,s.runtime);expect(s.calls()).toBe(1);
 s.input.journalPath=join(s.root,'another-attempt.jsonl');s.input.receiptPath=join(s.root,'another-receipt.json');s.captures.push(s.f.cap(15000,1,'d'.repeat(64)),s.f.cap(17000,1,'d'.repeat(64)));
 await expect(stopHostedSetupExactImage(s.input,s.runtime)).rejects.toThrow('REFUSED_BEFORE_SCALE');expect(s.calls()).toBe(1);
 const g=await scenario();g.input.binding={...g.f.binding};await expect(stopHostedSetupExactImage(g.input,g.runtime)).rejects.toThrow('REFUSED_BEFORE_SCALE');expect(g.calls()).toBe(0);
 const h=await scenario();await writeFile(h.input.journalPath,'reserved');await expect(stopHostedSetupExactImage(h.input,h.runtime)).rejects.toThrow();expect(h.calls()).toBe(0);expect(h.captures).toHaveLength(4);
});
test('synthetic stopped shape accepts null region configuration or explicit zero, with no running instances',async()=>{
 for(const zero of [null,{numReplicas:0}]){
  const s=await scenario();for(const capture of s.captures.slice(2)){const d=JSON.parse(capture.inventoryJson);d.data.environment.config.services[T.serviceId].deploy.multiRegionConfig[T.region]=zero;capture.inventoryJson=JSON.stringify(d)}
  s.runtime.scale=async()=>JSON.stringify({regions:{[T.region]:zero}});
  const result=await stopHostedSetupExactImage(s.input,s.runtime);expect(result.stoppedConfigurationVersion).toBe('e'.repeat(64));expect(result.migrationAuthorized).toBe(false);expect(result.resumeAuthorized).toBe(false);
 }
});
test('snapshot retains original binding, paths and selected runtime methods despite caller mutation',async()=>{
 const s=await scenario(),journal=s.input.journalPath,receipt=s.input.receiptPath,originalScale=s.runtime.scale,originalCapture=s.runtime.capture;let changedScale=0,changedCapture=0;
 s.runtime.capture=async input=>{const c=await originalCapture(input);s.runtime.scale=async()=>{changedScale++;throw Error('replaced')};return c};
 s.runtime.scale=async input=>{s.input.binding={...s.f.binding,deployedCommit:'e'.repeat(40)};s.input.receiptPath=join(s.root,'wrong.json');s.input.journalPath=join(s.root,'wrong.jsonl');s.runtime.capture=async()=>{changedCapture++;throw Error('replaced')};return originalScale(input)};
 const result=await stopHostedSetupExactImage(s.input,s.runtime);
 expect(result.deployedCommit).toBe(IMAGE.deployedCommit);expect(changedScale).toBe(0);expect(changedCapture).toBe(0);expect(s.calls()).toBe(1);
 expect(JSON.parse(await readFile(receipt,'utf8')).deployedCommit).toBe(IMAGE.deployedCommit);expect(await readFile(journal,'utf8')).toContain('receipt_synced_pending_finalization');expect(await Bun.file(s.input.receiptPath).exists()).toBe(false);
});
test('reversed scale clocks and stopped capture before response remain refused without retries',async()=>{
 for(const times of [[9500,8500,9500,14000],[9500,9500,9400,14000],[9500,9500,11000,14000]]){
  const s=await scenario();let index=0;s.runtime.now=()=>s.f.at(times[index++]!);
  await expect(stopHostedSetupExactImage(s.input,s.runtime)).rejects.toThrow(times[1]===8500?'REFUSED_BEFORE_SCALE':'OUTCOME_UNCERTAIN');
  expect(s.calls()).toBe(times[1]===8500?0:1);expect(await readFile(s.input.receiptPath,'utf8')).toBe('');
 }
});
test('receipt or journal close failure after scale must be uncertain and still attempt both closes',async()=>{
 const native={...await import('node:fs/promises')};let receiptPath='',journalPath='',faultTarget='',closed:string[]=[];let opened:any[]=[];
 mock.module('node:fs/promises',()=>({...native,open:async(...args:any[])=>{
  const handle=await (native.open as any)(...args),path=String(args[0]);opened.push(handle);
  return new Proxy(handle,{get(target,key){if(key==='close')return async()=>{closed.push(path);await target.close();if(path===faultTarget)throw Error('SYNTHETIC_PRIVATE_CLOSE_DETAIL')};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});
 }}));
 const results:any[]=[];
 for(const kind of ['receipt','journal']){
  const s=await scenario();receiptPath=s.input.receiptPath;journalPath=s.input.journalPath;faultTarget=kind==='receipt'?receiptPath:journalPath;closed=[];opened=[];
  let error='';try{await stopHostedSetupExactImage(s.input,s.runtime)}catch(e){error=String(e)}
  const journal=await native.readFile(journalPath,'utf8');
  results.push({kind,scaleCalls:s.calls(),uncertainError:error.includes('HS_LIVE_STOP_OUTCOME_UNCERTAIN_DO_NOT_RETRY'),rawErrorLeaked:error.includes('SYNTHETIC_PRIVATE_CLOSE_DETAIL'),journalCloseAttempted:closed.includes(journalPath),receiptCloseAttempted:closed.includes(receiptPath),uncertaintyRecorded:journal.includes('outcome_uncertain_do_not_retry'),successRecorded:journal.includes('exact_image_stopped_and_receipt_written')});
  for(const handle of opened)try{await handle.close()}catch{}
 }
 console.log(JSON.stringify({probe:'finalization-faults',results}));
 expect(results.every(r=>r.scaleCalls===1&&r.uncertainError&&!r.rawErrorLeaked&&r.journalCloseAttempted&&r.receiptCloseAttempted)).toBe(true);
});
```

## Follow-on isolation probe

```typescript
import 'C:\\Users\\nimab\\.codex\\worktrees\\inventory-plan-delivery\\Neuvetra\\tools\\staging\\hosted-setup-live-stop.test.ts';
import {test,expect} from 'bun:test';
import * as fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const originalOpen=fs.open;
const existing=new Set((await fs.readdir(tmpdir())).filter(x=>x.startsWith('hs-live-stop-')));
test('later suite gets native fs.open and can close prior reserved journals without synthetic fault',async()=>{
 const current=await import('node:fs/promises');
 const fresh=(await fs.readdir(tmpdir())).filter(x=>x.startsWith('hs-live-stop-')&&!existing.has(x));
 const failures:string[]=[];
 for(const dir of fresh){const path=join(tmpdir(),dir,'attempt.jsonl');let handle;try{handle=await current.open(path,'r')}catch{continue}try{await handle.close()}catch(e){if(String(e).includes('SYNTHETIC_PRIVATE_CLOSE_DETAIL'))failures.push(path);else throw e}}
 console.log(JSON.stringify({probe:'after-live-stop-suite',openRestored:current.open===originalOpen,syntheticCloseFailures:failures.length,affectedJournalPaths:failures}));
 expect(current.open).toBe(originalOpen);expect(failures).toEqual([]);
});
```
