/** Byte fingerprints only. Domain/semantic replay is a separate acceptance gate. */
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {recoveryManifest as legacyRecovery,byteEntry,type RecoveryEntry} from './m75-recovery-manifest'
import {canonicalManifestJson,hashManifestValue} from './create-source-manifest'
import {requireValue} from './m76-common'
export {byteEntry,type RecoveryEntry}
export interface RecoveryManifest {profile:'neuvetra.m76.recovery-content.v1';schemaVersion:18|19;entries:RecoveryEntry[];sha256:string}
export async function recoveryManifest(tx:WorkspaceSql,schemaVersion:18|19):Promise<RecoveryManifest>{
 requireValue(schemaVersion===18||schemaVersion===19)
 const entries=[...(await legacyRecovery(tx,18)).entries]
 if(schemaVersion===19){
  for(const family of ['stationary_diesel','stationary_equipment']){
   for(const r of(await tx.query<{id:string;statement_text:string;statement_sha256:string;payload:unknown}>(`select id,statement_text,statement_sha256,payload from neuvetra.${family}_statements order by id`)).rows){
    entries.push(byteEntry(family+'_statements',r.id,'statement',r.statement_text,r.statement_sha256))
    entries.push(byteEntry(family+'_statements',r.id,'metadata',canonicalManifestJson(r.payload)))
   }
   for(const r of(await tx.query<{id:string;export_text:string;payload:Record<string,unknown>}>(`select id,export_text,payload from neuvetra.${family}_versions order by id`)).rows){
    entries.push(byteEntry(family+'_versions',r.id,'export',r.export_text))
    const part=family==='stationary_diesel'?'calculation':'dependencies'
    requireValue(Object.hasOwn(r.payload,part),'Missing stationary immutable '+part)
    entries.push(byteEntry(family+'_versions',r.id,part,canonicalManifestJson(r.payload[part])))
   }
   for(const r of(await tx.query<{id:string;payload:{html:string;htmlSha256:string;htmlByteLength:number;snapshotJson:string;snapshotSha256:string}}>(`select id,payload from neuvetra.${family}_reports order by id`)).rows){
    const p=r.payload;requireValue(typeof p.html==='string'&&typeof p.snapshotJson==='string')
    entries.push(byteEntry(family+'_reports',r.id,'html',p.html,p.htmlSha256,p.htmlByteLength))
    entries.push(byteEntry(family+'_reports',r.id,'snapshot',p.snapshotJson,p.snapshotSha256))
   }
   for(const r of(await tx.query<{id:string;payload:unknown}>(`select id,payload from neuvetra.${family}_reviews order by id`)).rows)
    entries.push(byteEntry(family+'_reviews',r.id,'decision',canonicalManifestJson(r.payload)))
  }
 }
 entries.sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)))
 const result:RecoveryManifest={profile:'neuvetra.m76.recovery-content.v1',schemaVersion,entries,sha256:hashManifestValue(entries)}
 validateRecoveryManifest(result);return result
}
export function validateRecoveryManifest(value:RecoveryManifest){
 requireValue(value?.profile==='neuvetra.m76.recovery-content.v1'&&[18,19].includes(value.schemaVersion)&&Array.isArray(value.entries))
 requireValue(value.entries.every(e=>e&&typeof e.table==='string'&&/^[a-z_]+$/.test(e.table)&&typeof e.id==='string'&&e.id.length>0&&typeof e.part==='string'&&e.part.length>0&&/^[a-f0-9]{64}$/.test(e.sha256)&&Number.isSafeInteger(e.byteLength)&&e.byteLength>=0))
 requireValue(new Set(value.entries.map(e=>JSON.stringify([e.table,e.id,e.part]))).size===value.entries.length)
 requireValue(value.sha256===hashManifestValue(value.entries))
}
export function sameRecovery(before:RecoveryManifest,after:RecoveryManifest,allowNewEmptySchema=false){
 validateRecoveryManifest(before);validateRecoveryManifest(after)
 requireValue(before.schemaVersion===after.schemaVersion||(allowNewEmptySchema&&before.schemaVersion===18&&after.schemaVersion===19))
 requireValue(hashManifestValue(before.entries)===hashManifestValue(after.entries),'Recovery bytes differ')
}
