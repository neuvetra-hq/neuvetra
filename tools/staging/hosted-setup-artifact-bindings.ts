/**
 * Fixed evidence adapters for the single-use hosted setup artifact worker.
 *
 * Importing this module performs no I/O. Upgrade preparation reads only the
 * already-verified publication and copies a JSON payload. Provider reads happen
 * only when the transactional runner asks for a fresh stopped observation.
 * Review pins are trusted-operator-host inputs; they do not cryptographically
 * authenticate the named human reviewer.
 */
import {lstat,readFile,realpath} from 'node:fs/promises'
import {isAbsolute,relative,resolve} from 'node:path'
import type {FixedBindingContext,FixedReconciliationPreparation,FixedUpgradePreparation} from './hosted-setup-artifact-worker'
import {
 ARTIFACT_PROFILE,ARTIFACT_SOURCE_PROFILE,PUBLICATION_PROFILE,
 type ArtifactInspection,
} from './hosted-setup-artifact-source'
import {
 FRESH_RESTORE_POLICY_PROFILE,verifyFreshHostedSetupRestore,
 type FreshRestoreEvidence,type FreshRestorePolicy,
} from './hosted-setup-fresh-restore-binding'
import {
 DEPLOYMENT_BINDING_PROFILE,DEPLOYMENT_REVIEW_PROFILE,DEPLOYMENT_TARGET,
 deploymentCaptureSha256,verifyHostedSetupDeploymentBinding,
 type DeploymentBinding,type DeploymentBindingPolicy,type DeploymentCapture,
} from './hosted-setup-deployment-binding'
import {
 HOSTED_SETUP_STOPPED_PROFILE,verifyHostedSetupStopped,
 type HostedSetupStoppedPolicy,type HostedSetupStoppedVerification,
} from './hosted-setup-postscale'
import {
 RAILWAY_CAPTURE_PROFILE,captureHostedSetupRailwayDeployment,
 type RailwayCaptureInput,
} from './hosted-setup-railway-capture'
import {withSequenceFence} from './hosted-setup-sequence-fence'
import {
 HOSTED_SETUP_MAINTENANCE_TARGET,HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE,
 HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE,
 type MaintenanceStopPhase,type ReviewedExecutionArtifactBinding,
 type ReviewedMaintenanceStopBinding,
} from './hosted-setup-transactional-upgrade'
import {
 HOSTED_SETUP_PROFILE,HOSTED_SETUP_PROJECT,canonical,sha256,
 type HostedSetupUpgradeInput,type PinnedArtifact,
} from './hosted-setup-upgrade'

export const FIXED_ARTIFACT_BINDINGS_PAYLOAD_PROFILE='neuvetra.hosted-setup.fixed-artifact-bindings-payload.v1' as const
export const FIXED_ARTIFACT_RECONCILIATION_PAYLOAD_PROFILE='neuvetra.hosted-setup.fixed-artifact-reconciliation-payload.v1' as const
export const MAINTENANCE_STOP_REVIEW_PROFILE='neuvetra.hosted-setup.maintenance-stop-review.v2' as const
const PR_HEAD_PROFILE='neuvetra.hosted-setup.authenticated-pr-head.v1' as const
const PR_REVIEW_PROFILE='neuvetra.hosted-setup.authenticated-pr-review.v1' as const
const REPOSITORY='neuvetra-hq/neuvetra',PULL_REQUEST=6,MAX_HEAD_AGE_MS=5*60_000,MAX_REVIEW_AGE_MS=5*60_000
const SHA=/^[0-9a-f]{64}$/,HEAD=/^[0-9a-f]{40}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const IMAGE=/^sha256:[0-9a-f]{64}$/

type Json=string|number|boolean|null|Json[]|{[key:string]:Json}
type PrivateEvidenceFile={path:string;sha256:string;byteLength:number}
interface TrustedPins{
 freshRestorePolicySha256:string;deploymentPolicySha256:string
 currentHeadEvidenceSha256:string;stopReviewSha256:string
}
interface PrivateFreshRestoreEvidence{
 sourceReceipt:PrivateEvidenceFile;sourceArchive:PrivateEvidenceFile;sourceSnapshot:PrivateEvidenceFile
 restoredState:PrivateEvidenceFile;restoreResult:PrivateEvidenceFile;restoreObservation:PrivateEvidenceFile
 fingerprintDerivation:PrivateEvidenceFile;restoreReview:PrivateEvidenceFile;fingerprintReview:PrivateEvidenceFile
}
interface FixedUpgradePayload{
 profile:typeof FIXED_ARTIFACT_BINDINGS_PAYLOAD_PROFILE;attemptId:string
 database:{connectionString:string;caPem:string}
 trustedPins:TrustedPins
 restore:{evidence:PrivateFreshRestoreEvidence;policy:FreshRestorePolicy}
 publication:{review:PinnedArtifact;headEvidence:PinnedArtifact;currentHeadEvidence:PinnedArtifact}
 maintenance:{
  deploymentReceipt:PinnedArtifact;deploymentReview:PinnedArtifact;deploymentPolicy:DeploymentBindingPolicy
  stoppedCaptures:readonly[DeploymentCapture,DeploymentCapture];stoppedPolicy:HostedSetupStoppedPolicy
  stopReceipt:PinnedArtifact;stopReview:PinnedArtifact;railwayCaptureInput:RailwayCaptureInput
 }
}

