import { M64_UUID, M66_MAX_SOURCE_BYTES, ElectricitySourceValidationError, type WorkspaceDatabase } from "@neuvetra/database"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"
export function createElectricitySourceRoutes(deps:{database:WorkspaceDatabase;validateUser:(token:string)=>Promise<AuthenticatedUser|null>;origin:string}) {
 return async(request:Request):Promise<Response>=>{
  const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{"cache-control":"no-store"}})
  const match=/^\/workspace\/([^/]+)\/source-electricity-worksheet\/sources(?:\/([^/]+)(\/download)?)?$/.exec(new URL(request.url).pathname)
  if(!match||!M64_UUID.test(match[1]!)||(match[2]&&!M64_UUID.test(match[2])))return json(404,{error:"Source not found."})
  const company=match[1]!,id=match[2],download=Boolean(match[3]),origin=request.headers.get("origin")
  if((request.method!=="GET"&&origin!==deps.origin)||(origin&&origin!==deps.origin))return json(403,{error:"Forbidden."})
  const token=extractBearerToken(request.headers);if(!token)return json(401,{error:"Authentication required."})
  const actor=await deps.validateUser(token);if(!actor)return json(401,{error:"Authentication required."})
  try{
   if(request.method==="GET"){
    if(download){const found=await deps.database.downloadElectricitySource(actor.id,company,id!);if(!found)return json(404,{error:"Source not found."});return new Response(Buffer.from(found.bytes),{headers:{"content-type":"application/pdf","content-disposition":'attachment; filename="'+found.source.originalName+'"',"content-length":String(found.bytes.byteLength),"x-source-sha256":found.source.sha256,"cache-control":"no-store","content-security-policy":"default-src 'none'; sandbox","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}})}
    const result=id?await deps.database.findElectricitySource(actor.id,company,id):await deps.database.findElectricitySources(actor.id,company);return result?json(200,result):json(404,{error:"Source not found."})
   }
   if(request.method!=="POST"||id)return json(405,{error:"Method not allowed."})
   if(!await deps.database.findWorkspace(actor.id,company))return json(404,{error:"Source not found."})
   if(!await deps.database.canManageWorkspace(actor.id,company))return json(403,{error:"Forbidden."})
   let form:FormData;try{form=await request.formData()}catch{return json(422,{error:"Choose a supported fictional bill PDF."})}
   if([...form.keys()].sort().join("|")!=="file|idempotencyKey")return json(422,{error:"Invalid source upload."})
   const file=form.get("file"),key=form.get("idempotencyKey")
   if(!(file instanceof File)||typeof key!=="string"||file.size<1||file.size>M66_MAX_SOURCE_BYTES)return json(422,{error:"Invalid source upload."})
   return json(201,await deps.database.uploadElectricitySource(actor.id,company,file.name,file.type,new Uint8Array(await file.arrayBuffer()),key))
  }catch(error){
   if(error instanceof ElectricitySourceValidationError)return json(422,{error:error.message})
   const code=(error as {code?:string})?.code;if(code==="22023"||code==="22P02")return json(422,{error:"Invalid source upload."});if(code==="23505")return json(409,{error:"Source upload request conflicts."});if(code==="42501")return json(403,{error:"Forbidden."});return json(503,{error:"Source could not be verified."})
  }
 }
}
