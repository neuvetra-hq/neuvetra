import {test,expect} from 'bun:test'
import {parseM72Input,runM72Journey} from '../../tools/staging/check-m72-hosted'
const AUTH='https://icockcoguyadhryzydvl.supabase.co'
const input=()=>parseM72Input({mode:'baseline',env:{SUPABASE_URL:AUTH,SUPABASE_ANON_KEY:'sb_publishable_'+'A'.repeat(30)},roster:{workspaceId:'72000000-0000-4000-8000-000000000010'},accounts:['manager1','manager2','member','outsider'].map((role,i)=>({role,id:`72000000-0000-4000-8000-00000000000${i+1}`,email:`fictional-${i}@example.invalid`,password:'offline-placeholder'}))})
for(const failure of ['timeout','malformed_response','oversized_token'])test(`auth ${failure} preserves unknown session closure`,async()=>{
 const config=input();let saved:any,tokenRequests=0
 const fetch=async(url:string|URL|Request)=>{
  const route=String(url),ok=(body:unknown)=>Response.json(body,{headers:{'cache-control':'no-store'}})
  if(route.endsWith('/ready'))return ok({status:'ready',profile:'neuvetra.private-synthetic-staging.v1',schemaVersion:14,legacyContainmentVerified:true})
  if(route.endsWith('/config'))return ok({profile:'neuvetra.private-synthetic-staging.v1',supabaseUrl:AUTH,anonKey:config.env.SUPABASE_ANON_KEY})
  if(route.includes('/token?')){tokenRequests++;if(failure==='timeout')throw Error('Connection lost after provider may have accepted sign-in');if(failure==='malformed_response')return new Response('{',{status:200});return ok({access_token:'x'.repeat(8193),user:{id:config.accounts[0].id}})}
  throw Error('Unexpected network request')
 }
 const result=await runM72Journey(config,{fetch:fetch as any,load:async()=>null,save:async h=>{saved=h}})
 expect(tokenRequests).toBe(1);expect(result.status).toBe('failed');expect(result.allCreatedAuthSessionsClosed).not.toBe(true)
 expect(saved.attempts[0].allCreatedAuthSessionsClosed).not.toBe(true)
})
