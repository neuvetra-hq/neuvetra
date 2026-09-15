import { M64_UUID, M64_HASH, m64Hash, safeWorksheetText, calculateWorksheetQuantity } from "./m64"
import { M67_PROFILE, M67_MONTHS, M67_METHOD, M67_LIMITATIONS, M67_EVIDENCE_BASIS, type AnnualMonthInput, type AnnualMonthResult, type AnnualTotal, type AnnualWorksheetInput, type AnnualWorksheetCorrection, type AnnualWorksheetReviewInput, type AnnualWorksheetReview, type AnnualWorksheetVersion, type AnnualElectricityWorksheet } from "./m67-contract"
export * from "./m67-contract"
export class AnnualWorksheetValidationError extends Error {}
const invalid=():never=>{throw new AnnualWorksheetValidationError("Enter twelve ordered 2023 month slots with at least one valid quantity.")}
export function m67CanonicalJson(value:unknown):string {
 if(value===null||typeof value!=="object")return JSON.stringify(value)
 if(Array.isArray(value))return `[${value.map(m67CanonicalJson).join(",")}]`
 return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${m67CanonicalJson((value as Record<string,unknown>)[key])}`).join(",")}}`
}
export const m67Hash=(value:unknown)=>m64Hash(m67CanonicalJson(value))
const exactKeys=(value:unknown,keys:string[]):value is Record<string,unknown>=>Boolean(value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).sort().join("|")===keys.sort().join("|"))
const total=(unrounded:string,display:string):AnnualTotal=>({unrounded,display,unit:"kg CO2e",rounding:"half_even_4dp"})
const fixed=(n:bigint,places:number)=>{const s=n.toString().padStart(places+1,"0");return s.slice(0,-places)+"."+s.slice(-places)}
/** Sum integer milli-kWh. The annual sum intentionally bypasses the monthly cap. */
export function calculateAnnualMonths(value:unknown) {
 if(!Array.isArray(value)||value.length!==12)return invalid()
 let sum=0n,known=0
 const months:AnnualMonthResult[]=value.map((row,index)=>{
  if(!exactKeys(row,["month","quantityKwh"])||row.month!==M67_MONTHS[index])return invalid()
  if(row.quantityKwh===null)return {month:M67_MONTHS[index]!,quantityKwh:null,quantityMwh:null,total:null}
  if(typeof row.quantityKwh!=="string")return invalid()
  let calculated;try{calculated=calculateWorksheetQuantity(row.quantityKwh)}catch{return invalid()}
  sum+=BigInt(calculated.quantityKwh.replace(".",""));known++
  return {month:M67_MONTHS[index]!,quantityKwh:calculated.quantityKwh,quantityMwh:calculated.quantityMwh,total:total(calculated.unrounded,calculated.display)}
 })
 if(known===0||sum>12000000000n)return invalid()
 const scaled=sum*1950402888n,q=scaled/1000000000n,remainder=scaled%1000000000n
 const rounded=q+(remainder>500000000n||(remainder===500000000n&&q%2n===1n)?1n:0n)
 return {months,quantityKwh:fixed(sum,3),quantityMwh:fixed(sum,6),total:total(fixed(scaled,13).replace(/0+$/,"").replace(/\.$/,""),fixed(rounded,4)),coverage:{knownMonths:known,missingMonths:months.filter(m=>m.quantityKwh===null).map(m=>m.month),electricityComplete:known===12}}
}
export function validateAnnualWorksheetInput(value:unknown,correction:boolean):AnnualWorksheetInput|AnnualWorksheetCorrection {
 if(!exactKeys(value,["companyLabel","facilityLabel","year","geography","unit","months","idempotencyKey",...(correction?["expectedVersionId","expectedResultSha256","correctionReason"]:[])]))return invalid()
 if(!safeWorksheetText(value.companyLabel,100)||!safeWorksheetText(value.facilityLabel,100)||value.year!==2023||value.geography!=="CAMX"||value.unit!=="kWh"||typeof value.idempotencyKey!=="string"||!M64_UUID.test(value.idempotencyKey))return invalid()
 if(correction&&(typeof value.expectedVersionId!=="string"||!M64_UUID.test(value.expectedVersionId)||typeof value.expectedResultSha256!=="string"||!M64_HASH.test(value.expectedResultSha256)||!safeWorksheetText(value.correctionReason,500)))return invalid()
 calculateAnnualMonths(value.months)
 return value as AnnualWorksheetInput|AnnualWorksheetCorrection
}
export function validateAnnualWorksheetReview(value:unknown):AnnualWorksheetReviewInput {
 if(!exactKeys(value,["versionId","expectedResultSha256","decision","note","acknowledgedLimitations","idempotencyKey"])||typeof value.versionId!=="string"||!M64_UUID.test(value.versionId)||typeof value.expectedResultSha256!=="string"||!M64_HASH.test(value.expectedResultSha256)||typeof value.idempotencyKey!=="string"||!M64_UUID.test(value.idempotencyKey))return invalid()
 if(value.decision==="accept_bounded_internal_draft"){
  if(value.note!==null||m67CanonicalJson(value.acknowledgedLimitations)!==m67CanonicalJson(M67_LIMITATIONS))return invalid()
 }else if(value.decision!=="changes_requested"||!safeWorksheetText(value.note,500)||m67CanonicalJson(value.acknowledgedLimitations)!=="[]")return invalid()
 return value as AnnualWorksheetReviewInput
}
export function annualEffectiveInput(v:Pick<AnnualWorksheetVersion,"companyLabel"|"facilityLabel"|"year"|"geography"|"unit"|"months">) {
 return {companyLabel:v.companyLabel,facilityLabel:v.facilityLabel,year:v.year,geography:v.geography,unit:v.unit,evidenceBasis:M67_EVIDENCE_BASIS,months:v.months.map(({month,quantityKwh})=>({month,quantityKwh}))}
}
export function annualWorksheetInputHash(companyId:string,v:AnnualWorksheetVersion) {
 return m67Hash({profile:M67_PROFILE,companyId,id:v.id,version:v.version,previousVersionId:v.previousVersionId,createdBy:v.createdBy,createdAt:v.createdAt,...annualEffectiveInput(v),correctionReason:v.correctionReason})
}
export function annualWorksheetResultHash(inputSha256:string,v:AnnualWorksheetVersion) {
 return m67Hash({inputSha256,months:v.months,quantityKwh:v.quantityKwh,quantityMwh:v.quantityMwh,total:v.total,coverage:v.coverage,method:v.method,limitations:[...M67_LIMITATIONS],synthetic:true,complete:false,releaseEligible:false,assurance:"none"})
}
export function annualWorksheetReviewHash(companyId:string,r:AnnualWorksheetReview) {
 const {decisionSha256:_hash,...record}=r
 return m67Hash({profile:M67_PROFILE,companyId,...record})
}
interface Sql {query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}>}
export async function readAnnualElectricityWorksheet(tx:Sql,companyId:string):Promise<AnnualElectricityWorksheet|null> {
 const allowed=await tx.query<{allowed:boolean}>("select neuvetra.lock_annual_electricity_report_read($1) allowed",[companyId]);if(!allowed.rows[0]?.allowed)return null
 type VersionRow={id:string;company_id:string;version:number;previous_version_id:string|null;payload:Omit<AnnualWorksheetVersion,"review">;input_sha256:string;result_sha256:string;created_by:string;created_at:string}
 type ReviewRow={id:string;company_id:string;version_id:string;payload:AnnualWorksheetReview;decision_sha256:string;reviewed_by:string;reviewed_at:string}
 type AuditRow={record_id:string;kind:string;record_sha256:string;actor_id:string;created_at:string}
 const all=(await tx.query<{versions:VersionRow[];reviews:ReviewRow[];audits:AuditRow[]}>(`select
 coalesce((select jsonb_agg(v order by version) from neuvetra.annual_electricity_worksheet_versions v where company_id=$1),'[]'::jsonb) versions,
 coalesce((select jsonb_agg(r) from neuvetra.annual_electricity_worksheet_reviews r where company_id=$1),'[]'::jsonb) reviews,
 coalesce((select jsonb_agg(a) from neuvetra.annual_electricity_worksheet_audit a where company_id=$1),'[]'::jsonb) audits`,[companyId])).rows[0]!
 const fail=():never=>{throw new Error("Annual worksheet could not be verified.")},iso=(s:string)=>{const d=new Date(s);return Number.isFinite(d.getTime())?d.toISOString():fail()}
 const versions:AnnualWorksheetVersion[]=[]
 if(all.audits.length!==all.versions.length+all.reviews.length)return fail()
 for(const row of all.versions){
  const p=row.payload,previous=versions[versions.length-1]
  if(!exactKeys(p,["id","version","previousVersionId","createdBy","createdAt","companyLabel","facilityLabel","year","geography","unit","evidenceBasis","months","coverage","quantityKwh","quantityMwh","total","method","correctionReason","inputSha256","resultSha256"]))return fail()
  const v={...p,review:null} as AnnualWorksheetVersion
  if(v.id!==row.id||!M64_UUID.test(v.id)||row.company_id!==companyId||v.version!==versions.length+1||v.version!==row.version||v.previousVersionId!==row.previous_version_id||v.previousVersionId!==(previous?.id??null)||!M64_UUID.test(v.createdBy)||v.createdBy!==row.created_by||v.createdAt!==iso(row.created_at)||v.evidenceBasis!==M67_EVIDENCE_BASIS)return fail()
  const inputs:AnnualMonthInput[]=v.months.map(({month,quantityKwh})=>({month,quantityKwh}))
  try{validateAnnualWorksheetInput({companyLabel:v.companyLabel,facilityLabel:v.facilityLabel,year:v.year,geography:v.geography,unit:v.unit,months:inputs,idempotencyKey:v.id},false)}catch{return fail()}
  const expected=calculateAnnualMonths(inputs)
  if(previous?(!safeWorksheetText(v.correctionReason,500)||v.createdAt<previous.createdAt||m67CanonicalJson(annualEffectiveInput(previous))===m67CanonicalJson(annualEffectiveInput(v))):v.correctionReason!==null)return fail()
  if(m67CanonicalJson(expected)!==m67CanonicalJson({months:v.months,quantityKwh:v.quantityKwh,quantityMwh:v.quantityMwh,total:v.total,coverage:v.coverage})||m67CanonicalJson(v.method)!==m67CanonicalJson(M67_METHOD)||v.inputSha256!==row.input_sha256||v.inputSha256!==annualWorksheetInputHash(companyId,v)||v.resultSha256!==row.result_sha256||v.resultSha256!==annualWorksheetResultHash(v.inputSha256,v))return fail()
  const event=all.audits.filter(a=>a.kind==="save"&&a.record_id===v.id)
  if(event.length!==1||event[0]!.record_sha256!==v.resultSha256||event[0]!.actor_id!==v.createdBy||iso(event[0]!.created_at)!==v.createdAt)return fail()
  const reviews=all.reviews.filter(r=>r.version_id===v.id);if(reviews.length>1)return fail()
  if(reviews[0]){
   const r=reviews[0],review=r.payload
   if(!exactKeys(review,["id","versionId","resultSha256","decision","note","acknowledgedLimitations","reviewerId","reviewedAt","decisionSha256"]))return fail()
   try{validateAnnualWorksheetReview({versionId:review.versionId,expectedResultSha256:review.resultSha256,decision:review.decision,note:review.note,acknowledgedLimitations:review.acknowledgedLimitations,idempotencyKey:r.id})}catch{return fail()}
   if(r.company_id!==companyId||review.id!==r.id||review.versionId!==v.id||review.resultSha256!==v.resultSha256||review.reviewerId!==r.reviewed_by||!M64_UUID.test(review.reviewerId)||review.reviewerId===v.createdBy||review.reviewedAt!==iso(r.reviewed_at)||review.reviewedAt<v.createdAt||review.decisionSha256!==r.decision_sha256||review.decisionSha256!==annualWorksheetReviewHash(companyId,review))return fail()
   const audit=all.audits.filter(a=>a.kind==="review"&&a.record_id===review.id)
   if(audit.length!==1||audit[0]!.record_sha256!==review.decisionSha256||audit[0]!.actor_id!==review.reviewerId||iso(audit[0]!.created_at)!==review.reviewedAt)return fail()
   v.review=review
  }
  versions.push(v)
 }
 if(all.reviews.some(r=>!versions.some(v=>v.id===r.version_id)))return fail()
 return {profile:M67_PROFILE,companyId,synthetic:true,complete:false,releaseEligible:false,assurance:"none",limitations:[...M67_LIMITATIONS],versions}
}
