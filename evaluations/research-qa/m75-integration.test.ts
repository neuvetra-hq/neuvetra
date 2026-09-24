import {expect,test} from 'bun:test'
import {createStagingServer,type StagingDatabase} from '../../apps/site-api/src/staging/server'
import {readStagingConfig,STAGING_PROFILE} from '../../apps/site-api/src/staging/config'
import fixture from './m75-independent-ui-fixture.json'

const origin='http://127.0.0.1:3015',ref='abcdefghijklmnopqrst',actor='11111111-1111-4111-8111-111111111111'
const config=()=>readStagingConfig({NODE_ENV:'test',NEUVETRA_STAGING_ENABLED:'enabled',NEUVETRA_STAGING_PROFILE:STAGING_PROFILE,NEUVETRA_STAGING_PROJECT_REF:ref,NEUVETRA_STAGING_ORIGIN:origin,SUPABASE_URL:`https://${ref}.supabase.co`,SUPABASE_ANON_KEY:'sb_publishable_synthetic_fixture_not_a_real_key',DATABASE_URL:`postgres://neuvetra_runtime:synthetic-password@db.${ref}.supabase.co:5432/postgres`})

test('independent M75 staging composition forwards exact actor/company and retains outer access/body/origin restrictions',async()=>{
 let invited=true,reads=0,closed=false
 const database={checkReadiness:async()=>({profile:STAGING_PROFILE,schemaVersion:18}),close:async()=>{closed=true},hasStagingAccess:async(id:string)=>invited&&id===actor,findControlledFleet:async(id:string,company:string)=>{expect(id).toBe(actor);reads++;return company===fixture.register.companyId?fixture.register:null}} as unknown as StagingDatabase
 const app=await createStagingServer(config(),{database,validateUser:async(token)=>token==='synthetic-session'?{id:actor,email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},log:()=>{}})
 const request=(suffix='',options:RequestInit={})=>app.fetch(new Request(`${origin}/workspace-api/workspace/${fixture.register.companyId}/controlled-fleet${suffix}`,{...options,headers:{origin,authorization:'Bearer synthetic-session',...options.headers}}))
 try{
  const response=await request();expect(response.status).toBe(200);expect(await response.json()).toEqual(fixture.register);expect(reads).toBe(1)
  expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('x-content-type-options')).toBe('nosniff');expect(response.headers.get('x-frame-options')).toBe('DENY')
  expect((await request('',{headers:{authorization:''}})).status).toBe(401)
  invited=false;expect((await request()).status).toBe(403);invited=true
  expect((await request('',{headers:{origin:'https://foreign.invalid'}})).status).toBe(403)
  expect((await request('',{method:'POST',body:'x'.repeat(300001)})).status).toBe(413)
  expect(reads).toBe(1)
  expect((await request('/invalid')).status).toBe(404)
  expect((await request('',{method:'PUT'})).status).toBe(405)
 }finally{await app.close()}
 expect(closed).toBe(true)
})

test('independent M75 server refuses schema17 before serving and closes supplied database',async()=>{
 let closed=false
 const database={checkReadiness:async()=>({profile:STAGING_PROFILE,schemaVersion:17}),close:async()=>{closed=true}} as unknown as StagingDatabase
 let error:unknown
 try{await createStagingServer(config(),{database,validateUser:async()=>null,verifyAssets:async()=>{}})}catch(e){error=e}
 expect(String(error)).toContain('Private staging dependencies are unavailable.');expect(closed).toBe(true)
})
