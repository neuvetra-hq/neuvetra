import type { WorkspaceSql } from './workspace'
import { m71CanonicalJson } from './m71-validation'
import {
  COLLECTION_EVIDENCE_BUCKET,
  validateCollectionActivity,
  validateCollectionEvidenceUpload,
  validateCollectionSaveInput,
  type CollectionActivityRecord,
  type CollectionActivitySaveInput,
  type CollectionActivityVersion,
  type CollectionEvidenceMetadata,
  type CollectionEvidenceReceipt,
  type CollectionEvidenceUploadIntent,
  type CollectionEvidenceUploadInput,
  type GridLossLineage,
} from './collection-contract'
export * from './collection-contract'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const digest = (value: unknown) => new Bun.CryptoHasher('sha256').update(m71CanonicalJson(value)).digest('hex')
type VersionRow = { id:string; record_id:string; company_id:string; kind:CollectionActivityRecord['kind']; revision:number; previous_version_id:string|null; correction_reason:string|null; payload:unknown; payload_sha256:string; created_by:string; created_at:string; head_id:string; head_revision:number }
type EvidenceRow = { id:string; company_id:string; storage_bucket:string; storage_key:string; original_name:string; media_type:CollectionEvidenceMetadata['mediaType']; byte_length:number; sha256:string; quarantine_status:CollectionEvidenceMetadata['quarantineStatus']; uploaded_by:string; created_at:string }

function decodeVersion(row: VersionRow): CollectionActivityVersion {
  const activity = validateCollectionActivity(row.payload)
  if (digest(activity) !== row.payload_sha256) throw new Error('Collection activity integrity check failed.')
  return { id:row.id, recordId:row.record_id, companyId:row.company_id, revision:row.revision, previousVersionId:row.previous_version_id, correctionReason:row.correction_reason, activity, payloadSha256:row.payload_sha256, createdBy:row.created_by, createdAt:new Date(row.created_at).toISOString() }
}

/** Caller supplies a transaction with the server-authenticated JWT subject and runtime role. */
export async function readCollectionActivities(tx: WorkspaceSql, companyId: string): Promise<CollectionActivityRecord[]> {
  if (!UUID.test(companyId)) return []
  const rows = await tx.query<VersionRow>(`select v.id,v.record_id,v.company_id,r.kind,v.revision,v.previous_version_id,v.correction_reason,v.payload,v.payload_sha256,v.created_by,v.created_at::text,h.version_id head_id,h.revision head_revision
    from neuvetra.collection_activity_versions v
    join neuvetra.collection_activity_records r on r.id=v.record_id and r.company_id=v.company_id
    join neuvetra.collection_activity_heads h on h.record_id=v.record_id and h.company_id=v.company_id
    where v.company_id=$1 order by v.record_id,v.revision`, [companyId])
  const grouped = new Map<string, VersionRow[]>()
  for (const row of rows.rows) grouped.set(row.record_id,[...(grouped.get(row.record_id)??[]),row])
  return [...grouped.values()].map(history => {
    const versions=history.map(decodeVersion)
    for(let i=0;i<versions.length;i++) if(versions[i]!.revision!==i+1||versions[i]!.previousVersionId!==(versions[i-1]?.id??null)) throw new Error('Collection activity history integrity check failed.')
    const current=versions[versions.length-1]!
    if(history[0]!.head_id!==current.id||history[0]!.head_revision!==current.revision) throw new Error('Collection activity head integrity check failed.')
    return { id:current.recordId, companyId:current.companyId, kind:history[0]!.kind, currentVersion:current, history:versions.map(({activity:_activity,...summary})=>summary) }
  })
}

export async function readCollectionActivityVersion(tx: WorkspaceSql, companyId:string, recordId:string, versionId:string):Promise<CollectionActivityVersion|null>{
  if(!UUID.test(companyId)||!UUID.test(recordId)||!UUID.test(versionId))return null
  const rows=await tx.query<VersionRow>(`select v.id,v.record_id,v.company_id,r.kind,v.revision,v.previous_version_id,v.correction_reason,v.payload,v.payload_sha256,v.created_by,v.created_at::text,h.version_id head_id,h.revision head_revision
    from neuvetra.collection_activity_versions v join neuvetra.collection_activity_records r on r.id=v.record_id and r.company_id=v.company_id join neuvetra.collection_activity_heads h on h.record_id=v.record_id and h.company_id=v.company_id
    where v.company_id=$1 and v.record_id=$2 and v.id=$3`,[companyId,recordId,versionId])
  return rows.rows[0]?decodeVersion(rows.rows[0]):null
}

