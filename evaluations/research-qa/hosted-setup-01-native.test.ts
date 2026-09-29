import {test,expect} from 'bun:test'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {readCompanySetup} from '../../packages/neuvetra-database/src/company-setup'
import {fixture,setup} from './hosted-setup-01-native-fixture'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'

const files=['packages/neuvetra-database/src/migrations/0023_company_setup.sql','packages/neuvetra-database/src/company-setup.ts','apps/site-api/src/workspace/company-setup-routes.ts']
const hashes=()=>Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))
test('independent native two-company setup foundation challenge',async()=>{
 const beforeHashes=hashes(),f=await fixture(),checks:string[]=[],detail:Record<string,unknown>={}
 const check=async(name:string,run:()=>Promise<void>)=>{await run();checks.push(name);console.log('PASS '+name)}
 const input=(s=setup(),v:any=null)=>({idempotencyKey:crypto.randomUUID(),expectedRevision:v?.revision??0,expectedVersionId:v?.id??null,correctionReason:v?'Synthetic correction':null,setup:s})
 let first:any,second:any,foreign:any,original:any
 try{
 await check('unauthenticated, uninvited and cross-company reads/writes denied',async()=>{
  expect((await f.call(null)).status).toBe(401);expect((await f.call('uninvited')).status).toBe(404)
  for(const [actor,company]of [['owner',f.b],['other',f.a]]as const){expect((await f.call(actor,company)).status).toBe(404);expect((await f.call(actor,company,input())).status).toBe(404)}
  expect((await f.call('member',f.a,input())).status).toBe(403)
 })
 await check('initial saves preserve multi-state unknown/no/not-applicable and append history',async()=>{
  const s=setup();s.locations.push({id:crypto.randomUUID(),entityId:s.entities[0]!.id,facilityId:null,name:'Synthetic Nevada site',countryCode:'US',regionCode:'NV',locality:'Reno',purpose:'Synthetic',occupancy:'leased',control:'unknown',inclusion:'unknown',reason:'',start:null,endExclusive:null,otherEntity:'',operatorDetails:'',startMode:'unknown',endMode:'unknown',opened:null})
  original=input(s);const response=await f.call('owner',f.a,original);expect(response.status,await response.clone().text()).toBe(201);first=(await response.json()as any).savedVersion;expect(first.setup).toEqual(s)
  const other=await f.call('other',f.b,input());expect(other.status,await other.clone().text()).toBe(201);foreign=(await other.json()as any).savedVersion
  const normalized=await f.op.query('select state,reason from neuvetra.company_setup_screening where version_id=$1 order by scope',[first.id]);expect(normalized.rows.map((r:any)=>r.state)).toEqual(['unknown','no','not_applicable'])
  expect((await f.op.query('select ownership_percent from neuvetra.company_setup_entities where version_id=$1',[first.id])).rows[0]!.ownership_percent).toBeNull()
 })
 await check('direct runtime RLS covers every new table and guessed version IDs',async()=>{
  const tables=(await f.op.query<any>("select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relname like 'company_setup_%' and c.relkind='r'")).rows
  expect(tables.length).toBeGreaterThanOrEqual(7);expect(tables.every((x:any)=>x.relrowsecurity&&x.relforcerowsecurity)).toBe(true)
  for(const table of tables){console.log('RLS '+table.relname);const rows=await f.scoped(f.users.owner,tx=>tx.query(`select company_id from neuvetra.${table.relname}`));expect((rows as any).rows.every((r:any)=>r.company_id===f.a)).toBe(true);let denied=false;try{await f.scoped(f.users.owner,tx=>tx.query(`delete from neuvetra.${table.relname}`))}catch(error){expect((error as any).code).toBe('42501');denied=true}expect(denied).toBe(true)}
  for(const [actor,company,id]of [['owner',f.a,foreign.id],['owner',f.b,foreign.id],['other',f.b,first.id]]as const)expect((await f.call(actor,company,undefined,'/versions/'+id)).status).toBe(404)
  detail.rlsTables=tables
 })
 await check('corrections preserve old bytes; stale write and altered replay fail without side effects',async()=>{
  const s=structuredClone(first.setup);s.screening[0].state='no';s.screening[0].reason='No synthetic onsite combustion'
  const request=input(s,first),response=await f.call('owner',f.a,request);expect(response.status).toBe(201);second=(await response.json()as any).savedVersion;expect(second.previousVersionId).toBe(first.id)
  expect(await(await f.call('owner',f.a,undefined,'/versions/'+first.id)).json()).toEqual(first)
  expect((await f.call('owner',f.a,input(s,first))).status).toBe(409)
  const replay=await f.call('owner',f.a,original);expect(replay.status).toBe(200);expect((await replay.json()as any).savedVersion).toEqual(first)
  expect((await f.call('owner',f.a,{...original,setup:s})).status).toBe(409)
  expect((await(await f.call('owner')).json()as any).history).toHaveLength(2)
 })
 await check('cross-company facility and entity references fail atomically; missing reason and invalid dates fail',async()=>{
  const facility=crypto.randomUUID();await f.op.query("insert into neuvetra.facilities(id,company_id,name,country_code,state_code) values($1,$2,'Synthetic foreign facility','US','CA')",[facility,f.b])
  for(const mutate of [(s:any)=>s.locations[0].facilityId=facility,(s:any)=>s.locations[0].entityId=foreign.setup.entities[0].id,(s:any)=>s.screening[0]={...s.screening[0],state:'no',reason:''},(s:any)=>s.reportingPeriod.start='2025-02-30',(s:any)=>s.entities[0].ownershipPercent='NaN',(s:any)=>s.screening[0].state='zero']){
   const s=structuredClone(first.setup);mutate(s);const r=await f.call('owner',f.a,input(s,second));expect(r.status,await r.clone().text()).toBe(422)
  }
  expect((await(await f.call('owner')).json()as any).history).toHaveLength(2)
  await f.op.query('delete from neuvetra.facilities where id=$1',[facility])
 })
 await check('concurrent successors yield exactly one appended version',async()=>{
  const results=await Promise.all([f.call('owner',f.a,input(first.setup,second)),f.call('owner',f.a,input(first.setup,second))]);expect(results.map(r=>r.status).sort()).toEqual([201,409]);expect((await(await f.call('owner')).json()as any).history).toHaveLength(3)
 })
 await check('revocation defeats read, history, write and replay using same identity',async()=>{
  await f.op.query('delete from neuvetra.company_members where company_id=$1 and user_id=$2',[f.a,f.users.owner])
  expect((await f.call('owner')).status).toBe(404);expect((await f.call('owner',f.a,original)).status).toBe(404);expect((await f.call('owner',f.a,undefined,'/versions/'+first.id)).status).toBe(404)
  expect((await f.scoped(f.users.owner,tx=>tx.query('select * from neuvetra.company_setup_versions'))as any).rows).toEqual([])
  const retained=JSON.parse(f.before.company_members!).find((r:any)=>r.company_id===f.a&&r.user_id===f.users.owner)
  await f.op.query("insert into neuvetra.company_members(company_id,user_id,role,created_at) values($1,$2,'owner',$3::text::timestamptz)",[f.a,f.users.owner,retained.created_at])
 })
 await check('reopened connection retains setup and history',async()=>{
  const reopened=createPostgresConnection(f.runtimeUrl,{tls:false,maxConnections:1});try{const value=await reopened.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[f.users.owner]);return readCompanySetup(tx,f.a)});expect(value!.history).toHaveLength(3);expect(value!.currentVersion!.setup).toEqual(first.setup)}finally{await reopened.close()}
 })
 await check('all pre-existing row values including M71/M78/M80 sentinels and four method holds preserved',async()=>{
  const after=await f.snapshot();expect(after).toEqual(f.before);detail.legacyTables=Object.keys(f.before);detail.legacyPopulatedTables=Object.keys(f.before).filter(k=>f.before[k]!=='[]')
 })
 await check('public and authenticated cannot execute mutation function; fixed search path',async()=>{
  const rows=(await f.op.query<any>("select has_function_privilege('authenticated','neuvetra.save_company_setup(uuid,jsonb)','execute') authenticated,has_function_privilege('anon','neuvetra.save_company_setup(uuid,jsonb)','execute') anon,p.prosecdef,p.proconfig from pg_proc p where p.oid='neuvetra.save_company_setup(uuid,jsonb)'::regprocedure")).rows;expect(rows[0]!.authenticated).toBe(false);expect(rows[0]!.anon).toBe(false);expect(rows[0]!.prosecdef).toBe(true);expect(rows[0]!.proconfig).toContain('search_path=pg_catalog, neuvetra, pg_temp');detail.functionSecurity=rows
 })
 }finally{const afterHashes=hashes();await Bun.write('evaluations/research-qa/hosted-setup-01-native-result.json',JSON.stringify({databaseName:f.databaseName,sourceHashes:beforeHashes,sourceHashesAfter:afterHashes,checks,detail,limitations:['Synthetic token map; provider auth untested','Populated M71/M78/M80 SQL-conforming preservation sentinels are not claimed accounting-valid workpapers','No hosted deployment/backup/restore/browser/storage/export/job tests'],requestedModel:'gpt-6-astra',requestedEffort:'high',observedModel:null,observedEffort:null},null,2));await f.close();expect(afterHashes).toEqual(beforeHashes)}
},120000)
