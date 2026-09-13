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
}
