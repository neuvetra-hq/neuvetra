/** Explicit read-only diagnosis. No filesystem or network work on import. */
import {open} from 'node:fs/promises'
import {runHostedRecovery,parseRecoveryInput,validateRecoveryRoute,validateOriginalRecoveryJournal,readRecoveryJournal} from './m76-hosted-recovery'
import {RECOVERY_COMPANY,recoveryHash as hash} from './m76-hosted-recovery-recipe'
import {m71CanonicalJson as canonical,parseM71Json} from '../../packages/neuvetra-database/src/m71-validation'
import {decodeCorporateRegister} from '../../apps/site-web/src/lib/m71-api'
import {decodeGasRegister} from '../../apps/site-web/src/lib/m73-api'
import {decodeMobileRegister} from '../../apps/site-web/src/lib/m74-api'
import {decodeFleetRegister} from '../../apps/site-web/src/lib/m75-api'
import {decodeGeneratorRegister} from '../../apps/site-web/src/lib/m76-diesel-api'
import {decodeStationaryRegister} from '../../apps/site-web/src/lib/m76-api'

const HOST='https://www.neuvetra.ai',AUTH='https://icockcoguyadhryzydvl.supabase.co'
const ROOT=`/workspace-api/workspace/${RECOVERY_COMPANY}`
const ORIGINAL='.superpowers/m76-hosted-journey.jsonl',RECOVERY='.superpowers/m76-hosted-recovery.jsonl'
const FAILED_RECOVERY_BYTES='283e125e000019e037b19fafa89a96c297e4fd92fb08b76c1a11cc56fbed283f'
const FAILED_RECOVERY_HEAD='b9db5630321e6dc5fa50ede903996c29ad17b9ab4e777f982f60bd1a10c8b6b4'
const check=(v:unknown)=>{if(!v)throw Error('Read-only baseline diagnostic refused.')}
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b)
const core=(v:any)=>Object.hasOwn(v,'review')?{...v,review:null}:v
const decoders:Record<string,{family:string;decode:(v:unknown,c:string)=>Promise<any>}>= {
 'corporate-inventories':{family:'corporate',decode:decodeCorporateRegister},
 'stationary-natural-gas':{family:'gas',decode:decodeGasRegister},
 'mobile-diesel':{family:'mobile',decode:decodeMobileRegister},
 'controlled-fleet':{family:'fleet',decode:decodeFleetRegister},
 'stationary-diesel':{family:'diesel',decode:decodeGeneratorRegister},
 'stationary-equipment':{family:'equipment',decode:decodeStationaryRegister},
}
export function diagnosticRoute(url:string,method:string){
 validateRecoveryRoute(url,method)
 const u=new URL(url)
 if(u.origin===HOST)check(method==='GET')
 else check(u.origin===AUTH&&method==='POST'&&(
  u.pathname==='/auth/v1/token'&&u.search==='?grant_type=password'||
  u.pathname==='/auth/v1/logout'&&u.search==='?scope=local'))
 return u.origin===AUTH?(u.pathname.endsWith('/token')?'auth/sign_in':'auth/sign_out'):
  u.pathname.replace(ROOT,'/workspace/:company').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,':id')
}

