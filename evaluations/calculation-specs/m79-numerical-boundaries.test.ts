import {describe,expect,test} from 'bun:test'
import {deriveM73Findings,validateM73Save} from '../../packages/neuvetra-database/src/m73-validation'
import {deriveM74Findings,m74CanCalculate,validateM74Save} from '../../packages/neuvetra-database/src/m74-validation'
import {deriveM76DieselActivityStatus,deriveM76DieselFindings,m76DieselCanCalculate,validateM76DieselSave} from '../../packages/neuvetra-database/src/m76-diesel-validation'
import {m77ExpectedCalculation,m77SourceFindings,validateM77Calculator} from '../../packages/neuvetra-database/src/m77-validation'
import {m78Display,m78Sum} from '../../packages/neuvetra-database/src/m78-reconciliation'

const uuid=(last:number)=>`10000000-0000-4000-8000-${last.toString().padStart(12,'0')}`
const binding={coverageVersionId:uuid(1),coverageVersionSha256:'a'.repeat(64),entityId:uuid(2),facilityId:uuid(3),sourceId:uuid(4),boundaryDecisionId:uuid(5)}
const period={start:'2025-01-01',endExclusive:'2026-01-01'} as const
const predecessor={expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:uuid(6)}

const natural=(quantityMmbtu:string|null,zeroReason:string|null='No consumption during 2025.')=>({
 profile:'synthetic-stationary-natural-gas-v1',binding,period,fuel:'Natural Gas',heatBasis:'HHV',unit:'MMBtu',quantityMmbtu,
 statement:quantityMmbtu===null?null:{issuer:'Fictional meter custodian',reference:'METER-2025',meterLabel:'Main meter',statedQuantityMmbtu:quantityMmbtu,description:'Fictional retained consumed-energy statement.',consumptionBasis:'dedicated_meter_consumed_no_adjustments'},
 manualConfirmation:quantityMmbtu!==null,discrepancyReason:null,zeroReason,...predecessor,
})

const mobile=(gallons:string|null,miles:string|null,zeroReason:string|null='No vehicle operation or fuel consumption during 2025.')=>({
 profile:'synthetic-mobile-diesel-v1',binding,period,
 vehicle:{assetId:'TRUCK-1',vehicleClass:'Medium- and Heavy-Duty Vehicles',classificationBasis:'Fictional retained classification basis.',modelYear:2018,fuel:'Fossil Diesel',controlBasis:'owned_operational_control_full_year'},
 quantityGallons:gallons,distanceMiles:miles,
 fuelStatement:gallons===null?null:{issuer:'Fictional fuel custodian',reference:'FUEL-2025',statedQuantityGallons:gallons,description:'Fictional retained fuel statement.',consumptionBasis:'dedicated_vehicle_consumed_no_adjustments'},
 mileageStatement:miles===null?null:{issuer:'Fictional mileage custodian',reference:'MILES-2025',statedDistanceMiles:miles,description:'Fictional retained mileage statement.',distanceBasis:'dedicated_vehicle_annual_distance'},
 fuelManualConfirmation:gallons!==null,mileageManualConfirmation:miles!==null,fuelDiscrepancyReason:null,mileageDiscrepancyReason:null,zeroReason,...predecessor,
})

const stationaryStatement=(statedQuantityGallons:string)=>({issuer:'Fictional fuel custodian',reference:'GEN-FUEL-2025',meterLabel:'Generator meter',statedQuantityGallons,description:'Fictional directly metered consumed-fuel statement.',consumptionBasis:'dedicated_generator_consumed_no_adjustments',measurementBasis:'direct_device_fuel_meter',dedicatedToSingleDevice:true,includesTesting:true,stockDerivedConsumption:false,sharedFuelAllocation:false,consumptionBoundaryExplanation:'Includes all test and maintenance runs for calendar 2025.',supplierSpecificHhvAvailable:false,supplierSpecificCarbonAvailable:false,defaultFactorEligibilityExplanation:'Supplier-specific HHV and carbon content were unavailable in the fictional retained record.'})
const stationary=(gallons:string|null,zeroReason:string|null='No testing, maintenance, or emergency fuel consumption during 2025.')=>({
 profile:'synthetic-stationary-diesel-v1',binding,period,
 equipment:{assetId:'GEN-1',identifierBasis:'Fictional retained equipment identity.',equipmentType:'stationary_emergency_generator',engineType:'compression_ignition',stationaryInstallation:'fixed',controlBasis:'owned_operational_control_full_year',controlExplanation:'Fictional full-year operational control.',fuel:'Fossil Distillate Fuel Oil No. 2',fossilFraction:'1.000',fuelGradeBasis:'Fictional retained fuel-grade record.'},
 unit:'US_gallon',quantityGallons:gallons,statement:gallons===null?null:stationaryStatement(gallons),manualConfirmation:gallons!==null,discrepancyReason:null,zeroReason,...predecessor,
})

