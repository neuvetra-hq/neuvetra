import {
  COLLECTION_EVIDENCE_BUCKET,
  COLLECTION_EVIDENCE_MAX_BYTES,
  COLLECTION_PROFILE,
  validateCollectionSaveInput,
  type CollectionActivityRecord,
  type CollectionActivityVersion,
  type CollectionContext,
  type CollectionEvidenceMetadata,
  type CollectionEvidenceReceipt,
  type CollectionEvidenceUploadIntent,
  type GridLossLineage,
} from "@neuvetra/database"
import { extractBearerToken, type AuthenticatedUser } from "../lib/auth"
import { lookupCollectionZip } from "./collection-zip"
import type { Scope2Lookup } from "../calculation/scope2-authority"

const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const UUID = new RegExp(`^${UUID_SOURCE}$`, "i")
const ROUTE = new RegExp(`^/workspace/(${UUID_SOURCE})/collection(?:/(activities|grid-losses|evidence|zip-lookup)(?:/(${UUID_SOURCE})(?:/(versions|download)(?:/(${UUID_SOURCE}))?)?)?)?$`, "i")
const ACCEPTED_MEDIA_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

export interface CollectionRouteDatabase {
  findCollectionContext(userId: string, companyId: string): Promise<CollectionContext | null>
  findCollectionActivities(userId: string, companyId: string): Promise<CollectionActivityRecord[]>
  findCollectionActivityVersion(userId: string, companyId: string, recordId: string, versionId: string): Promise<CollectionActivityVersion | null>
  saveCollectionActivity(userId: string, companyId: string, recordId: string, input: unknown): Promise<{ record: CollectionActivityRecord; version: CollectionActivityVersion; replayed: boolean }>
  findCollectionEvidence(userId: string, companyId: string): Promise<CollectionEvidenceMetadata[]>
  reserveCollectionEvidenceUpload(userId: string, companyId: string, input: unknown): Promise<CollectionEvidenceUploadIntent>
  registerCollectionEvidence(userId: string, companyId: string, input: unknown): Promise<CollectionEvidenceReceipt>
  markCollectionEvidenceRegistrationFailed(userId: string, companyId: string, uploadId: string): Promise<{ recoveryId: string }>
  findDownloadableCollectionEvidence(userId: string, companyId: string, evidenceId: string): Promise<{ bucket: typeof COLLECTION_EVIDENCE_BUCKET; objectKey: string; sha256: string; mediaType: string; byteLength: number } | null>
  findGridLossLineage(userId: string, companyId: string): Promise<GridLossLineage[]>
  createGridLossLineage(userId: string, companyId: string, input: { id: string; electricityRecordId: string; reference: string; notes: string }): Promise<GridLossLineage>
}

export interface CollectionEvidenceStorage {
  put(token: string, bucket: typeof COLLECTION_EVIDENCE_BUCKET, objectKey: string, bytes: Uint8Array<ArrayBuffer>, mediaType: string): Promise<void>
  get(token: string, bucket: typeof COLLECTION_EVIDENCE_BUCKET, objectKey: string): Promise<Uint8Array<ArrayBuffer>>
}

export interface CollectionRouteDeps {
  database: CollectionRouteDatabase
  evidenceStorage: CollectionEvidenceStorage
  validateUser: (token: string) => Promise<AuthenticatedUser | null>
  origin: string
  lookupZip?: (zip: string) => Promise<Scope2Lookup>
}

class RequestProblem extends Error {
  constructor(readonly status: number, readonly publicMessage: string, readonly publicCode?: string) { super(publicMessage) }
}

const respond = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } })
const fail = (status: number, error: string, code?: string) => respond(status, { error, ...(code ? { code } : {}) })

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer))].map(value => value.toString(16).padStart(2, "0")).join("")
}

function signatureMatches(bytes: Uint8Array, mediaType: string): boolean {
  const prefix = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  if (mediaType === "application/pdf") return prefix(0x25, 0x50, 0x44, 0x46, 0x2d)
  if (mediaType === "image/jpeg") return prefix(0xff, 0xd8, 0xff)
  if (mediaType === "image/png") return prefix(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
  if (mediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return prefix(0x50, 0x4b, 0x03, 0x04)
  if (mediaType === "text/csv") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)
    } catch { return false }
  }
  return false
}

function validateElectricityLookup(activity: ReturnType<typeof validateCollectionSaveInput>["activity"], lookup: Scope2Lookup): void {
  if (activity.kind !== "electricity") return
  const payload = activity.payload
  if (!lookup.found || lookup.zip !== payload.zip || !lookup.subregions.includes(payload.subregion)) throw new RequestProblem(422, "Choose a grid subregion listed for this ZIP.", "zip_subregion_mismatch")
  if (lookup.needsUtilityChoice && !payload.utilityEiaId) throw new RequestProblem(422, "Choose a utility for this ZIP.", "utility_required")
  if (payload.utilityEiaId && !lookup.utilities.some(row => row.eiaId === payload.utilityEiaId && row.subregion === payload.subregion)) throw new RequestProblem(422, "Choose a utility listed for this ZIP and subregion.", "utility_mismatch")
}

