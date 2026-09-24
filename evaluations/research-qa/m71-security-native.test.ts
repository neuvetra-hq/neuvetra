import { afterAll, beforeAll, expect, test } from "bun:test"
import { createPostgresConnection, HostedWorkspaceDatabase, provisionStagingRoster, type WorkspaceConnection } from "../../packages/neuvetra-database/src/index"
import { createM71Seed, M71_LIMITATIONS, M71_ARTIFACT, type M71Version } from "../../packages/neuvetra-database/src/m71-contract"
import { createStagingServer } from "../../apps/site-api/src/staging/server"
import { readStagingConfig, STAGING_PROFILE } from "../../apps/site-api/src/staging/config"
import { decodeCorporateRegister, decodeCorporateVersion } from "../../apps/site-web/src/lib/m71-api"
import { readCorporateInventory, m71Hash, m71VersionHashPayload, M71_EVIDENCE_SHA256, validateM71Snapshot } from "../../packages/neuvetra-database/src/m71"

// Independent reviewer fixture. Never creates/resets databases or touches hosted targets.
const target=process.env.M71_SECURITY_DATABASE_URL
if(target){const u=new URL(target);if(u.protocol!=="postgres:"||u.hostname!=="127.0.0.1"||u.port!=="55463"||!["/m71_security_v14","/m71_security_r2","/m71_security_r3","/m71_security_r4","/m71_security_r5"].includes(u.pathname)||u.username!=="m63_test_admin"||u.password||u.search||u.hash)throw new Error("Only the explicitly authorized M71 security fixture is allowed.")}
const integration=target?test:test.skip
const REF="abcdefghijklmnopqrst",ORIGIN="http://127.0.0.1:3015",company=crypto.randomUUID(),otherCompany=crypto.randomUUID()
const actors={owner:crypto.randomUUID(),editor:crypto.randomUUID(),reviewer:crypto.randomUUID(),member:crypto.randomUUID(),outsider:crypto.randomUUID()}
let operator:WorkspaceConnection,runtime:WorkspaceConnection,app:Awaited<ReturnType<typeof createStagingServer>>
const root=`/workspace/${company}/corporate-inventories`
const input=(snapshot=createM71Seed(),previous:M71Version|null=null)=>({snapshot,expectedVersionId:previous?.id??null,expectedVersionSha256:previous?.versionSha256??null,correctionReason:previous?"Independent security correction":null,idempotencyKey:crypto.randomUUID()})
const request=(path:string,actor:keyof typeof actors|null="owner",body?:unknown,raw?:string,origin=ORIGIN)=>app.fetch(new Request(ORIGIN+"/workspace-api"+path,{method:body===undefined&&raw===undefined?"GET":"POST",headers:{origin,...(actor?{authorization:"Bearer "+actor}:{}),...(body!==undefined||raw!==undefined?{"content-type":"application/json"}:{})},body:raw??(body===undefined?undefined:JSON.stringify(body))}))
async function json(path:string,actor:keyof typeof actors="owner",body?:unknown,status=body===undefined?200:201){const r=await request(path,actor,body);expect(r.status,await r.clone().text()).toBe(status);expect(r.headers.get("cache-control")).toBe("no-store");return r.json() as Promise<any>}
const versionPath=(v:M71Version)=>`${root}/${v.inventoryId}/versions/${v.id}`
const correctionPath=(v:M71Version)=>`${root}/${v.inventoryId}/versions`
const reviewPath=(v:M71Version)=>`${root}/${v.inventoryId}/reviews`
const reviewInput=(v:M71Version)=>({versionId:v.id,expectedVersionSha256:v.versionSha256,decision:"accepted_bounded_internal",note:"Independent bounded review acknowledges all remaining gaps.",acknowledgedLimitations:[...M71_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
let first:M71Version,current:M71Version,creation:ReturnType<typeof input>,firstExport:string

beforeAll(async()=>{
 if(!target)return
 operator=createPostgresConnection(target,{tls:false});const runtimeUrl=new URL(target);runtimeUrl.username="neuvetra_runtime";runtime=createPostgresConnection(runtimeUrl.toString(),{tls:false})
 for(const id of Object.values(actors))await operator.query("insert into auth.users(id) values($1)",[id])
 await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:company,ownerUserId:actors.owner,members:[{userId:actors.editor,role:"admin"},{userId:actors.reviewer,role:"admin"},{userId:actors.member,role:"member"}]})
 await provisionStagingRoster(operator,{expectedProjectRef:REF,workspaceId:otherCompany,ownerUserId:actors.outsider,members:[]})
 const database=new (HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,r:string)=>HostedWorkspaceDatabase)(runtime,REF)
 const config=readStagingConfig({NODE_ENV:"test",NEUVETRA_STAGING_ENABLED:"enabled",NEUVETRA_STAGING_PROFILE:STAGING_PROFILE,NEUVETRA_STAGING_PROJECT_REF:REF,NEUVETRA_STAGING_ORIGIN:ORIGIN,SUPABASE_URL:`https://${REF}.supabase.co`,SUPABASE_ANON_KEY:"sb_publishable_synthetic_fixture_not_a_real_key",DATABASE_URL:`postgres://neuvetra_runtime:fixture@db.${REF}.supabase.co:5432/postgres`})
 app=await createStagingServer(config,{database,validateUser:async token=>actors[token as keyof typeof actors]?{id:actors[token as keyof typeof actors],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:()=>{}})
},30000)
afterAll(async()=>{await app?.close();await operator?.close()})

integration("COV05 actual staged API refuses anonymous, foreign tenant and member writes with private responses",async()=>{
 expect((await request(root,null)).status).toBe(401)
 const denied=await request(root,"outsider"),missing=await request(`/workspace/${crypto.randomUUID()}/corporate-inventories`,"outsider")
 expect(denied.status).toBe(404);expect(await denied.text()).toBe(await missing.text());expect(denied.headers.get("cache-control")).toBe("no-store")
 expect((await request(root,"member",input())).status).toBe(403)
 expect((await request(root,"owner",input(),undefined,"https://untrusted.invalid")).status).toBe(403)
 creation=input();first=current=await json(root,"owner",creation)
 expect(first.createdBy).toBe(actors.owner);expect(first.companyId).toBe(company);expect(first.review).toBeNull()
 expect((await json(root,"member")).versions).toHaveLength(1)
 for(const path of [versionPath(first),versionPath(first)+"/coverage-export",`${root}/${first.inventoryId}`])expect((await request(path,"outsider")).status).toBe(404)
 firstExport=await(await request(versionPath(first)+"/coverage-export","member")).text()
 expect(JSON.parse(firstExport)).toBeDefined()
})

integration("COV06 strict actual HTTP parsing refuses identity injection, duplicate keys and invalid Unicode",async()=>{
 for(const field of ["companyId","actorId","createdBy","corporateCompleteness","versionSha256"]){const r=await request(correctionPath(current),"owner",{...input(createM71Seed(),current),[field]:actors.outsider});expect(r.status,field).toBe(422)}
 const ordinary=JSON.stringify(input(createM71Seed(),current))
 expect((await request(correctionPath(current),"owner",undefined,ordinary.replace('"snapshot":','"idempotencyKey":"71000000-0000-4000-8000-000000009999","snapshot":'))).status).toBe(422)
 const malformed=structuredClone(input(createM71Seed(),current));malformed.snapshot.companyLabel="Invalid \ud800 label"
 expect((await request(correctionPath(current),"owner",malformed)).status).toBe(422)
 for(const collection of ["entities","facilities"] as const){const coerced:any=input(createM71Seed(),current);coerced.snapshot[collection][0].countryCode=["US"];coerced.snapshot[collection][0].regionCode=["CA"];expect((await request(correctionPath(current),"owner",coerced)).status).toBe(422)}
 expect((await json(root)).versions).toHaveLength(1)
})

integration("COV06/07 lineage, replay and independent review survive two editors and frozen exports",async()=>{
 const changed=createM71Seed();changed.companyLabel="Independent edited label"
 current=await json(correctionPath(first),"editor",input(changed,first))
 expect(new Set(current.contributorIds)).toEqual(new Set([actors.owner,actors.editor]));expect(current.review).toBeNull()
 expect((await request(reviewPath(current),"owner",reviewInput(current))).status).toBe(409)
 expect((await request(reviewPath(current),"editor",reviewInput(current))).status).toBe(409)
 const review=await json(reviewPath(current),"reviewer",reviewInput(current));expect(review.reviewerId).toBe(actors.reviewer);expect(review.versionId).toBe(current.id)
 const retried=await json(root,"owner",creation);expect(retried.id).toBe(first.id)
 expect((await request(root,"editor",creation)).status).toBe(409)
 expect((await request(root,"owner",{...creation,snapshot:{...creation.snapshot,companyLabel:"Changed fingerprint"}})).status).toBe(409)
 expect((await request(correctionPath(current),"owner",input(structuredClone(current.snapshot),current))).status).toBe(422)
 const next=structuredClone(current.snapshot);next.coverageItems[0]!.reason="Explanation-only successor"
 const previous=current;current=await json(correctionPath(current),"owner",input(next,current));expect(current.review).toBeNull();expect(current.previousVersionId).toBe(previous.id)
 expect(await(await request(versionPath(first)+"/coverage-export","member")).text()).toBe(firstExport)
 expect((await json(versionPath(previous),"member")).review.id).toBe(review.id)
 expect((await request(reviewPath(current),"reviewer",reviewInput(previous))).status).toBe(409)
})

integration("COV06 simultaneous distinct successors have exactly one winner",async()=>{
 const a=structuredClone(current.snapshot),b=structuredClone(current.snapshot);a.companyLabel="Race A";b.companyLabel="Race B"
 const results=await Promise.all([request(correctionPath(current),"owner",input(a,current)),request(correctionPath(current),"editor",input(b,current))])
 expect(results.map(r=>r.status).sort()).toEqual([201,409]);current=await results.find(r=>r.status===201)!.json() as M71Version
 expect((await request(correctionPath(current),"owner",input(a,first))).status).toBe(409)
})

integration("COV05/12 real runtime role has forced RLS and no direct mutation rights",async()=>{
 const tables=["heads","versions","reviews","requests","audit"].map(x=>"corporate_inventory_"+x)
 const roles=(await runtime.query<any>("select rolsuper,rolbypassrls from pg_roles where rolname=current_user")).rows[0]
 expect(roles.rolsuper).toBe(false);expect(roles.rolbypassrls).toBe(false)
 for(const table of tables){
  const rights=(await runtime.query<any>("select relrowsecurity,relforcerowsecurity,has_table_privilege(current_user,c.oid,'INSERT') ins,has_table_privilege(current_user,c.oid,'UPDATE') upd,has_table_privilege(current_user,c.oid,'DELETE') del from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and relname=$1",[table])).rows[0]
  expect(rights).toEqual({relrowsecurity:true,relforcerowsecurity:true,ins:false,upd:false,del:false})
  await runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.outsider]);expect((await tx.query(`select * from neuvetra.${table} where company_id=$1`,[company])).rows).toHaveLength(0)})
  await expect(runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.owner]);await tx.query(`delete from neuvetra.${table} where company_id=$1`,[company])})).rejects.toThrow()
 }
 const decoded=await decodeCorporateRegister(await json(root),company);expect(decoded.headVersionId).toBe(current.id)
 expect((await decodeCorporateVersion(JSON.parse(firstExport),company)).id).toBe(first.id)
})

