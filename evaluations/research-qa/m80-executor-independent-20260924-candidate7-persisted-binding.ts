import {artifacts,reviewReaders,MemoryJournal,successObservation,artifactPin,NOW} from './m80-executor-independent-20260924-candidate7-fixture'
import {executeM80HostedStage,reconcileM80HostedStage,m80ExecutorObservationPath} from './m80-executor-independent-20260924-candidate7-frozen'
const input=await artifacts('deployment'),j=new MemoryJournal();let transports=0
try{await executeM80HostedStage(input,{journal:j,provider:{serviceInstanceDeployV2:async()=>{transports++;return 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}},observer:{observe:async()=>{throw Error('pending')}},readSourceBytes:reviewReaders.get(input)!,now:()=>NOW})}catch{}
const find=(suffix:string)=>[...j.values].find(([p])=>p.endsWith(suffix))!,[ap,av]=find('-attempt.json'),[kp,kv]=find('-deployment-ack.json'),results:any[]=[]
for(const kind of ['exact_positive','foreign_observation_deployment','observation_before_ack','missing_ack'] as const){
 const ack=structuredClone(kv) as any,observation=successObservation(input.intent as any) as any;observation.authoritativeState.deploymentId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
 if(kind==='foreign_observation_deployment')observation.authoritativeState.deploymentId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
 if(kind==='observation_before_ack')ack.acknowledgedAt=new Date(NOW.getTime()+100).toISOString()
 let observerCalls=0,error='',status='';try{const out=await reconcileM80HostedStage(input,av,artifactPin(ap,av),{journal:new MemoryJournal(),providerAcknowledgement:kind==='missing_ack'?undefined:{value:ack,pin:artifactPin(kp,ack)},observationReceipt:{value:observation,pin:artifactPin(m80ExecutorObservationPath(input.intent as any),observation)},observer:{observe:async()=>{observerCalls++;throw Error('must use retained observation')}},readSourceBytes:reviewReaders.get(input)!,now:()=>new Date(NOW.getTime()+1000)});status=out.status}catch(e){error=String(e)}
 if(kind==='exact_positive'?(status!=='verified_success'||!!error):(!error||status==='verified_success'))throw Error('Unexpected retained binding result '+kind);results.push({kind,status,error,observerCalls})
}
await Bun.write('evaluations/research-qa/m80-executor-independent-20260924-candidate7-persisted-binding.json',JSON.stringify({boundary:'Exact frozen C6 reconciliation with synthetic attempt-bound ack and retained observation receipts; fresh journal only; no DB/network',transports,results},null,2)+'\n');console.log(JSON.stringify(results))
