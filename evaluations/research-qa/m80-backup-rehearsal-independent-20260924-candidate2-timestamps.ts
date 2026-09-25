import {readFile} from 'node:fs/promises'
import {input,semanticEvidence} from './m80-hosted-prep-independent-20260924-candidate4-fixture'
import {buildM80HostedPreparationPlan,m80ExpectedHostedEvidence,m80HostedCanonicalJson,m80HostedSha256} from './m80-hosted-prep-independent-20260924-candidate5-frozen-prepare'
const root='.superpowers/m80-backup-hosted-rehearsal-1790293672448/'
const receipts=await Promise.all(['restore-receipt','preservation-receipt','migration-rehearsal-receipt'].map(async name=>{const bytes=await readFile(root+'m80-backup-'+name+'.json');return {name,bytes,body:JSON.parse(bytes.toString())}}))
const [restore,preservation,migration]=receipts.map(r=>r.body)
const value=input(),t=Date.parse(migration.completedAt),iso=(offset:number)=>new Date(t+offset).toISOString()
value.observedTarget.observedAt=iso(60_000);value.publication.headObservedAt=iso(60_000);value.publication.checksObservedAt=iso(60_000);value.admission.verifiedAt=iso(60_000)
value.backup.completedAt=iso(-60_000);value.backup.backupReceipt.sha256=restore.sourceBackupReceiptSha256
value.rehearsal.completedAt=migration.completedAt;value.rehearsal.disposableDatabaseName=migration.disposableDatabaseName;value.rehearsal.sourceBackupReceiptSha256=restore.sourceBackupReceiptSha256
value.observedTarget.observedNonReceiptTables=restore.observedNonReceiptTables;value.observedTarget.observedNonReceiptTableCount=restore.observedNonReceiptTableCount
value.rehearsal.sourceObservedNonReceiptTableCount=restore.observedNonReceiptTableCount;value.rehearsal.sourceObservedNonReceiptTablesSha256=preservation.observedNonReceiptTablesSha256
for(const key of ['sourceContentSha256','restoredContentSha256','sourceMetadataSha256','restoredMetadataSha256'] as const)value.rehearsal[key]=preservation[key]
value.publication.integrationAcceptance.sha256=m80HostedSha256(JSON.stringify(m80ExpectedHostedEvidence(value,'integration'),null,2)+'\n')
const evidence=semanticEvidence(value),now=new Date(t+120_000)
const options={now,verifyPin:async()=>{},loadJsonEvidence:async(p:{path:string})=>evidence.get(p.path)}
await buildM80HostedPreparationPlan(value,options)
const normalizedPositive=true
for(const [i,pin] of [value.rehearsal.restoreReceipt,value.rehearsal.preservationReceipt,value.rehearsal.migrationReceipt].entries())evidence.set(pin.path,receipts[i]!.body)
let rejection='';try{await buildM80HostedPreparationPlan(value,options)}catch(error){rejection=String(error)}
if(!rejection.includes('Evidence content contradicts'))throw Error('Expected actual receipt mismatch was not reproduced: '+rejection)
const checks=receipts.map((r,i)=>{const expected=m80ExpectedHostedEvidence(value,(['restore','preservation','rehearsal'] as const)[i]!);return {name:r.name,sha256:m80HostedSha256(r.bytes),completedAt:r.body.completedAt,onlyTimestampDiff:m80HostedCanonicalJson({...r.body,completedAt:value.rehearsal.completedAt})===m80HostedCanonicalJson(expected)}})
await Bun.write('evaluations/research-qa/m80-backup-rehearsal-independent-20260924-candidate2-timestamps.json',JSON.stringify({boundary:'Actual author-generated three private receipts loaded only for hashing/comparison; other preparation evidence synthetic; no DB/network/archive data read',normalizedPositive,rejection,checks},null,2)+'\n')
console.log(JSON.stringify({normalizedPositive,rejection,checks}))
