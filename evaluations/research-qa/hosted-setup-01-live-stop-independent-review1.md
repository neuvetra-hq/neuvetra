# Exact-image live stop — independent Candidate 1 review

Task HOSTED-SETUP-LIVE-STOP-QA-01, 2026-09-26 UTC. Independent reviewer /root/compose_qa did not author this root-authored helper/test. Requested registered critical qa-lead gpt-6-astra/high; actual follow-up model/effort unknown. Registry dispatch was temporarily blocked by a separate publisher artifact's in-progress hash, as reported by coordinator. QA role refreshed; tests focus on L02/L04/L06 exact bytes, public execution boundary and uncertainty semantics.

**Verdict: FAIL. Four reproducible findings: two P1 input-identity defects and two P2 reservation/chronology defects.** All executable invocations were intercepted in the independent tests; no Railway CLI scale, provider mutation, database action or Git operation occurred. No reviewed source was edited. Do not use this candidate to stop the live service. Its independent first failure remains preserved for repair and exact-byte re-review.

## Frozen inputs

| File | SHA-256 |
|---|---|
| tools/staging/hosted-setup-live-stop.ts | ef3fb32530a7415bbba4668548260a6db0917e923172b7cf44ec3df739ddd907 |
| tools/staging/hosted-setup-live-stop.test.ts | a3bf58d63a78ad14cf10957594e445bdcb0273957df38972ad9b15f2357abfbb |
| evaluations/research-qa/hosted-setup-01-live-stop-author.md | f4f9fbd1908903912a136d90cc51b84a1e8d4f7e79692062994d4102d7fe6eb0 |

Pins matched dispatch and remained unchanged after testing. Referenced deployment binder retained SHA ecca1ad63fd77598a56f2e599fd7b96b386bd6dacc797c0a4963f2ca3abdbae4.

## LIVE-STOP-F01 — P1 — mutable binding replacement certifies another image

The helper consumes input.binding at line92 but rereads input.binding at99 after awaiting scale and stopped captures. The authentic binding itself is frozen; its property on the caller's input is not captured. verifyHostedSetupStopped structurally validates the later supplied binding, rather than establishing that it is the same capability consumed earlier.

Reproducer: start with an authentic issued capability for deployment33333333-3333-4333-8333-333333333333, commit b repeated40 and digest c repeated64. During the synthetic scale callback, replace input.binding with a structural copy naming deployment44444444-4444-4444-8444-444444444444, commit e repeated40 and digest f repeated64; return two stopped captures for that substituted image. The helper **returned success and persisted a stopped receipt for444... after consuming333...**, with scaleCalls=1. Receipt/review references remained copied from the original binding. No real service was touched.

Required repair: capture the original capability identity before any await and use that same object for both consumption and every later verification/journal field. Reject accessors/unsupported input shapes or copy validated values once; freeze private snapshots of scalar configuration and paths. Do not clone the capability into an object that loses its WeakMap identity.

## LIVE-STOP-F02 — P1 — default scale transport hashes one executable and selects another

Default scale at63 reads input.executablePath for hashing and rereads it for nodeExecFile at66. A getter can return the pinned Railway executable during the hash check and a different path during invocation. Top-level input.railway is also caller-owned across awaits.

Reproducer used the **actual default runtime**, actual capture module and actual CLI file hashing, with node:child_process.execFile intercepted before any process launch. An executablePath getter returned the pinned CLI for the two capture-input copies and scale hash read, then a temporary unverified.exe path for the scale invocation, then the original CLI for subsequent captures. Observed reads=6; intercepted scaleExecutable ended in **unverified.exe**, scaleCount=1, and the helper accepted the stopped outcome. The unverified executable did not exist and was never run: the interception makes this safe while proving which path the native call would receive.

Required repair: validate and capture a single immutable Railway input before any provider operation. Capture the executable path used for hashing and invoke exactly that captured path. Preserve fixed argv/no-shell and executable hash checks; capture trusted runtime functions if they are intentionally injectable. Re-read getters or mutable request fields must not select a binary after verification.

## LIVE-STOP-F03 — P2 — existing receipt is discovered only after scaling

privateNew at85 checks path location but not exclusive reservation. The receipt is opened with wx only at101 after scale and both stopped observations. With a pre-existing receipt, the helper performs one scale attempt, then fails with uncertainty when receipt creation collides.

Reproducer prewrote receipt.json with a synthetic sentinel and used a fresh journal/authentic capability. Result: rejection and original receipt content preserved, but **scaleCalls=1**, whereas the expectation was0. The helper avoids overwriting evidence but needlessly changes availability when its required output destination is already unusable. This is not an unsafe success claim; it is an avoidable mutation before a locally knowable prerequisite failure.

Required repair: exclusively reserve both journal and receipt destination before provider acquisition/scale, retain controlled file handles, and keep incomplete reservations distinguishable from a completed accepted receipt. Refuse existing files before mutation and preserve failure/no-retry evidence. A check-then-create alone would leave a race.

## LIVE-STOP-F04 — P2 — stopped evidence can predate the running preflight

pair() verifies order within each pair, and the stopped verifier applies a bounded age and changed configuration, but the helper never binds stopped capture times to its completed running preflight or scale invocation/return. At98–99 a cached pair from an earlier stopped state may therefore be accepted as this stop's result.

