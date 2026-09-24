/** Independent M73 security drill. Opt in only to a fresh m73_security_* local clone. */
import {test,expect} from 'bun:test'
import {createPostgresConnection,HostedWorkspaceDatabase,provisionStagingRoster,createM71Seed,M71_ARTIFACT,M71_EVIDENCE_SHA256,M73_PROFILE,M73_PERIOD,M73_LIMITATIONS,m73SourceChoices,readMigrationManifest,m73CanonicalJson,type WorkspaceConnection,type M73SaveInput,type M73Version} from '../../packages/neuvetra-database/src/index'
import {createM73Routes} from '../../apps/site-api/src/workspace/m73-routes'
import {createM73Authority} from '../../apps/site-api/src/calculation/m73-authority'
import {decodeGasRegister,decodeGasVersion,decodeGasReport} from '../../apps/site-web/src/lib/m73-api'

const target=process.env.M73_SECURITY_DATABASE_URL
if(target){const u=new URL(target);if(u.hostname!=='127.0.0.1'||u.port!=='55463'||!/^\/m73_security_[a-z0-9_]+$/.test(u.pathname)||u.username!=='m63_test_admin'||u.password||u.search||u.hash)throw Error('M73 security tests require an isolated local m73_security_* clone.')}
const native=target?test:test.skip

native('schema 15 recovery applies the exact migration without changing prior rows or runtime posture',async()=>{
 const db=createPostgresConnection(target!,{tls:false,maxConnections:1})
 try{
  const manifest=await readMigrationManifest();expect(manifest).toHaveLength(16);expect(manifest[15]!.sha256).toBe('2f5489d37fdd59963d12e60947b8dddce34cc4e1dc4100813545b1c0dbb1c9b7')
  const rows=async(tx:WorkspaceConnection)=>{const names=(await tx.query<{name:string}>("select tablename name from pg_tables where schemaname='neuvetra' and tablename<>'schema_migrations' and tablename not like 'stationary_gas_%' order by 1")).rows;const result:Record<string,string>={};for(const {name} of names)result[name]=m73CanonicalJson((await tx.query(`select to_jsonb(t) value from neuvetra.${name} t order by to_jsonb(t)::text`)).rows);return result}
  const before=await db.transaction(async tx=>{const receipts=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows;expect(receipts).toEqual(manifest.slice(0,15).map(({name,sha256})=>({name,sha256})));return rows(tx)})
  await db.transaction(async tx=>{await tx.exec(manifest[15]!.sql);await tx.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[manifest[15]!.name,manifest[15]!.sha256])})
  expect(await db.transaction(rows)).toEqual(before)
  const posture=(await db.query<{safe:boolean}>("select not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication and not rolinherit safe from pg_roles where rolname='neuvetra_runtime'")).rows[0];expect(posture?.safe).toBe(true)
  const secured=(await db.query<{count:string}>("select count(*)::text count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relname like 'stationary_gas_%' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity")).rows[0];expect(secured?.count).toBe('7')
 }finally{await db.close()}
},120000)

