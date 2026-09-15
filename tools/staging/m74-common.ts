/** M74 operator-only controls. Imports never connect or migrate. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {hashManifestValue} from './create-source-manifest'
import {PROJECT} from './m73-common'
export {PROJECT,sha,exclusiveJson,operatorUrl,connectOperator,inventory,runtimeSafe,sameRows,sameCatalog,lockedTables,ROLE_SQL,MEMBERS_SQL,DEFAULT_SQL,type Inventory} from './m73-common'
export const BASELINE_MANIFEST_SHA256='baecb8858475cdf1d57b38af4539b5f5ad97a973223ce17284125af214d85e86'
// Coordinator candidate1 author pin; independent exact-byte review and hosted gate remain separate.
export const MIGRATION='4486f83e2f2f6e5cb8db5991575a74f540b891eefd1ff65317801545c5b6c071'
export const MIGRATION_NAME='0017_mobile_diesel.sql'
export const NEW_TABLES=['mobile_diesel_audit','mobile_diesel_evidence_reservations','mobile_diesel_fuel_statements','mobile_diesel_heads','mobile_diesel_mileage_statements','mobile_diesel_reports','mobile_diesel_requests','mobile_diesel_reviews','mobile_diesel_versions'] as const
export function requireValue(value:unknown,message='M74 gate refused'):asserts value {if(!value)throw Error(message)}
export function localName(name:string,port:number){requireValue(/^m74_(ops|qa|security)_[a-z0-9_]+$/.test(name)&&[55463,55472].includes(port))}
export function connectLocal(name:string,port=55463){localName(name,port);return createPostgresConnection(`postgres://${port===55472?'supabase_admin':'m63_test_admin'}@127.0.0.1:${port}/`+name,{maxConnections:1,tls:false})}
export async function canonicalReceipts(tx:WorkspaceSql,version:16|17){
 const manifest=await readMigrationManifest()
 requireValue([16,17].includes(manifest.length)&&hashManifestValue(manifest.slice(0,16).map(({name,sha256})=>({name,sha256})))===BASELINE_MANIFEST_SHA256)
 if(version===17)requireValue(/^[a-f0-9]{64}$/.test(MIGRATION)&&manifest.length===17&&manifest[16]?.name===MIGRATION_NAME&&manifest[16]?.sha256===MIGRATION)
 const receipts=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
 requireValue(receipts.length===version&&receipts.every((r,i)=>r.name===manifest[i]?.name&&r.sha256===manifest[i]?.sha256))
 const target=(await tx.query<{project_ref:string;profile:string}>('select project_ref,profile from neuvetra.staging_target')).rows
 requireValue(target.length===1&&target[0]?.project_ref===PROJECT&&target[0]?.profile==='neuvetra.private-synthetic-staging.v1')
 return manifest
}
