import {afterEach,expect,test} from 'bun:test'
import {M64_METHOD,M64_LIMITATIONS,type ElectricityWorksheet} from '../../packages/neuvetra-database/src/m64-contract'
import {M65_TEMPLATE_SHA256} from '../../packages/neuvetra-database/src/m65-template'
import {M65_PROFILE,M65_TEMPLATE_VERSION,type WorksheetReport} from '../../packages/neuvetra-database/src/m65-contract'
import {decodeWorksheetReport,readWorksheetReportHtml,listWorksheetReports} from '../../apps/site-web/src/lib/m65-api'
const company='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222',reviewer='33333333-3333-4333-8333-333333333333',sourceId='44444444-4444-4444-8444-444444444444'
const instant='2026-09-14T23:00:00.000Z'
const html='<!doctype html><html><body>Draft Synthetic Incomplete Unreleased No assurance</body></html>'
const bytes=new TextEncoder().encode(html),digest=new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
function fixture(){
 const worksheet:ElectricityWorksheet={profile:'neuvetra.synthetic.manual-electricity-worksheet.v1',companyId:company,synthetic:true,complete:false,releaseEligible:false,assurance:'none',limitations:[...M64_LIMITATIONS],versions:[{id:sourceId,version:1,previousVersionId:null,companyLabel:'Fictional QA',facilityLabel:'Fictional office',quantityKwh:'25000.000',quantityMwh:'25.000000',period:'2023-01',geography:'CAMX',unit:'kWh',correctionReason:null,inputSha256:'a'.repeat(64),resultSha256:'b'.repeat(64),createdBy:owner,createdAt:instant,total:{unrounded:'4876.00722',display:'4876.0072',unit:'kg CO2e',rounding:'half_even_4dp'},method:{...M64_METHOD},review:null}]}
 const report:WorksheetReport={id:'55555555-5555-4555-8555-555555555555',companyId:company,profile:M65_PROFILE,sourceVersionId:sourceId,sourceVersion:1,inputSha256:'a'.repeat(64),resultSha256:'b'.repeat(64),reviewId:null,reviewSha256:null,reviewState:'unreviewed',templateVersion:M65_TEMPLATE_VERSION,templateSha256:M65_TEMPLATE_SHA256,reportSha256:digest,reportByteLength:bytes.byteLength,createdBy:owner,createdAt:instant,synthetic:true,complete:false,releaseEligible:false,assurance:'none',source:structuredClone(worksheet.versions[0]!)}
 return {worksheet,report}
}
function reverse(v:any):any{return Array.isArray(v)?v.map(reverse):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,value])=>[k,reverse(value)])):v}
const originalFetch=globalThis.fetch
afterEach(()=>{globalThis.fetch=originalFetch})
async function denied(p:Promise<unknown>){try{await p;throw Error('UNEXPECTED_SUCCESS')}catch(e){if(e instanceof Error&&e.message!=='UNEXPECTED_SUCCESS')return e;throw e}}
test('independent decoder keeps prior unreviewed snapshot valid after worksheet review, irrespective of object order',()=>{
 const {worksheet,report}=fixture();expect(decodeWorksheetReport(reverse(report),worksheet)).toEqual(report)
 worksheet.versions[0]!.review={id:'66666666-6666-4666-8666-666666666666',versionId:sourceId,resultSha256:'b'.repeat(64),decision:'accept_bounded_internal_draft',note:null,acknowledgedLimitations:[...M64_LIMITATIONS],reviewerId:reviewer,reviewedAt:instant,decisionSha256:'d'.repeat(64)}
 expect(decodeWorksheetReport(report,worksheet).reviewState).toBe('unreviewed')
 const reviewed={...report,source:structuredClone(worksheet.versions[0]!),reviewId:worksheet.versions[0]!.review.id,reviewSha256:'d'.repeat(64),reviewState:'accepted_bounded_internal_draft'}
 expect(decodeWorksheetReport(reverse(reviewed),worksheet).reviewState).toBe('accepted_bounded_internal_draft')
 expect(report.source.review).toBeNull()
})
test('independent decoder refuses tenant/source/review/template/shape substitutions',()=>{
 const {worksheet,report}=fixture()
 for(const change of [(r:any)=>r.companyId=reviewer,(r:any)=>r.sourceVersion=2,(r:any)=>r.sourceVersionId=reviewer,(r:any)=>r.source.companyLabel='Another company',(r:any)=>r.source.quantityKwh='0.000',(r:any)=>r.source.total.display='0.0000',(r:any)=>r.inputSha256='0'.repeat(64),(r:any)=>r.reviewId=reviewer,(r:any)=>r.reviewState='accepted_bounded_internal_draft',(r:any)=>r.templateVersion='future-template',(r:any)=>r.templateSha256='0'.repeat(64),(r:any)=>r.reportByteLength=65537,(r:any)=>r.assurance='verified',(r:any)=>r.complete=true,(r:any)=>r.extra='unexpected',(r:any)=>delete r.source]){const copy=structuredClone(report);change(copy);expect(()=>decodeWorksheetReport(copy,worksheet)).toThrow()}
})
test('exact authenticated HTML digest and length required independently of JSON key order',async()=>{
 const {worksheet,report}=fixture();const paths:string[]=[]
 const actor={userId:owner,role:'owner' as const,accessToken:'synthetic-token'}
 globalThis.fetch=(async(url,init)=>{paths.push(String(url));expect(init?.cache).toBe('no-store');return String(url).endsWith('/download')?new Response(bytes,{headers:{'content-type':'text/html; charset=utf-8'}}):Response.json(reverse(report))})as typeof fetch
 expect(await readWorksheetReportHtml(actor,worksheet,report)).toBe(html);expect(paths).toHaveLength(2)
 for(const corrupt of [bytes.slice(1),new TextEncoder().encode(html.replace('Draft','Final'))]){globalThis.fetch=(async(url)=>String(url).endsWith('/download')?new Response(corrupt,{headers:{'content-type':'text/html; charset=utf-8'}}):Response.json(report))as typeof fetch;expect((await denied(readWorksheetReportHtml(actor,worksheet,report))).message).toContain('could not be verified')}
})
test('abort after metadata body prevents download; abort after HTML bytes prevents rendering',async()=>{
 const {worksheet,report}=fixture()
 for(const boundary of ['metadata','download']){
  const controller=new AbortController();let downloads=0
  const actor={userId:owner,role:'owner' as const,accessToken:'synthetic-token',signal:controller.signal}
  globalThis.fetch=(async url=>{
   if(String(url).endsWith('/download')){downloads++;const response=new Response(bytes,{headers:{'content-type':'text/html'}});response.arrayBuffer=async()=>{controller.abort();return bytes.buffer};return response}
   const response=Response.json(report);if(boundary==='metadata')response.json=async()=>{controller.abort();return report};return response
  })as typeof fetch
  await denied(readWorksheetReportHtml(actor,worksheet,report));expect(downloads).toBe(boundary==='metadata'?0:1)
 }
})
test('revocation at download invalidates the actor and duplicate report-list IDs refuse',async()=>{
 const {worksheet,report}=fixture();let invalidated=0
 const actor={userId:owner,role:'owner' as const,accessToken:'synthetic-token',onUnauthorized:()=>{invalidated++}}
 globalThis.fetch=(async url=>String(url).endsWith('/download')?new Response('{}',{status:403}):Response.json(report))as typeof fetch
 await denied(readWorksheetReportHtml(actor,worksheet,report));expect(invalidated).toBe(1)
 globalThis.fetch=(async()=>Response.json({profile:M65_PROFILE,companyId:company,reports:[report,report]}))as typeof fetch
 expect((await denied(listWorksheetReports(actor,worksheet))).message).toContain('could not be verified')
})

