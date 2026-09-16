import {test,expect} from 'bun:test'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {hashManifestValue} from './create-source-manifest'
import {localName,operatorUrl,canonicalReceipts,MIGRATION,BASELINE_MANIFEST_SHA256,PROJECT,validateInventory,sameRows,sha,sameMigrationCatalog,MOBILE_FUEL_GUARD} from './m76-common'
import {byteEntry,sameRecovery,validateRecoveryManifest,type RecoveryManifest} from './m76-recovery-manifest'
import {validateUpgradeGate} from './m76-upgrade'
const now=Date.parse('2026-09-16T07:00:00Z'),stamp=new Date(now-1000).toISOString(),digest='a'.repeat(64)
function inventory(){return {tables:[{name:'schema_migrations',count:18,sha256:digest,rowHashes:Array(18).fill(digest)},...Array.from({length:89},(_,i)=>({name:'synthetic_'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26),count:0,sha256:hashManifestValue([]),rowHashes:[]}))],metadata:{tables:digest},catalogRowHashes:{tables:[digest]},roles:[],memberships:[],defaultAcls:[],dependencies:[]}}
const content=(entries:RecoveryManifest['entries']=[],schemaVersion:18|19=18):RecoveryManifest=>({profile:'neuvetra.m76.recovery-content.v1',schemaVersion,entries,sha256:hashManifestValue(entries)})
function goodGate(){
 const baseline=inventory(),manifest=content([byteEntry('mobile_diesel_reports','r1','html','old report')])
 const backup={status:'m76_encrypted_application_backup',project:PROJECT,schemaVersion:18,createdAt:stamp,archiveSha256:digest,dumpSha256:digest,inventory:baseline,recoveryManifest:manifest}
 const restore={...structuredClone(backup),status:'m76_exact_application_archive_restored',database:'m76_security_fixture',port:55472,sourceBackupCreatedAt:stamp,applicationRowsAndCatalogExact:true,runtimeRoleFlagsExact:true,allRoleFlagsAndMembershipsExact:true,applicationDefaultAclsExact:true,runtimeNoClaimDenied:true,runtimeExistingActorReadPassed:true,recoveryContentExact:true}
 const recovery={status:'m76_independent_recovery_passed',project:PROJECT,schemaVersion:18,createdAt:stamp,database:restore.database,port:55472,archiveSha256:digest,dumpSha256:digest,restoreReceiptSha256:digest,reviewerId:'independent-reviewer',applicationReadsAndDownloadsVerified:true,m73CalculationReplayVerified:true,m74CalculationReplayVerified:true,m75ReconciliationReplayVerified:true,legacyDownloadsVerified:true,noMutationVerified:true,recoveryManifest:structuredClone(manifest)}
 const gate={status:'m76_independent_operator_gate_passed',project:PROJECT,createdAt:stamp,reviewedMigrationHash:MIGRATION,reviewedCommit:'b'.repeat(40),maintenanceConfirmed:true,maintenanceObservedAt:stamp,schema19ForwardRecoveryReviewed:true,providerRecoveryExclusionAccepted:true,operatorId:'operator',independentReviewerId:'independent-reviewer',restoreReceiptSha256:digest}
 const forwardContent=content([['mobile_diesel_fuel_statements','statement'],['mobile_diesel_mileage_statements','statement'],['mobile_diesel_versions','calculation'],['mobile_diesel_reports','html'],['controlled_fleet_statements','statement'],['controlled_fleet_versions','dependencies'],['controlled_fleet_reports','html'],['controlled_fleet_reports','snapshot'],['stationary_diesel_statements','statement'],['stationary_diesel_versions','calculation'],['stationary_diesel_reports','html'],['stationary_diesel_reports','snapshot'],['stationary_equipment_statements','statement'],['stationary_equipment_versions','dependencies'],['stationary_equipment_reports','html'],['stationary_equipment_reports','snapshot'],['stationary_equipment_reviews','decision']].map(([table,part],i)=>byteEntry(table!,String(i),part!,'synthetic '+i)),19)
 const forward={status:'m76_schema19_forward_recovery_review_passed',reviewerId:'independent-reviewer',reviewedMigrationHash:MIGRATION,schemaVersion:19,createdAt:stamp,populatedStationaryRecoveryVerified:true,m76CalculationReplayVerified:true,m76HistoricalProofVerified:true,m73M74M75AndLegacyPreserved:true,runtimeReplayAndDownloadsVerified:true,noMutationVerified:true,sourceContentManifest:forwardContent,restoredContentManifest:structuredClone(forwardContent)}
 return {gate,backup,restore,recovery,forward}
}
const run=(v:ReturnType<typeof goodGate>)=>validateUpgradeGate(v.gate,v.backup,v.restore,v.recovery,v.forward,now)
test('fixed hosted project and new loopback targets only',()=>{
 for(const name of ['postgres','m74_ops_existing','m76_author_fixture','m76_ops_x;drop','M76_ops_upper'])expect(()=>localName(name,55463)).toThrow()
 expect(()=>localName('m76_ops_fresh',55472)).not.toThrow();expect(()=>localName('m76_ops_fresh',5432)).toThrow()
 for(const url of ['postgres://postgres:synthetic@localhost:5432/postgres','postgres://postgres.other:synthetic@aws-1-us-west-1.pooler.supabase.com:5432/postgres','postgres://postgres.icockcoguyadhryzydvl:synthetic@aws-1-us-west-1.pooler.supabase.com:6543/postgres'])expect(()=>operatorUrl(url)).toThrow()
})
test('canonical eighteen receipts; malformed, old, reordered and foreign target refused',async()=>{
 const m=await readMigrationManifest(),receipts=m.slice(0,18).map(({name,sha256})=>({name,sha256}))
 expect(hashManifestValue(receipts)).toBe(BASELINE_MANIFEST_SHA256)
 const tx=(rows:unknown[],project=PROJECT)=>({query:async(sql:string)=>({rows:sql.includes('schema_migrations')?rows:[{project_ref:project,profile:'neuvetra.private-synthetic-staging.v1'}]})}) as any
 expect((await canonicalReceipts(tx(receipts),18)).length).toBe(m.length)
 for(const rows of [receipts.slice(0,16),[...receipts].reverse(),[...receipts,receipts[16]],receipts.map((r,i)=>i===16?{...r,sha256:'0'.repeat(64)}:r)])await expect(canonicalReceipts(tx(rows),18)).rejects.toThrow()
 await expect(canonicalReceipts(tx(receipts,'foreignproject'),18)).rejects.toThrow()
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
 expect(()=>sameRecovery(content([entry]),content([]))).toThrow();expect(()=>sameRecovery(content([entry]),content([entry],19),true)).not.toThrow()
 expect(()=>sameRecovery(content([entry],19),content([entry]),true)).toThrow()
})
test('old-table trigger addition is exact; originals and unrelated additions remain checked',()=>{
 const old={table_name:'schema_migrations',tgname:'old_guard',definition:'old trigger',tgenabled:'O'},before=inventory()
 before.catalogRowHashes.triggers=[hashManifestValue(old)];before.metadata.triggers=hashManifestValue([old])
 before.tables.push({name:'mobile_diesel_evidence_reservations',count:0,sha256:hashManifestValue([]),rowHashes:[]})
 const after=structuredClone(before);after.catalogRowHashes.triggers=[hashManifestValue(old),hashManifestValue(MOBILE_FUEL_GUARD)].sort();after.metadata.triggers=hashManifestValue([old,MOBILE_FUEL_GUARD])
 expect(()=>sameMigrationCatalog(before,after,[old,MOBILE_FUEL_GUARD])).not.toThrow()
 for(const rows of [[MOBILE_FUEL_GUARD],[old,{...MOBILE_FUEL_GUARD,tgenabled:'D'}],[old,{...MOBILE_FUEL_GUARD,definition:MOBILE_FUEL_GUARD.definition.replace('BEFORE INSERT','BEFORE UPDATE')}],[old,MOBILE_FUEL_GUARD,{...MOBILE_FUEL_GUARD,tgname:'unexpected_guard'}],[{...old,definition:'changed old trigger'},MOBILE_FUEL_GUARD]])expect(()=>sameMigrationCatalog(before,after,rows)).toThrow()
 const replaced=structuredClone(after);replaced.catalogRowHashes.triggers=replaced.catalogRowHashes.triggers.filter(h=>h!==hashManifestValue(old));expect(()=>sameMigrationCatalog(before,replaced,[old,MOBILE_FUEL_GUARD])).toThrow()
})
const gateTest=/^[a-f0-9]{64}$/.test(MIGRATION)?test:test.skip
gateTest('fresh reviewed exact18 backup and populated19 forward proof admitted',()=>expect(()=>run(goodGate())).not.toThrow())
gateTest('operator gate refuses independent stale/missing/corrupt proof variants',()=>{
 const cases:Array<(v:any)=>void>=[
  v=>v.gate.operatorId=v.gate.independentReviewerId,v=>v.gate.operatorId=' '+v.gate.independentReviewerId,v=>v.gate.operatorId=' ',v=>v.gate.createdAt='September 16, 2026 07:00:00',v=>v.gate.maintenanceConfirmed=false,v=>v.gate.maintenanceObservedAt=new Date(now-900000).toISOString(),v=>v.gate.maintenanceObservedAt=new Date(now+1).toISOString(),v=>v.gate.schema19ForwardRecoveryReviewed=false,v=>v.gate.providerRecoveryExclusionAccepted=false,v=>v.gate.reviewedMigrationHash='0'.repeat(64),
  v=>v.backup.createdAt=new Date(now-14400000).toISOString(),v=>v.forward.createdAt=new Date(now-14400000).toISOString(),v=>v.restore.createdAt=new Date(now-2000).toISOString(),v=>v.backup.schemaVersion=19,v=>v.restore.port=55463,v=>v.restore.archiveSha256='f'.repeat(64),v=>v.restore.inventory.tables[0].rowHashes[0]='f'.repeat(64),v=>v.restore.inventory.tables[0].count=1.5,
  v=>{for(const r of [v.backup,v.restore])r.inventory.tables[0].rowHashes[0]='invalid'},v=>v.recovery.m74CalculationReplayVerified=false,v=>v.recovery.m75ReconciliationReplayVerified=false,v=>v.forward.m76CalculationReplayVerified=false,v=>v.forward.m76HistoricalProofVerified=false,v=>v.recovery.m73CalculationReplayVerified=false,v=>v.recovery.legacyDownloadsVerified=false,v=>v.recovery.noMutationVerified=false,v=>v.recovery.reviewerId='author',v=>v.recovery.restoreReceiptSha256='f'.repeat(64),
  v=>v.forward.populatedStationaryRecoveryVerified=false,v=>v.forward.m73M74M75AndLegacyPreserved=false,v=>v.forward.runtimeReplayAndDownloadsVerified=false,v=>v.forward.noMutationVerified=false,v=>{for(const key of ['sourceContentManifest','restoredContentManifest']){v.forward[key].entries=v.forward[key].entries.filter((e:any)=>e.table!=='controlled_fleet_reports');v.forward[key].sha256=hashManifestValue(v.forward[key].entries)}},v=>{for(const key of ['sourceContentManifest','restoredContentManifest']){v.forward[key].entries=v.forward[key].entries.map((e:any)=>e.table==='stationary_diesel_versions'&&e.part==='calculation'?byteEntry(e.table,e.id,e.part,'null'):e);v.forward[key].sha256=hashManifestValue(v.forward[key].entries)}}
 ]
 for(const change of cases){const v=goodGate();change(v);expect(()=>run(v)).toThrow()}
})
test('operator modules have no execution side effects on import',async()=>{
 const results=await Promise.all(['./m76-backup','./m76-restore','./m76-apply','./m76-upgrade','./m76-replay'].map(path=>import(path)))
 expect(results.length).toBe(5)
})
