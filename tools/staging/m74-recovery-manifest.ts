/** Independent byte inventory, not an application renderer or an accounting replay.
 * Must be produced in the same snapshot as the dump. Contains fingerprints, never statement content.
 */
import type {WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {canonicalManifestJson,hashManifestValue} from './create-source-manifest'
import {sha,requireValue} from './m74-common'
export interface RecoveryEntry {table:string;id:string;part:string;sha256:string;byteLength:number}
export interface RecoveryManifest {profile:'neuvetra.m74.recovery-content.v1';schemaVersion:16|17;entries:RecoveryEntry[];sha256:string}
export function byteEntry(table:string,id:string,part:string,bytes:string|Uint8Array,expectedHash?:string,expectedLength?:number):RecoveryEntry {
 const content=typeof bytes==='string'?Buffer.from(bytes,'utf8'):bytes
 const digest=sha(content);requireValue(expectedHash===undefined||digest===expectedHash,'Stored content hash mismatch')
 requireValue(expectedLength===undefined||content.byteLength===expectedLength,'Stored content length mismatch')
 return {table,id,part,sha256:digest,byteLength:content.byteLength}
}
export async function recoveryManifest(tx:WorkspaceSql,schemaVersion:16|17):Promise<RecoveryManifest>{
 const entries:RecoveryEntry[]=[]
 for(const table of ['electricity_sources','worksheet_reports','source_worksheet_reports','annual_electricity_reports','annual_evidence_reports']){
  const source=table==='electricity_sources',column=source?'original_bytes':'report_bytes',hash=source?'sha256':'report_sha256',length=source?'byte_length':'report_byte_length'
  for(const row of (await tx.query<{id:string;content:string;hash:string;length:number}>(`select id,encode(${column},'hex') content,${hash} hash,${length} length from neuvetra.${table} order by id`)).rows)
   entries.push(byteEntry(table,row.id,'download',Buffer.from(row.content,'hex'),row.hash,Number(row.length)))
 }
 const methods=['stationary_gas',...(schemaVersion===17?['mobile_diesel']:[])]
 const statementTables=['stationary_gas_statements',...(schemaVersion===17?['mobile_diesel_fuel_statements','mobile_diesel_mileage_statements']:[])]
 for(const table of statementTables){
  for(const row of (await tx.query<{id:string;statement_text:string;statement_sha256:string;payload:unknown}>(`select id,statement_text,statement_sha256,payload from neuvetra.${table} order by id`)).rows){
   entries.push(byteEntry(table,row.id,'statement',row.statement_text,row.statement_sha256))
   entries.push(byteEntry(table,row.id,'metadata',canonicalManifestJson(row.payload)))
  }
 }
 for(const table of ['corporate_inventory_versions',...methods.map(m=>m+'_versions')]){
  for(const row of (await tx.query<{id:string;export_text:string;payload:Record<string,unknown>}>(`select id,export_text,payload from neuvetra.${table} order by id`)).rows){
   entries.push(byteEntry(table,row.id,'export',row.export_text))
   if(table!=='corporate_inventory_versions'){
    requireValue(Object.hasOwn(row.payload,'calculation'),'Missing calculation property')
    // Explicit null is fingerprinted as null, never silently excluded or converted to zero.
    entries.push(byteEntry(table,row.id,'calculation',canonicalManifestJson(row.payload.calculation)))
   }
  }
 }
 for(const table of methods.map(m=>m+'_reports')){
  for(const row of (await tx.query<{id:string;payload:{html:string;htmlSha256:string;htmlByteLength:number;snapshotJson:string;snapshotSha256:string}}>(`select id,payload from neuvetra.${table} order by id`)).rows){
   const p=row.payload;requireValue(typeof p.html==='string'&&typeof p.snapshotJson==='string')
   entries.push(byteEntry(table,row.id,'html',p.html,p.htmlSha256,p.htmlByteLength))
   entries.push(byteEntry(table,row.id,'snapshot',p.snapshotJson,p.snapshotSha256))
  }
 }
 entries.sort((a,b)=>canonicalManifestJson(a).localeCompare(canonicalManifestJson(b)))
 return {profile:'neuvetra.m74.recovery-content.v1',schemaVersion,entries,sha256:hashManifestValue(entries)}
}
export function validateRecoveryManifest(value:RecoveryManifest){
 requireValue(value.profile==='neuvetra.m74.recovery-content.v1'&&[16,17].includes(value.schemaVersion)&&Array.isArray(value.entries))
 requireValue(value.entries.every(e=>typeof e.table==='string'&&typeof e.id==='string'&&typeof e.part==='string'&&/^[a-f0-9]{64}$/.test(e.sha256)&&Number.isSafeInteger(e.byteLength)&&e.byteLength>=0))
 requireValue(new Set(value.entries.map(e=>JSON.stringify([e.table,e.id,e.part]))).size===value.entries.length)
 requireValue(value.sha256===hashManifestValue(value.entries))
}
export function sameRecovery(before:RecoveryManifest,after:RecoveryManifest,allowNewEmptySchema=false){
 validateRecoveryManifest(before);validateRecoveryManifest(after)
 requireValue(before.schemaVersion===after.schemaVersion||(allowNewEmptySchema&&before.schemaVersion===16&&after.schemaVersion===17))
 requireValue(hashManifestValue(before.entries)===hashManifestValue(after.entries),'Recovery bytes differ')
}
