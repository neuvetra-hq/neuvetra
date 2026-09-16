/** M76 operator-only controls. Imports never connect or migrate. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {hashManifestValue} from './create-source-manifest'
import {PROJECT} from './m73-common'
import {sameRows as oldSameRows,type Inventory} from './m73-common'
import {sameCatalog as oldSameCatalog} from './m73-common'
export {PROJECT,sha,exclusiveJson,operatorUrl,connectOperator,inventory,runtimeSafe,sameCatalog,lockedTables,ROLE_SQL,MEMBERS_SQL,DEFAULT_SQL,type Inventory} from './m73-common'
export const BASELINE_MANIFEST_SHA256='e6c6b9d2e89b8b21402ca510dd7c2c1157eddb68890b4d6a1cc12247ba626f9d'
// Author-reviewed candidate; final independent SQL/native and hosted gates remain separate.
export const MIGRATION='ed08001bb2df201133734d1db36b2739046ac0af82e45d8054dcf8f9ad5485f8'
export const MIGRATION_NAME='0019_stationary_sources.sql'
export const NEW_TABLES=['stationary_diesel_audit','stationary_diesel_evidence_reservations','stationary_diesel_heads','stationary_diesel_reports','stationary_diesel_requests','stationary_diesel_reviews','stationary_diesel_statements','stationary_diesel_versions','stationary_equipment_audit','stationary_equipment_heads','stationary_equipment_reports','stationary_equipment_requests','stationary_equipment_reviews','stationary_equipment_statements','stationary_equipment_versions'] as const
export const MOBILE_FUEL_GUARD={table_name:'mobile_diesel_evidence_reservations',tgname:'m76_mobile_fuel_evidence_guard',definition:'CREATE TRIGGER m76_mobile_fuel_evidence_guard BEFORE INSERT ON neuvetra.mobile_diesel_evidence_reservations FOR EACH ROW EXECUTE FUNCTION neuvetra.m76_mobile_fuel_evidence_guard()',tgenabled:'O'} as const
export const TRIGGER_ROWS_SQL="select c.relname table_name,t.tgname,pg_get_triggerdef(t.oid) definition,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and not t.tgisinternal order by 1,2"
/** Preserve every original trigger, admitting only the exact reviewed old-table addition. */
export function sameMigrationCatalog(before:Inventory,after:Inventory,triggers:Array<{table_name:string;tgname:string;definition:string;tgenabled:string}>){
 oldSameCatalog(before,after,true)
 const oldTables=new Set(before.tables.map(t=>t.name)),actual=triggers.filter(t=>oldTables.has(t.table_name)).map(hashManifestValue).sort()
 const expected=[...(before.catalogRowHashes.triggers??[]),hashManifestValue(MOBILE_FUEL_GUARD)].sort()
 requireValue(hashManifestValue(actual)===hashManifestValue(expected),'Old-table triggers differ from exact M76 addition')
}
export function requireValue(value:unknown,message='M76 gate refused'):asserts value {if(!value)throw Error(message)}
export function validateInventory(value:Inventory){
 const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
 requireValue(value&&Array.isArray(value.tables)&&value.tables.length>0)
 requireValue(value.tables.every(t=>t&&typeof t.name==='string'&&/^[a-z_]+$/.test(t.name)&&hash(t.sha256)&&Number.isSafeInteger(t.count)&&t.count>=0&&Array.isArray(t.rowHashes)&&t.rowHashes.length===t.count&&t.rowHashes.every(hash)&&JSON.stringify(t.rowHashes)===JSON.stringify([...t.rowHashes].sort())))
 requireValue(new Set(value.tables.map(t=>t.name)).size===value.tables.length)
 requireValue(value.metadata&&value.catalogRowHashes&&Object.keys(value.metadata).length>0&&hashManifestValue(Object.keys(value.metadata).sort())===hashManifestValue(Object.keys(value.catalogRowHashes).sort()))
 requireValue(Object.values(value.metadata).every(hash)&&Object.values(value.catalogRowHashes).every(v=>Array.isArray(v)&&v.every(hash)))
 for(const key of ['roles','memberships','defaultAcls','dependencies'] as const)requireValue(Array.isArray(value[key]))
}
export function sameRows(before:Inventory,after:Inventory,allowAppend=false){
 validateInventory(before);validateInventory(after);oldSameRows(before,after,allowAppend)
 if(!allowAppend)requireValue(hashManifestValue(before.tables)===hashManifestValue(after.tables),'Exact per-row inventory differs')
}
export function localName(name:string,port:number){requireValue(/^m76_(ops|qa|security)_[a-z0-9_]+$/.test(name)&&[55463,55472].includes(port))}
export function connectLocal(name:string,port=55463){localName(name,port);return createPostgresConnection(`postgres://${port===55472?'supabase_admin':'m63_test_admin'}@127.0.0.1:${port}/`+name,{maxConnections:1,tls:false})}
export async function canonicalReceipts(tx:WorkspaceSql,version:18|19){
 const manifest=await readMigrationManifest()
 requireValue([18,19].includes(manifest.length)&&hashManifestValue(manifest.slice(0,18).map(({name,sha256})=>({name,sha256})))===BASELINE_MANIFEST_SHA256)
 if(version===19)requireValue(/^[a-f0-9]{64}$/.test(MIGRATION)&&manifest.length===19&&manifest[18]?.name===MIGRATION_NAME&&manifest[18]?.sha256===MIGRATION)
 const receipts=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
 requireValue(receipts.length===version&&receipts.every((r,i)=>r.name===manifest[i]?.name&&r.sha256===manifest[i]?.sha256))
 const target=(await tx.query<{project_ref:string;profile:string}>('select project_ref,profile from neuvetra.staging_target')).rows
 requireValue(target.length===1&&target[0]?.project_ref===PROJECT&&target[0]?.profile==='neuvetra.private-synthetic-staging.v1')
 return manifest
}
