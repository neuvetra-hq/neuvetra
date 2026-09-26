# Exact-image live stop — independent repair 1 review

Task HOSTED-SETUP-LIVE-STOP-REPAIR1-QA-01, 2026-09-26 UTC. Reviewer /root/compose_qa did not author this root-authored repair. Requested registered critical qa-lead gpt-6-astra/high; observed model/effort unknown in follow-up context. QA instructions/registry refreshed. This is a separate review; original Candidate1 FAIL remains unchanged at hosted-setup-01-live-stop-independent-review1.md, SHA 5eb6d00949c5c7cc631a54227c7c882ca679613a49fdc6bf1b346cc79ed020f5.

**Verdict: FAIL for repair1 due to new LIVE-STOP-F05 (P2), finalization failure semantics. Original LIVE-STOP-F01–F04 are fixed in the tested public boundaries.** No live scale, provider access, database action, Git action or candidate edit occurred. All native command invocation was intercepted with synthetic responses.

## Frozen reviewed files

| File | SHA-256 |
|---|---|
| tools/staging/hosted-setup-live-stop.ts | 25b536f42c5dce785c9d2a8af25358ba26784df9b127459ff541d0b45b70f45a |
| tools/staging/hosted-setup-live-stop.test.ts | 282a812a7206682302e209270d70882b9c00c90f9b64b3ebbc4a8eeb9d697733 |
| evaluations/research-qa/hosted-setup-01-live-stop-repair1-author.md | fa90f6724bc014ee3e5c2ee60f845a7a3bfb59a8ef2dac58cc7fb310321f1480 |

Source/test pins matched dispatch and remained unchanged after checks.

## Original finding dispositions

- **F01, fixed:** caller replacement of input.binding after capability consumption no longer changes the binding used for stopped verification. The original different-image repro now refuses after one synthetic scale, leaving an empty reserved receipt. An additional positive control changed the caller binding without changing the actual observed image; the helper successfully certified only the original image.
- **F02, fixed:** transport getter is refused without invocation (getter reads0, scale calls0). Default transport captures the executable path once for hash and invocation. Ordinary default-runtime test still reaches one intercepted scale using the pinned executable, exact argv and shell:false. Snapshot tests also replace caller paths and runtime methods after entry; captured original methods/paths remain effective and no substituted path receives a receipt.
- **F03, fixed:** pre-existing receipt refuses before capture/scale (scale0), preserving existing bytes. A new receipt is exclusively reserved before provider work. Failed attempts retain an empty reservation; it is not a completed parseable receipt and journal records refusal or uncertainty where available.
- **F04, fixed:** stopped pairs predating preflight/scale response refuse after a single synthetic scale. Reversed scale-start clock refuses before scale, reversed response clock refuses after one scale, and stopped start before the response boundary refuses. Successful null/zero stopped-shape and ordinary-stop controls still pass.

## LIVE-STOP-F05 — P2 — close failures bypass uncertainty handling and can skip journal cleanup

At the final line of stopHostedSetupExactImage, `finally { await receiptFile?.close(); await journal.close() }` is outside the catch that converts post-scale failures into the fixed uncertainty error. A receipt-close exception skips journal.close entirely; either close exception overrides the return/error with its raw exception.

Independent injected I/O failure used actual local file handles wrapped only at close. The wrapper first called the real close, then threw a harmless synthetic error. This models a close/finalization failure without leaving those targeted handles open or using real private values. Both cases had completed one synthetic scale and written/synced the observed stopped receipt and normal journal event before injection. The test explicitly checked both cases before asserting:

| Fault | Scale calls | Fixed uncertainty error | Raw synthetic error escaped | Receipt close attempted | Journal close attempted | Uncertainty marker | Normal receipt-written event |
|---|---:|---|---|---|---|---|---|
| receiptFile.close | 1 | false | true | true | false | absent | present |
| journal.close | 1 | false | true | true | true | absent | present |

