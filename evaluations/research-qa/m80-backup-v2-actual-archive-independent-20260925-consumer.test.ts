import {test,expect} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {input,build,gateBundle,artifactPin,semanticEvidence,NOW,seal,record,observation,chainArgs,resignPlan} from './m80-normalized-prep-consumer-independent-20260925-fixture'
import {sealM80HostedIntent as oldSeal} from './m80-normalized-prep-consumer-independent-20260925-candidate1-once'
import {sealM80HostedIntent,m80HostedIntentPath,m80HostedOutcomePath,recordM80HostedOutcome} from '../../.superpowers/m80-foundation-hosted-once-v3'
import {m80HostedIntentPath as pathV2,m80HostedOutcomePath as outcomeV2} from '../../.superpowers/m80-foundation-hosted-once-v2'
import {m80HostedIntentPath as pathV1,m80HostedOutcomePath as outcomeV1} from '../../.superpowers/m80-foundation-hosted-once'
import {buildM80HostedPreparationPlan,validateM80HostedPreparationInput,m80ExpectedHostedEvidence,m80HostedCanonicalJson,m80HostedSha256} from '../../.superpowers/m80-foundation-hosted-prepare-v3'

test('consumes the four actual archived-backup rehearsal receipts without changing their bytes',async()=>{
 const v=input(),dir='.superpowers/m80-backup-v2-rehearsal-1790306929913'
 const names=['restore-receipt','normalization-proof','preservation-receipt','migration-receipt']
 const blobs=await Promise.all(names.map(n=>readFile(`${dir}/m80-backup-v2-${n}.json`)))
 const [restore,normal,preserve,migrate]=blobs.map(b=>JSON.parse(b.toString('utf8')))
 const completed=new Date(normal.completedAt),now=new Date(completed.getTime()+60_000)
 const r:any=v.rehearsal
 for(const receipt of [restore,normal,preserve,migrate])for(const [key,value] of Object.entries(receipt))if(key in r)r[key]=value
 v.observedTarget.observedAt=new Date(completed.getTime()-180_000).toISOString()
 v.backup.completedAt=new Date(completed.getTime()-120_000).toISOString()
 v.publication.headObservedAt=v.publication.checksObservedAt=v.admission.verifiedAt=now.toISOString()
 v.observedTarget.applicationStateSha256=v.backup.sourceApplicationStateSha256=normal.sourceRawApplicationStateSha256
 v.observedTarget.observedNonReceiptTables=restore.observedNonReceiptTables
 v.observedTarget.observedNonReceiptTableCount=r.sourceObservedNonReceiptTableCount=restore.observedNonReceiptTableCount
 r.sourceObservedNonReceiptTablesSha256=m80HostedSha256(m80HostedCanonicalJson(restore.observedNonReceiptTables))
 v.backup.backupReceipt.sha256=normal.sourceBackupReceiptSha256
 const fields=['restoreReceipt','normalizationProof','preservationReceipt','migrationReceipt']
 const actual=new Map<string,Buffer>()
 names.forEach((n,i)=>{const path=`${dir}/m80-backup-v2-${n}.json`;r[fields[i]!]={path,sha256:m80HostedSha256(blobs[i]!)};actual.set(path,blobs[i]!)})
 v.publication.integrationAcceptance=artifactPin(v.publication.integrationAcceptance.path,m80ExpectedHostedEvidence(v,'integration'))
 const map=semanticEvidence(v);let reopened=0
 const plan=await buildM80HostedPreparationPlan(v,{now,verifyPin:async p=>{const b=actual.get(p.path);if(b){expect(m80HostedSha256(b)).toBe(p.sha256);reopened++}},loadJsonEvidence:async p=>actual.has(p.path)?JSON.parse(actual.get(p.path)!.toString('utf8')):map.get(p.path)})
 expect(reopened).toBe(4);expect(plan.rehearsal.rawMetadataHashesEqual).toBe(false);expect(plan.executionAuthorized).toBe(false)
 await Bun.write('evaluations/research-qa/m80-backup-v2-actual-archive-independent-20260925-consumer-compatibility.json',JSON.stringify({actualArchiveRehearsalReceiptFiles:4,bytePinsVerified:true,closedTypedContentsMatch:true,unchangedReceiptBytes:true,externalAclRows:normal.sourceExternalDefaultAclRowsExcluded,rawMetadataHashesEqual:plan.rehearsal.rawMetadataHashesEqual,limits:'Four actual archived-backup local rehearsal receipts are reopened unchanged. Surrounding provider/publication/membership context is synthetic compatibility context, not fresh execution evidence; no actual stage plan or gate written.'})+'\n')
})
