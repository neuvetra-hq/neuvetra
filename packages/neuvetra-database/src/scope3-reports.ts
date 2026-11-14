/**
 * Frozen Scope 3 report versions: database access (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 3.7, 7.4,
 * A16, A24, A31; assurance-ux M8). Server-only.
 *
 * A version is created from the live, engine-backed Scope 3 results: `scope3ReportDraft` builds the report document
 * (results, assertion, base-year statement, change log against the previous approved version of the reporting year) and
 * the CSV (the shared CSV v2 after the frozen lines), as exact text with their SHA-256; `prepareScope3Report` stores them
 * through 0030's `prepare_scope3_report` (owner or admin, optimistic revision per reporting year, idempotent by key, the
 * table recomputes both hashes) and reads the stored row back. `approveScope3Report` goes through
 * `approve_scope3_report`, which refuses a hash other than the stored one (23505) and records self-approval. 0030's
 * triggers refuse every UPDATE, DELETE and TRUNCATE of versions, requests and approvals (55000), so approved bytes never
 * change, whatever happens to the records later.
 *
 * Every row read back is checked (`validateScope3ReportVersionSummary`; the texts against their stored SHA-256), so a row
 * the rules would refuse is an integrity failure, never shown. The caller supplies a transaction with the
 * server-authenticated JWT subject and the runtime role (HostedWorkspaceDatabase.asUser / asTrustedUser).
 */
import { createHash } from 'node:crypto'
import type { WorkspaceSql } from './workspace'
import { SCOPE3_REPORT_MAX_COMBINED_TEXT_BYTES, SCOPE3_REPORT_MAX_REQUEST_BYTES, SCOPE3_REPORT_MAX_TEXT_BYTES, SCOPE3_REPORT_REQUEST_SLACK_BYTES, type Scope3ReportApproveRequest, type Scope3ReportPrepareCall, type Scope3ReportPrepareRequest } from './scope3-assessment-contract'
import type { Scope3CsvLabels } from './scope3-report-csv'
import type { Scope3ResultsDocument } from './scope3-trace'
import {
  buildScope3ReportDocument, scope3ReportChangeLogBasis, scope3ReportCsv, scope3ReportPreviousFromBasis, scope3ReportText, validateScope3ReportVersionSummary,
  type Scope3ReportConsolidationApproach, type Scope3ReportDocument, type Scope3ReportPrevious, type Scope3ReportVersionSummary,
} from './scope3-report-document'
export type { Scope3ReportDocument, Scope3ReportPrevious, Scope3ReportVersionSummary } from './scope3-report-document'

/** A stored version with its exact texts. */
export interface Scope3ReportVersionDetail { version: Scope3ReportVersionSummary; reportText: string; csvText: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
function sha256(text: string): string {
  const hash = createHash('sha256'), chars = 65_536
  if (text.length <= chars) return hash.update(text, 'utf8').digest('hex')
  // One reusable UTF-8 buffer avoids retaining a second full copy of each frozen text while hashing.
  const encoder = new TextEncoder(), bytes = new Uint8Array(chars * 3)
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + chars)
    const last = text.charCodeAt(end - 1)
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--
    const { read, written } = encoder.encodeInto(text.slice(start, end), bytes)
    if (read !== end - start) throw new Error('Incomplete report text encoding.')
    hash.update(bytes.subarray(0, written))
    start = end
  }
  return hash.digest('hex')
}
const utf8Bytes = (text: string) => Buffer.byteLength(text, 'utf8')
const coded = (message: string, code: string) => Object.assign(new Error(message), { code })
type Row = {
  id: string; company_id: string; reporting_year: number; revision: number; previous_id: string | null; setup_version_id: string; reason: string | null
  report_sha256: string; csv_sha256: string; engine_sha256: string; register_sha256s: unknown; input_version_count: number; created_by: string; created_at: string
  approved_by: string | null; approved_at: string | null; self_approved: boolean | null; approval_sha256: string | null
  open_issues: unknown; acknowledged_open_issues: unknown; self_approval_confirmed: boolean | null
}
const COLUMNS = `v.id,v.company_id,v.reporting_year,v.revision,v.previous_id,v.setup_version_id,v.reason,v.report_sha256,v.csv_sha256,v.engine_sha256,v.register_sha256s,
  cardinality(v.input_version_ids) input_version_count,v.created_by,v.created_at::text created_at,a.approved_by,a.approved_at::text approved_at,a.self_approved,a.report_sha256 approval_sha256,
  v.open_issues,a.acknowledged_open_issues,a.self_approval_confirmed`
