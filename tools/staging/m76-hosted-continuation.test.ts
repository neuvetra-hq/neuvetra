import {test,expect} from 'bun:test'
import {continuationJournal,verifyZeroWriteFailure,verifyPassedDiagnostic,CONTINUATION_PINS,runHostedContinuation} from './m76-hosted-continuation'
import {readRecoveryJournal} from './m76-hosted-recovery'
import {RECOVERY_PROFILE,RECOVERY_PLAN_ID,RECOVERY_COMPANY,recoveryHash as hash} from './m76-hosted-recovery-recipe'
import {m71CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m71-validation'
const provenance={profile:'synthetic-pure-boundary',wrapperSha256:'a'.repeat(64),failedRecoveryApplicationPostRequests:0}
const appendEvent=(text:string,kind:string,data:any,mode='baseline')=>{const prior=text?readRecoveryJournal(text):[],body={sequence:prior.length+1,previousSha256:prior.at(-1)?.sha256??null,profile:RECOVERY_PROFILE,planId:RECOVERY_PLAN_ID,companyId:RECOVERY_COMPANY,mode,kind,data,createdAt:'2026-09-16T00:00:00.000Z'};return JSON.stringify({...body,sha256:hash(canonical(body))})+'\n'}
const memory=()=>{
 const files=new Map<string,string>([['original','retain original bytes'],['failed','retain failed bytes']]);let creates=0,writes=0
 return {files,counts:()=>({creates,writes}),access:{load:async()=>files.get('continuation')??null,create:async(line:string)=>{if(files.has('continuation'))throw Error('exclusive');creates++;files.set('continuation',line)},append:async(line:string)=>{writes++;files.set('continuation',files.get('continuation')!+line)}}}
}
test('only a proven closed zero-write failed baseline can be reconciled',()=>{
 let text=appendEvent('','attempt_started',{mode:'baseline'});text+=appendEvent(text,'attempt_finished',{attemptSequence:1,status:'failed',stage:'authoritative_failed_state',applicationPostRequests:0,allCreatedAuthSessionsClosed:true})
 const events=readRecoveryJournal(text);expect(()=>verifyZeroWriteFailure(events)).not.toThrow()
 for(const change of [(e:any[])=>e[1].data.applicationPostRequests=1,(e:any[])=>e[1].data.allCreatedAuthSessionsClosed=false,(e:any[])=>e[1].data.status='passed',(e:any[])=>e[1].data.stage='unknown',(e:any[])=>e[1].data.attemptSequence=2,(e:any[])=>e[0].mode='exercise',(e:any[])=>e.push({kind:'post_intent'}),(e:any[])=>e.pop()]){const copy=structuredClone(events);change(copy);expect(()=>verifyZeroWriteFailure(copy)).toThrow()}
})
test('diagnostic observation must pass exact pins without becoming official acceptance',()=>{
 const events=[{sequence:1,kind:'diagnostic_started',profile:'m76-hosted-baseline-diagnostic-v1',applicationWritesAllowed:false,failedRecoveryJournalSha256:CONTINUATION_PINS.failedBytes,failedRecoveryHead:CONTINUATION_PINS.failedHead,helperSha256:CONTINUATION_PINS.helper,diagnosticSha256:CONTINUATION_PINS.diagnosticCode,legacyTransport:'cached_diagnostic_only'},{sequence:2,kind:'diagnostic_finished',observedHelperStatus:'passed',isolatedBaselineObservationCompleted:true,officialBaselineAccepted:false,applicationPostRequests:0,allCreatedAuthSessionsClosed:true,bothFailedJournalsUnchanged:true,traceDurable:true,legacyTransport:'cached_diagnostic_only'}]
 expect(()=>verifyPassedDiagnostic(events)).not.toThrow()
 for(const change of [(e:any[])=>e[0].helperSha256='b'.repeat(64),(e:any[])=>e[0].failedRecoveryJournalSha256='b'.repeat(64),(e:any[])=>e[0].applicationWritesAllowed=true,(e:any[])=>e[1].officialBaselineAccepted=true,(e:any[])=>e[1].observedHelperStatus='failed',(e:any[])=>e[1].applicationPostRequests=1,(e:any[])=>e[1].allCreatedAuthSessionsClosed=false,(e:any[])=>e[1].bothFailedJournalsUnchanged=false,(e:any[])=>e[1].traceDurable=false,(e:any[])=>e[1].sequence=3,(e:any[])=>e[0].matched=false,(e:any[])=>e[0].verified=false,(e:any[])=>e[0].noStore=false,(e:any[])=>e[0].kind='call_failed']){const copy=structuredClone(events);change(copy);expect(()=>verifyPassedDiagnostic(copy)).toThrow()}
})
test('fresh provenance journal is exclusive and routes writes only to the new file',async()=>{
 const m=memory(),journal=await continuationJournal(m.access,'baseline',provenance),text=await journal.load(),events=readRecoveryJournal(text)
 expect(events).toHaveLength(1);expect(events[0]!.kind).toBe('continuation_provenance');expect(events[0]!.data).toEqual(provenance);expect(m.counts()).toEqual({creates:1,writes:0})
 const started=appendEvent(text,'attempt_started',{mode:'baseline'});await journal.append(started,false)
 expect(readRecoveryJournal(await journal.load())).toHaveLength(2);expect(m.counts()).toEqual({creates:1,writes:1});expect(m.files.get('original')).toBe('retain original bytes');expect(m.files.get('failed')).toBe('retain failed bytes')
 await expect(continuationJournal(m.access,'baseline',provenance)).rejects.toThrow();expect(m.counts()).toEqual({creates:1,writes:1})
})
test('every mode pins provenance and refuses changed wrapper or prior journal bytes',async()=>{
 const m=memory(),journal=await continuationJournal(m.access,'baseline',provenance)
 await expect(continuationJournal(m.access,'exercise',{...provenance,wrapperSha256:'b'.repeat(64)})).rejects.toThrow()
 await expect(continuationJournal(m.access,'revisit',{...provenance,failedRecoveryApplicationPostRequests:1})).rejects.toThrow()
 m.files.set('continuation',m.files.get('continuation')!.replace('synthetic-pure-boundary','changed'))
 await expect(journal.load()).rejects.toThrow();await expect(continuationJournal(m.access,'exercise',provenance)).rejects.toThrow();expect(m.counts()).toEqual({creates:1,writes:0})
})
test('append requires one exact next hash-chained event and never rewrites',async()=>{
 const m=memory(),journal=await continuationJournal(m.access,'baseline',provenance),text=await journal.load(),line=appendEvent(text,'attempt_started',{})
 await expect(journal.append(line,true)).rejects.toThrow();await expect(journal.append(line+line,false)).rejects.toThrow();await expect(journal.append(line.trimEnd(),false)).rejects.toThrow();await expect(journal.append(line.replace(RECOVERY_COMPANY,'75000000-0000-4000-8000-000000000001'),false)).rejects.toThrow()
 await journal.append(line,false);await expect(journal.append(line,false)).rejects.toThrow();expect(m.counts()).toEqual({creates:1,writes:1})
})
test('failed zero-write attempt and uncertain intent remain closed; no retry or reset',async()=>{
 for(const scenario of ['failed','unclosed','uncertain']){
  const m=memory(),journal=await continuationJournal(m.access,'baseline',provenance)
  await journal.append(appendEvent(await journal.load(),'attempt_started',{}),false)
  if(scenario==='uncertain')await journal.append(appendEvent(await journal.load(),'post_intent',{name:'capture_failed_report',request:{idempotencyKey:'unknown'}}),false)
  else await journal.append(appendEvent(await journal.load(),'attempt_finished',{attemptSequence:2,status:scenario==='failed'?'failed':'passed',applicationPostRequests:0,allCreatedAuthSessionsClosed:scenario!=='unclosed'}),false)
  const retained=m.files.get('continuation');for(const mode of ['baseline','exercise','revisit']as const)await expect(continuationJournal(m.access,mode,provenance)).rejects.toThrow()
  expect(m.files.get('continuation')).toBe(retained);expect(m.files.get('original')).toBe('retain original bytes');expect(m.files.get('failed')).toBe('retain failed bytes')
 }
})
test('durability refusal retains prior file and is not converted to a successful append',async()=>{
 const m=memory(),journal=await continuationJournal({...m.access,append:async()=>{throw Error('synthetic durability failure')}},'baseline',provenance),prior=await journal.load()
 await expect(journal.append(appendEvent(prior,'attempt_started',{}),false)).rejects.toThrow();expect(await journal.load()).toBe(prior);expect(m.counts()).toEqual({creates:1,writes:0})
 const empty=memory();await expect(continuationJournal({...empty.access,create:async()=>{throw Error('synthetic exclusive create failure')}},'baseline',provenance)).rejects.toThrow();expect(empty.files.has('continuation')).toBe(false)
})
test('invalid input refuses before network; imports do not require private fixtures',async()=>{
 const saved=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw Error('forbidden')}) as typeof fetch
 try{await expect(runHostedContinuation({mode:'deploy'})).rejects.toThrow();expect(calls).toBe(0)}finally{globalThis.fetch=saved}
})
