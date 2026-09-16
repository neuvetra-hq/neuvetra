/** Explicitly reconciled continuation; no work on import and no journal reset. */
import {open,unlink} from 'node:fs/promises'
import path from 'node:path'
import {runHostedRecovery,parseRecoveryInput,readRecoveryJournal,cleanRecoveryJournal,validateOriginalRecoveryJournal} from './m76-hosted-recovery'
import {RECOVERY_PROFILE,RECOVERY_PLAN_ID,RECOVERY_COMPANY,RECOVERY_KEYS,recoveryHash as hash} from './m76-hosted-recovery-recipe'
import {m71CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m71-validation'
const DIRECTORY=path.resolve(import.meta.dir,'../../.superpowers')
const ORIGINAL=path.join(DIRECTORY,'m76-hosted-journey.jsonl'),FAILED=path.join(DIRECTORY,'m76-hosted-recovery.jsonl')
const DIAGNOSTIC=path.join(DIRECTORY,'m76-baseline-diagnostic-1789574873811.jsonl'),JOURNAL=path.join(DIRECTORY,'m76-hosted-continuation.jsonl')
export const CONTINUATION_PINS={
 failedBytes:'283e125e000019e037b19fafa89a96c297e4fd92fb08b76c1a11cc56fbed283f',
 failedHead:'b9db5630321e6dc5fa50ede903996c29ad17b9ab4e777f982f60bd1a10c8b6b4',
 diagnosticBytes:'6e7f9cbcc500593ec9f8b90762245371741076cbdb8f48efd6cf5a5a30d30cad',
 diagnosticCode:'f5c224d7af44d9e4b61b564cbbdd468467ac62a26fbd0440ccbb1b9c2cee98f6',
 helper:'d7592d1d1f72a83e45014ce1d5d215831ff20da418ec3189f948ec3677cae59e',
 recipe:'adac50e2d89b8c0b30df143426ddcccc694e1a2d339c6ec1547ee5e81b03ba15',
} as const
const check=(v:unknown)=>{if(!v)throw Error('Explicit M76 continuation refused.')}
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b)
export function verifyZeroWriteFailure(events:ReturnType<typeof readRecoveryJournal>){
 check(events.length===2&&events[0]!.kind==='attempt_started'&&events[0]!.mode==='baseline')
 const finish=events[1]!;check(finish.kind==='attempt_finished'&&finish.mode==='baseline'&&finish.data.attemptSequence===1&&finish.data.status==='failed'&&finish.data.stage==='authoritative_failed_state'&&finish.data.applicationPostRequests===0&&finish.data.allCreatedAuthSessionsClosed===true)
 check(!events.some(e=>['post_intent','post_outcome','step_verified','failed_state_baseline','recovery_complete'].includes(e.kind)))
}
export function verifyPassedDiagnostic(events:any[]){
 check(events.length>1&&events.every((e,i)=>e.sequence===i+1))
 const first=events[0],last=events.at(-1)
 check(first.kind==='diagnostic_started'&&first.profile==='m76-hosted-baseline-diagnostic-v1'&&first.applicationWritesAllowed===false&&first.failedRecoveryJournalSha256===CONTINUATION_PINS.failedBytes&&first.failedRecoveryHead===CONTINUATION_PINS.failedHead&&first.helperSha256===CONTINUATION_PINS.helper&&first.diagnosticSha256===CONTINUATION_PINS.diagnosticCode&&first.legacyTransport==='cached_diagnostic_only')
 check(last.kind==='diagnostic_finished'&&last.observedHelperStatus==='passed'&&last.isolatedBaselineObservationCompleted===true&&last.officialBaselineAccepted===false&&last.applicationPostRequests===0&&last.allCreatedAuthSessionsClosed===true&&last.bothFailedJournalsUnchanged===true&&last.traceDurable===true&&last.legacyTransport==='cached_diagnostic_only')
 check(!events.some(e=>e.matched===false||e.verified===false||e.noStore===false||e.kind==='call_failed'))
}
type Access={load:()=>Promise<string|null>;create:(line:string)=>Promise<void>;append:(line:string)=>Promise<void>}
/** Only this new journal is exposed to the unchanged state machine. */
export async function continuationJournal(access:Access,mode:'baseline'|'exercise'|'revisit',provenance:any){
 let text=await access.load()
 if(mode==='baseline'){
  check(text===null)
  const body={sequence:1,previousSha256:null,profile:RECOVERY_PROFILE,planId:RECOVERY_PLAN_ID,companyId:RECOVERY_COMPANY,mode:'baseline' as const,kind:'continuation_provenance',data:provenance,createdAt:new Date().toISOString()}
  text=JSON.stringify({...body,sha256:hash(canonical(body))})+'\n';await access.create(text)
 }else{
  check(text!==null);const events=readRecoveryJournal(text)
  check(events[0]?.kind==='continuation_provenance'&&same(events[0]?.data,provenance));cleanRecoveryJournal(events)
 }
 const current=()=>text!
 return {load:async()=>{check(await access.load()===current());return current()},append:async(line:string,exclusive:boolean)=>{
  check(exclusive===false&&line.endsWith('\n')&&line.trimEnd().split('\n').length===1)
  const prior=readRecoveryJournal(current()),next=readRecoveryJournal(current()+line);check(next.length===prior.length+1)
  check(await access.load()===current());await access.append(line);text=current()+line
 }}
}
export async function runHostedContinuation(value:unknown){
 const input=parseRecoveryInput(value)
 const original=await Bun.file(ORIGINAL).text(),failed=await Bun.file(FAILED).text(),diagnostic=await Bun.file(DIAGNOSTIC).text()
 const originalEvents=validateOriginalRecoveryJournal(original),failedEvents=readRecoveryJournal(failed)
 check(hash(failed)===CONTINUATION_PINS.failedBytes&&failedEvents.at(-1)?.sha256===CONTINUATION_PINS.failedHead);verifyZeroWriteFailure(failedEvents)
 check(hash(diagnostic)===CONTINUATION_PINS.diagnosticBytes&&diagnostic.endsWith('\n'));const diagnosticEvents=diagnostic.trimEnd().split('\n').map(line=>JSON.parse(line))
 check(diagnosticEvents.length===261);verifyPassedDiagnostic(diagnosticEvents)
 check(diagnosticEvents[0].originalJournalSha256===hash(original))
 check(hash(await Bun.file(new URL('./m76-hosted-recovery.ts',import.meta.url)).bytes())===CONTINUATION_PINS.helper&&hash(await Bun.file(new URL('./m76-hosted-recovery-recipe.ts',import.meta.url)).bytes())===CONTINUATION_PINS.recipe)
 const provenance={profile:'m76-explicit-continuation-v1',originalExerciseStatus:'failed',originalJournalSha256:hash(original),originalJournalHead:originalEvents.at(-1)!.sha256,failedRecoveryStatus:'failed',failedRecoveryJournalSha256:hash(failed),failedRecoveryJournalHead:CONTINUATION_PINS.failedHead,failedRecoveryApplicationPostRequests:0,diagnosticSha256:CONTINUATION_PINS.diagnosticBytes,diagnosticObservation:'passed_read_only_cached_legacy_not_baseline_acceptance',helperSha256:CONTINUATION_PINS.helper,recipeSha256:CONTINUATION_PINS.recipe,wrapperSha256:hash(await Bun.file(new URL(import.meta.url)).bytes()),keys:RECOVERY_KEYS,actualExecutionTransport:'unchanged_helper_actual_fetch_and_actual_legacy',scope:'fresh_baseline_then_exact_21_additive_operations_and_read_only_revisit'}
 const write=async(line:string,exclusive:boolean)=>{const file=await open(JOURNAL,exclusive?'wx':'a',0o600);try{await file.writeFile(line);await file.sync()}finally{await file.close()}}
 const journal=await continuationJournal({load:async()=>await Bun.file(JOURNAL).exists()?await Bun.file(JOURNAL).text():null,create:line=>write(line,true),append:line=>write(line,false)},input.mode,provenance)
 // Do not substitute fetch, Auth or legacy dependencies in actual execution.
 const result=await runHostedRecovery(input,{...journal,loadOriginal:async()=>original})
 check(hash(await Bun.file(ORIGINAL).text())===hash(original)&&hash(await Bun.file(FAILED).text())===hash(failed)&&hash(await Bun.file(DIAGNOSTIC).text())===CONTINUATION_PINS.diagnosticBytes)
 return {...result,continuationProfile:'m76-explicit-continuation-v1',separateJournal:JOURNAL,bothFailedAttemptsPreserved:true,actualLegacyRequired:true}
}
if(import.meta.main){let lock:Awaited<ReturnType<typeof open>>|undefined;try{lock=await open(JOURNAL+'.lock','wx',0o600);await lock.writeFile('{"profile":"m76-explicit-continuation-lock-v1"}\n');await lock.sync();const result=await runHostedContinuation(JSON.parse(await Bun.stdin.text()));console.log(JSON.stringify(result));if(result.status!=='passed')process.exitCode=1}catch{console.log(JSON.stringify({status:'explicit_continuation_refused',journalsReset:false}));process.exitCode=1}finally{if(lock){await lock.close();await unlink(JOURNAL+'.lock')}}}
