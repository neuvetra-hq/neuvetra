/** M77 operator controls. Imports never connect, inspect credentials or migrate. */
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {hashManifestValue} from './create-source-manifest'
import {inventory as originalInventory,sameRows as originalSameRows,sameCatalog as originalSameCatalog,type Inventory as OriginalInventory} from './m73-common'
export {PROJECT,sha,exclusiveJson,operatorUrl,connectOperator,runtimeSafe,lockedTables,ROLE_SQL,MEMBERS_SQL,DEFAULT_SQL} from './m73-common'
export const BASELINE_MANIFEST_SHA256='5efb9f212f986643f2ac89eac4832422c148d5273646e9654476f060dc64727d'
// Exact author/QA candidate pin. Hosted execution additionally requires the independent operator gate.
export const MIGRATION='11d0b4667b28849c4d3e8c449344c23d5db2c29ef0ce14229d46a39291d932bc'
export const MIGRATION_NAME='0020_fugitive_sources.sql'
export const NEW_TABLES=['fugitive_audit','fugitive_event_reservations','fugitive_heads','fugitive_reports','fugitive_requests','fugitive_reviews','fugitive_statements','fugitive_versions'] as const
export const TRIGGER_ROWS_SQL="select c.relname table_name,t.tgname,pg_get_triggerdef(t.oid) definition,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and not t.tgisinternal order by 1,2"
const SEQUENCE_SQL=`select c.relname name,pg_get_userbyid(c.relowner) owner,format_type(s.seqtypid,null) type,s.seqstart::text start,s.seqincrement::text increment,s.seqmax::text maximum,s.seqmin::text minimum,s.seqcache::text cache,s.seqcycle cycle,
(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)order by case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)end,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)from aclexplode(coalesce(c.relacl,acldefault('s',c.relowner)))a)acl
from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_sequence s on s.seqrelid=c.oid where n.nspname='neuvetra'order by c.relname`
export interface SequenceState {name:string;lastValue:string;isCalled:boolean}
export type Inventory=OriginalInventory&{sequences:SequenceState[]}
export function requireValue(value:unknown,message='M77 gate refused'):asserts value {if(!value)throw Error(message)}
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export async function inventory(tx:WorkspaceSql):Promise<Inventory>{
 const original=await originalInventory(tx),sequenceCatalog=(await tx.query<{name:string}>(SEQUENCE_SQL)).rows,sequences:SequenceState[]=[]
 for(const {name}of sequenceCatalog){requireValue(/^[a-z_]+$/.test(name));const r=(await tx.query<{last_value:string;is_called:boolean}>(`select last_value::text,is_called from neuvetra.${name}`)).rows;requireValue(r.length===1);sequences.push({name,lastValue:r[0]!.last_value,isCalled:r[0]!.is_called})}
 return {...original,metadata:{...original.metadata,sequences:hashManifestValue(sequenceCatalog)},catalogRowHashes:{...original.catalogRowHashes,sequences:sequenceCatalog.map(hashManifestValue).sort()},sequences}
}
export function validateInventory(value:Inventory){
 requireValue(value&&Array.isArray(value.tables)&&value.tables.length>0)
 requireValue(value.tables.every(t=>t&&typeof t.name==='string'&&/^[a-z_]+$/.test(t.name)&&hash(t.sha256)&&Number.isSafeInteger(t.count)&&t.count>=0&&Array.isArray(t.rowHashes)&&t.rowHashes.length===t.count&&t.rowHashes.every(hash)&&hashManifestValue(t.rowHashes)===hashManifestValue([...t.rowHashes].sort())))
 requireValue(new Set(value.tables.map(t=>t.name)).size===value.tables.length)
 requireValue(value.metadata&&value.catalogRowHashes&&Object.keys(value.metadata).length>0&&hashManifestValue(Object.keys(value.metadata).sort())===hashManifestValue(Object.keys(value.catalogRowHashes).sort()))
 requireValue(Object.values(value.metadata).every(hash)&&Object.values(value.catalogRowHashes).every(v=>Array.isArray(v)&&v.every(hash)))
 for(const key of ['roles','memberships','defaultAcls','dependencies']as const)requireValue(Array.isArray(value[key]))
 requireValue(Array.isArray(value.sequences)&&value.sequences.every(s=>/^[a-z_]+$/.test(s.name)&&/^-?[0-9]+$/.test(s.lastValue)&&typeof s.isCalled==='boolean')&&new Set(value.sequences.map(s=>s.name)).size===value.sequences.length)
}
export function sameRows(before:Inventory,after:Inventory,allowAppend=false){
 validateInventory(before);validateInventory(after);originalSameRows(before,after,allowAppend)
 if(!allowAppend)requireValue(hashManifestValue(before.tables)===hashManifestValue(after.tables),'Exact per-row inventory differs')
 const actual=new Map(after.sequences.map(s=>[s.name,s]));for(const s of before.sequences)requireValue(hashManifestValue(s)===hashManifestValue(actual.get(s.name)),'Original sequence state differs')
 if(!allowAppend)requireValue(before.sequences.length===after.sequences.length)
}
export function sameCatalog(before:Inventory,after:Inventory,allowAppend=false){validateInventory(before);validateInventory(after);originalSameCatalog(before,after,allowAppend)}
/** Schema20 permits no addition or modification on any original table's triggers. */
export function sameMigrationCatalog(before:Inventory,after:Inventory,triggers:Array<{table_name:string;tgname:string;definition:string;tgenabled:string}>){
 sameCatalog(before,after,true);const oldTables=new Set(before.tables.map(t=>t.name)),actual=triggers.filter(t=>oldTables.has(t.table_name)).map(hashManifestValue).sort()
 requireValue(hashManifestValue(actual)===hashManifestValue(before.catalogRowHashes.triggers??[]),'An original table trigger differs')
}
export function localName(name:string,port:number){requireValue(/^m77_(ops|qa)_[a-z0-9_]+$/.test(name)&&[55463,55472].includes(port))}
export function connectLocal(name:string,port=55472){localName(name,port);return createPostgresConnection(`postgres://${port===55472?'supabase_admin':'m63_test_admin'}@127.0.0.1:${port}/`+name,{maxConnections:1,tls:false})}
export async function canonicalReceipts(tx:WorkspaceSql,version:19|20){
 const manifest=await readMigrationManifest();requireValue([19,20].includes(manifest.length)&&hashManifestValue(manifest.slice(0,19).map(({name,sha256})=>({name,sha256})))===BASELINE_MANIFEST_SHA256)
 if(version===20)requireValue(hash(MIGRATION)&&manifest.length===20&&manifest[19]?.name===MIGRATION_NAME&&manifest[19]?.sha256===MIGRATION)
 const receipts=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
 requireValue(receipts.length===version&&receipts.every((r,i)=>r.name===manifest[i]?.name&&r.sha256===manifest[i]?.sha256))
 const target=(await tx.query<{project_ref:string;profile:string}>('select project_ref,profile from neuvetra.staging_target')).rows
 requireValue(target.length===1&&target[0]?.project_ref==='icockcoguyadhryzydvl'&&target[0]?.profile==='neuvetra.private-synthetic-staging.v1')
 return manifest
}
