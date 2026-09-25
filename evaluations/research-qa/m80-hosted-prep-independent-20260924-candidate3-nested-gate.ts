import {input,build,seal,record,chainArgs,artifactPin} from './m80-hosted-prep-independent-20260924-candidate3-fixture'
import {m80HostedCanonicalJson,m80HostedSha256} from './m80-hosted-prep-independent-20260924-candidate3-frozen-prepare'
const plan=await build(input()),pp=artifactPin('.superpowers/m80-foundation-hosted-plan.json',plan),mc=record(seal(plan,pp,'migration')),ac:any=record(seal(plan,pp,'admission',chainArgs('migration',mc)))
const early='2026-09-24T22:11:59.999Z'
ac.gate.reviewedAt=early;ac.gate.targetReobservedAt=early
ac.gateEvidence.securityReview.value.observedAt=early;ac.gateEvidence.targetObservation.value.observedAt=early
for(const key of ['securityReview','targetObservation']){ac.gateEvidence[key].pin=artifactPin(ac.gateEvidence[key].pin.path,ac.gateEvidence[key].value);ac.gate[key]=ac.gateEvidence[key].pin}
ac.gatePin=artifactPin(ac.gatePin.path,ac.gate);ac.intent.gate=ac.gatePin
const rehash=(o:any,key:string)=>{delete o[key];o[key]=m80HostedSha256(m80HostedCanonicalJson(o))}
rehash(ac.intent,'intentSha256');ac.intentPin=artifactPin(ac.intentPin.path,ac.intent);ac.outcome.intent=ac.intentPin;ac.outcome.intentSha256=ac.intent.intentSha256;rehash(ac.outcome,'outcomeSha256');ac.outcomePin=artifactPin(ac.outcomePin.path,ac.outcome)
let result:any
try{const deployment=seal(plan,pp,'deployment',{...chainArgs('migration',mc),...chainArgs('admission',ac)});result={accepted:deployment.stage}}catch(e){result={rejected:String(e)}}
const receipt={candidate:'4819c802c75ecb639d6eb7966baaa9579d05a15c06668943b882380af0fb90d6',migrationRecordedAt:mc.outcome.recordedAt,admissionIntentAt:ac.intent.createdAt,admissionGateReviewedAt:ac.gate.reviewedAt,admissionTargetObservedAt:ac.gate.targetReobservedAt,result}
await Bun.write('evaluations/research-qa/m80-hosted-prep-independent-20260924-candidate3-nested-gate.json',JSON.stringify(receipt,null,2)+'\n');console.log(receipt)
