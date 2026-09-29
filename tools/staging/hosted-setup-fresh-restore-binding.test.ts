import {describe,expect,test} from 'bun:test'
import {
  FINGERPRINT_DERIVATION_INPUT_PROFILE,REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT,
  deriveExpectedHostedSetupFingerprint,type FingerprintDerivationDependencies,
  type FingerprintDerivationInput,type HostedSetupRestoreResult,
} from './hosted-setup-fingerprint-derivation'
import {HOSTED_SETUP_PROFILE,fingerprintSha256,hash as fingerprintHash,type HostedSetupFingerprint,type UpgradeMigration} from './hosted-setup-upgrade'
import {PROFILE,PROJECT,hash as recoveryHash,sha,type Snapshot,type State} from './hosted-setup-restore-core'

const digest=(label:string)=>sha(label)
const manifest:UpgradeMigration[]=Array.from({length:23},(_,index)=>({name:String(index+1).padStart(4,'0')+'_migration.sql',sha256:digest('migration-'+index),sql:'select 1'}))
const actors=[
  {id:'00000000-0000-4000-8000-000000000001',companies:['10000000-0000-4000-8000-000000000001']},
  {id:'00000000-0000-4000-8000-000000000002',companies:[]},
]
const rowText='{"amount":9007199254740993.123456789012345678901,"company_id":"10000000-0000-4000-8000-000000000001"}'
const rowHash=sha(rowText)
const roles=[
  {rolname:'neuvetra_runtime',rolsuper:false,rolinherit:true,rolcreaterole:false,rolcreatedb:false,rolcanlogin:true,rolreplication:false,rolbypassrls:false},
  {rolname:'supabase_admin',rolsuper:true,rolinherit:true,rolcreaterole:true,rolcreatedb:true,rolcanlogin:true,rolreplication:false,rolbypassrls:false},
]
const appAcl={owner:'supabase_admin',schema:'neuvetra',kind:'r',acl:'{neuvetra_runtime=r/supabase_admin}'}
const externalAcls=Array.from({length:REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT},(_,index)=>({
  owner:'supabase_admin',schema:'external_'+String(index+1).padStart(2,'0'),kind:'r',acl:'{neuvetra_runtime=r/supabase_admin}',
}))
const sortedAcls=(rows:any[])=>[...rows].sort((a,b)=>a.owner<b.owner?-1:a.owner>b.owner?1:a.schema<b.schema?-1:a.schema>b.schema?1:a.kind<b.kind?-1:a.kind>b.kind?1:0)
function state(externalCount=REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT):State{
  const rowHashes=[rowHash]
  return {
    rowEncoding:'postgres-jsonb-text.v1',
    inventory:{
      tables:[{name:'precise_records',count:1,sha256:recoveryHash([rowText]),rowHashes}],
      metadata:{tables:digest('catalog-tables')},
      catalogRowHashes:{tables:[digest('catalog-table-row')]},
      functions:[],tableObjects:[],
      sequences:[{name:'fugitive_audit_sequence_seq',lastValue:'9007199254740993',isCalled:true}],
      roles,memberships:[],
      defaultAcls:sortedAcls([...externalAcls.slice(0,externalCount),appAcl]),
      dependencies:[{schema:'auth',relation:'users'}],
    },
    internalTriggers:[],
    tenantAccess:[
      {actor:actors[0]!.id,table:'precise_records',outcome:'rows',count:1,hashes:[rowHash]},
      {actor:actors[1]!.id,table:'precise_records',outcome:'rows',count:0,hashes:[]},
    ],
  } as State
}
function localFingerprint(restored:State):HostedSetupFingerprint{
  const sequence=restored.inventory.sequences[0]!
  return {
    profile:'neuvetra.hosted-setup.database-fingerprint.v1',
    projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,
    receipts:manifest.slice(0,22).map(({name,sha256})=>({name,sha256})),
    tables:restored.inventory.tables.map(table=>({name:table.name,count:table.count,rowHashes:[...table.rowHashes],sha256:fingerprintHash(table.rowHashes)})),
    catalog:{
      tables:[],columns:[],constraints:[],indexes:[],policies:[],triggers:[],functions:[],
      sequences:[{name:sequence.name,owner:'supabase_admin',acl:null,type:'bigint',start:'1',increment:'1',maximum:'9223372036854775807',minimum:'1',cache:'1',cycle:false,last_value:sequence.lastValue,is_called:sequence.isCalled}],
      schema:[],roles:structuredClone(restored.inventory.roles),memberships:structuredClone(restored.inventory.memberships),
      defaultAcls:structuredClone(restored.inventory.defaultAcls),dependencies:structuredClone(restored.inventory.dependencies),
    },
  }
}
function bytes(value:unknown,format:'compact'|'pretty-line'){
  const text=format==='compact'?JSON.stringify(value):JSON.stringify(value,null,2)+'\n'
  const data=Buffer.from(text)
  return {bytes:data,sha256:sha(data)}
}
function derivationFixture(externalCount=REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT){
  const source=state(externalCount)
  const restored=structuredClone(source)
  restored.inventory.defaultAcls=restored.inventory.defaultAcls.filter((row:any)=>row.schema==='neuvetra'||row.schema==='*')
  const dump=Buffer.concat([Buffer.from('PGDMP'),Buffer.alloc(20,7)])
  const snapshot:Snapshot={
    profile:PROFILE,project:PROJECT,applicationOnly:true,syntheticOnly:true,providerRecoveryExcluded:true,
    snapshotTokenHash:digest('snapshot-token'),state:source,
    auth:{ids:[actors[0]!.id],uidDefinition:'create function auth.uid() returns uuid language sql as $$ select null::uuid $$;',actors},
    dumpBase64:dump.toString('base64'),dumpSha256:sha(dump),sourceDatabase:'postgres',serverMajor:17,
  }
  const snapshotArtifact=bytes(snapshot,'compact')
  const archive=Buffer.from('synthetic-encrypted-archive')
  const receipt={
    profile:PROFILE,project:PROJECT,createdUtc:'2026-09-26T00:00:00.000Z',applicationOnly:true,syntheticOnly:true,providerRecoveryExcluded:true,
    archiveSha256:sha(archive),snapshotSha256:snapshotArtifact.sha256,dumpSha256:snapshot.dumpSha256,stateSha256:recoveryHash(source),
  }
  const receiptArtifact=bytes(receipt,'pretty-line')
  const result:HostedSetupRestoreResult={
    profile:PROFILE,status:'local-restore-preservation-passed',database:'hosted_setup_restore_1790414845902_b1f2a12a',
    sourceReceiptSha256:receiptArtifact.sha256,sourceStateSha256:receipt.stateSha256,restoredStateSha256:recoveryHash(restored),
    applicationRowsExact:true,applicationCatalogEquivalent:true,tenantReadAccessExact:true,providerRecoveryExcluded:true,hostedMigrationAuthorized:false,
  }
  const input:FingerprintDerivationInput={
    profile:FINGERPRINT_DERIVATION_INPUT_PROFILE,projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,
    expectedExternalDefaultAclCount:REQUIRED_EXTERNAL_DEFAULT_ACL_COUNT,
    expectedExternalDefaultAclsSha256:fingerprintHash(externalAcls.slice(0,externalCount)),
    sourceSnapshot:snapshotArtifact,sourceReceipt:receiptArtifact,sourceArchive:{bytes:archive,sha256:sha(archive)},restoreResult:bytes(result,'pretty-line'),
  }
  const local=localFingerprint(restored)
  const identity={database:result.database,address:'127.0.0.1',port:55488,version:'170011'}
  const observed={transactions:0,exec:[] as string[]}
  const tx={
    exec:async(statement:string)=>{observed.exec.push(statement)},
    query:async(sql:string)=>{
      if(sql.includes('current_database()'))return {rows:[identity]}
      throw Error('unexpected focused transaction query')
    },
  }
  const db={transaction:async(operation:any)=>{observed.transactions++;return operation(tx)}} as any
  const deps:FingerprintDerivationDependencies={
    migrationManifest:async()=>manifest,
    snapshotInSharedTransaction:async()=>local,
    captureStateInSharedTransaction:async()=>restored,
  }
  return {input,deps,source,restored,local,result,identity,db,observed}
}

