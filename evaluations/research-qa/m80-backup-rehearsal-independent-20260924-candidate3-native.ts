import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {runHostedBackupRestoreRehearsal} from '../../.superpowers/m80-backup-local-rehearsal'
import {sha,check} from '../../.superpowers/m80-backup-core'
const snapshotPath='operations/agent-improvement/snapshots/M80-BACKUP-REHEARSAL-PREP-20260924-CANDIDATE3.json'
const snapshotBytes=await readFile(snapshotPath);check(sha(snapshotBytes)==='d29eb944ce0db89d30258ff514c8c3226b518bf59fd669d7e09b2040b8c8431d','Wrong source snapshot')
const snapshot=JSON.parse(snapshotBytes.toString())
async function verify(){for(const a of snapshot.artifacts)check(sha(await readFile(a.path))===a.sha256&&sha(a.text)===a.sha256,'Changed reviewed source '+a.path)}
await verify()
const input={operatorId:'/root' as const,archivePath:resolve('.superpowers/m80-backup-simulated-hosted-1790293458612.dpapi'),archiveSha256:'0ee2cd11ae2fb065449234e70681a9ea5450065696436abf2c9c1b0ba2cd8681',backupReceiptPath:resolve('.superpowers/m80-backup-simulated-hosted-receipt-1790293458612.json'),backupReceiptSha256:'1a55a0696c982a39d0b55b3258d41fbc93da4da09c41a372a3136e780b781327'}
for(const bad of [{...input,archiveSha256:'0'.repeat(64)},{...input,backupReceiptSha256:'0'.repeat(64)}]){let refused=false;try{await runHostedBackupRestoreRehearsal(bad)}catch{refused=true}check(refused,'Tampered input admitted')}
try{
 const result=await runHostedBackupRestoreRehearsal(input)
 const body=JSON.parse(await readFile(resolve(result.outputDirectory,'m80-backup-result.json'),'utf8'))
 const receiptPins=[]
 for(const name of ['restore','preservation','migration-rehearsal']){const p=resolve(result.outputDirectory,'m80-backup-'+name+'-receipt.json'),bytes=await readFile(p),r=JSON.parse(bytes.toString());check(r.completedAt===body.completedAt,'Receipt time differs');receiptPins.push({name,sha256:sha(bytes),completedAt:r.completedAt})}
 await verify();check(sha(await readFile(input.archivePath))===input.archiveSha256&&sha(await readFile(input.backupReceiptPath))===input.backupReceiptSha256,'Original immutable input changed')
 const evidence={boundary:'Actual immutable local synthetic archive -> DPAPI unseal -> fresh loopback-only database -> schema22 migration/RLS check; no hosted or credential input',sourceSnapshotSha256:sha(snapshotBytes),archiveSha256:input.archiveSha256,backupReceiptSha256:input.backupReceiptSha256,inputHashNegatives:2,...result,resultSha256:sha(await readFile(resolve(result.outputDirectory,'m80-backup-result.json'))),commonCompletedAt:body.completedAt,receiptPins,derivedNonReceiptTableCount:body.observedNonReceiptTableCount,oldContentExact:body.oldContentExact,oldMetadataExact:body.oldMetadataExact,releaseRecordsExactFourHeld:body.releaseRecordsExactFourHeld,forcedRlsVerified:body.forcedRlsVerified,runtimeSelectOnlyVerified:body.runtimeSelectOnlyVerified,runtimeDirectWritesDenied:body.runtimeDirectWritesDenied,operatorAdmissionNotExecuted:body.operatorAdmissionNotExecuted,allConnectionsClosed:body.allConnectionsClosed,sourceInputsPreserved:true,cloneRetainedForEvidence:true}
 await Bun.write('evaluations/research-qa/m80-backup-rehearsal-independent-20260924-candidate3-native.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:'pass',database:result.database,commonCompletedAt:body.completedAt,derivedNonReceiptTableCount:body.observedNonReceiptTableCount}))
}catch(error){console.error(JSON.stringify({status:'failed',message:error instanceof Error?error.message:'Unknown',noSensitiveDetailsPrinted:true}));process.exitCode=1}
