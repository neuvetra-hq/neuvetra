import { expect, test } from "bun:test"
import { M66_SOURCE_FIXTURES } from "../../../../packages/neuvetra-database/src/m66-fixtures"
import { decodeAnnualElectricityWorksheet } from "../../../site-web/src/lib/m67-api"
import { decodeAnnualElectricityEvidence } from "../../../site-web/src/lib/m68-api"
import { decodeAnnualEvidenceReport } from "../../../site-web/src/lib/m68-report-api"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, revokeStagingAccess, M68_LIMITATIONS, M67_LIMITATIONS, annualEvidenceResultHash, readAnnualEvidenceReports, readAnnualElectricityEvidence, type WorkspaceConnection } from "@neuvetra/database"
import { createStagingServer } from "../staging/server"
import { readStagingConfig, STAGING_PROFILE } from "../staging/config"
const target=process.env.M68_API_TEST_DATABASE_URL??process.env.M63_API_TEST_DATABASE_URL
if(target){const u=new URL(target);if(u.hostname!=="127.0.0.1"||u.port!=="55463"||!["/m68_author","/m63_integration"].includes(u.pathname)||u.username!=="m63_test_admin"||u.password||u.search||u.hash)throw new Error("M68 native tests require an explicitly approved loopback fixture.")}
const integration=target?test:test.skip
integration("M68 native API and frontend decoders preserve exact annual/source lineage, evidence corrections, conflicts and reports",async()=>{
 const REF="abcdefghijklmnopqrst",ORIGIN="http://127.0.0.1:3015",company=crypto.randomUUID()
 const users={owner:crypto.randomUUID(),admin:crypto.randomUUID(),manager:crypto.randomUUID(),member:crypto.randomUUID(),outsider:crypto.randomUUID()}
 const operator=createPostgresConnection(target!,{tls:false}),runtimeUrl=new URL(target!);runtimeUrl.username="neuvetra_runtime"
 const construct=()=>new (HostedWorkspaceDatabase as unknown as new(db:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(),{tls:false}),REF)
 const config=readStagingConfig({NODE_ENV:"test",NEUVETRA_STAGING_ENABLED:"enabled",NEUVETRA_STAGING_PROFILE:STAGING_PROFILE,NEUVETRA_STAGING_PROJECT_REF:REF,NEUVETRA_STAGING_ORIGIN:ORIGIN,SUPABASE_URL:`https://${REF}.supabase.co`,SUPABASE_ANON_KEY:"sb_publishable_synthetic_fixture_not_a_real_key",DATABASE_URL:`postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres`})
 const create=()=>createStagingServer(config,{database:construct(),validateUser:async token=>users[token as keyof typeof users]?{id:users[token as keyof typeof users],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
 let app:Awaited<ReturnType<typeof create>>|undefined
 const root=`/workspace/${company}/annual-electricity-evidence`
 const request=(path:string,actor:string|null="owner",body?:unknown)=>app!.fetch(new Request(ORIGIN+"/workspace-api"+path,{method:body===undefined?"GET":"POST",headers:{origin:ORIGIN,...(actor?{authorization:"Bearer "+actor}:{}),...(body!==undefined&&!(body instanceof FormData)?{"content-type":"application/json"}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)}))
 const read=async(path:string,actor="owner",body?:unknown,status=body===undefined?200:201)=>{const r=await request(path,actor,body);expect(r.status,path+" "+await r.clone().text()).toBe(status);return r.json() as Promise<any>}
 const reportInput=(v:any)=>({sourceVersionId:v.id,expectedInputSha256:v.inputSha256,expectedResultSha256:v.resultSha256,expectedReviewId:v.review?.id??null,expectedReviewSha256:v.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()})
 const reviewInput=(v:any)=>({versionId:v.id,expectedResultSha256:v.resultSha256,decision:"accept_bounded_internal_draft",note:null,acknowledgedLimitations:[...M68_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
 const annualRoot=`/workspace/${company}/annual-electricity-worksheet`,sourcesRoot=`/workspace/${company}/source-electricity-worksheet/sources`
 const form=async(index:number)=>{const f=M66_SOURCE_FIXTURES[index]!,data=new FormData();data.set("file",new File([await Bun.file(new URL("../../../../output/pdf/"+f.originalName,import.meta.url)).bytes()],f.originalName,{type:"application/pdf"}));data.set("idempotencyKey",crypto.randomUUID());return data}
 const tables=(await operator.query<{tablename:string}>("select tablename from pg_tables where schemaname='neuvetra' and tablename<>'schema_migrations' order by tablename")).rows.map(x=>x.tablename)
 const hashes=async(table:string)=>(await operator.query<{hash:string}>(`select encode(sha256(convert_to(to_jsonb(t)::text,'utf8')),'hex') hash from neuvetra."${table}" t`)).rows.map(x=>x.hash)
 const baseline=new Map<string,string[]>();for(const t of tables)baseline.set(t,await hashes(t))
 try{
  for(const id of Object.values(users))await operator.query("insert into auth.users(id) values($1)",[id])
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:users.owner,members:[{userId:users.admin,role:"admin"},{userId:users.manager,role:"admin"},{userId:users.member,role:"member"}]})
  const foreignCompany=crypto.randomUUID()
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:foreignCompany,ownerUserId:users.outsider,members:[]})
  app=await create()
  expect((await read(root)).versions).toEqual([])
  expect((await request(root,null)).status).toBe(401);expect((await request(root,"outsider")).status).toBe(404)
  const sources=[await read(sourcesRoot,"owner",await form(0)),await read(sourcesRoot,"owner",await form(1))]
  const foreignSource=await read(`/workspace/${foreignCompany}/source-electricity-worksheet/sources`,"outsider",await form(0))
  const cases=await Bun.file(new URL("../../../../evaluations/research-qa/m68-accounting-cases.json",import.meta.url)).json()
  let annual:any,evidence:any,v:any,firstReport:any,firstBytes:Uint8Array|undefined
  const link=(source:any,reason:string|null=null)=>({month:"2023-01",sourceId:source.id,expectedSourceSha256:source.sha256,sourcePage:1,manualConfirmation:true,quantityDifferenceReason:reason})
  const annualInput=(months:any,prior?:any)=>({companyLabel:"Synthetic <script>company</script>",facilityLabel:"Synthetic office",year:2023,geography:"CAMX",unit:"kWh",months,idempotencyKey:crypto.randomUUID(),...(prior?{expectedVersionId:prior.id,expectedResultSha256:prior.resultSha256,correctionReason:"Select independent annual test vector"}:{})})
  const saveEvidence=async(links:any[],prior=v)=>{
   const a=annual.versions.at(-1),input={annualVersionId:a.id,expectedAnnualInputSha256:a.inputSha256,expectedAnnualResultSha256:a.resultSha256,links,idempotencyKey:crypto.randomUUID(),...(prior?{expectedVersionId:prior.id,expectedResultSha256:prior.resultSha256,correctionReason:"Record evidence correction"}:{})}
   evidence=decodeAnnualElectricityEvidence(await read(root+(prior?"/corrections":""),"owner",input),company,annual);v=evidence.versions.at(-1);return input
  }
  // Every independently defined coverage vector travels through PostgreSQL, API and real browser decoders.
  for(const sample of cases.accepted){
   const prior=annual?.versions.at(-1)
   if(!prior||JSON.stringify(prior.months.map(({month,quantityKwh}:any)=>({month,quantityKwh})))!==JSON.stringify(sample.months))annual=decodeAnnualElectricityWorksheet(await read(annualRoot+(prior?"/corrections":""),"owner",annualInput(sample.months,prior)),company)
   await saveEvidence(sample.links.map((l:any)=>link(sources[l.fixture==="A"?0:1],l.quantityDifferenceReason)))
   expect(v.coverage,sample.id).toEqual(sample.coverage)
   expect(v.annual.quantityKwh).toBe(sample.annualReuse.quantityKwh);expect(v.annual.total.unrounded).toBe(sample.annualReuse.exactKgCo2e);expect(v.annual.total.display).toBe(sample.annualReuse.displayKgCo2e)
   expect(v.review).toBeNull();expect(v.annual.review).toBeNull()
   if(sample.id==="january_missing_february_entered_no_links"||sample.id==="january_match_one_bill"){
    const av=annual.versions.at(-1),bad={annualVersionId:av.id,expectedAnnualInputSha256:av.inputSha256,expectedAnnualResultSha256:av.resultSha256,links:[link(sources[0],"Reason cannot fill missing input or explain equal quantities")],expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:"Invalid attempt",idempotencyKey:crypto.randomUUID()}
    expect((await request(root+"/corrections","owner",bad)).status).toBe(422)
   }
   const rp=reportInput(v),report=decodeAnnualEvidenceReport(await read(root+"/reports","owner",rp),evidence,annual)
   const response=await request(root+"/reports/"+report.id+"/download","member"),bytes=new Uint8Array(await response.arrayBuffer()),html=new TextDecoder().decode(bytes)
   expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(report.reportSha256)
   expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>");expect(html).not.toMatch(/\{\{[a-zA-Z0-9]+\}\}/)
   expect(html).toContain(sample.annualReuse.exactKgCo2e+" kg CO2e")
   if(sample.links.length>1)expect(html).toContain("Overlapping documents (not summed)")
   if(!firstReport){firstReport=report;firstBytes=bytes}
  }
  // Exercise exact tie/boundary arithmetic through the selected M67 persisted version and M68 decoder.
  const numeric=await Bun.file(new URL("../../../../evaluations/research-qa/m67-accounting-cases.json",import.meta.url)).json()
  for(const sample of numeric.accepted_cases){
   annual=decodeAnnualElectricityWorksheet(await read(annualRoot+"/corrections","owner",annualInput(sample.months,annual.versions.at(-1))),company)
   await saveEvidence([])
   expect(v.annual.total.unrounded).toBe(sample.expected.total_unrounded_kg_co2e);expect(v.annual.total.display).toBe(sample.expected.total_display_kg_co2e)
  }
  // M68 lifecycle: source-only, explanation-only and annual-only corrections retain exact annual arithmetic.
  annual=decodeAnnualElectricityWorksheet(await read(annualRoot+"/corrections","owner",annualInput(Array.from({length:12},(_,i)=>({month:`2023-${String(i+1).padStart(2,"0")}`,quantityKwh:"25000.000"})),annual.versions.at(-1))),company)
  const annualToReview=annual.versions.at(-1)
  annual=decodeAnnualElectricityWorksheet(await read(annualRoot+"/reviews","admin",{...reviewInput(annualToReview),acknowledgedLimitations:[...M67_LIMITATIONS]}),company)
  expect(annual.versions.at(-1).review).not.toBeNull()
  await saveEvidence([link(sources[0],"Synthetic discrepancy A")]);expect(v.annual.review).toBeNull();expect(v.review).toBeNull()
  const firstLinked=v,correction=await saveEvidence([link(sources[1],"Synthetic discrepancy A")])
  expect(v.annual).toEqual(firstLinked.annual);expect(v.links[0].source.id).toBe(sources[1].id)
  const replacement=v;await saveEvidence([link(sources[1],"Explanation-only correction")]);expect(v.annual).toEqual(replacement.annual)
  const beforeAnnual=v,oldAnnual=annual.versions.at(-1)
  annual=decodeAnnualElectricityWorksheet(await read(annualRoot+"/corrections","owner",{...annualInput(oldAnnual.months.map(({month,quantityKwh}:any)=>({month,quantityKwh})),oldAnnual),facilityLabel:"Synthetic relabeled office"}),company)
  await saveEvidence([link(sources[1],"Explanation-only correction")]);expect(v.annual.total).toEqual(beforeAnnual.annual.total);expect(v.annual.id).not.toBe(beforeAnnual.annual.id)
  const a=annual.versions.at(-1),base={annualVersionId:a.id,expectedAnnualInputSha256:a.inputSha256,expectedAnnualResultSha256:a.resultSha256,links:[link(sources[1],"Explanation-only correction")],expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:"No-op reason",idempotencyKey:crypto.randomUUID()}
  expect((await request(root+"/corrections","owner",base)).status).toBe(409)
  expect((await request(root+"/corrections","owner",{...correction,idempotencyKey:crypto.randomUUID(),correctionReason:"Stale successor"})).status).toBe(409)
  for(const links of [[link(sources[0]),link(sources[0])],[link(sources[0]),{...link(sources[0]),sourceId:crypto.randomUUID()}],[{...link(sources[0]),month:"2023-02"}],[{...link(sources[0]),sourcePage:2}],[{...link(sources[0]),manualConfirmation:false}],[link(sources[0])],[link(sources[0]," ")],[link({...sources[0],id:crypto.randomUUID()},"Nonexistent")],[link(foreignSource,"Foreign source")]])expect((await request(root+"/corrections","owner",{...base,links,idempotencyKey:crypto.randomUUID()})).status).toBe(422)
  const foreignAnnual=(await read(`/workspace/${foreignCompany}/annual-electricity-worksheet`,"outsider",annualInput(a.months.map(({month,quantityKwh}:any)=>({month,quantityKwh}))))).versions[0]
  expect((await request(root+"/corrections","owner",{...base,annualVersionId:foreignAnnual.id,expectedAnnualInputSha256:foreignAnnual.inputSha256,expectedAnnualResultSha256:foreignAnnual.resultSha256,links:[]})).status).toBe(409)
  expect((await request(root+"/corrections","member",base)).status).toBe(403)
  expect((await request(root+"/reviews","owner",reviewInput(v))).status).toBe(409)
  const decisions=await Promise.all([request(root+"/reviews","admin",reviewInput(v)),request(root+"/reviews","manager",reviewInput(v))]);expect(decisions.map(r=>r.status).sort()).toEqual([201,409])
  evidence=decodeAnnualElectricityEvidence(await read(root),company,annual);v=evidence.versions.at(-1)
  const reviewed=decodeAnnualEvidenceReport(await read(root+"/reports","owner",reportInput(v)),evidence,annual);expect(reviewed.reviewId).not.toBeNull()
  const saved=await saveEvidence([link(sources[0],"Concurrent source correction"),link(sources[1],"Concurrent source correction")])
  expect(v.review).toBeNull();expect(v.coverage.overlappingDocumentMonths).toEqual(["2023-01"])
  // Reordered links are same effective input, including idempotent retry with a different JSON property order.
  const replay={...saved,links:[...saved.links].reverse(),idempotencyKey:crypto.randomUUID()}
  expect((await read(root+"/corrections","owner",replay)).versions.at(-1).id).toBe(v.id)
  expect((await request(root+"/corrections","owner",{...saved,links:[link(sources[0],"Changed value under same retry key")]})).status).toBe(409)
  expect((await request(root+"/corrections","owner",{...replay,expectedVersionId:v.id,expectedResultSha256:v.resultSha256})).status).toBe(409)
  const concurrent={...base,expectedVersionId:v.id,expectedResultSha256:v.resultSha256,links:[],correctionReason:"Remove evidence",idempotencyKey:crypto.randomUUID()}
  const savedTwice=await Promise.all([read(root+"/corrections","owner",concurrent),read(root+"/corrections","owner",{...concurrent,idempotencyKey:crypto.randomUUID()})]);expect(savedTwice[0].versions.at(-1).id).toBe(savedTwice[1].versions.at(-1).id)
  evidence=decodeAnnualElectricityEvidence(savedTwice[0],company,annual);v=evidence.versions.at(-1)
  expect(v.coverage.linkedDocumentMonths).toBe(0);expect(v.coverage.missingDocumentMonths).toHaveLength(12)
  const raceBase={...base,expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:"Competing corrections"}
  const race=await Promise.all([request(root+"/corrections","owner",{...raceBase,links:[link(sources[0],"Competing A")],idempotencyKey:crypto.randomUUID()}),request(root+"/corrections","owner",{...raceBase,links:[link(sources[1],"Competing B")],idempotencyKey:crypto.randomUUID()})]);expect(race.map(r=>r.status).sort()).toEqual([201,409])
  evidence=decodeAnnualElectricityEvidence(await read(root),company,annual);v=evidence.versions.at(-1)
  const rp=reportInput(v),reports=await Promise.all([read(root+"/reports","owner",rp),read(root+"/reports","admin",{...rp,idempotencyKey:crypto.randomUUID()})]);expect(reports[0].id).toBe(reports[1].id)
  const currentReport=reports[0]
  expect((await request(root+"/reports/"+currentReport.id+"/download","outsider")).status).toBe(404)
  expect((await request(sourcesRoot+"/"+sources[0].id+"/download","outsider")).status).toBe(404)
  const sourceDownload=await request(sourcesRoot+"/"+sources[0].id+"/download","member")
  expect(new Bun.CryptoHasher("sha256").update(await sourceDownload.arrayBuffer()).digest("hex")).toBe(sources[0].sha256)
  await app.close();app=await create()
  decodeAnnualElectricityEvidence(await read(root),company,decodeAnnualElectricityWorksheet(await read(annualRoot),company))
  expect(Buffer.from(await(await request(root+"/reports/"+firstReport.id+"/download")).arrayBuffer()).equals(Buffer.from(firstBytes!))).toBe(true)
  // Tamper transactions always roll back. Coordinated hashes/lengths cannot substitute content or semantic lineage.
  const corruption=async(sql:string,params:unknown[],reader:(tx:any)=>Promise<unknown>,expectedError:string)=>{
   let caught=false
   await operator.transaction(async tx=>{await tx.query("set local session_replication_role=replica");await tx.query(sql,params);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users.owner]);await reader(tx);throw new Error("Tampered content accepted")}).catch(e=>{caught=true;expect(e.message).toBe(expectedError)})
   expect(caught).toBe(true)
  }
  await corruption("update neuvetra.annual_evidence_reports set report_bytes=convert_to('tampered','utf8'),report_sha256=encode(sha256(convert_to('tampered','utf8')),'hex'),report_byte_length=8 where id=$1",[currentReport.id],tx=>readAnnualEvidenceReports(tx,company),"Worksheet report could not be verified.")
  for(const mutate of [(forged:any)=>{forged.coverage.linkedDocumentMonths=12},(forged:any)=>{forged.annual.quantityKwh="999999.000"}]){
   const forged=structuredClone(v);mutate(forged);forged.resultSha256=annualEvidenceResultHash(forged.inputSha256,forged)
   const {review:_review,...payload}=forged
   await corruption("with changed as (update neuvetra.annual_electricity_evidence_versions set payload=$2::text::jsonb,result_sha256=$3 where id=$1 returning id) update neuvetra.annual_electricity_evidence_audit set record_sha256=$3 where kind='save' and record_id in(select id from changed)",[v.id,JSON.stringify(payload),forged.resultSha256],tx=>readAnnualElectricityEvidence(tx,company),"Annual worksheet could not be verified.")
  }
  await corruption("update neuvetra.electricity_sources set original_bytes=convert_to('tampered','utf8'),sha256=encode(sha256(convert_to('tampered','utf8')),'hex'),byte_length=8 where id=$1",[sources[0].id],tx=>readAnnualEvidenceReports(tx,company),"Retained source could not be verified.")
  // Runtime has no direct write grants; native function enforces membership independently of routes.
  const runtime=createPostgresConnection(runtimeUrl.toString(),{tls:false})
  try{
   await expect(runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users.member]);return tx.query("select neuvetra.save_annual_electricity_evidence($1,$2::text::jsonb,false)",[company,JSON.stringify({...base})])})).rejects.toMatchObject({code:"42501"})
   await expect(runtime.query("update neuvetra.annual_electricity_evidence_versions set result_sha256=result_sha256 where company_id=$1",[company])).rejects.toMatchObject({code:"42501"})
  }finally{await runtime.close()}
  await revokeStagingAccess(operator,users.owner);expect((await request(root)).status).toBe(403);expect((await request(root+"/reports/"+firstReport.id+"/download")).status).toBe(403)
  for(const [table,rows] of baseline){const now=new Set(await hashes(table));for(const hash of rows)expect(now.has(hash),table).toBe(true)}
 }finally{await app?.close();await operator.close()}
},120000)
