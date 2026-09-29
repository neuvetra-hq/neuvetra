import {readFile} from 'node:fs/promises'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {captureApplicationState,check,hash,EXPECTED_NEW_TABLES,EXPECTED_NEW_SEQUENCES} from '../../.superpowers/m80-backup-core'
import {assertM80BackupV2RawSchema22Delta,m80BackupV2NormalizedMetadataSha256} from '../../.superpowers/m80-backup-v2-core'
import {assertM80BackupV2RuntimePrivileges} from '../../.superpowers/m80-backup-v2-rehearsal'
const first=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m80_backup_foundation_1790303149992',{tls:false,maxConnections:1})
const second=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m80_backup_foundation_1790306929913',{tls:false,maxConnections:1})
let evidence:any
try{
 const old=await first.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return captureApplicationState(tx)})
 check(old.contentSha256==='65d68c06c843da60841902a8fe0d3b8c9ff9131d1dc8edaad3a05035545f25c7','PRIOR_ACTUAL_RESTORE_CONTENT_CHANGED')
 check(old.migrationReceipts.length===21&&old.observedNonReceiptTables.length===120,'PRIOR_ACTUAL_RESTORE_SCHEMA_CHANGED')
 const proof=JSON.parse(await readFile('.superpowers/m80-backup-v2-rehearsal-1790306929913/m80-backup-v2-normalization-proof.json','utf8'))
 check(m80BackupV2NormalizedMetadataSha256(old)===proof.sourceNormalizedMetadataSha256,'DIAGNOSIS_TO_REPAIR_NORMALIZED_METADATA_CHANGED')
 await second.transaction(async tx=>{
  await tx.exec('set transaction isolation level repeatable read read only')
  const now=await captureApplicationState(tx)
  await assertM80BackupV2RawSchema22Delta(old,now,tx)
  const names=new Set(old.inventory.tables.map(t=>t.name))
  const preserved=now.inventory.tables.filter(t=>names.has(t.name)&&t.name!=='schema_migrations').map(t=>({name:t.name,count:t.count,rowHashes:t.rowHashes}))
  const oldReceipts=now.migrationReceipts.filter((r:any)=>r.name!=='0022_scope1_beta_foundation.sql')
  check(hash({tables:preserved,migrationReceipts:oldReceipts})===old.contentSha256,'OLD_CONTENT_PROJECTION_CHANGED')
  const tableRows=(await tx.query<any>("select n.name,p.privilege,has_table_privilege('neuvetra_runtime',format('neuvetra.%I',n.name),p.privilege) allowed from unnest($1::text[]) n(name) cross join unnest($2::text[]) p(privilege)",[[...EXPECTED_NEW_TABLES],['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']])).rows
  const sequenceRows=(await tx.query<any>("select n.name,p.privilege,has_sequence_privilege('neuvetra_runtime',format('neuvetra.%I',n.name),p.privilege) allowed from unnest($1::text[]) n(name) cross join unnest($2::text[]) p(privilege)",[[...EXPECTED_NEW_SEQUENCES],['SELECT','USAGE','UPDATE']])).rows
  assertM80BackupV2RuntimePrivileges(tableRows,sequenceRows)
  evidence={readOnly:true,oldNonReceiptTables:old.observedNonReceiptTables.length,currentNonReceiptTables:now.observedNonReceiptTables.length,oldMigrationReceipts:old.migrationReceipts.length,currentMigrationReceipts:now.migrationReceipts.length,oldContentSha256:old.contentSha256,oldContentExact:true,oldMetadataAndTriggerMultiplicityDeltaPass:true,oldDefaultAclRows:old.inventory.defaultAcls.length,currentDefaultAclRows:now.inventory.defaultAcls.length,oldInternalTriggerRows:old.internalTriggers.length,oldDistinctTriggerSemantics:new Set(old.internalTriggers.map(hash)).size,normalizedMetadataMatchesAcceptedDiagnosisAndNewProof:true,runtimeTablePrivilegeCells:tableRows.length,runtimeSequencePrivilegeCells:sequenceRows.length,heldSeedExact:true,forcedRlsAllSix:true,operatorAdmissionEmpty:true}
 })
}finally{await first.close();await second.close()}
await Bun.write('evaluations/research-qa/m80-backup-v2-actual-archive-independent-20260925-native.json',JSON.stringify({...evidence,allConnectionsClosed:true,noArchiveUnseal:true,noRestoreOrMigrationRerun:true,noRuntimeWriteProbeRepeated:true,limits:'Read-only comparison of retained failed schema21 clone to the separately restored schema22 clone corroborates old content/metadata and grants. The original encrypted source comparison is retained independently accepted diagnosis evidence, not repeated here.'})+'\n')
