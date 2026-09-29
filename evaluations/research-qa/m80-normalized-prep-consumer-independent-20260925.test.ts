import {test,expect} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {input,build,gateBundle,artifactPin,semanticEvidence,NOW,seal,record,observation,chainArgs,resignPlan} from './m80-normalized-prep-consumer-independent-20260925-fixture'
import {sealM80HostedIntent as oldSeal} from './m80-normalized-prep-consumer-independent-20260925-candidate1-once'
import {sealM80HostedIntent,m80HostedIntentPath,m80HostedOutcomePath,recordM80HostedOutcome} from '../../.superpowers/m80-foundation-hosted-once-v3'
import {m80HostedIntentPath as pathV2,m80HostedOutcomePath as outcomeV2} from '../../.superpowers/m80-foundation-hosted-once-v2'
import {m80HostedIntentPath as pathV1,m80HostedOutcomePath as outcomeV1} from '../../.superpowers/m80-foundation-hosted-once'
import {buildM80HostedPreparationPlan,validateM80HostedPreparationInput,m80ExpectedHostedEvidence,m80HostedCanonicalJson,m80HostedSha256} from '../../.superpowers/m80-foundation-hosted-prepare-v3'

test('independently reproduces C1 actual author self-review and closes it in C2',async()=>{
 const plan=await build(input()),planPin=artifactPin('.superpowers/m80-foundation-hosted-qa-plan.json',plan)
 const outcomes=[]
 for(const reviewerId of ['/root/m80_setup_ui','/root/m80_foundation_runtime','/root','/root/m80_foundation_runtime_qa']){
  const b=gateBundle(plan,planPin,'migration');(b.gateEvidence.securityReview.value as any).reviewerId=reviewerId
  b.gateEvidence.securityReview.pin=artifactPin(b.gateEvidence.securityReview.pin.path,b.gateEvidence.securityReview.value)
  b.gate.independentReviewerId=reviewerId;b.gate.securityReview=b.gateEvidence.securityReview.pin;b.gatePin=artifactPin(b.gatePin.path,b.gate)
  const args={plan,planPin,stage:'migration' as const,now:NOW,...b};let c1=false,c2=false
  try{oldSeal(args);c1=true}catch{};try{sealM80HostedIntent(args);c2=true}catch{}
  expect(c1).toBe(['/root/m80_setup_ui','/root/m80_foundation_runtime_qa'].includes(reviewerId));expect(c2).toBe(reviewerId==='/root/m80_foundation_runtime_qa')
  outcomes.push({reviewerId,candidate1Accepted:c1,candidate2Accepted:c2})
 }
 await Bun.write('evaluations/research-qa/m80-normalized-prep-consumer-independent-20260925-author-probe.json',JSON.stringify({outcomes,boundary:'Only synthetic in-memory gate/intent objects; no actual gate files issued'})+'\n')
})

