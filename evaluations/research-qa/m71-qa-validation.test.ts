import {expect,test} from 'bun:test'
import {createM71Seed,M71_ARTIFACT,m71Id} from '../../packages/neuvetra-database/src/m71-contract'
import {validateM71Snapshot,deriveM71Findings,m71CanonicalJson,parseM71Json,M71_EVIDENCE_SHA256} from '../../packages/neuvetra-database/src/m71-validation'

const ref=()=>({artifactId:M71_ARTIFACT.id,expectedSha256:M71_EVIDENCE_SHA256,locator:M71_ARTIFACT.locator,purpose:'Independent synthetic screening basis'})

test('California default preserves all group and source screens; reordered sets normalize equally',()=>{
 const seed=createM71Seed(),parsed=validateM71Snapshot(seed)
 expect(parsed.entities.every(e=>e.countryCode==='US'&&e.regionCode==='CA')).toBe(true)
 expect(parsed.coverageItems.filter(c=>c.domain.startsWith('scope3_'))).toHaveLength(15)
 const changed=structuredClone(seed);changed.entities.reverse();changed.coverageItems.reverse();changed.companyLabel=' '+seed.companyLabel+' '
 expect(m71CanonicalJson(validateM71Snapshot(changed))).toBe(m71CanonicalJson(parsed))
})

test('NA and exclusion require rationale plus pinned support at boundary and screening submission',()=>{
 for(const field of ['coverageItems','boundaryDecisions'] as const)for(const disposition of ['not_applicable','excluded'] as const)for(const omission of ['reason','evidence'] as const){
  const s=createM71Seed(),row=s[field][0]!
  row.disposition=disposition;row.reason=omission==='reason'?null:'Independent proposed screening finding';row.evidenceRefs=omission==='evidence'?[]:[ref()]
  expect(()=>validateM71Snapshot(s),`${field}/${disposition}/${omission}`).toThrow()
 }
})

test('unknown never becomes zero; explicit zero requires unit, reason and support',()=>{
 const seed=validateM71Snapshot(createM71Seed());expect(seed.coverageItems[0]!.quantity).toBeNull()
 for(const omission of ['basis','unit','evidence']){const s=createM71Seed(),r=s.coverageItems[0]!;r.quantity='0';r.unit=omission==='unit'?null:'kWh';r.activityDataState='explicit_zero';r.reason=omission==='basis'?null:'Recorded zero in synthetic exercise';r.evidenceRefs=omission==='evidence'?[]:[ref()];expect(()=>validateM71Snapshot(s)).toThrow()}
})

test('malformed or missing category and source universe is rejected',()=>{
 for(const edit of [(s:any)=>s.coverageItems.splice(s.coverageItems.findIndex((c:any)=>c.domain==='scope3_15'),1),(s:any)=>s.coverageItems.find((c:any)=>c.domain==='scope3_15').domain='scope3_16',(s:any)=>s.coverageItems.push({...s.coverageItems[0],id:m71Id(600)}),(s:any)=>s.coverageItems.splice(s.coverageItems.findIndex((c:any)=>c.sourceId!==null),1),(s:any)=>s.sources.pop()]){const s=createM71Seed();edit(s);expect(()=>validateM71Snapshot(s)).toThrow()}
})

test('unsupported discovered location remains visible and interval cycles fail',()=>{
 const s=createM71Seed();s.entities[1]!.regionCode='NV';s.facilities[1]!.regionCode='NV';const parsed=validateM71Snapshot(s)
 expect(parsed.entities[1]!.regionCode).toBe('NV');expect(deriveM71Findings(parsed).filter(f=>f.code==='unsupported_geography')).toHaveLength(2)
 const cycle=createM71Seed();cycle.relationships.push({...cycle.relationships[0]!,id:m71Id(610),parentEntityId:cycle.entities[1]!.id,childEntityId:cycle.entities[0]!.id});expect(()=>validateM71Snapshot(cycle)).toThrow()
})

test('prior registered records cannot disappear and fabricated evidence or client conclusions fail',()=>{
 const previous=createM71Seed(),next=structuredClone(previous);next.requirements=[];expect(()=>validateM71Snapshot(next,previous)).toThrow()
 for(const edit of [(s:any)=>s.coverageItems[0].evidenceRefs=[{...ref(),locator:'invented-page'}],(s:any)=>s.coverageItems[0].methodReadiness='released_for_use',(s:any)=>s.corporateCompleteness='complete',(s:any)=>s.requirements[0].applicability='applicable']){const s=createM71Seed();edit(s);expect(()=>validateM71Snapshot(s)).toThrow()}
 expect(()=>parseM71Json('{"a":1,"a":2}')).toThrow()
 expect(()=>parseM71Json('{"outer":{"x":1,"x":2}}')).toThrow()
})

test('omitted expected parent relationship is rejected or explicitly reported unknown',()=>{
 const s=createM71Seed();s.relationships=[]
 let rejected=false,findings:any[]=[]
 try{findings=deriveM71Findings(validateM71Snapshot(s))}catch{rejected=true}
 expect(rejected||findings.some(f=>/relationship|hierarchy|control/.test(f.code))).toBe(true)
})

test('location fields require scalar strings, never coercible arrays or objects',()=>{
 for(const collection of ['entities','facilities'] as const)for(const field of ['countryCode','regionCode'] as const)for(const value of [['US'],['CA'],{toString:()=>field==='countryCode'?'US':'CA'}]){
  const s=createM71Seed();(s[collection][0] as any)[field]=value
  expect(()=>validateM71Snapshot(s)).toThrow()
 }
})
