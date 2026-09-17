import {test,expect} from 'bun:test'
import {createM78QaFixture,m78QaProcessInput} from './m78-integrated-fixture'
import {createM78Routes} from '../../apps/site-api/src/workspace/m78-routes'
import {M78_REVIEWED_POLICY} from '../../packages/neuvetra-database/src/m78-policy'
import {decodeScope1Register,decodeScope1Report,decodeScope1Version} from '../../apps/site-web/src/lib/m78-api'
import {buildM78Dependencies} from '../../packages/neuvetra-database/src/m78-reconciliation'
import {m78Hash} from '../../packages/neuvetra-database/src/m78'
import type {M78ProcessActivity} from '../../packages/neuvetra-database/src/m78-contract'
import {m78CanonicalJson} from '../../packages/neuvetra-database/src/m78-validation'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/index'
import {createHash} from 'node:crypto'
const baseline=process.env.M78_QA_CI_BASELINE_URL,enabled=process.env.M78_QA_POSITIVE_NATIVE==='1'
const sha=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex')
async function rows(c:WorkspaceConnection){
 const tables=(await c.query<{name:string}>("select tablename name from pg_tables where schemaname='neuvetra' order by tablename")).rows
 const out=[]
 for(const {name}of tables){if(!/^[a-z0-9_]+$/.test(name))throw Error('Unsafe table identity');const r=(await c.query<{count:string;content:string}>(`select count(*)::text count,coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text collate "C"),'')content from neuvetra.${name} t`)).rows[0]!;out.push({name,count:r.count,sha256:sha(r.content)})}
 return out
}
async function history(c:WorkspaceConnection,company:string){return Number((await c.query<{bytes:string}>("select ((select coalesce(sum(octet_length(export_text)+octet_length(neuvetra.m67_canonical(proof))),0) from neuvetra.scope1_versions where company_id=$1)+(select coalesce(sum(octet_length(payload->>'html')+octet_length(payload->>'snapshotJson')),0) from neuvetra.scope1_reports where company_id=$1))::text bytes",[company])).rows[0]!.bytes)}
test.skipIf(!baseline||!enabled)('M78 independent real30M history refusal preserves rows and historical reports',async()=>{
 const bytes=new Uint8Array(await Bun.file('.superpowers/m78_author_native_1789620106488-result.json').arrayBuffer());expect(sha(bytes)).toBe('e2cb73a1a3c80f4b2adb62d564ff8ab9eb02809444a5734794c3f64cb11732ae');const source=JSON.parse(new TextDecoder().decode(bytes)),company=source.companyId,owner=source.users.owner
 const f=await createM78QaFixture(baseline!,'m78_qa_history_'+Date.now()),errors:any[]=[]
 const routes=createM78Routes({database:new Proxy(f.database,{get(target,key){const value=(target as any)[key];return typeof value==='function'?async(...args:unknown[])=>{try{return await value.apply(target,args)}catch(e){errors.push({code:(e as any).code,message:(e as Error).message});throw e}}:value}}),authorities:f.authorities,policy:M78_REVIEWED_POLICY,origin:'http://127.0.0.1:47803',validateUser:async()=>({id:owner,email:null,phone:null,fullName:null})})
 const call=(path:string,body?:unknown)=>routes(new Request('http://127.0.0.1:47803/workspace/'+company+'/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer fictional-history-owner',origin:'http://127.0.0.1:47803',...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}))
 try{
  let response=await call('scope1-inventory');expect(response.status).toBe(200);let register=await decodeScope1Register(await response.json(),company);expect(register.process.versions).toHaveLength(3);expect(register.inventory.versions).toHaveLength(2);expect(register.reconciliation.totals?.company.kgCo2eExact).toBe('126850.17632025')
  const v=register.inventory.versions.at(-1)!,path='scope1-inventory/'+v.streamId+'/reports';expect(v.review?.decision).toBe('accepted_bounded_inventory')
  const original=await decodeScope1Report(await(await call(path+'/'+register.inventory.reports[0]!.id)).json(),company),initial=await history(f.operator,company);expect(initial).toBeGreaterThan(20000000);expect(initial).toBeLessThan(30000000)
  let refused=false,successes=0,replay:any=null,sequenceState:any=null
  for(let i=0;i<6;i++){
   const request={versionId:v.id,expectedVersionSha256:v.versionSha256,expectedDecisionId:v.review!.id,expectedDecisionSha256:v.review!.decisionSha256,expectedReconciliationSha256:v.reconciliation!.contentSha256,idempotencyKey:crypto.randomUUID()},before=await rows(f.operator),historyBefore=await history(f.operator,company)
   response=await call(path,request);const body=await response.json()
   if(response.status===201){const report=await decodeScope1Report(body,company);expect(await history(f.operator,company)).toBe(historyBefore+Buffer.byteLength(report.html)+Buffer.byteLength(report.snapshotJson));expect(await history(f.operator,company)).toBeLessThanOrEqual(30000000);successes++;replay={request,report};continue}
   expect(response.status).toBe(422);expect(body.code).toBe('history_limit');expect(errors.at(-1)).toMatchObject({code:'54000',message:'retained history capacity exceeded'});expect(await rows(f.operator)).toEqual(before);expect(await history(f.operator,company)).toBe(historyBefore);expect(historyBefore).toBeLessThanOrEqual(30000000)
   const read=await call('scope1-inventory');expect(read.status).toBe(200);register=await decodeScope1Register(await read.json(),company);expect(Buffer.byteLength(m78CanonicalJson(register))).toBeLessThanOrEqual(10000000);expect(register.reconciliation.totals?.company.kgCo2eExact).toBe('126850.17632025')
   expect(await(await call(path+'/'+original.id)).json()).toEqual(original);expect(await(await call(path+'/'+original.id+'/download')).text()).toBe(original.html);expect(await(await call(path+'/'+original.id+'/snapshot')).text()).toBe(original.snapshotJson)
   const repeat=await call(path,replay.request);expect(repeat.status).toBe(201);expect(await repeat.json()).toEqual(replay.report);expect(await rows(f.operator)).toEqual(before)
   sequenceState=(await f.operator.query("select sequencename,last_value::text from pg_sequences where schemaname='neuvetra' order by sequencename")).rows;refused=true;break
  }
  expect(successes).toBeGreaterThan(0);expect(refused).toBe(true)
  await Bun.write('.superpowers/'+f.name+'-result.json',JSON.stringify({status:'independent30Mhistory_capacity_pass',database:f.name,migrationSha256:f.migrationSha256,initialHistoryBytes:initial,finalHistoryBytes:await history(f.operator,company),successfulNewReports:successes,typed422:true,allTableRowsPreservedOnRefusal:true,oldReportAndDownloadsExact:true,successfulRequestReplayAfterCapacity:true,auditSequenceRollbackClaim:false,sequenceState,errors,actualRoutes:true,actualBrowserDecoders:true,hosted:false},null,2)+'\n')
 }finally{await f.close()}
},180000)