test('closed normalization input rejects counts, flags, bindings, raw forgery and stale chronology',()=>{
 const mutations:Array<(v:any)=>void>=[]
 for(const field of ['sourceExternalDefaultAclRowsExcluded','sourceInternalTriggerRows','restoredInternalTriggerRows'])for(const value of [-1,0.1,'2',null,Number.MAX_SAFE_INTEGER+1])mutations.push(v=>v.rehearsal[field]=value)
 for(const field of ['scopedDefaultAclRowsExact','internalTriggerSemanticMultisetExact','allOtherInventoryMetadataExact','normalizedMetadataExact','oldContentExact','applicationMetadataEquivalent','forcedRlsVerified','runtimeSelectOnlyVerified','runtimeDirectWritesDenied','operatorAdmissionNotExecuted','allConnectionsClosed','releaseRecordsExactFourHeld'])for(const value of [false,'true',1])mutations.push(v=>v.rehearsal[field]=value)
 for(const field of ['sourceRawApplicationStateSha256','restoredRawApplicationStateSha256','sourceRawMetadataSha256','restoredRawMetadataSha256','sourceBackupReceiptSha256','sourceObservedNonReceiptTablesSha256'])mutations.push(v=>v.rehearsal[field]='f'.repeat(64))
 mutations.push(v=>v.rehearsal.restoredInternalTriggerRows++,v=>v.rehearsal.sourceObservedNonReceiptTableCount++,v=>v.rehearsal.restoredExternalDefaultAclRows=1,v=>v.rehearsal.rawMetadataHashesEqual=true,v=>v.rehearsal.expectedNewTableRowCounts.scope1_beta_release_records=3,v=>v.rehearsal.expectedNewTables.reverse(),v=>v.rehearsal.normalizationProof.path='../escaped.json',v=>v.rehearsal.oldMetadataExact=true,v=>v.profile='neuvetra.m80.foundation-hosted-preparation-input.v2',v=>v.rehearsal.completedAt='2026-09-24T22:02:59.999Z',v=>v.backup.completedAt='2026-09-24T21:59:59.999Z',v=>v.observedTarget.observedAt='2026-09-24T21:47:59.999Z')
 for(const mutate of mutations){const v=input();mutate(v);expect(()=>validateM80HostedPreparationInput(v,NOW)).toThrow()}
 expect(mutations.length).toBe(69)
})

test('actual receipt loader is called for each typed receipt and refuses changed contents independently of input',async()=>{
 const v=input(),map=semanticEvidence(v)
 const kinds=['target','publication','integration','backup','restore','normalization','preservation','rehearsal','admission'] as const
 const valid=await buildM80HostedPreparationPlan(v,{now:NOW,verifyPin:async()=>{},loadJsonEvidence:async p=>map.get(p.path)})
 expect(valid.executionAuthorized).toBe(false)
 for(const kind of kinds){const wanted=m80ExpectedHostedEvidence(v,kind);const path=[...map].find(([,x])=>m80HostedCanonicalJson(x)===m80HostedCanonicalJson(wanted))![0]
  for(const mutate of [(x:any)=>({...x,profile:'legacy-or-forged'}),(x:any)=>({...x,unexpected:true}),(x:any)=>Object.fromEntries(Object.entries(x).slice(1))]){
   await expect(buildM80HostedPreparationPlan(v,{now:NOW,verifyPin:async()=>{},loadJsonEvidence:async p=>p.path===path?mutate(map.get(path)):map.get(p.path)})).rejects.toThrow('content contradicts')
  }
 }
 let calls=0;await expect(buildM80HostedPreparationPlan(v,{now:NOW,verifyPin:async()=>{if(++calls===9)throw Error('changed proof bytes')},loadJsonEvidence:async p=>map.get(p.path)})).rejects.toThrow('changed proof bytes')
})

test('normalization proof cannot substitute raw migration success and locks agree across versions',async()=>{
 const plan=await build(input()),planPin=artifactPin('.superpowers/m80-foundation-hosted-qa-plan.json',plan),sealed=seal(plan,planPin,'migration')
 for(const stage of ['migration','admission','deployment'] as const){expect(m80HostedIntentPath(plan,stage)).toBe(pathV2(plan as any,stage));expect(m80HostedIntentPath(plan,stage)).toBe(pathV1(plan as any,stage));const i={operationScopeSha256:plan.operationScopeSha256,stage};expect(m80HostedOutcomePath(i)).toBe(outcomeV2(i));expect(m80HostedOutcomePath(i)).toBe(outcomeV1(i))}
 const obs=observation(sealed.intent) as any;delete obs.authoritativeState.oldMetadataExact;obs.authoritativeState.normalizedMetadataExact=true
 expect(()=>recordM80HostedOutcome({intent:sealed.intent,intentPin:artifactPin('.superpowers/m80-foundation-hosted-qa-intent.json',sealed.intent),observation:obs,observationPin:artifactPin('.superpowers/m80-foundation-hosted-qa-observation.json',obs),now:NOW})).toThrow()
 const changed=resignPlan({...plan,operationScopeSha256:'0'.repeat(64)})
 expect(()=>sealM80HostedIntent({plan:changed,planPin:artifactPin(planPin.path,changed),stage:'migration',now:NOW,...gateBundle(changed,artifactPin(planPin.path,changed),'migration')})).toThrow()
})

