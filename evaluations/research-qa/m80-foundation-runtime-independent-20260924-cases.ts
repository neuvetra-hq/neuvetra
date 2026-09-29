import { createM80FixtureSetup } from '../../packages/neuvetra-database/src/m80-fixture'

export function qaNormalizedSetup(companyId:string) {
 const p=structuredClone(createM80FixtureSetup(companyId))
 p.entities.sort((a,b)=>a.entityId.localeCompare(b.entityId));p.locations.sort((a,b)=>a.locationId.localeCompare(b.locationId));p.sources.sort((a,b)=>a.sourceId.localeCompare(b.sourceId));p.evidenceRequirements.sort((a,b)=>a.requirementId.localeCompare(b.requirementId))
 for(const s of p.sources){s.evidenceRequirementIds.sort();s.processScreen?.categories.sort((a,b)=>a.category.localeCompare(b.category));s.processScreen?.gasGroups.sort((a,b)=>a.gasGroup.localeCompare(b.gasGroup))}
 return p
}

/** Mutation names describe independent attack intent, not expected implementation errors. */
export function qaInvalidSetups(companyId:string, otherCompanyId:string) {
  const cases: {name:string; input:unknown}[]=[]
  const add=(name:string, change:(p:any)=>void)=>{const p=qaNormalizedSetup(companyId);change(p);cases.push({name,input:p})}
  add('tenant swap',p=>p.companyId=otherCompanyId)
  for(const key of ['releaseEligible','factor','gwp','methodHash','eligibilityResult','documentBytes','filename','issuer','contact','invite','calculate','export']) add('root authority or free text '+key,p=>p[key]='FORBIDDEN-SYNTHETIC-CANARY')
  for(const key of ['factor','gwp','methodHash','releaseEligible','eligibilityResult']) add('nested authority '+key,p=>p.sources[0].knownFacts[key]=true)
  add('caller fixture admission',p=>p.fixtureAdmission={active:true})
  add('real classification',p=>p.dataClassification='customer_data')
  add('complete claim',p=>p.completeness='complete')
  add('wrong period',p=>p.reportingPeriod={start:'2026-01-01',endExclusive:'2027-01-01'})
  add('location entity rebound',p=>p.locations[0].entityId=otherCompanyId)
  add('source location rebound',p=>p.sources[0].locationId=p.sources[2].locationId)
  add('source identifier swap',p=>p.sources[0].sourceId=p.sources[1].sourceId)
  add('source category rebound',p=>p.sources[0].category='mobile_combustion')
  add('requirement source rebound',p=>p.evidenceRequirements[0].sourceId=p.sources[2].sourceId)
  add('requirement key corruption',p=>p.evidenceRequirements[0].fixtureReferenceKey='FORBIDDEN-SYNTHETIC-CANARY')
  add('requirement free text',p=>p.evidenceRequirements[0].description='FORBIDDEN-SYNTHETIC-CANARY')
  add('unknown source omitted',p=>p.sources.pop())
  add('process gas omitted',p=>p.sources.find((s:any)=>s.processScreen).processScreen.gasGroups.pop())
  add('process category duplicate',p=>{const s=p.sources.find((s:any)=>s.processScreen);s.processScreen.categories[1]=structuredClone(s.processScreen.categories[0])})
  for(const key of ['dataClassification','consolidationApproach','completeness'])add('null root enum '+key,p=>p[key]=null)
  add('null boundary enum',p=>p.boundaryProposal.jointVentureState=null)
  add('null entity enum',p=>p.entities[0].controlState=null)
  add('null location enum',p=>p.locations[0].regionCode=null)
  add('null source fact',p=>p.sources[0].knownFacts.fuelOrGas=null)
  add('null evidence state',p=>p.evidenceRequirements[0].state=null)
  add('null process state',p=>p.sources.find((s:any)=>s.processScreen).processScreen.categories[0].state=null)
  add('null gas state',p=>p.sources.find((s:any)=>s.processScreen).processScreen.gasGroups[0].state=null)
  add('duplicate location replaces retained location',p=>p.locations[1]=structuredClone(p.locations[0]))
  add('duplicate evidence reference hides exact required ID',p=>p.sources[0].evidenceRequirementIds[1]=p.sources[0].evidenceRequirementIds[0])
  add('prototype pollution key',p=>Object.defineProperty(p,'__proto__',{value:{releaseEligible:true},enumerable:true}))
  return cases
}

export function qaSuccessorSetups(companyId:string) {
  const cases:{name:string;input:ReturnType<typeof createM80FixtureSetup>}[]=[]
  const add=(name:string,change:(p:any)=>void)=>{const p=structuredClone(createM80FixtureSetup(companyId));change(p);cases.push({name,input:p})}
  add('joint venture fact becomes unknown',p=>p.boundaryProposal.jointVentureState='unknown')
  add('ownership fact becomes unknown',p=>p.entities[0].ownershipState='unknown')
  add('location outside California retained',p=>p.locations[0].regionCode='other_us')
  add('source fact becomes unknown',p=>p.sources[0].knownFacts.fuelOrGas='unknown')
  add('process category indication retained',p=>p.sources.find((s:any)=>s.processScreen).processScreen.categories[0].state='indicated')
  add('gas group indication retained',p=>p.sources.find((s:any)=>s.processScreen).processScreen.gasGroups[0].state='indicated')
  add('evidence status becomes missing',p=>p.evidenceRequirements[0].state='missing')
  return cases
}
