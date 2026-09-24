/** M75 operator-only controls. Imports never connect or migrate. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {hashManifestValue} from './create-source-manifest'
import {PROJECT} from './m73-common'
import {sameRows as oldSameRows,type Inventory} from './m73-common'
export {PROJECT,sha,exclusiveJson,operatorUrl,connectOperator,inventory,runtimeSafe,sameCatalog,lockedTables,ROLE_SQL,MEMBERS_SQL,DEFAULT_SQL,type Inventory} from './m73-common'
export const BASELINE_MANIFEST_SHA256='d1f2674005b4be8f165313ea3669ad269570a053b4a6b400b9b0998a08fa393c'
// Independent SQL-reviewed candidate; final operator/native and hosted gates remain separate.
export const MIGRATION='76c8a17a46d96b40ed98213ceb3cf79caf564c5a639583197bd0adaf1c8a98f3'
export const MIGRATION_NAME='0018_controlled_fleet.sql'
export const NEW_TABLES=['controlled_fleet_audit','controlled_fleet_heads','controlled_fleet_reports','controlled_fleet_requests','controlled_fleet_reviews','controlled_fleet_statements','controlled_fleet_versions'] as const
export function requireValue(value:unknown,message='M75 gate refused'):asserts value {if(!value)throw Error(message)}
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
export function localName(name:string,port:number){requireValue(/^m75_(ops|qa|security)_[a-z0-9_]+$/.test(name)&&[55463,55472].includes(port))}
export function connectLocal(name:string,port=55463){localName(name,port);return createPostgresConnection(`postgres://${port===55472?'supabase_admin':'m63_test_admin'}@127.0.0.1:${port}/`+name,{maxConnections:1,tls:false})}
export async function canonicalReceipts(tx:WorkspaceSql,version:17|18){
 const manifest=await readMigrationManifest()
 requireValue([17,18].includes(manifest.length)&&hashManifestValue(manifest.slice(0,17).map(({name,sha256})=>({name,sha256})))===BASELINE_MANIFEST_SHA256)
 if(version===18)requireValue(/^[a-f0-9]{64}$/.test(MIGRATION)&&manifest.length===18&&manifest[17]?.name===MIGRATION_NAME&&manifest[17]?.sha256===MIGRATION)
 const receipts=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
 requireValue(receipts.length===version&&receipts.every((r,i)=>r.name===manifest[i]?.name&&r.sha256===manifest[i]?.sha256))
 const target=(await tx.query<{project_ref:string;profile:string}>('select project_ref,profile from neuvetra.staging_target')).rows
 requireValue(target.length===1&&target[0]?.project_ref===PROJECT&&target[0]?.profile==='neuvetra.private-synthetic-staging.v1')
 return manifest
}
