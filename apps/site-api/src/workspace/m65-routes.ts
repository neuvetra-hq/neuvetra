import { M64_UUID, M65_MEDIA_TYPE, WorksheetReportValidationError, validateWorksheetReportInput, type WorkspaceDatabase } from "@neuvetra/database"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"
export function createWorksheetReportRoutes(deps:{database:WorkspaceDatabase;validateUser:(token:string)=>Promise<AuthenticatedUser|null>;origin:string}) {
 return async(request:Request):Promise<Response>=>{
  const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{"cache-control":"no-store"}})
  const match=/^\/workspace\/([^/]+)\/electricity-worksheet\/reports(?:\/([^/]+)(\/download)?)?$/.exec(new URL(request.url).pathname)
  if(!match || !M64_UUID.test(match[1]!) || (match[2]&&!M64_UUID.test(match[2])))return json(404,{error:"Report not found."})
  const companyId=match[1]!,reportId=match[2],download=Boolean(match[3]),origin=request.headers.get("origin")
  if((request.method!=="GET"&&origin!==deps.origin)||(origin&&origin!==deps.origin))return json(403,{error:"Forbidden."})
  const token=extractBearerToken(request.headers)
  if(!token)return json(401,{error:"Authentication required."})
  const actor=await deps.validateUser(token)
  if(!actor)return json(401,{error:"Authentication required."})
  try{
   if(request.method==="GET"){
    if(download){
     const found=await deps.database.downloadWorksheetReport(actor.id,companyId,reportId!)
     if(!found)return json(404,{error:"Report not found."})
     return new Response(Buffer.from(found.bytes),{status:200,headers:{"content-type":M65_MEDIA_TYPE,"content-disposition":`attachment; filename="neuvetra-worksheet-report-${found.report.id}.html"`,"content-length":String(found.bytes.byteLength),"x-report-sha256":found.report.reportSha256,"cache-control":"no-store","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-modals","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}})
    }
    const result=reportId?await deps.database.findWorksheetReport(actor.id,companyId,reportId):await deps.database.findWorksheetReports(actor.id,companyId)
    return result?json(200,result):json(404,{error:"Report not found."})
   }
   if(request.method!=="POST"||reportId)return json(405,{error:"Method not allowed."})
   if(!await deps.database.findWorkspace(actor.id,companyId))return json(404,{error:"Report not found."})
   if(!await deps.database.canManageWorkspace(actor.id,companyId))return json(403,{error:"Forbidden."})
   let body:unknown
   try{body=await request.json()}catch{return json(422,{error:"Invalid report request."})}
   return json(201,await deps.database.createWorksheetReport(actor.id,companyId,validateWorksheetReportInput(body)))
  }catch(error){
   if(error instanceof WorksheetReportValidationError)return json(422,{error:error.message})
   const code=(error as {code?:string})?.code
   if(code==="22023"||code==="22P02")return json(422,{error:"Invalid report request."})
   if(code==="23505")return json(409,{error:"Source or review changed. Reload the selected worksheet version."})
   if(code==="42501")return json(403,{error:"Forbidden."})
   return json(503,{error:"Report could not be verified."})
  }
 }
}