const FROM = `neuvetra.scope3_report_versions v left join neuvetra.scope3_report_approvals a on a.version_id=v.id and a.company_id=v.company_id`
const iso = (text: string) => new Date(text).toISOString()

function decode(row: Row, companyId: string): Scope3ReportVersionSummary {
  try {
    return validateScope3ReportVersionSummary({
      id: row.id, companyId: row.company_id, reportingYear: row.reporting_year, revision: row.revision, previousId: row.previous_id, setupVersionId: row.setup_version_id, reason: row.reason,
      reportSha256: row.report_sha256, csvSha256: row.csv_sha256, engineSha256: row.engine_sha256, registerSha256s: row.register_sha256s, inputVersionCount: Number(row.input_version_count),
      createdBy: row.created_by, createdAt: iso(row.created_at), openIssues: row.open_issues,
      approval: row.approved_by === null ? null : { approvedBy: row.approved_by, approvedAt: iso(row.approved_at!), selfApproved: row.self_approved, reportSha256: row.approval_sha256,
        acknowledgedOpenIssues: row.acknowledged_open_issues, selfApprovalConfirmed: row.self_approval_confirmed },
    }, companyId)
  } catch { throw new Error('Scope 3 report integrity check failed.') }
}

/** Every version of one reporting year, oldest first, each with its approval (null when not approved). Empty for a non-member. */
export async function readScope3ReportVersions(tx: WorkspaceSql, companyId: string, reportingYear: number): Promise<Scope3ReportVersionSummary[]> {
  if (!UUID.test(companyId) || !Number.isSafeInteger(reportingYear)) return []
  const rows = await tx.query<Row>(`select ${COLUMNS} from ${FROM} where v.company_id=$1 and v.reporting_year=$2 order by v.revision`, [companyId, reportingYear])
  const out = rows.rows.map(row => decode(row, companyId))
  if (out.some((item, i) => item.reportingYear !== reportingYear || item.revision !== i + 1 || (i > 0 && item.previousId !== out[i - 1]!.id))) throw new Error('Scope 3 report integrity check failed.')
  return out
}

/**
 * Round 3 (owner decision 6): one version's summary, never its texts (the read-back after prepare and approve). The stored
 * hashes are the table's own: its checks hash each text on insert, so a stored hash equal to the one sent means the stored
 * text is the one sent, without reading 150 MB back.
 */
export async function readScope3ReportSummary(tx: WorkspaceSql, companyId: string, versionId: string): Promise<Scope3ReportVersionSummary | null> {
  if (!UUID.test(companyId) || !UUID.test(versionId)) return null
  const row = (await tx.query<Row>(`select ${COLUMNS} from ${FROM} where v.company_id=$1 and v.id=$2`, [companyId, versionId])).rows[0]
  return row ? decode(row, companyId) : null
}

/** One version with its exact report and CSV text (each checked against its stored SHA-256); null when not the company's. */
export async function readScope3ReportVersion(tx: WorkspaceSql, companyId: string, versionId: string): Promise<Scope3ReportVersionDetail | null> {
  if (!UUID.test(companyId) || !UUID.test(versionId)) return null
  const rows = await tx.query<Row & { report_text: string; csv_text: string }>(`select ${COLUMNS},v.report_text,v.csv_text from ${FROM} where v.company_id=$1 and v.id=$2`, [companyId, versionId])
  const row = rows.rows[0]
  if (!row) return null
  const version = decode(row, companyId)
  if (sha256(row.report_text) !== version.reportSha256 || sha256(row.csv_text) !== version.csvSha256) throw new Error('Scope 3 report integrity check failed.')
  return { version, reportText: row.report_text, csvText: row.csv_text }
}

