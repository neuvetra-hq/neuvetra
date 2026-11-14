import { MAX_SCOPE3_LINES } from "./scope3-results-routes"
import { isActiveScope12Record, MAX_ACTIVE_SCOPE12_RECORDS, RECORD_LIMIT_SAVE_TEXT } from "./collection-results-routes"
import { SCOPE3_CAPACITY_TEXT } from "../../../../packages/neuvetra-database/src/scope3-text"
import {
  isScope3CollectionKind,
  scope3ActivityAvailable,
  scope3KindsAvailable,
  scope12PayloadAvailable,
  scope3OverlapConfirmationAvailable,
  STAGING_INSTRUMENT_IDENTITY_SCHEMA_VERSION,
  STAGING_INTEGRITY_GUARDS_SCHEMA_VERSION,
  STAGING_SCOPE3_COMPLETION_SCHEMA_VERSION,
  STAGING_SCOPE3_SCHEMA_VERSION,
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
  /**
   * The database schema version (Scope 3 package 2, D5; Scope 3 completion I-02). A Scope 3 save that needs a higher
   * schema than the database has is refused here with 503, before any SQL runs, never with a 422 from the database: the
   * 0029 kinds need 29; the 0030 kinds, `dataQuality`, the business travel v2 keys and room-night need 30. Omitted: no
   * Scope 3 kind is available.
   */
  schemaVersion?: () => Promise<number>
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
  if (supplied !== null && !UUID.test(supplied)) throw new RequestProblem(422, "Evidence upload ID is invalid.")
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
  return { id, electricityRecordId: (row.electricityRecordId as string).toLowerCase(), reference: row.reference, notes: row.notes }
}

/** BF-08 (BL-07): said to a member who can read the company but not change it. */
const READ_ONLY_TEXT = "You can view this company’s records but not change them."
/** BF-08 (BL-05): a first save whose ID already belongs to another company. The ID is not said to exist, only that it cannot be used. */
const RECORD_ID_UNAVAILABLE_TEXT = "This record ID can’t be used. Save again to use a new one."

/**
 * `readable`: this request already read the company as the actor (RLS admits only a member), so a 42501 on a write means the
 * actor may view the company but not change it: 403 read_only. Without a readable company (or on a read) 42501 stays 404, the
 * same answer as for a company that does not exist, so a 403 is never said to someone outside the company.
 */
