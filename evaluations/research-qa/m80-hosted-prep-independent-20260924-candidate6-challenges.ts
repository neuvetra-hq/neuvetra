import {input,semanticEvidence,build,NOW,artifactPin,gateBundle} from './m80-hosted-prep-independent-20260924-candidate6-fixture'
import * as v2 from '../../.superpowers/m80-foundation-hosted-prepare-v2'
import * as once2 from '../../.superpowers/m80-foundation-hosted-once-v2'
import * as v1 from '../../.superpowers/m80-foundation-hosted-prepare'
import * as once1 from '../../.superpowers/m80-foundation-hosted-once'
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)},results:any[]=[]
const cases:any[]=[
 ['baseline',()=>{},true],
 ['exact_15m_boundary',(v:any)=>{v.observedTarget.observedAt=new Date(Date.parse(v.backup.completedAt)-900000).toISOString()},true],
 ['15m_plus_1ms',(v:any)=>{v.observedTarget.observedAt=new Date(Date.parse(v.backup.completedAt)-900001).toISOString()},false],
 ['backup_before_baseline',(v:any)=>{v.backup.completedAt=new Date(Date.parse(v.observedTarget.observedAt)-1).toISOString()},false],
 ['rehearsal_before_backup',(v:any)=>{v.rehearsal.completedAt=new Date(Date.parse(v.backup.completedAt)-1).toISOString()},false],
 ['wrong_phase',(v:any)=>{v.observedTarget.observationPhase='stopped_current'},false],
 ['missing_phase',(v:any)=>{delete v.observedTarget.observationPhase},false],
 ['noncanonical_baseline',(v:any)=>{v.observedTarget.observedAt=v.observedTarget.observedAt.replace('Z','+00:00')},false],
 ['stopped_baseline',(v:any)=>{v.observedTarget.deploymentStatus='REMOVED'},false],
 ['changed_backup_state',(v:any)=>{v.backup.sourceApplicationStateSha256='a'.repeat(64)},false],
 ['old_backup',(v:any)=>{v.backup.completedAt=new Date(NOW.getTime()-86400001).toISOString();v.observedTarget.observedAt=new Date(NOW.getTime()-86400002).toISOString()},false],
 ['future_rehearsal',(v:any)=>{v.rehearsal.completedAt=new Date(NOW.getTime()+5001).toISOString()},false],
 ['stale_publication',(v:any)=>{v.publication.headObservedAt=new Date(NOW.getTime()-900001).toISOString()},false],
 ['stale_membership',(v:any)=>{v.admission.verifiedAt=new Date(NOW.getTime()-900001).toISOString()},false],
]
for(const [name,change,accepted] of cases){const v=input();change(v);let error='';try{await build(v)}catch(e){error=String(e)}assert(!error===accepted,name+':'+error);results.push({name,accepted:!error,error})}
// Bodies independently altered while caller's input remains unchanged.
for(const [kind,field,value] of [['target','observationPhase','current'],['backup','completedAt',NOW.toISOString()],['restore','completedAt',NOW.toISOString()],['preservation','oldContentExact',false],['rehearsal','releaseRecordsExactFourHeld',false]] as const){const v=input(),map=semanticEvidence(v),key=kind==='target'?v.observedTarget.observationReceipt.path:kind==='backup'?v.backup.backupReceipt.path:kind==='restore'?v.rehearsal.restoreReceipt.path:kind==='preservation'?v.rehearsal.preservationReceipt.path:v.rehearsal.migrationReceipt.path;map.set(key,{...(map.get(key) as any),[field]:value});let error='';try{await v2.buildM80HostedPreparationPlan(v,{now:NOW,verifyPin:async()=>{},loadJsonEvidence:async p=>map.get(p.path)})}catch(e){error=String(e)}assert(error,'altered '+kind);results.push({name:'altered_'+kind,accepted:false,error})}
const p=await build(input()),pp=artifactPin('.superpowers/independent-v2-plan.json',p)
for(const [key,value] of [['activeDeploymentCount',1],['originReadinessUnavailable',false],['noActiveApplicationWritesObserved',false],['currentApplicationStateSha256','e'.repeat(64)],['targetReobservedAt',new Date(NOW.getTime()-900001).toISOString()],['targetProjectRef','wrongprojectrefaaaaaa']] as const){const bundle=gateBundle(p,pp,'migration');(bundle.gate as any)[key]=value;bundle.gatePin=artifactPin(bundle.gatePin.path,bundle.gate);let error='';try{once2.sealM80HostedIntent({plan:p,planPin:pp,stage:'migration',...bundle,now:NOW})}catch(e){error=String(e)}assert(error,'gate '+key);results.push({name:'gate_'+key,accepted:false,error})}
const old:any=input();old.profile=v1.M80_HOSTED_INPUT_PROFILE;delete old.observedTarget.observationPhase;old.observedTarget.observedAt=old.rehearsal.completedAt;
const oldEvidence=(pin:any)=>{const keys:any={};for(const k of ['target','publication','integration','backup','restore','preservation','rehearsal','admission'] as const){const path=k==='target'?old.observedTarget.observationReceipt.path:k==='publication'?old.publication.publicationReview.path:k==='integration'?old.publication.integrationAcceptance.path:k==='backup'?old.backup.backupReceipt.path:k==='restore'?old.rehearsal.restoreReceipt.path:k==='preservation'?old.rehearsal.preservationReceipt.path:k==='rehearsal'?old.rehearsal.migrationReceipt.path:old.admission.observationReceipt.path;keys[path]=v1.m80ExpectedHostedEvidence(old,k)}return keys[pin.path]}
const oldPlan=await v1.buildM80HostedPreparationPlan(old,{now:NOW,verifyPin:async()=>{},loadJsonEvidence:async p=>oldEvidence(p)});assert(oldPlan.operationScopeSha256===p.operationScopeSha256,'Operation scope differs')
for(const stage of ['migration','admission','deployment'] as const){assert(once1.m80HostedIntentPath(oldPlan,stage)===once2.m80HostedIntentPath(p,stage),'Intent differs');assert(once1.m80HostedOutcomePath({operationScopeSha256:oldPlan.operationScopeSha256,stage})===once2.m80HostedOutcomePath({operationScopeSha256:p.operationScopeSha256,stage}),'Outcome differs');results.push({name:'v1_v2_'+stage+'_paths',identical:true})}
await Bun.write('evaluations/research-qa/m80-hosted-prep-independent-20260924-candidate6-challenges.json',JSON.stringify({boundary:'Synthetic offline evidence; real accepted v1 and frozen v2 builders/gate validators, no network/DB',results},null,2)+'\n');console.log(JSON.stringify({cases:results.length,pass:true}))
