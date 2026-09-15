/** Independent read-only hosted checks through the actual browser response decoders. */
import { fileURLToPath } from 'node:url'
import * as browser from '../../apps/site-web/src/lib/workspace-api'
import { decodeStagingAccess, decodeStagingConfig } from '../../apps/site-web/src/lib/staging-session'
import { parseJourneyInput, saveJourneyReceipt } from './check-hosted-journey'
const HOST='https://www.neuvetra.ai', AUTH='https://icockcoguyadhryzydvl.supabase.co'
const RECEIPT=fileURLToPath(new URL('../../.superpowers/m63-browser-contract.json',import.meta.url))
const JOURNEY=fileURLToPath(new URL('../../.superpowers/m63-hosted-journey.json',import.meta.url))
const DECODER=fileURLToPath(new URL('../../apps/site-web/src/lib/workspace-api.ts',import.meta.url))
const hash=(value:Uint8Array|string)=>new Bun.CryptoHasher('sha256').update(value).digest('hex')
function valid(value:unknown):asserts value{if(!value)throw new Error('Browser contract check failed')}
type Snapshot={bytes:Uint8Array;status:number;headers:[string,string][]}
type Input=ReturnType<typeof parseJourneyInput>
type Stage={actor:string;stage:string;httpStatus:number|null}

