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

export type WorkspaceActor = "owner" | "outsider" | "signed_out"

const TOKENS = {
  owner: "m54-synthetic-owner",
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
