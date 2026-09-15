import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {calculateAnnualMonths,validateAnnualWorksheetInput,M67_METHOD,M67_PROFILE,M67_LIMITATIONS} from '../../packages/neuvetra-database/src/m67'
import {decodeAnnualElectricityWorksheet} from '../../apps/site-web/src/lib/m67-api'
const cases=JSON.parse(readFileSync('evaluations/research-qa/m67-accounting-cases.json','utf8'))
const sha=(p:string)=>new Bun.CryptoHasher('sha256').update(readFileSync(p)).digest('hex')
const company='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222'
const baseInput=(months:any)=>({companyLabel:'Synthetic company',facilityLabel:'Synthetic facility',year:2023,geography:'CAMX',unit:'kWh',months,idempotencyKey:id})
const expected=(e:any)=>({months:e.months.map((m:any)=>({month:m.month,quantityKwh:m.quantity_kwh,quantityMwh:m.quantity_mwh,total:m.unrounded_kg_co2e===null?null:{unrounded:m.unrounded_kg_co2e,display:m.display_kg_co2e,unit:'kg CO2e',rounding:'half_even_4dp'}})),quantityKwh:e.quantity_kwh,quantityMwh:e.quantity_mwh,total:{unrounded:e.total_unrounded_kg_co2e,display:e.total_display_kg_co2e,unit:'kg CO2e',rounding:'half_even_4dp'},coverage:e.coverage})
const worksheet=(e:any)=>({profile:M67_PROFILE,companyId:company,synthetic:true,complete:false,releaseEligible:false,assurance:'none',limitations:[...M67_LIMITATIONS],versions:[{...expected(e),id,version:1,previousVersionId:null,companyLabel:'Synthetic company',facilityLabel:'Synthetic facility',year:2023,geography:'CAMX',unit:'kWh',evidenceBasis:'synthetic_manual_without_linked_bills',correctionReason:null,inputSha256:'a'.repeat(64),resultSha256:'b'.repeat(64),createdBy:company,createdAt:'2026-09-15T01:00:00.000Z',method:M67_METHOD,review:null}]})
const accepted=[]
for(const c of cases.accepted_cases){assert.deepEqual(calculateAnnualMonths(c.months),expected(c.expected),c.id);validateAnnualWorksheetInput(baseInput(c.months),false);decodeAnnualElectricityWorksheet(worksheet(c.expected),company);accepted.push({id:c.id,exact:c.expected.total_unrounded_kg_co2e,display:c.expected.total_display_kg_co2e,coverage:c.expected.coverage})}
const rejected=[]
for(const c of cases.rejected_cases){const months=structuredClone(c.months??cases.accepted_cases.find((x:any)=>x.id===c.base_case).months);const input:any=baseInput(months)
 if('replace_january_quantity'in c)months[0].quantityKwh=c.replace_january_quantity
 else switch(c.id){case'all_missing':break;case'eleven_rows':months.pop();break;case'thirteen_rows':months.push(months[0]);break;case'duplicate_month':months[1].month='2023-01';break;case'out_of_order':[months[0],months[1]]=[months[1],months[0]];break;case'wrong_year':months[0].month='2024-01';break;case'missing_quantity_field':delete months[1].quantityKwh;break;case'unsupported_evidence_inheritance':input.evidence={sourceId:id};break;default:throw Error('Unimplemented case '+c.id)}
 assert.throws(()=>validateAnnualWorksheetInput(input,false),c.id);rejected.push(c.id)
}
const newlineChallenges=[]
for(const path of [['quantityKwh'],['quantityMwh'],['total','unrounded'],['total','display'],['months','0','quantityKwh'],['months','0','quantityMwh'],['months','0','total','unrounded'],['months','0','total','display']]){const w:any=worksheet(cases.accepted_cases[0].expected);let target=w.versions[0];for(const k of path.slice(0,-1))target=target[k];target[path.at(-1)!]+='\n';let refused=false;try{decodeAnnualElectricityWorksheet(w,company)}catch{refused=true}newlineChallenges.push({path:path.join('.'),refused})}
const paths=['docs/research/m67-accounting-contract.md','evaluations/research-qa/m67-accounting-cases.json','packages/neuvetra-database/src/m67-contract.ts','packages/neuvetra-database/src/m67.ts','apps/site-web/src/components/AnnualElectricityWorksheet.tsx','apps/site-web/src/components/AnnualWorksheetReports.tsx','apps/site-web/src/lib/m67-api.ts','apps/site-web/src/lib/m67-report-api.ts', 'evaluations/research-qa/m67-accounting-implementation-check.ts']
const result={observedAt:new Date().toISOString(),scope:'Pure calculator, input validation and frontend decoder only; no persistence, browser or print execution',accepted,rejected,newlineChallenges,sha256:Object.fromEntries(paths.map(p=>[p,sha(p)]))}
writeFileSync(process.argv[2]??'evaluations/research-qa/m67-accounting-implementation-first-receipt.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({accepted:accepted.length,rejected:rejected.length,newlineChallenges},null,2))
