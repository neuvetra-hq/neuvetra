import {test,expect} from 'bun:test'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {hashManifestValue} from './create-source-manifest'
import {localName,operatorUrl,canonicalReceipts,MIGRATION,BASELINE_MANIFEST_SHA256,PROJECT,validateInventory,sameRows,sha} from './m75-common'
import {byteEntry,sameRecovery,validateRecoveryManifest,type RecoveryManifest} from './m75-recovery-manifest'
import {validateUpgradeGate} from './m75-upgrade'
const now=Date.parse('2026-09-16T07:00:00Z'),stamp=new Date(now-1000).toISOString(),digest='a'.repeat(64)
function inventory(){return {tables:[{name:'schema_migrations',count:17,sha256:digest,rowHashes:Array(17).fill(digest)},...Array.from({length:82},(_,i)=>({name:'synthetic_'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26),count:0,sha256:hashManifestValue([]),rowHashes:[]}))],metadata:{tables:digest},catalogRowHashes:{tables:[digest]},roles:[],memberships:[],defaultAcls:[],dependencies:[]}}
const content=(entries:RecoveryManifest['entries']=[],schemaVersion:17|18=17):RecoveryManifest=>({profile:'neuvetra.m75.recovery-content.v1',schemaVersion,entries,sha256:hashManifestValue(entries)})
function goodGate(){
 const baseline=inventory(),manifest=content([byteEntry('mobile_diesel_reports','r1','html','old report')])
 const backup={status:'m75_encrypted_application_backup',project:PROJECT,schemaVersion:17,createdAt:stamp,archiveSha256:digest,dumpSha256:digest,inventory:baseline,recoveryManifest:manifest}
 const restore={...structuredClone(backup),status:'m75_exact_application_archive_restored',database:'m75_security_fixture',port:55472,sourceBackupCreatedAt:stamp,applicationRowsAndCatalogExact:true,runtimeRoleFlagsExact:true,allRoleFlagsAndMembershipsExact:true,applicationDefaultAclsExact:true,runtimeNoClaimDenied:true,runtimeExistingActorReadPassed:true,recoveryContentExact:true}
 const recovery={status:'m75_independent_recovery_passed',project:PROJECT,schemaVersion:17,createdAt:stamp,database:restore.database,port:55472,archiveSha256:digest,dumpSha256:digest,restoreReceiptSha256:digest,reviewerId:'independent-reviewer',applicationReadsAndDownloadsVerified:true,m73CalculationReplayVerified:true,m74CalculationReplayVerified:true,legacyDownloadsVerified:true,noMutationVerified:true,recoveryManifest:structuredClone(manifest)}
 const gate={status:'m75_independent_operator_gate_passed',project:PROJECT,createdAt:stamp,reviewedMigrationHash:MIGRATION,reviewedCommit:'b'.repeat(40),maintenanceConfirmed:true,maintenanceObservedAt:stamp,schema18ForwardRecoveryReviewed:true,providerRecoveryExclusionAccepted:true,operatorId:'operator',independentReviewerId:'independent-reviewer',restoreReceiptSha256:digest}
 const forwardContent=content([['mobile_diesel_fuel_statements','statement'],['mobile_diesel_mileage_statements','statement'],['mobile_diesel_versions','calculation'],['mobile_diesel_reports','html'],['controlled_fleet_statements','statement'],['controlled_fleet_versions','dependencies'],['controlled_fleet_reports','html'],['controlled_fleet_reports','snapshot']].map(([table,part],i)=>byteEntry(table!,String(i),part!,'synthetic '+i)),18)
 const forward={status:'m75_schema18_forward_recovery_review_passed',reviewerId:'independent-reviewer',reviewedMigrationHash:MIGRATION,schemaVersion:18,createdAt:stamp,populatedFleetRecoveryVerified:true,m73M74AndLegacyPreserved:true,runtimeReplayAndDownloadsVerified:true,noMutationVerified:true,sourceContentManifest:forwardContent,restoredContentManifest:structuredClone(forwardContent)}
 return {gate,backup,restore,recovery,forward}
}
const run=(v:ReturnType<typeof goodGate>)=>validateUpgradeGate(v.gate,v.backup,v.restore,v.recovery,v.forward,now)
test('fixed hosted project and new loopback targets only',()=>{
 for(const name of ['postgres','m74_ops_existing','m75_author_fixture','m75_ops_x;drop','M75_ops_upper'])expect(()=>localName(name,55463)).toThrow()
 expect(()=>localName('m75_ops_fresh',55472)).not.toThrow();expect(()=>localName('m75_ops_fresh',5432)).toThrow()
 for(const url of ['postgres://postgres:synthetic@localhost:5432/postgres','postgres://postgres.other:synthetic@aws-1-us-west-1.pooler.supabase.com:5432/postgres','postgres://postgres.icockcoguyadhryzydvl:synthetic@aws-1-us-west-1.pooler.supabase.com:6543/postgres'])expect(()=>operatorUrl(url)).toThrow()
})
test('canonical seventeen receipts; malformed, old, reordered and foreign target refused',async()=>{
 const m=await readMigrationManifest(),receipts=m.slice(0,17).map(({name,sha256})=>({name,sha256}))
 expect(hashManifestValue(receipts)).toBe(BASELINE_MANIFEST_SHA256)
 const tx=(rows:unknown[],project=PROJECT)=>({query:async(sql:string)=>({rows:sql.includes('schema_migrations')?rows:[{project_ref:project,profile:'neuvetra.private-synthetic-staging.v1'}]})}) as any
 expect((await canonicalReceipts(tx(receipts),17)).length).toBe(m.length)
 for(const rows of [receipts.slice(0,16),[...receipts].reverse(),[...receipts,receipts[16]],receipts.map((r,i)=>i===16?{...r,sha256:'0'.repeat(64)}:r)])await expect(canonicalReceipts(tx(rows),17)).rejects.toThrow()
 await expect(canonicalReceipts(tx(receipts,'foreignproject'),17)).rejects.toThrow()
})
test('S01 row lists validated and compared even when table count/digest stay equal',()=>{
 const a=inventory();expect(()=>validateInventory(a)).not.toThrow()
 for(const change of [(v:any)=>v.tables[0].rowHashes[0]='f'.repeat(64),(v:any)=>v.tables[0].rowHashes.pop(),(v:any)=>v.tables[0].rowHashes.push(digest),(v:any)=>v.tables[0].rowHashes[0]='not-a-hash',(v:any)=>v.tables[0].count=-1,(v:any)=>v.tables.push(v.tables[0])]){const b=structuredClone(a);change(b);expect(()=>sameRows(a,b)).toThrow()}
 const missing=structuredClone(a);missing.tables[0]!.rowHashes.shift();expect(()=>sameRows(a,missing,true)).toThrow()
})
test('UTF8 byte evidence, null fingerprints, duplicate and omitted entries fail',()=>{
 const entry=byteEntry('mobile_diesel_versions','v1','calculation','null'),pi=byteEntry('controlled_fleet_statements','s1','statement','π\n')
 expect(pi.byteLength).toBe(3);expect(pi.sha256).toBe(sha('π\n'));expect(entry.sha256).not.toBe(sha('0'))
 expect(()=>byteEntry('t','i','p','π\n',pi.sha256,2)).toThrow();expect(()=>validateRecoveryManifest(content([entry,entry]))).toThrow()
 expect(()=>sameRecovery(content([entry]),content([]))).toThrow();expect(()=>sameRecovery(content([entry]),content([entry],18),true)).not.toThrow()
 expect(()=>sameRecovery(content([entry],18),content([entry]),true)).toThrow()
})
const gateTest=/^[a-f0-9]{64}$/.test(MIGRATION)?test:test.skip
gateTest('fresh reviewed exact17 backup and populated18 forward proof admitted',()=>expect(()=>run(goodGate())).not.toThrow())
gateTest('operator gate refuses independent stale/missing/corrupt proof variants',()=>{
 const cases:Array<(v:any)=>void>=[
  v=>v.gate.operatorId=v.gate.independentReviewerId,v=>v.gate.operatorId=' '+v.gate.independentReviewerId,v=>v.gate.operatorId=' ',v=>v.gate.createdAt='September 16, 2026 07:00:00',v=>v.gate.maintenanceConfirmed=false,v=>v.gate.maintenanceObservedAt=new Date(now-900000).toISOString(),v=>v.gate.maintenanceObservedAt=new Date(now+1).toISOString(),v=>v.gate.schema18ForwardRecoveryReviewed=false,v=>v.gate.providerRecoveryExclusionAccepted=false,v=>v.gate.reviewedMigrationHash='0'.repeat(64),
  v=>v.backup.createdAt=new Date(now-14400000).toISOString(),v=>v.forward.createdAt=new Date(now-14400000).toISOString(),v=>v.restore.createdAt=new Date(now-2000).toISOString(),v=>v.backup.schemaVersion=18,v=>v.restore.port=55463,v=>v.restore.archiveSha256='f'.repeat(64),v=>v.restore.inventory.tables[0].rowHashes[0]='f'.repeat(64),v=>v.restore.inventory.tables[0].count=1.5,
  v=>{for(const r of [v.backup,v.restore])r.inventory.tables[0].rowHashes[0]='invalid'},v=>v.recovery.m74CalculationReplayVerified=false,v=>v.recovery.m73CalculationReplayVerified=false,v=>v.recovery.legacyDownloadsVerified=false,v=>v.recovery.noMutationVerified=false,v=>v.recovery.reviewerId='author',v=>v.recovery.restoreReceiptSha256='f'.repeat(64),
  v=>v.forward.populatedFleetRecoveryVerified=false,v=>v.forward.m73M74AndLegacyPreserved=false,v=>v.forward.runtimeReplayAndDownloadsVerified=false,v=>v.forward.noMutationVerified=false,v=>{for(const key of ['sourceContentManifest','restoredContentManifest']){v.forward[key].entries=v.forward[key].entries.filter((e:any)=>e.table!=='controlled_fleet_reports');v.forward[key].sha256=hashManifestValue(v.forward[key].entries)}}
 ]
 for(const change of cases){const v=goodGate();change(v);expect(()=>run(v)).toThrow()}
})
test('operator modules have no execution side effects on import',async()=>{
 const results=await Promise.all(['./m75-backup','./m75-restore','./m75-apply','./m75-upgrade','./m75-replay'].map(path=>import(path)))
 expect(results.length).toBe(5)
})
