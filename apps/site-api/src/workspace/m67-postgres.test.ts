import { expect, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, revokeStagingAccess, M67_LIMITATIONS, readAnnualWorksheetReports, type WorkspaceConnection } from "@neuvetra/database"
import { createStagingServer } from "../staging/server"
import { readStagingConfig, STAGING_PROFILE } from "../staging/config"
const target=process.env.M67_API_TEST_DATABASE_URL??process.env.M63_API_TEST_DATABASE_URL
if(target){const u=new URL(target);if(u.hostname!=="127.0.0.1"||u.port!=="55463"||!["/m67_author","/m68_author","/m63_integration"].includes(u.pathname)||u.username!=="m63_test_admin"||u.password||u.search||u.hash)throw new Error("M67 native tests require an explicitly approved loopback fixture.")}
const integration=target?test:test.skip
integration("M67 actual driver and staged API preserve annual coverage, exact arithmetic, frozen reports and prior records",async()=>{
 const REF="abcdefghijklmnopqrst",ORIGIN="http://127.0.0.1:3015",company=crypto.randomUUID()
 const users={owner:crypto.randomUUID(),admin:crypto.randomUUID(),manager:crypto.randomUUID(),member:crypto.randomUUID(),outsider:crypto.randomUUID()}
 const operator=createPostgresConnection(target!,{tls:false}),runtimeUrl=new URL(target!);runtimeUrl.username="neuvetra_runtime"
 const construct=()=>new (HostedWorkspaceDatabase as unknown as new(db:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(),{tls:false}),REF)
 const config=readStagingConfig({NODE_ENV:"test",NEUVETRA_STAGING_ENABLED:"enabled",NEUVETRA_STAGING_PROFILE:STAGING_PROFILE,NEUVETRA_STAGING_PROJECT_REF:REF,NEUVETRA_STAGING_ORIGIN:ORIGIN,SUPABASE_URL:`https://${REF}.supabase.co`,SUPABASE_ANON_KEY:"sb_publishable_synthetic_fixture_not_a_real_key",DATABASE_URL:`postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres`})
 const create=()=>createStagingServer(config,{database:construct(),validateUser:async token=>users[token as keyof typeof users]?{id:users[token as keyof typeof users],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
 let app:Awaited<ReturnType<typeof create>>|undefined
 const root=`/workspace/${company}/annual-electricity-worksheet`
 const request=(path:string,actor:string|null="owner",body?:unknown)=>app!.fetch(new Request(ORIGIN+"/workspace-api"+path,{method:body===undefined?"GET":"POST",headers:{origin:ORIGIN,...(actor?{authorization:"Bearer "+actor}:{}),...(body!==undefined&&!(body instanceof FormData)?{"content-type":"application/json"}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)}))
 const read=async(path:string,actor="owner",body?:unknown,status=body===undefined?200:201)=>{const r=await request(path,actor,body);expect(r.status,path+" "+await r.clone().text()).toBe(status);return r.json() as Promise<any>}
 const reportInput=(v:any)=>({sourceVersionId:v.id,expectedInputSha256:v.inputSha256,expectedResultSha256:v.resultSha256,expectedReviewId:v.review?.id??null,expectedReviewSha256:v.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()})
 const reviewInput=(v:any)=>({versionId:v.id,expectedResultSha256:v.resultSha256,decision:"accept_bounded_internal_draft",note:null,acknowledgedLimitations:[...M67_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
 const tables=(await operator.query<{tablename:string}>("select tablename from pg_tables where schemaname='neuvetra' and tablename not in ('annual_electricity_worksheet_versions','annual_electricity_worksheet_reviews','annual_electricity_worksheet_requests','annual_electricity_worksheet_audit','annual_electricity_reports','annual_electricity_report_requests','annual_electricity_report_audit') and tablename<>'schema_migrations' order by tablename")).rows.map(x=>x.tablename)
 const hashes=async(table:string)=>(await operator.query<{hash:string}>(`select encode(sha256(convert_to(to_jsonb(t)::text,'utf8')),'hex') hash from neuvetra."${table}" t`)).rows.map(x=>x.hash)
 const baseline=new Map<string,string[]>();for(const t of tables)baseline.set(t,await hashes(t))
 try{
  for(const id of Object.values(users))await operator.query("insert into auth.users(id) values($1)",[id])
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:users.owner,members:[{userId:users.admin,role:"admin"},{userId:users.manager,role:"admin"},{userId:users.member,role:"member"}]})
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:crypto.randomUUID(),ownerUserId:users.outsider,members:[]})
  app=await create()
  expect((await read(root)).versions).toEqual([])
  expect((await request(root,null)).status).toBe(401);expect((await request(root,"outsider")).status).toBe(404)
  const cases=await Bun.file(new URL("../../../../evaluations/research-qa/m67-accounting-cases.json",import.meta.url)).json()
  const base={companyLabel:"Synthetic <script>company</script>",facilityLabel:"Synthetic office",year:2023,geography:"CAMX",unit:"kWh",months:cases.accepted_cases[0].months,idempotencyKey:crypto.randomUUID()}
  expect((await request(root,"member",base)).status).toBe(403)
  for(const delta of [{months:base.months.map((m:any)=>({...m,quantityKwh:null}))},{months:base.months.slice(1)},{months:base.months.map((m:any,i:number)=>i?m:{...m,quantityKwh:""})},{year:2024},{evidenceBasis:"inherited_bill"},{sourceId:crypto.randomUUID()}])expect((await request(root,"owner",{...base,...delta})).status).toBe(422)
  expect((await read(root)).versions).toEqual([])
  let v=(await read(root,"owner",base)).versions[0]
  expect(v.quantityKwh).toBe("25000.000");expect(v.coverage.knownMonths).toBe(1);expect(v.months[1].quantityKwh).toBeNull()
  expect((await read(root,"owner",base)).versions).toHaveLength(1)
  const rp=reportInput(v),parallelReports=await Promise.all([read(root+"/reports","owner",rp),read(root+"/reports","admin",{...rp,idempotencyKey:crypto.randomUUID()})])
  expect(parallelReports[0].id).toBe(parallelReports[1].id)
  const frozen=parallelReports[0],download=await request(root+"/reports/"+frozen.id+"/download","member"),originalBytes=await download.arrayBuffer(),html=new TextDecoder().decode(originalBytes)
  expect(download.status).toBe(200);expect(download.headers.get("x-report-sha256")).toBe(frozen.reportSha256);expect(new Bun.CryptoHasher("sha256").update(originalBytes).digest("hex")).toBe(frozen.reportSha256)
  expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>");expect(html).not.toMatch(/\{\{[a-zA-Z0-9]+\}\}/)
  expect((await request(root+"/reports/"+frozen.id+"/download","outsider")).status).toBe(404)
  expect((await request(root+"/reviews","owner",reviewInput(v))).status).toBe(409)
  const decisions=await Promise.all([request(root+"/reviews","admin",reviewInput(v)),request(root+"/reviews","manager",reviewInput(v))]);expect(decisions.map(r=>r.status).sort()).toEqual([201,409])
  v=(await read(root)).versions[0];expect(v.review).not.toBeNull()
  expect((await read(root+"/reports","owner",reportInput(v))).id).not.toBe(frozen.id)
  expect((await read(root+"/reports","admin",{...rp,idempotencyKey:crypto.randomUUID()})).id).toBe(frozen.id)
  const correction={...base,months:cases.accepted_cases[1].months,expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:"Enter explicit zero for missing months",idempotencyKey:crypto.randomUUID()}
  const corrections=await Promise.all([read(root+"/corrections","owner",correction),read(root+"/corrections","owner",{...correction,idempotencyKey:crypto.randomUUID()})]);expect(corrections[0].versions[1].id).toBe(corrections[1].versions[1].id)
  v=corrections[0].versions[1];expect(v.quantityKwh).toBe("25000.000");expect(v.coverage.electricityComplete).toBe(true);expect(v.review).toBeNull()
  expect((await request(root+"/corrections","owner",{...correction,expectedVersionId:v.id,expectedResultSha256:v.resultSha256,idempotencyKey:crypto.randomUUID()})).status).toBe(409)
  for(const sample of cases.accepted_cases){
   const input={...base,months:sample.months,expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:"Numerical vector "+sample.id,idempotencyKey:crypto.randomUUID()}
   v=(await read(root+"/corrections","owner",input)).versions.at(-1)
   const e=sample.expected
   expect(v.quantityKwh).toBe(e.quantity_kwh);expect(v.quantityMwh).toBe(e.quantity_mwh);expect(v.total.unrounded).toBe(e.total_unrounded_kg_co2e);expect(v.total.display).toBe(e.total_display_kg_co2e)
   expect(v.months.map((m:any)=>m.quantityKwh)).toEqual(e.months.map((m:any)=>m.quantity_kwh))
   const report=await read(root+"/reports","owner",reportInput(v));expect(report.complete).toBe(false);expect(report.releaseEligible).toBe(false)
   const output=await(await request(root+"/reports/"+report.id+"/download")).text();expect(output).toContain(e.total_unrounded_kg_co2e+" kg CO2e")
  }
  const latest=v,change={...base,months:v.months.map(({month,quantityKwh}:any)=>({month,quantityKwh})),expectedVersionId:v.id,expectedResultSha256:v.resultSha256,correctionReason:"Correct fictional label",idempotencyKey:crypto.randomUUID(),facilityLabel:"Synthetic corrected label"}
  v=(await read(root+"/corrections","owner",change)).versions.at(-1);expect(v.quantityKwh).toBe(latest.quantityKwh);expect(v.id).not.toBe(latest.id)
  expect((await request(root+"/reviews","admin",reviewInput(latest))).status).toBe(409)
  const currentReport=await read(root+"/reports","owner",reportInput(v));await app.close();app=await create()
  expect((await read(root)).versions.at(-1).id).toBe(v.id)
  expect(Buffer.from(await(await request(root+"/reports/"+frozen.id+"/download")).arrayBuffer()).equals(Buffer.from(originalBytes))).toBe(true)
  // Coordinated byte+hash tamper still fails deterministic reconstruction.
  await operator.transaction(async tx=>{await tx.query("set local session_replication_role=replica");await tx.query("update neuvetra.annual_electricity_reports set report_bytes=convert_to('tampered','utf8'),report_sha256=encode(sha256(convert_to('tampered','utf8')),'hex'),report_byte_length=8 where id=$1",[currentReport.id]);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users.owner]);await readAnnualWorksheetReports(tx,company);throw new Error("tampered report was accepted")}).catch(e=>{expect(e.message).toBe("Worksheet report could not be verified.")})
  expect((await request(root+"/reports/"+currentReport.id)).status).toBe(200)
  await revokeStagingAccess(operator,users.owner);expect((await request(root)).status).toBe(403);expect((await request(root+"/reports/"+frozen.id+"/download")).status).toBe(403)
  for(const [table,rows] of baseline){const now=new Set(await hashes(table));for(const hash of rows)expect(now.has(hash),table).toBe(true)}
 }finally{await app?.close();await operator.close()}
},120000)
