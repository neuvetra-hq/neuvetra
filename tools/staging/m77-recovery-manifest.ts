/** Exact content fingerprints; authoritative semantic replay remains a separate gate. */
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {recoveryManifest as legacyRecovery,byteEntry,type RecoveryEntry} from './m76-recovery-manifest'
import {canonicalManifestJson,hashManifestValue} from './create-source-manifest'
import {requireValue} from './m77-common'
export {byteEntry,type RecoveryEntry}
export interface RecoveryManifest {profile:'neuvetra.m77.recovery-content.v1';schemaVersion:19|20;entries:RecoveryEntry[];sha256:string}
export async function recoveryManifest(tx:WorkspaceSql,schemaVersion:19|20):Promise<RecoveryManifest>{
 requireValue(schemaVersion===19||schemaVersion===20)
 const entries=[...(await legacyRecovery(tx,19)).entries]
 if(schemaVersion===20){
  for(const r of(await tx.query<{id:string;statement_text:string;statement_sha256:string;payload:unknown}>('select id,statement_text,statement_sha256,payload from neuvetra.fugitive_statements order by id')).rows){entries.push(byteEntry('fugitive_statements',r.id,'statement',r.statement_text,r.statement_sha256));entries.push(byteEntry('fugitive_statements',r.id,'metadata',canonicalManifestJson(r.payload)))}
  for(const r of(await tx.query<{id:string;export_text:string;payload:Record<string,unknown>}>('select id,export_text,payload from neuvetra.fugitive_versions order by id')).rows){entries.push(byteEntry('fugitive_versions',r.id,'export',r.export_text));for(const part of ['calculation','dependencies']as const){requireValue(Object.hasOwn(r.payload,part));entries.push(byteEntry('fugitive_versions',r.id,part,canonicalManifestJson(r.payload[part])))}}
  for(const r of(await tx.query<{id:string;payload:{html:string;htmlSha256:string;htmlByteLength:number;snapshotJson:string;snapshotSha256:string}}> ('select id,payload from neuvetra.fugitive_reports order by id')).rows){const p=r.payload;requireValue(typeof p.html==='string'&&typeof p.snapshotJson==='string');entries.push(byteEntry('fugitive_reports',r.id,'html',p.html,p.htmlSha256,p.htmlByteLength));entries.push(byteEntry('fugitive_reports',r.id,'snapshot',p.snapshotJson,p.snapshotSha256))}
  for(const r of(await tx.query<{id:string;payload:unknown}>('select id,payload from neuvetra.fugitive_reviews order by id')).rows)entries.push(byteEntry('fugitive_reviews',r.id,'decision',canonicalManifestJson(r.payload)))
  for(const table of ['fugitive_event_reservations','fugitive_heads','fugitive_requests','fugitive_audit'])for(const r of(await tx.query<{row:Record<string,unknown>}>(`select to_jsonb(x) row from neuvetra.${table} x`)).rows){const p=r.row,id=table==='fugitive_event_reservations'?canonicalManifestJson([p.company_id,p.year,p.kind,p.event_key]):String(p.id??p.idempotency_key);entries.push(byteEntry(table,id,'record',canonicalManifestJson(p)))}
 }
 entries.sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)))
 const result:RecoveryManifest={profile:'neuvetra.m77.recovery-content.v1',schemaVersion,entries,sha256:hashManifestValue(entries)};validateRecoveryManifest(result);return result
}
export function validateRecoveryManifest(value:RecoveryManifest){
 requireValue(value?.profile==='neuvetra.m77.recovery-content.v1'&&[19,20].includes(value.schemaVersion)&&Array.isArray(value.entries))
 requireValue(value.entries.every(e=>e&&typeof e.table==='string'&&/^[a-z_]+$/.test(e.table)&&typeof e.id==='string'&&e.id.length>0&&typeof e.part==='string'&&e.part.length>0&&/^[a-f0-9]{64}$/.test(e.sha256)&&Number.isSafeInteger(e.byteLength)&&e.byteLength>=0))
 requireValue(new Set(value.entries.map(e=>JSON.stringify([e.table,e.id,e.part]))).size===value.entries.length&&value.sha256===hashManifestValue(value.entries))
 requireValue(value.schemaVersion===20||!value.entries.some(e=>e.table.startsWith('fugitive_')))
}
export function sameRecovery(before:RecoveryManifest,after:RecoveryManifest,allowNewEmptySchema=false){
 validateRecoveryManifest(before);validateRecoveryManifest(after);requireValue(before.schemaVersion===after.schemaVersion||(allowNewEmptySchema&&before.schemaVersion===19&&after.schemaVersion===20))
 requireValue(hashManifestValue(before.entries)===hashManifestValue(after.entries),'Recovery bytes differ')
}