async function readBoundedBytes(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const claimed = request.headers.get("content-length")
  if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > COLLECTION_EVIDENCE_MAX_BYTES)) throw new RequestProblem(413, "Evidence file is too large.")
  if (!request.body) throw new RequestProblem(422, "Evidence file is empty.")
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > COLLECTION_EVIDENCE_MAX_BYTES) { await reader.cancel(); throw new RequestProblem(413, "Evidence file is too large.") }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  if (length === 0) throw new RequestProblem(422, "Evidence file is empty.")
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

function originalName(request: Request): string {
  const encoded = request.headers.get("x-neuvetra-original-name")
  if (!encoded || encoded.length > 1024) throw new RequestProblem(422, "Evidence file name is required.")
  let decoded: string
  try { decoded = decodeURIComponent(encoded) } catch { throw new RequestProblem(422, "Evidence file name is invalid.") }
  decoded = decoded.normalize("NFC")
  if (!decoded.trim() || decoded.length > 255 || /[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(decoded)) throw new RequestProblem(422, "Evidence file name is invalid.")
  return decoded
}

function uploadId(request: Request): string {
  const supplied = request.headers.get("x-neuvetra-upload-id")
  if (supplied && !UUID.test(supplied)) throw new RequestProblem(422, "Evidence upload ID is invalid.")
  return supplied?.toLowerCase() ?? crypto.randomUUID()
}

async function jsonBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") throw new RequestProblem(415, "JSON content type required.")
  try { return JSON.parse(await request.text()) } catch { throw new RequestProblem(422, "Invalid JSON.") }
}

function validateGridLoss(value: unknown, id: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestProblem(422, "Invalid grid-loss lineage.")
  const row = value as Record<string, unknown>
  if (Object.keys(row).sort().join("|") !== "electricityRecordId|notes|reference") throw new RequestProblem(422, "Invalid grid-loss lineage.")
  if (!UUID.test(String(row.electricityRecordId ?? "")) || typeof row.reference !== "string" || row.reference.length > 1000 || typeof row.notes !== "string" || row.notes.length > 4000) throw new RequestProblem(422, "Invalid grid-loss lineage.")
  return { id, electricityRecordId: row.electricityRecordId as string, reference: row.reference, notes: row.notes }
}

function mappedError(error: unknown): Response {
  if (error instanceof RequestProblem) return fail(error.status, error.publicMessage, error.publicCode)
  const code = (error as { code?: string }).code
  if (code === "42501") return fail(404, "Collection resource not found.")
  if (["23505", "40001", "23P01"].includes(code ?? "")) return fail(409, "Collection record changed. Refresh and try again.", "revision_conflict")
  if (code === "54000") return fail(422, "Collection history capacity reached.", "history_limit")
  if (["22023", "22P02", "22007", "22008", "22003", "23514", "23503", "23502"].includes(code ?? "")) return fail(422, "Invalid or unsupported collection record.")
  return fail(503, "Collection service is unavailable.")
}

