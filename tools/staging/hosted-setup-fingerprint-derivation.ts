import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {
  PROFILE as RECOVERY_PROFILE,PROJECT,assertPreserved,captureState,
  hash as recoveryHash,sha,validateBundle,type Receipt,type Snapshot,type State,
} from './hosted-setup-restore-core'
import {
  HOSTED_SETUP_FROM_SCHEMA,HOSTED_SETUP_PROFILE,fingerprintSha256,
  hash as fingerprintHash,snapshotHostedSetupDatabase,
  type HostedSetupFingerprint,type UpgradeMigration,
} from './hosted-setup-upgrade'

export const FINGERPRINT_DERIVATION_PROFILE='neuvetra.hosted-setup.fingerprint-derivation.v1'
export const FINGERPRINT_DERIVATION_INPUT_PROFILE='neuvetra.hosted-setup.fingerprint-derivation-input.v1'
export const REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT=27
const DIGEST=/^[0-9a-f]{64}$/

export interface PinnedBytes {bytes:Uint8Array;sha256:string}
export interface FingerprintDerivationInput {
  profile:typeof FINGERPRINT_DERIVATION_INPUT_PROFILE
  projectRef:typeof PROJECT
  targetProfile:typeof HOSTED_SETUP_PROFILE
  schemaVersion:typeof HOSTED_SETUP_FROM_SCHEMA
  expectedExternalDefaultAclCount:typeof REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT
  expectedExternalDefaultAclsSha256:string
  sourceSnapshot:PinnedBytes
  sourceReceipt:PinnedBytes
  sourceArchive:PinnedBytes
  restoreResult:PinnedBytes
}
export interface HostedSetupRestoreResult {
  profile:typeof RECOVERY_PROFILE
  status:'local-restore-preservation-passed'
  database:string
  sourceReceiptSha256:string
  sourceStateSha256:string
  restoredStateSha256:string
  applicationRowsExact:true
  applicationCatalogEquivalent:true
  tenantReadAccessExact:true
  providerRecoveryExcluded:true
  hostedMigrationAuthorized:false
}
export interface HostedSetupFingerprintDerivation {
  profile:typeof FINGERPRINT_DERIVATION_PROFILE
  projectRef:typeof PROJECT
  targetProfile:typeof HOSTED_SETUP_PROFILE
  schemaVersion:typeof HOSTED_SETUP_FROM_SCHEMA
  sourceSnapshotSha256:string
  sourceReceiptSha256:string
  sourceArchiveSha256:string
  sourceStateSha256:string
  restoreResultSha256:string
  restoredStateSha256:string
  sourceExternalDefaultAclsSha256:string
  sourceExternalDefaultAclCount:typeof REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT
  expectedDatabaseFingerprintSha256:string
  rowEncoding:'postgres-jsonb-text.v1'
  exactApplicationRowsPreserved:true
  applicationCatalogEquivalent:true
  roleMembershipEquivalent:true
  sequenceStateEquivalent:true
  tenantControlsVerified:true
  sourceCurrentnessObserved:false
  liveHostedPreflightRequired:true
  independentReviewRequired:true
  upgradeAuthorized:false
}
export interface CoherentCloneCapture {
  restored:State
  local:HostedSetupFingerprint
  identity:{database:string;address:string;port:number;version:string}
}
export interface FingerprintDerivationDependencies {
  migrationManifest?:()=>Promise<UpgradeMigration[]>
  snapshotInSharedTransaction?:(tx:WorkspaceSql)=>Promise<HostedSetupFingerprint>
  captureStateInSharedTransaction?:(tx:WorkspaceSql,actors:Snapshot['auth']['actors'])=>Promise<State>
  afterFingerprintCapturedInSharedSnapshot?:()=>Promise<void>
}

