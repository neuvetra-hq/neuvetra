import type { HostedWorkspaceActor } from "./workspace-api"
import { M71_ARTIFACT, M71_MAX_VERSIONS, M71_MAX_RESPONSE_BYTES, M71_LIMITATIONS, M71_PROFILE, type M71Register, type M71Version, type M71Review, type M71ReviewInput, type M71SaveInput, type M71EvidenceRef } from "../../../../packages/neuvetra-database/src/m71-contract"
import { M71_EVIDENCE_SHA256, m71CanonicalJson, m71Keys, m71Uuid, m71HashString, m71VersionHashPayload, m71ReviewHashPayload, parseM71Json, validateM71Snapshot, deriveM71Findings } from "../../../../packages/neuvetra-database/src/m71-validation"

export async function coverageSha256(text:string):Promise<string>{const bytes=new TextEncoder().encode(text);const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("")}
const equal=(a:unknown,b:unknown)=>m71CanonicalJson(a)===m71CanonicalJson(b)
const fail=():never=>{throw new Error("The saved coverage could not be verified. Refresh before continuing.")}
const instant=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v
// eslint-disable-next-line no-control-regex
const note=(v:unknown):v is string=>typeof v==="string"&&v.trim()===v&&v.length>0&&Array.from(v).length<=500&&v.normalize('NFC')===v&&!/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(v)
export async function decodeCorporateVersion(value:unknown,companyId:string,previous?:M71Version):Promise<M71Version>{
 try{
  m71Keys(value,["id","inventoryId","companyId","version","previousVersionId","previousVersionSha256","createdBy","createdAt","contributorIds","correctionReason","snapshot","contentSha256","versionSha256","findings","synthetic","corporateCompleteness","releaseEligible","assurance","emissionsTotals","review"])
  if(!m71Uuid(value.id)||!m71Uuid(value.inventoryId)||value.companyId!==companyId||!m71Uuid(companyId)||!m71Uuid(value.createdBy)||!instant(value.createdAt)||!m71HashString(value.contentSha256)||!m71HashString(value.versionSha256)||value.synthetic!==true||value.corporateCompleteness!=="incomplete"||value.releaseEligible!==false||value.assurance!=="none"||value.emissionsTotals!==null||!Number.isInteger(value.version)||Number(value.version)<1)return fail()
  if(!Array.isArray(value.contributorIds)||!value.contributorIds.length||!value.contributorIds.every(m71Uuid)||!equal(value.contributorIds,[...new Set(value.contributorIds)].sort())||!value.contributorIds.includes(value.createdBy))return fail()
  const version=value as unknown as M71Version
  if(previous){if(version.inventoryId!==previous.inventoryId||version.version!==previous.version+1||version.previousVersionId!==previous.id||version.previousVersionSha256!==previous.versionSha256||version.createdAt<previous.createdAt||!note(version.correctionReason)||!equal(version.contributorIds,[...new Set([...previous.contributorIds,version.createdBy])].sort()))return fail()}
  else if(version.version===1){if(version.previousVersionId!==null||version.previousVersionSha256!==null||version.correctionReason!==null||!equal(version.contributorIds,[version.createdBy]))return fail()}
  else if(!m71Uuid(version.previousVersionId)||!m71HashString(version.previousVersionSha256)||!note(version.correctionReason))return fail()
  const normalized=validateM71Snapshot(version.snapshot,previous?.snapshot)
  if(!equal(normalized,version.snapshot)||!equal(deriveM71Findings(normalized),version.findings)||await coverageSha256(m71CanonicalJson(normalized))!==version.contentSha256||await coverageSha256(m71CanonicalJson(m71VersionHashPayload(version)))!==version.versionSha256)return fail()
  if(version.review!==null)await decodeCorporateReview(version.review,companyId,version)
  return version
 }catch{return fail()}
}
export async function decodeCorporateReview(value:unknown,companyId:string,version?:M71Version):Promise<M71Review>{
 try{m71Keys(value,["id","versionId","versionSha256","decision","note","acknowledgedLimitations","reviewerId","reviewedAt","decisionSha256"])
  if(!m71Uuid(value.id)||!m71Uuid(value.versionId)||!m71HashString(value.versionSha256)||!m71Uuid(value.reviewerId)||!instant(value.reviewedAt)||!m71HashString(value.decisionSha256)||typeof value.decision!=="string"||!['accepted_bounded_internal','changes_requested'].includes(value.decision)||!note(value.note))return fail()
  if(!equal(value.acknowledgedLimitations,M71_LIMITATIONS))return fail()
  const review=value as unknown as M71Review
  if(version&&(review.versionId!==version.id||review.versionSha256!==version.versionSha256||version.contributorIds.includes(review.reviewerId)||review.reviewedAt<version.createdAt))return fail()
  if(await coverageSha256(m71CanonicalJson(m71ReviewHashPayload(companyId,review)))!==review.decisionSha256)return fail()
  return review
 }catch{return fail()}
}
export async function decodeCorporateRegister(value:unknown,companyId:string):Promise<M71Register>{
 try{m71Keys(value,["profile","companyId","inventoryId","headVersionId","versions","limitations"])
  if(value.profile!==M71_PROFILE||value.companyId!==companyId||!m71Uuid(companyId)||!equal(value.limitations,M71_LIMITATIONS)||!Array.isArray(value.versions)||value.versions.length>M71_MAX_VERSIONS)return fail()
  if(!value.versions.length){if(value.inventoryId!==null||value.headVersionId!==null)return fail();return value as unknown as M71Register}
  if(!m71Uuid(value.inventoryId)||!m71Uuid(value.headVersionId))return fail()
  const versions:M71Version[]=[];const ids=new Set<string>()
  for(const row of value.versions){const version=await decodeCorporateVersion(row,companyId,versions[versions.length-1]);if(version.version!==versions.length+1||version.inventoryId!==value.inventoryId||ids.has(version.id))return fail();ids.add(version.id);versions.push(version)}
  if(versions[versions.length-1]?.id!==value.headVersionId)return fail()
  return {...value,versions} as unknown as M71Register
 }catch{return fail()}
}
function authorize(actor:HostedWorkspaceActor,companyId:string){actor.signal?.throwIfAborted();if(!m71Uuid(companyId)||!actor.accessToken||/[\r\n]/.test(actor.accessToken))throw new Error("Sign in again to continue.")}
async function request(actor:HostedWorkspaceActor,companyId:string,suffix:string,payload?:unknown):Promise<string>{
 authorize(actor,companyId)
 const response=await fetch(`/workspace-api/workspace/${companyId}/corporate-inventories${suffix}`,{method:payload===undefined?"GET":"POST",headers:{authorization:`Bearer ${actor.accessToken}`,...(payload===undefined?{}:{"content-type":"application/json"})},body:payload===undefined?undefined:JSON.stringify(payload),signal:actor.signal,cache:"no-store"})
 actor.signal?.throwIfAborted()
 if(response.status===401||response.status===403){actor.onUnauthorized?.();throw new Error("Your access changed. Sign in again to continue.")}
 if(response.status===422){let code:unknown;try{const value=parseM71Json(await response.text(),4000);if(value&&typeof value==="object"&&!Array.isArray(value))code=(value as {code?:unknown}).code}catch{/* Keep the ordinary validation message for malformed errors. */}actor.signal?.throwIfAborted();if(code==="history_bytes_limit"||code==="history_limit")throw new Error("This fictional demonstration has reached its saved-history limit. Existing versions remain available for review and download.")}
 if(!response.ok)throw new Error(response.status===409?"The saved version or review changed. Refresh before making another correction.":response.status===422||response.status===400?"Check the proposed decisions, rationale, evidence, dates and correction reason. Nothing was saved.":"Corporate coverage is unavailable. Retry the same action or refresh.")
 const text=await response.text();actor.signal?.throwIfAborted();if(new TextEncoder().encode(text).length>M71_MAX_RESPONSE_BYTES)throw new Error("Coverage response exceeds supported size.");return text
}
export async function corporateRegisterRequest(actor:HostedWorkspaceActor,companyId:string):Promise<M71Register>{const result=await decodeCorporateRegister(parseM71Json(await request(actor,companyId,""),M71_MAX_RESPONSE_BYTES),companyId);actor.signal?.throwIfAborted();return result}
export async function corporateSaveRequest(actor:HostedWorkspaceActor,companyId:string,inventoryId:string|null,input:M71SaveInput):Promise<M71Version>{if(inventoryId!==null&&!m71Uuid(inventoryId))return fail();const result=await decodeCorporateVersion(parseM71Json(await request(actor,companyId,inventoryId?`/${inventoryId}/versions`:"",input)),companyId);actor.signal?.throwIfAborted();return result}
export async function corporateReviewRequest(actor:HostedWorkspaceActor,companyId:string,inventoryId:string,input:M71ReviewInput):Promise<M71Review>{if(!m71Uuid(inventoryId))return fail();const result=await decodeCorporateReview(parseM71Json(await request(actor,companyId,`/${inventoryId}/reviews`,input)),companyId);actor.signal?.throwIfAborted();return result}
export async function corporateExportRequest(actor:HostedWorkspaceActor,companyId:string,version:M71Version):Promise<string>{if(version.companyId!==companyId||!m71Uuid(version.inventoryId)||!m71Uuid(version.id))return fail();const text=await request(actor,companyId,`/${version.inventoryId}/versions/${version.id}/coverage-export`);const exported=await decodeCorporateVersion(parseM71Json(text,M71_MAX_RESPONSE_BYTES),companyId);if(exported.review!==null||!equal(exported,{...version,review:null})||text!==m71CanonicalJson(exported))return fail();actor.signal?.throwIfAborted();return text}
export async function syntheticCoverageReference():Promise<M71EvidenceRef>{if(await coverageSha256(M71_ARTIFACT.text)!==M71_EVIDENCE_SHA256)return fail();return {artifactId:M71_ARTIFACT.id,expectedSha256:M71_EVIDENCE_SHA256,locator:M71_ARTIFACT.locator,purpose:"Fictional coverage screening; sufficiency not established"}}
