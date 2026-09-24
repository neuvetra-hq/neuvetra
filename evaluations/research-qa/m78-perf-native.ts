/** Explicit new local clones only. No host credentials or release-journal access. */
import {createPostgresConnection,HostedWorkspaceDatabase,readMigrationManifest,type WorkspaceConnection} from '../../packages/neuvetra-database/src/index'
import {m78FixtureAuthorities,m78BaselineDigests} from '../../tools/staging/m78-backend-fixture'
import {createM78Routes} from '../../apps/site-api/src/workspace/m78-routes'
import {M78_REVIEWED_POLICY} from '../../packages/neuvetra-database/src/m78-policy'
import {M78_PERIOD,M78_LIMITATIONS} from '../../packages/neuvetra-database/src/m78-contract'
import {decodeScope1Version,decodeScope1Report} from '../../apps/site-web/src/lib/m78-api'
import {m78CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m78-validation'
const company='8b90c706-1710-494d-b12d-02eef88eacb7',project='icockcoguyadhryzydvl',a=m78FixtureAuthorities(),policy=M78_REVIEWED_POLICY;
const check=(v:unknown,m:string)=>{if(!v)throw Error(m)},same=(x:unknown,y:unknown)=>canonical(x)===canonical(y);
const mode=process.argv[2],history=process.argv[3];check(['before','after'].includes(mode!)&&['initial','late','guards'].includes(history!),'Explicit benchmark/guard mode required');
const name='m78_author_perf_'+mode+'_'+history+'_'+Date.now(),template=history==='late'?'m78_ops_recipe_20260922b':'m78_ops_actual20_20260922';
const admin=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/postgres',{tls:false,maxConnections:1});let op:WorkspaceConnection|undefined,runtime:WorkspaceConnection|undefined,other:WorkspaceConnection|undefined;
const metrics:any[]=[];let active:any=null,barrier:(()=>Promise<void>)|null=null,corruptPost=false,writeSeen=false;
try{
 check(!(await admin.query('select 1 from pg_database where datname=$1',[name])).rows.length,'Occupied clone refused');await admin.exec(`create database ${name} template ${template}`);
 op=createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${name}`,{tls:false,maxConnections:1});
 const manifest=await readMigrationManifest(),receipts=(await op.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows;
 check(same(receipts,manifest.slice(0,receipts.length).map(({name,sha256})=>({name,sha256})))&&[20,21].includes(receipts.length),'Exact source receipts');
 if(receipts.length===20)await op.transaction(async tx=>{await tx.exec(await Bun.file('packages/neuvetra-database/src/migrations/0021_scope1_inventory.sql').text());await tx.query('insert into neuvetra.schema_migrations(name,sha256)values($1,$2)',[manifest[20]!.name,manifest[20]!.sha256])});
 runtime=createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55472/${name}`,{tls:false,maxConnections:2});
 const wrap=(tx:any)=>({...tx,query:async(sql:string,values?:unknown[])=>{
  const state=sql.includes('from neuvetra.scope1_heads x'),upstream=sql.includes('jsonb_agg(h) from neuvetra.corporate_inventory_heads');
  if(active){active.sqlQueries++;if(state)active.stateReads++;if(upstream)active.corporateReads++;}
  if(state&&barrier){const wait=barrier;barrier=null;await wait()}
  const start=performance.now(),result=await tx.query(sql,values);if(active)active.sqlMs+=performance.now()-start;
  if(/^select neuvetra\.(save_scope1_version|review_scope1_version|create_scope1_report)/.test(sql)){writeSeen=true;if(active)active.nativeWriterMs+=performance.now()-start}
  if(state&&writeSeen&&corruptPost&&result.rows[0]?.versions?.length){result.rows[0].versions[0].payload.contentSha256='0'.repeat(64);corruptPost=false;}
  return result;
 }});
 const instrumented={...runtime,transaction:(fn:any)=>runtime!.transaction(tx=>fn(wrap(tx)))} as WorkspaceConnection;
 const db=new(HostedWorkspaceDatabase as any)(instrumented,project)as HostedWorkspaceDatabase;
 const owner=(await op.query<{created_by:string}>('select created_by from neuvetra.corporate_inventory_versions where company_id=$1 order by version limit 1',[company])).rows[0]!.created_by;
 const members=(await op.query<{user_id:string;role:string}>('select user_id,role from neuvetra.company_members where company_id=$1',[company])).rows;
 let register=(await db.findScope1(owner,company,a,policy))!;const reviewer=members.find(m=>m.role!=='member'&&!register.coverageVersion.contributorIds.includes(m.user_id))!.user_id;
 const routes=createM78Routes({database:db,authorities:a,policy,origin:'http://localhost:47901',validateUser:async t=>({id:t==='reviewer'?reviewer:owner,phone:null,email:null,fullName:null})});
 const inventoryInput=(r:any,tag:string)=>{const v=r.inventory.versions.at(-1),item=r.coverageVersion.snapshot.coverageItems.find((x:any)=>x.domain==='process'&&x.entityId===null&&x.sourceId===null);return {profile:'synthetic-scope1-inventory-v1' as const,binding:{coverageVersionId:r.coverageVersion.id,coverageVersionSha256:r.coverageVersion.versionSha256,processCoverageItemId:item.id,period:M78_PERIOD},note:'Fictional performance fixture '+tag,expectedVersionId:v?.id??null,expectedVersionSha256:v?.versionSha256??null,expectedDependencySha256:r.dependencies.dependencySha256,correctionReason:v?'Fictional performance-only note correction; all source and control facts retained.':null,idempotencyKey:crypto.randomUUID()}};
 const routePost=async(path:string,input:unknown,role='owner')=>{
  const row={operation:path,sqlQueries:0,stateReads:0,corporateReads:0,sqlMs:0,nativeWriterMs:0,responseMs:0,responseBytes:0,status:0};active=row;writeSeen=false;const start=performance.now();
  try{const response=await routes(new Request('http://localhost:47902/workspace/'+company+'/'+path,{method:'POST',headers:{origin:'http://localhost:47901',authorization:'Bearer '+role,'content-type':'application/json'},body:JSON.stringify(input)}));const text=await response.text();row.responseMs=performance.now()-start;row.responseBytes=Buffer.byteLength(text);row.status=response.status;return {status:response.status,body:JSON.parse(text)}}finally{active=null;metrics.push(row)}
 };
 const initial=inventoryInput(register,'first'),initialPath=register.inventory.streamId?'scope1-inventory/'+register.inventory.streamId+'/versions':'scope1-inventory';
 const before=await m78BaselineDigests(op);
 if(history!=='guards'){
  const saved=await routePost(initialPath,initial);check(saved.status===201,'Inventory save failed: '+JSON.stringify(saved));const v=(await decodeScope1Version(saved.body,company)).version;
  const report={versionId:v.id,expectedVersionSha256:v.versionSha256,expectedDecisionId:null,expectedDecisionSha256:null,expectedReconciliationSha256:v.reconciliation?.contentSha256??null,idempotencyKey:crypto.randomUUID()};
  const reported=await routePost('scope1-inventory/'+v.streamId+'/reports',report);check(reported.status===201,'Report save failed');const retained=await decodeScope1Report(reported.body,company);
  const reviewed=await routePost('scope1-inventory/'+v.streamId+'/reviews',{versionId:v.id,expectedVersionSha256:v.versionSha256,expectedDependencySha256:v.dependencies.dependencySha256,decision:'changes_requested',note:'Independent fictional performance fixture review; no released-method claim.',acknowledgedLimitations:[...M78_LIMITATIONS],idempotencyKey:crypto.randomUUID()},'reviewer');check(reviewed.status===201,'Review failed');
  const reread=await db.findScope1Report(owner,company,v.streamId,retained.id,a,policy);check(same(reread,retained)&&JSON.parse(retained.snapshotJson).review===null,'Captured review changed');
  if(mode==='after')for(const m of metrics)check(m.stateReads===2&&m.corporateReads===10,'Expected one upstream build, two full M78 state reads');
 }else{
  // Force post-write data verification to fail in the transaction, without changing stored rows directly.
  corruptPost=true;const failed=await routePost(initialPath,initial);check(failed.status===503,'Post-write corruption did not fail closed');check(same(before,await m78BaselineDigests(op)),'Post-write failure did not roll back');
  other=createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:55472/${name}`,{tls:false,maxConnections:1});
  const second=new(HostedWorkspaceDatabase as any)(other,project)as HostedWorkspaceDatabase;
  // Pause after upstream capture: competing supported writer lock paths must conflict on the same company.
  let captured!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>captured=r),held=new Promise<void>(r=>release=r);
  barrier=async()=>{captured();await held};const first=routePost(initialPath,{...initial,idempotencyKey:crypto.randomUUID()});await entered;
  const locks=[];for(const call of ['m73_lock','m75_lock','m76_lock','m77_lock']){
   let code:string|null=null;try{await other.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);await tx.exec("set local lock_timeout='100ms'");await tx.query(`select neuvetra.${call}($1,true)`,[company])})}catch(e){code=(e as any).code}check(code==='55P03','Competing writer did not wait: '+call);locks.push({call,code});
  }
  // Actual corporate writer executes its own lock path and must time out before altering the graph.
  let corporateCode:string|null=null;try{await other.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);await tx.exec("set local lock_timeout='100ms'");await tx.query('select neuvetra.save_corporate_inventory($1,$2,$3::jsonb)',[company,register.coverageVersion.inventoryId,JSON.stringify({snapshot:register.coverageVersion.snapshot,expectedVersionId:register.coverageVersion.id,expectedVersionSha256:register.coverageVersion.versionSha256,correctionReason:'Fictional race attempt',idempotencyKey:crypto.randomUUID()})])})}catch(e){corporateCode=(e as any).code}check(corporateCode==='55P03','Corporate writer escaped lock');
  // A second valid initial writer waits on the first, then must conflict instead of duplicating the stream.
  const competing=second.saveScope1Inventory(owner,company,null,{...initial,idempotencyKey:crypto.randomUUID()},a,policy).then(()=>({code:'unexpected_success'}),e=>({code:e.code}));
  release();const saved=await first;check(saved.status===201,'First racing writer failed');check((await competing).code==='23505','Second initial writer did not conflict');
  const v=saved.body.version;const replayInput={...initial,idempotencyKey:crypto.randomUUID()};
  // Fresh successor idempotency case, never reuse any hosted key.
  register=(await db.findScope1(owner,company,a,policy))!;const correction=inventoryInput(register,'idempotent');const one=await routePost('scope1-inventory/'+v.streamId+'/versions',correction),two=await routePost('scope1-inventory/'+v.streamId+'/versions',correction);check(one.status===201&&two.status===201&&same(one.body,two.body),'Exact idempotent replay failed');
  const counts=(await op.query<any>('select (select count(*)::int from neuvetra.scope1_requests where idempotency_key=$1)requests,(select count(*)::int from neuvetra.scope1_audit where record_id=$2)audits,(select count(*)::int from neuvetra.scope1_versions where id=$2)versions',[correction.idempotencyKey,one.body.version.id])).rows[0];check(same(counts,{requests:1,audits:1,versions:1}),'Idempotency appended duplicate records');
  const wrong=await routePost('process-screen/'+v.streamId+'/versions',correction);check(wrong.status===422,'Malformed inventory payload on process route denial ordering');
  let wrongStream=false;try{await db.saveScope1Inventory(owner,company,crypto.randomUUID(),correction,a,policy)}catch(e){wrongStream=(e as any).code==='M78_STREAM_NOT_FOUND'}check(wrongStream,'Direct writer stream admission missing');
  metrics.push({guards:'passed',postWriteRollback:true,competingLocks:locks,corporateCode,secondInitialConflict:true,idempotency:counts,wrongStream:true});
 }
 const after=await m78BaselineDigests(op);const untouched=before.filter(r=>!r.table.startsWith('neuvetra.scope1_'));check(same(untouched,after.filter(r=>!r.table.startsWith('neuvetra.scope1_'))),'Upstream/other tenant rows changed');
 console.log(JSON.stringify({status:'m78_perf_native_passed',mode,history,database:name,template,metrics,unchangedNonM78Tables:untouched.length,hostCalls:0}));
}catch(e){console.log(JSON.stringify({status:'m78_perf_native_failed',mode,history,database:name,metrics,error:(e as Error).message,code:(e as any).code}));process.exitCode=1}finally{await other?.close();await runtime?.close();await op?.close();await admin.close()}
