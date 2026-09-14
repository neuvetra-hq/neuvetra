import {expect,test} from 'bun:test'
import {buildWorksheetReport,worksheetReportIdentity} from '../../packages/neuvetra-database/src/m65'
import {M65_TEMPLATE,M65_TEMPLATE_SHA256} from '../../packages/neuvetra-database/src/m65-template'
import {M64_METHOD,M64_LIMITATIONS,type WorksheetVersion} from '../../packages/neuvetra-database/src/m64-contract'
const cases=await Bun.file(new URL('./m65-accounting-cases.json',import.meta.url)).json()
const id='11111111-1111-4111-8111-111111111111',company='22222222-2222-4222-8222-222222222222',creator='33333333-3333-4333-8333-333333333333',reviewer='44444444-4444-4444-8444-444444444444'
const instant='2026-09-14T23:00:00.000Z'
function source(c=cases.numerical_cases[0]):WorksheetVersion{return {id,version:1,previousVersionId:null,companyLabel:'Fictional QA',facilityLabel:'Fictional office',quantityKwh:c.quantity_kwh,quantityMwh:c.quantity_mwh,period:'2023-01',geography:'CAMX',unit:'kWh',correctionReason:null,inputSha256:'a'.repeat(64),resultSha256:'b'.repeat(64),createdBy:creator,createdAt:instant,total:{unrounded:c.total_unrounded_kg_co2e,display:c.total_display_kg_co2e,unit:'kg CO2e',rounding:'half_even_4dp'},method:{...M64_METHOD},review:null}}
const context=(s:WorksheetVersion)=>({id:'55555555-5555-4555-8555-555555555555',companyId:company,createdBy:creator,createdAt:instant,source:s})
const decode=(bytes:Uint8Array)=>new TextDecoder('utf-8',{fatal:true}).decode(bytes)
test('all seven independent report cases render exact supplied numeric strings and pinned authority',()=>{
 expect(new Bun.CryptoHasher('sha256').update(M65_TEMPLATE).digest('hex')).toBe(M65_TEMPLATE_SHA256)
 for(const c of cases.numerical_cases){const built=buildWorksheetReport(context(source(c))),html=decode(built.bytes)
  for(const required of [c.quantity_kwh+' kWh',c.quantity_mwh+' MWh',c.total_display_kg_co2e+' kg CO2e',c.total_unrounded_kg_co2e+' kg CO2e','January 1–31, 2023','SRL23!AI6',M64_METHOD.sourceSha256,M64_METHOD.factorCandidateSha256,M64_METHOD.gwpPolicySha256,'February–December','missing coverage is not zero consumption',cases.required_review_qualification])expect(html).toContain(required)
  expect(html).not.toMatch(/\{\{[^{}]*\}\}/);expect(built.bytes.byteLength).toBeLessThanOrEqual(65536)
  expect(new Bun.CryptoHasher('sha256').update(built.bytes).digest('hex')).toBe(built.reportSha256)
  expect(html).not.toContain(built.reportSha256);expect(html).toContain(built.identitySha256)
 }
})
test('permitted adversarial labels, notes and template-looking strings render as data with no active markup',()=>{
 const s=source();s.companyLabel='<script>alert("QA")</script> & {{display}}';s.facilityLabel='<img src=x onerror="alert(1)">';s.correctionReason='<svg onload="alert(1)"> & \' {{reportId}}'
 s.review={id:'66666666-6666-4666-8666-666666666666',versionId:id,resultSha256:s.resultSha256,decision:'changes_requested',note:'<iframe src="https://outside.invalid"> & {{companyLabel}}',acknowledgedLimitations:[],reviewerId:reviewer,reviewedAt:instant,decisionSha256:'c'.repeat(64)}
 const html=decode(buildWorksheetReport(context(s)).bytes)
 expect(html).toContain('&lt;script&gt;alert(&quot;QA&quot;)&lt;/script&gt; &amp; &#123;&#123;display&#125;&#125;')
 expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
 expect(html).toContain('&lt;iframe src=&quot;https://outside.invalid&quot;&gt;')
 expect(html).not.toMatch(/<(script|iframe|img|svg|object|embed|link|form|input)\b/i)
 expect(html).not.toMatch(/<[a-z][^>]*\son\w+\s*=/i)
 const links=[...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]);expect(links).toHaveLength(2);expect(links.every(href=>href!.startsWith('https://www.epa.gov/system/files/documents/'))).toBe(true)
 expect(html).toContain("default-src 'none'");expect(html).toContain('A manager requested changes to this worksheet version.')
})
test('review snapshots change identity without retroactively changing frozen unreviewed report bytes',()=>{
 const s=source(),ctx=context(structuredClone(s)),before=buildWorksheetReport(ctx),previous=decode(before.bytes)
 expect(previous).toContain('No worksheet review was recorded when this report was created.')
 s.review={id:'66666666-6666-4666-8666-666666666666',versionId:id,resultSha256:s.resultSha256,decision:'accept_bounded_internal_draft',note:null,acknowledgedLimitations:[...M64_LIMITATIONS],reviewerId:reviewer,reviewedAt:instant,decisionSha256:'c'.repeat(64)}
 const accepted=buildWorksheetReport(context(s))
 expect(worksheetReportIdentity(company,s)).not.toBe(before.identitySha256)
 expect(decode(accepted.bytes)).toContain('The worksheet version was accepted for bounded internal use.')
 expect(accepted.reportSha256).not.toBe(before.reportSha256)
 expect(buildWorksheetReport(ctx)).toEqual(before)
 expect(previous).toContain('not approval of this report presentation or assurance')
})
test('template includes repeated print qualifications and hash scope without claiming rendered-page verification',()=>{
 const html=decode(buildWorksheetReport(context(source())).bytes)
 expect(html.match(/Draft · Synthetic · Incomplete · Unreleased · No assurance/g)?.length).toBeGreaterThanOrEqual(3)
 for(const text of ['@media print','print-header','print-footer','overflow-wrap:anywhere','does not embed its own byte hash','Browser print/PDF layout and bytes may vary','annual 2023 regional average factor','not a January-specific factor'])expect(html).toContain(text)
})

