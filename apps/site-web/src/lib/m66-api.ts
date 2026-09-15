import { M66_SOURCE_FIXTURES } from "../../../../packages/neuvetra-database/src/m66-fixtures"
import type { SourceElectricityWorksheet, SourceWorksheetInput, SourceWorksheetCorrection, SourceWorksheetReviewInput, SourceWorksheetVersion } from "../../../../packages/neuvetra-database/src/m66-contract"
import type { HostedWorkspaceActor } from "./workspace-api"

export type { SourceElectricityWorksheet, SourceWorksheetVersion }
export const WORKSHEET_LIMITATIONS = ["synthetic_manual_confirmation", "document_attachment_not_verification", "overall_inventory_incomplete", "january_2023_camx_only", "market_based_scope2_not_included", "factor_and_method_not_released", "scope_1_and_scope_3_not_assessed", "no_assurance"] as const
export const LIMITATION_LABELS: Record<typeof WORKSHEET_LIMITATIONS[number], string> = {
  synthetic_manual_confirmation: "A person manually confirmed this fictional entry.",
  document_attachment_not_verification: "Attaching the bill does not verify its contents.",
  overall_inventory_incomplete: "The overall inventory is incomplete.",
  january_2023_camx_only: "Only January 2023 electricity in CAMX is included.",
  market_based_scope2_not_included: "Market-based Scope 2 is not included.",
  factor_and_method_not_released: "The factor and method remain unreleased candidates.",
  scope_1_and_scope_3_not_assessed: "Scope 1 and Scope 3 have not been assessed.",
  no_assurance: "This review provides no assurance or filing approval.",
}
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
const hash = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v)
const obj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v)
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v && /^[\x20-\x7e]+$/.test(v)
const instant = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v))
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join("|") === [...keys].sort().join("|")
const list = (v: unknown, expected: readonly string[]) => Array.isArray(v) && v.length === expected.length && v.every((item, i) => item === expected[i])