integration("COV06 SQL save boundary independently refuses malformed snapshots and contributor review",async()=>{
 for(const mutate of [(s:any)=>{s.entities[0].countryCode=["US"]},(s:any)=>{s.coverageItems.pop()},(s:any)=>{s.entities=[]},(s:any)=>{s.companyId=otherCompany},(s:any)=>{const extra=structuredClone(s.coverageItems.find((r:any)=>r.entityId===null));extra.id="ffffffff-ffff-4fff-8fff-ffffffffffff";extra.endExclusive="2025-07-01";s.coverageItems.push(extra)}]){
  const malformed=structuredClone(current.snapshot);mutate(malformed)
  let accepted=false,code:string|undefined
  try{await runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.owner]);await tx.query("select neuvetra.save_corporate_inventory($1,$2,$3::text::jsonb)",[company,current.inventoryId,JSON.stringify(input(malformed,current))]);accepted=true;throw Error("Rollback malformed SQL save probe")})}catch(e){code=(e as any).code}
  expect(accepted).toBe(false);expect(code).toBe("22023")
 }
 await expect(runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.owner]);await tx.query("select neuvetra.review_corporate_inventory($1,$2,$3::text::jsonb)",[company,current.inventoryId,JSON.stringify(reviewInput(current))])})).rejects.toThrow()
})

