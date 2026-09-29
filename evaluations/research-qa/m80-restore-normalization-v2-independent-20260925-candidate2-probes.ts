import {readFile} from 'node:fs/promises'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {captureApplicationState,check,hash,EXPECTED_NEW_TABLES,EXPECTED_NEW_SEQUENCES} from '../../.superpowers/m80-backup-core'
import {assertM80BackupV2ExactRestore} from '../../.superpowers/m80-backup-v2-core'
import {assertM80BackupV2RuntimePrivileges,assertM80BackupV2PermissionDenied} from '../../.superpowers/m80-backup-v2-rehearsal'
const TABLE_PRIVILEGES=['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
const SEQUENCE_PRIVILEGES=['SELECT','USAGE','UPDATE']
const tables=()=>EXPECTED_NEW_TABLES.flatMap(name=>TABLE_PRIVILEGES.map(privilege=>({name,privilege,allowed:privilege==='SELECT'})))
const sequences=()=>EXPECTED_NEW_SEQUENCES.flatMap(name=>SEQUENCE_PRIVILEGES.map(privilege=>({name,privilege,allowed:false})))
let negatives=0
function refuses(fn:()=>unknown){let refused=false;try{fn()}catch{refused=true};check(refused,'QA_NEGATIVE_ACCEPTED');negatives++}
assertM80BackupV2RuntimePrivileges(tables(),sequences())
for(let i=0;i<tables().length;i++){const t=tables();t[i]!.allowed=!t[i]!.allowed;refuses(()=>assertM80BackupV2RuntimePrivileges(t,sequences()))}
for(let i=0;i<sequences().length;i++){const s=sequences();s[i]!.allowed=true;refuses(()=>assertM80BackupV2RuntimePrivileges(tables(),s))}
for(const field of ['name','privilege','allowed'])for(const val of [null,0,{},'unexpected']){const t=tables();(t[0] as any)[field]=val;refuses(()=>assertM80BackupV2RuntimePrivileges(t,sequences()))}
const duplicated=tables();duplicated[0]={...duplicated[1]!};refuses(()=>assertM80BackupV2RuntimePrivileges(duplicated,sequences()))
const seqduplicated=sequences();seqduplicated[0]={...seqduplicated[1]!};refuses(()=>assertM80BackupV2RuntimePrivileges(tables(),seqduplicated))

// Exercise exact private orchestration function with injected connection objects.
const text=await readFile('.superpowers/m80-backup-v2-rehearsal.ts','utf8')
const a=text.indexOf('async function verifyRuntimeBoundary('),b=text.indexOf('\nasync function createOutputs(',a)
check(a>0&&b>a,'QA_EXTRACTION_BOUNDARY')
const code=new Bun.Transpiler({loader:'ts'}).transformSync(text.slice(a,b))
const runtimeCases=[]
for(const error of [{code:'42501'},{code:'23503'},{code:'ECONNRESET'},{code:42501},new Error('generic'),null,undefined]){
 const events:string[]=[]
 const operator={query:async(sql:string)=>({rows:sql.includes('has_sequence_privilege')?sequences():tables()}),close:async()=>{events.push('operator-close')}}
 const runtime={transaction:async(fn:any)=>fn({query:async(sql:string)=>({rows:sql.includes('select status')?Array.from({length:4},()=>({status:'held_candidate'})):[]}),exec:async()=>{}}),exec:async(sql:string)=>{check(sql==='delete from neuvetra.scope1_beta_release_records where false','QA_VALID_NOOP');events.push('write-probe');if(error!==undefined)throw error},close:async()=>{events.push('runtime-close')}}
 const verify=new Function('createPostgresConnection','check','EXPECTED_NEW_TABLES','TABLE_PRIVILEGES','EXPECTED_NEW_SEQUENCES','SEQUENCE_PRIVILEGES','assertM80BackupV2RuntimePrivileges','assertM80BackupV2PermissionDenied',code+'\nreturn verifyRuntimeBoundary;')((url:string)=>url.includes('supabase_admin')?operator:runtime,check,EXPECTED_NEW_TABLES,TABLE_PRIVILEGES,EXPECTED_NEW_SEQUENCES,SEQUENCE_PRIVILEGES,assertM80BackupV2RuntimePrivileges,assertM80BackupV2PermissionDenied)
 let accepted=false
 try{await verify('m80_backup_foundation_1234567890123','00000000-0000-4000-8000-000000000001');accepted=true}catch{}
 check(accepted===((error as any)?.code==='42501'),'QA_ERROR_DISCRIMINATION')
 check(events.slice(-2).join(',')==='runtime-close,operator-close','QA_CONNECTIONS_CLOSED')
 runtimeCases.push({errorCode:(error as any)?.code??(error===undefined?'no_error':'missing_code'),accepted,connectionsClosed:true})
}
const db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m78_ops_continuation_20260922',{tls:false,maxConnections:1})
let base:Awaited<ReturnType<typeof captureApplicationState>>
try{base=await db.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return captureApplicationState(tx)})}finally{await db.close()}
const rawHashCases=[]
for(const side of ['source','restored','both'])for(const field of ['contentSha256','metadataSha256','applicationStateSha256']){
 const l=structuredClone(base),r=structuredClone(base)
 if(side!=='restored')(l as any)[field]='0'.repeat(64)
 if(side!=='source')(r as any)[field]='0'.repeat(64)
 refuses(()=>assertM80BackupV2ExactRestore(l,r));rawHashCases.push({side,field,refused:true})
}
for(const side of ['source','restored']){
 const l=structuredClone(base),r=structuredClone(base),x=side==='source'?l:r
 x.metadataSha256='0'.repeat(64);x.applicationStateSha256=hash({contentSha256:x.contentSha256,metadataSha256:x.metadataSha256})
 refuses(()=>assertM80BackupV2ExactRestore(l,r));rawHashCases.push({side,field:'coordinated metadata and application hash',refused:true})
}
const directory='.superpowers/m80-backup-v2-rehearsal-1790306499437'
const receipts=await Promise.all(['restore-receipt','normalization-proof','preservation-receipt','migration-receipt'].map(async n=>JSON.parse(await readFile(`${directory}/m80-backup-v2-${n}.json`,'utf8'))))
check(new Set(receipts.map(r=>r.completedAt)).size===1,'QA_COMMON_COMPLETION')
check(receipts[1].sourceExternalDefaultAclRowsExcluded===0,'QA_SYNTHETIC_ACL_LIMIT')
check(receipts[1].sourceNormalizedMetadataSha256===receipts[1].restoredNormalizedMetadataSha256,'QA_NORMALIZED_EQUAL')
check(receipts[2].sourceNormalizedMetadataSha256===receipts[1].sourceNormalizedMetadataSha256,'QA_PROOF_RECEIPT_BINDING')
await Bun.write('evaluations/research-qa/m80-restore-normalization-v2-independent-20260925-candidate2-probes.json',JSON.stringify({negativeCases:negatives,tablePrivilegeCells:tables().length,sequencePrivilegeCells:sequences().length,runtimeCases,rawHashCases,native:{directory,completedAt:receipts[0].completedAt,receiptTimestampsEqual:true,syntheticExternalAclRows:0},actualHostedArchiveAccess:false,readOnlySourceConnectionClosed:true})+'\n')
