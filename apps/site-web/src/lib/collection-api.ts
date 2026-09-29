import type {
  CollectionActivityRecord,
  CollectionActivitySaveInput,
  CollectionActivityVersion,
  CollectionContext as DatabaseCollectionContext,
  CollectionEvidenceMetadata,
  CollectionEvidenceReceipt,
  GridLossLineage,
} from "../../../../packages/neuvetra-database/src/collection-contract"
import type { HostedWorkspaceActor } from "./workspace-api"

export type { CollectionActivityRecord, CollectionActivitySaveInput, CollectionActivityVersion, CollectionEvidenceMetadata, CollectionEvidenceReceipt, GridLossLineage }
export type CollectionContext = DatabaseCollectionContext

export interface CollectionZipUtility {
  subregion: string
  utility: string
  eiaId: string
  state: string
  predominantUtility: boolean
}
export interface CollectionZipLookup {
  zip: string
  subregions: string[]
  utilities: CollectionZipUtility[]
  needsUtilityChoice: boolean
  found: boolean
  source: string
}

export class CollectionApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null = null) { super(message) }
  get conflict() { return this.status === 409 }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const companyPath = (companyId: string) => {
  if (!UUID.test(companyId)) throw new Error("Invalid company reference.")
  return `/workspace-api/workspace/${companyId}/collection`
}
const idPath = (id: string) => {
  if (!UUID.test(id)) throw new Error("Invalid collection reference.")
  return id
}

async function request(actor: HostedWorkspaceActor, path: string, init?: RequestInit): Promise<Response> {
  if (!actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  actor.signal?.throwIfAborted()
  const response = await fetch(path, {
    ...init,
    headers: { authorization: `Bearer ${actor.accessToken}`, ...init?.headers },
    cache: "no-store",
    signal: actor.signal,
  })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) actor.onUnauthorized?.()
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => null)
    const error = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "Collection is unavailable."
    const code = value && typeof value === "object" && "code" in value && typeof value.code === "string" ? value.code : null
    throw new CollectionApiError(error, response.status, code)
  }
  return response
}

async function json<T>(response: Response): Promise<T> {
  const value: unknown = await response.json()
  if (!value || typeof value !== "object") throw new Error("The collection response was not recognized.")
  return value as T
}

export async function listCollectionActivities(companyId: string, actor: HostedWorkspaceActor) {
  const value = await json<{ profile: string; records: CollectionActivityRecord[] }>(await request(actor, `${companyPath(companyId)}/activities`))
  if (!Array.isArray(value.records)) throw new Error("The collection response was not recognized.")
  return value.records
}

export async function loadCollectionContext(companyId: string, actor: HostedWorkspaceActor) {
  const value = await json<{ profile: string; context: CollectionContext }>(await request(actor, companyPath(companyId)))
  if (!value.context || value.context.companyId !== companyId || !(value.context.setupVersionId === null || UUID.test(value.context.setupVersionId)) || !(value.context.setupRevision === null || Number.isInteger(value.context.setupRevision)) || !Array.isArray(value.context.locations)) throw new Error("The collection context was not recognized.")
  const locationIds = new Set<string>()
  for (const location of value.context.locations) {
    if (!location || !UUID.test(location.id) || locationIds.has(location.id) || typeof location.name !== "string" || !["unknown", "included", "excluded"].includes(location.inclusion) || typeof location.control !== "string") throw new Error("The collection context was not recognized.")
    locationIds.add(location.id)
  }
  return value.context
}

export async function lookupCollectionZip(companyId: string, zipCode: string, actor: HostedWorkspaceActor) {
  if (!/^\d{5}$/.test(zipCode)) throw new Error("Enter a five-digit ZIP before lookup.")
  const value = await json<{ lookup: CollectionZipLookup }>(await request(actor, `${companyPath(companyId)}/zip-lookup?zip=${encodeURIComponent(zipCode)}`))
  const lookup = value.lookup
  if (!lookup || lookup.zip !== zipCode || typeof lookup.found !== "boolean" || typeof lookup.needsUtilityChoice !== "boolean" || !Array.isArray(lookup.subregions) || !lookup.subregions.every(item => typeof item === "string") || new Set(lookup.subregions).size !== lookup.subregions.length || !Array.isArray(lookup.utilities) || typeof lookup.source !== "string" || lookup.needsUtilityChoice !== (lookup.subregions.length > 1) || lookup.found !== (lookup.utilities.length > 0)) throw new Error("The ZIP lookup response was not recognized.")
  for (const utility of lookup.utilities) {
    if (!utility || typeof utility.subregion !== "string" || typeof utility.utility !== "string" || typeof utility.eiaId !== "string" || typeof utility.state !== "string" || typeof utility.predominantUtility !== "boolean") throw new Error("The ZIP lookup response was not recognized.")
  }
  return lookup
}

export async function saveCollectionActivity(companyId: string, recordId: string, input: CollectionActivitySaveInput, actor: HostedWorkspaceActor) {
  return json<{ record: CollectionActivityRecord; version: CollectionActivityVersion; replayed: boolean }>(await request(actor, `${companyPath(companyId)}/activities/${idPath(recordId)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }))
}

export async function loadCollectionVersion(companyId: string, recordId: string, versionId: string, actor: HostedWorkspaceActor) {
  return json<CollectionActivityVersion>(await request(actor, `${companyPath(companyId)}/activities/${idPath(recordId)}/versions/${idPath(versionId)}`))
}

export async function listCollectionEvidence(companyId: string, actor: HostedWorkspaceActor) {
  const value = await json<{ profile: string; evidence: CollectionEvidenceMetadata[] }>(await request(actor, `${companyPath(companyId)}/evidence`))
  if (!Array.isArray(value.evidence)) throw new Error("The evidence response was not recognized.")
  return value.evidence
}

export async function uploadCollectionEvidence(companyId: string, file: File, uploadId: string, actor: HostedWorkspaceActor) {
  idPath(uploadId)
  const response = await request(actor, `${companyPath(companyId)}/evidence`, {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream", "x-neuvetra-original-name": encodeURIComponent(file.name), "x-neuvetra-upload-id": uploadId },
    body: file,
  })
  return json<{ receipt: CollectionEvidenceReceipt }>(response)
}

export async function downloadCollectionEvidence(companyId: string, evidenceId: string, actor: HostedWorkspaceActor) {
  return request(actor, `${companyPath(companyId)}/evidence/${idPath(evidenceId)}/download`)
}

export async function listGridLossLineages(companyId: string, actor: HostedWorkspaceActor) {
  const value = await json<{ profile: string; lineages: GridLossLineage[] }>(await request(actor, `${companyPath(companyId)}/grid-losses`))
  if (!Array.isArray(value.lineages)) throw new Error("The grid-loss response was not recognized.")
  return value.lineages
}

export async function saveGridLossLineage(companyId: string, electricityRecordId: string, reference: string, notes: string, actor: HostedWorkspaceActor) {
  return json<{ lineage: GridLossLineage }>(await request(actor, `${companyPath(companyId)}/grid-losses/${crypto.randomUUID()}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ electricityRecordId, reference, notes }),
  }))
}
