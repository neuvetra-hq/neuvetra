/** Existing synthetic tenant only. Private configuration is read from stdin; no credentials are logged. */
import { parseJourneyInput } from "./check-hosted-journey"
import { decodeElectricityWorksheet } from "../../apps/site-web/src/lib/m64-api"
import { decodeWorksheetReport } from "../../apps/site-web/src/lib/m65-api"
const HOST="https://www.neuvetra.ai", AUTH="https://icockcoguyadhryzydvl.supabase.co", BASELINE=".superpowers/m65-hosted-baseline.json", RECEIPT=".superpowers/m65-hosted-journey.json"
const mode=process.env.M65_CHECK_MODE
const tokens=new Map<string,string>(); let publicKey="", stage="configuration", failure=false, logoutFailed=false, writes=0
const stages:{name:string;status:number}[]=[]; let result:Record<string,unknown>={}
const valid=(v:unknown):void=>{if(!v)throw new Error("Bounded check failed")}
const sha=(s:string|Uint8Array)=>new Bun.CryptoHasher("sha256").update(s).digest("hex")
const stable=(v:unknown):string=>JSON.stringify(v && typeof v==="object" ? Array.isArray(v) ? v.map(x=>JSON.parse(stable(x))) : Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,JSON.parse(stable(x))])) : v)
try {
 valid(mode==="baseline"||mode==="exercise"||mode==="revisit")
 const input=parseJourneyInput(JSON.parse(await Bun.stdin.text()));publicKey=input.env.SUPABASE_ANON_KEY
 for(const account of input.accounts){stage=`sign_in_${account.role}`;const r=await fetch(AUTH+"/auth/v1/token?grant_type=password",{method:"POST",redirect:"error",headers:{apikey:publicKey,"content-type":"application/json"},body:JSON.stringify({email:account.email,password:account.password}),signal:AbortSignal.timeout(30000)});valid(r.ok);const s=await r.json() as {access_token:string;user:{id:string}};tokens.set(account.role,s.access_token);valid(s.user.id===account.id)}
 const root=`/workspace-api/workspace/${input.roster.workspaceId}`, path=root+"/electricity-worksheet"
 async function request(name:string,route:string,role="manager1",payload?:unknown,expected=200){stage=name;if(payload)writes++;const r=await fetch(HOST+route,{method:payload?"POST":"GET",redirect:"error",headers:{origin:HOST,...(tokens.has(role)?{authorization:`Bearer ${tokens.get(role)}`} : {}),...(payload?{"content-type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(30000)});stages.push({name,status:r.status});valid(r.status===expected);return r}
 const ready=await(await request("readiness","/ready")).json() as {schemaVersion:number;status:string};valid(ready.status==="ready"&&ready.schemaVersion===(mode==="baseline"?10:11))
 const worksheet=decodeElectricityWorksheet(await(await request("worksheet",path)).json(),input.roster.workspaceId)
 valid(worksheet.versions.length===4&&worksheet.versions[3]?.quantityKwh==="25000.000"&&worksheet.versions[3]?.total.display==="4876.0072")
 const annual=root+"/annual-inventories/c512c188-e9f5-497c-9edd-10b359b0140a"
 const original=await(await request("original_report",annual+"/draft-reports/current")).json() as {id:string;reportSha256:string}
 const decision=await(await request("original_review",annual+`/draft-reports/${original.id}/decisions/current`)).json() as {decisionSnapshotSha256:string}
 valid(original.reportSha256==="4d208e345e939a8e024839713b7aac61504c7bae77b630ceddace39e1a124014"&&decision.decisionSnapshotSha256==="38d027250a66451001de3c80ce7c707143f44b7d1d62a3a77179af1b734447ca")
 const snapshot={worksheet,originalReport:original,originalReview:decision}
 if(mode==="baseline"){valid(!await Bun.file(BASELINE).exists());await Bun.write(BASELINE,JSON.stringify({status:"baseline",capturedAt:new Date().toISOString(),snapshot},null,2)+"\n");result={baseline:BASELINE,versions:worksheet.versions.length}}
 else {
  const before=await Bun.file(BASELINE).json();valid(stable(before.snapshot)===stable(snapshot))
  await request("signed_out_reports",path+"/reports","signed_out",undefined,401)
  await request("outsider_reports",path+"/reports","outsider",undefined,403)
  const reportResults=[]
  for(const version of [worksheet.versions[3]!,worksheet.versions[1]!]){
   const payload={sourceVersionId:version.id,expectedInputSha256:version.inputSha256,expectedResultSha256:version.resultSha256,expectedReviewId:version.review?.id??null,expectedReviewSha256:version.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()}
   if(mode==="exercise"){
    await request("member_create_refused",path+"/reports","member",payload,403)
    const pair=await Promise.all([request("create_report",path+"/reports","manager1",payload,201),request("concurrent_report",path+"/reports","manager2",{...payload,idempotencyKey:crypto.randomUUID()},201)])
    const a=decodeWorksheetReport(await pair[0]!.json(),worksheet),b=decodeWorksheetReport(await pair[1]!.json(),worksheet);valid(a.id===b.id&&a.reportSha256===b.reportSha256)
   }
   const list=await(await request("member_reports",path+"/reports","member")).json() as {reports:unknown[]}
   const reports=list.reports.map(v=>decodeWorksheetReport(v,worksheet)).filter(r=>r.sourceVersionId===version.id&&r.reviewSha256===(version.review?.decisionSha256??null));valid(reports.length===1);const report=reports[0]!
   const read=decodeWorksheetReport(await(await request("report_metadata",path+`/reports/${report.id}`,"member")).json(),worksheet);valid(stable(read)===stable(report))
   const download=await request("report_bytes",path+`/reports/${report.id}/download`,"member");const bytes=new Uint8Array(await download.arrayBuffer());valid(bytes.length===report.reportByteLength&&sha(bytes)===report.reportSha256&&download.headers.get("cache-control")?.includes("no-store"));const html=new TextDecoder().decode(bytes);valid(html.includes(version.total.display)&&html.includes(version.quantityKwh)&&html.includes("No assurance"))
   await request("signed_out_download",path+`/reports/${report.id}/download`,"signed_out",undefined,401)
   await request("outsider_download",path+`/reports/${report.id}/download`,"outsider",undefined,403)
   reportResults.push({id:report.id,version:report.sourceVersion,reportSha256:report.reportSha256,reportByteLength:report.reportByteLength,reviewState:report.reviewState,reviewSha256:report.reviewSha256})
  }
  const after=decodeElectricityWorksheet(await(await request("worksheet_unchanged",path)).json(),input.roster.workspaceId);valid(stable(after)===stable(worksheet));result={reports:reportResults,originalAndWorksheetUnchanged:true}
 }
}catch{failure=true}
finally{for(const [role,token]of tokens){try{const r=await fetch(AUTH+"/auth/v1/logout?scope=local",{method:"POST",redirect:"error",headers:{apikey:publicKey,authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});stages.push({name:`logout_${role}`,status:r.status});if(r.status!==204){failure=true;logoutFailed=true}}catch{failure=true;logoutFailed=true}}}
const receipt={status:failure?"failed":"passed",mode,stage,createdAt:new Date().toISOString(),applicationPostRequests:writes,allCreatedAuthSessionsClosed:!logoutFailed,stages,...result}
const old=await Bun.file(RECEIPT).exists()?await Bun.file(RECEIPT).json():{attempts:[]};old.attempts.push(receipt);await Bun.write(RECEIPT,JSON.stringify(old,null,2)+"\n");console.log(JSON.stringify(receipt));if(failure)process.exitCode=1
