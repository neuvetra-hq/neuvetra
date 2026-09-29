import {readFile} from 'node:fs/promises'
import {artifacts} from './m80-executor-independent-20260924-candidate4-fixture'
const snapshot=JSON.parse(await readFile('operations/agent-improvement/snapshots/M80-FOUNDATION-EXECUTOR-PREP-20260924-CANDIDATE4.json','utf8')),source=snapshot.artifacts.find((a:any)=>a.path==='.superpowers/m80-foundation-executor.ts').text as string
const code=source.slice(source.indexOf('async function assertDatabasePreflight'),source.indexOf('function databaseObserver'))
const input=await artifacts('admission'),plan=input.plan as any;let captures=0
const tx={exec:async()=>{},query:async(sql:string)=>({rows:sql.includes('pg_stat_activity')?[{count:0}]:sql.includes('schema_migrations')?[...Array.from({length:21},()=>({name:'old',sha256:'0'.repeat(64)})),{name:'0022_scope1_beta_foundation.sql',sha256:'0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35'}]:[{projectRef:plan.target.projectRef,profile:'neuvetra.private-synthetic-staging.v1'}]})},database={transaction:async(fn:any)=>fn(tx)}
const bindings={M80_MIGRATION_0022_SHA256:'0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35',verifyExactSource21:async()=>{throw Error('Not migration')},captureApplicationState:async()=>{captures++;return {applicationStateSha256:'f'.repeat(64)}}}
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor
await new AsyncFunction(...Object.keys(bindings),new Bun.Transpiler({loader:'ts'}).transformSync(code)+';return assertDatabasePreflight(arguments[arguments.length-2],"admission",arguments[arguments.length-1]);')(...Object.values(bindings),database,plan)
if(captures!==0)throw Error('Frozen C4 behavior changed')
const result={boundary:'Exact frozen C4 private preflight function; synthetic DB only',attribution:'Root identified, author disclosed before independent reproduction',stage:'admission',currentApplicationStateCaptureCalls:captures,admittedDespiteUnobservedGateState:true,conclusion:'C4 schema22 preflight checks receipt count/final migration/target but never captures or compares live application state against gate.currentApplicationStateSha256.'}
await Bun.write('evaluations/research-qa/m80-executor-independent-20260924-candidate4-gate-state.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
