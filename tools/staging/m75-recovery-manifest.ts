/** Pure byte manifest. Reuses frozen schema17 content coverage, then adds M75 bytes. */
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {recoveryManifest as legacyRecovery,byteEntry,type RecoveryEntry} from './m74-recovery-manifest'
import {canonicalManifestJson,hashManifestValue} from './create-source-manifest'
import {requireValue} from './m75-common'
export {byteEntry,type RecoveryEntry}
export interface RecoveryManifest {profile:'neuvetra.m75.recovery-content.v1';schemaVersion:17|18;entries:RecoveryEntry[];sha256:string}
export async function recoveryManifest(tx:WorkspaceSql,schemaVersion:17|18):Promise<RecoveryManifest>{
 const entries=[...(await legacyRecovery(tx,17)).entries]
 if(schemaVersion===18){
  for(const r of(await tx.query<{id:string;statement_text:string;statement_sha256:string;payload:unknown}>('select id,statement_text,statement_sha256,payload from neuvetra.controlled_fleet_statements order by id')).rows){
   entries.push(byteEntry('controlled_fleet_statements',r.id,'statement',r.statement_text,r.statement_sha256))
   entries.push(byteEntry('controlled_fleet_statements',r.id,'metadata',canonicalManifestJson(r.payload)))
  }
  for(const r of(await tx.query<{id:string;export_text:string;payload:Record<string,unknown>}>('select id,export_text,payload from neuvetra.controlled_fleet_versions order by id')).rows){
   entries.push(byteEntry('controlled_fleet_versions',r.id,'export',r.export_text))
   requireValue(Object.hasOwn(r.payload,'dependencies'),'Missing fleet dependency snapshot')
   entries.push(byteEntry('controlled_fleet_versions',r.id,'dependencies',canonicalManifestJson(r.payload.dependencies)))
  }
  for(const r of(await tx.query<{id:string;payload:{html:string;htmlSha256:string;htmlByteLength:number;snapshotJson:string;snapshotSha256:string}}>('select id,payload from neuvetra.controlled_fleet_reports order by id')).rows){
   const p=r.payload;requireValue(typeof p.html==='string'&&typeof p.snapshotJson==='string')
   entries.push(byteEntry('controlled_fleet_reports',r.id,'html',p.html,p.htmlSha256,p.htmlByteLength))
   entries.push(byteEntry('controlled_fleet_reports',r.id,'snapshot',p.snapshotJson,p.snapshotSha256))
  }
 }
 entries.sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)))
 const result:RecoveryManifest={profile:'neuvetra.m75.recovery-content.v1',schemaVersion,entries,sha256:hashManifestValue(entries)}
 validateRecoveryManifest(result);return result
}
export function validateRecoveryManifest(value:RecoveryManifest){
 requireValue(value?.profile==='neuvetra.m75.recovery-content.v1'&&[17,18].includes(value.schemaVersion)&&Array.isArray(value.entries))
 requireValue(value.entries.every(e=>e&&typeof e.table==='string'&&/^[a-z_]+$/.test(e.table)&&typeof e.id==='string'&&e.id.length>0&&typeof e.part==='string'&&e.part.length>0&&/^[a-f0-9]{64}$/.test(e.sha256)&&Number.isSafeInteger(e.byteLength)&&e.byteLength>=0))
 requireValue(new Set(value.entries.map(e=>JSON.stringify([e.table,e.id,e.part]))).size===value.entries.length)
 requireValue(value.sha256===hashManifestValue(value.entries))
}
export function sameRecovery(before:RecoveryManifest,after:RecoveryManifest,allowNewEmptySchema=false){
 validateRecoveryManifest(before);validateRecoveryManifest(after)
 requireValue(before.schemaVersion===after.schemaVersion||(allowNewEmptySchema&&before.schemaVersion===17&&after.schemaVersion===18))
 requireValue(hashManifestValue(before.entries)===hashManifestValue(after.entries),'Recovery bytes differ')
}
