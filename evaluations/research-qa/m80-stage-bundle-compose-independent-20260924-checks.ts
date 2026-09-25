import {readFile} from 'node:fs/promises'
import {composeM80StageBundle,m80StageBundlePath} from '../../.superpowers/m80-stage-bundle-compose'
import {artifacts,reviewReaders,NOW} from './m80-executor-independent-20260924-candidate9-fixture'
const enc=(v:unknown)=>Buffer.from(JSON.stringify(v,null,2)+'\n'),results:any[]=[]
async function setup(stage:'migration'|'admission'|'deployment'){
 const a=await artifacts(stage),map=new Map<string,Uint8Array>(),put=(x:any)=>map.set(x.pin.path,enc(x.value))
 put({value:a.plan,pin:a.planPin});put({value:a.gate,pin:a.gatePin});put({value:a.intent,pin:a.intentPin});Object.values(a.gateEvidence).forEach(put);Object.values(a.planEvidence).forEach(put)
 for(const c of [a.migration,a.admission])if(c){for(const k of ['intent','gate','observation','outcome'] as const)put({value:c[k],pin:c[(k+'Pin') as keyof typeof c]});Object.values(c.gateEvidence).forEach(put)}
 const predecessor=(c:any)=>c?{intentPath:c.intentPin.path,observationPath:c.observationPin.path,outcomePath:c.outcomePin.path}:null
 const input={outputPath:m80StageBundlePath(a.plan as any,stage),stage,planPath:a.planPin.path,gatePath:a.gatePin.path,intentPath:a.intentPin.path,executorReviewPath:'evaluations/research-qa/m80-executor-independent-20260924-candidate9-review.json',migration:predecessor(a.migration),admission:predecessor(a.admission)}
 const reader=async(p:string)=>map.get(p)??await readFile(p)
 return {a,map,input,reader}
}
for(const stage of ['migration','admission','deployment'] as const){const {input,reader}=await setup(stage),result=await composeM80StageBundle(input,{readBytes:reader,now:NOW});if(result.stage!==stage)throw Error('Positive stage changed');results.push({case:stage+'_positive_actual_executor_review',accepted:true})}
for(const kind of ['output_alias','output_traversal','input_traversal','absolute_input','backslash_input','wrong_stage','missing_migration','missing_admission','foreign_outcome','modified_gate_bytes','modified_intent_bytes','modified_receipt','missing_review','changed_executor_source','duplicate_plan_key','oversized_plan','future_intent','late_gate'] as const){
 const {a,map,input,reader}=await setup('deployment');let now=NOW
 if(kind==='output_alias')input.outputPath=input.outputPath.replace('-bundle','-alias')
 if(kind==='output_traversal')input.outputPath='../'+input.outputPath
 if(kind==='input_traversal')input.planPath='../x.json'
 if(kind==='absolute_input')input.planPath='C:/x.json'
 if(kind==='backslash_input')input.planPath='.superpowers\\plan.json'
 if(kind==='wrong_stage')(input as any).stage='other'
 if(kind==='missing_migration')input.migration=null
 if(kind==='missing_admission')input.admission=null
 if(kind==='foreign_outcome')input.admission!.outcomePath=input.migration!.outcomePath
 if(kind==='modified_gate_bytes')map.set(input.gatePath,enc({...a.gate as any,currentApplicationStateSha256:'e'.repeat(64)}))
 if(kind==='modified_intent_bytes')map.set(input.intentPath,enc({...a.intent as any,targetProjectRef:'foreignprojectaaaaaa'}))
 if(kind==='modified_receipt')map.set(a.planEvidence.backupReceipt.pin.path,enc({...a.planEvidence.backupReceipt.value as any,syntheticDataOnly:false}))
 if(kind==='missing_review')input.executorReviewPath='evaluations/research-qa/nonexistent-review.json'
 if(kind==='changed_executor_source')map.set('.superpowers/m80-foundation-executor.ts',Buffer.from('changed source'))
 if(kind==='duplicate_plan_key')map.set(input.planPath,Buffer.from('{"a":1,"a":2}'))
 if(kind==='oversized_plan')map.set(input.planPath,Buffer.from('"'+'x'.repeat(4_000_000)+'"'))
 if(kind==='future_intent')map.set(input.intentPath,enc({...a.intent as any,createdAt:new Date(NOW.getTime()+1).toISOString()}))
 if(kind==='late_gate')now=new Date(NOW.getTime()+16*60_000)
 let error='';try{await composeM80StageBundle(input,{readBytes:reader,now})}catch(e){error=String(e)}
 if(!error)throw Error('Negative accepted: '+kind);results.push({case:kind,accepted:false,error})
}
await Bun.write('evaluations/research-qa/m80-stage-bundle-compose-independent-20260924-checks.json',JSON.stringify({boundary:'Actual frozen bundle function; synthetic stage receipts; actual accepted executor review/source closure read; no output bundle written or execution transport invoked',results},null,2)+'\n');console.log(JSON.stringify({cases:results.length,pass:true}))
