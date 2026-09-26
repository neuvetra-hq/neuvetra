import type { CompanySetup } from './company-setup'
/** Synthetic author test data only. Not an admission, customer record or default company. */
export function createSyntheticCompanySetup(): CompanySetup {
  const entity = '23000000-0000-4000-8000-000000000001'
  const location = '23000000-0000-4000-8000-000000000002'
  return {
    company: { legalName: 'Synthetic Bayline', tradingName: '', countryCode: 'US', regionCode: 'NY', industry: 'Logistics', naics: '', preparerRole: 'Preparer', additionalBusinessActivities: '', otherIndustry: '' },
    reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01', firstInventory: 'unknown', priorInventoryReference: '' },
    boundary: { approach: 'unknown', notes: '', hasParent: 'unknown', parentName: '', includedOperations: '' },
    entities: [{ id: entity, name: 'Synthetic Bayline', ownershipPercent: null, control: 'unknown', inclusion: 'unknown', reason: '' }],
    relationships: [],
    locations: [{ id: location, entityId: entity, facilityId: null, name: 'Synthetic New York depot', countryCode: 'US', regionCode: 'NY', locality: 'New York', purpose: 'Warehouse', occupancy: 'leased', control: 'unknown', inclusion: 'unknown', reason: '', start: null, endExclusive: null, otherEntity: '', operatorDetails: '', startMode: 'unknown', endMode: 'unknown', opened: null }],
    screening: [
      { id: 'stationary', scope: 1, category: 'stationary_combustion', state: 'unknown', reason: '', details: '', locationId: location },
      { id: 'electricity', scope: 2, category: 'purchased_electricity', state: 'yes', reason: '', details: 'Utility invoice still needed', locationId: location },
      { id: 'travel', scope: 3, category: 'business_travel', state: 'no', reason: 'No business travel in the reporting period', details: '', locationId: null },
      { id: 'franchise', scope: 3, category: 'franchises', state: 'not_applicable', reason: 'Company operates no franchises', details: '', locationId: null },
    ],
    changes: [{ id: 'acquisition', category: 'acquisition', state: 'unknown', effectiveDate: null, details: '' }],
    changeNotes: '', review: { acknowledged: false, notes: '' },
  }
}