export async function saveCollectionActivity(tx:WorkspaceSql,actorId:string,companyId:string,recordId:string,input:unknown):Promise<{record:CollectionActivityRecord;version:CollectionActivityVersion;replayed:boolean}>{
  if(!UUID.test(actorId)||!UUID.test(companyId)||!UUID.test(recordId))throw new Error('Collection activity unavailable.')
  const actor=await tx.query<{id:string}>('select neuvetra.current_user_id() id')
  if(actor.rows[0]?.id!==actorId)throw Object.assign(new Error('Collection activity unavailable.'),{code:'42501'})
  const valid:CollectionActivitySaveInput=validateCollectionSaveInput(input)
  const receipt=await tx.query<{record_id:string;version_id:string;replayed:boolean}>('select * from neuvetra.save_collection_activity($1,$2,$3::text::jsonb)',[companyId,recordId,JSON.stringify(valid)])
  const row=receipt.rows[0]
  if(!row)throw new Error('Collection activity save returned no receipt.')
  const record=(await readCollectionActivities(tx,companyId)).find(item=>item.id===row.record_id)
  const version=record?.history.find(item=>item.id===row.version_id)
  const full=version&&await readCollectionActivityVersion(tx,companyId,row.record_id,row.version_id)
  if(!record||!full)throw new Error('Collection activity save could not be read back.')
  return {record,version:full,replayed:row.replayed}
}

export async function createGridLossLineage(tx:WorkspaceSql,actorId:string,companyId:string,input:{id:string;electricityRecordId:string;reference:string;notes:string}):Promise<GridLossLineage>{
  if(!UUID.test(actorId)||!UUID.test(companyId)||!UUID.test(input?.id)||!UUID.test(input?.electricityRecordId)||typeof input.reference!=='string'||input.reference.length>1000||typeof input.notes!=='string'||input.notes.length>4000)throw new Error('Invalid grid-loss lineage.')
  const actor=await tx.query<{id:string}>('select neuvetra.current_user_id() id')
  if(actor.rows[0]?.id!==actorId)throw Object.assign(new Error('Grid-loss lineage unavailable.'),{code:'42501'})
  await tx.query('select neuvetra.create_collection_grid_loss_lineage($1,$2,$3,$4,$5)',[companyId,input.id,input.electricityRecordId,input.reference,input.notes])
  const rows=await readGridLossLineage(tx,companyId)
  const saved=rows.find(row=>row.id===input.id)
  if(!saved)throw new Error('Grid-loss lineage could not be read back.')
  return saved
}

export async function readGridLossLineage(tx:WorkspaceSql,companyId:string):Promise<GridLossLineage[]>{
  if(!UUID.test(companyId))return []
  const result=await tx.query<{id:string;company_id:string;electricity_record_id:string;reference:string;notes:string;created_by:string;created_at:string}>('select id,company_id,electricity_record_id,reference,notes,created_by,created_at::text from neuvetra.collection_grid_loss_lineage where company_id=$1 order by created_at,id',[companyId])
  return result.rows.map(row=>({id:row.id,companyId:row.company_id,electricityRecordId:row.electricity_record_id,reference:row.reference,notes:row.notes,createdBy:row.created_by,createdAt:new Date(row.created_at).toISOString()}))
}

export async function registerCollectionEvidence(tx:WorkspaceSql,actorId:string,companyId:string,input:unknown):Promise<CollectionEvidenceReceipt>{
  if(!UUID.test(actorId)||!UUID.test(companyId))throw new Error('Collection evidence unavailable.')
  const actor=await tx.query<{id:string}>('select neuvetra.current_user_id() id')
  if(actor.rows[0]?.id!==actorId)throw Object.assign(new Error('Collection evidence unavailable.'),{code:'42501'})
  const valid:CollectionEvidenceUploadInput=validateCollectionEvidenceUpload(input,companyId)
  const result=await tx.query<{upload_id:string;evidence_id:string;reused:boolean;quarantine_status:CollectionEvidenceReceipt['quarantineStatus'];orphan_recovery_required:boolean}>('select * from neuvetra.register_collection_evidence($1,$2,$3,$4,$5,$6,$7,$8)',[companyId,valid.uploadId,valid.evidenceId,valid.objectKey,valid.originalName,valid.mediaType,valid.byteLength,valid.sha256])
  const row=result.rows[0]
  if(!row)throw new Error('Collection evidence registration returned no receipt.')
  return {uploadId:row.upload_id,evidenceId:row.evidence_id,reused:row.reused,quarantineStatus:row.quarantine_status,orphanRecoveryRequired:row.orphan_recovery_required}
}