import {verifyFreshHostedSetupRestore,freshRestoreReviewSubjectSha256,FRESH_RESTORE_POLICY_PROFILE,FRESH_RESTORE_OBSERVATION_PROFILE,FRESH_RESTORE_REVIEW_PROFILE,type FreshRestoreEvidence,type FreshRestorePolicy,type FreshRestoreReview} from './hosted-setup-fresh-restore-binding'
import type {AcceptedRestoreBinding,PinnedArtifact} from './hosted-setup-upgrade'
const asText=(p:{bytes:Uint8Array;sha256:string}):PinnedArtifact=>({bytes:Buffer.from(p.bytes).toString('utf8'),sha256:p.sha256})
const textArtifact=(v:unknown)=>asText(bytes(v,'pretty-line'))
async function fresh(seed='one'){
 const f=derivationFixture(),at=(ms:number)=>new Date(Date.parse('2026-09-26T20:00:00.000Z')+ms).toISOString()
 const sourceReceipt=JSON.parse(Buffer.from(f.input.sourceReceipt.bytes).toString())
 sourceReceipt.createdUtc=at(0)
 f.input.sourceArchive=bytes({syntheticArchive:seed},'compact');sourceReceipt.archiveSha256=f.input.sourceArchive.sha256
 f.input.sourceReceipt=bytes(sourceReceipt,'pretty-line');f.result.sourceReceiptSha256=f.input.sourceReceipt.sha256
 f.input.restoreResult=bytes(f.result,'pretty-line')
 const derivation=await deriveExpectedHostedSetupFingerprint(f.db,f.input,f.deps)
 const evidence:FreshRestoreEvidence={
  sourceReceipt:asText(f.input.sourceReceipt),sourceArchive:f.input.sourceArchive,sourceSnapshot:asText(f.input.sourceSnapshot),
  restoredState:textArtifact(f.restored),restoreResult:asText(f.input.restoreResult),fingerprintDerivation:textArtifact(derivation),
  restoreObservation:textArtifact({profile:FRESH_RESTORE_OBSERVATION_PROFILE,projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,schemaVersion:22,operatorId:'fresh-operator',
   restoreStartedUtc:at(1000),restoreCompletedUtc:at(2000),fingerprintCompletedUtc:at(3000),runtime:{database:f.result.database,host:'127.0.0.1',port:55488,serverVersionNum:170011},
   sourceReceiptSha256:f.input.sourceReceipt.sha256,sourceArchiveSha256:f.input.sourceArchive.sha256,sourceSnapshotSha256:f.input.sourceSnapshot.sha256,
   sourceStateSha256:sourceReceipt.stateSha256,restoredStateSha256:f.result.restoredStateSha256,restoreResultSha256:f.input.restoreResult.sha256,fingerprintDerivationSha256:textArtifact(derivation).sha256,
   clusterStopped:true,clusterDataRetained:true,localListenerAbsent:true,sourceCurrentnessObserved:false,providerRecoveryExcluded:true,upgradeAuthorized:false}),
  restoreReview:textArtifact({}),fingerprintReview:textArtifact({}),
 }
 const policy:FreshRestorePolicy={profile:FRESH_RESTORE_POLICY_PROFILE,projectRef:PROJECT,targetProfile:HOSTED_SETUP_PROFILE,notBeforeUtc:at(-1000),maxAgeMs:60_000,
  operatorId:'fresh-operator',restoreReviewerId:'restore-qa',fingerprintReviewerId:'derivation-qa',
  artifactSha256:{sourceReceipt:evidence.sourceReceipt.sha256,sourceArchive:evidence.sourceArchive.sha256,sourceSnapshot:evidence.sourceSnapshot.sha256,restoredState:evidence.restoredState.sha256,restoreResult:evidence.restoreResult.sha256,restoreObservation:evidence.restoreObservation.sha256,fingerprintDerivation:evidence.fingerprintDerivation.sha256},
  restoreReviewSha256:'0'.repeat(64),fingerprintReviewSha256:'0'.repeat(64),sourceStateSha256:sourceReceipt.stateSha256,restoredStateSha256:f.result.restoredStateSha256,
  expectedDatabaseFingerprintSha256:derivation.expectedDatabaseFingerprintSha256,sourceExternalDefaultAclsSha256:f.input.expectedExternalDefaultAclsSha256,sourceExternalDefaultAclCount:27}
 function sealReviews(){
  for(const stage of ['restore','fingerprint'] as const){
   const review:FreshRestoreReview={profile:FRESH_RESTORE_REVIEW_PROFILE,stage,verdict:'accepted',operatorId:policy.operatorId,reviewerId:stage==='restore'?policy.restoreReviewerId:policy.fingerprintReviewerId,reviewedUtc:at(4000),subjectSha256:freshRestoreReviewSubjectSha256(policy),materialFindingsOpen:0,
    checks:stage==='restore'?{actualPostgres17RestoreVerified:true,archiveSnapshotPairVerified:true,applicationPreservationVerified:true,tenantControlsVerified:true}:{coherentSnapshotVerified:true,quietSequenceWritersVerified:true,fingerprintIndependentlyDerived:true,externalDefaultAclScopeVerified:true},
    sourceCurrentnessObserved:false,liveHostedPreflightRequired:true,upgradeAuthorized:false,providerRecoveryExcluded:true}
   const name=stage==='restore'?'restoreReview':'fingerprintReview';evidence[name]=textArtifact(review)
   if(stage==='restore')policy.restoreReviewSha256=evidence[name].sha256;else policy.fingerprintReviewSha256=evidence[name].sha256
  }
 }
 sealReviews()
 function replace(name:Exclude<keyof FreshRestoreEvidence,'sourceArchive'>,change:(r:any)=>void,repin=true){
  const data=JSON.parse(evidence[name].bytes);change(data);evidence[name]=textArtifact(data)
  if(repin){if(name==='restoreReview')policy.restoreReviewSha256=evidence[name].sha256;else if(name==='fingerprintReview')policy.fingerprintReviewSha256=evidence[name].sha256;else policy.artifactSha256[name]=evidence[name].sha256}
 }
 const run=(now=at(5000)):AcceptedRestoreBinding=>verifyFreshHostedSetupRestore(evidence,policy,now)
 return {f,at,evidence,policy,run,replace,sealReviews}
}

