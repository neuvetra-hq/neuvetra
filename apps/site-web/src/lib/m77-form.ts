import type { M77SourceActivity, M77CalculatorInput, M77Equipment, M77PopulationDeclaration } from '../../../../packages/neuvetra-database/src/m77-contract'

export const names: Record<keyof M77CalculatorInput['declarations'], string> = {
  full_year_operational_control: 'This company controlled the equipment throughout 2025.',
  california_office_or_distribution: 'This equipment is at the declared California office or distribution site.',
  no_installation_retirement_or_retrofit: 'No installation, retirement or gas conversion occurred during the year.',
  no_stocks_recovery_reuse_or_transfer: 'No stored, recovered, reused or transferred gas is included.',
  complete_all_provider_service_records: 'The annual record covers every service provider and visit.',
  all_known_releases_recorded: 'Every known leak or fire discharge is included.',
  opening_full_charge_verified: 'Evidence establishes full proper charge at the start of January 1.',
  closing_full_charge_verified: 'Evidence establishes full proper charge at the end of December 31.',
}
export const evidenceNames: Record<keyof M77CalculatorInput['evidence'], string> = {
  asset_identity: 'Equipment identity', capacity: 'Proper charge capacity', opening_full_charge: 'Opening full charge',
  closing_full_charge: 'Closing full charge', annual_contractor_record: 'Complete annual contractor record',
}
export const equipmentChoices: [M77Equipment, string][] = [['fixed_hvac','Fixed air conditioning'],['fixed_refrigeration','Fixed refrigeration'],['fixed_fire_suppression','Fixed fire suppression'],['portable_fire_suppression','Portable fire suppression'],['mobile_hvac','Vehicle air conditioning — unsupported'],['mobile_refrigeration','Refrigerated transport — unsupported'],['other','Other equipment'],['unknown','Unknown equipment']]
export function blankCalculator(activity: M77SourceActivity): M77CalculatorInput {
  return {year:2025,asset_id:activity.assetId,gas:activity.gas??'',equipment:activity.equipment,unit:'kg',opening_date:'2025-01-01',closing_date:'2025-12-31',opening_capacity:activity.capacityKg??'',closing_capacity:activity.capacityKg??'',declarations:Object.fromEntries(Object.keys(names).map(k=>[k,false])) as M77CalculatorInput['declarations'],evidence:{asset_identity:'',capacity:'',opening_full_charge:'',closing_full_charge:'',annual_contractor_record:''},refills:[],releases:[],zero_activity_evidence:null,uncertainty:''}
}
export const blankPopulation = ():M77PopulationDeclaration=>({issuer:'',reference:'',description:'',discoveryBasis:'',completeness:'unknown',coveredEntityIds:[],coveredFacilityIds:[],controlledFleetChecked:false,allControlledLocationsIncluded:false,assets:[]})
