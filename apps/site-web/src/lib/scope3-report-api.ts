import type { HostedWorkspaceActor } from "./workspace-api"
import { SCOPE3_REPORT_PROFILE_V1, validateScope3ReportDocument, validateScope3ReportVersionSummary, type Scope3ReportDocument, type Scope3ReportVersionSummary, type Scope3StoredReportDocument } from "../../../../packages/neuvetra-database/src/scope3-report-document"
// Round 2 (owner decisions 7 and 11): the readiness and approval lines and the exported CSV (stored bytes + approval lines) for the screen and print.
export { scope3ReportApprovalLines, scope3ReportExportCsv, scope3ReportReadinessLines, type Scope3ReportOpenIssue, type Scope3StoredReportDocument, SCOPE3_REPORT_PROFILE_V1, SCOPE3_REPORT_PROFILE_V2, SCOPE3_REPORT_PROFILE_V3 } from "../../../../packages/neuvetra-database/src/scope3-report-document"

/**
 * Frozen Scope 3 report versions (Scope 3 completion I-10; Claude, 30 October 2026; DESIGN 3.7, 7.4; assurance-ux M8).
 * The Results screen lists the reporting year's versions, prepares the next one, opens a stored version and approves it
 * bound to the report SHA-256 it shows. Every response is decoded strictly: each version as 0030 stores it (revision chain,
 * approval hash equal to the version's, self-approval exactly when the approver prepared it), and an opened version's
 * texts re-hashed here and equal to the stored SHA-256, its document checked by the shared rules and its results by the
 * results decoder. The CSV download and print of a stored version use these stored bytes, never the live results.
 * Round 2 (owner decision 11, ENG-4): a stored document is decoded by the frozen validator of its own profile (v1 or v2):
 * structure, internal consistency and the hashes, never the live results decoder, live wording or the live catalog, so an
 * approved version keeps opening after any later change. The exported CSV is the stored bytes followed by the approval
 * lines (`scope3ReportExportCsv`); approving takes the explicit open-issue acknowledgement and self-approval confirmation.
 */
export type { Scope3ReportDocument, Scope3ReportVersionSummary }
export const SCOPE3_REPORTS_PROFILE = "neuvetra.scope3-reports.v1"
export interface Scope3ReportsView { companyId: string; canManage: boolean; actorId: string; setupVersionId: string | null; reportingYear: number | null; versions: Scope3ReportVersionSummary[] }
export interface Scope3FrozenReport { version: Scope3ReportVersionSummary; reportText: string; csvText: string; document: Scope3StoredReportDocument }

export class Scope3ReportApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) { super(message) }
  get conflict() { return this.status === 409 }
  /** The database is below schema 30 (0030), so report versions don't exist yet. */
  get unavailable() { return this.status === 503 && this.code === "scope3_schema_30_required" }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const fail = (): never => { throw new Error("The Scope 3 report response was not recognized.") }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
const keys = (value: Record<string, unknown>, expected: readonly string[]) => Object.keys(value).sort().join("|") === [...expected].sort().join("|")
const summary = (value: unknown, companyId: string) => { try { return validateScope3ReportVersionSummary(value, companyId) } catch { return fail() } }

/** SHA-256 of the UTF-8 bytes of a text, as lowercase hex (Web Crypto). */
export async function scope3Sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")
}

export function decodeScope3Reports(value: unknown, companyId: string): Scope3ReportsView {
  if (!object(value) || !keys(value, ["profile", "companyId", "canManage", "actorId", "setupVersionId", "reportingYear", "versions"]) || value.profile !== SCOPE3_REPORTS_PROFILE || value.companyId !== companyId) fail()
  const v = value as Record<string, unknown>
  if (typeof v.canManage !== "boolean" || typeof v.actorId !== "string" || !UUID.test(v.actorId) || !(v.setupVersionId === null || (typeof v.setupVersionId === "string" && UUID.test(v.setupVersionId)))) fail()
  if (!(v.reportingYear === null || (Number.isSafeInteger(v.reportingYear) && (v.reportingYear as number) >= 2012 && (v.reportingYear as number) <= 2035)) || (v.setupVersionId === null && v.reportingYear !== null) || !Array.isArray(v.versions)) fail()
  const versions = (v.versions as unknown[]).map(item => summary(item, companyId))
  // One reporting year, revisions 1..n in order, each chained to the one before.
  if ((v.reportingYear === null && versions.length) || versions.some((item, i) => item.reportingYear !== v.reportingYear || item.revision !== i + 1 || (i > 0 && item.previousId !== versions[i - 1]!.id))) fail()
  return { companyId, canManage: v.canManage as boolean, actorId: v.actorId as string, setupVersionId: v.setupVersionId as string | null, reportingYear: v.reportingYear as number | null, versions }
}