test('consumes the four actual retained synthetic rehearsal receipts without changing their bytes',async()=>{
 const v=input(),dir='.superpowers/m80-backup-v2-rehearsal-1790306499437'
 const names=['restore-receipt','normalization-proof','preservation-receipt','migration-receipt']
 const blobs=await Promise.all(names.map(n=>readFile(`${dir}/m80-backup-v2-${n}.json`)))
 const [restore,normal,preserve,migrate]=blobs.map(b=>JSON.parse(b.toString('utf8')))
 const completed=new Date(normal.completedAt),now=new Date(completed.getTime()+60_000)
 const r:any=v.rehearsal
 for(const receipt of [restore,normal,preserve,migrate])for(const [key,value] of Object.entries(receipt))if(key in r)r[key]=value
 v.observedTarget.observedAt=new Date(completed.getTime()-180_000).toISOString()
 v.backup.completedAt=new Date(completed.getTime()-120_000).toISOString()
 v.publication.headObservedAt=v.publication.checksObservedAt=v.admission.verifiedAt=now.toISOString()
 v.observedTarget.applicationStateSha256=v.backup.sourceApplicationStateSha256=normal.sourceRawApplicationStateSha256
 v.observedTarget.observedNonReceiptTables=restore.observedNonReceiptTables
 v.observedTarget.observedNonReceiptTableCount=r.sourceObservedNonReceiptTableCount=restore.observedNonReceiptTableCount
 r.sourceObservedNonReceiptTablesSha256=m80HostedSha256(m80HostedCanonicalJson(restore.observedNonReceiptTables))
 v.backup.backupReceipt.sha256=normal.sourceBackupReceiptSha256
 const fields=['restoreReceipt','normalizationProof','preservationReceipt','migrationReceipt']
 const actual=new Map<string,Buffer>()
 names.forEach((n,i)=>{const path=`${dir}/m80-backup-v2-${n}.json`;r[fields[i]!]={path,sha256:m80HostedSha256(blobs[i]!)};actual.set(path,blobs[i]!)})
 v.publication.integrationAcceptance=artifactPin(v.publication.integrationAcceptance.path,m80ExpectedHostedEvidence(v,'integration'))
 const map=semanticEvidence(v);let reopened=0
 const plan=await buildM80HostedPreparationPlan(v,{now,verifyPin:async p=>{const b=actual.get(p.path);if(b){expect(m80HostedSha256(b)).toBe(p.sha256);reopened++}},loadJsonEvidence:async p=>actual.has(p.path)?JSON.parse(actual.get(p.path)!.toString('utf8')):map.get(p.path)})
 expect(reopened).toBe(4);expect(plan.rehearsal.rawMetadataHashesEqual).toBe(true);expect(plan.executionAuthorized).toBe(false)
 await Bun.write('evaluations/research-qa/m80-normalized-prep-consumer-independent-20260925-synthetic-receipt-compatibility.json',JSON.stringify({actualSyntheticReceiptFiles:4,bytePinsVerified:true,closedTypedContentsMatch:true,unchangedReceiptBytes:true,externalAclRows:normal.sourceExternalDefaultAclRowsExcluded,rawMetadataHashesEqual:plan.rehearsal.rawMetadataHashesEqual,limits:'Only four existing synthetic rehearsal receipts are real. Provider, backup, publication, membership inputs remain declared synthetic fixture context; no actual hosted plan or gate written.'})+'\n')
})
