import {readFile,open,mkdir} from 'node:fs/promises'
import {createPostgresConnection} from '../../packages/neuvetra-database/src/hosted'
import {captureApplicationState,check,hash} from '../../.superpowers/m80-backup-core'
import {assertM80BackupV2ExactRestore as exactRestore,assertM80BackupV2RawTriggerDelta,assertM80BackupV2RawSchema22Delta} from '../../.superpowers/m80-backup-v2-core'

function bind(x:any){
 const v=x.inventory
 x.contentSha256=hash({tables:v.tables.filter((t:any)=>t.name!=='schema_migrations').map((t:any)=>({name:t.name,count:t.count,rowHashes:t.rowHashes})),migrationReceipts:x.migrationReceipts})
 x.metadataSha256=hash({nonReceiptTables:x.observedNonReceiptTables,tableSecurity:x.tableSecurity,schemaSecurity:x.schemaSecurity,internalTriggers:x.internalTriggers,functions:v.functions,tableObjects:v.tableObjects,sequences:v.sequences,roles:v.roles,memberships:v.memberships,defaultAcls:v.defaultAcls,dependencies:v.dependencies})
 x.applicationStateSha256=hash({contentSha256:x.contentSha256,metadataSha256:x.metadataSha256});return x
}
// Rebind intentional fixture changes so semantic negatives reach normalization gates.
function assertM80BackupV2ExactRestore(a:any,b:any){return exactRestore(bind(a),bind(b))}

const db=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m78_ops_continuation_20260922',{tls:false,maxConnections:1})
let base:Awaited<ReturnType<typeof captureApplicationState>>
try{base=await db.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');return captureApplicationState(tx)})}finally{await db.close()}
let cases=0
function refuses(fn:()=>unknown,label:string){let denied=false;try{fn()}catch{denied=true}check(denied,label);cases++}
const acl={owner:'postgres',schema:'external_qa',kind:'r',acl:'{postgres=arwdDxt/postgres}'}
for(const [field,values] of Object.entries({schema:[null,undefined,'','x\0',false,7,'é'.repeat(32)],owner:[null,'','x\0',{},'é'.repeat(32)],kind:[null,'','R','s','rr',5],acl:[null,'','x\0',{},7]})) for(const value of values){const x=structuredClone(base);x.inventory.defaultAcls.push({...acl,[field]:value} as never);refuses(()=>assertM80BackupV2ExactRestore(x,base),'malformed ACL '+field)}
for(const scope of ['*','neuvetra']){
 const left=structuredClone(base),right=structuredClone(base);left.inventory.defaultAcls.push({...acl,schema:scope});right.inventory.defaultAcls.push({...acl,schema:scope})
 check(assertM80BackupV2ExactRestore(left,right).normalizedMetadataExact,'retained scope positive');cases++
 for(const field of ['owner','kind','acl']){const x=structuredClone(right);(x.inventory.defaultAcls.at(-1) as any)[field]=field==='kind'?'S':'changed';refuses(()=>assertM80BackupV2ExactRestore(left,x),'retained ACL '+field)}
}
for(const key of ['roles','memberships','dependencies','functions','tableObjects','sequences'] as const){const x=structuredClone(base);check(x.inventory[key].length>0,'nonempty fixture');x.inventory[key].pop();refuses(()=>assertM80BackupV2ExactRestore(base,x),'remaining metadata '+key)}
const perm=structuredClone(base);perm.internalTriggers.reverse();check(assertM80BackupV2ExactRestore(base,perm).internalTriggerSemanticMultisetExact,'trigger order');cases++
const lost=structuredClone(base);lost.internalTriggers.splice(0,1);refuses(()=>assertM80BackupV2RawTriggerDelta(base,lost),'raw lost occurrence')
const extra=structuredClone(base);extra.internalTriggers.push(structuredClone(extra.internalTriggers[0]!));refuses(()=>assertM80BackupV2RawTriggerDelta(base,extra),'raw extra occurrence')
const wrong=structuredClone(base);wrong.internalTriggers[0]!.enabled='D';refuses(()=>assertM80BackupV2RawTriggerDelta(base,wrong),'raw modified occurrence')
for(const scope of ['external_qa','*','neuvetra']){const x=structuredClone(base);x.inventory.defaultAcls.push({...acl,schema:scope});let denied=false;try{await assertM80BackupV2RawSchema22Delta(base,x,{query:async()=>{throw Error('unexpected query')}} as any)}catch(e){denied=e instanceof Error&&e.message==='M80_V2_SCHEMA22_DEFAULT_ACL_CHANGED'}check(denied,'raw ACL must remain exact '+scope);cases++}
const text=await readFile('.superpowers/m80-backup-v2-rehearsal.ts','utf8')
function extract(from:string,to:string){const a=text.indexOf(from),b=text.indexOf(to,a);check(a>=0&&b>a,'function extraction');return new Bun.Transpiler({loader:'ts'}).transformSync(text.slice(a,b))}
const writer=extract('async function writeExclusive(','\nasync function appendJournal(')
const realWriter=new Function('open','sha',writer+'\nreturn writeExclusive;')(open,(x:Uint8Array)=>new Bun.CryptoHasher('sha256').update(x).digest('hex'))
const out='evaluations/research-qa/m80-restore-normalization-v2-independent-20260925-candidate2-io-'+Date.now();await mkdir(out)
await realWriter(out+'/once.json',{synthetic:true});let collision=false;try{await realWriter(out+'/once.json',{synthetic:false})}catch{collision=true}check(collision&&JSON.parse(await readFile(out+'/once.json','utf8')).synthetic===true,'exclusive collision');cases++
const events:string[]=[];const badWriter=new Function('open','sha',writer+'\nreturn writeExclusive;')(async()=>({writeFile:async()=>{events.push('write')},sync:async()=>{events.push('sync');throw Error('synthetic sync failure')},close:async()=>{events.push('close')}}),()=> 'unused')
let rejected=false;try{await badWriter('unused',{})}catch{rejected=true}check(rejected&&events.join(',')==='write,sync,close','sync fail ordering');cases++
const complete=extract('async function completeRehearsal(','\nexport async function runM80BackupV2SyntheticNative(')
const journals:any[]=[]
const fn=new Function('validateDisposableDatabaseName','createOutputs','open','appendJournal','restoreSnapshot',complete+'\nreturn completeRehearsal;')(()=>{},async()=>({paths:{journal:'virtual'}}),async()=>({close:async()=>{}}),async(_f:any,v:any)=>{journals.push(v)},async()=>{throw Error('synthetic private text that must never escape')})
let sanitized=false;try{await fn({},'0'.repeat(64),'1'.repeat(64),'1234567890123')}catch(e){sanitized=e instanceof Error&&e.message==='M80_V2_REHEARSAL_REFUSED'}check(sanitized&&journals.length===2&&journals[1].errorCode==='M80_V2_REHEARSAL_REFUSED'&&!JSON.stringify(journals).includes('private text'),'sanitized retained failure');cases++
const native=createPostgresConnection('postgres://supabase_admin@127.0.0.1:55472/m80_backup_foundation_1790306499437',{tls:false,maxConnections:1})
let tableCount=0
try{await native.transaction(async tx=>{await tx.exec('set transaction isolation level repeatable read read only');const rows=(await tx.query<any>("select c.relname, c.relrowsecurity, c.relforcerowsecurity, has_table_privilege('neuvetra_runtime',c.oid,'SELECT') sel, has_table_privilege('neuvetra_runtime',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') writes from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' and c.relname like 'scope1_beta_%'")).rows;tableCount=rows.length;check(rows.length===6&&rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity&&r.sel&&!r.writes),'native six-table RLS/select-only');const seq=(await tx.query<any>("select has_sequence_privilege('neuvetra_runtime','neuvetra.scope1_beta_audit_sequence_seq','USAGE,SELECT,UPDATE') allowed")).rows;check(seq[0].allowed===false,'native sequence denied');const admission=(await tx.query<any>('select count(*)::int count from neuvetra.scope1_beta_fixture_admissions')).rows;check(admission[0].count===0,'no admission');cases+=3})}finally{await native.close()}