test.skipIf(!baseline||!enabled)('M78 independent valid10M response refusal retains readable unknown history',async()=>{
 const f=await createM78QaFixture(baseline!,'m78_qa_response_'+Date.now()),errors:any[]=[]
 const routes=createM78Routes({database:new Proxy(f.database,{get(target,key){const value=(target as any)[key];return typeof value==='function'?async(...args:unknown[])=>{try{return await value.apply(target,args)}catch(e){errors.push({code:(e as any).code,capacityKind:(e as any).capacityKind,message:(e as Error).message});throw e}}:value}}),authorities:f.authorities,policy:M78_REVIEWED_POLICY,origin:'http://127.0.0.1:47804',validateUser:async()=>({id:f.users.owner,email:null,phone:null,fullName:null})})
 const call=(path:string,body?:unknown)=>routes(new Request('http://127.0.0.1:47804/workspace/'+f.companyId+'/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer fictional-response-owner',origin:'http://127.0.0.1:47804',...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)}))
 const read=async()=>{const r=await call('scope1-inventory');expect(r.status).toBe(200);return decodeScope1Register(await r.json(),f.companyId)}
 try{
  let register=await read();const draft=m78QaProcessInput(register),location=register.coverageVersion.snapshot.facilities[0]!
  draft.evidenceStatements.push(...Array.from({length:46},(_,i)=>({reference:'FICTIONAL-INDEPENDENT-CAPACITY-'+i,issuer:'Fictional independent QA inspection',description:('Fictional unknown applicability inspection observation retained for capacity testing. ').repeat(20).trim(),issuedOn:'2025-12-31',purpose:'process_inspection' as const,entityId:location.entityId,facilityId:location.id})))
  const firstResponse=await call('process-screen',draft);expect(firstResponse.status,await firstResponse.clone().text()).toBe(201);const first=await decodeScope1Version(await firstResponse.json(),f.companyId),path='process-screen/'+first.version.streamId
  const reportResponse=await call(path+'/reports',{versionId:first.version.id,expectedVersionSha256:first.version.versionSha256,expectedDecisionId:null,expectedDecisionSha256:null,expectedReconciliationSha256:null,idempotencyKey:crypto.randomUUID()});expect(reportResponse.status).toBe(201);const original=await decodeScope1Report(await reportResponse.json(),f.companyId);register=await read()
  let refused=false,successes=0
  for(let i=0;i<16;i++){
   const prior=register.process.versions.at(-1)!,activity=prior.activity as M78ProcessActivity,before=await rows(f.operator),body={...activity,evidenceStatements:activity.evidenceStatements.map((e,j)=>j===0?{...e,description:'Fictional retained inspection clarification '+i+' with applicability still unresolved.'}:e),expectedVersionId:prior.id,expectedVersionSha256:prior.versionSha256,expectedDependencySha256:buildM78Dependencies(register.proof,'process_screen',m78Hash).dependencySha256,correctionReason:'Independent factual note correction keeps all unknown gas and process facts.',idempotencyKey:crypto.randomUUID()},response=await call(path+'/versions',body),result=await response.json()
   if(response.status===201){await decodeScope1Version(result,f.companyId,prior);register=await read();successes++;continue}
   expect(response.status).toBe(422);expect(result.code).toBe('history_limit');expect(errors.at(-1)).toMatchObject({code:'54000',capacityKind:'register_response'});expect(await rows(f.operator)).toEqual(before);expect(await(await call('scope1-inventory')).json()).toEqual(register);expect(await(await call(path+'/reports/'+original.id)).json()).toEqual(original);expect(await(await call(path+'/reports/'+original.id+'/download')).text()).toBe(original.html);expect(register.reconciliation.totals).toBeNull();expect(register.reconciliation.knownSourceSubtotal).toBeNull();refused=true;break
  }
  expect(successes).toBeGreaterThan(0);expect(refused).toBe(true)
  await Bun.write('.superpowers/'+f.name+'-result.json',JSON.stringify({status:'independent10Mresponse_capacity_pass',database:f.name,migrationSha256:f.migrationSha256,successfulSuccessors:successes,registerBytes:Buffer.byteLength(m78CanonicalJson(register)),typed422:true,allTableRowsPreservedOnRefusal:true,oldRegisterAndReportReadable:true,unknownTotalsRemainNull:true,auditSequenceRollbackClaim:false,errors,actualRoutes:true,actualBrowserDecoders:true,hosted:false},null,2)+'\n')
 }finally{await f.close()}
},180000)
