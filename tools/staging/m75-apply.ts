import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {auditLegacyStagingExposure} from '../../packages/neuvetra-database/src/staging-audit'
import {canonicalReceipts,inventory,lockedTables,sameRows,sameCatalog,requireValue,MIGRATION,MIGRATION_NAME,NEW_TABLES,runtimeSafe,type Inventory} from './m75-common'
import {recoveryManifest,sameRecovery,type RecoveryManifest} from './m75-recovery-manifest'
import {hashManifestValue} from './create-source-manifest'
/** Caller must use a transaction; injection permits native offline verification only. */
export async function applyExact18(tx:WorkspaceSql,baseline:Inventory,contentBaseline:RecoveryManifest){
  await tx.query('select pg_advisory_xact_lock(630009)')
  await lockedTables(tx)
  const manifest=await canonicalReceipts(tx,17)
  await runtimeSafe(tx)
  requireValue((await auditLegacyStagingExposure(tx)).legacyContainmentVerified)
  const before=await inventory(tx),beforeContent=await recoveryManifest(tx,17)
  sameRecovery(contentBaseline,beforeContent)
  requireValue(hashManifestValue(before)===hashManifestValue(baseline))
  requireValue(/^[a-f0-9]{64}$/.test(MIGRATION)&&manifest.length===18&&manifest[17]?.name===MIGRATION_NAME&&manifest[17]?.sha256===MIGRATION)
  await tx.exec(manifest[17]!.sql)
  await tx.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[manifest[17]!.name,MIGRATION])
  await canonicalReceipts(tx,18)
  await runtimeSafe(tx)
  const after=await inventory(tx)
  const afterContent=await recoveryManifest(tx,18);sameRecovery(beforeContent,afterContent,true)
  sameRows(before,after,true)
  sameCatalog(before,after,true)
  // No old row may change, including duplicate multiplicity. Only one new migration receipt is expected.
  for(const old of before.tables){const now=after.tables.find(t=>t.name===old.name)!;requireValue(now.count===old.count+(old.name==='schema_migrations'?1:0))}
  requireValue(after.tables.length===before.tables.length+NEW_TABLES.length&&NEW_TABLES.every(name=>!before.tables.some(t=>t.name===name)&&after.tables.some(t=>t.name===name&&t.count===0)))
  requireValue(hashManifestValue(before.roles)===hashManifestValue(after.roles)&&hashManifestValue(before.memberships)===hashManifestValue(after.memberships)&&hashManifestValue(before.defaultAcls)===hashManifestValue(after.defaultAcls))
  requireValue((await auditLegacyStagingExposure(tx)).legacyContainmentVerified)
  return {before,after,beforeContent,afterContent}
}
