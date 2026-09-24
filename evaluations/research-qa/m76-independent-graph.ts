/** Structural classifier fixtures; deliberately not persisted integrity evidence. */
import {createM71Seed,M71_ARTIFACT,M71_LIMITATIONS} from '../../packages/neuvetra-database/src/m71-contract'
import {M71_EVIDENCE_SHA256} from '../../packages/neuvetra-database/src/m71-validation'
import {M73_METHOD,M73_LIMITATIONS,M73_PROFILE} from '../../packages/neuvetra-database/src/m73-contract'
import {M76_PROFILE,M76_PERIOD,M76_LIMITATIONS} from '../../packages/neuvetra-database/src/m76-contract'
import {M76_DIESEL_METHOD,M76_DIESEL_LIMITATIONS} from '../../packages/neuvetra-database/src/m76-diesel-contract'
import {independentGeneratorInput} from './m76-independent-generator-fixture'

export const qid=(n:number)=>`76000000-0000-4000-8000-${String(n).padStart(12,'0')}`
export const qhash=(v:unknown):string=>new Bun.CryptoHasher('sha256').update(JSON.stringify(v)).digest('hex')
export const qtime='2026-09-16T12:00:00.000Z'
export interface M76Graph {companyId:string;coverage:any;gas:any[];diesel:any[];version:any;reviews:any[]}