/** Validate shape and cross-record identity; numerical calculation stays on the server. */
export function decodeSourceElectricityWorksheet(value: unknown, companyId: string): SourceElectricityWorksheet {
  const fail = (): never => { throw new Error("The saved worksheet could not be verified. Refresh and try again.") }
  if (!obj(value) || !exact(value, ["profile", "companyId", "synthetic", "complete", "releaseEligible", "assurance", "limitations", "versions"]) || value.profile !== "neuvetra.synthetic.source-electricity-worksheet.v1" || value.companyId !== companyId || !uuid(companyId) || value.synthetic !== true || value.complete !== false || value.releaseEligible !== false || value.assurance !== "none" || !list(value.limitations, WORKSHEET_LIMITATIONS) || !Array.isArray(value.versions)) return fail()
  const ids = new Set<string>()
  for (const [i, v] of value.versions.entries()) {
    if (!obj(v) || !exact(v, ["id", "version", "previousVersionId", "companyLabel", "facilityLabel", "quantityKwh", "quantityMwh", "period", "geography", "unit", "correctionReason", "inputSha256", "resultSha256", "createdBy", "createdAt", "total", "method", "review", "evidence"]) || !uuid(v.id) || ids.has(v.id) || v.version !== i + 1 || v.previousVersionId !== (i ? value.versions[i - 1].id : null) || !text(v.companyLabel, 100) || !text(v.facilityLabel, 100) || v.period !== "2023-01" || v.geography !== "CAMX" || v.unit !== "kWh" || (i === 0 ? v.correctionReason !== null : !text(v.correctionReason, 500)) || !hash(v.inputSha256) || !hash(v.resultSha256) || !uuid(v.createdBy) || !instant(v.createdAt)) return fail()
    if (typeof v.quantityKwh !== "string" || !/^(0|[1-9][0-9]{0,6})\.[0-9]{3}$/.test(v.quantityKwh) || Number(v.quantityKwh) > 1000000 || typeof v.quantityMwh !== "string" || !/^(0|[1-9][0-9]{0,3})\.[0-9]{6}$/.test(v.quantityMwh)) return fail()
    if (!obj(v.total) || !exact(v.total, ["unrounded", "display", "unit", "rounding"]) || v.total.unit !== "kg CO2e" || v.total.rounding !== "half_even_4dp" || typeof v.total.unrounded !== "string" || !/^(0|[1-9][0-9]{0,5})(\.[0-9]{0,12}[1-9])?$/.test(v.total.unrounded) || typeof v.total.display !== "string" || !/^(0|[1-9][0-9]{0,5})\.[0-9]{4}$/.test(v.total.display)) return fail()
    if (!obj(v.method) || v.method.id !== "scope2-location-based-egrid-subregion" || v.method.version !== "2023-r2-camx-v1" || v.method.factorId !== "epa-egrid2023-r2-camx-total-output" || v.method.factorVersion !== "eGRID2023-revision-2" || v.method.factorValue !== "195.0402888" || v.method.factorUnit !== "kg CO2e/MWh" || v.method.sourceSha256 !== "3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab" || v.method.sheet !== "SRL23" || v.method.cell !== "AI6" || v.method.classification !== "development_candidate" || v.method.policy !== "m64-accounting-policy-v1" || v.method.accountingProfile !== "manual-synthetic-2023-01-camx-kwh-v1" || v.method.factorCandidateSha256 !== "8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356" || v.method.gwpPolicySha256 !== "fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5" || v.method.reviewedEngineSha256 !== "4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c" || !exact(v.method, ["id", "version", "factorId", "factorVersion", "factorValue", "factorUnit", "sourceSha256", "sheet", "cell", "classification", "policy", "accountingProfile", "factorCandidateSha256", "gwpPolicySha256", "reviewedEngineSha256"])) return fail()
    if (v.review !== null) {
      const r = v.review
      if (!obj(r) || !exact(r, ["id", "versionId", "resultSha256", "decision", "note", "acknowledgedLimitations", "reviewerId", "reviewedAt", "decisionSha256"]) || !uuid(r.id) || r.versionId !== v.id || r.resultSha256 !== v.resultSha256 || !uuid(r.reviewerId) || r.reviewerId === v.createdBy || !instant(r.reviewedAt) || !hash(r.decisionSha256)) return fail()
      if (r.decision === "accept_bounded_internal_draft" ? r.note !== null || !list(r.acknowledgedLimitations, WORKSHEET_LIMITATIONS) : r.decision !== "changes_requested" || !text(r.note, 500) || !list(r.acknowledgedLimitations, [])) return fail()
    }
    const e = v.evidence
    if (!obj(e) || !exact(e,["source","page","confirmedBy","confirmedAt","quantityDifferenceReason"]) || e.page !== 1 || e.confirmedBy !== v.createdBy || e.confirmedAt !== v.createdAt) return fail()
    const source = decodeElectricitySource(e.source,companyId)
    if (source.printedQuantityKwh === v.quantityKwh ? e.quantityDifferenceReason !== null : !text(e.quantityDifferenceReason,500)) return fail()
    if (i > 0 && v.quantityKwh === value.versions[i-1].quantityKwh && source.id === value.versions[i-1].evidence.source.id && v.companyLabel === value.versions[i-1].companyLabel && v.facilityLabel === value.versions[i-1].facilityLabel && e.quantityDifferenceReason === value.versions[i-1].evidence.quantityDifferenceReason) return fail()
    ids.add(v.id)
  }
  return value as unknown as SourceElectricityWorksheet
}