/** One stored version: the texts must hash to the stored SHA-256; the document and its results must decode. */
export async function decodeScope3ReportVersion(value: unknown, companyId: string, versionId: string): Promise<Scope3FrozenReport> {
  if (!object(value) || !keys(value, ["profile", "version", "reportText", "csvText"]) || value.profile !== SCOPE3_REPORTS_PROFILE || typeof value.reportText !== "string" || typeof value.csvText !== "string") fail()
  const v = value as { version: unknown; reportText: string; csvText: string }
  const version = summary(v.version, companyId)
  if (version.id !== versionId || await scope3Sha256(v.reportText) !== version.reportSha256 || await scope3Sha256(v.csvText) !== version.csvSha256) fail()
  let document: Scope3StoredReportDocument
  try { document = validateScope3ReportDocument(JSON.parse(v.reportText), companyId) } catch { return fail() }
  if (document.reportingYear !== version.reportingYear || document.revision !== version.revision || document.inputs.setupVersionId !== version.setupVersionId || document.inputs.recordVersionIds.length !== version.inputVersionCount
    || document.assertion.preparedBy !== version.createdBy || ![null, version.engineSha256].includes(scope3EngineOf(document))) fail()
  // v1 predates readiness. Newer metadata must describe the immutable document actually opened.
  if (document.profile !== SCOPE3_REPORT_PROFILE_V1) {
    const issues = (rows: Scope3ReportVersionSummary["openIssues"]) => rows.map(row => `${row.category}|${row.code}`).sort().join(",")
    const registers = (values: Record<string, string>) => JSON.stringify(Object.keys(values).sort().map(key => [key, values[key]]))
    if (!document.results.readiness || issues(version.openIssues) !== issues(document.results.readiness.openIssues)
      || registers(version.registerSha256s) !== registers(document.results.registerSha256s)) fail()
  }
  return { version, reportText: v.reportText, csvText: v.csvText, document }
}
/** The engine the frozen results name (every method's engine); the stored version's engine when nothing was calculated. */
const scope3EngineOf = (document: Scope3StoredReportDocument): string | null => {
  const engines = [...new Set(document.results.methods.map(item => item.engineSha256))]
  return engines.length === 1 ? engines[0]! : engines.length === 0 ? null : "mixed"
}

async function request(actor: HostedWorkspaceActor, path: string, body?: unknown): Promise<unknown> {
  if (!actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  actor.signal?.throwIfAborted()
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST", cache: "no-store", signal: actor.signal, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { authorization: `Bearer ${actor.accessToken}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
  })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) actor.onUnauthorized?.()
  const value: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Scope3ReportApiError(object(value) && typeof value.error === "string" ? value.error : "Scope 3 report versions are unavailable right now.", response.status, object(value) && typeof value.code === "string" ? value.code : null)
  return value
}
const path = (companyId: string, versionId?: string, approval = false) => {
  if (!UUID.test(companyId) || (versionId !== undefined && !UUID.test(versionId))) throw new Error("Invalid Scope 3 report reference.")
  return `/workspace-api/workspace/${companyId}/scope3/reports${versionId ? `/${versionId}${approval ? "/approval" : ""}` : ""}`
}
const saved = (value: unknown, companyId: string) => {
  if (!object(value) || !keys(value, ["profile", "version", "replayed"]) || value.profile !== SCOPE3_REPORTS_PROFILE || typeof value.replayed !== "boolean") fail()
  return { version: summary((value as Record<string, unknown>).version, companyId), replayed: (value as Record<string, unknown>).replayed as boolean }
}

