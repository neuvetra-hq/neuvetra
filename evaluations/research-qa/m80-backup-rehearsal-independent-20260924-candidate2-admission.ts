import {readFile} from 'node:fs/promises'
import {helperPins} from '../../.superpowers/m80-backup-hosted-entry'
import {sha,hash,check,exactKeys,digest} from '../../.superpowers/m80-backup-core'
const snapshotPath='operations/agent-improvement/snapshots/M80-BACKUP-REHEARSAL-PREP-20260924-CANDIDATE2.json'
const snapshotBytes=await readFile(snapshotPath),snapshot=JSON.parse(snapshotBytes.toString()),source=snapshot.artifacts.find((a:any)=>a.path.endsWith('hosted-entry.ts')).text as string
check(sha(snapshotBytes)==='41ea2b5b3bdc9d11a9b523bc6bc1af76537350dca2feeb77aacda3cab719e37c','Frozen candidate mismatch')
const helpers=await helperPins();check(helpers.helperSha256==='c88d2fb688c29cf70ec24e4c9652205c0cf9e3362e06cc92bd2ffff6e741f4d0','Live source closure mismatch')
const constants=Object.fromEntries([...source.matchAll(/(?:export )?const (\w+) = "([^"]*)"(?: as const)?/g)].map(m=>[m[1],m[2]]))
const privateCode=source.slice(source.indexOf('export async function validateAcceptedPreparationEvidence'),source.indexOf('async function assertPrivateNewPath')).replace('export async','async')+source.slice(source.indexOf('async function validateAdmission'),source.indexOf('export async function backupHostedSource'))
const compiled=new Bun.Transpiler({loader:'ts'}).transformSync(privateCode),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor
const reviewPath=constants.BACKUP_HELPER_REVIEW_PATH as string
const review:any={profile:constants.BACKUP_HELPER_REVIEW_PROFILE,reviewer:'/root/m80_foundation_runtime_qa',verdict:'pass_m80_backup_transport_only',source_snapshot:{path:snapshotPath,sha256:sha(snapshotBytes)},source_pins:snapshot.artifacts.map((a:any)=>({path:a.path,sha256:a.sha256})),preparation_candidate:{path:constants.ACCEPTED_PREPARATION_CANDIDATE_PATH,sha256:constants.ACCEPTED_PREPARATION_CANDIDATE_SHA256},preparation_review:{path:constants.ACCEPTED_PREPARATION_REVIEW_PATH,sha256:constants.ACCEPTED_PREPARATION_REVIEW_SHA256},backup_helper_sha256:helpers.helperSha256,material_findings_open:0}
const state={applicationStateSha256:'a'.repeat(64),observedNonReceiptTables:['neuvetra.synthetic_qa']}
const admission:any={profile:constants.ADMISSION_PROFILE,observedAt:new Date().toISOString(),operatorId:'/root',projectRef:'icockcoguyadhryzydvl',targetClassification:'private_synthetic_staging',sourceSchemaVersion:21,migrationReceiptCount:21,...state,observedNonReceiptTableCount:1,syntheticDataOnlyVerified:true,applicationOnly:true,providerRecoveryExcluded:true,candidateSha256:constants.RUNTIME_CANDIDATE_SHA256,migrationSha256:'0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35',preparationCandidateSha256:constants.ACCEPTED_PREPARATION_CANDIDATE_SHA256,backupHelperSha256:helpers.helperSha256,independentReview:{path:reviewPath,sha256:''},rootBackupExecutionAccepted:true}
const results:any[]=[]
async function exercise(name:string,modify:(r:any,a:any)=>void,pass=false){
 const r=structuredClone(review),a=structuredClone(admission);modify(r,a);const rb=Buffer.from(JSON.stringify(r));a.independentReview.sha256=sha(rb);const ab=Buffer.from(JSON.stringify(a))
 const bindings={...constants,PROJECT_REF:admission.projectRef,MIGRATION_SHA256:admission.migrationSha256,readFile:async(p:string)=>p===reviewPath?rb:p==='virtual-admission.json'?ab:readFile(p),sha,hash,check,exactKeys,digest,helperPins:async()=>helpers}
 let error='';try{await new AsyncFunction(...Object.keys(bindings),compiled+';return validateAdmission("virtual-admission.json",'+JSON.stringify(sha(ab))+','+JSON.stringify(state)+')')(...Object.values(bindings))}catch(e){error=String(e)}
 check(Boolean(error)!==pass,'Unexpected admission result '+name+': '+error);results.push({name,accepted:!error,error})
}
await exercise('closed_positive',()=>{},true)
for(const reviewer of [null,'','/root','/root/m80_setup_ui',[],{},['/root/m80_foundation_runtime_qa']])await exercise('reviewer_'+JSON.stringify(reviewer),r=>r.reviewer=reviewer)
for(const verdict of ['pass','fail',null,['pass_m80_backup_transport_only']])await exercise('verdict_'+JSON.stringify(verdict),r=>r.verdict=verdict)
await exercise('unrelated_pass_strings',r=>{r.verdict='fail';r.unrelated=[helpers.helperSha256,'pass']})
await exercise('missing_closure_pin',r=>r.source_pins.pop())
await exercise('reordered_closure',r=>r.source_pins.reverse())
await exercise('changed_closure_hash',r=>r.source_pins[0].sha256='f'.repeat(64))
await exercise('wrong_preparation_review',r=>r.preparation_review.sha256='f'.repeat(64))
await exercise('wrong_snapshot_path',r=>r.source_snapshot.path='../foreign.json')
await exercise('findings_string_zero',r=>r.material_findings_open='0')
await exercise('review_unknown_field',r=>r.extra=true)
for(const [key,value] of [['sourceSchemaVersion','21'],['migrationReceiptCount','21'],['observedNonReceiptTableCount','1'],['syntheticDataOnlyVerified',1],['rootBackupExecutionAccepted','true'],['operatorId','/root/m80_setup_ui'],['backupHelperSha256','0'.repeat(64)],['applicationStateSha256','0'.repeat(64)],['observedAt','2000-01-01T00:00:00.000Z']])await exercise('admission_'+key,(_r,a)=>a[key]=value)
await exercise('admission_unknown_field',(_r,a)=>a.extra=true)
await Bun.write('evaluations/research-qa/m80-backup-rehearsal-independent-20260924-candidate2-admission.json',JSON.stringify({boundary:'Exact frozen private functions; actual accepted prep bundle and 109 source/toolchain pins; synthetic virtual review and admission files only; no DB/network/credentials',closureCount:helpers.pins.length,helperSha256:helpers.helperSha256,results},null,2)+'\n')
console.log(JSON.stringify({cases:results.length,negativeCases:results.length-1,closureCount:helpers.pins.length,helperSha256:helpers.helperSha256}))
