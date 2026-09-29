import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { buildM80HostedPreparationPlan, m80HostedCanonicalJson } from '../../.superpowers/m80-foundation-hosted-prepare-v3'
import { validateM80HostedPlan } from '../../.superpowers/m80-foundation-hosted-once-v3'
import { validateM80ExecutorReview } from '../../.superpowers/m80-foundation-executor-v2'

const sha = (b: Uint8Array|string) => createHash('sha256').update(b).digest('hex')
const load = async (p:string) => JSON.parse(await readFile(p,'utf8'))
const planPath='.superpowers/m80-foundation-hosted-live002-plan.json'
const inputPath='.superpowers/m80-foundation-hosted-live002-input.json'
const provenancePath='.superpowers/m80-foundation-hosted-live002-provenance.json'
const plan=validateM80HostedPlan(await load(planPath))
const input=await load(inputPath), provenance=await load(provenancePath)
const pins: Array<{path:string,sha256:string}> = []
const verifyPin=async (pin:{path:string,sha256:string}) => { if(sha(await readFile(pin.path))!==pin.sha256) throw Error('Changed byte pin: '+pin.path);pins.push(pin) }
for(const pin of [...provenance.source_pins,...provenance.accepted_release_pins,provenance.input]) await verifyPin(pin)
const rebuilt=await buildM80HostedPreparationPlan(input,{now:new Date(plan.createdAt),verifyPin,loadJsonEvidence:async pin=> {await verifyPin(pin);return load(pin.path)}})
if(m80HostedCanonicalJson(rebuilt)!==m80HostedCanonicalJson(plan))throw Error('Actual plan does not equal exact input reconstruction')
const executorReviewPath='evaluations/research-qa/m80-normalized-executor-independent-20260925-review.json'
await validateM80ExecutorReview({path:executorReviewPath,sha256:sha(await readFile(executorReviewPath))})
const backup=await load(plan.pins.backupReceipt.path)
const archive='.superpowers/m80-backup-hosted-recovered21-001.dpapi'
if(sha(await readFile(archive))!==backup.encryptedArchiveSha256)throw Error('Encrypted archive hash changed')
const directory='.superpowers/m80-backup-v2-rehearsal-1790309555694'
const result=await load(directory+'/m80-backup-v2-result.json')
const journal=(await readFile(directory+'/m80-backup-v2-journal.jsonl','utf8')).trim().split('\n').map(JSON.parse)
if(journal.length!==2||journal[0].status!=='m80_backup_v2_started'||journal[1].status!=='m80_backup_v2_completed'||journal[1].completedAt!==result.completedAt||result.completedAt!==plan.rehearsal.completedAt)throw Error('Actual rehearsal journal chronology changed')
if(journal.some(x=>x.sourceBackupReceiptSha256!==plan.pins.backupReceipt.sha256||x.database!==plan.rehearsal.disposableDatabaseName))throw Error('Actual rehearsal journal target changed')
for(const [kind,key]of Object.entries({restore:'restoreReceipt',normalization:'normalizationProof',preservation:'preservationReceipt',migration:'migrationRehearsalReceipt'})) {
 if(result.receiptHashes[kind]!==plan.pins[key].sha256||journal[1].receiptHashes[kind]!==plan.pins[key].sha256)throw Error('Actual receipt/result/journal pin differs')
}
const output={profile:'neuvetra.m80.actual-plan-independent-check.v1',observedAt:new Date().toISOString(),plan:{path:planPath,sha256:sha(await readFile(planPath))},input:{path:inputPath,sha256:sha(await readFile(inputPath))},provenance:{path:provenancePath,sha256:sha(await readFile(provenancePath))},bytePinsChecked:pins.length,exactOriginalPlanRebuilt:true,currentRecursiveExecutorClosureVerified:true,encryptedArchiveHashVerifiedWithoutUnseal:true,journalAndFourReceiptsExact:true,sourceTableCount:plan.target.observedNonReceiptTableCount,sourceSchemaVersion:21,rehearsalTargetSchemaVersion:22,sourceRawStateSha256:plan.target.applicationStateSha256,normalizedMetadataSha256:plan.rehearsal.sourceNormalizedMetadataSha256,rawMetadataHashesEqual:plan.rehearsal.rawMetadataHashesEqual,deploymentCommit:plan.actions.deployment.commitSha,createdAt:plan.createdAt,expiresAt:plan.expiresAt,stageGateIssued:false,limits:'Original creation-time freshness retained; fresh stage provider/database/membership/CI review still required. No Git/provider/DB/archive-unseal actions.'}
await writeFile('evaluations/research-qa/m80-normalized-actual-upgrade-independent-20260925-plan-check.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify(output))