function refuse(value:unknown,code:string):asserts value {
  if(!value)throw Error('HS_FINGERPRINT_'+code)
}
function exactKeys(value:unknown,keys:readonly string[],code:string):asserts value is Record<string,unknown>{
  refuse(!!value&&typeof value==='object'&&!Array.isArray(value),code)
  refuse(fingerprintHash(Object.keys(value as Record<string,unknown>).sort())===fingerprintHash([...keys].sort()),code)
}
function pinned(value:PinnedBytes,label:string,maxBytes:number){
  refuse(value&&value.bytes instanceof Uint8Array&&value.bytes.byteLength>0&&value.bytes.byteLength<=maxBytes,label+'_BYTES_REFUSED')
  refuse(DIGEST.test(value.sha256)&&sha(value.bytes)===value.sha256,label+'_PIN_CHANGED')
}
function exactJson<T>(artifact:PinnedBytes,label:string,format:'compact'|'pretty-line'):T{
  pinned(artifact,label,256*1024*1024)
  const text=Buffer.from(artifact.bytes).toString('utf8')
  let value:unknown
  try{value=JSON.parse(text)}catch{throw Error('HS_FINGERPRINT_'+label+'_JSON_REFUSED')}
  const expected=format==='compact'?JSON.stringify(value):JSON.stringify(value,null,2)+'\n'
  refuse(text===expected,label+'_NONCANONICAL_JSON')
  return value as T
}
type DefaultAcl={owner:string;schema:string;kind:string;acl:string|null}
function defaultAclRows(value:unknown,code:string):DefaultAcl[]{
  refuse(Array.isArray(value),code)
  const rows=value as unknown[]
  for(const row of rows){
    exactKeys(row,['owner','schema','kind','acl'],code)
    const r=row as unknown as DefaultAcl
    refuse(typeof r.owner==='string'&&r.owner.length>0&&typeof r.schema==='string'&&r.schema.length>0&&typeof r.kind==='string'&&r.kind.length===1&&(r.acl===null||typeof r.acl==='string'),code)
  }
  refuse(new Set((rows as DefaultAcl[]).map(row=>fingerprintHash([row.owner,row.schema,row.kind]))).size===rows.length,code)
  const ordered=[...(rows as DefaultAcl[])].sort((a,b)=>a.owner<b.owner?-1:a.owner>b.owner?1:a.schema<b.schema?-1:a.schema>b.schema?1:a.kind<b.kind?-1:a.kind>b.kind?1:0)
  refuse(fingerprintHash(rows)===fingerprintHash(ordered),code)
  return rows as DefaultAcl[]
}
function appDefaultAcls(rows:DefaultAcl[]){return rows.filter(row=>row.schema==='neuvetra'||row.schema==='*')}
function externalDefaultAcls(rows:DefaultAcl[]){return rows.filter(row=>row.schema!=='neuvetra'&&row.schema!=='*')}
function tableRows(value:{tables:Array<{name:string;count:number;rowHashes:string[]}>}){
  return value.tables.map(row=>({name:row.name,count:row.count,rowHashes:row.rowHashes}))
}
function sequenceStatesFromRecovery(state:State){
  return state.inventory.sequences.map(row=>({name:row.name,lastValue:row.lastValue,isCalled:row.isCalled}))
}
function sequenceStatesFromFingerprint(value:HostedSetupFingerprint){
  return value.catalog.sequences.map(row=>{
    const r=row as Record<string,unknown>
    refuse(typeof r.name==='string'&&typeof r.last_value==='string'&&typeof r.is_called==='boolean','SEQUENCE_FINGERPRINT_REFUSED')
    return {name:r.name,lastValue:r.last_value,isCalled:r.is_called}
  })
}
function validateReceipt(value:Receipt){
  exactKeys(value,['profile','project','createdUtc','applicationOnly','syntheticOnly','providerRecoveryExcluded','archiveSha256','snapshotSha256','dumpSha256','stateSha256'],'SOURCE_RECEIPT_SHAPE_REFUSED')
}
function validateSnapshot(value:Snapshot){
  exactKeys(value,['profile','project','applicationOnly','syntheticOnly','providerRecoveryExcluded','snapshotTokenHash','state','auth','dumpBase64','dumpSha256','sourceDatabase','serverMajor'],'SOURCE_SNAPSHOT_SHAPE_REFUSED')
}
function validateRestoreResult(value:HostedSetupRestoreResult){
  exactKeys(value,['profile','status','database','sourceReceiptSha256','sourceStateSha256','restoredStateSha256','applicationRowsExact','applicationCatalogEquivalent','tenantReadAccessExact','providerRecoveryExcluded','hostedMigrationAuthorized'],'RESTORE_RESULT_SHAPE_REFUSED')
  refuse(value.profile===RECOVERY_PROFILE&&value.status==='local-restore-preservation-passed'&&/^hosted_setup_restore_[0-9]{13}_[a-f0-9]{8}$/.test(value.database),'RESTORE_RESULT_BOUNDARY_REFUSED')
  refuse(value.applicationRowsExact===true&&value.applicationCatalogEquivalent===true&&value.tenantReadAccessExact===true&&value.providerRecoveryExcluded===true&&value.hostedMigrationAuthorized===false,'RESTORE_RESULT_CLAIMS_REFUSED')
  refuse([value.sourceReceiptSha256,value.sourceStateSha256,value.restoredStateSha256].every(v=>DIGEST.test(v)),'RESTORE_RESULT_DIGEST_REFUSED')
}
function transactionBoundConnection(tx:WorkspaceSql):WorkspaceConnection{
  return {
    query:<T=Record<string,unknown>>(sql:string,params:unknown[]=[])=>(tx.query<T>(sql,params)),
    // The outer boundary already issued this before any read. Suppress only
    // the nested helper's identical command; every other statement reaches tx.
    exec:(sql:string)=>sql.trim().toLowerCase()==='set transaction isolation level repeatable read read only'?Promise.resolve():tx.exec(sql),
    transaction:<T>(operation:(inner:WorkspaceSql)=>Promise<T>)=>operation(tx),
    close:async()=>{throw Error('HS_FINGERPRINT_NESTED_CLOSE_REFUSED')},
  }
}
async function captureCoherentClone(
  db:WorkspaceConnection,
  actors:Snapshot['auth']['actors'],
  deps:FingerprintDerivationDependencies,
):Promise<CoherentCloneCapture>{
  return db.transaction(async tx=>{
    // This command precedes every catalog, identity, row and tenant read,
    // including when focused tests inject transaction-scoped capture seams.
    await tx.exec('set transaction isolation level repeatable read read only')
    const local=deps.snapshotInSharedTransaction
      ?await deps.snapshotInSharedTransaction(tx)
      :await snapshotHostedSetupDatabase(transactionBoundConnection(tx))
    await deps.afterFingerprintCapturedInSharedSnapshot?.()
    // The privileged fingerprint uses row_security=off. Candidate3 tenant
    // probes must restore it before SET LOCAL ROLE neuvetra_runtime.
    await tx.exec('set local row_security=on')
    const restored=deps.captureStateInSharedTransaction
      ?await deps.captureStateInSharedTransaction(tx,actors)
      :await captureState(tx,actors)
    const identity=(await tx.query<{database:string;address:string;port:number;version:string}>("select current_database() database,host(inet_server_addr()) address,inet_server_port() port,current_setting('server_version_num') version")).rows[0]
    refuse(!!identity,'LOCAL_CLONE_IDENTITY_REFUSED')
    return {restored,local,identity}
  })
}
function validateInput(input:FingerprintDerivationInput){
  refuse(input?.profile===FINGERPRINT_DERIVATION_INPUT_PROFILE&&input.projectRef===PROJECT&&input.targetProfile===HOSTED_SETUP_PROFILE&&input.schemaVersion===HOSTED_SETUP_FROM_SCHEMA,'INPUT_BOUNDARY_REFUSED')
  refuse(input.expectedExternalDefaultAclCount===REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT&&DIGEST.test(input.expectedExternalDefaultAclsSha256),'EXTERNAL_DEFAULT_ACL_PIN_REQUIRED')
  pinned(input.sourceArchive,'SOURCE_ARCHIVE',512*1024*1024)
}

