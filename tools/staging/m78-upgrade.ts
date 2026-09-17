/** Local rehearsal only. Explicit frozen byte gate; no startup or hosted entrypoint. */
import {open} from 'node:fs/promises'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {auditLegacyStagingExposure} from '../../packages/neuvetra-database/src/staging-audit'
import {localSource} from './m78-backup'
import {canonicalReceipts,inventory,content,sameExactInventory,sameUpgradeInventory,sameContent,validateInventory,validateContent,runtimeSafe,lockedTables,check,digest,hash,sha,REVIEWED_MIGRATION_SHA256,PROJECT,PATH_FUNCTIONS,NEW_TABLES,type Inventory,type Content} from './m78-inventory'
export interface LocalUpgradeGate {profile:'neuvetra.m78.local-upgrade-gate.v1';project:string;database:string;createdAt:string;operatorId:string;reviewerId:string;reviewSnapshotSha256:string;migrationSha256:string;baselineBundleSha256:string;restoreReceiptSha256:string;baselineInventory:Inventory;baselineContent:Content;localOnly:true}
export function validateLocalGate(g:LocalUpgradeGate,expectedMigration=REVIEWED_MIGRATION_SHA256,now=Date.now()){
 check(g.profile==='neuvetra.m78.local-upgrade-gate.v1'&&g.localOnly===true&&g.project===PROJECT&&/^m78_(ops|qa)_[a-z0-9_]+$/.test(g.database))
 check(digest(expectedMigration)&&g.migrationSha256===expectedMigration&&[g.reviewSnapshotSha256,g.baselineBundleSha256,g.restoreReceiptSha256].every(digest),'Unreviewed local gate')
 const identity=(s:string)=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=160&&!/[\x00-\x1f\x7f]/.test(s)
 check(identity(g.operatorId)&&identity(g.reviewerId)&&g.operatorId!==g.reviewerId,'Distinct operator/reviewer required')
 const time=Date.parse(g.createdAt);check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(g.createdAt)&&time<=now&&now-time<4*60*60*1000,'Stale gate')
 validateInventory(g.baselineInventory);validateContent(g.baselineContent);check(g.baselineContent.schemaVersion===20&&g.baselineInventory.tables.length===113&&g.baselineInventory.tables.find(t=>t.name==='schema_migrations')?.count===20)
}
export async function verifyNewPrivileges(tx:WorkspaceSql){
 const tables=(await tx.query<{name:string;safe:boolean}>(`select c.relname name,c.relrowsecurity and c.relforcerowsecurity and has_table_privilege('neuvetra_runtime',c.oid,'SELECT') and not has_table_privilege('neuvetra_runtime',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') and not has_any_column_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') safe from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra'and c.relkind='r'and c.relname like 'scope1_%'order by 1`)).rows
 check(tables.length===8&&hash(tables.map(r=>r.name))===hash([...NEW_TABLES])&&tables.every(r=>r.safe),'New table ACL/RLS mismatch')
 const writers=['m78_lock(uuid, boolean)','save_scope1_version(uuid, uuid, text, jsonb, jsonb, jsonb)','review_scope1_version(uuid, uuid, text, jsonb, jsonb)','create_scope1_report(uuid, uuid, text, jsonb, jsonb)']
 const functions=(await tx.query<{signature:string;runtime:boolean;endpoint:boolean}>("select p.proname||'('||oidvectortypes(p.proargtypes)||')'signature,has_function_privilege('neuvetra_runtime',p.oid,'EXECUTE')runtime,has_function_privilege('anon',p.oid,'EXECUTE')or has_function_privilege('authenticated',p.oid,'EXECUTE')endpoint from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra'and(p.proname like 'm78_%'or p.proname in('save_scope1_version','review_scope1_version','create_scope1_report'))")).rows
 check(writers.every(w=>functions.some(f=>f.signature===w))&&functions.every(f=>!f.endpoint&&f.runtime===writers.includes(f.signature)),'Private helper or writer ACL mismatch')
 check((await tx.query<{safe:boolean}>("select not has_sequence_privilege('neuvetra_runtime','neuvetra.scope1_audit_sequence_seq','USAGE,SELECT,UPDATE')and not has_sequence_privilege('anon','neuvetra.scope1_audit_sequence_seq','USAGE,SELECT,UPDATE')and not has_sequence_privilege('authenticated','neuvetra.scope1_audit_sequence_seq','USAGE,SELECT,UPDATE')safe")).rows[0]?.safe,'Sequence access mismatch')
}
async function literalOutputs(tx:WorkspaceSql){const out:Record<string,string>={};for(const signature of PATH_FUNCTIONS.filter(s=>!s.includes('reject_inventory_history_mutation')))out[signature]=(await tx.query<{value:string}>(`select ${signature}::text value`)).rows[0]!.value;return out}
/** Caller owns the transaction. A failed assertion must roll back the entire migration. */
export async function applyReviewed21(tx:WorkspaceSql,gate:LocalUpgradeGate){
 validateLocalGate(gate);const source=await localSource(tx);check(source.name===gate.database,'Different clone')
 await tx.query('select pg_advisory_xact_lock(630010)');await lockedTables(tx)
 const manifest=await canonicalReceipts(tx,20);check(manifest[20]!.sha256===gate.migrationSha256)
 await runtimeSafe(tx);check((await auditLegacyStagingExposure(tx)).legacyContainmentVerified)
 const before=await inventory(tx),beforeContent=await content(tx,20),outputs=await literalOutputs(tx);sameExactInventory(gate.baselineInventory,before);sameContent(gate.baselineContent,beforeContent)
 await tx.exec(manifest[20]!.sql);await tx.query('insert into neuvetra.schema_migrations(name,sha256)values($1,$2)',[manifest[20]!.name,manifest[20]!.sha256])
 await canonicalReceipts(tx,21);await runtimeSafe(tx);await verifyNewPrivileges(tx);check(hash(outputs)===hash(await literalOutputs(tx)),'Literal outputs changed');check((await auditLegacyStagingExposure(tx)).legacyContainmentVerified)
 const after=await inventory(tx),afterContent=await content(tx,21);sameUpgradeInventory(before,after);sameContent(beforeContent,afterContent,true)
 return {before,after,beforeContent,afterContent}
}
export async function upgradeLocal(db:WorkspaceConnection,gate:LocalUpgradeGate,restoreReceipt:unknown,receiptPath:string){
 validateLocalGate(gate);check(sha(JSON.stringify(restoreReceipt))===gate.restoreReceiptSha256,'Restore receipt bytes changed')
 const restored=restoreReceipt as any;check(restored.status==='m78_local_application_restored'&&restored.database===gate.database&&restored.schemaVersion===20&&restored.bundleSha256===gate.baselineBundleSha256&&restored.exactApplicationVerified&&restored.globalRolesUnchanged&&restored.runtimeNoClaimDenied&&restored.runtimeActorRead&&restored.providerRecoveryExcluded)
 sameExactInventory(restored.inventory,gate.baselineInventory);sameContent(restored.content,gate.baselineContent)
 const journal=await open(receiptPath,'wx',0o600);let commitAttempted=false,committed=false
 try{
  await journal.writeFile(JSON.stringify({status:'m78_local_upgrade_started_verify_before_retry',createdAt:new Date().toISOString(),database:gate.database,migrationSha256:gate.migrationSha256,gateSha256:hash(gate)})+'\n');await journal.sync()
  const result=await db.transaction(async tx=>{const result=await applyReviewed21(tx,gate);commitAttempted=true;return result});committed=true
  const receipt={status:'m78_local_migration_committed',createdAt:new Date().toISOString(),database:gate.database,schemaVersion:21,migrationSha256:gate.migrationSha256,gateSha256:hash(gate),oldRowsAndContentPreserved:true,oldCatalogPreservedExceptSixSearchPaths:true,rolesUnchanged:true,...result}
  await journal.writeFile(JSON.stringify(receipt)+'\n');await journal.sync();return receipt
 }catch{
  const status=committed?'m78_local_committed_receipt_failed_do_not_reapply':commitAttempted?'m78_local_commit_unknown_verify_before_retry':'m78_local_upgrade_refused_verify_before_retry'
  try{await journal.writeFile(JSON.stringify({status,database:gate.database})+'\n');await journal.sync()}catch{/* Original durable started record remains the uncertainty evidence. */}
  throw Error(status)
 }finally{await journal.close()}
}
