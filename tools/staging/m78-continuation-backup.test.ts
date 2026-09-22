import {test,expect} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {FIXED,PROVENANCE,CONTINUATION_PROFILE,validateArguments,validateGuardObservation,continuationPayload,loadContinuationGuard,continuationSourcePins,verifyContinuationBackupJournal} from './m78-continuation-backup'
import {EXCLUSION} from './m78-hosted-database'
import {sha,hash,PROJECT,REVIEWED_MIGRATION_SHA256,NEW_TABLES} from './m78-inventory'
function fixture(){
 const h='a'.repeat(64),tables=[{name:'schema_migrations',count:21,sha256:h,rowHashes:Array(21).fill(h)},...Array.from({length:112},(_,i)=>({name:'fixture_'+i,count:0,sha256:h,rowHashes:[]})),...NEW_TABLES.map(name=>({name,count:['scope1_heads','scope1_versions','scope1_requests','scope1_audit'].includes(name)?1:0,sha256:h,rowHashes:['scope1_heads','scope1_versions','scope1_requests','scope1_audit'].includes(name)?[h]:[]}))]
 const inventory={tables,metadata:{},catalogRowHashes:{},functions:[],tableObjects:[],sequences:[],roles:[{rolname:'postgres'}],memberships:[],dependencies:[],defaultAcls:[{owner:'postgres',schema:'public',kind:'r',acl:'{}'}]},content={profile:'neuvetra.m78.recovery-content.v1',schemaVersion:21,entries:[],sha256:hash([])}
 const observation={status:'m78_timed_out_save_confirmed_committed',project:PROJECT,readOnly:true,applicationWrites:0,journalSha256:FIXED.journalSha256,intentSequence:63,version:{id:FIXED.versionId,version_sha256:FIXED.versionSha256},inventory,content},dump=Buffer.from('fictional custom archive bytes only')
 const snapshot:any={profile:CONTINUATION_PROFILE,project:PROJECT,createdAt:'2026-09-22T17:00:00.000Z',schemaVersion:21,migrationSha256:REVIEWED_MIGRATION_SHA256,source:{transport:'fixed-project-operator-verify-full',database:'postgres',providerRecoveryExcluded:true},provenance:PROVENANCE,inventory,content,dependencies:{authUserIds:[],authUidDefinition:'fictional',providerRecovery:EXCLUSION},dumpSha256:sha(dump),dumpBase64:dump.toString('base64')}
 return {observation,snapshot}
}
test('fixed backup/restore namespace refuses upgrade, alternate target, output and extra args',()=>{
 const backup=['pg_dump',FIXED.archive,FIXED.backupJournal],restore=[FIXED.archive,'a'.repeat(64),'b'.repeat(64),'pg_restore',FIXED.database,FIXED.localJournal,FIXED.restoreJournal];expect(()=>validateArguments('backup',backup)).not.toThrow();expect(()=>validateArguments('restore',restore)).not.toThrow()
 for(const mode of ['upgrade','retry','other'])expect(()=>validateArguments(mode,backup)).toThrow()
 for(const index of [1,2]){const v=[...backup];v[index]='elsewhere';expect(()=>validateArguments('backup',v)).toThrow()}
 for(const index of [0,1,2,4,5,6]){const v=[...restore];v[index]='elsewhere';expect(()=>validateArguments('restore',v)).toThrow()}
 expect(()=>validateArguments('backup',[...backup,'extra'])).toThrow()
})
test('original single committed inventory and exact provenance are required, no later continuation admitted',()=>{
 const {observation:o}=fixture();expect(()=>validateGuardObservation(o)).not.toThrow()
 for(const patch of [{status:'failed'},{readOnly:false},{applicationWrites:1},{journalSha256:'b'.repeat(64)},{intentSequence:62},{version:{id:FIXED.versionId,version_sha256:'b'.repeat(64)}}])expect(()=>validateGuardObservation({...o,...patch})).toThrow()
 const changed=structuredClone(o);changed.inventory.tables.find(t=>t.name==='scope1_reports')!.count=1;changed.inventory.tables.find(t=>t.name==='scope1_reports')!.rowHashes=['a'.repeat(64)];expect(()=>validateGuardObservation(changed)).toThrow()
})
test('21-only transfer preserves full source, explicitly projects only unrelated defaults and validates dump',()=>{
 const {snapshot:s}=fixture(),before=JSON.stringify(s),b=continuationPayload(s,sha(before));expect(JSON.stringify(s)).toBe(before);expect(b.schemaVersion).toBe(21);expect(b.inventory.defaultAcls).toEqual([]);expect(s.inventory.defaultAcls).toHaveLength(1);expect(b.content).toEqual(s.content)
 for(const patch of [{schemaVersion:20},{migrationSha256:null},{profile:'old'},{provenance:{...PROVENANCE,versionSha256:'b'.repeat(64)}},{dumpSha256:'b'.repeat(64)}]){const changed={...s,...patch};expect(()=>continuationPayload(changed,sha(JSON.stringify(changed)))).toThrow()}
 for(const schema of ['*','neuvetra','unknown']){const changed=structuredClone(s);changed.inventory.defaultAcls[0].schema=schema;expect(()=>continuationPayload(changed,sha(JSON.stringify(changed)))).toThrow()}
 expect(()=>continuationPayload(s,'0'.repeat(64))).toThrow()
})
test('changed private guard bytes refuse before any database action; public source map is complete current bytes',async()=>{
 await expect(loadContinuationGuard(async()=>Buffer.from('{}'))).rejects.toThrow('Original outcome evidence changed')
 const pins=await continuationSourcePins();expect(pins).toHaveLength(117);expect(new Set(pins.map(p=>p.path)).size).toBe(117);for(const pin of pins)expect(sha(await readFile(pin.path))).toBe(pin.sha256)
 expect(pins.some(p=>p.path==='tools/staging/m77-seal-backup.ps1')).toBe(true);expect(pins.filter(p=>p.path.includes('/migrations/'))).toHaveLength(21)
})
test('restore binds original closed backup events and refuses replacement outcomes or chronology',()=>{
 const start={status:'m78_continuation21_backup_started',project:PROJECT,createdAt:'2026-09-22T17:00:00.000Z',provenance:PROVENANCE},end={status:'m78_continuation21_encrypted_backup',project:PROJECT,profile:CONTINUATION_PROFILE,schemaVersion:21,migrationSha256:REVIEWED_MIGRATION_SHA256,archiveSha256:'a'.repeat(64),snapshotSha256:'b'.repeat(64),createdAt:'2026-09-22T17:01:00.000Z',provenance:PROVENANCE};const text=(a:any,b:any)=>JSON.stringify(a)+'\n'+JSON.stringify(b)+'\n';expect(verifyContinuationBackupJournal(text(start,end),end.archiveSha256,end.snapshotSha256)).toEqual(end)
 for(const patch of [{schemaVersion:20},{status:'failed'},{archiveSha256:'c'.repeat(64)},{snapshotSha256:'c'.repeat(64)},{createdAt:'2026-09-22T16:59:00.000Z'},{provenance:{...PROVENANCE,versionId:'other'}}])expect(()=>verifyContinuationBackupJournal(text(start,{...end,...patch}),end.archiveSha256,end.snapshotSha256)).toThrow()
 expect(()=>verifyContinuationBackupJournal(JSON.stringify(end)+'\n',end.archiveSha256,end.snapshotSha256)).toThrow();expect(()=>verifyContinuationBackupJournal(text(start,end)+'{}\n',end.archiveSha256,end.snapshotSha256)).toThrow()
})