Reproducer supplied running preflight captures at offsets6000–7000 and8000–9000, then stopped captures at1000–2000 and3000–4000 with a different valid configuration etag. The final clock was14000, so the old pair remained within the verifier's age window. The helper **accepted a stopped receipt, scaleCalls=1**, despite the stopped pair predating the running preflight.

Required repair: record a fresh phase-specific clock around scale and enforce post-scale capture chronology relative to that boundary and the last preflight completion; reject overlap, reversal and reused captures across phases. The fixed default collector ordinarily constructs timestamps as it reads, so this repro demonstrates the helper's missing semantic guard at its injectable public boundary, not a claim that the pinned CLI itself replays data.

## Passing checks and observed limits

Candidate Bun1.3.12 tests: **2 passed /15 assertions**. Final main independent suite: **4 passed,4 failed /56 assertions**. A subsequent additional shape test: **1 passed /6 assertions**, eight tests filtered out. Thus all four failures remain; the separate positive checks were not used to convert the verdict to PASS. Scoped strict TypeScript on helper/test passed with ESNext/Bundler/Bun types and skipLibCheck; no source suppression or edits.

Positive controls and checks:

- Direct authentic capability consumption and a basic successful synthetic stop both reached the intended boundary; this avoids treating early refusal as adversarial coverage.
- Ordinary default-runtime path emitted exactly one intercepted scale argv: scale, --project119f3652-9d84-4d16-983c-1a17c0fd1aaa, --environment6642d65a-15a2-41e9-b25e-b7b01990aa28, --servicef43abcf9-72f0-4034-828a-8d83ca26b0db, --json, us-east4-eqdc4a=0 (each flag/value separate argv entries). Executable matched the pinned CLI; shell=false. It acquired four status and four inventory responses, representing two raw preflight and two raw stopped captures. All subprocess responses were synthetic.
- Explicit synthetic RAILWAY_TOKEN was excluded from the scale environment. Thrown synthetic secret text did not enter returned error or journal. No real token/config was read by the tests.
- Invalid JSON, empty shape, wrong region, primitive region value, one replica, extra top-level field and oversized response all produced post-attempt uncertainty, one attempt, no completed receipt and an uncertainty journal event. A thrown scale error remained uncertain and was not retried.
- Reusing the consumed capability with a new journal, substituting a copied capability, and reusing an existing journal could not issue another scale. Existing journal refusal occurred before consuming any capture. These safeguards do not fix F01's substitution after the authentic capability is consumed.
- Synthetic stopped shape accepted both null regional configuration and explicit numReplicas0, with no runtime instances, omitted status-region field and null status replica count. Both results retained migrationAuthorized=false and resumeAuthorized=false. These are protocol-shape tests, **not an observation that the live Railway service is stopped**. No live scale was authorized to learn that shape.

The journal uses exclusive creation, synchronous durability calls and generic failure status; the completed receipt also uses exclusive create/write/sync/close. Static review cannot prove physical media durability or private Windows ACLs. The late receipt reservation defect is specifically demonstrated above. Failure after scale is conservatively uncertain, including output/receipt failure; no resume or automatic retry exists.

## Preserved harness failures and exact reproduction

The first external temporary probe imported Windows paths with forward slashes while the candidate's relative imports resolved to backslash module keys. Bun produced separate deployment-binder module identities/WeakMaps. Four initial apparent passes all stopped before scale; these were **invalid adversarial evidence**, identified because an added positive-control stop failed. A temporary diagnostic source copy, never the accepted candidate, confirmed the import-identity problem. Bun.resolveSync showed the two differing path spellings. Normalizing only the temporary probe imports to native Windows path spellings made the positive control pass against the exact original source and exposed all four findings. Do not count the original vacuous passes as candidate acceptance. The diagnostic copy was not used for the final verdict; candidate hashes stayed fixed.

Final independent probe `%TEMP%/hosted-live-stop-independent.test.ts` SHA **9f64d475f8bd6fa992a83ffa134a991f498263c23144c5e19aefa61cf59a1ba8**, embedded below. The main8-test run used the preceding bytes SHA b751e082701498027f70f1aceb74416a8dfe95ba1890b1d764572460617b91a6; the final version only appends the separately passed null/zero-shape test. Fixture construction borrows the candidate fixtures; adversarial mutations, expected refusals, positive controls and native-transport interception are independent additions.

Bounded review: trusted runtime/provider authenticity remains external; mocked command outputs cannot establish a live target or authorization. No hostile-host immutability, signed issuer attestation, writer exclusion, migration authority, database preservation, resume behavior or customer readiness is established. Repair these findings and independently re-review the exact bytes before composing any live stop. QA report/run metadata still awaits coordinator review and immutable packaging.

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
 const runtime:LiveStopRuntime={capture:async()=>captures.shift()!,scale:async()=>{calls++;return JSON.stringify({regions:{[T.region]:null}})},now:()=>f.at(++clocks===1?9500:14000)};
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
 for(const raw of responses){const s=await scenario();let scaleCalls=0;s.runtime.scale=async()=>{scaleCalls++;return raw};await expect(stopHostedSetupExactImage(s.input,s.runtime)).rejects.toThrow('OUTCOME_UNCERTAIN_DO_NOT_RETRY');expect(scaleCalls).toBe(1);expect(await Bun.file(s.input.receiptPath).exists()).toBe(false);expect(await readFile(s.input.journalPath,'utf8')).toContain('outcome_uncertain_do_not_retry')}
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
```
