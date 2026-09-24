import { m71Uuid, parseM71Json, validateM71Save, validateM71Review, M71ValidationError, m71Export, type WorkspaceDatabase } from "@neuvetra/database"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"
export function createCorporateInventoryRoutes(deps:{database:WorkspaceDatabase;validateUser:(token:string)=>Promise<AuthenticatedUser|null>;origin:string}){
 return async(request:Request):Promise<Response>=>{
  const respond=(status:number,body:unknown)=>Response.json(body,{status,headers:{"cache-control":"no-store"}})
  const match=/^\/workspace\/([^/]+)\/corporate-inventories(?:\/([^/]+)(?:\/(versions|reviews)(?:\/([^/]+)(?:\/(coverage-export))?)?)?)?$/.exec(new URL(request.url).pathname)
  if(!match||!m71Uuid(match[1])||(match[2]&&!m71Uuid(match[2]))||(match[4]&&!m71Uuid(match[4])))return respond(404,{error:"Coverage register not found."})
  const [,companyId,inventoryId,action,versionId,download]=match
  const origin=request.headers.get("origin");if((request.method!=="GET"&&origin!==deps.origin)||(origin&&origin!==deps.origin))return respond(403,{error:"Forbidden."})
  const token=extractBearerToken(request.headers);if(!token)return respond(401,{error:"Authentication required."});const actor=await deps.validateUser(token);if(!actor)return respond(401,{error:"Authentication required."})
  try{
   const register=await deps.database.findCorporateInventory(actor.id,companyId!)
   if(!register||(inventoryId&&register.inventoryId!==inventoryId))return respond(404,{error:"Coverage register not found."})
   if(request.method==="GET"){
    if(!action)return respond(200,register)
    if(action!=="versions"||!versionId)return respond(404,{error:"Coverage register not found."})
    const v=register.versions.find(v=>v.id===versionId);if(!v)return respond(404,{error:"Coverage register not found."})
    if(download)return new Response(m71Export(v),{headers:{"cache-control":"no-store","content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="synthetic-corporate-coverage-v${v.version}.json"`}})
    return respond(200,v)
   }
   if(request.method!=="POST"||versionId||download)return respond(405,{error:"Method not allowed."})
   if(!await deps.database.canManageWorkspace(actor.id,companyId!))return respond(403,{error:"Forbidden."})
   const body=parseM71Json(await request.text())
   if(action==="reviews"&&inventoryId)return respond(201,await deps.database.reviewCorporateInventory(actor.id,companyId!,inventoryId,validateM71Review(body)))
   if((inventoryId&&action!=="versions")||(!inventoryId&&action))return respond(404,{error:"Coverage register not found."})
   const input=validateM71Save(body);if(Boolean(inventoryId)!==Boolean(input.expectedVersionId))return respond(422,{error:"Expected version binding is required for a correction."})
   return respond(201,await deps.database.saveCorporateInventory(actor.id,companyId!,inventoryId??null,input))
  }catch(error){if(error instanceof M71ValidationError)return respond(422,{error:error.message});const code=(error as {code?:string})?.code;if(code==="22023"||code==="22P02"||code==="22007"||code==="22008")return respond(422,{error:"Invalid coverage request."});if(code==="54001")return respond(422,{error:"This synthetic demo has reached its saved-history size limit. Existing versions remain readable and exportable.",code:"history_bytes_limit"});if(code==="54000")return respond(422,{error:"This synthetic demo is limited to 40 saved versions. Existing versions remain readable and exportable.",code:"history_limit"});if(code==="23505")return respond(409,{error:"Coverage changed or request conflicts. Reload the saved version."});if(code==="42501")return respond(403,{error:"Forbidden."});return respond(503,{error:"Corporate coverage could not be verified."})}
 }
}
