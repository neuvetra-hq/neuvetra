export interface CompanyWorkspace {
  id: string
  companyName: string
  countryCode: "US"
  stateCode: "CA"
  facility: {
    id: string
    name: string
    egridSubregion: "CAMX"
  }
  boundary: {
    id: string
    reportingYear: 2023
    approach: "operational_control"
    status: "draft"
    version: 1
  }
}

export interface CreateCompanyWorkspaceInput {
  companyName: "Synthetic Acme, Inc."
  facilityName: "Synthetic California office"
  countryCode: "US"
  stateCode: "CA"
  egridSubregion: "CAMX"
  reportingYear: 2023
  approach: "operational_control"
}

export interface WorkspaceStore {
  create(userId: string, input: CreateCompanyWorkspaceInput): Promise<CompanyWorkspace>
  findById(userId: string, workspaceId: string): Promise<CompanyWorkspace | null>
  canManage(userId: string, workspaceId: string): Promise<boolean>
  ingestBill(userId: string, workspaceId: string, bytes: Uint8Array, sha256: string): Promise<SyntheticBill>
  correctBill(userId: string, workspaceId: string, evidenceId: string, facilityId: string): Promise<SyntheticBill>
  linkBill(userId: string, workspaceId: string, evidenceId: string, boundaryId: string): Promise<SyntheticBill>
  calculateBill(userId: string, workspaceId: string, evidenceId: string, idempotencyKey: string): Promise<SyntheticBill>
  findBill(userId: string, workspaceId: string, evidenceId: string): Promise<SyntheticBill | null>
}

export interface SyntheticBill {
  id: string
  companyId: string
  originalName: "neuvetra-m55-synthetic-electricity-bill.pdf"
  mediaType: "application/pdf"
  byteLength: 4605
  sha256: "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135"
  parserVersion: "m55-fixed-pdf-v1"
  supplierName: "Synthetic Golden State Electric"
  accountLabel: "SYNTHETIC-0001"
  billNumber: "SYN-CA-2023-01"
  servicePeriodStart: "2023-01-01"
  servicePeriodEnd: "2023-01-31"
  sourceLocators: {
    servicePeriod: { startByte: 3119; endByte: 3147 }
    electricityKwh: { startByte: 3384; endByte: 3394 }
  }
  state: "needs_review" | "reviewed" | "linked_draft"
  versions: Array<{
    id: string
    version: number
    facilityId: string | null
    electricityKwh: string
    correctionReason: string | null
  }>
  draftActivity: null | {
    id: string
    billVersionId: string
    quantityMwh: string
    status: "draft"
  }
  draftCalculation: null | {
    id: string
    activityVersionId: string
    billVersionId: string
    evidenceId: string
    facilityId: string
    boundaryId: string
    billVersion: 2
    sourceQuantityKwh: "12346.000"
    normalizedQuantityMwh: "12.346000"
    status: "draft"
    classification: "development_candidate"
    releaseEligible: false
    method: { id: "scope2-location-based-egrid-subregion"; version: "2023-r2-camx-v1"; implementationSha256: string; reviewedEngineSha256: string; authorityRecordSha256: string }
    factor: { id: "epa-egrid2023-r2-camx-total-output"; version: "eGRID2023-revision-2"; candidateSha256: string; sourceSha256: string; sheet: "SRL23"; totalOutputCell: "AI6"; value: "195.0402888" }
    gwpPolicy: { id: "epa-egrid2023-ar5-100-year"; version: "egrid2023-technical-guide-v1"; policySha256: string }
    inputSnapshotSha256: string
    resultPayloadSha256: string
    total: { unrounded: "2407.9674055248"; display: "2407.9674"; unit: "kg CO2e"; rounding: string }
    gasResults: Record<string, unknown>
    reconciliation: { authority: string; componentSum: "2407.8330020304"; componentRoundingDelta: "0.1344034944"; explanation: string }
    trace: Array<Record<string, unknown>>
    billVersionPayloadSha256: string
    createdBy: string
    createdAt: string
    record: Record<string, unknown>
  }
}
