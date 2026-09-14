import {afterEach,expect,test} from 'bun:test'
import {decodeSourceElectricityWorksheet,decodeElectricitySource,uploadElectricitySource,readElectricitySource,listElectricitySources} from '../../apps/site-web/src/lib/m66-api'
import {M66_METHOD,M66_LIMITATIONS,type SourceWorksheetVersion,type SourceElectricityWorksheet,type ElectricitySource} from '../../packages/neuvetra-database/src/m66-contract'
const company='22222222-2222-4222-8222-222222222222',creator='33333333-3333-4333-8333-333333333333',instant='2026-09-14T23:00:00.000Z'
const bytes=new Uint8Array(await Bun.file(new URL('../../output/pdf/neuvetra-m55-synthetic-electricity-bill.pdf',import.meta.url)).arrayBuffer())
const source:ElectricitySource={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',companyId:company,fixtureId:'m55-fictional-bill-a',originalName:'neuvetra-m55-synthetic-electricity-bill.pdf',mediaType:'application/pdf',byteLength:4605,sha256:'0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135',printedQuantityKwh:'12345.000',uploadedBy:creator,uploadedAt:instant}
const version:SourceWorksheetVersion={id:'11111111-1111-4111-8111-111111111111',version:1,previousVersionId:null,companyLabel:'Fictional QA',facilityLabel:'Fictional CAMX',quantityKwh:'25000.000',quantityMwh:'25.000000',period:'2023-01',geography:'CAMX',unit:'kWh',correctionReason:null,inputSha256:'a'.repeat(64),resultSha256:'b'.repeat(64),createdBy:creator,createdAt:instant,total:{unrounded:'4876.00722',display:'4876.0072',unit:'kg CO2e',rounding:'half_even_4dp'},method:{...M66_METHOD},review:null,evidence:{source,page:1,confirmedBy:creator,confirmedAt:instant,quantityDifferenceReason:'Synthetic discrepancy exercise'}}
const worksheet=(versions=[version]):SourceElectricityWorksheet=>({profile:'neuvetra.synthetic.source-electricity-worksheet.v1',companyId:company,synthetic:true,complete:false,releaseEligible:false,assurance:'none',limitations:[...M66_LIMITATIONS],versions})
const actor=(signal?:AbortSignal,onUnauthorized?:()=>void)=>({userId:creator,companyId:company,role:'owner' as const,accessToken:'synthetic-token',signal,onUnauthorized})
const originalFetch=globalThis.fetch
afterEach(()=>{globalThis.fetch=originalFetch})
const denied=async(p:Promise<unknown>)=>{let error:unknown;try{await p}catch(e){error=e}expect(error).toBeInstanceOf(Error)}
test('valid discrepancy-only and label-only successors survive the actual frontend decoder',()=>{
 for(const patch of [{evidence:{...version.evidence,quantityDifferenceReason:'Clarified synthetic discrepancy'}},{companyLabel:'Corrected fictional company'},{facilityLabel:'Corrected fictional facility'}]){
  const v2={...structuredClone(version),id:'55555555-5555-4555-8555-555555555555',version:2,previousVersionId:version.id,correctionReason:'Correct recorded assertion',inputSha256:'c'.repeat(64),resultSha256:'d'.repeat(64),...patch}
  expect(decodeSourceElectricityWorksheet(worksheet([version,v2]),company).versions).toHaveLength(2)
 }
})
test('source and confirmation substitutions, missing discrepancy and duplicate versions refuse',()=>{
 for(const patch of [{page:0},{confirmedBy:'44444444-4444-4444-8444-444444444444'},{confirmedAt:'2026-09-15T00:00:00.000Z'},{quantityDifferenceReason:null},{source:{...source,companyId:'44444444-4444-4444-8444-444444444444'}}])expect(()=>decodeSourceElectricityWorksheet(worksheet([{...version,evidence:{...version.evidence,...patch} as any}]),company)).toThrow()
 expect(()=>decodeSourceElectricityWorksheet(worksheet([version,version]),company)).toThrow()
 const reordered=Object.fromEntries(Object.entries(structuredClone(worksheet())).reverse());expect(decodeSourceElectricityWorksheet(reordered,company)).toEqual(worksheet())
})
test('approved source identity rejects independently altered fixture/name/hash/length',()=>{
 expect(decodeElectricitySource(source,company)).toEqual(source)
 for(const patch of [{fixtureId:'not-approved'},{originalName:'altered.pdf'},{sha256:'f'.repeat(64)},{byteLength:4604},{printedQuantityKwh:'25000.000'}])expect(()=>decodeElectricitySource({...source,...patch},company)).toThrow()
})
test('upload constructs real FormData with exact original File bytes and only admitted fields',async()=>{
 globalThis.fetch=(async(_url,init)=>{expect(init!.method).toBe('POST');expect(init!.body).toBeInstanceOf(FormData);const form=init!.body as FormData;expect([...form.keys()].sort()).toEqual(['file','idempotencyKey']);expect(new Uint8Array(await (form.get('file') as File).arrayBuffer())).toEqual(bytes);return Response.json(source)}) as typeof fetch
 expect(await uploadElectricitySource(actor(),company,new File([bytes],source.originalName,{type:'application/pdf'}),'11111111-1111-4111-8111-111111111111')).toEqual(source)
})
test('source re-download requires metadata equality and exact PDF digest/length',async()=>{
 let count=0;globalThis.fetch=(async()=>++count%2===1?Response.json(Object.fromEntries(Object.entries(source).reverse())):new Response(bytes,{headers:{'content-type':'application/pdf'}})) as typeof fetch
 expect(new Uint8Array(await readElectricitySource(actor(),source))).toEqual(bytes)
 const corrupt=bytes.slice();corrupt[0]^=1;globalThis.fetch=(async()=>++count%2===1?Response.json(source):new Response(corrupt,{headers:{'content-type':'application/pdf'}})) as typeof fetch;await denied(readElectricitySource(actor(),source))
})
test('abort after metadata prevents PDF fetch; revoked download clears actor',async()=>{
 const controller=new AbortController();let count=0
 globalThis.fetch=(async()=>{count++;return {ok:true,status:200,json:async()=>{controller.abort();return source}} as Response}) as typeof fetch
 await denied(readElectricitySource(actor(controller.signal),source));expect(count).toBe(1)
 let unauthorized=0;count=0;globalThis.fetch=(async()=>++count===1?Response.json(source):new Response(null,{status:403})) as typeof fetch
 await denied(readElectricitySource(actor(undefined,()=>unauthorized++),source));expect(unauthorized).toBe(1)
})
test('duplicate source list identity refuses',async()=>{
 globalThis.fetch=(async()=>Response.json({profile:'neuvetra.synthetic.electricity-source.v1',companyId:company,sources:[source,source]})) as typeof fetch
 await denied(listElectricitySources(actor(),company))
})