/**
 * The latest approved version of a reporting year with what its change log needs (the base of the next change log), or
 * null. Round 3 (owner decision 6): read from the version's stored change-log basis (0030 `change_log_basis`, a few
 * hundred kB at the line cap), never by parsing its report text (83 MB there).
 */
export async function readLatestApprovedScope3Report(tx: WorkspaceSql, companyId: string, reportingYear: number): Promise<Scope3ReportPrevious | null> {
  if (!UUID.test(companyId) || !Number.isSafeInteger(reportingYear)) return null
  const rows = await tx.query<Row & { change_log_basis: string }>(`select ${COLUMNS},v.change_log_basis from ${FROM} where v.company_id=$1 and v.reporting_year=$2 and a.version_id is not null order by v.revision desc limit 1`, [companyId, reportingYear])
  const row = rows.rows[0]
  if (!row) return null
  const summary = decode(row, companyId)
  if (!summary.approval) throw new Error('Scope 3 report integrity check failed.')
  try { return scope3ReportPreviousFromBasis(summary, row.change_log_basis) } catch { throw new Error('Scope 3 report integrity check failed.') }
}

/** Who sent an idempotency key and which version it created (the route replays a retried request without rebuilding). */
export async function readScope3ReportRequest(tx: WorkspaceSql, companyId: string, idempotencyKey: string): Promise<{ actorId: string; versionId: string } | null> {
  if (!UUID.test(companyId) || !UUID.test(idempotencyKey)) return null
  const rows = await tx.query<{ actor_id: string; version_id: string }>('select actor_id,version_id from neuvetra.scope3_report_requests where company_id=$1 and idempotency_key=$2', [companyId, idempotencyKey])
  return rows.rows[0] ? { actorId: rows.rows[0].actor_id, versionId: rows.rows[0].version_id } : null
}

/**
 * The prepare request for a new version, built from the live results (nothing recalculated): the document and its
 * canonical text, the CSV (labels must be the web's own, so the stored CSV is the bytes the web would write), both
 * SHA-256, the engine and register hashes the results name, and every record version they read.
 */
