import {input,build,seal,record,observation,chainArgs,artifactPin,resignPlan,NOW} from './m80-hosted-prep-independent-20260924-candidate2-fixture'
import {m80HostedCanonicalJson,m80HostedSha256} from './m80-hosted-prep-independent-20260924-candidate2-frozen-prepare'
import {validateM80HostedPlan,recordM80HostedOutcome} from './m80-hosted-prep-independent-20260924-candidate2-frozen-once'
const results:any[]=[]
const rehash=(o:any,k:string)=>{delete o[k];o[k]=m80HostedSha256(m80HostedCanonicalJson(o));return o}
const inputValue:any=input();inputValue.rehearsal.expectedNewTables=inputValue.rehearsal.expectedNewTables.map((x:string)=>[x])
try{const plan=await build(inputValue);results.push({case:'nested_expected_table_arrays',accepted:plan.rehearsal.expectedNewTables})}catch(e){results.push({case:'nested_expected_table_arrays',rejected:String(e)})}
const p:any=await build(input());p.sequence=[['migration'],['admission'],['deployment']]
try{const plan=validateM80HostedPlan(resignPlan(p),NOW);results.push({case:'nested_sequence_arrays',accepted:plan.sequence})}catch(e){results.push({case:'nested_sequence_arrays',rejected:String(e)})}
const plan=await build(input()),pp=artifactPin('.superpowers/m80-foundation-hosted-plan.json',plan),mc=record(seal(plan,pp,'migration')),ai:any=seal(plan,pp,'admission',chainArgs('migration',mc))
ai.createdAt='2026-09-24T22:11:00.000Z';rehash(ai,'intentSha256')
const early=observation(ai,'definitive_success','2026-09-24T22:11:30.000Z'),ac=record(ai,early)
try{const next=seal(plan,pp,'deployment',{...chainArgs('migration',mc),...chainArgs('admission',ac)});results.push({case:'admission_before_migration',migrationRecorded:mc.outcome.recordedAt,admissionCreated:ai.createdAt,admissionObserved:early.observedAt,accepted:next.stage})}catch(e){results.push({case:'admission_before_migration',rejected:String(e)})}
await Bun.write('evaluations/research-qa/m80-hosted-prep-independent-20260924-candidate2-additional.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2))
