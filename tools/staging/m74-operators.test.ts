import {describe,test,expect} from 'bun:test'
import {operatorUrl,localName,sameRows,sameCatalog,canonicalReceipts,MIGRATION,BASELINE_MANIFEST_SHA256,PROJECT,sha} from './m74-common'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {hashManifestValue} from './create-source-manifest'
import {byteEntry,sameRecovery,validateRecoveryManifest,type RecoveryManifest} from './m74-recovery-manifest'
import {validateUpgradeGate} from './m74-upgrade'
const state=(hashes:string[])=>({tables:[{name:'history',count:hashes.length,sha256:hashes.join(),rowHashes:hashes}],catalogRowHashes:{functions:hashes},metadata:{functions:hashes.join()},roles:[],memberships:[],defaultAcls:[]}) as any
const content=(entries:RecoveryManifest['entries']=[])=>({profile:'neuvetra.m74.recovery-content.v1',schemaVersion:16,entries,sha256:hashManifestValue(entries)}) as RecoveryManifest
const now=Date.parse('2026-09-15T23:00:00Z'),stamp=new Date(now-1000).toISOString(),digest='a'.repeat(64)
function goodGate(){
 const inventory=state(['retained']),manifest=content([byteEntry('stationary_gas_reports','report1','html','example')])
 const backup={status:'m74_encrypted_application_backup',project:PROJECT,schemaVersion:16,createdAt:stamp,archiveSha256:digest,dumpSha256:digest,inventory,recoveryManifest:manifest}
 const restore={...structuredClone(backup),status:'m74_exact_application_archive_restored',database:'m74_ops_fixture',port:55472,sourceBackupCreatedAt:stamp,applicationRowsAndCatalogExact:true,runtimeRoleFlagsExact:true,allRoleFlagsAndMembershipsExact:true,applicationDefaultAclsExact:true,runtimeNoClaimDenied:true,runtimeExistingActorReadPassed:true,recoveryContentExact:true}
 const recovery={status:'m74_independent_recovery_passed',project:PROJECT,schemaVersion:16,createdAt:stamp,database:restore.database,port:55472,archiveSha256:digest,dumpSha256:digest,restoreReceiptSha256:digest,reviewerId:'independent-reviewer',applicationReadsAndDownloadsVerified:true,m73CalculationReplayVerified:true,legacyDownloadsVerified:true,noMutationVerified:true,recoveryManifest:structuredClone(manifest)}
 const gate={status:'m74_independent_operator_gate_passed',project:PROJECT,createdAt:stamp,reviewedMigrationHash:MIGRATION,reviewedCommit:'b'.repeat(40),maintenanceConfirmed:true,maintenanceObservedAt:stamp,schema17ForwardRecoveryReviewed:true,providerRecoveryExclusionAccepted:true,operatorId:'operator',independentReviewerId:'independent-reviewer',restoreReceiptSha256:digest}
 const entries=[byteEntry('mobile_diesel_fuel_statements','s1','statement','fuel'),byteEntry('mobile_diesel_mileage_statements','s2','statement','mileage'),byteEntry('mobile_diesel_versions','v1','calculation','{}'),byteEntry('mobile_diesel_reports','r1','html','html')]
 const forwardContent={...content(entries),schemaVersion:17}
 const forward={status:'m74_schema17_forward_recovery_review_passed',reviewerId:'independent-reviewer',reviewedMigrationHash:MIGRATION,schemaVersion:17,createdAt:stamp,populatedMobileRecoveryVerified:true,m73AndLegacyPreserved:true,runtimeReplayAndDownloadsVerified:true,noMutationVerified:true,sourceContentManifest:forwardContent,restoredContentManifest:structuredClone(forwardContent)}
 return {gate,backup,restore,recovery,forward}
}
describe('M74 explicit operator gates',()=>{
 test('strict local target and hosted identity prevent accidental other targets',()=>{
  for(const name of ['postgres','m73_author_13','m74_ops_bad;drop','m74_author_fixture','M74_ops_upper'])expect(()=>localName(name,55463)).toThrow()
  expect(()=>localName('m74_ops_new',55472)).not.toThrow();expect(()=>localName('m74_ops_new',5432)).toThrow()
  for(const url of ['postgres://postgres:fake@localhost:5432/postgres','postgres://postgres.icockcoguyadhryzydvl:fake@aws-1-us-west-1.pooler.supabase.com:6543/postgres','https://postgres.icockcoguyadhryzydvl:fake@aws-1-us-west-1.pooler.supabase.com:5432/postgres','postgres://postgres.other:fake@aws-1-us-west-1.pooler.supabase.com:5432/postgres'])expect(()=>operatorUrl(url)).toThrow()
 })
 test('old rows and catalogs require exact duplicate multiplicity',()=>{
  expect(()=>sameRows(state(['a','a']),state(['a','b']),true)).toThrow();expect(()=>sameRows(state(['a']),state(['b']),true)).toThrow();expect(()=>sameRows(state(['a']),state(['a','b']))).toThrow()
  expect(()=>sameCatalog(state(['a','a']),state(['a','b']),true)).toThrow();expect(()=>sameCatalog(state(['a']),state([]),true)).toThrow();expect(()=>sameCatalog(state(['a']),state(['a','b']),true)).not.toThrow()
 })
 test('exact16 receipts and manifest baseline; wrong, reordered and duplicate receipt refusal',async()=>{
  const m=await readMigrationManifest();expect(hashManifestValue(m.slice(0,16).map(({name,sha256})=>({name,sha256})))).toBe(BASELINE_MANIFEST_SHA256)
  const receipts=m.slice(0,16).map(({name,sha256})=>({name,sha256})),tx=(rows:unknown[])=>({query:async(sql:string)=>({rows:sql.includes('schema_migrations')?rows:[{project_ref:PROJECT,profile:'neuvetra.private-synthetic-staging.v1'}]})}) as any
  if(m.length>17){
   let queries=0;const denied={query:async()=>{queries++;throw Error('No database query is allowed after manifest refusal.')}} as any
   await expect(canonicalReceipts(denied,16)).rejects.toThrow()
   await expect(canonicalReceipts(denied,17)).rejects.toThrow()
   expect(queries).toBe(0)
  }else expect((await canonicalReceipts(tx(receipts),16)).length).toBe(m.length)
  for(const rows of [receipts.slice(1),[...receipts].reverse(),[...receipts,receipts[15]],receipts.map((r,i)=>i===15?{...r,sha256:'0'.repeat(64)}:r)])await expect(canonicalReceipts(tx(rows),16)).rejects.toThrow()
  if(/^[a-f0-9]{64}$/.test(MIGRATION))expect(m[16]?.sha256).toBe(MIGRATION)
  else await expect(canonicalReceipts(tx(receipts),17)).rejects.toThrow()
 })
 test('content independently computes actual UTF8 bytes, includes null and refuses corrupt metadata or omission',()=>{
  const text='\u03c0\n',entry=byteEntry('fuel','a','statement',text);expect(entry.byteLength).toBe(3);expect(entry.sha256).toBe(sha(Buffer.from(text)))
  expect(()=>byteEntry('fuel','a','statement',text,'0'.repeat(64))).toThrow();expect(()=>byteEntry('fuel','a','statement',text,entry.sha256,2)).toThrow()
  const missing=byteEntry('versions','a','calculation','null'),zero=byteEntry('versions','a','calculation','0');expect(missing.sha256).not.toBe(zero.sha256)
  expect(()=>sameRecovery(content([entry]),content([]))).toThrow();expect(()=>sameRecovery(content([entry]),content([{...entry,sha256:'f'.repeat(64)}]))).toThrow()
  expect(()=>validateRecoveryManifest(content([entry,entry]))).toThrow();expect(()=>sameRecovery(content([entry]),{...content([entry]),schemaVersion:17},true)).not.toThrow()
 })
 test('positive gate accepted only after coordinator freezes exact candidate',()=>{
  const v=goodGate(),run=()=>validateUpgradeGate(v.gate,v.backup,v.restore,v.recovery,v.forward,now)
  if(/^[a-f0-9]{64}$/.test(MIGRATION))expect(run).not.toThrow();else expect(run).toThrow()
 })
 test('S01 exact per-row hashes and internally consistent counts are mandatory on both receipts',()=>{
  const run=(v:ReturnType<typeof goodGate>)=>validateUpgradeGate(v.gate,v.backup,v.restore,v.recovery,v.forward,now)
  expect(()=>run(goodGate())).not.toThrow()
  const mutations:Array<(v:ReturnType<typeof goodGate>)=>void>=[
   v=>{v.restore.inventory.tables[0].rowHashes.push('f'.repeat(64))},
   v=>{v.restore.inventory.tables[0].rowHashes[0]='f'.repeat(64)},
   v=>{v.restore.inventory.tables[0].rowHashes=[]},
   v=>{v.backup.inventory.tables[0].rowHashes.push('f'.repeat(64))},
   v=>{for(const receipt of [v.backup,v.restore])receipt.inventory.tables[0].rowHashes.push('f'.repeat(64))},
   v=>{for(const receipt of [v.backup,v.restore])receipt.inventory.tables[0].count=2},
   v=>{for(const receipt of [v.backup,v.restore])receipt.inventory.tables[0].count=-1},
   v=>{for(const receipt of [v.backup,v.restore])receipt.inventory.tables[0].count=1.5},
   v=>{for(const receipt of [v.backup,v.restore])receipt.inventory.tables[0].rowHashes=null}
  ]
  for(const mutate of mutations){const v=goodGate();mutate(v);expect(()=>run(v)).toThrow()}
 })
 test('negative stale/state/maintenance/operator/recovery controls',()=>{
  // After pin freeze these each isolate a separate refusal from an otherwise accepted gate.
  const mutations:Array<(v:ReturnType<typeof goodGate>)=>void>=[
   v=>{v.gate.maintenanceConfirmed=false},v=>{v.gate.maintenanceObservedAt=new Date(now-900001).toISOString()},v=>{v.gate.schema17ForwardRecoveryReviewed=false},v=>{v.gate.providerRecoveryExclusionAccepted=false},v=>{v.gate.reviewedMigrationHash='0'.repeat(64)},v=>{v.gate.independentReviewerId=v.gate.operatorId},v=>{v.gate.operatorId=''},
   v=>{v.backup.createdAt=new Date(now-14400001).toISOString()},v=>{v.backup.createdAt=new Date(now+1).toISOString()},v=>{v.restore.createdAt=new Date(now-2000).toISOString()},v=>{v.recovery.createdAt=new Date(now-2000).toISOString()},v=>{v.gate.createdAt='not-a-time'},v=>{v.backup.schemaVersion=17},v=>{v.restore.port=55463},v=>{v.restore.archiveSha256='0'.repeat(64)},v=>{v.restore.sourceBackupCreatedAt='wrong'},
   v=>{v.restore.applicationRowsAndCatalogExact=false},v=>{v.restore.runtimeRoleFlagsExact=false},v=>{v.restore.allRoleFlagsAndMembershipsExact=false},v=>{v.restore.runtimeNoClaimDenied=false},v=>{v.restore.runtimeExistingActorReadPassed=false},v=>{v.restore.recoveryContentExact=false},v=>{v.restore.inventory.tables[0].sha256='changed'},v=>{v.restore.inventory.catalogRowHashes.functions=['changed']},v=>{v.restore.inventory.roles.push({rolname:'extra'})},v=>{v.restore.inventory.defaultAcls.push({schema:'*'})},
   v=>{v.recovery.applicationReadsAndDownloadsVerified=false},v=>{v.recovery.m73CalculationReplayVerified=false},v=>{v.recovery.legacyDownloadsVerified=false},v=>{v.recovery.noMutationVerified=false},v=>{v.recovery.reviewerId='author'},v=>{v.recovery.database='other'},v=>{v.recovery.restoreReceiptSha256='0'.repeat(64)},v=>{v.recovery.recoveryManifest=content([])},v=>{v.forward.populatedMobileRecoveryVerified=false},v=>{v.forward.m73AndLegacyPreserved=false},v=>{v.forward.runtimeReplayAndDownloadsVerified=false},v=>{v.forward.reviewedMigrationHash='0'.repeat(64)},v=>{v.forward.sourceContentManifest={...content([]),schemaVersion:17};v.forward.restoredContentManifest={...content([]),schemaVersion:17}}
  ]
  for(const mutate of mutations){const v=goodGate();mutate(v);expect(()=>validateUpgradeGate(v.gate,v.backup,v.restore,v.recovery,v.forward,now)).toThrow()}
 })
})
