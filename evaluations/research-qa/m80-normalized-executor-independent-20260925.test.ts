import {test,expect} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {artifacts,reviewReaders,NOW,MemoryJournal,fakeDatabase,sourceState} from './m80-normalized-executor-independent-20260925-fixture'
import {executeM80HostedStage,m80ExecutorAttemptPath} from '../../.superpowers/m80-foundation-executor-v2'
import {m80HostedSha256,m80HostedCanonicalJson,buildM80HostedPreparationPlan} from '../../.superpowers/m80-foundation-hosted-prepare-v3'
import {composeM80StageBundle,m80StageBundlePath} from '../../.superpowers/m80-stage-bundle-compose-v2'
import {assertM80BackupV2RawSchema22Delta} from '../../.superpowers/m80-backup-v2-core'

test('missing, mismatched and false normalized proof bodies refuse before an attempt or mutation',async()=>{
 const variants=[(a:any)=>{delete a.planEvidence.normalizationProof},(a:any)=>{a.planEvidence.normalizationProof.value.normalizedMetadataExact=false},(a:any)=>{a.planEvidence.normalizationProof.value.sourceInternalTriggerRows++},(a:any)=>{a.planEvidence.normalizationProof.value.sourceRawMetadataSha256='f'.repeat(64)},(a:any)=>{a.planEvidence.normalizationProof.value.profile='neuvetra.m80.foundation-restore-normalization-proof.v1'},(a:any)=>{a.planEvidence.normalizationProof.pin.path='foreign.json'}]
 for(const variant of variants){const a=await artifacts('migration'),reader=reviewReaders.get(a)!,journal=new MemoryJournal();variant(a);let mutations=0
  await expect(executeM80HostedStage(a,{now:()=>NOW,readSourceBytes:reader,journal,database:fakeDatabase(),migrationSourceState:sourceState(a),migrate:async()=>{mutations++},observer:{observe:async()=>{throw Error('must not observe')}}})).rejects.toThrow()
  expect(journal.values.size).toBe(0);expect(mutations).toBe(0)
 }
})

test('existing v1 attempt marker blocks new v2 mutation through the same durable path',async()=>{
 const a=await artifacts('migration'),journal=new MemoryJournal();const path=m80ExecutorAttemptPath(a.intent as any)
 journal.values.set(path,{profile:'neuvetra.m80.foundation-executor-attempt.v1',status:'unknown consumed historical marker'})
 let mutations=0
 await expect(executeM80HostedStage(a,{now:()=>NOW,readSourceBytes:reviewReaders.get(a)!,journal,database:fakeDatabase(),migrationSourceState:sourceState(a),migrate:async()=>{mutations++},observer:{observe:async()=>{throw Error('must not observe')}}})).rejects.toThrow('already exists')
 expect(mutations).toBe(0);expect((journal.values.get(path) as any).profile).toBe('neuvetra.m80.foundation-executor-attempt.v1')
})

test('exact private migration observer uses raw ACL and duplicate-trigger checks, not restoration normalization',async()=>{
 const text=await readFile('.superpowers/m80-foundation-executor-v2.ts','utf8'),start=text.indexOf('function databaseObserver('),end=text.indexOf('\nexport type M80RailwayRun',start)
 const code=new Bun.Transpiler({loader:'ts'}).transformSync(text.slice(start,end))
 const trigger={constraintName:'same',constraintTable:'neuvetra.old_table',enabled:'O',function:'fn'}
 for(const kind of ['external_acl_removed','global_acl_added','duplicate_trigger_removed','duplicate_trigger_added']){
  const baseline:any={inventory:{defaultAcls:[]},internalTriggers:[trigger,trigger]};const after=structuredClone(baseline)
  if(kind==='external_acl_removed')baseline.inventory.defaultAcls.push({schema:'external',owner:'postgres',kind:'r',acl:'{postgres=r/postgres}'})
  if(kind==='global_acl_added')after.inventory.defaultAcls.push({schema:'*',owner:'postgres',kind:'r',acl:'{postgres=r/postgres}'})
  if(kind==='duplicate_trigger_removed')after.internalTriggers.pop()
  if(kind==='duplicate_trigger_added')after.internalTriggers.push(trigger)
  const query=async()=>{throw Error('Unexpected query past earlier raw boundary')},db={transaction:async(fn:any)=>fn({exec:async(sql:string)=>expect(sql).toContain('read only'),query})}
  const observer=new Function('captureApplicationState','assertM80BackupV2RawSchema22Delta',code+';return databaseObserver;')(async()=>after,assertM80BackupV2RawSchema22Delta)(db,baseline)
  await expect(observer.observe({stage:'migration',plan:{target:{}},intent:{}})).rejects.toThrow(kind.includes('acl')?'M80_V2_SCHEMA22_DEFAULT_ACL_CHANGED':kind.includes('removed')?'M80_V2_OLD_INTERNAL_TRIGGER_MISSING':'M80_V2_UNEXPECTED_INTERNAL_TRIGGER_ADDED')
 }
})

