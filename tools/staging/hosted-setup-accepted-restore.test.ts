import {expect,test} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {sha256,type PinnedArtifact} from './hosted-setup-upgrade'
import {HOSTED_SETUP_ACCEPTED_RESTORE_PINS,verifyAcceptedHostedSetupRestore} from './hosted-setup-accepted-restore'

const base=join(import.meta.dir,'../../evaluations/research-qa')
async function artifact(name:string):Promise<PinnedArtifact>{
 const bytes=await readFile(join(base,name),'utf8')
 return{bytes,sha256:sha256(bytes)}
}
async function accepted(){return Promise.all([
 artifact('hosted-setup-01-actual-restore-observation-corrected-20260926.json'),
 artifact('hosted-setup-01-actual-restore-independent-review-20260926.md'),
 artifact('hosted-setup-01-actual-fingerprint-derivation-20260926.json'),
 artifact('hosted-setup-01-actual-fingerprint-independent-review2.md'),
])as Promise<[PinnedArtifact,PinnedArtifact,PinnedArtifact,PinnedArtifact]>}

test('exact separately reviewed historical restore binds the schema-22 fingerprint',async()=>{
 const [receipt,review,derivation,derivationReview]=await accepted()
 const binding=verifyAcceptedHostedSetupRestore(receipt,review,derivation,derivationReview)
 expect(binding.expectedDatabaseFingerprintSha256).toBe(HOSTED_SETUP_ACCEPTED_RESTORE_PINS.databaseFingerprint)
 expect(binding.sourceStateSha256).not.toBe(binding.restoredStateSha256)
 expect(binding).toMatchObject({schemaVersion:22,exactApplicationPreserved:true,tenantControlsVerified:true,
  databaseFingerprintIndependentlyDerived:true,materialFindingsOpen:0})
})

test('each substituted, truncated or self-attested evidence artifact is refused',async()=>{
 const good=await accepted()
 for(let index=0;index<good.length;index++){
  const altered=[...good] as typeof good
  altered[index]={...good[index]!,bytes:good[index]!.bytes+'\n'}
  await expect(()=>verifyAcceptedHostedSetupRestore(...altered)).toThrow()
  altered[index]={...good[index]!,sha256:sha256(good[index]!.bytes+'\n')}
  await expect(()=>verifyAcceptedHostedSetupRestore(...altered)).toThrow()
 }
})

test('stateful artifact getters cannot swap reviewed bytes after hashing',async()=>{
 const good=await accepted()
 for(const index of [0,2]as const){
  const altered=[...good] as typeof good
  let reads=0
  const forged=JSON.stringify({...JSON.parse(good[index].bytes),status:'forged-unreviewed-observation',clusterStopped:false})
  altered[index]={
   get bytes(){return++reads===1?good[index].bytes:forged},
   sha256:good[index].sha256,
  }
  const binding=verifyAcceptedHostedSetupRestore(...altered)
  expect(binding.expectedDatabaseFingerprintSha256).toBe(HOSTED_SETUP_ACCEPTED_RESTORE_PINS.databaseFingerprint)
  expect(reads).toBe(1)
  let reverseReads=0
  altered[index]={get bytes(){return++reverseReads===1?forged:good[index].bytes},sha256:good[index].sha256}
  expect(()=>verifyAcceptedHostedSetupRestore(...altered)).toThrow()
  expect(reverseReads).toBe(1)
 }
 for(const index of [1,3]as const){
  const altered=[...good] as typeof good
  let reads=0
  altered[index]={get bytes(){reads++;return good[index].bytes},sha256:good[index].sha256}
  verifyAcceptedHostedSetupRestore(...altered)
  expect(reads).toBe(1)
 }
})