/** Reuse the frozen baseline with an isolated memory journal, never the failed journal. */
export async function diagnoseHostedBaseline(value:unknown){
 check((value as any)?.mode==='baseline')
 const input=parseRecoveryInput(value),originalText=await Bun.file(ORIGINAL).text(),original=validateOriginalRecoveryJournal(originalText)
 const failedText=await Bun.file(RECOVERY).text(),failed=readRecoveryJournal(failedText)
 check(hash(failedText)===FAILED_RECOVERY_BYTES&&failed.length===2&&failed.at(-1)?.sha256===FAILED_RECOVERY_HEAD)
 check(failed[0]!.kind==='attempt_started'&&failed[1]!.kind==='attempt_finished'&&failed[1]!.data.status==='failed'&&failed[1]!.data.applicationPostRequests===0&&failed[1]!.data.allCreatedAuthSessionsClosed===true)
 check(hash(await Bun.file('tools/staging/m76-hosted-recovery.ts').bytes())==='d7592d1d1f72a83e45014ce1d5d215831ff20da418ec3189f948ec3677cae59e')
 check(hash(await Bun.file('tools/staging/m76-hosted-recovery-recipe.ts').bytes())==='adac50e2d89b8c0b30df143426ddcccc694e1a2d339c6ec1547ee5e81b03ba15')
 const output=`.superpowers/m76-baseline-diagnostic-${Date.now()}.jsonl`,file=await open(output,'wx',0o600)
 const savedFetch=globalThis.fetch,started=performance.now(),registers:any={},checksDone=new Set<string>()
 let sequence=0,callIndex=0,traceDurable=true,applicationPosts=0,isolatedEvents=0,isolatedComplete=false
 let pending=Promise.resolve()
 const log=async(data:Record<string,unknown>)=>{
  const line=JSON.stringify({sequence:++sequence,createdAt:new Date().toISOString(),...data})+'\n'
  const task=pending.then(async()=>{await file.writeFile(line);await file.sync()});pending=task.catch(()=>{})
  try{await task}catch{traceDurable=false;throw Error('Diagnostic trace durability refused.')}
 }
 const response=(name:string)=>original.find(e=>e.kind==='post_outcome'&&e.data.name===name)!.data.response
 const compare=async(name:string,ok:unknown)=>{if(checksDone.has(name))return;checksDone.add(name);await log({kind:'precondition',name,matched:Boolean(ok)})}
 const compareRegisters=async()=>{
  const c=registers.corporate,e=registers.equipment
  if(c){const v=response('m71_stationary_sources');await compare('corporate_exact_v6_core',c.versions.length===6&&c.headVersionId===v.id&&same(core(c.versions.at(-1)),v));await compare('corporate_exact_review',same(c.versions.at(-1)?.review,response('m71_stationary_review')));await compare('manager1_exact_original_actor',input.accounts.find(a=>a.role==='manager1')!.id===v.createdBy);await compare('manager2_exact_original_actor',input.accounts.find(a=>a.role==='manager2')!.id===response('m71_stationary_review').reviewerId)}
  if(e){const v=response('m76_save_2');await compare('equipment_exact_v2_core',e.versions.length===2&&e.reports.length===1&&e.headVersionId===v.id&&same(e.versions.at(-1),v)&&!e.reviews.some((r:any)=>r.versionId===v.id));await compare('equipment_two_expected_blockers',same(e.reconciliation.findings.map((f:any)=>f.code).sort(),['roster_review_required','source_screening_unresolved'])&&e.reconciliation.dependencySha256===v.dependencies.dependencySha256)}
  for(const [family,n,r]of[['gas','m73_a_relink','m73_a_review'],['gas','m73_b_save','m73_b_review'],['diesel','m76_diesel_save','m76_diesel_review']])if(registers[family!]){const v=response(n!),w=registers[family!].worksheets.find((w:any)=>w.worksheetId===v.worksheetId);await compare(n!+'_core',w?.headVersionId===v.id&&same(core(w.versions.at(-1)),v));await compare(n!+'_review',same(w?.versions.at(-1)?.review,response(r!)))}
  if(registers.gas)await compare('gas_exact_two_streams',registers.gas.worksheets.length===2)
  if(registers.diesel)await compare('diesel_exact_one_stream',registers.diesel.worksheets.length===1)
  for(const family of ['corporate','gas','mobile','fleet'])if(registers[family]){
   const b=original.find(e=>e.kind==='baseline')!.data,old=family==='gas'||family==='mobile'?b[family].worksheets.flatMap((w:any)=>w.versions):b[family].versions,now=family==='gas'||family==='mobile'?registers[family].worksheets.flatMap((w:any)=>w.versions):registers[family].versions
   await compare(family+'_retained_original_versions',old.every((v:any)=>same(now.find((n:any)=>n.id===v.id),v)))
  }
 }
 const observedFetch=(async(url:any,init:RequestInit={})=>{
  const text=String(url),method=init.method??'GET',label=diagnosticRoute(text,method),index=++callIndex,start=performance.now(),logout=label==='auth/sign_out'
  if(new URL(text).origin===HOST&&method!=='GET'){applicationPosts++;throw Error('Application mutation refused before transport.')}
  try{await log({kind:'call_started',call:index,route:label,method})}catch{if(!logout)throw Error('Diagnostic refused before transport.')}
  let r:Response,bytes:Uint8Array|undefined
  try{
   r=await savedFetch(text,init)
   if(new URL(text).origin===HOST){bytes=new Uint8Array(await r.clone().arrayBuffer());check(bytes.length<=4_000_000)}
  }catch{
   try{await log({kind:'call_failed',call:index,route:label,durationMs:Math.round(performance.now()-start),category:init.signal?.aborted?'aborted_or_timeout':'transport_or_body_bound'})}catch{}
   throw Error('Read-only diagnostic transport refused.')
  }
  try{await log({kind:'call_finished',call:index,route:label,status:r.status,durationMs:Math.round(performance.now()-start),...(bytes?{byteLength:bytes.length,bodySha256:hash(bytes),noStore:r.headers.get('cache-control')?.includes('no-store')===true}:{})})}catch{if(!logout)throw Error('Diagnostic trace refused.')}
  const suffix=new URL(text).pathname.slice(ROOT.length+1),decoder=decoders[suffix],parts=suffix.split('/'),family=decoders[parts[0]!]?.family
  if(bytes&&r.status===200&&family&&parts.length===5){
   const id=parts[3]!,kind=parts[2]!,tail=parts[4]!,old=original.find(e=>e.kind==='baseline')!.data
   let key:string|undefined
   if(kind==='versions'&&['coverage-export','calculation-export','roster-export'].includes(tail))key=family==='corporate'?id:'version_'+id
   if(kind==='reports')key=(tail==='snapshot'?'snapshot_':tail==='proof'?'proof_':tail==='download'?'report_':'')+id
   if(kind==='statements'&&tail==='download'){
    const fuel=old.mobile?.worksheets?.some((w:any)=>w.versions.some((v:any)=>v.fuelStatement?.id===id))
    key=(family==='mobile'?(fuel?'fuel_':'mileage_'):'statement_')+id
   }
   const expected=key?old.downloads[family]?.[key]:undefined
   if(expected!==undefined){let matched=false;try{matched=typeof expected==='string'?hash(canonical(parseM71Json(new TextDecoder('utf-8',{fatal:true}).decode(bytes),4_000_000)))===expected:same({sha256:hash(bytes),byteLength:bytes.length},expected)}catch{}
    await log({kind:'original_download_observation',call:index,route:label,matched,comparison:typeof expected==='string'?'canonical_proof_sha256':'exact_bytes_sha256_and_length'})
   }
  }
  if(method==='GET'&&decoder&&r.status===200&&bytes){
   const decodeStart=performance.now();let decoded:any
   try{decoded=await decoder.decode(parseM71Json(new TextDecoder('utf-8',{fatal:true}).decode(bytes),4_000_000),RECOVERY_COMPANY)}catch{await log({kind:'register_decoder',call:index,family:decoder.family,verified:false,durationMs:Math.round(performance.now()-decodeStart)});throw Error('Read-only diagnostic decoder refused.')}
   await log({kind:'register_decoder',call:index,family:decoder.family,verified:true,durationMs:Math.round(performance.now()-decodeStart)})
   registers[decoder.family]=decoded;await compareRegisters()
  }
  return r
 }) as typeof fetch
 try{
  await log({kind:'diagnostic_started',profile:'m76-hosted-baseline-diagnostic-v1',originalJournalSha256:hash(originalText),failedRecoveryJournalSha256:hash(failedText),failedRecoveryHead:FAILED_RECOVERY_HEAD,helperSha256:hash(await Bun.file('tools/staging/m76-hosted-recovery.ts').bytes()),diagnosticSha256:hash(await Bun.file(new URL(import.meta.url)).bytes()),mode:'baseline_observation_only',applicationWritesAllowed:false,legacyTransport:'cached_diagnostic_only'})
  const result=await runHostedRecovery(input,{fetch:observedFetch,load:async()=>null,loadOriginal:async()=>originalText,legacy:async(_input,d)=>{await d.save!({baseline:original.find(e=>e.kind==='baseline')!.data.legacy} as any);return {status:'passed',applicationPostRequests:0,allCreatedAuthSessionsClosed:true} as any},append:async(line:string,exclusive:boolean)=>{const event=JSON.parse(line);check(exclusive===(isolatedEvents===0));isolatedEvents++;if(event.kind==='failed_state_baseline')isolatedComplete=true;await log({kind:'isolated_helper_event',eventKind:event.kind,...(event.kind==='attempt_finished'?{observedStatus:event.data.status,stage:event.data.stage,applicationPostRequests:event.data.applicationPostRequests,allCreatedAuthSessionsClosed:event.data.allCreatedAuthSessionsClosed}:{})})}})
  check(applicationPosts===0&&result.applicationPostRequests===0)
  const unchanged=hash(await Bun.file(ORIGINAL).text())===hash(originalText)&&hash(await Bun.file(RECOVERY).text())===hash(failedText)
  const summary={kind:'diagnostic_finished',status:'read_only_observation',observedHelperStatus:result.status,observedHelperStage:result.stage,isolatedBaselineObservationCompleted:isolatedComplete,officialBaselineAccepted:false,applicationPostRequests:0,allCreatedAuthSessionsClosed:result.allCreatedAuthSessionsClosed,bothFailedJournalsUnchanged:unchanged,traceDurable,legacyTransport:'cached_diagnostic_only',durationMs:Math.round(performance.now()-started),tracePath:output}
  await log(summary);check(unchanged&&traceDurable&&result.allCreatedAuthSessionsClosed);return summary
 }finally{await file.close()}
}

if(import.meta.main){try{console.log(JSON.stringify(await diagnoseHostedBaseline(JSON.parse(await Bun.stdin.text()))))}catch{console.log(JSON.stringify({status:'read_only_diagnostic_refused',officialBaselineAccepted:false,applicationWritesAllowed:false}));process.exitCode=1}}
