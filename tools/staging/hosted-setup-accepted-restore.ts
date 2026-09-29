/** Fixed, historical schema-22 restore evidence for the one-time hosted setup upgrade.
 * This module performs no I/O. Current hosted state is checked by the upgrade
 * runner's fresh fingerprint under a separately held write gate.
 */
import {sha256,type AcceptedRestoreBinding,type PinnedArtifact} from './hosted-setup-upgrade'
import {HOSTED_SETUP_PROFILE,HOSTED_SETUP_PROJECT} from './hosted-setup-upgrade'

export const HOSTED_SETUP_ACCEPTED_RESTORE_PINS={
 restoreReceipt:'166c578f9909234ed7c127c7c9a957dcb2a726b46cea4ff1bfefd09e7f633f1a',
 restoreReview:'11d1a2dd91d71bb8fa2761a0580055f1cb181216f8b743b1a99f5fdf9124379f',
 fingerprintDerivation:'e75c9a68fe2a57614a4562f84534ff442ee807fc5aa93d0b2c7b5bfde0a58495',
 fingerprintDerivationReview:'1539d64122f457f65fe5a2774dbe3c76511611505ba93f6f13f4fb29e7e49164',
 sourceReceipt:'60c093af17ec31cfea52b5a1b7689b5adb6dd72d06053b2f59f7c269c8ad0819',
 sourceArchive:'22280e654a823d3922acfa56ddee1bc9ac0c9c17fa1c29fb672671071c488495',
 sourceSnapshot:'c061e8316581296f795c353feccca537e5b2db6e8796f164a096f34727766667',
 sourceState:'85763f14b6bd15768296e8f9acaf4b03e11c3f6d7a53312398ab831c526aba30',
 restoreResult:'dd9c646bb04707225d07f074b1b3db01b26f548101311a5c8cf906771923daa4',
 restoredState:'08c3e791556b33a7c2db3a9907894bb15a9a15577338fd777b18c9508d736786',
 databaseFingerprint:'871eb2c6d307566b5442f8a4f5ab9ad39a61da229de6e91095176e92b3d48446',
 externalDefaultAcls:'6f3e81b0e82225f8c46850c6753a9ef45ff8fdb7a0b8684b828432ba80fb0d97',
}as const

const check=(ok:unknown,code:string)=>{if(!ok)throw Error('HS_RESTORE_'+code)}
function exact(artifact:PinnedArtifact,expected:string,code:string):string{
 const bytes=artifact?.bytes,claimedSha256=artifact?.sha256
 check(typeof bytes==='string'&&claimedSha256===expected&&sha256(bytes)===expected,code)
 return bytes
}
function parse(bytes:string){
 try{return JSON.parse(bytes) as Record<string,unknown>}catch{throw Error('HS_RESTORE_INVALID_JSON')}
}

export function verifyAcceptedHostedSetupRestore(
 receipt:PinnedArtifact,review:PinnedArtifact,derivation:PinnedArtifact,derivationReview:PinnedArtifact,
):AcceptedRestoreBinding{
 const p=HOSTED_SETUP_ACCEPTED_RESTORE_PINS
 const receiptBytes=exact(receipt,p.restoreReceipt,'OBSERVATION_PIN_CHANGED')
 exact(review,p.restoreReview,'REVIEW_PIN_CHANGED')
 const derivationBytes=exact(derivation,p.fingerprintDerivation,'DERIVATION_PIN_CHANGED')
 exact(derivationReview,p.fingerprintDerivationReview,'DERIVATION_REVIEW_PIN_CHANGED')
 const r=parse(receiptBytes),d=parse(derivationBytes)
 check(r.profile==='neuvetra.hosted-setup.actual-restore-observation.v2'&&r.projectRef===HOSTED_SETUP_PROJECT,'RESTORE_IDENTITY_CHANGED')
 check(r.sourceArchiveSha256===p.sourceArchive&&r.sourceReceiptSha256===p.sourceReceipt&&r.restoreResultSha256===p.restoreResult,'RESTORE_SOURCE_CHANGED')
 check(r.sourceStateSha256===p.sourceState&&r.restoredStateSha256===p.restoredState,'RESTORE_STATE_CHANGED')
 check(r.applicationRowsExact===true&&r.applicationCatalogEquivalent===true&&r.tenantReadAccessExact===true,'RESTORE_PRESERVATION_NOT_ACCEPTED')
 check(r.hostedSchemaVersionAfter===22&&r.providerAuthRecoveryExcluded===true&&r.hostedMigrationAuthorized===false,'RESTORE_SCOPE_CHANGED')
 check(d.profile==='neuvetra.hosted-setup.fingerprint-derivation.v1'&&d.projectRef===HOSTED_SETUP_PROJECT&&d.targetProfile===HOSTED_SETUP_PROFILE&&d.schemaVersion===22,'DERIVATION_IDENTITY_CHANGED')
 check(d.sourceSnapshotSha256===p.sourceSnapshot&&d.sourceReceiptSha256===p.sourceReceipt&&d.sourceArchiveSha256===p.sourceArchive,'DERIVATION_SOURCE_CHANGED')
 check(d.sourceStateSha256===p.sourceState&&d.restoredStateSha256===p.restoredState&&d.restoreResultSha256===p.restoreResult,'DERIVATION_RESTORE_CHANGED')
 check(d.sourceExternalDefaultAclsSha256===p.externalDefaultAcls&&d.sourceExternalDefaultAclCount===27,'DERIVATION_ACL_SCOPE_CHANGED')
 check(d.expectedDatabaseFingerprintSha256===p.databaseFingerprint&&d.exactApplicationRowsPreserved===true&&d.applicationCatalogEquivalent===true&&d.roleMembershipEquivalent===true&&d.sequenceStateEquivalent===true&&d.tenantControlsVerified===true,'DERIVATION_PRESERVATION_NOT_ACCEPTED')
 check(d.sourceCurrentnessObserved===false&&d.liveHostedPreflightRequired===true&&d.upgradeAuthorized===false,'DERIVATION_SCOPE_CHANGED')
 return Object.freeze({
  profile:'neuvetra.hosted-setup.accepted-restore-binding.v1',projectRef:HOSTED_SETUP_PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,
  restoreReceiptSha256:p.restoreReceipt,restoreReviewSha256:p.restoreReview,
  fingerprintDerivationSha256:p.fingerprintDerivation,fingerprintDerivationReviewSha256:p.fingerprintDerivationReview,
  sourceSnapshotSha256:p.sourceSnapshot,sourceArchiveSha256:p.sourceArchive,sourceStateSha256:p.sourceState,restoredStateSha256:p.restoredState,
  expectedDatabaseFingerprintSha256:p.databaseFingerprint,databaseFingerprintIndependentlyDerived:true,exactApplicationPreserved:true,tenantControlsVerified:true,
  operatorId:'root',independentReviewerId:'/root/hosted_recovery_qa',materialFindingsOpen:0,
 })
}
