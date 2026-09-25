import {readFile,open} from 'node:fs/promises'
import {resolve,basename} from 'node:path'
import * as executor from './m80-executor-independent-20260924-candidate7-frozen'
import {artifacts,reviewReaders,NOW,sourceState,artifactPin} from './m80-executor-independent-20260924-candidate7-fixture'
import {validateM80HostedPlan,writeM80HostedEvidenceOnce} from '../../.superpowers/m80-foundation-hosted-once'
import {m80HostedSha256 as sha,M80_MIGRATION_0022_SHA256} from '../../.superpowers/m80-foundation-hosted-prepare'
import {parseM71Json} from '../../packages/neuvetra-database/src/m71-validation'
import {parseM80Json} from '../../packages/neuvetra-database/src/m80-validation'
// Fixed fixture clock across separate processes; provider/DB observation timestamps share it.
class ControlledDate extends Date { constructor(value?: string|number|Date){super(value===undefined?NOW.getTime():value as any)} static now(){return NOW.getTime()} }
globalThis.Date=ControlledDate as DateConstructor
const [scenario,phase,dir]=process.argv.slice(2)
if(!scenario||!['execute','reconcile'].includes(phase!)||!dir?.startsWith('evaluations/research-qa/m80-executor-independent-20260924-process-'))throw Error('Closed synthetic process args required')
const stage=scenario.startsWith('deployment')?'deployment':scenario.startsWith('admission')?'admission':'migration',input=await artifacts(stage),plan=input.plan as any,intent=input.intent as any,events:any[]=[],state=sourceState(input)
const disk=(path:string)=>resolve(dir!,basename(path))
const record=(event:string,extra:any={})=>events.push({event,...extra})
let captures=0,closed=false
const database={query:async(sql:string)=>{record('db-query');if(sql.includes('pg_stat_activity'))return {rows:[{count:0}]};if(sql.includes('schema_migrations'))return {rows:[...Array.from({length:21},(_,i)=>({name:'old'+i,sha256:'0'.repeat(64)})),{name:'0022_scope1_beta_foundation.sql',sha256:M80_MIGRATION_0022_SHA256}]};if(sql.includes('staging_target'))return {rows:[{projectRef:plan.target.projectRef,profile:'neuvetra.private-synthetic-staging.v1'}]};if(sql.includes('scope1_beta_fixture_admissions')){if(phase==='execute')throw Error('synthetic admission observer unavailable');return {rows:[{company_id:plan.admission.companyId,fixture_profile_id:plan.admission.fixtureProfileId,fixture_version:plan.admission.fixtureVersion,fixture_sha256:plan.admission.fixtureSha256,active:true,admitted_by:plan.admission.managerUserId}]}};throw Error('Unexpected mock query')},exec:async(sql:string)=>{if(!sql.includes('read only'))throw Error('Only read-only fake SQL expected');record('read-only')},transaction:async(fn:any)=>fn(database),close:async()=>{closed=true;record('db-close')}}
class Journal{
 async writeOnce(path:string,value:unknown){
  record('write-start',{path:basename(path)})
  if(phase==='execute'&&scenario==='migration_crash_observation'&&path.endsWith('-observation.json'))throw Error('synthetic crash before observation')
  if(phase==='execute'&&scenario==='migration_crash_outcome'&&path.endsWith('-outcome.json'))throw Error('synthetic crash after observation')
  await writeM80HostedEvidenceOnce(disk(path),value,async p=>{const f=await open(p,'wx');return {writeFile:async b=>{await f.writeFile(b)},sync:async()=>{await f.sync();record('synced',{path:basename(path)})},close:async()=>{await f.close();record('closed-file',{path:basename(path)})}}})
  record('write-complete',{path:basename(path)})
 }
}
const privateSnapshot=JSON.parse(await readFile('operations/agent-improvement/snapshots/M80-FOUNDATION-EXECUTOR-PREP-20260924-CANDIDATE7.json','utf8')),source=privateSnapshot.artifacts.find((a:any)=>a.path===executor.M80_EXECUTOR_ENTRYPOINT_PATH).text as string
const privateCode=source.slice(source.indexOf('export async function assertM80DatabasePreflight'),source.indexOf('export type M80RailwayRun'))+source.slice(source.indexOf('export async function runM80PrivateExecutor'),source.indexOf('if (import.meta.main)')).replaceAll('export async','async')
const closedObject=(value:any,keys:string[])=>{if(!value||typeof value!=='object'||Object.keys(value).sort().join('|')!==[...keys].sort().join('|'))throw Error('Closed input required')}
const pin=(value:any)=>{closedObject(value,['path','sha256']);return value}
const load=async(item:any)=>{const bytes=await readFile(disk(item.path));if(sha(bytes)!==item.sha256)throw Error('Pinned synthetic journal changed');return parseM71Json(bytes.toString(),4_000_000)}
const bindings:any={closed:closedObject,pin,M80_EXECUTOR_PRIVATE_INPUT_PROFILE:executor.M80_EXECUTOR_PRIVATE_INPUT_PROFILE,loadM80ExecutorBundle:async()=>input,validateM80HostedPlan:(p:any)=>validateM80HostedPlan(p,NOW),connectOperator:async()=>database,M80FileExecutorJournal:Journal,M80_MIGRATION_0022_SHA256,
 verifyExactSource21:async()=>{record('schema21-preflight');if(phase==='reconcile')throw Error('Schema21 preflight on committed22 forbidden')},
 captureApplicationState:async()=>{captures++;record('capture',{captures});if(phase==='execute'&&scenario==='migration_pending'&&captures>1)throw Error('synthetic observer unavailable');return stage==='migration'?state:{applicationStateSha256:scenario.endsWith('gate_mismatch')?'f'.repeat(64):(input.gate as any).currentApplicationStateSha256}},assertSchema22Delta:async(before:any,after:any)=>{record('assert-delta');if(before.applicationStateSha256!==after.applicationStateSha256)throw Error('Synthetic state mismatch')},
 executeM80HostedStage:(a:any,deps:any)=>executor.executeM80HostedStage(a,{...deps,readSourceBytes:reviewReaders.get(input)!,now:()=>NOW,admit:async()=>{record('admission-mutation');throw Error('synthetic committed admission then timeout')},migrate:async()=>{record('migration-mutation');if(scenario==='migration_pending')throw Error('synthetic committed then timeout')}}),
 reconcileM80HostedStage:(a:any,attempt:any,attemptPin:any,deps:any)=>executor.reconcileM80HostedStage(a,attempt,attemptPin,{...deps,readSourceBytes:reviewReaders.get(input)!,now:()=>new Date(NOW.getTime()+30_000)}),
 createM80RailwayTransport:(_run:any,_ready:any,id?:string)=>executor.createM80RailwayTransport(async(args:string[])=>{if(args[0]==='api'){record('provider-mutation');return {data:{serviceInstanceDeployV2:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}}}record('provider-observe',{retainedId:id??null});return [{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',status:phase==='execute'?'BUILDING':'SUCCESS',meta:{commitHash:plan.publication.reviewedHeadCommitSha}}]},async()=>{record('readiness');return {status:'ready',profile:'neuvetra.private-synthetic-staging.v1',schemaVersion:22,legacyContainmentVerified:true}},id),
 loadPinnedJson:load,readWorkspaceBytes:async(path:string)=>readFile(disk(path)),loadM80ExecutorSourceEvidence:load,parseM80Json,parseM71Json,M80_EXECUTOR_EVIDENCE_MAX_BYTES:1_000_000,m80HostedSha256:sha,m80ExecutorObservationPath:executor.m80ExecutorObservationPath,m80ExecutorProviderAcknowledgementPath:executor.m80ExecutorProviderAcknowledgementPath,SHA256:/^[0-9a-f]{64}$/,M80_FIXTURE_SHA256:plan.admission.fixtureSha256,exactAdmission:(row:any,p:any)=>row.company_id===p.admission.companyId&&row.admitted_by===p.admission.managerUserId&&row.fixture_sha256===p.admission.fixtureSha256&&row.active===true}
const attemptPath=executor.m80ExecutorAttemptPath(intent),attempt=phase==='reconcile'?await readFile(disk(attemptPath)):null
const request={profile:executor.M80_EXECUTOR_PRIVATE_INPUT_PROFILE,operatorId:'/root',mode:phase,bundle:{path:'virtual-bundle.json',sha256:'0'.repeat(64)},attempt:attempt?{path:attemptPath,sha256:sha(attempt)}:null,operatorDatabaseUrl:'synthetic-no-credential-no-network',railwaySessionMode:'current_authenticated_cli'}
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor
let outcome:any=null,error='';try{outcome=await new AsyncFunction(...Object.keys(bindings),new Bun.Transpiler({loader:'ts'}).transformSync(privateCode.replaceAll('export async','async'))+';return runM80PrivateExecutor('+JSON.stringify(request)+')')(...Object.values(bindings))}catch(e){error=String(e)}
await Bun.write(resolve(dir!,phase+'.json'),JSON.stringify({scenario,phase,pid:process.pid,closed,error,outcomeStatus:outcome?.status??null,events},null,2)+'\n')
if(!closed)throw Error('Database abstraction not closed')
if(phase==='execute'&&!error)throw Error('First process must stop pending or injected crash')
if(phase==='reconcile'&&(error||outcome?.status!=='verified_success'))throw Error('Reconcile did not verify: '+error)
console.log(JSON.stringify({scenario,phase,status:outcome?.status??'stopped',pid:process.pid}))
