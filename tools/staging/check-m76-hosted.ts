/** Explicit journaled synthetic journey. Imports never read credentials, authenticate or write. */
import path from 'node:path'
import {open,unlink} from 'node:fs/promises'
import {parseJourneyInput} from './check-hosted-journey'
import {readM75Journal} from './check-m75-hosted'
import {runM72Journey} from './check-m72-hosted'
import {decodeCorporateRegister,decodeCorporateVersion,decodeCorporateReview} from '../../apps/site-web/src/lib/m71-api'
import {decodeGasRegister,decodeGasVersion,decodeGasReview} from '../../apps/site-web/src/lib/m73-api'
import {decodeMobileRegister} from '../../apps/site-web/src/lib/m74-api'
import {decodeFleetRegister,fleetReportDownload,fleetReportSnapshotDownload} from '../../apps/site-web/src/lib/m75-api'
import {m71CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m71-validation'
import {m73Export} from '../../packages/neuvetra-database/src/m73-validation'
import {m74Export} from '../../packages/neuvetra-database/src/m74-validation'
import {m75Export} from '../../packages/neuvetra-database/src/m75-validation'
import {exerciseStationary} from './m76-hosted-plan'
const HOST='https://www.neuvetra.ai',AUTH='https://icockcoguyadhryzydvl.supabase.co'
const RECEIPT=path.resolve(import.meta.dir,'../../.superpowers/m76-hosted-journey.jsonl'),PREVIOUS=path.resolve(import.meta.dir,'../../.superpowers/m75-hosted-journey.jsonl')
type Mode='baseline'|'exercise'|'revisit'
type Input=ReturnType<typeof parseJourneyInput>&{mode:Mode}
type Role=Input['accounts'][number]['role']|'signed_out'
type Event={sequence:number;previousSha256:string|null;workspaceId:string;mode:Mode;kind:string;data:any;createdAt:string;sha256:string}
type Dependencies={fetch?:typeof fetch;load?:()=>Promise<string|null>;append?:(line:string,exclusive:boolean)=>Promise<void>;loadPrevious?:()=>Promise<string>;legacy?:typeof runM72Journey;exercise?:typeof exerciseStationary}
const check=(v:unknown):void=>{if(!v)throw Error('Bounded M76 journey refused.')}
const hash=(v:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(v).digest('hex'),same=(a:unknown,b:unknown)=>canonical(a)===canonical(b)
const observation=(text:string)=>({sha256:hash(text),byteLength:Buffer.byteLength(text)})
export function parseM76JourneyInput(value:unknown):Input{const mode=(value as any)?.mode;check(['baseline','exercise','revisit'].includes(mode));return {...parseJourneyInput(value),mode}}
export function validateM76JourneyRoute(url:string,method:string,company:string){
 const u=new URL(url);check(!u.hash&&!u.username&&!u.password);const root='/workspace-api/workspace/'+company
 if(u.origin===AUTH){check(method==='POST'&&(u.pathname==='/auth/v1/token'&&u.search==='?grant_type=password'||u.pathname==='/auth/v1/logout'&&u.search==='?scope=local'));return}
 check(u.origin===HOST&&!u.search&&(u.pathname==='/ready'||u.pathname==='/workspace-api/config'||u.pathname==='/workspace-api/session'||u.pathname===root||u.pathname.startsWith(root+'/')))
 if(method!=='GET')check(method==='POST'&&(u.pathname===root+'/stationary-natural-gas'||u.pathname===root+'/stationary-diesel'||u.pathname===root+'/stationary-equipment'||new RegExp('^'+root+'/corporate-inventories/[0-9a-f-]{36}/(versions|reviews)$').test(u.pathname)||new RegExp('^'+root+'/(stationary-natural-gas|stationary-diesel|stationary-equipment)/[0-9a-f-]{36}/(versions|reviews|reports)$').test(u.pathname)))
}
export function readM76Journal(text:string|null,company:string):Event[]{if(text===null)return [];check(text.length<=48_000_000&&text.endsWith('\n'));const events=text.trimEnd().split('\n').map(line=>JSON.parse(line)) as Event[];let previous:string|null=null;for(const[i,event]of events.entries()){const{sha256,...payload}=event;check(event.sequence===i+1&&event.previousSha256===previous&&event.workspaceId===company&&['baseline','exercise','revisit'].includes(event.mode)&&typeof event.kind==='string'&&typeof event.createdAt==='string'&&hash(canonical(payload))===sha256);previous=sha256}return events}
function cleanJournal(events:Event[]){check(!events.some(e=>e.kind==='attempt_started'&&!events.some(x=>x.kind==='attempt_finished'&&x.data.attemptSequence===e.sequence))&&!events.some(e=>e.kind==='post_intent'&&!events.some(x=>x.kind==='post_outcome'&&x.data.name===e.data.name))&&!events.some(e=>e.kind==='attempt_finished'&&e.data.allCreatedAuthSessionsClosed===false)&&!events.some(e=>e.kind==='post_outcome'&&e.data.status!==e.data.expected))}
export async function runM76Journey(input:Input,deps:Dependencies={}){
 const events:Event[]=[],tokens=new Map<Role,string>(),company=input.roster.workspaceId,root='/workspace-api/workspace/'+company,transport=deps.fetch??globalThis.fetch
 let stage='receipt_load',writes=0,unknownSessions=0,closed=true,legacyClosed=true,failed=false,loaded=false,attemptSequence:number|null=null
 const network=async(url:string,init:RequestInit={})=>{validateM76JourneyRoute(url,init.method??'GET',company);return transport(url,{...init,redirect:'error',signal:AbortSignal.timeout(30000)})}
 const append=async(kind:string,data:any)=>{const payload={sequence:events.length+1,previousSha256:events.at(-1)?.sha256??null,workspaceId:company,mode:input.mode,kind,data,createdAt:new Date().toISOString()},event={...payload,sha256:hash(canonical(payload))},line=JSON.stringify(event)+'\n';await(deps.append??(async(line,exclusive)=>{const f=await open(RECEIPT,exclusive?'wx':'a');try{await f.writeFile(line);await f.sync()}finally{await f.close()}}))(line,events.length===0);events.push(event)}
 const completed=(name:string)=>events.find(e=>e.kind==='post_outcome'&&e.data.name===name)
 const get=async(name:string,route:string,role:Role='manager1'):Promise<any>=>{stage=name;const r=await network(HOST+route,{headers:{origin:HOST,...(tokens.has(role)?{authorization:'Bearer '+tokens.get(role)}:{})}}),bytes=new Uint8Array(await r.arrayBuffer());check(r.status===200&&r.headers.get('cache-control')?.includes('no-store')&&bytes.length<=4_000_000);return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
 const decodeOutcome=async(name:string,value:any)=>{
  if(name==='m71_stationary_sources')return decodeCorporateVersion(value,company)
  if(name==='m71_stationary_review')return decodeCorporateReview(value,company)
  if(/^m73_(a_relink|b_save)$/.test(name))return decodeGasVersion(value,company)
  if(/^m73_[ab]_review$/.test(name))return decodeGasReview(value,company)
  const equipment=await import('../../apps/site-web/src/lib/m76-api'),generator=await import('../../apps/site-web/src/lib/m76-diesel-api')
  if(/^m76_save_[1-4]$/.test(name))return equipment.decodeStationaryVersion(value,company)
  if(/^m76_review_[1-4]$/.test(name))return equipment.decodeStationaryReview(value,company)
  if(/^m76_diesel_(save|correction)$/.test(name))return generator.decodeGeneratorVersion(value,company)
  if(/^m76_diesel_(review|corrected_review)$/.test(name))return generator.decodeGeneratorReview(value,company)
  if(/^m76_diesel_(report|corrected_report)$/.test(name)){
   check(typeof value?.worksheetId==='string'&&typeof value?.versionId==='string')
   const version=await generator.decodeGeneratorVersion(await get('generator_report_version',root+'/stationary-diesel/'+value.worksheetId+'/versions/'+value.versionId),company)
   return generator.decodeGeneratorReport(value,company,version)
  }
  if(/^m76_report_[1-4]$/.test(name)){
   const {m76ReportHashPayload}=await import('../../packages/neuvetra-database/src/m76-validation'),{m76RenderReport}=await import('../../packages/neuvetra-database/src/m76-report')
   check(value?.companyId===company&&typeof value.html==='string'&&typeof value.snapshotJson==='string'&&value.rendererVersion==='m76-stationary-reconciliation-report-v1'&&hash(value.html)===value.htmlSha256&&Buffer.byteLength(value.html)===value.htmlByteLength&&hash(value.snapshotJson)===value.snapshotSha256&&hash(canonical(m76ReportHashPayload(value)))===value.reportSha256)
   const snapshot=JSON.parse(value.snapshotJson);await equipment.decodeStationaryVersion(snapshot.version,company);if(snapshot.review)await equipment.decodeStationaryReview(snapshot.review,company,snapshot.version);check(canonical(snapshot)===value.snapshotJson&&m76RenderReport(snapshot)===value.html);return value
  }
  throw Error('Unknown successful stationary operation')
 }
 const post=async(name:string,route:string,role:Role,build:()=>Promise<unknown>|unknown,expected=201):Promise<any>=>{
  stage=name;check(input.mode==='exercise');const old=completed(name)
  if(old){check(old.data.route===route&&old.data.role===role&&old.data.expected===expected&&old.data.status===expected);return expected===201?decodeOutcome(name,old.data.response):undefined}
  check(!events.some(e=>e.kind==='post_intent'&&e.data.name===name));const request=await build();await append('post_intent',{name,route,role,expected,request});writes++
  const r=await network(HOST+route,{method:'POST',headers:{origin:HOST,...(tokens.has(role)?{authorization:'Bearer '+tokens.get(role)}:{}),'content-type':'application/json'},body:JSON.stringify(request)}),bytes=new Uint8Array(await r.arrayBuffer());check(bytes.length<=4_000_000&&r.headers.get('cache-control')?.includes('no-store'))
  if(r.status!==expected||expected!==201){await append('post_outcome',{name,route,role,expected,status:r.status,responseObservation:{sha256:hash(bytes),byteLength:bytes.length}});check(r.status===expected);return undefined}
  const decoded=await decodeOutcome(name,JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));await append('post_outcome',{name,route,role,expected,status:r.status,response:decoded});return decoded
 }
 const download=async(route:string,expected:string)=>{stage='exact_download';const r=await network(HOST+route,{headers:{origin:HOST,authorization:'Bearer '+tokens.get('member')}}),bytes=new Uint8Array(await r.arrayBuffer());check(r.status===200&&r.headers.get('cache-control')?.includes('no-store')&&bytes.length<=4_000_000&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===expected);return observation(expected)}
 const clientTransport=async<T>(family:string,work:()=>Promise<T>)=>{const saved=globalThis.fetch;try{globalThis.fetch=(async(url:any,init:RequestInit={})=>{const prefix=root+'/'+family;check(typeof url==='string'&&(url===prefix||url.startsWith(prefix+'/'))&&(init.method??'GET')==='GET'&&!init.body);return network(HOST+url,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),origin:HOST}})}) as typeof fetch;return await work()}finally{globalThis.fetch=saved}}
 const member=()=>({accessToken:tokens.get('member')!,userId:input.accounts.find(a=>a.role==='member')!.id,role:'member' as const})
 const read=async()=>{
  const corporate=await decodeCorporateRegister(await get('corporate_read',root+'/corporate-inventories'),company),gas=await decodeGasRegister(await get('gas_read',root+'/stationary-natural-gas'),company),mobile=await decodeMobileRegister(await get('mobile_read',root+'/mobile-diesel'),company),fleet=await decodeFleetRegister(await get('fleet_read',root+'/controlled-fleet'),company)
  let diesel:any=null,equipment:any=null
  if(input.mode!=='baseline'){const e=await import('../../apps/site-web/src/lib/m76-api'),g=await import('../../apps/site-web/src/lib/m76-diesel-api');diesel=await g.decodeGeneratorRegister(await get('generator_read',root+'/stationary-diesel'),company);equipment=await e.decodeStationaryRegister(await get('equipment_read',root+'/stationary-equipment'),company)}
  return {corporate,gas,mobile,fleet,diesel,equipment}
 }
 const downloads=async(reg:any)=>{
  const out:any={corporate:{},gas:{},mobile:{},fleet:{},diesel:{},equipment:{}}
  for(const v of reg.corporate.versions)out.corporate[v.id]=await download(root+'/corporate-inventories/'+v.inventoryId+'/versions/'+v.id+'/coverage-export',canonical({...v,review:null}))
  for(const[family,base,exporter]of[['gas','stationary-natural-gas',m73Export],['mobile','mobile-diesel',m74Export],['diesel','stationary-diesel',(v:any)=>canonical({...v,review:null})]] as const){
   if(!reg[family])continue
   for(const w of reg[family].worksheets){
    for(const v of w.versions){out[family]['version_'+v.id]=await download(root+'/'+base+'/'+w.worksheetId+'/versions/'+v.id+'/calculation-export',exporter(v));for(const[k,s]of family==='mobile'?[['fuel',v.fuelStatement],['mileage',v.mileageStatement]]:[['statement',v.statement]])if(s)out[family][k+'_'+s.id]=await download(root+'/'+base+'/'+w.worksheetId+'/statements/'+s.id+'/download',s.text)}
    for(const r of w.reports){
     if(family==='diesel'){
      const client=await import('../../apps/site-web/src/lib/m76-diesel-api')
      out.diesel['report_'+r.id]=observation(await clientTransport(base,()=>client.generatorReportDownload(member(),company,w.worksheetId,r)))
      out.diesel['snapshot_'+r.id]=await download(root+'/'+base+'/'+w.worksheetId+'/reports/'+r.id+'/snapshot',r.snapshotJson)
     }else out[family]['report_'+r.id]=await download(root+'/'+base+'/'+w.worksheetId+'/reports/'+r.id+'/download',r.html)
    }
   }
  }
  for(const[family,base,exporter]of[['fleet','controlled-fleet',m75Export],['equipment','stationary-equipment',(v:any)=>canonical(v)]] as const){if(!reg[family])continue;for(const v of reg[family].versions){out[family]['version_'+v.id]=await download(root+'/'+base+'/'+v.rosterId+'/versions/'+v.id+'/roster-export',exporter(v));if(v.statement)out[family]['statement_'+v.statement.id]=await download(root+'/'+base+'/'+v.rosterId+'/statements/'+v.statement.id+'/download',v.statement.text)}await clientTransport(base,async()=>{const e=family==='fleet'?{html:fleetReportDownload,snapshot:fleetReportSnapshotDownload}:{html:(await import('../../apps/site-web/src/lib/m76-api')).stationaryReportDownload,snapshot:(await import('../../apps/site-web/src/lib/m76-api')).stationaryReportSnapshotDownload};for(const r of reg[family].reports){out[family]['report_'+r.id]=observation(await e.html(member(),company,r));out[family]['snapshot_'+r.id]=observation(await e.snapshot(member(),company,r));out[family]['proof_'+r.id]=hash(canonical(await get('historical_proof',root+'/'+base+'/'+r.rosterId+'/reports/'+r.id+'/proof','member')))}})}
  return out
 }
 const preserves=(before:any,after:any)=>{for(const family of ['corporate','gas','mobile','fleet']){if(family==='gas'||family==='mobile'){for(const w of before[family].worksheets){const next=after[family].worksheets.find((x:any)=>x.worksheetId===w.worksheetId);check(next);for(const v of w.versions)check(same(next.versions.find((x:any)=>x.id===v.id),v));for(const r of w.reports)check(same(next.reports.find((x:any)=>x.id===r.id),r))}}else{for(const v of before[family].versions)check(same(after[family].versions.find((x:any)=>x.id===v.id),v));if(family==='fleet')for(const r of before.fleet.reports)check(same(after.fleet.reports.find((x:any)=>x.id===r.id),r))}}}
 try{
  events.push(...readM76Journal(deps.load?await deps.load():await Bun.file(RECEIPT).exists()?await Bun.file(RECEIPT).text():null,company));loaded=true;stage='resume_preconditions';cleanJournal(events)
  const baseline=events.find(e=>e.kind==='baseline'),success=events.find(e=>e.kind==='exercise_complete');check(input.mode==='baseline'?!baseline:!!baseline);check(input.mode==='revisit'?!!success:input.mode==='exercise'?!success:true)
  const previous=readM75Journal(await(deps.loadPrevious?deps.loadPrevious():Bun.file(PREVIOUS).text()),company);cleanJournal(previous);const prior=previous.find(e=>e.kind==='exercise_complete'),priorBaseline=previous.find(e=>e.kind==='baseline');check(prior&&priorBaseline&&previous.some(e=>e.kind==='revisit_verified'))
  await append('attempt_started',{mode:input.mode});attemptSequence=events.at(-1)!.sequence
  const ready=await network(HOST+'/ready'),readiness=await ready.json() as any;check(ready.status===200&&readiness.schemaVersion===(input.mode==='baseline'?18:19));await append('actual_readiness',{schemaVersion:readiness.schemaVersion})
  let legacy:any;stage='legacy_read_only';const legacyResult=await(deps.legacy??runM72Journey)({...input,mode:'baseline'},{load:async()=>null,save:async value=>{legacy=value},fetch:(async(url,init)=>{check(!(String(url).startsWith(HOST)&&init?.method==='POST'));const r=await network(String(url),init);if(String(url)===HOST+'/ready'){const v=await r.json() as any;check(v.schemaVersion===readiness.schemaVersion);return Response.json({...v,schemaVersion:14},{status:r.status,headers:r.headers})}return r}) as typeof fetch});legacyClosed=legacyResult.allCreatedAuthSessionsClosed;check(legacyResult.status==='passed'&&legacyClosed&&legacyResult.applicationPostRequests===0&&same(legacy.baseline,priorBaseline!.data.legacy));if(baseline)check(same(legacy.baseline,baseline.data.legacy))
  for(const account of input.accounts){stage='sign_in_'+account.role;unknownSessions++;const r=await network(AUTH+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:input.env.SUPABASE_ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})}),s=await r.json() as any;if(typeof s.access_token==='string'&&s.access_token.length>0&&s.access_token.length<=8192){tokens.set(account.role,s.access_token);unknownSessions--}check(r.status===200&&s.user?.id===account.id&&tokens.has(account.role))}
  const current=await read(),bytes=await downloads(current)
  if(input.mode==='baseline'){check(same(current.corporate,prior!.data.corporate)&&same(current.mobile,prior!.data.mobile)&&same(current.fleet,prior!.data.fleet)&&same(bytes.corporate,prior!.data.exports)&&same(bytes.mobile,prior!.data.mobileDownloads)&&same(bytes.fleet,prior!.data.fleetDownloads)&&same(bytes.gas,prior!.data.gasDownloads));await append('baseline',{legacy:legacy.baseline,...current,downloads:bytes})}
  else if(input.mode==='revisit'){check(same(current,success!.data.registers)&&same(bytes,success!.data.downloads));preserves(baseline!.data,current);await append('revisit_verified',{exerciseSha256:success!.sha256})}
  else{preserves(baseline!.data,current);const final=await(deps.exercise??exerciseStationary)({root,baseline:baseline!.data,events,append,post,read,check});preserves(baseline!.data,final);const exact=await downloads(final);for(const family of ['corporate','gas','mobile','fleet'])for(const[key,value]of Object.entries(baseline!.data.downloads[family]))check(same(exact[family][key],value));await append('exercise_complete',{registers:final,downloads:exact})}
 }catch{failed=true}
 finally{for(const token of tokens.values())try{const r=await network(AUTH+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:input.env.SUPABASE_ANON_KEY,authorization:'Bearer '+token}});await r.body?.cancel();if(r.status!==204)closed=false}catch{closed=false}tokens.clear()}
 const allCreatedAuthSessionsClosed=closed&&legacyClosed&&unknownSessions===0;failed||=!allCreatedAuthSessionsClosed
 if(loaded&&attemptSequence!==null)try{await append('attempt_finished',{attemptSequence,status:failed?'failed':'passed',stage,applicationPostRequests:writes,allCreatedAuthSessionsClosed})}catch{failed=true;stage='receipt_append'}
 return {status:failed?'failed':'passed',mode:input.mode,stage,applicationPostRequests:writes,allCreatedAuthSessionsClosed,receiptSha256:events.at(-1)?.sha256??null}
}
if(import.meta.main){let lock:Awaited<ReturnType<typeof open>>|undefined;try{const text=await Bun.stdin.text();check(text.length<=128000);const input=parseM76JourneyInput(JSON.parse(text));lock=await open(RECEIPT+'.lock','wx');const result=await runM76Journey(input);console.log(JSON.stringify(result));if(result.status!=='passed')process.exitCode=1}catch{console.log(JSON.stringify({status:'failed',stage:'input_or_exclusive_lock'}));process.exitCode=1}finally{if(lock){await lock.close();await unlink(RECEIPT+'.lock')}}}