const fugitive=(gas='HFC-134a',equipment='fixed_refrigeration',zero=true)=>({year:2025,asset_id:'ASSET-1',gas,equipment,unit:'kg',opening_date:'2025-01-01',closing_date:'2025-12-31',opening_capacity:'10.000000',closing_capacity:'10.000000',declarations:{full_year_operational_control:true,california_office_or_distribution:true,no_installation_retirement_or_retrofit:true,no_stocks_recovery_reuse_or_transfer:true,complete_all_provider_service_records:true,all_known_releases_recorded:true,opening_full_charge_verified:true,closing_full_charge_verified:true},evidence:{asset_identity:'ASSET-EVIDENCE',capacity:'CAPACITY-EVIDENCE',opening_full_charge:'OPENING-EVIDENCE',closing_full_charge:'CLOSING-EVIDENCE',annual_contractor_record:'ANNUAL-EVIDENCE'},refills:zero?[]:[{id:'REFILL-1',date:'2025-06-02',kg:'1.000000',contractor:'CONTRACTOR-1',reference:'SERVICE-1'}],releases:[],zero_activity_evidence:zero?'ZERO-EVIDENCE':null,uncertainty:'Candidate servicing estimate; evidence is not independently authenticated.'})

describe('M79 current application admission boundaries',()=>{
 test('natural gas distinguishes missing activity from an evidence-backed explicit zero',()=>{
  const missing=validateM73Save(natural(null) as any),zero=validateM73Save(natural('0.000') as any)
  expect(deriveM73Findings(missing as any).map(x=>x.code)).toContain('activity_missing')
  expect(deriveM73Findings(zero as any).map(x=>x.code)).not.toContain('activity_missing')
  expect(()=>validateM73Save(natural('0.000',null) as any)).toThrow()
 })
 test('mobile diesel refuses mixed zero and admits only aligned explicit zero',()=>{
  const mixed=validateM74Save(mobile('0.000','1.000') as any),zero=validateM74Save(mobile('0.000','0.000') as any)
  expect(m74CanCalculate(mixed as any)).toBe(false)
  expect(deriveM74Findings(mixed as any).map(x=>x.code)).toContain('mixed_zero_contradiction')
  expect(m74CanCalculate(zero as any)).toBe(true)
  expect(m74CanCalculate(validateM74Save(mobile('0.000','0.000',null) as any) as any)).toBe(false)
 })
 test('stationary diesel exposes default-HHV estimate eligibility and zero controls',()=>{
  const entered=validateM76DieselSave(stationary('1.000') as any),zero=validateM76DieselSave(stationary('0.000') as any)
  expect(m76DieselCanCalculate(entered as any)).toBe(true)
  expect(m76DieselCanCalculate(zero as any)).toBe(true)
  const unsupportedZero=validateM76DieselSave(stationary('0.000',null) as any)
  expect(deriveM76DieselActivityStatus(unsupportedZero as any)).toBe('unsupported_zero')
  expect(deriveM76DieselFindings(unsupportedZero as any).map(x=>x.code)).toContain('unsupported_zero')
  const supplierSpecific=stationary('1.000') as any;supplierSpecific.statement.supplierSpecificHhvAvailable=true
  expect(()=>validateM76DieselSave(supplierSpecific)).toThrow()
 })
 test('fugitive explicit zero remains an estimate and unsupported gas/equipment stays blocked',()=>{
  const zero=validateM77Calculator(fugitive() as any),calculation=m77ExpectedCalculation(zero)
  expect(calculation.estimated_emitted_kg).toBe('0')
  expect(calculation.status).toBe('candidate_method_estimate')
  expect(calculation.evidence_verified).toBe(false)
  expect(()=>m77ExpectedCalculation(validateM77Calculator(fugitive('SF6','fixed_hvac') as any))).toThrow()
  expect(()=>m77ExpectedCalculation(validateM77Calculator(fugitive('R-410A','fixed_refrigeration') as any))).toThrow()
  expect(m77SourceFindings({calculatorInput:null,assetId:'ASSET-1',binding} as any)[0]?.code).toBe('method_input_missing')
 })
 test('M78 aggregation sums exact contributions and rounds the parent once',async()=>{
  const expected=await Bun.file(new URL('./m79-numerical-expected.json',import.meta.url)).json()
  for(const item of expected.roundOnceAggregation){
   const exact=m78Sum([item.componentExact,item.componentExact])
   expect(exact).toBe(item.kgCo2eExact)
   expect(m78Display(exact)).toBe(item.kgCo2eDisplay)
   expect(m78Sum([item.componentDisplay,item.componentDisplay])).toBe(item.sumOfDisplayedSources)
  }
 })
})
