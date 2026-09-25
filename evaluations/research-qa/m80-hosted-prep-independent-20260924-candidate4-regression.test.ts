import {expect,test} from 'bun:test'
import {input,build,seal,record,observation,chainArgs,artifactPin,resignPlan,NOW,gateBundle} from './m80-hosted-prep-independent-20260924-candidate4-fixture'
import {m80HostedCanonicalJson,m80HostedSha256} from './m80-hosted-prep-independent-20260924-candidate4-frozen-prepare'
import {validateM80HostedPlan,sealM80HostedIntent} from './m80-hosted-prep-independent-20260924-candidate4-frozen-once'
const rehash=(o:any,k:string)=>{delete o[k];o[k]=m80HostedSha256(m80HostedCanonicalJson(o));return o}
test('every failed and uncertain predecessor stays denied even after consistent outcome rehash',async()=>{
 const plan=await build(input()),pp=artifactPin('.superpowers/m80-foundation-hosted-plan.json',plan),mi=seal(plan,pp,'migration'),mc=record(mi),ai=seal(plan,pp,'admission',chainArgs('migration',mc))
 for(const stage of ['migration','admission'] as const)for(const state of ['unknown','definitive_failure'] as const){
  const intent=stage==='migration'?mi:ai,chain=record(intent,observation(intent,state));chain.outcome.status='verified_success';chain.outcome.nextActionAllowed=true;rehash(chain.outcome,'outcomeSha256');chain.outcomePin=artifactPin(chain.outcomePin.path,chain.outcome)
  const args=stage==='migration'?chainArgs('migration',chain):{...chainArgs('migration',mc),...chainArgs('admission',chain)}
  expect(()=>seal(plan,pp,stage==='migration'?'admission':'deployment',args)).toThrow()
 }
})
test('successor chronology and stage target collection cannot precede prerequisite',async()=>{
 const plan=await build(input()),pp=artifactPin('.superpowers/m80-foundation-hosted-plan.json',plan),mc=record(seal(plan,pp,'migration'))
 const ai:any=seal(plan,pp,'admission',chainArgs('migration',mc));ai.createdAt='2026-09-24T22:11:00.000Z';rehash(ai,'intentSha256');const ac=record(ai,observation(ai,'definitive_success','2026-09-24T22:11:30.000Z'))
 expect(()=>seal(plan,pp,'deployment',{...chainArgs('migration',mc),...chainArgs('admission',ac)})).toThrow()
 const b:any=gateBundle(plan,pp,'admission');b.gate.targetReobservedAt='2026-09-24T22:11:59.999Z';b.gateEvidence.targetObservation.value.observedAt=b.gate.targetReobservedAt;b.gateEvidence.targetObservation.pin=artifactPin(b.gate.targetObservation.path,b.gateEvidence.targetObservation.value);b.gate.targetObservation=b.gateEvidence.targetObservation.pin;b.gatePin=artifactPin(b.gatePin.path,b.gate)
 expect(()=>sealM80HostedIntent({plan,planPin:pp,stage:'admission',now:NOW,...b,...chainArgs('migration',mc)})).toThrow()
})
test('list types are exact JSON strings for every table and stage slot',async()=>{
 for(const nested of [true,false])for(let index=0;index<6;index++){const v:any=input();v.rehearsal.expectedNewTables[index]=nested?[v.rehearsal.expectedNewTables[index]]:{toString:v.rehearsal.expectedNewTables[index]};let refused=false;try{await build(v)}catch{refused=true}expect(refused).toBeTrue()}
 const original=await build(input());for(let index=0;index<3;index++){const p:any=structuredClone(original);p.sequence[index]=[p.sequence[index]];expect(()=>validateM80HostedPlan(resignPlan(p),NOW)).toThrow()}
})
