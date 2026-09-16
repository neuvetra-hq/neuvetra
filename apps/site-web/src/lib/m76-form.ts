import type { M76RosterAsset, M76StatementInput, M76MeterRelationship } from '../../../../packages/neuvetra-database/src/m76-contract'

export const newStationaryStatement = (): M76StatementInput => ({ issuer:'', reference:'', description:'', discoveryBasis:'', coveredEntityIds:[], coveredFacilityIds:[], completeness:'unknown', allControlledLocationsIncluded:false, assets:[] })
export const newMeterRelationship = (): M76MeterRelationship => ({ issuer:null, meterLabel:null, measurementBasis:'unknown', dedicatedToSingleDevice:null, explanation:null })
export const newStationaryAsset = (): M76RosterAsset => ({ rowId:crypto.randomUUID(), equipmentId:null, aliases:[], identifierBasis:null, entityId:null, facilityId:null, period:null, equipmentType:'unknown', fuel:null, controlBasis:'unknown', classificationBasis:null, controlExplanation:null, meterRelationship:null })
