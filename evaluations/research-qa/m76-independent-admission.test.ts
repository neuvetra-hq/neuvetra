import {describe, expect, test} from 'bun:test'
import {independentGeneratorInput} from './m76-independent-generator-fixture'
import {validateM76DieselSave,m76DieselActivity,m76DieselCanCalculate,deriveM76DieselActivityStatus,deriveM76DieselFindings} from '../../packages/neuvetra-database/src/m76-diesel-validation'

describe('M76 independent generator admission (pure boundary)',()=>{
 test('supported positive control and canonical decimal/property order',()=>{
  const input=independentGeneratorInput(),validated=validateM76DieselSave(input)
  expect(validated).toEqual(input)
  expect(m76DieselCanCalculate(m76DieselActivity(validated))).toBe(true)
  expect(deriveM76DieselActivityStatus(m76DieselActivity(validated))).toBe('entered')
  const reordered=Object.fromEntries(Object.entries(input).reverse())
  expect(validateM76DieselSave(reordered)).toEqual(input)
  for(const [raw,want] of [['0','0.000'],['12','12.000'],['12.3','12.300'],['12.34','12.340'],['999999999999.999','999999999999.999']]){
   const v=independentGeneratorInput();v.quantityGallons=raw!;v.statement!.statedQuantityGallons=raw!
   expect(validateM76DieselSave(v).quantityGallons).toBe(want)
   expect(validateM76DieselSave(v).statement!.statedQuantityGallons).toBe(want)
  }
 })
 test('every required equipment fact is enforced structurally',()=>{
  for(const field of Object.keys(independentGeneratorInput().equipment)){
   const v:any=independentGeneratorInput();delete v.equipment[field]
   expect(()=>validateM76DieselSave(v)).toThrow()
  }
  for(const [field,value] of Object.entries({equipmentType:'portable_generator',engineType:'spark_ignition',stationaryInstallation:'portable',controlBasis:'leased',fuel:'Diesel',fossilFraction:'0.950',identifierBasis:' ',controlExplanation:'',fuelGradeBasis:'',assetId:'QA/GEN'})){
   const v:any=independentGeneratorInput();v.equipment[field]=value
   expect(()=>validateM76DieselSave(v)).toThrow()
  }
  for(const fuel of ['B5','B20','Renewable Diesel','Natural Gas','Distillate Fuel Oil No. 1','Distillate Fuel Oil No. 2','unknown']){
   const v:any=independentGeneratorInput();v.equipment.fuel=fuel
   expect(()=>validateM76DieselSave(v)).toThrow()
  }
 })
 test('every statement fact is required and contradictory measurements refuse',()=>{
  for(const field of Object.keys(independentGeneratorInput().statement!)){
   const v:any=independentGeneratorInput();delete v.statement[field]
   expect(()=>validateM76DieselSave(v)).toThrow()
  }
  const incorrect={consumptionBasis:'purchases',measurementBasis:'hours_times_rate',dedicatedToSingleDevice:false,includesTesting:false,stockDerivedConsumption:true,sharedFuelAllocation:true,supplierSpecificHhvAvailable:true,supplierSpecificCarbonAvailable:true,defaultFactorEligibilityExplanation:'',consumptionBoundaryExplanation:' '}
  for(const [field,value]of Object.entries(incorrect)){
   const v:any=independentGeneratorInput();v.statement[field]=value
   expect(()=>validateM76DieselSave(v)).toThrow()
  }
  for(const field of ['dedicatedToSingleDevice','includesTesting','stockDerivedConsumption','sharedFuelAllocation','supplierSpecificHhvAvailable','supplierSpecificCarbonAvailable'])for(const replacement of [null,'false',0,1]){
   const v:any=independentGeneratorInput();v.statement[field]=replacement
   expect(()=>validateM76DieselSave(v)).toThrow()
  }
 })
 test('wrong units, precision, coercion and invalid source-period binding refuse',()=>{
  for(const quantity of [1,NaN,Infinity,'-1','+1','1e3','1E3',' 1','1 ','01','00.1','1,000','1.0000','.1','1.','1000000000000.000','',true]){
   const v:any=independentGeneratorInput();v.quantityGallons=quantity
   expect(()=>validateM76DieselSave(v)).toThrow()
  }
  for(const unit of ['gallon','imperial_gallon','litre','MMBtu']){
   const v:any=independentGeneratorInput();v.unit=unit
   expect(()=>validateM76DieselSave(v)).toThrow()
  }
  for(const patch of [{period:{start:'2025-02-01',endExclusive:'2026-01-01'}},{period:{start:'2025-01-01',endExclusive:'2025-12-31'}},{binding:{...independentGeneratorInput().binding,sourceId:'not-a-uuid'}},{binding:{...independentGeneratorInput().binding,coverageVersionSha256:'a'.repeat(63)}},{unexpected:true}]){
   expect(()=>validateM76DieselSave({...independentGeneratorInput(),...patch})).toThrow()
  }
 })
 test('missing activity or evidence remains incomplete and cannot produce zero',()=>{
  for(const patch of [{quantityGallons:null},{statement:null},{manualConfirmation:false}]){
   const a=m76DieselActivity(validateM76DieselSave({...independentGeneratorInput(),...patch}))
   expect(m76DieselCanCalculate(a)).toBe(false)
   expect(['missing','evidence_missing','unconfirmed']).toContain(deriveM76DieselActivityStatus(a))
   expect(deriveM76DieselFindings(a).some(f=>['activity_missing','statement_missing','statement_unconfirmed'].includes(f.code))).toBe(true)
  }
 })
 test('supported zero, missing rationale, and contradictory test-run record differ',()=>{
  const zero=independentGeneratorInput();zero.quantityGallons='0.000';zero.statement!.statedQuantityGallons='0.000';zero.zeroReason='Fictional device did not run, including no testing or maintenance runs.'
  const a=m76DieselActivity(validateM76DieselSave(zero))
  expect(m76DieselCanCalculate(a)).toBe(true);expect(deriveM76DieselActivityStatus(a)).toBe('explicit_zero')
  const noReason=m76DieselActivity(validateM76DieselSave({...zero,zeroReason:null}))
  expect(m76DieselCanCalculate(noReason)).toBe(false);expect(deriveM76DieselFindings(noReason).some(f=>f.code==='unsupported_zero')).toBe(true)
  zero.statement!.statedQuantityGallons='1.000';zero.discrepancyReason='Record contradicts zero.'
  const contradicted=m76DieselActivity(validateM76DieselSave(zero))
  expect(m76DieselCanCalculate(contradicted)).toBe(false)
  expect(deriveM76DieselFindings(contradicted).some(f=>f.code==='activity_statement_discrepancy')).toBe(true)
 })
 test('positive discrepancy needs explanation and survives as a finding',()=>{
  const v=independentGeneratorInput();v.quantityGallons='317.220'
  expect(()=>validateM76DieselSave(v)).toThrow()
  v.discrepancyReason='One-thousandth-gallon difference remains unresolved.'
  const a=m76DieselActivity(validateM76DieselSave(v))
  expect(m76DieselCanCalculate(a)).toBe(true)
  expect(deriveM76DieselFindings(a).some(f=>f.code==='activity_statement_discrepancy')).toBe(true)
 })
 test('successor expected head requires reason and complete previous identity',()=>{
  const v=independentGeneratorInput();v.expectedVersionId='76000000-0000-4000-8000-000000000123'
  expect(()=>validateM76DieselSave(v)).toThrow()
  v.expectedVersionSha256='b'.repeat(64);expect(()=>validateM76DieselSave(v)).toThrow()
  v.correctionReason='Independent changed-statement explanation.';expect(validateM76DieselSave(v)).toEqual(v)
 })
})
