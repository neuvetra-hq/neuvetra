import {expect,test} from 'bun:test'
import {createM76DieselAuthority} from '../../apps/site-api/src/calculation/m76-authority'
import {createM73Authority} from '../../apps/site-api/src/calculation/m73-authority'
import {m76DieselCanonicalJson} from '../../packages/neuvetra-database/src/m76-diesel-validation'
import {independentGeneratorInput} from './m76-independent-generator-fixture'
import expectations from './m76-independent-expectations.json'
import preservation from './m76-gas-preservation-baseline.json'

const hash=(v:unknown)=>new Bun.CryptoHasher('sha256').update(m76DieselCanonicalJson(v)).digest('hex')
export function independentComponents(c:any){return {heatMmbtu:c.derivedHhv?.quantityMmbtu??c.input.quantityMmbtu.replace(/(?:\.0+|(?<=\.[0-9]*?)0+)$/,''),co2MassKg:c.gasResults.co2.mass,ch4MassKg:c.gasResults.ch4.mass,n2oMassKg:c.gasResults.n2o.mass,ch4Co2eKg:c.gasResults.ch4.co2e,n2oCo2eKg:c.gasResults.n2o.co2e,totalExactKgCo2e:c.total.unrounded,totalDisplayKgCo2e:c.total.display}}

test('M76 independent source-cell vectors match both real Python authorities',async()=>{
 const diesel=createM76DieselAuthority({python:'python'}),gas=createM73Authority({python:'python'}),base=independentGeneratorInput()
 for(const f of expectations.numericFixtures){
  const record=f.family==='stationary_diesel'?await diesel.calculate({binding:base.binding,period:base.period,equipment:base.equipment,unit:base.unit,quantityGallons:f.quantity,statementSha256:'b'.repeat(64)}):await gas.calculate({binding:base.binding,period:base.period,fuel:'Natural Gas',heatBasis:'HHV',unit:'MMBtu',quantityMmbtu:f.quantity,statementSha256:'c'.repeat(64)})
  expect(independentComponents(record)).toEqual(f.expected)
  expect(record.method.sourceSha256).toBe(expectations.source.sha256)
  expect(record.method.releaseEligible).toBe(false)
  expect(record.method.status).toBe('development_candidate_not_released')
  if(f.family==='stationary_diesel'){
   expect(record.method.factorCells).toEqual(['C55','D55','E55','F55','G55'])
   expect(record.method.gwpCells).toEqual(['E524','E525','E526'])
   await diesel.replayBatch([record as any])
  }
 }
},30000)

test('M76 authority rejects unsupported input and coordinated method/output forgeries',async()=>{
 const authority=createM76DieselAuthority({python:'python'}),b=independentGeneratorInput(),input:any={binding:b.binding,period:b.period,equipment:b.equipment,unit:b.unit,quantityGallons:'1.000',statementSha256:'b'.repeat(64)}
 const record=await authority.calculate(input)
 expect(record.total.unrounded).toBe('10.240014')
 expect(record.total.unrounded).not.toBe(expectations.methodMixNegativeControl.roundedPerGallonRouteTotal)
 for(const patch of [{quantityGallons:'1'},{quantityGallons:'01.000'},{quantityGallons:'1.0000'},{quantityGallons:'1000000000000.000'},{quantityGallons:1},{quantityGallons:null},{unit:'imperial_gallon'},{unit:'MMBtu'},{equipment:{...b.equipment,stationaryInstallation:'portable'}},{equipment:{...b.equipment,fuel:'Fossil Diesel'}},{equipment:{...b.equipment,fossilFraction:'0.999'}},{period:{start:'2025-01-01',endExclusive:'2025-12-31'}}]){
  let refused=false;try{await authority.calculate({...input,...patch})}catch{refused=true}expect(refused).toBe(true)
 }
 for(const mutate of [(v:any)=>{v.method.hhvMmbtuPerGallon='0.139'},(v:any)=>{v.method.co2KgPerMmbtu='10.21'},(v:any)=>{v.method.ch4Gwp='29.8'},(v:any)=>{v.method.releaseEligible=true},(v:any)=>{v.gasResults.co2.mass='10.21';v.gasResults.co2.co2e='10.21';v.total.unrounded='10.243534';v.total.display='10.2435'},(v:any)=>{v.derivedHhv.quantityMmbtu='0.139'}]){
  const v:any=structuredClone(record);mutate(v);v.method.factorSha256=hash({hhvMmbtuPerGallon:v.method.hhvMmbtuPerGallon,co2KgPerMmbtu:v.method.co2KgPerMmbtu,ch4GramsPerMmbtu:v.method.ch4GramsPerMmbtu,n2oGramsPerMmbtu:v.method.n2oGramsPerMmbtu});const {resultSha256:_,...body}=v;v.resultSha256=hash(body)
  let refused=false;try{await authority.replayBatch([v])}catch{refused=true}expect(refused).toBe(true)
 }
},30000)

test('M76 preserves every observed M73 source/method/storage/report/decoder byte',async()=>{
 for(const [path,sha]of Object.entries(preservation.files))expect(new Bun.CryptoHasher('sha256').update(await Bun.file(path).bytes()).digest('hex')).toBe(sha)
})
