import {m71Uuid,parseM71Json,M73ValidationError,validateM73Save,validateM73Review,validateM73Report,m73Export,type WorkspaceDatabase,type M73Authority} from '@neuvetra/database'
import {extractBearerToken,type AuthenticatedUser} from '../lib/auth'
export function createM73Routes(deps:{database:WorkspaceDatabase;validateUser:(token:string)=>Promise<AuthenticatedUser|null>;origin:string;authority:M73Authority}){
 return async(request:Request):Promise<Response>=>{
  const respond=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'no-store'}})
  const match=/^\/workspace\/([^/]+)\/stationary-natural-gas(?:\/([^/]+)\/(versions|reviews|reports|statements)(?:\/([^/]+)(?:\/(calculation-export|download))?)?)?$/.exec(new URL(request.url).pathname)
  if(!match||!m71Uuid(match[1])||(match[2]&&!m71Uuid(match[2]))||(match[4]&&!m71Uuid(match[4])))return respond(404,{error:'Source workpaper not found.'})
  const [,company,worksheet,action,id,download]=match,origin=request.headers.get('origin');if((request.method!=='GET'&&origin!==deps.origin)||(origin&&origin!==deps.origin))return respond(403,{error:'Forbidden.'})
  const token=extractBearerToken(request.headers);if(!token)return respond(401,{error:'Authentication required.'});const actor=await deps.validateUser(token);if(!actor)return respond(401,{error:'Authentication required.'})
  try{
   const register=await deps.database.findStationaryGas(actor.id,company!,deps.authority);if(!register)return respond(404,{error:'Source workpaper not found.'});const w=worksheet?register.worksheets.find(w=>w.worksheetId===worksheet):undefined;if(worksheet&&!w)return respond(404,{error:'Source workpaper not found.'})
   if(request.method==='GET'){
    if(!action)return respond(200,register)
    const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
    if(action==='versions'&&id){const v=w!.versions.find(v=>v.id===id);if(!v)return respond(404,{error:'Source version not found.'});if(!download)return respond(200,v);if(download==='calculation-export')return new Response(m73Export(v),{headers:{...headers,'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="synthetic-natural-gas-v${v.version}.json"`}})}
    if(action==='statements'&&id&&download==='download'){const s=w!.versions.map(v=>v.statement).find(s=>s?.id===id);if(s)return new Response(s.text,{headers:{...headers,'content-type':'text/plain; charset=utf-8','content-disposition':'attachment; filename="synthetic-natural-gas-statement.txt"'}})}
    if(action==='reports'&&id&&download==='download'){const r=w!.reports.find(r=>r.id===id);if(r)return new Response(r.html,{headers:{...headers,'content-type':'text/html; charset=utf-8','content-disposition':'attachment; filename="synthetic-natural-gas-source-report.html"','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-modals"}})}
    return respond(404,{error:'Source workpaper not found.'})
   }
   if(request.method!=='POST'||id||download)return respond(405,{error:'Method not allowed.'})
   if(!await deps.database.canManageWorkspace(actor.id,company!))return respond(403,{error:'Forbidden.'})
   let body:unknown;try{body=parseM71Json(await request.text(),131072)}catch{return respond(422,{error:'Invalid natural-gas JSON request.'})}
   if(action==='reviews'&&worksheet)return respond(201,await deps.database.reviewStationaryGas(actor.id,company!,worksheet,validateM73Review(body),deps.authority))
   if(action==='reports'&&worksheet)return respond(201,await deps.database.createStationaryGasReport(actor.id,company!,worksheet,validateM73Report(body),deps.authority))
   if(action&&action!=='versions')return respond(404,{error:'Source workpaper not found.'})
   const input=validateM73Save(body);if(Boolean(worksheet)!==Boolean(input.expectedVersionId))return respond(422,{error:'Exact correction version binding required.'})
   return respond(201,await deps.database.saveStationaryGas(actor.id,company!,worksheet??null,input,deps.authority))
  }catch(e){if(e instanceof M73ValidationError)return respond(422,{error:e.message});const code=(e as {code?:string})?.code;if(['22023','22P02','22007','22008','22003'].includes(code??''))return respond(422,{error:'Invalid or unsupported natural-gas request.'});if(code==='23505')return respond(409,{error:'Source, coverage, report decision or request changed. Reload the selected version.'});if(code==='42501')return respond(403,{error:'Forbidden.'});if(code==='54000'||code==='54001')return respond(422,{error:'Synthetic history capacity reached. Earlier records remain readable.',code:'history_limit'});return respond(503,{error:'Natural-gas workpaper could not be verified.'})}
 }
}
