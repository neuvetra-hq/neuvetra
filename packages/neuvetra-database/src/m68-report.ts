import { M64_HASH, M64_UUID, m64Hash } from "./m64"
import { readAnnualElectricityEvidence } from "./m68"
import { m67Hash, m67CanonicalJson as canonical } from "./m67"
import { M68_REPORT_PROFILE, M68_TEMPLATE_VERSION, M68_MAX_REPORT_BYTES, type AnnualEvidenceReport, type AnnualEvidenceReportInput, type AnnualEvidenceReportList } from "./m68-contract"
import { M68_TEMPLATE, M68_TEMPLATE_SHA256 } from "./m68-template"
import type { AnnualEvidenceVersion } from "./m68-contract"
import type { WorkspaceSql } from "./workspace"
export * from "./m68-contract"
export { M68_TEMPLATE_SHA256 } from "./m68-template"
export class AnnualEvidenceReportValidationError extends Error {}
export function validateAnnualEvidenceReportInput(value: unknown): AnnualEvidenceReportInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AnnualEvidenceReportValidationError("Invalid report request.")
  const p=value as Record<string,unknown>
  if(Object.keys(p).sort().join("|")!==["sourceVersionId","expectedInputSha256","expectedResultSha256","expectedReviewId","expectedReviewSha256","idempotencyKey"].sort().join("|") || typeof p.sourceVersionId!=="string" || !M64_UUID.test(p.sourceVersionId) || typeof p.idempotencyKey!=="string" || !M64_UUID.test(p.idempotencyKey) || typeof p.expectedInputSha256!=="string" || !M64_HASH.test(p.expectedInputSha256) || typeof p.expectedResultSha256!=="string" || !M64_HASH.test(p.expectedResultSha256) || !((p.expectedReviewId===null&&p.expectedReviewSha256===null)||(typeof p.expectedReviewId==="string"&&M64_UUID.test(p.expectedReviewId)&&typeof p.expectedReviewSha256==="string"&&M64_HASH.test(p.expectedReviewSha256)))) throw new AnnualEvidenceReportValidationError("Invalid report request.")
  return value as AnnualEvidenceReportInput
}
export function annualEvidenceReportIdentity(companyId:string,source:AnnualEvidenceVersion):string {
  return m67Hash({profile:M68_REPORT_PROFILE,companyId,sourceVersionId:source.id,inputSha256:source.inputSha256,resultSha256:source.resultSha256,reviewId:source.review?.id??null,reviewSha256:source.review?.decisionSha256??null,templateVersion:M68_TEMPLATE_VERSION,templateSha256:M68_TEMPLATE_SHA256})
}
interface BuildContext { id:string; companyId:string; createdBy:string; createdAt:string; source:AnnualEvidenceVersion }
const escapeHtml=(text:string)=>text.replace(/[&<>"'{}]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","{":"&#123;","}":"&#125;"})[c]!)
export function buildAnnualEvidenceReport(context:BuildContext):{bytes:Uint8Array;reportSha256:string;identitySha256:string} {
 if(m64Hash(M68_TEMPLATE)!==M68_TEMPLATE_SHA256)throw new Error("Report template pin mismatch.")
 const s=context.source,identitySha256=annualEvidenceReportIdentity(context.companyId,s)
 const scalar=(path:string[],fallback:string)=>{let v:unknown=s;for(const k of path)v=v&&typeof v==="object"?(v as Record<string,unknown>)[k]:undefined;return v===null||v===undefined?fallback:String(v)}
 const list=(v:string[]|undefined)=>v?.join(", ")||"None"
 const values:Record<string,string>={
"display":scalar(["annual", "total", "display"],"Not recorded"),
"unrounded":scalar(["annual", "total", "unrounded"],"Not recorded"),
"quantity":scalar(["annual", "quantityKwh"],"Not recorded"),
"mwh":scalar(["annual", "quantityMwh"],"Not recorded"),
"companyLabel":scalar(["annual", "companyLabel"],"Not recorded"),
"facilityLabel":scalar(["annual", "facilityLabel"],"Not recorded"),
"entered":scalar(["coverage", "enteredMonths"],"Not recorded"),
"attached":scalar(["coverage", "linkedDocumentMonths"],"Not recorded"),
"single":scalar(["coverage", "unambiguousDocumentMonths"],"Not recorded"),
"reviewer":scalar(["review", "reviewerId"],"Not recorded"),
"reviewAt":scalar(["review", "reviewedAt"],"Not recorded"),
"reviewId":scalar(["review", "id"],"Not recorded"),
"reviewHash":scalar(["review", "decisionSha256"],"Not recorded"),
"evidenceVersion":scalar(["version"],"Not recorded"),
"evidenceId":scalar(["id"],"Not recorded"),
"evidenceAt":scalar(["createdAt"],"Not recorded"),
"evidenceBy":scalar(["createdBy"],"Not recorded"),
"predecessor":scalar(["previousVersionId"],"Not recorded"),
"correctionReason":scalar(["correctionReason"],"Not recorded"),
"inputHash":scalar(["inputSha256"],"Not recorded"),
"resultHash":scalar(["resultSha256"],"Not recorded"),
"annualVersion":scalar(["annual", "version"],"Not recorded"),
"annualId":scalar(["annual", "id"],"Not recorded"),
"annualInput":scalar(["annual", "inputSha256"],"Not recorded"),
"annualResult":scalar(["annual", "resultSha256"],"Not recorded"),
"annualCorrection":scalar(["annual", "correctionReason"],"Not recorded"),
"reviewNote":scalar(["review", "note"],"No change-request note"),
"m0kwh":scalar(["annual", "months", "0", "quantityKwh"],"Not entered"),
"m0exact":scalar(["annual", "months", "0", "total", "unrounded"],"Not entered"),
"m0display":scalar(["annual", "months", "0", "total", "display"],"Not entered"),
"m1kwh":scalar(["annual", "months", "1", "quantityKwh"],"Not entered"),
"m1exact":scalar(["annual", "months", "1", "total", "unrounded"],"Not entered"),
"m1display":scalar(["annual", "months", "1", "total", "display"],"Not entered"),
"m2kwh":scalar(["annual", "months", "2", "quantityKwh"],"Not entered"),
"m2exact":scalar(["annual", "months", "2", "total", "unrounded"],"Not entered"),
"m2display":scalar(["annual", "months", "2", "total", "display"],"Not entered"),
"m3kwh":scalar(["annual", "months", "3", "quantityKwh"],"Not entered"),
"m3exact":scalar(["annual", "months", "3", "total", "unrounded"],"Not entered"),
"m3display":scalar(["annual", "months", "3", "total", "display"],"Not entered"),
"m4kwh":scalar(["annual", "months", "4", "quantityKwh"],"Not entered"),
"m4exact":scalar(["annual", "months", "4", "total", "unrounded"],"Not entered"),
"m4display":scalar(["annual", "months", "4", "total", "display"],"Not entered"),
"m5kwh":scalar(["annual", "months", "5", "quantityKwh"],"Not entered"),
"m5exact":scalar(["annual", "months", "5", "total", "unrounded"],"Not entered"),
"m5display":scalar(["annual", "months", "5", "total", "display"],"Not entered"),
"m6kwh":scalar(["annual", "months", "6", "quantityKwh"],"Not entered"),
"m6exact":scalar(["annual", "months", "6", "total", "unrounded"],"Not entered"),
"m6display":scalar(["annual", "months", "6", "total", "display"],"Not entered"),
"m7kwh":scalar(["annual", "months", "7", "quantityKwh"],"Not entered"),
"m7exact":scalar(["annual", "months", "7", "total", "unrounded"],"Not entered"),
"m7display":scalar(["annual", "months", "7", "total", "display"],"Not entered"),
"m8kwh":scalar(["annual", "months", "8", "quantityKwh"],"Not entered"),
"m8exact":scalar(["annual", "months", "8", "total", "unrounded"],"Not entered"),
"m8display":scalar(["annual", "months", "8", "total", "display"],"Not entered"),
"m9kwh":scalar(["annual", "months", "9", "quantityKwh"],"Not entered"),
"m9exact":scalar(["annual", "months", "9", "total", "unrounded"],"Not entered"),
"m9display":scalar(["annual", "months", "9", "total", "display"],"Not entered"),
"m10kwh":scalar(["annual", "months", "10", "quantityKwh"],"Not entered"),
"m10exact":scalar(["annual", "months", "10", "total", "unrounded"],"Not entered"),
"m10display":scalar(["annual", "months", "10", "total", "display"],"Not entered"),
"m11kwh":scalar(["annual", "months", "11", "quantityKwh"],"Not entered"),
"m11exact":scalar(["annual", "months", "11", "total", "unrounded"],"Not entered"),
"m11display":scalar(["annual", "months", "11", "total", "display"],"Not entered"),
"d0name":scalar(["links", "0", "source", "originalName"],"No document linked"),
"d0printed":scalar(["links", "0", "source", "printedQuantityKwh"],"Not linked"),
"d0page":scalar(["links", "0", "page"],"Not linked"),
"d0start":scalar(["links", "0", "periodStart"],"Not linked"),
"d0end":scalar(["links", "0", "periodEnd"],"Not linked"),
"d0reason":scalar(["links", "0", "quantityDifferenceReason"],"No discrepancy explanation recorded"),
"d0by":scalar(["links", "0", "confirmedBy"],"Not linked"),
"d0at":scalar(["links", "0", "confirmedAt"],"Not linked"),
"d0id":scalar(["links", "0", "source", "id"],"Not linked"),
"d0hash":scalar(["links", "0", "source", "sha256"],"Not linked"),
"d0bytes":scalar(["links", "0", "source", "byteLength"],"Not linked"),
"d0uploadBy":scalar(["links", "0", "source", "uploadedBy"],"Not linked"),
"d0uploadAt":scalar(["links", "0", "source", "uploadedAt"],"Not linked"),
"d1name":scalar(["links", "1", "source", "originalName"],"No document linked"),
"d1printed":scalar(["links", "1", "source", "printedQuantityKwh"],"Not linked"),
"d1page":scalar(["links", "1", "page"],"Not linked"),
"d1start":scalar(["links", "1", "periodStart"],"Not linked"),
"d1end":scalar(["links", "1", "periodEnd"],"Not linked"),
"d1reason":scalar(["links", "1", "quantityDifferenceReason"],"No discrepancy explanation recorded"),
"d1by":scalar(["links", "1", "confirmedBy"],"Not linked"),
"d1at":scalar(["links", "1", "confirmedAt"],"Not linked"),
"d1id":scalar(["links", "1", "source", "id"],"Not linked"),
"d1hash":scalar(["links", "1", "source", "sha256"],"Not linked"),
"d1bytes":scalar(["links", "1", "source", "byteLength"],"Not linked"),
"d1uploadBy":scalar(["links", "1", "source", "uploadedBy"],"Not linked"),
"d1uploadAt":scalar(["links", "1", "source", "uploadedAt"],"Not linked"),
"methodid":scalar(["annual", "method", "id"],"Not recorded"),
"methodversion":scalar(["annual", "method", "version"],"Not recorded"),
"methodfactorId":scalar(["annual", "method", "factorId"],"Not recorded"),
"methodfactorVersion":scalar(["annual", "method", "factorVersion"],"Not recorded"),
"methodfactorValue":scalar(["annual", "method", "factorValue"],"Not recorded"),
"methodsourceSha256":scalar(["annual", "method", "sourceSha256"],"Not recorded"),
"methodfactorCandidateSha256":scalar(["annual", "method", "factorCandidateSha256"],"Not recorded"),
"methodgwpPolicySha256":scalar(["annual", "method", "gwpPolicySha256"],"Not recorded"),
"methodreviewedEngineSha256":scalar(["annual", "method", "reviewedEngineSha256"],"Not recorded"),
 subtotalLabel:s.annual.coverage.electricityComplete?"Full-year electricity subtotal — all 12 months entered":"Entered-month electricity subtotal",
 missingInputs:list(s.coverage.missingInputMonths),missingDocuments:list(s.coverage.missingDocumentMonths),overlaps:list(s.coverage.overlappingDocumentMonths),differences:list(s.coverage.quantityDifferenceMonths),
 januaryDocuments:s.links.length>1?"Overlapping documents (not summed)":s.links.length?"One attached document (not verified)":"Missing document",
 reviewSummary:!s.review?"Unreviewed at report capture":s.review.decision==="accept_bounded_internal_draft"?"Accepted for bounded internal use":"Changes requested",
 acknowledgments:list(s.review?.acknowledgedLimitations),d0difference:difference(s,0),d1difference:difference(s,1),
 companyId:context.companyId,reportId:context.id,createdBy:context.createdBy,createdAt:context.createdAt,profile:M68_REPORT_PROFILE,templateVersion:M68_TEMPLATE_VERSION,templateSha256:M68_TEMPLATE_SHA256,identitySha256
 }
 const rendered=M68_TEMPLATE.replace(/\{\{([a-zA-Z0-9]+)\}\}/g,(_,key:string)=>{const v=values[key];if(v===undefined)throw new Error("Missing report field.");return escapeHtml(v)})
 const bytes=new TextEncoder().encode(rendered)
 if(bytes.byteLength>M68_MAX_REPORT_BYTES)throw new Error("Report is too large.")
 return {bytes,reportSha256:new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),identitySha256}
}
function difference(s:AnnualEvidenceVersion,index:number){const l=s.links[index];return !l?"No document linked.":l.source.printedQuantityKwh===s.annual.months[0]!.quantityKwh?"Printed and manual January quantities match; document and inputs remain unverified.":"Manual quantity differs from the fictional bill. Explanation recorded; difference remains."}
interface ReportRow {id:string;company_id:string;source_version_id:string;source_input_sha256:string;source_result_sha256:string;review_id:string|null;review_sha256:string|null;template_version:string;template_sha256:string;source_snapshot:AnnualEvidenceVersion;report_bytes:Uint8Array;report_sha256:string;report_byte_length:number;operation_fingerprint:string;created_by:string;created_at:string}
export async function readAnnualEvidenceReports(tx:WorkspaceSql,companyId:string):Promise<{list:AnnualEvidenceReportList;bytes:Map<string,Uint8Array>}|null> {
  const gate=await tx.query<{allowed:boolean}>("select neuvetra.lock_annual_electricity_report_read($1) allowed",[companyId])
  if(!gate.rows[0]?.allowed)return null
  const worksheet=await readAnnualElectricityEvidence(tx,companyId)
  if(!worksheet)return null
  const rows=await tx.query<ReportRow>("select * from neuvetra.annual_evidence_reports where company_id=$1 order by created_at,id",[companyId])
  const audits=await tx.query<{report_id:string;actor_id:string;event_meta:unknown;created_at:string}>("select * from neuvetra.annual_evidence_report_audit where company_id=$1",[companyId])
  const fail=()=>{throw new Error("Worksheet report could not be verified.")}
  const iso=(raw:string)=>{const date=new Date(raw);if(!Number.isFinite(date.getTime()))return fail();return date.toISOString()}
  if(audits.rows.length!==rows.rows.length)return fail()
  const reports:AnnualEvidenceReport[]=[], bytes=new Map<string,Uint8Array>()
  for(const row of rows.rows){
    const current=worksheet.versions.find(v=>v.id===row.source_version_id),snapshot=row.source_snapshot
    if(!current || row.company_id!==companyId || !M64_UUID.test(row.id) || !M64_UUID.test(row.created_by) || row.template_version!==M68_TEMPLATE_VERSION || row.template_sha256!==M68_TEMPLATE_SHA256 || row.source_input_sha256!==current.inputSha256 || row.source_result_sha256!==current.resultSha256 || snapshot.id!==current.id || row.review_id!==(snapshot.review?.id??null) || row.review_sha256!==(snapshot.review?.decisionSha256??null))return fail()
    // A previously captured absence remains absent; a captured decision must still resolve exactly.
    const expected={...current,review:snapshot.review===null?null:current.review}
    if(canonical(snapshot)!==canonical(expected))return fail()
    const createdAt=iso(row.created_at)
    if(createdAt<current.createdAt || (snapshot.review && createdAt<snapshot.review.reviewedAt) || (!snapshot.review && current.review && createdAt>current.review.reviewedAt))return fail()
    const built=buildAnnualEvidenceReport({id:row.id,companyId,createdBy:row.created_by,createdAt,source:snapshot})
    if(built.identitySha256!==row.operation_fingerprint || built.reportSha256!==row.report_sha256 || built.bytes.byteLength!==row.report_byte_length || !Buffer.from(built.bytes).equals(Buffer.from(row.report_bytes)))return fail()
    const meta={profile:M68_REPORT_PROFILE,reportId:row.id,sourceVersionId:current.id,inputSha256:current.inputSha256,resultSha256:current.resultSha256,reviewId:row.review_id,reviewSha256:row.review_sha256,templateVersion:M68_TEMPLATE_VERSION,templateSha256:M68_TEMPLATE_SHA256,reportSha256:row.report_sha256,reportByteLength:row.report_byte_length,identitySha256:built.identitySha256}
    const event=audits.rows.filter(a=>a.report_id===row.id)
    if(event.length!==1 || event[0]!.actor_id!==row.created_by || iso(event[0]!.created_at)!==createdAt || canonical(event[0]!.event_meta)!==canonical(meta))return fail()
    reports.push({id:row.id,companyId,profile:M68_REPORT_PROFILE,sourceVersionId:current.id,sourceVersion:current.version,inputSha256:current.inputSha256,resultSha256:current.resultSha256,reviewId:row.review_id,reviewSha256:row.review_sha256,reviewState:!snapshot.review?"unreviewed":snapshot.review.decision==="accept_bounded_internal_draft"?"accepted_bounded_internal_draft":"changes_requested",templateVersion:M68_TEMPLATE_VERSION,templateSha256:M68_TEMPLATE_SHA256,reportSha256:row.report_sha256,reportByteLength:row.report_byte_length,createdBy:row.created_by,createdAt,synthetic:true,complete:false,releaseEligible:false,assurance:"none",source:snapshot})
    bytes.set(row.id,built.bytes)
  }
  return {list:{profile:M68_REPORT_PROFILE,companyId,reports},bytes}
}

