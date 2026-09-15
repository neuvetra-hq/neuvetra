import { M64_UUID, M64_HASH, safeWorksheetText } from "./m64"
import { m67Hash, m67CanonicalJson, readAnnualElectricityWorksheet } from "./m67"
import { M67_MONTHS, type AnnualWorksheetVersion } from "./m67-contract"
import { type ElectricitySource } from "./m66-contract"
import { readElectricitySources } from "./m66-sources"
import { M68_PROFILE, M68_LIMITATIONS, type AnnualEvidenceInput, type AnnualEvidenceCorrection, type AnnualEvidenceLinkInput, type AnnualEvidenceLink, type AnnualEvidenceCoverage, type AnnualEvidenceVersion, type AnnualElectricityEvidence, type AnnualEvidenceReviewInput, type AnnualEvidenceReview } from "./m68-contract"
export * from "./m68-contract"
export class AnnualEvidenceValidationError extends Error {}
const invalid=(message="Select an exact annual version and supported January bills with discrepancy explanations."):never=>{throw new AnnualEvidenceValidationError(message)}
const exactKeys=(value:unknown,keys:string[]):value is Record<string,unknown>=>Boolean(value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).sort().join("|")===keys.sort().join("|"))
const uuid=(v:unknown)=>typeof v==="string"&&M64_UUID.test(v)
const hash=(v:unknown)=>typeof v==="string"&&M64_HASH.test(v)
export function validateAnnualEvidenceInput(value:unknown,correction:boolean):AnnualEvidenceInput|AnnualEvidenceCorrection {
 if(!exactKeys(value,["annualVersionId","expectedAnnualInputSha256","expectedAnnualResultSha256","links","idempotencyKey",...(correction?["expectedVersionId","expectedResultSha256","correctionReason"]:[])]))return invalid()
 if(!uuid(value.annualVersionId)||!uuid(value.idempotencyKey)||!hash(value.expectedAnnualInputSha256)||!hash(value.expectedAnnualResultSha256)||!Array.isArray(value.links)||value.links.length>2)return invalid()
 if(correction&&(!uuid(value.expectedVersionId)||!hash(value.expectedResultSha256)||!safeWorksheetText(value.correctionReason,500)))return invalid()
 const ids=new Set<string>(),hashes=new Set<string>()
 for(const l of value.links){
  if(!exactKeys(l,["month","sourceId","expectedSourceSha256","sourcePage","manualConfirmation","quantityDifferenceReason"])||l.month!=="2023-01"||!uuid(l.sourceId)||!hash(l.expectedSourceSha256)||l.sourcePage!==1||l.manualConfirmation!==true||(l.quantityDifferenceReason!==null&&!safeWorksheetText(l.quantityDifferenceReason,500)))return invalid()
  if(ids.has(l.sourceId as string)||hashes.has(l.expectedSourceSha256 as string))return invalid("Duplicate source IDs or identical bill bytes cannot be linked twice.")
  ids.add(l.sourceId as string);hashes.add(l.expectedSourceSha256 as string)
 }
 return value as AnnualEvidenceInput|AnnualEvidenceCorrection
}
export function validateAnnualEvidenceLinks(annual:AnnualWorksheetVersion,links:AnnualEvidenceLinkInput[],sources:ElectricitySource[]) {
 for(const link of links){
  const source=sources.find(s=>s.id===link.sourceId)
  if(!source||source.sha256!==link.expectedSourceSha256||annual.months[0]!.quantityKwh===null)return invalid()
  if(source.printedQuantityKwh===annual.months[0]!.quantityKwh?link.quantityDifferenceReason!==null:!safeWorksheetText(link.quantityDifferenceReason,500))return invalid()
 }
}
export function annualEvidenceCoverage(annual:AnnualWorksheetVersion,links:AnnualEvidenceLink[]):AnnualEvidenceCoverage {
 return {enteredMonths:annual.coverage.knownMonths,missingInputMonths:annual.coverage.missingMonths,linkedDocumentMonths:links.length?1:0,unambiguousDocumentMonths:links.length===1?1:0,missingDocumentMonths:M67_MONTHS.filter(m=>m!=="2023-01"||links.length===0),overlappingDocumentMonths:links.length>1?["2023-01"]:[],quantityDifferenceMonths:links.some(l=>l.source.printedQuantityKwh!==annual.months[0]!.quantityKwh)?["2023-01"]:[]}
}
export function validateAnnualEvidenceReview(value:unknown):AnnualEvidenceReviewInput {
 if(!exactKeys(value,["versionId","expectedResultSha256","decision","note","acknowledgedLimitations","idempotencyKey"])||!uuid(value.versionId)||!uuid(value.idempotencyKey)||!hash(value.expectedResultSha256))return invalid()
 if(value.decision==="accept_bounded_internal_draft"){
  if(value.note!==null||m67CanonicalJson(value.acknowledgedLimitations)!==m67CanonicalJson(M68_LIMITATIONS))return invalid()
 }else if(value.decision!=="changes_requested"||!safeWorksheetText(value.note,500)||m67CanonicalJson(value.acknowledgedLimitations)!=="[]")return invalid()
 return value as AnnualEvidenceReviewInput
}
export function annualEvidenceEffectiveInput(v:AnnualEvidenceVersion) {
 return {annualVersionId:v.annual.id,expectedAnnualInputSha256:v.annual.inputSha256,expectedAnnualResultSha256:v.annual.resultSha256,links:v.links.map(l=>({month:l.month,sourceId:l.source.id,expectedSourceSha256:l.source.sha256,sourcePage:l.page,manualConfirmation:true,quantityDifferenceReason:l.quantityDifferenceReason})).sort((a,b)=>a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:0)}
}
export function annualEvidenceInputHash(companyId:string,v:AnnualEvidenceVersion) {return m67Hash({profile:M68_PROFILE,companyId,id:v.id,version:v.version,previousVersionId:v.previousVersionId,createdBy:v.createdBy,createdAt:v.createdAt,...annualEvidenceEffectiveInput(v),correctionReason:v.correctionReason})}
export function annualEvidenceResultHash(inputSha256:string,v:AnnualEvidenceVersion) {return m67Hash({inputSha256,annual:v.annual,links:v.links,coverage:v.coverage,limitations:[...M68_LIMITATIONS],synthetic:true,complete:false,releaseEligible:false,assurance:"none"})}
export function annualEvidenceReviewHash(companyId:string,r:AnnualEvidenceReview) {const {decisionSha256:_hash,...record}=r;return m67Hash({profile:M68_PROFILE,companyId,...record})}
interface Sql {query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}>}
export async function readAnnualElectricityEvidence(tx:Sql,companyId:string):Promise<AnnualElectricityEvidence|null> {
 const allowed=await tx.query<{allowed:boolean}>("select neuvetra.lock_annual_electricity_report_read($1) allowed",[companyId]);if(!allowed.rows[0]?.allowed)return null
 type VersionRow={id:string;company_id:string;version:number;previous_version_id:string|null;payload:Omit<AnnualEvidenceVersion,"review">;input_sha256:string;result_sha256:string;created_by:string;created_at:string}
 type ReviewRow={id:string;company_id:string;version_id:string;payload:AnnualEvidenceReview;decision_sha256:string;reviewed_by:string;reviewed_at:string}
 type AuditRow={record_id:string;kind:string;record_sha256:string;actor_id:string;created_at:string}
 const all=(await tx.query<{versions:VersionRow[];reviews:ReviewRow[];audits:AuditRow[]}>(`select
 coalesce((select jsonb_agg(v order by version) from neuvetra.annual_electricity_evidence_versions v where company_id=$1),'[]'::jsonb) versions,
 coalesce((select jsonb_agg(r) from neuvetra.annual_electricity_evidence_reviews r where company_id=$1),'[]'::jsonb) reviews,
 coalesce((select jsonb_agg(a) from neuvetra.annual_electricity_evidence_audit a where company_id=$1),'[]'::jsonb) audits`,[companyId])).rows[0]!
 const fail=():never=>{throw new Error("Annual worksheet could not be verified.")},iso=(s:string)=>{const d=new Date(s);return Number.isFinite(d.getTime())?d.toISOString():fail()}
 const annual=await readAnnualElectricityWorksheet(tx,companyId),sources=await readElectricitySources(tx,companyId)
 if(!annual||!sources)return fail()
 const versions:AnnualEvidenceVersion[]=[]
 if(all.audits.length!==all.versions.length+all.reviews.length)return fail()
 for(const row of all.versions){
  const p=row.payload,previous=versions[versions.length-1]
  if(!exactKeys(p,["id","version","previousVersionId","createdBy","createdAt","annual","links","coverage","correctionReason","inputSha256","resultSha256"]))return fail()
  const v={...p,review:null} as AnnualEvidenceVersion
  if(v.id!==row.id||!M64_UUID.test(v.id)||row.company_id!==companyId||v.version!==versions.length+1||v.version!==row.version||v.previousVersionId!==row.previous_version_id||v.previousVersionId!==(previous?.id??null)||!M64_UUID.test(v.createdBy)||v.createdBy!==row.created_by||v.createdAt!==iso(row.created_at))return fail()
  const base=annual.versions.find(a=>a.id===v.annual?.id)
  if(!base||m67CanonicalJson(v.annual)!==m67CanonicalJson({...base,review:null})||v.createdAt<base.createdAt||!Array.isArray(v.links))return fail()
  const inputs:AnnualEvidenceLinkInput[]=[]
  for(const link of v.links){
   if(!exactKeys(link,["month","source","page","periodStart","periodEnd","confirmedBy","confirmedAt","quantityDifferenceReason"]))return fail()
   const source=sources.list.sources.find(s=>s.id===link.source?.id)
   if(!source||m67CanonicalJson(source)!==m67CanonicalJson(link.source)||link.periodStart!=="2023-01-01"||link.periodEnd!=="2023-01-31"||link.confirmedBy!==v.createdBy||link.confirmedAt!==v.createdAt||v.createdAt<source.uploadedAt)return fail()
   inputs.push({month:link.month,sourceId:source.id,expectedSourceSha256:source.sha256,sourcePage:link.page,manualConfirmation:true,quantityDifferenceReason:link.quantityDifferenceReason})
  }
  try{validateAnnualEvidenceInput({annualVersionId:base.id,expectedAnnualInputSha256:base.inputSha256,expectedAnnualResultSha256:base.resultSha256,links:inputs,idempotencyKey:v.id},false);validateAnnualEvidenceLinks(v.annual,inputs,sources.list.sources)}catch{return fail()}
  if(previous?(!safeWorksheetText(v.correctionReason,500)||v.createdAt<previous.createdAt||m67CanonicalJson(annualEvidenceEffectiveInput(previous))===m67CanonicalJson(annualEvidenceEffectiveInput(v))):v.correctionReason!==null)return fail()
  if(m67CanonicalJson(v.coverage)!==m67CanonicalJson(annualEvidenceCoverage(v.annual,v.links))||v.inputSha256!==row.input_sha256||v.inputSha256!==annualEvidenceInputHash(companyId,v)||v.resultSha256!==row.result_sha256||v.resultSha256!==annualEvidenceResultHash(v.inputSha256,v))return fail()
  const event=all.audits.filter(a=>a.kind==="save"&&a.record_id===v.id)
  if(event.length!==1||event[0]!.record_sha256!==v.resultSha256||event[0]!.actor_id!==v.createdBy||iso(event[0]!.created_at)!==v.createdAt)return fail()
  const reviews=all.reviews.filter(r=>r.version_id===v.id);if(reviews.length>1)return fail()
  if(reviews[0]){
   const r=reviews[0],review=r.payload
   if(!exactKeys(review,["id","versionId","resultSha256","decision","note","acknowledgedLimitations","reviewerId","reviewedAt","decisionSha256"]))return fail()
   try{validateAnnualEvidenceReview({versionId:review.versionId,expectedResultSha256:review.resultSha256,decision:review.decision,note:review.note,acknowledgedLimitations:review.acknowledgedLimitations,idempotencyKey:r.id})}catch{return fail()}
   if(r.company_id!==companyId||review.id!==r.id||review.versionId!==v.id||review.resultSha256!==v.resultSha256||review.reviewerId!==r.reviewed_by||!M64_UUID.test(review.reviewerId)||review.reviewerId===v.createdBy||review.reviewedAt!==iso(r.reviewed_at)||review.reviewedAt<v.createdAt||review.decisionSha256!==r.decision_sha256||review.decisionSha256!==annualEvidenceReviewHash(companyId,review))return fail()
   const audit=all.audits.filter(a=>a.kind==="review"&&a.record_id===review.id)
   if(audit.length!==1||audit[0]!.record_sha256!==review.decisionSha256||audit[0]!.actor_id!==review.reviewerId||iso(audit[0]!.created_at)!==review.reviewedAt)return fail()
   v.review=review
  }
  versions.push(v)
 }
 if(all.reviews.some(r=>!versions.some(v=>v.id===r.version_id)))return fail()
 return {profile:M68_PROFILE,companyId,synthetic:true,complete:false,releaseEligible:false,assurance:"none",limitations:[...M68_LIMITATIONS],versions}
}
