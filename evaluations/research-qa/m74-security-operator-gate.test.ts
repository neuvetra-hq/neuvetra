import {test,expect} from 'bun:test'
import {validateUpgradeGate} from '../../tools/staging/m74-upgrade'
import {PROJECT,MIGRATION} from '../../tools/staging/m74-common'
import {canonical,digest} from './m74-security-recovery'
// Self-contained synthetic gate. Actual recovery observations are separate receipts.
const now=Date.parse('2026-09-16T00:00:00Z'),when=(offset=0)=>new Date(now+offset).toISOString()
async function fixture(){
 const manifest=(schemaVersion:number,tables:string[])=>{const entries=tables.map(table=>({table,id:'fixture-'+table,part:table.endsWith('_versions')?'calculation':table.endsWith('_reports')?'html':'statement',sha256:digest('synthetic'),byteLength:9}));return {profile:'neuvetra.m74.recovery-content.v1',schemaVersion,entries,sha256:digest(canonical(entries))}}
 const r:any={status:'m74_exact_application_archive_restored',project:PROJECT,schemaVersion:16,database:'m74_security_fixture',archiveSha256:'a'.repeat(64),dumpSha256:'b'.repeat(64),inventory:{tables:[{name:'stationary_gas_versions',count:1,sha256:'c'.repeat(64),rowHashes:['d'.repeat(64)]}],metadata:{functions:'e'.repeat(64)},catalogRowHashes:{functions:['f'.repeat(64)]},roles:[{rolname:'neuvetra_runtime',rolsuper:false}],memberships:[],defaultAcls:[]},recoveryManifest:manifest(16,['stationary_gas_versions','stationary_gas_reports']),applicationRowsAndCatalogExact:true,runtimeRoleFlagsExact:true,allRoleFlagsAndMembershipsExact:true,applicationDefaultAclsExact:true,runtimeNoClaimDenied:true,runtimeExistingActorReadPassed:true,recoveryContentExact:true}
 const content=manifest(17,['mobile_diesel_fuel_statements','mobile_diesel_mileage_statements','mobile_diesel_versions','mobile_diesel_reports'])
 const f:any={status:'m74_schema17_forward_recovery_review_passed',reviewedMigrationHash:MIGRATION,schemaVersion:17,populatedMobileRecoveryVerified:true,m73AndLegacyPreserved:true,runtimeReplayAndDownloadsVerified:true,noMutationVerified:true,sourceContentManifest:content,restoredContentManifest:structuredClone(content)}
 const restore={...r,createdAt:when(-2000),sourceBackupCreatedAt:when(-3000),port:55472},backup={status:'m74_encrypted_application_backup',project:PROJECT,schemaVersion:16,createdAt:when(-3000),archiveSha256:r.archiveSha256,dumpSha256:r.dumpSha256,inventory:structuredClone(r.inventory),recoveryManifest:structuredClone(r.recoveryManifest)}
 const gate={status:'m74_independent_operator_gate_passed',project:PROJECT,createdAt:when(),reviewedMigrationHash:MIGRATION,reviewedCommit:'c'.repeat(40),maintenanceConfirmed:true,maintenanceObservedAt:when(),schema17ForwardRecoveryReviewed:true,providerRecoveryExclusionAccepted:true,operatorId:'fixture-operator',independentReviewerId:'fixture-independent',restoreReceiptSha256:'a'.repeat(64)}
 const recovery={status:'m74_independent_recovery_passed',createdAt:when(-1000),project:PROJECT,schemaVersion:16,port:55472,database:r.database,archiveSha256:r.archiveSha256,dumpSha256:r.dumpSha256,restoreReceiptSha256:gate.restoreReceiptSha256,reviewerId:gate.independentReviewerId,applicationReadsAndDownloadsVerified:true,m73CalculationReplayVerified:true,legacyDownloadsVerified:true,noMutationVerified:true,recoveryManifest:structuredClone(r.recoveryManifest)}
 const forward={...f,reviewerId:gate.independentReviewerId,createdAt:when(-4000)}
 return {gate,backup,restore,recovery,forward}
}
const run=(v:Awaited<ReturnType<typeof fixture>>)=>validateUpgradeGate(v.gate,v.backup,v.restore,v.recovery,v.forward,now)
test('positive synthetic gate and precise maintenance/backup age boundaries',async()=>{
 const v=await fixture();expect(()=>run(v)).not.toThrow();v.gate.maintenanceObservedAt=when(-899999);expect(()=>run(v)).not.toThrow();v.gate.maintenanceObservedAt=when(-900000);expect(()=>run(v)).toThrow()
 const w=await fixture();w.backup.createdAt=when(-14399999);w.restore.sourceBackupCreatedAt=w.backup.createdAt;expect(()=>run(w)).not.toThrow();w.backup.createdAt=when(-14400000);w.restore.sourceBackupCreatedAt=w.backup.createdAt;expect(()=>run(w)).toThrow()
})
test('independent recovery field failures cannot substitute for actual replay/download observations',async()=>{
 for(const key of ['applicationReadsAndDownloadsVerified','m73CalculationReplayVerified','legacyDownloadsVerified','noMutationVerified'])for(const value of [undefined,false,'true',1]){const v=await fixture();(v.recovery as any)[key]=value;expect(()=>run(v)).toThrow()}
 for(const key of ['schemaVersion','port','database','archiveSha256','dumpSha256','restoreReceiptSha256','reviewerId']){const v=await fixture();delete (v.recovery as any)[key];expect(()=>run(v)).toThrow()}
})
test('full exact content detects omissions, null-to-zero changes and duplicate entry substitutions',async()=>{
 for(const mutate of [(m:any)=>m.entries.pop(),(m:any)=>{m.entries[0].sha256=digest('0')},(m:any)=>{m.entries[1]=structuredClone(m.entries[0])}]){const v=await fixture();mutate(v.recovery.recoveryManifest);v.recovery.recoveryManifest.sha256=digest(canonical(v.recovery.recoveryManifest.entries));expect(()=>run(v)).toThrow()}
})
test('schema17 forward recovery requires both evidence dimensions, calculation and captured report',async()=>{
 for(const table of ['mobile_diesel_fuel_statements','mobile_diesel_mileage_statements','mobile_diesel_versions','mobile_diesel_reports']){const v=await fixture();for(const k of ['sourceContentManifest','restoredContentManifest']){const m=(v.forward as any)[k];m.entries=m.entries.filter((e:any)=>e.table!==table);m.sha256=digest(canonical(m.entries))}expect(()=>run(v)).toThrow()}
 for(const field of ['populatedMobileRecoveryVerified','m73AndLegacyPreserved','runtimeReplayAndDownloadsVerified','noMutationVerified']){const v=await fixture();(v.forward as any)[field]=false;expect(()=>run(v)).toThrow()}
})
test('freshness cannot rescue wrong state, altered old functions, unsafe permissions or reordered authority',async()=>{
 const changes:Array<(v:any)=>void>=[v=>v.backup.schemaVersion=17,v=>v.restore.port=55463,v=>v.gate.reviewedMigrationHash='f'.repeat(64),v=>v.gate.maintenanceConfirmed=false,v=>v.gate.operatorId=v.gate.independentReviewerId,v=>v.recovery.createdAt=when(-2001),v=>v.forward.createdAt=when(1),v=>v.restore.inventory.roles[0].rolsuper=!v.restore.inventory.roles[0].rolsuper,v=>v.restore.inventory.catalogRowHashes.functions.push('f'.repeat(64)),v=>v.restore.inventory.defaultAcls.push({schema:'*'}),v=>v.restore.inventory.tables[0].rowHashes.push('f'.repeat(64))]
 for(const [index,change] of changes.entries()){const v=await fixture();change(v);let refused=false;try{run(v)}catch{refused=true}expect(refused,'mutation '+index).toBe(true)}
})
