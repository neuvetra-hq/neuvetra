import {expect,test} from 'bun:test'
import {buildM76Dependencies,deriveM76RosterFindings,deriveM76Reconciliation,deriveM76ReconciliationFromProof,m76ValidateCorrection,validateM76Save} from '../../packages/neuvetra-database/src/m76-validation'
import {independentStationaryGraph,qid,qhash,type M76Graph} from './m76-independent-graph'

type Scenario={id:string;mutate:(g:M76Graph)=>void;status?:'reconciled_bounded_synthetic'|'blocked';minimumRows?:number;findings?:string[];refreshDependencies?:boolean}
const row=(g:M76Graph,i=0)=>g.version.activity.rosterStatement.assets[i]
const scenarios:Scenario[]=[
 {id:'positive_two_facility_three_device',mutate:()=>{},status:'reconciled_bounded_synthetic',minimumRows:3},
 ...['equipmentId','identifierBasis','entityId','facilityId','period','fuel','classificationBasis','controlExplanation','meterRelationship'].map(field=>({id:'unknown_'+field,mutate:(g:M76Graph)=>{row(g)[field]=null}})),
 ...Object.entries({equipmentType:'unknown',controlBasis:'unknown'}).map(([field,value])=>({id:'unknown_'+field,mutate:(g:M76Graph)=>{row(g)[field]=value}})),
 ...Object.entries({equipmentType:'other',controlBasis:'other_control_arrangement',fuel:'Biomethane',period:{start:'2025-06-01',endExclusive:'2026-01-01'}}).map(([field,value])=>({id:'unsupported_'+field,mutate:(g:M76Graph)=>{row(g)[field]=value},findings:['equipment_profile_unsupported']})),
 ...['shared_meter','shared_tank_allocation','stock_derived','other'].map(measurementBasis=>({id:'unsupported_'+measurementBasis,mutate:(g:M76Graph)=>{row(g).meterRelationship.measurementBasis=measurementBasis},findings:['meter_relationship_unsupported']})),
 {id:'missing_generator',mutate:g=>{g.diesel=[]},minimumRows:3,findings:['workpaper_missing'],refreshDependencies:true},
 {id:'missing_distribution_gas',mutate:g=>{g.gas.pop()},minimumRows:3,findings:['workpaper_missing'],refreshDependencies:true},
 {id:'hidden_generator_declaration',mutate:g=>{g.version.activity.rosterStatement.assets.pop();g.version.activity.links.pop()},minimumRows:3,findings:['orphan_source']},
 {id:'orphan_stationary_source',mutate:g=>{g.coverage.snapshot.sources.push({...g.coverage.snapshot.sources.find((s:any)=>s.domain==='stationary_combustion'),id:qid(999),name:'Unrostered boiler'})},minimumRows:4,findings:['orphan_source']},
 {id:'orphan_workpaper_with_absent_source',mutate:g=>{g.gas[0].activity.binding.sourceId=qid(999)},minimumRows:4,findings:['orphan_workpaper'],refreshDependencies:true},
 {id:'duplicate_asset',mutate:g=>{row(g,1).equipmentId=row(g).equipmentId},findings:['duplicate_equipment_identity']},
 {id:'alias_primary_collision',mutate:g=>{row(g,1).aliases=[row(g).equipmentId]},findings:['duplicate_equipment_identity']},
 {id:'alias_alias_collision',mutate:g=>{row(g).aliases=['QA-SHARED'];row(g,1).aliases=['QA-SHARED']},findings:['duplicate_equipment_identity']},
 {id:'duplicate_mapped_source',mutate:g=>{g.version.activity.links[1].sourceId=g.version.activity.links[0].sourceId},findings:['duplicate_source_mapping']},
 {id:'duplicate_meter_even_different_site',mutate:g=>{row(g,1).meterRelationship={...row(g).meterRelationship};g.gas[1].activity.statement.issuer=g.gas[0].activity.statement.issuer;g.gas[1].activity.statement.meterLabel=g.gas[0].activity.statement.meterLabel},findings:['duplicate_meter_relationship']},
 {id:'meter_issuer_disagrees',mutate:g=>{row(g).meterRelationship.issuer='Different supplier'},findings:['workpaper_meter_conflict']},
 {id:'meter_identity_disagrees',mutate:g=>{row(g).meterRelationship.meterLabel='Different meter'},findings:['workpaper_meter_conflict']},
 {id:'gas_disguised_as_generator',mutate:g=>{row(g).equipmentType='stationary_emergency_generator';row(g).fuel=row(g,2).fuel},findings:['workpaper_family_conflict']},
 {id:'generator_disguised_as_gas',mutate:g=>{row(g,2).equipmentType='boiler';row(g,2).fuel='Natural Gas'},findings:['workpaper_family_conflict']},
 {id:'same_source_cross_families',mutate:g=>{g.diesel[0].activity.binding.sourceId=g.gas[0].activity.binding.sourceId},findings:['duplicate_workpaper'],refreshDependencies:true},
 {id:'generator_asset_disagrees',mutate:g=>{row(g,2).equipmentId='ANOTHER-GEN'},findings:['workpaper_equipment_conflict']},
 {id:'generator_identifier_basis_disagrees',mutate:g=>{row(g,2).identifierBasis='Different source plate'},findings:['workpaper_equipment_conflict']},
 {id:'omitted_distribution_facility',mutate:g=>{g.version.activity.rosterStatement.coveredFacilityIds.pop()},findings:['facility_population_incomplete']},
 {id:'omitted_distribution_entity',mutate:g=>{g.version.activity.rosterStatement.coveredEntityIds.pop()},findings:['entity_population_incomplete']},
 {id:'all_locations_assertion_false',mutate:g=>{g.version.activity.rosterStatement.allControlledLocationsIncluded=false},findings:['controlled_locations_incomplete']},
 {id:'all_locations_assertion_cannot_replace_facility_evidence',mutate:g=>{g.version.activity.rosterStatement.coveredFacilityIds=[];g.version.activity.rosterStatement.allControlledLocationsIncluded=true},findings:['facility_population_incomplete']},
 {id:'no_equipment_evidence',mutate:g=>{g.version.activity.rosterStatement=null;g.version.activity.links=[];g.version.statement=null},minimumRows:3,findings:['roster_statement_missing']},
 {id:'empty_equipment_evidence',mutate:g=>{g.version.activity.rosterStatement.assets=[];g.version.activity.links=[]},minimumRows:3,findings:['roster_empty']},
 {id:'partial_equipment_evidence',mutate:g=>{g.version.activity.rosterStatement.completeness='partial'},findings:['roster_not_declared_complete']},
 {id:'unconfirmed_equipment',mutate:g=>{g.version.activity.manualConfirmation=false},findings:['roster_unconfirmed']},
 {id:'unreviewed_current_generator',mutate:g=>{g.diesel[0].review=null},findings:['workpaper_review_required'],refreshDependencies:true},
 {id:'changes_requested_current_gas',mutate:g=>{g.gas[0].review.decision='changes_requested'},findings:['workpaper_review_required'],refreshDependencies:true},
 {id:'missing_generator_quantity',mutate:g=>{g.diesel[0].activity.quantityGallons=null;g.diesel[0].calculation=null;g.diesel[0].findings.push({code:'activity_missing',message:'Missing'})},findings:['workpaper_incomplete']},
 {id:'accepted_positive_discrepancy',mutate:g=>{g.diesel[0].activity.quantityGallons='317.220';g.diesel[0].activity.discrepancyReason='Difference remains';g.diesel[0].findings.push({code:'activity_statement_discrepancy',message:'Difference remains'})},findings:['workpaper_incomplete']},
 {id:'stale_gas_coverage_id',mutate:g=>{g.gas[0].activity.binding.coverageVersionId=qid(888)},findings:['workpaper_stale']},
 {id:'stale_gas_coverage_sha',mutate:g=>{g.gas[0].activity.binding.coverageVersionSha256=qhash('old')},findings:['workpaper_stale']},
 {id:'changed_generator_review_after_capture',mutate:g=>{g.diesel[0].review.id=qid(889);g.diesel[0].review.decisionSha256=qhash('new review')},findings:['dependency_stale']},
 {id:'unreviewed_boundary',mutate:g=>{g.coverage.review=null},findings:['coverage_review_required'],refreshDependencies:true},
 {id:'unreviewed_roster',mutate:g=>{g.reviews=[]},findings:['roster_review_required']},
 ...['missing','unassessed','included_estimate','excluded','not_applicable'].map(disposition=>({id:'stationary_screening_'+disposition,mutate:(g:M76Graph)=>{g.coverage.snapshot.coverageItems.find((c:any)=>c.sourceId===qid(100)).disposition=disposition},findings:['source_screening_unresolved']})),
 {id:'same_labels_distinct_devices',mutate:g=>{for(const s of g.coverage.snapshot.sources)s.name='Same visible name'},status:'reconciled_bounded_synthetic'},
]

