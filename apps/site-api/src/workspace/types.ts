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
}