integration("COV06 Unicode codepoint ordering survives actual SQL/API and production decoder",async()=>{
 const next=structuredClone(current.snapshot);next.requirements[0]!.missingFacts=["😀 astral fact","\ue000 BMP fact"]
 next.boundaryDecisions[0]!.evidenceRefs=["😀 astral purpose","\ue000 BMP purpose"].map(purpose=>({artifactId:M71_ARTIFACT.id,expectedSha256:M71_EVIDENCE_SHA256,locator:M71_ARTIFACT.locator,purpose}))
 const normalized=validateM71Snapshot(next,current.snapshot)
 expect(normalized.requirements[0]!.missingFacts).toEqual(["\ue000 BMP fact","😀 astral fact"])
 current=await json(correctionPath(current),"owner",input(next,current));expect((await decodeCorporateVersion(current,company)).id).toBe(current.id)
 expect(current.snapshot.boundaryDecisions[0]!.evidenceRefs.map(r=>r.purpose)).toEqual(["\ue000 BMP purpose","😀 astral purpose"])
})

integration("COV06 SQL review refuses null decision before persistence",async()=>{
 // Always roll back this probe, including an unexpectedly accepted malformed review.
 let accepted=false,error:any
 try{await runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.reviewer]);await tx.query("select neuvetra.review_corporate_inventory($1,$2,$3::text::jsonb)",[company,current.inventoryId,JSON.stringify({...reviewInput(current),decision:null})]);accepted=true;throw Error("Rollback malformed review probe")})}catch(e){error=e}
 expect(accepted).toBe(false)
 expect(error.code).toBe("22023")
})

