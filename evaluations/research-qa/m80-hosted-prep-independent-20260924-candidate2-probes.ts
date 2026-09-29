import {input,build,seal,record,observation,chainArgs,artifactPin} from './m80-hosted-prep-independent-20260924-candidate2-fixture'
import {m80HostedCanonicalJson,m80HostedSha256} from './m80-hosted-prep-independent-20260924-candidate2-frozen-prepare'
const results=[]
const plan=await build(input()),planPin=artifactPin('.superpowers/m80-foundation-hosted-qa-plan.json',plan)
for(const state of ['unknown','definitive_failure'] as const){
 const intent=seal(plan,planPin,'migration'),chain=record(intent,observation(intent,state))
 const original=chain.outcome.status
 chain.outcome.status='verified_success';chain.outcome.nextActionAllowed=true
 const unsigned:any={...chain.outcome};delete unsigned.outcomeSha256
 chain.outcome.outcomeSha256=m80HostedSha256(m80HostedCanonicalJson(unsigned));chain.outcomePin=artifactPin(chain.outcomePin.path,chain.outcome)
 try{const next=seal(plan,planPin,'admission',chainArgs('migration',chain));results.push({case:'promoted_'+state,original,observation:chain.observation,admitted:next.status,stage:next.stage})}catch(e){results.push({case:state,rejected:String(e)})}
}
await Bun.write('evaluations/research-qa/m80-hosted-prep-independent-20260924-candidate2-probes.json',JSON.stringify({candidate:'3dd4e1b8ba6f84b176c7ec34823a4f40ea1886425af0a19a1cd94e2d7c11a82c',results},null,2)+'\n')
console.log(JSON.stringify(results,null,2))