/** Explicit caller only. Test dependencies never weaken live target/method restrictions. */
export async function checkBrowserContract(input:Input,baseline:any,transport:typeof fetch=fetch){
 let stage='configuration',actorName='none',httpStatus:number|null=null,applicationRequests=0
 const stages:Stage[]=[],actors:any[]=[],tokens=new Map<string,string>(),logouts:any[]=[]
 const initialDecoderSha256=hash(await Bun.file(DECODER).bytes())
 let outcome:any
 try{
  valid(baseline&&baseline.workspaceId===input.roster.workspaceId)
  const publicResponse=await transport(HOST+'/workspace-api/config',{redirect:'error',signal:AbortSignal.timeout(30000)})
  httpStatus=publicResponse.status;valid(publicResponse.ok&&publicResponse.headers.get('cache-control')?.includes('no-store'))
  const publicConfig=decodeStagingConfig(await publicResponse.json())
  valid(publicConfig.supabaseUrl===AUTH&&publicConfig.anonKey===input.env.SUPABASE_ANON_KEY)
  for(const role of ['manager1','member'] as const){
   actorName=role;stage='real_auth';httpStatus=null
   const account=input.accounts.find(a=>a.role===role);valid(account)
   const auth=await transport(AUTH+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:input.env.SUPABASE_ANON_KEY,'content-type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})})
   httpStatus=auth.status;valid(auth.ok)
   const session=await auth.json() as any;valid(session.user?.id===account.id&&typeof session.access_token==='string'&&session.access_token.length<=8192)
   const token=session.access_token as string;tokens.set(role,token)
   const snapshots=new Map<string,Snapshot>(),visited:string[]=[],counterexamples:string[]=[]
   const realGet=(async(request,init)=>{
    valid(typeof request==='string'&&/^\/workspace-api\/[a-zA-Z0-9_\-/]+$/.test(request)&&(!init?.method||init.method==='GET')&&init?.body===undefined)
    valid(new Headers(init?.headers).get('authorization')===`Bearer ${token}`)
    applicationRequests++
    const response=await transport(HOST+request,{...init,method:'GET',redirect:'error',signal:AbortSignal.timeout(30000),headers:{...Object.fromEntries(new Headers(init?.headers)),origin:HOST}})
    httpStatus=response.status;stages.push({actor:role,stage,httpStatus})
    valid(response.headers.get('cache-control')?.includes('no-store')&&response.status===200)
    const bytes=new Uint8Array(await response.arrayBuffer());valid(bytes.byteLength<=2_000_000)
    snapshots.set(request,{bytes,status:response.status,headers:[...response.headers]});visited.push(request)
    return new Response(bytes,{status:response.status,headers:response.headers})
   }) as typeof fetch
   const headers={authorization:`Bearer ${token}`}
   stage='frontend_session'
   const access=decodeStagingAccess(await (await realGet('/workspace-api/session',{headers})).json(),account.id)
   valid(access.access.workspaceId===input.roster.workspaceId&&access.access.evidenceId===baseline.billId)
   valid(role==='member'?access.access.role==='member':['owner','admin'].includes(access.access.role))
   const actor:browser.HostedWorkspaceActor={accessToken:token,userId:account.id,role:access.access.role}
   const workspaceId=input.roster.workspaceId,evidenceId=access.access.evidenceId!
   stage='frontend_workspace';const workspace=await browser.revisitSyntheticWorkspace(workspaceId,actor,realGet);valid(workspace.id===workspaceId)
   stage='frontend_bill_calculation';const bill=await browser.revisitSyntheticBill(workspaceId,evidenceId,actor,realGet);valid(bill.draftCalculation&&bill.id===baseline.billId&&bill.companyId===workspaceId)
   const billPath=visited[visited.length-1]!,rawBill=JSON.parse(new TextDecoder().decode(snapshots.get(billPath)!.bytes)),rawCalculation=rawBill.draftCalculation
   const orderDiagnosis={totalStringifyEqual:JSON.stringify(rawCalculation.record.result.total)===JSON.stringify(rawCalculation.total),gasResultsStringifyEqual:JSON.stringify(rawCalculation.record.result.gas_results)===JSON.stringify(rawCalculation.gasResults),traceStringifyEqual:JSON.stringify(rawCalculation.record.result.trace)===JSON.stringify(rawCalculation.trace)}
   stage='frontend_predecessor_inventory';const predecessor=await browser.revisitSyntheticInventory(workspaceId,actor,realGet)
   stage='frontend_both_registers';const registers=await browser.revisitAnnualRegisters(workspaceId,predecessor,actor,realGet);valid(registers.length===2)
   const register=registers.find(r=>r.version===2);valid(register)
   stage='frontend_annual_inventory';const annual=await browser.revisitAnnualInventory(workspaceId,register,actor,realGet);valid(annual.id===baseline.inventoryId&&annual.snapshotSha256===baseline.inventorySnapshotSha256&&annual.releaseEligible===false)
   stage='frontend_evidence_pack';const pack=await browser.revisitEvidencePack(annual,actor,realGet);valid(pack.id===baseline.packId&&pack.archiveSha256===baseline.archiveSha256&&pack.manifestSha256===baseline.manifestSha256&&pack.lineageRootSha256===baseline.lineageRootSha256)
   stage='frontend_archive_download';const archive=await browser.downloadEvidencePack(pack,actor,realGet);valid(hash(new Uint8Array(await archive.arrayBuffer()))===baseline.archiveSha256)
   stage='frontend_draft_report';const report=await browser.revisitDraftInventoryReport(annual,pack,actor,realGet);valid(report&&report.id===baseline.reportId&&report.reportSha256===baseline.reportSha256)
   stage='frontend_report_download';const reportFile=await browser.downloadDraftInventoryReport(report,actor,realGet);valid(hash(new Uint8Array(await reportFile.arrayBuffer()))===baseline.reportSha256)
   stage='frontend_second_manager_review';const review=await browser.revisitDraftInventoryReportReview(report,actor,realGet);valid(review&&review.id===baseline.reviewId&&review.decisionSnapshotSha256===baseline.decisionSnapshotSha256&&review.decidedBy!==report.createdBy&&review.releaseEligible===false)

   // Counterexamples alter in-memory copies only; no further requests or application writes.
   let counterResponseProduced=false
   const altered=(mutate:(body:any)=>void,bytes=false)=>(async(request:any,init:any)=>{
    valid(typeof request==='string'&&(!init?.method||init.method==='GET')&&snapshots.has(request))
    const saved=snapshots.get(request)!;let value:Uint8Array
    if(bytes){value=saved.bytes.slice();value[0]=value[0]!^1}else{const body=JSON.parse(new TextDecoder().decode(saved.bytes));mutate(body);value=new TextEncoder().encode(JSON.stringify(body))}
    counterResponseProduced=true;return new Response(new Uint8Array(value).buffer,{status:saved.status,headers:saved.headers})
   }) as typeof fetch
   const rejects=async(name:string,operation:()=>Promise<unknown>)=>{stage=`counterexample_${name}`;counterResponseProduced=false;let rejected=false;try{await operation()}catch{rejected=true}valid(rejected&&counterResponseProduced);counterexamples.push(name)}
   await rejects('workspace_year',()=>browser.revisitSyntheticWorkspace(workspaceId,actor,altered(v=>{v.boundary.reportingYear=2024})))
   await rejects('bill_record_value',()=>browser.revisitSyntheticBill(workspaceId,evidenceId,actor,altered(v=>{v.draftCalculation.record.result.total.unrounded='0'})))
   await rejects('bill_record_extra_key',()=>browser.revisitSyntheticBill(workspaceId,evidenceId,actor,altered(v=>{v.draftCalculation.record.result.total.unrecognized=true})))
   await rejects('bill_trace_array_order',()=>browser.revisitSyntheticBill(workspaceId,evidenceId,actor,altered(v=>{v.draftCalculation.record.result.trace.reverse()})))
   await rejects('predecessor_release',()=>browser.revisitSyntheticInventory(workspaceId,actor,altered(v=>{v.releaseEligible=true})))
   await rejects('register_excluded_quantity',()=>browser.revisitAnnualRegisters(workspaceId,predecessor,actor,altered(v=>{v.find((r:any)=>r.version===2).periods.find((p:any)=>p.state==='excluded').quantityMwh='0'})))
   await rejects('annual_release',()=>browser.revisitAnnualInventory(workspaceId,register,actor,altered(v=>{v.releaseEligible=true})))
   await rejects('archive_length',()=>browser.revisitEvidencePack(annual,actor,altered(v=>{v.archiveByteLength=-1})))
   await rejects('report_source_binding',()=>browser.revisitDraftInventoryReport(annual,pack,actor,altered(v=>{v.sourceArchiveSha256='0'.repeat(64)})))
   await rejects('review_self_approval',()=>browser.revisitDraftInventoryReportReview(report,actor,altered(v=>{v.decidedBy=v.reportCreatedBy})))
   await rejects('archive_byte_corruption',()=>browser.downloadEvidencePack(pack,actor,altered(()=>{},true)))
   await rejects('report_byte_corruption',()=>browser.downloadDraftInventoryReport(report,actor,altered(()=>{},true)))
   actors.push({role,frontendStagesPassed:11,originalComparisonDiagnosis:orderDiagnosis,malformedResponsesRefused:counterexamples,baselineHashesMatched:true,archiveSha256:pack.archiveSha256,reportSha256:report.reportSha256,decisionSnapshotSha256:review.decisionSnapshotSha256})
  }
  stage='source_stability';valid(hash(await Bun.file(DECODER).bytes())===initialDecoderSha256)
  outcome={status:'browser_contract_passed',actors}
 }catch(error){const stack=error instanceof Error?error.stack??'':'';const line=stack.match(/workspace-api\.ts:(\d+):(\d+)/);outcome={status:'browser_contract_failed',actor:actorName,stage,httpStatus,decoderLocation:line?{line:Number(line[1]),column:Number(line[2])}:null,actors}}
 finally{for(const [role,token] of tokens){let status:number|null=null;try{const response=await transport(AUTH+'/auth/v1/logout?scope=local',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:input.env.SUPABASE_ANON_KEY,authorization:`Bearer ${token}`}});status=response.status;await response.body?.cancel()}catch{}logouts.push({role,httpStatus:status})}tokens.clear()}
 outcome.applicationPostRequests=0;outcome.applicationGetRequests=applicationRequests;outcome.decoderSourceSha256=initialDecoderSha256;outcome.stages=stages;outcome.authLogouts=logouts;outcome.authLogoutAcknowledged=logouts.length>0&&logouts.every(l=>l.httpStatus===204);outcome.observedAt=new Date().toISOString()
 if(outcome.status==='browser_contract_passed'&&(!outcome.authLogoutAcknowledged||logouts.length!==2))outcome.status='browser_contract_auth_cleanup_failed'
 return outcome
}
if(import.meta.main){
 try{
  const raw=await Bun.stdin.text();valid(Buffer.byteLength(raw)<=128000);const input=parseJourneyInput(JSON.parse(raw))
  const journey=await Bun.file(JOURNEY).json();valid(journey.schemaVersion===1&&journey.host===HOST&&journey.runs.some((r:any)=>r.status==='passed'))
  const outcome=await checkBrowserContract(input,journey.baseline)
  const prior=await Bun.file(RECEIPT).exists()?await Bun.file(RECEIPT).json():{runs:[]};valid(Array.isArray(prior.runs))
  await saveJourneyReceipt({schemaVersion:1,scope:'real hosted GET responses through actual frontend decoders; corrupted counterexamples in memory only; no browser rendering or application mutations',runs:[...prior.runs,outcome]},RECEIPT)
  console.log(JSON.stringify({status:outcome.status,stage:outcome.stage,actor:outcome.actor,decoderLocation:outcome.decoderLocation,actors:outcome.actors.length,applicationPostRequests:0,applicationGetRequests:outcome.applicationGetRequests,authLogoutAcknowledged:outcome.authLogoutAcknowledged}))
  if(outcome.status!=='browser_contract_passed')process.exitCode=1
 }catch{console.log(JSON.stringify({status:'browser_contract_failed',stage:'configuration_or_receipt'}));process.exitCode=1}
}
