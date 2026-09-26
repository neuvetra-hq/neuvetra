/**
 * Inert candidate for the one-time hosted schema-22 to schema-23 upgrade.
 *
 * Importing this module performs no I/O. A launcher must supply reviewed
 * evidence, the private artifact SQL lock, a sequence fence and maintenance-stop
 * observations. No retry is authorized by any outcome from this module.
 */
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {pinStagingMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {ARTIFACT_PROFILE,ARTIFACT_SOURCE_PROFILE,type ArtifactSourceBinding,type lockHostedSetupArtifactSql}from'./hosted-setup-artifact-source'
import {dirname,isAbsolute,relative,resolve,sep}from'node:path'
import {fileURLToPath}from'node:url'
import {
 HOSTED_SETUP_FROM_SCHEMA,HOSTED_SETUP_MIGRATION,HOSTED_SETUP_PROFILE,NEW_SETUP_TABLES,
 HOSTED_SETUP_PROJECT,HOSTED_SETUP_TO_SCHEMA,canonical,check,exclusiveUpgradeJournal,fingerprintSha256,
 hash,sha256,snapshotHostedSetupDatabaseInTransaction,verifyPostcommitPreservation,
 type AcceptedRestoreBinding,type DurableJournal,type HostedSetupFingerprint,
 type HostedSetupUpgradeInput,type PinnedArtifact,type UpgradeMigration,
}from './hosted-setup-upgrade'

export const HOSTED_SETUP_TRANSACTIONAL_PROFILE='neuvetra.hosted-setup.artifact-transactional-upgrade.v2'
export const HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE='neuvetra.hosted-setup.reviewed-execution-artifact-binding.v1'
export const HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE='neuvetra.hosted-setup.reviewed-maintenance-stop-binding.v2'
export const HOSTED_SETUP_LOCK_TIMEOUT_MS=30_000
export const HOSTED_SETUP_TRANSACTION_TIMEOUT_MS=180_000
export const HOSTED_SETUP_MAINTENANCE_TARGET=Object.freeze({
 projectId:'119f3652-9d84-4d16-983c-1a17c0fd1aaa',environmentId:'6642d65a-15a2-41e9-b25e-b7b01990aa28',
 serviceId:'f43abcf9-72f0-4034-828a-8d83ca26b0db',region:'us-east4-eqdc4a',
})
const NAME=/^[a-z][a-z0-9_]*$/
const DIGEST=/^[0-9a-f]{64}$/
const DEPLOYMENT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const IMAGE_DIGEST=/^sha256:[0-9a-f]{64}$/
const REPOSITORY_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..')

export type MaintenanceStopPhase='before_transaction'|'under_lock_before_migration'|'under_lock_before_commit'
export interface HostedSetupSequenceFenceContext{
 projectRef:typeof HOSTED_SETUP_PROJECT
 sequenceNames:ReadonlyArray<string>
 deadlineAtMs:number
}
export interface ReviewedMaintenanceStopBinding{
 profile:typeof HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE
 maintenanceProfile:'neuvetra.hosted-setup.maintenance-stop.v2'
 projectRef:typeof HOSTED_SETUP_PROJECT;targetProfile:typeof HOSTED_SETUP_PROFILE
 projectId:typeof HOSTED_SETUP_MAINTENANCE_TARGET.projectId
 environmentId:typeof HOSTED_SETUP_MAINTENANCE_TARGET.environmentId
 serviceId:typeof HOSTED_SETUP_MAINTENANCE_TARGET.serviceId
 deploymentId:string
 deployedCommit:string
 imageDigest:string
 region:typeof HOSTED_SETUP_MAINTENANCE_TARGET.region
 replicas:0;availabilityStopObserved:true;databaseWritersExcluded:false
 configurationVersion:string;stopReceiptSha256:string;stopReviewSha256:string
 operatorId:string;independentReviewerId:string;materialFindingsOpen:0
}
export interface ReviewedExecutionArtifactBinding{
 profile:typeof HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE;projectRef:typeof HOSTED_SETUP_PROJECT
 reviewedProductHead:string;remoteHead:string;requiredChecksPassed:true
 publicationReceiptSha256:string;publicationReviewSha256:string;artifactPublicationSha256:string
 executionArtifactProfile:typeof ARTIFACT_PROFILE;artifactSourceProfile:typeof ARTIFACT_SOURCE_PROFILE
 artifactTrustBoundary:'trusted-operator-host';artifactClaim:'verified-at-rest-artifact-and-private-sql-only'
 executionArtifactSha256:string;migrationManifestSha256:string
 runtimeLoadedCodeAttested:false;launchAuthorized:false
 operatorId:string;independentReviewerId:string;materialFindingsOpen:0
}
/** Kept structurally identical to the accepted lock; drift is a compile error. */
export type HostedSetupArtifactSqlLock=Awaited<ReturnType<typeof lockHostedSetupArtifactSql>>
export interface HostedSetupTransactionalDependencies{
 verifyAcceptedRestore(receipt:PinnedArtifact,review:PinnedArtifact,derivation:PinnedArtifact,derivationReview:PinnedArtifact):AcceptedRestoreBinding
 /** Authenticates publication evidence and binds it to the at-rest execution artifact identity. */
 verifyReviewedExecutionArtifact(receipt:PinnedArtifact,review:PinnedArtifact):ReviewedExecutionArtifactBinding
 currentProductHead():Promise<string>|string
 /** Must synchronously authenticate the pinned availability-stop receipt and its independent review. */
 verifyReviewedMaintenanceStop(receipt:PinnedArtifact,review:PinnedArtifact):ReviewedMaintenanceStopBinding
 /** Return serialized JSON `true` after freshly observing this exact stopped target. */
 observeMaintenanceStopped(binding:Readonly<ReviewedMaintenanceStopBinding>,phase:MaintenanceStopPhase):Promise<string>|string
 /** Required sequence fence. It must hold for the entire operation callback. */
 withSequenceFence<T>(tx:WorkspaceSql,context:Readonly<HostedSetupSequenceFenceContext>,operation:()=>Promise<T>):Promise<T>
 /** One cohesive, single-use lock returned by lockHostedSetupArtifactSql(). */
 artifactSqlLock:HostedSetupArtifactSqlLock
 openJournal?(path:string):Promise<DurableJournal>
 now?():string
}
export interface HostedSetupTransactionalReceipt{
 status:'hosted_setup_schema23_transaction_committed_and_observed'
 profile:typeof HOSTED_SETUP_TRANSACTIONAL_PROFILE
 projectRef:typeof HOSTED_SETUP_PROJECT
 reviewedProductHead:string
 executionArtifactSha256:string
 executionArtifactProfile:typeof ARTIFACT_PROFILE
 artifactSourceProfile:typeof ARTIFACT_SOURCE_PROFILE
 artifactTrustBoundary:'trusted-operator-host'
 artifactClaim:'verified-at-rest-artifact-and-private-sql-only'
 runtimeLoadedCodeAttested:false
 launchAuthorized:false
 schemaVersion:23
 migrationSha256:string
 beforeFingerprintSha256:string
 afterFingerprintSha256:string
 onePhysicalTransaction:true
 accessExclusiveTables:ReadonlyArray<string>
 sequenceFenceHeld:true
 maintenanceStopObserved:true
}
export interface HostedSetupUncertainCommitReconciliation{
 profile:'neuvetra.hosted-setup.uncertain-commit-reconciliation.v1'
 projectRef:typeof HOSTED_SETUP_PROJECT
 expectedMigrationSha256:string
 /** Must establish that the original server-side transaction has resolved. */
 observeOriginalTransactionResolved():Promise<true>|true
}

function isThenable(value:unknown){return value!==null&&(typeof value==='object'||typeof value==='function')&&typeof(value as Promise<unknown>).then==='function'}
function validArtifact(value:PinnedArtifact,label:string){
 check(value&&typeof value.bytes==='string'&&Buffer.byteLength(value.bytes)>0&&Buffer.byteLength(value.bytes)<=128*1024*1024,label+' bytes required')
 check(DIGEST.test(value.sha256)&&sha256(value.bytes)===value.sha256,label+' digest mismatch')
}
function privateArtifact(value:PinnedArtifact){return Object.freeze({bytes:value.bytes,sha256:value.sha256})}
function callbackArtifact(value:PinnedArtifact){return Object.freeze({bytes:value.bytes,sha256:value.sha256})}
function privateInput(source:HostedSetupUpgradeInput):HostedSetupUpgradeInput{
 const sourceJournalPath=source?.journalPath
 check(typeof sourceJournalPath==='string'&&isAbsolute(sourceJournalPath),'Absolute external journal path required')
 return Object.freeze({profile:source.profile,projectRef:source.projectRef,targetProfile:source.targetProfile,reviewedProductHead:source.reviewedProductHead,
  operatorId:source.operatorId,restoreReviewerId:source.restoreReviewerId,publicationReviewerId:source.publicationReviewerId,stopReviewerId:source.stopReviewerId,journalPath:resolve(sourceJournalPath),
  restoreReceipt:privateArtifact(source.restoreReceipt),restoreReview:privateArtifact(source.restoreReview),fingerprintDerivation:privateArtifact(source.fingerprintDerivation),fingerprintDerivationReview:privateArtifact(source.fingerprintDerivationReview),
  publicationReceipt:privateArtifact(source.publicationReceipt),publicationReview:privateArtifact(source.publicationReview),stopReceipt:privateArtifact(source.stopReceipt),stopReview:privateArtifact(source.stopReview)})
}
function privateScalars<T extends object>(value:T,fields:ReadonlyArray<keyof T>,label:string):Readonly<T>{
 check(!isThenable(value)&&value!==null&&typeof value==='object'&&!Array.isArray(value),label+' synchronous object required')
 const copy:Record<string,unknown>={}
 for(const field of fields){
  check(Object.prototype.hasOwnProperty.call(value,field),label+' field missing')
  const scalar=value[field];check(typeof scalar==='string'||typeof scalar==='number'||typeof scalar==='boolean',label+' scalar required')
  copy[String(field)]=scalar
 }
 return Object.freeze(copy)as Readonly<T>
}
function privateExactScalars<T extends object>(value:T,fields:ReadonlyArray<keyof T>,label:string):Readonly<T>{
 check(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===fields.map(String).sort().join('|'),label+' exact fields required')
 return privateScalars(value,fields,label)
}
const privateRestore=(value:AcceptedRestoreBinding)=>privateScalars(value,['profile','projectRef','targetProfile','schemaVersion','restoreReceiptSha256','restoreReviewSha256','fingerprintDerivationSha256','fingerprintDerivationReviewSha256','sourceSnapshotSha256','sourceArchiveSha256','sourceStateSha256','restoredStateSha256','expectedDatabaseFingerprintSha256','databaseFingerprintIndependentlyDerived','exactApplicationPreserved','tenantControlsVerified','operatorId','independentReviewerId','materialFindingsOpen'],'Accepted restore binding')
const privateProduct=(value:ReviewedExecutionArtifactBinding)=>privateExactScalars(value,['profile','projectRef','reviewedProductHead','remoteHead','requiredChecksPassed','publicationReceiptSha256','publicationReviewSha256','artifactPublicationSha256','executionArtifactProfile','artifactSourceProfile','artifactTrustBoundary','artifactClaim','executionArtifactSha256','migrationManifestSha256','runtimeLoadedCodeAttested','launchAuthorized','operatorId','independentReviewerId','materialFindingsOpen'],'Reviewed execution artifact binding')
const privateArtifactSource=(value:ArtifactSourceBinding)=>privateExactScalars(value,['profile','reviewedProductHead','executionArtifactSha256','migrationManifestSha256'],'Artifact SQL source binding')
const privateMaintenance=(value:ReviewedMaintenanceStopBinding)=>privateScalars(value,['profile','maintenanceProfile','projectRef','targetProfile','projectId','environmentId','serviceId','deploymentId','deployedCommit','imageDigest','region','replicas','availabilityStopObserved','databaseWritersExcluded','configurationVersion','stopReceiptSha256','stopReviewSha256','operatorId','independentReviewerId','materialFindingsOpen'],'Reviewed maintenance binding')
function outsideRepository(path:string){const child=relative(REPOSITORY_ROOT,path);return child==='..'||child.startsWith('..'+sep)||isAbsolute(child)}
function validateInput(input:HostedSetupUpgradeInput){
 check(input?.profile==='neuvetra.hosted-setup.upgrade-input.v1'&&input.projectRef===HOSTED_SETUP_PROJECT&&input.targetProfile===HOSTED_SETUP_PROFILE,'Fixed hosted setup target required')
 check(/^[0-9a-f]{40}$/.test(input.reviewedProductHead),'Exact reviewed product head required')
 check(isAbsolute(input.journalPath)&&outsideRepository(input.journalPath),'Absolute external journal path required')
 check(typeof input.operatorId==='string'&&input.operatorId.trim().length>0,'Operator identity required')
 check([input.restoreReviewerId,input.publicationReviewerId,input.stopReviewerId].every(id=>typeof id==='string'&&id.trim().length>0&&id!==input.operatorId),'Separate reviewer identities required')
 for(const [label,value]of[['restore receipt',input.restoreReceipt],['restore review',input.restoreReview],['fingerprint derivation',input.fingerprintDerivation],['fingerprint derivation review',input.fingerprintDerivationReview],['publication receipt',input.publicationReceipt],['publication review',input.publicationReview],['stop receipt',input.stopReceipt],['stop review',input.stopReview]]as const)validArtifact(value,label)
}
function validateRestore(value:AcceptedRestoreBinding,input:HostedSetupUpgradeInput){
 check(value.profile==='neuvetra.hosted-setup.accepted-restore-binding.v1'&&value.projectRef===HOSTED_SETUP_PROJECT&&value.targetProfile===HOSTED_SETUP_PROFILE&&value.schemaVersion===22,'Accepted schema-22 restore required')
 check(value.restoreReceiptSha256===input.restoreReceipt.sha256&&value.restoreReviewSha256===input.restoreReview.sha256&&value.fingerprintDerivationSha256===input.fingerprintDerivation.sha256&&value.fingerprintDerivationReviewSha256===input.fingerprintDerivationReview.sha256,'Accepted restore artifacts not bound')
 check([value.sourceSnapshotSha256,value.sourceArchiveSha256,value.sourceStateSha256,value.restoredStateSha256,value.expectedDatabaseFingerprintSha256].every(value=>DIGEST.test(value)),'Accepted restore digests required')
 check(value.databaseFingerprintIndependentlyDerived===true&&value.exactApplicationPreserved===true&&value.tenantControlsVerified===true&&value.materialFindingsOpen===0,'Accepted restore preservation required')
 check(value.operatorId===input.operatorId&&value.independentReviewerId===input.restoreReviewerId&&value.operatorId!==value.independentReviewerId,'Restore reviewer identity mismatch')
}
function validateProduct(value:ReviewedExecutionArtifactBinding,input:HostedSetupUpgradeInput,currentHead:string,source:Readonly<ArtifactSourceBinding>,manifestSha256:string){
 check(value.profile===HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE&&value.projectRef===HOSTED_SETUP_PROJECT,'Reviewed execution artifact binding required')
 check(value.reviewedProductHead===input.reviewedProductHead&&value.remoteHead===input.reviewedProductHead&&currentHead===input.reviewedProductHead,'Current, reviewed and remote heads differ')
 check(value.requiredChecksPassed===true&&value.publicationReceiptSha256===input.publicationReceipt.sha256&&value.publicationReviewSha256===input.publicationReview.sha256&&value.artifactPublicationSha256===input.publicationReceipt.sha256,'Publication evidence not bound')
 check(value.executionArtifactProfile===ARTIFACT_PROFILE&&value.artifactSourceProfile===ARTIFACT_SOURCE_PROFILE&&value.artifactTrustBoundary==='trusted-operator-host'&&value.artifactClaim==='verified-at-rest-artifact-and-private-sql-only'&&value.runtimeLoadedCodeAttested===false&&value.launchAuthorized===false,'At-rest artifact claim boundary required')
 check(source.profile===ARTIFACT_SOURCE_PROFILE&&source.reviewedProductHead===input.reviewedProductHead&&source.migrationManifestSha256===manifestSha256,'Private artifact SQL binding changed')
 check(DIGEST.test(value.executionArtifactSha256)&&value.executionArtifactSha256===source.executionArtifactSha256&&value.migrationManifestSha256===manifestSha256,'Reviewed execution artifact changed')
 check(value.operatorId===input.operatorId&&value.independentReviewerId===input.publicationReviewerId&&value.operatorId!==value.independentReviewerId&&value.materialFindingsOpen===0,'Publication reviewer identity mismatch')
}
function validateMaintenance(value:Readonly<ReviewedMaintenanceStopBinding>,input:HostedSetupUpgradeInput){
 check(value.profile===HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE&&value.maintenanceProfile==='neuvetra.hosted-setup.maintenance-stop.v2'&&value.projectRef===HOSTED_SETUP_PROJECT&&value.targetProfile===HOSTED_SETUP_PROFILE,'Reviewed availability stop required')
 check(value.projectId===HOSTED_SETUP_MAINTENANCE_TARGET.projectId&&value.environmentId===HOSTED_SETUP_MAINTENANCE_TARGET.environmentId&&value.serviceId===HOSTED_SETUP_MAINTENANCE_TARGET.serviceId&&value.region===HOSTED_SETUP_MAINTENANCE_TARGET.region,'Maintenance target mismatch')
 check(DEPLOYMENT_ID.test(value.deploymentId)&&value.deployedCommit===input.reviewedProductHead&&IMAGE_DIGEST.test(value.imageDigest),'Reviewed deployment identity mismatch')
 check(value.replicas===0&&value.availabilityStopObserved===true&&value.databaseWritersExcluded===false&&typeof value.configurationVersion==='string'&&value.configurationVersion.length>0&&value.configurationVersion.length<=200,'Availability-only stop evidence required')
 check(value.stopReceiptSha256===input.stopReceipt.sha256&&value.stopReviewSha256===input.stopReview.sha256,'Maintenance evidence not bound')
 check(value.operatorId===input.operatorId&&value.independentReviewerId===input.stopReviewerId&&value.operatorId!==value.independentReviewerId&&value.materialFindingsOpen===0,'Maintenance reviewer identity mismatch')
}
async function observeStop(observe:HostedSetupTransactionalDependencies['observeMaintenanceStopped'],binding:Readonly<ReviewedMaintenanceStopBinding>,phase:MaintenanceStopPhase){
 const encoded=await observe(Object.freeze({...binding}),phase)
 check(typeof encoded==='string','Serialized maintenance-stop observation required')
 let result:unknown;try{result=JSON.parse(encoded)}catch{throw Error('Serialized maintenance-stop observation required')}
 check(result===true,'Maintenance-stop observation refused')
}
async function relations(tx:WorkspaceSql){
 const rows=(await tx.query<{name:string;kind:'r'|'S'}>("select c.relname name,c.relkind kind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind in('r','S') order by c.relkind,c.relname")).rows
 check(rows.length>0&&rows.every(row=>NAME.test(row.name)&&(row.kind==='r'||row.kind==='S')),'Unsafe or empty Neuvetra relation inventory')
 check(new Set(rows.map(row=>`${row.kind}:${row.name}`)).size===rows.length,'Duplicate Neuvetra relation inventory')
 return Object.freeze({tables:Object.freeze(rows.filter(row=>row.kind==='r').map(row=>row.name).sort()),sequences:Object.freeze(rows.filter(row=>row.kind==='S').map(row=>row.name).sort())})
}
function journalEvent<T extends Record<string,unknown>>(value:T):Readonly<T>{return Object.freeze(value)}
function same(left:unknown,right:unknown){return hash(left)===hash(right)}
function sameTransactionConnection(tx:WorkspaceSql):WorkspaceConnection{
 let nested=false
 return Object.freeze({
  query:<T=Record<string,unknown>>(sql:string,params?:unknown[])=>tx.query<T>(sql,params),
  exec:(sql:string)=>tx.exec(sql),
  transaction:async<T>(operation:(nestedTx:WorkspaceSql)=>Promise<T>)=>{check(!nested,'Pinned migration requested more than one nested transaction');nested=true;return operation(tx)},
  close:async()=>{throw Error('Transaction-scoped connection cannot be closed')},
 })
}
function validateSchema22(value:HostedSetupFingerprint,manifest:ReadonlyArray<Readonly<UpgradeMigration>>){
 check(value.schemaVersion===HOSTED_SETUP_FROM_SCHEMA&&value.projectRef===HOSTED_SETUP_PROJECT&&value.targetProfile===HOSTED_SETUP_PROFILE,'Exact schema-22 target required')
 check(value.receipts.length===22&&value.receipts.every((row,index)=>row.name===manifest[index]?.name&&row.sha256===manifest[index]?.sha256),'Exact schema-22 receipts required')
}
type PrivateMigrationResult=Readonly<{schemaVersion:number;migrations:ReadonlyArray<Readonly<{name:string;sha256:string}>>}>
function privateMigrationResult(value:Awaited<ReturnType<HostedSetupArtifactSqlLock['migrate']>>):PrivateMigrationResult{
 check(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')==='migrations|schemaVersion','Pinned migration result exact fields required')
 check(value.schemaVersion===HOSTED_SETUP_TO_SCHEMA&&Array.isArray(value.migrations)&&value.migrations.length===HOSTED_SETUP_TO_SCHEMA,'Pinned migration result mismatch')
 const migrations=value.migrations.map(candidate=>{
  check(candidate!==null&&typeof candidate==='object'&&!Array.isArray(candidate)&&Object.keys(candidate).sort().join('|')==='name|sha256','Pinned migration row exact fields required')
  check(typeof candidate.name==='string'&&typeof candidate.sha256==='string'&&DIGEST.test(candidate.sha256),'Pinned migration row required')
  return Object.freeze({name:candidate.name,sha256:candidate.sha256})
 })
 check(migrations[22]?.name===HOSTED_SETUP_MIGRATION,'Pinned migration result mismatch')
 return Object.freeze({schemaVersion:value.schemaVersion,migrations:Object.freeze(migrations)})
}

export async function runHostedSetupTransactionalUpgrade(db:WorkspaceConnection,sourceInput:HostedSetupUpgradeInput,sourceDeps:HostedSetupTransactionalDependencies):Promise<HostedSetupTransactionalReceipt>{
 const input=privateInput(sourceInput)
 const deps=Object.freeze({...sourceDeps})
 validateInput(input)
 const verifyRestore=deps.verifyAcceptedRestore,verifyProduct=deps.verifyReviewedExecutionArtifact,verifyMaintenance=deps.verifyReviewedMaintenanceStop
 const currentProductHead=deps.currentProductHead,observeMaintenanceStopped=deps.observeMaintenanceStopped,withSequenceFence=deps.withSequenceFence
 const artifactSqlLock=deps.artifactSqlLock
 check(!isThenable(artifactSqlLock)&&artifactSqlLock!==null&&typeof artifactSqlLock==='object'&&!Array.isArray(artifactSqlLock),'Cohesive artifact SQL lock required')
 const artifactBinding=privateArtifactSource(artifactSqlLock.binding),migrationManifest=artifactSqlLock.migrationManifest,withArtifactSource=artifactSqlLock.withArtifactSource,migrate=artifactSqlLock.migrate
 check([verifyRestore,verifyProduct,verifyMaintenance,currentProductHead,migrationManifest,observeMaintenanceStopped,withSequenceFence,withArtifactSource,migrate].every(value=>typeof value==='function'),'Reviewed bindings, sequence fence, artifact SQL lock and maintenance observation are required')
 const restore=privateRestore(verifyRestore(callbackArtifact(input.restoreReceipt),callbackArtifact(input.restoreReview),callbackArtifact(input.fingerprintDerivation),callbackArtifact(input.fingerprintDerivationReview)));validateRestore(restore,input)
 const manifestCandidate=migrationManifest();check(!isThenable(manifestCandidate),'Migration manifest must be synchronous')
 const manifest=pinStagingMigrationManifest(manifestCandidate),manifestSha256=hash(manifest)
 const product=privateProduct(verifyProduct(callbackArtifact(input.publicationReceipt),callbackArtifact(input.publicationReview)))
 const maintenance=privateMaintenance(verifyMaintenance(callbackArtifact(input.stopReceipt),callbackArtifact(input.stopReview)));validateMaintenance(maintenance,input)
 const currentHead=await currentProductHead();check(typeof currentHead==='string','Serialized current product head required');validateProduct(product,input,currentHead,artifactBinding,manifestSha256)
 await observeStop(observeMaintenanceStopped,maintenance,'before_transaction')
 const journal=await(deps.openJournal??exclusiveUpgradeJournal)(input.journalPath),now=deps.now??(()=>new Date().toISOString())
 const appendCandidate=journal?.append,closeCandidate=journal?.close
 check(typeof appendCandidate==='function'&&typeof closeCandidate==='function','Durable journal methods required')
 const append=appendCandidate.bind(journal),close=closeCandidate.bind(journal)
 let migrationEntered=false,transactionCallbackReturned=false
 try{
  await append(journalEvent({status:'hosted_setup_transaction_reserved',createdAt:now(),profile:HOSTED_SETUP_TRANSACTIONAL_PROFILE,projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:input.reviewedProductHead,executionArtifactSha256:product.executionArtifactSha256,executionArtifactProfile:ARTIFACT_PROFILE,artifactSourceProfile:ARTIFACT_SOURCE_PROFILE,artifactTrustBoundary:'trusted-operator-host',artifactClaim:product.artifactClaim,runtimeLoadedCodeAttested:false,launchAuthorized:false,migrationManifestSha256:manifestSha256,expectedDatabaseFingerprintSha256:restore.expectedDatabaseFingerprintSha256,noAutomaticRetry:true}))
  const receipt=await db.transaction(async tx=>{
   const deadlineAtMs=Date.now()+HOSTED_SETUP_TRANSACTION_TIMEOUT_MS
   const beforeDeadline=()=>check(Date.now()<=deadlineAtMs,'Hosted setup transaction deadline exceeded')
   await tx.exec('set transaction isolation level read committed')
   await tx.query("select set_config('lock_timeout',$1,true),set_config('statement_timeout',$2,true),set_config('idle_in_transaction_session_timeout',$2,true),set_config('transaction_timeout',$2,true)",[String(HOSTED_SETUP_LOCK_TIMEOUT_MS),String(HOSTED_SETUP_TRANSACTION_TIMEOUT_MS)])
   const configured=(await tx.query<{milliseconds:string}>("select (extract(epoch from current_setting('transaction_timeout')::interval)*1000)::bigint::text milliseconds")).rows
   check(configured.length===1&&configured[0]?.milliseconds===String(HOSTED_SETUP_TRANSACTION_TIMEOUT_MS),'PostgreSQL transaction timeout was not applied')
   const initial=await relations(tx)
   check(initial.tables.includes('schema_migrations')&&initial.tables.includes('staging_target'),'Migration receipts and target tables must be locked')
   let fenceEntered=false
   const result=await withSequenceFence(tx,Object.freeze({projectRef:HOSTED_SETUP_PROJECT,sequenceNames:Object.freeze([...initial.sequences]),deadlineAtMs}),async()=>{
    check(!fenceEntered,'Sequence-fence operation may run once');fenceEntered=true;beforeDeadline()
    await tx.exec(`lock table ${initial.tables.map(name=>`neuvetra.\"${name}\"`).join(',')} in access exclusive mode`)
    const locked=await relations(tx);check(same(initial,locked),'Neuvetra relation inventory changed while acquiring locks')
    await observeStop(observeMaintenanceStopped,maintenance,'under_lock_before_migration')
    const before=await snapshotHostedSetupDatabaseInTransaction(tx);validateSchema22(before,manifest)
    check(fingerprintSha256(before)===restore.expectedDatabaseFingerprintSha256,'Locked schema-22 fingerprint differs from accepted restore')
    await append(journalEvent({status:'hosted_setup_schema22_locked_and_verified',createdAt:now(),databaseFingerprintSha256:fingerprintSha256(before),accessExclusiveTables:Object.freeze([...initial.tables]),sequenceNames:Object.freeze([...initial.sequences])}))
    let sourceOperationEntered=false
    const migrationCandidate=await withArtifactSource(artifactBinding,()=>{check(!sourceOperationEntered,'Pinned artifact source operation may run once');sourceOperationEntered=true;migrationEntered=true;return migrate(sameTransactionConnection(tx),HOSTED_SETUP_PROJECT)})
    const migrated=privateMigrationResult(migrationCandidate);check(migrated.migrations.every((row,index)=>row.name===manifest[index]?.name&&row.sha256===manifest[index]?.sha256),'Pinned migration digest mismatch')
    const after=await snapshotHostedSetupDatabaseInTransaction(tx);verifyPostcommitPreservation(before,after,manifest)
    const finalRelations=await relations(tx)
    check(same(finalRelations.sequences,locked.sequences)&&same(finalRelations.tables,[...locked.tables,...NEW_SETUP_TABLES].sort()),'Unexpected Neuvetra relation inventory before commit')
    await observeStop(observeMaintenanceStopped,maintenance,'under_lock_before_commit')
    beforeDeadline()
    const candidate:HostedSetupTransactionalReceipt=Object.freeze({status:'hosted_setup_schema23_transaction_committed_and_observed',profile:HOSTED_SETUP_TRANSACTIONAL_PROFILE,projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:input.reviewedProductHead,executionArtifactSha256:product.executionArtifactSha256,executionArtifactProfile:ARTIFACT_PROFILE,artifactSourceProfile:ARTIFACT_SOURCE_PROFILE,artifactTrustBoundary:'trusted-operator-host',artifactClaim:product.artifactClaim,runtimeLoadedCodeAttested:false,launchAuthorized:false,schemaVersion:23,migrationSha256:manifest[22]!.sha256,beforeFingerprintSha256:fingerprintSha256(before),afterFingerprintSha256:fingerprintSha256(after),onePhysicalTransaction:true,accessExclusiveTables:Object.freeze([...initial.tables]),sequenceFenceHeld:true,maintenanceStopObserved:true})
    const {status:_candidateStatus,...candidateEvidence}=candidate
    await append(journalEvent({status:'hosted_setup_transaction_verified_pending_commit',createdAt:now(),...candidateEvidence}))
    return candidate
   })
   check(fenceEntered,'Sequence fence did not enter its operation')
   transactionCallbackReturned=true
   return result
  })
  const {status:_receiptStatus,...receiptEvidence}=receipt
  await append(journalEvent({status:'hosted_setup_schema23_commit_resolved',createdAt:now(),...receiptEvidence,noAutomaticRetry:true}))
  return receipt
 }catch{
  const status=migrationEntered?'hosted_setup_transaction_outcome_unknown_do_not_retry':'hosted_setup_transaction_refused_journal_consumed'
  try{await append(journalEvent({status,createdAt:now(),projectRef:HOSTED_SETUP_PROJECT,transactionCallbackReturned,noAutomaticRetry:true,reconcileBeforeAnyNewDecision:migrationEntered}))}catch{}
  throw Error(status)
 }finally{try{await close()}catch{}}
}

/**
 * Read-only resolution contract for an uncertain COMMIT. It never retries.
 * An absent receipt is meaningful only after the original server transaction
 * is independently observed as resolved.
 */
export async function reconcileHostedSetupTransactionalCommit(db:WorkspaceConnection,source:HostedSetupUncertainCommitReconciliation){
 const profile=source?.profile,projectRef=source?.projectRef,expectedMigrationSha256=source?.expectedMigrationSha256
 const observeOriginalTransactionResolved=source?.observeOriginalTransactionResolved,transaction=db.transaction.bind(db)
 check(profile==='neuvetra.hosted-setup.uncertain-commit-reconciliation.v1'&&projectRef===HOSTED_SETUP_PROJECT&&typeof expectedMigrationSha256==='string'&&DIGEST.test(expectedMigrationSha256)&&typeof observeOriginalTransactionResolved==='function','Exact uncertain-commit reconciliation binding required')
 check((await observeOriginalTransactionResolved())===true,'Original transaction resolution must be observed before reading the commit marker')
 const rows=await transaction(async tx=>{
  const target=(await tx.query<{project_ref:string;profile:string}>('select project_ref,profile from neuvetra.staging_target')).rows
  check(target.length===1&&target[0]?.project_ref===HOSTED_SETUP_PROJECT&&target[0]?.profile===HOSTED_SETUP_PROFILE,'Reconciliation target identity mismatch')
  return(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations where name=$1',[HOSTED_SETUP_MIGRATION])).rows
 })
 check(rows.length<=1,'Non-unique schema migration marker')
 if(rows.length===0)return Object.freeze({status:'hosted_setup_no_commit_marker_after_resolution' as const,noAutomaticRetry:true})
 check(rows[0]!.name===HOSTED_SETUP_MIGRATION&&rows[0]!.sha256===expectedMigrationSha256,'Schema migration commit marker mismatch')
 return Object.freeze({status:'hosted_setup_commit_marker_present_after_resolution' as const,noAutomaticRetry:true})
}