test('bundle composer refuses changed proof and foreign predecessor with no output-side effect',async()=>{
 const a=await artifacts('deployment'),sources=new Map<string,Uint8Array>(),encode=(v:any)=>Buffer.from(JSON.stringify(v,null,2)+'\n'),put=(x:any)=>sources.set(x.pin.path,encode(x.value))
 for(const key of ['plan','gate','intent'] as const)put({value:a[key],pin:a[(key+'Pin') as 'planPin']})
 Object.values(a.gateEvidence).forEach(put);Object.values(a.planEvidence).forEach(put)
 for(const c of [a.migration!,a.admission!]){for(const key of ['intent','gate','observation','outcome'] as const)put({value:c[key],pin:c[(key+'Pin') as 'intentPin']});Object.values(c.gateEvidence).forEach(put)}
 const reader=async(p:string)=>sources.get(p)??reviewReaders.get(a)!(p)
 const paths=(c:any)=>({intentPath:c.intentPin.path,observationPath:c.observationPin.path,outcomePath:c.outcomePin.path})
 const input={outputPath:m80StageBundlePath(a.plan as any,'deployment'),stage:'deployment' as const,planPath:a.planPin.path,gatePath:a.gatePin.path,intentPath:a.intentPin.path,executorReviewPath:a.executorReview.path,migration:paths(a.migration),admission:paths(a.admission)}
 const good=await composeM80StageBundle(input,{readBytes:reader,now:NOW});expect(good.planEvidence.normalizationProof).toEqual(a.planEvidence.normalizationProof.pin)
 await expect(composeM80StageBundle({...input,outputPath:input.outputPath+'-renamed'},{readBytes:reader,now:NOW})).rejects.toThrow('deterministic')
 await expect(composeM80StageBundle({...input,admission:{...input.admission,outcomePath:input.migration.outcomePath}},{readBytes:reader,now:NOW})).rejects.toThrow()
 for(const bytes of [Buffer.from('{}'),Buffer.from('{"profile":"a","profile":"b"}')])await expect(composeM80StageBundle(input,{now:NOW,readBytes:async p=>p===a.planEvidence.normalizationProof.pin.path?bytes:reader(p)})).rejects.toThrow()
})

test('root composer actual emitted mapping passes real preparation consumer under explicit synthetic evidence',async()=>{
 const f=JSON.parse(await readFile('evaluations/research-qa/m80-normalized-executor-independent-20260925-composer-composed-synthetic.json','utf8'))
 const plan=await buildM80HostedPreparationPlan(f.input,{now:NOW,verifyPin:async()=>{},loadJsonEvidence:async p=>f.evidence[p.path]})
 expect(plan.executionAuthorized).toBe(false);expect(plan.rehearsal.rawMetadataHashesEqual).toBe(false);expect(plan.rehearsal.sourceNormalizedMetadataSha256).toBe(plan.rehearsal.restoredNormalizedMetadataSha256)
})
