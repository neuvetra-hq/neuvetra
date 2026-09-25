import {readFile} from 'node:fs/promises'
import {buildM80HostedPreparationPlan,m80HostedSha256} from '../../.superpowers/m80-foundation-hosted-prepare-v2'
const f=JSON.parse(await readFile('evaluations/research-qa/m80-coordinator-helpers-independent-20260924-v2-composed-synthetic.json','utf8'))
const plan=await buildM80HostedPreparationPlan(f.input,{now:new Date(),verifyPin:async p=>{if(p.path in f.evidence)return;const b=await readFile(p.path);if(m80HostedSha256(b)!==p.sha256)throw Error('Actual accepted pin changed')},loadJsonEvidence:async p=>{if(!(p.path in f.evidence))throw Error('Missing exact synthetic receipt');return f.evidence[p.path]}})
await Bun.write('evaluations/research-qa/m80-coordinator-helpers-independent-20260924-v2-contract.json',JSON.stringify({boundary:'Mocked main output from exact v2 composer consumed by actual accepted Prep C6 builder; accepted public runtime pins actually read, observations synthetic',accepted:true,profile:plan.profile,executionAuthorized:plan.executionAuthorized},null,2)+'\n')
console.log('Actual v2 builder accepts exact synthetic composed receipt shapes')
