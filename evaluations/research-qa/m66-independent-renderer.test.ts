import {expect,test} from 'bun:test'
import {buildSourceWorksheetReport,sourceWorksheetReportIdentity} from '../../packages/neuvetra-database/src/m66-report'
import {M66_TEMPLATE,M66_TEMPLATE_SHA256} from '../../packages/neuvetra-database/src/m66-template'
import {M66_METHOD,M66_LIMITATIONS,type SourceWorksheetVersion} from '../../packages/neuvetra-database/src/m66-contract'
import {sourceWorksheetInputHash,sourceWorksheetResultHash} from '../../packages/neuvetra-database/src/m66'
const cases=await Bun.file(new URL('./m66-accounting-cases.json',import.meta.url)).json()
const id='11111111-1111-4111-8111-111111111111',company='22222222-2222-4222-8222-222222222222',creator='33333333-3333-4333-8333-333333333333',reviewer='44444444-4444-4444-8444-444444444444',instant='2026-09-14T23:00:00.000Z'
function source(c=cases.numerical_cases[0],which:'A'|'B'='A'):SourceWorksheetVersion{
 const f=which==='A'?cases.source_A:cases.source_B
 const s:SourceWorksheetVersion={id,version:1,previousVersionId:null,companyLabel:'Fictional QA company',facilityLabel:'Fictional CAMX facility',quantityKwh:c.quantity_kwh,quantityMwh:c.quantity_mwh,period:'2023-01',geography:'CAMX',unit:'kWh',correctionReason:null,inputSha256:'',resultSha256:'',createdBy:creator,createdAt:instant,total:{unrounded:c.unrounded_kg_co2e,display:c.display_kg_co2e,unit:'kg CO2e',rounding:'half_even_4dp'},method:{...M66_METHOD},review:null,evidence:{source:{id:which==='A'?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',companyId:company,fixtureId:which==='A'?'m55-fictional-bill-a':'m66-fictional-bill-b',originalName:f.path.split('/').at(-1),mediaType:'application/pdf',byteLength:f.bytes,sha256:f.sha256,printedQuantityKwh:f.printed_quantity_kwh,uploadedBy:creator,uploadedAt:instant},page:1,confirmedBy:creator,confirmedAt:instant,quantityDifferenceReason:c.discrepancy_reason}}
 s.inputSha256=sourceWorksheetInputHash(company,s);s.resultSha256=sourceWorksheetResultHash(s.inputSha256,s);return s
}
const context=(s:SourceWorksheetVersion)=>({id:'55555555-5555-4555-8555-555555555555',companyId:company,createdBy:creator,createdAt:instant,source:s})
const decode=(b:Uint8Array)=>new TextDecoder('utf-8',{fatal:true}).decode(b)
test('all ten independent cases render exact manual/printed distinction and complete source fingerprints',()=>{
 expect(new Bun.CryptoHasher('sha256').update(M66_TEMPLATE).digest('hex')).toBe(M66_TEMPLATE_SHA256)
 for(const c of cases.numerical_cases){const v=source(c),built=buildSourceWorksheetReport(context(v)),html=decode(built.bytes)
  for(const required of [c.quantity_kwh+' kWh',c.quantity_mwh+' MWh',c.display_kg_co2e+' kg CO2e',c.unrounded_kg_co2e+' kg CO2e','12345.000 kWh',v.evidence.source.sha256,String(v.evidence.source.byteLength),'Page 1',creator,instant,v.inputSha256,v.resultSha256,M66_METHOD.sourceSha256,'no public source URL','not approval of this report presentation or assurance'])expect(html).toContain(required)
  if(c.discrepancy_reason!==null)expect(html).toContain('Manual worksheet quantity differs from the bill: '+c.discrepancy_reason)
  else expect(html).toContain('matches the printed fictional bill quantity')
  expect(html).not.toMatch(/\{\{[^{}]*\}\}/);expect(html).not.toContain('without bill evidence');expect(html).not.toContain('no bill evidence')
  expect(new Bun.CryptoHasher('sha256').update(built.bytes).digest('hex')).toBe(built.reportSha256);expect(html).not.toContain(built.reportSha256)
 }
})
test('evidence-only replacement binds new source/input/result/report identity without changing numeric output',()=>{
 const a=source(),b=source(cases.numerical_cases[0],'B'),ra=buildSourceWorksheetReport(context(a)),rb=buildSourceWorksheetReport(context(b))
 expect(a.total).toEqual(b.total);expect(a.quantityKwh).toBe(b.quantityKwh);expect(a.inputSha256).not.toBe(b.inputSha256);expect(a.resultSha256).not.toBe(b.resultSha256)
 expect(ra.identitySha256).not.toBe(rb.identitySha256);expect(ra.reportSha256).not.toBe(rb.reportSha256);expect(decode(ra.bytes)).toContain(cases.source_A.sha256);expect(decode(rb.bytes)).toContain(cases.source_B.sha256);expect(buildSourceWorksheetReport(context(a))).toEqual(ra)
})
test('discrepancy, correction and reviewer text are escaped without active markup',()=>{
 const v=source(cases.numerical_cases.find((c:any)=>c.require_discrepancy_reason));v.companyLabel='<script>alert("QA")</script>';v.facilityLabel='<img src=x onerror="x">';v.correctionReason='<svg> & {{sourceSha256}}';v.evidence.quantityDifferenceReason='<iframe src="https://outside.invalid"> & {{evidenceSha256}}'
 v.review={id:'66666666-6666-4666-8666-666666666666',versionId:id,resultSha256:v.resultSha256,decision:'changes_requested',note:'<script>bad</script> & {{quantityKwh}}',acknowledgedLimitations:[],reviewerId:reviewer,reviewedAt:instant,decisionSha256:'c'.repeat(64)}
 const html=decode(buildSourceWorksheetReport(context(v)).bytes)
 expect(html).toContain('&lt;iframe src=&quot;https://outside.invalid&quot;&gt; &amp; &#123;&#123;evidenceSha256&#125;&#125;');expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;')
 expect(html).not.toMatch(/<(script|iframe|img|svg|object|embed|link|form)\b/i);expect([...html.matchAll(/href="([^"]+)"/g)].every(m=>m[1]!.startsWith('https://www.epa.gov/system/files/documents/'))).toBe(true)
})
test('captured absence stays reproducible after review; source print status is structural evidence only',()=>{
 const v=source(),old=context(structuredClone(v)),first=buildSourceWorksheetReport(old)
 v.review={id:'66666666-6666-4666-8666-666666666666',versionId:id,resultSha256:v.resultSha256,decision:'accept_bounded_internal_draft',note:null,acknowledgedLimitations:[...M66_LIMITATIONS],reviewerId:reviewer,reviewedAt:instant,decisionSha256:'c'.repeat(64)}
 expect(sourceWorksheetReportIdentity(company,v)).not.toBe(first.identitySha256);expect(buildSourceWorksheetReport(old)).toEqual(first)
 const html=decode(buildSourceWorksheetReport(context(v)).bytes)
 expect(html).toContain('accepted for bounded internal use');expect(html).toContain('@top-center');expect(html).toContain('@bottom-center');expect(html.match(/Draft · Synthetic · Incomplete · Unreleased · No assurance/g)!.length).toBeGreaterThanOrEqual(3)
})