export async function loadScope3Reports(companyId: string, actor: HostedWorkspaceActor): Promise<Scope3ReportsView> {
  return decodeScope3Reports(await request(actor, path(companyId)), companyId)
}
export async function loadScope3ReportVersion(companyId: string, versionId: string, actor: HostedWorkspaceActor): Promise<Scope3FrozenReport> {
  return decodeScope3ReportVersion(await request(actor, path(companyId, versionId)), companyId, versionId)
}
/** Prepares the next version; the server freezes its own live results. The stored version must be this actor's, as asked. */
export async function prepareScope3Report(companyId: string, input: { idempotencyKey: string; expectedRevision: number; reason: string | null }, actor: HostedWorkspaceActor): Promise<{ version: Scope3ReportVersionSummary; replayed: boolean }> {
  const out = saved(await request(actor, path(companyId), input), companyId)
  if (out.version.revision !== input.expectedRevision + 1 || out.version.reason !== input.reason || out.version.createdBy !== actor.userId || out.version.approval !== null) fail()
  return out
}
/**
 * Approves the version bound to the report SHA-256 shown to the approver. Round 2 (owner decision 7): `acknowledgeOpenIssues`
 * must be true exactly when the version has open issues (its `openIssues`), `confirmSelfApproval` exactly when the approver
 * prepared it; the server answers 409 `open_issues_not_acknowledged` / `self_approval_not_confirmed` otherwise.
 * (Round 2 integration: lane B's request code; lane D's names below are kept for its screen and tests.)
 */
export async function approveScope3Report(companyId: string, versionId: string, reportSha256: string, actor: HostedWorkspaceActor,
  confirmations: Scope3ApprovalConfirmations = { acknowledgeOpenIssues: false, confirmSelfApproval: false }): Promise<{ version: Scope3ReportVersionSummary; replayed: boolean }> {
  const out = saved(await request(actor, path(companyId, versionId, true), { reportSha256, acknowledgeOpenIssues: confirmations.acknowledgeOpenIssues, confirmSelfApproval: confirmations.confirmSelfApproval }), companyId)
  if (out.version.id !== versionId || out.version.reportSha256 !== reportSha256 || !out.version.approval || (!out.replayed && out.version.approval.approvedBy !== actor.userId)) fail()
  return out
}
/**
 * Round 2 lane D (decision 7; UX-10, ACC-10): what the approver confirmed, in lane B's route shape (body exactly
 * `{ reportSha256, acknowledgeOpenIssues, confirmSelfApproval }`, both booleans). Kept as lane D's names; the shapes are
 * lane B's (`Scope3ReportVersionSummary.openIssues` and `approval`).
 */
export interface Scope3ApprovalConfirmations { acknowledgeOpenIssues: boolean; confirmSelfApproval: boolean }
/** An open issue as lane B stores it with a version (`openIssues`) and an approval (`acknowledgedOpenIssues`). */
export type Scope3StoredOpenIssue = { category: number; code: string }
/** The approval as lane B's summary carries it (acknowledged open issues and the self-approval confirmation). */
export type Scope3ApprovalR2 = NonNullable<Scope3ReportVersionSummary["approval"]>
/** The approval request body: always the three keys lane B's route requires (what approveScope3Report sends). */
export function scope3ApprovalBody(reportSha256: string, confirmations: Scope3ApprovalConfirmations = { acknowledgeOpenIssues: false, confirmSelfApproval: false }): { reportSha256: string; acknowledgeOpenIssues: boolean; confirmSelfApproval: boolean } {
  return { reportSha256, acknowledgeOpenIssues: confirmations.acknowledgeOpenIssues, confirmSelfApproval: confirmations.confirmSelfApproval }
}
/** The download name of a stored CSV. */
export const scope3ReportCsvName = (version: Scope3ReportVersionSummary) => `neuvetra-scope3-report-${version.reportingYear}-r${version.revision}-${version.reportSha256.slice(0, 12)}.csv`