export function scope3ReportDraft(input: {
  results: Scope3ResultsDocument; previous: Scope3ReportPrevious | null; reportingYear: number; expectedRevision: number; reason: string | null; idempotencyKey: string
  setupVersionId: string; consolidationApproach: Scope3ReportConsolidationApproach | null; preparedBy: string; preparedAt: string; engineSha256: string; labels: Scope3CsvLabels
  /** Round 2: the size limit of each text (default 0030's, SCOPE3_REPORT_MAX_TEXT_BYTES); a test may lower it. */
  maxTextBytes?: number
  /** BF-21: the size limit of both texts together (default SCOPE3_REPORT_MAX_COMBINED_TEXT_BYTES); a test may lower it. */
  maxCombinedTextBytes?: number
  /** Round 2c: the size limit of the whole request (default 0030's, SCOPE3_REPORT_MAX_REQUEST_BYTES); a test may lower it. */
  maxRequestBytes?: number
  /**
   * Round 3 (owner decision 6): called after each text and between serialization batches (the route passes a full garbage
   * collection), so building the next phase does not retain temporary serialization buffers from earlier work.
   */
  betweenPhases?: () => void
}): Scope3ReportPrepareCall & { document: Scope3ReportDocument } {
  const document = buildScope3ReportDocument({ results: input.results, reportingYear: input.reportingYear, revision: input.expectedRevision + 1, setupVersionId: input.setupVersionId,
    consolidationApproach: input.consolidationApproach, preparedBy: input.preparedBy, preparedAt: input.preparedAt, previous: input.previous })
  if (input.results.methods.some(item => item.engineSha256 !== input.engineSha256)) throw new Error('The Scope 3 results name another engine.')
  const reportText = scope3ReportText(document, input.betweenPhases)
  input.betweenPhases?.()
  const csvText = scope3ReportCsv(document, input.labels, input.betweenPhases)
  input.betweenPhases?.()
  // Round 2 (owner decision 10, ENG-3): 0030's limit, checked before any call, with its own error.
  // BF-21 (CEO ruling): and both together within what keeps the storing database backend inside its memory budget. The
  // refusal carries the sizes and limits, so the route can say what is too large (nothing is calculated or changed here).
  const max = Math.min(input.maxTextBytes ?? SCOPE3_REPORT_MAX_TEXT_BYTES, SCOPE3_REPORT_MAX_TEXT_BYTES)
  const maxCombined = Math.min(input.maxCombinedTextBytes ?? SCOPE3_REPORT_MAX_COMBINED_TEXT_BYTES, SCOPE3_REPORT_MAX_COMBINED_TEXT_BYTES)
  const reportBytes = utf8Bytes(reportText), csvBytes = utf8Bytes(csvText)
  if (reportBytes > max || csvBytes > max || reportBytes + csvBytes > maxCombined)
    throw Object.assign(coded('Scope 3 report too large.', 'report_too_large'), { size: { reportBytes, csvBytes, maxTextBytes: max, maxCombinedTextBytes: maxCombined, lines: input.results.records.length } satisfies Scope3ReportSize })
  const results = input.results
  // Round 3 (owner decision 6): the request holds only small fields; the texts travel beside it as plain text parameters.
  // Round 3 (EN-5): with what the results depended on, so 0030 can refuse results that went stale before they were stored.
  const request: Scope3ReportPrepareRequest = {
    idempotencyKey: input.idempotencyKey, expectedRevision: input.expectedRevision, reason: input.reason, reportingYear: input.reportingYear, companyId: results.companyId,
    reportSha256: sha256(reportText), csvSha256: sha256(csvText), engineSha256: input.engineSha256,
    registerSha256s: { ...results.registerSha256s }, inputVersionIds: document.inputs.recordVersionIds, setupVersionId: input.setupVersionId,
    readiness: { ready: results.readiness!.ready, openIssues: results.readiness!.openIssues.map(issue => ({ category: issue.category, code: issue.code })) },
    assessmentIds: [...new Set(results.coverage.categories.flatMap(row => row.assessment ? [row.assessment.id] : []))].sort(),
    rejectedEvidenceIds: [...new Set(results.records.flatMap(row => row.evidence.filter(file => file.status === 'rejected').map(file => file.id)))].sort(),
    previousApprovedVersionId: input.previous?.summary.id ?? null,
    changeLogBasis: scope3ReportChangeLogBasis(document),
  }
  // The request's own limit (0030 measures its text form; the JSON plus the slack covers jsonb::text's extra spaces).
  const maxRequest = Math.min(input.maxRequestBytes ?? SCOPE3_REPORT_MAX_REQUEST_BYTES, SCOPE3_REPORT_MAX_REQUEST_BYTES)
  if (utf8Bytes(JSON.stringify(request)) + SCOPE3_REPORT_REQUEST_SLACK_BYTES > maxRequest) throw coded('Scope 3 report too large.', 'report_too_large')
  return { request, reportText, csvText, document }
}

/** BF-21: what a report_too_large refusal measured (the route words its answer from it). */
export interface Scope3ReportSize { reportBytes: number; csvBytes: number; maxTextBytes: number; maxCombinedTextBytes: number; lines: number }

async function assertActor(tx: WorkspaceSql, actorId: string, what: string) {
  const actor = await tx.query<{ id: string }>('select neuvetra.current_user_id() id')
  if (actor.rows[0]?.id !== actorId) throw coded(`${what} unavailable.`, '42501')
}

/** Round 3 (owner decision 6): the characters per staged chunk (at most 6 MB of UTF-8; 0030 takes up to 8 MiB a chunk). */
export const SCOPE3_REPORT_TEXT_CHUNK_CHARS = 2_000_000
/** A text in pieces of at most `size` UTF-16 units, never splitting a surrogate pair. */
export function scope3TextChunks(text: string, size = SCOPE3_REPORT_TEXT_CHUNK_CHARS): string[] {
  const out: string[] = []
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + size)
    const last = text.charCodeAt(end - 1)
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--
    out.push(text.slice(start, end)); start = end
  }
  return out
}

