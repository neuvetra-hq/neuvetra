import {test,expect} from 'bun:test'
import {fixture,setup,REF} from './hosted-setup-01-native-fixture'
import {HostedWorkspaceDatabase,createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {createStagingServer} from '../../apps/site-api/src/staging/server'
import {saveCompanySetup} from '../../packages/neuvetra-database/src/company-setup'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
const files=['packages/neuvetra-database/src/hosted.ts','packages/neuvetra-database/src/workspace.ts','packages/neuvetra-database/src/company-setup.ts','packages/neuvetra-database/src/staging-migrations.ts','packages/neuvetra-database/src/migrations/0023_company_setup.sql','apps/site-api/src/staging/server.ts','apps/site-api/src/workspace/company-setup-routes.ts']
const hashes=()=>Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))
test('native staged HTTP integration and concurrent revocation',async()=>{
 const sourceHashes=hashes(),f=await fixture(),checks:string[]=[],origin='http://127.0.0.1:48083'
 const db=new(HostedWorkspaceDatabase as any)(f.runtime,REF),request=(v:any=null)=>({idempotencyKey:crypto.randomUUID(),expectedRevision:v?.revision??0,expectedVersionId:v?.id??null,correctionReason:v?'Synthetic correction':null,setup:setup()})
 let server:any
 const check=async(name:string,run:()=>Promise<void>)=>{await run();checks.push(name);console.log('PASS '+name)}
 try{
  console.log('READINESS',await db.checkReadiness())
  const app=await createStagingServer({profile:'neuvetra.private-synthetic-staging.v1',origin,projectRef:REF,supabaseUrl:'https://synthetic.invalid',supabaseAnonKey:'synthetic-test-value',databaseUrl:f.runtimeUrl,webRoot:'.',port:0},{database:db,validateUser:async token=>f.users[token as keyof typeof f.users]?{id:f.users[token as keyof typeof f.users],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
  server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:app.fetch})
  const call=(actor:string|null,company=f.a,body?:unknown,suffix='')=>fetch('http://127.0.0.1:'+server.port+'/workspace-api/workspace/'+company+'/setup'+suffix,{method:body===undefined?'GET':'POST',headers:{origin,...(actor?{authorization:'Bearer '+actor}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  let first:any,other:any
  await check('operator provisions a non-CA synthetic company without fixtures and runtime cannot provision',async()=>{
   const id=crypto.randomUUID(),owner=crypto.randomUUID();await f.op.query('insert into auth.users values($1)',[owner]);await f.op.query("select neuvetra.provision_company_setup_workspace($1,$2,'Synthetic QA Empty Workspace','US','NV',true)",[id,owner]);expect(await db.findStagingMembershipForUser(owner)).toEqual({companyId:id,role:'owner',evidenceId:null})
   expect((await f.op.query('select count(*)::integer count from neuvetra.facilities where company_id=$1',[id])).rows[0]!.count).toBe(0)
   let denied=false;try{await f.scoped(f.users.owner,tx=>tx.query("select neuvetra.provision_company_setup_workspace($1,$2,'Synthetic forbidden','US','NV',true)",[crypto.randomUUID(),crypto.randomUUID()]))}catch(e){expect((e as any).code).toBe('42501');denied=true}expect(denied).toBe(true)
   const response=await fetch('http://127.0.0.1:'+server.port+'/workspace-api/session',{headers:{authorization:'Bearer owner',origin}});expect(response.status).toBe(200);expect((await response.json()as any).access.workspaceId).toBe(f.a)
  })
  await check('actual mounted server performs persisted saves and rejects both foreign directions',async()=>{
   expect((await call(null)).status).toBe(401);expect((await call('uninvited')).status).toBe(403)
   for(const actor of ['owner','other']){const response=await call(actor,actor==='owner'?f.a:f.b,request());expect(response.status,await response.clone().text()).toBe(201);const v=(await response.json()as any).savedVersion;if(actor==='owner')first=v;else other=v}
   expect((await call('owner',f.b)).status).toBe(404);expect((await call('other',f.a,request())).status).toBe(404)
   expect((await call('owner',f.a,undefined,'/versions/'+other.id)).status).toBe(404);expect((await call('other',f.b,undefined,'/versions/'+first.id)).status).toBe(404)
   expect((await call('member',f.a,request(first))).status).toBe(403)
  })
  await check('actual wrapper bounds bytes and reads histories after listener restart',async()=>{
   expect((await call('owner',f.a,'x'.repeat(300001))).status).toBe(413)
   server.stop(true);server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:app.fetch});const value=await(await call('owner')).json()as any;expect(value.currentVersion).toEqual(first);expect(value.history).toHaveLength(1)
  })
  await check('in-flight authorized save holds admission lock until commit; revoked identity denied afterward',async()=>{
   let saved!:()=>void,release!:()=>void;const saveReached=new Promise<void>(r=>saved=r),gate=new Promise<void>(r=>release=r)
   const writing=f.runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[f.users.owner]);const value=await saveCompanySetup(tx,f.users.owner,f.a,request(first));saved();await gate;return value})
   await saveReached
   let revokeFinished=false;const revoking=f.op.query('update neuvetra.staging_access set active=false where user_id=$1',[f.users.owner]).then(()=>{revokeFinished=true})
   await new Promise(r=>setTimeout(r,100));expect(revokeFinished).toBe(false);release();await writing;await revoking
   expect((await call('owner')).status).toBe(403);expect((await call('owner',f.a,request(first))).status).toBe(403)
   await f.op.query('update neuvetra.staging_access set active=true where user_id=$1',[f.users.owner])
  })
  await check('committed revocation wins against a waiting writer and leaves no new version',async()=>{
   const view=await(await call('owner')).json()as any;let locked!:()=>void,release!:()=>void;const lockReached=new Promise<void>(r=>locked=r),gate=new Promise<void>(r=>release=r)
   const revoke=f.op.transaction(async tx=>{await tx.query('update neuvetra.staging_access set active=false where user_id=$1',[f.users.owner]);locked();await gate})
   await lockReached;let finished=false;const write=f.database.saveCompanySetup(f.users.owner,f.a,request(view.currentVersion)).then(()=>{finished=true;return 'unexpected'},e=>{finished=true;return e.code})
   await new Promise(r=>setTimeout(r,100));expect(finished).toBe(false);release();await revoke;expect(await write).toBe('42501');expect((await f.op.query('select count(*)::integer count from neuvetra.company_setup_versions where company_id=$1',[f.a])).rows[0]!.count).toBe(2)
  })
 }finally{server?.stop(true);await Bun.write('evaluations/research-qa/hosted-setup-01-integrated-result.json',JSON.stringify({databaseName:f.databaseName,sourceHashes,sourceHashesAfter:hashes(),checks,auth:'Synthetic token map with actual mounted HTTP listener and restricted native PostgreSQL; provider auth untested'},null,2));await f.close();expect(hashes()).toEqual(sourceHashes)}
},30000)
