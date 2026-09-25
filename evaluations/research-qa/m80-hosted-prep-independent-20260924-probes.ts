import {input,gate,pin,NOW} from './m80-hosted-prep-independent-20260924-fixture'
import {buildM80HostedPreparationPlan,m80HostedCanonicalJson,m80HostedSha256} from '../../.superpowers/m80-foundation-hosted-prepare'
import {sealM80HostedIntent,recordM80HostedOutcome,M80_HOSTED_OBSERVATION_PROFILE,validateM80HostedPlan} from '../../.superpowers/m80-foundation-hosted-once'
const plan=await buildM80HostedPreparationPlan(input(),{now:NOW}),planPin=pin('evaluations/research-qa/m80-hosted-prep-independent-20260924-plan.json','e'),gatePin=pin('evaluations/research-qa/m80-hosted-prep-independent-20260924-gate.json','f')
const seal=(p:any,stage:any='migration',prior?:any)=>sealM80HostedIntent({plan:p,planPin,gate:gate(p,planPin,stage),gatePin,stage,migrationOutcome:prior,migrationOutcomePin:prior?pin('evaluations/research-qa/m80-hosted-prep-independent-20260924-prior.json','1'):undefined,now:NOW})
const intent=seal(plan),observation={profile:M80_HOSTED_OBSERVATION_PROFILE,observedAt:NOW.toISOString(),stage:'migration',transportOutcome:'definitive_success',authoritativeState:{schemaVersion:22,migrationReceiptCount:22,migrationName:'0022_scope1_beta_foundation.sql',migrationSha256:plan.actions.migration.migrationSha256,oldContentExact:true,oldMetadataExact:true}},outcome=recordM80HostedOutcome({intent,intentPin:pin('evaluations/research-qa/m80-hosted-prep-independent-20260924-intent.json','2'),observation,now:NOW})
const foreignInput=input();foreignInput.observedTarget.projectRef='zzzzzzzzzzzzzzzzzzzz';const foreignPlan=await buildM80HostedPreparationPlan(foreignInput,{now:NOW})
const results:any[]=[]
const check=(name:string,fn:()=>any)=>{try{const v=fn();results.push({name,accepted:true,value:{stage:v.stage,status:v.status,targetProjectRef:v.targetProjectRef,actionIdentity:v.actionIdentity}})}catch(e){results.push({name,accepted:false,error:(e as Error).message})}}
check('valid migration positive control',()=>intent)
check('cross-project migration outcome authorizes foreign admission',()=>seal(foreignPlan,'admission',outcome))
function rehash(p:any){const raw={...p};delete raw.planSha256;p.planSha256=m80HostedSha256(m80HostedCanonicalJson(raw));return p}
let bad=structuredClone(plan);bad.actions.admission.companyId=crypto.randomUUID();check('rehash plan with admission company inconsistent with observed company',()=>seal(rehash(bad),'admission',outcome))
bad=structuredClone(plan);bad.publication.requiredChecks=bad.publication.requiredChecks.map(()=>({...bad.publication.requiredChecks[0]}));check('rehash plan six duplicate check names',()=>seal(rehash(bad)))
bad=structuredClone(plan);bad.target.syntheticDataOnlyVerified=false as true;bad.rehearsal.oldContentExact=false as true;check('rehash plan denies synthetic and preservation facts',()=>seal(rehash(bad)))
bad=structuredClone(plan);bad.actions.deployment.environmentId=crypto.randomUUID();bad.actions.deployment.serviceId=crypto.randomUUID();check('rehash plan deployment target inconsistent with observed target',()=>validateM80HostedPlan(rehash(bad),NOW))
const fake={...outcome,intentSha256:'9'.repeat(64),authoritativeObservationSha256:'8'.repeat(64)};delete (fake as any).outcomeSha256;(fake as any).outcomeSha256=m80HostedSha256(m80HostedCanonicalJson(fake));check('self-hashed fabricated success with no referenced intent',()=>seal(plan,'admission',fake))
await Bun.write('evaluations/research-qa/m80-hosted-prep-independent-20260924-first-probes.json',JSON.stringify({candidate:'e312e20124a2a5e0977bb54bc15cf56234c1eba15fa53f82f81975fb931a05e1',results},null,2)+'\n');console.log(results)
