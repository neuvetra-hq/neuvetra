import { evidenceUploadType } from "./evidence-upload-type"
import { sharedFetch } from "./shared-get"
import { serverErrorText, type RequestKind } from "./request-timeout"
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
import { SCOPE3_COLLECTION_KINDS, SCOPE3_LEGACY_KINDS, type Scope3CollectionKind } from "../../../../packages/neuvetra-database/src/scope3-collection-contract"

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

/** `busyText: false` keeps the server's words on every 503 (evidence download: an integrity failure is not "busy"). */
async function request(actor: HostedWorkspaceActor, path: string, init?: RequestInit, kind: RequestKind = "default", busyText = true): Promise<Response> {
  if (!actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  actor.signal?.throwIfAborted()
  // Round 3 lane C (PR-3): GETs shared across screens and retried once on 429; writes clear them.
  const response = await sharedFetch(actor, path, {
    ...init,
    headers: { authorization: `Bearer ${actor.accessToken}`, ...init?.headers },
    cache: "no-store",
    signal: actor.signal,
  }, { kind })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) actor.onUnauthorized?.(response.status)
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => null)
    const error = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "Collection is unavailable."
    const code = value && typeof value === "object" && "code" in value && typeof value.code === "string" ? value.code : null
    // WO-09: a 503 without a specific code reads "Neuvetra is busy — try again in a moment."; status and code are kept.
    throw new CollectionApiError(busyText ? serverErrorText(response.status, code, error) : error, response.status, code)
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
  return (await loadCollectionOverview(companyId, actor)).context
}

/**
 * The collection context and what the server can store (Scope 3 package 2): `scope3` is true only when the server says
 * Scope 3 activity is available (schema 29). An older server, or one at the schema-28 bridge, gives false.
 * I-02: `scope3Kinds` lists the Scope 3 kinds the database stores (the four 0029 kinds at 29, every kind at 30); a server
 * that sends no list (older) offers the four 0029 kinds whenever `scope3` is true. Unknown kind names are ignored.
 * I-08: `scope3Completion` is true only when the server says the database has 0030's payload additions (schema 30).
 */
export async function loadCollectionOverview(companyId: string, actor: HostedWorkspaceActor): Promise<{ context: CollectionContext; scope3: boolean; scope3Kinds: Scope3CollectionKind[]; scope3Completion: boolean }> {
  const value = await json<{ profile: string; context: CollectionContext; capabilities?: { scope3?: { calculations?: unknown; kinds?: unknown; completion?: unknown } } }>(await request(actor, companyPath(companyId)))
  if (!value.context || value.context.companyId !== companyId || !(value.context.setupVersionId === null || UUID.test(value.context.setupVersionId)) || !(value.context.setupRevision === null || Number.isInteger(value.context.setupRevision)) || !Array.isArray(value.context.locations)) throw new Error("The collection context was not recognized.")
  // BF2: optional (older servers omit it); when sent, it lists UUIDs and includes the current version.
  const same = value.context.sameContentSetupVersionIds
  if (same !== undefined && (!Array.isArray(same) || !same.every(id => typeof id === "string" && UUID.test(id)) || new Set(same).size !== same.length
    || (value.context.setupVersionId === null ? same.length !== 0 : !same.includes(value.context.setupVersionId)))) throw new Error("The collection context was not recognized.")
  const locationIds = new Set<string>()
  const date = (value: unknown) => value === null || typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (value.context.boundaryApproach !== undefined && !["unknown", "operational_control", "financial_control", "equity_share"].includes(value.context.boundaryApproach)) throw new Error("The collection context was not recognized.")
  const period = value.context.reportingPeriod
  if (period !== undefined && (!period || !date(period.start) || !date(period.endExclusive))) throw new Error("The collection context was not recognized.")
  for (const location of value.context.locations) {
    if (!location || !UUID.test(location.id) || locationIds.has(location.id) || typeof location.name !== "string" || !["unknown", "included", "excluded"].includes(location.inclusion) || typeof location.control !== "string") throw new Error("The collection context was not recognized.")
    locationIds.add(location.id)
    if ((location.entityId !== undefined && location.entityId !== null && !UUID.test(location.entityId))
      || (location.start !== undefined && !date(location.start)) || (location.endExclusive !== undefined && !date(location.endExclusive))
      || (location.startMode !== undefined && !["unknown", "period_start", "specific"].includes(location.startMode))
      || (location.endMode !== undefined && !["unknown", "period_end", "specific"].includes(location.endMode))) throw new Error("The collection context was not recognized.")
    const entity = location.entity
    if (entity !== undefined && entity !== null && (!UUID.test(entity.id) || entity.id !== location.entityId || !["included", "excluded", "unknown"].includes(entity.inclusion)
      || !["unknown", "operational_control", "financial_control", "none"].includes(entity.control)
      || !(entity.ownershipPercent === null || typeof entity.ownershipPercent === "string" && /^(?:100(?:\.0+)?|(?:[0-9]|[1-9][0-9])(?:\.[0-9]+)?)$/.test(entity.ownershipPercent)))) throw new Error("The collection context was not recognized.")
  }
  const scope3 = value.capabilities?.scope3?.calculations === true
  const listed = value.capabilities?.scope3?.kinds
  const scope3Kinds = !scope3 ? [] : Array.isArray(listed) ? SCOPE3_COLLECTION_KINDS.filter(kind => listed.includes(kind)) : [...SCOPE3_LEGACY_KINDS]
  // I-08: `completion` (schema 30) lets 0029 kinds carry 0030's additions: data quality, and business travel's cabin class and hotel stays.
  const scope3Completion = scope3 && value.capabilities?.scope3?.completion === true
  return { context: value.context, scope3, scope3Kinds, scope3Completion }
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
    headers: { "content-type": evidenceUploadType(file.name, file.type) || "application/octet-stream", "x-neuvetra-original-name": encodeURIComponent(file.name), "x-neuvetra-upload-id": uploadId },
    body: file,
  }, "upload")
  return json<{ receipt: CollectionEvidenceReceipt }>(response)
}

export async function downloadCollectionEvidence(companyId: string, evidenceId: string, actor: HostedWorkspaceActor) {
  // WO-09 QA follow-up: the server's uncoded 503 "Evidence integrity could not be verified." must not read as busy.
  return request(actor, `${companyPath(companyId)}/evidence/${idPath(evidenceId)}/download`, undefined, "default", false)
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
