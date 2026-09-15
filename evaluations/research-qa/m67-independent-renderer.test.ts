import {expect,test} from 'bun:test'
import {createElement} from '../../apps/site-web/node_modules/react'
import {renderToStaticMarkup} from '../../apps/site-web/node_modules/react-dom/server'
import {calculateAnnualMonths,m67CanonicalJson,validateAnnualWorksheetInput} from '../../packages/neuvetra-database/src/m67'
import {M67_METHOD,M67_MONTHS} from '../../packages/neuvetra-database/src/m67-contract'
const cases=await Bun.file(new URL('./m67-accounting-cases.json',import.meta.url)).json()
const component=await Bun.file(new URL('../../apps/site-web/src/components/AnnualElectricityWorksheet.tsx',import.meta.url)).text()
const raw=component.slice(component.indexOf('function VersionCard('))+'\nreturn VersionCard'
const compiled=new Bun.Transpiler({loader:'tsx',tsconfig:{compilerOptions:{jsx:'react',jsxFactory:'createElement'}}}).transformSync(raw)
const Card=new Function('createElement','MONTH_LABELS',compiled)(createElement,['January','February','March','April','May','June','July','August','September','October','November','December'])
function v(c:any){const e=c.expected;return {id:'11111111-1111-4111-8111-111111111111',version:1,companyLabel:'Synthetic <company> & "quote"',facilityLabel:'Synthetic facility',quantityKwh:e.quantity_kwh,quantityMwh:e.quantity_mwh,months:e.months.map((m:any)=>({month:m.month,quantityKwh:m.quantity_kwh,quantityMwh:m.quantity_mwh,total:m.unrounded_kg_co2e===null?null:{unrounded:m.unrounded_kg_co2e,display:m.display_kg_co2e}})),total:{display:e.total_display_kg_co2e,unrounded:e.total_unrounded_kg_co2e},coverage:e.coverage,method:M67_METHOD,inputSha256:'a'.repeat(64),resultSha256:'b'.repeat(64),review:null,correctionReason:null}}
test('actual saved-version JSX renders all12 ordered rows, missing versus0, qualifications and escaped labels',()=>{
 for(const c of cases.accepted_cases){const source=v(c),html=renderToStaticMarkup(createElement(Card,{version:source,label:'Saved'}));expect(html.match(/scope="row"/g)).toHaveLength(12);expect(html).toContain(source.total.display);expect(html).toContain(source.total.unrounded);expect(html).toContain('Synthetic &lt;company&gt; &amp; &quot;quote&quot;');expect(html).toContain('manual, with no linked bills');expect(html).toContain('Displayed monthly amounts may not sum');expect(html).toContain(source.coverage.electricityComplete?'company inventory is still incomplete':'excludes months not entered');expect(html).not.toMatch(/\u00c2|\u00e2\u20ac/)}
})
test('actual annual calculation matches independent aggregate and monthly expectations, including maximum above monthly bound',()=>{
 for(const c of cases.accepted_cases){const calculated=calculateAnnualMonths(c.months);expect(calculated.quantityKwh).toBe(c.expected.quantity_kwh);expect(calculated.quantityMwh).toBe(c.expected.quantity_mwh);expect(calculated.total.unrounded).toBe(c.expected.total_unrounded_kg_co2e);expect(calculated.total.display).toBe(c.expected.total_display_kg_co2e);expect(calculated.coverage).toEqual(c.expected.coverage);for(const [i,m] of calculated.months.entries()){expect(m.total?.unrounded??null).toBe(c.expected.months[i].unrounded_kg_co2e);expect(m.total?.display??null).toBe(c.expected.months[i].display_kg_co2e)}}
})
test('canonicalization has an independently written escaped/null/sorted preimage, not incidental insertion order',()=>{
 const a={z:[null,{quantityKwh:'0.000',month:'2023-01'}],companyLabel:'A"\\B',a:false}
 expect(m67CanonicalJson(a)).toBe('{"a":false,"companyLabel":"A\\"\\\\B","z":[null,{"month":"2023-01","quantityKwh":"0.000"}]}')
 expect(m67CanonicalJson({a:false,companyLabel:'A"\\B',z:a.z})).toBe(m67CanonicalJson(a))
 expect(m67CanonicalJson({z:['0.000',null]})).not.toBe(m67CanonicalJson({z:[null,'0.000']}))
})
test('all-null, invalid quantity and inherited-bill claims refuse in actual input validator',()=>{
 const input={companyLabel:'Synthetic',facilityLabel:'Synthetic',year:2023,geography:'CAMX',unit:'kWh',months:cases.accepted_cases[0].months,idempotencyKey:'11111111-1111-4111-8111-111111111111'}
 for(const c of cases.rejected_cases.filter((c:any)=>'replace_january_quantity'in c)){const copy=structuredClone(input);copy.months[0].quantityKwh=c.replace_january_quantity;expect(()=>validateAnnualWorksheetInput(copy,false)).toThrow()}
 expect(()=>calculateAnnualMonths(M67_MONTHS.map(month=>({month,quantityKwh:null})))).toThrow()
 expect(()=>validateAnnualWorksheetInput({...input,evidence:{sourceId:'fake'}},false)).toThrow()
})


test('actual annual report renders every independent row and captured manual coverage without January evidence',async()=>{
 const {buildAnnualWorksheetReport}=await import('../../packages/neuvetra-database/src/m67-report')
 for(const c of cases.accepted_cases){const source={...v(c),previousVersionId:null,evidenceBasis:'synthetic_manual_without_linked_bills',year:2023,geography:'CAMX',unit:'kWh',createdBy:'22222222-2222-4222-8222-222222222222',createdAt:'2026-09-15T01:00:00.000Z'} as any
 const result=buildAnnualWorksheetReport({id:'33333333-3333-4333-8333-333333333333',companyId:'44444444-4444-4444-8444-444444444444',createdBy:source.createdBy,createdAt:'2026-09-15T02:00:00.000Z',source});const html=new TextDecoder().decode(result.bytes)
 for(const text of [c.expected.subtotal_label,c.expected.total_display_kg_co2e,c.expected.total_unrounded_kg_co2e,'no linked bill evidence','Displayed monthly amounts may not sum','SRL23!AI6',M67_METHOD.sourceSha256,'No worksheet review was recorded'])expect(html).toContain(text)
 for(const month of ['January','February','March','April','May','June','July','August','September','October','November','December'])expect(html).toContain(month)
 expect(html).not.toMatch(/\{\{[a-zA-Z0-9]+\}\}/);expect(html).not.toMatch(/<script\b/i);expect(html).not.toMatch(/\u00c2|\u00e2\u20ac/);expect(result.bytes.byteLength).toBeLessThanOrEqual(98304)
 expect(new Bun.CryptoHasher('sha256').update(result.bytes).digest('hex')).toBe(result.reportSha256)
 }
})
