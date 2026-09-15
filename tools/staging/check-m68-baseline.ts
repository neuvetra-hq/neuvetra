/** Approved synthetic tenant only; credentials arrive on stdin and never enter receipts. */
import { parseJourneyInput } from "./check-hosted-journey"
import { decodeElectricityWorksheet } from "../../apps/site-web/src/lib/m64-api"
import { decodeWorksheetReport } from "../../apps/site-web/src/lib/m65-api"
import { decodeSourceElectricityWorksheet, decodeElectricitySource } from "../../apps/site-web/src/lib/m66-api"
import { decodeSourceWorksheetReport } from "../../apps/site-web/src/lib/m66-report-api"
import { decodeAnnualElectricityWorksheet } from "../../apps/site-web/src/lib/m67-api"
import { decodeAnnualWorksheetReport } from "../../apps/site-web/src/lib/m67-report-api"
const HOST="https://www.neuvetra.ai", AUTH="https://icockcoguyadhryzydvl.supabase.co"
const BASELINE=".superpowers/m68-hosted-baseline.json", RECEIPT=".superpowers/m68-hosted-baseline-journey.json", mode="baseline"
const tokens=new Map<string,string>();let publicKey="",stage="configuration",failed=false,logoutFailed=false,writes=0
const stages:{name:string;status:number}[]=[];let result:Record<string,unknown>={}
const valid=(v:unknown):void=>{if(!v)throw new Error("Bounded check failed")}
const sha=(v:Uint8Array)=>new Bun.CryptoHasher("sha256").update(v).digest("hex")
const stable=(v:unknown):string=>JSON.stringify(v&&typeof v==="object"?Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,JSON.parse(stable(x))])):v)
try{
 valid(mode==="baseline")
 const input=parseJourneyInput(JSON.parse(await Bun.stdin.text()));publicKey=input.env.SUPABASE_ANON_KEY
 for(const account of input.accounts){stage=`sign_in_${account.role}`;const r=await fetch(AUTH+"/auth/v1/token?grant_type=password",{method:"POST",redirect:"error",headers:{apikey:publicKey,"content-type":"application/json"},body:JSON.stringify({email:account.email,password:account.password}),signal:AbortSignal.timeout(30000)});valid(r.ok);const s=await r.json() as {access_token:string;user:{id:string}};valid(s.user.id===account.id);tokens.set(account.role,s.access_token)}
 const company=input.roster.workspaceId,root=`/workspace-api/workspace/${company}`,path=root+"/annual-electricity-worksheet"
 async function request(name:string,route:string,role="manager1",payload?:unknown,expected=200){stage=name;if(payload)writes++;const form=payload instanceof FormData;const r=await fetch(HOST+route,{method:payload?"POST":"GET",redirect:"error",headers:{origin:HOST,...(tokens.has(role)?{authorization:`Bearer ${tokens.get(role)}`} : {}),...(payload&&!form?{"content-type":"application/json"}:{})},body:form?payload:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(30000)});stages.push({name,status:r.status});valid(r.status===expected);return r}
 const ready=await(await request("readiness","/ready")).json() as {schemaVersion:number;status:string};valid(ready.status==="ready"&&ready.schemaVersion===13)
 const oldWorksheet=decodeElectricityWorksheet(await(await request("original_worksheet",root+"/electricity-worksheet")).json(),company)
 valid(oldWorksheet.versions.length===4&&oldWorksheet.versions[3]?.quantityKwh==="25000.000")
 const oldReports=(await(await request("original_report_list",root+"/electricity-worksheet/reports")).json() as {reports:unknown[]}).reports.map(v=>decodeWorksheetReport(v,oldWorksheet))
 valid(oldReports.length===2)
 for(const r of oldReports){const b=new Uint8Array(await(await request("original_report_bytes",root+`/electricity-worksheet/reports/${r.id}/download`)).arrayBuffer());valid(b.length===r.reportByteLength&&sha(b)===r.reportSha256)}
 const annual=root+"/annual-inventories/c512c188-e9f5-497c-9edd-10b359b0140a"
 const original=await(await request("original_m63_report",annual+"/draft-reports/current")).json() as {id:string;reportSha256:string}
 const decision=await(await request("original_m63_review",annual+`/draft-reports/${original.id}/decisions/current`)).json() as {decisionSnapshotSha256:string}
 valid(original.reportSha256==="4d208e345e939a8e024839713b7aac61504c7bae77b630ceddace39e1a124014"&&decision.decisionSnapshotSha256==="38d027250a66451001de3c80ce7c707143f44b7d1d62a3a77179af1b734447ca")
 const sourcePath=root+"/source-electricity-worksheet"
 const oldSourceWorksheet=decodeSourceElectricityWorksheet(await(await request("preserved_m66_worksheet",sourcePath)).json(),company)
 valid(oldSourceWorksheet.versions.length===3)
 const oldSources=(await(await request("preserved_m66_sources",sourcePath+"/sources")).json() as {sources:unknown[]}).sources.map(s=>decodeElectricitySource(s,company))
 valid(oldSources.length===2)
 for(const source of oldSources){const b=new Uint8Array(await(await request("preserved_m66_source_bytes",sourcePath+`/sources/${source.id}/download`)).arrayBuffer());valid(b.length===source.byteLength&&sha(b)===source.sha256)}
 const oldSourceReports=(await(await request("preserved_m66_reports",sourcePath+"/reports")).json() as {reports:unknown[]}).reports.map(r=>decodeSourceWorksheetReport(r,oldSourceWorksheet))
 valid(oldSourceReports.length===3)
 for(const report of oldSourceReports){const b=new Uint8Array(await(await request("preserved_m66_report_bytes",sourcePath+`/reports/${report.id}/download`)).arrayBuffer());valid(b.length===report.reportByteLength&&sha(b)===report.reportSha256)}
 const oldAnnual=decodeAnnualElectricityWorksheet(await(await request("preserved_m67_annual",path)).json(),company)
 valid(oldAnnual.versions.length===4 && oldAnnual.versions[3].quantityKwh==="301000.000" && oldAnnual.versions[3].total.display==="58707.1269" && oldAnnual.versions[3].review===null)
 const oldAnnualReports=(await(await request("preserved_m67_reports",path+"/reports")).json() as {reports:unknown[]}).reports.map(r=>decodeAnnualWorksheetReport(r,oldAnnual))
 valid(oldAnnualReports.length===3)
 for(const report of oldAnnualReports){const b=new Uint8Array(await(await request("preserved_m67_report_bytes",path+`/reports/${report.id}/download`)).arrayBuffer());valid(b.length===report.reportByteLength&&sha(b)===report.reportSha256)}
 const snapshot={oldWorksheet,oldReports,original,decision,oldSourceWorksheet,oldSources,oldSourceReports,oldAnnual,oldAnnualReports}
 valid(!await Bun.file(BASELINE).exists());await Bun.write(BASELINE,JSON.stringify({capturedAt:new Date().toISOString(),snapshot},null,2)+"\n");result={baseline:BASELINE}
}catch{failed=true}
finally{for(const [role,token]of tokens){try{const r=await fetch(AUTH+"/auth/v1/logout?scope=local",{method:"POST",redirect:"error",headers:{apikey:publicKey,authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});stages.push({name:`logout_${role}`,status:r.status});if(r.status!==204){failed=true;logoutFailed=true}}catch{failed=true;logoutFailed=true}}}
const receipt={status:failed?"failed":"passed",mode,stage,createdAt:new Date().toISOString(),applicationPostRequests:writes,allCreatedAuthSessionsClosed:!logoutFailed,stages,...result}
const history=await Bun.file(RECEIPT).exists()?await Bun.file(RECEIPT).json():{attempts:[]};history.attempts.push(receipt);await Bun.write(RECEIPT,JSON.stringify(history,null,2)+"\n");console.log(JSON.stringify({status:receipt.status,mode,stage,applicationPostRequests:writes,allCreatedAuthSessionsClosed:!logoutFailed,stages}));if(failed)process.exitCode=1