integration("COV06 direct SQL positive control can create an independent review, then rolls back",async()=>{
 let accepted=false
 try{await runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.reviewer]);const row=await tx.query("select neuvetra.review_corporate_inventory($1,$2,$3::text::jsonb) id",[company,current.inventoryId,JSON.stringify(reviewInput(current))]);accepted=Boolean(row.rows[0]);throw Error("Rollback positive control")})}catch{}
 expect(accepted).toBe(true)
})

integration("COV05 pending read cannot survive admission revocation committed before its lock",async()=>{
 let release!:()=>void,started!:()=>void;const gate=new Promise<void>(r=>{release=r}),ready=new Promise<void>(r=>{started=r})
 const revoke=operator.transaction(async tx=>{await tx.query("update neuvetra.staging_access set active=false where user_id=$1",[actors.member]);started();await gate})
 await ready;const pending=request(root,"member");let blocked=false
 for(let i=0;i<50;i++){const rows=(await operator.query<any>("select pid from pg_stat_activity where datname=current_database() and usename='neuvetra_runtime' and wait_event_type='Lock'")).rows;if(rows.length){blocked=true;break}await new Promise(r=>setTimeout(r,20))}
 release();await revoke
 expect(blocked).toBe(true);expect([403,404]).toContain((await pending).status)
 for(const path of [root,versionPath(first),versionPath(first)+"/coverage-export"])expect((await request(path,"member")).status).toBe(403)
 await runtime.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.member]);expect((await tx.query("select * from neuvetra.corporate_inventory_versions where company_id=$1",[company])).rows).toHaveLength(0)})
 await operator.query("update neuvetra.staging_access set active=true where user_id=$1",[actors.member])
})

