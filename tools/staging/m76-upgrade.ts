/** Explicit operator entrypoint. Application startup never imports or invokes migrations. */
import {open} from 'node:fs/promises'
import {applyExact19} from './m76-apply'
import {connectOperator,sameRows,sameCatalog,sha,requireValue,PROJECT,MIGRATION,type Inventory} from './m76-common'
import {sameRecovery,type RecoveryManifest} from './m76-recovery-manifest'
import {hashManifestValue} from './create-source-manifest'
export function validateUpgradeGate(gate:any,backup:any,restore:any,recovery:any,forward:any,now=Date.now()){
 const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
 const time=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(v)?Date.parse(v):NaN
 const fresh=(v:unknown,age:number)=>Number.isFinite(time(v))&&time(v)<=now&&now-time(v)<age
 requireValue(gate.status==='m76_independent_operator_gate_passed'&&gate.project===PROJECT&&hash(MIGRATION)&&gate.reviewedMigrationHash===MIGRATION&&/^[a-f0-9]{40}$/.test(gate.reviewedCommit??''))
 requireValue(gate.maintenanceConfirmed===true&&fresh(gate.maintenanceObservedAt,15*60*1000)&&gate.schema19ForwardRecoveryReviewed===true&&gate.providerRecoveryExclusionAccepted===true)
 const identity=(v:unknown)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=160&&!/[\u0000-\u001f\u007f]/.test(v)
 requireValue(identity(gate.operatorId)&&identity(gate.independentReviewerId)&&gate.operatorId!==gate.independentReviewerId)
 requireValue(fresh(gate.createdAt,4*60*60*1000)&&fresh(backup.createdAt,4*60*60*1000)&&fresh(restore.createdAt,4*60*60*1000)&&fresh(recovery.createdAt,4*60*60*1000)&&fresh(forward.createdAt,4*60*60*1000))
 requireValue(time(gate.createdAt)>=time(gate.maintenanceObservedAt)&&time(gate.createdAt)>=time(forward.createdAt))
 requireValue(time(restore.createdAt)>=time(backup.createdAt)&&time(recovery.createdAt)>=time(restore.createdAt)&&time(gate.createdAt)>=time(recovery.createdAt))
 requireValue(backup.status==='m76_encrypted_application_backup'&&restore.status==='m76_exact_application_archive_restored'&&backup.project===PROJECT&&restore.project===PROJECT&&backup.schemaVersion===18&&restore.schemaVersion===18&&restore.port===55472&&restore.sourceBackupCreatedAt===backup.createdAt)
 requireValue(hash(backup.archiveSha256)&&hash(backup.dumpSha256)&&backup.archiveSha256===restore.archiveSha256&&backup.dumpSha256===restore.dumpSha256)
 for(const key of ['applicationRowsAndCatalogExact','runtimeRoleFlagsExact','allRoleFlagsAndMembershipsExact','applicationDefaultAclsExact','runtimeNoClaimDenied','runtimeExistingActorReadPassed','recoveryContentExact'])requireValue(restore[key]===true)
 // Exact receipts must also agree on per-row hashes; legacy sameRows compares table count/digest only.
 for(const value of [backup,restore])requireValue(value.inventory.tables.every((table:any)=>Number.isSafeInteger(table.count)&&table.count>=0&&Array.isArray(table.rowHashes)&&table.rowHashes.length===table.count))
 requireValue(hashManifestValue(backup.inventory.tables)===hashManifestValue(restore.inventory.tables))
 sameRows(backup.inventory,restore.inventory);sameCatalog(backup.inventory,restore.inventory)
 requireValue(backup.inventory.tables.length===90&&backup.inventory.tables.find((t:any)=>t.name==='schema_migrations')?.count===18)
 requireValue(backup.inventory.tables.length===restore.inventory.tables.length&&hashManifestValue(backup.inventory.metadata)===hashManifestValue(restore.inventory.metadata))
 requireValue(hashManifestValue(backup.inventory.roles)===hashManifestValue(restore.inventory.roles)&&hashManifestValue(backup.inventory.memberships)===hashManifestValue(restore.inventory.memberships))
 for(const value of [backup,restore])requireValue(!value.inventory.defaultAcls.some((r:any)=>r.schema==='*'||r.schema==='neuvetra'))
 sameRecovery(backup.recoveryManifest,restore.recoveryManifest)
 requireValue(backup.recoveryManifest.schemaVersion===18)
 // Separate reviewer actually rebuilds the content manifest and exercises restored runtime replay/downloads.
 // This is an attestation gate, not a cryptographic authentication service.
 requireValue(recovery.status==='m76_independent_recovery_passed'&&recovery.project===PROJECT&&recovery.schemaVersion===18&&recovery.port===55472&&recovery.database===restore.database&&recovery.archiveSha256===backup.archiveSha256&&recovery.dumpSha256===backup.dumpSha256&&recovery.restoreReceiptSha256===gate.restoreReceiptSha256&&recovery.reviewerId===gate.independentReviewerId&&recovery.applicationReadsAndDownloadsVerified===true&&recovery.m73CalculationReplayVerified===true&&recovery.m74CalculationReplayVerified===true&&recovery.m75ReconciliationReplayVerified===true&&recovery.legacyDownloadsVerified===true&&recovery.noMutationVerified===true)
 sameRecovery(restore.recoveryManifest,recovery.recoveryManifest)
 requireValue(forward.status==='m76_schema19_forward_recovery_review_passed'&&forward.reviewerId===gate.independentReviewerId&&forward.reviewedMigrationHash===MIGRATION&&forward.schemaVersion===19&&Number.isFinite(time(forward.createdAt))&&time(forward.createdAt)<=now&&forward.populatedStationaryRecoveryVerified===true&&forward.m76CalculationReplayVerified===true&&forward.m76HistoricalProofVerified===true&&forward.m73M74M75AndLegacyPreserved===true&&forward.runtimeReplayAndDownloadsVerified===true&&forward.noMutationVerified===true)
 sameRecovery(forward.sourceContentManifest,forward.restoredContentManifest)
 requireValue(forward.sourceContentManifest.schemaVersion===19)
 for(const [table,part] of [['mobile_diesel_fuel_statements','statement'],['mobile_diesel_mileage_statements','statement'],['mobile_diesel_versions','calculation'],['mobile_diesel_reports','html'],['controlled_fleet_statements','statement'],['controlled_fleet_versions','dependencies'],['controlled_fleet_reports','html'],['controlled_fleet_reports','snapshot'],['stationary_diesel_statements','statement'],['stationary_diesel_versions','calculation'],['stationary_diesel_reports','html'],['stationary_diesel_reports','snapshot'],['stationary_equipment_statements','statement'],['stationary_equipment_versions','dependencies'],['stationary_equipment_reports','html'],['stationary_equipment_reports','snapshot'],['stationary_equipment_reviews','decision']])requireValue(forward.sourceContentManifest.entries.some((e:any)=>e.table===table&&e.part===part))
 requireValue(forward.sourceContentManifest.entries.some((e:any)=>e.table==='stationary_diesel_versions'&&e.part==='calculation'&&e.sha256!==sha('null')&&e.byteLength>4))
 return {inventory:backup.inventory as Inventory,content:backup.recoveryManifest as RecoveryManifest}
}
async function main(){
 let db:Awaited<ReturnType<typeof connectOperator>>|undefined,receipt:Awaited<ReturnType<typeof open>>|undefined,stage='configuration',commitAttempted=false,committed=false
 try{
  const [gatePath,output]=process.argv.slice(2);requireValue(gatePath&&output&&!await Bun.file(output).exists())
  const gateBytes=await Bun.file(gatePath).text(),gate=JSON.parse(gateBytes)
  const artifacts:Record<string,any>={}
  for(const key of ['backup','restore','recovery','forwardRecovery']){const bytes=await Bun.file(gate[key+'Receipt']).text();requireValue(sha(bytes)===gate[key+'ReceiptSha256']);artifacts[key]=JSON.parse(bytes)}
  const baseline=validateUpgradeGate(gate,artifacts.backup,artifacts.restore,artifacts.recovery,artifacts.forwardRecovery)
  const input=JSON.parse(await Bun.stdin.text());requireValue(input.operatorId===gate.operatorId);db=await connectOperator(input.operatorDatabaseUrl)
  stage='reserve_receipt';receipt=await open(output,'wx',0o600)
  await receipt.writeFile(JSON.stringify({status:'m76_upgrade_started_verify_database_before_retry',createdAt:new Date().toISOString(),project:PROJECT,gateSha256:sha(gateBytes),reviewedMigrationHash:MIGRATION})+'\n');await receipt.sync()
  stage='locked_baseline_and_migration'
  const result=await db.transaction(async tx=>{validateUpgradeGate(gate,artifacts.backup,artifacts.restore,artifacts.recovery,artifacts.forwardRecovery);const result=await applyExact19(tx,baseline.inventory,baseline.content);commitAttempted=true;return result})
  committed=true;stage='durable_committed_receipt'
  const bytes=Buffer.from(JSON.stringify({status:'m76_migration_committed',createdAt:new Date().toISOString(),project:PROJECT,beforeVersion:18,schemaVersion:19,reviewedMigrationHash:MIGRATION,reviewedCommit:gate.reviewedCommit,gateSha256:sha(gateBytes),backupArchiveSha256:artifacts.backup.archiveSha256,oldRowsPreserved:true,oldContentBytesPreserved:true,rolesAndMembershipsPreserved:true,...result},null,2)+'\n')
  await receipt.truncate(0);await receipt.write(bytes,0,bytes.length,0);await receipt.sync()
  console.log(JSON.stringify({status:'m76_migration_committed',schemaVersion:19,oldRowsPreserved:true,oldContentBytesPreserved:true}))
 }catch{console.error(JSON.stringify({status:committed?'m76_committed_receipt_failed_do_not_reapply':commitAttempted?'m76_commit_outcome_unknown_verify_database_before_retry':'m76_upgrade_failed_verify_database_before_retry',stage}));process.exitCode=1}finally{await receipt?.close();await db?.close()}
}
if(import.meta.main)await main()
