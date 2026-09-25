import {expect,test} from 'bun:test'
import {mkdir,readFile} from 'node:fs/promises'
import {input,build,resignPlan} from './m80-hosted-prep-independent-20260924-candidate4-fixture'
import {m80HostedIntentPath,writeM80HostedEvidenceOnce} from './m80-hosted-prep-independent-20260924-candidate4-frozen-once'
test('equivalent plans share a per-stage lock and concurrent exclusive writes preserve one winner',async()=>{
 const plan=await build(input()),other:any=structuredClone(plan);other.publication.reviewedHeadCommitSha='9'.repeat(40);other.actions.deployment.commitSha=other.publication.reviewedHeadCommitSha
 for(const stage of ['migration','admission','deployment'] as const)expect(m80HostedIntentPath(plan,stage)).toBe(m80HostedIntentPath(resignPlan(other),stage))
 expect(m80HostedIntentPath(plan,'migration')).not.toBe(m80HostedIntentPath(plan,'admission'))
 const folder='evaluations/research-qa/m80-hosted-prep-independent-20260924-sandbox';await mkdir(folder,{recursive:true});const path=`${folder}/candidate4-journal-${Date.now()}.json`
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>writeM80HostedEvidenceOnce(path,{syntheticWinner:i})));expect(results.filter(v=>v.status==='fulfilled')).toHaveLength(1)
 const before=await readFile(path);let rejected=false;try{await writeM80HostedEvidenceOnce(path,{replacement:true})}catch{rejected=true}expect(rejected).toBeTrue();expect(await readFile(path)).toEqual(before)
})