export async function deriveExpectedHostedSetupFingerprint(
  db:WorkspaceConnection,input:FingerprintDerivationInput,deps:FingerprintDerivationDependencies={},
):Promise<HostedSetupFingerprintDerivation>{
  validateInput(input)
  const snapshot=exactJson<Snapshot>(input.sourceSnapshot,'SOURCE_SNAPSHOT','compact')
  const receipt=exactJson<Receipt>(input.sourceReceipt,'SOURCE_RECEIPT','pretty-line')
  const restoreResult=exactJson<HostedSetupRestoreResult>(input.restoreResult,'RESTORE_RESULT','pretty-line')
  validateSnapshot(snapshot);validateReceipt(receipt);validateRestoreResult(restoreResult)
  refuse(input.sourceSnapshot.sha256===receipt.snapshotSha256,'SOURCE_SNAPSHOT_RECEIPT_MISMATCH')
  refuse(input.sourceArchive.sha256===receipt.archiveSha256,'SOURCE_ARCHIVE_RECEIPT_MISMATCH')
  refuse(restoreResult.sourceReceiptSha256===input.sourceReceipt.sha256,'RESTORE_RECEIPT_PIN_MISMATCH')
  refuse(restoreResult.sourceStateSha256===receipt.stateSha256&&receipt.stateSha256===recoveryHash(snapshot.state),'SOURCE_STATE_BINDING_MISMATCH')
  let dump:Buffer|undefined
  try{dump=validateBundle(snapshot,receipt)}
  finally{dump?.fill(0)}

  const sourceDefaultAcls=defaultAclRows(snapshot.state.inventory.defaultAcls,'SOURCE_DEFAULT_ACL_REFUSED')
  const sourceAppAcls=appDefaultAcls(sourceDefaultAcls)
  const sourceExternalAcls=externalDefaultAcls(sourceDefaultAcls)
  refuse(sourceExternalAcls.length===REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT,'EXTERNAL_DEFAULT_ACL_COUNT_CHANGED')
  refuse(fingerprintHash(sourceExternalAcls)===input.expectedExternalDefaultAclsSha256,'EXTERNAL_DEFAULT_ACL_PIN_CHANGED')

  const coherent=await captureCoherentClone(db,snapshot.auth.actors,deps)
  const {restored,local,identity}=coherent
  assertPreserved(snapshot.state,restored)
  refuse(recoveryHash(restored)===restoreResult.restoredStateSha256,'RESTORED_STATE_RESULT_MISMATCH')
  refuse(restored.inventory.defaultAcls.every((row:any)=>row.schema==='neuvetra'||row.schema==='*'),'LOCAL_EXTERNAL_DEFAULT_ACL_REFUSED')
  refuse(fingerprintHash(restored.inventory.roles)===fingerprintHash(snapshot.state.inventory.roles)&&fingerprintHash(restored.inventory.memberships)===fingerprintHash(snapshot.state.inventory.memberships),'ROLE_MEMBERSHIP_CHANGED')
  refuse(fingerprintHash(restored.inventory.defaultAcls)===fingerprintHash(sourceAppAcls),'APPLICATION_DEFAULT_ACL_CHANGED')
  refuse(fingerprintHash(sequenceStatesFromRecovery(restored))===fingerprintHash(sequenceStatesFromRecovery(snapshot.state)),'SEQUENCE_STATE_CHANGED')

  refuse(identity.database===restoreResult.database&&identity.address==='127.0.0.1'&&Number.isInteger(identity.port)&&identity.port>0&&identity.port<=65535&&Number(identity.version)>=170000&&Number(identity.version)<180000,'LOCAL_CLONE_IDENTITY_REFUSED')

  const manifest=await(deps.migrationManifest??readMigrationManifest)()
  refuse(manifest.length>=HOSTED_SETUP_FROM_SCHEMA&&manifest.slice(0,HOSTED_SETUP_FROM_SCHEMA).every(row=>typeof row.name==='string'&&DIGEST.test(row.sha256)),'SCHEMA22_MANIFEST_REFUSED')
  refuse(local.profile==='neuvetra.hosted-setup.database-fingerprint.v1'&&local.projectRef===PROJECT&&local.targetProfile===HOSTED_SETUP_PROFILE&&local.schemaVersion===HOSTED_SETUP_FROM_SCHEMA,'SCHEMA22_TARGET_REFUSED')
  refuse(local.receipts.length===HOSTED_SETUP_FROM_SCHEMA&&local.receipts.every((row,index)=>row.name===manifest[index]?.name&&row.sha256===manifest[index]?.sha256),'SCHEMA22_RECEIPTS_CHANGED')
  refuse(fingerprintHash(tableRows(local))===fingerprintHash(tableRows(restored.inventory)),'LOSSLESS_APPLICATION_ROWS_CHANGED')
  refuse(fingerprintHash(local.catalog.roles)===fingerprintHash(restored.inventory.roles)&&fingerprintHash(local.catalog.memberships)===fingerprintHash(restored.inventory.memberships),'FINGERPRINT_ROLE_MEMBERSHIP_CHANGED')
  refuse(fingerprintHash(local.catalog.defaultAcls)===fingerprintHash(restored.inventory.defaultAcls),'FINGERPRINT_APPLICATION_DEFAULT_ACL_CHANGED')
  refuse(fingerprintHash(sequenceStatesFromFingerprint(local))===fingerprintHash(sequenceStatesFromRecovery(restored)),'FINGERPRINT_SEQUENCE_STATE_CHANGED')

  const expected=structuredClone(local)
  expected.catalog.defaultAcls=structuredClone(sourceDefaultAcls)
  return {
    profile:FINGERPRINT_DERIVATION_PROFILE,projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:HOSTED_SETUP_FROM_SCHEMA,
    sourceSnapshotSha256:receipt.snapshotSha256,sourceReceiptSha256:input.sourceReceipt.sha256,sourceArchiveSha256:receipt.archiveSha256,
    sourceStateSha256:receipt.stateSha256,restoreResultSha256:input.restoreResult.sha256,restoredStateSha256:restoreResult.restoredStateSha256,
    sourceExternalDefaultAclsSha256:input.expectedExternalDefaultAclsSha256,sourceExternalDefaultAclCount:REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT,
    expectedDatabaseFingerprintSha256:fingerprintSha256(expected),rowEncoding:'postgres-jsonb-text.v1',
    exactApplicationRowsPreserved:true,applicationCatalogEquivalent:true,roleMembershipEquivalent:true,sequenceStateEquivalent:true,tenantControlsVerified:true,
    sourceCurrentnessObserved:false,liveHostedPreflightRequired:true,independentReviewRequired:true,upgradeAuthorized:false,
  }
}
