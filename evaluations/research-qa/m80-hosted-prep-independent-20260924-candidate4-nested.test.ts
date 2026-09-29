import {expect,test} from 'bun:test'
import {input,build,seal,record,chainArgs,artifactPin} from './m80-hosted-prep-independent-20260924-candidate4-fixture'
import {m80HostedCanonicalJson,m80HostedSha256} from './m80-hosted-prep-independent-20260924-candidate4-frozen-prepare'
const rehash=(o:any,key:string)=>{delete o[key];o[key]=m80HostedSha256(m80HostedCanonicalJson(o))}
test('historic admission review and target each follow the same migration outcome',async()=>{
 const plan=await build(input()),pp=artifactPin('.superpowers/m80-foundation-hosted-plan.json',plan),mc=record(seal(plan,pp,'migration'))
 for(const early of ['2026-09-24T22:11:59.999Z','2026-09-24T22:11:00.000Z'])for(const fields of [['reviewedAt'],['targetReobservedAt'],['reviewedAt','targetReobservedAt']]){
  const ac:any=record(seal(plan,pp,'admission',chainArgs('migration',mc)))
  for(const field of fields){ac.gate[field]=early;const kind=field==='reviewedAt'?'securityReview':'targetObservation';ac.gateEvidence[kind].value.observedAt=early;ac.gateEvidence[kind].pin=artifactPin(ac.gateEvidence[kind].pin.path,ac.gateEvidence[kind].value);ac.gate[kind]=ac.gateEvidence[kind].pin}
  ac.gatePin=artifactPin(ac.gatePin.path,ac.gate);ac.intent.gate=ac.gatePin;rehash(ac.intent,'intentSha256');ac.intentPin=artifactPin(ac.intentPin.path,ac.intent);ac.outcome.intent=ac.intentPin;ac.outcome.intentSha256=ac.intent.intentSha256;rehash(ac.outcome,'outcomeSha256');ac.outcomePin=artifactPin(ac.outcomePin.path,ac.outcome)
  expect(()=>seal(plan,pp,'deployment',{...chainArgs('migration',mc),...chainArgs('admission',ac)})).toThrow()
 }
 const good=record(seal(plan,pp,'admission',chainArgs('migration',mc)));expect(seal(plan,pp,'deployment',{...chainArgs('migration',mc),...chainArgs('admission',good)}).stage).toBe('deployment')
})
