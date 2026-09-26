/** Pure evidence verifier. No I/O, DB connection, provider operation or launch authority.
 * Trust comes from independently authenticated external policy pins on a trusted
 * operator host, never from the submitted JSON. The new review envelopes must be
 * issued by actual independent reviewers; no legacy Markdown-to-approval conversion.
 */
import {sha256,HOSTED_SETUP_PROJECT,HOSTED_SETUP_PROFILE,type AcceptedRestoreBinding,type PinnedArtifact} from './hosted-setup-upgrade'
import {PROFILE,hash,validateBundle,assertPreserved,type Snapshot,type Receipt,type State} from './hosted-setup-restore-core'
import {REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT} from './hosted-setup-fingerprint-derivation'

export const FRESH_RESTORE_POLICY_PROFILE='neuvetra.hosted-setup.fresh-restore-policy.v1' as const
export const FRESH_RESTORE_OBSERVATION_PROFILE='neuvetra.hosted-setup.fresh-restore-observation.v1' as const
export const FRESH_RESTORE_REVIEW_PROFILE='neuvetra.hosted-setup.fresh-restore-review.v1' as const
const SHA=/^[a-f0-9]{64}$/
const TEXT_LIMIT=256*1024*1024,SMALL_LIMIT=1024*1024,ARCHIVE_LIMIT=512*1024*1024
const ARTIFACTS=['sourceReceipt','sourceArchive','sourceSnapshot','restoredState','restoreResult','restoreObservation','fingerprintDerivation'] as const
export type FreshRestoreArtifactName=typeof ARTIFACTS[number]
export interface FreshRestoreEvidence {
 sourceReceipt:PinnedArtifact;sourceArchive:{bytes:Uint8Array;sha256:string};sourceSnapshot:PinnedArtifact
 restoredState:PinnedArtifact;restoreResult:PinnedArtifact;restoreObservation:PinnedArtifact
 fingerprintDerivation:PinnedArtifact;restoreReview:PinnedArtifact;fingerprintReview:PinnedArtifact
}
export interface FreshRestorePolicy {
 profile:typeof FRESH_RESTORE_POLICY_PROFILE;projectRef:typeof HOSTED_SETUP_PROJECT;targetProfile:typeof HOSTED_SETUP_PROFILE
 /** Externally selected refresh cutoff; never derived from the incoming evidence. */
 notBeforeUtc:string;maxAgeMs:number;operatorId:string;restoreReviewerId:string;fingerprintReviewerId:string
 artifactSha256:Record<FreshRestoreArtifactName,string>
 restoreReviewSha256:string;fingerprintReviewSha256:string
 sourceStateSha256:string;restoredStateSha256:string;expectedDatabaseFingerprintSha256:string
 sourceExternalDefaultAclsSha256:string;sourceExternalDefaultAclCount:typeof REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT
}
export interface FreshRestoreReview {
 profile:typeof FRESH_RESTORE_REVIEW_PROFILE;stage:'restore'|'fingerprint';verdict:'accepted'
 operatorId:string;reviewerId:string;reviewedUtc:string;subjectSha256:string;materialFindingsOpen:0
 /** Exact stage-specific true values; unknown, null and omission are not acceptance. */
 checks:Record<string,true>
 sourceCurrentnessObserved:false;liveHostedPreflightRequired:true;upgradeAuthorized:false;providerRecoveryExcluded:true
}
function check(ok:unknown,code:string):asserts ok{if(!ok)throw Error('HS_FRESH_RESTORE_'+code)}
function record(v:unknown):Record<string,unknown>{check(v!==null&&typeof v==='object'&&!Array.isArray(v),'OBJECT_REQUIRED');return v as Record<string,unknown>}
function keys(v:Record<string,unknown>,expected:readonly string[]){check(Object.keys(v).sort().join('|')===[...expected].sort().join('|'),'SHAPE_REFUSED')}
function digest(v:unknown){check(typeof v==='string'&&SHA.test(v),'DIGEST_REQUIRED');return v}
function id(v:unknown){check(typeof v==='string'&&v.length>0&&v.length<=256&&v.trim()===v&&!/[\x00-\x1f\x7f]/.test(v),'IDENTITY_REQUIRED');return v}
function utc(v:unknown){const value=id(v),n=Date.parse(value);check(Number.isFinite(n)&&new Date(n).toISOString()===value,'TIME_REFUSED');return n}
/** Policy is private data, not a caller-controlled getter/toJSON program. */
function plain(v:unknown,depth=0):unknown{
 check(depth<32,'POLICY_DEPTH_REFUSED')
 if(v===null||typeof v==='string'||typeof v==='number'||typeof v==='boolean')return v
 const r=record(v),p=Object.getPrototypeOf(r);check(p===Object.prototype||p===null,'POLICY_OBJECT_REFUSED')
 const descriptors=Object.getOwnPropertyDescriptors(r),out:Record<string,unknown>=Object.create(null)
 check(Reflect.ownKeys(r).length===Object.keys(descriptors).length,'POLICY_SYMBOL_REFUSED')
 for(const [name,d]of Object.entries(descriptors)){check('value'in d&&d.enumerable,'POLICY_ACCESSOR_REFUSED');out[name]=plain(d.value,depth+1)}
 return out
}
function policyCopy(source:FreshRestorePolicy){
 const p=record(plain(source));keys(p,['profile','projectRef','targetProfile','notBeforeUtc','maxAgeMs','operatorId','restoreReviewerId','fingerprintReviewerId','artifactSha256','restoreReviewSha256','fingerprintReviewSha256','sourceStateSha256','restoredStateSha256','expectedDatabaseFingerprintSha256','sourceExternalDefaultAclsSha256','sourceExternalDefaultAclCount'])
 check(p.profile===FRESH_RESTORE_POLICY_PROFILE&&p.projectRef===HOSTED_SETUP_PROJECT&&p.targetProfile===HOSTED_SETUP_PROFILE,'POLICY_TARGET_REFUSED')
 utc(p.notBeforeUtc);check(Number.isSafeInteger(p.maxAgeMs)&&(p.maxAgeMs as number)>0&&(p.maxAgeMs as number)<=86_400_000,'MAX_AGE_REFUSED')
 const operator=id(p.operatorId);check(id(p.restoreReviewerId)!==operator&&id(p.fingerprintReviewerId)!==operator,'INDEPENDENT_REVIEW_REQUIRED')
 const pins=record(p.artifactSha256);keys(pins,ARTIFACTS);Object.values(pins).forEach(digest)
 for(const name of ['restoreReviewSha256','fingerprintReviewSha256','sourceStateSha256','restoredStateSha256','expectedDatabaseFingerprintSha256','sourceExternalDefaultAclsSha256'])digest(p[name])
 check(p.sourceExternalDefaultAclCount===REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT,'EXTERNAL_ACL_SCOPE_REFUSED')
 return p as unknown as FreshRestorePolicy
}
/** Review both the evidence chain and its operator-selected cutoff, not only a summary hash. */
export function freshRestoreReviewSubjectSha256(source:FreshRestorePolicy):string{
 const p=policyCopy(source)
 const {restoreReviewSha256:unusedRestore,fingerprintReviewSha256:unusedFingerprint,...subject}=p
 return hash(subject)
}
function artifact(value:PinnedArtifact,expected:string,limit:number){
 const bytes=value?.bytes,claimed=value?.sha256
 check(typeof bytes==='string'&&Buffer.byteLength(bytes)>0&&Buffer.byteLength(bytes)<=limit&&claimed===expected&&sha256(bytes)===expected,'ARTIFACT_PIN_REFUSED')
 return bytes
}
function json<T>(bytes:string):T{
 let value:unknown;try{value=JSON.parse(bytes)}catch{throw Error('HS_FRESH_RESTORE_JSON_REFUSED')}
 // Existing producer formats only. Reject duplicate keys, trailing material,
 // noncanonical numeric encodings and escaped key aliases before interpretation.
 check(bytes===JSON.stringify(value)||bytes===JSON.stringify(value,null,2)+'\n','NONCANONICAL_JSON')
 return value as T
}
function allTrue(r:Record<string,unknown>,names:readonly string[]){for(const name of names)check(r[name]===true,'PRESERVATION_REQUIRED')}
function same(r:Record<string,unknown>,expected:Record<string,unknown>,code:string){for(const [name,value]of Object.entries(expected))check(r[name]===value,code)}
function review(bytes:string,p:FreshRestorePolicy,stage:'restore'|'fingerprint',completed:number,now:number){
 const r=record(json(bytes));keys(r,['profile','stage','verdict','operatorId','reviewerId','reviewedUtc','subjectSha256','materialFindingsOpen','checks','sourceCurrentnessObserved','liveHostedPreflightRequired','upgradeAuthorized','providerRecoveryExcluded'])
 same(r,{profile:FRESH_RESTORE_REVIEW_PROFILE,stage,verdict:'accepted',operatorId:p.operatorId,reviewerId:stage==='restore'?p.restoreReviewerId:p.fingerprintReviewerId,subjectSha256:freshRestoreReviewSubjectSha256(p),materialFindingsOpen:0,sourceCurrentnessObserved:false,liveHostedPreflightRequired:true,upgradeAuthorized:false,providerRecoveryExcluded:true},'REVIEW_REFUSED')
 const reviewed=utc(r.reviewedUtc);check(reviewed>=completed&&reviewed<=now,'REVIEW_TIME_REFUSED')
 const checks=record(r.checks),names=stage==='restore'?['actualPostgres17RestoreVerified','archiveSnapshotPairVerified','applicationPreservationVerified','tenantControlsVerified']:['coherentSnapshotVerified','quietSequenceWritersVerified','fingerprintIndependentlyDerived','externalDefaultAclScopeVerified']
 keys(checks,names);allTrue(checks,names)
}
/** Supplies exactly the runner contract. It certifies a reviewed local history,
 * not current hosted state. Call again with trusted current time at integration.
 */