/** Engine-independent collection routes. They persist inputs and lineage only; they never calculate emissions. */
export function createCollectionRoutes(deps: CollectionRouteDeps) {
  return async (request: Request): Promise<Response> => {
    const match = ROUTE.exec(new URL(request.url).pathname)
    if (!match) return fail(404, "Collection resource not found.")
    const companyId = match[1]!.toLowerCase()
    const collection = match[2]?.toLowerCase() ?? null
    const resourceId = match[3]?.toLowerCase() ?? null
    const operation = match[4]?.toLowerCase() ?? null
    const versionId = match[5]?.toLowerCase() ?? null
    const origin = request.headers.get("origin")
    if ((origin && origin !== deps.origin) || (request.method !== "GET" && origin !== deps.origin)) return fail(403, "Forbidden.")
    const token = extractBearerToken(request.headers)
    if (!token || token.length > 8192) return fail(401, "Authentication required.")
    let actor: AuthenticatedUser | null
    try { actor = await deps.validateUser(token) } catch { return fail(503, "Authentication is unavailable.") }
    if (!actor) return fail(401, "Authentication required.")

    try {
      const context = await deps.database.findCollectionContext(actor.id, companyId)
      if (!context) return fail(404, "Collection resource not found.")
      if (!collection) {
        if (request.method !== "GET") return fail(405, "Method not allowed.")
        return respond(200, { profile: COLLECTION_PROFILE, context, capabilities: { calculations: false, zipLookup: "available", scope3: { gridLossLineage: true, calculations: false } } })
      }

      if (collection === "zip-lookup") {
        if (resourceId || operation || versionId || request.method !== "GET") return fail(405, "Method not allowed.")
        const params = new URL(request.url).searchParams
        const zip = params.get("zip")
        if (params.size !== 1 || !zip || !/^\d{5}$/.test(zip)) throw new RequestProblem(422, "Enter a five-digit ZIP.")
        return respond(200, { profile: COLLECTION_PROFILE, lookup: await (deps.lookupZip ?? lookupCollectionZip)(zip) })
      }

      if (collection === "activities") {
        if (!resourceId) {
          if (request.method !== "GET") return fail(405, "Method not allowed.")
          return respond(200, { profile: COLLECTION_PROFILE, records: await deps.database.findCollectionActivities(actor.id, companyId) })
        }
        if (operation === "versions" && versionId) {
          if (request.method !== "GET") return fail(405, "Method not allowed.")
          const version = await deps.database.findCollectionActivityVersion(actor.id, companyId, resourceId, versionId)
          return version ? respond(200, version) : fail(404, "Collection activity version not found.")
        }
        if (operation || versionId || request.method !== "POST") return fail(405, "Method not allowed.")
        const input = await jsonBody(request)
        let validated: ReturnType<typeof validateCollectionSaveInput>
        try { validated = validateCollectionSaveInput(input) } catch { throw new RequestProblem(422, "Invalid or unsupported collection record.") }
        if (validated.activity.kind === "electricity") {
          const lookup = await (deps.lookupZip ?? lookupCollectionZip)(validated.activity.payload.zip)
          validateElectricityLookup(validated.activity, lookup)
        }
        const saved = await deps.database.saveCollectionActivity(actor.id, companyId, resourceId, input)
        return respond(saved.replayed ? 200 : 201, saved)
      }

      if (collection === "grid-losses") {
        if (!resourceId) {
          if (request.method !== "GET") return fail(405, "Method not allowed.")
          return respond(200, { profile: COLLECTION_PROFILE, lineages: await deps.database.findGridLossLineage(actor.id, companyId), calculations: false })
        }
        if (operation || versionId || request.method !== "POST") return fail(405, "Method not allowed.")
        const saved = await deps.database.createGridLossLineage(actor.id, companyId, validateGridLoss(await jsonBody(request), resourceId))
        return respond(201, { lineage: saved })
      }

      if (!resourceId) {
        if (request.method === "GET") return respond(200, { profile: COLLECTION_PROFILE, evidence: await deps.database.findCollectionEvidence(actor.id, companyId) })
        if (request.method !== "POST") return fail(405, "Method not allowed.")
        const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? ""
        if (!ACCEPTED_MEDIA_TYPES.has(mediaType)) throw new RequestProblem(415, "Unsupported evidence file type.")
        const name = originalName(request)
        const id = uploadId(request)
        const bytes = await readBoundedBytes(request)
        if (!signatureMatches(bytes, mediaType)) throw new RequestProblem(422, "Evidence file does not match its declared type.", "file_type_mismatch")
        const digest = await sha256(bytes)
        const evidence = await deps.database.findCollectionEvidence(actor.id, companyId)
        const duplicate = evidence.find(item => item.sha256 === digest && item.byteLength === bytes.byteLength)
        const objectKey = duplicate?.objectKey ?? `${companyId}/original/${id}`
        const upload = { uploadId: id, evidenceId: id, objectKey, originalName: name, mediaType, byteLength: bytes.byteLength, sha256: digest }
        const intent = await deps.database.reserveCollectionEvidenceUpload(actor.id, companyId, upload)
        if (intent.uploadId !== id || intent.evidenceId !== id || intent.objectKey !== objectKey || intent.bucket !== COLLECTION_EVIDENCE_BUCKET) throw new Error("Evidence upload intent could not be verified.")
        if (!duplicate) await deps.evidenceStorage.put(token, intent.bucket, intent.objectKey, bytes, mediaType)
        let receipt: CollectionEvidenceReceipt
        try { receipt = await deps.database.registerCollectionEvidence(actor.id, companyId, upload) }
        catch (registrationError) {
          // The committed intent makes an uploaded-but-unregistered object
          // discoverable. A best-effort durable recovery row must not replace
          // the original registration outcome when the database is unavailable.
          if (!duplicate) try { await deps.database.markCollectionEvidenceRegistrationFailed(actor.id, companyId, id) } catch {}
          throw registrationError
        }
        return respond(receipt.reused ? 200 : 201, { receipt })
      }

      if (operation !== "download" || versionId || request.method !== "GET") return fail(405, "Method not allowed.")
      const locator = await deps.database.findDownloadableCollectionEvidence(actor.id, companyId, resourceId)
      if (!locator) {
        const exists = (await deps.database.findCollectionEvidence(actor.id, companyId)).some(item => item.id === resourceId)
        return exists ? fail(423, "Evidence is not available until quarantine review passes.", "quarantine_pending") : fail(404, "Collection evidence not found.")
      }
      const bytes = await deps.evidenceStorage.get(token, locator.bucket, locator.objectKey)
      if (bytes.byteLength !== locator.byteLength || await sha256(bytes) !== locator.sha256) return fail(503, "Evidence integrity could not be verified.")
      return new Response(bytes.buffer, { status: 200, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", "content-type": locator.mediaType, "content-length": String(bytes.byteLength), "x-content-sha256": locator.sha256, "content-disposition": `attachment; filename="evidence-${resourceId}"` } })
    } catch (error) { return mappedError(error) }
  }
}