This does not demonstrate a real token leak or a live provider incident. It demonstrates that the public helper bypasses its error-sanitization/uncertainty contract for a plausible finalization failure and does not independently attempt both cleanups. The existing receipt-written event describes already-observed work; it does not establish clean helper finalization after the injected fault. The test closed every opened native handle in its own cleanup.

Required repair: handle finalization failures explicitly, attempt receipt and journal closure independently even when one fails, and normalize every post-scale failure to HS_LIVE_STOP_OUTCOME_UNCERTAIN_DO_NOT_RETRY without raw exception text. Attempt uncertainty journaling while a usable journal remains available; do not claim a marker can always be written after the journal is unavailable. Preserve the single-use reservations and no-retry semantics. Add receipt-close and journal-close failure tests alongside ordinary success, pre-scale refusal and post-scale uncertainty.

## Execution evidence and preserved harness history

- Candidate suite on frozen repair1: **6 passed /29 assertions**, Bun1.3.12.
- Literal replay of the preserved original9-test probe: **5 passed,4 failed /18 assertions**. Its original runtime supplied only two clock phases, so the new scale start/response checks correctly rejected positive controls. It also expected absent receipts, while the repair intentionally reserves an empty file. These outdated harness expectations were preserved, not attributed to candidate defects.
- A new probe copy updated only the synthetic clock sequence (consume/start/response9500, final14000) and empty-reservation expectation, preserving the original adversarial input changes. Added immutable binding/path/runtime and reversed-clock cases. Result: **11 passed /78 assertions**, including all four original reproducers and positive controls.
- Appended finalization-fault test, specifically requested by coordinator during review, and ran it separately: **0 passed,1 failed /1 assertion**, eleven tests filtered out. Both receipt/journal fault results are shown above. No finding was repaired by QA.
- Scoped strict TypeScript passed: `bunx tsc --noEmit --strict --target ESNext --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-live-stop.ts tools/staging/hosted-setup-live-stop.test.ts`. Third-party declaration checking is outside skipLibCheck coverage.

Positive checks retain: authentic capability one-time use; copied capability refusal; new-journal replay refusal; existing-journal refusal before capture; four actual capture-module status/API calls with synthetic intercepted transport; fixed project/environment/service/region argv; no shell; ambient synthetic RAILWAY_TOKEN exclusion; invalid/oversize scale output and thrown scale errors give generic uncertainty without secret sentinel in errors/journals; no automatic retry; same-image null/zero synthetic stopped configuration; migrationAuthorized=false and resumeAuthorized=false.

Final independent probe `%TEMP%/hosted-live-stop-repair1-independent.test.ts`, SHA **9d5c4cfe7ebe87b3a1e48e8c358040f08322a1a3cf373cb5c7a421bfcba3b454**, is embedded below. Original probe file was preserved. Imports retain native Windows spelling to share the actual deployment-binder WeakMap instance, as diagnosed in Candidate1 review. Final tests reference the unmodified candidate, not the earlier temporary diagnostic source copy.

## Limits

This review uses synthetic observations and intercepted execFile; no real stopped-state observation or scale occurred. It proves local control flow, not live provider outcome, physical storage durability, privileged writer exclusion, Windows ACL secrecy, hostile-host immutability, migration authority or resume correctness. Runtime/provider authenticity remains a trusted-host boundary. Single-use reservations must not be replayed; empty or partial files are not accepted receipts. F01–F04 may be marked fixed for these exact bytes, but integrated acceptance remains withheld until F05 is repaired and independently rechecked. QA artifact/run closure and immutable packaging remain coordinator-owned.

## Independent probe

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
 expect(JSON.parse(await readFile(receipt,'utf8')).deployedCommit).toBe(IMAGE.deployedCommit);expect(await readFile(journal,'utf8')).toContain('exact_image_stopped_and_receipt_written');expect(await Bun.file(s.input.receiptPath).exists()).toBe(false);
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
