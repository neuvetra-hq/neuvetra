import {expect,test} from 'bun:test'
import {decodeCorporateVersion} from '../../apps/site-web/src/lib/m71-api'
import {decodeGeneratorVersion,decodeGeneratorReport,generatorReportRequest,generatorReportDownload} from '../../apps/site-web/src/lib/m76-diesel-api'
import {m71CanonicalJson,validateM71Snapshot,deriveM71Findings,m71VersionHashPayload} from '../../packages/neuvetra-database/src/m71-validation'
import {m76DieselStatementText,deriveM76DieselFindings,deriveM76DieselActivityStatus,m76DieselInputHashPayload,m76DieselContentPayload,m76DieselVersionHashPayload,m76DieselCalculationHashPayload,m76DieselReportHashPayload,m76DieselReviewHashPayload} from '../../packages/neuvetra-database/src/m76-diesel-validation'
import {M76_DIESEL_LIMITATIONS} from '../../packages/neuvetra-database/src/m76-diesel-contract'
import {m76DieselRenderReport,m76DieselReportSnapshot} from '../../packages/neuvetra-database/src/m76-diesel-report'
import {createM76DieselAuthority} from '../../apps/site-api/src/calculation/m76-authority'
import {independentStationaryGraph,qid,qtime} from './m76-independent-graph'

const bytesHash=(text:string)=>new Bun.CryptoHasher('sha256').update(text).digest('hex')
const hash=(v:unknown)=>bytesHash(m71CanonicalJson(v))
function sealVersion(v:any){v.inputSha256=hash(m76DieselInputHashPayload(v));v.contentSha256=hash(m76DieselContentPayload(v));v.versionSha256=hash(m76DieselVersionHashPayload(v));return v}
export async function verifiedGeneratorFixture(quantity='317.219'){
 const g=independentStationaryGraph(),v=g.diesel[0],cv=g.coverage
 cv.review=null;cv.snapshot=validateM71Snapshot(cv.snapshot);cv.findings=deriveM71Findings(cv.snapshot);cv.contentSha256=hash(cv.snapshot);cv.versionSha256=hash(m71VersionHashPayload(cv));await decodeCorporateVersion(cv,g.companyId)
 v.review=null;v.activity.binding.coverageVersionSha256=cv.versionSha256;v.activity.quantityGallons=quantity;v.activity.statement.statedQuantityGallons=quantity
 v.activity.zeroReason=quantity==='0.000'?'Fictional no operation including no test runs.':null
 v.statement.input=v.activity.statement;v.statement.locator=`m76-diesel-statement:${v.statement.id}:annual-activity`;v.statement.text=m76DieselStatementText(v.activity,cv);v.statement.sha256=bytesHash(v.statement.text);v.statement.byteLength=new TextEncoder().encode(v.statement.text).length
 v.calculation=await createM76DieselAuthority({python:'python'}).calculate({binding:v.activity.binding,period:v.activity.period,equipment:v.activity.equipment,unit:v.activity.unit,quantityGallons:quantity,statementSha256:v.statement.sha256});v.findings=deriveM76DieselFindings(v.activity);v.activityStatus=deriveM76DieselActivityStatus(v.activity);sealVersion(v)
 await decodeGeneratorVersion(v,g.companyId);return v
}
function makeReport(v:any){const snapshot=m76DieselReportSnapshot(v,null),snapshotJson=m71CanonicalJson(snapshot),html=m76DieselRenderReport(snapshot),r:any={id:qid(980),companyId:v.companyId,worksheetId:v.worksheetId,versionId:v.id,versionSha256:v.versionSha256,decisionId:null,decisionSha256:null,createdBy:v.createdBy,createdAt:qtime,rendererVersion:'m76-generator-source-report-v1',html,htmlSha256:bytesHash(html),htmlByteLength:new TextEncoder().encode(html).length,snapshotJson,snapshotSha256:bytesHash(snapshotJson),reportSha256:''};r.reportSha256=hash(m76DieselReportHashPayload(r));return r}

test('M76 actual generator decoder accepts independently assembled positive, tie and maximum versions/reports',async()=>{
 for(const quantity of ['317.219','175.000','125.000','999999999999.999']){
  const v=await verifiedGeneratorFixture(quantity),report=makeReport(v)
  expect(await decodeGeneratorVersion(v,v.companyId)).toEqual(v)
  expect(await decodeGeneratorReport(report,v.companyId,v)).toEqual(report)
  expect(report.html).toContain('C55, D55, E55, F55, G55')
  expect(report.html).toContain(v.calculation.total.display)
 }
},15000)

