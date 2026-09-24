import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {auditLegacyStagingExposure} from '../../packages/neuvetra-database/src/staging-audit'
import {canonicalReceipts,inventory,lockedTables,sameRows,requireValue,MIGRATION,runtimeSafe,type Inventory} from './m72-common'
import {hashManifestValue} from './create-source-manifest'
/** Caller must use a transaction; injection permits native offline verification only. */
export async function applyExact15(tx:WorkspaceSql,baseline:Inventory){
  await tx.query('select pg_advisory_xact_lock(630009)')
  await lockedTables(tx)
  const manifest=await canonicalReceipts(tx,14)
  await runtimeSafe(tx)
  requireValue((await auditLegacyStagingExposure(tx)).legacyContainmentVerified)
  const before=await inventory(tx)
  requireValue(hashManifestValue(before)===hashManifestValue(baseline))
  await tx.exec(manifest[14]!.sql)
  await tx.query('insert into neuvetra.schema_migrations(name,sha256) values($1,$2)',[manifest[14]!.name,MIGRATION])
  await canonicalReceipts(tx,15)
  await runtimeSafe(tx)
  const after=await inventory(tx)
  sameRows(before,after,true)
  // No old row may change, including duplicate multiplicity. Only one new migration receipt is expected.
  for(const old of before.tables){const now=after.tables.find(t=>t.name===old.name)!;requireValue(now.count===old.count+(old.name==='schema_migrations'?1:0))}
  requireValue(after.tables.length===before.tables.length+5&&after.tables.filter(t=>t.name.startsWith('corporate_inventory_')).every(t=>t.count===0))
  requireValue(hashManifestValue(before.roles)===hashManifestValue(after.roles)&&hashManifestValue(before.memberships)===hashManifestValue(after.memberships)&&hashManifestValue(before.defaultAcls)===hashManifestValue(after.defaultAcls))
  requireValue((await auditLegacyStagingExposure(tx)).legacyContainmentVerified)
  return {before,after}
}
