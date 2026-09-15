import { M64_HASH, M64_UUID, m64Hash } from "./m64"
import { readAnnualElectricityWorksheet, m67Hash } from "./m67"
import { M67_REPORT_PROFILE, M67_TEMPLATE_VERSION, M67_MAX_REPORT_BYTES, type AnnualWorksheetReport, type AnnualWorksheetReportInput, type AnnualWorksheetReportList } from "./m67-contract"
import { M67_TEMPLATE, M67_TEMPLATE_SHA256 } from "./m67-template"
import type { AnnualWorksheetVersion } from "./m67-contract"
import type { WorkspaceSql } from "./workspace"
export * from "./m67-contract"
export { M67_TEMPLATE_SHA256 } from "./m67-template"
export class AnnualWorksheetReportValidationError extends Error {}
export function validateAnnualWorksheetReportInput(value: unknown): AnnualWorksheetReportInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnnualWorksheetReportValidationError("Invalid report request.")
  const p=value as Record<string,unknown>
  if(Object.keys(p).sort().join("|")!==["sourceVersionId","expectedInputSha256","expectedResultSha256","expectedReviewId","expectedReviewSha256","idempotencyKey"].sort().join("|") || typeof p.sourceVersionId!=="string" || !M64_UUID.test(p.sourceVersionId) || typeof p.idempotencyKey!=="string" || !M64_UUID.test(p.idempotencyKey) || typeof p.expectedInputSha256!=="string" || !M64_HASH.test(p.expectedInputSha256) || typeof p.expectedResultSha256!=="string" || !M64_HASH.test(p.expectedResultSha256) || !((p.expectedReviewId===null&&p.expectedReviewSha256===null)||(typeof p.expectedReviewId==="string"&&M64_UUID.test(p.expectedReviewId)&&typeof p.expectedReviewSha256==="string"&&M64_HASH.test(p.expectedReviewSha256)))) throw new AnnualWorksheetReportValidationError("Invalid report request.")
  return value as AnnualWorksheetReportInput
}
export function annualWorksheetReportIdentity(companyId:string,source:AnnualWorksheetVersion):string {
  return m67Hash({profile:M67_REPORT_PROFILE,companyId,sourceVersionId:source.id,inputSha256:source.inputSha256,resultSha256:source.resultSha256,reviewId:source.review?.id??null,reviewSha256:source.review?.decisionSha256??null,templateVersion:M67_TEMPLATE_VERSION,templateSha256:M67_TEMPLATE_SHA256})
}
interface BuildContext { id:string; companyId:string; createdBy:string; createdAt:string; source:AnnualWorksheetVersion }
const escapeHtml=(text:string)=>text.replace(/[&<>"'{}]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","{":"&#123;","}":"&#125;"})[c]!)
export function buildAnnualWorksheetReport(context:BuildContext):{bytes:Uint8Array; reportSha256:string; identitySha256:string} {
  if(m64Hash(M67_TEMPLATE)!==M67_TEMPLATE_SHA256) throw new Error("Report template pin mismatch.")
  const {source:s}=context,r=s.review,m=s.method,identitySha256=annualWorksheetReportIdentity(context.companyId,s)
  const values:Record<string,string>={
    subtotalLabel:s.coverage.electricityComplete?"Full-year electricity subtotal — all 12 months entered":"Entered-month electricity subtotal",knownMonths:String(s.coverage.knownMonths),coverageNote:s.coverage.electricityComplete?"Full electricity period coverage for this fictional facility; the overall company inventory remains incomplete.":"This subtotal excludes months not entered.",missingMonths:s.coverage.missingMonths.join(", ")||"None — all 12 months entered",
    companyLabel:s.companyLabel,facilityLabel:s.facilityLabel,display:s.total.display,unrounded:s.total.unrounded,quantityKwh:s.quantityKwh,quantityMwh:s.quantityMwh,
    reviewSummary:!r?"No worksheet review was recorded when this report was created.":r.decision==="accept_bounded_internal_draft"?"The worksheet version was accepted for bounded internal use.":"A manager requested changes to this worksheet version.",
    sourceVersion:String(s.version),sourceVersionId:s.id,resultSha256:s.resultSha256,reviewerId:r?.reviewerId??"Not recorded at capture",reviewedAt:r?.reviewedAt??"Not recorded at capture",reviewId:r?.id??"None at capture",reviewSha256:r?.decisionSha256??"None at capture",reviewAcknowledgments:r?.acknowledgedLimitations.join(", ")||"No acceptance acknowledgments",reviewNote:r?.note??"No change-request note at capture",
    createdAt:context.createdAt,sourceCreatedAt:s.createdAt,sourceCreatedBy:s.createdBy,previousVersionId:s.previousVersionId??"None — initial saved version",correctionReason:s.correctionReason??"Initial saved version — no correction",companyId:context.companyId,inputSha256:s.inputSha256,
    methodId:m.id,methodVersion:m.version,factorId:m.factorId,factorVersion:m.factorVersion,factorValue:m.factorValue,sourceSha256:m.sourceSha256,factorCandidateSha256:m.factorCandidateSha256,gwpPolicySha256:m.gwpPolicySha256,reviewedEngineSha256:m.reviewedEngineSha256,
    reportId:context.id,createdBy:context.createdBy,profile:M67_REPORT_PROFILE,templateVersion:M67_TEMPLATE_VERSION,templateSha256:M67_TEMPLATE_SHA256,identitySha256,
  }
  for(let i=0;i<12;i++){const row=s.months[i]!,n=String(i+1).padStart(2,"0");values["month"+n+"State"]=row.quantityKwh===null?"Not entered":row.quantityKwh==="0.000"?"Entered zero":"Entered";values["month"+n+"QuantityKwh"]=row.quantityKwh??"Not entered";values["month"+n+"QuantityMwh"]=row.quantityMwh??"Not entered";values["month"+n+"Unrounded"]=row.total?.unrounded??"Not entered";values["month"+n+"Display"]=row.total?.display??"Not entered"}
  const html=M67_TEMPLATE.replace(/\{\{([a-zA-Z0-9]+)\}\}/g,(_match,key:string)=>{if(!Object.prototype.hasOwnProperty.call(values,key))throw new Error("Unknown report template field.");return escapeHtml(values[key]!)})
  const bytes=new TextEncoder().encode(html)
  if(bytes.byteLength>M67_MAX_REPORT_BYTES || /\{\{[a-zA-Z0-9]+\}\}/.test(html)) throw new Error("Report template could not be resolved.")
  return {bytes,reportSha256:new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),identitySha256}
}
function canonical(value:unknown):string { if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(",")}}` }
interface ReportRow {id:string;company_id:string;source_version_id:string;source_input_sha256:string;source_result_sha256:string;review_id:string|null;review_sha256:string|null;template_version:string;template_sha256:string;source_snapshot:AnnualWorksheetVersion;report_bytes:Uint8Array;report_sha256:string;report_byte_length:number;operation_fingerprint:string;created_by:string;created_at:string}
export async function readAnnualWorksheetReports(tx:WorkspaceSql,companyId:string):Promise<{list:AnnualWorksheetReportList;bytes:Map<string,Uint8Array>}|null> {
  const gate=await tx.query<{allowed:boolean}>("select neuvetra.lock_annual_electricity_report_read($1) allowed",[companyId])
  if(!gate.rows[0]?.allowed)return null
  const worksheet=await readAnnualElectricityWorksheet(tx,companyId)
  if(!worksheet)return null
  const rows=await tx.query<ReportRow>("select * from neuvetra.annual_electricity_reports where company_id=$1 order by created_at,id",[companyId])
  const audits=await tx.query<{report_id:string;actor_id:string;event_meta:unknown;created_at:string}>("select * from neuvetra.annual_electricity_report_audit where company_id=$1",[companyId])
  const fail=()=>{throw new Error("Worksheet report could not be verified.")}
  const iso=(raw:string)=>{const date=new Date(raw);if(!Number.isFinite(date.getTime()))return fail();return date.toISOString()}
  if(audits.rows.length!==rows.rows.length)return fail()
  const reports:AnnualWorksheetReport[]=[], bytes=new Map<string,Uint8Array>()
  for(const row of rows.rows){
    const current=worksheet.versions.find(v=>v.id===row.source_version_id),snapshot=row.source_snapshot
    if(!current || row.company_id!==companyId || !M64_UUID.test(row.id) || !M64_UUID.test(row.created_by) || row.template_version!==M67_TEMPLATE_VERSION || row.template_sha256!==M67_TEMPLATE_SHA256 || row.source_input_sha256!==current.inputSha256 || row.source_result_sha256!==current.resultSha256 || snapshot.id!==current.id || row.review_id!==(snapshot.review?.id??null) || row.review_sha256!==(snapshot.review?.decisionSha256??null))return fail()
    // A previously captured absence remains absent; a captured decision must still resolve exactly.
    const expected={...current,review:snapshot.review===null?null:current.review}
    if(canonical(snapshot)!==canonical(expected))return fail()
    const createdAt=iso(row.created_at)
    if(createdAt<current.createdAt || (snapshot.review && createdAt<snapshot.review.reviewedAt) || (!snapshot.review && current.review && createdAt>current.review.reviewedAt))return fail()
    const built=buildAnnualWorksheetReport({id:row.id,companyId,createdBy:row.created_by,createdAt,source:snapshot})
    if(built.identitySha256!==row.operation_fingerprint || built.reportSha256!==row.report_sha256 || built.bytes.byteLength!==row.report_byte_length || !Buffer.from(built.bytes).equals(Buffer.from(row.report_bytes)))return fail()
    const meta={profile:M67_REPORT_PROFILE,reportId:row.id,sourceVersionId:current.id,inputSha256:current.inputSha256,resultSha256:current.resultSha256,reviewId:row.review_id,reviewSha256:row.review_sha256,templateVersion:M67_TEMPLATE_VERSION,templateSha256:M67_TEMPLATE_SHA256,reportSha256:row.report_sha256,reportByteLength:row.report_byte_length,identitySha256:built.identitySha256}
    const event=audits.rows.filter(a=>a.report_id===row.id)
    if(event.length!==1 || event[0]!.actor_id!==row.created_by || iso(event[0]!.created_at)!==createdAt || canonical(event[0]!.event_meta)!==canonical(meta))return fail()
    reports.push({id:row.id,companyId,profile:M67_REPORT_PROFILE,sourceVersionId:current.id,sourceVersion:current.version,inputSha256:current.inputSha256,resultSha256:current.resultSha256,reviewId:row.review_id,reviewSha256:row.review_sha256,reviewState:!snapshot.review?"unreviewed":snapshot.review.decision==="accept_bounded_internal_draft"?"accepted_bounded_internal_draft":"changes_requested",templateVersion:M67_TEMPLATE_VERSION,templateSha256:M67_TEMPLATE_SHA256,reportSha256:row.report_sha256,reportByteLength:row.report_byte_length,createdBy:row.created_by,createdAt,synthetic:true,complete:false,releaseEligible:false,assurance:"none",source:snapshot})
    bytes.set(row.id,built.bytes)
  }
  return {list:{profile:M67_REPORT_PROFILE,companyId,reports},bytes}
}