export function verifyFreshHostedSetupRestore(evidence:FreshRestoreEvidence,sourcePolicy:FreshRestorePolicy,nowUtc:string):AcceptedRestoreBinding{
 const p=policyCopy(sourcePolicy),now=utc(nowUtc),cutoff=utc(p.notBeforeUtc)
 check(now>=cutoff,'CUTOFF_IN_FUTURE')
 // Retain all caller-owned strings once, before parsing. The binary is copied.
 const e=record(evidence);keys(e,[...ARTIFACTS,'restoreReview','fingerprintReview'])
 const retained:Record<string,string>={}
 for(const name of [...ARTIFACTS.filter(n=>n!=='sourceArchive'),'restoreReview','fingerprintReview'] as const){
  const pin=name==='restoreReview'?p.restoreReviewSha256:name==='fingerprintReview'?p.fingerprintReviewSha256:p.artifactSha256[name]
  retained[name]=artifact(e[name] as PinnedArtifact,pin,name==='sourceSnapshot'||name==='restoredState'?TEXT_LIMIT:SMALL_LIMIT)
 }
 const archive=record(e.sourceArchive),raw=archive.bytes,claimed=archive.sha256
 check(raw instanceof Uint8Array&&raw.byteLength>0&&raw.byteLength<=ARCHIVE_LIMIT,'ARCHIVE_BYTES_REQUIRED')
 check(!(raw.buffer instanceof SharedArrayBuffer),'SHARED_ARCHIVE_REFUSED')
 const privateArchive=new Uint8Array(raw)
 check(claimed===p.artifactSha256.sourceArchive&&sha256(privateArchive)===p.artifactSha256.sourceArchive,'ARCHIVE_PIN_REFUSED')
 const receipt=record(json(retained.sourceReceipt!)),snapshot=record(json(retained.sourceSnapshot!)),result=record(json(retained.restoreResult!)),observation=record(json(retained.restoreObservation!)),d=record(json(retained.fingerprintDerivation!))
 const restored=json<State>(retained.restoredState!)
 keys(receipt,['profile','project','createdUtc','applicationOnly','syntheticOnly','providerRecoveryExcluded','archiveSha256','snapshotSha256','dumpSha256','stateSha256'])
 keys(snapshot,['profile','project','applicationOnly','syntheticOnly','providerRecoveryExcluded','snapshotTokenHash','state','auth','dumpBase64','dumpSha256','sourceDatabase','serverMajor'])
 const created=utc(receipt.createdUtc);check(created>=cutoff&&created<=now&&now-created<=p.maxAgeMs,'STALE_BACKUP_REFUSED')
 same(receipt,{profile:PROFILE,project:HOSTED_SETUP_PROJECT,archiveSha256:p.artifactSha256.sourceArchive,snapshotSha256:p.artifactSha256.sourceSnapshot,stateSha256:p.sourceStateSha256},'SOURCE_RECEIPT_MISMATCH')
 same(snapshot,{sourceDatabase:'postgres',serverMajor:17},'SOURCE_IDENTITY_REFUSED')
 check(hash(snapshot.state)===p.sourceStateSha256&&hash(restored)===p.restoredStateSha256,'STATE_PIN_REFUSED')
 let dump:Buffer|undefined
 try{dump=validateBundle(snapshot as unknown as Snapshot,receipt as unknown as Receipt)}finally{dump?.fill(0);privateArchive.fill(0)}
 assertPreserved(snapshot.state as State,restored)
 const acls=(snapshot.state as State).inventory.defaultAcls.map(record)
 for(const row of acls){keys(row,['owner','schema','kind','acl']);id(row.owner);id(row.schema);check(typeof row.kind==='string'&&row.kind.length===1&&(row.acl===null||typeof row.acl==='string'),'ACL_ROW_REFUSED')}
 const ordering=(r:Record<string,unknown>)=>[r.owner,r.schema,r.kind] as string[]
 const ordered=[...acls].sort((a,b)=>{for(let i=0;i<3;i++){const x=ordering(a)[i]!,y=ordering(b)[i]!;if(x!==y)return x<y?-1:1}return 0})
 check(hash(acls)===hash(ordered)&&new Set(acls.map(r=>hash(ordering(r)))).size===acls.length,'ACL_ORDER_OR_DUPLICATE_REFUSED')
 const external=acls.filter(r=>r.schema!=='neuvetra'&&r.schema!=='*')
 check(external.length===p.sourceExternalDefaultAclCount&&hash(external)===p.sourceExternalDefaultAclsSha256,'EXTERNAL_ACL_SCOPE_REFUSED')
 keys(result,['profile','status','database','sourceReceiptSha256','sourceStateSha256','restoredStateSha256','applicationRowsExact','applicationCatalogEquivalent','tenantReadAccessExact','providerRecoveryExcluded','hostedMigrationAuthorized'])
 same(result,{profile:PROFILE,status:'local-restore-preservation-passed',sourceReceiptSha256:p.artifactSha256.sourceReceipt,sourceStateSha256:p.sourceStateSha256,restoredStateSha256:p.restoredStateSha256,providerRecoveryExcluded:true,hostedMigrationAuthorized:false},'RESTORE_RESULT_MISMATCH')
 allTrue(result,['applicationRowsExact','applicationCatalogEquivalent','tenantReadAccessExact'])
 check(/^hosted_setup_restore_[0-9]{13}_[a-f0-9]{8}$/.test(id(result.database)),'LOCAL_DATABASE_REFUSED')
 keys(observation,['profile','projectRef','targetProfile','schemaVersion','operatorId','restoreStartedUtc','restoreCompletedUtc','fingerprintCompletedUtc','runtime','sourceReceiptSha256','sourceArchiveSha256','sourceSnapshotSha256','sourceStateSha256','restoredStateSha256','restoreResultSha256','fingerprintDerivationSha256','clusterStopped','clusterDataRetained','localListenerAbsent','sourceCurrentnessObserved','providerRecoveryExcluded','upgradeAuthorized'])
 same(observation,{profile:FRESH_RESTORE_OBSERVATION_PROFILE,projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,operatorId:p.operatorId,sourceReceiptSha256:p.artifactSha256.sourceReceipt,sourceArchiveSha256:p.artifactSha256.sourceArchive,sourceSnapshotSha256:p.artifactSha256.sourceSnapshot,sourceStateSha256:p.sourceStateSha256,restoredStateSha256:p.restoredStateSha256,restoreResultSha256:p.artifactSha256.restoreResult,fingerprintDerivationSha256:p.artifactSha256.fingerprintDerivation,clusterStopped:true,clusterDataRetained:true,localListenerAbsent:true,sourceCurrentnessObserved:false,providerRecoveryExcluded:true,upgradeAuthorized:false},'OBSERVATION_MISMATCH')
 const runtime=record(observation.runtime);keys(runtime,['database','host','port','serverVersionNum'])
 check(runtime.database===result.database&&runtime.host==='127.0.0.1'&&Number.isInteger(runtime.port)&&(runtime.port as number)>0&&(runtime.port as number)<=65535&&Number.isInteger(runtime.serverVersionNum)&&(runtime.serverVersionNum as number)>=170000&&(runtime.serverVersionNum as number)<180000,'PG17_LOCAL_OBSERVATION_REQUIRED')
 const start=utc(observation.restoreStartedUtc),end=utc(observation.restoreCompletedUtc),derived=utc(observation.fingerprintCompletedUtc)
 check(created<=start&&start<=end&&end<=derived&&derived<=now,'OBSERVATION_TIME_REFUSED')
 keys(d,['profile','projectRef','targetProfile','schemaVersion','sourceSnapshotSha256','sourceReceiptSha256','sourceArchiveSha256','sourceStateSha256','restoreResultSha256','restoredStateSha256','sourceExternalDefaultAclsSha256','sourceExternalDefaultAclCount','expectedDatabaseFingerprintSha256','rowEncoding','exactApplicationRowsPreserved','applicationCatalogEquivalent','roleMembershipEquivalent','sequenceStateEquivalent','tenantControlsVerified','sourceCurrentnessObserved','liveHostedPreflightRequired','independentReviewRequired','upgradeAuthorized'])
 same(d,{profile:'neuvetra.hosted-setup.fingerprint-derivation.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,sourceSnapshotSha256:p.artifactSha256.sourceSnapshot,sourceReceiptSha256:p.artifactSha256.sourceReceipt,sourceArchiveSha256:p.artifactSha256.sourceArchive,sourceStateSha256:p.sourceStateSha256,restoreResultSha256:p.artifactSha256.restoreResult,restoredStateSha256:p.restoredStateSha256,sourceExternalDefaultAclsSha256:p.sourceExternalDefaultAclsSha256,sourceExternalDefaultAclCount:p.sourceExternalDefaultAclCount,expectedDatabaseFingerprintSha256:p.expectedDatabaseFingerprintSha256,rowEncoding:'postgres-jsonb-text.v1',sourceCurrentnessObserved:false,liveHostedPreflightRequired:true,independentReviewRequired:true,upgradeAuthorized:false},'DERIVATION_MISMATCH')
 allTrue(d,['exactApplicationRowsPreserved','applicationCatalogEquivalent','roleMembershipEquivalent','sequenceStateEquivalent','tenantControlsVerified'])
 review(retained.restoreReview!,p,'restore',derived,now);review(retained.fingerprintReview!,p,'fingerprint',derived,now)
 return Object.freeze({profile:'neuvetra.hosted-setup.accepted-restore-binding.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,
  restoreReceiptSha256:p.artifactSha256.restoreObservation,restoreReviewSha256:p.restoreReviewSha256,fingerprintDerivationSha256:p.artifactSha256.fingerprintDerivation,fingerprintDerivationReviewSha256:p.fingerprintReviewSha256,
  sourceSnapshotSha256:p.artifactSha256.sourceSnapshot,sourceArchiveSha256:p.artifactSha256.sourceArchive,sourceStateSha256:p.sourceStateSha256,restoredStateSha256:p.restoredStateSha256,
  expectedDatabaseFingerprintSha256:p.expectedDatabaseFingerprintSha256,databaseFingerprintIndependentlyDerived:true,exactApplicationPreserved:true,tenantControlsVerified:true,operatorId:p.operatorId,independentReviewerId:p.restoreReviewerId,materialFindingsOpen:0})
}