export function prepareGraph(){const g=independentStationaryGraph();refresh(g);return g}
function refresh(g:M76Graph){g.version.findings=deriveM76RosterFindings(g.version.activity,g.coverage);g.version.dependencies=buildM76Dependencies(g.coverage,g.gas,g.diesel,qhash);for(const r of g.reviews)r.dependencies=structuredClone(g.version.dependencies)}
for(const s of scenarios)test('M76 independent reconciliation: '+s.id,()=>{
 const g=prepareGraph();s.mutate(g);g.version.findings=deriveM76RosterFindings(g.version.activity,g.coverage)
 if(s.refreshDependencies){g.version.dependencies=buildM76Dependencies(g.coverage,g.gas,g.diesel,qhash);for(const r of g.reviews)r.dependencies=structuredClone(g.version.dependencies)}
 const result=deriveM76Reconciliation(g.companyId,g.coverage,g.gas,g.diesel,g.version,g.reviews,qhash)
 expect(result.status).toBe(s.status??'blocked')
 expect(result.rows.length).toBeGreaterThanOrEqual(s.minimumRows??3)
 for(const code of s.findings??[])expect(result.findings.some(f=>f.code===code)).toBe(true)
 expect(result.synthetic).toBe(true);expect(result.scope1Completeness).toBe('incomplete');expect(result.corporateCompleteness).toBe('incomplete');expect(result.releaseEligible).toBe(false);expect(result.assurance).toBe('none');expect(result.emissionsTotals).toBeNull()
})

