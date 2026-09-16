import type { M75RosterAsset, M75StatementInput } from '../../../../packages/neuvetra-database/src/m75-contract'

export const newFleetStatement = (): M75StatementInput => ({ issuer: '', reference: '', description: '', discoveryBasis: '', coveredEntityIds: [], completeness: 'unknown', allTripLocationsIncluded: false, assets: [] })
export const newFleetAsset = (): M75RosterAsset => ({ rowId: crypto.randomUUID(), assetId: null, aliases: [], entityId: null, facilityId: null, period: null, mode: 'unknown', vehicleClass: null, modelYear: null, fuel: null, controlBasis: 'unknown', classificationBasis: null, controlExplanation: null })
