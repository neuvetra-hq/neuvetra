/** Separate continuation after the closed continuation3 read-only failure. */
import {open,readFile,unlink} from 'node:fs/promises';
import {runM78Continuation,readM78ContinuationJournal,cleanM78ContinuationJournal,type M78Dependencies} from './check-m78-continuation';
import {parseM78Continuation3Input,verifyM78Continuation3Disposition,readM78Continuation3Diagnostics,m78Continuation3DiagnosticFetch,M78_CONTINUATION3_INTERRUPTION,M78_CONTINUATION3_PATHS,type M78Continuation3Input,type M78Continuation3IO} from './check-m78-continuation3';
import {m78CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m78-validation';

export const M78_CONTINUATION4_PATHS={
 journal:'.superpowers/m78-hosted-continuation4.jsonl',
 diagnostics:'.superpowers/m78-hosted-continuation4-diagnostics.jsonl',
 stop:'.superpowers/m78-hosted-continuation4.stop',
 actualFailedMain:'.superpowers/m78-hosted-continuation3.jsonl',
 actualFailedDiagnostics:'.superpowers/m78-hosted-continuation3-diagnostics.jsonl',
 failedMain:'tools/staging/m78-continuation4-failed-continuation3-main.jsonl',
 failedDiagnostics:'tools/staging/m78-continuation4-failed-continuation3-diagnostics.jsonl',
 failedReview:'evaluations/research-qa/m78-continuation3-baseline-failure-result.json',
}as const;
export const M78_CONTINUATION4_PRIOR_FAILURE={
 mainSha256:'0204a7e93849b305bafc45b79232b3af588619fcb851752d2ef541869d584012',
 mainHead:'7dc4b514e0dbcf0d29c857d146f6db709d9317fdfd0dc69a6be50c19acb1cbfa',
 diagnosticsSha256:'8b45e72d193d9f3c2b6a03c63c75e61a8055223862f13b297c9b4d26725972c1',
 diagnosticsHead:'0dc8e2b0b40fd10b183579a19748e117d6ec5d68c98a69d2fdfb6f4b25bb6f65',
 reviewSha256:'261e4fccf8f85fc7cb99205357baf30346852eb3930d5760984bb471bb3aafe3',
}as const;
const sha=(v:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(v).digest('hex');
function check(v:unknown):asserts v{if(!v)throw Error('Bounded continuation4 refused')}
export type M78Continuation4Input=M78Continuation3Input;
export const parseM78Continuation4Input=(raw:unknown):M78Continuation4Input=>parseM78Continuation3Input(raw);

/** Verifies the exact closed continuation3 failure, its diagnostics, and the independent reconciliation. */
export function verifyM78Continuation4PriorFailure(main:string,diagnosticText:string,reviewText:string,company:string,input:M78Continuation4Input){
 check(sha(main)===M78_CONTINUATION4_PRIOR_FAILURE.mainSha256);const events=readM78ContinuationJournal(main,company),finish=events.at(-1)!;
 check(events.length===24&&finish.sha256===M78_CONTINUATION4_PRIOR_FAILURE.mainHead&&finish.kind==='attempt_finished'&&finish.mode==='baseline');
 check(finish.data.status==='failed'&&finish.data.requests===30&&finish.data.applicationPostRequests===0&&finish.data.unknownAuthSessions===0&&finish.data.allCreatedAuthSessionsClosed===true);
 check(events.filter(e=>e.kind==='attempt_started').length===1&&events.every(e=>e.mode==='baseline'&&!e.kind.startsWith('post_')&&!['baseline','exercise_complete','revisit_verified','legacy_auth_intent'].includes(e.kind)));
 for(const role of ['manager1','manager2','member','outsider'])check(events.filter(e=>e.kind==='auth_outcome'&&e.data.role===role&&e.data.status===200&&e.data.tokenObserved===true&&e.data.subjectMatched===true).length===1&&events.filter(e=>e.kind==='logout_outcome'&&e.data.role===role&&e.data.status===204).length===1);
 check(sha(diagnosticText)===M78_CONTINUATION4_PRIOR_FAILURE.diagnosticsSha256);const diagnostics=readM78Continuation3Diagnostics(diagnosticText),first=diagnostics[0]!,last=diagnostics.at(-1)!;
 check(diagnostics.length===62&&last.sha256===M78_CONTINUATION4_PRIOR_FAILURE.diagnosticsHead&&first.kind==='phase_started'&&last.kind==='phase_finished');
 check(first.data.journal===M78_CONTINUATION3_PATHS.journal&&canonical(first.data.interruption)===canonical(M78_CONTINUATION3_INTERRUPTION)&&canonical(first.data.disposition)===canonical(input.interruptionDisposition));
 check(last.data.status==='failed'&&last.data.paused===false&&last.data.diagnosticsHealthy===true&&last.data.applicationPostRequests===0&&last.data.allCreatedAuthSessionsClosed===true);
 const requests=new Map<number,{method:string;route:string;outcome:any}>();let ordinal=0;for(const event of diagnostics){if(event.kind==='request_intent'){check(event.data.ordinal===++ordinal&&['GET','POST'].includes(event.data.method));if(event.data.method==='POST')check(['auth:/auth/v1/token','auth:/auth/v1/logout'].includes(event.data.route));requests.set(ordinal,{...event.data,outcome:null})}else if(event.kind==='response_headers'||event.kind==='request_error'){const request=requests.get(event.data.ordinal);check(request&&request.outcome===null);request.outcome=event}}
 check(requests.size===30&&[...requests.values()].every(r=>r.outcome));const failed=requests.get(26)!;check(failed.method==='GET'&&failed.route==='application:/workspace-api/workspace/:id/corporate-inventories/:id/versions/:id/coverage-export'&&failed.outcome.kind==='request_error'&&failed.outcome.data.category==='timeout'&&failed.outcome.data.elapsedMs===30007);
 check([...requests.values()].filter(r=>r.outcome.kind==='request_error').length===1&&[...requests.values()].filter(r=>r.route==='auth:/auth/v1/token'&&r.outcome.kind==='response_headers'&&r.outcome.data.status===200).length===4&&[...requests.values()].filter(r=>r.route==='auth:/auth/v1/logout'&&r.outcome.kind==='response_headers'&&r.outcome.data.status===204).length===4);
 check(sha(reviewText)===M78_CONTINUATION4_PRIOR_FAILURE.reviewSha256);const review=JSON.parse(reviewText);check(review.status==='m78_independent_continuation3_baseline_failure_reconciled'&&review.baselineAccepted===false&&review.successReviewerRejected===true&&review.providerCause==='not_established');
 check(canonical(review.journal)===canonical({path:M78_CONTINUATION3_PATHS.journal,sha256:M78_CONTINUATION4_PRIOR_FAILURE.mainSha256,head:M78_CONTINUATION4_PRIOR_FAILURE.mainHead,events:24})&&canonical(review.diagnostics)===canonical({path:M78_CONTINUATION3_PATHS.diagnostics,sha256:M78_CONTINUATION4_PRIOR_FAILURE.diagnosticsSha256,head:M78_CONTINUATION4_PRIOR_FAILURE.diagnosticsHead,events:62}));
 check(review.requests===30&&review.applicationPostRequests===0&&review.knownSessions===4&&review.logout204===4&&review.unknownAuthSessions===0&&review.allCreatedAuthSessionsClosed===true&&review.timeout?.ordinal===26&&review.timeout?.elapsedMs===30007&&review.timeout?.responseHeadersObserved===false&&review.originalsModified===false);
 return {events,diagnostics,review};
}

/** Public transport seam: one underlying fetch call with Bun pooling disabled. */
export function m78Continuation4NoPoolFetch(transport:typeof fetch){return (async(raw:RequestInfo|URL,init?:RequestInit)=>transport(raw,{...init,keepalive:false}))as typeof fetch}

type Diagnostic={sequence:number;previousSha256:string|null;profile:'m78-continuation4-diagnostic-v1';mode:M78Continuation4Input['mode'];kind:string;data:any;createdAt:string;sha256:string};
export function readM78Continuation4Diagnostics(text:string|null){if(text===null)return [] as Diagnostic[];check(Buffer.byteLength(text)<=8_000_000&&text.endsWith('\n'));let previous:string|null=null;const events=text.trimEnd().split('\n').map((line,i)=>{check(Buffer.byteLength(line)<=4096);const event=JSON.parse(line)as Diagnostic,{sha256:hash,...body}=event;check(event.sequence===i+1&&event.previousSha256===previous&&event.profile==='m78-continuation4-diagnostic-v1'&&sha(canonical(body))===hash);previous=hash;return event});check(events.length<=16384);return events}

/** Stop is latched; logout remains available for cleanup. */
export function m78Continuation4PauseFetch(transport:typeof fetch,storage:Pick<M78Continuation3IO,'read'>){let stopped=false;const wrapped=(async(raw:RequestInfo|URL,init?:RequestInit)=>{const url=typeof raw==='string'?raw:raw instanceof URL?raw.href:raw.url;if(new URL(url).pathname!=='/auth/v1/logout'){if(await storage.read(M78_CONTINUATION4_PATHS.stop)!==null)stopped=true;if(stopped)throw new DOMException('Graceful stop requested','AbortError')}return transport(raw,init)})as typeof fetch;return{fetch:wrapped,paused:()=>stopped}}
export function m78Continuation4JournalDependencies(storage:M78Continuation3IO,text:string|null,onPause:()=>void=()=>{}):Pick<M78Dependencies,'load'|'append'>{return{load:async()=>text,append:async(line,exclusive)=>{if(JSON.parse(line).kind==='auth_intent'&&await storage.read(M78_CONTINUATION4_PATHS.stop)!==null){onPause();throw new DOMException('Graceful stop requested','AbortError')}await storage.append(M78_CONTINUATION4_PATHS.journal,line,exclusive)}}}

const io:M78Continuation3IO={read:async path=>{try{return await readFile(path,'utf8')}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}},append:async(path,line,exclusive)=>{const file=await open(path,exclusive?'wx':'a',0o600);try{await file.writeFile(line);await file.sync()}finally{await file.close()}}};
export async function runM78Continuation4(input:M78Continuation4Input,options:{io?:M78Continuation3IO;fetch?:typeof fetch}={}){
 const storage=options.io??io;await verifyM78Continuation3Disposition(input,storage);
 const actualMain=await storage.read(M78_CONTINUATION4_PATHS.actualFailedMain),actualDiagnostics=await storage.read(M78_CONTINUATION4_PATHS.actualFailedDiagnostics),main=await storage.read(M78_CONTINUATION4_PATHS.failedMain),diagnosticsText=await storage.read(M78_CONTINUATION4_PATHS.failedDiagnostics),reviewText=await storage.read(M78_CONTINUATION4_PATHS.failedReview);check(actualMain!==null&&actualDiagnostics!==null&&main!==null&&diagnosticsText!==null&&reviewText!==null&&actualMain===main&&actualDiagnostics===diagnosticsText);verifyM78Continuation4PriorFailure(main,diagnosticsText,reviewText,input.roster.workspaceId,input);
 check(await storage.read(M78_CONTINUATION4_PATHS.stop)===null);const text=await storage.read(M78_CONTINUATION4_PATHS.journal),events=readM78ContinuationJournal(text,input.roster.workspaceId);cleanM78ContinuationJournal(events);
 const oldDiagnostics=await storage.read(M78_CONTINUATION4_PATHS.diagnostics),diagnostics=readM78Continuation4Diagnostics(oldDiagnostics);check(input.mode==='baseline'?text===null&&oldDiagnostics===null:events.length>0&&diagnostics.at(-1)?.kind==='phase_finished'&&diagnostics.at(-1)?.data.status==='passed');
 let bytes=Buffer.byteLength(oldDiagnostics??'');const emit=async(kind:string,data:any)=>{const body={sequence:diagnostics.length+1,previousSha256:diagnostics.at(-1)?.sha256??null,profile:'m78-continuation4-diagnostic-v1' as const,mode:input.mode,kind,data,createdAt:new Date().toISOString()},event={...body,sha256:sha(canonical(body))},line=JSON.stringify(event)+'\n';check(Buffer.byteLength(line)<=4096&&diagnostics.length<16384&&bytes+Buffer.byteLength(line)<=8_000_000);await storage.append(M78_CONTINUATION4_PATHS.diagnostics,line,diagnostics.length===0);diagnostics.push(event);bytes+=Buffer.byteLength(line)};
 await emit('phase_started',{priorFailure:{...M78_CONTINUATION4_PRIOR_FAILURE,main:M78_CONTINUATION4_PATHS.failedMain,diagnostics:M78_CONTINUATION4_PATHS.failedDiagnostics,review:M78_CONTINUATION4_PATHS.failedReview},interruption:M78_CONTINUATION3_INTERRUPTION,disposition:input.interruptionDisposition,journal:M78_CONTINUATION4_PATHS.journal,transport:{runtime:'bun-fetch',pooling:'disabled',keepalive:false,retries:0}});
 let journalPaused=false;const noPool=m78Continuation4NoPoolFetch(options.fetch??globalThis.fetch),paused=m78Continuation4PauseFetch(noPool,storage),observed=m78Continuation3DiagnosticFetch(paused.fetch,emit),deps:M78Dependencies={fetch:observed.fetch,...m78Continuation4JournalDependencies(storage,text,()=>{journalPaused=true})};
 const result=await runM78Continuation(input,deps),pauseObserved=journalPaused||paused.paused(),status=result.status==='passed'&&observed.healthy()&&!pauseObserved?'passed':'failed';await emit('phase_finished',{status,paused:pauseObserved,diagnosticsHealthy:observed.healthy(),applicationPostRequests:result.applicationPostRequests,allCreatedAuthSessionsClosed:result.allCreatedAuthSessionsClosed});return{...result,status,paused:pauseObserved,diagnosticsHealthy:observed.healthy()};
}
if(import.meta.main){let lock:Awaited<ReturnType<typeof open>>|undefined;try{const text=await Bun.stdin.text();check(text.length<=128000);const input=parseM78Continuation4Input(JSON.parse(text));lock=await open(M78_CONTINUATION4_PATHS.journal+'.lock','wx',0o600);await lock.writeFile('{"profile":"m78-exclusive-continuation4-v1"}\n');await lock.sync();const result=await runM78Continuation4(input);console.log(JSON.stringify(result));if(result.status!=='passed')process.exitCode=1}catch{console.log(JSON.stringify({status:'failed',stage:'continuation4_entry',applicationWritesNotInferred:true}));process.exitCode=1}finally{if(lock){await lock.close();await unlink(M78_CONTINUATION4_PATHS.journal+'.lock')}}}
