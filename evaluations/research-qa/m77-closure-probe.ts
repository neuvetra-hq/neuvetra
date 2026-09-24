/** Independent retained contributor/dependency and permanent-event probes. */
import {createM77AuthorDatabase,serveM77Fixture} from '../../tools/staging/m77-backend-fixture'
import {decodeFugitiveRegister,decodeFugitiveVersion} from '../../apps/site-web/src/lib/m77-api'
import {m77Hash,m77ContentPayload,m77VersionHashPayload,deriveM77Reconciliation,M77_LIMITATIONS,type M77Register,type M77SourceVersion,type M77PopulationVersion} from '../../packages/neuvetra-database/src/index'
const check=(v:unknown,label:string)=>{if(!v)throw Error(label)}
export async function closureProbe(){
 const name='m77_author_qa_closure_'+Date.now(),f=await createM77AuthorDatabase(name),s=await serveM77Fixture(f,0),company=f.companyId,observations:Record<string,unknown>={}
 const req=(route:string,body?:unknown,actor='owner')=>s.server.fetch(new Request(`http://127.0.0.1:${s.server.port}/workspace/${company}/${route}`,{method:body?'POST':'GET',headers:{origin:'http://localhost:4186',authorization:'Bearer synthetic-m77-'+actor,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}))
 const read=async()=>{const r=await req('fugitive-sources');check(r.status===200,'register');return decodeFugitiveRegister(await r.json(),company)}
 const accepted=async(r:Response)=>{check(r.status===201,'successor');return decodeFugitiveVersion(await r.json(),company)}
 try{
  let r=await read(),v=r.worksheets.find(w=>w.assetId==='DISTRIBUTION-HVAC-A')!.versions.at(-1)!
  const event=v.activity.calculatorInput!.refills[0]
  v=await accepted(await req(`fugitive-sources/${v.streamId}/versions`,{...v.activity,label:'Different manager contributes retained correction',expectedVersionId:v.id,expectedVersionSha256:v.versionSha256,correctionReason:'Retain an independently prepared equipment label correction.',idempotencyKey:crypto.randomUUID()},'coverageReviewer')) as M77SourceVersion
  check(v.contributorIds.includes(f.users.coverageReviewer),'source contributor retained')
  const review={versionId:v.id,expectedVersionSha256:v.versionSha256,expectedDependencySha256:null,decision:'accepted_bounded_internal',note:'Separate source reviewer accepts exact corrected source.',acknowledgedLimitations:[...M77_LIMITATIONS],idempotencyKey:crypto.randomUUID()}
  observations.sourceContributorReviewStatus=(await req(`fugitive-sources/${v.streamId}/reviews`,review,'coverageReviewer')).status
  check(observations.sourceContributorReviewStatus===403,'source contributor refused')
  check((await req(`fugitive-sources/${v.streamId}/reviews`,{...review,idempotencyKey:crypto.randomUUID()},'sourceReviewer')).status===201,'separate review')
  r=await read();let pop=r.population.versions.at(-1)!
  pop=await accepted(await req(`fugitive-population/${pop.streamId}/versions`,{...pop.activity,expectedVersionId:pop.id,expectedVersionSha256:pop.versionSha256,expectedDependencySha256:r.reconciliation.dependencySha256,correctionReason:'Bind the complete discovery to the distinct source preparer and review.',idempotencyKey:crypto.randomUUID()})) as M77PopulationVersion
  check(pop.contributorIds.includes(f.users.coverageReviewer),'population closure contributor')
  const popReview={versionId:pop.id,expectedVersionSha256:pop.versionSha256,expectedDependencySha256:pop.dependencies!.dependencySha256,decision:'accepted_bounded_reconciliation',note:'Attempt population review by a captured source preparer.',acknowledgedLimitations:[...M77_LIMITATIONS],idempotencyKey:crypto.randomUUID()}
  observations.populationSourceContributorReviewStatus=(await req(`fugitive-population/${pop.streamId}/reviews`,popReview,'coverageReviewer')).status
  check(observations.populationSourceContributorReviewStatus===403,'population captured contributor refused')
  // Mutate only client objects; native records remain authoritative and unchanged.
  r=await read();const forged=structuredClone(r),fp=forged.population.versions.at(-1)!
  fp.contributorIds=fp.contributorIds.filter(id=>id!==f.users.coverageReviewer);fp.versionSha256=m77Hash(m77VersionHashPayload(fp))
  forged.reconciliation=deriveM77Reconciliation(company,forged.coverageVersion,forged.worksheets.map(w=>w.versions.at(-1)!),fp,[],m77Hash)
  let omissionAccepted=false;try{await decodeFugitiveRegister(forged,company);omissionAccepted=true}catch{}
  observations.clientCapturedContributorOmissionAccepted=omissionAccepted
  const forgedDeps=structuredClone(r),fd=forgedDeps.population.versions.at(-1)!,first=r.population.versions[0]
  fd.dependencies=structuredClone(first.dependencies);fd.contentSha256=m77Hash(m77ContentPayload(fd));fd.versionSha256=m77Hash(m77VersionHashPayload(fd));forgedDeps.reconciliation=deriveM77Reconciliation(company,forgedDeps.coverageVersion,forgedDeps.worksheets.map(w=>w.versions.at(-1)!),fd,[],m77Hash)
  let historicalDepsAccepted=false;try{await decodeFugitiveRegister(forgedDeps,company);historicalDepsAccepted=true}catch{}
  observations.clientCapturedDependencySwapAccepted=historicalDepsAccepted
  // An event removed from the effective source still belongs permanently to that device.
  v=(await read()).worksheets.find(w=>w.worksheetId===v.streamId)!.versions.at(-1)!
  const zeroRef='QA-COMPLETE-ZERO-RECORD'
  v=await accepted(await req(`fugitive-sources/${v.streamId}/versions`,{...v.activity,calculatorInput:{...v.activity.calculatorInput!,refills:[],zero_activity_evidence:zeroRef},evidenceStatements:[...v.activity.evidenceStatements,{reference:zeroRef,issuer:'SYNTHETIC-CONTRACTOR',description:'Independent fictional complete all-provider annual record establishes no servicing or known releases.'}],expectedVersionId:v.id,expectedVersionSha256:v.versionSha256,correctionReason:'Correct to independently evidenced zero without releasing historic event ownership.',idempotencyKey:crypto.randomUUID()})) as M77SourceVersion
  const other=(await read()).worksheets.find(w=>w.assetId==='OFFICE-HVAC-A')!.versions.at(-1)!
  const base={...other.activity,calculatorInput:{...other.activity.calculatorInput!,refills:[event]},evidenceStatements:[...other.activity.evidenceStatements,{reference:event.reference,issuer:event.contractor,description:'Attempt to reuse a superseded servicing identity on a different physical device.'}],expectedVersionId:other.id,expectedVersionSha256:other.versionSha256,correctionReason:'Attempt permanent reservation reuse after the former effective event is absent.',idempotencyKey:crypto.randomUUID()}
  observations.supersededEventReuseStatus=(await req(`fugitive-sources/${other.streamId}/versions`,base)).status
  check(observations.supersededEventReuseStatus===409,'permanent event refusal')
  observations.supersededContractorReferenceReuseStatus=(await req(`fugitive-sources/${other.streamId}/versions`,{...base,calculatorInput:{...base.calculatorInput,refills:[{...event,id:'QA-NEW-EVENT-SAME-RECEIPT'}]},idempotencyKey:crypto.randomUUID()})).status
  check(observations.supersededContractorReferenceReuseStatus===409,'permanent receipt refusal')
  const result={task:'M77-INDEPENDENT-QA',database:name,createdAt:new Date().toISOString(),observations,hostedEvidence:false,status:omissionAccepted||historicalDepsAccepted?'client_closure_finding_reproduced':'probes_refused_or_native_invariants_passed'}
  await Bun.write('evaluations/research-qa/m77-closure-probe-result.json',JSON.stringify(result,null,2)+'\n');return result
 }finally{await s.close()}
}
if(import.meta.main){try{console.log(JSON.stringify(await closureProbe()))}catch(e){console.error((e as Error).message);process.exitCode=1}}
