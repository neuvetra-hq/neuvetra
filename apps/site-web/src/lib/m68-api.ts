import type { HostedWorkspaceActor } from "./workspace-api"
import { decodeAnnualElectricityWorksheet, type AnnualElectricityWorksheet } from "./m67-api"
import { decodeElectricitySource } from "./m66-api"
import { M67_MONTHS } from "../../../../packages/neuvetra-database/src/m67-contract"
import { M68_PROFILE, M68_LIMITATIONS, type AnnualElectricityEvidence, type AnnualEvidenceInput, type AnnualEvidenceCorrection, type AnnualEvidenceReviewInput } from "../../../../packages/neuvetra-database/src/m68-contract"
export type { AnnualElectricityEvidence, AnnualEvidenceVersion } from "../../../../packages/neuvetra-database/src/m68-contract"
export const EVIDENCE_LIMITATIONS = M68_LIMITATIONS
export const EVIDENCE_LIMITATION_LABELS: Record<string,string> = {
  synthetic_manual_confirmation:"The entries and bills are fictional and manually confirmed.", document_attachment_not_verification:"Attaching a bill does not verify its quantity or resolve a discrepancy.",
  only_january_2023_bill_fixtures_supported:"Supported bills cover January 2023 only; other months lack bill evidence.", overlapping_documents_not_summed:"Overlapping bills remain flagged and their quantities are never added.",
  overall_inventory_incomplete:"The company inventory remains incomplete.", calendar_2023_camx_single_facility_only:"Only 2023 electricity for one fictional CAMX facility is included.", missing_months_not_zero:"Missing entries are unknown, not zero; missing bills are separate evidence gaps.",
  market_based_scope2_not_included:"Market-based Scope 2 is not included.", factor_and_method_not_released:"The factor and method remain unreleased candidates.", scope_1_and_scope_3_not_assessed:"Scope 1 and Scope 3 have not been assessed.", no_assurance:"This decision provides no assurance or filing approval.",
}
export const evidenceObject = (v:unknown):v is Record<string,unknown> => !!v && typeof v === "object" && !Array.isArray(v)
export const evidenceSame = (a:unknown,b:unknown):boolean => a === b || (Array.isArray(a) && Array.isArray(b) ? a.length===b.length && a.every((v,i)=>evidenceSame(v,b[i])) : evidenceObject(a) && evidenceObject(b) && Object.keys(a).length===Object.keys(b).length && Object.keys(a).every(k=>Object.prototype.hasOwnProperty.call(b,k)&&evidenceSame(a[k],b[k])))
const exact=(v:Record<string,unknown>,keys:string[])=>evidenceSame(Object.keys(v).sort(),[...keys].sort())
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v)
const hash=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v)
const instant=(v:unknown)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))
const text=(v:unknown,max:number)=>typeof v==="string"&&v.length>0&&v.length<=max&&v.trim()===v&&/^[\x20-\x7e]+$/.test(v)
const fail=():never=>{throw new Error("The saved bill evidence could not be verified against the annual entries. Refresh and try again.")}

