import { M64_HASH, M64_UUID, m64Hash } from "./m64"
import { readSourceElectricityWorksheet } from "./m66"
import { M66_REPORT_PROFILE, M66_TEMPLATE_VERSION, M66_MAX_REPORT_BYTES, type SourceWorksheetReport, type SourceWorksheetReportInput, type SourceWorksheetReportList } from "./m66-contract"
import { M66_TEMPLATE, M66_TEMPLATE_SHA256 } from "./m66-template"
import type { SourceWorksheetVersion } from "./m66-contract"
import type { WorkspaceSql } from "./workspace"
export * from "./m66-contract"
export { M66_TEMPLATE_SHA256 } from "./m66-template"
export class SourceWorksheetReportValidationError extends Error {}
export function validateSourceWorksheetReportInput(value: unknown): SourceWorksheetReportInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SourceWorksheetReportValidationError("Invalid report request.")
  const p=value as Record<string,unknown>
  if(Object.keys(p).sort().join("|")!==["sourceVersionId","expectedInputSha256","expectedResultSha256","expectedReviewId","expectedReviewSha256","idempotencyKey"].sort().join("|") || typeof p.sourceVersionId!=="string" || !M64_UUID.test(p.sourceVersionId) || typeof p.idempotencyKey!=="string" || !M64_UUID.test(p.idempotencyKey) || typeof p.expectedInputSha256!=="string" || !M64_HASH.test(p.expectedInputSha256) || typeof p.expectedResultSha256!=="string" || !M64_HASH.test(p.expectedResultSha256) || !((p.expectedReviewId===null&&p.expectedReviewSha256===null)||(typeof p.expectedReviewId==="string"&&M64_UUID.test(p.expectedReviewId)&&typeof p.expectedReviewSha256==="string"&&M64_HASH.test(p.expectedReviewSha256)))) throw new SourceWorksheetReportValidationError("Invalid report request.")
  return value as SourceWorksheetReportInput
}
export function sourceWorksheetReportIdentity(companyId:string,source:SourceWorksheetVersion):string {
  return m64Hash([M66_REPORT_PROFILE,companyId,source.id,source.inputSha256,source.resultSha256,source.review?.id??"<none>",source.review?.decisionSha256??"<none>",M66_TEMPLATE_VERSION,M66_TEMPLATE_SHA256].join("\n"))
}
interface BuildContext { id:string; companyId:string; createdBy:string; createdAt:string; source:SourceWorksheetVersion }
const escapeHtml=(text:string)=>text.replace(/[&<>"'{}]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","{":"&#123;","}":"&#125;"})[c]!)
export function buildSourceWorksheetReport(context:BuildContext):{bytes:Uint8Array; reportSha256:string; identitySha256:string} {
  if(m64Hash(M66_TEMPLATE)!==M66_TEMPLATE_SHA256) throw new Error("Report template pin mismatch.")
  const {source:s}=context,r=s.review,m=s.method,identitySha256=sourceWorksheetReportIdentity(context.companyId,s)
  const values:Record<string,string>={
    evidenceId:s.evidence.source.id,fixtureId:s.evidence.source.fixtureId,evidenceName:s.evidence.source.originalName,evidenceBytes:String(s.evidence.source.byteLength),evidenceSha256:s.evidence.source.sha256,printedQuantityKwh:s.evidence.source.printedQuantityKwh,sourcePage:String(s.evidence.page),uploadedBy:s.evidence.source.uploadedBy,uploadedAt:s.evidence.source.uploadedAt,confirmedBy:s.evidence.confirmedBy,confirmedAt:s.evidence.confirmedAt,quantityDifference:s.evidence.quantityDifferenceReason===null?"The manual worksheet quantity matches the printed fictional bill quantity; this is not independent verification.":"Manual worksheet quantity differs from the bill: "+s.evidence.quantityDifferenceReason,
    companyLabel:s.companyLabel,facilityLabel:s.facilityLabel,display:s.total.display,unrounded:s.total.unrounded,quantityKwh:s.quantityKwh,quantityMwh:s.quantityMwh,
    reviewSummary:!r?"No worksheet review was recorded when this report was created.":r.decision==="accept_bounded_internal_draft"?"The worksheet version was accepted for bounded internal use.":"A manager requested changes to this worksheet version.",
    sourceVersion:String(s.version),sourceVersionId:s.id,resultSha256:s.resultSha256,reviewerId:r?.reviewerId??"Not recorded at capture",reviewedAt:r?.reviewedAt??"Not recorded at capture",reviewId:r?.id??"None at capture",reviewSha256:r?.decisionSha256??"None at capture",reviewAcknowledgments:r?.acknowledgedLimitations.join(", ")||"No acceptance acknowledgments",reviewNote:r?.note??"No change-request note at capture",
    createdAt:context.createdAt,sourceCreatedAt:s.createdAt,sourceCreatedBy:s.createdBy,previousVersionId:s.previousVersionId??"None — initial saved version",correctionReason:s.correctionReason??"Initial saved version — no correction",companyId:context.companyId,inputSha256:s.inputSha256,
    methodId:m.id,methodVersion:m.version,factorId:m.factorId,factorVersion:m.factorVersion,factorValue:m.factorValue,sourceSha256:m.sourceSha256,factorCandidateSha256:m.factorCandidateSha256,gwpPolicySha256:m.gwpPolicySha256,reviewedEngineSha256:m.reviewedEngineSha256,
    reportId:context.id,createdBy:context.createdBy,profile:M66_REPORT_PROFILE,templateVersion:M66_TEMPLATE_VERSION,templateSha256:M66_TEMPLATE_SHA256,identitySha256,
  }
  const html=M66_TEMPLATE.replace(/\{\{([a-zA-Z0-9]+)\}\}/g,(_match,key:string)=>{if(!Object.prototype.hasOwnProperty.call(values,key))throw new Error("Unknown report template field.");return escapeHtml(values[key]!)})
  const bytes=new TextEncoder().encode(html)
  if(bytes.byteLength>M66_MAX_REPORT_BYTES || /\{\{[a-zA-Z0-9]+\}\}/.test(html)) throw new Error("Report template could not be resolved.")
  return {bytes,reportSha256:new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),identitySha256}
}
function canonical(value:unknown):string { if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(",")}}` }
interface ReportRow {id:string;company_id:string;source_version_id:string;source_input_sha256:string;source_result_sha256:string;review_id:string|null;review_sha256:string|null;template_version:string;template_sha256:string;source_snapshot:SourceWorksheetVersion;report_bytes:Uint8Array;report_sha256:string;report_byte_length:number;operation_fingerprint:string;created_by:string;created_at:string}
export async function readSourceWorksheetReports(tx:WorkspaceSql,companyId:string):Promise<{list:SourceWorksheetReportList;bytes:Map<string,Uint8Array>}|null> {
  const gate=await tx.query<{allowed:boolean}>("select neuvetra.lock_source_worksheet_report_read($1) allowed",[companyId])
  if(!gate.rows[0]?.allowed)return null
  const worksheet=await readSourceElectricityWorksheet(tx,companyId)
  if(!worksheet)return null
  const rows=await tx.query<ReportRow>("select * from neuvetra.source_worksheet_reports where company_id=$1 order by created_at,id",[companyId])
  const audits=await tx.query<{report_id:string;actor_id:string;event_meta:unknown;created_at:string}>("select * from neuvetra.source_worksheet_report_audit where company_id=$1",[companyId])
  const fail=()=>{throw new Error("Worksheet report could not be verified.")}
  const iso=(raw:string)=>{const date=new Date(raw);if(!Number.isFinite(date.getTime()))return fail();return date.toISOString()}
  if(audits.rows.length!==rows.rows.length)return fail()
  const reports:SourceWorksheetReport[]=[], bytes=new Map<string,Uint8Array>()
  for(const row of rows.rows){
    const current=worksheet.versions.find(v=>v.id===row.source_version_id),snapshot=row.source_snapshot
    if(!current || row.company_id!==companyId || !M64_UUID.test(row.id) || !M64_UUID.test(row.created_by) || row.template_version!==M66_TEMPLATE_VERSION || row.template_sha256!==M66_TEMPLATE_SHA256 || row.source_input_sha256!==current.inputSha256 || row.source_result_sha256!==current.resultSha256 || snapshot.id!==current.id || row.review_id!==(snapshot.review?.id??null) || row.review_sha256!==(snapshot.review?.decisionSha256??null))return fail()
    // A previously captured absence remains absent; a captured decision must still resolve exactly.
    const expected={...current,review:snapshot.review===null?null:current.review}
    if(canonical(snapshot)!==canonical(expected))return fail()
    const createdAt=iso(row.created_at)
    if(createdAt<current.createdAt || (snapshot.review && createdAt<snapshot.review.reviewedAt) || (!snapshot.review && current.review && createdAt>current.review.reviewedAt))return fail()
    const built=buildSourceWorksheetReport({id:row.id,companyId,createdBy:row.created_by,createdAt,source:snapshot})
    if(built.identitySha256!==row.operation_fingerprint || built.reportSha256!==row.report_sha256 || built.bytes.byteLength!==row.report_byte_length || !Buffer.from(built.bytes).equals(Buffer.from(row.report_bytes)))return fail()
    const meta={profile:M66_REPORT_PROFILE,reportId:row.id,sourceVersionId:current.id,inputSha256:current.inputSha256,resultSha256:current.resultSha256,reviewId:row.review_id,reviewSha256:row.review_sha256,templateVersion:M66_TEMPLATE_VERSION,templateSha256:M66_TEMPLATE_SHA256,reportSha256:row.report_sha256,reportByteLength:row.report_byte_length,identitySha256:built.identitySha256}
    const event=audits.rows.filter(a=>a.report_id===row.id)
    if(event.length!==1 || event[0]!.actor_id!==row.created_by || iso(event[0]!.created_at)!==createdAt || canonical(event[0]!.event_meta)!==canonical(meta))return fail()
    reports.push({id:row.id,companyId,profile:M66_REPORT_PROFILE,sourceVersionId:current.id,sourceVersion:current.version,inputSha256:current.inputSha256,resultSha256:current.resultSha256,reviewId:row.review_id,reviewSha256:row.review_sha256,reviewState:!snapshot.review?"unreviewed":snapshot.review.decision==="accept_bounded_internal_draft"?"accepted_bounded_internal_draft":"changes_requested",templateVersion:M66_TEMPLATE_VERSION,templateSha256:M66_TEMPLATE_SHA256,reportSha256:row.report_sha256,reportByteLength:row.report_byte_length,createdBy:row.created_by,createdAt,synthetic:true,complete:false,releaseEligible:false,assurance:"none",source:snapshot})
    bytes.set(row.id,built.bytes)
  }
  return {list:{profile:M66_REPORT_PROFILE,companyId,reports},bytes}
}


