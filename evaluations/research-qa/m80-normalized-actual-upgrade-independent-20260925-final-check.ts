// Actual receipt-chain verification with accepted executor logic and an in-memory journal.
// No provider, database, Git, credential, or archive-unseal actions.
import {readFile,readdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {loadM80ExecutorBundle,reconcileM80HostedStage,validateM80ExecutorReview} from '../../.superpowers/m80-foundation-executor-v2'
import {recordM80HostedOutcome} from '../../.superpowers/m80-foundation-hosted-once-v3'
import {m80HostedCanonicalJson} from '../../.superpowers/m80-foundation-hosted-prepare-v3'
const sha=(x:Uint8Array|string)=>createHash('sha256').update(x).digest('hex'),require=(x:unknown,m:string)=>{if(!x)throw Error(m)}
const load=async(path:string,expected?:string)=>{const b=await readFile(path);require(!expected||sha(b)===expected,'Changed receipt: '+path);return{value:JSON.parse(b.toString()),pin:{path,sha256:sha(b)}}}
const scope='e522e5628ec866b072f54056940287de93faefe7949a08c8ea62757fba2cdf6f',prefix=`.superpowers/m80-foundation-executor-${scope}-deployment`
const bundlePin={path:prefix+'-bundle.json',sha256:'652bc91a6e89afc02b189dcfd69f0ae17d2050b077594fb3daa7d7f944f5bd7d'}
const artifacts=await loadM80ExecutorBundle(bundlePin)
await validateM80ExecutorReview(artifacts.executorReview)
const attempt=await load(prefix+'-attempt.json','a216bd0376d584e9ef7fcb81e793f66606c2b9fae6aa84704a29f09ac3025c49'),ack=await load(prefix+'-ack.json','ef2f32865f91d16d57e9d9879b1a64ed535687c402a384fd48248461c02ee22b'),observation=await load(prefix+'-observation.json','81dd25b5b0dfcc074214e93b805785598f367ea9fd208484e2c2121e37a5fdfa'),outcome=await load(prefix+'-outcome.json','6a7163c9662e92d55803121d88be06989ea5beda5e62569544efbb0515c5c90f')
const pending=[]
for(const name of(await readdir('.superpowers')).filter(x=>x.startsWith(`m80-foundation-executor-${scope}-deployment-pending-`)).sort()){
 const receipt=await load('.superpowers/'+name),p=receipt.value
 require(p.profile==='neuvetra.m80.foundation-executor-pending-observation.v2'&&p.stage==='deployment'&&p.operationScopeSha256===scope&&p.status==='observer_unavailable_or_nonterminal'&&p.sideEffectRetried===false,'Pending semantics differ')
 require(m80HostedCanonicalJson(p.attempt)===m80HostedCanonicalJson(attempt.pin)&&m80HostedCanonicalJson(p.intent)===m80HostedCanonicalJson(artifacts.intentPin),'Pending receipt not same attempt')
 require(Date.parse(p.observedAt)>=Date.parse(ack.value.acknowledgedAt)&&Date.parse(p.observedAt)<Date.parse(observation.value.observedAt),'Pending chronology differs')
 pending.push(receipt.pin)
}
require(pending.length===2,'Unexpected pending journal count')
const states=[]
for(const stage of ['migration','admission','deployment']){
 const intent=await load(`.superpowers/m80-foundation-hosted-${scope}-${stage}-intent.json`),obs=await load(`.superpowers/m80-foundation-executor-${scope}-${stage}-observation.json`),result=await load(`.superpowers/m80-foundation-executor-${scope}-${stage}-outcome.json`)
 const recomputed=recordM80HostedOutcome({intent:intent.value,intentPin:intent.pin,observation:obs.value,observationPin:obs.pin,now:new Date(result.value.recordedAt)})
 require(m80HostedCanonicalJson(recomputed)===m80HostedCanonicalJson(result.value)&&result.value.status==='verified_success','Actual stage outcome differs from authoritative receipt')
 states.push({stage,intent:intent.pin,observation:obs.pin,outcome:result.pin,observedAt:obs.value.observedAt,recordedAt:result.value.recordedAt})
}
const journalWrites:any[]=[];let observerCalls=0,providerCalls=0
const dependencies:any={now:()=>new Date(outcome.value.recordedAt),providerAcknowledgement:ack,observationReceipt:observation,journal:{writeOnce:async(path:string,value:unknown)=>journalWrites.push({path,value})},observer:{observe:async()=>{observerCalls++;throw Error('No actual observer call allowed')}},provider:{serviceInstanceDeployV2:async()=>{providerCalls++;throw Error('No actual provider mutation allowed')}}}
const result=await reconcileM80HostedStage(artifacts,attempt.value,attempt.pin,dependencies)
require(m80HostedCanonicalJson(result)===m80HostedCanonicalJson(outcome.value),'Accepted executor reconciliation differs from actual outcome')
require(journalWrites.length===1&&journalWrites[0].path===outcome.pin.path&&m80HostedCanonicalJson(journalWrites[0].value)===m80HostedCanonicalJson(outcome.value)&&observerCalls===0&&providerCalls===0,'Receipt-only verification performed unexpected operation')
const negatives=[]
for(const variant of ['missing_ack','foreign_ack_id','future_ack']as const){
 const changed=structuredClone(ack)
 if(variant==='foreign_ack_id')changed.value.deploymentId='88888888-8888-4888-8888-888888888888'
 if(variant==='future_ack')changed.value.acknowledgedAt=new Date(Date.parse(outcome.value.recordedAt)+1000).toISOString()
 changed.pin.sha256=sha(JSON.stringify(changed.value,null,2)+'\n')
 let refused=false
 try{await reconcileM80HostedStage(artifacts,attempt.value,attempt.pin,{...dependencies,providerAcknowledgement:variant==='missing_ack'?undefined:changed,journal:{writeOnce:async()=>{throw Error('Unexpected negative-case journal write')}}})}catch{refused=true}
 require(refused,'Corrupted actual acknowledgement accepted');negatives.push(variant)
}
require(observation.value.authoritativeState.deploymentId===ack.value.deploymentId&&observation.value.authoritativeState.commitSha===artifacts.plan.publication.reviewedHeadCommitSha&&observation.value.authoritativeState.schemaVersion===22&&observation.value.authoritativeState.deploymentStatus==='SUCCESS'&&observation.value.authoritativeState.readinessOk===true,'Final deployment target/readiness differs')
const output={profile:'neuvetra.m80.actual-upgrade-final-independent-check.v1',observedAt:new Date().toISOString(),reviewer:'/root/m80_foundation_runtime_qa',verdict:'pass_actual_schema22_upgrade_receipt_chain_only',plan:artifacts.planPin,bundle:bundlePin,stages:states,deploymentAttempt:attempt.pin,deploymentAcknowledgement:ack.pin,pendingReceipts:pending,acceptedExecutorReceiptOnlyReconciliationExact:true,currentRecursiveSourceClosureVerified:true,negativeActualBindingProbes:negatives,inMemoryOutcomeWrites:journalWrites.length,actualObserverCalls:observerCalls,actualProviderCalls:providerCalls,actualDatabaseCalls:0,finalDeployment:{id:ack.value.deploymentId,commit:observation.value.authoritativeState.commitSha,status:'SUCCESS',schemaVersion:22,readinessOk:true,observedAt:observation.value.observedAt},noReplayEvidence:'One exact durable deployment attempt and acknowledgement, two nonterminal observations, then matching terminal success; retained source enforces no second mutation. No provider request was made by QA.',browserAcceptance:'pending_separate_root_demonstration',limitations:['Receipt/source verification only; QA did not independently query provider or hosted database.','Source and actual gates are bounded synthetic foundation acceptance; four methods remain held, full corporate Scope1/customer beta incomplete.','All original failed/consumed attempts, pending observations and QA harness failure remain retained; no replay or schema21 recovery authorized.']}
await writeFile('evaluations/research-qa/m80-normalized-actual-upgrade-independent-20260925-final-check.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({verdict:output.verdict,stages:states.map(x=>x.stage),pendingReceipts:pending.length,negativeProbes:negatives.length,providerCalls,observerCalls,finalDeployment:output.finalDeployment,browserAcceptance:output.browserAcceptance}))
