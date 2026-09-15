// Supplemental immutable copy for the repaired print template; original QA harness preserved.
import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {HostedWorkspaceDatabase,createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {migratePrivateStaging,provisionStagingRoster,revokeStagingAccess} from '../../packages/neuvetra-database/src/staging-migrations'
import {M64_LIMITATIONS,type WorksheetVersion} from '../../packages/neuvetra-database/src/m64-contract'
import {readWorksheetReports,buildWorksheetReport,type WorksheetReport,type WorksheetReportInput} from '../../packages/neuvetra-database/src/m65'
import {decodeWorksheetReport} from '../../apps/site-web/src/lib/m65-api'
import {createStagingServer} from '../../apps/site-api/src/staging/server'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {hashManifestValue} from '../../tools/staging/create-source-manifest'
const url=process.env.M65_PRINT_TEST_DATABASE_URL
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||u.port!=='55463'||u.pathname!=='/m65_qa_print'||u.username!=='m63_test_admin'||u.password||u.search||u.hash)throw Error('Dedicated m65_qa_print loopback database only')}
const pg=url?describe:describe.skip,REF='abcdefghijklmnopqrst',ORIGIN='http://127.0.0.1:36565'
const baseline=await Bun.file(new URL('./m65-baseline-receipt.json',import.meta.url)).json(),cases=await Bun.file(new URL('./m65-accounting-cases.json',import.meta.url)).json()
async function denied(p:Promise<unknown>){try{await p;throw Error('UNEXPECTED_SUCCESS')}catch(e){if(e instanceof Error&&e.message!=='UNEXPECTED_SUCCESS')return e;throw e}}
const text=(bytes:Uint8Array)=>new TextDecoder('utf-8',{fatal:true}).decode(bytes)
pg('M65 repaired-print independent PostgreSQL/report boundary',()=>{
 let operator:WorkspaceConnection,runtime:WorkspaceConnection,db:HostedWorkspaceDatabase,app:Awaited<ReturnType<typeof createStagingServer>>
 const ids={owner:crypto.randomUUID(),admin:crypto.randomUUID(),member:crypto.randomUUID(),other:crypto.randomUUID(),otherAdmin:crypto.randomUUID(),outsider:crypto.randomUUID(),uninvited:crypto.randomUUID()}
 const company=crypto.randomUUID(),otherCompany=crypto.randomUUID()
 let v1:WorksheetVersion,v2:WorksheetVersion,v3:WorksheetVersion,unreviewed:WorksheetReport,accepted:WorksheetReport,originalBytes:Uint8Array
 const input=(quantityKwh='25000.000')=>({companyLabel:'Fictional QA Company',facilityLabel:'Fictional QA Facility',quantityKwh,period:'2023-01' as const,geography:'CAMX' as const,unit:'kWh' as const,idempotencyKey:crypto.randomUUID()})
 const correction=(v:WorksheetVersion,q:string)=>({...input(q),expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:'Independent synthetic correction'})
 const requestFor=(v:WorksheetVersion):WorksheetReportInput=>({sourceVersionId:v.id,expectedInputSha256:v.inputSha256,expectedResultSha256:v.resultSha256,expectedReviewId:v.review?.id??null,expectedReviewSha256:v.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()})
 const reviewFor=(v:WorksheetVersion)=>({versionId:v.id,expectedResultSha256:v.resultSha256,decision:'accept_bounded_internal_draft' as const,note:null,acknowledgedLimitations:[...M64_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
 const construct=(connection:WorkspaceConnection)=>new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(connection,REF)
 const scoped=<T>(actor:string|null,fn:(tx:WorkspaceSql)=>Promise<T>)=>runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);return fn(tx)})
 // Frozen per-row hashes used the baseline session's America/Los_Angeles timezone; preserve that serialization when comparing.
 const baselineRows=(table:string)=>operator.transaction(async tx=>{await tx.query("set local timezone = 'America/Los_Angeles'");return (await tx.query<{value:unknown}>(`select to_jsonb(t) value from neuvetra.${table} t`)).rows.map(r=>hashManifestValue(r.value))})
 const sqlCreate=(actor:string|null,c:string,p:unknown)=>scoped(actor,tx=>tx.query('select neuvetra.create_worksheet_report($1,$2::text::jsonb) id',[c,JSON.stringify(p)]))
 const request=(actor:keyof typeof ids|null,c=company,suffix='',body?:unknown)=>app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/${c}/electricity-worksheet/reports${suffix}`,{method:body===undefined?'GET':'POST',headers:{origin:ORIGIN,...(actor?{authorization:`Bearer ${actor}`} : {}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}))
 beforeAll(async()=>{
  operator=createPostgresConnection(url!,{tls:false});await migratePrivateStaging(operator,{expectedProjectRef:REF,syntheticTargetConfirmed:true})
  for(const id of Object.values(ids))await operator.query('insert into auth.users(id) values($1)',[id])
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:ids.owner,members:[{userId:ids.admin,role:'admin'},{userId:ids.member,role:'member'}]})
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:otherCompany,ownerUserId:ids.other,members:[{userId:ids.otherAdmin,role:'admin'}]})
  await operator.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'admin')",[company,ids.uninvited])
  runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55463/m65_qa_print',{tls:false,maxConnections:3});db=construct(runtime)
  app=await createStagingServer({profile:'neuvetra.private-synthetic-staging.v1',projectRef:REF,reuseExistingProject:false,origin:ORIGIN,supabaseUrl:`https://${REF}.supabase.co`,supabaseAnonKey:'synthetic-fixture',databaseUrl:url!,webRoot:'.',port:36565},{database:db,validateUser:async token=>token in ids?{id:ids[token as keyof typeof ids],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
  v1=(await db.saveElectricityWorksheet(ids.owner,company,input())).versions[0]!
 },30000)
 afterAll(async()=>{await app?.close();await operator?.close()})
 test('additive migration11 readiness and all original schema10 rows are preserved',async()=>{
  expect((await db.checkReadiness()).schemaVersion).toBe(11)
  const results=[]
  for(const prior of baseline.rowHashes){if(!/^[a-z_]+$/.test(prior.table))throw Error('invalid baseline table');const current=await baselineRows(prior.table);expect(prior.hashes.every((h:string)=>current.includes(h))).toBe(true);results.push({table:prior.table,originalRows:prior.hashes.length,preserved:true})}
  expect(results).toHaveLength(35)
 })
 test('same and different actor/key concurrent requests converge to one report and one audit',async()=>{
  const p=requestFor(v1)
  const responses=await Promise.all([request('owner',company,'',p),request('owner',company,'',p),request('admin',company,'',{...p,idempotencyKey:crypto.randomUUID()})])
  expect(responses.map(r=>r.status)).toEqual([201,201,201]);const reports=await Promise.all(responses.map(r=>r.json()))
  unreviewed=reports[0];expect(reports.map(r=>r.id)).toEqual([unreviewed.id,unreviewed.id,unreviewed.id]);expect(unreviewed.reviewState).toBe('unreviewed')
  const worksheet=(await db.findElectricityWorksheet(ids.owner,company))!;expect(decodeWorksheetReport(unreviewed,worksheet)).toEqual(unreviewed)
  const downloaded=(await db.downloadWorksheetReport(ids.member,company,unreviewed.id))!;originalBytes=downloaded.bytes
  expect(new Bun.CryptoHasher('sha256').update(originalBytes).digest('hex')).toBe(unreviewed.reportSha256)
  for(const value of ['4876.00722','4876.0072',v1.inputSha256,v1.resultSha256,'No worksheet review was recorded when this report was created.'])expect(text(originalBytes)).toContain(value)
  expect(text(originalBytes)).not.toMatch(/\{\{[^{}]*\}\}/)
  expect((await operator.query<{n:number}>('select count(*)::int n from neuvetra.worksheet_report_audit where company_id=$1',[company])).rows[0]!.n).toBe(1)
 })
 test('report metadata and bytes enforce member/active foreign-tenant/uninvited/signedout boundaries',async()=>{
  for(const suffix of ['',`/${unreviewed.id}`,`/${unreviewed.id}/download`]){
   expect((await request('member',company,suffix)).status).toBe(200)
   expect((await request('other',company,suffix)).status).toBe(404)
   expect((await request('outsider',company,suffix)).status).toBe(403)
   expect((await request('uninvited',company,suffix)).status).toBe(403)
   expect((await request(null,company,suffix)).status).toBe(401)
  }
  expect(await db.hasStagingAccess(ids.other)).toBe(true);expect((await request('member',company,'',requestFor(v1))).status).toBe(403)
  for(const actor of [ids.member,ids.other,ids.outsider,ids.uninvited,null])await denied(sqlCreate(actor,company,requestFor(v1)))
  for(const actor of [ids.other,ids.outsider,ids.uninvited,null])for(const table of ['worksheet_reports','worksheet_report_requests','worksheet_report_audit'])expect((await scoped(actor,tx=>tx.query(`select * from neuvetra.${table} where company_id=$1`,[company]))).rows).toHaveLength(0)
  const response=await request('member',company,`/${unreviewed.id}/download`);expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('content-disposition')).toContain('attachment');expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
 })
 test('direct SQL rejects forged request fields, mismatched fingerprints, missing source and inconsistent review pairs',async()=>{
  const p=requestFor(v1)
  for(const patch of [{sourceVersionId:crypto.randomUUID()},{expectedInputSha256:'0'.repeat(64)},{expectedResultSha256:'0'.repeat(64)},{report_bytes:'forged'},{createdBy:ids.admin},{expectedReviewId:crypto.randomUUID()},{expectedReviewSha256:'0'.repeat(64)},{sourceVersionId:null},{expectedInputSha256:42}])await denied(sqlCreate(ids.owner,company,{...p,...patch}))
  expect((await request('owner',company,'',{...p,report_bytes:'forged'})).status).toBe(422)
  expect((await request('owner',company,'',{...p,expectedResultSha256:'0'.repeat(64)})).status).toBe(409)
  for(const table of ['worksheet_reports','worksheet_report_requests','worksheet_report_audit'])await denied(runtime.query(`delete from neuvetra.${table} where company_id=$1`,[company]))
 })
 test('later worksheet review creates a distinct capture while historical unreviewed bytes stay exact',async()=>{
  const oldRequest=requestFor(v1)
  v1=(await db.reviewElectricityWorksheet(ids.admin,company,reviewFor(v1))).versions[0]!
  expect((await db.createWorksheetReport(ids.owner,company,oldRequest)).id).toBe(unreviewed.id)
  accepted=await db.createWorksheetReport(ids.owner,company,requestFor(v1));expect(accepted.id).not.toBe(unreviewed.id);expect(accepted.reviewSha256).toBe(v1.review!.decisionSha256)
  expect(accepted.reviewState).toBe('accepted_bounded_internal_draft')
  expect((await db.downloadWorksheetReport(ids.member,company,unreviewed.id))!.bytes).toEqual(originalBytes)
  const current=(await db.findElectricityWorksheet(ids.member,company))!;expect(decodeWorksheetReport(unreviewed,current).reviewState).toBe('unreviewed')
  v2=(await db.saveElectricityWorksheet(ids.owner,company,correction(v1,'0'),true)).versions[1]!
  expect((await db.findWorksheetReport(ids.member,company,accepted.id))!.reportSha256).toBe(accepted.reportSha256)
  const zero=await db.createWorksheetReport(ids.owner,company,requestFor(v2));expect(zero.source.total).toEqual({unrounded:'0',display:'0.0000',unit:'kg CO2e',rounding:'half_even_4dp'});expect(zero.reviewId).toBeNull()
 })
 test('changes requested and never-existing stale review captures stay distinct, including escaped notes',async()=>{
  v2=(await db.reviewElectricityWorksheet(ids.admin,company,{...reviewFor(v2),decision:'changes_requested',note:'<script>not executable</script> & {{reportSha256}}',acknowledgedLimitations:[]})).versions[1]!
  const changed=await db.createWorksheetReport(ids.owner,company,requestFor(v2));expect(changed.reviewState).toBe('changes_requested')
  const html=text((await db.downloadWorksheetReport(ids.member,company,changed.id))!.bytes);expect(html).toContain('&lt;script&gt;not executable&lt;/script&gt; &amp; &#123;&#123;reportSha256&#125;&#125;');expect(html).not.toContain('<script>');expect(html).toContain('A manager requested changes to this worksheet version.')
  v3=(await db.saveElectricityWorksheet(ids.owner,company,{...correction(v2,'187500'),companyLabel:'<img src=x onerror="alert(1)">',facilityLabel:'& {{sourceSha256}} <svg>'},true)).versions[2]!
  const stale=requestFor(v3);v3=(await db.reviewElectricityWorksheet(ids.admin,company,reviewFor(v3))).versions[2]!
  expect((await request('owner',company,'',stale)).status).toBe(409)
  const report=await db.createWorksheetReport(ids.owner,company,requestFor(v3));const bytes=(await db.downloadWorksheetReport(ids.member,company,report.id))!.bytes
  expect(text(bytes)).not.toMatch(/<(img|svg|script)\b/i);expect(text(bytes)).toContain('&lt;img');expect(text(bytes)).toContain('36570.05415');expect(text(bytes)).toContain('36570.0542')
 })
 test('all accounting cases survive SQL render/read/frontend contract and exact bytes after new connection',async()=>{
  let current:WorksheetVersion|undefined
  for(const c of cases.numerical_cases){current=current?(await db.saveElectricityWorksheet(ids.other,otherCompany,correction(current,c.quantity_kwh),true)).versions.at(-1)!:(await db.saveElectricityWorksheet(ids.other,otherCompany,input(c.quantity_kwh))).versions[0]!
   const report=await db.createWorksheetReport(ids.other,otherCompany,requestFor(current)),worksheet=(await db.findElectricityWorksheet(ids.other,otherCompany))!
   expect(decodeWorksheetReport(report,worksheet)).toEqual(report)
   const downloaded=(await db.downloadWorksheetReport(ids.other,otherCompany,report.id))!;const html=text(downloaded.bytes)
   for(const value of [c.quantity_kwh+' kWh',c.quantity_mwh+' MWh',c.total_unrounded_kg_co2e+' kg CO2e',c.total_display_kg_co2e+' kg CO2e',cases.required_review_qualification])expect(html).toContain(value)
   expect(downloaded.bytes).toEqual(buildWorksheetReport({id:report.id,companyId:otherCompany,createdBy:report.createdBy,createdAt:report.createdAt,source:report.source}).bytes)
  }
  const fresh=construct(createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55463/m65_qa_print',{tls:false,maxConnections:1}));try{expect(await fresh.downloadWorksheetReport(ids.member,company,unreviewed.id)).toEqual(await db.downloadWorksheetReport(ids.member,company,unreviewed.id))}finally{await fresh.close()}
 })
 test('a report captured while an earlier-started review waits remains verifiable after that review commits',async()=>{
  const prior=(await db.findElectricityWorksheet(ids.other,otherCompany))!.versions.at(-1)!
  const source=(await db.saveElectricityWorksheet(ids.other,otherCompany,correction(prior,'31415'),true)).versions.at(-1)!
  let pending:Promise<unknown>|undefined,reportId=''
  await operator.transaction(async tx=>{
   await tx.query('select id from neuvetra.companies where id=$1 for update',[otherCompany])
   pending=db.reviewElectricityWorksheet(ids.otherAdmin,otherCompany,reviewFor(source))
   let blocked=false
   for(let i=0;i<40;i++){const waiters=await tx.query<{n:number}>("select count(*)::int n from pg_stat_activity where datname=current_database() and usename='neuvetra_runtime' and wait_event_type='Lock' and query like '%review_electricity_worksheet%'");if(waiters.rows[0]!.n>0){blocked=true;break}await new Promise(resolve=>setTimeout(resolve,10))}
   expect(blocked).toBe(true)
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.other])
   reportId=(await tx.query<{id:string}>('select neuvetra.create_worksheet_report($1,$2::text::jsonb) id',[otherCompany,JSON.stringify(requestFor(source))])).rows[0]!.id
  })
  await pending
  const report=await db.findWorksheetReport(ids.other,otherCompany,reportId);expect(report!.reviewId).toBeNull();expect((await db.downloadWorksheetReport(ids.other,otherCompany,reportId))!.report.id).toBe(reportId)
 })
 test('concurrent correction cannot silently substitute the explicitly requested historical source',async()=>{
  const before=(await db.findElectricityWorksheet(ids.other,otherCompany))!.versions.at(-1)!
  const payload=requestFor(before)
  const [report,updated]=await Promise.all([db.createWorksheetReport(ids.other,otherCompany,payload),db.saveElectricityWorksheet(ids.other,otherCompany,correction(before,'27182'),true)])
  expect(report.sourceVersionId).toBe(before.id);expect(report.inputSha256).toBe(before.inputSha256);expect(report.resultSha256).toBe(before.resultSha256)
  expect(updated.versions.at(-1)!.id).not.toBe(before.id)
  expect(decodeWorksheetReport(report,updated).sourceVersionId).toBe(before.id)
  await denied(db.createWorksheetReport(ids.other,otherCompany,{...requestFor(updated.versions.at(-1)!),idempotencyKey:payload.idempotencyKey}))
  expect((await db.downloadWorksheetReport(ids.other,otherCompany,report.id))!.report.reportSha256).toBe(report.reportSha256)
 })
 test('immutable triggers and coordinated bytes/hash/length, source, review, template and audit corruption refuse',async()=>{
  for(const table of ['worksheet_reports','worksheet_report_requests','worksheet_report_audit'])await denied(operator.query(`delete from neuvetra.${table} where company_id=$1`,[company]))
  const corruptions=[
   "update neuvetra.worksheet_reports set report_bytes=convert_to('forged but matching byte hash','utf8'),report_sha256=encode(sha256(convert_to('forged but matching byte hash','utf8')),'hex'),report_byte_length=length('forged but matching byte hash') where id=$1",
   "update neuvetra.worksheet_reports set source_snapshot=jsonb_set(source_snapshot,'{companyLabel}','\"Forged company\"') where id=$1",
   "update neuvetra.worksheet_reports set template_sha256=repeat('0',64) where id=$1",
   "update neuvetra.worksheet_reports set source_result_sha256=repeat('0',64) where id=$1",
   "delete from neuvetra.worksheet_report_audit where report_id=$1",
   "update neuvetra.worksheet_report_audit set actor_id=$2 where report_id=$1",
   "update neuvetra.worksheet_reports set review_sha256=repeat('0',64) where id=$1",
  ]
  for(const sql of corruptions){const params=sql.includes('$2')?[accepted.id,ids.member]:[accepted.id];const error=await denied(operator.transaction(async tx=>{await tx.exec("set local session_replication_role='replica'");await tx.query(sql,params);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.owner]);await tx.exec('set local role neuvetra_runtime');await readWorksheetReports(tx,company);throw Error('UNEXPECTED_SUCCESS')}));expect(error.message).toContain('could not be verified')}
  expect((await db.downloadWorksheetReport(ids.member,company,unreviewed.id))!.bytes).toEqual(originalBytes)
 })
 test('revocation blocks metadata/bytes/SQL while other pooled actors remain correctly scoped',async()=>{
  for(let round=0;round<3;round++){const reads=await Promise.all([db.findWorksheetReports(ids.owner,company),db.findWorksheetReports(ids.other,company),db.findWorksheetReports(ids.member,company)]);expect(reads[0]!.companyId).toBe(company);expect(reads[1]).toBeNull();expect(reads[2]!.companyId).toBe(company)}
  await revokeStagingAccess(operator,ids.member)
  for(const suffix of ['',`/${unreviewed.id}`,`/${unreviewed.id}/download`])expect((await request('member',company,suffix)).status).toBe(403)
  expect((await scoped(ids.member,tx=>tx.query('select * from neuvetra.worksheet_reports where company_id=$1',[company]))).rows).toHaveLength(0)
  expect((await db.findWorksheetReport(ids.owner,company,unreviewed.id))!.id).toBe(unreviewed.id)
 })
 test('all frozen original999 rows remain unchanged after report lifecycle and corruption probes',async()=>{
  let count=0
  for(const prior of baseline.rowHashes){const values=await baselineRows(prior.table);expect(prior.hashes.every((h:string)=>values.includes(h))).toBe(true);count+=prior.hashes.length}
  expect(count).toBe(999)
 })
})