export async function sourceWorksheetRequest(actor: HostedWorkspaceActor, companyId: string, action: "read" | "create" | "corrections" | "reviews" = "read", data?: SourceWorksheetInput | SourceWorksheetCorrection | SourceWorksheetReviewInput): Promise<SourceElectricityWorksheet> {
  actor.signal?.throwIfAborted()
  if (!uuid(companyId) || !actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
  const response = await fetch(`/workspace-api/workspace/${companyId}/source-electricity-worksheet${action === "read" || action === "create" ? "" : `/${action}`}`, {
    method: action === "read" ? "GET" : "POST", headers: { authorization: `Bearer ${actor.accessToken}`, ...(data ? { "content-type": "application/json" } : {}) }, body: data ? JSON.stringify(data) : undefined, signal: actor.signal,
  })
  actor.signal?.throwIfAborted()
  if (response.status === 401 || response.status === 403) { actor.onUnauthorized?.(); throw new Error("Your access changed. Sign in again to continue.") }
  const body: unknown = await response.json().catch(() => null)
  actor.signal?.throwIfAborted()
  if (!response.ok) throw new Error(response.status === 409 ? "This worksheet changed or the request conflicts with a saved version. Refresh before trying again." : (response.status === 400 || response.status === 422) ? "Check the fictional labels, quantity and required review details. Nothing was saved." : "The worksheet is unavailable. Retry the same action or refresh to check whether it was saved.")
  return decodeSourceElectricityWorksheet(body, companyId)
}

export type { ElectricitySource } from "../../../../packages/neuvetra-database/src/m66-contract"
import type { ElectricitySource } from "../../../../packages/neuvetra-database/src/m66-contract"
export function decodeElectricitySource(value:unknown,companyId:string):ElectricitySource {
  if (!obj(value) || !exact(value,["id","companyId","fixtureId","originalName","mediaType","byteLength","sha256","printedQuantityKwh","uploadedBy","uploadedAt"]) || !uuid(companyId) || value.companyId !== companyId || !uuid(value.id) || !text(value.fixtureId,100) || !text(value.originalName,200) || value.mediaType !== "application/pdf" || !Number.isSafeInteger(value.byteLength) || (value.byteLength as number)<1 || (value.byteLength as number)>262144 || !hash(value.sha256) || value.printedQuantityKwh !== "12345.000" || !uuid(value.uploadedBy) || !instant(value.uploadedAt)) throw new Error("The supporting bill could not be verified.")
  const fixture=M66_SOURCE_FIXTURES.find(f=>f.fixtureId===value.fixtureId)
  if(!fixture || fixture.originalName!==value.originalName || fixture.byteLength!==value.byteLength || fixture.sha256!==value.sha256 || fixture.printedQuantityKwh!==value.printedQuantityKwh)throw new Error("The supporting bill is not an approved fictional fixture.")
  return value as unknown as ElectricitySource
}
async function sourceRequest(actor:HostedWorkspaceActor,companyId:string,suffix:string,body?:FormData) {
 actor.signal?.throwIfAborted()
 if (!uuid(companyId) || !actor.accessToken || /[\r\n]/.test(actor.accessToken)) throw new Error("Sign in again to continue.")
 const response=await fetch(`/workspace-api/workspace/${companyId}/source-electricity-worksheet/sources${suffix}`,{method:body?"POST":"GET",headers:{authorization:`Bearer ${actor.accessToken}`},body,signal:actor.signal,cache:"no-store"})
 actor.signal?.throwIfAborted()
 if(response.status===401 || response.status===403){actor.onUnauthorized?.();throw new Error("Your access changed. Sign in again to continue.")}
 if(!response.ok)throw new Error("The bill is unavailable or unsupported. Use one of the supplied fictional PDFs and retry the same action.")
 return response
}
export async function listElectricitySources(actor:HostedWorkspaceActor,companyId:string):Promise<ElectricitySource[]> {
 const r=await sourceRequest(actor,companyId,"");const v:unknown=await r.json();actor.signal?.throwIfAborted()
 if(!obj(v)||!exact(v,["profile","companyId","sources"])||v.profile!=="neuvetra.synthetic.electricity-source.v1"||v.companyId!==companyId||!Array.isArray(v.sources))throw new Error("The bill list could not be verified.")
 const sources=v.sources.map(s=>decodeElectricitySource(s,companyId));if(new Set(sources.map(s=>s.id)).size!==sources.length)throw new Error("Duplicate bill identity.");return sources
}
export async function uploadElectricitySource(actor:HostedWorkspaceActor,companyId:string,file:File,key:string){
 if(file.size<1||file.size>262144)throw new Error("Choose a supplied fictional PDF no larger than 256 KiB.")
 const body=new FormData();body.append("file",file);body.append("idempotencyKey",key)
 const r=await sourceRequest(actor,companyId,"",body);const v=await r.json();actor.signal?.throwIfAborted();return decodeElectricitySource(v,companyId)
}
export async function readElectricitySource(actor:HostedWorkspaceActor,source:ElectricitySource):Promise<ArrayBuffer>{
 decodeElectricitySource(source,source.companyId)
 const metadata=await sourceRequest(actor,source.companyId,`/${source.id}`);const current=decodeElectricitySource(await metadata.json(),source.companyId)
 if(Object.keys(source).some(k=>source[k as keyof ElectricitySource]!==current[k as keyof ElectricitySource]))throw new Error("The bill identity changed.")
 const r=await sourceRequest(actor,source.companyId,`/${source.id}/download`);if(!r.headers.get("content-type")?.startsWith("application/pdf"))throw new Error("Unsupported bill response.")
 const bytes=await r.arrayBuffer();actor.signal?.throwIfAborted();const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(b=>b.toString(16).padStart(2,"0")).join("");actor.signal?.throwIfAborted()
 if(bytes.byteLength!==source.byteLength||digest!==source.sha256)throw new Error("The supporting bill bytes could not be verified.")
 return bytes
}
