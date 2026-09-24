/** Local isolated rehearsal only; no connection or IO on import. */
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/index'
import {createM73Authority} from '../../apps/site-api/src/calculation/m73-authority'
import {createM74Authority} from '../../apps/site-api/src/calculation/m74-authority'
import {createM76DieselAuthority} from '../../apps/site-api/src/calculation/m76-authority'
import {createCorporateInventoryRoutes} from '../../apps/site-api/src/workspace/m71-routes'
import {createM73Routes} from '../../apps/site-api/src/workspace/m73-routes'
import {createM74Routes} from '../../apps/site-api/src/workspace/m74-routes'
import {createM75Routes} from '../../apps/site-api/src/workspace/m75-routes'
import {createM76Routes} from '../../apps/site-api/src/workspace/m76-routes'
import {inventory,canonicalReceipts,exclusiveJson,MIGRATION} from './m76-common'
import {parseRecoveryInput,runHostedRecovery,readRecoveryJournal,validateOriginalRecoveryJournal,RECOVERY_KEYS,recoveryCheck as check} from './m76-hosted-recovery'
import {RECOVERY_COMPANY,recoveryHash as hash} from './m76-hosted-recovery-recipe'
import {m71CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m71-validation'
import {open} from 'node:fs/promises'
const HOST='https://www.neuvetra.ai',AUTH='https://icockcoguyadhryzydvl.supabase.co'
export async function rehearseHostedRecovery(name:string,port=55463){
 check(/^m76_(ops|security)_hosted19_recovery[0-9]+$/.test(name)&&[55463,55472].includes(port))
 const originalText=await Bun.file('.superpowers/m76-hosted-journey.jsonl').text(),original=validateOriginalRecoveryJournal(originalText),response=(n:string)=>original.find(e=>e.kind==='post_outcome'&&e.data.name===n)!.data.response
 const operator=createPostgresConnection(`postgres://${port===55463?'m63_test_admin':'supabase_admin'}@127.0.0.1:${port}/${name}`,{tls:false,maxConnections:1}),source=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m76_security_hosted19_failed1',{tls:false,maxConnections:1})
 let runtime:ReturnType<typeof createPostgresConnection>|undefined,journal:string|null=null,applicationPosts=0,logouts=0,routeDatabase:any,routes:any
 const output='.tmp/m76-hosted-recovery-'+Date.now()+'.jsonl'
 try{
  await canonicalReceipts(operator,19);const sourceBefore=await source.transaction(tx=>inventory(tx)),before=await operator.transaction(tx=>inventory(tx));check(before.tables.length===105)
  const columns=(await operator.query<{table_name:string}>("select table_name from information_schema.columns where table_schema='neuvetra' and column_name='idempotency_key' and table_name like '%requests' order by table_name")).rows;check(columns.length>0&&columns.every(r=>/^[a-z_]+$/.test(r.table_name)))
  const oldKeys=(await operator.query<{key:string}>(columns.map(r=>`select idempotency_key::text key from neuvetra.${r.table_name}`).join(' union all '))).rows.map(r=>r.key);check(Object.values(RECOVERY_KEYS).every(k=>!oldKeys.includes(k)))
  const member=(await operator.query<{user_id:string}>("select user_id from neuvetra.company_members where company_id=$1 and role='member' order by user_id",[RECOVERY_COMPANY])).rows[0];check(member)
  const accountIds=[response('m71_stationary_sources').createdBy,response('m71_stationary_review').reviewerId,member!.user_id,crypto.randomUUID()],accounts=['manager1','manager2','member','outsider'].map((role,i)=>({role,id:accountIds[i],email:role+'@offline.synthetic.invalid',password:'fictional-local-adapter-only'}))
  const authorities={gas:createM73Authority(),diesel:createM76DieselAuthority()},mobile=createM74Authority(),project=(await operator.query<{project_ref:string}>('select project_ref from neuvetra.staging_target')).rows[0]!.project_ref
  const reconnect=async()=>{await runtime?.close();runtime=createPostgresConnection(`postgres://neuvetra_runtime@127.0.0.1:${port}/${name}`,{tls:false,maxConnections:5});routeDatabase=new(HostedWorkspaceDatabase as any)(runtime,project);const deps={database:routeDatabase,origin:HOST,validateUser:async(token:string)=>{const a=accounts.find(a=>token==='offline-'+a.id);return a?{id:a.id} as any:null}};routes={corporate:createCorporateInventoryRoutes(deps),gas:createM73Routes({...deps,authority:authorities.gas}),mobile:createM74Routes({...deps,authority:mobile}),fleet:createM75Routes({...deps,authority:mobile}),stationary:createM76Routes({...deps,authorities})}}
  await reconnect()
  const deps:any={load:async()=>journal,loadOriginal:async()=>originalText,append:async(line:string,exclusive:boolean)=>{check(exclusive===(journal===null));const f=await open(output,exclusive?'wx':'a',0o600);try{await f.writeFile(line);await f.sync()}finally{await f.close()}journal=(journal??'')+line},legacy:async(_input:any,d:any)=>{await d.fetch(HOST+'/ready');await d.save({baseline:original.find(e=>e.kind==='baseline')!.data.legacy});return {status:'passed',applicationPostRequests:0,allCreatedAuthSessionsClosed:true}},fetch:async(url:any,init:RequestInit={})=>{
   const u=String(url);if(u===HOST+'/ready')return Response.json({schemaVersion:Number((await operator.query('select count(*) n from neuvetra.schema_migrations')).rows[0]!.n)},{headers:{'cache-control':'no-store'}})
   if(u.startsWith(AUTH+'/auth/v1/token')){const a=accounts.find(a=>a.email===JSON.parse(init.body as string).email)!;return Response.json({access_token:'offline-'+a.id,user:{id:a.id}})}
   if(u.startsWith(AUTH+'/auth/v1/logout')){logouts++;return new Response(null,{status:204})}
   if(init.method==='POST')applicationPosts++;const request=new Request(u.replace('/workspace-api/','/'),init)
   if(u.includes('/corporate-inventories'))return routes.corporate(request);if(u.includes('/stationary-natural-gas'))return routes.gas(request);if(u.includes('/mobile-diesel'))return routes.mobile(request);if(u.includes('/controlled-fleet'))return routes.fleet(request);if(u.includes('/stationary-diesel')||u.includes('/stationary-equipment'))return routes.stationary(request);throw Error('Local recovery route refused')
  }}
  const input=(mode:string)=>parseRecoveryInput({mode,env:{SUPABASE_URL:AUTH,SUPABASE_ANON_KEY:'sb_publishable_'+'a'.repeat(30)},roster:{workspaceId:RECOVERY_COMPANY},accounts})
  const baseline=await runHostedRecovery(input('baseline'),deps);console.log(JSON.stringify({status:'m76_recovery_rehearsal_baseline',database:name,journal:output,...baseline}));check(baseline.status==='passed'&&applicationPosts===0)
  const exercise=await runHostedRecovery(input('exercise'),deps);console.log(JSON.stringify({status:'m76_recovery_rehearsal_exercise',database:name,journal:output,...exercise}));check(exercise.status==='passed'&&applicationPosts===21)
  await reconnect();const repeated=await runHostedRecovery(input('exercise'),deps);check(repeated.status==='passed'&&repeated.applicationPostRequests===0&&applicationPosts===21)
  const revisit=await runHostedRecovery(input('revisit'),deps);check(revisit.status==='passed'&&revisit.applicationPostRequests===0&&applicationPosts===21&&logouts===16)
  const events=readRecoveryJournal(journal),complete=events.find(e=>e.kind==='recovery_complete')!.data,final=complete.registers.equipment
  const report=(operation:string)=>events.find(e=>e.kind==='step_verified'&&e.data.name===operation)!.data.response
  const blocked=JSON.parse(report('capture_failed_report').snapshotJson),pending=JSON.parse(report('report_pending_equipment').snapshotJson)
  check(blocked.review===null&&blocked.reconciliation.findings.some((f:any)=>f.code==='source_screening_unresolved'))
  check(pending.review===null&&pending.reconciliation.findings.some((f:any)=>f.code==='workpaper_review_required')&&pending.reconciliation.workpaperPins.find((p:any)=>p.family==='stationary_diesel').decision===null)
  check(final.versions.length===5&&final.reports.length===5&&complete.registers.diesel.worksheets[0].versions.length===3&&complete.registers.diesel.worksheets[0].reports.length===3)
  const finalKeys=(await operator.query<{key:string}>(columns.map(r=>`select idempotency_key::text key from neuvetra.${r.table_name}`).join(' union all '))).rows.map(r=>r.key);check(finalKeys.length===oldKeys.length+21&&oldKeys.every(k=>finalKeys.includes(k))&&Object.values(RECOVERY_KEYS).every(k=>finalKeys.filter(v=>v===k).length===1))
  check(canonical(sourceBefore)===canonical(await source.transaction(tx=>inventory(tx)))&&hash(await Bun.file('.superpowers/m76-hosted-journey.jsonl').text())===hash(originalText))
  const result={status:'m76_hosted_recovery_author_rehearsal_passed',createdAt:new Date().toISOString(),database:name,port,migrationHash:MIGRATION,journalPath:output,journalByteSha256:hash(journal!),baseline,exercise,repeated,revisit,applicationPostRequests:21,originalJournalUnchanged:true,failedBaselineUnchanged:true,oldRequestKeysChecked:oldKeys.length,keyMap:RECOVERY_KEYS,equipmentVersions:5,equipmentReports:5,generatorVersions:3,generatorReports:3,blockedAndPendingAbsentReviewsPreserved:true,offlineIdentitySessionsClosed:logouts,identityTransport:'offline_local_adapter',legacyTransport:'offline_local_adapter',applicationTransport:'actual_local_restricted_runtime_routes',runtimeReconnected:true,actualHostedRestart:false,hostedEvidence:false,independentReview:false}
  await exclusiveJson(output+'.result.json',result);return result
 }finally{await runtime?.close();await operator.close();await source.close()}
}
if(import.meta.main){try{const r=await rehearseHostedRecovery(process.argv[2]!,Number(process.argv[3]??55463));console.log(JSON.stringify({status:r.status,journal:r.journalPath}))}catch{console.error(JSON.stringify({status:'m76_recovery_rehearsal_refused'}));process.exitCode=1}}