integration("COV05 pending save cannot survive membership downgrade committed before its lock",async()=>{
 let release!:()=>void,started!:()=>void;const gate=new Promise<void>(r=>{release=r}),ready=new Promise<void>(r=>{started=r})
 const revoke=operator.transaction(async tx=>{await tx.query("update neuvetra.company_members set role='member' where company_id=$1 and user_id=$2",[company,actors.editor]);started();await gate})
 await ready;const next=structuredClone(current.snapshot);next.companyLabel="Must not persist after downgrade";const pending=request(correctionPath(current),"editor",input(next,current));let blocked=false
 for(let i=0;i<50;i++){if((await operator.query<any>("select pid from pg_stat_activity where datname=current_database() and usename='neuvetra_runtime' and wait_event_type='Lock'")).rows.length){blocked=true;break}await new Promise(r=>setTimeout(r,20))}
 release();await revoke;expect(blocked).toBe(true);expect((await pending).status).toBe(403);expect((await json(root)).headVersionId).toBe(current.id)
 await operator.query("update neuvetra.company_members set role='admin' where company_id=$1 and user_id=$2",[company,actors.editor])
})

integration("COV09 actual readback refuses altered native columns, missing audit and coordinated unsupported snapshot hashes",async()=>{
 const probes=[
  "update neuvetra.corporate_inventory_versions set created_by=$2 where id=$1",
  "delete from neuvetra.corporate_inventory_audit where record_id=$1",
  "update neuvetra.corporate_inventory_versions set payload=jsonb_set(payload,'{snapshot,period,start}','\"2024-01-01\"'::jsonb),content_sha256=neuvetra.m67_hash(jsonb_set(payload->'snapshot','{period,start}','\"2024-01-01\"'::jsonb)) where id=$1"
 ]
 for(const probe of probes){let refused=false
  try{await operator.transaction(async tx=>{await tx.exec("set local session_replication_role=replica");await tx.query(probe,probe.includes('$2')?[current.id,actors.outsider]:[current.id]);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.owner]);try{await readCorporateInventory(tx,company)}catch{refused=true}throw Error("Rollback isolated corruption probe")})}catch{}
  expect(refused).toBe(true)
 }
 expect((await json(root)).headVersionId).toBe(current.id)
})

integration("COV09 committed missing audit reaches actual private read and export refusal then exact row restoration",async()=>{
 const audit=(await operator.query<any>("select * from neuvetra.corporate_inventory_audit where company_id=$1 and record_id=$2",[company,current.id])).rows[0]
 try{
  await operator.transaction(async tx=>{await tx.exec("set local session_replication_role=replica");await tx.query("delete from neuvetra.corporate_inventory_audit where company_id=$1 and record_id=$2",[company,current.id])})
  for(const path of [root,versionPath(current),versionPath(current)+"/coverage-export"]){const r=await request(path);expect(r.status).toBe(503);expect(r.headers.get("cache-control")).toBe("no-store");expect(await r.text()).not.toContain(current.snapshot.companyLabel)}
 }finally{await operator.query("insert into neuvetra.corporate_inventory_audit select * from jsonb_populate_record(null::neuvetra.corporate_inventory_audit,$1::text::jsonb)",[JSON.stringify(audit)])}
 expect((await json(root)).headVersionId).toBe(current.id)
})

integration("COV09 self-consistent content/version/audit hashes cannot approve unsupported period semantics",async()=>{
 const forged=structuredClone(current);forged.snapshot.period.start="2024-01-01";forged.contentSha256=m71Hash(forged.snapshot);forged.versionSha256=m71Hash(m71VersionHashPayload(forged))
 let refused=false
 try{await operator.transaction(async tx=>{
  await tx.exec("set local session_replication_role=replica")
  await tx.query("update neuvetra.corporate_inventory_versions set payload=jsonb_set(jsonb_set(jsonb_set(payload,'{snapshot}',$2::text::jsonb),'{contentSha256}',to_jsonb($3::text)),'{versionSha256}',to_jsonb($4::text)),content_sha256=$3,version_sha256=$4 where id=$1",[current.id,JSON.stringify(forged.snapshot),forged.contentSha256,forged.versionSha256])
  await tx.query("update neuvetra.corporate_inventory_audit set record_sha256=$2 where record_id=$1",[current.id,forged.versionSha256])
  const native=(await tx.query<any>("select content_sha256,version_sha256,payload from neuvetra.corporate_inventory_versions where id=$1",[current.id])).rows[0]
  expect(native.content_sha256).toBe(m71Hash(native.payload.snapshot));expect(native.version_sha256).toBe(m71Hash(m71VersionHashPayload(native.payload)))
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.owner]);try{await readCorporateInventory(tx,company)}catch{refused=true};throw Error("Rollback coordinated forgery")
 })}catch{}
 expect(refused).toBe(true)
})

