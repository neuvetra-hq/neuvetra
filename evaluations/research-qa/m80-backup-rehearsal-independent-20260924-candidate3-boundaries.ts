import {readFile} from 'node:fs/promises'
import {check,exactKeys} from '../../.superpowers/m80-backup-core'
const snapshot=JSON.parse(await readFile('operations/agent-improvement/snapshots/M80-BACKUP-REHEARSAL-PREP-20260924-CANDIDATE3.json','utf8'))
const source=(suffix:string)=>snapshot.artifacts.find((a:any)=>a.path.endsWith(suffix)).text as string
const entry=source('hosted-entry.ts'),local=source('local-rehearsal.ts'),transpile=(s:string)=>new Bun.Transpiler({loader:'ts'}).transformSync(s.replaceAll('export async function','async function'))
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor,results:any[]=[]
const code=transpile(entry.slice(entry.indexOf('export async function preflightHostedSource'),entry.indexOf('async function validateAdmission')))
for(const mode of ['preflight','inspect'])for(const sessions of [0,3]){
 let closed=false,readOnly=false,written:any=null;const tx={exec:async(sql:string)=>{check(sql.includes('repeatable read read only'),'Readonly required');readOnly=true},query:async(sql:string)=>({rows:sql.includes('pg_stat_activity')?[{count:sessions}]:[{companyId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',companyLabel:'Synthetic QA',managerUserId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',managerRole:'owner'}]})}
 const db={transaction:async(fn:any)=>fn(tx),close:async()=>{closed=true}}
 const bindings={operatorUrl:()=>{},connectOperator:async()=>db,helperPins:async()=>({pins:[]}),verifyExactSource21:async()=>{},captureApplicationState:async()=>({applicationStateSha256:'a'.repeat(64),observedNonReceiptTables:['neuvetra.synthetic_qa']}),check,PROJECT_REF:'icockcoguyadhryzydvl',PREFLIGHT_PROFILE:'neuvetra.m80.foundation-backup-source-preflight.v1',INSPECTION_PROFILE:'neuvetra.m80.foundation-backup-source-inspection.v1',exclusiveJson:async(_p:string,value:any)=>{written=value;return 'b'.repeat(64)}}
 let error='';try{await new AsyncFunction(...Object.keys(bindings),code+`;return ${mode}HostedSource('synthetic-no-url','virtual-output')`)(...Object.values(bindings))}catch(e){error=String(e)}
 check(closed&&readOnly,'Read-only transaction and closed connection required');check(Boolean(error)===(mode==='inspect'&&sessions>0),'Unexpected session boundary')
 if(written)check(written.activeRuntimeSessionCount===sessions&&written.profile===bindings[mode==='preflight'?'PREFLIGHT_PROFILE':'INSPECTION_PROFILE'],'Receipt session count/profile mismatch')
 results.push({mode,sessions,accepted:!error,closed,readOnly,receiptWritten:!!written})
}
const receiptCode=transpile(local.slice(local.indexOf('function validateHostedBackupReceipt'),local.indexOf('async function writeExclusive')))
const snap={sourceDatabase:'postgres',customDumpSha256:'a'.repeat(64),sourceApplicationStateSha256:'b'.repeat(64)}
const receipt={profile:'neuvetra.m80.foundation-hosted-backup-receipt.v1',completedAt:new Date().toISOString(),projectRef:'icockcoguyadhryzydvl',sourceSchemaVersion:21,sourceApplicationStateSha256:snap.sourceApplicationStateSha256,applicationOnly:true,syntheticDataOnly:true,providerRecoveryExcluded:true,encryptedArchiveSha256:'c'.repeat(64),snapshotSha256:'d'.repeat(64),customDumpSha256:snap.customDumpSha256}
const fn=new Function('check','exactKeys','BACKUP_PROFILE',receiptCode+';return validateHostedBackupReceipt')(check,exactKeys,receipt.profile)
fn(receipt,'e'.repeat(64),'c'.repeat(64),snap,'d'.repeat(64))
for(const [key,value] of [['completedAt','2000-01-01T00:00:00.000Z'],['completedAt',new Date(Date.now()+60_000).toISOString()],['completedAt',[receipt.completedAt]],['sourceSchemaVersion','21'],['projectRef','foreign'],['applicationOnly',1],['syntheticDataOnly',false],['providerRecoveryExcluded',false],['encryptedArchiveSha256','0'.repeat(64)],['snapshotSha256','0'.repeat(64)],['customDumpSha256','0'.repeat(64)],['sourceApplicationStateSha256','0'.repeat(64)],['extra',true]]){
 let rejected=false;try{fn({...receipt,[key as string]:value},'e'.repeat(64),'c'.repeat(64),snap,'d'.repeat(64))}catch{rejected=true}check(rejected,'Malformed receipt admitted '+key);results.push({case:'receipt_'+key,rejected})
}
let foreignSourceRejected=false;try{fn(receipt,'e'.repeat(64),'c'.repeat(64),{...snap,sourceDatabase:'foreign'},'d'.repeat(64))}catch{foreignSourceRejected=true}check(foreignSourceRejected,'Foreign source admitted')
results.push({case:'foreign_snapshot_source',rejected:foreignSourceRejected})
await Bun.write('evaluations/research-qa/m80-backup-rehearsal-independent-20260924-candidate3-boundaries.json',JSON.stringify({boundary:'Exact frozen preflight/inspect and receipt validator functions; synthetic DB and writer bindings; no actual DB/network/credential action',results},null,2)+'\n')
console.log(JSON.stringify({sessionCases:4,receiptNegativeCases:14,receiptPositive:1}))