test('dynamic reviewed chain returns exactly the runner AcceptedRestoreBinding, no historical pins',async()=>{
 const a=await fresh('a'),b=await fresh('different-new-archive')
 for(const f of [a,b]){
  const binding:AcceptedRestoreBinding=f.run()
  expect(binding.restoreReceiptSha256).toBe(f.evidence.restoreObservation.sha256)
  expect(binding.restoreReviewSha256).toBe(f.evidence.restoreReview.sha256)
  expect(binding.fingerprintDerivationReviewSha256).toBe(f.evidence.fingerprintReview.sha256)
  expect(binding.expectedDatabaseFingerprintSha256).toBe(f.policy.expectedDatabaseFingerprintSha256)
  expect(binding.sourceStateSha256).not.toBe(binding.restoredStateSha256)
  expect(binding.operatorId).toBe('fresh-operator');expect(binding.independentReviewerId).toBe('restore-qa')
  expect(Object.isFrozen(binding)).toBe(true);expect(Object.keys(binding)).toHaveLength(19)
 }
 expect(a.run().sourceArchiveSha256).not.toBe(b.run().sourceArchiveSha256)
})
test('every submitted artifact needs its independent external pin, not its claimed self-hash',async()=>{
 for(const name of ['sourceReceipt','sourceSnapshot','restoredState','restoreResult','restoreObservation','fingerprintDerivation','restoreReview','fingerprintReview'] as const){
  const f=await fresh();f.evidence[name]={bytes:f.evidence[name].bytes+' ',sha256:sha(f.evidence[name].bytes+' ')}
  expect(()=>f.run()).toThrow('ARTIFACT_PIN_REFUSED')
 }
 const a=await fresh();a.evidence.sourceArchive=bytes('different archive','compact');expect(()=>a.run()).toThrow('ARCHIVE_PIN_REFUSED')
})
test('freshness cutoff, maximum age, future evidence and invalid chronology refuse',async()=>{
 const a=await fresh();expect(()=>a.run(a.at(60_001))).toThrow('STALE_BACKUP_REFUSED');expect(()=>a.run(a.at(-2000))).toThrow('CUTOFF_IN_FUTURE')
 const b=await fresh();b.policy.notBeforeUtc=b.at(1);b.sealReviews();expect(()=>b.run()).toThrow('STALE_BACKUP_REFUSED')
 for(const name of ['restoreStartedUtc','restoreCompletedUtc','fingerprintCompletedUtc']){
  const f=await fresh();f.replace('restoreObservation',r=>r[name]=f.at(6000));f.sealReviews();expect(()=>f.run()).toThrow('OBSERVATION_TIME_REFUSED')
 }
 for(const val of [null,0,-1,86_400_001,NaN]){const f=await fresh();(f.policy as any).maxAgeMs=val;expect(()=>f.run()).toThrow('MAX_AGE_REFUSED')}
 for(const val of ['2026-09-26', '2026-09-26T20:00:00Z']){const f=await fresh();f.policy.notBeforeUtc=val;expect(()=>f.run()).toThrow('TIME_REFUSED')}
})
test('separate reviewer identity, exact subject, review date, stage, findings and explicit checks required',async()=>{
 for(const name of ['restoreReviewerId','fingerprintReviewerId'] as const){const f=await fresh();f.policy[name]=f.policy.operatorId;expect(()=>f.run()).toThrow('INDEPENDENT_REVIEW_REQUIRED')}
 for(const name of ['restoreReview','fingerprintReview'] as const){
  for(const mutate of [(r:any)=>r.verdict='rejected',(r:any)=>r.subjectSha256='0'.repeat(64),(r:any)=>r.reviewerId='forged',(r:any)=>r.materialFindingsOpen=1,(r:any)=>r.stage='other',(r:any)=>r.upgradeAuthorized=true,(r:any)=>r.sourceCurrentnessObserved=true,(r:any)=>r.reviewedUtc='2026-09-26T19:59:00.000Z',(r:any)=>r.reviewedUtc='2026-09-26T20:01:00.000Z',(r:any)=>r.checks[Object.keys(r.checks)[0]!]=null,(r:any)=>delete r.checks[Object.keys(r.checks)[0]!]]){
   const f=await fresh();f.replace(name,mutate);expect(()=>f.run()).toThrow()
  }
 }
 const f=await fresh();f.evidence.restoreReview={bytes:'# Accepted historical archive',sha256:sha('# Accepted historical archive')};f.policy.restoreReviewSha256=f.evidence.restoreReview.sha256;expect(()=>f.run()).toThrow('JSON_REFUSED')
})
test('re-pinned false restore results, observations and derivations cannot bypass semantic checks',async()=>{
 const cases:Array<[Exclude<keyof FreshRestoreEvidence,'sourceArchive'>,(r:any)=>void]>=[
 ['restoreResult',r=>r.applicationRowsExact=false],['restoreResult',r=>r.tenantReadAccessExact=null],['restoreResult',r=>r.sourceStateSha256='0'.repeat(64)],['restoreResult',r=>r.hostedMigrationAuthorized=true],
 ['restoreObservation',r=>r.runtime.host='hosted.example'],['restoreObservation',r=>r.runtime.serverVersionNum=160011],['restoreObservation',r=>r.runtime.port=0],['restoreObservation',r=>r.runtime.database='postgres'],['restoreObservation',r=>r.clusterStopped=false],['restoreObservation',r=>r.localListenerAbsent=null],['restoreObservation',r=>r.sourceSnapshotSha256='0'.repeat(64)],
 ['fingerprintDerivation',r=>r.expectedDatabaseFingerprintSha256='0'.repeat(64)],['fingerprintDerivation',r=>r.sourceCurrentnessObserved=true],['fingerprintDerivation',r=>r.sequenceStateEquivalent=false],['fingerprintDerivation',r=>r.independentReviewRequired=false],['fingerprintDerivation',r=>r.liveHostedPreflightRequired=false],['fingerprintDerivation',r=>r.sourceExternalDefaultAclCount=26],['fingerprintDerivation',r=>r.sourceExternalDefaultAclsSha256='0'.repeat(64)],
 ]
 for(const [name,mutate]of cases){const f=await fresh();f.replace(name,mutate);f.sealReviews();expect(()=>f.run()).toThrow()}
})
test('source/state/archive relationships, preservation and externally pinned ACL scope refuse coordinated re-pinning',async()=>{
 for(const field of ['archiveSha256','snapshotSha256','stateSha256']){const f=await fresh();f.replace('sourceReceipt',r=>r[field]='0'.repeat(64));f.sealReviews();expect(()=>f.run()).toThrow('SOURCE_RECEIPT_MISMATCH')}
 for(const mutate of [(r:any)=>r.inventory.tables[0].rowHashes[0]='0'.repeat(64),(r:any)=>r.inventory.sequences[0].lastValue='9007199254740994',(r:any)=>r.tenantAccess[1].count=1]){
  const f=await fresh();f.replace('restoredState',mutate);f.policy.restoredStateSha256=recoveryHash(JSON.parse(f.evidence.restoredState.bytes));f.sealReviews();expect(()=>f.run()).toThrow('PRESERVATION_MISMATCH')
 }
 const a=await fresh();a.policy.sourceExternalDefaultAclsSha256='0'.repeat(64);a.sealReviews();expect(()=>a.run()).toThrow('EXTERNAL_ACL_SCOPE_REFUSED')
 const b=await fresh();(b.policy as any).sourceExternalDefaultAclCount=null;expect(()=>b.run()).toThrow('EXTERNAL_ACL_SCOPE_REFUSED')
})
test('malformed, duplicate-key, unknown-field JSON and review permutation fail even with external re-pins',async()=>{
 for(const bytes of ['{}','null','[]','{','{"profile":"x","profile":"y"}','{"\\u0070rofile":"x","profile":"y"}']){
  const f=await fresh();f.evidence.restoreObservation={bytes,sha256:sha(bytes)};f.policy.artifactSha256.restoreObservation=sha(bytes);f.sealReviews();expect(()=>f.run()).toThrow()
 }
 const a=await fresh();a.replace('restoreObservation',r=>r.forged=true);a.sealReviews();expect(()=>a.run()).toThrow('SHAPE_REFUSED')
 const b=await fresh();[b.evidence.restoreReview,b.evidence.fingerprintReview]=[b.evidence.fingerprintReview,b.evidence.restoreReview];[b.policy.restoreReviewSha256,b.policy.fingerprintReviewSha256]=[b.policy.fingerprintReviewSha256,b.policy.restoreReviewSha256];expect(()=>b.run()).toThrow('REVIEW_REFUSED')
})
test('getter values retained once, policy accessor refused without execution, mutable input cannot change frozen output',async()=>{
 const f=await fresh();let reads=0
 for(const name of ['sourceReceipt','sourceSnapshot','restoredState','restoreResult','restoreObservation','fingerprintDerivation','restoreReview','fingerprintReview'] as const){
  const original=f.evidence[name];let bytesReads=0,hashReads=0
  f.evidence[name]={get bytes(){reads++;if(++bytesReads>1)throw Error('second bytes read');return original.bytes},get sha256(){reads++;if(++hashReads>1)throw Error('second hash read');return original.sha256}}
 }
 const accepted=f.run();expect(reads).toBe(16);f.policy.operatorId='changed';expect(accepted.operatorId).toBe('fresh-operator')
 const b=await fresh();let invoked=0;Object.defineProperty(b.policy,'operatorId',{enumerable:true,get(){invoked++;return 'fresh-operator'}});expect(()=>b.run()).toThrow('POLICY_ACCESSOR_REFUSED');expect(invoked).toBe(0)
 const c=await fresh(),original=c.evidence.restoreObservation;c.evidence.restoreObservation={get bytes(){return '{}'},sha256:original.sha256};expect(()=>c.run()).toThrow('ARTIFACT_PIN_REFUSED')
})
test('source external ACL reordering, duplicate rows and changed scope refuse after coordinated source re-pinning',async()=>{
 for(const mode of ['reorder','duplicate','change','remove']){
  const f=await fresh(),snapshot=JSON.parse(f.evidence.sourceSnapshot.bytes),receipt=JSON.parse(f.evidence.sourceReceipt.bytes)
  if(mode==='reorder')snapshot.state.inventory.defaultAcls.reverse()
  if(mode==='duplicate')snapshot.state.inventory.defaultAcls.splice(1,0,structuredClone(snapshot.state.inventory.defaultAcls[0]))
  if(mode==='change')snapshot.state.inventory.defaultAcls[0].acl=null
  if(mode==='remove')snapshot.state.inventory.defaultAcls.splice(0,1)
  f.evidence.sourceSnapshot=asText(bytes(snapshot,'compact'));f.policy.artifactSha256.sourceSnapshot=f.evidence.sourceSnapshot.sha256
  receipt.snapshotSha256=f.evidence.sourceSnapshot.sha256;receipt.stateSha256=recoveryHash(snapshot.state);f.policy.sourceStateSha256=receipt.stateSha256
  f.evidence.sourceReceipt=textArtifact(receipt);f.policy.artifactSha256.sourceReceipt=f.evidence.sourceReceipt.sha256;f.sealReviews()
  expect(()=>f.run()).toThrow(mode==='reorder'||mode==='duplicate'?'ACL_ORDER_OR_DUPLICATE_REFUSED':'EXTERNAL_ACL_SCOPE_REFUSED')
 }
})
test('shared or empty archive and missing review authority cannot issue a binding',async()=>{
 const a=await fresh();a.evidence.sourceArchive={bytes:new Uint8Array(new SharedArrayBuffer(8)),sha256:a.policy.artifactSha256.sourceArchive};expect(()=>a.run()).toThrow('SHARED_ARCHIVE_REFUSED')
 const b=await fresh();b.evidence.sourceArchive={bytes:new Uint8Array(),sha256:b.policy.artifactSha256.sourceArchive};expect(()=>b.run()).toThrow('ARCHIVE_BYTES_REQUIRED')
 const c=await fresh();delete (c.evidence as any).fingerprintReview;expect(()=>c.run()).toThrow('SHAPE_REFUSED')
 const d=await fresh();delete (d.policy as any).fingerprintReviewSha256;expect(()=>d.run()).toThrow('SHAPE_REFUSED')
})