integration("COV09 corrupted idempotency outcome cannot replay a different valid version",async()=>{
 try{
  await operator.transaction(async tx=>{await tx.exec("set local session_replication_role=replica");await tx.query("update neuvetra.corporate_inventory_requests set record_id=$3 where company_id=$1 and idempotency_key=$2",[company,creation.idempotencyKey,current.id])})
  const r=await request(root,"owner",creation);expect(r.status).toBe(503)
 }finally{await operator.transaction(async tx=>{await tx.exec("set local session_replication_role=replica");await tx.query("update neuvetra.corporate_inventory_requests set record_id=$3 where company_id=$1 and idempotency_key=$2",[company,creation.idempotencyKey,first.id])})}
 expect((await json(root,"owner",creation)).id).toBe(first.id)
})

integration("COV09 request fingerprint, kind, missing provenance and retained export alteration fail closed",async()=>{
 const probes=[
  "update neuvetra.corporate_inventory_requests set fingerprint=repeat('0',64) where record_id=$1",
  "update neuvetra.corporate_inventory_requests set kind='review' where record_id=$1",
  "delete from neuvetra.corporate_inventory_requests where record_id=$1",
  "update neuvetra.corporate_inventory_versions set export_text=export_text||' ' where id=$1"
 ]
 for(const sql of probes){let refused=false
  try{await operator.transaction(async tx=>{await tx.exec("set local session_replication_role=replica");await tx.query(sql,[current.id]);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.owner]);try{await readCorporateInventory(tx,company)}catch{refused=true}throw Error("Rollback provenance probe")})}catch{}
  expect(refused).toBe(true)
 }
})

integration("COV12 rollback-only capacity pressure refuses atomic append and preserves readable head/export",async()=>{
 // Deliberate storage pressure in one rollback-only transaction, not a claim that
 // ordinary valid snapshots have reproduced a naturally full 3.8 MB history.
 const before=await(await request(versionPath(current)+"/coverage-export")).text();let code:string|undefined
 try{await operator.transaction(async tx=>{
  await tx.exec("set local session_replication_role=replica")
  await tx.query("update neuvetra.corporate_inventory_versions set export_text=repeat('x',3799999) where id=$1",[first.id])
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors.owner]);await tx.exec("set local role neuvetra_runtime")
  const next=structuredClone(current.snapshot);next.companyLabel="Capacity pressure append must not persist"
  await tx.query("select neuvetra.save_corporate_inventory($1,$2,$3::text::jsonb)",[company,current.inventoryId,JSON.stringify(input(next,current))]);throw Error("Capacity guard failed")
 })}catch(e){code=(e as any).code}
 expect(code).toBe("54001");expect((await json(root)).headVersionId).toBe(current.id)
 expect(await(await request(versionPath(current)+"/coverage-export")).text()).toBe(before)
 expect(await(await request(versionPath(first)+"/coverage-export")).text()).toBe(firstExport)
})

integration("COV06 long valid astral correction and review notes persist and decode consistently",async()=>{
 const note="😀".repeat(300),next=structuredClone(current.snapshot);next.companyLabel="Unicode note verification"
 current=await json(correctionPath(current),"owner",{...input(next,current),correctionReason:note})
 expect((await decodeCorporateVersion(current,company)).correctionReason).toBe(note)
 const review=await json(reviewPath(current),"reviewer",{...reviewInput(current),note})
 const read=await decodeCorporateVersion(await json(versionPath(current)),company)
 expect(review.note).toBe(note);expect(read.review?.note).toBe(note)
})

integration("COV09 bundled synthetic evidence drift is refused at actual authorized read boundary",async()=>{
 const fixture=M71_ARTIFACT as unknown as {text:string},original=fixture.text
 try{fixture.text=original+" Altered bundled text.";expect((await request(root)).status).toBe(503);expect((await request(versionPath(first)+"/coverage-export")).status).toBe(503)}finally{fixture.text=original}
 expect((await json(root)).headVersionId).toBe(current.id)
})

