/** Independent actual-baseline facility resolver challenge. No network or database writes. */
import {m77HostedFacilities,exerciseFugitive} from '../../tools/staging/m77-hosted-plan'
import {sha,exclusiveJson} from '../../tools/staging/m77-common'
import {m77CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m77-validation'
const check=(x:unknown)=>{if(!x)throw Error('Independent actual population challenge refused.')},same=(a:unknown,b:unknown)=>canonical(a)===canonical(b)
if(import.meta.main){
 const text=await Bun.file('.superpowers/m77-hosted-journey.jsonl').text(),events=text.trimEnd().split('\n').map(line=>JSON.parse(line));check(events.length===4&&sha(text)==='396f086ee8702e7fbb48dbd0b303ab1a9a993fed62db5569ac1bf184b8fd5462');const baseline=events.find(e=>e.kind==='baseline').data,cv=baseline.corporate.versions.at(-1),proof=m77HostedFacilities(baseline);check(proof.facilities.length===3&&proof.office.id==='71000000-0000-4000-8000-000000000020'&&proof.distribution.id==='98d69117-f3c9-43a7-bee0-c9e9940ac721');
 for(const ids of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){const b=structuredClone(baseline);b.corporate.versions.at(-1).snapshot.facilities=ids.map(i=>proof.facilities[i]);const p=m77HostedFacilities(b);check(p.office.id===proof.office.id&&p.distribution.id===proof.distribution.id&&p.facilities.length===3)}
 const gas=(b:any)=>b.gas.worksheets.find((w:any)=>w.versions.at(-1).activity.binding.sourceId===baseline.gas.worksheets[0].versions.at(-1).activity.binding.sourceId).versions.at(-1);
 const mutations=[
  (b:any)=>b.equipment.versions.at(-1).activity.rosterStatement.assets.push(structuredClone(b.equipment.versions.at(-1).activity.rosterStatement.assets[0])),
  (b:any)=>b.diesel.worksheets[0].versions.at(-1).activity.binding.facilityId='71000000-0000-4000-8000-000000000021',
  (b:any)=>gas(b).activity.binding.coverageVersionSha256='a'.repeat(64),
  (b:any)=>gas(b).activity.binding.coverageVersionId=crypto.randomUUID(),
  (b:any)=>b.equipment.versions.at(-1).activity.links=[],
  (b:any)=>b.diesel.worksheets.push(structuredClone(b.diesel.worksheets[0])),
  (b:any)=>b.fleet.versions.at(-1).activity.rosterStatement.assets[0].facilityId='71000000-0000-4000-8000-000000000021',
  (b:any)=>b.corporate.versions.at(-1).snapshot.facilities.push(structuredClone(proof.distribution)),
 ];for(const mutate of mutations){const b=structuredClone(baseline);mutate(b);let refused=false;try{m77HostedFacilities(b)}catch{refused=true}check(refused)}
 let candidate:any,plan:any,posts=0;const stop=Error('intentional memory boundary');try{await exerciseFugitive({root:'/fictional',baseline,events:[],accounts:[],append:async(kind,data)=>{check(kind==='plan');plan=data},post:async(name,_route,_role,build)=>{posts++;check(name==='m77_corporate_add_sources');candidate=await build();throw stop},read:async()=>{throw Error('unexpected read')},check})}catch(e){check(e===stop)}
 check(posts===1&&same(candidate.snapshot.facilities,cv.snapshot.facilities)&&candidate.snapshot.sources.length===cv.snapshot.sources.length+5&&cv.snapshot.sources.every((s:any)=>same(s,candidate.snapshot.sources.find((x:any)=>x.id===s.id))));check(plan.devices.every((d:any)=>d.facilityId===(d.site==='office'?proof.office.id:proof.distribution.id)));check(!plan.devices.some((d:any)=>d.facilityId==='71000000-0000-4000-8000-000000000021'));
 const output='.superpowers/m77-independent-hosted-facilities-challenge-candidate1.json';await exclusiveJson(output,{status:'independent_actual_baseline_facility_challenges_passed',createdAt:new Date().toISOString(),baselinePrefixSha256:sha(text),recipeSha256:sha(await Bun.file('tools/staging/m77-hosted-plan.ts').text()),registeredFacilityIds:proof.facilities.map((f:any)=>f.id),selectedOfficeId:proof.office.id,selectedDistributionId:proof.distribution.id,orderPermutations:6,provenanceRefusals:mutations.length,corporateSuccessorPreservesEveryOldFacilityAndSource:true,memoryBuildOnly:true,networkCalls:0,databaseWrites:0,actualHostedExerciseAccepted:false});console.log(JSON.stringify({output,sha256:sha(await Bun.file(output).text())}))
}
