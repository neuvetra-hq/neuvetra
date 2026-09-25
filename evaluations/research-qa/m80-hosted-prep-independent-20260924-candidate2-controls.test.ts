import {expect,test} from 'bun:test'
import {input,build,gateBundle,seal,record,observation,chainArgs,resignPlan,artifactPin,NOW,semanticEvidence} from './m80-hosted-prep-independent-20260924-candidate2-fixture'
import {buildM80HostedPreparationPlan,m80HostedCanonicalJson,m80HostedSha256,safeM80HostedPreparationOutputPath} from './m80-hosted-prep-independent-20260924-candidate2-frozen-prepare'
import {sealM80HostedIntent,validateM80HostedPlan,m80HostedIntentPath} from './m80-hosted-prep-independent-20260924-candidate2-frozen-once'
test('candidate2 closes input scalar, plan binding, receipt-content and traversal attacks',async()=>{
 const value=input(),plan=await build(value)
 for(const change of [(x:any)=>x.target.schemaVersion='21',(x:any)=>x.backup.sourceApplicationStateSha256='0'.repeat(64),(x:any)=>x.rehearsal.restoredMetadataSha256='0'.repeat(64),(x:any)=>x.actions.admission.sql+=' select 1;', (x:any)=>x.admission.fixtureVersion='1',(x:any)=>x.pins.targetObservation.path+='-different',(x:any)=>x.publication.requiredChecks[0].status='queued']){const p=JSON.parse(JSON.stringify(plan));change(p);expect(()=>validateM80HostedPlan(resignPlan(p),NOW)).toThrow()}
 const paths=[['observedTarget','observedAt'],['publication','headObservedAt'],['publication','checksObservedAt'],['backup','completedAt'],['rehearsal','completedAt'],['admission','verifiedAt'],['admission','managerRole']]
 for(const [a,b] of paths){const p:any=input();p[a][b]=[p[a][b]];let refused=false;try{await build(p)}catch{refused=true}expect(refused).toBeTrue()}
 const semantics=semanticEvidence(value)
 for(const [path,original] of semantics){const evidence=new Map(semantics);evidence.set(path,{...(original as any),inventedAuthority:true});let refused=false;try{await buildM80HostedPreparationPlan(value,{now:NOW,verifyPin:async()=>{},loadJsonEvidence:async p=>evidence.get(p.path)})}catch{refused=true}expect(refused).toBeTrue()}
 for(const p of ['.superpowers/m80-foundation-hosted-a/../../evaluations/escape.json','.superpowers/../m80-foundation-hosted-x.json','.superpowers\\m80-foundation-hosted-x.json','C:/temp/m80-foundation-hosted-x.json','.superpowers/sub/m80-foundation-hosted-x.json'])expect(()=>safeM80HostedPreparationOutputPath(p)).toThrow()
})
test('candidate2 closes cross-plan target gate and predecessor corruption attacks',async()=>{
 const plan=await build(input()),pp=artifactPin('.superpowers/m80-foundation-hosted-plan.json',plan),mi=seal(plan,pp,'migration'),mc=record(mi)
 const ai=seal(plan,pp,'admission',chainArgs('migration',mc)),ac=record(ai)
 expect(seal(plan,pp,'deployment',{...chainArgs('migration',mc),...chainArgs('admission',ac)}).stage).toBe('deployment')
 for(const stage of ['migration','admission','deployment'] as const){const b=gateBundle(plan,pp,stage);for(const field of ['targetProjectRef','targetEnvironmentId','targetServiceId']){const gate={...b.gate,[field]:'wrong'};expect(()=>sealM80HostedIntent({plan,planPin:pp,stage,now:NOW,...b,gate,gatePin:artifactPin(b.gatePin.path,gate),...chainArgs('migration',mc),...chainArgs('admission',ac)})).toThrow()}}
 for(const field of ['intentPin','observationPin','outcomePin']){const changed=structuredClone(mc);(changed as any)[field].sha256='0'.repeat(64);expect(()=>seal(plan,pp,'admission',chainArgs('migration',changed))).toThrow()}
 for(const state of ['unknown','definitive_failure'] as const){const chain=record(mi,observation(mi,state));expect(()=>seal(plan,pp,'admission',chainArgs('migration',chain))).toThrow()}
 const changedPlan:any=structuredClone(plan);changedPlan.publication.reviewedHeadCommitSha='7'.repeat(40);changedPlan.actions.deployment.commitSha=changedPlan.publication.reviewedHeadCommitSha;const next=resignPlan(changedPlan);expect(()=>seal(next,artifactPin(pp.path,next),'admission',chainArgs('migration',mc))).toThrow()
 expect(m80HostedIntentPath(next,'migration')).toBe(m80HostedIntentPath(plan,'migration'))
})
