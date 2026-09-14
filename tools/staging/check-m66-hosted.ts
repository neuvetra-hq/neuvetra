/** Approved synthetic tenant only; credentials arrive on stdin and never enter receipts. */
import { parseJourneyInput } from "./check-hosted-journey"
import { decodeElectricityWorksheet } from "../../apps/site-web/src/lib/m64-api"
import { decodeWorksheetReport } from "../../apps/site-web/src/lib/m65-api"
import { decodeSourceElectricityWorksheet, decodeElectricitySource } from "../../apps/site-web/src/lib/m66-api"
import { decodeSourceWorksheetReport } from "../../apps/site-web/src/lib/m66-report-api"
import { M66_LIMITATIONS } from "../../packages/neuvetra-database/src/m66-contract"
const HOST="https://www.neuvetra.ai", AUTH="https://icockcoguyadhryzydvl.supabase.co"
const BASELINE=".superpowers/m66-hosted-baseline.json", RECEIPT=".superpowers/m66-hosted-journey.json", mode=process.env.M66_CHECK_MODE
const tokens=new Map<string,string>();let publicKey="",stage="configuration",failed=false,logoutFailed=false,writes=0
const stages:{name:string;status:number}[]=[];let result:Record<string,unknown>={}
const valid=(v:unknown):void=>{if(!v)throw new Error("Bounded check failed")}
const sha=(v:Uint8Array)=>new Bun.CryptoHasher("sha256").update(v).digest("hex")
const stable=(v:unknown):string=>JSON.stringify(v&&typeof v==="object"?Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,JSON.parse(stable(x))])):v)
try{
 valid(mode==="baseline"||mode==="exercise"||mode==="revisit")
 const input=parseJourneyInput(JSON.parse(await Bun.stdin.text()));publicKey=input.env.SUPABASE_ANON_KEY
 for(const account of input.accounts){stage=`sign_in_${account.role}`;const r=await fetch(AUTH+"/auth/v1/token?grant_type=password",{method:"POST",redirect:"error",headers:{apikey:publicKey,"content-type":"application/json"},body:JSON.stringify({email:account.email,password:account.password}),signal:AbortSignal.timeout(30000)});valid(r.ok);const s=await r.json() as {access_token:string;user:{id:string}};valid(s.user.id===account.id);tokens.set(account.role,s.access_token)}
 const company=input.roster.workspaceId,root=`/workspace-api/workspace/${company}`,path=root+"/source-electricity-worksheet"
 async function request(name:string,route:string,role="manager1",payload?:unknown,expected=200){stage=name;if(payload)writes++;const form=payload instanceof FormData;const r=await fetch(HOST+route,{method:payload?"POST":"GET",redirect:"error",headers:{origin:HOST,...(tokens.has(role)?{authorization:`Bearer ${tokens.get(role)}`} : {}),...(payload&&!form?{"content-type":"application/json"}:{})},body:form?payload:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(30000)});stages.push({name,status:r.status});valid(r.status===expected);return r}
 const ready=await(await request("readiness","/ready")).json() as {schemaVersion:number;status:string};valid(ready.status==="ready"&&ready.schemaVersion===(mode==="baseline"?11:12))
 const oldWorksheet=decodeElectricityWorksheet(await(await request("original_worksheet",root+"/electricity-worksheet")).json(),company)
 valid(oldWorksheet.versions.length===4&&oldWorksheet.versions[3]?.quantityKwh==="25000.000")
 const oldReports=(await(await request("original_report_list",root+"/electricity-worksheet/reports")).json() as {reports:unknown[]}).reports.map(v=>decodeWorksheetReport(v,oldWorksheet))
 valid(oldReports.length===2)
 for(const r of oldReports){const b=new Uint8Array(await(await request("original_report_bytes",root+`/electricity-worksheet/reports/${r.id}/download`)).arrayBuffer());valid(b.length===r.reportByteLength&&sha(b)===r.reportSha256)}
 const annual=root+"/annual-inventories/c512c188-e9f5-497c-9edd-10b359b0140a"
 const original=await(await request("original_m63_report",annual+"/draft-reports/current")).json() as {id:string;reportSha256:string}
 const decision=await(await request("original_m63_review",annual+`/draft-reports/${original.id}/decisions/current`)).json() as {decisionSnapshotSha256:string}
 valid(original.reportSha256==="4d208e345e939a8e024839713b7aac61504c7bae77b630ceddace39e1a124014"&&decision.decisionSnapshotSha256==="38d027250a66451001de3c80ce7c707143f44b7d1d62a3a77179af1b734447ca")
 const snapshot={oldWorksheet,oldReports,original,decision}
 if(mode==="baseline"){
  valid(!await Bun.file(BASELINE).exists());await Bun.write(BASELINE,JSON.stringify({capturedAt:new Date().toISOString(),snapshot},null,2)+"\n");result={baseline:BASELINE}
 }else{
  valid(stable((await Bun.file(BASELINE).json()).snapshot)===stable(snapshot))
  await request("signed_out_sources",path+"/sources","signed_out",undefined,401)
  await request("outsider_sources",path+"/sources","outsider",undefined,403)
  let worksheet=decodeSourceElectricityWorksheet(await(await request("source_worksheet",path)).json(),company)
  if(mode==="exercise"){
   valid(worksheet.versions.length===0)
   const sources=[]
   for(const file of ["neuvetra-m55-synthetic-electricity-bill.pdf","neuvetra-m66-synthetic-electricity-bill-b.pdf"]){
    const form=new FormData();form.append("file",new Blob([await Bun.file(`output/pdf/${file}`).arrayBuffer()],{type:"application/pdf"}),file);form.append("idempotencyKey",crypto.randomUUID())
    await request("member_upload_refused",path+"/sources","member",form,403)
    const source=decodeElectricitySource(await(await request("upload",path+"/sources","manager1",form,201)).json(),company)
    const retry=decodeElectricitySource(await(await request("upload_retry",path+"/sources","manager1",form,201)).json(),company);valid(source.id===retry.id);sources.push(source)
   }
   const first=sources[0]!,second=sources[1]!
   const entry={companyLabel:"Synthetic Cedar Ltd",facilityLabel:"Synthetic California office",quantityKwh:"12345.000",period:"2023-01",geography:"CAMX",unit:"kWh",sourceId:first.id,expectedSourceSha256:first.sha256,sourcePage:1,manualConfirmation:true,quantityDifferenceReason:null,idempotencyKey:crypto.randomUUID()}
   worksheet=decodeSourceElectricityWorksheet(await(await request("save_initial",path,"manager1",entry,201)).json(),company)
   const initial=worksheet.versions[0]!;valid(initial.quantityKwh==="12345.000")
   worksheet=decodeSourceElectricityWorksheet(await(await request("review_initial",path+"/reviews","manager2",{versionId:initial.id,expectedResultSha256:initial.resultSha256,decision:"accept_bounded_internal_draft",note:null,acknowledgedLimitations:M66_LIMITATIONS,idempotencyKey:crypto.randomUUID()},201)).json(),company)
   const reviewed=worksheet.versions[0]!
   const reportInput=(v:typeof reviewed)=>({sourceVersionId:v.id,expectedInputSha256:v.inputSha256,expectedResultSha256:v.resultSha256,expectedReviewId:v.review?.id??null,expectedReviewSha256:v.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()})
   decodeSourceWorksheetReport(await(await request("capture_initial",path+"/reports","manager1",reportInput(reviewed),201)).json(),worksheet)
   worksheet=decodeSourceElectricityWorksheet(await(await request("replace_source_only",path+"/corrections","manager1",{...entry,sourceId:second.id,expectedSourceSha256:second.sha256,expectedVersionId:reviewed.id,expectedResultSha256:reviewed.resultSha256,correctionReason:"Testing replacement with alternate fictional bill B; quantity unchanged.",idempotencyKey:crypto.randomUUID()},201)).json(),company)
   const current=worksheet.versions[1]!;valid(current.review===null&&current.quantityKwh===reviewed.quantityKwh&&current.inputSha256!==reviewed.inputSha256&&current.resultSha256!==reviewed.resultSha256)
   decodeSourceWorksheetReport(await(await request("capture_replacement",path+"/reports","manager1",reportInput(current),201)).json(),worksheet)
  }
  valid(worksheet.versions.length>=2&&worksheet.versions[0]?.review?.decision==="accept_bounded_internal_draft"&&worksheet.versions[1]?.review===null)
  const sourceList=await(await request("member_source_list",path+"/sources","member")).json() as {sources:unknown[]}
  const sources=sourceList.sources.map(s=>decodeElectricitySource(s,company));valid(sources.length===2)
  for(const source of sources){
   valid(stable(decodeElectricitySource(await(await request("source_metadata",path+`/sources/${source.id}`,"member")).json(),company))===stable(source))
   const r=await request("source_bytes",path+`/sources/${source.id}/download`,"member");const b=new Uint8Array(await r.arrayBuffer());valid(b.length===source.byteLength&&sha(b)===source.sha256&&r.headers.get("cache-control")?.includes("no-store"))
   await request("outsider_source_bytes",path+`/sources/${source.id}/download`,"outsider",undefined,403)
  }
  const reports=(await(await request("source_report_list",path+"/reports","member")).json() as {reports:unknown[]}).reports.map(r=>decodeSourceWorksheetReport(r,worksheet));valid(reports.length>=2)
  for(const report of reports){const r=await request("source_report_bytes",path+`/reports/${report.id}/download`,"member");const b=new Uint8Array(await r.arrayBuffer());valid(b.length===report.reportByteLength&&sha(b)===report.reportSha256&&new TextDecoder().decode(b).includes(report.source.evidence.source.sha256));await request("outsider_report_bytes",path+`/reports/${report.id}/download`,"outsider",undefined,403)}
  if(mode==="revisit"){
   const history=await Bun.file(RECEIPT).json();const prior=history.attempts.filter((a:any)=>a.status==="passed"&&a.worksheet).at(-1)
   valid(prior)
   for(const version of prior.worksheet.versions)valid(stable(worksheet.versions.find(v=>v.id===version.id))===stable(version))
   for(const report of prior.reports)valid(stable(reports.find(r=>r.id===report.id))===stable(report))
   for(const source of prior.sources)valid(stable(sources.find(s=>s.id===source.id))===stable(source))
  }
  result={preservedM63M64M65:true,worksheet,sources,reports}
 }
}catch{failed=true}
finally{for(const [role,token]of tokens){try{const r=await fetch(AUTH+"/auth/v1/logout?scope=local",{method:"POST",redirect:"error",headers:{apikey:publicKey,authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});stages.push({name:`logout_${role}`,status:r.status});if(r.status!==204){failed=true;logoutFailed=true}}catch{failed=true;logoutFailed=true}}}
const receipt={status:failed?"failed":"passed",mode,stage,createdAt:new Date().toISOString(),applicationPostRequests:writes,allCreatedAuthSessionsClosed:!logoutFailed,stages,...result}
const history=await Bun.file(RECEIPT).exists()?await Bun.file(RECEIPT).json():{attempts:[]};history.attempts.push(receipt);await Bun.write(RECEIPT,JSON.stringify(history,null,2)+"\n");console.log(JSON.stringify({status:receipt.status,mode,stage,applicationPostRequests:writes,allCreatedAuthSessionsClosed:!logoutFailed,stages}));if(failed)process.exitCode=1
