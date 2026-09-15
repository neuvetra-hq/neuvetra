import { expect, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, revokeStagingAccess, M66_LIMITATIONS, readSourceWorksheetReports, type WorkspaceConnection } from "@neuvetra/database"
import { M66_SOURCE_FIXTURES } from "../../../../packages/neuvetra-database/src/m66-fixtures"
import { createStagingServer } from "../staging/server"
import { readStagingConfig, STAGING_PROFILE } from "../staging/config"
const target=process.env.M66_API_TEST_DATABASE_URL??process.env.M63_API_TEST_DATABASE_URL
if(target){const u=new URL(target);if(u.hostname!=="127.0.0.1"||u.port!=="55463"||!["/m66_author","/m67_author","/m63_integration"].includes(u.pathname)||u.username!=="m63_test_admin"||u.password||u.search||u.hash)throw new Error("M66 native tests require an explicitly approved loopback fixture.")}
const integration=target?test:test.skip
integration("M66 actual driver and staged API preserve source-to-report lineage, exact arithmetic, conflicts and prior records",async()=>{
 const REF="abcdefghijklmnopqrst",ORIGIN="http://127.0.0.1:3015",company=crypto.randomUUID()
 const users={owner:crypto.randomUUID(),admin:crypto.randomUUID(),manager:crypto.randomUUID(),member:crypto.randomUUID(),outsider:crypto.randomUUID()}
 const operator=createPostgresConnection(target!,{tls:false}),runtimeUrl=new URL(target!);runtimeUrl.username="neuvetra_runtime"
 const construct=()=>new (HostedWorkspaceDatabase as unknown as new(db:WorkspaceConnection,ref:string)=>HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(),{tls:false}),REF)
 const config=readStagingConfig({NODE_ENV:"test",NEUVETRA_STAGING_ENABLED:"enabled",NEUVETRA_STAGING_PROFILE:STAGING_PROFILE,NEUVETRA_STAGING_PROJECT_REF:REF,NEUVETRA_STAGING_ORIGIN:ORIGIN,SUPABASE_URL:`https://${REF}.supabase.co`,SUPABASE_ANON_KEY:"sb_publishable_synthetic_fixture_not_a_real_key",DATABASE_URL:`postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres`})
 const create=()=>createStagingServer(config,{database:construct(),validateUser:async token=>users[token as keyof typeof users]?{id:users[token as keyof typeof users],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
 let app:Awaited<ReturnType<typeof create>>|undefined
 const root=`/workspace/${company}/source-electricity-worksheet`
 const request=(path:string,actor:string|null="owner",body?:unknown)=>app!.fetch(new Request(ORIGIN+"/workspace-api"+path,{method:body===undefined?"GET":"POST",headers:{origin:ORIGIN,...(actor?{authorization:"Bearer "+actor}:{}),...(body!==undefined&&!(body instanceof FormData)?{"content-type":"application/json"}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)}))
 const read=async(path:string,actor="owner",body?:unknown,status=body===undefined?200:201)=>{const r=await request(path,actor,body);expect(r.status,path+" "+await r.clone().text()).toBe(status);return r.json() as Promise<any>}
 const form=async(index:number,key=crypto.randomUUID())=>{const f=M66_SOURCE_FIXTURES[index]!,data=new FormData();data.set("file",new File([await Bun.file(new URL("../../../../output/pdf/"+f.originalName,import.meta.url)).bytes()],f.originalName,{type:"application/pdf"}));data.set("idempotencyKey",key);return data}
 const reportInput=(v:any)=>({sourceVersionId:v.id,expectedInputSha256:v.inputSha256,expectedResultSha256:v.resultSha256,expectedReviewId:v.review?.id??null,expectedReviewSha256:v.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()})
 const reviewInput=(v:any)=>({versionId:v.id,expectedResultSha256:v.resultSha256,decision:"accept_bounded_internal_draft",note:null,acknowledgedLimitations:[...M66_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
 try{
  const legacyTables=(await operator.query<{tablename:string}>("select tablename from pg_tables where schemaname='neuvetra' and tablename not like 'electricity_source%' and tablename not like 'source_worksheet%' and tablename<>'schema_migrations' order by tablename")).rows.map(x=>x.tablename)
  const hashes=async(table:string)=>(await operator.query<{hash:string}>(`select encode(sha256(convert_to(to_jsonb(t)::text,'utf8')),'hex') hash from neuvetra."${table}" t`)).rows.map(x=>x.hash)
  const baseline=new Map<string,string[]>();for(const t of legacyTables)baseline.set(t,await hashes(t))
  for(const id of Object.values(users))await operator.query("insert into auth.users(id) values($1)",[id])
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:users.owner,members:[{userId:users.admin,role:"admin"},{userId:users.manager,role:"admin"},{userId:users.member,role:"member"}]})
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:crypto.randomUUID(),ownerUserId:users.outsider,members:[]})
  app=await create()
  expect((await read(root)).versions).toEqual([])
  expect((await request(root,null)).status).toBe(401)
  expect((await request(root,"outsider")).status).toBe(404)
  expect((await request(root+"/sources","member",await form(0))).status).toBe(403)
  const uploadKey=crypto.randomUUID(),a=await read(root+"/sources","owner",await form(0,uploadKey))
  expect((await read(root+"/sources","owner",await form(0,uploadKey))).id).toBe(a.id)
  expect((await read(root+"/sources","admin",await form(0))).id).toBe(a.id)
  expect((await request(root+"/sources","owner",await form(1,uploadKey))).status).toBe(409)
  const b=await read(root+"/sources","owner",await form(1));expect(b.sha256).not.toBe(a.sha256)
  const sourceDownload=await request(root+"/sources/"+a.id+"/download","member"),sourceBytes=await sourceDownload.arrayBuffer()
  expect(sourceDownload.status).toBe(200);expect(sourceDownload.headers.get("x-source-sha256")).toBe(a.sha256);expect(new Bun.CryptoHasher("sha256").update(sourceBytes).digest("hex")).toBe(a.sha256)
  expect((await request(root+"/sources/"+a.id+"/download","outsider")).status).toBe(404)
  const input={companyLabel:'Fictional <script>company</script>',facilityLabel:"Fictional office",quantityKwh:"12345",period:"2023-01",geography:"CAMX",unit:"kWh",idempotencyKey:crypto.randomUUID(),sourceId:a.id,expectedSourceSha256:a.sha256,sourcePage:1,manualConfirmation:true,quantityDifferenceReason:null}
  for(const delta of [{sourcePage:2},{manualConfirmation:false},{quantityKwh:""},{quantityKwh:"-1"},{quantityKwh:"1000001"},{quantityKwh:"0"},{quantityDifferenceReason:"Unnecessary mismatch reason"}])expect((await request(root,"owner",{...input,...delta,idempotencyKey:crypto.randomUUID()})).status).toBe(422)
  expect((await request(root,"owner",{...input,sourceId:b.id})).status).toBe(409)
  let version=(await read(root,"owner",input)).versions[0]
  expect(version.quantityKwh).toBe("12345.000");expect(version.evidence.source.id).toBe(a.id);expect(version.evidence.confirmedAt).toBe(version.createdAt)
  expect((await read(root,"owner",{...input,quantityKwh:"12345.000",idempotencyKey:crypto.randomUUID()})).versions).toHaveLength(1)
  const rp=reportInput(version),reports=await Promise.all([read(root+"/reports","owner",rp),read(root+"/reports","admin",{...rp,idempotencyKey:crypto.randomUUID()})]);expect(reports[0].id).toBe(reports[1].id)
  const originalReport=reports[0],rd=await request(root+"/reports/"+originalReport.id+"/download","member"),reportBytes=await rd.arrayBuffer(),html=new TextDecoder().decode(reportBytes)
  expect(rd.status).toBe(200);expect(new Bun.CryptoHasher("sha256").update(reportBytes).digest("hex")).toBe(originalReport.reportSha256);expect(html).toContain(a.sha256);expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>");expect(html).not.toMatch(/\{\{[a-zA-Z0-9]+\}\}/)
  expect((await request(root+"/reviews","owner",reviewInput(version))).status).toBe(409)
  const decisionResponses=await Promise.all([request(root+"/reviews","admin",reviewInput(version)),request(root+"/reviews","manager",reviewInput(version))]);expect(decisionResponses.map(r=>r.status).sort()).toEqual([201,409])
  version=(await read(root)).versions[0];expect(version.review).not.toBeNull()
  const reviewed=await read(root+"/reports","owner",reportInput(version));expect(reviewed.id).not.toBe(originalReport.id)
  expect((await read(root+"/reports","admin",{...rp,idempotencyKey:crypto.randomUUID()})).id).toBe(originalReport.id)
  const correction={...input,sourceId:b.id,expectedSourceSha256:b.sha256,expectedVersionId:version.id,expectedResultSha256:version.resultSha256,correctionReason:"Fictional source-only replacement",idempotencyKey:crypto.randomUUID()}
  const corrections=await Promise.all([read(root+"/corrections","owner",correction),read(root+"/corrections","owner",{...correction,idempotencyKey:crypto.randomUUID()})]);expect(corrections[0].versions[1].id).toBe(corrections[1].versions[1].id)
  version=corrections[0].versions[1];expect(version.quantityKwh).toBe("12345.000");expect(version.review).toBeNull();expect(version.evidence.source.id).toBe(b.id)
  expect((await request(root+"/corrections","owner",{...correction,sourceId:a.id,expectedSourceSha256:a.sha256,idempotencyKey:crypto.randomUUID()})).status).toBe(409)
  const cases=await Bun.file(new URL("../../../../evaluations/research-qa/m66-accounting-cases.json",import.meta.url)).json()
  for(const c of cases.numerical_cases){if(c.quantity_kwh===version.quantityKwh&&c.discrepancy_reason===version.evidence.quantityDifferenceReason)continue
   const next={...input,sourceId:b.id,expectedSourceSha256:b.sha256,quantityKwh:c.input_quantity,quantityDifferenceReason:c.discrepancy_reason,expectedVersionId:version.id,expectedResultSha256:version.resultSha256,correctionReason:"Independent numerical case "+c.id,idempotencyKey:crypto.randomUUID()}
   version=(await read(root+"/corrections","owner",next)).versions.at(-1);expect(version.quantityKwh).toBe(c.quantity_kwh);expect(version.quantityMwh).toBe(c.quantity_mwh);expect(version.total.unrounded).toBe(c.unrounded_kg_co2e);expect(version.total.display).toBe(c.display_kg_co2e)
   const report=await read(root+"/reports","owner",reportInput(version));const text=await(await request(root+"/reports/"+report.id+"/download")).text();expect(text).toContain(c.unrounded_kg_co2e+" kg CO2e");expect(text).toContain(c.display_kg_co2e+" kg CO2e")
  }
  const differenceOnly={...input,sourceId:b.id,expectedSourceSha256:b.sha256,quantityKwh:version.quantityKwh,quantityDifferenceReason:"Corrected explanation for this fictional quantity",expectedVersionId:version.id,expectedResultSha256:version.resultSha256,correctionReason:"Correcting only the recorded explanation",idempotencyKey:crypto.randomUUID()}
  const amended=(await read(root+"/corrections","owner",differenceOnly)).versions.at(-1);expect(amended.quantityKwh).toBe(version.quantityKwh);expect(amended.id).not.toBe(version.id)
  await expect(operator.query("update neuvetra.source_worksheet_versions set payload=payload where id=$1",[amended.id])).rejects.toThrow()
  await expect(operator.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users.owner]);await tx.exec("alter table neuvetra.source_worksheet_reports disable trigger user; alter table neuvetra.source_worksheet_report_audit disable trigger user;");await tx.query("update neuvetra.source_worksheet_reports set report_bytes=convert_to('forged','utf8'),report_byte_length=6,report_sha256=encode(sha256(convert_to('forged','utf8')),'hex') where id=$1",[originalReport.id]);await tx.query("update neuvetra.source_worksheet_report_audit set event_meta=jsonb_set(jsonb_set(event_meta,'{reportSha256}',to_jsonb(encode(sha256(convert_to('forged','utf8')),'hex'))),'{reportByteLength}','6'::jsonb) where report_id=$1",[originalReport.id]);await readSourceWorksheetReports(tx,company);throw new Error("Tampered report was accepted") })).rejects.toThrow("could not be verified")
  await app.close();app=await create()
  expect(new Uint8Array(await(await request(root+"/reports/"+originalReport.id+"/download","member")).arrayBuffer())).toEqual(new Uint8Array(reportBytes))
  expect(new Uint8Array(await(await request(root+"/sources/"+a.id+"/download","member")).arrayBuffer())).toEqual(new Uint8Array(sourceBytes))
  for(const [table,before] of baseline){const after=new Set(await hashes(table));expect(before.every(h=>after.has(h)),"preserve old "+table).toBe(true)}
  await revokeStagingAccess(operator,users.member);expect((await request(root+"/sources/"+a.id+"/download","member")).status).toBe(403)
 }finally{await app?.close();await operator.close()}
},60000)