/** Validate evidence against separately decoded authoritative annual history. */
export function decodeAnnualElectricityEvidence(value:unknown,companyId:string,annual:AnnualElectricityWorksheet):AnnualElectricityEvidence {
  decodeAnnualElectricityWorksheet(annual,companyId)
  if(!evidenceObject(value)||!exact(value,["profile","companyId","synthetic","complete","releaseEligible","assurance","limitations","versions"])||value.profile!==M68_PROFILE||value.companyId!==companyId||value.synthetic!==true||value.complete!==false||value.releaseEligible!==false||value.assurance!=="none"||!evidenceSame(value.limitations,M68_LIMITATIONS)||!Array.isArray(value.versions))return fail()
  const ids=new Set<string>()
  for(const [i,v] of value.versions.entries()) {
    const previous=value.versions[i-1]
    if(!evidenceObject(v)||!exact(v,["id","version","previousVersionId","annual","links","coverage","correctionReason","inputSha256","resultSha256","createdBy","createdAt","review"])||!uuid(v.id)||ids.has(v.id)||v.version!==i+1||v.previousVersionId!==(previous?.id??null)||!uuid(v.createdBy)||!instant(v.createdAt)||!hash(v.inputSha256)||!hash(v.resultSha256)||(i===0?v.correctionReason!==null:!text(v.correctionReason,500))||!evidenceObject(v.annual)||v.annual.review!==null||!Array.isArray(v.links)||v.links.length>2)return fail()
    const source=annual.versions.find(a=>a.id===(v.annual as Record<string,unknown>).id)
    if(!source||!evidenceSame(v.annual,{...source,review:null}))return fail()
    const sources=new Set<string>(),hashes=new Set<string>();let differs=false
    for(const l of v.links) {
      if(!evidenceObject(l)||!exact(l,["month","source","page","periodStart","periodEnd","confirmedBy","confirmedAt","quantityDifferenceReason"])||l.month!=="2023-01"||l.page!==1||l.periodStart!=="2023-01-01"||l.periodEnd!=="2023-01-31"||l.confirmedBy!==v.createdBy||l.confirmedAt!==v.createdAt||source.months[0].quantityKwh===null)return fail()
      const bill=decodeElectricitySource(l.source,companyId)
      if(sources.has(bill.id)||hashes.has(bill.sha256))return fail()
      sources.add(bill.id);hashes.add(bill.sha256)
      const mismatch=bill.printedQuantityKwh!==source.months[0].quantityKwh
      if(mismatch?!text(l.quantityDifferenceReason,500):l.quantityDifferenceReason!==null)return fail()
      differs ||= mismatch
    }
    const linkCount=v.links.length
    const expected={enteredMonths:source.coverage.knownMonths,missingInputMonths:source.coverage.missingMonths,linkedDocumentMonths:v.links.length?1:0,unambiguousDocumentMonths:v.links.length===1?1:0,missingDocumentMonths:M67_MONTHS.filter(m=>m!=="2023-01"||linkCount===0),overlappingDocumentMonths:v.links.length>1?["2023-01"]:[],quantityDifferenceMonths:differs?["2023-01"]:[]}
    if(!evidenceSame(v.coverage,expected))return fail()
    const effective=(links:unknown[])=>links.map(l=>{const x=l as Record<string,unknown>;return {source:x.source,reason:x.quantityDifferenceReason}}).sort((a,b)=>String((a.source as Record<string,unknown>).id).localeCompare(String((b.source as Record<string,unknown>).id)))
    if(previous&&evidenceSame(previous.annual,v.annual)&&evidenceSame(effective(previous.links),effective(v.links)))return fail()
    if(v.review!==null){const r=v.review;if(!evidenceObject(r)||!exact(r,["id","versionId","resultSha256","decision","note","acknowledgedLimitations","reviewerId","reviewedAt","decisionSha256"])||!uuid(r.id)||r.versionId!==v.id||r.resultSha256!==v.resultSha256||!uuid(r.reviewerId)||r.reviewerId===v.createdBy||!instant(r.reviewedAt)||!hash(r.decisionSha256))return fail();if(r.decision==="accept_bounded_internal_draft"?r.note!==null||!evidenceSame(r.acknowledgedLimitations,M68_LIMITATIONS):r.decision!=="changes_requested"||!text(r.note,500)||!evidenceSame(r.acknowledgedLimitations,[]))return fail()}
    ids.add(v.id)
  }
  return value as unknown as AnnualElectricityEvidence
}
export async function annualEvidenceRequest(actor:HostedWorkspaceActor,companyId:string,annual:AnnualElectricityWorksheet,action:"read"|"create"|"corrections"|"reviews"="read",data?:AnnualEvidenceInput|AnnualEvidenceCorrection|AnnualEvidenceReviewInput):Promise<AnnualElectricityEvidence>{
  actor.signal?.throwIfAborted()
  if(!uuid(companyId)||!actor.accessToken||/[\r\n]/.test(actor.accessToken))throw new Error("Sign in again to continue.")
  const r=await fetch(`/workspace-api/workspace/${companyId}/annual-electricity-evidence${action==="read"||action==="create"?"":`/${action}`}`,{method:action==="read"?"GET":"POST",headers:{authorization:`Bearer ${actor.accessToken}`,...(data?{"content-type":"application/json"}:{})},body:data?JSON.stringify(data):undefined,signal:actor.signal,cache:"no-store"})
  actor.signal?.throwIfAborted()
  if(r.status===401||r.status===403){actor.onUnauthorized?.();throw new Error("Your access changed. Sign in again to continue.")}
  const body:unknown=await r.json().catch(()=>null);actor.signal?.throwIfAborted()
  if(!r.ok)throw new Error(r.status===409?"The selected version or evidence changed. Refresh before saving again.":r.status===400||r.status===422?"Check the selected annual version, January bills, discrepancy explanations and review details. Duplicate bills cannot be saved.":"Bill evidence is unavailable. Retry the same action or refresh.")
  return decodeAnnualElectricityEvidence(body,companyId,annual)
}
