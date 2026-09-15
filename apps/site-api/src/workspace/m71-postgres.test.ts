import {expect,test} from "bun:test"
import {createPostgresConnection,HostedWorkspaceDatabase,provisionStagingRoster,revokeStagingAccess,createM71Seed,M71_LIMITATIONS,M71_ARTIFACT,M71_EVIDENCE_SHA256,m71Id,m71Hash,m71CanonicalJson,m71Export,readCorporateInventory,type WorkspaceConnection,type M71Version} from "@neuvetra/database"
import {createStagingServer} from "../staging/server"
import {decodeCorporateRegister,decodeCorporateVersion} from "../../../site-web/src/lib/m71-api"
const target=process.env.M71_API_TEST_DATABASE_URL
if(target){const u=new URL(target);if(u.hostname!=="127.0.0.1"||u.port!=="55463"||!["/m71_author","/m71_author_final","/m71_author_release","/m63_integration"].includes(u.pathname)||u.username!=="m63_test_admin"||u.password||u.search||u.hash)throw Error("M71 native tests require the approved isolated loopback fixture.")}
(target?test:test.skip)("M71 native API: canonical snapshots, tenant isolation, races, reviews, exact exports and restart",async()=>{
 const REF="abcdefghijklmnopqrst",ORIGIN="http://127.0.0.1:37171",company=crypto.randomUUID(),users={owner:crypto.randomUUID(),admin:crypto.randomUUID(),reviewer:crypto.randomUUID(),member:crypto.randomUUID(),outsider:crypto.randomUUID()}
 const operator=createPostgresConnection(target!,{tls:false}),runtimeUrl=new URL(target!);runtimeUrl.username="neuvetra_runtime"
 const construct=()=>new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,r:string)=>HostedWorkspaceDatabase)(createPostgresConnection(runtimeUrl.toString(),{tls:false}),REF)
 const create=()=>createStagingServer({profile:"neuvetra.private-synthetic-staging.v1",projectRef:REF,reuseExistingProject:false,origin:ORIGIN,supabaseUrl:`https://${REF}.supabase.co`,supabaseAnonKey:"synthetic-fixture",databaseUrl:target!,webRoot:".",port:37171},{database:construct(),validateUser:async token=>users[token as keyof typeof users]?{id:users[token as keyof typeof users],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
 let app:Awaited<ReturnType<typeof create>>|undefined
 const root=`/workspace/${company}/corporate-inventories`
 const request=(suffix="",actor:string|null="owner",body?:unknown,raw=false)=>app!.fetch(new Request(ORIGIN+"/workspace-api"+root+suffix,{method:body===undefined?"GET":"POST",headers:{origin:ORIGIN,...(actor?{authorization:"Bearer "+actor}:{}),...(body!==undefined?{"content-type":"application/json"}:{})},body:body===undefined?undefined:raw?body as string:JSON.stringify(body)}))
 const read=async(suffix="",actor="owner",body?:unknown)=>{const response=await request(suffix,actor,body);expect(response.status,await response.clone().text()).toBe(body===undefined?200:201);expect(response.headers.get("cache-control")).toBe("no-store");return response.json() as Promise<any>}
 const seed=createM71Seed(),initialInput={snapshot:seed,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:crypto.randomUUID()}
 const input=(v:M71Version,reason="Record synthetic correction")=>({snapshot:structuredClone(v.snapshot),expectedVersionId:v.id,expectedVersionSha256:v.versionSha256,correctionReason:reason,idempotencyKey:crypto.randomUUID()})
 const review=(v:M71Version)=>({versionId:v.id,expectedVersionSha256:v.versionSha256,decision:"accepted_bounded_internal",note:"Internal synthetic boundary check; unresolved gaps remain.",acknowledgedLimitations:[...M71_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
 const legacyTables=(await operator.query<{tablename:string}>("select tablename from pg_tables where schemaname='neuvetra' and tablename not like 'corporate_%' and tablename<>'schema_migrations' order by tablename")).rows.map(t=>t.tablename)
 const rowHashes=async(table:string)=>(await operator.query<{hash:string}>(`select encode(sha256(convert_to(to_jsonb(t)::text,'utf8')),'hex') hash from neuvetra."${table}" t`)).rows.map(r=>r.hash)
 const baseline=new Map<string,string[]>();for(const table of legacyTables)baseline.set(table,await rowHashes(table))
 try{
  for(const id of Object.values(users))await operator.query("insert into auth.users(id) values($1)",[id])
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:users.owner,members:[{userId:users.admin,role:"admin"},{userId:users.reviewer,role:"admin"},{userId:users.member,role:"member"}]})
  await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:crypto.randomUUID(),ownerUserId:users.outsider,members:[]})
  app=await create();expect((await read()).versions).toEqual([])
  expect((await request("",null)).status).toBe(401);expect((await request("","outsider")).status).toBe(404);expect((await request("","member",initialInput)).status).toBe(403)
  const v1=await decodeCorporateVersion(await read("","owner",initialInput),company)
  expect(v1.snapshot.entities.every(e=>e.countryCode==="US"&&e.regionCode==="CA")).toBe(true);expect(v1.snapshot.coverageItems).toHaveLength(27);expect(v1.emissionsTotals).toBeNull()
  const path=`/${v1.inventoryId}/versions`,exportPath=`${path}/${v1.id}/coverage-export`,firstExport=await(await request(exportPath)).text();expect(firstExport).toBe(m71Export(v1))
  const change=input(v1);change.snapshot.companyLabel="  Synthetic Juniper revised  ";change.snapshot.entities.reverse();change.snapshot.coverageItems.reverse()
  const v2=await decodeCorporateVersion(await read(path,"admin",change),company,v1);expect(v2.snapshot.companyLabel).toBe("Synthetic Juniper revised");expect(v2.contributorIds).toEqual([users.owner,users.admin].sort())
  expect((await request(`/${v2.inventoryId}/reviews`,"owner",review(v2))).status).toBe(409)
  const decision=await read(`/${v2.inventoryId}/reviews`,"reviewer",review(v2));expect(decision.versionId).toBe(v2.id)
  expect(await read("","owner",initialInput)).toEqual(v1)
  expect((await request("","owner",{...initialInput,snapshot:{...seed,companyLabel:"Changed retry"}})).status).toBe(409)
  const stale=input(v1);expect((await request(path,"owner",stale)).status).toBe(409)
  const reasonOnly=input(v2,"Clarify boundary correction rationale only"),v3=await read(path,"admin",reasonOnly);expect(v3.contentSha256).toBe(v2.contentSha256);expect(v3.review).toBeNull()
  expect((await request(path,"admin",input(v3,reasonOnly.correctionReason))).status).toBe(422)
  const same=input(v3);same.snapshot.policyVersion="synthetic-policy-v2";const duplicate=await Promise.all([read(path,"admin",same),read(path,"admin",same)]);expect(duplicate[0]).toEqual(duplicate[1])
  let current=duplicate[0] as M71Version;const a=input(current),b=input(current);a.snapshot.companyLabel="Competing A";b.snapshot.companyLabel="Competing B";expect((await Promise.all([request(path,"owner",a),request(path,"admin",b)])).map(r=>r.status).sort()).toEqual([201,409])
  const register=await decodeCorporateRegister(await read(),company);current=register.versions[register.versions.length-1]!
  const discovery=input(current);const e={...seed.entities[1]!,id:m71Id(400),legalName:"Synthetic discovered Nevada operation",regionCode:"NV",start:"2025-07-01"};discovery.snapshot.entities.push(e);discovery.snapshot.boundaryDecisions.push({...seed.boundaryDecisions[1]!,id:m71Id(401),entityId:e.id,start:e.start});discovery.snapshot.relationships.push({...seed.relationships[0]!,id:m71Id(402),childEntityId:e.id,start:e.start});current=await read(path,"owner",discovery);expect(current.findings.some(f=>f.code==="unsupported_geography"&&f.recordId===e.id)).toBe(true);expect(current.findings.some(f=>f.code==="unsupported_temporal_allocation")).toBe(true)
  const omissions=input(current);omissions.snapshot.entities=omissions.snapshot.entities.filter(x=>x.id!==e.id);omissions.snapshot.boundaryDecisions=omissions.snapshot.boundaryDecisions.filter(x=>x.entityId!==e.id);omissions.snapshot.relationships=omissions.snapshot.relationships.filter(x=>x.childEntityId!==e.id);expect((await request(path,"owner",omissions)).status).toBe(422)
  const zero=input(current),c=zero.snapshot.coverageItems.find(x=>x.domain==="electricity"&&x.sourceId===null)!;c.quantity="0.000";c.unit="kWh";c.reason="Explicit fictional zero basis";c.activityDataState="explicit_zero";c.evidenceState="linked";c.evidenceRefs=[{artifactId:M71_ARTIFACT.id,expectedSha256:M71_EVIDENCE_SHA256,locator:M71_ARTIFACT.locator,purpose:"Synthetic basis only"}];current=await read(path,"owner",zero);expect(current.snapshot.coverageItems.find(x=>x.id===c.id)!.quantity).toBe("0");expect(current.emissionsTotals).toBeNull()
  const duplicateJson=JSON.stringify(input(current)).replace('"correctionReason":','"correctionReason":"first","correctionReason":');expect((await request(path,"owner",duplicateJson,true)).status).toBe(422)
  for(const payload of [{...input(current),createdBy:users.reviewer},{...input(current),companyId:crypto.randomUUID()}])expect((await request(path,"owner",payload)).status).toBe(422)
  expect((await request(exportPath,"outsider")).status).toBe(404);expect(await(await request(exportPath,"member")).text()).toBe(firstExport)
  await app.close();app=await create();expect(await(await request(exportPath)).text()).toBe(firstExport);await decodeCorporateRegister(await read(),company)
  // Tampering has to fail even if attacker rehashes the substituted snapshot and version.
  const forged=structuredClone(current);forged.snapshot.coverageItems.pop();forged.contentSha256=m71Hash(forged.snapshot)
  await expect(operator.transaction(async tx=>{await tx.query("set local session_replication_role=replica");await tx.query("update neuvetra.corporate_inventory_versions set payload=jsonb_set(payload,'{snapshot}',$2::text::jsonb) where id=$1",[current.id,JSON.stringify(forged.snapshot)]);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users.owner]);await readCorporateInventory(tx,company);throw Error("tamper accepted")})).rejects.toThrow("Corporate coverage could not be verified.")
  const runtime=createPostgresConnection(runtimeUrl.toString(),{tls:false});try{
   await expect(runtime.query("update neuvetra.corporate_inventory_heads set revision=revision where company_id=$1",[company])).rejects.toMatchObject({code:"42501"})
   await expect(runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users.member]);return tx.query("select neuvetra.save_corporate_inventory($1,$2,$3::text::jsonb)",[company,current.inventoryId,m71CanonicalJson(input(current))])})).rejects.toMatchObject({code:"42501"})
   // Exercise the same native manager capability with valid and invalid payloads;
   // unconditional rollback protects the fixture even if a negative case regresses.
   const probe=async(payload:unknown,actor=users.owner,reviewing=false)=>{let failure:unknown;await runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);try{await tx.query(reviewing?"select neuvetra.review_corporate_inventory($1,$2,$3::text::jsonb)":"select neuvetra.save_corporate_inventory($1,$2,$3::text::jsonb)",[company,current.inventoryId,JSON.stringify(payload)])}catch(error){failure=error}throw Error("Rollback native probe")}).catch(()=>{});return failure}
   expect(await probe(input(current,"Valid direct SQL rollback control"))).toBeUndefined()
   const changes:((p:any)=>void)[]=[p=>{p.snapshot.facilities[0].entityId=null},p=>{p.snapshot.sources[0].entityId=null},p=>{p.snapshot.boundaryDecisions[0].entityId=null},p=>{const c=structuredClone(p.snapshot.coverageItems.find((c:any)=>c.entityId===null));c.id=m71Id(999);c.start="2025-02-01";p.snapshot.coverageItems.push(c)},p=>{p.snapshot.requirements[0].applicability=null},p=>{p.snapshot.relationships=[]},p=>{p.snapshot.entities[0].countryCode=["US"]},p=>{p.snapshot.coverageItems[0].methodReadiness="released_for_use"}]
   for(const mutate of changes){const bad=input(current,"Native shape challenge");mutate(bad);expect(await probe(bad)).toMatchObject({code:"22023"})}
   expect(await probe({...review(current),decision:null},users.reviewer,true)).toMatchObject({code:"22023"})
  }finally{await runtime.close()}
  const unicode=input(current,"😀".repeat(300));unicode.snapshot.requirements[0]!.missingFacts=["😀","\uE000"];unicode.snapshot.entities[0]!.evidenceRefs=["😀","\uE000"].map(purpose=>({artifactId:M71_ARTIFACT.id,expectedSha256:M71_EVIDENCE_SHA256,locator:M71_ARTIFACT.locator,purpose}));current=await read(path,"admin",unicode);expect(current.snapshot.requirements[0]!.missingFacts).toEqual(["\uE000","😀"]);expect(current.snapshot.entities[0]!.evidenceRefs.map(r=>r.purpose)).toEqual(["\uE000","😀"]);await decodeCorporateRegister(await read(),company)
  while(current.version<40)current=await read(path,"admin",input(current,`Synthetic history limit case ${current.version+1}`))
  const limited=await request(path,"admin",input(current,"Attempt version 41"));expect(limited.status).toBe(422);expect((await limited.json() as {code:string}).code).toBe("history_limit");expect((await read()).headVersionId).toBe(current.id);expect(await(await request(exportPath)).text()).toBe(firstExport);expect(await read("","owner",initialInput)).toEqual(v1)
  await revokeStagingAccess(operator,users.owner);expect((await request(exportPath)).status).toBe(403)
  for(const [table,hashes]of baseline){const now=new Set(await rowHashes(table));for(const hash of hashes)expect(now.has(hash),table).toBe(true)}
 }finally{await app?.close();await operator.close()}
},120000)
