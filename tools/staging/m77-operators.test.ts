import {test,expect} from 'bun:test'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {hashManifestValue} from './create-source-manifest'
import {localName,operatorUrl,canonicalReceipts,MIGRATION,BASELINE_MANIFEST_SHA256,PROJECT,validateInventory,sameRows,sameCatalog,sameMigrationCatalog,sha,type Inventory} from './m77-common'
import {byteEntry,sameRecovery,validateRecoveryManifest,type RecoveryManifest} from './m77-recovery-manifest'
import {validateUpgradeGate} from './m77-upgrade'
const now=Date.parse('2026-09-16T23:00:00Z'),stamp=new Date(now-1000).toISOString(),digest='a'.repeat(64)
function inventory():Inventory{return {tables:[{name:'schema_migrations',count:19,sha256:digest,rowHashes:Array(19).fill(digest)},...Array.from({length:104},(_,i)=>({name:'synthetic_'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26),count:0,sha256:hashManifestValue([]),rowHashes:[]}))],metadata:{tables:digest,triggers:hashManifestValue([]),sequences:hashManifestValue([])},catalogRowHashes:{tables:[digest],triggers:[],sequences:[]},roles:[],memberships:[],defaultAcls:[],dependencies:[],sequences:[]}}
const content=(entries:RecoveryManifest['entries']=[],schemaVersion:19|20=19):RecoveryManifest=>({profile:'neuvetra.m77.recovery-content.v1',schemaVersion,entries,sha256:hashManifestValue(entries)})
function goodGate(){
 const baseline=inventory(),manifest=content([byteEntry('stationary_equipment_reports','r1','html','old report')])
 const backup={status:'m77_encrypted_application_backup',project:PROJECT,schemaVersion:19,createdAt:stamp,archiveSha256:digest,dumpSha256:digest,inventory:baseline,recoveryManifest:manifest}
 const restore={...structuredClone(backup),status:'m77_exact_application_archive_restored',database:'m77_qa_fixture',port:55472,sourceBackupCreatedAt:stamp,applicationRowsAndCatalogExact:true,runtimeRoleFlagsExact:true,allRoleFlagsAndMembershipsExact:true,applicationDefaultAclsExact:true,runtimeNoClaimDenied:true,runtimeExistingActorReadPassed:true,recoveryContentExact:true}
 const recovery={status:'m77_independent_recovery_passed',project:PROJECT,schemaVersion:19,createdAt:stamp,database:restore.database,port:55472,archiveSha256:digest,dumpSha256:digest,restoreReceiptSha256:digest,reviewerId:'independent-reviewer',applicationReadsAndDownloadsVerified:true,m73CalculationReplayVerified:true,m74CalculationReplayVerified:true,m75ReconciliationReplayVerified:true,m76CalculationReplayVerified:true,m76HistoricalProofVerified:true,legacyDownloadsVerified:true,noMutationVerified:true,recoveryManifest:structuredClone(manifest)}
 const gate={status:'m77_independent_operator_gate_passed',project:PROJECT,createdAt:stamp,reviewedMigrationHash:MIGRATION,reviewedCommit:'b'.repeat(40),reviewedHeadObservedCommit:'b'.repeat(40),headObservedAt:stamp,requiredChecksCommit:'b'.repeat(40),requiredChecksPassed:true,checksObservedAt:stamp,independentReviewSnapshotSha256:digest,maintenanceConfirmed:true,maintenanceObservedAt:stamp,schema20ForwardRecoveryReviewed:true,providerRecoveryExclusionAccepted:true,operatorId:'operator',independentReviewerId:'independent-reviewer',restoreReceiptSha256:digest}
 const required=[['mobile_diesel_fuel_statements','statement'],['mobile_diesel_mileage_statements','statement'],['mobile_diesel_versions','calculation'],['mobile_diesel_reports','html'],['controlled_fleet_statements','statement'],['controlled_fleet_versions','dependencies'],['controlled_fleet_reports','html'],['controlled_fleet_reports','snapshot'],['stationary_diesel_statements','statement'],['stationary_diesel_versions','calculation'],['stationary_diesel_reports','html'],['stationary_diesel_reports','snapshot'],['stationary_equipment_statements','statement'],['stationary_equipment_versions','dependencies'],['stationary_equipment_reports','html'],['stationary_equipment_reports','snapshot'],['stationary_equipment_reviews','decision'],['fugitive_statements','statement'],['fugitive_versions','export'],['fugitive_versions','calculation'],['fugitive_versions','dependencies'],['fugitive_reviews','decision'],['fugitive_reports','html'],['fugitive_reports','snapshot'],['fugitive_event_reservations','record'],['fugitive_audit','record']]
 const forwardContent=content(required.map(([table,part],i)=>byteEntry(table!,String(i),part!,'synthetic '+i)),20)
 const forward={status:'m77_schema20_forward_recovery_review_passed',reviewerId:'independent-reviewer',reviewedMigrationHash:MIGRATION,schemaVersion:20,createdAt:stamp,populatedFugitiveRecoveryVerified:true,m77CalculationReplayVerified:true,m77HistoricalProofVerified:true,m73M74M75M76AndLegacyPreserved:true,runtimeReplayAndDownloadsVerified:true,noMutationVerified:true,sourceContentManifest:forwardContent,restoredContentManifest:structuredClone(forwardContent)}
 return {gate,backup,restore,recovery,forward}
}
const run=(v:ReturnType<typeof goodGate>)=>validateUpgradeGate(v.gate,v.backup,v.restore,v.recovery,v.forward,now)
test('new names and fixed operator transport only',()=>{
 for(const name of ['postgres','m76_ops_existing','m77_author_fixture','m77_ops_x;drop','M77_ops_upper','m77_security_x'])expect(()=>localName(name,55472)).toThrow()
 expect(()=>localName('m77_ops_fresh',55472)).not.toThrow();expect(()=>localName('m77_ops_fresh',5432)).toThrow()
 for(const url of ['postgres://postgres:synthetic@localhost:5432/postgres','postgres://postgres.other:synthetic@aws-1-us-west-1.pooler.supabase.com:5432/postgres','postgres://postgres.icockcoguyadhryzydvl:synthetic@aws-1-us-west-1.pooler.supabase.com:6543/postgres'])expect(()=>operatorUrl(url)).toThrow()
})
test('canonical19 receipts and exact20 pin; foreign, changed, missing, duplicate and reordered refuse',async()=>{
 const m=await readMigrationManifest(),receipts=m.slice(0,19).map(({name,sha256})=>({name,sha256}));expect(hashManifestValue(receipts)).toBe(BASELINE_MANIFEST_SHA256);expect(m[19]!.sha256).toBe(MIGRATION)
 const tx=(rows:unknown[],project=PROJECT)=>({query:async(sql:string)=>({rows:sql.includes('schema_migrations')?rows:[{project_ref:project,profile:'neuvetra.private-synthetic-staging.v1'}]})})as any
 expect((await canonicalReceipts(tx(receipts),19)).length).toBe(20);expect((await canonicalReceipts(tx(m.map(({name,sha256})=>({name,sha256}))),20)).length).toBe(20)
 for(const rows of [receipts.slice(0,18),[...receipts].reverse(),[...receipts,receipts[18]],receipts.map((r,i)=>i===18?{...r,sha256:'0'.repeat(64)}:r)])await expect(canonicalReceipts(tx(rows),19)).rejects.toThrow()
 await expect(canonicalReceipts(tx(receipts,'foreignproject'),19)).rejects.toThrow()
})
test('per-row multiplicity and original sequence state survive independently claimed table hashes',()=>{
 const a=inventory();expect(()=>validateInventory(a)).not.toThrow()
 for(const change of [(v:any)=>v.tables[0].rowHashes[0]='f'.repeat(64),(v:any)=>v.tables[0].rowHashes.pop(),(v:any)=>v.tables[0].rowHashes.push(digest),(v:any)=>v.tables[0].rowHashes[0]='not-a-hash',(v:any)=>v.tables[0].count=-1,(v:any)=>v.tables.push(v.tables[0])]){const b=structuredClone(a);change(b);expect(()=>sameRows(a,b)).toThrow()}
 a.sequences=[{name:'old_sequence',lastValue:'7',isCalled:true}];const b=structuredClone(a);b.sequences[0]!.lastValue='8';expect(()=>sameRows(a,b,true)).toThrow();b.sequences[0]!.lastValue='7';b.sequences[0]!.isCalled=false;expect(()=>sameRows(a,b)).toThrow()
})
test('UTF8, explicit nulls, complete qualified event identities and schema direction',()=>{
 const pi=byteEntry('fugitive_statements','s1','statement','π\n'),event=byteEntry('fugitive_event_reservations','["company",2025,"event","id"]','record','record');expect(pi.byteLength).toBe(3);expect(pi.sha256).toBe(sha('π\n'));expect(()=>byteEntry('t','i','p','π\n',pi.sha256,2)).toThrow()
 expect(()=>validateRecoveryManifest(content([event,event],20))).toThrow();expect(()=>validateRecoveryManifest(content([event],19))).toThrow();expect(()=>sameRecovery(content([pi],20),content([],20))).toThrow();expect(()=>sameRecovery(content([]),content([],20),true)).not.toThrow();expect(()=>sameRecovery(content([],20),content([]),true)).toThrow()
})
test('no old-trigger exception: exact retained M76 guard and every original trigger remain checked',()=>{
 const old={table_name:'schema_migrations',tgname:'old_guard',definition:'old trigger',tgenabled:'O'},before=inventory();before.catalogRowHashes.triggers=[hashManifestValue(old)];before.metadata.triggers=hashManifestValue([old]);const after=structuredClone(before)
 expect(()=>sameMigrationCatalog(before,after,[old])).not.toThrow()
 for(const rows of [[],[{...old,tgenabled:'D'}],[{...old,definition:'changed'}],[old,{...old,tgname:'new_on_old_table'}]])expect(()=>sameMigrationCatalog(before,after,rows)).toThrow()
 const changed=structuredClone(after);changed.catalogRowHashes.tables[0]='f'.repeat(64);expect(()=>sameCatalog(before,changed,true)).toThrow()
})
test('fresh independently reviewed19 restore and populated20 forward proof admit',()=>expect(()=>run(goodGate())).not.toThrow())
test('upgrade refuses stale, changed-head, missing, unreviewed or coordinated corruption',()=>{
 const cases:Array<(v:any)=>void>=[
 v=>v.gate.operatorId=v.gate.independentReviewerId,v=>v.gate.operatorId=' ',v=>v.gate.reviewedHeadObservedCommit='c'.repeat(40),v=>v.gate.requiredChecksCommit='c'.repeat(40),v=>v.gate.requiredChecksPassed=false,v=>v.gate.headObservedAt=new Date(now-900000).toISOString(),v=>v.gate.checksObservedAt=new Date(now+1).toISOString(),v=>delete v.gate.independentReviewSnapshotSha256,
 v=>v.gate.createdAt='September 16, 2026',v=>v.gate.maintenanceConfirmed=false,v=>v.gate.maintenanceObservedAt=new Date(now-900000).toISOString(),v=>v.gate.schema20ForwardRecoveryReviewed=false,v=>v.gate.providerRecoveryExclusionAccepted=false,v=>v.gate.reviewedMigrationHash='0'.repeat(64),
 v=>v.backup.createdAt=new Date(now-14400000).toISOString(),v=>v.forward.createdAt=new Date(now-14400000).toISOString(),v=>v.restore.createdAt=new Date(now-2000).toISOString(),v=>v.backup.schemaVersion=20,v=>v.restore.port=55463,v=>v.restore.archiveSha256='f'.repeat(64),v=>v.restore.inventory.tables[0].rowHashes[0]='f'.repeat(64),v=>v.restore.inventory.tables[0].count=1.5,
 v=>v.recovery.m74CalculationReplayVerified=false,v=>v.recovery.m75ReconciliationReplayVerified=false,v=>v.recovery.m76CalculationReplayVerified=false,v=>v.recovery.m76HistoricalProofVerified=false,v=>v.recovery.m73CalculationReplayVerified=false,v=>v.recovery.legacyDownloadsVerified=false,v=>v.recovery.noMutationVerified=false,v=>v.recovery.reviewerId='author',v=>v.recovery.restoreReceiptSha256='f'.repeat(64),
 v=>v.forward.m77CalculationReplayVerified=false,v=>v.forward.m77HistoricalProofVerified=false,v=>v.forward.populatedFugitiveRecoveryVerified=false,v=>v.forward.m73M74M75M76AndLegacyPreserved=false,v=>v.forward.runtimeReplayAndDownloadsVerified=false,v=>v.forward.noMutationVerified=false,
 ...['fugitive_statements','fugitive_versions','fugitive_reviews','fugitive_reports','fugitive_event_reservations','fugitive_audit','stationary_equipment_reports'].map(table=>(v:any)=>{for(const key of ['sourceContentManifest','restoredContentManifest']){v.forward[key].entries=v.forward[key].entries.filter((e:any)=>e.table!==table);v.forward[key].sha256=hashManifestValue(v.forward[key].entries)}}),
 ...['calculation','dependencies'].map(part=>(v:any)=>{for(const key of ['sourceContentManifest','restoredContentManifest']){v.forward[key].entries=v.forward[key].entries.map((e:any)=>e.table==='fugitive_versions'&&e.part===part?byteEntry(e.table,e.id,e.part,'null'):e);v.forward[key].sha256=hashManifestValue(v.forward[key].entries)}})
 ];for(const change of cases){const v=goodGate();change(v);expect(()=>run(v)).toThrow()}
})
test('imports never connect or migrate',async()=>expect((await Promise.all(['./m77-backup','./m77-restore','./m77-apply','./m77-upgrade','./m77-replay'].map(path=>import(path)))).length).toBe(5))

