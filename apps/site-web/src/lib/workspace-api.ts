export interface CompanyWorkspace {
  id: string
  companyName: "Synthetic Acme, Inc."
  countryCode: "US"
  stateCode: "CA"
  facility: {
    id: string
    name: "Synthetic California office"
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

export type WorkspaceActor = "owner" | "admin" | "member" | "outsider" | "signed_out"

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

const TOKENS = {
  owner: "m54-synthetic-owner",
  admin: "m55-synthetic-admin",
  member: "m55-synthetic-member",
  outsider: "m54-synthetic-outsider",
} as const

const input = {
  companyName: "Synthetic Acme, Inc.",
  facilityName: "Synthetic California office",
  countryCode: "US",
  stateCode: "CA",
  egridSubregion: "CAMX",
  reportingYear: 2023,
  approach: "operational_control",
} as const

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).sort().join("|") === [...keys].sort().join("|")
}

function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function decodeWorkspace(value: unknown): CompanyWorkspace {
  if (!object(value) || !exactKeys(value, ["id", "companyName", "countryCode", "stateCode", "facility", "boundary"])) throw new Error("The workspace response was not recognized.")
  if (!uuid(value.id) || value.companyName !== input.companyName || value.countryCode !== "US" || value.stateCode !== "CA") throw new Error("The workspace response was not recognized.")
  if (!object(value.facility) || !exactKeys(value.facility, ["id", "name", "egridSubregion"]) || !uuid(value.facility.id) || value.facility.name !== input.facilityName || value.facility.egridSubregion !== "CAMX") throw new Error("The workspace response was not recognized.")
  if (!object(value.boundary) || !exactKeys(value.boundary, ["id", "reportingYear", "approach", "status", "version"]) || !uuid(value.boundary.id) || value.boundary.reportingYear !== 2023 || value.boundary.approach !== "operational_control" || value.boundary.status !== "draft" || value.boundary.version !== 1) throw new Error("The workspace response was not recognized.")
  return value as unknown as CompanyWorkspace
}

export function decodeSyntheticBill(value: unknown): SyntheticBill {
  if (!object(value) || !exactKeys(value, ["id", "companyId", "originalName", "mediaType", "byteLength", "sha256", "parserVersion", "supplierName", "accountLabel", "billNumber", "servicePeriodStart", "servicePeriodEnd", "sourceLocators", "state", "versions", "draftActivity"])) throw new Error("The bill response was not recognized.")
  if (!uuid(value.id) || !uuid(value.companyId) || value.originalName !== "neuvetra-m55-synthetic-electricity-bill.pdf" || value.mediaType !== "application/pdf" || value.byteLength !== 4605 || value.sha256 !== "0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135" || value.parserVersion !== "m55-fixed-pdf-v1" || value.supplierName !== "Synthetic Golden State Electric" || value.accountLabel !== "SYNTHETIC-0001" || value.billNumber !== "SYN-CA-2023-01" || value.servicePeriodStart !== "2023-01-01" || value.servicePeriodEnd !== "2023-01-31" || !["needs_review", "reviewed", "linked_draft"].includes(String(value.state)) || !Array.isArray(value.versions)) throw new Error("The bill response was not recognized.")
  if (!object(value.sourceLocators) || !exactKeys(value.sourceLocators, ["servicePeriod", "electricityKwh"])) throw new Error("The bill response was not recognized.")
  for (const [locator, startByte, endByte] of [[value.sourceLocators.servicePeriod, 3119, 3147], [value.sourceLocators.electricityKwh, 3384, 3394]] as const) if (!object(locator) || !exactKeys(locator, ["startByte", "endByte"]) || locator.startByte !== startByte || locator.endByte !== endByte) throw new Error("The bill response was not recognized.")
  for (const version of value.versions) {
    if (!object(version) || !exactKeys(version, ["id", "version", "facilityId", "electricityKwh", "correctionReason"]) || !uuid(version.id) || !Number.isInteger(version.version) || (version.facilityId !== null && !uuid(version.facilityId)) || typeof version.electricityKwh !== "string" || (version.correctionReason !== null && typeof version.correctionReason !== "string")) throw new Error("The bill response was not recognized.")
  }
  if (value.draftActivity !== null && (!object(value.draftActivity) || !exactKeys(value.draftActivity, ["id", "billVersionId", "quantityMwh", "status"]) || !uuid(value.draftActivity.id) || !uuid(value.draftActivity.billVersionId) || typeof value.draftActivity.quantityMwh !== "string" || value.draftActivity.status !== "draft")) throw new Error("The bill response was not recognized.")
  const versions = value.versions as Array<Record<string, unknown>>
  if (versions.length < 1 || versions.length > 2 || versions[0]?.version !== 1 || versions[0]?.facilityId !== null || versions[0]?.electricityKwh !== "12345.000" || versions[0]?.correctionReason !== null) throw new Error("The bill response was not recognized.")
  if (value.state === "needs_review" && (versions.length !== 1 || value.draftActivity !== null)) throw new Error("The bill response was not recognized.")
  if ((value.state === "reviewed" || value.state === "linked_draft") && (versions.length !== 2 || versions[1]?.version !== 2 || !uuid(versions[1]?.facilityId) || versions[1]?.electricityKwh !== "12346.000" || versions[1]?.correctionReason !== "Synthetic review exercise")) throw new Error("The bill response was not recognized.")
  if (value.state === "reviewed" && value.draftActivity !== null) throw new Error("The bill response was not recognized.")
  if (value.state === "linked_draft" && (!object(value.draftActivity) || value.draftActivity.billVersionId !== versions[1]?.id || value.draftActivity.quantityMwh !== "12.346000")) throw new Error("The bill response was not recognized.")
  return value as unknown as SyntheticBill
}

