import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {HostedWorkspaceDatabase,createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {migratePrivateStaging,readMigrationManifest,provisionStagingRoster,revokeStagingAccess} from '../../packages/neuvetra-database/src/staging-migrations'
import {M66_LIMITATIONS,type ElectricitySource,type SourceWorksheetVersion,type SourceWorksheetReport} from '../../packages/neuvetra-database/src/m66-contract'
import {readElectricitySources} from '../../packages/neuvetra-database/src/m66-sources'
import {readSourceElectricityWorksheet} from '../../packages/neuvetra-database/src/m66'
import {readSourceWorksheetReports} from '../../packages/neuvetra-database/src/m66-report'
import {createStagingServer} from '../../apps/site-api/src/staging/server'
import {decodeSourceElectricityWorksheet,decodeElectricitySource} from '../../apps/site-web/src/lib/m66-api'
import {decodeSourceWorksheetReport} from '../../apps/site-web/src/lib/m66-report-api'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {hashManifestValue} from '../../tools/staging/create-source-manifest'
const url=process.env.M66_TEST_DATABASE_URL,expectedMigration=process.env.M66_TEST_MIGRATION_SHA
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||u.port!=='55463'||u.pathname!=='/m66_qa'||u.username!=='m63_test_admin'||u.password||u.search||u.hash||!/^[a-f0-9]{64}$/.test(expectedMigration??''))throw Error('Explicit reviewed migration on dedicated m66_qa only')}
const pg=url?describe:describe.skip,REF='abcdefghijklmnopqrst',ORIGIN='http://127.0.0.1:36666'
const baseline=await Bun.file(new URL('./m66-baseline-receipt.json',import.meta.url)).json(),cases=await Bun.file(new URL('./m66-accounting-cases.json',import.meta.url)).json()
const fixtures=await Promise.all([cases.source_A,cases.source_B].map(async(f:any)=>({...f,name:f.path.split('/').at(-1),data:new Uint8Array(await Bun.file(new URL('../../'+f.path,import.meta.url)).arrayBuffer())})))
async function denied(p:Promise<unknown>){try{await p;throw Error('UNEXPECTED_SUCCESS')}catch(e){if(e instanceof Error&&e.message!=='UNEXPECTED_SUCCESS')return e;throw e}}
const decode=(b:Uint8Array)=>new TextDecoder('utf-8',{fatal:true}).decode(b)
pg('M66 independent actual PostgreSQL source-to-report',()=>{
 let operator:WorkspaceConnection,runtime:WorkspaceConnection,db:HostedWorkspaceDatabase,app:Awaited<ReturnType<typeof createStagingServer>>
 const ids={owner:crypto.randomUUID(),admin:crypto.randomUUID(),member:crypto.randomUUID(),other:crypto.randomUUID(),otherAdmin:crypto.randomUUID(),outsider:crypto.randomUUID(),uninvited:crypto.randomUUID()}
 const company=crypto.randomUUID(),otherCompany=crypto.randomUUID()
 let a:ElectricitySource,b:ElectricitySource,otherA:ElectricitySource,v1:SourceWorksheetVersion,v2:SourceWorksheetVersion,oldReport:SourceWorksheetReport,oldBytes:Uint8Array
 const construct=(c:WorkspaceConnection)=>new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(c,REF)
 const scoped=<T>(actor:string|null,fn:(tx:WorkspaceSql)=>Promise<T>)=>runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);return fn(tx)})
 const input=(s:ElectricitySource,q='12345.000',reason:string|null=null)=>({companyLabel:'Fictional QA company',facilityLabel:'Fictional CAMX facility',quantityKwh:q,period:'2023-01' as const,geography:'CAMX' as const,unit:'kWh' as const,idempotencyKey:crypto.randomUUID(),sourceId:s.id,expectedSourceSha256:s.sha256,sourcePage:1 as const,manualConfirmation:true as const,quantityDifferenceReason:reason})
 const correction=(v:SourceWorksheetVersion,s:ElectricitySource,q=v.quantityKwh,reason=v.evidence.quantityDifferenceReason)=>({...input(s,q,reason),expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:'Independent fictional source correction'})
 const reportInput=(v:SourceWorksheetVersion)=>({sourceVersionId:v.id,expectedInputSha256:v.inputSha256,expectedResultSha256:v.resultSha256,expectedReviewId:v.review?.id??null,expectedReviewSha256:v.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()})
 const reviewInput=(v:SourceWorksheetVersion)=>({versionId:v.id,expectedResultSha256:v.resultSha256,decision:'accept_bounded_internal_draft' as const,note:null,acknowledgedLimitations:[...M66_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
 const form=(f=fixtures[0],key=crypto.randomUUID())=>{const x=new FormData();x.append('file',new File([f.data],f.name,{type:'application/pdf'}));x.append('idempotencyKey',key);return x}
 const request=(actor:keyof typeof ids|null,suffix='',payload?:unknown,c=company)=>app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/${c}/source-electricity-worksheet${suffix}`,{method:payload===undefined?'GET':'POST',headers:{origin:ORIGIN,...(actor?{authorization:`Bearer ${actor}`} : {}),...(payload===undefined||payload instanceof FormData?{}:{'content-type':'application/json'})},body:payload===undefined?undefined:payload instanceof FormData?payload:JSON.stringify(payload)}))
 const sqlUpload=(actor:string|null,c:string,f=fixtures[0],key=crypto.randomUUID())=>scoped(actor,tx=>tx.query('select neuvetra.upload_electricity_source($1,$2,$3,$4::text,$5) id',[c,f.name,'application/pdf',Buffer.from(f.data).toString('hex'),key]))
 const sqlSave=(actor:string|null,c:string,p:unknown,correct=false)=>scoped(actor,tx=>tx.query('select neuvetra.save_source_worksheet($1,$2::text::jsonb,$3)',[c,JSON.stringify(p),correct]))
 const counts=async(c=company)=>(await operator.query<{sources:number;source_audit:number;source_requests:number;versions:number;reviews:number;requests:number;audits:number}>(`select (select count(*)::int from neuvetra.electricity_sources where company_id=$1) sources,(select count(*)::int from neuvetra.electricity_source_audit where company_id=$1) source_audit,(select count(*)::int from neuvetra.electricity_source_requests where company_id=$1) source_requests,(select count(*)::int from neuvetra.source_worksheet_versions where company_id=$1) versions,(select count(*)::int from neuvetra.source_worksheet_reviews where company_id=$1) reviews,(select count(*)::int from neuvetra.source_worksheet_requests where company_id=$1) requests,(select count(*)::int from neuvetra.source_worksheet_audit where company_id=$1) audits`,[c])).rows[0]!
 const preserved=async()=>{let n=0;for(const prior of baseline.rowHashes){if(!/^[a-z_]+$/.test(prior.table))throw Error('Invalid baseline identifier');const current=(await operator.query<{value:unknown}>(`select to_jsonb(t) value from neuvetra.${prior.table} t`)).rows.map(r=>hashManifestValue(r.value));expect(prior.hashes.every((h:string)=>current.includes(h))).toBe(true);n+=prior.hashes.length}expect(n).toBe(1113)}
 beforeAll(async()=>{
  const manifest=await readMigrationManifest();expect(manifest).toHaveLength(12);expect(manifest[11]!.sha256).toBe(expectedMigration!)
  operator=createPostgresConnection(url!,{tls:false});await migratePrivateStaging(operator,{expectedProjectRef:REF,syntheticTargetConfirmed:true})
  for(const id of Object.values(ids))await operator.query('insert into auth.users(id) values($1)',[id])
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:ids.owner,members:[{userId:ids.admin,role:'admin'},{userId:ids.member,role:'member'}]})
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:otherCompany,ownerUserId:ids.other,members:[{userId:ids.otherAdmin,role:'admin'}]})
  await operator.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'admin')",[company,ids.uninvited])
  runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55463/m66_qa',{tls:false,maxConnections:3});db=construct(runtime)
  app=await createStagingServer({profile:'neuvetra.private-synthetic-staging.v1',projectRef:REF,reuseExistingProject:false,origin:ORIGIN,supabaseUrl:`https://${REF}.supabase.co`,supabaseAnonKey:'synthetic-fixture',databaseUrl:url!,webRoot:'.',port:36666},{database:db,validateUser:async token=>token in ids?{id:ids[token as keyof typeof ids],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
 },30000)
 afterAll(async()=>{await app?.close();await operator?.close()})
 test('additive schema12 retains every baseline row and exact approved PDF identity',async()=>{
  expect((await db.checkReadiness()).schemaVersion).toBe(12);await preserved();expect(baseline.rowHashes).toHaveLength(38)
  for(const f of fixtures){expect(f.data.byteLength).toBe(f.bytes);expect(new Bun.CryptoHasher('sha256').update(f.data).digest('hex')).toBe(f.sha256)}
 })
 test('real multipart concurrent upload converges, remains unconfirmed, and downloads exact original bytes',async()=>{
  const key=crypto.randomUUID(),responses=await Promise.all([request('owner','/sources',form(fixtures[0],key)),request('owner','/sources',form(fixtures[0],key)),request('admin','/sources',form(fixtures[0]))])
  expect(responses.map(r=>r.status)).toEqual([201,201,201]);const items=await Promise.all(responses.map(r=>r.json()));a=decodeElectricitySource(items[0],company);expect(items.map(s=>s.id)).toEqual([a.id,a.id,a.id])
  expect((await counts()).source_audit).toBe(1);expect((await counts()).versions).toBe(0)
  const r=await request('owner','/sources',form(fixtures[1]));expect(r.status).toBe(201);b=decodeElectricitySource(await r.json(),company);expect(a.id).not.toBe(b.id)
  for(const [source,f] of [[a,fixtures[0]],[b,fixtures[1]]] as const){const download=await request('member',`/sources/${source.id}/download`);expect(download.status).toBe(200);expect(download.headers.get('cache-control')).toBe('no-store');expect(download.headers.get('content-disposition')).toContain('attachment');expect(new Uint8Array(await download.arrayBuffer())).toEqual(f.data);expect((await db.downloadElectricitySource(ids.owner,company,source.id))!.bytes).toEqual(f.data)}
  const conflict=await request('owner','/sources',form(fixtures[1],key));expect(conflict.status).toBe(409)
 })
 test('unsupported, altered, oversized and duplicate multipart fields refuse without source/audit writes',async()=>{
  const before=await counts(),changed=fixtures[0].data.slice();changed[0]^=1
  for(const f of [{...fixtures[0],data:changed},{...fixtures[0],name:'other.pdf'},{...fixtures[0],data:new Uint8Array(0)},{...fixtures[0],data:new Uint8Array(262145)}])expect((await request('owner','/sources',form(f))).status).toBe(422)
  const tooLarge=form({...fixtures[0],data:new Uint8Array(300001)});expect((await request('owner','/sources',tooLarge)).status).toBe(413)
  for(const field of ['file','idempotencyKey','unexpected']){const f=form();f.append(field,'duplicate');expect((await request('owner','/sources',f)).status).toBe(422)}
  await denied(sqlUpload(ids.owner,company,{...fixtures[0],data:changed}));expect(await counts()).toEqual(before)
 })
 test('Bun normalizes approved PDF multipart MIME; exact supported bytes remain the admission boundary',async()=>{
  const f=new File([fixtures[0].data],fixtures[0].name,{type:'text/plain'}),body=new FormData();body.append('file',f);body.append('idempotencyKey',crypto.randomUUID())
  const r=new Request(ORIGIN,{method:'POST',body});expect((await r.clone().text()).includes('Content-Type: text/plain')).toBe(true);expect(((await r.formData()).get('file') as File).type).toBe('application/pdf')
  expect((await request('owner','/sources',body)).status).toBe(201)
  await denied(scoped(ids.owner,tx=>tx.query('select neuvetra.upload_electricity_source($1,$2,$3,$4::text,$5)',[company,fixtures[0].name,'text/plain',Buffer.from(fixtures[0].data).toString('hex'),crypto.randomUUID()])))
 })
 test('active second tenant, member, uninvited membership and signedout source boundaries hold in API and SQL',async()=>{
  for(const suffix of ['/sources',`/sources/${a.id}`,`/sources/${a.id}/download`])for(const [actor,status] of [['member',200],['other',404],['outsider',403],['uninvited',403],[null,401]] as const)expect((await request(actor,suffix)).status).toBe(status)
  expect((await request('member','/sources',form())).status).toBe(403)
  for(const actor of [ids.member,ids.other,ids.outsider,ids.uninvited,null])await denied(sqlUpload(actor,company))
  for(const actor of [ids.other,ids.outsider,ids.uninvited,null])expect((await scoped(actor,tx=>tx.query('select * from neuvetra.electricity_sources where company_id=$1',[company]))).rows).toHaveLength(0)
  otherA=await db.uploadElectricitySource(ids.other,otherCompany,fixtures[0].name,'application/pdf',fixtures[0].data,crypto.randomUUID());expect(otherA.id).not.toBe(a.id);expect(otherA.sha256).toBe(a.sha256)
 })
 test('invalid initial confirmation is atomic while legitimate prior uploads remain durable',async()=>{
  const before=await counts(),p=input(a)
  for(const patch of [{quantityKwh:'25000'},{quantityKwh:'0'},{sourcePage:0},{sourcePage:2},{sourcePage:'1'},{manualConfirmation:false},{manualConfirmation:'true'},{expectedSourceSha256:'f'.repeat(64)},{sourceId:otherA.id},{quantityDifferenceReason:'Not allowed for equal quantity'},{confirmedBy:ids.admin},{quantityKwh:null}]){const res=await request('owner','',{...p,...patch});expect([409,422]).toContain(res.status);await denied(sqlSave(ids.owner,company,{...p,...patch}))}
  expect(await counts()).toEqual(before);expect((await db.downloadElectricitySource(ids.owner,company,a.id))!.bytes).toEqual(fixtures[0].data)
 })
 test('explicit initial confirmation binds source/actor/time and creates immutable source report',async()=>{
  const p=input(a),responses=await Promise.all([request('owner','',p),request('owner','',p)])
  expect(responses.map(r=>r.status)).toEqual([201,201]);const w=decodeSourceElectricityWorksheet(await responses[0]!.json(),company);v1=w.versions[0]!
  expect(v1.quantityKwh).toBe('12345.000');expect(v1.evidence.source).toEqual(a);expect(v1.evidence.confirmedBy).toBe(ids.owner);expect(v1.evidence.confirmedAt).toBe(v1.createdAt);expect(v1.review).toBeNull();expect((await counts()).versions).toBe(1)
  const reports=await Promise.all([db.createSourceWorksheetReport(ids.owner,company,reportInput(v1)),db.createSourceWorksheetReport(ids.admin,company,reportInput(v1))]);expect(reports[0]!.id).toBe(reports[1]!.id);oldReport=decodeSourceWorksheetReport(reports[0],w);oldBytes=(await db.downloadSourceWorksheetReport(ids.member,company,oldReport.id))!.bytes
  expect(decode(oldBytes)).toContain(a.sha256);expect(decode(oldBytes)).toContain('2407.7724 kg CO2e');expect(decode(oldBytes)).toContain('12345.000 kWh');expect(new Bun.CryptoHasher('sha256').update(oldBytes).digest('hex')).toBe(oldReport.reportSha256)
  await denied(db.reviewSourceElectricityWorksheet(ids.owner,company,reviewInput(v1)))
 })
 test('review followed by evidence-only A-to-B correction produces fresh review and preserves prior reports/source',async()=>{
  v1=(await db.reviewSourceElectricityWorksheet(ids.admin,company,reviewInput(v1))).versions[0]!
  const reviewed=await db.createSourceWorksheetReport(ids.owner,company,reportInput(v1));expect(reviewed.id).not.toBe(oldReport.id)
  const res=await request('owner','/corrections',correction(v1,b));expect(res.status).toBe(201);const w=decodeSourceElectricityWorksheet(await res.json(),company);v2=w.versions[1]!
  expect(v2.quantityKwh).toBe(v1.quantityKwh);expect(v2.total).toEqual(v1.total);expect(v2.evidence.source.id).toBe(b.id);expect(v2.inputSha256).not.toBe(v1.inputSha256);expect(v2.resultSha256).not.toBe(v1.resultSha256);expect(v2.review).toBeNull()
  const rb=await db.createSourceWorksheetReport(ids.owner,company,reportInput(v2));expect(rb.reportSha256).not.toBe(oldReport.reportSha256)
  expect((await db.downloadSourceWorksheetReport(ids.member,company,oldReport.id))!.bytes).toEqual(oldBytes);expect((await db.downloadElectricitySource(ids.member,company,a.id))!.bytes).toEqual(fixtures[0].data)
  await denied(db.saveSourceElectricityWorksheet(ids.owner,company,correction(v1,a),true));await denied(db.reviewSourceElectricityWorksheet(ids.admin,company,{...reviewInput(v2),expectedResultSha256:v1.resultSha256}))
 })
 test('all10 independent numeric cases persist through native source report and actual frontend decoder',async()=>{
  let previous=(await db.findSourceElectricityWorksheet(ids.owner,company))!.versions.at(-1)!
  for(const [i,c] of cases.numerical_cases.entries()){
   const s=previous.evidence.source.id===a.id?b:a,p=correction(previous,s,c.input_quantity,c.discrepancy_reason)
   const w=await db.saveSourceElectricityWorksheet(ids.owner,company,p,true);previous=w.versions.at(-1)!;decodeSourceElectricityWorksheet(w,company)
   expect(previous.quantityKwh).toBe(c.quantity_kwh);expect(previous.quantityMwh).toBe(c.quantity_mwh);expect(previous.total.unrounded).toBe(c.unrounded_kg_co2e);expect(previous.total.display).toBe(c.display_kg_co2e)
   const report=await db.createSourceWorksheetReport(ids.owner,company,reportInput(previous));expect(decodeSourceWorksheetReport(report,w).source.evidence.quantityDifferenceReason).toBe(c.discrepancy_reason)
   const html=decode((await db.downloadSourceWorksheetReport(ids.member,company,report.id))!.bytes);expect(html).toContain(c.display_kg_co2e+' kg CO2e');expect(html).toContain(s.sha256);if(c.discrepancy_reason)expect(html).toContain(c.discrepancy_reason)
  }
 })
 test('discrepancy-only and label-only corrections are valid; canonical effective no-op refuses',async()=>{
  let previous=(await db.findSourceElectricityWorksheet(ids.owner,company))!.versions.at(-1)!
  if(previous.quantityKwh==='12345.000')previous=(await db.saveSourceElectricityWorksheet(ids.owner,company,correction(previous,a,'25000','Synthetic selection differs'),true)).versions.at(-1)!
  for(const patch of [{quantityDifferenceReason:'Clarified synthetic discrepancy <script>x</script> & {{sourceSha256}}'},{companyLabel:'Corrected fictional company'},{facilityLabel:'Corrected fictional facility'}]){
   const p={...correction(previous,previous.evidence.source),companyLabel:previous.companyLabel,facilityLabel:previous.facilityLabel,...patch};const res=await request('owner','/corrections',p);expect(res.status).toBe(201);const w=decodeSourceElectricityWorksheet(await res.json(),company);previous=w.versions.at(-1)!;expect(previous.review).toBeNull()
  }
  await denied(db.saveSourceElectricityWorksheet(ids.owner,company,{...correction(previous,previous.evidence.source),companyLabel:previous.companyLabel,facilityLabel:previous.facilityLabel},true))
  const report=await db.createSourceWorksheetReport(ids.owner,company,reportInput(previous)),html=decode((await db.downloadSourceWorksheetReport(ids.owner,company,report.id))!.bytes);expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
 })
 test('long escaped confirmation and changes-requested decision remain captured without granting report approval',async()=>{
  const previous=(await db.findSourceElectricityWorksheet(ids.owner,company))!.versions.at(-1)!
  const label=('Fictional <company> & '.repeat(6)).slice(0,99)+'X',facility=('Fictional <facility> & '.repeat(6)).slice(0,99)+'X',reason=('Synthetic <script> discrepancy & '.repeat(20)).slice(0,499)+'X'
  const w=await db.saveSourceElectricityWorksheet(ids.owner,company,{...correction(previous,previous.evidence.source,'25000',reason),companyLabel:label,facilityLabel:facility,correctionReason:reason},true),v=w.versions.at(-1)!
  const note=('Synthetic <review> request & '.repeat(20)).slice(0,499)+'X'
  const reviewed=await db.reviewSourceElectricityWorksheet(ids.admin,company,{...reviewInput(v),decision:'changes_requested',note,acknowledgedLimitations:[]}),r=await db.createSourceWorksheetReport(ids.owner,company,reportInput(reviewed.versions.at(-1)!))
  expect(decodeSourceWorksheetReport(r,reviewed).reviewState).toBe('changes_requested');const html=decode((await db.downloadSourceWorksheetReport(ids.owner,company,r.id))!.bytes)
  expect(html).toContain('A manager requested changes');expect(html).toContain('&lt;script&gt;');expect(html).toContain('&lt;review&gt;');expect(html).not.toContain('<script>');expect(html).toContain('does not authenticate the fictional bill');expect(html).toContain('4876.0072 kg CO2e')
 })
 test('native transaction rollback removes source/request/audit as one atomic operation',async()=>{
  const before=await counts(otherCompany),key=crypto.randomUUID()
  await denied(scoped(ids.other,async tx=>{await tx.query('select neuvetra.upload_electricity_source($1,$2,$3,$4::text,$5)',[otherCompany,fixtures[1].name,'application/pdf',Buffer.from(fixtures[1].data).toString('hex'),key]);await tx.query('select 1/0')}))
  expect(await counts(otherCompany)).toEqual(before);await sqlUpload(ids.other,otherCompany,fixtures[1],key);expect((await counts(otherCompany)).sources).toBe(before.sources+1)
 })
 test('genuinely queued review cannot invalidate a report captured before its serialized decision',async()=>{
  const w=await db.saveSourceElectricityWorksheet(ids.other,otherCompany,input(otherA)),v=w.versions[0]!;let pending:ReturnType<typeof db.reviewSourceElectricityWorksheet>|undefined,reportId=''
  await operator.transaction(async tx=>{
   await tx.query('select id from neuvetra.companies where id=$1 for update',[otherCompany]);pending=db.reviewSourceElectricityWorksheet(ids.otherAdmin,otherCompany,reviewInput(v));let waiting=false
   for(let i=0;i<80;i++){const r=await tx.query<{n:number}>("select count(*)::int n from pg_stat_activity where datname=current_database() and usename='neuvetra_runtime' and wait_event_type='Lock' and query like '%review_source_worksheet%' ");if(r.rows[0]!.n){waiting=true;break}await new Promise(r=>setTimeout(r,10))}expect(waiting).toBe(true)
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.other]);reportId=(await tx.query<{id:string}>('select neuvetra.create_source_worksheet_report($1,$2::text::jsonb) id',[otherCompany,JSON.stringify(reportInput(v))])).rows[0]!.id
  });await pending!;const report=(await db.findSourceWorksheetReport(ids.other,otherCompany,reportId))!;expect(report.reviewState).toBe('unreviewed');expect((await db.downloadSourceWorksheetReport(ids.other,otherCompany,reportId))!.report.reportSha256).toBe(report.reportSha256)
 })
 test('concurrent source correction and report capture preserve explicit historical lineage',async()=>{
  const before=(await db.findSourceElectricityWorksheet(ids.other,otherCompany))!.versions.at(-1)!,otherB=(await db.findElectricitySources(ids.other,otherCompany))!.sources.find(s=>s.sha256===fixtures[1].sha256)!
  const [r,w]=await Promise.all([db.createSourceWorksheetReport(ids.other,otherCompany,reportInput(before)),db.saveSourceElectricityWorksheet(ids.other,otherCompany,correction(before,otherB),true)])
  expect(r.sourceVersionId).toBe(before.id);expect(r.source.evidence.source.id).toBe(otherA.id);expect(w.versions.at(-1)!.evidence.source.id).toBe(otherB.id);expect(decodeSourceWorksheetReport(r,w).id).toBe(r.id)
 })
 test('immutable source/history writes and coordinated bytes/hash/length or lineage corruption fail closed',async()=>{
  for(const table of ['electricity_sources','electricity_source_requests','electricity_source_audit','source_worksheet_versions','source_worksheet_reviews','source_worksheet_requests','source_worksheet_audit','source_worksheet_reports','source_worksheet_report_requests','source_worksheet_report_audit'])await denied(runtime.query(`delete from neuvetra.${table} where company_id=$1`,[company]))
  const probes=[
   {sql:"update neuvetra.electricity_sources set original_bytes=decode('00','hex'),sha256=encode(sha256(decode('00','hex')),'hex'),byte_length=1 where id=$1",params:[a.id]},
   {sql:"update neuvetra.electricity_sources set printed_quantity_kwh='25000.000' where id=$1",params:[a.id]},
   {sql:'delete from neuvetra.electricity_source_audit where source_id=$1',params:[a.id]},
   {sql:"update neuvetra.source_worksheet_versions set payload=jsonb_set(payload,'{evidence,page}','2'::jsonb) where id=$1",params:[v1.id]},
   {sql:"update neuvetra.source_worksheet_versions set payload=jsonb_set(payload,'{evidence,confirmedBy}',to_jsonb($2::text)) where id=$1",params:[v1.id,ids.admin]},
   {sql:"update neuvetra.source_worksheet_reports set report_bytes=decode('00','hex'),report_sha256=encode(sha256(decode('00','hex')),'hex'),report_byte_length=1 where id=$1",params:[oldReport.id]},
   {sql:'delete from neuvetra.source_worksheet_report_audit where report_id=$1',params:[oldReport.id]},
  ]
  for(const probe of probes){await denied(operator.transaction(async tx=>{await tx.query("set local session_replication_role='replica'");await tx.query(probe.sql,probe.params);await tx.query('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.owner]);let refusal=false;try{await readSourceWorksheetReports(tx,company)}catch{refusal=true}expect(refusal).toBe(true);throw Error('rollback isolated tamper')}))}
  expect((await db.downloadSourceWorksheetReport(ids.member,company,oldReport.id))!.bytes).toEqual(oldBytes);expect((await db.downloadElectricitySource(ids.member,company,a.id))!.bytes).toEqual(fixtures[0].data)
 })
 test('revoked member loses source and derived report access while pooled authorized actors stay isolated',async()=>{
  const mixed=await Promise.all(Array.from({length:12},(_,i)=>db.findElectricitySource(i%2?ids.other:ids.member,company,a.id)));expect(mixed.every((v,i)=>i%2?v===null:v?.id===a.id)).toBe(true)
  await revokeStagingAccess(operator,ids.member)
  for(const suffix of ['/sources',`/sources/${a.id}`,`/sources/${a.id}/download`,'',`/reports/${oldReport.id}`,`/reports/${oldReport.id}/download`])expect((await request('member',suffix)).status).toBe(403)
  expect((await scoped(ids.member,tx=>tx.query('select * from neuvetra.electricity_sources where company_id=$1',[company]))).rows).toHaveLength(0);expect((await db.findElectricitySource(ids.owner,company,a.id))!.id).toBe(a.id)
 })
 test('reopened connection recovers exact source/report bytes and all1113 original rows',async()=>{
  const connection=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55463/m66_qa',{tls:false,maxConnections:1}),fresh=construct(connection)
  try{expect((await fresh.downloadElectricitySource(ids.owner,company,a.id))!.bytes).toEqual(fixtures[0].data);expect((await fresh.downloadSourceWorksheetReport(ids.owner,company,oldReport.id))!.bytes).toEqual(oldBytes);expect((await fresh.checkReadiness()).schemaVersion).toBe(12)}finally{await fresh.close()}
  await preserved()
 })
})
