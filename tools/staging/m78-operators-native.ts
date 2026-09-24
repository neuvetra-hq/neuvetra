/** Explicit independent-gated local rehearsal. Never runs on import. Sources remain read-only. */
import {mkdir,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {m78FixtureAuthorities} from './m78-backend-fixture'
import {M78_REVIEWED_POLICY} from '../../packages/neuvetra-database/src/m78-policy'
import {createLocalBundle} from './m78-backup'
import {restoreLocalBundle,validateBundle} from './m78-restore'
import {applyReviewed21,upgradeLocal,type LocalUpgradeGate} from './m78-upgrade'
import {replayLocalM78} from './m78-replay'
import {check,sha,digest,exclusiveJson,inventory,content,sameExactInventory,sameContent,connectLocal,REVIEWED_MIGRATION_SHA256,PROJECT} from './m78-inventory'
const SOURCES=['m77_ops_failed_state20','m78_author_native_1789620106488'] as const
const OWNED=['inventory','backup','upgrade','restore','replay','operators.test','operators-native'].map(n=>'tools/staging/m78-'+n+'.ts')
const POPULATED_RECEIPT='.superpowers/m78_author_native_1789620106488-result.json'
const POPULATED_RECEIPT_SHA='e2cb73a1a3c80f4b2adb62d564ff8ab9eb02809444a5734794c3f64cb11732ae'
export interface RehearsalAdmission {profile:'neuvetra.m78.local-rehearsal-admission.v1';createdAt:string;reviewerId:string;reviewSnapshotSha256:string;migrationSha256:string;reviewedArtifacts:Array<{path:string;sha256:string}>;localOnly:true}
export async function verifyRehearsalAdmission(g:RehearsalAdmission){
 check(g.profile==='neuvetra.m78.local-rehearsal-admission.v1'&&g.localOnly===true&&digest(REVIEWED_MIGRATION_SHA256)&&g.migrationSha256===REVIEWED_MIGRATION_SHA256&&digest(g.reviewSnapshotSha256)&&g.reviewerId==='/root/m76_backend','Independent rehearsal admission required')
 const time=Date.parse(g.createdAt);check(Number.isFinite(time)&&time<=Date.now()&&Date.now()-time<14400000,'Fresh admission required')
 check(g.reviewedArtifacts.length===OWNED.length&&new Set(g.reviewedArtifacts.map(a=>a.path)).size===OWNED.length)
 for(const path of OWNED){const entry=g.reviewedArtifacts.find(a=>a.path===path);check(entry&&sha(await readFile(path))===entry.sha256,'Operator candidate changed')}
 check(sha(await readFile('packages/neuvetra-database/src/migrations/0021_scope1_inventory.sql'))===g.migrationSha256)
}
export async function rehearseLocalOperators(admission:RehearsalAdmission){
 await verifyRehearsalAdmission(admission)
 const populatedBytes=await readFile(POPULATED_RECEIPT);check(sha(populatedBytes)===POPULATED_RECEIPT_SHA,'Backend populated receipt changed');const fixture=JSON.parse(populatedBytes.toString('utf8'))
 check(fixture.database===SOURCES[1]&&fixture.migrationSha256===REVIEWED_MIGRATION_SHA256&&fixture.users.owner==='7f0c488a-a645-4a9a-97b1-f043e77322a8')
 const suffix=Date.now().toString(),name20='m78_ops_upgrade_'+suffix,name21='m78_ops_recovery_'+suffix,output=resolve('.superpowers/m78-operators-'+suffix),pg='C:/Users/nimab/Neuvetra/m63-runtime/pgsql/bin/'
 await mkdir(output);let stage='read_only_sources',clone:ReturnType<typeof connectLocal>|undefined
 const source20=createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${SOURCES[0]}`,{tls:false,maxConnections:1}),source21=createPostgresConnection(`postgres://supabase_admin@127.0.0.1:55472/${SOURCES[1]}`,{tls:false,maxConnections:1})
 const readInventory=(db:typeof source20)=>db.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return inventory(tx)})
 try{
  const before20=await readInventory(source20),before21=await readInventory(source21)
  const bundle20=await createLocalBundle(source20,pg+'pg_dump.exe',20),bundle21=await createLocalBundle(source21,pg+'pg_dump.exe',21)
  const hash20=sha(JSON.stringify(bundle20)),hash21=sha(JSON.stringify(bundle21));await exclusiveJson(resolve(output,'source-bundles.json'),{schema20:{source:SOURCES[0],bundleSha256:hash20,dumpSha256:bundle20.dumpSha256,inventory:bundle20.inventory,content:bundle20.content},schema21:{source:SOURCES[1],bundleSha256:hash21,dumpSha256:bundle21.dumpSha256,inventory:bundle21.inventory,content:bundle21.content},plaintextArchivesWritten:false})
  stage='negative_dump';const bad=structuredClone(bundle20);bad.dumpBase64=Buffer.from('corrupt dump').toString('base64');let rejected=false;try{validateBundle(bad,sha(JSON.stringify(bad)))}catch{rejected=true}check(rejected,'Corrupt dump admitted')
  stage='restore20';console.log(JSON.stringify({status:'m78_local_rehearsal_progress',stage}));const restored20=await restoreLocalBundle(bundle20,hash20,pg+'pg_restore.exe',name20,resolve(output,'restore20.jsonl'));clone=connectLocal(name20)
  stage='occupied_target_negative';rejected=false;try{await restoreLocalBundle(bundle20,hash20,pg+'pg_restore.exe',name20,resolve(output,'occupied-refusal.jsonl'))}catch{rejected=true}check(rejected,'Occupied target admitted')
  const gate:LocalUpgradeGate={profile:'neuvetra.m78.local-upgrade-gate.v1',localOnly:true,project:PROJECT,database:name20,createdAt:new Date().toISOString(),operatorId:'/root/m78_security',reviewerId:admission.reviewerId,reviewSnapshotSha256:admission.reviewSnapshotSha256,migrationSha256:admission.migrationSha256,baselineBundleSha256:hash20,restoreReceiptSha256:sha(JSON.stringify(restored20)),baselineInventory:restored20.inventory,baselineContent:restored20.content}
  await exclusiveJson(resolve(output,'local-upgrade-gate.json'),gate)
  stage='stale_baseline_negative';const stale=structuredClone(gate);stale.baselineInventory.tables.find(t=>t.name!=='schema_migrations')!.sha256='f'.repeat(64);rejected=false;try{await clone.transaction(tx=>applyReviewed21(tx,stale))}catch{rejected=true}check(rejected,'Stale baseline admitted')
  stage='forced_rollback';rejected=false;try{await clone.transaction(async tx=>{await applyReviewed21(tx,gate);throw Error('Deliberate local transaction rollback')})}catch(e){check(e instanceof Error&&e.message==='Deliberate local transaction rollback','Upgrade failed before forced rollback');rejected=true}check(rejected);sameExactInventory(gate.baselineInventory,await readInventory(clone));sameContent(gate.baselineContent,await clone.transaction(tx=>content(tx,20)))
  stage='upgrade21';console.log(JSON.stringify({status:'m78_local_rehearsal_progress',stage}));const upgraded=await upgradeLocal(clone,gate,restored20,resolve(output,'upgrade21.jsonl'))
  stage='duplicate_upgrade_negative';rejected=false;try{await clone.transaction(tx=>applyReviewed21(tx,gate))}catch{rejected=true}check(rejected,'Duplicate upgrade admitted');sameExactInventory(upgraded.after,await readInventory(clone))
  stage='populated21_restore';console.log(JSON.stringify({status:'m78_local_rehearsal_progress',stage}));const restored21=await restoreLocalBundle(bundle21,hash21,pg+'pg_restore.exe',name21,resolve(output,'restore21.jsonl'))
  stage='populated21_replay';console.log(JSON.stringify({status:'m78_local_rehearsal_progress',stage}));const replay=await replayLocalM78(name21,fixture.companyId,fixture.users.owner,m78FixtureAuthorities(),M78_REVIEWED_POLICY)
  stage='source_preservation';sameExactInventory(before20,await readInventory(source20));sameExactInventory(before21,await readInventory(source21))
  const result={status:'m78_local_operator_rehearsal_passed',createdAt:new Date().toISOString(),migrationSha256:REVIEWED_MIGRATION_SHA256,reviewSnapshotSha256:admission.reviewSnapshotSha256,output,source20:SOURCES[0],source21:SOURCES[1],clone20:name20,clone21:name21,sourceDatabasesUnchanged:true,globalRolesUnchanged:true,forcedRollbackVerified:true,corruptDumpRefused:true,occupiedTargetRefused:true,staleBaselineRefused:true,duplicateUpgradeRefused:true,upgradedInventory:upgraded.after,populatedRestoreContent:restored21.content,replay,encryptedBackupVerified:false,providerRecoveryVerified:false,hostedEvidence:false,independentRecoveryReview:false}
  await exclusiveJson(resolve(output,'result.json'),result);console.log(JSON.stringify({status:result.status,output}));return result
 }catch(e){await exclusiveJson(resolve(output,'failure.json'),{status:'m78_local_operator_rehearsal_failed',createdAt:new Date().toISOString(),stage,output,clone20:name20,clone21:name21,failedClonesRetained:true,sourceWritesAuthorized:false,errorCode:typeof (e as any)?.code==='string'?(e as any).code:null});throw Error('M78 local rehearsal failed at '+stage+'; evidence '+output)}finally{await clone?.close();await source20.close();await source21.close()}
}
if(import.meta.main){try{check(process.argv[2]==='--execute-local-rehearsal'&&process.argv[3]);await rehearseLocalOperators(JSON.parse(await readFile(process.argv[3],'utf8')))}catch(e){console.error(JSON.stringify({status:'m78_local_rehearsal_refused_or_failed',message:e instanceof Error?e.message:'Unknown local failure'}));process.exitCode=1}}