/** Must commit before the client uploads bytes so failed registration remains discoverable by exact object key. */
export async function reserveCollectionEvidenceUpload(tx:WorkspaceSql,actorId:string,companyId:string,input:unknown):Promise<CollectionEvidenceUploadIntent>{
  if(!UUID.test(actorId)||!UUID.test(companyId))throw new Error('Collection evidence unavailable.')
  const actor=await tx.query<{id:string}>('select neuvetra.current_user_id() id')
  if(actor.rows[0]?.id!==actorId)throw Object.assign(new Error('Collection evidence unavailable.'),{code:'42501'})
  const valid:CollectionEvidenceUploadInput=validateCollectionEvidenceUpload(input,companyId)
  const result=await tx.query<{id:string}>('select neuvetra.reserve_collection_evidence_upload($1,$2,$3,$4,$5,$6,$7,$8) id',[companyId,valid.uploadId,valid.evidenceId,valid.objectKey,valid.originalName,valid.mediaType,valid.byteLength,valid.sha256])
  if(result.rows[0]?.id!==valid.uploadId)throw new Error('Collection evidence upload intent returned no receipt.')
  return {uploadId:valid.uploadId,evidenceId:valid.evidenceId,objectKey:valid.objectKey,bucket:COLLECTION_EVIDENCE_BUCKET}
}

export async function markCollectionEvidenceRegistrationFailed(tx:WorkspaceSql,actorId:string,companyId:string,uploadId:string):Promise<{recoveryId:string}>{
  if(!UUID.test(actorId)||!UUID.test(companyId)||!UUID.test(uploadId))throw new Error('Collection evidence unavailable.')
  const actor=await tx.query<{id:string}>('select neuvetra.current_user_id() id')
  if(actor.rows[0]?.id!==actorId)throw Object.assign(new Error('Collection evidence unavailable.'),{code:'42501'})
  const result=await tx.query<{id:string}>('select neuvetra.mark_collection_evidence_registration_failed($1,$2) id',[companyId,uploadId])
  if(!UUID.test(result.rows[0]?.id??''))throw new Error('Evidence recovery receipt unavailable.')
  return {recoveryId:result.rows[0]!.id}
}

export async function readCollectionEvidence(tx:WorkspaceSql,companyId:string):Promise<CollectionEvidenceMetadata[]>{
  if(!UUID.test(companyId))return []
  const result=await tx.query<EvidenceRow>(`select o.id,o.company_id,o.storage_bucket,o.storage_key,o.original_name,o.media_type,o.byte_length,o.sha256,o.uploaded_by,o.created_at::text,
    (select q.status from neuvetra.collection_evidence_quarantine_events q where q.company_id=o.company_id and q.evidence_id=o.id order by q.created_at desc,q.id desc limit 1) quarantine_status
    from neuvetra.collection_evidence_objects o where o.company_id=$1 order by o.created_at,o.id`,[companyId])
  return result.rows.map(row=>({id:row.id,companyId:row.company_id,bucket:row.storage_bucket as typeof COLLECTION_EVIDENCE_BUCKET,objectKey:row.storage_key,originalName:row.original_name,mediaType:row.media_type,byteLength:row.byte_length,sha256:row.sha256,quarantineStatus:row.quarantine_status,uploadedBy:row.uploaded_by,createdAt:new Date(row.created_at).toISOString()}))
}

/** Returns a private object locator only after a scanner/operator has appended a clean event. */
export async function findDownloadableCollectionEvidence(tx:WorkspaceSql,companyId:string,evidenceId:string):Promise<{bucket:typeof COLLECTION_EVIDENCE_BUCKET;objectKey:string;sha256:string;mediaType:string;byteLength:number}|null>{
  if(!UUID.test(companyId)||!UUID.test(evidenceId))return null
  const rows=await tx.query<{storage_bucket:string;storage_key:string;sha256:string;media_type:string;byte_length:number}>(`select o.storage_bucket,o.storage_key,o.sha256,o.media_type,o.byte_length from neuvetra.collection_evidence_objects o
    where o.company_id=$1 and o.id=$2 and (select q.status from neuvetra.collection_evidence_quarantine_events q where q.company_id=o.company_id and q.evidence_id=o.id order by q.created_at desc,q.id desc limit 1)='clean'`,[companyId,evidenceId])
  const row=rows.rows[0]
  return row?{bucket:row.storage_bucket as typeof COLLECTION_EVIDENCE_BUCKET,objectKey:row.storage_key,sha256:row.sha256,mediaType:row.media_type,byteLength:row.byte_length}:null
}