test('M76 decoder refuses jointly rehashed unsupported equipment/evidence/factor/claim',async()=>{
 const original=await verifiedGeneratorFixture()
 for(const mutate of [(v:any)=>{v.activity.equipment.fossilFraction='0.900'},(v:any)=>{v.activity.statement.includesTesting=false},(v:any)=>{v.activity.statement.supplierSpecificHhvAvailable=true},(v:any)=>{v.activity.equipment.fuel='Renewable Diesel'},(v:any)=>{v.calculation.method.hhvMmbtuPerGallon='0.139'},(v:any)=>{v.scope1Completeness='complete'}]){
  const v=structuredClone(original);mutate(v);v.statement.input=v.activity.statement;v.calculation.input.equipment=v.activity.equipment;v.calculation.inputSha256=hash(v.calculation.input);v.calculation.resultSha256=hash(m76DieselCalculationHashPayload(v.calculation));sealVersion(v)
  let refused=false;try{await decodeGeneratorVersion(v,v.companyId)}catch{refused=true}expect(refused).toBe(true)
 }
})

test('M76 complete source-report forgery cannot replace gas arithmetic using only recomputed hashes',async()=>{
 const original=await verifiedGeneratorFixture(),forged=structuredClone(original)
 forged.calculation.gasResults.co2.mass='1';forged.calculation.gasResults.co2.co2e='1';forged.calculation.total.unrounded='1';forged.calculation.total.display='1.0000';forged.calculation.resultSha256=hash(m76DieselCalculationHashPayload(forged.calculation));sealVersion(forged)
 const report=makeReport(forged)
 for(const authoritative of [undefined,original]){
  let refused=false;try{await decodeGeneratorReport(report,forged.companyId,authoritative)}catch{refused=true}expect(refused).toBe(true)
 }
})

test('M76 retained source report preserves captured absent review after subsequent source acceptance',async()=>{
 const original=await verifiedGeneratorFixture(),report=makeReport(original),later=structuredClone(original)
 later.review={id:qid(987),versionId:later.id,versionSha256:later.versionSha256,decision:'accepted_bounded_internal',note:'Later separate internal acceptance',acknowledgedLimitations:[...M76_DIESEL_LIMITATIONS],reviewerId:qid(3),reviewedAt:'2026-09-16T12:01:00.000Z',decisionSha256:''}
 later.review.decisionSha256=hash(m76DieselReviewHashPayload(later.companyId,later.review))
 expect(await decodeGeneratorVersion(later,later.companyId)).toEqual(later)
 expect(await decodeGeneratorReport(report,later.companyId,later)).toEqual(report)
 expect(JSON.parse(report.snapshotJson).review).toBeNull()
})

test('M76 actual report POST and download read authoritative server version and refuse nested arithmetic forgery',async()=>{
 const original=await verifiedGeneratorFixture(),report=makeReport(original),forged=structuredClone(original),realFetch=globalThis.fetch,actor={accessToken:'synthetic-only',userId:original.createdBy,role:'owner' as const},calls:string[]=[]
 forged.calculation.total.unrounded='1';forged.calculation.total.display='1.0000';forged.calculation.resultSha256=hash(m76DieselCalculationHashPayload(forged.calculation));sealVersion(forged);const fake=makeReport(forged)
 try{
  for(const selected of [report,fake]){
   calls.length=0
   globalThis.fetch=(async(url:any,options:any)=>{const u=String(url);calls.push(u);return new Response(u.endsWith(`/versions/${original.id}`)?JSON.stringify(original):u.endsWith('/download')?selected.html:JSON.stringify(selected),{status:200})}) as typeof fetch
   const input={versionId:original.id,expectedVersionSha256:original.versionSha256,expectedDecisionId:null,expectedDecisionSha256:null,idempotencyKey:qid(989)}
   if(selected===report){expect(await generatorReportRequest(actor,original.companyId,original.worksheetId,input)).toEqual(report);expect(await generatorReportDownload(actor,original.companyId,original.worksheetId,report)).toBe(report.html)}
   else {for(const op of [()=>generatorReportRequest(actor,original.companyId,original.worksheetId,input),()=>generatorReportDownload(actor,original.companyId,original.worksheetId,fake)]){let refused=false;try{await op()}catch{refused=true}expect(refused).toBe(true)}}
   expect(calls.some(u=>u.endsWith(`/versions/${original.id}`))).toBe(true)
  }
 }finally{globalThis.fetch=realFetch}
})
