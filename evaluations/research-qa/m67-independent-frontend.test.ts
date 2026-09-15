import {afterEach,expect,test} from 'bun:test'
import {decodeAnnualElectricityWorksheet,annualWorksheetRequest} from '../../apps/site-web/src/lib/m67-api'
import {decodeAnnualWorksheetReport,readAnnualWorksheetReportHtml,listAnnualWorksheetReports} from '../../apps/site-web/src/lib/m67-report-api'
import {M67_PROFILE,M67_METHOD,M67_LIMITATIONS,M67_TEMPLATE_VERSION,type AnnualWorksheetVersion,type AnnualElectricityWorksheet,type AnnualWorksheetReport} from '../../packages/neuvetra-database/src/m67-contract'
import {M67_TEMPLATE_SHA256} from '../../packages/neuvetra-database/src/m67-template'
const evidence=await Bun.file(new URL('./m67-accounting-cases.json',import.meta.url)).json()
const company='11111111-1111-4111-8111-111111111111',creator='22222222-2222-4222-8222-222222222222',reviewer='33333333-3333-4333-8333-333333333333'
const id=(n:number)=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`
const digest=(s:string)=>new Bun.CryptoHasher('sha256').update(s).digest('hex')
function version(caseId:string,n=1,previous:string|null=null):AnnualWorksheetVersion {
 const e=evidence.accepted_cases.find((c:any)=>c.id===caseId).expected
 return {id:id(n),version:n,previousVersionId:previous,companyLabel:'Synthetic A',facilityLabel:'Synthetic CAMX',year:2023,geography:'CAMX',unit:'kWh',evidenceBasis:'synthetic_manual_without_linked_bills',months:e.months.map((m:any)=>({month:m.month,quantityKwh:m.quantity_kwh,quantityMwh:m.quantity_mwh,total:m.unrounded_kg_co2e===null?null:{unrounded:m.unrounded_kg_co2e,display:m.display_kg_co2e,unit:'kg CO2e',rounding:'half_even_4dp'}})),coverage:structuredClone(e.coverage),quantityKwh:e.quantity_kwh,quantityMwh:e.quantity_mwh,total:{unrounded:e.total_unrounded_kg_co2e,display:e.total_display_kg_co2e,unit:'kg CO2e',rounding:'half_even_4dp'},correctionReason:n===1?null:'Independent correction',inputSha256:digest('input'+n),resultSha256:digest('result'+n),createdBy:creator,createdAt:`2026-09-15T01:00:${String(n).padStart(2,'0')}.000Z`,method:M67_METHOD,review:null}
}
const worksheet=(...versions:AnnualWorksheetVersion[]):AnnualElectricityWorksheet=>({profile:M67_PROFILE,companyId:company,synthetic:true,complete:false,releaseEligible:false,assurance:'none',limitations:[...M67_LIMITATIONS],versions})
function decision(v:AnnualWorksheetVersion){return {id:id(90),versionId:v.id,resultSha256:v.resultSha256,decision:'accept_bounded_internal_draft' as const,note:null,acknowledgedLimitations:[...M67_LIMITATIONS],reviewerId:reviewer,reviewedAt:'2026-09-15T02:00:00.000Z',decisionSha256:digest('review')}}
function report(v:AnnualWorksheetVersion,html='<html><body>Independent synthetic bytes</body></html>'):AnnualWorksheetReport{return {id:id(91),companyId:company,profile:'neuvetra.synthetic.annual-electricity-report.v1',sourceVersionId:v.id,sourceVersion:v.version,inputSha256:v.inputSha256,resultSha256:v.resultSha256,reviewId:v.review?.id??null,reviewSha256:v.review?.decisionSha256??null,reviewState:v.review?'accepted_bounded_internal_draft':'unreviewed',templateVersion:M67_TEMPLATE_VERSION,templateSha256:M67_TEMPLATE_SHA256,reportSha256:digest(html),reportByteLength:new TextEncoder().encode(html).length,createdBy:creator,createdAt:'2026-09-15T01:30:00.000Z',synthetic:true,complete:false,releaseEligible:false,assurance:'none',source:structuredClone(v)}}
const originalFetch=globalThis.fetch
const actor={accessToken:'synthetic-token',userId:creator,role:'owner' as const}
afterEach(()=>{globalThis.fetch=originalFetch})
async function refuses(fn:()=>Promise<unknown>){let refused=false;try{await fn()}catch{refused=true}expect(refused).toBe(true)}

test('all independently derived vectors pass actual annual decoder, including aggregate maximum and rounding differences',()=>{
 for(const c of evidence.accepted_cases){const v=version(c.id);const w=decodeAnnualElectricityWorksheet(worksheet(v),company);expect(w.versions[0].total.display).toBe(c.expected.total_display_kg_co2e);expect(w.versions[0].quantityKwh).toBe(c.expected.quantity_kwh);expect(w.complete).toBe(false);expect(w.versions[0].coverage).toEqual(c.expected.coverage)}
 expect(decodeAnnualElectricityWorksheet(worksheet(),company).versions).toEqual([])
})
test('label-only, redistribution with identical total and null-zero successors are material through actual decoder',()=>{
 const first=version('january_25000_partial');const label=structuredClone(first);label.id=id(2);label.version=2;label.previousVersionId=first.id;label.correctionReason='Label changed';label.facilityLabel='Other fictional facility'
 expect(decodeAnnualElectricityWorksheet(worksheet(first,label),company).versions.length).toBe(2)
 const redistribute=structuredClone(label);redistribute.facilityLabel=first.facilityLabel;redistribute.months[1]={...redistribute.months[0],month:'2023-02'};redistribute.months[0]={month:'2023-01',quantityKwh:null,quantityMwh:null,total:null};redistribute.coverage.missingMonths=['2023-01',...first.coverage.missingMonths.slice(1)]
 expect(decodeAnnualElectricityWorksheet(worksheet(first,redistribute),company).versions[1].quantityKwh).toBe(first.quantityKwh)
 const partial=version('one_zero_remaining_missing'),full=version('all_zero',2,partial.id)
 expect(decodeAnnualElectricityWorksheet(worksheet(partial,full),company).versions[1].coverage.electricityComplete).toBe(true)
 const again=version('one_zero_remaining_missing',3,full.id)
 expect(decodeAnnualElectricityWorksheet(worksheet(partial,full,again),company).versions[2].coverage.knownMonths).toBe(1)
 const noop=structuredClone(label);noop.facilityLabel=first.facilityLabel
 expect(()=>decodeAnnualElectricityWorksheet(worksheet(first,noop),company)).toThrow()
})
test('independent month, null, coverage, quantity and inherited evidence substitutions refuse',()=>{
 const valid=worksheet(version('january_25000_partial'))
 const mutations:((w:any)=>void)[]=[w=>w.versions[0].months[0].quantityKwh+='\n',w=>w.versions[0].months[0].quantityMwh+='\n',w=>w.versions[0].total.display+='\n',w=>w.versions[0].total.unrounded+='\n',w=>w.versions[0].id+='\n',w=>w.versions[0].inputSha256+='\n',w=>w.versions[0].months.pop(),w=>w.versions[0].months.reverse(),w=>w.versions[0].months[1].month='2023-01',w=>w.versions[0].months[1].quantityKwh='0.000',w=>w.versions[0].months[1].total={unrounded:'0',display:'0.0000',unit:'kg CO2e',rounding:'half_even_4dp'},w=>w.versions[0].coverage.knownMonths=12,w=>w.versions[0].coverage.electricityComplete=true,w=>w.versions[0].coverage.missingMonths.reverse(),w=>w.versions[0].quantityKwh='25001.000',w=>w.versions[0].quantityMwh='25000.000000',w=>w.versions[0].months[0].quantityKwh=25000,w=>w.versions[0].months[0].quantityKwh='025000.000',w=>w.versions[0].evidenceBasis='verified_bill',w=>w.versions[0].evidence={sourceId:id(8)},w=>w.complete=true,w=>w.releaseEligible=true,w=>w.limitations.pop(),w=>w.versions[0].method.policy='m64-accounting-policy-v1',w=>w.companyId=id(99)]
 for(const mutate of mutations){const w=structuredClone(valid);mutate(w);expect(()=>decodeAnnualElectricityWorksheet(w,company)).toThrow()}
 const empty=structuredClone(valid);empty.versions[0].months=empty.versions[0].months.map(m=>({...m,quantityKwh:null,quantityMwh:null,total:null}));empty.versions[0].coverage={knownMonths:0,missingMonths:empty.versions[0].months.map(m=>m.month),electricityComplete:false};empty.versions[0].quantityKwh='0.000';empty.versions[0].quantityMwh='0.000000';empty.versions[0].total={unrounded:'0',display:'0.0000',unit:'kg CO2e',rounding:'half_even_4dp'}
 expect(()=>decodeAnnualElectricityWorksheet(empty,company)).toThrow()
})
test('captured unreviewed report survives later review; source, role and review substitutions refuse',()=>{
 const v=version('january_25000_partial'),old=report(v);v.review=decision(v);const w=worksheet(v)
 expect(decodeAnnualWorksheetReport(old,w).reviewState).toBe('unreviewed')
 const reviewed=report(v);expect(decodeAnnualWorksheetReport(reviewed,w).reviewId).toBe(v.review.id)
 for(const mutate of [(r:any)=>r.source.months[0].quantityKwh='1.000',(r:any)=>r.source.coverage.knownMonths=12,(r:any)=>r.reviewState='accepted_bounded_internal_draft',(r:any)=>r.source.evidenceBasis='verified_bill',(r:any)=>r.companyId=id(77),(r:any)=>r.templateSha256=digest('other')]){const r=structuredClone(old);mutate(r);expect(()=>decodeAnnualWorksheetReport(r,w)).toThrow()}
 v.review.reviewerId=v.createdBy;expect(()=>decodeAnnualElectricityWorksheet(w,company)).toThrow()
})
test('actual transport preserves twelve JSON null/string rows and rejects late actor responses',async()=>{
 let seen:any;const w=worksheet(version('one_zero_remaining_missing'))
 globalThis.fetch=(async(_url,init)=>{seen=JSON.parse(String(init?.body));return Response.json(w)}) as typeof fetch
 const rows=w.versions[0].months.map(m=>({month:m.month,quantityKwh:m.quantityKwh}));await annualWorksheetRequest(actor,company,'create',{companyLabel:'Synthetic',facilityLabel:'Synthetic',year:2023,geography:'CAMX',unit:'kWh',months:rows,idempotencyKey:id(88)})
 expect(seen.months).toEqual(rows);expect(seen.months[0].quantityKwh).toBe('0.000');expect(seen.months[1].quantityKwh).toBeNull()
 const controller=new AbortController();globalThis.fetch=(async()=>{controller.abort();return Response.json(w)}) as typeof fetch
 await refuses(()=>annualWorksheetRequest({...actor,signal:controller.signal},company))
 let calls=0;globalThis.fetch=(async()=>{calls++;return new Response(null,{status:403})}) as typeof fetch;let unauthorized=0
 await refuses(()=>annualWorksheetRequest({...actor,onUnauthorized:()=>unauthorized++},company));expect(unauthorized).toBe(1);expect(calls).toBe(1)
})
test('report download verifies authorized metadata before exact bytes; abort and revoked access prevent disclosure',async()=>{
 const v=version('one_zero_remaining_missing'),w=worksheet(v),r=report(v),html='<html><body>Independent synthetic bytes</body></html>';let calls=0
 globalThis.fetch=(async()=>++calls===1?Response.json(r):new Response(html,{headers:{'content-type':'text/html'}})) as typeof fetch
 expect(await readAnnualWorksheetReportHtml(actor,w,r)).toBe(html);expect(calls).toBe(2)
 calls=0;globalThis.fetch=(async()=>++calls===1?Response.json({...r,reportSha256:digest('altered')}):new Response(html)) as typeof fetch
 await refuses(()=>readAnnualWorksheetReportHtml(actor,w,r));expect(calls).toBe(1)
 calls=0;globalThis.fetch=(async()=>++calls===1?Response.json(r):new Response(html+' ',{headers:{'content-type':'text/html'}})) as typeof fetch
 await refuses(()=>readAnnualWorksheetReportHtml(actor,w,r));expect(calls).toBe(2)
 const controller=new AbortController();calls=0;globalThis.fetch=(async()=>{calls++;const response=Response.json(r);const read=response.json.bind(response);response.json=async()=>{const out=await read();controller.abort();return out};return response}) as typeof fetch
 await refuses(()=>readAnnualWorksheetReportHtml({...actor,signal:controller.signal},w,r));expect(calls).toBe(1)
 let unauthorized=0;globalThis.fetch=(async()=>new Response(null,{status:403})) as typeof fetch
 await refuses(()=>readAnnualWorksheetReportHtml({...actor,onUnauthorized:()=>unauthorized++},w,r));expect(unauthorized).toBe(1)
})
test('duplicate report list and cross-version captured review refuse',async()=>{
 const v=version('one_zero_remaining_missing'),w=worksheet(v),r=report(v)
 globalThis.fetch=(async()=>Response.json({profile:r.profile,companyId:company,reports:[r,r]})) as typeof fetch
 await refuses(()=>listAnnualWorksheetReports(actor,w))
 v.review=decision(v);v.review.versionId=id(82);expect(()=>decodeAnnualElectricityWorksheet(w,company)).toThrow()
})
