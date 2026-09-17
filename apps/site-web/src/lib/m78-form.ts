import {M78_CATEGORIES,M78_GAS_GROUPS,M78_PROCESS_PROFILE,type M78CoverageBinding,type M78ProcessActivity} from '../../../../packages/neuvetra-database/src/m78-contract'

export const processCategoryLabels:Record<typeof M78_CATEGORIES[number],string>={
  mineral_products:'Mineral products and cement',chemical_production:'Chemical production',
  metal_production:'Metal production',oil_and_gas:'Oil and gas operations',
  waste_treatment:'Waste and wastewater treatment',agricultural_biological:'Agriculture and biological sources',
  other_direct_process:'Other direct processes and gas use',
}
export function blankProcessScreen(binding:M78CoverageBinding):M78ProcessActivity {
  return {profile:M78_PROCESS_PROFILE,binding,declaration:{completeness:'unknown',coveredEntityIds:[],coveredFacilityIds:[],allControlledOperationsIncluded:false,discoveryBasis:''},locations:[],assessments:M78_CATEGORIES.map(category=>({rowId:crypto.randomUUID(),category,discoveredSourceId:null,locationRowIds:[],disposition:'unknown',reason:null,evidenceReferences:[]})),gasCoverage:M78_GAS_GROUPS.map(gasGroup=>({gasGroup,state:'unknown',sourceIds:[],discoveredSourceIds:[],locationRowIds:[],reason:null,evidenceReferences:[]})),evidenceStatements:[],manualConfirmation:false}
}
export function toggleId(values:string[],id:string,checked:boolean):string[] {return checked?[...new Set([...values,id])]:values.filter(value=>value!==id)}
