import type { AnnualElectricityWorksheet } from "./m67-api"
import type { HostedWorkspaceActor } from "./workspace-api"
import { decodeAnnualElectricityEvidence, type AnnualElectricityEvidence } from "./m68-api"
import { M68_TEMPLATE_VERSION, M68_MAX_REPORT_BYTES, type AnnualEvidenceReport, type AnnualEvidenceReportInput } from "../../../../packages/neuvetra-database/src/m68-contract"
import { M68_TEMPLATE_SHA256 } from "../../../../packages/neuvetra-database/src/m68-template"
export type { AnnualEvidenceReport }
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v)
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v,i) => same(v,b[i]))
  if (object(a) && object(b)) return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.prototype.hasOwnProperty.call(b,k) && same(a[k],b[k]))
  return false
}
const fail = (): never => { throw new Error("The report could not be verified against the saved worksheet. Refresh and try again.") }
export function decodeAnnualEvidenceReport(value: unknown, worksheet: AnnualElectricityEvidence, annual: AnnualElectricityWorksheet): AnnualEvidenceReport {
  if (!object(value)) return fail()
  const keys = ["id","companyId","profile","sourceVersionId","sourceVersion","inputSha256","resultSha256","reviewId","reviewSha256","reviewState","templateVersion","templateSha256","reportSha256","reportByteLength","createdBy","createdAt","synthetic","complete","releaseEligible","assurance","source"]
  if (!same(Object.keys(value).sort(), keys.sort()) || !uuid(value.id) || value.companyId !== worksheet.companyId || value.profile !== "neuvetra.synthetic.annual-electricity-evidence-report.v1" || !uuid(value.sourceVersionId) || !hash(value.inputSha256) || !hash(value.resultSha256) || !hash(value.templateSha256) || !hash(value.reportSha256) || !uuid(value.createdBy) || typeof value.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isSafeInteger(value.reportByteLength) || (value.reportByteLength as number) < 1 || (value.reportByteLength as number) > M68_MAX_REPORT_BYTES || value.synthetic !== true || value.complete !== false || value.releaseEligible !== false || value.assurance !== "none" || !object(value.source)) return fail()
  const current = worksheet.versions.find(v => v.id === value.sourceVersionId)
  if (!current || value.sourceVersion !== current.version || value.inputSha256 !== current.inputSha256 || value.resultSha256 !== current.resultSha256) return fail()
  const source = value.source
  // A frozen unreviewed snapshot may precede the current review. Other source content cannot change.
  if (!same({...source, review:null}, {...current, review:null}) || (source.review !== null && !same(source.review,current.review))) return fail()
  const prefix = worksheet.versions.slice(0,current.version)
  prefix[prefix.length - 1] = source as unknown as typeof current
  decodeAnnualElectricityEvidence({...worksheet, versions:prefix}, worksheet.companyId, annual)
  const review = prefix[prefix.length - 1].review
  if (value.reviewId !== (review?.id ?? null) || value.reviewSha256 !== (review?.decisionSha256 ?? null) || value.reviewState !== (review ? review.decision === "accept_bounded_internal_draft" ? "accepted_bounded_internal_draft" : "changes_requested" : "unreviewed")) return fail()
  if (value.templateVersion !== M68_TEMPLATE_VERSION || value.templateSha256 !== M68_TEMPLATE_SHA256) return fail()
  return value as unknown as AnnualEvidenceReport
}
async function request(actor: HostedWorkspaceActor, companyId: string, suffix = "", payload?: AnnualEvidenceReportInput): Promise<Response> {
  actor.signal?.throwIfAborted()
  if (!uuid(companyId) || !actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  const response = await fetch(`/workspace-api/workspace/${companyId}/annual-electricity-evidence/reports${suffix}`, {method:payload ? "POST" : "GET",headers:{authorization:`Bearer ${actor.accessToken}`,...(payload ? {"content-type":"application/json"} : {})}, body:payload ? JSON.stringify(payload) : undefined,signal:actor.signal,cache:"no-store"})
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) { actor.onUnauthorized?.(); throw new Error("Your access changed. Sign in again to continue.") }
  if (!response.ok) throw new Error(response.status === 409 ? "The review changed or this request conflicts with a saved report. Refresh the worksheet before creating a new snapshot." : "The report is unavailable. Retry the same action or refresh.")
  return response
}
export async function listAnnualEvidenceReports(actor: HostedWorkspaceActor, worksheet: AnnualElectricityEvidence, annual: AnnualElectricityWorksheet): Promise<AnnualEvidenceReport[]> {
  const response = await request(actor,worksheet.companyId); const body: unknown = await response.json(); actor.signal?.throwIfAborted()
  if (!object(body) || body.companyId !== worksheet.companyId || body.profile !== "neuvetra.synthetic.annual-electricity-evidence-report.v1" || !Array.isArray(body.reports) || Object.keys(body).length !== 3) return fail()
  const reports = body.reports.map(r => decodeAnnualEvidenceReport(r,worksheet,annual))
  if (new Set(reports.map(r=>r.id)).size !== reports.length) return fail()
  return reports
}
export async function createAnnualEvidenceReport(actor: HostedWorkspaceActor, worksheet: AnnualElectricityEvidence, annual: AnnualElectricityWorksheet, payload: AnnualEvidenceReportInput): Promise<AnnualEvidenceReport> {
  const response = await request(actor,worksheet.companyId,"",payload); const body: unknown = await response.json(); actor.signal?.throwIfAborted(); return decodeAnnualEvidenceReport(body,worksheet,annual)
}
export async function readAnnualEvidenceReportHtml(actor: HostedWorkspaceActor, worksheet: AnnualElectricityEvidence, annual: AnnualElectricityWorksheet, report: AnnualEvidenceReport): Promise<string> {
  if (!uuid(report.id)) return fail()
  const metadataResponse = await request(actor,worksheet.companyId,`/${report.id}`)
  const current = decodeAnnualEvidenceReport(await metadataResponse.json(),worksheet,annual)
  if (!same(current,report)) return fail()
  const response = await request(actor,worksheet.companyId,`/${report.id}/download`)
  if (!response.headers.get("content-type")?.startsWith("text/html")) return fail()
  const bytes = await response.arrayBuffer(); actor.signal?.throwIfAborted()
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(b=>b.toString(16).padStart(2,"0")).join("")
  actor.signal?.throwIfAborted()
  if (bytes.byteLength !== report.reportByteLength || digest !== report.reportSha256) return fail()
  return new TextDecoder("utf-8",{fatal:true}).decode(bytes)
}
