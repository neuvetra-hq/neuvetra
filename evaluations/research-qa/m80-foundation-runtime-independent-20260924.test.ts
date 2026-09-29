import {test,expect} from 'bun:test'
import {createPostgresConnection,HostedWorkspaceDatabase,migratePrivateStaging,readMigrationManifest,provisionStagingRoster,type WorkspaceConnection} from '../../packages/neuvetra-database/src/index'
import {createM80FixtureSetup,M80_FIXTURE_SHA256} from '../../packages/neuvetra-database/src/m80-fixture'
import {qaAs,qaBaseline,qaClone,qaMetadata,qaHash} from './m80-foundation-runtime-independent-20260924-fixture'
import {qaInvalidSetups,qaSuccessorSetups,qaNormalizedSetup} from './m80-foundation-runtime-independent-20260924-cases'
const qaCanonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(qaCanonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+qaCanonical(v[k])).join(',')+'}'
async function qaRefuses(operation:Promise<unknown>,code?:string){let error:any;try{await operation}catch(e){error=e}expect(error).toBeDefined();if(code)expect(error.code).toBe(code)}

test.skipIf(process.env.NEUVETRA_M80_INDEPENDENT_NATIVE!=='1')('M80 independent actual PostgreSQL, adapter and HTTP security review',async()=>{
 const {createM80BetaRoutes}=await import('../../apps/site-api/src/workspace/m80-beta-routes')
 const f=await qaClone(),op=f.operator,checks:{name:string;passed:boolean;error?:string}[]=[],details:Record<string,unknown>={};let runtime:WorkspaceConnection|undefined,server:ReturnType<typeof Bun.serve>|undefined
 const check=async(name:string,fn:()=>Promise<void>)=>{try{console.log('QA_START '+name);await fn();checks.push({name,passed:true});console.log('QA_PASS '+name)}catch(e){checks.push({name,passed:false,error:(e as Error).message});throw e}}
 const output='evaluations/research-qa/m80-foundation-runtime-independent-20260924-execution-'+f.name+'.json'
 try{
  const before=await qaBaseline(op),metaBefore=await qaMetadata(op),oldReceipts=(await op.query('select name,sha256 from neuvetra.schema_migrations order by name')).rows
  const projectRef=(await op.query<{project_ref:string}>('select project_ref from neuvetra.staging_target')).rows[0]!.project_ref
  await check('schema21 baseline and exact additive migration',async()=>{
   expect(oldReceipts).toHaveLength(21);const manifest=await readMigrationManifest();expect(manifest).toHaveLength(22)
   const result=await migratePrivateStaging(op,{expectedProjectRef:projectRef,syntheticTargetConfirmed:true,reuseExistingProject:true});expect(result.schemaVersion).toBe(22)
   expect(await qaBaseline(op,before.map(r=>r.name))).toEqual(before)
   const metaAfter=await qaMetadata(op,metaBefore.identities);expect(metaAfter.records).toEqual(metaBefore.records)
   expect((await op.query('select name,sha256 from neuvetra.schema_migrations order by name')).rows.slice(0,21)).toEqual(oldReceipts)
   details.preservation={priorTableCount:before.length,tables:before,metadataGroups:Object.keys(metaBefore.records),metadataProof:Object.fromEntries(Object.entries(metaBefore.records).map(([key,value])=>[key,{rows:value.length,beforeSha256:qaHash(qaCanonical(value)),afterSha256:qaHash(qaCanonical(metaAfter.records[key]))}])),metadataExact:true,migration:manifest.at(-1)}
   delete (details.preservation as any).migration.sql
  })
  await check('migration second application no-op and occupied receipt refusal',async()=>{
   console.log('QA_MIGRATION_NOOP_BEGIN');const receipts=(await op.query('select * from neuvetra.schema_migrations order by name')).rows,all=await qaBaseline(op)
   await migratePrivateStaging(op,{expectedProjectRef:projectRef,syntheticTargetConfirmed:true,reuseExistingProject:true});expect(await qaBaseline(op)).toEqual(all);expect((await op.query('select * from neuvetra.schema_migrations order by name')).rows).toEqual(receipts)
   console.log('QA_MIGRATION_CHANGED_BEGIN');await op.transaction(async tx=>{await tx.query("update neuvetra.schema_migrations set sha256=$1 where name='0022_scope1_beta_foundation.sql'",['0'.repeat(64)]);const wrapped={...op,query:tx.query,exec:tx.exec,transaction:async(fn:any)=>fn(tx)};await qaRefuses(migratePrivateStaging(wrapped,{expectedProjectRef:projectRef,syntheticTargetConfirmed:true,reuseExistingProject:true}));throw Error('QA rollback changed migration receipt')}).catch(e=>{if(e.message!=='QA rollback changed migration receipt')throw e})
   console.log('QA_MIGRATION_OCCUPIED_BEGIN');await op.transaction(async tx=>{await tx.exec("delete from neuvetra.schema_migrations where name='0022_scope1_beta_foundation.sql'");const wrapped={...op,query:tx.query,exec:tx.exec,transaction:async(fn:any)=>fn(tx)};await qaRefuses(migratePrivateStaging(wrapped,{expectedProjectRef:projectRef,syntheticTargetConfirmed:true,reuseExistingProject:true}));throw Error('QA rollback occupied migration')}).catch(e=>{if(e.message!=='QA rollback occupied migration')throw e})
   expect((await op.query('select * from neuvetra.schema_migrations order by name')).rows).toEqual(receipts)
  })
  const users={owner:crypto.randomUUID(),admin:crypto.randomUUID(),member:crypto.randomUUID(),outsider:crypto.randomUUID(),uninvited:crypto.randomUUID()},company=crypto.randomUUID(),otherCompany=crypto.randomUUID()
  for(const id of Object.values(users))await op.query('insert into auth.users(id)values($1)',[id])
  await provisionStagingRoster(op,{expectedProjectRef:projectRef,workspaceId:company,ownerUserId:users.owner,members:[{userId:users.admin,role:'admin'},{userId:users.member,role:'member'}]})
  await provisionStagingRoster(op,{expectedProjectRef:projectRef,workspaceId:otherCompany,ownerUserId:users.outsider,members:[]})
  runtime=createPostgresConnection(f.runtimeUrl,{tls:false,maxConnections:5})
  const database=new(HostedWorkspaceDatabase as any)(runtime,projectRef,true)
  await check('dedicated runtime readiness and forced RLS',async()=>{
   expect((await database.checkReadiness()).schemaVersion).toBe(22)
   const tables=(await op.query<{relname:string;relrowsecurity:boolean;relforcerowsecurity:boolean}>("select relname,relrowsecurity,relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relname like 'scope1_beta_%' and c.relkind='r' order by relname")).rows
   expect(tables).toHaveLength(6);for(const table of tables){expect(table.relrowsecurity).toBe(true);expect(table.relforcerowsecurity).toBe(true)}details.newTables=tables
  })
  const origin='http://127.0.0.1:48080',routes=createM80BetaRoutes({database,origin,validateUser:async(token:string)=>users[token as keyof typeof users]?{id:users[token as keyof typeof users],email:null,phone:null,fullName:null}:null})
  const {createStagingServer}=await import('../../apps/site-api/src/staging/server'),logs:unknown[]=[]
  const app=await createStagingServer({profile:'neuvetra.private-synthetic-staging.v1',origin,projectRef,reuseExistingProject:true,supabaseUrl:'https://synthetic.invalid',supabaseAnonKey:'synthetic-not-a-credential',databaseUrl:f.runtimeUrl,webRoot:'.',port:0},{database,validateUser:async token=>users[token as keyof typeof users]?{id:users[token as keyof typeof users],email:null,phone:null,fullName:null}:null,verifyAssets:async()=>{},serveAsset:async()=>null,log:event=>logs.push(event)})
  server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:app.fetch});const base='http://127.0.0.1:'+server.port
  const call=(actor:string,path='/workspace/'+company+'/scope1-beta-setup',body?:unknown,headers:Record<string,string>={})=>fetch(base+'/workspace-api'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+actor,origin,'content-type':'application/json',...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)})
  const initial=(setup:unknown=createM80FixtureSetup(company))=>({idempotencyKey:crypto.randomUUID(),expectedRevision:0,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,setup})
  const rootPath='/workspace/'+company+'/scope1-beta-setup'
  await check('operator-only fixture admission required',async()=>{
   expect((await call('owner')).status).toBe(404)
   expect((await call('owner',rootPath,initial())).status).toBe(404)
   for(const id of [company,otherCompany]) await op.query("insert into neuvetra.scope1_beta_fixture_admissions(company_id,fixture_profile_id,fixture_version,fixture_sha256,active,admitted_by)values($1,'m80-synthetic-scope1-foundation-v1',1,$2,true,$3)",[id,M80_FIXTURE_SHA256,users.owner])
   expect((await call('owner')).status).toBe(200)
   await op.query('update neuvetra.scope1_beta_fixture_admissions set active=false where company_id=$1',[company])
   expect((await call('owner')).status).toBe(404);expect((await call('owner',rootPath,initial())).status).toBe(404)
   await op.query('update neuvetra.scope1_beta_fixture_admissions set active=true where company_id=$1',[company])
  })
  await check('HTTP bearer, origin, body, methods and active-access gates',async()=>{
   for(const actor of ['','invalid'])expect((await call(actor)).status).toBe(401)
   expect((await call('uninvited')).status).toBe(403)
   expect((await call('owner',rootPath,initial(),{origin:'https://foreign.invalid'})).status).toBe(403)
   expect((await call('owner',rootPath,initial(),{origin:''})).status).toBe(403)
   expect((await call('owner',rootPath,undefined,{origin:'https://foreign.invalid'})).status).toBe(403)
   for(const body of ['{','{"idempotencyKey":1,"idempotencyKey":2}',' '.repeat(60000)])expect([413,422]).toContain((await call('owner',rootPath,body)).status)
   expect((await call('owner',rootPath,'x'.repeat(300001))).status).toBe(413)
   expect((await fetch(base+'/workspace-api'+rootPath,{method:'DELETE',headers:{authorization:'Bearer owner',origin}})).status).toBe(405)
   for(const action of ['invite','calculate','export','release'])expect((await call('owner',rootPath+'/'+action,initial())).status).toBe(404)
   for(const field of ['canManage','actorId','releaseEligible','fixtureAdmission'])expect((await call('owner',rootPath,{...initial(),[field]:true})).status).toBe(422)
  })
  await check('tenant swap and member cannot save',async()=>{
   const hidden=await call('outsider'),missing=await call('outsider','/workspace/'+crypto.randomUUID()+'/scope1-beta-setup');expect(hidden.status).toBe(404);expect(await hidden.text()).toBe(await missing.text())
   const memberResponse=await call('member');expect(memberResponse.status).toBe(200);expect((await memberResponse.json() as any).canManage).toBe(false)
   for(const role of ['owner','admin'])expect((await (await call(role)).json() as any).canManage).toBe(true)
   expect((await call('member',rootPath,initial())).status).toBe(403)
   expect((await call('member',rootPath,{...initial(),canManage:true})).status).toBe(403)
   expect((await call('outsider',rootPath,initial())).status).toBe(403)
   for(const table of ['scope1_beta_fixture_admissions','scope1_beta_setup_heads','scope1_beta_setup_versions','scope1_beta_requests','scope1_beta_audit'])expect((await qaAs(runtime!,users.outsider,tx=>tx.query('select * from neuvetra.'+table+' where company_id=$1',[company]))).rows).toHaveLength(0)
  })
  await check('runtime direct table writes denied',async()=>{
   for(const table of ['scope1_beta_release_records','scope1_beta_fixture_admissions','scope1_beta_setup_heads','scope1_beta_setup_versions','scope1_beta_requests','scope1_beta_audit'])for(const statement of ['delete from neuvetra.'+table+' where false','insert into neuvetra.'+table+' default values','truncate neuvetra.'+table])await qaRefuses(qaAs(runtime!,users.owner,tx=>tx.exec(statement)),'42501')
  })
  await check('closed-schema, null-enum and exact-set challenge inputs refused atomically',async()=>{
   const baseline=await qaBaseline(op)
   for(const c of qaInvalidSetups(company,otherCompany)){const r=await call('owner',rootPath,initial(c.input));expect(r.status,c.name+':'+await r.clone().text()).toBe(422)}
   expect(await qaBaseline(op)).toEqual(baseline)
  })
  await check('actual SQL entrypoint refuses validator-bypass inputs and actor forgery',async()=>{
   const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'
   const dbWrite=async(setup:unknown,actor=users.owner,claimedActor=actor,connection=runtime!,mutate?:(req:any,body:any)=>void)=>{
    const req={profile:'m80-scope1-beta-foundation-runtime-v1',idempotencyKey:crypto.randomUUID(),expectedRevision:0,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null}
    const body={profile:'m80-scope1-beta-foundation-runtime-v1',id:crypto.randomUUID(),companyId:company,reportingYear:2025,revision:1,previousVersionId:null,previousVersionSha256:null,fixtureProfileId:'m80-synthetic-scope1-foundation-v1',fixtureVersion:1,fixtureSha256:M80_FIXTURE_SHA256,payloadSha256:qaHash(canonical(setup)),createdBy:claimedActor,createdAt:new Date().toISOString(),dataClassification:'synthetic_rehearsal',completeness:'incomplete',releasedSupportedCount:0}
    mutate?.(req,body)
    return qaAs(connection,actor,tx=>tx.query('select * from neuvetra.save_scope1_beta_setup($1,$2::text::jsonb,$3::text::jsonb,$4::text::jsonb)',[company,JSON.stringify(req),JSON.stringify(setup),JSON.stringify({...body,versionSha256:qaHash(canonical(body))})]))
   }
   const baseline=await qaBaseline(op)
   await runtime!.transaction(async tx=>{const connection={...runtime!,transaction:async(fn:any)=>fn(tx)},result=await dbWrite(qaNormalizedSetup(company),users.owner,users.owner,connection);expect(result.rows).toHaveLength(1);const db=new(HostedWorkspaceDatabase as any)(connection,projectRef,true);expect((await db.findM80Foundation(users.owner,company)).currentVersion.id).toBe((result.rows[0] as any).record_id);throw Error('QA rollback direct positive control')}).catch(e=>{if(e.message!=='QA rollback direct positive control')throw e})
   await runtime!.transaction(async tx=>{const connection={...runtime!,transaction:async(fn:any)=>fn(tx)};let written=false;try{await dbWrite(createM80FixtureSetup(company),users.owner,users.owner,connection);written=true}catch(e){expect((e as any).code).toBe('22023')};if(written){const db=new(HostedWorkspaceDatabase as any)(connection,projectRef,true);expect((await db.findM80Foundation(users.owner,company)).currentVersion.revision).toBe(1)}throw Error('QA rollback unsorted direct input')}).catch(e=>{if(e.message!=='QA rollback unsorted direct input')throw e})
   for(const c of qaInvalidSetups(company,otherCompany))await qaRefuses(dbWrite(c.input))
   await qaRefuses(dbWrite(qaNormalizedSetup(company),users.member),'42501')
   await qaRefuses(dbWrite(qaNormalizedSetup(company),users.outsider),'42501')
   await qaRefuses(dbWrite(qaNormalizedSetup(company),users.owner,users.outsider))
   for(const key of ['profile','fixtureProfileId','fixtureVersion','fixtureSha256','dataClassification','completeness','releasedSupportedCount','reportingYear','revision','createdAt'])await qaRefuses(dbWrite(qaNormalizedSetup(company),users.owner,users.owner,runtime!,(r,b)=>{b[key]=null}))
   for(const key of ['reportingYear','revision','fixtureVersion','releasedSupportedCount'])await qaRefuses(dbWrite(qaNormalizedSetup(company),users.owner,users.owner,runtime!,(r,b)=>{b[key]=String(b[key])}))
   await qaRefuses(dbWrite(qaNormalizedSetup(company),users.owner,users.owner,runtime!,(r,b)=>{r.profile=null}))
   await qaRefuses(dbWrite(qaNormalizedSetup(company),users.owner,users.owner,runtime!,(r,b)=>{b.createdAt=b.createdAt.replace('Z','000Z')}))
   expect(await qaBaseline(op)).toEqual(baseline)
  })
  const request=initial();let current:any,first:any
  await check('owner save, held-only output, exact replay and changed-key-content refusal',async()=>{
   const r=await call('owner',rootPath,request);expect(r.status,await r.clone().text()).toBe(201);const result=await r.json() as any;current=result.foundation;first=structuredClone(current.currentVersion)
   expect(result.replayed).toBe(false);expect(current.eligibility.releasedSupportedCount).toBe(0);expect(current.setup.sources).toHaveLength(14);expect(current.setup.evidenceRequirements).toHaveLength(19)
   const replay=await call('owner',rootPath,request);expect([200,201]).toContain(replay.status);const again=await replay.json() as any;expect(again.replayed).toBe(true);expect(again.foundation.currentVersion).toEqual(first)
   const changed=structuredClone(request);changed.setup.boundaryProposal.jointVentureState='unknown';expect((await call('owner',rootPath,changed)).status).toBe(409)
  })
  await check('two admitted tenants can reuse a key but never each others version',async()=>{
   const otherPath='/workspace/'+otherCompany+'/scope1-beta-setup',otherRequest={...initial(createM80FixtureSetup(otherCompany)),idempotencyKey:request.idempotencyKey},r=await call('outsider',otherPath,otherRequest);expect(r.status).toBe(201);const other=(await r.json() as any).savedVersion
   expect(other.companyId).toBe(otherCompany);expect(other.id).not.toBe(first.id)
   expect((await call('outsider',otherPath+'/versions/'+first.id)).status).toBe(404);expect((await call('owner',rootPath+'/versions/'+other.id)).status).toBe(404)
   const swapped={...initial(createM80FixtureSetup(otherCompany)),expectedRevision:1,expectedVersionId:first.id,expectedVersionSha256:first.versionSha256,correctionReason:'synthetic_fact_correction'};expect((await call('outsider',otherPath,swapped)).status).toBe(409)
  })
  const successor=(setup:unknown)=>({idempotencyKey:crypto.randomUUID(),expectedRevision:current.currentVersion.revision,expectedVersionId:current.currentVersion.id,expectedVersionSha256:current.currentVersion.versionSha256,correctionReason:'synthetic_fact_correction',setup})
  await check('seven legal single-field corrections retain immutable history',async()=>{
   const baseline=createM80FixtureSetup(company);let accumulated=structuredClone(baseline)
   const applyDifference=(base:any,variant:any,target:any)=>{for(const key of Object.keys(variant)){if(variant[key]&&typeof variant[key]==='object')applyDifference(base[key],variant[key],target[key]);else if(variant[key]!==base[key])target[key]=variant[key]}}
   for(const c of qaSuccessorSetups(company)){applyDifference(baseline,c.input,accumulated);const r=await call('admin',rootPath,successor(accumulated));expect(r.status,c.name+':'+await r.clone().text()).toBe(201);current=(await r.json() as any).foundation;expect(current.eligibility.releasedSupportedCount).toBe(0)}
   const old=await call('member',rootPath+'/versions/'+first.id);expect(old.status).toBe(200);expect(await old.json()).toEqual(first)
   expect(current.history).toHaveLength(8)
  })
  await check('stale predecessor, cross-tenant history and concurrent CAS',async()=>{
   const stale={...successor(createM80FixtureSetup(company)),expectedRevision:first.revision,expectedVersionId:first.id,expectedVersionSha256:first.versionSha256};expect((await call('owner',rootPath,stale)).status).toBe(409)
   const privateVersion=await call('outsider',rootPath+'/versions/'+first.id),absentVersion=await call('outsider',rootPath+'/versions/'+crypto.randomUUID());expect(privateVersion.status).toBe(404);expect(await privateVersion.text()).toBe(await absentVersion.text())
   const left=successor(createM80FixtureSetup(company)),right=successor(qaSuccessorSetups(company)[0]!.input),pair=await Promise.all([call('owner',rootPath,left),call('admin',rootPath,right)]);expect(pair.map(r=>r.status).sort()).toEqual([201,409])
  })
  await check('old key replay after a later successor retains original version',async()=>{
   const replay=await call('owner',rootPath,request);expect([200,201]).toContain(replay.status);const result=await replay.json() as any;expect(result.replayed).toBe(true);expect(result.savedVersion).toEqual(first);expect(result.foundation.currentVersion.id).not.toBe(first.id)
  })
  await check('access revocation after successful save denies retained reads and writes',async()=>{
   await op.query('update neuvetra.staging_access set active=false where user_id=$1',[users.owner]);expect((await call('owner')).status).toBe(403);expect((await call('owner',rootPath,request)).status).toBe(403)
   expect((await qaAs(runtime!,users.owner,tx=>tx.query('select * from neuvetra.scope1_beta_setup_versions where company_id=$1',[company]))).rows).toHaveLength(0)
   await qaRefuses(database.saveM80Foundation(users.owner,company,request))
   await op.query('update neuvetra.staging_access set active=true where user_id=$1',[users.owner])
  })
  await check('cached manager state cannot survive role or fixture admission revocation',async()=>{
   expect((await (await call('owner')).json() as any).canManage).toBe(true)
   await op.query("update neuvetra.company_members set role='member' where company_id=$1 and user_id=$2",[company,users.owner])
   expect((await call('owner',rootPath,request)).status).toBe(403);await qaRefuses(database.saveM80Foundation(users.owner,company,request),'42501')
   await op.query("update neuvetra.company_members set role='owner' where company_id=$1 and user_id=$2",[company,users.owner])
   await op.query('update neuvetra.scope1_beta_fixture_admissions set active=false where company_id=$1',[company])
   expect((await call('owner')).status).toBe(404);expect((await call('owner',rootPath+'/versions/'+first.id)).status).toBe(404);expect((await call('owner',rootPath,request)).status).toBe(404)
   await qaRefuses(database.saveM80Foundation(users.owner,company,request))
   await op.query('update neuvetra.scope1_beta_fixture_admissions set active=true where company_id=$1',[company])
  })
  await check('revocation while authentication is pending rejects late authorized identity',async()=>{
   let resume!:(v:any)=>void;const delayed=createM80BetaRoutes({database,origin,validateUser:()=>new Promise(resolve=>{resume=resolve})})
   const pending=delayed(new Request('http://127.0.0.1'+rootPath,{headers:{authorization:'Bearer delayed-owner',origin}}))
   await op.query('update neuvetra.staging_access set active=false where user_id=$1',[users.owner]);resume({id:users.owner,email:null,phone:null,fullName:null});expect((await pending).status).toBe(403)
   await op.query('update neuvetra.staging_access set active=true where user_id=$1',[users.owner])
  })
  const tamperedRead=async(mutate:(tx:any)=>Promise<void>,versionId?:string)=>{
   const before=await qaBaseline(op)
   await op.transaction(async tx=>{
    await mutate(tx);await tx.exec('set local role neuvetra_runtime')
    const wrapped={...runtime!,transaction:async(fn:any)=>fn(tx)},db=new(HostedWorkspaceDatabase as any)(wrapped,projectRef,true)
    const route=createM80BetaRoutes({database:db,origin,validateUser:async()=>({id:users.owner,email:null,phone:null,fullName:null})})
    const response=await route(new Request('http://127.0.0.1'+rootPath+(versionId?'/versions/'+versionId:''),{headers:{authorization:'Bearer fictional-owner',origin}}))
    expect(response.status,'corrupt state must not return a successful foundation').not.toBe(200)
    throw Error('QA rollback corrupt state')
   }).catch(e=>{if(e.message!=='QA rollback corrupt state')throw e})
   expect(await qaBaseline(op)).toEqual(before)
  }
  await check('registry corruption and promotions fail closed through actual adapter/API',async()=>{
   for(const sql of [
    "update neuvetra.scope1_beta_release_records set method_sha256=repeat('0',64) where id='81000000-0000-4000-8000-000000000001'",
    "update neuvetra.scope1_beta_release_records set decision_artifact_sha256=repeat('0',64) where id='81000000-0000-4000-8000-000000000001'",
    "update neuvetra.scope1_beta_release_records set exclusions='[]'::jsonb where id='81000000-0000-4000-8000-000000000001'",
    "update neuvetra.scope1_beta_release_records set status='released',effective_at=clock_timestamp() where id='81000000-0000-4000-8000-000000000001'",
    "update neuvetra.scope1_beta_release_records set status='superseded',superseded_at=clock_timestamp() where id='81000000-0000-4000-8000-000000000001'",
    "delete from neuvetra.scope1_beta_release_records where id='81000000-0000-4000-8000-000000000001'",
   ])await tamperedRead(async tx=>{await tx.exec('alter table neuvetra.scope1_beta_release_records disable trigger scope1_beta_release_immutable');await tx.exec(sql)})
  })
  await check('canonical bytes, coordinated hash forgery and audit gaps fail closed',async()=>{
   await tamperedRead(async tx=>{await tx.exec('alter table neuvetra.scope1_beta_setup_versions disable trigger scope1_beta_version_immutable');await tx.query("update neuvetra.scope1_beta_setup_versions set canonical_payload=canonical_payload||' ' where id=$1",[first.id])})
   await tamperedRead(async tx=>{await tx.exec('alter table neuvetra.scope1_beta_audit disable trigger scope1_beta_audit_immutable');await tx.query('delete from neuvetra.scope1_beta_audit where record_id=$1',[first.id])})
   await tamperedRead(async tx=>{await tx.exec('alter table neuvetra.scope1_beta_audit disable trigger scope1_beta_audit_immutable');await tx.query('delete from neuvetra.scope1_beta_audit where record_id=$1',[first.id])},first.id)
   for(const versionId of [undefined,first.id])await tamperedRead(async tx=>{await tx.exec('alter table neuvetra.scope1_beta_requests disable trigger scope1_beta_request_immutable');await tx.query('delete from neuvetra.scope1_beta_requests where record_id=$1',[first.id])},versionId)
   await tamperedRead(async tx=>{await tx.exec('alter table neuvetra.scope1_beta_requests disable trigger scope1_beta_request_immutable');await tx.query('update neuvetra.scope1_beta_requests set request_sha256=repeat(\'0\',64) where record_id=$1',[first.id])})
   await tamperedRead(async tx=>{
    await tx.exec('alter table neuvetra.scope1_beta_setup_versions disable trigger scope1_beta_version_immutable')
    const row=(await tx.query("update neuvetra.scope1_beta_setup_versions set payload=jsonb_set(payload,'{boundaryProposal,jointVentureState}','\"unknown\"'),canonical_payload=neuvetra.m67_canonical(jsonb_set(payload,'{boundaryProposal,jointVentureState}','\"unknown\"')),payload_sha256=neuvetra.m67_hash(jsonb_set(payload,'{boundaryProposal,jointVentureState}','\"unknown\"')) where id=$1 returning payload_sha256",[first.id])).rows[0]
    const meta={profile:'m80-scope1-beta-foundation-runtime-v1',id:first.id,companyId:company,reportingYear:2025,revision:1,previousVersionId:null,previousVersionSha256:null,fixtureProfileId:'m80-synthetic-scope1-foundation-v1',fixtureVersion:1,fixtureSha256:M80_FIXTURE_SHA256,payloadSha256:row.payload_sha256,createdBy:first.createdBy,createdAt:first.createdAt,dataClassification:'synthetic_rehearsal',completeness:'incomplete',releasedSupportedCount:0}
    await tx.query('update neuvetra.scope1_beta_setup_versions set version_sha256=$1 where id=$2',[qaHash(qaCanonical(meta)),first.id])
   },first.id)
  })
  await check('mounted staging logs omit fixture payloads and rejected canaries',async()=>{const logged=JSON.stringify(logs);expect(logged).not.toContain('FORBIDDEN-SYNTHETIC-CANARY');expect(logged).not.toContain('fixtureReferenceKey');expect(logged).not.toContain('Bearer');expect(logs.length).toBeGreaterThan(50)})
  details.syntheticAuth=true;details.realAuthProviderExercised=false;details.actualHttpSocket=true;details.actualStagingMount=true;details.actualPostgresDriver=true;details.hosted=false;details.customerData=false
 }finally{
  server?.stop(true);await runtime?.close();await op.close()
  await Bun.write(output,JSON.stringify({schema_version:1,reviewer:'/root/m80_foundation_runtime_qa',database:f.name,baseline:f.baseline,createdAt:new Date().toISOString(),checks,details,connectionsClosed:true,serverStopped:true},null,2)+'\n')
 }
},180000)