function mappedError(error: unknown, readable = false): Response {
  if (error instanceof RequestProblem) return fail(error.status, error.publicMessage, error.publicCode)
  const code = (error as { code?: string }).code
  if (code === "42501") return readable ? fail(403, READ_ONLY_TEXT, "read_only") : fail(404, "Collection resource not found.")
  // BF-18 (0032) raises 23N32 for a receipt mismatch (an idempotency key reused for different content); until BF-28 gives it
  // its own answer it gets exactly the answer 23505 got before 0032, so a save answers the same at schema 31 and 32.
  if (["23505", "23N32", "40001", "23P01"].includes(code ?? "")) return fail(409, "Collection record changed. Refresh and try again.", "revision_conflict")
  if (code === "54000") return fail(422, "Collection history capacity reached.", "history_limit")
  // Round 3 (owner decision 7, EN-3): 0030 refuses a Scope 3 save that adds a line past the 3,000-line cap.
  if (code === "54N30") return fail(409, SCOPE3_CAPACITY_TEXT.lineBudgetSaveRefused(MAX_SCOPE3_LINES), "line_budget_exceeded")
  // BF-09 (0031): the database's own Scope 1 and 2 cap, checked under the company lock (also for a withdrawn record made active
  // again, and for saves that raced past the route's check below): the same answer as that check.
  if (code === "54N31") return fail(422, RECORD_LIMIT_SAVE_TEXT, "record_limit_reached")
  // DB-01 (Scope 3 package 2 r2): text the database can't store (22P05, 22021) is invalid input, never an outage.
  if (["22023", "22P02", "22P05", "22021", "22007", "22008", "22003", "23514", "23503", "23502"].includes(code ?? "")) return fail(422, "Invalid or unsupported collection record.")
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

    // BF-08: set once the actor's read of this company succeeded (the database admits only a member), see mappedError.
    let readable = false
    try {
      const context = await deps.database.findCollectionContext(actor.id, companyId)
      if (!context) return fail(404, "Collection resource not found.")
      readable = true
      if (!collection) {
        if (request.method !== "GET") return fail(405, "Method not allowed.")
        const schema = await (deps.schemaVersion?.() ?? 0)
        // `kinds`: the Scope 3 kinds this database stores; `completion`: the 0030 payload features (data quality, travel v2).
        // `duplicateConfirmation` (BF-09): the database stores a Scope 1 or 2 payload's `duplicateConfirmedDistinct` (schema 31).
        // `instrumentIdentity` and `scope3.overlapConfirmation` (BF-18): the database stores an instrument's `instrumentId`,
        // `registry` and `faceMwh` (BF-11) and a Scope 3 payload's `scope2OverlapConfirmedDistinct` (BF-17) (schema 32).
        const round2 = schema >= STAGING_INSTRUMENT_IDENTITY_SCHEMA_VERSION
        return respond(200, { profile: COLLECTION_PROFILE, context, capabilities: { calculations: false, zipLookup: "available", duplicateConfirmation: schema >= STAGING_INTEGRITY_GUARDS_SCHEMA_VERSION, instrumentIdentity: round2, scope3: { gridLossLineage: true, calculations: schema >= STAGING_SCOPE3_SCHEMA_VERSION, kinds: scope3KindsAvailable(schema), completion: schema >= STAGING_SCOPE3_COMPLETION_SCHEMA_VERSION, overlapConfirmation: round2 } } })
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
        if (isScope3CollectionKind(validated.activity.kind)) {
          const schema = await (deps.schemaVersion?.() ?? 0)
          if (schema < STAGING_SCOPE3_SCHEMA_VERSION) throw new RequestProblem(503, "Scope 3 activity is not available yet.", "scope3_unavailable")
          if (!scope3ActivityAvailable(validated.activity, schema)) throw new RequestProblem(503, "This record type needs database schema 30.", "scope3_schema_30_required")
          // BF-18: below schema 32 the database refuses `scope2OverlapConfirmedDistinct`; refuse first, with the answer saves got before 0032.
          if (!scope3OverlapConfirmationAvailable(validated.activity.payload, schema)) throw new RequestProblem(422, "Invalid or unsupported collection record.")
        } else if (!scope12PayloadAvailable(validated.activity.payload, 0) && !scope12PayloadAvailable(validated.activity.payload, await (deps.schemaVersion?.() ?? 0))) {
          // BF-09: below schema 31 the database refuses `duplicateConfirmedDistinct`; refuse first, with the answer saves got before 0031.
          // BF-18: the same for an instrument's `instrumentId`, `registry` or `faceMwh` below schema 32.
          throw new RequestProblem(422, "Invalid or unsupported collection record.")
        }
        if (validated.activity.kind === "electricity") {
          const lookup = await (deps.lookupZip ?? lookupCollectionZip)(validated.activity.payload.zip)
          validateElectricityLookup(validated.activity, lookup)
        }
        // BF-03: a save that makes a Scope 1 or 2 record active is refused once 400 are active (Results refuses to calculate more):
        // a new record, and (BF-03b, the same rule as 0031's 54N31) a withdrawn record corrected back to active. Corrections that
        // keep a record active and withdrawals are always allowed. At schema 30 this is the only check; at 31 the database
        // repeats it under the company lock, which also closes the concurrent-save race this read cannot see.
        if (!isScope3CollectionKind(validated.activity.kind) && validated.activity.state === "active") {
          const existing = await deps.database.findCollectionActivities(actor.id, companyId)
          const saved = existing.find(record => record.id.toLowerCase() === resourceId)
          // A replay of an already-saved first version is not a new record; a correction of a record that is active now is not
          // a new active record either (an exact replay of a reactivation finds the record active and is not counted twice).
          // F6 (QA of PR #63): a correction based on a version that is no longer current is a revision conflict, not a new
          // active record: it is left to the database, which answers 409 (refresh), whatever the count.
          const activates = validated.expectedRevision === 0 ? saved === undefined
            : saved !== undefined && saved.currentVersion.activity.state === "withdrawn" && saved.currentVersion.id.toLowerCase() === validated.expectedVersionId?.toLowerCase() && saved.currentVersion.revision === validated.expectedRevision
          if (activates && existing.filter(isActiveScope12Record).length >= MAX_ACTIVE_SCOPE12_RECORDS) throw new RequestProblem(422, RECORD_LIMIT_SAVE_TEXT, "record_limit_reached")
        }
        let saved: Awaited<ReturnType<typeof deps.database.saveCollectionActivity>>
        try { saved = await deps.database.saveCollectionActivity(actor.id, companyId, resourceId, input) }
        catch (error) {
          // BF-08 (BL-05): a unique violation on a FIRST save is the record ID, held by another company, unless this company has just
          // saved it itself (two saves racing), which is a true revision conflict.
          // BF-18: 0032's 23N32 (receipt mismatch) takes this branch exactly as 23505 did before 0032, until BF-28.
          if (validated.expectedRevision === 0 && ["23505", "23N32"].includes((error as { code?: string }).code ?? "") && !(await deps.database.findCollectionActivities(actor.id, companyId)).some(record => record.id.toLowerCase() === resourceId))
            throw new RequestProblem(409, RECORD_ID_UNAVAILABLE_TEXT, "record_id_unavailable")
          throw error
        }
        return respond(saved.replayed ? 200 : 201, saved)
      }

      if (collection === "grid-losses") {
        if (!resourceId) {
          if (request.method !== "GET") return fail(405, "Method not allowed.")
          return respond(200, { profile: COLLECTION_PROFILE, lineages: await deps.database.findGridLossLineage(actor.id, companyId), calculations: false })
        }
        if (operation || versionId || request.method !== "POST") return fail(405, "Method not allowed.")
        const lineage = validateGridLoss(await jsonBody(request), resourceId)
        let saved: Awaited<ReturnType<typeof deps.database.createGridLossLineage>>
        try { saved = await deps.database.createGridLossLineage(actor.id, companyId, lineage) }
        catch (error) {
          // BF-08 (BL-05): the table has two unique keys, the global lineage ID and (company, electricity record). If this company already
          // holds a lineage with this ID or for this electricity record, the conflict is its own (a second link to the same record from
          // a stale list or another tab) and keeps revision_conflict; only an ID held by another company is record_id_unavailable.
          if ((error as { code?: string }).code === "23505") {
            const own = await deps.database.findGridLossLineage(actor.id, companyId)
            if (!own.some(item => item.id.toLowerCase() === resourceId || item.electricityRecordId.toLowerCase() === lineage.electricityRecordId)) throw new RequestProblem(409, RECORD_ID_UNAVAILABLE_TEXT, "record_id_unavailable")
          }
          throw error
        }
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
        let intent: Awaited<ReturnType<typeof deps.database.reserveCollectionEvidenceUpload>>
        try { intent = await deps.database.reserveCollectionEvidenceUpload(actor.id, companyId, upload) }
        catch (error) {
          // BF-08 (BL-05): reserving an upload ID that another company holds (the intent table's primary key is global).
          if ((error as { code?: string }).code === "23505" && !(await deps.database.findCollectionEvidence(actor.id, companyId)).some(item => item.id === id)) throw new RequestProblem(409, RECORD_ID_UNAVAILABLE_TEXT, "record_id_unavailable")
          throw error
        }
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
        const item = (await deps.database.findCollectionEvidence(actor.id, companyId)).find(item => item.id === resourceId)
        if (!item) return fail(404, "Collection evidence not found.")
        return item.quarantineStatus === "rejected" ? fail(410, "Evidence was rejected by quarantine review and cannot be downloaded.", "quarantine_rejected") : fail(423, "Evidence is not available until quarantine review passes.", "quarantine_pending")
      }
      const bytes = await deps.evidenceStorage.get(token, locator.bucket, locator.objectKey)
      if (bytes.byteLength !== locator.byteLength || await sha256(bytes) !== locator.sha256) return fail(503, "Evidence integrity could not be verified.")
      return new Response(bytes.buffer, { status: 200, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", "content-type": locator.mediaType, "content-length": String(bytes.byteLength), "x-content-sha256": locator.sha256, "content-disposition": `attachment; filename="evidence-${resourceId}"` } })
    } catch (error) { return mappedError(error, readable && request.method === "POST") }
  }
}