function authorization(actor: WorkspaceActor, contentType = false) {
  const headers = new Headers()
  if (contentType) headers.set("content-type", "application/json")
  if (actor !== "signed_out") headers.set("authorization", `Bearer ${TOKENS[actor]}`)
  return headers
}

async function decodeResponse(response: Response) {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (object(body) && typeof body.error === "string") throw new Error(body.error)
    throw new Error("The workspace is unavailable.")
  }
  return decodeWorkspace(body)
}

async function decodeBillResponse(response: Response) {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (object(body) && typeof body.error === "string") throw new Error(body.error)
    throw new Error("The bill evidence is unavailable.")
  }
  return decodeSyntheticBill(body)
}

export async function createSyntheticWorkspace(actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const response = await fetcher("/workspace-api/workspace", {
    method: "POST",
    headers: authorization(actor, true),
    body: JSON.stringify(input),
  })
  return decodeResponse(response)
}

export async function revisitSyntheticWorkspace(workspaceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId)) throw new Error("The saved workspace identifier is invalid.")
  const response = await fetcher(`/workspace-api/workspace/${workspaceId}`, { headers: authorization(actor) })
  return decodeResponse(response)
}

export async function uploadSyntheticBill(workspaceId: string, actor: WorkspaceActor, file: File, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId)) throw new Error("The saved workspace identifier is invalid.")
  const body = new FormData()
  body.set("file", file)
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspaceId}/bills`, { method: "POST", headers: authorization(actor), body }))
}

export async function revisitSyntheticBill(workspaceId: string, evidenceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  if (!uuid(workspaceId) || !uuid(evidenceId)) throw new Error("The saved bill identifier is invalid.")
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspaceId}/bills/${evidenceId}`, { headers: authorization(actor) }))
}

export async function correctSyntheticBill(workspace: CompanyWorkspace, evidenceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const current = await revisitSyntheticBill(workspace.id, evidenceId, actor, fetcher)
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspace.id}/bills/${evidenceId}/corrections`, {
    method: "POST", headers: authorization(actor, true),
    body: JSON.stringify({ facilityId: workspace.facility.id, priorVersionId: current.versions[0]!.id, electricityKwh: "12346.000", reason: "Synthetic review exercise" }),
  }))
}

export async function linkSyntheticBill(workspace: CompanyWorkspace, evidenceId: string, actor: WorkspaceActor, fetcher: typeof fetch = fetch) {
  const current = await revisitSyntheticBill(workspace.id, evidenceId, actor, fetcher)
  return decodeBillResponse(await fetcher(`/workspace-api/workspace/${workspace.id}/bills/${evidenceId}/link`, {
    method: "POST", headers: authorization(actor, true), body: JSON.stringify({ boundaryId: workspace.boundary.id, billVersionId: current.versions.find((version) => version.version === 2)?.id }),
  }))
}
