import type { WorkspaceSql } from "./workspace"
import { M71_PROFILE, M71_LIMITATIONS, M71_ARTIFACT, type M71Register, type M71Version, type M71Review } from "./m71-contract"
import { M71_EVIDENCE_SHA256, validateM71Snapshot, validateM71Review, m71CanonicalJson, m71VersionHashPayload, m71ReviewHashPayload, deriveM71Findings, m71Uuid, m71Keys } from "./m71-validation"
export * from "./m71-contract"
export * from "./m71-validation"
export const m71Hash=(value:unknown)=>new Bun.CryptoHasher("sha256").update(m71CanonicalJson(value)).digest("hex")
export const m71Export=(v:M71Version)=>m71CanonicalJson({...v,review:null})
/** Fail closed on semantic, lineage, native columns, audit or stored hash mismatch. */
export async function readCorporateInventory(tx:WorkspaceSql,companyId:string):Promise<M71Register|null>{
 if(!(await tx.query<{allowed:boolean}>("select neuvetra.m71_lock($1,false) allowed",[companyId])).rows[0]?.allowed)return null
 const fail=():never=>{throw new Error("Corporate coverage could not be verified.")}
 if(new Bun.CryptoHasher("sha256").update(M71_ARTIFACT.text).digest("hex")!==M71_EVIDENCE_SHA256)return fail()
 type Row={id:string;company_id:string;inventory_id:string;version:number;previous_version_id:string|null;payload:Record<string,unknown>;content_sha256:string;version_sha256:string;created_by:string;created_at:string;export_text:string}
 type ReviewRow={id:string;company_id:string;version_id:string;payload:M71Review;decision_sha256:string;reviewed_by:string;reviewed_at:string}
 type Audit={record_id:string;kind:string;record_sha256:string;actor_id:string;created_at:string}
 type StoredRequest={company_id:string;idempotency_key:string;fingerprint:string;kind:string;record_id:string}
 const all=(await tx.query<{heads:{id:string;company_id:string;version_id:string;revision:number}[];versions:Row[];reviews:ReviewRow[];audits:Audit[];requests:StoredRequest[]}>(`select
 coalesce((select jsonb_agg(h) from neuvetra.corporate_inventory_heads h where company_id=$1),'[]') heads,
 coalesce((select jsonb_agg(v order by version) from neuvetra.corporate_inventory_versions v where company_id=$1),'[]') versions,
 coalesce((select jsonb_agg(r) from neuvetra.corporate_inventory_reviews r where company_id=$1),'[]') reviews,
 coalesce((select jsonb_agg(a) from neuvetra.corporate_inventory_audit a where company_id=$1),'[]') audits,
 coalesce((select jsonb_agg(r) from neuvetra.corporate_inventory_requests r where company_id=$1),'[]') requests`,[companyId])).rows[0]!
 const iso=(v:string)=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():fail()}
 const versions:M71Version[]=[]
 if(all.versions.length>40||all.audits.length!==all.versions.length+all.reviews.length||all.requests.length!==all.audits.length||all.heads.length>1)return fail()
 const checkRequest=(kind:string,recordId:string,actor:string,inventoryId:string|null,request:unknown)=>{const matches=all.requests.filter(r=>r.kind===kind&&r.record_id===recordId);if(matches.length!==1)return fail();const r=matches[0]!;if(r.company_id!==companyId||!m71Uuid(r.idempotency_key)||r.fingerprint!==m71Hash({operation:kind,actor,companyId,inventoryId,request}))return fail()}
 for(const row of all.versions){const p=row.payload,prior=versions[versions.length-1];try{m71Keys(p,["id","inventoryId","companyId","version","previousVersionId","previousVersionSha256","createdBy","createdAt","contributorIds","correctionReason","contentSha256","snapshot","versionSha256"])}catch{return fail()}
  const s=(()=>{try{return validateM71Snapshot(p.snapshot,prior?.snapshot)}catch{return fail()}})()
  const v={...p,snapshot:s,findings:deriveM71Findings(s),synthetic:true,corporateCompleteness:"incomplete",releaseEligible:false,assurance:"none",emissionsTotals:null,review:null} as M71Version
  if(!m71Uuid(v.id)||!m71Uuid(v.inventoryId)||!m71Uuid(v.createdBy)||v.id!==row.id||v.companyId!==companyId||row.company_id!==companyId||v.inventoryId!==row.inventory_id||v.inventoryId!==all.heads[0]?.id||v.version!==versions.length+1||v.version!==row.version||v.previousVersionId!==row.previous_version_id||v.previousVersionId!==(prior?.id??null)||v.previousVersionSha256!==(prior?.versionSha256??null)||v.createdBy!==row.created_by||v.createdAt!==iso(row.created_at)||v.createdAt<(prior?.createdAt??""))return fail()
  const contributors=[...new Set([...(prior?.contributorIds??[]),v.createdBy])].sort()
  if(m71CanonicalJson(v.contributorIds)!==m71CanonicalJson(contributors)||m71CanonicalJson(s)!==m71CanonicalJson(p.snapshot)||v.contentSha256!==m71Hash(s)||v.contentSha256!==row.content_sha256||v.versionSha256!==row.version_sha256||v.versionSha256!==m71Hash(m71VersionHashPayload(v)))return fail()
  if(prior?typeof v.correctionReason!=="string"||!v.correctionReason.trim()||(v.contentSha256===prior.contentSha256&&v.correctionReason===prior.correctionReason):v.correctionReason!==null)return fail()
  if(row.export_text!==m71Export(v))return fail()
  checkRequest("save",v.id,v.createdBy,prior?v.inventoryId:null,{snapshot:v.snapshot,expectedVersionId:v.previousVersionId,expectedVersionSha256:v.previousVersionSha256,correctionReason:v.correctionReason})
  const audit=all.audits.filter(a=>a.record_id===v.id&&a.kind==="save");if(audit.length!==1||audit[0]!.record_sha256!==v.versionSha256||audit[0]!.actor_id!==v.createdBy||iso(audit[0]!.created_at)!==v.createdAt)return fail()
  const reviews=all.reviews.filter(r=>r.version_id===v.id);if(reviews.length>1)return fail()
  if(reviews[0]){const row=reviews[0],r=row.payload;try{m71Keys(r,["id","versionId","versionSha256","decision","note","acknowledgedLimitations","reviewerId","reviewedAt","decisionSha256"]);validateM71Review({versionId:r.versionId,expectedVersionSha256:r.versionSha256,decision:r.decision,note:r.note,acknowledgedLimitations:r.acknowledgedLimitations,idempotencyKey:r.id})}catch{return fail()}
   if(!m71Uuid(r.id)||!m71Uuid(r.reviewerId)||row.company_id!==companyId||r.id!==row.id||r.versionId!==v.id||r.versionSha256!==v.versionSha256||r.reviewerId!==row.reviewed_by||v.contributorIds.includes(r.reviewerId)||r.reviewedAt!==iso(row.reviewed_at)||r.reviewedAt<v.createdAt||r.decisionSha256!==row.decision_sha256||r.decisionSha256!==m71Hash(m71ReviewHashPayload(companyId,r)))return fail()
   const audit=all.audits.filter(a=>a.record_id===r.id&&a.kind==="review");if(audit.length!==1||audit[0]!.record_sha256!==r.decisionSha256||audit[0]!.actor_id!==r.reviewerId||iso(audit[0]!.created_at)!==r.reviewedAt)return fail();checkRequest("review",r.id,r.reviewerId,v.inventoryId,{versionId:r.versionId,expectedVersionSha256:r.versionSha256,decision:r.decision,note:r.note,acknowledgedLimitations:r.acknowledgedLimitations});v.review=r
  }versions.push(v)
 }
 const last=versions[versions.length-1],head=all.heads[0];if(last?head?.version_id!==last.id||head.revision!==last.version:head!==undefined)return fail()
 if(all.reviews.some(r=>!versions.some(v=>v.id===r.version_id)))return fail()
 return {profile:M71_PROFILE,companyId,inventoryId:head?.id??null,headVersionId:last?.id??null,versions,limitations:[...M71_LIMITATIONS]}
}
