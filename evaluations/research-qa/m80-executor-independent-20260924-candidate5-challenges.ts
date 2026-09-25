import {artifacts,reviewReaders,MemoryJournal,fakeDatabase,sourceState,successObservation,artifactPin,NOW} from './m80-executor-independent-20260924-candidate5-fixture'
import {executeM80HostedStage,reconcileM80HostedStage,createM80RailwayTransport} from './m80-executor-independent-20260924-candidate5-frozen'
const results:any[]=[],assert=(v:any,m:string)=>{if(!v)throw Error(m)}
const input=await artifacts('deployment'),journal=new MemoryJournal();let mutations=0
try{await executeM80HostedStage(input,{journal,provider:{serviceInstanceDeployV2:async()=>{mutations++;return 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}},observer:{observe:async()=>{throw Error('pending')}},readSourceBytes:reviewReaders.get(input)!,now:()=>NOW})}catch{}
const find=(suffix:string)=>[...journal.values].find(([p])=>p.endsWith(suffix))!,[ap,av]=find('-attempt.json'),[kp,kv]=find('-deployment-ack.json')
assert(kv,'Ack fixture must exist')
for(const [name,mutate] of [
 ['wrong_attempt',(x:any)=>x.attempt.sha256='0'.repeat(64)],['wrong_intent',(x:any)=>x.intent.sha256='0'.repeat(64)],['wrong_scope',(x:any)=>x.operationScopeSha256='0'.repeat(64)],['wrong_project',(x:any)=>x.projectRef='foreign'],['wrong_environment',(x:any)=>x.environmentId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],['wrong_service',(x:any)=>x.serviceId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],['wrong_commit',(x:any)=>x.commitSha='0'.repeat(40)],['invalid_id',(x:any)=>x.deploymentId='bad'],['wrong_stage',(x:any)=>x.stage='migration'],['predates_attempt',(x:any)=>x.acknowledgedAt=new Date(NOW.getTime()-1).toISOString()],['unknown_key',(x:any)=>x.extra=true],['future_ack',(x:any)=>x.acknowledgedAt=new Date(NOW.getTime()+86_400_000).toISOString()]
] as const){
 const ack=structuredClone(kv);mutate(ack);let observed=0,error='';try{await reconcileM80HostedStage(input,av,artifactPin(ap,av),{journal:new MemoryJournal(),providerAcknowledgement:{value:ack,pin:artifactPin(kp,ack)},observer:{observe:async()=>{observed++;return successObservation(input.intent as any)}},readSourceBytes:reviewReaders.get(input)!,now:()=>new Date(NOW.getTime()+1000)})}catch(e){error=String(e)}
 if(name!=='future_ack')assert(error&&observed===0,'Malformed ack admitted '+name)
 results.push({case:name,rejected:!!error,observed,error})
}
for(const stage of ['migration','admission','deployment'] as const){
 const a=await artifacts(stage),j=new MemoryJournal();let calls=0,observes=0
 const stop=stage==='migration'?'-migration-source.json':'-attempt.json';const original=j.writeOnce.bind(j);j.writeOnce=async(p,v)=>{await original(p,v);if(p.endsWith(stop))throw Error('synthetic write/sync failure after marker')}
 const deps:any={journal:j,database:fakeDatabase(),provider:{serviceInstanceDeployV2:async()=>{calls++;return 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}},migrate:async()=>{calls++},admit:async()=>{calls++},migrationSourceState:sourceState(a),observer:{observe:async()=>{observes++;return successObservation(a.intent as any)}},readSourceBytes:reviewReaders.get(a)!,now:()=>NOW}
 let failures=0;for(let i=0;i<2;i++)try{await executeM80HostedStage(a,deps)}catch{failures++}
 assert(failures===2&&calls===0&&observes===0,'Failed durable marker allowed transport '+stage);results.push({case:'marker_failure_'+stage,failures,calls,observes})
}
const migration=await artifacts('migration'),mj=new MemoryJournal();let transport=0,observerCalls=0
try{await executeM80HostedStage(migration,{journal:mj,database:fakeDatabase(),migrationSourceState:sourceState(migration),migrate:async()=>{transport++},observer:{observe:async()=>{observerCalls++;throw Error('pending')}},readSourceBytes:reviewReaders.get(migration)!,now:()=>NOW})}catch{}
const entry=(suffix:string)=>[...mj.values].find(([p])=>p.endsWith(suffix))!,[mp,mv]=entry('-attempt.json'),[sp,sv]=entry('-migration-source.json')
let collision='';try{await reconcileM80HostedStage(migration,mv,artifactPin(mp,mv),{journal:mj,migrationSourceReceipt:{value:sv,pin:artifactPin(sp,sv)},observer:{observe:async()=>{observerCalls++;throw Error('still pending')}},readSourceBytes:reviewReaders.get(migration)!,now:()=>NOW})}catch(e){collision=String(e)}
assert(collision.includes('already exists')&&transport===1,'Pending collision did not preserve one transport')
const done=await reconcileM80HostedStage(migration,mv,artifactPin(mp,mv),{journal:mj,migrationSourceReceipt:{value:sv,pin:artifactPin(sp,sv)},observer:{observe:async()=>{observerCalls++;return successObservation(migration.intent as any)}},readSourceBytes:reviewReaders.get(migration)!,now:()=>new Date(NOW.getTime()+1)})
assert(done.status==='verified_success'&&transport===1,'Fresh observer reconciliation failed');results.push({case:'pending_collision_then_success',collision,transport,observerCalls,status:done.status})
const plan=input.plan as any,adapter=createM80RailwayTransport(async()=>[{id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',status:'SUCCESS',meta:{commitHash:plan.publication.reviewedHeadCommitSha}}],async()=>({status:'ready',profile:'neuvetra.private-synthetic-staging.v1',schemaVersion:22,legacyContainmentVerified:true}),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
let historicalError='';try{await adapter.observe({stage:'deployment',plan,intent:input.intent as any})}catch(e){historicalError=String(e)}assert(historicalError.includes('not observable yet'),'Foreign historical deployment admitted');results.push({case:'foreign_same_commit_id',rejected:true,error:historicalError})
const oldInput=await artifacts('migration'),oldJournal=new MemoryJournal();let oldCalls=0,oldObservations=0
const oldOutcome=await executeM80HostedStage(oldInput,{journal:oldJournal,database:fakeDatabase(),migrationSourceState:sourceState(oldInput),migrate:async()=>{oldCalls++},observer:{observe:async()=>({profile:'neuvetra.m80.foundation-hosted-outcome-observation.v1',observedAt:NOW.toISOString(),stage:'migration',transportOutcome:'unknown',authoritativeState:{}})},readSourceBytes:reviewReaders.get(oldInput)!,now:()=>NOW})
const oldFind=(suffix:string)=>[...oldJournal.values].find(([p])=>p.endsWith(suffix))!,[oap,oav]=oldFind('-attempt.json'),[osp,osv]=oldFind('-migration-source.json'),[oop,oov]=oldFind('-observation.json');let oldError=''
try{await reconcileM80HostedStage(oldInput,oav,artifactPin(oap,oav),{journal:oldJournal,migrationSourceReceipt:{value:osv,pin:artifactPin(osp,osv)},observationReceipt:{value:oov,pin:artifactPin(oop,oov)},observer:{observe:async()=>{oldObservations++;return successObservation(oldInput.intent as any)}},readSourceBytes:reviewReaders.get(oldInput)!,now:()=>NOW})}catch(e){oldError=String(e)}
assert(oldOutcome.status==='uncertain_do_not_retry'&&oldError.includes('already exists')&&oldCalls===1&&oldObservations===0,'Old terminal unknown unexpectedly promoted');results.push({case:'old_terminal_unknown_retained_blocked',error:oldError,oldCalls,oldObservations})
await Bun.write('evaluations/research-qa/m80-executor-independent-20260924-candidate5-challenges.json',JSON.stringify({boundary:'Exact frozen C5 core with synthetic injected transports/journals only; no network/DB',results},null,2)+'\n');console.log(JSON.stringify(results.map(r=>({case:r.case,rejected:r.rejected,status:r.status}))))
