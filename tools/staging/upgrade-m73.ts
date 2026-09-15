/** Reviewed operator-only exact 0016 transaction. Never called by application startup. */
import {open} from 'node:fs/promises'
import {applyExact16} from './m73-apply'
import {connectOperator,sameRows,sameCatalog,sha,requireValue,PROJECT,MIGRATION} from './m73-common'
import {hashManifestValue} from './create-source-manifest'
let db:Awaited<ReturnType<typeof connectOperator>>|undefined,receipt:Awaited<ReturnType<typeof open>>|undefined,stage='configuration',commitAttempted=false,committed=false
try{
 const [gatePath,output]=process.argv.slice(2);requireValue(gatePath&&output&&!await Bun.file(output).exists())
 const gateBytes=await Bun.file(gatePath).text(),gate=JSON.parse(gateBytes)
 requireValue(gate.status==='m73_independent_operator_gate_passed'&&gate.project===PROJECT&&gate.reviewedMigrationHash===MIGRATION&&/^[a-f0-9]{64}$/.test(MIGRATION)&&/^[a-f0-9]{40}$/.test(gate.reviewedCommit??'')&&gate.maintenanceConfirmed===true&&gate.schema16ForwardRecoveryReviewed===true&&gate.providerRecoveryExclusionAccepted===true)
 const backupBytes=await Bun.file(gate.backupReceipt).text(),restoreBytes=await Bun.file(gate.restoreReceipt).text()
 requireValue(sha(backupBytes)===gate.backupReceiptSha256&&sha(restoreBytes)===gate.restoreReceiptSha256)
 const backup=JSON.parse(backupBytes),restore=JSON.parse(restoreBytes)
 requireValue(restore.allRoleFlagsAndMembershipsExact===true&&restore.applicationDefaultAclsExact===true&&restore.runtimeNoClaimDenied===true&&restore.runtimeExistingActorReadPassed===true)
 requireValue(backup.schemaVersion===15&&restore.schemaVersion===15&&restore.port===55472&&backup.status==='m73_encrypted_application_backup'&&restore.status==='m73_exact_application_archive_restored'&&backup.project===PROJECT&&restore.project===PROJECT&&backup.archiveSha256===restore.archiveSha256&&backup.dumpSha256===restore.dumpSha256&&restore.applicationRowsAndCatalogExact===true&&restore.runtimeRoleFlagsExact===true)
 requireValue(/^[a-f0-9]{64}$/.test(backup.archiveSha256??'')&&/^[a-f0-9]{64}$/.test(backup.dumpSha256??''))
 requireValue(hashManifestValue(backup.inventory.roles)===hashManifestValue(restore.inventory.roles)&&hashManifestValue(backup.inventory.memberships)===hashManifestValue(restore.inventory.memberships))
 requireValue(!backup.inventory.defaultAcls.some((r:any)=>r.schema==='*'||r.schema==='neuvetra')&&!restore.inventory.defaultAcls.some((r:any)=>r.schema==='*'||r.schema==='neuvetra'))
 const age=Date.now()-Date.parse(backup.createdAt);requireValue(Number.isFinite(age)&&age>=0&&age<4*60*60*1000)
 sameRows(backup.inventory,restore.inventory);sameCatalog(backup.inventory,restore.inventory);requireValue(backup.inventory.tables.length===restore.inventory.tables.length);requireValue(hashManifestValue(backup.inventory.metadata)===hashManifestValue(restore.inventory.metadata))
 const input=JSON.parse(await Bun.stdin.text());db=await connectOperator(input.operatorDatabaseUrl)
 stage='reserve_receipt';receipt=await open(output,'wx',0o600)
 await receipt.writeFile(JSON.stringify({status:'m73_upgrade_started_verify_database_before_retry',createdAt:new Date().toISOString(),project:PROJECT,gateSha256:sha(gateBytes),reviewedMigrationHash:MIGRATION})+'\n');await receipt.sync()
 stage='locked_baseline_and_migration'
 const result=await db.transaction(async tx=>{const result=await applyExact16(tx,backup.inventory);commitAttempted=true;return result})
 committed=true;stage='durable_committed_receipt'
 const bytes=Buffer.from(JSON.stringify({status:'m73_migration_committed',createdAt:new Date().toISOString(),project:PROJECT,beforeVersion:15,schemaVersion:16,reviewedMigrationHash:MIGRATION,reviewedCommit:gate.reviewedCommit,gateSha256:sha(gateBytes),backupArchiveSha256:backup.archiveSha256,oldRowsPreserved:true,rolesAndMembershipsPreserved:true,...result},null,2)+'\n')
 await receipt.truncate(0);await receipt.write(bytes,0,bytes.length,0);await receipt.sync()
 console.log(JSON.stringify({status:'m73_migration_committed',schemaVersion:16,oldRowsPreserved:true}))
}catch{console.error(JSON.stringify({status:committed?'m73_committed_receipt_failed_do_not_reapply':commitAttempted?'m73_commit_outcome_unknown_verify_database_before_retry':'m73_upgrade_failed_verify_database_before_retry',stage}));process.exitCode=1}finally{await receipt?.close();await db?.close()}
