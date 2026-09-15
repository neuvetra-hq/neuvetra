import {afterAll,beforeAll,describe,expect,test} from 'bun:test'
import {HostedWorkspaceDatabase,createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {migratePrivateStaging,readMigrationManifest,provisionStagingRoster,revokeStagingAccess} from '../../packages/neuvetra-database/src/staging-migrations'
import {M67_PROFILE,M67_METHOD,M67_LIMITATIONS,M67_MONTHS,type AnnualWorksheetVersion,type AnnualWorksheetReport} from '../../packages/neuvetra-database/src/m67-contract'
import {readAnnualElectricityWorksheet,m67CanonicalJson} from '../../packages/neuvetra-database/src/m67'
import {readAnnualWorksheetReports} from '../../packages/neuvetra-database/src/m67-report'
import {createStagingServer} from '../../apps/site-api/src/staging/server'
import {decodeAnnualElectricityWorksheet} from '../../apps/site-web/src/lib/m67-api'
import {decodeAnnualWorksheetReport} from '../../apps/site-web/src/lib/m67-report-api'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {hashManifestValue} from '../../tools/staging/create-source-manifest'
const url=process.env.M67_TEST_DATABASE_URL,expectedMigration=process.env.M67_TEST_MIGRATION_SHA
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||u.port!=='55463'||u.pathname!=='/m67_qa'||u.username!=='m63_test_admin'||u.password||u.search||u.hash||!/^[a-f0-9]{64}$/.test(expectedMigration??''))throw Error('Explicit reviewed migration on dedicated m67_qa only')}
const pg=url?describe:describe.skip,REF='abcdefghijklmnopqrst',ORIGIN='http://127.0.0.1:36667'
const baseline=await Bun.file(new URL('./m67-baseline-receipt.json',import.meta.url)).json(),cases=await Bun.file(new URL('./m67-accounting-cases.json',import.meta.url)).json()
const tables=['annual_electricity_worksheet_versions','annual_electricity_worksheet_reviews','annual_electricity_worksheet_requests','annual_electricity_worksheet_audit','annual_electricity_reports','annual_electricity_report_requests','annual_electricity_report_audit']
const sha=(s:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(s).digest('hex')
// Independently spell the approved compact object/array preimage; product helper is compared, not used as oracle.
function canonical(x:any):string {if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}'}
async function denied(fn:()=>Promise<unknown>){let rejected=false;try{await fn()}catch{rejected=true}expect(rejected).toBe(true)}
pg('M67 independent actual PostgreSQL annual source-to-report',()=>{
 let operator:WorkspaceConnection,runtime:WorkspaceConnection,db:HostedWorkspaceDatabase,app:Awaited<ReturnType<typeof createStagingServer>>
 const ids={owner:crypto.randomUUID(),admin:crypto.randomUUID(),member:crypto.randomUUID(),other:crypto.randomUUID(),otherAdmin:crypto.randomUUID(),outsider:crypto.randomUUID(),uninvited:crypto.randomUUID()}
 const company=crypto.randomUUID(),otherCompany=crypto.randomUUID()
 let first:AnnualWorksheetVersion,current:AnnualWorksheetVersion,oldReport:AnnualWorksheetReport,oldBytes:Uint8Array
 const construct=(c:WorkspaceConnection)=>new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(c,REF)
 const scoped=<T>(actor:string|null,fn:(tx:WorkspaceSql)=>Promise<T>)=>runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor??'']);return fn(tx)})
 const input=(caseId='one_zero_remaining_missing')=>({companyLabel:'Fictional QA company',facilityLabel:'Fictional CAMX facility',year:2023 as const,geography:'CAMX' as const,unit:'kWh' as const,months:structuredClone(cases.accepted_cases.find((c:any)=>c.id===caseId).months),idempotencyKey:crypto.randomUUID()})
 const correction=(v:AnnualWorksheetVersion,p=input())=>({...p,expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:'Independent fictional annual correction'})
 const reportInput=(v:AnnualWorksheetVersion)=>({sourceVersionId:v.id,expectedInputSha256:v.inputSha256,expectedResultSha256:v.resultSha256,expectedReviewId:v.review?.id??null,expectedReviewSha256:v.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()})
 const reviewInput=(v:AnnualWorksheetVersion)=>({versionId:v.id,expectedResultSha256:v.resultSha256,decision:'accept_bounded_internal_draft' as const,note:null,acknowledgedLimitations:[...M67_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
 const request=(actor:keyof typeof ids|null,suffix='',payload?:unknown,c=company)=>app.fetch(new Request(`${ORIGIN}/workspace-api/workspace/${c}/annual-electricity-worksheet${suffix}`,{method:payload===undefined?'GET':'POST',headers:{origin:ORIGIN,...(actor?{authorization:`Bearer ${actor}`} : {}),...(payload===undefined?{}:{'content-type':'application/json'})},body:payload===undefined?undefined:JSON.stringify(payload)}))
 const sqlSave=(actor:string|null,c:string,p:unknown,correct=false)=>scoped(actor,tx=>tx.query('select neuvetra.save_annual_electricity_worksheet($1,$2::text::jsonb,$3)',[c,JSON.stringify(p),correct]))
 const counts=async(c=company)=>Promise.all(tables.map(async table=>(await operator.query<{n:number}>(`select count(*)::int n from neuvetra.${table} where company_id=$1`,[c])).rows[0]!.n))
 const preserved=async()=>{let n=0;for(const prior of baseline.rowHashes){if(!/^[a-z_]+$/.test(prior.table))throw Error('Invalid baseline identifier');const hashes=new Set((await operator.query<{value:unknown}>(`select to_jsonb(t) value from neuvetra.${prior.table} t`)).rows.map(r=>hashManifestValue(r.value)));expect(prior.hashes.every((h:string)=>hashes.has(h))).toBe(true);n+=prior.hashes.length}expect(n).toBe(1488)}
 beforeAll(async()=>{
  const manifest=await readMigrationManifest();expect(manifest).toHaveLength(13);expect(manifest[12]!.sha256).toBe(expectedMigration!)
  operator=createPostgresConnection(url!,{tls:false});await migratePrivateStaging(operator,{expectedProjectRef:REF,syntheticTargetConfirmed:true})
  for(const id of Object.values(ids))await operator.query('insert into auth.users(id) values($1)',[id])
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:ids.owner,members:[{userId:ids.admin,role:'admin'},{userId:ids.member,role:'member'}]})
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:otherCompany,ownerUserId:ids.other,members:[{userId:ids.otherAdmin,role:'admin'}]})
  await operator.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'admin')",[company,ids.uninvited])
  runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55463/m67_qa',{tls:false,maxConnections:3});db=construct(runtime)
  app=await createStagingServer({profile:'neuvetra.private-synthetic-staging.v1',projectRef:REF,reuseExistingProject:false,origin:ORIGIN,supabaseUrl:`https://${REF}.supabase.co`,supabaseAnonKey:'synthetic-fixture',databaseUrl:url!,webRoot:'.',port:36667},{database:db,validateUser:async token=>token in ids?{id:ids[token as keyof typeof ids],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
 },30000)
 afterAll(async()=>{await app?.close();await operator?.close()})
 test('reviewed additive schema13 preserves all1488 original rows and no implicit annual data',async()=>{expect((await db.checkReadiness()).schemaVersion).toBe(13);await preserved();expect(baseline.rowHashes).toHaveLength(48);expect((await db.findAnnualElectricityWorksheet(ids.owner,company))!.versions).toHaveLength(0)})
 test('direct SQL/Bun canonical preimages agree on escaped text, null, ordered arrays and complete input/result objects',async()=>{
  const samples=[{z:[null,{quantityKwh:'0.000',month:'2023-01'}],a:false,label:'Quotes " backslash \\ braces {{x}} & <x>'},{months:M67_MONTHS.map((month,i)=>({quantityKwh:i%2?'0.000':null,month})),year:2023,complete:false,createdAt:'2026-09-15T00:00:00.000Z'}]
  for(const value of samples){const expected=canonical(value);const r=(await operator.query<{text:string;hash:string}>('select neuvetra.m67_canonical($1::text::jsonb) text,neuvetra.m67_hash($1::text::jsonb) hash',[JSON.stringify(value)])).rows[0]!;expect(r.text).toBe(expected);expect(r.hash).toBe(sha(expected));expect(m67CanonicalJson(value)).toBe(expected)}
 })
 test('all-null and invalid monthly requests refuse atomically in both HTTP and direct SQL',async()=>{
  const before=await counts(),base=input('january_25000_partial'),bad:unknown[]=[{...base,months:M67_MONTHS.map(month=>({month,quantityKwh:null}))},{...base,evidence:{sourceId:crypto.randomUUID()}},{...base,coverage:{electricityComplete:true}},{...base,months:base.months.slice(0,11)},{...base,months:[...base.months].reverse()}]
  for(const c of cases.rejected_cases.filter((c:any)=>'replace_january_quantity'in c)){const p=structuredClone(base);p.months[0].quantityKwh=c.replace_january_quantity;bad.push(p)}
  for(const p of bad){expect((await request('owner','',p)).status).toBe(422);await denied(()=>sqlSave(ids.owner,company,p))}expect(await counts()).toEqual(before)
 })
 test('concurrent explicit-zero initial retries and cross-manager report captures converge without inherited review',async()=>{
  const p=input(),responses=await Promise.all([request('owner','',p),request('owner','',p)]);expect(responses.map(r=>r.status)).toEqual([201,201]);const w=decodeAnnualElectricityWorksheet(await responses[0]!.json(),company);first=current=w.versions[0]!;expect(first.coverage.knownMonths).toBe(1);expect(first.total.display).toBe('0.0000');expect(first.months[1]!.total).toBeNull();expect(first.evidenceBasis).toBe('synthetic_manual_without_linked_bills')
  const reports=await Promise.all([db.createAnnualWorksheetReport(ids.owner,company,reportInput(first)),db.createAnnualWorksheetReport(ids.admin,company,reportInput(first))]);expect(reports[0]!.id).toBe(reports[1]!.id);oldReport=decodeAnnualWorksheetReport(reports[0],w);oldBytes=(await db.downloadAnnualWorksheetReport(ids.member,company,oldReport.id))!.bytes;expect(sha(oldBytes)).toBe(oldReport.reportSha256)
  expect((await counts())[0]).toBe(1);expect((await counts())[3]).toBe(1);expect((await counts())[4]).toBe(1);expect((await counts())[6]).toBe(1)
  expect((await request('owner','',{...p,companyLabel:'Different'})).status).toBe(409)
 })
 test('active invited second tenant, member, outsider, uninvited and signedout boundaries hold in SQL and API',async()=>{
  await db.saveAnnualElectricityWorksheet(ids.other,otherCompany,input('january_25000_partial'))
  for(const suffix of ['', '/reports',`/reports/${oldReport.id}`,`/reports/${oldReport.id}/download`])for(const [actor,status] of [['member',200],['other',404],['outsider',403],['uninvited',403],[null,401]] as const)expect((await request(actor,suffix)).status).toBe(status)
  expect((await request('member','',input())).status).toBe(403)
  for(const actor of [ids.member,ids.other,ids.outsider,ids.uninvited,null])await denied(()=>sqlSave(actor,company,input()))
  for(const actor of [ids.other,ids.outsider,ids.uninvited,null])expect((await scoped(actor,tx=>tx.query('select * from neuvetra.annual_electricity_worksheet_versions where company_id=$1',[company]))).rows).toHaveLength(0)
 })
 test('review binding and null-zero lifecycle preserve exact old report and reject clearing last entry/noops',async()=>{
  expect((await request('owner','/reviews',reviewInput(first))).status).toBe(409)
  const reviewed=decodeAnnualElectricityWorksheet(await (await request('admin','/reviews',reviewInput(first))).json(),company);expect(reviewed.versions[0]!.review!.reviewerId).toBe(ids.admin)
  const recovered=await db.createAnnualWorksheetReport(ids.owner,company,reportInput(first));expect(recovered.id).toBe(oldReport.id)
  const before=await counts();const empty=correction(first);empty.months=M67_MONTHS.map(month=>({month,quantityKwh:null}));expect((await request('owner','/corrections',empty)).status).toBe(422);expect(await counts()).toEqual(before)
  current=(await db.saveAnnualElectricityWorksheet(ids.owner,company,correction(first,input('all_zero')),true)).versions.at(-1)!;expect(current.coverage.electricityComplete).toBe(true);expect(current.review).toBeNull()
  current=(await db.saveAnnualElectricityWorksheet(ids.owner,company,correction(current),true)).versions.at(-1)!;expect(current.coverage.knownMonths).toBe(1);expect(current.review).toBeNull()
  const same=correction(current);expect((await request('owner','/corrections',same)).status).toBe(409)
  for(const label of ['companyLabel','facilityLabel'] as const){const p=correction(current);p[label]='Changed only '+label;current=(await db.saveAnnualElectricityWorksheet(ids.owner,company,p,true)).versions.at(-1)!;expect(decodeAnnualElectricityWorksheet((await db.findAnnualElectricityWorksheet(ids.member,company))!,company).versions.at(-1)!.id).toBe(current.id)}
  expect((await db.downloadAnnualWorksheetReport(ids.member,company,oldReport.id))!.bytes).toEqual(oldBytes)
 })
 test('all12 public vectors persist through real driver, SQL preimage verification, HTTP decoder and exact report bytes',async()=>{
  for(const c of cases.accepted_cases){const p=correction(current,input(c.id));p.companyLabel='Independent vector '+c.id;const response=await request('owner','/corrections',p);expect(response.status).toBe(201);const w=decodeAnnualElectricityWorksheet(await response.json(),company);current=w.versions.at(-1)!;expect(current.total.unrounded).toBe(c.expected.total_unrounded_kg_co2e);expect(current.total.display).toBe(c.expected.total_display_kg_co2e);expect(current.quantityKwh).toBe(c.expected.quantity_kwh);expect(current.coverage).toEqual(c.expected.coverage)
   for(const [i,m] of current.months.entries()){expect(m.total?.unrounded??null).toBe(c.expected.months[i].unrounded_kg_co2e);expect(m.total?.display??null).toBe(c.expected.months[i].display_kg_co2e)}
   const preimage={profile:M67_PROFILE,companyId:company,id:current.id,version:current.version,previousVersionId:current.previousVersionId,createdBy:current.createdBy,createdAt:current.createdAt,companyLabel:current.companyLabel,facilityLabel:current.facilityLabel,year:2023,geography:'CAMX',unit:'kWh',evidenceBasis:'synthetic_manual_without_linked_bills',months:current.months.map(({month,quantityKwh})=>({month,quantityKwh})),correctionReason:current.correctionReason}
   expect(current.inputSha256).toBe(sha(canonical(preimage)));expect((await operator.query<{p:string}>('select neuvetra.m67_canonical($1::text::jsonb) p',[JSON.stringify(preimage)])).rows[0]!.p).toBe(canonical(preimage))
   const result={inputSha256:current.inputSha256,months:current.months,quantityKwh:current.quantityKwh,quantityMwh:current.quantityMwh,total:current.total,coverage:current.coverage,method:M67_METHOD,limitations:[...M67_LIMITATIONS],synthetic:true,complete:false,releaseEligible:false,assurance:'none'};expect(current.resultSha256).toBe(sha(canonical(result)))
   const report=decodeAnnualWorksheetReport(await db.createAnnualWorksheetReport(ids.admin,company,reportInput(current)),w);const bytes=(await db.downloadAnnualWorksheetReport(ids.member,company,report.id))!.bytes;expect(sha(bytes)).toBe(report.reportSha256);expect(new TextDecoder().decode(bytes)).toContain(c.expected.total_display_kg_co2e+' kg CO2e')
  }
 },30000)
 test('redistribution with identical annual quantity is material and competing corrections cannot overwrite',async()=>{
  const p=correction(current,input('january_25000_partial'));current=(await db.saveAnnualElectricityWorksheet(ids.owner,company,p,true)).versions.at(-1)!;const shift=correction(current,input('january_25000_partial'));shift.months[0].quantityKwh=null;shift.months[1].quantityKwh='25000';const moved=(await db.saveAnnualElectricityWorksheet(ids.owner,company,shift,true)).versions.at(-1)!;expect(moved.quantityKwh).toBe(current.quantityKwh);expect(moved.inputSha256).not.toBe(current.inputSha256);expect(moved.coverage.missingMonths).toContain('2023-01');current=moved
  const left=correction(current,input('all_zero')),right=correction(current,input('twelve_25000'));const responses=await Promise.all([request('owner','/corrections',left),request('admin','/corrections',right)]);expect(responses.map(r=>r.status).sort()).toEqual([201,409]);current=(await db.findAnnualElectricityWorksheet(ids.owner,company))!.versions.at(-1)!
 })
 test('genuinely blocked review begins earlier but report captures absence before post-lock decision time',async()=>{
  const v=(await db.findAnnualElectricityWorksheet(ids.other,otherCompany))!.versions[0]!;let pending:Promise<unknown>|undefined,reportId=''
  await operator.transaction(async tx=>{await tx.query('select id from neuvetra.companies where id=$1 for update',[otherCompany]);pending=db.reviewAnnualElectricityWorksheet(ids.otherAdmin,otherCompany,reviewInput(v));let waiting=false
   for(let i=0;i<100;i++){await tx.query('select pg_stat_clear_snapshot()');const r=await tx.query<{n:number}>("select count(*)::int n from pg_stat_activity where datname=current_database() and usename='neuvetra_runtime' and wait_event_type='Lock' and query like '%review_annual_electricity_worksheet%' ");if(r.rows[0]!.n){waiting=true;break}await new Promise(r=>setTimeout(r,10))}expect(waiting).toBe(true)
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.other]);reportId=(await tx.query<{id:string}>('select neuvetra.create_annual_electricity_report($1,$2::text::jsonb) id',[otherCompany,JSON.stringify(reportInput(v))])).rows[0]!.id
  });await pending!;const report=(await db.findAnnualWorksheetReport(ids.other,otherCompany,reportId))!;expect(report.reviewState).toBe('unreviewed');expect((await db.downloadAnnualWorksheetReport(ids.other,otherCompany,reportId))!.report.reportSha256).toBe(report.reportSha256)
 })
 test('runtime direct writes refuse; independent corruption of null/coverage/total/review/report/audit fails closed',async()=>{
  for(const table of tables)await denied(()=>runtime.query(`delete from neuvetra.${table} where company_id=$1`,[company]))
  const probes=[{sql:"update neuvetra.annual_electricity_worksheet_versions set payload=jsonb_set(payload,'{months,1,quantityKwh}','\"0.000\"'::jsonb) where id=$1",p:[first.id]}, {sql:"update neuvetra.annual_electricity_worksheet_versions set payload=jsonb_set(payload,'{coverage,knownMonths}','12'::jsonb) where id=$1",p:[first.id]}, {sql:"update neuvetra.annual_electricity_worksheet_versions set payload=jsonb_set(payload,'{total,display}','\"9.0000\"'::jsonb) where id=$1",p:[first.id]}, {sql:'delete from neuvetra.annual_electricity_worksheet_audit where record_id=$1',p:[first.id]}, {sql:"update neuvetra.annual_electricity_worksheet_reviews set payload=jsonb_set(payload,'{reviewerId}',to_jsonb($2::text)) where version_id=$1",p:[first.id,ids.owner]}, {sql:"update neuvetra.annual_electricity_reports set report_bytes=decode('00','hex'),report_sha256=encode(sha256(decode('00','hex')),'hex'),report_byte_length=1 where id=$1",p:[oldReport.id]}, {sql:'delete from neuvetra.annual_electricity_report_audit where report_id=$1',p:[oldReport.id]}]
  for(const probe of probes){let refused=false;try{await operator.transaction(async tx=>{await tx.query("set local session_replication_role='replica'");await tx.query(probe.sql,probe.p);await tx.query('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.owner]);try{await readAnnualWorksheetReports(tx,company)}catch{refused=true}throw Error('QA_ROLLBACK')})}catch(e){expect((e as Error).message).toBe('QA_ROLLBACK')}expect(refused).toBe(true)}
  expect((await db.downloadAnnualWorksheetReport(ids.member,company,oldReport.id))!.bytes).toEqual(oldBytes)
 })
 test('revoked subject and pooled foreign actor cannot read annual derivatives; authorized owner remains intact',async()=>{
  const values=await Promise.all(Array.from({length:12},(_,i)=>db.findAnnualElectricityWorksheet(i%2?ids.other:ids.member,company)));expect(values.every((v,i)=>i%2?v===null:v?.companyId===company)).toBe(true)
  await revokeStagingAccess(operator,ids.member);for(const suffix of ['', '/reports',`/reports/${oldReport.id}`,`/reports/${oldReport.id}/download`])expect((await request('member',suffix)).status).toBe(403)
  expect((await scoped(ids.member,tx=>tx.query('select * from neuvetra.annual_electricity_reports where company_id=$1',[company]))).rows).toHaveLength(0);expect((await db.findAnnualElectricityWorksheet(ids.owner,company))!.companyId).toBe(company)
 })
 test('coordinated result payload/hash/audit forgery still fails independent arithmetic reconstruction',async()=>{
  const forged=structuredClone(first);forged.total.display='9.0000'
  const result={inputSha256:forged.inputSha256,months:forged.months,quantityKwh:forged.quantityKwh,quantityMwh:forged.quantityMwh,total:forged.total,coverage:forged.coverage,method:forged.method,limitations:[...M67_LIMITATIONS],synthetic:true,complete:false,releaseEligible:false,assurance:'none'}
  const forgedHash=sha(canonical(result));let refused=false
  try{await operator.transaction(async tx=>{
   await tx.query("set local session_replication_role='replica'")
   await tx.query("update neuvetra.annual_electricity_worksheet_versions set payload=jsonb_set(jsonb_set(payload,'{total,display}','\"9.0000\"'::jsonb),'{resultSha256}',to_jsonb($2::text)),result_sha256=$2 where id=$1",[first.id,forgedHash])
   await tx.query("update neuvetra.annual_electricity_worksheet_audit set record_sha256=$2 where record_id=$1",[first.id,forgedHash])
   await tx.query('set local role neuvetra_runtime');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.owner])
   try{await readAnnualElectricityWorksheet(tx,company)}catch{refused=true}throw Error('QA_ROLLBACK')
  })}catch(e){expect((e as Error).message).toBe('QA_ROLLBACK')}expect(refused).toBe(true)
 })
 test('manager revoked while awaiting company lock cannot commit a previously authorized correction',async()=>{
  const v=(await db.findAnnualElectricityWorksheet(ids.other,otherCompany))!.versions.at(-1)!,p=correction(v,input('all_zero')),before=await counts(otherCompany)
  let pending:Promise<boolean>|undefined
  await operator.transaction(async tx=>{
   await tx.query('select id from neuvetra.companies where id=$1 for update',[otherCompany])
   pending=db.saveAnnualElectricityWorksheet(ids.otherAdmin,otherCompany,p,true).then(()=>false,()=>true)
   let waiting=false;for(let i=0;i<100;i++){await tx.query('select pg_stat_clear_snapshot()');const r=await tx.query<{n:number}>("select count(*)::int n from pg_stat_activity where datname=current_database() and usename='neuvetra_runtime' and wait_event_type='Lock' and query like '%save_annual_electricity_worksheet%' ");if(r.rows[0]!.n){waiting=true;break}await new Promise(r=>setTimeout(r,10))}expect(waiting).toBe(true)
   await tx.query('update neuvetra.staging_access set active=false where user_id=$1',[ids.otherAdmin])
  });expect(await pending!).toBe(true);expect(await counts(otherCompany)).toEqual(before);expect((await db.findAnnualElectricityWorksheet(ids.other,otherCompany))!.versions.at(-1)!.id).toBe(v.id)
 })
 test('fresh runtime connection recovers immutable report bytes and preserves all old rows',async()=>{
  const fresh=construct(createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55463/m67_qa',{tls:false,maxConnections:1}));try{expect((await fresh.downloadAnnualWorksheetReport(ids.owner,company,oldReport.id))!.bytes).toEqual(oldBytes);expect((await fresh.checkReadiness()).schemaVersion).toBe(13)}finally{await fresh.close()}await preserved()
 })
})