function refuse(code:string):never{throw Error('HS_ARTIFACT_BINDINGS_'+code)}
function check(value:unknown,code:string):asserts value{if(!value)refuse(code)}
function record(value:unknown,code='OBJECT_REQUIRED'):Record<string,unknown>{check(value!==null&&typeof value==='object'&&!Array.isArray(value),code);return value as Record<string,unknown>}
function exact(value:Record<string,unknown>,keys:readonly string[],code='SHAPE_REFUSED'){check(Object.keys(value).sort().join('|')===[...keys].sort().join('|'),code)}
function text(value:unknown,code='TEXT_REQUIRED'){check(typeof value==='string'&&value.length>0&&value.length<=8192&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value),code);return value}
function match(value:unknown,pattern:RegExp,code:string){const result=text(value,code);check(pattern.test(result),code);return result}
function integer(value:unknown,code:string){check(Number.isSafeInteger(value),code);return value as number}
function utc(value:unknown,code='TIME_REFUSED'){const result=text(value,code),time=Date.parse(result);check(Number.isFinite(time)&&new Date(time).toISOString()===result,code);return time}
function plain(value:unknown,depth=0):Json{
 check(depth<48,'PAYLOAD_DEPTH_REFUSED')
 if(value===null||typeof value==='string'||typeof value==='boolean')return value
 if(typeof value==='number'){check(Number.isFinite(value)&&Number.isSafeInteger(value),'PAYLOAD_NUMBER_REFUSED');return value}
 if(Array.isArray(value)){
  let prototype:object|null,descriptors:Record<string,PropertyDescriptor>
  try{prototype=Object.getPrototypeOf(value);descriptors=Object.getOwnPropertyDescriptors(value) as Record<string,PropertyDescriptor>}catch{refuse('PAYLOAD_ARRAY_REFUSED')}
  check(prototype===Array.prototype,'PAYLOAD_ARRAY_PROTOTYPE_REFUSED')
  const names=Reflect.ownKeys(descriptors),lengthDescriptor=descriptors.length
  check(names.every(name=>typeof name==='string')&&lengthDescriptor!==undefined&&'value'in lengthDescriptor,'PAYLOAD_ARRAY_REFUSED')
  const length=lengthDescriptor.value;check(Number.isSafeInteger(length)&&length>=0&&names.length===length+1,'PAYLOAD_ARRAY_REFUSED')
  const result:Json[]=[]
  for(let index=0;index<length;index++){
   const descriptor=descriptors[String(index)]
   check(descriptor!==undefined&&'value'in descriptor&&descriptor.enumerable===true,'PAYLOAD_ACCESSOR_REFUSED')
   result.push(plain(descriptor.value,depth+1))
  }
  return result
 }
 const source=record(value,'PAYLOAD_OBJECT_REFUSED'),prototype=Object.getPrototypeOf(source)
 check(prototype===Object.prototype||prototype===null,'PAYLOAD_PROTOTYPE_REFUSED')
 const descriptors=Object.getOwnPropertyDescriptors(source),symbols=Object.getOwnPropertySymbols(source)
 check(symbols.length===0&&Object.keys(descriptors).length===Object.keys(source).length,'PAYLOAD_PROPERTY_REFUSED')
 const result:Record<string,Json>=Object.create(null)
 for(const [key,descriptor] of Object.entries(descriptors)){
  check('value'in descriptor&&descriptor.enumerable,'PAYLOAD_ACCESSOR_REFUSED')
  result[key]=plain(descriptor.value,depth+1)
 }
 return result
}
function json(bytes:string,code:string):Record<string,unknown>{
 let parsed:unknown;try{parsed=JSON.parse(bytes)}catch{refuse(code+'_JSON_REFUSED')}
 check(bytes===JSON.stringify(parsed)||bytes===JSON.stringify(parsed,null,2)+'\n',code+'_NONCANONICAL')
 return record(parsed,code+'_OBJECT_REQUIRED')
}
function pinned(value:unknown,code:string,limit=8*1024*1024):PinnedArtifact{
 const item=record(value,code+'_REQUIRED');exact(item,['bytes','sha256'],code+'_SHAPE_REFUSED')
 check(typeof item.bytes==='string',''+code+'_BYTES_REFUSED');const bytes=item.bytes as string,digest=match(item.sha256,SHA,code+'_DIGEST_REFUSED')
 check(Buffer.byteLength(bytes)>0&&Buffer.byteLength(bytes)<=limit&&sha256(bytes)===digest,code+'_PIN_REFUSED')
 return Object.freeze({bytes,sha256:digest})
}
function sameArtifact(left:PinnedArtifact,right:PinnedArtifact,code:string){check(left.sha256===right.sha256&&left.bytes===right.bytes,code)}
function digestObject(value:unknown){return sha256(canonical(value))}
function identity(value:unknown,code:string){const result=text(value,code);check(result.length<=256,code);return result}
function clonePolicy(value:unknown):FreshRestorePolicy{return plain(value) as unknown as FreshRestorePolicy}
function cloneDeploymentPolicy(value:unknown):DeploymentBindingPolicy{return plain(value) as unknown as DeploymentBindingPolicy}
function cloneCapture(value:unknown):DeploymentCapture{
 const item=record(plain(value));exact(item,['startedUtc','completedUtc','statusJson','inventoryJson'])
 check(typeof item.statusJson==='string'&&typeof item.inventoryJson==='string'&&Buffer.byteLength(item.statusJson)>0&&Buffer.byteLength(item.statusJson)<=8*1024*1024&&Buffer.byteLength(item.inventoryJson)>0&&Buffer.byteLength(item.inventoryJson)<=8*1024*1024,'CAPTURE_BYTES_REFUSED')
 return Object.freeze({startedUtc:text(item.startedUtc),completedUtc:text(item.completedUtc),statusJson:item.statusJson,inventoryJson:item.inventoryJson})
}
function capturePair(value:unknown):readonly[DeploymentCapture,DeploymentCapture]{
 check(Array.isArray(value)&&value.length===2,'TWO_STOPPED_CAPTURES_REQUIRED')
 return Object.freeze([cloneCapture(value[0]),cloneCapture(value[1])] as const)
}
function copyRailwayInput(value:unknown):RailwayCaptureInput{
 const item=record(plain(value));exact(item,['profile','executablePath','workingDirectory','timeoutMs'])
 check(item.profile===RAILWAY_CAPTURE_PROFILE&&isAbsolute(text(item.executablePath))&&isAbsolute(text(item.workingDirectory)),'RAILWAY_INPUT_REFUSED')
 const timeoutMs=integer(item.timeoutMs,'RAILWAY_TIMEOUT_REFUSED');check(timeoutMs>=1000&&timeoutMs<=30000,'RAILWAY_TIMEOUT_REFUSED')
 return Object.freeze({profile:RAILWAY_CAPTURE_PROFILE,executablePath:item.executablePath as string,workingDirectory:item.workingDirectory as string,timeoutMs})
}
function privateFile(value:unknown,code:string):PrivateEvidenceFile{
 const item=record(value);exact(item,['path','sha256','byteLength'],code+'_SHAPE_REFUSED')
 const path=text(item.path,code+'_PATH_REFUSED'),digest=match(item.sha256,SHA,code+'_DIGEST_REFUSED'),byteLength=integer(item.byteLength,code+'_SIZE_REFUSED')
 check(isAbsolute(path)&&byteLength>0&&byteLength<=512*1024*1024,code+'_PATH_OR_SIZE_REFUSED')
 return Object.freeze({path:resolve(path),sha256:digest,byteLength})
}
function copyEvidence(value:unknown):PrivateFreshRestoreEvidence{
 const item=record(value);exact(item,['sourceReceipt','sourceArchive','sourceSnapshot','restoredState','restoreResult','restoreObservation','fingerprintDerivation','restoreReview','fingerprintReview'],'RESTORE_EVIDENCE_SHAPE_REFUSED')
 return Object.freeze({sourceReceipt:privateFile(item.sourceReceipt,'SOURCE_RECEIPT'),sourceArchive:privateFile(item.sourceArchive,'SOURCE_ARCHIVE'),sourceSnapshot:privateFile(item.sourceSnapshot,'SOURCE_SNAPSHOT'),restoredState:privateFile(item.restoredState,'RESTORED_STATE'),restoreResult:privateFile(item.restoreResult,'RESTORE_RESULT'),restoreObservation:privateFile(item.restoreObservation,'RESTORE_OBSERVATION'),fingerprintDerivation:privateFile(item.fingerprintDerivation,'FINGERPRINT_DERIVATION'),restoreReview:privateFile(item.restoreReview,'RESTORE_REVIEW'),fingerprintReview:privateFile(item.fingerprintReview,'FINGERPRINT_REVIEW')})
}
function comparable(path:string){const value=resolve(path);return process.platform==='win32'?value.toLowerCase():value}
function inside(root:string,path:string){const child=relative(comparable(root),comparable(path));return child===''||(!child.startsWith('..')&&!isAbsolute(child))}
async function readPrivateFile(ref:PrivateEvidenceFile,context:FixedBindingContext,limit:number,binary=false){
 const path=resolve(ref.path),excludedRoots=[context.paths.sourceRoot,context.paths.dependencyRoot,...context.policy.activeCheckoutRoots]
 check(!excludedRoots.some(root=>inside(root,path))&&!Object.values(context.paths).some(value=>comparable(value)===comparable(path)),'PRIVATE_EVIDENCE_LOCATION_REFUSED')
 const first=await lstat(path);check(first.isFile()&&!first.isSymbolicLink()&&comparable(await realpath(path))===comparable(path),'PRIVATE_EVIDENCE_FILE_REFUSED')
 check(first.size===ref.byteLength&&first.size<=limit,'PRIVATE_EVIDENCE_SIZE_REFUSED')
 const bytes=new Uint8Array(await readFile(path)),second=await lstat(path)
 check(second.isFile()&&!second.isSymbolicLink()&&second.size===first.size&&second.mtimeMs===first.mtimeMs&&bytes.byteLength===ref.byteLength&&sha256(bytes)===ref.sha256,'PRIVATE_EVIDENCE_CHANGED_OR_UNPINNED')
 if(binary)return Object.freeze({bytes,sha256:ref.sha256})
 let textValue:string;try{textValue=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{refuse('PRIVATE_EVIDENCE_UTF8_REFUSED')}
 return Object.freeze({bytes:textValue!,sha256:ref.sha256})
}
async function loadEvidence(refs:PrivateFreshRestoreEvidence,context:FixedBindingContext):Promise<FreshRestoreEvidence>{
 const sourceReceipt=await readPrivateFile(refs.sourceReceipt,context,1024*1024),sourceArchive=await readPrivateFile(refs.sourceArchive,context,512*1024*1024,true),sourceSnapshot=await readPrivateFile(refs.sourceSnapshot,context,256*1024*1024),restoredState=await readPrivateFile(refs.restoredState,context,256*1024*1024)
 const restoreResult=await readPrivateFile(refs.restoreResult,context,1024*1024),restoreObservation=await readPrivateFile(refs.restoreObservation,context,1024*1024),fingerprintDerivation=await readPrivateFile(refs.fingerprintDerivation,context,1024*1024),restoreReview=await readPrivateFile(refs.restoreReview,context,1024*1024),fingerprintReview=await readPrivateFile(refs.fingerprintReview,context,1024*1024)
 return Object.freeze({sourceReceipt:sourceReceipt as PinnedArtifact,sourceArchive:sourceArchive as {bytes:Uint8Array;sha256:string},sourceSnapshot:sourceSnapshot as PinnedArtifact,restoredState:restoredState as PinnedArtifact,restoreResult:restoreResult as PinnedArtifact,restoreObservation:restoreObservation as PinnedArtifact,fingerprintDerivation:fingerprintDerivation as PinnedArtifact,restoreReview:restoreReview as PinnedArtifact,fingerprintReview:fingerprintReview as PinnedArtifact})
}
function copyDatabase(value:unknown){
 const item=record(value);exact(item,['connectionString','caPem'],'DATABASE_SHAPE_REFUSED')
 check(typeof item.connectionString==='string'&&typeof item.caPem==='string','DATABASE_CONFIGURATION_REFUSED');const connectionString=item.connectionString,caPem=item.caPem
 check(connectionString.length<=4096&&caPem.length<=1024*1024,'DATABASE_CONFIGURATION_REFUSED')
 return Object.freeze({connectionString,caPem})
}
function copyTrust(value:unknown):TrustedPins{
 const item=record(value);exact(item,['freshRestorePolicySha256','deploymentPolicySha256','currentHeadEvidenceSha256','stopReviewSha256'],'TRUST_PINS_SHAPE_REFUSED')
 return Object.freeze({freshRestorePolicySha256:match(item.freshRestorePolicySha256,SHA,'RESTORE_POLICY_PIN_REFUSED'),deploymentPolicySha256:match(item.deploymentPolicySha256,SHA,'DEPLOYMENT_POLICY_PIN_REFUSED'),currentHeadEvidenceSha256:match(item.currentHeadEvidenceSha256,SHA,'CURRENT_HEAD_PIN_REFUSED'),stopReviewSha256:match(item.stopReviewSha256,SHA,'STOP_REVIEW_PIN_REFUSED')})
}
function copyUpgradePayload(value:unknown):FixedUpgradePayload{
 const item=record(plain(value));exact(item,['profile','attemptId','database','trustedPins','restore','publication','maintenance'])
 check(item.profile===FIXED_ARTIFACT_BINDINGS_PAYLOAD_PROFILE,'PAYLOAD_PROFILE_REFUSED')
 const attemptId=match(item.attemptId,UUID,'ATTEMPT_ID_REFUSED'),database=copyDatabase(item.database),trustedPins=copyTrust(item.trustedPins)
 const restore=record(item.restore);exact(restore,['evidence','policy']);const evidence=copyEvidence(restore.evidence),policy=clonePolicy(restore.policy)
 check(policy.profile===FRESH_RESTORE_POLICY_PROFILE&&digestObject(policy)===trustedPins.freshRestorePolicySha256,'RESTORE_POLICY_TRUST_PIN_REFUSED')
 const publication=record(item.publication);exact(publication,['review','headEvidence','currentHeadEvidence'])
 const maintenance=record(item.maintenance);exact(maintenance,['deploymentReceipt','deploymentReview','deploymentPolicy','stoppedCaptures','stoppedPolicy','stopReceipt','stopReview','railwayCaptureInput'])
 const deploymentPolicy=cloneDeploymentPolicy(maintenance.deploymentPolicy)
 check(digestObject(deploymentPolicy)===trustedPins.deploymentPolicySha256,'DEPLOYMENT_POLICY_TRUST_PIN_REFUSED')
 const stopReview=pinned(maintenance.stopReview,'STOP_REVIEW');check(stopReview.sha256===trustedPins.stopReviewSha256,'STOP_REVIEW_TRUST_PIN_REFUSED')
 return Object.freeze({profile:FIXED_ARTIFACT_BINDINGS_PAYLOAD_PROFILE,attemptId,database,trustedPins,
  restore:Object.freeze({evidence,policy}),publication:Object.freeze({review:pinned(publication.review,'PUBLICATION_REVIEW'),headEvidence:pinned(publication.headEvidence,'PUBLISHED_HEAD_EVIDENCE'),currentHeadEvidence:pinned(publication.currentHeadEvidence,'CURRENT_HEAD_EVIDENCE')}),
  maintenance:Object.freeze({deploymentReceipt:pinned(maintenance.deploymentReceipt,'DEPLOYMENT_RECEIPT'),deploymentReview:pinned(maintenance.deploymentReview,'DEPLOYMENT_REVIEW'),deploymentPolicy,stoppedCaptures:capturePair(maintenance.stoppedCaptures),stoppedPolicy:plain(maintenance.stoppedPolicy) as unknown as HostedSetupStoppedPolicy,stopReceipt:pinned(maintenance.stopReceipt,'STOP_RECEIPT'),stopReview,railwayCaptureInput:copyRailwayInput(maintenance.railwayCaptureInput)})})
}
function validateContext(context:FixedBindingContext,mode:'upgrade'|'reconcile'){
 check(context?.profile==='neuvetra.hosted-setup.fixed-artifact-worker.v1'&&context.mode===mode,'WORKER_CONTEXT_REFUSED')
 check(context.inspection?.profile===ARTIFACT_PROFILE&&context.inspection.trustBoundary==='trusted-operator-host'&&context.inspection.claim==='verified-at-rest-artifact-and-private-sql-only','ARTIFACT_INSPECTION_REFUSED')
 check(context.inspection.reviewedProductHead===context.policy.reviewedProductHead&&context.inspection.operatorId===context.policy.operatorId&&context.inspection.independentReviewerId===context.policy.independentReviewerId,'ARTIFACT_POLICY_DRIFT')
}
function publication(bytes:string,inspection:ArtifactInspection){
 const value=json(bytes,'PUBLICATION');exact(value,['profile','trustBoundary','reviewedProductHead','repository','pullRequest','operatorId','independentReviewerId','materialFindingsOpen','observedAtMs','expiresAtMs','checks','publisherEvidence','sourceFiles','dependencyFiles','migrations','migrationManifestSha256','artifact'],'PUBLICATION_SHAPE_REFUSED')
 check(value.profile===PUBLICATION_PROFILE&&value.trustBoundary==='trusted-operator-host'&&value.reviewedProductHead===inspection.reviewedProductHead&&value.repository===REPOSITORY&&value.pullRequest===PULL_REQUEST,'PUBLICATION_TARGET_REFUSED')
 check(value.operatorId===inspection.operatorId&&value.independentReviewerId===inspection.independentReviewerId&&value.materialFindingsOpen===0&&value.migrationManifestSha256===inspection.migrationManifestSha256,'PUBLICATION_REVIEW_REFUSED')
 const evidence=record(value.publisherEvidence);exact(evidence,['profile','sourceRead','gitSha256','headEvidenceSha256','checksEvidenceSha256','reviewEvidenceSha256'],'PUBLISHER_EVIDENCE_SHAPE_REFUSED')
 for(const name of ['gitSha256','headEvidenceSha256','checksEvidenceSha256','reviewEvidenceSha256'])match(evidence[name],SHA,'PUBLISHER_EVIDENCE_PIN_REFUSED')
 return Object.freeze({value,evidence,observedAtMs:integer(value.observedAtMs,'PUBLICATION_TIME_REFUSED'),expiresAtMs:integer(value.expiresAtMs,'PUBLICATION_TIME_REFUSED')})
}
function prHead(artifact:PinnedArtifact,expectedSha:string,now:number,current:boolean){
 check(artifact.sha256===expectedSha,'PR_HEAD_TRUST_PIN_REFUSED');const value=json(artifact.bytes,'PR_HEAD')
 exact(value,['profile','repository','pullRequest','head','observedAtMs','expiresAtMs'],'PR_HEAD_SHAPE_REFUSED')
 check(value.profile===PR_HEAD_PROFILE&&value.repository===REPOSITORY&&value.pullRequest===PULL_REQUEST,'PR_HEAD_TARGET_REFUSED')
 const head=match(value.head,HEAD,'PR_HEAD_REFUSED'),observed=integer(value.observedAtMs,'PR_HEAD_TIME_REFUSED'),expires=integer(value.expiresAtMs,'PR_HEAD_TIME_REFUSED')
 check(observed<=now&&expires>now&&expires>observed,'PR_HEAD_TIME_REFUSED')
 if(current)check(now-observed<=MAX_HEAD_AGE_MS&&expires-observed<=MAX_HEAD_AGE_MS,'CURRENT_PR_HEAD_STALE')
 return Object.freeze({head,observed,expires})
}
function prReview(artifact:PinnedArtifact,expectedSha:string,inspection:ArtifactInspection,now:number){
 check(artifact.sha256===expectedSha,'PR_REVIEW_PIN_REFUSED');const value=json(artifact.bytes,'PR_REVIEW')
 exact(value,['profile','repository','pullRequest','head','operatorId','independentReviewerId','verdict','materialFindingsOpen','reviewedAtMs','expiresAtMs'],'PR_REVIEW_SHAPE_REFUSED')
 check(value.profile===PR_REVIEW_PROFILE&&value.repository===REPOSITORY&&value.pullRequest===PULL_REQUEST&&value.head===inspection.reviewedProductHead&&value.operatorId===inspection.operatorId&&value.independentReviewerId===inspection.independentReviewerId&&value.verdict==='accepted'&&value.materialFindingsOpen===0,'PR_REVIEW_REFUSED')
 const reviewed=integer(value.reviewedAtMs,'PR_REVIEW_TIME_REFUSED'),expires=integer(value.expiresAtMs,'PR_REVIEW_TIME_REFUSED');check(reviewed<=now&&expires>now,'PR_REVIEW_TIME_REFUSED')
}
function sameStopped(left:HostedSetupStoppedVerification,right:Record<string,unknown>){check(canonical(left)===canonical(right),'STOP_RECEIPT_CONTENT_MISMATCH')}
function stopReview(artifact:PinnedArtifact,receipt:PinnedArtifact,binding:DeploymentBinding,operatorId:string,now:number){
 const value=json(artifact.bytes,'STOP_REVIEW');exact(value,['profile','verdict','stopReceiptSha256','deploymentReceiptSha256','deploymentReviewSha256','operatorId','independentReviewerId','reviewedUtc','materialFindingsOpen','availabilityStopObserved','databaseWritersExcluded','migrationAuthorized'],'STOP_REVIEW_SHAPE_REFUSED')
 check(value.profile===MAINTENANCE_STOP_REVIEW_PROFILE&&value.verdict==='accepted'&&value.stopReceiptSha256===receipt.sha256&&value.deploymentReceiptSha256===binding.receiptSha256&&value.deploymentReviewSha256===binding.reviewSha256&&value.operatorId===operatorId&&value.materialFindingsOpen===0&&value.availabilityStopObserved===true&&value.databaseWritersExcluded===false&&value.migrationAuthorized===false,'STOP_REVIEW_REFUSED')
 const reviewer=identity(value.independentReviewerId,'STOP_REVIEWER_REFUSED');check(reviewer!==operatorId,'STOP_REVIEWER_REFUSED')
 const reviewed=utc(value.reviewedUtc,'STOP_REVIEW_TIME_REFUSED');check(reviewed<=now&&now-reviewed<=MAX_REVIEW_AGE_MS,'STOP_REVIEW_TIME_REFUSED')
 return Object.freeze({reviewer,reviewed})
}
function ensureInputArtifact(actual:PinnedArtifact,expected:PinnedArtifact,code:string){sameArtifact(actual,expected,code);return expected}

export async function prepareHostedSetupArtifactUpgrade(context:FixedBindingContext):Promise<FixedUpgradePreparation>{
 validateContext(context,'upgrade');const payload=copyUpgradePayload(context.payload),inspection=context.inspection,now=Date.now()
 check(payload.restore.policy.operatorId===inspection.operatorId&&payload.restore.policy.restoreReviewerId!==inspection.operatorId&&payload.restore.policy.fingerprintReviewerId!==inspection.operatorId,'RESTORE_IDENTITIES_REFUSED')
 const publicationBytes=await readFile(context.paths.publication,'utf8'),publicationArtifact=Object.freeze({bytes:publicationBytes,sha256:sha256(publicationBytes)})
 check(publicationArtifact.sha256===inspection.publicationSha256,'PUBLICATION_INSPECTION_PIN_REFUSED')
 const published=publication(publicationBytes,inspection)
 const historicalHead=prHead(payload.publication.headEvidence,published.evidence.headEvidenceSha256 as string,now,false)
 check(historicalHead.head===inspection.reviewedProductHead,'PUBLISHED_HEAD_CHANGED')
 const verifyPublicationAt=(at:number)=>{
  check(published.observedAtMs<=at&&published.expiresAtMs>at,'PUBLICATION_EXPIRED')
  prReview(payload.publication.review,published.evidence.reviewEvidenceSha256 as string,inspection,at)
  const current=prHead(payload.publication.currentHeadEvidence,payload.trustedPins.currentHeadEvidenceSha256,at,true)
  check(current.head===inspection.reviewedProductHead&&current.observed>=published.observedAtMs,'CURRENT_PR_HEAD_CHANGED')
  return current
 }
 const currentHead=verifyPublicationAt(now)
 const restoreEvidence=await loadEvidence(payload.restore.evidence,context)
 check(restoreEvidence.sourceReceipt.sha256===payload.restore.policy.artifactSha256.sourceReceipt&&restoreEvidence.sourceArchive.sha256===payload.restore.policy.artifactSha256.sourceArchive&&restoreEvidence.sourceSnapshot.sha256===payload.restore.policy.artifactSha256.sourceSnapshot&&restoreEvidence.restoredState.sha256===payload.restore.policy.artifactSha256.restoredState&&restoreEvidence.restoreResult.sha256===payload.restore.policy.artifactSha256.restoreResult&&restoreEvidence.restoreObservation.sha256===payload.restore.policy.artifactSha256.restoreObservation&&restoreEvidence.fingerprintDerivation.sha256===payload.restore.policy.artifactSha256.fingerprintDerivation&&restoreEvidence.restoreReview.sha256===payload.restore.policy.restoreReviewSha256&&restoreEvidence.fingerprintReview.sha256===payload.restore.policy.fingerprintReviewSha256,'RESTORE_EVIDENCE_POLICY_PIN_REFUSED')

 const deploymentPolicy=payload.maintenance.deploymentPolicy
 check(deploymentPolicy.operatorId===inspection.operatorId&&deploymentPolicy.expectedImage.deployedCommit===inspection.reviewedProductHead,'DEPLOYMENT_POLICY_REFUSED')
 let acceptedDeployment:Readonly<DeploymentBinding>|undefined,acceptedStop:Readonly<HostedSetupStoppedVerification>|undefined
 let stopBinding:Readonly<ReviewedMaintenanceStopBinding>|undefined,lastCaptureCompleted=-1,phaseIndex=0
 const seenCaptureHashes=new Set<string>()
 const phaseOrder:readonly MaintenanceStopPhase[]=['before_transaction','under_lock_before_migration','under_lock_before_commit']
 const verifyMaintenance=(receipt:PinnedArtifact,review:PinnedArtifact):ReviewedMaintenanceStopBinding=>{
  ensureInputArtifact(receipt,payload.maintenance.stopReceipt,'STOP_RECEIPT_CALLBACK_CHANGED');ensureInputArtifact(review,payload.maintenance.stopReview,'STOP_REVIEW_CALLBACK_CHANGED')
  check(!acceptedDeployment&&!acceptedStop&&!stopBinding,'MAINTENANCE_BINDING_REPLAY')
  acceptedDeployment=verifyHostedSetupDeploymentBinding(payload.maintenance.deploymentReceipt.bytes,payload.maintenance.deploymentReview.bytes,deploymentPolicy,new Date().toISOString())
  const stopped=verifyHostedSetupStopped(acceptedDeployment,payload.maintenance.stoppedCaptures,payload.maintenance.stoppedPolicy);acceptedStop=stopped
  sameStopped(stopped,json(payload.maintenance.stopReceipt.bytes,'STOP_RECEIPT'))
  const reviewResult=stopReview(payload.maintenance.stopReview,payload.maintenance.stopReceipt,acceptedDeployment,inspection.operatorId,Date.now())
  check(reviewResult.reviewer===deploymentPolicy.independentReviewerId,'STOP_REVIEWER_REFUSED')
  check(reviewResult.reviewed>=Date.parse(stopped.stoppedCompletedUtc),'STOP_REVIEW_CHRONOLOGY_REFUSED')
  for(const capture of payload.maintenance.stoppedCaptures)seenCaptureHashes.add(deploymentCaptureSha256(capture))
  lastCaptureCompleted=Date.parse(stopped.stoppedCompletedUtc)
  stopBinding=Object.freeze({profile:HOSTED_SETUP_REVIEWED_MAINTENANCE_PROFILE,maintenanceProfile:'neuvetra.hosted-setup.maintenance-stop.v2',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,...HOSTED_SETUP_MAINTENANCE_TARGET,deploymentId:stopped.deploymentId,deployedCommit:stopped.deployedCommit,imageDigest:stopped.imageDigest,replicas:0,availabilityStopObserved:true,databaseWritersExcluded:false,configurationVersion:stopped.stoppedConfigurationVersion,stopReceiptSha256:payload.maintenance.stopReceipt.sha256,stopReviewSha256:payload.maintenance.stopReview.sha256,operatorId:inspection.operatorId,independentReviewerId:reviewResult.reviewer,materialFindingsOpen:0})
  return stopBinding
 }
 const observeMaintenanceStopped=async(binding:Readonly<ReviewedMaintenanceStopBinding>,phase:MaintenanceStopPhase)=>{
  check(stopBinding&&acceptedDeployment&&acceptedStop,'MAINTENANCE_OBSERVER_STATE_REFUSED')
  check(phaseOrder[phaseIndex]===phase&&canonical(binding)===canonical(stopBinding),'MAINTENANCE_PHASE_REFUSED')
  const entered=Date.now(),first=await captureHostedSetupRailwayDeployment(payload.maintenance.railwayCaptureInput),second=await captureHostedSetupRailwayDeployment(payload.maintenance.railwayCaptureInput)
  const captures=Object.freeze([first.capture,second.capture] as const),start=Date.parse(captures[0].startedUtc)
  check(start>=entered&&start>lastCaptureCompleted,'MAINTENANCE_CAPTURE_NOT_PHASE_FRESH')
  for(const capture of captures){const hash=deploymentCaptureSha256(capture);check(!seenCaptureHashes.has(hash),'MAINTENANCE_CAPTURE_REPLAY');seenCaptureHashes.add(hash)}
  const verified=verifyHostedSetupStopped(acceptedDeployment,captures,Object.freeze({nowUtc:new Date().toISOString(),beforeStopConfigurationVersion:null,expectedStoppedConfigurationVersion:stopBinding.configurationVersion}))
  check(verified.deploymentId===stopBinding.deploymentId&&verified.deployedCommit===stopBinding.deployedCommit&&verified.imageDigest===stopBinding.imageDigest&&verified.stoppedConfigurationVersion===stopBinding.configurationVersion,'MAINTENANCE_STATE_CHANGED')
  lastCaptureCompleted=Date.parse(verified.stoppedCompletedUtc);phaseIndex++
  return JSON.stringify(true)
 }
 let restoreConsumed=false
 const verifyRestore=(receipt:PinnedArtifact,review:PinnedArtifact,derivation:PinnedArtifact,derivationReview:PinnedArtifact)=>{
  ensureInputArtifact(receipt,restoreEvidence.restoreObservation,'RESTORE_RECEIPT_CALLBACK_CHANGED');ensureInputArtifact(review,restoreEvidence.restoreReview,'RESTORE_REVIEW_CALLBACK_CHANGED');ensureInputArtifact(derivation,restoreEvidence.fingerprintDerivation,'FINGERPRINT_CALLBACK_CHANGED');ensureInputArtifact(derivationReview,restoreEvidence.fingerprintReview,'FINGERPRINT_REVIEW_CALLBACK_CHANGED')
  check(!restoreConsumed,'RESTORE_BINDING_REPLAY');restoreConsumed=true
  try{return verifyFreshHostedSetupRestore(restoreEvidence,payload.restore.policy,new Date().toISOString())}finally{restoreEvidence.sourceArchive.bytes.fill(0)}
 }
 const productBinding:Readonly<ReviewedExecutionArtifactBinding>=Object.freeze({profile:HOSTED_SETUP_REVIEWED_ARTIFACT_PROFILE,projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:inspection.reviewedProductHead,remoteHead:currentHead.head,requiredChecksPassed:true,publicationReceiptSha256:publicationArtifact.sha256,publicationReviewSha256:payload.publication.review.sha256,artifactPublicationSha256:inspection.publicationSha256,executionArtifactProfile:ARTIFACT_PROFILE,artifactSourceProfile:ARTIFACT_SOURCE_PROFILE,artifactTrustBoundary:'trusted-operator-host',artifactClaim:'verified-at-rest-artifact-and-private-sql-only',executionArtifactSha256:inspection.executionArtifactSha256,migrationManifestSha256:inspection.migrationManifestSha256,runtimeLoadedCodeAttested:false,launchAuthorized:false,operatorId:inspection.operatorId,independentReviewerId:inspection.independentReviewerId,materialFindingsOpen:0})
 const verifyProduct=(receipt:PinnedArtifact,review:PinnedArtifact)=>{ensureInputArtifact(receipt,publicationArtifact,'PUBLICATION_CALLBACK_CHANGED');ensureInputArtifact(review,payload.publication.review,'PUBLICATION_REVIEW_CALLBACK_CHANGED');verifyPublicationAt(Date.now());return productBinding}
 const input:HostedSetupUpgradeInput=Object.freeze({profile:'neuvetra.hosted-setup.upgrade-input.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,reviewedProductHead:inspection.reviewedProductHead,operatorId:inspection.operatorId,restoreReviewerId:payload.restore.policy.restoreReviewerId,publicationReviewerId:inspection.independentReviewerId,stopReviewerId:identity(deploymentPolicy.independentReviewerId,'STOP_REVIEWER_REFUSED'),journalPath:context.transactionJournalPath,restoreReceipt:restoreEvidence.restoreObservation,restoreReview:restoreEvidence.restoreReview,fingerprintDerivation:restoreEvidence.fingerprintDerivation,fingerprintDerivationReview:restoreEvidence.fingerprintReview,publicationReceipt:publicationArtifact,publicationReview:payload.publication.review,stopReceipt:payload.maintenance.stopReceipt,stopReview:payload.maintenance.stopReview})
 check(input.stopReviewerId!==input.operatorId,'STOP_REVIEWER_REFUSED')
 return Object.freeze({clientOptions:Object.freeze({connectionString:payload.database.connectionString,target:Object.freeze({kind:'hosted-supabase' as const,expectedProjectRef:HOSTED_SETUP_PROJECT,caPem:payload.database.caPem}),connectionTimeoutMs:15000,transactionTimeoutMs:180000,localDeadlineGraceMs:2000,teardownTimeoutMs:5000,applicationName:`neuvetra-hosted-setup-${payload.attemptId}`}),input,dependencies:Object.freeze({verifyAcceptedRestore:verifyRestore,verifyReviewedExecutionArtifact:verifyProduct,currentProductHead:()=>{const current=prHead(payload.publication.currentHeadEvidence,payload.trustedPins.currentHeadEvidenceSha256,Date.now(),true);check(current.head===inspection.reviewedProductHead,'CURRENT_PR_HEAD_CHANGED');return current.head},verifyReviewedMaintenanceStop:verifyMaintenance,observeMaintenanceStopped,withSequenceFence})})
}

/**
 * Reconciliation intentionally has no acceptance path yet. The isolated worker
 * receives serialized payload data but has no authenticated observation of the
 * original backend/session. Returning true from such a payload would make an
 * uncertain COMMIT replayable. A future producer must bind a unique original
 * application_name/backend identity to durable worker-exit and pg_stat_activity
 * evidence before this function may return a preparation.
 */
export async function prepareHostedSetupArtifactReconciliation(context:FixedBindingContext):Promise<FixedReconciliationPreparation>{
 validateContext(context,'reconcile');const payload=record(plain(context.payload));exact(payload,['profile'],'RECONCILIATION_PAYLOAD_SHAPE_REFUSED')
 check(payload.profile===FIXED_ARTIFACT_RECONCILIATION_PAYLOAD_PROFILE,'RECONCILIATION_PAYLOAD_PROFILE_REFUSED')
 refuse('ORIGINAL_TRANSACTION_RESOLUTION_PRODUCER_REQUIRED')
}