native('adversarial tenant, integrity, duplicate-source, report and revocation boundaries',async()=>{
 const company=crypto.randomUUID(),otherCompany=crypto.randomUUID(),users={owner:crypto.randomUUID(),manager:crypto.randomUUID(),reviewer:crypto.randomUUID(),member:crypto.randomUUID(),outsider:crypto.randomUUID()},origin='http://127.0.0.1:37373'
 const operator=createPostgresConnection(target!,{tls:false,maxConnections:3}),runtimeUrl=new URL(target!);runtimeUrl.username='neuvetra_runtime'
 const runtime=createPostgresConnection(runtimeUrl.toString(),{tls:false,maxConnections:4}),database=new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,r:string)=>HostedWorkspaceDatabase)(runtime,'abcdefghijklmnopqrst'),authority=createM73Authority()
 const route=createM73Routes({database,authority,origin,validateUser:async token=>users[token as keyof typeof users]?{id:users[token as keyof typeof users],email:null,phone:null,fullName:null}:null})
 const request=(suffix='',actor:string|null='owner',body?:unknown)=>route(new Request(origin+`/workspace/${company}/stationary-natural-gas`+suffix,{method:body===undefined?'GET':'POST',headers:{origin,...(actor?{authorization:'Bearer '+actor}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}))
 const ok=async(suffix='',actor='owner',body?:unknown)=>{const response=await request(suffix,actor,body),text=await response.text();expect(response.status,text).toBe(body===undefined?200:201);return JSON.parse(text)}
 try{
  for(const id of Object.values(users))await operator.query('insert into auth.users(id) values($1)',[id])
  await provisionStagingRoster(operator,{expectedProjectRef:'abcdefghijklmnopqrst',workspaceId:company,ownerUserId:users.owner,members:[{userId:users.manager,role:'admin'},{userId:users.reviewer,role:'admin'},{userId:users.member,role:'member'}]})
  await provisionStagingRoster(operator,{expectedProjectRef:'abcdefghijklmnopqrst',workspaceId:otherCompany,ownerUserId:users.outsider,members:[]})
  const coverageSeed=createM71Seed(),sourceId=crypto.randomUUID();coverageSeed.companyLabel='Illustrative security company';coverageSeed.sources.push({id:sourceId,entityId:coverageSeed.entities[0]!.id,facilityId:coverageSeed.facilities[0]!.id,name:'Dedicated boiler A',domain:'stationary_combustion',...M73_PERIOD,evidenceRefs:[]});coverageSeed.coverageItems.push({id:crypto.randomUUID(),entityId:coverageSeed.entities[0]!.id,sourceId,domain:'stationary_combustion',...M73_PERIOD,disposition:'missing',activityDataState:'missing',evidenceState:'missing',methodReadiness:'candidate',reason:null,evidenceRefs:[],estimateBasis:null,quantity:null,unit:null});coverageSeed.boundaryDecisions[0]!.reason='Synthetic operational-control basis';coverageSeed.boundaryDecisions[0]!.evidenceRefs=[{artifactId:M71_ARTIFACT.id,expectedSha256:M71_EVIDENCE_SHA256,locator:M71_ARTIFACT.locator,purpose:'Synthetic control basis'}]
  const coverage=await database.saveCorporateInventory(users.owner,company,null,{snapshot:coverageSeed,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:crypto.randomUUID()}),binding=m73SourceChoices(coverage)[0]!.binding
  const input:M73SaveInput={profile:M73_PROFILE,binding,period:M73_PERIOD,fuel:'Natural Gas',heatBasis:'HHV',unit:'MMBtu',quantityMmbtu:'1250.125',statement:{issuer:'Fictional supplier',reference:'SEC-2025-A',meterLabel:'DEDICATED-A',statedQuantityMmbtu:'1250.125',description:'Synthetic dedicated-meter consumed energy with no adjustments.',consumptionBasis:'dedicated_meter_consumed_no_adjustments'},manualConfirmation:true,discrepancyReason:null,zeroReason:null,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:crypto.randomUUID()}
  expect((await request('',null)).status).toBe(401);expect((await request('','outsider')).status).toBe(404);expect((await request('','member',input)).status).toBe(403)
  console.log('m73_security_stage: admission')
  let version=await decodeGasVersion(await ok('','owner',input),company),worksheet=version.worksheetId
  const reviewInput={versionId:version.id,expectedVersionSha256:version.versionSha256,decision:'accepted_bounded_internal' as const,note:'Independent bounded synthetic review.',acknowledgedLimitations:[...M73_LIMITATIONS],idempotencyKey:crypto.randomUUID()}
  const decision=await ok(`/${worksheet}/reviews`,'reviewer',reviewInput);version={...version,review:decision}
  const reportInput={versionId:version.id,expectedVersionSha256:version.versionSha256,expectedDecisionId:decision.id,expectedDecisionSha256:decision.decisionSha256,idempotencyKey:crypto.randomUUID()}
  expect((await request(`/${worksheet}/reports`,'owner',{...reportInput,expectedDecisionId:null,expectedDecisionSha256:null})).status).toBe(409)
  const report=await decodeGasReport(await ok(`/${worksheet}/reports`,'owner',reportInput),company,version),download=await request(`/${worksheet}/reports/${report.id}/download`)
  expect(report.html).toContain('<h2>Gas results and calculation trace</h2><table>');expect(report.html).toContain('<dt>Issuer</dt><dd>Fictional supplier</dd>');expect(report.html).toContain('<details class="technical-appendix"><summary>Exact version and provenance record</summary>');expect(report.html).toContain('.technical-appendix:not([open]){display:none}')
  expect(download.headers.get('content-disposition')).toMatch(/^attachment;/);expect(download.headers.get('cache-control')).toBe('no-store');expect(download.headers.get('x-content-type-options')).toBe('nosniff');expect(download.headers.get('referrer-policy')).toBe('no-referrer');expect(download.headers.get('content-security-policy')).toContain('sandbox');expect(await download.text()).toBe(report.html)
  const statement=await request(`/${worksheet}/statements/${version.statement!.id}/download`);expect(statement.headers.get('content-type')).toContain('text/plain');expect(statement.headers.get('content-disposition')).toMatch(/^attachment;/);expect(statement.headers.get('cache-control')).toBe('no-store');expect(statement.headers.get('x-content-type-options')).toBe('nosniff');expect(statement.headers.get('referrer-policy')).toBe('no-referrer');expect(await statement.text()).toBe(version.statement!.text)
  console.log('m73_security_stage: report')
  const attack=createPostgresConnection(runtimeUrl.toString(),{tls:false,maxConnections:1});try{
   expect((await attack.query('select * from neuvetra.stationary_gas_versions')).rows).toEqual([])
   let updateCode='';try{await attack.query('update neuvetra.stationary_gas_versions set version=version')}catch(error){updateCode=(error as {code?:string}).code??''}expect(updateCode).toBe('42501')
   let forgeryCode='';try{await attack.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users.manager]);await tx.query('select neuvetra.save_stationary_gas($1,$2,$3::text::jsonb,$4::text::jsonb)',[company,worksheet,JSON.stringify({...input,expectedVersionId:version.id,expectedVersionSha256:version.versionSha256,correctionReason:'forgery',idempotencyKey:crypto.randomUUID()}),JSON.stringify({...version.calculation,total:{unrounded:'0',display:'0.0000'}})])})}catch(error){forgeryCode=(error as {code?:string}).code??''}expect(forgeryCode).toBe('22023')
  }finally{await attack.close()}
  console.log('m73_security_stage: rls_and_forgery')
  const correction=(prior:M73Version,quantity:string,reason:string):M73SaveInput=>({...input,quantityMmbtu:quantity,statement:{...input.statement!,statedQuantityMmbtu:quantity},expectedVersionId:prior.id,expectedVersionSha256:prior.versionSha256,correctionReason:reason,idempotencyKey:crypto.randomUUID()})
  const retry=correction(version,'1300.000','Independent identical retry'),same=await Promise.all([request(`/${worksheet}/versions`,'manager',retry),request(`/${worksheet}/versions`,'manager',retry)]);expect(same.map(x=>x.status)).toEqual([201,201]);const bodies=await Promise.all(same.map(x=>x.json()));expect(bodies[0]).toEqual(bodies[1]);version=await decodeGasVersion(bodies[0],company,version)
  const competing=await Promise.all([request(`/${worksheet}/versions`,'manager',correction(version,'1400.000','First competing correction')),request(`/${worksheet}/versions`,'manager',correction(version,'1500.000','Second competing correction'))]);expect(competing.map(x=>x.status).sort()).toEqual([201,409]);version=await decodeGasVersion(await competing.find(x=>x.status===201)!.json(),company,version)
  console.log('m73_security_stage: concurrency')
  const seed2=structuredClone(coverage.snapshot),source2=crypto.randomUUID();seed2.sources.push({...seed2.sources.find(x=>x.id===sourceId)!,id:source2,name:'Dedicated boiler B'});seed2.coverageItems.push({...seed2.coverageItems.find(x=>x.sourceId===sourceId)!,id:crypto.randomUUID(),sourceId:source2});const coverage2=await database.saveCorporateInventory(users.owner,company,coverage.inventoryId,{snapshot:seed2,expectedVersionId:coverage.id,expectedVersionSha256:coverage.versionSha256,correctionReason:'Add second synthetic source',idempotencyKey:crypto.randomUUID()});const second={...input,binding:m73SourceChoices(coverage2).find(x=>x.binding.sourceId===source2)!.binding,idempotencyKey:crypto.randomUUID()};expect((await request('','owner',second)).status).toBe(409)
  const retained=(await operator.query<{count:string}>('select count(*)::text count from neuvetra.stationary_gas_versions where company_id=$1',[company])).rows[0]!.count
  await operator.query('delete from neuvetra.company_members where company_id=$1 and user_id=$2',[company,users.manager]);expect((await request('','manager')).status).toBe(503);expect((await request(`/${worksheet}/versions`,'manager',retry)).status).toBe(503);expect((await operator.query<{count:string}>('select count(*)::text count from neuvetra.stationary_gas_versions where company_id=$1',[company])).rows[0]!.count).toBe(retained)
  console.log('m73_security_stage: duplicate_and_revocation')
  await operator.query("insert into neuvetra.company_members(company_id,user_id,role) values($1,$2,'admin')",[company,users.manager])
  await decodeGasRegister(await ok(),company)
  await operator.transaction(async tx=>{await tx.exec('set local session_replication_role=replica');await tx.query("update neuvetra.stationary_gas_statements set statement_text=statement_text||E'\\nforged' where id=$1",[version.statement!.id])});expect((await request()).status).toBe(503)
  console.log('m73_security_stage: corruption_refusal')
 }finally{await runtime.close();await operator.close()}
},120000)
