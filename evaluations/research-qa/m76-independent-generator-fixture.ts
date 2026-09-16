import {M76_DIESEL_PROFILE,M76_DIESEL_FUEL,M76_DIESEL_PERIOD,type M76DieselSaveInput} from '../../packages/neuvetra-database/src/m76-diesel-contract'

export const independentGeneratorInput=():M76DieselSaveInput=>({
 profile:M76_DIESEL_PROFILE,
 binding:{coverageVersionId:'76000000-0000-4000-8000-000000000001',coverageVersionSha256:'a'.repeat(64),entityId:'76000000-0000-4000-8000-000000000002',facilityId:'76000000-0000-4000-8000-000000000003',sourceId:'76000000-0000-4000-8000-000000000004',boundaryDecisionId:'76000000-0000-4000-8000-000000000005'},
 period:M76_DIESEL_PERIOD,
 equipment:{assetId:'QA-GEN-17',identifierBasis:'Fictional retained fixed-generator asset plate QA-GEN-17.',equipmentType:'stationary_emergency_generator',engineType:'compression_ignition',stationaryInstallation:'fixed',controlBasis:'owned_operational_control_full_year',controlExplanation:'Owned and operationally controlled throughout calendar 2025.',fuel:M76_DIESEL_FUEL,fossilFraction:'1.000',fuelGradeBasis:'Fictional supplier documentation identifies entirely fossil Distillate Fuel Oil No. 2.'},
 unit:'US_gallon',quantityGallons:'317.219',
 statement:{issuer:'Independent fictional meter custodian',reference:'QA-17-2025',meterLabel:'QA-ONE-DEVICE-17',statedQuantityGallons:'317.219',description:'Fictional annual generator consumed-fuel reading including all testing.',consumptionBasis:'dedicated_generator_consumed_no_adjustments',measurementBasis:'direct_device_fuel_meter',dedicatedToSingleDevice:true,includesTesting:true,stockDerivedConsumption:false,sharedFuelAllocation:false,consumptionBoundaryExplanation:'One downstream fuel meter measures fuel consumed only by this engine, including maintenance runs.',supplierSpecificHhvAvailable:false,supplierSpecificCarbonAvailable:false,defaultFactorEligibilityExplanation:'The fictional supplier provides neither source-specific HHV nor carbon data.'},
 manualConfirmation:true,discrepancyReason:null,zeroReason:null,expectedVersionId:null,expectedVersionSha256:null,correctionReason:null,idempotencyKey:'76000000-0000-4000-8000-000000000099',
})
