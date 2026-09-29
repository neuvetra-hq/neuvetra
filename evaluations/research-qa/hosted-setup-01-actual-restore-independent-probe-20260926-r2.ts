/** Independent read-only verification of ONE pinned actual local restore; no bootstrap/restore replay. */
import {readFile,writeFile,access,readdir,realpath} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {createConnection} from 'node:net'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {sha,hash,validateBundle,captureState,assertPreserved,normalizedState,captureRuntimeSnapshotIdentity,type Snapshot} from '../../tools/staging/hosted-setup-restore-core'
import {dpapi} from '../../tools/staging/hosted-setup-restore-io'
import {ROLE_SQL,MEMBERS_SQL} from '../../tools/staging/m73-common'
const root='C:/Users/nimab/Neuvetra/m63-runtime/recovery'
const stem='hosted_setup_roles_1790414845902_b1f2a12a'
const dataDir=join(root,stem),database='hosted_setup_restore_1790414845902_b1f2a12a'
const archiveStem='hosted-setup-20260926T090844493Z-d3471989'
const ctl='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/pg_ctl.exe'
const checks:string[]=[],evidence:any={profile:'neuvetra.hosted-setup.actual-restore-independent.v1',recordedUtc:new Date().toISOString(),pins:{},checks}
function ok(v:unknown,code:string){if(!v)throw Error('QA_'+code);checks.push(code)}
async function pinned(path:string,pin:string){const b=await readFile(path);ok(sha(b)===pin,'PIN_'+path.replaceAll('\\','/').split('/').pop());evidence.pins[path]=sha(b);return b}
async function exists(path:string){try{await access(path);return true}catch{return false}}
async function listening(){return new Promise<boolean>(r=>{const s=createConnection({host:'127.0.0.1',port:55479});const done=(v:boolean)=>{s.destroy();r(v)};s.once('connect',()=>done(true));s.once('error',()=>done(false));s.setTimeout(1000,()=>done(true))})}
async function control(args:string[]){const p=Bun.spawn([ctl,'-D',dataDir,...args],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});return await p.exited}
let plaintext:Buffer|undefined,dump:Buffer|undefined,started=false,db:any,runtime:any
try{
 const paired=JSON.parse(await readFile('evaluations/research-qa/hosted-setup-01-paired-backup-20260926.json','utf8'))
 const observed=JSON.parse(await readFile('evaluations/research-qa/hosted-setup-01-actual-restore-observation-20260926.json','utf8'))
 const refusal=JSON.parse(await readFile('evaluations/research-qa/hosted-setup-01-restore-preflight-refusal-20260926.json','utf8'))
 for(const p of ['evaluations/research-qa/hosted-setup-01-paired-backup-20260926.json','evaluations/research-qa/hosted-setup-01-actual-restore-observation-20260926.json','evaluations/research-qa/hosted-setup-01-restore-preflight-refusal-20260926.json'])evidence.pins[p]=sha(await readFile(p))
 const manifestBytes=await pinned('evaluations/research-qa/hosted-setup-01-restore-author-candidate3-hashes.json','0fbba321381921a097daa4704fd7b47f1fe025c3b4816c2870b7b769abae9934')
 for(const v of JSON.parse(manifestBytes.toString()))await pinned(v.path,v.sha256)
 for(const [p,h] of Object.entries({
 'tools/staging/hosted-setup-hosted-backup.ts':'61c6d43045583c55e513f8a21c86a518fbc0475fcc2fc19d5a45a875854b40ab',
 'tools/staging/hosted-setup-local-roles.ts':'adf320e64c2aaae9182624e73dcab39897f4ec40799e0875d962570ab1e423d2',
 'evaluations/research-qa/hosted-setup-01-restore-independent-candidate3-review.md':'bb00c7bc6e158808acf7a5d1ea1e8b8c9f2f00ef8a2564f476525214e7f98145',
 'evaluations/research-qa/hosted-setup-01-transport-independent-candidate3-review.md':'8499791f5263db31ef6d3253a8d150c614a14778fe9e8235f91316a3a078139c',
 'evaluations/research-qa/hosted-setup-01-restore-independent-review.md':'baa496270a74ac24a9f1941114a0c66de53557bd7705cc55250db062d2acafe1'
 }))await pinned(p,h)
 const archive=await pinned(join(root,archiveStem+'.snapshot.dpapi'),'22280e654a823d3922acfa56ddee1bc9ac0c9c17fa1c29fb672671071c488495')
 const receiptBytes=await pinned(join(root,archiveStem+'.receipt.json'),'60c093af17ec31cfea52b5a1b7689b5adb6dd72d06053b2f59f7c269c8ad0819')
 const receipt=JSON.parse(receiptBytes.toString())
 ok(paired.archiveSha256===sha(archive)&&observed.sourceArchiveSha256===sha(archive)&&paired.receiptSha256===sha(receiptBytes)&&observed.sourceReceiptSha256===sha(receiptBytes),'OBSERVATION_PINS')
 ok(archive.subarray(0,5).toString()!=='PGDMP'&&archive[0]!==123,'ENCRYPTED_OUTER_NOT_PLAIN_DUMP_JSON')
 plaintext=await dpapi('Unprotect',archive)
 ok(sha(plaintext)===receipt.snapshotSha256&&receipt.snapshotSha256===paired.snapshotSha256,'DPAPI_PLAINTEXT_PIN')
 const snapshot=JSON.parse(plaintext.toString()) as Snapshot
 dump=validateBundle(snapshot,receipt);ok(sha(dump)===paired.dumpSha256&&hash(snapshot.state)===paired.stateSha256,'BUNDLE_DUMP_STATE_BOUND')
 const files:any={}; observed.localStopReceiptSha256='aff47e9f382273932d5fdcc4e88434a8df2cc53eaf7087d98f8fcd8d4eec48df' // Independently measured; root authorized continuation after preserved malformed observation.
 for(const [suffix,key] of Object.entries({'.attempt.json':'roleBootstrapJournalSha256','.result.json':'roleBootstrapResultSha256','.restore-attempt.json':'restoreJournalSha256','.restore-result.json':'restoreResultSha256','.stop.json':'localStopReceiptSha256'}))files[suffix]=JSON.parse((await pinned(join(root,stem+suffix),observed[key])).toString())
 const journal=files['.attempt.json'],roles=files['.result.json'],restore=files['.restore-result.json'],stop=files['.stop.json']
 ok(journal.status==='reserved-no-replay'&&roles.sourceSha256===receipt.snapshotSha256&&journal.sourceSha256===receipt.snapshotSha256,'ROLE_SOURCE_CHAIN')
 ok(roles.rolesSha256===hash(snapshot.state.inventory.roles)&&roles.membershipsSha256===hash(snapshot.state.inventory.memberships)&&journal.rolesSha256===roles.rolesSha256&&journal.membershipsSha256===roles.membershipsSha256,'ROLE_METADATA_CHAIN')
 ok(roles.dataDir===dataDir.replaceAll('/','\\')&&observed.localDataDir===roles.dataDir&&observed.localDatabase===database&&restore.database===database,'LOCAL_TARGET_CHAIN')
 ok(files['.restore-attempt.json'].status==='reserved-no-replay'&&files['.restore-attempt.json'].sourceReceiptSha256===sha(receiptBytes)&&restore.sourceReceiptSha256===sha(receiptBytes),'RESTORE_RESERVATION_CHAIN')
 ok(stop.journalSha256===observed.roleBootstrapJournalSha256&&stop.resultSha256===observed.roleBootstrapResultSha256&&stop.confirmedStopped&&stop.stopExitCode===0&&stop.statusExitCode===3&&!stop.portListening&&!stop.replayAllowed,'ROOT_STOP_CHAIN')
 const backupAttempt=JSON.parse(await readFile(join(root,archiveStem+'.snapshot.dpapi.attempt.json'),'utf8'))
 ok(backupAttempt.status==='reserved-no-replay','BACKUP_RESERVATION_RETAINED')
 ok(!await exists(refusal.attemptDataDir)&&!await exists(refusal.attemptDataDir+'.attempt.json')&&refusal.attemptDataDir!==roles.dataDir,'PREFLIGHT_TARGET_NOT_REUSED')
 const old='hosted-setup-20260926T083020471Z-5115b877'
 ok(await exists(join(root,old+'.snapshot.dpapi.attempt.json'))&&!await exists(join(root,old+'.snapshot.dpapi'))&&!await exists(join(root,old+'.receipt.json')),'PRIOR_BACKUP_RESERVATION_ONLY')
 await pinned(ctl,'595303cede56a05eff6e2ec6e6e8bd5531c13832ba09fab57b1a9e93bc945c34')
 ok(resolve(await realpath(dataDir))===resolve(dataDir),'EXACT_REAL_DATADIR')
 ok((await readFile(join(dataDir,'PG_VERSION'),'utf8')).trim()==='17','DATA_PG17')
 ok(await control(['status'])===3&&!await listening(),'INITIAL_CLUSTER_STOPPED_PORT_FREE')
 // Restart only the pre-existing pinned cluster; never call bootstrap or restore.
 started=true
 ok(await control(['-l',join(dataDir,'independent-actual-restore-qa.log'),'-o','-h 127.0.0.1 -p 55479','-w','start'])===0,'EXACT_CLUSTER_STARTED')
 db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55479/'+database,{tls:false,maxConnections:1})
 runtime=createPostgresConnection('postgres://neuvetra_runtime@127.0.0.1:55479/'+database,{tls:false,maxConnections:1})
 const restored=await db.transaction(async(tx:any)=>{
  await tx.exec('set transaction isolation level repeatable read read only')
  const identity=(await tx.query("select current_database() db,current_user actor,current_setting('data_directory') dir,current_setting('server_version_num') version,host(inet_server_addr()) address,inet_server_port() port")).rows[0]
  ok(identity.db===database&&identity.actor==='supabase_admin'&&resolve(identity.dir)===resolve(dataDir)&&identity.version==='170011'&&identity.address==='127.0.0.1'&&identity.port===55479,'READONLY_EXACT_TARGET_IDENTITY')
  ok(hash((await tx.query(ROLE_SQL)).rows)===roles.rolesSha256&&hash((await tx.query(MEMBERS_SQL)).rows)===roles.membershipsSha256,'LIVE_ROLES_MEMBERSHIPS_EXACT')
  ok(Number((await tx.query('select count(*)::int n from pg_authid where rolpassword is not null')).rows[0].n)===0,'NO_ROLE_PASSWORDS')
  const ids=(await tx.query('select id::text id from auth.users order by id')).rows.map((r:any)=>r.id)
  ok(hash(ids)===hash([...snapshot.auth.ids].sort()),'AUTH_UUID_STUBS_EXACT')
  const uid=(await tx.query("select pg_get_functiondef('auth.uid()'::regprocedure) definition")).rows[0].definition
  ok(uid===snapshot.auth.uidDefinition,'AUTH_UID_DEFINITION_EXACT')
  let rowCount=0,zeroTables=0
  for(const table of snapshot.state.inventory.tables){
   const values=(await tx.query('select row_to_json(t)::jsonb::text value from neuvetra.'+table.name+' t')).rows.map((r:any)=>r.value)
   ok(values.length===table.count&&hash([...values].sort())===table.sha256&&hash(values.map(sha).sort())===hash(table.rowHashes),'DIRECT_LOSSLESS_TABLE_'+table.name)
   rowCount+=values.length;if(!values.length)zeroTables++
  }
  evidence.counts={tables:snapshot.state.inventory.tables.length,rows:rowCount,zeroTables,sequences:snapshot.state.inventory.sequences.length,roles:snapshot.state.inventory.roles.length,memberships:snapshot.state.inventory.memberships.length,actors:snapshot.auth.actors.length,authStubs:ids.length}
  const token=(await tx.query('select pg_export_snapshot() token')).rows[0].token
  const source=await captureRuntimeSnapshotIdentity(tx)
  return captureState(tx,snapshot.auth.actors,{connection:runtime,token,tokenSha256:sha(token),source})
 })
 assertPreserved(snapshot.state,restored);ok(true,'FULL_NORMALIZED_PRESERVATION')
 ok(hash(restored)===restore.restoredStateSha256&&hash(restored)===observed.restoredStateSha256,'INDEPENDENT_RECAPTURE_MATCHES_ROOT')
 ok(hash(snapshot.state)===restore.sourceStateSha256&&hash(snapshot.state)===observed.sourceStateSha256,'SOURCE_STATE_CHAIN')
 evidence.sourceStateSha256=hash(snapshot.state);evidence.restoredStateSha256=hash(restored);evidence.normalizedStateSha256=hash(normalizedState(restored))
 evidence.sourceExcludedDefaultAclCount=snapshot.state.inventory.defaultAcls.length-normalizedState(snapshot.state).inventory.defaultAcls.length
 evidence.tenantAccess={observations:restored.tenantAccess.length,sha256:hash(restored.tenantAccess),denied:restored.tenantAccess.filter((x:any)=>x.outcome==='select-privilege-denied').length,rows:restored.tenantAccess.filter((x:any)=>x.outcome==='rows').length}
 evidence.components=Object.fromEntries(['tables','metadata','catalogRowHashes','functions','tableObjects','sequences','roles','memberships','dependencies'].map(k=>[k,hash((restored.inventory as any)[k])]))
 // Negative comparison controls alter in-memory copies only.
 const changed=structuredClone(restored);changed.inventory.tables[0]!.sha256='0'.repeat(64)
 let rejected=false;try{assertPreserved(snapshot.state,changed)}catch{rejected=true};ok(rejected,'IN_MEMORY_ROW_DRIFT_REFUSED')
 const tenantChanged=structuredClone(restored);tenantChanged.tenantAccess.pop()
 rejected=false;try{assertPreserved(snapshot.state,tenantChanged)}catch{rejected=true};ok(rejected,'IN_MEMORY_TENANT_DRIFT_REFUSED')
 evidence.status='bounded-pass'
} catch(e){evidence.status='fail';evidence.error=e instanceof Error&&/^(QA_|HS_RECOVERY_)[A-Za-z0-9_.-]+$/.test(e.message)?e.message:'QA_CHECK_FAILED_REQUIRES_LOCAL_REVIEW'}
finally{
 if(runtime)try{await runtime.close()}catch{evidence.runtimeCloseFailed=true}
 if(db)try{await db.close()}catch{evidence.adminCloseFailed=true}
 if(started){evidence.stopExitCode=await control(['-m','fast','-w','stop']);evidence.statusExitCode=await control(['status']);evidence.portListening=await listening();evidence.clusterDataRetained=await exists(join(dataDir,'PG_VERSION'));if(evidence.stopExitCode!==0||evidence.statusExitCode!==3||evidence.portListening)evidence.status='fail-cleanup'}
 plaintext?.fill(0);dump?.fill(0)
 evidence.hostedAccess=false;evidence.restoreReplayed=false;evidence.providerRecovery=false;evidence.migrationAuthorized=false
 await writeFile('evaluations/research-qa/hosted-setup-01-actual-restore-independent-result-20260926-r2.json',JSON.stringify(evidence,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({status:evidence.status,checks:checks.length,counts:evidence.counts,sourceStateSha256:evidence.sourceStateSha256,restoredStateSha256:evidence.restoredStateSha256,normalizedStateSha256:evidence.normalizedStateSha256,sourceExcludedDefaultAclCount:evidence.sourceExcludedDefaultAclCount,tenantAccess:evidence.tenantAccess,error:evidence.error,stopExitCode:evidence.stopExitCode,statusExitCode:evidence.statusExitCode,portListening:evidence.portListening}))
 if(evidence.status!=='bounded-pass')process.exitCode=1
}