test('M76 declaration corrections preserve prior rows, identity and mapping',()=>{
 for(const mutate of [(g:M76Graph)=>{g.version.activity.rosterStatement=null;g.version.activity.links=[]},(g:M76Graph)=>{g.version.activity.rosterStatement.assets.pop();g.version.activity.links.pop()},(g:M76Graph)=>{row(g).equipmentId=null},(g:M76Graph)=>{g.version.activity.links[0].sourceId=null}]){
  const prior=prepareGraph().version,next=prepareGraph();mutate(next)
  expect(()=>m76ValidateCorrection(prior,next.version.activity)).toThrow()
 }
})

test('M76 roster input refuses invalid calendar dates and structural row overflow',()=>{
 const g=prepareGraph(),input={...g.version.activity,expectedDependencySha256:g.version.dependencies.dependencySha256,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:qid(997)}
 expect(validateM76Save(input)).toEqual(input)
 for(const date of ['2025-02-30','2025-13-01','2025-00-01']){
  const v=structuredClone(input);v.rosterStatement.assets[0].period.start=date;expect(()=>validateM76Save(v)).toThrow()
 }
 const overflow=structuredClone(input);overflow.rosterStatement.assets=Array.from({length:26},(_,i)=>({...overflow.rosterStatement.assets[0],rowId:qid(800+i),equipmentId:'QA-'+i}));overflow.links=overflow.rosterStatement.assets.map((a:any)=>({rowId:a.rowId,sourceId:null}));expect(()=>validateM76Save(overflow)).toThrow()
})

test('M76 proof reconstruction cannot erase unsupported facts by deleting cached findings',()=>{
 const g=prepareGraph();row(g).fuel='Biomethane';g.version.findings=deriveM76RosterFindings(g.version.activity,g.coverage)
 const proof={coverageVersion:g.coverage,boundCoverageVersion:g.coverage,gasWorkpaperVersions:g.gas,dieselWorkpaperVersions:g.diesel}
 const original=deriveM76ReconciliationFromProof(g.companyId,proof,g.version,g.reviews,qhash)
 expect(original.findings.some(f=>f.code==='equipment_profile_unsupported')).toBe(true)
 const forged=structuredClone(g.version);forged.findings=[]
 let refused=false
 try{const challenged=deriveM76ReconciliationFromProof(g.companyId,proof,forged,g.reviews,qhash);refused=challenged.findings.some(f=>f.code==='equipment_profile_unsupported')}catch{refused=true}
 expect(refused).toBe(true)
})

test('M76 historical proof requires the exact bound coverage even after current coverage changes',()=>{
 const g=prepareGraph(),bound=structuredClone(g.coverage);row(g).fuel='Biomethane';g.version.findings=deriveM76RosterFindings(g.version.activity,bound)
 const current=structuredClone(g.coverage);current.id=qid(919);current.versionSha256=qhash('later coverage');current.review=null
 const proof={coverageVersion:current,boundCoverageVersion:bound,gasWorkpaperVersions:g.gas,dieselWorkpaperVersions:g.diesel}
 const original=deriveM76ReconciliationFromProof(g.companyId,proof,g.version,g.reviews,qhash)
 expect(original.status).toBe('blocked');expect(original.findings.some(f=>f.code==='equipment_profile_unsupported')).toBe(true)
 for(const supplied of [null,current,{...bound,versionSha256:qhash('wrong bound bytes')}])expect(()=>deriveM76ReconciliationFromProof(g.companyId,{...proof,boundCoverageVersion:supplied},g.version,g.reviews,qhash)).toThrow()
 const forged=structuredClone(g.version);forged.findings=[]
 expect(()=>deriveM76ReconciliationFromProof(g.companyId,proof,forged,g.reviews,qhash)).toThrow()
})