/**
 * Stores a prepared version through 0030's `prepare_scope3_report`, then reads its summary back. Round 3 (owner decision 6):
 * each text is staged in chunks of at most 2,000,000 characters (`stage_scope3_report_text`, one small statement each, in
 * the same transaction), so no 150 MB message is ever built here or read by the backend; prepare assembles them under the
 * company lock. Nothing reads the texts back: the stored hashes, which the table computed from the stored texts, must equal
 * the ones sent (a replay returns the version the same request stored before, whose fingerprint covers the same hashes).
 */
export async function prepareScope3Report(tx: WorkspaceSql, actorId: string, companyId: string, call: Scope3ReportPrepareCall): Promise<{ version: Scope3ReportVersionSummary; replayed: boolean }> {
  if (!UUID.test(actorId) || !UUID.test(companyId)) throw new Error('Scope 3 report unavailable.')
  await assertActor(tx, actorId, 'Scope 3 report')
  const { request } = call
  for (const [kind, text] of [['report', call.reportText], ['csv', call.csvText]] as const)
    for (const [ordinal, chunk] of scope3TextChunks(text).entries()) {
      await tx.query('select neuvetra.stage_scope3_report_text($1,$2::text::jsonb,$3::text)', [companyId, JSON.stringify({ idempotencyKey: request.idempotencyKey, kind, ordinal }), chunk])
      // pg builds two wire buffers per chunk; reclaim settled batches before they accumulate across both frozen texts.
      if ((ordinal + 1) % 4 === 0) (globalThis as { Bun?: { gc(force: boolean): void } }).Bun?.gc(true)
    }
  const receipt = await tx.query<{ version_id: string; revision: number; replayed: boolean }>('select * from neuvetra.prepare_scope3_report($1,$2::text::jsonb)', [companyId, JSON.stringify(request)])
  const row = receipt.rows[0]
  if (!row) throw new Error('Scope 3 report save returned no receipt.')
  const stored = await readScope3ReportSummary(tx, companyId, row.version_id)
  if (!stored || stored.revision !== row.revision || stored.reportSha256 !== request.reportSha256 || stored.csvSha256 !== request.csvSha256 || stored.reportingYear !== request.reportingYear
    || stored.createdBy !== actorId || stored.reason !== request.reason) throw new Error('Scope 3 report save could not be read back.')
  return { version: stored, replayed: row.replayed }
}

/** Approves a version bound to the report hash the approver saw (0030: a different hash is 23505; an approved version replays). */
export async function approveScope3Report(tx: WorkspaceSql, actorId: string, companyId: string, input: Scope3ReportApproveRequest): Promise<{ version: Scope3ReportVersionSummary; replayed: boolean }> {
  if (!UUID.test(actorId) || !UUID.test(companyId)) throw new Error('Scope 3 report approval unavailable.')
  if (!UUID.test(input.versionId) || !/^[0-9a-f]{64}$/.test(input.reportSha256) || typeof input.acknowledgeOpenIssues !== 'boolean' || typeof input.confirmSelfApproval !== 'boolean') throw coded('Invalid Scope 3 report approval.', '22023')
  await assertActor(tx, actorId, 'Scope 3 report approval')
  const receipt = await tx.query<{ version_id: string; approved_by: string; self_approved: boolean; replayed: boolean }>('select * from neuvetra.approve_scope3_report($1,$2::text::jsonb)',
    [companyId, JSON.stringify({ versionId: input.versionId, reportSha256: input.reportSha256, acknowledgeOpenIssues: input.acknowledgeOpenIssues, confirmSelfApproval: input.confirmSelfApproval })])
  const row = receipt.rows[0]
  if (!row) throw new Error('Scope 3 report approval returned no receipt.')
  // Round 3 (owner decision 6): the summary only; the approval row binds the stored hash (never the texts read back).
  const stored = await readScope3ReportSummary(tx, companyId, row.version_id)
  if (!stored?.approval || stored.approval.approvedBy !== row.approved_by || stored.approval.selfApproved !== row.self_approved || stored.reportSha256 !== input.reportSha256)
    throw new Error('Scope 3 report approval could not be read back.')
  return { version: stored, replayed: row.replayed }
}