export function independentStationaryGraph():M76Graph{
 const companyId=qid(1),author=qid(2),reviewer=qid(3),snapshot=createM71Seed()
 const evidence={artifactId:M71_ARTIFACT.id,expectedSha256:M71_EVIDENCE_SHA256,locator:M71_ARTIFACT.locator,purpose:'Independent fictional full-year control evidence'}
 for(const d of snapshot.boundaryDecisions){d.disposition='included_activity';d.reason='Fictional full-year operational control';d.evidenceRefs=[evidence]}
 for(const r of snapshot.relationships){r.controlFacts='Fictional full-year operational control';r.evidenceRefs=[evidence]}
 snapshot.companyLabel='Independent stationary test company'
 const generator=independentGeneratorInput()
 const assets=[0,1,2].map(i=>{
  const facility=snapshot.facilities[i===0?0:1]!
  snapshot.sources.push({id:qid(100+i),entityId:facility.entityId,facilityId:facility.id,name:['Independent office boiler','Independent distribution heater','Independent generator'][i]!,domain:'stationary_combustion',...M76_PERIOD,evidenceRefs:[]})
  snapshot.coverageItems.push({id:qid(120+i),entityId:facility.entityId,sourceId:qid(100+i),domain:'stationary_combustion',...M76_PERIOD,disposition:'included_activity',activityDataState:'missing',evidenceState:'missing',methodReadiness:'candidate',reason:'Separate exact consumed-fuel workpaper supplies activity.',evidenceRefs:[],estimateBasis:null,quantity:null,unit:null})
  return {rowId:qid(200+i),equipmentId:i===2?generator.equipment.assetId:`QA-GAS-${i}`,aliases:[],identifierBasis:i===2?generator.equipment.identifierBasis:'Fictional gas-device identification plate',entityId:facility.entityId,facilityId:facility.id,period:{...M76_PERIOD},equipmentType:['boiler','space_heater','stationary_emergency_generator'][i],fuel:i===2?generator.equipment.fuel:'Natural Gas',controlBasis:'owned_operational_control_full_year',classificationBasis:'Fictional separate equipment classification record',controlExplanation:i===2?generator.equipment.controlExplanation:'Fictional full-year operational control',meterRelationship:{issuer:i===2?generator.statement!.issuer:'Fictional independent gas-meter custodian',meterLabel:i===2?generator.statement!.meterLabel:`QA-GAS-METER-${i}`,measurementBasis:'dedicated_single_device_consumption',dedicatedToSingleDevice:true,explanation:'One meter reports consumed fuel for this single device.'}}
 })
 const coverage:any={id:qid(20),companyId,inventoryId:qid(21),version:1,previousVersionId:null,previousVersionSha256:null,createdBy:author,createdAt:qtime,contributorIds:[author],correctionReason:null,snapshot,contentSha256:qhash('coverage content'),versionSha256:qhash('coverage version'),findings:[],synthetic:true,corporateCompleteness:'incomplete',releaseEligible:false,assurance:'none',emissionsTotals:null,review:null}
 const review=(v:any,n:number,limitations:readonly string[])=>({id:qid(n),versionId:v.id,versionSha256:v.versionSha256,decision:'accepted_bounded_internal',note:'Separate fictional review',acknowledgedLimitations:[...limitations],reviewerId:reviewer,reviewedAt:qtime,decisionSha256:qhash('review'+n)})
 coverage.review=review(coverage,22,M71_LIMITATIONS)
 const works=assets.map((asset,i)=>{
  const binding={coverageVersionId:coverage.id,coverageVersionSha256:coverage.versionSha256,entityId:asset.entityId,facilityId:asset.facilityId,sourceId:qid(100+i),boundaryDecisionId:snapshot.boundaryDecisions.find(x=>x.entityId===asset.entityId)!.id}
  const statement=i===2?generator.statement:{issuer:asset.meterRelationship.issuer,reference:`QA-GAS-REF-${i}`,meterLabel:asset.meterRelationship.meterLabel,statedQuantityMmbtu:'1.000',description:'Fictional annual consumed natural gas from dedicated device meter',consumptionBasis:'dedicated_meter_consumed_no_adjustments'}
  const activity:any=i===2?{...generator,binding}:{profile:M73_PROFILE,binding,period:{...M76_PERIOD},fuel:'Natural Gas',heatBasis:'HHV',unit:'MMBtu',quantityMmbtu:'1.000',statement,manualConfirmation:true,discrepancyReason:null,zeroReason:null}
  for(const key of ['expectedVersionId','expectedVersionSha256','correctionReason','idempotencyKey'])delete activity[key]
  const v:any={id:qid(300+i),companyId,worksheetId:qid(320+i),version:1,previousVersionId:null,previousVersionSha256:null,createdBy:author,createdAt:qtime,contributorIds:[author],correctionReason:null,activity,activityStatus:'entered',coverageVersion:coverage,statement:{id:qid(340+i),input:statement,profile:i===2?'m76-synthetic-generator-statement-v1':'m73-synthetic-gas-statement-v1',text:'structural fixture',locator:`qa-statement-${i}`,sha256:qhash(`statement-${i}`),byteLength:18},calculation:{method:i===2?M76_DIESEL_METHOD:M73_METHOD,total:{unrounded:i===2?'3248.331208266':'53.1145',display:i===2?'3248.3312':'53.1145',unit:'kg CO2e',rounding:'half_even_4dp'}},findings:[{code:'scope1_incomplete',message:'Incomplete'},{code:'method_not_released',message:'Unreleased'}],inputSha256:qhash('input'+i),contentSha256:qhash('content'+i),versionSha256:qhash('version'+i),synthetic:true,scope1Completeness:'incomplete',corporateCompleteness:'incomplete',releaseEligible:false,assurance:'none',review:null}
  v.review=review(v,360+i,i===2?M76_DIESEL_LIMITATIONS:M73_LIMITATIONS);return v
 })
 const rosterStatement={issuer:'Independent fictional facilities custodian',reference:'QA-STATIONARY-2025',description:'Separate complete two-site equipment declaration.',discoveryBasis:'Fictional two-site walk-through plus equipment and utility schedules, before workpaper selection.',coveredEntityIds:snapshot.entities.map(x=>x.id).sort(),coveredFacilityIds:snapshot.facilities.map(x=>x.id).sort(),completeness:'declared_complete',allControlledLocationsIncluded:true,assets}
 const activity:any={profile:M76_PROFILE,coverageVersionId:coverage.id,coverageVersionSha256:coverage.versionSha256,period:{...M76_PERIOD},rosterStatement,manualConfirmation:true,links:assets.map((a,i)=>({rowId:a.rowId,sourceId:qid(100+i)}))}
 const version:any={id:qid(400),companyId,rosterId:qid(401),version:1,previousVersionId:null,previousVersionSha256:null,createdBy:author,createdAt:qtime,contributorIds:[author],correctionReason:null,activity,dependencies:null,statement:{id:qid(402),profile:'m76-synthetic-equipment-statement-v1',input:rosterStatement,text:'structural fixture',locator:'qa-roster',sha256:qhash('roster'),byteLength:18},findings:[],inputSha256:qhash('roster-input'),contentSha256:qhash('roster-content'),versionSha256:qhash('roster-version'),synthetic:true,scope1Completeness:'incomplete',corporateCompleteness:'incomplete',releaseEligible:false,assurance:'none',emissionsTotals:null}
 const reviews:any[]=[{id:qid(403),versionId:version.id,versionSha256:version.versionSha256,dependencies:null,decision:'accepted_bounded_reconciliation',note:'Independent fictional declaration reviewer',acknowledgedLimitations:[...M76_LIMITATIONS],reviewerId:reviewer,reviewedAt:qtime,decisionSha256:qhash('roster-review')}]
 return {companyId,coverage,gas:works.slice(0,2),diesel:works.slice(2),version,reviews}
}
