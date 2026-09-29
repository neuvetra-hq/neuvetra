# Hosted setup post-scale independent QA — first review

Task `HOSTED-SETUP-POSTSCALE-QA-01`, 2026-09-26. Reviewer `/root/artifact_launcher`, qa-lead. This execution context did not author the post-scale source/tests or their deployment-binding dependency. It authored different artifact-source/materializer/worker components, which are not accepted by this review. Requested registered critical route: `gpt-6-astra/high`; actual model/effort are unknown because this follow-up did not expose an override or observable setting.

**Verdict: FAIL for the intended stop → migration → resume integration (POST-F01, P2).** The existing retrospective four-capture verifier passes the bounded local checks below. It cannot supply the stopped-state validation needed before migration. This is an operational API gap, not an observed unauthorized provider action. Do not treat the passing retrospective checks as acceptance of the missing gate.

## Exact candidate

Working directory: `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra`.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-postscale.ts` | `7c8065493651e39851135d4a14bf9e9d50bb8b7b502add443a50ee4cde1becd9` |
| `tools/staging/hosted-setup-postscale.test.ts` | `43e9ea37a99be8adab4d483840407fa966eb3088c7a24a79ceafc8746f936a72` |
| Author report `hosted-setup-01-postscale-author-20260926.md` | `f738941121d9827d88c91c2ab4f5644f6b587cd4a3deae2259ff385fdc16d74c` |

Both source/test hashes match the author's frozen report and were rechecked after testing. No candidate source, author test, provider, Git, database, credential or live-service action was performed. Context read: current role/workflow/registry, leading next-session and board report, upgrade runbook, candidate and author evidence. The unrelated broad memory search supplied no task-specific evidence; this verdict uses current local artifacts.

## POST-F01 — P2: no stopped-state verification boundary before migration

`tools/staging/hosted-setup-postscale.ts:138` exposes only `verifyHostedSetupPostscale(binding, stoppedCaptures, resumedCaptures, policy)`. At line 146 it validates both pairs before returning anything. The return also requires resumed runtime identity and chronology after stop. The useful stopped parser and pair validator are private. The runbook's maintenance order instead requires two stopped observations and a stop receipt **before** starting the migration worker, with the site remaining stopped through separate result review before resume (`operations/hosted-setup/upgrade-runbook.md`, maintenance steps 1–4).

Independent public API reproductions with valid stopped captures:

- Empty or absent resumed pair: `HS_POSTSCALE_TWO_CAPTURES_REQUIRED`.
- Reusing stopped captures as presumed resume evidence: `HS_POSTSCALE_EXACTLY_ONE_REQUIRED` (zero runtime cannot satisfy resumed state).
- Supplying future resumed captures while the trusted clock is at completion of stop: `HS_POSTSCALE_STALE_OR_FUTURE_SEQUENCE`.

These refusals are correct; they demonstrate that no authentic current pre-migration stop observation can produce an accepted result. A wrapper would have to duplicate private verification, invent future evidence, or defer validation until after restarting. None is accepted here. The combined five-minute window also cannot be the sole stop/resume gate around a migration and independent review of unknown duration; phase-specific freshness must be designed explicitly rather than manufacturing a clock or bypass.

Repair acceptance: expose a versioned pure stopped-phase verification boundary using only the exact binding, two current stopped captures and a trusted stopped-phase policy. Give its output explicit non-authority semantics. Separately verify resume against the accepted stop/image identity and two fresh resumed captures after the migration/review interval. The future wrapper must preserve authentic evidence and the actual stop → migrate → review → resume order. Do not solve this by weakening current resumed evidence checks. Root owns deciding the contract and dispatching its author; this reviewer made no repair.

## Verification results

Windows, Bun `1.3.12 (700fc117)`. Commands ran locally with scoped process permission; no network or installation was used.

1. `bun test tools/staging/hosted-setup-deployment-binding.test.ts tools/staging/hosted-setup-postscale.test.ts --timeout 30000`: **21 pass, 0 fail, 114 assertions**. This includes all 11 delivered post-scale tests. First reviewer suite invocation passed; no test failure was removed or hidden.
2. `bun node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-postscale.ts tools/staging/hosted-setup-postscale.test.ts`: **PASS**, exit 0.
3. Independent standalone public-boundary fixture (not imported from author tests): **109 cases**. **105 asserted expected outcomes matched**; four deliberately diagnostic observations accepted the inputs described below. Do not count diagnostic acceptance as four proved safety properties. Baseline and exact five-minute freshness boundary accepted; adversarial validation cases refused. Four stopped-only cases reproduce POST-F01 through expected fail-closed behavior.

Coverage independently exercised both indexes of both pairs for duplicate or missing exact target service, same-name wrong-ID decoy, duplicate service instance, service-name/environment mismatch, missing latest commit, active commit/image mismatch, latest deployment mismatch, incomplete/empty/wrong-service/in-flight inventory, missing inventory commit, staged patch/count, auto-deploy, changed etag, extra region, negative duration and duration over 30 seconds. Additional cases cover each retired binding identifier, injected mutation authority, reversed pairs, phase overlap, age boundary and age+1ms, future by 1ms, wrong configuration pins, missing clock, escaped duplicate JSON keys, changed runtime inside resume pair, second SUCCESS, and a consistently different commit across the resumed pair. Every accepted output checked immutable result/hash arrays and both false authority flags.

The source is synchronous and has no provider I/O or mutation entrypoint. It imports local pure binding helpers and historical identifier constants. Accepted fixtures consistently return `mutationAuthorized:false` and `providerAuthenticationEstablished:false`; there is no `launchAuthorized:true` claim.

## Precisely bounded stability and completeness observations

These are disclosed limits of the retrospective verifier, not additional mutation/authentication vulnerabilities:

- Pair stability compares the returned etag, target runtime, replica count, pending count and normalized deployment inventory. It does **not** compare all raw configuration content. Independently changing `deploy.healthcheckPath` in one resumed capture or `source` in one stopped capture while preserving the claimed etag is accepted. The verifier therefore relies on a coherent authenticated provider configuration/version relationship; it does not independently prove that relationship. “Semantically stable” must mean the selected fields, not all returned configuration. A future gate that requires unchanged full configuration should bind the relevant configuration bytes/digest and challenge this variant.
- Changing a non-scaling runtime configuration field in both resumed observations while using the expected new etag is accepted. Same observed deployment/image/commit does not prove that every configuration change between phases was limited to replica count.
- A terminal page with empty `endCursor` is accepted. Completeness here is based on the trusted provider's `hasNextPage:false`, nonempty bounded inventory, exact node scope and expected deployment presence; it is not an independent enumeration proof or page-cursor consistency proof.
- Hashes and synthetic captures do not authenticate Railway. Trusted binding/clock and authenticated capture collection remain external prerequisites. No live bridge image, current hosted state, stop receipt, provider lease, preservation result or schema-23 readiness was established. Sampled stable observations cannot exclude later provider drift.

## Reproduction evidence and handoff

Independent probe: `C:/Users/nimab/AppData/Local/Temp/hosted-setup-postscale-qa-01.ts`, SHA-256 `6c84ce834f3b4c9429e450508d440a17e7685b0cb69e21e886f99ea4bf4c039e`.

Detailed outcomes: `C:/Users/nimab/AppData/Local/Temp/hosted-setup-postscale-qa-01-results.json`, SHA-256 `3f368b0d461d63bf901faf6aadb83d2ca6000ef2a4cce524881f20545834db5a`.

The complete probe is preserved below for review portability; it imports only public candidate APIs and builds independent synthetic fixtures. Run with the same exact candidate hashes. The temporary paths are local evidence, not a publication artifact. Root owns the immutable snapshot, run closure and subsequent repair/review routing. Preserve this first FAIL on repair; no publication or live action is approved.

## Independent probe source

```typescript
import {verifyHostedSetupPostscale} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-postscale.ts'
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
const results:any[]=[]
function probe(name:string,edit:(f:any)=>void,expected:'accept'|'reject'|'observe'='reject'){
 const f=fixture();edit(f);let actual='accept',error:string|null=null,result:any=null
 try{result=call(f)}catch(e){actual='reject';error=(e as Error).message}
 const passed=expected==='observe'||actual===expected
 if(result&&(result.mutationAuthorized!==false||result.providerAuthenticationEstablished!==false||!Object.isFrozen(result)||!Object.isFrozen(result.stoppedCaptureSha256)))throw Error('Authority/freeze invariant')
 results.push({name,expected,actual,passed,error})
}
probe('same-named wrong-ID service comes first; exact target selected',()=>{},'accept')
for(const phase of ['stopped','resumed'])for(const index of [0,1]){
 const cases:Array<[string,string,(o:any)=>void]>=[
 ['duplicate exact target service','statusJson',o=>o.services.edges.push(o.services.edges[1])],
 ['target absent despite same named decoy','statusJson',o=>o.services.edges.splice(1,1)],
 ['duplicate exact service instance','statusJson',o=>o.environments.edges[0].node.serviceInstances.edges.push(o.environments.edges[0].node.serviceInstances.edges[1])],
 ['wrong service name','statusJson',o=>o.services.edges[1].node.name='Other'],
 ['wrong environment','statusJson',o=>o.environments.edges[0].node.id=other],
 ['absent latest commit','statusJson',o=>delete inst(o).latestDeployment.meta.commitHash],
 ['active commit changed','statusJson',o=>inst(o).activeDeployments[0].meta.commitHash='9'.repeat(40)],
 ['latest deployment changed','statusJson',o=>inst(o).latestDeployment.id=other],
 ['active image digest changed','statusJson',o=>inst(o).activeDeployments[0].meta.imageDigest='sha256:'+'8'.repeat(64)],
 ['incomplete page','inventoryJson',o=>o.data.deployments.pageInfo.hasNextPage=true],
 ['active absent from inventory','inventoryJson',o=>o.data.deployments.edges=[]],
 ['inventory wrong service','inventoryJson',o=>o.data.deployments.edges[0].node.serviceId=other],
 ['inventory absent commit','inventoryJson',o=>delete o.data.deployments.edges[0].node.meta.commitHash],
 ['inflight inventory','inventoryJson',o=>o.data.deployments.edges[0].node.status='DEPLOYING'],
 ['staged variables','inventoryJson',o=>o.data.environmentStagedChanges.patch={variables:{SYNTHETIC:'change'}}],
 ['staged count','inventoryJson',o=>o.data.environment.unmergedChangesCount=1],
 ['auto deploy on','inventoryJson',o=>o.data.serviceInstanceAutoDeployStatus.enabled=true],
 ['etag changes inside pair','inventoryJson',o=>o.data.environment.configEtag='8'.repeat(64)],
 ['region escapes','inventoryJson',o=>o.data.environment.config.services[T.serviceId].deploy.multiRegionConfig.other={numReplicas:1}],
 ]
 for(const [name,field,fn]of cases)probe(`${phase}[${index}] ${name}`,f=>mutate(f[phase][index],field,fn))
 probe(`${phase}[${index}] negative capture duration`,f=>f[phase][index].completedUtc=time(-1000))
 probe(`${phase}[${index}] duration over 30s`,f=>f[phase][index].completedUtc=time((phase==='stopped'?index*1000:3000+index*1000)+30001))
}
probe('retired deployment',f=>f.binding.deploymentId='40546ef7-9004-4486-a471-370aaa305c80')
probe('retired commit',f=>f.binding.deployedCommit='75d8ec4b16054a1bbfc1a51ddaec99000ee1efe2')
probe('injected authority claim',f=>f.binding.mutationAuthorized=true)
probe('stopped pair reversed',f=>f.stopped.reverse())
probe('resumed pair reversed',f=>f.resumed.reverse())
probe('cross-phase overlap',f=>f.resumed[0].startedUtc=f.stopped[1].completedUtc)
probe('stale by 1 ms',f=>f.policy.nowUtc=time(300001))
probe('exact freshness boundary',f=>f.policy.nowUtc=time(300000),'accept')
probe('future last completion by 1 ms',f=>f.policy.nowUtc=time(4199))
probe('stop config equals before',f=>f.policy.beforeStopConfigurationVersion='3'.repeat(64))
probe('resumed version pin wrong',f=>f.policy.expectedResumedConfigurationVersion='3'.repeat(64))
probe('unknown clock missing',f=>delete f.policy.nowUtc)
probe('escaped duplicate id',f=>{f.stopped[0].statusJson=f.stopped[0].statusJson.replace('"id":',`"\\u0069d":"${T.projectId}","id":`)})
probe('resumed runtime replaced between captures',f=>mutate(f.resumed[1],'statusJson',o=>{inst(o).latestDeployment.instances[0].id=other;inst(o).activeDeployments[0].instances[0].id=other}))
probe('second successful deployment',f=>mutate(f.resumed[1],'inventoryJson',o=>o.data.deployments.edges.push({cursor:'extra',node:{...o.data.deployments.edges[0].node,id:other}})))
probe('stop then resume other commit consistently',f=>{for(const c of f.resumed){mutate(c,'statusJson',o=>{inst(o).latestDeployment.meta.commitHash='8'.repeat(40);inst(o).activeDeployments[0].meta.commitHash='8'.repeat(40)});mutate(c,'inventoryJson',o=>o.data.deployments.edges[0].node.meta.commitHash='8'.repeat(40))}})
probe('empty page cursor accepted observation',f=>mutate(f.stopped[1],'inventoryJson',o=>o.data.deployments.pageInfo.endCursor=''),'observe')
probe('raw healthcheck config changes under unchanged etag',f=>mutate(f.resumed[1],'inventoryJson',o=>o.data.environment.config.services[T.serviceId].deploy.healthcheckPath='/different'),'observe')
probe('raw service source changes under unchanged etag',f=>mutate(f.stopped[1],'inventoryJson',o=>o.data.environment.config.services[T.serviceId].source={image:'different-synthetic-image'}),'observe')
probe('config changes besides scaling across phases',f=>{for(const c of f.resumed)mutate(c,'inventoryJson',o=>o.data.environment.config.services[T.serviceId].deploy.runtime='unexpected')},'observe')
probe('pre-migration stopped-only evidence with empty resumed pair',f=>f.resumed=[])
probe('pre-migration stopped-only evidence with absent resumed pair',f=>f.resumed=undefined)
probe('cannot substitute stopped pair for unknown resumed evidence',f=>f.resumed=structuredClone(f.stopped))
probe('cannot use future resume captures at stop-time clock',f=>f.policy.nowUtc=time(1200))
const summary={runtime:Bun.version,cases:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed),observations:results.filter(r=>r.expected==='observe')}
await Bun.write('C:/Users/nimab/AppData/Local/Temp/hosted-setup-postscale-qa-01-results.json',JSON.stringify({summary,results},null,2)+'\n')
console.log(JSON.stringify(summary,null,2))
if(summary.failed.length)process.exit(1)
```
