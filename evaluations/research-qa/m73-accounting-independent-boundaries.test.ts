/** Independent, read-only challenges against original native candidate output. */
import {test, expect} from 'bun:test'
import {pathToFileURL} from 'node:url'
const root=process.env.M73_ACCOUNTING_CANDIDATE ?? 'C:/Users/nimab/.codex/worktrees/4441/Neuvetra'
const moduleAt=(p:string)=>import(pathToFileURL(root+'/'+p).href)
const {validateM73Save,m73SourceChoices,m73ResolveBinding,deriveM73Findings,m73CanonicalJson}=await moduleAt('packages/neuvetra-database/src/m73-validation.ts')
const {decodeGasRegister,decodeGasVersion,decodeGasReport}=await moduleAt('apps/site-web/src/lib/m73-api.ts')
const {m73RenderReport,m73ReportSnapshot}=await moduleAt('packages/neuvetra-database/src/m73-report.ts')
const fixture=await Bun.file(process.env.M73_ACCOUNTING_FIXTURE ?? root+'/.tmp/m73-native-fixture.json').json()
const versions=fixture.register.worksheets.flatMap((w:any)=>w.versions)
const first=versions.find((v:any)=>v.activity.quantityMmbtu==='1250.125')
const request=()=>({...structuredClone(first.activity),expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:crypto.randomUUID()})

test('independent native saved register and report pass actual frontend decoders',async()=>{
 await decodeGasRegister(fixture.register,fixture.companyId)
 await decodeGasReport(fixture.originalReport,fixture.companyId,first)
 expect(m73RenderReport(m73ReportSnapshot(first,null))).toBe(fixture.originalReport.html)
})

test('independent invalid quantity/unit/fuel/heat/period and evidence challenges',()=>{
 const cases=[{unit:'therm'},{unit:'scf'},{unit:'kg'},{heatBasis:'LHV'},{fuel:'Renewable Natural Gas'},
 {period:{start:'2025-02-01',endExclusive:'2026-01-01'}},{period:{start:'2026-01-01',endExclusive:'2027-01-01'}},
 {quantityMmbtu:-1},{quantityMmbtu:'-1'},{quantityMmbtu:'1e3'},{quantityMmbtu:'NaN'},
 {quantityMmbtu:'0.0001'},{quantityMmbtu:'1000000000000.000'},{statement:null},{manualConfirmation:false},
 {statement:{...first.activity.statement,consumptionBasis:'purchased'}},
 {statement:{...first.activity.statement,consumptionBasis:'shared_meter'}},
 {quantityMmbtu:'1500.125',discrepancyReason:null}]
 for(const change of cases)expect(()=>validateM73Save({...request(),...change})).toThrow()
})

test('independent missing, evidenced zero and open-discrepancy distinctions',()=>{
 const missing=validateM73Save({...request(),quantityMmbtu:null,statement:null,manualConfirmation:false})
 expect(deriveM73Findings(missing).some((f:any)=>f.code==='activity_missing')).toBe(true)
 const zero={...request(),quantityMmbtu:'0.000',statement:{...first.activity.statement,statedQuantityMmbtu:'0.000'},zeroReason:'Synthetic dedicated meter records no consumption.'}
 expect(validateM73Save(zero).quantityMmbtu).toBe('0.000')
 expect(()=>validateM73Save({...zero,zeroReason:null})).toThrow()
 expect(()=>validateM73Save({...zero,statement:first.activity.statement})).toThrow()
 const discrepant=validateM73Save({...request(),quantityMmbtu:'1500.125',discrepancyReason:'Entered meter reading correction remains unresolved.'})
 expect(deriveM73Findings(discrepant).some((f:any)=>f.code==='activity_statement_discrepancy')).toBe(true)
})

test('independent saved-source boundary and trusted-reference challenges',()=>{
 const sourceId=first.activity.binding.sourceId
 const eligible=(v:any)=>m73SourceChoices(v).find((s:any)=>s.binding.sourceId===sourceId)?.eligible
 expect(eligible(first.coverageVersion)).toBe(true)
 const mutations=[
  (s:any)=>{s.consolidationApproach='equity_share'},
  (s:any)=>{s.sources.find((x:any)=>x.id===sourceId).domain='purchased_electricity'},
  (s:any)=>{s.sources.find((x:any)=>x.id===sourceId).start='2025-02-01'},
  (s:any)=>{s.facilities.find((x:any)=>x.id===first.activity.binding.facilityId).regionCode='NV'},
  (s:any)=>{s.entities.find((x:any)=>x.id===first.activity.binding.entityId).countryCode='CA'},
  (s:any)=>{s.boundaryDecisions.find((x:any)=>x.id===first.activity.binding.boundaryDecisionId).disposition='excluded'},
  (s:any)=>{s.boundaryDecisions.find((x:any)=>x.id===first.activity.binding.boundaryDecisionId).reason=null},
  (s:any)=>{s.boundaryDecisions.find((x:any)=>x.id===first.activity.binding.boundaryDecisionId).evidenceRefs=[]},
  (s:any)=>{s.boundaryDecisions.find((x:any)=>x.id===first.activity.binding.boundaryDecisionId).evidenceRefs[0].expectedSha256='0'.repeat(64)},
 ]
 for(const mutate of mutations){const v=structuredClone(first.coverageVersion);mutate(v.snapshot);expect(eligible(v)).not.toBe(true)}
 for(const field of ['coverageVersionId','coverageVersionSha256','entityId','facilityId','sourceId','boundaryDecisionId']){
  const b={...first.activity.binding,[field]:field.endsWith('Sha256')?'0'.repeat(64):crypto.randomUUID()}
  expect(()=>m73ResolveBinding(b,first.coverageVersion)).toThrow()
 }
})

test('independent duplicate source register and unsupported release claims rejected by actual decoder',async()=>{
 const duplicate=structuredClone(fixture.register);duplicate.worksheets.push(duplicate.worksheets[0])
 await expect(decodeGasRegister(duplicate,fixture.companyId)).rejects.toThrow()
 for(const field of ['scope1Completeness','corporateCompleteness','releaseEligible','assurance']){
  const v=structuredClone(first);v[field]=field==='releaseEligible'?true:field==='assurance'?'assured':'complete'
  await expect(decodeGasVersion(v,fixture.companyId)).rejects.toThrow()
 }
 const fake=structuredClone(first);fake.statement.text+='Unbound statement claim';fake.statement.byteLength=new TextEncoder().encode(fake.statement.text).length;fake.statement.sha256=new Bun.CryptoHasher('sha256').update(fake.statement.text).digest('hex')
 await expect(decodeGasVersion(fake,fixture.companyId)).rejects.toThrow()
})