const externalSource=structuredClone(base), externalRestored=structuredClone(base)
for(let i=0;i<27;i++)externalSource.inventory.defaultAcls.push({...acl,schema:'qa_external_'+i})
externalSource.internalTriggers.push(structuredClone(externalSource.internalTriggers[0]!))
externalRestored.internalTriggers.push(structuredClone(externalRestored.internalTriggers[0]!))
externalRestored.internalTriggers.reverse()
const proof27=assertM80BackupV2ExactRestore(externalSource,externalRestored)
check(proof27.sourceExternalDefaultAclRowsExcluded===27&&proof27.restoredExternalDefaultAclRows===0&&proof27.sourceInternalTriggerRows===externalSource.internalTriggers.length&&proof27.sourceInternalTriggerRows===proof27.restoredInternalTriggerRows,'synthetic 27 ACLs plus duplicate trigger permutation');cases++
check(proof27.sourceRawMetadataSha256!==proof27.restoredRawMetadataSha256&&proof27.sourceNormalizedMetadataSha256===proof27.restoredNormalizedMetadataSha256,'raw versus normalized separation');cases++
const fewer=structuredClone(externalRestored);fewer.internalTriggers.pop();refuses(()=>assertM80BackupV2ExactRestore(externalSource,fewer),'duplicate multiplicity restore loss')
const more=structuredClone(externalRestored);more.internalTriggers.push(structuredClone(more.internalTriggers[0]!));refuses(()=>assertM80BackupV2ExactRestore(externalSource,more),'duplicate multiplicity restore addition')

await Bun.write('evaluations/research-qa/m80-restore-normalization-v2-independent-20260925-candidate2-controls.json',JSON.stringify({independentControlsPassed:cases,nativeNewTables:tableCount,rawAclScopesChecked:3,exclusiveWriterCollision:true,syncFailureCloseOrdering:true,sanitizedFailureJournal:true,localConnectionsClosed:true,actualHostedArchiveAccess:false,retainedSyntheticIoDirectory:out})+"\n")
