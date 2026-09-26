export type SetupScreeningState = 'unknown' | 'yes' | 'no' | 'not_applicable'
export type SetupInclusion = 'unknown' | 'included' | 'excluded'
export interface CompanySetup {
  company: { legalName: string; tradingName: string; countryCode: string | null; regionCode: string | null; industry: string; naics: string; preparerRole: string; additionalBusinessActivities: string; otherIndustry: string }
  reportingPeriod: { start: string | null; endExclusive: string | null; firstInventory: 'unknown' | 'yes' | 'no'; priorInventoryReference: string }
  boundary: { approach: 'unknown' | 'operational_control' | 'financial_control' | 'equity_share'; notes: string; hasParent: 'unknown' | 'yes' | 'no'; parentName: string; includedOperations: string }
  entities: Array<{ id: string; name: string; ownershipPercent: string | null; control: 'unknown' | 'operational_control' | 'financial_control' | 'none'; inclusion: SetupInclusion; reason: string }>
  relationships: Array<{ id: string; parentEntityId: string; childEntityId: string; type: 'ownership' | 'joint_venture' | 'other' | 'unknown'; notes: string }>
  locations: Array<{ id: string; entityId: string | null; facilityId: string | null; name: string; countryCode: string | null; regionCode: string | null; locality: string; purpose: string; occupancy: 'unknown' | 'owned' | 'leased' | 'shared' | 'other'; control: 'unknown' | 'reporting_company' | 'related_entity' | 'landlord' | 'shared' | 'other'; inclusion: SetupInclusion; reason: string; start: string | null; endExclusive: string | null; otherEntity: string; operatorDetails: string; startMode: 'unknown' | 'period_start' | 'specific'; endMode: 'unknown' | 'period_end' | 'specific'; opened: string | null }>
  screening: Array<{ id: string; scope: 1 | 2 | 3; category: string; state: SetupScreeningState; reason: string; details: string; locationId: string | null }>
  changes: Array<{ id: string; category: string; state: 'unknown' | 'yes' | 'no'; effectiveDate: string | null; details: string }>
  changeNotes: string
  review: { acknowledged: boolean; notes: string }
}
export interface CompanySetupSaveInput { idempotencyKey: string; expectedRevision: number; expectedVersionId: string | null; correctionReason: string | null; setup: CompanySetup }
export interface CompanySetupVersion { id: string; companyId: string; revision: number; previousVersionId: string | null; correctionReason: string | null; setup: CompanySetup; payloadSha256: string; createdBy: string; createdAt: string }
export interface CompanySetupView { profile: 'neuvetra.company-setup.v1'; syntheticOnly: true; canManage: boolean; currentVersion: CompanySetupVersion | null; history: Array<Omit<CompanySetupVersion, 'setup'>> }
export interface CompanySetupSaveResult { foundation: CompanySetupView; savedVersion: CompanySetupVersion; replayed: boolean }
