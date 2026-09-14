import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {HostedWorkspaceDatabase,createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {migratePrivateStaging,provisionStagingRoster,revokeStagingAccess} from '../../packages/neuvetra-database/src/staging-migrations'
import {M64_LIMITATIONS,readElectricityWorksheet,type WorksheetVersion,type WorksheetInput} from '../../packages/neuvetra-database/src/m64'
import {decodeElectricityWorksheet} from '../../apps/site-web/src/lib/m64-api'
import {createStagingServer} from '../../apps/site-api/src/staging/server'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {canonicalManifestJson,hashManifestValue} from '../../tools/staging/create-source-manifest'
const url=process.env.M64_TEST_DATABASE_URL
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||u.port!=='55463'||u.pathname!=='/m64_qa'||u.username!=='m63_test_admin'||u.password||u.search||u.hash)throw Error('Dedicated local m64_qa database only')}
const cases=await Bun.file(new URL('./m64-accounting-cases.json',import.meta.url)).json()
const pg=url?describe:describe.skip
const REF='abcdefghijklmnopqrst',ORIGIN='http://127.0.0.1:36464'
async function denied(p:Promise<unknown>){try{await p;throw Error('UNEXPECTED_SUCCESS')}catch(e){if(e instanceof Error&&e.message!=='UNEXPECTED_SUCCESS')return e;throw e}}
const reversed=(v:any):any=>Array.isArray(v)?v.map(reversed):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reversed(x)])):v
pg('M64 independent actual PostgreSQL adversarial integration',()=>{
 let operator:WorkspaceConnection,runtime:WorkspaceConnection,db:HostedWorkspaceDatabase,app:Awaited<ReturnType<typeof createStagingServer>>
 const ids={owner:crypto.randomUUID(),admin:crypto.randomUUID(),admin2:crypto.randomUUID(),member:crypto.randomUUID(),other:crypto.randomUUID(),outsider:crypto.randomUUID(),uninvited:crypto.randomUUID()}
 const company=crypto.randomUUID(),otherCompany=crypto.randomUUID()
 let initial:WorksheetInput,first:WorksheetVersion,second:WorksheetVersion,third:WorksheetVersion
 const originalRows=new Map<string,string[]>(),protectedTables=new Map<string,string>()
 const construct=(c:WorkspaceConnection)=>new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(c,REF)
 const body=(q='62500'):WorksheetInput=>({companyLabel:'Fictional Independent QA',facilityLabel:'Fictional California office',quantityKwh:q,period:'2023-01',geography:'CAMX',unit:'kWh',idempotencyKey:crypto.randomUUID()})
 const review=(v:WorksheetVersion)=>({versionId:v.id,expectedResultSha256:v.resultSha256,decision:'accept_bounded_internal_draft' as const,note:null,acknowledgedLimitations:[...M64_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
 const correction=(v:WorksheetVersion,q:string)=>({...body(q),expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:'Corrected fictional transcription'})
 const scoped=<T>(actor:string|null,fn:(tx:WorkspaceSql)=>Promise<T>)=>runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);return fn(tx)})
 const rawSave=(actor:string|null,c:string,data:unknown,change=false)=>scoped(actor,tx=>tx.query('select neuvetra.save_electricity_worksheet($1,$2::text::jsonb,$3)',[c,JSON.stringify(data),change]))
 const rawReview=(actor:string|null,c:string,data:unknown)=>scoped(actor,tx=>tx.query('select neuvetra.review_electricity_worksheet($1,$2::text::jsonb)',[c,JSON.stringify(data)]))
 const request=(actor:keyof typeof ids|null,c=company,action='',data?:unknown)=>app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/${c}/electricity-worksheet${action}`,{method:data===undefined?'GET':'POST',headers:{origin:ORIGIN,...(actor?{authorization:`Bearer ${actor}`} : {}),...(data===undefined?{}:{'content-type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)}))
 beforeAll(async()=>{
  operator=createPostgresConnection(url!,{tls:false})
  const names=await operator.query<{name:string}>("select relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and relkind='r' and relname not like 'electricity_worksheet_%'")
  for(const {name}of names.rows){if(!/^[a-z_]+$/.test(name))throw Error('unsafe catalog name');const values=(await operator.query<{value:unknown}>(`select to_jsonb(t) value from neuvetra.${name} t`)).rows.map(r=>r.value).sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)));originalRows.set(name,values.map(canonicalManifestJson));if(/^(annual_|inventory_|calculation_|bill_|evidence_|extraction_)/.test(name))protectedTables.set(name,hashManifestValue(values))}
  await migratePrivateStaging(operator,{expectedProjectRef:REF,syntheticTargetConfirmed:true})
  for(const id of Object.values(ids))await operator.query('insert into auth.users(id) values($1)',[id])
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:ids.owner,members:[{userId:ids.admin,role:'admin'},{userId:ids.admin2,role:'admin'},{userId:ids.member,role:'member'}]})
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:otherCompany,ownerUserId:ids.other,members:[]})
  await operator.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'admin')",[company,ids.uninvited])
  runtime=createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55463/m64_qa`,{tls:false,maxConnections:2});db=construct(runtime)
  app=await createStagingServer({profile:'neuvetra.private-synthetic-staging.v1',projectRef:REF,reuseExistingProject:false,origin:ORIGIN,supabaseUrl:`https://${REF}.supabase.co`,supabaseAnonKey:'synthetic-test-only',databaseUrl:url!,webRoot:'.',port:36464},{database:db,validateUser:async token=>token in ids?{id:ids[token as keyof typeof ids],email:'synthetic@example.invalid'}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
 },30000)
 afterAll(async()=>{await app?.close();await operator?.close()})
 test('real migration receipts and least-privilege runtime are valid',async()=>{
  expect((await db.checkReadiness()).schemaVersion).toBe(10)
  const flags=await runtime.query<{rolsuper:boolean;rolbypassrls:boolean;rolinherit:boolean}>('select rolsuper,rolbypassrls,rolinherit from pg_roles where rolname=current_user')
  expect(flags.rows[0]).toEqual({rolsuper:false,rolbypassrls:false,rolinherit:false})
  expect((await db.findElectricityWorksheet(ids.owner,company))?.versions).toEqual([])
 })
 test('SQL calculates every accepted accounting case and frontend accepts real jsonb property order',async()=>{
  for(const c of cases.accepted_cases){
   expect((await denied(scoped(ids.other,async tx=>{
    await tx.query('select neuvetra.save_electricity_worksheet($1,$2::text::jsonb,false)',[otherCompany,JSON.stringify(body(c.input_quantity))])
    const saved=(await readElectricityWorksheet(tx,otherCompany))!;const v=saved.versions[0]!
    expect(v.quantityKwh).toBe(c.expected.quantity_kwh);expect(v.quantityMwh).toBe(c.expected.quantity_mwh)
    expect(v.total).toEqual({unrounded:c.expected.total_unrounded_kg_co2e,display:c.expected.total_display_kg_co2e,unit:'kg CO2e',rounding:'half_even_4dp'})
    expect(decodeElectricityWorksheet(saved,otherCompany)).toEqual(saved)
    expect(decodeElectricityWorksheet(reversed(saved),otherCompany)).toEqual(saved)
    throw Error('QA_ROLLBACK')
   }))).message).toBe('QA_ROLLBACK')
  }
 })
 test('novel near-tie quantities match an independent rational oracle through SQL persistence',async()=>{
  const samples=['62499.998','62499.999','62500.001','62500.002','187499.998','187499.999','187500.001','187500.002','999999.998','999999.999','0.001','0.002','765432.109']
  let seed=33091n;for(let i=0;i<40;i++){seed=seed*48271n%2147483647n;const m=seed%1000000001n;samples.push(`${m/1000n}.${(m%1000n).toString().padStart(3,'0')}`)}
  for(const raw of samples){
   const [whole,fraction='']=raw.split('.'),m=BigInt(whole!)*1000n+BigInt(fraction.padEnd(3,'0')),n=m*1950402888n
   const exactDigits=n.toString().padStart(14,'0'),exact=(exactDigits.slice(0,-13)+'.'+exactDigits.slice(-13)).replace(/0+$/,'').replace(/\.$/,'')
   const lower=n/1000000000n,upper=lower+1n,down=n-lower*1000000000n,up=upper*1000000000n-n
   const nearest=down<up?lower:up<down?upper:lower%2n===0n?lower:upper,digits=nearest.toString().padStart(5,'0'),display=digits.slice(0,-4)+'.'+digits.slice(-4)
   expect((await denied(scoped(ids.other,async tx=>{await tx.query('select neuvetra.save_electricity_worksheet($1,$2::text::jsonb,false)',[otherCompany,JSON.stringify(body(raw))]);const v=(await readElectricityWorksheet(tx,otherCompany))!.versions[0]!;expect(v.total.unrounded).toBe(exact);expect(v.total.display).toBe(display);throw Error('QA_ROLLBACK')}))).message).toBe('QA_ROLLBACK')
  }
 })
 test('direct SQL refuses all malformed quantities, missing field, context and caller result injection',async()=>{
  for(const c of cases.rejected_quantity_cases){const data=body(c.input_quantity)as any;if(!c.quantity_field_present)delete data.quantityKwh;await denied(rawSave(ids.other,otherCompany,data))}
  for(const patch of [{period:'2023-02'},{geography:'NWPP'},{unit:'MWh'},{createdBy:ids.owner},{total:{display:'0.0000'}},{companyLabel:'bad\n'},{facilityLabel:' fake'},{synthetic:false},{quantityKwh:'1\n'}])await denied(rawSave(ids.other,otherCompany,{...body(),...patch}))
  expect((await db.findElectricityWorksheet(ids.other,otherCompany))?.versions).toHaveLength(0)
 })
 test('actual API saves initial version, converges canonical retries, and refuses key reuse with changed payload',async()=>{
  initial=body();const response=await request('owner',company,'',initial);expect(response.status).toBe(201)
  const saved=decodeElectricityWorksheet(await response.json(),company);first=saved.versions[0]!
  expect(first.total.display).toBe('12190.0180');expect(first.review).toBeNull()
  const retry=await request('owner',company,'',{...initial,quantityKwh:'62500.000'});expect(retry.status).toBe(201);expect((await retry.json()).versions[0].id).toBe(first.id)
  expect((await request('owner',company,'',{...initial,quantityKwh:'1'})).status).toBe(409)
  expect((await request('admin',company,'',initial)).status).toBe(409)
 })
 test('second active invited tenant, outsider, uninvited member and signed-out boundaries hold at API and SQL',async()=>{
  expect(await db.hasStagingAccess(ids.other)).toBe(true)
  expect((await request('other')).status).toBe(404)
  expect((await request('outsider')).status).toBe(403)
  expect((await request('uninvited')).status).toBe(403)
  expect((await request(null)).status).toBe(401)
  expect((await request('member')).status).toBe(200)
  expect((await request('member',company,'',body('1'))).status).toBe(403)
  for(const actor of [ids.other,ids.outsider,ids.uninvited,null]){
   expect((await scoped(actor,tx=>tx.query('select * from neuvetra.electricity_worksheet_versions where company_id=$1',[company]))).rows).toHaveLength(0)
   await denied(rawSave(actor,company,body('1')));await denied(rawReview(actor,company,review(first)))
  }
  await denied(rawSave(ids.member,company,body('1')));await denied(rawReview(ids.member,company,review(first)))
  await denied(runtime.query('update neuvetra.electricity_worksheet_versions set version=2 where id=$1',[first.id]))
  await denied(runtime.query('delete from neuvetra.electricity_worksheet_versions where id=$1',[first.id]))
 })
 test('review binds a different actor and current hash; repeated decision converges but changed/cross-actor decision conflicts',async()=>{
  const r=review(first)
  expect((await request('owner',company,'/reviews',r)).status).toBe(409)
  expect((await request('admin',company,'/reviews',{...r,expectedResultSha256:'0'.repeat(64)})).status).toBe(409)
  expect((await request('admin',company,'/reviews',{...r,acknowledgedLimitations:[]})).status).toBe(422)
  const saved=await request('admin',company,'/reviews',r);expect(saved.status).toBe(201);first=(await saved.json()).versions[0]
  expect(first.review!.reviewerId).toBe(ids.admin);expect(first.review!.resultSha256).toBe(first.resultSha256)
  const repeated=await Promise.all([request('admin',company,'/reviews',r),request('admin',company,'/reviews',{...r,idempotencyKey:crypto.randomUUID()})]);expect(repeated.map(r=>r.status)).toEqual([201,201])
  expect((await request('admin2',company,'/reviews',r)).status).toBe(409)
  expect((await request('admin',company,'/reviews',{...r,decision:'changes_requested',note:'Fix fictional label',acknowledgedLimitations:[]})).status).toBe(409)
 })
 test('concurrent correction aliases create one version and preserve exact prior review without inheritance',async()=>{
  const c=correction(first,'187500')
  const responses=await Promise.all([request('owner',company,'/corrections',c),request('owner',company,'/corrections',{...c,idempotencyKey:crypto.randomUUID()})]);expect(responses.map(r=>r.status)).toEqual([201,201])
  const [a,b]=await Promise.all(responses.map(r=>r.json()));second=a.versions[1]
  expect(second.id).toBe(b.versions[1].id);expect(a.versions).toHaveLength(2);expect(second.total.display).toBe('36570.0542');expect(second.review).toBeNull();expect(a.versions[0]).toEqual(first)
  for(const data of [{...correction(second,'187500.000')},{...correction(second,'1'),correctionReason:' '},{...c,quantityKwh:'1',idempotencyKey:crypto.randomUUID()}])expect([409,422]).toContain((await request('owner',company,'/corrections',data)).status)
  expect((await request('admin2',company,'/reviews',review(first))).status).toBe(409)
  expect((await request('admin',company,'/reviews',{...review(second),versionId:first.id})).status).toBe(409)
 })
 test('two different stale-base corrections race with one winner; zero remains explicit and unreviewed',async()=>{
  const results=await Promise.all([request('owner',company,'/corrections',correction(second,'0')),request('owner',company,'/corrections',correction(second,'0.001'))]);expect(results.map(r=>r.status).sort()).toEqual([201,409])
  const saved=await db.findElectricityWorksheet(ids.owner,company);expect(saved!.versions).toHaveLength(3);third=saved!.versions[2]!;expect(third.review).toBeNull()
  if(third.quantityKwh!=='0.000'){third=(await db.saveElectricityWorksheet(ids.owner,company,correction(third,'0'),true)).versions.at(-1)!}
  expect(third.total).toEqual({unrounded:'0',display:'0.0000',unit:'kg CO2e',rounding:'half_even_4dp'})
  const decision={...review(third),decision:'changes_requested',note:'Verify the fictional zero entry',acknowledgedLimitations:[]}
  expect((await request('admin2',company,'/reviews',decision)).status).toBe(201)
 })
 test('concurrent readers see a consistent history while a review and correction compete',async()=>{
  let current=(await db.saveElectricityWorksheet(ids.owner,company,correction(third,'999.999'),true)).versions.at(-1)!
  for(let round=0;round<4;round++){
   const base=current,change=correction(base,`${1000+round}.001`)
   const results=await Promise.all([request('owner',company,'/corrections',change),request('admin',company,'/reviews',review(base)),...Array.from({length:10},()=>db.findElectricityWorksheet(ids.member,company))])
   expect((results[0]as Response).status).toBe(201);expect([201,409]).toContain((results[1]as Response).status)
   for(const snapshot of results.slice(2)){const value=snapshot as any;expect(value.versions.length>=base.version).toBe(true);expect(value.versions.length<=base.version+1).toBe(true);expect(decodeElectricityWorksheet(value,company)).toEqual(value)}
   current=(await db.findElectricityWorksheet(ids.owner,company))!.versions.at(-1)!;expect(current.review).toBeNull()
  }
 })
 test('pooled actor switching never leaks another company, including after access revocation',async()=>{
  for(let round=0;round<4;round++){
   const values=await Promise.all(Array.from({length:12},(_,i)=>i%3===0?db.findElectricityWorksheet(ids.other,company):i%3===1?db.findElectricityWorksheet(ids.owner,company):db.findElectricityWorksheet(ids.member,company)))
   values.forEach((v,i)=>i%3===0?expect(v).toBeNull():expect(v!.companyId).toBe(company))
  }
  expect((await runtime.query<{v:string|null}>("select nullif(current_setting('request.jwt.claim.sub',true),'') v")).rows[0]!.v).toBeNull()
  await revokeStagingAccess(operator,ids.admin2)
  expect((await request('admin2')).status).toBe(403)
  await denied(rawReview(ids.admin2,company,review(third)))
  expect((await scoped(ids.admin2,tx=>tx.query('select * from neuvetra.electricity_worksheet_reviews where company_id=$1',[company]))).rows).toHaveLength(0)
 })
 test('immutable history triggers reject even operator updates and reads reject transactional corruption',async()=>{
  for(const table of ['electricity_worksheet_versions','electricity_worksheet_reviews','electricity_worksheet_requests','electricity_worksheet_audit'])await denied(operator.query(`delete from neuvetra.${table} where company_id=$1`,[company]))
  const corruptions=[
   "update neuvetra.electricity_worksheet_versions set payload=jsonb_set(payload,'{total,display}','\"999.0000\"') where company_id=$1",
   "update neuvetra.electricity_worksheet_versions set payload=jsonb_set(payload,'{companyLabel}','\"Changed fictional label\"') where company_id=$1",
   "update neuvetra.electricity_worksheet_versions set payload=jsonb_set(payload,'{method,factorValue}','\"1\"') where company_id=$1",
   "delete from neuvetra.electricity_worksheet_audit where company_id=$1",
   "update neuvetra.electricity_worksheet_reviews set decision_sha256=repeat('0',64) where company_id=$1",
  ]
  for(const sql of corruptions){const error=await denied(operator.transaction(async tx=>{await tx.exec("set local session_replication_role='replica'");await tx.query(sql,[company]);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.owner]);await tx.exec('set local role neuvetra_runtime');await readElectricityWorksheet(tx,company);throw Error('UNEXPECTED_SUCCESS')}));expect(error.message).toContain('could not be verified')}
  expect((await db.findElectricityWorksheet(ids.owner,company))!.versions[0]).toEqual(first)
 })
 test('actual decoder accepts arbitrary object order and refuses altered context, linkage, method and review',async()=>{
  const saved=(await db.findElectricityWorksheet(ids.owner,company))!;expect(decodeElectricityWorksheet(reversed(saved),company)).toEqual(saved)
  const mutations=[(x:any)=>x.complete=true,(x:any)=>x.companyId=otherCompany,(x:any)=>x.versions[0].method.factorValue='0',(x:any)=>x.versions[1].previousVersionId=crypto.randomUUID(),(x:any)=>x.versions[0].review.resultSha256='0'.repeat(64),(x:any)=>x.versions[0].review.reviewerId=x.versions[0].createdBy,(x:any)=>x.versions[0].total.unit='tonnes CO2e',(x:any)=>x.versions[0].quantityKwh='1\n',(x:any)=>x.versions[0].quantityKwh+='\n',(x:any)=>x.versions[0].total.display+='\n',(x:any)=>x.versions[0].inputSha256+='\n']
  for(const change of mutations){const copy=structuredClone(saved);change(copy);expect(()=>decodeElectricityWorksheet(copy,company)).toThrow()}
 })
 test('new connection reads durable versions; all original M63 records remain byte-identical',async()=>{
  const fresh=construct(createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55463/m64_qa',{tls:false,maxConnections:1}))
  try{expect(await fresh.findElectricityWorksheet(ids.owner,company)).toEqual(await db.findElectricityWorksheet(ids.owner,company))}finally{await fresh.close()}
  const hashes=[]
  for(const [name,prior]of originalRows){const values=(await operator.query<{value:unknown}>(`select to_jsonb(t) value from neuvetra.${name} t`)).rows.map(r=>r.value).sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)));const current=new Set(values.map(canonicalManifestJson));expect(prior.every(row=>current.has(row))).toBe(true);if(protectedTables.has(name))expect(hashManifestValue(values)).toBe(protectedTables.get(name));hashes.push({name,originalRows:prior.length,allOriginalRowsUnchanged:true,...(protectedTables.has(name)?{sha256:hashManifestValue(values)}:{})})}
  await Bun.write(new URL('./m64-postgres-receipt.json',import.meta.url),JSON.stringify({status:'legacy_preservation_passed',database:'m64_qa',runtime:'PostgreSQL local dedicated fixture; API auth injected; no hosted deployment claim',checks:'arithmetic, direct SQL refusals, API roles, invited second tenant, review/version integrity, concurrency, revocation, decoder, reconnection, original M63 preservation',legacy:hashes},null,2)+'\n')
 })
})
