import {expect,test} from 'bun:test'
import {buildM75Dependencies,deriveM75Reconciliation,deriveM75RosterFindings,m75CanonicalJson,validateM75Save} from '../../packages/neuvetra-database/src/m75-validation'
import {M75_LIMITATIONS} from '../../packages/neuvetra-database/src/m75-contract'
import {classificationCases,independentGraph,qaHash,qaId,type IndependentGraph} from './m75-independent-scenarios'

const hash=(value:unknown)=>qaHash(m75CanonicalJson(value))
const coverage=(g:IndependentGraph)=>g.coverage.versions.find((v:any)=>v.id===g.coverage.headVersionId)
const currentHeads=(g:IndependentGraph)=>g.mobile.worksheets.map((w:any)=>w.versions.find((v:any)=>v.id===w.headVersionId))
function capture(g:IndependentGraph){g.version.dependencies=buildM75Dependencies(coverage(g),currentHeads(g),hash);for(const r of g.reviews)r.dependencies=structuredClone(g.version.dependencies)}
function derive(g:IndependentGraph){g.version.findings=deriveM75RosterFindings(g.version.activity,coverage(g));return deriveM75Reconciliation(g.companyId,coverage(g),currentHeads(g),g.version,g.reviews,hash)}
function unchangedFlags(r:any){expect(r.synthetic).toBe(true);expect(r.scope1Completeness).toBe('incomplete');expect(r.corporateCompleteness).toBe('incomplete');expect(r.releaseEligible).toBe(false);expect(r.assurance).toBe('none');expect(r.emissionsTotals).toBeNull();expect(r.limitations).toEqual([...M75_LIMITATIONS]);for(const forbidden of ['fleetTotal','totalEmissions','netEmissions','grossEmissions'])expect(r).not.toHaveProperty(forbidden)}

for(const c of classificationCases)test(`M75 independent ${c.id} [${c.requirement}]`,()=>{
 const g=independentGraph();capture(g);c.mutate(g);if(c.refreshDependencies)capture(g);const r=derive(g)
 expect(r.status,JSON.stringify(r.findings)).toBe(c.expectedStatus);unchangedFlags(r)
 if(c.minimumRows!==undefined)expect(r.rows.length).toBeGreaterThanOrEqual(c.minimumRows)
 if(c.row!==undefined){const row=r.rows.find(x=>x.rosterRowId===qaId(200+c.row!));expect(row).toBeDefined();expect(row!.status,JSON.stringify(row!.findings)).toBe(c.expectedRowStatus)}
 if(c.expectedStatus==='reconciled_bounded_synthetic'){expect(r.counts.blockingFindings).toBe(0);expect(r.rows.every(x=>x.status==='matched_reviewed')).toBe(true)}
 else expect(r.findings.some(x=>x.blocking)).toBe(true)
})

test('M75 independent does not erase a fourth vehicle when the M74 capacity is full',()=>{
 const g=independentGraph(),s=g.version.activity.rosterStatement
 for(let i=2;i<4;i++){const a=structuredClone(s.assets[0]);a.rowId=qaId(200+i);a.assetId=`QA-FLEET-${i}`;s.assets.push(a);g.version.activity.links.push({rowId:a.rowId,sourceId:qaId(100+i)});const source=structuredClone(coverage(g).snapshot.sources.find((x:any)=>x.domain==='mobile_combustion'));source.id=qaId(100+i);coverage(g).snapshot.sources.push(source)}
 const third=structuredClone(g.mobile.worksheets[0]);third.worksheetId=qaId(322);third.sourceId=qaId(102);third.vehicleAssetId='QA-FLEET-2';third.headVersionId=qaId(302);third.versions[0].id=qaId(302);third.versions[0].worksheetId=third.worksheetId;third.versions[0].activity.vehicle.assetId=third.vehicleAssetId;third.versions[0].activity.binding.sourceId=third.sourceId;third.versions[0].review.versionId=qaId(302);g.mobile.worksheets.push(third);capture(g)
 const r=derive(g),row=r.rows.find(x=>x.rosterRowId===qaId(203));expect(r.status).toBe('blocked');expect(r.counts.evidenceRows).toBe(4);expect(r.counts.currentWorkpaperStreams).toBe(3);expect(row?.status).toBe('capacity_blocked');unchangedFlags(r)
})

test('M75 independent known classification contradictions cannot be hidden by matching source and asset IDs',()=>{
 for(const [field,value] of Object.entries({modelYear:2019,vehicleClass:'Medium- and Heavy-Duty Vehicles',fuel:'Fossil Diesel',controlBasis:'owned_operational_control_full_year'})){
  const g=independentGraph();if(field==='modelYear')g.version.activity.rosterStatement.assets[0][field]=value;else {const v=g.mobile.worksheets[0].versions[0];v.activity.vehicle[field]=field==='vehicleClass'?'Light-Duty Trucks':field==='fuel'?'B20':'other_control_arrangement'}capture(g)
  const r=derive(g),row=r.rows.find(x=>x.rosterRowId===qaId(200));expect(r.status).toBe('blocked');expect(row?.status).not.toBe('matched_reviewed');expect(row?.findings.some(x=>x.blocking)).toBe(true)
 }
})

test('M75 independent save admission normalizes declared collisions but does not remove rows',()=>{
 const g=independentGraph();capture(g);const input={...g.version.activity,expectedDependencySha256:g.version.dependencies.dependencySha256,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:qaId(900)}
 input.rosterStatement.assets[0].assetId=' case-a ';input.rosterStatement.assets[1].assetId='CASE-A';input.rosterStatement.assets[1].aliases=[' Z-ALIAS ','a-alias']
 const normalized=validateM75Save(input);expect(normalized.rosterStatement!.assets).toHaveLength(2);expect(normalized.rosterStatement!.assets.map(x=>x.assetId)).toEqual(['CASE-A','CASE-A']);expect(normalized.rosterStatement!.assets[1]!.aliases).toEqual(['A-ALIAS','Z-ALIAS'])
 expect(deriveM75RosterFindings(normalized,coverage(g)).filter(x=>x.code==='duplicate_asset_identity')).toHaveLength(2)
})

test('M75 independent save admission rejects impossible calendar dates and numeric/coerced identifiers',()=>{
 for(const patch of [{period:{start:'2025-02-30',endExclusive:'2026-01-01'}},{period:{start:'2025-13-01',endExclusive:'2026-01-01'}},{assetId:123},{modelYear:2022.5}]){
  const g=independentGraph();capture(g);Object.assign(g.version.activity.rosterStatement.assets[0],patch);const input={...g.version.activity,expectedDependencySha256:g.version.dependencies.dependencySha256,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:qaId(900)}
  expect(()=>validateM75Save(input),JSON.stringify(patch)).toThrow()
 }
})

test('M75 independent classification rejects supplied current incomplete head (actual selection pending native review)',()=>{
 const g=independentGraph(),w=g.mobile.worksheets[0],next=structuredClone(w.versions[0]);next.id=qaId(950);next.version=2;next.versionSha256=qaHash('new-unreviewed-head');next.previousVersionId=w.headVersionId;next.review=null;next.calculation=null;next.activity.distanceMiles=null;next.activityStatus.mileage='missing';w.versions.push(next);w.headVersionId=next.id;capture(g)
 const r=derive(g),row=r.rows.find(x=>x.rosterRowId===qaId(200));expect(r.status).toBe('blocked');expect(row?.status).toBe('workpaper_incomplete');expect(r.workpaperPins.find(x=>x.worksheetId===w.worksheetId)?.version.id).toBe(next.id)
})
